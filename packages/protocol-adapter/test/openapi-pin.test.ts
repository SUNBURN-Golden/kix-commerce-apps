import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  COMMERCE_METHODS,
  OPENAPI_CONTRACT_PIN,
  PINNED_ACTIONS,
  ProtocolError,
  RESALE_DEPTH_BASELINE,
  RESERVATION_DEPTH_BASELINE,
  SETTLEMENT_DEPTH_BASELINE,
  assertOpenApiContractDocument,
  assertOpenApiContractRaw,
  isPinnedAction,
  readPinnedOpenApiDocument,
} from "../src/index.js";
import { sha256Hex } from "../src/sha256.js";

const vendorPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../vendor/kix-protocol.contract-only.openapi.json",
);

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected object");
  }
  return value as Record<string, unknown>;
}

describe("contract-only OpenAPI pin", () => {
  it("hashes the vendored file to the published sha256", () => {
    const bytes = readFileSync(vendorPath);
    const digest = createHash("sha256").update(bytes).digest("hex");
    expect(digest).toBe(OPENAPI_CONTRACT_PIN.openApiFileSha256);
    expect(sha256Hex(bytes)).toBe(digest);
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe(createHash("sha256").update("abc").digest("hex"));
    expect(() => assertOpenApiContractRaw(bytes.toString("utf8"))).not.toThrow();
  });

  it("records the merged protocol tip and contract-only flags", () => {
    expect(OPENAPI_CONTRACT_PIN.protocolRepo).toBe("BeautifulMind-JT/kix-protocol");
    expect(OPENAPI_CONTRACT_PIN.protocolMainSha).toBe("a744b0a036d7e1edb48416871af20cd182f23df4");
    expect(OPENAPI_CONTRACT_PIN.openApiPath).toBe("docs/contracts/openapi/kix-protocol.contract-only.openapi.json");
    expect(OPENAPI_CONTRACT_PIN.infoVersion).toBe(
      "0.3-rc1+sha256:ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e",
    );
    expect(OPENAPI_CONTRACT_PIN.sourceProtocolContractSha256).toBe(
      "ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e",
    );
    expect(OPENAPI_CONTRACT_PIN.contractStatus).toBe("contract-only");
    expect(OPENAPI_CONTRACT_PIN.liveHttpServer).toBe(false);
    expect(OPENAPI_CONTRACT_PIN.productionEndpoint).toBe(false);
    expect(OPENAPI_CONTRACT_PIN.openApiFileSha256).toBe(
      "fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e",
    );
    expect(SETTLEMENT_DEPTH_BASELINE.protocolRepo).toBe("BeautifulMind-JT/kix-protocol");
    expect(SETTLEMENT_DEPTH_BASELINE.protocolMainSha).toBe("85145eb33799a7c712890ff81708def8a7d61ee5");
    expect(SETTLEMENT_DEPTH_BASELINE.featureCommit).toBe("838370d9ce8e8aeeceeb94f3b4d212204e7ecf19");
    expect(SETTLEMENT_DEPTH_BASELINE.fsmPath).toBe("reference/settlement_f01_f03/settlement_fsm.py");
    expect(SETTLEMENT_DEPTH_BASELINE.provenance).toBe("MOCK_SETTLEMENT_ONLY");
    expect(RESERVATION_DEPTH_BASELINE.protocolRepo).toBe("BeautifulMind-JT/kix-protocol");
    expect(RESERVATION_DEPTH_BASELINE.protocolMainSha).toBe("a47828dd4517c5a7397e09eb6b563a64e4265c82");
    expect(RESERVATION_DEPTH_BASELINE.featureCommit).toBe("2183d0b5b5010ec2692c43c277e99926ad9250db");
    expect(RESERVATION_DEPTH_BASELINE.fsmPath).toBe("reference/booking_resale_admission/reservation_fsm.py");
    expect(RESERVATION_DEPTH_BASELINE.provenance).toBe("MOCK_GATE_ONLY");
    expect(RESALE_DEPTH_BASELINE.protocolRepo).toBe("BeautifulMind-JT/kix-protocol");
    expect(RESALE_DEPTH_BASELINE.protocolMainSha).toBe("ef942b7713c7468e8851c6b372b64d42b5333ad8");
    expect(RESALE_DEPTH_BASELINE.featureCommit).toBe("70c6d52d4289e23d0d4141b7f3a6b310eea236f2");
    expect(RESALE_DEPTH_BASELINE.fsmPath).toBe("reference/booking_resale_admission/resale_fsm.py");
    expect(RESALE_DEPTH_BASELINE.provenance).toBe("MOCK_GATE_ONLY");
    expect(isPinnedAction("initiate")).toBe(false);
    expect(isPinnedAction("reconcile")).toBe(false);
    expect(isPinnedAction("reject_external")).toBe(false);
    expect(PINNED_ACTIONS).toHaveLength(40);
    expect(isPinnedAction("admit")).toBe(true);
    expect(isPinnedAction("invokeLocalCall")).toBe(false);
    expect(isPinnedAction("list_performances")).toBe(false);
  });

  it("rejects a wrong OpenAPI file sha256", () => {
    const raw = readFileSync(vendorPath, "utf8").replace("contract-only", "draft-status");
    expect(() => assertOpenApiContractRaw(raw)).toThrow(/OpenAPI file sha256 mismatch/);
    expect(() => assertOpenApiContractRaw(raw)).toThrow(ProtocolError);
  });

  it("rejects a wrong info.version", () => {
    const doc = asRecord(readPinnedOpenApiDocument());
    const info = asRecord(doc.info);
    info.version = "0.3-rc1+sha256:0000000000000000000000000000000000000000000000000000000000000000";
    expect(() => assertOpenApiContractDocument(doc)).toThrow(/info\.version mismatch/);
  });

  it("rejects a wrong contract status", () => {
    const doc = asRecord(readPinnedOpenApiDocument());
    doc["x-kix-contract-status"] = "live";
    expect(() => assertOpenApiContractDocument(doc)).toThrow(/contract status mismatch/);
  });

  it("rejects a pin that claims a live HTTP server or a production endpoint", () => {
    const live = asRecord(readPinnedOpenApiDocument());
    live["x-kix-live-http-server"] = true;
    expect(() => assertOpenApiContractDocument(live)).toThrow(/x-kix-live-http-server false/);

    const production = asRecord(readPinnedOpenApiDocument());
    production["x-kix-production-endpoint"] = true;
    expect(() => assertOpenApiContractDocument(production)).toThrow(/x-kix-production-endpoint false/);

    const servers = asRecord(readPinnedOpenApiDocument());
    servers.servers = [{ url: "https://protocol.example.test" }];
    expect(() => assertOpenApiContractDocument(servers)).toThrow(/must not publish servers/);
  });

  it("rejects a wrong source protocol_contract sha256", () => {
    const doc = asRecord(readPinnedOpenApiDocument());
    const source = asRecord(doc["x-kix-source"]);
    source.sha256 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(() => assertOpenApiContractDocument(doc)).toThrow(/protocol_contract sha256 mismatch/);
  });

  it("keeps every desk method not-bound to a real command body", () => {
    expect(Object.keys(COMMERCE_COMMAND_BINDINGS)).toEqual([...COMMERCE_METHODS]);
    for (const binding of Object.values(COMMERCE_COMMAND_BINDINGS)) {
      expect(binding.status).toBe("not-bound");
      if (binding.consideredAction) {
        expect(isPinnedAction(binding.consideredAction)).toBe(true);
      }
    }
  });
});
