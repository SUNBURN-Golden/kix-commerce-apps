import { ProtocolError } from "./types.js";

/**
 * Desk environments. Stub is the default. integration-http is the explicit
 * loopback gate. There is no public production environment in this client.
 */
export const STUB_ENVIRONMENT = "stub" as const;
export const INTEGRATION_HTTP_ENVIRONMENT = "integration-http" as const;

export type RuntimeEnvironmentName = typeof STUB_ENVIRONMENT | typeof INTEGRATION_HTTP_ENVIRONMENT;

export interface RuntimeEnvironment {
  name: RuntimeEnvironmentName;
  adapter: "stub" | "http";
  publicDeploy: false;
  productionConformance: false;
  protocolTruth: false;
}

const PUBLIC_MODES = new Set([
  "production",
  "prod",
  "public",
  "prod-public",
  "prod_public",
  "production-http",
  "live",
  "https",
]);

/**
 * Resolves the desk environment. `http` is the existing opt-in name for
 * integration-http. A public or production mode is refused. It does not
 * select the stub.
 */
export function resolveRuntimeEnvironment(mode: string | undefined): RuntimeEnvironment {
  const normalized = (mode ?? STUB_ENVIRONMENT).trim();
  const lowered = normalized.toLowerCase();
  if (PUBLIC_MODES.has(lowered)) {
    throw new ProtocolError(
      `KIX_PROTOCOL_MODE=${normalized} is not a supported environment. Public production deployment is on hold. The client will not fall back to the stub.`,
      "PRODUCTION_ENVIRONMENT",
    );
  }
  if (normalized === STUB_ENVIRONMENT || normalized === "") {
    return {
      name: STUB_ENVIRONMENT,
      adapter: "stub",
      publicDeploy: false,
      productionConformance: false,
      protocolTruth: false,
    };
  }
  if (normalized === "http" || normalized === INTEGRATION_HTTP_ENVIRONMENT) {
    return {
      name: INTEGRATION_HTTP_ENVIRONMENT,
      adapter: "http",
      publicDeploy: false,
      productionConformance: false,
      protocolTruth: false,
    };
  }
  throw new ProtocolError(
    `Unknown protocol mode: ${normalized}. Expected stub, http, or integration-http. There is no public production default.`,
  );
}
