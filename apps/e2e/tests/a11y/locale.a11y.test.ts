import { describe, expect, it } from "vitest";
import { useBrowser } from "../../src/suite";
import { openScreen } from "./helpers";

const SWITCH = ".locale-switch";

describe("display language: switch by keyboard, persistence in the tab, 320px reflow in Korean (stub, headless Chrome)", () => {
  const suite = useBrowser();

  it("Enter and Space on the switch change the language, html lang follows, and focus stays on the pressed button", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/");
    expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
    expect(await page.locator(`${SWITCH} .locale-status`).innerText()).toBe("");
    await page.locator(`${SWITCH} button[data-locale="ko"]`).focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.documentElement.lang === "ko");
    expect(await page.evaluate(() => document.activeElement?.getAttribute("data-locale"))).toBe("ko");
    expect(await page.locator(`${SWITCH} button[data-locale="ko"]`).getAttribute("aria-pressed")).toBe("true");
    expect(await page.locator(`${SWITCH} .locale-status`).innerText()).toContain("한국어");
    expect(await page.locator("a.skip").innerText()).toBe("본문으로 건너뛰기");
    expect(await page.title()).toBe("KIX Box Office");
    await page.locator(`${SWITCH} button[data-locale="en"]`).focus();
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.documentElement.lang === "en");
    expect(await page.locator("a.skip").innerText()).toBe("Skip to content");
    expect(await page.evaluate(() => document.activeElement?.getAttribute("data-locale"))).toBe("en");
    await suite.pass(page, "a11y.locale.switch-keys");
    await page.close();
  });

  it("the choice survives a reload in the tab, comes from ?lang=, and a new tab starts in English again", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/buyer?lang=ko");
    expect(await page.evaluate(() => document.documentElement.lang)).toBe("ko");
    expect(await page.evaluate(() => sessionStorage.getItem("kix-locale"))).toBe("ko");
    expect(await page.evaluate(() => localStorage.getItem("kix-locale"))).toBeNull();
    await openScreen(page, suite.origin, "/receipts");
    expect(await page.evaluate(() => document.documentElement.lang)).toBe("ko");
    expect(await page.locator('nav[aria-label="화면 목록"]').count()).toBe(1);
    // The expiry/clock authority is the adapter's; the page carries the stub binding word verbatim in Korean.
    expect(await page.locator(".crumb-binding strong").innerText()).toBe("stub-only");
    const other = await suite.newPage();
    await openScreen(other, suite.origin, "/receipts");
    expect(await other.evaluate(() => document.documentElement.lang)).toBe("en");
    await other.close();
    await suite.pass(page, "a11y.locale.persist");
    await page.close();
  });

  it("at 320px in Korean the page does not scroll sideways: home, menu open, not-found", async () => {
    const page = await suite.newPage();
    for (const path of ["/?lang=ko", "/no-such-screen"]) {
      await openScreen(page, suite.origin, path, "narrow");
      expect(await page.evaluate(() => document.documentElement.lang)).toBe("ko");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), path).toBe(true);
    }
    await page.locator(".nav-toggle").click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await suite.pass(page, "a11y.locale.reflow-320");
    await page.close();
  });
});
