import {
  REFUND_STALE_CLASS_CODES,
  REFUND_STEP_LINES,
  isRefundRef,
  refuseRefundReceipt,
  type RefundFlowLine,
  type RefundLateDelivery,
  type RefundReadOutcome,
  type RefundReceiptRefs,
  type RefundReturnPort,
  type RefundSnapshot,
  type RefundStep,
  type RefundWriteOutcome,
  type RefundWriteRequest,
} from "./refund-return.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";

/**
 * Client side of the refund-and-return desk: the write fence, the context
 * key, and the outcome reducer. It decides what the page may send next and
 * how to show what came back. It decides nothing about reservation, payment,
 * issuance, return, or refund state: those are the source's.
 *
 * Rules, all tested:
 *  - A write is sent once. A repeated intent, a write while another write on
 *    the order is in flight, and any write while an unknown or late result is
 *    outstanding on the order are fenced and never reach the port.
 *  - A lost, cut-off, mis-correlated, or thrown response is UNKNOWN. UNKNOWN
 *    is not rejected and is not a success. A read, or a late result, is
 *    recorded as evidence and does not lift the fence.
 *  - A result that arrives after the context changed is quarantined. It does
 *    not touch the current view.
 *  - A confirmed receipt that does not state every non-claim as literal
 *    false is untrusted, and the write is UNKNOWN.
 *  - The five order-state cells and the five refund-flow lines stay separate:
 *    a cancel is not a refund, a return-required marker is not a refund
 *    pre-stage, and no line promotes another.
 *  - The caller supplies each intent reference. This class never mints one.
 *  - Target fields (order, payment, expected version) are copied from the
 *    last read. They are never typed or raised by the client.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

export const REFUND_OUTCOMES = ["DRAFT", "IN_FLIGHT", "CONFIRMED", "REJECTED", "UNKNOWN"] as const;

export type RefundOutcome = (typeof REFUND_OUTCOMES)[number];

export const REFUND_FRESHNESS = ["CURRENT", "STALE", "UNAVAILABLE"] as const;

export type RefundFreshness = (typeof REFUND_FRESHNESS)[number];

export type RefundRefreshCause = "own-write" | "stale-rejection" | "context-switch";

export interface RefundContext {
  environment: "stub" | "integration-http";
  domain: string;
  /** A context label. It is not an authentication result. */
  actorRef: string;
  /** The order this desk reads and writes. A synthetic label. */
  orderRef: string;
  /** Session incarnation. Bumped when the page switches context. */
  incarnation: number;
  key: string;
}

export interface RefundLateEvidence {
  result: "confirmed" | "rejected";
  code: string | null;
}

export interface RefundIntent {
  seq: number;
  intentRef: string;
  step: RefundStep;
  /** The order this write is about. Writes on one order are serialised. */
  scope: string;
  contextKey: string;
  outcome: RefundOutcome;
  code: string | null;
  message: string | null;
  refs: RefundReceiptRefs | null;
  late: RefundLateEvidence | null;
}

export interface RefundQuarantined {
  intentRef: string;
  contextKey: string;
  /** What arrived: a port outcome kind or a late result. */
  arrived: string;
  code: string | null;
  cause: "context-changed" | "no-unknown-intent" | "different-context";
}

export type RefundFence =
  | { reason: "in-flight"; intentRef: string }
  | { reason: "unknown-outcome"; intentRef: string; lateRecorded: boolean; earlierContext: boolean }
  | { reason: "no-snapshot" }
  | { reason: "snapshot-stale"; cause: RefundRefreshCause }
  | { reason: "duplicate-intent"; intentRef: string }
  | { reason: "payment-unobserved"; orderRef: string }
  | { reason: "return-not-required"; orderRef: string }
  | { reason: "already-issued"; orderRef: string }
  | { reason: "cancel-closed"; orderRef: string }
  | { reason: "not-bound" };

export type RefundNotSentReason = "invalid-intent" | "identity" | "unknown-ref" | "tuple-changed" | "invalid-request";

export interface RefundStepInput {
  step: RefundStep;
  intentRef: string;
}

export type RefundStepResult =
  | { kind: "CONFIRMED"; intent: RefundIntent }
  | { kind: "REJECTED"; intent: RefundIntent }
  | { kind: "UNKNOWN"; intent: RefundIntent }
  | { kind: "QUARANTINED"; intent: RefundIntent }
  | { kind: "FENCED"; fence: RefundFence }
  | { kind: "NOT_SENT"; reason: RefundNotSentReason; detail: string };

export type RefundReadState =
  | "none"
  | "ready"
  | "empty"
  | "stale"
  | "refused"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export type RefundRefreshResult =
  | { kind: "APPLIED"; readState: RefundReadState }
  | { kind: "DROPPED"; cause: "context-changed" | "older-read" };

export type RefundLateResult =
  | { kind: "RECORDED"; intent: RefundIntent }
  | { kind: "QUARANTINED"; cause: RefundQuarantined["cause"] };

export interface RefundCounters {
  /** Calls that reached port.submit. */
  sent: number;
  /** Writes the fence refused before the port. */
  fenced: number;
  notSent: number;
  droppedReads: number;
}

export interface RefundControllerState {
  context: RefundContext;
  readState: RefundReadState;
  readDetail: string | null;
  snapshot: RefundSnapshot | null;
  freshness: RefundFreshness;
  refreshRequired: RefundRefreshCause | null;
  intents: readonly RefundIntent[];
  quarantined: readonly RefundQuarantined[];
  counters: RefundCounters;
}

function contextKeyOf(parts: Pick<RefundContext, "environment" | "domain" | "actorRef" | "orderRef" | "incarnation">): string {
  return [parts.environment, parts.domain, parts.actorRef, parts.orderRef, String(parts.incarnation)].join("|");
}

function copyIntent(intent: RefundIntent): RefundIntent {
  return {
    ...intent,
    refs: intent.refs === null ? null : { ...intent.refs },
    late: intent.late === null ? null : { ...intent.late },
  };
}

export class RefundReturnController {
  private context: RefundContext;
  private snapshot: RefundSnapshot | null = null;
  private readState: RefundReadState = "none";
  private readDetail: string | null = null;
  private refreshRequired: RefundRefreshCause | null = null;
  private floor: string | null = null;
  private readSeq = 0;
  private appliedReadSeq = 0;
  private intentSeq = 0;
  private readonly intents: RefundIntent[] = [];
  private readonly used = new Set<string>();
  private readonly quarantined: RefundQuarantined[] = [];
  private readonly counters: RefundCounters = { sent: 0, fenced: 0, notSent: 0, droppedReads: 0 };
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly port: RefundReturnPort,
    options: { actorRef: string; orderRef: string; incarnation?: number },
  ) {
    const incarnation = options.incarnation ?? 1;
    const parts = {
      environment: port.environment,
      domain: PINNED_PROTOCOL_DOMAIN,
      actorRef: options.actorRef,
      orderRef: options.orderRef,
      incarnation,
    };
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

  state(): RefundControllerState {
    let freshness: RefundFreshness = "UNAVAILABLE";
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
  switchContext(next: { actorRef?: string } = {}): RefundContext {
    const parts = {
      environment: this.context.environment,
      domain: this.context.domain,
      actorRef: next.actorRef ?? this.context.actorRef,
      orderRef: this.context.orderRef,
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
  async refresh(): Promise<RefundRefreshResult> {
    const key = this.context.key;
    this.readSeq += 1;
    const seq = this.readSeq;
    let outcome: RefundReadOutcome;
    try {
      outcome = await this.port.read({
        contextKey: key,
        actorRef: this.context.actorRef,
        orderRef: this.context.orderRef,
        watermarkFloor: this.floor,
      });
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
  gateFor(input: RefundStepInput): RefundFence | null {
    if (this.port.source === "none") {
      return { reason: "not-bound" };
    }
    if (this.used.has(input.intentRef)) {
      return { reason: "duplicate-intent", intentRef: input.intentRef };
    }
    const flying = this.intents.find((intent) => intent.outcome === "IN_FLIGHT");
    if (flying) {
      return { reason: "in-flight", intentRef: flying.intentRef };
    }
    const unknown = this.intents.find((intent) => intent.outcome === "UNKNOWN");
    if (unknown) {
      return {
        reason: "unknown-outcome",
        intentRef: unknown.intentRef,
        lateRecorded: unknown.late !== null,
        earlierContext: unknown.contextKey !== this.context.key,
      };
    }
    if (this.snapshot === null) {
      return this.refreshRequired !== null ? { reason: "snapshot-stale", cause: this.refreshRequired } : { reason: "no-snapshot" };
    }
    if (this.refreshRequired !== null) {
      return { reason: "snapshot-stale", cause: this.refreshRequired };
    }
    const order = this.snapshot.order;
    if (input.step === "adjust" || input.step === "refund") {
      if (order.cells.payment.state !== "observed") {
        return { reason: "payment-unobserved", orderRef: order.orderRef };
      }
    }
    if (input.step === "observe-return" && order.cells.returnRequired.state !== "required") {
      return { reason: "return-not-required", orderRef: order.orderRef };
    }
    if (input.step === "void" && order.cells.issuance.state === "issued") {
      return { reason: "already-issued", orderRef: order.orderRef };
    }
    if (input.step === "cancel") {
      if (order.cells.reservation.state === "cancelled" || order.cells.payment.state === "observed") {
        return { reason: "cancel-closed", orderRef: order.orderRef };
      }
    }
    return null;
  }

  /**
   * Sends one write, once. The result is a receipt-shaped outcome or a reason it was
   * not sent. Nothing here sends a second time, mints an intent, or compensates.
   */
  async run(input: RefundStepInput): Promise<RefundStepResult> {
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
    const request = built.request;
    this.used.add(input.intentRef);
    this.intentSeq += 1;
    const intent: RefundIntent = {
      seq: this.intentSeq,
      intentRef: input.intentRef,
      step: input.step,
      scope: this.context.orderRef,
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
    let outcome: RefundWriteOutcome;
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

  private checkShape(input: RefundStepInput): Extract<RefundStepResult, { kind: "NOT_SENT" }> | null {
    if (typeof input.intentRef !== "string" || input.intentRef.trim().length === 0) {
      return { kind: "NOT_SENT", reason: "invalid-intent", detail: "A write carries an intent reference chosen by the caller." };
    }
    if (!(["cancel", "void", "adjust", "observe-return", "refund"] as readonly string[]).includes(input.step)) {
      return { kind: "NOT_SENT", reason: "invalid-request", detail: `Step ${String(input.step)} is not a refund-desk step.` };
    }
    return null;
  }

  private buildRequest(
    input: RefundStepInput,
  ): { kind: "BUILT"; request: RefundWriteRequest } | Extract<RefundStepResult, { kind: "NOT_SENT" }> {
    const snapshot = this.snapshot;
    if (snapshot === null) {
      return { kind: "NOT_SENT", reason: "unknown-ref", detail: "No read to copy the target fields from." };
    }
    const order = snapshot.order;
    if (!isRefundRef(order.orderRef, "order") || order.orderRef !== this.context.orderRef) {
      return { kind: "NOT_SENT", reason: "unknown-ref", detail: `${this.context.orderRef} is not in the last read.` };
    }
    const base = {
      contextKey: this.context.key,
      actorRef: this.context.actorRef,
      intentRef: input.intentRef,
      orderRef: order.orderRef,
      expectedVersion: order.version,
    };
    if (input.step === "adjust" || input.step === "refund") {
      const paymentRef = order.cells.payment.ref;
      if (paymentRef === null) {
        return { kind: "NOT_SENT", reason: "unknown-ref", detail: `Order ${order.orderRef} has no payment observation in the last read.` };
      }
      return { kind: "BUILT", request: { ...base, step: input.step, paymentRef } };
    }
    return { kind: "BUILT", request: { ...base, step: input.step } };
  }

  private settle(intent: RefundIntent, outcome: RefundWriteOutcome): RefundStepResult {
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
        const untrusted = refuseRefundReceipt(outcome.nonClaims);
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
        if (REFUND_STALE_CLASS_CODES.includes(outcome.code)) {
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
  acceptLate(delivery: RefundLateDelivery): RefundLateResult {
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

  private quarantineLate(delivery: RefundLateDelivery, cause: RefundQuarantined["cause"]): RefundLateResult {
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
// Projection: five state cells and five flow lines per order, from intents and a read
// ---------------------------------------------------------------------------

export interface RefundLineView2 {
  line: RefundFlowLine;
  /** This page's own write outcome on the line. Null when this page sent nothing on it. */
  outcome: RefundOutcome | null;
  code: string | null;
  intentRef: string | null;
  lateRecorded: boolean;
  observed: { state: "none" | "recorded"; ref: string | null; note: string };
}

export interface RefundCaseProjection {
  orderRef: string;
  version: number;
  cells: Readonly<Record<"reservation" | "payment" | "issuance" | "returnRequired" | "refundDone", { state: string; ref: string | null; note: string }>>;
  lines: Readonly<Record<RefundFlowLine, RefundLineView2>>;
}

export interface RefundProjection {
  order: RefundCaseProjection | null;
  freshness: RefundFreshness;
}

export function projectRefundReturn(state: RefundControllerState): RefundProjection {
  const snapshot = state.snapshot;
  if (snapshot === null) {
    return { order: null, freshness: state.freshness };
  }
  const order = snapshot.order;
  const lines = {} as Record<RefundFlowLine, RefundLineView2>;
  for (const step of ["cancel", "void", "adjust", "observe-return", "refund"] as const) {
    const line = REFUND_STEP_LINES[step];
    const intent = [...state.intents].reverse().find((item) => item.step === step);
    lines[line] = {
      line,
      outcome: intent ? intent.outcome : null,
      code: intent ? intent.code : null,
      intentRef: intent ? intent.intentRef : null,
      lateRecorded: intent ? intent.late !== null : false,
      observed: order.lines[line],
    };
  }
  return { order: { orderRef: order.orderRef, version: order.version, cells: order.cells, lines }, freshness: state.freshness };
}
