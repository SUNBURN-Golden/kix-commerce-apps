import { isRecord } from "./record.js";
import { SURFACES } from "./surfaces.js";
import {
  ProtocolError,
  CREDIT_PROVENANCE,
  CREDIT_REFERENCES,
  type CreditBind,
  type CreditCaseView,
  type CreditCommandReceipt,
  type CreditDraw,
  type CreditLifecycleCommand,
  type CreditNoteStatus,
  type CreditOffer,
  type CreditPhase,
  type CreditReason,
  type CreditReconcileReceipt,
  type CreditRepay,
  type CreditSettlementGate,
  type CreditStep,
} from "./types.js";

/**
 * In-process mock credit cases for the credit desk.
 *
 * Phase names, idempotency echoes, duplicate draw, terminal immutability,
 * repayment order, and the open-face ceiling follow the kix-protocol
 * in-memory FSM at the UI contract only.
 * Authoritative machine: BeautifulMind-JT/kix-protocol
 * `reference/credit_advance_f04/credit_fsm.py`
 * on main `8c1a4db7cfe70b0e772a2ef0f24492967c84f7f1`
 * (feature `4608460ba1fe57165e88e74f6e8d8c23e8e53277`).
 *
 * This store does not port MockCredit face arithmetic, confirmed cash,
 * recovery, or refund faces. The ceiling is the offered open face minus
 * reserved mock exposure. It does not add OpenAPI commands.
 * F04 and E06 stay 설계중.
 * The journal is process-local. It is not the protocol journal and not a ledger.
 * A bound draw reads the mock settlement phase. It does not post money.
 * Credit commands do not write booking or resale ownership.
 */
export const CREDIT_DEPTH_BASELINE = {
  protocolRepo: "BeautifulMind-JT/kix-protocol",
  protocolMainSha: "8c1a4db7cfe70b0e772a2ef0f24492967c84f7f1",
  featureCommit: "4608460ba1fe57165e88e74f6e8d8c23e8e53277",
  fsmPath: "reference/credit_advance_f04/credit_fsm.py",
  provenance: CREDIT_PROVENANCE,
} as const;

export const CREDIT_CASE_NOTE =
  "Simulated exposure on the adapter stub. Not live credit. F04 and E06 stay 설계중. Protocol truth remains in kix-protocol. This case does not disburse to a bank, underwrite, or change ticket ownership.";

const MONEY_MAX = 1_000_000_000_000;

const TERMINAL: ReadonlySet<CreditPhase> = new Set(["REJECTED", "CANCELLED", "CLOSED", "DEFAULTED"]);

const UNSTORED_REJECTION: ReadonlySet<string> = new Set([
  "MOCK_INVARIANT",
  "IDEMPOTENCY_CONFLICT",
  "INVALID_JOURNAL",
]);

const REAL_FUNDS: ReadonlySet<string> = new Set(["DISBURSE", "REPAY", "DEBIT", "DISBURSE_TO_BANK"]);

const UNDEFINED_PRODUCT: ReadonlySet<string> = new Set([
  "ACCRUE",
  "LICENSE",
  "FORECLOSE",
  "PRIORITY",
  "PERFECT",
  "INTEREST",
  "FEE",
  "KYC",
  "AML",
  "KYC_AML",
  "RISK_SCORE",
  "UNDERWRITE",
]);

const JOURNAL_OPS = [
  "offer",
  "approve",
  "reject",
  "cancel",
  "bind_settlement",
  "draw",
  "repay",
  "close",
  "default",
] as const;

type JournalOp = (typeof JOURNAL_OPS)[number];
type TransitionOp = Exclude<JournalOp, "offer">;

const ALLOWED: Record<TransitionOp, ReadonlySet<CreditPhase>> = {
  approve: new Set(["OFFERED"]),
  reject: new Set(["OFFERED"]),
  cancel: new Set(["OFFERED", "APPROVED"]),
  bind_settlement: new Set(["OFFERED", "APPROVED"]),
  draw: new Set(["APPROVED"]),
  repay: new Set(["DRAWN"]),
  close: new Set(["DRAWN"]),
  default: new Set(["DRAWN"]),
};

interface RepaymentNote {
  repayId: string;
  sequence: number;
  amount: number;
}

interface CaseRecord {
  binding: string;
  advanceId: string;
  claimId: string;
  openFace: number;
  offerAmount: number;
  beneficiaryRole: string;
  phase: CreditPhase;
  settlementId: string | null;
  mockSettlementCommitObserved: boolean;
  drawId: string | null;
  drawnExposure: number;
  repaidExposure: number;
  outstandingExposure: number;
  repayments: RepaymentNote[];
  rejectReason: string | null;
  cancelReason: string | null;
  defaultReason: string | null;
  noteStatus: CreditNoteStatus | null;
  lastKey: string;
  echoKey: string;
  lastRejectCode: string | null;
  reconcileMatched: boolean | null;
}

interface ClaimPool {
  claimId: string;
  openFace: number;
  reserved: number;
}

interface JournalEntry {
  op: JournalOp;
  idempotencyKey: string;
  advanceId: string;
  body: Record<string, string>;
}

interface StoredCall {
  request: string;
  result: CreditCommandReceipt | null;
  error: string | null;
}

interface SettlementAuthority {
  phase: string;
  fundsExecuted: boolean;
}

type JsonBody = Record<string, string | number | null>;

export class CreditCaseStore {
  private readonly cases = new Map<string, CaseRecord>();
  private readonly claims = new Map<string, ClaimPool>();
  private readonly journal: JournalEntry[] = [];
  private readonly idempotency = new Map<string, StoredCall>();

  constructor(private readonly settlementView: (settlementId: string) => SettlementAuthority) {}

  offer(input: CreditOffer): CreditCommandReceipt {
    const body: JsonBody = {
      amount: input.amount,
      beneficiaryRole: input.beneficiaryRole,
      claimId: input.claimId,
      openFace: input.openFace,
      product: input.product ?? null,
    };
    return this.call("offer", input.advanceId, input.idempotencyKey, body, (key, request) => {
      if (input.product !== undefined && input.product !== null) {
        throw creditError("CREDIT_PRODUCT_UNDEFINED");
      }
      const advanceId = ident(input.advanceId);
      const claimId = ident(input.claimId);
      const beneficiaryRole = ident(input.beneficiaryRole);
      const openFace = money(input.openFace);
      const amount = money(input.amount);
      const record = this.applyOffer(key, advanceId, { claimId, openFace, amount, beneficiaryRole });
      return this.accept(key, request, "offer", record, {
        amount: String(amount),
        beneficiaryRole,
        claimId,
        openFace: String(openFace),
      });
    });
  }

  approve(input: CreditStep): CreditCommandReceipt {
    return this.call("approve", input.advanceId, input.idempotencyKey, {}, (key, request) => {
      const record = this.applyTransition(key, ident(input.advanceId), "approve", {});
      return this.accept(key, request, "approve", record, {});
    });
  }

  reject(input: CreditReason): CreditCommandReceipt {
    const body = { reason: input.reason };
    return this.call("reject", input.advanceId, input.idempotencyKey, body, (key, request) => {
      const reason = ident(input.reason);
      const record = this.applyTransition(key, ident(input.advanceId), "reject", { reason });
      return this.accept(key, request, "reject", record, { reason });
    });
  }

  cancel(input: CreditReason): CreditCommandReceipt {
    const body = { reason: input.reason };
    return this.call("cancel", input.advanceId, input.idempotencyKey, body, (key, request) => {
      const reason = ident(input.reason);
      const record = this.applyTransition(key, ident(input.advanceId), "cancel", { reason });
      return this.accept(key, request, "cancel", record, { reason });
    });
  }

  bindSettlement(input: CreditBind): CreditCommandReceipt {
    const body = { settlementId: input.settlementId };
    return this.call("bind_settlement", input.advanceId, input.idempotencyKey, body, (key, request) => {
      const settlementId = ident(input.settlementId);
      const record = this.applyTransition(key, ident(input.advanceId), "bind_settlement", { settlementId });
      return this.accept(key, request, "bind_settlement", record, { settlementId });
    });
  }

  draw(input: CreditDraw): CreditCommandReceipt {
    const body = { drawId: input.drawId };
    return this.call("draw", input.advanceId, input.idempotencyKey, body, (key, request) => {
      const advanceId = ident(input.advanceId);
      const drawId = ident(input.drawId);
      const current = this.require(advanceId);
      if (current.drawId !== null) {
        if (current.drawId === drawId) {
          return this.rememberDuplicate(key, request, current);
        }
        if (TERMINAL.has(current.phase)) {
          throw creditError("TERMINAL_IMMUTABLE");
        }
        throw creditError("DUPLICATE_DRAW");
      }
      const record = this.applyDraw(key, advanceId, drawId);
      return this.accept(key, request, "draw", record, { drawId });
    });
  }

  repay(input: CreditRepay): CreditCommandReceipt {
    const body: JsonBody = {
      amount: input.amount,
      repayId: input.repayId,
      sequence: input.sequence,
    };
    return this.call("repay", input.advanceId, input.idempotencyKey, body, (key, request) => {
      const advanceId = ident(input.advanceId);
      const repayId = ident(input.repayId);
      const amount = money(input.amount);
      const sequence = repaymentSequence(input.sequence);
      const current = this.require(advanceId);
      const existing = current.repayments.find((note) => note.repayId === repayId);
      if (existing) {
        const next = repayBinding(advanceId, amount, repayId, sequence);
        const prior = repayBinding(advanceId, existing.amount, repayId, existing.sequence);
        if (next !== prior) {
          throw creditError("REPAY_BINDING_CONFLICT");
        }
        return this.rememberDuplicate(key, request, current);
      }
      if (TERMINAL.has(current.phase)) {
        throw creditError("TERMINAL_IMMUTABLE");
      }
      const record = this.applyRepay(key, advanceId, { repayId, amount, sequence });
      return this.accept(key, request, "repay", record, {
        amount: String(amount),
        repayId,
        sequence: String(sequence),
      });
    });
  }

  close(input: CreditStep): CreditCommandReceipt {
    return this.call("close", input.advanceId, input.idempotencyKey, {}, (key, request) => {
      const record = this.applyTransition(key, ident(input.advanceId), "close", {});
      return this.accept(key, request, "close", record, {});
    });
  }

  defaultCase(input: CreditReason): CreditCommandReceipt {
    const body = { reason: input.reason };
    return this.call("default", input.advanceId, input.idempotencyKey, body, (key, request) => {
      const reason = ident(input.reason);
      const record = this.applyTransition(key, ident(input.advanceId), "default", { reason });
      return this.accept(key, request, "default", record, { reason });
    });
  }

  reconcile(input: CreditStep): CreditReconcileReceipt {
    return this.call("reconcile", input.advanceId, input.idempotencyKey, {}, (key, request) => {
      const advanceId = ident(input.advanceId);
      const record = this.cases.get(advanceId);
      if (!record) {
        throw creditError("UNKNOWN_ADVANCE");
      }
      const rebuilt = new CreditCaseStore(this.settlementView);
      for (const entry of this.journal) {
        rebuilt.replay(entry);
      }
      if (rebuilt.canonical() !== this.canonical()) {
        throw creditError("MOCK_INVARIANT");
      }
      record.reconcileMatched = true;
      record.lastRejectCode = null;
      record.echoKey = key;
      const receipt: CreditReconcileReceipt = {
        ...this.commandReceipt(false, "reconcile", key, record),
        applied: "reconcile",
        matched: true,
      };
      this.idempotency.set(key, { request, result: structuredClone(receipt), error: null });
      return structuredClone(receipt);
    });
  }

  view(advanceId: string): CreditCaseView {
    return this.toView(this.require(ident(advanceId)));
  }

  rejectUnsupported(kind: string): never {
    if (typeof kind !== "string") {
      throw creditError("EXECUTION_KIND");
    }
    if (REAL_FUNDS.has(kind)) {
      throw creditError("REAL_FUNDS_FORBIDDEN");
    }
    if (UNDEFINED_PRODUCT.has(kind)) {
      throw creditError("CREDIT_PRODUCT_UNDEFINED");
    }
    throw creditError("EXECUTION_KIND");
  }

  private applyOffer(
    key: string,
    advanceId: string,
    input: { claimId: string; openFace: number; amount: number; beneficiaryRole: string },
  ): CaseRecord {
    const binding = offerBinding({ advanceId, ...input });
    const current = this.cases.get(advanceId);
    if (current) {
      if (current.binding !== binding) {
        throw creditError("ADVANCE_BINDING_CONFLICT");
      }
      throw creditError("ILLEGAL_TRANSITION");
    }
    const record: CaseRecord = {
      binding,
      advanceId,
      claimId: input.claimId,
      openFace: input.openFace,
      offerAmount: input.amount,
      beneficiaryRole: input.beneficiaryRole,
      phase: "OFFERED",
      settlementId: null,
      mockSettlementCommitObserved: false,
      drawId: null,
      drawnExposure: 0,
      repaidExposure: 0,
      outstandingExposure: 0,
      repayments: [],
      rejectReason: null,
      cancelReason: null,
      defaultReason: null,
      noteStatus: null,
      lastKey: key,
      echoKey: key,
      lastRejectCode: null,
      reconcileMatched: null,
    };
    this.cases.set(advanceId, record);
    this.assertCase(record);
    return record;
  }

  private applyTransition(key: string, advanceId: string, op: TransitionOp, body: Record<string, string>): CaseRecord {
    const record = this.require(advanceId);
    if (op === "draw" || op === "repay") {
      throw creditError("MOCK_INVARIANT");
    }
    this.enter(record, op);
    if (op === "approve") {
      record.phase = "APPROVED";
    } else if (op === "reject") {
      const reason = body.reason;
      if (!reason) {
        throw creditError("MOCK_INVARIANT");
      }
      record.rejectReason = reason;
      record.phase = "REJECTED";
    } else if (op === "cancel") {
      const reason = body.reason;
      if (!reason) {
        throw creditError("MOCK_INVARIANT");
      }
      record.cancelReason = reason;
      record.phase = "CANCELLED";
    } else if (op === "bind_settlement") {
      const settlementId = body.settlementId;
      if (!settlementId) {
        throw creditError("MOCK_INVARIANT");
      }
      if (record.settlementId !== null) {
        if (record.settlementId !== settlementId) {
          throw creditError("SETTLEMENT_BINDING_CONFLICT");
        }
        throw creditError("ILLEGAL_TRANSITION");
      }
      record.settlementId = settlementId;
    } else if (op === "close") {
      if (record.outstandingExposure !== 0) {
        throw creditError("OUTSTANDING_REMAINS");
      }
      this.releaseNote(record);
      record.phase = "CLOSED";
      record.noteStatus = "RELEASED";
    } else if (op === "default") {
      const reason = body.reason;
      if (!reason) {
        throw creditError("MOCK_INVARIANT");
      }
      if (record.outstandingExposure <= 0) {
        throw creditError("DEFAULT_REQUIRES_EXPOSURE");
      }
      record.defaultReason = reason;
      record.phase = "DEFAULTED";
    }
    record.lastKey = key;
    record.echoKey = key;
    record.lastRejectCode = null;
    this.assertCase(record);
    return record;
  }

  private applyDraw(key: string, advanceId: string, drawId: string): CaseRecord {
    const record = this.require(advanceId);
    if (record.drawId !== null) {
      throw creditError("MOCK_INVARIANT");
    }
    this.enter(record, "draw");
    const observed = this.observeSettlement(record);
    this.noteAdvance(record);
    record.drawId = drawId;
    record.drawnExposure = record.offerAmount;
    record.outstandingExposure = record.offerAmount;
    record.mockSettlementCommitObserved = observed;
    record.phase = "DRAWN";
    record.noteStatus = "NOTED";
    record.lastKey = key;
    record.echoKey = key;
    record.lastRejectCode = null;
    this.assertCase(record);
    return record;
  }

  private applyRepay(
    key: string,
    advanceId: string,
    input: { repayId: string; amount: number; sequence: number },
  ): CaseRecord {
    const record = this.require(advanceId);
    this.enter(record, "repay");
    const expected = record.repayments.length + 1;
    if (input.sequence !== expected) {
      throw creditError("REPAYMENT_ORDER");
    }
    if (input.amount > record.outstandingExposure) {
      throw creditError("REPAYMENT_EXCEEDS_OUTSTANDING");
    }
    record.repayments.push({
      repayId: input.repayId,
      sequence: input.sequence,
      amount: input.amount,
    });
    record.repaidExposure += input.amount;
    record.outstandingExposure -= input.amount;
    record.lastKey = key;
    record.echoKey = key;
    record.lastRejectCode = null;
    this.assertCase(record);
    return record;
  }

  private noteAdvance(record: CaseRecord): void {
    const existing = this.claims.get(record.claimId);
    if (existing && existing.openFace !== record.openFace) {
      throw creditError("FACE_SNAPSHOT_FROZEN");
    }
    const openFace = existing ? existing.openFace : record.openFace;
    const reserved = existing ? existing.reserved : 0;
    if (record.offerAmount > openFace - reserved) {
      throw creditError("ADVANCE_EXCEEDS_OPEN_FACE");
    }
    const pool = existing ?? { claimId: record.claimId, openFace, reserved: 0 };
    pool.reserved = reserved + record.offerAmount;
    this.claims.set(record.claimId, pool);
  }

  private releaseNote(record: CaseRecord): void {
    const pool = this.claims.get(record.claimId);
    if (!pool || pool.reserved < record.offerAmount) {
      throw creditError("MOCK_INVARIANT");
    }
    pool.reserved -= record.offerAmount;
  }

  private observeSettlement(record: CaseRecord): boolean {
    if (record.settlementId === null) {
      return false;
    }
    let view: SettlementAuthority;
    try {
      view = this.settlementView(record.settlementId);
    } catch (error) {
      if (error instanceof ProtocolError && error.code === "UNKNOWN_SETTLEMENT") {
        throw creditError("UNKNOWN_SETTLEMENT");
      }
      throw error;
    }
    if (view.phase !== "COMMITTED") {
      throw creditError("SETTLEMENT_NOT_COMMITTED");
    }
    if (view.fundsExecuted !== false) {
      throw creditError("SETTLEMENT_VIEW_REJECTED");
    }
    return true;
  }

  private enter(record: CaseRecord, op: TransitionOp): void {
    if (ALLOWED[op].has(record.phase)) {
      return;
    }
    if (TERMINAL.has(record.phase)) {
      throw creditError("TERMINAL_IMMUTABLE");
    }
    throw creditError("ILLEGAL_TRANSITION");
  }

  private accept(
    key: string,
    request: string,
    op: JournalOp,
    record: CaseRecord,
    body: Record<string, string>,
  ): CreditCommandReceipt {
    this.journal.push({
      op,
      idempotencyKey: key,
      advanceId: record.advanceId,
      body: { ...body },
    });
    const receipt = this.commandReceipt(false, op, key, record);
    this.idempotency.set(key, { request, result: structuredClone(receipt), error: null });
    return structuredClone(receipt);
  }

  private rememberDuplicate(key: string, request: string, record: CaseRecord): CreditCommandReceipt {
    const receipt = this.commandReceipt(true, null, key, record);
    this.idempotency.set(key, { request, result: structuredClone(receipt), error: null });
    return structuredClone(receipt);
  }

  private call<T extends CreditCommandReceipt>(
    op: CreditLifecycleCommand,
    advanceId: string,
    idempotencyKey: string,
    body: JsonBody,
    execute: (key: string, request: string) => T,
  ): T {
    const key = ident(idempotencyKey);
    const request = canonicalJson({ advanceId, body, op });
    const prior = this.idempotency.get(key);
    if (prior) {
      if (prior.request !== request) {
        this.noteReject(advanceId, "IDEMPOTENCY_CONFLICT");
        throw creditError("IDEMPOTENCY_CONFLICT");
      }
      if (prior.error !== null) {
        this.noteReject(advanceId, prior.error);
        throw creditError(prior.error);
      }
      if (prior.result === null) {
        throw creditError("MOCK_INVARIANT");
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
        this.noteReject(advanceId, error.code);
      }
      throw error;
    }
  }

  private replay(entry: JournalEntry): void {
    const body = entry.body;
    if (entry.op === "offer") {
      this.applyOffer(entry.idempotencyKey, entry.advanceId, {
        claimId: required(body.claimId),
        openFace: money(Number(body.openFace)),
        amount: money(Number(body.amount)),
        beneficiaryRole: required(body.beneficiaryRole),
      });
    } else if (entry.op === "draw") {
      this.applyDraw(entry.idempotencyKey, entry.advanceId, required(body.drawId));
    } else if (entry.op === "repay") {
      this.applyRepay(entry.idempotencyKey, entry.advanceId, {
        repayId: required(body.repayId),
        amount: money(Number(body.amount)),
        sequence: repaymentSequence(Number(body.sequence)),
      });
    } else {
      this.applyTransition(entry.idempotencyKey, entry.advanceId, entry.op, { ...body });
    }
    this.journal.push({
      op: entry.op,
      idempotencyKey: entry.idempotencyKey,
      advanceId: entry.advanceId,
      body: { ...body },
    });
  }

  private canonical(): string {
    const cases = [...this.cases.values()]
      .map((record) => ({
        advanceId: record.advanceId,
        beneficiaryRole: record.beneficiaryRole,
        cancelReason: record.cancelReason,
        claimId: record.claimId,
        defaultReason: record.defaultReason,
        drawId: record.drawId,
        drawnExposure: record.drawnExposure,
        idempotencyKey: record.lastKey,
        mockSettlementCommitObserved: record.mockSettlementCommitObserved,
        noteStatus: record.noteStatus,
        offerAmount: record.offerAmount,
        openFace: record.openFace,
        outstandingExposure: record.outstandingExposure,
        phase: record.phase,
        rejectReason: record.rejectReason,
        repaidExposure: record.repaidExposure,
        repayments: record.repayments.map((note) => ({
          amount: note.amount,
          repayId: note.repayId,
          sequence: note.sequence,
        })),
        settlementId: record.settlementId,
      }))
      .sort((left, right) => left.advanceId.localeCompare(right.advanceId));
    const claims = [...this.claims.values()]
      .map((pool) => ({
        claimId: pool.claimId,
        openFace: pool.openFace,
        reserved: pool.reserved,
      }))
      .sort((left, right) => left.claimId.localeCompare(right.claimId));
    return canonicalJson({
      cases,
      claims,
      journal: this.journal.map((entry) => ({
        advanceId: entry.advanceId,
        body: entry.body,
        idempotencyKey: entry.idempotencyKey,
        op: entry.op,
      })),
    });
  }

  private require(advanceId: string): CaseRecord {
    const record = this.cases.get(advanceId);
    if (!record) {
      throw creditError("UNKNOWN_ADVANCE");
    }
    return record;
  }

  private noteReject(advanceId: string, code: string): void {
    let id: string;
    try {
      id = ident(advanceId);
    } catch {
      return;
    }
    const record = this.cases.get(id);
    if (!record) {
      return;
    }
    record.lastRejectCode = code;
  }

  private commandReceipt(
    duplicate: boolean,
    applied: CreditLifecycleCommand | null,
    idempotencyKey: string,
    record: CaseRecord,
  ): CreditCommandReceipt {
    return {
      duplicate,
      applied,
      provenance: CREDIT_PROVENANCE,
      lifecycleAuthority: "IN_MEMORY_FSM",
      externalCredit: "UNSUPPORTED",
      economicFinalityClaimed: false,
      fundsExecuted: false,
      bankDebitObserved: false,
      repaymentObserved: false,
      interestDefined: false,
      underwritingExecuted: false,
      kycExecuted: false,
      idempotencyKey,
      credit: this.toView(record),
    };
  }

  private toView(record: CaseRecord): CreditCaseView {
    const pool = this.claims.get(record.claimId);
    const reservedOpen = pool && pool.claimId === record.claimId ? pool.reserved : 0;
    const ceiling = pool ? pool.openFace : record.openFace;
    const pending = record.phase === "OFFERED" || record.phase === "APPROVED";
    return {
      mode: "mock",
      surface: SURFACES.creditFsm,
      references: CREDIT_REFERENCES,
      provenance: CREDIT_PROVENANCE,
      lifecycleAuthority: "IN_MEMORY_FSM",
      exposureLedger: "MOCK_EXPOSURE",
      advanceId: record.advanceId,
      phase: record.phase,
      terminal: TERMINAL.has(record.phase),
      claimId: record.claimId,
      beneficiaryRole: record.beneficiaryRole,
      openFace: record.openFace,
      availableCredit: ceiling - reservedOpen,
      pendingDraw: pending ? record.offerAmount : 0,
      offerAmount: record.offerAmount,
      reservedOpen,
      noteStatus: record.noteStatus,
      drawId: record.drawId,
      drawnExposure: record.drawnExposure,
      repaidExposure: record.repaidExposure,
      outstandingExposure: record.outstandingExposure,
      repaymentCount: record.repayments.length,
      nextRepaymentSequence:
        record.phase === "DRAWN" && record.outstandingExposure > 0 ? record.repayments.length + 1 : null,
      settlementId: record.settlementId,
      settlementGate: settlementGate(record),
      mockSettlementCommitObserved: record.mockSettlementCommitObserved,
      settlementFailure: this.settlementFailed(record),
      rejectReason: record.rejectReason,
      cancelReason: record.cancelReason,
      defaultReason: record.defaultReason,
      idempotencyKey: record.echoKey,
      lastRejectCode: record.lastRejectCode,
      reconcileMatched: record.reconcileMatched,
      economicFinalityClaimed: false,
      fundsExecuted: false,
      bankDebitObserved: false,
      repaymentObserved: false,
      interestDefined: false,
      underwritingExecuted: false,
      kycExecuted: false,
      ownershipMutated: false,
      ticketOwnershipAuthoritative: false,
      externalCredit: "UNSUPPORTED",
      note: CREDIT_CASE_NOTE,
    };
  }

  private settlementFailed(record: CaseRecord): boolean {
    if (record.settlementId === null) {
      return false;
    }
    try {
      return this.settlementView(record.settlementId).phase === "FAILED";
    } catch {
      return false;
    }
  }

  private assertCase(record: CaseRecord): void {
    if (record.outstandingExposure + record.repaidExposure !== record.drawnExposure) {
      throw creditError("MOCK_INVARIANT");
    }
    if (record.outstandingExposure < 0 || record.repaidExposure < 0 || record.drawnExposure < 0) {
      throw creditError("MOCK_INVARIANT");
    }
    const pool = this.claims.get(record.claimId);
    if (pool && (pool.reserved < 0 || pool.reserved > pool.openFace)) {
      throw creditError("MOCK_INVARIANT");
    }
  }
}

function settlementGate(record: CaseRecord): CreditSettlementGate {
  if (record.mockSettlementCommitObserved) {
    return "MOCK_COMMIT_OBSERVED";
  }
  if (record.settlementId === null) {
    return "UNBOUND";
  }
  return "BOUND";
}

function offerBinding(input: {
  advanceId: string;
  amount: number;
  beneficiaryRole: string;
  claimId: string;
  openFace: number;
}): string {
  return canonicalJson({
    advanceId: input.advanceId,
    amount: input.amount,
    beneficiaryRole: input.beneficiaryRole,
    claimId: input.claimId,
    openFace: input.openFace,
  });
}

function repayBinding(advanceId: string, amount: number, repayId: string, sequence: number): string {
  return canonicalJson({ advanceId, amount, repayId, sequence });
}

function required(value: string | undefined): string {
  if (!value) {
    throw creditError("MOCK_INVARIANT");
  }
  return value;
}

function ident(value: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 100 || value.trim() !== value) {
    throw creditError("INVALID_ID");
  }
  return value;
}

function money(value: number): number {
  if (!Number.isInteger(value) || value <= 0 || value > MONEY_MAX) {
    throw creditError("INVALID_AMOUNT");
  }
  return value;
}

function repaymentSequence(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw creditError("REPAYMENT_ORDER");
  }
  return value;
}

function creditError(code: string): ProtocolError {
  return new ProtocolError(`${code}: mock credit command rejected.`, code);
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
