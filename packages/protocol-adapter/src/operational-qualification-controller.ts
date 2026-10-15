import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import {
  QUALIFICATION_NOT_BOUND_REASON,
  refuseQualificationPacket,
  type QualificationPacket,
  type QualificationRunOutcome,
  type QualificationRunnerPort,
} from "./operational-qualification.js";

/**
 * Client side of the qualification run: the intent fence, the context key, and
 * the outcome reducer. It decides when a run may go out and how to show what
 * came back. It decides nothing about qualification: the packet the source
 * produced is a record, and a packet that fails the integrity check makes the
 * run unknown.
 *
 * Rules, all tested:
 *  - A run is sent once. A repeated intent, a run while another is in flight,
 *    and a run while an earlier run's outcome is unknown are fenced and never
 *    reach the port.
 *  - A lost, cut-off, mis-correlated, thrown, or untrusted answer is UNKNOWN.
 *    UNKNOWN is not a rejection and not a success; nothing retries it. The
 *    packet integrity check is total and the reducer is guarded, so a
 *    malformed answer can never leave the intent in flight.
 *  - A result that arrives after the context changed (actor, session
 *    incarnation) is quarantined. It does not touch the held packet.
 *  - The caller supplies each intent reference. This class never mints one.
 *  - A packet is stored only when the integrity check passes. A packet that
 *    claims a promotion, a deploy, a real payment, or a completed review
 *    leaves the run UNKNOWN.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const QUALIFICATION_OUTCOMES = ["DRAFT", "IN_FLIGHT", "CONFIRMED", "REJECTED", "UNKNOWN"] as const;

export type QualificationOutcome = (typeof QUALIFICATION_OUTCOMES)[number];

export interface QualificationContext {
  environment: "stub" | "integration-http";
  domain: string;
  /** A context label. It is not an authentication result. */
  actorRef: string;
  /** Session incarnation. Bumped when the page switches context. */
  incarnation: number;
  key: string;
}

export interface QualificationIntent {
  seq: number;
  intentRef: string;
  contextKey: string;
  outcome: QualificationOutcome;
  code: string | null;
  message: string | null;
  packetId: string | null;
}

export interface QualificationQuarantined {
  intentRef: string;
  contextKey: string;
  /** What arrived: a port outcome kind. */
  arrived: string;
  code: string | null;
  cause: "context-changed";
}

export type QualificationFence =
  | { reason: "in-flight"; intentRef: string }
  | { reason: "unknown-outcome"; intentRef: string; earlierContext: boolean }
  | { reason: "duplicate-intent"; intentRef: string }
  | { reason: "not-bound" };

export type QualificationNotSentReason = "invalid-intent" | "tuple-changed" | "invalid-request";

export type QualificationRunResult =
  | { kind: "CONFIRMED"; intent: QualificationIntent; packet: QualificationPacket }
  | { kind: "REJECTED"; intent: QualificationIntent }
  | { kind: "UNKNOWN"; intent: QualificationIntent }
  | { kind: "QUARANTINED"; intent: QualificationIntent }
  | { kind: "FENCED"; fence: QualificationFence }
  | { kind: "NOT_SENT"; reason: QualificationNotSentReason; detail: string };

export type QualificationRunState =
  | "none"
  | "in-flight"
  | "ready"
  | "rejected"
  | "unknown"
  | "refused"
  | "not-bound"
  | "tuple-changed";

export interface QualificationCounters {
  /** Calls that reached port.run. */
  sent: number;
  /** Runs the fence refused before the port. */
  fenced: number;
  notSent: number;
}

export interface QualificationControllerState {
  context: QualificationContext;
  runState: QualificationRunState;
  runDetail: string | null;
  packet: QualificationPacket | null;
  intents: readonly QualificationIntent[];
  quarantined: readonly QualificationQuarantined[];
  counters: QualificationCounters;
}

function contextKeyOf(parts: Pick<QualificationContext, "environment" | "domain" | "actorRef" | "incarnation">): string {
  return [parts.environment, parts.domain, parts.actorRef, String(parts.incarnation)].join("|");
}

function copyIntent(intent: QualificationIntent): QualificationIntent {
  return { ...intent };
}

export class OperationalQualificationController {
  private context: QualificationContext;
  private packet: QualificationPacket | null = null;
  private runState: QualificationRunState = "none";
  private runDetail: string | null = null;
  private intentSeq = 0;
  private readonly intents: QualificationIntent[] = [];
  private readonly used = new Set<string>();
  private readonly quarantined: QualificationQuarantined[] = [];
  private readonly counters: QualificationCounters = { sent: 0, fenced: 0, notSent: 0 };
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly port: QualificationRunnerPort,
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

  state(): QualificationControllerState {
    return {
      context: { ...this.context },
      runState: this.runState,
      runDetail: this.runDetail,
      packet: this.packet,
      intents: this.intents.map(copyIntent),
      quarantined: this.quarantined.map((item) => ({ ...item })),
      counters: { ...this.counters },
    };
  }

  /**
   * Starts a new context: another actor, or a new session incarnation. A run
   * that is in flight becomes UNKNOWN, because its answer will arrive in a
   * context this controller has left. The held packet is dropped: the earlier
   * context's packet is not shown under the new actor. An unknown run still
   * blocks the next run, whichever context asks.
   */
  switchContext(next: { actorRef?: string } = {}): QualificationContext {
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
        intent.message = "The session context changed while this run was in flight. Its answer is not applied.";
      }
    }
    this.packet = null;
    this.runState = "none";
    this.runDetail = null;
    this.notify();
    return { ...this.context };
  }

  /** Why this run cannot go out now, or null. This is the single gate `run` uses. */
  gateFor(intentRef: string): QualificationFence | null {
    if (this.port.source === "none") {
      return { reason: "not-bound" };
    }
    if (this.used.has(intentRef)) {
      return { reason: "duplicate-intent", intentRef };
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
        earlierContext: unknown.contextKey !== this.context.key,
      };
    }
    return null;
  }

  /**
   * Sends one qualification run, once. The result is a packet-shaped outcome
   * or a reason it was not sent. Nothing here sends a second time, mints an
   * intent, or promotes the packet.
   */
  async run(intentRef: string): Promise<QualificationRunResult> {
    if (typeof intentRef !== "string" || intentRef.trim().length === 0) {
      this.counters.notSent += 1;
      this.notify();
      return { kind: "NOT_SENT", reason: "invalid-intent", detail: "A run carries an intent reference chosen by the caller." };
    }
    const fence = this.gateFor(intentRef);
    if (fence !== null) {
      this.counters.fenced += 1;
      this.notify();
      return { kind: "FENCED", fence };
    }
    this.used.add(intentRef);
    this.intentSeq += 1;
    const intent: QualificationIntent = {
      seq: this.intentSeq,
      intentRef,
      contextKey: this.context.key,
      outcome: "IN_FLIGHT",
      code: null,
      message: null,
      packetId: null,
    };
    this.intents.push(intent);
    this.counters.sent += 1;
    this.runState = "in-flight";
    this.runDetail = null;
    this.notify();
    let outcome: QualificationRunOutcome;
    try {
      outcome = await this.port.run({ contextKey: intent.contextKey, intentRef });
    } catch (error) {
      outcome = {
        kind: "unknown",
        intentRef,
        contextKey: intent.contextKey,
        detail: error instanceof Error ? error.message : "The run failed after it was sent.",
      };
    }
    try {
      return this.settle(intent, outcome);
    } catch (error) {
      // The answer could not even be reduced — a malformed packet must not
      // leave the intent in flight. It is untrusted: the run stays unknown.
      intent.outcome = "UNKNOWN";
      intent.code = intent.code ?? "UNTRUSTED_PACKET";
      intent.message =
        intent.message ??
        `The run's answer could not be applied (${error instanceof Error ? error.message : "unknown error"}). It may or may not have recorded a packet.`;
      this.packet = null;
      this.runState = "unknown";
      this.runDetail = intent.message;
      this.notify();
      return { kind: "UNKNOWN", intent: copyIntent(intent) };
    }
  }

  private settle(intent: QualificationIntent, outcome: QualificationRunOutcome): QualificationRunResult {
    if (intent.outcome !== "IN_FLIGHT") {
      this.quarantined.push({
        intentRef: intent.intentRef,
        contextKey: intent.contextKey,
        arrived: outcome.kind,
        code: outcome.kind === "refused" || outcome.kind === "invalid-request" ? outcome.code : null,
        cause: "context-changed",
      });
      this.notify();
      return { kind: "QUARANTINED", intent: copyIntent(intent) };
    }
    const correlated =
      outcome.kind === "not-bound" ||
      (outcome.intentRef === intent.intentRef && outcome.contextKey === intent.contextKey);
    if (!correlated) {
      intent.outcome = "UNKNOWN";
      intent.code = "CORRELATION";
      intent.message = "The answer named a different intent or context than the one sent.";
      this.runState = "unknown";
      this.runDetail = intent.message;
      this.notify();
      return { kind: "UNKNOWN", intent: copyIntent(intent) };
    }
    switch (outcome.kind) {
      case "ready": {
        const refusal = refuseQualificationPacket(outcome.packet);
        if (refusal !== null) {
          intent.outcome = "UNKNOWN";
          intent.code = "UNTRUSTED_PACKET";
          intent.message = refusal.detail;
          this.packet = null;
          this.runState = "unknown";
          this.runDetail = refusal.detail;
          this.notify();
          return { kind: "UNKNOWN", intent: copyIntent(intent) };
        }
        intent.outcome = "CONFIRMED";
        intent.packetId = outcome.packet.packetId;
        this.packet = outcome.packet;
        this.runState = "ready";
        this.runDetail = null;
        this.notify();
        return { kind: "CONFIRMED", intent: copyIntent(intent), packet: outcome.packet };
      }
      case "refused":
        intent.outcome = "REJECTED";
        intent.code = outcome.code;
        intent.message = outcome.detail;
        this.packet = null;
        this.runState = "refused";
        this.runDetail = outcome.detail;
        this.notify();
        return { kind: "REJECTED", intent: copyIntent(intent) };
      case "unknown":
        intent.outcome = "UNKNOWN";
        intent.code = "RESPONSE_LOST";
        intent.message = outcome.detail;
        this.packet = null;
        this.runState = "unknown";
        this.runDetail = outcome.detail;
        this.notify();
        return { kind: "UNKNOWN", intent: copyIntent(intent) };
      case "tuple-changed":
        intent.outcome = "DRAFT";
        intent.code = "TUPLE_CHANGED";
        intent.message = `The pin tuple field ${outcome.field} changed. Nothing was applied.`;
        this.runState = "tuple-changed";
        this.runDetail = intent.message;
        this.counters.notSent += 1;
        this.notify();
        return { kind: "NOT_SENT", reason: "tuple-changed", detail: intent.message };
      case "invalid-request":
        intent.outcome = "DRAFT";
        intent.code = outcome.code;
        intent.message = outcome.detail;
        this.runState = "none";
        this.runDetail = outcome.detail;
        this.counters.notSent += 1;
        this.notify();
        return { kind: "NOT_SENT", reason: "invalid-request", detail: outcome.detail };
      case "not-bound":
        intent.outcome = "DRAFT";
        intent.code = "NOT_BOUND";
        intent.message = outcome.reason;
        this.runState = "not-bound";
        this.runDetail = outcome.reason;
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

/** Why a run is off. Each fence maps to one sentence and no fence is a failure of the page. */
export function qualificationFenceLine(fence: QualificationFence): string {
  switch (fence.reason) {
    case "in-flight":
      return `A qualification run is in flight (${fence.intentRef}). Wait for its answer.`;
    case "unknown-outcome": {
      const earlier = fence.earlierContext ? " It was sent in an earlier session context." : "";
      return `An earlier run has an unknown result (${fence.intentRef}).${earlier} Runs stay blocked. Nothing retries it.`;
    }
    case "duplicate-intent":
      return `Intent ${fence.intentRef} was already used. A run is sent once; this page does not mint a new intent for it.`;
    case "not-bound":
      return QUALIFICATION_NOT_BOUND_REASON;
    default: {
      const exhaustive: never = fence;
      return exhaustive;
    }
  }
}
