import {
  CROSS_SURFACE_BASES,
  CROSS_SURFACE_NOT_BOUND_REASON,
  CROSS_SURFACE_STATUSES,
  refuseCrossSurfaceTable,
  type CrossSurfaceBasis,
  type CrossSurfaceBranch,
  type CrossSurfaceJourney,
  type CrossSurfaceRow,
  type CrossSurfaceStatus,
  type CrossSurfaceTable,
} from "./cross-surface-journeys.js";
import type { CrossSurfacePort, CrossSurfaceReadOutcome } from "./cross-surface-port.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";

/**
 * Client side of the cross-surface table: the context key, the read reducer, the
 * client-side filter, and the drop rules. It decides what the screen may show next.
 *
 * Rules, all tested:
 *  - A read is one port call. A lost one is shown as unavailable, never as an empty
 *    table, and is not sent again by this class. The next call is the user's.
 *  - A read that arrives after the context changed, or after a newer read was
 *    applied, is dropped and touches nothing on screen.
 *  - A table that claims a completed journey, an executed compensation, or a
 *    resolved UNKNOWN is refused whole, and no row of it stays on screen.
 *  - The filter works on the rows already held. It never reads the port again.
 *  - Nothing here sends a command. The class has no write path.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

export const CROSS_SURFACE_FRESHNESS = ["CURRENT", "UNAVAILABLE"] as const;

export type CrossSurfaceFreshness = (typeof CROSS_SURFACE_FRESHNESS)[number];

export type CrossSurfaceReadState =
  | "none"
  | "ready"
  | "empty"
  | "refused"
  | "invalid"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export interface CrossSurfaceContext {
  environment: "stub" | "integration-http";
  domain: string;
  /** A context label. It is not an authentication result. */
  actorRef: string;
  /** Session incarnation. Bumped when the page switches context. */
  incarnation: number;
  key: string;
}

export interface CrossSurfaceCounters {
  /** Calls that reached port.read. */
  reads: number;
  /** Reads refused before the port. */
  notSent: number;
  droppedReads: number;
}

export interface CrossSurfaceFilter {
  journey: CrossSurfaceJourney | null;
  branch: CrossSurfaceBranch | null;
  status: CrossSurfaceStatus | null;
}

export interface CrossSurfaceControllerState {
  context: CrossSurfaceContext;
  readState: CrossSurfaceReadState;
  readCode: string | null;
  readDetail: string | null;
  table: CrossSurfaceTable | null;
  freshness: CrossSurfaceFreshness;
  filter: CrossSurfaceFilter;
  counters: CrossSurfaceCounters;
}

export type CrossSurfaceReadResult =
  | { kind: "APPLIED"; readState: CrossSurfaceReadState }
  | { kind: "DROPPED"; cause: "context-changed" | "older-read" }
  | { kind: "NOT_SENT"; reason: "not-bound" };

export interface CrossSurfaceSummary {
  rows: number;
  byStatus: Readonly<Record<CrossSurfaceStatus, number>>;
  byBasis: Readonly<Record<CrossSurfaceBasis, number>>;
  /** Rows whose status is partial, unknown, or blocked. A reference row is not counted here and not as a success. */
  openRows: number;
}

/** Counts rows by status and basis. A pointer or a missing branch is never counted as closed. */
export function summarizeCrossSurfaceRows(rows: readonly CrossSurfaceRow[]): CrossSurfaceSummary {
  const byStatus = Object.fromEntries(CROSS_SURFACE_STATUSES.map((status) => [status, 0])) as Record<CrossSurfaceStatus, number>;
  const byBasis = Object.fromEntries(CROSS_SURFACE_BASES.map((basis) => [basis, 0])) as Record<CrossSurfaceBasis, number>;
  for (const row of rows) {
    byStatus[row.status] += 1;
    byBasis[row.basis] += 1;
  }
  return { rows: rows.length, byStatus, byBasis, openRows: byStatus.partial + byStatus.unknown + byStatus.blocked };
}

const NO_FILTER: CrossSurfaceFilter = { journey: null, branch: null, status: null };

function contextKeyOf(parts: Pick<CrossSurfaceContext, "environment" | "domain" | "actorRef" | "incarnation">): string {
  return [parts.environment, parts.domain, parts.actorRef, String(parts.incarnation)].join("|");
}

function failureText(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : "The call failed.";
}

export class CrossSurfaceController {
  private context: CrossSurfaceContext;
  private table: CrossSurfaceTable | null = null;
  private readState: CrossSurfaceReadState = "none";
  private readCode: string | null = null;
  private readDetail: string | null = null;
  private filter: CrossSurfaceFilter = { ...NO_FILTER };
  private readSeq = 0;
  private appliedReadSeq = 0;
  private readonly counters: CrossSurfaceCounters = { reads: 0, notSent: 0, droppedReads: 0 };
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly port: CrossSurfacePort,
    options: { actorRef: string; incarnation?: number },
  ) {
    const parts = {
      environment: port.environment,
      domain: PINNED_PROTOCOL_DOMAIN,
      actorRef: options.actorRef,
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

  state(): CrossSurfaceControllerState {
    return {
      context: { ...this.context },
      readState: this.readState,
      readCode: this.readCode,
      readDetail: this.readDetail,
      table: this.table,
      freshness: this.readState === "ready" || this.readState === "empty" ? "CURRENT" : "UNAVAILABLE",
      filter: { ...this.filter },
      counters: { ...this.counters },
    };
  }

  /** The rows that pass the filter. The filter is applied to rows already held. */
  view(): readonly CrossSurfaceRow[] {
    if (this.table === null) {
      return [];
    }
    return this.table.rows.filter(
      (row) =>
        (this.filter.journey === null || row.journey === this.filter.journey) &&
        (this.filter.branch === null || row.branch === this.filter.branch) &&
        (this.filter.status === null || row.status === this.filter.status),
    );
  }

  setFilter(next: Partial<CrossSurfaceFilter>): CrossSurfaceFilter {
    this.filter = { ...this.filter, ...next };
    this.notify();
    return { ...this.filter };
  }

  clearFilter(): void {
    this.filter = { ...NO_FILTER };
    this.notify();
  }

  /** Starts a new context for another actor label. The table is cleared, and a read still in flight is dropped when it arrives. */
  switchContext(actorRef: string): CrossSurfaceContext {
    const parts = {
      environment: this.context.environment,
      domain: this.context.domain,
      actorRef,
      incarnation: this.context.incarnation + 1,
    };
    this.context = { ...parts, key: contextKeyOf(parts) };
    this.clearView();
    this.readState = "none";
    this.readCode = null;
    this.readDetail = null;
    this.filter = { ...NO_FILTER };
    this.notify();
    return { ...this.context };
  }

  private clearView(): void {
    this.table = null;
  }

  /** One read. A newer read in the same context wins, and an older answer is dropped. */
  async read(): Promise<CrossSurfaceReadResult> {
    if (this.port.source === "none") {
      this.counters.notSent += 1;
      this.clearView();
      this.readState = "not-bound";
      this.readCode = null;
      this.readDetail = CROSS_SURFACE_NOT_BOUND_REASON;
      this.notify();
      return { kind: "NOT_SENT", reason: "not-bound" };
    }
    const key = this.context.key;
    this.readSeq += 1;
    const seq = this.readSeq;
    this.counters.reads += 1;
    let outcome: CrossSurfaceReadOutcome;
    try {
      outcome = await this.port.read({ contextKey: key, intentRef: `xs-read-${String(seq)}` });
    } catch (error) {
      outcome = { kind: "unknown", intentRef: `xs-read-${String(seq)}`, contextKey: key, detail: failureText(error) };
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

  private apply(outcome: CrossSurfaceReadOutcome): void {
    this.readCode = null;
    this.readDetail = null;
    // Anything but a trusted table leaves no row on screen.
    this.clearView();
    switch (outcome.kind) {
      case "ready": {
        const refusal = refuseCrossSurfaceTable(outcome.table);
        if (refusal !== null) {
          this.readState = "refused";
          this.readCode = refusal.code;
          this.readDetail = refusal.detail;
          return;
        }
        this.table = outcome.table;
        this.readState = outcome.table.rows.length === 0 ? "empty" : "ready";
        return;
      }
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
        this.readDetail = outcome.detail;
        return;
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  }
}
