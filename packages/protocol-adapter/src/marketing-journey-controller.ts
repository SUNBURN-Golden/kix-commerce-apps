import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import {
  MARKETING_RETURN_ACTIONS,
  isMarketingRef,
  type MarketingApplication,
  type MarketingBenefit,
  type MarketingConsentView,
  type MarketingJourneyPort,
  type MarketingMembership,
  type MarketingOrder,
  type MarketingReadOutcome,
  type MarketingReceipt,
  type MarketingRejectCode,
  type MarketingReturnAction,
  type MarketingSnapshot,
  type MarketingStep,
  type MarketingVerdict,
  type MarketingWriteOutcome,
  type MarketingWriteRequest,
} from "./marketing-journey.js";

/**
 * Client side of the marketing journey: the write fence, the context key, and the
 * outcome reducer. It decides what the page may send next and how to show what came
 * back. It decides nothing about eligibility, usage, budget, attribution, or consent:
 * those are the source's, and this class copies the source's verdict and never
 * adds, subtracts, or compares a count.
 *
 * Rules, all tested:
 *  - A write is sent once. A repeated intent, a write while another write on the same
 *    benefit is in flight, and any write while an unknown result is outstanding on that
 *    benefit are fenced and never reach the port.
 *  - A lost, cut-off, mis-correlated, untrusted, or thrown response is UNKNOWN. UNKNOWN
 *    is not rejected and is not a success. A read does not lift the fence.
 *  - A result that arrives after the context changed (actor, subject, session
 *    incarnation) is quarantined. It does not touch the current view.
 *  - The caller supplies each intent reference. This class never mints one.
 *  - Target fields (eligibility version, consent version) are copied from the last read.
 *    They are never typed or raised by the client.
 *  - A synthetic event at the source (a consent change, a lapse, a cancelled order) is not
 *    seen here until a read. The next write is judged by the source against its own state.
 *  - Nothing here posts a consent command or sends a message. Consent is consumed as the
 *    source reports it.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

export const MARKETING_OUTCOMES = ["DRAFT", "IN_FLIGHT", "CONFIRMED", "REJECTED", "UNKNOWN"] as const;

export type MarketingOutcome = (typeof MARKETING_OUTCOMES)[number];

export const MARKETING_FRESHNESS = ["CURRENT", "STALE", "UNAVAILABLE"] as const;

export type MarketingFreshness = (typeof MARKETING_FRESHNESS)[number];

export type MarketingRefreshCause = "own-write" | "rejection" | "context-switch";

export interface MarketingContext {
  environment: "stub" | "integration-http";
  domain: string;
  /** A context label. It is not an authentication result. */
  actorRef: string;
  subjectRef: string;
  /** Session incarnation. Bumped when the page switches context. */
  incarnation: number;
  key: string;
}

export interface MarketingIntent {
  seq: number;
  intentRef: string;
  step: MarketingStep;
  /** Subject and benefit this write is about. Writes on one benefit are serialised. */
  scope: string;
  benefitRef: string;
  orderRef: string | null;
  applicationRef: string | null;
  contextKey: string;
  outcome: MarketingOutcome;
  code: string | null;
  message: string | null;
  receipt: MarketingReceipt | null;
}

export interface MarketingQuarantined {
  intentRef: string;
  contextKey: string;
  /** What arrived: a port outcome kind. */
  arrived: string;
  code: string | null;
  cause: "context-changed";
}

export type MarketingFence =
  | { reason: "in-flight"; intentRef: string }
  | { reason: "unknown-outcome"; intentRef: string; earlierContext: boolean }
  | { reason: "no-snapshot" }
  | { reason: "snapshot-stale"; cause: MarketingRefreshCause }
  | { reason: "duplicate-intent"; intentRef: string }
  | { reason: "not-listed"; ref: string }
  | { reason: "verdict-blocked"; benefitRef: string; verdict: MarketingVerdict }
  | { reason: "order-closed"; orderRef: string; state: string }
  | { reason: "already-applied"; applicationRef: string }
  | { reason: "not-reclaimable"; applicationRef: string }
  | { reason: "not-bound" };

export type MarketingNotSentReason = "invalid-intent" | "identity" | "unknown-ref" | "tuple-changed" | "invalid-request" | "denied";

export type MarketingStepInput =
  | { step: "apply"; intentRef: string; benefitRef: string; orderRef: string }
  | { step: "reclaim"; intentRef: string; applicationRef: string };

export type MarketingStepResult =
  | { kind: "CONFIRMED"; intent: MarketingIntent }
  | { kind: "REJECTED"; intent: MarketingIntent }
  | { kind: "UNKNOWN"; intent: MarketingIntent }
  | { kind: "QUARANTINED"; intent: MarketingIntent }
  | { kind: "FENCED"; fence: MarketingFence }
  | { kind: "NOT_SENT"; reason: MarketingNotSentReason; detail: string };

export type MarketingReadState =
  | "none"
  | "ready"
  | "empty"
  | "stale"
  | "denied"
  | "refused"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export type MarketingRefreshResult =
  | { kind: "APPLIED"; readState: MarketingReadState }
  | { kind: "DROPPED"; cause: "context-changed" | "older-read" };

export interface MarketingCounters {
  /** Calls that reached port.submit. */
  sent: number;
  /** Writes the fence refused before the port. */
  fenced: number;
  notSent: number;
  droppedReads: number;
}

export interface MarketingControllerState {
  context: MarketingContext;
  readState: MarketingReadState;
  readDetail: string | null;
  readCode: string | null;
  snapshot: MarketingSnapshot | null;
  freshness: MarketingFreshness;
  refreshRequired: MarketingRefreshCause | null;
  intents: readonly MarketingIntent[];
  quarantined: readonly MarketingQuarantined[];
  counters: MarketingCounters;
}

function contextKeyOf(parts: Pick<MarketingContext, "environment" | "domain" | "actorRef" | "subjectRef" | "incarnation">): string {
  return [parts.environment, parts.domain, parts.actorRef, parts.subjectRef, String(parts.incarnation)].join("|");
}

function copyIntent(intent: MarketingIntent): MarketingIntent {
  return { ...intent, receipt: intent.receipt === null ? null : { ...intent.receipt, nonClaims: { ...intent.receipt.nonClaims } } };
}

export class MarketingJourneyController {
  private context: MarketingContext;
  private snapshot: MarketingSnapshot | null = null;
  private readState: MarketingReadState = "none";
  private readDetail: string | null = null;
  private readCode: string | null = null;
  private refreshRequired: MarketingRefreshCause | null = null;
  /**
   * Reads numbered at or below this began before the last thing that made the view behind
   * (a write that settled, or a context switch). They may not show it, so they never clear the flag.
   */
  private behindAfterSeq = 0;
  private floor: string | null = null;
  private readSeq = 0;
  private appliedReadSeq = 0;
  private intentSeq = 0;
  private readonly intents: MarketingIntent[] = [];
  private readonly used = new Set<string>();
  private readonly quarantined: MarketingQuarantined[] = [];
  private readonly counters: MarketingCounters = { sent: 0, fenced: 0, notSent: 0, droppedReads: 0 };
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly port: MarketingJourneyPort,
    options: { actorRef: string; subjectRef: string; incarnation?: number },
  ) {
    const incarnation = options.incarnation ?? 1;
    const parts = {
      environment: port.environment,
      domain: PINNED_PROTOCOL_DOMAIN,
      actorRef: options.actorRef,
      subjectRef: options.subjectRef,
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

  /** Tells subscribers to read the state again. It changes nothing here. */
  notify(): void {
    for (const listener of [...this.listeners]) {
      listener();
    }
  }

  state(): MarketingControllerState {
    let freshness: MarketingFreshness = "UNAVAILABLE";
    if (this.readState === "ready" || this.readState === "empty") {
      freshness = this.refreshRequired === null ? "CURRENT" : "STALE";
    } else if (this.readState === "stale") {
      freshness = "STALE";
    }
    return {
      context: { ...this.context },
      readState: this.readState,
      readDetail: this.readDetail,
      readCode: this.readCode,
      snapshot: this.snapshot,
      freshness,
      refreshRequired: this.refreshRequired,
      intents: this.intents.map(copyIntent),
      quarantined: this.quarantined.map((item) => ({ ...item })),
      counters: { ...this.counters },
    };
  }

  /**
   * Starts a new context: another actor, another subject scope, or a new session
   * incarnation. A write that is in flight becomes UNKNOWN, because its result will
   * arrive in a context this controller has left. The snapshot is dropped. Fences stay:
   * an unknown outcome on a benefit still blocks that benefit for that subject, and
   * returning to the subject finds the earlier unknown still counted.
   */
  switchContext(next: { actorRef?: string; subjectRef?: string } = {}): MarketingContext {
    const parts = {
      environment: this.context.environment,
      domain: this.context.domain,
      actorRef: next.actorRef ?? this.context.actorRef,
      subjectRef: next.subjectRef ?? this.context.subjectRef,
      incarnation: this.context.incarnation + 1,
    };
    const subjectChanged = parts.subjectRef !== this.context.subjectRef;
    this.context = { ...parts, key: contextKeyOf(parts) };
    for (const intent of this.intents) {
      if (intent.outcome === "IN_FLIGHT") {
        intent.outcome = "UNKNOWN";
        intent.code = "CONTEXT_SWITCHED";
        intent.message = "The session context changed while this write was in flight. Its result is not applied.";
      }
    }
    if (subjectChanged) {
      // The floor belongs to the subject whose read set it.
      this.floor = null;
    }
    this.snapshot = null;
    this.readState = "none";
    this.readDetail = null;
    this.readCode = null;
    this.markBehind("context-switch");
    this.notify();
    return { ...this.context };
  }

  /** The view is behind from now on. A read numbered at or below the latest read so far cannot clear it. */
  private markBehind(cause: MarketingRefreshCause): void {
    this.refreshRequired = this.refreshRequired ?? cause;
    this.behindAfterSeq = this.readSeq;
  }

  /** Explicit read. A read is evidence. It never resolves an unknown write. */
  async refresh(): Promise<MarketingRefreshResult> {
    const key = this.context.key;
    const request = {
      contextKey: key,
      actorRef: this.context.actorRef,
      subjectRef: this.context.subjectRef,
      watermarkFloor: this.floor,
    };
    this.readSeq += 1;
    const seq = this.readSeq;
    let outcome: MarketingReadOutcome;
    try {
      outcome = await this.port.read(request);
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
    this.readCode = null;
    switch (outcome.kind) {
      case "ready":
        this.snapshot = outcome.snapshot;
        this.readState = "ready";
        this.readDetail = null;
        this.clearBehind(seq);
        this.floor = outcome.snapshot.watermark;
        break;
      case "empty":
        this.snapshot = null;
        this.readState = "empty";
        this.readDetail = null;
        this.clearBehind(seq);
        break;
      case "stale":
        this.snapshot = null;
        this.readState = "stale";
        this.readDetail = `Watermark ${outcome.watermark} is older than the floor ${outcome.floor}.`;
        break;
      case "denied":
        this.snapshot = null;
        this.readState = "denied";
        this.readCode = outcome.code;
        this.readDetail = outcome.detail;
        break;
      case "refused":
        this.snapshot = null;
        this.readState = "refused";
        this.readCode = outcome.code;
        this.readDetail = `${outcome.detail} (${outcome.field})`;
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

  /** Only a read that began after the view went behind can say it is current again. */
  private clearBehind(seq: number): void {
    if (seq > this.behindAfterSeq) {
      this.refreshRequired = null;
    }
  }

  private scopeOf(benefitRef: string): string {
    return `${this.context.subjectRef}|${benefitRef}`;
  }

  private benefitOf(input: MarketingStepInput): string | null {
    if (input.step === "apply") {
      return input.benefitRef;
    }
    return this.snapshot?.applications.find((item) => item.applicationRef === input.applicationRef)?.benefitRef ?? null;
  }

  /** Why this write cannot go out now, or null. This is the single gate `run` uses. */
  gateFor(input: MarketingStepInput): MarketingFence | null {
    if (this.port.source === "none") {
      return { reason: "not-bound" };
    }
    if (this.used.has(input.intentRef)) {
      return { reason: "duplicate-intent", intentRef: input.intentRef };
    }
    const benefitRef = this.benefitOf(input);
    const open = this.intents.filter((intent) => benefitRef === null || intent.scope === this.scopeOf(benefitRef));
    const flying = open.find((intent) => intent.outcome === "IN_FLIGHT");
    if (flying) {
      return { reason: "in-flight", intentRef: flying.intentRef };
    }
    const unknown = open.find((intent) => intent.outcome === "UNKNOWN");
    if (unknown) {
      return { reason: "unknown-outcome", intentRef: unknown.intentRef, earlierContext: unknown.contextKey !== this.context.key };
    }
    const snapshot = this.snapshot;
    if (snapshot === null) {
      return this.refreshRequired !== null ? { reason: "snapshot-stale", cause: this.refreshRequired } : { reason: "no-snapshot" };
    }
    if (this.refreshRequired !== null) {
      return { reason: "snapshot-stale", cause: this.refreshRequired };
    }
    if (input.step === "reclaim") {
      const application = snapshot.applications.find((item) => item.applicationRef === input.applicationRef);
      if (!application) {
        return { reason: "not-listed", ref: input.applicationRef };
      }
      if (application.state === "reclaimed") {
        return { reason: "not-reclaimable", applicationRef: application.applicationRef };
      }
      return null;
    }
    const benefit = snapshot.benefits.find((item) => item.benefitRef === input.benefitRef);
    if (!benefit) {
      return { reason: "not-listed", ref: input.benefitRef };
    }
    const order = snapshot.orders.find((item) => item.orderRef === input.orderRef);
    if (!order) {
      return { reason: "not-listed", ref: input.orderRef };
    }
    if (order.state !== "open") {
      return { reason: "order-closed", orderRef: order.orderRef, state: order.state };
    }
    const applied = snapshot.applications.find(
      (item) => item.benefitRef === benefit.benefitRef && item.orderRef === order.orderRef && item.state !== "reclaimed",
    );
    if (applied) {
      return { reason: "already-applied", applicationRef: applied.applicationRef };
    }
    if (benefit.verdict !== "eligible") {
      return { reason: "verdict-blocked", benefitRef: benefit.benefitRef, verdict: benefit.verdict };
    }
    return null;
  }

  /**
   * Sends one write, once. The result is a receipt-shaped outcome or a reason it was
   * not sent. Nothing here sends a second time or mints an intent.
   */
  async run(input: MarketingStepInput): Promise<MarketingStepResult> {
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
    const { request, benefitRef, orderRef, applicationRef } = built;
    this.used.add(input.intentRef);
    this.intentSeq += 1;
    const intent: MarketingIntent = {
      seq: this.intentSeq,
      intentRef: input.intentRef,
      step: input.step,
      scope: this.scopeOf(benefitRef),
      benefitRef,
      orderRef,
      applicationRef,
      contextKey: this.context.key,
      outcome: "IN_FLIGHT",
      code: null,
      message: null,
      receipt: null,
    };
    this.intents.push(intent);
    this.counters.sent += 1;
    this.notify();
    let outcome: MarketingWriteOutcome;
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

  private checkShape(input: MarketingStepInput): Extract<MarketingStepResult, { kind: "NOT_SENT" }> | null {
    if (typeof input.intentRef !== "string" || input.intentRef.trim().length === 0) {
      return { kind: "NOT_SENT", reason: "invalid-intent", detail: "A write carries an intent reference chosen by the caller." };
    }
    if (input.step === "apply") {
      if (!isMarketingRef(input.benefitRef, "benefit") || !isMarketingRef(input.orderRef, "order")) {
        return { kind: "NOT_SENT", reason: "identity", detail: "An apply targets a benefit reference and an order reference, not an application or a subject." };
      }
      return null;
    }
    if (!isMarketingRef(input.applicationRef, "application")) {
      return { kind: "NOT_SENT", reason: "identity", detail: "A reclaim targets an application reference, not a benefit or an order." };
    }
    return null;
  }

  private buildRequest(
    input: MarketingStepInput,
  ):
    | { kind: "BUILT"; request: MarketingWriteRequest; benefitRef: string; orderRef: string | null; applicationRef: string | null }
    | Extract<MarketingStepResult, { kind: "NOT_SENT" }> {
    const snapshot = this.snapshot;
    if (snapshot === null) {
      return { kind: "NOT_SENT", reason: "unknown-ref", detail: "No read to copy the target fields from." };
    }
    const base = {
      contextKey: this.context.key,
      actorRef: this.context.actorRef,
      subjectRef: this.context.subjectRef,
      intentRef: input.intentRef,
    };
    if (input.step === "reclaim") {
      const application = snapshot.applications.find((item) => item.applicationRef === input.applicationRef);
      if (!application) {
        return { kind: "NOT_SENT", reason: "unknown-ref", detail: `Application ${input.applicationRef} is not in the last read.` };
      }
      return {
        kind: "BUILT",
        benefitRef: application.benefitRef,
        orderRef: application.orderRef,
        applicationRef: application.applicationRef,
        request: { ...base, step: "reclaim", applicationRef: application.applicationRef },
      };
    }
    const benefit = snapshot.benefits.find((item) => item.benefitRef === input.benefitRef);
    const order = snapshot.orders.find((item) => item.orderRef === input.orderRef);
    if (!benefit || !order) {
      return { kind: "NOT_SENT", reason: "unknown-ref", detail: `${benefit ? input.orderRef : input.benefitRef} is not in the last read.` };
    }
    return {
      kind: "BUILT",
      benefitRef: benefit.benefitRef,
      orderRef: order.orderRef,
      applicationRef: null,
      request: {
        ...base,
        step: "apply",
        benefitRef: benefit.benefitRef,
        orderRef: order.orderRef,
        expectedEligibilityVersion: snapshot.membership.version,
        expectedConsentVersion: snapshot.consent.version,
      },
    };
  }

  private settle(intent: MarketingIntent, outcome: MarketingWriteOutcome): MarketingStepResult {
    if (intent.outcome !== "IN_FLIGHT") {
      this.quarantined.push({
        intentRef: intent.intentRef,
        contextKey: intent.contextKey,
        arrived: outcome.kind,
        code: outcome.kind === "rejected" || outcome.kind === "invalid-request" || outcome.kind === "denied" || outcome.kind === "refused" ? outcome.code : null,
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
        intent.receipt = { ...outcome.receipt, nonClaims: { ...outcome.receipt.nonClaims } };
        this.markBehind("own-write");
        this.notify();
        return { kind: "CONFIRMED", intent: copyIntent(intent) };
      case "rejected":
        intent.outcome = "REJECTED";
        intent.code = outcome.code;
        intent.message = outcome.detail;
        // The source disagreed with the read the write was built from, so that read is behind.
        this.markBehind("rejection");
        this.notify();
        return { kind: "REJECTED", intent: copyIntent(intent) };
      case "unknown":
        intent.outcome = "UNKNOWN";
        intent.code = "RESPONSE_LOST";
        intent.message = outcome.message;
        this.notify();
        return { kind: "UNKNOWN", intent: copyIntent(intent) };
      case "refused":
        // The source answered, and the answer broke a rule. The request may have been recorded.
        intent.outcome = "UNKNOWN";
        intent.code = outcome.code;
        intent.message = `The answer was not trusted, and the request may have been recorded. ${outcome.detail}`;
        this.notify();
        return { kind: "UNKNOWN", intent: copyIntent(intent) };
      case "denied":
        intent.outcome = "DRAFT";
        intent.code = outcome.code;
        intent.message = outcome.detail;
        this.counters.notSent += 1;
        this.notify();
        return { kind: "NOT_SENT", reason: "denied", detail: outcome.detail };
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
}

// ---------------------------------------------------------------------------
// Projection: four independent lanes from intents and a read
// ---------------------------------------------------------------------------

export interface MarketingApplicationProjection extends MarketingApplication {
  /** True only when a confirmed apply receipt of this page named the application. */
  linked: boolean;
}

export interface MarketingBenefitProjection {
  benefit: MarketingBenefit;
  applications: readonly MarketingApplicationProjection[];
  /** This page's writes on the benefit, oldest first. */
  intents: readonly MarketingIntent[];
}

export interface MarketingRejectionRow {
  intentRef: string;
  step: MarketingStep;
  benefitRef: string;
  orderRef: string | null;
  code: string;
  returnAction: MarketingReturnAction;
  detail: string;
}

export interface MarketingProjection {
  membership: MarketingMembership | null;
  consent: MarketingConsentView | null;
  benefits: readonly MarketingBenefitProjection[];
  orders: readonly MarketingOrder[];
  applications: readonly MarketingApplicationProjection[];
  /** Rejections the source made of this page's writes. */
  rejections: readonly MarketingRejectionRow[];
  /** Apply writes with no confirmed receipt. A lost apply lands here, and no application is claimed for it. */
  unlinkedIntents: readonly MarketingIntent[];
  freshness: MarketingFreshness;
}

function returnActionFor(code: string): MarketingReturnAction {
  return (MARKETING_RETURN_ACTIONS as Record<string, MarketingReturnAction | undefined>)[code] ?? "read-again";
}

export function projectMarketing(state: MarketingControllerState): MarketingProjection {
  const snapshot = state.snapshot;
  const linkedRefs = new Set(
    state.intents
      .filter((intent) => intent.step === "apply" && intent.outcome === "CONFIRMED" && intent.receipt !== null)
      .map((intent) => intent.receipt?.applicationRef ?? ""),
  );
  const applications: MarketingApplicationProjection[] = (snapshot ? snapshot.applications : []).map((application) => ({
    ...application,
    linked: linkedRefs.has(application.applicationRef),
  }));
  const benefits: MarketingBenefitProjection[] = (snapshot ? snapshot.benefits : []).map((benefit) => ({
    benefit,
    applications: applications.filter((application) => application.benefitRef === benefit.benefitRef),
    intents: state.intents.filter((intent) => intent.benefitRef === benefit.benefitRef).map(copyIntent),
  }));
  const rejections: MarketingRejectionRow[] = state.intents
    .filter((intent) => intent.outcome === "REJECTED")
    .map((intent) => {
      const code = (intent.code ?? "UNKNOWN_REF") as MarketingRejectCode;
      return {
        intentRef: intent.intentRef,
        step: intent.step,
        benefitRef: intent.benefitRef,
        orderRef: intent.orderRef,
        code,
        returnAction: returnActionFor(code),
        detail: intent.message ?? "",
      };
    });
  const unlinkedIntents = state.intents
    .filter((intent) => intent.step === "apply" && (intent.outcome === "UNKNOWN" || intent.outcome === "IN_FLIGHT"))
    .map(copyIntent);
  return {
    membership: snapshot ? snapshot.membership : null,
    consent: snapshot ? snapshot.consent : null,
    benefits,
    orders: snapshot ? snapshot.orders : [],
    applications,
    rejections,
    unlinkedIntents,
    freshness: state.freshness,
  };
}
