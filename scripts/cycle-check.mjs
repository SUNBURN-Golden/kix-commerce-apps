#!/usr/bin/env node
/**
 * Run madge --circular against each workspace source tree.
 *
 * Exits 1 if any circular import is found.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaces = [
  { name: "@kix/protocol-adapter", dir: "packages/protocol-adapter/src" },
  { name: "@kix/web", dir: "apps/web/src" },
  { name: "@kix/e2e", dir: "apps/e2e/src" },
];

let failed = false;
for (const ws of workspaces) {
  const cwd = path.join(root, ws.dir);
  console.log(`[${ws.name}] checking for circular imports in ${cwd}`);
  const result = spawnSync("npx", ["madge", "--circular", "--extensions", "ts,tsx", "."], {
    cwd,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    failed = true;
  }
}

if (failed) {
  console.error("\nCircular import check failed.");
  process.exit(1);
}
console.log("\nNo circular imports found.");
