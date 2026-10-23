import {
  DISCOVERY_PROJECTION_AS_OF,
  DISCOVERY_READ_TENANT,
  DISCOVERY_READ_TUPLE_LITERALS,
  checkDiscoveryReadTuple,
  type DiscoveryReadTuple,
} from "./discovery-read.js";
import { MERCHANT_FOREIGN_REF, MERCHANT_OWN_REF } from "./merchant-operations.js";
import { PLATFORM_HOLD_NOT_BOUND, PLATFORM_NOT_COMPOSED } from "./platform-journey.js";

/**
 * Synthetic credit origination source for the seller's advance application.
 *
 * This is the stub-scope stand-in for a producer. The real connection stays pending
 * on kix-protocol:cr-08-producer-sdk and on the unpromoted bind-credit-fsm,
 * c-finance-projection, and c-journey-identity. The contract-only catalogue has no
 * credit command and no read command for a claim basis, a policy revision, a consent,
 * a document, a review decision, a commitment, or a drawdown permission. No producer
 * tuple exists, so the desk is NOT_BOUND on integration-http. No domain producer SDK, manifest, or
 * vector is consumed, and this module sends nothing over a network.
 *
 * Nothing here composes a catalogue command: no money posting is sent, and the
 * not-composed record below only quotes why.
 *
 * Rules, all enforced here and not only in copy:
 *  - Four lanes stay four lanes: the application, the review decision, the
 *    commitment, and the drawdown permission. A submission is not a decision, an
 *    approval is not a commitment, a commitment is not permission to draw, and
 *    permission to draw is not a disbursement. The source states each of those as
 *    the literal false, and a payload that says anything else is refused whole.
 *  - An explanation, even one written by an assistant, is not a decision. It has its
 *    own record and no decision field.
 *  - Rate, limit, and schedule figures are the source's own text, or UNDETERMINED
 *    when the source sent none. Nothing in this module parses, adds, scales, or
 *    compares an amount, so no client rate, limit, or repayment table exists.
 *  - Revisions, cuts, and expiry are compared as labels the source named. A lane
 *    built under an older policy revision is flagged and never shown as current.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const ORIGINATION_RULING = "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const ORIGINATION_NOT_BOUND_REASON =
  "No current producer tuple exists for credit origination: kix-protocol:cr-08-producer-sdk is not merged, and bind-credit-fsm, c-finance-projection, and c-journey-identity are not promoted. The contract-only catalogue has no credit command and no read command for a claim basis, policy revision, consent, document, review decision, commitment, or drawdown permission. The origination desk stays NOT_BOUND on integration-http.";

export const ORIGINATION_PROJECTION_NAME = "kix.credit.origination";

/** What a producer connection would need. All of it is absent, so every connection claim is false. */
export const ORIGINATION_PRODUCER_TUPLE = {
  bound: false,
  status: "NOT_BOUND",
  sdkDigest: null,
  manifestDigest: null,
  vectorDigest: null,
  waitingOn: ["kix-protocol:cr-08-producer-sdk", "bind-credit-fsm", "c-finance-projection", "c-journey-identity"],
} as const;

/** Fixed instant the synthetic source claims to be built at. */
export const ORIGINATION_AS_OF = DISCOVERY_PROJECTION_AS_OF;

/** Watermark the stale scenario serves, and the floor a reader holds against it. */
export const ORIGINATION_STALE_WATERMARK = "2026-10-10T00:00:00.000Z";
export const ORIGINATION_STALE_FLOOR = "2026-10-12T00:00:00.000Z";

/** The desk's own actor string. It is a context label, not an authentication result. */
export const ORIGINATION_DESK_ACTOR = "credit-origination-desk";

export const ORIGINATION_TENANT = DISCOVERY_READ_TENANT;

/** The applicant the desk actor holds a synthetic grant for, and one it does not. */
export const ORIGINATION_OWN_REF = MERCHANT_OWN_REF;
export const ORIGINATION_FOREIGN_REF = MERCHANT_FOREIGN_REF;

/** Amounts are labelled with this unit. It is a mock unit, not a currency. */
export const ORIGINATION_UNIT = "mock-unit";

/** The label the source puts where a rate, a limit, or a schedule is not decided. */
export const ORIGINATION_UNDETERMINED = "UNDETERMINED";

/** Quote of the locked hold binding. H1 keeps this consideredAction and keeps it not-bound. */
export const ORIGINATION_HOLD_NOT_BOUND = PLATFORM_HOLD_NOT_BOUND;

/** Catalogue commands this module records and does not send. Nothing is composed here at all. */
export const ORIGINATION_NOT_COMPOSED = PLATFORM_NOT_COMPOSED;

export const ORIGINATION_LANES = ["application", "review", "commitment", "drawdown"] as const;
export type OriginationLane = (typeof ORIGINATION_LANES)[number];

export const ORIGINATION_APPLICATION_STATES = ["not-started", "submitted"] as const;
export type OriginationApplicationState = (typeof ORIGINATION_APPLICATION_STATES)[number];

/** The review decision. Each kind is its own word, and none implies a later lane. */
export const ORIGINATION_DECISION_KINDS = ["pending", "conditional", "more-information", "rejected", "approved"] as const;
export type OriginationDecisionKind = (typeof ORIGINATION_DECISION_KINDS)[number];

export const ORIGINATION_COMMITMENT_STATES = ["offered", "accepted", "lapsed", "withdrawn"] as const;
export type OriginationCommitmentState = (typeof ORIGINATION_COMMITMENT_STATES)[number];

export const ORIGINATION_DRAWDOWN_PERMISSIONS = ["not-permitted", "permitted", "suspended"] as const;
export type OriginationDrawdownPermission = (typeof ORIGINATION_DRAWDOWN_PERMISSIONS)[number];

export const ORIGINATION_DRAWDOWN_REQUEST_STATES = ["recorded"] as const;
export type OriginationDrawdownRequestState = (typeof ORIGINATION_DRAWDOWN_REQUEST_STATES)[number];

export const ORIGINATION_CLAIM_STATES = ["valid", "disputed", "expired", "unknown"] as const;
export type OriginationClaimState = (typeof ORIGINATION_CLAIM_STATES)[number];

export const ORIGINATION_BURDEN_KINDS = ["refund-burden", "prior-pledge", "hold", "dispute"] as const;
export type OriginationBurdenKind = (typeof ORIGINATION_BURDEN_KINDS)[number];

export const ORIGINATION_BURDEN_STATES = ["observed", "pending", "unknown"] as const;
export type OriginationBurdenState = (typeof ORIGINATION_BURDEN_STATES)[number];

export const ORIGINATION_CONSENT_PURPOSES = ["claim-data-share", "credit-assessment"] as const;
export type OriginationConsentPurpose = (typeof ORIGINATION_CONSENT_PURPOSES)[number];

export const ORIGINATION_CONSENT_STATES = ["granted", "withdrawn", "expired", "unknown"] as const;
export type OriginationConsentState = (typeof ORIGINATION_CONSENT_STATES)[number];

export const ORIGINATION_DOCUMENT_KINDS = ["claim-evidence", "sales-statement", "additional-evidence"] as const;
export type OriginationDocumentKind = (typeof ORIGINATION_DOCUMENT_KINDS)[number];

export const ORIGINATION_DOCUMENT_STATES = ["valid", "expiring", "expired", "requested", "unknown"] as const;
export type OriginationDocumentState = (typeof ORIGINATION_DOCUMENT_STATES)[number];

export const ORIGINATION_REASON_LANES = ["claim", "policy", "consent", "document", "limit", "review"] as const;
export type OriginationReasonLane = (typeof ORIGINATION_REASON_LANES)[number];

/** The correction path a reason names. The page offers only the paths the source names. */
export const ORIGINATION_REMEDIES = ["amend-application", "provide-document", "renew-consent", "request-re-review", "none"] as const;
export type OriginationRemedy = (typeof ORIGINATION_REMEDIES)[number];

export const ORIGINATION_CUT_SOURCES = ["claim-ledger", "burden-register"] as const;
export type OriginationCutSource = (typeof ORIGINATION_CUT_SOURCES)[number];

export const ORIGINATION_ACTION_KINDS = ["submit", "correct", "re-review", "accept-commitment", "request-drawdown"] as const;
export type OriginationActionKind = (typeof ORIGINATION_ACTION_KINDS)[number];

export const ORIGINATION_CORRECT_TARGETS = ["application", "document", "consent"] as const;
export type OriginationCorrectTarget = (typeof ORIGINATION_CORRECT_TARGETS)[number];

/** Five things the source must state as the literal false. Silence is not a no. */
export const ORIGINATION_NON_CLAIM_FIELDS = [
  "submissionIsApproval",
  "explanationIsApproval",
  "approvalIsCommitment",
  "commitmentIsDrawdown",
  "disbursed",
] as const;
export type OriginationNonClaimField = (typeof ORIGINATION_NON_CLAIM_FIELDS)[number];

export type OriginationNonClaims = Readonly<Record<OriginationNonClaimField, false>>;

/** Controls that move the synthetic source. A real producer offers none of them. */
export const ORIGINATION_SYNTHETIC_CONTROLS = [
  "advance-review",
  "advance-policy",
  "withdraw-consent",
  "expire-document",
  "rival-request",
  "revoke-grant",
] as const;
export type OriginationSyntheticControl = (typeof ORIGINATION_SYNTHETIC_CONTROLS)[number];

export const ORIGINATION_SCENARIOS = [
  "clean",
  "empty",
  "stale",
  "in-review",
  "conditional",
  "more-information",
  "rejected",
  "approved",
  "offered",
  "committed",
  "stale-policy",
  "consent-withdrawn",
  "docs-expired",
  "limit-contended",
  "limit-race",
  "mixed-cut",
  "dangling-link",
  "explanation-says-approved",
  "claims-approval",
  "claims-disbursed",
  "scope-leak",
  "denied",
  "read-lost",
  "act-lost",
  "submit-claims-approval",
] as const;
export type OriginationScenario = (typeof ORIGINATION_SCENARIOS)[number];

export const ORIGINATION_DENIED_CODES = ["SCOPE_DENIED", "GRANT_REVOKED"] as const;
export type OriginationDeniedCode = (typeof ORIGINATION_DENIED_CODES)[number];

export const ORIGINATION_REFUSAL_CODES = ["CLAIM", "AMOUNT", "UNIT", "KIND", "STATE", "REF", "CUT", "SCOPE_LEAK"] as const;
export type OriginationRefusalCode = (typeof ORIGINATION_REFUSAL_CODES)[number];

export const ORIGINATION_INVALID_CODES = ["CONTEXT", "ACTOR", "SCOPE", "FLOOR", "ACTION", "AMOUNT", "REF"] as const;
export type OriginationInvalidCode = (typeof ORIGINATION_INVALID_CODES)[number];

/** Why the source said no to a request it understood. These are business answers, not transport faults. */
export const ORIGINATION_REJECTION_CODES = [
  "ALREADY_SUBMITTED",
  "NOT_SUBMITTED",
  "CLAIM_NOT_VALID",
  "STALE_POLICY",
  "CONSENT_WITHDRAWN",
  "DOCUMENT_EXPIRED",
  "NOT_CORRECTABLE",
  "REVIEW_IN_PROGRESS",
  "NO_COMMITMENT",
  "NOT_APPROVED",
  "DRAWDOWN_NOT_PERMITTED",
  "LIMIT_TAKEN",
] as const;
export type OriginationRejectionCode = (typeof ORIGINATION_REJECTION_CODES)[number];

// ---------------------------------------------------------------------------
// Identity. Each kind has its own prefix and one kind is never read as another.
// ---------------------------------------------------------------------------

export const ORIGINATION_REF_KINDS = [
  "applicant",
  "application",
  "claim",
  "burden",
  "trade",
  "policy",
  "consent",
  "document",
  "decision",
  "reason",
  "explanation",
  "commitment",
  "limit",
  "drawdown",
  "cut",
] as const;

export type OriginationRefKind = (typeof ORIGINATION_REF_KINDS)[number];

const REF_PREFIX: Readonly<Record<OriginationRefKind, string>> = {
  applicant: "mrc-",
  application: "app-",
  claim: "clm-",
  burden: "bdn-",
  trade: "trd-",
  policy: "pol-",
  consent: "cns-",
  document: "doc-",
  decision: "dec-",
  reason: "rsn-",
  explanation: "xpl-",
  commitment: "cmt-",
  limit: "lim-",
  drawdown: "drw-",
  cut: "cut-",
};

const REF_PATTERN = /^(mrc|app|clm|bdn|trd|pol|cns|doc|dec|rsn|xpl|cmt|lim|drw|cut)-[0-9]{4}$/;

export function originationRefFor(kind: OriginationRefKind, serial: number): string {
  return `${REF_PREFIX[kind]}${String(serial).padStart(4, "0")}`;
}

export function originationRefKind(ref: string): OriginationRefKind | null {
  if (!REF_PATTERN.test(ref)) {
    return null;
  }
  for (const kind of ORIGINATION_REF_KINDS) {
    if (ref.startsWith(REF_PREFIX[kind])) {
      return kind;
    }
  }
  return null;
}

export function isOriginationRef(ref: unknown, kind: OriginationRefKind): ref is string {
  return typeof ref === "string" && originationRefKind(ref) === kind;
}

/** A whole-unit amount: digits only, no sign, no leading zero, at most twelve digits. */
const AMOUNT_PATTERN = /^(0|[1-9][0-9]{0,11})$/;

export function isOriginationAmount(value: unknown): value is string {
  return typeof value === "string" && AMOUNT_PATTERN.test(value);
}

// ---------------------------------------------------------------------------
// Read model shapes
// ---------------------------------------------------------------------------

export interface OriginationScope {
  tenantId: string;
  /** The applicant whose application is requested. A grant is checked against it. */
  applicantRef: string;
}

/**
 * A source cut: the position one source was read at. Two figures are comparable only
 * when they name the same cut. A cut is not a commit position and not a settlement date.
 */
export interface OriginationCut {
  cutRef: string;
  source: OriginationCutSource;
  generation: number;
  watermark: string;
}

interface OriginationRowBase {
  applicantRef: string;
  cutRef: string;
}

/** A receivable the application cites as its basis. The face is the source's text. */
export interface OriginationClaim extends OriginationRowBase {
  claimRef: string;
  tradeRef: string;
  /** Whole-unit string copied from the source. Never parsed, added, netted, or compared. */
  faceAmount: string;
  unit: typeof ORIGINATION_UNIT;
  state: OriginationClaimState;
  reasonCode: string | null;
}

/** A burden against a claim. It stays its own row and is never subtracted from the face. */
export interface OriginationBurden extends OriginationRowBase {
  burdenRef: string;
  claimRef: string;
  kind: OriginationBurdenKind;
  state: OriginationBurdenState;
  amount: string;
  unit: typeof ORIGINATION_UNIT;
}

export interface OriginationPolicy {
  policyRef: string;
  /** The revision the source holds as current. Each lane names the revision it was built under. */
  currentRevision: number;
}

export interface OriginationConsent {
  consentRef: string;
  purpose: OriginationConsentPurpose;
  state: OriginationConsentState;
  version: number;
  /** Source label for when the state was set. Display only. */
  setLabel: string;
}

export interface OriginationDocument {
  documentRef: string;
  kind: OriginationDocumentKind;
  state: OriginationDocumentState;
  claimRef: string | null;
  /** Source instant for the expiry. Display only. The page compares no clock against it. */
  expiresLabel: string | null;
  /** The source's own verdict on expiry. The page prints it and never recomputes it. */
  expired: boolean | null;
}

export interface OriginationApplication {
  applicationRef: string;
  applicantRef: string;
  state: OriginationApplicationState;
  revision: number;
  /** The amount the person asked for, copied back. It is not an approved amount. */
  requestedAmount: string | null;
  unit: typeof ORIGINATION_UNIT;
  claimRefs: readonly string[];
}

export interface OriginationDecision {
  decisionRef: string;
  kind: OriginationDecisionKind;
  /** The policy revision this decision was made under. */
  policyRevision: number;
  /** The application revision this decision judged. */
  applicationRevision: number;
  /** Condition codes the source attached to a conditional decision. */
  conditions: readonly string[];
}

export interface OriginationReason {
  reasonRef: string;
  lane: OriginationReasonLane;
  code: string;
  /** Source text for the reason. The page copies it and adds none. */
  text: string;
  remedy: OriginationRemedy;
}

/** Assistant-written text. It is shown as an explanation and is never a decision. */
export interface OriginationExplanation {
  explanationRef: string;
  provenance: "assistant-generated";
  text: string;
}

export interface OriginationScheduleRow {
  installmentLabel: string;
  dueLabel: string;
  amount: string;
}

/**
 * The source's own rate, limit, and schedule figures. Every field is the source's text.
 * The page computes none of them and shows UNDETERMINED when the source sent none.
 */
export interface OriginationTerms {
  policyRevision: number;
  rateLabel: string | null;
  scheduleRows: readonly OriginationScheduleRow[] | null;
  unit: typeof ORIGINATION_UNIT;
}

export interface OriginationLimitRank {
  applicationRef: string;
  rank: number;
}

/** A limit more than one application draws on. The ranks are the source's order. */
export interface OriginationLimit {
  limitRef: string;
  amount: string | null;
  unit: typeof ORIGINATION_UNIT;
  contention: "none" | "contended";
  ranks: readonly OriginationLimitRank[];
}

export interface OriginationCommitment {
  commitmentRef: string;
  state: OriginationCommitmentState;
  /** The policy revision this commitment was offered under. */
  policyRevision: number;
}

export interface OriginationDrawdownRequest {
  drawdownRef: string;
  state: OriginationDrawdownRequestState;
}

export interface OriginationDrawdown {
  permission: OriginationDrawdownPermission;
  /** Why the source withheld or suspended permission, as codes the source names. */
  reasonCodes: readonly string[];
  commitmentRef: string | null;
  /** A recorded request is not a disbursement. Nothing is disbursed here. */
  requests: readonly OriginationDrawdownRequest[];
}

export interface OriginationSnapshot {
  /** Read serial on this port. It orders reads and is not a commit position. */
  snapshotId: number;
  watermark: string;
  scenario: OriginationScenario;
  scope: OriginationScope;
  cuts: readonly OriginationCut[];
  application: OriginationApplication;
  claims: readonly OriginationClaim[];
  burdens: readonly OriginationBurden[];
  policy: OriginationPolicy;
  consents: readonly OriginationConsent[];
  documents: readonly OriginationDocument[];
  decision: OriginationDecision | null;
  reasons: readonly OriginationReason[];
  explanation: OriginationExplanation | null;
  terms: OriginationTerms | null;
  limit: OriginationLimit;
  commitment: OriginationCommitment | null;
  drawdown: OriginationDrawdown;
  nonClaims: OriginationNonClaims;
}

export interface OriginationReadRequest {
  contextKey: string;
  actorRef: string;
  scope: OriginationScope;
  watermarkFloor: string | null;
}

export type OriginationActionRequest =
  | { kind: "submit"; requestedAmount: string; claimRefs: readonly string[] }
  | { kind: "correct"; target: "application"; requestedAmount: string }
  | { kind: "correct"; target: "document" | "consent"; ref: string }
  | { kind: "re-review" }
  | { kind: "accept-commitment"; commitmentRef: string }
  | { kind: "request-drawdown"; commitmentRef: string };

export interface OriginationActRequest {
  contextKey: string;
  actorRef: string;
  scope: OriginationScope;
  action: OriginationActionRequest;
}

/**
 * What the source says one accepted request did. It is not a decision: a submission and
 * an amendment leave the decision pending, and the lanes on screen come from a read.
 */
export interface OriginationReceipt {
  kind: OriginationActionKind;
  applicationRef: string;
  revision: number;
  decisionAfter: OriginationDecisionKind | "none";
  commitmentAfter: OriginationCommitmentState | "none";
  drawdownRef: string | null;
  nonClaims: OriginationNonClaims;
}

export type OriginationTupleChanged = { kind: "tuple-changed"; field: string; expected: string; actual: string };

export type OriginationDenied = { kind: "denied"; code: OriginationDeniedCode; applicantRef: string; detail: string };

export type OriginationRefused = { kind: "refused"; code: OriginationRefusalCode; field: string; ref: string | null; detail: string };

export type OriginationInvalid = { kind: "invalid-request"; code: OriginationInvalidCode; detail: string };

export type OriginationReadOutcome =
  | { kind: "ready"; snapshot: OriginationSnapshot }
  | { kind: "empty"; watermark: string; snapshotId: number; scope: OriginationScope }
  | { kind: "stale"; watermark: string; floor: string }
  | OriginationDenied
  | OriginationRefused
  | OriginationInvalid
  | OriginationTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export type OriginationActOutcome =
  | { kind: "applied"; receipt: OriginationReceipt }
  | { kind: "rejected"; code: OriginationRejectionCode; detail: string }
  | OriginationDenied
  | OriginationRefused
  | OriginationInvalid
  | OriginationTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export interface OriginationPort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic-origination" | "none";
  readonly scenario: OriginationScenario;
  read(request: OriginationReadRequest): Promise<OriginationReadOutcome>;
  act(request: OriginationActRequest): Promise<OriginationActOutcome>;
  /**
   * Synthetic control: moves the source on. A real producer offers no such call.
   * Returns false when there is no source to move, or nothing to move in the source.
   */
  synthetic(control: OriginationSyntheticControl): boolean;
}

export interface StubCreditOriginationOptions {
  scenario?: OriginationScenario;
  /** Expected tuple override. Used to stage a producer change in tests. */
  expectedTuple?: DiscoveryReadTuple;
}

export interface OriginationEffectCounts {
  reads: number;
  acts: number;
}

export function createStubCreditOrigination(options: StubCreditOriginationOptions = {}): StubCreditOrigination {
  return new StubCreditOrigination(options);
}

export function createNotBoundCreditOrigination(): OriginationPort {
  const outcome = { kind: "not-bound", reason: ORIGINATION_NOT_BOUND_REASON } as const;
  return {
    environment: "integration-http",
    source: "none",
    scenario: "clean",
    read() {
      return Promise.resolve({ ...outcome });
    },
    act() {
      return Promise.resolve({ ...outcome });
    },
    synthetic() {
      return false;
    },
  };
}

export function creditOriginationPortFor(
  environment: "stub" | "integration-http",
  options: StubCreditOriginationOptions = {},
): OriginationPort {
  if (environment === "stub") {
    return createStubCreditOrigination(options);
  }
  return createNotBoundCreditOrigination();
}

// ---------------------------------------------------------------------------
// Pure checks. The port uses them before it returns a row, and the controller and
// the screen use them to say what a snapshot can and cannot support.
// ---------------------------------------------------------------------------

/**
 * The first non-claim field the source does not state as the literal false. A missing
 * field counts: the source has to say it, and silence is not a no.
 */
export function findOriginationClaim(nonClaims: unknown): OriginationNonClaimField | null {
  const record = (typeof nonClaims === "object" && nonClaims !== null ? nonClaims : {}) as Record<string, unknown>;
  for (const field of ORIGINATION_NON_CLAIM_FIELDS) {
    if (record[field] !== false) {
      return field;
    }
  }
  return null;
}

function refuse(code: OriginationRefusalCode, field: string, ref: string | null, detail: string): OriginationRefused {
  return { kind: "refused", code, field, ref, detail };
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/**
 * Checks a payload the source returned before any row is shown. A failure means the
 * payload cannot be trusted as a whole, so the port returns no row from it.
 */
export function refuseOriginationSnapshot(snapshot: OriginationSnapshot): OriginationRefused | null {
  const cutRefs = new Set(snapshot.cuts.map((cut) => cut.cutRef));
  for (const cut of snapshot.cuts) {
    if (!isOriginationRef(cut.cutRef, "cut")) {
      return refuse("REF", "cutRef", String(cut.cutRef), `Cut reference ${String(cut.cutRef)} is not a cut reference.`);
    }
    if (!includes(ORIGINATION_CUT_SOURCES, cut.source)) {
      return refuse("KIND", "source", cut.cutRef, `Cut ${cut.cutRef} names source ${String(cut.source)}.`);
    }
  }
  const missing = findOriginationClaim(snapshot.nonClaims);
  if (missing !== null) {
    return refuse(
      "CLAIM",
      missing,
      null,
      `The source does not state ${missing} as false. A submission is not an approval, an explanation is not an approval, an approval is not a commitment, a commitment is not permission to draw, and nothing here is disbursed.`,
    );
  }
  const scopeApplicant = snapshot.scope.applicantRef;
  if (!isOriginationRef(snapshot.application.applicationRef, "application")) {
    return refuse("REF", "applicationRef", String(snapshot.application.applicationRef), "The application reference is not an application reference.");
  }
  if (snapshot.application.applicantRef !== scopeApplicant) {
    return refuse("SCOPE_LEAK", "applicantRef", snapshot.application.applicationRef, "The application belongs to another applicant than the requested scope.");
  }
  if (!includes(ORIGINATION_APPLICATION_STATES, snapshot.application.state)) {
    return refuse("STATE", "state", snapshot.application.applicationRef, `Application state ${String(snapshot.application.state)} is not a state.`);
  }
  if (snapshot.application.requestedAmount !== null && !isOriginationAmount(snapshot.application.requestedAmount)) {
    return refuse("AMOUNT", "requestedAmount", snapshot.application.applicationRef, "The requested amount is not a whole-unit string, so it is not shown.");
  }
  const rows: { ref: string; kind: OriginationRefKind; row: OriginationRowBase }[] = [
    ...snapshot.claims.map((row) => ({ ref: row.claimRef, kind: "claim" as const, row })),
    ...snapshot.burdens.map((row) => ({ ref: row.burdenRef, kind: "burden" as const, row })),
  ];
  for (const { ref, kind, row } of rows) {
    if (!isOriginationRef(ref, kind)) {
      return refuse("REF", `${kind}Ref`, String(ref), `Reference ${String(ref)} is not a ${kind} reference.`);
    }
    if (row.applicantRef !== scopeApplicant) {
      return refuse("SCOPE_LEAK", "applicantRef", ref, `Row ${ref} belongs to ${String(row.applicantRef)}, not to the requested scope.`);
    }
    if (!cutRefs.has(row.cutRef)) {
      return refuse("CUT", "cutRef", ref, `Row ${ref} names cut ${String(row.cutRef)}, which the snapshot does not list.`);
    }
  }
  for (const claim of snapshot.claims) {
    if (!includes(ORIGINATION_CLAIM_STATES, claim.state)) {
      return refuse("STATE", "state", claim.claimRef, `Claim ${claim.claimRef} has state ${String(claim.state)}.`);
    }
    if (!isOriginationAmount(claim.faceAmount)) {
      return refuse("AMOUNT", "faceAmount", claim.claimRef, `Claim ${claim.claimRef} face is not a whole-unit string, so it is not shown.`);
    }
    if (claim.unit !== ORIGINATION_UNIT) {
      return refuse("UNIT", "unit", claim.claimRef, `Claim ${claim.claimRef} names unit ${String(claim.unit)}, not ${ORIGINATION_UNIT}.`);
    }
  }
  for (const burden of snapshot.burdens) {
    if (!includes(ORIGINATION_BURDEN_KINDS, burden.kind)) {
      return refuse("KIND", "kind", burden.burdenRef, `Burden ${burden.burdenRef} has kind ${String(burden.kind)}.`);
    }
    if (!includes(ORIGINATION_BURDEN_STATES, burden.state)) {
      return refuse("STATE", "state", burden.burdenRef, `Burden ${burden.burdenRef} has state ${String(burden.state)}.`);
    }
    if (!isOriginationAmount(burden.amount)) {
      return refuse("AMOUNT", "amount", burden.burdenRef, `Burden ${burden.burdenRef} amount is not a whole-unit string, so it is not shown.`);
    }
    if (burden.unit !== ORIGINATION_UNIT) {
      return refuse("UNIT", "unit", burden.burdenRef, `Burden ${burden.burdenRef} names unit ${String(burden.unit)}, not ${ORIGINATION_UNIT}.`);
    }
  }
  for (const consent of snapshot.consents) {
    if (!isOriginationRef(consent.consentRef, "consent")) {
      return refuse("REF", "consentRef", String(consent.consentRef), `Reference ${String(consent.consentRef)} is not a consent reference.`);
    }
    if (!includes(ORIGINATION_CONSENT_PURPOSES, consent.purpose)) {
      return refuse("KIND", "purpose", consent.consentRef, `Consent ${consent.consentRef} names purpose ${String(consent.purpose)}.`);
    }
    if (!includes(ORIGINATION_CONSENT_STATES, consent.state)) {
      return refuse("STATE", "state", consent.consentRef, `Consent ${consent.consentRef} has state ${String(consent.state)}.`);
    }
  }
  for (const document of snapshot.documents) {
    if (!isOriginationRef(document.documentRef, "document")) {
      return refuse("REF", "documentRef", String(document.documentRef), `Reference ${String(document.documentRef)} is not a document reference.`);
    }
    if (!includes(ORIGINATION_DOCUMENT_KINDS, document.kind)) {
      return refuse("KIND", "kind", document.documentRef, `Document ${document.documentRef} has kind ${String(document.kind)}.`);
    }
    if (!includes(ORIGINATION_DOCUMENT_STATES, document.state)) {
      return refuse("STATE", "state", document.documentRef, `Document ${document.documentRef} has state ${String(document.state)}.`);
    }
  }
  if (snapshot.decision !== null) {
    if (!isOriginationRef(snapshot.decision.decisionRef, "decision")) {
      return refuse("REF", "decisionRef", String(snapshot.decision.decisionRef), "The decision reference is not a decision reference.");
    }
    if (!includes(ORIGINATION_DECISION_KINDS, snapshot.decision.kind)) {
      return refuse("KIND", "kind", snapshot.decision.decisionRef, `Decision ${snapshot.decision.decisionRef} has kind ${String(snapshot.decision.kind)}.`);
    }
  }
  for (const reason of snapshot.reasons) {
    if (!isOriginationRef(reason.reasonRef, "reason")) {
      return refuse("REF", "reasonRef", String(reason.reasonRef), `Reference ${String(reason.reasonRef)} is not a reason reference.`);
    }
    if (!includes(ORIGINATION_REASON_LANES, reason.lane)) {
      return refuse("KIND", "lane", reason.reasonRef, `Reason ${reason.reasonRef} names lane ${String(reason.lane)}.`);
    }
    if (!includes(ORIGINATION_REMEDIES, reason.remedy)) {
      return refuse("KIND", "remedy", reason.reasonRef, `Reason ${reason.reasonRef} names remedy ${String(reason.remedy)}.`);
    }
  }
  if (snapshot.commitment !== null && !includes(ORIGINATION_COMMITMENT_STATES, snapshot.commitment.state)) {
    return refuse("STATE", "state", snapshot.commitment.commitmentRef, `Commitment has state ${String(snapshot.commitment.state)}.`);
  }
  if (!includes(ORIGINATION_DRAWDOWN_PERMISSIONS, snapshot.drawdown.permission)) {
    return refuse("STATE", "permission", null, `Drawdown permission ${String(snapshot.drawdown.permission)} is not a permission.`);
  }
  if (snapshot.limit.amount !== null && !isOriginationAmount(snapshot.limit.amount)) {
    return refuse("AMOUNT", "amount", snapshot.limit.limitRef, "The limit amount is not a whole-unit string, so it is not shown.");
  }
  if (snapshot.terms !== null) {
    if (snapshot.terms.unit !== ORIGINATION_UNIT) {
      return refuse("UNIT", "unit", "terms", `The terms name unit ${String(snapshot.terms.unit)}, not ${ORIGINATION_UNIT}.`);
    }
    for (const row of snapshot.terms.scheduleRows ?? []) {
      if (!isOriginationAmount(row.amount)) {
        return refuse("AMOUNT", "amount", row.installmentLabel, `Schedule row ${row.installmentLabel} amount is not a whole-unit string, so it is not shown.`);
      }
    }
  }
  return null;
}

/**
 * Checks an accepted request's receipt before it is shown. A receipt that calls a
 * submission, an amendment, or a re-review anything but pending is untrusted.
 */
export function refuseOriginationReceipt(receipt: OriginationReceipt, request: OriginationActionRequest): OriginationRefused | null {
  const missing = findOriginationClaim(receipt.nonClaims);
  if (missing !== null) {
    return refuse("CLAIM", missing, receipt.applicationRef, `The answer does not state ${missing} as false. Its receipt is not trusted.`);
  }
  if (!isOriginationRef(receipt.applicationRef, "application")) {
    return refuse("REF", "applicationRef", String(receipt.applicationRef), "The receipt names no application reference.");
  }
  const pendingOnly = request.kind === "submit" || request.kind === "re-review" || (request.kind === "correct" && request.target === "application");
  if (pendingOnly && receipt.decisionAfter !== "pending") {
    return refuse(
      "CLAIM",
      "decisionAfter",
      receipt.applicationRef,
      `The answer to a ${request.kind} says the decision is ${String(receipt.decisionAfter)}. A request leaves the decision pending, so the answer is not trusted.`,
    );
  }
  if (request.kind === "accept-commitment" && receipt.drawdownRef !== null) {
    return refuse("CLAIM", "drawdownRef", receipt.applicationRef, "Accepting a commitment opens no drawdown, so the answer is not trusted.");
  }
  if (request.kind === "request-drawdown" && !isOriginationRef(receipt.drawdownRef, "drawdown")) {
    return refuse("REF", "drawdownRef", String(receipt.drawdownRef), "A drawdown request answer names a drawdown reference.");
  }
  return null;
}

export type OriginationCutState = "none" | "single" | "mixed";

export interface OriginationStaleLane {
  lane: "review" | "commitment" | "terms";
  builtUnder: number;
  currentRevision: number;
}

export type OriginationContradictionCode =
  | "APPROVAL_WITHOUT_SUBMISSION"
  | "COMMITMENT_WITHOUT_APPROVAL"
  | "DRAWDOWN_WITHOUT_COMMITMENT"
  | "DRAWDOWN_STALE_POLICY"
  | "DRAWDOWN_CONSENT"
  | "DRAWDOWN_DOCUMENT"
  | "DRAWDOWN_LIMIT";

export interface OriginationContradiction {
  code: OriginationContradictionCode;
  /** The lane the page withholds because of it. */
  lane: OriginationLane;
  detail: string;
}

export interface OriginationUnlinked {
  lens: "burdens" | "documents";
  ref: string;
  missingRef: string;
}

export interface OriginationAssessment {
  /** none: no row. single: every row is on one cut. mixed: rows are on more than one cut. */
  cutState: OriginationCutState;
  usedCuts: readonly OriginationCut[];
  staleLanes: readonly OriginationStaleLane[];
  /** Consents the source does not hold as granted. */
  consentBlocks: readonly string[];
  /** Documents that are expired, requested, or unknown. */
  documentBlocks: readonly string[];
  /** contended-behind: the source ranked another application ahead of this one. */
  limitState: "none" | "contended-first" | "contended-behind";
  contradictions: readonly OriginationContradiction[];
  unlinked: readonly OriginationUnlinked[];
}

function ownRank(snapshot: OriginationSnapshot): number | null {
  const row = snapshot.limit.ranks.find((item) => item.applicationRef === snapshot.application.applicationRef);
  return row === undefined ? null : row.rank;
}

/**
 * What a snapshot can support. This names inconsistencies between lanes and compares
 * labels: revisions, refs, states, and ranks the source numbered. It adds no amount
 * and compares no amount.
 */
export function assessOriginationSnapshot(snapshot: OriginationSnapshot): OriginationAssessment {
  const named = new Set<string>();
  for (const row of [...snapshot.claims, ...snapshot.burdens]) {
    named.add(row.cutRef);
  }
  const usedCuts = snapshot.cuts.filter((cut) => named.has(cut.cutRef));
  const cutState: OriginationCutState = usedCuts.length === 0 ? "none" : usedCuts.length === 1 ? "single" : "mixed";

  const current = snapshot.policy.currentRevision;
  const staleLanes: OriginationStaleLane[] = [];
  if (snapshot.decision !== null && snapshot.decision.policyRevision !== current) {
    staleLanes.push({ lane: "review", builtUnder: snapshot.decision.policyRevision, currentRevision: current });
  }
  if (snapshot.commitment !== null && snapshot.commitment.policyRevision !== current) {
    staleLanes.push({ lane: "commitment", builtUnder: snapshot.commitment.policyRevision, currentRevision: current });
  }
  if (snapshot.terms !== null && snapshot.terms.policyRevision !== current) {
    staleLanes.push({ lane: "terms", builtUnder: snapshot.terms.policyRevision, currentRevision: current });
  }

  const consentBlocks = snapshot.consents.filter((item) => item.state !== "granted").map((item) => item.consentRef);
  const documentBlocks = snapshot.documents
    .filter((item) => item.state === "expired" || item.state === "requested" || item.state === "unknown")
    .map((item) => item.documentRef);

  const rank = ownRank(snapshot);
  const limitState: OriginationAssessment["limitState"] =
    snapshot.limit.contention === "none" ? "none" : rank === 1 ? "contended-first" : "contended-behind";

  const contradictions: OriginationContradiction[] = [];
  const submitted = snapshot.application.state === "submitted";
  if (!submitted && snapshot.decision !== null) {
    contradictions.push({
      code: "APPROVAL_WITHOUT_SUBMISSION",
      lane: "review",
      detail: "The source lists a decision and no submitted application. A decision needs a submission, so the decision is withheld.",
    });
  }
  if (snapshot.commitment !== null && (snapshot.commitment.state === "offered" || snapshot.commitment.state === "accepted")) {
    if (snapshot.decision === null || snapshot.decision.kind !== "approved") {
      contradictions.push({
        code: "COMMITMENT_WITHOUT_APPROVAL",
        lane: "commitment",
        detail: "The source lists a commitment and the decision is not approved. A commitment needs an approval, so the commitment is withheld.",
      });
    }
  }
  if (snapshot.drawdown.permission === "permitted") {
    if (snapshot.commitment === null || snapshot.commitment.state !== "accepted") {
      contradictions.push({
        code: "DRAWDOWN_WITHOUT_COMMITMENT",
        lane: "drawdown",
        detail: "The source says drawdown is permitted and no accepted commitment is listed. Permission needs an accepted commitment, so permission is withheld.",
      });
    }
    if (staleLanes.some((item) => item.lane === "review" || item.lane === "commitment")) {
      contradictions.push({
        code: "DRAWDOWN_STALE_POLICY",
        lane: "drawdown",
        detail: `The source says drawdown is permitted, and the decision or commitment was built under an older policy revision than ${current}. Permission is withheld.`,
      });
    }
    if (consentBlocks.length > 0) {
      contradictions.push({
        code: "DRAWDOWN_CONSENT",
        lane: "drawdown",
        detail: `The source says drawdown is permitted, and consent ${consentBlocks.join(", ")} is not granted. Permission is withheld.`,
      });
    }
    if (documentBlocks.length > 0) {
      contradictions.push({
        code: "DRAWDOWN_DOCUMENT",
        lane: "drawdown",
        detail: `The source says drawdown is permitted, and document ${documentBlocks.join(", ")} is expired, requested, or unknown. Permission is withheld.`,
      });
    }
    if (limitState === "contended-behind") {
      contradictions.push({
        code: "DRAWDOWN_LIMIT",
        lane: "drawdown",
        detail: "The source says drawdown is permitted, and it ranked another application ahead of this one on the shared limit. Permission is withheld.",
      });
    }
  }

  const claimRefs = new Set(snapshot.claims.map((row) => row.claimRef));
  const unlinked: OriginationUnlinked[] = [];
  for (const row of snapshot.burdens) {
    if (!claimRefs.has(row.claimRef)) {
      unlinked.push({ lens: "burdens", ref: row.burdenRef, missingRef: row.claimRef });
    }
  }
  for (const row of snapshot.documents) {
    if (row.claimRef !== null && !claimRefs.has(row.claimRef)) {
      unlinked.push({ lens: "documents", ref: row.documentRef, missingRef: row.claimRef });
    }
  }
  return { cutState, usedCuts, staleLanes, consentBlocks, documentBlocks, limitState, contradictions, unlinked };
}

export interface OriginationEligibility {
  allowed: boolean;
  /** Why the action is off. Null when it is on. */
  reason: string | null;
}

function remedyOffered(snapshot: OriginationSnapshot, remedy: OriginationRemedy): boolean {
  return snapshot.reasons.some((reason) => reason.remedy === remedy);
}

/**
 * Whether an action is on offer for a read. This is label logic over what the source
 * said: it is the same answer for the controller and for the screen, so a control the
 * page shows as off is a request the controller never sends. The source decides again.
 */
export function originationEligibility(
  snapshot: OriginationSnapshot,
  assessment: OriginationAssessment,
  kind: OriginationActionKind,
  target?: OriginationCorrectTarget,
): OriginationEligibility {
  const no = (reason: string): OriginationEligibility => ({ allowed: false, reason });
  const yes: OriginationEligibility = { allowed: true, reason: null };
  const submitted = snapshot.application.state === "submitted";
  const withheld = (lane: OriginationLane): OriginationContradiction | undefined =>
    assessment.contradictions.find((item) => item.lane === lane);
  switch (kind) {
    case "submit": {
      if (submitted) {
        return no("An application is already submitted. Amend it instead.");
      }
      if (assessment.cutState === "mixed") {
        return no("The claims and burdens are on more than one source cut. They are not merged, so there is no single basis to cite.");
      }
      if (!snapshot.claims.some((row) => row.state === "valid")) {
        return no("The source lists no valid claim to cite.");
      }
      if (assessment.consentBlocks.length > 0) {
        return no(`Consent ${assessment.consentBlocks.join(", ")} is not granted. Renew it first.`);
      }
      return yes;
    }
    case "correct": {
      if (!submitted) {
        return no("There is no submitted application to correct.");
      }
      if (target === "application") {
        return remedyOffered(snapshot, "amend-application")
          ? yes
          : no("The source names no amendment path for the current reasons.");
      }
      if (target === "document") {
        return remedyOffered(snapshot, "provide-document")
          ? yes
          : no("The source names no document path for the current reasons.");
      }
      if (target === "consent") {
        return remedyOffered(snapshot, "renew-consent")
          ? yes
          : no("The source names no consent path for the current reasons.");
      }
      return no("A correction names an application, a document, or a consent.");
    }
    case "re-review": {
      if (!submitted) {
        return no("There is no submitted application to review again.");
      }
      if (snapshot.decision === null || snapshot.decision.kind === "pending") {
        return no("The review is still in progress. Wait for a decision before asking for another review.");
      }
      return remedyOffered(snapshot, "request-re-review")
        ? yes
        : no("The source names no re-review path for the current reasons.");
    }
    case "accept-commitment": {
      if (snapshot.commitment === null || snapshot.commitment.state !== "offered") {
        return no("The source has offered no commitment to accept. An approval is not a commitment.");
      }
      const hold = withheld("commitment");
      if (hold !== undefined) {
        return no(hold.detail);
      }
      if (assessment.staleLanes.some((item) => item.lane === "review" || item.lane === "commitment")) {
        return no("The decision or the commitment was built under an older policy revision. Ask for a review under the current revision.");
      }
      if (assessment.consentBlocks.length > 0) {
        return no(`Consent ${assessment.consentBlocks.join(", ")} is not granted. Renew it first.`);
      }
      if (assessment.documentBlocks.length > 0) {
        return no(`Document ${assessment.documentBlocks.join(", ")} is expired, requested, or unknown. Provide it first.`);
      }
      return yes;
    }
    case "request-drawdown": {
      if (snapshot.commitment === null || snapshot.commitment.state !== "accepted") {
        return no("There is no accepted commitment. A commitment is not accepted until it is.");
      }
      if (snapshot.drawdown.permission !== "permitted") {
        return no(
          snapshot.drawdown.permission === "suspended"
            ? "The source has suspended permission to draw."
            : "The source has not permitted a drawdown. An accepted commitment is not permission to draw.",
        );
      }
      const hold = withheld("drawdown");
      if (hold !== undefined) {
        return no(hold.detail);
      }
      return yes;
    }
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Synthetic source
// ---------------------------------------------------------------------------

const CUT_CLAIMS = "cut-0001";
const CUT_BURDENS = "cut-0002";
const CLAIM_GENERATION = 5;
const BURDEN_GENERATION = 3;
const BURDEN_WATERMARK = "2026-10-12T06:00:00.000Z";
const BASE_POLICY_REVISION = 4;
const OLDER_POLICY_REVISION = 3;
const APPLICATION_REF = "app-0001";
const RIVAL_APPLICATION_REF = "app-0002";
const DECISION_REF = "dec-0001";
const COMMITMENT_REF = "cmt-0001";
const LIMIT_REF = "lim-0001";
const POLICY_REF = "pol-0001";
const EXPLANATION_REF = "xpl-0001";
const CONSENT_SHARE = "cns-0001";
const CONSENT_ASSESS = "cns-0002";
const DOC_EVIDENCE = "doc-0001";
const DOC_SALES = "doc-0002";
const DOC_EXTRA = "doc-0003";

/** What a request to the source is for the stub's own bookkeeping. */
const NON_CLAIMS: OriginationNonClaims = {
  submissionIsApproval: false,
  explanationIsApproval: false,
  approvalIsCommitment: false,
  commitmentIsDrawdown: false,
  disbursed: false,
};

interface SeedReason {
  lane: OriginationReasonLane;
  code: string;
  text: string;
  remedy: OriginationRemedy;
}

interface SeedClaim {
  claimRef: string;
  applicantRef: string;
  tradeRef: string;
  faceAmount: string;
}

interface SeedBurden {
  burdenRef: string;
  applicantRef: string;
  claimRef: string;
  kind: OriginationBurdenKind;
  state: OriginationBurdenState;
  amount: string;
}

/**
 * Amounts are typed constants of this fixture. The schedule rows are typed the same way,
 * because the source owns its figures. No code here adds one amount to another.
 */
const SEED_CLAIMS: readonly SeedClaim[] = [
  { claimRef: "clm-0001", applicantRef: ORIGINATION_OWN_REF, tradeRef: "trd-0001", faceAmount: "1100" },
  { claimRef: "clm-0002", applicantRef: ORIGINATION_OWN_REF, tradeRef: "trd-0003", faceAmount: "800" },
  { claimRef: "clm-0003", applicantRef: ORIGINATION_FOREIGN_REF, tradeRef: "trd-0004", faceAmount: "5000" },
];

const SEED_BURDENS: readonly SeedBurden[] = [
  { burdenRef: "bdn-0001", applicantRef: ORIGINATION_OWN_REF, claimRef: "clm-0001", kind: "refund-burden", state: "pending", amount: "300" },
  { burdenRef: "bdn-0002", applicantRef: ORIGINATION_OWN_REF, claimRef: "clm-0002", kind: "prior-pledge", state: "observed", amount: "200" },
  { burdenRef: "bdn-0003", applicantRef: ORIGINATION_FOREIGN_REF, claimRef: "clm-0003", kind: "hold", state: "observed", amount: "700" },
];

const SEED_SCHEDULE: readonly OriginationScheduleRow[] = [
  { installmentLabel: "syn-installment-1", dueLabel: "syn-due-a", amount: "500" },
  { installmentLabel: "syn-installment-2", dueLabel: "syn-due-b", amount: "400" },
  { installmentLabel: "syn-installment-3", dueLabel: "syn-due-c", amount: "300" },
];

/** The synthetic limit amount and rate label. Typed by hand, never computed. */
const SEED_LIMIT_AMOUNT = "1500";
const SEED_RATE_LABEL = "syn-rate-label-0001";
const SEED_REQUESTED_AMOUNT = "1000";

const CONDITIONAL_REASONS: readonly SeedReason[] = [
  {
    lane: "claim",
    code: "CONDITION_PLEDGE_LESS",
    text: "The source would approve a smaller request against the cited claims. Amend the requested amount.",
    remedy: "amend-application",
  },
  {
    lane: "document",
    code: "CONDITION_EVIDENCE",
    text: "The source wants one more document for the cited claims before it decides.",
    remedy: "provide-document",
  },
];

const MORE_INFORMATION_REASONS: readonly SeedReason[] = [
  {
    lane: "document",
    code: "EVIDENCE_REQUESTED",
    text: "The source asks for additional evidence for the cited claims. Provide the requested document.",
    remedy: "provide-document",
  },
];

const REJECTED_REASONS: readonly SeedReason[] = [
  {
    lane: "claim",
    code: "CLAIM_BURDENED",
    text: "The source holds the cited claims as burdened by a pending refund line. Amend the application to cite other claims or a smaller request.",
    remedy: "amend-application",
  },
  {
    lane: "review",
    code: "REVIEW_DECLINED",
    text: "The source declined this review. A new review may be requested once the burden changes.",
    remedy: "request-re-review",
  },
];

/** What each actor string may read at the synthetic source. A stand-in for an authority. */
const GRANTS: ReadonlyMap<string, readonly string[]> = new Map([[ORIGINATION_DESK_ACTOR, [ORIGINATION_OWN_REF]]]);

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

interface SourceState {
  applicationState: OriginationApplicationState;
  revision: number;
  requestedAmount: string | null;
  claimRefs: string[];
  decisionKind: OriginationDecisionKind | null;
  decisionPolicyRevision: number;
  commitmentState: OriginationCommitmentState | null;
  commitmentPolicyRevision: number;
  policyRevision: number;
  consentAssess: OriginationConsentState;
  consentShare: OriginationConsentState;
  consentVersion: number;
  evidenceState: OriginationDocumentState;
  extraDocument: OriginationDocumentState | null;
  rival: boolean;
  /** The permission the stale source states regardless of the true lanes. */
  statedPermission: OriginationDrawdownPermission | null;
  seededReasons: readonly SeedReason[];
  conditions: readonly string[];
  drawdowns: OriginationDrawdownRequest[];
  explanationText: string | null;
}

function baseState(): SourceState {
  return {
    applicationState: "not-started",
    revision: 0,
    requestedAmount: null,
    claimRefs: [],
    decisionKind: null,
    decisionPolicyRevision: BASE_POLICY_REVISION,
    commitmentState: null,
    commitmentPolicyRevision: BASE_POLICY_REVISION,
    policyRevision: BASE_POLICY_REVISION,
    consentAssess: "granted",
    consentShare: "granted",
    consentVersion: 1,
    evidenceState: "valid",
    extraDocument: null,
    rival: false,
    statedPermission: null,
    seededReasons: [],
    conditions: [],
    drawdowns: [],
    explanationText: null,
  };
}

const ASSISTANT_TEXT = "Assistant summary of the source's reasons for this application. It is an explanation, not a review decision.";
const ASSISTANT_APPROVAL_TEXT = "This application looks likely to be approved. It is an assistant's reading and the source has made no decision.";

function submittedState(kind: OriginationDecisionKind): SourceState {
  return {
    ...baseState(),
    applicationState: "submitted",
    revision: 1,
    requestedAmount: SEED_REQUESTED_AMOUNT,
    claimRefs: ["clm-0001", "clm-0002"],
    decisionKind: kind,
    explanationText: ASSISTANT_TEXT,
  };
}

function committedState(): SourceState {
  return { ...submittedState("approved"), commitmentState: "accepted" };
}

function seedFor(scenario: OriginationScenario): SourceState {
  switch (scenario) {
    case "in-review":
    case "explanation-says-approved":
      return {
        ...submittedState("pending"),
        explanationText: scenario === "explanation-says-approved" ? ASSISTANT_APPROVAL_TEXT : ASSISTANT_TEXT,
      };
    case "conditional":
      return {
        ...submittedState("conditional"),
        conditions: ["CONDITION_PLEDGE_LESS", "CONDITION_EVIDENCE"],
        seededReasons: CONDITIONAL_REASONS,
        extraDocument: "requested",
      };
    case "more-information":
      return { ...submittedState("more-information"), seededReasons: MORE_INFORMATION_REASONS, extraDocument: "requested" };
    case "rejected":
      return { ...submittedState("rejected"), seededReasons: REJECTED_REASONS };
    case "approved":
      return submittedState("approved");
    case "offered":
      return { ...submittedState("approved"), commitmentState: "offered" };
    case "committed":
    case "claims-disbursed":
    case "limit-race":
      return committedState();
    case "stale-policy":
      return {
        ...committedState(),
        decisionPolicyRevision: OLDER_POLICY_REVISION,
        commitmentPolicyRevision: OLDER_POLICY_REVISION,
        statedPermission: "permitted",
      };
    case "consent-withdrawn":
      return { ...committedState(), consentAssess: "withdrawn" };
    case "docs-expired":
      return { ...committedState(), evidenceState: "expired" };
    case "limit-contended":
      return { ...committedState(), rival: true };
    default:
      return baseState();
  }
}

/** Synthetic source. State lives in this object, so a new port is a new session. */
export class StubCreditOrigination implements OriginationPort {
  readonly environment = "stub" as const;
  readonly source = "synthetic-origination" as const;
  readonly scenario: OriginationScenario;
  private readonly expectedTuple: DiscoveryReadTuple;
  private readonly state: SourceState;
  private snapshotSerial = 0;
  private drawdownSerial = 0;
  private revoked = false;
  /** limit-race: a rival request lands on the shared limit after the first read is served. */
  private rivalArmed: boolean;
  private readonly counts: OriginationEffectCounts = { reads: 0, acts: 0 };

  constructor(options: StubCreditOriginationOptions) {
    this.scenario = options.scenario ?? "clean";
    this.expectedTuple = options.expectedTuple ?? DISCOVERY_READ_TUPLE_LITERALS;
    this.state = seedFor(this.scenario);
    this.rivalArmed = this.scenario === "limit-race";
  }

  /** Test seam. Counts of what reached the source. Not part of the port. */
  effects(): OriginationEffectCounts {
    return { ...this.counts };
  }

  synthetic(control: OriginationSyntheticControl): boolean {
    const state = this.state;
    switch (control) {
      case "advance-review": {
        if (state.applicationState !== "submitted") {
          return false;
        }
        if (state.decisionKind === "pending") {
          state.decisionKind = "approved";
          state.decisionPolicyRevision = state.policyRevision;
          state.seededReasons = [];
          state.conditions = [];
          state.extraDocument = null;
          return true;
        }
        if (
          state.decisionKind === "approved" &&
          (state.commitmentState === null || state.commitmentState === "withdrawn" || state.commitmentState === "lapsed")
        ) {
          state.commitmentState = "offered";
          state.commitmentPolicyRevision = state.policyRevision;
          return true;
        }
        return false;
      }
      case "advance-policy":
        state.policyRevision += 1;
        return true;
      case "withdraw-consent":
        state.consentAssess = "withdrawn";
        state.consentVersion += 1;
        return true;
      case "expire-document":
        state.evidenceState = "expired";
        return true;
      case "rival-request":
        state.rival = true;
        return true;
      case "revoke-grant":
        this.revoked = true;
        return true;
      default: {
        const exhaustive: never = control;
        return exhaustive;
      }
    }
  }

  read(request: OriginationReadRequest): Promise<OriginationReadOutcome> {
    this.counts.reads += 1;
    if (this.scenario === "read-lost") {
      return Promise.reject(new Error("The answer to the read never arrived."));
    }
    return Promise.resolve(this.readNow(request));
  }

  act(request: OriginationActRequest): Promise<OriginationActOutcome> {
    this.counts.acts += 1;
    if (this.scenario === "act-lost") {
      // The request reached the source and took effect. The answer never arrives.
      this.actNow(request);
      return Promise.reject(new Error("The answer to the request never arrived."));
    }
    return Promise.resolve(this.actNow(request));
  }

  private gate(request: { contextKey: unknown; actorRef: unknown; scope: OriginationScope }): OriginationInvalid | OriginationDenied | null {
    if (!isNonEmpty(request.contextKey)) {
      return { kind: "invalid-request", code: "CONTEXT", detail: "A request carries a context key." };
    }
    if (!isNonEmpty(request.actorRef)) {
      return { kind: "invalid-request", code: "ACTOR", detail: "A request carries an actor string. It is a label, not an authentication result." };
    }
    const scope = request.scope as Partial<OriginationScope> | null | undefined;
    if (scope?.tenantId !== ORIGINATION_TENANT || !isOriginationRef(scope.applicantRef, "applicant")) {
      return { kind: "invalid-request", code: "SCOPE", detail: `A scope names tenant ${ORIGINATION_TENANT} and an applicant reference.` };
    }
    if (this.revoked || this.scenario === "denied") {
      return { kind: "denied", code: "GRANT_REVOKED", applicantRef: scope.applicantRef, detail: "The grant for this actor was withdrawn at the source. No row is returned." };
    }
    const granted = GRANTS.get(String(request.actorRef)) ?? [];
    if (!granted.includes(scope.applicantRef)) {
      return { kind: "denied", code: "SCOPE_DENIED", applicantRef: scope.applicantRef, detail: "This actor holds no grant for that applicant at the source. No row is returned." };
    }
    return null;
  }

  private readNow(request: OriginationReadRequest): OriginationReadOutcome {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return { kind: "tuple-changed", field: tuple.field, expected: tuple.expected, actual: tuple.actual };
    }
    const refusedRequest = this.gate(request);
    if (refusedRequest !== null) {
      return refusedRequest;
    }
    if (request.watermarkFloor !== null && Number.isNaN(Date.parse(request.watermarkFloor))) {
      return { kind: "invalid-request", code: "FLOOR", detail: "The watermark floor is not an instant." };
    }
    this.snapshotSerial += 1;
    const watermark = this.scenario === "stale" ? ORIGINATION_STALE_WATERMARK : ORIGINATION_AS_OF;
    const floor = request.watermarkFloor ?? (this.scenario === "stale" ? ORIGINATION_STALE_FLOOR : null);
    if (floor !== null && Date.parse(watermark) < Date.parse(floor)) {
      return { kind: "stale", watermark, floor };
    }
    if (this.scenario === "empty") {
      return { kind: "empty", watermark, snapshotId: this.snapshotSerial, scope: { ...request.scope } };
    }
    const snapshot = this.buildSnapshot(request.scope, watermark);
    // A rival request lands on the shared limit after this read was served.
    if (this.rivalArmed) {
      this.rivalArmed = false;
      this.state.rival = true;
    }
    const refused = refuseOriginationSnapshot(snapshot);
    if (refused !== null) {
      return refused;
    }
    return { kind: "ready", snapshot };
  }

  private consents(): OriginationConsent[] {
    const state = this.state;
    return [
      { consentRef: CONSENT_SHARE, purpose: "claim-data-share", state: state.consentShare, version: 1, setLabel: "set-2026-10-01" },
      { consentRef: CONSENT_ASSESS, purpose: "credit-assessment", state: state.consentAssess, version: state.consentVersion, setLabel: "set-2026-10-02" },
    ];
  }

  private documents(): OriginationDocument[] {
    const state = this.state;
    const evidenceExpired = state.evidenceState === "expired";
    const rows: OriginationDocument[] = [
      {
        documentRef: DOC_EVIDENCE,
        kind: "claim-evidence",
        state: state.evidenceState,
        claimRef: "clm-0001",
        expiresLabel: evidenceExpired ? "2026-10-11T00:00:00.000Z" : "2026-12-31T00:00:00.000Z",
        expired: evidenceExpired,
      },
      { documentRef: DOC_SALES, kind: "sales-statement", state: "valid", claimRef: "clm-0002", expiresLabel: "2026-12-31T00:00:00.000Z", expired: false },
    ];
    if (state.extraDocument !== null) {
      rows.push({ documentRef: DOC_EXTRA, kind: "additional-evidence", state: state.extraDocument, claimRef: "clm-0001", expiresLabel: null, expired: null });
    }
    return rows;
  }

  /** The reasons the source would name now: the seeded decision reasons, then the standing blockers. */
  private reasons(): OriginationReason[] {
    const state = this.state;
    const wanted: SeedReason[] = [...state.seededReasons];
    if (state.applicationState === "submitted" && state.decisionKind !== null && state.decisionKind !== "pending") {
      if (state.decisionPolicyRevision !== state.policyRevision) {
        wanted.push({
          lane: "policy",
          code: "POLICY_REVISION_SUPERSEDED",
          text: "The policy moved to a newer revision after this decision. The decision is not current. Ask for a review under the current revision.",
          remedy: "request-re-review",
        });
      }
    }
    if (state.applicationState === "submitted") {
      if (state.consentAssess !== "granted") {
        wanted.push({
          lane: "consent",
          code: state.consentAssess === "expired" ? "CONSENT_EXPIRED" : "CONSENT_WITHDRAWN",
          text: "The consent for credit assessment is not granted. Nothing proceeds on it until it is renewed.",
          remedy: "renew-consent",
        });
      }
      if (state.evidenceState === "expired") {
        wanted.push({
          lane: "document",
          code: "DOCUMENT_EXPIRED",
          text: "A claim evidence document has expired. Provide a current one.",
          remedy: "provide-document",
        });
      }
      if (state.rival) {
        wanted.push({
          lane: "limit",
          code: "LIMIT_TAKEN",
          text: "Another application took the shared limit first. No correction changes the order the source set.",
          remedy: "none",
        });
      }
    }
    return wanted.map((item, index) => ({ reasonRef: originationRefFor("reason", index + 1), lane: item.lane, code: item.code, text: item.text, remedy: item.remedy }));
  }

  /** The permission the source would state if it read its own lanes. */
  private truePermission(): { permission: OriginationDrawdownPermission; reasonCodes: string[] } {
    const state = this.state;
    if (state.decisionKind !== "approved" || state.commitmentState !== "accepted") {
      return { permission: "not-permitted", reasonCodes: ["NO_ACCEPTED_COMMITMENT"] };
    }
    const codes: string[] = [];
    if (state.decisionPolicyRevision !== state.policyRevision || state.commitmentPolicyRevision !== state.policyRevision) {
      codes.push("POLICY_REVISION_SUPERSEDED");
    }
    if (state.consentAssess !== "granted" || state.consentShare !== "granted") {
      codes.push("CONSENT_WITHDRAWN");
    }
    if (state.evidenceState === "expired" || state.extraDocument === "requested") {
      codes.push("DOCUMENT_EXPIRED");
    }
    if (state.rival) {
      codes.push("LIMIT_TAKEN");
    }
    return codes.length === 0 ? { permission: "permitted", reasonCodes: [] } : { permission: "suspended", reasonCodes: codes };
  }

  private buildSnapshot(scope: OriginationScope, watermark: string): OriginationSnapshot {
    const state = this.state;
    const own = scope.applicantRef;
    const mixed = this.scenario === "mixed-cut";
    const cuts: OriginationCut[] = [{ cutRef: CUT_CLAIMS, source: "claim-ledger", generation: CLAIM_GENERATION, watermark: ORIGINATION_AS_OF }];
    if (mixed) {
      cuts.push({ cutRef: CUT_BURDENS, source: "burden-register", generation: BURDEN_GENERATION, watermark: BURDEN_WATERMARK });
    }
    const claims: OriginationClaim[] = SEED_CLAIMS.filter((seed) => seed.applicantRef === own).map((seed) => ({
      claimRef: seed.claimRef,
      applicantRef: seed.applicantRef,
      tradeRef: seed.tradeRef,
      faceAmount: seed.faceAmount,
      unit: ORIGINATION_UNIT,
      state: "valid",
      reasonCode: null,
      cutRef: CUT_CLAIMS,
    }));
    let burdens: OriginationBurden[] = SEED_BURDENS.filter((seed) => seed.applicantRef === own).map((seed) => ({
      burdenRef: seed.burdenRef,
      applicantRef: seed.applicantRef,
      claimRef: this.scenario === "dangling-link" && seed.burdenRef === "bdn-0002" ? "clm-0099" : seed.claimRef,
      kind: seed.kind,
      state: seed.state,
      amount: seed.amount,
      unit: ORIGINATION_UNIT,
      cutRef: mixed ? CUT_BURDENS : CUT_CLAIMS,
    }));
    if (this.scenario === "scope-leak") {
      const leaked = SEED_BURDENS.find((seed) => seed.applicantRef === ORIGINATION_FOREIGN_REF);
      if (leaked !== undefined) {
        burdens = [...burdens, { ...leaked, unit: ORIGINATION_UNIT, cutRef: CUT_CLAIMS }];
      }
    }

    const submitted = state.applicationState === "submitted";
    const application: OriginationApplication = {
      applicationRef: APPLICATION_REF,
      applicantRef: own,
      state: state.applicationState,
      revision: state.revision,
      requestedAmount: state.requestedAmount,
      unit: ORIGINATION_UNIT,
      claimRefs: [...state.claimRefs],
    };
    const decision: OriginationDecision | null =
      submitted && state.decisionKind !== null
        ? {
            decisionRef: DECISION_REF,
            kind: state.decisionKind,
            policyRevision: state.decisionPolicyRevision,
            applicationRevision: state.revision,
            conditions: [...state.conditions],
          }
        : null;
    const shapedTerms = decision !== null && (decision.kind === "approved" || decision.kind === "conditional");
    const terms: OriginationTerms | null = shapedTerms
      ? { policyRevision: state.decisionPolicyRevision, rateLabel: SEED_RATE_LABEL, scheduleRows: SEED_SCHEDULE.map((row) => ({ ...row })), unit: ORIGINATION_UNIT }
      : null;
    const commitment: OriginationCommitment | null =
      submitted && state.commitmentState !== null
        ? { commitmentRef: COMMITMENT_REF, state: state.commitmentState, policyRevision: state.commitmentPolicyRevision }
        : null;
    const truth = this.truePermission();
    const drawdown: OriginationDrawdown = {
      permission: state.statedPermission ?? truth.permission,
      reasonCodes: state.statedPermission !== null ? [] : truth.reasonCodes,
      commitmentRef: commitment === null ? null : commitment.commitmentRef,
      requests: state.drawdowns.map((item) => ({ ...item })),
    };
    const limit: OriginationLimit = {
      limitRef: LIMIT_REF,
      amount: SEED_LIMIT_AMOUNT,
      unit: ORIGINATION_UNIT,
      contention: state.rival ? "contended" : "none",
      ranks: state.rival
        ? [
            { applicationRef: RIVAL_APPLICATION_REF, rank: 1 },
            { applicationRef: APPLICATION_REF, rank: 2 },
          ]
        : [{ applicationRef: APPLICATION_REF, rank: 1 }],
    };
    let nonClaims: OriginationNonClaims = { ...NON_CLAIMS };
    if (this.scenario === "claims-approval") {
      nonClaims = { ...nonClaims, submissionIsApproval: true } as unknown as OriginationNonClaims;
    }
    if (this.scenario === "claims-disbursed") {
      nonClaims = { ...nonClaims, disbursed: true } as unknown as OriginationNonClaims;
    }
    return {
      snapshotId: this.snapshotSerial,
      watermark,
      scenario: this.scenario,
      scope: { ...scope },
      cuts,
      application,
      claims,
      burdens,
      policy: { policyRef: POLICY_REF, currentRevision: state.policyRevision },
      consents: this.consents(),
      documents: this.documents(),
      decision,
      reasons: submitted ? this.reasons() : [],
      explanation:
        submitted && state.explanationText !== null
          ? { explanationRef: EXPLANATION_REF, provenance: "assistant-generated", text: state.explanationText }
          : null,
      terms,
      limit,
      commitment,
      drawdown,
      nonClaims,
    };
  }

  private rejected(code: OriginationRejectionCode, detail: string): OriginationActOutcome {
    return { kind: "rejected", code, detail };
  }

  private receipt(kind: OriginationActionKind, drawdownRef: string | null = null): OriginationReceipt {
    const state = this.state;
    return {
      kind,
      applicationRef: APPLICATION_REF,
      revision: state.revision,
      decisionAfter: state.decisionKind ?? "none",
      commitmentAfter: state.commitmentState ?? "none",
      drawdownRef,
      nonClaims: { ...NON_CLAIMS },
    };
  }

  private actNow(request: OriginationActRequest): OriginationActOutcome {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return { kind: "tuple-changed", field: tuple.field, expected: tuple.expected, actual: tuple.actual };
    }
    const refusedRequest = this.gate(request);
    if (refusedRequest !== null) {
      return refusedRequest;
    }
    const action = request.action as Partial<OriginationActionRequest> | null | undefined;
    if (action === null || action === undefined || !includes(ORIGINATION_ACTION_KINDS, action.kind)) {
      return { kind: "invalid-request", code: "ACTION", detail: "A request names one action from the list." };
    }
    const outcome = this.apply(request.action);
    if (outcome.kind !== "applied") {
      return outcome;
    }
    const refused = refuseOriginationReceipt(outcome.receipt, request.action);
    return refused !== null ? refused : outcome;
  }

  private apply(action: OriginationActionRequest): OriginationActOutcome {
    const state = this.state;
    switch (action.kind) {
      case "submit": {
        if (!isOriginationAmount(action.requestedAmount)) {
          return { kind: "invalid-request", code: "AMOUNT", detail: "The requested amount is a whole-unit string." };
        }
        if (!Array.isArray(action.claimRefs) || action.claimRefs.length === 0 || !action.claimRefs.every((ref) => isOriginationRef(ref, "claim"))) {
          return { kind: "invalid-request", code: "REF", detail: "A submission cites at least one claim reference." };
        }
        if (state.applicationState === "submitted") {
          return this.rejected("ALREADY_SUBMITTED", "An application is already submitted at the source. Amend it instead.");
        }
        const known = new Set(SEED_CLAIMS.filter((seed) => seed.applicantRef === ORIGINATION_OWN_REF).map((seed) => seed.claimRef));
        if (!action.claimRefs.every((ref) => known.has(ref))) {
          return this.rejected("CLAIM_NOT_VALID", "A cited claim is not a valid claim of this applicant at the source.");
        }
        if (state.consentAssess !== "granted" || state.consentShare !== "granted") {
          return this.rejected("CONSENT_WITHDRAWN", "A consent the assessment needs is not granted at the source.");
        }
        state.applicationState = "submitted";
        state.revision = 1;
        state.requestedAmount = action.requestedAmount;
        state.claimRefs = [...action.claimRefs];
        state.decisionKind = "pending";
        state.decisionPolicyRevision = state.policyRevision;
        state.explanationText = ASSISTANT_TEXT;
        const receipt = this.receipt("submit");
        if (this.scenario === "submit-claims-approval") {
          return { kind: "applied", receipt: { ...receipt, decisionAfter: "approved" } };
        }
        return { kind: "applied", receipt };
      }
      case "correct": {
        if (state.applicationState !== "submitted") {
          return this.rejected("NOT_SUBMITTED", "There is no submitted application at the source to correct.");
        }
        if (action.target === "application") {
          if (!isOriginationAmount(action.requestedAmount)) {
            return { kind: "invalid-request", code: "AMOUNT", detail: "The requested amount is a whole-unit string." };
          }
          if (state.decisionKind === "pending") {
            return this.rejected("REVIEW_IN_PROGRESS", "The review is in progress. An amendment waits for a decision.");
          }
          state.revision += 1;
          state.requestedAmount = action.requestedAmount;
          this.reopenReview();
          return { kind: "applied", receipt: this.receipt("correct") };
        }
        if (!isOriginationRef(action.ref, action.target)) {
          return { kind: "invalid-request", code: "REF", detail: `A ${action.target} correction names a ${action.target} reference.` };
        }
        if (action.target === "document") {
          const extra = action.ref === DOC_EXTRA && state.extraDocument === "requested";
          const evidence = action.ref === DOC_EVIDENCE && state.evidenceState !== "valid";
          if (!extra && !evidence) {
            return this.rejected("NOT_CORRECTABLE", "The source holds that document as valid, or lists no such document.");
          }
          if (extra) {
            state.extraDocument = "valid";
          } else {
            state.evidenceState = "valid";
          }
          if (state.decisionKind === "more-information" || state.decisionKind === "conditional") {
            state.seededReasons = state.seededReasons.filter((item) => item.remedy !== "provide-document");
            this.reopenReview();
          }
          return { kind: "applied", receipt: this.receipt("correct") };
        }
        if (action.ref !== CONSENT_ASSESS || state.consentAssess === "granted") {
          return this.rejected("NOT_CORRECTABLE", "The source holds that consent as granted, or lists no such consent.");
        }
        state.consentAssess = "granted";
        state.consentVersion += 1;
        return { kind: "applied", receipt: this.receipt("correct") };
      }
      case "re-review": {
        if (state.applicationState !== "submitted") {
          return this.rejected("NOT_SUBMITTED", "There is no submitted application at the source to review again.");
        }
        if (state.decisionKind === "pending") {
          return this.rejected("REVIEW_IN_PROGRESS", "The review is already in progress.");
        }
        this.reopenReview();
        return { kind: "applied", receipt: this.receipt("re-review") };
      }
      case "accept-commitment": {
        if (!isOriginationRef(action.commitmentRef, "commitment")) {
          return { kind: "invalid-request", code: "REF", detail: "A commitment acceptance names a commitment reference." };
        }
        if (state.commitmentState !== "offered" || action.commitmentRef !== COMMITMENT_REF) {
          return this.rejected("NO_COMMITMENT", "The source holds no offered commitment under that reference. An approval is not a commitment.");
        }
        if (state.decisionKind !== "approved") {
          return this.rejected("NOT_APPROVED", "The decision is not approved at the source.");
        }
        if (state.decisionPolicyRevision !== state.policyRevision || state.commitmentPolicyRevision !== state.policyRevision) {
          return this.rejected("STALE_POLICY", "The policy moved to a newer revision. The commitment was offered under an older one.");
        }
        if (state.consentAssess !== "granted" || state.consentShare !== "granted") {
          return this.rejected("CONSENT_WITHDRAWN", "A consent the assessment needs is not granted at the source.");
        }
        if (state.evidenceState === "expired") {
          return this.rejected("DOCUMENT_EXPIRED", "A claim evidence document has expired at the source.");
        }
        state.commitmentState = "accepted";
        return { kind: "applied", receipt: this.receipt("accept-commitment") };
      }
      case "request-drawdown": {
        if (!isOriginationRef(action.commitmentRef, "commitment")) {
          return { kind: "invalid-request", code: "REF", detail: "A drawdown request names a commitment reference." };
        }
        if (state.commitmentState !== "accepted" || action.commitmentRef !== COMMITMENT_REF) {
          return this.rejected("NO_COMMITMENT", "The source holds no accepted commitment under that reference.");
        }
        const truth = this.truePermission();
        if (state.rival) {
          return this.rejected("LIMIT_TAKEN", "Another request took the shared limit before this one. The source keeps the order it set.");
        }
        if (truth.permission !== "permitted") {
          const first = truth.reasonCodes[0] ?? "DRAWDOWN_NOT_PERMITTED";
          if (first === "POLICY_REVISION_SUPERSEDED") {
            return this.rejected("STALE_POLICY", "The policy moved to a newer revision. The commitment was built under an older one.");
          }
          if (first === "CONSENT_WITHDRAWN") {
            return this.rejected("CONSENT_WITHDRAWN", "A consent the assessment needs is not granted at the source.");
          }
          if (first === "DOCUMENT_EXPIRED") {
            return this.rejected("DOCUMENT_EXPIRED", "A claim evidence document has expired at the source.");
          }
          return this.rejected("DRAWDOWN_NOT_PERMITTED", "The source does not permit a drawdown now.");
        }
        this.drawdownSerial += 1;
        const drawdownRef = originationRefFor("drawdown", this.drawdownSerial);
        state.drawdowns.push({ drawdownRef, state: "recorded" });
        return { kind: "applied", receipt: this.receipt("request-drawdown", drawdownRef) };
      }
      default: {
        const exhaustive: never = action;
        return exhaustive;
      }
    }
  }

  /** The source opens a new review: the decision is pending again under the current policy. */
  private reopenReview(): void {
    const state = this.state;
    state.decisionKind = "pending";
    state.decisionPolicyRevision = state.policyRevision;
    state.conditions = [];
    state.seededReasons = [];
    state.statedPermission = null;
    if (state.commitmentState !== null) {
      state.commitmentState = "withdrawn";
    }
  }
}
