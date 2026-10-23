import { isRecord } from "./record.js";
import { ProtocolError } from "./types.js";

/** Share the journey's existing shape checks at the HTTP receipt boundary.
 * Other catalogue actions retain their existing envelope-only validation.
 */
export function assertJourneyResult(value: unknown, input: { action: string; body: Record<string, unknown> }): void {
  const valid = isRecord(value) && (input.action === "create_event" ? readCreateReceipt(input.body, value) !== null
    : input.action === "prepare_trade" ? readPrepareReceipt(input.body, value) !== null
    : input.action === "accept_trade" ? readAcceptReceipt(value) : true);
  if (!valid) throw new ProtocolError("Integration gate returned an invalid journey result.", "GATE_STATUS");
}

/** Existing app journey result shapes; not generated SDK semantic validation. */
const CREATE_RESULT_KEYS = ["eventId", "policyHash", "inventoryIds", "reservationSeconds"] as const;
const PREPARE_RESULT_KEYS = ["tradeId", "ticketId", "externalOrderId", "status", "termsHash"] as const;
const ACCEPT_RESULT_KEYS = ["accepted"] as const;

export interface CreatedEvent {
  eventId: string;
  primaryPrice: unknown;
  inventoryIds: string[];
}

export interface PreparedTrade {
  tradeId: string;
  termsHash: string;
  buyer: string;
}

export function readCreateReceipt(body: Record<string, unknown>, receipt: Record<string, unknown>): CreatedEvent | null {
  const result = closedResult(receipt, CREATE_RESULT_KEYS);
  if (result === null) {
    return null;
  }
  const seats = body.seats;
  if (!Array.isArray(seats)) {
    return null;
  }
  if (typeof result.eventId !== "string" || result.eventId !== body.eventId) {
    return null;
  }
  if (typeof result.policyHash !== "string" || result.policyHash.length === 0) {
    return null;
  }
  if (!Array.isArray(result.inventoryIds) || result.inventoryIds.length !== seats.length || result.inventoryIds.length === 0) {
    return null;
  }
  const inventoryIds = result.inventoryIds.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (inventoryIds.length !== seats.length) {
    return null;
  }
  if (typeof result.reservationSeconds !== "number" || !Number.isInteger(result.reservationSeconds)) {
    return null;
  }
  const policy = body.policy;
  return {
    eventId: result.eventId,
    primaryPrice: isRecord(policy) ? policy.primaryPrice : undefined,
    inventoryIds,
  };
}

export function readPrepareReceipt(body: Record<string, unknown>, receipt: Record<string, unknown>): PreparedTrade | null {
  const result = closedResult(receipt, PREPARE_RESULT_KEYS);
  if (result === null) {
    return null;
  }
  if (typeof result.tradeId !== "string" || result.tradeId !== body.tradeId || result.status !== "PREPARED") {
    return null;
  }
  if (typeof result.ticketId !== "string" || result.ticketId.length === 0) {
    return null;
  }
  if (typeof result.externalOrderId !== "string" || result.externalOrderId.length === 0) {
    return null;
  }
  if (typeof result.termsHash !== "string" || result.termsHash.length === 0) {
    return null;
  }
  if (typeof body.buyer !== "string" || body.buyer.length === 0) {
    return null;
  }
  return { tradeId: result.tradeId, termsHash: result.termsHash, buyer: body.buyer };
}

export function readAcceptReceipt(receipt: Record<string, unknown>): boolean {
  const result = closedResult(receipt, ACCEPT_RESULT_KEYS);
  return result !== null && result.accepted === true;
}

export function closedResult(
  receipt: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> | null {
  if (!isRecord(receipt.result) || !sameKeys(receipt.result, keys)) {
    return null;
  }
  return receipt.result;
}

export function sameKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

