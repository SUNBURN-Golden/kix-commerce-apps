/**
 * Recorded alignment of the M01–M05 stub with the vendored contract-only catalogue.
 * Field names only. No values, no policy, and no amounts.
 * This module does not import the protocol adapter and does not read the OpenAPI pin.
 * Tests compare these names with the pin. The stub does not build a command body.
 */

export const MARKETING_CONTRACT_IDS = ["M01", "M02", "M03", "M04", "M05"] as const;

export type MarketingContractId = (typeof MARKETING_CONTRACT_IDS)[number];

const SET_CONSENT_FIELDS = [
  "allowed",
  "business",
  "channel",
  "domain",
  "eventId",
  "expectedConsentVersion",
  "purpose",
] as const;

const AUTHORIZE_MARKETING_FIELDS = [
  "business",
  "channel",
  "domain",
  "eventId",
  "expectedConsentVersion",
  "purpose",
  "subject",
] as const;

export const MARKETING_CONTRACT_ALIGNMENT = {
  M01: {
    published: null,
    state: "no-published-command",
    pendingContract: "wave7-marketing-contracts",
  },
  M02: {
    published: null,
    state: "no-published-command",
    pendingContract: "wave7-marketing-contracts",
    displayRead: "listPerformances",
  },
  M03: {
    published: null,
    state: "no-published-command",
    pendingContract: "wave7-marketing-contracts",
  },
  M04: {
    published: null,
    state: "no-published-command",
    pendingContract: "wave7-marketing-contracts",
  },
  M05: {
    published: ["set_consent", "authorize_marketing"],
    state: "published-bound",
    stubFieldsNotTheBody: ["performanceNotes", "membershipNotes"],
    missingFromStub: [...SET_CONSENT_FIELDS, "subject"],
    commandFields: {
      set_consent: {
        properties: SET_CONSENT_FIELDS,
        required: SET_CONSENT_FIELDS,
      },
      authorize_marketing: {
        properties: AUTHORIZE_MARKETING_FIELDS,
        required: AUTHORIZE_MARKETING_FIELDS,
      },
    },
  },
} as const;

/**
 * Desk methods and catalogue writes this stub must not call.
 * `listPerformances` is omitted: M02 may use it as a display read.
 * `set_consent` and `authorize_marketing` are omitted here because the pages
 * print those names. This module still does not build those bodies.
 * The two catalogue names the web tree must not spell are asserted from the test.
 */
export const MARKETING_FORBIDDEN_CALLS = [
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
  "capture",
  "prepare_trade",
  "reserve_listing",
  "commit_trade",
  "open_admission",
  "admit",
] as const;

/** Screen copy for one surface. Prints names. It does not print a command body. */
export function marketingPublishedLine(id: MarketingContractId): string {
  const row = MARKETING_CONTRACT_ALIGNMENT[id];
  if (row.state === "no-published-command") {
    const read =
      "displayRead" in row
        ? ` The display read is ${row.displayRead}. That name is not a catalogue command.`
        : "";
    return `Published contract: none. Recorded state: no published command. Pending contract: ${row.pendingContract}.${read}`;
  }
  const fields = row.missingFromStub.join(", ");
  const stubFields = row.stubFieldsNotTheBody.join(", ");
  return `Published contract: ${row.published.join(", ")}. Recorded state: published-bound. Stub fields ${stubFields} are not the set_consent body. Missing field names: ${fields}.`;
}
