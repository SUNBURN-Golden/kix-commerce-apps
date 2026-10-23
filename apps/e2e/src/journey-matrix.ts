export { DEV_SCREENS, GALLERY_CHECK_IDS } from "./gallery-matrix";
/**
 * The journey x outcome matrix this suite answers for. App-internal; not a public schema.
 *
 * BROWSER       a check in this suite drove headless Chrome to that screen.
 * REFERENCE     the screen exists, and its text is asserted, but the outcome is not produced by a user action.
 * NOT_REACHABLE the stub cannot produce this outcome without a fault hook, so no hook is added to production source.
 */
export const JOURNEYS = ["box-office", "booking", "admission", "resale", "credit", "gift", "organizer", "receipts",
  "buyer", "discovery", "inventory", "mobile", "assistant", "organizer-workspace", "merchant", "finance", "provider", "credit-origination", "credit-servicing", "marketing", "marketing-journey", "platform", "marketplace-performance", "permissions", "notifications", "identity", "session", "journeys", "qualification", "release", "marketing-m01", "marketing-m02", "marketing-m03", "marketing-m04", "marketing-m05"] as const;
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
  browser("gift", "REJECT", "gift.REJECT", "Local input-format rejection: the form refuses an incomplete body before creating a controller attempt. It is not a gate rejection."),
  tableReference("gift", "gift"),
  browser("gift", "NOT_BOUND"),

  browser("organizer", "SUCCESS"),
  browser("organizer", "REJECT", "organizer.REJECT", "Local input-format rejection: the form refuses an incomplete body before creating a controller attempt. It is not a gate rejection."),
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
  browser("buyer", "SUCCESS"),
  browser("buyer", "REJECT", "buyer.REJECT", "Empty receipt and nothing-kept-aside screens, not a producer rejection."),
  {"journey": "buyer", "outcome": "UNKNOWN", "kind": "REFERENCE", "pointer": "apps/e2e/tests/journeys/receipts.e2e.test.ts receipts.UNKNOWN.read-note: an observation cannot confirm an unknown write.", "owner": "c-receipt-explorer"},
  browser("buyer", "NOT_BOUND"),

  browser("discovery", "SUCCESS"),
  browser("discovery", "REJECT", "discovery.REJECT", "Synthetic conflicting filter refused by the discovery source."),
  {"journey": "discovery", "outcome": "UNKNOWN", "kind": "REFERENCE", "pointer": "apps/e2e/tests/shared.e2e.test.ts journeys-table.RESPONSE_LOST.booking: reused booking lost-response row. Discovery search has no lost write.", "owner": "c-cross-surface-journeys-stub"},
  browser("discovery", "NOT_BOUND"),

  browser("inventory", "SUCCESS"),
  browser("inventory", "REJECT", "inventory.REJECT", "Queue-lapsed local selection refusal; nothing sent."),
  {"journey": "inventory", "outcome": "UNKNOWN", "kind": "REFERENCE", "pointer": "packages/protocol-adapter/src/inventory-read.ts INVENTORY_SCENARIOS has no lost response scenario; selection is local.", "owner": "c-inventory-venue-stub"},
  browser("inventory", "NOT_BOUND"),

  browser("mobile", "SUCCESS"),
  browser("mobile", "REJECT"),
  browser("mobile", "UNKNOWN", "mobile.UNKNOWN"),
  browser("mobile", "NOT_BOUND"),

  browser("assistant", "SUCCESS"),
  browser("assistant", "REJECT"),
  browser("assistant", "UNKNOWN", "assistant.UNKNOWN"),
  browser("assistant", "NOT_BOUND"),

  browser("organizer-workspace", "SUCCESS"),
  browser("organizer-workspace", "REJECT", "organizer-workspace.REJECT", "Local input-format refusal before a controller attempt."),
  {"journey": "organizer-workspace", "outcome": "UNKNOWN", "kind": "REFERENCE", "pointer": "apps/e2e/tests/shared.e2e.test.ts journeys-table.RESPONSE_LOST.organizer: reused organizer row; workspace stub never loses its answer.", "owner": "c-cross-surface-journeys-stub"},
  browser("organizer-workspace", "NOT_BOUND"),

  browser("merchant", "SUCCESS"),
  browser("merchant", "REJECT"),
  { journey: "merchant", outcome: "UNKNOWN", kind: "REFERENCE", checkId: "merchant.UNKNOWN", pointer: "apps/web/src/merchant-operations.ts: read-lost renders unavailable, not an UNKNOWN write row.", owner: "c-merchant-operations-stub", note: "Lost read has no ledger; it confirms and resolves no write." },
  browser("merchant", "NOT_BOUND"),

  browser("finance", "SUCCESS"),
  browser("finance", "REJECT"),
  browser("finance", "UNKNOWN", "finance.UNKNOWN"),
  browser("finance", "NOT_BOUND"),

  browser("provider", "SUCCESS"),
  browser("provider", "REJECT"),
  browser("provider", "UNKNOWN", "provider.UNKNOWN"),
  browser("provider", "NOT_BOUND"),

  browser("credit-origination", "SUCCESS"),
  browser("credit-origination", "REJECT"),
  browser("credit-origination", "UNKNOWN", "credit-origination.UNKNOWN"),
  browser("credit-origination", "NOT_BOUND"),

  browser("credit-servicing", "SUCCESS"),
  browser("credit-servicing", "REJECT"),
  browser("credit-servicing", "UNKNOWN", "credit-servicing.UNKNOWN"),
  browser("credit-servicing", "NOT_BOUND"),

  browser("marketing", "SUCCESS"),
  browser("marketing", "REJECT", "marketing.REJECT", "Hub empty local membership state, not a gate rejection."),
  {"journey": "marketing", "outcome": "UNKNOWN", "kind": "NOT_REACHABLE", "pointer": "No published command: the session stub records locally, so there is no command response to lose.", "owner": "c-fault-injection-stub"},
  browser("marketing", "NOT_BOUND"),

  browser("marketing-journey", "SUCCESS"),
  browser("marketing-journey", "REJECT", "marketing-journey.REJECT", "Source usage-limit-reached disables apply before sending; local eligibility refusal, not a producer rejection."),
  browser("marketing-journey", "UNKNOWN", "marketing-journey.UNKNOWN"),
  browser("marketing-journey", "NOT_BOUND"),

  browser("platform", "SUCCESS"),
  browser("platform", "REJECT"),
  browser("platform", "UNKNOWN", "platform.UNKNOWN"),
  browser("platform", "NOT_BOUND"),

  browser("marketplace-performance", "SUCCESS"),
  browser("marketplace-performance", "REJECT", "marketplace-performance.REJECT", "The source refuses claims-price; no price assertion."),
  { journey: "marketplace-performance", outcome: "UNKNOWN", kind: "REFERENCE", checkId: "marketplace-performance.UNKNOWN", pointer: "packages/protocol-adapter/src/marketplace-performance.ts: read-lost remains pending; no UNKNOWN row is rendered.", owner: "c-marketplace-performance-stub", note: "Browser check observes loading with no rows and the lost-answer note; it does not claim a settled unknown write." },
  browser("marketplace-performance", "NOT_BOUND"),

  browser("permissions", "SUCCESS"),
  browser("permissions", "REJECT"),
  browser("permissions", "UNKNOWN", "permissions.UNKNOWN"),
  browser("permissions", "NOT_BOUND"),

  browser("notifications", "SUCCESS"),
  browser("notifications", "REJECT"),
  browser("notifications", "UNKNOWN", "notifications.UNKNOWN"),
  browser("notifications", "NOT_BOUND"),

  browser("identity", "SUCCESS"),
  browser("identity", "REJECT", "identity.REJECT", "Foreign context rows are refused as this journey evidence; not a gate rejection."),
  browser("identity", "UNKNOWN", "identity.UNKNOWN"),
  browser("identity", "NOT_BOUND"),

  browser("session", "SUCCESS"),
  browser("session", "REJECT", "session.REJECT", "After a lost attach, the existing control refuses a second attach with an UNKNOWN reason; not a source rejection."),
  browser("session", "UNKNOWN", "session.UNKNOWN"),
  browser("session", "NOT_BOUND"),

  browser("journeys", "SUCCESS"),
  browser("journeys", "REJECT", "journeys.REJECT", "The source refuses claims-pass; no journey is promoted."),
  browser("journeys", "UNKNOWN", "journeys-page.UNKNOWN"),
  browser("journeys", "NOT_BOUND"),

  browser("qualification", "SUCCESS"),
  browser("qualification", "REJECT", "qualification.REJECT", "Malformed claims-pass packet refused locally as UNTRUSTED_PACKET; run remains UNKNOWN, not a source rejection or qualification decision."),
  browser("qualification", "UNKNOWN", "qualification.UNKNOWN"),
  browser("qualification", "NOT_BOUND"),

  browser("release", "SUCCESS"),
  browser("release", "REJECT", "release.REJECT", "Malformed claims-pass packet refused locally as UNTRUSTED_PACKET; run remains UNKNOWN, not a source rejection or release decision."),
  browser("release", "UNKNOWN", "release.UNKNOWN"),
  browser("release", "NOT_BOUND"),

  browser("marketing-m01", "SUCCESS"),
  browser("marketing-m01", "REJECT", "marketing-m01.REJECT", "Local input-format refusal; nothing recorded."),
  {"journey": "marketing-m01", "outcome": "UNKNOWN", "kind": "NOT_REACHABLE", "pointer": "No published command: the session stub records locally, so there is no command response to lose.", "owner": "c-fault-injection-stub"},
  browser("marketing-m01", "NOT_BOUND"),

  browser("marketing-m02", "SUCCESS"),
  browser("marketing-m02", "REJECT", "marketing-m02.REJECT", "Guest presale control is disabled with its reason; nothing recorded."),
  {"journey": "marketing-m02", "outcome": "UNKNOWN", "kind": "NOT_REACHABLE", "pointer": "No published command: the session stub records locally, so there is no command response to lose.", "owner": "c-fault-injection-stub"},
  browser("marketing-m02", "NOT_BOUND"),

  browser("marketing-m03", "SUCCESS"),
  browser("marketing-m03", "REJECT", "marketing-m03.REJECT", "Unknown local coupon is refused; no protocol command."),
  {"journey": "marketing-m03", "outcome": "UNKNOWN", "kind": "NOT_REACHABLE", "pointer": "No published command: the session stub records locally, so there is no command response to lose.", "owner": "c-fault-injection-stub"},
  browser("marketing-m03", "NOT_BOUND"),

  browser("marketing-m04", "SUCCESS"),
  browser("marketing-m04", "REJECT", "marketing-m04.REJECT", "Unknown local referral is refused; no protocol command."),
  {"journey": "marketing-m04", "outcome": "UNKNOWN", "kind": "NOT_REACHABLE", "pointer": "No published command: the session stub records locally, so there is no command response to lose.", "owner": "c-fault-injection-stub"},
  browser("marketing-m04", "NOT_BOUND"),

  browser("marketing-m05", "SUCCESS"),
  browser("marketing-m05", "REJECT", "marketing-m05.REJECT", "Local input-format refusal before any consent send."),
  {"journey": "marketing-m05", "outcome": "UNKNOWN", "kind": "REFERENCE", "pointer": "apps/web/src/consent-desk.ts: UNKNOWN fence wording; the default stub invoker cannot lose a response.", "owner": "w7-m05-consent-bind"},
  browser("marketing-m05", "NOT_BOUND"),

];

export const SHARED_CHECKS = [
  "connectivity.all-screens", "connectivity.no-service-worker", "connectivity.form-and-refresh", "connectivity.no-replay",
  "harness.server",
  "harness.paths",
  "harness.external-blocked",
  "harness.redaction","session.UNKNOWN", "journeys-page.UNKNOWN", "one-attempt.double-click", "one-attempt.keyboard", "one-attempt.reload"] as const;

/** Read-only exports/search/filter controls are separate explicit reads, not send controls. */
export const SEND_CONTROL_JOURNEYS: readonly JourneyId[] = ["box-office", "booking", "admission", "resale", "credit", "gift", "organizer", "organizer-workspace", "platform", "finance", "credit-origination", "credit-servicing", "marketing-journey", "assistant", "permissions", "notifications", "provider", "identity", "session", "mobile", "qualification", "release", "marketing-m05", "marketplace-performance"];
export function oneAttemptCheckIds(journey: JourneyId): readonly string[] {
  return journey === "booking"
    ? ["one-attempt.double-click", "one-attempt.keyboard", "one-attempt.reload"]
    : [`${journey}.one-attempt`];
}

export function expectedCheckIds(): string[] {
  const ids = new Set<string>(SHARED_CHECKS);
  for (const cell of MATRIX) {
    if (cell.checkId) {
      ids.add(cell.checkId);
    }
  }
  for (const journey of SEND_CONTROL_JOURNEYS) {
    for (const id of oneAttemptCheckIds(journey)) ids.add(id);
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
  for (const journey of SEND_CONTROL_JOURNEYS) {
    if (!JOURNEYS.includes(journey) || oneAttemptCheckIds(journey).length === 0) problems.push(`${journey}: missing one-attempt checks`);
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
