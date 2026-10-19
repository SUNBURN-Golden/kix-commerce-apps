import { describe, expect, it } from "vitest";
import type { Page } from "playwright-core";
import { useBrowser } from "../../src/suite";
import { openScreen } from "./helpers";

/** sRGB relative luminance of a "rgb(r, g, b)" computed colour. */
function luminance(rgb: string): number {
  const parts = rgb.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(parts[0] ?? 0) + 0.7152 * channel(parts[1] ?? 0) + 0.0722 * channel(parts[2] ?? 0);
}

async function statusMarks(page: Page): Promise<{ kind: string; style: string; word: string }[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-status-mark]")).map((el) => ({
      kind: el.getAttribute("data-status-mark") ?? "",
      style: getComputedStyle(el).borderTopStyle,
      word: (el.querySelector(".status-word")?.textContent ?? el.textContent ?? "").trim(),
    })),
  );
}

describe("display preferences: dark scheme, forced colours, reduced motion, print (stub, headless Chrome)", () => {
  const suite = useBrowser();

  it("the dark scheme inverts the tokens and keeps the word-and-border status marks", async () => {
    const page = await suite.newPage();
    await page.emulateMedia({ colorScheme: "dark" });
    await openScreen(page, suite.origin, "/receipts", "desktop");
    const probe = await page.evaluate(() => ({
      mq: matchMedia("(prefers-color-scheme: dark)").matches,
      scheme: getComputedStyle(document.documentElement).colorScheme,
      surface: getComputedStyle(document.querySelector(".banner") ?? document.body).backgroundColor,
      text: getComputedStyle(document.body).color,
      field: document.querySelector("input,select") ? getComputedStyle(document.querySelector("input,select")!).backgroundColor : "none",
    }));
    expect(probe.mq).toBe(true);
    expect(probe.scheme).toContain("dark");
    expect(luminance(probe.surface), "surface stays dark").toBeLessThan(0.08);
    expect(luminance(probe.text), "text stays light").toBeGreaterThan(0.6);
    const marks = await statusMarks(page);
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      expect(mark.word.length, `${mark.kind} keeps a visible word`).toBeGreaterThan(0);
      expect(mark.style).not.toBe("none");
    }
    await suite.pass(page, "a11y.display.dark");
    await page.close();
  });

  it("forced colours keep every status word and the different border styles", async () => {
    const page = await suite.newPage();
    await page.emulateMedia({ forcedColors: "active" });
    await openScreen(page, suite.origin, "/handoff", "desktop");
    await page.locator(".handoff [role='tablist']").waitFor();
    const probe = await page.evaluate(() => ({
      mq: matchMedia("(forced-colors: active)").matches,
      adjust: getComputedStyle(document.body).forcedColorAdjust,
      currentNav: getComputedStyle(document.querySelector('nav a[aria-current="page"]') ?? document.body).textDecorationLine,
    }));
    expect(probe.mq).toBe(true);
    expect(probe.adjust).toBe("auto");
    // The current nav link keeps a non-colour mark under forced colours.
    expect(probe.currentNav).toContain("underline");
    const marks = await statusMarks(page);
    const styles = new Set(marks.map((mark) => mark.style));
    expect(marks.length).toBeGreaterThan(1);
    for (const mark of marks) {
      expect(mark.word.length, `${mark.kind} keeps a visible word`).toBeGreaterThan(0);
    }
    // In review is dotted, selected is solid: the style, not a colour, carries the difference.
    expect(styles.has("dotted") || styles.has("dashed") || styles.has("double")).toBe(true);
    await suite.pass(page, "a11y.display.forced-colors");
    await page.close();
  });

  it("reduced motion leaves no running transition or animation", async () => {
    const page = await suite.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openScreen(page, suite.origin, "/", "desktop");
    const probe = await page.evaluate(() => {
      const read = (el: Element) => {
        const cs = getComputedStyle(el);
        return {
          transition: parseFloat(cs.transitionDuration),
          animation: parseFloat(cs.animationDuration),
          iterations: cs.animationIterationCount,
        };
      };
      const sample = [
        document.querySelector("button"),
        document.querySelector("nav a"),
        document.querySelector(".banner"),
        document.querySelector("[data-status-mark]"),
      ].filter((el): el is Element => el !== null);
      return {
        mq: matchMedia("(prefers-reduced-motion: reduce)").matches,
        scroll: getComputedStyle(document.documentElement).scrollBehavior,
        items: sample.map(read),
      };
    });
    expect(probe.mq).toBe(true);
    expect(probe.scroll).toBe("auto");
    expect(probe.items.length).toBeGreaterThan(0);
    for (const item of probe.items) {
      expect(item.transition, "no transition runs").toBeLessThan(0.02);
      expect(item.animation, "no animation runs").toBeLessThan(0.02);
      expect(item.iterations).toBe("1");
    }
    await suite.pass(page, "a11y.display.reduced-motion");
    await page.close();
  });

  it("print hides the nav, prints link targets, and keeps the synthetic wording", async () => {
    for (const [path, marker] of [
      ["/receipts", ".receipt"],
      ["/handoff", ".handoff"],
    ] as const) {
      const page = await suite.newPage();
      await page.emulateMedia({ media: "print" });
      await openScreen(page, suite.origin, path, "desktop");
      if (path === "/handoff") {
        await page.locator(".handoff [role='tablist']").waitFor();
      }
      const probe = await page.evaluate((rootSelector) => {
        const root = document.querySelector(rootSelector) ?? document.body;
        const nav = document.querySelector(".top nav");
        const skip = document.querySelector(".skip");
        const pageNav = document.querySelector(".receipt-nav");
        const link = root.querySelector("a[href]");
        return {
          nav: nav ? getComputedStyle(nav).display : "missing",
          skip: skip ? getComputedStyle(skip).display : "missing",
          pageNav: pageNav ? getComputedStyle(pageNav).display : "none-on-page",
          watermark: getComputedStyle(root, "::before").content,
          linkTarget: link ? getComputedStyle(link, "::after").content : "no-link",
        };
      }, marker);
      expect(probe.nav, `${path} shell nav hidden`).toBe("none");
      expect(probe.skip, `${path} skip link hidden`).toBe("none");
      if (path === "/receipts") {
        expect(probe.pageNav).toBe("none");
      }
      expect(probe.watermark, `${path} keeps the synthetic wording`).toContain("Synthetic stub display");
      expect(probe.linkTarget, `${path} prints the link target`).toMatch(/\((#|\/)/);
      await suite.pass(page, "a11y.display.print");
      await page.close();
    }
  });
});
