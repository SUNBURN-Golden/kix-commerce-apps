import { describe, expect, inject, it } from "vitest";
import { A11Y_BASELINE, VIEWPORTS } from "../../src/a11y-matrix";
import { runAxe } from "../../src/a11y-axe";
import { useBrowser } from "../../src/suite";
import { GALLERY_CASE_IDS } from "../../src/gallery-matrix";
import { openScreen } from "./helpers";

describe("development-only component gallery", () => {
  const suite = useBrowser();
  const origin = inject("galleryOrigin");

  it("production answers not-found and has no gallery navigation", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/dev/gallery");
    expect(await page.locator("#desk-main").innerText()).toContain("Page not found");
    expect(await page.locator('a[href="/dev/gallery"]').count()).toBe(0);
    await suite.pass(page, "gallery.production-absent");
    await page.close();
  });

  for (const locale of ["en", "ko"] as const) {
    for (const viewport of ["desktop", "narrow"] as const) {
      it(`${locale} / ${viewport}: every specimen has no axe violation`, async () => {
        const page = await suite.newPage();
        await openScreen(page, origin, `/dev/gallery${viewport === "narrow" ? "/" : ""}?lang=${locale}`, viewport);
        expect(await page.locator("[data-gallery-case]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-gallery-case")))).toEqual(GALLERY_CASE_IDS);
        // The gallery index also gets scanned, including the preview frame titles.
        expect((await runAxe(page, A11Y_BASELINE.tags)).violations).toEqual([]);
        await suite.quiet(page, "gallery index");
        for (const id of GALLERY_CASE_IDS) {
          await openScreen(page, origin, `/dev/gallery?specimen=${id}&lang=${locale}`, viewport);
          expect(await page.locator("main").count(), id).toBe(1);
          const result = await runAxe(page, A11Y_BASELINE.tags);
          expect(result.violations, `${id} / ${locale} / ${viewport}`).toEqual([]);
          await suite.quiet(page, id);
        }
        await suite.pass(page, "gallery.cases-axe");
        await page.close();
      });
    }
  }

  it("keyboard opens/closes navigation, changes locale, and reaches empty/error/loading states", async () => {
    const page = await suite.newPage();
    await openScreen(page, origin, "/dev/gallery?specimen=nav-current", "narrow");
    const toggle = page.locator(".nav-toggle");
    await toggle.focus();
    await page.keyboard.press("Enter");
    expect(await toggle.getAttribute("aria-expanded")).toBe("true");
    await page.keyboard.press("Tab");
    expect(await page.locator("nav a").first().evaluate((el) => el === document.activeElement)).toBe(true);
    expect((await runAxe(page, A11Y_BASELINE.tags)).violations).toEqual([]);
    await page.keyboard.press("Escape");
    expect(await toggle.getAttribute("aria-expanded")).toBe("false");
    expect(await toggle.evaluate((el) => el === document.activeElement)).toBe(true);
    await suite.quiet(page, "gallery menu keys");
    await openScreen(page, origin, "/dev/gallery?specimen=locale-switch");
    await page.locator('[data-locale="ko"]').focus();
    await page.keyboard.press("Enter");
    expect(await page.locator('[data-locale="ko"]').getAttribute("aria-pressed")).toBe("true");
    expect(await page.locator('[data-locale="ko"]').evaluate((el) => el === document.activeElement)).toBe(true);
    await suite.quiet(page, "gallery locale keys");
    for (const value of ["", "missing", "breadcrumb-empty", "safe-text-empty", "error-render-error", "error-screen-load-error", "screen-loading"]) {
      await openScreen(page, origin, `/dev/gallery?specimen=${value}&lang=en`);
      if (value === "" || value === "missing") expect(await page.getByRole("status").innerText()).toContain("No specimen matches");
      if (value.startsWith("error-")) {
        expect(await page.locator("#shell-error-title").evaluate((el) => el === document.activeElement)).toBe(true);
        await page.locator("#shell-error-again").focus();
        await page.keyboard.press("Enter");
        expect(await page.locator('[role="alert"]').count()).toBe(1);
      }
      if (value === "screen-loading") expect(await page.locator("[data-screen-loading]").count()).toBe(1);
      await suite.quiet(page, value);
    }
    await suite.pass(page, "gallery.keyboard-states");
    await page.close();
  });

  it("uses existing locale and display preferences without overflow at 320px", async () => {
    const page = await suite.newPage();
    await page.setViewportSize(VIEWPORTS.narrow);
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await openScreen(page, origin, "/dev/gallery?specimen=status-review&lang=ko", "narrow");
      expect(await page.locator("html").getAttribute("lang")).toBe("ko");
      expect(await page.locator(".status-word").innerText()).toBe("검토 중");
      const probe = await page.evaluate(() => ({ scheme: getComputedStyle(document.documentElement).colorScheme, ink: getComputedStyle(document.body).color }));
      expect(probe.scheme).toContain(colorScheme);
      expect(probe.ink).not.toBe("");
      await suite.quiet(page, colorScheme);
    }
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    expect(await page.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(true);
    expect(await page.locator(".status-mark").evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe("dotted");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
    await suite.quiet(page, "forced colors/reduced motion");
    await openScreen(page, origin, "/dev/gallery?lang=en", "narrow");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.emulateMedia({ media: "print" });
    expect(await page.locator(".top nav").evaluate((el) => getComputedStyle(el).display)).toBe("none");
    expect(await page.locator(".gallery-index iframe").first().evaluate((el) => getComputedStyle(el).display)).toBe("none");
    expect(await page.locator("#gallery-title").isVisible()).toBe(true);
    await suite.pass(page, "gallery.locale-preferences");
    await page.close();
  });
});
