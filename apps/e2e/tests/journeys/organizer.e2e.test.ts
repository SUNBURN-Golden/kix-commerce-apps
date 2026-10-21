import { describe, expect, it } from "vitest";
import { expectNoButton, expectStepStatus, expectText, newDeskPage, nav, poll, press, stepRow } from "../../src/desk";
import { useBrowser } from "../../src/suite";

const STEPS = ["create_event", "close_sales", "open_admission", "complete_event", "cancel_event", "issue_invitation"];

describe("organizer journey (stub, headless Chrome)", () => {
  const suite = useBrowser();

  async function openOrganizer() {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await nav(page, "Organizer");
    await page.getByRole("heading", { name: "Organizer console" }).first().waitFor();
    return page;
  }

  it("SUCCESS: create_event with the caller's seats, then the lifecycle commands one at a time", async () => {
    const page = await openOrganizer();
    await page.getByLabel("Event id", { exact: true }).fill("evt_org_1");
    await page.getByLabel("Seats").fill("A1,A2");
    const panel = page.locator("aside.organizer-panel");
    await press(stepRow(panel, "create_event"), "Send create_event");
    await expectStepStatus(stepRow(panel, "create_event"), "confirmed");
    await expectText(page, "org:evt_org_1:1:create_event");
    for (const step of ["close_sales", "open_admission"]) {
      await press(stepRow(panel, step), `Send ${step}`);
      await expectStepStatus(stepRow(panel, step), "confirmed");
      await expectText(page, `org:evt_org_1:1:${step}`);
    }
    await expectText(page, "Confirmed stub-shape receipt. Not from the gate.");
    expect(await page.getByText("org:evt_org_1:1:create_event", { exact: true }).count()).toBe(1);
    await suite.pass(page, "organizer.SUCCESS");
    await page.close();
  });

  it("REJECT (not sent): blank seats are refused before sending and nothing is confirmed", async () => {
    const page = await openOrganizer();
    await page.getByLabel("Event id", { exact: true }).fill("evt_org_2");
    const panel = page.locator("aside.organizer-panel");
    await press(stepRow(panel, "create_event"), "Send create_event");
    await page.locator("#organizer-seats-format-error").waitFor();
    expect(await page.locator(".error-summary").evaluate((el) => el === document.activeElement)).toBe(true);
    expect(await panel.locator("li[data-status='not-sent']").count()).toBe(0);
    await poll(() => panel.locator("li.journey-step[data-status='confirmed']").count(), (count) => count === 0, "no confirmed step");
    await suite.pass(page, "organizer.REJECT");
    await page.close();
  });

  it("NOT_BOUND: the console has exactly the six published sends and no capture or settle control", async () => {
    const page = await openOrganizer();
    const panel = page.locator("aside.organizer-panel");
    const sends = await panel.getByRole("button", { name: /^Send / }).allInnerTexts();
    expect(sends).toEqual(STEPS.map((step) => `Send ${step}`));
    await expectNoButton(page, /capture|settle_capture|commit_trade|^Send admit$/i);
    await expectText(page, "Not composed");
    await expectText(page, "Operator is a local-call actor string, not an authentication result.");
    await suite.pass(page, "organizer.NOT_BOUND");
    await page.close();
  });
});
