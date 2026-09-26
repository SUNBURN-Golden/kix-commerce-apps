import { type PinnedAction } from "./openapi-contract-pin.js";

/**
 * Desk methods compared with the published command set.
 * status is not-bound when the method's arguments are not the command body.
 * consideredAction records the nearest catalogue name and is not a request.
 * HTTP mode may post that catalogue command through invokeLocalCall when the
 * caller supplies the published body. It does not map a desk method onto a different body.
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
  "initiateSettlement",
  "authorizeSettlement",
  "captureSettlement",
  "commitSettlement",
  "failSettlement",
  "cancelSettlement",
  "reconcileSettlement",
  "viewSettlement",
  "rejectExternalSettlement",
  "advanceReservationClock",
  "registerReservationShow",
  "holdReservation",
  "releaseReservation",
  "confirmReservation",
  "cancelReservation",
  "observeReservationPayment",
  "bindReservationSettlement",
  "issueReservation",
  "authorizeReservationAdmission",
  "consumeReservation",
  "reconcileReservation",
  "viewReservation",
  "viewReservationShow",
  "rejectExternalReservation",
  "advanceAdmissionClock",
  "adoptAdmissionIssued",
  "authorizeAdmissionCredential",
  "consumeAdmissionCredential",
  "reconcileAdmission",
  "rejectExternalAdmission",
  "presentAdmission",
  "advanceResaleClock",
  "adoptResaleIssued",
  "listResaleCase",
  "holdResaleBuy",
  "releaseResaleHold",
  "cancelResaleListing",
  "observeResalePayment",
  "bindResaleSettlement",
  "acceptResaleTransfer",
  "closeResaleListing",
  "reconcileResale",
  "viewResaleCase",
  "viewResaleRight",
  "viewResalePresentation",
  "rejectExternalResale",
  "offerCredit",
  "approveCredit",
  "rejectCredit",
  "cancelCredit",
  "bindCreditSettlement",
  "drawCredit",
  "repayCredit",
  "closeCredit",
  "defaultCredit",
  "reconcileCredit",
  "viewCredit",
  "rejectUnsupportedCredit",
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
  initiateSettlement: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "initiateSettlement is a stub-local FSM command. It is not an OpenAPI catalogue command. The HTTP adapter does not invent a binding.",
  },
  authorizeSettlement: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "authorizeSettlement is a stub-local FSM command. It is not an OpenAPI catalogue command. The HTTP adapter does not invent a binding.",
  },
  captureSettlement: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "captureSettlement marks a mock FSM phase on the stub. It is not the catalogue command capture. The HTTP adapter does not send capture.",
  },
  commitSettlement: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "commitSettlement marks a mock FSM phase on the stub. It is not commit_trade. settle_capture remains a monetary posting, so the desk must not send it.",
  },
  failSettlement: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "failSettlement is a stub-local FSM command. It is not an OpenAPI catalogue command. The HTTP adapter does not invent a binding.",
  },
  cancelSettlement: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "cancelSettlement is a stub-local FSM command. It is not cancel_event or any other catalogue command. The HTTP adapter does not invent a binding.",
  },
  reconcileSettlement: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "reconcileSettlement is a process-local stub check. It is not an OpenAPI catalogue command. The HTTP adapter does not invent a binding.",
  },
  viewSettlement: {
    status: "not-bound",
    consideredAction: null,
    reason: "viewSettlement reads the stub case. The contract-only catalogue has no read command for an FSM settlement id.",
  },
  rejectExternalSettlement: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "rejectExternalSettlement is an in-memory FSM refusal. The HTTP adapter does not bind it and does not send a catalogue command.",
  },
  advanceReservationClock: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "advanceReservationClock is a stub-local FSM clock. It is not the catalogue command advance_clock. The HTTP adapter does not invent a binding.",
  },
  registerReservationShow: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "registerReservationShow is a stub-local FSM command. It is not an OpenAPI catalogue command. The HTTP adapter does not invent a binding.",
  },
  holdReservation: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "holdReservation is a stub-local FSM command. It is not reserve_listing. The HTTP adapter does not map it onto a catalogue action.",
  },
  releaseReservation: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "releaseReservation is a stub-local FSM command. It is not release_inventory. The HTTP adapter does not map it onto a catalogue action.",
  },
  confirmReservation: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "confirmReservation is a stub-local FSM command. It is not capture. The HTTP adapter does not send capture.",
  },
  cancelReservation: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "cancelReservation is a stub-local FSM command. It is not cancel_event or any other catalogue command. The HTTP adapter does not invent a binding.",
  },
  observeReservationPayment: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "observeReservationPayment records a mock payment note. It is not observe_funding. The HTTP adapter does not send a catalogue command.",
  },
  bindReservationSettlement: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "bindReservationSettlement is a stub-local FSM command. It is not settle_capture. The HTTP adapter does not send settle_capture.",
  },
  issueReservation: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "issueReservation is a stub-local FSM command. It is not a catalogue issuance. The HTTP adapter does not send capture or settle_capture.",
  },
  authorizeReservationAdmission: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "authorizeReservationAdmission is a stub-local FSM command. It is not admit and it is not a venue scan endpoint. The HTTP adapter does not invent a binding.",
  },
  consumeReservation: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "consumeReservation is a stub-local FSM command. It is not admit and it does not scan a venue. The HTTP adapter does not invent a binding.",
  },
  reconcileReservation: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "reconcileReservation is a process-local stub check. It is not an OpenAPI catalogue command. The HTTP adapter does not invent a binding.",
  },
  viewReservation: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "viewReservation reads the stub case. The contract-only catalogue has no read command for an FSM reservation id.",
  },
  viewReservationShow: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "viewReservationShow reads the stub show. The contract-only catalogue has no read command for an FSM show id.",
  },
  rejectExternalReservation: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "rejectExternalReservation is an in-memory FSM refusal. The HTTP adapter does not bind it and does not send a catalogue command.",
  },
  advanceAdmissionClock: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "advanceAdmissionClock moves the stub credential clock. It is not advance_clock. The HTTP adapter does not send a catalogue command.",
  },
  adoptAdmissionIssued: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "adoptAdmissionIssued reads the stub reservation case. It is not a catalogue issuance and it does not post admit.",
  },
  authorizeAdmissionCredential: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "authorizeAdmissionCredential is a stub-local freshness check. It is not admit and it is not a venue scan. The HTTP adapter does not invent a binding.",
  },
  consumeAdmissionCredential: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "consumeAdmissionCredential is a stub-local one-time consume after authorize. It is not admit and it does not scan a venue. The HTTP adapter does not invent a binding.",
  },
  reconcileAdmission: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "reconcileAdmission is a process-local stub check. It is not an OpenAPI catalogue command. The HTTP adapter does not invent a binding.",
  },
  rejectExternalAdmission: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "rejectExternalAdmission refuses a venue scanner, offline admit, or public bind. The HTTP adapter does not send a catalogue command.",
  },
  presentAdmission: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "presentAdmission reads stub credential freshness, or the loopback health probe in HTTP mode. It does not post admit and it does not scan a venue.",
  },
  advanceResaleClock: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "advanceResaleClock is a stub-local FSM clock. It is not an OpenAPI catalogue command. The HTTP adapter does not invent a marketplace endpoint.",
  },
  adoptResaleIssued: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "adoptResaleIssued is a stub-local FSM command. It is not an OpenAPI catalogue command. The HTTP adapter does not invent a marketplace endpoint.",
  },
  listResaleCase: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "listResaleCase is a stub-local FSM command. It is not create_listing. The HTTP adapter does not invent a marketplace endpoint.",
  },
  holdResaleBuy: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "holdResaleBuy is a stub-local FSM command. It is not reserve_listing. The HTTP adapter does not invent a marketplace endpoint.",
  },
  releaseResaleHold: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "releaseResaleHold is a stub-local FSM command. It is not release_inventory. The HTTP adapter does not invent a marketplace endpoint.",
  },
  cancelResaleListing: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "cancelResaleListing is a stub-local FSM command. It is not an OpenAPI catalogue command. The HTTP adapter does not invent a marketplace endpoint.",
  },
  observeResalePayment: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "observeResalePayment records a mock payment note. It is not observe_funding. The HTTP adapter does not send a catalogue command.",
  },
  bindResaleSettlement: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "bindResaleSettlement is a stub-local FSM command. It is not settle_capture. The HTTP adapter does not send settle_capture.",
  },
  acceptResaleTransfer: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "acceptResaleTransfer is a stub-local FSM command. It is not accept_trade. The HTTP adapter does not invent a marketplace endpoint.",
  },
  closeResaleListing: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "closeResaleListing is a stub-local FSM command. It is not an OpenAPI catalogue command. The HTTP adapter does not invent a marketplace endpoint.",
  },
  reconcileResale: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "reconcileResale is a process-local stub check. It is not an OpenAPI catalogue command. The HTTP adapter does not invent a marketplace endpoint.",
  },
  viewResaleCase: {
    status: "not-bound",
    consideredAction: null,
    reason: "viewResaleCase reads the stub case. The contract-only catalogue has no read command for an FSM listing id.",
  },
  viewResaleRight: {
    status: "not-bound",
    consideredAction: null,
    reason: "viewResaleRight reads the stub right. The contract-only catalogue has no read command for an FSM right id.",
  },
  viewResalePresentation: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "viewResalePresentation reads a stub holder check. It is not a venue scan and not a catalogue command.",
  },
  rejectExternalResale: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "rejectExternalResale is an in-memory FSM refusal. The HTTP adapter does not bind it and does not send a catalogue command.",
  },
  offerCredit: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "offerCredit is a stub-local FSM command. It is not offer_gift and it is not an OpenAPI catalogue command. The HTTP adapter does not invent a lending endpoint.",
  },
  approveCredit: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "approveCredit is a stub-local FSM command. It is not an underwriting result and not an OpenAPI catalogue command. The HTTP adapter does not invent a lending endpoint.",
  },
  rejectCredit: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "rejectCredit is a stub-local FSM command. It is not an OpenAPI catalogue command. The HTTP adapter does not invent a lending endpoint.",
  },
  cancelCredit: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "cancelCredit is a stub-local FSM command. It is not cancel_event. The HTTP adapter does not invent a lending endpoint.",
  },
  bindCreditSettlement: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "bindCreditSettlement is a stub-local FSM command. It is not settle_capture. The HTTP adapter does not send settle_capture.",
  },
  drawCredit: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "drawCredit records mock exposure on the stub. It is not a disbursement and not an OpenAPI catalogue command. The HTTP adapter does not invent a lending endpoint.",
  },
  repayCredit: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "repayCredit records a mock exposure note on the stub. It is not a bank receipt and not an OpenAPI catalogue command. The HTTP adapter does not invent a lending endpoint.",
  },
  closeCredit: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "closeCredit is a stub-local FSM command. It is not an OpenAPI catalogue command. The HTTP adapter does not invent a lending endpoint.",
  },
  defaultCredit: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "defaultCredit is a stub-local FSM command. It is not a foreclosure and not an OpenAPI catalogue command. The HTTP adapter does not invent a lending endpoint.",
  },
  reconcileCredit: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "reconcileCredit is a process-local stub check. It is not an OpenAPI catalogue command. The HTTP adapter does not invent a lending endpoint.",
  },
  viewCredit: {
    status: "not-bound",
    consideredAction: null,
    reason: "viewCredit reads the stub case. The contract-only catalogue has no read command for an FSM advance id.",
  },
  rejectUnsupportedCredit: {
    status: "not-bound",
    consideredAction: null,
    reason:
      "rejectUnsupportedCredit is an in-memory FSM refusal. The HTTP adapter does not bind it and does not send a catalogue command.",
  },
} as const satisfies Record<CommerceMethod, CommerceBinding>;
