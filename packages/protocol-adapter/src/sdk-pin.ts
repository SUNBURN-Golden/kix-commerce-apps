import manifestRaw from "../vendor/kix-sdk-0/compat/manifests/manifest.bootstrap-2.json?raw";
import sidecarRaw from "../vendor/kix-sdk-0/compat/manifests/manifest.bootstrap-2.json.sha256?raw";
import profileRaw from "../vendor/kix-sdk-0/compat/profiles/bootstrap-2.profile.json?raw";
import verifierRaw from "../vendor/kix-sdk-0/compat/verify_compat.mjs?raw";
import canonicalVectorsRaw from "../vendor/kix-sdk-0/conformance/vectors/canonical-encoding.vectors.json?raw";
import mixedVectorsRaw from "../vendor/kix-sdk-0/conformance/vectors/mixed-input.vectors.json?raw";
import generatorRaw from "../vendor/kix-sdk-0/generate/generate_client.mjs?raw";
import catalogueRaw from "../vendor/kix-sdk-0/generated/catalogue.ts?raw";
import sdkPinFileRaw from "../vendor/kix-sdk-0/sdk-pin.json?raw";
import producerProvenanceRaw from "../vendor/kix-sdk-0/producer-provenance.json?raw";
import clientRaw from "../vendor/kix-sdk-0/src/client.ts?raw";
import jsonschemaRaw from "../vendor/kix-sdk-0/src/jsonschema.ts?raw";
import manifestHelperRaw from "../vendor/kix-sdk-0/src/manifest.ts?raw";
import contractOnlyOpenApiRaw from "../vendor/kix-protocol.contract-only.openapi.json?raw";
import integrationGateOpenApiRaw from "../vendor/kix-protocol.integration-gate.openapi.json?raw";
import {
  ACTION_BODY_MAP,
  COMMAND_SCHEMAS,
  COMMANDS,
  ENVELOPE_REQUIRED,
  OPENAPI_PIN,
} from "#kix-sdk-0/catalogue";
import {
  StrictJsonError,
  canonicalStringify,
  compareCodePoints,
  parseStrict,
} from "#kix-sdk-0/jsonschema";
import { OPENAPI_INTEGRATION_GATE_PIN } from "./integration-gate-pin.js";
import {
  LOCAL_CALL_PARAMETER_NAMES,
  OPENAPI_CONTRACT_PIN,
  PINNED_PROTOCOL_DOMAIN,
} from "./openapi-contract-pin.js";
import { isRecord } from "./record.js";
import { sha256Hex } from "./sha256.js";
import { gitBlobId } from "./sha1.js";
import { ProtocolError } from "./types.js";

/**
 * Vendored p-sdk-0 tuple pin from SUNBURN-Golden/kix-protocol.
 * PR #433 introduced the bootstrap-2 SDK at 19cdc1c. The consumed checkout is
 * PR #448's merge at 8ba7f6c, and the provenance record binds both separately.
 * The consumed tuple is the manifest-v1 BOOTSTRAP bootstrap-2 profile: 40 core
 * commands plus 44 FSM commands, 84 total. The FSM source file itself is not
 * vendored; only its path/digest/git-blob triple is bound here and in
 * sdk-pin.json. bootstrap-1 stays vendored as history and is no longer consumed.
 * BOOTSTRAP grants catalogue-schema binding only. It is not semantic
 * conformance, not N/N-1, not production qualification, not audit or approval
 * evidence, and not a live HTTP server.
 */
export const KIX_SDK_0_PIN = {
  producerRepo: "SUNBURN-Golden/kix-protocol",
  producerMergeSha: "8ba7f6c36373ac0ec49246f51f7471c164ac3a28",
  producerHeadSha: "648859b1c9cda424f1a4615ac5155edf46fd0524",
  producerMergeTree: "d3f5412ef84f64fe83c5d3a3d3ada173921bfbf9",
  producerProvenanceSha256: "005cf12f1db46133a8753bed1e459e6f829f2732da29a725198e46f1332d2c1a",
  producerSourceCommit: "c2cde86e21a6e5ba6f24a56548636db6d0a34c6f",
  producerSourceTree: "394084b15e01bbe4a5612aeb3431f3278c43dd85",
  producerSourcePath: "reference/v0.3-rc1/protocol_contract.json",
  producerSourceSha256: "ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e",
  producerSourceGitBlob: "619ae21c82ca3df5661bd3831613f15fa65225ff",
  vendorRoot: "packages/protocol-adapter/vendor/kix-sdk-0",
  producerSdkRoot: "sdk",
  manifestSchemaVersion: "kix-compat-manifest/1",
  manifestPath: "sdk/compat/manifests/manifest.bootstrap-2.json",
  manifestSha256: "eec1750532d319ea06d8ae61bafa77316067088a84a9b70d20a1f6966dfba1e0",
  sidecarSha256: "bb4903cb817829f9513b47fc1f60498744ed93355ae8b61511a15a31aa99c8c3",
  profileKind: "BOOTSTRAP",
  profileRevision: "bootstrap-2",
  profileSha256: "c356b923997cefc132e63e73a179d5922dd7cb2124b9e9b399c662cd49803b73",
  profilePath: "sdk/compat/profiles/bootstrap-2.profile.json",
  grants: "catalogue-schema-binding only",
  cataloguePath: "sdk/generated/catalogue.ts",
  catalogueSha256: "3162d47c51ffad755f80086850bbcbb7ae4a846c4df47ffa57b0e44f9eced0b5",
  generatorPath: "sdk/generate/generate_client.mjs",
  generatorSha256: "66f0e2010c6511d322f8dfc7e8932d27d25e154ac0b3d6083f19f97af6124bb7",
  generatorToolchain: "node-24",
  clientSha256: "0f3650dc84bd34c74bb9a48fe9e6523c0b51665bdbcbd1313e7f94b5a3a4715e",
  jsonschemaSha256: "bfb69963dd275f80f870125fb312a0214dd473bb6df5b67543b0d7f0267f6afd",
  manifestHelperSha256: "18dc1693e58ad98766495faebe4d2e1ca5e23df92b9864b64ef497336ce1f557",
  sdkPinFileSha256: "cc68ea950560506a9e8a632ac5b9e634e037d5eaad6b12885d65ea99f9ca160a",
  verifierSha256: "b1ed26b977666f796a68c5de0a108e5558ca3c98486dc188d385b220a448cf89",
  commandCount: 84,
  coreCommandCount: 40,
  fsmCommandCount: 44,
  fsmSourcePath: "docs/contracts/openapi/fsm-command-contract.json",
  fsmSourceSha256: "342e97cb37b199622d7bb436ca9164690d969b797058aaa539ff417cab01411c",
  fsmSourceGitBlob: "3771a8739b906a478b54c597df37e27d1afc5f21",
  semanticConformance: false,
  liveHttpServer: false,
  productionEndpoint: false,
  protocolTruth: false,
  productionConformance: false,
} as const;

const HEX64 = /^[0-9a-f]{64}$/;
const HEX40 = /^[0-9a-f]{40}$/;
const REVISION = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const FORBIDDEN_MANIFEST_KEYS = [
  "consumer_head",
  "delivery_head",
  "final_commit",
  "manifest_digest",
  "manifest_sha256",
] as const;
const FORBIDDEN_PROFILE_KEYS = ["commit", "final_commit", "profile_sha256", "source_commit", "source_tree"] as const;
const MANIFEST_TOP_KEYS = [
  "contract",
  "generator",
  "manifest_schema_version",
  "producer",
  "profile_kind",
  "profile_revision",
  "profile_sha256",
  "sdk_output",
  "source_references",
  "vectors",
] as const;
const PROFILE_TOP_KEYS = [
  "catalogue",
  "grants",
  "manifest_schema_version",
  "non_claims",
  "profile_kind",
  "profile_revision",
  "vectors",
] as const;
const PROFILE_KINDS = ["BOOTSTRAP", "SEMANTIC_CONFORMANCE"] as const;
const CLIENT_FORBIDDEN_TOKENS = [
  "http://",
  "https://",
  "fetch(",
  "baseUrl",
  "baseURL",
  "Authorization",
  "retry",
  "authenticate",
] as const;

export interface SdkPinInputs {
  manifestRaw: string;
  sidecarRaw: string;
  profileRaw: string;
  verifierRaw: string;
  canonicalVectorsRaw: string;
  mixedVectorsRaw: string;
  generatorRaw: string;
  catalogueRaw: string;
  sdkPinFileRaw: string;
  producerProvenanceRaw: string;
  clientRaw: string;
  jsonschemaRaw: string;
  manifestHelperRaw: string;
  contractOnlyOpenApiRaw: string;
  integrationGateOpenApiRaw: string;
}

export const VENDORED_SDK_PIN_INPUTS: SdkPinInputs = {
  manifestRaw,
  sidecarRaw,
  profileRaw,
  verifierRaw,
  canonicalVectorsRaw,
  mixedVectorsRaw,
  generatorRaw,
  catalogueRaw,
  sdkPinFileRaw,
  producerProvenanceRaw,
  clientRaw,
  jsonschemaRaw,
  manifestHelperRaw,
  contractOnlyOpenApiRaw,
  integrationGateOpenApiRaw,
};

function keysOf(value: unknown): string[] | null {
  if (!isRecord(value)) {
    return null;
  }
  return Object.keys(value).sort(compareCodePoints);
}

function sameKeys(actual: string[] | null, expected: readonly string[]): boolean {
  if (actual === null) {
    return false;
  }
  const wanted = [...expected].sort(compareCodePoints);
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function canonicalBytes(value: unknown): Uint8Array {
  return bytes(canonicalStringify(value));
}

/**
 * Consumer-side port of kix-protocol sdk/compat/verify_compat.mjs over the
 * vendored bytes, plus the fail-closed catalogue bindings the commerce
 * adapter relies on. It returns the list of drifts and never writes.
 */
export function collectSdkPinErrors(inputs: SdkPinInputs = VENDORED_SDK_PIN_INPUTS): string[] {
  const errors: string[] = [];
  const manifestBytes = bytes(inputs.manifestRaw);
  const manifestDigest = sha256Hex(manifestBytes);

  let manifest: unknown;
  try {
    manifest = parseStrict(manifestBytes);
  } catch (error) {
    const reason = error instanceof StrictJsonError ? error.reason : "invalid-manifest";
    return [`manifest ${reason}`];
  }
  if (canonicalStringify(manifest) !== inputs.manifestRaw) {
    errors.push("manifest is not canonical");
  }
  if (!isRecord(manifest)) {
    return [...errors, "manifest is not an object"];
  }
  const topKeys = keysOf(manifest);
  if (!sameKeys(topKeys, MANIFEST_TOP_KEYS)) {
    errors.push("manifest field set drift");
  }
  for (const key of FORBIDDEN_MANIFEST_KEYS) {
    if (topKeys?.includes(key)) {
      errors.push(`self-reference field ${key}`);
    }
  }
  if (manifest.manifest_schema_version !== KIX_SDK_0_PIN.manifestSchemaVersion) {
    errors.push("manifest_schema_version drift");
  }
  if (typeof manifest.profile_kind !== "string" || !PROFILE_KINDS.includes(manifest.profile_kind as (typeof PROFILE_KINDS)[number])) {
    errors.push("unknown profile_kind");
  }
  if (manifest.profile_kind !== KIX_SDK_0_PIN.profileKind) {
    errors.push("profile_kind mismatch");
  }
  if (typeof manifest.profile_revision !== "string" || !REVISION.test(manifest.profile_revision)) {
    errors.push("profile_revision drift");
  }
  if (manifest.profile_revision !== KIX_SDK_0_PIN.profileRevision) {
    errors.push("profile_revision mismatch");
  }
  if (typeof manifest.profile_sha256 !== "string" || !HEX64.test(manifest.profile_sha256)) {
    errors.push("profile_sha256 drift");
  }
  if (manifest.profile_sha256 !== KIX_SDK_0_PIN.profileSha256) {
    errors.push("profile_sha256 mismatch");
  }

  const producer = manifest.producer;
  if (!sameKeys(keysOf(producer), ["contract_schema_version", "protocol_domain", "repository", "source_commit", "source_tree"])) {
    errors.push("producer field set drift");
  } else if (isRecord(producer)) {
    if (producer.repository !== KIX_SDK_0_PIN.producerRepo) {
      errors.push("repository drift");
    }
    if (
      typeof producer.source_commit !== "string" ||
      typeof producer.source_tree !== "string" ||
      !HEX40.test(producer.source_commit) ||
      !HEX40.test(producer.source_tree)
    ) {
      errors.push("source commit or tree is not a git id");
    }
    if (producer.source_commit !== KIX_SDK_0_PIN.producerSourceCommit) {
      errors.push("source_commit mismatch");
    }
    if (producer.source_tree !== KIX_SDK_0_PIN.producerSourceTree) {
      errors.push("source_tree mismatch");
    }
    if (producer.protocol_domain !== PINNED_PROTOCOL_DOMAIN) {
      errors.push("protocol_domain drift");
    }
    if (producer.contract_schema_version !== OPENAPI_CONTRACT_PIN.infoVersion) {
      errors.push("contract_schema_version drift");
    }
  }

  const contract = manifest.contract;
  if (!sameKeys(keysOf(contract), ["contract_only", "integration_gate"])) {
    errors.push("contract field set drift");
  }
  const fileRefs: ReadonlyArray<readonly [string, unknown, string, string, string]> = [
    [
      "contract_only",
      isRecord(contract) ? contract.contract_only : undefined,
      OPENAPI_CONTRACT_PIN.openApiPath,
      OPENAPI_CONTRACT_PIN.openApiFileSha256,
      inputs.contractOnlyOpenApiRaw,
    ],
    [
      "integration_gate",
      isRecord(contract) ? contract.integration_gate : undefined,
      OPENAPI_INTEGRATION_GATE_PIN.openApiPath,
      OPENAPI_INTEGRATION_GATE_PIN.openApiFileSha256,
      inputs.integrationGateOpenApiRaw,
    ],
  ];
  let contractOnlyDoc: Record<string, unknown> | null = null;
  for (const [label, ref, pinPath, pinSha256, raw] of fileRefs) {
    if (!sameKeys(keysOf(ref), ["gitBlob", "path", "sha256"])) {
      errors.push(`${label} field set drift`);
      continue;
    }
    const fileRef = ref as Record<string, unknown>;
    if (typeof fileRef.path !== "string" || fileRef.path.includes("..") || fileRef.path.startsWith("/")) {
      errors.push(`${label} path drift`);
      continue;
    }
    if (fileRef.path !== pinPath) {
      errors.push(`${label} path mismatch`);
    }
    const fileBytes = bytes(raw);
    if (sha256Hex(fileBytes) !== fileRef.sha256 || fileRef.sha256 !== pinSha256) {
      errors.push(`${label} bytes drift`);
    }
    if (gitBlobId(fileBytes) !== fileRef.gitBlob) {
      errors.push(`${label} gitBlob drift`);
    }
    if (label === "contract_only" && fileRef.sha256 === pinSha256) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isRecord(parsed)) {
          contractOnlyDoc = parsed;
        }
      } catch {
        errors.push("contract-only JSON drift");
      }
    }
  }

  const generator = manifest.generator;
  if (!sameKeys(keysOf(generator), ["path", "sha256", "toolchain"])) {
    errors.push("generator field set drift");
  } else if (isRecord(generator)) {
    if (generator.toolchain !== KIX_SDK_0_PIN.generatorToolchain) {
      errors.push("toolchain drift");
    }
    if (generator.path !== KIX_SDK_0_PIN.generatorPath) {
      errors.push("generator path drift");
    }
    if (sha256Hex(bytes(inputs.generatorRaw)) !== generator.sha256 || generator.sha256 !== KIX_SDK_0_PIN.generatorSha256) {
      errors.push("generator bytes drift");
    }
  }

  const sdkOutput = manifest.sdk_output;
  if (!sameKeys(keysOf(sdkOutput), ["path", "sha256"])) {
    errors.push("sdk_output field set drift");
  } else if (isRecord(sdkOutput)) {
    if (sdkOutput.path !== KIX_SDK_0_PIN.cataloguePath) {
      errors.push("sdk_output path drift");
    }
    if (sha256Hex(bytes(inputs.catalogueRaw)) !== sdkOutput.sha256 || sdkOutput.sha256 !== KIX_SDK_0_PIN.catalogueSha256) {
      errors.push("sdk_output bytes drift");
    }
  }

  const sourceReferences = manifest.source_references;
  if (!sameKeys(keysOf(sourceReferences), ["extension_profile", "fixture_profile"])) {
    errors.push("source_references field set drift");
  } else if (isRecord(sourceReferences)) {
    if (sourceReferences.fixture_profile !== KIX_SDK_0_PIN.producerSourcePath) {
      errors.push("source_references drift");
    }
    const extension = sourceReferences.extension_profile;
    if (!sameKeys(keysOf(extension), ["gitBlob", "path", "sha256"])) {
      errors.push("extension_profile field set drift");
    } else if (isRecord(extension)) {
      if (extension.path !== KIX_SDK_0_PIN.fsmSourcePath) {
        errors.push("extension_profile path drift");
      }
      if (
        extension.sha256 !== KIX_SDK_0_PIN.fsmSourceSha256 ||
        extension.gitBlob !== KIX_SDK_0_PIN.fsmSourceGitBlob
      ) {
        errors.push("extension_profile digest drift");
      }
    }
  }

  if (!Array.isArray(manifest.vectors)) {
    errors.push("vectors drift");
  }

  const profileBytes = bytes(inputs.profileRaw);
  if (sha256Hex(profileBytes) !== manifest.profile_sha256) {
    errors.push("profile bytes drift");
  }
  let profile: unknown;
  try {
    profile = parseStrict(profileBytes);
  } catch (error) {
    const reason = error instanceof StrictJsonError ? error.reason : "invalid-profile";
    errors.push(`profile ${reason}`);
  }
  if (isRecord(profile)) {
    const profileKeys = keysOf(profile);
    if (!sameKeys(profileKeys, PROFILE_TOP_KEYS)) {
      errors.push("profile field set drift");
    }
    for (const key of FORBIDDEN_PROFILE_KEYS) {
      if (profileKeys?.includes(key)) {
        errors.push(`profile self-reference field ${key}`);
      }
    }
    if (profile.profile_kind !== manifest.profile_kind || profile.profile_revision !== manifest.profile_revision) {
      errors.push("profile identity mismatch");
    }
    if (profile.manifest_schema_version !== KIX_SDK_0_PIN.manifestSchemaVersion) {
      errors.push("profile manifest_schema_version drift");
    }
    if (profile.profile_kind === "BOOTSTRAP" && profile.grants !== KIX_SDK_0_PIN.grants) {
      errors.push("BOOTSTRAP grants drift");
    }
    if (Array.isArray(manifest.vectors) && canonicalStringify(profile.vectors) !== canonicalStringify(manifest.vectors)) {
      errors.push("profile and manifest vectors differ");
    }
  } else if (profile !== undefined) {
    errors.push("profile is not an object");
  }

  if (contractOnlyDoc !== null && isRecord(profile) && isRecord(profile.catalogue)) {
    if (contractOnlyDoc["x-kix-live-http-server"] !== false || contractOnlyDoc["x-kix-production-endpoint"] !== false) {
      errors.push("contract-only live flag");
    }
    if (Object.hasOwn(contractOnlyDoc, "servers")) {
      errors.push("contract-only servers");
    }
    const schemas = isRecord(contractOnlyDoc.components) ? contractOnlyDoc.components.schemas : undefined;
    const catalogue = profile.catalogue;
    const contractOnlySha = isRecord(contract) && isRecord(contract.contract_only) ? contract.contract_only.sha256 : undefined;
    if (!sameKeys(keysOf(catalogue), ["command_set_sha256", "openapi_path", "openapi_sha256", "schema_digests"])) {
      errors.push("catalogue field set drift");
    } else if (catalogue.openapi_path !== OPENAPI_CONTRACT_PIN.openApiPath || catalogue.openapi_sha256 !== contractOnlySha) {
      errors.push("catalogue openapi binding drift");
    } else if (isRecord(schemas)) {
      const names = Object.keys(schemas)
        .filter((name) => name !== "LocalCallEnvelope")
        .sort(compareCodePoints);
      if (catalogue.command_set_sha256 !== sha256Hex(canonicalBytes(names))) {
        errors.push("command set digest drift");
      }
      if (!sameKeys(keysOf(catalogue.schema_digests), names)) {
        errors.push("schema digest map drift");
      } else if (isRecord(catalogue.schema_digests)) {
        for (const name of names) {
          if (catalogue.schema_digests[name] !== sha256Hex(canonicalBytes(schemas[name]))) {
            errors.push(`schema digest drift: ${name}`);
          }
          const generated = (COMMAND_SCHEMAS as Record<string, unknown>)[name];
          if (generated === undefined || canonicalStringify(generated) !== canonicalStringify(schemas[name])) {
            errors.push(`generated schema drift: ${name}`);
          }
        }
      }
      if (canonicalStringify([...COMMANDS].sort(compareCodePoints)) !== canonicalStringify(names)) {
        errors.push("generated command set drift");
      }
    }
  }

  if (Array.isArray(manifest.vectors)) {
    const vectorRaws: Record<string, string> = {
      "sdk/conformance/vectors/canonical-encoding.vectors.json": inputs.canonicalVectorsRaw,
      "sdk/conformance/vectors/mixed-input.vectors.json": inputs.mixedVectorsRaw,
    };
    for (const vector of manifest.vectors) {
      if (!sameKeys(keysOf(vector), ["name", "path", "sha256"])) {
        errors.push("vector field set drift");
        continue;
      }
      const entry = vector as Record<string, unknown>;
      if (typeof entry.path !== "string" || entry.path.includes("..") || entry.path.startsWith("/")) {
        errors.push(`vector path drift: ${String(entry.name)}`);
        continue;
      }
      const raw = vectorRaws[entry.path];
      if (raw === undefined || sha256Hex(bytes(raw)) !== entry.sha256) {
        errors.push(`vector bytes drift: ${String(entry.name)}`);
      }
    }
  }

  if (!/^[0-9a-f]{64}\n$/.test(inputs.sidecarRaw)) {
    errors.push("manifest sidecar form drift");
  } else {
    const sidecarDigest = inputs.sidecarRaw.slice(0, 64);
    if (sidecarDigest !== manifestDigest) {
      errors.push("manifest sidecar digest drift");
    }
    if (sidecarDigest !== KIX_SDK_0_PIN.manifestSha256) {
      errors.push("manifest digest mismatch");
    }
    if (inputs.manifestRaw.includes(sidecarDigest)) {
      errors.push("manifest contains its sidecar digest");
    }
  }

  checkVendoredFileDigests(inputs, errors);
  checkProducerProvenance(inputs, errors);
  checkGeneratedCataloguePin(errors);
  checkSdkPinFile(inputs, errors);
  checkClientSurface(inputs, errors);
  return errors;
}

function checkVendoredFileDigests(inputs: SdkPinInputs, errors: string[]): void {
  const expected: ReadonlyArray<readonly [string, string, string]> = [
    ["client", inputs.clientRaw, KIX_SDK_0_PIN.clientSha256],
    ["jsonschema", inputs.jsonschemaRaw, KIX_SDK_0_PIN.jsonschemaSha256],
    ["manifest helper", inputs.manifestHelperRaw, KIX_SDK_0_PIN.manifestHelperSha256],
    ["sdk-pin", inputs.sdkPinFileRaw, KIX_SDK_0_PIN.sdkPinFileSha256],
    ["verifier", inputs.verifierRaw, KIX_SDK_0_PIN.verifierSha256],
    ["sidecar", inputs.sidecarRaw, KIX_SDK_0_PIN.sidecarSha256],
  ];
  for (const [label, raw, sha256] of expected) {
    if (sha256Hex(bytes(raw)) !== sha256) {
      errors.push(`${label} vendored bytes drift`);
    }
  }
}

function checkProducerProvenance(inputs: SdkPinInputs, errors: string[]): void {
  const raw = inputs.producerProvenanceRaw;
  if (sha256Hex(bytes(raw)) !== KIX_SDK_0_PIN.producerProvenanceSha256) {
    errors.push("producer provenance bytes drift");
  }
  let value: unknown;
  try {
    value = parseStrict(bytes(raw));
  } catch {
    errors.push("producer provenance JSON drift");
    return;
  }
  if (canonicalStringify(value) !== raw || !isRecord(value)) {
    errors.push("producer provenance canonical form drift");
    return;
  }
  if (!sameKeys(keysOf(value), ["checks", "merge", "producer", "schema", "sdkIntroduction"])) {
    errors.push("producer provenance field set drift");
  }
  if (value.schema !== "kix-p-sdk-0-producer-provenance/3") {
    errors.push("producer provenance schema drift");
  }
  checkMergeProvenance(value, {
    pr: 448,
    headSha: KIX_SDK_0_PIN.producerHeadSha,
    mergeSha: KIX_SDK_0_PIN.producerMergeSha,
    mergeTree: KIX_SDK_0_PIN.producerMergeTree,
    mergedAt: "2026-11-12T23:23:08Z",
  }, [
    ["CodeQL", 131558666657],
    ["rights-scale", 131558431475],
    ["protocol", 131558430672],
    ["kernel", 131558430409],
    ["Analyze (javascript-typescript)", 131558418259],
    ["Analyze (rust)", 131558418236],
    ["Analyze (python)", 131558417997],
    ["Analyze (actions)", 131558417778],
  ], "producer", "success", errors);

  const introduction = value.sdkIntroduction;
  if (!isRecord(introduction) || !sameKeys(keysOf(introduction), ["checks", "merge"])) {
    errors.push("SDK introduction provenance field set drift");
  } else {
    checkMergeProvenance(introduction, {
      pr: 433,
      headSha: "c55f72429e6add41f5326e6eb203685cff537070",
      mergeSha: "19cdc1c6393e88528d3918e0f4f1f37645a34042",
      mergeTree: "1a240b2d0b717b37b0ee700b814acc7de5194d6d",
      mergedAt: "2026-11-10T07:39:21Z",
    }, [
      ["CodeQL", 129692154327],
      ["kernel", 129691939734],
      ["protocol", 129691935834],
      ["rights-scale", 129691935413],
      ["Analyze (rust)", 129691931315],
      ["Analyze (javascript-typescript)", 129691931194],
      ["Analyze (actions)", 129691931165],
      ["Analyze (python)", 129691930750],
    ], "SDK introduction", undefined, errors);
  }
  const producer = value.producer;
  if (!isRecord(producer) ||
      producer.sourceCommit !== KIX_SDK_0_PIN.producerSourceCommit ||
      producer.sourceTree !== KIX_SDK_0_PIN.producerSourceTree ||
      producer.manifestPath !== KIX_SDK_0_PIN.manifestPath ||
      producer.manifestSha256 !== KIX_SDK_0_PIN.manifestSha256 ||
      producer.profileKind !== KIX_SDK_0_PIN.profileKind ||
      producer.profileRevision !== KIX_SDK_0_PIN.profileRevision) {
    errors.push("producer tuple provenance drift");
  }
}

function checkMergeProvenance(
  record: Record<string, unknown>,
  expected: { pr: number; headSha: string; mergeSha: string; mergeTree: string; mergedAt: string },
  requiredChecks: ReadonlyArray<readonly [string, number]>,
  label: string,
  conclusion: "success" | undefined,
  errors: string[],
): void {
  const merge = record.merge;
  if (!isRecord(merge) ||
      merge.repository !== KIX_SDK_0_PIN.producerRepo ||
      merge.mergedBy !== "BeautifulMind-JT" ||
      Object.entries(expected).some(([field, value]) => merge[field] !== value)) {
    errors.push(`${label} merge binding drift`);
  }
  const checks = record.checks;
  if (!Array.isArray(checks) || checks.length !== requiredChecks.length) {
    errors.push(`${label} completion checks drift`);
    return;
  }
  for (const [name, checkRunId] of requiredChecks) {
    const check = checks.find((entry) => isRecord(entry) && entry.name === name);
    if (!isRecord(check) ||
        check.checkRunId !== checkRunId ||
        check.headSha !== expected.headSha ||
        check.conclusion !== conclusion) {
      errors.push(`${label} completion check drift: ${name}`);
    }
  }
}

function checkGeneratedCataloguePin(errors: string[]): void {
  if (OPENAPI_PIN.commandCount !== KIX_SDK_0_PIN.commandCount || COMMANDS.length !== KIX_SDK_0_PIN.commandCount) {
    errors.push("generated command count drift");
  }
  if (
    OPENAPI_PIN.coreCommandCount !== KIX_SDK_0_PIN.coreCommandCount ||
    OPENAPI_PIN.fsmCommandCount !== KIX_SDK_0_PIN.fsmCommandCount ||
    KIX_SDK_0_PIN.coreCommandCount + KIX_SDK_0_PIN.fsmCommandCount !== KIX_SDK_0_PIN.commandCount
  ) {
    errors.push("generated command split drift");
  }
  if (
    OPENAPI_PIN.fsmSourceGitBlob !== KIX_SDK_0_PIN.fsmSourceGitBlob ||
    OPENAPI_PIN.fsmSourcePath !== KIX_SDK_0_PIN.fsmSourcePath ||
    OPENAPI_PIN.fsmSourceSha256 !== KIX_SDK_0_PIN.fsmSourceSha256
  ) {
    errors.push("generated FSM source pin drift");
  }
  if (OPENAPI_PIN.contractStatus !== OPENAPI_CONTRACT_PIN.contractStatus) {
    errors.push("generated contract status drift");
  }
  if (OPENAPI_PIN.domain !== PINNED_PROTOCOL_DOMAIN) {
    errors.push("generated domain drift");
  }
  if (OPENAPI_PIN.gitBlob !== gitBlobId(bytes(VENDORED_SDK_PIN_INPUTS.contractOnlyOpenApiRaw))) {
    errors.push("generated OpenAPI gitBlob drift");
  }
  if (OPENAPI_PIN.liveHttpServer !== false || OPENAPI_PIN.productionEndpoint !== false) {
    errors.push("generated catalogue claims a live server or a production endpoint");
  }
  if (OPENAPI_PIN.openapiPath !== OPENAPI_CONTRACT_PIN.openApiPath) {
    errors.push("generated OpenAPI path drift");
  }
  if (OPENAPI_PIN.sha256 !== OPENAPI_CONTRACT_PIN.openApiFileSha256) {
    errors.push("generated OpenAPI sha256 drift");
  }
  if (OPENAPI_PIN.sourceAuthentication !== "FIXTURE_ONLY" || OPENAPI_PIN.unknownFields !== "REJECT") {
    errors.push("generated catalogue source marker drift");
  }
  if (
    OPENAPI_PIN.sourceGitBlob !== KIX_SDK_0_PIN.producerSourceGitBlob ||
    OPENAPI_PIN.sourcePath !== KIX_SDK_0_PIN.producerSourcePath ||
    OPENAPI_PIN.sourceSha256 !== KIX_SDK_0_PIN.producerSourceSha256 ||
    OPENAPI_PIN.sourceGitBlob !== OPENAPI_INTEGRATION_GATE_PIN.sourceProtocolContractGitBlob
  ) {
    errors.push("generated source pin drift");
  }
  if (ENVELOPE_REQUIRED.length !== LOCAL_CALL_PARAMETER_NAMES.length || !ENVELOPE_REQUIRED.every((name, index) => name === LOCAL_CALL_PARAMETER_NAMES[index])) {
    errors.push("generated envelope parameter drift");
  }
  for (const name of COMMANDS) {
    if (ACTION_BODY_MAP[name] !== `#/components/schemas/${name}`) {
      errors.push(`action body map drift: ${name}`);
    }
    if ((COMMAND_SCHEMAS[name] as Record<string, unknown>).additionalProperties !== false) {
      errors.push(`command schema must reject unknown fields: ${name}`);
    }
  }
}

function checkSdkPinFile(inputs: SdkPinInputs, errors: string[]): void {
  let pin: unknown;
  try {
    pin = JSON.parse(inputs.sdkPinFileRaw);
  } catch {
    errors.push("sdk-pin file is not JSON");
    return;
  }
  if (!isRecord(pin)) {
    errors.push("sdk-pin file is not an object");
    return;
  }
  if (pin.commandCount !== KIX_SDK_0_PIN.commandCount) {
    errors.push("sdk-pin command count drift");
  }
  if (
    pin.coreCommandCount !== KIX_SDK_0_PIN.coreCommandCount ||
    pin.fsmCommandCount !== KIX_SDK_0_PIN.fsmCommandCount
  ) {
    errors.push("sdk-pin command split drift");
  }
  if (
    !isRecord(pin.fsmSource) ||
    pin.fsmSource.gitBlob !== KIX_SDK_0_PIN.fsmSourceGitBlob ||
    pin.fsmSource.path !== KIX_SDK_0_PIN.fsmSourcePath ||
    pin.fsmSource.sha256 !== KIX_SDK_0_PIN.fsmSourceSha256
  ) {
    errors.push("sdk-pin FSM source binding drift");
  }
  if (pin.domain !== PINNED_PROTOCOL_DOMAIN) {
    errors.push("sdk-pin domain drift");
  }
  if (pin.generatedCatalogue !== KIX_SDK_0_PIN.cataloguePath || pin.generator !== KIX_SDK_0_PIN.generatorPath) {
    errors.push("sdk-pin path drift");
  }
  const openApi = pin.openapi;
  if (
    !isRecord(openApi) ||
    openApi.gitBlob !== gitBlobId(bytes(inputs.contractOnlyOpenApiRaw)) ||
    openApi.path !== OPENAPI_CONTRACT_PIN.openApiPath ||
    openApi.sha256 !== OPENAPI_CONTRACT_PIN.openApiFileSha256
  ) {
    errors.push("sdk-pin OpenAPI binding drift");
  }
  const source = pin.source;
  if (
    !isRecord(source) ||
    source.domain !== PINNED_PROTOCOL_DOMAIN ||
    source.gitBlob !== KIX_SDK_0_PIN.producerSourceGitBlob ||
    source.path !== KIX_SDK_0_PIN.producerSourcePath ||
    source.sha256 !== KIX_SDK_0_PIN.producerSourceSha256
  ) {
    errors.push("sdk-pin source binding drift");
  }
  if (pin.sourceAuthentication !== "FIXTURE_ONLY" || pin.unknownFields !== "REJECT") {
    errors.push("sdk-pin source marker drift");
  }
}

function isIdentifierChar(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z0-9_$]/.test(char);
}

/**
 * Standalone-token match: a schema field name such as retryOf only contains
 * the "retry" token as a substring and is not a repeat-call API.
 */
export function carriesSurfaceToken(text: string, token: string): boolean {
  let index = text.indexOf(token);
  while (index !== -1) {
    if (!isIdentifierChar(text[index - 1]) && !isIdentifierChar(text[index + token.length])) {
      return true;
    }
    index = text.indexOf(token, index + 1);
  }
  return false;
}

function checkClientSurface(inputs: SdkPinInputs, errors: string[]): void {
  for (const token of CLIENT_FORBIDDEN_TOKENS) {
    if (carriesSurfaceToken(inputs.clientRaw, token)) {
      errors.push(`client surface carries ${token}`);
    }
    if (carriesSurfaceToken(inputs.catalogueRaw, token)) {
      errors.push(`catalogue carries ${token}`);
    }
  }
}

let verified = false;

export function assertSdkPin(): void {
  const errors = collectSdkPinErrors();
  if (errors.length > 0) {
    throw new ProtocolError(`SDK pin check failed: ${errors.join("; ")}`);
  }
}

/**
 * The vendored tuple was verified at module load. This does not re-verify;
 * the load-time assertSdkPin() is the gate.
 */
export function requireSdkPin(): typeof KIX_SDK_0_PIN {
  if (!verified) {
    throw new ProtocolError("SDK pin is not verified.");
  }
  if (
    KIX_SDK_0_PIN.profileKind !== "BOOTSTRAP" ||
    KIX_SDK_0_PIN.semanticConformance !== false ||
    KIX_SDK_0_PIN.liveHttpServer !== false ||
    KIX_SDK_0_PIN.productionEndpoint !== false ||
    KIX_SDK_0_PIN.protocolTruth !== false ||
    KIX_SDK_0_PIN.productionConformance !== false
  ) {
    throw new ProtocolError("Refusing an SDK pin that claims conformance, production, or a live server.");
  }
  return KIX_SDK_0_PIN;
}

assertSdkPin();
verified = true;
