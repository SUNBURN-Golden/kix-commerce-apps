import {
  MOBILE_AS_OF,
  MOBILE_DEVICE_ID,
  MOBILE_ENVIRONMENT,
  MOBILE_STALE_CLASS_CODES,
  isMobileRef,
  refuseMobileReceipt,
  type MobileLateDelivery,
  type MobileOrderView,
  type MobileReadOutcome,
  type MobileShellPort,
  type MobileSnapshot,
  type MobileStep,
  type MobileSupportRow,
  type MobileVaultItem,
  type MobileWriteOutcome,
  type MobileWriteRefs,
  type MobileWriteRequest,
} from "./installable-mobile.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";

/**
 * Client side of the installable mobile shell: the write fence, the context
 * key, the resume gate, and the outcome reducer. It decides what the page may
 * send next and how to show what came back. It decides nothing about
 * validity, expiry, payment, or admission: those are the source's.
 *
 * Rules, all tested:
 *  - A write is sent once. A repeated intent, a write while another write in
 *    the same scope is in flight, and any write while an unknown or late
 *    result is outstanding in that scope are fenced and never reach the port.
 *  - A lost, cut-off, mis-correlated, or thrown response is UNKNOWN. UNKNOWN
 *    is not rejected and is not a success. A read, a resume, or a late result
 *    is recorded as evidence and does not lift the fence.
 *  - An app resume never re-sends anything. `resume()` marks the held
 *    snapshot resumed: every write stays fenced until an explicit read lands
 *    current evidence. The uncertain confirm or withdraw is not retried.
 *  - A result that arrives after the context changed (actor, session
 *    incarnation) is quarantined. It does not touch the current view.
 *  - A read while the link is down answers `offline`; the page keeps its
 *    cached copy and labels it cached, never current.
 *  - The device clock is report-only. A skewed or missing clock marks stored
 *    verdicts uncertain; it never decides validity.
 *  - A confirmed receipt that does not state every non-claim as literal false
 *    is untrusted, and the write is UNKNOWN.
 *  - The caller supplies each intent reference. This class never mints one.
 *  - Target fields (update, vault, order, expected version) are copied from
 *    the last read. They are never typed or raised by the client.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

export const MOBILE_OUTCOMES = ["DRAFT", "IN_FLIGHT", "CONFIRMED", "REJECTED", "UNKNOWN"] as const;

export type MobileOutcome = (typeof MOBILE_OUTCOMES)[number];

export const MOBILE_FRESHNESS = ["CURRENT", "STALE", "UNAVAILABLE"] as const;

export type MobileFreshness = (typeof MOBILE_FRESHNESS)[number];

export type MobileRefreshCause = "own-write" | "stale-rejection" | "context-switch" | "resumed";

export interface MobileContext {
  environment: "stub" | "integration-http";
  domain: string;
  /** A context label. It is not an authentication result. */
  actorRef: string;
  /** The synthetic device this context runs on. A label, not an attestation. */
  deviceId: string;
  /** Session incarnation. Bumped when the page switches context. */
  incarnation: number;
  key: string;
}

export interface MobileLateEvidence {
  result: "confirmed" | "rejected";
  code: string | null;
}

export interface MobileIntent {
  seq: number;
  intentRef: string;
  step: MobileStep;
  /** The scope writes are serialised on: "shell", "session", a vault ref, or an order ref. */
  scope: string;
  /** The reference the write targets. */
  targetRef: string;
  contextKey: string;
  outcome: MobileOutcome;
  code: string | null;
  message: string | null;
  refs: MobileWriteRefs | null;
  late: MobileLateEvidence | null;
}

export interface MobileQuarantined {
  intentRef: string;
  contextKey: string;
  /** What arrived: a port outcome kind or a late result. */
  arrived: string;
  code: string | null;
  cause: "context-changed" | "no-unknown-intent" | "different-context";
}

export type MobileFence =
  | { reason: "in-flight"; intentRef: string }
  | { reason: "unknown-outcome"; intentRef: string; lateRecorded: boolean; earlierContext: boolean }
  | { reason: "no-snapshot" }
  | { reason: "empty-device" }
  | { reason: "snapshot-stale"; cause: MobileRefreshCause }
  | { reason: "duplicate-intent"; intentRef: string }
  | { reason: "link-offline" }
  | { reason: "environment" }
  | { reason: "session-expired" }
  | { reason: "already-installed"; installRef: string }
  | { reason: "session-active"; sessionRef: string }
  | { reason: "no-update" }
  | { reason: "not-bound" };

export type MobileNotSentReason = "invalid-intent" | "identity" | "unknown-ref" | "tuple-changed" | "invalid-request";

export type MobileStepInput =
  | { step: "install"; intentRef: string }
  | { step: "update"; intentRef: string }
  | { step: "reconnect"; intentRef: string }
  | { step: "present"; intentRef: string; vaultRef: string }
  | { step: "confirm"; intentRef: string; orderRef: string }
  | { step: "withdraw"; intentRef: string; orderRef: string };

export type MobileStepResult =
  | { kind: "CONFIRMED"; intent: MobileIntent }
  | { kind: "REJECTED"; intent: MobileIntent }
  | { kind: "UNKNOWN"; intent: MobileIntent }
  | { kind: "QUARANTINED"; intent: MobileIntent }
  | { kind: "FENCED"; fence: MobileFence }
  | { kind: "NOT_SENT"; reason: MobileNotSentReason; detail: string };

export type MobileReadState =
  | "none"
  | "ready"
  | "empty"
  | "stale"
  | "offline"
  | "refused"
  | "environment-refused"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export type MobileRefreshResult =
  | { kind: "APPLIED"; readState: MobileReadState }
  | { kind: "DROPPED"; cause: "context-changed" | "older-read" };

export type MobileLateResult =
  | { kind: "RECORDED"; intent: MobileIntent }
  | { kind: "QUARANTINED"; cause: MobileQuarantined["cause"] };

export interface MobileCounters {
  /** Calls that reached port.submit. */
  sent: number;
  /** Writes the fence refused before the port. */
  fenced: number;
  notSent: number;
  droppedReads: number;
}

export interface MobileControllerState {
  context: MobileContext;
  readState: MobileReadState;
  readDetail: string | null;
  snapshot: MobileSnapshot | null;
  /**
   * True when the page holds a snapshot it could not freshen: the link is
   * down, the source served stale, or a read went unanswered. Cached copies
   * stay on screen and stay labelled cached; they are never current authority.
   */
  cached: boolean;
  freshness: MobileFreshness;
  refreshRequired: MobileRefreshCause | null;
  intents: readonly MobileIntent[];
  quarantined: readonly MobileQuarantined[];
  counters: MobileCounters;
  link: "online" | "offline";
}

function contextKeyOf(parts: Pick<MobileContext, "environment" | "domain" | "actorRef" | "deviceId" | "incarnation">): string {
  return [parts.environment, parts.domain, parts.actorRef, parts.deviceId, String(parts.incarnation)].join("|");
}

function copyIntent(intent: MobileIntent): MobileIntent {
  return {
    ...intent,
    refs: intent.refs === null ? null : { ...intent.refs },
    late: intent.late === null ? null : { ...intent.late },
  };
}

/** True while the held snapshot is evidence the page could not freshen. */
function isCachedRead(readState: MobileReadState): boolean {
  return readState === "offline" || readState === "stale" || readState === "unavailable";
}

export class MobileShellController {
  private context: MobileContext;
  private snapshot: MobileSnapshot | null = null;
  private readState: MobileReadState = "none";
  private readDetail: string | null = null;
  private refreshRequired: MobileRefreshCause | null = null;
  private floor: string | null = null;
  private readSeq = 0;
  private appliedReadSeq = 0;
  private intentSeq = 0;
  private readonly intents: MobileIntent[] = [];
  private readonly used = new Set<string>();
  private readonly quarantined: MobileQuarantined[] = [];
  private readonly counters: MobileCounters = { sent: 0, fenced: 0, notSent: 0, droppedReads: 0 };
  private readonly listeners = new Set<() => void>();
  private readonly deviceNow: () => string | null;

  constructor(
    private readonly port: MobileShellPort,
    options: {
      actorRef?: string;
      deviceId?: string;
      incarnation?: number;
      /** The device clock the page reports on each read. Default: a clock in step with the authority. */
      deviceNow?: () => string | null;
    } = {},
  ) {
    const incarnation = options.incarnation ?? 1;
    const parts = {
      environment: port.environment,
      domain: PINNED_PROTOCOL_DOMAIN,
      actorRef: options.actorRef ?? "mobile-owner",
      deviceId: options.deviceId ?? MOBILE_DEVICE_ID,
      incarnation,
    };
    this.context = { ...parts, key: contextKeyOf(parts) };
    this.deviceNow = options.deviceNow ?? (() => MOBILE_AS_OF);
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

  state(): MobileControllerState {
    let freshness: MobileFreshness = "UNAVAILABLE";
    if (this.readState === "ready" || this.readState === "empty") {
      freshness = this.refreshRequired === null ? "CURRENT" : "STALE";
    } else if (isCachedRead(this.readState) && this.snapshot !== null) {
      freshness = "STALE";
    }
    return {
      context: { ...this.context },
      readState: this.readState,
      readDetail: this.readDetail,
      snapshot: this.snapshot,
      cached: this.snapshot !== null && isCachedRead(this.readState),
      freshness,
      refreshRequired: this.refreshRequired,
      intents: this.intents.map(copyIntent),
      quarantined: this.quarantined.map((item) => ({ ...item })),
      counters: { ...this.counters },
      link: this.port.link(),
    };
  }

  /**
   * Starts a new context: another actor (re-login), or a new session
   * incarnation. A write that is in flight becomes UNKNOWN, because its
   * result will arrive in a context this controller has left. The snapshot is
   * dropped: the previous actor's cached copies are not shown under the new
   * actor. Fences stay: an unknown outcome in a scope still blocks it,
   * whichever context asks.
   */
  switchContext(next: { actorRef?: string; deviceId?: string } = {}): MobileContext {
    const parts = {
      environment: this.context.environment,
      domain: this.context.domain,
      actorRef: next.actorRef ?? this.context.actorRef,
      deviceId: next.deviceId ?? this.context.deviceId,
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

  /**
   * The app came back to the foreground. Resume sends nothing and resolves
   * nothing: it marks the held evidence resumed so every write stays fenced
   * until an explicit read lands current evidence. An unknown confirm or
   * withdraw stays unknown and is never re-executed.
   */
  resume(): void {
    if (this.snapshot !== null && this.refreshRequired === null) {
      this.refreshRequired = "resumed";
      this.notify();
    }
  }

  /** Explicit read. A read is evidence. It never resolves an unknown write. */
  async refresh(): Promise<MobileRefreshResult> {
    const key = this.context.key;
    this.readSeq += 1;
    const seq = this.readSeq;
    let outcome: MobileReadOutcome;
    try {
      outcome = await this.port.read({
        contextKey: key,
        actorRef: this.context.actorRef,
        deviceId: this.context.deviceId,
        watermarkFloor: this.floor,
        deviceNow: this.deviceNow(),
      });
    } catch (error) {
      outcome = { kind: "unknown", detail: error instanceof Error ? error.message : "The read failed." };
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
        if (outcome.snapshot.environment.shellEnvironment !== MOBILE_ENVIRONMENT) {
          this.snapshot = null;
          this.readState = "environment-refused";
          this.readDetail =
            "The source declares a production environment. This shell serves installable-sandbox only, so nothing was read and nothing was applied.";
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
        // The source answered behind the floor. The held snapshot stays as a
        // cached copy: stored items keep their verdict-at labels and never
        // read as current authority.
        this.readState = "stale";
        this.readDetail = `Watermark ${outcome.watermark} is older than the floor ${outcome.floor}. Stored items stay cached copies.`;
        break;
      case "offline":
        this.readState = "offline";
        this.readDetail = outcome.detail;
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
        // The read went unanswered. The held snapshot stays cached, never current.
        this.readState = "unavailable";
        this.readDetail = outcome.detail;
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
  gateFor(input: MobileStepInput): MobileFence | null {
    if (this.port.source === "none") {
      return { reason: "not-bound" };
    }
    if (this.used.has(input.intentRef)) {
      return { reason: "duplicate-intent", intentRef: input.intentRef };
    }
    const scope = this.scopeOf(input);
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
    if (this.readState === "environment-refused") {
      return { reason: "environment" };
    }
    if (this.port.link() === "offline") {
      return { reason: "link-offline" };
    }
    if (this.snapshot === null) {
      if (this.readState === "empty" && this.refreshRequired === null) {
        return input.step === "install" ? null : { reason: "empty-device" };
      }
      return this.refreshRequired !== null ? { reason: "snapshot-stale", cause: this.refreshRequired } : { reason: "no-snapshot" };
    }
    if (this.refreshRequired !== null) {
      return { reason: "snapshot-stale", cause: this.refreshRequired };
    }
    const snapshot = this.snapshot;
    if (input.step === "install") {
      return snapshot.install.state === "installed"
        ? { reason: "already-installed", installRef: snapshot.install.installRef ?? "installed" }
        : null;
    }
    if (input.step === "update") {
      if (snapshot.install.state !== "installed") {
        return { reason: "empty-device" };
      }
      return snapshot.install.update === null ? { reason: "no-update" } : null;
    }
    if (input.step === "reconnect") {
      if (snapshot.install.state !== "installed") {
        return { reason: "empty-device" };
      }
      return snapshot.session.verdict === "active" && snapshot.session.actorRef === this.context.actorRef
        ? { reason: "session-active", sessionRef: snapshot.session.sessionRef ?? "active" }
        : null;
    }
    // present, confirm, withdraw need an active session for this actor.
    if (snapshot.session.verdict !== "active" || snapshot.session.actorRef !== this.context.actorRef) {
      return { reason: "session-expired" };
    }
    return null;
  }

  private scopeOf(input: MobileStepInput): string {
    if (input.step === "install" || input.step === "update") {
      return "shell";
    }
    if (input.step === "reconnect") {
      return "session";
    }
    if (input.step === "present") {
      return input.vaultRef;
    }
    return input.orderRef;
  }

  /**
   * Sends one write, once. The result is a receipt-shaped outcome or a reason it was
   * not sent. Nothing here sends a second time, mints an intent, or compensates.
   */
  async run(input: MobileStepInput): Promise<MobileStepResult> {
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
    const intent: MobileIntent = {
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
    let outcome: MobileWriteOutcome;
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

  private checkShape(input: MobileStepInput): Extract<MobileStepResult, { kind: "NOT_SENT" }> | null {
    if (typeof input.intentRef !== "string" || input.intentRef.trim().length === 0) {
      return { kind: "NOT_SENT", reason: "invalid-intent", detail: "A write carries an intent reference chosen by the caller." };
    }
    if (input.step === "present" && !isMobileRef(input.vaultRef, "vault")) {
      return { kind: "NOT_SENT", reason: "identity", detail: "A presentation targets a vault reference, not a session or an order." };
    }
    if ((input.step === "confirm" || input.step === "withdraw") && !isMobileRef(input.orderRef, "order")) {
      return { kind: "NOT_SENT", reason: "identity", detail: `A ${input.step} targets an order reference, not a vault or a session.` };
    }
    return null;
  }

  private buildRequest(
    input: MobileStepInput,
  ):
    | { kind: "BUILT"; request: MobileWriteRequest; scope: string; targetRef: string }
    | Extract<MobileStepResult, { kind: "NOT_SENT" }> {
    const base = {
      contextKey: this.context.key,
      actorRef: this.context.actorRef,
      deviceId: this.context.deviceId,
      intentRef: input.intentRef,
      declaredEnvironment: MOBILE_ENVIRONMENT,
    };
    if (input.step === "install") {
      return {
        kind: "BUILT",
        scope: "shell",
        targetRef: this.context.deviceId,
        request: { ...base, step: "install", packaging: "installable-web" },
      };
    }
    const snapshot = this.snapshot;
    if (snapshot === null) {
      return { kind: "NOT_SENT", reason: "unknown-ref", detail: "No read to copy the target fields from." };
    }
    if (input.step === "update") {
      const update = snapshot.install.update;
      if (update === null) {
        return { kind: "NOT_SENT", reason: "unknown-ref", detail: "No update is offered in the last read." };
      }
      return {
        kind: "BUILT",
        scope: "shell",
        targetRef: update.updateRef,
        request: { ...base, step: "update", updateRef: update.updateRef, expectedVersion: snapshot.install.version },
      };
    }
    if (input.step === "reconnect") {
      return {
        kind: "BUILT",
        scope: "session",
        targetRef: snapshot.session.sessionRef ?? this.context.actorRef,
        request: { ...base, step: "reconnect" },
      };
    }
    if (input.step === "present") {
      const item = snapshot.vault.find((entry) => entry.vaultRef === input.vaultRef);
      if (!item) {
        return { kind: "NOT_SENT", reason: "unknown-ref", detail: `${input.vaultRef} is not in the last read.` };
      }
      return {
        kind: "BUILT",
        scope: item.vaultRef,
        targetRef: item.vaultRef,
        request: { ...base, step: "present", vaultRef: item.vaultRef },
      };
    }
    const order = snapshot.order;
    if (order === null || order.orderRef !== input.orderRef) {
      return { kind: "NOT_SENT", reason: "unknown-ref", detail: `${input.orderRef} is not in the last read.` };
    }
    return {
      kind: "BUILT",
      scope: order.orderRef,
      targetRef: order.orderRef,
      request: { ...base, step: input.step, orderRef: order.orderRef, expectedVersion: order.version },
    };
  }

  private settle(intent: MobileIntent, outcome: MobileWriteOutcome): MobileStepResult {
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
        const untrusted = refuseMobileReceipt(outcome.nonClaims);
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
        if ((MOBILE_STALE_CLASS_CODES as readonly string[]).includes(outcome.code)) {
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
   * UNKNOWN and its fence stays. A late result for another context, or for a
   * write that is not unknown, is quarantined and changes nothing.
   */
  acceptLate(delivery: MobileLateDelivery): MobileLateResult {
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

  private quarantineLate(delivery: MobileLateDelivery, cause: MobileQuarantined["cause"]): MobileLateResult {
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
// Projection: install, session, vault, and order as separate lines
// ---------------------------------------------------------------------------

/** How the page may treat a stored verdict: current, a cached copy, or clock-uncertain. */
export const MOBILE_CURRENCY_WORDS = ["current", "cached", "clock-uncertain"] as const;

export type MobileCurrencyWord = (typeof MOBILE_CURRENCY_WORDS)[number];

export interface MobileVaultView {
  vaultRef: string;
  kind: "pass" | "receipt";
  label: string;
  ownerRef: string;
  /** True when the vault copy belongs to the context actor. */
  ownerMatch: boolean;
  cachedAt: string;
  authorityVerdict: string;
  verdictAt: string;
  currency: MobileCurrencyWord;
  /** A stored copy never grants admission, whatever its verdict. */
  grantsAdmission: false;
  /** This page's own write on the presentation line for this item. */
  present: { outcome: MobileOutcome; code: string | null; intentRef: string; presentationRef: string | null } | null;
}

export interface MobileOrderProjection {
  orderRef: string;
  state: MobileOrderView["state"];
  version: number;
  amount: string | null;
  currency: string;
  paymentRef: string | null;
  withdrawalRef: string | null;
  /** This page's own write outcomes on the confirm and withdraw lines. */
  confirm: { outcome: MobileOutcome; code: string | null; intentRef: string } | null;
  withdraw: { outcome: MobileOutcome; code: string | null; intentRef: string } | null;
}

export interface MobileProjection {
  install: MobileSnapshot["install"] | null;
  session: MobileSnapshot["session"] | null;
  clock: MobileSnapshot["clock"] | null;
  vault: readonly MobileVaultView[];
  order: MobileOrderProjection | null;
  support: readonly MobileSupportRow[];
  /** True while the page shows a cached copy: not current authority. */
  cached: boolean;
  /** Writes of this page that no snapshot row explains. */
  unlinkedIntents: readonly MobileIntent[];
  freshness: MobileFreshness;
}

function currencyOf(cached: boolean, clock: MobileSnapshot["clock"] | null): MobileCurrencyWord {
  if (cached) {
    return "cached";
  }
  if (clock === null || clock.verdict !== "in-step") {
    return "clock-uncertain";
  }
  return "current";
}

function latestIntent(
  intents: readonly MobileIntent[],
  step: MobileStep,
  targetRef: string,
): MobileIntent | undefined {
  return [...intents].reverse().find((intent) => intent.step === step && intent.targetRef === targetRef);
}

export function projectMobile(state: MobileControllerState): MobileProjection {
  const snapshot = state.snapshot;
  const cached = snapshot !== null && isCachedRead(state.readState);
  const clock = snapshot?.clock ?? null;
  const currency = currencyOf(cached, clock);
  const explained = new Set<string>();

  const vault: MobileVaultView[] = (snapshot?.vault ?? []).map((item: MobileVaultItem) => {
    const present = latestIntent(state.intents, "present", item.vaultRef);
    if (present) {
      explained.add(present.intentRef);
    }
    return {
      vaultRef: item.vaultRef,
      kind: item.kind,
      label: item.label,
      ownerRef: item.ownerRef,
      ownerMatch: item.ownerRef === state.context.actorRef,
      cachedAt: item.cachedAt,
      authorityVerdict: item.authorityVerdict,
      verdictAt: item.verdictAt,
      currency,
      grantsAdmission: false,
      present:
        present === undefined
          ? null
          : {
              outcome: present.outcome,
              code: present.code,
              intentRef: present.intentRef,
              presentationRef: present.refs?.presentationRef ?? null,
            },
    };
  });

  let order: MobileOrderProjection | null = null;
  if (snapshot?.order) {
    const source = snapshot.order;
    const confirm = latestIntent(state.intents, "confirm", source.orderRef);
    const withdraw = latestIntent(state.intents, "withdraw", source.orderRef);
    for (const intent of [confirm, withdraw]) {
      if (intent) {
        explained.add(intent.intentRef);
      }
    }
    order = {
      orderRef: source.orderRef,
      state: source.state,
      version: source.version,
      amount: source.amount,
      currency: source.currency,
      paymentRef: source.paymentRef,
      withdrawalRef: source.withdrawalRef,
      confirm: confirm ? { outcome: confirm.outcome, code: confirm.code, intentRef: confirm.intentRef } : null,
      withdraw: withdraw ? { outcome: withdraw.outcome, code: withdraw.code, intentRef: withdraw.intentRef } : null,
    };
  }

  // Install, update, and reconnect intents are explained when their receipt
  // refs are the ones the snapshot still shows.
  for (const intent of state.intents) {
    if (intent.outcome !== "CONFIRMED" || intent.refs === null) {
      continue;
    }
    if (intent.step === "install" && snapshot?.install.installRef === intent.refs.installRef) {
      explained.add(intent.intentRef);
    }
    if (intent.step === "update" && snapshot?.install.shellRef === intent.refs.shellRef) {
      explained.add(intent.intentRef);
    }
    if (intent.step === "reconnect" && snapshot?.session.sessionRef === intent.refs.sessionRef) {
      explained.add(intent.intentRef);
    }
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

  return {
    install: snapshot?.install ?? null,
    session: snapshot?.session ?? null,
    clock,
    vault,
    order,
    support: snapshot?.support ?? [],
    cached,
    unlinkedIntents,
    freshness: state.freshness,
  };
}
