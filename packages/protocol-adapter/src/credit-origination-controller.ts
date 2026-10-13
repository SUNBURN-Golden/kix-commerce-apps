import {
  ORIGINATION_DESK_ACTOR,
  ORIGINATION_NOT_BOUND_REASON,
  ORIGINATION_OWN_REF,
  ORIGINATION_TENANT,
  assessOriginationSnapshot,
  isOriginationAmount,
  originationEligibility,
  type OriginationActOutcome,
  type OriginationActionKind,
  type OriginationActionRequest,
  type OriginationAssessment,
  type OriginationCorrectTarget,
  type OriginationEligibility,
  type OriginationPort,
  type OriginationReadOutcome,
  type OriginationReceipt,
  type OriginationScope,
  type OriginationSnapshot,
} from "./credit-origination.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";

/**
 * Client side of the credit origination desk: the context key, the read reducer, the
 * write fence, and the drop rules. It decides what the screen may show next and which
 * request it may send next. It decides nothing about credit: every decision, every
 * commitment, every permission, and every figure is the source's.
 *
 * Rules, all tested:
 *  - A read and a request are each one port call. A failed or lost one is shown as
 *    unavailable or unknown and is not sent again by this class. The next call is the
 *    person's, and an unknown request outcome fences every later request.
 *  - A request body is built from the last ready read. Target references are copied
 *    from it and are never typed or minted here. The person types only an amount, and
 *    only its whole-unit shape is checked.
 *  - A request is sent only when the read says the source offers it, the read is the
 *    latest the page holds, and no other request is in flight or unknown.
 *  - A read that arrives after the context changed (applicant scope, session
 *    incarnation), or after a newer one was applied, is dropped. It does not touch the
 *    current view.
 *  - Any read that is not ready, and any change of scope, clears the rows. A refused or
 *    denied scope leaves nothing of an earlier scope on screen.
 *  - An accepted request is not a decision. The controller records the receipt and
 *    marks the view behind, and the lanes on screen come only from the next read.
 *  - Nothing here sends a catalogue command.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

export const ORIGINATION_FRESHNESS = ["CURRENT", "STALE", "UNAVAILABLE"] as const;

export type OriginationFreshness = (typeof ORIGINATION_FRESHNESS)[number];

export type OriginationReadState =
  | "none"
  | "ready"
  | "empty"
  | "stale"
  | "denied"
  | "refused"
  | "invalid"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export type OriginationActPhase =
  | "applied"
  | "rejected"
  | "denied"
  | "refused"
  | "invalid"
  | "tuple-changed"
  | "not-bound"
  | "unknown";

export interface OriginationContext {
  environment: "stub" | "integration-http";
  domain: string;
  /** A context label. It is not an authentication result. */
  actorRef: string;
  scope: OriginationScope;
  /** Session incarnation. Bumped when the page switches scope. */
  incarnation: number;
  key: string;
}

export interface OriginationCounters {
  /** Calls that reached port.read. */
  reads: number;
  /** Calls that reached port.act. */
  acts: number;
  /** Requests refused before the port. */
  notSent: number;
  droppedReads: number;
}

/** The last request that reached the port, and how it came back. */
export interface OriginationActRecord {
  seq: number;
  action: OriginationActionRequest;
  phase: OriginationActPhase;
  code: string | null;
  detail: string | null;
  receipt: OriginationReceipt | null;
}

export type OriginationFence =
  | { reason: "in-flight"; action: OriginationActionKind }
  | { reason: "unknown-outcome"; seq: number; action: OriginationActionKind };

export interface OriginationControllerState {
  context: OriginationContext;
  readState: OriginationReadState;
  readCode: string | null;
  readDetail: string | null;
  snapshot: OriginationSnapshot | null;
  assessment: OriginationAssessment | null;
  freshness: OriginationFreshness;
  /** True after a request reached the source and no newer ready read has landed. */
  behind: boolean;
  fence: OriginationFence | null;
  last: OriginationActRecord | null;
  /** Unknown outcomes left in sessions this page no longer holds. They are not forgotten. */
  earlierUnknown: number;
  counters: OriginationCounters;
}

export type OriginationReadResult =
  | { kind: "APPLIED"; readState: OriginationReadState }
  | { kind: "DROPPED"; cause: "context-changed" | "older-read" };

export type OriginationNotSentReason =
  | "not-bound"
  | "no-snapshot"
  | "stale-read"
  | "blocked"
  | "invalid-amount"
  | "unknown-ref";

export type OriginationActResult =
  | { kind: "APPLIED"; record: OriginationActRecord }
  | { kind: "REJECTED"; record: OriginationActRecord }
  | { kind: "UNKNOWN"; record: OriginationActRecord }
  | { kind: "FENCED"; fence: OriginationFence }
  | { kind: "NOT_SENT"; reason: OriginationNotSentReason; detail: string };

function contextKeyOf(parts: Pick<OriginationContext, "environment" | "domain" | "actorRef" | "scope" | "incarnation">): string {
  return [parts.environment, parts.domain, parts.actorRef, parts.scope.tenantId, parts.scope.applicantRef, String(parts.incarnation)].join("|");
}

const AMOUNT_SHAPE_TEXT = "The requested amount is a whole number of units: digits only, no sign, no decimal point, no leading zero.";

function failureText(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : "The call failed.";
}

export class CreditOriginationController {
  private context: OriginationContext;
  private snapshot: OriginationSnapshot | null = null;
  private assessment: OriginationAssessment | null = null;
  private readState: OriginationReadState = "none";
  private readCode: string | null = null;
  private readDetail: string | null = null;
  private floor: string | null = null;
  private readSeq = 0;
  private appliedReadSeq = 0;
  private actSeq = 0;
  private behind = false;
  private inFlight: OriginationActionKind | null = null;
  private fence: OriginationFence | null = null;
  private last: OriginationActRecord | null = null;
  private earlierUnknown = 0;
  private readonly counters: OriginationCounters = { reads: 0, acts: 0, notSent: 0, droppedReads: 0 };
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly port: OriginationPort,
    options: { actorRef?: string; applicantRef?: string; incarnation?: number } = {},
  ) {
    const parts = {
      environment: port.environment,
      domain: PINNED_PROTOCOL_DOMAIN,
      actorRef: options.actorRef ?? ORIGINATION_DESK_ACTOR,
      scope: { tenantId: ORIGINATION_TENANT, applicantRef: options.applicantRef ?? ORIGINATION_OWN_REF },
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

  state(): OriginationControllerState {
    let freshness: OriginationFreshness = "UNAVAILABLE";
    if (this.readState === "ready" || this.readState === "empty") {
      freshness = "CURRENT";
    } else if (this.readState === "stale") {
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
      behind: this.behind,
      fence: this.currentFence(),
      last: this.last,
      earlierUnknown: this.earlierUnknown,
      counters: { ...this.counters },
    };
  }

  private currentFence(): OriginationFence | null {
    if (this.inFlight !== null) {
      return { reason: "in-flight", action: this.inFlight };
    }
    return this.fence;
  }

  private clearView(): void {
    this.snapshot = null;
    this.assessment = null;
  }

  /**
   * Starts a new context for another applicant scope. Rows of the earlier scope are
   * cleared, and a read still in flight for it will be dropped when it arrives. It
   * refuses while a request is in flight, because that request would have no view to
   * land on. An unknown outcome of the earlier scope is counted, not forgotten.
   */
  switchScope(applicantRef: string): OriginationContext | null {
    if (this.inFlight !== null) {
      return null;
    }
    if (this.fence !== null) {
      this.earlierUnknown += 1;
    }
    const parts = {
      environment: this.context.environment,
      domain: this.context.domain,
      actorRef: this.context.actorRef,
      scope: { tenantId: this.context.scope.tenantId, applicantRef },
      incarnation: this.context.incarnation + 1,
    };
    this.context = { ...parts, key: contextKeyOf(parts) };
    this.clearView();
    this.readState = "none";
    this.readCode = null;
    this.readDetail = null;
    this.floor = null;
    this.behind = false;
    this.fence = null;
    this.last = null;
    this.notify();
    return { ...this.context, scope: { ...this.context.scope } };
  }

  /** One read. A newer read in the same context wins, and an older answer is dropped. */
  async read(): Promise<OriginationReadResult> {
    const key = this.context.key;
    this.readSeq += 1;
    const seq = this.readSeq;
    this.counters.reads += 1;
    let outcome: OriginationReadOutcome;
    try {
      outcome = await this.port.read({
        contextKey: key,
        actorRef: this.context.actorRef,
        scope: { ...this.context.scope },
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
    this.apply(outcome);
    this.notify();
    return { kind: "APPLIED", readState: this.readState };
  }

  private apply(outcome: OriginationReadOutcome): void {
    this.readCode = null;
    this.readDetail = null;
    if (outcome.kind === "ready") {
      this.snapshot = outcome.snapshot;
      this.assessment = assessOriginationSnapshot(outcome.snapshot);
      this.readState = "ready";
      this.floor = outcome.snapshot.watermark;
      this.behind = false;
      return;
    }
    // Anything but a ready read leaves no row on screen.
    this.clearView();
    switch (outcome.kind) {
      case "empty":
        this.readState = "empty";
        this.readDetail = `Applicant ${outcome.scope.applicantRef} has no claim basis at watermark ${outcome.watermark}.`;
        return;
      case "stale":
        this.readState = "stale";
        this.readDetail = `Watermark ${outcome.watermark} is older than the floor ${outcome.floor}.`;
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
   * Whether a request can be sent now, and if not, why. The screen shows this and
   * the send path enforces it, so a control that is off is a request that never leaves.
   */
  canSend(kind: OriginationActionKind, target?: OriginationCorrectTarget): OriginationEligibility {
    if (this.port.source === "none") {
      return { allowed: false, reason: ORIGINATION_NOT_BOUND_REASON };
    }
    if (this.inFlight !== null) {
      return { allowed: false, reason: `A ${this.inFlight} request is in flight. One request goes at a time.` };
    }
    if (this.fence !== null) {
      return {
        allowed: false,
        reason: "An earlier request has an unknown outcome and may have applied. Nothing is sent again from here. Start a new synthetic session to clear it.",
      };
    }
    if (this.readState !== "ready" || this.snapshot === null || this.assessment === null) {
      return { allowed: false, reason: "Requests are built from the last read. Read the application first." };
    }
    if (this.behind) {
      return { allowed: false, reason: "A request reached the source after the last read. Read again before the next request." };
    }
    return originationEligibility(this.snapshot, this.assessment, kind, target);
  }

  private notSent(reason: OriginationNotSentReason, detail: string): OriginationActResult {
    this.counters.notSent += 1;
    this.notify();
    return { kind: "NOT_SENT", reason, detail };
  }

  /** Why a request that is not on offer was not sent. */
  private notSentReason(): OriginationNotSentReason {
    if (this.port.source === "none") {
      return "not-bound";
    }
    if (this.readState !== "ready" || this.snapshot === null) {
      return "no-snapshot";
    }
    return this.behind ? "stale-read" : "blocked";
  }

  /**
   * The one send path. It fences first, then checks the offer, then builds the body
   * from the last read, then sends once. A body the read cannot support is not sent.
   */
  private async send(
    kind: OriginationActionKind,
    target: OriginationCorrectTarget | undefined,
    build: (snapshot: OriginationSnapshot) => OriginationActionRequest | { notSent: OriginationNotSentReason; detail: string },
  ): Promise<OriginationActResult> {
    const fence = this.currentFence();
    if (fence !== null) {
      this.counters.notSent += 1;
      this.notify();
      return { kind: "FENCED", fence };
    }
    const eligibility = this.canSend(kind, target);
    if (!eligibility.allowed || this.snapshot === null) {
      return this.notSent(this.notSentReason(), eligibility.reason ?? "The request is not on offer.");
    }
    const built = build(this.snapshot);
    if ("notSent" in built) {
      return this.notSent(built.notSent, built.detail);
    }
    const key = this.context.key;
    this.actSeq += 1;
    const seq = this.actSeq;
    this.counters.acts += 1;
    this.inFlight = kind;
    this.notify();
    let outcome: OriginationActOutcome;
    try {
      outcome = await this.port.act({
        contextKey: key,
        actorRef: this.context.actorRef,
        scope: { ...this.context.scope },
        action: built,
      });
    } catch (error) {
      outcome = { kind: "unknown", message: failureText(error) };
    }
    this.inFlight = null;
    const record = this.record(seq, built, outcome);
    this.last = record;
    if (record.phase === "unknown" || record.phase === "refused") {
      // The request may have applied. Nothing is sent again, and a read does not lift this.
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

  private record(seq: number, action: OriginationActionRequest, outcome: OriginationActOutcome): OriginationActRecord {
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

  /** Submits the application. The person types the amount; the cited claims come from the read. */
  submit(requestedAmount: string): Promise<OriginationActResult> {
    return this.send("submit", undefined, (snapshot) => {
      if (!isOriginationAmount(requestedAmount)) {
        return { notSent: "invalid-amount", detail: AMOUNT_SHAPE_TEXT };
      }
      const claimRefs = snapshot.claims.filter((row) => row.state === "valid").map((row) => row.claimRef);
      return { kind: "submit", requestedAmount, claimRefs };
    });
  }

  /** Amends the submitted application. This opens a new review and is not a decision. */
  amend(requestedAmount: string): Promise<OriginationActResult> {
    return this.send("correct", "application", () => {
      if (!isOriginationAmount(requestedAmount)) {
        return { notSent: "invalid-amount", detail: AMOUNT_SHAPE_TEXT };
      }
      return { kind: "correct", target: "application", requestedAmount };
    });
  }

  /** Provides a document the read lists as requested, expired, or unknown. */
  provideDocument(documentRef: string): Promise<OriginationActResult> {
    return this.send("correct", "document", (snapshot) => {
      const row = snapshot.documents.find((item) => item.documentRef === documentRef);
      if (row === undefined || row.state === "valid" || row.state === "expiring") {
        return { notSent: "unknown-ref", detail: `The read lists no document ${documentRef} that needs providing.` };
      }
      return { kind: "correct", target: "document", ref: row.documentRef };
    });
  }

  /** Renews a consent the read lists as not granted. */
  renewConsent(consentRef: string): Promise<OriginationActResult> {
    return this.send("correct", "consent", (snapshot) => {
      const row = snapshot.consents.find((item) => item.consentRef === consentRef);
      if (row === undefined || row.state === "granted") {
        return { notSent: "unknown-ref", detail: `The read lists no consent ${consentRef} that needs renewing.` };
      }
      return { kind: "correct", target: "consent", ref: row.consentRef };
    });
  }

  /** Asks for a new review under the current policy revision. */
  requestReReview(): Promise<OriginationActResult> {
    return this.send("re-review", undefined, () => ({ kind: "re-review" }));
  }

  /** Accepts the commitment the read lists as offered. */
  acceptCommitment(): Promise<OriginationActResult> {
    return this.send("accept-commitment", undefined, (snapshot) =>
      snapshot.commitment === null
        ? { notSent: "unknown-ref", detail: "The read lists no commitment." }
        : { kind: "accept-commitment", commitmentRef: snapshot.commitment.commitmentRef },
    );
  }

  /** Records a drawdown request on the commitment the read lists as accepted. Nothing is disbursed. */
  requestDrawdown(): Promise<OriginationActResult> {
    return this.send("request-drawdown", undefined, (snapshot) =>
      snapshot.commitment === null
        ? { notSent: "unknown-ref", detail: "The read lists no commitment." }
        : { kind: "request-drawdown", commitmentRef: snapshot.commitment.commitmentRef },
    );
  }
}
