import { HttpProtocolAdapter } from "./http-adapter.js";
import type { CommerceProtocol } from "./protocol.js";
import { ProtocolError } from "./types.js";
import { StubProtocolAdapter } from "./stub-adapter.js";

export interface ProtocolOptions {
  /** "stub" (default) or "http". */
  mode?: string;
  /** Required when mode is http. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function createProtocol(options: ProtocolOptions = {}): CommerceProtocol {
  const mode = options.mode ?? "stub";
  if (mode === "stub" || mode === "") {
    return new StubProtocolAdapter();
  }
  if (mode === "http") {
    const baseUrl = options.baseUrl?.trim() ?? "";
    if (!baseUrl) {
      throw new ProtocolError("KIX_PROTOCOL_API_BASE is required when KIX_PROTOCOL_MODE=http.");
    }
    return new HttpProtocolAdapter(baseUrl, options.fetchImpl);
  }
  throw new ProtocolError(`Unknown protocol mode: ${mode}`);
}
