import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CAMPAIGNS } from "./campaigns.js";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (/\.tsx?$/.test(entry) && !entry.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

describe("marketing stays off the protocol binding", () => {
  it("does not hard-code provisional HTTP paths or claim a live transport", () => {
    const roots = [path.join(srcDir, "marketing"), path.join(srcDir, "pages", "marketing")];
    const source = roots.flatMap((dir) => walk(dir)).map((file) => readFileSync(file, "utf8")).join("\n");
    expect(source).not.toContain("PROVISIONAL_HTTP_PATHS");
    expect(source).not.toContain("/v1/commerce");
    expect(source).not.toContain("http-adapter");
    expect(source).not.toContain("navigator.sendBeacon");
    expect(source).not.toContain("gtag");
    expect(JSON.stringify(CAMPAIGNS)).not.toContain("/v1/");
  });
});
