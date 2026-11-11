import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SESSION_JOURNAL_BUDGET,
  SESSION_JOURNAL_KEY,
  SESSION_JOURNAL_QUARANTINE_KEY,
  openSessionJournal,
  peekSessionJournal,
} from "../src/index.js";
import { sha256Hex } from "../src/sha256.js";
import { FakeSessionStore } from "./support/fake-session-store.js";

import { invalidCounterFixtures, journalBlob as blob, journalRecord, MAX_COUNTER as M } from "./support/session-journal-fixtures.js";

const TAG = "0123456789abcdef";

function begin(journal: ReturnType<typeof openSessionJournal>, n: number, scope = `subject-${n}`) {
  return journal.begin({ intentRef: `intent-${n}`, scope, contextTag: TAG });
}

describe("session journal", () => {
  it("opens an empty journal and writes ahead of a send", () => {
    const store = new FakeSessionStore();
    const journal = openSessionJournal(store);
    expect(journal.status()).toEqual({ kind: "ready" });
    expect(journal.load()).toBe(1);
    expect(store.getItem(SESSION_JOURNAL_KEY)).toBe(blob());
    expect(begin(journal, 1)).toMatchObject({ ok: true, record: { seq: 1, outcome: "IN_FLIGHT", loadNo: 1 } });
    expect(store.getItem(SESSION_JOURNAL_KEY)).toBe(blob({ nextSeq: 2 }, [{ ...journalRecord, outcome: "IN_FLIGHT", code: null }]));
    // The record is in the store before anything is sent.
    expect(store.getItem(SESSION_JOURNAL_KEY)).toContain("intent-1");
    expect(journal.settle("intent-1", "CONFIRMED", null)).toMatchObject({ ok: true, record: { outcome: "CONFIRMED" } });
    expect(journal.records().map((r) => r.outcome)).toEqual(["CONFIRMED"]);
  });

  it("stores only tokens and a context hash, never free text or an actor label", () => {
    const store = new FakeSessionStore();
    const journal = openSessionJournal(store);
    expect(journal.begin({ intentRef: "intent 1", scope: "s", contextTag: TAG })).toEqual({ ok: false, reason: "FIELD_REFUSED" });
    expect(journal.begin({ intentRef: "intent-1", scope: "kim@example.com ", contextTag: TAG })).toEqual({ ok: false, reason: "FIELD_REFUSED" });
    expect(journal.begin({ intentRef: "intent-1", scope: "s", contextTag: "identity-desk" })).toEqual({ ok: false, reason: "FIELD_REFUSED" });
    expect(journal.begin({ intentRef: "x".repeat(65), scope: "s", contextTag: TAG })).toEqual({ ok: false, reason: "FIELD_REFUSED" });
    expect(journal.records()).toHaveLength(0);
    expect(store.getItem(SESSION_JOURNAL_KEY)).not.toContain("@");
  });

  it("recovers an unresolved intent as UNKNOWN on the next load and keeps a confirmed one as history", () => {
    const store = new FakeSessionStore();
    const first = openSessionJournal(store);
    begin(first, 1);
    first.settle("intent-1", "CONFIRMED", null);
    begin(first, 2);
    const second = openSessionJournal(store);
    expect(second.load()).toBe(2);
    expect(second.recoveredCount()).toBe(1);
    expect(second.records().map((r) => [r.intentRef, r.outcome, r.code, r.loadNo])).toEqual([
      ["intent-1", "CONFIRMED", null, 1],
      ["intent-2", "UNKNOWN", "RECOVERED_AFTER_RELOAD", 1],
    ]);
    expect(second.scopeBlock("subject-2")).toMatchObject({ reason: "unresolved", recovered: true, earlierLoad: true });
    expect(second.scopeBlock("subject-1")).toBeNull();
    // The next intent number continues; no number is issued twice.
    expect(second.nextSeq()).toBe(3);
  });

  it("keeps an UNKNOWN fence through a thousand load cycles", () => {
    const store = new FakeSessionStore();
    const first = openSessionJournal(store);
    begin(first, 1);
    let journal = first;
    for (let i = 0; i < 1000; i += 1) {
      journal = openSessionJournal(store);
    }
    expect(journal.load()).toBe(1001);
    expect(journal.scopeBlock("subject-1")).toMatchObject({ reason: "unresolved" });
    expect(journal.records()).toHaveLength(1);
  });

  it("turns in-flight records UNKNOWN on a tab resume", () => {
    const store = new FakeSessionStore();
    const journal = openSessionJournal(store);
    begin(journal, 1);
    expect(journal.recoverInFlight("TAB_RESUMED")).toBe(1);
    expect(journal.records()[0]).toMatchObject({ outcome: "UNKNOWN", code: "TAB_RESUMED" });
    expect(openSessionJournal(store).records()[0]).toMatchObject({ outcome: "UNKNOWN", code: "TAB_RESUMED" });
    // An answer for a record that is no longer in flight changes nothing.
    expect(journal.settle("intent-1", "CONFIRMED", null)).toEqual({ ok: false, reason: "NOT_IN_FLIGHT" });
    expect(journal.records()[0]?.outcome).toBe("UNKNOWN");
  });

  it("refuses a duplicate intent", () => {
    const journal = openSessionJournal(new FakeSessionStore());
    begin(journal, 1);
    expect(begin(journal, 1, "subject-9")).toEqual({ ok: false, reason: "DUPLICATE_INTENT" });
  });
});

describe("session journal damage", () => {
  const cases: [string, string, "CORRUPT" | "UNSUPPORTED_VERSION"][] = [
    ["not json", "{not json", "CORRUPT"],
    ["truncated", blob().slice(0, 30), "CORRUPT"],
    ["an array", "[]", "CORRUPT"],
    ["null", "null", "CORRUPT"],
    ["a string", '"x"', "CORRUPT"],
    ["wrong shape", JSON.stringify({ v: 1, records: "x" }), "CORRUPT"],
    ["digest mismatch", blob({ digest: "0".repeat(64) }), "CORRUPT"],
    ["extra key", blob({ extra: 1 }), "CORRUPT"],
    ["bad record", blob({}, [{ seq: 1 }]), "CORRUPT"],
    ["version 0", blob({ v: 0 }), "UNSUPPORTED_VERSION"],
    ["version 2", blob({ v: 2 }), "UNSUPPORTED_VERSION"],
    ["no version", JSON.stringify({ loads: 1 }), "UNSUPPORTED_VERSION"],
  ];

  for (const [name, text, cause] of cases) {
    it(`quarantines ${name} as ${cause} and holds every scope`, () => {
      const store = new FakeSessionStore();
      store.data.set(SESSION_JOURNAL_KEY, text);
      const journal = openSessionJournal(store);
      expect(journal.status()).toEqual({ kind: "evidence-lost", cause });
      expect(store.data.has(SESSION_JOURNAL_KEY)).toBe(false);
      expect(store.data.get(SESSION_JOURNAL_QUARANTINE_KEY)).toContain(cause);
      expect(journal.scopeBlock("any-scope")).toEqual({ reason: "evidence-lost", cause });
      expect(begin(journal, 1)).toEqual({ ok: false, reason: "EVIDENCE_LOST" });
      expect(journal.nextSeq()).toBe(0);
      // The loss survives a second load. A reload is not a way out.
      const again = openSessionJournal(store);
      expect(again.status()).toEqual({ kind: "evidence-lost", cause });
      expect(begin(again, 1)).toEqual({ ok: false, reason: "EVIDENCE_LOST" });
      expect(store.data.has(SESSION_JOURNAL_KEY)).toBe(false);
    });
  }

  it("leaves the original blob when the quarantine write fails, and stays lost", () => {
    const store = new FakeSessionStore();
    store.data.set(SESSION_JOURNAL_KEY, "{broken");
    store.throwOnSet = true;
    const journal = openSessionJournal(store);
    expect(journal.status()).toEqual({ kind: "evidence-lost", cause: "CORRUPT" });
    expect(store.data.get(SESSION_JOURNAL_KEY)).toBe("{broken");
    store.throwOnSet = false;
    expect(openSessionJournal(store).status()).toEqual({ kind: "evidence-lost", cause: "CORRUPT" });
  });

  it("treats a blob over the byte budget as corrupt", () => {
    const store = new FakeSessionStore();
    store.data.set(SESSION_JOURNAL_KEY, blob({}, []) + " ".repeat(SESSION_JOURNAL_BUDGET.maxBytes));
    expect(openSessionJournal(store).status()).toEqual({ kind: "evidence-lost", cause: "CORRUPT" });
  });

  it("detects a store cleared in the middle of the session", () => {
    const store = new FakeSessionStore();
    const journal = openSessionJournal(store);
    begin(journal, 1);
    store.data.delete(SESSION_JOURNAL_KEY);
    expect(journal.verify()).toEqual({ kind: "evidence-lost", cause: "LOST_DURING_SESSION" });
    expect(begin(journal, 2)).toEqual({ ok: false, reason: "EVIDENCE_LOST" });
    expect(journal.scopeBlock("subject-1")).toMatchObject({ reason: "evidence-lost" });
    expect(journal.settle("intent-1", "CONFIRMED", null)).toEqual({ ok: false, reason: "EVIDENCE_LOST" });
  });

  it("keeps a mid-session loss across reloads by recording it in the quarantine entry", () => {
    const store = new FakeSessionStore();
    const journal = openSessionJournal(store);
    begin(journal, 1);
    store.data.delete(SESSION_JOURNAL_KEY);
    expect(journal.verify()).toEqual({ kind: "evidence-lost", cause: "LOST_DURING_SESSION" });
    expect(JSON.parse(store.data.get(SESSION_JOURNAL_QUARANTINE_KEY) ?? "null")).toMatchObject({ cause: "LOST_DURING_SESSION", raw: "" });
    expect(store.data.has(SESSION_JOURNAL_KEY)).toBe(false);
    for (let load = 0; load < 5; load += 1) {
      const reopened = openSessionJournal(store);
      expect(reopened.status()).toEqual({ kind: "evidence-lost", cause: "LOST_DURING_SESSION" });
      expect(begin(reopened, 1)).toEqual({ ok: false, reason: "EVIDENCE_LOST" });
      expect(reopened.nextSeq()).toBe(0);
      expect(store.data.has(SESSION_JOURNAL_KEY)).toBe(false);
    }
  });

  it("still holds a mid-session loss in memory when the quarantine write is refused", () => {
    const store = new FakeSessionStore();
    const journal = openSessionJournal(store);
    begin(journal, 1);
    store.data.delete(SESSION_JOURNAL_KEY);
    store.throwOnSet = true;
    expect(journal.verify()).toEqual({ kind: "evidence-lost", cause: "LOST_DURING_SESSION" });
    expect(begin(journal, 2)).toEqual({ ok: false, reason: "EVIDENCE_LOST" });
  });

  it("quarantines a blob damaged in the middle of the session", () => {
    const store = new FakeSessionStore();
    const journal = openSessionJournal(store);
    begin(journal, 1);
    store.data.set(SESSION_JOURNAL_KEY, "garbage");
    expect(begin(journal, 2)).toEqual({ ok: false, reason: "EVIDENCE_LOST" });
    expect(journal.status()).toEqual({ kind: "evidence-lost", cause: "CORRUPT" });
  });

  it("holds every write when there is no store or the store throws", () => {
    const none = openSessionJournal(null);
    expect(none.status()).toEqual({ kind: "unavailable", cause: "NO_STORE" });
    expect(begin(none, 1)).toEqual({ ok: false, reason: "UNAVAILABLE" });
    expect(none.scopeBlock("s")).toMatchObject({ reason: "unavailable" });
    const blocked = new FakeSessionStore();
    blocked.throwOnGet = true;
    expect(openSessionJournal(blocked).status()).toEqual({ kind: "unavailable", cause: "NO_STORE" });
    const full = new FakeSessionStore();
    full.throwOnSet = true;
    const journal = openSessionJournal(full);
    expect(journal.status()).toEqual({ kind: "unavailable", cause: "WRITE_REFUSED" });
    expect(begin(journal, 1)).toEqual({ ok: false, reason: "UNAVAILABLE" });
  });
});

describe("session journal writes", () => {
  it("refuses the intent before a send when the store is over quota, and changes nothing", () => {
    const store = new FakeSessionStore();
    const journal = openSessionJournal(store);
    const before = store.getItem(SESSION_JOURNAL_KEY);
    store.quota = 10;
    expect(begin(journal, 1)).toEqual({ ok: false, reason: "WRITE_REFUSED" });
    expect(journal.records()).toHaveLength(0);
    expect(store.getItem(SESSION_JOURNAL_KEY)).toBe(before);
    expect(journal.status()).toEqual({ kind: "ready" });
    store.quota = null;
    expect(begin(journal, 1)).toMatchObject({ ok: true });
  });

  it("refuses a partial write that throws, puts the earlier blob back, and records nothing", () => {
    const store = new FakeSessionStore();
    const journal = openSessionJournal(store);
    begin(journal, 1);
    const before = store.getItem(SESSION_JOURNAL_KEY);
    store.partialThenThrow = 20;
    store.faultOnce = true;
    expect(begin(journal, 2)).toEqual({ ok: false, reason: "WRITE_REFUSED" });
    expect(store.getItem(SESSION_JOURNAL_KEY)).toBe(before);
    expect(journal.records().map((r) => r.intentRef)).toEqual(["intent-1"]);
    expect(journal.status()).toEqual({ kind: "ready" });
    expect(openSessionJournal(store).records().map((r) => r.intentRef)).toEqual(["intent-1"]);
  });

  it("refuses a silent partial write by reading it back, and puts the earlier blob back", () => {
    const store = new FakeSessionStore();
    const journal = openSessionJournal(store);
    begin(journal, 1);
    const before = store.getItem(SESSION_JOURNAL_KEY);
    store.silentTruncate = 40;
    store.faultOnce = true;
    expect(begin(journal, 2)).toEqual({ ok: false, reason: "WRITE_REFUSED" });
    expect(store.getItem(SESSION_JOURNAL_KEY)).toBe(before);
    expect(journal.records().map((r) => r.intentRef)).toEqual(["intent-1"]);
  });

  it("locks the session when a partial write cannot be put back", () => {
    const store = new FakeSessionStore();
    const journal = openSessionJournal(store);
    begin(journal, 1);
    store.silentTruncate = 40;
    expect(begin(journal, 2)).toEqual({ ok: false, reason: "WRITE_REFUSED" });
    // The restore was truncated too, so the store now holds damage. The next check quarantines it.
    expect(begin(journal, 3)).toEqual({ ok: false, reason: "EVIDENCE_LOST" });
    expect(journal.status()).toEqual({ kind: "evidence-lost", cause: "CORRUPT" });
  });

  it("reads a truncated store on the next load as corrupt, never as a smaller journal", () => {
    const store = new FakeSessionStore();
    const journal = openSessionJournal(store);
    begin(journal, 1);
    begin(journal, 2);
    const text = store.getItem(SESSION_JOURNAL_KEY) as string;
    store.data.set(SESSION_JOURNAL_KEY, text.slice(0, text.length - 25));
    expect(openSessionJournal(store).status()).toEqual({ kind: "evidence-lost", cause: "CORRUPT" });
  });

  it("fails a settle write without losing the fence", () => {
    const store = new FakeSessionStore();
    const journal = openSessionJournal(store);
    begin(journal, 1);
    store.throwOnSet = true;
    expect(journal.settle("intent-1", "CONFIRMED", null)).toEqual({ ok: false, reason: "WRITE_REFUSED" });
    expect(journal.markUnknown("intent-1", "JOURNAL_SETTLE_FAILED")).toBe(false);
    expect(journal.scopeBlock("subject-1")).toMatchObject({ reason: "unresolved", record: { outcome: "UNKNOWN", code: "JOURNAL_SETTLE_FAILED" } });
    store.throwOnSet = false;
    // The store still holds the in-flight text. The next load turns it UNKNOWN.
    const next = openSessionJournal(store);
    expect(next.scopeBlock("subject-1")).toMatchObject({ reason: "unresolved", recovered: true });
  });

  it("refuses the 33rd record and never evicts an UNKNOWN", () => {
    const store = new FakeSessionStore();
    const journal = openSessionJournal(store);
    for (let n = 1; n <= SESSION_JOURNAL_BUDGET.maxRecords; n += 1) {
      expect(begin(journal, n)).toMatchObject({ ok: true });
      journal.settle(`intent-${n}`, n === 1 ? "UNKNOWN" : "CONFIRMED", n === 1 ? "RESPONSE_LOST" : null);
    }
    expect(begin(journal, 33)).toEqual({ ok: false, reason: "JOURNAL_FULL" });
    expect(journal.records()).toHaveLength(SESSION_JOURNAL_BUDGET.maxRecords);
    expect(journal.scopeBlock("subject-1")).toMatchObject({ reason: "unresolved" });
    expect(journal.budgetInfo().usedBytes).toBeLessThanOrEqual(SESSION_JOURNAL_BUDGET.maxBytes);
  });

  it("refuses an intent when the byte budget is the limit, leaving room to settle", () => {
    const store = new FakeSessionStore();
    const journal = openSessionJournal(store, { budget: { maxRecords: 32, maxBytes: 900 } });
    let accepted = 0;
    for (let n = 1; n <= 10; n += 1) {
      const result = begin(journal, n);
      if (!result.ok) {
        expect(result.reason).toBe("JOURNAL_FULL");
        break;
      }
      accepted += 1;
    }
    expect(accepted).toBeGreaterThan(0);
    expect(accepted).toBeLessThan(10);
    // Every accepted intent still settles as UNKNOWN with the longest code, inside the budget.
    for (let n = 1; n <= accepted; n += 1) {
      expect(journal.settle(`intent-${n}`, "UNKNOWN", "X".repeat(32))).toMatchObject({ ok: true });
    }
    expect(journal.budgetInfo().usedBytes).toBeLessThanOrEqual(900);
    // Reopening within the same budget accepts what was written.
    expect(openSessionJournal(store, { budget: { maxRecords: 32, maxBytes: 900 } }).status()).toEqual({ kind: "ready" });
  });

  it("has no clear, remove, evict, or expiry call", () => {
    const journal = openSessionJournal(new FakeSessionStore()) as unknown as Record<string, unknown>;
    for (const name of ["clear", "remove", "evict", "expire", "reset", "delete", "resend", "resolve"]) {
      expect(journal[name], name).toBeUndefined();
    }
  });
});

describe("session journal source", () => {
  it("uses no other storage, clock, network, or random source", () => {
    const source = readFileSync(path.join(__dirname, "../src/session-journal.ts"), "utf8") + readFileSync(path.join(__dirname, "../src/session-recovery-controller.ts"), "utf8");
    for (const banned of ["localStorage", "document.cookie", "indexedDB", "fetch(", "Date", "Math.random(", "setTimeout", "retry", "fallback", "Number(", "parseInt", "BigInt", ".reduce(", "Idempotency", "capture", "placeHold", "commerce-bindings"]) {
      expect(source.includes(banned), banned).toBe(false);
    }
  });
});

describe("journal counter integrity", () => {
  const corrupt = { kind: "evidence-lost", cause: "CORRUPT" };
  for (const { name, raw } of invalidCounterFixtures()) {
    it(`rejects digest-valid ${name} on inspection, open, reopen, begin and settle`, () => {
      const env = JSON.parse(raw);
      // An independent canary: checksum damage cannot explain these numeric rejections.
      expect(env.digest).toBe(sha256Hex(JSON.stringify([env.v, env.loads, env.nextSeq, env.records])));
      if (name.endsWith("=-0")) expect(raw).toContain(":-0");
      const store = new FakeSessionStore();
      store.data.set(SESSION_JOURNAL_KEY, raw);
      expect(peekSessionJournal({ getItem: (key) => store.getItem(key) })).toEqual(corrupt);
      expect(store.sets).toBe(0);
      expect(store.data.get(SESSION_JOURNAL_KEY)).toBe(raw);
      const opened = openSessionJournal(store);
      expect(opened.status()).toEqual(corrupt);
      expect(openSessionJournal(store).status()).toEqual(corrupt);
      expect(opened.scopeBlock("any")).toEqual({ reason: "evidence-lost", cause: "CORRUPT" });
      expect(JSON.parse(store.data.get(SESSION_JOURNAL_QUARANTINE_KEY)!).raw).toBe(raw);
      for (const operation of ["begin", "settle", "markUnknown", "recoverInFlight"] as const) {
        const liveStore = new FakeSessionStore();
        const live = openSessionJournal(liveStore);
        begin(live, 1);
        liveStore.data.set(SESSION_JOURNAL_KEY, raw);
        if (operation === "begin") expect(begin(live, 2)).toEqual({ ok: false, reason: "EVIDENCE_LOST" });
        if (operation === "settle") expect(live.settle("intent-1", "CONFIRMED", null)).toEqual({ ok: false, reason: "EVIDENCE_LOST" });
        if (operation === "markUnknown") expect(live.markUnknown("intent-1", "TAB_RESUMED")).toBe(false);
        if (operation === "recoverInFlight") expect(live.recoverInFlight("TAB_RESUMED")).toBe(0);
        expect(live.status()).toEqual(corrupt);
        expect(peekSessionJournal(liveStore)).toEqual(corrupt);
        expect(openSessionJournal(liveStore).status()).toEqual(corrupt);
      }
    });
  }

  it("distinguishes integer safety from integer-ness and detects a wrong digest", () => {
    expect(Number.isInteger(M + 1)).toBe(true);
    expect(Number.isSafeInteger(M + 1)).toBe(false);
    const store = new FakeSessionStore();
    store.data.set(SESSION_JOURNAL_KEY, blob({ digest: "0".repeat(64) }));
    expect(openSessionJournal(store).status()).toEqual(corrupt);
    store.data.clear();
    store.data.set(SESSION_JOURNAL_KEY, blob());
    expect(openSessionJournal(store).status()).toEqual({ kind: "ready" });
  });

  it("acquires the last safe load, then refuses all writes on subsequent opens without touching storage", () => {
    const store = new FakeSessionStore();
    store.data.set(SESSION_JOURNAL_KEY, blob({ loads: M - 1, nextSeq: 4 }, [
      { ...journalRecord, loadNo: M - 1 },
      { ...journalRecord, seq: 2, intentRef: "intent-2", outcome: "CONFIRMED", code: null, loadNo: M - 1 },
      { ...journalRecord, seq: 3, intentRef: "intent-3", outcome: "IN_FLIGHT", code: null, loadNo: M - 1 },
    ]));
    const last = openSessionJournal(store);
    expect(last.status()).toEqual({ kind: "ready" });
    expect(last.load()).toBe(M);
    // The last acquired page can still allocate and settle a safe sequence.
    expect(begin(last, 4)).toMatchObject({ ok: true });
    expect(last.settle("intent-4", "CONFIRMED", null).ok).toBe(true);
    // Include records from load M, so load exhaustion cannot mislabel them as current.
    expect(begin(last, 5)).toMatchObject({ ok: true });
    const raw = store.data.get(SESSION_JOURNAL_KEY);
    const sets = store.sets;
    for (let i = 0; i < 3; i += 1) {
      const blocked = openSessionJournal(store);
      expect(blocked.status()).toEqual({ kind: "unavailable", cause: "COUNTER_EXHAUSTED" });
      expect(blocked.load()).toBe(M);
      expect(blocked.records().map((r) => r.intentRef)).toEqual(last.records().map((r) => r.intentRef));
      expect(blocked.records()[4]).toMatchObject({ outcome: "UNKNOWN", code: "RECOVERED_AFTER_RELOAD", loadNo: M });
      expect(blocked.recoveredCount()).toBe(1);
      expect(begin(blocked, 6)).toEqual({ ok: false, reason: "UNAVAILABLE" });
      expect(blocked.settle("intent-5", "CONFIRMED", null)).toEqual({ ok: false, reason: "UNAVAILABLE" });
      expect(blocked.markUnknown("intent-5", "TAB_RESUMED")).toBe(false);
      expect(blocked.recoverInFlight("TAB_RESUMED")).toBe(0);
      expect(blocked.scopeBlock("subject-1")).toEqual({ reason: "unavailable", cause: "COUNTER_EXHAUSTED" });
      expect(blocked.scopeBlock("other")).toEqual(blocked.scopeBlock("subject-1"));
      expect(blocked.verify()).toEqual(blocked.status());
      expect(store.data.get(SESSION_JOURNAL_KEY)).toBe(raw);
      expect(store.sets).toBe(sets);
      expect(store.data.has(SESSION_JOURNAL_QUARANTINE_KEY)).toBe(false);
      expect(peekSessionJournal(store)).toEqual(blocked.status());
    }
  });

  it("allocates the final safe sequence, refuses further begins, and still settles without increments", () => {
    const store = new FakeSessionStore();
    const writes: string[] = [];
    const set = store.setItem.bind(store);
    store.setItem = (key, value) => { writes.push(value); set(key, value); };
    store.data.set(SESSION_JOURNAL_KEY, blob({ loads: M - 2, nextSeq: M - 1 }, [{ ...journalRecord, seq: M - 2, loadNo: M - 2 }]));
    const journal = openSessionJournal(store);
    expect(journal.status()).toEqual({ kind: "ready" });
    expect(begin(journal, M - 1)).toMatchObject({ ok: true, record: { seq: M - 1, loadNo: M - 1 } });
    expect(journal.nextSeq()).toBe(M);
    const before = store.data.get(SESSION_JOURNAL_KEY);
    const sets = store.sets;
    expect(begin(journal, M)).toEqual({ ok: false, reason: "COUNTER_EXHAUSTED" });
    expect(store.data.get(SESSION_JOURNAL_KEY)).toBe(before);
    expect(store.sets).toBe(sets);
    expect(journal.settle(`intent-${M - 1}`, "CONFIRMED", null)).toMatchObject({ ok: true });
    expect(journal.nextSeq()).toBe(M);
    expect(journal.load()).toBe(M - 1);
    expect(peekSessionJournal(store)).toMatchObject({ kind: "ready" });
    const reopened = openSessionJournal(store);
    expect(reopened.status()).toEqual({ kind: "ready" });
    expect(reopened.nextSeq()).toBe(M);
    expect(reopened.scopeBlock("subject-1")).toMatchObject({ reason: "unresolved", record: { seq: M - 2, outcome: "UNKNOWN" } });
    expect(begin(reopened, M)).toEqual({ ok: false, reason: "COUNTER_EXHAUSTED" });
    for (const text of writes) {
      const env = JSON.parse(text);
      for (const n of [env.loads, env.nextSeq, ...env.records.flatMap((r: { seq: number; loadNo: number }) => [r.seq, r.loadNo])]) {
        expect(Number.isSafeInteger(n) && n > 0).toBe(true);
      }
    }
  });

  it("checks changed storage while dirty and retains UNKNOWN over older valid evidence", () => {
    const store = new FakeSessionStore();
    const journal = openSessionJournal(store);
    const older = store.data.get(SESSION_JOURNAL_KEY)!;
    begin(journal, 1);
    const lastWritten = store.data.get(SESSION_JOURNAL_KEY)!;
    store.partialThenThrow = 10;
    store.faultOnce = true;
    expect(journal.markUnknown("intent-1", "JOURNAL_SETTLE_FAILED")).toBe(false);
    expect(store.data.get(SESSION_JOURNAL_KEY)).toBe(lastWritten);
    const sets = store.sets;
    expect(journal.verify()).toEqual({ kind: "ready" });
    expect(journal.records()[0]?.outcome).toBe("UNKNOWN");
    store.data.set(SESSION_JOURNAL_KEY, older);
    expect(journal.verify()).toEqual({ kind: "ready" });
    expect(journal.records()[0]?.outcome).toBe("UNKNOWN");
    expect(store.sets).toBe(sets);
    // A later failed write still restores lastWritten, not the older valid blob.
    store.partialThenThrow = 10;
    store.faultOnce = true;
    expect(begin(journal, 2)).toEqual({ ok: false, reason: "WRITE_REFUSED" });
    expect(store.data.get(SESSION_JOURNAL_KEY)).toBe(lastWritten);
    store.data.set(SESSION_JOURNAL_KEY, blob({ nextSeq: M + 1 }));
    expect(journal.verify()).toEqual(corrupt);
    expect(openSessionJournal(store).status()).toEqual(corrupt);
  });
});
