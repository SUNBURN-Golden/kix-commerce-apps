import {
  PLATFORM_FACETS,
  PLATFORM_STALE_CLASS_CODES,
  PLATFORM_TIERS,
  isPlatformRef,
  type PlatformFacet,
  type PlatformFacetObservation,
  type PlatformJourneyPort,
  type PlatformLateDelivery,
  type PlatformListing,
  type PlatformReadOutcome,
  type PlatformReceiptRefs,
  type PlatformRightView,
  type PlatformSnapshot,
  type PlatformStep,
  type PlatformTier,
  type PlatformTradeView,
  type PlatformWriteOutcome,
  type PlatformWriteRequest,
} from "./platform-journey.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";

/**
 * Client side of the platform journey: the write fence, the context key, and the
 * outcome reducer. It decides what the page may send next and how to show what came
 * back. It decides nothing about ownership, payment, or price: those are the source's.
 *
 * Rules, all tested:
 *  - A write is sent once. A repeated intent, a write while another write on the same
 *    right is in flight, and any write while an unknown or late result is outstanding
 *    on that right are fenced and never reach the port.
 *  - A lost, cut-off, mis-correlated, or thrown response is UNKNOWN. UNKNOWN is not
 *    rejected and is not a success. A read, or a late result, is recorded as evidence
 *    and does not lift the fence.
 *  - A result that arrives after the context changed (actor, session incarnation) is
 *    quarantined. It does not touch the current view.
 *  - The caller supplies each intent reference. This class never mints one.
 *  - Target fields (right, terms, expected version) are copied from the last read or
 *    from a confirmed receipt. They are never typed or raised by the client.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

export const PLATFORM_OUTCOMES = ["DRAFT", "IN_FLIGHT", "CONFIRMED", "REJECTED", "UNKNOWN"] as const;

export type PlatformOutcome = (typeof PLATFORM_OUTCOMES)[number];

export const PLATFORM_FRESHNESS = ["CURRENT", "STALE", "UNAVAILABLE"] as const;

export type PlatformFreshness = (typeof PLATFORM_FRESHNESS)[number];

export type PlatformRefreshCause = "own-write" | "stale-rejection" | "context-switch";

export interface PlatformContext {
  environment: "stub" | "integration-http";
  domain: string;
  /** A context label. It is not an authentication result. */
  actorRef: string;
  /** Session incarnation. Bumped when the page switches context. */
  incarnation: number;
  key: string;
}

export interface PlatformLateEvidence {
  result: "confirmed" | "rejected";
  code: string | null;
}

export interface PlatformIntent {
  seq: number;
  intentRef: string;
  step: PlatformStep;
  /** The right this write is about. Writes on one right are serialised. */
  scope: string;
  /** The listing or trade the write targets. */
  targetRef: string;
  contextKey: string;
  outcome: PlatformOutcome;
  code: string | null;
  message: string | null;
  refs: PlatformReceiptRefs | null;
  late: PlatformLateEvidence | null;
}

export interface PlatformQuarantined {
  intentRef: string;
  contextKey: string;
  /** What arrived: a port outcome kind or a late result. */
  arrived: string;
  code: string | null;
  cause: "context-changed" | "no-unknown-intent" | "different-context";
}

export type PlatformFence =
  | { reason: "in-flight"; intentRef: string }
  | { reason: "unknown-outcome"; intentRef: string; lateRecorded: boolean; earlierContext: boolean }
  | { reason: "no-snapshot" }
  | { reason: "snapshot-stale"; cause: PlatformRefreshCause }
  | { reason: "duplicate-intent"; intentRef: string }
  | { reason: "payment-unobserved"; tradeRef: string }
  | { reason: "not-bound" };

export type PlatformNotSentReason = "invalid-intent" | "identity" | "unknown-ref" | "tier" | "tuple-changed" | "invalid-request";

export type PlatformStepInput =
  | { step: "book"; intentRef: string; listingRef: string }
  | { step: "transfer"; intentRef: string; tradeRef: string }
  | { step: "reprice"; intentRef: string; listingRef: string; nextTier: string };

export type PlatformStepResult =
  | { kind: "CONFIRMED"; intent: PlatformIntent }
  | { kind: "REJECTED"; intent: PlatformIntent }
  | { kind: "UNKNOWN"; intent: PlatformIntent }
  | { kind: "QUARANTINED"; intent: PlatformIntent }
  | { kind: "FENCED"; fence: PlatformFence }
  | { kind: "NOT_SENT"; reason: PlatformNotSentReason; detail: string };

export type PlatformReadState =
  | "none"
  | "ready"
  | "empty"
  | "stale"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export type PlatformRefreshResult =
  | { kind: "APPLIED"; readState: PlatformReadState }
  | { kind: "DROPPED"; cause: "context-changed" | "older-read" };

export type PlatformLateResult =
  | { kind: "RECORDED"; intent: PlatformIntent }
  | { kind: "QUARANTINED"; cause: PlatformQuarantined["cause"] };

export interface PlatformCounters {
  /** Calls that reached port.submit. */
  sent: number;
  /** Writes the fence refused before the port. */
  fenced: number;
  notSent: number;
  droppedReads: number;
}

export interface PlatformControllerState {
  context: PlatformContext;
  readState: PlatformReadState;
  readDetail: string | null;
  snapshot: PlatformSnapshot | null;
  freshness: PlatformFreshness;
  refreshRequired: PlatformRefreshCause | null;
  intents: readonly PlatformIntent[];
  quarantined: readonly PlatformQuarantined[];
  counters: PlatformCounters;
}

function contextKeyOf(parts: Pick<PlatformContext, "environment" | "domain" | "actorRef" | "incarnation">): string {
  return [parts.environment, parts.domain, parts.actorRef, String(parts.incarnation)].join("|");
}

function isTierText(value: string): value is PlatformTier {
  return (PLATFORM_TIERS as readonly string[]).includes(value);
}

function copyIntent(intent: PlatformIntent): PlatformIntent {
  return {
    ...intent,
    refs: intent.refs === null ? null : { ...intent.refs },
    late: intent.late === null ? null : { ...intent.late },
  };
}

export class PlatformJourneyController {
  private context: PlatformContext;
  private snapshot: PlatformSnapshot | null = null;
  private readState: PlatformReadState = "none";
  private readDetail: string | null = null;
  private refreshRequired: PlatformRefreshCause | null = null;
  private floor: string | null = null;
  private readSeq = 0;
  private appliedReadSeq = 0;
  private intentSeq = 0;
  private readonly intents: PlatformIntent[] = [];
  private readonly used = new Set<string>();
  private readonly quarantined: PlatformQuarantined[] = [];
  private readonly counters: PlatformCounters = { sent: 0, fenced: 0, notSent: 0, droppedReads: 0 };
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly port: PlatformJourneyPort,
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

  state(): PlatformControllerState {
    let freshness: PlatformFreshness = "UNAVAILABLE";
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
   * Starts a new context: another actor, or a new session incarnation. A write that
   * is in flight becomes UNKNOWN, because its result will arrive in a context this
   * controller has left. The snapshot is dropped. Fences stay: an unknown outcome on a
   * right still blocks that right, whichever context asks.
   */
  switchContext(next: { actorRef?: string } = {}): PlatformContext {
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
  async refresh(): Promise<PlatformRefreshResult> {
    const key = this.context.key;
    this.readSeq += 1;
    const seq = this.readSeq;
    let outcome: PlatformReadOutcome;
    try {
      outcome = await this.port.read({ contextKey: key, watermarkFloor: this.floor });
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
  gateFor(input: PlatformStepInput): PlatformFence | null {
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
    if (this.snapshot === null) {
      return this.refreshRequired !== null ? { reason: "snapshot-stale", cause: this.refreshRequired } : { reason: "no-snapshot" };
    }
    if (this.refreshRequired !== null) {
      return { reason: "snapshot-stale", cause: this.refreshRequired };
    }
    if (input.step === "transfer") {
      const trade = this.snapshot.trades.find((item) => item.tradeRef === input.tradeRef);
      if (trade && trade.facets.payment.state !== "observed") {
        return { reason: "payment-unobserved", tradeRef: trade.tradeRef };
      }
    }
    return null;
  }

  private scopeOf(input: PlatformStepInput): string | null {
    if (this.snapshot === null) {
      return null;
    }
    if (input.step === "transfer") {
      return this.snapshot.trades.find((item) => item.tradeRef === input.tradeRef)?.rightRef ?? null;
    }
    return this.snapshot.listings.find((item) => item.listingRef === input.listingRef)?.rightRef ?? null;
  }

  /**
   * Sends one write, once. The result is a receipt-shaped outcome or a reason it was
   * not sent. Nothing here sends a second time, mints an intent, or compensates.
   */
  async run(input: PlatformStepInput): Promise<PlatformStepResult> {
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
    const intent: PlatformIntent = {
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
    let outcome: PlatformWriteOutcome;
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

  private checkShape(input: PlatformStepInput): Extract<PlatformStepResult, { kind: "NOT_SENT" }> | null {
    if (typeof input.intentRef !== "string" || input.intentRef.trim().length === 0) {
      return { kind: "NOT_SENT", reason: "invalid-intent", detail: "A write carries an intent reference chosen by the caller." };
    }
    if (input.step === "transfer") {
      if (!isPlatformRef(input.tradeRef, "trade")) {
        return { kind: "NOT_SENT", reason: "identity", detail: "A transfer targets a trade reference, not a listing, right, or payment." };
      }
      return null;
    }
    if (!isPlatformRef(input.listingRef, "listing")) {
      return { kind: "NOT_SENT", reason: "identity", detail: "This write targets a listing reference, not a trade, right, or payment." };
    }
    if (input.step === "reprice" && !isTierText(input.nextTier)) {
      return { kind: "NOT_SENT", reason: "tier", detail: `Tier ${input.nextTier} is not one of ${PLATFORM_TIERS.join(", ")}.` };
    }
    return null;
  }

  private buildRequest(
    input: PlatformStepInput,
  ):
    | { kind: "BUILT"; request: PlatformWriteRequest; scope: string; targetRef: string }
    | Extract<PlatformStepResult, { kind: "NOT_SENT" }> {
    const snapshot = this.snapshot;
    if (snapshot === null) {
      return { kind: "NOT_SENT", reason: "unknown-ref", detail: "No read to copy the target fields from." };
    }
    const base = { contextKey: this.context.key, actorRef: this.context.actorRef, intentRef: input.intentRef };
    if (input.step === "transfer") {
      const trade = snapshot.trades.find((item) => item.tradeRef === input.tradeRef);
      if (!trade) {
        return { kind: "NOT_SENT", reason: "unknown-ref", detail: `Trade ${input.tradeRef} is not in the last read.` };
      }
      return {
        kind: "BUILT",
        scope: trade.rightRef,
        targetRef: trade.tradeRef,
        request: {
          ...base,
          step: "transfer",
          tradeRef: trade.tradeRef,
          listingRef: trade.listingRef,
          rightRef: trade.rightRef,
          termsRef: trade.termsRef,
          expectedVersion: trade.expectedVersion,
        },
      };
    }
    const listing = snapshot.listings.find((item) => item.listingRef === input.listingRef);
    if (!listing) {
      return { kind: "NOT_SENT", reason: "unknown-ref", detail: `Listing ${input.listingRef} is not in the last read.` };
    }
    if (input.step === "reprice") {
      return {
        kind: "BUILT",
        scope: listing.rightRef,
        targetRef: listing.listingRef,
        request: { ...base, step: "reprice", listingRef: listing.listingRef, nextTier: input.nextTier },
      };
    }
    const right = snapshot.rights.find((item) => item.rightRef === listing.rightRef);
    if (!right) {
      return { kind: "NOT_SENT", reason: "unknown-ref", detail: `Right ${listing.rightRef} is not in the last read.` };
    }
    return {
      kind: "BUILT",
      scope: listing.rightRef,
      targetRef: listing.listingRef,
      request: {
        ...base,
        step: "book",
        listingRef: listing.listingRef,
        rightRef: listing.rightRef,
        termsRef: listing.termsRef,
        expectedVersion: right.version,
      },
    };
  }

  private settle(intent: PlatformIntent, outcome: PlatformWriteOutcome): PlatformStepResult {
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
      case "confirmed":
        intent.outcome = "CONFIRMED";
        intent.refs = { ...outcome.refs };
        this.refreshRequired = this.refreshRequired ?? "own-write";
        this.notify();
        return { kind: "CONFIRMED", intent: copyIntent(intent) };
      case "rejected":
        intent.outcome = "REJECTED";
        intent.code = outcome.code;
        intent.message = outcome.detail;
        if (PLATFORM_STALE_CLASS_CODES.includes(outcome.code)) {
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
  acceptLate(delivery: PlatformLateDelivery): PlatformLateResult {
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

  private quarantineLate(delivery: PlatformLateDelivery, cause: PlatformQuarantined["cause"]): PlatformLateResult {
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
// Projection: four independent facets per trade, from intents and a read
// ---------------------------------------------------------------------------

export const PLATFORM_TRADE_SHAPES = [
  "booking-only",
  "booking-payment-right",
  "payment-without-right",
  "right-without-payment",
  "payment-unknown",
  "unknown-effect",
] as const;

export type PlatformTradeShape = (typeof PLATFORM_TRADE_SHAPES)[number];

export interface PlatformFacetView {
  facet: PlatformFacet;
  /**
   * This page's own write outcome on the facet. Null when this page sent nothing on it.
   * Payment and refund have no write at all, so they are NOT_BOUND.
   */
  outcome: PlatformOutcome | "NOT_BOUND" | null;
  code: string | null;
  intentRef: string | null;
  lateRecorded: boolean;
  /** What the last read saw. Observation is not the page's receipt. */
  observed: PlatformFacetObservation | null;
}

export interface PlatformTradeProjection {
  tradeRef: string;
  /** True only when a confirmed booking receipt of this page named the trade. */
  linked: boolean;
  channel: PlatformTradeView["channel"];
  listingRef: string;
  rightRef: string;
  termsRef: string;
  bookedBy: string;
  originalRight: { holder: string; version: number };
  currentRight: { holder: string; version: number } | null;
  facets: Readonly<Record<PlatformFacet, PlatformFacetView>>;
  shape: PlatformTradeShape;
  identities: Readonly<Record<"listing" | "right" | "trade" | "payment" | "transfer" | "refund", string | null>>;
}

export interface PlatformRightProjection extends PlatformRightView {
  /** Trades the last read shows as having moved this right. More than one is an integrity fault. */
  observedTransfers: number;
  integrityFault: boolean;
}

export interface PlatformProjection {
  listings: readonly PlatformListing[];
  rights: readonly PlatformRightProjection[];
  trades: readonly PlatformTradeProjection[];
  /** Writes of this page with no trade to show. A lost booking lands here. */
  unlinkedIntents: readonly PlatformIntent[];
  freshness: PlatformFreshness;
}

function facetOutcomeFrom(intent: PlatformIntent | undefined): Pick<PlatformFacetView, "outcome" | "code" | "intentRef" | "lateRecorded"> {
  if (!intent) {
    return { outcome: null, code: null, intentRef: null, lateRecorded: false };
  }
  return { outcome: intent.outcome, code: intent.code, intentRef: intent.intentRef, lateRecorded: intent.late !== null };
}

function shapeOf(trade: PlatformTradeView, transferIntent: PlatformIntent | undefined): PlatformTradeShape {
  if (transferIntent && (transferIntent.outcome === "UNKNOWN" || transferIntent.outcome === "IN_FLIGHT")) {
    return "unknown-effect";
  }
  const issued = trade.facets.issuance.state === "observed";
  const payment = trade.facets.payment.state;
  if (issued) {
    return payment === "observed" ? "booking-payment-right" : "right-without-payment";
  }
  if (payment === "observed") {
    return trade.facets.refund.state === "unavailable" ? "payment-without-right" : "booking-only";
  }
  if (payment === "unknown") {
    return "payment-unknown";
  }
  return "booking-only";
}

export function projectPlatform(state: PlatformControllerState): PlatformProjection {
  const snapshot = state.snapshot;
  const confirmedBooks = state.intents.filter((intent) => intent.step === "book" && intent.outcome === "CONFIRMED");
  const linkedTrades = new Set(confirmedBooks.map((intent) => intent.refs?.tradeRef ?? ""));
  const trades: PlatformTradeProjection[] = [];
  const explained = new Set<string>();
  for (const trade of snapshot ? snapshot.trades : []) {
    const bookIntent = confirmedBooks.find((intent) => intent.refs?.tradeRef === trade.tradeRef);
    const transferIntent = [...state.intents]
      .reverse()
      .find((intent) => intent.step === "transfer" && intent.targetRef === trade.tradeRef);
    if (bookIntent) {
      explained.add(bookIntent.intentRef);
    }
    const current = snapshot?.rights.find((right) => right.rightRef === trade.rightRef) ?? null;
    trades.push({
      tradeRef: trade.tradeRef,
      linked: linkedTrades.has(trade.tradeRef),
      channel: trade.channel,
      listingRef: trade.listingRef,
      rightRef: trade.rightRef,
      termsRef: trade.termsRef,
      bookedBy: trade.bookedBy,
      originalRight: { ...trade.originalRight },
      currentRight: current ? { holder: current.holder, version: current.version } : null,
      facets: {
        booking: { facet: "booking", ...facetOutcomeFrom(bookIntent), observed: trade.facets.booking },
        payment: { facet: "payment", outcome: "NOT_BOUND", code: null, intentRef: null, lateRecorded: false, observed: trade.facets.payment },
        issuance: { facet: "issuance", ...facetOutcomeFrom(transferIntent), observed: trade.facets.issuance },
        refund: {
          facet: "refund",
          outcome: "NOT_BOUND",
          code: trade.facets.refund.code,
          intentRef: null,
          lateRecorded: false,
          observed: trade.facets.refund,
        },
      },
      shape: shapeOf(trade, transferIntent),
      identities: {
        listing: trade.listingRef,
        right: trade.rightRef,
        trade: trade.tradeRef,
        payment: trade.facets.payment.ref,
        transfer: trade.facets.issuance.ref,
        refund: null,
      },
    });
  }
  const unlinkedIntents = state.intents
    .filter((intent) => intent.step === "book" && intent.outcome !== "CONFIRMED" && intent.outcome !== "REJECTED" && intent.outcome !== "DRAFT")
    .map(copyIntent);
  const rights: PlatformRightProjection[] = (snapshot ? snapshot.rights : []).map((right) => {
    const moved = trades.filter((trade) => trade.rightRef === right.rightRef && trade.facets.issuance.observed?.state === "observed").length;
    return { ...right, observedTransfers: moved, integrityFault: moved > 1 };
  });
  return {
    listings: snapshot ? snapshot.listings : [],
    rights,
    trades,
    unlinkedIntents,
    freshness: state.freshness,
  };
}

/** Facets in display order. A trade never collapses them into one state. */
export function platformFacetList(trade: PlatformTradeProjection): readonly PlatformFacetView[] {
  return PLATFORM_FACETS.map((facet) => trade.facets[facet]);
}
