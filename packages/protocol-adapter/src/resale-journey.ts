import { FixtureJourney, type Fact, type MintAttempt } from "./commerce-journey.js";
import type { CommerceJourneyPort, JourneyProof } from "./commerce-journey-command.js";
import { MARKET_STEPS, type MarketStep } from "./resale-journey-fixture.js";

export interface ResaleJourneyFacts {
  listed: Fact<"LISTED">;
  paid: Fact<"PAYMENT_NOTED">;
  acceptedTransferred: Fact<"TRANSFERRED">;
  settled: { state: "NO_EVIDENCE" };
}

export class ResaleJourney extends FixtureJourney<MarketStep, ResaleJourneyFacts> {
  constructor(port: CommerceJourneyPort, mint: MintAttempt<MarketStep>) {
    super(MARKET_STEPS, { listed: { state: "NO_EVIDENCE" }, paid: { state: "NO_EVIDENCE" },
      acceptedTransferred: { state: "NO_EVIDENCE" }, settled: { state: "NO_EVIDENCE" } }, port, mint);
  }
  protected alternative(next: MarketStep | undefined) {
    return next === "market-hold" || next === "market-pay" ? "market-cancel" : undefined;
  }
  protected recordFact(step: MarketStep, proof: JourneyProof) {
    if (step === "market-list") this.facts.listed = { state: "LISTED", proof };
    if (step === "market-pay") this.facts.paid = { state: "PAYMENT_NOTED", proof };
    if (step === "market-accept") this.facts.acceptedTransferred = { state: "TRANSFERRED", proof };
  }
}

// Point vector get_settlement("settle-1"), and the separate B5 claim-2 example
// in reference/booking_resale_admission/README.md. Neither belongs to list-1.
export const SETTLEMENT_EXAMPLE = { settlement_id: "settle-1", phase: "COMMITTED", funds_executed: false,
  provenance: "MOCK_SETTLEMENT_ONLY", refund_bearer_policy: "NONE" } as const;
export const PARTIAL_REFUND_EXAMPLE = { claim_id: "claim-2", refund_bearer_policy: "REQUESTER", refund_face: 4000 } as const;
