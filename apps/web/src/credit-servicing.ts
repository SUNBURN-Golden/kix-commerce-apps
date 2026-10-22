import { connectivityPort, connectivityController, connectedActions } from "./connectivity/write-guard";
/**
 * The credit servicing desk on top of the adapter's synthetic servicing source.
 * Stub scope: the default port is the synthetic source. On integration-http the
 * same port is not-bound — no current producer tuple exists and the
 * contract-only catalogue has no credit command and no read command for a draw
 * instruction, a disbursement observation, a reservation, an exposure, a
 * repayment schedule, a payment allocation, a reversal, an adjustment, or a
 * servicing case — and this module does not invent one, send a second attempt,
 * or switch adapters.
 *
 * This module computes no amount, remainder, exposure, or schedule. It copies
 * what the controller and the last read hold: every figure is the source's own
 * text, or UNDETERMINED when the source sent none. Four servicing facts stay
 * four facts — the draw instruction, the disbursement observation, the
 * reservation, and the exposure. A partial repayment restores no commitment
 * limit, a reversal erases no history, a case closure extinguishes no debt, and
 * a payment observed after the case closed reopens nothing by itself. View,
 * proposal, and approval stay three separate capabilities.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SERVICING_ACTORS,
  SERVICING_ADJUSTMENT_KINDS,
  SERVICING_APPROVER_ACTOR,
  SERVICING_DESK_ACTOR,
  SERVICING_FOREIGN_REF,
  SERVICING_HOLD_NOT_BOUND,
  SERVICING_NOT_BOUND_REASON,
  SERVICING_NOT_COMPOSED,
  SERVICING_OWN_REF,
  SERVICING_UNDETERMINED,
  SERVICING_VIEWER_ACTOR,
  CreditServicingController,
  creditServicingPortFor,
  servicingCapabilities,
  type ServicingActResult,
  type ServicingActionKind,
  type ServicingAdjustmentKind,
  type ServicingAllocationState,
  type ServicingCaseStatus,
  type ServicingCaseTransition,
  type ServicingClosureKind,
  type ServicingEventKind,
  type ServicingExposureState,
  type ServicingFence,
  type ServicingInstallmentState,
  type ServicingInstructionState,
  type ServicingObservationState,
  type ServicingPaymentState,
  type ServicingPaymentTiming,
  type ServicingPort,
  type ServicingProposalKind,
  type ServicingProposalState,
  type ServicingReadState,
  type ServicingRemedy,
  type ServicingReservationState,
  type ServicingScenario,
  type ServicingSyntheticControl,
} from "@kix/protocol-adapter";
import { protocol } from "./connectivity/desk-protocol";

export const SERVICING_PAGE_TITLE = "Credit servicing (synthetic)";

export const SERVICING_SOURCE_LINE =
  "The draw, reservation, exposure, repayment schedule, payments, allocations, reversals, adjustments, case, and incident timeline come from a synthetic servicing source on this page load. They are not a producer read and not a catalogue receipt.";

export const SERVICING_BOUNDARY =
  "Four facts stay four facts. A recorded draw instruction is not a disbursement observation, an observation is not confirmed funds, a held reservation is not an exposure, and an open exposure is not proof anything was paid. Nothing here contacts, collects, pays, or disburses.";

export const SERVICING_PARTIAL_NOTE =
  "A partial repayment is shown with its own unallocated remainder, exactly as the source labels it. It never restores the commitment limit by itself: the limit line is the source's own state, and this page restores nothing.";

export const SERVICING_CLOSURE_NOTE =
  "A charge-off or a recovery-case closure is a bookkeeping state. It is never shown as the debt ending. A payment observed after the case closed stays a fact of its own and reopens nothing by itself.";

export const SERVICING_ACTOR_NOTE =
  "View, proposal, and approval are three separate capabilities. The desk actor proposes, the approver actor approves, the viewer actor reads, and an actor may not approve its own proposal. The actor string is a context label, not an authentication result.";

export const SERVICING_FIGURE_NOTE =
  "Every schedule, payment, allocation, and exposure figure is the source's own text, copied and never parsed, summed, scaled, or compared. A figure the source did not decide is shown as UNDETERMINED.";

export const SERVICING_REVERSAL_NOTE =
  "A reversal removes an allocation's effect and keeps both events on the incident timeline. It erases nothing.";

export const SERVICING_CLAIM_NOTE =
  "Every read and every receipt states instructionIsDisbursement, observationIsConfirmedFunds, partialRepaymentRestoresLimit, reversalErasesHistory, caseClosureIsDebtExtinguished, contactMade, collectionExecuted, and disbursed as false. A payload that says anything else, or stays silent, is refused before a row is shown.";

export const SERVICING_SCOPE_NOTE = `The desk actors hold a synthetic grant for ${SERVICING_OWN_REF} and none for ${SERVICING_FOREIGN_REF}. A scope the grant does not cover is refused and leaves no row on screen.`;

export const SERVICING_READ_NOTE =
  "A read is one request and a write is one request. Neither is sent again by this page. A read that arrives after the scope or the actor changed is dropped.";

export const SERVICING_FENCE_NOTE =
  "One request is in flight at a time. An answer that never arrived, or that arrived untrusted, leaves the outcome unknown — it may have applied — and every later request stays fenced. A read does not lift the fence.";

export const SERVICING_SESSION_NOTE =
  "Reads, receipts, and the fence live in this page load only. A reload or a new synthetic session clears them and resolves nothing at a producer.";

export const SERVICING_SYNTHETIC_CONTROL_NOTE =
  "Observe draw, receive payment, reverse allocation, mark overdue, advance schedule, and revoke grant are synthetic controls a real producer does not offer. They stand in for a source that moved on.";

export const SERVICING_HOLD_NOTE = `Holding a seat is not available here. ${SERVICING_HOLD_NOT_BOUND.reason}`;

export const SERVICING_NOT_COMPOSED_NOTE = `Catalogue actions recorded and never composed here: ${SERVICING_NOT_COMPOSED.map((entry) => entry.action).join(", ")}.`;

export const SERVICING_SCENARIO_NOTES: Readonly<Record<ServicingScenario, string>> = {
  clean: "Every read and request is answered. The obligation is in monitoring.",
  empty: "The source has no rows for this obligation.",
  stale: "The source serves a watermark older than the floor this page holds.",
  "draw-unknown": "The draw instruction is recorded; the disbursement observation is unknown and the exposure is undetermined.",
  "partial-repayment": "A payment is partly allocated; the unallocated remainder stays the source's own label, and the limit stays held.",
  unallocated: "A payment is fully unallocated. It applies itself to nothing.",
  reversal: "An allocation was reversed. Both events stay on the timeline.",
  delinquent: "A schedule row is overdue and the case is delinquent.",
  "charged-off": "The case is closed charged-off. The closure extinguishes no debt.",
  "post-charge-off-payment": "A payment arrived after the case closed charged-off. It stays a fact of its own.",
  "proposal-pending": "An allocation proposal waits for an approver. The proposer cannot approve it.",
  "stale-schedule": "The schedule rows were built under an older schedule revision. They are flagged, never shown as current.",
  "adjustment-applied": "A schedule correction was applied after approval. The earlier rows stay on the timeline.",
  "mixed-cut": "A payment row sits on the obligation ledger's cut. The ledgers are not merged.",
  "dangling-link": "One allocation names a payment the read does not list.",
  "claims-restored": "The payload claims a partial repayment restored the limit. It is refused before a row is shown.",
  "claims-extinguished": "The payload claims a case closure extinguished the debt. It is refused before a row is shown.",
  "claims-contact": "The payload claims a real contact was made. It is refused before a row is shown.",
  "scope-leak": "The source sends a row that belongs to another obligation. The payload is refused.",
  denied: "The grant for this actor is withdrawn at the source.",
  "read-lost": "The answer to a read never arrives.",
  "act-lost": "A request reaches the source and takes effect. Its answer never arrives.",
  "approve-claims-closure": "The source applies an approval, then answers that the debt is extinguished. The answer is not trusted.",
  "self-approval": "A proposal was recorded by the approver actor. Its own approval is refused.",
};

export type ServicingScreenState =
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

export interface ServicingDrawModel {
  drawRef: string;
  instruction: ServicingInstructionState;
  instructionWord: string;
  observation: ServicingObservationState;
  observationWord: string;
  amountLine: string;
}

export interface ServicingReservationModel {
  reservationRef: string;
  state: ServicingReservationState;
  stateWord: string;
}

export interface ServicingExposureModel {
  exposureRef: string;
  state: ServicingExposureState;
  stateWord: string;
  amountLine: string;
  withheld: boolean;
}

export interface ServicingLimitModel {
  limitRef: string;
  amountLine: string;
  state: string;
  stateWord: string;
}

export interface ServicingInstallmentModel {
  installmentRef: string;
  ordinal: number;
  dueLabel: string;
  amountLine: string;
  state: ServicingInstallmentState;
  stateWord: string;
  planLine: string;
  staleLine: string | null;
}

export interface ServicingPaymentModel {
  paymentRef: string;
  amountLine: string;
  state: ServicingPaymentState;
  stateWord: string;
  timing: ServicingPaymentTiming;
  timingWord: string;
  unallocatedLine: string;
  propose: ControlModel;
}

export interface ServicingAllocationModel {
  allocationRef: string;
  paymentRef: string;
  installmentRef: string;
  amountLine: string;
  state: ServicingAllocationState;
  stateWord: string;
}

export interface ServicingReversalModel {
  reversalRef: string;
  allocationRef: string;
  label: string;
}

export interface ServicingAdjustmentModel {
  adjustmentRef: string;
  installmentRef: string;
  kind: ServicingAdjustmentKind;
  kindWord: string;
  state: string;
  stateWord: string;
  text: string;
}

export interface ServicingProposalModel {
  proposalRef: string;
  kind: ServicingProposalKind;
  kindWord: string;
  actorRef: string;
  state: ServicingProposalState;
  stateWord: string;
  text: string;
  approve: ControlModel;
}

export interface ServicingCaseModel {
  caseRef: string;
  status: ServicingCaseStatus;
  statusWord: string;
  closureWord: string;
  debtLine: string;
  history: { label: string; statusWord: string; closureWord: string; note: string }[];
}

export interface ServicingEventModel {
  eventRef: string;
  seq: number;
  kind: ServicingEventKind;
  kindWord: string;
  label: string;
  targetRef: string | null;
}

export interface ServicingReasonModel {
  reasonRef: string;
  lane: string;
  code: string;
  text: string;
  remedy: ServicingRemedy;
  remedyWord: string;
}

export interface ServicingCutModel {
  cutRef: string;
  source: string;
  generation: number;
  watermark: string;
  usedBy: string;
}

export interface ServicingLastModel {
  seq: number;
  kindWord: string;
  phaseWord: string;
  phase: string;
  code: string | null;
  detail: string | null;
  receiptLines: string[];
}

export interface ServicingSessionModel {
  contextLine: string;
  capabilityLine: string;
  countersLine: string;
  earlierUnknownLine: string;
  notComposedLine: string;
  holdLine: string;
}

export type ServicingLastAction = { seq: number; text: string; attention: boolean };

export interface ServicingModel {
  state: ServicingScreenState;
  statusLine: string;
  detailLine: string;
  actionLabel: string | null;
  freshnessWord: string;
  scopeLine: string;
  actorLine: string;
  watermarkLine: string;
  behindLine: string | null;
  fenceLine: string | null;
  nonClaimsLine: string;
  cutState: "none" | "clean" | "mixed";
  cutLine: string;
  cuts: ServicingCutModel[];
  draw: ServicingDrawModel | null;
  reservation: ServicingReservationModel | null;
  exposure: ServicingExposureModel | null;
  limit: ServicingLimitModel | null;
  scheduleLine: string;
  staleInstallmentLines: string[];
  installments: ServicingInstallmentModel[];
  payments: ServicingPaymentModel[];
  allocations: ServicingAllocationModel[];
  reversals: ServicingReversalModel[];
  adjustments: ServicingAdjustmentModel[];
  proposals: ServicingProposalModel[];
  servicingCase: ServicingCaseModel | null;
  transitionOptions: { transition: ServicingCaseTransition; word: string; control: ControlModel }[];
  events: ServicingEventModel[];
  reasons: ServicingReasonModel[];
  contradictionLines: string[];
  unlinkedLines: string[];
  proposeAllocationControl: ControlModel;
  proposeAdjustmentControl: ControlModel;
  proposeCaseControl: ControlModel;
  approveControl: ControlModel;
  session: ServicingSessionModel;
  last: ServicingLastModel | null;
  lastLine: string | null;
  lastNeedsFocus: boolean;
  lastSeq: number | null;
}

const INSTRUCTION_WORDS: Readonly<Record<ServicingInstructionState, string>> = {
  none: "No instruction",
  recorded: "Recorded",
};

const OBSERVATION_WORDS: Readonly<Record<ServicingObservationState, string>> = {
  "not-observed": "Not observed",
  observed: "Observed",
  unknown: "Unknown",
  disputed: "Disputed",
};

const RESERVATION_WORDS: Readonly<Record<ServicingReservationState, string>> = {
  held: "Held",
  released: "Released",
  unknown: "Unknown",
};

const EXPOSURE_WORDS: Readonly<Record<ServicingExposureState, string>> = {
  open: "Open",
  closed: "Closed",
  unknown: "Unknown",
};

const INSTALLMENT_WORDS: Readonly<Record<ServicingInstallmentState, string>> = {
  scheduled: "Scheduled",
  due: "Due",
  overdue: "Overdue",
  satisfied: "Satisfied",
  adjusted: "Adjusted",
  "charged-off": "Charged off",
};

const PAYMENT_WORDS: Readonly<Record<ServicingPaymentState, string>> = {
  unallocated: "Unallocated",
  partial: "Partially allocated",
  allocated: "Allocated",
  "late-unallocated": "Late and unallocated",
  reversed: "Reversed",
};

const TIMING_WORDS: Readonly<Record<ServicingPaymentTiming, string>> = {
  "scheduled-window": "In the scheduled window",
  late: "Late",
  "post-charge-off": "After charge-off",
};

const ALLOCATION_WORDS: Readonly<Record<ServicingAllocationState, string>> = {
  applied: "Applied",
  reversed: "Reversed",
};

const CASE_WORDS: Readonly<Record<ServicingCaseStatus, string>> = {
  monitoring: "Monitoring",
  delinquent: "Delinquent",
  recovery: "Recovery",
  closed: "Closed",
};

const CLOSURE_WORDS: Readonly<Record<ServicingClosureKind, string>> = {
  "charged-off": "Charged off",
  recovered: "Recovered",
};

const PROPOSAL_KIND_WORDS: Readonly<Record<ServicingProposalKind, string>> = {
  allocation: "Allocation",
  adjustment: "Adjustment",
  "case-transition": "Case transition",
};

const PROPOSAL_STATE_WORDS: Readonly<Record<ServicingProposalState, string>> = {
  pending: "Pending",
  applied: "Applied",
  rejected: "Rejected",
};

const EVENT_WORDS: Readonly<Record<ServicingEventKind, string>> = {
  instruction: "Instruction",
  observation: "Observation",
  reservation: "Reservation",
  payment: "Payment",
  allocation: "Allocation",
  reversal: "Reversal",
  adjustment: "Adjustment",
  proposal: "Proposal",
  approval: "Approval",
  case: "Case",
};

const REMEDY_WORDS: Readonly<Record<ServicingRemedy, string>> = {
  "propose-allocation": "Propose an allocation",
  "propose-adjustment": "Propose a schedule correction",
  "propose-case-transition": "Propose a case transition",
  none: "No correction path",
};

const ACTION_WORDS: Readonly<Record<ServicingActionKind, string>> = {
  "propose-allocation": "Allocation proposal",
  "propose-adjustment": "Adjustment proposal",
  "propose-case-transition": "Case transition proposal",
  "approve-proposal": "Proposal approval",
};

export const SERVICING_TRANSITION_WORDS: Readonly<Record<ServicingCaseTransition, string>> = {
  "to-recovery": "Move to recovery",
  "to-charge-off": "Charge off",
  "to-closed": "Close as recovered",
};

const ADJUSTMENT_KIND_WORDS: Readonly<Record<ServicingAdjustmentKind, string>> = {
  "due-label": "Due label",
  note: "Note",
  "amount-label": "Amount label",
};

function readStateToScreen(readState: ServicingReadState): ServicingScreenState {
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
  state: ServicingScreenState,
  code: string | null,
  detail: string | null,
): { statusLine: string; detailLine: string; actionLabel: string | null } {
  const suffix = code ? ` (${code})` : "";
  switch (state) {
    case "loading":
      return { statusLine: "Reading the synthetic servicing source. Nothing is shown yet.", detailLine: "", actionLabel: null };
    case "ready":
      return { statusLine: "Servicing read.", detailLine: "", actionLabel: null };
    case "empty":
      return {
        statusLine: "No rows for this obligation in this read.",
        detailLine: detail ?? "An empty read is not a settled servicing record.",
        actionLabel: "Read again",
      };
    case "stale":
      return { statusLine: "Stale servicing read.", detailLine: detail ?? "", actionLabel: "Read again" };
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
      return { statusLine: SERVICING_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: "The pin tuple changed. Nothing was read and nothing was applied.",
        detailLine: detail ?? "",
        actionLabel: "Start a new synthetic session",
      };
    case "unavailable":
      return {
        statusLine: "The source did not answer. This is not a settled servicing record.",
        detailLine: detail ?? "",
        actionLabel: "Read again",
      };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

/** Why a request is fenced. Each fence maps to one sentence. */
export function servicingFenceText(fence: ServicingFence): string {
  switch (fence.reason) {
    case "in-flight":
      return `A ${fence.action} request is in flight. One request goes at a time.`;
    case "unknown-outcome":
      return `Request ${fence.seq} (${fence.action}) has an unknown outcome and may have applied. Nothing is sent again from here. Start a new synthetic session to clear it.`;
    default: {
      const exhaustive: never = fence;
      return exhaustive;
    }
  }
}

export function buildServicingModel(input: { controller: CreditServicingController; last: ServicingLastAction | null }): ServicingModel {
  const { controller } = input;
  const state = controller.state();
  const screen = readStateToScreen(state.readState);
  const status = statusFor(screen, state.readCode, state.readDetail);
  const snapshot = state.snapshot;
  const assessment = state.assessment;
  const notBound = state.context.environment === "integration-http";

  const freshnessWord =
    state.freshness === "CURRENT"
      ? "The last read is current."
      : state.freshness === "STALE"
        ? "The last read is behind."
        : "There is no usable read.";

  const behindLine = state.behind ? "A request reached the source after the last read. Read again before the next request." : null;
  const fenceLine = state.fence === null ? null : servicingFenceText(state.fence);

  const toControl = (eligibility: { allowed: boolean; reason: string | null }): ControlModel => ({
    enabled: eligibility.allowed,
    reason: eligibility.reason,
  });
  const guard = (kind: ServicingActionKind): ControlModel =>
    notBound ? { enabled: false, reason: SERVICING_NOT_BOUND_REASON } : toControl(controller.canSend(kind));

  const usedBy = new Map<string, number>();
  if (snapshot) {
    const allRefs = [
      ...(snapshot.draw === null ? [] : [snapshot.draw.cutRef]),
      ...(snapshot.reservation === null ? [] : [snapshot.reservation.cutRef]),
      ...(snapshot.exposure === null ? [] : [snapshot.exposure.cutRef]),
      ...snapshot.installments.map((row) => row.cutRef),
      ...snapshot.payments.map((row) => row.cutRef),
      ...snapshot.allocations.map((row) => row.cutRef),
      ...snapshot.reversals.map((row) => row.cutRef),
      ...snapshot.adjustments.map((row) => row.cutRef),
      ...snapshot.proposals.map((row) => row.cutRef),
      ...(snapshot.servicingCase === null ? [] : [snapshot.servicingCase.cutRef]),
      ...snapshot.events.map((row) => row.cutRef),
    ];
    for (const cutRef of allRefs) {
      usedBy.set(cutRef, (usedBy.get(cutRef) ?? 0) + 1);
    }
  }
  const cuts: ServicingCutModel[] = (assessment?.usedCuts ?? []).map((cut) => ({
    cutRef: cut.cutRef,
    source: cut.source,
    generation: cut.generation,
    watermark: cut.watermark,
    usedBy: `${usedBy.get(cut.cutRef) ?? 0} rows`,
  }));
  const cutState = assessment?.cutState ?? "none";
  const cutLine =
    cutState === "clean"
      ? "Every row sits on its own ledger's cut. Obligation rows and payment rows stay apart."
      : cutState === "mixed"
        ? "A row sits on the wrong ledger's cut. The ledgers are not merged, and the row is flagged."
        : "No row carries a source cut in this read.";

  const draw: ServicingDrawModel | null = snapshot?.draw
    ? {
        drawRef: snapshot.draw.drawRef,
        instruction: snapshot.draw.instruction,
        instructionWord: INSTRUCTION_WORDS[snapshot.draw.instruction],
        observation: snapshot.draw.observation,
        observationWord: OBSERVATION_WORDS[snapshot.draw.observation],
        amountLine:
          snapshot.draw.amountLabel === null
            ? `Instructed amount ${SERVICING_UNDETERMINED}.`
            : `Instructed ${snapshot.draw.amountLabel} ${snapshot.draw.unit}. The instructed amount, not an observed one.`,
      }
    : null;

  const reservation: ServicingReservationModel | null = snapshot?.reservation
    ? {
        reservationRef: snapshot.reservation.reservationRef,
        state: snapshot.reservation.state,
        stateWord: RESERVATION_WORDS[snapshot.reservation.state],
      }
    : null;

  const exposureWithheld = (assessment?.contradictions ?? []).some((item) => item.code === "EXPOSURE_WITHOUT_OBSERVATION");
  const exposure: ServicingExposureModel | null = snapshot?.exposure
    ? {
        exposureRef: snapshot.exposure.exposureRef,
        state: snapshot.exposure.state,
        stateWord: EXPOSURE_WORDS[snapshot.exposure.state],
        amountLine:
          snapshot.exposure.amountLabel === null
            ? `Exposure ${SERVICING_UNDETERMINED}.`
            : `Exposure ${snapshot.exposure.amountLabel} ${snapshot.exposure.unit} as the source labels it.`,
        withheld: exposureWithheld,
      }
    : null;

  const LIMIT_WORDS: Readonly<Record<string, string>> = { held: "Held", released: "Released", unknown: "Unknown" };
  const limit: ServicingLimitModel | null = snapshot?.limit
    ? {
        limitRef: snapshot.limit.limitRef,
        amountLine:
          snapshot.limit.amount === null
            ? `Commitment limit ${SERVICING_UNDETERMINED}.`
            : `Commitment limit ${snapshot.limit.amount} ${snapshot.limit.unit}, ${snapshot.limit.state}.`,
        state: snapshot.limit.state,
        stateWord: LIMIT_WORDS[snapshot.limit.state] ?? snapshot.limit.state,
      }
    : null;

  const staleLine = (installmentRef: string): string | null => {
    const hit = assessment?.staleInstallments.find((item) => item.installmentRef === installmentRef);
    return hit === undefined
      ? null
      : `Built under schedule revision ${hit.planRevision}; the source holds ${hit.currentRevision} as current. Flagged, never shown as current.`;
  };

  const installments: ServicingInstallmentModel[] = (snapshot?.installments ?? []).map((row) => ({
    installmentRef: row.installmentRef,
    ordinal: row.ordinal,
    dueLabel: row.dueLabel,
    amountLine: `${row.amount} ${row.unit}`,
    state: row.state,
    stateWord: INSTALLMENT_WORDS[row.state],
    planLine: `Plan revision ${row.planRevision}.`,
    staleLine: staleLine(row.installmentRef),
  }));

  const allocatable = new Set(
    (snapshot?.payments ?? [])
      .filter((row) => row.state === "unallocated" || row.state === "late-unallocated" || row.state === "partial")
      .map((row) => row.paymentRef),
  );
  const allocationGuard = guard("propose-allocation");
  const payments: ServicingPaymentModel[] = (snapshot?.payments ?? []).map((row) => ({
    paymentRef: row.paymentRef,
    amountLine: `${row.amount} ${row.unit}`,
    state: row.state,
    stateWord: PAYMENT_WORDS[row.state],
    timing: row.timing,
    timingWord: TIMING_WORDS[row.timing],
    unallocatedLine:
      row.unallocatedLabel === null
        ? "The source gave no unallocated remainder."
        : `Unallocated ${row.unallocatedLabel} ${row.unit} as the source labels it. It applies itself to nothing.`,
    propose: allocatable.has(row.paymentRef)
      ? allocationGuard
      : { enabled: false, reason: `Payment ${row.paymentRef} is ${row.state}. Only an unallocated, late, or partially allocated payment takes an allocation proposal.` },
  }));

  const allocations: ServicingAllocationModel[] = (snapshot?.allocations ?? []).map((row) => ({
    allocationRef: row.allocationRef,
    paymentRef: row.paymentRef,
    installmentRef: row.installmentRef,
    amountLine: `${row.amount} ${row.unit}`,
    state: row.state,
    stateWord: ALLOCATION_WORDS[row.state],
  }));

  const reversals: ServicingReversalModel[] = (snapshot?.reversals ?? []).map((row) => ({
    reversalRef: row.reversalRef,
    allocationRef: row.allocationRef,
    label: row.label,
  }));

  const adjustments: ServicingAdjustmentModel[] = (snapshot?.adjustments ?? []).map((row) => ({
    adjustmentRef: row.adjustmentRef,
    installmentRef: row.installmentRef,
    kind: row.kind,
    kindWord: ADJUSTMENT_KIND_WORDS[row.kind],
    state: row.state,
    stateWord: row.state === "applied" ? "Applied" : row.state === "proposed" ? "Proposed" : "Rejected",
    text: row.text,
  }));

  const approveGuard = guard("approve-proposal");
  const proposals: ServicingProposalModel[] = (snapshot?.proposals ?? []).map((row) => ({
    proposalRef: row.proposalRef,
    kind: row.kind,
    kindWord: PROPOSAL_KIND_WORDS[row.kind],
    actorRef: row.actorRef,
    state: row.state,
    stateWord: PROPOSAL_STATE_WORDS[row.state],
    text: row.text,
    approve:
      row.state === "pending"
        ? approveGuard
        : { enabled: false, reason: `Proposal ${row.proposalRef} is ${row.state}. A proposal is approved only while it is pending.` },
  }));

  const caseRow = snapshot?.servicingCase ?? null;
  const servicingCase: ServicingCaseModel | null = caseRow
    ? {
        caseRef: caseRow.caseRef,
        status: caseRow.status,
        statusWord: CASE_WORDS[caseRow.status],
        closureWord: caseRow.closureKind === null ? "Not closed" : `Closed ${CLOSURE_WORDS[caseRow.closureKind]}`,
        debtLine: `Debt ${caseRow.debtLabel} as the source labels it. A case closure is a bookkeeping state, not the debt ending.`,
        history: caseRow.history.map((entry) => ({
          label: entry.label,
          statusWord: CASE_WORDS[entry.status],
          closureWord: entry.closureKind === null ? "open" : CLOSURE_WORDS[entry.closureKind],
          note: entry.note,
        })),
      }
    : null;

  const events: ServicingEventModel[] = (snapshot?.events ?? []).map((row) => ({
    eventRef: row.eventRef,
    seq: row.seq,
    kind: row.kind,
    kindWord: EVENT_WORDS[row.kind],
    label: row.label,
    targetRef: row.targetRef,
  }));

  const reasons: ServicingReasonModel[] = (snapshot?.reasons ?? []).map((row) => ({
    reasonRef: row.reasonRef,
    lane: row.lane,
    code: row.code,
    text: row.text,
    remedy: row.remedy,
    remedyWord: REMEDY_WORDS[row.remedy],
  }));

  const staleInstallmentLines = (assessment?.staleInstallments ?? []).map(
    (item) => `${item.installmentRef}: built under schedule revision ${item.planRevision}; the source holds ${item.currentRevision} as current.`,
  );
  const contradictionLines = (assessment?.contradictions ?? []).map((item) => `${item.code} on the ${item.lane} lane. ${item.detail}`);
  const unlinkedLines = (assessment?.unlinked ?? []).map(
    (item) => `${item.lens} row ${item.ref} names ${item.missingRef}, which the read does not list. It is not attached elsewhere.`,
  );

  const scheduleLine = snapshot ? `Repayment schedule revision ${snapshot.schedule.revision}.` : "No schedule in this read.";

  const transitionControl = guard("propose-case-transition");
  const transitionOptions = (assessment?.offeredTransitions ?? []).map((transition) => ({
    transition,
    word: SERVICING_TRANSITION_WORDS[transition],
    control: transitionControl,
  }));

  const nonClaimsLine =
    "instructionIsDisbursement false · observationIsConfirmedFunds false · partialRepaymentRestoresLimit false · reversalErasesHistory false · caseClosureIsDebtExtinguished false · contactMade false · collectionExecuted false · disbursed false";

  const last: ServicingLastModel | null =
    state.last === null
      ? null
      : {
          seq: state.last.seq,
          kindWord: ACTION_WORDS[state.last.action.kind],
          phase: state.last.phase,
          phaseWord:
            state.last.phase === "applied"
              ? "Applied at the synthetic source"
              : state.last.phase === "rejected"
                ? "Rejected by the source"
                : state.last.phase === "unknown"
                  ? "Unknown outcome"
                  : state.last.phase === "refused"
                    ? "Answer refused; treated as unknown"
                    : state.last.phase === "not-bound"
                      ? "Not bound"
                      : state.last.phase,
          code: state.last.code,
          detail: state.last.detail,
          receiptLines:
            state.last.receipt === null
              ? []
              : [
                  `Proposal ${state.last.receipt.proposalRef}.`,
                  `After: ${state.last.receipt.stateAfter}. A recorded proposal applies nothing; only an approval applies.`,
                ],
        };

  const capabilities = servicingCapabilities(state.context.actorRef);
  const counters = state.counters;
  const session: ServicingSessionModel = {
    contextLine: `Actor ${state.context.actorRef}, obligation scope ${state.context.scope.obligationRef}, session ${state.context.incarnation}, mode ${state.context.environment}.`,
    capabilityLine:
      capabilities.length === 0
        ? `Actor ${state.context.actorRef} holds no capability at the source.`
        : `Actor ${state.context.actorRef} holds ${capabilities.join(", ")}. View, proposal, and approval stay separate.`,
    countersLine: `Reads ${counters.reads}. Requests ${counters.acts}. Not sent ${counters.notSent}. Reads dropped ${counters.droppedReads}.`,
    earlierUnknownLine:
      state.earlierUnknown === 0
        ? "No unknown outcome left in an earlier scope or actor."
        : `${state.earlierUnknown} unknown outcome(s) left behind in earlier scopes or actors. They are not forgotten and not resolved here.`,
    notComposedLine: SERVICING_NOT_COMPOSED_NOTE,
    holdLine: SERVICING_HOLD_NOTE,
  };

  return {
    state: screen,
    statusLine: status.statusLine,
    detailLine: status.detailLine,
    actionLabel: status.actionLabel,
    freshnessWord,
    scopeLine: `Tenant ${state.context.scope.tenantId}. Obligation ${state.context.scope.obligationRef}.`,
    actorLine: `Actor ${state.context.actorRef}. ${capabilities.length === 0 ? "No capability." : `Capabilities ${capabilities.join(", ")}.`}`,
    watermarkLine: snapshot ? `Watermark ${snapshot.watermark}. Read ${snapshot.snapshotId} on this port.` : "No watermark without a ready read.",
    behindLine,
    fenceLine,
    nonClaimsLine,
    cutState,
    cutLine,
    cuts,
    draw,
    reservation,
    exposure,
    limit,
    scheduleLine,
    staleInstallmentLines,
    installments,
    payments,
    allocations,
    reversals,
    adjustments,
    proposals,
    servicingCase,
    transitionOptions,
    events,
    reasons,
    contradictionLines,
    unlinkedLines,
    proposeAllocationControl: allocationGuard,
    proposeAdjustmentControl: guard("propose-adjustment"),
    proposeCaseControl: transitionControl,
    approveControl: approveGuard,
    session,
    last,
    lastLine: input.last === null ? null : input.last.text,
    lastNeedsFocus: input.last?.attention ?? false,
    lastSeq: input.last === null ? null : input.last.seq,
  };
}

function actResultLine(kind: ServicingActionKind, result: ServicingActResult): { text: string; attention: boolean } {
  const word = ACTION_WORDS[kind];
  switch (result.kind) {
    case "APPLIED":
      return {
        text: `${word} applied at the synthetic source. This is not a decision and not a protocol receipt. Read again to see the lanes.`,
        attention: false,
      };
    case "REJECTED":
      return {
        text: `${word} rejected (${result.record.code ?? "no code"}). ${result.record.detail ?? ""} The source applied nothing for this request.`.trim(),
        attention: true,
      };
    case "UNKNOWN":
      return {
        text: `${word} outcome unknown (${result.record.code ?? "no code"}). It may have applied. Every later request is fenced, and a read does not resolve it.`,
        attention: true,
      };
    case "FENCED":
      return { text: `${word} not sent. ${servicingFenceText(result.fence)}`, attention: true };
    case "NOT_SENT":
      return { text: `${word} not sent. ${result.detail}`, attention: true };
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

export interface ServicingActions {
  refresh(): void;
  proposeAllocation(paymentRef: string, installmentRef: string): void;
  proposeAdjustment(installmentRef: string, adjustmentKind: ServicingAdjustmentKind, text: string): void;
  proposeCaseTransition(transition: ServicingCaseTransition): void;
  approveProposal(proposalRef: string): void;
  switchScope(): void;
  switchActor(): void;
  observeDraw(): void;
  receivePayment(): void;
  reverseAllocation(): void;
  markOverdue(): void;
  advanceSchedule(): void;
  revokeGrant(): void;
  setScenario(next: ServicingScenario): void;
  newSession(): void;
}

interface Session {
  port: ServicingPort;
  controller: CreditServicingController;
}

function createSession(environment: "stub" | "integration-http", scenario: ServicingScenario, obligationRef: string, actorRef: string): Session {
  const port = connectivityPort(creditServicingPortFor(environment, { scenario }), "credit-servicing");
  return { port, controller: connectivityController(new CreditServicingController(port, { actorRef, obligationRef }), port) };
}

function nextActor(actorRef: string): string {
  const index = SERVICING_ACTORS.indexOf(actorRef as (typeof SERVICING_ACTORS)[number]);
  const list = [...SERVICING_ACTORS];
  return list[(index + 1) % list.length] ?? SERVICING_DESK_ACTOR;
}

export function useCreditServicing(): {
  environment: "stub" | "integration-http";
  scenario: ServicingScenario;
  obligationRef: string;
  actorRef: string;
  model: ServicingModel;
  actions: ServicingActions;
} {
  const environment = protocol.describe().environment;
  const sessionRef = useRef<Session | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createSession(environment, "clean", SERVICING_OWN_REF, SERVICING_DESK_ACTOR);
  }
  const [scenario, setScenarioState] = useState<ServicingScenario>("clean");
  const [obligationRef, setObligationRef] = useState<string>(SERVICING_OWN_REF);
  const [actorRef, setActorRef] = useState<string>(SERVICING_DESK_ACTOR);
  const [epoch, setEpoch] = useState(0);
  const [, setTick] = useState(0);
  const [last, setLast] = useState<ServicingLastAction | null>(null);
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
    (next: ServicingScenario, scope: string, actor: string, text: string) => {
      sessionRef.current = createSession(environment, next, scope, actor);
      setScenarioState(next);
      setEpoch((value) => value + 1);
      note(text);
    },
    [environment, note],
  );

  const run = useCallback(
    (kind: ServicingActionKind, send: () => Promise<ServicingActResult>) => {
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
    (control: ServicingSyntheticControl, moved: string) => {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const done = session.port.synthetic(control);
      note(done ? `${moved} A real producer offers no such control. Read again.` : "There is nothing at the synthetic source to move.", done);
    },
    [note],
  );

  const actions: ServicingActions = {
    refresh() {
      void sessionRef.current?.controller.read();
    },
    proposeAllocation(paymentRef, installmentRef) {
      const session = sessionRef.current;
      if (session !== null) {
        run("propose-allocation", () => session.controller.proposeAllocation(paymentRef, installmentRef));
      }
    },
    proposeAdjustment(installmentRef, adjustmentKind, text) {
      const session = sessionRef.current;
      if (session !== null) {
        run("propose-adjustment", () => session.controller.proposeAdjustment(installmentRef, adjustmentKind, text));
      }
    },
    proposeCaseTransition(transition) {
      const session = sessionRef.current;
      if (session !== null) {
        run("propose-case-transition", () => session.controller.proposeCaseTransition(transition));
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
      const next =
        session.controller.state().context.scope.obligationRef === SERVICING_OWN_REF ? SERVICING_FOREIGN_REF : SERVICING_OWN_REF;
      const context = session.controller.switchScope(next);
      if (context === null) {
        note("A request is in flight. The scope cannot change under it.", true);
        return;
      }
      setObligationRef(next);
      note(
        `Switched the obligation scope to ${context.scope.obligationRef}, session ${context.incarnation}. Rows of the earlier scope are cleared, and a read in flight for it is dropped. Read again.`,
      );
    },
    switchActor() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const next = nextActor(session.controller.state().context.actorRef);
      const context = session.controller.switchActor(next);
      if (context === null) {
        note("A request is in flight. The actor cannot change under it.", true);
        return;
      }
      setActorRef(next);
      note(
        `Switched the desk actor to ${context.actorRef}, session ${context.incarnation}. Its capabilities are ${servicingCapabilities(context.actorRef).join(", ")}. Rows are cleared, and a read in flight is dropped. Read again.`,
      );
    },
    observeDraw() {
      synthetic("observe-draw", "The synthetic source recorded a disbursement observation for the draw.");
    },
    receivePayment() {
      synthetic("receive-payment", "The synthetic source observed a new payment.");
    },
    reverseAllocation() {
      synthetic("reverse-allocation", "The synthetic source reversed an applied allocation.");
    },
    markOverdue() {
      synthetic("mark-overdue", "The synthetic source marked a schedule row overdue.");
    },
    advanceSchedule() {
      synthetic("advance-schedule", "The synthetic source moved the schedule to a newer revision. Rows built under an older one stay flagged.");
    },
    revokeGrant() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const done = session.port.synthetic("revoke-grant");
      note(
        done
          ? "The synthetic grant is withdrawn at the source. The next read is refused. A real producer offers no such control."
          : "There is no synthetic source to withdraw a grant from.",
        done,
      );
    },
    setScenario(next) {
      startSession(
        next,
        obligationRef,
        actorRef,
        `Started a new synthetic session with scenario ${next}. Earlier reads and requests are gone, as after a reload.`,
      );
    },
    newSession() {
      startSession(
        scenario,
        obligationRef,
        actorRef,
        "Started a new synthetic session. Earlier reads and requests are gone, as after a reload. Nothing was resolved at a producer.",
      );
    },
  };

  const session = sessionRef.current;
  return {
    environment,
    scenario,
    obligationRef,
    actorRef,
    model: buildServicingModel({ controller: session.controller, last }),
    actions: connectedActions(actions, ['proposeAllocation', 'proposeAdjustment', 'proposeCaseTransition', 'approveProposal', 'observeDraw', 'receivePayment', 'reverseAllocation', 'markOverdue', 'advanceSchedule', 'revokeGrant', 'setScenario', 'newSession'], sessionRef.current?.port),
  };
}

export { SERVICING_ACTORS, SERVICING_ADJUSTMENT_KINDS, SERVICING_APPROVER_ACTOR, SERVICING_DESK_ACTOR, SERVICING_VIEWER_ACTOR };
