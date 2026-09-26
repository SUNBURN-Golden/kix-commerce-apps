import type { SurfaceId } from "./surfaces.js";
import type {
  AdapterMeta,
  AdmissionDecision,
  Booking,
  Hold,
  Performance,
  ResaleListing,
  ReservationAuthorize,
  ReservationBind,
  ReservationCaseView,
  ReservationClock,
  ReservationCommandReceipt,
  ReservationConfirm,
  ReservationConsume,
  ReservationHold,
  ReservationIssue,
  ReservationPayment,
  ReservationReconcileReceipt,
  ReservationShowRegister,
  ReservationShowView,
  ReservationStep,
  ResaleAccept,
  ResaleAdopt,
  ResaleBind,
  ResaleCancelListing,
  ResaleCaseView,
  ResaleClock,
  ResaleCommandReceipt,
  ResaleHoldBuy,
  ResaleList,
  ResalePayment,
  ResalePresentationQuery,
  ResalePresentationView,
  ResaleReconcileReceipt,
  ResaleReleaseHold,
  ResaleRightView,
  ResaleStep,
  SettlementCaseView,
  SettlementCommandReceipt,
  SettlementInitiate,
  SettlementPreview,
  SettlementReason,
  SettlementReconcileReceipt,
  SettlementStep,
  CreditBind,
  CreditCaseView,
  CreditCommandReceipt,
  CreditDraw,
  CreditOffer,
  CreditReason,
  CreditReconcileReceipt,
  CreditRepay,
  CreditStep,
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
  /**
   * Stub-local reservation case commands.
   * These names are not OpenAPI operations. HttpProtocolAdapter leaves them not-bound.
   * The authoritative FSM stays in kix-protocol. This app does not issue a live ticket
   * and does not scan a venue.
   */
  advanceReservationClock(input: ReservationClock): Promise<ReservationCommandReceipt>;
  registerReservationShow(input: ReservationShowRegister): Promise<ReservationCommandReceipt>;
  holdReservation(input: ReservationHold): Promise<ReservationCommandReceipt>;
  releaseReservation(input: ReservationStep): Promise<ReservationCommandReceipt>;
  confirmReservation(input: ReservationConfirm): Promise<ReservationCommandReceipt>;
  cancelReservation(input: ReservationStep): Promise<ReservationCommandReceipt>;
  observeReservationPayment(input: ReservationPayment): Promise<ReservationCommandReceipt>;
  bindReservationSettlement(input: ReservationBind): Promise<ReservationCommandReceipt>;
  issueReservation(input: ReservationIssue): Promise<ReservationCommandReceipt>;
  authorizeReservationAdmission(input: ReservationAuthorize): Promise<ReservationCommandReceipt>;
  consumeReservation(input: ReservationConsume): Promise<ReservationCommandReceipt>;
  reconcileReservation(input: ReservationStep): Promise<ReservationReconcileReceipt>;
  viewReservation(reservationId: string): Promise<ReservationCaseView>;
  viewReservationShow(showId: string): Promise<ReservationShowView>;
  rejectExternalReservation(kind: string): Promise<never>;
  /**
   * Stub-local resale case commands.
   * These names are not OpenAPI operations. HttpProtocolAdapter leaves them not-bound.
   * The authoritative FSM stays in kix-protocol. This app does not list a live
   * marketplace, move funds, or reissue a venue credential.
   */
  advanceResaleClock(input: ResaleClock): Promise<ResaleCommandReceipt>;
  adoptResaleIssued(input: ResaleAdopt): Promise<ResaleCommandReceipt>;
  listResaleCase(input: ResaleList): Promise<ResaleCommandReceipt>;
  holdResaleBuy(input: ResaleHoldBuy): Promise<ResaleCommandReceipt>;
  releaseResaleHold(input: ResaleReleaseHold): Promise<ResaleCommandReceipt>;
  cancelResaleListing(input: ResaleCancelListing): Promise<ResaleCommandReceipt>;
  observeResalePayment(input: ResalePayment): Promise<ResaleCommandReceipt>;
  bindResaleSettlement(input: ResaleBind): Promise<ResaleCommandReceipt>;
  acceptResaleTransfer(input: ResaleAccept): Promise<ResaleCommandReceipt>;
  closeResaleListing(input: ResaleStep): Promise<ResaleCommandReceipt>;
  reconcileResale(input: ResaleStep): Promise<ResaleReconcileReceipt>;
  viewResaleCase(listingId: string): Promise<ResaleCaseView>;
  viewResaleRight(rightId: string): Promise<ResaleRightView>;
  viewResalePresentation(input: ResalePresentationQuery): Promise<ResalePresentationView>;
  rejectExternalResale(kind: string): Promise<never>;
  /**
   * Stub-local credit case commands.
   * These names are not OpenAPI operations. HttpProtocolAdapter leaves them not-bound.
   * The authoritative FSM stays in kix-protocol. This app does not disburse to a bank,
   * underwrite, or mutate booking or resale ownership.
   */
  offerCredit(input: CreditOffer): Promise<CreditCommandReceipt>;
  approveCredit(input: CreditStep): Promise<CreditCommandReceipt>;
  rejectCredit(input: CreditReason): Promise<CreditCommandReceipt>;
  cancelCredit(input: CreditReason): Promise<CreditCommandReceipt>;
  bindCreditSettlement(input: CreditBind): Promise<CreditCommandReceipt>;
  drawCredit(input: CreditDraw): Promise<CreditCommandReceipt>;
  repayCredit(input: CreditRepay): Promise<CreditCommandReceipt>;
  closeCredit(input: CreditStep): Promise<CreditCommandReceipt>;
  defaultCredit(input: CreditReason): Promise<CreditCommandReceipt>;
  reconcileCredit(input: CreditStep): Promise<CreditReconcileReceipt>;
  viewCredit(advanceId: string): Promise<CreditCaseView>;
  rejectUnsupportedCredit(kind: string): Promise<never>;
}

export const CONSUMED_SURFACES: SurfaceId[] = [
  "wave2.rights",
  "wave2.zk_gate",
  "wave3.settlement.F01-F03",
  "wave3.settlement.F01-F03.fsm",
  "wave4.booking.B01-B05",
  "wave4.booking.B01-B05.fsm",
  "wave4.resale.R01-R05",
  "wave4.resale.R01-R05.fsm",
  "wave4.admission.P03",
  "wave4.admission.P03.fsm",
  "wave5.credit.F04.fsm",
];
