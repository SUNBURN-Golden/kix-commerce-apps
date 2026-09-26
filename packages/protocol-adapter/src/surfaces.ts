/**
 * Names of kix-protocol surfaces this app consumes.
 * Definitions and Move/kernel behavior stay in BeautifulMind-JT/kix-protocol.
 * These ids are charter labels (Task 005), not a reimplementation.
 */
export const SURFACES = {
  rightsIssuance: "wave2.rights",
  zkGate: "wave2.zk_gate",
  settlementMock: "wave3.settlement.F01-F03",
  /**
   * Charter label for the desk's mock FSM case.
   * The authoritative machine remains kix-protocol
   * reference/settlement_f01_f03/settlement_fsm.py.
   * This id is not an OpenAPI operation.
   */
  settlementFsm: "wave3.settlement.F01-F03.fsm",
  booking: "wave4.booking.B01-B05",
  /**
   * Charter label for the desk's mock reservation case.
   * The authoritative machine remains kix-protocol
   * reference/booking_resale_admission/reservation_fsm.py.
   * This id is not an OpenAPI operation.
   */
  bookingFsm: "wave4.booking.B01-B05.fsm",
  resale: "wave4.resale.R01-R05",
  /**
   * Charter label for the desk's mock resale case.
   * The authoritative machine remains kix-protocol
   * reference/booking_resale_admission/resale_fsm.py.
   * This id is not an OpenAPI operation.
   */
  resaleFsm: "wave4.resale.R01-R05.fsm",
  admission: "wave4.admission.P03",
  /**
   * Charter label for the desk's mock admission phase.
   * Protocol truth for P03 stays in kix-protocol. This id is not an OpenAPI operation.
   */
  admissionFsm: "wave4.admission.P03.fsm",
  /**
   * Charter label for the desk's mock credit case.
   * The authoritative machine remains kix-protocol
   * reference/credit_advance_f04/credit_fsm.py.
   * This id is not an OpenAPI operation.
   */
  creditFsm: "wave5.credit.F04.fsm",
} as const;

export type SurfaceId = (typeof SURFACES)[keyof typeof SURFACES];

/**
 * F04 stays mock/sim in kix-protocol. This client still has no disburse action.
 * The desk case is a charter label. It does not lend and it does not post funds.
 */
export const CREDIT_BOUNDARY = {
  surface: "wave5.credit.F04",
  action: "none",
  note: "This desk renders a mock credit case and does not disburse to a bank. F04 and E06 stay 설계중. Protocol truth remains in kix-protocol.",
} as const;
