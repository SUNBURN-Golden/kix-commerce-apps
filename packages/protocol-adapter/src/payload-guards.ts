import { isRecord } from "./record.js";
import { SURFACES } from "./surfaces.js";
import {
  isSettlementPhase,
  ProtocolError,
  SETTLEMENT_PROVENANCE,
  type Booking,
  type SettlementPreview,
} from "./types.js";

const CREDIT_KEYS = ["disburseCredit", "creditDisbursement", "disburse"] as const;

/**
 * Fail-closed checks for any payload this client is willing to treat as a
 * booking or a settlement preview. Catalogue receipts without those fields
 * pass through. HTTP status is not a transport contract.
 */
export function enforceRemotePayloadGuards(value: unknown): void {
  scan(value);
  if (isRecord(value) && "result" in value) {
    scan(value.result);
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
  if (value.action === "disburse" || value.action === "disburseCredit") {
    throw new ProtocolError("This client does not disburse credit.");
  }
  if ("payment" in value && value.payment !== "simulated-no-funds") {
    throw new ProtocolError("This client only accepts simulated-no-funds bookings.");
  }
  if ("bookingId" in value && "payment" in value) {
    asBooking(value);
  }
  if ("mode" in value && "references" in value) {
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

function readString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== "string" || field.length === 0) {
    throw new ProtocolError(`Missing string field ${key}.`);
  }
  return field;
}
