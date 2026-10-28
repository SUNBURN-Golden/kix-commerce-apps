import type { Page } from "playwright-core";

declare global {
  interface Window {
    __kixIme?: { attempts: number; mode: "normal" | "held" | "unknown"; release?: () => void };
  }
}
/** Actual browser-engine preedit via CDP, separate from injected event-order exercises and native OS IME. */
export async function engineComposition(page: Page, selector: string, cancel = false, during?: () => Promise<void>) {
  await page.locator(selector).focus();
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Input.imeSetComposition", { text: "한", selectionStart: 1, selectionEnd: 1 });
    await cdp.send("Input.imeSetComposition", { text: "한글", selectionStart: 2, selectionEnd: 2 });
    await during?.();
    if (cancel) await cdp.send("Input.imeSetComposition", { text: "", selectionStart: 0, selectionEnd: 0 });
    else await cdp.send("Input.insertText", { text: "한글" });
  } finally {
    await cdp.detach();
  }
}

/** Injected native-event ordering: end-before-key, key-before-end, legacy 229, interleaved keyup, repeat and blur. */
export async function confirmation(page: Page, selector: string, order: "end-first" | "key-first" | "229", blur = false) {
  await page.locator(selector).evaluate((element, args) => {
    const input = element as HTMLInputElement;
    input.focus();
    const composition = (type: string) => input.dispatchEvent(new CompositionEvent(type, { bubbles: true, data: "한글" }));
    composition("compositionstart");
    if (args.blur) input.blur();
    if (args.order !== "key-first") composition("compositionend");
    const down = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter", isComposing: args.order === "key-first", keyCode: args.order === "229" ? 229 : 13 });
    input.dispatchEvent(down);
    if (!down.defaultPrevented) throw new Error("IME confirmation default was not prevented");
    if (!input.form) throw new Error("Composition target has no form");
    input.form.requestSubmit();
    if (args.order === "key-first") composition("compositionend");
    for (const release of [{ key: "r", code: "KeyR" }, { key: "Shift", code: "ShiftLeft" }, { key: "Process", code: "KeyR", keyCode: 229 }]) {
      input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, ...release }));
      const repeated = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter", repeat: true });
      input.dispatchEvent(repeated);
      if (!repeated.defaultPrevented) throw new Error("Unrelated keyup released IME confirmation guard");
      input.form.requestSubmit();
    }
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }));
  }, { order, blur });
}

export async function observeComposition(page: Page, selector: string) {
  await page.locator(selector).evaluate((element) => {
    const events: Array<{ type: string; composing: boolean; value: string; focus: boolean }> = [];
    (window as unknown as { __kixCompositionEvents: typeof events }).__kixCompositionEvents = events;
    for (const type of ["compositionstart", "compositionupdate", "compositionend", "input", "keydown", "keyup", "blur"]) {
      element.addEventListener(type, (event) => events.push({ type, composing: (event as InputEvent).isComposing === true, value: (element as HTMLInputElement).value, focus: document.activeElement === element }));
    }
  });
}
export async function compositionEvents(page: Page) {
  return page.evaluate(() => (window as unknown as { __kixCompositionEvents: Array<{ type: string; composing: boolean; value: string; focus: boolean }> }).__kixCompositionEvents);
}
