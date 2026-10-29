import { describe, expect, it } from "vitest";
import { RULING, expectText, newDeskPage, nav, poll, press } from "../../src/desk";
import { useBrowser } from "../../src/suite";

describe("receipts journey (stub, headless Chrome)", () => {
  const suite = useBrowser();

  async function openReceipts(page: Awaited<ReturnType<typeof newDeskPage>>) {
    await nav(page, "Receipts");
    await page.getByRole("heading", { name: "Receipt explorer" }).waitFor();
  }

  it("SUCCESS: one entry per operation id after a booking send, and a support export that holds ids only", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await page.getByRole("link", { name: "Book" }).first().click();
    await press(page, "Send create_event");
    await expectText(page, "jrn:evt_lanterns:1:create_event");
    await openReceipts(page);
    const entries = page.locator("#receipt-timeline button[data-entry-id]");
    await poll(() => entries.count(), (count) => count === 1, "one receipt entry");
    expect(await entries.first().innerText()).toContain("jrn:evt_lanterns:1:create_event");
    await expectText(page, "Source stub-shape");
    const exported = await page.locator("#receipt-diagnostic").inputValue();
    await page.getByLabel("Filter status", { exact: true }).selectOption("unknown");
    expect(await entries.count()).toBe(0);
    expect(await page.locator("#receipt-timeline-status").innerText()).toContain("0–0 of 0 matching; 1 total");
    await page.getByRole("button", { name: "Last", exact: true }).press("Enter");
    expect(await page.locator("#receipt-diagnostic").inputValue()).toBe(exported);
    await press(page, "Clear filters");
    expect(await entries.count()).toBe(1);
    const parsed = JSON.parse(exported) as Record<string, unknown>;
    expect(parsed.mode).toBe("stub");
    expect(parsed.productionReadiness).toBe(false);
    expect(parsed.productionConformance).toBe(false);
    expect(parsed.protocolTruth).toBe(false);
    expect(parsed.publicDeploy).toBe(false);
    expect(parsed.retry).toBe(false);
    expect(parsed.fallbackToStub).toBe(false);
    expect(parsed.readConfirmsUnknown).toBe(false);
    await suite.pass(page, "receipts.SUCCESS");
    await page.close();
  });

  it("REJECT: with nothing sent the page says so, keeps nothing aside, and shows no entry", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await openReceipts(page);
    expect(await page.locator("#receipt-timeline p.empty").innerText()).toBe("No receipt on this page load.");
    expect(await page.locator("#receipt-detail").getAttribute("data-state")).toBe("empty");
    expect(await page.locator("#receipt-quarantine").getAttribute("data-state")).toBe("empty");
    await expectText(page, "Nothing was kept off this screen.");
    expect(await page.locator("#receipt-timeline button[data-entry-id]").count()).toBe(0);
    await suite.pass(page, "receipts.REJECT");
    await page.close();
  });

  it("UNKNOWN (reference): the read note says a read never turns an unknown outcome into a confirmed receipt", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await openReceipts(page);
    await expectText(page, "does not turn an unknown outcome into a confirmed receipt");
    await expectText(page, "Stub-shape receipts are not from the gate.");
    await suite.pass(page, "receipts.UNKNOWN.read-note");
    await page.close();
  });

  it("NOT_BOUND: placeHold is recorded and not sent, with the same reserve_listing reason and the not-composed list", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await openReceipts(page);
    await expectText(page, "placeHold stays not-bound. consideredAction reserve_listing. mappedOntoPrepareTrade false.");
    await expectText(page, RULING);
    const recorded = page.locator("li[data-state='not-bound']");
    const texts = await recorded.allTextContents();
    for (const action of ["capture", "settle_capture", "commit_trade", "open_admission", "admit"]) {
      expect(texts.some((text) => text.includes(action)), `recorded and not sent: ${action}`).toBe(true);
    }
    expect(await recorded.evaluateAll((els) => els.every((el) => el.getAttribute("data-source") === "none"))).toBe(true);
    await suite.pass(page, "receipts.NOT_BOUND");
    await page.close();
  });
});
