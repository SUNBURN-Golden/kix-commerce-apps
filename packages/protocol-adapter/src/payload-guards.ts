import { isPinnedAction, PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import { isRecord } from "./record.js";
import { SURFACES } from "./surfaces.js";
import {
  CREDIT_PROVENANCE,
  isAdmissionDeskState,
  isCreditPhase,
  isResalePhase,
  isReservationPhase,
  isSettlementPhase,
  ProtocolError,
  RESALE_PROVENANCE,
  RESERVATION_PROVENANCE,
  SETTLEMENT_PROVENANCE,
  type Booking,
  type SettlementPreview,
} from "./types.js";

const PRODUCTION_ADMISSION_COPY = [
  /gate scanned live/i,
  /venue admitted/i,
  /ticket printed for entry/i,
  /portone/i,
  /toss/i,
];

const PRODUCTION_RESALE_COPY = [
  /listed on exchange/i,
  /kyc cleared/i,
  /funds settled/i,
  /seller bank/i,
  /portone/i,
  /toss/i,
];

const CREDIT_KEYS = ["disburseCredit", "creditDisbursement", "disburse"] as const;

const PRODUCTION_CREDIT_COPY = [
  /loan approved by bank/i,
  /funds wired/i,
  /kyc cleared/i,
  /\bAPR\b/,
  /licensed lender/i,
  /interest rate/i,
];

/**
 * Deepest nesting this client walks in a remote payload. Deeper payloads are
 * refused instead of being walked partway.
 */
const MAX_PAYLOAD_DEPTH = 32;

/**
 * Fail-closed checks for any payload this client is willing to treat as a
 * booking or a settlement preview. A published Core receipt is the reference
 * model result. It is not a desk FSM view and it is not a production claim.
 * Every nested object is checked, not only the top level and result.
 */
export function enforceRemotePayloadGuards(value: unknown): void {
  try {
    rejectTransportProductionClaims(value, 0);
    scanDeep(value, 0);
  } catch (error) {
    // A received body that fails a desk guard is invalid evidence, not an
    // explicit business rejection. Keep that distinction through HTTP callers.
    if (error instanceof ProtocolError && error.code === undefined) {
      throw new ProtocolError(error.message, "GATE_STATUS");
    }
    throw error;
  }
}

/**
 * A successful local call must answer with exactly one published Core
 * receipt for the same operationId and action. An empty body, a bare value,
 * or a receipt with extra keys is not a success.
 */
export function assertLocalCallReceipt(
  value: unknown,
  expected: { action: string; operationId: string },
): void {
  if (!isCatalogueReceipt(value)) {
    throw new ProtocolError("Integration gate success was not a published local-call receipt.", "GATE_STATUS");
  }
  if (value.action !== expected.action || value.operationId !== expected.operationId) {
    throw new ProtocolError("Integration gate receipt does not match the local call.", "GATE_STATUS");
  }
}

function isCatalogueReceipt(value: unknown): value is {
  domain: string;
  operationId: string;
  sequence: number;
  action: string;
  result: Record<string, unknown>;
} {
  if (!isRecord(value)) {
    return false;
  }
  if (!sameKeys(value, ["domain", "operationId", "sequence", "action", "result"])) {
    return false;
  }
  return (
    value.domain === PINNED_PROTOCOL_DOMAIN &&
    typeof value.operationId === "string" &&
    typeof value.sequence === "number" &&
    Number.isInteger(value.sequence) &&
    typeof value.action === "string" &&
    isPinnedAction(value.action) &&
    isRecord(value.result)
  );
}

function sameKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => keys.includes(key));
}

function assertDepth(depth: number): void {
  if (depth > MAX_PAYLOAD_DEPTH) {
    throw new ProtocolError("Remote payload is nested too deeply.", "GATE_STATUS");
  }
}

function rejectTransportProductionClaims(value: unknown, depth: number): void {
  assertDepth(depth);
  if (Array.isArray(value)) {
    for (const item of value) {
      rejectTransportProductionClaims(item, depth + 1);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  if (
    value.production === true ||
    value.productionReadiness === true ||
    value.productionConformance === true ||
    value.protocolTruth === true ||
    value.liveMoney === true ||
    value.publicHost === true ||
    value["x-kix-production-endpoint"] === true ||
    value["x-kix-production-conformance"] === true ||
    value["x-kix-protocol-truth"] === true
  ) {
    throw new ProtocolError("Remote payload claims a production endpoint.", "PRODUCTION_ENDPOINT");
  }
  for (const child of Object.values(value)) {
    rejectTransportProductionClaims(child, depth + 1);
  }
}

function scanDeep(value: unknown, depth: number): void {
  assertDepth(depth);
  if (Array.isArray(value)) {
    for (const item of value) {
      scanDeep(item, depth + 1);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  scan(value);
  for (const child of Object.values(value)) {
    scanDeep(child, depth + 1);
  }
}

function scan(value: unknown): void {
  if (!isRecord(value)) {
    return;
  }
  for (const key of CREDIT_KEYS) {
    if (key in value) {
      throw new ProtocolError("This client does not disburse credit.");
    }
  }
  if (
    "listingId" in value &&
    ("amount" in value ||
      "currency" in value ||
      "gross" in value ||
      "sellerDue" in value ||
      "organizerDue" in value ||
      "platformDue" in value)
  ) {
    throw new ProtocolError("Resale payload must not carry an amount or a fee split.");
  }
  if (value.action === "disburse" || value.action === "disburseCredit") {
    throw new ProtocolError("This client does not disburse credit.");
  }
  if ("payment" in value && value.payment !== "simulated-no-funds") {
    throw new ProtocolError("This client only accepts simulated-no-funds bookings.");
  }
  if ("bookingId" in value && "payment" in value) {
    asBooking(value);
  }
  if (isCreditPayload(value)) {
    asCredit(value);
  } else if (isResalePayload(value)) {
    asResale(value);
  } else if (isReservationPayload(value)) {
    asReservation(value);
  }
  if (isAdmissionPayload(value)) {
    asAdmission(value);
  }
  if ("deskState" in value) {
    asAdmissionBoundary(value);
  }
  if (
    "mode" in value &&
    "references" in value &&
    !isReservationPayload(value) &&
    !isResalePayload(value) &&
    !isCreditPayload(value)
  ) {
    if ("amount" in value || "currency" in value) {
      throw new ProtocolError("Settlement preview must not carry an amount or currency.");
    }
    asSettlement(value);
  }
}

function asBooking(value: Record<string, unknown>): Booking {
  const status = value.status;
  if (status !== "confirmed" && status !== "transferred") {
    throw new ProtocolError("Booking status must be confirmed or transferred.");
  }
  if (value.payment !== "simulated-no-funds") {
    throw new ProtocolError("This client only accepts simulated-no-funds bookings.");
  }
  const quantity = value.quantity;
  if (typeof quantity !== "number" || !Number.isInteger(quantity)) {
    throw new ProtocolError("Missing booking quantity.");
  }
  return {
    bookingId: readString(value, "bookingId"),
    eventId: readString(value, "eventId"),
    quantity,
    rightsRef: readString(value, "rightsRef"),
    status,
    payment: "simulated-no-funds",
    surfaces: [SURFACES.booking, SURFACES.rightsIssuance],
  };
}

function asSettlement(value: Record<string, unknown>): SettlementPreview {
  const references = value.references;
  if (
    !Array.isArray(references) ||
    references.length !== 3 ||
    references[0] !== "F01" ||
    references[1] !== "F02" ||
    references[2] !== "F03"
  ) {
    throw new ProtocolError("Settlement preview must reference F01, F02, and F03 only.");
  }
  if (value.mode !== "mock") {
    throw new ProtocolError("Settlement preview must stay in mock mode.");
  }
  if ("phase" in value && !isSettlementPhase(value.phase)) {
    throw new ProtocolError("Settlement phase must be a mock FSM phase.");
  }
  if ("fundsExecuted" in value && value.fundsExecuted !== false) {
    throw new ProtocolError("Settlement payload must not claim executed funds.");
  }
  if ("provenance" in value && value.provenance !== SETTLEMENT_PROVENANCE) {
    throw new ProtocolError("Settlement payload must stay MOCK_SETTLEMENT_ONLY.");
  }
  if ("externalPayment" in value && value.externalPayment !== "UNSUPPORTED") {
    throw new ProtocolError("Settlement payload must keep external payment unsupported.");
  }
  if ("providerAuthorizationExecuted" in value && value.providerAuthorizationExecuted !== false) {
    throw new ProtocolError("Settlement payload must not claim a provider authorization.");
  }
  return {
    eventId: readString(value, "eventId"),
    mode: "mock",
    surface: SURFACES.settlementMock,
    references: ["F01", "F02", "F03"],
    note: readString(value, "note"),
  };
}

function isCreditPayload(value: Record<string, unknown>): boolean {
  if (
    "advanceId" in value ||
    "outstandingExposure" in value ||
    "availableCredit" in value ||
    "pendingDraw" in value ||
    "offerAmount" in value ||
    "drawnExposure" in value ||
    "repaidExposure" in value ||
    "exposureLedger" in value ||
    "ownershipMutated" in value ||
    "ticketOwnershipAuthoritative" in value ||
    "bankDebitObserved" in value
  ) {
    return true;
  }
  if (value.provenance === CREDIT_PROVENANCE) {
    return true;
  }
  if (Array.isArray(value.references) && value.references[0] === "F04") {
    return true;
  }
  return isCreditPhase(value.phase) && value.phase !== "CANCELLED";
}

function asCredit(value: Record<string, unknown>): void {
  if ("economicFinalityClaimed" in value && value.economicFinalityClaimed !== false) {
    throw new ProtocolError("Credit payload must not claim economic finality.");
  }
  if ("economic_finality_claimed" in value && value.economic_finality_claimed !== false) {
    throw new ProtocolError("Credit payload must not claim economic finality.");
  }
  if ("fundsExecuted" in value && value.fundsExecuted !== false) {
    throw new ProtocolError("Credit payload must not claim executed funds.");
  }
  if ("bankDebitObserved" in value && value.bankDebitObserved !== false) {
    throw new ProtocolError("Credit payload must not claim a bank debit.");
  }
  if ("repaymentObserved" in value && value.repaymentObserved !== false) {
    throw new ProtocolError("Credit payload must not claim an observed repayment.");
  }
  if ("interestDefined" in value && value.interestDefined !== false) {
    throw new ProtocolError("Credit payload must not define interest.");
  }
  if ("underwritingExecuted" in value && value.underwritingExecuted !== false) {
    throw new ProtocolError("Credit payload must not claim underwriting.");
  }
  if ("kycExecuted" in value && value.kycExecuted !== false) {
    throw new ProtocolError("Credit payload must not claim a KYC execution.");
  }
  if ("ownershipMutated" in value && value.ownershipMutated !== false) {
    throw new ProtocolError("Credit payload must not claim an ownership change.");
  }
  if ("ticketOwnershipAuthoritative" in value && value.ticketOwnershipAuthoritative !== false) {
    throw new ProtocolError("Credit payload must not claim ticket authority.");
  }
  if ("externalCredit" in value && value.externalCredit !== "UNSUPPORTED") {
    throw new ProtocolError("Credit payload must keep external credit unsupported.");
  }
  if ("amount" in value || "currency" in value || "gross" in value) {
    throw new ProtocolError("Credit payload must not carry a currency posting.");
  }
  const viewShaped =
    "advanceId" in value ||
    "availableCredit" in value ||
    "outstandingExposure" in value ||
    (Array.isArray(value.references) && value.references[0] === "F04") ||
    (isCreditPhase(value.phase) && value.phase !== "CANCELLED");
  if (viewShaped) {
    if (value.mode !== "mock") {
      throw new ProtocolError("Credit payload must stay in mock mode.");
    }
    if (value.provenance !== CREDIT_PROVENANCE) {
      throw new ProtocolError("Credit payload must stay MOCK_CREDIT_F04_ONLY.");
    }
  }
  if ("phase" in value && !isCreditPhase(value.phase)) {
    throw new ProtocolError("Credit phase must be a mock FSM phase.");
  }
  assertNoProductionCreditCopy(value);
}

function assertNoProductionCreditCopy(value: Record<string, unknown>): void {
  for (const key of ["note", "detail"] as const) {
    const field = value[key];
    if (typeof field !== "string") {
      continue;
    }
    if (PRODUCTION_CREDIT_COPY.some((pattern) => pattern.test(field))) {
      throw new ProtocolError("Credit payload must not use production-finance wording.");
    }
  }
}

function isResalePayload(value: Record<string, unknown>): boolean {
  const deskMarker =
    "mode" in value ||
    "provenance" in value ||
    "phase" in value ||
    "references" in value ||
    "salePhase" in value ||
    "ownershipTransferred" in value ||
    "priorPresentationValid" in value ||
    "priorCredentialInvalidated" in value ||
    "venueCredentialReissued" in value ||
    "externalMarketplace" in value ||
    "settlementFailure" in value ||
    "pendingSale" in value ||
    "rightEligible" in value ||
    "matchesCurrentRight" in value;
  if ("listingId" in value && deskMarker) {
    return true;
  }
  if (
    "ownershipTransferred" in value ||
    "priorPresentationValid" in value ||
    "priorCredentialInvalidated" in value ||
    "venueCredentialReissued" in value ||
    "externalMarketplace" in value ||
    "salePhase" in value ||
    "settlementFailure" in value ||
    "pendingSale" in value ||
    "rightEligible" in value ||
    "matchesCurrentRight" in value
  ) {
    return true;
  }
  if (isResalePhase(value.phase)) {
    return true;
  }
  return Array.isArray(value.references) && value.references[0] === "R01";
}

function asResale(value: Record<string, unknown>): void {
  if ("economicFinalityClaimed" in value && value.economicFinalityClaimed !== false) {
    throw new ProtocolError("Resale payload must not claim economic finality.");
  }
  if ("economic_finality_claimed" in value && value.economic_finality_claimed !== false) {
    throw new ProtocolError("Resale payload must not claim economic finality.");
  }
  if ("fundsExecuted" in value && value.fundsExecuted !== false) {
    throw new ProtocolError("Resale payload must not claim executed funds.");
  }
  if ("venueCredentialReissued" in value && value.venueCredentialReissued !== false) {
    throw new ProtocolError("Resale payload must not claim a venue credential reissue.");
  }
  if ("chainOwnerCurrent" in value && value.chainOwnerCurrent !== false) {
    throw new ProtocolError("Resale payload must not claim a chain owner.");
  }
  if ("externalMarketplace" in value && value.externalMarketplace !== "UNSUPPORTED") {
    throw new ProtocolError("Resale payload must keep the external marketplace unsupported.");
  }
  if ("externalPayment" in value && value.externalPayment !== "UNSUPPORTED") {
    throw new ProtocolError("Resale payload must keep external payment unsupported.");
  }
  if ("admissionRoutingProduction" in value && value.admissionRoutingProduction !== false) {
    throw new ProtocolError("Resale payload must not claim production admission routing.");
  }
  if (
    "amount" in value ||
    "currency" in value ||
    "gross" in value ||
    "sellerDue" in value ||
    "organizerDue" in value ||
    "platformDue" in value
  ) {
    throw new ProtocolError("Resale payload must not carry an amount or a fee split.");
  }
  const shaped =
    "listingId" in value ||
    "salePhase" in value ||
    "ownershipTransferred" in value ||
    "matchesCurrentRight" in value ||
    isResalePhase(value.phase) ||
    (Array.isArray(value.references) && value.references[0] === "R01");
  if (shaped) {
    if (value.mode !== "mock") {
      throw new ProtocolError("Resale payload must stay in mock mode.");
    }
    if (value.provenance !== RESALE_PROVENANCE) {
      throw new ProtocolError("Resale payload must stay MOCK_GATE_ONLY.");
    }
  }
  if ("phase" in value && !isResalePhase(value.phase)) {
    throw new ProtocolError("Resale phase must be a mock FSM phase.");
  }
  if ("salePhase" in value && value.salePhase !== null && !isResalePhase(value.salePhase)) {
    throw new ProtocolError("Resale phase must be a mock FSM phase.");
  }
  assertNoProductionResaleCopy(value);
}

function assertNoProductionResaleCopy(value: Record<string, unknown>): void {
  for (const key of ["note", "detail"] as const) {
    const field = value[key];
    if (typeof field !== "string") {
      continue;
    }
    if (PRODUCTION_RESALE_COPY.some((pattern) => pattern.test(field))) {
      throw new ProtocolError("Resale payload must not use production-marketplace wording.");
    }
  }
}

function isReservationPayload(value: Record<string, unknown>): boolean {
  if (
    "reservationId" in value ||
    "economicFinalityClaimed" in value ||
    "economic_finality_claimed" in value ||
    "mockSettlementCommitObserved" in value ||
    "admissionRoutingProduction" in value ||
    "chainIssued" in value ||
    "settlementGate" in value
  ) {
    return true;
  }
  if (value.provenance === RESERVATION_PROVENANCE) {
    return true;
  }
  return isReservationPhase(value.phase);
}

function asReservation(value: Record<string, unknown>): void {
  if ("economicFinalityClaimed" in value && value.economicFinalityClaimed !== false) {
    throw new ProtocolError("Reservation payload must not claim economic finality.");
  }
  if ("economic_finality_claimed" in value && value.economic_finality_claimed !== false) {
    throw new ProtocolError("Reservation payload must not claim economic finality.");
  }
  if ("reservationId" in value || isReservationPhase(value.phase)) {
    if (value.mode !== "mock") {
      throw new ProtocolError("Reservation payload must stay in mock mode.");
    }
    if (value.provenance !== RESERVATION_PROVENANCE) {
      throw new ProtocolError("Reservation payload must stay MOCK_GATE_ONLY.");
    }
  }
  if ("fundsExecuted" in value && value.fundsExecuted !== false) {
    throw new ProtocolError("Reservation payload must not claim executed funds.");
  }
  if ("chainIssued" in value && value.chainIssued !== false) {
    throw new ProtocolError("Reservation payload must not claim a chain issuance.");
  }
  if ("admissionRoutingProduction" in value && value.admissionRoutingProduction !== false) {
    throw new ProtocolError("Admission payload must not claim production routing.");
  }
  if ("externalAdmission" in value && value.externalAdmission !== "UNSUPPORTED") {
    throw new ProtocolError("Admission payload must keep external admission unsupported.");
  }
  if ("externalPayment" in value && value.externalPayment !== "UNSUPPORTED") {
    throw new ProtocolError("Reservation payload must keep external payment unsupported.");
  }
  if ("phase" in value && !isReservationPhase(value.phase)) {
    throw new ProtocolError("Reservation phase must be a mock FSM phase.");
  }
  assertNoProductionAdmissionCopy(value);
}

function isAdmissionPayload(value: Record<string, unknown>): boolean {
  return typeof value.admitted === "boolean" && ("gateId" in value || "proofMode" in value || "rightsRef" in value);
}

function asAdmission(value: Record<string, unknown>): void {
  if ("proofMode" in value && value.proofMode !== "stub" && value.proofMode !== "remote") {
    throw new ProtocolError("Admission payload proof mode must stay stub or remote.");
  }
  assertNoProductionAdmissionCopy(value);
}

function asAdmissionBoundary(value: Record<string, unknown>): void {
  if (!isAdmissionDeskState(value.deskState)) {
    throw new ProtocolError("Admission desk state is not a known label.");
  }
  if ("admissionRoutingProduction" in value && value.admissionRoutingProduction !== false) {
    throw new ProtocolError("Admission payload must not claim production routing.");
  }
  if ("externalAdmission" in value && value.externalAdmission !== "UNSUPPORTED") {
    throw new ProtocolError("Admission payload must keep external admission unsupported.");
  }
  if ("offlineAdmission" in value && value.offlineAdmission !== false) {
    throw new ProtocolError("Admission payload must not claim offline admission.");
  }
  if (value.deskState === "valid" && value.fresh !== true) {
    throw new ProtocolError("Admission payload must not mark an unfresh credential valid.");
  }
  assertNoProductionAdmissionCopy(value);
}

function assertNoProductionAdmissionCopy(value: Record<string, unknown>): void {
  for (const key of ["note", "detail"] as const) {
    const field = value[key];
    if (typeof field !== "string") {
      continue;
    }
    if (PRODUCTION_ADMISSION_COPY.some((pattern) => pattern.test(field))) {
      throw new ProtocolError("Reservation payload must not use production-admission wording.");
    }
  }
}

function readString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== "string" || field.length === 0) {
    throw new ProtocolError(`Missing string field ${key}.`);
  }
  return field;
}
