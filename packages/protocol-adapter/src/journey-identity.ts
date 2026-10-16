import { JOURNEY_NOT_COMPOSED, type JourneyNotComposed } from "./booking-journey.js";
import { COMMERCE_COMMAND_BINDINGS } from "./commerce-bindings.js";
import { liveTupleKey } from "./contract-fixtures.js";
import {
  DISCOVERY_PROJECTION_AS_OF,
  DISCOVERY_READ_TUPLE_LITERALS,
  checkDiscoveryReadTuple,
  type DiscoveryReadTuple,
} from "./discovery-read.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";

/**
 * App-internal journey context key and the read-observation adjudicator.
 *
 * This is the stub-scope stand-in for pending node `c-journey-identity`: the
 * real context-bound identity and field-path binding registry waits on
 * kix-protocol:protocol-runtime-boundary-register,
 * protocol-canonical-identity-conformance, protocol-read-projection-evidence,
 * and contract-compatibility-profile. This module defines an app-internal
 * format only. It is not an external schema, not an operation, not a
 * capability, and not a public identifier format, and it sends nothing over a
 * network.
 *
 * The context key binds a journey session to the adapter mode, the actor
 * label, the role, the protocol domain, the source cut generation, the pin
 * tuple, and the session incarnation. The tuple key is an app-internal
 * comparison string built from the live pins; it is not a protocol digest and
 * no canonical encoding is declared here.
 *
 * Every read result is adjudicated as a non-authoritative observation before
 * it may be shown or used: an item minted under a different mode, domain,
 * tuple, or actor/role/session, or under a newer cut, is foreign and is
 * refused as evidence; an item minted under an older cut or served behind the
 * watermark floor is stale. A read observation is never a proof of payment,
 * issuance, or admission.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const JOURNEY_IDENTITY_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const JOURNEY_IDENTITY_NOT_BOUND_REASON =
  "The contract-only catalogue has no read command for a journey projection and no evidence record command, and the context-bound identity registry stays pending on kix-protocol (protocol-runtime-boundary-register, protocol-canonical-identity-conformance, protocol-read-projection-evidence, contract-compatibility-profile). The journey context desk stays not-bound on integration-http.";

export const JOURNEY_IDENTITY_PROJECTION_NAME = "kix.journey.identity";

/** Fixed instant the synthetic source claims to be built at. */
export const JOURNEY_IDENTITY_AS_OF = DISCOVERY_PROJECTION_AS_OF;

/** Watermark the stale scenario serves, and the floor a reader holds against it. */
export const JOURNEY_IDENTITY_STALE_WATERMARK = "2026-10-10T00:00:00.000Z";
export const JOURNEY_IDENTITY_STALE_FLOOR = "2026-10-12T00:00:00.000Z";

/** The desk's own actor string. It is a context label, not an authentication result. */
export const JOURNEY_IDENTITY_DESK_ACTOR = "identity-desk";
/** A second actor the switch control toggles to. Also a context label, not auth. */
export const JOURNEY_IDENTITY_PEER_ACTOR = "peer-desk";

export const JOURNEY_IDENTITY_ROLES = ["buyer", "organizer", "operator"] as const;

export type JourneyRole = (typeof JOURNEY_IDENTITY_ROLES)[number];

/**
 * The fields bound into one journey context key. The join is an app-internal
 * correlation key; it is not a public identifier format.
 */
export const JOURNEY_CONTEXT_FIELDS = [
  "environment",
  "actorRef",
  "role",
  "domain",
  "cutGeneration",
  "tupleKey",
  "incarnation",
] as const;

export interface JourneyContextParts {
  /** Adapter mode. */
  environment: "stub" | "integration-http";
  /** A context label. It is not an authentication result. */
  actorRef: string;
  role: JourneyRole;
  domain: string;
  /** The source cut generation this session is bound to. */
  cutGeneration: number;
  /** App-internal comparison string over the live pin tuple. Not a protocol digest. */
  tupleKey: string;
  /** Session incarnation. Bumped on every context switch or source reset. */
  incarnation: number;
}

export interface JourneyContext extends JourneyContextParts {
  key: string;
}

export function journeyContextKey(parts: JourneyContextParts): string {
  return [
    parts.environment,
    parts.actorRef,
    parts.role,
    parts.domain,
    `cut-${parts.cutGeneration}`,
    parts.tupleKey,
    `session-${parts.incarnation}`,
  ].join("|");
}

/** The stamp a source puts on the item it minted. Observation fields stay null on a receipt-free row. */
export interface JourneyContextStamp {
  environment: "stub" | "integration-http";
  domain: string;
  tupleKey: string;
  cutGeneration: number;
  /** Recording session fields. Null on an ambient observation row. */
  actorRef: string | null;
  role: JourneyRole | null;
  incarnation: number | null;
}

export const JOURNEY_IDENTITY_ITEM_KINDS = ["observation", "receipt"] as const;

export type JourneyIdentityItemKind = (typeof JOURNEY_IDENTITY_ITEM_KINDS)[number];

/**
 * Non-claim fields every item and every write receipt states as literal
 * false. An observation row is never a proof of payment, issuance, or
 * admission, and nothing here is a real integration or a production
 * environment.
 */
export const JOURNEY_IDENTITY_NON_CLAIM_FIELDS = [
  "confirmsPayment",
  "confirmsIssuance",
  "confirmsAdmission",
  "realIntegration",
  "productionEnvironment",
] as const;

export type JourneyIdentityNonClaimField = (typeof JOURNEY_IDENTITY_NON_CLAIM_FIELDS)[number];

export type JourneyIdentityNonClaims = Readonly<Record<JourneyIdentityNonClaimField, false>>;

const JOURNEY_IDENTITY_NON_CLAIMS: JourneyIdentityNonClaims = {
  confirmsPayment: false,
  confirmsIssuance: false,
  confirmsAdmission: false,
  realIntegration: false,
  productionEnvironment: false,
};

export interface JourneyIdentityItem {
  itemId: string;
  kind: JourneyIdentityItemKind;
  subjectRef: string;
  stamp: JourneyContextStamp;
  watermark: string;
  note: string;
  confirmsPayment: false;
  confirmsIssuance: false;
  confirmsAdmission: false;
  realIntegration: false;
  productionEnvironment: false;
}

// ---------------------------------------------------------------------------
// Identity. Each kind has its own prefix and one kind is never read as another.
// ---------------------------------------------------------------------------

export const JOURNEY_IDENTITY_REF_KINDS = ["observation", "evidence", "subject"] as const;

export type JourneyIdentityRefKind = (typeof JOURNEY_IDENTITY_REF_KINDS)[number];

const REF_PREFIX: Readonly<Record<JourneyIdentityRefKind, string>> = {
  observation: "obs-",
  evidence: "evd-",
  subject: "sub-",
};

const REF_PATTERN = /^(obs|evd|sub)-[0-9]{4}$/;

export function identityRef(kind: JourneyIdentityRefKind, serial: number): string {
  return `${REF_PREFIX[kind]}${String(serial).padStart(4, "0")}`;
}

export function identityRefKind(ref: string): JourneyIdentityRefKind | null {
  if (!REF_PATTERN.test(ref)) {
    return null;
  }
  for (const kind of JOURNEY_IDENTITY_REF_KINDS) {
    if (ref.startsWith(REF_PREFIX[kind])) {
      return kind;
    }
  }
  return null;
}

export function isIdentityRef(ref: unknown, kind: JourneyIdentityRefKind): ref is string {
  return typeof ref === "string" && identityRefKind(ref) === kind;
}

// ---------------------------------------------------------------------------
// The read-observation adjudicator
// ---------------------------------------------------------------------------

export const JOURNEY_VERDICTS = ["current", "stale", "foreign", "refused"] as const;

export type JourneyVerdict = (typeof JOURNEY_VERDICTS)[number];

export type JourneyVerdictCause =
  | "match"
  | "watermark"
  | "generation-behind"
  | "generation-ahead"
  | "mode"
  | "actor"
  | "role"
  | "session"
  | "domain"
  | "tuple"
  | "claim"
  | "shape";

export interface ObservationVerdict {
  item: JourneyIdentityItem;
  verdict: JourneyVerdict;
  cause: JourneyVerdictCause;
  detail: string;
}

/** The non-claim check a whole read applies before a row may be shown. */
export function refuseIdentityItem(item: JourneyIdentityItem): JourneyVerdictCause | null {
  if (typeof item.itemId !== "string" || identityRefKind(item.itemId) === null) {
    return "shape";
  }
  if (!isIdentityRef(item.subjectRef, "subject")) {
    return "shape";
  }
  if (!JOURNEY_IDENTITY_ITEM_KINDS.includes(item.kind)) {
    return "shape";
  }
  for (const field of JOURNEY_IDENTITY_NON_CLAIM_FIELDS) {
    if (item[field] !== false) {
      return "claim";
    }
  }
  return null;
}

/**
 * Adjudicates one observation or receipt against the current journey context
 * before it may be used. A `current` verdict means the row may be shown as a
 * non-authoritative observation of this journey's context. It is never a
 * proof of payment, issuance, or admission.
 *
 * Binding rules:
 *  - An observation row binds to the cut it was minted on: environment,
 *    domain, tuple, and cut generation. A different mode, domain, or tuple is
 *    foreign. An older cut is stale; a newer cut is foreign to this session.
 *  - A receipt row additionally binds to the recording session: actor, role,
 *    and incarnation. A receipt minted under another context is foreign and is
 *    never this journey's evidence.
 *  - A watermark older than the floor the reader holds is stale.
 */
export function adjudicateObservation(
  context: JourneyContext,
  item: JourneyIdentityItem,
  watermarkFloor: string | null,
): ObservationVerdict {
  const refused = refuseIdentityItem(item);
  if (refused !== null) {
    return {
      item,
      verdict: "refused",
      cause: refused,
      detail:
        refused === "claim"
          ? `Item ${item.itemId} claims a non-claim. An observation is never a proof of payment, issuance, or admission.`
          : `Item ${String(item.itemId)} is malformed.`,
    };
  }
  const stamp = item.stamp;
  if (stamp.tupleKey !== context.tupleKey) {
    return {
      item,
      verdict: "foreign",
      cause: "tuple",
      detail: `Item ${item.itemId} was minted under a different pin tuple. It is never this journey's evidence.`,
    };
  }
  if (stamp.domain !== context.domain) {
    return {
      item,
      verdict: "foreign",
      cause: "domain",
      detail: `Item ${item.itemId} was minted under domain ${stamp.domain}. It is never this journey's evidence.`,
    };
  }
  if (stamp.environment !== context.environment) {
    return {
      item,
      verdict: "foreign",
      cause: "mode",
      detail: `Item ${item.itemId} was minted under mode ${stamp.environment}. It is never this journey's evidence.`,
    };
  }
  if (stamp.cutGeneration > context.cutGeneration) {
    return {
      item,
      verdict: "foreign",
      cause: "generation-ahead",
      detail: `Item ${item.itemId} was minted under a newer cut (${stamp.cutGeneration}) than this session is bound to (${context.cutGeneration}). It is not this journey's evidence.`,
    };
  }
  if (stamp.cutGeneration < context.cutGeneration) {
    return {
      item,
      verdict: "stale",
      cause: "generation-behind",
      detail: `Item ${item.itemId} was minted under cut ${stamp.cutGeneration}; this session is bound to cut ${context.cutGeneration}. It stays stale and is not evidence.`,
    };
  }
  if (watermarkFloor !== null && Date.parse(item.watermark) < Date.parse(watermarkFloor)) {
    return {
      item,
      verdict: "stale",
      cause: "watermark",
      detail: `Item ${item.itemId} carries watermark ${item.watermark}, older than the floor ${watermarkFloor}. It stays stale and is not evidence.`,
    };
  }
  if (item.kind === "receipt") {
    if (stamp.actorRef !== context.actorRef) {
      return {
        item,
        verdict: "foreign",
        cause: "actor",
        detail: `Receipt ${item.itemId} was recorded under a different actor. A receipt from another context is not this journey's evidence.`,
      };
    }
    if (stamp.role !== context.role) {
      return {
        item,
        verdict: "foreign",
        cause: "role",
        detail: `Receipt ${item.itemId} was recorded under a different role. A receipt from another context is not this journey's evidence.`,
      };
    }
    if (stamp.incarnation !== context.incarnation) {
      return {
        item,
        verdict: "foreign",
        cause: "session",
        detail: `Receipt ${item.itemId} was recorded under an earlier session. A receipt from another context is not this journey's evidence.`,
      };
    }
  }
  return {
    item,
    verdict: "current",
    cause: "match",
    detail:
      item.kind === "receipt"
        ? `Receipt ${item.itemId} was recorded under this context. It is a non-authoritative observation, not a proof of payment, issuance, or admission.`
        : `Item ${item.itemId} was minted on this context's cut. It is a non-authoritative observation, not a proof of payment, issuance, or admission.`,
  };
}

// ---------------------------------------------------------------------------
// Snapshot and outcome shapes
// ---------------------------------------------------------------------------

export interface JourneyIdentitySnapshot {
  /** Read serial on this port. It orders reads and is not a commit position. */
  snapshotId: number;
  /** The source cut generation this read was taken on. */
  generation: number;
  watermark: string;
  scenario: JourneyIdentityScenario;
  items: readonly JourneyIdentityItem[];
}

export interface IdentityReceiptRefs {
  evidenceRef: string;
  observationId: string;
  subjectRef: string;
  cutGeneration: number;
}

export interface IdentityReadRequest {
  contextKey: string;
  watermarkFloor: string | null;
}

export interface IdentityWriteRequest {
  contextKey: string;
  actorRef: string;
  role: JourneyRole;
  incarnation: number;
  /** The caller's intent. The source does not de-duplicate on it. */
  intentRef: string;
  /** The observation this attach records as evidence. */
  observationId: string;
  /** The cut generation the caller's session is bound to. */
  expectedCut: number;
}

export type IdentityTupleChanged = { kind: "tuple-changed"; field: string; expected: string; actual: string };

export type IdentityRefused = {
  kind: "refused";
  code: IdentityRefusalCode;
  field: string;
  ref: string | null;
  detail: string;
};

export type IdentityReadOutcome =
  | { kind: "ready"; snapshot: JourneyIdentitySnapshot }
  | { kind: "empty"; watermark: string; generation: number; snapshotId: number }
  | { kind: "stale"; watermark: string; floor: string }
  | IdentityRefused
  | IdentityTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export type IdentityWriteOutcome =
  | {
      kind: "confirmed";
      step: "attach";
      intentRef: string;
      contextKey: string;
      refs: IdentityReceiptRefs;
      nonClaims: JourneyIdentityNonClaims;
    }
  | {
      kind: "rejected";
      step: "attach";
      intentRef: string;
      contextKey: string;
      code: IdentityRejectCode;
      detail: string;
    }
  | { kind: "unknown"; step: "attach"; intentRef: string; contextKey: string; message: string }
  | { kind: "invalid-request"; step: string; intentRef: string; contextKey: string; code: IdentityInvalidCode; detail: string }
  | (IdentityTupleChanged & { step: string; intentRef: string; contextKey: string })
  | { kind: "not-bound"; reason: string };

/**
 * A result that reaches the client after the client had already treated the
 * write as unknown. A late delivery is evidence. It does not make the write
 * known.
 */
export interface IdentityLateDelivery {
  intentRef: string;
  contextKey: string;
  result: "confirmed" | "rejected";
  code: IdentityRejectCode | null;
}

export const JOURNEY_IDENTITY_SCENARIOS = [
  "clean",
  "empty",
  "stale",
  "foreign-mix",
  "older-cut",
  "claims-proof",
  "attach-lost",
  "held-response",
] as const;

export type JourneyIdentityScenario = (typeof JOURNEY_IDENTITY_SCENARIOS)[number];

export const IDENTITY_REJECT_CODES = [
  "GENERATION_STALE",
  "EVIDENCE_FOREIGN",
  "EVIDENCE_STALE",
  "ALREADY_RECORDED",
  "UNKNOWN_REF",
] as const;

export type IdentityRejectCode = (typeof IDENTITY_REJECT_CODES)[number];

/** A rejection with one of these codes means the page read before it wrote is behind. */
export const IDENTITY_STALE_CLASS_CODES: readonly IdentityRejectCode[] = ["GENERATION_STALE", "EVIDENCE_STALE"];

export const IDENTITY_INVALID_CODES = ["INTENT", "IDENTITY", "GENERATION"] as const;

export type IdentityInvalidCode = (typeof IDENTITY_INVALID_CODES)[number];

export const IDENTITY_REFUSAL_CODES = ["CLAIM", "SHAPE"] as const;

export type IdentityRefusalCode = (typeof IDENTITY_REFUSAL_CODES)[number];

/** Quote of the locked hold binding. H1 keeps this consideredAction and keeps it not-bound. */
export const JOURNEY_IDENTITY_HOLD_NOT_BOUND = {
  method: "placeHold",
  status: COMMERCE_COMMAND_BINDINGS.placeHold.status,
  consideredAction: COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction,
  reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
  mappedOntoPrepareTrade: false,
} as const;

export interface JourneyIdentityNotComposed {
  action: JourneyNotComposed["action"] | "refund_ticket";
  reason: string;
}

/**
 * Catalogue commands this module records and does not send. The journey list
 * is reused as is, plus refund_ticket: this desk composes nothing and mints
 * no command, receipt, or public identifier.
 */
export const JOURNEY_IDENTITY_NOT_COMPOSED: readonly JourneyIdentityNotComposed[] = [
  ...JOURNEY_NOT_COMPOSED,
  {
    action: "refund_ticket",
    reason: `${JOURNEY_IDENTITY_RULING}. refund_ticket is pinned and never composed here. This desk adjudicates synthetic observations and records no refund.`,
  },
];

// ---------------------------------------------------------------------------
// Port
// ---------------------------------------------------------------------------

export interface JourneyIdentityPort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic-identity" | "none";
  readonly scenario: JourneyIdentityScenario;
  /** The cut generation the source currently serves. Rotates under the synthetic control. */
  currentGeneration(): number;
  read(request: IdentityReadRequest): Promise<IdentityReadOutcome>;
  submit(request: IdentityWriteRequest): Promise<IdentityWriteOutcome>;
  /** Synthetic control: rotates the source cut. A real producer offers no such call. */
  rotateCut(): number;
  /** Synthetic control: releases responses the held-response scenario is holding. Returns how many. */
  deliverHeld(): number;
  /** Synthetic control: takes the late results that are due. A real producer offers no such call. */
  deliverLate(): readonly IdentityLateDelivery[];
}

export interface StubJourneyIdentityOptions {
  scenario?: JourneyIdentityScenario;
  /** In attach-lost, whether the late result confirmed or rejected. Default confirmed. */
  lateResult?: "confirmed" | "rejected";
  /** Expected tuple override. Used to stage a producer change in tests. */
  expectedTuple?: DiscoveryReadTuple;
}

export interface IdentityEffectCounts {
  /** submit calls that reached the source, whatever they returned. */
  submits: number;
  attaches: number;
}

export function createStubJourneyIdentity(options: StubJourneyIdentityOptions = {}): StubJourneyIdentity {
  return new StubJourneyIdentity(options);
}

export function createNotBoundJourneyIdentity(): JourneyIdentityPort {
  const outcome = { kind: "not-bound", reason: JOURNEY_IDENTITY_NOT_BOUND_REASON } as const;
  return {
    environment: "integration-http",
    source: "none",
    scenario: "clean",
    currentGeneration() {
      return 0;
    },
    read() {
      return Promise.resolve({ ...outcome });
    },
    submit() {
      return Promise.resolve({ ...outcome });
    },
    rotateCut() {
      return 0;
    },
    deliverHeld() {
      return 0;
    },
    deliverLate() {
      return [];
    },
  };
}

export function journeyIdentityPortFor(
  environment: "stub" | "integration-http",
  options: StubJourneyIdentityOptions = {},
): JourneyIdentityPort {
  if (environment === "stub") {
    return createStubJourneyIdentity(options);
  }
  return createNotBoundJourneyIdentity();
}

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function claimRefusal(field: string, ref: string | null): IdentityRefused {
  return {
    kind: "refused",
    code: "CLAIM",
    field,
    ref,
    detail: `The payload does not state ${field} as false. An observation is never a proof of payment, issuance, or admission, and nothing here is a real integration or a production environment.`,
  };
}

/**
 * Whole-payload validation before a row is shown. A malformed reference or an
 * item that claims a non-claim refuses the whole payload.
 */
export function refuseIdentitySnapshot(snapshot: JourneyIdentitySnapshot): IdentityRefused | null {
  for (const item of snapshot.items) {
    const bad = refuseIdentityItem(item);
    if (bad === "claim") {
      const field = JOURNEY_IDENTITY_NON_CLAIM_FIELDS.find((name) => item[name] !== false) ?? "confirmsPayment";
      return claimRefusal(field, item.itemId);
    }
    if (bad !== null) {
      return {
        kind: "refused",
        code: "SHAPE",
        field: "items[]",
        ref: typeof item.itemId === "string" ? item.itemId : null,
        detail: "An item carries a malformed identity field.",
      };
    }
  }
  return null;
}

/**
 * Receipt validation. A confirmed answer that does not state every non-claim
 * as literal false is untrusted, and the caller treats the write as unknown.
 */
export function refuseIdentityReceipt(nonClaims: JourneyIdentityNonClaims): IdentityRefused | null {
  for (const field of JOURNEY_IDENTITY_NON_CLAIM_FIELDS) {
    if (nonClaims[field] !== false) {
      return claimRefusal(field, null);
    }
  }
  return null;
}

interface SeedSpec {
  subjectSerial: number;
  stamp: Partial<JourneyContextStamp>;
  note: string;
  watermark?: string;
  claims?: Partial<Record<JourneyIdentityNonClaimField, boolean>>;
}

/** Synthetic source. State lives in this object, so a new port is a new session. */
export class StubJourneyIdentity implements JourneyIdentityPort {
  readonly environment = "stub" as const;
  readonly source = "synthetic-identity" as const;
  readonly scenario: JourneyIdentityScenario;
  private readonly lateResult: "confirmed" | "rejected";
  private readonly expectedTuple: DiscoveryReadTuple;
  private readonly tupleKey = liveTupleKey();
  private readonly items: JourneyIdentityItem[] = [];
  private readonly held: { release: () => void }[] = [];
  private late: IdentityLateDelivery[] = [];
  private generation: number;
  private snapshotSerial = 0;
  private itemSerial = 1;
  private evidenceSerial = 1;
  private readonly counts: IdentityEffectCounts = { submits: 0, attaches: 0 };

  constructor(options: StubJourneyIdentityOptions) {
    this.scenario = options.scenario ?? "clean";
    this.lateResult = options.lateResult ?? "confirmed";
    this.expectedTuple = options.expectedTuple ?? DISCOVERY_READ_TUPLE_LITERALS;
    this.generation = this.scenario === "older-cut" ? 2 : 1;
    this.seed();
  }

  /** Test seam. Counts of what reached the source. Not part of the port. */
  effects(): IdentityEffectCounts {
    return { ...this.counts };
  }

  currentGeneration(): number {
    return this.generation;
  }

  rotateCut(): number {
    this.generation += 1;
    return this.generation;
  }

  deliverHeld(): number {
    const releasing = this.held.splice(0, this.held.length);
    for (const entry of releasing) {
      entry.release();
    }
    return releasing.length;
  }

  deliverLate(): readonly IdentityLateDelivery[] {
    const due = this.late;
    this.late = [];
    return due;
  }

  read(request: IdentityReadRequest): Promise<IdentityReadOutcome> {
    return Promise.resolve(this.readNow(request));
  }

  submit(request: IdentityWriteRequest): Promise<IdentityWriteOutcome> {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return Promise.resolve({
        kind: "tuple-changed",
        field: tuple.field,
        expected: tuple.expected,
        actual: tuple.actual,
        step: "attach",
        intentRef: request.intentRef,
        contextKey: request.contextKey,
      });
    }
    const invalid = this.validate(request);
    if (invalid !== null) {
      return Promise.resolve(invalid);
    }
    this.counts.submits += 1;
    const outcome = this.applyAttach(request);
    if (this.scenario === "held-response") {
      return new Promise<IdentityWriteOutcome>((resolve) => {
        this.held.push({ release: () => resolve(outcome) });
      });
    }
    return Promise.resolve(outcome);
  }

  private baseStamp(): JourneyContextStamp {
    return {
      environment: "stub",
      domain: PINNED_PROTOCOL_DOMAIN,
      tupleKey: this.tupleKey,
      cutGeneration: this.generation,
      actorRef: null,
      role: null,
      incarnation: null,
    };
  }

  private mint(kind: JourneyIdentityItemKind, spec: SeedSpec): JourneyIdentityItem {
    const serial = this.itemSerial;
    this.itemSerial += 1;
    const item = {
      itemId: identityRef(kind === "receipt" ? "evidence" : "observation", serial),
      kind,
      subjectRef: identityRef("subject", spec.subjectSerial),
      stamp: { ...this.baseStamp(), ...spec.stamp },
      watermark: spec.watermark ?? JOURNEY_IDENTITY_AS_OF,
      note: spec.note,
      confirmsPayment: spec.claims?.confirmsPayment === true,
      confirmsIssuance: spec.claims?.confirmsIssuance === true,
      confirmsAdmission: spec.claims?.confirmsAdmission === true,
      realIntegration: spec.claims?.realIntegration === true,
      productionEnvironment: spec.claims?.productionEnvironment === true,
    } as unknown as JourneyIdentityItem;
    this.items.push(item);
    return item;
  }

  private seed(): void {
    switch (this.scenario) {
      case "clean":
      case "attach-lost":
      case "held-response":
        this.mint("observation", { subjectSerial: 1, stamp: {}, note: "A booking was observed on this cut." });
        this.mint("observation", { subjectSerial: 2, stamp: {}, note: "A listing was observed on this cut." });
        break;
      case "foreign-mix":
        this.mint("observation", { subjectSerial: 1, stamp: {}, note: "A booking was observed on this cut." });
        this.mint("observation", {
          subjectSerial: 2,
          stamp: { environment: "integration-http" },
          note: "Minted under another mode.",
        });
        this.mint("observation", {
          subjectSerial: 3,
          stamp: { domain: "kix:other-domain" },
          note: "Minted under another domain.",
        });
        this.mint("observation", {
          subjectSerial: 4,
          stamp: { tupleKey: "tuple:previous" },
          note: "Minted under a previous pin tuple.",
        });
        this.mint("receipt", {
          subjectSerial: 5,
          stamp: { actorRef: JOURNEY_IDENTITY_PEER_ACTOR, role: "buyer", incarnation: 1 },
          note: "Recorded under another actor.",
        });
        this.mint("receipt", {
          subjectSerial: 6,
          stamp: { actorRef: JOURNEY_IDENTITY_DESK_ACTOR, role: "operator", incarnation: 7 },
          note: "Recorded under an earlier session of the same actor.",
        });
        break;
      case "older-cut":
        this.mint("observation", { subjectSerial: 1, stamp: {}, note: "Minted on the current cut." });
        this.mint("observation", {
          subjectSerial: 2,
          stamp: { cutGeneration: 1 },
          note: "Minted under the previous cut.",
        });
        this.mint("receipt", {
          subjectSerial: 3,
          stamp: { cutGeneration: 1, actorRef: JOURNEY_IDENTITY_DESK_ACTOR, role: "operator", incarnation: 1 },
          note: "A receipt recorded under the previous cut.",
        });
        this.mint("observation", {
          subjectSerial: 4,
          stamp: { cutGeneration: 3 },
          note: "Minted under a newer cut than this session binds.",
        });
        break;
      case "claims-proof":
        this.mint("observation", { subjectSerial: 1, stamp: {}, note: "A booking was observed on this cut." });
        this.mint("observation", {
          subjectSerial: 2,
          stamp: {},
          note: "Claims a proof.",
          claims: { confirmsPayment: true },
        });
        break;
      default:
        break;
    }
  }

  private readNow(request: IdentityReadRequest): IdentityReadOutcome {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return { kind: "tuple-changed", field: tuple.field, expected: tuple.expected, actual: tuple.actual };
    }
    if (!nonEmpty(request.contextKey)) {
      return {
        kind: "refused",
        code: "SHAPE",
        field: "contextKey",
        ref: null,
        detail: "A read carries the session's context key.",
      };
    }
    this.snapshotSerial += 1;
    const watermark = this.scenario === "stale" ? JOURNEY_IDENTITY_STALE_WATERMARK : JOURNEY_IDENTITY_AS_OF;
    const floor = request.watermarkFloor ?? (this.scenario === "stale" ? JOURNEY_IDENTITY_STALE_FLOOR : null);
    if (floor !== null && Date.parse(watermark) < Date.parse(floor)) {
      return { kind: "stale", watermark, floor };
    }
    if (this.items.length === 0) {
      return { kind: "empty", watermark, generation: this.generation, snapshotId: this.snapshotSerial };
    }
    const snapshot: JourneyIdentitySnapshot = {
      snapshotId: this.snapshotSerial,
      generation: this.generation,
      watermark,
      scenario: this.scenario,
      items: this.items.map((item) => ({ ...item, stamp: { ...item.stamp } })),
    };
    const refused = refuseIdentitySnapshot(snapshot);
    if (refused !== null) {
      return refused;
    }
    return { kind: "ready", snapshot };
  }

  private invalid(
    request: { intentRef: unknown; contextKey: unknown },
    code: IdentityInvalidCode,
    detail: string,
  ): IdentityWriteOutcome {
    return {
      kind: "invalid-request",
      step: "attach",
      intentRef: String(request.intentRef),
      contextKey: String(request.contextKey),
      code,
      detail,
    };
  }

  private validate(request: IdentityWriteRequest): IdentityWriteOutcome | null {
    if (!nonEmpty(request.intentRef) || !nonEmpty(request.contextKey)) {
      return this.invalid(request, "INTENT", "A write carries an intent reference and a context key.");
    }
    if (identityRefKind(request.observationId) === null) {
      return this.invalid(request, "IDENTITY", "An attach names an observation or a receipt reference.");
    }
    if (!Number.isInteger(request.expectedCut)) {
      return this.invalid(request, "GENERATION", "An attach carries the cut generation it was built under.");
    }
    if (!nonEmpty(request.actorRef) || !JOURNEY_IDENTITY_ROLES.includes(request.role) || !Number.isInteger(request.incarnation)) {
      return this.invalid(request, "IDENTITY", "An attach carries the session's actor, role, and incarnation labels.");
    }
    return null;
  }

  private rejected(request: IdentityWriteRequest, code: IdentityRejectCode, detail: string): IdentityWriteOutcome {
    return { kind: "rejected", step: "attach", intentRef: request.intentRef, contextKey: request.contextKey, code, detail };
  }

  private lost(request: IdentityWriteRequest, message: string): IdentityWriteOutcome {
    return { kind: "unknown", step: "attach", intentRef: request.intentRef, contextKey: request.contextKey, message };
  }

  private applyAttach(request: IdentityWriteRequest): IdentityWriteOutcome {
    if (request.expectedCut !== this.generation) {
      return this.rejected(
        request,
        "GENERATION_STALE",
        `The source moved to cut ${this.generation}; this write was built under cut ${request.expectedCut}. Nothing is recorded.`,
      );
    }
    const item = this.items.find((entry) => entry.itemId === request.observationId);
    if (!item) {
      return this.rejected(request, "UNKNOWN_REF", `Observation ${request.observationId} is not at the source.`);
    }
    if (item.stamp.environment !== this.environment || item.stamp.domain !== PINNED_PROTOCOL_DOMAIN || item.stamp.tupleKey !== this.tupleKey) {
      return this.rejected(
        request,
        "EVIDENCE_FOREIGN",
        `Item ${item.itemId} was minted under a different mode, domain, or tuple. A foreign row is never this journey's evidence.`,
      );
    }
    if (item.stamp.cutGeneration !== this.generation) {
      return this.rejected(
        request,
        "EVIDENCE_STALE",
        `Item ${item.itemId} was minted under cut ${item.stamp.cutGeneration}; the source serves cut ${this.generation}. Nothing is recorded.`,
      );
    }
    if (item.kind === "receipt") {
      const own =
        item.stamp.actorRef === request.actorRef &&
        item.stamp.role === request.role &&
        item.stamp.incarnation === request.incarnation;
      return this.rejected(
        request,
        own ? "ALREADY_RECORDED" : "EVIDENCE_FOREIGN",
        own
          ? `Receipt ${item.itemId} is already this session's evidence record.`
          : `Receipt ${item.itemId} was recorded under another context. A receipt from another context is never this journey's evidence.`,
      );
    }
    const evidenceRef = identityRef("evidence", this.evidenceSerial);
    this.evidenceSerial += 1;
    this.counts.attaches += 1;
    this.items.push({
      itemId: evidenceRef,
      kind: "receipt",
      subjectRef: item.subjectRef,
      stamp: {
        environment: this.environment,
        domain: PINNED_PROTOCOL_DOMAIN,
        tupleKey: this.tupleKey,
        cutGeneration: this.generation,
        actorRef: request.actorRef,
        role: request.role,
        incarnation: request.incarnation,
      },
      watermark: JOURNEY_IDENTITY_AS_OF,
      note: `Evidence record for ${item.itemId}. A synthetic record, not a producer receipt.`,
      ...JOURNEY_IDENTITY_NON_CLAIMS,
    });
    const refs: IdentityReceiptRefs = {
      evidenceRef,
      observationId: item.itemId,
      subjectRef: item.subjectRef,
      cutGeneration: this.generation,
    };
    if (this.scenario === "attach-lost") {
      this.late.push({
        intentRef: request.intentRef,
        contextKey: request.contextKey,
        result: this.lateResult,
        code: this.lateResult === "rejected" ? "UNKNOWN_REF" : null,
      });
      return this.lost(request, "The response to the attach never arrived. The source may have recorded it.");
    }
    return {
      kind: "confirmed",
      step: "attach",
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      refs,
      nonClaims:
        this.scenario === "claims-proof"
          ? ({ ...JOURNEY_IDENTITY_NON_CLAIMS, confirmsPayment: true } as unknown as JourneyIdentityNonClaims)
          : { ...JOURNEY_IDENTITY_NON_CLAIMS },
    };
  }
}
