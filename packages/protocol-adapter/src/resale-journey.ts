export { canCancelBefore, ResaleJourney, type ResaleJourneyFacts } from "./commerce-journey.js";

// Point vector get_settlement("settle-1"), and the separate B5 claim-2 example
// in reference/booking_resale_admission/README.md. Neither belongs to list-1.
export const SETTLEMENT_EXAMPLE = { settlement_id: "settle-1", phase: "COMMITTED", funds_executed: false,
  provenance: "MOCK_SETTLEMENT_ONLY", refund_bearer_policy: "NONE" } as const;
export const PARTIAL_REFUND_EXAMPLE = { claim_id: "claim-2", refund_bearer_policy: "REQUESTER", refund_face: 4000 } as const;
