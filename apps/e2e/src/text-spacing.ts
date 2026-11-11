import type { Page } from "playwright-core";
import { tabWalkProblems } from "./a11y-keyboard";
import { runStep } from "./keyboard-probes";

export type SpacingProblemCode = "spacing.document-overflow" | "spacing.override-missing" | "spacing.text-clipped" | "spacing.control-clipped" | "spacing.control-obscured" | "spacing.control-unreachable" | "spacing.scroll-unreachable";
export interface TextSpacingObservation {
  checkId: string;
  routeId: string;
  path: string;
  locale: "ko" | "en";
  state: "default" | "menu-open" | "validation" | "unknown" | "fixture";
  viewport: { width: 320; height: 568 };
  result: "OBSERVED" | "FINDING" | "NOT_RUN";
  textNodesChecked: number;
  controlsChecked: number;
  nativeControlsChecked: number;
  scrollRegionsChecked: number;
  problems: { code: SpacingProblemCode; target: string }[];
}

export async function installTextSpacing(page: Page): Promise<void> {
  const style = await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-block-end: 2em !important; }' });
  await style.evaluate((el) => (el as HTMLStyleElement).setAttribute("data-kix-spacing", ""));
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

/** Synthetic geometry only. Text/values never leave the browser; targets are structural ordinals. */
export async function probeTextSpacing(page: Page): Promise<Pick<TextSpacingObservation, "textNodesChecked" | "controlsChecked" | "nativeControlsChecked" | "scrollRegionsChecked" | "problems">> {
  // Install a batched geometry reader and deterministic expected set; the existing bounded Tab walk supplies the keys.
  const scrolls = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll<HTMLElement>("body *"));
    const visible = (el: HTMLElement) => el.checkVisibility({ checkVisibilityCSS: true }) && el.getClientRects().length > 0;
    const expected = all.filter((el) => visible(el) && el.matches('button, a[href], input:not([type=hidden]), select, textarea, [tabindex]') && el.tabIndex >= 0 && !el.matches(':disabled') && !el.matches('.skip'));
    all.forEach((el, i) => el.setAttribute("data-spacing-node", String(i)));
    expected.forEach((el) => el.setAttribute("data-spacing-expected", ""));
    const issues: { code: SpacingProblemCode; target: string }[] = [];
    const target = (el: Element) => `[data-spacing-node="${el.getAttribute("data-spacing-node")}"]`;
    const measure = () => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || !el.matches('[data-spacing-expected], .skip')) return;
      const container = !el.matches("button,a,input,select,textarea");
      // Inline links have separate clickable line fragments; their bounding union contains non-clickable gaps.
      const rects = Array.from(el.getClientRects());
      const points: readonly (readonly [number, number])[] = [[.5,.5],[.15,.15],[.85,.15],[.15,.85],[.85,.85]];
      for (const box of rects) {
        const r = container ? { left: Math.max(0, box.left), top: Math.max(0, box.top), right: Math.min(innerWidth, box.right), bottom: Math.min(innerHeight, box.bottom, Math.max(0, box.top) + 44) } : box;
        if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.right <= r.left || r.bottom <= r.top) issues.push({ code: "spacing.control-clipped", target: target(el) });
        if (points.some(([x,y]) => { const hit = document.elementFromPoint(r.left + (r.right-r.left)*x, r.top + (r.bottom-r.top)*y); return !hit || !(hit === el || el.contains(hit)); })) {
          issues.push({ code: "spacing.control-obscured", target: target(el) });
        }
      }
    };
    (window as unknown as { __spacing: unknown }).__spacing = { expected, issues, measure };
    return all.filter((el) => {
      if (!visible(el)) return false;
      const s = getComputedStyle(el);
      return (/auto|scroll/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1) || (/auto|scroll/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1);
    }).map((el) => ({ selector: target(el), axes: [
      ...(/auto|scroll/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1 ? ["x"] : []),
      ...(/auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1 ? ["y"] : []),
    ], focus: el.tabIndex >= 0 ? target(el) : el.querySelector<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"],input:not(:disabled)')?.getAttribute("data-spacing-node") ?? null }));
  });
  if (await page.locator(".skip").count()) {
    await runStep(page, { tabTo: ".skip" });
    await page.keyboard.press("Shift+Tab");
  }
  const keyboard = await tabWalkProblems(page, async () => {
    const editor = await page.evaluate(async () => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || !el.matches('[data-spacing-expected], .skip')) return;
      el.scrollIntoView({ block: el.matches("button,a,input,select,textarea") ? "center" : "start", inline: "center", behavior: "instant" });
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      (window as unknown as { __spacing: { measure: () => void } }).__spacing.measure();
      return el instanceof HTMLInputElement && ["text", "search", "tel", "url"].includes(el.type) && el.value.length > 0;
    });
    if (editor) {
      // Tab selects the editable value; Right reveals its end without changing or submitting it.
      await page.keyboard.press("ArrowRight");
      await page.evaluate(() => {
        const el = document.activeElement as HTMLInputElement;
        if (el.selectionEnd !== el.value.length || (el.scrollWidth > el.clientWidth + 1 && el.scrollLeft <= 0)) {
          (window as unknown as { __spacing: { issues: TextSpacingObservation["problems"] } }).__spacing.issues.push({ code: "spacing.control-clipped", target: `[data-spacing-node="${el.getAttribute("data-spacing-node")}"]` });
        }
      });
    }
  });
  const scrollIssues: TextSpacingObservation["problems"] = [];
  for (const scroll of scrolls) {
    if (scroll.focus === null) { scrollIssues.push({ code: "spacing.scroll-unreachable", target: scroll.selector }); continue; }
    const selector = scroll.focus.startsWith("[") ? scroll.focus : `[data-spacing-node="${scroll.focus}"]`;
    try {
      await runStep(page, { tabTo: selector });
      for (const axis of scroll.axes) {
        const before = await page.locator(scroll.selector).evaluate((el) => [el.scrollLeft, el.scrollTop]);
        let moved = false;
        for (let step = 0; step < 12 && !moved; step++) {
          await page.keyboard.press(axis === "x" ? "ArrowRight" : "ArrowDown");
          await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
          moved = await page.locator(scroll.selector).evaluate((el, { b, axis: direction }) => direction === "x" ? el.scrollLeft !== b[0] : el.scrollTop !== b[1], { b: before, axis });
        }
        if (!moved) {
          await page.keyboard.press(axis === "x" ? "ArrowLeft" : "ArrowUp");
          await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
          moved = await page.locator(scroll.selector).evaluate((el, { b, axis: direction }) => direction === "x" ? el.scrollLeft !== b[0] : el.scrollTop !== b[1], { b: before, axis });
        }
        if (!moved) scrollIssues.push({ code: "spacing.scroll-unreachable", target: scroll.selector });
      }
    } catch { scrollIssues.push({ code: "spacing.scroll-unreachable", target: scroll.selector }); }
  }
  const geometry = await page.evaluate(() => {
    const state = (window as unknown as { __spacing: { expected: HTMLElement[]; issues: TextSpacingObservation["problems"]; measure: () => void } }).__spacing;
    const problems = state.issues;
    const override = document.querySelector<HTMLStyleElement>("style[data-kix-spacing]");
    if (!override?.textContent?.includes("line-height: 1.5 !important")) problems.push({ code: "spacing.override-missing", target: "tab-walk" });
    const target = (el: Element) => `[data-spacing-node="${el.getAttribute("data-spacing-node")}"]`;
    for (const el of state.expected) if (!el.hasAttribute("data-a11y-seen")) problems.push({ code: "spacing.control-unreachable", target: target(el) });
    let textNodesChecked = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    // 1 CSS px absorbs rounding, never a line of missing text.
    const outside = (r: DOMRect, el: HTMLElement, x: boolean, y: boolean) => {
      const b = el.getBoundingClientRect();
      const left = b.left + el.clientLeft, top = b.top + el.clientTop;
      return (x && (r.left < left - 1 || r.right > left + el.clientWidth + 1)) || (y && (r.top < top - 1 || r.bottom > top + el.clientHeight + 1));
    };
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const el = node.parentElement;
      if (!el || !node.textContent?.trim() || el.closest('script,style,option,.skip:not(:focus)') || !el.checkVisibility({ checkVisibilityCSS: true })) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      if (!rects.length) continue;
      textNodesChecked++;
      for (let ancestor: HTMLElement | null = el; ancestor; ancestor = ancestor.parentElement) {
        const s = getComputedStyle(ancestor);
        // Auto/scroll content may be offscreen, but hidden ancestors inside it still clip.
        const x = /^(hidden|clip)$/.test(s.overflowX), y = /^(hidden|clip)$/.test(s.overflowY);
        const clip = ancestor;
        if ((x || y) && rects.some((r) => outside(r, clip, x, y))) problems.push({ code: "spacing.text-clipped", target: target(el) });
      }
    }
    const all = Array.from(document.querySelectorAll<HTMLElement>("body *"));
    let nativeControlsChecked = 0;
    for (const el of all) {
      if (!el.checkVisibility({ checkVisibilityCSS: true }) || el.closest('script,style,option,.skip:not(:focus)')) continue;
      const s = getComputedStyle(el), font = parseFloat(s.fontSize);
      if (!(el instanceof HTMLSelectElement) && (!Number.isFinite(parseFloat(s.lineHeight)) || Math.abs(parseFloat(s.lineHeight) - font*1.5) > .1) || ![s.letterSpacing, s.wordSpacing].every((value) => Number.isFinite(parseFloat(value))) || Math.abs(parseFloat(s.letterSpacing) - font*.12) > .1 || Math.abs(parseFloat(s.wordSpacing) - font*.16) > .1 || (el.tagName === "P" && Math.abs(parseFloat(s.marginBlockEnd) - font*2) > .1)) problems.push({ code: "spacing.override-missing", target: target(el) });
      if (el.matches("input:not([type=hidden]),select,textarea")) {
        nativeControlsChecked++;
        const context = document.createElement("canvas").getContext("2d");
        if (!context) throw new Error("Native control geometry is unavailable");
        context.font = s.font;
        const value = el.matches('input[type="checkbox"],input[type="radio"]') ? "" : el instanceof HTMLSelectElement ? el.selectedOptions[0]?.textContent ?? "" : (el as HTMLInputElement).value;
        const metrics = context.measureText(value);
        const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
        if (height > el.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom) + 1) problems.push({ code: "spacing.control-clipped", target: target(el) });
      }
      // Native controls have no text nodes. Detect value overflow separately (horizontal input editing is keyboard-scrollable).
      if (el.matches('select,textarea,input:not([type=hidden]):not([type=checkbox]):not([type=radio])') && el.clientHeight && el.scrollHeight > el.clientHeight + 1 && /hidden|clip/.test(s.overflowY)) problems.push({ code: "spacing.control-clipped", target: target(el) });
      if ((s.textOverflow === "ellipsis" || s.webkitLineClamp !== "none") && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) problems.push({ code: "spacing.text-clipped", target: target(el) });
    }
    return { textNodesChecked, controlsChecked: state.expected.length, nativeControlsChecked, problems };
  });
  return { ...geometry, scrollRegionsChecked: scrolls.length, problems: [...new Map([...geometry.problems, ...scrollIssues, ...keyboard.problems.map(() => ({ code: "spacing.control-unreachable" as const, target: "tab-walk" }))].map((p) => [`${p.code}:${p.target}`, p])).values()] };
}
