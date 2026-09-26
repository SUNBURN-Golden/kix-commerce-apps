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

/**
 * Credential phases from kix-protocol admission_fsm.py.
 * P03 stays 설계중. These strings are not OpenAPI commands.
 */
export const ADMISSION_PHASES = ["ELIGIBLE", "AUTHORIZED", "CONSUMED"] as const;

export type AdmissionPhase = (typeof ADMISSION_PHASES)[number];

/**
 * Desk labels for a credential check.
 * The adapter assigns the label. The UI prints it and does not choose entry.
 */
export const ADMISSION_DESK_STATES = [
  "valid",
  "invalid",
  "stale",
  "already-consumed",
  "transferred",
  "cancelled",
  "unavailable-server",
] as const;

export type AdmissionDeskState = (typeof ADMISSION_DESK_STATES)[number];

const ADMISSION_PHASE_SET: ReadonlySet<string> = new Set(ADMISSION_PHASES);
const ADMISSION_DESK_STATE_SET: ReadonlySet<string> = new Set(ADMISSION_DESK_STATES);

export function isAdmissionPhase(value: unknown): value is AdmissionPhase {
  return typeof value === "string" && ADMISSION_PHASE_SET.has(value);
}

export function isAdmissionDeskState(value: unknown): value is AdmissionDeskState {
  return typeof value === "string" && ADMISSION_DESK_STATE_SET.has(value);
}

export interface AdmissionClock {
  idempotencyKey: string;
  /** ISO-8601 timestamp for the stub's logical clock. Not a venue clock. */
  nowAt: string;
}

export interface AdmissionAdopt {
  rightId: string;
  reservationId: string;
  idempotencyKey: string;
}

export interface AdmissionAuthorize {
  admissionId: string;
  rightId: string;
  version: number;
  holderRole: string;
  gateRole: string;
  request: string;
  expiresAt: string;
  idempotencyKey: string;
  externalDependency?: string | null;
}

export interface AdmissionConsume {
  consumeId: string;
  rightId: string;
  version: number;
  gateRole: string;
  request: string;
  idempotencyKey: string;
  externalDependency?: string | null;
}

export interface AdmissionReconcile {
  rightId: string;
  idempotencyKey: string;
}

export interface AdmissionPresentationQuery {
  rightId: string;
  version: number;
  holderRole: string;
}

/**
 * Read-only desk view of one mock credential.
 * `deskState` is the adapter label. It is not a venue scan result.
 */
export interface AdmissionPresentation {
  mode: "mock" | "http-boundary";
  surface: typeof SURFACES.admissionFsm;
  provenance: typeof RESERVATION_PROVENANCE;
  lifecycleAuthority: "IN_MEMORY_FSM" | "INTEGRATION_GATE_TRANSPORT";
  rightId: string;
  version: number;
  holderRole: string;
  phase: AdmissionPhase | null;
  fresh: boolean;
  decision: string | null;
  deskState: AdmissionDeskState;
  transferObserved: boolean;
  offlineAdmission: false;
  venueCredentialReissued: false;
  admissionRoutingProduction: false;
  externalAdmission: "UNSUPPORTED";
  economicFinalityClaimed: false;
  fundsExecuted: false;
  note: string;
}

export interface AdmissionCredentialView {
  mode: "mock";
  surface: typeof SURFACES.admissionFsm;
  admissionReference: typeof RESERVATION_ADMISSION_REFERENCE;
  provenance: typeof RESERVATION_PROVENANCE;
  lifecycleAuthority: "IN_MEMORY_FSM";
  rightId: string;
  reservationId: string;
  phase: AdmissionPhase;
  terminal: boolean;
  holderRole: string;
  version: number;
  admissionId: string | null;
  consumeId: string | null;
  gateRole: string | null;
  admissionExpired: boolean;
  offlineAdmission: false;
  venueCredentialReissued: false;
  admissionRoutingProduction: false;
  externalAdmission: "UNSUPPORTED";
  economicFinalityClaimed: false;
  fundsExecuted: false;
  logicalTimeMs: number;
  idempotencyKey: string;
  lastRejectCode: string | null;
  reconcileMatched: boolean | null;
  note: string;
}

export type AdmissionLifecycleCommand = "set_clock" | "adopt_issued" | "authorize_admission" | "consume" | "reconcile";

export interface AdmissionCommandReceipt {
  duplicate: boolean;
  applied: AdmissionLifecycleCommand | null;
  provenance: typeof RESERVATION_PROVENANCE;
  lifecycleAuthority: "IN_MEMORY_FSM";
  offlineAdmission: false;
  venueCredentialReissued: false;
  admissionRoutingProduction: false;
  externalAdmission: "UNSUPPORTED";
  economicFinalityClaimed: false;
  fundsExecuted: false;
  idempotencyKey: string;
  logicalTimeMs: number;
  credential: AdmissionCredentialView | null;
  presentation: AdmissionPresentation;
}

export interface AdmissionReconcileReceipt extends AdmissionCommandReceipt {
  applied: "reconcile" | null;
  /** True only when this process's journal replays to the same credential. */
  matched: true;
}

/**
 * Listing phases from kix-protocol resale_fsm.py.
 * R01–R05 stay 설계중. These strings are not OpenAPI commands.
 * ELIGIBLE is a right-eligibility label in that machine, not a listing phase.
 */
export const RESALE_PHASES = [
  "LISTED",
  "BUY_HELD",
  "PAYMENT_NOTED",
  "TRANSFERRED",
  "CLOSED",
  "CANCELLED",
] as const;

export type ResalePhase = (typeof RESALE_PHASES)[number];

export const RESALE_ELIGIBILITY = ["ELIGIBLE", "LOCKED"] as const;

export type ResaleEligibility = (typeof RESALE_ELIGIBILITY)[number];

export const RESALE_PROVENANCE = "MOCK_GATE_ONLY" as const;

export const RESALE_REFERENCES = ["R01", "R02", "R03", "R04", "R05"] as const;

export const RESALE_SETTLEMENT_GATES = ["UNBOUND", "BOUND", "MOCK_COMMIT_OBSERVED"] as const;

export type ResaleSettlementGate = (typeof RESALE_SETTLEMENT_GATES)[number];

const RESALE_PHASE_SET: ReadonlySet<string> = new Set(RESALE_PHASES);

export function isResalePhase(value: unknown): value is ResalePhase {
  return typeof value === "string" && RESALE_PHASE_SET.has(value);
}

export interface ResaleClock {
  idempotencyKey: string;
  /** ISO-8601 timestamp for the stub's logical clock. Not a marketplace clock. */
  nowAt: string;
}

export interface ResaleAdopt {
  rightId: string;
  showId: string;
  eventId: string;
  slot: string;
  holderRole: string;
  /** Null adopts a desk-local right. A reservation id is checked against the mock reservation case. */
  reservationId: string | null;
  /** Opaque mock reference from issuance. Not a provider payment id. */
  paymentRef: string;
  idempotencyKey: string;
}

export interface ResaleList {
  listingId: string;
  rightId: string;
  /** Listed holder version. Not a price and not a fee. */
  version: number;
  sellerRole: string;
  recipientRole: string;
  /** ISO-8601 listing window. Expiry does not cancel the phase by itself. */
  expiresAt: string;
  reservationId: string | null;
  idempotencyKey: string;
}

export interface ResaleHoldBuy {
  holdId: string;
  listingId: string;
  buyerRole: string;
  idempotencyKey: string;
}

export interface ResaleReleaseHold {
  holdId: string;
  buyerRole: string;
  idempotencyKey: string;
}

export interface ResaleCancelListing {
  listingId: string;
  sellerRole: string;
  idempotencyKey: string;
}

export interface ResalePayment {
  listingId: string;
  idempotencyKey: string;
  /** Opaque mock reference. Not a provider payment id. */
  paymentRef: string;
  buyerRole: string | null;
}

export interface ResaleBind {
  listingId: string;
  settlementId: string;
  idempotencyKey: string;
}

export interface ResaleAccept {
  transferId: string;
  listingId: string;
  idempotencyKey: string;
}

export interface ResaleStep {
  listingId: string;
  idempotencyKey: string;
}

export interface ResalePresentationQuery {
  rightId: string;
  version: number;
  holderRole: string;
}

/**
 * Desk view of one adopted mock right.
 * Eligibility is a label. It is not a marketplace quote and not MockGates arithmetic.
 */
export interface ResaleRightView {
  mode: "mock";
  surface: typeof SURFACES.resaleFsm;
  references: typeof RESALE_REFERENCES;
  provenance: typeof RESALE_PROVENANCE;
  lifecycleAuthority: "IN_MEMORY_FSM";
  rightId: string;
  eligibility: ResaleEligibility;
  eligible: boolean;
  /** Live listing phase, or null when no listing is open. */
  salePhase: ResalePhase | null;
  reservationId: string | null;
  showId: string;
  eventId: string;
  slot: string;
  holderRole: string;
  version: number;
  /** This desk does not mint a new generation. */
  generation: 1;
  activeListingId: string | null;
  economicFinalityClaimed: false;
  fundsExecuted: false;
  venueCredentialReissued: false;
  externalMarketplace: "UNSUPPORTED";
  logicalTimeMs: number;
  lastRejectCode: string | null;
  note: string;
}

/**
 * Desk view of one in-process mock listing.
 * No prices and no fee splits. Protocol truth stays in kix-protocol.
 */
export interface ResaleCaseView {
  mode: "mock";
  surface: typeof SURFACES.resaleFsm;
  references: typeof RESALE_REFERENCES;
  provenance: typeof RESALE_PROVENANCE;
  lifecycleAuthority: "IN_MEMORY_FSM";
  listingId: string;
  phase: ResalePhase;
  terminal: boolean;
  /** True while the phase is still an open sale. Not a live order book. */
  pendingSale: boolean;
  rightId: string;
  showId: string;
  eventId: string;
  slot: string;
  sellerRole: string;
  recipientRole: string;
  buyerRole: string | null;
  holdId: string | null;
  expiresAt: string;
  expired: boolean;
  /** True when this open listing is the right's live listing. */
  attached: boolean;
  /** Version named by the listing. */
  version: number;
  versionAfter: number | null;
  /** Holder version on the mock right after any transfer in this process. */
  currentVersion: number;
  holderRole: string;
  generation: 1;
  paymentRef: string | null;
  settlementId: string | null;
  settlementGate: ResaleSettlementGate;
  /** True when the bound mock settlement view is FAILED. Not a bank return. */
  settlementFailure: boolean;
  mockSettlementCommitObserved: boolean;
  transferId: string | null;
  ownershipTransferred: boolean;
  priorPresentationValid: boolean;
  /** True when the listed holder and version no longer match. Not a venue reissue. */
  priorCredentialInvalidated: boolean;
  rightEligible: boolean;
  slotState: "ISSUED";
  slotRightId: string;
  economicFinalityClaimed: false;
  fundsExecuted: false;
  venueCredentialReissued: false;
  chainOwnerCurrent: false;
  compensationDefined: false;
  admissionRoutingProduction: false;
  externalMarketplace: "UNSUPPORTED";
  externalPayment: "UNSUPPORTED";
  logicalTimeMs: number;
  idempotencyKey: string;
  lastRejectCode: string | null;
  /**
   * Process-local journal replay flag.
   * Null until reconcile succeeds here. Not a marketplace match and not chain finality.
   */
  reconcileMatched: boolean | null;
  note: string;
}

export interface ResalePresentationView {
  mode: "mock";
  surface: typeof SURFACES.resaleFsm;
  references: typeof RESALE_REFERENCES;
  provenance: typeof RESALE_PROVENANCE;
  lifecycleAuthority: "IN_MEMORY_FSM";
  rightId: string;
  version: number;
  holderRole: string;
  matchesCurrentRight: boolean;
  currentVersion: number;
  currentHolderRole: string;
  venueCredentialReissued: false;
  admissionRoutingProduction: false;
  economicFinalityClaimed: false;
  fundsExecuted: false;
  externalMarketplace: "UNSUPPORTED";
  note: string;
}

/** Transfer note without fee splits. Amounts stay in kix-protocol. */
export interface ResaleTransferEvidence {
  rightId: string;
  fromRole: string;
  toRole: string;
  versionAfter: number;
  fundsExecuted: false;
  chainOwnerCurrent: false;
}

export type ResaleLifecycleCommand =
  | "set_clock"
  | "adopt_issued"
  | "list_resale"
  | "hold_buy"
  | "release_hold"
  | "cancel_listing"
  | "observe_resale_payment"
  | "bind_settlement"
  | "accept_resale"
  | "close"
  | "reconcile";

export interface ResaleCommandReceipt {
  duplicate: boolean;
  applied: ResaleLifecycleCommand | null;
  provenance: typeof RESALE_PROVENANCE;
  economicFinalityClaimed: false;
  fundsExecuted: false;
  venueCredentialReissued: false;
  externalMarketplace: "UNSUPPORTED";
  externalPayment: "UNSUPPORTED";
  idempotencyKey: string;
  logicalTimeMs: number;
  listing: ResaleCaseView | null;
  right: ResaleRightView | null;
  evidence: ResaleTransferEvidence | null;
}

export interface ResaleReconcileReceipt extends ResaleCommandReceipt {
  applied: "reconcile" | null;
  matched: true;
}

/**
 * Mock FSM phase names from kix-protocol credit_fsm.py.
 * F04 and E06 stay 설계중. These strings are not OpenAPI commands.
 */
export const CREDIT_PHASES = [
  "OFFERED",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "DRAWN",
  "CLOSED",
  "DEFAULTED",
] as const;

export type CreditPhase = (typeof CREDIT_PHASES)[number];

export const CREDIT_PROVENANCE = "MOCK_CREDIT_F04_ONLY" as const;

export const CREDIT_REFERENCES = ["F04"] as const;

export const CREDIT_SETTLEMENT_GATES = ["UNBOUND", "BOUND", "MOCK_COMMIT_OBSERVED"] as const;

export type CreditSettlementGate = (typeof CREDIT_SETTLEMENT_GATES)[number];

export const CREDIT_NOTE_STATUSES = ["NOTED", "RELEASED"] as const;

export type CreditNoteStatus = (typeof CREDIT_NOTE_STATUSES)[number];

const CREDIT_PHASE_SET: ReadonlySet<string> = new Set(CREDIT_PHASES);

export function isCreditPhase(value: unknown): value is CreditPhase {
  return typeof value === "string" && CREDIT_PHASE_SET.has(value);
}

export interface CreditOffer {
  advanceId: string;
  claimId: string;
  idempotencyKey: string;
  /** Mock open-face ceiling in integer units. Not a bank limit and not a currency posting. */
  openFace: number;
  /** Full mock draw amount. There is no partial draw on this desk. */
  amount: number;
  beneficiaryRole: string;
  /** A product label is refused. Null keeps the mock offer. */
  product?: string | null;
}

export interface CreditStep {
  advanceId: string;
  idempotencyKey: string;
}

export interface CreditReason extends CreditStep {
  reason: string;
}

export interface CreditBind extends CreditStep {
  settlementId: string;
}

export interface CreditDraw extends CreditStep {
  drawId: string;
}

export interface CreditRepay extends CreditStep {
  repayId: string;
  /** Next positive sequence. A gap is refused. */
  sequence: number;
  /** Mock exposure units. Not a bank receipt. */
  amount: number;
}

/**
 * Desk view of one in-process mock credit case.
 * Amounts are simulated exposure. Protocol truth stays in kix-protocol.
 */
export interface CreditCaseView {
  mode: "mock";
  surface: typeof SURFACES.creditFsm;
  references: typeof CREDIT_REFERENCES;
  provenance: typeof CREDIT_PROVENANCE;
  lifecycleAuthority: "IN_MEMORY_FSM";
  exposureLedger: "MOCK_EXPOSURE";
  advanceId: string;
  phase: CreditPhase;
  terminal: boolean;
  claimId: string;
  beneficiaryRole: string;
  /** Frozen offer ceiling for this case. Not a licensed limit. */
  openFace: number;
  /** Unreserved mock units on the shared claim ceiling. */
  availableCredit: number;
  /** Offer amount while the case has not drawn. Otherwise 0. */
  pendingDraw: number;
  offerAmount: number;
  /** Units still reserved on the claim. Partial repayment does not free them. */
  reservedOpen: number;
  noteStatus: CreditNoteStatus | null;
  drawId: string | null;
  drawnExposure: number;
  repaidExposure: number;
  outstandingExposure: number;
  repaymentCount: number;
  /** Next repay sequence while exposure remains. Otherwise null. */
  nextRepaymentSequence: number | null;
  settlementId: string | null;
  settlementGate: CreditSettlementGate;
  mockSettlementCommitObserved: boolean;
  /** True when the bound mock settlement view is FAILED. Not a bank return. */
  settlementFailure: boolean;
  rejectReason: string | null;
  cancelReason: string | null;
  defaultReason: string | null;
  idempotencyKey: string;
  lastRejectCode: string | null;
  /**
   * Process-local journal replay flag.
   * Null until reconcile succeeds here. Not a bank match and not chain finality.
   */
  reconcileMatched: boolean | null;
  economicFinalityClaimed: false;
  fundsExecuted: false;
  bankDebitObserved: false;
  repaymentObserved: false;
  interestDefined: false;
  underwritingExecuted: false;
  kycExecuted: false;
  ownershipMutated: false;
  ticketOwnershipAuthoritative: false;
  externalCredit: "UNSUPPORTED";
  note: string;
}

export type CreditLifecycleCommand =
  | "offer"
  | "approve"
  | "reject"
  | "cancel"
  | "bind_settlement"
  | "draw"
  | "repay"
  | "close"
  | "default"
  | "reconcile";

export interface CreditCommandReceipt {
  duplicate: boolean;
  applied: CreditLifecycleCommand | null;
  provenance: typeof CREDIT_PROVENANCE;
  lifecycleAuthority: "IN_MEMORY_FSM";
  externalCredit: "UNSUPPORTED";
  economicFinalityClaimed: false;
  fundsExecuted: false;
  bankDebitObserved: false;
  repaymentObserved: false;
  interestDefined: false;
  underwritingExecuted: false;
  kycExecuted: false;
  idempotencyKey: string;
  credit: CreditCaseView;
}

export interface CreditReconcileReceipt extends CreditCommandReceipt {
  applied: "reconcile" | null;
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
