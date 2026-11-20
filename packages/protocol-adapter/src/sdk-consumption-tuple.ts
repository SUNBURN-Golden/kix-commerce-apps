import { OPENAPI_INTEGRATION_GATE_PIN } from "./integration-gate-pin.js";
import { OPENAPI_CONTRACT_PIN } from "./openapi-contract-pin.js";
import { requireSdkPin, VENDORED_SDK_PIN_INPUTS } from "./sdk-pin.js";
import { ProtocolError } from "./types.js";

/** Consumed BOOTSTRAP evidence; grants catalogue-schema binding only. */
export interface SdkConsumptionDigests {
  readonly sdkDigest: string;
  readonly manifestDigest: string;
  readonly vectorDigest: string;
}

const pin = requireSdkPin();
if (pin.producerMergeSha !== OPENAPI_CONTRACT_PIN.protocolMainSha ||
    pin.producerMergeSha !== OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha) {
  throw new ProtocolError("The SDK and OpenAPI pins must consume the same protocol merge.");
}
// requireSdkPin gates these bytes through the existing load-time assertSdkPin.
const manifest = JSON.parse(VENDORED_SDK_PIN_INPUTS.manifestRaw) as {
  vectors: readonly { name: string; sha256: string }[];
};

/** Keep manifest order and the existing handoff representation; no aggregate hash. */
export const KIX_SDK_0_CONSUMPTION_DIGESTS: SdkConsumptionDigests = Object.freeze({
  sdkDigest: pin.catalogueSha256,
  manifestDigest: pin.manifestSha256,
  vectorDigest: manifest.vectors.map((vector) => `${vector.name}:${vector.sha256}`).join(" "),
});
