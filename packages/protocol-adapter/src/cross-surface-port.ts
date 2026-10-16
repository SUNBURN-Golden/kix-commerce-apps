import {
  CROSS_SURFACE_AS_OF,
  CROSS_SURFACE_HOLD_NOT_BOUND,
  CROSS_SURFACE_NON_CLAIMS,
  CROSS_SURFACE_NOT_BOUND_REASON,
  CROSS_SURFACE_NOT_COMPOSED,
  CROSS_SURFACE_RULING,
  CROSS_SURFACE_STATE,
  type CrossSurfaceScenario,
  type CrossSurfaceTable,
} from "./cross-surface-journeys.js";
import { composeCrossSurfaceRows } from "./cross-surface-branches.js";
import { checkDiscoveryReadTuple, type DiscoveryReadTuple } from "./discovery-read.js";

/**
 * Port for the cross-surface table: the stub builds it in this process from the
 * synthetic sources, and the not-bound port answers without a request. Neither
 * port sends a protocol command.
 */

// ---------------------------------------------------------------------------
// Port
// ---------------------------------------------------------------------------

export interface CrossSurfaceReadRequest {
  contextKey: string;
  intentRef: string;
}

export type CrossSurfaceReadOutcome =
  | { kind: "ready"; intentRef: string; contextKey: string; table: CrossSurfaceTable }
  | { kind: "invalid-request"; intentRef: string; contextKey: string; code: "INTENT" | "CONTEXT"; detail: string }
  | { kind: "tuple-changed"; intentRef: string; contextKey: string; field: string; expected: string; actual: string }
  | { kind: "not-bound"; intentRef: string; contextKey: string; reason: string }
  | { kind: "unknown"; intentRef: string; contextKey: string; detail: string };

export interface CrossSurfacePort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic-journeys" | "none";
  readonly scenario: CrossSurfaceScenario;
  read(request: CrossSurfaceReadRequest): Promise<CrossSurfaceReadOutcome>;
  /** Synthetic control: releases a held answer. A real source offers no such call. */
  deliverHeld(): number;
}

export interface StubCrossSurfaceOptions {
  scenario?: CrossSurfaceScenario;
  /** Expected tuple override. Used to stage a producer change in tests. */
  expectedTuple?: DiscoveryReadTuple;
}

export function createNotBoundCrossSurface(): CrossSurfacePort {
  return {
    environment: "integration-http",
    source: "none",
    scenario: "clean",
    read(request) {
      return Promise.resolve({
        kind: "not-bound",
        intentRef: request.intentRef,
        contextKey: request.contextKey,
        reason: CROSS_SURFACE_NOT_BOUND_REASON,
      });
    },
    deliverHeld() {
      return 0;
    },
  };
}

export function createStubCrossSurface(options: StubCrossSurfaceOptions = {}): CrossSurfacePort {
  return new StubCrossSurface(options);
}

export function crossSurfacePortFor(
  environment: "stub" | "integration-http",
  options: StubCrossSurfaceOptions = {},
): CrossSurfacePort {
  return environment === "stub" ? createStubCrossSurface(options) : createNotBoundCrossSurface();
}

class StubCrossSurface implements CrossSurfacePort {
  readonly environment = "stub" as const;
  readonly source = "synthetic-journeys" as const;
  readonly scenario: CrossSurfaceScenario;
  private readonly expectedTuple: DiscoveryReadTuple | undefined;
  private readonly held: { release: () => void }[] = [];
  private serial = 0;

  constructor(options: StubCrossSurfaceOptions) {
    this.scenario = options.scenario ?? "clean";
    this.expectedTuple = options.expectedTuple;
  }

  deliverHeld(): number {
    const releasing = this.held.splice(0, this.held.length);
    for (const entry of releasing) {
      entry.release();
    }
    return releasing.length;
  }

  read(request: CrossSurfaceReadRequest): Promise<CrossSurfaceReadOutcome> {
    const outcome = this.readNow(request);
    if (this.scenario === "held") {
      return new Promise<CrossSurfaceReadOutcome>((resolve) => {
        this.held.push({ release: () => resolve(outcome) });
      });
    }
    return outcome;
  }

  private readNow(request: CrossSurfaceReadRequest): Promise<CrossSurfaceReadOutcome> {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return Promise.resolve({
        kind: "tuple-changed",
        intentRef: request.intentRef,
        contextKey: request.contextKey,
        field: tuple.field,
        expected: tuple.expected,
        actual: tuple.actual,
      });
    }
    if (typeof request.intentRef !== "string" || request.intentRef.trim().length === 0) {
      return Promise.resolve({
        kind: "invalid-request",
        intentRef: String(request.intentRef),
        contextKey: String(request.contextKey),
        code: "INTENT",
        detail: "A table read carries an intent reference chosen by the caller.",
      });
    }
    if (typeof request.contextKey !== "string" || request.contextKey.trim().length === 0) {
      return Promise.resolve({
        kind: "invalid-request",
        intentRef: request.intentRef,
        contextKey: String(request.contextKey),
        code: "CONTEXT",
        detail: "A table read carries the caller's context key.",
      });
    }
    if (this.scenario === "read-lost") {
      // The answer to a read never arrives. The transport gives up and the read is unknown.
      return Promise.resolve({
        kind: "unknown",
        intentRef: request.intentRef,
        contextKey: request.contextKey,
        detail: "The answer to the table read never arrived. The table is not empty; it is unavailable.",
      });
    }
    return this.build(request);
  }

  private async build(request: CrossSurfaceReadRequest): Promise<CrossSurfaceReadOutcome> {
    this.serial += 1;
    const rows = this.scenario === "empty" ? [] : await composeCrossSurfaceRows();
    const table: CrossSurfaceTable = {
      tableId: `xs-${String(this.serial).padStart(4, "0")}`,
      asOf: CROSS_SURFACE_AS_OF,
      state: CROSS_SURFACE_STATE,
      ruling: CROSS_SURFACE_RULING,
      environment: "stub",
      rows,
      notComposed: CROSS_SURFACE_NOT_COMPOSED,
      holdNotBound: CROSS_SURFACE_HOLD_NOT_BOUND,
      nonClaims: CROSS_SURFACE_NON_CLAIMS,
    };
    if (this.scenario === "claims-pass") {
      // A deliberately malformed answer: it claims a compensation ran and an UNKNOWN resolved.
      const tainted = {
        ...table,
        nonClaims: { ...table.nonClaims, compensationExecuted: true, unknownResolved: true },
      } as unknown as CrossSurfaceTable;
      return { kind: "ready", intentRef: request.intentRef, contextKey: request.contextKey, table: tainted };
    }
    return { kind: "ready", intentRef: request.intentRef, contextKey: request.contextKey, table };
  }
}
