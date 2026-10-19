#!/usr/bin/env node
/**
 * Run ESLint over the source trees and the root scripts.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const patterns = [
  "packages/*/src/**/*.{ts,tsx}",
  "apps/*/src/**/*.{ts,tsx}",
  "apps/*/test/**/*.{ts,tsx}",
  "apps/*/tests/**/*.{ts,tsx}",
  "scripts/*.mjs",
];

console.log(`Running ESLint in ${root}: ${patterns.join(" ")}`);
const result = spawnSync("npx", ["eslint", "--max-warnings=0", ...patterns], {
  cwd: root,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
