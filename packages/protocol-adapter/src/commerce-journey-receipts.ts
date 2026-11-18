import { FSM_BASE_KEYS, FSM_COMMANDS, FSM_FALSE_FLAGS, FSM_NESTED_KEYS } from "./commerce-journey-fixture.js";
import { proofPaths, valueAt, type CommerceJourneyStep, type JourneyProof, type JourneyValue } from "./commerce-journey-command.js";
import { isRecord } from "./record.js";
import { ProtocolError } from "./types.js";

type Machine = keyof typeof FSM_BASE_KEYS;
type Command = keyof typeof FSM_COMMANDS;

function invalid(): never {
  throw new ProtocolError("The pinned FSM receipt could not be verified.", "INVALID_FSM_RECEIPT");
}

const FALSE_FLAGS = new Set([
  ...FSM_FALSE_FLAGS, "fundsExecuted", "production_endpoint", "production_conformance",
  "protocol_truth", "runtime_enabled", "live_money",
]);
const UNSUPPORTED = new Set(["external_payment", "external_admission", "external_marketplace"]);

export function scanFsmReceipt(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(scanFsmReceipt);
  } else if (isRecord(value)) {
    for (const [key, field] of Object.entries(value)) {
      if ((FALSE_FLAGS.has(key) && field !== false) || (UNSUPPORTED.has(key) && field !== "UNSUPPORTED") ||
          (key === "lifecycle_authority" && field !== "IN_MEMORY_FSM") ||
          (key === "provenance" && field !== "MOCK_GATE_ONLY" && field !== "MOCK_SETTLEMENT_ONLY")) invalid();
      scanFsmReceipt(field);
    }
  }
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function verifyNested(value: unknown, path: string): void {
  const keys = FSM_NESTED_KEYS[path];
  if (Array.isArray(value)) {
    if (keys) invalid();
    for (const entry of value) verifyNested(entry, `${path}[]`);
  } else if (isRecord(value)) {
    if (!keys || !exactKeys(value, keys)) invalid();
    for (const [key, entry] of Object.entries(value)) verifyNested(entry, `${path}.${key}`);
  } else if (keys && value !== null) {
    invalid();
  }
}

function stringOrScalar(value: unknown): value is JourneyValue {
  return value === null || typeof value === "string" || typeof value === "boolean" || Number.isSafeInteger(value);
}

/** A duplicate proves no new fact for a first-attempt operation. */
export function verifyFsmReceipt(
  value: unknown, step: CommerceJourneyStep, action: Command, body: Record<string, unknown>,
  expectation: JourneyProof | string,
): JourneyProof {
  if (!isRecord(value) || value.duplicate !== false || typeof expectation === "string") invalid();
  const split = action.indexOf("_");
  const machine = action.slice(0, split) as Machine;
  const [subject, extra] = FSM_COMMANDS[action];
  const expectedKeys = [...FSM_BASE_KEYS[machine], ...extra];
  if (!exactKeys(value, expectedKeys) ||
      value.applied !== action.slice(split + 1) || value.funds_executed !== false || value.external_payment !== "UNSUPPORTED" ||
      value.provenance !== (machine === "settlement" ? "MOCK_SETTLEMENT_ONLY" : "MOCK_GATE_ONLY")) invalid();

  for (const [key, entry] of Object.entries(value)) verifyNested(entry, key === "evidence" ? `${action}.evidence` : key);
  const identity: Record<string, string> = {
    reservation_id: "reservation.reservation_id", order_id: "reservation.order_id",
    issuance_id: "evidence.issuance_id", show_id: "show.show_id", settlement_id: "settlement.settlement_id",
    listing_id: "listing.listing_id", hold_id: "listing.hold_id", transfer_id: "evidence.transfer_id",
    admission_id: "admission.admission_id", consume_id: "evidence.consume_id",
    right_id: machine === "resale" ? "ticket.right_id" : "credential.right_id",
  };
  if (subject === "subject_id" ? value.logical_time_ms !== body.now_ms : valueAt(value, identity[subject]) !== body[subject]) invalid();
  for (const [field, path] of Object.entries(expectation)) {
    if (valueAt(value, field) !== path) invalid();
  }
  const linkage: Record<string, string> = {
    ...identity, right_id: machine === "resale" ? "right.right_id" : "credential.right_id",
    quote_ref: "reservation.quote_ref", gate_role: "admission.gate_role", version: "admission.version",
    amount: "reservation.amount",
  };
  for (const [field, path] of Object.entries(linkage)) {
    const observed = valueAt(value, path);
    if (field !== subject && body[field] !== undefined && observed !== undefined && observed !== body[field]) invalid();
  }
  return Object.fromEntries(proofPaths(step, expectation).map((path) => {
    const observed = valueAt(value, path);
    if (!stringOrScalar(observed)) invalid();
    return [path, observed];
  }));
}
