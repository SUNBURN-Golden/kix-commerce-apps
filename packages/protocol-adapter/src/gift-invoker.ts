import type { LocalCallInvoker } from "./booking-journey.js";
import { HttpProtocolAdapter } from "./http-adapter.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import type { CommerceProtocol } from "./protocol.js";
import { isRecord } from "./record.js";
import { StubProtocolAdapter } from "./stub-adapter.js";
import { ProtocolError } from "./types.js";

/**
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 * Shape-only receipts for the gift desk. They are not gate receipts.
 * HttpProtocolAdapter is used as itself. This module does not build one
 * adapter from the other, and it does not attach invokeLocalCall to the stub.
 * The offer-field copy is not a gift state machine: cancel still answers
 * CANCELLED, and a second offer is not refused here.
 */
export type GiftSource = "stub-shape" | "integration-gate";

export interface GiftInvokerSource {
  source: GiftSource;
  invoker: LocalCallInvoker;
}

const COMPOSED = new Set(["offer_gift", "accept_gift", "cancel_gift"]);

interface CopiedOffer {
  ticketId: string;
  recipient: string;
}

/**
 * Copies giftId onto the offer shape and copies that offer's ticketId and
 * recipient onto a later accept shape for the same giftId. termsHash, rightsVersion,
 * and financialEntries are fixed literals. This is not kernel or receipt math.
 */
export function createStubGiftInvoker(): LocalCallInvoker {
  let sequence = 0;
  const copied = new Map<string, CopiedOffer>();
  return {
    async invokeLocalCall(input) {
      if (!isRecord(input.body)) {
        throw new ProtocolError("stub-shape gift expected an object body.");
      }
      if (!COMPOSED.has(input.action)) {
        throw new ProtocolError(`stub-shape gift does not fabricate ${input.action}.`);
      }
      sequence += 1;
      return {
        domain: PINNED_PROTOCOL_DOMAIN,
        operationId: input.operationId,
        sequence,
        action: input.action,
        result: shapeResult(input.action, input.body, copied),
      };
    },
  };
}

/**
 * Selects an invoker from the protocol that was already built.
 * A transport failure does not switch the selection.
 */
export function giftInvokerFor(protocol: CommerceProtocol): GiftInvokerSource | null {
  if (protocol instanceof HttpProtocolAdapter) {
    return { source: "integration-gate", invoker: protocol };
  }
  if (protocol instanceof StubProtocolAdapter) {
    return { source: "stub-shape", invoker: createStubGiftInvoker() };
  }
  return null;
}

function shapeResult(
  action: string,
  body: Record<string, unknown>,
  copied: Map<string, CopiedOffer>,
): Record<string, unknown> {
  if (action === "offer_gift") {
    if (typeof body.giftId === "string") {
      copied.set(body.giftId, {
        ticketId: typeof body.ticketId === "string" ? body.ticketId : "",
        recipient: typeof body.recipient === "string" ? body.recipient : "",
      });
    }
    return {
      giftId: body.giftId,
      termsHash: "terms-hash",
    };
  }
  if (action === "accept_gift") {
    const prior = typeof body.giftId === "string" ? copied.get(body.giftId) : undefined;
    return {
      ticketId: prior?.ticketId && prior.ticketId.length > 0 ? prior.ticketId : "ticket-1",
      owner: prior?.recipient && prior.recipient.length > 0 ? prior.recipient : "recipient",
      rightsVersion: 1,
      financialEntries: 0,
    };
  }
  if (action === "cancel_gift") {
    return { giftState: "CANCELLED" };
  }
  throw new ProtocolError(`stub-shape gift does not fabricate ${action}.`);
}
