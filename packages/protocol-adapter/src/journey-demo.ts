import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import { ProtocolError } from "./types.js";
import type { JourneyLocalCaller, PrimarySeatJourneyInput } from "./journey-adapter.js";
import type { LocalCallInput } from "./local-call.js";

/** Scripted UI fixtures only. No inventory, money, expiry or protocol math. */
export const JOURNEY_DEMO_SCENARIOS = ["success", "response-loss", "rejected", "stale", "malformed"] as const;
export type JourneyDemoScenario = (typeof JOURNEY_DEMO_SCENARIOS)[number];

export function journeyDemoInput(eventId: string): PrimarySeatJourneyInput {
  return {
    operationIds: { createEvent: "demo-create", prepareTrade: "demo-prepare", acceptTrade: "demo-accept" },
    eventId, organizer: "demo-organizer", buyer: "demo-buyer", tradeId: "demo-trade",
    seats: ["A1", "A2"],
    policy: { primaryPrice: 100000, resaleCap: 150000, primaryFeeBps: 500,
      resaleFeeBps: 300, resaleOrganizerBps: 200, resaleAllowed: true,
      refundProfile: "FULL_CHAIN_UNWIND_FIXTURE" },
  };
}

/** A fresh, single-use script for each explicitly selected simulation. */
export function createJourneyDemoCaller(scenario: JourneyDemoScenario): {
  caller: JourneyLocalCaller; calls: LocalCallInput[];
} {
  const calls: LocalCallInput[] = [];
  const actions = ["create_event", "prepare_trade", "accept_trade"];
  const caller: JourneyLocalCaller = {
    async invokeLocalCall(input) {
      if (input.action !== actions[calls.length]) {
        throw new Error("The demo does not accept retries or additional writes.");
      }
      calls.push(input);
      if (input.action === "prepare_trade") {
        if (scenario === "response-loss") throw new ProtocolError("Simulated response loss after effect.", "GATE_UNAVAILABLE");
        if (scenario === "rejected") throw new ProtocolError("Simulated price rejection.", "PRIMARY_PRICE_MISMATCH");
        if (scenario === "stale") throw new ProtocolError("Simulated mismatched correlation.", "STALE_RESPONSE");
        if (scenario === "malformed") return { incomplete: true };
      }
      const body = input.body as Record<string, unknown>;
      const result = input.action === "create_event"
        ? { eventId: body.eventId, policyHash: "a".repeat(64), inventoryIds: ["demo-inventory-a1", "demo-inventory-a2"], reservationSeconds: 900 }
        : input.action === "prepare_trade"
          ? { tradeId: body.tradeId, ticketId: "demo-ticket-reference", externalOrderId: "demo-order", status: "PREPARED", termsHash: "b".repeat(64) }
          : { accepted: true };
      return { domain: PINNED_PROTOCOL_DOMAIN, operationId: input.operationId,
        sequence: calls.length, action: input.action, result };
    },
  };
  return { caller, calls };
}
