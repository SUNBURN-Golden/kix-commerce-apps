import { connectivityPort, connectivityController, connectedActions } from "./connectivity/write-guard";
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
import { protocol } from "./connectivity/desk-protocol";

export const ORIGINATION_PAGE_TITLE = "Credit origination (synthetic)";

export const ORIGINATION_SOURCE_LINE =
  "The application, claims, burdens, policy revision, consents, documents, review, commitment, and drawdown permission come from a synthetic origination source on this page load. They are not a producer read and not a catalogue receipt.";

export const ORIGINATION_BOUNDARY =
  "Four lanes stay four lanes. A submitted application is not a review decision, an approval is not a commitment, a commitment is not permission to draw, and a recorded drawdown request is not a disbursement. Nothing here disburses.";

export const ORIGINATION_EXPLANATION_NOTE =
  "An assistant-written explanation is shown as an explanation. It carries no decision field and it is never read as an approval, whatever its text says.";

export const ORIGINATION_FIGURE_NOTE =
  "Every rate, limit, face, burden, and schedule figure is the source's own text, copied and never parsed, summed, scaled, or compared. A figure the source did not decide is shown as UNDETERMINED.";

export const ORIGINATION_POLICY_NOTE =
  "A decision, a commitment, or terms built under an older policy revision than the one the source holds as current stays flagged with both revisions. Permission to draw is withheld while a lane is stale, even when the source still states it.";

export const ORIGINATION_CLAIM_NOTE =
  "Every read and every receipt states submissionIsApproval, explanationIsApproval, approvalIsCommitment, commitmentIsDrawdown, and disbursed as false. A payload that says anything else, or stays silent, is refused before a row is shown.";

export const ORIGINATION_LIMIT_NOTE =
  "A shared limit is ranked by the source. A rival request that took the limit first is shown as the source's order; this page ranks nothing itself and offers no correction that changes the order.";

export const ORIGINATION_SCOPE_NOTE = `The desk actor holds a synthetic grant for ${ORIGINATION_OWN_REF} and none for ${ORIGINATION_FOREIGN_REF}. A scope the grant does not cover is refused and leaves no row on screen.`;

export const ORIGINATION_ACTOR_NOTE =
  "The actor string is a context label. It is not an authentication result, and the source does not trust it for access.";

export const ORIGINATION_READ_NOTE =
  "A read is one request and a write is one request. Neither is sent again by this page. A read that arrives after the scope changed is dropped.";

export const ORIGINATION_FENCE_NOTE =
  "One request is in flight at a time. An answer that never arrived, or that arrived untrusted, leaves the outcome unknown — it may have applied — and every later request stays fenced. A read does not lift the fence.";

export const ORIGINATION_SESSION_NOTE =
  "Reads, receipts, and the fence live in this page load only. A reload or a new synthetic session clears them and resolves nothing at a producer.";

export const ORIGINATION_SYNTHETIC_CONTROL_NOTE =
  "Advance review, advance policy, withdraw consent, expire document, rival request, and revoke grant are synthetic controls a real producer does not offer. They stand in for a source that moved on.";

export const ORIGINATION_HOLD_NOTE = `Holding a seat is not available here. ${ORIGINATION_HOLD_NOT_BOUND.reason}`;

export const ORIGINATION_NOT_COMPOSED_NOTE = `Catalogue actions recorded and never composed here: ${ORIGINATION_NOT_COMPOSED.map((entry) => entry.action).join(", ")}.`;

export const ORIGINATION_SCENARIO_NOTES: Readonly<Record<OriginationScenario, string>> = {
  clean: "Every read and request is answered. The application is not started.",
  empty: "The source has no rows for this applicant.",
  stale: "The source serves a watermark older than the floor this page holds.",
  "in-review": "The application is submitted and the review is pending.",
  conditional: "The decision is conditional, with the reasons and paths the source names.",
  "more-information": "The source asks for additional evidence before it decides.",
  rejected: "The review rejected the application, with the reasons and paths the source names.",
  approved: "The decision is approved. An approval is not a commitment.",
  offered: "A commitment is offered. Accepting it is the person's request, and it opens no drawdown.",
  committed: "The commitment is accepted and the source permits a drawdown request.",
  "stale-policy": "The decision and the commitment were built under an older policy revision. The source still states permission; it is withheld here.",
  "consent-withdrawn": "The credit-assessment consent is withdrawn at the source.",
  "docs-expired": "A claim evidence document is expired at the source.",
  "limit-contended": "Another application outranks this one on the shared limit, as the source ordered it.",
  "limit-race": "A rival request takes the shared limit after the first read and before the drawdown request lands.",
  "mixed-cut": "The claims and the burdens are on different source cuts. They are not merged.",
  "dangling-link": "One burden names a claim the read does not list.",
  "explanation-says-approved": "The assistant explanation reads like an approval. The decision stays pending.",
  "claims-approval": "The payload claims a submission is an approval. It is refused before a row is shown.",
  "claims-disbursed": "The payload claims a disbursement already happened. It is refused before a row is shown.",
  "scope-leak": "The source sends a row that belongs to another applicant. The payload is refused.",
  denied: "The grant for this actor is withdrawn at the source.",
  "read-lost": "The answer to a read never arrives.",
  "act-lost": "A request reaches the source and takes effect. Its answer never arrives.",
  "submit-claims-approval": "The source applies a submission, then answers that the decision is approved. The answer is not trusted.",
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
  valid: "Valid",
  disputed: "Disputed",
  expired: "Expired",
  unknown: "Unknown",
};

const BURDEN_KIND_WORDS: Readonly<Record<OriginationBurdenKind, string>> = {
  "refund-burden": "Refund burden",
  "prior-pledge": "Prior pledge",
  hold: "Hold",
  dispute: "Dispute",
};

const BURDEN_STATE_WORDS: Readonly<Record<OriginationBurdenState, string>> = {
  observed: "Observed",
  pending: "Pending",
  unknown: "Unknown",
};

const CONSENT_PURPOSE_WORDS: Readonly<Record<OriginationConsentPurpose, string>> = {
  "claim-data-share": "Claim data share",
  "credit-assessment": "Credit assessment",
};

const CONSENT_STATE_WORDS: Readonly<Record<OriginationConsentState, string>> = {
  granted: "Granted",
  withdrawn: "Withdrawn",
  expired: "Expired",
  unknown: "Unknown",
};

const DOCUMENT_KIND_WORDS: Readonly<Record<OriginationDocumentKind, string>> = {
  "claim-evidence": "Claim evidence",
  "sales-statement": "Sales statement",
  "additional-evidence": "Additional evidence",
};

const DOCUMENT_STATE_WORDS: Readonly<Record<OriginationDocumentState, string>> = {
  valid: "Valid",
  expiring: "Expiring",
  expired: "Expired",
  requested: "Requested",
  unknown: "Unknown",
};

const APPLICATION_STATE_WORDS: Readonly<Record<OriginationApplicationState, string>> = {
  "not-started": "Not started",
  submitted: "Submitted",
};

const DECISION_KIND_WORDS: Readonly<Record<OriginationDecisionKind, string>> = {
  pending: "Pending",
  conditional: "Conditional",
  "more-information": "More information requested",
  rejected: "Rejected",
  approved: "Approved",
};

const COMMITMENT_STATE_WORDS: Readonly<Record<OriginationCommitmentState, string>> = {
  offered: "Offered",
  accepted: "Accepted",
  lapsed: "Lapsed",
  withdrawn: "Withdrawn",
};

const PERMISSION_WORDS: Readonly<Record<OriginationDrawdownPermission, string>> = {
  "not-permitted": "Not permitted",
  permitted: "Permitted",
  suspended: "Suspended",
};

const REMEDY_WORDS: Readonly<Record<OriginationRemedy, string>> = {
  "amend-application": "Amend the application",
  "provide-document": "Provide a document",
  "renew-consent": "Renew the consent",
  "request-re-review": "Ask for a new review",
  none: "No correction path",
};

const ACTION_WORDS: Readonly<Record<OriginationActionKind, string>> = {
  submit: "Submission",
  correct: "Correction",
  "re-review": "Re-review request",
  "accept-commitment": "Commitment acceptance",
  "request-drawdown": "Drawdown request",
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
      return { statusLine: "Reading the synthetic origination source. Nothing is shown yet.", detailLine: "", actionLabel: null };
    case "ready":
      return { statusLine: "Origination read.", detailLine: "", actionLabel: null };
    case "empty":
      return {
        statusLine: "No rows for this applicant in this read.",
        detailLine: detail ?? "An empty read is not an application with no claim basis.",
        actionLabel: "Read again",
      };
    case "stale":
      return { statusLine: "Stale origination read.", detailLine: detail ?? "", actionLabel: "Read again" };
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
      return { statusLine: ORIGINATION_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: "The pin tuple changed. Nothing was read and nothing was applied.",
        detailLine: detail ?? "",
        actionLabel: "Start a new synthetic session",
      };
    case "unavailable":
      return {
        statusLine: "The source did not answer. This is not an application with no claim basis.",
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
export function fenceText(fence: OriginationFence): string {
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

function staleLine(builtUnder: number, currentRevision: number): string {
  return `Built under policy revision ${builtUnder}; the source holds ${currentRevision} as current. Flagged, never shown as current.`;
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
      ? "The last read is current."
      : state.freshness === "STALE"
        ? "The last read is behind."
        : "There is no usable read.";

  const behindLine = state.behind ? "A request reached the source after the last read. Read again before the next request." : null;
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
    usedBy: `${usedBy.get(cut.cutRef) ?? 0} rows`,
  }));
  const cutState = assessment?.cutState ?? "none";
  const cutLine =
    cutState === "single"
      ? "Every claim and burden is on one source cut."
      : cutState === "mixed"
        ? "Claims and burdens are on more than one source cut. They are not merged, so there is no single basis to cite."
        : "No claim or burden carries a source cut in this read.";

  const claims: OriginationClaimModel[] = (snapshot?.claims ?? []).map((row) => ({
    claimRef: row.claimRef,
    tradeRef: row.tradeRef,
    faceLine: `${row.faceAmount} ${row.unit}`,
    state: row.state,
    stateWord: CLAIM_STATE_WORDS[row.state],
    reasonLine: row.reasonCode ? `Reason ${row.reasonCode} as the source names it.` : "No reason named.",
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
      versionLine: `Version ${row.version}.`,
      setLine: `State set ${row.setLabel} as the source labels it.`,
      renew: needs
        ? consentEligibility
        : { enabled: false, reason: "The source holds this consent as granted. Nothing needs renewing." },
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
      claimLine: row.claimRef === null ? "Attached to no claim." : `Attached to claim ${row.claimRef}.`,
      expiryLine: row.expiresLabel === null ? "No expiry label from the source." : `Expiry ${row.expiresLabel} as the source labels it.`,
      verdictLine:
        row.expired === null
          ? "The source gave no expiry verdict."
          : row.expired
            ? "The source marks this document expired."
            : "The source marks this document not expired.",
      provide: needs
        ? documentEligibility
        : { enabled: false, reason: "The source holds this document as current. Nothing needs providing." },
    };
  });

  const unlinkedLines = (assessment?.unlinked ?? []).map(
    (item) => `${item.lens} row ${item.ref} names ${item.missingRef}, which the read does not list. It is not attached elsewhere.`,
  );

  const application: OriginationApplicationModel | null = snapshot
    ? {
        applicationRef: snapshot.application.applicationRef,
        state: snapshot.application.state,
        stateWord: APPLICATION_STATE_WORDS[snapshot.application.state],
        revisionLine: `Application revision ${snapshot.application.revision}.`,
        requestLine:
          snapshot.application.requestedAmount === null
            ? "No amount requested yet."
            : `Requested ${snapshot.application.requestedAmount} ${snapshot.application.unit}. The asked amount, not an approved one.`,
        claimLine:
          snapshot.application.claimRefs.length === 0
            ? "Cites no claim yet."
            : `Cites ${snapshot.application.claimRefs.join(", ")}.`,
      }
    : null;

  const decision: OriginationDecisionModel | null = snapshot?.decision
    ? {
        decisionRef: snapshot.decision.decisionRef,
        kind: snapshot.decision.kind,
        kindWord: DECISION_KIND_WORDS[snapshot.decision.kind],
        policyLine: `Decided under policy revision ${snapshot.decision.policyRevision}.`,
        applicationLine: `Judged application revision ${snapshot.decision.applicationRevision}.`,
        conditionLines: snapshot.decision.conditions.map((item) => `Condition ${item} as the source names it.`),
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
        policyLine: `Terms from policy revision ${termsRow.policyRevision}.`,
        rateLine: termsRow.rateLabel === null ? `Rate ${ORIGINATION_UNDETERMINED}.` : `Rate label ${termsRow.rateLabel}.`,
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
        policyLine: `Offered under policy revision ${snapshot.commitment.policyRevision}.`,
        staleLine: staleFor("commitment"),
        withheld: withheld("commitment"),
      }
    : null;

  const ownApplication = snapshot?.application.applicationRef ?? "";
  const limit: OriginationLimitModel = snapshot
    ? {
        limitRef: snapshot.limit.limitRef,
        amountLine: snapshot.limit.amount === null ? `Limit ${ORIGINATION_UNDETERMINED}.` : `Limit ${snapshot.limit.amount} ${snapshot.limit.unit}.`,
        contention: snapshot.limit.contention,
        contentionWord: snapshot.limit.contention === "contended" ? "Contended" : "Not contended",
        rankLines: snapshot.limit.ranks.map((row) =>
          row.applicationRef === ownApplication
            ? `Rank ${row.rank}: this application (${row.applicationRef}).`
            : `Rank ${row.rank}: another application (${row.applicationRef}).`,
        ),
        limitWord:
          assessment?.limitState === "contended-behind"
            ? "The source ranked another application ahead of this one."
            : assessment?.limitState === "contended-first"
              ? "The source ranked this application first."
              : "No contention on this limit.",
      }
    : {
        limitRef: "",
        amountLine: "",
        contention: "none",
        contentionWord: "Not read",
        rankLines: [],
        limitWord: "No limit read.",
      };

  const drawdown: OriginationDrawdownModel = snapshot
    ? {
        permission: snapshot.drawdown.permission,
        permissionWord: PERMISSION_WORDS[snapshot.drawdown.permission],
        withheld: withheld("drawdown"),
        reasonLines: snapshot.drawdown.reasonCodes.map((code) => `Reason ${code} as the source names it.`),
        commitmentLine:
          snapshot.drawdown.commitmentRef === null
            ? "No commitment behind this permission."
            : `Behind commitment ${snapshot.drawdown.commitmentRef}.`,
        requests: snapshot.drawdown.requests.map((row) => ({ drawdownRef: row.drawdownRef, stateWord: "Recorded. Not a disbursement." })),
      }
    : { permission: "not-permitted", permissionWord: "Not read", withheld: false, reasonLines: [], commitmentLine: "", requests: [] };

  const contradictionLines = (assessment?.contradictions ?? []).map((item) => `${item.code} on the ${item.lane} lane. ${item.detail}`);

  const staleLaneLines = (assessment?.staleLanes ?? []).map((item) => `${item.lane}: ${staleLine(item.builtUnder, item.currentRevision)}`);

  const policyLine = snapshot ? `Policy ${snapshot.policy.policyRef}, current revision ${snapshot.policy.currentRevision}.` : "No policy read.";

  const nonClaimsLine =
    "submissionIsApproval false · explanationIsApproval false · approvalIsCommitment false · commitmentIsDrawdown false · disbursed false";

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
                  `Application revision ${state.last.receipt.revision}.`,
                  `Decision after: ${state.last.receipt.decisionAfter}. An accepted request is not a decision.`,
                  `Commitment after: ${state.last.receipt.commitmentAfter}.`,
                  state.last.receipt.drawdownRef === null
                    ? "No drawdown reference. Nothing is disbursed."
                    : `Drawdown request ${state.last.receipt.drawdownRef} recorded. A recorded request is not a disbursement.`,
                ],
        };

  const counters = state.counters;
  const session: OriginationSessionModel = {
    contextLine: `Actor ${state.context.actorRef}, applicant scope ${state.context.scope.applicantRef}, session ${state.context.incarnation}, mode ${state.context.environment}.`,
    countersLine: `Reads ${counters.reads}. Requests ${counters.acts}. Not sent ${counters.notSent}. Reads dropped ${counters.droppedReads}.`,
    earlierUnknownLine:
      state.earlierUnknown === 0
        ? "No unknown outcome left in an earlier scope."
        : `${state.earlierUnknown} unknown outcome(s) left behind in earlier scopes. They are not forgotten and not resolved here.`,
    notComposedLine: ORIGINATION_NOT_COMPOSED_NOTE,
    holdLine: ORIGINATION_HOLD_NOTE,
  };

  return {
    state: screen,
    statusLine: status.statusLine,
    detailLine: status.detailLine,
    actionLabel: status.actionLabel,
    freshnessWord,
    scopeLine: `Tenant ${state.context.scope.tenantId}. Applicant ${state.context.scope.applicantRef}.`,
    watermarkLine: snapshot ? `Watermark ${snapshot.watermark}. Read ${snapshot.snapshotId} on this port.` : "No watermark without a ready read.",
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
      return { text: `${word} not sent. ${fenceText(result.fence)}`, attention: true };
    case "NOT_SENT":
      return { text: `${word} not sent. ${result.detail}`, attention: true };
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
  const port = connectivityPort(creditOriginationPortFor(environment, { scenario }), "credit-origination");
  return { port, controller: connectivityController(new CreditOriginationController(port, { actorRef: ORIGINATION_DESK_ACTOR, applicantRef }), port) };
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
      note(done ? `${moved} A real producer offers no such control. Read again.` : "There is nothing at the synthetic source to move.", done);
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
        note("A request is in flight. The scope cannot change under it.", true);
        return;
      }
      setApplicantRef(next);
      note(
        `Switched the applicant scope to ${context.scope.applicantRef}, session ${context.incarnation}. Rows of the earlier scope are cleared, and a read in flight for it is dropped. Read again.`,
      );
    },
    advanceReview() {
      synthetic("advance-review", "The synthetic source moved the review on: a pending decision becomes approved, or an approval offers a commitment.");
    },
    advancePolicy() {
      synthetic("advance-policy", "The synthetic source moved the policy to a newer revision. Lanes built under an older one stay flagged.");
    },
    withdrawConsent() {
      synthetic("withdraw-consent", "The synthetic source withdrew the credit-assessment consent.");
    },
    expireDocument() {
      synthetic("expire-document", "The synthetic source marked the claim evidence document expired.");
    },
    rivalRequest() {
      synthetic("rival-request", "The synthetic source let a rival request take the shared limit.");
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
      startSession(next, applicantRef, `Started a new synthetic session with scenario ${next}. Earlier reads and requests are gone, as after a reload.`);
    },
    newSession() {
      startSession(scenario, applicantRef, "Started a new synthetic session. Earlier reads and requests are gone, as after a reload. Nothing was resolved at a producer.");
    },
  };

  const session = sessionRef.current;
  return {
    environment,
    scenario,
    applicantRef,
    model: buildOriginationModel({ controller: session.controller, last }),
    actions: connectedActions(actions, ['submit', 'amend', 'provideDocument', 'renewConsent', 'rereview', 'acceptCommitment', 'requestDrawdown', 'advanceReview', 'advancePolicy', 'withdrawConsent', 'expireDocument', 'rivalRequest', 'revokeGrant', 'setScenario', 'newSession'], sessionRef.current?.port),
  };
}
