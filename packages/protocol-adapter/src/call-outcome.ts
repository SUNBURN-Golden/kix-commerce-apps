import { ProtocolError } from "./types.js";

/**
 * A validated integration-gate rejection: HTTP 400 or 422 with an object body,
 * `rejected: true`, and a nonblank error code. Other failures stay a plain ProtocolError,
 * so a gate-supplied `error` string cannot be mistaken for a transport code.
 */
export class GateRejectedError extends ProtocolError {
  readonly status: number;

  constructor(
    message: string,
    code: string | undefined,
    trace: { requestId: string; correlationId: string } | undefined,
    status: number,
  ) {
    super(message, code, trace);
    this.name = "GateRejectedError";
    this.status = status;
  }
}

interface ThrownClass {
  disposition: "not-sent" | "rejected" | "unknown";
  code: string;
  requestId?: string;
  correlationId?: string;
}

export function classifyThrown(error: unknown): ThrownClass {
  if (error instanceof GateRejectedError) {
    return {
      disposition: "rejected",
      code: error.code ?? "GATE_REJECTED",
      requestId: error.requestId,
      correlationId: error.correlationId,
    };
  }
  if (error instanceof ProtocolError && error.requestId === undefined && error.correlationId === undefined) {
    return { disposition: "not-sent", code: error.code ?? "NOT_SENT" };
  }
  const code = error instanceof ProtocolError && error.code ? error.code : "UNKNOWN";
  return {
    disposition: "unknown",
    code,
    requestId: error instanceof ProtocolError ? error.requestId : undefined,
    correlationId: error instanceof ProtocolError ? error.correlationId : undefined,
  };
}
