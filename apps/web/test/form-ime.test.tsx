// @vitest-environment jsdom
import { act, createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ValidatedForm } from "../src/forms/ValidatedForm";
import type { ValidationHandle } from "../src/forms/useFormValidation";
import { field } from "../src/forms/validation";
import { LocaleProvider } from "../src/i18n/LocaleProvider";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { BookingPage } from "../src/pages/Booking";
import { GiftPage } from "../src/pages/Gift";
import { OrganizerPage } from "../src/pages/Organizer";
import { protocol } from "../src/connectivity/desk-protocol";
import { giftSource } from "../src/gift-source";
import { organizerSource } from "../src/organizer-source";
import { giftDesk } from "../src/gift-desk";
import { organizerDesk } from "../src/organizer-desk";
import { change, click, dispatch, element, renderDom, button } from "./support/render-dom";

const rules = [field("draft", "validation.label.quantity", { kind: "bookingQuantity" })];
const compose = (type: string, data = "") => new CompositionEvent(type, { bubbles: true, data });
const key = (type: string, extra: KeyboardEventInit = {}) => new KeyboardEvent(type, { key: "Enter", bubbles: true, cancelable: true, ...extra });
const turn = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });

async function harness(locale: "ko" | "en" = "ko") {
  const send = vi.fn();
  const validation = createRef<ValidationHandle>();
  function Form() {
    const [value, setValue] = useState("1");
    return <LocaleProvider initial={locale}><ValidatedForm fields={rules} validationRef={validation} onSubmit={send}>
      <label htmlFor="draft">Quantity<input id="draft" value={value} onChange={(event) => setValue(event.target.value)} aria-describedby="hint" /></label>
      <p id="hint">Hint</p><button>Send</button>
    </ValidatedForm><button onClick={() => { if (validation.current?.validate()) send(); }}>External</button></LocaleProvider>;
  }
  const mounted = await renderDom(<Form />);
  const input = element<HTMLInputElement>(mounted.container, "input");
  await act(async () => input.focus());
  return { ...mounted, input, send, validation, form: element<HTMLFormElement>(mounted.container, "form") };
}

describe("IME form transactions (automated DOM sequences, no native IME claim)", () => {
  it.each(["start-key-end", "start-end-key", "legacy-229"])("suppresses %s confirmation, imperative validation and repeated Enter, then accepts an immediate fresh Enter", async (order) => {
    const { input, form, send, validation, container } = await harness();
    await dispatch(input, compose("compositionstart"));
    await change(input, "한글");
    expect(input.value).toBe("한글");
    expect(validation.current?.validate()).toBe(false);
    await dispatch(form, new Event("submit", { bubbles: true, cancelable: true }));
    expect(container.querySelector(".error-summary")).toBeNull();
    expect(container.querySelector('[data-validation-refused="true"]')).toBeNull();
    expect(document.activeElement).toBe(input);
    // End-before-key is deliberately one native turn, as in the browser's confirmation default action.
    await act(async () => {
      if (order !== "start-key-end") input.dispatchEvent(compose("compositionend", "한글"));
      const down = key("keydown", order === "legacy-229" ? { keyCode: 229, isComposing: false } : { isComposing: order === "start-key-end" });
      input.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(true);
      form.requestSubmit(); // a hostile implicit submit must still be fenced
      input.dispatchEvent(key("keydown", { repeat: true }));
      if (order === "start-key-end") input.dispatchEvent(compose("compositionend", "한글"));
    });
    expect(send).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
    await dispatch(input, key("keyup"));
    await change(input, "2");
    const fresh = key("keydown");
    await dispatch(input, fresh);
    expect(fresh.defaultPrevented).toBe(false);
    await dispatch(form, new Event("submit", { bubbles: true, cancelable: true }));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("does not cancel ordinary legacy-229 preedit keystrokes or leave a swallow-next-Enter flag", async () => {
    const { input, form, send } = await harness();
    await dispatch(input, compose("compositionstart"));
    const letter = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Process", code: "KeyR", keyCode: 229, isComposing: true });
    await dispatch(input, letter);
    expect(letter.defaultPrevented).toBe(false);
    await change(input, "1");
    await dispatch(input, compose("compositionend", ""));
    await turn();
    const enter = key("keydown");
    await dispatch(input, enter);
    expect(enter.defaultPrevented).toBe(false);
    await dispatch(form, new Event("submit", { bubbles: true, cancelable: true }));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each(["ko", "en"] as const)("retains invalid Korean text, linked hints, repeated summary focus and corrections in %s", async (locale) => {
    const { input, form, send, container } = await harness(locale);
    await dispatch(input, compose("compositionstart"));
    await change(input, "한글");
    await dispatch(input, compose("compositionend", "한글"));
    await turn();
    for (let attempt = 0; attempt < 2; attempt++) {
      await dispatch(form, new Event("submit", { bubbles: true, cancelable: true }));
      expect(document.activeElement).toBe(container.querySelector(".error-summary"));
      expect(input.value).toBe("한글");
      expect(input.getAttribute("aria-describedby")).toBe("hint draft-format-error");
      await click(element(container, '.error-summary a[href="#draft"]'));
      expect(document.activeElement).toBe(input);
    }
    await dispatch(input, compose("compositionstart"));
    await change(input, "1");
    // Existing errors are frozen while composing, not replaced by intermediate valid text.
    expect(input.getAttribute("aria-invalid")).toBe("true");
    await dispatch(input, compose("compositionend", "1"));
    await turn();
    expect(input.getAttribute("aria-invalid")).toBe("false");
    await click(element(container, "button"));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])("defers blur (blur-before-end=%s), preserves cancellation's restored value and never moves focus", async (blurFirst) => {
    const { input, container, send } = await harness();
    const external = element<HTMLButtonElement>(container, "button:last-child");
    await dispatch(input, compose("compositionstart"));
    await change(input, "ㅎ");
    if (blurFirst) await act(async () => external.focus());
    expect(container.querySelector(".error-summary")).toBeNull();
    // Empty data also occurs on successful end; use the browser's actual restored value.
    await change(input, "1");
    await dispatch(input, compose("compositionend"));
    if (!blurFirst) await act(async () => external.focus());
    await turn();
    expect(input.value).toBe("1");
    expect(document.activeElement).toBe(external);
    expect(send).not.toHaveBeenCalled();
    await click(external);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("chains form and child handlers exactly once and respects consumer submit cancellation", async () => {
    const names = ["start", "end", "down", "up", "change", "blur", "childStart", "childEnd", "childDown", "childChange", "childBlur"] as const;
    const spies = Object.fromEntries(names.map((name) => [name, vi.fn()])) as Record<typeof names[number], ReturnType<typeof vi.fn>>;
    const send = vi.fn();
    const { container } = await renderDom(<ValidatedForm fields={rules} onSubmit={send} onSubmitCapture={(e) => e.preventDefault()}
      onCompositionStartCapture={spies.start} onCompositionEndCapture={spies.end} onKeyDownCapture={spies.down} onKeyUpCapture={spies.up} onChangeCapture={spies.change} onBlurCapture={spies.blur}>
      <input id="draft" defaultValue="1" onCompositionStart={spies.childStart} onCompositionEnd={spies.childEnd} onKeyDown={spies.childDown} onChange={spies.childChange} onBlur={spies.childBlur} />
      <button>Send</button></ValidatedForm>);
    const input = element<HTMLInputElement>(container, "input");
    await act(async () => input.focus());
    await dispatch(input, compose("compositionstart"));
    await change(input, "2");
    await dispatch(input, key("keydown", { isComposing: true }));
    await dispatch(input, compose("compositionend"));
    await dispatch(input, key("keyup"));
    await act(async () => input.blur());
    for (const name of names) expect(spies[name], name).toHaveBeenCalledTimes(1);
    await click(element(container, "button"));
    expect(send).not.toHaveBeenCalled();
  });

  it("drops a stale summary focus request if composition begins before the effect", async () => {
    const { input, validation, container } = await harness();
    await change(input, "bad");
    await act(async () => {
      validation.current?.validate();
      input.dispatchEvent(compose("compositionstart"));
    });
    expect(document.activeElement).toBe(input);
    await dispatch(input, compose("compositionend"));
    await turn();
    expect(document.activeElement).toBe(input);
    expect(container.querySelector(".error-summary")).not.toBeNull();
  });

  it("handles textarea, select, scoped/hidden/disabled controls and removal/unmount cleanup", async () => {
    const ref = createRef<ValidationHandle>();
    const send = vi.fn();
    const fields = [field("text", "validation.label.eventId"), field("pick", "validation.label.eventId"), field("absent", "validation.label.eventId"), field("disabled", "validation.label.eventId")];
    const form = (show: boolean) => <ValidatedForm fields={fields} validationRef={ref} busy onSubmit={send}>
      {show ? <textarea id="text" defaultValue="" /> : null}<select id="pick" defaultValue=""><option value="">Empty</option><option value="ok">OK</option></select>
      <input id="disabled" disabled /><button>Send</button></ValidatedForm>;
    const { container, rerender, unmount } = await renderDom(form(true));
    const text = element(container, "textarea");
    await dispatch(text, compose("compositionstart"));
    expect(ref.current?.validate(["pick"])).toBe(false);
    await rerender(form(false));
    await act(async () => { expect(ref.current?.validate(["text", "absent", "disabled"])).toBe(true); });
    await change(element<HTMLSelectElement>(container, "select"), "ok");
    await act(async () => { expect(ref.current?.validate(["pick"])).toBe(true); });
    await click(element(container, "button"));
    expect(send).not.toHaveBeenCalled();
    await rerender(form(true));
    await dispatch(element(container, "textarea"), compose("compositionend"));
    await unmount();
    await turn();
    expect(ref.current).toBeNull();
  });
});


describe("representative commerce pages with real controllers and stub send boundaries", () => {
  it.each(["booking", "gift", "organizer"] as const)("%s keeps Korean draft during composition and sends once after a deliberate valid action", async (name) => {
    giftDesk.reset();
    organizerDesk.reset();
    const send = name === "booking" ? vi.spyOn(protocol, "placeHold")
      : vi.spyOn(name === "gift" ? giftSource!.invoker : organizerSource!.invoker, "invokeLocalCall");
    const page = name === "booking" ? <MemoryRouter initialEntries={["/booking/evt_lanterns"]}><Routes><Route path="/booking/:eventId" element={<BookingPage />} /></Routes></MemoryRouter>
      : name === "gift" ? <GiftPage /> : <OrganizerPage />;
    const { container } = await renderDom(page);
    if (name === "gift") {
      for (const [id, value] of [["gift-id", "ime-dom-gift"], ["gift-expected-version", "1"], ["gift-expires-at", "4102444800"]]) await change(element(container, `#${id}`), value);
    }
    if (name === "organizer") await change(element(container, "#organizer-seats"), "A1");
    const input = element<HTMLInputElement>(container, name === "booking" ? "#booking-quantity" : name === "gift" ? "#gift-ticket-id" : "#organizer-event");
    const form = input.form!;
    await act(async () => input.focus());
    await dispatch(input, compose("compositionstart"));
    await change(input, "한글");
    // Programmatic activation deliberately avoids blur, exercising the external imperative guard.
    const action = name === "booking" ? element<HTMLButtonElement>(container, "#booking-place") : button(container, name === "gift" ? "Send offer_gift" : "Send create_event");
    await click(action);
    await dispatch(form, new Event("submit", { bubbles: true, cancelable: true }));
    expect(send).not.toHaveBeenCalled();
    expect(input.value).toBe("한글");
    expect(document.activeElement).toBe(input);
    await act(async () => {
      input.dispatchEvent(compose("compositionend", "한글"));
      const down = key("keydown");
      input.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(true);
      form.requestSubmit();
      input.dispatchEvent(key("keyup"));
    });
    expect(send).not.toHaveBeenCalled();
    if (name === "booking") await change(input, "2");
    await click(action);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
