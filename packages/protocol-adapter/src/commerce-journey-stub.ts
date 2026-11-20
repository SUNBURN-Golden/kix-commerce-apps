import { GateRejectedError } from "./call-outcome.js";
import { FIXTURE_PAYMENT_REF } from "./commerce-fixture-fields.js";
import { commandFor, declaredRefusal, type CommerceJourneyCall, type JourneyProof, type JourneyValue } from "./commerce-journey-command.js";
import type { AdmissionCaseStore } from "./admission-case.js";
import type { ReservationCaseStore } from "./reservation-case.js";
import type { ResaleCaseStore } from "./resale-case.js";
import { MARKET_FIXTURE } from "./resale-journey-fixture.js";
import type { SettlementCaseStore } from "./settlement-case.js";
import { ProtocolError, type AdmissionCommandReceipt, type ReservationCommandReceipt, type ResaleCommandReceipt } from "./types.js";

export interface CommerceJourneyCases {
  reservation: ReservationCaseStore;
  resale: ResaleCaseStore;
  admission: AdmissionCaseStore;
  settlement: SettlementCaseStore;
  settlementMarkers: Map<string, "DISTRIBUTED" | "REFUND_BOUND" | "MOCK_ACCEPTANCE_OBSERVED">;
  attemptedKeys: Set<string>;
}

function refuse(code: string): never {
  throw new GateRejectedError(`Fixture FSM refused the command (${code}).`, code, undefined, 422);
}

/** Adapt the pinned fixture commands and project only observed mock evidence. */
export function runStubCommerceJourney(input: CommerceJourneyCall, cases: CommerceJourneyCases): JourneyProof {
  const { action, body, expectation } = commandFor(input);
  const { reservation, resale, admission, settlement, settlementMarkers, attemptedKeys } = cases;
  const { idempotencyKey } = input;
  if (attemptedKeys.has(idempotencyKey)) throw new Error("The stub received a duplicate attempt.");
  attemptedKeys.add(idempotencyKey);
  const str = (field: string) => String(body[field]);
  const num = (field: string) => Number(body[field]);
  const time = (field: string) => new Date(num(field)).toISOString();
  const clock = () => ({ idempotencyKey, nowAt: time("now_ms") });
  // Compare exactly the registered show fields, including the ordered gate roles.
  const showBinding = () => {
    const roles = body.gate_roles;
    if (!Array.isArray(roles)) refuse("GATES_TYPE");
    if (!roles.length) refuse("GATES_EMPTY");
    if (roles.length > 16) refuse("GATES_LIMIT");
    if (roles.some(role => typeof role !== "string" || !role || role.trim() !== role || role.length > 100)) refuse("INVALID_ID");
    if (new Set(roles).size !== roles.length) refuse("GATES_DUPLICATE");
    return JSON.stringify(Object.keys(MARKET_FIXTURE["market-show"][1]).map(field => body[field]));
  };
  const showId = str("show_id"), reservationId = str("reservation_id"), orderId = str("order_id");
  const rightId = str("right_id"), listingId = str("listing_id"), settlementId = str("settlement_id");
  const reservationStep = { idempotencyKey, reservationId };
  const settlementStep = { idempotencyKey, settlementId };
  const baseAdmission = () => ({ idempotencyKey, rightId, version: num("version"), gateRole: str("gate_role"), request: str("request") });
  let actual: JourneyProof = {};
  let result: ReservationCommandReceipt | ResaleCommandReceipt | AdmissionCommandReceipt | undefined;
  try {
    switch (action) {
      case "reservation_set_clock": result = reservation.advanceClock(clock()); break;
      case "reservation_register_show": {
        result = reservation.registerShow({ idempotencyKey, showId, eventId: showId,
          slots: Array.from({ length: num("capacity") }, (_slot, index) => String(index)) },
          { resaleCap: str("resale_cap"), resaleAllowed: str("resale_allowed"), primaryPrice: str("primary_price"), showBinding: showBinding() });
        const show = reservation.viewShow(showId);
        actual = { "show.show_id": show.showId, "show.capacity": show.slots.length };
        break;
      }
      case "reservation_hold":
        result = reservation.hold({ ...reservationStep, showId, slot: str("slot"), buyerRole: str("buyer_role"), expiresAt: time("expires_ms") });
        break;
      case "reservation_confirm":
        result = reservation.confirm({ ...reservationStep, orderId }, {
          amount: str("amount"), ...(body.quote_ref == null ? {} : { quoteRef: str("quote_ref") }),
        });
        break;
      case "reservation_observe_payment":
        result = reservation.observePayment({ idempotencyKey, orderId, paymentRef: str("payment_ref") }, num("amount"));
        break;
      case "reservation_issue": {
        result = reservation.issue({ idempotencyKey, orderId, issuanceId: str("issuance_id") });
        const issuance = reservation.fixtureIssuance(str("issuance_id"));
        actual = receiptFields("evidence", issuance, ["issuanceId", "rightId", "holderRole", "version", "generation", "chainIssued"]);
        break;
      }
      case "reservation_cancel": result = reservation.cancel(reservationStep); break;
      case "resale_set_clock": result = resale.advanceClock(clock()); break;
      case "resale_adopt_issued": {
        if (!FIXTURE_PAYMENT_REF.test(str("payment_ref"))) refuse("PAYMENT_REF");
        const binding = showBinding();
        if (body.primary_price !== body.amount) refuse("PRIMARY_PRICE_MISMATCH");
        result = resale.adoptIssued({ idempotencyKey, rightId, showId, eventId: showId,
          reservationId, slot: str("slot"), holderRole: str("buyer_role"), paymentRef: str("payment_ref") },
          { showBinding: binding, expiresAt: time("expires_ms"), orderId, amount: str("amount"),
            ...(body.quote_ref == null ? {} : { quoteRef: str("quote_ref") }) });
        break;
      }
      case "resale_list_resale":
        result = resale.list({ idempotencyKey, listingId, rightId, reservationId, version: num("version"),
          sellerRole: str("seller_role"), recipientRole: str("recipient_role"), expiresAt: time("expires_ms") }, num("amount"));
        break;
      case "resale_hold_buy":
        result = resale.holdBuy({ idempotencyKey, listingId, holdId: str("hold_id"), buyerRole: str("buyer_role") });
        break;
      case "resale_observe_resale_payment":
        result = resale.observePayment({ idempotencyKey, listingId, paymentRef: str("payment_ref"), buyerRole: str("buyer_role") }, num("amount"));
        break;
      case "resale_cancel_listing": result = resale.cancelListing({ idempotencyKey, listingId, sellerRole: str("seller_role") }); break;
      case "resale_bind_settlement": result = resale.bindSettlement({ idempotencyKey, listingId, settlementId }); break;
      case "resale_accept_resale": result = resale.acceptTransfer({ idempotencyKey, listingId, transferId: str("transfer_id") }); break;
      case "admission_set_clock": result = admission.advanceClock(clock()); break;
      case "admission_adopt_issued": result = admission.adoptIssued({ idempotencyKey, rightId, reservationId }); break;
      case "admission_authorize_admission": {
        result = admission.authorize({ ...baseAdmission(), admissionId: str("admission_id"),
          holderRole: str("holder_role"), expiresAt: time("expires_ms") });
        actual = { "admission.request": admission.acceptedRequest(rightId),
          "admission.gate_role": result.credential?.gateRole ?? null,
          "admission.version": result.credential?.version ?? null,
          "admission.admission_id": result.credential?.admissionId ?? null };
        break;
      }
      case "admission_consume":
        result = admission.consume({ ...baseAdmission(), consumeId: str("consume_id") });
        if (result.credential?.phase === "CONSUMED") actual = {
          "evidence.decision": "CONSUMED_ONCE", "evidence.consume_id": result.credential.consumeId,
          "evidence.right_id": result.credential.rightId, "evidence.version_after": result.credential.version,
        };
        break;
      case "settlement_initiate": settlement.initiate({ ...settlementStep, eventId: str("trade_id") }); break;
      case "settlement_authorize": settlement.authorize(settlementStep); break;
      case "settlement_capture": settlement.capture(settlementStep); break;
      case "settlement_commit": settlement.commit(settlementStep, str("movement_id")); break;
      case "settlement_cancel": settlement.cancel({ ...settlementStep, reason: str("reason") }); break;
      case "settlement_fail": settlement.fail({ ...settlementStep, reason: str("reason") }); break;
      case "settlement_distribute":
        if (settlement.view(settlementId).phase !== "COMMITTED" || settlementMarkers.has(settlementId)) refuse("ILLEGAL_TRANSITION");
        settlementMarkers.set(settlementId, "DISTRIBUTED");
        break;
      case "settlement_bind_refund":
        if (!["CAPTURED", "COMMITTED"].includes(settlement.view(settlementId).phase) || settlementMarkers.has(settlementId)) refuse("ILLEGAL_TRANSITION");
        settlementMarkers.set(settlementId, "REFUND_BOUND");
        break;
      case "settlement_observe_mock_cancel_acceptance":
        if (settlementMarkers.get(settlementId) !== "REFUND_BOUND") refuse("REFUND_NOT_BOUND");
        settlementMarkers.set(settlementId, "MOCK_ACCEPTANCE_OBSERVED");
        break;
    }
  } catch (error) {
    if (error instanceof ProtocolError && error.code) refuse(error.code === "UNKNOWN_SLOT" ? "SLOT" : error.code);
    throw error;
  }
  if (declaredRefusal(input.step)) throw new Error("The fixture unexpectedly accepted a declined transition.");
  if (!result) {
    const view = settlement.view(settlementId);
    return {
      ...receiptFields("settlement", view, ["settlementId", "phase", "terminal", "cancelReason", "failureReason"]),
      "settlement.trade_id": view.eventId,
      "settlement.mock_authorized": ["AUTHORIZED", "CAPTURED", "COMMITTED"].includes(view.phase),
      "settlement.commit_movement_id": view.fixtureMovementId ?? null,
      "settlement.mock_marker": settlementMarkers.get(settlementId) ?? null,
      funds_executed: view.fundsExecuted,
    };
  }
  if (result.applied !== action.slice(action.indexOf("_") + 1) || result.duplicate !== false ||
      result.idempotencyKey !== idempotencyKey || result.fundsExecuted !== false || result.economicFinalityClaimed !== false ||
      ("venueCredentialReissued" in result && result.venueCredentialReissued !== false)) {
    throw new Error("Unexpected stub commerce receipt.");
  }
  const proof: JourneyProof = { ...actual, logical_time_ms: result.logicalTimeMs, funds_executed: result.fundsExecuted,
    ...("listing" in result ? resaleProof(result) : "credential" in result ? admissionProof(result) : reservationProof(result)),
  };
  if (input.step.startsWith("market-") && typeof expectation !== "string" &&
      Object.entries(expectation).some(([path, expected]) => proof[path] !== expected)) {
    throw new Error("Unexpected stub resale evidence.");
  }
  return proof;
}

function reservationProof({ reservation }: ReservationCommandReceipt): JourneyProof {
  if (!reservation) return {};
  return {
    ...receiptFields("reservation", reservation, ["reservationId", "showId", "phase", "slotState", "buyerRole", "terminal",
      "orderId", "paymentRef", "issuanceId", "rightId", "settlementGate"]),
    "reservation.slot": Number(reservation.slot),
    "reservation.amount": reservation.fixtureOrder?.amount ?? null,
    "reservation.quote_ref": reservation.fixtureOrder?.quoteRef ?? null,
  };
}

function admissionProof({ credential, offlineAdmission, admissionRoutingProduction }: AdmissionCommandReceipt): JourneyProof {
  return {
    offline_admission: offlineAdmission, admission_routing_production: admissionRoutingProduction,
    ...(credential && receiptFields("credential", credential, ["phase", "rightId", "reservationId", "holderRole",
      "version", "admissionId", "gateRole", "consumeId", "terminal"])),
  };
}

/** Project only the named desk fields whose pinned wire names differ by casing. */
function receiptFields<K extends string>(section: string, source: Record<K, JourneyValue>, keys: K[]): JourneyProof {
  return Object.fromEntries(keys.map(key => {
    const field = key.replace(/[A-Z]/g, letter => "_" + letter.toLowerCase());
    return [section + "." + field, source[key]];
  }));
}

function resaleProof({ listing, right, evidence }: ResaleCommandReceipt): JourneyProof {
  return {
    ...(right && {
      ...receiptFields("ticket", right, ["rightId", "version", "eligible", "holderRole", "reservationId"]),
      ...receiptFields("right", right, ["rightId", "version", "holderRole", "generation"]),
      "right.listing_id": right.activeListingId,
    }),
    ...(listing && {
      ...receiptFields("listing", listing, ["phase", "listingId", "holderRole", "currentVersion", "rightId", "sellerRole",
        "recipientRole", "expired", "transferId", "versionAfter", "attached", "version", "terminal", "ownershipTransferred", "holdId",
        "buyerRole", "paymentRef", "settlementId", "settlementGate", "mockSettlementCommitObserved"]),
      "listing.amount": listing.fixtureAmount ?? null,
    }),
    ...(evidence && listing && {
      ...receiptFields("evidence", evidence, ["rightId", "fromRole", "toRole", "versionAfter", "chainOwnerCurrent", "fundsExecuted"]),
      ...receiptFields("evidence", listing, ["transferId", "paymentRef"]),
      "evidence.amount": listing.fixtureAmount ?? null,
    }),
  };
}
