import { SURFACES, type SurfaceId } from "./surfaces.js";

/**
 * App view models. Field names stay local: no desk method is a 1:1 command
 * in the contract-only OpenAPI pin. They are not Move struct layouts.
 */

export interface Performance {
  eventId: string;
  title: string;
  venue: string;
  startsAt: string;
  remainingCapacity: number;
}

export interface Hold {
  holdId: string;
  eventId: string;
  quantity: number;
  expiresAt: string;
  surface: typeof SURFACES.booking;
}

export interface Booking {
  bookingId: string;
  eventId: string;
  quantity: number;
  rightsRef: string;
  status: "confirmed" | "transferred";
  /** This app never moves funds. */
  payment: "simulated-no-funds";
  surfaces: SurfaceId[];
}

export interface AdmissionDecision {
  admitted: boolean;
  /** Human-readable stub or remote detail. Not a claimed protocol enum. */
  detail: string;
  rightsRef: string;
  gateId: string;
  surface: typeof SURFACES.admission;
  zkSurface: typeof SURFACES.zkGate;
  proofMode: "stub" | "remote";
}

export interface ResaleListing {
  listingId: string;
  bookingId: string;
  rightsRef: string;
  eventId: string;
  /** Display text only. Never parsed or charged. */
  askLabel: string;
  status: "open" | "transferred";
  surface: typeof SURFACES.resale;
}

export interface SettlementPreview {
  eventId: string;
  mode: "mock";
  surface: typeof SURFACES.settlementMock;
  /** Codes named by the Task 005 charter. This app does not define split rules. */
  references: readonly ["F01", "F02", "F03"];
  note: string;
}

/**
 * Mock FSM phase names from kix-protocol settlement_fsm.py.
 * F01, F02, F03, and P04 stay 설계중. These strings are not OpenAPI commands.
 */
export const SETTLEMENT_PHASES = [
  "INITIATED",
  "AUTHORIZED",
  "CAPTURED",
  "COMMITTED",
  "FAILED",
  "CANCELLED",
] as const;

export type SettlementPhase = (typeof SETTLEMENT_PHASES)[number];

export const SETTLEMENT_PROVENANCE = "MOCK_SETTLEMENT_ONLY" as const;

export const SETTLEMENT_REFERENCES = ["F01", "F02", "F03"] as const;

const SETTLEMENT_PHASE_SET: ReadonlySet<string> = new Set(SETTLEMENT_PHASES);

export function isSettlementPhase(value: unknown): value is SettlementPhase {
  return typeof value === "string" && SETTLEMENT_PHASE_SET.has(value);
}

export interface SettlementStep {
  settlementId: string;
  idempotencyKey: string;
}

export interface SettlementInitiate extends SettlementStep {
  eventId: string;
}

export interface SettlementReason extends SettlementStep {
  reason: string;
}

/**
 * Desk view of one in-process mock case.
 * No amounts. Protocol truth stays in kix-protocol.
 */
export interface SettlementCaseView {
  mode: "mock";
  surface: typeof SURFACES.settlementFsm;
  references: typeof SETTLEMENT_REFERENCES;
  provenance: typeof SETTLEMENT_PROVENANCE;
  /** Labels the mock machine. Not legal, bank, or chain authority. */
  lifecycleAuthority: "IN_MEMORY_FSM";
  settlementId: string;
  eventId: string;
  phase: SettlementPhase;
  terminal: boolean;
  /** Echo of the last accepted idempotency key. */
  idempotencyKey: string;
  failureReason: string | null;
  cancelReason: string | null;
  /** Last rejected command code in this process. Not journaled. */
  lastRejectCode: string | null;
  /**
   * Process-local journal replay flag.
   * Null until reconcile succeeds here. Not a bank match.
   */
  reconcileMatched: boolean | null;
  fundsExecuted: false;
  externalPayment: "UNSUPPORTED";
  providerAuthorizationExecuted: false;
  note: string;
}

export type SettlementLifecycleCommand =
  | "initiate"
  | "authorize"
  | "capture"
  | "commit"
  | "fail"
  | "cancel"
  | "reconcile";

export interface SettlementCommandReceipt {
  duplicate: boolean;
  applied: SettlementLifecycleCommand | null;
  provenance: typeof SETTLEMENT_PROVENANCE;
  externalPayment: "UNSUPPORTED";
  fundsExecuted: false;
  /** Echo of the idempotency key on this call. */
  idempotencyKey: string;
  settlement: SettlementCaseView;
}

export interface SettlementReconcileReceipt extends SettlementCommandReceipt {
  applied: "reconcile" | null;
  /** True only when this process's journal replays to the same case. */
  matched: true;
}

export interface AdapterMeta {
  adapter: "stub" | "http";
  liveChain: false;
  fundsMovement: "none";
  surfaces: SurfaceId[];
}

export class ProtocolError extends Error {
  /** Set for mock settlement rejections. Absent on older desk errors. */
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ProtocolError";
    this.code = code;
  }
}
