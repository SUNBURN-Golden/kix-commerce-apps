import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  composePrimarySeatJourney,
  HttpProtocolAdapter,
  echoIntegrationGateHeaders,
  type LocalCallInput,
  JOURNEY_COMPOSED_ACTIONS,
  JOURNEY_NOT_BOUND,
  JOURNEY_UNCOMPOSED,
  PINNED_PROTOCOL_DOMAIN,
  type JourneyLocalCaller,
  type PrimarySeatJourneyInput,
} from "../src/index.js";
import { assertLocalCallReceipt, enforceRemotePayloadGuards } from "../src/payload-guards.js";
import { ProtocolError } from "../src/types.js";
import { localCallReceipt } from "./support/receipt.js";

const SHOW_POLICY = {
  primaryPrice: 100000,
  resaleCap: 150000,
  primaryFeeBps: 500,
  resaleFeeBps: 300,
  resaleOrganizerBps: 200,
  resaleAllowed: true,
  refundProfile: "FULL_CHAIN_UNWIND_FIXTURE",
};

const INPUT: PrimarySeatJourneyInput = {
  operationIds: {
    createEvent: "op-create",
    prepareTrade: "op-prepare",
    acceptTrade: "op-accept",
    capture: "op-capture", commitTrade: "op-commit", openAdmission: "op-open", admit: "op-admit",
  },
  eventId: "show-w6a",
  organizer: "organizer",
  buyer: "buyer",
  tradeId: "trade-w6a",
  paymentId: "payment-w6a",
  seats: ["A1"],
  policy: SHOW_POLICY,
};

const CREATE_RESULT = {
  eventId: "show-w6a",
  policyHash: "a".repeat(64),
  inventoryIds: ["inv-seat-a", "inv-seat-b"],
  reservationSeconds: 900,
};

const PREPARE_RESULT = {
  tradeId: "trade-w6a",
  ticketId: "right-seat-a",
  externalOrderId: "kix_order",
  status: "PREPARED",
  termsHash: "b".repeat(64),
};

const ACCEPT_RESULT = { accepted: true };
const LATER_RESULTS: Record<string, Record<string, unknown>> = {
  capture: { captured: true, cashAvailable: false },
  commit_trade: { ticketId: "right-seat-a", owner: "buyer", rightsVersion: 1, admissionEpoch: 1 },
  open_admission: { admissionStatus: "OPEN" },
  admit: { admissionId: "op-admit", decision: "ADMITTED_ONCE" },
};
const OPERATION_IDS = ["op-create", "op-prepare", "op-accept", "op-capture", "op-commit", "op-open", "op-admit"];

function receipt(operationId: string, action: string, result: Record<string, unknown>) {
  return localCallReceipt(operationId, action, result);
}

function scripted(steps: Record<string, () => unknown>): { caller: JourneyLocalCaller; calls: Array<{ action: string; actor: string; operationId: string; body: Record<string, unknown> }> } {
  const calls: Array<{ action: string; actor: string; operationId: string; body: Record<string, unknown> }> = [];
  const caller: JourneyLocalCaller = {
    invokeLocalCall(input) {
      calls.push({
        action: input.action,
        actor: input.actor,
        operationId: input.operationId,
        body: input.body as Record<string, unknown>,
      });
      const step = steps[input.action] ?? (LATER_RESULTS[input.action]
        ? () => receipt(input.operationId, input.action, LATER_RESULTS[input.action]!) : undefined);
      if (!step) {
        throw new Error(`unexpected action ${input.action}`);
      }
      return Promise.resolve(step());
    },
  };
  return { caller, calls };
}

// Error bodies as the pinned gate sends them: _error() and _not_ready() in integration_gate/server.py.
const gateError = (code: string) => ({ error: code, rejected: true });
const GATE_NOT_READY = {
  error: "NOT_READY", production: false, productionReadiness: false, productionConformance: false,
  protocolTruth: false, rejected: true, role: "integration-gate",
};

// A string failure is sent as raw response text.
function gateFailingAt(action: string, status: number, failure: Record<string, unknown> | string) {
  const { caller: scriptedCaller, calls } = scripted({
    create_event: () => receipt("op-create", "create_event", CREATE_RESULT),
    prepare_trade: () => receipt("op-prepare", "prepare_trade", PREPARE_RESULT),
    accept_trade: () => receipt("op-accept", "accept_trade", ACCEPT_RESULT),
  });
  const caller = new HttpProtocolAdapter("http://127.0.0.1:8765", async (_url, init) => {
    const input = JSON.parse(String(init?.body)) as LocalCallInput;
    const body = await scriptedCaller.invokeLocalCall(input);
    return input.action === action
      ? new Response(typeof failure === "string" ? failure : JSON.stringify(failure), { status, headers: echoIntegrationGateHeaders(init) })
      : new Response(JSON.stringify(body), { status: 200, headers: echoIntegrationGateHeaders(init) });
  });
  return { caller, calls };
}

const GATE_FAILURE_STEPS = ["capture", "commit_trade"] as const;

// Readable bodies with no gate rejection code. The scripted caller has already
// produced the effect, so none of these may become an explicit rejection.
const CODELESS_FAILURES = [
  [500, "{}"], [500, ""], [500, "null"], [500, "[]"], [500, '"failed"'],
  [500, '{"rejected":true}'], [500, '{"rejected":false}'],
  [500, '{"error":"","rejected":true}'], [500, '{"error":"   ","rejected":true}'],
  [500, '{"error":42,"rejected":true}'], [500, '{"error":null,"rejected":true}'],
  [422, "{}"], [503, "{}"], [200, '{"rejected":true}'],
] as const;

describe("primary seat journey helper", () => {
  it.each([
    ["capture", { duplicate: true }],
    ["capture", { captured: true, cashAvailable: true }],
    ["commit_trade", { ...LATER_RESULTS.commit_trade, ticketId: "another-ticket" }],
    ["commit_trade", { ...LATER_RESULTS.commit_trade, owner: "another-buyer" }],
    ["commit_trade", { ...LATER_RESULTS.commit_trade, rightsVersion: "1" }],
    ["commit_trade", { ...LATER_RESULTS.commit_trade, admissionEpoch: 0 }],
    ["commit_trade", { ...LATER_RESULTS.commit_trade, rightsVersion: 2 }],
    ["commit_trade", { ...LATER_RESULTS.commit_trade, admissionEpoch: 2 }],
    ["commit_trade", { ...LATER_RESULTS.commit_trade, rightsVersion: 2, admissionEpoch: 2 }],
    ["open_admission", { admissionStatus: "CLOSED" }],
    ["admit", { admissionId: "another-request", decision: "ADMITTED_ONCE" }],
    ["admit", { admissionId: "op-admit", decision: "DENIED" }],
  ] as const)("fences a non-causal %s receipt", async (action, malformed) => {
    const { caller, calls } = scripted({
      create_event: () => receipt("op-create", "create_event", CREATE_RESULT),
      prepare_trade: () => receipt("op-prepare", "prepare_trade", PREPARE_RESULT),
      accept_trade: () => receipt("op-accept", "accept_trade", ACCEPT_RESULT),
      [action]: () => receipt(OPERATION_IDS[JOURNEY_COMPOSED_ACTIONS.indexOf(action)]!, action, malformed),
    });
    const result = await composePrimarySeatJourney(caller, INPUT);
    const index = JOURNEY_COMPOSED_ACTIONS.indexOf(action);
    expect(result.fence).toMatchObject({ action, outcome: "INVALID_RECEIPT" });
    expect(calls.map((call) => call.action)).toEqual(JOURNEY_COMPOSED_ACTIONS.slice(0, index + 1));
    expect(result.composed.map((step) => step.action)).toEqual(JOURNEY_COMPOSED_ACTIONS.slice(0, index));
  });

  it("rejects reused or missing operation identity before creating an event", async () => {
    const { caller, calls } = scripted({});
    for (const operationIds of [
      { ...INPUT.operationIds, capture: INPUT.operationIds.prepareTrade },
      { ...INPUT.operationIds, admit: "" },
    ]) {
      const result = await composePrimarySeatJourney(caller, { ...INPUT, operationIds });
      expect(result.fence).toMatchObject({ code: "INVALID_JOURNEY_INPUT", action: "create_event" });
    }
    expect(calls).toEqual([]);
  });

  it("chains synthetic capture, issuance and admission from the validated causal receipts", async () => {
    const createReceipt = receipt("op-create", "create_event", CREATE_RESULT);
    const prepareReceipt = receipt("op-prepare", "prepare_trade", PREPARE_RESULT);
    const acceptReceipt = receipt("op-accept", "accept_trade", ACCEPT_RESULT);
    const { caller, calls } = scripted({
      create_event: () => createReceipt,
      prepare_trade: () => prepareReceipt,
      accept_trade: () => acceptReceipt,
    });

    const journey = await composePrimarySeatJourney(caller, INPUT);

    expect(calls.map((call) => call.action)).toEqual([...JOURNEY_COMPOSED_ACTIONS]);
    expect(calls.map((call) => call.operationId)).toEqual(OPERATION_IDS);
    expect(calls[0]).toMatchObject({
      action: "create_event",
      body: {
        domain: PINNED_PROTOCOL_DOMAIN,
        eventId: "show-w6a",
        organizer: "organizer",
        policy: SHOW_POLICY,
        seats: ["A1"],
      },
    });
    expect(calls[0]?.body).not.toHaveProperty("ticketId");
    expect(calls[1]).toMatchObject({
      action: "prepare_trade",
      body: {
        domain: PINNED_PROTOCOL_DOMAIN,
        tradeId: "trade-w6a",
        inventoryId: "inv-seat-a",
        buyer: "buyer",
        amount: 100000,
        expectedInventoryVersion: 0,
        expectedVersion: 0,
      },
    });
    expect(calls[1]?.body).not.toHaveProperty("ticketId");
    expect(calls[1]?.body).not.toHaveProperty("listingId");
    expect(calls[1]?.body).not.toHaveProperty("expiresAt");
    expect(calls[2]).toMatchObject({
      action: "accept_trade",
      body: {
        domain: PINNED_PROTOCOL_DOMAIN,
        tradeId: "trade-w6a",
        termsHash: PREPARE_RESULT.termsHash,
      },
    });
    expect(journey.fence).toBeNull();
    expect(journey.composed.slice(0, 3).map((step) => step.receipt)).toEqual([createReceipt, prepareReceipt, acceptReceipt]);
    expect(journey.composed[0]?.receipt).toBe(createReceipt);
    expect(journey.composed[1]?.receipt).toBe(prepareReceipt);
    expect(journey.composed[2]?.receipt).toBe(acceptReceipt);
    expect(journey.notBound).toBe(JOURNEY_NOT_BOUND);
    expect(journey.uncomposed).toBe(JOURNEY_UNCOMPOSED);
    expect(journey.uncomposed.map((step) => step.action)).toEqual([
      "settle_capture",
      "reserve_listing",
    ]);
    expect(calls.some((call) => call.action === "settle_capture" || call.action === "reserve_listing")).toBe(false);
    expect(calls[3]).toMatchObject({ actor: "pg-adapter", body: {
      orderId: PREPARE_RESULT.externalOrderId, tradeId: INPUT.tradeId, paymentId: INPUT.paymentId,
      buyer: INPUT.buyer, amount: SHOW_POLICY.primaryPrice, currency: "KRW", provenance: "synthetic",
      scope: { provider: "toss", environment: "test", merchant: "kix-fixture", channel: "card" },
    } });
    expect(calls[4]).toMatchObject({ actor: "operator", body: { tradeId: INPUT.tradeId } });
    expect(calls[5]).toMatchObject({ actor: "operator", body: { eventId: INPUT.eventId } });
    expect(calls[6]).toMatchObject({ actor: "venue", body: {
      ticketId: PREPARE_RESULT.ticketId, holder: INPUT.buyer, expectedVersion: 1, admissionEpoch: 1,
    } });
  });

  it("keeps the original intent when the caller mutates input during an awaited receipt", async () => {
    const mutable = {
      ...INPUT,
      operationIds: { ...INPUT.operationIds },
      seats: [...INPUT.seats],
      policy: { ...INPUT.policy },
    };
    const { caller: fixture, calls } = scripted({
      create_event: () => receipt("op-create", "create_event", CREATE_RESULT),
      prepare_trade: () => receipt("op-prepare", "prepare_trade", PREPARE_RESULT),
      accept_trade: () => receipt("op-accept", "accept_trade", ACCEPT_RESULT),
    });
    const caller: JourneyLocalCaller = {
      async invokeLocalCall(call) {
        const response = await fixture.invokeLocalCall(call);
        mutable.buyer = "another-buyer";
        mutable.eventId = "another-event";
        mutable.tradeId = "another-trade";
        mutable.operationIds.createEvent = "replacement-create";
        mutable.operationIds.prepareTrade = "replacement-prepare";
        mutable.operationIds.acceptTrade = "replacement-accept";
        mutable.paymentId = "replacement-payment";
        mutable.operationIds.capture = "replacement-capture";
        mutable.policy.primaryPrice = 1;
        mutable.seats[0] = "B1";
        return response;
      },
    };
    const journey = await composePrimarySeatJourney(caller, mutable);
    expect(journey.fence).toBeNull();
    expect(calls.map((call) => call.operationId)).toEqual(OPERATION_IDS);
    expect(calls.slice(1, 3).map((call) => call.actor)).toEqual(["buyer", "buyer"]);
    expect(calls[1]?.body).toMatchObject({ buyer: "buyer", tradeId: "trade-w6a", amount: 100000 });
    expect(calls[2]?.body).toMatchObject({ tradeId: "trade-w6a", termsHash: PREPARE_RESULT.termsHash });
    expect(journey.composed.map((step) => step.operationId)).toEqual(OPERATION_IDS);
    expect(calls[3]?.body).toMatchObject({ paymentId: "payment-w6a", amount: 100000, buyer: "buyer" });
  });

  it.each(["direct", "http"])("keeps a nested guard failure unconfirmed through %s", async (transport) => {
    const { caller: scriptedCaller, calls } = scripted({
      create_event: () => receipt("op-create", "create_event", CREATE_RESULT),
      prepare_trade: () => receipt("op-prepare", "prepare_trade", {
        ...PREPARE_RESULT, extra: { payment: "card-captured" },
      }),
      accept_trade: () => receipt("op-accept", "accept_trade", ACCEPT_RESULT),
    });
    const caller = transport === "direct" ? scriptedCaller : new HttpProtocolAdapter(
      "http://127.0.0.1:8765",
      async (_url, init) => {
        const input = JSON.parse(String(init?.body)) as LocalCallInput;
        const body = await scriptedCaller.invokeLocalCall(input);
        return new Response(JSON.stringify(body), { status: 200, headers: echoIntegrationGateHeaders(init) });
      },
    );
    const journey = await composePrimarySeatJourney(caller, INPUT);
    expect(calls.map((call) => call.action)).toEqual(["create_event", "prepare_trade"]);
    expect(journey.composed.map((step) => step.action)).toEqual(["create_event"]);
    expect(journey.fence).toMatchObject({ outcome: "INVALID_RECEIPT", code: "GATE_STATUS", action: "prepare_trade" });
  });

  // The gate can send these after Core.execute has applied the command.
  it.each(GATE_FAILURE_STEPS.flatMap((action) => ([
    [503, "CORE_BUSY"], [500, "INTERNAL_ERROR"], [503, "DURABILITY_DIVERGENCE"],
  ] as const).map(([status, code]) => [action, status, code] as const)))(
    "keeps %s unconfirmed after a gate %i %s", async (action, status, code) => {
      const { caller, calls } = gateFailingAt(action, status, gateError(code));
      const journey = await composePrimarySeatJourney(caller, INPUT);
      const index = JOURNEY_COMPOSED_ACTIONS.indexOf(action);
      expect(calls.map((call) => call.action)).toEqual(JOURNEY_COMPOSED_ACTIONS.slice(0, index + 1));
      expect(journey.composed.map((step) => step.action)).toEqual(JOURNEY_COMPOSED_ACTIONS.slice(0, index));
      expect(journey.fence).toEqual({ outcome: "UNKNOWN", action, operationId: OPERATION_IDS[index], code, receipt: null });
    },
  );

  it.each(GATE_FAILURE_STEPS.flatMap((action) => CODELESS_FAILURES.map(([status, body]) => [action, status, body] as const)))(
    "keeps %s unconfirmed after a gate %i with no rejection code %s", async (action, status, body) => {
      const { caller, calls } = gateFailingAt(action, status, body);
      const journey = await composePrimarySeatJourney(caller, INPUT);
      const index = JOURNEY_COMPOSED_ACTIONS.indexOf(action);
      expect(calls.map((call) => call.operationId)).toEqual(OPERATION_IDS.slice(0, index + 1));
      expect(journey.composed.map((step) => step.operationId)).toEqual(OPERATION_IDS.slice(0, index));
      expect(journey.fence).toEqual({
        outcome: "INVALID_RECEIPT", action, operationId: OPERATION_IDS[index], code: "GATE_STATUS", receipt: null,
      });
    },
  );

  it.each(GATE_FAILURE_STEPS)("keeps %s unconfirmed after a non-JSON gate 500", async (action) => {
    const { caller, calls } = gateFailingAt(action, 500, "Internal Server Error");
    const journey = await composePrimarySeatJourney(caller, INPUT);
    const index = JOURNEY_COMPOSED_ACTIONS.indexOf(action);
    expect(calls.map((call) => call.operationId)).toEqual(OPERATION_IDS.slice(0, index + 1));
    expect(journey.fence).toEqual({
      outcome: "INVALID_RECEIPT", action, operationId: OPERATION_IDS[index], code: "GATE_STATUS", receipt: null,
    });
  });

  it.each([
    ...GATE_FAILURE_STEPS.flatMap((action) => [
      [action, 503, "NOT_READY", GATE_NOT_READY],
      [action, 503, "OVERLOADED", gateError("OVERLOADED")],
      [action, 503, "JOURNAL_BUDGET", gateError("JOURNAL_BUDGET")],
    ] as const),
    ["capture", 422, "TRADE_NOT_FOUND", gateError("TRADE_NOT_FOUND")] as const,
    ["commit_trade", 422, "TRADE_NOT_COMMITTABLE", gateError("TRADE_NOT_COMMITTABLE")] as const,
    // The published 422 names only error as the reject code.
    ["commit_trade", 422, "TRADE_NOT_COMMITTABLE", { error: "TRADE_NOT_COMMITTABLE" }] as const,
  ])("keeps a %s gate %i %s rejected", async (action, status, code, failure) => {
    const { caller, calls } = gateFailingAt(action, status, failure);
    const journey = await composePrimarySeatJourney(caller, INPUT);
    const index = JOURNEY_COMPOSED_ACTIONS.indexOf(action);
    expect(calls.map((call) => call.action)).toEqual(JOURNEY_COMPOSED_ACTIONS.slice(0, index + 1));
    expect(journey.composed.map((step) => step.action)).toEqual(JOURNEY_COMPOSED_ACTIONS.slice(0, index));
    expect(journey.fence).toEqual({ outcome: "REJECTED", action, operationId: OPERATION_IDS[index], code, receipt: null });
  });

  it("records the main bindings and does not map placeHold onto a new action", () => {
    expect(JOURNEY_NOT_BOUND).toEqual([
      {
        deskMethod: "placeHold",
        status: "not-bound",
        consideredAction: "reserve_listing",
        reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
        sends: false,
      },
      {
        deskMethod: "confirmBooking",
        status: "not-bound",
        consideredAction: "capture",
        reason: COMMERCE_COMMAND_BINDINGS.confirmBooking.reason,
        sends: false,
      },
      {
        deskMethod: "settlementPreview",
        status: "not-bound",
        consideredAction: "settle_capture",
        reason: COMMERCE_COMMAND_BINDINGS.settlementPreview.reason,
        sends: false,
      },
    ]);
    expect(COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction).toBe("reserve_listing");
    expect(COMMERCE_COMMAND_BINDINGS.placeHold.status).toBe("not-bound");
    expect(JOURNEY_NOT_BOUND[0]?.sends).toBe(false);
    expect(JOURNEY_NOT_BOUND[1]?.reason).toContain("does not send capture");
    expect(JOURNEY_NOT_BOUND[2]?.reason).toContain("does not send it");
  });

  it("fences the next write when the server effect is followed by a lost response", async () => {
    const createReceipt = receipt("op-create", "create_event", CREATE_RESULT);
    const applied: string[] = [];
    const caller: JourneyLocalCaller = {
      invokeLocalCall(input) {
        applied.push(`${input.action}:${input.operationId}`);
        if (input.action === "create_event") {
          return Promise.resolve(createReceipt);
        }
        if (input.action === "prepare_trade") {
          throw new ProtocolError("Integration gate response body was cut off.", "GATE_UNAVAILABLE");
        }
        throw new Error(`replacement or next write ${input.action}:${input.operationId}`);
      },
    };

    const journey = await composePrimarySeatJourney(caller, INPUT);

    expect(applied).toEqual(["create_event:op-create", "prepare_trade:op-prepare"]);
    expect(journey.composed).toEqual([
      { action: "create_event", operationId: "op-create", receipt: createReceipt },
    ]);
    expect(journey.composed[0]?.receipt).toBe(createReceipt);
    expect(journey.fence).toEqual({
      outcome: "UNKNOWN",
      action: "prepare_trade",
      operationId: "op-prepare",
      code: "GATE_UNAVAILABLE",
      receipt: null,
    });
  });

  it("treats a timeout after the request as UNKNOWN and does not mint another id", async () => {
    const caller: JourneyLocalCaller = {
      invokeLocalCall(input) {
        if (input.action === "create_event") {
          throw new ProtocolError("Integration gate did not answer.", "REQUEST_TIMEOUT");
        }
        throw new Error(`next write ${input.operationId}`);
      },
    };

    const journey = await composePrimarySeatJourney(caller, INPUT);

    expect(journey.composed).toEqual([]);
    expect(journey.fence).toMatchObject({
      outcome: "UNKNOWN",
      action: "create_event",
      operationId: "op-create",
      code: "REQUEST_TIMEOUT",
    });
  });

  it("does not continue after a rejection or an invalid success receipt", async () => {
    const rejected: JourneyLocalCaller = {
      invokeLocalCall(input) {
        if (input.action === "create_event") {
          return Promise.resolve(receipt("op-create", "create_event", CREATE_RESULT));
        }
        if (input.action === "prepare_trade") {
          throw new ProtocolError("Integration gate rejected the local call (PRIMARY_PRICE_MISMATCH).", "PRIMARY_PRICE_MISMATCH");
        }
        throw new Error(`continued after reject ${input.action}`);
      },
    };
    const rejectedJourney = await composePrimarySeatJourney(rejected, INPUT);
    expect(rejectedJourney.fence).toMatchObject({
      outcome: "REJECTED",
      action: "prepare_trade",
      operationId: "op-prepare",
      code: "PRIMARY_PRICE_MISMATCH",
      receipt: null,
    });
    expect(rejectedJourney.composed).toHaveLength(1);

    let prepares = 0;
    const invalid: JourneyLocalCaller = {
      invokeLocalCall(input) {
        if (input.action === "prepare_trade") {
          prepares += 1;
        }
        return Promise.resolve(receipt("op-create", "create_event", { eventId: "show-w6a", policyHash: "a" }));
      },
    };
    const invalidJourney = await composePrimarySeatJourney(invalid, INPUT);
    expect(prepares).toBe(0);
    expect(invalidJourney.fence).toMatchObject({
      outcome: "INVALID_RECEIPT",
      action: "create_event",
      operationId: "op-create",
      code: "GATE_STATUS",
    });
    expect(invalidJourney.fence?.receipt?.operationId).toBe("op-create");
    expect(invalidJourney.composed).toEqual([]);
  });

  it("keeps a stale correlation response off the success path", async () => {
    const caller: JourneyLocalCaller = {
      invokeLocalCall() {
        throw new ProtocolError("Integration gate response does not match this request.", "STALE_RESPONSE");
      },
    };
    const journey = await composePrimarySeatJourney(caller, INPUT);
    expect(journey.fence).toMatchObject({ outcome: "STALE_RESPONSE", code: "STALE_RESPONSE", action: "create_event" });
    expect(journey.composed).toEqual([]);
  });

  it("does not send the next body when a success receipt fails the payload guard", async () => {
    let prepares = 0;
    const caller: JourneyLocalCaller = {
      invokeLocalCall(input) {
        if (input.action === "prepare_trade") {
          prepares += 1;
        }
        return Promise.resolve(
          receipt("op-create", "create_event", {
            ...CREATE_RESULT,
            nested: { production: true },
          }),
        );
      },
    };
    const journey = await composePrimarySeatJourney(caller, INPUT);
    expect(prepares).toBe(0);
    expect(journey.fence).toMatchObject({
      outcome: "INVALID_RECEIPT",
      code: "PRODUCTION_ENDPOINT",
      action: "create_event",
      operationId: "op-create",
    });
    expect(journey.fence?.receipt?.operationId).toBe("op-create");
  });
});

describe("payload guards on published success receipts", () => {
  const successes: Array<[string, Record<string, unknown>]> = [
    ["create_event", CREATE_RESULT],
    ["prepare_trade", PREPARE_RESULT],
    ["accept_trade", ACCEPT_RESULT],
    ["open_admission", { admissionStatus: "OPEN" }],
    ["close_sales", { salesStatus: "CLOSED" }],
    ["capture", { captured: true, cashAvailable: false }],
    ["capture", { duplicate: true }],
    ["settle_capture", { settled: 100000, grossAccounted: 100000, feeBearer: "platform" }],
    ["settle_capture", { duplicate: true }],
    ["commit_trade", { ticketId: "right-seat-a", owner: "buyer", rightsVersion: 1, admissionEpoch: 1 }],
    ["admit", { admissionId: "op-admit", decision: "ADMITTED_ONCE" }],
  ];

  it("accepts catalogue success results and still rejects a desk claim inside one", () => {
    for (const [action, result] of successes) {
      const body = receipt(`op-${action}`, action, result);
      expect(() => enforceRemotePayloadGuards(body)).not.toThrow();
      expect(() => assertLocalCallReceipt(body, { action, operationId: `op-${action}` })).not.toThrow();
    }

    const claimed = receipt("op-create", "create_event", {
      ...CREATE_RESULT,
      booking: { bookingId: "b", payment: "card-captured" },
    });
    expect(() => enforceRemotePayloadGuards(claimed)).toThrow(/simulated-no-funds/);

    const rejection = { error: "TRADE_NOT_FOUND", rejected: true };
    expect(() => enforceRemotePayloadGuards(rejection)).not.toThrow();
    expect(() => assertLocalCallReceipt(rejection, { action: "prepare_trade", operationId: "op-prepare" })).toThrow(
      /not a published local-call receipt/,
    );
  });
});
