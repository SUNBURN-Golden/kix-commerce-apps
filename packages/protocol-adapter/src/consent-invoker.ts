import type { LocalCallInvoker } from "./booking-journey.js";
import { CONSENT_COMPOSED } from "./consent-bind.js";
import { HttpProtocolAdapter } from "./http-adapter.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import type { CommerceProtocol } from "./protocol.js";
import { isRecord } from "./record.js";
import { StubProtocolAdapter } from "./stub-adapter.js";
import { ProtocolError } from "./types.js";

/**
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 * Shape-only receipts for the consent desk. They are not gate receipts.
 * HttpProtocolAdapter is used as itself. This module does not build one
 * adapter from the other, and it does not attach invokeLocalCall to the stub.
 * consentVersion on set_consent is the fixed literal 1. authorize_marketing
 * copies expectedConsentVersion. Neither step adds one.
 */
export type ConsentSource = "stub-shape" | "integration-gate";

export interface ConsentInvokerSource {
  source: ConsentSource;
  invoker: LocalCallInvoker;
}

const COMPOSED = new Set<string>(CONSENT_COMPOSED);

/**
 * Returns the two consent result shapes and refuses every other action.
 * allowed is copied. consentVersion on set_consent stays the literal 1.
 * authorize_marketing copies expectedConsentVersion and uses the literals
 * AUTHORIZED_FIXTURE_INTENT, authorizedAt 0, and networkSendPerformed false.
 */
export function createStubConsentInvoker(): LocalCallInvoker {
  let sequence = 0;
  return {
    async invokeLocalCall(input) {
      if (!isRecord(input.body)) {
        throw new ProtocolError("stub-shape consent expected an object body.");
      }
      if (!COMPOSED.has(input.action)) {
        throw new ProtocolError(`stub-shape consent does not fabricate ${input.action}.`);
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
export function consentInvokerFor(protocol: CommerceProtocol): ConsentInvokerSource | null {
  if (protocol instanceof HttpProtocolAdapter) {
    return { source: "integration-gate", invoker: protocol };
  }
  if (protocol instanceof StubProtocolAdapter) {
    return { source: "stub-shape", invoker: createStubConsentInvoker() };
  }
  return null;
}

function shapeResult(action: string, body: Record<string, unknown>): Record<string, unknown> {
  if (action === "set_consent") {
    return {
      allowed: body.allowed === true,
      consentVersion: 1,
    };
  }
  if (action === "authorize_marketing") {
    const version = body.expectedConsentVersion;
    return {
      authorizedAt: 0,
      consentVersion: typeof version === "number" && Number.isInteger(version) ? version : 1,
      dispatchDecision: "AUTHORIZED_FIXTURE_INTENT",
      networkSendPerformed: false,
    };
  }
  throw new ProtocolError(`stub-shape consent does not fabricate ${action}.`);
}
