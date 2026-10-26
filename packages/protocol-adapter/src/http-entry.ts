import { HttpProtocolAdapter } from "./http-adapter.js";
import { assertIntegrationGateRaw } from "./integration-gate-pin.js";
import { assertOpenApiContractRaw } from "./openapi-contract-pin.js";
import { collectSdkPinErrors, requireSdkPin, VENDORED_SDK_PIN_INPUTS, type SdkPinInputs } from "./sdk-pin.js";
import { ProtocolError } from "./types.js";

/** Importing this module also preserves both OpenAPI modules' load-time assertions. */
export function verifyLazyPins(inputs: SdkPinInputs = VENDORED_SDK_PIN_INPUTS) {
  const errors = collectSdkPinErrors(inputs);
  if (errors.length > 0) throw new ProtocolError(`SDK pin check failed: ${errors.join("; ")}`);
  assertOpenApiContractRaw(inputs.contractOnlyOpenApiRaw);
  assertIntegrationGateRaw(inputs.integrationGateOpenApiRaw);
  return requireSdkPin();
}

export function createVerifiedHttpProtocol(options: { baseUrl: string; fetchImpl?: typeof fetch; pinInputs?: SdkPinInputs }) {
  verifyLazyPins(options.pinInputs);
  return new HttpProtocolAdapter(options.baseUrl, options.fetchImpl);
}
