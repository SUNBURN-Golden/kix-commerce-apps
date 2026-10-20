import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  KIX_SDK_0_PIN,
  OPENAPI_CONTRACT_PIN,
  OPENAPI_INTEGRATION_GATE_PIN,
  PINNED_ACTIONS,
  PINNED_PROTOCOL_DOMAIN,
  ProtocolError,
  VENDORED_SDK_PIN_INPUTS,
  assertSdkPin,
  collectSdkPinErrors,
  requireSdkPin,
} from "../src/index.js";
import { gitBlobId, sha1Hex } from "../src/sha1.js";
import { carriesSurfaceToken } from "../src/sdk-pin.js";
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
  parseStrict,
} from "#kix-sdk-0/jsonschema";

const sdkRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../vendor/kix-sdk-0");

function vendored(relative: string): Buffer {
  return readFileSync(path.join(sdkRoot, relative));
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function manifestValue(): Record<string, unknown> {
  return parseStrict(VENDORED_SDK_PIN_INPUTS.manifestRaw) as Record<string, unknown>;
}

function setPath(root: Record<string, unknown>, dotted: string, value: unknown): void {
  const parts = dotted.split(".");
  let cursor: Record<string, unknown> = root;
  for (const part of parts.slice(0, -1)) {
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
}

function getPath(root: Record<string, unknown>, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((cursor, part) => (cursor as Record<string, unknown>)[part], root);
}

describe("p-sdk-0 vendored tuple pin", () => {
  it("hashes the vendored manifest, profile, sidecar, catalogue, generator, and vectors", () => {
    expect(sha256(vendored("compat/manifests/manifest.bootstrap-1.json"))).toBe(KIX_SDK_0_PIN.manifestSha256);
    expect(sha256(vendored("compat/manifests/manifest.bootstrap-1.json.sha256"))).toBe(
      KIX_SDK_0_PIN.sidecarSha256,
    );
    expect(vendored("compat/manifests/manifest.bootstrap-1.json.sha256").toString("utf8")).toBe(
      `${KIX_SDK_0_PIN.manifestSha256}\n`,
    );
    expect(sha256(vendored("compat/profiles/bootstrap-1.profile.json"))).toBe(KIX_SDK_0_PIN.profileSha256);
    expect(sha256(vendored("generated/catalogue.ts"))).toBe(KIX_SDK_0_PIN.catalogueSha256);
    expect(sha256(vendored("generate/generate_client.mjs"))).toBe(KIX_SDK_0_PIN.generatorSha256);
    expect(sha256(vendored("src/client.ts"))).toBe(KIX_SDK_0_PIN.clientSha256);
    expect(sha256(vendored("src/jsonschema.ts"))).toBe(KIX_SDK_0_PIN.jsonschemaSha256);
    expect(sha256(vendored("src/manifest.ts"))).toBe(KIX_SDK_0_PIN.manifestHelperSha256);
    expect(sha256(vendored("sdk-pin.json"))).toBe(KIX_SDK_0_PIN.sdkPinFileSha256);
    expect(sha256(vendored("producer-provenance.json"))).toBe(KIX_SDK_0_PIN.producerProvenanceSha256);
    expect(sha256(vendored("compat/verify_compat.mjs"))).toBe(KIX_SDK_0_PIN.verifierSha256);
    expect(sha256(vendored("conformance/vectors/canonical-encoding.vectors.json"))).toBe(
      "3446c13847bb153df06c1d5d3b7f09cd3b1648ac10bb0cc76d7b65c7014e99c2",
    );
    expect(sha256(vendored("conformance/vectors/mixed-input.vectors.json"))).toBe(
      "9e2441ddefc22a2f8c7be230436620908b735b128b9445b7a5a916e4d86a2e19",
    );
  });

  it("records the producer commit, the BOOTSTRAP profile, and the non-claims", () => {
    expect(KIX_SDK_0_PIN.producerRepo).toBe("SUNBURN-Golden/kix-protocol");
    expect(KIX_SDK_0_PIN.producerMergeSha).toBe("a74e7c459d3be6754ac3cf24503e43c7bc312358");
    expect(KIX_SDK_0_PIN.producerSourceCommit).toBe("7481b0e16ce9b903abbffa62249bb91cd9e63cfe");
    expect(KIX_SDK_0_PIN.producerSourceTree).toBe("8495c7651e456cead3a8812b9e6fb183f818acd2");
    expect(KIX_SDK_0_PIN.manifestSchemaVersion).toBe("kix-compat-manifest/1");
    expect(KIX_SDK_0_PIN.profileKind).toBe("BOOTSTRAP");
    expect(KIX_SDK_0_PIN.profileRevision).toBe("bootstrap-1");
    expect(KIX_SDK_0_PIN.grants).toBe("catalogue-schema-binding only");
    expect(KIX_SDK_0_PIN.semanticConformance).toBe(false);
    expect(KIX_SDK_0_PIN.liveHttpServer).toBe(false);
    expect(KIX_SDK_0_PIN.productionEndpoint).toBe(false);
    expect(KIX_SDK_0_PIN.protocolTruth).toBe(false);
    expect(KIX_SDK_0_PIN.productionConformance).toBe(false);
    expect(requireSdkPin()).toBe(KIX_SDK_0_PIN);
    const manifest = manifestValue();
    expect(manifest.profile_kind).toBe("BOOTSTRAP");
    expect(manifest.profile_revision).toBe("bootstrap-1");
    expect(manifest.profile_sha256).toBe(KIX_SDK_0_PIN.profileSha256);
    const profile = parseStrict(VENDORED_SDK_PIN_INPUTS.profileRaw) as Record<string, unknown>;
    expect(profile.non_claims).toEqual([
      "no semantic qualification",
      "no N/N-1 qualification",
      "no production qualification",
      "not audit or approval evidence",
    ]);
  });

  it("verifies the whole tuple offline and reports no drift", () => {
    expect(collectSdkPinErrors()).toEqual([]);
    expect(() => assertSdkPin()).not.toThrow();
  });

  it("rejects producer provenance that does not bind the reviewed head, completion checks, and merge", { timeout: 30_000 }, () => {
    const original = parseStrict(VENDORED_SDK_PIN_INPUTS.producerProvenanceRaw) as Record<string, unknown>;
    const cases: ReadonlyArray<readonly [string, unknown, string]> = [
      ["schema", "unknown", "producer provenance schema drift"],
      ["merge", null, "producer merge binding drift"],
      ["merge.repository", "foreign/repository", "producer merge binding drift"],
      ["merge.pr", 124, "producer merge binding drift"],
      ["merge.headSha", "0".repeat(40), "producer merge binding drift"],
      ["merge.mergeSha", "0".repeat(40), "producer merge binding drift"],
      ["merge.mergeTree", "0".repeat(40), "producer merge binding drift"],
      ["merge.mergedBy", "other", "producer merge binding drift"],
      ["merge.parentShas", [], "producer merge binding drift"],
      ["producer", null, "producer tuple provenance drift"],
      ["producer.sourceCommit", "0".repeat(40), "producer tuple provenance drift"],
      ["producer.sourceTree", "0".repeat(40), "producer tuple provenance drift"],
      ["producer.manifestPath", "other", "producer tuple provenance drift"],
      ["producer.manifestSha256", "0".repeat(64), "producer tuple provenance drift"],
      ["producer.profileKind", "SEMANTIC_CONFORMANCE", "producer tuple provenance drift"],
      ["producer.profileRevision", "other", "producer tuple provenance drift"],
      ["review", null, "producer independent A3 review drift"],
      ["review.auditFloor", "A2", "producer independent A3 review drift"],
      ["review.assessment", "UNKNOWN", "producer independent A3 review drift"],
      ["review.builder", "reviewer", "producer independent A3 review drift"],
      ["review.reviewer", "builder", "producer independent A3 review drift"],
      ["review.headSha", "0".repeat(40), "producer independent A3 review drift"],
      ["review.commentId", 0, "producer independent A3 review drift"],
      ["checks.0.checkRunId", 0, "producer completion check drift: kernel"],
      ["checks.0.headSha", "0".repeat(40), "producer completion check drift: kernel"],
      ["checks.0.conclusion", "failure", "producer completion check drift: kernel"],
      ["checks", [], "producer completion check drift: protocol"],
    ];
    for (const [dotted, value, expected] of cases) {
      const changed = structuredClone(original);
      setPath(changed, dotted, value);
      const errors = collectSdkPinErrors({
        ...VENDORED_SDK_PIN_INPUTS,
        producerProvenanceRaw: canonicalStringify(changed),
      });
      expect(errors, dotted).toContain("producer provenance bytes drift");
      expect(errors, dotted).toContain(expected);
    }
    expect(collectSdkPinErrors({ ...VENDORED_SDK_PIN_INPUTS, producerProvenanceRaw: "{" })).toContain(
      "producer provenance JSON drift",
    );
    const withoutChecks = structuredClone(original);
    setPath(withoutChecks, "checks", null);
    expect(collectSdkPinErrors({
      ...VENDORED_SDK_PIN_INPUTS,
      producerProvenanceRaw: canonicalStringify(withoutChecks),
    })).toContain("producer completion checks drift");
    const extraField = structuredClone(original);
    extraField.extra = false;
    expect(collectSdkPinErrors({
      ...VENDORED_SDK_PIN_INPUTS,
      producerProvenanceRaw: canonicalStringify(extraField),
    })).toContain("producer provenance field set drift");
  });

  it("rejects a later or foreign tuple", { timeout: 30_000 }, () => {
    const changed = (dotted: string, value: unknown): string => {
      const copy = manifestValue();
      setPath(copy, dotted, value);
      return canonicalStringify(copy);
    };
    for (const manifestRaw of [
      changed("profile_kind", "SEMANTIC_CONFORMANCE"),
      changed("profile_revision", "bootstrap-2"),
      changed("producer.repository", "BeautifulMind-JT/kix-protocol"),
      changed("producer.source_commit", "0".repeat(40)),
      changed("producer.source_tree", "0".repeat(40)),
      changed("producer.protocol_domain", "other-domain"),
      changed("producer.contract_schema_version", "other"),
      changed("contract.contract_only.path", "other"),
      changed("contract.contract_only.sha256", "0".repeat(64)),
      changed("contract.contract_only.gitBlob", "0".repeat(40)),
      changed("contract.integration_gate.path", "other"),
      changed("contract.integration_gate.sha256", "0".repeat(64)),
      changed("contract.integration_gate.gitBlob", "0".repeat(40)),
      changed("generator.path", "other"),
      changed("generator.sha256", "0".repeat(64)),
      changed("generator.toolchain", "other"),
      changed("sdk_output.path", "other"),
      changed("sdk_output.sha256", "0".repeat(64)),
      changed("source_references.extension_profile", true),
      changed("source_references.fixture_profile", "other"),
    ]) {
      const errors = collectSdkPinErrors({ ...VENDORED_SDK_PIN_INPUTS, manifestRaw });
      expect(errors.length).toBeGreaterThan(0);
      expect(() => {
        if (errors.length > 0) {
          throw new ProtocolError(`SDK pin check failed: ${errors.join("; ")}`);
        }
      }).toThrow(ProtocolError);
    }
  });

  it("replays the shared mixed-input golden vectors against the manifest verifier", { timeout: 30_000 }, () => {
    const mixed = parseStrict(VENDORED_SDK_PIN_INPUTS.mixedVectorsRaw) as Record<string, unknown>;
    expect(mixed.profile).toBe("kix-compat-mixed-input/1");
    const original = manifestValue();
    for (const item of mixed.cases as Record<string, unknown>[]) {
      let manifestRaw: string;
      if (item.op === "truncate") {
        manifestRaw = VENDORED_SDK_PIN_INPUTS.manifestRaw.slice(0, -1);
      } else if (item.op === "duplicate-key") {
        manifestRaw = `{"contract":{},${VENDORED_SDK_PIN_INPUTS.manifestRaw.slice(1)}`;
      } else {
        const copy = manifestValue();
        const value = item.op === "copy" ? getPath(original, String(item.from)) : item.value;
        setPath(copy, String(item.path), value);
        manifestRaw = canonicalStringify(copy);
      }
      const errors = collectSdkPinErrors({ ...VENDORED_SDK_PIN_INPUTS, manifestRaw });
      expect(errors.length, String(item.name)).toBeGreaterThan(0);
    }
  });

  it("replays the shared canonical-encoding golden vectors", () => {
    const raw = VENDORED_SDK_PIN_INPUTS.canonicalVectorsRaw;
    const document = parseStrict(raw) as Record<string, unknown>;
    expect(document.encoding_profile).toBe("kix-canonical-json/1");
    expect(canonicalStringify(document)).toBe(raw);
    for (const item of document.cases as Record<string, unknown>[]) {
      if (item.expect === "accept") {
        const value = parseStrict(String(item.input));
        expect(canonicalStringify(value), String(item.name)).toBe(item.canonical);
        expect(item.input, String(item.name)).toBe(item.canonical);
      } else {
        const input = item.input_hex === undefined ? String(item.input) : Buffer.from(String(item.input_hex), "hex");
        let thrown: unknown;
        try {
          parseStrict(input);
        } catch (error) {
          thrown = error;
        }
        expect(thrown, String(item.name)).toBeInstanceOf(StrictJsonError);
        expect((thrown as StrictJsonError).reason, String(item.name)).toBe(item.reason);
      }
    }
  });

  it("binds the generated catalogue to the vendored contract-only OpenAPI", () => {
    const doc = JSON.parse(VENDORED_SDK_PIN_INPUTS.contractOnlyOpenApiRaw) as {
      components: { schemas: Record<string, unknown> };
    };
    const names = Object.keys(doc.components.schemas).filter((name) => name !== "LocalCallEnvelope");
    expect([...COMMANDS]).toEqual(names);
    expect([...PINNED_ACTIONS]).toEqual([...COMMANDS]);
    expect(PINNED_ACTIONS).toBe(COMMANDS);
    expect(OPENAPI_PIN.sha256).toBe(OPENAPI_CONTRACT_PIN.openApiFileSha256);
    expect(OPENAPI_PIN.gitBlob).toBe(gitBlobId(new TextEncoder().encode(VENDORED_SDK_PIN_INPUTS.contractOnlyOpenApiRaw)));
    expect(OPENAPI_PIN.domain).toBe(PINNED_PROTOCOL_DOMAIN);
    expect(OPENAPI_PIN.commandCount).toBe(40);
    expect(OPENAPI_PIN.liveHttpServer).toBe(false);
    expect(OPENAPI_PIN.productionEndpoint).toBe(false);
    expect([...ENVELOPE_REQUIRED]).toEqual(["operationId", "actor", "action", "body"]);
    for (const name of names) {
      expect(ACTION_BODY_MAP[name as keyof typeof ACTION_BODY_MAP]).toBe(`#/components/schemas/${name}`);
      expect((COMMAND_SCHEMAS as Record<string, unknown>)[name]).toEqual(doc.components.schemas[name]);
      expect(((COMMAND_SCHEMAS as Record<string, Record<string, unknown>>)[name]).additionalProperties).toBe(false);
    }
    const manifest = manifestValue();
    const contract = manifest.contract as Record<string, Record<string, unknown>>;
    expect(contract.contract_only.sha256).toBe(OPENAPI_CONTRACT_PIN.openApiFileSha256);
    expect(contract.integration_gate.sha256).toBe(OPENAPI_INTEGRATION_GATE_PIN.openApiFileSha256);
    expect(contract.integration_gate.gitBlob).toBe(
      gitBlobId(new TextEncoder().encode(VENDORED_SDK_PIN_INPUTS.integrationGateOpenApiRaw)),
    );
  });

  it("rejects a drifted sdk-pin file and manifest sidecar", { timeout: 30_000 }, () => {
    const pin = JSON.parse(VENDORED_SDK_PIN_INPUTS.sdkPinFileRaw) as Record<string, unknown>;
    const pinCases: ReadonlyArray<readonly [string, unknown, string]> = [
      ["commandCount", 0, "sdk-pin command count drift"],
      ["domain", "other", "sdk-pin domain drift"],
      ["generatedCatalogue", "other", "sdk-pin path drift"],
      ["generator", "other", "sdk-pin path drift"],
      ["openapi", null, "sdk-pin OpenAPI binding drift"],
      ["openapi.gitBlob", "0".repeat(40), "sdk-pin OpenAPI binding drift"],
      ["openapi.path", "other", "sdk-pin OpenAPI binding drift"],
      ["openapi.sha256", "0".repeat(64), "sdk-pin OpenAPI binding drift"],
      ["source", null, "sdk-pin source binding drift"],
      ["source.domain", "other", "sdk-pin source binding drift"],
      ["source.gitBlob", "0".repeat(40), "sdk-pin source binding drift"],
      ["source.path", "other", "sdk-pin source binding drift"],
      ["source.sha256", "0".repeat(64), "sdk-pin source binding drift"],
      ["sourceAuthentication", "OTHER", "sdk-pin source marker drift"],
      ["unknownFields", "ALLOW", "sdk-pin source marker drift"],
    ];
    for (const [dotted, value, expected] of pinCases) {
      const changed = structuredClone(pin);
      setPath(changed, dotted, value);
      expect(collectSdkPinErrors({ ...VENDORED_SDK_PIN_INPUTS, sdkPinFileRaw: JSON.stringify(changed) }), dotted).toContain(
        expected,
      );
    }
    expect(collectSdkPinErrors({ ...VENDORED_SDK_PIN_INPUTS, sdkPinFileRaw: "{" })).toContain(
      "sdk-pin file is not JSON",
    );
    expect(collectSdkPinErrors({ ...VENDORED_SDK_PIN_INPUTS, sdkPinFileRaw: "[]" })).toContain(
      "sdk-pin file is not an object",
    );
    expect(collectSdkPinErrors({ ...VENDORED_SDK_PIN_INPUTS, sidecarRaw: "bad" })).toContain(
      "manifest sidecar form drift",
    );
    expect(collectSdkPinErrors({
      ...VENDORED_SDK_PIN_INPUTS,
      sidecarRaw: `${"0".repeat(64)}\n`,
    })).toContain("manifest sidecar digest drift");
  });

  it("rejects drifted profile or manifest fields", { timeout: 30_000 }, () => {
    const profile = parseStrict(VENDORED_SDK_PIN_INPUTS.profileRaw) as Record<string, unknown>;
    const profileCases: ReadonlyArray<readonly [string, unknown, string]> = [
      ["profile_kind", "SEMANTIC_CONFORMANCE", "profile identity mismatch"],
      ["profile_revision", "other", "profile identity mismatch"],
      ["manifest_schema_version", "other", "profile manifest_schema_version drift"],
      ["grants", "other", "BOOTSTRAP grants drift"],
      ["vectors", [], "profile and manifest vectors differ"],
      ["catalogue.openapi_path", "other", "catalogue openapi binding drift"],
      ["catalogue.openapi_sha256", "0".repeat(64), "catalogue openapi binding drift"],
      ["catalogue.command_set_sha256", "0".repeat(64), "command set digest drift"],
      ["catalogue.schema_digests", {}, "schema digest map drift"],
    ];
    for (const [dotted, value, expected] of profileCases) {
      const changed = structuredClone(profile);
      setPath(changed, dotted, value);
      expect(collectSdkPinErrors({ ...VENDORED_SDK_PIN_INPUTS, profileRaw: canonicalStringify(changed) }), dotted).toContain(
        expected,
      );
    }
    expect(collectSdkPinErrors({ ...VENDORED_SDK_PIN_INPUTS, profileRaw: "{" })).toContain("profile truncated");
    expect(collectSdkPinErrors({ ...VENDORED_SDK_PIN_INPUTS, profileRaw: "null" })).toContain("profile is not an object");
    const manifest = manifestValue();
    const manifestCases: ReadonlyArray<readonly [string, unknown]> = [
      ["producer", null],
      ["contract", null],
      ["contract.contract_only", null],
      ["contract.integration_gate", null],
      ["generator", null],
      ["sdk_output", null],
      ["source_references", null],
      ["vectors", null],
      ["vectors", [{}]],
      ["vectors", [{ name: "bad", path: "../bad", sha256: "0".repeat(64) }]],
    ];
    for (const [dotted, value] of manifestCases) {
      const changed = structuredClone(manifest);
      setPath(changed, dotted, value);
      expect(collectSdkPinErrors({ ...VENDORED_SDK_PIN_INPUTS, manifestRaw: canonicalStringify(changed) }).length, dotted)
        .toBeGreaterThan(0);
    }
  });

  it("rejects drifted producer provenance and a forbidden client surface token", { timeout: 30_000 }, () => {
    expect(collectSdkPinErrors({ ...VENDORED_SDK_PIN_INPUTS, producerProvenanceRaw: "null" })).toContain(
      "producer provenance canonical form drift",
    );
    for (const token of ["http://", "https://", "fetch(", "baseUrl", "baseURL", "Authorization", "retry", "authenticate"]) {
      expect(collectSdkPinErrors({ ...VENDORED_SDK_PIN_INPUTS, clientRaw: token })).toContain(
        `client surface carries ${token}`,
      );
      expect(collectSdkPinErrors({ ...VENDORED_SDK_PIN_INPUTS, catalogueRaw: token })).toContain(
        `catalogue carries ${token}`,
      );
    }
  });

  it("keeps the client surface free of a URL, credential, or repeat-call API", () => {
    for (const token of ["http://", "https://", "fetch(", "baseUrl", "baseURL", "Authorization", "retry", "authenticate"]) {
      expect(carriesSurfaceToken(VENDORED_SDK_PIN_INPUTS.clientRaw, token), token).toBe(false);
      expect(carriesSurfaceToken(VENDORED_SDK_PIN_INPUTS.catalogueRaw, token), token).toBe(false);
    }
    // retryOf is a pinned schema field, not a repeat-call API.
    expect(carriesSurfaceToken(VENDORED_SDK_PIN_INPUTS.catalogueRaw, "retryOf")).toBe(true);
    expect(carriesSurfaceToken("noretry", "retry")).toBe(false);
    expect(carriesSurfaceToken("a.retry()", "retry")).toBe(true);
    const pin = JSON.parse(VENDORED_SDK_PIN_INPUTS.sdkPinFileRaw) as Record<string, unknown>;
    expect(pin.generatedCatalogue).toBe("sdk/generated/catalogue.ts");
    expect(pin.generator).toBe("sdk/generate/generate_client.mjs");
    expect(pin.sourceAuthentication).toBe("FIXTURE_ONLY");
    expect(pin.unknownFields).toBe("REJECT");
  });

  it("hashes known sha1 and git blob vectors", () => {
    expect(sha1Hex("abc")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(sha1Hex("")).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    expect(gitBlobId(new TextEncoder().encode("hello world\n"))).toBe(
      "3b18e512dba79e4c8300dd08aeb37f8e728b8dad",
    );
  });
});
