/**
 * The finance desk screen on top of the adapter's synthetic finance source. Stub scope:
 * the default port is the synthetic source. On integration-http the same port is
 * not-bound — the contract-only catalogue has no finance read command, no export
 * command, and no command that corrects a ledger, and this module does not invent one,
 * send a second attempt, or switch adapters.
 *
 * This module computes no amount. It copies what the controller and the last read hold:
 * every total, difference, remainder, and share is the source's own text or
 * UNDETERMINED, and every figure stays on its own source cut. It has no control that
 * confirms a mismatch, forces a ledger to match, or changes economic state: a
 * correction is a proposal, an approval is a record, and the ledger moves only when the
 * source posts a later cut.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FINANCE_ACTORS,
  FINANCE_FOREIGN_REF,
  FINANCE_HOLD_NOT_BOUND,
  FINANCE_NOT_BOUND_REASON,
  FINANCE_NOT_COMPOSED,
  FINANCE_OWN_REF,
  FINANCE_REVIEWER_ACTOR,
  FINANCE_UNDETERMINED,
  FinanceOperationsController,
  financeAuthorityTable,
  financeCapabilities,
  financeOperationsPortFor,
  financeProposableCorrections,
  type FinanceActResult,
  type FinanceActionKind,
  type FinanceActPhase,
  type FinanceAllocation,
  type FinanceAuthority,
  type FinanceCase,
  type FinanceCaseState,
  type FinanceCategory,
  type FinanceCorrectionKind,
  type FinanceExportPhase,
  type FinanceExportState,
  type FinanceExportVerdict,
  type FinanceFact,
  type FinanceFence,
  type FinanceOperationsPort,
  type FinanceOriginalTrade,
  type FinanceProposalState,
  type FinanceReadState,
  type FinanceScenario,
  type FinanceSyntheticControl,
  type FinanceVerdict,
} from "@kix/protocol-adapter";
import { protocol } from "./protocol";

export const FINANCE_PAGE_TITLE = "Finance desk (synthetic)";

export const FINANCE_SOURCE_LINE =
  "Cases, facts, payee allocations, totals, balances, cuts, and the export come from a synthetic finance source on this page load. They are not a producer read and not a catalogue receipt.";

export const FINANCE_BOUNDARY =
  "A mismatch is a case linked to its original trade. Reviewing a case moves no money, and nothing on this page makes a ledger match.";

export const FINANCE_NO_FORCE_NOTE =
  "There is no confirm, force-match, or apply control on this page. A correction is a proposal, an approval is a record that changes nothing, and the ledger moves only when the source posts a later cut.";

export const FINANCE_CLAIM_NOTE =
  "Every read states confirmationForcesMatch, proposalChangesEconomicState, approvalChangesEconomicState, payoutExecuted, postedToAccountingSystem, and exportIsBookOfRecord as false. A payload that says anything else, or stays silent, is refused before a row is shown.";

export const FINANCE_CUT_NOTE =
  "Every figure belongs to the cut of one source. Cuts of different sources are never merged. When the two sides of a case sit on cuts at different positions, the case is flagged as timing-uncertain and is not called matched or mismatched.";

export const FINANCE_FIGURES_NOTE =
  "Totals, differences, remainders, and payee shares are the source's own text, or UNDETERMINED when the source sent none. This page checks each figure's cut, generation, and case count, and compares text for equality. It adds nothing, orders nothing, and recomputes nothing.";

export const FINANCE_EXPORT_NOTE =
  "The export is the producer's own synthetic file. It is synthetic, holds no real money, is not posted to an accounting system, and is not a book of record. It is current only when it is one complete export of the very cut set the last read saw. Anything else is withheld with every reason, and this page does not repair it.";

export const FINANCE_SCOPE_NOTE = `The finance actors hold a synthetic grant for ${FINANCE_OWN_REF} and none for ${FINANCE_FOREIGN_REF}. A scope the grant does not cover is refused and leaves no row on screen.`;

export const FINANCE_ACTOR_NOTE =
  "The actor string is a context label. It is not an authentication result, and the source does not trust it for access.";

export const FINANCE_READ_NOTE =
  "A read, an export, and a request are each one attempt. None is sent again by this page. An answer that arrives after the scope changed is dropped. An answer that never arrives leaves the outcome unknown.";

export const FINANCE_SESSION_NOTE =
  "Reads, exports, and requests live in this page load only. A reload or a new synthetic session clears them and resolves nothing at a producer.";

export const FINANCE_SYNTHETIC_CONTROL_NOTE =
  "The three Simulate controls are synthetic controls a real producer does not offer. They stand in for a withdrawn grant, a source that moved on, and a later cut in which the source resolves a case. Approving a proposal is not one of them, and nothing a person does here resolves a case.";

export const FINANCE_HOLD_NOTE = `Holding a seat is not available here. ${FINANCE_HOLD_NOT_BOUND.reason}`;

export const FINANCE_NOT_COMPOSED_NOTE = `Catalogue actions recorded and never composed here: ${FINANCE_NOT_COMPOSED.map((entry) => entry.action).join(", ")}.`;

export const SCENARIO_NOTES: Readonly<Record<FinanceScenario, string>> = {
  clean: "Every read, export, and request is answered. The queue holds one case per category.",
  empty: "The source has no reconciliation cases for this book.",
  stale: "The source serves a watermark older than the floor this page holds.",
  "stale-totals": "The source totals were built at an older generation than the cut they name.",
  "totals-mismatch": "One source total counts cases the read does not list.",
  "balance-mismatch": "One balance is stated matched while the source's own difference text is not zero.",
  "source-cut-skew": "The payment-observation cut is at an earlier position than the other sources, so no case can be judged and no single export is consistent.",
  "dangling-link": "One case names a trade the read does not list.",
  "proposal-pending": "A correction proposal from the reviewer waits for the approver.",
  "self-approval": "A correction proposal from the approver waits. The approver may not approve its own proposal.",
  "claims-forced": "The source sends a payload that claims a confirmation forced a match. The payload is refused.",
  "scope-leak": "The source sends a row that belongs to another book. The payload is refused.",
  denied: "The grant for this actor is withdrawn at the source.",
  "read-lost": "The answer to a read never arrives.",
  "export-partial": "The export is cut off before it lists every row.",
  "export-stale": "The export was taken at an older cut set than the read saw.",
  "export-rows-differ": "The export rows differ from the rows the read yields.",
  "export-denied": "The source grants the read and no export.",
  "export-claims-real": "The export declares real money. The payload is refused.",
  "act-lost": "A request reaches the source and is recorded. Its answer never arrives.",
  "approve-claims-applied": "The source records an approval, then answers that economic state changed. The answer is not trusted.",
};

export type FinanceScreenState =
  | "loading"
  | "ready"
  | "empty"
  | "stale"
  | "denied"
  | "refused"
  | "invalid"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export interface ControlModel {
  enabled: boolean;
  /** Why the control is off. Null when it is on. */
  reason: string | null;
}

export interface FinanceCutModel {
  cutRef: string;
  source: string;
  generation: number;
  watermark: string;
  usedBy: string;
}

export interface FinanceAuthorityModel {
  authority: FinanceAuthority;
  word: string;
  heldByLine: string;
  effectLine: string;
  changesEconomicState: boolean;
  heldByActor: boolean;
}

export interface FinanceFactModel {
  factRef: string;
  kindWord: string;
  arrivalWord: string;
  late: boolean;
  amountLine: string;
  payeeLine: string;
  label: string;
  cutRef: string;
}

export interface FinanceAllocationModel {
  allocationRef: string;
  kindWord: string;
  roleWord: string;
  payeeLine: string;
  amountLine: string;
  cutRef: string;
  remainder: boolean;
}

export interface FinanceCorrectionButtonModel {
  correction: FinanceCorrectionKind;
  label: string;
  control: ControlModel;
}

export interface FinanceProposalModel {
  proposalRef: string;
  caseRef: string;
  correctionWord: string;
  note: string;
  proposedBy: string;
  state: FinanceProposalState;
  stateWord: string;
  approve: ControlModel;
}

export interface FinanceCaseModel {
  caseRef: string;
  category: FinanceCategory;
  categoryWord: string;
  state: FinanceCaseState;
  stateWord: string;
  verdict: FinanceVerdict;
  verdictWord: string;
  /** Plain words about the case, built from the source's own fields. */
  explanationLines: string[];
  tradeRef: string;
  tradeLine: string;
  tradeLinked: boolean;
  merchantLineLine: string | null;
  paymentLine: string | null;
  expectedLine: string;
  observedLine: string;
  differenceLine: string;
  sidesLine: string;
  reasonLine: string;
  skewLine: string | null;
  contradictionLine: string | null;
  /** Why only a request to look again is offered, or why nothing is. Null when the full offer stands. */
  caseBlock: string | null;
  cutRef: string;
  facts: FinanceFactModel[];
  allocations: FinanceAllocationModel[];
  proposals: FinanceProposalModel[];
  corrections: FinanceCorrectionButtonModel[];
}

export interface FinanceTotalModel {
  category: FinanceCategory;
  categoryWord: string;
  cutRef: string;
  generation: number;
  caseCount: number;
  amountLine: string;
  flagLines: string[];
}

export interface FinanceBalanceFlagModel {
  kind: "contradiction" | "timing-uncertain";
  text: string;
}

export interface FinanceBalanceModel {
  balanceRef: string;
  label: string;
  leftLine: string;
  rightLine: string;
  differenceLine: string;
  verdict: FinanceVerdict;
  verdictWord: string;
  flags: FinanceBalanceFlagModel[];
}

export interface FinanceExportRowModel {
  entryRef: string;
  kindWord: string;
  caseRef: string;
  payeeLine: string;
  categoryWord: string;
  amountLine: string;
  cutRef: string;
}

export interface FinanceExportModel {
  phase: FinanceExportPhase;
  statusLine: string;
  detailLine: string;
  verdictWord: "current" | "withheld" | "none";
  verdictLines: string[];
  exportRef: string | null;
  scopeLine: string | null;
  cutLines: string[];
  rowsLine: string | null;
  completeLine: string | null;
  digestLine: string | null;
  rows: FinanceExportRowModel[];
}

export interface FinanceRequestRecordModel {
  seq: number;
  kindWord: string;
  phase: FinanceActPhase;
  phaseWord: string;
  code: string | null;
  detail: string | null;
  receiptLines: string[];
}

export interface FinanceSessionModel {
  contextLine: string;
  capabilityLine: string;
  countersLine: string;
  earlierUnknownLine: string;
  notComposedLine: string;
  holdLine: string;
}

export type FinanceLastAction = { seq: number; text: string; attention: boolean };

export interface FinanceModel {
  state: FinanceScreenState;
  statusLine: string;
  detailLine: string;
  actionLabel: string | null;
  freshnessWord: string;
  scopeLine: string;
  watermarkLine: string;
  queueLine: string;
  cutAlignment: "none" | "aligned" | "skewed";
  cutLine: string;
  cuts: FinanceCutModel[];
  authority: FinanceAuthorityModel[];
  cases: FinanceCaseModel[];
  totalsState: "none" | "current" | "stale" | "mismatch";
  totals: FinanceTotalModel[];
  balances: FinanceBalanceModel[];
  unlinkedLines: string[];
  export: FinanceExportModel;
  exportControl: ControlModel;
  /** The reason every correction control is off, shared by all of them. Null when they are on. */
  proposeBlock: string | null;
  /** The reason every approval control is off, shared by all of them. Null when they are on. */
  approveBlock: string | null;
  request: FinanceRequestRecordModel | null;
  fenceLine: string | null;
  behindLine: string | null;
  session: FinanceSessionModel;
  lastLine: string | null;
  lastNeedsFocus: boolean;
  lastSeq: number | null;
  /**
   * Changes when something the person must notice lands: a note that needs attention, a read
   * the source refused or did not answer, or an export it refused. Null when nothing does.
   * The page moves focus to the status region when it changes.
   */
  focusToken: string | null;
}

const CATEGORY_WORDS: Readonly<Record<FinanceCategory, string>> = {
  UNMATCHED: "Unmatched",
  DUPLICATE_OBSERVATION: "Duplicate observation",
  LATE_FACT: "Late fact",
  MULTI_PAYEE: "Several payees",
  RESIDUAL: "Residual allocation",
  BALANCE_MISMATCH: "Balance mismatch",
};

const CASE_STATE_WORDS: Readonly<Record<FinanceCaseState, string>> = {
  open: "Open",
  unknown: "Unknown",
  "resolved-by-source": "Resolved by the source",
};

const VERDICT_WORDS: Readonly<Record<FinanceVerdict, string>> = {
  matched: "The source says matched",
  mismatch: "The source says mismatch",
  unknown: "The source says unknown",
};

const CORRECTION_WORDS: Readonly<Record<FinanceCorrectionKind, string>> = {
  "link-observation": "Link an observation",
  "mark-duplicate": "Mark as a duplicate observation",
  "accept-late-fact": "Accept the late fact",
  "reassign-payee": "Reassign a payee",
  "allocate-remainder": "Allocate the remainder",
  "request-source-review": "Ask the source to look again",
};

const PROPOSAL_STATE_WORDS: Readonly<Record<FinanceProposalState, string>> = {
  pending: "Pending",
  "approval-recorded": "Approval recorded, nothing changed",
  rejected: "Rejected",
};

const TRADE_STATUS_WORDS: Readonly<Record<FinanceOriginalTrade["statusLabel"], string>> = {
  booked: "Booked",
  "payment-observed": "Payment observed",
  "right-moved": "Right moved",
  "payment-unknown": "Payment unknown",
};

const LINE_KIND_WORDS: Readonly<Record<FinanceCase["lineKind"], string>> = {
  "sales-observed": "a sales observation",
  unpaid: "an unpaid line",
  held: "a held line",
  "refund-burden": "a refund burden",
};

const FACT_KIND_WORDS: Readonly<Record<FinanceFact["kind"], string>> = {
  "order-observed": "Order observed",
  "payment-observed": "Payment observed",
  "payment-observed-again": "Same payment observed again",
  "payout-recorded": "Payout recorded",
  "allocation-recorded": "Allocation recorded",
  "remainder-recorded": "Remainder recorded",
  "late-arrival": "Late arrival",
};

const ROLE_WORDS: Readonly<Record<NonNullable<FinanceAllocation["role"]>, string>> = {
  seller: "Seller",
  venue: "Venue",
  platform: "Platform",
  lender: "Lender",
};

const AUTHORITY_WORDS: Readonly<Record<FinanceAuthority, { word: string; effect: string }>> = {
  read: { word: "Read the queue", effect: "Shows the source's cases. Changes nothing." },
  export: { word: "Load the export", effect: "Asks the source for its synthetic file. Changes nothing." },
  "propose-correction": {
    word: "Propose a correction",
    effect: "Records a proposal at the source. A proposal changes no economic state and forces no match.",
  },
  "approve-proposal": {
    word: "Approve a proposal",
    effect: "Records an approval at the source. An approval changes no economic state either. A different actor approves than proposed.",
  },
  "change-economic-state": {
    word: "Change economic state",
    effect: "The only authority that moves the ledger. No actor on this desk holds it. The ledger moves when the source posts a later cut.",
  },
};

const EXPORT_REASON_WORDS: Readonly<Record<string, string>> = {
  NO_SNAPSHOT: "there is no read to judge it against",
  SOURCES_SKEWED: "the last read spans sources at different positions, so no single export is consistent",
  SCOPE: "the export names another scope",
  UNKNOWN_CUT: "the export names a cut the read does not list",
  CUT_MISSING: "the read used a source cut that the export does not list",
  STALE_CUT: "the export was taken before the cut set the read saw",
  AHEAD_CUT: "the export is newer than the cut set the read saw, so the read is behind",
  ROW_OFF_CUT: "an export row sits on a cut the export does not name",
  PARTIAL: "the producer says the export was cut off",
  COUNT: "the export lists a different number of rows than the producer declared",
  ROWS_DIFFER: "the export rows differ from the rows the read yields",
};

const ACTION_WORDS: Readonly<Record<FinanceActionKind, string>> = {
  "propose-correction": "Correction proposal",
  "approve-proposal": "Proposal approval",
};

const PHASE_WORDS: Readonly<Record<FinanceActPhase, string>> = {
  applied: "Recorded at the synthetic source",
  rejected: "Rejected by the source",
  denied: "Denied by the source",
  refused: "The answer was not trusted, and the request may have been recorded",
  invalid: "Refused before it was recorded",
  "tuple-changed": "Nothing was recorded because the pin tuple changed",
  "not-bound": "Not recorded: not bound",
  unknown: "Outcome unknown. The request may have been recorded",
};

/** The figure as the source stated it, or UNDETERMINED. Nothing here parses it. */
function figure(value: string | null, unit: string): string {
  return value === null ? FINANCE_UNDETERMINED : `${value} ${unit}`;
}

function readStateToScreen(readState: FinanceReadState): FinanceScreenState {
  switch (readState) {
    case "none":
      return "loading";
    case "ready":
      return "ready";
    case "empty":
      return "empty";
    case "stale":
      return "stale";
    case "denied":
      return "denied";
    case "refused":
      return "refused";
    case "invalid":
      return "invalid";
    case "not-bound":
      return "not-bound";
    case "tuple-changed":
      return "tuple-changed";
    case "unavailable":
      return "unavailable";
    default: {
      const exhaustive: never = readState;
      return exhaustive;
    }
  }
}

function statusFor(
  state: FinanceScreenState,
  code: string | null,
  detail: string | null,
): { statusLine: string; detailLine: string; actionLabel: string | null } {
  const suffix = code ? ` (${code})` : "";
  switch (state) {
    case "loading":
      return { statusLine: "Reading the synthetic finance source. Nothing is shown yet.", detailLine: "", actionLabel: null };
    case "ready":
      return { statusLine: "Finance read.", detailLine: "", actionLabel: null };
    case "empty":
      return {
        statusLine: "No reconciliation cases for this book in this read.",
        detailLine: detail ?? "An empty queue is not a zero figure.",
        actionLabel: "Read again",
      };
    case "stale":
      return { statusLine: "Stale finance read.", detailLine: detail ?? "", actionLabel: "Read again" };
    case "denied":
      return { statusLine: `The source refused this scope${suffix}.`, detailLine: detail ?? "", actionLabel: "Read again" };
    case "refused":
      return {
        statusLine: `The source sent a payload this page does not trust${suffix}.`,
        detailLine: `${detail ?? ""} No row from it is shown.`,
        actionLabel: "Read again",
      };
    case "invalid":
      return { statusLine: `The request was refused before it read${suffix}.`, detailLine: detail ?? "", actionLabel: "Read again" };
    case "not-bound":
      return { statusLine: FINANCE_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: "The pin tuple changed. Nothing was read and nothing was applied.",
        detailLine: detail ?? "",
        actionLabel: "Start a new synthetic session",
      };
    case "unavailable":
      return {
        statusLine: "The source did not answer. This is not an empty queue.",
        detailLine: detail ?? "",
        actionLabel: "Read again",
      };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function verdictModel(verdict: FinanceExportVerdict | null): { verdictWord: FinanceExportModel["verdictWord"]; verdictLines: string[] } {
  if (verdict === null) {
    return { verdictWord: "none", verdictLines: [] };
  }
  if (verdict.state === "current") {
    return { verdictWord: "current", verdictLines: ["Current export for the last read."] };
  }
  return {
    verdictWord: "withheld",
    verdictLines: verdict.reasons.map((reason) => `${reason}: ${EXPORT_REASON_WORDS[reason] ?? reason}.`),
  };
}

function emptyExport(phase: FinanceExportPhase, statusLine: string, detailLine: string): FinanceExportModel {
  return {
    phase,
    statusLine,
    detailLine,
    verdictWord: "none",
    verdictLines: [],
    exportRef: null,
    scopeLine: null,
    cutLines: [],
    rowsLine: null,
    completeLine: null,
    digestLine: null,
    rows: [],
  };
}

function exportModel(exported: FinanceExportState): FinanceExportModel {
  const verdict = verdictModel(exported.verdict);
  switch (exported.phase) {
    case "none":
      return emptyExport("none", "No export is loaded. An export is requested only after a ready read.", "");
    case "loaded": {
      const value = exported.value;
      const declaration = value?.scopeDeclaration;
      return {
        phase: "loaded",
        statusLine: verdict.verdictWord === "current" ? "Export loaded and current for the last read." : "Export loaded. It is not the current export.",
        detailLine: "",
        verdictWord: verdict.verdictWord,
        verdictLines: verdict.verdictLines,
        exportRef: value?.exportRef ?? null,
        scopeLine: declaration
          ? `SYNTHETIC export. provenance ${declaration.provenance} · realMoney ${String(declaration.realMoney)} · postedToAccountingSystem ${String(declaration.postedToAccountingSystem)} · bookOfRecord ${String(declaration.bookOfRecord)} · target ${declaration.target}.`
          : null,
        cutLines: (value?.cuts ?? []).map((cut) => `Cut ${cut.cutRef} (${cut.source}) at generation ${cut.generation}. Watermark ${cut.watermark}.`),
        rowsLine: value ? `${value.rows.length} rows of ${value.declaredRowCount} declared.` : null,
        completeLine: value ? (value.complete ? "The producer says the export is complete." : "The producer says the export was cut off.") : null,
        digestLine: value ? `Digest ${value.digest ?? "none"}. Opaque producer text; this page does not verify it.` : null,
        rows:
          value?.rows.map((row) => ({
            entryRef: row.entryRef,
            kindWord: row.entryKind === "case" ? "Case" : row.entryKind === "payee-share" ? "Payee share" : "Unapplied remainder",
            caseRef: row.caseRef,
            payeeLine: row.payeeRef ?? "no payee",
            categoryWord: CATEGORY_WORDS[row.category],
            amountLine: figure(row.amount, row.unit),
            cutRef: row.cutRef,
          })) ?? [],
      };
    }
    case "denied":
      return emptyExport("denied", `The source refused the export (${exported.code ?? "no code"}).`, exported.detail ?? "");
    case "refused":
      return emptyExport("refused", `The export payload was refused (${exported.code ?? "no code"}).`, exported.detail ?? "");
    case "invalid":
      return emptyExport("invalid", `The export request was refused (${exported.code ?? "no code"}).`, exported.detail ?? "");
    case "not-bound":
      return emptyExport("not-bound", "The export stays not-bound.", exported.detail ?? FINANCE_NOT_BOUND_REASON);
    case "tuple-changed":
      return emptyExport("tuple-changed", "The pin tuple changed. No export was applied.", exported.detail ?? "");
    case "unavailable":
      return emptyExport("unavailable", "The export answer did not arrive.", exported.detail ?? "");
    default: {
      const exhaustive: never = exported.phase;
      return exhaustive;
    }
  }
}

function fenceText(fence: FinanceFence): string {
  return fence.reason === "in-flight"
    ? `A ${fence.action} request is in flight. One request goes at a time.`
    : `Request ${fence.seq} (${fence.action}) has an unknown outcome and may have been recorded. Nothing is sent again from here, and a read does not resolve it. Switching the scope or the actor, or starting a new synthetic session, begins a new context and counts this unknown outcome.`;
}

/**
 * The source's verdict as words. A verdict its own difference text contradicts, or whose two
 * sides sit on cuts at different positions, says so beside the verdict instead of standing alone.
 */
function verdictWordFor(verdict: FinanceVerdict, contradicted: boolean, skewed: boolean): string {
  const parts = [VERDICT_WORDS[verdict]];
  if (contradicted) {
    parts.push("its own difference text contradicts it");
  }
  if (skewed) {
    parts.push("its two sides sit on cuts at different positions");
  }
  return parts.join(", and ");
}

/** Plain words for a case, built from the source's own fields. They add no figure of their own. */
function explainCase(
  row: FinanceCase,
  facts: readonly FinanceFact[],
  allocations: readonly FinanceAllocation[],
  skewed: boolean,
): string[] {
  if (row.state === "resolved-by-source") {
    return [
      `The source resolved this case in a later cut. It now states ${VERDICT_WORDS[row.verdict].replace("The source says ", "")} with difference ${figure(row.differenceAmount, row.unit)}. This page did not resolve it, and no approval did. The earlier mismatch is not replayed here.`,
    ];
  }
  const lines: string[] = [];
  switch (row.category) {
    case "UNMATCHED":
      lines.push(
        `The source expected ${figure(row.expectedAmount, row.unit)} (${LINE_KIND_WORDS[row.lineKind]}) and found no matching observation${row.observedCutRef ? ` on cut ${row.observedCutRef}` : ""}. Whether anything was paid is not known here.${skewed ? " That cut is at a different position than the expected side, so the missing observation may be timing and not an error." : ""}`,
      );
      if (row.lineKind === "refund-burden") {
        lines.push("This is a refund burden. A refund is not a payment observation, and no refund command is composed here.");
      }
      break;
    case "DUPLICATE_OBSERVATION": {
      const seen = facts.filter((fact) => fact.kind === "payment-observed" || fact.kind === "payment-observed-again");
      lines.push(
        `The source observed the same payment ${seen.length} times (${seen.map((fact) => fact.factRef).join(", ")}). The observed figure ${figure(row.observedAmount, row.unit)} is the source's own text. This page removes no observation and recomputes nothing.`,
      );
      break;
    }
    case "LATE_FACT": {
      const late = facts.filter((fact) => fact.arrival === "after-cut");
      lines.push(
        `A fact (${late.map((fact) => fact.factRef).join(", ")}) reached the source after cut ${row.cutRef} was taken. It is its own fact and is not folded into that cut. Whether this case is unresolved is not known until the source posts a later cut.`,
      );
      break;
    }
    case "MULTI_PAYEE": {
      const shares = allocations.filter((item) => item.kind === "payee-share");
      lines.push(
        `The source split this payout across ${shares.length} payees. Each share is the source's own text. This page does not check what the shares add up to.`,
      );
      break;
    }
    case "RESIDUAL":
      lines.push(
        "After allocation the source left an amount unapplied. An unapplied remainder applies itself to nothing. The source's own allocation rows are listed below, and this page allocates none of it.",
      );
      break;
    case "BALANCE_MISMATCH":
      lines.push(
        `Two of the source's ledgers carry different figures for this trade, and the source's own difference text is ${figure(row.differenceAmount, row.unit)}. This page computes no difference of its own. Read the flags below before relying on it.`,
      );
      break;
    default: {
      const exhaustive: never = row.category;
      return exhaustive;
    }
  }
  return lines;
}

export function buildFinanceModel(input: { controller: FinanceOperationsController; last: FinanceLastAction | null }): FinanceModel {
  const { controller } = input;
  const state = controller.state();
  const screen = readStateToScreen(state.readState);
  const status = statusFor(screen, state.readCode, state.readDetail);
  const snapshot = state.snapshot;
  const assessment = state.assessment;
  const actorRef = state.context.actorRef;

  const freshnessWord =
    state.freshness === "CURRENT"
      ? state.behind
        ? "The last read is behind a request that reached the source. Read again."
        : "The last read is current."
      : state.freshness === "STALE"
        ? "The last read is behind."
        : "There is no usable read.";

  const usedBy = new Map<string, number>();
  if (snapshot) {
    for (const row of [...snapshot.originals, ...snapshot.cases, ...snapshot.facts, ...snapshot.allocations, ...snapshot.proposals]) {
      usedBy.set(row.cutRef, (usedBy.get(row.cutRef) ?? 0) + 1);
    }
  }
  const cuts: FinanceCutModel[] = (assessment?.usedCuts ?? []).map((cut) => ({
    cutRef: cut.cutRef,
    source: cut.source,
    generation: cut.generation,
    watermark: cut.watermark,
    usedBy: `${usedBy.get(cut.cutRef) ?? 0} rows`,
  }));
  const cutAlignment = assessment?.cutAlignment ?? "none";
  const cutLine =
    cutAlignment === "aligned"
      ? "Every source cut used by this read is at one position (one watermark). Their figures still stay on their own cuts."
      : cutAlignment === "skewed"
        ? "The source cuts used by this read are at different positions. A case whose two sides are on different positions is flagged timing-uncertain, and no single export is consistent."
        : "No row carries a source cut in this read.";

  const capabilities = financeCapabilities(actorRef);
  const authority: FinanceAuthorityModel[] = financeAuthorityTable().map((row) => ({
    authority: row.authority,
    word: AUTHORITY_WORDS[row.authority].word,
    heldByLine: row.heldBy.length === 0 ? "Held by no actor on this desk." : `Held by ${row.heldBy.join(", ")}.`,
    effectLine: AUTHORITY_WORDS[row.authority].effect,
    changesEconomicState: row.changesEconomicState,
    heldByActor: row.heldBy.includes(actorRef),
  }));

  const proposeEligibility = controller.canSend("propose-correction");
  const approveEligibility = controller.canSend("approve-proposal");
  const proposeBlock = proposeEligibility.allowed ? null : (proposeEligibility.reason ?? "Corrections are not on offer.");
  const approveBlock = approveEligibility.allowed ? null : (approveEligibility.reason ?? "Approvals are not on offer.");

  const skewByCase = new Set((assessment?.skew ?? []).filter((item) => item.kind === "case").map((item) => item.ref));
  const contradictionByRef = new Map((assessment?.contradictions ?? []).map((item) => [`${item.kind}|${item.ref}`, item]));
  const originals = new Map((snapshot?.originals ?? []).map((row) => [row.tradeRef, row]));
  const unlinkedCases = new Set((assessment?.unlinked ?? []).filter((item) => item.lens === "cases").map((item) => item.ref));

  const cases: FinanceCaseModel[] = (snapshot?.cases ?? []).map((row) => {
    const facts = (snapshot?.facts ?? []).filter((item) => item.caseRef === row.caseRef);
    const allocations = (snapshot?.allocations ?? []).filter((item) => item.caseRef === row.caseRef);
    const proposals = (snapshot?.proposals ?? []).filter((item) => item.caseRef === row.caseRef);
    const original = originals.get(row.tradeRef);
    const skewed = skewByCase.has(row.caseRef);
    const contradiction = contradictionByRef.get(`case|${row.caseRef}`);
    const resolved = row.state === "resolved-by-source";
    const allowed = snapshot && assessment ? financeProposableCorrections(snapshot, assessment, row.caseRef) : [];

    let caseBlock: string | null = null;
    if (resolved) {
      caseBlock = "The source resolved this case. Nothing is left to correct.";
    } else if (skewed) {
      caseBlock =
        "The two sides of this case sit on cuts at different positions, so it is not a mismatch to correct yet. Only a request for the source to look again is offered.";
    } else if (contradiction) {
      caseBlock = "The source's verdict contradicts its own difference text. Only a request for the source to look again is offered.";
    } else if (unlinkedCases.has(row.caseRef)) {
      caseBlock = "The read does not list the original trade of this case. Only a request for the source to look again is offered.";
    }

    const corrections: FinanceCorrectionButtonModel[] = row.offeredCorrections.map((correction) => {
      let reason: string | null = null;
      if (proposeBlock !== null) {
        reason = proposeBlock;
      } else if (!allowed.includes(correction)) {
        reason = caseBlock ?? "The read does not offer this correction on this case now.";
      }
      return { correction, label: `Propose: ${CORRECTION_WORDS[correction]}`, control: { enabled: reason === null, reason } };
    });

    return {
      caseRef: row.caseRef,
      category: row.category,
      categoryWord: CATEGORY_WORDS[row.category],
      state: row.state,
      stateWord: CASE_STATE_WORDS[row.state],
      verdict: row.verdict,
      verdictWord: verdictWordFor(row.verdict, contradiction !== undefined, skewed),
      explanationLines: explainCase(row, facts, allocations, skewed),
      tradeRef: row.tradeRef,
      tradeLine: original
        ? `Original trade ${original.tradeRef}: listing ${original.listingRef}, event ${original.eventRef}, ${TRADE_STATUS_WORDS[original.statusLabel]}. Cut ${original.cutRef}.`
        : `Original trade ${row.tradeRef} is not listed in this read. It is not attached elsewhere.`,
      tradeLinked: original !== undefined,
      merchantLineLine: row.merchantLineRef ? `Merchant money line ${row.merchantLineRef} (${LINE_KIND_WORDS[row.lineKind]}).` : null,
      paymentLine: row.paymentRef ? `Credit servicing payment ${row.paymentRef}.` : null,
      expectedLine: `Expected ${figure(row.expectedAmount, row.unit)}`,
      observedLine: `Observed ${figure(row.observedAmount, row.unit)}`,
      differenceLine: `Difference ${figure(row.differenceAmount, row.unit)}`,
      sidesLine: row.observedCutRef
        ? `Expected side on cut ${row.cutRef}. Observed side looked up on cut ${row.observedCutRef}.`
        : `Expected side on cut ${row.cutRef}. The source names no observed side.`,
      reasonLine: row.reasonCode ? `Reason ${row.reasonCode} as the source names it.` : "No reason named.",
      skewLine: skewed
        ? `TIMING_UNCERTAIN: cut ${row.cutRef} and cut ${row.observedCutRef ?? "(none)"} are at different positions. A difference may be timing, so this page does not call this case matched or mismatched.`
        : null,
      contradictionLine: contradiction ? `${contradiction.code}: ${contradiction.detail}` : null,
      caseBlock,
      cutRef: row.cutRef,
      facts: facts.map((fact) => ({
        factRef: fact.factRef,
        kindWord: FACT_KIND_WORDS[fact.kind],
        arrivalWord: fact.arrival === "after-cut" ? "After the cut" : "In the cut",
        late: fact.arrival === "after-cut",
        amountLine: figure(fact.amount, fact.unit),
        payeeLine: fact.payeeRef ?? "no payee",
        label: fact.label,
        cutRef: fact.cutRef,
      })),
      allocations: allocations.map((item) => ({
        allocationRef: item.allocationRef,
        kindWord: item.kind === "payee-share" ? "Payee share" : "Unapplied remainder",
        roleWord: item.role ? ROLE_WORDS[item.role] : "No payee",
        payeeLine: item.payeeRef ?? "no payee",
        amountLine: figure(item.amount, item.unit),
        cutRef: item.cutRef,
        remainder: item.kind === "unapplied-remainder",
      })),
      proposals: proposals.map((item) => {
        const approvable = item.state === "pending";
        const reason = approveBlock !== null ? approveBlock : approvable ? null : `Proposal ${item.proposalRef} is ${item.state}. A proposal is approved only while it is pending.`;
        return {
          proposalRef: item.proposalRef,
          caseRef: item.caseRef,
          correctionWord: CORRECTION_WORDS[item.correction],
          note: item.note,
          proposedBy: item.proposedBy,
          state: item.state,
          stateWord: PROPOSAL_STATE_WORDS[item.state],
          approve: { enabled: reason === null, reason },
        };
      }),
      corrections: resolved ? [] : corrections,
    };
  });

  const flagByKey = new Map<string, string[]>();
  for (const flag of assessment?.totals.flags ?? []) {
    const key = `${flag.category}|${flag.cutRef}`;
    flagByKey.set(key, [...(flagByKey.get(key) ?? []), `${flag.code}: ${flag.detail}`]);
  }
  const totals: FinanceTotalModel[] = (snapshot?.totals ?? []).map((row) => ({
    category: row.category,
    categoryWord: CATEGORY_WORDS[row.category],
    cutRef: row.cutRef,
    generation: row.generation,
    caseCount: row.caseCount,
    amountLine: figure(row.amount, row.unit),
    flagLines: flagByKey.get(`${row.category}|${row.cutRef}`) ?? [],
  }));

  const balances: FinanceBalanceModel[] = (snapshot?.balances ?? []).map((row) => {
    const flags: FinanceBalanceFlagModel[] = [];
    const contradiction = contradictionByRef.get(`balance|${row.balanceRef}`);
    if (contradiction) {
      flags.push({ kind: "contradiction", text: `${contradiction.code}: ${contradiction.detail}` });
    }
    let skewed = false;
    for (const item of assessment?.skew ?? []) {
      if (item.kind === "balance" && item.ref === row.balanceRef) {
        skewed = true;
        flags.push({
          kind: "timing-uncertain",
          text: `TIMING_UNCERTAIN: cut ${item.leftCutRef} and cut ${item.rightCutRef} are at different positions. A difference may be timing, so this page does not call this balance matched or mismatched.`,
        });
      }
    }
    return {
      balanceRef: row.balanceRef,
      label: row.label,
      leftLine: `${figure(row.leftAmount, row.unit)} on cut ${row.leftCutRef}`,
      rightLine: `${figure(row.rightAmount, row.unit)} on cut ${row.rightCutRef}`,
      differenceLine: figure(row.differenceAmount, row.unit),
      verdict: row.verdict,
      verdictWord: verdictWordFor(row.verdict, contradiction !== undefined, skewed),
      flags,
    };
  });

  const unlinkedLines = (assessment?.unlinked ?? []).map(
    (item) => `${item.lens} row ${item.ref} names ${item.missing} ${item.missingRef}, which the read does not list. It is not attached elsewhere.`,
  );

  const exportEligibility = controller.canExport();
  const exportControl: ControlModel = exportEligibility.allowed ? { enabled: true, reason: null } : { enabled: false, reason: exportEligibility.reason };

  const last = state.last;
  const request: FinanceRequestRecordModel | null =
    last === null
      ? null
      : {
          seq: last.seq,
          kindWord: ACTION_WORDS[last.action.kind],
          phase: last.phase,
          phaseWord: PHASE_WORDS[last.phase],
          code: last.code,
          detail: last.detail,
          receiptLines: last.receipt
            ? [
                `Receipt ${last.receipt.kind} for ${last.receipt.proposalRef} on ${last.receipt.caseRef}.`,
                `economicStateChanged ${String(last.receipt.economicStateChanged)} · confirmationForcesMatch ${String(last.receipt.confirmationForcesMatch)}`,
                "Recorded is not applied. The cases above change only after the source posts a later cut and this page reads again.",
              ]
            : [],
        };

  const counters = state.counters;
  const session: FinanceSessionModel = {
    contextLine: `Actor ${actorRef}, book scope ${state.context.scope.bookRef}, session ${state.context.incarnation}, mode ${state.context.environment}.`,
    capabilityLine: `Actor ${actorRef} holds: ${capabilities.length === 0 ? "no capability" : capabilities.join(", ")}.`,
    countersLine: `Reads ${counters.reads}. Exports ${counters.exports}. Requests ${counters.acts}. Not sent ${counters.notSent}. Reads dropped ${counters.droppedReads}. Exports dropped ${counters.droppedExports}.`,
    earlierUnknownLine:
      state.earlierUnknown === 0
        ? "No unknown request outcome in earlier sessions."
        : `${state.earlierUnknown} unknown request outcome${state.earlierUnknown === 1 ? "" : "s"} in earlier sessions. They are counted, not forgotten.`,
    notComposedLine: FINANCE_NOT_COMPOSED_NOTE,
    holdLine: FINANCE_HOLD_NOTE,
  };

  const queue = assessment?.queue;
  return {
    state: screen,
    statusLine: status.statusLine,
    detailLine: status.detailLine,
    actionLabel: status.actionLabel,
    freshnessWord,
    scopeLine: `Tenant ${state.context.scope.tenantId}. Book ${state.context.scope.bookRef}.`,
    watermarkLine: snapshot ? `Watermark ${snapshot.watermark}. Read ${snapshot.snapshotId} on this port.` : "No watermark without a ready read.",
    queueLine: queue
      ? `Queue as the source states it: ${queue.open} open, ${queue.unknown} unknown, ${queue.resolvedBySource} resolved by the source.`
      : "No queue without a ready read.",
    cutAlignment,
    cutLine,
    cuts,
    authority,
    cases,
    totalsState: assessment?.totals.state ?? "none",
    totals,
    balances,
    unlinkedLines,
    export: exportModel(state.export),
    exportControl,
    proposeBlock,
    approveBlock,
    request,
    fenceLine: state.fence === null ? null : fenceText(state.fence),
    behindLine: state.behind
      ? "A request reached the source after the last read. The cases on screen are the last read's. Read again to see the proposals."
      : null,
    session,
    lastLine: input.last === null ? null : input.last.text,
    lastNeedsFocus: input.last?.attention ?? false,
    lastSeq: input.last === null ? null : input.last.seq,
    focusToken: focusTokenFor(input.last, screen, state.counters, state.export.phase),
  };
}

const NOTICE_READ_STATES: readonly FinanceScreenState[] = ["stale", "denied", "refused", "invalid", "tuple-changed", "unavailable"];
const NOTICE_EXPORT_PHASES: readonly FinanceExportPhase[] = ["denied", "refused", "invalid", "tuple-changed", "unavailable"];

function focusTokenFor(
  last: FinanceLastAction | null,
  screen: FinanceScreenState,
  counters: { reads: number; exports: number },
  exportPhase: FinanceExportPhase,
): string | null {
  if (last?.attention) {
    return `note-${last.seq}`;
  }
  if (NOTICE_READ_STATES.includes(screen)) {
    return `read-${screen}-${counters.reads}`;
  }
  if (NOTICE_EXPORT_PHASES.includes(exportPhase)) {
    return `export-${exportPhase}-${counters.exports}`;
  }
  return null;
}

function actResultLine(kind: FinanceActionKind, result: FinanceActResult): { text: string; attention: boolean } {
  const word = ACTION_WORDS[kind];
  switch (result.kind) {
    case "APPLIED":
      return {
        text: `${word} recorded at the synthetic source. Nothing was applied: no economic state changed and no ledger was made to match. Read again to see it.`,
        attention: false,
      };
    case "REJECTED":
      return {
        text: `${word} rejected (${result.record.code ?? "no code"}). ${result.record.detail ?? ""} The source recorded nothing for this request.`.trim(),
        attention: true,
      };
    case "UNKNOWN":
      return {
        text: `${word} outcome unknown (${result.record.code ?? "no code"}). It may have been recorded. Every later request is fenced, and a read does not resolve it.`,
        attention: true,
      };
    case "FENCED":
      return { text: `${word} not sent. ${fenceText(result.fence)}`, attention: true };
    case "NOT_SENT":
      return { text: `${word} not sent. ${result.detail}`, attention: true };
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

export interface FinanceActions {
  refresh(): void;
  loadExport(): void;
  proposeCorrection(caseRef: string, correction: FinanceCorrectionKind, note: string): void;
  approveProposal(proposalRef: string): void;
  switchScope(): void;
  switchActor(next: string): void;
  revokeGrant(): void;
  advanceCut(): void;
  postSourceCorrection(): void;
  setScenario(next: FinanceScenario): void;
  newSession(): void;
}

interface Session {
  port: FinanceOperationsPort;
  controller: FinanceOperationsController;
}

function createSession(environment: "stub" | "integration-http", scenario: FinanceScenario, bookRef: string, actorRef: string): Session {
  const port = financeOperationsPortFor(environment, { scenario });
  return { port, controller: new FinanceOperationsController(port, { actorRef, bookRef }) };
}

export function useFinanceOperations(): {
  environment: "stub" | "integration-http";
  scenario: FinanceScenario;
  bookRef: string;
  actorRef: string;
  model: FinanceModel;
  actions: FinanceActions;
} {
  const environment = protocol.describe().environment;
  const sessionRef = useRef<Session | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createSession(environment, "clean", FINANCE_OWN_REF, FINANCE_REVIEWER_ACTOR);
  }
  const [scenario, setScenarioState] = useState<FinanceScenario>("clean");
  const [bookRef, setBookRef] = useState<string>(FINANCE_OWN_REF);
  const [actorRef, setActorRef] = useState<string>(FINANCE_REVIEWER_ACTOR);
  const [epoch, setEpoch] = useState(0);
  const [, setTick] = useState(0);
  const [last, setLast] = useState<FinanceLastAction | null>(null);
  const actionSeq = useRef(0);

  useEffect(() => {
    const session = sessionRef.current;
    if (session === null) {
      return undefined;
    }
    const off = session.controller.subscribe(() => setTick((value) => value + 1));
    void session.controller.read();
    return off;
  }, [epoch]);

  const note = useCallback((text: string, attention = false) => {
    actionSeq.current += 1;
    setLast({ seq: actionSeq.current, text, attention });
  }, []);

  const startSession = useCallback(
    (next: FinanceScenario, scope: string, actor: string, text: string) => {
      sessionRef.current = createSession(environment, next, scope, actor);
      setScenarioState(next);
      setEpoch((value) => value + 1);
      note(text);
    },
    [environment, note],
  );

  const run = useCallback(
    (kind: FinanceActionKind, send: () => Promise<FinanceActResult>) => {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      void send().then((result) => {
        if (sessionRef.current !== session) {
          return;
        }
        const line = actResultLine(kind, result);
        note(line.text, line.attention);
      });
    },
    [note],
  );

  const synthetic = useCallback(
    (control: FinanceSyntheticControl, moved: string, nothing: string) => {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const done = session.port.synthetic(control);
      note(done ? `${moved} A real producer offers no such control. Read again.` : nothing, done);
    },
    [note],
  );

  const actions: FinanceActions = {
    refresh() {
      void sessionRef.current?.controller.read();
    },
    loadExport() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      void session.controller.loadExport().then((result) => {
        if (sessionRef.current !== session) {
          return;
        }
        if (result.kind === "NOT_SENT") {
          note(
            result.reason === "not-bound" ? FINANCE_NOT_BOUND_REASON : `No export was sent. ${result.detail}`,
            true,
          );
        }
      });
    },
    proposeCorrection(caseRef, correction, text) {
      const session = sessionRef.current;
      if (session !== null) {
        run("propose-correction", () => session.controller.proposeCorrection(caseRef, correction, text));
      }
    },
    approveProposal(proposalRef) {
      const session = sessionRef.current;
      if (session !== null) {
        run("approve-proposal", () => session.controller.approveProposal(proposalRef));
      }
    },
    switchScope() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const next = session.controller.state().context.scope.bookRef === FINANCE_OWN_REF ? FINANCE_FOREIGN_REF : FINANCE_OWN_REF;
      const context = session.controller.switchScope(next);
      if (context === null) {
        note("A request is in flight. The scope cannot change under it.", true);
        return;
      }
      setBookRef(next);
      note(
        `Switched the book scope to ${context.scope.bookRef}, session ${context.incarnation}. Rows and the export of the earlier scope are cleared, and an answer in flight for it is dropped. One read for the new scope was asked for.`,
      );
      void session.controller.read();
    },
    switchActor(next) {
      const session = sessionRef.current;
      if (session === null || !(FINANCE_ACTORS as readonly string[]).includes(next)) {
        return;
      }
      const context = session.controller.switchActor(next);
      if (context === null) {
        note("A request is in flight. The actor cannot change under it.", true);
        return;
      }
      setActorRef(next);
      note(
        `Switched the desk actor to ${context.actorRef}, session ${context.incarnation}. It holds: ${financeCapabilities(context.actorRef).join(", ")}. Rows and the export are cleared, and an answer in flight is dropped. One read for the new actor was asked for.`,
      );
      void session.controller.read();
    },
    revokeGrant() {
      synthetic(
        "revoke-grant",
        "The synthetic grant is withdrawn at the source. The next read is refused.",
        "There is no synthetic source to withdraw a grant from.",
      );
    },
    advanceCut() {
      synthetic(
        "advance-cut",
        "The synthetic source moved on to its next cut generation. An export taken before it is now behind.",
        "There is no synthetic source to advance.",
      );
    },
    postSourceCorrection() {
      synthetic(
        "post-source-correction",
        "The synthetic source posted a later cut in which it resolved the next case. No approval chose it.",
        "There is no synthetic source to post a cut, or it has no case left to resolve.",
      );
    },
    setScenario(next) {
      startSession(next, bookRef, actorRef, `Started a new synthetic session with scenario ${next}. Earlier reads, exports, and requests are gone, as after a reload.`);
    },
    newSession() {
      startSession(
        scenario,
        bookRef,
        actorRef,
        "Started a new synthetic session. Earlier reads, exports, and requests are gone, as after a reload. Nothing was resolved at a producer.",
      );
    },
  };

  const session = sessionRef.current;
  return {
    environment,
    scenario,
    bookRef,
    actorRef,
    model: buildFinanceModel({ controller: session.controller, last }),
    actions,
  };
}

export { FINANCE_ACTORS };
