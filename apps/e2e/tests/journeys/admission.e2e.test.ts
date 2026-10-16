import { describe, expect, it } from "vitest";
import { alertTexts, bookAndIssue, commitSettlement, expectFact, expectNoButton, expectText, fact, newDeskPage, nav, panel, press } from "../../src/desk";
import { useBrowser } from "../../src/suite";

describe("admission journey (stub, headless Chrome)", () => {
  const suite = useBrowser();

  async function openAdmission(eventId: string) {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await nav(page, "Admission");
    await page.getByLabel("Performance id").fill(eventId);
    await press(page, "Load mock case");
    return page;
  }

  it("SUCCESS: an issued mock right is adopted, authorized and consumed once", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await commitSettlement(page, "lanterns");
    await bookAndIssue(page, "lanterns");
    await nav(page, "Admission");
    await page.getByLabel("Performance id").fill("evt_lanterns");
    await press(page, "Load mock case");
    const credential = panel(page, "Admission credential");
    await press(credential, "Adopt issued mock credential");
    await expectFact(credential, "Credential state", "valid");
    await expectFact(credential, "Phase", "ELIGIBLE");
    await press(credential, "Authorize mock credential");
    await expectFact(credential, "Phase", "AUTHORIZED");
    await press(credential, "Consume mock credential once");
    await expectFact(credential, "Phase", "CONSUMED");
    // After the one consume the credential can no longer be presented. That is the adapter's label, not venue entry.
    await expectFact(credential, "Credential state", "already-consumed");
    await expectFact(credential, "Decision", "ALREADY_CONSUMED");
    expect(await alertTexts(page)).toEqual([]);
    expect(await fact(credential, "Mode")).toBe("mock");
    await suite.pass(page, "admission.SUCCESS");
    await page.close();
  });

  it("REJECT: adopting a right that was never issued is refused and nothing becomes valid", async () => {
    const page = await openAdmission("evt_last_ferry");
    const credential = panel(page, "Admission credential");
    await press(credential, "Adopt issued mock credential");
    await page.getByRole("alert").first().waitFor();
    const alerts = await alertTexts(page);
    expect(alerts.join(" ")).toMatch(/[A-Z_]{6,}/);
    expect(await fact(credential, "Credential state")).not.toBe("valid");
    await expectNoButton(credential, /^Send /);
    await suite.pass(page, "admission.REJECT");
    await page.close();
  });

  it("NOT_BOUND: external and offline admission stay unsupported and no admit control exists", async () => {
    const page = await openAdmission("evt_lanterns");
    const credential = panel(page, "Admission credential");
    await expectFact(credential, "External admission", "UNSUPPORTED");
    await expectFact(credential, "Production admission routing", "false");
    await expectFact(credential, "Offline admission", "false");
    await expectText(page, "This form does not admit.");
    await expectText(page, "Not live admission.");
    await expectNoButton(page, /^(admit|Send admit|Send open_admission)$/i);
    await expectNoButton(page, /capture/i);
    await suite.pass(page, "admission.NOT_BOUND");
    await page.close();
  });
});
