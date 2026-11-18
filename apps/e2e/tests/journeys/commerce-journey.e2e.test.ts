import { describe, expect, it } from "vitest";
import type { Locator } from "playwright-core";
import { useBrowser } from "../../src/suite";

const step = (panel: Locator, id: string) => panel.locator(`[data-commerce-step=${id}]`).click();
const fact = (panel: Locator, name: string, state: string) =>
  expect.poll(() => panel.locator(`[data-commerce-fact=${name}] dd`).textContent()).toBe(state);

describe("pinned commerce fixture in the stub browser", () => {
  const suite = useBrowser();
  it("shows a refusal, separate evidence and NOT_BOUND with no application network calls", async () => {
    const page = await suite.newPage();
    await page.goto(suite.origin + "/booking/evt_lanterns?lang=en");
    const panel = page.getByRole("region", { name: "Protocol commerce journey" });
    await page.getByRole("button", { name: "Advance mock clock", exact: true }).click();
    await panel.locator("[data-commerce-branch=admission]").click();
    for (const id of ["reservation-clock", "register-show", "reserve-B", "order-B", "payment-B"]) await step(panel, id);
    await fact(panel, "paymentObservation", "OBSERVED");
    await fact(panel, "ticketIssuance", "NO_EVIDENCE");
    await fact(panel, "admission", "NO_EVIDENCE");
    await step(panel, "cancel-after-payment");
    await panel.getByText("COMPENSATION_UNDEFINED", { exact: true }).waitFor();
    await step(panel, "issue-B");
    await fact(panel, "ticketIssuance", "ISSUED");
    await fact(panel, "admission", "NO_EVIDENCE");
    for (const id of ["admission-clock", "adopt-B", "authorize-B"]) await step(panel, id);
    await fact(panel, "admission", "AUTHORIZED");
    await step(panel, "consume-B");
    await fact(panel, "admission", "CONSUMED_ONCE");
    await step(panel, "double-consume");
    await panel.getByText("ALREADY_CONSUMED", { exact: true }).waitFor();
    await panel.getByRole("button", { name: "Read current booking" }).click();
    await panel.getByText("NOT_BOUND", { exact: true }).waitFor();
    expect(await panel.getByText("The pinned gate has no booking read endpoint.", { exact: false }).isVisible()).toBe(true);
    await suite.pass(page, "booking.pinned-commerce-journey");
    await page.close();
  });

  it("keeps cancellation, mock refund binding and mock acceptance separate", async () => {
    const page = await suite.newPage();
    await page.goto(suite.origin + "/booking/evt_lanterns?lang=en");
    const panel = page.getByRole("region", { name: "Protocol commerce journey" });
    await panel.locator("[data-commerce-branch=refund]").click();
    const steps = ["reservation-clock", "register-show", "reserve-C", "order-C", "cancel-C"];
    for (const id of steps) await step(panel, id);
    await fact(panel, "reservationCancellation", "CANCELLED");
    await fact(panel, "refundBinding", "NO_EVIDENCE");
    for (const id of ["settle-cancel-initiate", "settle-cancel", "settle-fail-initiate", "settle-fail",
      "settle-refund-initiate", "settle-refund-authorize", "settle-refund-capture", "bind-refund"]) await step(panel, id);
    await fact(panel, "refundBinding", "BOUND");
    await fact(panel, "refundAcceptance", "NO_EVIDENCE");
    await step(panel, "observe-mock-acceptance");
    await fact(panel, "refundBinding", "BOUND");
    await fact(panel, "refundAcceptance", "MOCK_ACCEPTANCE_OBSERVED");
    await fact(panel, "paymentObservation", "NO_EVIDENCE");
    await suite.pass(page, "booking.pinned-commerce-journey.refund");
    await page.close();
  });
});
