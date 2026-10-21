import { messages as sourceCopy } from "./i18n/messages/marketing-journey";
import { sourceMessage } from "./i18n/source-message";
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

export const MARKETING_JOURNEY_TITLE = sourceCopy.en["srv"];

export const MARKETING_JOURNEY_ROUTE = "/marketing/journey";

export const CONSENT_PAGE_ROUTE = "/marketing/m05";

export const MARKETING_SOURCE_LINE =
  sourceCopy.en["s9x"];

export const MARKETING_BOUNDARY =
  sourceCopy.en["sgo"];

export const MARKETING_NON_CLAIM_NOTE = sourceMessage(sourceCopy.en["p.t80"], { v1: MARKETING_NON_CLAIM_FIELDS.join(", ") });

export const MARKETING_CONSENT_NOTE =
  sourceCopy.en["sdw"];

export const MARKETING_CRM_NOTE =
  "The full CRM product is the independent M05 scope, and its label stays 미착수. This journey consumes the consent state and nothing else of it. It selects no audience, sends no message (the channel is none), stores no customer profile, and exports no data-use report. A screen with no contract does not complete a CRM product.";

export const MARKETING_ACTOR_NOTE =
  sourceCopy.en["s1pv"];

export const MARKETING_FENCE_NOTE =
  sourceCopy.en["s14l"];

export const MARKETING_READ_NOTE =
  sourceCopy.en["s14d"];

export const MARKETING_SESSION_NOTE =
  sourceCopy.en["sog"];

export const MARKETING_POLICY_NOTE = sourceMessage(sourceCopy.en["p.t257"], { v1: MARKETING_UNDETERMINED });

export const MARKETING_HOLD_NOTE = sourceMessage(sourceCopy.en["p.t8"], { v1: MARKETING_HOLD_NOT_BOUND.reason });

export const MARKETING_NOT_BOUND_BANNER =
  sourceCopy.en["s10f"];

export const MARKETING_SCENARIO_OFF_NOTE =
  sourceCopy.en["s1id"];

export const MARKETING_ALT_SUBJECT_NOTE = sourceMessage(sourceCopy.en["p.t258"], { v1: MARKETING_FOREIGN_SUBJECT });

export const SCENARIO_NOTES: Readonly<Record<MarketingScenario, string>> = {
  clean: sourceCopy.en["sjq"],
  empty: sourceCopy.en["s1zq"],
  stale: sourceCopy.en["s21a"],
  "consent-unset": sourceCopy.en["suw"],
  "consent-withdrawn": sourceCopy.en["se1"],
  "authorization-stale": sourceCopy.en["se0"],
  "usage-limit": sourceCopy.en["s149"],
  "attribution-taken": sourceCopy.en["s1wi"],
  "duplicate-elsewhere": sourceCopy.en["s4j"],
  "budget-race": sourceCopy.en["s1r8"],
  "apply-lost": sourceCopy.en["s3e"],
  "reclaim-lost": sourceCopy.en["s6h"],
  "held-response": sourceCopy.en["s4o"],
  "receipt-claims-reward": sourceCopy.en["s209"],
  "snapshot-claims-crm": sourceCopy.en["s1ya"],
  "scope-leak": sourceCopy.en["s217"],
  denied: sourceCopy.en["s21t"],
};

export const CONTROL_LABELS: Readonly<Record<Exclude<MarketingSyntheticControl, "cancel-order" | "refund-order">, string>> = {
  "withdraw-consent": sourceCopy.en["s1ku"],
  "grant-consent": sourceCopy.en["s1kt"],
  "authorize-marketing": sourceCopy.en["s1ke"],
  "lapse-eligibility": sourceCopy.en["s1kv"],
};

const STEP_WORDS = { apply: sourceCopy.en["s5j"], reclaim: sourceCopy.en["s1dj"] } as const;

const KIND_WORDS = { presale: sourceCopy.en["s18t"], coupon: sourceCopy.en["sep"], referral: sourceCopy.en["s1ee"] } as const;

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

export const VERDICT_LINES: Readonly<Record<MarketingVerdict, string>> = {
  eligible: sourceCopy.en["s20n"],
  "not-eligible": sourceCopy.en["s20l"],
  "consent-required": sourceCopy.en["s1ze"],
  "consent-withdrawn": sourceCopy.en["se2"],
  "authorization-stale": sourceCopy.en["s1qe"],
  "usage-limit-reached": sourceCopy.en["s20m"],
  "budget-exhausted": sourceCopy.en["s20k"],
  "attribution-taken": sourceCopy.en["s20o"],
};

/** The one thing the page offers for a rejection. There is no other. */
export function returnActionLine(action: MarketingReturnAction): string {
  switch (action) {
    case "read-again":
      return sourceCopy.en["s1b5"];
    case "manage-consent":
      return sourceCopy.en["sdp"];
    case "none":
      return sourceCopy.en["s11b"];
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
      return sourceMessage(sourceCopy.en["p.t259"], { v1: fence.intentRef });
    case "unknown-outcome": {
      const earlier = fence.earlierContext ? " It was sent in an earlier session context." : "";
      return sourceMessage(sourceCopy.en["p.t260"], { v1: fence.intentRef, v2: earlier });
    }
    case "no-snapshot":
      return sourceCopy.en["s1cc"];
    case "snapshot-stale":
      return sourceMessage(sourceCopy.en["p.t86"], { v1: causeLine(fence.cause) });
    case "duplicate-intent":
      return sourceMessage(sourceCopy.en["p.t87"], { v1: fence.intentRef });
    case "not-listed":
      return sourceMessage(sourceCopy.en["p.t91"], { v1: fence.ref });
    case "verdict-blocked":
      return sourceMessage(sourceCopy.en["p.t261"], { v1: fence.verdict, v2: VERDICT_LINES[fence.verdict] });
    case "order-closed":
      return sourceMessage(sourceCopy.en["p.t262"], { v1: fence.orderRef, v2: fence.state });
    case "already-applied":
      return sourceMessage(sourceCopy.en["p.t263"], { v1: fence.applicationRef });
    case "not-reclaimable":
      return sourceMessage(sourceCopy.en["p.t264"], { v1: fence.applicationRef });
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
        ? sourceMessage(sourceCopy.en["p.t265"], { v1: result.intent.receipt ? ` as ${result.intent.receipt.applicationRef}` : "" })
        : sourceMessage(sourceCopy.en["p.t266"], { v1: MARKETING_UNDETERMINED });
    case "REJECTED": {
      const action = returnActionLine(MARKETING_RETURN_ACTIONS[result.intent.code as MarketingRejectCode] ?? "read-again");
      return sourceMessage(sourceCopy.en["p.t100"], { v1: word, v2: result.intent.code ?? "no code", v3: result.intent.message ?? "", v4: action }).replace(/\s+/g, " ").trim();
    }
    case "UNKNOWN":
      return sourceMessage(sourceCopy.en["p.t267"], { v1: word, v2: result.intent.code ?? "no code" });
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
      return { statusLine: sourceCopy.en["s1bh"], detailLine: "", actionLabel: null };
    case "unread":
      return {
        statusLine: sourceCopy.en["s1xx"],
        detailLine: sourceCopy.en["s1ay"],
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "ready":
      return { statusLine: sourceCopy.en["s9z"], detailLine: "", actionLabel: null };
    case "empty":
      return { statusLine: sourceCopy.en["sua"], detailLine: sourceCopy.en["s111"], actionLabel: sourceCopy.en["s1ax"] };
    case "stale":
      return { statusLine: sourceCopy.en["s1lj"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    case "denied":
      return {
        statusLine: sourceMessage(sourceCopy.en["p.t268"], { v1: coded }),
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
      return { statusLine: MARKETING_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: sourceCopy.en["s1v8"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1m2"],
      };
    case "unavailable":
      return { statusLine: sourceCopy.en["s1z4"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
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
    rankLine: sourceMessage(sourceCopy.en["p.t269"], { v1: benefit.priorityRank }),
    verdict: benefit.verdict,
    verdictLine: VERDICT_LINES[benefit.verdict],
    consentLine: benefit.requiresConsent ? sourceCopy.en["stk"] : sourceCopy.en["stl"],
    usageLine: sourceMessage(sourceCopy.en["p.t270"], { v1: benefit.usage.recorded, v2: benefit.usage.allowed === null ? "no limit stated" : benefit.usage.allowed }),
    budgetLine:
      budget === null
        ? null
        : sourceMessage(sourceCopy.en["p.t271"], { v1: budget.unit, v2: budget.committed, v3: budget.limit, v4: budget.state }),
    budgetState: budget === null ? null : budget.state,
    attributionLine:
      attribution === null
        ? null
        : sourceMessage(sourceCopy.en["p.t272"], { v1: attribution.referrerRef, v2: attribution.state }),
  };
}

function orderStateLine(order: MarketingOrder): string {
  switch (order.state) {
    case "open":
      return sourceCopy.en["s14z"];
    case "cancelled":
      return sourceCopy.en["sb2"];
    case "refund-observed":
      return sourceCopy.en["s6p"];
    default: {
      const exhaustive: never = order.state;
      return exhaustive;
    }
  }
}

function describeApplication(application: MarketingApplicationProjection, reclaim: ControlModel): ApplicationModel {
  let dueLine: string = sourceCopy.en["s10p"];
  if (application.state === "reclaim-due") {
    dueLine =
      application.dueReason === "refund-observed"
        ? sourceCopy.en["shk"]
        : sourceCopy.en["shl"];
  } else if (application.state === "reclaimed") {
    dueLine = sourceCopy.en["s1dm"];
  }
  return {
    applicationRef: application.applicationRef,
    benefitRef: application.benefitRef,
    orderRef: application.orderRef,
    state: application.state,
    stateLine:
      application.state === "applied"
        ? sourceCopy.en["s5i"]
        : application.state === "reclaim-due"
          ? sourceCopy.en["s5c"]
          : sourceCopy.en["s1dl"],
    dueLine,
    channelLine: application.channel === "this-desk" ? sourceCopy.en["s5h"] : sourceCopy.en["s5f"],
    linkLine: application.linked
      ? sourceCopy.en["stf"]
      : sourceCopy.en["s13q"],
    consentLine:
      application.consentVersion === null
        ? sourceCopy.en["s1fa"]
        : application.consentWithdrawnSince
          ? sourceMessage(sourceCopy.en["p.t273"], { v1: application.consentVersion, v2: MARKETING_UNDETERMINED })
          : sourceMessage(sourceCopy.en["p.t274"], { v1: application.consentVersion }),
    restorationLine: sourceMessage(sourceCopy.en["p.t275"], { v1: application.usageRestoration }),
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
      ? sourceCopy.en["s1tn"]
      : state.freshness === "STALE"
        ? sourceCopy.en["s1ti"]
        : sourceCopy.en["s1wv"];

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
    cancel: simulated && order.state === "open" ? { enabled: true, reason: null } : { enabled: false, reason: sourceMessage(sourceCopy.en["p.t538"], { v1: order.orderRef, v2: order.state }) },
    refund: simulated && order.state !== "refund-observed" ? { enabled: true, reason: null } : { enabled: false, reason: sourceMessage(sourceCopy.en["p.t538"], { v1: order.orderRef, v2: order.state }) },
  }));

  const applications = projection.applications.map((application) =>
    describeApplication(application, control(controller.gateFor({ step: "reclaim", intentRef: GATE_PREVIEW, applicationRef: application.applicationRef }))),
  );

  const rejections: RejectionModel[] = projection.rejections.map((row) => ({
    intentRef: row.intentRef,
    stepWord: STEP_WORDS[row.step],
    target: row.orderRef ? sourceMessage(sourceCopy.en["p.t539"], { v1: row.benefitRef, v2: row.orderRef }) : row.benefitRef,
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
          versionLine: sourceMessage(sourceCopy.en["p.t276"], { v1: consentView.version }),
          authorizationLine:
            consentView.authorization.state === "valid"
              ? sourceMessage(sourceCopy.en["p.t277"], { v1: String(consentView.authorization.atVersion) })
              : consentView.authorization.state === "stale"
                ? sourceMessage(sourceCopy.en["p.t278"], { v1: String(consentView.authorization.atVersion) })
                : sourceCopy.en["su8"],
          authorization: consentView.authorization.state,
          purposeLine: sourceMessage(sourceCopy.en["p.t279"], { v1: consentView.purpose, v2: consentView.channel }),
          membershipLine: membership
            ? sourceMessage(sourceCopy.en["p.t280"], { v1: membership.tier, v2: membership.version })
            : sourceCopy.en["sw5"],
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
              ? sourceMessage(sourceCopy.en["p.t281"], { v1: benefits.length, v2: orders.length })
              : screen === "empty"
                ? sourceCopy.en["s1zp"]
                : sourceCopy.en["suc"],
        };
      case "apply": {
        const confirmed = state.intents.filter((intent) => intent.step === "apply" && intent.outcome === "CONFIRMED").length;
        const unknown = state.intents.filter((intent) => intent.step === "apply" && (intent.outcome === "UNKNOWN" || intent.outcome === "IN_FLIGHT")).length;
        return {
          lane,
          label: sourceCopy.en["s5j"],
          count: confirmed,
          line: sourceMessage(sourceCopy.en["p.t282"], { v1: confirmed, v2: unknown }),
        };
      }
      case "reject":
        return {
          lane,
          label: sourceCopy.en["s1ew"],
          count: rejections.length,
          line: sourceMessage(sourceCopy.en["p.t283"], { v1: rejections.length }),
        };
      case "reclaim": {
        const due = applications.filter((application) => application.state === "reclaim-due").length;
        const done = applications.filter((application) => application.state === "reclaimed").length;
        return {
          lane,
          label: sourceCopy.en["s1dj"],
          count: applications.filter((application) => application.state !== "applied").length,
          line: sourceMessage(sourceCopy.en["p.t284"], { v1: due, v2: done, v3: MARKETING_POLICY_NOTE }),
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
    targetRef: intent.applicationRef ?? sourceMessage(sourceCopy.en["p.t539"], { v1: intent.benefitRef, v2: intent.orderRef ?? "none" }),
    outcome: intent.outcome,
    code: intent.code ?? "",
  }));
  const quarantineLines = state.quarantined.map(
    (item) => sourceMessage(sourceCopy.en["p.t122"], { v1: item.arrived, v2: item.intentRef, v3: item.cause }),
  );
  const unlinkedLines = projection.unlinkedIntents.map(
    (intent) =>
      sourceMessage(sourceCopy.en["p.t285"], { v1: STEP_WORDS[intent.step], v2: intent.intentRef, v3: intent.benefitRef, v4: intent.outcome.toLowerCase().replace("_", " ") }),
  );
  const counters = state.counters;
  const session: SessionModel = {
    contextLine: sourceMessage(sourceCopy.en["p.t540"], { v1: state.context.actorRef, v2: state.context.subjectRef, v3: state.context.incarnation, v4: state.context.environment }),
    countersLine: sourceMessage(sourceCopy.en["p.t206"], { v1: counters.sent, v2: counters.fenced, v3: counters.notSent, v4: counters.droppedReads }),
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
      statusWord: row.status === "field-named" ? sourceCopy.en["sl3"] : sourceCopy.en["s10d"],
      bodyFields: row.bodyFields.length === 0 ? "none" : row.bodyFields.map((entry) => `${entry.action}.${entry.field}`).join(", "),
      reason: row.reason,
    })),
    crm: MARKETING_CRM_SCOPE.map((row) => ({
      id: row.id,
      scope: row.scope,
      scopeWord: row.scope === "consumed" ? sourceCopy.en["se6"] : sourceCopy.en["s16l"],
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
        note(sourceMessage(sourceCopy.en["p.t286"], { v1: result.readState, v2: state.readCode ? ` (${state.readCode})` : "" }), true);
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
      startSession(next, sourceMessage(sourceCopy.en["p.t217"], { v1: next }));
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
      const current = session.controller.state().context.subjectRef;
      const next = session.controller.switchContext({ subjectRef: current === MARKETING_OWN_SUBJECT ? MARKETING_FOREIGN_SUBJECT : MARKETING_OWN_SUBJECT });
      note(sourceMessage(sourceCopy.en["p.t287"], { v1: next.subjectRef, v2: next.incarnation }));
      void read(session);
    },
    newSession() {
      startSession(scenario, sourceCopy.en["s1ma"]);
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
    model: buildMarketingJourneyModel({ controller: session.controller, environment, last }),
    heldSupported: scenario === "held-response",
    actions,
  };
}
