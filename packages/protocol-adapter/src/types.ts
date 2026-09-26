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

/**
 * Mock FSM phase names from kix-protocol reservation_fsm.py.
 * B01–B05, R01–R05, and P03 stay 설계중. These strings are not OpenAPI commands.
 */
export const RESERVATION_PHASES = [
  "HELD",
  "RELEASED",
  "CONFIRMED",
  "CANCELLED",
  "PAYMENT_NOTED",
  "ISSUED",
  "ADMISSION_AUTHORIZED",
  "CONSUMED",
] as const;

export type ReservationPhase = (typeof RESERVATION_PHASES)[number];

export const RESERVATION_PROVENANCE = "MOCK_GATE_ONLY" as const;

export const RESERVATION_REFERENCES = ["B01", "B02", "B03", "B04", "B05"] as const;

export const RESERVATION_ADMISSION_REFERENCE = "P03" as const;

export const RESERVATION_SLOT_STATES = ["FREE", "RESERVED", "ISSUED"] as const;

export type ReservationSlotState = (typeof RESERVATION_SLOT_STATES)[number];

export const RESERVATION_SETTLEMENT_GATES = ["UNBOUND", "BOUND", "MOCK_COMMIT_OBSERVED"] as const;

export type ReservationSettlementGate = (typeof RESERVATION_SETTLEMENT_GATES)[number];

export const RESERVATION_ISSUE_STATUSES = ["unissued", "issued", "consumed"] as const;

export type ReservationIssueStatus = (typeof RESERVATION_ISSUE_STATUSES)[number];

const RESERVATION_PHASE_SET: ReadonlySet<string> = new Set(RESERVATION_PHASES);

export function isReservationPhase(value: unknown): value is ReservationPhase {
  return typeof value === "string" && RESERVATION_PHASE_SET.has(value);
}

export interface ReservationClock {
  idempotencyKey: string;
  /** ISO-8601 timestamp for the stub's logical clock. Not a venue clock. */
  nowAt: string;
}

export interface ReservationShowRegister {
  showId: string;
  eventId: string;
  idempotencyKey: string;
  /** Slot labels declared by the desk. Not a capacity calculation. */
  slots: readonly string[];
}

export interface ReservationHold {
  reservationId: string;
  showId: string;
  slot: string;
  buyerRole: string;
  /** ISO-8601 hold window. Expiry does not release the slot by itself. */
  expiresAt: string;
  idempotencyKey: string;
}

export interface ReservationStep {
  reservationId: string;
  idempotencyKey: string;
}

export interface ReservationConfirm {
  orderId: string;
  reservationId: string;
  idempotencyKey: string;
}

export interface ReservationPayment {
  orderId: string;
  idempotencyKey: string;
  /** Opaque mock reference. Not a provider payment id. */
  paymentRef: string;
}

export interface ReservationBind {
  reservationId: string;
  settlementId: string;
  idempotencyKey: string;
}

export interface ReservationIssue {
  issuanceId: string;
  orderId: string;
  idempotencyKey: string;
}

export interface ReservationAuthorize {
  admissionId: string;
  rightId: string;
  idempotencyKey: string;
}

export interface ReservationConsume {
  consumeId: string;
  rightId: string;
  idempotencyKey: string;
}

export interface ReservationSlotView {
  slot: string;
  state: ReservationSlotState;
  reservationId: string | null;
  rightId: string | null;
}

/**
 * Desk view of one declared mock show.
 * Slot rows are occupancy labels. They are not catalog capacity and not MockGates arithmetic.
 */
export interface ReservationShowView {
  mode: "mock";
  surface: typeof SURFACES.bookingFsm;
  provenance: typeof RESERVATION_PROVENANCE;
  showId: string;
  eventId: string;
  /** Stub logical clock in milliseconds. Not a venue clock. */
  logicalTimeMs: number;
  slots: ReservationSlotView[];
  note: string;
}

/**
 * Desk view of one in-process mock reservation.
 * No prices and no inventory math. Protocol truth stays in kix-protocol.
 */
export interface ReservationCaseView {
  mode: "mock";
  surface: typeof SURFACES.bookingFsm;
  admissionSurface: typeof SURFACES.admissionFsm;
  references: typeof RESERVATION_REFERENCES;
  admissionReference: typeof RESERVATION_ADMISSION_REFERENCE;
  provenance: typeof RESERVATION_PROVENANCE;
  /** Labels the mock machine. Not legal, venue, or chain authority. */
  lifecycleAuthority: "IN_MEMORY_FSM";
  reservationId: string;
  phase: ReservationPhase;
  terminal: boolean;
  showId: string;
  eventId: string;
  slot: string;
  slotState: ReservationSlotState;
  /** True when the live slot row still names this case. */
  slotHeldByCase: boolean;
  buyerRole: string;
  expiresAt: string;
  /** True only while a pre-issue phase is at or past its window. Release is still required. */
  expired: boolean;
  orderId: string | null;
  paymentRef: string | null;
  issuanceId: string | null;
  rightId: string | null;
  issueStatus: ReservationIssueStatus;
  admissionId: string | null;
  consumeId: string | null;
  settlementId: string | null;
  settlementGate: ReservationSettlementGate;
  /** True only after issue observed a mock settlement view in COMMITTED. */
  mockSettlementCommitObserved: boolean;
  /** Ticket evidence is not economic finality. This flag stays false. */
  economicFinalityClaimed: false;
  fundsExecuted: false;
  chainIssued: false;
  admissionRoutingProduction: false;
  externalPayment: "UNSUPPORTED";
  externalAdmission: "UNSUPPORTED";
  /** Stub logical clock in milliseconds. Not a venue clock. */
  logicalTimeMs: number;
  /** Echo of the last accepted idempotency key. */
  idempotencyKey: string;
  /** Last rejected command code in this process. Not journaled. */
  lastRejectCode: string | null;
  /**
   * Process-local journal replay flag.
   * Null until reconcile succeeds here. Not admission routing and not chain finality.
   */
  reconcileMatched: boolean | null;
  note: string;
}

export type ReservationLifecycleCommand =
  | "set_clock"
  | "register_show"
  | "hold"
  | "release"
  | "confirm"
  | "cancel"
  | "observe_payment"
  | "bind_settlement"
  | "issue"
  | "authorize_admission"
  | "consume"
  | "reconcile";

export interface ReservationCommandReceipt {
  duplicate: boolean;
  applied: ReservationLifecycleCommand | null;
  provenance: typeof RESERVATION_PROVENANCE;
  economicFinalityClaimed: false;
  fundsExecuted: false;
  externalPayment: "UNSUPPORTED";
  externalAdmission: "UNSUPPORTED";
  /** Echo of the idempotency key on this call. */
  idempotencyKey: string;
  logicalTimeMs: number;
  reservation: ReservationCaseView | null;
  show: ReservationShowView | null;
}

export interface ReservationReconcileReceipt extends ReservationCommandReceipt {
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
