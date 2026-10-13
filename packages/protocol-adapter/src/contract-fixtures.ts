import {
  COMMERCE_COMMAND_BINDINGS,
  COMMERCE_METHODS,
  type CommerceMethod,
} from "./commerce-bindings.js";
import { OPENAPI_INTEGRATION_GATE_PIN } from "./integration-gate-pin.js";
import {
  OPENAPI_CONTRACT_PIN,
  PINNED_ACTIONS,
  PINNED_PROTOCOL_DOMAIN,
  isPinnedAction,
} from "./openapi-contract-pin.js";
import { ProtocolError } from "./types.js";

/**
 * Versioned fixture catalogue for the current pin tuple.
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 *
 * Adapter tests and UI tests import this module. A recorded pass names one
 * case on this tuple. It does not verify a different case or a different tuple.
 * A failed live call is not replaced with a stub success. Result key names are
 * copied. This module does not compute finance or rights, does not send, and
 * does not retry.
 *
 * No SDK, manifest, or vector is consumed. Those digests stay null until a
 * producer change moves both OpenAPI pins, PINNED_ACTIONS, the CI gate SHA,
 * and protocolMergeSha together with that SDK tuple.
 */

export const FIXTURE_CATALOGUE_VERSION = "1" as const;

export const FIXTURE_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const FIXTURE_CLASSES = ["SUCCESS", "REJECT", "UNKNOWN", "NOT_BOUND", "STALE"] as const;

export type FixtureClass = (typeof FIXTURE_CLASSES)[number];

export const FIXTURE_SOURCES = ["stub-shape", "integration-gate", "mock-case", "none", "synthetic-fixture"] as const;

export type FixtureSource = (typeof FIXTURE_SOURCES)[number];

export const FIXTURE_SCREEN_STATUSES = ["confirmed", "rejected", "unknown", "not-bound", "stale"] as const;

export type FixtureScreenStatus = (typeof FIXTURE_SCREEN_STATUSES)[number];

export const CLASSIFY_REFUSALS = [
  "INVALID",
  "NEW_ENUM",
  "MISSING_FIELD",
  "DIFFERENT_IDENTITY",
  "DIFFERENT_TUPLE",
  "STUB_SUBSTITUTE",
  "GENERATOR_BOUNDARY",
] as const;

export type ClassifyRefusal = (typeof CLASSIFY_REFUSALS)[number];

/** Actions this catalogue must not record as SUCCESS. open_admission stays off this list because OrganizerConsole posts it. */
export const FIXTURE_NEVER_SUCCESS_ACTIONS = [
  "capture",
  "settle_capture",
  "commit_trade",
  "admit",
  "refund_ticket",
] as const;

/**
 * Copy of PINNED_ACTIONS for catalogue version 1.
 * assertCatalogueBound refuses the catalogue when the live list differs.
 */
export const FIXTURE_PINNED_ACTIONS_LITERAL = [
  "abort_effect",
  "abort_trade",
  "accept_gift",
  "accept_trade",
  "adjust_pg_cancel",
  "admit",
  "advance_clock",
  "authorize_marketing",
  "cancel_event",
  "cancel_gift",
  "cancel_listing",
  "capture",
  "claim_effect",
  "close_delegation",
  "close_sales",
  "commit_trade",
  "complete_event",
  "create_event",
  "create_listing",
  "delegate",
  "dispatch_effect",
  "expire_trade",
  "finalize_effect",
  "issue_invitation",
  "observe_dispatch_lookup",
  "observe_effect",
  "observe_funding",
  "observe_recovery",
  "observe_return",
  "offer_gift",
  "open_admission",
  "prepare_effect",
  "prepare_trade",
  "refund_ticket",
  "release_inventory",
  "reserve_listing",
  "send_effect",
  "set_consent",
  "settle_capture",
  "void_unissued",
] as const;

export interface FixtureTupleParts {
  catalogueVersion: string;
  contractOpenApiSha256: string;
  contractInfoVersion: string;
  contractMainSha: string;
  gateOpenApiSha256: string;
  protocolMergeSha: string;
  protocolFeatureSha: string;
  sourceProtocolContractSha256: string;
  domain: string;
  pinnedActions: readonly string[];
  sdkDigest: null;
  manifestDigest: null;
  vectorDigest: null;
}

export const FIXTURE_TUPLE_LITERALS: FixtureTupleParts = {
  catalogueVersion: FIXTURE_CATALOGUE_VERSION,
  contractOpenApiSha256: "fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e",
  contractInfoVersion: "0.3-rc1+sha256:ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e",
  contractMainSha: "a744b0a036d7e1edb48416871af20cd182f23df4",
  gateOpenApiSha256: "2a2af554cb1a8b128f2cf1b1d5b8cf6b1c8fa90adf30865dbc3e64932b3bd13f",
  protocolMergeSha: "52a9b5cbf7777df55d2d2062cb8d99d862b423bb",
  protocolFeatureSha: "c7238bc24a399a6cabbab87ac23dbfd7e9c252dd",
  sourceProtocolContractSha256: "ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e",
  domain: "kix:fixture:lifecycle:0.3",
  pinnedActions: FIXTURE_PINNED_ACTIONS_LITERAL,
  sdkDigest: null,
  manifestDigest: null,
  vectorDigest: null,
};

export interface FixtureIdentity {
  operationId: string;
  actor: string;
  action: string;
}

export interface ContractFixture {
  id: string;
  catalogueVersion: typeof FIXTURE_CATALOGUE_VERSION;
  tupleKey: string;
  screenId: string;
  klass: FixtureClass;
  screenStatus: FixtureScreenStatus;
  source: FixtureSource;
  /** True only for a SUCCESS case that this screen owns. A display of another screen's receipt is not a second pass. */
  ownsPass: boolean;
  liveFailure: boolean;
  substituteStub: false;
  computesFinance: false;
  computesRights: false;
  identity: FixtureIdentity | null;
  method: CommerceMethod | null;
  consideredAction: string | null;
  mappedOntoPrepareTrade: false;
  code: string | null;
  resultKeys: readonly string[];
  observation: string;
}

export interface FixtureScreenRow {
  readonly screenId: string;
  readonly route: string;
  readonly note: string;
}

export interface FixtureObservation {
  tupleKey: string;
  klass: string;
  operationId?: string;
  actor?: string;
  action?: string;
  method?: string;
  code?: string;
  presentFields: readonly string[];
  /** True when the call returned a receipt. A failed live call stays false. */
  callSucceeded: boolean;
  substituteStub: boolean;
  compute: "none" | "finance" | "rights";
}

export type ClassifyResult =
  | { ok: true; klass: FixtureClass; confirmed: boolean; fallbackToStub: false; retry: false }
  | { ok: false; reason: ClassifyRefusal; field?: string };

export interface FixtureProjection {
  klass: FixtureClass;
  screenStatus: FixtureScreenStatus;
  confirmed: boolean;
  fallbackToStub: false;
  retry: false;
  readConfirmsUnknown: false;
  substituteStub: false;
  tupleMatches: boolean;
}

export interface GeneratedFixture {
  fixtureId: string;
  resultKeys: readonly string[];
  amounts: null;
  rights: null;
  financialEntries: null;
  shares: null;
  fallbackToStub: false;
  retry: false;
  observation: string;
}

export interface FailedLiveClass {
  klass: "REJECT" | "UNKNOWN" | "STALE";
  code: string;
  substituteStub: false;
  confirmed: false;
  fallbackToStub: false;
  retry: false;
}

const STALE_CODES: ReadonlySet<string> = new Set([
  "STALE_RESPONSE",
  "STALE_VERSION",
  "CREDENTIAL_STALE",
  "STALE_OR_WRONG_PRESENTATION",
]);

/**
 * Unconfirmed transport and receipt outcomes. STALE_RESPONSE is not in this set.
 * A code with the letters STALE that is not in STALE_CODES stays a REJECT.
 */
const UNKNOWN_CODES: ReadonlySet<string> = new Set([
  "GATE_UNAVAILABLE",
  "GATE_TRANSPORT",
  "GATE_STATUS",
  "REQUEST_TIMEOUT",
  "INTERNAL_ERROR",
  "DURABILITY_DIVERGENCE",
  "NOT_READY",
  "OVERLOADED",
  "CORE_BUSY",
  "JOURNAL_BUDGET",
  "PRODUCTION_ENDPOINT",
  "PRODUCTION_ENVIRONMENT",
  "HEADER_TOO_LARGE",
  "BODY_TOO_LARGE",
  "RETRY_FORBIDDEN",
  "UNKNOWN",
  "INVALID_RECEIPT",
]);

const SCALAR_TUPLE_FIELDS = [
  "catalogueVersion",
  "contractOpenApiSha256",
  "contractInfoVersion",
  "contractMainSha",
  "gateOpenApiSha256",
  "protocolMergeSha",
  "protocolFeatureSha",
  "sourceProtocolContractSha256",
  "domain",
] as const;

export const FIXTURE_SCREENS = [
  {
    screenId: "box-office-catalog",
    route: "/",
    note: "listPerformances stays not-bound. The catalogue has no list command.",
  },
  {
    screenId: "box-office-journey-view",
    route: "/",
    note: "This route does not send. An unknown outcome stays unknown. This screen does not own a success pass.",
  },
  {
    screenId: "box-office-settlement",
    route: "/",
    note: "Mock settlement commands stay not-bound. Shares are not computed.",
  },
  {
    screenId: "booking-journey",
    route: "/booking/:eventId",
    note: "create_event, prepare_trade, and accept_trade each have their own case. placeHold stays not-bound.",
  },
  {
    screenId: "reservation-case",
    route: "/booking/:eventId",
    note: "Mock reservation commands stay not-bound. They are not catalogue receipts.",
  },
  {
    screenId: "admission-credential",
    route: "/admission",
    note: "A stale credential label is adapter-assigned. presentAdmission does not post admit.",
  },
  {
    screenId: "resale-desk",
    route: "/resale",
    note: "A mock stale version is not economic finality. Desk methods stay not-bound.",
  },
  {
    screenId: "gift-transfer",
    route: "/gift",
    note: "offer_gift cases. financialEntries is not filled here.",
  },
  {
    screenId: "credit-desk",
    route: "/credit",
    note: "No credit command. drawCredit is not a disbursement.",
  },
  {
    screenId: "organizer-console",
    route: "/organizer",
    note: "create_event cases. capture and settle_capture are not sent.",
  },
  {
    screenId: "operator-transport",
    route: "/",
    note: "A transport failure stays on the selected adapter. A stale response is not a success.",
  },
  {
    screenId: "operator-unshown-desk",
    route: "/",
    note: "Desk methods with no page control stay not-bound.",
  },
  {
    screenId: "marketing-hub",
    route: "/marketing",
    note: "No published command. no fixture pass.",
  },
  {
    screenId: "marketing-m01",
    route: "/marketing/m01",
    note: "No published command. no fixture pass.",
  },
  {
    screenId: "marketing-m02",
    route: "/marketing/m02",
    note: "No published command. no fixture pass. A presale note does not place a hold.",
  },
  {
    screenId: "marketing-m03",
    route: "/marketing/m03",
    note: "No published command. no fixture pass.",
  },
  {
    screenId: "marketing-m04",
    route: "/marketing/m04",
    note: "No published command. no fixture pass. Markers are not a payout.",
  },
  {
    screenId: "marketing-m05",
    route: "/marketing/m05",
    note: "set_consent and authorize_marketing cases. Session flags are not the set_consent body.",
  },
  {
    screenId: "discovery-prototype",
    route: "/discovery",
    note: "Synthetic stale tier. Not a protocol receipt and not a tuple pass.",
  },
  {
    screenId: "discovery-live-read",
    route: "/discovery",
    note: "Synthetic projection read cases. A ready page is not a tuple pass. The read stays not-bound on integration-http because the contract-only catalogue has no read command.",
  },
  {
    screenId: "inventory-venue-select",
    route: "/inventory",
    note: "Synthetic seat and GA selection cases. A ready page or a local selection is not a tuple pass. The read stays not-bound on integration-http because the contract-only catalogue has no inventory read command.",
  },
  {
    screenId: "platform-journey-trade",
    route: "/platform",
    note: "Synthetic multi-channel trade cases. A confirmed synthetic write or an observed facet is not a tuple pass. The read and the writes stay not-bound on integration-http because the contract-only catalogue has no listing, trade, payment, transfer, or refund command.",
  },
  {
    screenId: "merchant-operations",
    route: "/merchant",
    note: "Synthetic merchant read and export cases. A ready page or a current export is not a tuple pass. The read and the export stay not-bound on integration-http because the contract-only catalogue has no read or export command.",
  },
  {
    screenId: "buyer-workspace",
    route: "/buyer",
    note: "An unknown row stays unknown. This page does not post.",
  },
  {
    screenId: "organizer-workspace",
    route: "/organizer/workspace",
    note: "no fixture pass. Sends are the organizer-console cases. This screen does not own a second pass.",
  },
  {
    screenId: "receipt-explorer",
    route: "/receipts",
    note: "Unknown stays unknown. Stale is not confirmed. This page does not send.",
  },
  {
    screenId: "accessibility-baseline",
    route: "(none)",
    note: "no fixture pass. Amounts are not generated. This row adds no route.",
  },
] as const satisfies readonly FixtureScreenRow[];

const SCREEN_IDS: ReadonlySet<string> = new Set(FIXTURE_SCREENS.map((screen) => screen.screenId));

/**
 * Desk method to the workspace surface that already lists it.
 * The UI test checks this against the registry. This is not a new binding.
 */
const NOT_BOUND_SCREEN: Record<CommerceMethod, string> = {
  listPerformances: "box-office-catalog",
  placeHold: "booking-journey",
  releaseHold: "booking-journey",
  confirmBooking: "booking-journey",
  getBooking: "operator-unshown-desk",
  checkAdmission: "operator-unshown-desk",
  listResale: "resale-desk",
  openResale: "resale-desk",
  acceptResale: "resale-desk",
  settlementPreview: "operator-unshown-desk",
  initiateSettlement: "box-office-settlement",
  authorizeSettlement: "box-office-settlement",
  captureSettlement: "box-office-settlement",
  commitSettlement: "box-office-settlement",
  failSettlement: "box-office-settlement",
  cancelSettlement: "box-office-settlement",
  reconcileSettlement: "box-office-settlement",
  viewSettlement: "box-office-settlement",
  rejectExternalSettlement: "operator-unshown-desk",
  advanceReservationClock: "reservation-case",
  registerReservationShow: "reservation-case",
  holdReservation: "reservation-case",
  releaseReservation: "reservation-case",
  confirmReservation: "reservation-case",
  cancelReservation: "reservation-case",
  observeReservationPayment: "reservation-case",
  bindReservationSettlement: "reservation-case",
  issueReservation: "reservation-case",
  authorizeReservationAdmission: "reservation-case",
  consumeReservation: "reservation-case",
  reconcileReservation: "reservation-case",
  viewReservation: "reservation-case",
  viewReservationShow: "reservation-case",
  rejectExternalReservation: "operator-unshown-desk",
  advanceAdmissionClock: "admission-credential",
  adoptAdmissionIssued: "admission-credential",
  authorizeAdmissionCredential: "admission-credential",
  consumeAdmissionCredential: "admission-credential",
  reconcileAdmission: "admission-credential",
  rejectExternalAdmission: "operator-unshown-desk",
  presentAdmission: "admission-credential",
  advanceResaleClock: "resale-desk",
  adoptResaleIssued: "resale-desk",
  listResaleCase: "resale-desk",
  holdResaleBuy: "resale-desk",
  releaseResaleHold: "resale-desk",
  cancelResaleListing: "resale-desk",
  observeResalePayment: "resale-desk",
  bindResaleSettlement: "resale-desk",
  acceptResaleTransfer: "resale-desk",
  closeResaleListing: "resale-desk",
  reconcileResale: "resale-desk",
  viewResaleCase: "resale-desk",
  viewResaleRight: "resale-desk",
  viewResalePresentation: "operator-unshown-desk",
  rejectExternalResale: "resale-desk",
  offerCredit: "credit-desk",
  approveCredit: "credit-desk",
  rejectCredit: "credit-desk",
  cancelCredit: "credit-desk",
  bindCreditSettlement: "credit-desk",
  drawCredit: "credit-desk",
  repayCredit: "credit-desk",
  closeCredit: "credit-desk",
  defaultCredit: "credit-desk",
  reconcileCredit: "credit-desk",
  viewCredit: "credit-desk",
  rejectUnsupportedCredit: "credit-desk",
};

export function tupleKeyFrom(parts: FixtureTupleParts): string {
  return [
    parts.catalogueVersion,
    parts.contractOpenApiSha256,
    parts.contractInfoVersion,
    parts.contractMainSha,
    parts.gateOpenApiSha256,
    parts.protocolMergeSha,
    parts.protocolFeatureSha,
    parts.sourceProtocolContractSha256,
    parts.domain,
    parts.pinnedActions.join(","),
    parts.sdkDigest ?? "",
    parts.manifestDigest ?? "",
    parts.vectorDigest ?? "",
  ].join("|");
}

export const FIXTURE_TUPLE_KEY = tupleKeyFrom(FIXTURE_TUPLE_LITERALS);

export function liveTupleParts(): FixtureTupleParts {
  return {
    catalogueVersion: FIXTURE_CATALOGUE_VERSION,
    contractOpenApiSha256: OPENAPI_CONTRACT_PIN.openApiFileSha256,
    contractInfoVersion: OPENAPI_CONTRACT_PIN.infoVersion,
    contractMainSha: OPENAPI_CONTRACT_PIN.protocolMainSha,
    gateOpenApiSha256: OPENAPI_INTEGRATION_GATE_PIN.openApiFileSha256,
    protocolMergeSha: OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha,
    protocolFeatureSha: OPENAPI_INTEGRATION_GATE_PIN.protocolFeatureSha,
    sourceProtocolContractSha256: OPENAPI_CONTRACT_PIN.sourceProtocolContractSha256,
    domain: PINNED_PROTOCOL_DOMAIN,
    pinnedActions: PINNED_ACTIONS,
    sdkDigest: null,
    manifestDigest: null,
    vectorDigest: null,
  };
}

export function liveTupleKey(): string {
  return tupleKeyFrom(liveTupleParts());
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function screenStatusFor(klass: FixtureClass): FixtureScreenStatus {
  switch (klass) {
    case "SUCCESS":
      return "confirmed";
    case "REJECT":
      return "rejected";
    case "UNKNOWN":
      return "unknown";
    case "NOT_BOUND":
      return "not-bound";
    case "STALE":
      return "stale";
  }
}

function ident(operationId: string, actor: string, action: string): FixtureIdentity {
  return { operationId, actor, action };
}

function outcome(input: {
  id: string;
  screenId: string;
  klass: FixtureClass;
  source: FixtureSource;
  ownsPass: boolean;
  liveFailure: boolean;
  identity: FixtureIdentity | null;
  code: string | null;
  resultKeys?: readonly string[];
  observation: string;
}): ContractFixture {
  return {
    id: input.id,
    catalogueVersion: FIXTURE_CATALOGUE_VERSION,
    tupleKey: FIXTURE_TUPLE_KEY,
    screenId: input.screenId,
    klass: input.klass,
    screenStatus: screenStatusFor(input.klass),
    source: input.source,
    ownsPass: input.ownsPass,
    liveFailure: input.liveFailure,
    substituteStub: false,
    computesFinance: false,
    computesRights: false,
    identity: input.identity,
    method: null,
    consideredAction: null,
    mappedOntoPrepareTrade: false,
    code: input.code,
    resultKeys: input.resultKeys ?? [],
    observation: input.observation,
  };
}

const CREATE_RESULT_KEYS = ["eventId", "policyHash", "inventoryIds", "reservationSeconds"] as const;
const PREPARE_RESULT_KEYS = ["tradeId", "ticketId", "externalOrderId", "status", "termsHash"] as const;
const ACCEPT_RESULT_KEYS = ["accepted"] as const;
const OFFER_RESULT_KEYS = ["giftId", "termsHash"] as const;
const SET_RESULT_KEYS = ["allowed", "consentVersion"] as const;

const OUTCOME_FIXTURES: readonly ContractFixture[] = [
  outcome({
    id: "booking-journey.create_event.success",
    screenId: "booking-journey",
    klass: "SUCCESS",
    source: "stub-shape",
    ownsPass: true,
    liveFailure: false,
    identity: ident("op-fix-create", "operator", "create_event"),
    code: null,
    resultKeys: CREATE_RESULT_KEYS,
    observation: "Stub-shape create_event receipt. Key names only. Not from the gate.",
  }),
  outcome({
    id: "booking-journey.prepare_trade.success",
    screenId: "booking-journey",
    klass: "SUCCESS",
    source: "stub-shape",
    ownsPass: true,
    liveFailure: false,
    identity: ident("op-fix-prepare", "buyer-a", "prepare_trade"),
    code: null,
    resultKeys: PREPARE_RESULT_KEYS,
    observation: "Stub-shape prepare_trade receipt. placeHold is not mapped onto this body. Key names only.",
  }),
  outcome({
    id: "booking-journey.accept_trade.success",
    screenId: "booking-journey",
    klass: "SUCCESS",
    source: "stub-shape",
    ownsPass: true,
    liveFailure: false,
    identity: ident("op-fix-accept", "buyer-a", "accept_trade"),
    code: null,
    resultKeys: ACCEPT_RESULT_KEYS,
    observation: "Stub-shape accept_trade receipt. The journey stops here. capture is not composed.",
  }),
  outcome({
    id: "booking-journey.create_event.reject",
    screenId: "booking-journey",
    klass: "REJECT",
    source: "none",
    ownsPass: false,
    liveFailure: true,
    identity: ident("op-fix-create-reject", "operator", "create_event"),
    code: "EVENT_EXISTS",
    observation: "Gate rejected create_event with EVENT_EXISTS. The failure is not a stub success.",
  }),
  outcome({
    id: "booking-journey.create_event.unknown",
    screenId: "booking-journey",
    klass: "UNKNOWN",
    source: "none",
    ownsPass: false,
    liveFailure: true,
    identity: ident("op-fix-create-unknown", "operator", "create_event"),
    code: "INTERNAL_ERROR",
    observation: "INTERNAL_ERROR left create_event unknown. It is not a rejection and not a success.",
  }),
  outcome({
    id: "booking-journey.create_event.stale",
    screenId: "booking-journey",
    klass: "STALE",
    source: "integration-gate",
    ownsPass: false,
    liveFailure: true,
    identity: ident("op-fix-create-stale", "operator", "create_event"),
    code: "STALE_RESPONSE",
    observation:
      "STALE_RESPONSE does not update the attempt. The journey helper disposition for a traced protocol error stays unknown. This catalogue class stays STALE.",
  }),
  outcome({
    id: "gift-transfer.offer_gift.success",
    screenId: "gift-transfer",
    klass: "SUCCESS",
    source: "stub-shape",
    ownsPass: true,
    liveFailure: false,
    identity: ident("op-fix-offer", "desk-donor", "offer_gift"),
    code: null,
    resultKeys: OFFER_RESULT_KEYS,
    observation: "Stub-shape offer_gift receipt. Key names only. financialEntries is not filled.",
  }),
  outcome({
    id: "gift-transfer.offer_gift.reject",
    screenId: "gift-transfer",
    klass: "REJECT",
    source: "none",
    ownsPass: false,
    liveFailure: true,
    identity: ident("op-fix-offer-reject", "desk-donor", "offer_gift"),
    code: "TICKET_NOT_FOUND",
    observation: "Gate rejected offer_gift with TICKET_NOT_FOUND. The failure is not a stub success.",
  }),
  outcome({
    id: "gift-transfer.offer_gift.unknown",
    screenId: "gift-transfer",
    klass: "UNKNOWN",
    source: "none",
    ownsPass: false,
    liveFailure: true,
    identity: ident("op-fix-offer-unknown", "desk-donor", "offer_gift"),
    code: "GATE_UNAVAILABLE",
    observation: "GATE_UNAVAILABLE left offer_gift unknown. The client does not fall back to the stub.",
  }),
  outcome({
    id: "organizer-console.create_event.success",
    screenId: "organizer-console",
    klass: "SUCCESS",
    source: "stub-shape",
    ownsPass: true,
    liveFailure: false,
    identity: ident("op-fix-org-create", "operator", "create_event"),
    code: null,
    resultKeys: CREATE_RESULT_KEYS,
    observation: "Stub-shape organizer create_event receipt. A booking create_event pass does not verify this case.",
  }),
  outcome({
    id: "organizer-console.create_event.reject",
    screenId: "organizer-console",
    klass: "REJECT",
    source: "none",
    ownsPass: false,
    liveFailure: true,
    identity: ident("op-fix-org-reject", "operator", "create_event"),
    code: "EVENT_EXISTS",
    observation: "Gate rejected organizer create_event with EVENT_EXISTS. The failure is not a stub success.",
  }),
  outcome({
    id: "marketing-m05.set_consent.success",
    screenId: "marketing-m05",
    klass: "SUCCESS",
    source: "stub-shape",
    ownsPass: true,
    liveFailure: false,
    identity: ident("op-fix-consent", "subject-a", "set_consent"),
    code: null,
    resultKeys: SET_RESULT_KEYS,
    observation: "Stub-shape set_consent receipt. allowed is copied. consentVersion is not a computed right.",
  }),
  outcome({
    id: "marketing-m05.authorize_marketing.reject",
    screenId: "marketing-m05",
    klass: "REJECT",
    source: "none",
    ownsPass: false,
    liveFailure: true,
    identity: ident("op-fix-authorize-reject", "marketing-adapter", "authorize_marketing"),
    code: "STALE_CONSENT_VERSION",
    observation: "STALE_CONSENT_VERSION is a gate rejection. The word stale in the code does not make the class STALE.",
  }),
  outcome({
    id: "marketing-m05.set_consent.unknown",
    screenId: "marketing-m05",
    klass: "UNKNOWN",
    source: "none",
    ownsPass: false,
    liveFailure: true,
    identity: ident("op-fix-consent-unknown", "subject-a", "set_consent"),
    code: "REQUEST_TIMEOUT",
    observation: "REQUEST_TIMEOUT left set_consent unknown. The client does not retry.",
  }),
  outcome({
    id: "box-office-journey-view.unknown",
    screenId: "box-office-journey-view",
    klass: "UNKNOWN",
    source: "none",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: null,
    observation: "This route does not send. An unknown outcome stays unknown.",
  }),
  outcome({
    id: "buyer-workspace.unknown",
    screenId: "buyer-workspace",
    klass: "UNKNOWN",
    source: "none",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: null,
    observation: "An unknown row stays unknown. This page does not post.",
  }),
  outcome({
    id: "receipt-explorer.unknown",
    screenId: "receipt-explorer",
    klass: "UNKNOWN",
    source: "none",
    ownsPass: false,
    liveFailure: false,
    identity: ident("op-fix-receipt-unknown", "operator", "create_event"),
    code: null,
    observation: "This read does not turn an unknown outcome into a confirmed receipt.",
  }),
  outcome({
    id: "receipt-explorer.stale",
    screenId: "receipt-explorer",
    klass: "STALE",
    source: "integration-gate",
    ownsPass: false,
    liveFailure: true,
    identity: ident("op-fix-receipt-stale", "operator", "create_event"),
    code: "STALE_RESPONSE",
    observation: "A stale response stays stale on this read and is not confirmed.",
  }),
  outcome({
    id: "discovery-prototype.price-stale",
    screenId: "discovery-prototype",
    klass: "STALE",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: null,
    observation: "Synthetic price tier label. Not a protocol receipt and not a tuple pass.",
  }),
  outcome({
    id: "discovery-live-read.stream-stale",
    screenId: "discovery-live-read",
    klass: "STALE",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: null,
    observation: "Synthetic stale watermark on the projection stream. Not a protocol receipt and not a tuple pass.",
  }),
  outcome({
    id: "discovery-live-read.stream-gap",
    screenId: "discovery-live-read",
    klass: "REJECT",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: "PROJECTION_GAP",
    observation: "A duplicate or skipped sequence in the synthetic stream. The adapter refuses the page. This is not a gate rejection.",
  }),
  outcome({
    id: "discovery-live-read.tenant-mix",
    screenId: "discovery-live-read",
    klass: "REJECT",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: "PROJECTION_TENANT",
    observation: "A row carrying another tenant id. The adapter refuses it before the screen sees it.",
  }),
  outcome({
    id: "discovery-live-read.cursor-invalid",
    screenId: "discovery-live-read",
    klass: "REJECT",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: "PROJECTION_CURSOR",
    observation: "A stale or foreign cursor refused after a projection rebuild. The user starts over.",
  }),
  outcome({
    id: "inventory-venue-select.hold-stale",
    screenId: "inventory-venue-select",
    klass: "STALE",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: null,
    observation: "A synthetic observed hold that expired or belongs to an earlier generation. The seat is not shown as free. Not a protocol receipt and not a tuple pass.",
  }),
  outcome({
    id: "inventory-venue-select.generation-changed",
    screenId: "inventory-venue-select",
    klass: "REJECT",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: "INVENTORY_GENERATION",
    observation: "A page or selection read under an earlier inventory generation. The adapter refuses it and carries nothing over. This is not a gate rejection.",
  }),
  outcome({
    id: "inventory-venue-select.mode-mismatch",
    screenId: "inventory-venue-select",
    klass: "REJECT",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: "INVENTORY_MODE",
    observation: "A seat read against a GA section, a quantity against a seat, or a section that changed mode. The adapter refuses it and converts nothing.",
  }),
  outcome({
    id: "inventory-venue-select.queue-blocked",
    screenId: "inventory-venue-select",
    klass: "REJECT",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: "INVENTORY_QUEUE",
    observation: "The synthetic queue is waiting or lapsed, so the selection pages are closed. Queue admission is access only, never a hold, payment, or right.",
  }),
  outcome({
    id: "inventory-venue-select.unsupported-mode",
    screenId: "inventory-venue-select",
    klass: "REJECT",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: "INVENTORY_UNSUPPORTED",
    observation: "Accessible seating. The policy is undetermined, so the adapter refuses to offer, hold, or hide it.",
  }),
  outcome({
    id: "platform-journey-trade.version-stale",
    screenId: "platform-journey-trade",
    klass: "REJECT",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: "PLATFORM_VERSION_STALE",
    observation: "A synthetic transfer on a right version that moved, for example after another channel won. The synthetic source refuses it, not a gate. The payment observation stays and the right stays where the other channel put it.",
  }),
  outcome({
    id: "platform-journey-trade.terms-changed",
    screenId: "platform-journey-trade",
    klass: "REJECT",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: "PLATFORM_TERMS_CHANGED",
    observation: "A synthetic transfer on terms a later price change superseded. The synthetic source refuses it, not a gate. No amount is computed.",
  }),
  outcome({
    id: "platform-journey-trade.payment-unobserved",
    screenId: "platform-journey-trade",
    klass: "REJECT",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: "PLATFORM_PAYMENT_UNOBSERVED",
    observation: "A synthetic transfer with no payment observation, as when the observation is lost. The right does not move and the refund facet reads COMPENSATION_UNDEFINED.",
  }),
  outcome({
    id: "platform-journey-trade.write-fenced",
    screenId: "platform-journey-trade",
    klass: "REJECT",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: "PLATFORM_FENCED",
    observation: "The client fence refused a write because another write on the same right is in flight or unknown. Nothing was sent and nothing is queued.",
  }),
  outcome({
    id: "platform-journey-trade.response-lost",
    screenId: "platform-journey-trade",
    klass: "UNKNOWN",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: null,
    observation: "A synthetic write whose response never arrived. It may have applied. It is not a rejection and not a success, and the right stays fenced.",
  }),
  outcome({
    id: "platform-journey-trade.late-result",
    screenId: "platform-journey-trade",
    klass: "UNKNOWN",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: null,
    observation: "A late result was recorded against an unknown write. It is evidence only: the write stays unknown and the fence stays.",
  }),
  outcome({
    id: "platform-journey-trade.stale-read",
    screenId: "platform-journey-trade",
    klass: "STALE",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: null,
    observation: "The last read is behind: a stale watermark, a rejection that says the read was old, or an own write that landed after it. The page reads again before the next write.",
  }),
  outcome({
    id: "platform-journey-trade.stale-session",
    screenId: "platform-journey-trade",
    klass: "STALE",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: null,
    observation: "A result arrived after the session context changed. It is quarantined and does not touch the current view. The earlier unknown fence stays.",
  }),
  outcome({
    id: "merchant-operations.stale-read",
    screenId: "merchant-operations",
    klass: "STALE",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: null,
    observation: "A synthetic watermark older than the floor the page holds. No row is returned and the page is not treated as an empty ledger.",
  }),
  outcome({
    id: "merchant-operations.stale-aggregate",
    screenId: "merchant-operations",
    klass: "STALE",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: null,
    observation: "A source figure built at an older generation than the cut it names. The flag is shown next to the figure, and the page does not recompute it.",
  }),
  outcome({
    id: "merchant-operations.cut-mismatch",
    screenId: "merchant-operations",
    klass: "REJECT",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: null,
    observation: "A source figure whose count differs from the lines it names, an aggregate on an unknown cut, or rows on more than one cut. Nothing is merged into one balance. The assessment flags it; it is not a gate rejection.",
  }),
  outcome({
    id: "merchant-operations.scope-denied",
    screenId: "merchant-operations",
    klass: "REJECT",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: "SCOPE_DENIED",
    observation: "The actor holds no grant for that merchant at the synthetic source, or the grant was withdrawn. No row and no export is returned. This is not a gate rejection.",
  }),
  outcome({
    id: "merchant-operations.export-denied",
    screenId: "merchant-operations",
    klass: "REJECT",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: "EXPORT_DENIED",
    observation: "The synthetic source grants the read and no export. The export stays absent; it is not rebuilt on the page.",
  }),
  outcome({
    id: "merchant-operations.claim-refused",
    screenId: "merchant-operations",
    klass: "REJECT",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: "CLAIM",
    observation: "A line that does not state settled, fundsAvailable, and lendable as false. The whole payload is refused before a row is shown, because a synthetic line is never any of those.",
  }),
  outcome({
    id: "merchant-operations.export-withheld",
    screenId: "merchant-operations",
    klass: "REJECT",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: null,
    observation: "An export that is partial, on a stale or unknown cut, for another scope, or whose lines differ from the read. It is withheld with every reason, and the page does not repair it.",
  }),
  outcome({
    id: "merchant-operations.read-lost",
    screenId: "merchant-operations",
    klass: "UNKNOWN",
    source: "synthetic-fixture",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: null,
    observation: "The answer to a read never arrived. The ledger is unavailable, which is not an empty ledger, and the page does not ask again on its own.",
  }),
  outcome({
    id: "admission-credential.label-stale",
    screenId: "admission-credential",
    klass: "STALE",
    source: "mock-case",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: "CREDENTIAL_STALE",
    observation: "Adapter-assigned credential label. Not admit and not a catalogue receipt.",
  }),
  outcome({
    id: "resale-desk.version-stale",
    screenId: "resale-desk",
    klass: "STALE",
    source: "mock-case",
    ownsPass: false,
    liveFailure: false,
    identity: null,
    code: "STALE_VERSION",
    observation: "Mock stale version. Not economic finality and not a catalogue receipt.",
  }),
  outcome({
    id: "operator-transport.unavailable",
    screenId: "operator-transport",
    klass: "UNKNOWN",
    source: "none",
    ownsPass: false,
    liveFailure: true,
    identity: null,
    code: "GATE_UNAVAILABLE",
    observation: "GATE_UNAVAILABLE stays on integration HTTP. There is no stub fallback.",
  }),
  outcome({
    id: "operator-transport.stale",
    screenId: "operator-transport",
    klass: "STALE",
    source: "none",
    ownsPass: false,
    liveFailure: true,
    identity: null,
    code: "STALE_RESPONSE",
    observation: "STALE_RESPONSE stays on integration HTTP. There is no stub fallback.",
  }),
];

function notBoundFixtures(): ContractFixture[] {
  return COMMERCE_METHODS.map((method) => {
    const binding = COMMERCE_COMMAND_BINDINGS[method];
    return {
      id: `not-bound.${method}`,
      catalogueVersion: FIXTURE_CATALOGUE_VERSION,
      tupleKey: FIXTURE_TUPLE_KEY,
      screenId: NOT_BOUND_SCREEN[method],
      klass: "NOT_BOUND",
      screenStatus: "not-bound",
      source: "none",
      ownsPass: false,
      liveFailure: false,
      substituteStub: false,
      computesFinance: false,
      computesRights: false,
      identity: null,
      method,
      consideredAction: binding.consideredAction,
      mappedOntoPrepareTrade: false,
      code: null,
      resultKeys: [],
      observation: binding.reason,
    };
  });
}

function assemble(): readonly ContractFixture[] {
  const fixtures = [...OUTCOME_FIXTURES, ...notBoundFixtures()];
  const seen = new Set<string>();
  for (const fixture of fixtures) {
    if (seen.has(fixture.id)) {
      throw new ProtocolError(`Duplicate fixture id ${fixture.id}.`);
    }
    seen.add(fixture.id);
    if (!SCREEN_IDS.has(fixture.screenId)) {
      throw new ProtocolError(`Fixture ${fixture.id} names an unknown screen ${fixture.screenId}.`);
    }
    if (fixture.tupleKey !== FIXTURE_TUPLE_KEY) {
      throw new ProtocolError(`Fixture ${fixture.id} is not on catalogue version ${FIXTURE_CATALOGUE_VERSION}.`);
    }
    if (fixture.substituteStub !== false || fixture.computesFinance !== false || fixture.computesRights !== false) {
      throw new ProtocolError(`Fixture ${fixture.id} records a forbidden computation.`);
    }
    if (fixture.mappedOntoPrepareTrade !== false) {
      throw new ProtocolError(`Fixture ${fixture.id} maps a desk method onto prepare_trade.`);
    }
    if (fixture.ownsPass && fixture.klass !== "SUCCESS") {
      throw new ProtocolError(`Fixture ${fixture.id} owns a pass without SUCCESS.`);
    }
    if (fixture.klass === "SUCCESS") {
      if (!fixture.ownsPass || fixture.identity === null || fixture.resultKeys.length === 0 || fixture.liveFailure) {
        throw new ProtocolError(`SUCCESS fixture ${fixture.id} is incomplete.`);
      }
      if (!isPinnedAction(fixture.identity.action)) {
        throw new ProtocolError(`SUCCESS fixture ${fixture.id} names an unknown action.`);
      }
      if ((FIXTURE_NEVER_SUCCESS_ACTIONS as readonly string[]).includes(fixture.identity.action)) {
        throw new ProtocolError(`SUCCESS fixture ${fixture.id} names an action this catalogue does not confirm.`);
      }
    }
    if (fixture.klass === "NOT_BOUND" && (fixture.method === null || fixture.identity !== null)) {
      throw new ProtocolError(`NOT_BOUND fixture ${fixture.id} has the wrong identity.`);
    }
  }
  const boundMethods = fixtures.filter((fixture) => fixture.klass === "NOT_BOUND").map((fixture) => fixture.method);
  if (boundMethods.length !== COMMERCE_METHODS.length || new Set(boundMethods).size !== COMMERCE_METHODS.length) {
    throw new ProtocolError("NOT_BOUND fixtures do not cover each desk method once.");
  }
  for (const screen of FIXTURE_SCREENS) {
    const rows = fixtures.filter((fixture) => fixture.screenId === screen.screenId);
    const empty = screen.note.includes("no fixture pass");
    if (rows.length === 0 && !empty) {
      throw new ProtocolError(`Screen ${screen.screenId} has no fixture and no empty reason.`);
    }
    if (rows.length > 0 && empty) {
      throw new ProtocolError(`Screen ${screen.screenId} owns fixtures but says it has no fixture pass.`);
    }
  }
  return fixtures;
}

export const CONTRACT_FIXTURES: readonly ContractFixture[] = assemble();

const FIXTURE_INDEX: ReadonlyMap<string, ContractFixture> = new Map(
  CONTRACT_FIXTURES.map((fixture) => [fixture.id, fixture]),
);

export function fixtureById(id: string): ContractFixture {
  const fixture = FIXTURE_INDEX.get(id);
  if (!fixture) {
    throw new ProtocolError(`Unknown fixture ${id}.`, "UNKNOWN_CASE");
  }
  return fixture;
}

export function fixturesForScreen(screenId: string): readonly ContractFixture[] {
  return CONTRACT_FIXTURES.filter((fixture) => fixture.screenId === screenId);
}

export function notBoundScreenOf(method: CommerceMethod): string {
  return NOT_BOUND_SCREEN[method];
}

export function assertCatalogueBound(): void {
  const live = liveTupleParts();
  for (const field of SCALAR_TUPLE_FIELDS) {
    if (live[field] !== FIXTURE_TUPLE_LITERALS[field]) {
      throw new ProtocolError(
        `Fixture catalogue tuple ${field} does not match the live pin.`,
        "DIFFERENT_TUPLE",
      );
    }
  }
  if (!sameList(live.pinnedActions, FIXTURE_TUPLE_LITERALS.pinnedActions)) {
    throw new ProtocolError("Fixture catalogue PINNED_ACTIONS do not match the live pin.", "DIFFERENT_TUPLE");
  }
  if (
    FIXTURE_TUPLE_LITERALS.sdkDigest !== null ||
    FIXTURE_TUPLE_LITERALS.manifestDigest !== null ||
    FIXTURE_TUPLE_LITERALS.vectorDigest !== null
  ) {
    throw new ProtocolError("This catalogue does not consume an SDK, manifest, or vector.", "DIFFERENT_TUPLE");
  }
  if (OPENAPI_INTEGRATION_GATE_PIN.contractOnlyOpenApiFileSha256 !== OPENAPI_CONTRACT_PIN.openApiFileSha256) {
    throw new ProtocolError("Contract-only sha on the gate pin does not match the catalogue pin.", "DIFFERENT_TUPLE");
  }
  if (OPENAPI_INTEGRATION_GATE_PIN.sourceProtocolContractSha256 !== OPENAPI_CONTRACT_PIN.sourceProtocolContractSha256) {
    throw new ProtocolError("Source contract sha differs between the two pins.", "DIFFERENT_TUPLE");
  }
  if (OPENAPI_INTEGRATION_GATE_PIN.commandCount !== PINNED_ACTIONS.length) {
    throw new ProtocolError("Gate command count does not match PINNED_ACTIONS.", "DIFFERENT_TUPLE");
  }
  if (liveTupleKey() !== FIXTURE_TUPLE_KEY) {
    throw new ProtocolError("Live tuple key does not match the catalogue.", "DIFFERENT_TUPLE");
  }
  const placeHold = COMMERCE_COMMAND_BINDINGS.placeHold;
  if (placeHold.status !== "not-bound" || placeHold.consideredAction !== "reserve_listing") {
    throw new ProtocolError("placeHold is not the locked not-bound reserve_listing record.", "DIFFERENT_TUPLE");
  }
  if (COMMERCE_COMMAND_BINDINGS.confirmBooking.consideredAction !== "capture") {
    throw new ProtocolError("confirmBooking consideredAction changed.", "DIFFERENT_TUPLE");
  }
  if (COMMERCE_COMMAND_BINDINGS.settlementPreview.consideredAction !== "settle_capture") {
    throw new ProtocolError("settlementPreview consideredAction changed.", "DIFFERENT_TUPLE");
  }
  const held = fixtureById("not-bound.placeHold");
  if (held.consideredAction !== "reserve_listing" || held.mappedOntoPrepareTrade !== false || held.klass !== "NOT_BOUND") {
    throw new ProtocolError("placeHold fixture is not the locked not-bound record.", "DIFFERENT_TUPLE");
  }
}

export function projectFixture(fixture: ContractFixture): FixtureProjection {
  const tupleMatches = fixture.tupleKey === liveTupleKey();
  const confirmed =
    tupleMatches &&
    fixture.ownsPass &&
    fixture.klass === "SUCCESS" &&
    !fixture.liveFailure &&
    (fixture.source === "stub-shape" || fixture.source === "integration-gate");
  return {
    klass: fixture.klass,
    screenStatus: fixture.screenStatus,
    confirmed,
    fallbackToStub: false,
    retry: false,
    readConfirmsUnknown: false,
    substituteStub: false,
    tupleMatches,
  };
}

function refuse(reason: ClassifyRefusal, field?: string): ClassifyResult {
  return field === undefined ? { ok: false, reason } : { ok: false, reason, field };
}

export function classifyAgainstFixture(caseId: string, observed: FixtureObservation): ClassifyResult {
  if (observed.compute !== "none") {
    return refuse("GENERATOR_BOUNDARY");
  }
  if (observed.substituteStub) {
    return refuse("STUB_SUBSTITUTE");
  }
  const fixture = FIXTURE_INDEX.get(caseId);
  if (!fixture) {
    return refuse("INVALID");
  }
  if (observed.tupleKey !== liveTupleKey() || fixture.tupleKey !== liveTupleKey()) {
    return refuse("DIFFERENT_TUPLE");
  }
  if (!(FIXTURE_CLASSES as readonly string[]).includes(observed.klass)) {
    return refuse("NEW_ENUM");
  }
  if (observed.klass !== fixture.klass) {
    return refuse("INVALID");
  }
  if (fixture.klass === "SUCCESS" && !observed.callSucceeded) {
    return refuse("STUB_SUBSTITUTE");
  }
  if (fixture.identity) {
    if (!observed.operationId) {
      return refuse("MISSING_FIELD", "operationId");
    }
    if (!observed.actor) {
      return refuse("MISSING_FIELD", "actor");
    }
    if (!observed.action) {
      return refuse("MISSING_FIELD", "action");
    }
    if (!isPinnedAction(observed.action)) {
      return refuse("NEW_ENUM", "action");
    }
    if (
      observed.operationId !== fixture.identity.operationId ||
      observed.actor !== fixture.identity.actor ||
      observed.action !== fixture.identity.action
    ) {
      return refuse("DIFFERENT_IDENTITY");
    }
  } else if (observed.action) {
    if (!isPinnedAction(observed.action)) {
      return refuse("NEW_ENUM", "action");
    }
    return refuse("DIFFERENT_IDENTITY");
  }
  if (fixture.method) {
    if (!observed.method) {
      return refuse("MISSING_FIELD", "method");
    }
    if (observed.method !== fixture.method) {
      return refuse("DIFFERENT_IDENTITY");
    }
  } else if (observed.method) {
    return refuse("DIFFERENT_IDENTITY");
  }
  if (fixture.code !== null) {
    if (!observed.code) {
      return refuse("MISSING_FIELD", "code");
    }
    if (observed.code !== fixture.code) {
      return refuse("DIFFERENT_IDENTITY");
    }
  } else if (observed.code) {
    return refuse("INVALID");
  }
  for (const key of fixture.resultKeys) {
    if (!observed.presentFields.includes(key)) {
      return refuse("MISSING_FIELD", key);
    }
  }
  if (fixture.klass === "SUCCESS") {
    const extra = observed.presentFields.filter((key) => !fixture.resultKeys.includes(key));
    if (extra.length > 0) {
      return refuse("INVALID", extra[0]);
    }
  }
  const projected = projectFixture(fixture);
  return {
    ok: true,
    klass: fixture.klass,
    confirmed: projected.confirmed && observed.callSucceeded,
    fallbackToStub: false,
    retry: false,
  };
}

export function acceptRecordedPass(
  pass: { tupleKey: string; caseId: string; klass: string },
  expectedCaseId: string,
):
  | { accepted: true; caseId: string }
  | { accepted: false; reason: "DIFFERENT_TUPLE" | "DIFFERENT_CASE" | "NOT_SUCCESS" | "UNKNOWN_CASE" } {
  const expected = FIXTURE_INDEX.get(expectedCaseId);
  if (!expected) {
    return { accepted: false, reason: "UNKNOWN_CASE" };
  }
  if (pass.tupleKey !== liveTupleKey() || expected.tupleKey !== liveTupleKey()) {
    return { accepted: false, reason: "DIFFERENT_TUPLE" };
  }
  if (pass.caseId !== expectedCaseId) {
    return { accepted: false, reason: "DIFFERENT_CASE" };
  }
  if (pass.klass !== "SUCCESS" || expected.klass !== "SUCCESS" || !expected.ownsPass) {
    return { accepted: false, reason: "NOT_SUCCESS" };
  }
  return { accepted: true, caseId: expectedCaseId };
}

export function classifyFailedLive(code: string | undefined, options?: { promoteToStubSuccess?: boolean }): FailedLiveClass {
  if (options?.promoteToStubSuccess) {
    throw new ProtocolError("A failed live call is not replaced with a stub success.", "STUB_SUBSTITUTE");
  }
  const normalized = code && code.trim().length > 0 ? code : "GATE_UNAVAILABLE";
  const klass = STALE_CODES.has(normalized) ? "STALE" : UNKNOWN_CODES.has(normalized) ? "UNKNOWN" : "REJECT";
  return {
    klass,
    code: normalized,
    substituteStub: false,
    confirmed: false,
    fallbackToStub: false,
    retry: false,
  };
}

export function generateFixture(request: { fixtureId: string; compute: "copy" | "finance" | "rights" }): GeneratedFixture {
  if (request.compute !== "copy") {
    throw new ProtocolError(
      "The fixture generator does not compute finance or rights.",
      "GENERATOR_BOUNDARY",
    );
  }
  const fixture = fixtureById(request.fixtureId);
  if (fixture.computesFinance || fixture.computesRights) {
    throw new ProtocolError("The fixture generator does not compute finance or rights.", "GENERATOR_BOUNDARY");
  }
  return {
    fixtureId: fixture.id,
    resultKeys: fixture.resultKeys,
    amounts: null,
    rights: null,
    financialEntries: null,
    shares: null,
    fallbackToStub: false,
    retry: false,
    observation: fixture.observation,
  };
}
