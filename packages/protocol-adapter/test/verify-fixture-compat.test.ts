import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, it } from "vitest";
import { assertReviewedCheckout, findProtocolRoot, gateRequired, protocolRoot } from "./support/reviewed-gate.js";

const revision = "commerce-fixture-8ba7f6c-1";
const manifestPath = `sdk/compat/manifests/manifest.${revision}.json`;
const profilePath = `sdk/compat/profiles/${revision}.profile.json`;
const manifestSha = "76ea72c6249ec0f90cb426dfbb8efda8308610f79c4f0ac6ff0a2445cab59a4f";
const expectedResult = {
  ok: true, manifest_sha256: manifestSha, profile_kind: "SEMANTIC_CONFORMANCE", profile_revision: revision,
};
const protocolSha = "4472b0fb64d377d97fd2993673a4485459986606";
const vendor = new URL("../vendor/", import.meta.url);
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

type FileRef = { path: string; sha256: string };
const ledger = JSON.parse(readFileSync(new URL("commerce-journey/provenance.json", vendor), "utf8")) as {
  protocolMergeSha: string;
  files: Record<string, { sha256: string; gitBlob: string }>;
};
const openApiPaths = [
  "docs/contracts/openapi/kix-protocol.contract-only.openapi.json",
  "docs/contracts/openapi/kix-protocol.integration-gate.openapi.json",
];

function vendored(path: string): Buffer {
  if (path.startsWith("sdk/")) return readFileSync(new URL(path.replace("sdk/", "kix-sdk-0/"), vendor));
  return readFileSync(new URL(openApiPaths.includes(path) ? path.split("/").at(-1)! : `commerce-journey/${path}`, vendor));
}

const manifest = JSON.parse(vendored(manifestPath).toString("utf8")) as {
  profile_kind: string;
  profile_revision: string;
  profile_sha256: string;
  contract: { contract_only: FileRef; integration_gate: FileRef };
  producer: { source_commit: string };
  generator: FileRef;
  sdk_output: FileRef;
  source_references: { extension_profile: FileRef };
  vectors: FileRef[];
};

it("verifies the published manifest digest and vendored identity on every Node version", () => {
  expect(sha256(vendored(manifestPath))).toBe(manifestSha);
  expect(vendored(manifestPath + ".sha256").toString("utf8")).toBe(manifestSha + "\n");
  expect(manifest.profile_kind).toBe("SEMANTIC_CONFORMANCE");
  expect(manifest.profile_revision).toBe(revision);
  expect(manifest.producer.source_commit).toBe("8ba7f6c36373ac0ec49246f51f7471c164ac3a28");
  expect(sha256(vendored(profilePath))).toBe(manifest.profile_sha256);
  expect(ledger.protocolMergeSha).toBe(protocolSha);
  for (const ref of [...Object.values(manifest.contract), manifest.generator, manifest.sdk_output,
    manifest.source_references.extension_profile, ...manifest.vectors]) {
    expect(sha256(vendored(ref.path)), ref.path).toBe(ref.sha256);
  }
  for (const [path, entry] of Object.entries(ledger.files)) {
    const bytes = vendored(path);
    expect(sha256(bytes), path).toBe(entry.sha256);
    expect(createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex"), path).toBe(entry.gitBlob);
  }
});

const hasCheckout = process.env.KIX_REQUIRE_GATE !== "0" && (findProtocolRoot() !== null || gateRequired());
const node24 = process.versions.node.split(".")[0] === "24";

it.skipIf(!hasCheckout)("matches the clean pinned checkout byte for byte", () => {
  const root = protocolRoot();
  assertReviewedCheckout(root);
  expect(execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()).toBe(protocolSha);
  for (const path of [...openApiPaths, ...Object.keys(ledger.files)]) {
    expect(vendored(path).equals(readFileSync(join(root, path))), path).toBe(true);
  }
});

function expectProducerVerifierPass(root: string) {
  expect(sha256(readFileSync(join(root, manifestPath)))).toBe(manifestSha);
  const output = execFileSync(process.execPath, [
    "sdk/compat/verify_compat.mjs", "--manifest", manifestPath, "--expect-kind", "SEMANTIC_CONFORMANCE",
    "--expect-revision", revision,
  ], { cwd: root, encoding: "utf8" });
  expect(JSON.parse(output)).toEqual(expectedResult);
}

if (!node24) console.info("Skipping producer verifier CLI: pinned toolchains.json requires Node 24.");
if (!hasCheckout) console.info("Skipping pinned-checkout comparisons: reviewed gate checkout not requested or available.");

it.skipIf(!node24)("passes the Node 24 producer verifier against vendored bytes staged in producer layout", () => {
  const staging = mkdtempSync(join(tmpdir(), "kix-fixture-compat-"));
  try {
    // The unmodified verifier resolves source references relative to its own file.
    for (const path of [...openApiPaths, ...Object.keys(ledger.files)]) {
      const destination = join(staging, path);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, vendored(path));
    }
    expectProducerVerifierPass(staging);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
});

it.skipIf(!node24 || !hasCheckout)("passes the Node 24 producer verifier in the pinned checkout", () => {
  expectProducerVerifierPass(protocolRoot());
});
