import type { ProtocolOptions } from "./create-protocol.js";
import type { CommerceProtocol } from "./protocol.js";
import { resolveRuntimeEnvironment } from "./runtime-env.js";
import type { SdkPinInputs } from "./sdk-pin.js";
import { StubProtocolAdapter } from "./stub-adapter.js";
import { ProtocolError } from "./types.js";

export { ProtocolError, ADMISSION_DESK_STATES, ADMISSION_PHASES } from "./types.js";
export { CREDIT_BOUNDARY } from "./surfaces.js";
export { StubProtocolAdapter } from "./stub-adapter.js";
export { resolveRuntimeEnvironment } from "./runtime-env.js";
export type { CommerceProtocol } from "./protocol.js";
export type { TransportObservation } from "./operational-error.js";
export type { LocalCallInvoker } from "./booking-journey.js";
export type { SessionStorePort } from "./session-journal.js";
export type { COMMERCE_COMMAND_BINDINGS, CommerceMethod } from "./commerce-bindings.js";

export interface ShellProtocolOptions extends ProtocolOptions {
  pinInputs?: SdkPinInputs;
}

export type ShellProtocolSelection =
  | { environment: "stub"; protocol: CommerceProtocol; ready: null }
  | { environment: "integration-http"; protocol: null; ready: Promise<CommerceProtocol> };

/** The stub shell has no dependency on the catalogue verification runtime. */
export function selectShellProtocol(options: ShellProtocolOptions = {}): ShellProtocolSelection {
  const environment = resolveRuntimeEnvironment(options.mode);
  if (environment.name === "stub") {
    return { environment: "stub", protocol: new StubProtocolAdapter(), ready: null };
  }
  const baseUrl = options.baseUrl?.trim() ?? "";
  if (!baseUrl) {
    throw new ProtocolError(
      "KIX_PROTOCOL_API_BASE is required when KIX_PROTOCOL_MODE=http. integration-http does not fall back to the stub.",
    );
  }
  return {
    environment: "integration-http",
    protocol: null,
    ready: import("./http-entry.js").then(({ createVerifiedHttpProtocol }) =>
      createVerifiedHttpProtocol({ ...options, baseUrl }),
    ),
  };
}
