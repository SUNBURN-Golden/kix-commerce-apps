import { ProtocolError } from "./types.js";

/**
 * Integration HTTP sends each local call once.
 * The protocol identity is envelope.operationId. An HTTP Idempotency-Key is
 * not a retry license. A new operationId would be a new effect, so this
 * client does not retry, including when the command is not idempotent.
 */
export const INTEGRATION_HTTP_RETRY_POLICY = {
  environment: "integration-http" as const,
  maxAttempts: 1 as const,
  automaticRetries: 0 as const,
  retryNonIdempotent: false as const,
  httpIdempotencyKeyHeader: false as const,
  identity: "envelope.operationId" as const,
  conflict: "OPERATION_ID_CONFLICT" as const,
};

export function rejectRetryHeader(headers: Headers): void {
  if (headers.has("Idempotency-Key")) {
    throw new ProtocolError(
      "HTTP Idempotency-Key is not the local-call identity. This client does not retry with that header.",
      "RETRY_FORBIDDEN",
    );
  }
}

export function assertSingleAttempt(attempt: number): void {
  if (INTEGRATION_HTTP_RETRY_POLICY.maxAttempts !== 1 || INTEGRATION_HTTP_RETRY_POLICY.automaticRetries !== 0) {
    throw new ProtocolError("Integration HTTP retry policy must stay a single attempt.", "RETRY_FORBIDDEN");
  }
  if (INTEGRATION_HTTP_RETRY_POLICY.retryNonIdempotent !== false || INTEGRATION_HTTP_RETRY_POLICY.httpIdempotencyKeyHeader !== false) {
    throw new ProtocolError("Integration HTTP must not retry non-idempotent calls or invent an Idempotency-Key.", "RETRY_FORBIDDEN");
  }
  if (!Number.isInteger(attempt) || attempt !== 1) {
    throw new ProtocolError(
      "Integration HTTP sends each local call once. Automatic retry is not defined, including for non-idempotent commands.",
      "RETRY_FORBIDDEN",
    );
  }
}
