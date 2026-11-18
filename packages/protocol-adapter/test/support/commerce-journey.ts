import { expect } from "vitest";
import { CommerceJourney, type CommerceJourneyBranch } from "../../src/commerce-journey.js";
import type { CommerceJourneyPort } from "../../src/commerce-journey-command.js";

export function journeyFor(branch: CommerceJourneyBranch, port: CommerceJourneyPort) {
  let sequence = 0;
  return new CommerceJourney(branch, port, (step) => {
    const operationId = `test-${++sequence}-${step}`;
    return { operationId, idempotencyKey: `key-${operationId}` };
  });
}

export async function exercise(branch: CommerceJourneyBranch, port: CommerceJourneyPort) {
  const journey = journeyFor(branch, port);
  const expectedErrors: Record<string, string> = {
    "hold-over-capacity": "SLOT", "hold-occupied-slot": "SLOT_OCCUPIED",
    "cancel-after-payment": "COMPENSATION_UNDEFINED", "accept-A-before-commit": "SETTLEMENT_NOT_COMMITTED",
    "issue-cancelled": "TERMINAL_IMMUTABLE", "double-consume": "ALREADY_CONSUMED",
  };
  while (true) {
    const { next, decline } = journey.state();
    if (decline) {
      expect(await journey.run(decline), decline).toMatchObject({ kind: "REJECTED", code: expectedErrors[decline] });
      expect(journey.state()).toMatchObject({ fenced: false, decline: undefined });
    }
    if (!next) break;
    expect(await journey.run(next), next).toMatchObject({ kind: "CONFIRMED" });
    const { facts } = journey.state();
    if (next === "payment-A" || next === "payment-B") {
      expect(facts).toMatchObject({ paymentObservation: { state: "OBSERVED" }, ticketIssuance: { state: "NO_EVIDENCE" },
        admission: { state: "NO_EVIDENCE" }, resale: { state: "NO_EVIDENCE" }, refundBinding: { state: "NO_EVIDENCE" }, refundAcceptance: { state: "NO_EVIDENCE" } });
    }
    if (next === "issue-A" || next === "issue-B") {
      expect(facts).toMatchObject({ ticketIssuance: { state: "ISSUED", proof: { "reservation.settlement_gate": "UNBOUND" } },
        admission: { state: "NO_EVIDENCE" }, resale: { state: "NO_EVIDENCE" } });
    }
    if (next === "authorize-B") expect(facts.admission).toMatchObject({ state: "AUTHORIZED", proof: { "credential.admission_id": "admit-B" } });
    if (next === "cancel-C") expect(facts).toMatchObject({
      reservationCancellation: { state: "CANCELLED" }, refundBinding: { state: "NO_EVIDENCE" }, refundAcceptance: { state: "NO_EVIDENCE" }, paymentObservation: { state: "NO_EVIDENCE" },
    });
    if (next === "bind-refund") expect(facts).toMatchObject({
      refundBinding: { state: "BOUND", proof: { "settlement.claim.refund_accepted": 0, "settlement.claim.legal_debtor_bound": false } },
      refundAcceptance: { state: "NO_EVIDENCE" },
    });
  }
  const { facts } = journey.state();
  if (branch === "resale") expect(facts).toMatchObject({ resale: { state: "TRANSFERRED", proof: {
    "listing.settlement_gate": "MOCK_COMMIT_OBSERVED", "evidence.version_after": 2, "evidence.seller_due": 11760,
    "evidence.organizer_due": 120, "evidence.platform_due": 120, "evidence.funds_executed": false,
  } }, admission: { state: "NO_EVIDENCE" } });
  if (branch === "admission") expect(facts).toMatchObject({
    admission: { state: "CONSUMED_ONCE", proof: { "evidence.decision": "CONSUMED_ONCE", "evidence.consume_id": "consume-B" } },
    resale: { state: "NO_EVIDENCE" },
  });
  if (branch === "refund") expect(facts).toMatchObject({
    refundBinding: { state: "BOUND", proof: { "settlement.claim.refund_accepted": 0 } },
    refundAcceptance: { state: "MOCK_ACCEPTANCE_OBSERVED", proof: { "settlement.claim.refund_accepted": 12000, "funds_executed": false } },
  });
}
