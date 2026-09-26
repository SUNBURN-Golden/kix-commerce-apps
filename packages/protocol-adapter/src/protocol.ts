import type { SurfaceId } from "./surfaces.js";
import type {
  AdapterMeta,
  AdmissionDecision,
  Booking,
  Hold,
  Performance,
  ResaleListing,
  SettlementCaseView,
  SettlementCommandReceipt,
  SettlementInitiate,
  SettlementPreview,
  SettlementReason,
  SettlementReconcileReceipt,
  SettlementStep,
} from "./types.js";

/**
 * App-facing seam for Wave 2–4 commerce surfaces.
 * Implementations must not embed Move, settlement math, or credit disbursement.
 * HttpProtocolAdapter leaves these methods not-bound when the published
 * command body is not the same shape. The stub still serves the desk.
 */
export interface CommerceProtocol {
  describe(): AdapterMeta;
  listPerformances(): Promise<Performance[]>;
  placeHold(input: { eventId: string; quantity: number }): Promise<Hold>;
  releaseHold(holdId: string): Promise<void>;
  confirmBooking(holdId: string): Promise<Booking>;
  getBooking(bookingId: string): Promise<Booking | null>;
  checkAdmission(input: { rightsRef: string; gateId: string }): Promise<AdmissionDecision>;
  listResale(eventId?: string): Promise<ResaleListing[]>;
  openResale(input: { bookingId: string; askLabel: string }): Promise<ResaleListing>;
  acceptResale(listingId: string): Promise<{ listing: ResaleListing; booking: Booking }>;
  settlementPreview(eventId: string): Promise<SettlementPreview>;
  /**
   * Stub-local settlement case commands.
   * These names are not OpenAPI operations. HttpProtocolAdapter leaves them not-bound.
   * The authoritative FSM stays in kix-protocol. This app does not post money.
   */
  initiateSettlement(input: SettlementInitiate): Promise<SettlementCommandReceipt>;
  authorizeSettlement(input: SettlementStep): Promise<SettlementCommandReceipt>;
  captureSettlement(input: SettlementStep): Promise<SettlementCommandReceipt>;
  commitSettlement(input: SettlementStep): Promise<SettlementCommandReceipt>;
  failSettlement(input: SettlementReason): Promise<SettlementCommandReceipt>;
  cancelSettlement(input: SettlementReason): Promise<SettlementCommandReceipt>;
  reconcileSettlement(input: SettlementStep): Promise<SettlementReconcileReceipt>;
  viewSettlement(settlementId: string): Promise<SettlementCaseView>;
  rejectExternalSettlement(kind: string): Promise<never>;
}

export const CONSUMED_SURFACES: SurfaceId[] = [
  "wave2.rights",
  "wave2.zk_gate",
  "wave3.settlement.F01-F03",
  "wave3.settlement.F01-F03.fsm",
  "wave4.booking.B01-B05",
  "wave4.resale.R01-R05",
  "wave4.admission.P03",
];
