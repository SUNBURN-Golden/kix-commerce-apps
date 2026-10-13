import {
  SERVICING_DESK_ACTOR,
  SERVICING_NOT_BOUND_REASON,
  SERVICING_OWN_REF,
  SERVICING_TENANT,
  assessServicingSnapshot,
  isServicingRef,
  servicingAdjustableInstallments,
  servicingAllocatablePayments,
  servicingCapabilities,
  servicingCaseTransitions,
  servicingEligibility,
  type ServicingActOutcome,
  type ServicingActionKind,
  type ServicingActionRequest,
  type ServicingAdjustmentKind,
  type ServicingAssessment,
  type ServicingCaseTransition,
  type ServicingEligibility,
  type ServicingPort,
  type ServicingReadOutcome,
  type ServicingReceipt,
  type ServicingScope,
  type ServicingSnapshot,
} from "./credit-servicing.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";

/**
 * Client side of the credit servicing desk: the context key, the read reducer, the
 * write fence, and the drop rules. It decides what the screen may show next and
 * which request it may send next. It decides nothing about servicing: every
 * schedule, every payment, every case state, and every figure is the source's.
 *
 * Rules, all tested:
 *  - A read and a request are each one port call. A failed or lost one is shown as
 *    unavailable or unknown and is not sent again by this class. The next call is
 *    the person's, and an unknown request outcome fences every later request.
 *  - A request body is built from the last ready read. Target references are
 *    copied from it and are never typed or minted here.
 *  - A request is sent only when the read says the source offers it, the actor
 *    holds the capability the request needs, the read is the latest the page
 *    holds, and no other request is in flight or unknown.
 *  - A read that arrives after the context changed (obligation scope, actor, or
 *    session incarnation), or after a newer one was applied, is dropped. It does
 *    not touch the current view.
 *  - Any read that is not ready, and any change of scope or actor, clears the
 *    rows. A refused or denied scope leaves nothing of an earlier scope on screen.
 *  - An accepted proposal is recorded, not applied. The controller records the
 *    receipt and marks the view behind, and the lanes on screen come only from
 *    the next read.
 *  - Nothing here sends a catalogue command, a contact, a collection action, a
 *    payment, or a disbursement.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

export const SERVICING_FRESHNESS = ["CURRENT", "STALE", "UNAVAILABLE"] as const;

export type ServicingFreshness = (typeof SERVICING_FRESHNESS)[number];

export type ServicingReadState =
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

export type ServicingActPhase =
  | "applied"
  | "rejected"
  | "denied"
  | "refused"
  | "invalid"
  | "tuple-changed"
  | "not-bound"
  | "unknown";

export interface ServicingContext {
  environment: "stub" | "integration-http";
  domain: string;
  /** A context label. It is not an authentication result. */
  actorRef: string;
  scope: ServicingScope;
  /** Session incarnation. Bumped when the page switches scope or actor. */
  incarnation: number;
  key: string;
}

export interface ServicingCounters {
  /** Calls that reached port.read. */
  reads: number;
  /** Calls that reached port.act. */
  acts: number;
  /** Requests refused before the port. */
  notSent: number;
  droppedReads: number;
}

/** The last request that reached the port, and how it came back. */
export interface ServicingActRecord {
  seq: number;
  action: ServicingActionRequest;
  phase: ServicingActPhase;
  code: string | null;
  detail: string | null;
  receipt: ServicingReceipt | null;
}

export type ServicingFence =
  | { reason: "in-flight"; action: ServicingActionKind }
  | { reason: "unknown-outcome"; seq: number; action: ServicingActionKind };

export interface ServicingControllerState {
  context: ServicingContext;
  readState: ServicingReadState;
  readCode: string | null;
  readDetail: string | null;
  snapshot: ServicingSnapshot | null;
  assessment: ServicingAssessment | null;
  freshness: ServicingFreshness;
  /** True after a request reached the source and no newer ready read has landed. */
  behind: boolean;
  fence: ServicingFence | null;
  last: ServicingActRecord | null;
  /** Unknown outcomes left in sessions this page no longer holds. They are not forgotten. */
  earlierUnknown: number;
  counters: ServicingCounters;
}

export type ServicingReadResult =
  | { kind: "APPLIED"; readState: ServicingReadState }
  | { kind: "DROPPED"; cause: "context-changed" | "older-read" };

export type ServicingNotSentReason =
  | "not-bound"
  | "no-snapshot"
  | "stale-read"
  | "blocked"
  | "no-capability"
  | "unknown-ref";

export type ServicingActResult =
  | { kind: "APPLIED"; record: ServicingActRecord }
  | { kind: "REJECTED"; record: ServicingActRecord }
  | { kind: "UNKNOWN"; record: ServicingActRecord }
  | { kind: "FENCED"; fence: ServicingFence }
  | { kind: "NOT_SENT"; reason: ServicingNotSentReason; detail: string };

function contextKeyOf(parts: Pick<ServicingContext, "environment" | "domain" | "actorRef" | "scope" | "incarnation">): string {
  return [parts.environment, parts.domain, parts.actorRef, parts.scope.tenantId, parts.scope.obligationRef, String(parts.incarnation)].join("|");
}

function failureText(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : "The call failed.";
}

/** The capability a request kind needs at the source. View needs no send at all. */
function capabilityFor(kind: ServicingActionKind): "propose" | "approve" {
  return kind === "approve-proposal" ? "approve" : "propose";
}

export class CreditServicingController {
  private context: ServicingContext;
  private snapshot: ServicingSnapshot | null = null;
  private assessment: ServicingAssessment | null = null;
  private readState: ServicingReadState = "none";
  private readCode: string | null = null;
  private readDetail: string | null = null;
  private floor: string | null = null;
  private readSeq = 0;
  private appliedReadSeq = 0;
  private actSeq = 0;
  private behind = false;
  private inFlight: ServicingActionKind | null = null;
  private fence: ServicingFence | null = null;
  private last: ServicingActRecord | null = null;
  private earlierUnknown = 0;
  private readonly counters: ServicingCounters = { reads: 0, acts: 0, notSent: 0, droppedReads: 0 };
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly port: ServicingPort,
    options: { actorRef?: string; obligationRef?: string; incarnation?: number } = {},
  ) {
    const parts = {
      environment: port.environment,
      domain: PINNED_PROTOCOL_DOMAIN,
      actorRef: options.actorRef ?? SERVICING_DESK_ACTOR,
      scope: { tenantId: SERVICING_TENANT, obligationRef: options.obligationRef ?? SERVICING_OWN_REF },
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

  state(): ServicingControllerState {
    let freshness: ServicingFreshness = "UNAVAILABLE";
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

  private currentFence(): ServicingFence | null {
    if (this.inFlight !== null) {
      return { reason: "in-flight", action: this.inFlight };
    }
    return this.fence;
  }

  private clearView(): void {
    this.snapshot = null;
    this.assessment = null;
  }

  /** Starts a new context for a different part: another obligation or another actor. */
  private switchParts(next: { actorRef?: string; obligationRef?: string }): ServicingContext | null {
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
      scope: { tenantId: this.context.scope.tenantId, obligationRef: next.obligationRef ?? this.context.scope.obligationRef },
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

  /**
   * Starts a new context for another obligation scope. Rows of the earlier scope
   * are cleared, and a read still in flight for it will be dropped when it
   * arrives. It refuses while a request is in flight, because that request would
   * have no view to land on. An unknown outcome of the earlier scope is counted,
   * not forgotten.
   */
  switchScope(obligationRef: string): ServicingContext | null {
    return this.switchParts({ obligationRef });
  }

  /**
   * Starts a new context for another desk actor. The capabilities the source
   * grants the actor decide which requests may be sent; view, proposal, and
   * approval stay separate. Same drop and counting rules as a scope switch.
   */
  switchActor(actorRef: string): ServicingContext | null {
    return this.switchParts({ actorRef });
  }

  /** One read. A newer read in the same context wins, and an older answer is dropped. */
  async read(): Promise<ServicingReadResult> {
    const key = this.context.key;
    this.readSeq += 1;
    const seq = this.readSeq;
    this.counters.reads += 1;
    let outcome: ServicingReadOutcome;
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

  private apply(outcome: ServicingReadOutcome): void {
    this.readCode = null;
    this.readDetail = null;
    if (outcome.kind === "ready") {
      this.snapshot = outcome.snapshot;
      this.assessment = assessServicingSnapshot(outcome.snapshot);
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
        this.readDetail = `Obligation ${outcome.scope.obligationRef} has no servicing rows at watermark ${outcome.watermark}.`;
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
   * the send path enforces it, so a control that is off is a request that never
   * leaves.
   */
  canSend(kind: ServicingActionKind): ServicingEligibility {
    if (this.port.source === "none") {
      return { allowed: false, reason: SERVICING_NOT_BOUND_REASON };
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
      return { allowed: false, reason: "Requests are built from the last read. Read the servicing record first." };
    }
    if (this.behind) {
      return { allowed: false, reason: "A request reached the source after the last read. Read again before the next request." };
    }
    const needed = capabilityFor(kind);
    if (!servicingCapabilities(this.context.actorRef).includes(needed)) {
      return {
        allowed: false,
        reason: `Actor ${this.context.actorRef} holds no ${needed} capability at the source. View, proposal, and approval stay separate.`,
      };
    }
    return servicingEligibility(this.snapshot, this.assessment, kind);
  }

  private notSent(reason: ServicingNotSentReason, detail: string): ServicingActResult {
    this.counters.notSent += 1;
    this.notify();
    return { kind: "NOT_SENT", reason, detail };
  }

  /** Why a request that is not on offer was not sent. */
  private notSentReason(): ServicingNotSentReason {
    if (this.port.source === "none") {
      return "not-bound";
    }
    if (this.readState !== "ready" || this.snapshot === null) {
      return "no-snapshot";
    }
    return this.behind ? "stale-read" : "blocked";
  }

  /**
   * The one send path. It fences first, then checks the offer, then builds the
   * body from the last read, then sends once. A body the read cannot support is
   * not sent.
   */
  private async dispatch(
    kind: ServicingActionKind,
    build: (snapshot: ServicingSnapshot) => ServicingActionRequest | { notSent: ServicingNotSentReason; detail: string },
  ): Promise<ServicingActResult> {
    const fence = this.currentFence();
    if (fence !== null) {
      this.counters.notSent += 1;
      this.notify();
      return { kind: "FENCED", fence };
    }
    const eligibility = this.canSend(kind);
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
    let outcome: ServicingActOutcome;
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

  private record(seq: number, action: ServicingActionRequest, outcome: ServicingActOutcome): ServicingActRecord {
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
   * Proposes allocating an unallocated part of a payment to a schedule row. Both
   * references are copied from the last read. A proposal is recorded, not
   * applied: a different actor approves it.
   */
  proposeAllocation(paymentRef: string, installmentRef: string): Promise<ServicingActResult> {
    return this.dispatch("propose-allocation", (snapshot) => {
      const payment = servicingAllocatablePayments(snapshot).find((row) => row.paymentRef === paymentRef);
      if (payment === undefined) {
        return { notSent: "unknown-ref", detail: `The read lists no allocatable payment ${paymentRef}.` };
      }
      const installment = servicingAdjustableInstallments(snapshot).find((row) => row.installmentRef === installmentRef);
      if (installment === undefined) {
        return { notSent: "unknown-ref", detail: `The read lists no open schedule row ${installmentRef}.` };
      }
      return { kind: "propose-allocation", paymentRef: payment.paymentRef, installmentRef: installment.installmentRef };
    });
  }

  /** Proposes a schedule correction on a row the read lists as open. */
  proposeAdjustment(installmentRef: string, adjustmentKind: ServicingAdjustmentKind, text: string): Promise<ServicingActResult> {
    return this.dispatch("propose-adjustment", (snapshot) => {
      const installment = servicingAdjustableInstallments(snapshot).find((row) => row.installmentRef === installmentRef);
      if (installment === undefined) {
        return { notSent: "unknown-ref", detail: `The read lists no open schedule row ${installmentRef}.` };
      }
      return { kind: "propose-adjustment", installmentRef: installment.installmentRef, adjustmentKind, text };
    });
  }

  /** Proposes a case transition the read offers from the current status. */
  proposeCaseTransition(transition: ServicingCaseTransition): Promise<ServicingActResult> {
    return this.dispatch("propose-case-transition", (snapshot) => {
      if (snapshot.servicingCase === null) {
        return { notSent: "unknown-ref", detail: "The read lists no servicing case." };
      }
      if (!servicingCaseTransitions(snapshot.servicingCase.status).includes(transition)) {
        return { notSent: "unknown-ref", detail: `The read offers no transition ${transition} from ${snapshot.servicingCase.status}.` };
      }
      return { kind: "propose-case-transition", transition };
    });
  }

  /** Approves a pending proposal the read lists. A different actor approves than proposed. */
  approveProposal(proposalRef: string): Promise<ServicingActResult> {
    return this.dispatch("approve-proposal", (snapshot) => {
      if (!isServicingRef(proposalRef, "proposal")) {
        return { notSent: "unknown-ref", detail: `${proposalRef} is not a proposal reference.` };
      }
      const proposal = snapshot.proposals.find((row) => row.proposalRef === proposalRef);
      if (proposal === undefined) {
        return { notSent: "unknown-ref", detail: `The read lists no proposal ${proposalRef}.` };
      }
      if (proposal.state !== "pending") {
        return { notSent: "unknown-ref", detail: `Proposal ${proposalRef} is ${proposal.state}. A proposal is approved only while it is pending.` };
      }
      return { kind: "approve-proposal", proposalRef: proposal.proposalRef };
    });
  }
}
