import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/** Ordered, app-internal inputs. No runtime configuration participates. */
export const PIN_DIGEST_FIELDS = [
  ["OPENAPI_CONTRACT_PIN", ["protocolMainSha", "openApiFileSha256", "infoVersion", "sourceProtocolContractSha256"]],
  ["OPENAPI_INTEGRATION_GATE_PIN", ["protocolMergeSha", "protocolFeatureSha", "openApiFileSha256", "infoVersion", "sourceProtocolContractSha256"]],
  ["KIX_SDK_0_PIN", ["producerMergeSha", "producerHeadSha", "producerProvenanceSha256", "producerSourceSha256", "manifestSha256", "sidecarSha256", "profileSha256", "catalogueSha256", "generatorSha256", "clientSha256", "jsonschemaSha256", "manifestHelperSha256", "sdkPinFileSha256", "verifierSha256"]],
] as const;
const sources = ["openapi-contract-pin", "integration-gate-pin", "sdk-pin"];

export function computeBuildIdentity() {
  const values: Record<string, Record<string, string>> = {};
  const fields = PIN_DIGEST_FIELDS.flatMap(([name, keys], index) => {
    const source = readFileSync(new URL(`../../packages/protocol-adapter/src/${sources[index]}.ts`, import.meta.url), "utf8");
    const blocks = [...source.matchAll(new RegExp(String.raw`export const ${name} = \{([\s\S]*?)\} as const;`, "g"))];
    if (blocks.length !== 1) throw new Error(`Ambiguous pin ${name}`);
    values[name] = {};
    return keys.map((key) => {
      const matches = [...blocks[0][1].matchAll(new RegExp(`\\b${key}:\\s*"([^"']+)"`, "g"))];
      if (matches.length !== 1) throw new Error(`Missing or duplicate ${name}.${key}`);
      const value = matches[0][1];
      values[name][key] = value;
      return [name, key, value];
    });
  });
  const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
  return {
    appVersion: version,
    pinDigestAlgorithm: "sha256" as const,
    pinDigest: createHash("sha256").update(JSON.stringify(fields)).digest("hex"),
    pins: {
      contractOnlyOpenApiSha256: values.OPENAPI_CONTRACT_PIN.openApiFileSha256,
      integrationGateOpenApiSha256: values.OPENAPI_INTEGRATION_GATE_PIN.openApiFileSha256,
      sdk0ManifestSha256: values.KIX_SDK_0_PIN.manifestSha256,
      sdk0CatalogueSha256: values.KIX_SDK_0_PIN.catalogueSha256,
    },
  };
}
