import type { TransportObservation } from "@kix/protocol-adapter";

export interface HeldObservation {
  generation: number;
  observation: TransportObservation;
}

/**
 * Drops a response that belongs to an older probe. A late reply must not
 * replace a newer unavailable or degraded state.
 */
export function preferFresh(current: HeldObservation | null, incoming: HeldObservation): HeldObservation {
  if (current && incoming.generation < current.generation) {
    return current;
  }
  return incoming;
}

export function transportBannerText(
  environment: "stub" | "integration-http",
  observation: TransportObservation | null,
): { state: string; text: string } {
  if (environment === "stub") {
    return {
      state: "local",
      text: "Integration HTTP is not selected. A failed gate does not switch this desk, and HTTP mode does not fall back to the stub.",
    };
  }
  if (!observation) {
    return {
      state: "checking",
      text: "Environment integration-http. Loopback status is not loaded yet. Not production readiness.",
    };
  }
  const trace = observation.requestId ? ` Request ${observation.requestId}.` : "";
  if (observation.state === "degraded" || observation.state === "unavailable") {
    return {
      state: observation.state,
      text: `${observation.detail} The desk stays on integration HTTP.${trace}`,
    };
  }
  return {
    state: observation.state,
    text: `${observation.detail}${trace}`,
  };
}
