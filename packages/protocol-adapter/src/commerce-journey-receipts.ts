import { FSM_BASE_KEYS, FSM_COMMANDS, FSM_FALSE_FLAGS, FSM_NESTED_KEYS } from "./commerce-journey-fixture.js";
import { proofPaths, valueAt, type FixtureStep, type JourneyProof, type JourneyValue } from "./commerce-journey-command.js";
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

function section(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) invalid();
  return value;
}

function agree(...values: unknown[]): void {
  const [first] = values;
  if (!stringOrScalar(first) || values.some((value) => value !== first)) invalid();
}

function matchFields(body: Record<string, unknown>, view: Record<string, unknown>, fields: readonly string[]): void {
  for (const field of fields) {
    if (Object.hasOwn(body, field)) agree(view[field], body[field]);
  }
}

function verifyRelationships(value: Record<string, unknown>, action: Command, machine: Machine, body: Record<string, unknown>): void {
  if (action.endsWith("_set_clock")) return;
  switch (machine) {
    case "reservation": {
      const show = section(value.show);
      if (action === "reservation_register_show") {
        matchFields(body, show, ["show_id", "capacity", "organizer_role", "primary_price", "resale_cap", "resale_allowed", "organizer_bps", "platform_bps"]);
        if (!Array.isArray(show.gate_roles) || !Array.isArray(body.gate_roles) ||
            show.gate_roles.length !== body.gate_roles.length) invalid();
        for (const [index, role] of body.gate_roles.entries()) agree(show.gate_roles[index], role);
        return;
      }
      const reservation = section(value.reservation);
      matchFields(body, reservation, ["reservation_id", "show_id", "slot", "buyer_role", "order_id", "issuance_id", "payment_ref", "amount", "quote_ref", "expires_ms"]);
      agree(reservation.show_id, show.show_id);
      if (!Array.isArray(show.slots)) invalid();
      const slots = show.slots.filter((slot) => isRecord(slot) && slot.slot === reservation.slot);
      if (slots.length !== 1) invalid();
      const slot = section(slots[0]);
      agree(reservation.slot_state, slot.state);
      agree(reservation.slot_reservation_id, slot.reservation_id, action === "reservation_cancel" ? null : reservation.reservation_id);
      if (action === "reservation_issue") {
        const right = section(reservation.right);
        const evidence = section(value.evidence);
        agree(reservation.issuance_id, evidence.issuance_id, evidence.right_id, right.right_id, slot.right_id, reservation.slot_right_id);
        agree(reservation.show_id, right.show_id, evidence.show_id);
        agree(reservation.slot, right.slot, evidence.slot);
        agree(reservation.buyer_role, right.holder_role, evidence.holder_role);
        agree(right.version, evidence.version);
        agree(right.generation, evidence.generation);
        agree(reservation.payment_ref, evidence.payment_ref, right.last_payment);
        agree(reservation.amount, evidence.amount, right.last_amount);
        agree(reservation.quote_ref, evidence.quote_ref);
        agree(reservation.currency, evidence.currency);
      } else if (reservation.right !== null || slot.right_id !== null || reservation.slot_right_id !== null || reservation.issuance_id !== null) invalid();
      return;
    }
    case "resale": {
      const right = section(value.right);
      if (action === "resale_adopt_issued") {
        const ticket = section(value.ticket);
        matchFields(body, ticket, ["right_id", "reservation_id", "show_id", "slot"]);
        agree(body.buyer_role, ticket.holder_role, right.holder_role);
        agree(ticket.show_id, right.show_id);
        agree(ticket.slot, right.slot);
        agree(ticket.right_id, right.right_id);
        agree(ticket.version, right.version);
        agree(ticket.active_listing_id, right.listing_id, null);
        return;
      }
      const listing = section(value.listing);
      matchFields(body, listing, ["listing_id", "right_id", "version", "seller_role", "recipient_role", "buyer_role", "hold_id", "payment_ref", "settlement_id", "amount", "expires_ms"]);
      agree(listing.right_id, listing.slot_right_id, right.right_id);
      agree(listing.show_id, right.show_id);
      agree(listing.generation, right.generation);
      agree(listing.holder_role, right.holder_role);
      agree(listing.current_version, right.version);
      const transferred = action === "resale_accept_resale";
      const attached = !transferred && action !== "resale_cancel_listing";
      agree(listing.attached, attached);
      agree(right.listing_id, attached ? listing.listing_id : null);
      if (transferred) {
        const evidence = section(value.evidence);
        agree(body.transfer_id, listing.transfer_id, evidence.transfer_id);
        agree(listing.right_id, evidence.right_id);
        agree(listing.show_id, evidence.show_id);
        agree(listing.seller_role, evidence.from_role);
        agree(listing.recipient_role, evidence.to_role, right.holder_role);
        agree(listing.version_after, evidence.version_after, right.version);
        if (typeof listing.version !== "number" || !Number.isSafeInteger(listing.version)) invalid();
        agree(right.version, listing.version + 1);
        agree(listing.payment_ref, evidence.payment_ref);
        agree(listing.amount, evidence.amount);
      } else {
        agree(listing.version, right.version);
        agree(listing.transfer_id, listing.version_after, null);
      }
      return;
    }
    case "admission": {
      const credential = section(value.credential);
      const right = section(value.right);
      matchFields(body, credential, ["right_id", "reservation_id", "show_id", "slot", "holder_role", "gate_role"]);
      if (action === "admission_adopt_issued") agree(body.buyer_role, credential.holder_role);
      agree(credential.right_id, credential.slot_right_id, right.right_id);
      agree(credential.show_id, right.show_id);
      agree(credential.slot, right.slot);
      agree(credential.generation, right.generation);
      agree(credential.holder_role, right.holder_role);
      agree(credential.version, right.version);
      agree(credential.state, right.state);
      if (action === "admission_authorize_admission") {
        const admission = section(value.admission);
        matchFields(body, admission, ["admission_id", "right_id", "version", "gate_role", "request", "expires_ms"]);
        agree(admission.admission_id, credential.admission_id, right.admission_id);
        agree(admission.gate_role, credential.gate_role);
        agree(admission.version, credential.version, credential.issued_version);
      } else {
        agree(credential.admission_id, right.admission_id, null);
      }
      if (action === "admission_consume") {
        const evidence = section(value.evidence);
        matchFields(body, evidence, ["consume_id", "right_id", "request", "gate_role"]);
        agree(credential.consume_id, evidence.consume_id);
        agree(credential.show_id, evidence.show_id);
        agree(credential.issued_version, body.version);
        agree(credential.version_after, evidence.version_after, right.version);
      } else {
        agree(credential.consume_id, credential.version_after, null);
      }
      return;
    }
    case "settlement": {
      const settlement = section(value.settlement);
      matchFields(body, settlement, ["settlement_id", "trade_id", "gross", "debtor_role"]);
      const policy = section(settlement.policy);
      const policyFields = ["kind", "fee_bps", "fee_payee", "residual_payee"];
      if (action === "settlement_initiate") matchFields(section(body.policy), policy, policyFields);
      if (action === "settlement_commit") agree(body.movement_id, settlement.commit_movement_id);
      if (action === "settlement_cancel") agree(body.reason, settlement.cancel_reason);
      if (action === "settlement_fail") agree(body.reason, settlement.failure_reason);
      if (settlement.phase === "CAPTURED" || settlement.phase === "COMMITTED") {
        const claim = section(settlement.claim);
        agree(settlement.settlement_id, claim.claim_id);
        for (const field of ["trade_id", "gross", "currency", "debtor_role"]) agree(settlement[field], claim[field]);
        const claimedPolicy = section(claim.policy);
        for (const field of policyFields) agree(policy[field], claimedPolicy[field]);
      } else if (settlement.claim !== null) invalid();
      return;
    }
  }
}

/** A duplicate proves no new fact for a first-attempt operation. */
export function verifyFsmReceipt(
  value: unknown, step: FixtureStep, action: Command, body: Record<string, unknown>,
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
  if (subject === "subject_id") agree(value.logical_time_ms, body.now_ms);
  else agree(valueAt(value, identity[subject]), body[subject]);
  for (const [field, path] of Object.entries(expectation)) {
    if (valueAt(value, field) !== path) invalid();
  }
  verifyRelationships(value, action, machine, body);
  return Object.fromEntries(proofPaths(step, expectation).map((path) => {
    const observed = valueAt(value, path);
    if (!stringOrScalar(observed)) invalid();
    return [path, observed];
  }));
}
