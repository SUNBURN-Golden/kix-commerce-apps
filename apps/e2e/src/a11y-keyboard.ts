import type { Page } from "playwright-core";

/** Probes use page.keyboard and page.evaluate reads. They never call click(). Results are problem codes, not DOM text. */

interface Stop {
  stamp: string;
  seen: boolean;
  named: boolean;
  focusMark: boolean;
  isBody: boolean;
}

const MAX_STOPS = 400;

/** The first Tab must land on the skip link and Enter on it must move focus to the main region. */
export async function skipLinkProblems(page: Page): Promise<string[]> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => {
    const el = document.activeElement as HTMLAnchorElement | null;
    return el ? { href: el.getAttribute("href"), cls: el.className } : null;
  });
  const problems: string[] = [];
  if (!first || first.href !== "#desk-main") {
    problems.push("kbd.skip-link-not-first");
    return problems;
  }
  await page.keyboard.press("Enter");
  const landed = await page.evaluate(() => document.activeElement?.id ?? "");
  if (landed !== "desk-main") {
    problems.push("kbd.skip-link-no-focus-move");
  }
  return problems;
}

/**
 * Walks the page with Tab from the top. Flags a stop with no accessible name, a stop with no visible focus mark,
 * an element reached twice before focus leaves the document (a trap), and a walk that never ends.
 */
export async function tabWalkProblems(page: Page): Promise<{ problems: string[]; stops: number }> {
  await page.evaluate(() => {
    document.querySelectorAll("[data-a11y-seen]").forEach((el) => el.removeAttribute("data-a11y-seen"));
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
    (window as unknown as { __a11yLast?: Element | null }).__a11yLast = null;
  });
  const problems = new Set<string>();
  let stops = 0;
  for (; stops < MAX_STOPS; stops += 1) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate((): Stop => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || el === document.documentElement) {
        return { stamp: "", seen: false, named: true, focusMark: true, isBody: true };
      }
      // A date input holds several sub-fields. Staying on the same element is not a revisit.
      const w = window as unknown as { __a11yLast?: Element | null };
      const same = w.__a11yLast === el;
      w.__a11yLast = el;
      const seen = el.hasAttribute("data-a11y-seen") && !same;
      el.setAttribute("data-a11y-seen", "1");
      const byId = (ids: string | null) =>
        (ids ?? "")
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
          .trim();
      const labels = (el as HTMLInputElement).labels ? Array.from((el as HTMLInputElement).labels ?? []).map((l) => l.textContent ?? "").join(" ").trim() : "";
      const name =
        (el.getAttribute("aria-label") ?? "").trim() ||
        byId(el.getAttribute("aria-labelledby")) ||
        labels ||
        (el.getAttribute("title") ?? "").trim() ||
        (el.textContent ?? "").trim() ||
        ((el as HTMLInputElement).value ?? "").trim();
      const style = getComputedStyle(el);
      const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
      const shadow = style.boxShadow !== "none";
      // A date input has native sub-fields and a picker button whose focus ring is drawn by the browser. Not judged here.
      const native = (el as HTMLInputElement).type === "date";
      return { stamp: el.tagName, seen, named: name.length > 0, focusMark: outline || shadow || native, isBody: false };
    });
    if (stop.isBody) {
      return { problems: [...problems], stops };
    }
    if (stop.seen) {
      // Returning to the skip link is the browser wrapping around, not a trap.
      const wrapped = await page.evaluate(() => (document.activeElement as HTMLAnchorElement).getAttribute("href") === "#desk-main");
      if (!wrapped) {
        problems.add("kbd.trap");
      }
      return { problems: [...problems], stops };
    }
    if (!stop.named) {
      problems.add("kbd.no-name");
    }
    if (!stop.focusMark) {
      problems.add("kbd.no-focus-mark");
    }
  }
  problems.add("kbd.walk-cap");
  return { problems: [...problems], stops };
}

/** Structure probe: table names and headers, scroll regions, status words, control labels, invalid-to-message links. */
export async function structureProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems = new Set<string>();
    const byId = (id: string) => document.getElementById(id);
    document.querySelectorAll("table").forEach((table) => {
      const named =
        (table.getAttribute("aria-label") ?? "").trim() !== "" ||
        (table.getAttribute("aria-labelledby") ?? "").trim() !== "" ||
        table.querySelector("caption") !== null;
      if (!named) {
        problems.add("struct.table-no-name");
      }
      const headers = table.querySelectorAll("thead th, th[scope]");
      if (headers.length === 0) {
        problems.add("struct.table-no-header");
      }
      let node: HTMLElement | null = table.parentElement;
      while (node && node !== document.body) {
        const overflow = getComputedStyle(node).overflowX;
        if (overflow === "auto" || overflow === "scroll") {
          if (node.scrollWidth > node.clientWidth + 1 && node.tabIndex < 0) {
            problems.add("struct.scroll-region-not-focusable");
          }
          break;
        }
        node = node.parentElement;
      }
    });
    document.querySelectorAll("[data-status-mark], [data-status]").forEach((el) => {
      if ((el.textContent ?? "").trim().length === 0) {
        problems.add("struct.status-no-word");
      }
    });
    document.querySelectorAll("input, select, textarea").forEach((control) => {
      const input = control as HTMLInputElement;
      if (input.type === "hidden") {
        return;
      }
      const named =
        (input.labels?.length ?? 0) > 0 ||
        (input.getAttribute("aria-label") ?? "").trim() !== "" ||
        (input.getAttribute("aria-labelledby") ?? "").trim() !== "";
      if (!named) {
        problems.add("struct.control-no-label");
      }
      if (input.getAttribute("aria-invalid") === "true") {
        const ref = input.getAttribute("aria-describedby") ?? input.getAttribute("aria-errormessage") ?? "";
        const linked = ref.split(/\s+/).filter(Boolean).some((id) => byId(id) !== null);
        if (!linked) {
          problems.add("struct.invalid-unlinked");
        }
      }
    });
    return [...problems];
  });
}

/** Reflow probe at the page's current viewport: the document must not scroll sideways. */
export async function overflowProblems(page: Page, code: string): Promise<string[]> {
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  return wide ? [code] : [];
}

/**
 * Approximation only, not browser zoom: a 200% root font size in a 640px window, which is what 320 CSS px looks like
 * at 200% zoom. The caller's viewport is restored afterwards.
 */
export async function rootFontProblems(page: Page): Promise<string[]> {
  const before = page.viewportSize();
  await page.setViewportSize({ width: 640, height: 568 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  const problems = await overflowProblems(page, "reflow.font-200-overflow");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  if (before) {
    await page.setViewportSize(before);
  }
  return problems;
}

/** Tabs until the focused element matches the selector. Keys only. Returns false when focus leaves the page first. */
export async function tabTo(page: Page, selector: string, max = 300): Promise<boolean> {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press("Tab");
    const hit = await page.evaluate((sel) => document.activeElement?.matches(sel) ?? false, selector);
    if (hit) {
      return true;
    }
  }
  return false;
}

export async function activeId(page: Page): Promise<string> {
  return page.evaluate(() => document.activeElement?.id ?? "");
}

/** Disabled or aria-disabled buttons must carry a reason that a screen reader can reach (aria-describedby to text). */
export async function disabledReasonProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems = new Set<string>();
    document.querySelectorAll<HTMLElement>("button[disabled], [aria-disabled='true']").forEach((el) => {
      const ids = (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
      const reason = ids.map((id) => document.getElementById(id)?.textContent ?? "").join("").trim();
      if (reason.length === 0) {
        problems.add("status.disabled-no-reason");
      }
    });
    return [...problems];
  });
}

/** After an invalid submit: focus must be on the control, the control invalid, and the message linked and non-empty. */
export async function formProblems(page: Page, controlId: string): Promise<string[]> {
  return page.evaluate((id) => {
    const problems: string[] = [];
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) {
      return ["form.control-missing"];
    }
    if (document.activeElement !== el) {
      problems.push("form.focus-not-on-control");
    }
    if (el.getAttribute("aria-invalid") !== "true") {
      problems.push("form.not-marked-invalid");
    }
    const ref = el.getAttribute("aria-describedby") ?? el.getAttribute("aria-errormessage") ?? "";
    const text = ref.split(/\s+/).filter(Boolean).map((r) => document.getElementById(r)?.textContent ?? "").join("").trim();
    if (text.length === 0) {
      problems.push("form.error-not-linked");
    }
    return problems;
  }, controlId);
}
