import { messages as sourceCopy } from "./i18n/messages/credit-origination";
import { sourceMessage } from "./i18n/source-message";
/**
 * The credit origination screen on top of the adapter's synthetic origination
 * source. Stub scope: the default port is the synthetic source. On
 * integration-http the same port is not-bound — no current producer tuple
 * exists and the contract-only catalogue has no credit command and no read
 * command for a claim basis, a policy revision, a consent, a document, a review
 * decision, a commitment, or a drawdown permission — and this module does not
 * invent one, send a second attempt, or switch adapters.
 *
 * This module computes no amount, rate, limit, or schedule. It copies what the
 * controller and the last read hold: every figure is the source's own text, or
 * UNDETERMINED when the source sent none. Four lanes stay four lanes — the
 * application, the review decision, the commitment, and the drawdown
 * permission. A submission is not a decision, an assistant explanation is not a
 * decision, an approval is not a commitment, a commitment is not permission to
 * draw, and a recorded request is not a disbursement.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ORIGINATION_DESK_ACTOR,
  ORIGINATION_FOREIGN_REF,
  ORIGINATION_HOLD_NOT_BOUND,
  ORIGINATION_NOT_BOUND_REASON,
  ORIGINATION_NOT_COMPOSED,
  ORIGINATION_OWN_REF,
  ORIGINATION_UNDETERMINED,
  CreditOriginationController,
  creditOriginationPortFor,
  type OriginationActResult,
  type OriginationActionKind,
  type OriginationApplicationState,
  type OriginationBurdenKind,
  type OriginationBurdenState,
  type OriginationClaimState,
  type OriginationCommitmentState,
  type OriginationConsentPurpose,
  type OriginationConsentState,
  type OriginationDecisionKind,
  type OriginationDocumentKind,
  type OriginationDocumentState,
  type OriginationDrawdownPermission,
  type OriginationFence,
  type OriginationPort,
  type OriginationReadState,
  type OriginationRemedy,
  type OriginationScenario,
  type OriginationSyntheticControl,
} from "@kix/protocol-adapter";
import { protocol } from "./protocol";

export const ORIGINATION_PAGE_TITLE = sourceCopy.en["sez"];

export const ORIGINATION_SOURCE_LINE =
  sourceCopy.en["s1q7"];

export const ORIGINATION_BOUNDARY =
  sourceCopy.en["slx"];

export const ORIGINATION_EXPLANATION_NOTE =
  sourceCopy.en["s3m"];

export const ORIGINATION_FIGURE_NOTE =
  sourceCopy.en["sj8"];

export const ORIGINATION_POLICY_NOTE =
  sourceCopy.en["s18"];

export const ORIGINATION_CLAIM_NOTE =
  sourceCopy.en["sj9"];

export const ORIGINATION_LIMIT_NOTE =
  sourceCopy.en["s82"];

export const ORIGINATION_SCOPE_NOTE = sourceMessage(sourceCopy.en["p.t7"], { v1: ORIGINATION_OWN_REF, v2: ORIGINATION_FOREIGN_REF });

export const ORIGINATION_ACTOR_NOTE =
  sourceCopy.en["s1pw"];

export const ORIGINATION_READ_NOTE =
  sourceCopy.en["s6d"];

export const ORIGINATION_FENCE_NOTE =
  "One request is in flight at a time. An answer that never arrived, or that arrived untrusted, leaves the outcome unknown — it may have applied — and every later request stays fenced. A read does not lift the fence.";

export const ORIGINATION_SESSION_NOTE =
  sourceCopy.en["s1c9"];

export const ORIGINATION_SYNTHETIC_CONTROL_NOTE =
  sourceCopy.en["s1w"];

export const ORIGINATION_HOLD_NOTE = sourceMessage(sourceCopy.en["p.t8"], { v1: ORIGINATION_HOLD_NOT_BOUND.reason });

export const ORIGINATION_NOT_COMPOSED_NOTE = sourceMessage(sourceCopy.en["p.t9"], { v1: ORIGINATION_NOT_COMPOSED.map((entry) => entry.action).join(", ") });

export const ORIGINATION_SCENARIO_NOTES: Readonly<Record<OriginationScenario, string>> = {
  clean: sourceCopy.en["sjc"],
  empty: sourceCopy.en["s1zi"],
  stale: sourceCopy.en["s21a"],
  "in-review": sourceCopy.en["s1q8"],
  conditional: sourceCopy.en["s1rf"],
  "more-information": sourceCopy.en["s1yo"],
  rejected: sourceCopy.en["s1xa"],
  approved: sourceCopy.en["s1re"],
  offered: sourceCopy.en["ss"],
  committed: sourceCopy.en["s1r1"],
  "stale-policy": sourceCopy.en["s1rd"],
  "consent-withdrawn": sourceCopy.en["s1rb"],
  "docs-expired": sourceCopy.en["sr"],
  "limit-contended": sourceCopy.en["s4i"],
  "limit-race": sourceCopy.en["s7f"],
  "mixed-cut": sourceCopy.en["s1qx"],
  "dangling-link": sourceCopy.en["s147"],
  "explanation-says-approved": sourceCopy.en["s1qc"],
  "claims-approval": sourceCopy.en["s1v2"],
  "claims-disbursed": sourceCopy.en["s1uz"],
  "scope-leak": sourceCopy.en["s214"],
  denied: sourceCopy.en["s1t4"],
  "read-lost": sourceCopy.en["s1q3"],
  "act-lost": sourceCopy.en["s79"],
  "submit-claims-approval": sourceCopy.en["s1yn"],
};

export type OriginationScreenState =
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

export interface OriginationCutModel {
  cutRef: string;
  source: string;
  generation: number;
  watermark: string;
  usedBy: string;
}

export interface OriginationClaimModel {
  claimRef: string;
  tradeRef: string;
  faceLine: string;
  state: OriginationClaimState;
  stateWord: string;
  reasonLine: string;
  cutRef: string;
}

export interface OriginationBurdenModel {
  burdenRef: string;
  claimRef: string;
  kind: OriginationBurdenKind;
  kindWord: string;
  state: OriginationBurdenState;
  stateWord: string;
  amountLine: string;
  cutRef: string;
}

export interface OriginationConsentModel {
  consentRef: string;
  purpose: OriginationConsentPurpose;
  purposeWord: string;
  state: OriginationConsentState;
  stateWord: string;
  versionLine: string;
  setLine: string;
  renew: ControlModel;
}

export interface OriginationDocumentModel {
  documentRef: string;
  kind: OriginationDocumentKind;
  kindWord: string;
  state: OriginationDocumentState;
  stateWord: string;
  claimLine: string;
  expiryLine: string;
  verdictLine: string;
  provide: ControlModel;
}

export interface OriginationApplicationModel {
  applicationRef: string;
  state: OriginationApplicationState;
  stateWord: string;
  revisionLine: string;
  requestLine: string;
  claimLine: string;
}

export interface OriginationDecisionModel {
  decisionRef: string;
  kind: OriginationDecisionKind;
  kindWord: string;
  policyLine: string;
  applicationLine: string;
  conditionLines: string[];
  staleLine: string | null;
  withheld: boolean;
}

export interface OriginationReasonModel {
  reasonRef: string;
  lane: string;
  code: string;
  text: string;
  remedy: OriginationRemedy;
  remedyWord: string;
}

export interface OriginationScheduleRowModel {
  installmentLabel: string;
  dueLabel: string;
  amountLine: string;
}

export interface OriginationTermsModel {
  policyLine: string;
  rateLine: string;
  rows: OriginationScheduleRowModel[];
  staleLine: string | null;
}

export interface OriginationCommitmentModel {
  commitmentRef: string;
  state: OriginationCommitmentState;
  stateWord: string;
  policyLine: string;
  staleLine: string | null;
  withheld: boolean;
}

export interface OriginationLimitModel {
  limitRef: string;
  amountLine: string;
  contention: "none" | "contended";
  contentionWord: string;
  rankLines: string[];
  limitWord: string;
}

export interface OriginationDrawdownModel {
  permission: OriginationDrawdownPermission;
  permissionWord: string;
  withheld: boolean;
  reasonLines: string[];
  commitmentLine: string;
  requests: { drawdownRef: string; stateWord: string }[];
}

export interface OriginationExplanationModel {
  explanationRef: string;
  text: string;
}

export interface OriginationLastModel {
  seq: number;
  kindWord: string;
  phaseWord: string;
  phase: string;
  code: string | null;
  detail: string | null;
  receiptLines: string[];
}

export interface OriginationSessionModel {
  contextLine: string;
  countersLine: string;
  earlierUnknownLine: string;
  notComposedLine: string;
  holdLine: string;
}

export type LastAction = { seq: number; text: string; attention: boolean };

export interface OriginationModel {
  state: OriginationScreenState;
  statusLine: string;
  detailLine: string;
  actionLabel: string | null;
  freshnessWord: string;
  scopeLine: string;
  watermarkLine: string;
  behindLine: string | null;
  fenceLine: string | null;
  nonClaimsLine: string;
  cutState: "none" | "single" | "mixed";
  cutLine: string;
  cuts: OriginationCutModel[];
  application: OriginationApplicationModel | null;
  claims: OriginationClaimModel[];
  burdens: OriginationBurdenModel[];
  policyLine: string;
  staleLaneLines: string[];
  consents: OriginationConsentModel[];
  documents: OriginationDocumentModel[];
  unlinkedLines: string[];
  decision: OriginationDecisionModel | null;
  explanation: OriginationExplanationModel | null;
  reasons: OriginationReasonModel[];
  terms: OriginationTermsModel | null;
  commitment: OriginationCommitmentModel | null;
  drawdown: OriginationDrawdownModel;
  limit: OriginationLimitModel;
  contradictionLines: string[];
  submitControl: ControlModel;
  amendControl: ControlModel;
  rereviewControl: ControlModel;
  acceptControl: ControlModel;
  drawdownControl: ControlModel;
  session: OriginationSessionModel;
  last: OriginationLastModel | null;
  lastLine: string | null;
  lastNeedsFocus: boolean;
  lastSeq: number | null;
}

const CLAIM_STATE_WORDS: Readonly<Record<OriginationClaimState, string>> = {
  valid: sourceCopy.en["s25u"],
  disputed: sourceCopy.en["sgz"],
  expired: sourceCopy.en["sk9"],
  unknown: sourceCopy.en["s258"],
};

const BURDEN_KIND_WORDS: Readonly<Record<OriginationBurdenKind, string>> = {
  "refund-burden": sourceCopy.en["s1eo"],
  "prior-pledge": sourceCopy.en["s197"],
  hold: "Hold",
  dispute: sourceCopy.en["sgy"],
};

const BURDEN_STATE_WORDS: Readonly<Record<OriginationBurdenState, string>> = {
  observed: sourceCopy.en["s13j"],
  pending: sourceCopy.en["s17p"],
  unknown: sourceCopy.en["s258"],
};

const CONSENT_PURPOSE_WORDS: Readonly<Record<OriginationConsentPurpose, string>> = {
  "claim-data-share": sourceCopy.en["sch"],
  "credit-assessment": sourceCopy.en["sex"],
};

const CONSENT_STATE_WORDS: Readonly<Record<OriginationConsentState, string>> = {
  granted: sourceCopy.en["smq"],
  withdrawn: sourceCopy.en["s26s"],
  expired: sourceCopy.en["sk9"],
  unknown: sourceCopy.en["s258"],
};

const DOCUMENT_KIND_WORDS: Readonly<Record<OriginationDocumentKind, string>> = {
  "claim-evidence": sourceCopy.en["sci"],
  "sales-statement": sourceCopy.en["s1i2"],
  "additional-evidence": sourceCopy.en["s16"],
};

const DOCUMENT_STATE_WORDS: Readonly<Record<OriginationDocumentState, string>> = {
  valid: sourceCopy.en["s25u"],
  expiring: sourceCopy.en["skf"],
  expired: sourceCopy.en["sk9"],
  requested: sourceCopy.en["s1fs"],
  unknown: sourceCopy.en["s258"],
};

const APPLICATION_STATE_WORDS: Readonly<Record<OriginationApplicationState, string>> = {
  "not-started": sourceCopy.en["s12p"],
  submitted: sourceCopy.en["s1nb"],
};

const DECISION_KIND_WORDS: Readonly<Record<OriginationDecisionKind, string>> = {
  pending: sourceCopy.en["s17p"],
  conditional: sourceCopy.en["sdg"],
  "more-information": sourceCopy.en["stc"],
  rejected: sourceCopy.en["s1ew"],
  approved: sourceCopy.en["s5y"],
};

const COMMITMENT_STATE_WORDS: Readonly<Record<OriginationCommitmentState, string>> = {
  offered: sourceCopy.en["s13w"],
  accepted: sourceCopy.en["sb"],
  lapsed: sourceCopy.en["sq6"],
  withdrawn: sourceCopy.en["s26s"],
};

const PERMISSION_WORDS: Readonly<Record<OriginationDrawdownPermission, string>> = {
  "not-permitted": sourceCopy.en["s123"],
  permitted: sourceCopy.en["s17z"],
  suspended: sourceCopy.en["s1nq"],
};

const REMEDY_WORDS: Readonly<Record<OriginationRemedy, string>> = {
  "amend-application": sourceCopy.en["s33"],
  "provide-document": sourceCopy.en["s1a2"],
  "renew-consent": sourceCopy.en["s1fl"],
  "request-re-review": sourceCopy.en["s86"],
  none: sourceCopy.en["suz"],
};

const ACTION_WORDS: Readonly<Record<OriginationActionKind, string>> = {
  submit: sourceCopy.en["s1n8"],
  correct: sourceCopy.en["sef"],
  "re-review": sourceCopy.en["s1g0"],
  "accept-commitment": sourceCopy.en["sda"],
  "request-drawdown": sourceCopy.en["shf"],
};

function readStateToScreen(readState: OriginationReadState): OriginationScreenState {
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
  state: OriginationScreenState,
  code: string | null,
  detail: string | null,
): { statusLine: string; detailLine: string; actionLabel: string | null } {
  const suffix = code ? ` (${code})` : "";
  switch (state) {
    case "loading":
      return { statusLine: sourceCopy.en["s1bj"], detailLine: "", actionLabel: null };
    case "ready":
      return { statusLine: sourceCopy.en["s16c"], detailLine: "", actionLabel: null };
    case "empty":
      return {
        statusLine: sourceCopy.en["sy4"],
        detailLine: detail ?? sourceCopy.en["s3y"],
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "stale":
      return { statusLine: sourceCopy.en["s1lr"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
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
      return { statusLine: ORIGINATION_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: sourceCopy.en["s1v8"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1m2"],
      };
    case "unavailable":
      return {
        statusLine: sourceCopy.en["s1yv"],
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
export function fenceText(fence: OriginationFence): string {
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

function staleLine(builtUnder: number, currentRevision: number): string {
  return sourceMessage(sourceCopy.en["p.t16"], { v1: builtUnder, v2: currentRevision });
}

export function buildOriginationModel(input: { controller: CreditOriginationController; last: LastAction | null }): OriginationModel {
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
  const fenceLine = state.fence === null ? null : fenceText(state.fence);

  const usedBy = new Map<string, number>();
  if (snapshot) {
    for (const row of [...snapshot.claims, ...snapshot.burdens]) {
      usedBy.set(row.cutRef, (usedBy.get(row.cutRef) ?? 0) + 1);
    }
  }
  const cuts: OriginationCutModel[] = (assessment?.usedCuts ?? []).map((cut) => ({
    cutRef: cut.cutRef,
    source: cut.source,
    generation: cut.generation,
    watermark: cut.watermark,
    usedBy: sourceMessage(sourceCopy.en["p.t469"], { v1: usedBy.get(cut.cutRef) ?? 0 }),
  }));
  const cutState = assessment?.cutState ?? "none";
  const cutLine =
    cutState === "single"
      ? sourceCopy.en["sj1"]
      : cutState === "mixed"
        ? sourceCopy.en["sck"]
        : sourceCopy.en["sum"];

  const claims: OriginationClaimModel[] = (snapshot?.claims ?? []).map((row) => ({
    claimRef: row.claimRef,
    tradeRef: row.tradeRef,
    faceLine: `${row.faceAmount} ${row.unit}`,
    state: row.state,
    stateWord: CLAIM_STATE_WORDS[row.state],
    reasonLine: row.reasonCode ? sourceMessage(sourceCopy.en["p.t17"], { v1: row.reasonCode }) : sourceCopy.en["sxk"],
    cutRef: row.cutRef,
  }));
  const burdens: OriginationBurdenModel[] = (snapshot?.burdens ?? []).map((row) => ({
    burdenRef: row.burdenRef,
    claimRef: row.claimRef,
    kind: row.kind,
    kindWord: BURDEN_KIND_WORDS[row.kind],
    state: row.state,
    stateWord: BURDEN_STATE_WORDS[row.state],
    amountLine: `${row.amount} ${row.unit}`,
    cutRef: row.cutRef,
  }));

  const staleFor = (lane: "review" | "commitment" | "terms"): string | null => {
    const hit = assessment?.staleLanes.find((item) => item.lane === lane);
    return hit === undefined ? null : staleLine(hit.builtUnder, hit.currentRevision);
  };
  const withheld = (lane: "review" | "commitment" | "drawdown"): boolean =>
    (assessment?.contradictions ?? []).some((item) => item.lane === lane);

  const toControl = (eligibility: { allowed: boolean; reason: string | null }): ControlModel => ({
    enabled: eligibility.allowed,
    reason: eligibility.reason,
  });
  const documentEligibility = toControl(controller.canSend("correct", "document"));
  const consentEligibility = toControl(controller.canSend("correct", "consent"));

  const consents: OriginationConsentModel[] = (snapshot?.consents ?? []).map((row) => {
    const needs = row.state !== "granted";
    return {
      consentRef: row.consentRef,
      purpose: row.purpose,
      purposeWord: CONSENT_PURPOSE_WORDS[row.purpose],
      state: row.state,
      stateWord: CONSENT_STATE_WORDS[row.state],
      versionLine: sourceMessage(sourceCopy.en["p.t470"], { v1: row.version }),
      setLine: sourceMessage(sourceCopy.en["p.t18"], { v1: row.setLabel }),
      renew: needs
        ? consentEligibility
        : { enabled: false, reason: sourceCopy.en["s1zn"] },
    };
  });

  const documents: OriginationDocumentModel[] = (snapshot?.documents ?? []).map((row) => {
    const needs = row.state === "expired" || row.state === "requested" || row.state === "unknown";
    return {
      documentRef: row.documentRef,
      kind: row.kind,
      kindWord: DOCUMENT_KIND_WORDS[row.kind],
      state: row.state,
      stateWord: DOCUMENT_STATE_WORDS[row.state],
      claimLine: row.claimRef === null ? sourceCopy.en["s8x"] : sourceMessage(sourceCopy.en["p.t19"], { v1: row.claimRef }),
      expiryLine: row.expiresLabel === null ? sourceCopy.en["sve"] : sourceMessage(sourceCopy.en["p.t20"], { v1: row.expiresLabel }),
      verdictLine:
        row.expired === null
          ? sourceCopy.en["s1z9"]
          : row.expired
            ? sourceCopy.en["s1zz"]
            : sourceCopy.en["s200"],
      provide: needs
        ? documentEligibility
        : { enabled: false, reason: sourceCopy.en["s1zo"] },
    };
  });

  const unlinkedLines = (assessment?.unlinked ?? []).map(
    (item) => sourceMessage(sourceCopy.en["p.t21"], { v1: item.lens, v2: item.ref, v3: item.missingRef }),
  );

  const application: OriginationApplicationModel | null = snapshot
    ? {
        applicationRef: snapshot.application.applicationRef,
        state: snapshot.application.state,
        stateWord: APPLICATION_STATE_WORDS[snapshot.application.state],
        revisionLine: sourceMessage(sourceCopy.en["p.t22"], { v1: snapshot.application.revision }),
        requestLine:
          snapshot.application.requestedAmount === null
            ? sourceCopy.en["su1"]
            : sourceMessage(sourceCopy.en["p.t23"], { v1: snapshot.application.requestedAmount, v2: snapshot.application.unit }),
        claimLine:
          snapshot.application.claimRefs.length === 0
            ? sourceCopy.en["sce"]
            : sourceMessage(sourceCopy.en["p.t471"], { v1: snapshot.application.claimRefs.join(", ") }),
      }
    : null;

  const decision: OriginationDecisionModel | null = snapshot?.decision
    ? {
        decisionRef: snapshot.decision.decisionRef,
        kind: snapshot.decision.kind,
        kindWord: DECISION_KIND_WORDS[snapshot.decision.kind],
        policyLine: sourceMessage(sourceCopy.en["p.t24"], { v1: snapshot.decision.policyRevision }),
        applicationLine: sourceMessage(sourceCopy.en["p.t25"], { v1: snapshot.decision.applicationRevision }),
        conditionLines: snapshot.decision.conditions.map((item) => sourceMessage(sourceCopy.en["p.t26"], { v1: item })),
        staleLine: staleFor("review"),
        withheld: withheld("review"),
      }
    : null;

  const reasons: OriginationReasonModel[] = (snapshot?.reasons ?? []).map((row) => ({
    reasonRef: row.reasonRef,
    lane: row.lane,
    code: row.code,
    text: row.text,
    remedy: row.remedy,
    remedyWord: REMEDY_WORDS[row.remedy],
  }));

  const explanation: OriginationExplanationModel | null = snapshot?.explanation ?? null;

  const termsRow = snapshot?.terms ?? null;
  const terms: OriginationTermsModel | null = termsRow
    ? {
        policyLine: sourceMessage(sourceCopy.en["p.t27"], { v1: termsRow.policyRevision }),
        rateLine: termsRow.rateLabel === null ? sourceMessage(sourceCopy.en["p.t472"], { v1: ORIGINATION_UNDETERMINED }) : sourceMessage(sourceCopy.en["p.t28"], { v1: termsRow.rateLabel }),
        rows: (termsRow.scheduleRows ?? []).map((row) => ({
          installmentLabel: row.installmentLabel,
          dueLabel: row.dueLabel,
          amountLine: `${row.amount} ${termsRow.unit}`,
        })),
        staleLine: staleFor("terms"),
      }
    : null;

  const commitment: OriginationCommitmentModel | null = snapshot?.commitment
    ? {
        commitmentRef: snapshot.commitment.commitmentRef,
        state: snapshot.commitment.state,
        stateWord: COMMITMENT_STATE_WORDS[snapshot.commitment.state],
        policyLine: sourceMessage(sourceCopy.en["p.t29"], { v1: snapshot.commitment.policyRevision }),
        staleLine: staleFor("commitment"),
        withheld: withheld("commitment"),
      }
    : null;

  const ownApplication = snapshot?.application.applicationRef ?? "";
  const limit: OriginationLimitModel = snapshot
    ? {
        limitRef: snapshot.limit.limitRef,
        amountLine: snapshot.limit.amount === null ? sourceMessage(sourceCopy.en["p.t473"], { v1: ORIGINATION_UNDETERMINED }) : sourceMessage(sourceCopy.en["p.t474"], { v1: snapshot.limit.amount, v2: snapshot.limit.unit }),
        contention: snapshot.limit.contention,
        contentionWord: snapshot.limit.contention === "contended" ? sourceCopy.en["se8"] : sourceCopy.en["s10n"],
        rankLines: snapshot.limit.ranks.map((row) =>
          row.applicationRef === ownApplication
            ? sourceMessage(sourceCopy.en["p.t30"], { v1: row.rank, v2: row.applicationRef })
            : sourceMessage(sourceCopy.en["p.t31"], { v1: row.rank, v2: row.applicationRef }),
        ),
        limitWord:
          assessment?.limitState === "contended-behind"
            ? sourceCopy.en["s206"]
            : assessment?.limitState === "contended-first"
              ? sourceCopy.en["s207"]
              : sourceCopy.en["suy"],
      }
    : {
        limitRef: "",
        amountLine: "",
        contention: "none",
        contentionWord: sourceCopy.en["s12c"],
        rankLines: [],
        limitWord: sourceCopy.en["svy"],
      };

  const drawdown: OriginationDrawdownModel = snapshot
    ? {
        permission: snapshot.drawdown.permission,
        permissionWord: PERMISSION_WORDS[snapshot.drawdown.permission],
        withheld: withheld("drawdown"),
        reasonLines: snapshot.drawdown.reasonCodes.map((code) => sourceMessage(sourceCopy.en["p.t17"], { v1: code })),
        commitmentLine:
          snapshot.drawdown.commitmentRef === null
            ? sourceCopy.en["sus"]
            : sourceMessage(sourceCopy.en["p.t32"], { v1: snapshot.drawdown.commitmentRef }),
        requests: snapshot.drawdown.requests.map((row) => ({ drawdownRef: row.drawdownRef, stateWord: sourceCopy.en["s1dz"] })),
      }
    : { permission: "not-permitted", permissionWord: sourceCopy.en["s12c"], withheld: false, reasonLines: [], commitmentLine: "", requests: [] };

  const contradictionLines = (assessment?.contradictions ?? []).map((item) => sourceMessage(sourceCopy.en["p.t33"], { v1: item.code, v2: item.lane, v3: item.detail }));

  const staleLaneLines = (assessment?.staleLanes ?? []).map((item) => `${item.lane}: ${staleLine(item.builtUnder, item.currentRevision)}`);

  const policyLine = snapshot ? sourceMessage(sourceCopy.en["p.t34"], { v1: snapshot.policy.policyRef, v2: snapshot.policy.currentRevision }) : sourceCopy.en["swx"];

  const nonClaimsLine =
    sourceCopy.en["s1n9"];

  const guard = (kind: OriginationActionKind, target?: "application" | "document" | "consent"): ControlModel =>
    notBound ? { enabled: false, reason: ORIGINATION_NOT_BOUND_REASON } : toControl(controller.canSend(kind, target));

  const last: OriginationLastModel | null =
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
                  sourceMessage(sourceCopy.en["p.t22"], { v1: state.last.receipt.revision }),
                  sourceMessage(sourceCopy.en["p.t35"], { v1: state.last.receipt.decisionAfter }),
                  sourceMessage(sourceCopy.en["p.t36"], { v1: state.last.receipt.commitmentAfter }),
                  state.last.receipt.drawdownRef === null
                    ? sourceCopy.en["sv7"]
                    : sourceMessage(sourceCopy.en["p.t37"], { v1: state.last.receipt.drawdownRef }),
                ],
        };

  const counters = state.counters;
  const session: OriginationSessionModel = {
    contextLine: sourceMessage(sourceCopy.en["p.t38"], { v1: state.context.actorRef, v2: state.context.scope.applicantRef, v3: state.context.incarnation, v4: state.context.environment }),
    countersLine: sourceMessage(sourceCopy.en["p.t39"], { v1: counters.reads, v2: counters.acts, v3: counters.notSent, v4: counters.droppedReads }),
    earlierUnknownLine:
      state.earlierUnknown === 0
        ? sourceCopy.en["s12z"]
        : sourceMessage(sourceCopy.en["p.t40"], { v1: state.earlierUnknown }),
    notComposedLine: ORIGINATION_NOT_COMPOSED_NOTE,
    holdLine: ORIGINATION_HOLD_NOTE,
  };

  return {
    state: screen,
    statusLine: status.statusLine,
    detailLine: status.detailLine,
    actionLabel: status.actionLabel,
    freshnessWord,
    scopeLine: sourceMessage(sourceCopy.en["p.t476"], { v1: state.context.scope.tenantId, v2: state.context.scope.applicantRef }),
    watermarkLine: snapshot ? sourceMessage(sourceCopy.en["p.t41"], { v1: snapshot.watermark, v2: snapshot.snapshotId }) : sourceCopy.en["s134"],
    behindLine,
    fenceLine,
    nonClaimsLine,
    cutState,
    cutLine,
    cuts,
    application,
    claims,
    burdens,
    policyLine,
    staleLaneLines,
    consents,
    documents,
    unlinkedLines,
    decision,
    explanation,
    reasons,
    terms,
    commitment,
    drawdown,
    limit,
    contradictionLines,
    submitControl: guard("submit"),
    amendControl: guard("correct", "application"),
    rereviewControl: guard("re-review"),
    acceptControl: guard("accept-commitment"),
    drawdownControl: guard("request-drawdown"),
    session,
    last,
    lastLine: input.last === null ? null : input.last.text,
    lastNeedsFocus: input.last?.attention ?? false,
    lastSeq: input.last === null ? null : input.last.seq,
  };
}

function actResultLine(kind: OriginationActionKind, result: OriginationActResult): { text: string; attention: boolean } {
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
      return { text: sourceMessage(sourceCopy.en["p.t45"], { v1: word, v2: fenceText(result.fence) }), attention: true };
    case "NOT_SENT":
      return { text: sourceMessage(sourceCopy.en["p.t45"], { v1: word, v2: result.detail }), attention: true };
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

export interface OriginationActions {
  refresh(): void;
  submit(amount: string): void;
  amend(amount: string): void;
  provideDocument(documentRef: string): void;
  renewConsent(consentRef: string): void;
  rereview(): void;
  acceptCommitment(): void;
  requestDrawdown(): void;
  switchScope(): void;
  advanceReview(): void;
  advancePolicy(): void;
  withdrawConsent(): void;
  expireDocument(): void;
  rivalRequest(): void;
  revokeGrant(): void;
  setScenario(next: OriginationScenario): void;
  newSession(): void;
}

interface Session {
  port: OriginationPort;
  controller: CreditOriginationController;
}

function createSession(environment: "stub" | "integration-http", scenario: OriginationScenario, applicantRef: string): Session {
  const port = creditOriginationPortFor(environment, { scenario });
  return { port, controller: new CreditOriginationController(port, { actorRef: ORIGINATION_DESK_ACTOR, applicantRef }) };
}

export function useCreditOrigination(): {
  environment: "stub" | "integration-http";
  scenario: OriginationScenario;
  applicantRef: string;
  model: OriginationModel;
  actions: OriginationActions;
} {
  const environment = protocol.describe().environment;
  const sessionRef = useRef<Session | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createSession(environment, "clean", ORIGINATION_OWN_REF);
  }
  const [scenario, setScenarioState] = useState<OriginationScenario>("clean");
  const [applicantRef, setApplicantRef] = useState<string>(ORIGINATION_OWN_REF);
  const [epoch, setEpoch] = useState(0);
  const [, setTick] = useState(0);
  const [last, setLast] = useState<LastAction | null>(null);
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
    (next: OriginationScenario, scope: string, text: string) => {
      sessionRef.current = createSession(environment, next, scope);
      setScenarioState(next);
      setEpoch((value) => value + 1);
      note(text);
    },
    [environment, note],
  );

  const run = useCallback(
    (kind: OriginationActionKind, send: () => Promise<OriginationActResult>) => {
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
    (control: OriginationSyntheticControl, moved: string) => {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const done = session.port.synthetic(control);
      note(done ? sourceMessage(sourceCopy.en["p.t46"], { v1: moved }) : sourceCopy.en["s1wu"], done);
    },
    [note],
  );

  const actions: OriginationActions = {
    refresh() {
      void sessionRef.current?.controller.read();
    },
    submit(amount) {
      const session = sessionRef.current;
      if (session !== null) {
        run("submit", () => session.controller.submit(amount));
      }
    },
    amend(amount) {
      const session = sessionRef.current;
      if (session !== null) {
        run("correct", () => session.controller.amend(amount));
      }
    },
    provideDocument(documentRef) {
      const session = sessionRef.current;
      if (session !== null) {
        run("correct", () => session.controller.provideDocument(documentRef));
      }
    },
    renewConsent(consentRef) {
      const session = sessionRef.current;
      if (session !== null) {
        run("correct", () => session.controller.renewConsent(consentRef));
      }
    },
    rereview() {
      const session = sessionRef.current;
      if (session !== null) {
        run("re-review", () => session.controller.requestReReview());
      }
    },
    acceptCommitment() {
      const session = sessionRef.current;
      if (session !== null) {
        run("accept-commitment", () => session.controller.acceptCommitment());
      }
    },
    requestDrawdown() {
      const session = sessionRef.current;
      if (session !== null) {
        run("request-drawdown", () => session.controller.requestDrawdown());
      }
    },
    switchScope() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const next = session.controller.state().context.scope.applicantRef === ORIGINATION_OWN_REF ? ORIGINATION_FOREIGN_REF : ORIGINATION_OWN_REF;
      const context = session.controller.switchScope(next);
      if (context === null) {
        note(sourceCopy.en["s71"], true);
        return;
      }
      setApplicantRef(next);
      note(
        sourceMessage(sourceCopy.en["p.t47"], { v1: context.scope.applicantRef, v2: context.incarnation }),
      );
    },
    advanceReview() {
      synthetic("advance-review", sourceCopy.en["s225"]);
    },
    advancePolicy() {
      synthetic("advance-policy", sourceCopy.en["s224"]);
    },
    withdrawConsent() {
      synthetic("withdraw-consent", sourceCopy.en["s22c"]);
    },
    expireDocument() {
      synthetic("expire-document", sourceCopy.en["s221"]);
    },
    rivalRequest() {
      synthetic("rival-request", sourceCopy.en["s21z"]);
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
      startSession(next, applicantRef, sourceMessage(sourceCopy.en["p.t48"], { v1: next }));
    },
    newSession() {
      startSession(scenario, applicantRef, sourceCopy.en["s1m6"]);
    },
  };

  const session = sessionRef.current;
  return {
    environment,
    scenario,
    applicantRef,
    model: buildOriginationModel({ controller: session.controller, last }),
    actions,
  };
}
