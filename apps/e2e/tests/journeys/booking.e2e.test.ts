import { describe, expect, it } from "vitest";
import { BANNED_SEND, EVENTS, RULING, alertTexts, expectNoButton, expectText, newDeskPage, nav, panel, poll, press } from "../../src/desk";
import { useBrowser } from "../../src/suite";

const CREATE = "jrn:evt_lanterns:1:create_event";

describe("booking journey (stub, headless Chrome)", () => {
  const suite = useBrowser();

  async function openBooking(row: number = EVENTS.lanterns.row) {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await page.getByRole("link", { name: "Book" }).nth(row).click();
    await page.getByRole("heading", { name: EVENTS.lanterns.title }).waitFor();
    return page;
  }

  it("SUCCESS: place hold, confirm with no funds, then create_event, prepare_trade and accept_trade", async () => {
    const page = await openBooking();
    await press(page, "Place hold");
    await expectText(page, "Hold hold_");
    await press(page, "Confirm booking");
    await expectText(page, "Confirmed in the adapter");
    await expectText(page, "Simulated — no funds");
    const journey = panel(page, "Catalogue journey");
    for (const step of ["create_event", "prepare_trade", "accept_trade"]) {
      const row = journey.locator("li.journey-step").filter({ has: page.locator("p", { hasText: new RegExp(`^${step}$`) }) });
      await press(row, `Send ${step}`);
      await poll(() => row.getAttribute("data-status"), (status) => status === "confirmed", `${step} confirmed`);
      await expectText(page, `jrn:evt_lanterns:1:${step}`);
    }
    await expectText(page, "Confirmed stub-shape receipt. Not from the gate.");
    expect(await journey.locator("li.journey-step[data-status='confirmed']").count()).toBe(3);
    expect(await alertTexts(page)).toEqual([]);
    await suite.pass(page, "booking.SUCCESS");
    await page.close();
  });

  it("REJECT: quantity 7 keeps the typed value and returns focus; an unknown performance shows an alert", async () => {
    const page = await openBooking();
    const quantity = page.getByLabel("Quantity");
    await quantity.fill("7");
    await press(page, "Place hold");
    await expectText(page, "Quantity must be a whole number from 1 to 6. The typed value was kept.");
    expect(await quantity.inputValue()).toBe("7");
    await poll(() => page.evaluate(() => document.activeElement?.id ?? ""), (id) => id === "booking-quantity", "focus on booking-quantity");
    expect(await quantity.getAttribute("aria-invalid")).toBe("true");
    expect(await page.getByRole("button", { name: "Confirm booking" }).count()).toBe(0);
    await suite.quiet(page, "booking quantity reject");

    await page.goto(`${suite.origin}/booking/evt_missing`);
    await page.getByRole("alert").filter({ hasText: "That performance is not on this adapter." }).waitFor();
    await expectText(page, "Back to the window");
    await suite.pass(page, "booking.REJECT");
    await page.close();
  });

  it("NOT_BOUND: placeHold stays reserve_listing and not bound; no capture, settle_capture, commit_trade, open_admission or admit control", async () => {
    const page = await openBooking();
    await expectText(page, "placeHold stays not-bound (reserve_listing).");
    await expectText(page, RULING);
    const journey = panel(page, "Catalogue journey");
    const notBound = journey.locator("dl.facts").last();
    await poll(() => notBound.innerText(), (text) => /reserve_listing · not-bound/.test(text), "placeHold not-bound row");
    await expectText(page, "Not composed");
    for (const action of ["CAPTURE", "SETTLE_CAPTURE", "COMMIT_TRADE", "OPEN_ADMISSION", "ADMIT"]) {
      await poll(() => journey.locator("dt").allInnerTexts(), (terms) => terms.includes(action), `Not composed row ${action}`);
    }
    await expectNoButton(page, BANNED_SEND);
    await expectNoButton(page, /capture/i);
    // Only the three published steps have a send control.
    const sends = await journey.getByRole("button", { name: /^Send / }).allInnerTexts();
    expect(sends).toEqual(["Send create_event", "Send prepare_trade", "Send accept_trade"]);
    await suite.pass(page, "booking.NOT_BOUND");
    await page.close();
  });

  it("one attempt: a double click on Send create_event leaves one operation and one receipt", async () => {
    const page = await openBooking();
    const send = page.getByRole("button", { name: "Send create_event", exact: true });
    await send.dblclick();
    await expectText(page, CREATE);
    expect(await page.getByText(CREATE, { exact: true }).count()).toBe(1);
    expect(await send.isDisabled()).toBe(true);
    await nav(page, "Receipts");
    await page.getByRole("heading", { name: "Receipt explorer" }).waitFor();
    const entries = page.locator("#receipt-timeline button[data-entry-id]");
    await poll(() => entries.count(), (count) => count >= 1, "a receipt entry");
    const names = await entries.allInnerTexts();
    expect(names.filter((name) => name.includes(CREATE))).toHaveLength(1);
    await suite.pass(page, "one-attempt.double-click");
    await page.close();
  });

  it("one attempt: a keyboard-only send (Enter, then Space) sends once and the control then locks", async () => {
    const page = await openBooking();
    const create = page.getByRole("button", { name: "Send create_event", exact: true });
    await create.focus();
    await page.keyboard.press("Enter");
    await expectText(page, CREATE);
    expect(await create.isDisabled()).toBe(true);
    // A second Enter on the locked control does nothing.
    await page.keyboard.press("Enter");
    expect(await page.getByText(CREATE, { exact: true }).count()).toBe(1);
    const prepare = page.getByRole("button", { name: "Send prepare_trade", exact: true });
    await poll(() => prepare.isEnabled(), (enabled) => enabled, "prepare_trade ready");
    await prepare.focus();
    await page.keyboard.press("Space");
    await expectText(page, "jrn:evt_lanterns:1:prepare_trade");
    expect(await page.getByText("jrn:evt_lanterns:1:prepare_trade", { exact: true }).count()).toBe(1);
    await suite.pass(page, "one-attempt.keyboard");
    await page.close();
  });

  it("one attempt: a reload clears the journey and the next send is a new attempt id with no old receipt", async () => {
    const page = await openBooking();
    await press(page, "Send create_event");
    await expectText(page, CREATE);
    await suite.quiet(page, "before reload");
    await page.reload();
    await page.getByRole("heading", { name: EVENTS.lanterns.title }).waitFor();
    expect(await page.getByText(CREATE, { exact: true }).count()).toBe(0);
    await press(page, "Send create_event");
    await expectText(page, "jrn:evt_lanterns:");
    const operations = await page.locator("li.journey-step dd").allInnerTexts();
    const next = operations.find((text) => text.startsWith("jrn:evt_lanterns:") && text.endsWith(":create_event"));
    expect(next).toBeDefined();
    expect(next).not.toBe(CREATE);
    await suite.pass(page, "one-attempt.reload");
    await page.close();
  });
});
