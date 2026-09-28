import { isRecord } from "./record.js";
import { SURFACES } from "./surfaces.js";
import {
  ProtocolError,
  RESERVATION_ADMISSION_REFERENCE,
  RESERVATION_PROVENANCE,
  RESERVATION_REFERENCES,
  type ReservationCaseView,
  type ReservationClock,
  type ReservationCommandReceipt,
  type ReservationConfirm,
  type ReservationConsume,
  type ReservationAuthorize,
  type ReservationBind,
  type ReservationHold,
  type ReservationIssue,
  type ReservationIssueStatus,
  type ReservationLifecycleCommand,
  type ReservationPayment,
  type ReservationPhase,
  type ReservationReconcileReceipt,
  type ReservationSettlementGate,
  type ReservationShowRegister,
  type ReservationShowView,
  type ReservationSlotState,
  type ReservationSlotView,
  type ReservationStep,
} from "./types.js";

/**
 * In-process mock reservation cases for the booking and admission desks.
 *
 * Phase names, idempotency echoes, terminal immutability, duplicate consume,
 * settlement-coupling refusal, and reconcile `matched` follow the kix-protocol
 * in-memory FSM at the UI contract only.
 * Authoritative machine: BeautifulMind-JT/kix-protocol
 * `reference/booking_resale_admission/reservation_fsm.py`
 * on main `a47828dd4517c5a7397e09eb6b563a64e4265c82`
 * (feature `2183d0b5b5010ec2692c43c277e99926ad9250db`).
 *
 * This store does not port MockGates arithmetic, slot pricing, or inventory math.
 * It does not add OpenAPI commands. B01–B05, R01–R05, and P03 stay 설계중.
 * The journal is process-local. It is not the protocol journal and not a ledger.
 * Catalog capacity on the Wave 4 hold pointer is a separate desk counter.
 */
export const RESERVATION_DEPTH_BASELINE = {
  protocolRepo: "BeautifulMind-JT/kix-protocol",
  protocolMainSha: "a47828dd4517c5a7397e09eb6b563a64e4265c82",
  featureCommit: "2183d0b5b5010ec2692c43c277e99926ad9250db",
  fsmPath: "reference/booking_resale_admission/reservation_fsm.py",
  provenance: RESERVATION_PROVENANCE,
} as const;

export const RESERVATION_CASE_NOTE =
  "Simulated mock phase on the adapter stub. Not live admission. B01–B05, R01–R05, and P03 stay 설계중. Protocol truth remains in kix-protocol. This case does not compute inventory or move funds.";

const TERMINAL: ReadonlySet<ReservationPhase> = new Set(["RELEASED", "CANCELLED", "CONSUMED"]);
const PRE_ISSUE: ReadonlySet<ReservationPhase> = new Set(["HELD", "CONFIRMED", "PAYMENT_NOTED"]);

const UNSTORED_REJECTION: ReadonlySet<string> = new Set([
  "MOCK_INVARIANT",
  "IDEMPOTENCY_CONFLICT",
  "INVALID_JOURNAL",
]);

const JOURNAL_OPS = [
  "set_clock",
  "register_show",
  "hold",
  "release",
  "confirm",
  "cancel",
  "observe_payment",
  "bind_settlement",
  "issue",
  "authorize_admission",
  "consume",
] as const;

type JournalOp = (typeof JOURNAL_OPS)[number];
type TransitionOp = Exclude<JournalOp, "set_clock" | "register_show" | "hold">;

const ALLOWED: Record<TransitionOp, ReadonlySet<ReservationPhase>> = {
  release: new Set(["HELD"]),
  confirm: new Set(["HELD"]),
  cancel: new Set(["CONFIRMED"]),
  observe_payment: new Set(["CONFIRMED"]),
  bind_settlement: new Set(["CONFIRMED", "PAYMENT_NOTED"]),
  issue: new Set(["PAYMENT_NOTED"]),
  authorize_admission: new Set(["ISSUED", "ADMISSION_AUTHORIZED", "CONSUMED"]),
  consume: new Set(["ISSUED", "ADMISSION_AUTHORIZED"]),
};

const SPECIFIC: Readonly<Record<string, string>> = {
  "confirm:CONFIRMED": "RESERVATION_ALREADY_ORDERED",
  "confirm:PAYMENT_NOTED": "RESERVATION_ALREADY_ORDERED",
  "confirm:ISSUED": "RESERVATION_ALREADY_ORDERED",
  "confirm:ADMISSION_AUTHORIZED": "RESERVATION_ALREADY_ORDERED",
  "confirm:CONSUMED": "RESERVATION_ALREADY_ORDERED",
  "cancel:PAYMENT_NOTED": "COMPENSATION_UNDEFINED",
  "cancel:ISSUED": "CANCEL_AFTER_ISSUE",
  "cancel:ADMISSION_AUTHORIZED": "CANCEL_AFTER_ISSUE",
  "cancel:CONSUMED": "CANCEL_AFTER_ISSUE",
  "issue:ISSUED": "ORDER_ALREADY_ISSUED",
  "issue:ADMISSION_AUTHORIZED": "ORDER_ALREADY_ISSUED",
  "issue:CONSUMED": "ORDER_ALREADY_ISSUED",
  "consume:CONSUMED": "ALREADY_CONSUMED",
};

interface SlotRecord {
  slot: string;
  state: ReservationSlotState;
  reservationId: string | null;
  rightId: string | null;
}

interface ShowRecord {
  showId: string;
  eventId: string;
  canon: string;
  slots: SlotRecord[];
}

interface CaseRecord {
  reservationId: string;
  phase: ReservationPhase;
  showId: string;
  slot: string;
  buyerRole: string;
  expiresAt: string;
  orderId: string | null;
  paymentRef: string | null;
  issuanceId: string | null;
  rightId: string | null;
  admissionId: string | null;
  consumeId: string | null;
  settlementId: string | null;
  mockSettlementCommitObserved: boolean;
  lastKey: string;
  echoKey: string;
  lastRejectCode: string | null;
  reconcileMatched: boolean | null;
}

interface OrderRecord {
  canon: string;
  reservationId: string;
}

interface IssuanceRecord {
  canon: string;
  reservationId: string;
}

interface JournalEntry {
  op: JournalOp;
  idempotencyKey: string;
  subjectId: string;
  body: Record<string, string>;
}

interface StoredCall {
  request: string;
  result: ReservationCommandReceipt | null;
  error: string | null;
}

export class ReservationCaseStore {
  private clockMs = 0;
  private readonly shows = new Map<string, ShowRecord>();
  private readonly cases = new Map<string, CaseRecord>();
  private readonly orders = new Map<string, OrderRecord>();
  private readonly issuances = new Map<string, IssuanceRecord>();
  private readonly admissions = new Map<string, string>();
  private readonly consumes = new Map<string, string>();
  private readonly journal: JournalEntry[] = [];
  private readonly idempotency = new Map<string, StoredCall>();

  constructor(private readonly settlementPhase: (settlementId: string) => string) {}

  advanceClock(input: ReservationClock): ReservationCommandReceipt {
    const body = { nowAt: input.nowAt };
    return this.call("set_clock", "clock", input.idempotencyKey, body, () => null, (key, request) => {
      this.applyClock(body);
      return this.accept(key, request, "set_clock", "clock", body, null);
    });
  }

  registerShow(input: ReservationShowRegister): ReservationCommandReceipt {
    if (!Array.isArray(input.slots)) {
      throw reservationError("MOCK_INVARIANT");
    }
    const body = { eventId: input.eventId, slots: input.slots.join(",") };
    return this.call("register_show", input.showId, input.idempotencyKey, body, () => null, (key, request) => {
      // The journal body joins slots with commas, so a slot name must not carry one.
      for (const slot of input.slots) {
        ident(slot);
      }
      const showId = ident(input.showId);
      this.applyRegister(showId, body);
      return this.accept(key, request, "register_show", showId, body, null);
    });
  }

  hold(input: ReservationHold): ReservationCommandReceipt {
    const body = {
      buyerRole: input.buyerRole,
      expiresAt: input.expiresAt,
      showId: input.showId,
      slot: input.slot,
    };
    return this.call(
      "hold",
      input.reservationId,
      input.idempotencyKey,
      body,
      () => this.knownReservation(input.reservationId),
      (key, request) => {
        const reservationId = ident(input.reservationId);
        this.applyHold(reservationId, body, key);
        return this.accept(key, request, "hold", reservationId, body, reservationId);
      },
    );
  }

  release(input: ReservationStep): ReservationCommandReceipt {
    return this.call(
      "release",
      input.reservationId,
      input.idempotencyKey,
      {},
      () => this.knownReservation(input.reservationId),
      (key, request) => {
        const reservationId = ident(input.reservationId);
        this.applyRelease(reservationId, key);
        return this.accept(key, request, "release", reservationId, {}, reservationId);
      },
    );
  }

  confirm(input: ReservationConfirm): ReservationCommandReceipt {
    const body = { reservationId: input.reservationId };
    return this.call(
      "confirm",
      input.orderId,
      input.idempotencyKey,
      body,
      () => this.knownReservation(input.reservationId),
      (key, request) => {
        const orderId = ident(input.orderId);
        const reservationId = this.applyConfirm(orderId, body, key);
        return this.accept(key, request, "confirm", orderId, { reservationId }, reservationId);
      },
    );
  }

  cancel(input: ReservationStep): ReservationCommandReceipt {
    return this.call(
      "cancel",
      input.reservationId,
      input.idempotencyKey,
      {},
      () => this.knownReservation(input.reservationId),
      (key, request) => {
        const reservationId = ident(input.reservationId);
        this.applyCancel(reservationId, key);
        return this.accept(key, request, "cancel", reservationId, {}, reservationId);
      },
    );
  }

  observePayment(input: ReservationPayment): ReservationCommandReceipt {
    const body = { paymentRef: input.paymentRef };
    return this.call(
      "observe_payment",
      input.orderId,
      input.idempotencyKey,
      body,
      () => this.reservationIdForOrder(input.orderId),
      (key, request) => {
        const orderId = ident(input.orderId);
        const reservationId = this.applyObserve(orderId, body, key);
        return this.accept(key, request, "observe_payment", orderId, { paymentRef: ident(body.paymentRef ?? "") }, reservationId);
      },
    );
  }

  bindSettlement(input: ReservationBind): ReservationCommandReceipt {
    const body = { settlementId: input.settlementId };
    return this.call(
      "bind_settlement",
      input.reservationId,
      input.idempotencyKey,
      body,
      () => this.knownReservation(input.reservationId),
      (key, request) => {
        const reservationId = ident(input.reservationId);
        const settlementId = this.applyBind(reservationId, body, key);
        return this.accept(key, request, "bind_settlement", reservationId, { settlementId }, reservationId);
      },
    );
  }

  issue(input: ReservationIssue): ReservationCommandReceipt {
    const body = { orderId: input.orderId };
    return this.call(
      "issue",
      input.issuanceId,
      input.idempotencyKey,
      body,
      () => this.reservationIdForOrder(input.orderId),
      (key, request) => {
        const issuanceId = ident(input.issuanceId);
        const outcome = this.applyIssue(issuanceId, body, key, null);
        return this.accept(
          key,
          request,
          "issue",
          issuanceId,
          { observed: outcome.observed ? "true" : "false", orderId: outcome.orderId },
          outcome.reservationId,
        );
      },
    );
  }

  authorizeAdmission(input: ReservationAuthorize): ReservationCommandReceipt {
    const body = { rightId: input.rightId };
    return this.call(
      "authorize_admission",
      input.admissionId,
      input.idempotencyKey,
      body,
      () => this.reservationIdForRight(input.rightId),
      (key, request) => {
        const admissionId = ident(input.admissionId);
        const reservationId = this.applyAuthorize(admissionId, body, key);
        return this.accept(
          key,
          request,
          "authorize_admission",
          admissionId,
          { rightId: ident(body.rightId ?? "") },
          reservationId,
        );
      },
    );
  }

  consume(input: ReservationConsume): ReservationCommandReceipt {
    const body = { rightId: input.rightId };
    return this.call(
      "consume",
      input.consumeId,
      input.idempotencyKey,
      body,
      () => this.reservationIdForRight(input.rightId),
      (key, request) => {
        const consumeId = ident(input.consumeId);
        const reservationId = this.applyConsume(consumeId, body, key);
        return this.accept(key, request, "consume", consumeId, { rightId: ident(body.rightId ?? "") }, reservationId);
      },
    );
  }

  reconcile(input: ReservationStep): ReservationReconcileReceipt {
    return this.call(
      "reconcile",
      input.reservationId,
      input.idempotencyKey,
      {},
      () => this.knownReservation(input.reservationId),
      (key, request) => {
        const reservationId = ident(input.reservationId);
        const record = this.requireCase(reservationId);
        const rebuilt = new ReservationCaseStore(this.settlementPhase);
        for (const entry of this.journal) {
          rebuilt.replay(entry);
        }
        if (rebuilt.canonical() !== this.canonical()) {
          throw reservationError("MOCK_INVARIANT");
        }
        record.reconcileMatched = true;
        record.lastRejectCode = null;
        record.echoKey = key;
        const receipt: ReservationReconcileReceipt = {
          ...this.commandReceipt(false, "reconcile", key, record),
          applied: "reconcile",
          matched: true,
        };
        this.idempotency.set(key, { request, result: structuredClone(receipt), error: null });
        return structuredClone(receipt);
      },
    );
  }

  view(reservationId: string): ReservationCaseView {
    return this.toView(this.requireCase(ident(reservationId)));
  }

  viewShow(showId: string): ReservationShowView {
    const id = ident(showId);
    if (!this.shows.has(id)) {
      throw reservationError("UNKNOWN_SHOW");
    }
    return this.toShowView(id);
  }

  rejectExternal(kind: string): never {
    ident(kind);
    throw reservationError("EXTERNAL_UNSUPPORTED");
  }

  private applyClock(body: Record<string, string>): void {
    const nowAt = readTime(body.nowAt ?? "");
    const next = Date.parse(nowAt);
    if (next < this.clockMs) {
      throw reservationError("CLOCK_REGRESSION");
    }
    this.clockMs = next;
  }

  private applyRegister(showId: string, body: Record<string, string>): void {
    const eventId = ident(body.eventId ?? "");
    const slots = readSlots(body.slots ?? "");
    const canon = canonicalJson({ eventId, slots });
    const current = this.shows.get(showId);
    if (current) {
      if (current.canon !== canon) {
        throw reservationError("SHOW_BINDING_CONFLICT");
      }
      throw reservationError("ILLEGAL_TRANSITION");
    }
    this.shows.set(showId, {
      showId,
      eventId,
      canon,
      slots: slots.map((slot) => ({ slot, state: "FREE", reservationId: null, rightId: null })),
    });
  }

  private applyHold(reservationId: string, body: Record<string, string>, key: string): void {
    const showId = ident(body.showId ?? "");
    const slot = ident(body.slot ?? "");
    const buyerRole = ident(body.buyerRole ?? "");
    const expiresAt = readTime(body.expiresAt ?? "");
    const canon = canonicalJson({ buyerRole, expiresAt, showId, slot });
    const current = this.cases.get(reservationId);
    if (current) {
      const currentCanon = canonicalJson({
        buyerRole: current.buyerRole,
        expiresAt: current.expiresAt,
        showId: current.showId,
        slot: current.slot,
      });
      if (currentCanon !== canon) {
        throw reservationError("RESERVATION_BINDING_CONFLICT");
      }
      if (TERMINAL.has(current.phase)) {
        throw reservationError("TERMINAL_IMMUTABLE");
      }
      throw reservationError("ILLEGAL_TRANSITION");
    }
    const show = this.shows.get(showId);
    if (!show) {
      throw reservationError("UNKNOWN_SHOW");
    }
    const row = show.slots.find((item) => item.slot === slot);
    if (!row) {
      throw reservationError("UNKNOWN_SLOT");
    }
    if (row.state !== "FREE") {
      throw reservationError("SLOT_OCCUPIED");
    }
    row.state = "RESERVED";
    row.reservationId = reservationId;
    row.rightId = null;
    this.cases.set(reservationId, {
      reservationId,
      phase: "HELD",
      showId,
      slot,
      buyerRole,
      expiresAt,
      orderId: null,
      paymentRef: null,
      issuanceId: null,
      rightId: null,
      admissionId: null,
      consumeId: null,
      settlementId: null,
      mockSettlementCommitObserved: false,
      lastKey: key,
      echoKey: key,
      lastRejectCode: null,
      reconcileMatched: null,
    });
  }

  private applyRelease(reservationId: string, key: string): void {
    const record = this.requireCase(reservationId);
    this.enter(record, "release");
    record.phase = "RELEASED";
    this.freeOwnedSlot(record);
    this.mark(record, key);
  }

  private applyConfirm(orderId: string, body: Record<string, string>, key: string): string {
    const reservationId = ident(body.reservationId ?? "");
    const canon = canonicalJson({ reservationId });
    const prior = this.orders.get(orderId);
    if (prior) {
      if (prior.canon !== canon) {
        throw reservationError("ORDER_BINDING_CONFLICT");
      }
      throw reservationError("ILLEGAL_TRANSITION");
    }
    const record = this.requireCase(reservationId);
    this.enter(record, "confirm");
    if (this.isExpired(record)) {
      throw reservationError("RESERVATION_EXPIRED");
    }
    record.orderId = orderId;
    record.phase = "CONFIRMED";
    this.orders.set(orderId, { canon, reservationId });
    this.mark(record, key);
    return reservationId;
  }

  private applyCancel(reservationId: string, key: string): void {
    const record = this.requireCase(reservationId);
    this.enter(record, "cancel");
    record.phase = "CANCELLED";
    this.freeOwnedSlot(record);
    this.mark(record, key);
  }

  private applyObserve(orderId: string, body: Record<string, string>, key: string): string {
    const paymentRef = ident(body.paymentRef ?? "");
    const order = this.orders.get(orderId);
    if (!order) {
      throw reservationError("UNKNOWN_ORDER");
    }
    const record = this.requireCase(order.reservationId);
    this.enter(record, "observe_payment");
    record.paymentRef = paymentRef;
    record.phase = "PAYMENT_NOTED";
    this.mark(record, key);
    return record.reservationId;
  }

  private applyBind(reservationId: string, body: Record<string, string>, key: string): string {
    const settlementId = ident(body.settlementId ?? "");
    const record = this.requireCase(reservationId);
    this.enter(record, "bind_settlement");
    if (record.settlementId !== null) {
      if (record.settlementId !== settlementId) {
        throw reservationError("SETTLEMENT_BINDING_CONFLICT");
      }
      throw reservationError("ILLEGAL_TRANSITION");
    }
    record.settlementId = settlementId;
    this.mark(record, key);
    return settlementId;
  }

  private applyIssue(
    issuanceId: string,
    body: Record<string, string>,
    key: string,
    observedOverride: boolean | null,
  ): { reservationId: string; orderId: string; observed: boolean } {
    const orderId = ident(body.orderId ?? "");
    const canon = canonicalJson({ orderId });
    const prior = this.issuances.get(issuanceId);
    if (prior) {
      if (prior.canon !== canon) {
        throw reservationError("ISSUANCE_BINDING_CONFLICT");
      }
      throw reservationError("ILLEGAL_TRANSITION");
    }
    const order = this.orders.get(orderId);
    if (!order) {
      throw reservationError("UNKNOWN_ORDER");
    }
    const record = this.requireCase(order.reservationId);
    this.enter(record, "issue");
    const observed = observedOverride === null ? this.observeSettlement(record) : observedOverride;
    record.issuanceId = issuanceId;
    record.rightId = issuanceId;
    record.mockSettlementCommitObserved = observed;
    record.phase = "ISSUED";
    const row = this.ownedSlot(record);
    row.state = "ISSUED";
    row.rightId = issuanceId;
    this.issuances.set(issuanceId, { canon, reservationId: record.reservationId });
    this.mark(record, key);
    return { reservationId: record.reservationId, orderId, observed };
  }

  private applyAuthorize(admissionId: string, body: Record<string, string>, key: string): string {
    const rightId = ident(body.rightId ?? "");
    const canon = canonicalJson({ rightId });
    const prior = this.admissions.get(admissionId);
    if (prior !== undefined) {
      if (prior !== canon) {
        throw reservationError("ADMISSION_BINDING_CONFLICT");
      }
      throw reservationError("ILLEGAL_TRANSITION");
    }
    const record = this.caseByRight(rightId);
    this.enter(record, "authorize_admission");
    if (record.phase === "CONSUMED") {
      throw reservationError("RIGHT_NOT_ACTIVE");
    }
    if (record.phase === "ADMISSION_AUTHORIZED") {
      throw reservationError("ADMISSION_LOCKED");
    }
    record.admissionId = admissionId;
    record.phase = "ADMISSION_AUTHORIZED";
    this.admissions.set(admissionId, canon);
    this.mark(record, key);
    return record.reservationId;
  }

  private applyConsume(consumeId: string, body: Record<string, string>, key: string): string {
    const rightId = ident(body.rightId ?? "");
    const record = this.caseByRight(rightId);
    this.enter(record, "consume");
    const canon = canonicalJson({ rightId });
    const prior = this.consumes.get(consumeId);
    if (prior !== undefined) {
      if (prior !== canon) {
        throw reservationError("CONSUME_BINDING_CONFLICT");
      }
      throw reservationError("ILLEGAL_TRANSITION");
    }
    if (record.phase === "ISSUED") {
      throw reservationError("ADMISSION_REQUIRED");
    }
    record.consumeId = consumeId;
    record.admissionId = null;
    record.phase = "CONSUMED";
    this.consumes.set(consumeId, canon);
    this.mark(record, key);
    return record.reservationId;
  }

  private observeSettlement(record: CaseRecord): boolean {
    if (record.settlementId === null) {
      return false;
    }
    let phase: string;
    try {
      phase = this.settlementPhase(record.settlementId);
    } catch (error) {
      if (error instanceof ProtocolError && typeof error.code === "string") {
        throw reservationError(error.code);
      }
      throw error;
    }
    if (phase !== "COMMITTED") {
      throw reservationError("SETTLEMENT_NOT_COMMITTED");
    }
    return true;
  }

  private enter(record: CaseRecord, op: TransitionOp): void {
    const specific = SPECIFIC[`${op}:${record.phase}`];
    if (specific !== undefined) {
      throw reservationError(specific);
    }
    if (ALLOWED[op].has(record.phase)) {
      return;
    }
    if (TERMINAL.has(record.phase)) {
      throw reservationError("TERMINAL_IMMUTABLE");
    }
    throw reservationError("ILLEGAL_TRANSITION");
  }

  private accept(
    key: string,
    request: string,
    op: JournalOp,
    subjectId: string,
    journalBody: Record<string, string>,
    reservationId: string | null,
  ): ReservationCommandReceipt {
    this.journal.push({
      op,
      idempotencyKey: key,
      subjectId,
      body: { ...journalBody },
    });
    const record = reservationId === null ? null : this.requireCase(reservationId);
    const receipt = this.commandReceipt(false, op, key, record);
    this.idempotency.set(key, { request, result: structuredClone(receipt), error: null });
    return structuredClone(receipt);
  }

  private call<T extends ReservationCommandReceipt>(
    op: ReservationLifecycleCommand,
    subjectId: string,
    idempotencyKey: string,
    body: Record<string, string>,
    reservationIdOf: () => string | null,
    execute: (key: string, request: string) => T,
  ): T {
    const key = ident(idempotencyKey);
    const request = canonicalJson({ body, op, subjectId });
    const prior = this.idempotency.get(key);
    if (prior) {
      if (prior.request !== request) {
        this.noteReject(reservationIdOf(), "IDEMPOTENCY_CONFLICT");
        throw reservationError("IDEMPOTENCY_CONFLICT");
      }
      if (prior.error !== null) {
        this.noteReject(reservationIdOf(), prior.error);
        throw reservationError(prior.error);
      }
      if (prior.result === null) {
        throw reservationError("MOCK_INVARIANT");
      }
      const replay = structuredClone(prior.result) as T;
      replay.duplicate = true;
      replay.applied = null;
      replay.economicFinalityClaimed = false;
      replay.fundsExecuted = false;
      if (replay.reservation) {
        replay.reservation.economicFinalityClaimed = false;
        replay.reservation.fundsExecuted = false;
        replay.reservation.chainIssued = false;
        replay.reservation.admissionRoutingProduction = false;
      }
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
        this.noteReject(reservationIdOf(), error.code);
      }
      throw error;
    }
  }

  private replay(entry: JournalEntry): void {
    if (!isJournalOp(entry.op)) {
      throw reservationError("INVALID_JOURNAL");
    }
    switch (entry.op) {
      case "set_clock":
        if (entry.subjectId !== "clock") {
          throw reservationError("MOCK_INVARIANT");
        }
        this.applyClock(entry.body);
        break;
      case "register_show":
        this.applyRegister(entry.subjectId, entry.body);
        break;
      case "hold":
        this.applyHold(entry.subjectId, entry.body, entry.idempotencyKey);
        break;
      case "release":
        this.applyRelease(entry.subjectId, entry.idempotencyKey);
        break;
      case "confirm":
        this.applyConfirm(entry.subjectId, entry.body, entry.idempotencyKey);
        break;
      case "cancel":
        this.applyCancel(entry.subjectId, entry.idempotencyKey);
        break;
      case "observe_payment":
        this.applyObserve(entry.subjectId, entry.body, entry.idempotencyKey);
        break;
      case "bind_settlement":
        this.applyBind(entry.subjectId, entry.body, entry.idempotencyKey);
        break;
      case "issue":
        this.applyIssue(entry.subjectId, entry.body, entry.idempotencyKey, readObserved(entry.body.observed));
        break;
      case "authorize_admission":
        this.applyAuthorize(entry.subjectId, entry.body, entry.idempotencyKey);
        break;
      case "consume":
        this.applyConsume(entry.subjectId, entry.body, entry.idempotencyKey);
        break;
      default:
        throw reservationError("INVALID_JOURNAL");
    }
    this.journal.push({
      op: entry.op,
      idempotencyKey: entry.idempotencyKey,
      subjectId: entry.subjectId,
      body: { ...entry.body },
    });
  }

  private canonical(): string {
    const cases = [...this.cases.values()]
      .map((record) => ({
        admissionId: record.admissionId,
        buyerRole: record.buyerRole,
        consumeId: record.consumeId,
        expiresAt: record.expiresAt,
        idempotencyKey: record.lastKey,
        issuanceId: record.issuanceId,
        mockSettlementCommitObserved: record.mockSettlementCommitObserved,
        orderId: record.orderId,
        paymentRef: record.paymentRef,
        phase: record.phase,
        reservationId: record.reservationId,
        rightId: record.rightId,
        settlementId: record.settlementId,
        showId: record.showId,
        slot: record.slot,
      }))
      .sort((left, right) => left.reservationId.localeCompare(right.reservationId));
    const shows = [...this.shows.values()]
      .map((show) => ({
        eventId: show.eventId,
        showId: show.showId,
        slots: show.slots.map((row) => ({
          reservationId: row.reservationId,
          rightId: row.rightId,
          slot: row.slot,
          state: row.state,
        })),
      }))
      .sort((left, right) => left.showId.localeCompare(right.showId));
    return canonicalJson({
      cases,
      journal: this.journal.map((entry) => ({
        body: entry.body,
        idempotencyKey: entry.idempotencyKey,
        op: entry.op,
        subjectId: entry.subjectId,
      })),
      logicalTimeMs: this.clockMs,
      shows,
    });
  }

  private noteReject(reservationId: string | null, code: string): void {
    if (reservationId === null) {
      return;
    }
    const record = this.cases.get(reservationId);
    if (!record) {
      return;
    }
    record.lastRejectCode = code;
  }

  private commandReceipt(
    duplicate: boolean,
    applied: ReservationLifecycleCommand | null,
    idempotencyKey: string,
    record: CaseRecord | null,
  ): ReservationCommandReceipt {
    const showId = record?.showId ?? null;
    return {
      duplicate,
      applied,
      provenance: RESERVATION_PROVENANCE,
      economicFinalityClaimed: false,
      fundsExecuted: false,
      externalPayment: "UNSUPPORTED",
      externalAdmission: "UNSUPPORTED",
      idempotencyKey,
      logicalTimeMs: this.clockMs,
      reservation: record ? this.toView(record) : null,
      show: showId !== null && this.shows.has(showId) ? this.toShowView(showId) : null,
    };
  }

  private toView(record: CaseRecord): ReservationCaseView {
    const show = this.shows.get(record.showId);
    if (!show) {
      throw reservationError("MOCK_INVARIANT");
    }
    const row = show.slots.find((item) => item.slot === record.slot);
    if (!row) {
      throw reservationError("MOCK_INVARIANT");
    }
    return {
      mode: "mock",
      surface: SURFACES.bookingFsm,
      admissionSurface: SURFACES.admissionFsm,
      references: [...RESERVATION_REFERENCES],
      admissionReference: RESERVATION_ADMISSION_REFERENCE,
      provenance: RESERVATION_PROVENANCE,
      lifecycleAuthority: "IN_MEMORY_FSM",
      reservationId: record.reservationId,
      phase: record.phase,
      terminal: TERMINAL.has(record.phase),
      showId: record.showId,
      eventId: show.eventId,
      slot: record.slot,
      slotState: row.state,
      slotHeldByCase: row.reservationId === record.reservationId,
      buyerRole: record.buyerRole,
      expiresAt: record.expiresAt,
      expired: this.isExpired(record),
      orderId: record.orderId,
      paymentRef: record.paymentRef,
      issuanceId: record.issuanceId,
      rightId: record.rightId,
      issueStatus: issueStatus(record.phase),
      admissionId: record.admissionId,
      consumeId: record.consumeId,
      settlementId: record.settlementId,
      settlementGate: settlementGate(record),
      mockSettlementCommitObserved: record.mockSettlementCommitObserved,
      economicFinalityClaimed: false,
      fundsExecuted: false,
      chainIssued: false,
      admissionRoutingProduction: false,
      externalPayment: "UNSUPPORTED",
      externalAdmission: "UNSUPPORTED",
      logicalTimeMs: this.clockMs,
      idempotencyKey: record.echoKey,
      lastRejectCode: record.lastRejectCode,
      reconcileMatched: record.reconcileMatched,
      note: RESERVATION_CASE_NOTE,
    };
  }

  private toShowView(showId: string): ReservationShowView {
    const show = this.shows.get(showId);
    if (!show) {
      throw reservationError("UNKNOWN_SHOW");
    }
    const slots: ReservationSlotView[] = show.slots.map((row) => ({
      slot: row.slot,
      state: row.state,
      reservationId: row.reservationId,
      rightId: row.rightId,
    }));
    return {
      mode: "mock",
      surface: SURFACES.bookingFsm,
      provenance: RESERVATION_PROVENANCE,
      showId: show.showId,
      eventId: show.eventId,
      logicalTimeMs: this.clockMs,
      slots,
      note: RESERVATION_CASE_NOTE,
    };
  }

  private isExpired(record: CaseRecord): boolean {
    return PRE_ISSUE.has(record.phase) && Date.parse(record.expiresAt) <= this.clockMs;
  }

  private requireCase(reservationId: string): CaseRecord {
    const record = this.cases.get(reservationId);
    if (!record) {
      throw reservationError("UNKNOWN_RESERVATION");
    }
    return record;
  }

  private caseByRight(rightId: string): CaseRecord {
    const issuance = this.issuances.get(rightId);
    if (!issuance) {
      throw reservationError("UNKNOWN_RIGHT");
    }
    return this.requireCase(issuance.reservationId);
  }

  private ownedSlot(record: CaseRecord): SlotRecord {
    const show = this.shows.get(record.showId);
    const row = show?.slots.find((item) => item.slot === record.slot);
    if (!row || row.reservationId !== record.reservationId) {
      throw reservationError("MOCK_INVARIANT");
    }
    return row;
  }

  private freeOwnedSlot(record: CaseRecord): void {
    const row = this.ownedSlot(record);
    row.state = "FREE";
    row.reservationId = null;
    row.rightId = null;
  }

  private mark(record: CaseRecord, key: string): void {
    record.lastKey = key;
    record.echoKey = key;
    record.lastRejectCode = null;
  }

  private knownReservation(reservationId: string): string | null {
    return this.cases.has(reservationId) ? reservationId : null;
  }

  private reservationIdForOrder(orderId: string): string | null {
    return this.orders.get(orderId)?.reservationId ?? null;
  }

  private reservationIdForRight(rightId: string): string | null {
    return this.issuances.get(rightId)?.reservationId ?? null;
  }
}

function issueStatus(phase: ReservationPhase): ReservationIssueStatus {
  if (phase === "CONSUMED") {
    return "consumed";
  }
  if (phase === "ISSUED" || phase === "ADMISSION_AUTHORIZED") {
    return "issued";
  }
  return "unissued";
}

function settlementGate(record: CaseRecord): ReservationSettlementGate {
  if (record.mockSettlementCommitObserved) {
    return "MOCK_COMMIT_OBSERVED";
  }
  if (record.settlementId === null) {
    return "UNBOUND";
  }
  return "BOUND";
}

function readObserved(value: string | undefined): boolean {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw reservationError("MOCK_INVARIANT");
}

function readSlots(value: string): string[] {
  if (value.length === 0) {
    throw reservationError("MOCK_INVARIANT");
  }
  const parts = value.split(",");
  if (parts.length > 4) {
    throw reservationError("MOCK_INVARIANT");
  }
  const slots = parts.map((part) => ident(part));
  if (new Set(slots).size !== slots.length) {
    throw reservationError("MOCK_INVARIANT");
  }
  return slots;
}

function readTime(value: string): string {
  const time = ident(value);
  if (!Number.isFinite(Date.parse(time))) {
    throw reservationError("INVALID_ID");
  }
  return time;
}

function ident(value: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 100 || value.trim() !== value || value.includes(",")) {
    throw reservationError("INVALID_ID");
  }
  return value;
}

function reservationError(code: string): ProtocolError {
  return new ProtocolError(`${code}: mock reservation command rejected.`, code);
}

function isJournalOp(value: string): value is JournalOp {
  return (JOURNAL_OPS as readonly string[]).includes(value);
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
