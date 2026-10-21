import { messages as sourceCopy } from "./i18n/messages/credit-servicing";
import { sourceMessage } from "./i18n/source-message";
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
import { protocol } from "./protocol";

export const SERVICING_PAGE_TITLE = sourceCopy.en["sf0"];

export const SERVICING_SOURCE_LINE =
  sourceCopy.en["s1s0"];

export const SERVICING_BOUNDARY =
  sourceCopy.en["slt"];

export const SERVICING_PARTIAL_NOTE =
  sourceCopy.en["s4t"];

export const SERVICING_CLOSURE_NOTE =
  sourceCopy.en["sp"];

export const SERVICING_ACTOR_NOTE =
  sourceCopy.en["s25z"];

export const SERVICING_FIGURE_NOTE =
  sourceCopy.en["sjn"];

export const SERVICING_REVERSAL_NOTE =
  sourceCopy.en["s7e"];

export const SERVICING_CLAIM_NOTE =
  sourceCopy.en["sja"];

export const SERVICING_SCOPE_NOTE = sourceMessage(sourceCopy.en["p.t49"], { v1: SERVICING_OWN_REF, v2: SERVICING_FOREIGN_REF });

export const SERVICING_READ_NOTE =
  sourceCopy.en["s6e"];

export const SERVICING_FENCE_NOTE =
  "One request is in flight at a time. An answer that never arrived, or that arrived untrusted, leaves the outcome unknown — it may have applied — and every later request stays fenced. A read does not lift the fence.";

export const SERVICING_SESSION_NOTE =
  sourceCopy.en["s1c9"];

export const SERVICING_SYNTHETIC_CONTROL_NOTE =
  sourceCopy.en["s13s"];

export const SERVICING_HOLD_NOTE = sourceMessage(sourceCopy.en["p.t8"], { v1: SERVICING_HOLD_NOT_BOUND.reason });

export const SERVICING_NOT_COMPOSED_NOTE = sourceMessage(sourceCopy.en["p.t9"], { v1: SERVICING_NOT_COMPOSED.map((entry) => entry.action).join(", ") });

export const SERVICING_SCENARIO_NOTES: Readonly<Record<ServicingScenario, string>> = {
  clean: sourceCopy.en["sjd"],
  empty: sourceCopy.en["s1zj"],
  stale: sourceCopy.en["s21a"],
  "draw-unknown": sourceCopy.en["s1rz"],
  "partial-repayment": sourceCopy.en["s4z"],
  unallocated: sourceCopy.en["s4y"],
  reversal: sourceCopy.en["s3c"],
  delinquent: sourceCopy.en["s7w"],
  "charged-off": sourceCopy.en["s1qs"],
  "post-charge-off-payment": sourceCopy.en["s4x"],
  "proposal-pending": sourceCopy.en["s3b"],
  "stale-schedule": sourceCopy.en["s1xo"],
  "adjustment-applied": sourceCopy.en["s7v"],
  "mixed-cut": sourceCopy.en["s53"],
  "dangling-link": sourceCopy.en["s143"],
  "claims-restored": sourceCopy.en["s1v0"],
  "claims-extinguished": sourceCopy.en["s1uy"],
  "claims-contact": sourceCopy.en["s1v1"],
  "scope-leak": sourceCopy.en["s215"],
  denied: sourceCopy.en["s1t4"],
  "read-lost": sourceCopy.en["s1q3"],
  "act-lost": sourceCopy.en["s79"],
  "approve-claims-closure": sourceCopy.en["s1ym"],
  "self-approval": sourceCopy.en["s65"],
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
  none: sourceCopy.en["svs"],
  recorded: sourceCopy.en["s1dr"],
};

const OBSERVATION_WORDS: Readonly<Record<ServicingObservationState, string>> = {
  "not-observed": sourceCopy.en["s11z"],
  observed: sourceCopy.en["s13j"],
  unknown: sourceCopy.en["s258"],
  disputed: sourceCopy.en["sgz"],
};

const RESERVATION_WORDS: Readonly<Record<ServicingReservationState, string>> = {
  held: sourceCopy.en["sn4"],
  released: sourceCopy.en["s1f5"],
  unknown: sourceCopy.en["s258"],
};

const EXPOSURE_WORDS: Readonly<Record<ServicingExposureState, string>> = {
  open: sourceCopy.en["s14s"],
  closed: sourceCopy.en["scv"],
  unknown: sourceCopy.en["s258"],
};

const INSTALLMENT_WORDS: Readonly<Record<ServicingInstallmentState, string>> = {
  scheduled: sourceCopy.en["s1if"],
  due: sourceCopy.en["shj"],
  overdue: sourceCopy.en["s16n"],
  satisfied: sourceCopy.en["s1i6"],
  adjusted: sourceCopy.en["s1e"],
  "charged-off": sourceCopy.en["sc0"],
};

const PAYMENT_WORDS: Readonly<Record<ServicingPaymentState, string>> = {
  unallocated: sourceCopy.en["s24x"],
  partial: sourceCopy.en["s176"],
  allocated: sourceCopy.en["s2q"],
  "late-unallocated": sourceCopy.en["sqh"],
  reversed: sourceCopy.en["s1gz"],
};

const TIMING_WORDS: Readonly<Record<ServicingPaymentTiming, string>> = {
  "scheduled-window": sourceCopy.en["sol"],
  late: sourceCopy.en["sqg"],
  "post-charge-off": sourceCopy.en["s26"],
};

const ALLOCATION_WORDS: Readonly<Record<ServicingAllocationState, string>> = {
  applied: sourceCopy.en["s5b"],
  reversed: sourceCopy.en["s1gz"],
};

const CASE_WORDS: Readonly<Record<ServicingCaseStatus, string>> = {
  monitoring: sourceCopy.en["stb"],
  delinquent: sourceCopy.en["sg0"],
  recovery: sourceCopy.en["s1eb"],
  closed: sourceCopy.en["scv"],
};

const CLOSURE_WORDS: Readonly<Record<ServicingClosureKind, string>> = {
  "charged-off": sourceCopy.en["sc0"],
  recovered: sourceCopy.en["s1ea"],
};

const PROPOSAL_KIND_WORDS: Readonly<Record<ServicingProposalKind, string>> = {
  allocation: sourceCopy.en["s2s"],
  adjustment: sourceCopy.en["s1f"],
  "case-transition": sourceCopy.en["sbk"],
};

const PROPOSAL_STATE_WORDS: Readonly<Record<ServicingProposalState, string>> = {
  pending: sourceCopy.en["s17p"],
  applied: sourceCopy.en["s5b"],
  rejected: sourceCopy.en["s1ew"],
};

const EVENT_WORDS: Readonly<Record<ServicingEventKind, string>> = {
  instruction: sourceCopy.en["so8"],
  observation: sourceCopy.en["s13h"],
  reservation: sourceCopy.en["s1g4"],
  payment: "Payment",
  allocation: sourceCopy.en["s2s"],
  reversal: sourceCopy.en["s1gv"],
  adjustment: sourceCopy.en["s1f"],
  proposal: sourceCopy.en["s19g"],
  approval: sourceCopy.en["s5t"],
  case: sourceCopy.en["sbe"],
};

const REMEDY_WORDS: Readonly<Record<ServicingRemedy, string>> = {
  "propose-allocation": sourceCopy.en["s19r"],
  "propose-adjustment": sourceCopy.en["s19t"],
  "propose-case-transition": sourceCopy.en["s19m"],
  none: sourceCopy.en["suz"],
};

const ACTION_WORDS: Readonly<Record<ServicingActionKind, string>> = {
  "propose-allocation": sourceCopy.en["s2t"],
  "propose-adjustment": sourceCopy.en["s1i"],
  "propose-case-transition": sourceCopy.en["sbl"],
  "approve-proposal": sourceCopy.en["s19h"],
};

export const SERVICING_TRANSITION_WORDS: Readonly<Record<ServicingCaseTransition, string>> = {
  "to-recovery": sourceCopy.en["std"],
  "to-charge-off": sourceCopy.en["sc1"],
  "to-closed": sourceCopy.en["sct"],
};

const ADJUSTMENT_KIND_WORDS: Readonly<Record<ServicingAdjustmentKind, string>> = {
  "due-label": sourceCopy.en["shm"],
  note: sourceCopy.en["s10r"],
  "amount-label": sourceCopy.en["s37"],
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
      return { statusLine: sourceCopy.en["s1bo"], detailLine: "", actionLabel: null };
    case "ready":
      return { statusLine: sourceCopy.en["s1jj"], detailLine: "", actionLabel: null };
    case "empty":
      return {
        statusLine: sourceCopy.en["sy6"],
        detailLine: detail ?? sourceCopy.en["s3x"],
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "stale":
      return { statusLine: sourceCopy.en["s1lz"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
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
      return { statusLine: SERVICING_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: sourceCopy.en["s1v8"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1m2"],
      };
    case "unavailable":
      return {
        statusLine: sourceCopy.en["s1yz"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1ax"],
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
      return sourceMessage(sourceCopy.en["p.t14"], { v1: fence.action });
    case "unknown-outcome":
      return sourceMessage(sourceCopy.en["p.t15"], { v1: fence.seq, v2: fence.action });
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
      ? sourceCopy.en["s1tn"]
      : state.freshness === "STALE"
        ? sourceCopy.en["s1ti"]
        : sourceCopy.en["s1wv"];

  const behindLine = state.behind ? sourceCopy.en["s75"] : null;
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
    usedBy: sourceMessage(sourceCopy.en["p.t469"], { v1: usedBy.get(cut.cutRef) ?? 0 }),
  }));
  const cutState = assessment?.cutState ?? "none";
  const cutLine =
    cutState === "clean"
      ? sourceCopy.en["sjm"]
      : cutState === "mixed"
        ? sourceCopy.en["s7m"]
        : sourceCopy.en["sy1"];

  const draw: ServicingDrawModel | null = snapshot?.draw
    ? {
        drawRef: snapshot.draw.drawRef,
        instruction: snapshot.draw.instruction,
        instructionWord: INSTRUCTION_WORDS[snapshot.draw.instruction],
        observation: snapshot.draw.observation,
        observationWord: OBSERVATION_WORDS[snapshot.draw.observation],
        amountLine:
          snapshot.draw.amountLabel === null
            ? sourceMessage(sourceCopy.en["p.t50"], { v1: SERVICING_UNDETERMINED })
            : sourceMessage(sourceCopy.en["p.t51"], { v1: snapshot.draw.amountLabel, v2: snapshot.draw.unit }),
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
            ? sourceMessage(sourceCopy.en["p.t477"], { v1: SERVICING_UNDETERMINED })
            : sourceMessage(sourceCopy.en["p.t52"], { v1: snapshot.exposure.amountLabel, v2: snapshot.exposure.unit }),
        withheld: exposureWithheld,
      }
    : null;

  const LIMIT_WORDS: Readonly<Record<string, string>> = { held: sourceCopy.en["sn4"], released: sourceCopy.en["s1f5"], unknown: sourceCopy.en["s258"] };
  const limit: ServicingLimitModel | null = snapshot?.limit
    ? {
        limitRef: snapshot.limit.limitRef,
        amountLine:
          snapshot.limit.amount === null
            ? sourceMessage(sourceCopy.en["p.t53"], { v1: SERVICING_UNDETERMINED })
            : sourceMessage(sourceCopy.en["p.t54"], { v1: snapshot.limit.amount, v2: snapshot.limit.unit, v3: snapshot.limit.state }),
        state: snapshot.limit.state,
        stateWord: LIMIT_WORDS[snapshot.limit.state] ?? snapshot.limit.state,
      }
    : null;

  const staleLine = (installmentRef: string): string | null => {
    const hit = assessment?.staleInstallments.find((item) => item.installmentRef === installmentRef);
    return hit === undefined
      ? null
      : sourceMessage(sourceCopy.en["p.t55"], { v1: hit.planRevision, v2: hit.currentRevision });
  };

  const installments: ServicingInstallmentModel[] = (snapshot?.installments ?? []).map((row) => ({
    installmentRef: row.installmentRef,
    ordinal: row.ordinal,
    dueLabel: row.dueLabel,
    amountLine: `${row.amount} ${row.unit}`,
    state: row.state,
    stateWord: INSTALLMENT_WORDS[row.state],
    planLine: sourceMessage(sourceCopy.en["p.t56"], { v1: row.planRevision }),
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
        ? sourceCopy.en["s1za"]
        : sourceMessage(sourceCopy.en["p.t57"], { v1: row.unallocatedLabel, v2: row.unit }),
    propose: allocatable.has(row.paymentRef)
      ? allocationGuard
      : { enabled: false, reason: sourceMessage(sourceCopy.en["p.t58"], { v1: row.paymentRef, v2: row.state }) },
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
    stateWord: row.state === "applied" ? sourceCopy.en["s5b"] : row.state === "proposed" ? sourceCopy.en["s19u"] : sourceCopy.en["s1ew"],
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
        : { enabled: false, reason: sourceMessage(sourceCopy.en["p.t59"], { v1: row.proposalRef, v2: row.state }) },
  }));

  const caseRow = snapshot?.servicingCase ?? null;
  const servicingCase: ServicingCaseModel | null = caseRow
    ? {
        caseRef: caseRow.caseRef,
        status: caseRow.status,
        statusWord: CASE_WORDS[caseRow.status],
        closureWord: caseRow.closureKind === null ? sourceCopy.en["s10g"] : sourceMessage(sourceCopy.en["p.t478"], { v1: CLOSURE_WORDS[caseRow.closureKind] }),
        debtLine: sourceMessage(sourceCopy.en["p.t60"], { v1: caseRow.debtLabel }),
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
    (item) => sourceMessage(sourceCopy.en["p.t61"], { v1: item.installmentRef, v2: item.planRevision, v3: item.currentRevision }),
  );
  const contradictionLines = (assessment?.contradictions ?? []).map((item) => sourceMessage(sourceCopy.en["p.t33"], { v1: item.code, v2: item.lane, v3: item.detail }));
  const unlinkedLines = (assessment?.unlinked ?? []).map(
    (item) => sourceMessage(sourceCopy.en["p.t21"], { v1: item.lens, v2: item.ref, v3: item.missingRef }),
  );

  const scheduleLine = snapshot ? sourceMessage(sourceCopy.en["p.t62"], { v1: snapshot.schedule.revision }) : sourceCopy.en["sya"];

  const transitionControl = guard("propose-case-transition");
  const transitionOptions = (assessment?.offeredTransitions ?? []).map((transition) => ({
    transition,
    word: SERVICING_TRANSITION_WORDS[transition],
    control: transitionControl,
  }));

  const nonClaimsLine =
    sourceCopy.en["so9"];

  const last: ServicingLastModel | null =
    state.last === null
      ? null
      : {
          seq: state.last.seq,
          kindWord: ACTION_WORDS[state.last.action.kind],
          phase: state.last.phase,
          phaseWord:
            state.last.phase === "applied"
              ? sourceCopy.en["s5e"]
              : state.last.phase === "rejected"
                ? sourceCopy.en["s1ez"]
                : state.last.phase === "unknown"
                  ? sourceCopy.en["s25c"]
                  : state.last.phase === "refused"
                    ? sourceCopy.en["s4n"]
                    : state.last.phase === "not-bound"
                      ? sourceCopy.en["s10c"]
                      : state.last.phase,
          code: state.last.code,
          detail: state.last.detail,
          receiptLines:
            state.last.receipt === null
              ? []
              : [
                  sourceMessage(sourceCopy.en["p.t479"], { v1: state.last.receipt.proposalRef }),
                  sourceMessage(sourceCopy.en["p.t63"], { v1: state.last.receipt.stateAfter }),
                ],
        };

  const capabilities = servicingCapabilities(state.context.actorRef);
  const counters = state.counters;
  const session: ServicingSessionModel = {
    contextLine: sourceMessage(sourceCopy.en["p.t64"], { v1: state.context.actorRef, v2: state.context.scope.obligationRef, v3: state.context.incarnation, v4: state.context.environment }),
    capabilityLine:
      capabilities.length === 0
        ? sourceMessage(sourceCopy.en["p.t65"], { v1: state.context.actorRef })
        : sourceMessage(sourceCopy.en["p.t66"], { v1: state.context.actorRef, v2: capabilities.join(", ") }),
    countersLine: sourceMessage(sourceCopy.en["p.t39"], { v1: counters.reads, v2: counters.acts, v3: counters.notSent, v4: counters.droppedReads }),
    earlierUnknownLine:
      state.earlierUnknown === 0
        ? sourceCopy.en["s130"]
        : sourceMessage(sourceCopy.en["p.t67"], { v1: state.earlierUnknown }),
    notComposedLine: SERVICING_NOT_COMPOSED_NOTE,
    holdLine: SERVICING_HOLD_NOTE,
  };

  return {
    state: screen,
    statusLine: status.statusLine,
    detailLine: status.detailLine,
    actionLabel: status.actionLabel,
    freshnessWord,
    scopeLine: sourceMessage(sourceCopy.en["p.t480"], { v1: state.context.scope.tenantId, v2: state.context.scope.obligationRef }),
    actorLine: sourceMessage(sourceCopy.en["p.t481"], { v1: state.context.actorRef, v2: capabilities.length === 0 ? "No capability." : `Capabilities ${capabilities.join(", ")}.` }),
    watermarkLine: snapshot ? sourceMessage(sourceCopy.en["p.t41"], { v1: snapshot.watermark, v2: snapshot.snapshotId }) : sourceCopy.en["s134"],
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
        text: sourceMessage(sourceCopy.en["p.t42"], { v1: word }),
        attention: false,
      };
    case "REJECTED":
      return {
        text: sourceMessage(sourceCopy.en["p.t43"], { v1: word, v2: result.record.code ?? "no code", v3: result.record.detail ?? "" }).trim(),
        attention: true,
      };
    case "UNKNOWN":
      return {
        text: sourceMessage(sourceCopy.en["p.t44"], { v1: word, v2: result.record.code ?? "no code" }),
        attention: true,
      };
    case "FENCED":
      return { text: sourceMessage(sourceCopy.en["p.t45"], { v1: word, v2: servicingFenceText(result.fence) }), attention: true };
    case "NOT_SENT":
      return { text: sourceMessage(sourceCopy.en["p.t45"], { v1: word, v2: result.detail }), attention: true };
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
  const port = creditServicingPortFor(environment, { scenario });
  return { port, controller: new CreditServicingController(port, { actorRef, obligationRef }) };
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
      note(done ? sourceMessage(sourceCopy.en["p.t46"], { v1: moved }) : sourceCopy.en["s1wu"], done);
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
        note(sourceCopy.en["s71"], true);
        return;
      }
      setObligationRef(next);
      note(
        sourceMessage(sourceCopy.en["p.t68"], { v1: context.scope.obligationRef, v2: context.incarnation }),
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
        note(sourceCopy.en["s72"], true);
        return;
      }
      setActorRef(next);
      note(
        sourceMessage(sourceCopy.en["p.t69"], { v1: context.actorRef, v2: context.incarnation, v3: servicingCapabilities(context.actorRef).join(", ") }),
      );
    },
    observeDraw() {
      synthetic("observe-draw", sourceCopy.en["s229"]);
    },
    receivePayment() {
      synthetic("receive-payment", sourceCopy.en["s227"]);
    },
    reverseAllocation() {
      synthetic("reverse-allocation", sourceCopy.en["s22a"]);
    },
    markOverdue() {
      synthetic("mark-overdue", sourceCopy.en["s220"]);
    },
    advanceSchedule() {
      synthetic("advance-schedule", sourceCopy.en["s226"]);
    },
    revokeGrant() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const done = session.port.synthetic("revoke-grant");
      note(
        done
          ? sourceCopy.en["s21r"]
          : sourceCopy.en["s1wo"],
        done,
      );
    },
    setScenario(next) {
      startSession(
        next,
        obligationRef,
        actorRef,
        sourceMessage(sourceCopy.en["p.t48"], { v1: next }),
      );
    },
    newSession() {
      startSession(
        scenario,
        obligationRef,
        actorRef,
        sourceCopy.en["s1m6"],
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
    actions,
  };
}

export { SERVICING_ACTORS, SERVICING_ADJUSTMENT_KINDS, SERVICING_APPROVER_ACTOR, SERVICING_DESK_ACTOR, SERVICING_VIEWER_ACTOR };
