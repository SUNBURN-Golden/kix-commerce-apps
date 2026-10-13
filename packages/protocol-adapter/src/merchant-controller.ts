import {
  MERCHANT_NOT_BOUND_REASON,
  MERCHANT_OWN_REF,
  MERCHANT_TENANT,
  assessMerchantSnapshot,
  judgeMerchantExport,
  type MerchantAssessment,
  type MerchantExport,
  type MerchantExportOutcome,
  type MerchantExportVerdict,
  type MerchantOperationsPort,
  type MerchantReadOutcome,
  type MerchantScope,
  type MerchantSnapshot,
} from "./merchant-operations.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";

/**
 * Client side of the merchant workroom: the context key, the read and export
 * reducers, and the drop rules. It decides what the screen may show next and from
 * which source. It decides nothing about money: every figure it holds is the
 * source's, and it adds no amount to another.
 *
 * Rules, all tested:
 *  - A read or an export is one port call. A failed or lost one is shown as
 *    unavailable and is not sent again by this class. The next call is the user's.
 *  - A result that arrives after the context changed (merchant scope, session
 *    incarnation), or after a newer one of its kind was applied, is dropped. It does
 *    not touch the current view.
 *  - Any read that is not ready, and any change of scope, clears the rows and the
 *    export. A refused or denied scope leaves nothing of an earlier scope on screen.
 *  - An export is judged against the last read each time state() is called, so an
 *    export taken before the source moved on turns stale without a second call.
 *  - Nothing here sends a command. The class has no write path.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

export const MERCHANT_FRESHNESS = ["CURRENT", "STALE", "UNAVAILABLE"] as const;

export type MerchantFreshness = (typeof MERCHANT_FRESHNESS)[number];

export type MerchantReadState =
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

export type MerchantExportPhase =
  | "none"
  | "loaded"
  | "denied"
  | "refused"
  | "invalid"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export interface MerchantContext {
  environment: "stub" | "integration-http";
  domain: string;
  /** A context label. It is not an authentication result. */
  actorRef: string;
  scope: MerchantScope;
  /** Session incarnation. Bumped when the page switches scope. */
  incarnation: number;
  key: string;
}

export interface MerchantCounters {
  /** Calls that reached port.read. */
  reads: number;
  /** Calls that reached port.readExport. */
  exports: number;
  /** Export requests refused before the port. */
  notSent: number;
  droppedReads: number;
  droppedExports: number;
}

export interface MerchantExportState {
  phase: MerchantExportPhase;
  code: string | null;
  detail: string | null;
  value: MerchantExport | null;
  /** Judged against the last read at the moment state() was called. Null with no export. */
  verdict: MerchantExportVerdict | null;
}

export interface MerchantControllerState {
  context: MerchantContext;
  readState: MerchantReadState;
  readCode: string | null;
  readDetail: string | null;
  snapshot: MerchantSnapshot | null;
  assessment: MerchantAssessment | null;
  freshness: MerchantFreshness;
  export: MerchantExportState;
  counters: MerchantCounters;
}

export type MerchantReadResult =
  | { kind: "APPLIED"; readState: MerchantReadState }
  | { kind: "DROPPED"; cause: "context-changed" | "older-read" };

export type MerchantExportResult =
  | { kind: "APPLIED"; phase: MerchantExportPhase }
  | { kind: "DROPPED"; cause: "context-changed" | "older-export" }
  | { kind: "NOT_SENT"; reason: "not-bound" | "no-snapshot" };

function contextKeyOf(parts: Pick<MerchantContext, "environment" | "domain" | "actorRef" | "scope" | "incarnation">): string {
  return [parts.environment, parts.domain, parts.actorRef, parts.scope.tenantId, parts.scope.merchantRef, String(parts.incarnation)].join("|");
}

function failureText(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : "The call failed.";
}

const NO_EXPORT: MerchantExportState = { phase: "none", code: null, detail: null, value: null, verdict: null };

export class MerchantOperationsController {
  private context: MerchantContext;
  private snapshot: MerchantSnapshot | null = null;
  private assessment: MerchantAssessment | null = null;
  private readState: MerchantReadState = "none";
  private readCode: string | null = null;
  private readDetail: string | null = null;
  private floor: string | null = null;
  private readSeq = 0;
  private appliedReadSeq = 0;
  private exportSeq = 0;
  private appliedExportSeq = 0;
  private exportPhase: MerchantExportPhase = "none";
  private exportCode: string | null = null;
  private exportDetail: string | null = null;
  private exportValue: MerchantExport | null = null;
  private readonly counters: MerchantCounters = { reads: 0, exports: 0, notSent: 0, droppedReads: 0, droppedExports: 0 };
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly port: MerchantOperationsPort,
    options: { actorRef: string; merchantRef?: string; incarnation?: number },
  ) {
    const parts = {
      environment: port.environment,
      domain: PINNED_PROTOCOL_DOMAIN,
      actorRef: options.actorRef,
      scope: { tenantId: MERCHANT_TENANT, merchantRef: options.merchantRef ?? MERCHANT_OWN_REF },
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

  state(): MerchantControllerState {
    let freshness: MerchantFreshness = "UNAVAILABLE";
    if (this.readState === "ready" || this.readState === "empty") {
      freshness = "CURRENT";
    } else if (this.readState === "stale") {
      freshness = "STALE";
    }
    const verdict = this.exportValue === null ? null : judgeMerchantExport(this.snapshot, this.assessment, this.exportValue);
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
      counters: { ...this.counters },
    };
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

  /**
   * Starts a new context for another merchant scope. Rows and the export of the
   * earlier scope are cleared, and a read or an export still in flight for it will be
   * dropped when it arrives.
   */
  switchScope(merchantRef: string): MerchantContext {
    const parts = {
      environment: this.context.environment,
      domain: this.context.domain,
      actorRef: this.context.actorRef,
      scope: { tenantId: this.context.scope.tenantId, merchantRef },
      incarnation: this.context.incarnation + 1,
    };
    this.context = { ...parts, key: contextKeyOf(parts) };
    this.clearView();
    this.readState = "none";
    this.readCode = null;
    this.readDetail = null;
    this.floor = null;
    this.notify();
    return { ...this.context, scope: { ...this.context.scope } };
  }

  /** One read. A newer read in the same context wins, and an older answer is dropped. */
  async read(): Promise<MerchantReadResult> {
    const key = this.context.key;
    this.readSeq += 1;
    const seq = this.readSeq;
    this.counters.reads += 1;
    let outcome: MerchantReadOutcome;
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

  private apply(outcome: MerchantReadOutcome): void {
    this.readCode = null;
    this.readDetail = null;
    if (outcome.kind === "ready") {
      this.snapshot = outcome.snapshot;
      this.assessment = assessMerchantSnapshot(outcome.snapshot);
      this.readState = "ready";
      this.floor = outcome.snapshot.watermark;
      return;
    }
    // Anything but a ready read leaves no row and no export on screen.
    this.clearView();
    switch (outcome.kind) {
      case "empty":
        this.readState = "empty";
        this.readDetail = `Merchant ${outcome.scope.merchantRef} has no rows at watermark ${outcome.watermark}.`;
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
   * One export request. It goes out only after a ready read, because an export is
   * judged against that read. A not-bound port sends nothing.
   */
  async loadExport(): Promise<MerchantExportResult> {
    if (this.port.source === "none") {
      this.counters.notSent += 1;
      this.exportPhase = "not-bound";
      this.exportCode = null;
      this.exportDetail = MERCHANT_NOT_BOUND_REASON;
      this.exportValue = null;
      this.notify();
      return { kind: "NOT_SENT", reason: "not-bound" };
    }
    if (this.readState !== "ready") {
      this.counters.notSent += 1;
      this.notify();
      return { kind: "NOT_SENT", reason: "no-snapshot" };
    }
    const key = this.context.key;
    this.exportSeq += 1;
    const seq = this.exportSeq;
    this.counters.exports += 1;
    let outcome: MerchantExportOutcome;
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
    this.appliedExportSeq = seq;
    this.applyExport(outcome);
    this.notify();
    return { kind: "APPLIED", phase: this.exportPhase };
  }

  private applyExport(outcome: MerchantExportOutcome): void {
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
}
