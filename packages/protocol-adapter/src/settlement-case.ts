import { isRecord } from "./record.js";
import { SURFACES } from "./surfaces.js";
import {
  ProtocolError,
  SETTLEMENT_PROVENANCE,
  SETTLEMENT_REFERENCES,
  type SettlementCaseView,
  type SettlementCommandReceipt,
  type SettlementInitiate,
  type SettlementLifecycleCommand,
  type SettlementPhase,
  type SettlementReason,
  type SettlementReconcileReceipt,
  type SettlementStep,
} from "./types.js";

/**
 * In-process mock settlement cases for the desk.
 *
 * Phase names, idempotency echoes, terminal immutability, and reconcile
 * `matched` follow the kix-protocol in-memory FSM at the UI contract only.
 * Authoritative machine: BeautifulMind-JT/kix-protocol
 * `reference/settlement_f01_f03/settlement_fsm.py`
 * on main `85145eb33799a7c712890ff81708def8a7d61ee5`
 * (feature `838370d9ce8e8aeeceeb94f3b4d212204e7ecf19`).
 *
 * This store does not port F01–F03 arithmetic, does not move funds, and does
 * not add OpenAPI commands. F01, F02, F03, and P04 stay 설계중.
 * The journal is process-local. It is not the protocol journal and not a ledger.
 */
export const SETTLEMENT_DEPTH_BASELINE = {
  protocolRepo: "BeautifulMind-JT/kix-protocol",
  protocolMainSha: "85145eb33799a7c712890ff81708def8a7d61ee5",
  featureCommit: "838370d9ce8e8aeeceeb94f3b4d212204e7ecf19",
  fsmPath: "reference/settlement_f01_f03/settlement_fsm.py",
  provenance: SETTLEMENT_PROVENANCE,
} as const;

export const SETTLEMENT_CASE_NOTE =
  "Simulated mock phase on the adapter stub. Not live funds. F01, F02, and F03 stay 설계중. Protocol truth remains in kix-protocol.";

const TERMINAL_PHASES: ReadonlySet<SettlementPhase> = new Set(["FAILED", "CANCELLED"]);

const UNSTORED_REJECTION: ReadonlySet<string> = new Set([
  "MOCK_INVARIANT",
  "IDEMPOTENCY_CONFLICT",
  "INVALID_JOURNAL",
]);

const NEXT_PHASE = {
  authorize: "AUTHORIZED",
  capture: "CAPTURED",
  commit: "COMMITTED",
  fail: "FAILED",
  cancel: "CANCELLED",
} as const;

type TransitionOp = keyof typeof NEXT_PHASE;
type JournalOp = "initiate" | TransitionOp;

const ALLOWED: Record<TransitionOp, ReadonlySet<SettlementPhase>> = {
  authorize: new Set(["INITIATED"]),
  capture: new Set(["AUTHORIZED"]),
  commit: new Set(["CAPTURED"]),
  fail: new Set(["INITIATED", "AUTHORIZED"]),
  cancel: new Set(["INITIATED", "AUTHORIZED"]),
};

interface CaseRecord {
  settlementId: string;
  eventId: string;
  phase: SettlementPhase;
  failureReason: string | null;
  cancelReason: string | null;
  /** Last journaled command key. Included in the process-local replay projection. */
  lastKey: string;
  /** Latest accepted key, including reconcile. Omitted from replay comparison. */
  echoKey: string;
  lastRejectCode: string | null;
  reconcileMatched: boolean | null;
}

interface JournalEntry {
  op: JournalOp;
  idempotencyKey: string;
  settlementId: string;
  body: Record<string, string>;
}

interface StoredCall {
  request: string;
  result: SettlementCommandReceipt | null;
  error: string | null;
}

export class SettlementCaseStore {
  private readonly cases = new Map<string, CaseRecord>();
  private readonly journal: JournalEntry[] = [];
  private readonly idempotency = new Map<string, StoredCall>();

  initiate(input: SettlementInitiate): SettlementCommandReceipt {
    const body = { eventId: input.eventId };
    return this.call("initiate", input.settlementId, input.idempotencyKey, body, (key, request) => {
      const settlementId = ident(input.settlementId);
      const eventId = ident(input.eventId);
      const current = this.cases.get(settlementId);
      if (current) {
        if (TERMINAL_PHASES.has(current.phase)) {
          throw settlementError("TERMINAL_IMMUTABLE");
        }
        throw settlementError("ILLEGAL_TRANSITION");
      }
      const record: CaseRecord = {
        settlementId,
        eventId,
        phase: "INITIATED",
        failureReason: null,
        cancelReason: null,
        lastKey: key,
        echoKey: key,
        lastRejectCode: null,
        reconcileMatched: null,
      };
      this.cases.set(settlementId, record);
      return this.accept(key, request, "initiate", record, { eventId });
    });
  }

  authorize(input: SettlementStep): SettlementCommandReceipt {
    return this.transition("authorize", input, {});
  }

  capture(input: SettlementStep): SettlementCommandReceipt {
    return this.transition("capture", input, {});
  }

  commit(input: SettlementStep): SettlementCommandReceipt {
    return this.transition("commit", input, {});
  }

  fail(input: SettlementReason): SettlementCommandReceipt {
    return this.transition("fail", input, { reason: input.reason });
  }

  cancel(input: SettlementReason): SettlementCommandReceipt {
    return this.transition("cancel", input, { reason: input.reason });
  }

  reconcile(input: SettlementStep): SettlementReconcileReceipt {
    return this.call("reconcile", input.settlementId, input.idempotencyKey, {}, (key, request) => {
      const settlementId = ident(input.settlementId);
      const record = this.cases.get(settlementId);
      if (!record) {
        throw settlementError("UNKNOWN_SETTLEMENT");
      }
      const rebuilt = new SettlementCaseStore();
      for (const entry of this.journal) {
        rebuilt.replay(entry);
      }
      if (rebuilt.canonical() !== this.canonical()) {
        throw settlementError("MOCK_INVARIANT");
      }
      record.reconcileMatched = true;
      record.lastRejectCode = null;
      record.echoKey = key;
      const receipt: SettlementReconcileReceipt = {
        ...this.commandReceipt(false, "reconcile", key, record),
        applied: "reconcile",
        matched: true,
      };
      this.idempotency.set(key, { request, result: structuredClone(receipt), error: null });
      return structuredClone(receipt);
    });
  }

  view(settlementId: string): SettlementCaseView {
    const id = ident(settlementId);
    const record = this.cases.get(id);
    if (!record) {
      throw settlementError("UNKNOWN_SETTLEMENT");
    }
    return this.toView(record);
  }

  rejectExternal(kind: string): never {
    ident(kind);
    throw settlementError("EXTERNAL_PAYMENT_UNSUPPORTED");
  }

  private transition(
    op: TransitionOp,
    input: SettlementStep,
    rawBody: Record<string, string>,
  ): SettlementCommandReceipt {
    return this.call(op, input.settlementId, input.idempotencyKey, rawBody, (key, request) => {
      const settlementId = ident(input.settlementId);
      const record = this.cases.get(settlementId);
      if (!record) {
        throw settlementError("UNKNOWN_SETTLEMENT");
      }
      const body = normalizeBody(op, rawBody);
      this.applyTransition(record, op, key, body);
      return this.accept(key, request, op, record, body);
    });
  }

  private applyTransition(record: CaseRecord, op: TransitionOp, key: string, body: Record<string, string>): void {
    if (TERMINAL_PHASES.has(record.phase)) {
      throw settlementError("TERMINAL_IMMUTABLE");
    }
    if (!ALLOWED[op].has(record.phase)) {
      throw settlementError("ILLEGAL_TRANSITION");
    }
    if (op === "fail" || op === "cancel") {
      const reason = body.reason;
      if (!reason) {
        throw settlementError("MOCK_INVARIANT");
      }
      if (op === "fail") {
        record.failureReason = reason;
      } else {
        record.cancelReason = reason;
      }
    }
    record.phase = NEXT_PHASE[op];
    record.lastKey = key;
    record.echoKey = key;
    record.lastRejectCode = null;
  }

  private accept(
    key: string,
    request: string,
    op: JournalOp,
    record: CaseRecord,
    body: Record<string, string>,
  ): SettlementCommandReceipt {
    this.journal.push({
      op,
      idempotencyKey: key,
      settlementId: record.settlementId,
      body: { ...body },
    });
    const receipt = this.commandReceipt(false, op, key, record);
    this.idempotency.set(key, { request, result: structuredClone(receipt), error: null });
    return structuredClone(receipt);
  }

  private call<T extends SettlementCommandReceipt>(
    op: SettlementLifecycleCommand,
    settlementId: string,
    idempotencyKey: string,
    body: Record<string, string>,
    execute: (key: string, request: string) => T,
  ): T {
    const key = ident(idempotencyKey);
    const request = canonicalJson({ body, op, settlementId });
    const prior = this.idempotency.get(key);
    if (prior) {
      if (prior.request !== request) {
        this.noteReject(settlementId, "IDEMPOTENCY_CONFLICT");
        throw settlementError("IDEMPOTENCY_CONFLICT");
      }
      if (prior.error !== null) {
        this.noteReject(settlementId, prior.error);
        throw settlementError(prior.error);
      }
      if (prior.result === null) {
        throw settlementError("MOCK_INVARIANT");
      }
      const replay = structuredClone(prior.result) as T;
      replay.duplicate = true;
      replay.applied = null;
      return replay;
    }
    try {
      return execute(key, request);
    } catch (error) {
      if (
        error instanceof ProtocolError &&
        error.code !== undefined &&
        !UNSTORED_REJECTION.has(error.code) &&
        !this.idempotency.has(key)
      ) {
        this.idempotency.set(key, { request, result: null, error: error.code });
        this.noteReject(settlementId, error.code);
      }
      throw error;
    }
  }

  private replay(entry: JournalEntry): void {
    if (entry.op === "initiate") {
      const eventId = entry.body.eventId;
      if (!eventId) {
        throw settlementError("MOCK_INVARIANT");
      }
      this.cases.set(entry.settlementId, {
        settlementId: entry.settlementId,
        eventId,
        phase: "INITIATED",
        failureReason: null,
        cancelReason: null,
        lastKey: entry.idempotencyKey,
        echoKey: entry.idempotencyKey,
        lastRejectCode: null,
        reconcileMatched: null,
      });
    } else {
      const record = this.cases.get(entry.settlementId);
      if (!record) {
        throw settlementError("MOCK_INVARIANT");
      }
      this.applyTransition(record, entry.op, entry.idempotencyKey, { ...entry.body });
    }
    this.journal.push({
      op: entry.op,
      idempotencyKey: entry.idempotencyKey,
      settlementId: entry.settlementId,
      body: { ...entry.body },
    });
  }

  private canonical(): string {
    const cases = [...this.cases.values()]
      .map((record) => ({
        cancelReason: record.cancelReason,
        eventId: record.eventId,
        failureReason: record.failureReason,
        idempotencyKey: record.lastKey,
        phase: record.phase,
        settlementId: record.settlementId,
      }))
      .sort((left, right) => left.settlementId.localeCompare(right.settlementId));
    return canonicalJson({
      cases,
      journal: this.journal.map((entry) => ({
        body: entry.body,
        idempotencyKey: entry.idempotencyKey,
        op: entry.op,
        settlementId: entry.settlementId,
      })),
    });
  }

  private noteReject(settlementId: string, code: string): void {
    const record = this.cases.get(settlementId);
    if (!record) {
      return;
    }
    record.lastRejectCode = code;
  }

  private commandReceipt(
    duplicate: boolean,
    applied: SettlementLifecycleCommand | null,
    idempotencyKey: string,
    record: CaseRecord,
  ): SettlementCommandReceipt {
    return {
      duplicate,
      applied,
      provenance: SETTLEMENT_PROVENANCE,
      externalPayment: "UNSUPPORTED",
      fundsExecuted: false,
      idempotencyKey,
      settlement: this.toView(record),
    };
  }

  private toView(record: CaseRecord): SettlementCaseView {
    return {
      mode: "mock",
      surface: SURFACES.settlementFsm,
      references: [...SETTLEMENT_REFERENCES],
      provenance: SETTLEMENT_PROVENANCE,
      lifecycleAuthority: "IN_MEMORY_FSM",
      settlementId: record.settlementId,
      eventId: record.eventId,
      phase: record.phase,
      terminal: TERMINAL_PHASES.has(record.phase),
      idempotencyKey: record.echoKey,
      failureReason: record.failureReason,
      cancelReason: record.cancelReason,
      lastRejectCode: record.lastRejectCode,
      reconcileMatched: record.reconcileMatched,
      fundsExecuted: false,
      externalPayment: "UNSUPPORTED",
      providerAuthorizationExecuted: false,
      note: SETTLEMENT_CASE_NOTE,
    };
  }
}

function normalizeBody(op: TransitionOp, rawBody: Record<string, string>): Record<string, string> {
  if (op === "fail" || op === "cancel") {
    return { reason: ident(rawBody.reason ?? "") };
  }
  return {};
}

function ident(value: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 100 || value.trim() !== value) {
    throw settlementError("INVALID_ID");
  }
  return value;
}

function settlementError(code: string): ProtocolError {
  return new ProtocolError(`${code}: mock settlement command rejected.`, code);
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (isRecord(value)) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonicalize(value[key]);
    }
    return sorted;
  }
  return value;
}
