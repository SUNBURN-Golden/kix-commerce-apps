import { type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  composePrimarySeatJourney,
  createJourneyDemoCaller,
  journeyDemoInput,
  ProtocolError,
  HttpProtocolAdapter,
  JOURNEY_COMPOSED_ACTIONS,
  PINNED_PROTOCOL_DOMAIN,
  type JourneyLocalCaller,
  type LocalCallInput,
  type PrimarySeatJourneyInput,
} from "../src/index.js";
import { assertReviewedCheckout, protocolRoot, REVIEWED_GATE_RUNS, startGate, stopGate } from "./support/reviewed-gate.js";

const describeGate = REVIEWED_GATE_RUNS ? describe.sequential : describe.skip;

const SHOW_POLICY = {
  primaryPrice: 100000,
  resaleCap: 150000,
  primaryFeeBps: 500,
  resaleFeeBps: 300,
  resaleOrganizerBps: 200,
  resaleAllowed: true,
  refundProfile: "FULL_CHAIN_UNWIND_FIXTURE",
};

function gateInput(eventId: string): PrimarySeatJourneyInput {
  const input = journeyDemoInput(eventId);
  return { ...input, tradeId: `trade-${eventId}`, paymentId: `payment-${eventId}`,
    operationIds: Object.fromEntries(Object.keys(input.operationIds).map((key) => [key, `${eventId}-${key}`])) as unknown as PrimarySeatJourneyInput["operationIds"] };
}

describeGate("primary seat journey against the reviewed gate", () => {
  let baseUrl = "";
  let child: ChildProcess | undefined;

  beforeAll(async () => {
    const root = protocolRoot();
    assertReviewedCheckout(root);
    const started = await startGate(root);
    baseUrl = started.baseUrl;
    child = started.child;
  }, 20000);

  afterAll(async () => {
    await stopGate(child);
  });

  it("chains synthetic capture through one-time admission without settlement", async () => {
    const calls: LocalCallInput[] = [];
    const http = new HttpProtocolAdapter(baseUrl);
    const caller: JourneyLocalCaller = {
      invokeLocalCall(input) {
        calls.push(input);
        return http.invokeLocalCall(input);
      },
    };

    const journey = await composePrimarySeatJourney(caller, {
      operationIds: {
        createEvent: "op-w6a-create",
        prepareTrade: "op-w6a-prepare",
        acceptTrade: "op-w6a-accept",
        capture: "op-w6a-capture", commitTrade: "op-w6a-commit", openAdmission: "op-w6a-open", admit: "op-w6a-admit",
      },
      eventId: "show-w6a",
      paymentId: "payment-w6a",
      organizer: "organizer",
      buyer: "buyer",
      tradeId: "trade-w6a",
      seats: ["A1", "A2"],
      policy: SHOW_POLICY,
    });

    expect(journey.fence).toBeNull();
    expect(calls.map((call) => call.action)).toEqual([...JOURNEY_COMPOSED_ACTIONS]);
    expect(journey.composed.map((step) => step.action)).toEqual([...JOURNEY_COMPOSED_ACTIONS]);
    expect(journey.composed[0]?.receipt).toMatchObject({
      domain: PINNED_PROTOCOL_DOMAIN,
      operationId: "op-w6a-create",
      action: "create_event",
    });
    const inventoryIds = journey.composed[0]?.receipt.result.inventoryIds;
    expect(Array.isArray(inventoryIds)).toBe(true);
    expect(inventoryIds).toHaveLength(2);
    expect(calls[1]?.body).toMatchObject({
      inventoryId: Array.isArray(inventoryIds) ? inventoryIds[0] : "",
      amount: SHOW_POLICY.primaryPrice,
      expectedInventoryVersion: 0,
      expectedVersion: 0,
      tradeId: "trade-w6a",
      buyer: "buyer",
    });
    expect(calls[1]?.body).not.toHaveProperty("ticketId");
    expect(journey.composed[1]?.receipt.result).toMatchObject({
      tradeId: "trade-w6a",
      status: "PREPARED",
    });
    expect(calls[2]?.body).toMatchObject({
      tradeId: "trade-w6a",
      termsHash: journey.composed[1]?.receipt.result.termsHash,
    });
    expect(journey.composed[2]?.receipt.result).toEqual({ accepted: true });
    expect(journey.composed[3]?.receipt.result).toEqual({ captured: true, cashAvailable: false });
    expect(journey.composed[6]?.receipt.result).toEqual({ admissionId: "op-w6a-admit", decision: "ADMITTED_ONCE" });
    expect(calls[3]?.body).toMatchObject({ orderId: journey.composed[1]?.receipt.result.externalOrderId, provenance: "synthetic" });
    expect(calls[6]?.body).toMatchObject({ ticketId: journey.composed[4]?.receipt.result.ticketId,
      holder: "buyer", expectedVersion: journey.composed[4]?.receipt.result.rightsVersion,
      admissionEpoch: journey.composed[4]?.receipt.result.admissionEpoch });
    await expect(http.invokeLocalCall({ ...calls[6]!, operationId: "separate-second-admission" })).rejects.toMatchObject({ code: "RIGHT_NOT_ADMISSIBLE" });
    expect(
      calls.some(
        (call) => call.action === "settle_capture" || call.action === "reserve_listing",
      ),
    ).toBe(false);
    expect(journey.notBound.map((row) => row.deskMethod)).toEqual(["placeHold", "confirmBooking", "settlementPreview"]);
    expect(journey.notBound.every((row) => row.sends === false && row.status === "not-bound")).toBe(true);
  }, 20000);

  it("fences prepare when create_event is rejected", async () => {
    const calls: string[] = [];
    const http = new HttpProtocolAdapter(baseUrl);
    const caller: JourneyLocalCaller = {
      invokeLocalCall(input) {
        calls.push(input.action);
        return http.invokeLocalCall(input);
      },
    };

    const journey = await composePrimarySeatJourney(caller, {
      operationIds: {
        createEvent: "op-w6a-dup",
        prepareTrade: "op-w6a-prepare-dup",
        acceptTrade: "op-w6a-accept-dup",
        capture: "op-dup-capture", commitTrade: "op-dup-commit", openAdmission: "op-dup-open", admit: "op-dup-admit",
      },
      eventId: "show-w6a",
      paymentId: "payment-w6a",
      organizer: "organizer",
      buyer: "buyer",
      tradeId: "trade-w6a-dup",
      seats: ["A1"],
      policy: SHOW_POLICY,
    });

    expect(calls).toEqual(["create_event"]);
    expect(journey.composed).toEqual([]);
    expect(journey.fence).toMatchObject({
      outcome: "REJECTED",
      action: "create_event",
      operationId: "op-w6a-dup",
      code: "EVENT_EXISTS",
    });
  }, 20000);

  it("uses the same supported sequence in the UI fixture and reviewed gate", async () => {
    const input = gateInput("show-parity");
    const { caller } = createJourneyDemoCaller("success");
    const fixture = await composePrimarySeatJourney(caller, input);
    const gate = await composePrimarySeatJourney(new HttpProtocolAdapter(baseUrl), input);
    expect(gate.fence).toBeNull();
    expect(fixture.fence).toBeNull();
    expect(gate.composed.map((step) => [step.action, step.operationId])).toEqual(
      fixture.composed.map((step) => [step.action, step.operationId]),
    );
    expect(gate.notBound).toEqual(fixture.notBound);
    expect(gate.uncomposed).toEqual(fixture.uncomposed);
  }, 20000);

  it.each(JOURNEY_COMPOSED_ACTIONS)(
    "fences after an actual %s effect whose response is lost", async (lostAction) => {
      const input = gateInput(`show-lost-${lostAction}`);
      const unique = {
        ...input, tradeId: `trade-lost-${lostAction}`,
        operationIds: { ...input.operationIds, createEvent: `lost-${lostAction}-create`, prepareTrade: `lost-${lostAction}-prepare`, acceptTrade: `lost-${lostAction}-accept` },
      };
      const calls: string[] = [];
      const applied: string[] = [];
      const http = new HttpProtocolAdapter(baseUrl);
      const caller: JourneyLocalCaller = {
        async invokeLocalCall(call) {
          calls.push(call.action);
          const receipt = await http.invokeLocalCall(call);
          applied.push(call.action);
          if (call.action === lostAction) throw new ProtocolError("Receipt lost after actual gate success", "GATE_UNAVAILABLE");
          return receipt;
        },
      };
      const result = await composePrimarySeatJourney(caller, unique);
      const lostIndex = JOURNEY_COMPOSED_ACTIONS.indexOf(lostAction as typeof JOURNEY_COMPOSED_ACTIONS[number]);
      expect(applied).toEqual(JOURNEY_COMPOSED_ACTIONS.slice(0, lostIndex + 1));
      expect(calls).toEqual(applied);
      expect(result.composed.map((step) => step.action)).toEqual(JOURNEY_COMPOSED_ACTIONS.slice(0, lostIndex));
      expect(result.fence).toMatchObject({ outcome: "UNKNOWN", action: lostAction, receipt: null });
    }, 20000,
  );

  it.each(["rightsVersion", "admissionEpoch", "both"])("fences an impossible first-issuance %s before opening admission", async (field) => {
    const http = new HttpProtocolAdapter(baseUrl);
    const calls: string[] = [];
    const caller: JourneyLocalCaller = {
      async invokeLocalCall(call) {
        calls.push(call.action);
        const receipt = await http.invokeLocalCall(call) as { result: Record<string, unknown> };
        return call.action === "commit_trade"
          ? { ...receipt, result: { ...receipt.result,
            ...(field === "both" ? { rightsVersion: 2, admissionEpoch: 2 } : { [field]: 2 }) } }
          : receipt;
      },
    };
    const result = await composePrimarySeatJourney(caller, gateInput(`show-invalid-${field}`));
    expect(result.fence).toMatchObject({ action: "commit_trade", outcome: "INVALID_RECEIPT", code: "GATE_STATUS" });
    expect(calls).toEqual(JOURNEY_COMPOSED_ACTIONS.slice(0, 5));
    expect(result.composed.map((step) => step.action)).toEqual(JOURNEY_COMPOSED_ACTIONS.slice(0, 4));
  }, 20000);

  it("rejects an old presentation after an actual gift transfer", async () => {
    const http = new HttpProtocolAdapter(baseUrl);
    const input = gateInput("show-transferred");
    const calls: string[] = [];
    const caller: JourneyLocalCaller = {
      async invokeLocalCall(call) {
        calls.push(call.action);
        const receipt = await http.invokeLocalCall(call) as { result: Record<string, unknown> };
        if (call.action === "commit_trade") {
          const offered = await http.invokeLocalCall({ operationId: "transfer-offer", actor: input.buyer,
            action: "offer_gift", body: { domain: PINNED_PROTOCOL_DOMAIN, giftId: "gift-stale",
              ticketId: receipt.result.ticketId, expectedVersion: receipt.result.rightsVersion,
              recipient: "new-holder", expiresAt: 86400 } }) as { result: Record<string, unknown> };
          await http.invokeLocalCall({ operationId: "transfer-accept", actor: "new-holder", action: "accept_gift",
            body: { domain: PINNED_PROTOCOL_DOMAIN, giftId: "gift-stale", termsHash: offered.result.termsHash } });
        }
        return receipt;
      },
    };
    const result = await composePrimarySeatJourney(caller, input);
    expect(calls).toEqual([...JOURNEY_COMPOSED_ACTIONS]);
    expect(result.composed.map((step) => step.action)).toEqual(JOURNEY_COMPOSED_ACTIONS.slice(0, -1));
    expect(result.fence).toMatchObject({ action: "admit", outcome: "REJECTED", code: "STALE_OR_WRONG_PRESENTATION" });
  }, 20000);

  it("blocks issuance after synthetic capture when the reservation expires", async () => {
    const http = new HttpProtocolAdapter(baseUrl);
    const calls: string[] = [];
    const caller: JourneyLocalCaller = {
      async invokeLocalCall(call) {
        calls.push(call.action);
        const receipt = await http.invokeLocalCall(call);
        if (call.action === "capture") await http.invokeLocalCall({ operationId: "capture-expire-clock",
          actor: "operator", action: "advance_clock", body: { domain: PINNED_PROTOCOL_DOMAIN, now: 1000000 } });
        return receipt;
      },
    };
    const result = await composePrimarySeatJourney(caller, gateInput("show-capture-expiry"));
    expect(calls).toEqual(JOURNEY_COMPOSED_ACTIONS.slice(0, 5));
    expect(result.composed.map((step) => step.action)).toEqual(JOURNEY_COMPOSED_ACTIONS.slice(0, 4));
    expect(result.fence).toMatchObject({ action: "commit_trade", outcome: "REJECTED", code: "TRADE_NOT_COMMITTABLE" });
  }, 20000);

  it("fences an accept whose prepared trade expired at the reviewed gate", async () => {
    const http = new HttpProtocolAdapter(baseUrl);
    const input = gateInput("show-expiry");
    const calls: string[] = [];
    const caller: JourneyLocalCaller = {
      async invokeLocalCall(call) {
        calls.push(call.action);
        const receipt = await http.invokeLocalCall(call);
        if (call.action === "prepare_trade") {
          await http.invokeLocalCall({ operationId: "expire-clock", actor: "operator", action: "advance_clock",
            body: { domain: PINNED_PROTOCOL_DOMAIN, now: 2000000 } });
        }
        return receipt;
      },
    };
    const result = await composePrimarySeatJourney(caller, {
      ...input, tradeId: "trade-expiry",
      operationIds: { ...input.operationIds, createEvent: "expiry-create", prepareTrade: "expiry-prepare", acceptTrade: "expiry-accept" },
    });
    expect(calls).toEqual(["create_event", "prepare_trade", "accept_trade"]);
    expect(result.composed.map((step) => step.action)).toEqual(["create_event", "prepare_trade"]);
    expect(result.fence).toMatchObject({ outcome: "REJECTED", action: "accept_trade", code: "TRADE_NOT_ACCEPTABLE" });
  }, 20000);

});
