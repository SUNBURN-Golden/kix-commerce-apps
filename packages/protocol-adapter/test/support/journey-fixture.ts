import { BookingJourney, type JourneyStep, type JourneyStepOutcome, type LocalCallInvoker } from "../../src/index.js";
import type { LocalCallInput } from "../../src/local-call.js";
import { localCallReceipt } from "./receipt.js";

/**
 * Same policy object the existing journey tests send. The helper does not
 * default these fields, and this fixture does not either.
 */
export const SHOW_POLICY = {
  primaryPrice: 100000,
  resaleCap: 150000,
  primaryFeeBps: 500,
  resaleFeeBps: 300,
  resaleOrganizerBps: 200,
  resaleAllowed: true,
  refundProfile: "FULL_CHAIN_UNWIND_FIXTURE",
};

/** Caller-supplied buyer id used by both the stub report and the live report. */
export const JOURNEY_BUYER = "buyer-a";

export interface StepReportRow {
  step: JourneyStep;
  outcome: "RECEIPT";
  action: string;
  /** `operator`, or `buyer` for the caller-supplied buyer id. */
  actor: "operator" | "buyer";
  /** Sorted key names only. Values stay out so gate ids and hashes can differ. */
  bodyKeys: string[];
  resultKeys: string[];
}

/**
 * Golden step sequence for create_event, prepare_trade, accept_trade.
 * Keys are names only, sorted, with no values.
 */
export const EXPECTED_STEP_REPORT: StepReportRow[] = [
  {
    step: "create_event",
    outcome: "RECEIPT",
    action: "create_event",
    actor: "operator",
    bodyKeys: ["domain", "eventId", "organizer", "policy", "seats"],
    resultKeys: ["eventId", "inventoryIds", "policyHash", "reservationSeconds"],
  },
  {
    step: "prepare_trade",
    outcome: "RECEIPT",
    action: "prepare_trade",
    actor: "buyer",
    bodyKeys: ["amount", "buyer", "domain", "expectedInventoryVersion", "expectedVersion", "inventoryId", "tradeId"],
    resultKeys: ["externalOrderId", "status", "termsHash", "ticketId", "tradeId"],
  },
  {
    step: "accept_trade",
    outcome: "RECEIPT",
    action: "accept_trade",
    actor: "buyer",
    bodyKeys: ["domain", "termsHash", "tradeId"],
    resultKeys: ["accepted"],
  },
];

/**
 * Test-only shape fixture. It copies eventId and tradeId from the request and
 * indexes inventoryIds by seat. Hash fields are fixed literals. This is not
 * kernel, settlement, or receipt math, and it is not the shipped stub.
 */
export function stubJourneyInvoker(seen: LocalCallInput[]): LocalCallInvoker {
  return {
    async invokeLocalCall(input) {
      seen.push(structuredClone(input));
      if (!isRecord(input.body)) {
        throw new Error("stub journey fixture expected an object body");
      }
      return localCallReceipt(input.operationId, input.action, shapeResult(input.action, input.body));
    },
  };
}

export function journeyStepReport(seen: LocalCallInput[], outcomes: JourneyStepOutcome[]): StepReportRow[] {
  if (seen.length !== outcomes.length) {
    throw new Error("journey step report needs one call per outcome");
  }
  return outcomes.map((outcome, index) => {
    const call = seen[index];
    if (outcome.kind !== "RECEIPT" || call === undefined || !isRecord(call.body)) {
      throw new Error("journey step report is for receipt rows");
    }
    if (!isRecord(outcome.receipt.result)) {
      throw new Error("journey step report needs a result object");
    }
    if (call.action !== outcome.step) {
      throw new Error("journey step report action does not match the outcome");
    }
    return {
      step: outcome.step,
      outcome: "RECEIPT",
      action: call.action,
      actor: call.actor === "operator" ? "operator" : "buyer",
      bodyKeys: Object.keys(call.body).sort(),
      resultKeys: Object.keys(outcome.receipt.result).sort(),
    };
  });
}

export async function runComposedJourney(
  journey: BookingJourney,
  ids: {
    eventId: string;
    tradeId: string;
    createOperationId: string;
    prepareOperationId: string;
    acceptOperationId: string;
  },
): Promise<JourneyStepOutcome[]> {
  const created = await journey.createEvent({
    operationId: ids.createOperationId,
    eventId: ids.eventId,
    organizer: "organizer",
    policy: SHOW_POLICY,
    seats: ["A1"],
  });
  const prepared = await journey.prepareTrade({
    operationId: ids.prepareOperationId,
    tradeId: ids.tradeId,
    buyer: JOURNEY_BUYER,
  });
  const accepted = await journey.acceptTrade({ operationId: ids.acceptOperationId });
  return [created, prepared, accepted];
}

function shapeResult(action: string, body: Record<string, unknown>): Record<string, unknown> {
  if (action === "create_event") {
    const seats = Array.isArray(body.seats) ? body.seats : [];
    return {
      eventId: body.eventId,
      policyHash: "policy-hash",
      inventoryIds: seats.map((_, index) => `inv-${index}`),
      reservationSeconds: 900,
    };
  }
  if (action === "prepare_trade") {
    return {
      tradeId: body.tradeId,
      ticketId: "ticket-1",
      externalOrderId: "order-1",
      status: "PREPARED",
      termsHash: "terms-hash",
    };
  }
  if (action === "accept_trade") {
    return { accepted: true };
  }
  throw new Error(`stub journey fixture does not fabricate ${action}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
