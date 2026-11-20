import { GateRejectedError } from "./call-outcome.js";
import { FIXTURE_PAYMENT_REF } from "./commerce-fixture-fields.js";
import { commandFor, proofPaths, type CommerceJourneyCall, type JourneyProof, type JourneyValue } from "./commerce-journey-command.js";
import type { AdmissionCaseStore } from "./admission-case.js";
import type { ReservationCaseStore } from "./reservation-case.js";
import type { ResaleCaseStore } from "./resale-case.js";
import { MARKET_FIXTURE } from "./resale-journey-fixture.js";
import type { SettlementCaseStore } from "./settlement-case.js";
import { ProtocolError, type ResaleCommandReceipt } from "./types.js";

export interface CommerceJourneyCases {
  reservation: ReservationCaseStore;
  resale: ResaleCaseStore;
  admission: AdmissionCaseStore;
  settlement: SettlementCaseStore;
  refunds: Set<string>;
  attemptedKeys: Set<string>;
}

function refuse(code: string): never {
  throw new GateRejectedError(`Fixture FSM refused the command (${code}).`, code, undefined, 422);
}

/** Adapt the fixture body to its in-memory desk store. Unsupported monetary
 * details are copied from the producer vector after the mock lifecycle check. */
export function runStubCommerceJourney(input: CommerceJourneyCall, cases: CommerceJourneyCases): JourneyProof {
  const { action, body, expectation } = commandFor(input);
  const { reservation, resale, admission, settlement, refunds, attemptedKeys } = cases;
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
  let result: ResaleCommandReceipt | undefined;
  try {
    switch (action) {
      case "reservation_set_clock": actual = { logical_time_ms: reservation.advanceClock(clock()).logicalTimeMs }; break;
      case "reservation_register_show": {
        reservation.registerShow({ idempotencyKey, showId, eventId: showId,
          slots: Array.from({ length: num("capacity") }, (_slot, index) => String(index)) },
          { resaleCap: str("resale_cap"), resaleAllowed: str("resale_allowed"), primaryPrice: str("primary_price"), showBinding: showBinding() });
        actual = { "show.show_id": reservation.viewShow(showId).showId };
        break;
      }
      case "reservation_hold": {
        const receipt = reservation.hold({ ...reservationStep, showId, slot: str("slot"), buyerRole: str("buyer_role"), expiresAt: time("expires_ms") });
        actual = { "reservation.reservation_id": receipt.reservation?.reservationId ?? null,
          "reservation.phase": receipt.reservation?.phase ?? null };
        break;
      }
      case "reservation_confirm": {
        const receipt = reservation.confirm({ ...reservationStep, orderId }, {
          amount: str("amount"), ...(body.quote_ref == null ? {} : { quoteRef: str("quote_ref") }),
        });
        actual = { "reservation.order_id": receipt.reservation?.orderId ?? null,
          "reservation.phase": receipt.reservation?.phase ?? null, "reservation.amount": receipt.reservation?.fixtureOrder?.amount ?? null,
          "reservation.quote_ref": receipt.reservation?.fixtureOrder?.quoteRef ?? null };
        break;
      }
      case "reservation_observe_payment": {
        const receipt = reservation.observePayment({ idempotencyKey, orderId, paymentRef: str("payment_ref") }, num("amount"));
        actual = { "reservation.payment_ref": receipt.reservation?.paymentRef ?? null,
          "reservation.phase": receipt.reservation?.phase ?? null };
        break;
      }
      case "reservation_issue": {
        const receipt = reservation.issue({ idempotencyKey, orderId, issuanceId: str("issuance_id") });
        actual = { "evidence.right_id": receipt.reservation?.rightId ?? null,
          "evidence.holder_role": receipt.reservation?.buyerRole ?? null, "evidence.version": 1,
          "reservation.phase": receipt.reservation?.phase ?? null };
        break;
      }
      case "reservation_cancel": {
        const receipt = reservation.cancel(reservationStep);
        actual = { "reservation.phase": receipt.reservation?.phase ?? null };
        break;
      }
      case "resale_set_clock": actual = { logical_time_ms: resale.advanceClock(clock()).logicalTimeMs }; break;
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
      case "admission_set_clock": admission.advanceClock(clock()); break;
      case "admission_adopt_issued": admission.adoptIssued({ idempotencyKey, rightId, reservationId }); break;
      case "admission_authorize_admission": {
        const receipt = admission.authorize({ ...baseAdmission(), admissionId: str("admission_id"),
          holderRole: str("holder_role"), expiresAt: time("expires_ms") });
        actual = { "credential.admission_id": receipt.credential?.admissionId ?? null,
          "admission.request": str("request"),
          "admission.gate_role": receipt.credential?.gateRole ?? null,
          "admission.version": receipt.credential?.version ?? null };
        break;
      }
      case "admission_consume": {
        const receipt = admission.consume({ ...baseAdmission(), consumeId: str("consume_id") });
        actual = { "credential.phase": receipt.credential?.phase ?? null, "evidence.consume_id": receipt.credential?.consumeId ?? null };
        break;
      }
      case "settlement_initiate": {
        const receipt = settlement.initiate({ ...settlementStep, eventId: str("trade_id") });
        actual = { "settlement.settlement_id": receipt.settlement.settlementId };
        break;
      }
      case "settlement_authorize": settlement.authorize(settlementStep); break;
      case "settlement_capture": settlement.capture(settlementStep); break;
      case "settlement_commit": settlement.commit(settlementStep); break;
      case "settlement_cancel": settlement.cancel({ ...settlementStep, reason: str("reason") }); break;
      case "settlement_fail": settlement.fail({ ...settlementStep, reason: str("reason") }); break;
      case "settlement_distribute":
        if (settlement.view(settlementId).phase !== "COMMITTED") refuse("ILLEGAL_TRANSITION");
        break;
      case "settlement_bind_refund":
        if (!["CAPTURED", "COMMITTED"].includes(settlement.view(settlementId).phase)) refuse("ILLEGAL_TRANSITION");
        refunds.add(settlementId);
        break;
      case "settlement_observe_mock_cancel_acceptance":
        if (!refunds.has(settlementId)) refuse("REFUND_NOT_BOUND");
        break;
    }
  } catch (error) {
    if (error instanceof ProtocolError && error.code) refuse(error.code === "UNKNOWN_SLOT" ? "SLOT" : error.code);
    throw error;
  }
  if (typeof expectation === "string") throw new Error("The fixture unexpectedly accepted a declined transition.");
  if (result) {
    if (result.applied !== action.slice("resale_".length) || result.duplicate !== false || result.idempotencyKey !== idempotencyKey ||
        result.fundsExecuted !== false || result.economicFinalityClaimed !== false || result.venueCredentialReissued !== false) {
      throw new Error("Unexpected stub resale receipt.");
    }
    actual = resaleProof(result);
  }
  const projected: JourneyProof = input.step.startsWith("market-") ? actual : { ...expectation, ...actual };
  if (Object.entries(expectation).some(([path, value]) => projected[path] !== value)) {
    throw new Error("Unexpected stub fixture evidence.");
  }
  return Object.fromEntries(proofPaths(input.step, expectation).map((path) => [path, projected[path]]));
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
      ...receiptFields("right", right, ["rightId", "version", "holderRole"]),
      "right.listing_id": right.activeListingId,
    }),
    ...(listing && {
      ...receiptFields("listing", listing, ["phase", "listingId", "holderRole", "currentVersion", "rightId", "sellerRole",
        "recipientRole", "transferId", "versionAfter", "attached", "version", "terminal", "ownershipTransferred", "holdId",
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
