import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    return statSync(file).isDirectory() ? sourceFiles(file) : /\.(ts|tsx)$/.test(name) ? [file] : [];
  });
}

describe("untrusted render static guard", () => {
  it("keeps executable HTML and script sinks out of web runtime source", () => {
    const banned: readonly [string, RegExp][] = [
      ["dangerous React HTML", /dangerouslySetInnerHTML/],
      ["innerHTML assignment", /\.innerHTML\s*=/],
      ["eval", /\beval\s*\(/],
      ["Function constructor", /\bnew\s+Function\s*\(/],
      ["javascript URL", /["'`]javascript:/i],
      ["document.write", /document\.write\s*\(/],
    ];
    for (const file of sourceFiles(path.join(webRoot, "src"))) {
      const source = readFileSync(file, "utf8");
      for (const [label, pattern] of banned) {
        expect(pattern.test(source), `${path.relative(webRoot, file)} contains ${label}`).toBe(false);
      }
    }
  });
});
