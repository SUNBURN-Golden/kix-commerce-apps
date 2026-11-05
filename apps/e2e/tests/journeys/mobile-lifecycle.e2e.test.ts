import { describe, expect, it } from "vitest";
import type { Page } from "playwright-core";
import { poll } from "../../src/desk";
import { useBrowser } from "../../src/suite";

// Dispatched events exercise the web integration, never actual bfcache or device restoration.
async function visibility(page: Page, hidden: boolean) {
  await page.evaluate((hidden) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => hidden ? "hidden" : "visible" });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}
async function pageshow(page: Page, persisted: boolean) {
  await page.evaluate((persisted) => {
    const event = new Event("pageshow");
    Object.defineProperty(event, "persisted", { value: persisted });
    window.dispatchEvent(event);
  }, persisted);
}
async function enabled(page: Page, expected: string) {
  await poll(() => page.locator("#mobile-confirm-ord-0001").getAttribute("data-enabled"), (value) => value === expected, "confirm eligibility");
}
async function keyboardRefresh(page: Page, key: "Enter" | "Space") {
  await page.locator("#mobile-clock").focus();
  await page.keyboard.press("Tab");
  expect(await page.locator("#mobile-refresh").evaluate((node) => node === document.activeElement)).toBe(true);
  await page.keyboard.press(key);
}

describe("mobile lifecycle simulated browser events (stub)", () => {
  const suite = useBrowser();
  for (const lang of ["en", "ko"] as const) {
    it(`${lang}: visible stale explanation, accessible reason, keyboard explicit read, no app network`, async () => {
      const page = await suite.newPage();
      try {
        await page.goto(`${suite.origin}/mobile?lang=${lang}`);
        await enabled(page, "true");
        const rows = await page.locator("#mobile-vault [data-vault]").count();
        expect(rows).toBe(3);
        await pageshow(page, false); await enabled(page, "true");
        await visibility(page, true); await visibility(page, true);
        await visibility(page, false); await visibility(page, false);
        await enabled(page, "false");
        const explanation = lang === "en" ? "actual browser restoration is unverified" : "실제 브라우저 복원은 미검증";
        await poll(() => page.locator("#mobile-status").innerText(), text => text.includes("STALE") && text.includes(explanation), "localized lifecycle explanation");
        expect(await page.locator("#mobile-vault [data-vault]").count()).toBe(rows);
        const reason = await page.locator("#mobile-confirm-ord-0001").getAttribute("aria-describedby");
        expect(reason).toBeTruthy();
        expect(await page.locator(`#${reason}`).innerText()).toContain(explanation);
        await keyboardRefresh(page, "Enter"); await enabled(page, "true");
        await pageshow(page, true); await enabled(page, "true"); // paired with foreground edge
        await pageshow(page, true); await enabled(page, "false"); // standalone restoration
        await keyboardRefresh(page, "Space"); await enabled(page, "true");
        await visibility(page, true); await visibility(page, false);
        await keyboardRefresh(page, "Enter"); await enabled(page, "true");
        await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
        await enabled(page, "false");
        await keyboardRefresh(page, "Space"); await enabled(page, "true");
        await pageshow(page, true); await enabled(page, "false"); // separate restoration, no observed hidden edge
        await suite.pass(page, `mobile.lifecycle.simulated.${lang}`);
      } finally { await page.close(); }
    });
  }

  it("UNKNOWN survives simulated suspension, explicit reads and late delivery with one send", async () => {
    const page = await suite.newPage();
    try {
      await page.goto(`${suite.origin}/mobile?lang=en`);
      await enabled(page, "true");
      await page.locator("#mobile-scenario").selectOption("confirm-lost");
      await enabled(page, "true");
      await page.locator("#mobile-confirm-ord-0001").click();
      await page.locator('[data-outcome="UNKNOWN"]').waitFor();
      await visibility(page, true); await visibility(page, false); await pageshow(page, true);
      await keyboardRefresh(page, "Enter");
      await page.locator("#mobile-deliver-late").click();
      await keyboardRefresh(page, "Space");
      await enabled(page, "false");
      expect(await page.locator("#mobile-withdraw-ord-0001").getAttribute("aria-disabled")).toBe("true");
      expect(await page.locator('[data-outcome="UNKNOWN"]').count()).toBe(1);
      expect(await page.locator("#mobile-record [data-counters]").innerText()).toContain("Sent 1.");
      await suite.pass(page, "mobile.lifecycle.simulated.UNKNOWN");
    } finally { await page.close(); }
  });
});
