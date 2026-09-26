/**
 * Maps loopback failures onto desk states.
 * None of these states retries, and none of them selects the stub.
 * A code that is not a transport outage stays a reject. The client does not
 * promote it into protocol truth or production conformance.
 */

export type TransportState = "local" | "up" | "degraded" | "unavailable";

export interface TransportObservation {
  environment: "stub" | "integration-http";
  state: TransportState;
  productionReadiness: false;
  productionConformance: false;
  protocolTruth: false;
  publicDeploy: false;
  durable: false;
  localFileJournal: boolean | null;
  fallbackToStub: false;
  retry: false;
  requestId: string | null;
  correlationId: string | null;
  code: string | null;
  detail: string;
}

export interface OperationalMapping {
  state: "degraded" | "unavailable" | "rejected";
  retry: false;
  fallbackToStub: false;
  detail: string;
}

const DEGRADED_CODES = new Set(["NOT_READY", "OVERLOADED", "CORE_BUSY", "JOURNAL_BUDGET"]);

const UNAVAILABLE_CODES = new Set([
  "GATE_UNAVAILABLE",
  "GATE_TRANSPORT",
  "GATE_STATUS",
  "REQUEST_TIMEOUT",
  "STALE_RESPONSE",
  "DURABILITY_DIVERGENCE",
  "PRODUCTION_ENDPOINT",
  "PRODUCTION_ENVIRONMENT",
  "HEADER_TOO_LARGE",
  "BODY_TOO_LARGE",
  "INTERNAL_ERROR",
  "RETRY_FORBIDDEN",
]);

export function mapOperationalError(code: string | undefined): OperationalMapping {
  const normalized = code && code.trim().length > 0 ? code : "GATE_UNAVAILABLE";
  if (DEGRADED_CODES.has(normalized)) {
    return {
      state: "degraded",
      retry: false,
      fallbackToStub: false,
      detail: `Loopback gate is degraded (${normalized}). The client does not retry and does not fall back to the stub.`,
    };
  }
  if (UNAVAILABLE_CODES.has(normalized)) {
    return {
      state: "unavailable",
      retry: false,
      fallbackToStub: false,
      detail: `Loopback gate is unavailable (${normalized}). The client does not retry and does not fall back to the stub.`,
    };
  }
  return {
    state: "rejected",
    retry: false,
    fallbackToStub: false,
    detail: `Local call was rejected (${normalized}). The client does not retry with a new operationId.`,
  };
}

export function localStubObservation(): TransportObservation {
  return {
    environment: "stub",
    state: "local",
    productionReadiness: false,
    productionConformance: false,
    protocolTruth: false,
    publicDeploy: false,
    durable: false,
    localFileJournal: null,
    fallbackToStub: false,
    retry: false,
    requestId: null,
    correlationId: null,
    code: null,
    detail: "Stub adapter. Integration HTTP is not selected. There is no public production default.",
  };
}

export function integrationHttpObservation(input: {
  state: "up" | "degraded" | "unavailable";
  code: string | null;
  requestId: string | null;
  correlationId: string | null;
  localFileJournal: boolean | null;
  detail: string;
}): TransportObservation {
  return {
    environment: "integration-http",
    state: input.state,
    productionReadiness: false,
    productionConformance: false,
    protocolTruth: false,
    publicDeploy: false,
    durable: false,
    localFileJournal: input.localFileJournal,
    fallbackToStub: false,
    retry: false,
    requestId: input.requestId,
    correlationId: input.correlationId,
    code: input.code,
    detail: input.detail,
  };
}
