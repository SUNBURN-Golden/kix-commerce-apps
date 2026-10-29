import { describe, expect, it } from "vitest";
import { RULING, expectText, newDeskPage, nav, poll, press } from "../../src/desk";
import { useBrowser } from "../../src/suite";

describe("receipts journey (stub, headless Chrome)", () => {
  const suite = useBrowser();

  async function openReceipts(page: Awaited<ReturnType<typeof newDeskPage>>) {
    await nav(page, "Receipts");
    await page.getByRole("heading", { name: "Receipt explorer" }).waitFor();
  }

  it("retains repeated consent and invitation receipts through navigation and keyboard selection", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await nav(page, "Marketing");
    await page.locator('a.hub-card[href="/marketing/m05"]').click();
    for (const [id, value] of [["event", "evt_repeat_consent"], ["subject", "subject-fixture"],
      ["business", "business-fixture"], ["channel", "fixture-channel"], ["purpose", "fixture-purpose"], ["version", "0"]]) {
      await page.locator("#consent-" + id).fill(value);
    }
    await page.locator("#consent-allowed").selectOption("true");
    await press(page, "Send set_consent");
    await press(page, "Send authorize_marketing");
    await page.locator("#consent-version").fill("1");
    await page.locator("#consent-allowed").selectOption("true");
    await press(page, "Send set_consent");
    await press(page, "Send authorize_marketing");
    // A validation refusal must preserve the four completed operations too.
    await page.locator("#consent-business").fill("");
    await press(page, "Send set_consent");
    await page.locator(".error-summary").waitFor();
    await nav(page, "Organizer");
    await page.locator("#organizer-event").fill("evt_repeat_org");
    await page.locator("#organizer-version").fill("0");
    await page.locator("#organizer-recipient").fill("guest-fixture");
    for (const inventory of ["inv-first", "inv-second"]) {
      await page.locator("#organizer-inventory").fill(inventory);
      await press(page, "Send issue_invitation");
    }
    await openReceipts(page);
    await page.getByRole("tab", { name: "Operator", exact: true }).click();
    const entries = page.locator("#receipt-timeline button[data-entry-id]");
    await poll(() => entries.count(), (count) => count === 6, "all repeated operations");
    const exported = JSON.parse(await page.locator("#receipt-diagnostic").inputValue()) as {
      entries: { operationId: string; fields: { key: string; value: string }[] }[];
    };
    expect(new Set(exported.entries.map((entry) => entry.operationId)).size).toBe(6);
    expect(exported.entries[0]?.fields).toContainEqual({ key: "allowed", value: "true" });
    expect(exported.entries[1]?.fields).toContainEqual({ key: "consentVersion", value: "0" });
    expect(exported.entries[3]?.fields).toContainEqual({ key: "consentVersion", value: "1" });
    await entries.first().focus();
    await entries.first().press("ArrowDown");
    expect(await entries.nth(1).evaluate((el) => el === document.activeElement)).toBe(true);
    expect(await page.locator("#receipt-detail").innerText()).toContain("cns:evt_repeat_consent:1:authorize_marketing");
    await entries.nth(4).click();
    expect(await page.locator("#receipt-detail").innerText()).toContain("org:evt_repeat_org:1:issue_invitation:inv-first");
    await entries.nth(5).click();
    expect(await page.locator("#receipt-detail").innerText()).toContain("org:evt_repeat_org:1:issue_invitation:inv-second");
    await suite.pass(page, "receipts.repeat-history");
    await page.close();
  });

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
