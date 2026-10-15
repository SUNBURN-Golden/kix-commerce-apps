import { JOURNEY_NOT_COMPOSED, type JourneyNotComposed } from "./booking-journey.js";
import { COMMERCE_COMMAND_BINDINGS } from "./commerce-bindings.js";
import { FIXTURE_SCREENS } from "./contract-fixtures.js";
import {
  DISCOVERY_PROJECTION_AS_OF,
  DISCOVERY_READ_TUPLE_LITERALS,
  checkDiscoveryReadTuple,
  type DiscoveryReadTuple,
} from "./discovery-read.js";
import { OPENAPI_INTEGRATION_GATE_PIN } from "./integration-gate-pin.js";
import {
  MOBILE_DESK_ACTOR,
  createNotBoundMobileShell,
  createStubMobileShell,
  type MobileWriteRequest,
} from "./installable-mobile.js";
import { MobileShellController } from "./installable-mobile-controller.js";
import {
  createNotBoundMarketplaceBench,
  createStubMarketplaceBench,
  type MarketplaceBenchPort,
} from "./marketplace-performance.js";
import { MarketplaceBenchController } from "./marketplace-performance-controller.js";
import { OPENAPI_CONTRACT_PIN } from "./openapi-contract-pin.js";
import {
  PLATFORM_DESK_ACTOR,
  PLATFORM_REFUND_NOT_BOUND,
  createNotBoundPlatformJourney,
  createStubPlatformJourney,
  type PlatformWriteRequest,
} from "./platform-journey.js";
import { PlatformJourneyController } from "./platform-controller.js";
import {
  PROVIDER_DESK_ACTOR,
  createNotBoundProviderJourney,
  createStubProviderJourney,
  type ProviderWriteRequest,
} from "./provider-journey.js";
import { ProviderJourneyController } from "./provider-controller.js";
import { isRecord } from "./record.js";

/**
 * Synthetic operational-qualification runner for the platform qualification
 * packet screen.
 *
 * This is the stub-scope stand-in for pending node
 * c-platform-operational-qualification (plan revision 2026-10-13, 준태님 승인).
 * The real qualification waits on kix-protocol:ps-07-scale-qualification and
 * kix-protocol:cr-10-credit-qualification, on the unpromoted
 * commerce-integration-closeout, and on the real producer tuple. No producer
 * SDK, manifest, or vector is consumed, so those digests stay null and this
 * module sends nothing over a network.
 *
 * A run drives the sibling synthetic sources — the platform trade page, the
 * provider checkout page, the installable mobile shell, and the marketplace
 * scale bench — through their own controllers, once per leg, and records what
 * each leg returned. Normal, decline, STALE, UNKNOWN, cancel, refund,
 * recovery, and permission-revocation each keep their own exercise record.
 * A journey closes only on the terminal state of its whole leg sequence: a
 * per-call confirmed is never an end-to-end close. A result that arrives
 * after an actor transition is quarantined and leaks nothing into the new
 * context.
 *
 * The packet a run produces is a record, not a promotion. Its
 * qualificationState is STUB_RUN_RECORDED and every non-claim is a literal
 * false. A packet that claims otherwise is refused whole; an untrusted packet
 * leaves the run unknown.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const QUALIFICATION_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const QUALIFICATION_NOT_BOUND_REASON =
  "No current producer tuple exists for operational qualification: pending node c-platform-operational-qualification is not promoted, kix-protocol:ps-07-scale-qualification and kix-protocol:cr-10-credit-qualification are not merged, and commerce-integration-closeout is unpromoted. The qualification run stays not-bound on integration-http.";

export const QUALIFICATION_PROJECTION_NAME = "kix.operational.qualification";

/** Fixed instant the synthetic packet claims to be built at. A label, not a clock read. */
export const QUALIFICATION_AS_OF = DISCOVERY_PROJECTION_AS_OF;

/** The desk's own actor string. It is a context label, not an authentication result. */
export const QUALIFICATION_DESK_ACTOR = "qualification-runner";

/** A second actor for the context switch. Context label, not an authentication result. */
export const QUALIFICATION_GUEST_ACTOR = "qualification-reviewer";

/**
 * The eight exercise classes this runner executes (scope item 1). Each class
 * keeps its own denominator: a recorded exercise covers its own class and no
 * other.
 */
export const QUALIFICATION_CLASSES = [
  "success",
  "decline",
  "stale",
  "unknown",
  "cancel",
  "refund",
  "recovery",
  "permission-revocation",
] as const;

export type QualificationClass = (typeof QUALIFICATION_CLASSES)[number];

/**
 * The five unresolved areas (scope item 2). Unresolved items are reported per
 * area on its own denominator and are never merged into one readiness figure.
 */
export const QUALIFICATION_DENOMINATOR_AREAS = [
  "source",
  "device",
  "provider",
  "rights",
  "finance",
] as const;

export type QualificationDenominatorArea = (typeof QUALIFICATION_DENOMINATOR_AREAS)[number];

/** The four evidence scopes (required output 2). */
export const QUALIFICATION_EVIDENCE_SCOPES = [
  "functional",
  "performance",
  "security",
  "environment",
] as const;

export type QualificationEvidenceScope = (typeof QUALIFICATION_EVIDENCE_SCOPES)[number];

export const QUALIFICATION_SCENARIOS = ["clean", "held", "read-lost", "claims-pass"] as const;

export type QualificationScenario = (typeof QUALIFICATION_SCENARIOS)[number];

export const QUALIFICATION_INVALID_CODES = ["INTENT", "CONTEXT"] as const;

export type QualificationInvalidCode = (typeof QUALIFICATION_INVALID_CODES)[number];

export const QUALIFICATION_REFUSAL_CODES = ["CLAIM"] as const;

export type QualificationRefusalCode = (typeof QUALIFICATION_REFUSAL_CODES)[number];

/**
 * The non-claims this packet always states as literal false. A packet or a
 * receipt that claims one of them is refused whole or untrusted.
 */
export const QUALIFICATION_NON_CLAIM_FIELDS = [
  "publicDeploy",
  "realMoneyApproval",
  "realPaymentExecuted",
  "realUserReviewCompleted",
  "serviceQualification",
  "productionEnvironment",
  "realIntegrationComplete",
  "qualificationPromoted",
] as const;

export type QualificationNonClaimField = (typeof QUALIFICATION_NON_CLAIM_FIELDS)[number];

export type QualificationNonClaims = Readonly<Record<QualificationNonClaimField, false>>;

const QUALIFICATION_NON_CLAIMS: QualificationNonClaims = {
  publicDeploy: false,
  realMoneyApproval: false,
  realPaymentExecuted: false,
  realUserReviewCompleted: false,
  serviceQualification: false,
  productionEnvironment: false,
  realIntegrationComplete: false,
  qualificationPromoted: false,
};

/** The only qualification state a stub packet ever states. It is never QUALIFIED. */
export const QUALIFICATION_STATE = "STUB_RUN_RECORDED" as const;

/** Quote of the locked hold binding. H1 keeps this consideredAction and keeps it not-bound. */
export const QUALIFICATION_HOLD_NOT_BOUND = {
  method: "placeHold",
  status: COMMERCE_COMMAND_BINDINGS.placeHold.status,
  consideredAction: COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction,
  reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
  mappedOntoPrepareTrade: false,
} as const;

export interface QualificationNotComposed {
  action: JourneyNotComposed["action"] | "refund_ticket";
  reason: string;
}

/** The actions this runner records and never composes. The journey list plus refund_ticket. */
export const QUALIFICATION_NOT_COMPOSED: readonly QualificationNotComposed[] = [
  ...JOURNEY_NOT_COMPOSED,
  { action: PLATFORM_REFUND_NOT_BOUND.action, reason: PLATFORM_REFUND_NOT_BOUND.reason },
];

// ---------------------------------------------------------------------------
// Packet shapes
// ---------------------------------------------------------------------------

/** One leg of a journey, recorded as the port or the controller answered it. */
export interface QualificationCall {
  /** The leg label: a read, a write, a synthetic control, or a client action. */
  label: string;
  /** What came back: the read state, the result kind, or the control outcome. */
  outcome: string;
  code: string | null;
  note: string;
}

/**
 * One exercise record. A class is covered by a recorded exercise that actually
 * ran; a listed class with no recorded exercise is uncovered, never inferred.
 */
export interface QualificationExercise {
  id: string;
  journeyId: string;
  klass: QualificationClass;
  /** The surface whose own stub port and controller ran the legs. */
  surface: string;
  expected: string;
  observed: string;
  verdict: "recorded" | "deviation";
  note: string;
}

/**
 * One end-to-end journey over a synthetic surface. `verdict` is computed from
 * the terminal state of the whole leg sequence only. A per-call confirmed
 * inside the calls is not a close.
 */
export interface QualificationJourneyResult {
  id: string;
  surface: string;
  /** Buyer or operator. A context label, not an authentication result. */
  actor: "buyer" | "operator";
  title: string;
  calls: readonly QualificationCall[];
  verdict: "closed" | "open" | "blocked";
  reason: string;
}

/** One binding-integrity check the run records. */
export interface QualificationBindingCheck {
  id: string;
  expected: string;
  observed: string;
  verdict: "recorded" | "deviation";
  note: string;
}

/** One unresolved item on its own area denominator. */
export interface QualificationUnresolvedItem {
  id: string;
  /** The pending node or kix-protocol node the item waits on. */
  blockedBy: string;
  note: string;
}

export interface QualificationDenominator {
  area: QualificationDenominatorArea;
  /** The area's own item count. Areas never share a denominator. */
  denominator: number;
  unresolved: number;
  items: readonly QualificationUnresolvedItem[];
}

export interface QualificationEvidenceRow {
  id: string;
  /** executed = this run drove it; reused = an existing suite/screen already covers it; unverified = nothing ran it. */
  basis: "executed" | "reused" | "unverified";
  note: string;
}

export interface QualificationScopeEvidence {
  scope: QualificationEvidenceScope;
  headline: string;
  rows: readonly QualificationEvidenceRow[];
}

/** A real-user review candidate. It stays a candidate: no real user ran it. */
export interface QualificationReviewCandidate {
  route: string;
  surface: string;
  focus: string;
  keyboard: string;
  status: "candidate";
  note: string;
}

/** Scope item 3: the operations support, incident handoff, and UI review material bundle. */
export interface QualificationOpsBundle {
  opsSupport: {
    route: string;
    diagnosis: string;
    keptSeparate: readonly string[];
    note: string;
  };
  incidentHandoff: {
    route: string;
    packetModule: string;
    /** The handoff module's own pending-producer list. Its count is rendered from that module, not re-counted here. */
    pendingProducerList: string;
    note: string;
  };
  uiReviewMaterial: {
    fixtureVersion: string;
    fixtureScreens: number;
    surfacesDocumented: number;
    note: string;
  };
}

export interface QualificationPins {
  contractOpenApiSha256: string;
  gateOpenApiSha256: string;
  protocolMergeSha: string;
  sdkDigest: null;
  manifestDigest: null;
  vectorDigest: null;
  consumedProducerChange: false;
}

export interface QualificationPacket {
  packetId: string;
  environment: "stub";
  /** The synthetic instant label. Not a clock read. */
  generatedAt: string;
  qualificationState: typeof QUALIFICATION_STATE;
  ruling: string;
  pins: QualificationPins;
  promotion: {
    promoted: false;
    publicDeploy: false;
    realMoneyApproval: false;
    serviceQualification: false;
    note: string;
  };
  nonClaims: QualificationNonClaims;
  summary: {
    journeys: number;
    closed: number;
    open: number;
    blocked: number;
    exercises: number;
    recorded: number;
    deviations: number;
    classesCovered: number;
    classesTotal: number;
  };
  journeys: readonly QualificationJourneyResult[];
  exercises: readonly QualificationExercise[];
  bindingChecks: readonly QualificationBindingCheck[];
  denominators: readonly QualificationDenominator[];
  evidence: readonly QualificationScopeEvidence[];
  reviewCandidates: readonly QualificationReviewCandidate[];
  opsBundle: QualificationOpsBundle;
  boundaryNote: string;
}

export interface QualificationRunRequest {
  contextKey: string;
  intentRef: string;
}

export type QualificationRunOutcome =
  | { kind: "ready"; intentRef: string; contextKey: string; packet: QualificationPacket }
  | {
      kind: "refused";
      intentRef: string;
      contextKey: string;
      code: QualificationRefusalCode;
      detail: string;
    }
  | {
      kind: "invalid-request";
      intentRef: string;
      contextKey: string;
      code: QualificationInvalidCode;
      detail: string;
    }
  | { kind: "tuple-changed"; intentRef: string; contextKey: string; field: string; expected: string; actual: string }
  | { kind: "not-bound"; intentRef: string; contextKey: string; reason: string }
  | { kind: "unknown"; intentRef: string; contextKey: string; detail: string };

export interface QualificationRunnerPort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic-qualification" | "none";
  readonly scenario: QualificationScenario;
  run(request: QualificationRunRequest): Promise<QualificationRunOutcome>;
  /** Synthetic control: releases a held run answer. A real qualifier offers no such call. */
  deliverHeld(): number;
}

export interface StubQualificationRunnerOptions {
  scenario?: QualificationScenario;
  /** Expected tuple override. Used to stage a producer change in tests. */
  expectedTuple?: DiscoveryReadTuple;
}

export function createStubQualificationRunner(
  options: StubQualificationRunnerOptions = {},
): QualificationRunnerPort {
  return new StubQualificationRunner(options);
}

export function createNotBoundQualificationRunner(): QualificationRunnerPort {
  return {
    environment: "integration-http",
    source: "none",
    scenario: "clean",
    run(request: QualificationRunRequest) {
      return Promise.resolve({
        kind: "not-bound",
        intentRef: request.intentRef,
        contextKey: request.contextKey,
        reason: QUALIFICATION_NOT_BOUND_REASON,
      });
    },
    deliverHeld() {
      return 0;
    },
  };
}

export function qualificationRunnerPortFor(
  environment: "stub" | "integration-http",
  options: StubQualificationRunnerOptions = {},
): QualificationRunnerPort {
  if (environment === "stub") {
    return createStubQualificationRunner(options);
  }
  return createNotBoundQualificationRunner();
}

// ---------------------------------------------------------------------------
// Unresolved items on their own denominators (scope item 2)
// ---------------------------------------------------------------------------

function unresolved(area: QualificationDenominatorArea, items: readonly QualificationUnresolvedItem[]): QualificationDenominator {
  return { area, denominator: items.length, unresolved: items.length, items };
}

/**
 * The unresolved source, device, provider, rights, and finance items. Each is a
 * pending producer connection or an unverified real-world property. Nothing here
 * is resolved by a synthetic run.
 */
export const QUALIFICATION_DENOMINATORS: readonly QualificationDenominator[] = [
  unresolved("source", [
    { id: "c-discovery-live", blockedBy: "c-discovery-live + kix-protocol:ps-05-query-projections", note: "The discovery projection read is synthetic. A live query projection stays on that pending node." },
    { id: "c-inventory-venue", blockedBy: "c-inventory-venue", note: "Seat and GA selection is a synthetic page. A real inventory and queue read stays on that pending node." },
    { id: "c-platform-journey", blockedBy: "c-platform-journey + kix-protocol:ps-03-resale-contract, ps-04-execution-partitions, ps-05-query-projections", note: "The multi-channel trade page is synthetic. A real listing, trade, payment, transfer, and refund connection stays on that pending node." },
    { id: "c-merchant-operations", blockedBy: "c-merchant-operations", note: "The merchant workroom is synthetic. A real event, listing, trade, and settlement-obligation read model and a real producer export stay on that pending node." },
    { id: "c-credit-origination", blockedBy: "c-credit-origination", note: "The origination desk is synthetic. A real claim basis, policy revision, consent, document, review, commitment, and drawdown permission read model stays on that pending node." },
    { id: "c-credit-servicing-journey", blockedBy: "c-credit-servicing-journey + kix-protocol:cr-10-credit-qualification", note: "The servicing desk is synthetic. A real draw, observation, reservation, exposure, schedule, payment, allocation, reversal, adjustment, and case read model stays on that pending node." },
    { id: "c-finance-operations", blockedBy: "c-finance-operations", note: "The finance desk is synthetic. A real reconciliation case, source cut, payee allocation, unapplied remainder, and accounting export read model stays on that pending node." },
    { id: "c-marketing-journey", blockedBy: "c-marketing-journey + kix-protocol:wave7-marketing-contracts", note: "The benefit journey is synthetic. A real eligibility, usage, budget, attribution, apply, and reclaim read model stays on that pending node. A full CRM product is not built." },
    { id: "c-delegated-assistant", blockedBy: "c-delegated-assistant + kix-protocol:ai-delegation-execution-decision, k-authority-qualification", note: "The delegation assistant is synthetic. A real grant, proposal, approval, and command read model stays on that pending node. Nothing transfers, refunds, or signs." },
    { id: "c-tenant-permissions", blockedBy: "c-tenant-permissions + kix-protocol:k-operator-contract", note: "The permissions desk is synthetic. A real organization, role assignment, resource scope, maker/checker, revocation, account change, sensitive export, and audit read model stays on that pending node." },
    { id: "c-notification-inbox", blockedBy: "c-notification-inbox + kix-protocol:k-operator-contract", note: "The notification inbox is synthetic. A real contracted-event feed, dedupe, read state, resolve, and support-inquiry read model stays on that pending node." },
    { id: "c-marketplace-performance", blockedBy: "c-marketplace-performance + kix-protocol:ps-07-scale-qualification", note: "The scale bench is synthetic. A real large-marketplace read, queue, device measurement, and producer load qualification stays on that pending node." },
    { id: "c-provider-connected-journey", blockedBy: "c-provider-connected-journey + kix-protocol:k-provider-sandbox, k-authority-qualification", note: "The provider journey is synthetic. A real approved-provider checkout, payment observation, issuance, and refund connection stays on that pending node." },
    { id: "c-installable-mobile", blockedBy: "c-installable-mobile", note: "The mobile shell is synthetic. A real packaging, install, update, session, vault, presentation, and device read model stays on that pending node." },
  ]),
  unresolved("device", [
    { id: "device.real-mobile", blockedBy: "c-platform-operational-qualification + kix-protocol:ps-07-scale-qualification", note: "No real handset ran this desk. Real mobile evidence stays unverified; a desktop emulation profile is never a substitute." },
    { id: "device.real-tablet", blockedBy: "c-platform-operational-qualification + kix-protocol:ps-07-scale-qualification", note: "No real tablet ran this desk. The class stays unverified and is never filled with a desktop measurement." },
    { id: "device.install-attestation", blockedBy: "c-installable-mobile", note: "No real install or device attestation exists. The install record is a synthetic source row." },
    { id: "device.clock-authority", blockedBy: "c-installable-mobile", note: "The device clock never decides validity or expiry: the source's own instant is the only authority. A real device-time contract is not consumed." },
  ]),
  unresolved("provider", [
    { id: "provider.sandbox", blockedBy: "kix-protocol:k-provider-sandbox", note: "The provider journey serves a synthetic sandbox. A real approved-provider sandbox connection is not merged." },
    { id: "provider.authority", blockedBy: "kix-protocol:k-authority-qualification", note: "Account qualification is a synthetic source verdict, not a real authority decision." },
    { id: "provider.api-send", blockedBy: "c-provider-connected-journey", note: "No provider API call is wired. A checkout redirect and a return landing are synthetic source events; a return landing is never a payment observation." },
    { id: "provider.notification-send", blockedBy: "c-notification-inbox", note: "No external send is wired for the inbox. An arrival confirms no economic effect and no provider or channel API is called." },
  ]),
  unresolved("rights", [
    { id: "rights.hold-binding", blockedBy: "bind-wave4-pointers", note: "placeHold stays not-bound with consideredAction reserve_listing. prepare_trade is only a local-call body and placeHold({ eventId, quantity }) is never mapped onto it." },
    { id: "rights.admission", blockedBy: "bind-admission-fsm", note: "admit stays uncomposed and no venue scanning ran. A credential label and a health probe are not entry." },
    { id: "rights.open-admission-journey", blockedBy: "c-platform-operational-qualification", note: "M2 keeps open_admission uncomposed in the buyer journey. The organizer console posts it as its own request; that post is not venue admission." },
    { id: "rights.issuance-authority", blockedBy: "c-platform-operational-qualification", note: "A synthetic issuance record grants no admission authority and is not a real right. No real issuance read model is consumed." },
  ]),
  unresolved("finance", [
    { id: "finance.real-payment", blockedBy: "c-platform-operational-qualification", note: "confirmBooking sends no capture and settlementPreview sends no monetary posting. No real payment ran and none is claimed." },
    { id: "finance.refund-execution", blockedBy: "refund-surface", note: "refund_ticket is pinned and never composed. A refund record executes nothing and returns no funds; COMPENSATION_UNDEFINED stays visible." },
    { id: "finance.credit-disbursement", blockedBy: "c-credit-servicing-journey + kix-protocol:cr-10-credit-qualification", note: "A draw instruction is not a disbursement observation. No credit disbursed and no disbursement is claimed." },
    { id: "finance.bank-rail", blockedBy: "c-platform-operational-qualification", note: "No bank rail is wired. Settlement obligation lines stay synthetic source rows." },
    { id: "finance.settlement-math", blockedBy: "c-finance-operations", note: "Totals, differences, and shares are the source's own text. No Move, kernel, or settlement math is copied into the UI." },
  ]),
];

// ---------------------------------------------------------------------------
// Review candidates and ops bundle (required output 1, scope item 3)
// ---------------------------------------------------------------------------

export const QUALIFICATION_REVIEW_CANDIDATES: readonly QualificationReviewCandidate[] = [
  { route: "/platform", surface: "platform-journey-trade", focus: "Multi-channel trade: booking, payment observation, right transfer, and refund explanation stay separate lines.", keyboard: "Every section is anchored in the page nav; fenced and rejected results move focus to the status region.", status: "candidate", note: "Real-user review not run in this session." },
  { route: "/provider", surface: "provider-connected-journey", focus: "Checkout redirect, return landing, provider report, issuance, and refund record stay five separate lines.", keyboard: "Same anchored sections and status focus.", status: "candidate", note: "A sandbox success is not a real payment; a refund record executes nothing." },
  { route: "/mobile", surface: "installable-mobile-shell", focus: "Install, update, reconnect, present, confirm, and withdraw stay six separate writes; stored items stay copies.", keyboard: "Same anchored sections and status focus.", status: "candidate", note: "A stored item mints no admission; the device clock decides nothing." },
  { route: "/marketplace-performance", surface: "marketplace-performance-bench", focus: "Bounded window, queue admission as browse access, dropped stale answers, and separate offered/measured latency labels.", keyboard: "Same anchored sections and status focus.", status: "candidate", note: "Browser-boundary measurement is never a producer load figure." },
  { route: "/permissions", surface: "tenant-permissions", focus: "Role workspaces, proposals, approvals, and the sensitive export stay separate capabilities.", keyboard: "Same anchored sections and status focus.", status: "candidate", note: "A hidden control is never enforcement." },
  { route: "/notifications", surface: "notification-inbox", focus: "Contracted event kinds, dedupe, read state, and offered-action resolve stay separate; an arrival confirms no economic effect.", keyboard: "Same anchored sections and status focus.", status: "candidate", note: "No external send is wired." },
  { route: "/credit/servicing", surface: "credit-servicing", focus: "Draw instruction, disbursement observation, reservation, and exposure stay four facts; a case closure extinguishes no debt.", keyboard: "Same anchored sections and status focus.", status: "candidate", note: "A draw instruction is not a disbursement." },
  { route: "/finance", surface: "finance-operations", focus: "Reconciliation cases, allocations, unapplied remainders, and the export stay the source's own rows; proposals and approvals change no economic state.", keyboard: "Same anchored sections and status focus.", status: "candidate", note: "The export is synthetic and no accounting record." },
  { route: "/marketing/journey", surface: "marketing-journey", focus: "Discover, apply, rejected, and reclaim stay separate lines; an application confirms no purchase and pays no reward.", keyboard: "Same anchored sections and status focus.", status: "candidate", note: "Consent is read, never posted here." },
  { route: "/assistant", surface: "delegated-assistant", focus: "Request, proposal, approval, and command stay four separate lines; request text is never authority.", keyboard: "Same anchored sections and status focus.", status: "candidate", note: "Nothing here transfers, refunds, or signs." },
  { route: "/qualification", surface: "platform-operational-qualification", focus: "This packet: journey verdicts, class coverage, the five denominators, per-scope evidence, and the ops bundle.", keyboard: "Same anchored sections and status focus.", status: "candidate", note: "This screen is itself a candidate." },
];

export function qualificationOpsBundle(): QualificationOpsBundle {
  return {
    opsSupport: {
      route: "/handoff",
      diagnosis: "OUTCOME_SEPARATION and TRANSPORT_DIAGNOSES on the handoff packet",
      keptSeparate: ["UNKNOWN", "NOT_BOUND", "STALE", "REJECT"],
      note: "An operator reads a failure class before acting. UNKNOWN, NOT_BOUND, STALE, and REJECT stay separate; none is a success.",
    },
    incidentHandoff: {
      route: "/handoff",
      packetModule: "apps/web/src/handoff/packet.ts",
      pendingProducerList: "PENDING_PRODUCERS",
      note: "The handoff packet's own pending-producer list is the operator-facing pending list. This packet names the module and the list; the screen renders the count from the module itself so the number can never drift from it.",
    },
    uiReviewMaterial: {
      fixtureVersion: "1",
      fixtureScreens: FIXTURE_SCREENS.length,
      surfacesDocumented: QUALIFICATION_REVIEW_CANDIDATES.length,
      note: "The contract fixture library records the synthetic rows per screen; no row owns a pass and none substitutes a stub for a failed live call. The review candidates above are the current UI review material.",
    },
  };
}

// ---------------------------------------------------------------------------
// Evidence scopes (required output 2)
// ---------------------------------------------------------------------------

const REUSED_SURFACES = [
  { id: "tenant-permissions", note: "Its own suite already exercises role workspaces, proposals, approvals, the sensitive export, generation-stale rejection, and foreign-ref denial." },
  { id: "notification-inbox", note: "Its own suite already exercises dedupe, stale-issued offers, withheld sensitive detail, and the support inquiry." },
  { id: "credit-servicing", note: "Its own suite already exercises draw, observation, reservation, exposure, schedule, allocation, reversal, adjustment, and case transitions." },
  { id: "finance-operations", note: "Its own suite already exercises reconciliation cases, allocations, remainders, proposals, approvals, and the export." },
  { id: "marketing-journey", note: "Its own suite already exercises discovery, apply, rejection, reclaim, and the consent read." },
  { id: "delegated-assistant", note: "Its own suite already exercises request refusal, proposal, approval, single command send, revoke, and quarantine." },
  { id: "credit-origination", note: "Its own suite already exercises the application, review, commitment, and drawdown lanes." },
  { id: "merchant-operations", note: "Its own suite already exercises the four lenses, the non-claim refusals, and the export judgement." },
  { id: "discovery-live-read", note: "Its own suite already exercises the bounded cursor read, the tuple check, and stale/denied/refused outcomes." },
  { id: "inventory-venue-select", note: "Its own suite already exercises the summary, bounded page, selection detail, queue admission, and the hold fence." },
] as const;

function scopeEvidence(
  journeys: readonly QualificationJourneyResult[],
  exercises: readonly QualificationExercise[],
  checks: readonly QualificationBindingCheck[],
): readonly QualificationScopeEvidence[] {
  const functionalRows: QualificationEvidenceRow[] = [
    ...journeys.map((journey) => ({
      id: `functional.${journey.id}`,
      basis: "executed" as const,
      note: `${journey.title}: ${journey.verdict}. ${journey.reason}`,
    })),
    ...REUSED_SURFACES.map((surface) => ({
      id: `functional.reused.${surface.id}`,
      basis: "reused" as const,
      note: `${surface.id}: not re-driven here. ${surface.note}`,
    })),
  ];
  const securityRows: QualificationEvidenceRow[] = [
    ...checks.map((check) => ({
      id: `security.${check.id}`,
      basis: "executed" as const,
      note: `${check.id}: ${check.observed}. ${check.note}`,
    })),
    {
      id: "security.identity-switch",
      basis: "executed" as const,
      note: "A result that landed after an actor transition was quarantined; the earlier context's snapshot and unknown fences are not reused. See journey.platform-context-switch.",
    },
    ...exercises
      .filter((exercise) => exercise.id === "provider.claims.refused")
      .map((exercise) => ({
        id: "security.claim-refused-read",
        basis: "executed" as const,
        note: exercise.note,
      })),
  ];
  return [
    {
      scope: "functional",
      headline: "End-to-end journeys over the synthetic surfaces. A per-call confirmed is never counted as a journey close; surfaces not re-driven here are cited as reused coverage, not executed.",
      rows: functionalRows,
    },
    {
      scope: "performance",
      headline: "The only measurement this packet cites is the marketplace bench's browser-boundary figure, on its own denominator. The source's offered latency stays a separate label. No SLO is stated and no producer load figure exists.",
      rows: [
        {
          id: "performance.bench",
          basis: "reused",
          note: "marketplace-performance-bench: settled calls measured once at the browser boundary under workload and device labels; offeredMs kept as the source's own label. Not re-measured here.",
        },
        {
          id: "performance.real-device",
          basis: "unverified",
          note: "No real handset or tablet ran. Real-device performance stays unverified; an emulated profile is never reported as real mobile evidence.",
        },
        {
          id: "performance.producer-load",
          basis: "unverified",
          note: "No producer load qualification ran. kix-protocol:ps-07-scale-qualification is not merged; a synthetic stream is never a load figure.",
        },
        {
          id: "performance.slo",
          basis: "unverified",
          note: "No SLO is defined or measured. The qualification packet states none.",
        },
      ],
    },
    {
      scope: "security",
      headline: "Non-claims are stated as literal false on every payload and a claiming payload is refused whole; a post-hoc result across an actor transition is quarantined; the locked bindings are checked, not remapped.",
      rows: securityRows,
    },
    {
      scope: "environment",
      headline: "Stub is the default and the only environment this run qualifies. Loopback http://127.0.0.1 keeps its one-attempt, no-retry, no-stub-fallback rules; production and public deploy stay false.",
      rows: [
        {
          id: "environment.stub-default",
          basis: "executed",
          note: "Every journey in this packet ran on the synthetic stub sources. This run is the stub-scope record.",
        },
        {
          id: "environment.not-bound",
          basis: "executed",
          note: "The integration-http twin of every exercised surface answered not-bound on read and write. See bindings.not-bound-ports.",
        },
        {
          id: "environment.loopback",
          basis: "reused",
          note: "The handoff packet's loopback rules stand unchanged: http://127.0.0.1 only, one attempt, no retry, no idempotency key, no redirect following, no stub fallback, no proxy.",
        },
        {
          id: "environment.production",
          basis: "unverified",
          note: "No production or public environment exists here. productionEnvironment and publicDeploy stay literal false.",
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Packet integrity
// ---------------------------------------------------------------------------

export interface QualificationPacketRefusal {
  field: string;
  detail: string;
}

/**
 * A packet is trusted only when its structure is whole, every non-claim is a
 * literal false, the state word is STUB_RUN_RECORDED, the environment word is
 * stub, and promotion stays off. Anything else — including a malformed body —
 * is refused whole before it reaches the page. This check never throws on any
 * input, so an untrusted answer always leaves the run unknown.
 */
export function refuseQualificationPacket(packet: unknown): QualificationPacketRefusal | null {
  if (!isRecord(packet)) {
    return {
      field: "packet",
      detail: "The run's answer is not a packet record. A malformed packet is refused whole. Nothing is applied.",
    };
  }
  const nonClaims = packet.nonClaims;
  if (!isRecord(nonClaims)) {
    return {
      field: "nonClaims",
      detail: "The packet carries no non-claims record. A malformed packet is refused whole. Nothing is applied.",
    };
  }
  const claimed = QUALIFICATION_NON_CLAIM_FIELDS.filter((field) => nonClaims[field] !== false);
  if (claimed.length > 0) {
    return {
      field: claimed[0] ?? "nonClaims",
      detail: `The packet claims ${claimed.join(", ")}. A synthetic qualification packet cannot claim those. Nothing is applied.`,
    };
  }
  if (packet.qualificationState !== QUALIFICATION_STATE) {
    return {
      field: "qualificationState",
      detail: `The packet states ${String(packet.qualificationState)}. A stub packet only states ${QUALIFICATION_STATE}.`,
    };
  }
  if (packet.environment !== "stub") {
    return {
      field: "environment",
      detail: `The packet states environment ${String(packet.environment)}. A stub packet only states stub.`,
    };
  }
  if (typeof packet.packetId !== "string" || packet.packetId.length === 0) {
    return {
      field: "packetId",
      detail: "The packet carries no packet id. A malformed packet is refused whole. Nothing is applied.",
    };
  }
  const promotion = packet.promotion;
  if (!isRecord(promotion)) {
    return {
      field: "promotion",
      detail: "The packet carries no promotion record. A malformed packet is refused whole. Nothing is applied.",
    };
  }
  if (
    promotion.promoted !== false ||
    promotion.publicDeploy !== false ||
    promotion.realMoneyApproval !== false ||
    promotion.serviceQualification !== false
  ) {
    return {
      field: "promotion",
      detail: "The packet promotes to deployment, real money, or service qualification. A stub qualification is never promoted.",
    };
  }
  if (!Array.isArray(packet.denominators) || packet.denominators.length !== QUALIFICATION_DENOMINATOR_AREAS.length) {
    return { field: "denominators", detail: "The packet does not carry all five unresolved denominators." };
  }
  if (
    !Array.isArray(packet.journeys) ||
    !Array.isArray(packet.exercises) ||
    packet.journeys.length === 0 ||
    packet.exercises.length === 0
  ) {
    return { field: "journeys", detail: "The packet carries no executed journey or exercise." };
  }
  return null;
}

// ---------------------------------------------------------------------------
// The exercised journeys (scope item 1). Each drives a sibling stub through
// its own controller; every leg is recorded as answered.
// ---------------------------------------------------------------------------

function call(label: string, outcome: string, code: string | null = null, note = ""): QualificationCall {
  return { label, outcome, code, note };
}

function exercise(
  id: string,
  journeyId: string,
  klass: QualificationClass,
  surface: string,
  expected: string,
  observed: string,
  ok: boolean,
  note: string,
): QualificationExercise {
  return { id, journeyId, klass, surface, expected, observed, verdict: ok ? "recorded" : "deviation", note };
}

function journey(
  id: string,
  surface: string,
  actor: "buyer" | "operator",
  title: string,
  calls: readonly QualificationCall[],
  verdict: QualificationJourneyResult["verdict"],
  reason: string,
): QualificationJourneyResult {
  return { id, surface, actor, title, calls, verdict, reason };
}

interface Executed {
  journeys: QualificationJourneyResult[];
  exercises: QualificationExercise[];
}

function push(target: Executed, j: QualificationJourneyResult, ...ex: QualificationExercise[]): void {
  target.journeys.push(j);
  target.exercises.push(...ex);
}

async function platformClean(target: Executed): Promise<void> {
  const port = createStubPlatformJourney({ scenario: "clean" });
  const ctl = new PlatformJourneyController(port, { actorRef: PLATFORM_DESK_ACTOR });
  const calls: QualificationCall[] = [];
  await ctl.refresh();
  calls.push(call("read", ctl.state().readState, null, "The synthetic trade source answered ready."));
  const book = await ctl.run({ step: "book", intentRef: "q-book-1", listingRef: "lst-0001" });
  const tradeRef = book.kind === "CONFIRMED" ? book.intent.refs?.tradeRef ?? null : null;
  calls.push(call("book", book.kind, book.kind === "REJECTED" ? book.intent.code : null, "One booking write, sent once."));
  await ctl.refresh();
  const transfer =
    tradeRef === null
      ? ({ kind: "NOT_SENT", reason: "unknown-ref", detail: "No confirmed booking named a trade." } as const)
      : await ctl.run({ step: "transfer", intentRef: "q-transfer-1", tradeRef });
  calls.push(call("transfer", transfer.kind, transfer.kind === "REJECTED" ? transfer.intent.code : null, "One transfer write on the booked trade."));
  await ctl.refresh();
  const state = ctl.state();
  calls.push(call("read", state.readState, null, "The read after the writes."));
  const moved = state.snapshot?.rights.find((right) => right.holder === PLATFORM_DESK_ACTOR) !== undefined;
  const closed = book.kind === "CONFIRMED" && transfer.kind === "CONFIRMED" && state.readState === "ready" && moved;
  push(
    target,
    journey(
      "journey.platform-trade-clean",
      "platform-journey-trade",
      "buyer",
      "Buyer trade journey: read, book, transfer.",
      calls,
      closed ? "closed" : "open",
      closed
        ? "Booking and transfer each confirmed once, and the last read shows the right with the desk actor. The journey closes on the terminal state of the whole sequence."
        : "The sequence did not reach its terminal state. Confirmed calls inside it do not close it.",
    ),
    exercise(
      "platform.success.e2e",
      "journey.platform-trade-clean",
      "success",
      "platform-journey-trade",
      "read ready, book CONFIRMED, transfer CONFIRMED, right moved to the desk actor",
      `read ${calls[0]?.outcome}, book ${calls[1]?.outcome}, transfer ${calls[3]?.outcome}, moved ${String(moved)}`,
      closed,
      "The nominal path: each leg landed once and the terminal read agrees.",
    ),
  );
}

async function platformRival(target: Executed): Promise<void> {
  const port = createStubPlatformJourney({ scenario: "rival-channel" });
  const ctl = new PlatformJourneyController(port, { actorRef: PLATFORM_DESK_ACTOR });
  const calls: QualificationCall[] = [];
  await ctl.refresh();
  calls.push(call("read", ctl.state().readState, null, "The synthetic trade source answered ready."));
  const book = await ctl.run({ step: "book", intentRef: "q-book-1", listingRef: "lst-0001" });
  const tradeRef = book.kind === "CONFIRMED" ? book.intent.refs?.tradeRef ?? null : null;
  calls.push(call("book", book.kind, null, "The booking confirmed. A per-call confirmed is not a journey close."));
  await ctl.refresh();
  const transfer =
    tradeRef === null
      ? ({ kind: "NOT_SENT", reason: "unknown-ref", detail: "No confirmed booking named a trade." } as const)
      : await ctl.run({ step: "transfer", intentRef: "q-transfer-1", tradeRef });
  calls.push(
    call(
      "transfer",
      transfer.kind,
      transfer.kind === "REJECTED" ? transfer.intent.code : null,
      "A rival channel moved the right between the read and the write.",
    ),
  );
  const declined = book.kind === "CONFIRMED" && transfer.kind === "REJECTED" && transfer.intent.code === "VERSION_STALE";
  push(
    target,
    journey(
      "journey.platform-trade-rival",
      "platform-journey-trade",
      "buyer",
      "Buyer trade journey with a rival-channel decline.",
      calls,
      "open",
      "The transfer was explicitly rejected VERSION_STALE. The booking's confirmed receipt does not close the journey; a declined leg leaves it open.",
    ),
    exercise(
      "platform.decline.rival",
      "journey.platform-trade-rival",
      "decline",
      "platform-journey-trade",
      "transfer REJECTED VERSION_STALE after the rival moved the right",
      `book ${book.kind}, transfer ${transfer.kind}${transfer.kind === "REJECTED" ? ` ${transfer.intent.code}` : ""}`,
      declined,
      "An explicit reject stays a reject: it is not relabeled unknown and not treated as success, and the journey stays open.",
    ),
  );
}

async function platformStale(target: Executed): Promise<void> {
  const port = createStubPlatformJourney({ scenario: "stale" });
  const ctl = new PlatformJourneyController(port, { actorRef: PLATFORM_DESK_ACTOR });
  const calls: QualificationCall[] = [];
  await ctl.refresh();
  calls.push(call("read", ctl.state().readState, null, "The watermark the source served is older than the floor this run holds."));
  const book = await ctl.run({ step: "book", intentRef: "q-book-1", listingRef: "lst-0001" });
  calls.push(
    call(
      "book",
      book.kind,
      book.kind === "FENCED" ? book.fence.reason : null,
      "No current snapshot exists to write from; the write stays fenced before the port.",
    ),
  );
  const stale = ctl.state().readState === "stale" && book.kind === "FENCED";
  push(
    target,
    journey(
      "journey.platform-stale",
      "platform-journey-trade",
      "buyer",
      "Buyer trade journey on a stale read.",
      calls,
      "blocked",
      "The read is stale: it is not an empty board and not a failure to be worked around. Every write stays fenced until a current read lands; none does here.",
    ),
    exercise(
      "platform.stale.read",
      "journey.platform-stale",
      "stale",
      "platform-journey-trade",
      "read stale, book FENCED before the port",
      `read ${calls[0]?.outcome}, book ${book.kind}${book.kind === "FENCED" ? ` ${book.fence.reason}` : ""}`,
      stale,
      "A stale response does not update the view and no write goes out on it.",
    ),
  );
}

async function platformLate(target: Executed): Promise<void> {
  const port = createStubPlatformJourney({ scenario: "transfer-late" });
  const ctl = new PlatformJourneyController(port, { actorRef: PLATFORM_DESK_ACTOR });
  const calls: QualificationCall[] = [];
  await ctl.refresh();
  calls.push(call("read", ctl.state().readState, null, "The synthetic trade source answered ready."));
  const book = await ctl.run({ step: "book", intentRef: "q-book-1", listingRef: "lst-0001" });
  const tradeRef = book.kind === "CONFIRMED" ? book.intent.refs?.tradeRef ?? null : null;
  calls.push(call("book", book.kind, null, "The booking confirmed."));
  await ctl.refresh();
  const transfer =
    tradeRef === null
      ? ({ kind: "NOT_SENT", reason: "unknown-ref", detail: "No confirmed booking named a trade." } as const)
      : await ctl.run({ step: "transfer", intentRef: "q-transfer-1", tradeRef });
  calls.push(call("transfer", transfer.kind, null, "The answer to the transfer never arrived. It may have applied."));
  const due = port.deliverLate();
  for (const delivery of due) {
    const late = ctl.acceptLate(delivery);
    calls.push(
      call(
        "acceptLate",
        late.kind,
        delivery.code,
        "A late result is recorded evidence only. It does not make the write known.",
      ),
    );
  }
  const blocked = tradeRef !== null ? ctl.gateFor({ step: "transfer", intentRef: "q-transfer-2", tradeRef }) : null;
  calls.push(
    call(
      "gate",
      blocked === null ? "open" : `FENCED ${blocked.reason}`,
      blocked?.reason ?? null,
      "The right stays blocked: an unknown write is never retried and a read does not resolve it.",
    ),
  );
  const stayedUnknown = ctl.state().intents.some((intent) => intent.step === "transfer" && intent.outcome === "UNKNOWN");
  push(
    target,
    journey(
      "journey.platform-transfer-late",
      "platform-journey-trade",
      "buyer",
      "Buyer trade journey with a lost transfer answer.",
      calls,
      "blocked",
      "The transfer may have applied and its answer never arrived. The late result is recorded evidence; the write stays unknown and the right stays fenced.",
    ),
    exercise(
      "platform.unknown.late",
      "journey.platform-transfer-late",
      "unknown",
      "platform-journey-trade",
      "transfer UNKNOWN, late result RECORDED, the right stays fenced",
      `transfer ${transfer.kind}, late ${due.length > 0 ? "recorded" : "none"}, next write ${blocked === null ? "open" : `fenced ${blocked?.reason}`}`,
      transfer.kind === "UNKNOWN" && due.length > 0 && blocked !== null && blocked.reason === "unknown-outcome" && stayedUnknown,
      "UNKNOWN is not a rejection and not a success. Nothing retries, re-issues, or resolves it here.",
    ),
  );
}

async function platformContextSwitch(target: Executed): Promise<void> {
  const port = createStubPlatformJourney({ scenario: "held-response" });
  const ctl = new PlatformJourneyController(port, { actorRef: PLATFORM_DESK_ACTOR });
  const calls: QualificationCall[] = [];
  await ctl.refresh();
  calls.push(call("read", ctl.state().readState, null, "The synthetic trade source answered ready."));
  const pending = ctl.run({ step: "book", intentRef: "q-book-1", listingRef: "lst-0001" });
  calls.push(call("book", "IN_FLIGHT", null, "The source holds the answer; the write is in flight."));
  const next = ctl.switchContext({ actorRef: QUALIFICATION_GUEST_ACTOR });
  calls.push(
    call(
      "switchContext",
      `context:${next.actorRef}#${next.incarnation}`,
      "CONTEXT_SWITCHED",
      "The actor changed while the write was in flight. The in-flight write becomes unknown.",
    ),
  );
  port.deliverHeld();
  const settled = await pending;
  calls.push(
    call(
      "book.result",
      settled.kind,
      null,
      "The held answer landed after the context changed. It is quarantined and touches nothing in the new context.",
    ),
  );
  const state = ctl.state();
  const unknownIntent = state.intents.find((intent) => intent.intentRef === "q-book-1");
  const leaked =
    settled.kind === "CONFIRMED" || (unknownIntent !== undefined && unknownIntent.outcome === "CONFIRMED");
  push(
    target,
    journey(
      "journey.platform-context-switch",
      "platform-journey-trade",
      "buyer",
      "Buyer trade journey across an actor transition.",
      calls,
      "blocked",
      "The context changed mid-flight: the write is unknown, its late answer is quarantined, and no result from the earlier actor reaches the new view.",
    ),
    exercise(
      "platform.unknown.context-switch",
      "journey.platform-context-switch",
      "unknown",
      "platform-journey-trade",
      "in-flight write UNKNOWN CONTEXT_SWITCHED, its result QUARANTINED, nothing applied in the new context",
      `result ${settled.kind}, intent ${unknownIntent?.outcome ?? "none"}, leaked ${String(leaked)}`,
      settled.kind === "QUARANTINED" && unknownIntent?.outcome === "UNKNOWN" && !leaked,
      "Post-hoc results and actor transitions leak no identity into the current view: the quarantine holds and the earlier context is not reused.",
    ),
  );
}

async function providerClean(target: Executed): Promise<void> {
  const port = createStubProviderJourney({ scenario: "clean" });
  const ctl = new ProviderJourneyController(port, { actorRef: PROVIDER_DESK_ACTOR });
  const calls: QualificationCall[] = [];
  await ctl.refresh();
  calls.push(call("read", ctl.state().readState, null, "The synthetic provider source answered ready."));
  const begin = await ctl.run({ step: "begin", intentRef: "q-begin-1", orderRef: "ord-0001" });
  const checkoutRef = begin.kind === "CONFIRMED" ? begin.intent.refs?.checkoutRef ?? null : null;
  calls.push(call("begin", begin.kind, null, "One synthetic checkout opened."));
  await ctl.refresh();
  if (checkoutRef !== null) {
    port.deliverReturn(checkoutRef);
    calls.push(call("deliverReturn", "returned", null, "A return landing is a source event, never a payment observation."));
    await ctl.refresh();
    const callback = port.deliverCallback(checkoutRef);
    calls.push(
      call("deliverCallback", callback?.result ?? "none", null, "The provider's own report arrived at the synthetic source."),
    );
    await ctl.refresh();
  }
  const observe =
    checkoutRef === null
      ? ({ kind: "NOT_SENT", reason: "unknown-ref", detail: "No checkout to observe." } as const)
      : await ctl.run({ step: "observe", intentRef: "q-observe-1", checkoutRef });
  calls.push(
    call(
      "observe",
      observe.kind,
      observe.kind === "REJECTED" ? observe.intent.code : null,
      "The payment observation is recorded from the provider report, not from the return landing.",
    ),
  );
  await ctl.refresh();
  const issue =
    checkoutRef === null
      ? ({ kind: "NOT_SENT", reason: "unknown-ref", detail: "No checkout to issue against." } as const)
      : await ctl.run({ step: "issue", intentRef: "q-issue-1", checkoutRef });
  calls.push(
    call(
      "issue",
      issue.kind,
      issue.kind === "FENCED" ? issue.fence.reason : null,
      "Issuance stays fenced until a provider report is recorded and observed.",
    ),
  );
  await ctl.refresh();
  const refund = await ctl.run({ step: "refund", intentRef: "q-refund-1", orderRef: "ord-0001" });
  calls.push(
    call(
      "refund",
      refund.kind,
      refund.kind === "REJECTED" ? refund.intent.code : refund.kind === "FENCED" ? refund.fence.reason : null,
      "A refund record executes nothing and returns no funds.",
    ),
  );
  await ctl.refresh();
  const closed =
    begin.kind === "CONFIRMED" &&
    observe.kind === "CONFIRMED" &&
    issue.kind === "CONFIRMED" &&
    refund.kind === "CONFIRMED" &&
    ctl.state().readState === "ready";
  push(
    target,
    journey(
      "journey.provider-checkout",
      "provider-connected-journey",
      "buyer",
      "Buyer provider checkout: begin, return, report, observe, issue, refund record.",
      calls,
      closed ? "closed" : "open",
      closed
        ? "Each leg landed once on the synthetic sandbox. The journey closes on the whole sequence; a sandbox success is not a real payment and the refund record executes nothing."
        : "The sequence did not reach its terminal state.",
    ),
    exercise(
      "provider.success.e2e",
      "journey.provider-checkout",
      "success",
      "provider-connected-journey",
      "begin, observe, issue, and refund each CONFIRMED once on the synthetic sandbox",
      `begin ${begin.kind}, observe ${observe.kind}, issue ${issue.kind}, refund ${refund.kind}`,
      closed,
      "The nominal provider path, end to end. Confirmed legs are recorded per call; the close is the sequence.",
    ),
    exercise(
      "provider.refund.record",
      "journey.provider-checkout",
      "refund",
      "provider-connected-journey",
      "refund CONFIRMED as a record that executes nothing",
      `refund ${refund.kind}`,
      refund.kind === "CONFIRMED",
      `${QUALIFICATION_RULING}. refund_ticket is pinned and never composed; the refund record moves no funds.`,
    ),
  );
}

async function providerDeclined(target: Executed): Promise<void> {
  const port = createStubProviderJourney({ scenario: "declined" });
  const ctl = new ProviderJourneyController(port, { actorRef: PROVIDER_DESK_ACTOR });
  const calls: QualificationCall[] = [];
  await ctl.refresh();
  calls.push(call("read", ctl.state().readState, null, "The synthetic provider source answered ready."));
  const begin = await ctl.run({ step: "begin", intentRef: "q-begin-1", orderRef: "ord-0001" });
  const checkoutRef = begin.kind === "CONFIRMED" ? begin.intent.refs?.checkoutRef ?? null : null;
  calls.push(call("begin", begin.kind, null, "The checkout opened. A per-call confirmed is not a journey close."));
  await ctl.refresh();
  if (checkoutRef !== null) {
    port.deliverReturn(checkoutRef);
    await ctl.refresh();
    const callback = port.deliverCallback(checkoutRef);
    calls.push(call("deliverCallback", callback?.result ?? "none", null, "The provider declined the payment."));
    await ctl.refresh();
  }
  const observe =
    checkoutRef === null
      ? ({ kind: "NOT_SENT", reason: "unknown-ref", detail: "No checkout to observe." } as const)
      : await ctl.run({ step: "observe", intentRef: "q-observe-1", checkoutRef });
  calls.push(
    call(
      "observe",
      observe.kind,
      observe.kind === "REJECTED" ? observe.intent.code : null,
      "The provider's decline is an explicit reject, not an unknown.",
    ),
  );
  await ctl.refresh();
  const issue =
    checkoutRef === null
      ? ({ kind: "NOT_SENT", reason: "unknown-ref", detail: "No checkout to issue against." } as const)
      : await ctl.run({ step: "issue", intentRef: "q-issue-1", checkoutRef });
  calls.push(
    call(
      "issue",
      issue.kind,
      issue.kind === "FENCED" ? issue.fence.reason : null,
      "No payment observation exists, so issuance stays fenced.",
    ),
  );
  const declined =
    begin.kind === "CONFIRMED" &&
    observe.kind === "REJECTED" &&
    observe.intent.code === "PAYMENT_DECLINED" &&
    issue.kind === "FENCED" &&
    issue.fence.reason === "payment-unobserved";
  push(
    target,
    journey(
      "journey.provider-declined",
      "provider-connected-journey",
      "buyer",
      "Buyer provider checkout declined by the provider.",
      calls,
      "open",
      "The provider declined: the observe write is rejected PAYMENT_DECLINED and issuance stays fenced payment-unobserved. The confirmed begin does not close the journey.",
    ),
    exercise(
      "provider.decline.declined",
      "journey.provider-declined",
      "decline",
      "provider-connected-journey",
      "observe REJECTED PAYMENT_DECLINED, issue FENCED payment-unobserved",
      `observe ${observe.kind}${observe.kind === "REJECTED" ? ` ${observe.intent.code}` : ""}, issue ${issue.kind}`,
      declined,
      "An explicit decline stays a decline and the next leg never runs on it.",
    ),
  );
}

async function providerUnqualified(target: Executed): Promise<void> {
  const port = createStubProviderJourney({ scenario: "unqualified" });
  const ctl = new ProviderJourneyController(port, { actorRef: PROVIDER_DESK_ACTOR });
  const calls: QualificationCall[] = [];
  await ctl.refresh();
  calls.push(call("read", ctl.state().readState, null, "The source reports the account unqualified."));
  const begin = await ctl.run({ step: "begin", intentRef: "q-begin-1", orderRef: "ord-0001" });
  const fenced = begin.kind === "FENCED" && begin.fence.reason === "account-unqualified";
  const rejected = begin.kind === "REJECTED" && begin.intent.code === "ACCOUNT_UNQUALIFIED";
  calls.push(
    call(
      "begin",
      begin.kind,
      fenced && begin.kind === "FENCED" ? begin.fence.reason : rejected && begin.kind === "REJECTED" ? begin.intent.code : null,
      "An unqualified actor takes no write: the fence or the source refuses it before any checkout.",
    ),
  );
  push(
    target,
    journey(
      "journey.provider-unqualified",
      "provider-connected-journey",
      "buyer",
      "Buyer provider checkout under an unqualified account.",
      calls,
      "open",
      "The account verdict is unqualified. The first write is refused before a checkout opens; the journey stays open.",
    ),
    exercise(
      "provider.decline.unqualified",
      "journey.provider-unqualified",
      "decline",
      "provider-connected-journey",
      "begin refused account-unqualified",
      `begin ${begin.kind}`,
      fenced || rejected,
      "Qualification is the source's verdict. This run does not qualify the account and does not open a checkout.",
    ),
  );
}

async function providerClaims(target: Executed): Promise<void> {
  const port = createStubProviderJourney({ scenario: "claims-real" });
  const ctl = new ProviderJourneyController(port, { actorRef: PROVIDER_DESK_ACTOR });
  const calls: QualificationCall[] = [];
  await ctl.refresh();
  const state = ctl.state();
  calls.push(
    call(
      "read",
      state.readState,
      state.readState === "refused" ? "CLAIM" : null,
      "The read payload claims a real payment. It is refused whole before any row is applied.",
    ),
  );
  const refused = state.readState === "refused";
  push(
    target,
    journey(
      "journey.provider-claims",
      "provider-connected-journey",
      "buyer",
      "Buyer provider read whose payload claims a real effect.",
      calls,
      "blocked",
      "A payload that claims a real payment or a moved fund is refused whole. Nothing from it reaches the view and no write goes out on it.",
    ),
    exercise(
      "provider.claims.refused",
      "journey.provider-claims",
      "decline",
      "provider-connected-journey",
      "read refused CLAIM before any row applies",
      `read ${state.readState}`,
      refused,
      "Claim refusal is a security property: a tainted payload is refused whole, not cleaned row by row.",
    ),
  );
}

async function mobileCancel(target: Executed): Promise<void> {
  const port = createStubMobileShell({ scenario: "clean" });
  const ctl = new MobileShellController(port, { actorRef: MOBILE_DESK_ACTOR });
  const calls: QualificationCall[] = [];
  await ctl.refresh();
  calls.push(call("read", ctl.state().readState, null, "The synthetic shell source answered ready."));
  const withdraw = await ctl.run({ step: "withdraw", intentRef: "q-withdraw-1", orderRef: "ord-0001" });
  calls.push(
    call(
      "withdraw",
      withdraw.kind,
      withdraw.kind === "REJECTED" ? withdraw.intent.code : null,
      "One cancel write on the pending order. A withdrawal record executes nothing and returns no funds.",
    ),
  );
  await ctl.refresh();
  const state = ctl.state();
  const withdrawn = state.snapshot?.order?.state === "withdrawn";
  push(
    target,
    journey(
      "journey.mobile-cancel",
      "installable-mobile-shell",
      "buyer",
      "Buyer order withdrawal on the installable shell.",
      calls,
      withdrawn && withdraw.kind === "CONFIRMED" ? "closed" : "open",
      "The order's cancel write confirmed and the read shows the order withdrawn. The withdrawal record is a record, not a refund and not moved funds.",
    ),
    exercise(
      "mobile.cancel.withdraw",
      "journey.mobile-cancel",
      "cancel",
      "installable-mobile-shell",
      "withdraw CONFIRMED and the read shows the order withdrawn",
      `withdraw ${withdraw.kind}, order ${state.snapshot?.order?.state ?? "none"}`,
      withdraw.kind === "CONFIRMED" && withdrawn,
      "Cancel is its own write, sent once. It executes nothing at a producer and returns no funds.",
    ),
  );
}

async function mobileRecovery(target: Executed): Promise<void> {
  const port = createStubMobileShell({ scenario: "offline" });
  const ctl = new MobileShellController(port, { actorRef: MOBILE_DESK_ACTOR });
  const calls: QualificationCall[] = [];
  await ctl.refresh();
  calls.push(call("read", ctl.state().readState, null, "The link is down: the read answers offline. This is not an empty shell."));
  port.restoreConnection();
  calls.push(call("restoreConnection", "restored", null, "The link is back. Nothing that was lost is replayed."));
  await ctl.refresh();
  calls.push(call("read", ctl.state().readState, null, "An explicit read lands current evidence."));
  ctl.resume();
  calls.push(call("resume", "resumed", null, "An app resume re-executes nothing and marks the held read resumed."));
  const fenced = await ctl.run({ step: "confirm", intentRef: "q-confirm-1", orderRef: "ord-0001" });
  calls.push(
    call(
      "confirm",
      fenced.kind,
      fenced.kind === "FENCED" ? fenced.fence.reason : null,
      "After a resume, writes stay fenced until an explicit read lands.",
    ),
  );
  await ctl.refresh();
  const confirm = await ctl.run({ step: "confirm", intentRef: "q-confirm-2", orderRef: "ord-0001" });
  calls.push(call("confirm", confirm.kind, null, "The write goes once the read is current again."));
  const recovered =
    ctl.state().readState === "ready" &&
    fenced.kind === "FENCED" &&
    fenced.fence.reason === "snapshot-stale" &&
    confirm.kind === "CONFIRMED";
  push(
    target,
    journey(
      "journey.mobile-recovery",
      "installable-mobile-shell",
      "buyer",
      "Buyer recovery: offline link, restore, explicit read, resume, fenced write, read, write.",
      calls,
      recovered ? "closed" : "open",
      recovered
        ? "Recovery lands only through an explicit read: the resume re-executed nothing, the write stayed fenced until current evidence, then confirmed once."
        : "The recovery sequence did not reach its terminal state.",
    ),
    exercise(
      "mobile.recovery.offline",
      "journey.mobile-recovery",
      "recovery",
      "installable-mobile-shell",
      "offline read, restore replays nothing, resume fences writes, explicit read, confirm CONFIRMED",
      `read ${calls[0]?.outcome}, resume fence ${fenced.kind === "FENCED" ? fenced.fence.reason : fenced.kind}, confirm ${confirm.kind}`,
      recovered,
      "A resume is not a replay and a restored link is not freshness: only an explicit read re-opens the writes.",
    ),
  );
}

async function mobileLost(target: Executed): Promise<void> {
  const port = createStubMobileShell({ scenario: "confirm-lost" });
  const ctl = new MobileShellController(port, { actorRef: MOBILE_DESK_ACTOR });
  const calls: QualificationCall[] = [];
  await ctl.refresh();
  calls.push(call("read", ctl.state().readState, null, "The synthetic shell source answered ready."));
  const confirm = await ctl.run({ step: "confirm", intentRef: "q-confirm-1", orderRef: "ord-0001" });
  calls.push(call("confirm", confirm.kind, null, "The confirm applied at the source and its answer was lost. It may have applied."));
  const due = port.deliverLate();
  for (const delivery of due) {
    const late = ctl.acceptLate(delivery);
    calls.push(call("acceptLate", late.kind, delivery.code, "A late result is recorded evidence only; the write stays unknown."));
  }
  const stayedUnknown = ctl.state().intents.some((intent) => intent.step === "confirm" && intent.outcome === "UNKNOWN");
  push(
    target,
    journey(
      "journey.mobile-lost",
      "installable-mobile-shell",
      "buyer",
      "Buyer order confirm whose answer was lost.",
      calls,
      "blocked",
      "The confirm is unknown and stays unknown: the late result is recorded evidence, the order stays fenced, and the write is never retried.",
    ),
    exercise(
      "mobile.unknown.lost",
      "journey.mobile-lost",
      "unknown",
      "installable-mobile-shell",
      "confirm UNKNOWN, late result RECORDED, write stays unknown",
      `confirm ${confirm.kind}, late ${due.length > 0 ? "recorded" : "none"}, unknown ${String(stayedUnknown)}`,
      confirm.kind === "UNKNOWN" && due.length > 0 && stayedUnknown,
      "An uncertain write is never re-executed: not on a late answer, not on a resume, not on a reconnect.",
    ),
  );
}

async function marketplacePermission(target: Executed): Promise<void> {
  const port: MarketplaceBenchPort = createStubMarketplaceBench({ scenario: "contended" });
  const ctl = new MarketplaceBenchController(port, {});
  const calls: QualificationCall[] = [];
  await ctl.joinQueue();
  calls.push(call("joinQueue", ctl.state().queuePhase, null, "Queue admission is browse access only: not a hold, a payment, a right, or entry."));
  await ctl.refreshQueue();
  const admitted = await ctl.refreshQueue();
  calls.push(call("readQueue", admitted.kind === "APPLIED" ? admitted.phase : admitted.kind, null, "One explicit queue check at a time; nothing polls."));
  port.synthetic("revoke-permission");
  const denied = await ctl.refresh();
  calls.push(
    call(
      "read",
      denied.kind === "APPLIED" ? denied.readState : denied.kind,
      "PERMISSION_REVOKED",
      "The browse permission was revoked at the source: a denial, not an empty market.",
    ),
  );
  port.synthetic("restore-permission");
  const restored = await ctl.refresh();
  calls.push(call("read", restored.kind === "APPLIED" ? restored.readState : restored.kind, null, "Permission restored: a fresh read lands the first window."));
  const next = await ctl.nextPage();
  calls.push(call("nextPage", next.kind === "APPLIED" ? next.readState : next.kind, null, "The next bounded window lands too; the stream delivered new rows."));
  const revoked = denied.kind === "APPLIED" && denied.readState === "denied";
  const recovered =
    restored.kind === "APPLIED" && restored.readState === "ready" && next.kind === "APPLIED" && next.readState === "ready";
  push(
    target,
    journey(
      "journey.marketplace-permission",
      "marketplace-performance-bench",
      "operator",
      "Operator browse across a permission revocation and a restore.",
      calls,
      revoked && recovered ? "closed" : "open",
      revoked && recovered
        ? "The queue admitted browse access, the revoked permission denied the read without rows, and the restored permission let a fresh read land both windows."
        : "The revocation sequence did not reach its terminal state.",
    ),
    exercise(
      "marketplace.permission.revoke",
      "journey.marketplace-permission",
      "permission-revocation",
      "marketplace-performance-bench",
      "read denied PERMISSION_REVOKED while revoked",
      `read ${denied.kind === "APPLIED" ? denied.readState : denied.kind}`,
      revoked,
      "A revocation is enforced at the source, not by hiding a control. The denial is not an empty market.",
    ),
    exercise(
      "marketplace.recovery.restore",
      "journey.marketplace-permission",
      "recovery",
      "marketplace-performance-bench",
      "fresh read ready after permission restore, next window lands",
      `read ${restored.kind === "APPLIED" ? restored.readState : restored.kind}, next ${next.kind === "APPLIED" ? next.readState : next.kind}`,
      recovered,
      "Recovery is an explicit new read, not a replay: the restored read delivers rows the session had not seen.",
    ),
  );
}

async function marketplaceQueueLapsed(target: Executed): Promise<void> {
  const port = createStubMarketplaceBench({ scenario: "queue-lapsed" });
  const ctl = new MarketplaceBenchController(port, { workload: "hot-page" });
  const calls: QualificationCall[] = [];
  const lapsed = await ctl.refresh();
  calls.push(
    call(
      "read",
      lapsed.kind === "APPLIED" ? lapsed.readState : lapsed.kind,
      null,
      "The admission the page held has lapsed: an expired admission grants nothing.",
    ),
  );
  await ctl.joinQueue();
  calls.push(call("joinQueue", ctl.state().queuePhase, null, "Rejoining reports the lapsed admission; it is never revived in place."));
  const recheck = await ctl.refreshQueue();
  calls.push(call("readQueue", recheck.kind === "APPLIED" ? recheck.phase : recheck.kind, null, "One explicit queue check; the admission stays expired."));
  const again = await ctl.refresh();
  calls.push(call("read", again.kind === "APPLIED" ? again.readState : again.kind, null, "The read stays expired; nothing is revived or replayed."));
  const stayedExpired =
    lapsed.kind === "APPLIED" &&
    lapsed.readState === "queue-expired" &&
    again.kind === "APPLIED" &&
    again.readState === "queue-expired";
  push(
    target,
    journey(
      "journey.marketplace-queue-lapsed",
      "marketplace-performance-bench",
      "operator",
      "Operator browse under a lapsed queue admission.",
      calls,
      "open",
      "The lapsed admission granted nothing, is reported as expired on join and on recheck, and is never revived. The journey stays open: there is no admission to read under.",
    ),
    exercise(
      "marketplace.cancel.queue-lapsed",
      "journey.marketplace-queue-lapsed",
      "cancel",
      "marketplace-performance-bench",
      "lapsed admission grants nothing and is never revived",
      `read ${lapsed.kind === "APPLIED" ? lapsed.readState : lapsed.kind}, queue ${ctl.state().queuePhase}, read ${again.kind === "APPLIED" ? again.readState : again.kind}`,
      stayedExpired,
      "The queue's own expiry cancels the admission. It is not revived, not upgraded, and not read as still-held.",
    ),
  );
}

// ---------------------------------------------------------------------------
// Binding-integrity checks
// ---------------------------------------------------------------------------

const NOT_BOUND_CHECK_CONTEXT = "integration-http|kix|qualification-check|1";

async function notBoundCallCount(): Promise<{ calls: number; notBound: number }> {
  const results: boolean[] = [];
  const platform = createNotBoundPlatformJourney();
  results.push((await platform.read({ contextKey: NOT_BOUND_CHECK_CONTEXT, watermarkFloor: null })).kind === "not-bound");
  const platformWrite: PlatformWriteRequest = {
    contextKey: NOT_BOUND_CHECK_CONTEXT,
    actorRef: QUALIFICATION_DESK_ACTOR,
    intentRef: "q-check-1",
    step: "reprice",
    listingRef: "lst-0001",
    nextTier: "tier-1",
  };
  results.push((await platform.submit(platformWrite)).kind === "not-bound");
  const provider = createNotBoundProviderJourney();
  results.push(
    (await provider.read({ contextKey: NOT_BOUND_CHECK_CONTEXT, actorRef: QUALIFICATION_DESK_ACTOR, watermarkFloor: null }))
      .kind === "not-bound",
  );
  const providerWrite: ProviderWriteRequest = {
    contextKey: NOT_BOUND_CHECK_CONTEXT,
    actorRef: QUALIFICATION_DESK_ACTOR,
    intentRef: "q-check-2",
    declaredEnvironment: "sandbox",
    step: "refund",
    orderRef: "ord-0001",
    paymentRef: "pay-0001",
    expectedVersion: 1,
  };
  results.push((await provider.submit(providerWrite)).kind === "not-bound");
  const mobile = createNotBoundMobileShell();
  results.push(
    (
      await mobile.read({
        contextKey: NOT_BOUND_CHECK_CONTEXT,
        actorRef: QUALIFICATION_DESK_ACTOR,
        deviceId: "dev-0001",
        watermarkFloor: null,
        deviceNow: null,
      })
    ).kind === "not-bound",
  );
  const mobileWrite: MobileWriteRequest = {
    step: "install",
    intentRef: "q-check-3",
    contextKey: NOT_BOUND_CHECK_CONTEXT,
    declaredEnvironment: "installable-sandbox",
    actorRef: QUALIFICATION_DESK_ACTOR,
    deviceId: "dev-0001",
    packaging: "installable-web",
  };
  results.push((await mobile.submit(mobileWrite)).kind === "not-bound");
  const market = createNotBoundMarketplaceBench();
  results.push(
    (
      await market.readPage({
        contextKey: NOT_BOUND_CHECK_CONTEXT,
        scope: { tenantId: "ten-0001", subject: "qualification-check" },
        filter: { text: "" },
        pageSize: 1,
        cursor: null,
        watermarkFloor: null,
        termsRef: null,
        workload: "browse-window",
        deviceClass: "desktop-browser",
      })
    ).kind === "not-bound",
  );
  results.push(
    (
      await market.joinQueue({
        contextKey: NOT_BOUND_CHECK_CONTEXT,
        scope: { tenantId: "ten-0001", subject: "qualification-check" },
        workload: "browse-window",
        deviceClass: "desktop-browser",
      })
    ).kind === "not-bound",
  );
  return { calls: results.length, notBound: results.filter(Boolean).length };
}

async function bindingChecks(): Promise<QualificationBindingCheck[]> {
  const checks: QualificationBindingCheck[] = [];
  const notBound = await notBoundCallCount();
  checks.push({
    id: "bindings.not-bound-ports",
    expected: "every integration-http twin answers not-bound on read and write",
    observed: `${notBound.notBound} of ${notBound.calls} calls answered not-bound`,
    verdict: notBound.notBound === notBound.calls ? "recorded" : "deviation",
    note: "The platform trade, provider checkout, mobile shell, and marketplace bench ports stay not-bound on integration-http. There is no stub fallback and no third adapter.",
  });
  const hold = COMMERCE_COMMAND_BINDINGS.placeHold;
  const holdOk =
    hold.status === "not-bound" && hold.consideredAction === "reserve_listing" && QUALIFICATION_HOLD_NOT_BOUND.mappedOntoPrepareTrade === false;
  checks.push({
    id: "bindings.hold-record",
    expected: "placeHold not-bound with consideredAction reserve_listing, never mapped onto prepare_trade",
    observed: `status ${hold.status}, consideredAction ${hold.consideredAction}, mappedOntoPrepareTrade false`,
    verdict: holdOk ? "recorded" : "deviation",
    note: `H1 keeps the locked binding as is. ${hold.reason}`,
  });
  const composed = new Set(QUALIFICATION_NOT_COMPOSED.map((row) => row.action));
  const required = ["capture", "settle_capture", "commit_trade", "open_admission", "admit", "refund_ticket"];
  checks.push({
    id: "bindings.never-composed",
    expected: `${required.join(", ")} recorded as never composed`,
    observed: QUALIFICATION_NOT_COMPOSED.map((row) => row.action).join(", "),
    verdict: required.every((action) => composed.has(action as QualificationNotComposed["action"])) ? "recorded" : "deviation",
    note: "The run composes nothing past accept_trade and sends none of these. Each is a recorded reason, not a mapped body.",
  });
  checks.push({
    id: "bindings.pin-tuple",
    expected: "both OpenAPI pins and protocolMergeSha recorded; SDK, manifest, and vector digests null",
    observed: `contract ${OPENAPI_CONTRACT_PIN.openApiFileSha256.slice(0, 12)}…, gate ${OPENAPI_INTEGRATION_GATE_PIN.openApiFileSha256.slice(0, 12)}…, merge ${OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha.slice(0, 12)}…, sdk/manifest/vector null`,
    verdict: "recorded",
    note: "No producer change is consumed: the pins, PINNED_ACTIONS, the CI KIX_PROTOCOL_GATE_SHA, and protocolMergeSha stay where they were.",
  });
  return checks;
}

// ---------------------------------------------------------------------------
// The run: execute every journey, then assemble the packet
// ---------------------------------------------------------------------------

async function executeAll(): Promise<Executed> {
  const target: Executed = { journeys: [], exercises: [] };
  await platformClean(target);
  await platformRival(target);
  await platformStale(target);
  await platformLate(target);
  await platformContextSwitch(target);
  await providerClean(target);
  await providerDeclined(target);
  await providerUnqualified(target);
  await providerClaims(target);
  await mobileCancel(target);
  await mobileRecovery(target);
  await mobileLost(target);
  await marketplacePermission(target);
  await marketplaceQueueLapsed(target);
  return target;
}

function buildQualificationPacket(
  packetId: string,
  executed: Executed,
  checks: readonly QualificationBindingCheck[],
): QualificationPacket {
  const coveredClasses = new Set(
    executed.exercises.filter((item) => item.verdict === "recorded").map((item) => item.klass),
  );
  const closed = executed.journeys.filter((item) => item.verdict === "closed").length;
  const blocked = executed.journeys.filter((item) => item.verdict === "blocked").length;
  const recorded = executed.exercises.filter((item) => item.verdict === "recorded").length;
  return {
    packetId,
    environment: "stub",
    generatedAt: QUALIFICATION_AS_OF,
    qualificationState: QUALIFICATION_STATE,
    ruling: QUALIFICATION_RULING,
    pins: {
      contractOpenApiSha256: OPENAPI_CONTRACT_PIN.openApiFileSha256,
      gateOpenApiSha256: OPENAPI_INTEGRATION_GATE_PIN.openApiFileSha256,
      protocolMergeSha: OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha,
      sdkDigest: null,
      manifestDigest: null,
      vectorDigest: null,
      consumedProducerChange: false,
    },
    promotion: {
      promoted: false,
      publicDeploy: false,
      realMoneyApproval: false,
      serviceQualification: false,
      note: "This packet is a synthetic stub record. It is not promoted to a public deployment, a real-money approval, or a service qualification; promotion stays on pending node c-platform-operational-qualification after its external predecessors land.",
    },
    nonClaims: { ...QUALIFICATION_NON_CLAIMS },
    summary: {
      journeys: executed.journeys.length,
      closed,
      open: executed.journeys.filter((item) => item.verdict === "open").length,
      blocked,
      exercises: executed.exercises.length,
      recorded,
      deviations: executed.exercises.length - recorded,
      classesCovered: coveredClasses.size,
      classesTotal: QUALIFICATION_CLASSES.length,
    },
    journeys: executed.journeys,
    exercises: executed.exercises,
    bindingChecks: checks,
    denominators: QUALIFICATION_DENOMINATORS,
    evidence: scopeEvidence(executed.journeys, executed.exercises, checks),
    reviewCandidates: QUALIFICATION_REVIEW_CANDIDATES,
    opsBundle: qualificationOpsBundle(),
    boundaryNote:
      "A per-call confirmed is not an end-to-end journey close: a journey closes on the terminal state of its whole leg sequence only. UNKNOWN, NOT_BOUND, and STALE stay separate and none is a success. A late or post-hoc result is recorded evidence, never a resolution, and a result across an actor transition is quarantined. This packet claims no public deploy, no real-money approval, no real payment, no completed real-user review, no service qualification, no production environment, no completed real integration, and no qualification promotion.",
  };
}

/**
 * The synthetic runner. A run re-executes the whole matrix against fresh stub
 * sources, so two runs of the same port produce identical packets apart from
 * the packet id. No clock, no randomness, no network.
 */
export class StubQualificationRunner implements QualificationRunnerPort {
  readonly environment = "stub" as const;
  readonly source = "synthetic-qualification" as const;
  readonly scenario: QualificationScenario;
  private readonly expectedTuple: DiscoveryReadTuple;
  private readonly held: { release: () => void }[] = [];
  private packetSerial = 0;

  constructor(options: StubQualificationRunnerOptions = {}) {
    this.scenario = options.scenario ?? "clean";
    this.expectedTuple = options.expectedTuple ?? DISCOVERY_READ_TUPLE_LITERALS;
  }

  deliverHeld(): number {
    const releasing = this.held.splice(0, this.held.length);
    for (const entry of releasing) {
      entry.release();
    }
    return releasing.length;
  }

  run(request: QualificationRunRequest): Promise<QualificationRunOutcome> {
    const outcome = this.runNow(request);
    if (this.scenario === "held") {
      return new Promise<QualificationRunOutcome>((resolve) => {
        this.held.push({ release: () => resolve(outcome) });
      });
    }
    return outcome;
  }

  private runNow(request: QualificationRunRequest): Promise<QualificationRunOutcome> {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return Promise.resolve({
        kind: "tuple-changed",
        intentRef: request.intentRef,
        contextKey: request.contextKey,
        field: tuple.field,
        expected: tuple.expected,
        actual: tuple.actual,
      });
    }
    if (typeof request.intentRef !== "string" || request.intentRef.trim().length === 0) {
      return Promise.resolve({
        kind: "invalid-request",
        intentRef: String(request.intentRef),
        contextKey: String(request.contextKey),
        code: "INTENT",
        detail: "A qualification run carries an intent reference chosen by the caller.",
      });
    }
    if (typeof request.contextKey !== "string" || request.contextKey.trim().length === 0) {
      return Promise.resolve({
        kind: "invalid-request",
        intentRef: request.intentRef,
        contextKey: String(request.contextKey),
        code: "CONTEXT",
        detail: "A qualification run carries the caller's context key.",
      });
    }
    if (this.scenario === "read-lost") {
      // The answer to the run never arrives. The intent stays in flight.
      return new Promise<QualificationRunOutcome>(() => {});
    }
    return this.buildPacket(request);
  }

  private async buildPacket(request: QualificationRunRequest): Promise<QualificationRunOutcome> {
    this.packetSerial += 1;
    const executed = await executeAll();
    const checks = await bindingChecks();
    const packet = buildQualificationPacket(`oq-${String(this.packetSerial).padStart(4, "0")}`, executed, checks);
    if (this.scenario === "claims-pass") {
      // A deliberately malformed payload: the packet claims a promotion it can
      // never claim. The controller's packet check leaves the run unknown.
      const tainted = {
        ...packet,
        nonClaims: { ...packet.nonClaims, publicDeploy: true },
        promotion: { ...packet.promotion, promoted: true, publicDeploy: true },
      } as unknown as QualificationPacket;
      return { kind: "ready", intentRef: request.intentRef, contextKey: request.contextKey, packet: tainted };
    }
    return { kind: "ready", intentRef: request.intentRef, contextKey: request.contextKey, packet };
  }
}
