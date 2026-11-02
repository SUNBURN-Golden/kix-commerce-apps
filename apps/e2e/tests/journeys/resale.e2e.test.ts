import { describe, expect, it } from "vitest";
import { alertTexts, bookAndIssue, commitSettlement, expectFact, expectNoButton, expectText, fact, newDeskPage, nav, panel, press } from "../../src/desk";
import { useBrowser } from "../../src/suite";

describe("resale journey (stub, headless Chrome)", () => {
  const suite = useBrowser();

  it("SUCCESS: adopt, list, hold a buyer, note payment, bind, then accept the transfer", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await commitSettlement(page, "orchestra");
    await bookAndIssue(page, "orchestra");
    await nav(page, "Resale");
    await page.getByLabel("Mock case event").selectOption("evt_paper_orchestra");
    const resale = panel(page, "Mock resale case");
    const steps: [string, string][] = [
      ["Adopt mock right", "ELIGIBLE"],
      ["List mock phase", "LISTED"],
      ["Hold mock buyer", "BUY_HELD"],
      ["Note simulated payment", "PAYMENT_NOTED"],
      ["Bind mock settlement", "PAYMENT_NOTED"],
      ["Accept mock transfer", "TRANSFERRED"],
    ];
    for (const [button, phase] of steps) {
      await press(resale, button);
      if (button !== "Bind mock settlement") {
        await expectFact(resale, "Mock phase", phase);
      }
    }
    await expectFact(resale, "Mock phase", "TRANSFERRED");
    expect(await alertTexts(page)).toEqual([]);
    expect(await fact(resale, "Mode")).toBe("mock");
    await suite.pass(page, "resale.SUCCESS");
    await page.close();
  });

  it("REJECT: a listing for an unknown booking is refused, and the list stays empty", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await nav(page, "Resale");
    await expectText(page, "No listings yet.");
    await page.getByLabel("Booking id").fill("bkg_nope");
    await press(page, "Open listing");
    await page.getByRole("alert").filter({ hasText: "Only a confirmed booking can be listed." }).waitFor();
    await expectText(page, "No listings yet.");
    expect(await page.getByRole("button", { name: "Transfer (simulated)" }).count()).toBe(0);
    await suite.pass(page, "resale.REJECT");
    await page.close();
  });

  it("NOT_BOUND: an external marketplace is refused, stays unsupported and nothing becomes bound", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await nav(page, "Resale");
    const resale = panel(page, "Mock resale case");
    await expectFact(resale, "External marketplace", "UNSUPPORTED");
    await expectFact(resale, "Venue credential reissued", "false");
    await press(resale, "Reject external marketplace");
    await page.getByRole("alert").first().waitFor();
    expect((await alertTexts(page)).join(" ")).toMatch(/[A-Z_]{6,}/);
    await expectFact(resale, "External marketplace", "UNSUPPORTED");
    await expectText(page, "Not live marketplace.");
    await expectNoButton(page, /capture|settle_capture|commit_trade/i);
    await expectNoButton(page, /^Send /);
    await suite.pass(page, "resale.NOT_BOUND");
    await page.close();
  });

  it("RECOVERY: release a buyer hold, cancel, then refuse a terminal mutation without transferring ownership", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await commitSettlement(page, "orchestra");
    await bookAndIssue(page, "orchestra");
    await nav(page, "Resale");
    await page.getByLabel("Mock case event").selectOption("evt_paper_orchestra");
    const resale = panel(page, "Mock resale case");
    for (const label of ["Adopt mock right", "List mock phase", "Hold mock buyer", "Release mock hold"]) await press(resale, label);
    await expectFact(resale, "Mock phase", "LISTED");
    await press(resale, "Cancel mock listing");
    await expectFact(resale, "Mock phase", "CANCELLED");
    await press(resale, "Note simulated payment");
    await expectFact(resale, "Last error", "TERMINAL_IMMUTABLE");
    await expectFact(resale, "Mock phase", "CANCELLED");
    await expectFact(resale, "Ownership transferred", "No");
    await expectFact(resale, "Holder and version", /desk-buyer/);
    await suite.quiet(page, "resale before reload");
    await page.reload();
    await expectFact(resale, "Mock phase", "Not opened");
    await suite.pass(page, "resale.EDGE_RECOVERY");
    await page.close();
  });
});
