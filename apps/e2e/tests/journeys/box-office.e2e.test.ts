import { describe, expect, it } from "vitest";
import { EVENTS, RULING, alertTexts, commitSettlement, expectFact, expectNoButton, expectText, fact, newDeskPage, nav, press } from "../../src/desk";
import { useBrowser } from "../../src/suite";

describe("box office journey (stub, headless Chrome)", () => {
  const suite = useBrowser();

  it("SUCCESS: a mock settlement case goes Initiate, Authorize, CAPTURED, COMMITTED, then Reconcile", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await expectText(page, EVENTS.lanterns.title);
    await commitSettlement(page, "lanterns");
    const settlement = page.locator("aside", { hasText: "Mock settlement case" });
    await press(settlement, "Reconcile process-local");
    await expectFact(settlement, "Reconcile matched", /Matched/);
    expect(await fact(settlement, "Provenance")).toBe("MOCK_SETTLEMENT_ONLY");
    expect(await fact(settlement, "Mode")).toBe("mock");
    expect(await alertTexts(page)).toEqual([]);
    await suite.pass(page, "box-office.SUCCESS");
    await page.close();
  });

  it("REJECT: COMMITTED straight after Initiate is refused and the phase does not move", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await page.getByRole("button", { name: "Mock settlement" }).first().click();
    const settlement = page.locator("aside", { hasText: "Mock settlement case" });
    await press(settlement, "Initiate mock case");
    await expectFact(settlement, "Mock phase", "INITIATED");
    await press(settlement, "Simulate COMMITTED phase");
    await expectFact(settlement, "Last error", "ILLEGAL_TRANSITION");
    expect(await alertTexts(page)).toEqual(["ILLEGAL_TRANSITION: mock settlement command rejected."]);
    expect(await fact(settlement, "Mock phase")).toBe("INITIATED");
    await suite.pass(page, "box-office.REJECT");
    await page.close();
  });

  it("NOT_BOUND: the box office writes nothing, and placeHold, confirmBooking and settlementPreview are recorded as not bound", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    const journey = page.getByRole("complementary", { name: "Catalogue journey" });
    await journey.waitFor();
    await expectText(page, "Writes happen on the booking screen.");
    await expectText(page, "placeHold stays not-bound (reserve_listing).");
    await expectText(page, RULING);
    await expectText(page, "confirmBooking(holdId) does not match capture");
    expect(await journey.getAttribute("data-journey-path")).toBe("available-stub-shape");
    await expectNoButton(page, /^Send /);
    await expectNoButton(page, /capture|settle_capture/i);
    await nav(page, "Box office");
    await suite.pass(page, "box-office.NOT_BOUND");
    await page.close();
  });
});
