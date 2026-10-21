import { messages as sourceCopy } from "./i18n/messages/finance-operations";
import { sourceMessage } from "./i18n/source-message";
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

export const FINANCE_PAGE_TITLE = sourceCopy.en["slb"];

export const FINANCE_SOURCE_LINE =
  sourceCopy.en["sbi"];

export const FINANCE_BOUNDARY =
  sourceCopy.en["s34"];

export const FINANCE_NO_FORCE_NOTE =
  sourceCopy.en["s1wj"];

export const FINANCE_CLAIM_NOTE =
  sourceCopy.en["sji"];

export const FINANCE_CUT_NOTE =
  sourceCopy.en["sj3"];

export const FINANCE_FIGURES_NOTE =
  sourceCopy.en["s24d"];

export const FINANCE_EXPORT_NOTE =
  sourceCopy.en["s1s9"];

export const FINANCE_SCOPE_NOTE = sourceMessage(sourceCopy.en["p.t144"], { v1: FINANCE_OWN_REF, v2: FINANCE_FOREIGN_REF });

export const FINANCE_ACTOR_NOTE =
  sourceCopy.en["s1pw"];

export const FINANCE_READ_NOTE =
  sourceCopy.en["s69"];

export const FINANCE_SESSION_NOTE =
  sourceCopy.en["s1c6"];

export const FINANCE_SYNTHETIC_CONTROL_NOTE =
  sourceCopy.en["s22k"];

export const FINANCE_HOLD_NOTE = sourceMessage(sourceCopy.en["p.t8"], { v1: FINANCE_HOLD_NOT_BOUND.reason });

export const FINANCE_NOT_COMPOSED_NOTE = sourceMessage(sourceCopy.en["p.t9"], { v1: FINANCE_NOT_COMPOSED.map((entry) => entry.action).join(", ") });

export const SCENARIO_NOTES: Readonly<Record<FinanceScenario, string>> = {
  clean: sourceCopy.en["sje"],
  empty: sourceCopy.en["s1zh"],
  stale: sourceCopy.en["s21a"],
  "stale-totals": sourceCopy.en["s21e"],
  "totals-mismatch": sourceCopy.en["s14h"],
  "balance-mismatch": sourceCopy.en["s146"],
  "source-cut-skew": sourceCopy.en["s1v3"],
  "dangling-link": sourceCopy.en["s148"],
  "proposal-pending": sourceCopy.en["sx"],
  "self-approval": sourceCopy.en["sw"],
  "claims-forced": sourceCopy.en["s20y"],
  "scope-leak": sourceCopy.en["s216"],
  denied: sourceCopy.en["s1t4"],
  "read-lost": sourceCopy.en["s1q3"],
  "export-partial": sourceCopy.en["s1s6"],
  "export-stale": sourceCopy.en["s1sn"],
  "export-rows-differ": sourceCopy.en["s1si"],
  "export-denied": sourceCopy.en["s1zc"],
  "export-claims-real": sourceCopy.en["s1s4"],
  "act-lost": sourceCopy.en["s7a"],
  "approve-claims-applied": sourceCopy.en["s20a"],
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
  UNMATCHED: sourceCopy.en["s25h"],
  DUPLICATE_OBSERVATION: sourceCopy.en["shp"],
  LATE_FACT: sourceCopy.en["sqj"],
  MULTI_PAYEE: sourceCopy.en["s1k5"],
  RESIDUAL: sourceCopy.en["s1gd"],
  BALANCE_MISMATCH: sourceCopy.en["s9m"],
};

const CASE_STATE_WORDS: Readonly<Record<FinanceCaseState, string>> = {
  open: sourceCopy.en["s14s"],
  unknown: sourceCopy.en["s258"],
  "resolved-by-source": sourceCopy.en["s1gf"],
};

const VERDICT_WORDS: Readonly<Record<FinanceVerdict, string>> = {
  matched: sourceCopy.en["s20i"],
  mismatch: sourceCopy.en["s20j"],
  unknown: sourceCopy.en["s20p"],
};

const CORRECTION_WORDS: Readonly<Record<FinanceCorrectionKind, string>> = {
  "link-observation": sourceCopy.en["sqw"],
  "mark-duplicate": sourceCopy.en["srs"],
  "accept-late-fact": sourceCopy.en["sd"],
  "reassign-payee": sourceCopy.en["s1d9"],
  "allocate-remainder": sourceCopy.en["s2r"],
  "request-source-review": sourceCopy.en["s89"],
};

const PROPOSAL_STATE_WORDS: Readonly<Record<FinanceProposalState, string>> = {
  pending: sourceCopy.en["s17p"],
  "approval-recorded": sourceCopy.en["s5u"],
  rejected: sourceCopy.en["s1ew"],
};

const TRADE_STATUS_WORDS: Readonly<Record<FinanceOriginalTrade["statusLabel"], string>> = {
  booked: sourceCopy.en["sad"],
  "payment-observed": sourceCopy.en["s17j"],
  "right-moved": sourceCopy.en["s1ha"],
  "payment-unknown": sourceCopy.en["s17n"],
};

const LINE_KIND_WORDS: Readonly<Record<FinanceCase["lineKind"], string>> = {
  "sales-observed": sourceCopy.en["s7t"],
  unpaid: sourceCopy.en["s4q"],
  held: sourceCopy.en["s2a"],
  "refund-burden": sourceCopy.en["s6j"],
};

const FACT_KIND_WORDS: Readonly<Record<FinanceFact["kind"], string>> = {
  "order-observed": sourceCopy.en["s15t"],
  "payment-observed": sourceCopy.en["s17j"],
  "payment-observed-again": sourceCopy.en["s1i4"],
  "payout-recorded": sourceCopy.en["s17o"],
  "allocation-recorded": sourceCopy.en["s2u"],
  "remainder-recorded": sourceCopy.en["s1fh"],
  "late-arrival": sourceCopy.en["sqi"],
};

const ROLE_WORDS: Readonly<Record<NonNullable<FinanceAllocation["role"]>, string>> = {
  seller: sourceCopy.en["s1j2"],
  venue: sourceCopy.en["s25v"],
  platform: "Platform",
  lender: sourceCopy.en["sqr"],
};

const AUTHORITY_WORDS: Readonly<Record<FinanceAuthority, { word: string; effect: string }>> = {
  read: { word: sourceCopy.en["s1co"], effect: sourceCopy.en["s1kb"] },
  export: { word: sourceCopy.en["srf"], effect: sourceCopy.en["s87"] },
  "propose-correction": {
    word: sourceCopy.en["s19n"],
    effect: sourceCopy.en["s1e4"],
  },
  "approve-proposal": {
    word: sourceCopy.en["s5x"],
    effect: sourceCopy.en["s1e3"],
  },
  "change-economic-state": {
    word: sourceCopy.en["sbt"],
    effect: sourceCopy.en["s1up"],
  },
};

const EXPORT_REASON_WORDS: Readonly<Record<string, string>> = {
  NO_SNAPSHOT: sourceCopy.en["s1wk"],
  SOURCES_SKEWED: sourceCopy.en["s1tr"],
  SCOPE: sourceCopy.en["s1sf"],
  UNKNOWN_CUT: sourceCopy.en["s1se"],
  CUT_MISSING: sourceCopy.en["s1wa"],
  STALE_CUT: sourceCopy.en["s1sp"],
  AHEAD_CUT: sourceCopy.en["s1s7"],
  ROW_OFF_CUT: sourceCopy.en["s47"],
  PARTIAL: sourceCopy.en["s1vg"],
  COUNT: sourceCopy.en["s1sc"],
  ROWS_DIFFER: sourceCopy.en["s1sj"],
};

const ACTION_WORDS: Readonly<Record<FinanceActionKind, string>> = {
  "propose-correction": sourceCopy.en["seg"],
  "approve-proposal": sourceCopy.en["s19h"],
};

const PHASE_WORDS: Readonly<Record<FinanceActPhase, string>> = {
  applied: sourceCopy.en["s1du"],
  rejected: sourceCopy.en["s1ez"],
  denied: sourceCopy.en["sgb"],
  refused: sourceCopy.en["s1q6"],
  invalid: sourceCopy.en["s1eu"],
  "tuple-changed": sourceCopy.en["s11m"],
  "not-bound": sourceCopy.en["s12f"],
  unknown: sourceCopy.en["s16j"],
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
      return { statusLine: sourceCopy.en["s1bf"], detailLine: "", actionLabel: null };
    case "ready":
      return { statusLine: sourceCopy.en["sld"], detailLine: "", actionLabel: null };
    case "empty":
      return {
        statusLine: sourceCopy.en["sxn"],
        detailLine: detail ?? sourceCopy.en["s3w"],
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "stale":
      return { statusLine: sourceCopy.en["s1lm"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    case "denied":
      return { statusLine: sourceMessage(sourceCopy.en["p.t10"], { v1: suffix }), detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    case "refused":
      return {
        statusLine: sourceMessage(sourceCopy.en["p.t11"], { v1: suffix }),
        detailLine: sourceMessage(sourceCopy.en["p.t12"], { v1: detail ?? "" }),
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "invalid":
      return { statusLine: sourceMessage(sourceCopy.en["p.t13"], { v1: suffix }), detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    case "not-bound":
      return { statusLine: FINANCE_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: sourceCopy.en["s1v8"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1m2"],
      };
    case "unavailable":
      return {
        statusLine: sourceCopy.en["s1z1"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1ax"],
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
    return { verdictWord: "current", verdictLines: [sourceCopy.en["sfa"]] };
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
      return emptyExport("none", sourceCopy.en["svf"], "");
    case "loaded": {
      const value = exported.value;
      const declaration = value?.scopeDeclaration;
      return {
        phase: "loaded",
        statusLine: verdict.verdictWord === "current" ? sourceCopy.en["skj"] : sourceCopy.en["skk"],
        detailLine: "",
        verdictWord: verdict.verdictWord,
        verdictLines: verdict.verdictLines,
        exportRef: value?.exportRef ?? null,
        scopeLine: declaration
          ? sourceMessage(sourceCopy.en["p.t145"], { v1: declaration.provenance, v2: String(declaration.realMoney), v3: String(declaration.postedToAccountingSystem), v4: String(declaration.bookOfRecord), v5: declaration.target })
          : null,
        cutLines: (value?.cuts ?? []).map((cut) => sourceMessage(sourceCopy.en["p.t146"], { v1: cut.cutRef, v2: cut.source, v3: cut.generation, v4: cut.watermark })),
        rowsLine: value ? sourceMessage(sourceCopy.en["p.t147"], { v1: value.rows.length, v2: value.declaredRowCount }) : null,
        completeLine: value ? (value.complete ? sourceCopy.en["s1vf"] : sourceCopy.en["s1vh"]) : null,
        digestLine: value ? sourceMessage(sourceCopy.en["p.t148"], { v1: value.digest ?? "none" }) : null,
        rows:
          value?.rows.map((row) => ({
            entryRef: row.entryRef,
            kindWord: row.entryKind === "case" ? sourceCopy.en["sbe"] : row.entryKind === "payee-share" ? sourceCopy.en["s17g"] : sourceCopy.en["s24y"],
            caseRef: row.caseRef,
            payeeLine: row.payeeRef ?? sourceCopy.en["sws"],
            categoryWord: CATEGORY_WORDS[row.category],
            amountLine: figure(row.amount, row.unit),
            cutRef: row.cutRef,
          })) ?? [],
      };
    }
    case "denied":
      return emptyExport("denied", sourceMessage(sourceCopy.en["p.t149"], { v1: exported.code ?? "no code" }), exported.detail ?? "");
    case "refused":
      return emptyExport("refused", sourceMessage(sourceCopy.en["p.t150"], { v1: exported.code ?? "no code" }), exported.detail ?? "");
    case "invalid":
      return emptyExport("invalid", sourceMessage(sourceCopy.en["p.t151"], { v1: exported.code ?? "no code" }), exported.detail ?? "");
    case "not-bound":
      return emptyExport("not-bound", sourceCopy.en["s1sm"], exported.detail ?? FINANCE_NOT_BOUND_REASON);
    case "tuple-changed":
      return emptyExport("tuple-changed", sourceCopy.en["s1v6"], exported.detail ?? "");
    case "unavailable":
      return emptyExport("unavailable", sourceCopy.en["s1s2"], exported.detail ?? "");
    default: {
      const exhaustive: never = exported.phase;
      return exhaustive;
    }
  }
}

function fenceText(fence: FinanceFence): string {
  return fence.reason === "in-flight"
    ? sourceMessage(sourceCopy.en["p.t14"], { v1: fence.action })
    : sourceMessage(sourceCopy.en["p.t152"], { v1: fence.seq, v2: fence.action });
}

/**
 * The source's verdict as words. A verdict its own difference text contradicts, or whose two
 * sides sit on cuts at different positions, says so beside the verdict instead of standing alone.
 */
function verdictWordFor(verdict: FinanceVerdict, contradicted: boolean, skewed: boolean): string {
  const parts = [VERDICT_WORDS[verdict]];
  if (contradicted) {
    parts.push(sourceCopy.en["sp6"]);
  }
  if (skewed) {
    parts.push(sourceCopy.en["sp7"]);
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
      sourceMessage(sourceCopy.en["p.t153"], { v1: VERDICT_WORDS[row.verdict].replace("The source says ", ""), v2: figure(row.differenceAmount, row.unit) }),
    ];
  }
  const lines: string[] = [];
  switch (row.category) {
    case "UNMATCHED":
      lines.push(
        sourceMessage(sourceCopy.en["p.t154"], { v1: figure(row.expectedAmount, row.unit), v2: LINE_KIND_WORDS[row.lineKind], v3: row.observedCutRef ? ` on cut ${row.observedCutRef}` : "", v4: skewed ? " That cut is at a different position than the expected side, so the missing observation may be timing and not an error." : "" }),
      );
      if (row.lineKind === "refund-burden") {
        lines.push(sourceCopy.en["s234"]);
      }
      break;
    case "DUPLICATE_OBSERVATION": {
      const seen = facts.filter((fact) => fact.kind === "payment-observed" || fact.kind === "payment-observed-again");
      lines.push(
        sourceMessage(sourceCopy.en["p.t156"], { v1: seen.length, v2: seen.map((fact) => fact.factRef).join(", "), v3: figure(row.observedAmount, row.unit) }),
      );
      break;
    }
    case "LATE_FACT": {
      const late = facts.filter((fact) => fact.arrival === "after-cut");
      lines.push(
        sourceMessage(sourceCopy.en["p.t157"], { v1: late.map((fact) => fact.factRef).join(", "), v2: row.cutRef }),
      );
      break;
    }
    case "MULTI_PAYEE": {
      const shares = allocations.filter((item) => item.kind === "payee-share");
      lines.push(
        sourceMessage(sourceCopy.en["p.t158"], { v1: shares.length }),
      );
      break;
    }
    case "RESIDUAL":
      lines.push(
        sourceCopy.en["s24"],
      );
      break;
    case "BALANCE_MISMATCH":
      lines.push(
        sourceMessage(sourceCopy.en["p.t159"], { v1: figure(row.differenceAmount, row.unit) }),
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
        ? sourceCopy.en["s1tj"]
        : sourceCopy.en["s1tn"]
      : state.freshness === "STALE"
        ? sourceCopy.en["s1ti"]
        : sourceCopy.en["s1wv"];

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
    usedBy: sourceMessage(sourceCopy.en["p.t469"], { v1: usedBy.get(cut.cutRef) ?? 0 }),
  }));
  const cutAlignment = assessment?.cutAlignment ?? "none";
  const cutLine =
    cutAlignment === "aligned"
      ? sourceCopy.en["sjp"]
      : cutAlignment === "skewed"
        ? sourceCopy.en["s1yp"]
        : sourceCopy.en["sy1"];

  const capabilities = financeCapabilities(actorRef);
  const authority: FinanceAuthorityModel[] = financeAuthorityTable().map((row) => ({
    authority: row.authority,
    word: AUTHORITY_WORDS[row.authority].word,
    heldByLine: row.heldBy.length === 0 ? sourceCopy.en["snb"] : sourceMessage(sourceCopy.en["p.t160"], { v1: row.heldBy.join(", ") }),
    effectLine: AUTHORITY_WORDS[row.authority].effect,
    changesEconomicState: row.changesEconomicState,
    heldByActor: row.heldBy.includes(actorRef),
  }));

  const proposeEligibility = controller.canSend("propose-correction");
  const approveEligibility = controller.canSend("approve-proposal");
  const proposeBlock = proposeEligibility.allowed ? null : (proposeEligibility.reason ?? sourceCopy.en["sei"]);
  const approveBlock = approveEligibility.allowed ? null : (approveEligibility.reason ?? sourceCopy.en["s5v"]);

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
      caseBlock = sourceCopy.en["s20f"];
    } else if (skewed) {
      caseBlock =
        sourceCopy.en["s22p"];
    } else if (contradiction) {
      caseBlock = sourceCopy.en["s21c"];
    } else if (unlinkedCases.has(row.caseRef)) {
      caseBlock = sourceCopy.en["s1vy"];
    }

    const corrections: FinanceCorrectionButtonModel[] = row.offeredCorrections.map((correction) => {
      let reason: string | null = null;
      if (proposeBlock !== null) {
        reason = proposeBlock;
      } else if (!allowed.includes(correction)) {
        reason = caseBlock ?? sourceCopy.en["s1w1"];
      }
      return { correction, label: sourceMessage(sourceCopy.en["p.t507"], { v1: CORRECTION_WORDS[correction] }), control: { enabled: reason === null, reason } };
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
        ? sourceMessage(sourceCopy.en["p.t161"], { v1: original.tradeRef, v2: original.listingRef, v3: original.eventRef, v4: TRADE_STATUS_WORDS[original.statusLabel], v5: original.cutRef })
        : sourceMessage(sourceCopy.en["p.t162"], { v1: row.tradeRef }),
      tradeLinked: original !== undefined,
      merchantLineLine: row.merchantLineRef ? sourceMessage(sourceCopy.en["p.t163"], { v1: row.merchantLineRef, v2: LINE_KIND_WORDS[row.lineKind] }) : null,
      paymentLine: row.paymentRef ? sourceMessage(sourceCopy.en["p.t164"], { v1: row.paymentRef }) : null,
      expectedLine: sourceMessage(sourceCopy.en["p.t508"], { v1: figure(row.expectedAmount, row.unit) }),
      observedLine: sourceMessage(sourceCopy.en["p.t509"], { v1: figure(row.observedAmount, row.unit) }),
      differenceLine: sourceMessage(sourceCopy.en["p.t510"], { v1: figure(row.differenceAmount, row.unit) }),
      sidesLine: row.observedCutRef
        ? sourceMessage(sourceCopy.en["p.t165"], { v1: row.cutRef, v2: row.observedCutRef })
        : sourceMessage(sourceCopy.en["p.t166"], { v1: row.cutRef }),
      reasonLine: row.reasonCode ? sourceMessage(sourceCopy.en["p.t17"], { v1: row.reasonCode }) : sourceCopy.en["sxk"],
      skewLine: skewed
        ? sourceMessage(sourceCopy.en["p.t167"], { v1: row.cutRef, v2: row.observedCutRef ?? "(none)" })
        : null,
      contradictionLine: contradiction ? `${contradiction.code}: ${contradiction.detail}` : null,
      caseBlock,
      cutRef: row.cutRef,
      facts: facts.map((fact) => ({
        factRef: fact.factRef,
        kindWord: FACT_KIND_WORDS[fact.kind],
        arrivalWord: fact.arrival === "after-cut" ? sourceCopy.en["s27"] : sourceCopy.en["sok"],
        late: fact.arrival === "after-cut",
        amountLine: figure(fact.amount, fact.unit),
        payeeLine: fact.payeeRef ?? sourceCopy.en["sws"],
        label: fact.label,
        cutRef: fact.cutRef,
      })),
      allocations: allocations.map((item) => ({
        allocationRef: item.allocationRef,
        kindWord: item.kind === "payee-share" ? sourceCopy.en["s17g"] : sourceCopy.en["s24y"],
        roleWord: item.role ? ROLE_WORDS[item.role] : sourceCopy.en["swt"],
        payeeLine: item.payeeRef ?? sourceCopy.en["sws"],
        amountLine: figure(item.amount, item.unit),
        cutRef: item.cutRef,
        remainder: item.kind === "unapplied-remainder",
      })),
      proposals: proposals.map((item) => {
        const approvable = item.state === "pending";
        const reason = approveBlock !== null ? approveBlock : approvable ? null : sourceMessage(sourceCopy.en["p.t59"], { v1: item.proposalRef, v2: item.state });
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
          text: sourceMessage(sourceCopy.en["p.t168"], { v1: item.leftCutRef, v2: item.rightCutRef }),
        });
      }
    }
    return {
      balanceRef: row.balanceRef,
      label: row.label,
      leftLine: sourceMessage(sourceCopy.en["p.t169"], { v1: figure(row.leftAmount, row.unit), v2: row.leftCutRef }),
      rightLine: sourceMessage(sourceCopy.en["p.t169"], { v1: figure(row.rightAmount, row.unit), v2: row.rightCutRef }),
      differenceLine: figure(row.differenceAmount, row.unit),
      verdict: row.verdict,
      verdictWord: verdictWordFor(row.verdict, contradiction !== undefined, skewed),
      flags,
    };
  });

  const unlinkedLines = (assessment?.unlinked ?? []).map(
    (item) => sourceMessage(sourceCopy.en["p.t170"], { v1: item.lens, v2: item.ref, v3: item.missing, v4: item.missingRef }),
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
                sourceMessage(sourceCopy.en["p.t511"], { v1: last.receipt.kind, v2: last.receipt.proposalRef, v3: last.receipt.caseRef }),
                `economicStateChanged ${String(last.receipt.economicStateChanged)} · confirmationForcesMatch ${String(last.receipt.confirmationForcesMatch)}`,
                sourceCopy.en["s1dx"],
              ]
            : [],
        };

  const counters = state.counters;
  const session: FinanceSessionModel = {
    contextLine: sourceMessage(sourceCopy.en["p.t171"], { v1: actorRef, v2: state.context.scope.bookRef, v3: state.context.incarnation, v4: state.context.environment }),
    capabilityLine: sourceMessage(sourceCopy.en["p.t513"], { v1: actorRef, v2: capabilities.length === 0 ? "no capability" : capabilities.join(", ") }),
    countersLine: sourceMessage(sourceCopy.en["p.t172"], { v1: counters.reads, v2: counters.exports, v3: counters.acts, v4: counters.notSent, v5: counters.droppedReads, v6: counters.droppedExports }),
    earlierUnknownLine:
      state.earlierUnknown === 0
        ? sourceCopy.en["s131"]
        : sourceMessage(sourceCopy.en["p.t173"], { v1: state.earlierUnknown, v2: state.earlierUnknown === 1 ? "" : "s" }),
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
    scopeLine: sourceMessage(sourceCopy.en["p.t514"], { v1: state.context.scope.tenantId, v2: state.context.scope.bookRef }),
    watermarkLine: snapshot ? sourceMessage(sourceCopy.en["p.t41"], { v1: snapshot.watermark, v2: snapshot.snapshotId }) : sourceCopy.en["s134"],
    queueLine: queue
      ? sourceMessage(sourceCopy.en["p.t174"], { v1: queue.open, v2: queue.unknown, v3: queue.resolvedBySource })
      : sourceCopy.en["sxg"],
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
      ? sourceCopy.en["s76"]
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
        text: sourceMessage(sourceCopy.en["p.t175"], { v1: word }),
        attention: false,
      };
    case "REJECTED":
      return {
        text: sourceMessage(sourceCopy.en["p.t176"], { v1: word, v2: result.record.code ?? "no code", v3: result.record.detail ?? "" }).trim(),
        attention: true,
      };
    case "UNKNOWN":
      return {
        text: sourceMessage(sourceCopy.en["p.t177"], { v1: word, v2: result.record.code ?? "no code" }),
        attention: true,
      };
    case "FENCED":
      return { text: sourceMessage(sourceCopy.en["p.t45"], { v1: word, v2: fenceText(result.fence) }), attention: true };
    case "NOT_SENT":
      return { text: sourceMessage(sourceCopy.en["p.t45"], { v1: word, v2: result.detail }), attention: true };
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
      note(done ? sourceMessage(sourceCopy.en["p.t46"], { v1: moved }) : nothing, done);
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
            result.reason === "not-bound" ? FINANCE_NOT_BOUND_REASON : sourceMessage(sourceCopy.en["p.t178"], { v1: result.detail }),
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
        note(sourceCopy.en["s71"], true);
        return;
      }
      setBookRef(next);
      note(
        sourceMessage(sourceCopy.en["p.t179"], { v1: context.scope.bookRef, v2: context.incarnation }),
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
        note(sourceCopy.en["s72"], true);
        return;
      }
      setActorRef(next);
      note(
        sourceMessage(sourceCopy.en["p.t180"], { v1: context.actorRef, v2: context.incarnation, v3: financeCapabilities(context.actorRef).join(", ") }),
      );
      void session.controller.read();
    },
    revokeGrant() {
      synthetic(
        "revoke-grant",
        sourceCopy.en["s21s"],
        sourceCopy.en["s1wo"],
      );
    },
    advanceCut() {
      synthetic(
        "advance-cut",
        sourceCopy.en["s222"],
        sourceCopy.en["s1wp"],
      );
    },
    postSourceCorrection() {
      synthetic(
        "post-source-correction",
        sourceCopy.en["s228"],
        sourceCopy.en["s1wq"],
      );
    },
    setScenario(next) {
      startSession(next, bookRef, actorRef, sourceMessage(sourceCopy.en["p.t181"], { v1: next }));
    },
    newSession() {
      startSession(
        scenario,
        bookRef,
        actorRef,
        sourceCopy.en["s1m8"],
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
