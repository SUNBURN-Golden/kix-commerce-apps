import { JOURNEY_NOT_COMPOSED, type JourneyNotComposed } from "./booking-journey.js";
import { COMMERCE_COMMAND_BINDINGS } from "./commerce-bindings.js";
import {
  DISCOVERY_PROJECTION_AS_OF,
  DISCOVERY_READ_TUPLE_LITERALS,
  checkDiscoveryReadTuple,
  type DiscoveryReadTuple,
} from "./discovery-read.js";
import { type PinnedAction } from "./openapi-contract-pin.js";

/**
 * Synthetic refund-and-return source for the booking, settlement, and buyer
 * surfaces.
 *
 * This is the stub-scope stand-in for pending nodes `api-state-distinction`
 * and `refund-surface`. The contract-only catalogue has no order or
 * refund-case read command, so no producer SDK, manifest, or vector is
 * consumed and this module sends nothing over a network. `refund_ticket`,
 * `void_unissued`, `adjust_pg_cancel`, and `observe_return` are pinned and
 * never composed. The catalogue has no booking-cancel command, so the
 * synthetic cancel line names none.
 *
 * The source is deliberately naive. It does not de-duplicate a repeated
 * intent and it carries no idempotency key, so the only thing that keeps a
 * client from a second effect is the client fence in
 * refund-return-controller.ts. Marking a return required is a source event
 * the page requests through a synthetic control; a real producer offers no
 * such call.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const REFUND_RETURN_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const REFUND_RETURN_NOT_BOUND_REASON =
  "The contract-only catalogue has no order read or refund-case command: refund_ticket, void_unissued, adjust_pg_cancel, and observe_return are pinned but never composed, and pending nodes api-state-distinction and refund-surface are not promoted. The refund and return desk stays not-bound on integration-http.";

export const REFUND_RETURN_PROJECTION_NAME = "kix.refund.return";

/** Fixed instant the synthetic source claims to be built at. */
export const REFUND_RETURN_AS_OF = DISCOVERY_PROJECTION_AS_OF;

/** Watermark the stale scenario serves, and the floor a reader holds against it. */
export const REFUND_RETURN_STALE_WATERMARK = "2026-10-10T00:00:00.000Z";
export const REFUND_RETURN_STALE_FLOOR = "2026-10-12T00:00:00.000Z";

/** The desk's own actor string. It is a context label, not an authentication result. */
export const REFUND_RETURN_DESK_ACTOR = "refund-desk";

/**
 * The five order states a screen may show. Each is a separate cell with its
 * own state word; there is no aggregate completion state. `returnRequired`
 * is not a pre-stage of `refundDone`: recording a refund never flips the
 * return cell, and observing a return never records a refund.
 */
export const REFUND_CELLS = ["reservation", "payment", "issuance", "returnRequired", "refundDone"] as const;

export type RefundCell = (typeof REFUND_CELLS)[number];

/** Reservation cell states. A held reservation is not a payment. */
export const REFUND_RESERVATION_STATES = ["held", "confirmed", "cancelled"] as const;
/** Payment cell states. `observed` is a synthetic observation, not a real payment. */
export const REFUND_PAYMENT_STATES = ["none", "observed", "declined"] as const;
export const REFUND_ISSUANCE_STATES = ["none", "issued"] as const;
export const REFUND_RETURN_STATES = ["none", "required", "observed"] as const;
export const REFUND_REFUND_STATES = ["none", "recorded"] as const;

/**
 * The five refund-flow lines. Each keeps its own record and its own state.
 * `cancel` is a synthetic cancel request; the pinned catalogue has no
 * booking-cancel command. `void` stands in for `void_unissued`, `pgAdjust`
 * for `adjust_pg_cancel`, `returnObservation` for `observe_return`, and
 * `refund` for `refund_ticket` — each pinned action is recorded and never
 * sent, and a recorded line executes nothing.
 */
export const REFUND_FLOW_LINES = ["cancel", "void", "pgAdjust", "returnObservation", "refund"] as const;

export type RefundFlowLine = (typeof REFUND_FLOW_LINES)[number];

/** The synthetic writes. None of them is a desk method and none is a catalogue command. */
export const REFUND_STEPS = ["cancel", "void", "adjust", "observe-return", "refund"] as const;

export type RefundStep = (typeof REFUND_STEPS)[number];

/** Step to the flow line it writes on. */
export const REFUND_STEP_LINES: Readonly<Record<RefundStep, RefundFlowLine>> = {
  cancel: "cancel",
  void: "void",
  adjust: "pgAdjust",
  "observe-return": "returnObservation",
  refund: "refund",
};

/** The pinned action each line stands in for. `cancel` names none: the catalogue has no booking-cancel command. */
export const REFUND_LINE_ACTIONS: Readonly<Record<RefundFlowLine, PinnedAction | null>> = {
  cancel: null,
  void: "void_unissued",
  pgAdjust: "adjust_pg_cancel",
  returnObservation: "observe_return",
  refund: "refund_ticket",
};

export const REFUND_SCENARIOS = [
  "clean",
  "held-only",
  "unissued",
  "returned",
  "refund-recorded",
  "empty",
  "stale",
  "refund-lost",
  "held-response",
  "claims-real",
  "receipt-claims",
] as const;

export type RefundScenario = (typeof REFUND_SCENARIOS)[number];

export const REFUND_REJECT_CODES = [
  "CANCEL_UNAVAILABLE",
  "CANCEL_AFTER_PAYMENT",
  "ALREADY_CANCELLED",
  "VOID_UNAVAILABLE",
  "PAYMENT_NOT_OBSERVED",
  "RETURN_NOT_REQUIRED",
  "ALREADY_OBSERVED",
  "REFUND_UNAVAILABLE",
  "ALREADY_REFUNDED",
  "ALREADY_RECORDED",
  "VERSION_STALE",
  "UNKNOWN_REF",
  "IDENTITY_MISMATCH",
] as const;

export type RefundRejectCode = (typeof REFUND_REJECT_CODES)[number];

/** A rejection with one of these codes means the page read before it wrote is behind. */
export const REFUND_STALE_CLASS_CODES: readonly RefundRejectCode[] = ["VERSION_STALE"];

export const REFUND_INVALID_CODES = ["INTENT", "STEP", "IDENTITY", "VERSION"] as const;

export type RefundInvalidCode = (typeof REFUND_INVALID_CODES)[number];

export const REFUND_REFUSAL_CODES = ["CLAIM", "IDENTITY"] as const;

export type RefundRefusalCode = (typeof REFUND_REFUSAL_CODES)[number];

/** Quote of the locked hold binding. H1 keeps this consideredAction and keeps it not-bound. */
export const REFUND_HOLD_NOT_BOUND = {
  method: "placeHold",
  status: COMMERCE_COMMAND_BINDINGS.placeHold.status,
  consideredAction: COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction,
  reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
  mappedOntoPrepareTrade: false,
} as const;

/**
 * Non-claim fields every payload and every write receipt states as literal
 * false. A payload that claims any of them is refused whole. A recorded
 * cancel, void, adjustment, return observation, or refund executes nothing
 * and is not a provider or producer integration.
 */
export const REFUND_NON_CLAIM_FIELDS = [
  "realPayment",
  "fundsMoved",
  "refundExecuted",
  "voidExecuted",
  "integrationComplete",
  "productionEnvironment",
] as const;

export type RefundNonClaimField = (typeof REFUND_NON_CLAIM_FIELDS)[number];

export type RefundNonClaims = Readonly<Record<RefundNonClaimField, false>>;

const REFUND_NON_CLAIMS: RefundNonClaims = {
  realPayment: false,
  fundsMoved: false,
  refundExecuted: false,
  voidExecuted: false,
  integrationComplete: false,
  productionEnvironment: false,
};

export interface RefundNotComposed {
  action: JourneyNotComposed["action"] | "refund_ticket" | "void_unissued" | "adjust_pg_cancel" | "observe_return";
  reason: string;
}

/**
 * Catalogue commands this module records and does not send. The journey list
 * is reused as is. The four pinned refund-family commands are added with
 * their own reasons: the synthetic cancel, void, adjustment, return
 * observation, and refund records on this page compose none of them.
 */
export const REFUND_RETURN_NOT_COMPOSED: readonly RefundNotComposed[] = [
  ...JOURNEY_NOT_COMPOSED,
  {
    action: "refund_ticket",
    reason: `${REFUND_RETURN_RULING}. refund_ticket is pinned (domain, expectedVersion, ticketId) and never composed here. The synthetic refund line on this page is not refund_ticket and executes nothing.`,
  },
  {
    action: "void_unissued",
    reason: `${REFUND_RETURN_RULING}. void_unissued is pinned (domain, ticketId) and never composed. The synthetic void line on this page is not it and voids no right.`,
  },
  {
    action: "adjust_pg_cancel",
    reason: `${REFUND_RETURN_RULING}. adjust_pg_cancel is pinned (domain, contractRef, movementId, basis, amount, currency) and never composed. The synthetic PG-cancel adjustment line on this page is not it.`,
  },
  {
    action: "observe_return",
    reason: `${REFUND_RETURN_RULING}. observe_return is pinned (domain, effectId, movementId, payer, amount, currency) and never composed. The synthetic return-observation line on this page is not it.`,
  },
];

// ---------------------------------------------------------------------------
// Identity. Each kind has its own prefix and one kind is never read as another.
// ---------------------------------------------------------------------------

export const REFUND_REF_KINDS = [
  "order",
  "reservation",
  "payment",
  "issuance",
  "right",
  "cancel",
  "void",
  "adjust",
  "return",
  "refund",
] as const;

export type RefundRefKind = (typeof REFUND_REF_KINDS)[number];

const REF_PREFIX: Readonly<Record<Exclude<RefundRefKind, "order">, string>> = {
  reservation: "rsv-",
  payment: "pay-",
  issuance: "iss-",
  right: "rgt-",
  cancel: "ccl-",
  void: "vod-",
  adjust: "adj-",
  return: "rtn-",
  refund: "rfd-",
};

const ORDER_PATTERN = /^ord_[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/;
const REF_PATTERN = /^(rsv|pay|iss|rgt|ccl|vod|adj|rtn|rfd)-[0-9]{4}$/;

export function refundRef(kind: Exclude<RefundRefKind, "order">, serial: number): string {
  return `${REF_PREFIX[kind]}${String(serial).padStart(4, "0")}`;
}

export function refundRefKind(ref: string): RefundRefKind | null {
  if (ORDER_PATTERN.test(ref)) {
    return "order";
  }
  if (!REF_PATTERN.test(ref)) {
    return null;
  }
  for (const kind of REFUND_REF_KINDS) {
    if (kind !== "order" && ref.startsWith(REF_PREFIX[kind])) {
      return kind;
    }
  }
  return null;
}

export function isRefundRef(ref: unknown, kind: RefundRefKind): ref is string {
  return typeof ref === "string" && refundRefKind(ref) === kind;
}

export interface RefundIdentityRow {
  /** Kind of the identity on the screen. */
  id: RefundRefKind | "version";
  /** Field name on this module's snapshot. */
  field: string;
  status: "field-named" | "not-bound";
  /**
   * Published body fields that play the same role. A test reads the vendored pin and
   * checks every entry. Empty for a not-bound row. No body is built from this list.
   */
  bodyFields: readonly { action: PinnedAction; field: string }[];
  reason: string;
}

/**
 * Which identity on the refund-and-return desk has a named field in the
 * pinned catalogue. Naming a field is not binding it: the values here are
 * synthetic references, and no body is built from this list.
 */
export const REFUND_IDENTITY_REGISTER: readonly RefundIdentityRow[] = [
  {
    id: "order",
    field: "orderRef",
    status: "not-bound",
    bodyFields: [],
    reason:
      "No pinned body this desk could send names an order, and the catalogue has no order read command, so an order reference here is a synthetic row only.",
  },
  {
    id: "reservation",
    field: "reservationRef",
    status: "not-bound",
    bodyFields: [],
    reason: "No pinned body or receipt names a reservation id. A reservation reference on this screen is a synthetic row only.",
  },
  {
    id: "payment",
    field: "paymentRef",
    status: "not-bound",
    bodyFields: [],
    reason:
      "adjust_pg_cancel and observe_return name a movementId and an amount, and are never composed. The catalogue has no payment observation read, so a payment reference on this screen is a synthetic observation only.",
  },
  {
    id: "issuance",
    field: "issuanceRef",
    status: "not-bound",
    bodyFields: [],
    reason: "No pinned body or receipt names an issuance id. An issuance reference on this screen is a synthetic row only.",
  },
  {
    id: "right",
    field: "rightRef",
    status: "field-named",
    bodyFields: [
      { action: "create_listing", field: "ticketId" },
      { action: "prepare_trade", field: "ticketId" },
      { action: "offer_gift", field: "ticketId" },
      { action: "refund_ticket", field: "ticketId" },
      { action: "void_unissued", field: "ticketId" },
    ],
    reason: "The pinned bodies name the right as ticketId. The value here is a synthetic reference and no body is built from it.",
  },
  {
    id: "cancel",
    field: "cancelRef",
    status: "not-bound",
    bodyFields: [],
    reason:
      "The catalogue has no booking- or order-cancel command: cancel_event, cancel_gift, and cancel_listing name other subjects and stay uncomposed. A cancel reference on this screen is a synthetic record only.",
  },
  {
    id: "void",
    field: "voidRef",
    status: "not-bound",
    bodyFields: [],
    reason: "void_unissued is pinned and never composed. No void id is published, so a void reference on this screen is a synthetic record only.",
  },
  {
    id: "adjust",
    field: "adjustRef",
    status: "not-bound",
    bodyFields: [],
    reason: "adjust_pg_cancel is pinned and never composed. No adjustment id is published, so an adjustment reference on this screen is a synthetic record only.",
  },
  {
    id: "return",
    field: "returnRef",
    status: "not-bound",
    bodyFields: [],
    reason: "observe_return is pinned and never composed. No return-observation id is published, so a return reference on this screen is a synthetic record only.",
  },
  {
    id: "refund",
    field: "refundRef",
    status: "not-bound",
    bodyFields: [],
    reason: "refund_ticket is pinned and never composed. No refund id and no compensation policy are published, so a refund reference on this screen is a synthetic record only.",
  },
  {
    id: "version",
    field: "expectedVersion",
    status: "field-named",
    bodyFields: [
      { action: "create_listing", field: "expectedVersion" },
      { action: "prepare_trade", field: "expectedVersion" },
      { action: "refund_ticket", field: "expectedVersion" },
      { action: "offer_gift", field: "expectedVersion" },
    ],
    reason: "The pinned bodies carry the version the caller read. The client never raises it. Whether a version is current is the source's decision.",
  },
];

// ---------------------------------------------------------------------------
// Snapshot and outcome shapes
// ---------------------------------------------------------------------------

/** One of the five order-state cells. The state word is the source's own. */
export interface RefundCellView {
  state: string;
  ref: string | null;
  note: string;
}

/** One refund-flow line. A recorded line sent nothing and executes nothing. */
export interface RefundLineView {
  state: "none" | "recorded";
  ref: string | null;
  /** Always false. A synthetic line sends no pinned command. */
  sent: false;
  /** Always false. A recorded line executes nothing. */
  executed: false;
  note: string;
}

export interface RefundCaseView {
  orderRef: string;
  version: number;
  cells: Readonly<Record<RefundCell, RefundCellView>>;
  lines: Readonly<Record<RefundFlowLine, RefundLineView>>;
}

export interface RefundSnapshot {
  /** Read serial on this port. It orders reads and is not a commit position. */
  snapshotId: number;
  /** Advances on every effect at the source. A label, not a version the client may raise. */
  generation: number;
  watermark: string;
  scenario: RefundScenario;
  order: RefundCaseView;
  nonClaims: RefundNonClaims;
}

export interface RefundReceiptRefs {
  orderRef: string;
  reservationRef: string | null;
  paymentRef: string | null;
  issuanceRef: string | null;
  rightRef: string | null;
  returnRef: string | null;
  cancelRef: string | null;
  voidRef: string | null;
  adjustRef: string | null;
  refundRef: string | null;
  orderVersion: number | null;
}

export interface RefundReadRequest {
  contextKey: string;
  actorRef: string;
  /** The order this desk reads. A synthetic label, e.g. ord_<eventId>. */
  orderRef: string;
  watermarkFloor: string | null;
}

interface RefundWriteBase {
  contextKey: string;
  actorRef: string;
  /** The caller's intent. The source does not de-duplicate on it. */
  intentRef: string;
  orderRef: string;
  expectedVersion: number;
}

export type RefundWriteRequest =
  | (RefundWriteBase & { step: "cancel" })
  | (RefundWriteBase & { step: "void" })
  | (RefundWriteBase & { step: "adjust"; paymentRef: string })
  | (RefundWriteBase & { step: "observe-return" })
  | (RefundWriteBase & { step: "refund"; paymentRef: string });

export type RefundTupleChanged = { kind: "tuple-changed"; field: string; expected: string; actual: string };

export type RefundRefused = {
  kind: "refused";
  code: RefundRefusalCode;
  field: string;
  ref: string | null;
  detail: string;
};

export type RefundReadOutcome =
  | { kind: "ready"; snapshot: RefundSnapshot }
  | { kind: "empty"; watermark: string; generation: number; snapshotId: number }
  | { kind: "stale"; watermark: string; floor: string }
  | RefundRefused
  | RefundTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export type RefundWriteOutcome =
  | {
      kind: "confirmed";
      step: RefundStep;
      intentRef: string;
      contextKey: string;
      refs: RefundReceiptRefs;
      nonClaims: RefundNonClaims;
    }
  | {
      kind: "rejected";
      step: RefundStep;
      intentRef: string;
      contextKey: string;
      code: RefundRejectCode;
      detail: string;
    }
  | { kind: "unknown"; step: RefundStep; intentRef: string; contextKey: string; message: string }
  | { kind: "invalid-request"; step: string; intentRef: string; contextKey: string; code: RefundInvalidCode; detail: string }
  | (RefundTupleChanged & { step: string; intentRef: string; contextKey: string })
  | { kind: "not-bound"; reason: string };

/** A source event: the venue marks the order's right as due back. A real producer offers no such call. */
export interface RefundReturnEvent {
  orderRef: string;
}

/**
 * A result that reaches the client after the client had already treated the write as
 * unknown. A late delivery is evidence. It does not make the write known.
 */
export interface RefundLateDelivery {
  intentRef: string;
  contextKey: string;
  step: RefundStep;
  result: "confirmed" | "rejected";
  code: RefundRejectCode | null;
}

export interface RefundReturnPort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic-refund" | "none";
  readonly scenario: RefundScenario;
  read(request: RefundReadRequest): Promise<RefundReadOutcome>;
  submit(request: RefundWriteRequest): Promise<RefundWriteOutcome>;
  /** Synthetic control: the venue marks the right on this order as due back. A real producer offers no such call. */
  markReturnRequired(orderRef: string): RefundReturnEvent | null;
  /** Synthetic control: releases responses the held-response scenario is holding. Returns how many. */
  deliverHeld(): number;
  /** Synthetic control: takes the late results that are due. A real producer offers no such call. */
  deliverLate(): readonly RefundLateDelivery[];
}

export interface StubRefundReturnOptions {
  scenario?: RefundScenario;
  /** In a lost scenario, whether the late result confirmed or rejected. Default confirmed. */
  lateResult?: "confirmed" | "rejected";
  /** Expected tuple override. Used to stage a producer change in tests. */
  expectedTuple?: DiscoveryReadTuple;
}

export interface RefundEffectCounts {
  /** submit calls that reached the source, whatever they returned. */
  submits: number;
  cancels: number;
  voids: number;
  adjusts: number;
  returnMarks: number;
  returnObservations: number;
  refunds: number;
}

export function createStubRefundReturn(options: StubRefundReturnOptions = {}): StubRefundReturn {
  return new StubRefundReturn(options);
}

export function createNotBoundRefundReturn(): RefundReturnPort {
  const outcome = { kind: "not-bound", reason: REFUND_RETURN_NOT_BOUND_REASON } as const;
  return {
    environment: "integration-http",
    source: "none",
    scenario: "clean",
    read() {
      return Promise.resolve({ ...outcome });
    },
    submit() {
      return Promise.resolve({ ...outcome });
    },
    markReturnRequired() {
      return null;
    },
    deliverHeld() {
      return 0;
    },
    deliverLate() {
      return [];
    },
  };
}

export function refundReturnPortFor(
  environment: "stub" | "integration-http",
  options: StubRefundReturnOptions = {},
): RefundReturnPort {
  if (environment === "stub") {
    return createStubRefundReturn(options);
  }
  return createNotBoundRefundReturn();
}

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

interface CaseRecord {
  orderRef: string;
  version: number;
  reservation: (typeof REFUND_RESERVATION_STATES)[number];
  reservationRef: string | null;
  payment: (typeof REFUND_PAYMENT_STATES)[number];
  paymentRef: string | null;
  issuance: (typeof REFUND_ISSUANCE_STATES)[number];
  issuanceRef: string | null;
  rightRef: string | null;
  returnState: (typeof REFUND_RETURN_STATES)[number];
  returnRef: string | null;
  cancelRef: string | null;
  voidRef: string | null;
  adjustRef: string | null;
  refundRef: string | null;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function claimRefusal(field: string, ref: string | null): RefundRefused {
  return {
    kind: "refused",
    code: "CLAIM",
    field,
    ref,
    detail: `The payload does not state ${field} as false. A synthetic row is never a real payment, a funds movement, an executed refund, an executed void, an integration, or a production environment.`,
  };
}

function invalidNonClaims(nonClaims: RefundNonClaims): string | null {
  for (const field of REFUND_NON_CLAIM_FIELDS) {
    if (nonClaims[field] !== false) {
      return field;
    }
  }
  return null;
}

const CELL_STATES: Readonly<Record<RefundCell, readonly string[]>> = {
  reservation: REFUND_RESERVATION_STATES,
  payment: REFUND_PAYMENT_STATES,
  issuance: REFUND_ISSUANCE_STATES,
  returnRequired: REFUND_RETURN_STATES,
  refundDone: REFUND_REFUND_STATES,
};

/**
 * Whole-payload validation before a row is shown. A malformed reference, a
 * wrong-kind reference, an unknown cell or line state, a recorded line that
 * claims a send or an execution, a refund record without a payment
 * observation, or a false non-claim that is not the literal false refuses the
 * whole payload.
 */
export function refuseRefundSnapshot(snapshot: RefundSnapshot): RefundRefused | null {
  const claim = invalidNonClaims(snapshot.nonClaims);
  if (claim !== null) {
    return claimRefusal(claim, null);
  }
  const order = snapshot.order;
  if (!isRefundRef(order.orderRef, "order")) {
    return { kind: "refused", code: "IDENTITY", field: "orderRef", ref: String(order.orderRef), detail: "A case carries an order reference." };
  }
  if (!Number.isInteger(order.version) || order.version < 0) {
    return { kind: "refused", code: "IDENTITY", field: "version", ref: order.orderRef, detail: "An order version is a whole number." };
  }
  const cellRefs: readonly [RefundCell, RefundRefKind][] = [
    ["reservation", "reservation"],
    ["payment", "payment"],
    ["issuance", "issuance"],
    ["returnRequired", "return"],
    ["refundDone", "refund"],
  ];
  for (const [cell, kind] of cellRefs) {
    const view = order.cells[cell];
    if (!(CELL_STATES[cell] as readonly string[]).includes(view.state)) {
      return { kind: "refused", code: "IDENTITY", field: `${cell}.state`, ref: order.orderRef, detail: `Cell ${cell} carries an unknown state.` };
    }
    if (view.ref !== null && !isRefundRef(view.ref, kind)) {
      return { kind: "refused", code: "IDENTITY", field: `${cell}.ref`, ref: order.orderRef, detail: `Cell ${cell} carries a ${kind} reference or none.` };
    }
  }
  for (const line of REFUND_FLOW_LINES) {
    const view = order.lines[line];
    if (view.state !== "none" && view.state !== "recorded") {
      return { kind: "refused", code: "IDENTITY", field: `${line}.state`, ref: order.orderRef, detail: `Line ${line} carries an unknown state.` };
    }
    if (view.sent !== false || view.executed !== false) {
      return claimRefusal(`${line}.executed`, order.orderRef);
    }
    if (view.state === "recorded") {
      const kind = line === "pgAdjust" ? "adjust" : line === "returnObservation" ? "return" : line;
      if (!isRefundRef(view.ref, kind as RefundRefKind)) {
        return { kind: "refused", code: "IDENTITY", field: `${line}.ref`, ref: order.orderRef, detail: `A recorded ${line} line carries its own reference.` };
      }
    }
  }
  if (order.cells.refundDone.state === "recorded" && order.cells.payment.state !== "observed") {
    return { kind: "refused", code: "IDENTITY", field: "refundDone", ref: order.orderRef, detail: "A refund record without a payment observation is refused whole." };
  }
  if (order.cells.returnRequired.state === "observed" && order.lines.returnObservation.state !== "recorded") {
    return { kind: "refused", code: "IDENTITY", field: "returnRequired", ref: order.orderRef, detail: "An observed return without a return-observation line is refused whole." };
  }
  return null;
}

/**
 * Receipt validation. A confirmed receipt that does not state every non-claim
 * as literal false is untrusted, and the caller treats the write as unknown.
 */
export function refuseRefundReceipt(nonClaims: RefundNonClaims): RefundRefused | null {
  const claim = invalidNonClaims(nonClaims);
  if (claim !== null) {
    return claimRefusal(claim, null);
  }
  return null;
}

/** Synthetic source. State lives in this object, so a new port is a new session. */
export class StubRefundReturn implements RefundReturnPort {
  readonly environment = "stub" as const;
  readonly source = "synthetic-refund" as const;
  readonly scenario: RefundScenario;
  private readonly lateResult: "confirmed" | "rejected";
  private readonly expectedTuple: DiscoveryReadTuple;
  private readonly cases = new Map<string, CaseRecord>();
  private readonly held: { release: () => void }[] = [];
  private late: RefundLateDelivery[] = [];
  private generation = 1;
  private snapshotSerial = 0;
  private readonly serials: Record<Exclude<RefundRefKind, "order">, number> = {
    reservation: 1,
    payment: 1,
    issuance: 1,
    right: 1,
    cancel: 1,
    void: 1,
    adjust: 1,
    return: 1,
    refund: 1,
  };
  private readonly counts: RefundEffectCounts = {
    submits: 0,
    cancels: 0,
    voids: 0,
    adjusts: 0,
    returnMarks: 0,
    returnObservations: 0,
    refunds: 0,
  };

  constructor(options: StubRefundReturnOptions) {
    this.scenario = options.scenario ?? "clean";
    this.lateResult = options.lateResult ?? "confirmed";
    this.expectedTuple = options.expectedTuple ?? DISCOVERY_READ_TUPLE_LITERALS;
  }

  /** Test seam. Counts of what reached the source. Not part of the port. */
  effects(): RefundEffectCounts {
    return { ...this.counts };
  }

  read(request: RefundReadRequest): Promise<RefundReadOutcome> {
    return Promise.resolve(this.readNow(request));
  }

  markReturnRequired(orderRef: string): RefundReturnEvent | null {
    const record = this.cases.get(orderRef);
    if (!record || record.payment !== "observed" || record.returnState !== "none") {
      return null;
    }
    record.returnState = "required";
    record.version += 1;
    this.counts.returnMarks += 1;
    this.generation += 1;
    return { orderRef };
  }

  deliverHeld(): number {
    const releasing = this.held.splice(0, this.held.length);
    for (const entry of releasing) {
      entry.release();
    }
    return releasing.length;
  }

  deliverLate(): readonly RefundLateDelivery[] {
    const due = this.late;
    this.late = [];
    return due;
  }

  submit(request: RefundWriteRequest): Promise<RefundWriteOutcome> {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return Promise.resolve({
        kind: "tuple-changed",
        field: tuple.field,
        expected: tuple.expected,
        actual: tuple.actual,
        step: String(request.step),
        intentRef: request.intentRef,
        contextKey: request.contextKey,
      });
    }
    const invalid = this.validate(request);
    if (invalid !== null) {
      return Promise.resolve(invalid);
    }
    this.counts.submits += 1;
    const outcome = this.apply(request);
    if (this.scenario === "held-response") {
      return new Promise<RefundWriteOutcome>((resolve) => {
        this.held.push({ release: () => resolve(outcome) });
      });
    }
    return Promise.resolve(outcome);
  }

  private next(kind: Exclude<RefundRefKind, "order">): string {
    const ref = refundRef(kind, this.serials[kind]);
    this.serials[kind] += 1;
    return ref;
  }

  private seed(orderRef: string): CaseRecord {
    const record: CaseRecord = {
      orderRef,
      version: 1,
      reservation: "held",
      reservationRef: this.next("reservation"),
      payment: "none",
      paymentRef: null,
      issuance: "none",
      issuanceRef: null,
      rightRef: null,
      returnState: "none",
      returnRef: null,
      cancelRef: null,
      voidRef: null,
      adjustRef: null,
      refundRef: null,
    };
    if (this.scenario !== "held-only") {
      record.reservation = "confirmed";
      record.payment = "observed";
      record.paymentRef = this.next("payment");
      record.version += 2;
    }
    if (this.scenario !== "held-only" && this.scenario !== "unissued") {
      record.issuance = "issued";
      record.issuanceRef = this.next("issuance");
      record.rightRef = this.next("right");
      record.version += 1;
    }
    if (this.scenario === "returned") {
      record.returnState = "observed";
      record.returnRef = this.next("return");
      record.version += 1;
    }
    if (this.scenario === "refund-recorded") {
      record.returnState = "required";
      record.refundRef = this.next("refund");
      record.version += 2;
    }
    return record;
  }

  private readNow(request: RefundReadRequest): RefundReadOutcome {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return { kind: "tuple-changed", field: tuple.field, expected: tuple.expected, actual: tuple.actual };
    }
    if (!isRefundRef(request.orderRef, "order")) {
      return {
        kind: "refused",
        code: "IDENTITY",
        field: "orderRef",
        ref: String(request.orderRef),
        detail: "A read names an order reference (ord_<label>).",
      };
    }
    this.snapshotSerial += 1;
    const watermark = this.scenario === "stale" ? REFUND_RETURN_STALE_WATERMARK : REFUND_RETURN_AS_OF;
    const floor = request.watermarkFloor ?? (this.scenario === "stale" ? REFUND_RETURN_STALE_FLOOR : null);
    if (floor !== null && Date.parse(watermark) < Date.parse(floor)) {
      return { kind: "stale", watermark, floor };
    }
    if (this.scenario === "empty") {
      return { kind: "empty", watermark, generation: this.generation, snapshotId: this.snapshotSerial };
    }
    let record = this.cases.get(request.orderRef);
    if (!record) {
      record = this.seed(request.orderRef);
      this.cases.set(request.orderRef, record);
    }
    const snapshot: RefundSnapshot = {
      snapshotId: this.snapshotSerial,
      generation: this.generation,
      watermark,
      scenario: this.scenario,
      order: this.caseView(record),
      nonClaims:
        this.scenario === "claims-real"
          ? ({ ...REFUND_NON_CLAIMS, realPayment: true } as unknown as RefundNonClaims)
          : { ...REFUND_NON_CLAIMS },
    };
    const refused = refuseRefundSnapshot(snapshot);
    if (refused !== null) {
      return refused;
    }
    return { kind: "ready", snapshot };
  }

  private invalid(
    request: { step: unknown; intentRef: unknown; contextKey: unknown },
    code: RefundInvalidCode,
    detail: string,
  ): RefundWriteOutcome {
    return {
      kind: "invalid-request",
      step: String(request.step),
      intentRef: String(request.intentRef),
      contextKey: String(request.contextKey),
      code,
      detail,
    };
  }

  private validate(request: RefundWriteRequest): RefundWriteOutcome | null {
    if (!nonEmpty(request.intentRef) || !nonEmpty(request.contextKey)) {
      return this.invalid(request, "INTENT", "A write carries an intent reference and a context key.");
    }
    if (!(REFUND_STEPS as readonly string[]).includes(request.step)) {
      return this.invalid(request, "STEP", `Step ${String(request.step)} is not a refund-desk step.`);
    }
    if (!isRefundRef(request.orderRef, "order")) {
      return this.invalid(request, "IDENTITY", `A ${request.step} names an order reference.`);
    }
    if ((request.step === "adjust" || request.step === "refund") && !isRefundRef(request.paymentRef, "payment")) {
      return this.invalid(request, "IDENTITY", `A ${request.step} names the payment observation it links.`);
    }
    if (!Number.isInteger(request.expectedVersion)) {
      return this.invalid(request, "VERSION", "The expected order version is a whole number.");
    }
    return null;
  }

  private rejected(request: RefundWriteRequest, code: RefundRejectCode, detail: string): RefundWriteOutcome {
    return { kind: "rejected", step: request.step, intentRef: request.intentRef, contextKey: request.contextKey, code, detail };
  }

  private lost(request: RefundWriteRequest, message: string): RefundWriteOutcome {
    return { kind: "unknown", step: request.step, intentRef: request.intentRef, contextKey: request.contextKey, message };
  }

  private apply(request: RefundWriteRequest): RefundWriteOutcome {
    const record = this.cases.get(request.orderRef);
    if (!record) {
      return this.rejected(request, "UNKNOWN_REF", `Order ${request.orderRef} is not at the source.`);
    }
    if (record.version !== request.expectedVersion) {
      return this.rejected(request, "VERSION_STALE", `Order ${record.orderRef} is no longer at version ${request.expectedVersion}. Read again.`);
    }
    switch (request.step) {
      case "cancel":
        return this.applyCancel(request, record);
      case "void":
        return this.applyVoid(request, record);
      case "adjust":
        return this.applyAdjust(request, record);
      case "observe-return":
        return this.applyObserveReturn(request, record);
      case "refund":
        return this.applyRefund(request, record);
      default: {
        const exhaustive: never = request;
        return exhaustive;
      }
    }
  }

  private nonClaims(): RefundNonClaims {
    return this.scenario === "claims-real" || this.scenario === "receipt-claims"
      ? ({ ...REFUND_NON_CLAIMS, realPayment: true } as unknown as RefundNonClaims)
      : { ...REFUND_NON_CLAIMS };
  }

  private confirmed(request: RefundWriteRequest, record: CaseRecord): RefundWriteOutcome {
    return {
      kind: "confirmed",
      step: request.step,
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      refs: {
        orderRef: record.orderRef,
        reservationRef: record.reservationRef,
        paymentRef: record.paymentRef,
        issuanceRef: record.issuanceRef,
        rightRef: record.rightRef,
        returnRef: record.returnRef,
        cancelRef: record.cancelRef,
        voidRef: record.voidRef,
        adjustRef: record.adjustRef,
        refundRef: record.refundRef,
        orderVersion: record.version,
      },
      nonClaims: this.nonClaims(),
    };
  }

  private applyCancel(request: RefundWriteRequest & { step: "cancel" }, record: CaseRecord): RefundWriteOutcome {
    if (record.reservation === "cancelled") {
      return this.rejected(request, "ALREADY_CANCELLED", `Order ${record.orderRef} already has a cancel record.`);
    }
    if (record.payment === "observed") {
      return this.rejected(
        request,
        "CANCEL_AFTER_PAYMENT",
        `Order ${record.orderRef} has a payment observation. A cancel is not the refund path: the refund line is a separate record.`,
      );
    }
    record.reservation = "cancelled";
    record.cancelRef = this.next("cancel");
    record.version += 1;
    this.counts.cancels += 1;
    this.generation += 1;
    return this.confirmed(request, record);
  }

  private applyVoid(request: RefundWriteRequest & { step: "void" }, record: CaseRecord): RefundWriteOutcome {
    if (record.voidRef !== null) {
      return this.rejected(request, "ALREADY_RECORDED", `Order ${record.orderRef} already has a void record.`);
    }
    if (record.payment !== "observed" || record.paymentRef === null) {
      return this.rejected(request, "PAYMENT_NOT_OBSERVED", `Order ${record.orderRef} has no recorded payment observation. Nothing is voided.`);
    }
    if (record.issuance === "issued") {
      return this.rejected(request, "VOID_UNAVAILABLE", `Order ${record.orderRef} already has an issuance record. void_unissued voids an unissued right; nothing is voided here.`);
    }
    record.voidRef = this.next("void");
    record.version += 1;
    this.counts.voids += 1;
    this.generation += 1;
    return this.confirmed(request, record);
  }

  private applyAdjust(request: RefundWriteRequest & { step: "adjust" }, record: CaseRecord): RefundWriteOutcome {
    if (record.adjustRef !== null) {
      return this.rejected(request, "ALREADY_RECORDED", `Order ${record.orderRef} already has a PG-cancel adjustment record.`);
    }
    if (record.payment !== "observed" || record.paymentRef !== request.paymentRef) {
      return this.rejected(
        request,
        record.payment === "observed" ? "IDENTITY_MISMATCH" : "PAYMENT_NOT_OBSERVED",
        `Order ${record.orderRef} has no recorded payment observation ${request.paymentRef}. Nothing is adjusted.`,
      );
    }
    record.adjustRef = this.next("adjust");
    record.version += 1;
    this.counts.adjusts += 1;
    this.generation += 1;
    return this.confirmed(request, record);
  }

  private applyObserveReturn(request: RefundWriteRequest & { step: "observe-return" }, record: CaseRecord): RefundWriteOutcome {
    if (record.returnState === "observed") {
      return this.rejected(request, "ALREADY_OBSERVED", `Order ${record.orderRef} already has a return observation.`);
    }
    if (record.returnState !== "required") {
      return this.rejected(
        request,
        "RETURN_NOT_REQUIRED",
        `Order ${record.orderRef} has no return required at the source. A return observation does not mark one required.`,
      );
    }
    record.returnState = "observed";
    record.returnRef = this.next("return");
    record.version += 1;
    this.counts.returnObservations += 1;
    this.generation += 1;
    return this.confirmed(request, record);
  }

  private applyRefund(request: RefundWriteRequest & { step: "refund" }, record: CaseRecord): RefundWriteOutcome {
    if (record.refundRef !== null) {
      return this.rejected(request, "ALREADY_REFUNDED", `Order ${record.orderRef} already has a refund record.`);
    }
    if (record.payment !== "observed" || record.paymentRef !== request.paymentRef) {
      return this.rejected(
        request,
        record.payment === "observed" ? "IDENTITY_MISMATCH" : "REFUND_UNAVAILABLE",
        `Order ${record.orderRef} has no recorded payment observation ${request.paymentRef}. Nothing is refunded and nothing is queued.`,
      );
    }
    record.refundRef = this.next("refund");
    record.version += 1;
    this.counts.refunds += 1;
    this.generation += 1;
    if (this.scenario === "refund-lost") {
      if (this.lateResult === "rejected") {
        this.late.push({ intentRef: request.intentRef, contextKey: request.contextKey, step: "refund", result: "rejected", code: "REFUND_UNAVAILABLE" });
      } else {
        this.late.push({ intentRef: request.intentRef, contextKey: request.contextKey, step: "refund", result: "confirmed", code: null });
      }
      return this.lost(request, "The response to the refund record never arrived. The source may have recorded it.");
    }
    return this.confirmed(request, record);
  }

  private cellNote(cell: RefundCell, record: CaseRecord): string {
    switch (cell) {
      case "reservation":
        return record.reservation === "cancelled"
          ? "A cancel record is on this order. The reservation cell is cancelled, not refunded."
          : record.reservation === "confirmed"
            ? "A reservation is confirmed on the synthetic source. It is not a payment."
            : "A reservation is held on the synthetic source. It is not a payment.";
      case "payment":
        return record.payment === "observed"
          ? "A payment observation is recorded. It is a synthetic observation, not a real payment."
          : record.payment === "declined"
            ? "The payment was declined at the source."
            : "No payment observation is recorded. A reservation is not a payment.";
      case "issuance":
        return record.issuance === "issued"
          ? "An issuance record and a right reference are recorded. They are synthetic rows, not a real right."
          : "No issuance is recorded.";
      case "returnRequired":
        return record.returnState === "required"
          ? "The source marks the right as due back. Return-required is its own state, not a step before a refund."
          : record.returnState === "observed"
            ? "A return observation is recorded. It observes a return; it is not a refund."
            : "No return is required at the source.";
      case "refundDone":
        return record.refundRef !== null
          ? "A refund record is recorded on the synthetic source. It executes nothing and returns no funds."
          : "No refund record. refund_ticket is pinned and never sent.";
    }
  }

  private lineNote(line: RefundFlowLine, record: CaseRecord): string {
    const action = REFUND_LINE_ACTIONS[line];
    const bound = action === null ? "The catalogue has no booking-cancel command." : `${action} is pinned and never sent.`;
    const empty: Readonly<Record<RefundFlowLine, string>> = {
      cancel: "No cancel record. A synthetic cancel request lands on this line only.",
      void: "No void record. A synthetic void lands on this line only while a payment is observed and no issuance is recorded.",
      pgAdjust: "No PG-cancel adjustment record. A synthetic adjustment lands on this line only.",
      returnObservation: "No return observation. Recording one does not mark a return required and does not record a refund.",
      refund: "No refund record. Recording one executes nothing and clears no other line.",
    };
    if (line === "cancel" && record.reservation !== "cancelled") {
      return `${empty.cancel} ${bound}`;
    }
    const ref = line === "cancel" ? record.cancelRef : line === "void" ? record.voidRef : line === "pgAdjust" ? record.adjustRef : line === "returnObservation" ? record.returnRef : record.refundRef;
    if (ref === null) {
      return `${empty[line]} ${bound}`;
    }
    return `A synthetic ${line} record is on this order. It sent nothing and executes nothing. ${bound}`;
  }

  private caseView(record: CaseRecord): RefundCaseView {
    const cell = (cellName: RefundCell, state: string, ref: string | null): RefundCellView => ({
      state,
      ref,
      note: this.cellNote(cellName, record),
    });
    const line = (lineName: RefundFlowLine, ref: string | null): RefundLineView => ({
      state: ref === null ? "none" : "recorded",
      ref,
      sent: false,
      executed: false,
      note: this.lineNote(lineName, record),
    });
    return {
      orderRef: record.orderRef,
      version: record.version,
      cells: {
        reservation: cell("reservation", record.reservation, record.reservationRef),
        payment: cell("payment", record.payment, record.paymentRef),
        issuance: cell("issuance", record.issuance, record.issuanceRef),
        returnRequired: cell("returnRequired", record.returnState, record.returnState === "observed" ? record.returnRef : null),
        refundDone: cell("refundDone", record.refundRef !== null ? "recorded" : "none", record.refundRef),
      },
      lines: {
        cancel: line("cancel", record.cancelRef),
        void: line("void", record.voidRef),
        pgAdjust: line("pgAdjust", record.adjustRef),
        returnObservation: line("returnObservation", record.returnRef),
        refund: line("refund", record.refundRef),
      },
    };
  }
}
