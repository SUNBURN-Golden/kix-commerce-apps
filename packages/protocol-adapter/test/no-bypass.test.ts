import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const webSrc = path.join(repoRoot, "apps/web/src");
const adapterSrc = path.join(repoRoot, "packages/protocol-adapter/src");

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }
    if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      found.push(full);
    }
  }
  return found;
}

describe("protocol seam", () => {
  it("keeps the web app on the protocol adapter", () => {
    const files = sourceFiles(webSrc);
    const combined = files.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(combined).not.toContain("PROVISIONAL_HTTP_PATHS");
    expect(combined).not.toContain("/v1/commerce");
    expect(combined).not.toContain("/x-kix-contract-only");
    expect(combined).not.toContain("invokeLocalCall");
    expect(combined).not.toContain("fetch(");
    expect(combined).not.toContain("settlement_fsm");
    expect(combined).not.toContain("reservation_fsm");
    expect(combined).not.toContain("resale_fsm");
    expect(combined).not.toContain("credit_fsm");
    expect(combined).not.toContain("mock_credit");
    expect(combined).not.toContain("mock_gates");
    expect(combined).not.toContain("settle_capture");

    const protocolFiles = files.filter((file) => readFileSync(file, "utf8").includes("createProtocol"));
    expect(protocolFiles.map((file) => path.basename(file))).toEqual(["protocol.ts"]);

    const allowed = new Set([
      "react",
      "react-dom",
      "react-dom/client",
      "react-router-dom",
      "@kix/protocol-adapter",
    ]);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
        const specifier = match[1] ?? "";
        if (specifier.startsWith(".")) {
          continue;
        }
        expect(allowed.has(specifier), `${path.relative(repoRoot, file)} imports ${specifier}`).toBe(true);
      }
    }
  });

  it("removes provisional REST paths from the adapter", () => {
    const combined = sourceFiles(adapterSrc).map((file) => readFileSync(file, "utf8")).join("\n");
    expect(combined).not.toContain("PROVISIONAL_HTTP_PATHS");
    expect(combined).not.toContain("/v1/commerce");
  });
});
