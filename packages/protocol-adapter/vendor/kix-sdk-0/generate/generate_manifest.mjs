/**
 * Writes the BOOTSTRAP profile, manifest-v1, and the manifest digest sidecar.
 *
 * source_commit is the catalogue input commit, not the delivery head.
 * The manifest digest is written only to the sidecar.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalStringify, compareCodePoints } from "../src/jsonschema.ts";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const SOURCE_COMMIT = "c2cde86e21a6e5ba6f24a56548636db6d0a34c6f";
const SOURCE_TREE = "394084b15e01bbe4a5612aeb3431f3278c43dd85";
const EXPECTED_SOURCE_SHA256 = "ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e";
const EXPECTED_SOURCE_BLOB = "619ae21c82ca3df5661bd3831613f15fa65225ff";

const CONTRACT_PATH = "docs/contracts/openapi/kix-protocol.contract-only.openapi.json";
const GATE_PATH = "docs/contracts/openapi/kix-protocol.integration-gate.openapi.json";
const SOURCE_PATH = "reference/v0.3-rc1/protocol_contract.json";
const FSM_PATH = "docs/contracts/openapi/fsm-command-contract.json";
const GENERATOR_PATH = "sdk/generate/generate_client.mjs";
const CATALOGUE_PATH = "sdk/generated/catalogue.ts";
const PROFILE_PATH = "sdk/compat/profiles/bootstrap-2.profile.json";
const MANIFEST_PATH = "sdk/compat/manifests/manifest.bootstrap-2.json";
const SIDECAR_PATH = "sdk/compat/manifests/manifest.bootstrap-2.json.sha256";
const CANONICAL_VECTOR = "sdk/conformance/vectors/canonical-encoding.vectors.json";
const MIXED_VECTOR = "sdk/conformance/vectors/mixed-input.vectors.json";

function fail(message) {
  console.error(`generate_manifest: ${message}`);
  process.exit(1);
}

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`missing value for ${name}`);
  }
  return resolve(value);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function gitBlobId(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, "ascii");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

function readBytes(path) {
  return readFileSync(resolve(ROOT, path));
}

function fileRef(path, bytes) {
  return { gitBlob: gitBlobId(bytes), path, sha256: sha256(bytes) };
}

function main() {
  const outRoot = argument("--out-root", ROOT);
  const sourceBytes = readBytes(SOURCE_PATH);
  const contractBytes = readBytes(CONTRACT_PATH);
  const gateBytes = readBytes(GATE_PATH);
  const fsmBytes = readBytes(FSM_PATH);
  const generatorBytes = readBytes(GENERATOR_PATH);
  const catalogueBytes = readBytes(CATALOGUE_PATH);
  const canonicalBytes = readBytes(CANONICAL_VECTOR);
  const mixedBytes = readBytes(MIXED_VECTOR);
  const toolchains = JSON.parse(readBytes("toolchains.json").toString("utf8"));
  const contract = JSON.parse(contractBytes.toString("utf8"));
  const source = JSON.parse(sourceBytes.toString("utf8"));

  if (toolchains.nodeMajor !== 24) {
    fail("toolchains.json nodeMajor must be 24");
  }
  const sourceRef = fileRef(SOURCE_PATH, sourceBytes);
  if (sourceRef.sha256 !== EXPECTED_SOURCE_SHA256 || sourceRef.gitBlob !== EXPECTED_SOURCE_BLOB) {
    fail("protocol_contract.json drifted from the core pin");
  }
  const contractRef = fileRef(CONTRACT_PATH, contractBytes);
  const gateRef = fileRef(GATE_PATH, gateBytes);
  const fsmRef = fileRef(FSM_PATH, fsmBytes);
  if (contract["x-kix-source"].sha256 !== sourceRef.sha256) {
    fail("openapi source sha256 drift");
  }
  const fsmPin = contract["x-kix-source"].fsmSource;
  if (!fsmPin || fsmPin.sha256 !== fsmRef.sha256 || fsmPin.gitBlob !== fsmRef.gitBlob || fsmPin.path !== FSM_PATH) {
    fail("openapi fsm source pin drift");
  }
  if (contract["x-kix-source"].domain !== source.domain) {
    fail("domain drift");
  }
  if (!catalogueBytes.toString("utf8").includes(contractRef.sha256)) {
    fail("generated catalogue is not bound to the contract-only sha256");
  }

  const schemas = contract.components.schemas;
  const names = Object.keys(schemas)
    .filter((name) => name !== "LocalCallEnvelope")
    .sort(compareCodePoints);
  if (names.length !== 84) {
    fail("command count must stay 84 for bootstrap-2");
  }
  const schemaDigests = {};
  for (const name of names) {
    schemaDigests[name] = sha256(Buffer.from(canonicalStringify(schemas[name]), "utf8"));
  }
  const commandSetSha = sha256(Buffer.from(canonicalStringify(names), "utf8"));
  const vectors = [
    {
      name: "canonical-encoding",
      path: CANONICAL_VECTOR,
      sha256: sha256(canonicalBytes),
    },
    {
      name: "mixed-input",
      path: MIXED_VECTOR,
      sha256: sha256(mixedBytes),
    },
  ];
  const profile = {
    catalogue: {
      command_set_sha256: commandSetSha,
      openapi_path: CONTRACT_PATH,
      openapi_sha256: contractRef.sha256,
      schema_digests: schemaDigests,
    },
    grants: "catalogue-schema-binding only",
    manifest_schema_version: "kix-compat-manifest/1",
    non_claims: [
      "no semantic qualification",
      "no N/N-1 qualification",
      "no production qualification",
      "not audit or approval evidence",
    ],
    profile_kind: "BOOTSTRAP",
    profile_revision: "bootstrap-2",
    vectors,
  };
  const profileBytes = Buffer.from(canonicalStringify(profile), "utf8");
  const manifest = {
    contract: {
      contract_only: contractRef,
      integration_gate: gateRef,
    },
    generator: {
      path: GENERATOR_PATH,
      sha256: sha256(generatorBytes),
      toolchain: "node-24",
    },
    manifest_schema_version: "kix-compat-manifest/1",
    producer: {
      contract_schema_version: contract.info.version,
      protocol_domain: contract["x-kix-source"].domain,
      repository: "SUNBURN-Golden/kix-protocol",
      source_commit: SOURCE_COMMIT,
      source_tree: SOURCE_TREE,
    },
    profile_kind: "BOOTSTRAP",
    profile_revision: "bootstrap-2",
    profile_sha256: sha256(profileBytes),
    sdk_output: {
      path: CATALOGUE_PATH,
      sha256: sha256(catalogueBytes),
    },
    source_references: {
      extension_profile: {
        gitBlob: fsmRef.gitBlob,
        path: FSM_PATH,
        sha256: fsmRef.sha256,
      },
      fixture_profile: SOURCE_PATH,
    },
    vectors,
  };
  const manifestText = canonicalStringify(manifest);
  if (manifestText.includes(sha256(Buffer.from(manifestText, "utf8")))) {
    fail("manifest text contains its own digest");
  }
  const manifestBytes = Buffer.from(manifestText, "utf8");
  const sidecar = `${sha256(manifestBytes)}\n`;

  const profileOut = resolve(outRoot, PROFILE_PATH);
  const manifestOut = resolve(outRoot, MANIFEST_PATH);
  const sidecarOut = resolve(outRoot, SIDECAR_PATH);
  for (const path of [profileOut, manifestOut, sidecarOut]) {
    mkdirSync(dirname(path), { recursive: true });
  }
  writeFileSync(profileOut, profileBytes);
  writeFileSync(manifestOut, manifestBytes);
  writeFileSync(sidecarOut, sidecar);
}

main();
