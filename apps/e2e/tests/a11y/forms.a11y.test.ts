import { describe, expect, it } from "vitest";
import type { Page } from "playwright-core";
import { formProblems, tabTo, overflowProblems } from "../../src/a11y-keyboard";
import { useBrowser } from "../../src/suite";
import { openScreen } from "./helpers";

// One row per real form. Optional filters and boolean flags have no invented required input.
const FORMS = [
  { path: "/booking/evt_lanterns", field: "booking-quantity", button: "Place hold" },
  { path: "/admission", field: "admission-gate" },
  { path: "/admission", field: "admission-event", button: "Load mock case" },
  { path: "/resale", field: "resale-booking", button: "Open listing" },
  { path: "/gift", field: "gift-ticket-id", button: "Send offer_gift", setup: "gift-id" },
  { path: "/organizer", field: "organizer-seats", button: "Send create_event", setup: "organizer-event" },
  { path: "/organizer/workspace", field: "organizer-ws-event-id", button: "Add to change list" },
  { path: "/assistant", field: "dlg-request-text", button: "Ask" },
  { path: "/inventory?section=sec-pit", field: "inventory-quantity", button: "Select quantity" },
  { path: "/marketing/m01", field: "membership-name", button: "Issue demo card" },
  { path: "/marketing/m03", field: "coupon-code", button: "Apply demo code" },
  { path: "/marketing/m04", field: "referral-code", button: "Count demo marker" },
  { path: "/marketing/m05", field: "consent-subject", button: "Send set_consent", setup: "consent-event" },
] as const;

async function summaryLink(page: Page, field: string) {
  const summary = page.locator(".error-summary").first();
  await summary.waitFor();
  expect(await summary.evaluate((el) => el === document.activeElement)).toBe(true);
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.getAttribute("href"))).toBe(`#${field}`);
  await page.keyboard.press("Enter");
  expect(await formProblems(page, field)).toEqual([]);
}

declare global {
  interface Window { __kixFormDeferred?: { attempts: number; release?: () => void } }
}

describe("all form input errors, local stub browser evidence", () => {
  const suite = useBrowser();
  for (const row of FORMS) {
    it(`${row.path} ${row.field}: empty input, summary focus, linked error and keyboard correction`, async () => {
      const page = await suite.newPage();
      await openScreen(page, suite.origin, row.path);
      const control = page.locator(`#${row.field}`);
      await control.waitFor();
      expect(await page.locator(".error-summary").count()).toBe(0);
      if ("setup" in row) await page.locator(`#${row.setup}`).fill("caller-form-fixture");
      await control.fill("");
      if (row.field === "booking-quantity" && process.env.KIX_FORM_SCREENSHOTS) {
        await page.locator("#booking-form").evaluate((el) => el.scrollIntoView({ block: "start" }));
        await page.screenshot({ path: `${process.env.KIX_FORM_SCREENSHOTS}/empty.png` });
      }
      if ("button" in row) {
        await page.getByRole("button", { name: row.button, exact: true }).focus();
        await page.keyboard.press("Enter");
      } else {
        await control.focus();
        await page.keyboard.press("Enter");
      }
      await summaryLink(page, row.field);
      if (row.field === "dlg-request-text") {
        expect(await control.getAttribute("aria-describedby")).toContain("dlg-request-note");
        expect(await control.getAttribute("aria-describedby")).toContain("dlg-request-text-format-error");
      }
      await page.keyboard.type("1");
      expect(await control.inputValue()).toBe("1");
      expect(await control.getAttribute("aria-invalid")).toBe("false");
      expect(await control.evaluate((el) => el === document.activeElement)).toBe(true);
      await suite.pass(page, `forms.${row.field}`);
      await page.close();
    });
  }

  it("real browser deferred stub request: invalid input sends zero, explicit valid submit sends once, pending duplicate sends nothing", async () => {
    const page = await suite.newPage();
    await page.addInitScript(() => { window.__kixFormDeferred = { attempts: 0 }; });
    await page.goto(suite.faultOrigin + "/booking/evt_lanterns");
    const input = page.locator("#booking-quantity");
    await input.waitFor();
    if (process.env.KIX_FORM_SCREENSHOTS) {
      await page.locator("#booking-form").evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.screenshot({ path: `${process.env.KIX_FORM_SCREENSHOTS}/normal.png` });
    }
    await input.fill("0");
    await page.keyboard.press("Enter");
    await summaryLink(page, "booking-quantity");
    expect(await page.evaluate(() => window.__kixFormDeferred?.attempts)).toBe(0);
    if (process.env.KIX_FORM_SCREENSHOTS) await page.screenshot({ path: `${process.env.KIX_FORM_SCREENSHOTS}/invalid.png` });
    await page.keyboard.press("Control+A");
    await page.keyboard.type("1");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__kixFormDeferred?.attempts === 1);
    expect(await page.locator("#booking-place").isDisabled()).toBe(true);
    expect(await page.locator("form[aria-busy=true]").count()).toBe(1);
    if (process.env.KIX_FORM_SCREENSHOTS) await page.screenshot({ path: `${process.env.KIX_FORM_SCREENSHOTS}/pending.png` });
    await page.locator("form").evaluate((el) => (el as HTMLFormElement).requestSubmit());
    expect(await page.evaluate(() => window.__kixFormDeferred?.attempts)).toBe(1);
    await page.evaluate(() => window.__kixFormDeferred?.release?.());
    await page.locator("#booking-confirm").waitFor();
    expect(await page.evaluate(() => window.__kixFormDeferred?.attempts)).toBe(1);
    await suite.pass(page, "forms.deferred-one-attempt");
    await page.close();
  });

  it("existing source filter diagnostics use the shared summary without making a new local judgment", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/discovery?from=2026-12-01&to=2026-01-01");
    await page.locator("#discovery-conflict").waitFor();
    await page.locator("#discovery-filters").evaluate((el) => (el as HTMLFormElement).requestSubmit());
    await summaryLink(page, "discovery-from");
    await suite.quiet(page, "discovery source conflict");
    await openScreen(page, suite.origin, "/handoff");
    await page.locator("#handoff-code").fill("UNRECOGNIZED_CODE");
    await page.locator("#handoff-error").waitFor();
    await page.getByRole("button", { name: "Apply filter", exact: true }).focus();
    await page.keyboard.press("Enter");
    await summaryLink(page, "handoff-code");
    await suite.pass(page, "forms.source-diagnostics");
    await page.close();
  });

  it("gift numeric errors stay editable, preserve caller values and allow an explicit corrected offer only once", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/gift");
    for (const [id, value] of [["gift-id", "gift-form-fix"], ["gift-ticket-id", "tkt_1"], ["gift-expected-version", "1.5"], ["gift-expires-at", "01"]]) {
      await page.locator(`#${id}`).fill(value);
    }
    await page.getByRole("button", { name: "Send offer_gift", exact: true }).focus();
    await page.keyboard.press("Enter");
    await summaryLink(page, "gift-expected-version");
    expect(await page.locator("#gift-expires-at").getAttribute("aria-invalid")).toBe("true");
    expect(await page.locator("#gift-ticket-id").inputValue()).toBe("tkt_1");
    expect(await page.locator("#gift-ticket-id").getAttribute("readonly")).toBeNull();
    expect(await page.locator("aside.gift-panel li[data-status='not-sent']").count()).toBe(0);
    await page.keyboard.press("Control+A");
    await page.keyboard.type("1");
    await page.locator("#gift-expires-at").focus();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("4102444800");
    await page.getByRole("button", { name: "Send offer_gift", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.locator("aside.gift-panel li[data-status='confirmed']").waitFor();
    expect(await page.locator("aside.gift-panel li[data-status='confirmed']").count()).toBe(1);
    expect(await page.getByRole("button", { name: "Send offer_gift", exact: true }).isDisabled()).toBe(true);
    await suite.pass(page, "forms.gift-corrected-once");
    await page.close();
  });

  it("optional discovery/handoff filters and both-false consent flags remain valid", async () => {
    const page = await suite.newPage();
    for (const path of ["/discovery", "/handoff", "/marketing/m05"]) {
      await openScreen(page, suite.origin, path);
      if (path === "/marketing/m05") {
        expect(await page.locator("#performance-notes").isChecked()).toBe(false);
        expect(await page.locator("#membership-notes").isChecked()).toBe(false);
        await page.getByRole("button", { name: "Save consent flags" }).focus();
        await page.keyboard.press("Enter");
      } else {
        const form = page.locator("form").first();
        await form.evaluate((el) => (el as HTMLFormElement).requestSubmit());
      }
      expect(await page.locator(".error-summary").count()).toBe(0);
      expect(await page.locator("[aria-invalid=true]").count()).toBe(0);
      await suite.quiet(page, path);
    }
    await page.close();
  });

  it("repeated invalid submission, live ko/en messages, preserved hints, no focus theft, 320px and keyboard resubmission", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/booking/evt_lanterns?lang=ko", "narrow");
    const input = page.locator("#booking-quantity");
    expect(await tabTo(page, "#booking-quantity")).toBe(true);
    await page.keyboard.press("Control+A");
    await page.keyboard.type("1.5");
    await page.keyboard.press("Tab"); // first blur
    expect(await input.getAttribute("aria-invalid")).toBe("true");
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.locator("#booking-place").focus();
      await page.keyboard.press("Enter");
      await summaryLink(page, "booking-quantity");
    }
    expect(await page.locator(".error-summary").innerText()).toContain("다음 입력 항목을 확인하세요");
    await page.locator('.locale-switch button[data-locale="en"]').focus();
    await page.keyboard.press("Enter");
    expect(await page.locator(".error-summary").innerText()).toContain("Check the following fields");
    expect(await input.inputValue()).toBe("1.5");
    await page.setViewportSize({ width: 320, height: 568 });
    expect(await overflowProblems(page, "form-overflow")).toEqual([]);
    await input.focus();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("2");
    expect(await input.evaluate((el) => el === document.activeElement)).toBe(true);
    expect(await page.locator(".error-summary").count()).toBe(0);
    await page.keyboard.press("Enter");
    await page.locator("#booking-confirm").waitFor();
    expect(await page.getByText(/Hold hold_/).count()).toBe(1);
    await suite.pass(page, "forms.keyboard-resubmit");
    await page.close();
  });
});
