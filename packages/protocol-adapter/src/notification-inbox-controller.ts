import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import {
  NOTIFY_BUYER_ACTOR,
  NOTIFY_NOT_BOUND_REASON,
  NOTIFY_OWN,
  assessNotifySnapshot,
  isNotifyRef,
  notifyCapabilities,
  notifyEligibility,
  type NotificationInboxPort,
  type NotifyActionKind,
  type NotifyActionRequest,
  type NotifyActOutcome,
  type NotifyAssessment,
  type NotifyCapability,
  type NotifyEligibility,
  type NotifyInquiry,
  type NotifyInquiryOutcome,
  type NotifyReadOutcome,
  type NotifyReceipt,
  type NotifyRole,
  type NotifyScope,
  type NotifySnapshot,
} from "./notification-inbox.js";

/**
 * Client side of the notification inbox: the context key, the read and inquiry
 * reducers, the request fence, and the drop rules. It decides what the screen
 * may show next and which request it may send next. It decides nothing about
 * access: every row it holds is the source's, and hiding a control never stands
 * in for the port's own check.
 *
 * Rules, all tested:
 *  - A context names a tenant, an actor, and a role. A different tenant, a
 *    different actor, or a different role is a different context, a new session
 *    incarnation, and a cleared view. The same person's second role is a second
 *    context, so an old session's notifications never mix with a new one.
 *  - A read, an inquiry, and a request are each one port call. A failed or lost
 *    one is shown as unavailable or unknown and is not sent again by this
 *    class. The next call is the person's, and an unknown request outcome
 *    fences every later request.
 *  - A request body is built from the last ready read. The notification ref is
 *    copied from it and is never typed or minted here, and the request carries
 *    the grant generation that read reported so the source can reject a request
 *    built under an old grant. A stale-issued notification's offered action is
 *    blocked here, and the port rejects it on its own check anyway.
 *  - A request is sent only when the read offers it, the role holds the
 *    capability it needs, the read is the latest the page holds, and no other
 *    request is in flight or unknown. A hidden control is not a check: the port
 *    decides every request that reaches it.
 *  - A deep-open is a read that names a notification ref. The ref is copied
 *    from a row or a URL, never guessed, and the source answers a ref outside
 *    the tenant or addressed to another subject with denied, never a row.
 *  - A read or an inquiry that arrives after the context changed, or after a
 *    newer one of its kind was applied, is dropped. Any read that is not ready,
 *    and any context change, clears the rows and the inquiry material.
 *  - A notification arrival confirms no economic effect, and a resolve yields a
 *    destination, not a send. Nothing here wires an external send or provider
 *    API.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const NOTIFY_FRESHNESS = ["CURRENT", "STALE", "UNAVAILABLE"] as const;

export type NotifyFreshness = (typeof NOTIFY_FRESHNESS)[number];

export type NotifyReadState =
  | "none"
  | "ready"
  | "empty"
  | "stale"
  | "generation-stale"
  | "denied"
  | "refused"
  | "invalid"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export type NotifyInquiryPhase =
  | "none"
  | "loaded"
  | "denied"
  | "refused"
  | "invalid"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export type NotifyActPhase =
  | "applied"
  | "rejected"
  | "denied"
  | "refused"
  | "invalid"
  | "tuple-changed"
  | "not-bound"
  | "unknown";

export interface NotifyContext {
  environment: "stub" | "integration-http";
  domain: string;
  /** A context label. It is not an authentication result. */
  actorRef: string;
  /** The tenant and the role the actor acts under. */
  scope: NotifyScope;
  /** Session incarnation. Bumped on every context switch. */
  incarnation: number;
  key: string;
}

export interface NotifyCounters {
  reads: number;
  inquiries: number;
  acts: number;
  /** Inquiries and requests refused before the port. */
  notSent: number;
  droppedReads: number;
  droppedInquiries: number;
}

export interface NotifyInquiryState {
  phase: NotifyInquiryPhase;
  code: string | null;
  detail: string | null;
  value: NotifyInquiry | null;
}

/** The last request that reached the port, and how it came back. */
export interface NotifyActRecord {
  seq: number;
  action: NotifyActionRequest;
  phase: NotifyActPhase;
  code: string | null;
  detail: string | null;
  receipt: NotifyReceipt | null;
}

export type NotifyFence =
  | { reason: "in-flight"; action: NotifyActionKind }
  | { reason: "unknown-outcome"; seq: number; action: NotifyActionKind };

export interface NotifyControllerState {
  context: NotifyContext;
  readState: NotifyReadState;
  readCode: string | null;
  readDetail: string | null;
  snapshot: NotifySnapshot | null;
  assessment: NotifyAssessment | null;
  freshness: NotifyFreshness;
  inquiry: NotifyInquiryState;
  /** True after a request reached the source and no newer ready read has landed. */
  behind: boolean;
  fence: NotifyFence | null;
  last: NotifyActRecord | null;
  /** Unknown outcomes left in sessions this page no longer holds. They are not forgotten. */
  earlierUnknown: number;
  counters: NotifyCounters;
}

export type NotifyReadResult =
  | { kind: "APPLIED"; readState: NotifyReadState }
  | { kind: "DROPPED"; cause: "context-changed" | "older-read" };

export type NotifyInquiryResult =
  | { kind: "APPLIED"; phase: NotifyInquiryPhase }
  | { kind: "DROPPED"; cause: "context-changed" | "older-inquiry" | "read-not-ready" }
  | { kind: "NOT_SENT"; reason: "not-bound" | "no-snapshot" | "no-capability" | "bad-ref"; detail: string };

export type NotifyNotSentReason =
  | "not-bound"
  | "no-snapshot"
  | "stale-read"
  | "blocked"
  | "no-capability"
  | "unknown-ref";

export type NotifyActResult =
  | { kind: "APPLIED"; record: NotifyActRecord }
  | { kind: "REJECTED"; record: NotifyActRecord }
  | { kind: "UNKNOWN"; record: NotifyActRecord }
  | { kind: "FENCED"; fence: NotifyFence }
  | { kind: "NOT_SENT"; reason: NotifyNotSentReason; detail: string };

function contextKeyOf(parts: Pick<NotifyContext, "environment" | "domain" | "actorRef" | "scope" | "incarnation">): string {
  return [parts.environment, parts.domain, parts.actorRef, parts.scope.tenantId, parts.scope.role, String(parts.incarnation)].join("|");
}

function failureText(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : "The call failed.";
}

/** The capability a request kind needs at the source. */
function capabilityFor(kind: NotifyActionKind): NotifyCapability {
  return kind === "mark-read" ? "mark-read" : "resolve-action";
}

const NO_INQUIRY: NotifyInquiryState = { phase: "none", code: null, detail: null, value: null };

export class NotificationInboxController {
  private context: NotifyContext;
  private snapshot: NotifySnapshot | null = null;
  private assessment: NotifyAssessment | null = null;
  private readState: NotifyReadState = "none";
  private readCode: string | null = null;
  private readDetail: string | null = null;
  private floor: string | null = null;
  /** The grant generation the last ready read reported, or null before one. */
  private grantGeneration: number | null = null;
  private readSeq = 0;
  private appliedReadSeq = 0;
  private inquirySeq = 0;
  private appliedInquirySeq = 0;
  private inquiryPhase: NotifyInquiryPhase = "none";
  private inquiryCode: string | null = null;
  private inquiryDetail: string | null = null;
  private inquiryValue: NotifyInquiry | null = null;
  private actSeq = 0;
  private behind = false;
  private inFlight: NotifyActionKind | null = null;
  private fence: NotifyFence | null = null;
  private last: NotifyActRecord | null = null;
  private earlierUnknown = 0;
  private actsDone = 0;
  private readonly counters: NotifyCounters = { reads: 0, inquiries: 0, acts: 0, notSent: 0, droppedReads: 0, droppedInquiries: 0 };
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly port: NotificationInboxPort,
    options: { actorRef?: string; tenantId?: string; role?: NotifyRole; incarnation?: number } = {},
  ) {
    const parts = {
      environment: port.environment,
      domain: PINNED_PROTOCOL_DOMAIN,
      actorRef: options.actorRef ?? NOTIFY_BUYER_ACTOR,
      scope: { tenantId: options.tenantId ?? NOTIFY_OWN, role: options.role ?? ("buyer" as NotifyRole) },
      incarnation: options.incarnation ?? 1,
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

  state(): NotifyControllerState {
    let freshness: NotifyFreshness = "UNAVAILABLE";
    if (this.readState === "ready" || this.readState === "empty") {
      freshness = "CURRENT";
    } else if (this.readState === "stale" || this.readState === "generation-stale") {
      freshness = "STALE";
    }
    return {
      context: { ...this.context, scope: { ...this.context.scope } },
      readState: this.readState,
      readCode: this.readCode,
      readDetail: this.readDetail,
      snapshot: this.snapshot,
      assessment: this.assessment,
      freshness,
      inquiry:
        this.inquiryPhase === "none" && this.inquiryValue === null
          ? { ...NO_INQUIRY }
          : { phase: this.inquiryPhase, code: this.inquiryCode, detail: this.inquiryDetail, value: this.inquiryValue },
      behind: this.behind,
      fence: this.currentFence(),
      last: this.last,
      earlierUnknown: this.earlierUnknown,
      counters: { ...this.counters },
    };
  }

  private currentFence(): NotifyFence | null {
    if (this.inFlight !== null) {
      return { reason: "in-flight", action: this.inFlight };
    }
    return this.fence;
  }

  private clearView(): void {
    this.snapshot = null;
    this.assessment = null;
    this.clearInquiry();
  }

  private clearInquiry(): void {
    this.inquiryPhase = "none";
    this.inquiryCode = null;
    this.inquiryDetail = null;
    this.inquiryValue = null;
  }

  /** Starts a new context for a different tenant, actor, or role. */
  private switchParts(next: { actorRef?: string; tenantId?: string; role?: NotifyRole }): NotifyContext | null {
    if (this.inFlight !== null) {
      return null;
    }
    if (this.fence !== null) {
      this.earlierUnknown += 1;
    }
    const parts = {
      environment: this.context.environment,
      domain: this.context.domain,
      actorRef: next.actorRef ?? this.context.actorRef,
      scope: {
        tenantId: next.tenantId ?? this.context.scope.tenantId,
        role: next.role ?? this.context.scope.role,
      },
      incarnation: this.context.incarnation + 1,
    };
    this.context = { ...parts, key: contextKeyOf(parts) };
    this.clearView();
    this.readState = "none";
    this.readCode = null;
    this.readDetail = null;
    this.floor = null;
    this.grantGeneration = null;
    this.behind = false;
    this.fence = null;
    this.last = null;
    this.notify();
    return { ...this.context, scope: { ...this.context.scope } };
  }

  /**
   * Starts a new context for another tenant. Rows and the inquiry material of
   * the earlier tenant are cleared, and a read or an inquiry still in flight
   * for it is dropped when it arrives, so one tenant's notifications cannot
   * stay on another tenant's screen. It refuses while a request is in flight.
   * An unknown outcome of the earlier context is counted, not forgotten.
   */
  switchTenant(tenantId: string): NotifyContext | null {
    return this.switchParts({ tenantId });
  }

  /**
   * Starts a new context for another person. The grants the source holds for
   * the person decide which reads, inquiries, and requests go out.
   */
  switchActor(actorRef: string): NotifyContext | null {
    return this.switchParts({ actorRef });
  }

  /**
   * Starts a new context for the same person acting under another role. A role
   * switch is a new session incarnation: the old role's rows and inquiry
   * material are cleared, a late answer for the old role is dropped, and
   * actions the old role was offered are fenced off — the new context's own
   * read decides what is on offer now.
   */
  switchRole(role: NotifyRole): NotifyContext | null {
    return this.switchParts({ role });
  }

  /**
   * One read. A newer read in the same context wins, and an older answer is
   * dropped. A deep-open read names a notification ref copied from a row or a
   * URL; the source answers a cross-tenant or another subject's ref with denied.
   */
  async read(focusRef: string | null = null): Promise<NotifyReadResult> {
    const key = this.context.key;
    this.readSeq += 1;
    const seq = this.readSeq;
    const actsAtStart = this.actsDone;
    this.counters.reads += 1;
    let outcome: NotifyReadOutcome;
    try {
      outcome = await this.port.read({
        contextKey: key,
        actorRef: this.context.actorRef,
        scope: { ...this.context.scope },
        focusRef,
        grantFloor: this.grantGeneration,
        watermarkFloor: this.floor,
      });
    } catch (error) {
      outcome = { kind: "unknown", message: failureText(error) };
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
    this.apply(outcome, this.actsDone === actsAtStart);
    this.notify();
    return { kind: "APPLIED", readState: this.readState };
  }

  private apply(outcome: NotifyReadOutcome, noActSince: boolean): void {
    this.readCode = null;
    this.readDetail = null;
    if (outcome.kind === "ready") {
      this.snapshot = outcome.snapshot;
      this.assessment = assessNotifySnapshot(outcome.snapshot);
      this.readState = "ready";
      this.floor = outcome.snapshot.watermark;
      this.grantGeneration = outcome.snapshot.grantGeneration;
      // A request that came back after this read began may be missing from it. The view stays behind.
      if (noActSince) {
        this.behind = false;
      }
      return;
    }
    // Anything but a ready read leaves no row and no inquiry material on screen.
    this.clearView();
    switch (outcome.kind) {
      case "empty":
        this.readState = "empty";
        this.readDetail = `Tenant ${outcome.scope.tenantId} lists no notification for role ${outcome.scope.role} at watermark ${outcome.watermark}.`;
        return;
      case "stale":
        this.readState = "stale";
        this.readDetail = `Watermark ${outcome.watermark} is older than the floor ${outcome.floor}.`;
        return;
      case "generation-stale":
        this.readState = "generation-stale";
        this.readDetail = `The notification grant moved to generation ${outcome.actual} at the source; this view was built under ${outcome.expected}. Read again under the current grant.`;
        return;
      case "denied":
        this.readState = "denied";
        this.readCode = outcome.code;
        this.readDetail = outcome.detail;
        return;
      case "refused":
        this.readState = "refused";
        this.readCode = outcome.code;
        this.readDetail = outcome.detail;
        return;
      case "invalid-request":
        this.readState = "invalid";
        this.readCode = outcome.code;
        this.readDetail = outcome.detail;
        return;
      case "tuple-changed":
        this.readState = "tuple-changed";
        this.readDetail = `The pin tuple field ${outcome.field} changed.`;
        return;
      case "not-bound":
        this.readState = "not-bound";
        this.readDetail = outcome.reason;
        return;
      case "unknown":
        this.readState = "unavailable";
        this.readDetail = outcome.message;
        return;
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  }

  /**
   * Whether support material can be requested now, and if not, why. The screen
   * shows this and the request path enforces it, so a control that is off is an
   * inquiry that never leaves — and the port checks it again when one does.
   */
  canInquiry(): NotifyEligibility {
    if (this.port.source === "none") {
      return { allowed: false, reason: NOTIFY_NOT_BOUND_REASON };
    }
    if (this.readState !== "ready" || this.snapshot === null) {
      return { allowed: false, reason: "An inquiry follows the last read. Read the inbox first." };
    }
    if (!notifyCapabilities(this.context.scope.role).includes("read-inquiry")) {
      return {
        allowed: false,
        reason: `Role ${this.context.scope.role} holds no read-inquiry capability at the source.`,
      };
    }
    return { allowed: true, reason: null };
  }

  /** One inquiry read. A not-bound port sends nothing. */
  async loadInquiry(inquiryRef: string): Promise<NotifyInquiryResult> {
    const eligibility = this.canInquiry();
    if (!eligibility.allowed) {
      this.counters.notSent += 1;
      const reason = this.port.source === "none" ? "not-bound" : this.readState !== "ready" ? "no-snapshot" : "no-capability";
      if (reason === "not-bound") {
        this.inquiryPhase = "not-bound";
        this.inquiryCode = null;
        this.inquiryDetail = NOTIFY_NOT_BOUND_REASON;
        this.inquiryValue = null;
      }
      this.notify();
      return { kind: "NOT_SENT", reason, detail: eligibility.reason ?? "" };
    }
    if (!isNotifyRef(inquiryRef, "inquiry")) {
      this.counters.notSent += 1;
      this.notify();
      return { kind: "NOT_SENT", reason: "bad-ref", detail: `${inquiryRef} is not an inquiry reference copied from a resolve.` };
    }
    const key = this.context.key;
    this.inquirySeq += 1;
    const seq = this.inquirySeq;
    this.counters.inquiries += 1;
    let outcome: NotifyInquiryOutcome;
    try {
      outcome = await this.port.readInquiry({
        contextKey: key,
        actorRef: this.context.actorRef,
        scope: { ...this.context.scope },
        inquiryRef,
      });
    } catch (error) {
      outcome = { kind: "unknown", message: failureText(error) };
    }
    if (key !== this.context.key) {
      this.counters.droppedInquiries += 1;
      this.notify();
      return { kind: "DROPPED", cause: "context-changed" };
    }
    if (seq < this.appliedInquirySeq) {
      this.counters.droppedInquiries += 1;
      this.notify();
      return { kind: "DROPPED", cause: "older-inquiry" };
    }
    if (this.readState !== "ready") {
      this.counters.droppedInquiries += 1;
      this.notify();
      return { kind: "DROPPED", cause: "read-not-ready" };
    }
    this.appliedInquirySeq = seq;
    this.applyInquiry(outcome);
    this.notify();
    return { kind: "APPLIED", phase: this.inquiryPhase };
  }

  private applyInquiry(outcome: NotifyInquiryOutcome): void {
    this.inquiryCode = null;
    this.inquiryDetail = null;
    this.inquiryValue = null;
    switch (outcome.kind) {
      case "ready":
        this.inquiryPhase = "loaded";
        this.inquiryValue = outcome.inquiry;
        return;
      case "denied":
        this.inquiryPhase = "denied";
        this.inquiryCode = outcome.code;
        this.inquiryDetail = outcome.detail;
        return;
      case "refused":
        this.inquiryPhase = "refused";
        this.inquiryCode = outcome.code;
        this.inquiryDetail = outcome.detail;
        return;
      case "invalid-request":
        this.inquiryPhase = "invalid";
        this.inquiryCode = outcome.code;
        this.inquiryDetail = outcome.detail;
        return;
      case "tuple-changed":
        this.inquiryPhase = "tuple-changed";
        this.inquiryDetail = `The pin tuple field ${outcome.field} changed.`;
        return;
      case "not-bound":
        this.inquiryPhase = "not-bound";
        this.inquiryDetail = outcome.reason;
        return;
      case "unknown":
        this.inquiryPhase = "unavailable";
        this.inquiryDetail = outcome.message;
        return;
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  }

  /**
   * Whether a request can be sent now, and if not, why. The screen shows this
   * and the request path enforces it, so a control that is off is a request
   * that never leaves. The port runs its own check on every request that does
   * leave, so a hidden control is never the enforcement.
   */
  canSend(kind: NotifyActionKind): NotifyEligibility {
    if (this.port.source === "none") {
      return { allowed: false, reason: NOTIFY_NOT_BOUND_REASON };
    }
    if (this.inFlight !== null) {
      return { allowed: false, reason: `A ${this.inFlight} request is in flight. One request goes at a time.` };
    }
    if (this.fence !== null) {
      return {
        allowed: false,
        reason:
          "An earlier request has an unknown outcome and may have been recorded. Nothing is sent again from here. Switching the tenant, the actor, or the role, or starting a new synthetic session, begins a new context and counts this unknown outcome.",
      };
    }
    if (this.readState !== "ready" || this.snapshot === null || this.assessment === null) {
      return { allowed: false, reason: "Requests are built from the last read. Read the inbox first." };
    }
    if (this.behind) {
      return { allowed: false, reason: "A request reached the source after the last read. Read again before the next request." };
    }
    if (!notifyCapabilities(this.context.scope.role).includes(capabilityFor(kind))) {
      return {
        allowed: false,
        reason: `Role ${this.context.scope.role} holds no ${capabilityFor(kind)} capability at the source.`,
      };
    }
    return notifyEligibility(this.snapshot, kind);
  }

  private notSent(reason: NotifyNotSentReason, detail: string): NotifyActResult {
    this.counters.notSent += 1;
    this.notify();
    return { kind: "NOT_SENT", reason, detail };
  }

  private notSentReason(kind: NotifyActionKind): NotifyNotSentReason {
    if (this.port.source === "none") {
      return "not-bound";
    }
    if (this.readState !== "ready" || this.snapshot === null) {
      return "no-snapshot";
    }
    if (this.behind) {
      return "stale-read";
    }
    return notifyCapabilities(this.context.scope.role).includes(capabilityFor(kind)) ? "blocked" : "no-capability";
  }

  /** The one request path. It fences first, then checks the offer, then builds from the last read, then sends once. */
  private async dispatch(
    kind: NotifyActionKind,
    build: (snapshot: NotifySnapshot, assessment: NotifyAssessment) => NotifyActionRequest | { notSent: NotifyNotSentReason; detail: string },
  ): Promise<NotifyActResult> {
    const fence = this.currentFence();
    if (fence !== null) {
      this.counters.notSent += 1;
      this.notify();
      return { kind: "FENCED", fence };
    }
    const eligibility = this.canSend(kind);
    if (!eligibility.allowed || this.snapshot === null || this.assessment === null) {
      return this.notSent(this.notSentReason(kind), eligibility.reason ?? "The request is not on offer.");
    }
    const built = build(this.snapshot, this.assessment);
    if ("notSent" in built) {
      return this.notSent(built.notSent, built.detail);
    }
    const key = this.context.key;
    this.actSeq += 1;
    const seq = this.actSeq;
    this.counters.acts += 1;
    this.inFlight = kind;
    this.notify();
    let outcome: NotifyActOutcome;
    try {
      outcome = await this.port.act({
        contextKey: key,
        actorRef: this.context.actorRef,
        // The request carries the grant generation the read was built under,
        // so the source rejects a request whose grant moved underneath it.
        scope: { ...this.context.scope, grantGeneration: this.snapshot.grantGeneration },
        action: built,
      });
    } catch (error) {
      outcome = { kind: "unknown", message: failureText(error) };
    }
    this.inFlight = null;
    this.actsDone += 1;
    const record = this.record(seq, built, outcome);
    this.last = record;
    if (record.phase === "unknown" || record.phase === "refused") {
      this.fence = { reason: "unknown-outcome", seq, action: kind };
      this.behind = true;
    } else if (record.phase === "applied" || record.phase === "rejected") {
      this.behind = true;
    }
    this.notify();
    if (record.phase === "applied") {
      return { kind: "APPLIED", record };
    }
    if (record.phase === "unknown" || record.phase === "refused") {
      return { kind: "UNKNOWN", record };
    }
    return { kind: "REJECTED", record };
  }

  private record(seq: number, action: NotifyActionRequest, outcome: NotifyActOutcome): NotifyActRecord {
    const base = { seq, action, code: null, detail: null, receipt: null };
    switch (outcome.kind) {
      case "applied":
        return { ...base, phase: "applied", receipt: outcome.receipt };
      case "rejected":
        return { ...base, phase: "rejected", code: outcome.code, detail: outcome.detail };
      case "denied":
        return { ...base, phase: "denied", code: outcome.code, detail: outcome.detail };
      case "refused":
        return { ...base, phase: "refused", code: outcome.code, detail: outcome.detail };
      case "invalid-request":
        return { ...base, phase: "invalid", code: outcome.code, detail: outcome.detail };
      case "tuple-changed":
        return { ...base, phase: "tuple-changed", detail: `The pin tuple field ${outcome.field} changed.` };
      case "not-bound":
        return { ...base, phase: "not-bound", detail: outcome.reason };
      case "unknown":
        return { ...base, phase: "unknown", detail: outcome.message };
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  }

  /**
   * Marks a notification read that the last read lists as unread. The ref is
   * copied from the row, never typed. A marked read changes read state only:
   * it confirms no economic effect.
   */
  markRead(notificationRef: string): Promise<NotifyActResult> {
    return this.dispatch("mark-read", (snapshot) => {
      if (!isNotifyRef(notificationRef, "notification")) {
        return { notSent: "unknown-ref", detail: `${notificationRef} is not a notification reference.` };
      }
      const row = snapshot.notifications.find((item) => item.notificationRef === notificationRef);
      if (row === undefined) {
        return { notSent: "unknown-ref", detail: `The read lists no notification ${notificationRef} in this scope.` };
      }
      if (row.read) {
        return { notSent: "unknown-ref", detail: `Notification ${notificationRef} is already marked read in the last read.` };
      }
      return { kind: "mark-read", notificationRef: row.notificationRef };
    });
  }

  /**
   * Resolves the offered action of a notification the last read lists. The
   * resolve is checked against the grant generation the read reported, so an
   * old notification's action does not skip the current-generation check: a
   * stale-issued row is blocked here, and the port rejects it again.
   */
  resolveAction(notificationRef: string): Promise<NotifyActResult> {
    return this.dispatch("resolve", (snapshot) => {
      if (!isNotifyRef(notificationRef, "notification")) {
        return { notSent: "unknown-ref", detail: `${notificationRef} is not a notification reference.` };
      }
      const row = snapshot.notifications.find((item) => item.notificationRef === notificationRef);
      if (row === undefined) {
        return { notSent: "unknown-ref", detail: `The read lists no notification ${notificationRef} in this scope.` };
      }
      if (row.issueState === "stale-issue") {
        return {
          notSent: "blocked",
          detail: `Notification ${notificationRef} was issued under an older grant generation. Its offered action resolves nothing until a read under the current grant lists it again.`,
        };
      }
      if (row.offer === null) {
        return { notSent: "unknown-ref", detail: `Notification ${notificationRef} offers no action.` };
      }
      return { kind: "resolve", notificationRef: row.notificationRef };
    });
  }
}
