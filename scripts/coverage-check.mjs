#!/usr/bin/env node
/**
 * Run vitest with coverage for each measured workspace and enforce the floors
 * recorded in coverage-floors.json.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const floors = JSON.parse(readFileSync(path.join(root, "coverage-floors.json"), "utf8"));

const workspaces = [
  { name: "@kix/protocol-adapter", dir: "packages/protocol-adapter" },
  { name: "@kix/web", dir: "apps/web" },
];

const metrics = ["lines", "functions", "branches", "statements"];
let failed = false;

for (const ws of workspaces) {
  const floor = floors.workspaces[ws.name];
  if (!floor) {
    console.error(`No coverage floor defined for ${ws.name}`);
    failed = true;
    continue;
  }

  const allNull = metrics.every((m) => floor[m] === null);
  if (allNull) {
    console.log(`[${ws.name}] coverage floor unset (${floor.note ?? "no note"}); skipping enforcement`);
    continue;
  }

  const cwd = path.join(root, ws.dir);
  console.log(`[${ws.name}] running vitest with coverage in ${cwd}`);
  const result = spawnSync("npx", ["vitest", "run", "--coverage"], {
    cwd,
    stdio: "inherit",
    env: { ...process.env, KIX_REQUIRE_GATE: "0" },
  });
  if (result.status !== 0) {
    console.error(`[${ws.name}] vitest coverage run failed`);
    failed = true;
    continue;
  }

  const summaryPath = path.join(cwd, "coverage", "coverage-summary.json");
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  const total = summary.total ?? summary;

  for (const metric of metrics) {
    const floorValue = floor[metric];
    if (floorValue === null) continue;
    const actual = total[metric]?.pct;
    if (typeof actual !== "number") {
      console.error(`[${ws.name}] could not read ${metric} coverage from summary`);
      failed = true;
      continue;
    }
    if (actual < floorValue) {
      console.error(
        `[${ws.name}] ${metric} coverage ${actual.toFixed(2)}% is below floor ${floorValue}%`,
      );
      failed = true;
    } else {
      console.log(`[${ws.name}] ${metric} coverage ${actual.toFixed(2)}% >= floor ${floorValue}%`);
    }
  }
}

if (failed) {
  console.error("\nCoverage floor check failed.");
  process.exit(1);
}
console.log("\nAll coverage floors met.");
