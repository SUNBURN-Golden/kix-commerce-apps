import {
  DISCOVERY_PROJECTION_AS_OF,
  DISCOVERY_READ_TENANT,
  DISCOVERY_READ_TUPLE_LITERALS,
  checkDiscoveryReadTuple,
  type DiscoveryReadTuple,
} from "./discovery-read.js";
import { PLATFORM_HOLD_NOT_BOUND, PLATFORM_NOT_COMPOSED } from "./platform-journey.js";

/**
 * Synthetic merchant ledger for the organizer and seller workroom.
 *
 * This is the stub-scope stand-in for the producer read and export. The real
 * connection stays pending on kix-protocol:fin-catalogue-read-model and
 * kix-protocol:ps-05-query-projections, and on the unpromoted c-finance-projection.
 * The contract-only catalogue has no read command for an event, listing, trade, or
 * settlement-obligation projection and no export command, so no producer SDK,
 * manifest, or vector is consumed and this module sends nothing over a network.
 *
 * The port is read only. It composes no catalogue command: capture and
 * settle_capture are never sent, and the not-composed record below only quotes why.
 *
 * Money rules, all enforced here and not only in copy:
 *  - An amount is a whole-unit string copied from the source. Nothing in this
 *    module parses, adds, scales, or compares one, so no client total exists.
 *  - Every figure belongs to a source cut. Figures from different cuts are never
 *    merged, and an export is current only when it belongs to the one cut the last
 *    read was on.
 *  - A line never says it is settled, that funds are available, or that it can be
 *    lent against. The source states each as the literal false, and a payload that
 *    says anything else is refused before a row is returned.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const MERCHANT_OPERATIONS_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const MERCHANT_NOT_BOUND_REASON =
  "The contract-only catalogue has no read command for an event, listing, trade, or settlement-obligation projection and no export command, and the Finance catalogue read model and query projections are not merged in kix-protocol. The merchant workroom stays not-bound on integration-http.";

export const MERCHANT_PROJECTION_NAME = "kix.merchant.operations";

/** Fixed instant the synthetic ledger claims to be built at. */
export const MERCHANT_AS_OF = DISCOVERY_PROJECTION_AS_OF;

/** Watermark the stale scenario serves, and the floor a reader holds against it. */
export const MERCHANT_STALE_WATERMARK = "2026-10-10T00:00:00.000Z";
export const MERCHANT_STALE_FLOOR = "2026-10-12T00:00:00.000Z";

/** The desk's own actor string. It is a context label, not an authentication result. */
export const MERCHANT_DESK_ACTOR = "merchant-desk";

export const MERCHANT_TENANT = DISCOVERY_READ_TENANT;

/** The merchant the desk actor holds a synthetic grant for, and one it does not. */
export const MERCHANT_OWN_REF = "mrc-0001";
export const MERCHANT_FOREIGN_REF = "mrc-0002";

/** Amounts are labelled with this unit. It is a mock unit, not a currency. */
export const MERCHANT_UNIT = "mock-unit";

export const MERCHANT_LENSES = ["events", "listings", "trades", "obligations"] as const;

export type MerchantLens = (typeof MERCHANT_LENSES)[number];

/**
 * Four kinds of money line. Each stays its own line: sales are an observation of the
 * order side, and the other three are what the source says is owed, held, or borne.
 */
export const MERCHANT_LINE_KINDS = ["sales-observed", "unpaid", "held", "refund-burden"] as const;

export type MerchantLineKind = (typeof MERCHANT_LINE_KINDS)[number];

export const MERCHANT_LINE_STATES = ["observed", "pending", "exception", "unknown"] as const;

export type MerchantLineState = (typeof MERCHANT_LINE_STATES)[number];

/** Why a line is an exception, as the source names it. The page fixes none of them. */
export const MERCHANT_EXCEPTION_CODES = ["UNMATCHED", "DUPLICATE", "LATE", "MISMATCH"] as const;

export type MerchantExceptionCode = (typeof MERCHANT_EXCEPTION_CODES)[number];

export const MERCHANT_CUT_SOURCES = ["merchant-ledger", "hold-register"] as const;

export type MerchantCutSource = (typeof MERCHANT_CUT_SOURCES)[number];

export const MERCHANT_SCENARIOS = [
  "clean",
  "empty",
  "stale",
  "stale-aggregate",
  "aggregate-mismatch",
  "mixed-cut",
  "dangling-link",
  "exceptions",
  "claims-settled",
  "scope-leak",
  "denied",
  "read-lost",
  "export-partial",
  "export-stale",
  "export-lines-differ",
  "export-denied",
] as const;

export type MerchantScenario = (typeof MERCHANT_SCENARIOS)[number];

export const MERCHANT_DENIED_CODES = ["SCOPE_DENIED", "GRANT_REVOKED", "EXPORT_DENIED"] as const;

export type MerchantDeniedCode = (typeof MERCHANT_DENIED_CODES)[number];

export const MERCHANT_REFUSAL_CODES = ["CLAIM", "AMOUNT", "UNIT", "KIND", "STATE", "REF", "CUT", "SCOPE_LEAK"] as const;

export type MerchantRefusalCode = (typeof MERCHANT_REFUSAL_CODES)[number];

export const MERCHANT_INVALID_CODES = ["CONTEXT", "ACTOR", "SCOPE", "FLOOR"] as const;

export type MerchantInvalidCode = (typeof MERCHANT_INVALID_CODES)[number];

/** Quote of the locked hold binding. H1 keeps this consideredAction and keeps it not-bound. */
export const MERCHANT_HOLD_NOT_BOUND = PLATFORM_HOLD_NOT_BOUND;

/**
 * Catalogue commands this module records and does not send. It reuses the platform
 * record: the journey list plus refund_ticket. Nothing is composed here at all.
 */
export const MERCHANT_NOT_COMPOSED = PLATFORM_NOT_COMPOSED;

// ---------------------------------------------------------------------------
// Identity. Each kind has its own prefix and one kind is never read as another.
// ---------------------------------------------------------------------------

export const MERCHANT_REF_KINDS = ["merchant", "event", "listing", "trade", "obligation", "cut", "export"] as const;

export type MerchantRefKind = (typeof MERCHANT_REF_KINDS)[number];

const REF_PREFIX: Readonly<Record<MerchantRefKind, string>> = {
  merchant: "mrc-",
  event: "evt-",
  listing: "lst-",
  trade: "trd-",
  obligation: "obl-",
  cut: "cut-",
  export: "exp-",
};

const REF_PATTERN = /^(mrc|evt|lst|trd|obl|cut|exp)-[0-9]{4}$/;

export function merchantRefFor(kind: MerchantRefKind, serial: number): string {
  return `${REF_PREFIX[kind]}${String(serial).padStart(4, "0")}`;
}

export function merchantRefKind(ref: string): MerchantRefKind | null {
  if (!REF_PATTERN.test(ref)) {
    return null;
  }
  for (const kind of MERCHANT_REF_KINDS) {
    if (ref.startsWith(REF_PREFIX[kind])) {
      return kind;
    }
  }
  return null;
}

export function isMerchantRef(ref: unknown, kind: MerchantRefKind): ref is string {
  return typeof ref === "string" && merchantRefKind(ref) === kind;
}

/** A whole-unit amount: digits only, no sign, no leading zero, at most twelve digits. */
const AMOUNT_PATTERN = /^(0|[1-9][0-9]{0,11})$/;

export function isMerchantAmount(value: unknown): value is string {
  return typeof value === "string" && AMOUNT_PATTERN.test(value);
}

// ---------------------------------------------------------------------------
// Read model shapes
// ---------------------------------------------------------------------------

export interface MerchantScope {
  tenantId: string;
  /** The merchant whose rows are requested. A grant is checked against it. */
  merchantRef: string;
}

/**
 * A source cut: the position one source was read at. Two figures are comparable
 * only when they name the same cut. A cut is not a commit position and not a
 * settlement date.
 */
export interface MerchantCut {
  cutRef: string;
  source: MerchantCutSource;
  generation: number;
  watermark: string;
}

interface MerchantRowBase {
  merchantRef: string;
  cutRef: string;
}

export interface MerchantEventRow extends MerchantRowBase {
  eventRef: string;
  title: string;
  statusLabel: "on-sale" | "closed" | "cancelled";
}

export interface MerchantListingRow extends MerchantRowBase {
  listingRef: string;
  eventRef: string;
  channel: string;
  statusLabel: "open" | "superseded";
}

export interface MerchantTradeRow extends MerchantRowBase {
  tradeRef: string;
  listingRef: string;
  eventRef: string;
  /** An observation label. It says nothing about settlement. */
  statusLabel: "booked" | "payment-observed" | "right-moved" | "payment-unknown";
}

export interface MerchantLine extends MerchantRowBase {
  obligationRef: string;
  kind: MerchantLineKind;
  state: MerchantLineState;
  eventRef: string;
  listingRef: string;
  tradeRef: string;
  /** Whole-unit string copied from the source. Never parsed, added, or compared by the client. */
  amount: string;
  unit: typeof MERCHANT_UNIT;
  /** A held reason or an exception code, as the source names it. */
  reasonCode: string | null;
  /** The source never claims these. A payload that does is refused. */
  settled: false;
  fundsAvailable: false;
  lendable: false;
}

/**
 * The source's own figure for one kind on one cut. The client never recomputes it.
 * It checks the line count and the generation, because those are labels and not money.
 */
export interface MerchantAggregateRow {
  kind: MerchantLineKind;
  cutRef: string;
  /** The cut generation this figure was built at. */
  generation: number;
  lineCount: number;
  amount: string;
  unit: typeof MERCHANT_UNIT;
}

export interface MerchantSnapshot {
  /** Read serial on this port. It orders reads and is not a commit position. */
  snapshotId: number;
  watermark: string;
  scenario: MerchantScenario;
  scope: MerchantScope;
  cuts: readonly MerchantCut[];
  events: readonly MerchantEventRow[];
  listings: readonly MerchantListingRow[];
  trades: readonly MerchantTradeRow[];
  lines: readonly MerchantLine[];
  aggregate: readonly MerchantAggregateRow[];
}

export interface MerchantExportRow {
  obligationRef: string;
  kind: MerchantLineKind;
  state: MerchantLineState;
  tradeRef: string;
  amount: string;
  unit: typeof MERCHANT_UNIT;
  cutRef: string;
}

/** A producer export. The client compares it with the last read and never repairs it. */
export interface MerchantExport {
  exportRef: string;
  scope: MerchantScope;
  /** The one cut the producer says this export belongs to. */
  cutRef: string;
  generation: number;
  watermark: string;
  /** Row count the producer declared. A different number of rows is a partial export. */
  declaredRowCount: number;
  /** False when the producer says the export was cut off. */
  complete: boolean;
  /** Opaque producer text. No digest rule is published, so the client does not verify it. */
  digest: string | null;
  rows: readonly MerchantExportRow[];
}

export interface MerchantReadRequest {
  contextKey: string;
  actorRef: string;
  scope: MerchantScope;
  watermarkFloor: string | null;
}

export interface MerchantExportRequest {
  contextKey: string;
  actorRef: string;
  scope: MerchantScope;
}

export type MerchantTupleChanged = { kind: "tuple-changed"; field: string; expected: string; actual: string };

export type MerchantDenied = { kind: "denied"; code: MerchantDeniedCode; merchantRef: string; detail: string };

export type MerchantRefused = { kind: "refused"; code: MerchantRefusalCode; field: string; ref: string | null; detail: string };

export type MerchantInvalid = { kind: "invalid-request"; code: MerchantInvalidCode; detail: string };

export type MerchantReadOutcome =
  | { kind: "ready"; snapshot: MerchantSnapshot }
  | { kind: "empty"; watermark: string; snapshotId: number; scope: MerchantScope }
  | { kind: "stale"; watermark: string; floor: string }
  | MerchantDenied
  | MerchantRefused
  | MerchantInvalid
  | MerchantTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export type MerchantExportOutcome =
  | { kind: "ready"; export: MerchantExport }
  | MerchantDenied
  | MerchantRefused
  | MerchantInvalid
  | MerchantTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export interface MerchantOperationsPort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic-merchant" | "none";
  readonly scenario: MerchantScenario;
  read(request: MerchantReadRequest): Promise<MerchantReadOutcome>;
  readExport(request: MerchantExportRequest): Promise<MerchantExportOutcome>;
  /**
   * Synthetic control: withdraws the desk grant at the source. A real producer
   * offers no such call. Returns false when there is no source to withdraw it from.
   */
  revokeGrant(): boolean;
  /**
   * Synthetic control: the source moves on to its next cut generation, so an export taken
   * before it is behind. A real producer offers no such call. Returns false when there is
   * no source to advance.
   */
  advanceCut(): boolean;
}

export interface StubMerchantOperationsOptions {
  scenario?: MerchantScenario;
  /** Expected tuple override. Used to stage a producer change in tests. */
  expectedTuple?: DiscoveryReadTuple;
}

export interface MerchantEffectCounts {
  reads: number;
  exports: number;
}

export function createStubMerchantOperations(options: StubMerchantOperationsOptions = {}): StubMerchantOperations {
  return new StubMerchantOperations(options);
}

export function createNotBoundMerchantOperations(): MerchantOperationsPort {
  const outcome = { kind: "not-bound", reason: MERCHANT_NOT_BOUND_REASON } as const;
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
    revokeGrant() {
      return false;
    },
    advanceCut() {
      return false;
    },
  };
}

export function merchantOperationsPortFor(
  environment: "stub" | "integration-http",
  options: StubMerchantOperationsOptions = {},
): MerchantOperationsPort {
  if (environment === "stub") {
    return createStubMerchantOperations(options);
  }
  return createNotBoundMerchantOperations();
}

// ---------------------------------------------------------------------------
// Pure checks. The port uses them before it returns a row, and the controller and
// the screen use them to say what a snapshot can and cannot support.
// ---------------------------------------------------------------------------

export type MerchantClaimField = "settled" | "fundsAvailable" | "lendable";

export const MERCHANT_CLAIM_FIELDS: readonly MerchantClaimField[] = ["settled", "fundsAvailable", "lendable"];

/**
 * The first line that does not state each claim field as the literal false. A missing
 * field counts: the source has to say it, and silence is not a no.
 */
export function findMerchantClaim(lines: readonly unknown[]): { obligationRef: string; field: MerchantClaimField } | null {
  for (const line of lines) {
    const record = (typeof line === "object" && line !== null ? line : {}) as Record<string, unknown>;
    for (const field of MERCHANT_CLAIM_FIELDS) {
      if (record[field] !== false) {
        return { obligationRef: typeof record.obligationRef === "string" ? record.obligationRef : "(no reference)", field };
      }
    }
  }
  return null;
}

function refuse(code: MerchantRefusalCode, field: string, ref: string | null, detail: string): MerchantRefused {
  return { kind: "refused", code, field, ref, detail };
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/**
 * Checks a payload the source returned before any row is shown. A failure means the
 * payload cannot be trusted as a whole, so the port returns no row from it.
 */
export function refuseMerchantSnapshot(snapshot: MerchantSnapshot): MerchantRefused | null {
  const cutRefs = new Set(snapshot.cuts.map((cut) => cut.cutRef));
  for (const cut of snapshot.cuts) {
    if (!isMerchantRef(cut.cutRef, "cut")) {
      return refuse("REF", "cutRef", cut.cutRef, `Cut reference ${String(cut.cutRef)} is not a cut reference.`);
    }
  }
  const claim = findMerchantClaim(snapshot.lines);
  if (claim !== null) {
    return refuse(
      "CLAIM",
      claim.field,
      claim.obligationRef,
      `Line ${claim.obligationRef} does not state ${claim.field} as false. A synthetic line is never settled, never available funds, and never lendable.`,
    );
  }
  const rows: { ref: string; kind: MerchantRefKind; row: MerchantRowBase }[] = [
    ...snapshot.events.map((row) => ({ ref: row.eventRef, kind: "event" as const, row })),
    ...snapshot.listings.map((row) => ({ ref: row.listingRef, kind: "listing" as const, row })),
    ...snapshot.trades.map((row) => ({ ref: row.tradeRef, kind: "trade" as const, row })),
    ...snapshot.lines.map((row) => ({ ref: row.obligationRef, kind: "obligation" as const, row })),
  ];
  for (const { ref, kind, row } of rows) {
    if (!isMerchantRef(ref, kind)) {
      return refuse("REF", `${kind}Ref`, String(ref), `Reference ${String(ref)} is not a ${kind} reference.`);
    }
    if (row.merchantRef !== snapshot.scope.merchantRef) {
      return refuse("SCOPE_LEAK", "merchantRef", ref, `Row ${ref} belongs to ${String(row.merchantRef)}, not to the requested scope.`);
    }
    if (!cutRefs.has(row.cutRef)) {
      return refuse("CUT", "cutRef", ref, `Row ${ref} names cut ${String(row.cutRef)}, which the snapshot does not list.`);
    }
  }
  for (const line of snapshot.lines) {
    if (!includes(MERCHANT_LINE_KINDS, line.kind)) {
      return refuse("KIND", "kind", line.obligationRef, `Line ${line.obligationRef} has kind ${String(line.kind)}.`);
    }
    if (!includes(MERCHANT_LINE_STATES, line.state)) {
      return refuse("STATE", "state", line.obligationRef, `Line ${line.obligationRef} has state ${String(line.state)}.`);
    }
    if (!isMerchantAmount(line.amount)) {
      return refuse("AMOUNT", "amount", line.obligationRef, `Line ${line.obligationRef} amount is not a whole-unit string, so it is not shown.`);
    }
    if (line.unit !== MERCHANT_UNIT) {
      return refuse("UNIT", "unit", line.obligationRef, `Line ${line.obligationRef} names unit ${String(line.unit)}, not ${MERCHANT_UNIT}.`);
    }
  }
  for (const row of snapshot.aggregate) {
    const label = `${row.kind}@${row.cutRef}`;
    if (!includes(MERCHANT_LINE_KINDS, row.kind)) {
      return refuse("KIND", "kind", label, `Aggregate kind ${String(row.kind)} is not a line kind.`);
    }
    if (!isMerchantAmount(row.amount)) {
      return refuse("AMOUNT", "amount", label, `Aggregate ${label} amount is not a whole-unit string, so it is not shown.`);
    }
    if (row.unit !== MERCHANT_UNIT) {
      return refuse("UNIT", "unit", label, `Aggregate ${label} names unit ${String(row.unit)}, not ${MERCHANT_UNIT}.`);
    }
  }
  return null;
}

export type MerchantAggregateFlagCode = "STALE_GENERATION" | "COUNT_DIFFERS" | "MISSING" | "UNKNOWN_CUT";

export interface MerchantAggregateFlag {
  code: MerchantAggregateFlagCode;
  kind: MerchantLineKind;
  cutRef: string;
  detail: string;
}

export interface MerchantUnlinked {
  lens: "listings" | "trades" | "obligations";
  ref: string;
  missing: "event" | "listing" | "trade";
  missingRef: string;
}

export interface MerchantAssessment {
  /** none: no rows. single: every row is on one cut. mixed: rows are on more than one cut. */
  cutState: "none" | "single" | "mixed";
  /** Cuts that rows actually name, in the order the snapshot lists them. */
  usedCuts: readonly MerchantCut[];
  aggregate: { state: "current" | "stale" | "mismatch"; flags: readonly MerchantAggregateFlag[] };
  unlinked: readonly MerchantUnlinked[];
}

/**
 * What a snapshot can support. This names inconsistencies and compares labels: cut
 * references, generations, and counts. It adds no amount and compares no amount.
 */
export function assessMerchantSnapshot(snapshot: MerchantSnapshot): MerchantAssessment {
  const named = new Set<string>();
  for (const row of [...snapshot.events, ...snapshot.listings, ...snapshot.trades, ...snapshot.lines]) {
    named.add(row.cutRef);
  }
  const usedCuts = snapshot.cuts.filter((cut) => named.has(cut.cutRef));
  const cutState = usedCuts.length === 0 ? "none" : usedCuts.length === 1 ? "single" : "mixed";

  const flags: MerchantAggregateFlag[] = [];
  const cutByRef = new Map(snapshot.cuts.map((cut) => [cut.cutRef, cut]));
  const covered = new Set<string>();
  for (const row of snapshot.aggregate) {
    covered.add(`${row.kind}|${row.cutRef}`);
    const cut = cutByRef.get(row.cutRef);
    if (cut === undefined) {
      flags.push({ code: "UNKNOWN_CUT", kind: row.kind, cutRef: row.cutRef, detail: `The aggregate names cut ${row.cutRef}, which the snapshot does not list.` });
      continue;
    }
    if (row.generation !== cut.generation) {
      flags.push({
        code: "STALE_GENERATION",
        kind: row.kind,
        cutRef: row.cutRef,
        detail: `The aggregate was built at generation ${row.generation}, and cut ${row.cutRef} is at generation ${cut.generation}.`,
      });
    }
    const counted = snapshot.lines.filter((line) => line.kind === row.kind && line.cutRef === row.cutRef).length;
    if (counted !== row.lineCount) {
      flags.push({
        code: "COUNT_DIFFERS",
        kind: row.kind,
        cutRef: row.cutRef,
        detail: `The aggregate counts ${row.lineCount} ${row.kind} lines on cut ${row.cutRef}, and the read lists ${counted}.`,
      });
    }
  }
  for (const line of snapshot.lines) {
    const key = `${line.kind}|${line.cutRef}`;
    if (!covered.has(key)) {
      covered.add(key);
      flags.push({
        code: "MISSING",
        kind: line.kind,
        cutRef: line.cutRef,
        detail: `The read lists ${line.kind} lines on cut ${line.cutRef} and the source sent no aggregate for them.`,
      });
    }
  }
  const aggregateState = flags.some((flag) => flag.code === "STALE_GENERATION") ? "stale" : flags.length > 0 ? "mismatch" : "current";

  const events = new Set(snapshot.events.map((row) => row.eventRef));
  const listings = new Set(snapshot.listings.map((row) => row.listingRef));
  const trades = new Set(snapshot.trades.map((row) => row.tradeRef));
  const unlinked: MerchantUnlinked[] = [];
  for (const row of snapshot.listings) {
    if (!events.has(row.eventRef)) {
      unlinked.push({ lens: "listings", ref: row.listingRef, missing: "event", missingRef: row.eventRef });
    }
  }
  for (const row of snapshot.trades) {
    if (!listings.has(row.listingRef)) {
      unlinked.push({ lens: "trades", ref: row.tradeRef, missing: "listing", missingRef: row.listingRef });
    }
  }
  for (const line of snapshot.lines) {
    if (!trades.has(line.tradeRef)) {
      unlinked.push({ lens: "obligations", ref: line.obligationRef, missing: "trade", missingRef: line.tradeRef });
    }
  }
  return { cutState, usedCuts, aggregate: { state: aggregateState, flags }, unlinked };
}

export type MerchantExportReason =
  | "NO_SNAPSHOT"
  | "SNAPSHOT_MIXED"
  | "SCOPE"
  | "UNKNOWN_CUT"
  | "MIXED_CUT"
  | "STALE_CUT"
  | "AHEAD_CUT"
  | "PARTIAL"
  | "COUNT"
  | "LINES_DIFFER";

export type MerchantExportVerdict = { state: "current" } | { state: "withheld"; reasons: readonly MerchantExportReason[] };

/**
 * Whether an export is the current export for the last read. It is current only when
 * it is one complete export of one cut, for the same scope, at the generation the read
 * saw (older is stale and newer means the read is behind), and it lists exactly the lines
 * the read lists on that cut. A read that spans cuts has no single export. Anything else
 * is withheld, with every reason that applies. Amounts are compared as text and never added.
 */
export function judgeMerchantExport(
  snapshot: MerchantSnapshot | null,
  assessment: MerchantAssessment | null,
  exported: MerchantExport,
): MerchantExportVerdict {
  const reasons: MerchantExportReason[] = [];
  if (snapshot === null || assessment === null) {
    return { state: "withheld", reasons: ["NO_SNAPSHOT"] };
  }
  if (assessment.cutState === "mixed") {
    reasons.push("SNAPSHOT_MIXED");
  }
  if (exported.scope.tenantId !== snapshot.scope.tenantId || exported.scope.merchantRef !== snapshot.scope.merchantRef) {
    reasons.push("SCOPE");
  }
  const rowCuts = new Set(exported.rows.map((row) => row.cutRef));
  if (rowCuts.size > 1 || [...rowCuts].some((cutRef) => cutRef !== exported.cutRef)) {
    reasons.push("MIXED_CUT");
  }
  const cut = snapshot.cuts.find((item) => item.cutRef === exported.cutRef);
  if (cut === undefined) {
    reasons.push("UNKNOWN_CUT");
  } else if (exported.generation < cut.generation || Date.parse(exported.watermark) < Date.parse(cut.watermark)) {
    reasons.push("STALE_CUT");
  } else if (exported.generation > cut.generation || Date.parse(exported.watermark) > Date.parse(cut.watermark)) {
    reasons.push("AHEAD_CUT");
  }
  if (!exported.complete) {
    reasons.push("PARTIAL");
  }
  if (exported.rows.length !== exported.declaredRowCount) {
    reasons.push("COUNT");
  }
  const exportedByRef = new Map(exported.rows.map((row) => [row.obligationRef, row]));
  const cutLines = snapshot.lines.filter((line) => line.cutRef === exported.cutRef);
  let differs = exportedByRef.size !== exported.rows.length || exportedByRef.size !== cutLines.length;
  if (!differs) {
    for (const line of cutLines) {
      const row = exportedByRef.get(line.obligationRef);
      if (
        row === undefined ||
        row.kind !== line.kind ||
        row.state !== line.state ||
        row.tradeRef !== line.tradeRef ||
        row.amount !== line.amount ||
        row.unit !== line.unit ||
        row.cutRef !== line.cutRef
      ) {
        differs = true;
        break;
      }
    }
  }
  if (differs) {
    reasons.push("LINES_DIFFER");
  }
  return reasons.length === 0 ? { state: "current" } : { state: "withheld", reasons };
}

// ---------------------------------------------------------------------------
// Synthetic source
// ---------------------------------------------------------------------------

const CUT_MAIN = "cut-0001";
const CUT_HOLD = "cut-0002";
const BASE_MAIN_GENERATION = 5;
const HOLD_GENERATION = 3;
const HOLD_WATERMARK = "2026-10-12T06:00:00.000Z";

interface SeedLine {
  obligationRef: string;
  merchantRef: string;
  kind: MerchantLineKind;
  state: MerchantLineState;
  eventRef: string;
  listingRef: string;
  tradeRef: string;
  amount: string;
  reasonCode: string | null;
}

const SEED_EVENTS: readonly Omit<MerchantEventRow, "cutRef">[] = [
  { merchantRef: MERCHANT_OWN_REF, eventRef: "evt-0001", title: "Synthetic Hall night one", statusLabel: "on-sale" },
  { merchantRef: MERCHANT_OWN_REF, eventRef: "evt-0002", title: "Synthetic Hall night two", statusLabel: "closed" },
  { merchantRef: MERCHANT_FOREIGN_REF, eventRef: "evt-0003", title: "Another merchant's event", statusLabel: "on-sale" },
];

const SEED_LISTINGS: readonly Omit<MerchantListingRow, "cutRef">[] = [
  { merchantRef: MERCHANT_OWN_REF, listingRef: "lst-0001", eventRef: "evt-0001", channel: "web-board", statusLabel: "open" },
  { merchantRef: MERCHANT_OWN_REF, listingRef: "lst-0002", eventRef: "evt-0001", channel: "partner-board", statusLabel: "open" },
  { merchantRef: MERCHANT_OWN_REF, listingRef: "lst-0003", eventRef: "evt-0002", channel: "web-board", statusLabel: "superseded" },
  { merchantRef: MERCHANT_FOREIGN_REF, listingRef: "lst-0004", eventRef: "evt-0003", channel: "web-board", statusLabel: "open" },
];

const SEED_TRADES: readonly Omit<MerchantTradeRow, "cutRef">[] = [
  { merchantRef: MERCHANT_OWN_REF, tradeRef: "trd-0001", listingRef: "lst-0001", eventRef: "evt-0001", statusLabel: "payment-observed" },
  { merchantRef: MERCHANT_OWN_REF, tradeRef: "trd-0002", listingRef: "lst-0002", eventRef: "evt-0001", statusLabel: "payment-unknown" },
  { merchantRef: MERCHANT_OWN_REF, tradeRef: "trd-0003", listingRef: "lst-0003", eventRef: "evt-0002", statusLabel: "right-moved" },
  { merchantRef: MERCHANT_FOREIGN_REF, tradeRef: "trd-0004", listingRef: "lst-0004", eventRef: "evt-0003", statusLabel: "booked" },
];

/**
 * Amounts are typed constants of this fixture. The aggregate rows below are typed the
 * same way, because the source owns its totals. No code here adds one amount to another.
 */
const SEED_LINES: readonly SeedLine[] = [
  { obligationRef: "obl-0001", merchantRef: MERCHANT_OWN_REF, kind: "sales-observed", state: "observed", eventRef: "evt-0001", listingRef: "lst-0001", tradeRef: "trd-0001", amount: "1200", reasonCode: null },
  { obligationRef: "obl-0002", merchantRef: MERCHANT_OWN_REF, kind: "sales-observed", state: "observed", eventRef: "evt-0001", listingRef: "lst-0002", tradeRef: "trd-0002", amount: "1200", reasonCode: null },
  { obligationRef: "obl-0003", merchantRef: MERCHANT_OWN_REF, kind: "sales-observed", state: "observed", eventRef: "evt-0002", listingRef: "lst-0003", tradeRef: "trd-0003", amount: "900", reasonCode: null },
  { obligationRef: "obl-0004", merchantRef: MERCHANT_OWN_REF, kind: "unpaid", state: "pending", eventRef: "evt-0001", listingRef: "lst-0001", tradeRef: "trd-0001", amount: "1100", reasonCode: null },
  { obligationRef: "obl-0005", merchantRef: MERCHANT_OWN_REF, kind: "unpaid", state: "pending", eventRef: "evt-0002", listingRef: "lst-0003", tradeRef: "trd-0003", amount: "800", reasonCode: null },
  { obligationRef: "obl-0006", merchantRef: MERCHANT_OWN_REF, kind: "held", state: "observed", eventRef: "evt-0001", listingRef: "lst-0002", tradeRef: "trd-0002", amount: "1100", reasonCode: "HOLD_PAYMENT_UNOBSERVED" },
  { obligationRef: "obl-0007", merchantRef: MERCHANT_OWN_REF, kind: "refund-burden", state: "pending", eventRef: "evt-0002", listingRef: "lst-0003", tradeRef: "trd-0003", amount: "900", reasonCode: "REFUND_REQUESTED" },
  { obligationRef: "obl-0008", merchantRef: MERCHANT_FOREIGN_REF, kind: "unpaid", state: "pending", eventRef: "evt-0003", listingRef: "lst-0004", tradeRef: "trd-0004", amount: "5000", reasonCode: null },
];

/** The source's own figures for the desk merchant. Typed by hand, never computed. */
const SEED_AGGREGATE: readonly { kind: MerchantLineKind; lineCount: number; amount: string }[] = [
  { kind: "sales-observed", lineCount: 3, amount: "3300" },
  { kind: "unpaid", lineCount: 2, amount: "1900" },
  { kind: "held", lineCount: 1, amount: "1100" },
  { kind: "refund-burden", lineCount: 1, amount: "900" },
];

/** What each actor string may read at the synthetic source. A stand-in for an authority. */
const GRANTS: ReadonlyMap<string, readonly string[]> = new Map([[MERCHANT_DESK_ACTOR, [MERCHANT_OWN_REF]]]);

const EXCEPTION_SEEDS: Readonly<Record<string, { state: MerchantLineState; reasonCode: string | null }>> = {
  "obl-0002": { state: "unknown", reasonCode: null },
  "obl-0004": { state: "exception", reasonCode: "UNMATCHED" },
  "obl-0005": { state: "exception", reasonCode: "DUPLICATE" },
  "obl-0006": { state: "exception", reasonCode: "LATE" },
  "obl-0007": { state: "exception", reasonCode: "MISMATCH" },
};

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toLine(seed: SeedLine, cutRef: string): MerchantLine {
  return {
    obligationRef: seed.obligationRef,
    merchantRef: seed.merchantRef,
    kind: seed.kind,
    state: seed.state,
    eventRef: seed.eventRef,
    listingRef: seed.listingRef,
    tradeRef: seed.tradeRef,
    amount: seed.amount,
    unit: MERCHANT_UNIT,
    cutRef,
    reasonCode: seed.reasonCode,
    settled: false,
    fundsAvailable: false,
    lendable: false,
  };
}

/** Synthetic source. State lives in this object, so a new port is a new session. */
export class StubMerchantOperations implements MerchantOperationsPort {
  readonly environment = "stub" as const;
  readonly source = "synthetic-merchant" as const;
  readonly scenario: MerchantScenario;
  private readonly expectedTuple: DiscoveryReadTuple;
  private snapshotSerial = 0;
  private revoked = false;
  private advanced = 0;
  private readonly counts: MerchantEffectCounts = { reads: 0, exports: 0 };

  constructor(options: StubMerchantOperationsOptions) {
    this.scenario = options.scenario ?? "clean";
    this.expectedTuple = options.expectedTuple ?? DISCOVERY_READ_TUPLE_LITERALS;
  }

  /** Test seam. Counts of what reached the source. Not part of the port. */
  effects(): MerchantEffectCounts {
    return { ...this.counts };
  }

  revokeGrant(): boolean {
    this.revoked = true;
    return true;
  }

  advanceCut(): boolean {
    this.advanced += 1;
    return true;
  }

  private mainGeneration(): number {
    return BASE_MAIN_GENERATION + this.advanced;
  }

  read(request: MerchantReadRequest): Promise<MerchantReadOutcome> {
    this.counts.reads += 1;
    if (this.scenario === "read-lost") {
      return Promise.reject(new Error("The answer to the read never arrived."));
    }
    return Promise.resolve(this.readNow(request));
  }

  readExport(request: MerchantExportRequest): Promise<MerchantExportOutcome> {
    this.counts.exports += 1;
    return Promise.resolve(this.exportNow(request));
  }

  private gate(request: { contextKey: unknown; actorRef: unknown; scope: MerchantScope }): MerchantInvalid | MerchantDenied | null {
    if (!isNonEmpty(request.contextKey)) {
      return { kind: "invalid-request", code: "CONTEXT", detail: "A read carries a context key." };
    }
    if (!isNonEmpty(request.actorRef)) {
      return { kind: "invalid-request", code: "ACTOR", detail: "A read carries an actor string. It is a label, not an authentication result." };
    }
    const scope = request.scope as Partial<MerchantScope> | null | undefined;
    if (scope?.tenantId !== MERCHANT_TENANT || !isMerchantRef(scope.merchantRef, "merchant")) {
      return { kind: "invalid-request", code: "SCOPE", detail: `A scope names tenant ${MERCHANT_TENANT} and a merchant reference.` };
    }
    if (this.revoked || this.scenario === "denied") {
      return { kind: "denied", code: "GRANT_REVOKED", merchantRef: scope.merchantRef, detail: "The grant for this actor was withdrawn at the source. No row is returned." };
    }
    const granted = GRANTS.get(String(request.actorRef)) ?? [];
    if (!granted.includes(scope.merchantRef)) {
      return { kind: "denied", code: "SCOPE_DENIED", merchantRef: scope.merchantRef, detail: "This actor holds no grant for that merchant at the source. No row is returned." };
    }
    return null;
  }

  private readNow(request: MerchantReadRequest): MerchantReadOutcome {
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
    const watermark = this.scenario === "stale" ? MERCHANT_STALE_WATERMARK : MERCHANT_AS_OF;
    const floor = request.watermarkFloor ?? (this.scenario === "stale" ? MERCHANT_STALE_FLOOR : null);
    if (floor !== null && Date.parse(watermark) < Date.parse(floor)) {
      return { kind: "stale", watermark, floor };
    }
    if (this.scenario === "empty") {
      return { kind: "empty", watermark, snapshotId: this.snapshotSerial, scope: { ...request.scope } };
    }
    const snapshot = this.buildSnapshot(request.scope, watermark);
    const refused = refuseMerchantSnapshot(snapshot);
    if (refused !== null) {
      return refused;
    }
    return { kind: "ready", snapshot };
  }

  private cuts(): MerchantCut[] {
    const main: MerchantCut = { cutRef: CUT_MAIN, source: "merchant-ledger", generation: this.mainGeneration(), watermark: MERCHANT_AS_OF };
    if (this.scenario === "mixed-cut") {
      return [main, { cutRef: CUT_HOLD, source: "hold-register", generation: HOLD_GENERATION, watermark: HOLD_WATERMARK }];
    }
    return [main];
  }

  /** The cut a line sits on. Only the mixed-cut scenario puts anything off the main cut. */
  private cutOf(seed: SeedLine): string {
    return this.scenario === "mixed-cut" && seed.kind === "held" ? CUT_HOLD : CUT_MAIN;
  }

  private linesFor(merchant: string): MerchantLine[] {
    return SEED_LINES.filter((seed) => seed.merchantRef === merchant).map((seed) => {
      const exception = this.scenario === "exceptions" ? EXCEPTION_SEEDS[seed.obligationRef] : undefined;
      const shaped = exception ? { ...seed, state: exception.state, reasonCode: exception.reasonCode } : seed;
      const line = toLine(shaped, this.cutOf(seed));
      if (this.scenario === "dangling-link" && seed.obligationRef === "obl-0007") {
        return { ...line, tradeRef: "trd-0099" };
      }
      if (this.scenario === "claims-settled" && seed.obligationRef === "obl-0001") {
        return { ...line, settled: true } as unknown as MerchantLine;
      }
      return line;
    });
  }

  private aggregateFor(lines: readonly MerchantLine[]): MerchantAggregateRow[] {
    const rows: MerchantAggregateRow[] = [];
    for (const figure of SEED_AGGREGATE) {
      const cutRef = lines.find((line) => line.kind === figure.kind)?.cutRef ?? CUT_MAIN;
      const cutGeneration = cutRef === CUT_HOLD ? HOLD_GENERATION : this.mainGeneration();
      let lineCount = figure.lineCount;
      let generation = cutGeneration;
      if (this.scenario === "stale-aggregate") {
        generation = cutGeneration - 1;
      }
      if (this.scenario === "aggregate-mismatch" && figure.kind === "unpaid") {
        lineCount = figure.lineCount + 1;
      }
      rows.push({ kind: figure.kind, cutRef, generation, lineCount, amount: figure.amount, unit: MERCHANT_UNIT });
    }
    return rows;
  }

  private buildSnapshot(scope: MerchantScope, watermark: string): MerchantSnapshot {
    const own = scope.merchantRef;
    const cutOfMain = CUT_MAIN;
    const events = SEED_EVENTS.filter((row) => row.merchantRef === own).map((row) => ({ ...row, cutRef: cutOfMain }));
    const listings = SEED_LISTINGS.filter((row) => row.merchantRef === own).map((row) => ({ ...row, cutRef: cutOfMain }));
    const trades = SEED_TRADES.filter((row) => row.merchantRef === own).map((row) => ({ ...row, cutRef: cutOfMain }));
    if (this.scenario === "scope-leak") {
      const leaked = SEED_TRADES.find((row) => row.merchantRef === MERCHANT_FOREIGN_REF);
      if (leaked) {
        trades.push({ ...leaked, cutRef: cutOfMain });
      }
    }
    const lines = this.linesFor(own);
    return {
      snapshotId: this.snapshotSerial,
      watermark,
      scenario: this.scenario,
      scope: { ...scope },
      cuts: this.cuts(),
      events,
      listings,
      trades,
      lines,
      aggregate: this.aggregateFor(lines),
    };
  }

  private exportNow(request: MerchantExportRequest): MerchantExportOutcome {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return { kind: "tuple-changed", field: tuple.field, expected: tuple.expected, actual: tuple.actual };
    }
    const refusedRequest = this.gate(request);
    if (refusedRequest !== null) {
      return refusedRequest;
    }
    if (this.scenario === "export-denied") {
      return { kind: "denied", code: "EXPORT_DENIED", merchantRef: request.scope.merchantRef, detail: "The source grants this actor a read and no export. No export is returned." };
    }
    // An export belongs to one cut, so it lists only the lines on that cut.
    const lines = this.linesFor(request.scope.merchantRef).filter((line) => line.cutRef === CUT_MAIN);
    let rows: MerchantExportRow[] = lines.map((line) => ({
      obligationRef: line.obligationRef,
      kind: line.kind,
      state: line.state,
      tradeRef: line.tradeRef,
      amount: line.amount,
      unit: line.unit,
      cutRef: line.cutRef,
    }));
    const declared = lines.length;
    let generation = this.mainGeneration();
    let watermark = MERCHANT_AS_OF;
    let complete = true;
    if (this.scenario === "export-partial") {
      rows = rows.slice(0, rows.length - 2);
      complete = false;
    }
    if (this.scenario === "export-stale") {
      generation = this.mainGeneration() - 1;
      watermark = HOLD_WATERMARK;
    }
    if (this.scenario === "export-lines-differ") {
      rows = rows.map((row) => (row.obligationRef === "obl-0004" ? { ...row, amount: "1010" } : row));
    }
    const exported: MerchantExport = {
      exportRef: "exp-0001",
      scope: { ...request.scope },
      cutRef: CUT_MAIN,
      generation,
      watermark,
      declaredRowCount: declared,
      complete,
      digest: "syn-digest-0001",
      rows,
    };
    const refused = refuseMerchantExport(exported, request.scope);
    if (refused !== null) {
      return refused;
    }
    return { kind: "ready", export: exported };
  }
}

/** Checks an export payload before it is returned. Consistency with a read is judged later. */
export function refuseMerchantExport(exported: MerchantExport, requested: MerchantScope): MerchantRefused | null {
  if (!isMerchantRef(exported.exportRef, "export")) {
    return refuse("REF", "exportRef", String(exported.exportRef), `Reference ${String(exported.exportRef)} is not an export reference.`);
  }
  if (exported.scope.merchantRef !== requested.merchantRef || exported.scope.tenantId !== requested.tenantId) {
    return refuse("SCOPE_LEAK", "scope", exported.exportRef, "The export names a scope other than the one requested.");
  }
  for (const row of exported.rows) {
    if (!isMerchantRef(row.obligationRef, "obligation")) {
      return refuse("REF", "obligationRef", String(row.obligationRef), `Reference ${String(row.obligationRef)} is not an obligation reference.`);
    }
    if (!includes(MERCHANT_LINE_KINDS, row.kind)) {
      return refuse("KIND", "kind", row.obligationRef, `Export row ${row.obligationRef} has kind ${String(row.kind)}.`);
    }
    if (!isMerchantAmount(row.amount)) {
      return refuse("AMOUNT", "amount", row.obligationRef, `Export row ${row.obligationRef} amount is not a whole-unit string, so it is not shown.`);
    }
    if (row.unit !== MERCHANT_UNIT) {
      return refuse("UNIT", "unit", row.obligationRef, `Export row ${row.obligationRef} names unit ${String(row.unit)}, not ${MERCHANT_UNIT}.`);
    }
  }
  return null;
}
