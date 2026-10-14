/**
 * The marketing benefit journey screen on top of the adapter's synthetic marketing source.
 * Stub scope: the default port is the synthetic source. On integration-http the same
 * port is not-bound: the contract-only catalogue has no eligibility, usage, budget,
 * attribution, apply, or reclaim command, and this module does not invent one, send a
 * second attempt, or switch adapters.
 * This module computes no eligibility, count, budget, discount, or reward. It copies what
 * the controller and the last read hold and says, for every control that is off, why it is off.
 * Discover, apply, reject, and reclaim each keep their own line. There is no aggregate
 * state, and a read never resolves a write whose result is unknown.
 * Consent is consumed as the source reports it. Setting consent and authorizing marketing
 * stay on the consent page, and CRM send is none.
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MARKETING_CONSENT_NOT_POSTED,
  MARKETING_CONTRACT_REGISTER,
  MARKETING_CRM_SCOPE,
  MARKETING_DESK_ACTOR,
  MARKETING_FOREIGN_SUBJECT,
  MARKETING_HOLD_NOT_BOUND,
  MARKETING_LANES,
  MARKETING_NON_CLAIM_FIELDS,
  MARKETING_NOT_BOUND_REASON,
  MARKETING_OWN_SUBJECT,
  MARKETING_RETURN_ACTIONS,
  MARKETING_UNDETERMINED,
  MarketingJourneyController,
  marketingJourneyPortFor,
  projectMarketing,
  type MarketingApplicationProjection,
  type MarketingBenefit,
  type MarketingFence,
  type MarketingIntent,
  type MarketingJourneyPort,
  type MarketingLane,
  type MarketingOrder,
  type MarketingReadState,
  type MarketingRefreshCause,
  type MarketingRejectCode,
  type MarketingReturnAction,
  type MarketingScenario,
  type MarketingStepInput,
  type MarketingStepResult,
  type MarketingSyntheticControl,
  type MarketingVerdict,
} from "@kix/protocol-adapter";
import { protocol } from "./protocol";

export const MARKETING_JOURNEY_TITLE = "Marketing benefit journey (synthetic)";

export const MARKETING_JOURNEY_ROUTE = "/marketing/journey";

export const CONSENT_PAGE_ROUTE = "/marketing/m05";

export const MARKETING_SOURCE_LINE =
  "Benefits, eligibility, usage, budget, attribution, orders, and applications come from a synthetic marketing source on this page load. They are not a producer read and not a catalogue receipt.";

export const MARKETING_BOUNDARY =
  "Discover, apply, rejected, and reclaim are four separate lines. A benefit notice confirms no purchase and pays no reward. An application confirms no purchase, pays no reward, and applies no discount. None of the four completes the next.";

export const MARKETING_NON_CLAIM_NOTE = `Every read and every answer states these seven as false, and a payload that omits one or states it otherwise is refused whole: ${MARKETING_NON_CLAIM_FIELDS.join(", ")}.`;

export const MARKETING_CONSENT_NOTE =
  "Consent is read here as the source reports it. This page does not set consent and does not authorize marketing. Both are posted only on the consent page. After consent is withdrawn, an earlier authorization is not reused: a benefit that needs consent waits for consent to be granted again and for a new authorization at the current consent version.";

export const MARKETING_CRM_NOTE =
  "The full CRM product is the independent M05 scope, and its label stays 미착수. This journey consumes the consent state and nothing else of it. It selects no audience, sends no message (the channel is none), stores no customer profile, and exports no data-use report. A screen with no contract does not complete a CRM product.";

export const MARKETING_ACTOR_NOTE =
  "The actor string and the subject are context labels. They are not an authentication result, and the source decides scope with its own synthetic grant.";

export const MARKETING_FENCE_NOTE =
  "One write is sent at a time per benefit, and each is sent once. This page does not send a write again, does not mint an intent for you, and does not undo one with another.";

export const MARKETING_READ_NOTE =
  "One read follows each settled write so the next step can use fresh evidence. Nothing polls. A read is evidence and never resolves an unknown write. A Simulate control stands in for something a real producer would do, and this page does not see its effect until it reads.";

export const MARKETING_SESSION_NOTE =
  "Intents live in this page load only. A reload or a new synthetic session clears them and resolves nothing at a producer. After a reload an unknown write is not recovered here.";

export const MARKETING_POLICY_NOTE = `Whether a reclaim restores a usage count or a coupon budget is a product policy that is not published. The source states ${MARKETING_UNDETERMINED}, and this page restores and recomputes nothing.`;

export const MARKETING_HOLD_NOTE = `Holding a seat is not available here. ${MARKETING_HOLD_NOT_BOUND.reason}`;

export const MARKETING_NOT_BOUND_BANNER =
  "NOT BOUND. There is no source on integration-http, so no benefit, consent, order, or application is read or written here, and nothing falls back to the synthetic source.";

export const MARKETING_SCENARIO_OFF_NOTE =
  "Scenarios and Simulate events belong to the synthetic source, which is not selected on integration-http. They are off here, and nothing falls back to the synthetic source.";

export const MARKETING_ALT_SUBJECT_NOTE = `Subject ${MARKETING_FOREIGN_SUBJECT} is a subject this desk holds no grant for. Switching to it shows the source's refusal and no row.`;

export const SCENARIO_NOTES: Readonly<Record<MarketingScenario, string>> = {
  clean: "Every step is answered. Consent is granted with a valid authorization, and the membership qualifies for four benefits, one of them with its coupon budget used up.",
  empty: "The source lists no benefit for this subject.",
  stale: "The source serves a watermark older than the floor this page holds.",
  "consent-unset": "No consent is recorded. Benefits that need consent wait for it.",
  "consent-withdrawn": "Consent was withdrawn before the first read. Benefits that need consent are blocked, and the earlier authorization is stale.",
  "authorization-stale": "Consent was granted again after a withdrawal, and the authorization is still the older one. It is not reused.",
  "usage-limit": "One coupon is already used up to the source's own limit by another channel.",
  "attribution-taken": "The referral is already attributed to another referrer.",
  "duplicate-elsewhere": "Another channel applies the same benefit to the same order first, so your apply is rejected as a duplicate.",
  "budget-race": "The coupon budget is used up by someone else between your read and your write.",
  "apply-lost": "An apply is recorded and its answer is lost.",
  "reclaim-lost": "A reclaim is recorded and its answer is lost.",
  "held-response": "Answers are held until you deliver them. Use it to switch the session while a write is in flight.",
  "receipt-claims-reward": "The source records an apply and then answers that a reward was paid. The answer is not trusted.",
  "snapshot-claims-crm": "The source answers a read that claims the CRM product is complete. The whole payload is refused.",
  "scope-leak": "The source sends a row that belongs to another subject. The whole payload is refused.",
  denied: "The synthetic grant is withdrawn at the source.",
};

export const CONTROL_LABELS: Readonly<Record<Exclude<MarketingSyntheticControl, "cancel-order" | "refund-order">, string>> = {
  "withdraw-consent": "Simulate: the fan withdraws consent on the consent page",
  "grant-consent": "Simulate: the fan grants consent again on the consent page",
  "authorize-marketing": "Simulate: a new authorization is recorded at the current consent version",
  "lapse-eligibility": "Simulate: the membership tier lapses",
};

const STEP_WORDS = { apply: "Apply", reclaim: "Reclaim" } as const;

const KIND_WORDS = { presale: "Presale (M02)", coupon: "Coupon (M03)", referral: "Referral (M04)" } as const;

export type MarketingScreenState =
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
  lane: MarketingLane;
  label: string;
  line: string;
  count: number | null;
}

export interface BenefitOrderModel {
  orderRef: string;
  label: string;
  orderStateWord: string;
  apply: ControlModel;
  /** The application of this benefit on this order, if the last read lists one that is not reclaimed. */
  applicationRef: string | null;
}

export interface BenefitModel {
  benefitRef: string;
  kind: MarketingBenefit["kind"];
  kindWord: string;
  title: string;
  rankLine: string;
  verdict: MarketingVerdict;
  verdictLine: string;
  consentLine: string;
  usageLine: string;
  budgetLine: string | null;
  budgetState: string | null;
  attributionLine: string | null;
  orders: BenefitOrderModel[];
}

export interface OrderModel {
  orderRef: string;
  label: string;
  state: MarketingOrder["state"];
  stateLine: string;
  cancel: ControlModel;
  refund: ControlModel;
}

export interface ApplicationModel {
  applicationRef: string;
  benefitRef: string;
  orderRef: string;
  state: MarketingApplicationProjection["state"];
  stateLine: string;
  dueLine: string;
  channelLine: string;
  linkLine: string;
  consentLine: string;
  restorationLine: string;
  consentWithdrawnSince: boolean;
  reclaim: ControlModel;
}

export interface ConsentModel {
  stateWord: string;
  state: string;
  versionLine: string;
  authorizationLine: string;
  authorization: string;
  purposeLine: string;
  membershipLine: string;
}

export interface RejectionModel {
  intentRef: string;
  stepWord: string;
  target: string;
  code: string;
  returnAction: MarketingReturnAction;
  returnLine: string;
  detail: string;
}

export interface IntentRow {
  seq: number;
  intentRef: string;
  stepWord: string;
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

export interface CrmRowModel {
  id: string;
  scope: "consumed" | "outside-this-journey";
  scopeWord: string;
  reason: string;
}

export type LastAction =
  | { seq: number; kind: "step"; step: MarketingStepInput["step"]; result: MarketingStepResult }
  | { seq: number; kind: "note"; text: string; attention: boolean };

export interface MarketingJourneyModel {
  state: MarketingScreenState;
  statusLine: string;
  detailLine: string;
  /** Label of the one return action of the status, or null. */
  actionLabel: string | null;
  freshnessWord: string;
  lanes: LaneModel[];
  consent: ConsentModel | null;
  benefits: BenefitModel[];
  orders: OrderModel[];
  applications: ApplicationModel[];
  rejections: RejectionModel[];
  session: SessionModel;
  register: RegisterRowModel[];
  crm: CrmRowModel[];
  consentNotPosted: { action: string; reason: string }[];
  subjectRef: string;
  lastLine: string | null;
  /** True when the last action asks for attention (a block, a rejection, an unknown result, a refused read). */
  lastNeedsFocus: boolean;
  /** Sequence of the last action, so a repeated message still moves focus. */
  lastSeq: number | null;
}

export function causeLine(cause: MarketingRefreshCause): string {
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

export const VERDICT_LINES: Readonly<Record<MarketingVerdict, string>> = {
  eligible: "The source says this subject is eligible for this benefit.",
  "not-eligible": "The source says the membership does not qualify for this benefit.",
  "consent-required": "The source has no consent for this subject. This benefit needs marketing consent.",
  "consent-withdrawn": "Consent was withdrawn. The earlier authorization is not reused, and this benefit waits for consent and a new authorization.",
  "authorization-stale": "The authorization was issued at an older consent version. It is not reused, and a new authorization is needed.",
  "usage-limit-reached": "The source says this benefit reached the usage it allows.",
  "budget-exhausted": "The source says the coupon budget is exhausted.",
  "attribution-taken": "The source says this subject is already attributed to another referrer.",
};

/** The one thing the page offers for a rejection. There is no other. */
export function returnActionLine(action: MarketingReturnAction): string {
  switch (action) {
    case "read-again":
      return "Read again to see what the source holds now.";
    case "manage-consent":
      return "Consent and authorization are managed on the consent page, not here.";
    case "none":
      return "Nothing on this page corrects it. The source decides.";
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

/** Why a write is off. Each fence maps to one sentence and no fence is a failure of the page. */
export function fenceLine(fence: MarketingFence): string {
  switch (fence.reason) {
    case "in-flight":
      return `Another write on this benefit is in flight (${fence.intentRef}). Wait for its answer.`;
    case "unknown-outcome": {
      const earlier = fence.earlierContext ? " It was sent in an earlier session context." : "";
      return `An earlier write on this benefit has an unknown result (${fence.intentRef}).${earlier} Writes on this benefit stay blocked. A read does not resolve it.`;
    }
    case "no-snapshot":
      return "Read the benefits first.";
    case "snapshot-stale":
      return `Read again before the next write. ${causeLine(fence.cause)}`;
    case "duplicate-intent":
      return `Intent ${fence.intentRef} was already used. This page does not send the same intent twice.`;
    case "not-listed":
      return `${fence.ref} is not in the last read.`;
    case "verdict-blocked":
      return `The last read says ${fence.verdict}. ${VERDICT_LINES[fence.verdict]}`;
    case "order-closed":
      return `Order ${fence.orderRef} is ${fence.state} at the order source, so no benefit applies to it.`;
    case "already-applied":
      return `This benefit is already applied to this order (${fence.applicationRef}).`;
    case "not-reclaimable":
      return `Application ${fence.applicationRef} is already reclaimed.`;
    case "not-bound":
      return MARKETING_NOT_BOUND_REASON;
    default: {
      const exhaustive: never = fence;
      return exhaustive;
    }
  }
}

export function stepResultLine(step: MarketingStepInput["step"], result: MarketingStepResult): string {
  const word = STEP_WORDS[step];
  switch (result.kind) {
    case "CONFIRMED":
      return step === "apply"
        ? `Apply recorded by the synthetic source${result.intent.receipt ? ` as ${result.intent.receipt.applicationRef}` : ""}. It confirms no purchase, pays no reward, and applies no discount. This is not a protocol receipt.`
        : `Reclaim recorded by the synthetic source. Whether a usage count or a budget is restored is ${MARKETING_UNDETERMINED}, and this page restores nothing. This is not a protocol receipt.`;
    case "REJECTED": {
      const action = returnActionLine(MARKETING_RETURN_ACTIONS[result.intent.code as MarketingRejectCode] ?? "read-again");
      return `${word} rejected (${result.intent.code ?? "no code"}). ${result.intent.message ?? ""} The source applied nothing for this write. ${action}`.replace(/\s+/g, " ").trim();
    }
    case "UNKNOWN":
      return `${word} result unknown (${result.intent.code ?? "no code"}). It may or may not have applied. Writes on this benefit are blocked, and a read does not resolve it.`;
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

function attentionFor(last: LastAction | null): boolean {
  if (last === null) {
    return false;
  }
  if (last.kind === "note") {
    return last.attention;
  }
  return last.result.kind !== "CONFIRMED";
}

function control(fence: MarketingFence | null): ControlModel {
  return fence === null ? { enabled: true, reason: null } : { enabled: false, reason: fenceLine(fence) };
}

function readStateToScreen(readState: MarketingReadState, refreshRequired: MarketingRefreshCause | null): MarketingScreenState {
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
  state: MarketingScreenState,
  detail: string | null,
  code: string | null,
): { statusLine: string; detailLine: string; actionLabel: string | null } {
  const coded = code ? ` (${code})` : "";
  switch (state) {
    case "loading":
      return { statusLine: "Reading the synthetic marketing source. Nothing is applied yet.", detailLine: "", actionLabel: null };
    case "unread":
      return {
        statusLine: "The session context changed, so there is no read in this context.",
        detailLine: "Read again to see the benefits from this context. An earlier unknown write on a benefit still blocks that benefit.",
        actionLabel: "Read again",
      };
    case "ready":
      return { statusLine: "Benefits read.", detailLine: "", actionLabel: null };
    case "empty":
      return { statusLine: "No benefit is listed for this subject in this read.", detailLine: "Nothing can be applied or reclaimed.", actionLabel: "Read again" };
    case "stale":
      return { statusLine: "Stale benefits read.", detailLine: detail ?? "", actionLabel: "Read again" };
    case "denied":
      return {
        statusLine: `The source refused this actor and subject${coded}. No benefit, no application, and no request is accepted.`,
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
      return { statusLine: MARKETING_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: "The pin tuple changed. Nothing was read and nothing was applied.",
        detailLine: detail ?? "",
        actionLabel: "Start a new synthetic session",
      };
    case "unavailable":
      return { statusLine: "The source did not answer. This is not an empty benefit list.", detailLine: detail ?? "", actionLabel: "Read again" };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function describeBenefit(benefit: MarketingBenefit): Omit<BenefitModel, "orders"> {
  const budget = benefit.budget;
  const attribution = benefit.attribution;
  return {
    benefitRef: benefit.benefitRef,
    kind: benefit.kind,
    kindWord: KIND_WORDS[benefit.kind],
    title: benefit.title,
    rankLine: `Source priority rank ${benefit.priorityRank}. The source's own order. This page decides nothing from it.`,
    verdict: benefit.verdict,
    verdictLine: VERDICT_LINES[benefit.verdict],
    consentLine: benefit.requiresConsent ? "Needs marketing consent and a valid authorization." : "Needs no marketing consent.",
    usageLine: `Usage recorded ${benefit.usage.recorded}. Usage allowed ${benefit.usage.allowed === null ? "no limit stated" : benefit.usage.allowed}. The source's own figures, never added or subtracted here.`,
    budgetLine:
      budget === null
        ? null
        : `Budget in ${budget.unit}s: committed ${budget.committed}, limit ${budget.limit}, ${budget.state}. It carries no amount. The source's own figures, never added or subtracted here.`,
    budgetState: budget === null ? null : budget.state,
    attributionLine:
      attribution === null
        ? null
        : `Referrer ${attribution.referrerRef}: ${attribution.state}. An attribution records who referred. It pays no reward.`,
  };
}

function orderStateLine(order: MarketingOrder): string {
  switch (order.state) {
    case "open":
      return "Open at the order source. A benefit can be applied to it.";
    case "cancelled":
      return "Cancelled at the order source. This journey did not cancel it, and no benefit can be applied to it.";
    case "refund-observed":
      return "A refund was observed at the order source. This journey issued none, and no benefit can be applied to it.";
    default: {
      const exhaustive: never = order.state;
      return exhaustive;
    }
  }
}

function describeApplication(application: MarketingApplicationProjection, reclaim: ControlModel): ApplicationModel {
  let dueLine = "Not due for reclaim.";
  if (application.state === "reclaim-due") {
    dueLine =
      application.dueReason === "refund-observed"
        ? "Due for reclaim: a refund was observed for the order. Nothing was reclaimed or refunded by that."
        : "Due for reclaim: the order was cancelled. Nothing was reclaimed by that.";
  } else if (application.state === "reclaimed") {
    dueLine = "Reclaimed at the source.";
  }
  return {
    applicationRef: application.applicationRef,
    benefitRef: application.benefitRef,
    orderRef: application.orderRef,
    state: application.state,
    stateLine:
      application.state === "applied"
        ? "Applied. It confirms no purchase, pays no reward, and applies no discount."
        : application.state === "reclaim-due"
          ? "Applied and due for reclaim. It confirmed no purchase and applied no discount."
          : "Reclaimed.",
    dueLine,
    channelLine: application.channel === "this-desk" ? "Applied from this desk." : "Applied by another channel.",
    linkLine: application.linked
      ? "Named by a confirmed apply of this page."
      : "Observed only. It is not named by a confirmed apply of this page, and this page does not claim it.",
    consentLine:
      application.consentVersion === null
        ? "Relied on no consent."
        : application.consentWithdrawnSince
          ? `Relied on consent version ${application.consentVersion}, and consent was withdrawn afterwards. Whether it must be reclaimed is ${MARKETING_UNDETERMINED}. This page does not reclaim it, and only a new apply is blocked.`
          : `Relied on consent version ${application.consentVersion}.`,
    restorationLine: `Usage and budget restoration on reclaim: ${application.usageRestoration}.`,
    consentWithdrawnSince: application.consentWithdrawnSince,
    reclaim,
  };
}

/** The unused-intent id the gate preview asks with. It is never sent. */
const GATE_PREVIEW = "gate-preview";

export function buildMarketingJourneyModel(input: {
  controller: MarketingJourneyController;
  environment: "stub" | "integration-http";
  last: LastAction | null;
}): MarketingJourneyModel {
  const { controller } = input;
  const state = controller.state();
  const screen = readStateToScreen(state.readState, state.refreshRequired);
  const status = statusFor(screen, state.readDetail, state.readCode);
  const projection = projectMarketing(state);
  const freshnessWord =
    state.freshness === "CURRENT"
      ? "The last read is current."
      : state.freshness === "STALE"
        ? "The last read is behind."
        : "There is no usable read.";

  const benefits: BenefitModel[] = projection.benefits.map((item) => ({
    ...describeBenefit(item.benefit),
    orders: projection.orders.map((order): BenefitOrderModel => {
      const live = item.applications.find((application) => application.orderRef === order.orderRef && application.state !== "reclaimed");
      return {
        orderRef: order.orderRef,
        label: order.label,
        orderStateWord: order.state,
        apply: control(controller.gateFor({ step: "apply", intentRef: GATE_PREVIEW, benefitRef: item.benefit.benefitRef, orderRef: order.orderRef })),
        applicationRef: live ? live.applicationRef : null,
      };
    }),
  }));

  const simulated = input.environment === "stub";
  const orders: OrderModel[] = projection.orders.map((order) => ({
    orderRef: order.orderRef,
    label: order.label,
    state: order.state,
    stateLine: orderStateLine(order),
    cancel: simulated && order.state === "open" ? { enabled: true, reason: null } : { enabled: false, reason: `Order ${order.orderRef} is ${order.state}.` },
    refund: simulated && order.state !== "refund-observed" ? { enabled: true, reason: null } : { enabled: false, reason: `Order ${order.orderRef} is ${order.state}.` },
  }));

  const applications = projection.applications.map((application) =>
    describeApplication(application, control(controller.gateFor({ step: "reclaim", intentRef: GATE_PREVIEW, applicationRef: application.applicationRef }))),
  );

  const rejections: RejectionModel[] = projection.rejections.map((row) => ({
    intentRef: row.intentRef,
    stepWord: STEP_WORDS[row.step],
    target: row.orderRef ? `${row.benefitRef} on ${row.orderRef}` : row.benefitRef,
    code: row.code,
    returnAction: row.returnAction,
    returnLine: returnActionLine(row.returnAction),
    detail: row.detail,
  }));

  const consentView = projection.consent;
  const membership = projection.membership;
  const consent: ConsentModel | null =
    consentView === null
      ? null
      : {
          stateWord: consentView.state,
          state: consentView.state,
          versionLine: `Consent version ${consentView.version}, as the source reports it. Copied, never raised here.`,
          authorizationLine:
            consentView.authorization.state === "valid"
              ? `Authorization is valid at consent version ${String(consentView.authorization.atVersion)}.`
              : consentView.authorization.state === "stale"
                ? `Authorization is stale: it was issued at consent version ${String(consentView.authorization.atVersion)}, which is not the current version. It is not reused.`
                : "No authorization exists.",
          authorization: consentView.authorization.state,
          purposeLine: `Purpose ${consentView.purpose}. Channel ${consentView.channel}: nothing is sent.`,
          membershipLine: membership
            ? `Membership tier ${membership.tier} at version ${membership.version}. The eligibility basis, copied from the source and never raised here.`
            : "No membership read.",
        };

  const lanes: LaneModel[] = MARKETING_LANES.map((lane): LaneModel => {
    switch (lane) {
      case "discover":
        return {
          lane,
          label: "Discover",
          count: screen === "ready" ? benefits.length : null,
          line:
            screen === "ready"
              ? `The source lists ${benefits.length} benefits and ${orders.length} orders. A listed benefit is not an applied benefit.`
              : screen === "empty"
                ? "The source lists no benefit."
                : "No benefit is shown. See the status.",
        };
      case "apply": {
        const confirmed = state.intents.filter((intent) => intent.step === "apply" && intent.outcome === "CONFIRMED").length;
        const unknown = state.intents.filter((intent) => intent.step === "apply" && (intent.outcome === "UNKNOWN" || intent.outcome === "IN_FLIGHT")).length;
        return {
          lane,
          label: "Apply",
          count: confirmed,
          line: `${confirmed} apply recorded by this page, ${unknown} with no known result. An application confirms no purchase, pays no reward, and applies no discount.`,
        };
      }
      case "reject":
        return {
          lane,
          label: "Rejected",
          count: rejections.length,
          line: `${rejections.length} write rejected by the source. Each names its code and the one thing offered next.`,
        };
      case "reclaim": {
        const due = applications.filter((application) => application.state === "reclaim-due").length;
        const done = applications.filter((application) => application.state === "reclaimed").length;
        return {
          lane,
          label: "Reclaim",
          count: applications.filter((application) => application.state !== "applied").length,
          line: `${due} due for reclaim, ${done} reclaimed. ${MARKETING_POLICY_NOTE}`,
        };
      }
      default: {
        const exhaustive: never = lane;
        return exhaustive;
      }
    }
  });

  const intents: IntentRow[] = state.intents.map((intent: MarketingIntent) => ({
    seq: intent.seq,
    intentRef: intent.intentRef,
    stepWord: STEP_WORDS[intent.step],
    targetRef: intent.applicationRef ?? `${intent.benefitRef} on ${intent.orderRef ?? "none"}`,
    outcome: intent.outcome,
    code: intent.code ?? "",
  }));
  const quarantineLines = state.quarantined.map(
    (item) => `Result ${item.arrived} for ${item.intentRef} was quarantined (${item.cause}). It changed nothing.`,
  );
  const unlinkedLines = projection.unlinkedIntents.map(
    (intent) =>
      `${STEP_WORDS[intent.step]} ${intent.intentRef} on ${intent.benefitRef} is ${intent.outcome.toLowerCase().replace("_", " ")}. No application is claimed for it, and an application seen in a read is not claimed for it.`,
  );
  const counters = state.counters;
  const session: SessionModel = {
    contextLine: `Actor ${state.context.actorRef}, subject ${state.context.subjectRef}, session ${state.context.incarnation}, mode ${state.context.environment}.`,
    countersLine: `Sent ${counters.sent}. Blocked before sending ${counters.fenced}. Not sent ${counters.notSent}. Reads dropped ${counters.droppedReads}.`,
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
    consent,
    benefits,
    orders,
    applications,
    rejections,
    session,
    register: MARKETING_CONTRACT_REGISTER.map((row) => ({
      id: row.id,
      field: row.marketingField,
      status: row.status,
      statusWord: row.status === "field-named" ? "Field named in the pin" : "Not-bound",
      bodyFields: row.bodyFields.length === 0 ? "none" : row.bodyFields.map((entry) => `${entry.action}.${entry.field}`).join(", "),
      reason: row.reason,
    })),
    crm: MARKETING_CRM_SCOPE.map((row) => ({
      id: row.id,
      scope: row.scope,
      scopeWord: row.scope === "consumed" ? "Consumed: read only" : "Outside this journey: not built here",
      reason: row.reason,
    })),
    consentNotPosted: MARKETING_CONSENT_NOT_POSTED.map((row) => ({ action: row.action, reason: row.reason })),
    subjectRef: state.context.subjectRef,
    lastLine,
    lastNeedsFocus: attentionFor(input.last),
    lastSeq: input.last === null ? null : input.last.seq,
  };
}

export interface MarketingJourneyActions {
  refresh(): void;
  apply(benefitRef: string, orderRef: string): void;
  reclaim(applicationRef: string): void;
  setScenario(next: MarketingScenario): void;
  deliverHeld(): void;
  switchScope(): void;
  newSession(): void;
  simulate(control: MarketingSyntheticControl, orderRef?: string): void;
}

interface Session {
  port: MarketingJourneyPort;
  controller: MarketingJourneyController;
}

function createSession(environment: "stub" | "integration-http", scenario: MarketingScenario): Session {
  const port = marketingJourneyPortFor(environment, { scenario });
  return {
    port,
    controller: new MarketingJourneyController(port, { actorRef: MARKETING_DESK_ACTOR, subjectRef: MARKETING_OWN_SUBJECT }),
  };
}

const ATTENTION_READS: readonly MarketingReadState[] = ["stale", "denied", "refused", "unavailable", "tuple-changed"];

export function useMarketingJourney(): {
  environment: "stub" | "integration-http";
  scenario: MarketingScenario;
  model: MarketingJourneyModel;
  heldSupported: boolean;
  actions: MarketingJourneyActions;
} {
  const environment = protocol.describe().environment;
  const sessionRef = useRef<Session | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createSession(environment, "clean");
  }
  const [scenario, setScenarioState] = useState<MarketingScenario>("clean");
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
        note(`The read ended as ${result.readState}${state.readCode ? ` (${state.readCode})` : ""}. No benefit is shown from it.`, true);
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
    async (input: MarketingStepInput) => {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const result = await session.controller.run(input);
      if (sessionRef.current !== session) {
        return;
      }
      actionSeq.current += 1;
      setLast({ seq: actionSeq.current, kind: "step", step: input.step, result });
      // A quarantined result belongs to a context this page left, so it has nothing to read again.
      if (result.kind === "CONFIRMED" || result.kind === "REJECTED" || result.kind === "UNKNOWN") {
        await session.controller.refresh();
      }
    },
    [],
  );

  const startSession = useCallback(
    (next: MarketingScenario, text: string) => {
      sessionRef.current = createSession(environment, next);
      intentCounter.current = 0;
      setScenarioState(next);
      setEpoch((value) => value + 1);
      note(text);
    },
    [environment, note],
  );

  const actions: MarketingJourneyActions = {
    refresh() {
      const session = sessionRef.current;
      if (session !== null) {
        void read(session);
      }
    },
    apply(benefitRef, orderRef) {
      void run({ step: "apply", intentRef: nextIntent(), benefitRef, orderRef });
    },
    reclaim(applicationRef) {
      void run({ step: "reclaim", intentRef: nextIntent(), applicationRef });
    },
    setScenario(next) {
      if (environment !== "stub") {
        note(MARKETING_SCENARIO_OFF_NOTE);
        return;
      }
      startSession(next, `Started a new synthetic session with scenario ${next}. Earlier intents are gone, as after a reload.`);
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
      const current = session.controller.state().context.subjectRef;
      const next = session.controller.switchContext({ subjectRef: current === MARKETING_OWN_SUBJECT ? MARKETING_FOREIGN_SUBJECT : MARKETING_OWN_SUBJECT });
      note(`Subject scope switched to ${next.subjectRef}, session ${next.incarnation}. A write in flight is now unknown and its result will be quarantined.`);
      void read(session);
    },
    newSession() {
      startSession(scenario, "Started a new synthetic session. Earlier intents are gone, as after a reload. Nothing was resolved at a producer.");
    },
    simulate(controlName, orderRef) {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const result = session.port.simulate({ control: controlName, orderRef });
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
    model: buildMarketingJourneyModel({ controller: session.controller, environment, last }),
    heldSupported: scenario === "held-response",
    actions,
  };
}
