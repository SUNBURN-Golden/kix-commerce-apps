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
  admission: "wave4.admission.P03",
  /**
   * Charter label for the desk's mock admission phase.
   * Protocol truth for P03 stays in kix-protocol. This id is not an OpenAPI operation.
   */
  admissionFsm: "wave4.admission.P03.fsm",
} as const;

export type SurfaceId = (typeof SURFACES)[keyof typeof SURFACES];

/**
 * Wave 5 F04 is mock/sim in kix-protocol. Wave 6 exposes no disburse action.
 */
export const CREDIT_BOUNDARY = {
  surface: "wave5.credit.F04",
  action: "none",
  note: "Wave 6 does not disburse credit. F04 stays mock/sim in kix-protocol until a separate ruling.",
} as const;
