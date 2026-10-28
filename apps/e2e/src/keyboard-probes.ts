import type { JSHandle, Page } from "playwright-core";
import { overflowProblems } from "./a11y-keyboard";
import { type AllowedKey } from "./keyboard-guard";

/**
 * Keyboard steps and read-only probes for the keyboard outcome journeys.
 * Every probe is a page.evaluate read. None focuses a control, changes a value or dispatches an event.
 */

export type KeyStep =
  /**
   * Tab until the focused element matches the selector (and, when given, its trimmed text or aria-label). Shift+Tab is
   * used when the target is behind the focus, unless `forward` is set: a date input entered backwards lands on its year.
   */
  | { tabTo: string; text?: string; forward?: boolean }
  /** Shift+Tab until the focused element matches. */
  | { shiftTabTo: string; text?: string }
  | { press: AllowedKey }
  /** On a focused native select: ArrowDown or ArrowUp until its value is `arrowTo`. Never selectOption. */
  | { arrowTo: string }
  /** Keyboard text entry into the focused text field, empty or fully selected by Tab. Counted per check as a typed field. */
  | { type: string }
  /** Waits until the selector is present. Not an input. */
  | { waitFor: string };

export const LIVE_SELECTOR = '[aria-live]:not([aria-live="off"]), [role="status"]:not([aria-live="off"]), [role="alert"]:not([aria-live="off"]), [role="log"]:not([aria-live="off"])';

/**
 * The announcement observation window. It starts at the final trigger key and closes once the outcome selector is
 * present, at least MIN ms have passed since the key and no live-region text has changed for QUIET ms. A region still
 * changing at CAP ms fails the check. A duplicate that lands inside the window is counted.
 */
export const LIVE_WINDOW = { minMs: 1000, quietMs: 500, capMs: 6000 } as const;

const MAX_TABS = 400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function focusedMatches(page: Page, selector: string, text: string | undefined): Promise<boolean> {
  return page.locator(selector).evaluateAll(
    (els, want) => {
      const el = document.activeElement;
      if (!el || !els.some((item) => item === el)) return false;
      if (want === null) return true;
      return (el.getAttribute("aria-label") ?? "").trim() === want || (el.textContent ?? "").replace(/\s+/g, " ").trim() === want;
    },
    text ?? null,
  );
}

/**
 * Which way to Tab. A read only: the first enabled element matching the selector (and text) decides. When it sits
 * before the focused element, Shift+Tab is the shorter walk. When focus is on the document and the target is in main,
 * the walk starts with the skip link.
 */
async function tabPlan(page: Page, selector: string, text: string | undefined): Promise<{ backwards: boolean; skipToMain: boolean }> {
  return page.locator(selector).evaluateAll(
    (els, want) => {
      const named = (el: Element) => want === null || (el.getAttribute("aria-label") ?? "").trim() === want || (el.textContent ?? "").replace(/\s+/g, " ").trim() === want;
      const target = els.find((el) => named(el) && !(el as HTMLButtonElement).disabled);
      const active = document.activeElement;
      const onDocument = !active || active === document.body || active === document.documentElement;
      if (!target) return { backwards: false, skipToMain: false };
      const inMain = document.getElementById("desk-main")?.contains(target) ?? false;
      if (onDocument) return { backwards: false, skipToMain: inMain };
      return { backwards: target !== active && (target.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0, skipToMain: false };
    },
    text ?? null,
  );
}

/** Runs one step. Returns 1 when the step typed into a field, else 0. */
export async function runStep(page: Page, step: KeyStep): Promise<number> {
  if ("tabTo" in step || "shiftTabTo" in step) {
    const selector = "tabTo" in step ? step.tabTo : step.shiftTabTo;
    const plan = await tabPlan(page, selector, step.text);
    if (plan.skipToMain) {
      // Focus fell to the document: the skip link is the first Tab stop and Enter on it moves focus to main.
      await page.keyboard.press("Tab");
      if (await focusedMatches(page, 'a[href="#desk-main"]', undefined)) {
        await page.keyboard.press("Enter");
      }
    }
    const key = "shiftTabTo" in step || (plan.backwards && !("forward" in step && step.forward)) ? "Shift+Tab" : "Tab";
    for (let i = 0; i < MAX_TABS; i += 1) {
      if (await focusedMatches(page, selector, step.text)) {
        return 0;
      }
      await page.keyboard.press(key);
    }
    throw new Error(`${key} never reached ${selector}${step.text ? ` "${step.text}"` : ""}`);
  }
  if ("press" in step) {
    await page.keyboard.press(step.press);
    return 0;
  }
  if ("arrowTo" in step) {
    for (let i = 0; i < 60; i += 1) {
      const where = await page.evaluate((want) => {
        const el = document.activeElement;
        if (!(el instanceof HTMLSelectElement)) return null;
        const values = Array.from(el.options).map((option) => option.value);
        return { at: values.indexOf(el.value), want: values.indexOf(want) };
      }, step.arrowTo);
      if (!where || where.want < 0) {
        throw new Error(`arrowTo ${step.arrowTo}: the focused element is not a select holding that option`);
      }
      if (where.at === where.want) {
        return 0;
      }
      await page.keyboard.press(where.at < where.want ? "ArrowDown" : "ArrowUp");
    }
    throw new Error(`arrow keys never reached option ${step.arrowTo}`);
  }
  if ("type" in step) {
    // Tab into a text field selects its whole value, so typing replaces it. Anything else is refused.
    const field = await page.evaluate(() => {
      const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
      if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) return null;
      let selected = false;
      try {
        selected = el.selectionStart === 0 && el.selectionEnd === el.value.length;
      } catch {
        selected = false;
      }
      return { replaceable: el.value === "" || selected, id: el.id };
    });
    if (!field || !field.replaceable) {
      throw new Error(`type: the focused element is not an empty or fully selected text field (${JSON.stringify(field)})`);
    }
    await page.keyboard.type(step.type);
    return 1;
  }
  await page.locator(step.waitFor).first().waitFor();
  return 0;
}

/** Installs the announcement counter. Call it immediately before the final trigger key. */
export async function installLiveCounter(page: Page): Promise<void> {
  await page.evaluate((selector) => {
    (window as unknown as { __kixLive?: { observer: MutationObserver } }).__kixLive?.observer.disconnect();
    const ownText = (region: Element): string => {
      if (region instanceof HTMLElement && !region.checkVisibility()) return "";
      let out = "";
      const walk = (node: Node) => {
        node.childNodes.forEach((child) => {
          if (child.nodeType === Node.TEXT_NODE) {
            out += child.nodeValue ?? "";
            return;
          }
          if (child.nodeType !== Node.ELEMENT_NODE) return;
          const el = child as HTMLElement;
          // A nested region owns its own text and is counted on its own. A subtree marked aria-live="off" is not announced.
          if (el.matches(selector) || el.getAttribute("aria-live") === "off") return;
          if (el.hidden || el.getAttribute("aria-hidden") === "true") return;
          if (typeof el.checkVisibility === "function" && !el.checkVisibility()) return;
          walk(el);
          out += " ";
        });
      };
      walk(region);
      return out.replace(/\s+/g, " ").trim();
    };
    const announced = new Map<Element, string>();
    for (const el of Array.from(document.querySelectorAll(selector))) announced.set(el, ownText(el));
    const state = { count: 0, lastChange: performance.now(), log: [] as string[] };
    const describe = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}[${el.getAttribute("role") ?? ""}|${el.getAttribute("aria-live") ?? ""}]`;
    // Each element owns one announcement, including a region inserted during route navigation.
    const scan = () => {
      for (const el of Array.from(document.querySelectorAll(selector))) {
        // A busy region (or a region under a busy ancestor) holds its update until busy clears. One that first shows up
        // busy is in the page with nothing said yet, so its text is announced when busy clears.
        if (el.closest('[aria-busy="true"]')) {
          if (!announced.has(el)) announced.set(el, "");
          continue;
        }
        const text = ownText(el);
        if (!announced.has(el)) {
          announced.set(el, text);
          if (text.length > 0) {
            state.lastChange = performance.now();
            state.count += 1;
            state.log.push(`${describe(el)} inserted: ${text.slice(0, 400)}`);
          }
          continue;
        }
        if (text === announced.get(el)) continue;
        announced.set(el, text);
        state.lastChange = performance.now();
        if (text.length > 0) {
          state.count += 1;
          state.log.push(`${describe(el)}: ${text.slice(0, 400)}`);
        }
      }
    };
    const observer = new MutationObserver(scan);
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-busy", "aria-live", "role", "hidden", "aria-hidden", "class", "style"],
    });
    (window as unknown as { __kixLive: unknown }).__kixLive = { state, observer };
  }, LIVE_SELECTOR);
}

export interface LiveResult {
  count: number;
  /** Region descriptors and a short text excerpt, for a failure message only. Never written to a record. */
  log: string[];
  settled: boolean;
}

/** Shared verdict for the real drives and the negative probe fixtures. */
export function liveProblems(result: LiveResult): string[] {
  return [
    ...(!result.settled ? ["live.not-settled"] : []),
    ...(result.count !== 1 ? [`live.announcements-${result.count}`] : []),
  ];
}

async function readLive(page: Page): Promise<{ count: number; sinceChange: number; log: string[] }> {
  return page.evaluate(() => {
    const live = (window as unknown as { __kixLive?: { state: { count: number; lastChange: number; log: string[] } } }).__kixLive;
    if (!live) return { count: -1, sinceChange: 0, log: ["counter not installed"] };
    return { count: live.state.count, sinceChange: performance.now() - live.state.lastChange, log: live.state.log };
  });
}

/** Waits out the bounded window (see LIVE_WINDOW) and returns the count. The outcome must already be present. */
export async function settleLive(page: Page, startedAt: number): Promise<LiveResult> {
  for (;;) {
    const now = Date.now();
    const read = await readLive(page);
    if (now - startedAt >= LIVE_WINDOW.minMs && read.sinceChange >= LIVE_WINDOW.quietMs) {
      return { count: read.count, log: read.log, settled: true };
    }
    if (now - startedAt >= LIVE_WINDOW.capMs) {
      return { count: read.count, log: read.log, settled: false };
    }
    await sleep(50);
  }
}

export type FocusRule = "STATUS" | "TRIGGER";

/**
 * STATUS: focus is on the status, inside it, or on an element that names the status id through aria-describedby,
 * aria-labelledby or aria-controls. TRIGGER: focus is still on the control that took the final key. Body always fails.
 */
export async function focusProblems(page: Page, rule: FocusRule, status: string, trigger: JSHandle): Promise<{ problems: string[]; where: string }> {
  return page.locator(status).evaluateAll(
    (statuses, { rule: r, trigger: t }) => {
      const active = document.activeElement as HTMLElement | null;
      const where = active ? `${active.tagName.toLowerCase()}${active.id ? `#${active.id}` : ""}` : "none";
      if (!active || active === document.body || active === document.documentElement) {
        return { problems: ["focus.on-body"], where };
      }
      if (r === "TRIGGER") {
        const same = active === t || (t instanceof HTMLElement && t.id !== "" && active.id === t.id);
        return { problems: same ? [] : ["focus.left-trigger"], where };
      }
      const refs = ["aria-describedby", "aria-labelledby", "aria-controls"].flatMap((name) => (active.getAttribute(name) ?? "").split(/\s+/).filter(Boolean));
      const ok = statuses.some((el) => el === active || el.contains(active) || (el.id !== "" && refs.includes(el.id)));
      return { problems: ok ? [] : ["focus.not-on-status"], where };
    },
    { rule, trigger },
  );
}

/** The fenced next-write control must be disabled or aria-disabled, and aria-describedby must reach non-empty text. */
export async function fenceProblems(page: Page, selector: string): Promise<string[]> {
  return page.locator(selector).evaluateAll((controls) => {
    if (controls.length === 0) return ["fence.control-missing"];
    const problems = new Set<string>();
    for (const el of controls) {
      const disabled = (el as HTMLButtonElement).disabled === true || el.getAttribute("aria-disabled") === "true";
      if (!disabled) problems.add("fence.not-disabled");
      const reason = (el.getAttribute("aria-describedby") ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ")
        .trim();
      if (reason.length === 0) problems.add("fence.no-described-reason");
    }
    return [...problems];
  });
}

/** A send-style control name. A NO_WRITE screen must show none of these, and none of the drive's own write selectors. */
export const WRITE_CONTROL_NAME = /^(Send|Submit|Confirm|Place|Issue|Approve|Record|Accept|Transfer|Apply benefit)\b/;

export async function noWriteProblems(page: Page, absent: readonly string[]): Promise<string[]> {
  return page.evaluate(
    ({ absent: selectors, pattern }) => {
      const problems: string[] = [];
      const re = new RegExp(pattern);
      const main = document.getElementById("desk-main") ?? document.body;
      const named = Array.from(main.querySelectorAll("button")).filter((button) => re.test((button.textContent ?? "").trim()));
      if (named.length > 0) problems.push("no-write.send-control-present");
      for (const sel of selectors) {
        if (document.querySelector(sel)) problems.push(`no-write.present:${sel}`);
      }
      return problems;
    },
    { absent, pattern: WRITE_CONTROL_NAME.source },
  );
}

/** Reflow at 360 CSS px for the outcome view. The caller's viewport is restored afterwards. */
export async function reflow360Problems(page: Page): Promise<string[]> {
  const before = page.viewportSize();
  await page.setViewportSize({ width: 360, height: 800 });
  await sleep(100);
  const problems = await overflowProblems(page, "reflow.outcome-360-overflow");
  if (before) {
    await page.setViewportSize(before);
  }
  return problems;
}
