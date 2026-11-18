/**
 * Minimum offline consumer/producer verifier for manifest-v1.
 *
 * Checks bytes on disk. It does not resolve source_commit in git and it does
 * not treat a profile or manifest as audit or approval evidence.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseStrict, StrictJsonError, canonicalStringify, compareCodePoints } from "../src/jsonschema.ts";
import {
  BOOTSTRAP_GRANTS,
  MANIFEST_SCHEMA_VERSION,
  PROFILE_KINDS,
  canonicalBytes,
  gitBlobId,
  sha256Hex,
} from "../src/manifest.ts";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const HEX64 = /^[0-9a-f]{64}$/;
const HEX40 = /^[0-9a-f]{40}$/;
const REVISION = /^[a-z0-9][a-z0-9.-]{0,63}$/;

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function finish(ok, payload) {
  console.log(JSON.stringify({ ok, ...payload }));
  process.exit(ok ? 0 : 1);
}

function keysOf(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return Object.keys(value).sort(compareCodePoints);
}

function sameKeys(actual, expected) {
  if (actual === null) {
    return false;
  }
  const wanted = [...expected].sort(compareCodePoints);
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function readExact(path, errors, label) {
  try {
    return readFileSync(path);
  } catch {
    errors.push(`${label} unreadable: ${path}`);
    return null;
  }
}

function main() {
  const manifestArg = argument("--manifest");
  const expectKind = argument("--expect-kind");
  const expectRevision = argument("--expect-revision");
  if (!manifestArg) {
    finish(false, { errors: ["--manifest is required"] });
  }
  const errors = [];
  const manifestPath = resolve(manifestArg);
  const manifestBytes = readExact(manifestPath, errors, "manifest");
  if (!manifestBytes) {
    finish(false, { errors });
  }
  let manifest;
  try {
    manifest = parseStrict(manifestBytes);
  } catch (error) {
    const reason = error instanceof StrictJsonError ? error.reason : "invalid-manifest";
    finish(false, { errors: [`manifest ${reason}`] });
  }
  if (canonicalStringify(manifest) !== new TextDecoder().decode(manifestBytes)) {
    errors.push("manifest is not canonical");
  }
  const topKeys = keysOf(manifest);
  const allowedTop = [
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
  ];
  if (!sameKeys(topKeys, allowedTop)) {
    errors.push("manifest field set drift");
  }
  for (const key of ["consumer_head", "delivery_head", "final_commit", "manifest_digest", "manifest_sha256"]) {
    if (topKeys?.includes(key)) {
      errors.push(`self-reference field ${key}`);
    }
  }
  if (manifest.manifest_schema_version !== MANIFEST_SCHEMA_VERSION) {
    errors.push("manifest_schema_version drift");
  }
  if (!PROFILE_KINDS.includes(manifest.profile_kind)) {
    errors.push("unknown profile_kind");
  }
  if (expectKind !== undefined && manifest.profile_kind !== expectKind) {
    errors.push("profile_kind mismatch");
  }
  if (typeof manifest.profile_revision !== "string" || !REVISION.test(manifest.profile_revision)) {
    errors.push("profile_revision drift");
  }
  if (expectRevision !== undefined && manifest.profile_revision !== expectRevision) {
    errors.push("profile_revision mismatch");
  }
  if (typeof manifest.profile_sha256 !== "string" || !HEX64.test(manifest.profile_sha256)) {
    errors.push("profile_sha256 drift");
  }

  const producerKeys = keysOf(manifest.producer);
  if (
    !sameKeys(producerKeys, [
      "contract_schema_version",
      "protocol_domain",
      "repository",
      "source_commit",
      "source_tree",
    ])
  ) {
    errors.push("producer field set drift");
  } else {
    if (manifest.producer.repository !== "SUNBURN-Golden/kix-protocol") {
      errors.push("repository drift");
    }
    if (!HEX40.test(manifest.producer.source_commit) || !HEX40.test(manifest.producer.source_tree)) {
      errors.push("source commit or tree is not a git id");
    }
  }

  const contractKeys = keysOf(manifest.contract);
  if (!sameKeys(contractKeys, ["contract_only", "integration_gate"])) {
    errors.push("contract field set drift");
  }
  const fileRefs = [
    ["contract_only", manifest.contract?.contract_only],
    ["integration_gate", manifest.contract?.integration_gate],
  ];
  const loaded = {};
  for (const [label, ref] of fileRefs) {
    if (!sameKeys(keysOf(ref), ["gitBlob", "path", "sha256"])) {
      errors.push(`${label} field set drift`);
      continue;
    }
    if (typeof ref.path !== "string" || ref.path.includes("..") || ref.path.startsWith("/")) {
      errors.push(`${label} path drift`);
      continue;
    }
    const bytes = readExact(resolve(ROOT, ref.path), errors, label);
    if (!bytes) {
      continue;
    }
    if (sha256Hex(bytes) !== ref.sha256 || gitBlobId(bytes) !== ref.gitBlob) {
      errors.push(`${label} bytes drift`);
    }
    loaded[label] = bytes;
  }

  if (!sameKeys(keysOf(manifest.generator), ["path", "sha256", "toolchain"])) {
    errors.push("generator field set drift");
  } else {
    const toolchains = JSON.parse(readFileSync(resolve(ROOT, "toolchains.json"), "utf8"));
    const expectedToolchain = `node-${toolchains.nodeMajor}`;
    if (manifest.generator.toolchain !== expectedToolchain) {
      errors.push("toolchain drift");
    }
    const running = process.versions.node.split(".")[0];
    if (running !== String(toolchains.nodeMajor)) {
      errors.push("running node does not match toolchains.json");
    }
    if (manifest.generator.path !== "sdk/generate/generate_client.mjs") {
      errors.push("generator path drift");
    }
    const generatorBytes = readExact(resolve(ROOT, manifest.generator.path), errors, "generator");
    if (generatorBytes && sha256Hex(generatorBytes) !== manifest.generator.sha256) {
      errors.push("generator bytes drift");
    }
  }

  if (!sameKeys(keysOf(manifest.sdk_output), ["path", "sha256"])) {
    errors.push("sdk_output field set drift");
  } else if (manifest.sdk_output.path !== "sdk/generated/catalogue.ts") {
    errors.push("sdk_output path drift");
  } else {
    const outputBytes = readExact(resolve(ROOT, manifest.sdk_output.path), errors, "sdk_output");
    if (outputBytes && sha256Hex(outputBytes) !== manifest.sdk_output.sha256) {
      errors.push("sdk_output bytes drift");
    }
  }

  if (!sameKeys(keysOf(manifest.source_references), ["extension_profile", "fixture_profile"])) {
    errors.push("source_references field set drift");
  } else if (manifest.source_references.fixture_profile !== "reference/v0.3-rc1/protocol_contract.json") {
    errors.push("source_references drift");
  } else {
    const extension = manifest.source_references.extension_profile;
    if (extension !== false) {
      if (!sameKeys(keysOf(extension), ["gitBlob", "path", "sha256"])) {
        errors.push("extension_profile field set drift");
      } else if (extension.path !== "docs/contracts/openapi/fsm-command-contract.json") {
        errors.push("extension_profile path drift");
      } else {
        const extensionBytes = readExact(resolve(ROOT, extension.path), errors, "extension_profile");
        if (
          extensionBytes &&
          (sha256Hex(extensionBytes) !== extension.sha256 || gitBlobId(extensionBytes) !== extension.gitBlob)
        ) {
          errors.push("extension_profile bytes drift");
        }
      }
    }
  }

  if (!Array.isArray(manifest.vectors)) {
    errors.push("vectors drift");
  }

  const profilePath = resolve(ROOT, "sdk/compat/profiles", `${manifest.profile_revision}.profile.json`);
  const profileBytes = readExact(profilePath, errors, "profile");
  if (profileBytes && sha256Hex(profileBytes) !== manifest.profile_sha256) {
    errors.push("profile bytes drift");
  }
  let profile;
  if (profileBytes) {
    try {
      profile = parseStrict(profileBytes);
    } catch (error) {
      const reason = error instanceof StrictJsonError ? error.reason : "invalid-profile";
      errors.push(`profile ${reason}`);
    }
  }
  if (profile) {
    const profileKeys = keysOf(profile);
    if (
      !sameKeys(profileKeys, [
        "catalogue",
        "grants",
        "manifest_schema_version",
        "non_claims",
        "profile_kind",
        "profile_revision",
        "vectors",
      ])
    ) {
      errors.push("profile field set drift");
    }
    for (const key of ["commit", "final_commit", "profile_sha256", "source_commit", "source_tree"]) {
      if (profileKeys?.includes(key)) {
        errors.push(`profile self-reference field ${key}`);
      }
    }
    if (profile.profile_kind !== manifest.profile_kind || profile.profile_revision !== manifest.profile_revision) {
      errors.push("profile identity mismatch");
    }
    if (profile.manifest_schema_version !== MANIFEST_SCHEMA_VERSION) {
      errors.push("profile manifest_schema_version drift");
    }
    if (profile.profile_kind === "BOOTSTRAP" && profile.grants !== BOOTSTRAP_GRANTS) {
      errors.push("BOOTSTRAP grants drift");
    }
    if (canonicalStringify(profile.vectors) !== canonicalStringify(manifest.vectors)) {
      errors.push("profile and manifest vectors differ");
    }
  }

  if (loaded.contract_only && profile?.catalogue) {
    let openapi;
    try {
      openapi = JSON.parse(new TextDecoder().decode(loaded.contract_only));
    } catch {
      errors.push("contract-only JSON drift");
      openapi = null;
    }
    if (openapi) {
      if (openapi["x-kix-live-http-server"] !== false || openapi["x-kix-production-endpoint"] !== false) {
        errors.push("contract-only live flag");
      }
      if (Object.hasOwn(openapi, "servers")) {
        errors.push("contract-only servers");
      }
      if (manifest.producer?.protocol_domain !== openapi["x-kix-source"]?.domain) {
        errors.push("protocol_domain drift");
      }
      if (manifest.producer?.contract_schema_version !== openapi.info?.version) {
        errors.push("contract_schema_version drift");
      }
      const catalogue = profile.catalogue;
      if (
        !sameKeys(keysOf(catalogue), [
          "command_set_sha256",
          "openapi_path",
          "openapi_sha256",
          "schema_digests",
        ])
      ) {
        errors.push("catalogue field set drift");
      } else if (
        catalogue.openapi_path !== "docs/contracts/openapi/kix-protocol.contract-only.openapi.json" ||
        catalogue.openapi_sha256 !== manifest.contract.contract_only.sha256
      ) {
        errors.push("catalogue openapi binding drift");
      } else {
        const names = Object.keys(openapi.components.schemas)
          .filter((name) => name !== "LocalCallEnvelope")
          .sort(compareCodePoints);
        const commandSet = sha256Hex(canonicalBytes(names));
        if (catalogue.command_set_sha256 !== commandSet) {
          errors.push("command set digest drift");
        }
        const digestKeys = keysOf(catalogue.schema_digests);
        if (!sameKeys(digestKeys, names)) {
          errors.push("schema digest map drift");
        } else {
          for (const name of names) {
            const digest = sha256Hex(canonicalBytes(openapi.components.schemas[name]));
            if (catalogue.schema_digests[name] !== digest) {
              errors.push(`schema digest drift: ${name}`);
            }
          }
        }
      }
    }
  }

  if (Array.isArray(manifest.vectors)) {
    for (const vector of manifest.vectors) {
      if (!sameKeys(keysOf(vector), ["name", "path", "sha256"])) {
        errors.push("vector field set drift");
        continue;
      }
      if (typeof vector.path !== "string" || vector.path.includes("..") || vector.path.startsWith("/")) {
        errors.push(`vector path drift: ${vector.name}`);
        continue;
      }
      const bytes = readExact(resolve(ROOT, vector.path), errors, vector.name);
      if (bytes && sha256Hex(bytes) !== vector.sha256) {
        errors.push(`vector bytes drift: ${vector.name}`);
      }
    }
  }

  const sidecarPath = `${manifestPath}.sha256`;
  const sidecar = readExact(sidecarPath, errors, "manifest sidecar");
  if (sidecar) {
    const text = new TextDecoder().decode(sidecar);
    if (!/^[0-9a-f]{64}\n$/.test(text)) {
      errors.push("manifest sidecar form drift");
    } else if (text.slice(0, 64) !== sha256Hex(manifestBytes)) {
      errors.push("manifest sidecar digest drift");
    }
    if (new TextDecoder().decode(manifestBytes).includes(text.slice(0, 64))) {
      errors.push("manifest contains its sidecar digest");
    }
  }

  if (errors.length > 0) {
    finish(false, { errors });
  }
  finish(true, {
    manifest_sha256: sha256Hex(manifestBytes),
    profile_kind: manifest.profile_kind,
    profile_revision: manifest.profile_revision,
  });
}

main();
