import { HttpProtocolAdapter } from "./http-adapter.js";
import type { CommerceProtocol } from "./protocol.js";
import { resolveRuntimeEnvironment } from "./runtime-env.js";
import { ProtocolError } from "./types.js";
import { StubProtocolAdapter } from "./stub-adapter.js";

export interface ProtocolOptions {
  /**
   * "stub" (default), "http", or "integration-http".
   * "http" is the existing opt-in name for the integration-http environment.
   * Production and public names are refused. They do not select the stub.
   */
  mode?: string;
  /** Required for integration-http. Must be an explicit http://127.0.0.1 origin with a port. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function createProtocol(options: ProtocolOptions = {}): CommerceProtocol {
  const environment = resolveRuntimeEnvironment(options.mode);
  if (environment.name === "stub") {
    return new StubProtocolAdapter();
  }
  const baseUrl = options.baseUrl?.trim() ?? "";
  if (!baseUrl) {
    throw new ProtocolError(
      "KIX_PROTOCOL_API_BASE is required when KIX_PROTOCOL_MODE=http. integration-http does not fall back to the stub.",
    );
  }
  return new HttpProtocolAdapter(baseUrl, options.fetchImpl);
}
