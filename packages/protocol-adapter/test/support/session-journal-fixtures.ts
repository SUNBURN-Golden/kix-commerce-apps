import { sha256Hex } from "../../src/sha256.js";
import type { SessionRecord } from "../../src/session-journal.js";

export const MAX_COUNTER = Number.MAX_SAFE_INTEGER;
export const journalRecord: SessionRecord = {
  seq: 1, intentRef: "intent-1", scope: "subject-1", contextTag: "0123456789abcdef",
  outcome: "UNKNOWN", code: "RESPONSE_LOST", loadNo: 1,
};

/** Hash final values in production field order. Raw negative zero survives in the text only. */
export function journalBlob(overrides: Record<string, unknown> = {}, records: unknown[] = [], rawZeroField?: string): string {
  const env = { v: 1, loads: 1, nextSeq: 1, records, ...overrides };
  const digestRecords = env.records.map((value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
    const { seq, intentRef, scope, contextTag, outcome, code, loadNo } = value as Record<string, unknown>;
    return { seq, intentRef, scope, contextTag, outcome, code, loadNo };
  });
  const digest = sha256Hex(JSON.stringify([env.v, env.loads, env.nextSeq, digestRecords]));
  const raw = JSON.stringify({ ...env, digest, ...(Object.hasOwn(overrides, "digest") ? { digest: overrides.digest } : {}) });
  return rawZeroField === undefined ? raw : raw.replace(`"${rawZeroField}":0`, `"${rawZeroField}":-0`);
}

export function invalidCounterFixtures() {
  const fixtures: { name: string; raw: string }[] = [];
  for (const field of ["loads", "nextSeq", "seq", "loadNo"] as const) {
    for (const value of [MAX_COUNTER + 1, 2 ** 54, 1.5, 0, -1, -0, "1", null]) {
      const record = { ...journalRecord };
      const env = { loads: MAX_COUNTER - 1, nextSeq: MAX_COUNTER };
      if (field === "seq" || field === "loadNo") Object.assign(record, { [field]: value });
      else Object.assign(env, { [field]: value });
      fixtures.push({
        name: `${field}=${Object.is(value, -0) ? "-0" : JSON.stringify(value)}`,
        raw: journalBlob(env, [record], Object.is(value, -0) ? field : undefined),
      });
    }
  }
  return fixtures;
}
