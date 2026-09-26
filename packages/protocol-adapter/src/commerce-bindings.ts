import { type PinnedAction } from "./openapi-contract-pin.js";

/**
 * Desk methods compared with the published command set.
 * status is not-bound when the method's arguments are not the command body.
 * consideredAction records the nearest catalogue name and is not a request.
 */
export const COMMERCE_METHODS = [
  "listPerformances",
  "placeHold",
  "releaseHold",
  "confirmBooking",
  "getBooking",
  "checkAdmission",
  "listResale",
  "openResale",
  "acceptResale",
  "settlementPreview",
] as const;

export type CommerceMethod = (typeof COMMERCE_METHODS)[number];

export interface CommerceBinding {
  readonly status: "not-bound";
  readonly consideredAction: PinnedAction | null;
  readonly reason: string;
}

export const COMMERCE_COMMAND_BINDINGS = {
  listPerformances: {
    status: "not-bound",
    consideredAction: null,
    reason: "The contract-only catalogue has no list or read command. listPerformances stays on the stub.",
  },
  placeHold: {
    status: "not-bound",
    consideredAction: "reserve_listing",
    reason:
      "placeHold({ eventId, quantity }) does not match reserve_listing, which requires domain, expiresAt, listingHash, listingId, and tradeId.",
  },
  releaseHold: {
    status: "not-bound",
    consideredAction: "release_inventory",
    reason:
      "releaseHold(holdId) does not match release_inventory, which requires closedRightId, domain, expectedInventoryVersion, and inventoryId.",
  },
  confirmBooking: {
    status: "not-bound",
    consideredAction: "capture",
    reason:
      "confirmBooking(holdId) does not match capture. capture carries amount, currency, and paymentId. The desk keeps simulated-no-funds bookings on the stub and does not send capture.",
  },
  getBooking: {
    status: "not-bound",
    consideredAction: null,
    reason: "The contract-only catalogue has no read command for a booking id.",
  },
  checkAdmission: {
    status: "not-bound",
    consideredAction: "admit",
    reason:
      "checkAdmission({ rightsRef, gateId }) does not match admit, which requires admissionEpoch, domain, expectedVersion, holder, and ticketId.",
  },
  listResale: {
    status: "not-bound",
    consideredAction: null,
    reason: "The contract-only catalogue has no list command for resale listings.",
  },
  openResale: {
    status: "not-bound",
    consideredAction: "create_listing",
    reason:
      "openResale({ bookingId, askLabel }) does not match create_listing. askLabel is display text. create_listing requires amount, domain, expectedVersion, expiresAt, listingId, and ticketId.",
  },
  acceptResale: {
    status: "not-bound",
    consideredAction: "accept_trade",
    reason: "acceptResale(listingId) does not match accept_trade, which requires domain, termsHash, and tradeId.",
  },
  settlementPreview: {
    status: "not-bound",
    consideredAction: "settle_capture",
    reason:
      "settlementPreview stays a mock F01–F03 pointer. settle_capture is a monetary posting, so the desk does not send it.",
  },
} as const satisfies Record<CommerceMethod, CommerceBinding>;
