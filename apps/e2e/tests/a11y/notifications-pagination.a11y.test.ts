import { describe, expect, it } from "vitest";
import { useBrowser } from "../../src/suite";
import { poll } from "../../src/desk";
import { runAxe } from "../../src/a11y-axe";
import { A11Y_BASELINE, ratchet } from "../../src/a11y-matrix";
import { tabTo } from "../../src/a11y-keyboard";
import { openScreen } from "./helpers";

declare global {
  interface Window {
    __kixNotificationPagination?: boolean;
    __kixNotificationChange?: (count: number, allUnread?: boolean) => void;
  }
}

describe("notification pager keyboard and bilingual announcements", () => {
  const suite = useBrowser();
  it("keeps boundaries focusable, announces ko/en ranges, recovers removed-row focus and reflows at 320px", async () => {
    const page = await suite.newPage();
    await page.addInitScript(() => { window.__kixNotificationPagination = true; });
    await openScreen(page, suite.faultOrigin!, "/notifications?lang=en");
    const status = page.locator("#notify-page-status");
    await poll(() => page.locator("[data-notification]").count(), (n) => n === 20, "fixture inbox");
    expect(await status.getAttribute("aria-atomic")).toBe("true");
    expect(await tabTo(page, 'nav[aria-label="Notification pages"] button:last-of-type')).toBe(true);
    await page.keyboard.press("Enter");
    await poll(() => status.innerText(), (s) => s.includes("Page 6 of 6"), "last page");
    expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("Last");
    await page.keyboard.press("Space");
    expect(await status.innerText()).toContain("Page 6 of 6");
    expect(await status.getAttribute("aria-live")).toBe("polite");
    await page.getByRole("button", { name: "First", exact: true }).press("Space");
    await poll(() => status.innerText(), (s) => s.includes("Page 1 of 6"), "first page");
    await page.locator('[data-read-choice="item"]').first().focus();
    await page.evaluate(() => window.__kixNotificationChange?.(20));
    await poll(() => status.innerText(), (s) => s.includes("20 total"), "surviving focus");
    expect(await page.evaluate(() => document.activeElement?.getAttribute("data-read-value"))).toBe("ntf-1001");
    await page.evaluate(() => window.__kixNotificationChange?.(0));
    await poll(() => page.evaluate(() => document.activeElement?.id), (s) => s === "notify-page-status", "removed row focus recovery");
    await page.locator("#notify-refresh").focus();
    await page.evaluate(() => window.__kixNotificationChange?.(21));
    await poll(() => status.innerText(), (s) => s.includes("21 total"), "regrowth");
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("notify-refresh");
    for (const locale of ["ko", "en"] as const) {
      await page.locator(`.locale-switch button[data-locale="${locale}"]`).click();
      await poll(() => status.innerText(), (s) => s.includes(locale === "ko" ? "전체 21개" : "21 total"), "localized page range");
      expect(await status.innerText()).toContain(locale === "ko" ? "1/2 페이지" : "Page 1 of 2");
      await page.setViewportSize({ width: 320, height: 800 });
      const axe = await runAxe(page, A11Y_BASELINE.tags);
      expect(ratchet("notifications", "narrow", axe.violations.map((v) => v.ruleId)).unlisted).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await page.locator("[data-notification]").count()).toBe(20);
    }
    await suite.quiet(page, "notification bilingual pager, keyboard, focus, axe and narrow reflow");
    await page.close();
  });
});
