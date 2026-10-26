import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { KIX_SDK_0_PIN, OPENAPI_CONTRACT_PIN, OPENAPI_INTEGRATION_GATE_PIN } from "@kix/protocol-adapter";
import { computeBuildIdentity, PIN_DIGEST_FIELDS } from "../build-identity";
import { buildIdentity } from "../src/diagnostics/build-identity";
import { sweepExport } from "../src/receipt-redaction";

const pins = { OPENAPI_CONTRACT_PIN, OPENAPI_INTEGRATION_GATE_PIN, KIX_SDK_0_PIN };
describe("deterministic app-internal build identity", () => {
  it("recomputes the injected digest independently from adapter constants", () => {
    const fields = PIN_DIGEST_FIELDS.flatMap(([name, keys]) => keys.map((key) => [name, key, (pins[name] as Record<string, unknown>)[key]]));
    expect(buildIdentity).toEqual(computeBuildIdentity());
    expect(computeBuildIdentity()).toEqual(computeBuildIdentity());
    expect(buildIdentity.pinDigest).toBe(createHash("sha256").update(JSON.stringify(fields)).digest("hex"));
    expect(buildIdentity.appVersion).toBe(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version);
    expect(sweepExport(JSON.stringify(buildIdentity))).toBe(JSON.stringify(buildIdentity));
  });
  it("covers independently enumerated digest fields and explicitly checks the excluded alias", () => {
    for (const [name, pin] of Object.entries(pins)) {
      const expected = Object.keys(pin).filter((key) => key.endsWith("Sha256") && key !== "contractOnlyOpenApiFileSha256");
      const covered = PIN_DIGEST_FIELDS.find(([id]) => id === name)?.[1] ?? [];
      for (const key of expected) expect(covered, `${name}.${key}`).toContain(key);
    }
    expect(PIN_DIGEST_FIELDS[2][1]).toContain("producerSourceSha256");
    expect(OPENAPI_INTEGRATION_GATE_PIN.contractOnlyOpenApiFileSha256).toBe(OPENAPI_CONTRACT_PIN.openApiFileSha256);
  });
  it("has no ambient variable, clock, random, or repository revision inputs", () => {
    const source = readFileSync(new URL("../build-identity.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/Date|Math\.random|process\.env|child_process|\bgit\b/);
  });
  it.skipIf(!existsSync(new URL("../dist/assets", import.meta.url)))("ships the complete identity and keeps the lazy route under 30000 gzip bytes", () => {
    const dir = new URL("../dist/assets/", import.meta.url);
    const files = readdirSync(dir).filter((name) => /^Diagnostics-.*\.js$/.test(name));
    expect(files).toHaveLength(1);
    const bytes = readFileSync(new URL(files[0]!, dir));
    expect(gzipSync(bytes, { level: 9 }).length).toBeLessThan(30000);
    for (const value of [buildIdentity.appVersion, buildIdentity.pinDigestAlgorithm, buildIdentity.pinDigest, ...Object.values(buildIdentity.pins)]) expect(bytes.toString()).toContain(value);
  });
});
