import {
  FINANCE_NOT_BOUND_REASON,
  FINANCE_OWN_REF,
  FINANCE_REVIEWER_ACTOR,
  FINANCE_TENANT,
  assessFinanceSnapshot,
  financeApprovableProposals,
  financeCapabilities,
  financeEligibility,
  financeProposableCorrections,
  isFinanceRef,
  judgeFinanceExport,
  type FinanceActOutcome,
  type FinanceActionKind,
  type FinanceActionRequest,
  type FinanceAssessment,
  type FinanceCapability,
  type FinanceCorrectionKind,
  type FinanceEligibility,
  type FinanceExport,
  type FinanceExportOutcome,
  type FinanceExportVerdict,
  type FinanceOperationsPort,
  type FinanceReadOutcome,
  type FinanceReceipt,
  type FinanceScope,
  type FinanceSnapshot,
} from "./finance-operations.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";

/**
 * Client side of the finance desk: the context key, the read and export reducers, the
 * request fence, and the drop rules. It decides what the screen may show next and which
 * request it may send next. It decides nothing about money: every figure it holds is the
 * source's, and it adds no amount to another.
 *
 * Rules, all tested:
 *  - A read, an export, and a request are each one port call. A failed or lost one is
 *    shown as unavailable or unknown and is not sent again by this class. The next call
 *    is the person's, and an unknown request outcome fences every later request.
 *  - A request body is built from the last ready read. Target references are copied from
 *    it and are never typed or minted here.
 *  - A request is sent only when the read says the source offers it, the actor holds the
 *    capability the request needs, the read is the latest the page holds, and no other
 *    request is in flight or unknown.
 *  - There is no request that changes economic state and none that forces a ledger to
 *    match. A recorded proposal and a recorded approval are records. The controller marks
 *    the view behind, and the cases on screen come only from the next read.
 *  - A read or an export that arrives after the context changed (book scope, actor, or
 *    session incarnation), or after a newer one of its kind was applied, is dropped.
 *  - Any read that is not ready, and any change of scope or actor, clears the rows and the
 *    export. A refused or denied scope leaves nothing of an earlier scope on screen.
 *  - An export is judged against the last read each time state() is called, so an export
 *    taken before the source moved on turns stale without a second call. An export that
 *    lands after the read stopped being ready is dropped, because it has nothing to be
 *    judged against and the view holds no row.
 *  - A read that began before a request completed does not clear the "behind" mark, because
 *    it may not show that request.
 *  - Nothing here sends a catalogue command, a payout, or a posting to an accounting system.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

export const FINANCE_FRESHNESS = ["CURRENT", "STALE", "UNAVAILABLE"] as const;

export type FinanceFreshness = (typeof FINANCE_FRESHNESS)[number];

export type FinanceReadState =
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

export type FinanceExportPhase =
  | "none"
  | "loaded"
  | "denied"
  | "refused"
  | "invalid"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export type FinanceActPhase =
  | "applied"
  | "rejected"
  | "denied"
  | "refused"
  | "invalid"
  | "tuple-changed"
  | "not-bound"
  | "unknown";

export interface FinanceContext {
  environment: "stub" | "integration-http";
  domain: string;
  /** A context label. It is not an authentication result. */
  actorRef: string;
  scope: FinanceScope;
  /** Session incarnation. Bumped when the page switches scope or actor. */
  incarnation: number;
  key: string;
}

export interface FinanceCounters {
  /** Calls that reached port.read. */
  reads: number;
  /** Calls that reached port.readExport. */
  exports: number;
  /** Calls that reached port.act. */
  acts: number;
  /** Exports and requests refused before the port. */
  notSent: number;
  droppedReads: number;
  droppedExports: number;
}

export interface FinanceExportState {
  phase: FinanceExportPhase;
  code: string | null;
  detail: string | null;
  value: FinanceExport | null;
  /** Judged against the last read at the moment state() was called. Null with no export. */
  verdict: FinanceExportVerdict | null;
}

/** The last request that reached the port, and how it came back. */
export interface FinanceActRecord {
  seq: number;
  action: FinanceActionRequest;
  phase: FinanceActPhase;
  code: string | null;
  detail: string | null;
  receipt: FinanceReceipt | null;
}

export type FinanceFence =
  | { reason: "in-flight"; action: FinanceActionKind }
  | { reason: "unknown-outcome"; seq: number; action: FinanceActionKind };

export interface FinanceControllerState {
  context: FinanceContext;
  readState: FinanceReadState;
  readCode: string | null;
  readDetail: string | null;
  snapshot: FinanceSnapshot | null;
  assessment: FinanceAssessment | null;
  freshness: FinanceFreshness;
  export: FinanceExportState;
  /** True after a request reached the source and no newer ready read has landed. */
  behind: boolean;
  fence: FinanceFence | null;
  last: FinanceActRecord | null;
  /** Unknown outcomes left in sessions this page no longer holds. They are not forgotten. */
  earlierUnknown: number;
  counters: FinanceCounters;
}

export type FinanceReadResult =
  | { kind: "APPLIED"; readState: FinanceReadState }
  | { kind: "DROPPED"; cause: "context-changed" | "older-read" };

export type FinanceExportResult =
  | { kind: "APPLIED"; phase: FinanceExportPhase }
  | { kind: "DROPPED"; cause: "context-changed" | "older-export" | "read-not-ready" }
  | { kind: "NOT_SENT"; reason: "not-bound" | "no-snapshot" | "no-capability"; detail: string };

export type FinanceNotSentReason =
  | "not-bound"
  | "no-snapshot"
  | "stale-read"
  | "blocked"
  | "no-capability"
  | "unknown-ref"
  | "bad-note";

export type FinanceActResult =
  | { kind: "APPLIED"; record: FinanceActRecord }
  | { kind: "REJECTED"; record: FinanceActRecord }
  | { kind: "UNKNOWN"; record: FinanceActRecord }
  | { kind: "FENCED"; fence: FinanceFence }
  | { kind: "NOT_SENT"; reason: FinanceNotSentReason; detail: string };

function contextKeyOf(parts: Pick<FinanceContext, "environment" | "domain" | "actorRef" | "scope" | "incarnation">): string {
  return [parts.environment, parts.domain, parts.actorRef, parts.scope.tenantId, parts.scope.bookRef, String(parts.incarnation)].join("|");
}

function failureText(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : "The call failed.";
}

/** The capability a request kind needs at the source. */
function capabilityFor(kind: FinanceActionKind): FinanceCapability {
  return kind === "approve-proposal" ? "approve" : "propose";
}

const NO_EXPORT: FinanceExportState = { phase: "none", code: null, detail: null, value: null, verdict: null };

export class FinanceOperationsController {
  private context: FinanceContext;
  private snapshot: FinanceSnapshot | null = null;
  private assessment: FinanceAssessment | null = null;
  private readState: FinanceReadState = "none";
  private readCode: string | null = null;
  private readDetail: string | null = null;
  private floor: string | null = null;
  private readSeq = 0;
  private appliedReadSeq = 0;
  private exportSeq = 0;
  private appliedExportSeq = 0;
  private exportPhase: FinanceExportPhase = "none";
  private exportCode: string | null = null;
  private exportDetail: string | null = null;
  private exportValue: FinanceExport | null = null;
  private actSeq = 0;
  private behind = false;
  private inFlight: FinanceActionKind | null = null;
  private fence: FinanceFence | null = null;
  private last: FinanceActRecord | null = null;
  private earlierUnknown = 0;
  /** Requests that reached the source and came back, in any way. A read compares it with its start. */
  private actsDone = 0;
  private readonly counters: FinanceCounters = { reads: 0, exports: 0, acts: 0, notSent: 0, droppedReads: 0, droppedExports: 0 };
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly port: FinanceOperationsPort,
    options: { actorRef?: string; bookRef?: string; incarnation?: number } = {},
  ) {
    const parts = {
      environment: port.environment,
      domain: PINNED_PROTOCOL_DOMAIN,
      actorRef: options.actorRef ?? FINANCE_REVIEWER_ACTOR,
      scope: { tenantId: FINANCE_TENANT, bookRef: options.bookRef ?? FINANCE_OWN_REF },
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

  state(): FinanceControllerState {
    let freshness: FinanceFreshness = "UNAVAILABLE";
    if (this.readState === "ready" || this.readState === "empty") {
      freshness = "CURRENT";
    } else if (this.readState === "stale") {
      freshness = "STALE";
    }
    const verdict = this.exportValue === null ? null : judgeFinanceExport(this.snapshot, this.assessment, this.exportValue);
    return {
      context: { ...this.context, scope: { ...this.context.scope } },
      readState: this.readState,
      readCode: this.readCode,
      readDetail: this.readDetail,
      snapshot: this.snapshot,
      assessment: this.assessment,
      freshness,
      export:
        this.exportPhase === "none" && this.exportValue === null
          ? { ...NO_EXPORT }
          : { phase: this.exportPhase, code: this.exportCode, detail: this.exportDetail, value: this.exportValue, verdict },
      behind: this.behind,
      fence: this.currentFence(),
      last: this.last,
      earlierUnknown: this.earlierUnknown,
      counters: { ...this.counters },
    };
  }

  private currentFence(): FinanceFence | null {
    if (this.inFlight !== null) {
      return { reason: "in-flight", action: this.inFlight };
    }
    return this.fence;
  }

  private clearView(): void {
    this.snapshot = null;
    this.assessment = null;
    this.clearExport();
  }

  private clearExport(): void {
    this.exportPhase = "none";
    this.exportCode = null;
    this.exportDetail = null;
    this.exportValue = null;
  }

  /** Starts a new context for a different part: another book or another actor. */
  private switchParts(next: { actorRef?: string; bookRef?: string }): FinanceContext | null {
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
      scope: { tenantId: this.context.scope.tenantId, bookRef: next.bookRef ?? this.context.scope.bookRef },
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
   * Starts a new context for another book scope. Rows and the export of the earlier scope
   * are cleared, and a read or an export still in flight for it will be dropped when it
   * arrives. It refuses while a request is in flight, because that request would have no
   * view to land on. An unknown outcome of the earlier scope is counted, not forgotten.
   */
  switchScope(bookRef: string): FinanceContext | null {
    return this.switchParts({ bookRef });
  }

  /**
   * Starts a new context for another desk actor. The capabilities the source grants the
   * actor decide which exports and requests may be sent; view, export, proposal, and
   * approval stay separate. Same drop and counting rules as a scope switch.
   */
  switchActor(actorRef: string): FinanceContext | null {
    return this.switchParts({ actorRef });
  }

  /** One read. A newer read in the same context wins, and an older answer is dropped. */
  async read(): Promise<FinanceReadResult> {
    const key = this.context.key;
    this.readSeq += 1;
    const seq = this.readSeq;
    const actsAtStart = this.actsDone;
    this.counters.reads += 1;
    let outcome: FinanceReadOutcome;
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
    this.apply(outcome, this.actsDone === actsAtStart);
    this.notify();
    return { kind: "APPLIED", readState: this.readState };
  }

  private apply(outcome: FinanceReadOutcome, noActSince: boolean): void {
    this.readCode = null;
    this.readDetail = null;
    if (outcome.kind === "ready") {
      this.snapshot = outcome.snapshot;
      this.assessment = assessFinanceSnapshot(outcome.snapshot);
      this.readState = "ready";
      this.floor = outcome.snapshot.watermark;
      // A request that came back after this read began may be missing from it. The view stays behind.
      if (noActSince) {
        this.behind = false;
      }
      return;
    }
    // Anything but a ready read leaves no row and no export on screen.
    this.clearView();
    switch (outcome.kind) {
      case "empty":
        this.readState = "empty";
        this.readDetail = `Book ${outcome.scope.bookRef} has no reconciliation cases at watermark ${outcome.watermark}.`;
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
   * Whether an export can be requested now, and if not, why. The screen shows this and the
   * send path enforces it, so a control that is off is an export that never leaves.
   */
  canExport(): FinanceEligibility {
    if (this.port.source === "none") {
      return { allowed: false, reason: FINANCE_NOT_BOUND_REASON };
    }
    if (this.readState !== "ready" || this.snapshot === null) {
      return { allowed: false, reason: "An export is judged against the last read. Read the queue first." };
    }
    if (!financeCapabilities(this.context.actorRef).includes("export")) {
      return {
        allowed: false,
        reason: `Actor ${this.context.actorRef} holds no export capability at the source. View, export, proposal, and approval stay separate.`,
      };
    }
    return { allowed: true, reason: null };
  }

  /**
   * One export request. It goes out only after a ready read, because an export is judged
   * against that read. A not-bound port sends nothing.
   */
  async loadExport(): Promise<FinanceExportResult> {
    const eligibility = this.canExport();
    if (!eligibility.allowed) {
      this.counters.notSent += 1;
      const reason = this.port.source === "none" ? "not-bound" : this.readState !== "ready" ? "no-snapshot" : "no-capability";
      if (reason === "not-bound") {
        this.exportPhase = "not-bound";
        this.exportCode = null;
        this.exportDetail = FINANCE_NOT_BOUND_REASON;
        this.exportValue = null;
      }
      this.notify();
      return { kind: "NOT_SENT", reason, detail: eligibility.reason ?? "" };
    }
    const key = this.context.key;
    this.exportSeq += 1;
    const seq = this.exportSeq;
    this.counters.exports += 1;
    let outcome: FinanceExportOutcome;
    try {
      outcome = await this.port.readExport({
        contextKey: key,
        actorRef: this.context.actorRef,
        scope: { ...this.context.scope },
      });
    } catch (error) {
      outcome = { kind: "unknown", message: failureText(error) };
    }
    if (key !== this.context.key) {
      this.counters.droppedExports += 1;
      this.notify();
      return { kind: "DROPPED", cause: "context-changed" };
    }
    if (seq < this.appliedExportSeq) {
      this.counters.droppedExports += 1;
      this.notify();
      return { kind: "DROPPED", cause: "older-export" };
    }
    if (this.readState !== "ready") {
      // The read this export would be judged against is gone, and the view holds no row.
      this.counters.droppedExports += 1;
      this.notify();
      return { kind: "DROPPED", cause: "read-not-ready" };
    }
    this.appliedExportSeq = seq;
    this.applyExport(outcome);
    this.notify();
    return { kind: "APPLIED", phase: this.exportPhase };
  }

  private applyExport(outcome: FinanceExportOutcome): void {
    this.exportCode = null;
    this.exportDetail = null;
    this.exportValue = null;
    switch (outcome.kind) {
      case "ready":
        this.exportPhase = "loaded";
        this.exportValue = outcome.export;
        return;
      case "denied":
        this.exportPhase = "denied";
        this.exportCode = outcome.code;
        this.exportDetail = outcome.detail;
        return;
      case "refused":
        this.exportPhase = "refused";
        this.exportCode = outcome.code;
        this.exportDetail = outcome.detail;
        return;
      case "invalid-request":
        this.exportPhase = "invalid";
        this.exportCode = outcome.code;
        this.exportDetail = outcome.detail;
        return;
      case "tuple-changed":
        this.exportPhase = "tuple-changed";
        this.exportDetail = `The pin tuple field ${outcome.field} changed.`;
        return;
      case "not-bound":
        this.exportPhase = "not-bound";
        this.exportDetail = outcome.reason;
        return;
      case "unknown":
        this.exportPhase = "unavailable";
        this.exportDetail = outcome.message;
        return;
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  }

  /**
   * Whether a request can be sent now, and if not, why. The screen shows this and the send
   * path enforces it, so a control that is off is a request that never leaves.
   */
  canSend(kind: FinanceActionKind): FinanceEligibility {
    if (this.port.source === "none") {
      return { allowed: false, reason: FINANCE_NOT_BOUND_REASON };
    }
    if (this.inFlight !== null) {
      return { allowed: false, reason: `A ${this.inFlight} request is in flight. One request goes at a time.` };
    }
    if (this.fence !== null) {
      return {
        allowed: false,
        reason:
          "An earlier request has an unknown outcome and may have been recorded. Nothing is sent again from here. Switching the scope or the actor, or starting a new synthetic session, begins a new context and counts this unknown outcome.",
      };
    }
    if (this.readState !== "ready" || this.snapshot === null || this.assessment === null) {
      return { allowed: false, reason: "Requests are built from the last read. Read the queue first." };
    }
    if (this.behind) {
      return { allowed: false, reason: "A request reached the source after the last read. Read again before the next request." };
    }
    const needed = capabilityFor(kind);
    if (!financeCapabilities(this.context.actorRef).includes(needed)) {
      return {
        allowed: false,
        reason: `Actor ${this.context.actorRef} holds no ${needed} capability at the source. View, export, proposal, and approval stay separate.`,
      };
    }
    return financeEligibility(this.snapshot, this.assessment, kind);
  }

  private notSent(reason: FinanceNotSentReason, detail: string): FinanceActResult {
    this.counters.notSent += 1;
    this.notify();
    return { kind: "NOT_SENT", reason, detail };
  }

  /** Why a request that is not on offer was not sent. */
  private notSentReason(kind: FinanceActionKind): FinanceNotSentReason {
    if (this.port.source === "none") {
      return "not-bound";
    }
    if (this.readState !== "ready" || this.snapshot === null) {
      return "no-snapshot";
    }
    if (this.behind) {
      return "stale-read";
    }
    return financeCapabilities(this.context.actorRef).includes(capabilityFor(kind)) ? "blocked" : "no-capability";
  }

  /**
   * The one send path. It fences first, then checks the offer, then builds the body from
   * the last read, then sends once. A body the read cannot support is not sent.
   */
  private async dispatch(
    kind: FinanceActionKind,
    build: (snapshot: FinanceSnapshot, assessment: FinanceAssessment) => FinanceActionRequest | { notSent: FinanceNotSentReason; detail: string },
  ): Promise<FinanceActResult> {
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
    let outcome: FinanceActOutcome;
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
    this.actsDone += 1;
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

  private record(seq: number, action: FinanceActionRequest, outcome: FinanceActOutcome): FinanceActRecord {
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
   * Proposes a correction on a case the last read lists. The case and the correction are
   * copied from the read, and the read must offer that correction on that case now. A
   * proposal is recorded, not applied: it changes no economic state, and a different actor
   * approves it.
   */
  proposeCorrection(caseRef: string, correction: FinanceCorrectionKind, note: string): Promise<FinanceActResult> {
    return this.dispatch("propose-correction", (snapshot, assessment) => {
      const row = snapshot.cases.find((item) => item.caseRef === caseRef);
      if (row === undefined) {
        return { notSent: "unknown-ref", detail: `The read lists no case ${caseRef}.` };
      }
      if (!financeProposableCorrections(snapshot, assessment, caseRef).includes(correction)) {
        return { notSent: "unknown-ref", detail: `The read does not offer ${correction} on case ${caseRef} now.` };
      }
      const text = note.trim();
      if (text.length === 0) {
        return { notSent: "bad-note", detail: "A proposal carries a note that says why." };
      }
      return { kind: "propose-correction", caseRef: row.caseRef, correction, note: text };
    });
  }

  /**
   * Records an approval of a pending proposal the read lists. A different actor approves
   * than proposed. The approval is a record: it changes no economic state and forces no match.
   */
  approveProposal(proposalRef: string): Promise<FinanceActResult> {
    return this.dispatch("approve-proposal", (snapshot) => {
      if (!isFinanceRef(proposalRef, "proposal")) {
        return { notSent: "unknown-ref", detail: `${proposalRef} is not a proposal reference.` };
      }
      const proposal = financeApprovableProposals(snapshot).find((row) => row.proposalRef === proposalRef);
      if (proposal === undefined) {
        const listed = snapshot.proposals.find((row) => row.proposalRef === proposalRef);
        return {
          notSent: "unknown-ref",
          detail:
            listed === undefined
              ? `The read lists no proposal ${proposalRef}.`
              : `Proposal ${proposalRef} is ${listed.state}. A proposal is approved only while it is pending.`,
        };
      }
      return { kind: "approve-proposal", proposalRef: proposal.proposalRef };
    });
  }
}
