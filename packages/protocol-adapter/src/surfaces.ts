/**
 * Names of kix-protocol surfaces this app consumes.
 * Definitions and Move/kernel behavior stay in BeautifulMind-JT/kix-protocol.
 * These ids are charter labels (Task 005), not a reimplementation.
 */
export const SURFACES = {
  rightsIssuance: "wave2.rights",
  zkGate: "wave2.zk_gate",
  settlementMock: "wave3.settlement.F01-F03",
  booking: "wave4.booking.B01-B05",
  resale: "wave4.resale.R01-R05",
  admission: "wave4.admission.P03",
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

/**
 * Provisional HTTP paths used only by HttpProtocolAdapter.
 * They are an app-side binding placeholder. Replace this table when the
 * kix-protocol OpenAPI on main is confirmed. They are not the protocol spec.
 */
export const PROVISIONAL_HTTP_PATHS = {
  listPerformances: "/v1/commerce/performances",
  placeHold: "/v1/commerce/holds",
  releaseHold: "/v1/commerce/holds",
  confirmBooking: "/v1/commerce/bookings",
  getBooking: "/v1/commerce/bookings",
  checkAdmission: "/v1/commerce/admission/checks",
  listResale: "/v1/commerce/resale/listings",
  openResale: "/v1/commerce/resale/listings",
  acceptResale: "/v1/commerce/resale/listings",
  settlementPreview: "/v1/commerce/settlement-preview",
} as const;
