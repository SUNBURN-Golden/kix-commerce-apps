import {
  IDENTITY_STALE_CLASS_CODES,
  adjudicateObservation,
  isIdentityRef,
  refuseIdentityReceipt,
  type IdentityLateDelivery,
  type IdentityReadOutcome,
  type IdentityReceiptRefs,
  type IdentityWriteOutcome,
  type IdentityWriteRequest,
  type JourneyContext,
  type JourneyContextParts,
  type JourneyIdentityPort,
  type JourneyIdentitySnapshot,
  type JourneyRole,
  type ObservationVerdict,
  journeyContextKey,
} from "./journey-identity.js";
import { liveTupleKey } from "./contract-fixtures.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";

/**
 * Client side of the journey context desk: the context key binding, the write
 * fence, the read-observation adjudication, and the session journal. It
 * decides what the page may send next and how to show what came back. It
 * decides nothing about payment, issuance, or admission: an adjudicated
 * observation is non-authoritative and proves none of them.
 *
 * Rules, all tested:
 *  - A session is bound to one context key: mode, actor, role, domain, source
 *    cut generation, pin tuple, and incarnation. Anything that arrives under
 *    another key is foreign and is quarantined, never applied.
 *  - An attach is sent once. A repeated intent, a write while another write
 *    on the same subject is in flight, and any write while an unknown result
 *    is outstanding on that subject are fenced and never reach the port.
 *  - A lost, cut-off, mis-correlated, or untrusted response is UNKNOWN. A
 *    read, or a late result, is recorded as evidence and does not lift the
 *    fence.
 *  - An actor, role, mode, or cut-generation change isolates the earlier
 *    session. A stub reset does not erase a previous UNKNOWN: the journal
 *    stays and keeps fencing its subject.
 *  - The caller supplies each intent reference. This class never mints one.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

export const IDENTITY_OUTCOMES = ["DRAFT", "IN_FLIGHT", "CONFIRMED", "REJECTED", "UNKNOWN"] as const;

export type IdentityOutcome = (typeof IDENTITY_OUTCOMES)[number];

export const IDENTITY_FRESHNESS = ["CURRENT", "STALE", "UNAVAILABLE"] as const;

export type IdentityFreshness = (typeof IDENTITY_FRESHNESS)[number];

export type IdentityRefreshCause = "own-write" | "stale-rejection" | "context-switch" | "source-reset" | "generation-moved";

export interface IdentityLateEvidence {
  result: "confirmed" | "rejected";
  code: string | null;
}

export interface IdentityIntent {
  seq: number;
  intentRef: string;
  /** The subject this write is about. Writes on one subject are serialised. */
  scope: string;
  observationId: string;
  contextKey: string;
  outcome: IdentityOutcome;
  code: string | null;
  message: string | null;
  refs: IdentityReceiptRefs | null;
  late: IdentityLateEvidence | null;
}

export interface IdentityQuarantined {
  intentRef: string;
  contextKey: string;
  /** What arrived: a port outcome kind or a late result. */
  arrived: string;
  code: string | null;
  cause: "context-changed" | "no-unknown-intent" | "different-context";
}

/** A session this controller left behind. Its intents stay in the journal. */
export interface IdentityIsolatedSession {
  key: string;
  actorRef: string;
  role: JourneyRole;
  incarnation: number;
  cutGeneration: number;
  cause: "context-switch" | "source-reset";
  unknownIntents: number;
}

export type IdentityFence =
  | { reason: "in-flight"; intentRef: string }
  | { reason: "unknown-outcome"; intentRef: string; lateRecorded: boolean; earlierContext: boolean }
  | { reason: "no-snapshot" }
  | { reason: "snapshot-stale"; cause: IdentityRefreshCause }
  | { reason: "duplicate-intent"; intentRef: string }
  | { reason: "not-current"; observationId: string; verdict: string }
  | { reason: "not-bound" };

export type IdentityNotSentReason = "invalid-intent" | "identity" | "unknown-ref" | "tuple-changed" | "invalid-request";

export interface IdentityAttachInput {
  observationId: string;
  intentRef: string;
}

export type IdentityStepResult =
  | { kind: "CONFIRMED"; intent: IdentityIntent }
  | { kind: "REJECTED"; intent: IdentityIntent }
  | { kind: "UNKNOWN"; intent: IdentityIntent }
  | { kind: "QUARANTINED"; intent: IdentityIntent }
  | { kind: "FENCED"; fence: IdentityFence }
  | { kind: "NOT_SENT"; reason: IdentityNotSentReason; detail: string };

export type IdentityReadState =
  | "none"
  | "ready"
  | "empty"
  | "stale"
  | "generation-moved"
  | "refused"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export type IdentityRefreshResult =
  | { kind: "APPLIED"; readState: IdentityReadState }
  | { kind: "DROPPED"; cause: "context-changed" | "older-read" };

export type IdentityLateResult =
  | { kind: "RECORDED"; intent: IdentityIntent }
  | { kind: "QUARANTINED"; cause: IdentityQuarantined["cause"] };

export interface IdentityCounters {
  /** Calls that reached port.submit. */
  sent: number;
  /** Writes the fence refused before the port. */
  fenced: number;
  notSent: number;
  droppedReads: number;
}

export interface IdentityControllerState {
  context: JourneyContext;
  readState: IdentityReadState;
  readDetail: string | null;
  snapshot: JourneyIdentitySnapshot | null;
  adjudications: readonly ObservationVerdict[];
  freshness: IdentityFreshness;
  refreshRequired: IdentityRefreshCause | null;
  intents: readonly IdentityIntent[];
  quarantined: readonly IdentityQuarantined[];
  isolated: readonly IdentityIsolatedSession[];
  counters: IdentityCounters;
}

function contextKeyOf(parts: JourneyContextParts): string {
  return journeyContextKey(parts);
}

function copyIntent(intent: IdentityIntent): IdentityIntent {
  return {
    ...intent,
    refs: intent.refs === null ? null : { ...intent.refs },
    late: intent.late === null ? null : { ...intent.late },
  };
}

export class JourneyIdentityController {
  private port: JourneyIdentityPort;
  private context: JourneyContext;
  private snapshot: JourneyIdentitySnapshot | null = null;
  private adjudications: ObservationVerdict[] = [];
  private readState: IdentityReadState = "none";
  private readDetail: string | null = null;
  private refreshRequired: IdentityRefreshCause | null = null;
  private floor: string | null = null;
  private readSeq = 0;
  private appliedReadSeq = 0;
  /** Reads started at or before this seq began before the view went behind; they cannot clear the flag. */
  private behindAfterSeq = 0;
  private intentSeq = 0;
  private readonly intents: IdentityIntent[] = [];
  private readonly used = new Set<string>();
  private readonly quarantined: IdentityQuarantined[] = [];
  private readonly isolated: IdentityIsolatedSession[] = [];
  private readonly counters: IdentityCounters = { sent: 0, fenced: 0, notSent: 0, droppedReads: 0 };
  private readonly listeners = new Set<() => void>();

  constructor(
    port: JourneyIdentityPort,
    private readonly options: { actorRef: string; role: JourneyRole; incarnation?: number },
  ) {
    this.port = port;
    this.context = this.buildContext(options.incarnation ?? 1);
  }

  private buildContext(incarnation: number): JourneyContext {
    const parts: JourneyContextParts = {
      environment: this.port.environment,
      actorRef: this.options.actorRef,
      role: this.options.role,
      domain: PINNED_PROTOCOL_DOMAIN,
      cutGeneration: this.port.currentGeneration(),
      tupleKey: liveTupleKey(),
      incarnation,
    };
    return { ...parts, key: contextKeyOf(parts) };
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

  state(): IdentityControllerState {
    let freshness: IdentityFreshness = "UNAVAILABLE";
    if (this.readState === "ready" || this.readState === "empty") {
      freshness = this.refreshRequired === null ? "CURRENT" : "STALE";
    } else if (this.readState === "stale" || this.readState === "generation-moved") {
      freshness = "STALE";
    }
    return {
      context: { ...this.context },
      readState: this.readState,
      readDetail: this.readDetail,
      snapshot: this.snapshot,
      adjudications: this.adjudications.map((verdict) => ({ ...verdict })),
      freshness,
      refreshRequired: this.refreshRequired,
      intents: this.intents.map(copyIntent),
      quarantined: this.quarantined.map((item) => ({ ...item })),
      isolated: this.isolated.map((item) => ({ ...item })),
      counters: { ...this.counters },
    };
  }

  /** Isolates the session being left: in-flight writes become UNKNOWN and the journal entry is recorded. */
  private isolate(cause: IdentityIsolatedSession["cause"], code: "CONTEXT_SWITCHED" | "SOURCE_RESET"): void {
    let unknownIntents = 0;
    for (const intent of this.intents) {
      if (intent.outcome === "IN_FLIGHT") {
        intent.outcome = "UNKNOWN";
        intent.code = code;
        intent.message =
          cause === "source-reset"
            ? "The synthetic source was reset while this write was in flight. Its result is not applied."
            : "The session context changed while this write was in flight. Its result is not applied.";
      }
      if (intent.outcome === "UNKNOWN") {
        unknownIntents += 1;
      }
    }
    this.isolated.push({
      key: this.context.key,
      actorRef: this.context.actorRef,
      role: this.context.role,
      incarnation: this.context.incarnation,
      cutGeneration: this.context.cutGeneration,
      cause,
      unknownIntents,
    });
    this.snapshot = null;
    this.adjudications = [];
    this.readState = "none";
    this.readDetail = null;
    this.refreshRequired = cause;
    this.behindAfterSeq = this.readSeq;
    this.floor = null;
  }

  /**
   * Starts a new context: another actor or role. A write that is in flight
   * becomes UNKNOWN, because its result will arrive in a context this
   * controller has left. The snapshot is dropped. Fences stay: an unknown
   * outcome on a subject still blocks that subject, whichever context asks.
   */
  switchContext(next: { actorRef?: string; role?: JourneyRole } = {}): JourneyContext {
    this.isolate("context-switch", "CONTEXT_SWITCHED");
    this.options.actorRef = next.actorRef ?? this.context.actorRef;
    this.options.role = next.role ?? this.context.role;
    this.context = this.buildContext(this.context.incarnation + 1);
    this.notify();
    return { ...this.context };
  }

  /**
   * A stub re-initialisation or a mode change: the port is swapped and a new
   * context binds the new source's cut. The journal is kept: earlier UNKNOWN
   * writes stay UNKNOWN and keep fencing their subject, and nothing from the
   * old source is evidence in the new context.
   */
  resetSource(port: JourneyIdentityPort): JourneyContext {
    this.isolate("source-reset", "SOURCE_RESET");
    this.port = port;
    this.context = this.buildContext(this.context.incarnation + 1);
    this.notify();
    return { ...this.context };
  }

  /** Explicit read. A read is evidence. It never resolves an unknown write. */
  async refresh(): Promise<IdentityRefreshResult> {
    const key = this.context.key;
    this.readSeq += 1;
    const seq = this.readSeq;
    let outcome: IdentityReadOutcome;
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
        if (outcome.snapshot.generation !== this.context.cutGeneration) {
          this.snapshot = null;
          this.adjudications = [];
          this.readState = "generation-moved";
          this.readDetail = `The source moved to cut generation ${outcome.snapshot.generation}; this session is bound to ${this.context.cutGeneration}. Nothing from the new cut is this session's evidence.`;
          this.refreshRequired = "generation-moved";
          break;
        }
        this.snapshot = outcome.snapshot;
        this.adjudications = outcome.snapshot.items.map((item) =>
          adjudicateObservation(this.context, item, this.floor),
        );
        this.readState = "ready";
        this.readDetail = null;
        if (seq > this.behindAfterSeq) {
          this.refreshRequired = null;
        }
        this.floor = outcome.snapshot.watermark;
        break;
      case "empty":
        this.snapshot = null;
        this.adjudications = [];
        this.readState = "empty";
        this.readDetail = null;
        if (seq > this.behindAfterSeq) {
          this.refreshRequired = null;
        }
        break;
      case "stale":
        this.snapshot = null;
        this.adjudications = [];
        this.readState = "stale";
        this.readDetail = `Watermark ${outcome.watermark} is older than the floor ${outcome.floor}.`;
        break;
      case "refused":
        this.snapshot = null;
        this.adjudications = [];
        this.readState = "refused";
        this.readDetail = outcome.detail;
        break;
      case "tuple-changed":
        this.snapshot = null;
        this.adjudications = [];
        this.readState = "tuple-changed";
        this.readDetail = `The pin tuple field ${outcome.field} changed.`;
        break;
      case "not-bound":
        this.snapshot = null;
        this.adjudications = [];
        this.readState = "not-bound";
        this.readDetail = outcome.reason;
        break;
      case "unknown":
        this.snapshot = null;
        this.adjudications = [];
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

  private adjudicationFor(observationId: string): ObservationVerdict | null {
    return this.adjudications.find((verdict) => verdict.item.itemId === observationId) ?? null;
  }

  /** Why this write cannot go out now, or null. This is the single gate `run` uses. */
  gateFor(input: IdentityAttachInput): IdentityFence | null {
    if (this.port.source === "none") {
      return { reason: "not-bound" };
    }
    if (this.used.has(input.intentRef)) {
      return { reason: "duplicate-intent", intentRef: input.intentRef };
    }
    const item = this.adjudicationFor(input.observationId);
    const scope = item === null ? input.observationId : item.item.subjectRef;
    const open = this.intents.filter((intent) => intent.scope === scope);
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
      return this.refreshRequired !== null
        ? { reason: "snapshot-stale", cause: this.refreshRequired }
        : { reason: "no-snapshot" };
    }
    if (this.refreshRequired !== null) {
      return { reason: "snapshot-stale", cause: this.refreshRequired };
    }
    if (item !== null && item.verdict !== "current") {
      return { reason: "not-current", observationId: input.observationId, verdict: item.verdict };
    }
    return null;
  }

  /**
   * Sends one attach, once. The result is a receipt-shaped outcome or a reason
   * it was not sent. Nothing here sends a second time, mints an intent, or
   * compensates.
   */
  async run(input: IdentityAttachInput): Promise<IdentityStepResult> {
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
    const { request, scope } = built;
    this.used.add(input.intentRef);
    this.intentSeq += 1;
    const intent: IdentityIntent = {
      seq: this.intentSeq,
      intentRef: input.intentRef,
      scope,
      observationId: input.observationId,
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
    let outcome: IdentityWriteOutcome;
    try {
      outcome = await this.port.submit(request);
    } catch (error) {
      outcome = {
        kind: "unknown",
        step: "attach",
        intentRef: input.intentRef,
        contextKey: request.contextKey,
        message: error instanceof Error ? error.message : "The write failed after it was sent.",
      };
    }
    return this.settle(intent, outcome);
  }

  private checkShape(input: IdentityAttachInput): Extract<IdentityStepResult, { kind: "NOT_SENT" }> | null {
    if (typeof input.intentRef !== "string" || input.intentRef.trim().length === 0) {
      return { kind: "NOT_SENT", reason: "invalid-intent", detail: "A write carries an intent reference chosen by the caller." };
    }
    if (!isIdentityRef(input.observationId, "observation") && !isIdentityRef(input.observationId, "evidence")) {
      return { kind: "NOT_SENT", reason: "identity", detail: "An attach targets an observation or a receipt reference, not another kind." };
    }
    return null;
  }

  private buildRequest(
    input: IdentityAttachInput,
  ):
    | { kind: "BUILT"; request: IdentityWriteRequest; scope: string }
    | Extract<IdentityStepResult, { kind: "NOT_SENT" }> {
    const item = this.adjudicationFor(input.observationId);
    if (item === null) {
      return { kind: "NOT_SENT", reason: "unknown-ref", detail: `Item ${input.observationId} is not in the last read.` };
    }
    return {
      kind: "BUILT",
      scope: item.item.subjectRef,
      request: {
        contextKey: this.context.key,
        actorRef: this.context.actorRef,
        role: this.context.role,
        incarnation: this.context.incarnation,
        intentRef: input.intentRef,
        observationId: item.item.itemId,
        expectedCut: this.context.cutGeneration,
      },
    };
  }

  private settle(intent: IdentityIntent, outcome: IdentityWriteOutcome): IdentityStepResult {
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
        const untrusted = refuseIdentityReceipt(outcome.nonClaims);
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
        this.behindAfterSeq = this.readSeq;
        this.notify();
        return { kind: "CONFIRMED", intent: copyIntent(intent) };
      }
      case "rejected":
        intent.outcome = "REJECTED";
        intent.code = outcome.code;
        intent.message = outcome.detail;
        if (IDENTITY_STALE_CLASS_CODES.includes(outcome.code)) {
          this.refreshRequired = this.refreshRequired ?? "stale-rejection";
          this.behindAfterSeq = this.readSeq;
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
   * Records a late result against the unknown write it answers. The write
   * stays UNKNOWN and its fence stays. A late result for another context, or
   * for a write that is not unknown, is quarantined and changes nothing.
   */
  acceptLate(delivery: IdentityLateDelivery): IdentityLateResult {
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

  private quarantineLate(delivery: IdentityLateDelivery, cause: IdentityQuarantined["cause"]): IdentityLateResult {
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
// Projection: adjudicated rows and the session journal
// ---------------------------------------------------------------------------

export interface IdentityProjection {
  current: readonly ObservationVerdict[];
  stale: readonly ObservationVerdict[];
  foreign: readonly ObservationVerdict[];
  refused: readonly ObservationVerdict[];
  intents: readonly IdentityIntent[];
  isolated: readonly IdentityIsolatedSession[];
  freshness: IdentityFreshness;
}

export function projectIdentity(state: IdentityControllerState): IdentityProjection {
  const current: ObservationVerdict[] = [];
  const stale: ObservationVerdict[] = [];
  const foreign: ObservationVerdict[] = [];
  const refused: ObservationVerdict[] = [];
  for (const verdict of state.adjudications) {
    switch (verdict.verdict) {
      case "current":
        current.push(verdict);
        break;
      case "stale":
        stale.push(verdict);
        break;
      case "foreign":
        foreign.push(verdict);
        break;
      case "refused":
        refused.push(verdict);
        break;
    }
  }
  return {
    current,
    stale,
    foreign,
    refused,
    intents: state.intents.map(copyIntent),
    isolated: state.isolated.map((item) => ({ ...item })),
    freshness: state.freshness,
  };
}
