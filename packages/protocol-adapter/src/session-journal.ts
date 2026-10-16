import { sha256Hex } from "./sha256.js";

/**
 * A tab-session write-ahead journal for the synthetic session recovery desk.
 * The journal records an intent and its conflict scope before a write is sent,
 * and records the answer after. It lives in the tab's session storage and
 * nowhere else: no durable browser store, no server, no cookie.
 *
 * Rules, all tested:
 *  - The format is versioned and app-internal. It is not a public schema,
 *    operation, capability, or identifier, and nothing outside this app reads it.
 *  - A record holds only short ASCII tokens: a sequence number, an intent
 *    reference, a scope token, a context tag (a hash prefix, so actor labels
 *    never reach storage), an outcome, a code, and the load number. Free text
 *    and personal data are refused before they are stored.
 *  - A record is written before the write is sent. A failed or partial write,
 *    or a quota error, refuses the send. A failed write after the send leaves
 *    the scope locked UNKNOWN.
 *  - A corrupt, unsupported, or lost journal is quarantined and the session
 *    shows SESSION_EVIDENCE_LOST. Every scope is held. No new reference is
 *    issued to get around it.
 *  - There is no expiry, no timestamp, and no clear, remove, or evict call. A
 *    full journal refuses the next intent. How long a record is kept is
 *    UNDETERMINED, and nothing here removes a fence.
 *  - The integrity digest detects damage. It is not authentication.
 *
 * Browser storage can be cleared, lost, or copied with a duplicated tab. A
 * cleared tab looks the same as a new one. None of this is an exactly-once
 * guarantee.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

export const SESSION_JOURNAL_VERSION = 1;

export const SESSION_JOURNAL_KEY = "kix-session-journal";

export const SESSION_JOURNAL_QUARANTINE_KEY = "kix-session-journal-quarantine";

export const SESSION_EVIDENCE_LOST = "SESSION_EVIDENCE_LOST";

export interface SessionJournalBudget {
  maxRecords: number;
  maxBytes: number;
}

/** Implementation choices, not a product policy value. */
export const SESSION_JOURNAL_BUDGET: Readonly<SessionJournalBudget> = { maxRecords: 32, maxBytes: 12288 };

/** Retention is a product and legal value that nobody has set. */
export const SESSION_RETENTION_POLICY = "UNDETERMINED";

export const SESSION_OUTCOMES = ["IN_FLIGHT", "CONFIRMED", "REJECTED", "UNKNOWN"] as const;

export type SessionOutcome = (typeof SESSION_OUTCOMES)[number];

export const SESSION_RECOVERED_CODES = ["RECOVERED_AFTER_RELOAD", "TAB_RESUMED"] as const;

export const SESSION_SETTLE_FAILED_CODE = "JOURNAL_SETTLE_FAILED";

export interface SessionRecord {
  seq: number;
  intentRef: string;
  scope: string;
  contextTag: string;
  outcome: SessionOutcome;
  code: string | null;
  /** The page load that began this intent. */
  loadNo: number;
}

export interface SessionStorePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type EvidenceLostCause = "CORRUPT" | "UNSUPPORTED_VERSION" | "LOST_DURING_SESSION";

export type JournalStatus =
  | { kind: "ready" }
  | { kind: "evidence-lost"; cause: EvidenceLostCause }
  | { kind: "unavailable"; cause: "NO_STORE" | "WRITE_REFUSED" };

export type JournalRefusal =
  | "FIELD_REFUSED"
  | "JOURNAL_FULL"
  | "WRITE_REFUSED"
  | "EVIDENCE_LOST"
  | "UNAVAILABLE"
  | "DUPLICATE_INTENT";

export type BeginResult = { ok: true; record: SessionRecord } | { ok: false; reason: JournalRefusal };

export type SettleResult =
  | { ok: true; record: SessionRecord }
  | { ok: false; reason: "NO_RECORD" | "NOT_IN_FLIGHT" | "WRITE_REFUSED" | "EVIDENCE_LOST" | "UNAVAILABLE" | "FIELD_REFUSED" };

export type ScopeBlock =
  | { reason: "evidence-lost"; cause: EvidenceLostCause }
  | { reason: "unavailable"; cause: "NO_STORE" | "WRITE_REFUSED" }
  | { reason: "unresolved"; record: SessionRecord; recovered: boolean; earlierLoad: boolean };

interface Envelope {
  v: number;
  loads: number;
  nextSeq: number;
  records: SessionRecord[];
}

const TOKEN = /^[A-Za-z0-9._:-]{1,64}$/;
const CODE = /^[A-Z0-9_]{1,32}$/;
const TAG = /^[0-9a-f]{16}$/;
const ENVELOPE_KEYS = ["v", "loads", "nextSeq", "records", "digest"];
const RECORD_KEYS = ["seq", "intentRef", "scope", "contextTag", "outcome", "code", "loadNo"];
const MAX_CODE = "X".repeat(32);

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function copyRecord(record: SessionRecord): SessionRecord {
  return {
    seq: record.seq,
    intentRef: record.intentRef,
    scope: record.scope,
    contextTag: record.contextTag,
    outcome: record.outcome,
    code: record.code,
    loadNo: record.loadNo,
  };
}

function digestOf(env: Envelope): string {
  return sha256Hex(JSON.stringify([env.v, env.loads, env.nextSeq, env.records.map(copyRecord)]));
}

function serialize(env: Envelope): string {
  return JSON.stringify({
    v: env.v,
    loads: env.loads,
    nextSeq: env.nextSeq,
    records: env.records.map(copyRecord),
    digest: digestOf(env),
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
}

function parseRecord(value: unknown, loads: number, nextSeq: number): SessionRecord | null {
  if (!isPlainObject(value) || !sameKeys(value, RECORD_KEYS)) {
    return null;
  }
  const { seq, intentRef, scope, contextTag, outcome, code, loadNo } = value;
  if (!Number.isInteger(seq) || (seq as number) < 1 || (seq as number) >= nextSeq) {
    return null;
  }
  if (typeof intentRef !== "string" || !TOKEN.test(intentRef) || typeof scope !== "string" || !TOKEN.test(scope)) {
    return null;
  }
  if (typeof contextTag !== "string" || !TAG.test(contextTag)) {
    return null;
  }
  if (typeof outcome !== "string" || !(SESSION_OUTCOMES as readonly string[]).includes(outcome)) {
    return null;
  }
  if (code !== null && (typeof code !== "string" || !CODE.test(code))) {
    return null;
  }
  if (!Number.isInteger(loadNo) || (loadNo as number) < 1 || (loadNo as number) > loads) {
    return null;
  }
  return { seq: seq as number, intentRef, scope, contextTag, outcome: outcome as SessionOutcome, code, loadNo: loadNo as number };
}

type Parsed = { kind: "ok"; env: Envelope } | { kind: "bad"; cause: "CORRUPT" | "UNSUPPORTED_VERSION" };

function parseEnvelope(raw: string, budget: SessionJournalBudget): Parsed {
  const bad = (cause: "CORRUPT" | "UNSUPPORTED_VERSION"): Parsed => ({ kind: "bad", cause });
  if (byteLength(raw) > budget.maxBytes) {
    return bad("CORRUPT");
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return bad("CORRUPT");
  }
  if (!isPlainObject(value)) {
    return bad("CORRUPT");
  }
  if (value.v !== SESSION_JOURNAL_VERSION) {
    return bad("UNSUPPORTED_VERSION");
  }
  if (!sameKeys(value, ENVELOPE_KEYS)) {
    return bad("CORRUPT");
  }
  const { loads, nextSeq, records, digest } = value;
  if (!Number.isInteger(loads) || (loads as number) < 1 || !Number.isInteger(nextSeq) || (nextSeq as number) < 1) {
    return bad("CORRUPT");
  }
  if (!Array.isArray(records) || records.length > budget.maxRecords || typeof digest !== "string") {
    return bad("CORRUPT");
  }
  const parsed: SessionRecord[] = [];
  const seen = new Set<string>();
  let last = 0;
  for (const item of records) {
    const record = parseRecord(item, loads as number, nextSeq as number);
    if (record === null || record.seq <= last || seen.has(record.intentRef)) {
      return bad("CORRUPT");
    }
    last = record.seq;
    seen.add(record.intentRef);
    parsed.push(record);
  }
  const env: Envelope = { v: SESSION_JOURNAL_VERSION, loads: loads as number, nextSeq: nextSeq as number, records: parsed };
  if (digestOf(env) !== digest) {
    return bad("CORRUPT");
  }
  return { kind: "ok", env };
}

export interface OpenSessionJournalOptions {
  budget?: SessionJournalBudget;
}

export interface BeginInput {
  intentRef: string;
  scope: string;
  contextTag: string;
}

export class SessionJournal {
  private env: Envelope | null = null;
  private current: JournalStatus = { kind: "ready" };
  private lastWritten: string | null = null;
  /** The in-memory state is ahead of the store: the last write failed. */
  private dirty = false;
  private recoveredAtOpen = 0;

  constructor(
    private readonly store: SessionStorePort | null,
    private readonly budget: SessionJournalBudget,
  ) {}

  status(): JournalStatus {
    return this.current.kind === "ready" ? { kind: "ready" } : { ...this.current };
  }

  /** The page load number of this journal. Zero when there is no ready journal. */
  load(): number {
    return this.env === null ? 0 : this.env.loads;
  }

  /** How many unresolved intents the open turned into UNKNOWN. */
  recoveredCount(): number {
    return this.recoveredAtOpen;
  }

  records(): readonly SessionRecord[] {
    return this.env === null ? [] : this.env.records.map(copyRecord);
  }

  budgetInfo(): SessionJournalBudget & { usedRecords: number; usedBytes: number } {
    return {
      ...this.budget,
      usedRecords: this.env === null ? 0 : this.env.records.length,
      usedBytes: this.env === null ? 0 : byteLength(serialize(this.env)),
    };
  }

  /** The next sequence number. Intent references are derived from it, so they continue across loads. */
  nextSeq(): number {
    return this.env === null ? 0 : this.env.nextSeq;
  }

  // -- open ----------------------------------------------------------------

  open(): this {
    const store = this.store;
    if (store === null) {
      this.current = { kind: "unavailable", cause: "NO_STORE" };
      return this;
    }
    let quarantined: string | null;
    let raw: string | null;
    try {
      quarantined = store.getItem(SESSION_JOURNAL_QUARANTINE_KEY);
      raw = store.getItem(SESSION_JOURNAL_KEY);
    } catch {
      this.current = { kind: "unavailable", cause: "NO_STORE" };
      return this;
    }
    if (quarantined !== null) {
      this.current = { kind: "evidence-lost", cause: this.quarantinedCause(quarantined) };
      return this;
    }
    if (raw === null) {
      const fresh: Envelope = { v: SESSION_JOURNAL_VERSION, loads: 1, nextSeq: 1, records: [] };
      if (this.persist(fresh) !== null) {
        this.current = { kind: "unavailable", cause: "WRITE_REFUSED" };
        return this;
      }
      this.env = fresh;
      return this;
    }
    const parsed = parseEnvelope(raw, this.budget);
    if (parsed.kind === "bad") {
      this.quarantine(raw, parsed.cause);
      return this;
    }
    const env = parsed.env;
    env.loads += 1;
    this.recoveredAtOpen = this.markInFlight(env, "RECOVERED_AFTER_RELOAD");
    this.env = env;
    this.lastWritten = raw;
    if (this.persist(env) !== null) {
      // The store still holds the older blob. Its in-flight records recover the same way on the next load.
      this.dirty = true;
    }
    return this;
  }

  private quarantinedCause(text: string): EvidenceLostCause {
    try {
      const value: unknown = JSON.parse(text);
      if (isPlainObject(value) && (value.cause === "CORRUPT" || value.cause === "UNSUPPORTED_VERSION" || value.cause === "LOST_DURING_SESSION")) {
        return value.cause;
      }
    } catch {
      // A damaged quarantine entry still means evidence was lost.
    }
    return "CORRUPT";
  }

  /** Moves the damaged blob aside. If that write fails, the original stays where it is. */
  private quarantine(raw: string | null, cause: EvidenceLostCause): void {
    this.current = { kind: "evidence-lost", cause };
    this.env = null;
    const store = this.store;
    if (store === null) {
      return;
    }
    try {
      store.setItem(SESSION_JOURNAL_QUARANTINE_KEY, JSON.stringify({ v: SESSION_JOURNAL_VERSION, cause, raw: (raw ?? "").slice(0, this.budget.maxBytes) }));
    } catch {
      return;
    }
    try {
      store.removeItem(SESSION_JOURNAL_KEY);
    } catch {
      // The quarantine entry already marks the session as lost.
    }
  }

  private markInFlight(env: Envelope, code: string): number {
    let count = 0;
    for (const record of env.records) {
      if (record.outcome === "IN_FLIGHT") {
        record.outcome = "UNKNOWN";
        record.code = code;
        count += 1;
      }
    }
    return count;
  }

  // -- store ---------------------------------------------------------------

  /** Writes the envelope and reads it back. Returns a refusal, or null when the store holds exactly this text. */
  private persist(env: Envelope): "JOURNAL_FULL" | "WRITE_REFUSED" | null {
    const store = this.store;
    if (store === null) {
      return "WRITE_REFUSED";
    }
    const text = serialize(env);
    if (byteLength(text) > this.budget.maxBytes) {
      return "JOURNAL_FULL";
    }
    try {
      store.setItem(SESSION_JOURNAL_KEY, text);
      if (store.getItem(SESSION_JOURNAL_KEY) === text) {
        this.lastWritten = text;
        this.dirty = false;
        return null;
      }
    } catch {
      // Fall through to the restore below.
    }
    try {
      if (this.lastWritten === null) {
        store.removeItem(SESSION_JOURNAL_KEY);
      } else {
        store.setItem(SESSION_JOURNAL_KEY, this.lastWritten);
      }
    } catch {
      // The store is not usable. The next verify decides what that means.
    }
    return "WRITE_REFUSED";
  }

  /** Compares the store with what this journal last wrote. A cleared or damaged store locks the session. */
  verify(): JournalStatus {
    if (this.current.kind !== "ready" || this.store === null) {
      return this.status();
    }
    let raw: string | null;
    try {
      raw = this.store.getItem(SESSION_JOURNAL_KEY);
    } catch {
      this.current = { kind: "unavailable", cause: "NO_STORE" };
      return this.status();
    }
    if (raw === null) {
      this.current = { kind: "evidence-lost", cause: "LOST_DURING_SESSION" };
      this.env = null;
      return this.status();
    }
    if (this.dirty || raw === this.lastWritten) {
      return this.status();
    }
    const parsed = parseEnvelope(raw, this.budget);
    if (parsed.kind === "bad") {
      this.quarantine(raw, parsed.cause);
      return this.status();
    }
    this.env = parsed.env;
    this.lastWritten = raw;
    return this.status();
  }

  private gateStatus(): "EVIDENCE_LOST" | "UNAVAILABLE" | null {
    const status = this.verify();
    if (status.kind === "evidence-lost") {
      return "EVIDENCE_LOST";
    }
    return status.kind === "unavailable" || this.env === null ? "UNAVAILABLE" : null;
  }

  // -- scope ---------------------------------------------------------------

  /** Why a scope may not take a new write, or null. Evidence loss and a missing store hold every scope. */
  scopeBlock(scope: string): ScopeBlock | null {
    if (this.current.kind === "evidence-lost") {
      return { reason: "evidence-lost", cause: this.current.cause };
    }
    if (this.current.kind === "unavailable" || this.env === null) {
      return { reason: "unavailable", cause: this.current.kind === "unavailable" ? this.current.cause : "NO_STORE" };
    }
    const record = this.env.records.find((item) => item.scope === scope && (item.outcome === "UNKNOWN" || item.outcome === "IN_FLIGHT"));
    if (record === undefined) {
      return null;
    }
    return {
      reason: "unresolved",
      record: copyRecord(record),
      recovered: (SESSION_RECOVERED_CODES as readonly string[]).includes(record.code ?? ""),
      earlierLoad: record.loadNo < this.env.loads,
    };
  }

  // -- writes --------------------------------------------------------------

  /** Records an intent before it is sent. A refusal means the caller must not send. */
  begin(input: BeginInput): BeginResult {
    const held = this.gateStatus();
    if (held !== null || this.env === null) {
      return { ok: false, reason: held ?? "UNAVAILABLE" };
    }
    if (!TOKEN.test(input.intentRef) || !TOKEN.test(input.scope) || !TAG.test(input.contextTag)) {
      return { ok: false, reason: "FIELD_REFUSED" };
    }
    const env = this.env;
    if (env.records.some((record) => record.intentRef === input.intentRef)) {
      return { ok: false, reason: "DUPLICATE_INTENT" };
    }
    if (env.records.length >= this.budget.maxRecords) {
      return { ok: false, reason: "JOURNAL_FULL" };
    }
    const record: SessionRecord = {
      seq: env.nextSeq,
      intentRef: input.intentRef,
      scope: input.scope,
      contextTag: input.contextTag,
      outcome: "IN_FLIGHT",
      code: null,
      loadNo: env.loads,
    };
    const next: Envelope = { ...env, nextSeq: env.nextSeq + 1, records: [...env.records, record] };
    // Leave room for every open record to settle as UNKNOWN with the longest code, so a settle never overflows.
    const worst: Envelope = {
      ...next,
      records: next.records.map((item) => (item.outcome === "IN_FLIGHT" ? { ...item, outcome: "UNKNOWN" as const, code: MAX_CODE } : item)),
    };
    if (byteLength(serialize(worst)) > this.budget.maxBytes) {
      return { ok: false, reason: "JOURNAL_FULL" };
    }
    const failed = this.persist(next);
    if (failed !== null) {
      return { ok: false, reason: failed };
    }
    this.env = next;
    return { ok: true, record: copyRecord(record) };
  }

  /** Records the answer to an intent that is still in flight. */
  settle(intentRef: string, outcome: "CONFIRMED" | "REJECTED" | "UNKNOWN", code: string | null): SettleResult {
    if (code !== null && !CODE.test(code)) {
      return { ok: false, reason: "FIELD_REFUSED" };
    }
    const held = this.gateStatus();
    if (held !== null || this.env === null) {
      return { ok: false, reason: held ?? "UNAVAILABLE" };
    }
    const env = this.env;
    const found = env.records.find((item) => item.intentRef === intentRef);
    if (found === undefined) {
      return { ok: false, reason: "NO_RECORD" };
    }
    if (found.outcome !== "IN_FLIGHT") {
      return { ok: false, reason: "NOT_IN_FLIGHT" };
    }
    const next: Envelope = {
      ...env,
      records: env.records.map((item) => (item.intentRef === intentRef ? { ...item, outcome, code } : copyRecord(item))),
    };
    if (this.persist(next) !== null) {
      return { ok: false, reason: "WRITE_REFUSED" };
    }
    this.env = next;
    return { ok: true, record: copyRecord(next.records.find((item) => item.intentRef === intentRef) as SessionRecord) };
  }

  /**
   * Locks an in-flight intent as UNKNOWN in memory, and in the store if it will
   * take the write. Used when the answer could not be recorded. Returns whether
   * the store holds it.
   */
  markUnknown(intentRef: string, code: string): boolean {
    if (this.env === null || !CODE.test(code)) {
      return false;
    }
    const target = this.env.records.find((item) => item.intentRef === intentRef);
    if (target === undefined || target.outcome !== "IN_FLIGHT") {
      return false;
    }
    target.outcome = "UNKNOWN";
    target.code = code;
    const stored = this.persist(this.env) === null;
    if (!stored) {
      this.dirty = true;
    }
    return stored;
  }

  /** A tab resume: every intent still in flight becomes UNKNOWN. Returns how many. */
  recoverInFlight(code: string): number {
    if (this.verify().kind !== "ready" || this.env === null || !CODE.test(code)) {
      return 0;
    }
    const count = this.markInFlight(this.env, code);
    if (count > 0 && this.persist(this.env) !== null) {
      this.dirty = true;
    }
    return count;
  }
}

/** Opens the journal. Opening counts one load and turns every unresolved intent into UNKNOWN. */
export function openSessionJournal(store: SessionStorePort | null, options: OpenSessionJournalOptions = {}): SessionJournal {
  return new SessionJournal(store, options.budget ?? SESSION_JOURNAL_BUDGET).open();
}
