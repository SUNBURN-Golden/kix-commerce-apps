/**
 * The journey x outcome matrix this suite answers for. App-internal; not a public schema.
 *
 * BROWSER       a check in this suite drove headless Chrome to that screen.
 * REFERENCE     the screen exists, and its text is asserted, but the outcome is not produced by a user action.
 * NOT_REACHABLE the stub cannot produce this outcome without a fault hook, so no hook is added to production source.
 */
export const JOURNEYS = ["box-office", "booking", "admission", "resale", "credit", "gift", "organizer", "receipts"] as const;
export type JourneyId = (typeof JOURNEYS)[number];

export const OUTCOMES = ["SUCCESS", "REJECT", "UNKNOWN", "NOT_BOUND"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export type CellKind = "BROWSER" | "REFERENCE" | "NOT_REACHABLE";

export interface MatrixCell {
  journey: JourneyId;
  outcome: Outcome;
  kind: CellKind;
  /** Required for BROWSER, optional for REFERENCE. The check must have run and passed in this run. */
  checkId?: string;
  /** Required for REFERENCE and NOT_REACHABLE. Where the outcome is covered, or why it is not reachable. */
  pointer?: string;
  /** Required for REFERENCE and NOT_REACHABLE. The node or test that owns it. */
  owner?: string;
  note?: string;
}

const FAULT = "c-fault-injection-stub";
const unreachable = (journey: JourneyId): MatrixCell => ({
  journey,
  outcome: "UNKNOWN",
  kind: "NOT_REACHABLE",
  pointer: "The stub-shape desk never loses a response, so no UNKNOWN screen exists to drive.",
  owner: FAULT,
});
const browser = (journey: JourneyId, outcome: Outcome, checkId = `${journey}.${outcome}`, note?: string): MatrixCell => ({
  journey,
  outcome,
  kind: "BROWSER",
  checkId,
  ...(note ? { note } : {}),
});
const tableReference = (journey: JourneyId, key: string): MatrixCell => ({
  journey,
  outcome: "UNKNOWN",
  kind: "REFERENCE",
  checkId: `journeys-table.RESPONSE_LOST.${key}`,
  pointer: "The Journeys table row for this journey's Response lost branch is a reused reference row (not run on that page) with a FENCED or COMPENSATION_UNDEFINED word. Nothing is closed.",
  owner: "c-cross-surface-journeys-stub",
  note: "The desk itself never loses a response in stub mode, so the table row is the only UNKNOWN text for this journey.",
});

export const MATRIX: readonly MatrixCell[] = [
  browser("box-office", "SUCCESS"),
  browser("box-office", "REJECT"),
  unreachable("box-office"),
  browser("box-office", "NOT_BOUND"),

  browser("booking", "SUCCESS"),
  browser("booking", "REJECT"),
  tableReference("booking", "booking"),
  browser("booking", "NOT_BOUND"),

  browser("admission", "SUCCESS"),
  browser("admission", "REJECT"),
  unreachable("admission"),
  browser("admission", "NOT_BOUND"),

  browser("resale", "SUCCESS"),
  browser("resale", "REJECT"),
  tableReference("resale", "resale"),
  browser("resale", "NOT_BOUND"),

  browser("credit", "SUCCESS"),
  browser("credit", "REJECT"),
  unreachable("credit"),
  browser("credit", "NOT_BOUND"),

  browser("gift", "SUCCESS"),
  browser("gift", "REJECT", "gift.REJECT", "A not-sent screen: the desk refuses to send an incomplete body. It is not a gate rejection."),
  tableReference("gift", "gift"),
  browser("gift", "NOT_BOUND"),

  browser("organizer", "SUCCESS"),
  browser("organizer", "REJECT", "organizer.REJECT", "A not-sent screen: the desk refuses to send an incomplete body. It is not a gate rejection."),
  tableReference("organizer", "organizer"),
  browser("organizer", "NOT_BOUND"),

  browser("receipts", "SUCCESS"),
  browser("receipts", "REJECT", "receipts.REJECT", "The empty and nothing-kept-aside screens. The reader has no reject of its own."),
  {
    journey: "receipts",
    outcome: "UNKNOWN",
    kind: "REFERENCE",
    checkId: "receipts.UNKNOWN.read-note",
    pointer: "The read note says a read never turns an unknown outcome into a confirmed receipt.",
    owner: "c-receipt-explorer",
  },
  browser("receipts", "NOT_BOUND"),
];

export const SHARED_CHECKS = [
  "connectivity.all-screens", "connectivity.no-service-worker", "connectivity.form-and-refresh", "connectivity.no-replay",
  "harness.server",
  "harness.paths",
  "harness.external-blocked",
  "harness.redaction","session.UNKNOWN", "journeys-page.UNKNOWN", "one-attempt.double-click", "one-attempt.keyboard", "one-attempt.reload"] as const;

export function expectedCheckIds(): string[] {
  const ids = new Set<string>(SHARED_CHECKS);
  for (const cell of MATRIX) {
    if (cell.checkId) {
      ids.add(cell.checkId);
    }
  }
  return [...ids].sort();
}

/** Returns the problems with the matrix itself: a missing cell, or a cell without its evidence field. */
export function matrixProblems(): string[] {
  const problems: string[] = [];
  for (const journey of JOURNEYS) {
    for (const outcome of OUTCOMES) {
      const cells = MATRIX.filter((cell) => cell.journey === journey && cell.outcome === outcome);
      if (cells.length !== 1) {
        problems.push(`${journey}/${outcome}: ${cells.length} cells`);
      }
    }
  }
  for (const cell of MATRIX) {
    if (cell.kind === "BROWSER" && !cell.checkId) {
      problems.push(`${cell.journey}/${cell.outcome}: BROWSER cell without a checkId`);
    }
    if (cell.kind !== "BROWSER" && (!cell.pointer || !cell.owner)) {
      problems.push(`${cell.journey}/${cell.outcome}: ${cell.kind} cell without pointer and owner`);
    }
  }
  return problems;
}
