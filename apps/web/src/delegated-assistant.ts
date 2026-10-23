import { connectivityPort, connectivityController, connectedActions } from "./connectivity/write-guard";
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
import { protocol } from "./connectivity/desk-protocol";

export const DELEGATION_TITLE = "Delegated assistant (synthetic)";

export const DELEGATION_ROUTE = "/assistant";

export const DELEGATION_SOURCE_LINE =
  "Grants, listings, staged drafts, and every answer come from a synthetic delegation source on this page load. They are not a producer read and not a catalogue receipt. The grant rows you see are the source's own records, copied.";

export const DELEGATION_BOUNDARY =
  "Request, proposal, approval, and command are four separate lines. Request text is untrusted intent, never authority. A proposal is the page's own record and is not an approval. An approval is the approve control, not a sentence, and it is not a result: it lets this page send one synthetic command, once. A confirmed command is the synthetic source's record of it. It moves no funds and transfers no right.";

export const DELEGATION_NON_CLAIM_NOTE = `Every read and every answer states these seven as false, and a payload that omits one or states it otherwise is refused whole: ${DELEGATION_NON_CLAIM_FIELDS.join(", ")}.`;

export const DELEGATION_TEXT_NOTE =
  "The interpreter is a deterministic stand-in for an LLM. It maps a request onto at most a structured proposal and refuses or clarifies everything else. It infers no grant, no scope, no action, no budget, and no approval from a goal it cannot read, and instruction-like text in a request refuses the whole request.";

export const DELEGATION_MODE_NOTE =
  "The adopted mode on a grant is the source's own ceiling. Query answers questions, propose records proposals, command lets an approved proposal become one synthetic command. An unadopted execution delegation stays in query/propose mode, and nothing on this page raises a requested or adopted mode.";

export const DELEGATION_ACTOR_NOTE =
  "The actor string and the principal are context labels. They are not an authentication result, and the source decides scope with its own synthetic grants.";

export const DELEGATION_FENCE_NOTE =
  "One write is sent at a time per grant, and each is sent once under the caller's own intent reference. This page does not send a write again, does not mint an intent, and does not undo one with another. A revoke, a stale grant, or a lost answer keeps the grant's writes blocked.";

export const DELEGATION_READ_NOTE =
  "One read follows each settled write so the next approval can use fresh evidence. Nothing polls. A read is evidence and never resolves an unknown write. A Simulate control stands in for something a real producer would do, and this page does not see its effect until it reads.";

export const DELEGATION_SESSION_NOTE =
  "Intents and proposals live in this page load only. A reload, a new synthetic session, or a context switch clears them and resolves nothing at a producer. A proposal recorded before a context switch is stale and cannot be approved.";

export const DELEGATION_TARGET_NOTE = `Whether a cancel restores a command budget is a product policy that is not published. The source states ${DELEGATION_UNDETERMINED}, and this page restores and recomputes nothing.`;

export const DELEGATION_HOLD_NOTE = `Holding a seat is not available here. ${DELEGATION_HOLD_NOT_BOUND.reason} A staged draft is not a hold and not a booking.`;

export const DELEGATION_NOT_BOUND_BANNER =
  "NOT BOUND. There is no source on integration-http, so no grant, listing, draft, or proposal is read or written here, and nothing falls back to the synthetic source. Requests still interpret, but no command can be approved.";

export const DELEGATION_SCENARIO_OFF_NOTE =
  "Scenarios and Simulate events belong to the synthetic source, which is not selected on integration-http. They are off here, and nothing falls back to the synthetic source.";

export const DELEGATION_ALT_PRINCIPAL_NOTE = `Principal ${DELEGATION_FOREIGN_PRINCIPAL} is a principal this desk holds no grant from. Switching to it shows the source's refusal and no row.`;

export const DELEGATION_RULING_LINE = DELEGATION_RULING;

export const SCENARIO_NOTES: Readonly<Record<DelegationScenario, string>> = {
  clean: "Every step is answered. One grant is adopted at command mode over evt-0001; a second grant on evt-0002 was adopted at propose only.",
  empty: "The source lists no grant for this principal.",
  stale: "The source serves a watermark older than the floor this page holds.",
  denied: "The synthetic grants for this principal were withdrawn at the source.",
  expired: "Grant grt-0001 is already past its deadline at the source.",
  "budget-spent": "Grant grt-0001 has no command budget left at the source.",
  "closed-listing": "Listing lst-0001 is closed at the source.",
  "draft-lost": "A draft order is recorded and its answer is lost.",
  "cancel-lost": "A cancel is recorded and its answer is lost.",
  "held-response": "Answers are held until you deliver them. Use it to switch the session while a write is in flight.",
  "receipt-claims-execution": "The source records a draft order and then answers that funds moved. The answer is not trusted.",
  "snapshot-claims-authority": "The source answers a read that claims assistant text is authority and an execution delegation is bound. The whole payload is refused.",
  "scope-leak": "The source sends a draft that belongs to another principal. The whole payload is refused.",
  "race-superseded": "The first write after the first read finds the grant already moved to a newer version at the source, as a supersede between read and write would.",
};

export const CONTROL_LABELS: Readonly<Record<DelegationSyntheticControl, string>> = {
  "revoke-grant": "Simulate: grant grt-0001 is revoked at the source",
  "supersede-grant": "Simulate: grant grt-0001 moves to a newer version",
  "expire-grant": "Simulate: grant grt-0001 passes its deadline",
  "spend-budget": "Simulate: another channel uses the grt-0001 command budget",
  "close-listing": "Simulate: listing lst-0001 closes at the source",
};

const STEP_WORDS: Readonly<Record<DelegationCommand, string>> = { "draft-order": "Draft order", "cancel-draft": "Cancel draft" };

const DRAFT_STATE_WORDS: Readonly<Record<DelegationDraftState, string>> = { staged: "Staged", cancelled: "Cancelled" };

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
      return "Your own write landed after the last read.";
    case "rejection":
      return "The source rejected the last write, so the read it was built from is behind.";
    case "context-switch":
      return "The session context changed.";
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
      return "Read again to see what the source holds now.";
    case "revise-request":
      return "Revise the request: name a different action or target. The assistant does not search for a wider grant or infer one.";
    case "none":
      return "Nothing on this page corrects it. The source decides.";
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
      return `Another write under this grant is in flight (${fence.intentRef}). Wait for its answer.`;
    case "unknown-outcome": {
      const earlier = fence.earlierContext ? " It was sent in an earlier session context." : "";
      return `An earlier write under this grant has an unknown result (${fence.intentRef}).${earlier} Writes under this grant stay blocked. A read does not resolve it.`;
    }
    case "no-snapshot":
      return "Read the grants first.";
    case "snapshot-stale":
      return `Read again before the next write. ${causeLine(fence.cause)}`;
    case "duplicate-intent":
      return `Intent ${fence.intentRef} was already used. This page does not send the same intent twice.`;
    case "proposal-missing":
      return `Proposal ${fence.proposalRef} is not on this page. Only a recorded proposal can be approved.`;
    case "proposal-closed":
      return `Proposal ${fence.proposalRef} is ${fence.state}. Only an open proposal can be approved.`;
    case "proposal-stale":
      return `Proposal ${fence.proposalRef} was recorded before the session context changed. It is stale.`;
    case "not-listed":
      return `${fence.ref} is not in the last read.`;
    case "no-grant":
      return `No grant in the last read covers ${fence.targetRef}. The assistant infers none.`;
    case "grant-not-active":
      return `Grant ${fence.grantRef} is ${fence.state} in the last read.`;
    case "mode-capped":
      return `Grant ${fence.grantRef} was requested at mode ${fence.requestedMode} and adopted at ${fence.adoptedMode}. An unadopted execution delegation stays in query/propose mode, and this page does not raise it.`;
    case "action-not-granted":
      return `Grant ${fence.grantRef} does not allow ${fence.step} in the last read.`;
    case "budget-exhausted":
      return `Grant ${fence.grantRef} used its command budget in the last read.`;
    case "target-closed":
      return `${fence.ref} is ${fence.state} in the last read.`;
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
        ? `Draft order recorded by the synthetic source${result.intent.receipt ? ` as ${result.intent.receipt.draftRef}` : ""}. It stages an order draft only: it is not a hold, not a booking, not a payment, and not a right. This is not a protocol receipt.`
        : `Cancel recorded by the synthetic source. Whether the command budget is restored is ${DELEGATION_UNDETERMINED}, and this page restores nothing. This is not a protocol receipt.`;
    case "REJECTED": {
      const action = returnActionLine(DELEGATION_RETURN_ACTIONS[result.intent.code as DelegationRejectCode] ?? "read-again");
      return `${word} rejected (${result.intent.code ?? "no code"}). ${result.intent.message ?? ""} The source applied nothing for this write. ${action}`.replace(/\s+/g, " ").trim();
    }
    case "UNKNOWN":
      return `${word} result unknown (${result.intent.code ?? "no code"}). It may or may not have been recorded. Writes under this grant are blocked, and a read does not resolve it.`;
    case "QUARANTINED":
      return `The result of the ${word.toLowerCase()} arrived after the session context changed. It was quarantined and applied nowhere. The write stays unknown.`;
    case "FENCED":
      return `${word} not sent. ${fenceLine(result.fence)}`;
    case "NOT_SENT":
      return `${word} not sent. ${result.detail}`;
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

const TURN_KIND_WORDS: Readonly<Record<DelegationTurn["kind"], string>> = {
  answer: "Answer",
  proposal: "Proposal",
  clarify: "Needs a choice",
  refused: "Refused",
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
      return { statusLine: "Reading the synthetic delegation source. Nothing is proposed or sent yet.", detailLine: "", actionLabel: null };
    case "unread":
      return {
        statusLine: "The session context changed, so there is no read in this context.",
        detailLine: "Read again to see the grants from this context. An earlier unknown write under a grant still blocks that grant.",
        actionLabel: "Read again",
      };
    case "ready":
      return { statusLine: "Delegation grants read.", detailLine: "", actionLabel: null };
    case "empty":
      return { statusLine: "No grant is listed for this principal in this read.", detailLine: "Nothing can be proposed or sent.", actionLabel: "Read again" };
    case "stale":
      return { statusLine: "Stale delegation read.", detailLine: detail ?? "", actionLabel: "Read again" };
    case "denied":
      return {
        statusLine: `The source refused this actor and principal${coded}. No grant, no listing, and no request is accepted.`,
        detailLine: detail ?? "",
        actionLabel: "Read again",
      };
    case "refused":
      return {
        statusLine: `The payload was refused${coded}. No row is shown.`,
        detailLine: detail ?? "",
        actionLabel: "Read again",
      };
    case "not-bound":
      return { statusLine: DELEGATION_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: "The pin tuple changed. Nothing was read and nothing was sent.",
        detailLine: detail ?? "",
        actionLabel: "Start a new synthetic session",
      };
    case "unavailable":
      return { statusLine: "The source did not answer. This is not an empty grant list.", detailLine: detail ?? "", actionLabel: "Read again" };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function modeLine(mode: DelegationMode, requested: DelegationMode, grantRef: string): string {
  if (mode === requested) {
    return `Requested and adopted at ${mode} mode. The source's own ceiling, copied.`;
  }
  return `Requested at ${requested} mode, adopted at ${mode}. Grant ${grantRef} stays in ${mode === "propose" ? "query/propose" : mode} mode: this page does not raise it.`;
}

/** What a question turn answers out of the last read. A query sends nothing. */
function answerLines(question: string, model: { grants: GrantModel[]; listings: ListingModel[]; drafts: DraftModel[] }, counters: string): string[] {
  switch (question) {
    case "grants":
      return model.grants.length === 0
        ? ["No grant is listed in the last read."]
        : model.grants.map((grant) => `${grant.grantRef}: ${grant.modeLine}`);
    case "board":
      return model.listings.length === 0
        ? ["No listing is listed in the last read."]
        : model.listings.map((listing) => `${listing.listingRef} under ${listing.eventRef}: ${listing.state}.`);
    case "drafts":
      return model.drafts.length === 0
        ? ["No staged or cancelled draft is listed in the last read."]
        : model.drafts.map((draft) => `${draft.draftRef} on ${draft.listingRef}: ${DRAFT_STATE_WORDS[draft.state]}.`);
    case "session":
      return [counters];
    default:
      return ["The last read answers no such question."];
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
      ? "The last read is current."
      : state.freshness === "STALE"
        ? "The last read is behind."
        : "There is no usable read.";

  const grants: GrantModel[] = projection.grants.map((grant) => ({
    grantRef: grant.grantRef,
    scopeLine: `Scope ${grant.scope} for principal ${grant.principalRef}. The source's own words, copied.`,
    targetLine: `Target family ${grant.targetEventRef}: only listings under this event are in scope.`,
    deadlineLine: `Deadline ${grant.notAfter}, the source's own instant text. The source decides whether it has passed; this page copies it.`,
    budgetLine: `Command budget ${grant.commandBudget}, used ${grant.commandsUsed}. A count of commands, not an amount. The source's own figures, never added or subtracted here.`,
    actionsLine: `Allowed actions: ${grant.allowedActions.join(", ") || "none"}. The source's own list.`,
    modeLine: modeLine(grant.adoptedMode, grant.requestedMode, grant.grantRef),
    versionLine: `Version ${grant.version}, as the source reports it. Copied, never raised here.`,
    stateLine: grant.state === "active" ? "Active in the last read." : `Revoked in the last read. A command under it is denied.`,
  }));

  const drafts: DraftModel[] = projection.drafts.map((draft) => ({
    draftRef: draft.draftRef,
    listingRef: draft.listingRef,
    state: draft.state,
    stateLine: `${DRAFT_STATE_WORDS[draft.state]}. A staged draft is not a hold, not a booking, not a payment, and not a right.`,
    grantLine: `Staged under grant ${draft.grantRef} at version ${draft.grantVersion}. Copied, never raised here.`,
    linkLine: draft.linked
      ? "Named by a confirmed command of this page."
      : "Observed only. It is not named by a confirmed command of this page, and this page does not claim it.",
  }));

  const listings: ListingModel[] = projection.listings.map((listing) => ({
    listingRef: listing.listingRef,
    eventRef: listing.eventRef,
    title: listing.title,
    tierLine: `Tier ${listing.tier}, an opaque label with no amount.`,
    state: listing.state,
    stateLine: listing.state === "open" ? "Open at the source." : "Closed at the source. A draft order on it is rejected.",
    drafts: drafts.filter((draft) => draft.listingRef === listing.listingRef),
  }));

  const proposals: ProposalModel[] = projection.proposals.map((proposal) => ({
    proposalRef: proposal.proposalRef,
    step: proposal.step,
    stepWord: STEP_WORDS[proposal.step],
    targetRef: proposal.targetRef,
    stateWord: proposal.state === "open" ? "Open" : proposal.state === "dismissed" ? "Dismissed" : "Consumed by an approval",
    detail: proposal.detail,
    approve:
      proposal.state === "open"
        ? control(controller.gateFor({ proposalRef: proposal.proposalRef, intentRef: GATE_PREVIEW }))
        : { enabled: false, reason: `Proposal ${proposal.proposalRef} is ${proposal.state}. Only an open proposal can be approved.` },
    dismiss:
      proposal.state === "open"
        ? { enabled: true, reason: null }
        : { enabled: false, reason: `Proposal ${proposal.proposalRef} is already ${proposal.state}.` },
  }));

  const countersLine = `Sent ${state.counters.sent}. Blocked before sending ${state.counters.fenced}. Not sent ${state.counters.notSent}. Reads dropped ${state.counters.droppedReads}. Requests refused ${state.counters.refusedRequests}.`;

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
    target: `${row.targetRef} under ${row.grantRef}`,
    code: row.code,
    returnAction: row.returnAction,
    returnLine: returnActionLine(row.returnAction),
    detail: row.detail,
  }));

  const lanes: LaneModel[] = [
    {
      lane: "query",
      label: "Query",
      count: turns.filter((turn) => turn.kind === "answer").length,
      line: `${turns.filter((turn) => turn.kind === "answer").length} questions answered out of the last read. A query sends nothing and changes nothing.`,
    },
    {
      lane: "proposal",
      label: "Proposal",
      count: proposals.filter((proposal) => proposal.stateWord === "Open").length,
      line: `${proposals.length} proposal${proposals.length === 1 ? "" : "s"} recorded, ${proposals.filter((proposal) => proposal.stateWord === "Open").length} open. A proposal is not an approval and sends nothing.`,
    },
    {
      lane: "approval",
      label: "Approval",
      count: state.intents.length,
      line: `${state.intents.length} approval${state.intents.length === 1 ? "" : "s"} pressed, each its own intent reference. An approval is the control's own press, not a sentence, and it is not a result.`,
    },
    {
      lane: "command",
      label: "Command",
      count: state.intents.filter((intent) => intent.outcome === "CONFIRMED").length,
      line: `${state.intents.filter((intent) => intent.outcome === "CONFIRMED").length} confirmed by the synthetic source, ${state.intents.filter((intent) => intent.outcome === "UNKNOWN" || intent.outcome === "IN_FLIGHT").length} with no known result. A confirmed command moves no funds and transfers no right.`,
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
    (item) => `Result ${item.arrived} for ${item.intentRef} was quarantined (${item.cause}). It changed nothing.`,
  );
  const unlinkedLines = projection.unlinkedIntents.map(
    (intent) =>
      `${STEP_WORDS[intent.step]} ${intent.intentRef} under ${intent.grantRef} is ${intent.outcome.toLowerCase().replace("_", " ")}. No draft is claimed for it, and a draft seen in a read is not claimed for it.`,
  );
  const session: SessionModel = {
    contextLine: `Actor ${state.context.actorRef}, principal ${state.context.principalRef}, session ${state.context.incarnation}, mode ${state.context.environment}.`,
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
      statusWord: row.status === "field-named" ? "Field named in the pin" : "Not-bound",
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
  const port = connectivityPort(delegationPortFor(environment, { scenario }), "delegated-assistant");
  return {
    port,
    controller: connectivityController(new DelegationAssistantController(port, { actorRef: DELEGATION_DESK_ACTOR, principalRef: DELEGATION_OWN_PRINCIPAL }), port),
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
        note(`The read ended as ${result.readState}${state.readCode ? ` (${state.readCode})` : ""}. No grant or listing is shown from it.`, true);
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
          setLast({ seq: actionSeq.current, kind: "note", text: `${turn.detail} Recorded as a proposal. Nothing is sent.`, attention: false });
          break;
        case "answer":
          setLast({ seq: actionSeq.current, kind: "note", text: turn.detail, attention: false });
          break;
        case "clarify":
          setLast({ seq: actionSeq.current, kind: "note", text: turn.detail, attention: true });
          break;
        case "refused":
          setLast({ seq: actionSeq.current, kind: "note", text: `Refused (${turn.code}). ${turn.detail}`, attention: true });
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
          ? `Proposal ${proposalRef} dismissed. It was never an approval and sends nothing.`
          : result.kind === "closed"
            ? `Proposal ${proposalRef} is already closed.`
            : `Proposal ${proposalRef} is not on this page.`,
      );
    },
    setScenario(next) {
      if (environment !== "stub") {
        note(DELEGATION_SCENARIO_OFF_NOTE);
        return;
      }
      startSession(next, `Started a new synthetic session with scenario ${next}. Earlier intents and proposals are gone, as after a reload.`);
    },
    deliverHeld() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const count = session.port.deliverHeld();
      note(count === 0 ? "No held response to deliver." : `Delivered ${count} held response${count === 1 ? "" : "s"}.`);
    },
    switchScope() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const current = session.controller.state().context.principalRef;
      const next = session.controller.switchContext({ principalRef: current === DELEGATION_OWN_PRINCIPAL ? DELEGATION_FOREIGN_PRINCIPAL : DELEGATION_OWN_PRINCIPAL });
      note(`Principal scope switched to ${next.principalRef}, session ${next.incarnation}. A write in flight is now unknown and its result will be quarantined.`);
      void read(session);
    },
    newSession() {
      startSession(scenario, "Started a new synthetic session. Earlier intents and proposals are gone, as after a reload. Nothing was resolved at a producer.");
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
          ? `${result.detail} This page has not read again, so it does not show this yet.`
          : `Nothing changed: ${result.reason}`,
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
    actions: connectedActions(actions, ['ask', 'approve', 'dismiss', 'setScenario', 'newSession', 'simulate'], sessionRef.current?.port),
  };
}
