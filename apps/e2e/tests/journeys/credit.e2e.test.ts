import { describe, expect, it } from "vitest";
import { alertTexts, commitSettlement, expectFact, expectNoButton, expectText, fact, newDeskPage, nav, panel, press } from "../../src/desk";
import { useBrowser } from "../../src/suite";

describe("credit journey (stub, headless Chrome)", () => {
  const suite = useBrowser();

  async function openCredit(page: Awaited<ReturnType<typeof newDeskPage>>, eventId: string) {
    await nav(page, "Credit");
    await page.getByLabel("Mock case event").selectOption(eventId);
    return panel(page, "Mock credit case");
  }

  it("SUCCESS: offer, approve, bind, draw, then note a repayment", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await commitSettlement(page, "orchestra");
    const credit = await openCredit(page, "evt_paper_orchestra");
    const steps: [string, string][] = [
      ["Offer mock phase", "OFFERED"],
      ["Approve mock phase", "APPROVED"],
      ["Bind mock settlement", "APPROVED"],
      ["Draw mock exposure", "DRAWN"],
      ["Note mock repayment", "DRAWN"],
    ];
    for (const [button, phase] of steps) {
      await press(credit, button);
      if (button !== "Bind mock settlement") {
        await expectFact(credit, "Mock phase", phase);
      }
    }
    await expectFact(credit, "Repaid exposure", "30000 mock units");
    await expectFact(credit, "Funds executed", "false");
    await expectFact(credit, "Bank debit observed", "false");
    expect(await alertTexts(page)).toEqual([]);
    await suite.pass(page, "credit.SUCCESS");
    await page.close();
  });

  it("REJECT: closing a case that still has outstanding exposure is refused and the phase stays DRAWN", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await commitSettlement(page, "orchestra");
    const credit = await openCredit(page, "evt_paper_orchestra");
    for (const button of ["Offer mock phase", "Approve mock phase", "Bind mock settlement", "Draw mock exposure"]) {
      await press(credit, button);
    }
    await expectFact(credit, "Mock phase", "DRAWN");
    await press(credit, "Close mock case");
    await expectFact(credit, "Last error", "OUTSTANDING_REMAINS");
    expect(await alertTexts(page)).toEqual([expect.stringContaining("OUTSTANDING_REMAINS: mock credit command rejected.")]);
    expect(await fact(credit, "Mock phase")).toBe("DRAWN");
    await suite.pass(page, "credit.REJECT");
    await page.close();
  });

  it("NOT_BOUND: external credit stays unsupported; no disburse, capture or bank control exists", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    const credit = await openCredit(page, "evt_lanterns");
    await expectFact(credit, "External credit", "UNSUPPORTED");
    await expectFact(credit, "Funds executed", "false");
    await expectFact(credit, "KYC executed", "false");
    await expectFact(credit, "Underwriting executed", "false");
    await expectText(page, "It does not disburse to a bank");
    await press(credit, "Reject real-funds label");
    await page.getByRole("alert").first().waitFor();
    await expectFact(credit, "External credit", "UNSUPPORTED");
    await expectNoButton(page, /disburse|payout|bank|capture|settle_capture/i);
    await suite.pass(page, "credit.NOT_BOUND");
    await page.close();
  });
});
