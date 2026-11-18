import { GateRejectedError } from "./call-outcome.js";
import { commandFor, proofPaths, type CommerceJourneyCall, type JourneyProof } from "./commerce-journey-command.js";
import type { AdmissionCaseStore } from "./admission-case.js";
import type { ReservationCaseStore } from "./reservation-case.js";
import type { ResaleCaseStore } from "./resale-case.js";
import type { SettlementCaseStore } from "./settlement-case.js";
import { ProtocolError } from "./types.js";

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
  const showId = str("show_id"), reservationId = str("reservation_id"), orderId = str("order_id");
  const rightId = str("right_id"), listingId = str("listing_id"), settlementId = str("settlement_id");
  const reservationStep = { idempotencyKey, reservationId };
  const settlementStep = { idempotencyKey, settlementId };
  const baseAdmission = () => ({ idempotencyKey, rightId, version: num("version"), gateRole: str("gate_role"), request: str("request") });
  let actual: JourneyProof = {};
  try {
    switch (action) {
      case "reservation_set_clock": reservation.advanceClock(clock()); break;
      case "reservation_register_show": {
        reservation.registerShow({ idempotencyKey, showId, eventId: showId,
          slots: Array.from({ length: num("capacity") }, (_slot, index) => String(index)) });
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
        const receipt = reservation.confirm({ ...reservationStep, orderId });
        actual = { "reservation.order_id": receipt.reservation?.orderId ?? null,
          "reservation.amount": num("amount"), "reservation.quote_ref": str("quote_ref") };
        break;
      }
      case "reservation_observe_payment": {
        const receipt = reservation.observePayment({ idempotencyKey, orderId, paymentRef: str("payment_ref") });
        actual = { "reservation.payment_ref": receipt.reservation?.paymentRef ?? null,
          "reservation.phase": receipt.reservation?.phase ?? null };
        break;
      }
      case "reservation_issue": {
        const receipt = reservation.issue({ idempotencyKey, orderId, issuanceId: str("issuance_id") });
        actual = { "evidence.right_id": receipt.reservation?.rightId ?? null,
          "reservation.phase": receipt.reservation?.phase ?? null };
        break;
      }
      case "reservation_cancel": {
        const receipt = reservation.cancel(reservationStep);
        actual = { "reservation.phase": receipt.reservation?.phase ?? null };
        break;
      }
      case "resale_set_clock": resale.advanceClock(clock()); break;
      case "resale_adopt_issued": resale.adoptIssued({ idempotencyKey, rightId, showId, eventId: showId,
        reservationId, slot: str("slot"), holderRole: str("buyer_role"), paymentRef: str("payment_ref") }); break;
      case "resale_list_resale": {
        const receipt = resale.list({ idempotencyKey, listingId, rightId, reservationId, version: num("version"),
          sellerRole: str("seller_role"), recipientRole: str("recipient_role"), expiresAt: time("expires_ms") });
        actual = { "listing.listing_id": receipt.listing?.listingId ?? null };
        break;
      }
      case "resale_hold_buy": resale.holdBuy({ idempotencyKey, listingId, holdId: str("hold_id"), buyerRole: str("buyer_role") }); break;
      case "resale_observe_resale_payment": resale.observePayment({ idempotencyKey, listingId, paymentRef: str("payment_ref"), buyerRole: str("buyer_role") }); break;
      case "resale_bind_settlement": resale.bindSettlement({ idempotencyKey, listingId, settlementId }); break;
      case "resale_accept_resale": {
        const receipt = resale.acceptTransfer({ idempotencyKey, listingId, transferId: str("transfer_id") });
        actual = { "listing.phase": receipt.listing?.phase ?? null, "evidence.version_after": receipt.evidence?.versionAfter ?? null };
        break;
      }
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
  const projected: JourneyProof = { ...expectation, ...actual };
  return Object.fromEntries(proofPaths(input.step, expectation).map((path) => [path, projected[path]]));
}
