import {
  DISCOVERY_PROJECTION_AS_OF,
  DISCOVERY_READ_TENANT,
  DISCOVERY_READ_TUPLE_LITERALS,
  checkDiscoveryReadTuple,
  type DiscoveryReadTuple,
} from "./discovery-read.js";
import { PLATFORM_HOLD_NOT_BOUND, PLATFORM_NOT_COMPOSED } from "./platform-journey.js";

/**
 * Synthetic finance operations source for the reconciliation queue and the
 * accounting export.
 *
 * This is the stub-scope stand-in for a producer. The real connection stays pending
 * on kix-protocol:fin-catalogue-read-model and kix-protocol:cr-08-producer-sdk, and on
 * the unpromoted refund-surface. The contract-only catalogue has no read command for a
 * reconciliation case, a source cut, a payee allocation, an unapplied remainder, or an
 * accounting export, and no command that corrects a ledger. No producer tuple exists,
 * so the desk is NOT_BOUND on integration-http. No SDK, manifest, or vector is
 * consumed, and this module sends nothing over a network.
 *
 * Nothing here composes a catalogue command: no money posting is sent, and the
 * not-composed record below only quotes why.
 *
 * Rules, all enforced here and not only in copy:
 *  - A mismatch is a case linked to its original trade. The case, its facts, its
 *    payee allocations, and its unapplied remainder are the source's own rows. A late
 *    fact stays a fact of its own and is never folded into the cut it missed.
 *  - Nothing here parses, adds, scales, or compares an amount as a number. Totals,
 *    differences, remainders, and shares are the source's own text, or UNDETERMINED
 *    when the source sent none. The only comparison is text equality: an export row is
 *    compared with the read's row, and a verdict is compared with the source's own
 *    difference text.
 *  - A user confirmation never makes a ledger match. There is no force-match request.
 *    A correction is a proposal, an approval of a proposal is recorded and nothing
 *    more, and the authority to change economic state is held by no desk actor. The
 *    ledger moves only when the source posts a later cut.
 *  - Every figure belongs to a source cut. Cuts of different sources are never merged,
 *    and a case whose two sides sit on cuts at different positions is flagged as
 *    timing-uncertain instead of being called matched or mismatched.
 *  - The export is the source's own file. It carries a scope declaration that says
 *    synthetic, no real money, not posted to an accounting system, and not a book of
 *    record. A payload that says anything else is refused before a row is returned.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const FINANCE_OPERATIONS_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const FINANCE_NOT_BOUND_REASON =
  "No current producer tuple exists for finance operations: kix-protocol:fin-catalogue-read-model and kix-protocol:cr-08-producer-sdk are not merged, and the refund surface is not promoted. The contract-only catalogue has no read command for a reconciliation case, a source cut, a payee allocation, an unapplied remainder, or an accounting export, and no command that corrects a ledger. The finance desk stays NOT_BOUND on integration-http.";

export const FINANCE_PROJECTION_NAME = "kix.finance.operations";

/** What a producer connection would need. All of it is absent, so every connection claim is false. */
export const FINANCE_PRODUCER_TUPLE = {
  bound: false,
  status: "NOT_BOUND",
  sdkDigest: null,
  manifestDigest: null,
  vectorDigest: null,
  waitingOn: ["kix-protocol:fin-catalogue-read-model", "kix-protocol:cr-08-producer-sdk", "refund-surface"],
} as const;

/** Fixed instant the synthetic source claims to be built at. */
export const FINANCE_AS_OF = DISCOVERY_PROJECTION_AS_OF;

/** Watermark the stale scenario serves, and the floor a reader holds against it. */
export const FINANCE_STALE_WATERMARK = "2026-10-10T00:00:00.000Z";
export const FINANCE_STALE_FLOOR = "2026-10-12T00:00:00.000Z";

/** Watermark the payment-observation cut carries when the sources are skewed. */
export const FINANCE_SKEW_WATERMARK = "2026-10-12T06:00:00.000Z";

export const FINANCE_TENANT = DISCOVERY_READ_TENANT;

/** The book the desk actors hold a synthetic grant for, and one they do not. */
export const FINANCE_OWN_REF = "bok-0001";
export const FINANCE_FOREIGN_REF = "bok-0002";

/** The three desk actors. Each string is a context label, not an authentication result. */
export const FINANCE_REVIEWER_ACTOR = "finance-reviewer";
export const FINANCE_APPROVER_ACTOR = "finance-approver";
export const FINANCE_VIEWER_ACTOR = "finance-viewer";
export const FINANCE_ACTORS = [FINANCE_REVIEWER_ACTOR, FINANCE_APPROVER_ACTOR, FINANCE_VIEWER_ACTOR] as const;
export type FinanceActor = (typeof FINANCE_ACTORS)[number];

/** The capabilities an actor can hold. Read, export, propose, and approve stay separate. */
export const FINANCE_CAPABILITIES = ["read", "export", "propose", "approve"] as const;
export type FinanceCapability = (typeof FINANCE_CAPABILITIES)[number];

const ACTOR_CAPABILITIES: Readonly<Record<string, readonly FinanceCapability[]>> = {
  [FINANCE_REVIEWER_ACTOR]: ["read", "export", "propose"],
  [FINANCE_APPROVER_ACTOR]: ["read", "export", "approve"],
  [FINANCE_VIEWER_ACTOR]: ["read"],
};

/** The capabilities the source grants an actor string. An unlisted actor holds none. */
export function financeCapabilities(actorRef: string): readonly FinanceCapability[] {
  return ACTOR_CAPABILITIES[actorRef] ?? [];
}

/** What a person may do on this desk. The last row is held by nobody here. */
export const FINANCE_AUTHORITIES = ["read", "export", "propose-correction", "approve-proposal", "change-economic-state"] as const;
export type FinanceAuthority = (typeof FINANCE_AUTHORITIES)[number];

export interface FinanceAuthorityRow {
  authority: FinanceAuthority;
  heldBy: readonly string[];
  /** Whether using the authority changes economic state. Only one row says true. */
  changesEconomicState: boolean;
}

const AUTHORITY_CAPABILITY: Readonly<Record<Exclude<FinanceAuthority, "change-economic-state">, FinanceCapability>> = {
  read: "read",
  export: "export",
  "propose-correction": "propose",
  "approve-proposal": "approve",
};

/**
 * Who holds which authority at the source. An approval is recorded and changes nothing,
 * and the authority to change economic state is held by no desk actor: the ledger moves
 * only when the source posts a later cut.
 */
export function financeAuthorityTable(): readonly FinanceAuthorityRow[] {
  return FINANCE_AUTHORITIES.map((authority) => {
    if (authority === "change-economic-state") {
      return { authority, heldBy: [], changesEconomicState: true };
    }
    const needed = AUTHORITY_CAPABILITY[authority];
    return {
      authority,
      heldBy: FINANCE_ACTORS.filter((actor) => financeCapabilities(actor).includes(needed)),
      changesEconomicState: false,
    };
  });
}

/** Amounts are labelled with this unit. It is a mock unit, not a currency. */
export const FINANCE_UNIT = "mock-unit";

/** The label the page prints where the source sent no figure. */
export const FINANCE_UNDETERMINED = "UNDETERMINED";

/** Quote of the locked hold binding. H1 keeps this consideredAction and keeps it not-bound. */
export const FINANCE_HOLD_NOT_BOUND = PLATFORM_HOLD_NOT_BOUND;

/** Catalogue commands this module records and does not send. Nothing is composed here at all. */
export const FINANCE_NOT_COMPOSED = PLATFORM_NOT_COMPOSED;

/**
 * The source of one cut. Each source has its own ledger and its own position, so
 * figures on different sources are never merged.
 */
export const FINANCE_CUT_SOURCES = ["order-ledger", "payment-observations", "settlement-ledger", "servicing-ledger"] as const;
export type FinanceCutSource = (typeof FINANCE_CUT_SOURCES)[number];

/**
 * Why a case is in the queue. These are the source's own categories: an expected line
 * with no observation, one payment seen twice, a fact that arrived after the cut, a
 * payout split across payees, an amount left unapplied after allocation, and a balance
 * the source says does not match.
 */
export const FINANCE_CATEGORIES = [
  "UNMATCHED",
  "DUPLICATE_OBSERVATION",
  "LATE_FACT",
  "MULTI_PAYEE",
  "RESIDUAL",
  "BALANCE_MISMATCH",
] as const;
export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];

/** Queue state as the source names it. Only the source moves a case to resolved. */
export const FINANCE_CASE_STATES = ["open", "unknown", "resolved-by-source"] as const;
export type FinanceCaseState = (typeof FINANCE_CASE_STATES)[number];

/** The source's own verdict on a case or a balance. The page never derives it. */
export const FINANCE_VERDICTS = ["matched", "mismatch", "unknown"] as const;
export type FinanceVerdict = (typeof FINANCE_VERDICTS)[number];

/** The kind of expected line a case is about. These are the merchant workroom's kinds. */
export const FINANCE_LINE_KINDS = ["sales-observed", "unpaid", "held", "refund-burden"] as const;
export type FinanceLineKind = (typeof FINANCE_LINE_KINDS)[number];

export const FINANCE_FACT_KINDS = [
  "order-observed",
  "payment-observed",
  "payment-observed-again",
  "payout-recorded",
  "allocation-recorded",
  "remainder-recorded",
  "late-arrival",
] as const;
export type FinanceFactKind = (typeof FINANCE_FACT_KINDS)[number];

/** Whether a fact reached the source inside the cut or after it. A late fact is its own fact. */
export const FINANCE_ARRIVALS = ["in-cut", "after-cut"] as const;
export type FinanceArrival = (typeof FINANCE_ARRIVALS)[number];

export const FINANCE_ALLOCATION_KINDS = ["payee-share", "unapplied-remainder"] as const;
export type FinanceAllocationKind = (typeof FINANCE_ALLOCATION_KINDS)[number];

export const FINANCE_PAYEE_ROLES = ["seller", "venue", "platform", "lender"] as const;
export type FinancePayeeRole = (typeof FINANCE_PAYEE_ROLES)[number];

/**
 * What a reviewer may propose. Every one is a proposal. None is applied by the desk, and
 * none forces a ledger to match.
 */
export const FINANCE_CORRECTION_KINDS = [
  "link-observation",
  "mark-duplicate",
  "accept-late-fact",
  "reassign-payee",
  "allocate-remainder",
  "request-source-review",
] as const;
export type FinanceCorrectionKind = (typeof FINANCE_CORRECTION_KINDS)[number];

/** A proposal is pending, or an approval of it was recorded, or the source rejected it. */
export const FINANCE_PROPOSAL_STATES = ["pending", "approval-recorded", "rejected"] as const;
export type FinanceProposalState = (typeof FINANCE_PROPOSAL_STATES)[number];

export const FINANCE_ACTION_KINDS = ["propose-correction", "approve-proposal"] as const;
export type FinanceActionKind = (typeof FINANCE_ACTION_KINDS)[number];

export const FINANCE_SYNTHETIC_CONTROLS = ["revoke-grant", "advance-cut", "post-source-correction"] as const;
export type FinanceSyntheticControl = (typeof FINANCE_SYNTHETIC_CONTROLS)[number];

/**
 * Claims the source states as the literal false, on every read. A missing field counts:
 * the source has to say it, and silence is not a no.
 */
export const FINANCE_NON_CLAIM_FIELDS = [
  "confirmationForcesMatch",
  "proposalChangesEconomicState",
  "approvalChangesEconomicState",
  "payoutExecuted",
  "postedToAccountingSystem",
  "exportIsBookOfRecord",
] as const;
export type FinanceNonClaimField = (typeof FINANCE_NON_CLAIM_FIELDS)[number];
export type FinanceNonClaims = Readonly<Record<FinanceNonClaimField, false>>;

export const FINANCE_SCENARIOS = [
  "clean",
  "empty",
  "stale",
  "stale-totals",
  "totals-mismatch",
  "balance-mismatch",
  "source-cut-skew",
  "dangling-link",
  "proposal-pending",
  "self-approval",
  "claims-forced",
  "scope-leak",
  "denied",
  "read-lost",
  "export-partial",
  "export-stale",
  "export-rows-differ",
  "export-denied",
  "export-claims-real",
  "act-lost",
  "approve-claims-applied",
] as const;
export type FinanceScenario = (typeof FINANCE_SCENARIOS)[number];

export const FINANCE_DENIED_CODES = ["SCOPE_DENIED", "GRANT_REVOKED", "EXPORT_DENIED"] as const;
export type FinanceDeniedCode = (typeof FINANCE_DENIED_CODES)[number];

export const FINANCE_REFUSAL_CODES = ["CLAIM", "AMOUNT", "UNIT", "KIND", "STATE", "REF", "CUT", "SCOPE_LEAK"] as const;
export type FinanceRefusalCode = (typeof FINANCE_REFUSAL_CODES)[number];

export const FINANCE_INVALID_CODES = ["CONTEXT", "ACTOR", "SCOPE", "FLOOR", "ACTION", "REF", "TEXT"] as const;
export type FinanceInvalidCode = (typeof FINANCE_INVALID_CODES)[number];

export const FINANCE_REJECTION_CODES = [
  "NO_CAPABILITY",
  "SELF_APPROVAL",
  "UNKNOWN_CASE",
  "NOT_OFFERED",
  "CASE_RESOLVED",
  "UNKNOWN_PROPOSAL",
  "NOT_PENDING",
  "DUPLICATE_PENDING",
] as const;
export type FinanceRejectionCode = (typeof FINANCE_REJECTION_CODES)[number];

// ---------------------------------------------------------------------------
// Identity. Each kind has its own prefix and one kind is never read as another.
// The trade, merchant-line, and payment kinds are links into the sibling synthetic
// sources (the merchant workroom and the credit servicing desk) and share their
// prefixes on purpose.
// ---------------------------------------------------------------------------

export const FINANCE_REF_KINDS = [
  "book",
  "case",
  "fact",
  "payee",
  "allocation",
  "trade",
  "merchant-line",
  "payment",
  "cut",
  "export",
  "proposal",
  "balance",
] as const;
export type FinanceRefKind = (typeof FINANCE_REF_KINDS)[number];

const REF_PREFIX: Readonly<Record<FinanceRefKind, string>> = {
  book: "bok-",
  case: "rcs-",
  fact: "fct-",
  payee: "pye-",
  allocation: "fal-",
  trade: "trd-",
  "merchant-line": "obl-",
  payment: "pmt-",
  cut: "cut-",
  export: "fex-",
  proposal: "prp-",
  balance: "bal-",
};

const REF_PATTERN = /^(bok|rcs|fct|pye|fal|trd|obl|pmt|cut|fex|prp|bal)-[0-9]{4}$/;

export function financeRefFor(kind: FinanceRefKind, serial: number): string {
  return `${REF_PREFIX[kind]}${String(serial).padStart(4, "0")}`;
}

export function financeRefKind(ref: string): FinanceRefKind | null {
  if (!REF_PATTERN.test(ref)) {
    return null;
  }
  for (const kind of FINANCE_REF_KINDS) {
    if (ref.startsWith(REF_PREFIX[kind])) {
      return kind;
    }
  }
  return null;
}

export function isFinanceRef(ref: unknown, kind: FinanceRefKind): ref is string {
  return typeof ref === "string" && financeRefKind(ref) === kind;
}

/** A whole-unit amount: digits only, no sign, no leading zero, at most twelve digits. */
const AMOUNT_PATTERN = /^(0|[1-9][0-9]{0,11})$/;

export function isFinanceAmount(value: unknown): value is string {
  return typeof value === "string" && AMOUNT_PATTERN.test(value);
}

/** An optional amount is a whole-unit string, or null where the source sent no figure. */
function isOptionalAmount(value: unknown): boolean {
  return value === null || isFinanceAmount(value);
}

/** A cut position is a whole generation number and a watermark that is an instant. */
function isCutPosition(cut: { generation: unknown; watermark: unknown }): boolean {
  return (
    typeof cut.generation === "number" &&
    Number.isInteger(cut.generation) &&
    cut.generation >= 0 &&
    typeof cut.watermark === "string" &&
    !Number.isNaN(Date.parse(cut.watermark))
  );
}

// ---------------------------------------------------------------------------
// Read model shapes
// ---------------------------------------------------------------------------

export interface FinanceScope {
  tenantId: string;
  /** The book whose rows are requested. A grant is checked against it. */
  bookRef: string;
}

/**
 * A source cut: the position one source was read at. Two figures are comparable only
 * when they name the same cut. A cut is not a commit position and not a settlement date.
 */
export interface FinanceCut {
  cutRef: string;
  source: FinanceCutSource;
  generation: number;
  watermark: string;
}

interface FinanceRowBase {
  bookRef: string;
  cutRef: string;
}

/** The original trade a case links to, as the merchant workroom lists it. */
export interface FinanceOriginalTrade extends FinanceRowBase {
  tradeRef: string;
  listingRef: string;
  eventRef: string;
  /** An observation label. It says nothing about settlement. */
  statusLabel: "booked" | "payment-observed" | "right-moved" | "payment-unknown";
}

/**
 * One reconciliation case. The amounts, the verdict, and the reason are the source's own
 * text. The case links to its original trade, and optionally to the merchant money line
 * and to the credit servicing payment it concerns.
 */
export interface FinanceCase extends FinanceRowBase {
  caseRef: string;
  category: FinanceCategory;
  state: FinanceCaseState;
  /** The original trade this case is about. It is the link back to the transaction. */
  tradeRef: string;
  /** The merchant workroom's money line for the expected side, or null. */
  merchantLineRef: string | null;
  /** The credit servicing payment this case concerns, or null. */
  paymentRef: string | null;
  lineKind: FinanceLineKind;
  /** The cut the observed side was looked up on, or null when the source names none. */
  observedCutRef: string | null;
  expectedAmount: string | null;
  observedAmount: string | null;
  /** The source's own difference text. The page never computes it. */
  differenceAmount: string | null;
  unit: typeof FINANCE_UNIT;
  verdict: FinanceVerdict;
  /** The source's own reason for the case, or null. */
  reasonCode: string | null;
  /** The corrections the source offers on this case. The page offers no other. */
  offeredCorrections: readonly FinanceCorrectionKind[];
}

/** One fact the source holds about a case. A late fact is flagged and never folded into its cut. */
export interface FinanceFact extends FinanceRowBase {
  factRef: string;
  caseRef: string;
  kind: FinanceFactKind;
  arrival: FinanceArrival;
  amount: string | null;
  unit: typeof FINANCE_UNIT;
  payeeRef: string | null;
  label: string;
}

/** A payee share or an unapplied remainder of a case, as the source allocated it. */
export interface FinanceAllocation extends FinanceRowBase {
  allocationRef: string;
  caseRef: string;
  kind: FinanceAllocationKind;
  payeeRef: string | null;
  role: FinancePayeeRole | null;
  amount: string;
  unit: typeof FINANCE_UNIT;
}

/** The source's own figure for one category on one cut. The client never recomputes it. */
export interface FinanceTotalRow {
  category: FinanceCategory;
  cutRef: string;
  /** The cut generation this figure was built at. */
  generation: number;
  caseCount: number;
  /** The source's total text, or null where the source states none. */
  amount: string | null;
  unit: typeof FINANCE_UNIT;
}

/** The source's own comparison of two sources. The verdict and the difference are its text. */
export interface FinanceBalanceRow {
  bookRef: string;
  balanceRef: string;
  label: string;
  leftCutRef: string;
  rightCutRef: string;
  leftAmount: string;
  rightAmount: string;
  differenceAmount: string;
  unit: typeof FINANCE_UNIT;
  verdict: FinanceVerdict;
}

/** A correction proposal. Pending is not applied, and an approval is a record and not a change. */
export interface FinanceProposal extends FinanceRowBase {
  proposalRef: string;
  caseRef: string;
  correction: FinanceCorrectionKind;
  note: string;
  proposedBy: string;
  state: FinanceProposalState;
  /** The source never claims a proposal changed economic state. */
  economicStateChanged: false;
}

export interface FinanceSnapshot {
  /** Read serial on this port. It orders reads and is not a commit position. */
  snapshotId: number;
  watermark: string;
  scenario: FinanceScenario;
  scope: FinanceScope;
  cuts: readonly FinanceCut[];
  originals: readonly FinanceOriginalTrade[];
  cases: readonly FinanceCase[];
  facts: readonly FinanceFact[];
  allocations: readonly FinanceAllocation[];
  totals: readonly FinanceTotalRow[];
  balances: readonly FinanceBalanceRow[];
  proposals: readonly FinanceProposal[];
  /** The literal false for each claim field, or the whole payload is refused. */
  nonClaims: FinanceNonClaims;
}

export type FinanceExportEntryKind = "case" | FinanceAllocationKind;

export interface FinanceExportRow {
  entryRef: string;
  entryKind: FinanceExportEntryKind;
  caseRef: string;
  payeeRef: string | null;
  category: FinanceCategory;
  /** The source's text for the entry, or null where the source sent none. */
  amount: string | null;
  unit: typeof FINANCE_UNIT;
  cutRef: string;
}

/**
 * What the export says about its own scope. It is a synthetic file: no real money, not
 * posted to an accounting system, and not a book of record. A producer that says
 * otherwise is refused before a row is returned.
 */
export interface FinanceExportScope {
  provenance: "synthetic";
  realMoney: false;
  postedToAccountingSystem: false;
  bookOfRecord: false;
  target: "none";
}

/** A producer export. The client compares it with the last read and never repairs it. */
export interface FinanceExport {
  exportRef: string;
  scope: FinanceScope;
  /** The cut set the export was taken at: one cut per source it lists. */
  cuts: readonly FinanceCut[];
  /** Row count the producer declared. A different number of rows is a partial export. */
  declaredRowCount: number;
  /** False when the producer says the export was cut off. */
  complete: boolean;
  /** Opaque producer text. No digest rule is published, so the client does not verify it. */
  digest: string | null;
  scopeDeclaration: FinanceExportScope;
  rows: readonly FinanceExportRow[];
}

export interface FinanceReadRequest {
  contextKey: string;
  actorRef: string;
  scope: FinanceScope;
  watermarkFloor: string | null;
}

export interface FinanceExportRequest {
  contextKey: string;
  actorRef: string;
  scope: FinanceScope;
}

export type FinanceActionRequest =
  | { kind: "propose-correction"; caseRef: string; correction: FinanceCorrectionKind; note: string }
  | { kind: "approve-proposal"; proposalRef: string };

export interface FinanceActRequest {
  contextKey: string;
  actorRef: string;
  scope: FinanceScope;
  action: FinanceActionRequest;
}

/**
 * What the source answers to a request. A recorded proposal and a recorded approval both
 * say that economic state did not change and that nothing was forced to match.
 */
export interface FinanceReceipt {
  kind: "proposal-recorded" | "approval-recorded";
  proposalRef: string;
  caseRef: string;
  economicStateChanged: false;
  confirmationForcesMatch: false;
}

export type FinanceTupleChanged = { kind: "tuple-changed"; field: string; expected: string; actual: string };

export type FinanceDenied = { kind: "denied"; code: FinanceDeniedCode; bookRef: string; detail: string };

export type FinanceRefused = { kind: "refused"; code: FinanceRefusalCode; field: string; ref: string | null; detail: string };

export type FinanceInvalid = { kind: "invalid-request"; code: FinanceInvalidCode; detail: string };

export type FinanceReadOutcome =
  | { kind: "ready"; snapshot: FinanceSnapshot }
  | { kind: "empty"; watermark: string; snapshotId: number; scope: FinanceScope }
  | { kind: "stale"; watermark: string; floor: string }
  | FinanceDenied
  | FinanceRefused
  | FinanceInvalid
  | FinanceTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export type FinanceExportOutcome =
  | { kind: "ready"; export: FinanceExport }
  | FinanceDenied
  | FinanceRefused
  | FinanceInvalid
  | FinanceTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export type FinanceActOutcome =
  | { kind: "applied"; receipt: FinanceReceipt }
  | { kind: "rejected"; code: FinanceRejectionCode; detail: string }
  | FinanceDenied
  | FinanceRefused
  | FinanceInvalid
  | FinanceTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export interface FinanceOperationsPort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic-finance" | "none";
  readonly scenario: FinanceScenario;
  read(request: FinanceReadRequest): Promise<FinanceReadOutcome>;
  readExport(request: FinanceExportRequest): Promise<FinanceExportOutcome>;
  act(request: FinanceActRequest): Promise<FinanceActOutcome>;
  /**
   * Synthetic control: moves the source itself. A real producer offers none of them.
   * Returns false when there is no source to move or nothing for the control to act on.
   */
  synthetic(control: FinanceSyntheticControl): boolean;
}

export interface StubFinanceOperationsOptions {
  scenario?: FinanceScenario;
  /** Expected tuple override. Used to stage a producer change in tests. */
  expectedTuple?: DiscoveryReadTuple;
}

export interface FinanceEffectCounts {
  reads: number;
  exports: number;
  acts: number;
}

export function createStubFinanceOperations(options: StubFinanceOperationsOptions = {}): StubFinanceOperations {
  return new StubFinanceOperations(options);
}

export function createNotBoundFinanceOperations(): FinanceOperationsPort {
  const outcome = { kind: "not-bound", reason: FINANCE_NOT_BOUND_REASON } as const;
  return {
    environment: "integration-http",
    source: "none",
    scenario: "clean",
    read() {
      return Promise.resolve({ ...outcome });
    },
    readExport() {
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

export function financeOperationsPortFor(
  environment: "stub" | "integration-http",
  options: StubFinanceOperationsOptions = {},
): FinanceOperationsPort {
  if (environment === "stub") {
    return createStubFinanceOperations(options);
  }
  return createNotBoundFinanceOperations();
}

// ---------------------------------------------------------------------------
// Pure checks. The port uses them before it returns a row, and the controller and
// the screen use them to say what a snapshot can and cannot support.
// ---------------------------------------------------------------------------

/**
 * The first claim field that is not the literal false. A missing field counts: the
 * source has to say it, and silence is not a no.
 */
export function findFinanceClaim(nonClaims: unknown): FinanceNonClaimField | null {
  const record = (typeof nonClaims === "object" && nonClaims !== null ? nonClaims : {}) as Record<string, unknown>;
  for (const field of FINANCE_NON_CLAIM_FIELDS) {
    if (record[field] !== false) {
      return field;
    }
  }
  return null;
}

function refuse(code: FinanceRefusalCode, field: string, ref: string | null, detail: string): FinanceRefused {
  return { kind: "refused", code, field, ref, detail };
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/**
 * Checks a payload the source returned before any row is shown. A failure means the
 * payload cannot be trusted as a whole, so the port returns no row from it.
 */
export function refuseFinanceSnapshot(snapshot: FinanceSnapshot): FinanceRefused | null {
  const claim = findFinanceClaim(snapshot.nonClaims);
  if (claim !== null) {
    return refuse(
      "CLAIM",
      claim,
      null,
      `The payload does not state ${claim} as false. A confirmation never forces a match, a proposal or an approval never changes economic state, and nothing here pays out or posts to an accounting system.`,
    );
  }
  const cutRefs = new Set<string>();
  for (const cut of snapshot.cuts) {
    if (!isFinanceRef(cut.cutRef, "cut")) {
      return refuse("REF", "cutRef", String(cut.cutRef), `Cut reference ${String(cut.cutRef)} is not a cut reference.`);
    }
    if (!includes(FINANCE_CUT_SOURCES, cut.source)) {
      return refuse("KIND", "source", cut.cutRef, `Cut ${cut.cutRef} names source ${String(cut.source)}.`);
    }
    if (!isCutPosition(cut)) {
      return refuse("CUT", "generation", cut.cutRef, `Cut ${cut.cutRef} does not state a whole generation and a watermark that is an instant.`);
    }
    cutRefs.add(cut.cutRef);
  }
  const rows: { ref: string; kind: FinanceRefKind; row: FinanceRowBase }[] = [
    ...snapshot.originals.map((row) => ({ ref: row.tradeRef, kind: "trade" as const, row })),
    ...snapshot.cases.map((row) => ({ ref: row.caseRef, kind: "case" as const, row })),
    ...snapshot.facts.map((row) => ({ ref: row.factRef, kind: "fact" as const, row })),
    ...snapshot.allocations.map((row) => ({ ref: row.allocationRef, kind: "allocation" as const, row })),
    ...snapshot.proposals.map((row) => ({ ref: row.proposalRef, kind: "proposal" as const, row })),
  ];
  for (const { ref, kind, row } of rows) {
    if (!isFinanceRef(ref, kind)) {
      return refuse("REF", `${kind}Ref`, String(ref), `Reference ${String(ref)} is not a ${kind} reference.`);
    }
    if (row.bookRef !== snapshot.scope.bookRef) {
      return refuse("SCOPE_LEAK", "bookRef", ref, `Row ${ref} belongs to ${String(row.bookRef)}, not to the requested scope.`);
    }
    if (!cutRefs.has(row.cutRef)) {
      return refuse("CUT", "cutRef", ref, `Row ${ref} names cut ${String(row.cutRef)}, which the snapshot does not list.`);
    }
  }
  for (const row of snapshot.cases) {
    const refused = refuseCase(row, cutRefs);
    if (refused !== null) {
      return refused;
    }
  }
  for (const row of snapshot.facts) {
    if (!includes(FINANCE_FACT_KINDS, row.kind)) {
      return refuse("KIND", "kind", row.factRef, `Fact ${row.factRef} has kind ${String(row.kind)}.`);
    }
    if (!includes(FINANCE_ARRIVALS, row.arrival)) {
      return refuse("STATE", "arrival", row.factRef, `Fact ${row.factRef} has arrival ${String(row.arrival)}.`);
    }
    if (!isFinanceRef(row.caseRef, "case") || (row.payeeRef !== null && !isFinanceRef(row.payeeRef, "payee"))) {
      return refuse("REF", "caseRef", row.factRef, `Fact ${row.factRef} names a reference of the wrong kind.`);
    }
    const bad = badFigure(row.factRef, "fact", row.amount, row.unit);
    if (bad !== null) {
      return bad;
    }
  }
  for (const row of snapshot.allocations) {
    if (!includes(FINANCE_ALLOCATION_KINDS, row.kind)) {
      return refuse("KIND", "kind", row.allocationRef, `Allocation ${row.allocationRef} has kind ${String(row.kind)}.`);
    }
    if (row.role !== null && !includes(FINANCE_PAYEE_ROLES, row.role)) {
      return refuse("KIND", "role", row.allocationRef, `Allocation ${row.allocationRef} has role ${String(row.role)}.`);
    }
    if (!isFinanceRef(row.caseRef, "case") || (row.payeeRef !== null && !isFinanceRef(row.payeeRef, "payee"))) {
      return refuse("REF", "caseRef", row.allocationRef, `Allocation ${row.allocationRef} names a reference of the wrong kind.`);
    }
    if (!isFinanceAmount(row.amount)) {
      return refuse("AMOUNT", "amount", row.allocationRef, `Allocation ${row.allocationRef} amount is not a whole-unit string, so it is not shown.`);
    }
    if (row.unit !== FINANCE_UNIT) {
      return refuse("UNIT", "unit", row.allocationRef, `Allocation ${row.allocationRef} names unit ${String(row.unit)}, not ${FINANCE_UNIT}.`);
    }
  }
  for (const row of snapshot.totals) {
    const label = `${row.category}@${row.cutRef}`;
    if (!includes(FINANCE_CATEGORIES, row.category)) {
      return refuse("KIND", "category", label, `Total category ${String(row.category)} is not a case category.`);
    }
    const bad = badFigure(label, "total", row.amount, row.unit);
    if (bad !== null) {
      return bad;
    }
  }
  for (const row of snapshot.balances) {
    const refused = refuseBalance(row, snapshot.scope, cutRefs);
    if (refused !== null) {
      return refused;
    }
  }
  for (const row of snapshot.proposals) {
    if (!includes(FINANCE_CORRECTION_KINDS, row.correction)) {
      return refuse("KIND", "correction", row.proposalRef, `Proposal ${row.proposalRef} has correction ${String(row.correction)}.`);
    }
    if (!includes(FINANCE_PROPOSAL_STATES, row.state)) {
      return refuse("STATE", "state", row.proposalRef, `Proposal ${row.proposalRef} has state ${String(row.state)}.`);
    }
    if (!isFinanceRef(row.caseRef, "case")) {
      return refuse("REF", "caseRef", row.proposalRef, `Proposal ${row.proposalRef} names a reference of the wrong kind.`);
    }
    if (row.economicStateChanged !== false) {
      return refuse("CLAIM", "economicStateChanged", row.proposalRef, `Proposal ${row.proposalRef} does not state economicStateChanged as false.`);
    }
  }
  return null;
}

function badFigure(ref: string, noun: string, amount: unknown, unit: unknown): FinanceRefused | null {
  if (!isOptionalAmount(amount)) {
    return refuse("AMOUNT", "amount", ref, `${noun} ${ref} amount is not a whole-unit string, so it is not shown.`);
  }
  if (unit !== FINANCE_UNIT) {
    return refuse("UNIT", "unit", ref, `${noun} ${ref} names unit ${String(unit)}, not ${FINANCE_UNIT}.`);
  }
  return null;
}

function refuseCase(row: FinanceCase, cutRefs: ReadonlySet<string>): FinanceRefused | null {
  if (!includes(FINANCE_CATEGORIES, row.category)) {
    return refuse("KIND", "category", row.caseRef, `Case ${row.caseRef} has category ${String(row.category)}.`);
  }
  if (!includes(FINANCE_CASE_STATES, row.state)) {
    return refuse("STATE", "state", row.caseRef, `Case ${row.caseRef} has state ${String(row.state)}.`);
  }
  if (!includes(FINANCE_VERDICTS, row.verdict)) {
    return refuse("STATE", "verdict", row.caseRef, `Case ${row.caseRef} has verdict ${String(row.verdict)}.`);
  }
  if (!includes(FINANCE_LINE_KINDS, row.lineKind)) {
    return refuse("KIND", "lineKind", row.caseRef, `Case ${row.caseRef} has line kind ${String(row.lineKind)}.`);
  }
  if (
    !isFinanceRef(row.tradeRef, "trade") ||
    (row.merchantLineRef !== null && !isFinanceRef(row.merchantLineRef, "merchant-line")) ||
    (row.paymentRef !== null && !isFinanceRef(row.paymentRef, "payment"))
  ) {
    return refuse("REF", "tradeRef", row.caseRef, `Case ${row.caseRef} names a link reference of the wrong kind.`);
  }
  if (row.observedCutRef !== null && !cutRefs.has(row.observedCutRef)) {
    return refuse("CUT", "observedCutRef", row.caseRef, `Case ${row.caseRef} names observed cut ${String(row.observedCutRef)}, which the snapshot does not list.`);
  }
  for (const [field, value] of [
    ["expectedAmount", row.expectedAmount],
    ["observedAmount", row.observedAmount],
    ["differenceAmount", row.differenceAmount],
  ] as const) {
    if (!isOptionalAmount(value)) {
      return refuse("AMOUNT", field, row.caseRef, `Case ${row.caseRef} ${field} is not a whole-unit string, so it is not shown.`);
    }
  }
  if (row.unit !== FINANCE_UNIT) {
    return refuse("UNIT", "unit", row.caseRef, `Case ${row.caseRef} names unit ${String(row.unit)}, not ${FINANCE_UNIT}.`);
  }
  for (const correction of row.offeredCorrections) {
    if (!includes(FINANCE_CORRECTION_KINDS, correction)) {
      return refuse("KIND", "offeredCorrections", row.caseRef, `Case ${row.caseRef} offers correction ${String(correction)}.`);
    }
  }
  return null;
}

function refuseBalance(row: FinanceBalanceRow, scope: FinanceScope, cutRefs: ReadonlySet<string>): FinanceRefused | null {
  if (!isFinanceRef(row.balanceRef, "balance")) {
    return refuse("REF", "balanceRef", String(row.balanceRef), `Reference ${String(row.balanceRef)} is not a balance reference.`);
  }
  if (row.bookRef !== scope.bookRef) {
    return refuse("SCOPE_LEAK", "bookRef", row.balanceRef, `Balance ${row.balanceRef} belongs to ${String(row.bookRef)}, not to the requested scope.`);
  }
  if (!cutRefs.has(row.leftCutRef) || !cutRefs.has(row.rightCutRef)) {
    return refuse("CUT", "cutRef", row.balanceRef, `Balance ${row.balanceRef} names a cut the snapshot does not list.`);
  }
  if (!includes(FINANCE_VERDICTS, row.verdict)) {
    return refuse("STATE", "verdict", row.balanceRef, `Balance ${row.balanceRef} has verdict ${String(row.verdict)}.`);
  }
  for (const [field, value] of [
    ["leftAmount", row.leftAmount],
    ["rightAmount", row.rightAmount],
    ["differenceAmount", row.differenceAmount],
  ] as const) {
    if (!isFinanceAmount(value)) {
      return refuse("AMOUNT", field, row.balanceRef, `Balance ${row.balanceRef} ${field} is not a whole-unit string, so it is not shown.`);
    }
  }
  if (row.unit !== FINANCE_UNIT) {
    return refuse("UNIT", "unit", row.balanceRef, `Balance ${row.balanceRef} names unit ${String(row.unit)}, not ${FINANCE_UNIT}.`);
  }
  return null;
}

/** Checks an export payload before it is returned. Consistency with a read is judged later. */
export function refuseFinanceExport(exported: FinanceExport, requested: FinanceScope): FinanceRefused | null {
  if (!isFinanceRef(exported.exportRef, "export")) {
    return refuse("REF", "exportRef", String(exported.exportRef), `Reference ${String(exported.exportRef)} is not an export reference.`);
  }
  if (exported.scope.bookRef !== requested.bookRef || exported.scope.tenantId !== requested.tenantId) {
    return refuse("SCOPE_LEAK", "scope", exported.exportRef, "The export names a scope other than the one requested.");
  }
  const declaration = (exported.scopeDeclaration ?? {}) as unknown as Record<string, unknown>;
  if (declaration.provenance !== "synthetic") {
    return refuse("CLAIM", "provenance", exported.exportRef, "The export does not declare itself synthetic. This desk shows no export of unknown provenance.");
  }
  for (const field of ["realMoney", "postedToAccountingSystem", "bookOfRecord"] as const) {
    if (declaration[field] !== false) {
      return refuse("CLAIM", field, exported.exportRef, `The export does not state ${field} as false. A synthetic export is no real-money record, is not posted to an accounting system, and is not a book of record.`);
    }
  }
  if (declaration.target !== "none") {
    return refuse("CLAIM", "target", exported.exportRef, "The export names an accounting target. This desk exports to none.");
  }
  const cutRefs = new Set<string>();
  for (const cut of exported.cuts) {
    if (!isFinanceRef(cut.cutRef, "cut")) {
      return refuse("REF", "cutRef", String(cut.cutRef), `Reference ${String(cut.cutRef)} is not a cut reference.`);
    }
    if (!includes(FINANCE_CUT_SOURCES, cut.source)) {
      return refuse("KIND", "source", cut.cutRef, `Cut ${cut.cutRef} names source ${String(cut.source)}.`);
    }
    if (!isCutPosition(cut)) {
      return refuse("CUT", "generation", cut.cutRef, `Cut ${cut.cutRef} does not state a whole generation and a watermark that is an instant.`);
    }
    cutRefs.add(cut.cutRef);
  }
  for (const row of exported.rows) {
    const entryKind: FinanceRefKind = row.entryKind === "case" ? "case" : "allocation";
    if (!includes(["case", ...FINANCE_ALLOCATION_KINDS], row.entryKind)) {
      return refuse("KIND", "entryKind", String(row.entryRef), `Export row ${String(row.entryRef)} has entry kind ${String(row.entryKind)}.`);
    }
    if (!isFinanceRef(row.entryRef, entryKind)) {
      return refuse("REF", "entryRef", String(row.entryRef), `Reference ${String(row.entryRef)} is not a ${entryKind} reference.`);
    }
    if (!includes(FINANCE_CATEGORIES, row.category)) {
      return refuse("KIND", "category", row.entryRef, `Export row ${row.entryRef} has category ${String(row.category)}.`);
    }
    if (!isOptionalAmount(row.amount)) {
      return refuse("AMOUNT", "amount", row.entryRef, `Export row ${row.entryRef} amount is not a whole-unit string, so it is not shown.`);
    }
    if (row.unit !== FINANCE_UNIT) {
      return refuse("UNIT", "unit", row.entryRef, `Export row ${row.entryRef} names unit ${String(row.unit)}, not ${FINANCE_UNIT}.`);
    }
  }
  return null;
}

/** Whether a receipt may be trusted. The source says nothing changed, or the answer is refused. */
export function refuseFinanceReceipt(receipt: FinanceReceipt, request: FinanceActionRequest): FinanceRefused | null {
  const record = receipt as unknown as Record<string, unknown>;
  for (const field of ["economicStateChanged", "confirmationForcesMatch"] as const) {
    if (record[field] !== false) {
      return refuse("CLAIM", field, null, `The answer does not state ${field} as false. A recorded proposal or approval changes no economic state and forces no match.`);
    }
  }
  const expectedKind = request.kind === "propose-correction" ? "proposal-recorded" : "approval-recorded";
  if (receipt.kind !== expectedKind) {
    return refuse("STATE", "kind", receipt.proposalRef, `The answer is ${String(receipt.kind)}, and the request was ${request.kind}.`);
  }
  if (!isFinanceRef(receipt.proposalRef, "proposal") || !isFinanceRef(receipt.caseRef, "case")) {
    return refuse("REF", "proposalRef", String(receipt.proposalRef), "The answer names a reference of the wrong kind.");
  }
  if (request.kind === "approve-proposal" && receipt.proposalRef !== request.proposalRef) {
    return refuse("REF", "proposalRef", receipt.proposalRef, `The answer names proposal ${receipt.proposalRef}, and the request named ${request.proposalRef}.`);
  }
  if (request.kind === "propose-correction" && receipt.caseRef !== request.caseRef) {
    return refuse("REF", "caseRef", receipt.caseRef, `The answer names case ${receipt.caseRef}, and the request named ${request.caseRef}.`);
  }
  return null;
}

export type FinanceTotalFlagCode = "STALE_GENERATION" | "COUNT_DIFFERS" | "MISSING" | "UNKNOWN_CUT";

export interface FinanceTotalFlag {
  code: FinanceTotalFlagCode;
  category: FinanceCategory;
  cutRef: string;
  detail: string;
}

export interface FinanceUnlinked {
  lens: "cases" | "facts" | "allocations" | "proposals";
  ref: string;
  missing: "trade" | "case";
  missingRef: string;
}

/** A case or a balance whose two sides sit on cuts at different positions. */
export interface FinanceSkew {
  kind: "case" | "balance";
  ref: string;
  leftCutRef: string;
  rightCutRef: string;
}

export type FinanceContradictionCode = "MATCHED_WITH_DIFFERENCE" | "MISMATCH_WITHOUT_DIFFERENCE";

/** A verdict that the source's own difference text contradicts. Neither is trusted over the other. */
export interface FinanceContradiction {
  kind: "case" | "balance";
  ref: string;
  code: FinanceContradictionCode;
  detail: string;
}

export interface FinanceAssessment {
  /** none: no row names a cut. aligned: the cuts used share one watermark. skewed: they do not. */
  cutAlignment: "none" | "aligned" | "skewed";
  /** Cuts that rows actually name, in the order the snapshot lists them. */
  usedCuts: readonly FinanceCut[];
  totals: { state: "current" | "stale" | "mismatch"; flags: readonly FinanceTotalFlag[] };
  unlinked: readonly FinanceUnlinked[];
  skew: readonly FinanceSkew[];
  contradictions: readonly FinanceContradiction[];
  /** Case labels by the source's state. They are counts of rows, not amounts. */
  queue: { open: number; unknown: number; resolvedBySource: number };
  /** Facts that reached the source after the cut they name. */
  lateFacts: readonly string[];
}

function contradictionOf(
  kind: "case" | "balance",
  ref: string,
  verdict: FinanceVerdict,
  difference: string | null,
): FinanceContradiction | null {
  // Text equality only. The source's difference text is compared with the literal "0".
  if (verdict === "matched" && difference !== null && difference !== "0") {
    return {
      kind,
      ref,
      code: "MATCHED_WITH_DIFFERENCE",
      detail: `${ref} is stated matched, and the source's own difference text is ${difference}. Neither is trusted over the other, and ${ref} is not shown as reconciled.`,
    };
  }
  if (verdict === "mismatch" && difference === "0") {
    return {
      kind,
      ref,
      code: "MISMATCH_WITHOUT_DIFFERENCE",
      detail: `${ref} is stated mismatch, and the source's own difference text is 0. Neither is trusted over the other.`,
    };
  }
  return null;
}

/**
 * What a snapshot can support. This names inconsistencies and compares labels: cut
 * references, generations, watermarks, counts, and the source's own text. It adds no
 * amount and orders no amount.
 */
export function assessFinanceSnapshot(snapshot: FinanceSnapshot): FinanceAssessment {
  const named = new Set<string>();
  for (const row of [...snapshot.originals, ...snapshot.cases, ...snapshot.facts, ...snapshot.allocations, ...snapshot.proposals]) {
    named.add(row.cutRef);
  }
  for (const row of snapshot.cases) {
    if (row.observedCutRef !== null) {
      named.add(row.observedCutRef);
    }
  }
  for (const row of snapshot.balances) {
    named.add(row.leftCutRef);
    named.add(row.rightCutRef);
  }
  const usedCuts = snapshot.cuts.filter((cut) => named.has(cut.cutRef));
  const watermarks = new Set(usedCuts.map((cut) => cut.watermark));
  const cutAlignment = usedCuts.length === 0 ? "none" : watermarks.size === 1 ? "aligned" : "skewed";

  const cutByRef = new Map(snapshot.cuts.map((cut) => [cut.cutRef, cut]));
  const flags: FinanceTotalFlag[] = [];
  const covered = new Set<string>();
  for (const row of snapshot.totals) {
    covered.add(`${row.category}|${row.cutRef}`);
    const cut = cutByRef.get(row.cutRef);
    if (cut === undefined) {
      flags.push({ code: "UNKNOWN_CUT", category: row.category, cutRef: row.cutRef, detail: `The total names cut ${row.cutRef}, which the snapshot does not list.` });
      continue;
    }
    if (row.generation !== cut.generation) {
      flags.push({
        code: "STALE_GENERATION",
        category: row.category,
        cutRef: row.cutRef,
        detail: `The total was built at generation ${row.generation}, and cut ${row.cutRef} is at generation ${cut.generation}.`,
      });
    }
    const counted = snapshot.cases.filter((item) => item.category === row.category && item.cutRef === row.cutRef).length;
    if (counted !== row.caseCount) {
      flags.push({
        code: "COUNT_DIFFERS",
        category: row.category,
        cutRef: row.cutRef,
        detail: `The total counts ${row.caseCount} ${row.category} cases on cut ${row.cutRef}, and the read lists ${counted}.`,
      });
    }
  }
  for (const item of snapshot.cases) {
    const key = `${item.category}|${item.cutRef}`;
    if (!covered.has(key)) {
      covered.add(key);
      flags.push({
        code: "MISSING",
        category: item.category,
        cutRef: item.cutRef,
        detail: `The read lists ${item.category} cases on cut ${item.cutRef} and the source sent no total for them.`,
      });
    }
  }
  const totalState = flags.some((flag) => flag.code === "STALE_GENERATION") ? "stale" : flags.length > 0 ? "mismatch" : "current";

  const trades = new Set(snapshot.originals.map((row) => row.tradeRef));
  const cases = new Set(snapshot.cases.map((row) => row.caseRef));
  const unlinked: FinanceUnlinked[] = [];
  for (const row of snapshot.cases) {
    if (!trades.has(row.tradeRef)) {
      unlinked.push({ lens: "cases", ref: row.caseRef, missing: "trade", missingRef: row.tradeRef });
    }
  }
  for (const row of snapshot.facts) {
    if (!cases.has(row.caseRef)) {
      unlinked.push({ lens: "facts", ref: row.factRef, missing: "case", missingRef: row.caseRef });
    }
  }
  for (const row of snapshot.allocations) {
    if (!cases.has(row.caseRef)) {
      unlinked.push({ lens: "allocations", ref: row.allocationRef, missing: "case", missingRef: row.caseRef });
    }
  }
  for (const row of snapshot.proposals) {
    if (!cases.has(row.caseRef)) {
      unlinked.push({ lens: "proposals", ref: row.proposalRef, missing: "case", missingRef: row.caseRef });
    }
  }

  const skew: FinanceSkew[] = [];
  const contradictions: FinanceContradiction[] = [];
  const sameInstant = (left: string, right: string): boolean => {
    const a = cutByRef.get(left);
    const b = cutByRef.get(right);
    return a !== undefined && b !== undefined && a.watermark === b.watermark;
  };
  for (const row of snapshot.cases) {
    if (row.observedCutRef !== null && !sameInstant(row.cutRef, row.observedCutRef)) {
      skew.push({ kind: "case", ref: row.caseRef, leftCutRef: row.cutRef, rightCutRef: row.observedCutRef });
    }
    const found = contradictionOf("case", row.caseRef, row.verdict, row.differenceAmount);
    if (found !== null) {
      contradictions.push(found);
    }
  }
  for (const row of snapshot.balances) {
    if (!sameInstant(row.leftCutRef, row.rightCutRef)) {
      skew.push({ kind: "balance", ref: row.balanceRef, leftCutRef: row.leftCutRef, rightCutRef: row.rightCutRef });
    }
    const found = contradictionOf("balance", row.balanceRef, row.verdict, row.differenceAmount);
    if (found !== null) {
      contradictions.push(found);
    }
  }

  return {
    cutAlignment,
    usedCuts,
    totals: { state: totalState, flags },
    unlinked,
    skew,
    contradictions,
    queue: {
      open: snapshot.cases.filter((row) => row.state === "open").length,
      unknown: snapshot.cases.filter((row) => row.state === "unknown").length,
      resolvedBySource: snapshot.cases.filter((row) => row.state === "resolved-by-source").length,
    },
    lateFacts: snapshot.facts.filter((row) => row.arrival === "after-cut").map((row) => row.factRef),
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * The rows an export of this read lists: one per case and one per allocation. This copies
 * fields. It sums nothing, so no client total exists.
 */
export function financeExportRowsFor(snapshot: FinanceSnapshot): FinanceExportRow[] {
  const categoryOf = new Map(snapshot.cases.map((row) => [row.caseRef, row.category]));
  const rows: FinanceExportRow[] = snapshot.cases.map((row) => ({
    entryRef: row.caseRef,
    entryKind: "case",
    caseRef: row.caseRef,
    payeeRef: null,
    category: row.category,
    amount: row.differenceAmount,
    unit: row.unit,
    cutRef: row.cutRef,
  }));
  for (const row of snapshot.allocations) {
    const category = categoryOf.get(row.caseRef);
    if (category === undefined) {
      continue;
    }
    rows.push({
      entryRef: row.allocationRef,
      entryKind: row.kind,
      caseRef: row.caseRef,
      payeeRef: row.payeeRef,
      category,
      amount: row.amount,
      unit: row.unit,
      cutRef: row.cutRef,
    });
  }
  return rows;
}

export type FinanceExportReason =
  | "NO_SNAPSHOT"
  | "SOURCES_SKEWED"
  | "SCOPE"
  | "UNKNOWN_CUT"
  | "CUT_MISSING"
  | "STALE_CUT"
  | "AHEAD_CUT"
  | "ROW_OFF_CUT"
  | "PARTIAL"
  | "COUNT"
  | "ROWS_DIFFER";

export type FinanceExportVerdict = { state: "current" } | { state: "withheld"; reasons: readonly FinanceExportReason[] };

/**
 * Whether an export is the current export for the last read. It is current only when it is
 * one complete export of the very cut set the read saw, for the same scope: every source
 * cut the read lists appears, from the same source, at the same generation and watermark
 * (older is stale and newer means the read is behind, and a cut that is older in one
 * position and newer in the other is both), every row sits on a cut the export names, and
 * the rows are exactly the rows the read yields. A read whose sources sit at different
 * positions has no consistent export. Anything else is withheld, with every reason that
 * applies. Amounts are compared as text and never added.
 */
export function judgeFinanceExport(
  snapshot: FinanceSnapshot | null,
  assessment: FinanceAssessment | null,
  exported: FinanceExport,
): FinanceExportVerdict {
  const reasons: FinanceExportReason[] = [];
  if (snapshot === null || assessment === null) {
    return { state: "withheld", reasons: ["NO_SNAPSHOT"] };
  }
  if (assessment.cutAlignment === "skewed") {
    reasons.push("SOURCES_SKEWED");
  }
  if (exported.scope.tenantId !== snapshot.scope.tenantId || exported.scope.bookRef !== snapshot.scope.bookRef) {
    reasons.push("SCOPE");
  }
  const readCuts = new Map(snapshot.cuts.map((cut) => [cut.cutRef, cut]));
  const exportCuts = new Map(exported.cuts.map((cut) => [cut.cutRef, cut]));
  // A cut the read does not list, one named for another source, or one with no readable position is unknown.
  if (exported.cuts.some((cut) => readCuts.get(cut.cutRef)?.source !== cut.source || !isCutPosition(cut))) {
    reasons.push("UNKNOWN_CUT");
  }
  if (snapshot.cuts.some((cut) => !exportCuts.has(cut.cutRef))) {
    reasons.push("CUT_MISSING");
  }
  let stale = false;
  let ahead = false;
  for (const cut of exported.cuts) {
    const seen = readCuts.get(cut.cutRef);
    if (seen === undefined || !isCutPosition(cut)) {
      continue;
    }
    if (cut.generation < seen.generation || Date.parse(cut.watermark) < Date.parse(seen.watermark)) {
      stale = true;
    }
    if (cut.generation > seen.generation || Date.parse(cut.watermark) > Date.parse(seen.watermark)) {
      ahead = true;
    }
  }
  if (stale) {
    reasons.push("STALE_CUT");
  }
  if (ahead) {
    reasons.push("AHEAD_CUT");
  }
  if (exported.rows.some((row) => !exportCuts.has(row.cutRef))) {
    reasons.push("ROW_OFF_CUT");
  }
  if (!exported.complete) {
    reasons.push("PARTIAL");
  }
  if (exported.rows.length !== exported.declaredRowCount) {
    reasons.push("COUNT");
  }
  const expected = financeExportRowsFor(snapshot);
  const exportedByRef = new Map(exported.rows.map((row) => [row.entryRef, row]));
  let differs = exportedByRef.size !== exported.rows.length || exportedByRef.size !== expected.length;
  if (!differs) {
    for (const row of expected) {
      const other = exportedByRef.get(row.entryRef);
      if (
        other === undefined ||
        other.entryKind !== row.entryKind ||
        other.caseRef !== row.caseRef ||
        other.payeeRef !== row.payeeRef ||
        other.category !== row.category ||
        other.amount !== row.amount ||
        other.unit !== row.unit ||
        other.cutRef !== row.cutRef
      ) {
        differs = true;
        break;
      }
    }
  }
  if (differs) {
    reasons.push("ROWS_DIFFER");
  }
  return reasons.length === 0 ? { state: "current" } : { state: "withheld", reasons };
}

// ---------------------------------------------------------------------------
// Requests: what the read supports
// ---------------------------------------------------------------------------

export interface FinanceEligibility {
  allowed: boolean;
  /** Why the request is not on offer. Null when it is. */
  reason: string | null;
}

/**
 * The corrections a reviewer may propose on a case now. A case whose two sides sit on cuts
 * at different positions, whose verdict the source's own text contradicts, or whose trade
 * the read does not list offers only a request for the source to look again: it is not a
 * mismatch to correct until the sources agree on a position.
 */
export function financeProposableCorrections(
  snapshot: FinanceSnapshot,
  assessment: FinanceAssessment,
  caseRef: string,
): readonly FinanceCorrectionKind[] {
  const row = snapshot.cases.find((item) => item.caseRef === caseRef);
  if (row === undefined || row.state === "resolved-by-source") {
    return [];
  }
  const flagged =
    assessment.skew.some((item) => item.kind === "case" && item.ref === caseRef) ||
    assessment.contradictions.some((item) => item.kind === "case" && item.ref === caseRef) ||
    assessment.unlinked.some((item) => item.lens === "cases" && item.ref === caseRef);
  return flagged ? row.offeredCorrections.filter((item) => item === "request-source-review") : row.offeredCorrections;
}

export function financeProposableCases(snapshot: FinanceSnapshot, assessment: FinanceAssessment): readonly FinanceCase[] {
  return snapshot.cases.filter((row) => financeProposableCorrections(snapshot, assessment, row.caseRef).length > 0);
}

/**
 * Proposals the read lists as pending on a case the source has not resolved. An approval is
 * recorded only while a proposal is pending, and a resolved case leaves nothing to approve.
 */
export function financeApprovableProposals(snapshot: FinanceSnapshot): readonly FinanceProposal[] {
  const resolved = new Set(snapshot.cases.filter((row) => row.state === "resolved-by-source").map((row) => row.caseRef));
  return snapshot.proposals.filter((row) => row.state === "pending" && !resolved.has(row.caseRef));
}

export function financeEligibility(
  snapshot: FinanceSnapshot,
  assessment: FinanceAssessment,
  kind: FinanceActionKind,
): FinanceEligibility {
  if (kind === "propose-correction") {
    return financeProposableCases(snapshot, assessment).length > 0
      ? { allowed: true, reason: null }
      : { allowed: false, reason: "The read lists no case that offers a correction now." };
  }
  return financeApprovableProposals(snapshot).length > 0
    ? { allowed: true, reason: null }
    : { allowed: false, reason: "The read lists no pending proposal to approve." };
}

// ---------------------------------------------------------------------------
// Synthetic source
// ---------------------------------------------------------------------------

const CUT_ORDER = "cut-0001";
const CUT_PAYMENT = "cut-0002";
const CUT_SETTLEMENT = "cut-0003";
const CUT_SERVICING = "cut-0004";

const BASE_GENERATION: Readonly<Record<string, number>> = {
  [CUT_ORDER]: 5,
  [CUT_PAYMENT]: 9,
  [CUT_SETTLEMENT]: 3,
  [CUT_SERVICING]: 2,
};

const CUT_SOURCE_OF: Readonly<Record<string, FinanceCutSource>> = {
  [CUT_ORDER]: "order-ledger",
  [CUT_PAYMENT]: "payment-observations",
  [CUT_SETTLEMENT]: "settlement-ledger",
  [CUT_SERVICING]: "servicing-ledger",
};

type SeedCase = Omit<FinanceCase, "bookRef" | "unit">;

/**
 * The trades below are the merchant workroom's synthetic trades, and the money lines and
 * the payment are its and the servicing desk's. A test reads both sibling sources and
 * checks every link here against them. Amounts are typed constants of this fixture. No
 * code here adds one amount to another.
 */
const SEED_ORIGINALS: readonly Omit<FinanceOriginalTrade, "cutRef">[] = [
  { bookRef: FINANCE_OWN_REF, tradeRef: "trd-0001", listingRef: "lst-0001", eventRef: "evt-0001", statusLabel: "payment-observed" },
  { bookRef: FINANCE_OWN_REF, tradeRef: "trd-0002", listingRef: "lst-0002", eventRef: "evt-0001", statusLabel: "payment-unknown" },
  { bookRef: FINANCE_OWN_REF, tradeRef: "trd-0003", listingRef: "lst-0003", eventRef: "evt-0002", statusLabel: "right-moved" },
  { bookRef: FINANCE_FOREIGN_REF, tradeRef: "trd-0004", listingRef: "lst-0004", eventRef: "evt-0003", statusLabel: "booked" },
];

const SEED_CASES: readonly (SeedCase & { bookRef: string })[] = [
  {
    bookRef: FINANCE_OWN_REF,
    caseRef: "rcs-0001",
    category: "UNMATCHED",
    state: "open",
    tradeRef: "trd-0002",
    merchantLineRef: "obl-0006",
    paymentRef: null,
    lineKind: "held",
    cutRef: CUT_ORDER,
    observedCutRef: CUT_PAYMENT,
    expectedAmount: "1100",
    observedAmount: null,
    differenceAmount: "1100",
    verdict: "mismatch",
    reasonCode: "NO_PAYMENT_OBSERVATION",
    offeredCorrections: ["link-observation", "request-source-review"],
  },
  {
    bookRef: FINANCE_OWN_REF,
    caseRef: "rcs-0002",
    category: "DUPLICATE_OBSERVATION",
    state: "open",
    tradeRef: "trd-0001",
    merchantLineRef: "obl-0001",
    paymentRef: null,
    lineKind: "sales-observed",
    cutRef: CUT_ORDER,
    observedCutRef: CUT_PAYMENT,
    expectedAmount: "1200",
    observedAmount: "2400",
    differenceAmount: "1200",
    verdict: "mismatch",
    reasonCode: "PAYMENT_OBSERVED_TWICE",
    offeredCorrections: ["mark-duplicate", "request-source-review"],
  },
  {
    bookRef: FINANCE_OWN_REF,
    caseRef: "rcs-0003",
    category: "LATE_FACT",
    state: "unknown",
    tradeRef: "trd-0003",
    merchantLineRef: "obl-0005",
    paymentRef: null,
    lineKind: "unpaid",
    cutRef: CUT_ORDER,
    observedCutRef: CUT_PAYMENT,
    expectedAmount: "800",
    observedAmount: null,
    differenceAmount: null,
    verdict: "unknown",
    reasonCode: "FACT_AFTER_CUT",
    offeredCorrections: ["accept-late-fact", "request-source-review"],
  },
  {
    bookRef: FINANCE_OWN_REF,
    caseRef: "rcs-0004",
    category: "MULTI_PAYEE",
    state: "open",
    tradeRef: "trd-0001",
    merchantLineRef: "obl-0004",
    paymentRef: null,
    lineKind: "unpaid",
    cutRef: CUT_ORDER,
    observedCutRef: CUT_SETTLEMENT,
    expectedAmount: "1100",
    observedAmount: "1100",
    differenceAmount: null,
    verdict: "unknown",
    reasonCode: "PAYEE_SPLIT_UNCONFIRMED",
    offeredCorrections: ["reassign-payee", "request-source-review"],
  },
  {
    bookRef: FINANCE_OWN_REF,
    caseRef: "rcs-0005",
    category: "RESIDUAL",
    state: "open",
    tradeRef: "trd-0003",
    merchantLineRef: "obl-0003",
    paymentRef: "pmt-0001",
    lineKind: "sales-observed",
    cutRef: CUT_ORDER,
    observedCutRef: CUT_SERVICING,
    expectedAmount: "900",
    observedAmount: "900",
    differenceAmount: null,
    verdict: "unknown",
    reasonCode: "REMAINDER_UNAPPLIED",
    offeredCorrections: ["allocate-remainder", "request-source-review"],
  },
  {
    bookRef: FINANCE_OWN_REF,
    caseRef: "rcs-0006",
    category: "BALANCE_MISMATCH",
    state: "open",
    tradeRef: "trd-0002",
    merchantLineRef: "obl-0002",
    paymentRef: null,
    lineKind: "sales-observed",
    cutRef: CUT_ORDER,
    observedCutRef: CUT_SETTLEMENT,
    expectedAmount: "1200",
    observedAmount: "1150",
    differenceAmount: "50",
    verdict: "mismatch",
    reasonCode: "SETTLEMENT_SHORT",
    offeredCorrections: ["request-source-review"],
  },
  {
    bookRef: FINANCE_OWN_REF,
    caseRef: "rcs-0007",
    category: "UNMATCHED",
    state: "open",
    tradeRef: "trd-0003",
    merchantLineRef: "obl-0007",
    paymentRef: null,
    lineKind: "refund-burden",
    cutRef: CUT_ORDER,
    observedCutRef: CUT_PAYMENT,
    expectedAmount: "900",
    observedAmount: null,
    differenceAmount: "900",
    verdict: "mismatch",
    reasonCode: "REFUND_OBSERVATION_MISSING",
    offeredCorrections: ["link-observation", "request-source-review"],
  },
  {
    bookRef: FINANCE_FOREIGN_REF,
    caseRef: "rcs-0008",
    category: "UNMATCHED",
    state: "open",
    tradeRef: "trd-0004",
    merchantLineRef: "obl-0008",
    paymentRef: null,
    lineKind: "unpaid",
    cutRef: CUT_ORDER,
    observedCutRef: CUT_PAYMENT,
    expectedAmount: "5000",
    observedAmount: null,
    differenceAmount: "5000",
    verdict: "mismatch",
    reasonCode: "NO_PAYMENT_OBSERVATION",
    offeredCorrections: ["link-observation", "request-source-review"],
  },
];

interface SeedFact {
  factRef: string;
  caseRef: string;
  kind: FinanceFactKind;
  cutRef: string;
  arrival: FinanceArrival;
  amount: string | null;
  payeeRef: string | null;
  label: string;
}

const SEED_FACTS: readonly SeedFact[] = [
  { factRef: "fct-0001", caseRef: "rcs-0001", kind: "order-observed", cutRef: CUT_ORDER, arrival: "in-cut", amount: "1100", payeeRef: null, label: "The order side holds 1100 for trade trd-0002." },
  { factRef: "fct-0002", caseRef: "rcs-0002", kind: "payment-observed", cutRef: CUT_PAYMENT, arrival: "in-cut", amount: "1200", payeeRef: null, label: "A payment observation of 1200 for trade trd-0001." },
  { factRef: "fct-0003", caseRef: "rcs-0002", kind: "payment-observed-again", cutRef: CUT_PAYMENT, arrival: "in-cut", amount: "1200", payeeRef: null, label: "The same payment was observed a second time." },
  { factRef: "fct-0004", caseRef: "rcs-0003", kind: "order-observed", cutRef: CUT_ORDER, arrival: "in-cut", amount: "800", payeeRef: null, label: "The order side holds 800 for trade trd-0003." },
  { factRef: "fct-0005", caseRef: "rcs-0003", kind: "late-arrival", cutRef: CUT_PAYMENT, arrival: "after-cut", amount: "800", payeeRef: null, label: "A payment observation of 800 reached the source after this cut was taken." },
  { factRef: "fct-0006", caseRef: "rcs-0004", kind: "payout-recorded", cutRef: CUT_SETTLEMENT, arrival: "in-cut", amount: "1100", payeeRef: null, label: "One payout of 1100 is recorded for trade trd-0001 and split across three payees." },
  { factRef: "fct-0007", caseRef: "rcs-0005", kind: "allocation-recorded", cutRef: CUT_SERVICING, arrival: "in-cut", amount: "400", payeeRef: "pye-0004", label: "400 is allocated to the lender as a servicing repayment, payment pmt-0001." },
  { factRef: "fct-0008", caseRef: "rcs-0005", kind: "remainder-recorded", cutRef: CUT_SERVICING, arrival: "in-cut", amount: "100", payeeRef: null, label: "100 stays unapplied. It applies itself to nothing." },
  { factRef: "fct-0009", caseRef: "rcs-0006", kind: "payment-observed", cutRef: CUT_PAYMENT, arrival: "in-cut", amount: "1200", payeeRef: null, label: "A payment observation of 1200 for trade trd-0002." },
  { factRef: "fct-0010", caseRef: "rcs-0006", kind: "payout-recorded", cutRef: CUT_SETTLEMENT, arrival: "in-cut", amount: "1150", payeeRef: null, label: "The settlement ledger records 1150 for trade trd-0002." },
  { factRef: "fct-0011", caseRef: "rcs-0007", kind: "order-observed", cutRef: CUT_ORDER, arrival: "in-cut", amount: "900", payeeRef: null, label: "A refund burden of 900 is held on the order side for trade trd-0003." },
];

interface SeedAllocation {
  allocationRef: string;
  caseRef: string;
  kind: FinanceAllocationKind;
  payeeRef: string | null;
  role: FinancePayeeRole | null;
  amount: string;
  cutRef: string;
}

const SEED_ALLOCATIONS: readonly SeedAllocation[] = [
  { allocationRef: "fal-0001", caseRef: "rcs-0004", kind: "payee-share", payeeRef: "pye-0001", role: "seller", amount: "700", cutRef: CUT_SETTLEMENT },
  { allocationRef: "fal-0002", caseRef: "rcs-0004", kind: "payee-share", payeeRef: "pye-0002", role: "venue", amount: "300", cutRef: CUT_SETTLEMENT },
  { allocationRef: "fal-0003", caseRef: "rcs-0004", kind: "payee-share", payeeRef: "pye-0003", role: "platform", amount: "100", cutRef: CUT_SETTLEMENT },
  { allocationRef: "fal-0004", caseRef: "rcs-0005", kind: "payee-share", payeeRef: "pye-0001", role: "seller", amount: "400", cutRef: CUT_SERVICING },
  { allocationRef: "fal-0005", caseRef: "rcs-0005", kind: "payee-share", payeeRef: "pye-0004", role: "lender", amount: "400", cutRef: CUT_SERVICING },
  { allocationRef: "fal-0006", caseRef: "rcs-0005", kind: "unapplied-remainder", payeeRef: null, role: null, amount: "100", cutRef: CUT_SERVICING },
];

/** The source's own totals for the desk book. Typed by hand, never computed. */
const SEED_TOTALS: readonly { category: FinanceCategory; caseCount: number; amount: string | null }[] = [
  { category: "UNMATCHED", caseCount: 2, amount: "2000" },
  { category: "DUPLICATE_OBSERVATION", caseCount: 1, amount: "1200" },
  { category: "LATE_FACT", caseCount: 1, amount: null },
  { category: "MULTI_PAYEE", caseCount: 1, amount: null },
  { category: "RESIDUAL", caseCount: 1, amount: null },
  { category: "BALANCE_MISMATCH", caseCount: 1, amount: "50" },
];

/** The source's own comparison of two sources, in text. Typed by hand, never computed. */
const SEED_BALANCES: readonly Omit<FinanceBalanceRow, "bookRef" | "unit">[] = [
  {
    balanceRef: "bal-0001",
    label: "order-ledger against payment-observations",
    leftCutRef: CUT_ORDER,
    rightCutRef: CUT_PAYMENT,
    leftAmount: "7200",
    rightAmount: "2400",
    differenceAmount: "4800",
    verdict: "mismatch",
  },
  {
    balanceRef: "bal-0002",
    label: "order-ledger against settlement-ledger",
    leftCutRef: CUT_ORDER,
    rightCutRef: CUT_SETTLEMENT,
    leftAmount: "2300",
    rightAmount: "2250",
    differenceAmount: "50",
    verdict: "mismatch",
  },
  {
    balanceRef: "bal-0003",
    label: "order-ledger against servicing-ledger",
    leftCutRef: CUT_ORDER,
    rightCutRef: CUT_SERVICING,
    leftAmount: "900",
    rightAmount: "900",
    differenceAmount: "0",
    verdict: "matched",
  },
];

/** What each actor string may read at the synthetic source. A stand-in for an authority. */
const GRANTS: ReadonlyMap<string, readonly string[]> = new Map(
  FINANCE_ACTORS.map((actor) => [actor as string, [FINANCE_OWN_REF]] as const),
);

const NON_CLAIMS: FinanceNonClaims = {
  confirmationForcesMatch: false,
  proposalChangesEconomicState: false,
  approvalChangesEconomicState: false,
  payoutExecuted: false,
  postedToAccountingSystem: false,
  exportIsBookOfRecord: false,
};

const NOTE_LIMIT = 200;
// Intentionally rejects ASCII control characters in finance notes.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidNote(value: unknown): value is string {
  return isNonEmpty(value) && value.trim().length <= NOTE_LIMIT && !CONTROL_CHARACTERS.test(value);
}

/** Synthetic source. State lives in this object, so a new port is a new session. */
export class StubFinanceOperations implements FinanceOperationsPort {
  readonly environment = "stub" as const;
  readonly source = "synthetic-finance" as const;
  readonly scenario: FinanceScenario;
  private readonly expectedTuple: DiscoveryReadTuple;
  private snapshotSerial = 0;
  private revoked = false;
  private advanced = 0;
  private readonly resolved = new Set<string>();
  private readonly proposals: FinanceProposal[] = [];
  private readonly counts: FinanceEffectCounts = { reads: 0, exports: 0, acts: 0 };

  constructor(options: StubFinanceOperationsOptions) {
    this.scenario = options.scenario ?? "clean";
    this.expectedTuple = options.expectedTuple ?? DISCOVERY_READ_TUPLE_LITERALS;
    if (this.scenario === "proposal-pending" || this.scenario === "self-approval") {
      // The self-approval scenario seeds a proposal whose own actor holds the approve
      // capability, so the source has a reason to reject that actor approving it.
      this.proposals.push({
        bookRef: FINANCE_OWN_REF,
        cutRef: CUT_ORDER,
        proposalRef: "prp-0001",
        caseRef: "rcs-0001",
        correction: "link-observation",
        note: "Link the held amount to the payment the processor reported later.",
        proposedBy: this.scenario === "self-approval" ? FINANCE_APPROVER_ACTOR : FINANCE_REVIEWER_ACTOR,
        state: "pending",
        economicStateChanged: false,
      });
    }
  }

  /** Test seam. Counts of what reached the source. Not part of the port. */
  effects(): FinanceEffectCounts {
    return { ...this.counts };
  }

  synthetic(control: FinanceSyntheticControl): boolean {
    if (control === "revoke-grant") {
      this.revoked = true;
      return true;
    }
    if (control === "advance-cut") {
      this.advanced += 1;
      return true;
    }
    // The source posts a later cut in which the next open case is resolved. Nothing the
    // desk did chooses the case, and an approval is not what moves it.
    const next = SEED_CASES.find(
      (row) => row.bookRef === FINANCE_OWN_REF && !this.resolved.has(row.caseRef),
    );
    if (next === undefined) {
      return false;
    }
    this.resolved.add(next.caseRef);
    // A proposal still pending on a case the source resolved is moot. The source closes it as
    // rejected. An approval already recorded stays what it was.
    for (const proposal of this.proposals) {
      if (proposal.caseRef === next.caseRef && proposal.state === "pending") {
        proposal.state = "rejected";
      }
    }
    this.advanced += 1;
    return true;
  }

  private generationOf(cutRef: string): number {
    return (BASE_GENERATION[cutRef] ?? 0) + this.advanced;
  }

  read(request: FinanceReadRequest): Promise<FinanceReadOutcome> {
    this.counts.reads += 1;
    if (this.scenario === "read-lost") {
      return Promise.reject(new Error("The answer to the read never arrived."));
    }
    return Promise.resolve(this.readNow(request));
  }

  readExport(request: FinanceExportRequest): Promise<FinanceExportOutcome> {
    this.counts.exports += 1;
    return Promise.resolve(this.exportNow(request));
  }

  act(request: FinanceActRequest): Promise<FinanceActOutcome> {
    this.counts.acts += 1;
    const outcome = this.actNow(request);
    if (this.scenario === "act-lost" && outcome.kind === "applied") {
      // The request took effect at the source. Its answer never arrives.
      return Promise.reject(new Error("The answer to the request never arrived."));
    }
    return Promise.resolve(outcome);
  }

  private gate(request: { contextKey: unknown; actorRef: unknown; scope: FinanceScope }): FinanceInvalid | FinanceDenied | null {
    if (!isNonEmpty(request.contextKey)) {
      return { kind: "invalid-request", code: "CONTEXT", detail: "A request carries a context key." };
    }
    if (!isNonEmpty(request.actorRef)) {
      return { kind: "invalid-request", code: "ACTOR", detail: "A request carries an actor string. It is a label, not an authentication result." };
    }
    const scope = request.scope as Partial<FinanceScope> | null | undefined;
    if (scope?.tenantId !== FINANCE_TENANT || !isFinanceRef(scope.bookRef, "book")) {
      return { kind: "invalid-request", code: "SCOPE", detail: `A scope names tenant ${FINANCE_TENANT} and a book reference.` };
    }
    if (this.revoked || this.scenario === "denied") {
      return { kind: "denied", code: "GRANT_REVOKED", bookRef: scope.bookRef, detail: "The grant for this actor was withdrawn at the source. No row is returned." };
    }
    const granted = GRANTS.get(String(request.actorRef)) ?? [];
    if (!granted.includes(scope.bookRef)) {
      return { kind: "denied", code: "SCOPE_DENIED", bookRef: scope.bookRef, detail: "This actor holds no grant for that book at the source. No row is returned." };
    }
    return null;
  }

  private readNow(request: FinanceReadRequest): FinanceReadOutcome {
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
    const watermark = this.scenario === "stale" ? FINANCE_STALE_WATERMARK : FINANCE_AS_OF;
    const floor = request.watermarkFloor ?? (this.scenario === "stale" ? FINANCE_STALE_FLOOR : null);
    if (floor !== null && Date.parse(watermark) < Date.parse(floor)) {
      return { kind: "stale", watermark, floor };
    }
    if (this.scenario === "empty") {
      return { kind: "empty", watermark, snapshotId: this.snapshotSerial, scope: { ...request.scope } };
    }
    const snapshot = this.buildSnapshot(request.scope, watermark);
    const refused = refuseFinanceSnapshot(snapshot);
    if (refused !== null) {
      return refused;
    }
    return { kind: "ready", snapshot };
  }

  private cuts(): FinanceCut[] {
    return [CUT_ORDER, CUT_PAYMENT, CUT_SETTLEMENT, CUT_SERVICING].map((cutRef) => ({
      cutRef,
      source: CUT_SOURCE_OF[cutRef] as FinanceCutSource,
      generation: this.generationOf(cutRef),
      watermark: this.scenario === "source-cut-skew" && cutRef === CUT_PAYMENT ? FINANCE_SKEW_WATERMARK : FINANCE_AS_OF,
    }));
  }

  /** A case as the source holds it now. A case the source resolved no longer differs. */
  private caseFor(seed: SeedCase & { bookRef: string }): FinanceCase {
    const base: FinanceCase = { ...seed, unit: FINANCE_UNIT, offeredCorrections: [...seed.offeredCorrections] };
    if (this.resolved.has(seed.caseRef)) {
      return {
        ...base,
        state: "resolved-by-source",
        observedAmount: seed.expectedAmount,
        differenceAmount: "0",
        verdict: "matched",
        reasonCode: "RESOLVED_BY_SOURCE",
        offeredCorrections: [],
      };
    }
    if (this.scenario === "dangling-link" && seed.caseRef === "rcs-0007") {
      return { ...base, tradeRef: "trd-0099" };
    }
    return base;
  }

  private casesFor(book: string): FinanceCase[] {
    return SEED_CASES.filter((seed) => seed.bookRef === book).map((seed) => this.caseFor(seed));
  }

  private totalsFor(cases: readonly FinanceCase[]): FinanceTotalRow[] {
    const rows: FinanceTotalRow[] = [];
    for (const figure of SEED_TOTALS) {
      const members = cases.filter((row) => row.category === figure.category);
      if (members.length === 0) {
        continue;
      }
      const touched = members.some((row) => row.state === "resolved-by-source");
      let caseCount = figure.caseCount;
      let generation = this.generationOf(CUT_ORDER);
      if (this.scenario === "stale-totals") {
        generation -= 1;
      }
      if (this.scenario === "totals-mismatch" && figure.category === "UNMATCHED") {
        caseCount += 1;
      }
      rows.push({
        category: figure.category,
        cutRef: CUT_ORDER,
        generation,
        caseCount,
        // After the source resolves a case in the category, this stub holds no ledger to
        // restate the total from, so it states none and the page prints UNDETERMINED.
        amount: touched ? null : figure.amount,
        unit: FINANCE_UNIT,
      });
    }
    return rows;
  }

  private balancesFor(book: string): FinanceBalanceRow[] {
    return SEED_BALANCES.map((row) => {
      const shaped = this.scenario === "balance-mismatch" && row.balanceRef === "bal-0003" ? { ...row, differenceAmount: "100" } : row;
      return { ...shaped, bookRef: book, unit: FINANCE_UNIT };
    });
  }

  private buildSnapshot(scope: FinanceScope, watermark: string): FinanceSnapshot {
    const own = scope.bookRef;
    const originals = SEED_ORIGINALS.filter((row) => row.bookRef === own).map((row) => ({ ...row, cutRef: CUT_ORDER }));
    const cases = this.casesFor(own);
    if (this.scenario === "scope-leak") {
      const leaked = SEED_CASES.find((row) => row.bookRef === FINANCE_FOREIGN_REF);
      if (leaked) {
        cases.push(this.caseFor(leaked));
      }
    }
    const caseRefs = new Set(cases.map((row) => row.caseRef));
    const facts: FinanceFact[] = SEED_FACTS.filter((row) => caseRefs.has(row.caseRef)).map((row) => ({
      ...row,
      bookRef: own,
      unit: FINANCE_UNIT,
    }));
    const allocations: FinanceAllocation[] = SEED_ALLOCATIONS.filter((row) => caseRefs.has(row.caseRef)).map((row) => ({
      ...row,
      bookRef: own,
      unit: FINANCE_UNIT,
    }));
    const nonClaims = this.scenario === "claims-forced" ? ({ ...NON_CLAIMS, confirmationForcesMatch: true } as unknown as FinanceNonClaims) : { ...NON_CLAIMS };
    return {
      snapshotId: this.snapshotSerial,
      watermark,
      scenario: this.scenario,
      scope: { ...scope },
      cuts: this.cuts(),
      originals,
      cases,
      facts,
      allocations,
      totals: this.totalsFor(cases),
      balances: this.balancesFor(own),
      proposals: this.proposals.filter((row) => row.bookRef === own).map((row) => ({ ...row })),
      nonClaims,
    };
  }

  private exportNow(request: FinanceExportRequest): FinanceExportOutcome {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return { kind: "tuple-changed", field: tuple.field, expected: tuple.expected, actual: tuple.actual };
    }
    const refusedRequest = this.gate(request);
    if (refusedRequest !== null) {
      return refusedRequest;
    }
    if (this.scenario === "export-denied" || !financeCapabilities(request.actorRef).includes("export")) {
      return { kind: "denied", code: "EXPORT_DENIED", bookRef: request.scope.bookRef, detail: "The source grants this actor a read and no export. No export is returned." };
    }
    const snapshot = this.buildSnapshot(request.scope, FINANCE_AS_OF);
    const all = financeExportRowsFor(snapshot);
    let rows = all;
    let cuts = snapshot.cuts;
    let complete = true;
    if (this.scenario === "export-partial") {
      rows = all.slice(0, all.length - 3);
      complete = false;
    }
    if (this.scenario === "export-stale") {
      cuts = snapshot.cuts.map((cut) => ({ ...cut, generation: cut.generation - 1, watermark: FINANCE_SKEW_WATERMARK }));
    }
    if (this.scenario === "export-rows-differ") {
      rows = all.map((row) => (row.entryRef === "rcs-0002" ? { ...row, amount: "1300" } : row));
    }
    const scopeDeclaration: FinanceExportScope = {
      provenance: "synthetic",
      realMoney: false,
      postedToAccountingSystem: false,
      bookOfRecord: false,
      target: "none",
    };
    const exported: FinanceExport = {
      exportRef: "fex-0001",
      scope: { ...request.scope },
      cuts,
      declaredRowCount: all.length,
      complete,
      digest: "syn-digest-0001",
      scopeDeclaration:
        this.scenario === "export-claims-real" ? ({ ...scopeDeclaration, realMoney: true } as unknown as FinanceExportScope) : scopeDeclaration,
      rows,
    };
    const refused = refuseFinanceExport(exported, request.scope);
    if (refused !== null) {
      return refused;
    }
    return { kind: "ready", export: exported };
  }

  private actNow(request: FinanceActRequest): FinanceActOutcome {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return { kind: "tuple-changed", field: tuple.field, expected: tuple.expected, actual: tuple.actual };
    }
    const refusedRequest = this.gate(request);
    if (refusedRequest !== null) {
      return refusedRequest;
    }
    const action = request.action as Partial<FinanceActionRequest> | null | undefined;
    if (action === null || action === undefined || !includes(FINANCE_ACTION_KINDS, action.kind)) {
      return { kind: "invalid-request", code: "ACTION", detail: `An action is one of ${FINANCE_ACTION_KINDS.join(", ")}.` };
    }
    const capabilities = financeCapabilities(request.actorRef);
    if (action.kind === "propose-correction") {
      return this.proposeNow(request, action as Extract<FinanceActionRequest, { kind: "propose-correction" }>, capabilities);
    }
    return this.approveNow(request, action as Extract<FinanceActionRequest, { kind: "approve-proposal" }>, capabilities);
  }

  private proposeNow(
    request: FinanceActRequest,
    action: Extract<FinanceActionRequest, { kind: "propose-correction" }>,
    capabilities: readonly FinanceCapability[],
  ): FinanceActOutcome {
    if (!isFinanceRef(action.caseRef, "case")) {
      return { kind: "invalid-request", code: "REF", detail: `${String(action.caseRef)} is not a case reference.` };
    }
    if (!includes(FINANCE_CORRECTION_KINDS, action.correction)) {
      return { kind: "invalid-request", code: "ACTION", detail: `A correction is one of ${FINANCE_CORRECTION_KINDS.join(", ")}.` };
    }
    if (!isValidNote(action.note)) {
      return { kind: "invalid-request", code: "TEXT", detail: `A note is one to ${NOTE_LIMIT} characters with no control character.` };
    }
    if (!capabilities.includes("propose")) {
      return { kind: "rejected", code: "NO_CAPABILITY", detail: `Actor ${request.actorRef} holds no propose capability at the source. View, proposal, and approval stay separate.` };
    }
    const row = SEED_CASES.find((item) => item.bookRef === request.scope.bookRef && item.caseRef === action.caseRef);
    if (row === undefined) {
      return { kind: "rejected", code: "UNKNOWN_CASE", detail: `The source holds no case ${action.caseRef} in this book.` };
    }
    if (this.resolved.has(row.caseRef)) {
      return { kind: "rejected", code: "CASE_RESOLVED", detail: `Case ${row.caseRef} was resolved by the source. Nothing is left to correct.` };
    }
    if (!row.offeredCorrections.includes(action.correction)) {
      return { kind: "rejected", code: "NOT_OFFERED", detail: `The source does not offer ${action.correction} on case ${row.caseRef}.` };
    }
    if (this.proposals.some((item) => item.caseRef === row.caseRef && item.correction === action.correction && item.state === "pending")) {
      return { kind: "rejected", code: "DUPLICATE_PENDING", detail: `A ${action.correction} proposal on case ${row.caseRef} is already pending.` };
    }
    const proposalRef = financeRefFor("proposal", this.proposals.length + 1);
    this.proposals.push({
      bookRef: request.scope.bookRef,
      cutRef: CUT_ORDER,
      proposalRef,
      caseRef: row.caseRef,
      correction: action.correction,
      note: action.note.trim(),
      proposedBy: request.actorRef,
      state: "pending",
      economicStateChanged: false,
    });
    return this.answer({ kind: "proposal-recorded", proposalRef, caseRef: row.caseRef }, request.action);
  }

  private approveNow(
    request: FinanceActRequest,
    action: Extract<FinanceActionRequest, { kind: "approve-proposal" }>,
    capabilities: readonly FinanceCapability[],
  ): FinanceActOutcome {
    if (!isFinanceRef(action.proposalRef, "proposal")) {
      return { kind: "invalid-request", code: "REF", detail: `${String(action.proposalRef)} is not a proposal reference.` };
    }
    if (!capabilities.includes("approve")) {
      return { kind: "rejected", code: "NO_CAPABILITY", detail: `Actor ${request.actorRef} holds no approve capability at the source. View, proposal, and approval stay separate.` };
    }
    const proposal = this.proposals.find((item) => item.proposalRef === action.proposalRef && item.bookRef === request.scope.bookRef);
    if (proposal === undefined) {
      return { kind: "rejected", code: "UNKNOWN_PROPOSAL", detail: `The source holds no proposal ${action.proposalRef} in this book.` };
    }
    if (proposal.state !== "pending") {
      return { kind: "rejected", code: "NOT_PENDING", detail: `Proposal ${proposal.proposalRef} is ${proposal.state}. A proposal is approved only while it is pending.` };
    }
    if (proposal.proposedBy === request.actorRef) {
      return { kind: "rejected", code: "SELF_APPROVAL", detail: `Actor ${request.actorRef} proposed ${proposal.proposalRef}. A different actor approves it.` };
    }
    // The approval is recorded. No case, no figure, and no cut changes with it.
    proposal.state = "approval-recorded";
    return this.answer({ kind: "approval-recorded", proposalRef: proposal.proposalRef, caseRef: proposal.caseRef }, request.action);
  }

  /** Builds the answer, and refuses it when it claims anything a recorded request cannot mean. */
  private answer(base: Pick<FinanceReceipt, "kind" | "proposalRef" | "caseRef">, action: FinanceActionRequest): FinanceActOutcome {
    const claims = this.scenario === "approve-claims-applied" && base.kind === "approval-recorded";
    const receipt = { ...base, economicStateChanged: claims, confirmationForcesMatch: false } as unknown as FinanceReceipt;
    const refused = refuseFinanceReceipt(receipt, action);
    if (refused !== null) {
      return refused;
    }
    return { kind: "applied", receipt };
  }
}
