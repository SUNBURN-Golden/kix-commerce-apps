import { COMMERCE_COMMAND_BINDINGS } from "./commerce-bindings.js";
import { FIXTURE_SCREENS, liveTupleKey } from "./contract-fixtures.js";
import {
  DISCOVERY_PROJECTION_AS_OF,
  DISCOVERY_READ_TUPLE_LITERALS,
  checkDiscoveryReadTuple,
  type DiscoveryReadTuple,
} from "./discovery-read.js";
import { OPENAPI_INTEGRATION_GATE_PIN } from "./integration-gate-pin.js";
import { OPENAPI_CONTRACT_PIN, PINNED_ACTIONS, PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import { OperationalQualificationController } from "./operational-qualification-controller.js";
import {
  QUALIFICATION_DESK_ACTOR,
  QUALIFICATION_NOT_COMPOSED,
  createStubQualificationRunner,
} from "./operational-qualification.js";
import { isRecord } from "./record.js";

/**
 * Synthetic platform release runner for the release candidate and user review
 * screen.
 *
 * This is the stub-scope stand-in for pending node c-platform-release (plan
 * revision 2026-10-13, 준태님 승인). The real final review and operations
 * handoff stays pending on that node, which is not promoted, waits on the
 * external kix-protocol:k-platform-release, and carries a RELEASE gate plus
 * the user RELEASE decision. No producer SDK, manifest, or vector is
 * consumed, so those digests stay null and this module sends nothing over a
 * network.
 *
 * A run records one release candidate packet: the producer/consumer source
 * and the synthetic artifact and config tuple it was built under, the
 * technical qualification record it re-ran through the sibling qualification
 * controller, the install/publish/operate decisions it presents to the user
 * and never takes, the five handoff lanes, and the deferred-scope and
 * unresolved items on their own denominators. The packet's candidate tupleKey
 * is the live tuple key at build time; a packet recorded under a different
 * source or contract is refused whole, because an approval for a different
 * UI or contract is never reused. Technical qualification stays technical
 * evidence only and is never counted as real user acceptance, and nothing
 * here starts a public deploy, real money, or real operations before the
 * user RELEASE decision.
 *
 * The packet a run produces is a record, not a release. Its releaseState is
 * STUB_CANDIDATE_RECORDED and every non-claim is a literal false. A packet
 * that claims otherwise is refused whole; an untrusted packet leaves the run
 * unknown.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const RELEASE_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const RELEASE_NOT_BOUND_REASON =
  "No current producer tuple exists for a release candidate: pending node c-platform-release is not promoted, kix-protocol:k-platform-release is not merged, the RELEASE gate has not run, and the user RELEASE decision is not taken. The release run stays not-bound on integration-http.";

export const RELEASE_PROJECTION_NAME = "kix.platform.release";

/** Fixed instant the synthetic packet claims to be built at. A label, not a clock read. */
export const RELEASE_AS_OF = DISCOVERY_PROJECTION_AS_OF;

/** The desk's own actor string. It is a context label, not an authentication result. */
export const RELEASE_DESK_ACTOR = "release-runner";

/** A second actor for the context switch. Context label, not an authentication result. */
export const RELEASE_GUEST_ACTOR = "release-reviewer";

/** The intent reference the runner uses for the inner qualification run. A label, not a user intent. */
export const RELEASE_QUALIFICATION_INTENT = "rel-qualification-1";

/**
 * The three decisions this packet presents and never takes (the node goal).
 * install rests on the verified stub scope; publish and operate stay
 * not-open at stub scope.
 */
export const RELEASE_DECISION_ITEMS = ["install", "publish", "operate"] as const;

export type ReleaseDecisionItem = (typeof RELEASE_DECISION_ITEMS)[number];

/** The five handoff lanes (scope item 2). */
export const RELEASE_HANDOFF_LANES = [
  "support",
  "incident",
  "privacy",
  "accessibility",
  "update-rollback",
] as const;

export type ReleaseHandoffLane = (typeof RELEASE_HANDOFF_LANES)[number];

/**
 * The five final-denominator areas (scope item 3). Deferred scope and
 * unresolved items are reported per area on its own denominator and are
 * never merged into one readiness figure.
 */
export const RELEASE_DENOMINATOR_AREAS = [
  "scope",
  "acceptance",
  "environment",
  "operations",
  "gate",
] as const;

export type ReleaseDenominatorArea = (typeof RELEASE_DENOMINATOR_AREAS)[number];

export const RELEASE_SCENARIOS = ["clean", "held", "read-lost", "claims-pass"] as const;

export type ReleaseScenario = (typeof RELEASE_SCENARIOS)[number];

export const RELEASE_INVALID_CODES = ["INTENT", "CONTEXT"] as const;

export type ReleaseInvalidCode = (typeof RELEASE_INVALID_CODES)[number];

export const RELEASE_REFUSAL_CODES = ["CLAIM", "TUPLE", "DECIDED"] as const;

export type ReleaseRefusalCode = (typeof RELEASE_REFUSAL_CODES)[number];

/** The only release state a stub packet ever states. It is never RELEASED. */
export const RELEASE_STATE = "STUB_CANDIDATE_RECORDED" as const;

/**
 * The non-claims this packet always states as literal false. A packet or a
 * receipt that claims one of them is refused whole or untrusted.
 */
export const RELEASE_NON_CLAIM_FIELDS = [
  "released",
  "publicDeploy",
  "realMoneyApproval",
  "realUserAcceptance",
  "realOperationsStarted",
  "productionEnvironment",
  "realIntegrationComplete",
  "releasePromoted",
  "approvalReusedAcrossTuple",
] as const;

export type ReleaseNonClaimField = (typeof RELEASE_NON_CLAIM_FIELDS)[number];

export type ReleaseNonClaims = Readonly<Record<ReleaseNonClaimField, false>>;

const RELEASE_NON_CLAIMS: ReleaseNonClaims = {
  released: false,
  publicDeploy: false,
  realMoneyApproval: false,
  realUserAcceptance: false,
  realOperationsStarted: false,
  productionEnvironment: false,
  realIntegrationComplete: false,
  releasePromoted: false,
  approvalReusedAcrossTuple: false,
};

/** Quote of the locked hold binding. H1 keeps this consideredAction and keeps it not-bound. */
export const RELEASE_HOLD_NOT_BOUND = {
  method: "placeHold",
  status: COMMERCE_COMMAND_BINDINGS.placeHold.status,
  consideredAction: COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction,
  reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
  mappedOntoPrepareTrade: false,
} as const;

/** The actions this packet records and never composes: the shared not-composed list. */
export const RELEASE_NOT_COMPOSED = QUALIFICATION_NOT_COMPOSED;

// ---------------------------------------------------------------------------
// Packet shapes
// ---------------------------------------------------------------------------

/** The pinned producer tuple the candidate was recorded under. */
export interface ReleaseProducerPin {
  contractOpenApiSha256: string;
  contractInfoVersion: string;
  contractMainSha: string;
  gateOpenApiSha256: string;
  protocolMergeSha: string;
  protocolFeatureSha: string;
  sourceProtocolContractSha256: string;
  domain: string;
  pinnedActionCount: number;
  sdkDigest: null;
  manifestDigest: null;
  vectorDigest: null;
  consumedProducerChange: false;
}

/** The consumer side: which working tree and which surface set this candidate covers. */
export interface ReleaseConsumerPin {
  /** The working tree under review. The exact commit SHA is the reviewer's PR record; this module mints none. */
  descriptor: string;
  surfaces: number;
  fixtureCatalogueVersion: string;
  fixtureScreens: number;
}

/** The synthetic artifact descriptor. No real artifact is built, signed, or deployed here. */
export interface ReleaseArtifact {
  kind: "synthetic-descriptor";
  package: "@kix/web";
  build: "npm run build";
  digest: null;
  deployed: false;
  note: string;
}

/** The config tuple the candidate runs under. Every fail-closed rule is named. */
export interface ReleaseConfigTuple {
  defaultMode: "stub";
  httpModes: readonly ["http", "integration-http"];
  baseUrl: "loopback-http-127.0.0.1-only";
  oneAttempt: true;
  retry: false;
  idempotencyKey: false;
  followRedirects: false;
  stubFallback: false;
  proxy: false;
  uiFetch: false;
  productionFlags: false;
  truthFlags: false;
  runtimeEnabled: false;
}

/**
 * The fixed candidate identity. tupleKey is the live tuple key at build
 * time: a packet that names a different tuple is refused whole, and an
 * approval recorded under another UI or contract is never reused.
 */
export interface ReleaseCandidate {
  candidateId: string;
  tupleKey: string;
  producer: ReleaseProducerPin;
  consumer: ReleaseConsumerPin;
  artifact: ReleaseArtifact;
  config: ReleaseConfigTuple;
}

/**
 * The technical qualification record this run executed through the sibling
 * qualification controller. It is technical evidence only and is never
 * counted as real user acceptance.
 */
export interface ReleaseQualification {
  source: "synthetic-qualification";
  runOutcome: string;
  packetId: string | null;
  qualificationState: string | null;
  journeys: number | null;
  closed: number | null;
  open: number | null;
  blocked: number | null;
  exercises: number | null;
  recorded: number | null;
  deviations: number | null;
  classesCovered: number | null;
  classesTotal: number | null;
  technicalOnly: true;
  acceptanceSeparated: true;
  note: string;
}

/** Real user acceptance stays a user decision. It is distinct from the technical qualification. */
export interface ReleaseUserAcceptance {
  state: "PENDING_USER_DECISION";
  realUserAcceptance: false;
  technicalQualificationIsAcceptance: false;
  decidedBy: "user";
  note: string;
}

/** One of the install, publish, or operate decisions. This packet presents it and never takes it. */
export interface ReleaseDecision {
  id: ReleaseDecisionItem;
  title: string;
  decision: "awaiting-user-decision" | "not-open";
  basis: "verified-stub-scope" | "blocked";
  blockedBy: string | null;
  evidence: readonly string[];
  note: string;
}

export interface ReleaseOpsLane {
  lane: ReleaseHandoffLane;
  route: string;
  module: string | null;
  note: string;
  keptSeparate?: readonly string[];
}

/** Scope item 2: support, incident, privacy, accessibility, and update/rollback handoffs. */
export type ReleaseOpsHandoff = Readonly<Record<ReleaseHandoffLane, ReleaseOpsLane>>;

/** One deferred-scope or unresolved item on its own area denominator. */
export interface ReleaseUnresolvedItem {
  id: string;
  /** The pending node, kix-protocol node, gate, or user decision the item waits on. */
  blockedBy: string;
  note: string;
}

export interface ReleaseDenominator {
  area: ReleaseDenominatorArea;
  /** The area's own item count. Areas never share a denominator. */
  denominator: number;
  unresolved: number;
  items: readonly ReleaseUnresolvedItem[];
}

/** One binding-integrity check the run records. */
export interface ReleaseBindingCheck {
  id: string;
  expected: string;
  observed: string;
  verdict: "recorded" | "deviation";
  note: string;
}

export interface ReleasePacket {
  packetId: string;
  environment: "stub";
  /** The synthetic instant label. Not a clock read. */
  generatedAt: string;
  releaseState: typeof RELEASE_STATE;
  ruling: string;
  candidate: ReleaseCandidate;
  qualification: ReleaseQualification;
  userAcceptance: ReleaseUserAcceptance;
  decisions: readonly ReleaseDecision[];
  opsHandoff: ReleaseOpsHandoff;
  denominators: readonly ReleaseDenominator[];
  bindingChecks: readonly ReleaseBindingCheck[];
  release: {
    released: false;
    publicDeploy: false;
    realMoneyApproval: false;
    realOperationsStarted: false;
    note: string;
  };
  nonClaims: ReleaseNonClaims;
  boundaryNote: string;
}

export interface ReleaseRunRequest {
  contextKey: string;
  intentRef: string;
}

export type ReleaseRunOutcome =
  | { kind: "ready"; intentRef: string; contextKey: string; packet: ReleasePacket }
  | {
      kind: "refused";
      intentRef: string;
      contextKey: string;
      code: ReleaseRefusalCode;
      detail: string;
    }
  | {
      kind: "invalid-request";
      intentRef: string;
      contextKey: string;
      code: ReleaseInvalidCode;
      detail: string;
    }
  | { kind: "tuple-changed"; intentRef: string; contextKey: string; field: string; expected: string; actual: string }
  | { kind: "not-bound"; intentRef: string; contextKey: string; reason: string }
  | { kind: "unknown"; intentRef: string; contextKey: string; detail: string };

export interface ReleaseRunnerPort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic-release" | "none";
  readonly scenario: ReleaseScenario;
  run(request: ReleaseRunRequest): Promise<ReleaseRunOutcome>;
  /** Synthetic control: releases a held run answer. A real release gate offers no such call. */
  deliverHeld(): number;
}

export interface StubReleaseRunnerOptions {
  scenario?: ReleaseScenario;
  /** Expected tuple override. Used to stage a producer change in tests. */
  expectedTuple?: DiscoveryReadTuple;
}

export function createStubReleaseRunner(options: StubReleaseRunnerOptions = {}): ReleaseRunnerPort {
  return new StubReleaseRunner(options);
}

export function createNotBoundReleaseRunner(): ReleaseRunnerPort {
  return {
    environment: "integration-http",
    source: "none",
    scenario: "clean",
    run(request: ReleaseRunRequest) {
      return Promise.resolve({
        kind: "not-bound",
        intentRef: request.intentRef,
        contextKey: request.contextKey,
        reason: RELEASE_NOT_BOUND_REASON,
      });
    },
    deliverHeld() {
      return 0;
    },
  };
}

export function releaseRunnerPortFor(
  environment: "stub" | "integration-http",
  options: StubReleaseRunnerOptions = {},
): ReleaseRunnerPort {
  if (environment === "stub") {
    return createStubReleaseRunner(options);
  }
  return createNotBoundReleaseRunner();
}

// ---------------------------------------------------------------------------
// The three user decisions (the node goal)
// ---------------------------------------------------------------------------

export const RELEASE_DECISIONS: readonly ReleaseDecision[] = [
  {
    id: "install",
    title: "Install and run the verified stub scope locally",
    decision: "awaiting-user-decision",
    basis: "verified-stub-scope",
    blockedBy: null,
    evidence: ["npm ci", "npm run typecheck", "npm run build", "KIX_REQUIRE_GATE=0 npm test", "the /handoff install guide"],
    note: "The verified scope is the stub desk on this exact source and contract tuple. The decision is the user's; this packet presents it and decides nothing.",
  },
  {
    id: "publish",
    title: "Publish a public deployment",
    decision: "not-open",
    basis: "blocked",
    blockedBy: "kix-protocol:k-platform-release + pending node c-platform-release + the user RELEASE decision",
    evidence: [],
    note: "A public deploy is a separate authority. It is not open at stub scope and this packet starts none of it.",
  },
  {
    id: "operate",
    title: "Start real operations",
    decision: "not-open",
    basis: "blocked",
    blockedBy: "pending node c-platform-release + the user RELEASE decision + real support, incident, and update wiring",
    evidence: [],
    note: "Real operations need wired support, incident, privacy, and update/rollback lanes plus the user decision. The lanes below are handoff documents, not operating channels.",
  },
];

// ---------------------------------------------------------------------------
// Deferred scope and unresolved items on their own denominators (scope item 3)
// ---------------------------------------------------------------------------

function unresolved(area: ReleaseDenominatorArea, items: readonly ReleaseUnresolvedItem[]): ReleaseDenominator {
  return { area, denominator: items.length, unresolved: items.length, items };
}

/**
 * The deferred scope and the unresolved acceptance, environment, operations,
 * and gate items. Each stays on its own area's denominator; a synthetic run
 * resolves none of them, and the areas never merge into one readiness figure.
 */
export const RELEASE_DENOMINATORS: readonly ReleaseDenominator[] = [
  unresolved("scope", [
    { id: "bind-list-read", blockedBy: "bind-list-read", note: "The contract-only catalogue has no list or read command. listPerformances stays on the stub." },
    { id: "browser-gate-path", blockedBy: "browser-gate-path", note: "The browser path to the loopback gate is not open. There is no proxy." },
    { id: "bind-settlement-fsm", blockedBy: "bind-settlement-fsm", note: "Settlement desk methods stay not-bound. The mock case is not funds." },
    { id: "bind-reservation-fsm", blockedBy: "bind-reservation-fsm", note: "Reservation desk methods stay not-bound. Stub phases are not catalogue commands." },
    { id: "bind-admission-fsm", blockedBy: "bind-admission-fsm", note: "admit stays uncomposed. A credential label and a health probe are not entry." },
    { id: "bind-resale-fsm", blockedBy: "bind-resale-fsm", note: "Resale desk methods stay not-bound. This desk is not a live marketplace." },
    { id: "bind-credit-fsm", blockedBy: "bind-credit-fsm", note: "The catalogue has no credit command. drawCredit is not a disbursement." },
    { id: "bind-wave4-pointers", blockedBy: "bind-wave4-pointers", note: "placeHold stays not-bound with consideredAction reserve_listing. This packet does not remap it." },
    { id: "primary-price-fee-ui", blockedBy: "primary-price-fee-ui", note: "Price and fee display stays UNDETERMINED. This packet computes no amount." },
    { id: "refund-surface", blockedBy: "refund-surface", note: "refund_ticket is not sent. COMPENSATION_UNDEFINED stays visible." },
    { id: "c-discovery-live", blockedBy: "c-discovery-live + kix-protocol:ps-05-query-projections", note: "The discovery projection read is synthetic. A live query projection stays on that pending node." },
    { id: "c-inventory-venue", blockedBy: "c-inventory-venue", note: "Seat and GA selection is a synthetic page. A real inventory and queue read stays on that pending node." },
    { id: "c-platform-journey", blockedBy: "c-platform-journey + kix-protocol:ps-03-resale-contract, ps-04-execution-partitions, ps-05-query-projections", note: "The multi-channel trade page is synthetic. A real listing, trade, payment, transfer, and refund connection stays on that pending node." },
    { id: "c-async-session-fence", blockedBy: "c-async-session-fence", note: "The write fence and the unknown handling on the trade page live in this page load only. Durable session recovery stays on that pending node." },
    { id: "c-merchant-operations", blockedBy: "c-merchant-operations", note: "The merchant workroom is synthetic. A real read model and a real producer export stay on that pending node." },
    { id: "c-credit-origination", blockedBy: "c-credit-origination", note: "The origination desk is synthetic. A real claim basis, policy, consent, document, review, commitment, and drawdown read model stays on that pending node." },
    { id: "c-credit-servicing-journey", blockedBy: "c-credit-servicing-journey + kix-protocol:cr-10-credit-qualification", note: "The servicing desk is synthetic. A real draw, observation, reservation, exposure, schedule, payment, allocation, reversal, adjustment, and case read model stays on that pending node." },
    { id: "c-finance-operations", blockedBy: "c-finance-operations", note: "The finance desk is synthetic. A real reconciliation and accounting export read model stays on that pending node." },
    { id: "c-marketing-journey", blockedBy: "c-marketing-journey + kix-protocol:wave7-marketing-contracts", note: "The benefit journey is synthetic. A real eligibility, usage, budget, attribution, apply, and reclaim read model stays on that pending node. A full CRM product is not built." },
    { id: "c-delegated-assistant", blockedBy: "c-delegated-assistant + kix-protocol:ai-delegation-execution-decision, k-authority-qualification", note: "The delegation assistant is synthetic. A real grant, proposal, approval, and command read model stays on that pending node. Nothing transfers, refunds, or signs." },
    { id: "delegation-surface", blockedBy: "delegation-surface", note: "The delegation screen is synthetic query/propose scope. Execution delegation stays unadopted." },
    { id: "c-tenant-permissions", blockedBy: "c-tenant-permissions + kix-protocol:k-operator-contract", note: "The permissions desk is synthetic. A real permission and audit read model stays on that pending node." },
    { id: "c-notification-inbox", blockedBy: "c-notification-inbox + kix-protocol:k-operator-contract", note: "The notification inbox is synthetic. A real contracted-event feed, dedupe, read state, resolve, and inquiry read model stays on that pending node." },
    { id: "c-provider-connected-journey", blockedBy: "c-provider-connected-journey + kix-protocol:k-provider-sandbox, k-authority-qualification", note: "The provider journey is synthetic. A real approved-provider checkout, payment observation, issuance, and refund connection stays on that pending node." },
    { id: "c-marketplace-performance", blockedBy: "c-marketplace-performance + kix-protocol:ps-07-scale-qualification", note: "The scale bench is synthetic. A real large-marketplace read, queue, device measurement, and producer load qualification stays on that pending node." },
    { id: "c-installable-mobile", blockedBy: "c-installable-mobile", note: "The mobile shell is synthetic. A real packaging, install, update, session, vault, presentation, and device read model stays on that pending node." },
    { id: "c-platform-operational-qualification", blockedBy: "c-platform-operational-qualification + kix-protocol:ps-07-scale-qualification, cr-10-credit-qualification + commerce-integration-closeout", note: "The qualification record this packet cites is synthetic. A real platform, finance, and marketing operational qualification stays on that pending node." },
    { id: "consume-p-sdk-0", blockedBy: "consume-p-sdk-0", note: "No SDK is consumed. SDK, manifest, and vector digests stay null." },
    { id: "c-platform-release", blockedBy: "c-platform-release + kix-protocol:k-platform-release", note: "The real final review and operations handoff stays on that pending node. This packet is its stub-scope stand-in." },
  ]),
  unresolved("acceptance", [
    { id: "acceptance.real-user", blockedBy: "c-platform-release", note: "No real user ran an acceptance review in this session. realUserAcceptance stays false and the state stays PENDING_USER_DECISION." },
    { id: "acceptance.independent-review", blockedBy: "c-platform-release promotion requirements", note: "A non-author exact-HEAD review of this source has not run. The candidate records the working tree, not an approved review." },
    { id: "acceptance.environment-qualification", blockedBy: "kix-protocol:ps-07-scale-qualification, cr-10-credit-qualification + c-platform-operational-qualification", note: "Scope-by-scope real environment qualification is not confirmed. The cited qualification record is synthetic." },
  ]),
  unresolved("environment", [
    { id: "environment.production", blockedBy: "kix-protocol:k-platform-release", note: "No production or public environment exists here. productionEnvironment and publicDeploy stay literal false." },
    { id: "environment.devices", blockedBy: "c-installable-mobile + c-marketplace-performance + kix-protocol:ps-07-scale-qualification", note: "No real handset or tablet ran this desk. An emulated profile is never real mobile evidence." },
    { id: "environment.browser-gate", blockedBy: "browser-gate-path", note: "The browser path to the loopback gate is not open. A Node loopback run is not a browser pass." },
  ]),
  unresolved("operations", [
    { id: "operations.support-channel", blockedBy: "c-platform-release", note: "The support handoff is a document naming the diagnosis split. No real support channel is staffed." },
    { id: "operations.incident-process", blockedBy: "c-platform-release", note: "The incident handoff names the packet module and the pending-producer list. No real on-call or paging exists." },
    { id: "operations.privacy-review", blockedBy: "c-platform-release", note: "The privacy handoff cites the redacted support export and the session consent flags. No real privacy review ran and no real personal data exists here." },
    { id: "operations.update-rollback", blockedBy: "c-platform-release", note: "A new page load is a new session and the candidate is never promoted, so rollback is a recorded no-op. A real update/rollback mechanism is not built." },
  ]),
  unresolved("gate", [
    { id: "gate.k-platform-release", blockedBy: "kix-protocol:k-platform-release", note: "The external producer release node is not merged. This packet consumes no producer change." },
    { id: "gate.release-gate", blockedBy: "c-platform-release", note: "The pending node's RELEASE gate has not run. This stub node carries no gate." },
    { id: "gate.user-release", blockedBy: "the user RELEASE decision", note: "Install, publish, and operate are presented, never taken. No public deploy, real money, or real operations starts before that decision." },
  ]),
];

// ---------------------------------------------------------------------------
// Ops checklist and the support/update handoff guidance (required output 2)
// ---------------------------------------------------------------------------

export function releaseOpsHandoff(): ReleaseOpsHandoff {
  return {
    support: {
      lane: "support",
      route: "/handoff",
      module: "apps/web/src/handoff/packet.ts",
      keptSeparate: ["UNKNOWN", "NOT_BOUND", "STALE", "REJECT"],
      note: "An operator reads a failure class before acting on it: OUTCOME_SEPARATION and TRANSPORT_DIAGNOSES on the handoff packet keep UNKNOWN, NOT_BOUND, STALE, and REJECT separate, and none is a success. This is a document, not a staffed channel.",
    },
    incident: {
      lane: "incident",
      route: "/handoff",
      module: "apps/web/src/handoff/packet.ts",
      keptSeparate: ["UNKNOWN", "NOT_BOUND", "STALE", "REJECT"],
      note: "The handoff packet's own PENDING_PRODUCERS list is the operator-facing pending list; the screen renders its count from the module itself so the number can never drift from it. No real on-call or paging exists at stub scope.",
    },
    privacy: {
      lane: "privacy",
      route: "/receipts",
      module: "apps/web/src/receipt-explorer.ts",
      note: "The support export on /receipts redacts tokens, personal data, and account numbers, and the M05 session consent flags keep channelSend none. No real personal data exists in the synthetic sources, and no real privacy review ran.",
    },
    accessibility: {
      lane: "accessibility",
      route: "(none)",
      module: "apps/web/src/a11y",
      note: "The accessibility baseline adds no route: status words are not color-only, every section is anchored in the page nav, an off control stays focusable with its reason one element away, and focus returns to the status region after a refusal or an unknown.",
    },
    "update-rollback": {
      lane: "update-rollback",
      route: "/handoff",
      module: null,
      note: "A reload clears page-load state and sends nothing again; a new page load is a new session that recovers nothing from a producer. The candidate is never promoted, so rollback is a recorded no-op. A real update/rollback mechanism stays on pending node c-platform-release.",
    },
  };
}

// ---------------------------------------------------------------------------
// Binding-integrity checks
// ---------------------------------------------------------------------------

const RELEASE_CHECK_CONTEXT = "integration-http|kix|release-check|1";

async function bindingChecks(tupleKey: string): Promise<ReleaseBindingCheck[]> {
  const checks: ReleaseBindingCheck[] = [];
  const notBound = await createNotBoundReleaseRunner().run({
    contextKey: RELEASE_CHECK_CONTEXT,
    intentRef: "rel-check-1",
  });
  checks.push({
    id: "bindings.not-bound-port",
    expected: "the integration-http twin answers not-bound on the run",
    observed: `run answered ${notBound.kind}`,
    verdict: notBound.kind === "not-bound" ? "recorded" : "deviation",
    note: "The release run stays not-bound on integration-http. There is no stub fallback, no third adapter, and no request.",
  });
  const hold = COMMERCE_COMMAND_BINDINGS.placeHold;
  const holdOk =
    hold.status === "not-bound" && hold.consideredAction === "reserve_listing" && RELEASE_HOLD_NOT_BOUND.mappedOntoPrepareTrade === false;
  checks.push({
    id: "bindings.hold-record",
    expected: "placeHold not-bound with consideredAction reserve_listing, never mapped onto prepare_trade",
    observed: `status ${hold.status}, consideredAction ${hold.consideredAction}, mappedOntoPrepareTrade false`,
    verdict: holdOk ? "recorded" : "deviation",
    note: `H1 keeps the locked binding as is. ${hold.reason}`,
  });
  const composed = new Set(RELEASE_NOT_COMPOSED.map((row) => row.action));
  const required = ["capture", "settle_capture", "commit_trade", "open_admission", "admit", "refund_ticket"];
  checks.push({
    id: "bindings.never-composed",
    expected: `${required.join(", ")} recorded as never composed`,
    observed: RELEASE_NOT_COMPOSED.map((row) => row.action).join(", "),
    verdict: required.every((action) => composed.has(action as (typeof RELEASE_NOT_COMPOSED)[number]["action"]))
      ? "recorded"
      : "deviation",
    note: "This packet composes nothing past accept_trade and sends none of these. Each is a recorded reason, not a mapped body.",
  });
  checks.push({
    id: "bindings.pin-tuple",
    expected: "both OpenAPI pins, protocolMergeSha, and protocolFeatureSha recorded; SDK, manifest, and vector digests null",
    observed: `contract ${OPENAPI_CONTRACT_PIN.openApiFileSha256.slice(0, 12)}…, gate ${OPENAPI_INTEGRATION_GATE_PIN.openApiFileSha256.slice(0, 12)}…, merge ${OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha.slice(0, 12)}…, feature ${OPENAPI_INTEGRATION_GATE_PIN.protocolFeatureSha.slice(0, 12)}…, sdk/manifest/vector null`,
    verdict: "recorded",
    note: "No producer change is consumed: the pins, PINNED_ACTIONS, the CI KIX_PROTOCOL_GATE_SHA, and protocolMergeSha stay where they were.",
  });
  checks.push({
    id: "bindings.approval-scope",
    expected: "the candidate's recorded tuple key is the live tuple key; an approval under a different UI or contract is never reused",
    observed: `candidate tupleKey ${tupleKey.slice(0, 24)}… ${tupleKey === liveTupleKey() ? "equals" : "differs from"} the live tuple`,
    verdict: tupleKey === liveTupleKey() ? "recorded" : "deviation",
    note: "A release packet is scoped to the exact source and contract tuple it was built under. A packet recorded under a different tuple is refused whole by refuseReleasePacket.",
  });
  return checks;
}

// ---------------------------------------------------------------------------
// Packet integrity
// ---------------------------------------------------------------------------

export interface ReleasePacketRefusal {
  field: string;
  detail: string;
}

/**
 * A packet is trusted only when its structure is whole, every non-claim is a
 * literal false, the state word is STUB_CANDIDATE_RECORDED, the environment
 * word is stub, the release record stays off, every decision is presented
 * and undecided, the user acceptance stays pending, and the candidate tuple
 * key equals the live tuple key — an approval recorded under a different UI
 * or contract is never reused. Anything else, including a malformed body, is
 * refused whole before it reaches the page. This check never throws on any
 * input, so an untrusted answer always leaves the run unknown.
 */
export function refuseReleasePacket(packet: unknown): ReleasePacketRefusal | null {
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
  const claimed = RELEASE_NON_CLAIM_FIELDS.filter((field) => nonClaims[field] !== false);
  if (claimed.length > 0) {
    return {
      field: claimed[0] ?? "nonClaims",
      detail: `The packet claims ${claimed.join(", ")}. A synthetic release packet cannot claim those. Nothing is applied.`,
    };
  }
  if (packet.releaseState !== RELEASE_STATE) {
    return {
      field: "releaseState",
      detail: `The packet states ${String(packet.releaseState)}. A stub packet only states ${RELEASE_STATE}.`,
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
  const release = packet.release;
  if (!isRecord(release)) {
    return {
      field: "release",
      detail: "The packet carries no release record. A malformed packet is refused whole. Nothing is applied.",
    };
  }
  if (
    release.released !== false ||
    release.publicDeploy !== false ||
    release.realMoneyApproval !== false ||
    release.realOperationsStarted !== false
  ) {
    return {
      field: "release",
      detail: "The packet releases, deploys publicly, approves real money, or starts real operations. A stub candidate never does that before the user RELEASE decision.",
    };
  }
  const candidate = packet.candidate;
  if (!isRecord(candidate) || typeof candidate.tupleKey !== "string" || candidate.tupleKey.length === 0) {
    return {
      field: "candidate.tupleKey",
      detail: "The packet carries no candidate tuple key. A release packet is scoped to the exact source and contract it was built under.",
    };
  }
  if (candidate.tupleKey !== liveTupleKey()) {
    return {
      field: "candidate.tupleKey",
      detail: "The packet was recorded under a different source or contract tuple. An approval or a candidate for a different UI or contract is never reused here. Nothing is applied.",
    };
  }
  const userAcceptance = packet.userAcceptance;
  if (!isRecord(userAcceptance)) {
    return {
      field: "userAcceptance",
      detail: "The packet carries no user-acceptance record. A malformed packet is refused whole. Nothing is applied.",
    };
  }
  if (userAcceptance.state !== "PENDING_USER_DECISION" || userAcceptance.realUserAcceptance !== false) {
    return {
      field: "userAcceptance",
      detail: "The packet records a user acceptance or a decided state. Real user acceptance stays a user decision and is never the technical qualification.",
    };
  }
  const qualification = packet.qualification;
  if (!isRecord(qualification)) {
    return {
      field: "qualification",
      detail: "The packet carries no qualification record. A malformed packet is refused whole. Nothing is applied.",
    };
  }
  if (qualification.technicalOnly !== true || qualification.acceptanceSeparated !== true) {
    return {
      field: "qualification",
      detail: "The packet counts the technical qualification as user acceptance. The two stay separate: technical evidence is never real user acceptance.",
    };
  }
  if (!Array.isArray(packet.decisions)) {
    return {
      field: "decisions",
      detail: "The packet carries no decision list. A malformed packet is refused whole. Nothing is applied.",
    };
  }
  const decided = (packet.decisions as unknown[]).filter(
    (item) => isRecord(item) && item.decision !== "awaiting-user-decision" && item.decision !== "not-open",
  );
  if (decided.length > 0) {
    return {
      field: "decisions",
      detail: "The packet records a taken decision. This screen presents install, publish, and operate and takes none of them.",
    };
  }
  if (!Array.isArray(packet.denominators) || packet.denominators.length !== RELEASE_DENOMINATOR_AREAS.length) {
    return { field: "denominators", detail: "The packet does not carry all five final denominators." };
  }
  return null;
}

// ---------------------------------------------------------------------------
// The run: re-run the sibling qualification once, then assemble the packet
// ---------------------------------------------------------------------------

async function runQualification(): Promise<ReleaseQualification> {
  const ctl = new OperationalQualificationController(createStubQualificationRunner({ scenario: "clean" }), {
    actorRef: QUALIFICATION_DESK_ACTOR,
  });
  const result = await ctl.run(RELEASE_QUALIFICATION_INTENT);
  if (result.kind === "CONFIRMED") {
    const summary = result.packet.summary;
    return {
      source: "synthetic-qualification",
      runOutcome: result.kind,
      packetId: result.packet.packetId,
      qualificationState: result.packet.qualificationState,
      journeys: summary.journeys,
      closed: summary.closed,
      open: summary.open,
      blocked: summary.blocked,
      exercises: summary.exercises,
      recorded: summary.recorded,
      deviations: summary.deviations,
      classesCovered: summary.classesCovered,
      classesTotal: summary.classesTotal,
      technicalOnly: true,
      acceptanceSeparated: true,
      note: "The technical qualification record is executed evidence over the synthetic surfaces only. It states STUB_RUN_RECORDED, it is never a service qualification, and it is never counted as real user acceptance.",
    };
  }
  return {
    source: "synthetic-qualification",
    runOutcome: result.kind,
    packetId: null,
    qualificationState: null,
    journeys: null,
    closed: null,
    open: null,
    blocked: null,
    exercises: null,
    recorded: null,
    deviations: null,
    classesCovered: null,
    classesTotal: null,
    technicalOnly: true,
    acceptanceSeparated: true,
    note: `The sibling qualification run answered ${result.kind} instead of recording a packet. That is technical evidence, not user acceptance, and nothing here resolves or retries it.`,
  };
}

function buildReleasePacket(
  packetId: string,
  qualification: ReleaseQualification,
  checks: readonly ReleaseBindingCheck[],
): ReleasePacket {
  const tupleKey = liveTupleKey();
  return {
    packetId,
    environment: "stub",
    generatedAt: RELEASE_AS_OF,
    releaseState: RELEASE_STATE,
    ruling: RELEASE_RULING,
    candidate: {
      candidateId: `candidate-${packetId}`,
      tupleKey,
      producer: {
        contractOpenApiSha256: OPENAPI_CONTRACT_PIN.openApiFileSha256,
        contractInfoVersion: OPENAPI_CONTRACT_PIN.infoVersion,
        contractMainSha: OPENAPI_CONTRACT_PIN.protocolMainSha,
        gateOpenApiSha256: OPENAPI_INTEGRATION_GATE_PIN.openApiFileSha256,
        protocolMergeSha: OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha,
        protocolFeatureSha: OPENAPI_INTEGRATION_GATE_PIN.protocolFeatureSha,
        sourceProtocolContractSha256: OPENAPI_CONTRACT_PIN.sourceProtocolContractSha256,
        domain: PINNED_PROTOCOL_DOMAIN,
        pinnedActionCount: PINNED_ACTIONS.length,
        sdkDigest: null,
        manifestDigest: null,
        vectorDigest: null,
        consumedProducerChange: false,
      },
      consumer: {
        descriptor: "The working tree under review on this branch. The exact source commit SHA is the reviewer's PR record; this packet mints none.",
        surfaces: FIXTURE_SCREENS.length,
        fixtureCatalogueVersion: "1",
        fixtureScreens: FIXTURE_SCREENS.length,
      },
      artifact: {
        kind: "synthetic-descriptor",
        package: "@kix/web",
        build: "npm run build",
        digest: null,
        deployed: false,
        note: "No real artifact is built, signed, published, or deployed at stub scope. The descriptor names the package and the build command only; the digest stays null and deployed stays false.",
      },
      config: {
        defaultMode: "stub",
        httpModes: ["http", "integration-http"],
        baseUrl: "loopback-http-127.0.0.1-only",
        oneAttempt: true,
        retry: false,
        idempotencyKey: false,
        followRedirects: false,
        stubFallback: false,
        proxy: false,
        uiFetch: false,
        productionFlags: false,
        truthFlags: false,
        runtimeEnabled: false,
      },
    },
    qualification,
    userAcceptance: {
      state: "PENDING_USER_DECISION",
      realUserAcceptance: false,
      technicalQualificationIsAcceptance: false,
      decidedBy: "user",
      note: "Real user acceptance is a user decision over the current source only. It is distinct from the technical qualification record above, and this packet takes it for no one.",
    },
    decisions: RELEASE_DECISIONS,
    opsHandoff: releaseOpsHandoff(),
    denominators: RELEASE_DENOMINATORS,
    bindingChecks: checks,
    release: {
      released: false,
      publicDeploy: false,
      realMoneyApproval: false,
      realOperationsStarted: false,
      note: "This packet is a synthetic stub candidate record. Nothing is released, deployed publicly, approved for real money, or operated; the user RELEASE decision and the pending real node come first.",
    },
    nonClaims: { ...RELEASE_NON_CLAIMS },
    boundaryNote:
      "The candidate is scoped to the exact source and contract tuple it was built under: an approval for a different UI or contract is never reused. Technical qualification stays technical evidence and is never real user acceptance. Install, publish, and operate are presented to the user and none is taken here — no public deploy, real money, or real operations starts before the user RELEASE decision. UNKNOWN, NOT_BOUND, and STALE stay separate and none is a success.",
  };
}

/**
 * The synthetic runner. A run re-executes the sibling qualification matrix
 * against a fresh stub source and re-pins the live tuple, so two runs of the
 * same port produce identical packets apart from the packet id and the
 * derived candidate id. No clock, no randomness, no network.
 */
export class StubReleaseRunner implements ReleaseRunnerPort {
  readonly environment = "stub" as const;
  readonly source = "synthetic-release" as const;
  readonly scenario: ReleaseScenario;
  private readonly expectedTuple: DiscoveryReadTuple;
  private readonly held: { release: () => void }[] = [];
  private packetSerial = 0;

  constructor(options: StubReleaseRunnerOptions = {}) {
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

  run(request: ReleaseRunRequest): Promise<ReleaseRunOutcome> {
    const outcome = this.runNow(request);
    if (this.scenario === "held") {
      return new Promise<ReleaseRunOutcome>((resolve) => {
        this.held.push({ release: () => resolve(outcome) });
      });
    }
    return outcome;
  }

  private runNow(request: ReleaseRunRequest): Promise<ReleaseRunOutcome> {
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
        detail: "A release run carries an intent reference chosen by the caller.",
      });
    }
    if (typeof request.contextKey !== "string" || request.contextKey.trim().length === 0) {
      return Promise.resolve({
        kind: "invalid-request",
        intentRef: request.intentRef,
        contextKey: String(request.contextKey),
        code: "CONTEXT",
        detail: "A release run carries the caller's context key.",
      });
    }
    if (this.scenario === "read-lost") {
      // The answer to the run never arrives. The intent stays in flight.
      return new Promise<ReleaseRunOutcome>(() => {});
    }
    return this.buildPacket(request);
  }

  private async buildPacket(request: ReleaseRunRequest): Promise<ReleaseRunOutcome> {
    this.packetSerial += 1;
    const packetId = `rel-${String(this.packetSerial).padStart(4, "0")}`;
    const qualification = await runQualification();
    const checks = await bindingChecks(liveTupleKey());
    const packet = buildReleasePacket(packetId, qualification, checks);
    if (this.scenario === "claims-pass") {
      // A deliberately malformed payload: the packet claims a release and a
      // user acceptance it can never claim. The controller's packet check
      // leaves the run unknown.
      const tainted = {
        ...packet,
        nonClaims: { ...packet.nonClaims, released: true, realUserAcceptance: true },
        release: { ...packet.release, released: true, publicDeploy: true },
        userAcceptance: { ...packet.userAcceptance, realUserAcceptance: true },
      } as unknown as ReleasePacket;
      return { kind: "ready", intentRef: request.intentRef, contextKey: request.contextKey, packet: tainted };
    }
    return { kind: "ready", intentRef: request.intentRef, contextKey: request.contextKey, packet };
  }
}
