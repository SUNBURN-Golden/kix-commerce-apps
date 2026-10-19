#!/usr/bin/env node
/**
 * Run npm audit on production dependencies and print the report.
 *
 * This is a WARNING-ONLY gate: it always exits 0 so that CI is not blocked by
 * transient registry issues or unfixed advisories that do not affect the stub
 * demo paths. The offline deps-check gate is the blocking check.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log("Running npm audit --omit=dev (warning only)");
const result = spawnSync("npm", ["audit", "--omit=dev"], {
  cwd: root,
  stdio: "inherit",
});

if (result.status !== 0) {
  console.log("\nnpm audit reported production advisories (warning only; not blocking).");
}
process.exit(0);
