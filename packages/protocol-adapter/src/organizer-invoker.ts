import type { LocalCallInvoker } from "./booking-journey.js";
import { HttpProtocolAdapter } from "./http-adapter.js";
import { ORGANIZER_COMPOSED } from "./organizer-console.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import type { CommerceProtocol } from "./protocol.js";
import { isRecord } from "./record.js";
import { StubProtocolAdapter } from "./stub-adapter.js";
import { ProtocolError } from "./types.js";

/**
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 * Shape-only receipts for the organizer desk. They are not gate receipts.
 * HttpProtocolAdapter is used as itself. This module does not build one
 * adapter from the other, and it does not attach invokeLocalCall to the stub.
 * Result fields are fixed literals. This is not kernel or receipt math.
 */
export type OrganizerSource = "stub-shape" | "integration-gate";

export interface OrganizerInvokerSource {
  source: OrganizerSource;
  invoker: LocalCallInvoker;
}

const COMPOSED = new Set<string>(ORGANIZER_COMPOSED);

/**
 * Echoes eventId and returns inv-<index> ids for create_event. close_sales and
 * open_admission use the pinned status literals. issue_invitation returns a
 * fixed ticket with financialEntries 0. complete_event and cancel_event return
 * an empty result so this module does not invent field names. Labelled not
 * from the gate.
 */
export function createStubOrganizerInvoker(): LocalCallInvoker {
  let sequence = 0;
  return {
    async invokeLocalCall(input) {
      if (!isRecord(input.body)) {
        throw new ProtocolError("stub-shape organizer expected an object body.");
      }
      if (!COMPOSED.has(input.action)) {
        throw new ProtocolError(`stub-shape organizer does not fabricate ${input.action}.`);
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
export function organizerInvokerFor(protocol: CommerceProtocol): OrganizerInvokerSource | null {
  if (protocol instanceof HttpProtocolAdapter) {
    return { source: "integration-gate", invoker: protocol };
  }
  if (protocol instanceof StubProtocolAdapter) {
    return { source: "stub-shape", invoker: createStubOrganizerInvoker() };
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
  if (action === "close_sales") {
    return { salesStatus: "CLOSED" };
  }
  if (action === "open_admission") {
    return { admissionStatus: "OPEN" };
  }
  if (action === "issue_invitation") {
    return { ticketId: "ticket-1", financialEntries: 0 };
  }
  if (action === "complete_event" || action === "cancel_event") {
    return {};
  }
  throw new ProtocolError(`stub-shape organizer does not fabricate ${action}.`);
}
