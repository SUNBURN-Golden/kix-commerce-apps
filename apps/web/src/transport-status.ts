import type { TransportObservation } from "@kix/protocol-adapter";
import { makeTranslate, type Translate } from "./i18n/translate";
import { DEFAULT_LOCALE } from "./i18n/locales";

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
  t: Translate = makeTranslate(DEFAULT_LOCALE),
): { state: string; text: string } {
  if (environment === "stub") {
    return {
      state: "local",
      text: t("transport.stub"),
    };
  }
  if (!observation) {
    return {
      state: "checking",
      text: t("transport.checking"),
    };
  }
  const trace = observation.requestId ? ` ${t("transport.request", { requestId: observation.requestId })}` : "";
  if (observation.state === "degraded" || observation.state === "unavailable") {
    return {
      state: observation.state,
      text: `${observation.detail} ${t("transport.staysHttp")}${trace}`,
    };
  }
  return {
    state: observation.state,
    text: `${observation.detail}${trace}`,
  };
}
