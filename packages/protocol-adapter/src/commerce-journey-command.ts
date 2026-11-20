import { MARKET_FIXTURE } from "./resale-journey-fixture.js";
import { JOURNEY_FIXTURE, JOURNEY_READS } from "./commerce-journey-fixture.js";
import { isRecord } from "./record.js";
import { ProtocolError } from "./types.js";

export type CommerceJourneyStep = Exclude<keyof typeof JOURNEY_FIXTURE, "replay-consume-B"> | "cancel-after-payment";
export type FixtureStep = CommerceJourneyStep | keyof typeof MARKET_FIXTURE;
export type CommerceJourneyRead = (typeof JOURNEY_READS)[number];
export type JourneyValue = string | number | boolean | null;
export type JourneyProof = Readonly<Record<string, JourneyValue>>;
export type JourneyLinks = Readonly<Record<string, JourneyValue>>;
export interface CommerceJourneyCall<Step extends FixtureStep = FixtureStep> {
  readonly step: Step;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly links: JourneyLinks;
}

export interface CommerceJourneyPort<Step extends FixtureStep = FixtureStep> {
  advanceCommerceJourney(input: CommerceJourneyCall<Step>): Promise<JourneyProof>;
}

export type CommerceJourneyNotBound = { kind: "NOT_BOUND"; query: CommerceJourneyRead; reason: string };
export function commerceJourneyRead(query: CommerceJourneyRead): CommerceJourneyNotBound {
  return { kind: "NOT_BOUND", query, reason: `${query}: no read endpoint at the pinned gate` };
}

/** Links come from separately confirmed receipts, never the uncertain request. */
export const RECEIPT_LINKS: Partial<Record<FixtureStep, readonly string[]>> = {
  "market-reserve": ["show_id"], "market-order": ["reservation_id"], "market-primary-payment": ["order_id", "amount"],
  "market-issue": ["order_id"], "market-adopt": ["show_id", "reservation_id", "order_id", "amount", "quote_ref", "payment_ref", "right_id", "buyer_role"],
  "market-list": ["right_id", "reservation_id", "version", "seller_role"], "market-hold": ["listing_id", "buyer_role"],
  "market-pay": ["listing_id", "amount", "buyer_role"], "market-accept": ["listing_id"], "market-cancel": ["listing_id","seller_role"],
  "hold-over-capacity": ["show_id"], "hold-occupied-slot": ["show_id"],
  "issue-cancelled": ["order_id"], "double-consume": ["right_id", "version", "gate_role", "request"],
  "reserve-A": ["show_id"], "reserve-B": ["show_id"], "reserve-C": ["show_id"],
  "order-A": ["reservation_id"], "order-B": ["reservation_id"], "order-C": ["reservation_id"],
  "payment-A": ["order_id", "amount"], "payment-B": ["order_id", "amount"],
  "issue-A": ["order_id"], "issue-B": ["order_id"],
  "cancel-C": ["reservation_id"], "cancel-after-payment": ["reservation_id"],
  "adopt-A": ["show_id", "reservation_id", "right_id", "order_id", "amount", "payment_ref", "quote_ref"],
  "adopt-B": ["show_id", "reservation_id", "right_id", "order_id", "amount", "payment_ref", "quote_ref"],
  "list-A": ["right_id", "version", "reservation_id"],
  "hold-A": ["listing_id"], "resale-payment-A": ["listing_id"],
  "settle-resale-authorize": ["settlement_id"], "settle-resale-capture": ["settlement_id"],
  "bind-resale": ["settlement_id", "listing_id"], "accept-A-before-commit": ["listing_id"],
  "settle-resale-commit": ["settlement_id"], "accept-A": ["listing_id"], "distribute-resale": ["settlement_id"],
  "authorize-B": ["right_id", "version"], "consume-B": ["right_id", "version", "gate_role", "request"],
  "settle-cancel": ["settlement_id"], "settle-fail": ["settlement_id"],
  "settle-refund-authorize": ["settlement_id"], "settle-refund-capture": ["settlement_id"],
  "bind-refund": ["settlement_id"], "observe-mock-acceptance": ["settlement_id"],
};

const PROOF_LINKS: Partial<Record<FixtureStep, Record<string, string>>> = {
  "market-show": { show_id: "show.show_id" },
  "market-reserve": { reservation_id: "reservation.reservation_id" },
  "market-order": { order_id: "reservation.order_id", amount: "reservation.amount", quote_ref: "reservation.quote_ref" },
  "market-primary-payment": { payment_ref: "reservation.payment_ref" },
  "market-issue": { right_id: "evidence.right_id", buyer_role: "evidence.holder_role" },
  "market-adopt": { right_id: "ticket.right_id", version: "ticket.version", seller_role: "ticket.holder_role" },
  "market-list": { listing_id: "listing.listing_id", amount: "listing.amount", seller_role: "listing.seller_role", buyer_role: "listing.recipient_role" },
  "market-hold": { buyer_role: "listing.buyer_role" },
  "register-show": { show_id: "show.show_id" },
  "reserve-A": { reservation_id: "reservation.reservation_id" },
  "reserve-B": { reservation_id: "reservation.reservation_id" },
  "reserve-C": { reservation_id: "reservation.reservation_id" },
  "order-A": { order_id: "reservation.order_id", amount: "reservation.amount", quote_ref: "reservation.quote_ref" },
  "order-B": { order_id: "reservation.order_id", amount: "reservation.amount", quote_ref: "reservation.quote_ref" },
  "order-C": { order_id: "reservation.order_id" },
  "payment-A": { payment_ref: "reservation.payment_ref" },
  "payment-B": { payment_ref: "reservation.payment_ref" },
  "issue-A": { right_id: "evidence.right_id", version: "evidence.version" },
  "issue-B": { right_id: "evidence.right_id", version: "evidence.version" },
  "list-A": { listing_id: "listing.listing_id" },
  "authorize-B": { gate_role: "admission.gate_role", request: "admission.request", version: "admission.version" },
  "settle-resale-initiate": { settlement_id: "settlement.settlement_id" },
  "settle-cancel-initiate": { settlement_id: "settlement.settlement_id" },
  "settle-fail-initiate": { settlement_id: "settlement.settlement_id" },
  "settle-refund-initiate": { settlement_id: "settlement.settlement_id" },
};

const fixtures = { ...JOURNEY_FIXTURE, ...MARKET_FIXTURE };
export const FIXTURE_ACTOR = "commerce-journey-fixture";

export function fixtureTemplate(step: FixtureStep) {
  return fixtures[step === "cancel-after-payment" ? "cancel-C" : step];
}

export function declaredRefusal(step: FixtureStep): string | undefined {
  if (step === "cancel-after-payment") return "COMPENSATION_UNDEFINED";
  const expectation = fixtures[step][2];
  return typeof expectation === "string" ? expectation : undefined;
}

export function commandFor(input: CommerceJourneyCall): {
  operationId: string; actor: string; action: (typeof fixtures)[keyof typeof fixtures][0];
  body: Record<string, unknown>; expectation: JourneyProof | string;
} {
  const { step, links, operationId, idempotencyKey } = input;
  if (![operationId, idempotencyKey].every((id) => typeof id === "string" && id.length > 0 && id.length <= 100 && id.trim() === id && !id.includes(",")) ||
      operationId === idempotencyKey) {
    throw new ProtocolError("The fixture requires two distinct attempt identifiers.", "INVALID_ID");
  }
  const [action, template, expectation] = fixtureTemplate(step);
  const body: Record<string, unknown> = { ...template, idempotency_key: idempotencyKey };
  for (const field of RECEIPT_LINKS[step] ?? []) {
    const expected = step === "cancel-after-payment" ? links.reservation_id : body[field];
    if (links[field] === undefined || links[field] !== expected ||
        (step === "cancel-after-payment" && links[field] !== "reserve-A" && links[field] !== "reserve-B")) {
      throw new ProtocolError("A confirmed fixture receipt is required for the next step.", "STALE_CONTEXT");
    }
    body[field] = links[field];
  }
  return {
    operationId, actor: FIXTURE_ACTOR, action, body,
    expectation: declaredRefusal(step) ?? expectation,
  };
}

export function valueAt(receipt: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => isRecord(value) ? value[key] : undefined, receipt);
}

export function proofPaths(step: FixtureStep, expectation: JourneyProof): string[] {
  return [...new Set([...Object.keys(expectation), ...Object.values(PROOF_LINKS[step] ?? {})])];
}

export function collectLinks(step: FixtureStep, proof: JourneyProof): JourneyLinks {
  return Object.fromEntries(Object.entries(PROOF_LINKS[step] ?? {}).map(([field, path]) => [field, proof[path]]));
}

export const READS = JOURNEY_READS;
