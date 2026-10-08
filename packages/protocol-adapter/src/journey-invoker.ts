import type { LocalCallInvoker } from "./booking-journey.js";
import { HttpProtocolAdapter } from "./http-adapter.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import type { CommerceProtocol } from "./protocol.js";
import { isRecord } from "./record.js";
import { StubProtocolAdapter } from "./stub-adapter.js";
import { ProtocolError } from "./types.js";

/**
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 * Shape-only receipts for the stub desk. They are not gate receipts.
 * HttpProtocolAdapter is used as itself. This module does not build one
 * adapter from the other, and it does not attach invokeLocalCall to the stub.
 */
export type JourneySource = "stub-shape" | "integration-gate";

export interface JourneyInvokerSource {
  source: JourneySource;
  invoker: LocalCallInvoker;
}

const COMPOSED = new Set(["create_event", "prepare_trade", "accept_trade"]);

/**
 * Copies eventId and tradeId, indexes inventory ids by seat, and fills the
 * other receipt fields with fixed literals. Sequence is a counter. This is
 * not kernel, settlement, or receipt math.
 */
export function createStubJourneyInvoker(): LocalCallInvoker {
  let sequence = 0;
  return {
    async invokeLocalCall(input) {
      if (!isRecord(input.body)) {
        throw new ProtocolError("stub-shape journey expected an object body.");
      }
      if (!COMPOSED.has(input.action)) {
        throw new ProtocolError(`stub-shape journey does not fabricate ${input.action}.`);
      }
      sequence += 1;
      return {
        domain: PINNED_PROTOCOL_DOMAIN,
        operationId: input.operationId,
        sequence,
        action: input.action,
        result: shapeResult(input.action, input.body),
      };
    },
  };
}

/**
 * Selects an invoker from the protocol that was already built.
 * A transport failure does not switch the selection.
 */
export function journeyInvokerFor(protocol: CommerceProtocol): JourneyInvokerSource | null {
  if (protocol instanceof HttpProtocolAdapter) {
    return { source: "integration-gate", invoker: protocol };
  }
  if (protocol instanceof StubProtocolAdapter) {
    return { source: "stub-shape", invoker: createStubJourneyInvoker() };
  }
  return null;
}

function shapeResult(action: string, body: Record<string, unknown>): Record<string, unknown> {
  if (action === "create_event") {
    const seats = Array.isArray(body.seats) ? body.seats : [];
    return {
      eventId: body.eventId,
      policyHash: "policy-hash",
      inventoryIds: seats.map((_, index) => `inv-${index}`),
      reservationSeconds: 900,
    };
  }
  if (action === "prepare_trade") {
    return {
      tradeId: body.tradeId,
      ticketId: "ticket-1",
      externalOrderId: "order-1",
      status: "PREPARED",
      termsHash: "terms-hash",
    };
  }
  if (action === "accept_trade") {
    return { accepted: true };
  }
  throw new ProtocolError(`stub-shape journey does not fabricate ${action}.`);
}
