import { describe, expect, it } from "vitest";
import type { Locator } from "playwright-core";
import { useBrowser } from "../../src/suite";
import type {} from "../../src/resale-fault-types";

const step = (panel: Locator, id: string) => panel.locator(`[data-commerce-step=${id}]`).click();
const fact = (panel: Locator, name: string, state: string) =>
  expect.poll(() => panel.locator(`[data-commerce-fact=${name}] dd`).textContent()).toBe(state);

describe("pinned commerce fixture in the stub browser", () => {
  const suite = useBrowser();
  it.each(["en", "ko"] as const)("shows confirmation, refusal and NOT_BOUND in %s", async locale => {
    const page = await suite.newPage();
    await page.goto(suite.origin + `/booking/evt_lanterns?lang=${locale}`);
    const panel = page.getByRole("region", { name: locale === "en" ? "Protocol commerce journey" : "프로토콜 거래 여정" });
    await page.getByRole("button", { name: locale === "en" ? "Advance mock clock" : "모의 시계 진행", exact: true }).click();
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
    await panel.getByRole("button", { name: locale === "en" ? "Read current booking" : "현재 예매 조회" }).click();
    await panel.getByText("NOT_BOUND", { exact: true }).waitFor();
    expect(await panel.getByText(locale === "en" ? "The pinned gate has no booking read endpoint." :
      "고정 게이트에 예매 조회 엔드포인트가 없습니다.", { exact: false }).isVisible()).toBe(true);
    await suite.pass(page, locale === "en" ? "booking.pinned-commerce-journey" : "booking.pinned-commerce-journey.ko");
    await page.close();
  });

  it.each(["en", "ko"] as const)("explains both fixture transports and their refusal in handoff (%s)", async locale => {
    const page = await suite.newPage();
    try {
      await page.goto(suite.origin + `/handoff?lang=${locale}`);
      const panel = page.locator("[data-handoff=packet]");
      await panel.getByText("CommerceJourney", { exact: true }).waitFor();
      expect(await panel.innerText()).toContain("ResaleJourney");
      expect(await panel.innerText()).toContain("SEMANTIC_CONFORMANCE commerce-fixture-8ba7f6c-1");
      expect(await panel.innerText()).toContain("FIXTURE_ONLY");
      expect(await panel.innerText()).toContain("NOT_BOUND");
      expect(await panel.innerText()).toContain(locale === "en" ? "browser HTTP writes unavailable" : "브라우저 HTTP 쓰기 불가");
      expect(await panel.innerText()).toContain("BOOTSTRAP bootstrap-1");
      expect(await panel.innerText()).toContain("BOOTSTRAP bootstrap-2");
      await suite.pass(page, `handoff.fixture-limits.${locale}`);
    } finally { await page.close(); }
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

  it("restores the Core UNKNOWN with the same operation after a response is lost", async () => {
    const page = await suite.newPage();
    await page.addInitScript(() => { window.__kixBookingJourney = { lose: "prepare_trade", sends: [] }; });
    await page.goto(suite.faultOrigin + "/booking/evt_lanterns?lang=en");
    const panel = page.locator('[data-journey-variant="booking"]');
    const create = panel.getByRole("button", { name: /create_event/ });
    const prepare = panel.getByRole("button", { name: /prepare_trade/ });
    const accept = panel.getByRole("button", { name: /accept_trade/ });
    await create.click();
    await prepare.click();
    await panel.locator('[data-status="unconfirmed"]').waitFor();
    const key = "kix-journey-intent:core:stub:evt_lanterns";
    const pending = await page.evaluate(key => sessionStorage.getItem(key), key);
    expect(pending).not.toBeNull();
    expect(await page.evaluate(() => window.__kixBookingJourney)).toMatchObject({
      applied: "prepare_trade", sends: ["create_event", "prepare_trade"],
    });
    await suite.quiet(page, "Core booking response loss");

    await page.reload();
    await panel.locator('[data-status="unconfirmed"]').waitFor();
    for (const button of [create, prepare, accept]) {
      expect(await button.isDisabled()).toBe(true);
      await button.evaluate((element: HTMLButtonElement) => element.click());
    }
    expect(await panel.textContent()).toContain(JSON.parse(pending!).operationId);
    expect(await panel.textContent()).toContain(JSON.parse(pending!).lastConfirmed.operationId);
    expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(pending);
    expect(await page.evaluate(() => window.__kixBookingJourney!.sends)).toEqual([]);
    await suite.quiet(page, "Core booking reload");
    await page.close();
  });

  it("holds every FSM branch after reload with an applied result still in flight", async () => {
    const page = await suite.newPage();
    await page.addInitScript(() => { window.__kixBookingJourney = { hold: "reserve-B", sends: [] }; });
    const booking = suite.faultOrigin + "/booking/evt_lanterns?lang=en";
    await page.goto(booking);
    const panel = page.getByRole("region", { name: "Protocol commerce journey" });
    await panel.locator("[data-commerce-branch=admission]").click();
    for (const id of ["reservation-clock", "register-show", "reserve-B"]) await step(panel, id);
    await page.waitForFunction(() => window.__kixBookingJourney?.applied === "reserve-B");
    expect(await page.evaluate(() => window.__kixBookingJourney!.sends)).toEqual(["reservation-clock", "register-show", "reserve-B"]);
    const pending = await page.evaluate(() => sessionStorage.getItem("kix-journey-intent:fsm:stub"));
    expect(pending).not.toBeNull();
    await suite.quiet(page, "FSM booking in flight");

    await page.reload();
    await panel.getByText("UNKNOWN", { exact: true }).waitFor();
    expect(await panel.textContent()).toContain(JSON.parse(pending!).operationId);
    expect(await panel.textContent()).toContain(JSON.parse(pending!).lastConfirmed.operationId);
    expect(await panel.locator("[data-commerce-step], [data-commerce-branch]").count()).toBe(0);
    await panel.getByRole("button", { name: "Read current booking" }).click();
    await panel.getByText("NOT_BOUND", { exact: true }).waitFor();
    expect(await page.evaluate(() => window.__kixBookingJourney!.sends)).toEqual([]);
    await suite.quiet(page, "FSM booking after reload and read");

    await page.goto(suite.faultOrigin + "/booking/evt_paper_orchestra?lang=en");
    await panel.getByText(/already open on another booking/).waitFor();
    expect(await panel.textContent()).not.toContain(JSON.parse(pending!).operationId);
    expect(await panel.locator("[data-commerce-step], [data-commerce-branch]").count()).toBe(0);
    expect(await page.evaluate(() => window.__kixBookingJourney!.sends)).toEqual([]);
    await suite.quiet(page, "FSM booking on another route");
    await page.goto(booking);
    await panel.getByText("UNKNOWN", { exact: true }).waitFor();
    expect(await page.evaluate(() => sessionStorage.getItem("kix-journey-intent:fsm:stub"))).toBe(pending);
    expect(await page.evaluate(() => window.__kixBookingJourney!.sends)).toEqual([]);
    await suite.quiet(page, "FSM booking reload");
    await page.close();
  });
});
