/**
 * Manifest-v1 constants and byte helpers.
 *
 * The manifest digest is the SHA-256 of the canonical manifest bytes and is
 * stored outside those bytes. A profile file does not contain its own digest
 * or a commit SHA.
 */

import { createHash } from "node:crypto";

import { canonicalStringify } from "./jsonschema.ts";

export const MANIFEST_SCHEMA_VERSION = "kix-compat-manifest/1";
export const PROFILE_KINDS = ["BOOTSTRAP", "SEMANTIC_CONFORMANCE"] as const;
export const BOOTSTRAP_REVISION = "bootstrap-1";
export const BOOTSTRAP_GRANTS = "catalogue-schema-binding only";
export const TOOLCHAIN_PREFIX = "node-";

export const FORBIDDEN_SELF_KEYS = [
  "consumer_head",
  "delivery_head",
  "final_commit",
  "manifest_digest",
  "manifest_sha256",
] as const;

export function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalStringify(value));
}

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function gitBlobId(bytes: Uint8Array): string {
  const header = Buffer.from(`blob ${bytes.length}\0`, "ascii");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}
