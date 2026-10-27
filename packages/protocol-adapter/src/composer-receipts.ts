import { closedResult } from "./journey-receipts.js";
import { isRecord } from "./record.js";
import { ProtocolError } from "./types.js";

/** Existing app predicates, kept independent of the composers' state machines. */
const OFFER_RESULT_KEYS = ["giftId", "termsHash"] as const;
const ACCEPT_RESULT_KEYS = ["ticketId", "owner", "rightsVersion", "financialEntries"] as const;
const CANCEL_RESULT_KEYS = ["giftState"] as const;

const CREATE_RESULT_KEYS = ["eventId", "policyHash", "inventoryIds", "reservationSeconds"] as const;
const ISSUE_RESULT_KEYS = ["ticketId", "financialEntries", "invitationsIssued"] as const;
const EVENT_STATUS_RESULT_KEYS = ["eventStatus"] as const;

const SET_RESULT_KEYS = ["allowed", "consentVersion"] as const;
const AUTHORIZE_RESULT_KEYS = [
  "authorizedAt",
  "consentVersion",
  "dispatchDecision",
  "networkSendPerformed",
] as const;

export function readAcceptGiftReceipt(receipt: Record<string, unknown>, gift: { ticketId: string; recipient: string } | null): boolean {
  if (gift === null) {
    return false;
  }
  const result = closedResult(receipt, ACCEPT_RESULT_KEYS);
  if (result === null) {
    return false;
  }
  if (result.ticketId !== gift.ticketId || result.owner !== gift.recipient) {
    return false;
  }
  if (typeof result.rightsVersion !== "number" || !Number.isInteger(result.rightsVersion)) {
    return false;
  }
  return result.financialEntries === 0;
}

export function readOfferReceipt(
  body: Record<string, unknown>,
  receipt: Record<string, unknown>,
): { termsHash: string } | null {
  const result = closedResult(receipt, OFFER_RESULT_KEYS);
  if (result === null) {
    return null;
  }
  if (typeof result.giftId !== "string" || result.giftId !== body.giftId) {
    return null;
  }
  if (typeof result.termsHash !== "string" || result.termsHash.length === 0) {
    return null;
  }
  return { termsHash: result.termsHash };
}

export function readCancelReceipt(receipt: Record<string, unknown>): boolean {
  const result = closedResult(receipt, CANCEL_RESULT_KEYS);
  return result !== null && result.giftState === "CANCELLED";
}

export function readOrganizerCreateReceipt(body: Record<string, unknown>, receipt: Record<string, unknown>): boolean {
  const result = closedResult(receipt, CREATE_RESULT_KEYS);
  if (result === null) {
    return false;
  }
  const seats = body.seats;
  if (!Array.isArray(seats)) {
    return false;
  }
  if (typeof result.eventId !== "string" || result.eventId !== body.eventId) {
    return false;
  }
  if (typeof result.policyHash !== "string" || result.policyHash.length === 0) {
    return false;
  }
  if (!Array.isArray(result.inventoryIds) || result.inventoryIds.length !== seats.length || result.inventoryIds.length === 0) {
    return false;
  }
  const inventoryIds = result.inventoryIds.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (inventoryIds.length !== seats.length) {
    return false;
  }
  return typeof result.reservationSeconds === "number" && Number.isInteger(result.reservationSeconds);
}

export function readCloseReceipt(receipt: Record<string, unknown>): boolean {
  return isRecord(receipt.result) && receipt.result.salesStatus === "CLOSED";
}

export function readOpenReceipt(receipt: Record<string, unknown>): boolean {
  const result = closedResult(receipt, ["admissionStatus"]);
  return result !== null && result.admissionStatus === "OPEN";
}

export function readIssueReceipt(receipt: Record<string, unknown>): boolean {
  if (!isRecord(receipt.result)) {
    return false;
  }
  return (
    typeof receipt.result.ticketId === "string" &&
    receipt.result.ticketId.length > 0 &&
    receipt.result.financialEntries === 0
  );
}

export function readRecordResult(receipt: Record<string, unknown>): boolean {
  return isRecord(receipt.result);
}

export function readSetReceipt(body: Record<string, unknown>, receipt: Record<string, unknown>): boolean {
  const result = closedResult(receipt, SET_RESULT_KEYS);
  if (result === null) {
    return false;
  }
  if (typeof result.allowed !== "boolean" || result.allowed !== body.allowed) {
    return false;
  }
  return typeof result.consentVersion === "number" && Number.isInteger(result.consentVersion);
}

export function readAuthorizeReceipt(input: { expectedConsentVersion: unknown }, receipt: Record<string, unknown>): boolean {
  const result = closedResult(receipt, AUTHORIZE_RESULT_KEYS);
  if (result === null) {
    return false;
  }
  if (result.dispatchDecision !== "AUTHORIZED_FIXTURE_INTENT" || result.networkSendPerformed !== false) {
    return false;
  }
  if (typeof result.authorizedAt !== "number" || !Number.isInteger(result.authorizedAt)) {
    return false;
  }
  return result.consentVersion === input.expectedConsentVersion && Number.isInteger(result.consentVersion);
}

/** Stateless HTTP check: ticket and recipient equality still requires offer context
 * and remains in readAcceptGiftReceipt. No missing-context success mode is added. */
export function readAcceptGiftStructure(receipt: Record<string, unknown>): boolean {
  const result = closedResult(receipt, ACCEPT_RESULT_KEYS);
  return result !== null && typeof result.ticketId === "string" && result.ticketId.length > 0
    && typeof result.owner === "string" && result.owner.length > 0
    && typeof result.rightsVersion === "number" && Number.isInteger(result.rightsVersion)
    && result.financialEntries === 0;
}

/** HTTP-only closure of the open issue_invitation reader to the reviewed gate's result keys. */
function readIssueResultShape(receipt: Record<string, unknown>): boolean {
  const result = closedResult(receipt, ISSUE_RESULT_KEYS);
  return result !== null && typeof result.invitationsIssued === "number" && Number.isInteger(result.invitationsIssued);
}

/** HTTP-only closure of the record-only complete_event and cancel_event readers. */
function readEventStatusShape(receipt: Record<string, unknown>, eventStatus: "COMPLETED" | "CANCELLED"): boolean {
  const result = closedResult(receipt, EVENT_STATUS_RESULT_KEYS);
  return result !== null && result.eventStatus === eventStatus;
}

export function assertComposerResult(value: unknown, input: { action: string; body: Record<string, unknown> }): void {
  if (!isRecord(value)) throw new ProtocolError("Integration gate returned an invalid composer receipt.", "GATE_STATUS");
  let valid = true;
  switch (input.action) {
    case "offer_gift": valid = readOfferReceipt(input.body, value) !== null; break;
    case "accept_gift": valid = readAcceptGiftStructure(value); break;
    case "cancel_gift": valid = readCancelReceipt(value); break;
    case "create_event": valid = readOrganizerCreateReceipt(input.body, value); break;
    // Preserve the composers' readers; HTTP additionally closes their open results
    // to the keys the reviewed gate returns. These are not SDK receipt contracts.
    case "close_sales": valid = closedResult(value, ["salesStatus"]) !== null && readCloseReceipt(value); break;
    case "open_admission": valid = readOpenReceipt(value); break;
    case "issue_invitation": valid = readIssueResultShape(value) && readIssueReceipt(value); break;
    case "complete_event": valid = readEventStatusShape(value, "COMPLETED") && readRecordResult(value); break;
    case "cancel_event": valid = readEventStatusShape(value, "CANCELLED") && readRecordResult(value); break;
    case "set_consent": valid = readSetReceipt(input.body, value); break;
    case "authorize_marketing": valid = readAuthorizeReceipt({ expectedConsentVersion: input.body.expectedConsentVersion }, value); break;
  }
  if (!valid) throw new ProtocolError("Integration gate returned an invalid composer result.", "GATE_STATUS");
}
