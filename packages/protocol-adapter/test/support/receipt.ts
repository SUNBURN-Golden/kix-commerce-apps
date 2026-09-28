import { PINNED_PROTOCOL_DOMAIN } from "../../src/index.js";

/**
 * The published Core receipt shape the gate returns on success. Tests wrap a
 * payload in it so the guards see the payload where the gate would put it.
 */
export function localCallReceipt(operationId: string, action: string, result: Record<string, unknown>) {
  return { domain: PINNED_PROTOCOL_DOMAIN, operationId, sequence: 1, action, result };
}
