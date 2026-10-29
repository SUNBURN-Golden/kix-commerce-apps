import { describe, expect, it } from "vitest";
import type { Page } from "playwright-core";
import { useBrowser } from "../../src/suite";
import { runAxe } from "../../src/a11y-axe";
import { A11Y_BASELINE, ratchet } from "../../src/a11y-matrix";
import { tabTo } from "../../src/a11y-keyboard";
import { openScreen } from "./helpers";

// Fixture globals exist only in the aliased shell build.
declare global {
  interface Window {
    __kixReceiptPagination?: boolean;
    __kixReceiptChange?: (mode: "normal" | "transport" | "preceding" | "removed" | "missing" | "duplicate" | "unique") => void;
  }
}

const entries = (page: Page) => page.locator("#receipt-timeline button[data-entry-id]");
async function update(page: Page, mode: Parameters<NonNullable<Window["__kixReceiptChange"]>>[0]) {
  await page.evaluate((next) => window.__kixReceiptChange?.(next), mode);
  await page.waitForFunction(() => document.querySelector("#receipt-timeline-status") !== null);
}

describe("bounded receipt timeline with 5000 deterministic observations", () => {
  const suite = useBrowser();
  async function open() {
    const page = await suite.newPage();
    await page.addInitScript(() => { window.__kixReceiptPagination = true; });
    await openScreen(page, suite.faultOrigin!, "/receipts");
    await page.waitForFunction(() => document.querySelectorAll("#receipt-timeline .receipt-entry").length === 50);
    return page;
  }

  it("counts, first/last, unresolved, keyboard, stable export and 320px reflow in ko/en", async () => {
    const page = await open();
    const before = await page.locator("#receipt-diagnostic").inputValue();
    expect(JSON.parse(before).entries).toHaveLength(5000);
    expect(before).not.toContain("person@example.test");
    expect(await page.locator("#receipt-timeline-status").innerText()).toContain("5000 total");
    expect(await page.locator("#receipt-timeline-status").innerText()).toContain("UNKNOWN): 1000");
    expect(await tabTo(page, 'nav[aria-label="Receipt pages"] button:last-of-type')).toBe(true);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#receipt-timeline-status")?.textContent?.includes("4951–5000"));
    expect(await entries(page).count()).toBe(50);
    expect(await entries(page).last().innerText()).toContain("op-page-4999");
    expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("Last");
    await page.getByRole("button", { name: "First", exact: true }).press("Space");
    await entries(page).first().focus();
    await page.keyboard.press("End");
    expect(await page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.entryId)).toContain("op-page-49");
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowDown");
    expect(await page.locator("#receipt-detail").getAttribute("data-state")).toBe("unknown");
    await page.getByLabel("Filter status", { exact: true }).selectOption("unknown");
    await page.getByLabel("Filter context", { exact: true }).selectOption("gift");
    expect(await page.locator("#receipt-timeline-status").innerText()).toContain("250 matching; 5000 total");
    expect(await page.locator("#receipt-detail").innerText()).toContain("op-page-1");
    expect(await page.locator("#receipt-detail").innerText()).toContain("outside this page or filter");
    expect(await page.locator("#receipt-diagnostic").inputValue()).toBe(before);
    await page.getByLabel("Filter status", { exact: true }).selectOption("loading");
    expect(await entries(page).count()).toBe(0);
    expect(await page.locator("#receipt-timeline-status").innerText()).toContain("0–0 of 0");
    await page.getByRole("button", { name: "Clear filters", exact: true }).press("Enter");
    for (const locale of ["en", "ko"] as const) {
      await page.locator(`.locale-switch button[data-locale="${locale}"]`).click();
      await page.setViewportSize({ width: 320, height: 800 });
      const axe = await runAxe(page, A11Y_BASELINE.tags);
      expect(ratchet("receipts", "narrow", axe.violations.map((v) => v.ruleId)).unlisted).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await page.locator("#receipt-timeline .receipt-entry").count()).toBe(50);
      expect(await page.locator("#receipt-diagnostic").inputValue()).toBe(before);
    }
    for (const media of [{ colorScheme: "dark" as const }, { forcedColors: "active" as const }]) {
      await page.emulateMedia(media);
      await page.locator("#receipt-status-filter").focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      const focus = await page.locator("#receipt-status-filter").evaluate((node) => ({ outline: getComputedStyle(node).outlineStyle, height: node.getBoundingClientRect().height }));
      expect(focus.outline).not.toBe("none");
      expect(focus.height).toBeGreaterThanOrEqual(44);
    }
    await suite.quiet(page, "receipt pagination keyboard, counts, export, axe and reflow");
    await page.close();
  });

  it("transport rows retain DOM focus through sequence changes; missing/ambiguous selection never restores", async () => {
    const page = await open();
    await update(page, "transport");
    const gift = page.locator('#receipt-timeline [data-action="adapter_path"] button').first();
    await gift.click();
    expect(await entries(page).count()).toBe(50);
    const identity = await gift.getAttribute("data-entry-id");
    await update(page, "preceding");
    await page.waitForFunction(() => document.querySelectorAll('#receipt-timeline [data-action="adapter_path"]').length === 2);
    expect(await page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.entryId)).toBe(identity);
    expect(await entries(page).count()).toBe(50);
    await update(page, "transport");
    await page.waitForFunction(() => document.querySelectorAll('#receipt-timeline [data-action="adapter_path"]').length === 1);
    expect(await page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.entryId)).toBe(identity);
    expect(await entries(page).count()).toBe(50);
    await update(page, "removed");
    await page.waitForFunction(() => document.activeElement?.id === "receipt-timeline-status");
    expect(await page.locator("#receipt-detail").getAttribute("data-state")).toBe("empty");
    for (const mode of ["missing", "duplicate"] as const) {
      await entries(page).nth(1).click();
      await update(page, mode);
      await page.waitForFunction(() => document.querySelector("#receipt-detail")?.getAttribute("data-state") === "empty");
      await update(page, "unique");
      await page.waitForFunction(() => document.querySelector("#receipt-timeline-status")?.textContent?.includes("5000 total"));
      expect(await page.locator("#receipt-detail").getAttribute("data-state")).toBe("empty");
    }
    await page.getByRole("tab", { name: "Organizer", exact: true }).press("Enter");
    expect(await page.locator("#receipt-timeline-status").innerText()).toContain("1250 total");
    expect(await page.locator("#receipt-detail").getAttribute("data-state")).toBe("empty");
    expect(await page.locator("#receipt-context-filter option").allTextContents()).toEqual(["All", "Organizer", "Adapter path"]);
    expect(await page.locator("#receipt-diagnostic").inputValue()).not.toContain("op-page-1\"");
    await suite.quiet(page, "receipt stable transport focus, permanent invalidation and role boundary");
    await page.close();
  });
});
