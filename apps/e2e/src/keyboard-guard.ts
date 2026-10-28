import type { Page } from "playwright-core";

/**
 * Keyboard-only input guard for the outcome journeys. Two layers:
 *
 * 1. Node side: the page handed to a drive is a Proxy. Pointer and focus shortcuts on the page, on every chained
 *    locator or element handle, on `page.mouse` and on `page.touchscreen` record a violation and throw
 *    PointerInputError. `keyboard.press` accepts only the keys a keyboard-only user needs; `keyboard.type` is text entry.
 * 2. Page side: an init script counts trusted pointer, mouse, touch and wheel events, mouse-initiated clicks and calls to
 *    HTMLElement.prototype.click. The guarded page flushes the count into the node ledger before every goto, reload or
 *    history move, so it survives navigation.
 *
 * Violations stay in the ledger even when a caller catches the exception, so `assertNoPointer` still fails.
 */
export class PointerInputError extends Error {
  constructor(what: string) {
    super(`Pointer or focus shortcut used in a keyboard-only journey: ${what}`);
    this.name = "PointerInputError";
  }
}

export const ALLOWED_KEYS = ["Tab", "Shift+Tab", "Enter", "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const;
export type AllowedKey = (typeof ALLOWED_KEYS)[number];

/** Methods that move the pointer, focus an element or set a value without keys. Refused on page, locator and handle. */
const FORBIDDEN = new Set([
  "click", "dblclick", "tap", "hover", "check", "uncheck", "setChecked", "dragTo", "dragAndDrop", "selectOption",
  "fill", "focus", "blur", "clear", "press", "pressSequentially", "type", "dispatchEvent", "setInputFiles", "selectText",
]);
/** Objects whose every method is refused. */
const POINTER_DEVICES = new Set(["mouse", "touchscreen"]);

const PAGE_COUNTER = `
(() => {
  const w = window;
  w.__kixPointer = [];
  const note = (what) => { w.__kixPointer.push(what); };
  for (const type of ["pointerdown", "pointerup", "pointermove", "mousedown", "mouseup", "mousemove", "touchstart", "touchend", "touchmove", "wheel", "contextmenu", "dblclick"]) {
    w.addEventListener(type, (event) => { if (event.isTrusted) note(type); }, { capture: true });
  }
  // A key on a button fires a click with detail 0 and no pointer type. A mouse or touch click has either.
  w.addEventListener("click", (event) => {
    if (event.isTrusted && (event.detail > 0 || (typeof event.pointerType === "string" && event.pointerType !== ""))) note("click");
  }, { capture: true });
  const click = HTMLElement.prototype.click;
  HTMLElement.prototype.click = function () { note("HTMLElement.click"); return click.apply(this, arguments); };
})();
`;

export interface PointerLedger {
  /** Node-side refusals, in order. */
  violations: string[];
  /** Page-side observations flushed so far. */
  pageEvents: string[];
}

export interface KeyboardGuard {
  /** The only page a drive may use. */
  page: Page;
  ledger: PointerLedger;
  /** Reads the page-side counter into the ledger. Call before any full load clears it. */
  flush: () => Promise<void>;
  /** Flushes, then throws when the ledger holds any violation or page-side pointer event. */
  assertNoPointer: () => Promise<void>;
}

function isGuardable(value: unknown): value is object {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { click?: unknown; locator?: unknown };
  // FrameLocator has no click method itself, but its chained locators must stay guarded too.
  return typeof candidate.click === "function" || typeof candidate.locator === "function";
}

/** Page methods that replace the document. The page-side counter is flushed before each, so nothing it saw is lost. */
const NAVIGATIONS = new Set(["goto", "reload", "goBack", "goForward", "setContent"]);

function guardObject<T extends object>(target: T, ledger: PointerLedger, path: string, beforeNavigate?: () => Promise<void>): T {
  const refuse = (what: string) => {
    ledger.violations.push(what);
    throw new PointerInputError(what);
  };
  const wrapResult = (value: unknown, name: string): unknown => {
    if (value instanceof Promise) {
      return value.then((resolved: unknown) => wrapResult(resolved, name));
    }
    if (Array.isArray(value)) {
      return value.map((item: unknown) => wrapResult(item, name));
    }
    return isGuardable(value) ? guardObject(value, ledger, `${path}.${name}()`) : value;
  };
  return new Proxy(target, {
    get(object, prop, receiver) {
      const name = String(prop);
      if (FORBIDDEN.has(name)) {
        return () => refuse(`${path}.${name}`);
      }
      if (POINTER_DEVICES.has(name)) {
        return new Proxy({}, { get: (_device, method) => () => refuse(`${path}.${name}.${String(method)}`) });
      }
      if (name === "keyboard") {
        const keyboard = Reflect.get(object, prop, receiver) as Page["keyboard"];
        return {
          press: (key: string) => (ALLOWED_KEYS as readonly string[]).includes(key) ? keyboard.press(key) : refuse(`${path}.keyboard.press(${key})`),
          type: (text: string) => keyboard.type(text),
          down: (key: string) => refuse(`${path}.keyboard.down(${key})`),
          up: (key: string) => refuse(`${path}.keyboard.up(${key})`),
          insertText: () => refuse(`${path}.keyboard.insertText`),
        };
      }
      const value = Reflect.get(object, prop, receiver) as unknown;
      if (typeof value !== "function") {
        return value;
      }
      if (beforeNavigate && NAVIGATIONS.has(name)) {
        return async (...args: unknown[]) => {
          await beforeNavigate();
          return wrapResult(await (value as (...a: unknown[]) => Promise<unknown>).apply(object, args), name);
        };
      }
      return (...args: unknown[]) => wrapResult((value as (...a: unknown[]) => unknown).apply(object, args), name);
    },
  });
}

/** Wraps a fresh page. Installs the page-side counter for every later document of this page. */
export async function keyboardOnly(raw: Page): Promise<KeyboardGuard> {
  const ledger: PointerLedger = { violations: [], pageEvents: [] };
  await raw.addInitScript(PAGE_COUNTER);
  const flush = async () => {
    const events = await raw.evaluate(() => {
      const w = window as unknown as { __kixPointer?: string[] };
      const seen = w.__kixPointer ?? [];
      w.__kixPointer = [];
      return seen;
    });
    ledger.pageEvents.push(...events);
  };
  const page = guardObject(raw, ledger, "page", flush);
  return {
    page,
    ledger,
    flush,
    assertNoPointer: async () => {
      await flush();
      const found = [...ledger.violations, ...ledger.pageEvents.map((event) => `page event ${event}`)];
      if (found.length > 0) {
        throw new PointerInputError(found.join(", "));
      }
    },
  };
}
