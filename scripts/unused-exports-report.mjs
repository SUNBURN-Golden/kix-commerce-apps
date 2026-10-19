#!/usr/bin/env node
/**
 * Run knip to produce an unused-export report.
 *
 * This is a WARNING-ONLY gate: the report is printed for review but does not
 * block CI, because many exports are intentionally public surface area of the
 * protocol-adapter package and the web desk modules.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log("Running knip --no-progress (report only)");
const result = spawnSync("npx", ["knip", "--no-progress"], {
  cwd: root,
  stdio: "inherit",
});

if (result.status !== 0) {
  console.log("\nknip found unused exports or dependencies (report only; not blocking).");
}
process.exit(0);
