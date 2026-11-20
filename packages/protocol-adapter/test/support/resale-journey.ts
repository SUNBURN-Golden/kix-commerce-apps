import { expect, it, vi } from "vitest";
import * as commands from "../../src/commerce-journey-command.js";
import { MARKET_FIXTURE, MARKET_STEPS, type MarketStep } from "../../src/resale-journey-fixture.js";
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
  ["reservation-clock", "market-show", { gate_roles: ["gate-a", "gate-a"] }, "GATES_DUPLICATE"],
  ["resale-clock", "market-reserve", { expires_ms: 1_000_000 }, "RESERVATION_WINDOW"],
  ["resale-clock", "market-reserve", { expires_ms: 1_900_001 }, "RESERVATION_WINDOW"],
  ["market-reserve", "market-order", { amount: 10_000 }, "PRIMARY_PRICE_MISMATCH"],
  ["market-reserve", "market-order", { amount: 0 }, "INVALID_AMOUNT"],
  ["market-order", "market-primary-payment", { payment_ref: "abc" }, "PAYMENT_REF"],
  ["market-order", "market-primary-payment", { payment_ref: "AB".repeat(32) }, "PAYMENT_REF"],
  ["market-order", "market-primary-payment", { amount: 10_000 }, "PAYMENT_AMOUNT_MISMATCH"],
  ["market-issue", "market-adopt", { expires_ms: MARKET_FIXTURE["market-reserve"][1].expires_ms + 1 }, "RESERVATION_BINDING_CONFLICT"],
  ["market-issue", "market-adopt", { quote_ref: "different-quote" }, "ORDER_BINDING_CONFLICT"],
  ["market-issue", "market-adopt", { resale_allowed: false }, "SHOW_BINDING_CONFLICT"],
  ["market-issue", "market-adopt", { gate_roles: ["gate-b", "gate-a"] }, "SHOW_BINDING_CONFLICT"],
  ["market-issue", "market-adopt", { resale_cap: MARKET_FIXTURE["market-show"][1].resale_cap + 1 }, "SHOW_BINDING_CONFLICT"],
  ["market-issue", "market-adopt", { payment_ref: "ee".repeat(32) }, "PAYMENT_BINDING_CONFLICT"],
  ["market-issue", "market-adopt", { payment_ref: "abc" }, "PAYMENT_REF"],
  ["market-issue", "market-adopt", { gate_roles: ["gate-a", "gate-a"] }, "GATES_DUPLICATE"],
  ["market-adopt", "market-list", { version: 2 }, "STALE_VERSION"],
  ["market-adopt", "market-list", { amount: 0 }, "INVALID_AMOUNT"],
  ["market-adopt", "market-list", { expires_ms: 1_000_000 }, "LISTING_WINDOW"],
  ["market-adopt", "market-list", { expires_ms: 1_900_001 }, "LISTING_WINDOW"],
  ["market-adopt", "market-list", { amount: MARKET_FIXTURE["market-show"][1].resale_cap + 1 }, "RESALE_CAP"],
  ["market-list", "market-accept", {}, "ILLEGAL_TRANSITION"],
  ["market-list", "market-cancel", { seller_role: "buyer-2" }, "NOT_HOLDER"],
  ["market-list", "market-hold", { buyer_role: "buyer-1" }, "RECIPIENT_MISMATCH"],
  ["market-hold", "market-hold", { hold_id: "second-hold" }, "BUYER_HOLD_LOCKED"],
  ["market-hold", "market-pay", { buyer_role: "buyer-1" }, "BUYER_MISMATCH"],
  ["market-hold", "market-pay", { amount: 7999 }, "RESALE_AMOUNT_MISMATCH"],
  ["market-hold", "market-pay", { payment_ref: "abc" }, "PAYMENT_REF"],
  ["market-hold", "market-pay", { payment_ref: "CD".repeat(32) }, "PAYMENT_REF"],
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
    expect(journey.state().last).toMatchObject({ proof: { "right.listing_id": null, "listing.settlement_id": null, "listing.settlement_gate": "UNBOUND",
      "listing.mock_settlement_commit_observed": false, "evidence.chain_owner_current": false } });
    expect(send.mock.calls.map(([call]) => commands.commandFor(call).action)).toEqual(orderedActions);
    const before = transportCount?.();
    for (const query of MARKET_READS) expect(resaleRead(query)).toEqual({ kind: "NOT_BOUND", query, reason: "No read endpoint at the pinned gate." });
    expect(SETTLEMENT_EXAMPLE).toMatchObject({ settlement_id: "settle-1", funds_executed: false });
    expect(send).toHaveBeenCalledTimes(orderedActions.length);
    expect(transportCount?.()).toBe(before);
  });

  it.each(["market-list", "market-hold"] as const)("cancels from %s and blocks mutation on the terminal listing", async step => {
    const port = open();
    const spy = vi.spyOn(port, "advanceCommerceJourney");
    const journey = fixtureJourney(port);
    await through(journey, step);
    const before = journey.state().facts;
    expect(await journey.run("market-cancel")).toMatchObject({ kind: "CONFIRMED", proof: { "listing.phase": "CANCELLED" } });
    expect(journey.state()).toMatchObject({ facts: before, next: undefined });
    const [last] = spy.mock.calls.at(-1)!;
    const sent = transportCount?.();
    await expect(port.advanceCommerceJourney({ ...last, step: "market-pay", operationId: "terminal", idempotencyKey: "key-terminal" }))
      .rejects.toMatchObject({ code: transportCount ? "NOT_BOUND" : "TERMINAL_IMMUTABLE" });
    expect(transportCount?.()).toBe(sent);
    expect(journey.state().facts).toEqual(before);
  });

  // The stub still exercises the local business refusal. The semantic HTTP
  // boundary holds the altered envelope before it can reach the producer.
  it.each(refusals)("after %s blocks %s %j (stub code %s)", async (after, probe, fields, code) => {
    const port = open();
    const journey = fixtureJourney(port);
    await through(journey, after);
    const { facts, next } = journey.state();
    const sent = transportCount?.();
    const build = commands.commandFor;
    const override = vi.spyOn(commands, "commandFor").mockImplementationOnce(input => {
      const links = transportCount
        ? Object.fromEntries((commands.RECEIPT_LINKS[probe] ?? []).map(field => [field, Reflect.get(commands.fixtureTemplate(probe)[1], field)]))
        : input.links;
      const row = build({ ...input, step: probe, links });
      return { ...row, body: { ...row.body, ...fields } };
    });
    try {
      expect(await journey.run(next!)).toMatchObject(transportCount
        ? { kind: "NOT_SENT", code: "NOT_BOUND" } : { kind: "REJECTED", code });
      expect(journey.state()).toMatchObject({ facts, confirmed: after });
    } finally { override.mockRestore(); }
    if (transportCount) {
      expect(transportCount()).toBe(sent);
      return;
    }
    // Independent commands probe the FSM after a refusal, without repeating the refused write.
    const checkState = (step: MarketStep, links: commands.JourneyLinks) =>
      port.advanceCommerceJourney({ step, links, operationId: "probe-state", idempotencyKey: "probe-state-key" });
    const listing = MARKET_FIXTURE["market-list"][1];
    if (probe === "market-show") {
      await expect(checkState("market-reserve", MARKET_FIXTURE["market-reserve"][1])).rejects.toMatchObject({ code: "UNKNOWN_SHOW" });
    } else if (probe === "market-reserve") {
      // A fresh reservation claims the same seat at the inclusive upper window boundary.
      const other = { reservation_id: "reserve-other", expires_ms: 1_900_000 };
      await withFields(other, { "reservation.reservation_id": other.reservation_id }, async () => {
        await expect(checkState("market-reserve", MARKET_FIXTURE["market-reserve"][1])).resolves.toMatchObject({ "reservation.phase": "HELD" });
      });
    } else if (probe === "market-order") {
      await expect(port.advanceCommerceJourney({ step: "market-primary-payment", links: MARKET_FIXTURE["market-primary-payment"][1],
        operationId: "check-refused-order", idempotencyKey: "check-refused-order-key" })).rejects.toMatchObject({ code: "UNKNOWN_ORDER" });
      await withFields({ order_id: "order-other" }, { "reservation.order_id": "order-other" }, async () => {
        await expect(checkState("market-order", MARKET_FIXTURE["market-order"][1])).resolves.toMatchObject({ "reservation.phase": "CONFIRMED" });
      });
    } else if (probe === "market-primary-payment") {
      await expect(checkState("market-issue", MARKET_FIXTURE["market-issue"][1])).rejects.toMatchObject({ code: "ILLEGAL_TRANSITION" });
    } else if (probe === "market-adopt") {
      await expect(checkState("market-list", listing)).rejects.toMatchObject({ code: "UNKNOWN_RIGHT" });
    } else if (probe === "market-list") {
      await expect(checkState("market-hold", MARKET_FIXTURE["market-hold"][1])).rejects.toMatchObject({ code: "UNKNOWN_LISTING" });
    } else if (after === "market-hold" && probe === "market-pay") {
      await withFields({ hold_id: "independent-hold" }, {}, async () => {
        await expect(checkState("market-hold", MARKET_FIXTURE["market-hold"][1])).rejects.toMatchObject({ code: "BUYER_HOLD_LOCKED" });
      });
    }
  });

  it("holds altered registration over HTTP and refuses the resulting listing in the stub", async () => {
    const port = open(), journey = fixtureJourney(port);
    const policy = { resale_allowed: false };
    if (transportCount) {
      await through(journey, "reservation-clock");
      const sent = transportCount();
      await withFields(policy, {}, async () => {
        expect(await journey.run("market-show")).toMatchObject({ kind: "NOT_SENT", code: "NOT_BOUND" });
      });
      expect(transportCount()).toBe(sent);
      return;
    }
    for (const step of MARKET_STEPS) {
      const advance = async () => { expect(await journey.run(step)).toMatchObject({ kind: "CONFIRMED" }); };
      if (step === "market-show" || step === "market-adopt") await withFields(policy, {}, advance);
      else await advance();
      if (step === "market-adopt") break;
    }
    const before = journey.state().facts;
    expect(await journey.run("market-list")).toMatchObject({ kind: "REJECTED", code: "RESALE_POLICY_REJECTED" });
    expect(journey.state().facts).toEqual(before);
    await expect(port.advanceCommerceJourney({ step: "market-hold", links: MARKET_FIXTURE["market-hold"][1],
      operationId: "check-listing", idempotencyKey: "check-listing-key" })).rejects.toMatchObject({ code: "UNKNOWN_LISTING" });
  });

  it.each(["market-order", "market-primary-payment"] as const)("blocks an expiry probe after %s", async after => {
    const port = open(), journey = fixtureJourney(port);
    await through(journey, after);
    const { facts, next } = journey.state();
    const deadline = MARKET_FIXTURE["market-reserve"][1].expires_ms;
    const setClock = () => port.advanceCommerceJourney({
      step: "reservation-clock", links: {}, operationId: "expiry", idempotencyKey: "expiry-key",
    });
    if (transportCount) {
      const sent = transportCount();
      await expect(setClock()).rejects.toMatchObject({ code: "NOT_BOUND" });
      expect(transportCount()).toBe(sent);
      return;
    }
    await withFields({ now_ms: deadline }, { logical_time_ms: deadline }, async () => {
      await setClock();
    });
    expect(await journey.run(next!)).toMatchObject({ kind: "REJECTED", code: "RESERVATION_EXPIRED" });
    expect(journey.state()).toMatchObject({ confirmed: after, facts });
    if (after === "market-order") {
      await expect(port.advanceCommerceJourney({ step: "market-issue", links: MARKET_FIXTURE["market-issue"][1],
        operationId: "check-order", idempotencyKey: "check-order-key" })).rejects.toMatchObject({ code: "ILLEGAL_TRANSITION" });
    } else {
      await expect(probeAdoption(port)).rejects.toMatchObject({ code: "TICKET_NOT_ISSUED" });
    }
  });

  it("checks issuance before matching the adoption's payment binding", async () => {
    const port = open(), journey = fixtureJourney(port);
    await through(journey, "market-order");
    const sent = transportCount?.();
    await expect(probeAdoption(port)).rejects.toMatchObject({ code: transportCount ? "NOT_BOUND" : "TICKET_NOT_ISSUED" });
    expect(transportCount?.()).toBe(sent);
    for (const step of ["market-primary-payment", "market-issue", "market-adopt"] as const) {
      expect(await journey.run(step)).toMatchObject({ kind: "CONFIRMED" });
    }
  });

  it("holds an altered listing over HTTP and checks the inclusive amount and window boundaries in the stub", async () => {
    const journey = fixtureJourney(open());
    await through(journey, "market-adopt");
    const amount = MARKET_FIXTURE["market-show"][1].resale_cap;
    const sent = transportCount?.();
    await withFields({ amount, expires_ms: 1_900_000 }, { "listing.amount": amount }, async () => {
      expect(await journey.run("market-list")).toMatchObject(transportCount
        ? { kind: "NOT_SENT", code: "NOT_BOUND" }
        : { kind: "CONFIRMED", proof: { "listing.phase": "LISTED", "listing.amount": amount } });
    });
    expect(transportCount?.()).toBe(sent);
  });

  it("holds a direct resale clock over HTTP and refuses the hold at the listing deadline in the stub", async () => {
    const port = open(), journey = fixtureJourney(port);
    await through(journey, "market-list");
    const before = journey.state().facts;
    const setClock = () => port.advanceCommerceJourney({
      step: "resale-clock", links: {}, operationId: "expiry", idempotencyKey: "expiry-key",
    });
    if (transportCount) {
      const sent = transportCount();
      await expect(setClock()).rejects.toMatchObject({ code: "NOT_BOUND" });
      expect(transportCount()).toBe(sent);
      return;
    }
    await withFields({ now_ms: 1120000 }, { logical_time_ms: 1120000 }, async () => {
      await setClock();
    });
    expect(await journey.run("market-hold")).toMatchObject({ kind: "REJECTED", code: "LISTING_NOT_OPEN" });
    expect(journey.state().facts).toEqual(before);
  });
}

// Change one command after the adapter builds it. Successful variants also need matching receipt fields.
async function withFields(body: Record<string, unknown>, proof: commands.JourneyProof, run: () => Promise<void>) {
  const build = commands.commandFor;
  const override = vi.spyOn(commands, "commandFor").mockImplementationOnce(input => {
    const row = build(input);
    if (typeof row.expectation === "string") throw new Error("Expected a success fixture");
    return { ...row, body: { ...row.body, ...body }, expectation: { ...row.expectation, ...proof } };
  });
  try { await run(); } finally { override.mockRestore(); }
}

function probeAdoption(port: commands.CommerceJourneyPort) {
  const { show_id, reservation_id, order_id, amount, quote_ref, payment_ref, right_id, buyer_role } = MARKET_FIXTURE["market-adopt"][1];
  return port.advanceCommerceJourney({ step: "market-adopt", operationId: "check-adopt", idempotencyKey: "check-adopt-key",
    links: { show_id, reservation_id, order_id, amount, quote_ref, payment_ref, right_id, buyer_role } });
}
