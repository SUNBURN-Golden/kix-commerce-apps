import { messages as sourceCopy } from "./i18n/messages/delegated-assistant";
import { sourceMessage } from "./i18n/source-message";
/**
 * The delegated-assistant screen on top of the adapter's synthetic delegation source.
 * Stub scope: the default port is the synthetic source. On integration-http the same
 * port is not-bound: no current producer tuple exists for a delegation grant, an
 * assistant proposal, or an assistant command, the delegation-surface node is not
 * promoted, and kix-protocol:ai-delegation-execution-decision and
 * kix-protocol:k-authority-qualification are not merged. This module invents none,
 * sends no second attempt, and never switches adapters.
 *
 * This module computes no scope, deadline, budget, or mode. It copies what the
 * controller and the last read hold and says, for every control that is off, why it
 * is off. A request, a proposal, an approval, and a confirmed command each keep
 * their own line. Assistant text is never authority: a sentence cannot raise a
 * mode, add an action, widen a scope, or approve a proposal. A proposal is recorded
 * and sends nothing. An approval is the approve control's own press, and it sends
 * one synthetic command once. A confirmed command moves no funds and transfers no
 * right. Nothing here adopts an execution delegation.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DELEGATION_CONTRACT_REGISTER,
  DELEGATION_DESK_ACTOR,
  DELEGATION_FOREIGN_PRINCIPAL,
  DELEGATION_HOLD_NOT_BOUND,
  DELEGATION_NON_CLAIM_FIELDS,
  DELEGATION_NOT_BOUND_REASON,
  DELEGATION_NOT_COMPOSED,
  DELEGATION_OWN_PRINCIPAL,
  DELEGATION_RETURN_ACTIONS,
  DELEGATION_RULING,
  DELEGATION_UNDETERMINED,
  DelegationAssistantController,
  delegationPortFor,
  projectDelegation,
  type DelegationAssistantPort,
  type DelegationCommand,
  type DelegationDraftState,
  type DelegationFence,
  type DelegationIntentRecord,
  type DelegationMode,
  type DelegationReadState,
  type DelegationRefreshCause,
  type DelegationRejectCode,
  type DelegationReturnAction,
  type DelegationScenario,
  type DelegationStepResult,
  type DelegationSyntheticControl,
  type DelegationTurn,
} from "@kix/protocol-adapter";
import { protocol } from "./protocol";

export const DELEGATION_TITLE = sourceCopy.en["sfv"];

export const DELEGATION_ROUTE = "/assistant";

export const DELEGATION_SOURCE_LINE =
  sourceCopy.en["smw"];

export const DELEGATION_BOUNDARY =
  sourceCopy.en["s1fu"];

export const DELEGATION_NON_CLAIM_NOTE = sourceMessage(sourceCopy.en["p.t80"], { v1: DELEGATION_NON_CLAIM_FIELDS.join(", ") });

export const DELEGATION_TEXT_NOTE =
  sourceCopy.en["s1tb"];

export const DELEGATION_MODE_NOTE =
  sourceCopy.en["s1q0"];

export const DELEGATION_ACTOR_NOTE =
  sourceCopy.en["s1pu"];

export const DELEGATION_FENCE_NOTE =
  sourceCopy.en["s14j"];

export const DELEGATION_READ_NOTE =
  sourceCopy.en["s14b"];

export const DELEGATION_SESSION_NOTE =
  sourceCopy.en["sof"];

export const DELEGATION_TARGET_NOTE = sourceMessage(sourceCopy.en["p.t81"], { v1: DELEGATION_UNDETERMINED });

export const DELEGATION_HOLD_NOTE = sourceMessage(sourceCopy.en["p.t82"], { v1: DELEGATION_HOLD_NOT_BOUND.reason });

export const DELEGATION_NOT_BOUND_BANNER =
  sourceCopy.en["s10e"];

export const DELEGATION_SCENARIO_OFF_NOTE =
  sourceCopy.en["s1id"];

export const DELEGATION_ALT_PRINCIPAL_NOTE = sourceMessage(sourceCopy.en["p.t83"], { v1: DELEGATION_FOREIGN_PRINCIPAL });

export const DELEGATION_RULING_LINE = DELEGATION_RULING;

export const SCENARIO_NOTES: Readonly<Record<DelegationScenario, string>> = {
  clean: sourceCopy.en["sjr"],
  empty: sourceCopy.en["s1zr"],
  stale: sourceCopy.en["s21a"],
  denied: sourceCopy.en["s21u"],
  expired: sourceCopy.en["sms"],
  "budget-spent": sourceCopy.en["smr"],
  "closed-listing": sourceCopy.en["sr3"],
  "draft-lost": sourceCopy.en["s1s"],
  "cancel-lost": sourceCopy.en["s8"],
  "held-response": sourceCopy.en["s4o"],
  "receipt-claims-execution": sourceCopy.en["s208"],
  "snapshot-claims-authority": sourceCopy.en["s1y9"],
  "scope-leak": sourceCopy.en["s20q"],
  "race-superseded": sourceCopy.en["s1st"],
};

export const CONTROL_LABELS: Readonly<Record<DelegationSyntheticControl, string>> = {
  "revoke-grant": sourceCopy.en["s1ko"],
  "supersede-grant": sourceCopy.en["s1kp"],
  "expire-grant": sourceCopy.en["s1kq"],
  "spend-budget": sourceCopy.en["s1kf"],
  "close-listing": sourceCopy.en["s1kr"],
};

const STEP_WORDS: Readonly<Record<DelegationCommand, string>> = { "draft-order": sourceCopy.en["shb"], "cancel-draft": sourceCopy.en["sax"] };

const DRAFT_STATE_WORDS: Readonly<Record<DelegationDraftState, string>> = { staged: sourceCopy.en["s1lf"], cancelled: sourceCopy.en["sb1"] };

export type DelegationScreenState =
  | "loading"
  | "unread"
  | "ready"
  | "empty"
  | "stale"
  | "denied"
  | "refused"
  | "not-bound"
  | "unavailable"
  | "tuple-changed";

export interface ControlModel {
  enabled: boolean;
  /** Why the control is off. Null when it is on. */
  reason: string | null;
}

export interface LaneModel {
  lane: "query" | "proposal" | "approval" | "command";
  label: string;
  line: string;
  count: number | null;
}

export interface GrantModel {
  grantRef: string;
  scopeLine: string;
  targetLine: string;
  deadlineLine: string;
  budgetLine: string;
  actionsLine: string;
  modeLine: string;
  versionLine: string;
  stateLine: string;
}

export interface DraftModel {
  draftRef: string;
  listingRef: string;
  state: DelegationDraftState;
  stateLine: string;
  grantLine: string;
  linkLine: string;
}

export interface ListingModel {
  listingRef: string;
  eventRef: string;
  title: string;
  tierLine: string;
  state: string;
  stateLine: string;
  drafts: DraftModel[];
}

export interface ProposalModel {
  proposalRef: string;
  step: DelegationCommand;
  stepWord: string;
  targetRef: string;
  stateWord: string;
  detail: string;
  approve: ControlModel;
  dismiss: ControlModel;
}

export interface TurnModel {
  seq: number;
  excerpt: string;
  kind: DelegationTurn["kind"];
  kindWord: string;
  proposalRef: string | null;
  /** What the turn said, or what the last read answers for it. */
  detail: string;
  lines: string[];
}

export interface RejectionModel {
  intentRef: string;
  stepWord: string;
  target: string;
  code: string;
  returnAction: DelegationReturnAction;
  returnLine: string;
  detail: string;
}

export interface IntentRow {
  seq: number;
  intentRef: string;
  stepWord: string;
  proposalRef: string;
  grantRef: string;
  targetRef: string;
  outcome: string;
  code: string;
}

export interface SessionModel {
  contextLine: string;
  countersLine: string;
  intents: IntentRow[];
  quarantineLines: string[];
  unlinkedLines: string[];
}

export interface RegisterRowModel {
  id: string;
  field: string;
  status: "field-named" | "not-bound";
  statusWord: string;
  bodyFields: string;
  reason: string;
}

export type LastAction =
  | { seq: number; kind: "step"; step: DelegationCommand; result: DelegationStepResult }
  | { seq: number; kind: "note"; text: string; attention: boolean };

export interface DelegationAssistantModel {
  state: DelegationScreenState;
  statusLine: string;
  detailLine: string;
  /** Label of the one return action of the status, or null. */
  actionLabel: string | null;
  freshnessWord: string;
  lanes: LaneModel[];
  grants: GrantModel[];
  listings: ListingModel[];
  drafts: DraftModel[];
  proposals: ProposalModel[];
  turns: TurnModel[];
  rejections: RejectionModel[];
  session: SessionModel;
  register: RegisterRowModel[];
  notComposed: { action: string; reason: string }[];
  principalRef: string;
  lastLine: string | null;
  /** True when the last action asks for attention (a refusal, a block, a rejection, an unknown result, a refused read). */
  lastNeedsFocus: boolean;
  /** Sequence of the last action, so a repeated message still moves focus. */
  lastSeq: number | null;
}

export function causeLine(cause: DelegationRefreshCause): string {
  switch (cause) {
    case "own-write":
      return sourceCopy.en["s279"];
    case "rejection":
      return sourceCopy.en["s20c"];
    case "context-switch":
      return sourceCopy.en["s1xw"];
    default: {
      const exhaustive: never = cause;
      return exhaustive;
    }
  }
}

/** The one thing the page offers for a rejection. There is no other. */
export function returnActionLine(action: DelegationReturnAction): string {
  switch (action) {
    case "read-again":
      return sourceCopy.en["s1b5"];
    case "revise-request":
      return sourceCopy.en["s1h3"];
    case "none":
      return sourceCopy.en["s11b"];
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

/** Why an approval is off. Each fence maps to one sentence and no fence is a failure of the page. */
export function fenceLine(fence: DelegationFence): string {
  switch (fence.reason) {
    case "in-flight":
      return sourceMessage(sourceCopy.en["p.t84"], { v1: fence.intentRef });
    case "unknown-outcome": {
      const earlier = fence.earlierContext ? " It was sent in an earlier session context." : "";
      return sourceMessage(sourceCopy.en["p.t85"], { v1: fence.intentRef, v2: earlier });
    }
    case "no-snapshot":
      return sourceCopy.en["s1cl"];
    case "snapshot-stale":
      return sourceMessage(sourceCopy.en["p.t86"], { v1: causeLine(fence.cause) });
    case "duplicate-intent":
      return sourceMessage(sourceCopy.en["p.t87"], { v1: fence.intentRef });
    case "proposal-missing":
      return sourceMessage(sourceCopy.en["p.t88"], { v1: fence.proposalRef });
    case "proposal-closed":
      return sourceMessage(sourceCopy.en["p.t89"], { v1: fence.proposalRef, v2: fence.state });
    case "proposal-stale":
      return sourceMessage(sourceCopy.en["p.t90"], { v1: fence.proposalRef });
    case "not-listed":
      return sourceMessage(sourceCopy.en["p.t91"], { v1: fence.ref });
    case "no-grant":
      return sourceMessage(sourceCopy.en["p.t92"], { v1: fence.targetRef });
    case "grant-not-active":
      return sourceMessage(sourceCopy.en["p.t93"], { v1: fence.grantRef, v2: fence.state });
    case "mode-capped":
      return sourceMessage(sourceCopy.en["p.t94"], { v1: fence.grantRef, v2: fence.requestedMode, v3: fence.adoptedMode });
    case "action-not-granted":
      return sourceMessage(sourceCopy.en["p.t95"], { v1: fence.grantRef, v2: fence.step });
    case "budget-exhausted":
      return sourceMessage(sourceCopy.en["p.t96"], { v1: fence.grantRef });
    case "target-closed":
      return sourceMessage(sourceCopy.en["p.t97"], { v1: fence.ref, v2: fence.state });
    case "not-bound":
      return DELEGATION_NOT_BOUND_REASON;
    default: {
      const exhaustive: never = fence;
      return exhaustive;
    }
  }
}

export function stepResultLine(step: DelegationCommand, result: DelegationStepResult): string {
  const word = STEP_WORDS[step];
  switch (result.kind) {
    case "CONFIRMED":
      return step === "draft-order"
        ? sourceMessage(sourceCopy.en["p.t98"], { v1: result.intent.receipt ? ` as ${result.intent.receipt.draftRef}` : "" })
        : sourceMessage(sourceCopy.en["p.t99"], { v1: DELEGATION_UNDETERMINED });
    case "REJECTED": {
      const action = returnActionLine(DELEGATION_RETURN_ACTIONS[result.intent.code as DelegationRejectCode] ?? "read-again");
      return sourceMessage(sourceCopy.en["p.t100"], { v1: word, v2: result.intent.code ?? "no code", v3: result.intent.message ?? "", v4: action }).replace(/\s+/g, " ").trim();
    }
    case "UNKNOWN":
      return sourceMessage(sourceCopy.en["p.t101"], { v1: word, v2: result.intent.code ?? "no code" });
    case "QUARANTINED":
      return sourceMessage(sourceCopy.en["p.t102"], { v1: word.toLowerCase() });
    case "FENCED":
      return sourceMessage(sourceCopy.en["p.t45"], { v1: word, v2: fenceLine(result.fence) });
    case "NOT_SENT":
      return sourceMessage(sourceCopy.en["p.t45"], { v1: word, v2: result.detail });
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

const TURN_KIND_WORDS: Readonly<Record<DelegationTurn["kind"], string>> = {
  answer: sourceCopy.en["s4m"],
  proposal: sourceCopy.en["s19g"],
  clarify: sourceCopy.en["stj"],
  refused: sourceCopy.en["s1et"],
};

function attentionFor(last: LastAction | null): boolean {
  if (last === null) {
    return false;
  }
  if (last.kind === "note") {
    return last.attention;
  }
  return last.result.kind !== "CONFIRMED";
}

function control(fence: DelegationFence | null): ControlModel {
  return fence === null ? { enabled: true, reason: null } : { enabled: false, reason: fenceLine(fence) };
}

function readStateToScreen(readState: DelegationReadState, refreshRequired: DelegationRefreshCause | null): DelegationScreenState {
  switch (readState) {
    case "none":
      return refreshRequired === "context-switch" ? "unread" : "loading";
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
  state: DelegationScreenState,
  detail: string | null,
  code: string | null,
): { statusLine: string; detailLine: string; actionLabel: string | null } {
  const coded = code ? ` (${code})` : "";
  switch (state) {
    case "loading":
      return { statusLine: sourceCopy.en["s1be"], detailLine: "", actionLabel: null };
    case "unread":
      return {
        statusLine: sourceCopy.en["s1xx"],
        detailLine: sourceCopy.en["s1b2"],
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "ready":
      return { statusLine: sourceCopy.en["sfz"], detailLine: "", actionLabel: null };
    case "empty":
      return { statusLine: sourceCopy.en["svm"], detailLine: sourceCopy.en["s116"], actionLabel: sourceCopy.en["s1ax"] };
    case "stale":
      return { statusLine: sourceCopy.en["s1ll"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    case "denied":
      return {
        statusLine: sourceMessage(sourceCopy.en["p.t103"], { v1: coded }),
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "refused":
      return {
        statusLine: sourceMessage(sourceCopy.en["p.t104"], { v1: coded }),
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "not-bound":
      return { statusLine: DELEGATION_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: sourceCopy.en["s1v9"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1m2"],
      };
    case "unavailable":
      return { statusLine: sourceCopy.en["s1z0"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function modeLine(mode: DelegationMode, requested: DelegationMode, grantRef: string): string {
  if (mode === requested) {
    return sourceMessage(sourceCopy.en["p.t105"], { v1: mode });
  }
  return sourceMessage(sourceCopy.en["p.t106"], { v1: requested, v2: mode, v3: grantRef, v4: mode === "propose" ? "query/propose" : mode });
}

/** What a question turn answers out of the last read. A query sends nothing. */
function answerLines(question: string, model: { grants: GrantModel[]; listings: ListingModel[]; drafts: DraftModel[] }, counters: string): string[] {
  switch (question) {
    case "grants":
      return model.grants.length === 0
        ? [sourceCopy.en["svn"]]
        : model.grants.map((grant) => `${grant.grantRef}: ${grant.modeLine}`);
    case "board":
      return model.listings.length === 0
        ? [sourceCopy.en["sw1"]]
        : model.listings.map((listing) => sourceMessage(sourceCopy.en["p.t489"], { v1: listing.listingRef, v2: listing.eventRef, v3: listing.state }));
    case "drafts":
      return model.drafts.length === 0
        ? [sourceCopy.en["sys"]]
        : model.drafts.map((draft) => sourceMessage(sourceCopy.en["p.t490"], { v1: draft.draftRef, v2: draft.listingRef, v3: DRAFT_STATE_WORDS[draft.state] }));
    case "session":
      return [counters];
    default:
      return [sourceCopy.en["s1th"]];
  }
}

/** The unused-intent id the gate preview asks with. It is never sent. */
const GATE_PREVIEW = "gate-preview";

export function buildDelegationAssistantModel(input: {
  controller: DelegationAssistantController;
  environment: "stub" | "integration-http";
  last: LastAction | null;
}): DelegationAssistantModel {
  const { controller } = input;
  const state = controller.state();
  const screen = readStateToScreen(state.readState, state.refreshRequired);
  const status = statusFor(screen, state.readDetail, state.readCode);
  const projection = projectDelegation(state);
  const freshnessWord =
    state.freshness === "CURRENT"
      ? sourceCopy.en["s1tn"]
      : state.freshness === "STALE"
        ? sourceCopy.en["s1ti"]
        : sourceCopy.en["s1wv"];

  const grants: GrantModel[] = projection.grants.map((grant) => ({
    grantRef: grant.grantRef,
    scopeLine: sourceMessage(sourceCopy.en["p.t107"], { v1: grant.scope, v2: grant.principalRef }),
    targetLine: sourceMessage(sourceCopy.en["p.t108"], { v1: grant.targetEventRef }),
    deadlineLine: sourceMessage(sourceCopy.en["p.t109"], { v1: grant.notAfter }),
    budgetLine: sourceMessage(sourceCopy.en["p.t110"], { v1: grant.commandBudget, v2: grant.commandsUsed }),
    actionsLine: sourceMessage(sourceCopy.en["p.t111"], { v1: grant.allowedActions.join(", ") || "none" }),
    modeLine: modeLine(grant.adoptedMode, grant.requestedMode, grant.grantRef),
    versionLine: sourceMessage(sourceCopy.en["p.t112"], { v1: grant.version }),
    stateLine: grant.state === "active" ? sourceCopy.en["s11"] : sourceCopy.en["s1h5"],
  }));

  const drafts: DraftModel[] = projection.drafts.map((draft) => ({
    draftRef: draft.draftRef,
    listingRef: draft.listingRef,
    state: draft.state,
    stateLine: sourceMessage(sourceCopy.en["p.t113"], { v1: DRAFT_STATE_WORDS[draft.state] }),
    grantLine: sourceMessage(sourceCopy.en["p.t114"], { v1: draft.grantRef, v2: draft.grantVersion }),
    linkLine: draft.linked
      ? sourceCopy.en["stg"]
      : sourceCopy.en["s13p"],
  }));

  const listings: ListingModel[] = projection.listings.map((listing) => ({
    listingRef: listing.listingRef,
    eventRef: listing.eventRef,
    title: listing.title,
    tierLine: sourceMessage(sourceCopy.en["p.t115"], { v1: listing.tier }),
    state: listing.state,
    stateLine: listing.state === "open" ? sourceCopy.en["s150"] : sourceCopy.en["scw"],
    drafts: drafts.filter((draft) => draft.listingRef === listing.listingRef),
  }));

  const proposals: ProposalModel[] = projection.proposals.map((proposal) => ({
    proposalRef: proposal.proposalRef,
    step: proposal.step,
    stepWord: STEP_WORDS[proposal.step],
    targetRef: proposal.targetRef,
    stateWord: proposal.state === "open" ? sourceCopy.en["s14s"] : proposal.state === "dismissed" ? sourceCopy.en["sgv"] : sourceCopy.en["se5"],
    detail: proposal.detail,
    approve:
      proposal.state === "open"
        ? control(controller.gateFor({ proposalRef: proposal.proposalRef, intentRef: GATE_PREVIEW }))
        : { enabled: false, reason: sourceMessage(sourceCopy.en["p.t89"], { v1: proposal.proposalRef, v2: proposal.state }) },
    dismiss:
      proposal.state === "open"
        ? { enabled: true, reason: null }
        : { enabled: false, reason: sourceMessage(sourceCopy.en["p.t116"], { v1: proposal.proposalRef, v2: proposal.state }) },
  }));

  const countersLine = sourceMessage(sourceCopy.en["p.t117"], { v1: state.counters.sent, v2: state.counters.fenced, v3: state.counters.notSent, v4: state.counters.droppedReads, v5: state.counters.refusedRequests });

  const modelSoFar = { grants, listings, drafts };
  const turns: TurnModel[] = projection.turns.map((record) => ({
    seq: record.seq,
    excerpt: record.excerpt,
    kind: record.turn.kind,
    kindWord: TURN_KIND_WORDS[record.turn.kind],
    proposalRef: record.proposalRef,
    detail: record.turn.detail,
    lines: record.turn.kind === "answer" ? answerLines(record.turn.question, modelSoFar, countersLine) : [],
  }));

  const rejections: RejectionModel[] = projection.rejections.map((row) => ({
    intentRef: row.intentRef,
    stepWord: STEP_WORDS[row.step],
    target: sourceMessage(sourceCopy.en["p.t491"], { v1: row.targetRef, v2: row.grantRef }),
    code: row.code,
    returnAction: row.returnAction,
    returnLine: returnActionLine(row.returnAction),
    detail: row.detail,
  }));

  const lanes: LaneModel[] = [
    {
      lane: "query",
      label: sourceCopy.en["s1ap"],
      count: turns.filter((turn) => turn.kind === "answer").length,
      line: sourceMessage(sourceCopy.en["p.t118"], { v1: turns.filter((turn) => turn.kind === "answer").length }),
    },
    {
      lane: "proposal",
      label: sourceCopy.en["s19g"],
      count: proposals.filter((proposal) => proposal.stateWord === sourceCopy.en["s14s"]).length,
      line: sourceMessage(sourceCopy.en["p.t119"], { v1: proposals.length, v2: proposals.length === 1 ? "" : "s", v3: proposals.filter((proposal) => proposal.stateWord === "Open").length }),
    },
    {
      lane: "approval",
      label: sourceCopy.en["s5t"],
      count: state.intents.length,
      line: sourceMessage(sourceCopy.en["p.t120"], { v1: state.intents.length, v2: state.intents.length === 1 ? "" : "s" }),
    },
    {
      lane: "command",
      label: sourceCopy.en["sd5"],
      count: state.intents.filter((intent) => intent.outcome === "CONFIRMED").length,
      line: sourceMessage(sourceCopy.en["p.t121"], { v1: state.intents.filter((intent) => intent.outcome === "CONFIRMED").length, v2: state.intents.filter((intent) => intent.outcome === "UNKNOWN" || intent.outcome === "IN_FLIGHT").length }),
    },
  ];

  const intents: IntentRow[] = state.intents.map((intent: DelegationIntentRecord) => ({
    seq: intent.seq,
    intentRef: intent.intentRef,
    stepWord: STEP_WORDS[intent.step],
    proposalRef: intent.proposalRef,
    grantRef: intent.grantRef,
    targetRef: intent.targetRef,
    outcome: intent.outcome,
    code: intent.code ?? "",
  }));
  const quarantineLines = state.quarantined.map(
    (item) => sourceMessage(sourceCopy.en["p.t122"], { v1: item.arrived, v2: item.intentRef, v3: item.cause }),
  );
  const unlinkedLines = projection.unlinkedIntents.map(
    (intent) =>
      sourceMessage(sourceCopy.en["p.t123"], { v1: STEP_WORDS[intent.step], v2: intent.intentRef, v3: intent.grantRef, v4: intent.outcome.toLowerCase().replace("_", " ") }),
  );
  const session: SessionModel = {
    contextLine: sourceMessage(sourceCopy.en["p.t492"], { v1: state.context.actorRef, v2: state.context.principalRef, v3: state.context.incarnation, v4: state.context.environment }),
    countersLine,
    intents,
    quarantineLines,
    unlinkedLines,
  };

  let lastLine: string | null = null;
  if (input.last !== null) {
    lastLine = input.last.kind === "note" ? input.last.text : stepResultLine(input.last.step, input.last.result);
  }

  return {
    state: screen,
    statusLine: status.statusLine,
    detailLine: status.detailLine,
    actionLabel: status.actionLabel,
    freshnessWord,
    lanes,
    grants,
    listings,
    drafts,
    proposals,
    turns,
    rejections,
    session,
    register: DELEGATION_CONTRACT_REGISTER.map((row) => ({
      id: row.id,
      field: row.delegationField,
      status: row.status,
      statusWord: row.status === "field-named" ? sourceCopy.en["sl3"] : sourceCopy.en["s10d"],
      bodyFields: row.bodyFields.length === 0 ? "none" : row.bodyFields.map((entry) => `${entry.action}.${entry.field}`).join(", "),
      reason: row.reason,
    })),
    notComposed: DELEGATION_NOT_COMPOSED.map((row) => ({ action: row.action, reason: row.reason })),
    principalRef: state.context.principalRef,
    lastLine,
    lastNeedsFocus: attentionFor(input.last),
    lastSeq: input.last === null ? null : input.last.seq,
  };
}

export interface DelegationAssistantActions {
  ask(text: string): void;
  refresh(): void;
  approve(proposalRef: string): void;
  dismiss(proposalRef: string): void;
  setScenario(next: DelegationScenario): void;
  deliverHeld(): void;
  switchScope(): void;
  newSession(): void;
  simulate(control: DelegationSyntheticControl): void;
}

interface Session {
  port: DelegationAssistantPort;
  controller: DelegationAssistantController;
}

function createSession(environment: "stub" | "integration-http", scenario: DelegationScenario): Session {
  const port = delegationPortFor(environment, { scenario });
  return {
    port,
    controller: new DelegationAssistantController(port, { actorRef: DELEGATION_DESK_ACTOR, principalRef: DELEGATION_OWN_PRINCIPAL }),
  };
}

const ATTENTION_READS: readonly DelegationReadState[] = ["stale", "denied", "refused", "unavailable", "tuple-changed"];

export function useDelegationAssistant(): {
  environment: "stub" | "integration-http";
  scenario: DelegationScenario;
  model: DelegationAssistantModel;
  heldSupported: boolean;
  actions: DelegationAssistantActions;
} {
  const environment = protocol.describe().environment;
  const sessionRef = useRef<Session | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createSession(environment, "clean");
  }
  const [scenario, setScenarioState] = useState<DelegationScenario>("clean");
  const [epoch, setEpoch] = useState(0);
  const [, setTick] = useState(0);
  const [last, setLast] = useState<LastAction | null>(null);
  const intentCounter = useRef(0);
  const actionSeq = useRef(0);

  const note = useCallback((text: string, attention = false) => {
    actionSeq.current += 1;
    setLast({ seq: actionSeq.current, kind: "note", text, attention });
  }, []);

  /** One read. A read the source refused, found stale, or did not answer takes the person's attention. */
  const read = useCallback(
    async (session: Session) => {
      const result = await session.controller.refresh();
      if (sessionRef.current !== session || result.kind !== "APPLIED") {
        return;
      }
      if (ATTENTION_READS.includes(result.readState)) {
        const state = session.controller.state();
        note(sourceMessage(sourceCopy.en["p.t124"], { v1: result.readState, v2: state.readCode ? ` (${state.readCode})` : "" }), true);
      }
    },
    [note],
  );

  useEffect(() => {
    const session = sessionRef.current;
    if (session === null) {
      return undefined;
    }
    const off = session.controller.subscribe(() => setTick((value) => value + 1));
    void read(session);
    return off;
  }, [epoch, read]);

  const nextIntent = useCallback(() => {
    intentCounter.current += 1;
    return `intent-${intentCounter.current}`;
  }, []);

  const run = useCallback(
    async (proposalRef: string) => {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const proposal = session.controller.state().proposals.find((item) => item.proposalRef === proposalRef);
      const step = proposal?.step ?? "draft-order";
      const result = await session.controller.approve({ proposalRef, intentRef: nextIntent() });
      if (sessionRef.current !== session) {
        return;
      }
      actionSeq.current += 1;
      setLast({ seq: actionSeq.current, kind: "step", step, result });
      // A quarantined result belongs to a context this page left, so it has nothing to read again.
      if (result.kind === "CONFIRMED" || result.kind === "REJECTED" || result.kind === "UNKNOWN") {
        await session.controller.refresh();
      }
    },
    [nextIntent],
  );

  const startSession = useCallback(
    (next: DelegationScenario, text: string) => {
      sessionRef.current = createSession(environment, next);
      intentCounter.current = 0;
      setScenarioState(next);
      setEpoch((value) => value + 1);
      note(text);
    },
    [environment, note],
  );

  const actions: DelegationAssistantActions = {
    ask(text) {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const turn = session.controller.interpret(text);
      actionSeq.current += 1;
      switch (turn.kind) {
        case "proposal":
          setLast({ seq: actionSeq.current, kind: "note", text: sourceMessage(sourceCopy.en["p.t125"], { v1: turn.detail }), attention: false });
          break;
        case "answer":
          setLast({ seq: actionSeq.current, kind: "note", text: turn.detail, attention: false });
          break;
        case "clarify":
          setLast({ seq: actionSeq.current, kind: "note", text: turn.detail, attention: true });
          break;
        case "refused":
          setLast({ seq: actionSeq.current, kind: "note", text: sourceMessage(sourceCopy.en["p.t494"], { v1: turn.code, v2: turn.detail }), attention: true });
          break;
        default: {
          const exhaustive: never = turn;
          return exhaustive;
        }
      }
    },
    refresh() {
      const session = sessionRef.current;
      if (session !== null) {
        void read(session);
      }
    },
    approve(proposalRef) {
      void run(proposalRef);
    },
    dismiss(proposalRef) {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const result = session.controller.dismiss(proposalRef);
      note(
        result.kind === "dismissed"
          ? sourceMessage(sourceCopy.en["p.t126"], { v1: proposalRef })
          : result.kind === "closed"
            ? sourceMessage(sourceCopy.en["p.t127"], { v1: proposalRef })
            : sourceMessage(sourceCopy.en["p.t128"], { v1: proposalRef }),
      );
    },
    setScenario(next) {
      if (environment !== "stub") {
        note(DELEGATION_SCENARIO_OFF_NOTE);
        return;
      }
      startSession(next, sourceMessage(sourceCopy.en["p.t129"], { v1: next }));
    },
    deliverHeld() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const count = session.port.deliverHeld();
      note(count === 0 ? sourceCopy.en["svq"] : sourceMessage(sourceCopy.en["p.t130"], { v1: count, v2: count === 1 ? "" : "s" }));
    },
    switchScope() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const current = session.controller.state().context.principalRef;
      const next = session.controller.switchContext({ principalRef: current === DELEGATION_OWN_PRINCIPAL ? DELEGATION_FOREIGN_PRINCIPAL : DELEGATION_OWN_PRINCIPAL });
      note(sourceMessage(sourceCopy.en["p.t131"], { v1: next.principalRef, v2: next.incarnation }));
      void read(session);
    },
    newSession() {
      startSession(scenario, sourceCopy.en["s1m7"]);
    },
    simulate(controlName) {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const result = session.port.simulate({
        control: controlName,
        grantRef: controlName === "close-listing" ? undefined : "grt-0001",
        listingRef: controlName === "close-listing" ? "lst-0001" : undefined,
      });
      // The page does not read again: a real producer event is not seen until a read.
      note(
        result.kind === "done"
          ? sourceMessage(sourceCopy.en["p.t132"], { v1: result.detail })
          : sourceMessage(sourceCopy.en["p.t133"], { v1: result.reason }),
      );
      session.controller.notify();
    },
  };

  const session = sessionRef.current;
  return {
    environment,
    scenario,
    model: buildDelegationAssistantModel({ controller: session.controller, environment, last }),
    heldSupported: scenario === "held-response",
    actions,
  };
}
