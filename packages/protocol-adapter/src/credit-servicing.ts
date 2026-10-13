import {
  DISCOVERY_PROJECTION_AS_OF,
  DISCOVERY_READ_TENANT,
  DISCOVERY_READ_TUPLE_LITERALS,
  checkDiscoveryReadTuple,
  type DiscoveryReadTuple,
} from "./discovery-read.js";
import { PLATFORM_HOLD_NOT_BOUND, PLATFORM_NOT_COMPOSED } from "./platform-journey.js";

/**
 * Synthetic credit servicing source for the servicing and operations desk.
 *
 * This is the stub-scope stand-in for a producer. The real connection stays pending
 * on kix-protocol:cr-08-producer-sdk and on the unpromoted c-async-session-fence,
 * c-finance-projection, and c-journey-identity. The contract-only catalogue has no
 * credit command and no read command for a draw instruction, a disbursement
 * observation, a reservation, an exposure, a repayment schedule, a payment
 * allocation, a reversal, an adjustment, or a servicing case. No producer tuple
 * exists, so the desk is NOT_BOUND on integration-http. No SDK, manifest, or vector
 * is consumed, and this module sends nothing over a network.
 *
 * Nothing here composes a catalogue command: no money posting is sent, and the
 * not-composed record below only quotes why.
 *
 * Rules, all enforced here and not only in copy:
 *  - Four servicing facts stay four facts: the draw instruction, the disbursement
 *    observation, the reservation, and the exposure. An instruction is not an
 *    observation, an observation is not moved funds, a reservation is not an
 *    exposure, and an open exposure is not proof anything was paid or disbursed.
 *    An unknown observation stays unknown.
 *  - A partial repayment never restores the commitment limit. The limit line is
 *    the source's own state, and the source states it.
 *  - A charge-off or a recovery-case closure is a bookkeeping state, not the debt
 *    ending. A payment observed after the case closed stays a fact of its own and
 *    keeps the closure honest; it reopens nothing by itself.
 *  - Propose and approve are separate capabilities. A proposal is not an
 *    application of itself, and an actor may not approve its own proposal.
 *  - A reversal removes the allocation's effect and keeps both events. It erases
 *    nothing from the timeline.
 *  - Every figure is the source's own text, or UNDETERMINED when the source sent
 *    none. Nothing in this module parses, adds, scales, or compares an amount, so
 *    no client allocation, remainder, or exposure figure exists.
 *  - No contact, no collection action, no disbursement, and no payment is ever
 *    performed here. The source states each of those as the literal false, and a
 *    payload that says anything else is refused whole.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const SERVICING_RULING = "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const SERVICING_NOT_BOUND_REASON =
  "No current producer tuple exists for credit servicing: kix-protocol:cr-08-producer-sdk is not merged, and c-async-session-fence, c-finance-projection, and c-journey-identity are not promoted. The contract-only catalogue has no credit command and no read command for a draw instruction, a payment observation, a reservation, an exposure, a repayment schedule, an allocation, a reversal, an adjustment, or a servicing case. The servicing desk stays NOT_BOUND on integration-http.";

export const SERVICING_PROJECTION_NAME = "kix.credit.servicing";

/** What a producer connection would need. All of it is absent, so every connection claim is false. */
export const SERVICING_PRODUCER_TUPLE = {
  bound: false,
  status: "NOT_BOUND",
  sdkDigest: null,
  manifestDigest: null,
  vectorDigest: null,
  waitingOn: ["kix-protocol:cr-08-producer-sdk", "c-async-session-fence", "c-finance-projection", "c-journey-identity"],
} as const;

/** Fixed instant the synthetic source claims to be built at. */
export const SERVICING_AS_OF = DISCOVERY_PROJECTION_AS_OF;

/** Watermark the stale scenario serves, and the floor a reader holds against it. */
export const SERVICING_STALE_WATERMARK = "2026-10-10T00:00:00.000Z";
export const SERVICING_STALE_FLOOR = "2026-10-12T00:00:00.000Z";

export const SERVICING_TENANT = DISCOVERY_READ_TENANT;

/** The obligation the desk actors hold a synthetic grant for, and one they do not. */
export const SERVICING_OWN_REF = "obl-0001";
export const SERVICING_FOREIGN_REF = "obl-0002";

/** The three desk actors. Each string is a context label, not an authentication result. */
export const SERVICING_DESK_ACTOR = "credit-servicing-desk";
export const SERVICING_APPROVER_ACTOR = "credit-servicing-approver";
export const SERVICING_VIEWER_ACTOR = "credit-servicing-viewer";
export const SERVICING_ACTORS = [SERVICING_DESK_ACTOR, SERVICING_APPROVER_ACTOR, SERVICING_VIEWER_ACTOR] as const;
export type ServicingActor = (typeof SERVICING_ACTORS)[number];

/** The capabilities an actor can hold. Read, propose, and approve stay separate. */
export const SERVICING_CAPABILITIES = ["read", "propose", "approve"] as const;
export type ServicingCapability = (typeof SERVICING_CAPABILITIES)[number];

const ACTOR_CAPABILITIES: Readonly<Record<string, readonly ServicingCapability[]>> = {
  [SERVICING_DESK_ACTOR]: ["read", "propose"],
  [SERVICING_APPROVER_ACTOR]: ["read", "approve"],
  [SERVICING_VIEWER_ACTOR]: ["read"],
};

/** The capabilities the source grants an actor string. An unlisted actor holds none. */
export function servicingCapabilities(actorRef: string): readonly ServicingCapability[] {
  return ACTOR_CAPABILITIES[actorRef] ?? [];
}

/** Amounts are labelled with this unit. It is a mock unit, not a currency. */
export const SERVICING_UNIT = "mock-unit";

/** The label the source puts where a figure is not decided. */
export const SERVICING_UNDETERMINED = "UNDETERMINED";

/** The label a closed case carries for the debt. A closure is never an extinguishment. */
export const SERVICING_DEBT_LABEL = "not-extinguished";

/** Quote of the locked hold binding. H1 keeps this consideredAction and keeps it not-bound. */
export const SERVICING_HOLD_NOT_BOUND = PLATFORM_HOLD_NOT_BOUND;

/** Catalogue commands this module records and does not send. Nothing is composed here at all. */
export const SERVICING_NOT_COMPOSED = PLATFORM_NOT_COMPOSED;

export const SERVICING_LANES = ["draw", "reservation", "exposure", "schedule", "payment", "case", "proposal"] as const;
export type ServicingLane = (typeof SERVICING_LANES)[number];

export const SERVICING_INSTRUCTION_STATES = ["none", "recorded"] as const;
export type ServicingInstructionState = (typeof SERVICING_INSTRUCTION_STATES)[number];

export const SERVICING_OBSERVATION_STATES = ["not-observed", "observed", "unknown", "disputed"] as const;
export type ServicingObservationState = (typeof SERVICING_OBSERVATION_STATES)[number];

export const SERVICING_RESERVATION_STATES = ["held", "released", "unknown"] as const;
export type ServicingReservationState = (typeof SERVICING_RESERVATION_STATES)[number];

export const SERVICING_EXPOSURE_STATES = ["open", "closed", "unknown"] as const;
export type ServicingExposureState = (typeof SERVICING_EXPOSURE_STATES)[number];

export const SERVICING_LIMIT_STATES = ["held", "released", "unknown"] as const;
export type ServicingLimitState = (typeof SERVICING_LIMIT_STATES)[number];

export const SERVICING_INSTALLMENT_STATES = ["scheduled", "due", "overdue", "satisfied", "adjusted", "charged-off"] as const;
export type ServicingInstallmentState = (typeof SERVICING_INSTALLMENT_STATES)[number];

export const SERVICING_PAYMENT_STATES = ["unallocated", "partial", "allocated", "late-unallocated", "reversed"] as const;
export type ServicingPaymentState = (typeof SERVICING_PAYMENT_STATES)[number];

/** When the source observed the payment relative to the schedule and the case. */
export const SERVICING_PAYMENT_TIMINGS = ["scheduled-window", "late", "post-charge-off"] as const;
export type ServicingPaymentTiming = (typeof SERVICING_PAYMENT_TIMINGS)[number];

export const SERVICING_ALLOCATION_STATES = ["applied", "reversed"] as const;
export type ServicingAllocationState = (typeof SERVICING_ALLOCATION_STATES)[number];

export const SERVICING_ADJUSTMENT_KINDS = ["due-label", "note", "amount-label"] as const;
export type ServicingAdjustmentKind = (typeof SERVICING_ADJUSTMENT_KINDS)[number];

export const SERVICING_ADJUSTMENT_STATES = ["proposed", "applied", "rejected"] as const;
export type ServicingAdjustmentState = (typeof SERVICING_ADJUSTMENT_STATES)[number];

export const SERVICING_PROPOSAL_KINDS = ["allocation", "adjustment", "case-transition"] as const;
export type ServicingProposalKind = (typeof SERVICING_PROPOSAL_KINDS)[number];

export const SERVICING_PROPOSAL_STATES = ["pending", "applied", "rejected"] as const;
export type ServicingProposalState = (typeof SERVICING_PROPOSAL_STATES)[number];

export const SERVICING_CASE_STATUSES = ["monitoring", "delinquent", "recovery", "closed"] as const;
export type ServicingCaseStatus = (typeof SERVICING_CASE_STATUSES)[number];

export const SERVICING_CLOSURE_KINDS = ["charged-off", "recovered"] as const;
export type ServicingClosureKind = (typeof SERVICING_CLOSURE_KINDS)[number];

/** The case transitions a proposal may name. The source decides which are offered. */
export const SERVICING_CASE_TRANSITIONS = ["to-recovery", "to-charge-off", "to-closed"] as const;
export type ServicingCaseTransition = (typeof SERVICING_CASE_TRANSITIONS)[number];

export const SERVICING_EVENT_KINDS = [
  "instruction",
  "observation",
  "reservation",
  "payment",
  "allocation",
  "reversal",
  "adjustment",
  "proposal",
  "approval",
  "case",
] as const;
export type ServicingEventKind = (typeof SERVICING_EVENT_KINDS)[number];

export const SERVICING_REASON_LANES = ["payment", "schedule", "case", "draw", "exposure"] as const;
export type ServicingReasonLane = (typeof SERVICING_REASON_LANES)[number];

/** The proposal path a reason names. The page offers only the paths the source names. */
export const SERVICING_REMEDIES = ["propose-allocation", "propose-adjustment", "propose-case-transition", "none"] as const;
export type ServicingRemedy = (typeof SERVICING_REMEDIES)[number];

export const SERVICING_CUT_SOURCES = ["obligation-ledger", "payment-ledger"] as const;
export type ServicingCutSource = (typeof SERVICING_CUT_SOURCES)[number];

export const SERVICING_ACTION_KINDS = [
  "propose-allocation",
  "propose-adjustment",
  "propose-case-transition",
  "approve-proposal",
] as const;
export type ServicingActionKind = (typeof SERVICING_ACTION_KINDS)[number];

/**
 * Eight things the source must state as the literal false. Silence is not a no.
 * They cover every completion this desk could be misread as performing: a
 * disbursement, a limit restoration, an erased history, an extinguished debt, a
 * contact, and a collection action.
 */
export const SERVICING_NON_CLAIM_FIELDS = [
  "instructionIsDisbursement",
  "observationIsConfirmedFunds",
  "partialRepaymentRestoresLimit",
  "reversalErasesHistory",
  "caseClosureIsDebtExtinguished",
  "contactMade",
  "collectionExecuted",
  "disbursed",
] as const;
export type ServicingNonClaimField = (typeof SERVICING_NON_CLAIM_FIELDS)[number];

export type ServicingNonClaims = Readonly<Record<ServicingNonClaimField, false>>;

/** Controls that move the synthetic source. A real producer offers none of them. */
export const SERVICING_SYNTHETIC_CONTROLS = [
  "observe-draw",
  "receive-payment",
  "reverse-allocation",
  "mark-overdue",
  "advance-schedule",
  "revoke-grant",
] as const;
export type ServicingSyntheticControl = (typeof SERVICING_SYNTHETIC_CONTROLS)[number];

export const SERVICING_SCENARIOS = [
  "clean",
  "empty",
  "stale",
  "draw-unknown",
  "partial-repayment",
  "unallocated",
  "reversal",
  "delinquent",
  "charged-off",
  "post-charge-off-payment",
  "proposal-pending",
  "stale-schedule",
  "adjustment-applied",
  "mixed-cut",
  "dangling-link",
  "claims-restored",
  "claims-extinguished",
  "claims-contact",
  "scope-leak",
  "denied",
  "read-lost",
  "act-lost",
  "approve-claims-closure",
  "self-approval",
] as const;
export type ServicingScenario = (typeof SERVICING_SCENARIOS)[number];

export const SERVICING_DENIED_CODES = ["SCOPE_DENIED", "GRANT_REVOKED"] as const;
export type ServicingDeniedCode = (typeof SERVICING_DENIED_CODES)[number];

export const SERVICING_REFUSAL_CODES = ["CLAIM", "AMOUNT", "UNIT", "KIND", "STATE", "REF", "CUT", "SCOPE_LEAK"] as const;
export type ServicingRefusalCode = (typeof SERVICING_REFUSAL_CODES)[number];

export const SERVICING_INVALID_CODES = ["CONTEXT", "ACTOR", "SCOPE", "FLOOR", "ACTION", "REF", "TEXT"] as const;
export type ServicingInvalidCode = (typeof SERVICING_INVALID_CODES)[number];

/** Why the source said no to a request it understood. These are business answers, not transport faults. */
export const SERVICING_REJECTION_CODES = [
  "NO_CAPABILITY",
  "SELF_APPROVAL",
  "NO_PAYMENT",
  "PAYMENT_STATE",
  "NO_INSTALLMENT",
  "INSTALLMENT_STATE",
  "NO_PROPOSAL",
  "PROPOSAL_STATE",
  "NO_CASE",
  "CASE_STATE",
] as const;
export type ServicingRejectionCode = (typeof SERVICING_REJECTION_CODES)[number];

// ---------------------------------------------------------------------------
// Identity. Each kind has its own prefix and one kind is never read as another.
// ---------------------------------------------------------------------------

export const SERVICING_REF_KINDS = [
  "obligation",
  "draw",
  "reservation",
  "exposure",
  "limit",
  "installment",
  "payment",
  "allocation",
  "reversal",
  "adjustment",
  "proposal",
  "case",
  "event",
  "reason",
  "cut",
] as const;

export type ServicingRefKind = (typeof SERVICING_REF_KINDS)[number];

const REF_PREFIX: Readonly<Record<ServicingRefKind, string>> = {
  obligation: "obl-",
  draw: "drw-",
  reservation: "rsv-",
  exposure: "exp-",
  limit: "lim-",
  installment: "ins-",
  payment: "pmt-",
  allocation: "alc-",
  reversal: "rev-",
  adjustment: "adj-",
  proposal: "prp-",
  case: "cse-",
  event: "evn-",
  reason: "rsn-",
  cut: "cut-",
};

const REF_PATTERN = /^(obl|drw|rsv|exp|lim|ins|pmt|alc|rev|adj|prp|cse|evn|rsn|cut)-[0-9]{4}$/;

export function servicingRefFor(kind: ServicingRefKind, serial: number): string {
  return `${REF_PREFIX[kind]}${String(serial).padStart(4, "0")}`;
}

export function servicingRefKind(ref: string): ServicingRefKind | null {
  if (!REF_PATTERN.test(ref)) {
    return null;
  }
  for (const kind of SERVICING_REF_KINDS) {
    if (ref.startsWith(REF_PREFIX[kind])) {
      return kind;
    }
  }
  return null;
}

export function isServicingRef(ref: unknown, kind: ServicingRefKind): ref is string {
  return typeof ref === "string" && servicingRefKind(ref) === kind;
}

/** A whole-unit amount: digits only, no sign, no leading zero, at most twelve digits. */
const AMOUNT_PATTERN = /^(0|[1-9][0-9]{0,11})$/;

export function isServicingAmount(value: unknown): value is string {
  return typeof value === "string" && AMOUNT_PATTERN.test(value);
}

// ---------------------------------------------------------------------------
// Read model shapes
// ---------------------------------------------------------------------------

export interface ServicingScope {
  tenantId: string;
  /** The obligation whose servicing record is requested. A grant is checked against it. */
  obligationRef: string;
}

/**
 * A source cut: the position one source was read at. Obligation rows and payment
 * rows sit on different ledgers, and a row on the wrong ledger's cut is flagged,
 * never merged into one balance.
 */
export interface ServicingCut {
  cutRef: string;
  source: ServicingCutSource;
  generation: number;
  watermark: string;
}

interface ServicingRowBase {
  obligationRef: string;
  cutRef: string;
}

/**
 * The draw. The instruction and the disbursement observation are two facts: a
 * recorded instruction does not say anything was observed, and an observation is
 * not confirmed funds. Each lane is shown on its own.
 */
export interface ServicingDraw extends ServicingRowBase {
  drawRef: string;
  instruction: ServicingInstructionState;
  observation: ServicingObservationState;
  /** The instructed amount, the source's own text. Never parsed or summed. */
  amountLabel: string | null;
  unit: typeof SERVICING_UNIT;
}

/** The reservation against the commitment limit. Held is not spent and not disbursed. */
export interface ServicingReservation extends ServicingRowBase {
  reservationRef: string;
  state: ServicingReservationState;
}

/** The outstanding exposure the source reports. Open is not proof of anything paid. */
export interface ServicingExposure extends ServicingRowBase {
  exposureRef: string;
  state: ServicingExposureState;
  /** The source's own exposure figure, or null when it sent none. */
  amountLabel: string | null;
  unit: typeof SERVICING_UNIT;
}

/** The commitment limit. A partial repayment never restores it on its own. */
export interface ServicingLimit {
  limitRef: string;
  amount: string | null;
  state: ServicingLimitState;
  unit: typeof SERVICING_UNIT;
}

/** One repayment schedule row. The plan revision says which schedule revision built it. */
export interface ServicingInstallment extends ServicingRowBase {
  installmentRef: string;
  ordinal: number;
  dueLabel: string;
  amount: string;
  unit: typeof SERVICING_UNIT;
  planRevision: number;
  state: ServicingInstallmentState;
}

/**
 * A payment the source observed. The unallocated remainder is the source's own
 * label: it is never computed here, and an unallocated amount applies itself to
 * nothing.
 */
export interface ServicingPayment extends ServicingRowBase {
  paymentRef: string;
  observedLabel: string;
  amount: string;
  unit: typeof SERVICING_UNIT;
  state: ServicingPaymentState;
  timing: ServicingPaymentTiming;
  /** The source's own unallocated-remainder label, or null when it sent none. */
  unallocatedLabel: string | null;
}

/** An allocation of a payment to a schedule row. It stays its own record. */
export interface ServicingAllocation extends ServicingRowBase {
  allocationRef: string;
  paymentRef: string;
  installmentRef: string;
  amount: string;
  unit: typeof SERVICING_UNIT;
  state: ServicingAllocationState;
}

/** A reversal of an allocation. It removes the effect and keeps both events. */
export interface ServicingReversal extends ServicingRowBase {
  reversalRef: string;
  allocationRef: string;
  label: string;
}

/** A schedule correction. Proposed and applied are different states. */
export interface ServicingAdjustment extends ServicingRowBase {
  adjustmentRef: string;
  installmentRef: string;
  kind: ServicingAdjustmentKind;
  state: ServicingAdjustmentState;
  text: string;
}

/** A proposal one actor made and another must approve. It applies nothing alone. */
export interface ServicingProposal extends ServicingRowBase {
  proposalRef: string;
  kind: ServicingProposalKind;
  actorRef: string;
  state: ServicingProposalState;
  /** The row the proposal names: a payment, an installment, or the case. */
  targetRef: string | null;
  /** For an allocation proposal, the schedule row it names. */
  installmentRef: string | null;
  transition: ServicingCaseTransition | null;
  text: string;
}

export interface ServicingCaseHistoryEntry {
  label: string;
  status: ServicingCaseStatus;
  closureKind: ServicingClosureKind | null;
  note: string;
}

/**
 * The servicing case. A closed case is a bookkeeping closure: charged-off and
 * recovered are closure kinds, and the debt label is always the source's own
 * "not-extinguished" until a real producer says otherwise.
 */
export interface ServicingCase extends ServicingRowBase {
  caseRef: string;
  status: ServicingCaseStatus;
  closureKind: ServicingClosureKind | null;
  history: readonly ServicingCaseHistoryEntry[];
  debtLabel: typeof SERVICING_DEBT_LABEL;
}

/** One line on the incident timeline. It records a fact; it settles none. */
export interface ServicingEvent extends ServicingRowBase {
  eventRef: string;
  seq: number;
  kind: ServicingEventKind;
  label: string;
  targetRef: string | null;
}

export interface ServicingReason {
  reasonRef: string;
  lane: ServicingReasonLane;
  code: string;
  /** Source text for the reason. The page copies it and adds none. */
  text: string;
  remedy: ServicingRemedy;
}

export interface ServicingSnapshot {
  /** Read serial on this port. It orders reads and is not a commit position. */
  snapshotId: number;
  watermark: string;
  scenario: ServicingScenario;
  scope: ServicingScope;
  cuts: readonly ServicingCut[];
  schedule: { revision: number };
  draw: ServicingDraw | null;
  reservation: ServicingReservation | null;
  exposure: ServicingExposure | null;
  limit: ServicingLimit | null;
  installments: readonly ServicingInstallment[];
  payments: readonly ServicingPayment[];
  allocations: readonly ServicingAllocation[];
  reversals: readonly ServicingReversal[];
  adjustments: readonly ServicingAdjustment[];
  proposals: readonly ServicingProposal[];
  servicingCase: ServicingCase | null;
  events: readonly ServicingEvent[];
  reasons: readonly ServicingReason[];
  unit: typeof SERVICING_UNIT;
  nonClaims: ServicingNonClaims;
}

export interface ServicingReadRequest {
  contextKey: string;
  actorRef: string;
  scope: ServicingScope;
  watermarkFloor: string | null;
}

export type ServicingActionRequest =
  | { kind: "propose-allocation"; paymentRef: string; installmentRef: string }
  | { kind: "propose-adjustment"; installmentRef: string; adjustmentKind: ServicingAdjustmentKind; text: string }
  | { kind: "propose-case-transition"; transition: ServicingCaseTransition }
  | { kind: "approve-proposal"; proposalRef: string };

export interface ServicingActRequest {
  contextKey: string;
  actorRef: string;
  scope: ServicingScope;
  action: ServicingActionRequest;
}

/**
 * What the source says one accepted request did. A proposal is recorded, not
 * applied; an approval applies what the proposal named and nothing else.
 */
export interface ServicingReceipt {
  kind: ServicingActionKind;
  obligationRef: string;
  proposalRef: string;
  stateAfter: "proposal-recorded" | "applied";
  nonClaims: ServicingNonClaims;
}

export type ServicingTupleChanged = { kind: "tuple-changed"; field: string; expected: string; actual: string };

export type ServicingDenied = { kind: "denied"; code: ServicingDeniedCode; obligationRef: string; detail: string };

export type ServicingRefused = { kind: "refused"; code: ServicingRefusalCode; field: string; ref: string | null; detail: string };

export type ServicingInvalid = { kind: "invalid-request"; code: ServicingInvalidCode; detail: string };

export type ServicingReadOutcome =
  | { kind: "ready"; snapshot: ServicingSnapshot }
  | { kind: "empty"; watermark: string; snapshotId: number; scope: ServicingScope }
  | { kind: "stale"; watermark: string; floor: string }
  | ServicingDenied
  | ServicingRefused
  | ServicingInvalid
  | ServicingTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export type ServicingActOutcome =
  | { kind: "applied"; receipt: ServicingReceipt }
  | { kind: "rejected"; code: ServicingRejectionCode; detail: string }
  | ServicingDenied
  | ServicingRefused
  | ServicingInvalid
  | ServicingTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export interface ServicingPort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic-servicing" | "none";
  readonly scenario: ServicingScenario;
  read(request: ServicingReadRequest): Promise<ServicingReadOutcome>;
  act(request: ServicingActRequest): Promise<ServicingActOutcome>;
  /**
   * Synthetic control: moves the source on. A real producer offers no such call.
   * Returns false when there is no source to move, or nothing to move in the source.
   */
  synthetic(control: ServicingSyntheticControl): boolean;
}

export interface StubCreditServicingOptions {
  scenario?: ServicingScenario;
  /** Expected tuple override. Used to stage a producer change in tests. */
  expectedTuple?: DiscoveryReadTuple;
}

export interface ServicingEffectCounts {
  reads: number;
  acts: number;
}

export function createStubCreditServicing(options: StubCreditServicingOptions = {}): StubCreditServicing {
  return new StubCreditServicing(options);
}

export function createNotBoundCreditServicing(): ServicingPort {
  const outcome = { kind: "not-bound", reason: SERVICING_NOT_BOUND_REASON } as const;
  return {
    environment: "integration-http",
    source: "none",
    scenario: "clean",
    read() {
      return Promise.resolve({ ...outcome });
    },
    act() {
      return Promise.resolve({ ...outcome });
    },
    synthetic() {
      return false;
    },
  };
}

export function creditServicingPortFor(
  environment: "stub" | "integration-http",
  options: StubCreditServicingOptions = {},
): ServicingPort {
  if (environment === "stub") {
    return createStubCreditServicing(options);
  }
  return createNotBoundCreditServicing();
}

// ---------------------------------------------------------------------------
// Pure checks. The port uses them before it returns a row, and the controller and
// the screen use them to say what a snapshot can and cannot support.
// ---------------------------------------------------------------------------

/**
 * The first non-claim field the source does not state as the literal false. A missing
 * field counts: the source has to say it, and silence is not a no.
 */
export function findServicingClaim(nonClaims: unknown): ServicingNonClaimField | null {
  const record = (typeof nonClaims === "object" && nonClaims !== null ? nonClaims : {}) as Record<string, unknown>;
  for (const field of SERVICING_NON_CLAIM_FIELDS) {
    if (record[field] !== false) {
      return field;
    }
  }
  return null;
}

function refuse(code: ServicingRefusalCode, field: string, ref: string | null, detail: string): ServicingRefused {
  return { kind: "refused", code, field, ref, detail };
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

function refuseAmount(label: string, ref: string): ServicingRefused {
  return refuse("AMOUNT", "amount", ref, `${ref} amount ${label} is not a whole-unit string, so it is not shown.`);
}

/**
 * Checks a payload the source returned before any row is shown. A failure means the
 * payload cannot be trusted as a whole, so the port returns no row from it.
 */
export function refuseServicingSnapshot(snapshot: ServicingSnapshot): ServicingRefused | null {
  const cutRefs = new Set(snapshot.cuts.map((cut) => cut.cutRef));
  for (const cut of snapshot.cuts) {
    if (!isServicingRef(cut.cutRef, "cut")) {
      return refuse("REF", "cutRef", String(cut.cutRef), `Cut reference ${String(cut.cutRef)} is not a cut reference.`);
    }
    if (!includes(SERVICING_CUT_SOURCES, cut.source)) {
      return refuse("KIND", "source", cut.cutRef, `Cut ${cut.cutRef} names source ${String(cut.source)}.`);
    }
  }
  const missing = findServicingClaim(snapshot.nonClaims);
  if (missing !== null) {
    return refuse(
      "CLAIM",
      missing,
      null,
      `The source does not state ${missing} as false. An instruction is not a disbursement, a partial repayment restores no limit, a reversal erases no history, a case closure extinguishes no debt, and nothing here contacts, collects, or disburses.`,
    );
  }
  if (snapshot.unit !== SERVICING_UNIT) {
    return refuse("UNIT", "unit", null, `The read names unit ${String(snapshot.unit)}, not ${SERVICING_UNIT}.`);
  }
  const scope = snapshot.scope.obligationRef;
  const scoped: { ref: string; obligationRef: string; cutRef: string }[] = [
    ...(snapshot.draw === null ? [] : [{ ref: snapshot.draw.drawRef, obligationRef: snapshot.draw.obligationRef, cutRef: snapshot.draw.cutRef }]),
    ...(snapshot.reservation === null
      ? []
      : [{ ref: snapshot.reservation.reservationRef, obligationRef: snapshot.reservation.obligationRef, cutRef: snapshot.reservation.cutRef }]),
    ...(snapshot.exposure === null
      ? []
      : [{ ref: snapshot.exposure.exposureRef, obligationRef: snapshot.exposure.obligationRef, cutRef: snapshot.exposure.cutRef }]),
    ...snapshot.installments.map((row) => ({ ref: row.installmentRef, obligationRef: row.obligationRef, cutRef: row.cutRef })),
    ...snapshot.payments.map((row) => ({ ref: row.paymentRef, obligationRef: row.obligationRef, cutRef: row.cutRef })),
    ...snapshot.allocations.map((row) => ({ ref: row.allocationRef, obligationRef: row.obligationRef, cutRef: row.cutRef })),
    ...snapshot.reversals.map((row) => ({ ref: row.reversalRef, obligationRef: row.obligationRef, cutRef: row.cutRef })),
    ...snapshot.adjustments.map((row) => ({ ref: row.adjustmentRef, obligationRef: row.obligationRef, cutRef: row.cutRef })),
    ...snapshot.proposals.map((row) => ({ ref: row.proposalRef, obligationRef: row.obligationRef, cutRef: row.cutRef })),
    ...(snapshot.servicingCase === null
      ? []
      : [{ ref: snapshot.servicingCase.caseRef, obligationRef: snapshot.servicingCase.obligationRef, cutRef: snapshot.servicingCase.cutRef }]),
    ...snapshot.events.map((row) => ({ ref: row.eventRef, obligationRef: row.obligationRef, cutRef: row.cutRef })),
  ];
  for (const row of scoped) {
    if (row.obligationRef !== scope) {
      return refuse("SCOPE_LEAK", "obligationRef", row.ref, `Row ${row.ref} belongs to ${String(row.obligationRef)}, not to the requested scope.`);
    }
    if (!cutRefs.has(row.cutRef)) {
      return refuse("CUT", "cutRef", row.ref, `Row ${row.ref} names cut ${String(row.cutRef)}, which the snapshot does not list.`);
    }
  }
  if (snapshot.draw !== null) {
    if (!isServicingRef(snapshot.draw.drawRef, "draw")) {
      return refuse("REF", "drawRef", String(snapshot.draw.drawRef), "The draw reference is not a draw reference.");
    }
    if (!includes(SERVICING_INSTRUCTION_STATES, snapshot.draw.instruction)) {
      return refuse("STATE", "instruction", snapshot.draw.drawRef, `Instruction state ${String(snapshot.draw.instruction)} is not a state.`);
    }
    if (!includes(SERVICING_OBSERVATION_STATES, snapshot.draw.observation)) {
      return refuse("STATE", "observation", snapshot.draw.drawRef, `Observation state ${String(snapshot.draw.observation)} is not a state.`);
    }
    if (snapshot.draw.amountLabel !== null && !isServicingAmount(snapshot.draw.amountLabel)) {
      return refuseAmount(String(snapshot.draw.amountLabel), snapshot.draw.drawRef);
    }
    if (snapshot.draw.unit !== SERVICING_UNIT) {
      return refuse("UNIT", "unit", snapshot.draw.drawRef, `Draw ${snapshot.draw.drawRef} names unit ${String(snapshot.draw.unit)}.`);
    }
  }
  if (snapshot.reservation !== null) {
    if (!isServicingRef(snapshot.reservation.reservationRef, "reservation")) {
      return refuse("REF", "reservationRef", String(snapshot.reservation.reservationRef), "The reservation reference is not a reservation reference.");
    }
    if (!includes(SERVICING_RESERVATION_STATES, snapshot.reservation.state)) {
      return refuse("STATE", "state", snapshot.reservation.reservationRef, `Reservation state ${String(snapshot.reservation.state)} is not a state.`);
    }
  }
  if (snapshot.exposure !== null) {
    if (!isServicingRef(snapshot.exposure.exposureRef, "exposure")) {
      return refuse("REF", "exposureRef", String(snapshot.exposure.exposureRef), "The exposure reference is not an exposure reference.");
    }
    if (!includes(SERVICING_EXPOSURE_STATES, snapshot.exposure.state)) {
      return refuse("STATE", "state", snapshot.exposure.exposureRef, `Exposure state ${String(snapshot.exposure.state)} is not a state.`);
    }
    if (snapshot.exposure.amountLabel !== null && !isServicingAmount(snapshot.exposure.amountLabel)) {
      return refuseAmount(String(snapshot.exposure.amountLabel), snapshot.exposure.exposureRef);
    }
    if (snapshot.exposure.unit !== SERVICING_UNIT) {
      return refuse("UNIT", "unit", snapshot.exposure.exposureRef, `Exposure ${snapshot.exposure.exposureRef} names unit ${String(snapshot.exposure.unit)}.`);
    }
  }
  if (snapshot.limit !== null) {
    if (!isServicingRef(snapshot.limit.limitRef, "limit")) {
      return refuse("REF", "limitRef", String(snapshot.limit.limitRef), "The limit reference is not a limit reference.");
    }
    if (!includes(SERVICING_LIMIT_STATES, snapshot.limit.state)) {
      return refuse("STATE", "state", snapshot.limit.limitRef, `Limit state ${String(snapshot.limit.state)} is not a state.`);
    }
    if (snapshot.limit.amount !== null && !isServicingAmount(snapshot.limit.amount)) {
      return refuseAmount(String(snapshot.limit.amount), snapshot.limit.limitRef);
    }
    if (snapshot.limit.unit !== SERVICING_UNIT) {
      return refuse("UNIT", "unit", snapshot.limit.limitRef, `Limit ${snapshot.limit.limitRef} names unit ${String(snapshot.limit.unit)}.`);
    }
  }
  for (const row of snapshot.installments) {
    if (!isServicingRef(row.installmentRef, "installment")) {
      return refuse("REF", "installmentRef", String(row.installmentRef), `Reference ${String(row.installmentRef)} is not an installment reference.`);
    }
    if (!includes(SERVICING_INSTALLMENT_STATES, row.state)) {
      return refuse("STATE", "state", row.installmentRef, `Installment ${row.installmentRef} has state ${String(row.state)}.`);
    }
    if (!isServicingAmount(row.amount)) {
      return refuseAmount(row.amount, row.installmentRef);
    }
    if (row.unit !== SERVICING_UNIT) {
      return refuse("UNIT", "unit", row.installmentRef, `Installment ${row.installmentRef} names unit ${String(row.unit)}.`);
    }
    if (!Number.isInteger(row.planRevision) || row.planRevision < 1) {
      return refuse("STATE", "planRevision", row.installmentRef, `Installment ${row.installmentRef} names no plan revision.`);
    }
  }
  for (const row of snapshot.payments) {
    if (!isServicingRef(row.paymentRef, "payment")) {
      return refuse("REF", "paymentRef", String(row.paymentRef), `Reference ${String(row.paymentRef)} is not a payment reference.`);
    }
    if (!includes(SERVICING_PAYMENT_STATES, row.state)) {
      return refuse("STATE", "state", row.paymentRef, `Payment ${row.paymentRef} has state ${String(row.state)}.`);
    }
    if (!includes(SERVICING_PAYMENT_TIMINGS, row.timing)) {
      return refuse("KIND", "timing", row.paymentRef, `Payment ${row.paymentRef} has timing ${String(row.timing)}.`);
    }
    if (!isServicingAmount(row.amount)) {
      return refuseAmount(row.amount, row.paymentRef);
    }
    if (row.unallocatedLabel !== null && !isServicingAmount(row.unallocatedLabel)) {
      return refuseAmount(String(row.unallocatedLabel), row.paymentRef);
    }
    if (row.unit !== SERVICING_UNIT) {
      return refuse("UNIT", "unit", row.paymentRef, `Payment ${row.paymentRef} names unit ${String(row.unit)}.`);
    }
  }
  for (const row of snapshot.allocations) {
    if (!isServicingRef(row.allocationRef, "allocation")) {
      return refuse("REF", "allocationRef", String(row.allocationRef), `Reference ${String(row.allocationRef)} is not an allocation reference.`);
    }
    if (!isServicingRef(row.paymentRef, "payment")) {
      return refuse("REF", "paymentRef", row.allocationRef, `Allocation ${row.allocationRef} names ${String(row.paymentRef)} as its payment.`);
    }
    if (!isServicingRef(row.installmentRef, "installment")) {
      return refuse("REF", "installmentRef", row.allocationRef, `Allocation ${row.allocationRef} names ${String(row.installmentRef)} as its installment.`);
    }
    if (!includes(SERVICING_ALLOCATION_STATES, row.state)) {
      return refuse("STATE", "state", row.allocationRef, `Allocation ${row.allocationRef} has state ${String(row.state)}.`);
    }
    if (!isServicingAmount(row.amount)) {
      return refuseAmount(row.amount, row.allocationRef);
    }
    if (row.unit !== SERVICING_UNIT) {
      return refuse("UNIT", "unit", row.allocationRef, `Allocation ${row.allocationRef} names unit ${String(row.unit)}.`);
    }
  }
  for (const row of snapshot.reversals) {
    if (!isServicingRef(row.reversalRef, "reversal")) {
      return refuse("REF", "reversalRef", String(row.reversalRef), `Reference ${String(row.reversalRef)} is not a reversal reference.`);
    }
    if (!isServicingRef(row.allocationRef, "allocation")) {
      return refuse("REF", "allocationRef", row.reversalRef, `Reversal ${row.reversalRef} names ${String(row.allocationRef)} as its allocation.`);
    }
  }
  for (const row of snapshot.adjustments) {
    if (!isServicingRef(row.adjustmentRef, "adjustment")) {
      return refuse("REF", "adjustmentRef", String(row.adjustmentRef), `Reference ${String(row.adjustmentRef)} is not an adjustment reference.`);
    }
    if (!isServicingRef(row.installmentRef, "installment")) {
      return refuse("REF", "installmentRef", row.adjustmentRef, `Adjustment ${row.adjustmentRef} names ${String(row.installmentRef)} as its installment.`);
    }
    if (!includes(SERVICING_ADJUSTMENT_KINDS, row.kind)) {
      return refuse("KIND", "kind", row.adjustmentRef, `Adjustment ${row.adjustmentRef} has kind ${String(row.kind)}.`);
    }
    if (!includes(SERVICING_ADJUSTMENT_STATES, row.state)) {
      return refuse("STATE", "state", row.adjustmentRef, `Adjustment ${row.adjustmentRef} has state ${String(row.state)}.`);
    }
  }
  for (const row of snapshot.proposals) {
    if (!isServicingRef(row.proposalRef, "proposal")) {
      return refuse("REF", "proposalRef", String(row.proposalRef), `Reference ${String(row.proposalRef)} is not a proposal reference.`);
    }
    if (!includes(SERVICING_PROPOSAL_KINDS, row.kind)) {
      return refuse("KIND", "kind", row.proposalRef, `Proposal ${row.proposalRef} has kind ${String(row.kind)}.`);
    }
    if (!includes(SERVICING_PROPOSAL_STATES, row.state)) {
      return refuse("STATE", "state", row.proposalRef, `Proposal ${row.proposalRef} has state ${String(row.state)}.`);
    }
    if (row.transition !== null && !includes(SERVICING_CASE_TRANSITIONS, row.transition)) {
      return refuse("KIND", "transition", row.proposalRef, `Proposal ${row.proposalRef} names transition ${String(row.transition)}.`);
    }
  }
  if (snapshot.servicingCase !== null) {
    const item = snapshot.servicingCase;
    if (!isServicingRef(item.caseRef, "case")) {
      return refuse("REF", "caseRef", String(item.caseRef), "The case reference is not a case reference.");
    }
    if (!includes(SERVICING_CASE_STATUSES, item.status)) {
      return refuse("STATE", "status", item.caseRef, `Case status ${String(item.status)} is not a status.`);
    }
    if (item.closureKind !== null && !includes(SERVICING_CLOSURE_KINDS, item.closureKind)) {
      return refuse("KIND", "closureKind", item.caseRef, `Case closure ${String(item.closureKind)} is not a closure kind.`);
    }
    if (item.debtLabel !== SERVICING_DEBT_LABEL) {
      return refuse(
        "CLAIM",
        "debtLabel",
        item.caseRef,
        `The case says the debt is ${String(item.debtLabel)}. A closed case is a bookkeeping state, so the answer is not trusted.`,
      );
    }
    for (const entry of item.history) {
      if (!includes(SERVICING_CASE_STATUSES, entry.status)) {
        return refuse("STATE", "status", item.caseRef, `A case history entry names status ${String(entry.status)}.`);
      }
      if (entry.closureKind !== null && !includes(SERVICING_CLOSURE_KINDS, entry.closureKind)) {
        return refuse("KIND", "closureKind", item.caseRef, `A case history entry names closure ${String(entry.closureKind)}.`);
      }
    }
  }
  let lastSeq = 0;
  for (const row of snapshot.events) {
    if (!isServicingRef(row.eventRef, "event")) {
      return refuse("REF", "eventRef", String(row.eventRef), `Reference ${String(row.eventRef)} is not an event reference.`);
    }
    if (!includes(SERVICING_EVENT_KINDS, row.kind)) {
      return refuse("KIND", "kind", row.eventRef, `Event ${row.eventRef} has kind ${String(row.kind)}.`);
    }
    if (!Number.isInteger(row.seq) || row.seq <= lastSeq) {
      return refuse("STATE", "seq", row.eventRef, `Event ${row.eventRef} is out of sequence.`);
    }
    lastSeq = row.seq;
  }
  for (const reason of snapshot.reasons) {
    if (!isServicingRef(reason.reasonRef, "reason")) {
      return refuse("REF", "reasonRef", String(reason.reasonRef), `Reference ${String(reason.reasonRef)} is not a reason reference.`);
    }
    if (!includes(SERVICING_REASON_LANES, reason.lane)) {
      return refuse("KIND", "lane", reason.reasonRef, `Reason ${reason.reasonRef} names lane ${String(reason.lane)}.`);
    }
    if (!includes(SERVICING_REMEDIES, reason.remedy)) {
      return refuse("KIND", "remedy", reason.reasonRef, `Reason ${reason.reasonRef} names remedy ${String(reason.remedy)}.`);
    }
  }
  return null;
}

/**
 * Checks an accepted request's receipt before it is shown. A receipt that says a
 * proposal applied itself, or that states anything the desk may not claim, is
 * untrusted.
 */
export function refuseServicingReceipt(receipt: ServicingReceipt, request: ServicingActionRequest): ServicingRefused | null {
  const missing = findServicingClaim(receipt.nonClaims);
  if (missing !== null) {
    return refuse("CLAIM", missing, receipt.proposalRef, `The answer does not state ${missing} as false. Its receipt is not trusted.`);
  }
  if (receipt.kind !== request.kind) {
    return refuse("CLAIM", "kind", receipt.proposalRef, `The answer names ${String(receipt.kind)}, not ${request.kind}. The answer is not trusted.`);
  }
  if (!isServicingRef(receipt.obligationRef, "obligation")) {
    return refuse("REF", "obligationRef", String(receipt.obligationRef), "The receipt names no obligation reference.");
  }
  if (!isServicingRef(receipt.proposalRef, "proposal")) {
    return refuse("REF", "proposalRef", String(receipt.proposalRef), "A servicing answer names a proposal reference.");
  }
  const expected = request.kind === "approve-proposal" ? "applied" : "proposal-recorded";
  if (receipt.stateAfter !== expected) {
    return refuse(
      "CLAIM",
      "stateAfter",
      receipt.proposalRef,
      `The answer to a ${request.kind} says ${String(receipt.stateAfter)}. A proposal is recorded, not applied, and only an approval applies. The answer is not trusted.`,
    );
  }
  return null;
}

export type ServicingCutState = "none" | "clean" | "mixed";

export interface ServicingStaleInstallment {
  installmentRef: string;
  planRevision: number;
  currentRevision: number;
}

export type ServicingContradictionCode =
  | "EXPOSURE_WITHOUT_OBSERVATION"
  | "OBSERVATION_WITHOUT_INSTRUCTION"
  | "WRONG_LEDGER_CUT";

export interface ServicingContradiction {
  code: ServicingContradictionCode;
  /** The lane the page withholds because of it. */
  lane: ServicingLane;
  detail: string;
}

export interface ServicingUnlinked {
  lens: "allocations" | "reversals" | "adjustments" | "proposals" | "events";
  ref: string;
  missingRef: string;
}

export interface ServicingAssessment {
  /**
   * none: no row. clean: every obligation row sits on an obligation-ledger cut and
   * every payment row sits on a payment-ledger cut. mixed: a row sits on the other
   * ledger's cut; the ledgers are not merged.
   */
  cutState: ServicingCutState;
  usedCuts: readonly ServicingCut[];
  /** Schedule rows built under an older schedule revision. Flagged, never current. */
  staleInstallments: readonly ServicingStaleInstallment[];
  /** The case transitions the source would offer from the status it reported. */
  offeredTransitions: readonly ServicingCaseTransition[];
  contradictions: readonly ServicingContradiction[];
  unlinked: readonly ServicingUnlinked[];
}

/** The ledger a row belongs on. Obligation rows and payment rows stay apart. */
function ledgerOf(ref: string): ServicingCutSource | null {
  const kind = servicingRefKind(ref);
  if (kind === null) {
    return null;
  }
  if (kind === "payment" || kind === "allocation" || kind === "reversal") {
    return "payment-ledger";
  }
  return "obligation-ledger";
}

/**
 * The case transitions offered from a status. The source decides; the desk only
 * asks whether a transition is offered.
 */
export function servicingCaseTransitions(status: ServicingCaseStatus): readonly ServicingCaseTransition[] {
  switch (status) {
    case "monitoring":
      return ["to-recovery"];
    case "delinquent":
      return ["to-recovery", "to-charge-off"];
    case "recovery":
      return ["to-charge-off", "to-closed"];
    case "closed":
      return [];
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

/**
 * What a snapshot can support. This names inconsistencies between lanes and
 * compares labels: revisions, refs, and states the source stated. It adds no
 * amount and compares no amount.
 */
export function assessServicingSnapshot(snapshot: ServicingSnapshot): ServicingAssessment {
  const cutByRef = new Map(snapshot.cuts.map((cut) => [cut.cutRef, cut]));
  // The ledger a row belongs on. An event is judged by the row its target names.
  const rows: { ref: string; cutRef: string; ledger: ServicingCutSource | null }[] = [
    ...(snapshot.draw === null ? [] : [{ ref: snapshot.draw.drawRef, cutRef: snapshot.draw.cutRef, ledger: ledgerOf(snapshot.draw.drawRef) }]),
    ...(snapshot.reservation === null
      ? []
      : [{ ref: snapshot.reservation.reservationRef, cutRef: snapshot.reservation.cutRef, ledger: ledgerOf(snapshot.reservation.reservationRef) }]),
    ...(snapshot.exposure === null
      ? []
      : [{ ref: snapshot.exposure.exposureRef, cutRef: snapshot.exposure.cutRef, ledger: ledgerOf(snapshot.exposure.exposureRef) }]),
    ...snapshot.installments.map((row) => ({ ref: row.installmentRef, cutRef: row.cutRef, ledger: ledgerOf(row.installmentRef) })),
    ...snapshot.payments.map((row) => ({ ref: row.paymentRef, cutRef: row.cutRef, ledger: ledgerOf(row.paymentRef) })),
    ...snapshot.allocations.map((row) => ({ ref: row.allocationRef, cutRef: row.cutRef, ledger: ledgerOf(row.allocationRef) })),
    ...snapshot.reversals.map((row) => ({ ref: row.reversalRef, cutRef: row.cutRef, ledger: ledgerOf(row.reversalRef) })),
    ...snapshot.adjustments.map((row) => ({ ref: row.adjustmentRef, cutRef: row.cutRef, ledger: ledgerOf(row.adjustmentRef) })),
    ...snapshot.proposals.map((row) => ({ ref: row.proposalRef, cutRef: row.cutRef, ledger: ledgerOf(row.proposalRef) })),
    ...(snapshot.servicingCase === null
      ? []
      : [{ ref: snapshot.servicingCase.caseRef, cutRef: snapshot.servicingCase.cutRef, ledger: ledgerOf(snapshot.servicingCase.caseRef) }]),
    ...snapshot.events.map((row) => ({
      ref: row.eventRef,
      cutRef: row.cutRef,
      ledger: row.targetRef === null ? null : ledgerOf(row.targetRef),
    })),
  ];
  const named = new Set(rows.map((row) => row.cutRef));
  const usedCuts = snapshot.cuts.filter((cut) => named.has(cut.cutRef));

  const contradictions: ServicingContradiction[] = [];
  let mixed = false;
  for (const row of rows) {
    const cut = cutByRef.get(row.cutRef);
    const ledger = row.ledger;
    if (cut !== undefined && ledger !== null && cut.source !== ledger) {
      mixed = true;
      contradictions.push({
        code: "WRONG_LEDGER_CUT",
        lane: ledger === "payment-ledger" ? "payment" : "schedule",
        detail: `Row ${row.ref} sits on ${cut.cutRef}, a ${cut.source} cut, and it is a ${ledger} row. The ledgers are not merged; the row is flagged.`,
      });
    }
  }
  const cutState: ServicingCutState = usedCuts.length === 0 ? "none" : mixed ? "mixed" : "clean";

  const staleInstallments = snapshot.installments
    .filter((row) => row.planRevision !== snapshot.schedule.revision)
    .map((row) => ({ installmentRef: row.installmentRef, planRevision: row.planRevision, currentRevision: snapshot.schedule.revision }));

  if (snapshot.exposure !== null && snapshot.exposure.state === "open" && snapshot.draw?.observation !== "observed") {
    contradictions.push({
      code: "EXPOSURE_WITHOUT_OBSERVATION",
      lane: "exposure",
      detail: "The source reports an open exposure and lists no observed disbursement. An open exposure is not proof a disbursement happened; the exposure is flagged.",
    });
  }
  if (snapshot.draw !== null && snapshot.draw.observation === "observed" && snapshot.draw.instruction !== "recorded") {
    contradictions.push({
      code: "OBSERVATION_WITHOUT_INSTRUCTION",
      lane: "draw",
      detail: "The source reports a disbursement observation and lists no recorded instruction. The observation is flagged, never shown as an instruction.",
    });
  }

  const paymentRefs = new Set(snapshot.payments.map((row) => row.paymentRef));
  const installmentRefs = new Set(snapshot.installments.map((row) => row.installmentRef));
  const allocationRefs = new Set(snapshot.allocations.map((row) => row.allocationRef));
  const knownRefs = new Set<string>([
    ...paymentRefs,
    ...installmentRefs,
    ...allocationRefs,
    ...snapshot.reversals.map((row) => row.reversalRef),
    ...snapshot.adjustments.map((row) => row.adjustmentRef),
    ...snapshot.proposals.map((row) => row.proposalRef),
    ...(snapshot.draw === null ? [] : [snapshot.draw.drawRef]),
    ...(snapshot.reservation === null ? [] : [snapshot.reservation.reservationRef]),
    ...(snapshot.exposure === null ? [] : [snapshot.exposure.exposureRef]),
    ...(snapshot.servicingCase === null ? [] : [snapshot.servicingCase.caseRef]),
  ]);
  const unlinked: ServicingUnlinked[] = [];
  for (const row of snapshot.allocations) {
    if (!paymentRefs.has(row.paymentRef)) {
      unlinked.push({ lens: "allocations", ref: row.allocationRef, missingRef: row.paymentRef });
    }
    if (!installmentRefs.has(row.installmentRef)) {
      unlinked.push({ lens: "allocations", ref: row.allocationRef, missingRef: row.installmentRef });
    }
  }
  for (const row of snapshot.reversals) {
    if (!allocationRefs.has(row.allocationRef)) {
      unlinked.push({ lens: "reversals", ref: row.reversalRef, missingRef: row.allocationRef });
    }
  }
  for (const row of snapshot.adjustments) {
    if (!installmentRefs.has(row.installmentRef)) {
      unlinked.push({ lens: "adjustments", ref: row.adjustmentRef, missingRef: row.installmentRef });
    }
  }
  for (const row of snapshot.proposals) {
    if (row.targetRef !== null && !knownRefs.has(row.targetRef) && row.targetRef !== snapshot.servicingCase?.caseRef) {
      unlinked.push({ lens: "proposals", ref: row.proposalRef, missingRef: row.targetRef });
    }
    if (row.installmentRef !== null && !installmentRefs.has(row.installmentRef)) {
      unlinked.push({ lens: "proposals", ref: row.proposalRef, missingRef: row.installmentRef });
    }
  }
  for (const row of snapshot.events) {
    if (row.targetRef !== null && !knownRefs.has(row.targetRef)) {
      unlinked.push({ lens: "events", ref: row.eventRef, missingRef: row.targetRef });
    }
  }
  return {
    cutState,
    usedCuts,
    staleInstallments,
    offeredTransitions: snapshot.servicingCase === null ? [] : servicingCaseTransitions(snapshot.servicingCase.status),
    contradictions,
    unlinked,
  };
}

export interface ServicingEligibility {
  allowed: boolean;
  /** Why the action is off. Null when it is on. */
  reason: string | null;
}

function remedyOffered(snapshot: ServicingSnapshot, remedy: ServicingRemedy): boolean {
  return snapshot.reasons.some((reason) => reason.remedy === remedy);
}

/** The payments the read allows an allocation proposal to name. */
export function servicingAllocatablePayments(snapshot: ServicingSnapshot): readonly ServicingPayment[] {
  return snapshot.payments.filter((row) => row.state === "unallocated" || row.state === "late-unallocated" || row.state === "partial");
}

/** The schedule rows the read allows an allocation or adjustment proposal to name. */
export function servicingAdjustableInstallments(snapshot: ServicingSnapshot): readonly ServicingInstallment[] {
  return snapshot.installments.filter((row) => row.state === "scheduled" || row.state === "due" || row.state === "overdue");
}

/**
 * Whether an action is on offer for a read. This is label logic over what the source
 * said: it is the same answer for the controller and for the screen, so a control the
 * page shows as off is a request the controller never sends. The source decides again.
 */
export function servicingEligibility(
  snapshot: ServicingSnapshot,
  assessment: ServicingAssessment,
  kind: ServicingActionKind,
): ServicingEligibility {
  const no = (reason: string): ServicingEligibility => ({ allowed: false, reason });
  const yes: ServicingEligibility = { allowed: true, reason: null };
  switch (kind) {
    case "propose-allocation": {
      if (assessment.cutState === "mixed") {
        return no("A row sits on the wrong ledger's cut. The ledgers are not merged, so no allocation is proposed on this read.");
      }
      if (servicingAllocatablePayments(snapshot).length === 0) {
        return no("The source lists no payment with an unallocated part. An allocated or reversed payment takes no new allocation.");
      }
      if (servicingAdjustableInstallments(snapshot).length === 0) {
        return no("The source lists no open schedule row to allocate to.");
      }
      return yes;
    }
    case "propose-adjustment": {
      if (servicingAdjustableInstallments(snapshot).length === 0) {
        return no("The source lists no open schedule row to adjust.");
      }
      return yes;
    }
    case "propose-case-transition": {
      if (snapshot.servicingCase === null) {
        return no("The source lists no servicing case for this obligation.");
      }
      if (snapshot.servicingCase.status === "closed") {
        return no("The case is closed. A closure is a bookkeeping state, and this read offers no transition from it.");
      }
      if (!remedyOffered(snapshot, "propose-case-transition") && assessment.offeredTransitions.length === 0) {
        return no("The source names no case transition from the current status.");
      }
      return yes;
    }
    case "approve-proposal": {
      if (!snapshot.proposals.some((row) => row.state === "pending")) {
        return no("The source lists no pending proposal. A proposal is approved only while it is pending.");
      }
      return yes;
    }
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Synthetic source
// ---------------------------------------------------------------------------

const CUT_OBLIGATION = "cut-0001";
const CUT_PAYMENT = "cut-0002";
const OBLIGATION_GENERATION = 9;
const PAYMENT_GENERATION = 11;
const BASE_SCHEDULE_REVISION = 2;
const DRAW_REF = "drw-0001";
const RESERVATION_REF = "rsv-0001";
const EXPOSURE_REF = "exp-0001";
const LIMIT_REF = "lim-0001";
const CASE_REF = "cse-0001";
const SEED_DRAW_AMOUNT = "1200";
const SEED_LIMIT_AMOUNT = "1500";
const SEED_EXPOSURE_AMOUNT = "800";
const ADJUSTMENT_TEXT_BOUND = 120;

/** What a request to the source is for the stub's own bookkeeping. */
const NON_CLAIMS: ServicingNonClaims = {
  instructionIsDisbursement: false,
  observationIsConfirmedFunds: false,
  partialRepaymentRestoresLimit: false,
  reversalErasesHistory: false,
  caseClosureIsDebtExtinguished: false,
  contactMade: false,
  collectionExecuted: false,
  disbursed: false,
};

interface SeedPayment {
  paymentRef: string;
  amount: string;
  state: ServicingPaymentState;
  timing: ServicingPaymentTiming;
  unallocatedLabel: string | null;
}

interface SeedAllocation {
  allocationRef: string;
  paymentRef: string;
  installmentRef: string;
  amount: string;
  state: ServicingAllocationState;
}

interface SeedInstallment {
  installmentRef: string;
  ordinal: number;
  dueLabel: string;
  amount: string;
  planRevision: number;
  state: ServicingInstallmentState;
}

const SEED_INSTALLMENTS: readonly SeedInstallment[] = [
  { installmentRef: "ins-0001", ordinal: 1, dueLabel: "syn-due-a", amount: "400", planRevision: BASE_SCHEDULE_REVISION, state: "satisfied" },
  { installmentRef: "ins-0002", ordinal: 2, dueLabel: "syn-due-b", amount: "400", planRevision: BASE_SCHEDULE_REVISION, state: "due" },
  { installmentRef: "ins-0003", ordinal: 3, dueLabel: "syn-due-c", amount: "400", planRevision: BASE_SCHEDULE_REVISION, state: "scheduled" },
];

interface SourceEvent {
  kind: ServicingEventKind;
  label: string;
  targetRef: string | null;
}

interface SourceState {
  drawObservation: ServicingObservationState;
  reservationState: ServicingReservationState;
  exposureState: ServicingExposureState;
  exposureAmountLabel: string | null;
  limitState: ServicingLimitState;
  scheduleRevision: number;
  installments: SeedInstallment[];
  payments: SeedPayment[];
  allocations: SeedAllocation[];
  reversals: { reversalRef: string; allocationRef: string; label: string }[];
  adjustments: { adjustmentRef: string; installmentRef: string; kind: ServicingAdjustmentKind; state: ServicingAdjustmentState; text: string }[];
  proposals: ServicingProposal[];
  caseStatus: ServicingCaseStatus;
  caseClosure: ServicingClosureKind | null;
  caseHistory: ServicingCaseHistoryEntry[];
  events: SourceEvent[];
  seededReasons: { lane: ServicingReasonLane; code: string; text: string; remedy: ServicingRemedy }[];
}

const CASE_OPEN_NOTE = "Opened when the draw instruction was recorded.";

function baseEvents(): SourceEvent[] {
  return [
    { kind: "instruction", label: "Draw instruction drw-0001 recorded. An instruction is not an observation and not a disbursement.", targetRef: "drw-0001" },
    { kind: "observation", label: "Disbursement observation recorded against drw-0001, as the source labels it.", targetRef: "drw-0001" },
    { kind: "reservation", label: "Reservation rsv-0001 held against the commitment limit.", targetRef: "rsv-0001" },
    { kind: "payment", label: "Payment pmt-0001 observed.", targetRef: "pmt-0001" },
    { kind: "allocation", label: "Allocation alc-0001 applied payment pmt-0001 to installment ins-0001.", targetRef: "alc-0001" },
    { kind: "case", label: "Servicing case cse-0001 opened for monitoring.", targetRef: "cse-0001" },
  ];
}

function cleanState(): SourceState {
  return {
    drawObservation: "observed",
    reservationState: "held",
    exposureState: "open",
    exposureAmountLabel: SEED_EXPOSURE_AMOUNT,
    limitState: "held",
    scheduleRevision: BASE_SCHEDULE_REVISION,
    installments: SEED_INSTALLMENTS.map((row) => ({ ...row })),
    payments: [{ paymentRef: "pmt-0001", amount: "400", state: "allocated", timing: "scheduled-window", unallocatedLabel: "0" }],
    allocations: [{ allocationRef: "alc-0001", paymentRef: "pmt-0001", installmentRef: "ins-0001", amount: "400", state: "applied" }],
    reversals: [],
    adjustments: [],
    proposals: [],
    caseStatus: "monitoring",
    caseClosure: null,
    caseHistory: [{ label: "syn-case-opened", status: "monitoring", closureKind: null, note: CASE_OPEN_NOTE }],
    events: baseEvents(),
    seededReasons: [],
  };
}

function chargedOffHistory(): ServicingCaseHistoryEntry[] {
  return [
    { label: "syn-case-opened", status: "monitoring", closureKind: null, note: CASE_OPEN_NOTE },
    { label: "syn-case-delinquent", status: "delinquent", closureKind: null, note: "Marked delinquent when the schedule ran overdue." },
    { label: "syn-case-recovery", status: "recovery", closureKind: null, note: "Moved to recovery handling at the source." },
    { label: "syn-case-charged-off", status: "closed", closureKind: "charged-off", note: "Closed as charged-off. A charge-off is a bookkeeping state; the debt is not extinguished by it." },
  ];
}

/** The unallocated base plus one pending allocation proposal recorded by the named actor. */
function pendingAllocationProposal(actorRef: string): SourceState {
  const state = seedFor("unallocated");
  state.proposals = [
    {
      proposalRef: "prp-0001",
      kind: "allocation",
      actorRef,
      state: "pending",
      targetRef: "pmt-0003",
      installmentRef: "ins-0002",
      transition: null,
      text: "Allocate payment pmt-0003 to installment ins-0002.",
      obligationRef: SERVICING_OWN_REF,
      cutRef: CUT_OBLIGATION,
    },
  ];
  state.events.push({ kind: "proposal", label: `Proposal prp-0001 recorded by ${actorRef}. It applies nothing alone.`, targetRef: "prp-0001" });
  return state;
}

function seedFor(scenario: ServicingScenario): SourceState {
  switch (scenario) {
    case "draw-unknown":
      return {
        ...cleanState(),
        drawObservation: "unknown",
        exposureState: "unknown",
        exposureAmountLabel: null,
        events: baseEvents().filter((event) => event.kind !== "observation"),
      };
    case "partial-repayment": {
      const state = cleanState();
      state.payments.push({ paymentRef: "pmt-0002", amount: "500", state: "partial", timing: "late", unallocatedLabel: "300" });
      state.allocations.push({ allocationRef: "alc-0002", paymentRef: "pmt-0002", installmentRef: "ins-0002", amount: "200", state: "applied" });
      state.events.push(
        { kind: "payment", label: "Payment pmt-0002 observed late.", targetRef: "pmt-0002" },
        { kind: "allocation", label: "Allocation alc-0002 applied part of pmt-0002 to ins-0002. The rest stays unallocated.", targetRef: "alc-0002" },
      );
      state.seededReasons = [
        {
          lane: "payment",
          code: "UNALLOCATED_PART",
          text: "Payment pmt-0002 keeps an unallocated part of 300 mock-unit, as the source labels it. It applies itself to nothing; an allocation proposal and an approval are the only path.",
          remedy: "propose-allocation",
        },
      ];
      return state;
    }
    case "unallocated": {
      const state = cleanState();
      state.payments.push({ paymentRef: "pmt-0003", amount: "300", state: "unallocated", timing: "late", unallocatedLabel: "300" });
      state.events.push({ kind: "payment", label: "Payment pmt-0003 observed. None of it is allocated.", targetRef: "pmt-0003" });
      state.seededReasons = [
        {
          lane: "payment",
          code: "UNALLOCATED_PAYMENT",
          text: "Payment pmt-0003 is fully unallocated. An unallocated amount applies itself to nothing; an allocation proposal and an approval are the only path.",
          remedy: "propose-allocation",
        },
      ];
      return state;
    }
    case "reversal": {
      const state = cleanState();
      state.allocations = [{ allocationRef: "alc-0001", paymentRef: "pmt-0001", installmentRef: "ins-0001", amount: "400", state: "reversed" }];
      state.payments = [{ paymentRef: "pmt-0001", amount: "400", state: "reversed", timing: "scheduled-window", unallocatedLabel: "400" }];
      state.reversals = [{ reversalRef: "rev-0001", allocationRef: "alc-0001", label: "syn-reversal-0001" }];
      state.events.push({ kind: "reversal", label: "Reversal rev-0001 removed the effect of alc-0001. Both events stay on the timeline.", targetRef: "rev-0001" });
      return state;
    }
    case "delinquent": {
      const state = cleanState();
      state.installments[1]!.state = "overdue";
      state.caseStatus = "delinquent";
      state.caseHistory.push({ label: "syn-case-delinquent", status: "delinquent", closureKind: null, note: "Marked delinquent when the schedule ran overdue." });
      state.events.push({ kind: "case", label: "Case cse-0001 marked delinquent by the source.", targetRef: "cse-0001" });
      state.seededReasons = [
        {
          lane: "schedule",
          code: "INSTALLMENT_OVERDUE",
          text: "Installment ins-0002 is overdue at the source. A schedule correction is proposed and approved, never implied.",
          remedy: "propose-adjustment",
        },
        {
          lane: "case",
          code: "CASE_DELINQUENT",
          text: "The case is delinquent. Recovery or charge-off transitions are proposed and approved at the source; nothing contacts or collects here.",
          remedy: "propose-case-transition",
        },
      ];
      return state;
    }
    case "charged-off": {
      const state = cleanState();
      state.installments[1]!.state = "charged-off";
      state.installments[2]!.state = "charged-off";
      state.reservationState = "released";
      state.limitState = "released";
      state.caseStatus = "closed";
      state.caseClosure = "charged-off";
      state.caseHistory = chargedOffHistory();
      state.events.push(
        { kind: "case", label: "Case cse-0001 moved to recovery.", targetRef: "cse-0001" },
        { kind: "case", label: "Case cse-0001 closed as charged-off. The closure extinguishes no debt.", targetRef: "cse-0001" },
        { kind: "reservation", label: "Reservation rsv-0001 released.", targetRef: "rsv-0001" },
      );
      return state;
    }
    case "post-charge-off-payment": {
      const state = seedFor("charged-off");
      state.payments.push({ paymentRef: "pmt-0002", amount: "150", state: "late-unallocated", timing: "post-charge-off", unallocatedLabel: "150" });
      state.events.push({
        kind: "payment",
        label: "Payment pmt-0002 observed after the case closed. It is a fact of its own; it reopens nothing by itself.",
        targetRef: "pmt-0002",
      });
      state.seededReasons = [
        {
          lane: "payment",
          code: "POST_CLOSURE_PAYMENT",
          text: "Payment pmt-0002 arrived after the case closed charged-off. It stays unallocated and the closure stays a bookkeeping state; neither fact erases the other.",
          remedy: "propose-allocation",
        },
      ];
      return state;
    }
    case "proposal-pending":
    case "approve-claims-closure":
      return pendingAllocationProposal(SERVICING_DESK_ACTOR);
    case "self-approval":
      // A proposal recorded by the approver actor: the only way a proposer can
      // meet its own approval at this source. The self-approval rule applies.
      return pendingAllocationProposal(SERVICING_APPROVER_ACTOR);
    case "stale-schedule": {
      const state = cleanState();
      state.scheduleRevision = BASE_SCHEDULE_REVISION + 1;
      return state;
    }
    case "adjustment-applied": {
      const state = cleanState();
      state.installments[1]!.state = "adjusted";
      state.adjustments = [
        {
          adjustmentRef: "adj-0001",
          installmentRef: "ins-0002",
          kind: "due-label",
          state: "applied",
          text: "Due label corrected by the source after a schedule error was observed.",
        },
      ];
      state.events.push({ kind: "adjustment", label: "Adjustment adj-0001 applied to ins-0002.", targetRef: "adj-0001" });
      return state;
    }
    case "mixed-cut":
    case "dangling-link":
    case "scope-leak":
    case "claims-restored":
    case "claims-extinguished":
    case "claims-contact":
      return cleanState();
    default:
      return cleanState();
  }
}

/** What each actor string may read at the synthetic source. A stand-in for an authority. */
const GRANTS: ReadonlyMap<string, readonly string[]> = new Map([
  [SERVICING_DESK_ACTOR, [SERVICING_OWN_REF]],
  [SERVICING_APPROVER_ACTOR, [SERVICING_OWN_REF]],
  [SERVICING_VIEWER_ACTOR, [SERVICING_OWN_REF]],
]);

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Synthetic source. State lives in this object, so a new port is a new session. */
export class StubCreditServicing implements ServicingPort {
  readonly environment = "stub" as const;
  readonly source = "synthetic-servicing" as const;
  readonly scenario: ServicingScenario;
  private readonly expectedTuple: DiscoveryReadTuple;
  private readonly state: SourceState;
  private snapshotSerial = 0;
  private paymentSerial = 3;
  private allocationSerial = 2;
  private reversalSerial = 1;
  private adjustmentSerial = 1;
  private proposalSerial = 1;
  private revoked = false;
  private readonly counts: ServicingEffectCounts = { reads: 0, acts: 0 };

  constructor(options: StubCreditServicingOptions = {}) {
    this.scenario = options.scenario ?? "clean";
    this.expectedTuple = options.expectedTuple ?? DISCOVERY_READ_TUPLE_LITERALS;
    this.state = seedFor(this.scenario);
  }

  /** Test seam. Counts of what reached the source. Not part of the port. */
  effects(): ServicingEffectCounts {
    return { ...this.counts };
  }

  synthetic(control: ServicingSyntheticControl): boolean {
    const state = this.state;
    switch (control) {
      case "observe-draw": {
        if (state.drawObservation === "observed") {
          return false;
        }
        state.drawObservation = "observed";
        if (state.exposureState === "unknown") {
          state.exposureState = "open";
          state.exposureAmountLabel = SEED_EXPOSURE_AMOUNT;
        }
        state.events.push({ kind: "observation", label: "Disbursement observation recorded against drw-0001, as the source labels it.", targetRef: "drw-0001" });
        return true;
      }
      case "receive-payment": {
        const paymentRef = servicingRefFor("payment", this.paymentSerial + 1);
        this.paymentSerial += 1;
        const closed = state.caseStatus === "closed";
        state.payments.push({
          paymentRef,
          amount: "150",
          state: closed ? "late-unallocated" : "unallocated",
          timing: closed ? "post-charge-off" : "late",
          unallocatedLabel: "150",
        });
        state.events.push({
          kind: "payment",
          label: closed ? `Payment ${paymentRef} observed after the case closed.` : `Payment ${paymentRef} observed. None of it is allocated.`,
          targetRef: paymentRef,
        });
        return true;
      }
      case "reverse-allocation": {
        const target = state.allocations.find((row) => row.state === "applied");
        if (target === undefined) {
          return false;
        }
        target.state = "reversed";
        const payment = state.payments.find((row) => row.paymentRef === target.paymentRef);
        if (payment !== undefined) {
          payment.state = "reversed";
          payment.unallocatedLabel = payment.amount;
        }
        const reversalRef = servicingRefFor("reversal", this.reversalSerial + 1);
        this.reversalSerial += 1;
        state.reversals.push({ reversalRef, allocationRef: target.allocationRef, label: `syn-reversal-${reversalRef.slice(4)}` });
        state.events.push({
          kind: "reversal",
          label: `Reversal ${reversalRef} removed the effect of ${target.allocationRef}. Both events stay on the timeline.`,
          targetRef: reversalRef,
        });
        return true;
      }
      case "mark-overdue": {
        const target = state.installments.find((row) => row.state === "scheduled" || row.state === "due");
        if (target === undefined) {
          return false;
        }
        target.state = "overdue";
        if (state.caseStatus === "monitoring") {
          state.caseStatus = "delinquent";
          state.caseHistory.push({ label: "syn-case-delinquent", status: "delinquent", closureKind: null, note: "Marked delinquent when the schedule ran overdue." });
          state.events.push({ kind: "case", label: "Case cse-0001 marked delinquent by the source.", targetRef: "cse-0001" });
        }
        return true;
      }
      case "advance-schedule":
        state.scheduleRevision += 1;
        return true;
      case "revoke-grant":
        this.revoked = true;
        return true;
      default: {
        const exhaustive: never = control;
        return exhaustive;
      }
    }
  }

  read(request: ServicingReadRequest): Promise<ServicingReadOutcome> {
    this.counts.reads += 1;
    if (this.scenario === "read-lost") {
      return Promise.reject(new Error("The answer to the read never arrived."));
    }
    return Promise.resolve(this.readNow(request));
  }

  act(request: ServicingActRequest): Promise<ServicingActOutcome> {
    this.counts.acts += 1;
    if (this.scenario === "act-lost") {
      // The request reached the source and took effect. The answer never arrives.
      this.actNow(request);
      return Promise.reject(new Error("The answer to the request never arrived."));
    }
    return Promise.resolve(this.actNow(request));
  }

  private gate(request: { contextKey: unknown; actorRef: unknown; scope: ServicingScope }): ServicingInvalid | ServicingDenied | null {
    if (!isNonEmpty(request.contextKey)) {
      return { kind: "invalid-request", code: "CONTEXT", detail: "A request carries a context key." };
    }
    if (!isNonEmpty(request.actorRef)) {
      return { kind: "invalid-request", code: "ACTOR", detail: "A request carries an actor string. It is a label, not an authentication result." };
    }
    const scope = request.scope as Partial<ServicingScope> | null | undefined;
    if (scope?.tenantId !== SERVICING_TENANT || !isServicingRef(scope.obligationRef, "obligation")) {
      return { kind: "invalid-request", code: "SCOPE", detail: `A scope names tenant ${SERVICING_TENANT} and an obligation reference.` };
    }
    if (this.revoked || this.scenario === "denied") {
      return { kind: "denied", code: "GRANT_REVOKED", obligationRef: scope.obligationRef, detail: "The grant for this actor was withdrawn at the source. No row is returned." };
    }
    const granted = GRANTS.get(String(request.actorRef)) ?? [];
    if (!granted.includes(scope.obligationRef)) {
      return { kind: "denied", code: "SCOPE_DENIED", obligationRef: scope.obligationRef, detail: "This actor holds no grant for that obligation at the source. No row is returned." };
    }
    return null;
  }

  private capability(actorRef: string, needed: "propose" | "approve"): ServicingActOutcome | null {
    if (!servicingCapabilities(actorRef).includes(needed)) {
      return {
        kind: "rejected",
        code: "NO_CAPABILITY",
        detail: `Actor ${actorRef} holds no ${needed} capability at the source. View, proposal, and approval stay separate.`,
      };
    }
    return null;
  }

  private readNow(request: ServicingReadRequest): ServicingReadOutcome {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return { kind: "tuple-changed", field: tuple.field, expected: tuple.expected, actual: tuple.actual };
    }
    const refusedRequest = this.gate(request);
    if (refusedRequest !== null) {
      return refusedRequest;
    }
    if (request.watermarkFloor !== null && Number.isNaN(Date.parse(request.watermarkFloor))) {
      return { kind: "invalid-request", code: "FLOOR", detail: "The watermark floor is not an instant." };
    }
    this.snapshotSerial += 1;
    const watermark = this.scenario === "stale" ? SERVICING_STALE_WATERMARK : SERVICING_AS_OF;
    const floor = request.watermarkFloor ?? (this.scenario === "stale" ? SERVICING_STALE_FLOOR : null);
    if (floor !== null && Date.parse(watermark) < Date.parse(floor)) {
      return { kind: "stale", watermark, floor };
    }
    if (this.scenario === "empty") {
      return { kind: "empty", watermark, snapshotId: this.snapshotSerial, scope: { ...request.scope } };
    }
    const snapshot = this.buildSnapshot(request.scope, watermark);
    const refused = refuseServicingSnapshot(snapshot);
    if (refused !== null) {
      return refused;
    }
    return { kind: "ready", snapshot };
  }

  private buildSnapshot(scope: ServicingScope, watermark: string): ServicingSnapshot {
    const state = this.state;
    const own = scope.obligationRef;
    const cuts: ServicingCut[] = [
      { cutRef: CUT_OBLIGATION, source: "obligation-ledger", generation: OBLIGATION_GENERATION, watermark: SERVICING_AS_OF },
      { cutRef: CUT_PAYMENT, source: "payment-ledger", generation: PAYMENT_GENERATION, watermark: SERVICING_AS_OF },
    ];
    const obligationCut = CUT_OBLIGATION;
    const paymentCut = this.scenario === "mixed-cut" ? CUT_OBLIGATION : CUT_PAYMENT;

    const draw: ServicingDraw = {
      drawRef: DRAW_REF,
      obligationRef: own,
      cutRef: obligationCut,
      instruction: "recorded",
      observation: state.drawObservation,
      amountLabel: SEED_DRAW_AMOUNT,
      unit: SERVICING_UNIT,
    };
    const reservation: ServicingReservation = {
      reservationRef: RESERVATION_REF,
      obligationRef: own,
      cutRef: obligationCut,
      state: state.reservationState,
    };
    const exposure: ServicingExposure = {
      exposureRef: EXPOSURE_REF,
      obligationRef: own,
      cutRef: obligationCut,
      state: state.exposureState,
      amountLabel: state.exposureAmountLabel,
      unit: SERVICING_UNIT,
    };
    const limit: ServicingLimit = { limitRef: LIMIT_REF, amount: SEED_LIMIT_AMOUNT, state: state.limitState, unit: SERVICING_UNIT };

    const installments: ServicingInstallment[] = state.installments.map((row) => ({
      ...row,
      obligationRef: own,
      cutRef: obligationCut,
      unit: SERVICING_UNIT,
    }));
    let payments: ServicingPayment[] = state.payments.map((row) => ({
      ...row,
      obligationRef: own,
      cutRef: paymentCut,
      unit: SERVICING_UNIT,
      observedLabel: "syn-observed",
    }));
    if (this.scenario === "scope-leak") {
      payments = [
        ...payments,
        {
          paymentRef: "pmt-0009",
          obligationRef: SERVICING_FOREIGN_REF,
          cutRef: paymentCut,
          amount: "900",
          unit: SERVICING_UNIT,
          state: "unallocated",
          timing: "late",
          unallocatedLabel: "900",
          observedLabel: "syn-observed",
        },
      ];
    }
    const allocations: ServicingAllocation[] = state.allocations.map((row) => ({
      ...row,
      paymentRef: this.scenario === "dangling-link" && row.allocationRef === "alc-0001" ? "pmt-0099" : row.paymentRef,
      obligationRef: own,
      cutRef: paymentCut,
      unit: SERVICING_UNIT,
    }));
    const reversals: ServicingReversal[] = state.reversals.map((row) => ({ ...row, obligationRef: own, cutRef: paymentCut }));
    const adjustments: ServicingAdjustment[] = state.adjustments.map((row) => ({ ...row, obligationRef: own, cutRef: obligationCut }));
    const proposals: ServicingProposal[] = state.proposals.map((row) => ({ ...row, obligationRef: own }));
    const servicingCase: ServicingCase = {
      caseRef: CASE_REF,
      obligationRef: own,
      cutRef: obligationCut,
      status: state.caseStatus,
      closureKind: state.caseClosure,
      history: state.caseHistory.map((entry) => ({ ...entry })),
      debtLabel: SERVICING_DEBT_LABEL,
    };
    const events: ServicingEvent[] = state.events.map((event, index) => ({
      eventRef: servicingRefFor("event", index + 1),
      seq: index + 1,
      kind: event.kind,
      label: event.label,
      targetRef: event.targetRef,
      obligationRef: own,
      cutRef: ledgerOf(event.targetRef ?? "") === "payment-ledger" ? paymentCut : obligationCut,
    }));

    let nonClaims: ServicingNonClaims = { ...NON_CLAIMS };
    if (this.scenario === "claims-restored") {
      nonClaims = { ...nonClaims, partialRepaymentRestoresLimit: true } as unknown as ServicingNonClaims;
    }
    if (this.scenario === "claims-extinguished") {
      nonClaims = { ...nonClaims, caseClosureIsDebtExtinguished: true } as unknown as ServicingNonClaims;
    }
    if (this.scenario === "claims-contact") {
      nonClaims = { ...nonClaims, contactMade: true } as unknown as ServicingNonClaims;
    }
    return {
      snapshotId: this.snapshotSerial,
      watermark,
      scenario: this.scenario,
      scope: { ...scope },
      cuts,
      schedule: { revision: state.scheduleRevision },
      draw,
      reservation,
      exposure,
      limit,
      installments,
      payments,
      allocations,
      reversals,
      adjustments,
      proposals,
      servicingCase,
      events,
      reasons: state.seededReasons.map((item, index) => ({
        reasonRef: servicingRefFor("reason", index + 1),
        lane: item.lane,
        code: item.code,
        text: item.text,
        remedy: item.remedy,
      })),
      unit: SERVICING_UNIT,
      nonClaims,
    };
  }

  private rejected(code: ServicingRejectionCode, detail: string): ServicingActOutcome {
    return { kind: "rejected", code, detail };
  }

  private eventSeqNext(): number {
    return this.state.events.length + 1;
  }

  private receipt(kind: ServicingActionKind, proposalRef: string, stateAfter: "proposal-recorded" | "applied"): ServicingReceipt {
    return {
      kind,
      obligationRef: SERVICING_OWN_REF,
      proposalRef,
      stateAfter,
      nonClaims:
        this.scenario === "approve-claims-closure"
          ? ({ ...NON_CLAIMS, caseClosureIsDebtExtinguished: true } as unknown as ServicingNonClaims)
          : { ...NON_CLAIMS },
    };
  }

  private actNow(request: ServicingActRequest): ServicingActOutcome {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return { kind: "tuple-changed", field: tuple.field, expected: tuple.expected, actual: tuple.actual };
    }
    const refusedRequest = this.gate(request);
    if (refusedRequest !== null) {
      return refusedRequest;
    }
    const action = request.action as Partial<ServicingActionRequest> | null | undefined;
    if (action === null || action === undefined || !includes(SERVICING_ACTION_KINDS, action.kind)) {
      return { kind: "invalid-request", code: "ACTION", detail: "A request names one action from the list." };
    }
    const outcome = this.apply(request.actorRef, request.action);
    if (outcome.kind !== "applied") {
      return outcome;
    }
    const refused = refuseServicingReceipt(outcome.receipt, request.action);
    return refused !== null ? refused : outcome;
  }

  private paymentBy(ref: string) {
    return this.state.payments.find((row) => row.paymentRef === ref);
  }

  private installmentBy(ref: string) {
    return this.state.installments.find((row) => row.installmentRef === ref);
  }

  private apply(actorRef: string, action: ServicingActionRequest): ServicingActOutcome {
    const state = this.state;
    switch (action.kind) {
      case "propose-allocation": {
        const hold = this.capability(actorRef, "propose");
        if (hold !== null) {
          return hold;
        }
        if (!isServicingRef(action.paymentRef, "payment") || !isServicingRef(action.installmentRef, "installment")) {
          return { kind: "invalid-request", code: "REF", detail: "An allocation proposal names a payment and a schedule row." };
        }
        const payment = this.paymentBy(action.paymentRef);
        if (payment === undefined) {
          return this.rejected("NO_PAYMENT", `The source lists no payment ${action.paymentRef} for this obligation.`);
        }
        if (payment.state !== "unallocated" && payment.state !== "late-unallocated" && payment.state !== "partial") {
          return this.rejected("PAYMENT_STATE", `Payment ${payment.paymentRef} is ${payment.state}. An allocated or reversed payment takes no new allocation.`);
        }
        const installment = this.installmentBy(action.installmentRef);
        if (installment === undefined) {
          return this.rejected("NO_INSTALLMENT", `The source lists no schedule row ${action.installmentRef} for this obligation.`);
        }
        if (installment.state !== "scheduled" && installment.state !== "due" && installment.state !== "overdue") {
          return this.rejected("INSTALLMENT_STATE", `Installment ${installment.installmentRef} is ${installment.state}. A closed row takes no allocation.`);
        }
        const proposalRef = servicingRefFor("proposal", this.proposalSerial + 1);
        this.proposalSerial += 1;
        state.proposals.push({
          proposalRef,
          kind: "allocation",
          actorRef,
          state: "pending",
          targetRef: payment.paymentRef,
          installmentRef: installment.installmentRef,
          transition: null,
          text: `Allocate payment ${payment.paymentRef} to installment ${installment.installmentRef}.`,
          obligationRef: SERVICING_OWN_REF,
          cutRef: CUT_OBLIGATION,
        });
        state.events.push({
          kind: "proposal",
          label: `Proposal ${proposalRef} recorded by ${actorRef}: allocate ${payment.paymentRef} to ${installment.installmentRef}. It applies nothing alone.`,
          targetRef: proposalRef,
        });
        return { kind: "applied", receipt: this.receipt(action.kind, proposalRef, "proposal-recorded") };
      }
      case "propose-adjustment": {
        const hold = this.capability(actorRef, "propose");
        if (hold !== null) {
          return hold;
        }
        if (!isServicingRef(action.installmentRef, "installment")) {
          return { kind: "invalid-request", code: "REF", detail: "An adjustment proposal names a schedule row." };
        }
        if (!includes(SERVICING_ADJUSTMENT_KINDS, (action as { adjustmentKind?: unknown }).adjustmentKind)) {
          return { kind: "invalid-request", code: "ACTION", detail: "An adjustment proposal names one adjustment kind." };
        }
        if (!isNonEmpty(action.text) || action.text.length > ADJUSTMENT_TEXT_BOUND) {
          return { kind: "invalid-request", code: "TEXT", detail: "An adjustment proposal carries a note between 1 and 120 characters." };
        }
        const installment = this.installmentBy(action.installmentRef);
        if (installment === undefined) {
          return this.rejected("NO_INSTALLMENT", `The source lists no schedule row ${action.installmentRef} for this obligation.`);
        }
        if (installment.state !== "scheduled" && installment.state !== "due" && installment.state !== "overdue") {
          return this.rejected("INSTALLMENT_STATE", `Installment ${installment.installmentRef} is ${installment.state}. A closed row takes no adjustment.`);
        }
        const proposalRef = servicingRefFor("proposal", this.proposalSerial + 1);
        this.proposalSerial += 1;
        state.proposals.push({
          proposalRef,
          kind: "adjustment",
          actorRef,
          state: "pending",
          targetRef: installment.installmentRef,
          installmentRef: installment.installmentRef,
          transition: null,
          text: `${action.adjustmentKind}: ${action.text}`,
          obligationRef: SERVICING_OWN_REF,
          cutRef: CUT_OBLIGATION,
        });
        state.events.push({
          kind: "proposal",
          label: `Proposal ${proposalRef} recorded by ${actorRef}: adjust ${installment.installmentRef}. It applies nothing alone.`,
          targetRef: proposalRef,
        });
        return { kind: "applied", receipt: this.receipt(action.kind, proposalRef, "proposal-recorded") };
      }
      case "propose-case-transition": {
        const hold = this.capability(actorRef, "propose");
        if (hold !== null) {
          return hold;
        }
        if (!includes(SERVICING_CASE_TRANSITIONS, (action as { transition?: unknown }).transition)) {
          return { kind: "invalid-request", code: "ACTION", detail: "A case proposal names one transition from the list." };
        }
        if (state.caseStatus === "closed") {
          return this.rejected("CASE_STATE", "The case is closed. A closure is a bookkeeping state, and the source offers no transition from it.");
        }
        const offered = servicingCaseTransitions(state.caseStatus);
        if (!offered.includes(action.transition)) {
          return this.rejected("CASE_STATE", `The source offers ${offered.join(", ") || "no transition"} from ${state.caseStatus}, not ${action.transition}.`);
        }
        const proposalRef = servicingRefFor("proposal", this.proposalSerial + 1);
        this.proposalSerial += 1;
        state.proposals.push({
          proposalRef,
          kind: "case-transition",
          actorRef,
          state: "pending",
          targetRef: CASE_REF,
          installmentRef: null,
          transition: action.transition,
          text: `Move case cse-0001 ${action.transition}.`,
          obligationRef: SERVICING_OWN_REF,
          cutRef: CUT_OBLIGATION,
        });
        state.events.push({
          kind: "proposal",
          label: `Proposal ${proposalRef} recorded by ${actorRef}: case transition ${action.transition}. It applies nothing alone.`,
          targetRef: proposalRef,
        });
        return { kind: "applied", receipt: this.receipt(action.kind, proposalRef, "proposal-recorded") };
      }
      case "approve-proposal": {
        const hold = this.capability(actorRef, "approve");
        if (hold !== null) {
          return hold;
        }
        if (!isServicingRef(action.proposalRef, "proposal")) {
          return { kind: "invalid-request", code: "REF", detail: "An approval names a proposal reference." };
        }
        const proposal = state.proposals.find((row) => row.proposalRef === action.proposalRef);
        if (proposal === undefined) {
          return this.rejected("NO_PROPOSAL", `The source lists no proposal ${action.proposalRef} for this obligation.`);
        }
        if (proposal.state !== "pending") {
          return this.rejected("PROPOSAL_STATE", `Proposal ${proposal.proposalRef} is ${proposal.state}. A proposal is approved only while it is pending.`);
        }
        if (proposal.actorRef === actorRef) {
          return this.rejected("SELF_APPROVAL", `Actor ${actorRef} proposed ${proposal.proposalRef}. Proposal and approval stay separate, so its own actor cannot approve it.`);
        }
        const applied = this.applyProposal(proposal);
        if (applied !== null) {
          return applied;
        }
        proposal.state = "applied";
        state.events.push({ kind: "approval", label: `Proposal ${proposal.proposalRef} approved by ${actorRef} and applied.`, targetRef: proposal.proposalRef });
        return { kind: "applied", receipt: this.receipt(action.kind, proposal.proposalRef, "applied") };
      }
      default: {
        const exhaustive: never = action;
        return exhaustive;
      }
    }
  }

  /** Applies a pending proposal. Returns a rejection when the lanes moved under it. */
  private applyProposal(proposal: ServicingProposal): ServicingActOutcome | null {
    const state = this.state;
    switch (proposal.kind) {
      case "allocation": {
        const payment = proposal.targetRef === null ? undefined : this.paymentBy(proposal.targetRef);
        if (payment === undefined) {
          return this.rejected("NO_PAYMENT", `The source no longer lists the payment ${proposal.proposalRef} names.`);
        }
        if (payment.state !== "unallocated" && payment.state !== "late-unallocated" && payment.state !== "partial") {
          return this.rejected("PAYMENT_STATE", `Payment ${payment.paymentRef} is ${payment.state}. The approval changes nothing.`);
        }
        const installment = proposal.installmentRef === null ? undefined : this.installmentBy(proposal.installmentRef);
        if (installment === undefined) {
          return this.rejected("NO_INSTALLMENT", `The source no longer lists the schedule row ${proposal.proposalRef} names.`);
        }
        const allocationRef = servicingRefFor("allocation", this.allocationSerial + 1);
        this.allocationSerial += 1;
        const amount = payment.state === "partial" ? payment.unallocatedLabel ?? payment.amount : payment.amount;
        state.allocations.push({
          allocationRef,
          paymentRef: payment.paymentRef,
          installmentRef: installment.installmentRef,
          amount,
          state: "applied",
        });
        payment.state = "allocated";
        payment.unallocatedLabel = "0";
        installment.state = "satisfied";
        state.events.push({
          kind: "allocation",
          label: `Allocation ${allocationRef} applied payment ${payment.paymentRef} to installment ${installment.installmentRef}.`,
          targetRef: allocationRef,
        });
        return null;
      }
      case "adjustment": {
        const installment = proposal.installmentRef === null ? undefined : this.installmentBy(proposal.installmentRef);
        if (installment === undefined) {
          return this.rejected("NO_INSTALLMENT", `The source no longer lists the schedule row ${proposal.proposalRef} names.`);
        }
        const adjustmentRef = servicingRefFor("adjustment", this.adjustmentSerial + 1);
        this.adjustmentSerial += 1;
        const kindText = proposal.text.split(":", 1)[0] ?? "note";
        const kind = includes(SERVICING_ADJUSTMENT_KINDS, kindText) ? kindText : "note";
        state.adjustments.push({ adjustmentRef, installmentRef: installment.installmentRef, kind, state: "applied", text: proposal.text });
        installment.state = "adjusted";
        state.events.push({
          kind: "adjustment",
          label: `Adjustment ${adjustmentRef} applied to ${installment.installmentRef}. The earlier rows stay on the timeline.`,
          targetRef: adjustmentRef,
        });
        return null;
      }
      case "case-transition": {
        if (state.caseStatus === "closed") {
          return this.rejected("CASE_STATE", "The case closed while the proposal waited. The approval changes nothing.");
        }
        const transition = proposal.transition;
        if (transition === null || !servicingCaseTransitions(state.caseStatus).includes(transition)) {
          return this.rejected("CASE_STATE", `The source no longer offers ${String(transition)} from ${state.caseStatus}.`);
        }
        if (transition === "to-recovery") {
          state.caseStatus = "recovery";
          state.caseHistory.push({ label: `syn-case-recovery-${this.eventSeqNext()}`, status: "recovery", closureKind: null, note: "Moved to recovery handling after an approved proposal." });
        } else if (transition === "to-charge-off") {
          state.caseStatus = "closed";
          state.caseClosure = "charged-off";
          state.reservationState = "released";
          state.limitState = "released";
          for (const row of state.installments) {
            if (row.state === "scheduled" || row.state === "due" || row.state === "overdue") {
              row.state = "charged-off";
            }
          }
          state.caseHistory.push({
            label: `syn-case-charged-off-${this.eventSeqNext()}`,
            status: "closed",
            closureKind: "charged-off",
            note: "Closed as charged-off. A charge-off is a bookkeeping state; the debt is not extinguished by it.",
          });
        } else {
          state.caseStatus = "closed";
          state.caseClosure = "recovered";
          state.caseHistory.push({
            label: `syn-case-recovered-${this.eventSeqNext()}`,
            status: "closed",
            closureKind: "recovered",
            note: "Closed as recovered. A case closure is a bookkeeping state; the debt is not extinguished by it.",
          });
        }
        state.events.push({
          kind: "case",
          label: `Case cse-0001 moved ${transition} after an approved proposal. The closure extinguishes no debt.`,
          targetRef: "cse-0001",
        });
        return null;
      }
      default: {
        const exhaustive: never = proposal.kind;
        return exhaustive;
      }
    }
  }
}
