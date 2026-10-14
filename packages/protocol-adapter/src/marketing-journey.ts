import { COMMERCE_COMMAND_BINDINGS } from "./commerce-bindings.js";
import {
  DISCOVERY_PROJECTION_AS_OF,
  DISCOVERY_READ_TUPLE_LITERALS,
  checkDiscoveryReadTuple,
  type DiscoveryReadTuple,
} from "./discovery-read.js";
import { type PinnedAction } from "./openapi-contract-pin.js";
import { PLATFORM_NOT_COMPOSED, type PlatformNotComposed } from "./platform-journey.js";
import { isRecord } from "./record.js";

/**
 * Synthetic marketing benefit source for the marketing journey screen.
 *
 * This is the stub-scope stand-in for the producer read and write contract. The
 * real connection stays pending on kix-protocol:wave7-marketing-contracts and on
 * the unpromoted w7-m01-membership, w7-m02-presale, w7-m03-coupon, and
 * w7-m04-referral nodes. The contract-only catalogue publishes set_consent and
 * authorize_marketing and nothing for eligibility, priority, usage count, coupon
 * budget, referral attribution, or a benefit reclaim, so no producer SDK,
 * manifest, or vector is consumed and this module sends nothing over a network.
 *
 * Consent is consumed here as an observation. Setting consent and authorizing
 * marketing stay on /marketing/m05 under ConsentBind. This source never posts
 * either command and never sends a message: the channel is none.
 *
 * The counts below (usage recorded, budget committed) are moved by this synthetic
 * source on an apply, as a stand-in for the producer. The client copies them as
 * they come and never adds, subtracts, or compares them. A notice, an
 * application, and a reclaim confirm no purchase, pay no reward, and apply no
 * discount: every payload states those non-claims as false or it is refused.
 * Whether a reclaim restores a usage count or a budget is a product policy that
 * is not published, so the source states UNDETERMINED and moves nothing.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const MARKETING_JOURNEY_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const MARKETING_NOT_BOUND_REASON =
  "No current producer tuple exists for the marketing journey: kix-protocol:wave7-marketing-contracts is not merged, and the membership, presale, coupon, and referral nodes are not promoted. The contract-only catalogue publishes set_consent and authorize_marketing only. It has no command or read for membership eligibility, presale priority, a usage count, a coupon budget, a referral attribution, or a benefit reclaim. The marketing journey stays NOT_BOUND on integration-http.";

export const MARKETING_PROJECTION_NAME = "kix.marketing.journey";

/** Fixed instant the synthetic source claims to be built at. */
export const MARKETING_AS_OF = DISCOVERY_PROJECTION_AS_OF;

/** Watermark the stale scenario serves, and the floor a reader holds against it. */
export const MARKETING_STALE_WATERMARK = "2026-10-10T00:00:00.000Z";
export const MARKETING_STALE_FLOOR = "2026-10-12T00:00:00.000Z";

/** The desk's own actor string. It is a context label, not an authentication result. */
export const MARKETING_DESK_ACTOR = "fan-desk";

/** The one subject the desk actor holds a synthetic grant for. */
export const MARKETING_OWN_SUBJECT = "sub-0001";

/** A subject the desk actor holds no grant for. It is also the referrer of the referral benefit. */
export const MARKETING_FOREIGN_SUBJECT = "sub-0002";

/** What the source states where a policy is not published. The page prints it and decides nothing. */
export const MARKETING_UNDETERMINED = "UNDETERMINED";

export const MARKETING_PURPOSE = "benefit-notice";

/** CRM send is none on this journey. The channel is a label, not a sender. */
export const MARKETING_CHANNEL = "none";

export const MARKETING_TIERS = ["none", "fan", "member"] as const;

export type MarketingTier = (typeof MARKETING_TIERS)[number];

export const MARKETING_BENEFIT_KINDS = ["presale", "coupon", "referral"] as const;

export type MarketingBenefitKind = (typeof MARKETING_BENEFIT_KINDS)[number];

/** The source's own verdict for one benefit, read from the last read. The client copies it. */
export const MARKETING_VERDICTS = [
  "eligible",
  "not-eligible",
  "consent-required",
  "consent-withdrawn",
  "authorization-stale",
  "usage-limit-reached",
  "budget-exhausted",
  "attribution-taken",
] as const;

export type MarketingVerdict = (typeof MARKETING_VERDICTS)[number];

export const MARKETING_CONSENT_STATES = ["unset", "granted", "withdrawn"] as const;

export type MarketingConsentState = (typeof MARKETING_CONSENT_STATES)[number];

export const MARKETING_AUTHORIZATION_STATES = ["none", "valid", "stale"] as const;

export type MarketingAuthorizationState = (typeof MARKETING_AUTHORIZATION_STATES)[number];

export const MARKETING_ORDER_STATES = ["open", "cancelled", "refund-observed"] as const;

export type MarketingOrderState = (typeof MARKETING_ORDER_STATES)[number];

export const MARKETING_APPLICATION_STATES = ["applied", "reclaim-due", "reclaimed"] as const;

export type MarketingApplicationState = (typeof MARKETING_APPLICATION_STATES)[number];

export const MARKETING_DUE_REASONS = ["order-cancelled", "refund-observed"] as const;

export type MarketingDueReason = (typeof MARKETING_DUE_REASONS)[number];

export const MARKETING_ATTRIBUTION_STATES = ["unattributed", "attributed-to-referrer", "attributed-elsewhere"] as const;

export type MarketingAttributionState = (typeof MARKETING_ATTRIBUTION_STATES)[number];

/** The synthetic writes. Neither is a desk method and neither is a catalogue command. */
export const MARKETING_STEPS = ["apply", "reclaim"] as const;

export type MarketingStep = (typeof MARKETING_STEPS)[number];

/**
 * The four stages of the user journey. They are four separate lines on the screen.
 * There is no aggregate state, and no stage completes the next one.
 */
export const MARKETING_LANES = ["discover", "apply", "reject", "reclaim"] as const;

export type MarketingLane = (typeof MARKETING_LANES)[number];

export const MARKETING_SCENARIOS = [
  "clean",
  "empty",
  "stale",
  "consent-unset",
  "consent-withdrawn",
  "authorization-stale",
  "usage-limit",
  "attribution-taken",
  "duplicate-elsewhere",
  "budget-race",
  "apply-lost",
  "reclaim-lost",
  "held-response",
  "receipt-claims-reward",
  "snapshot-claims-crm",
  "scope-leak",
  "denied",
] as const;

export type MarketingScenario = (typeof MARKETING_SCENARIOS)[number];

export const MARKETING_REJECT_CODES = [
  "NOT_ELIGIBLE",
  "ELIGIBILITY_STALE",
  "CONSENT_REQUIRED",
  "CONSENT_WITHDRAWN",
  "AUTHORIZATION_STALE",
  "CONSENT_VERSION_STALE",
  "DUPLICATE_USE",
  "USAGE_LIMIT_REACHED",
  "BUDGET_EXHAUSTED",
  "NOT_STACKABLE",
  "ATTRIBUTION_TAKEN",
  "ORDER_NOT_OPEN",
  "UNKNOWN_REF",
  "ALREADY_RECLAIMED",
] as const;

export type MarketingRejectCode = (typeof MARKETING_REJECT_CODES)[number];

/** The one return action the page offers for a rejection. There is no other. */
export type MarketingReturnAction = "read-again" | "manage-consent" | "none";

export const MARKETING_RETURN_ACTIONS: Readonly<Record<MarketingRejectCode, MarketingReturnAction>> = {
  NOT_ELIGIBLE: "none",
  ELIGIBILITY_STALE: "read-again",
  CONSENT_REQUIRED: "manage-consent",
  CONSENT_WITHDRAWN: "manage-consent",
  AUTHORIZATION_STALE: "manage-consent",
  CONSENT_VERSION_STALE: "read-again",
  DUPLICATE_USE: "read-again",
  USAGE_LIMIT_REACHED: "none",
  BUDGET_EXHAUSTED: "none",
  NOT_STACKABLE: "none",
  ATTRIBUTION_TAKEN: "none",
  ORDER_NOT_OPEN: "read-again",
  UNKNOWN_REF: "read-again",
  ALREADY_RECLAIMED: "read-again",
};

export const MARKETING_INVALID_CODES = ["INTENT", "STEP", "IDENTITY", "VERSION"] as const;

export type MarketingInvalidCode = (typeof MARKETING_INVALID_CODES)[number];

export const MARKETING_DENIED_CODES = ["SCOPE_DENIED", "GRANT_REVOKED"] as const;

export type MarketingDeniedCode = (typeof MARKETING_DENIED_CODES)[number];

export const MARKETING_REFUSAL_CODES = ["CLAIM", "SCOPE_LEAK", "REF", "KIND", "STATE", "COUNT"] as const;

export type MarketingRefusalCode = (typeof MARKETING_REFUSAL_CODES)[number];

/**
 * Seven statements every payload makes and none may break. A payload that omits one,
 * or states it as anything but the literal false, is refused whole before a row shows.
 */
export const MARKETING_NON_CLAIM_FIELDS = [
  "noticeConfirmsPurchase",
  "applicationConfirmsPurchase",
  "rewardPaid",
  "discountApplied",
  "crmSendPerformed",
  "crmProductComplete",
  "withdrawnAuthorizationReused",
] as const;

export type MarketingNonClaimField = (typeof MARKETING_NON_CLAIM_FIELDS)[number];

export type MarketingNonClaims = Readonly<Record<MarketingNonClaimField, false>>;

export const MARKETING_SYNTHETIC_CONTROLS = [
  "withdraw-consent",
  "grant-consent",
  "authorize-marketing",
  "lapse-eligibility",
  "cancel-order",
  "refund-order",
] as const;

export type MarketingSyntheticControl = (typeof MARKETING_SYNTHETIC_CONTROLS)[number];

/** Quote of the locked hold binding. H1 keeps this consideredAction and keeps it not-bound. */
export const MARKETING_HOLD_NOT_BOUND = {
  method: "placeHold",
  status: COMMERCE_COMMAND_BINDINGS.placeHold.status,
  consideredAction: COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction,
  reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
  mappedOntoPrepareTrade: false,
} as const;

/**
 * Catalogue commands this module records and does not send. The platform list is
 * reused as is, so the journey list and the refund command keep their own reasons.
 */
export const MARKETING_NOT_COMPOSED: readonly PlatformNotComposed[] = PLATFORM_NOT_COMPOSED;

export interface MarketingConsentNotPosted {
  action: "set_consent" | "authorize_marketing";
  sender: "ConsentBind";
  route: "/marketing/m05";
  reason: string;
}

/**
 * The two published consent commands this journey consumes the result of and never posts.
 * ConsentBind on /marketing/m05 is their only sender.
 */
export const MARKETING_CONSENT_NOT_POSTED: readonly MarketingConsentNotPosted[] = [
  {
    action: "set_consent",
    sender: "ConsentBind",
    route: "/marketing/m05",
    reason: `${MARKETING_JOURNEY_RULING}. This journey reads the consent state the source reports. Setting consent is posted only by ConsentBind on /marketing/m05, never from here.`,
  },
  {
    action: "authorize_marketing",
    sender: "ConsentBind",
    route: "/marketing/m05",
    reason: `${MARKETING_JOURNEY_RULING}. This journey reads whether an authorization is valid at the current consent version. Authorizing marketing is posted only by ConsentBind on /marketing/m05, and a withdrawn or older authorization is never reused here.`,
  },
];

// ---------------------------------------------------------------------------
// Scope registers: what is bound, and what stays outside this journey
// ---------------------------------------------------------------------------

export interface MarketingContractRow {
  id: string;
  /** Field name on this module's snapshot. */
  marketingField: string;
  status: "field-named" | "not-bound";
  /**
   * Published body fields that play the same role. A test reads the vendored pin and
   * checks every entry. Empty for a not-bound row. No body is built from this list.
   */
  bodyFields: readonly { action: PinnedAction; field: string }[];
  reason: string;
}

const NO_CONTRACT =
  "The contract-only catalogue publishes no field for it, and kix-protocol:wave7-marketing-contracts is not merged. The value here is a synthetic observation.";

/**
 * Which concept on the journey has a named field in the pinned catalogue. Naming a
 * field is not binding it. A row with no field is not-bound and the screen invents none.
 */
export const MARKETING_CONTRACT_REGISTER: readonly MarketingContractRow[] = [
  {
    id: "consent-state",
    marketingField: "consent.state",
    status: "field-named",
    bodyFields: [{ action: "set_consent", field: "allowed" }],
    reason: "The pinned set_consent body names allowed. The journey reads the state the source reports and posts nothing.",
  },
  {
    id: "consent-version",
    marketingField: "consent.version",
    status: "field-named",
    bodyFields: [
      { action: "set_consent", field: "expectedConsentVersion" },
      { action: "authorize_marketing", field: "expectedConsentVersion" },
    ],
    reason: "The pinned bodies name expectedConsentVersion. The client copies the version it read and never raises it.",
  },
  {
    id: "consent-purpose",
    marketingField: "consent.purpose",
    status: "field-named",
    bodyFields: [
      { action: "set_consent", field: "purpose" },
      { action: "authorize_marketing", field: "purpose" },
    ],
    reason: "The pinned bodies name purpose. The channel is none on this journey, and the pinned bodies name channel.",
  },
  {
    id: "authorization",
    marketingField: "consent.authorization",
    status: "field-named",
    bodyFields: [{ action: "authorize_marketing", field: "subject" }],
    reason:
      "The pinned authorize_marketing body names a subject and the consent version it was issued at. The journey shows whether an authorization is valid at the current version and reuses none.",
  },
  {
    id: "eligibility",
    marketingField: "membership",
    status: "not-bound",
    bodyFields: [],
    reason: `No membership or qualification field is published. ${NO_CONTRACT}`,
  },
  {
    id: "priority",
    marketingField: "benefits[].priorityRank",
    status: "not-bound",
    bodyFields: [],
    reason: `No presale priority field is published. The rank is the source's own order and the page decides nothing from it. ${NO_CONTRACT}`,
  },
  {
    id: "usage-count",
    marketingField: "benefits[].usage",
    status: "not-bound",
    bodyFields: [],
    reason: `No usage count is published. The page copies the source's figures and never adds or subtracts them. ${NO_CONTRACT}`,
  },
  {
    id: "coupon-budget",
    marketingField: "benefits[].budget",
    status: "not-bound",
    bodyFields: [],
    reason: `No coupon budget is published. The budget is counted in redemptions, carries no amount, and is the source's own text. ${NO_CONTRACT}`,
  },
  {
    id: "referral-attribution",
    marketingField: "benefits[].attribution",
    status: "not-bound",
    bodyFields: [],
    reason: `No referral attribution is published. An attribution is a record of who referred, and it pays no reward. ${NO_CONTRACT}`,
  },
  {
    id: "benefit-application",
    marketingField: "applications[]",
    status: "not-bound",
    bodyFields: [],
    reason: `No command applies a benefit to an order. This is a synthetic write of the page, not a catalogue command. ${NO_CONTRACT}`,
  },
  {
    id: "reclaim",
    marketingField: "applications[].state",
    status: "not-bound",
    bodyFields: [],
    reason: `No command reclaims a benefit, and no policy says whether a reclaim restores a usage count or a budget. The source states ${MARKETING_UNDETERMINED}. ${NO_CONTRACT}`,
  },
];

export interface MarketingCrmScopeRow {
  id: string;
  scope: "consumed" | "outside-this-journey";
  /** A row never completes the CRM product. */
  completesCrm: false;
  reason: string;
}

/**
 * M05 CRM is its own scope (label 미착수). This journey consumes consent and nothing
 * else of it. A consumed row is a read of the source's state. Every other row is outside
 * this journey, is not built here, and is never marked complete by a screen.
 */
export const MARKETING_CRM_SCOPE: readonly MarketingCrmScopeRow[] = [
  {
    id: "consent-state-read",
    scope: "consumed",
    completesCrm: false,
    reason: "The journey reads whether consent is unset, granted, or withdrawn, and at which version.",
  },
  {
    id: "authorization-check",
    scope: "consumed",
    completesCrm: false,
    reason: "The journey reads whether an authorization is valid at the current consent version, and reuses none that is stale or withdrawn.",
  },
  {
    id: "audience-segmentation",
    scope: "outside-this-journey",
    completesCrm: false,
    reason: "Choosing who receives a message is the independent M05 CRM scope. Nothing here selects an audience.",
  },
  {
    id: "campaign-send",
    scope: "outside-this-journey",
    completesCrm: false,
    reason: "The channel is none. Nothing here sends a message, and an authorization is not a send.",
  },
  {
    id: "crm-profile",
    scope: "outside-this-journey",
    completesCrm: false,
    reason: "No customer profile, tag, or history is stored or shown by this journey.",
  },
  {
    id: "data-use-export",
    scope: "outside-this-journey",
    completesCrm: false,
    reason: "No data-use report or export exists here. A UI stub with no contract does not complete a CRM product.",
  },
];

// ---------------------------------------------------------------------------
// Identity. Each kind has its own prefix and one kind is never read as another.
// ---------------------------------------------------------------------------

export const MARKETING_REF_KINDS = ["subject", "benefit", "order", "application"] as const;

export type MarketingRefKind = (typeof MARKETING_REF_KINDS)[number];

const REF_PREFIX: Readonly<Record<MarketingRefKind, string>> = {
  subject: "sub-",
  benefit: "ben-",
  order: "ord-",
  application: "app-",
};

const REF_PATTERN = /^(sub|ben|ord|app)-[0-9]{4}$/;

export function marketingRef(kind: MarketingRefKind, serial: number): string {
  return `${REF_PREFIX[kind]}${String(serial).padStart(4, "0")}`;
}

export function marketingRefKind(ref: string): MarketingRefKind | null {
  if (!REF_PATTERN.test(ref)) {
    return null;
  }
  for (const kind of MARKETING_REF_KINDS) {
    if (ref.startsWith(REF_PREFIX[kind])) {
      return kind;
    }
  }
  return null;
}

export function isMarketingRef(ref: unknown, kind: MarketingRefKind): ref is string {
  return typeof ref === "string" && marketingRefKind(ref) === kind;
}

// ---------------------------------------------------------------------------
// Snapshot and outcome shapes
// ---------------------------------------------------------------------------

export interface MarketingMembership {
  subjectRef: string;
  tier: MarketingTier;
  /** The eligibility basis version. A label the source moves. The client copies it and never raises it. */
  version: number;
}

export interface MarketingAuthorization {
  state: MarketingAuthorizationState;
  /** The consent version the authorization was issued at. Null when none was ever issued. */
  atVersion: number | null;
}

export interface MarketingConsentView {
  state: MarketingConsentState;
  version: number;
  purpose: string;
  channel: string;
  authorization: MarketingAuthorization;
}

export interface MarketingUsage {
  /** Null when the source states no limit. */
  allowed: number | null;
  recorded: number;
}

export interface MarketingBudget {
  unit: "redemption";
  limit: number;
  committed: number;
  state: "available" | "exhausted";
}

export interface MarketingAttribution {
  referrerRef: string;
  state: MarketingAttributionState;
}

export interface MarketingBenefit {
  benefitRef: string;
  kind: MarketingBenefitKind;
  title: string;
  /** The source's own order. The page shows it and decides nothing from it. */
  priorityRank: number;
  exclusiveGroup: string | null;
  requiresConsent: boolean;
  minTier: MarketingTier;
  verdict: MarketingVerdict;
  usage: MarketingUsage;
  budget: MarketingBudget | null;
  attribution: MarketingAttribution | null;
}

export interface MarketingOrder {
  orderRef: string;
  subjectRef: string;
  label: string;
  /** The order source's state, observed here. This journey never changes it. */
  state: MarketingOrderState;
}

export interface MarketingApplication {
  applicationRef: string;
  benefitRef: string;
  orderRef: string;
  subjectRef: string;
  state: MarketingApplicationState;
  dueReason: MarketingDueReason | null;
  channel: "this-desk" | "other-channel";
  eligibilityVersion: number;
  /** The consent version the application relied on. Null when the benefit needs no consent. */
  consentVersion: number | null;
  /** True when this application relied on consent and consent was withdrawn afterwards. */
  consentWithdrawnSince: boolean;
  usageRestoration: typeof MARKETING_UNDETERMINED;
}

export interface MarketingSnapshot {
  /** Read serial on this port. It orders reads and is not a commit position. */
  snapshotId: number;
  /** Advances on every effect at the source. A label, not a version the client may raise. */
  generation: number;
  watermark: string;
  scenario: MarketingScenario;
  subjectRef: string;
  membership: MarketingMembership;
  consent: MarketingConsentView;
  benefits: readonly MarketingBenefit[];
  orders: readonly MarketingOrder[];
  applications: readonly MarketingApplication[];
  nonClaims: MarketingNonClaims;
}

export interface MarketingReceipt {
  step: MarketingStep;
  applicationRef: string;
  benefitRef: string;
  orderRef: string;
  state: "applied" | "reclaimed";
  eligibilityVersion: number | null;
  consentVersion: number | null;
  usageRestoration: string;
  nonClaims: MarketingNonClaims;
}

export interface MarketingReadRequest {
  contextKey: string;
  actorRef: string;
  subjectRef: string;
  watermarkFloor: string | null;
}

interface MarketingWriteBase {
  contextKey: string;
  actorRef: string;
  subjectRef: string;
  /** The caller's intent. The source does not de-duplicate on it. */
  intentRef: string;
}

export type MarketingWriteRequest =
  | (MarketingWriteBase & {
      step: "apply";
      benefitRef: string;
      orderRef: string;
      expectedEligibilityVersion: number;
      expectedConsentVersion: number;
    })
  | (MarketingWriteBase & {
      step: "reclaim";
      applicationRef: string;
    });

export type MarketingTupleChanged = { kind: "tuple-changed"; field: string; expected: string; actual: string };

export type MarketingDenied = { kind: "denied"; code: MarketingDeniedCode; subjectRef: string; detail: string };

export type MarketingRefused = {
  kind: "refused";
  code: MarketingRefusalCode;
  field: string;
  ref: string | null;
  detail: string;
};

export type MarketingReadOutcome =
  | { kind: "ready"; snapshot: MarketingSnapshot }
  | { kind: "empty"; watermark: string; generation: number; snapshotId: number }
  | { kind: "stale"; watermark: string; floor: string }
  | MarketingTupleChanged
  | MarketingDenied
  | MarketingRefused
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export type MarketingWriteOutcome =
  | { kind: "confirmed"; step: MarketingStep; intentRef: string; contextKey: string; receipt: MarketingReceipt }
  | {
      kind: "rejected";
      step: MarketingStep;
      intentRef: string;
      contextKey: string;
      code: MarketingRejectCode;
      detail: string;
    }
  | { kind: "unknown"; step: MarketingStep; intentRef: string; contextKey: string; message: string }
  | {
      kind: "invalid-request";
      step: string;
      intentRef: string;
      contextKey: string;
      code: MarketingInvalidCode;
      detail: string;
    }
  | (MarketingTupleChanged & { step: string; intentRef: string; contextKey: string })
  | (MarketingDenied & { step: string; intentRef: string; contextKey: string })
  | (MarketingRefused & { step: string; intentRef: string; contextKey: string })
  | { kind: "not-bound"; reason: string };

export type MarketingSimulation =
  | { kind: "done"; control: MarketingSyntheticControl; detail: string }
  | { kind: "ignored"; control: string; reason: string };

export interface MarketingSimulationRequest {
  control: MarketingSyntheticControl;
  orderRef?: string;
}

export interface MarketingJourneyPort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic-marketing" | "none";
  readonly scenario: MarketingScenario;
  read(request: MarketingReadRequest): Promise<MarketingReadOutcome>;
  submit(request: MarketingWriteRequest): Promise<MarketingWriteOutcome>;
  /** Synthetic control: an event a real producer would cause. A real producer offers no such call. */
  simulate(request: MarketingSimulationRequest): MarketingSimulation;
  /** Synthetic control: releases responses the held-response scenario is holding. Returns how many. */
  deliverHeld(): number;
}

export interface StubMarketingJourneyOptions {
  scenario?: MarketingScenario;
  /** Expected tuple override. Used to stage a producer change in tests. */
  expectedTuple?: DiscoveryReadTuple;
}

export interface MarketingEffectCounts {
  /** submit calls that reached the source, whatever they returned. */
  submits: number;
  applies: number;
  reclaims: number;
  simulations: number;
}

export function createStubMarketingJourney(options: StubMarketingJourneyOptions = {}): StubMarketingJourney {
  return new StubMarketingJourney(options);
}

export function createNotBoundMarketingJourney(): MarketingJourneyPort {
  const outcome = { kind: "not-bound", reason: MARKETING_NOT_BOUND_REASON } as const;
  return {
    environment: "integration-http",
    source: "none",
    scenario: "clean",
    read() {
      return Promise.resolve({ ...outcome });
    },
    submit() {
      return Promise.resolve({ ...outcome });
    },
    simulate(request) {
      return { kind: "ignored", control: request.control, reason: "not-bound" };
    },
    deliverHeld() {
      return 0;
    },
  };
}

export function marketingJourneyPortFor(
  environment: "stub" | "integration-http",
  options: StubMarketingJourneyOptions = {},
): MarketingJourneyPort {
  if (environment === "stub") {
    return createStubMarketingJourney(options);
  }
  return createNotBoundMarketingJourney();
}

// ---------------------------------------------------------------------------
// Validation at the port boundary
// ---------------------------------------------------------------------------

function includes(list: readonly string[], value: unknown): boolean {
  return typeof value === "string" && list.includes(value);
}

/** The first non-claim field that is missing or is not the literal false, or null. */
export function findMarketingClaim(nonClaims: unknown): MarketingNonClaimField | null {
  if (!isRecord(nonClaims)) {
    return MARKETING_NON_CLAIM_FIELDS[0];
  }
  for (const field of MARKETING_NON_CLAIM_FIELDS) {
    if (nonClaims[field] !== false) {
      return field;
    }
  }
  return null;
}

function refuse(code: MarketingRefusalCode, field: string, ref: string | null, detail: string): MarketingRefused {
  return { kind: "refused", code, field, ref, detail };
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Refuses a snapshot whole when any row breaks a rule. Nothing is returned partially:
 * a refused payload shows no row. The checks are shape and claim checks only. They
 * decide nothing about eligibility, usage, or budget.
 */
export function refuseMarketingSnapshot(snapshot: MarketingSnapshot, requestedSubject: string): MarketingRefused | null {
  const claim = findMarketingClaim(snapshot.nonClaims);
  if (claim !== null) {
    return refuse("CLAIM", `nonClaims.${claim}`, null, `The payload does not state ${claim} as false. The whole payload is refused.`);
  }
  if (snapshot.subjectRef !== requestedSubject || snapshot.membership.subjectRef !== requestedSubject) {
    return refuse("SCOPE_LEAK", "subjectRef", snapshot.subjectRef, `The payload names a subject other than ${requestedSubject}.`);
  }
  if (!includes(MARKETING_TIERS, snapshot.membership.tier) || !isCount(snapshot.membership.version)) {
    return refuse("STATE", "membership", snapshot.membership.subjectRef, "The membership tier or version is not a known value.");
  }
  const consent = snapshot.consent;
  if (!includes(MARKETING_CONSENT_STATES, consent.state) || !includes(MARKETING_AUTHORIZATION_STATES, consent.authorization.state)) {
    return refuse("STATE", "consent", null, "The consent or authorization state is not a known value.");
  }
  if (!isCount(consent.version) || (consent.authorization.atVersion !== null && !isCount(consent.authorization.atVersion))) {
    return refuse("COUNT", "consent.version", null, "A consent version is a whole number.");
  }
  if (consent.state !== "granted" && consent.authorization.state === "valid") {
    return refuse("STATE", "consent.authorization", null, "An authorization cannot be valid while consent is not granted. A withdrawn authorization is not reused.");
  }
  const benefitRefs = new Set<string>();
  for (const benefit of snapshot.benefits) {
    if (!isMarketingRef(benefit.benefitRef, "benefit")) {
      return refuse("REF", "benefits[].benefitRef", String(benefit.benefitRef), "A benefit is named by a benefit reference.");
    }
    if (!includes(MARKETING_BENEFIT_KINDS, benefit.kind) || !includes(MARKETING_VERDICTS, benefit.verdict) || !includes(MARKETING_TIERS, benefit.minTier)) {
      return refuse("KIND", "benefits[]", benefit.benefitRef, "A benefit kind, verdict, or tier is not a known value.");
    }
    if (!isCount(benefit.usage.recorded) || (benefit.usage.allowed !== null && !isCount(benefit.usage.allowed))) {
      return refuse("COUNT", "benefits[].usage", benefit.benefitRef, "A usage figure is a whole number or the source's no-limit null.");
    }
    if (benefit.budget !== null && (!isCount(benefit.budget.limit) || !isCount(benefit.budget.committed) || benefit.budget.unit !== "redemption")) {
      return refuse("COUNT", "benefits[].budget", benefit.benefitRef, "A budget figure is a whole number of redemptions.");
    }
    if (benefit.attribution !== null && !includes(MARKETING_ATTRIBUTION_STATES, benefit.attribution.state)) {
      return refuse("STATE", "benefits[].attribution", benefit.benefitRef, "An attribution state is not a known value.");
    }
    benefitRefs.add(benefit.benefitRef);
  }
  const orderRefs = new Set<string>();
  for (const order of snapshot.orders) {
    if (!isMarketingRef(order.orderRef, "order")) {
      return refuse("REF", "orders[].orderRef", String(order.orderRef), "An order is named by an order reference.");
    }
    if (order.subjectRef !== requestedSubject) {
      return refuse("SCOPE_LEAK", "orders[].subjectRef", order.orderRef, `Order ${order.orderRef} belongs to another subject.`);
    }
    if (!includes(MARKETING_ORDER_STATES, order.state)) {
      return refuse("STATE", "orders[].state", order.orderRef, "An order state is not a known value.");
    }
    orderRefs.add(order.orderRef);
  }
  for (const application of snapshot.applications) {
    if (!isMarketingRef(application.applicationRef, "application")) {
      return refuse("REF", "applications[].applicationRef", String(application.applicationRef), "An application is named by an application reference.");
    }
    if (application.subjectRef !== requestedSubject) {
      return refuse("SCOPE_LEAK", "applications[].subjectRef", application.applicationRef, `Application ${application.applicationRef} belongs to another subject.`);
    }
    if (!includes(MARKETING_APPLICATION_STATES, application.state)) {
      return refuse("STATE", "applications[].state", application.applicationRef, "An application state is not a known value.");
    }
    if (!benefitRefs.has(application.benefitRef) || !orderRefs.has(application.orderRef)) {
      return refuse("REF", "applications[]", application.applicationRef, "An application names a benefit or an order the payload does not list.");
    }
    if (application.usageRestoration !== MARKETING_UNDETERMINED) {
      return refuse("STATE", "applications[].usageRestoration", application.applicationRef, `No policy for restoring a usage count is published, so an application must say ${MARKETING_UNDETERMINED}.`);
    }
  }
  return null;
}

/** Refuses a receipt that claims a purchase, a reward, a discount, a send, or names another call. */
export function refuseMarketingReceipt(receipt: MarketingReceipt, request: MarketingWriteRequest): MarketingRefused | null {
  const claim = findMarketingClaim(receipt.nonClaims);
  if (claim !== null) {
    return refuse("CLAIM", `nonClaims.${claim}`, receipt.applicationRef, `The answer does not state ${claim} as false, so it is not trusted.`);
  }
  if (receipt.step !== request.step) {
    return refuse("KIND", "step", receipt.applicationRef, "The answer is for a different step than the one sent.");
  }
  if (receipt.state !== (request.step === "apply" ? "applied" : "reclaimed")) {
    return refuse("STATE", "state", receipt.applicationRef, "The answer names a state that does not belong to the step that was sent.");
  }
  if (request.step === "reclaim" && receipt.applicationRef !== request.applicationRef) {
    return refuse("REF", "applicationRef", receipt.applicationRef, "The answer names a different application than the one sent.");
  }
  if (request.step === "apply" && (receipt.benefitRef !== request.benefitRef || receipt.orderRef !== request.orderRef)) {
    return refuse("REF", "benefitRef", receipt.applicationRef, "The answer names a different benefit or order than the one sent.");
  }
  if (!isMarketingRef(receipt.applicationRef, "application")) {
    return refuse("REF", "applicationRef", String(receipt.applicationRef), "An application is named by an application reference.");
  }
  if (receipt.usageRestoration !== MARKETING_UNDETERMINED) {
    return refuse("STATE", "usageRestoration", receipt.applicationRef, `No policy for restoring a usage count is published, so the answer must say ${MARKETING_UNDETERMINED}.`);
  }
  return null;
}

// ---------------------------------------------------------------------------
// The synthetic source
// ---------------------------------------------------------------------------

const TIER_ORDER: Readonly<Record<MarketingTier, number>> = { none: 0, fan: 1, member: 2 };

interface BenefitRecord {
  benefitRef: string;
  kind: MarketingBenefitKind;
  title: string;
  priorityRank: number;
  exclusiveGroup: string | null;
  requiresConsent: boolean;
  minTier: MarketingTier;
  usage: MarketingUsage;
  budget: { limit: number; committed: number } | null;
  attribution: MarketingAttribution | null;
}

interface ApplicationRecord {
  applicationRef: string;
  benefitRef: string;
  orderRef: string;
  state: MarketingApplicationState;
  dueReason: MarketingDueReason | null;
  channel: "this-desk" | "other-channel";
  eligibilityVersion: number;
  consentVersion: number | null;
}

const SEED_BENEFITS: readonly BenefitRecord[] = [
  {
    benefitRef: "ben-0001",
    kind: "presale",
    title: "Member presale window",
    priorityRank: 1,
    exclusiveGroup: null,
    requiresConsent: true,
    minTier: "member",
    usage: { allowed: 1, recorded: 0 },
    budget: null,
    attribution: null,
  },
  {
    benefitRef: "ben-0002",
    kind: "coupon",
    title: "Lantern listing coupon",
    priorityRank: 2,
    exclusiveGroup: "coupon",
    requiresConsent: false,
    minTier: "fan",
    usage: { allowed: 1, recorded: 0 },
    budget: { limit: 3, committed: 2 },
    attribution: null,
  },
  {
    benefitRef: "ben-0003",
    kind: "coupon",
    title: "Last ferry coupon",
    priorityRank: 3,
    exclusiveGroup: "coupon",
    requiresConsent: false,
    minTier: "fan",
    usage: { allowed: 1, recorded: 0 },
    budget: { limit: 1, committed: 1 },
    attribution: null,
  },
  {
    benefitRef: "ben-0004",
    kind: "referral",
    title: "Referral attribution",
    priorityRank: 4,
    exclusiveGroup: null,
    requiresConsent: true,
    minTier: "none",
    usage: { allowed: 1, recorded: 0 },
    budget: null,
    attribution: { referrerRef: MARKETING_FOREIGN_SUBJECT, state: "unattributed" },
  },
];

const SEED_ORDERS: readonly { orderRef: string; label: string }[] = [
  { orderRef: "ord-0001", label: "Order candidate A" },
  { orderRef: "ord-0002", label: "Order candidate B" },
];

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function cleanNonClaims(): MarketingNonClaims {
  return {
    noticeConfirmsPurchase: false,
    applicationConfirmsPurchase: false,
    rewardPaid: false,
    discountApplied: false,
    crmSendPerformed: false,
    crmProductComplete: false,
    withdrawnAuthorizationReused: false,
  };
}

/** Synthetic source. State lives in this object, so a new port is a new session. */
export class StubMarketingJourney implements MarketingJourneyPort {
  readonly environment = "stub" as const;
  readonly source = "synthetic-marketing" as const;
  readonly scenario: MarketingScenario;
  private readonly expectedTuple: DiscoveryReadTuple;
  private readonly benefits = new Map<string, BenefitRecord>();
  private readonly orders = new Map<string, { orderRef: string; label: string; state: MarketingOrderState }>();
  private readonly applications = new Map<string, ApplicationRecord>();
  private readonly held: { release: () => void }[] = [];
  private membership: MarketingMembership = { subjectRef: MARKETING_OWN_SUBJECT, tier: "member", version: 3 };
  private consent: MarketingConsentView = {
    state: "granted",
    version: 2,
    purpose: MARKETING_PURPOSE,
    channel: MARKETING_CHANNEL,
    authorization: { state: "valid", atVersion: 2 },
  };
  private generation = 1;
  private snapshotSerial = 0;
  private applicationSerial = 1;
  private raceDone = false;
  private revoked = false;
  private readonly counts: MarketingEffectCounts = { submits: 0, applies: 0, reclaims: 0, simulations: 0 };

  constructor(options: StubMarketingJourneyOptions) {
    this.scenario = options.scenario ?? "clean";
    this.expectedTuple = options.expectedTuple ?? DISCOVERY_READ_TUPLE_LITERALS;
    this.revoked = this.scenario === "denied";
    if (this.scenario !== "empty") {
      for (const benefit of SEED_BENEFITS) {
        this.benefits.set(benefit.benefitRef, {
          ...benefit,
          usage: { ...benefit.usage },
          budget: benefit.budget === null ? null : { ...benefit.budget },
          attribution: benefit.attribution === null ? null : { ...benefit.attribution },
        });
      }
      for (const order of SEED_ORDERS) {
        this.orders.set(order.orderRef, { ...order, state: "open" });
      }
    }
    this.stage();
  }

  /** Test seam. Counts of what reached the source. Not part of the port. */
  effects(): MarketingEffectCounts {
    return { ...this.counts };
  }

  private stage(): void {
    if (this.scenario === "consent-unset") {
      this.consent = { ...this.consent, state: "unset", version: 0, authorization: { state: "none", atVersion: null } };
    } else if (this.scenario === "consent-withdrawn") {
      this.consent = { ...this.consent, state: "withdrawn", version: 3, authorization: { state: "stale", atVersion: 2 } };
    } else if (this.scenario === "authorization-stale") {
      this.consent = { ...this.consent, state: "granted", version: 4, authorization: { state: "stale", atVersion: 2 } };
    } else if (this.scenario === "usage-limit") {
      const coupon = this.benefits.get("ben-0002");
      if (coupon) {
        coupon.usage.recorded = 1;
        coupon.budget = { limit: 3, committed: 3 };
        this.applications.set("app-0001", {
          applicationRef: "app-0001",
          benefitRef: "ben-0002",
          orderRef: "ord-0002",
          state: "applied",
          dueReason: null,
          channel: "other-channel",
          eligibilityVersion: this.membership.version,
          consentVersion: null,
        });
        this.applicationSerial = 2;
      }
    } else if (this.scenario === "attribution-taken") {
      const referral = this.benefits.get("ben-0004");
      if (referral && referral.attribution) {
        referral.attribution = { ...referral.attribution, state: "attributed-elsewhere" };
      }
    }
  }

  read(request: MarketingReadRequest): Promise<MarketingReadOutcome> {
    return Promise.resolve(this.readNow(request));
  }

  deliverHeld(): number {
    const releasing = this.held.splice(0, this.held.length);
    for (const entry of releasing) {
      entry.release();
    }
    return releasing.length;
  }

  submit(request: MarketingWriteRequest): Promise<MarketingWriteOutcome> {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return Promise.resolve({
        kind: "tuple-changed",
        field: tuple.field,
        expected: tuple.expected,
        actual: tuple.actual,
        step: String(request.step),
        intentRef: request.intentRef,
        contextKey: request.contextKey,
      });
    }
    const invalid = this.validate(request);
    if (invalid !== null) {
      return Promise.resolve(invalid);
    }
    const denied = this.gate(request.actorRef, request.subjectRef);
    if (denied !== null) {
      return Promise.resolve({
        ...denied,
        step: request.step,
        intentRef: request.intentRef,
        contextKey: request.contextKey,
      });
    }
    this.counts.submits += 1;
    const outcome = this.apply(request);
    if (this.scenario === "held-response") {
      return new Promise<MarketingWriteOutcome>((resolve) => {
        this.held.push({ release: () => resolve(outcome) });
      });
    }
    return Promise.resolve(outcome);
  }

  simulate(request: MarketingSimulationRequest): MarketingSimulation {
    const done = (detail: string): MarketingSimulation => {
      this.counts.simulations += 1;
      this.generation += 1;
      return { kind: "done", control: request.control, detail };
    };
    const ignored = (reason: string): MarketingSimulation => ({ kind: "ignored", control: request.control, reason });
    switch (request.control) {
      case "withdraw-consent":
        if (this.consent.state === "withdrawn") {
          return ignored("Consent is already withdrawn.");
        }
        this.consent = {
          ...this.consent,
          state: "withdrawn",
          version: this.consent.version + 1,
          authorization: { state: this.consent.authorization.state === "none" ? "none" : "stale", atVersion: this.consent.authorization.atVersion },
        };
        return done("Consent was withdrawn at the source. The earlier authorization is stale and is not reused.");
      case "grant-consent":
        if (this.consent.state === "granted") {
          return ignored("Consent is already granted.");
        }
        this.consent = {
          ...this.consent,
          state: "granted",
          version: this.consent.version + 1,
          authorization: { state: this.consent.authorization.state === "none" ? "none" : "stale", atVersion: this.consent.authorization.atVersion },
        };
        return done("Consent was granted again at the source. No authorization exists at the new version yet.");
      case "authorize-marketing":
        if (this.consent.state !== "granted") {
          return ignored("An authorization needs granted consent.");
        }
        if (this.consent.authorization.state === "valid" && this.consent.authorization.atVersion === this.consent.version) {
          return ignored("An authorization is already valid at this consent version.");
        }
        this.consent = { ...this.consent, authorization: { state: "valid", atVersion: this.consent.version } };
        return done("A new authorization was recorded at the current consent version. No message was sent.");
      case "lapse-eligibility":
        if (this.membership.tier === "none") {
          return ignored("The membership already has no tier.");
        }
        this.membership = {
          ...this.membership,
          tier: this.membership.tier === "member" ? "fan" : "none",
          version: this.membership.version + 1,
        };
        return done(`The membership basis changed to tier ${this.membership.tier} at version ${this.membership.version}.`);
      case "cancel-order":
      case "refund-order": {
        const order = request.orderRef === undefined ? undefined : this.orders.get(request.orderRef);
        if (!order) {
          return ignored("The order is not at the source.");
        }
        const next: MarketingOrderState = request.control === "cancel-order" ? "cancelled" : "refund-observed";
        if (order.state === next || order.state === "refund-observed") {
          return ignored(`Order ${order.orderRef} is already ${order.state}.`);
        }
        order.state = next;
        const reason: MarketingDueReason = next === "cancelled" ? "order-cancelled" : "refund-observed";
        for (const application of this.applications.values()) {
          if (application.orderRef === order.orderRef && application.state === "applied") {
            application.state = "reclaim-due";
            application.dueReason = reason;
          }
        }
        return done(
          next === "cancelled"
            ? `Order ${order.orderRef} was cancelled at the order source. Its applied benefits are due for reclaim, and nothing was reclaimed.`
            : `A refund was observed for order ${order.orderRef} at the order source. Its applied benefits are due for reclaim, and no refund was issued here.`,
        );
      }
      default: {
        const exhaustive: never = request.control;
        return exhaustive;
      }
    }
  }

  private gate(actorRef: string, subjectRef: string): MarketingDenied | null {
    if (this.revoked) {
      return { kind: "denied", code: "GRANT_REVOKED", subjectRef, detail: "The synthetic grant for this subject was withdrawn at the source." };
    }
    if (actorRef !== MARKETING_DESK_ACTOR || subjectRef !== MARKETING_OWN_SUBJECT) {
      return { kind: "denied", code: "SCOPE_DENIED", subjectRef, detail: `Actor ${actorRef} holds no grant for subject ${subjectRef}.` };
    }
    return null;
  }

  private readNow(request: MarketingReadRequest): MarketingReadOutcome {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return { kind: "tuple-changed", field: tuple.field, expected: tuple.expected, actual: tuple.actual };
    }
    const denied = this.gate(request.actorRef, request.subjectRef);
    if (denied !== null) {
      return denied;
    }
    this.snapshotSerial += 1;
    const watermark = this.scenario === "stale" ? MARKETING_STALE_WATERMARK : MARKETING_AS_OF;
    const floor = request.watermarkFloor ?? (this.scenario === "stale" ? MARKETING_STALE_FLOOR : null);
    if (floor !== null && Date.parse(watermark) < Date.parse(floor)) {
      return { kind: "stale", watermark, floor };
    }
    if (this.scenario === "empty") {
      return { kind: "empty", watermark, generation: this.generation, snapshotId: this.snapshotSerial };
    }
    const snapshot = this.buildSnapshot(watermark, request.subjectRef);
    const refused = refuseMarketingSnapshot(snapshot, request.subjectRef);
    if (refused !== null) {
      return refused;
    }
    return { kind: "ready", snapshot };
  }

  private verdictFor(benefit: BenefitRecord): MarketingVerdict {
    if (TIER_ORDER[this.membership.tier] < TIER_ORDER[benefit.minTier]) {
      return "not-eligible";
    }
    if (benefit.requiresConsent) {
      if (this.consent.state === "unset") {
        return "consent-required";
      }
      if (this.consent.state === "withdrawn") {
        return "consent-withdrawn";
      }
      if (!this.authorizationValid()) {
        return "authorization-stale";
      }
    }
    if (benefit.usage.allowed !== null && benefit.usage.recorded >= benefit.usage.allowed) {
      return "usage-limit-reached";
    }
    if (benefit.budget !== null && benefit.budget.committed >= benefit.budget.limit) {
      return "budget-exhausted";
    }
    if (benefit.attribution !== null && benefit.attribution.state === "attributed-elsewhere") {
      return "attribution-taken";
    }
    return "eligible";
  }

  private authorizationValid(): boolean {
    return this.consent.authorization.state === "valid" && this.consent.authorization.atVersion === this.consent.version;
  }

  private buildSnapshot(watermark: string, subjectRef: string): MarketingSnapshot {
    const benefits: MarketingBenefit[] = [...this.benefits.values()].map((benefit) => ({
      benefitRef: benefit.benefitRef,
      kind: benefit.kind,
      title: benefit.title,
      priorityRank: benefit.priorityRank,
      exclusiveGroup: benefit.exclusiveGroup,
      requiresConsent: benefit.requiresConsent,
      minTier: benefit.minTier,
      verdict: this.verdictFor(benefit),
      usage: { ...benefit.usage },
      budget:
        benefit.budget === null
          ? null
          : {
              unit: "redemption",
              limit: benefit.budget.limit,
              committed: benefit.budget.committed,
              state: benefit.budget.committed >= benefit.budget.limit ? "exhausted" : "available",
            },
      attribution: benefit.attribution === null ? null : { ...benefit.attribution },
    }));
    const applications: MarketingApplication[] = [...this.applications.values()].map((record) => this.applicationView(record, subjectRef));
    const nonClaims: Record<string, boolean> = { ...cleanNonClaims() };
    if (this.scenario === "snapshot-claims-crm") {
      nonClaims.crmProductComplete = true;
    }
    const snapshot: MarketingSnapshot = {
      snapshotId: this.snapshotSerial,
      generation: this.generation,
      watermark,
      scenario: this.scenario,
      subjectRef,
      membership: { ...this.membership },
      consent: { ...this.consent, authorization: { ...this.consent.authorization } },
      benefits,
      orders: [...this.orders.values()].map((order) => ({
        orderRef: order.orderRef,
        subjectRef,
        label: order.label,
        state: order.state,
      })),
      applications,
      nonClaims: nonClaims as unknown as MarketingNonClaims,
    };
    if (this.scenario === "scope-leak") {
      return {
        ...snapshot,
        applications: [
          ...applications,
          {
            applicationRef: "app-0099",
            benefitRef: "ben-0001",
            orderRef: "ord-0001",
            subjectRef: MARKETING_FOREIGN_SUBJECT,
            state: "applied",
            dueReason: null,
            channel: "other-channel",
            eligibilityVersion: this.membership.version,
            consentVersion: null,
            consentWithdrawnSince: false,
            usageRestoration: MARKETING_UNDETERMINED,
          },
        ],
      };
    }
    return snapshot;
  }

  private applicationView(record: ApplicationRecord, subjectRef: string): MarketingApplication {
    const relied = record.consentVersion !== null;
    return {
      applicationRef: record.applicationRef,
      benefitRef: record.benefitRef,
      orderRef: record.orderRef,
      subjectRef,
      state: record.state,
      dueReason: record.dueReason,
      channel: record.channel,
      eligibilityVersion: record.eligibilityVersion,
      consentVersion: record.consentVersion,
      consentWithdrawnSince: relied && this.consent.state === "withdrawn",
      usageRestoration: MARKETING_UNDETERMINED,
    };
  }

  private invalid(
    request: { step: unknown; intentRef: unknown; contextKey: unknown },
    code: MarketingInvalidCode,
    detail: string,
  ): MarketingWriteOutcome {
    return {
      kind: "invalid-request",
      step: String(request.step),
      intentRef: String(request.intentRef),
      contextKey: String(request.contextKey),
      code,
      detail,
    };
  }

  private validate(request: MarketingWriteRequest): MarketingWriteOutcome | null {
    if (!nonEmpty(request.intentRef) || !nonEmpty(request.contextKey)) {
      return this.invalid(request, "INTENT", "A write carries an intent reference and a context key.");
    }
    if (!includes(MARKETING_STEPS, request.step)) {
      return this.invalid(request, "STEP", `Step ${String(request.step)} is not a marketing step.`);
    }
    if (!isMarketingRef(request.subjectRef, "subject")) {
      return this.invalid(request, "IDENTITY", "A write names its subject by a subject reference.");
    }
    if (request.step === "apply") {
      if (!isMarketingRef(request.benefitRef, "benefit") || !isMarketingRef(request.orderRef, "order")) {
        return this.invalid(request, "IDENTITY", "An apply names a benefit and an order by their own reference kinds.");
      }
      if (!Number.isInteger(request.expectedEligibilityVersion) || !Number.isInteger(request.expectedConsentVersion)) {
        return this.invalid(request, "VERSION", "The expected eligibility and consent versions are whole numbers.");
      }
    } else if (!isMarketingRef(request.applicationRef, "application")) {
      return this.invalid(request, "IDENTITY", "A reclaim names an application reference, not a benefit or an order.");
    }
    return null;
  }

  private rejected(request: MarketingWriteRequest, code: MarketingRejectCode, detail: string): MarketingWriteOutcome {
    return {
      kind: "rejected",
      step: request.step,
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      code,
      detail,
    };
  }

  private lost(request: MarketingWriteRequest, message: string): MarketingWriteOutcome {
    return {
      kind: "unknown",
      step: request.step,
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      message,
    };
  }

  private apply(request: MarketingWriteRequest): MarketingWriteOutcome {
    return request.step === "apply" ? this.applyBenefit(request) : this.reclaimBenefit(request);
  }

  /** Answers with the receipt, or with a refusal when the answer breaks a rule. */
  private answer(request: MarketingWriteRequest, receipt: MarketingReceipt): MarketingWriteOutcome {
    const refused = refuseMarketingReceipt(receipt, request);
    if (refused !== null) {
      return {
        ...refused,
        step: request.step,
        intentRef: request.intentRef,
        contextKey: request.contextKey,
      };
    }
    return {
      kind: "confirmed",
      step: request.step,
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      receipt,
    };
  }

  private live(orderRef: string, benefitRef: string): ApplicationRecord | undefined {
    return [...this.applications.values()].find(
      (item) => item.orderRef === orderRef && item.benefitRef === benefitRef && item.state !== "reclaimed",
    );
  }

  private applyBenefit(request: Extract<MarketingWriteRequest, { step: "apply" }>): MarketingWriteOutcome {
    const benefit = this.benefits.get(request.benefitRef);
    if (!benefit) {
      return this.rejected(request, "UNKNOWN_REF", `Benefit ${request.benefitRef} is not at the source.`);
    }
    const order = this.orders.get(request.orderRef);
    if (!order) {
      return this.rejected(request, "UNKNOWN_REF", `Order ${request.orderRef} is not at the source.`);
    }
    if (this.scenario === "duplicate-elsewhere" && !this.raceDone) {
      this.raceDone = true;
      this.recordApplication(benefit, order.orderRef, "other-channel");
    }
    if (this.scenario === "budget-race" && !this.raceDone && benefit.budget !== null) {
      this.raceDone = true;
      benefit.budget.committed = benefit.budget.limit;
    }
    if (order.state !== "open") {
      return this.rejected(request, "ORDER_NOT_OPEN", `Order ${order.orderRef} is ${order.state} at the order source.`);
    }
    if (benefit.requiresConsent) {
      if (this.consent.state === "unset") {
        return this.rejected(request, "CONSENT_REQUIRED", "No consent is recorded. This benefit needs marketing consent.");
      }
      if (this.consent.state === "withdrawn") {
        return this.rejected(request, "CONSENT_WITHDRAWN", "Consent was withdrawn. The earlier authorization is not reused, and this benefit needs a new one after consent is granted again.");
      }
      if (!this.authorizationValid()) {
        return this.rejected(request, "AUTHORIZATION_STALE", "The authorization was issued at an older consent version. It is not reused. A new authorization is needed.");
      }
      if (request.expectedConsentVersion !== this.consent.version) {
        return this.rejected(request, "CONSENT_VERSION_STALE", `The consent version is no longer ${request.expectedConsentVersion}.`);
      }
    }
    if (request.expectedEligibilityVersion !== this.membership.version) {
      return this.rejected(request, "ELIGIBILITY_STALE", `The membership basis is no longer at version ${request.expectedEligibilityVersion}.`);
    }
    if (TIER_ORDER[this.membership.tier] < TIER_ORDER[benefit.minTier]) {
      return this.rejected(request, "NOT_ELIGIBLE", `Membership tier ${this.membership.tier} does not qualify for ${benefit.benefitRef}.`);
    }
    const existing = this.live(order.orderRef, benefit.benefitRef);
    if (existing) {
      return this.rejected(request, "DUPLICATE_USE", `Benefit ${benefit.benefitRef} is already applied to ${order.orderRef} (${existing.applicationRef}).`);
    }
    if (benefit.exclusiveGroup !== null) {
      const rival = [...this.applications.values()].find((item) => {
        const other = this.benefits.get(item.benefitRef);
        return (
          item.orderRef === order.orderRef &&
          item.state !== "reclaimed" &&
          other !== undefined &&
          other.exclusiveGroup === benefit.exclusiveGroup &&
          other.benefitRef !== benefit.benefitRef
        );
      });
      if (rival) {
        return this.rejected(request, "NOT_STACKABLE", `${rival.benefitRef} (${rival.applicationRef}) is already applied to ${order.orderRef} in the same group.`);
      }
    }
    if (benefit.usage.allowed !== null && benefit.usage.recorded >= benefit.usage.allowed) {
      return this.rejected(request, "USAGE_LIMIT_REACHED", `Benefit ${benefit.benefitRef} reached the usage the source allows.`);
    }
    if (benefit.budget !== null && benefit.budget.committed >= benefit.budget.limit) {
      return this.rejected(request, "BUDGET_EXHAUSTED", `The coupon budget of ${benefit.benefitRef} is exhausted at the source.`);
    }
    if (benefit.attribution !== null && benefit.attribution.state === "attributed-elsewhere") {
      return this.rejected(request, "ATTRIBUTION_TAKEN", "This subject is already attributed to another referrer.");
    }
    const record = this.recordApplication(benefit, order.orderRef, "this-desk");
    this.counts.applies += 1;
    if (this.scenario === "apply-lost") {
      return this.lost(request, "The response to the apply never arrived. The source may have applied it.");
    }
    const receipt: MarketingReceipt = {
      step: "apply",
      applicationRef: record.applicationRef,
      benefitRef: benefit.benefitRef,
      orderRef: order.orderRef,
      state: "applied",
      eligibilityVersion: record.eligibilityVersion,
      consentVersion: record.consentVersion,
      usageRestoration: MARKETING_UNDETERMINED,
      nonClaims: cleanNonClaims(),
    };
    if (this.scenario === "receipt-claims-reward") {
      (receipt.nonClaims as Record<string, boolean>).rewardPaid = true;
    }
    return this.answer(request, receipt);
  }

  private recordApplication(benefit: BenefitRecord, orderRef: string, channel: "this-desk" | "other-channel"): ApplicationRecord {
    const applicationRef = marketingRef("application", this.applicationSerial);
    this.applicationSerial += 1;
    const record: ApplicationRecord = {
      applicationRef,
      benefitRef: benefit.benefitRef,
      orderRef,
      state: "applied",
      dueReason: null,
      channel,
      eligibilityVersion: this.membership.version,
      consentVersion: benefit.requiresConsent ? this.consent.version : null,
    };
    this.applications.set(applicationRef, record);
    benefit.usage.recorded += 1;
    if (benefit.budget !== null) {
      benefit.budget.committed += 1;
    }
    if (benefit.attribution !== null && benefit.attribution.state === "unattributed") {
      benefit.attribution = { ...benefit.attribution, state: "attributed-to-referrer" };
    }
    this.generation += 1;
    return record;
  }

  private reclaimBenefit(request: Extract<MarketingWriteRequest, { step: "reclaim" }>): MarketingWriteOutcome {
    const record = this.applications.get(request.applicationRef);
    if (!record) {
      return this.rejected(request, "UNKNOWN_REF", `Application ${request.applicationRef} is not at the source.`);
    }
    if (record.state === "reclaimed") {
      return this.rejected(request, "ALREADY_RECLAIMED", `Application ${record.applicationRef} was already reclaimed.`);
    }
    record.state = "reclaimed";
    this.generation += 1;
    this.counts.reclaims += 1;
    if (this.scenario === "reclaim-lost") {
      return this.lost(request, "The response to the reclaim never arrived. The source may have applied it.");
    }
    return this.answer(request, {
      step: "reclaim",
      applicationRef: record.applicationRef,
      benefitRef: record.benefitRef,
      orderRef: record.orderRef,
      state: "reclaimed",
      eligibilityVersion: null,
      consentVersion: record.consentVersion,
      usageRestoration: MARKETING_UNDETERMINED,
      nonClaims: cleanNonClaims(),
    });
  }
}
