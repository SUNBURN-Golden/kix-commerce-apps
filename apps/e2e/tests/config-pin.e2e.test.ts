import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { recordCheck } from "../src/run-record";
import a11yConfig from "../vitest.a11y.config";
import budgetConfig from "../vitest.budget.config";
import e2eConfig from "../vitest.config";
import visualConfig from "../vitest.visual.config";

const e2eRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(e2eRoot, "../..");
const read = (file: string): string => fs.readFileSync(path.join(e2eRoot, file), "utf8");

/**
 * The browser suites run with no retry and a fixed test timeout. A flaky test is fixed at its cause, never by
 * retrying it or by waiting longer. These values are pinned here, so a change to one has to change this file in plain view.
 */
const PINNED = [
  { file: "vitest.config.ts", config: e2eConfig, testTimeout: 60_000 },
  { file: "vitest.a11y.config.ts", config: a11yConfig, testTimeout: 120_000 },
  { file: "vitest.budget.config.ts", config: budgetConfig, testTimeout: 120_000 },
  { file: "vitest.visual.config.ts", config: visualConfig, testTimeout: 60_000 },
] as const;

const HOOK_TIMEOUT = 180_000;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

describe("browser suite timeouts and retries are pinned", () => {
  it("every vitest config keeps retry: 0, its testTimeout and its hookTimeout, as text and as parsed values", () => {
    for (const { file, config, testTimeout } of PINNED) {
      const text = read(file);
      const literal = (value: number) => value.toLocaleString("en-US").replace(/,/g, "_");
      expect(text, `${file} retry`).toContain("    retry: 0,\n");
      expect(text, `${file} testTimeout`).toContain(`    testTimeout: ${literal(testTimeout)},\n`);
      expect(text, `${file} hookTimeout`).toContain(`    hookTimeout: ${literal(HOOK_TIMEOUT)},\n`);
      expect(text.match(/retry/g), `${file} names retry once`).toHaveLength(1);
      expect(text.match(/testTimeout/g), `${file} names testTimeout once`).toHaveLength(1);
      expect(text.match(/hookTimeout/g), `${file} names hookTimeout once`).toHaveLength(1);
      expect(config.test?.retry, `${file} parsed retry`).toBe(0);
      expect(config.test?.testTimeout, `${file} parsed testTimeout`).toBe(testTimeout);
      expect(config.test?.hookTimeout, `${file} parsed hookTimeout`).toBe(HOOK_TIMEOUT);
      expect(config.test?.fileParallelism, `${file} runs one file at a time`).toBe(false);
    }
    recordCheck("harness.config-pin");
  });

  it("no script, workflow or test file changes retry or a timeout by another route", () => {
    const scripts = Object.values((JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts).join("\n");
    const rootScripts = Object.values((JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")) as { scripts: Record<string, string> }).scripts).join("\n");
    const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");
    for (const [where, text] of [["apps/e2e scripts", scripts], ["root scripts", rootScripts], ["ci.yml", workflow]] as const) {
      expect(text, `${where} passes no --retry`).not.toMatch(/--retry/);
      expect(text, `${where} passes no --testTimeout`).not.toMatch(/--(?:testTimeout|test-timeout|hookTimeout|hook-timeout)/);
    }
    const self = fileURLToPath(import.meta.url);
    for (const file of [...sourceFiles(path.join(e2eRoot, "tests")), ...sourceFiles(path.join(e2eRoot, "src"))]) {
      if (file === self) {
        continue;
      }
      const text = fs.readFileSync(file, "utf8");
      const where = path.relative(e2eRoot, file);
      expect(text, `${where} sets no vitest config at run time`).not.toMatch(/\bvi\.setConfig|\bvitest\.setConfig|\btestTimeout\b|\bhookTimeout\b/);
      expect(text, `${where} retries nothing`).not.toMatch(/\bretry\s*:|\.retry\(/);
      // A numeric last argument to it/test/describe, or a { timeout } or { retry } option object, would override the config for one test.
      expect(text, `${where} gives no test its own timeout`).not.toMatch(/^\s*\}\s*,\s*\d[\d_]*\s*\)\s*;?\s*$/m);
      expect(text, `${where} gives no test its own options`).not.toMatch(/\b(?:it|test|describe)(?:\.\w+)*\(\s*(?:"[^"\n]*"|'[^'\n]*'|`[^`\n]*`)\s*,\s*\{/);
    }
    recordCheck("harness.config-pin");
  });
});
