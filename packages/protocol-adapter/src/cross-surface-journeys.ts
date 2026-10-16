import { JOURNEY_NOT_COMPOSED } from "./booking-journey.js";
import { COMMERCE_COMMAND_BINDINGS } from "./commerce-bindings.js";
import { DISCOVERY_PROJECTION_AS_OF } from "./discovery-read.js";
import { PLATFORM_REFUND_NOT_BOUND } from "./platform-journey.js";
import { isRecord } from "./record.js";

/**
 * Cross-surface journey table: one row for each journey and branch, read from the
 * synthetic sources that already exist. It states, per row, the last confirmed
 * leg, the requests nobody confirmed, the next actions that are blocked, and the
 * compensation path. It sends nothing of its own: every leg is either read from a
 * sibling stub run in this process, copied from the qualification packet, or a
 * pointer to the test that already pins the branch.
 *
 * Rules, all tested:
 *  - A row status comes from the whole leg sequence. A confirmed leg is not a
 *    close. An UNKNOWN leg is never read as done and never read as failed.
 *  - The compensation cell has three words: NONE_NEEDED, FENCED, and
 *    COMPENSATION_UNDEFINED. No cell names a refund, a cancel, a reverse, or any
 *    automatic command, and this module composes none.
 *  - A branch that no source can reproduce is a visible no-source-branch row. It
 *    is never filled in and never counted as a success.
 *  - A table that claims a completed journey, an executed compensation, a
 *    resolved UNKNOWN, a payment, or a production environment is refused whole.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const CROSS_SURFACE_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const CROSS_SURFACE_NOT_BOUND_REASON =
  "No current producer tuple exists for cross-surface journeys: pending node c-cross-surface-journeys is not promoted, and the producer contracts it waits on are not merged. The table stays not-bound on integration-http and no request is made.";

export const CROSS_SURFACE_AS_OF = DISCOVERY_PROJECTION_AS_OF;

export const CROSS_SURFACE_DESK_ACTOR = "journey-table-reader";

export const CROSS_SURFACE_STATE = "STUB_TABLE_RECORDED" as const;

export const CROSS_SURFACE_JOURNEYS = [
  "purchase-booking",
  "purchase-provider",
  "resale-platform",
  "gift",
  "refund",
  "marketing-benefit",
  "delegation",
  "credit-servicing",
  "organizer",
  "session-recovery",
] as const;

export type CrossSurfaceJourney = (typeof CROSS_SURFACE_JOURNEYS)[number];

export const CROSS_SURFACE_BRANCHES = ["normal", "explicit-reject", "response-lost", "partial-success"] as const;

export type CrossSurfaceBranch = (typeof CROSS_SURFACE_BRANCHES)[number];

export const CROSS_SURFACE_SCENARIOS = ["clean", "held", "read-lost", "claims-pass", "empty"] as const;

export type CrossSurfaceScenario = (typeof CROSS_SURFACE_SCENARIOS)[number];

export const CROSS_SURFACE_LEG_OUTCOMES = [
  "RECEIPT",
  "CONFIRMED",
  "OBSERVED",
  "REJECTED",
  "UNKNOWN",
  "FENCED",
  "NOT_SENT",
  "NOT_BOUND",
] as const;

export type CrossSurfaceLegOutcome = (typeof CROSS_SURFACE_LEG_OUTCOMES)[number];

/** `reference` is a pointer-only row: its legs were not run here. */
export const CROSS_SURFACE_STATUSES = ["closed", "rejected", "unknown", "partial", "blocked", "reference"] as const;

export type CrossSurfaceStatus = (typeof CROSS_SURFACE_STATUSES)[number];

export const CROSS_SURFACE_BASES = ["executed", "reused", "no-source-branch"] as const;

export type CrossSurfaceBasis = (typeof CROSS_SURFACE_BASES)[number];

export const CROSS_SURFACE_COMPENSATION_STATES = ["NONE_NEEDED", "FENCED", "COMPENSATION_UNDEFINED"] as const;

export type CrossSurfaceCompensationState = (typeof CROSS_SURFACE_COMPENSATION_STATES)[number];

/** The claims this table always states as literal false. A table that claims one is refused whole. */
export const CROSS_SURFACE_NON_CLAIM_FIELDS = [
  "journeyCompleteClaimed",
  "compensationExecuted",
  "unknownResolved",
  "realPayment",
  "fundsMoved",
  "productionEnvironment",
  "realIntegrationComplete",
] as const;

export type CrossSurfaceNonClaimField = (typeof CROSS_SURFACE_NON_CLAIM_FIELDS)[number];

export type CrossSurfaceNonClaims = Readonly<Record<CrossSurfaceNonClaimField, false>>;

export const CROSS_SURFACE_NON_CLAIMS: CrossSurfaceNonClaims = {
  journeyCompleteClaimed: false,
  compensationExecuted: false,
  unknownResolved: false,
  realPayment: false,
  fundsMoved: false,
  productionEnvironment: false,
  realIntegrationComplete: false,
};

/** Quote of the locked hold binding. H1 keeps this consideredAction and keeps it not-bound. */
export const CROSS_SURFACE_HOLD_NOT_BOUND = {
  method: "placeHold",
  status: COMMERCE_COMMAND_BINDINGS.placeHold.status,
  consideredAction: COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction,
  reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
  mappedOntoPrepareTrade: false,
} as const;

export interface CrossSurfaceNotComposed {
  action: string;
  reason: string;
}

/**
 * Actions this table records and never composes: the journey list, the refund
 * record, and the opposite commands of the journeys it reads. Spread from the
 * existing list, not copied.
 */
export const CROSS_SURFACE_NOT_COMPOSED: readonly CrossSurfaceNotComposed[] = [
  ...JOURNEY_NOT_COMPOSED.map((item) => ({ action: item.action as string, reason: item.reason })),
  { action: PLATFORM_REFUND_NOT_BOUND.action, reason: PLATFORM_REFUND_NOT_BOUND.reason },
  { action: "cancel_gift", reason: "A gift cancel is the opposite command of an offer. No compensation is approved, so this table never sends it." },
  { action: "cancel_event", reason: "An event cancel is the opposite command of a create. No compensation is approved, so this table never sends it." },
  { action: "cancel-draft", reason: "A draft cancel is the opposite command of a staged draft. No compensation is approved, so this table never sends it." },
  { action: "reclaim", reason: "A benefit reclaim is the opposite command of an apply. The marketing desk sends it only on the user's own approval, and this table sends none." },
];

export interface CrossSurfaceLeg {
  label: string;
  outcome: CrossSurfaceLegOutcome;
  code: string | null;
  note: string;
}

export interface CrossSurfaceReuse {
  /** Repository-relative path of the test that already pins the branch. */
  testPath: string;
  /** A substring of the title of the test that pins it. */
  testTitle: string;
  /** The operational-qualification journey whose legs this row copies, or null for a pointer. */
  qualificationJourneyId: string | null;
}

export interface CrossSurfaceBlockedNext {
  action: string;
  reason: string;
}

export interface CrossSurfaceCompensation {
  state: CrossSurfaceCompensationState;
  note: string;
}

export interface CrossSurfaceRow {
  /** xs.<journey>.<branch> */
  id: string;
  journey: CrossSurfaceJourney;
  branch: CrossSurfaceBranch;
  basis: CrossSurfaceBasis;
  /** The sibling scenario or test the legs come from. Free text, not an identifier. */
  source: string;
  reuse: CrossSurfaceReuse | null;
  /** The label of the leg that closes this journey. Null for a pointer or a missing branch. */
  terminal: string | null;
  legs: readonly CrossSurfaceLeg[];
  status: CrossSurfaceStatus;
  lastConfirmed: string;
  unconfirmed: readonly string[];
  blockedNext: readonly CrossSurfaceBlockedNext[];
  compensation: CrossSurfaceCompensation;
  note: string;
}

export interface CrossSurfaceTable {
  tableId: string;
  asOf: string;
  state: typeof CROSS_SURFACE_STATE;
  ruling: string;
  environment: "stub" | "integration-http";
  rows: readonly CrossSurfaceRow[];
  notComposed: readonly CrossSurfaceNotComposed[];
  holdNotBound: typeof CROSS_SURFACE_HOLD_NOT_BOUND;
  nonClaims: CrossSurfaceNonClaims;
}

// ---------------------------------------------------------------------------
// Row judgement: status, last confirmed, unconfirmed, compensation
// ---------------------------------------------------------------------------

const CONFIRMED_WRITE = new Set<CrossSurfaceLegOutcome>(["RECEIPT", "CONFIRMED"]);
const GOOD = new Set<CrossSurfaceLegOutcome>(["RECEIPT", "CONFIRMED", "OBSERVED"]);

export function rowIdFor(journey: CrossSurfaceJourney, branch: CrossSurfaceBranch): string {
  return `xs.${journey}.${branch}`;
}

/**
 * The status of a leg sequence. It reads the whole sequence: a confirmed leg
 * closes the row only when the terminal leg is confirmed and no earlier leg is
 * anything but confirmed or observed.
 */
export function judgeLegs(legs: readonly CrossSurfaceLeg[], terminal: string | null): Exclude<CrossSurfaceStatus, "reference"> {
  const terminalIndex = terminal === null ? -1 : legs.findIndex((item) => item.label === terminal);
  const upTo = terminalIndex < 0 ? legs : legs.slice(0, terminalIndex + 1);
  const terminalLeg = terminalIndex < 0 ? null : legs[terminalIndex];
  if (terminalLeg !== null && terminalLeg !== undefined && CONFIRMED_WRITE.has(terminalLeg.outcome) && upTo.every((item) => GOOD.has(item.outcome))) {
    return "closed";
  }
  const hasConfirmedWrite = legs.some((item) => CONFIRMED_WRITE.has(item.outcome));
  const hasUnknown = legs.some((item) => item.outcome === "UNKNOWN");
  const hasRejected = legs.some((item) => item.outcome === "REJECTED");
  if (hasConfirmedWrite) {
    // A leg landed and the run did not close: some of it landed and the rest did not.
    return "partial";
  }
  if (hasUnknown) {
    return "unknown";
  }
  if (hasRejected) {
    return "rejected";
  }
  return "blocked";
}

export function lastConfirmedOf(legs: readonly CrossSurfaceLeg[]): string {
  for (let index = legs.length - 1; index >= 0; index -= 1) {
    const item = legs[index];
    if (item !== undefined && CONFIRMED_WRITE.has(item.outcome)) {
      return item.label;
    }
  }
  return "none";
}

export function unconfirmedOf(legs: readonly CrossSurfaceLeg[]): string[] {
  return legs.filter((item) => item.outcome === "UNKNOWN").map((item) => item.label);
}

export function blockedNextOf(legs: readonly CrossSurfaceLeg[]): CrossSurfaceBlockedNext[] {
  return legs
    .filter((item) => item.outcome === "FENCED" || item.outcome === "NOT_SENT" || item.outcome === "NOT_BOUND")
    .map((item) => ({ action: item.label, reason: item.code === null ? item.note : `${item.code}: ${item.note}` }));
}

/**
 * The compensation cell follows the status and nothing else. A partial run is
 * COMPENSATION_UNDEFINED: a leg landed and a later one did not, and no
 * compensation path is approved. It is never filled in with a command.
 */
export function compensationFor(status: CrossSurfaceStatus): CrossSurfaceCompensation {
  switch (status) {
    case "closed":
      return { state: "NONE_NEEDED", note: "The run stopped at its own last leg. Nothing in this table needs undoing." };
    case "rejected":
    case "blocked":
      return { state: "NONE_NEEDED", note: "No leg was confirmed, so there is nothing to undo here." };
    case "unknown":
      return {
        state: "FENCED",
        note: "The request may have applied. Later writes stay fenced, and this table sends no opposite command and does not resolve it.",
      };
    case "partial":
      return {
        state: "COMPENSATION_UNDEFINED",
        note: "A leg is confirmed and a later one is not. No compensation path is approved or defined, and this table composes none.",
      };
    case "reference":
      return { state: "COMPENSATION_UNDEFINED", note: "Pointer row. Its legs were not run here and no compensation path is defined." };
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Refusal: a table that claims what it can never claim
// ---------------------------------------------------------------------------

export interface CrossSurfaceRefusal {
  code: "CLAIM" | "SHAPE" | "STATUS";
  detail: string;
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

function refuseLeg(rowId: string, value: unknown): CrossSurfaceRefusal | null {
  if (!isRecord(value) || typeof value.label !== "string" || !includes(CROSS_SURFACE_LEG_OUTCOMES, value.outcome)) {
    return { code: "SHAPE", detail: `Row ${rowId} carries a leg that is not a leg.` };
  }
  return null;
}

/** Null when the table may be shown. Otherwise the reason it is refused whole. */
export function refuseCrossSurfaceTable(table: unknown): CrossSurfaceRefusal | null {
  if (!isRecord(table) || !Array.isArray(table.rows) || !isRecord(table.nonClaims)) {
    return { code: "SHAPE", detail: "The table is not a cross-surface table." };
  }
  for (const field of CROSS_SURFACE_NON_CLAIM_FIELDS) {
    if (table.nonClaims[field] !== false) {
      return { code: "CLAIM", detail: `The table states ${field} as something other than the literal false.` };
    }
  }
  if (table.state !== CROSS_SURFACE_STATE) {
    return { code: "CLAIM", detail: "The table states a state other than STUB_TABLE_RECORDED." };
  }
  const seen = new Set<string>();
  for (const row of table.rows) {
    if (!isRecord(row) || typeof row.id !== "string") {
      return { code: "SHAPE", detail: "A row is not a row." };
    }
    if (!includes(CROSS_SURFACE_JOURNEYS, row.journey) || !includes(CROSS_SURFACE_BRANCHES, row.branch) || row.id !== rowIdFor(row.journey, row.branch)) {
      return { code: "SHAPE", detail: `Row ${row.id} does not name its journey and branch.` };
    }
    if (seen.has(row.id)) {
      return { code: "SHAPE", detail: `Row ${row.id} appears twice.` };
    }
    seen.add(row.id);
    if (!includes(CROSS_SURFACE_STATUSES, row.status) || !includes(CROSS_SURFACE_BASES, row.basis) || !Array.isArray(row.legs)) {
      return { code: "SHAPE", detail: `Row ${row.id} has an unknown status, basis, or legs.` };
    }
    for (const item of row.legs) {
      const bad = refuseLeg(row.id, item);
      if (bad !== null) {
        return bad;
      }
    }
    if (!isRecord(row.compensation) || !includes(CROSS_SURFACE_COMPENSATION_STATES, row.compensation.state)) {
      return { code: "SHAPE", detail: `Row ${row.id} has a compensation cell outside the three words.` };
    }
    if (row.status === "closed" && row.legs.length === 0) {
      return { code: "STATUS", detail: `Row ${row.id} states closed and has no leg that closes it.` };
    }
    if (Array.isArray(row.unconfirmed) && row.unconfirmed.length > 0 && row.compensation.state === "NONE_NEEDED") {
      return { code: "STATUS", detail: `Row ${row.id} has an unconfirmed request and says no compensation is needed.` };
    }
    if (row.status !== "reference" && row.basis !== "no-source-branch" && row.legs.length > 0) {
      const legs = row.legs as unknown as readonly CrossSurfaceLeg[];
      const terminal = typeof row.terminal === "string" ? row.terminal : null;
      const expected = judgeLegs(legs, terminal);
      if (expected !== row.status) {
        return { code: "STATUS", detail: `Row ${row.id} states ${String(row.status)} but its legs read ${expected}.` };
      }
      if (legs.some((item) => item.outcome === "UNKNOWN") && row.compensation.state === "NONE_NEEDED") {
        return { code: "STATUS", detail: `Row ${row.id} has an unconfirmed request and says no compensation is needed.` };
      }
    }
  }
  return null;
}
