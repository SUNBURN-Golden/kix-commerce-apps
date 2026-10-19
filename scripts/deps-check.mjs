#!/usr/bin/env node
/**
 * Offline production dependency gate.
 *
 * Checks:
 *   - every production dependency in package-lock.json has a resolved version,
 *     an integrity hash, and an allowed SPDX license;
 *   - every direct production dependency in package.json is pinned to an exact
 *     version (no ^, ~, >=, * or URL-style specifiers).
 *
 * Does NOT call the registry. Does NOT require authentication.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowlist = JSON.parse(readFileSync(path.join(root, "scripts/license-allowlist.json"), "utf8"));
const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
const allowedLicenses = new Set(allowlist.spdx);

const violations = [];

function addViolation(scope, packageName, message) {
  violations.push({ scope, package: packageName, message });
}

function isExactVersion(spec) {
  if (typeof spec !== "string") return false;
  // Workspace protocol spec like "0.0.1" or file: URLs are exact enough.
  if (spec.startsWith("file:") || spec.startsWith("workspace:")) return true;
  // Reject ranges and wildcards.
  if (/^[\^~>=<]/.test(spec) || spec === "*" || spec.includes("||") || spec.includes(" - ")) {
    return false;
  }
  // Reject npm dist tags and URLs.
  if (/^[a-zA-Z]/.test(spec) && !/^v?\d/.test(spec)) return false;
  return true;
}

// 1. Direct production dependency specs in every package.json under the repo.
function childPackageJsons(parent) {
  const entries = readdirSync(parent, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(parent, entry.name, "package.json"))
    .filter((pjPath) => {
      try {
        readFileSync(pjPath);
        return true;
      } catch {
        return false;
      }
    });
}

const packageJsonPaths = [path.join(root, "package.json"), ...childPackageJsons(path.join(root, "apps")), ...childPackageJsons(path.join(root, "packages"))];
for (const pjPath of packageJsonPaths) {
  const pkg = JSON.parse(readFileSync(pjPath, "utf8"));
  const deps = pkg.dependencies ?? {};
  for (const [name, spec] of Object.entries(deps)) {
    if (!isExactVersion(spec)) {
      addViolation(path.relative(root, pjPath), name, `production dependency version is not pinned: ${spec}`);
    }
  }
}

// 2. Locked production dependency tree (dev !== true).
for (const [key, entry] of Object.entries(lock.packages ?? {})) {
  if (key === "" || !key.startsWith("node_modules/")) continue;
  if (entry.dev === true) continue;
  // Workspace symlinks are local source trees, not registry packages.
  if (entry.link === true) continue;
  const packageName = key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length);

  if (!entry.version) {
    addViolation("lockfile", packageName, "missing resolved version");
  }
  if (!entry.integrity) {
    addViolation("lockfile", packageName, "missing integrity hash");
  }
  if (!entry.license) {
    addViolation("lockfile", packageName, "missing SPDX license");
  } else if (!allowedLicenses.has(entry.license)) {
    addViolation("lockfile", packageName, `license ${entry.license} is not in the allowlist`);
  }
}

if (violations.length > 0) {
  console.error("Production dependency gate failed:");
  console.error(JSON.stringify(violations, null, 2));
  process.exit(1);
}

console.log("Production dependency gate passed.");
console.log(`Checked ${packageJsonPaths.length} package.json files and ${Object.keys(lock.packages ?? {}).length} lockfile entries.`);
