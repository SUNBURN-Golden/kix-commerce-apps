import { expect, it, vi } from "vitest";
import * as commands from "../../src/commerce-journey-command.js";
import { MARKET_STEPS, type MarketStep } from "../../src/resale-journey-fixture.js";
import { ResaleJourney, SETTLEMENT_EXAMPLE } from "../../src/resale-journey.js";
import { MARKET_READS, resaleRead } from "../../src/resale-market-reads.js";

export const orderedActions = ["reservation_set_clock", "reservation_register_show", "resale_set_clock", "reservation_hold",
  "reservation_confirm", "reservation_observe_payment", "reservation_issue", "resale_adopt_issued", "resale_list_resale",
  "resale_hold_buy", "resale_observe_resale_payment", "resale_accept_resale"];

export function fixtureJourney(port: commands.CommerceJourneyPort) {
  let seq = 0;
  return new ResaleJourney(port, () => ({ operationId: `op-${++seq}`, idempotencyKey: `key-${seq}` }));
}
export async function through(journey: ResaleJourney, until: MarketStep) {
  for (const step of MARKET_STEPS) {
    expect(await journey.run(step), step).toMatchObject({ kind: "CONFIRMED" });
    if (step === until) return;
  }
  throw new Error("Unreachable setup step");
}

type Refusal = [after: MarketStep, probe: MarketStep, fields: Record<string, unknown>, error: string];
const refusals: Refusal[] = [
  ["market-issue", "market-adopt", { payment_ref: "ee".repeat(32) }, "PAYMENT_BINDING_CONFLICT"],
  ["market-adopt", "market-list", { version: 2 }, "STALE_VERSION"],
  ["market-list", "market-accept", {}, "ILLEGAL_TRANSITION"],
  ["market-list", "market-cancel", { seller_role: "buyer-2" }, "NOT_HOLDER"],
  ["market-list", "market-hold", { buyer_role: "buyer-1" }, "RECIPIENT_MISMATCH"],
  ["market-hold", "market-hold", { hold_id: "second-hold" }, "BUYER_HOLD_LOCKED"],
  ["market-hold", "market-pay", { buyer_role: "buyer-1" }, "BUYER_MISMATCH"],
  ["market-hold", "market-pay", { amount: 7999 }, "RESALE_AMOUNT_MISMATCH"],
  ["market-pay", "market-pay", {}, "LISTING_PAYMENT_BOUND"],
  ["market-pay", "market-cancel", {}, "COMPENSATION_UNDEFINED"],
];

export function resaleScenarios(open: () => commands.CommerceJourneyPort, transportCount?: () => number) {
  it("confirms each independent fact at its own step and sends only the fixture sequence", async () => {
    const port = open();
    const send = vi.spyOn(port, "advanceCommerceJourney");
    const journey = fixtureJourney(port);
    let listed = "NO_EVIDENCE", paid = "NO_EVIDENCE", accepted = "NO_EVIDENCE";
    for (const step of MARKET_STEPS) {
      expect(await journey.run(step), step).toMatchObject({ kind: "CONFIRMED" });
      if (step === "market-list") listed = "LISTED";
      if (step === "market-pay") paid = "PAYMENT_NOTED";
      if (step === "market-accept") accepted = "TRANSFERRED";
      expect(journey.state().facts).toMatchObject({ listed: { state: listed }, paid: { state: paid },
        acceptedTransferred: { state: accepted }, settled: { state: "NO_EVIDENCE" } });
    }
    expect(journey.state().last).toMatchObject({ proof: { "listing.settlement_id": null, "listing.settlement_gate": "UNBOUND",
      "listing.mock_settlement_commit_observed": false, "evidence.chain_owner_current": false } });
    expect(send.mock.calls.map(([call]) => commands.commandFor(call).action)).toEqual(orderedActions);
    const before = transportCount?.();
    for (const query of MARKET_READS) expect(resaleRead(query)).toEqual({ kind: "NOT_BOUND", query, reason: "No read endpoint at the pinned gate." });
    expect(SETTLEMENT_EXAMPLE).toMatchObject({ settlement_id: "settle-1", funds_executed: false });
    expect(send).toHaveBeenCalledTimes(orderedActions.length);
    expect(transportCount?.()).toBe(before);
  });

  it.each(["market-list", "market-hold"] as const)("cancels from %s and refuses mutation on the terminal listing", async step => {
    const port = open();
    const spy = vi.spyOn(port, "advanceCommerceJourney");
    const journey = fixtureJourney(port);
    await through(journey, step);
    const before = journey.state().facts;
    expect(await journey.run("market-cancel")).toMatchObject({ kind: "CONFIRMED", proof: { "listing.phase": "CANCELLED" } });
    expect(journey.state()).toMatchObject({ facts: before, next: undefined });
    const [last] = spy.mock.calls.at(-1)!;
    await expect(port.advanceCommerceJourney({ ...last, step: "market-pay", operationId: "terminal", idempotencyKey: "key-terminal" }))
      .rejects.toMatchObject({ code: "TERMINAL_IMMUTABLE" });
    expect(journey.state().facts).toEqual(before);
  });

  // Inject only in the test, immediately after the normal receipt-linked body is built.
  // The stub dispatch and the real gate each have to judge the invalid command.
  it.each(refusals)("after %s refuses %s %j with %s", async (after, probe, fields, code) => {
    const journey = fixtureJourney(open());
    await through(journey, after);
    const { facts, next } = journey.state();
    const build = commands.commandFor;
    const override = vi.spyOn(commands, "commandFor").mockImplementationOnce(input => {
      const row = build({ ...input, step: probe });
      return { ...row, body: { ...row.body, ...fields } };
    });
    try {
      expect(await journey.run(next!)).toMatchObject({ kind: "REJECTED", code });
      expect(journey.state()).toMatchObject({ facts, confirmed: after });
    } finally { override.mockRestore(); }
  });

  it("refuses a hold exactly at the listing deadline", async () => {
    const port = open(), journey = fixtureJourney(port);
    await through(journey, "market-list");
    const before = journey.state().facts;
    const build = commands.commandFor;
    const clock = vi.spyOn(commands, "commandFor").mockImplementationOnce(input => {
      const row = build(input);
      return { ...row, body: { ...row.body, now_ms: 1120000 }, expectation: { logical_time_ms: 1120000 } };
    });
    try {
      await port.advanceCommerceJourney({ step: "resale-clock", links: {}, operationId: "expiry", idempotencyKey: "expiry-key" });
    } finally { clock.mockRestore(); }
    expect(await journey.run("market-hold")).toMatchObject({ kind: "REJECTED", code: "LISTING_NOT_OPEN" });
    expect(journey.state().facts).toEqual(before);
  });
}
