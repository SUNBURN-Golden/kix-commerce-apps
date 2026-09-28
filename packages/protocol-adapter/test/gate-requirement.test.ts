import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { OPENAPI_INTEGRATION_GATE_PIN } from "../src/index.js";
import { gateRequired } from "./support/reviewed-gate.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("live gate requirement", () => {
  it("skips only on a local run with nothing configured", () => {
    expect(gateRequired({})).toBe(false);
    expect(gateRequired({ KIX_REQUIRE_GATE: "1" })).toBe(true);
    expect(gateRequired({ KIX_PROTOCOL_ROOT: "/wrong/path" })).toBe(true);
    expect(gateRequired({ CI: "true" })).toBe(true);
    expect(gateRequired({ CI: "true", KIX_REQUIRE_GATE: "0" })).toBe(false);
  });
});

describe("CI workflow", () => {
  it("checks out the gate at the pinned protocol merge and requires it in that job only", () => {
    const workflow = readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");
    const pinned = workflow.match(/KIX_PROTOCOL_GATE_SHA: ([0-9a-f]{40})/);
    expect(pinned?.[1]).toBe(OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha);
    expect(workflow).toContain("repository: BeautifulMind-JT/kix-protocol");
    expect(workflow).toContain("KIX_REQUIRE_GATE: '1'");
    expect(workflow).toContain("KIX_REQUIRE_GATE: '0'");
  });
});
