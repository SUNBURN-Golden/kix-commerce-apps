import {
  PROVIDER_SANDBOX,
  PROVIDER_STALE_CLASS_CODES,
  isProviderRef,
  refuseProviderReceipt,
  type ProviderFacet,
  type ProviderJourneyPort,
  type ProviderLateDelivery,
  type ProviderOrderView,
  type ProviderReadOutcome,
  type ProviderReceiptRefs,
  type ProviderSnapshot,
  type ProviderStep,
  type ProviderWriteOutcome,
  type ProviderWriteRequest,
} from "./provider-journey.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";

/**
 * Client side of the provider journey: the write fence, the context key, and
 * the outcome reducer. It decides what the page may send next and how to show
 * what came back. It decides nothing about payment, issuance, or refund: those
 * are the source's.
 *
 * Rules, all tested:
 *  - A write is sent once. A repeated intent, a write while another write on the
 *    same order is in flight, and any write while an unknown or late result is
 *    outstanding on that order are fenced and never reach the port.
 *  - A lost, cut-off, mis-correlated, or thrown response is UNKNOWN. UNKNOWN is
 *    not rejected and is not a success. A read, or a late result, is recorded as
 *    evidence and does not lift the fence.
 *  - A result that arrives after the context changed (actor, session
 *    incarnation) is quarantined. It does not touch the current view.
 *  - A read that declares an environment other than sandbox is refused, and a
 *    read that reports the actor unqualified fences every write.
 *  - A confirmed receipt that does not state every non-claim as literal false
 *    is untrusted, and the write is UNKNOWN.
 *  - A return landing is never a payment observation: issue and refund fence
 *    until the last read shows the payment observed.
 *  - The caller supplies each intent reference. This class never mints one.
 *  - Target fields (order, checkout, payment, expected version) are copied from
 *    the last read. They are never typed or raised by the client.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

export const PROVIDER_OUTCOMES = ["DRAFT", "IN_FLIGHT", "CONFIRMED", "REJECTED", "UNKNOWN"] as const;

export type ProviderOutcome = (typeof PROVIDER_OUTCOMES)[number];

export const PROVIDER_FRESHNESS = ["CURRENT", "STALE", "UNAVAILABLE"] as const;

export type ProviderFreshness = (typeof PROVIDER_FRESHNESS)[number];

export type ProviderRefreshCause = "own-write" | "stale-rejection" | "context-switch";

export interface ProviderContext {
  environment: "stub" | "integration-http";
  domain: string;
  /** A context label. It is not an authentication result. */
  actorRef: string;
  /** Session incarnation. Bumped when the page switches context. */
  incarnation: number;
  key: string;
}

export interface ProviderLateEvidence {
  result: "confirmed" | "rejected";
  code: string | null;
}

export interface ProviderIntent {
  seq: number;
  intentRef: string;
  step: ProviderStep;
  /** The order this write is about. Writes on one order are serialised. */
  scope: string;
  /** The order or checkout the write targets. */
  targetRef: string;
  contextKey: string;
  outcome: ProviderOutcome;
  code: string | null;
  message: string | null;
  refs: ProviderReceiptRefs | null;
  late: ProviderLateEvidence | null;
}

export interface ProviderQuarantined {
  intentRef: string;
  contextKey: string;
  /** What arrived: a port outcome kind or a late result. */
  arrived: string;
  code: string | null;
  cause: "context-changed" | "no-unknown-intent" | "different-context";
}

export type ProviderFence =
  | { reason: "in-flight"; intentRef: string }
  | { reason: "unknown-outcome"; intentRef: string; lateRecorded: boolean; earlierContext: boolean }
  | { reason: "no-snapshot" }
  | { reason: "snapshot-stale"; cause: ProviderRefreshCause }
  | { reason: "duplicate-intent"; intentRef: string }
  | { reason: "environment" }
  | { reason: "account-unqualified"; actorRef: string }
  | { reason: "payment-unobserved"; orderRef: string }
  | { reason: "not-bound" };

export type ProviderNotSentReason = "invalid-intent" | "identity" | "unknown-ref" | "tuple-changed" | "invalid-request";

export type ProviderStepInput =
  | { step: "begin"; intentRef: string; orderRef: string }
  | { step: "observe"; intentRef: string; checkoutRef: string }
  | { step: "issue"; intentRef: string; checkoutRef: string }
  | { step: "refund"; intentRef: string; orderRef: string };

export type ProviderStepResult =
  | { kind: "CONFIRMED"; intent: ProviderIntent }
  | { kind: "REJECTED"; intent: ProviderIntent }
  | { kind: "UNKNOWN"; intent: ProviderIntent }
  | { kind: "QUARANTINED"; intent: ProviderIntent }
  | { kind: "FENCED"; fence: ProviderFence }
  | { kind: "NOT_SENT"; reason: ProviderNotSentReason; detail: string };

export type ProviderReadState =
  | "none"
  | "ready"
  | "empty"
  | "stale"
  | "refused"
  | "environment-refused"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export type ProviderRefreshResult =
  | { kind: "APPLIED"; readState: ProviderReadState }
  | { kind: "DROPPED"; cause: "context-changed" | "older-read" };

export type ProviderLateResult =
  | { kind: "RECORDED"; intent: ProviderIntent }
  | { kind: "QUARANTINED"; cause: ProviderQuarantined["cause"] };

export interface ProviderCounters {
  /** Calls that reached port.submit. */
  sent: number;
  /** Writes the fence refused before the port. */
  fenced: number;
  notSent: number;
  droppedReads: number;
}

export interface ProviderControllerState {
  context: ProviderContext;
  readState: ProviderReadState;
  readDetail: string | null;
  snapshot: ProviderSnapshot | null;
  freshness: ProviderFreshness;
  refreshRequired: ProviderRefreshCause | null;
  intents: readonly ProviderIntent[];
  quarantined: readonly ProviderQuarantined[];
  counters: ProviderCounters;
}

function contextKeyOf(parts: Pick<ProviderContext, "environment" | "domain" | "actorRef" | "incarnation">): string {
  return [parts.environment, parts.domain, parts.actorRef, String(parts.incarnation)].join("|");
}

function copyIntent(intent: ProviderIntent): ProviderIntent {
  return {
    ...intent,
    refs: intent.refs === null ? null : { ...intent.refs },
    late: intent.late === null ? null : { ...intent.late },
  };
}

export class ProviderJourneyController {
  private context: ProviderContext;
  private snapshot: ProviderSnapshot | null = null;
  private readState: ProviderReadState = "none";
  private readDetail: string | null = null;
  private refreshRequired: ProviderRefreshCause | null = null;
  private floor: string | null = null;
  private readSeq = 0;
  private appliedReadSeq = 0;
  private intentSeq = 0;
  private readonly intents: ProviderIntent[] = [];
  private readonly used = new Set<string>();
  private readonly quarantined: ProviderQuarantined[] = [];
  private readonly counters: ProviderCounters = { sent: 0, fenced: 0, notSent: 0, droppedReads: 0 };
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly port: ProviderJourneyPort,
    options: { actorRef: string; incarnation?: number },
  ) {
    const incarnation = options.incarnation ?? 1;
    const parts = { environment: port.environment, domain: PINNED_PROTOCOL_DOMAIN, actorRef: options.actorRef, incarnation };
    this.context = { ...parts, key: contextKeyOf(parts) };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      listener();
    }
  }

  state(): ProviderControllerState {
    let freshness: ProviderFreshness = "UNAVAILABLE";
    if (this.readState === "ready" || this.readState === "empty") {
      freshness = this.refreshRequired === null ? "CURRENT" : "STALE";
    } else if (this.readState === "stale") {
      freshness = "STALE";
    }
    return {
      context: { ...this.context },
      readState: this.readState,
      readDetail: this.readDetail,
      snapshot: this.snapshot,
      freshness,
      refreshRequired: this.refreshRequired,
      intents: this.intents.map(copyIntent),
      quarantined: this.quarantined.map((item) => ({ ...item })),
      counters: { ...this.counters },
    };
  }

  /**
   * Starts a new context: another actor, or a new session incarnation. A write
   * that is in flight becomes UNKNOWN, because its result will arrive in a
   * context this controller has left. The snapshot is dropped. Fences stay: an
   * unknown outcome on an order still blocks that order, whichever context asks.
   */
  switchContext(next: { actorRef?: string } = {}): ProviderContext {
    const parts = {
      environment: this.context.environment,
      domain: this.context.domain,
      actorRef: next.actorRef ?? this.context.actorRef,
      incarnation: this.context.incarnation + 1,
    };
    this.context = { ...parts, key: contextKeyOf(parts) };
    for (const intent of this.intents) {
      if (intent.outcome === "IN_FLIGHT") {
        intent.outcome = "UNKNOWN";
        intent.code = "CONTEXT_SWITCHED";
        intent.message = "The session context changed while this write was in flight. Its result is not applied.";
      }
    }
    this.snapshot = null;
    this.readState = "none";
    this.readDetail = null;
    this.refreshRequired = "context-switch";
    this.notify();
    return { ...this.context };
  }

  /** Explicit read. A read is evidence. It never resolves an unknown write. */
  async refresh(): Promise<ProviderRefreshResult> {
    const key = this.context.key;
    this.readSeq += 1;
    const seq = this.readSeq;
    let outcome: ProviderReadOutcome;
    try {
      outcome = await this.port.read({ contextKey: key, actorRef: this.context.actorRef, watermarkFloor: this.floor });
    } catch (error) {
      outcome = { kind: "unknown", message: error instanceof Error ? error.message : "The read failed." };
    }
    if (key !== this.context.key) {
      this.counters.droppedReads += 1;
      this.notify();
      return { kind: "DROPPED", cause: "context-changed" };
    }
    if (seq < this.appliedReadSeq) {
      this.counters.droppedReads += 1;
      this.notify();
      return { kind: "DROPPED", cause: "older-read" };
    }
    this.appliedReadSeq = seq;
    switch (outcome.kind) {
      case "ready":
        if (outcome.snapshot.environment.providerEnvironment !== PROVIDER_SANDBOX) {
          this.snapshot = null;
          this.readState = "environment-refused";
          this.readDetail =
            "The source declares a production environment. This desk serves the sandbox only, so nothing was read and nothing was applied.";
          break;
        }
        this.snapshot = outcome.snapshot;
        this.readState = "ready";
        this.readDetail = null;
        this.refreshRequired = null;
        this.floor = outcome.snapshot.watermark;
        break;
      case "empty":
        this.snapshot = null;
        this.readState = "empty";
        this.readDetail = null;
        this.refreshRequired = null;
        break;
      case "stale":
        this.snapshot = null;
        this.readState = "stale";
        this.readDetail = `Watermark ${outcome.watermark} is older than the floor ${outcome.floor}.`;
        break;
      case "refused":
        this.snapshot = null;
        this.readState = "refused";
        this.readDetail = outcome.detail;
        break;
      case "tuple-changed":
        this.snapshot = null;
        this.readState = "tuple-changed";
        this.readDetail = `The pin tuple field ${outcome.field} changed.`;
        break;
      case "not-bound":
        this.snapshot = null;
        this.readState = "not-bound";
        this.readDetail = outcome.reason;
        break;
      case "unknown":
        this.snapshot = null;
        this.readState = "unavailable";
        this.readDetail = outcome.message;
        break;
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
    this.notify();
    return { kind: "APPLIED", readState: this.readState };
  }

  /** Why this write cannot go out now, or null. This is the single gate `run` uses. */
  gateFor(input: ProviderStepInput): ProviderFence | null {
    if (this.port.source === "none") {
      return { reason: "not-bound" };
    }
    if (this.used.has(input.intentRef)) {
      return { reason: "duplicate-intent", intentRef: input.intentRef };
    }
    const scope = this.scopeOf(input);
    const open = this.intents.filter((intent) => scope === null || intent.scope === scope);
    const flying = open.find((intent) => intent.outcome === "IN_FLIGHT");
    if (flying) {
      return { reason: "in-flight", intentRef: flying.intentRef };
    }
    const unknown = open.find((intent) => intent.outcome === "UNKNOWN");
    if (unknown) {
      return {
        reason: "unknown-outcome",
        intentRef: unknown.intentRef,
        lateRecorded: unknown.late !== null,
        earlierContext: unknown.contextKey !== this.context.key,
      };
    }
    if (this.readState === "environment-refused") {
      return { reason: "environment" };
    }
    if (this.snapshot === null) {
      return this.refreshRequired !== null ? { reason: "snapshot-stale", cause: this.refreshRequired } : { reason: "no-snapshot" };
    }
    if (this.refreshRequired !== null) {
      return { reason: "snapshot-stale", cause: this.refreshRequired };
    }
    if (this.snapshot.environment.account.qualification !== "sandbox-qualified") {
      return { reason: "account-unqualified", actorRef: this.snapshot.environment.account.actorRef };
    }
    if (input.step === "issue" || input.step === "refund") {
      const order = this.orderOf(input);
      if (order && order.payment.state !== "observed") {
        return { reason: "payment-unobserved", orderRef: order.orderRef };
      }
    }
    return null;
  }

  private orderOf(input: ProviderStepInput): ProviderOrderView | undefined {
    if (this.snapshot === null) {
      return undefined;
    }
    if (input.step === "observe" || input.step === "issue") {
      return this.snapshot.orders.find((order) => order.checkout?.checkoutRef === input.checkoutRef);
    }
    return this.snapshot.orders.find((order) => order.orderRef === input.orderRef);
  }

  private scopeOf(input: ProviderStepInput): string | null {
    if (input.step === "observe" || input.step === "issue") {
      return this.orderOf(input)?.orderRef ?? null;
    }
    return input.orderRef;
  }

  /**
   * Sends one write, once. The result is a receipt-shaped outcome or a reason it was
   * not sent. Nothing here sends a second time, mints an intent, or compensates.
   */
  async run(input: ProviderStepInput): Promise<ProviderStepResult> {
    const shape = this.checkShape(input);
    if (shape !== null) {
      this.counters.notSent += 1;
      this.notify();
      return shape;
    }
    const fence = this.gateFor(input);
    if (fence !== null) {
      this.counters.fenced += 1;
      this.notify();
      return { kind: "FENCED", fence };
    }
    const built = this.buildRequest(input);
    if (built.kind === "NOT_SENT") {
      this.counters.notSent += 1;
      this.notify();
      return built;
    }
    const { request, scope, targetRef } = built;
    this.used.add(input.intentRef);
    this.intentSeq += 1;
    const intent: ProviderIntent = {
      seq: this.intentSeq,
      intentRef: input.intentRef,
      step: input.step,
      scope,
      targetRef,
      contextKey: this.context.key,
      outcome: "IN_FLIGHT",
      code: null,
      message: null,
      refs: null,
      late: null,
    };
    this.intents.push(intent);
    this.counters.sent += 1;
    this.notify();
    let outcome: ProviderWriteOutcome;
    try {
      outcome = await this.port.submit(request);
    } catch (error) {
      outcome = {
        kind: "unknown",
        step: input.step,
        intentRef: input.intentRef,
        contextKey: request.contextKey,
        message: error instanceof Error ? error.message : "The write failed after it was sent.",
      };
    }
    return this.settle(intent, outcome);
  }

  private checkShape(input: ProviderStepInput): Extract<ProviderStepResult, { kind: "NOT_SENT" }> | null {
    if (typeof input.intentRef !== "string" || input.intentRef.trim().length === 0) {
      return { kind: "NOT_SENT", reason: "invalid-intent", detail: "A write carries an intent reference chosen by the caller." };
    }
    if (input.step === "observe" || input.step === "issue") {
      if (!isProviderRef(input.checkoutRef, "checkout")) {
        return { kind: "NOT_SENT", reason: "identity", detail: `A ${input.step} targets a checkout reference, not an order, payment, or right.` };
      }
      return null;
    }
    if (!isProviderRef(input.orderRef, "order")) {
      return { kind: "NOT_SENT", reason: "identity", detail: `A ${input.step} targets an order reference, not a checkout, payment, or right.` };
    }
    return null;
  }

  private buildRequest(
    input: ProviderStepInput,
  ):
    | { kind: "BUILT"; request: ProviderWriteRequest; scope: string; targetRef: string }
    | Extract<ProviderStepResult, { kind: "NOT_SENT" }> {
    const snapshot = this.snapshot;
    if (snapshot === null) {
      return { kind: "NOT_SENT", reason: "unknown-ref", detail: "No read to copy the target fields from." };
    }
    const order = this.orderOf(input);
    if (!order) {
      const target = input.step === "observe" || input.step === "issue" ? input.checkoutRef : input.orderRef;
      return { kind: "NOT_SENT", reason: "unknown-ref", detail: `${target} is not in the last read.` };
    }
    const base = {
      contextKey: this.context.key,
      actorRef: this.context.actorRef,
      intentRef: input.intentRef,
      declaredEnvironment: PROVIDER_SANDBOX,
      orderRef: order.orderRef,
      expectedVersion: order.version,
    };
    if (input.step === "begin") {
      return { kind: "BUILT", scope: order.orderRef, targetRef: order.orderRef, request: { ...base, step: "begin" } };
    }
    if (input.step === "observe" || input.step === "issue") {
      const checkoutRef = order.checkout?.checkoutRef;
      if (checkoutRef !== input.checkoutRef) {
        return { kind: "NOT_SENT", reason: "unknown-ref", detail: `Checkout ${input.checkoutRef} is not in the last read.` };
      }
      return { kind: "BUILT", scope: order.orderRef, targetRef: checkoutRef, request: { ...base, step: input.step, checkoutRef } };
    }
    const paymentRef = order.payment.paymentRef;
    if (paymentRef === null) {
      return { kind: "NOT_SENT", reason: "unknown-ref", detail: `Order ${order.orderRef} has no payment observation in the last read.` };
    }
    return { kind: "BUILT", scope: order.orderRef, targetRef: order.orderRef, request: { ...base, step: "refund", paymentRef } };
  }

  private settle(intent: ProviderIntent, outcome: ProviderWriteOutcome): ProviderStepResult {
    if (intent.outcome !== "IN_FLIGHT") {
      this.quarantined.push({
        intentRef: intent.intentRef,
        contextKey: intent.contextKey,
        arrived: outcome.kind,
        code: outcome.kind === "rejected" || outcome.kind === "invalid-request" ? outcome.code : null,
        cause: "context-changed",
      });
      this.notify();
      return { kind: "QUARANTINED", intent: copyIntent(intent) };
    }
    const correlated =
      outcome.kind === "not-bound" || (outcome.intentRef === intent.intentRef && outcome.contextKey === intent.contextKey);
    if (!correlated) {
      intent.outcome = "UNKNOWN";
      intent.code = "CORRELATION";
      intent.message = "The result named a different intent or context than the one sent.";
      this.notify();
      return { kind: "UNKNOWN", intent: copyIntent(intent) };
    }
    switch (outcome.kind) {
      case "confirmed": {
        const untrusted = refuseProviderReceipt(outcome.nonClaims);
        if (untrusted !== null) {
          intent.outcome = "UNKNOWN";
          intent.code = "UNTRUSTED_RECEIPT";
          intent.message = `The confirmed answer does not state ${untrusted.field} as false. The write may or may not have applied.`;
          this.notify();
          return { kind: "UNKNOWN", intent: copyIntent(intent) };
        }
        intent.outcome = "CONFIRMED";
        intent.refs = { ...outcome.refs };
        this.refreshRequired = this.refreshRequired ?? "own-write";
        this.notify();
        return { kind: "CONFIRMED", intent: copyIntent(intent) };
      }
      case "rejected":
        intent.outcome = "REJECTED";
        intent.code = outcome.code;
        intent.message = outcome.detail;
        if (PROVIDER_STALE_CLASS_CODES.includes(outcome.code)) {
          this.refreshRequired = this.refreshRequired ?? "stale-rejection";
        }
        this.notify();
        return { kind: "REJECTED", intent: copyIntent(intent) };
      case "unknown":
        intent.outcome = "UNKNOWN";
        intent.code = "RESPONSE_LOST";
        intent.message = outcome.message;
        this.notify();
        return { kind: "UNKNOWN", intent: copyIntent(intent) };
      case "tuple-changed":
        intent.outcome = "DRAFT";
        intent.code = "TUPLE_CHANGED";
        intent.message = `The pin tuple field ${outcome.field} changed. Nothing was applied.`;
        this.counters.notSent += 1;
        this.notify();
        return { kind: "NOT_SENT", reason: "tuple-changed", detail: intent.message };
      case "invalid-request":
        intent.outcome = "DRAFT";
        intent.code = outcome.code;
        intent.message = outcome.detail;
        this.counters.notSent += 1;
        this.notify();
        return { kind: "NOT_SENT", reason: "invalid-request", detail: outcome.detail };
      case "not-bound":
        intent.outcome = "DRAFT";
        intent.code = "NOT_BOUND";
        intent.message = outcome.reason;
        this.counters.notSent += 1;
        this.notify();
        return { kind: "NOT_SENT", reason: "invalid-request", detail: outcome.reason };
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  }

  /**
   * Records a late result against the unknown write it answers. The write stays
   * UNKNOWN and its fence stays. A late result for another context, or for a write
   * that is not unknown, is quarantined and changes nothing.
   */
  acceptLate(delivery: ProviderLateDelivery): ProviderLateResult {
    const intent = this.intents.find((item) => item.intentRef === delivery.intentRef);
    if (!intent || intent.outcome !== "UNKNOWN") {
      return this.quarantineLate(delivery, "no-unknown-intent");
    }
    if (delivery.contextKey !== this.context.key || intent.contextKey !== this.context.key) {
      return this.quarantineLate(delivery, "different-context");
    }
    intent.late = { result: delivery.result, code: delivery.code };
    this.notify();
    return { kind: "RECORDED", intent: copyIntent(intent) };
  }

  private quarantineLate(delivery: ProviderLateDelivery, cause: ProviderQuarantined["cause"]): ProviderLateResult {
    this.quarantined.push({
      intentRef: delivery.intentRef,
      contextKey: delivery.contextKey,
      arrived: `late-${delivery.result}`,
      code: delivery.code,
      cause,
    });
    this.notify();
    return { kind: "QUARANTINED", cause };
  }
}

// ---------------------------------------------------------------------------
// Projection: five independent lines per order, from intents and a read
// ---------------------------------------------------------------------------

export const PROVIDER_ORDER_SHAPES = [
  "none",
  "checkout-open",
  "returned-unobserved",
  "abandoned",
  "payment-declined",
  "payment-observed",
  "issued",
  "refund-recorded",
  "unknown-effect",
] as const;

export type ProviderOrderShape = (typeof PROVIDER_ORDER_SHAPES)[number];

export interface ProviderFacetObservation {
  /** What the last read saw on this line. Observation is not the page's receipt. */
  state: string;
  ref: string | null;
  code: string | null;
  note: string;
}

export interface ProviderFacetView {
  facet: ProviderFacet;
  /**
   * This page's own write outcome on the line. Null when this page sent nothing
   * on it. The return line has no write at all, so it is NOT_BOUND.
   */
  outcome: ProviderOutcome | "NOT_BOUND" | null;
  code: string | null;
  intentRef: string | null;
  lateRecorded: boolean;
  observed: ProviderFacetObservation | null;
}

export interface ProviderOrderProjection {
  orderRef: string;
  /** True only when a confirmed begin receipt of this page named this order's checkout. */
  linked: boolean;
  amount: string | null;
  currency: string;
  version: number;
  facets: Readonly<Record<ProviderFacet, ProviderFacetView>>;
  shape: ProviderOrderShape;
  identities: Readonly<
    Record<"order" | "checkout" | "return" | "callback" | "payment" | "issuance" | "right" | "refund", string | null>
  >;
}

export interface ProviderProjection {
  orders: readonly ProviderOrderProjection[];
  /** Writes of this page with no checkout to show. A lost begin lands here. */
  unlinkedIntents: readonly ProviderIntent[];
  freshness: ProviderFreshness;
}

function facetOutcomeFrom(intent: ProviderIntent | undefined): Pick<ProviderFacetView, "outcome" | "code" | "intentRef" | "lateRecorded"> {
  if (!intent) {
    return { outcome: null, code: null, intentRef: null, lateRecorded: false };
  }
  return { outcome: intent.outcome, code: intent.code, intentRef: intent.intentRef, lateRecorded: intent.late !== null };
}

function shapeOf(order: ProviderOrderView, open: boolean): ProviderOrderShape {
  if (open) {
    return "unknown-effect";
  }
  if (order.checkout === null) {
    return "none";
  }
  if (order.checkout.state === "abandoned") {
    return "abandoned";
  }
  if (order.payment.state === "declined") {
    return "payment-declined";
  }
  if (order.refund.state === "recorded") {
    return "refund-recorded";
  }
  if (order.issuance.state === "issued") {
    return "issued";
  }
  if (order.payment.state === "observed") {
    return "payment-observed";
  }
  if (order.checkout.state === "returned") {
    return "returned-unobserved";
  }
  return "checkout-open";
}

export function projectProvider(state: ProviderControllerState): ProviderProjection {
  const snapshot = state.snapshot;
  const confirmedBegins = state.intents.filter((intent) => intent.step === "begin" && intent.outcome === "CONFIRMED");
  const linkedCheckouts = new Set(confirmedBegins.map((intent) => intent.refs?.checkoutRef ?? ""));
  const orders: ProviderOrderProjection[] = [];
  const explained = new Set<string>();
  for (const order of snapshot ? snapshot.orders : []) {
    const checkoutRef = order.checkout?.checkoutRef ?? null;
    const beginIntent = confirmedBegins.find((intent) => intent.refs?.checkoutRef === checkoutRef);
    const observeIntent = [...state.intents]
      .reverse()
      .find((intent) => intent.step === "observe" && intent.targetRef === checkoutRef && checkoutRef !== null);
    const issueIntent = [...state.intents]
      .reverse()
      .find((intent) => intent.step === "issue" && intent.targetRef === checkoutRef && checkoutRef !== null);
    const refundIntent = [...state.intents].reverse().find((intent) => intent.step === "refund" && intent.scope === order.orderRef);
    for (const intent of [beginIntent, observeIntent, issueIntent, refundIntent]) {
      if (intent) {
        explained.add(intent.intentRef);
      }
    }
    const open = [observeIntent, issueIntent, refundIntent].some(
      (intent) => intent !== undefined && (intent.outcome === "UNKNOWN" || intent.outcome === "IN_FLIGHT"),
    );
    orders.push({
      orderRef: order.orderRef,
      linked: checkoutRef !== null && linkedCheckouts.has(checkoutRef),
      amount: order.amount,
      currency: order.currency,
      version: order.version,
      facets: {
        redirect: {
          facet: "redirect",
          ...facetOutcomeFrom(beginIntent),
          observed: {
            state: order.checkout === null ? "none" : order.checkout.state,
            ref: checkoutRef,
            code: null,
            note:
              order.checkout === null
                ? "No checkout is recorded for this order."
                : order.checkout.state === "open"
                  ? "A checkout is open. The redirect is out and the buyer has not returned."
                  : order.checkout.state === "returned"
                    ? "The buyer returned to this checkout."
                    : "The provider closed this checkout after the buyer left.",
          },
        },
        return: {
          facet: "return",
          outcome: "NOT_BOUND",
          code: null,
          intentRef: null,
          lateRecorded: false,
          observed: {
            state: order.checkout === null ? "none" : order.checkout.returnRef === null ? "none" : "landed",
            ref: order.checkout?.returnRef ?? null,
            code: null,
            note:
              order.checkout === null
                ? "No checkout is recorded for this order."
                : order.checkout.returnRef === null
                  ? "No return landing is recorded. A return landing is a source event, not a write of this page."
                  : "A return landing is recorded. It is not a payment observation.",
          },
        },
        payment: {
          facet: "payment",
          ...facetOutcomeFrom(observeIntent),
          observed: {
            state: order.payment.state,
            ref: order.payment.paymentRef,
            code: null,
            note: order.payment.note,
          },
        },
        issuance: {
          facet: "issuance",
          ...facetOutcomeFrom(issueIntent),
          observed: {
            state: order.issuance.state,
            ref: order.issuance.issuanceRef,
            code: null,
            note:
              order.issuance.state === "issued"
                ? "An issuance record and a right reference are recorded. They are synthetic rows, not a real right."
                : "No issuance is recorded.",
          },
        },
        refund: {
          facet: "refund",
          ...facetOutcomeFrom(refundIntent),
          observed: {
            state: order.refund.state,
            ref: order.refund.refundRef,
            code: null,
            note: order.refund.note,
          },
        },
      },
      shape: shapeOf(order, open),
      identities: {
        order: order.orderRef,
        checkout: checkoutRef,
        return: order.checkout?.returnRef ?? null,
        callback: order.payment.callbackRef,
        payment: order.payment.paymentRef,
        issuance: order.issuance.issuanceRef,
        right: order.issuance.rightRef,
        refund: order.refund.refundRef,
      },
    });
  }
  const unlinkedIntents = state.intents
    .filter(
      (intent) =>
        !explained.has(intent.intentRef) &&
        intent.outcome !== "CONFIRMED" &&
        intent.outcome !== "REJECTED" &&
        intent.outcome !== "DRAFT",
    )
    .map(copyIntent);
  return { orders, unlinkedIntents, freshness: state.freshness };
}

/** Lines in display order. An order never collapses them into one state. */
export function providerFacetList(order: ProviderOrderProjection): readonly ProviderFacetView[] {
  return (["redirect", "return", "payment", "issuance", "refund"] as const).map((facet) => order.facets[facet]);
}
