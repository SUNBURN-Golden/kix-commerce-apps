import { JOURNEY_NOT_COMPOSED, type JourneyNotComposed } from "./booking-journey.js";
import { COMMERCE_COMMAND_BINDINGS } from "./commerce-bindings.js";
import {
  DISCOVERY_PROJECTION_AS_OF,
  DISCOVERY_READ_TUPLE_LITERALS,
  checkDiscoveryReadTuple,
  type DiscoveryReadTuple,
} from "./discovery-read.js";
import { type PinnedAction } from "./openapi-contract-pin.js";

/**
 * Synthetic installable-mobile shell source for the mobile install, session
 * return, and disconnect screen.
 *
 * This is the stub-scope stand-in for an installable client and its session
 * authority. The real packaging, session, and admission connections stay
 * pending on the unpromoted c-installable-mobile node. The contract-only
 * catalogue has no install, session, vault, presentation, or device command,
 * so no producer SDK, manifest, or vector is consumed and this module sends
 * nothing over a network.
 *
 * The source is the authority stand-in for this stub only. It owns the
 * install record, the session verdict, each stored item's validity verdict,
 * and the order's state and version. Its own clock label is the expiry
 * authority: a device clock the caller reports is compared against it and
 * flagged "in-step", "skewed", or "unreported". The device clock never
 * decides validity.
 *
 * A stored vault item is a copy. Showing one offline mints no admission
 * right, and presenting one is a synthetic write that the session gate and
 * the item's own authority verdict can refuse. An order's "payment" and
 * "withdrawal" references are synthetic records that move no funds; when the
 * link is down a write answers unknown and applies nothing.
 *
 * The source is deliberately naive. It does not de-duplicate a repeated
 * intent and it carries no idempotency key, so the only thing that keeps a
 * client from a second effect is the client fence in
 * installable-mobile-controller.ts.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const MOBILE_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const MOBILE_NOT_BOUND_REASON =
  "No current producer tuple exists for an installable mobile shell: c-installable-mobile is not promoted and the contract-only catalogue has no install, session, vault, presentation, or device command. The mobile shell stays not-bound on integration-http.";

export const MOBILE_PROJECTION_NAME = "kix.mobile.shell";

/** Fixed instant the synthetic source claims to be built at. The authority clock label. */
export const MOBILE_AS_OF = DISCOVERY_PROJECTION_AS_OF;

/** Watermark the stale scenario serves, and the floor a reader holds against it. */
export const MOBILE_STALE_WATERMARK = "2026-10-10T00:00:00.000Z";
export const MOBILE_STALE_FLOOR = "2026-10-12T00:00:00.000Z";

/** The desk's own actor string. It is a context label, not an authentication result. */
export const MOBILE_DESK_ACTOR = "mobile-owner";

/** A second actor for the re-login context switch. Context label, not an authentication result. */
export const MOBILE_GUEST_ACTOR = "mobile-guest";

/** The synthetic device this shell is installed on. A label, not a device attestation. */
export const MOBILE_DEVICE_ID = "dev-0001";

/** The only environment the source ever declares. */
export const MOBILE_ENVIRONMENT = "installable-sandbox" as const;

/**
 * How far a reported device clock may sit from the source's own authority
 * instant before the read flags it skewed. A bound on trust, not on display.
 */
export const MOBILE_CLOCK_SKEW_BOUND_MS = 120_000;

/** Opaque order amount unit. Nothing here parses, sums, or scales an amount. */
export const MOBILE_UNIT = "mock-unit";

/** Printed when the source sent no amount. */
export const MOBILE_UNDETERMINED = "UNDETERMINED";

/** The synthetic writes. None of them is a desk method and none is a catalogue command. */
export const MOBILE_STEPS = ["install", "update", "reconnect", "present", "confirm", "withdraw"] as const;

export type MobileStep = (typeof MOBILE_STEPS)[number];

export const MOBILE_SCENARIOS = [
  "clean",
  "empty",
  "stale",
  "update-available",
  "session-expired",
  "offline",
  "production-claimed",
  "confirm-lost",
  "withdraw-lost",
  "held-response",
  "read-lost",
  "claims-grant",
  "receipt-claims",
] as const;

export type MobileScenario = (typeof MOBILE_SCENARIOS)[number];

/** The synthetic controls a test or the screen asks for. A real shell offers none of them. */
export const MOBILE_SYNTHETIC_CONTROLS = [
  "drop-connection",
  "restore-connection",
  "offer-update",
  "expire-session",
  "deliver-held",
  "deliver-late",
] as const;

export type MobileSyntheticControl = (typeof MOBILE_SYNTHETIC_CONTROLS)[number];

export const MOBILE_REJECT_CODES = [
  "ALREADY_INSTALLED",
  "NOT_INSTALLED",
  "NO_UPDATE",
  "SESSION_ACTIVE",
  "SESSION_EXPIRED",
  "PASS_NOT_PRESENTABLE",
  "ORDER_NOT_PENDING",
  "VERSION_STALE",
  "UNKNOWN_REF",
  "IDENTITY_MISMATCH",
] as const;

export type MobileRejectCode = (typeof MOBILE_REJECT_CODES)[number];

/** A rejection with one of these codes means the page read before it wrote is behind. */
export const MOBILE_STALE_CLASS_CODES = ["VERSION_STALE"] as const;

export const MOBILE_INVALID_CODES = ["INTENT", "STEP", "IDENTITY", "VERSION", "ENVIRONMENT", "TARGET"] as const;

export type MobileInvalidCode = (typeof MOBILE_INVALID_CODES)[number];

export const MOBILE_REFUSAL_CODES = ["CLAIM", "ENVIRONMENT"] as const;

export type MobileRefusalCode = (typeof MOBILE_REFUSAL_CODES)[number];

/**
 * The non-claims this source always states as literal false, on every
 * snapshot and every confirmed receipt. A snapshot or receipt that claims
 * one of them is refused as a whole or untrusted.
 */
export const MOBILE_NON_CLAIM_FIELDS = [
  "realPayment",
  "fundsMoved",
  "admissionGrant",
  "rightCreated",
  "installVerified",
  "productionEnvironment",
  "mobileIntegrationComplete",
] as const;

export type MobileNonClaimField = (typeof MOBILE_NON_CLAIM_FIELDS)[number];

export type MobileNonClaims = Readonly<Record<MobileNonClaimField, false>>;

const MOBILE_NON_CLAIMS: MobileNonClaims = {
  realPayment: false,
  fundsMoved: false,
  admissionGrant: false,
  rightCreated: false,
  installVerified: false,
  productionEnvironment: false,
  mobileIntegrationComplete: false,
};

/** The support range this stub decides (scope item 1). A decision, not a capability claim. */
export const MOBILE_SUPPORT_ROWS = [
  {
    id: "installable-web",
    verdict: "supported",
    note: "The desk installs as an installable web page inside this page load. This is the packaging the stub covers.",
  },
  {
    id: "in-place-update",
    verdict: "supported",
    note: "A shell update applies inside this page load. Nothing persists past a reload.",
  },
  {
    id: "native-store-shell",
    verdict: "unsupported",
    note: "No store listing or native wrapper is built or claimed.",
  },
  {
    id: "push-notification",
    verdict: "unsupported",
    note: "No push channel is wired.",
  },
  {
    id: "background-sync",
    verdict: "unsupported",
    note: "No background sync runs. Every read is an explicit foreground call.",
  },
  {
    id: "offline-right-minting",
    verdict: "unsupported",
    note: "An offline vault view mints no admission right. A stored item is a copy.",
  },
  {
    id: "real-device-evidence",
    verdict: "undetermined",
    note: "No real handset ran this desk. Real-device install stays unverified.",
  },
] as const;

export type MobileSupportRow = (typeof MOBILE_SUPPORT_ROWS)[number];

/** The link the source sees. Synthetic; a port toggles it on request. */
export type MobileLink = "online" | "offline";

export interface MobileClockView {
  /** The source's own instant. It is the only expiry authority this stub consults. */
  authorityNow: string;
  /** What the caller reported as its device instant, or null when unreported. */
  deviceNow: string | null;
  verdict: "in-step" | "skewed" | "unreported";
  skewMs: number | null;
  note: string;
}

export interface MobileInstallView {
  state: "none" | "installed";
  installRef: string | null;
  shellRef: string | null;
  version: number;
  packaging: "installable-web";
  /** A source-offered update, or null. */
  update: { updateRef: string; toShell: string; note: string } | null;
}

export interface MobileSessionView {
  sessionRef: string | null;
  state: "none" | "active" | "expired";
  actorRef: string | null;
  verdict: "active" | "expired" | "none";
  note: string;
}

export interface MobileVaultItem {
  vaultRef: string;
  kind: "pass" | "receipt";
  label: string;
  /** The session actor this copy belongs to. A context label. */
  ownerRef: string;
  /** The watermark at which the copy was stored. */
  cachedAt: string;
  /** The source's validity verdict for this item, stated at verdictAt. */
  authorityVerdict: "valid" | "expired" | "revoked" | "none";
  verdictAt: string;
}

export interface MobileOrderView {
  orderRef: string;
  state: "pending" | "confirmed" | "withdrawn";
  version: number;
  amount: string | null;
  currency: string;
  /** A synthetic confirmation record. It is not funds and not a payment. */
  paymentRef: string | null;
  /** A synthetic withdrawal record. It executes nothing and returns no funds. */
  withdrawalRef: string | null;
  note: string;
}

export interface MobileSnapshot {
  snapshotId: number;
  generation: number;
  watermark: string;
  scenario: MobileScenario;
  /** The link state the source recorded at read time. */
  link: MobileLink;
  environment: { shellEnvironment: string; deviceId: string };
  clock: MobileClockView;
  install: MobileInstallView;
  session: MobileSessionView;
  vault: readonly MobileVaultItem[];
  order: MobileOrderView | null;
  support: readonly MobileSupportRow[];
  nonClaims: MobileNonClaims;
}

export interface MobileReadRequest {
  contextKey: string;
  actorRef: string;
  deviceId: string;
  watermarkFloor: string | null;
  /** The caller's device instant. Null when the caller reports none. */
  deviceNow: string | null;
}

export type MobileReadOutcome =
  | { kind: "ready"; snapshot: MobileSnapshot }
  | { kind: "empty"; watermark: string; generation: number; snapshotId: number }
  | { kind: "stale"; watermark: string; floor: string }
  | { kind: "offline"; detail: string }
  | { kind: "refused"; code: MobileRefusalCode; detail: string; claims?: readonly MobileNonClaimField[] }
  | { kind: "tuple-changed"; field: string; expected: string; actual: string }
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; detail: string };

export interface MobileWriteRefs {
  installRef: string | null;
  shellRef: string | null;
  updateRef: string | null;
  sessionRef: string | null;
  vaultRef: string | null;
  presentationRef: string | null;
  orderRef: string | null;
  orderVersion: number | null;
  paymentRef: string | null;
  withdrawalRef: string | null;
}

export type MobileWriteRequest =
  | {
      step: "install";
      intentRef: string;
      contextKey: string;
      declaredEnvironment: string;
      actorRef: string;
      deviceId: string;
      packaging: "installable-web";
    }
  | {
      step: "update";
      intentRef: string;
      contextKey: string;
      declaredEnvironment: string;
      actorRef: string;
      deviceId: string;
      updateRef: string;
      expectedVersion: number;
    }
  | {
      step: "reconnect";
      intentRef: string;
      contextKey: string;
      declaredEnvironment: string;
      actorRef: string;
      deviceId: string;
    }
  | {
      step: "present";
      intentRef: string;
      contextKey: string;
      declaredEnvironment: string;
      actorRef: string;
      deviceId: string;
      vaultRef: string;
    }
  | {
      step: "confirm" | "withdraw";
      intentRef: string;
      contextKey: string;
      declaredEnvironment: string;
      actorRef: string;
      deviceId: string;
      orderRef: string;
      expectedVersion: number;
    };

export type MobileWriteOutcome =
  | {
      kind: "confirmed";
      step: MobileStep;
      intentRef: string;
      contextKey: string;
      refs: MobileWriteRefs;
      nonClaims: MobileNonClaims;
    }
  | { kind: "rejected"; step: MobileStep; intentRef: string; contextKey: string; code: MobileRejectCode; detail: string }
  | { kind: "unknown"; step: MobileStep; intentRef: string; contextKey: string; message: string }
  | {
      kind: "invalid-request";
      step: string;
      intentRef: string;
      contextKey: string;
      code: MobileInvalidCode;
      detail: string;
    }
  | {
      kind: "tuple-changed";
      field: string;
      expected: string;
      actual: string;
      step: string;
      intentRef: string;
      contextKey: string;
    }
  | { kind: "not-bound"; step: string; intentRef: string; contextKey: string; reason: string };

/** A late write result the source can hand over after the fact. Evidence only. */
export interface MobileLateDelivery {
  intentRef: string;
  contextKey: string;
  step: MobileStep;
  result: "confirmed" | "rejected";
  code: string | null;
}

export interface MobileShellEffects {
  reads: number;
  submits: number;
  unreached: number;
  installs: number;
  updates: number;
  reconnects: number;
  presents: number;
  confirms: number;
  withdraws: number;
  rejects: number;
  linkDrops: number;
}

/**
 * The port the mobile shell screen talks to. `environment` says which
 * environment the port serves, `source` says whether a source stands behind
 * it at all. `link` is the synthetic connectivity the source sees.
 */
export interface MobileShellPort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic" | "none";
  readonly scenario: MobileScenario;
  link(): MobileLink;
  read(request: MobileReadRequest): Promise<MobileReadOutcome>;
  submit(request: MobileWriteRequest): Promise<MobileWriteOutcome>;
  /** Synthetic control: drops the link. Reads and writes answer offline/unknown until restored. */
  dropConnection(): void;
  /** Synthetic control: restores the link. Nothing that was lost is replayed. */
  restoreConnection(): void;
  /** Synthetic control: the source offers a shell update. */
  offerUpdate(): void;
  /** Synthetic control: the source expires the session verdict. */
  expireSession(): void;
  /** Synthetic control: releases held responses. A real shell offers no such call. */
  deliverHeld(): number;
  /** Synthetic control: takes the late results that are due. A real shell offers no such call. */
  deliverLate(): readonly MobileLateDelivery[];
}

// ---------------------------------------------------------------------------
// Identity register
// ---------------------------------------------------------------------------

export interface MobileIdentityBodyField {
  action: PinnedAction;
  field: string;
}

export interface MobileIdentityRow {
  id: string;
  /** The shell-side field name the screen shows. */
  shellField: string;
  status: "field-named" | "not-bound";
  /** The pinned-catalogue bodies that name a field of this identity. Empty when none does. */
  bodyFields: readonly MobileIdentityBodyField[];
  reason: string;
}

/**
 * What the pinned catalogue actually names for each shell identity. The stub
 * copies nothing into a command body: this register records, per identity,
 * which pinned fields exist and that no producer tuple binds them.
 */
export const MOBILE_IDENTITY_REGISTER: readonly MobileIdentityRow[] = [
  {
    id: "install",
    shellField: "installRef",
    status: "not-bound",
    bodyFields: [],
    reason: "The catalogue has no install command. The install reference is a synthetic source row.",
  },
  {
    id: "shell",
    shellField: "shellRef",
    status: "not-bound",
    bodyFields: [],
    reason: "The catalogue has no shell or packaging command. The shell reference is a synthetic source row.",
  },
  {
    id: "update",
    shellField: "updateRef",
    status: "not-bound",
    bodyFields: [],
    reason: "The catalogue has no update command. The update reference is a synthetic source row.",
  },
  {
    id: "session",
    shellField: "sessionRef",
    status: "not-bound",
    bodyFields: [],
    reason:
      "The pin names sessionId only on create_event — an event session, not a device session. The catalogue has no device-session command. Re-login is a synthetic source write.",
  },
  {
    id: "vault",
    shellField: "vaultRef",
    status: "field-named",
    bodyFields: [
      { action: "create_listing", field: "ticketId" },
      { action: "prepare_trade", field: "ticketId" },
      { action: "offer_gift", field: "ticketId" },
      { action: "refund_ticket", field: "ticketId" },
    ],
    reason:
      "A stored pass copy keys on the ticketId fields the pin names on create_listing, prepare_trade, offer_gift, and refund_ticket. Naming a field is not binding it; the vault reference is a synthetic copy, not a right.",
  },
  {
    id: "presentation",
    shellField: "presentationRef",
    status: "not-bound",
    bodyFields: [],
    reason: "The catalogue has no presentation or admission-scan command. `admit` stays uncomposed.",
  },
  {
    id: "order",
    shellField: "orderRef",
    status: "not-bound",
    bodyFields: [],
    reason: "orderId exists only on the money-posting bodies this journey never composes.",
  },
  {
    id: "payment",
    shellField: "paymentRef",
    status: "not-bound",
    bodyFields: [],
    reason: "paymentId exists only on the money-posting bodies this journey never composes. The record moves no funds.",
  },
  {
    id: "withdrawal",
    shellField: "withdrawalRef",
    status: "not-bound",
    bodyFields: [],
    reason: "The catalogue has no withdrawal command. The record executes nothing and returns no funds.",
  },
  {
    id: "version",
    shellField: "expectedVersion",
    status: "field-named",
    bodyFields: [
      { action: "create_listing", field: "expectedVersion" },
      { action: "prepare_trade", field: "expectedVersion" },
      { action: "refund_ticket", field: "expectedVersion" },
      { action: "offer_gift", field: "expectedVersion" },
    ],
    reason:
      "The pin names expectedVersion on create_listing, prepare_trade, refund_ticket, and offer_gift. The shell copies it from the last read and never raises it.",
  },
];

/** Read-only record of the H1 boundary. `placeHold` stays not-bound with consideredAction `reserve_listing`. */
export const MOBILE_HOLD_NOT_BOUND = {
  method: "placeHold",
  consideredAction: "reserve_listing",
  status: "not-bound",
  reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
  mappedOntoPrepareTrade: false,
} as const;

export interface MobileNotComposed {
  action: JourneyNotComposed["action"] | "refund_ticket";
  reason: string;
}

/**
 * The actions this shell never composes. commit_trade, open_admission, admit,
 * capture, and settle_capture stay outside the journey and this screen sends
 * none of them. refund_ticket stays uncomposed: the vault's stored copies and
 * the order's withdrawal record post nothing to it.
 */
export const MOBILE_NOT_COMPOSED: readonly MobileNotComposed[] = [
  ...JOURNEY_NOT_COMPOSED,
  {
    action: "refund_ticket",
    reason: `${MOBILE_RULING}. refund_ticket is pinned (domain, expectedVersion, ticketId) and never composed here. A withdrawal record executes nothing and returns no funds.`,
  },
];

export function mobileNotComposedFor(action: string): MobileNotComposed | undefined {
  return MOBILE_NOT_COMPOSED.find((row) => row.action === action);
}

// ---------------------------------------------------------------------------
// Refs, refusal, and receipt checks
// ---------------------------------------------------------------------------

export const MOBILE_REF_KINDS = [
  "install",
  "shell",
  "update",
  "session",
  "vault",
  "order",
  "payment",
  "withdrawal",
  "presentation",
] as const;

export type MobileRefKind = (typeof MOBILE_REF_KINDS)[number];

const REF_PREFIX: Readonly<Record<MobileRefKind, string>> = {
  install: "ins",
  shell: "shl",
  update: "upd",
  session: "ses",
  vault: "vlt",
  order: "ord",
  payment: "pmt",
  withdrawal: "wdr",
  presentation: "pre",
};

const MOBILE_REF_PATTERN = /^(ins|shl|upd|ses|vlt|ord|pmt|wdr|pre)-[0-9]{4}$/;

export function isMobileRef(ref: unknown, kind?: MobileRefKind): ref is string {
  if (typeof ref !== "string" || !MOBILE_REF_PATTERN.test(ref)) {
    return false;
  }
  return kind === undefined || ref.startsWith(`${REF_PREFIX[kind]}-`);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Serialises a synthetic reference for a kind. Never a producer reference. */
export function mobileRef(kind: MobileRefKind, serial: number): string {
  return `${REF_PREFIX[kind]}-${String(serial).padStart(4, "0")}`;
}

/** Reads the kind off a synthetic reference, or null when the shape is not one. */
export function mobileRefKind(ref: unknown): MobileRefKind | null {
  if (typeof ref !== "string" || !MOBILE_REF_PATTERN.test(ref)) {
    return null;
  }
  const prefix = ref.slice(0, ref.indexOf("-"));
  return MOBILE_REF_KINDS.find((kind) => REF_PREFIX[kind] === prefix) ?? null;
}

/**
 * Validates a snapshot before any row reaches the page. Every non-claim must
 * be literal false, every reference must carry its own serialised prefix, and
 * every label must be non-empty. A violation refuses the snapshot as a whole.
 */
export function refuseMobileSnapshot(snapshot: MobileSnapshot): Extract<MobileReadOutcome, { kind: "refused" }> | null {
  const claimed = MOBILE_NON_CLAIM_FIELDS.filter((field) => snapshot.nonClaims[field] !== false);
  if (claimed.length > 0) {
    return {
      kind: "refused",
      code: "CLAIM",
      detail: `The read claims ${claimed.join(", ")}. A synthetic shell snapshot cannot claim those. Nothing was applied.`,
      claims: claimed,
    };
  }
  const refs: (string | null)[] = [
    snapshot.install.installRef,
    snapshot.install.shellRef,
    snapshot.install.update?.updateRef ?? null,
    snapshot.session.sessionRef,
    snapshot.order?.orderRef ?? null,
    snapshot.order?.paymentRef ?? null,
    snapshot.order?.withdrawalRef ?? null,
    ...snapshot.vault.map((item) => item.vaultRef),
  ];
  if (refs.some((ref) => ref !== null && !isMobileRef(ref))) {
    return { kind: "refused", code: "CLAIM", detail: "A reference in the read does not carry the synthetic ref shape." };
  }
  if (snapshot.vault.some((item) => !nonEmpty(item.label) || !nonEmpty(item.ownerRef))) {
    return { kind: "refused", code: "CLAIM", detail: "A vault row is missing its label or owner." };
  }
  return null;
}

/**
 * The confirmed answer to a write is trusted only if it states every
 * non-claim as literal false. Anything else makes the write's result unknown.
 */
export function refuseMobileReceipt(
  nonClaims: MobileNonClaims,
): { kind: "UNTRUSTED_RECEIPT"; field: MobileNonClaimField } | null {
  const field = MOBILE_NON_CLAIM_FIELDS.find((key) => nonClaims[key] !== false);
  return field === undefined ? null : { kind: "UNTRUSTED_RECEIPT", field };
}

// ---------------------------------------------------------------------------
// The synthetic source
// ---------------------------------------------------------------------------

interface InstallRecord {
  installRef: string;
  shellRef: string;
  version: number;
  deviceId: string;
}

interface SessionRecord {
  sessionRef: string;
  actorRef: string;
  verdict: "active" | "expired";
}

interface VaultRecord {
  vaultRef: string;
  kind: "pass" | "receipt";
  label: string;
  ownerRef: string;
  cachedAt: string;
  verdict: "valid" | "expired" | "revoked" | "none";
  verdictAt: string;
}

interface OrderRecord {
  orderRef: string;
  state: "pending" | "confirmed" | "withdrawn";
  version: number;
  amount: string | null;
  currency: string;
  paymentRef: string | null;
  withdrawalRef: string | null;
}

/**
 * The deterministic in-process source. It is the authority stand-in for this
 * stub: it owns the install record, the session verdict, each item's verdict
 * and the order's version, and its clock label is the only expiry authority
 * the stub consults. It is honest about being synthetic: every snapshot and
 * every receipt states the non-claims as false, and the offline link answers
 * writes unknown without applying them.
 */
export class StubMobileShell implements MobileShellPort {
  readonly environment = "stub" as const;
  readonly source = "synthetic" as const;
  readonly scenario: MobileScenario;

  private readonly expectedTuple: DiscoveryReadTuple;
  private readonly declaredEnvironment: string;
  private linkState: MobileLink;
  private install: InstallRecord | null = null;
  private updatePending: { updateRef: string; toShell: string; note: string } | null = null;
  private session: SessionRecord | null = null;
  private readonly vault: VaultRecord[] = [];
  private order: OrderRecord | null = null;
  private generation = 0;
  private snapshotSerial = 0;
  private sessionSerial = 0;
  private installSerial = 0;
  private shellSerial = 0;
  private updateSerial = 0;
  private presentationSerial = 0;
  private paymentSerial = 0;
  private withdrawalSerial = 0;
  private readonly counts: MobileShellEffects = {
    reads: 0,
    submits: 0,
    unreached: 0,
    installs: 0,
    updates: 0,
    reconnects: 0,
    presents: 0,
    confirms: 0,
    withdraws: 0,
    rejects: 0,
    linkDrops: 0,
  };
  private readonly held: { release: () => void }[] = [];
  private late: MobileLateDelivery[] = [];

  constructor(
    options: {
      scenario?: MobileScenario;
      tuple?: DiscoveryReadTuple;
      environment?: string;
    } = {},
  ) {
    this.scenario = options.scenario ?? "clean";
    this.expectedTuple = options.tuple ?? { ...DISCOVERY_READ_TUPLE_LITERALS };
    this.declaredEnvironment =
      options.environment ?? (this.scenario === "production-claimed" ? "production" : MOBILE_ENVIRONMENT);
    this.linkState = this.scenario === "offline" ? "offline" : "online";
    if (this.scenario !== "empty") {
      this.seed();
    }
  }

  private seed(): void {
    this.installSerial = 1;
    this.shellSerial = 1;
    this.sessionSerial = 1;
    this.install = {
      installRef: mobileRef("install", 1),
      shellRef: mobileRef("shell", 1),
      version: 1,
      deviceId: MOBILE_DEVICE_ID,
    };
    this.session = {
      sessionRef: mobileRef("session", 1),
      actorRef: MOBILE_DESK_ACTOR,
      verdict: this.scenario === "session-expired" ? "expired" : "active",
    };
    this.vault.push(
      {
        vaultRef: mobileRef("vault", 1),
        kind: "pass",
        label: "Evening pass (synthetic)",
        ownerRef: MOBILE_DESK_ACTOR,
        cachedAt: "2026-10-13T09:00:00.000Z",
        verdict: "valid",
        verdictAt: MOBILE_AS_OF,
      },
      {
        vaultRef: mobileRef("vault", 2),
        kind: "receipt",
        label: "Order receipt copy (synthetic)",
        ownerRef: MOBILE_DESK_ACTOR,
        cachedAt: "2026-10-13T09:00:00.000Z",
        verdict: "none",
        verdictAt: MOBILE_AS_OF,
      },
      {
        vaultRef: mobileRef("vault", 3),
        kind: "pass",
        label: "Matinee pass (synthetic)",
        ownerRef: MOBILE_DESK_ACTOR,
        cachedAt: "2026-10-12T09:00:00.000Z",
        verdict: "expired",
        verdictAt: "2026-10-12T18:00:00.000Z",
      },
    );
    this.order = {
      orderRef: mobileRef("order", 1),
      state: "pending",
      version: 1,
      amount: "14.00",
      currency: MOBILE_UNIT,
      paymentRef: null,
      withdrawalRef: null,
    };
    if (this.scenario === "update-available") {
      this.updatePending = {
        updateRef: mobileRef("update", 1),
        toShell: mobileRef("shell", 2),
        note: "A shell update the source offers. Applying it is a synthetic write.",
      };
      this.updateSerial = 1;
    }
    this.generation = 1;
  }

  link(): MobileLink {
    return this.linkState;
  }

  effects(): MobileShellEffects {
    return { ...this.counts };
  }

  dropConnection(): void {
    if (this.linkState === "offline") {
      return;
    }
    this.linkState = "offline";
    this.counts.linkDrops += 1;
  }

  restoreConnection(): void {
    this.linkState = "online";
  }

  offerUpdate(): void {
    if (this.install === null || this.updatePending !== null) {
      return;
    }
    this.updateSerial += 1;
    this.updatePending = {
      updateRef: mobileRef("update", this.updateSerial),
      toShell: mobileRef("shell", this.shellSerial + 1),
      note: "A shell update the source offers. Applying it is a synthetic write.",
    };
    this.generation += 1;
  }

  expireSession(): void {
    if (this.session === null || this.session.verdict !== "active") {
      return;
    }
    this.session.verdict = "expired";
    this.generation += 1;
  }

  deliverHeld(): number {
    const releasing = this.held.splice(0, this.held.length);
    for (const entry of releasing) {
      entry.release();
    }
    return releasing.length;
  }

  deliverLate(): readonly MobileLateDelivery[] {
    const due = this.late;
    this.late = [];
    return due;
  }

  read(request: MobileReadRequest): Promise<MobileReadOutcome> {
    const outcome = this.readNow(request);
    if (this.scenario === "held-response") {
      return new Promise<MobileReadOutcome>((resolve) => {
        this.held.push({ release: () => resolve(outcome) });
      });
    }
    if (this.scenario === "read-lost") {
      // The answer is lost after the read: the promise never resolves. The
      // controller keeps the read in flight until the context changes.
      return new Promise<MobileReadOutcome>(() => {});
    }
    return Promise.resolve(outcome);
  }

  submit(request: MobileWriteRequest): Promise<MobileWriteOutcome> {
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
    this.counts.submits += 1;
    if (this.linkState === "offline") {
      this.counts.unreached += 1;
      const outcome: MobileWriteOutcome = {
        kind: "unknown",
        step: request.step,
        intentRef: request.intentRef,
        contextKey: request.contextKey,
        message: "The link was down when the write arrived. Whether it reached the source is unknown. It applied nothing here.",
      };
      if (this.scenario === "held-response") {
        return new Promise<MobileWriteOutcome>((resolve) => {
          this.held.push({ release: () => resolve(outcome) });
        });
      }
      return Promise.resolve(outcome);
    }
    const outcome = this.apply(request);
    if (this.scenario === "held-response") {
      return new Promise<MobileWriteOutcome>((resolve) => {
        this.held.push({ release: () => resolve(outcome) });
      });
    }
    return Promise.resolve(outcome);
  }

  private clockOf(deviceNow: string | null): MobileClockView {
    const authorityNow = MOBILE_AS_OF;
    if (deviceNow === null) {
      return {
        authorityNow,
        deviceNow: null,
        verdict: "unreported",
        skewMs: null,
        note: "No device clock was reported. Validity stays with the authority instant; nothing is decided by a missing clock.",
      };
    }
    const skewMs = Math.abs(Date.parse(deviceNow) - Date.parse(authorityNow));
    if (!Number.isFinite(skewMs)) {
      return {
        authorityNow,
        deviceNow,
        verdict: "unreported",
        skewMs: null,
        note: "The reported device clock could not be read. Validity stays with the authority instant.",
      };
    }
    const verdict = skewMs > MOBILE_CLOCK_SKEW_BOUND_MS ? "skewed" : "in-step";
    return {
      authorityNow,
      deviceNow,
      verdict,
      skewMs,
      note:
        verdict === "in-step"
          ? "The device clock is in step with the authority instant. The authority still decides validity."
          : "The device clock is out of step with the authority instant. The device clock never decides validity; the authority verdict stands.",
    };
  }

  private readNow(request: MobileReadRequest): MobileReadOutcome {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return { kind: "tuple-changed", field: tuple.field, expected: tuple.expected, actual: tuple.actual };
    }
    if (this.declaredEnvironment !== MOBILE_ENVIRONMENT) {
      return {
        kind: "refused",
        code: "ENVIRONMENT",
        detail: "The source declares a production environment. This shell serves installable-sandbox only, so nothing was read and nothing was applied.",
      };
    }
    if (this.linkState === "offline") {
      return {
        kind: "offline",
        detail:
          "The link is down. Nothing was read. Any stored items the page still holds are cached copies, not current authority.",
      };
    }
    this.counts.reads += 1;
    this.snapshotSerial += 1;
    const watermark = this.scenario === "stale" ? MOBILE_STALE_WATERMARK : MOBILE_AS_OF;
    const floor = request.watermarkFloor ?? (this.scenario === "stale" ? MOBILE_STALE_FLOOR : null);
    if (floor !== null && Date.parse(watermark) < Date.parse(floor)) {
      return { kind: "stale", watermark, floor };
    }
    if (this.scenario === "empty" && this.install === null) {
      return { kind: "empty", watermark, generation: this.generation, snapshotId: this.snapshotSerial };
    }
    const snapshot: MobileSnapshot = {
      snapshotId: this.snapshotSerial,
      generation: this.generation,
      watermark,
      scenario: this.scenario,
      link: this.linkState,
      environment: { shellEnvironment: this.declaredEnvironment, deviceId: request.deviceId },
      clock: this.clockOf(request.deviceNow),
      install:
        this.install === null
          ? { state: "none", installRef: null, shellRef: null, version: 0, packaging: "installable-web", update: null }
          : {
              state: "installed",
              installRef: this.install.installRef,
              shellRef: this.install.shellRef,
              version: this.install.version,
              packaging: "installable-web",
              update: this.updatePending === null ? null : { ...this.updatePending },
            },
      session:
        this.session === null
          ? { sessionRef: null, state: "none", actorRef: null, verdict: "none", note: "No session is recorded." }
          : {
              sessionRef: this.session.sessionRef,
              state: this.session.verdict,
              actorRef: this.session.actorRef,
              verdict: this.session.verdict,
              note:
                this.session.verdict === "active"
                  ? `Session ${this.session.sessionRef} is active for ${this.session.actorRef}. A context label, not an authentication result.`
                  : `Session ${this.session.sessionRef} expired at the source. Reconnect to open a new one; the expired verdict stays authority, not the device clock.`,
            },
      vault: this.vault.map((item) => ({
        vaultRef: item.vaultRef,
        kind: item.kind,
        label: item.label,
        ownerRef: item.ownerRef,
        cachedAt: item.cachedAt,
        authorityVerdict: item.verdict,
        verdictAt: item.verdictAt,
      })),
      order:
        this.order === null
          ? null
          : {
              orderRef: this.order.orderRef,
              state: this.order.state,
              version: this.order.version,
              amount: this.order.amount,
              currency: this.order.currency,
              paymentRef: this.order.paymentRef,
              withdrawalRef: this.order.withdrawalRef,
              note:
                this.order.state === "pending"
                  ? "The order waits. Confirming or withdrawing it is one write each; neither is replayed by a read or a resume."
                  : this.order.state === "confirmed"
                    ? "A confirmation record is linked. It is a synthetic row, not a payment and not funds."
                    : "A withdrawal record is linked. It executes nothing and returns no funds.",
            },
      support: MOBILE_SUPPORT_ROWS,
      nonClaims:
        this.scenario === "claims-grant"
          ? ({ ...MOBILE_NON_CLAIMS, admissionGrant: true } as unknown as MobileNonClaims)
          : { ...MOBILE_NON_CLAIMS },
    };
    const refused = refuseMobileSnapshot(snapshot);
    if (refused !== null) {
      return refused;
    }
    return { kind: "ready", snapshot };
  }

  private invalid(
    request: { step: unknown; intentRef: unknown; contextKey: unknown },
    code: MobileInvalidCode,
    detail: string,
  ): MobileWriteOutcome {
    return {
      kind: "invalid-request",
      step: String(request.step),
      intentRef: String(request.intentRef),
      contextKey: String(request.contextKey),
      code,
      detail,
    };
  }

  private validate(request: MobileWriteRequest): MobileWriteOutcome | null {
    if (!nonEmpty(request.intentRef) || !nonEmpty(request.contextKey)) {
      return this.invalid(request, "INTENT", "A write carries an intent reference and a context key.");
    }
    if (!(MOBILE_STEPS as readonly string[]).includes(request.step)) {
      return this.invalid(request, "STEP", `Step ${String(request.step)} is not a mobile shell step.`);
    }
    if (request.declaredEnvironment !== MOBILE_ENVIRONMENT || this.declaredEnvironment !== MOBILE_ENVIRONMENT) {
      return this.invalid(
        request,
        "ENVIRONMENT",
        "The source serves installable-sandbox only. A write that declares another environment, or a write against a claimed production environment, is refused.",
      );
    }
    if (request.step === "update" || request.step === "confirm" || request.step === "withdraw") {
      if (!Number.isInteger(request.expectedVersion)) {
        return this.invalid(request, "VERSION", "The expected version is a whole number.");
      }
    }
    if (request.step === "update" && !isMobileRef(request.updateRef, "update")) {
      return this.invalid(request, "IDENTITY", "An update names an update reference.");
    }
    if (request.step === "present" && !isMobileRef(request.vaultRef, "vault")) {
      return this.invalid(request, "IDENTITY", "A presentation names a vault reference.");
    }
    if ((request.step === "confirm" || request.step === "withdraw") && !isMobileRef(request.orderRef, "order")) {
      return this.invalid(request, "IDENTITY", `A ${request.step} names an order reference.`);
    }
    return null;
  }

  private rejected(request: MobileWriteRequest, code: MobileRejectCode, detail: string): MobileWriteOutcome {
    this.counts.rejects += 1;
    return {
      kind: "rejected",
      step: request.step,
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      code,
      detail,
    };
  }

  private lost(request: MobileWriteRequest, message: string): MobileWriteOutcome {
    this.late.push({ intentRef: request.intentRef, contextKey: request.contextKey, step: request.step, result: "confirmed", code: null });
    return {
      kind: "unknown",
      step: request.step,
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      message,
    };
  }

  private apply(request: MobileWriteRequest): MobileWriteOutcome {
    switch (request.step) {
      case "install":
        return this.applyInstall(request);
      case "update":
        return this.applyUpdate(request);
      case "reconnect":
        return this.applyReconnect(request);
      case "present":
        return this.applyPresent(request);
      case "confirm":
      case "withdraw":
        return this.applySettle(request);
      default: {
        const exhaustive: never = request;
        return exhaustive;
      }
    }
  }

  private deviceGate(request: MobileWriteRequest): MobileWriteOutcome | null {
    if (this.install === null) {
      return this.rejected(request, "NOT_INSTALLED", "No shell is installed on this device. Install first.");
    }
    if (this.install.deviceId !== request.deviceId) {
      return this.rejected(
        request,
        "IDENTITY_MISMATCH",
        `The install on this device is bound to ${this.install.deviceId}, not ${request.deviceId}. A different device cannot reuse it.`,
      );
    }
    return null;
  }

  private sessionGate(request: MobileWriteRequest): MobileWriteOutcome | null {
    const device = this.deviceGate(request);
    if (device !== null) {
      return device;
    }
    if (this.session === null || this.session.verdict !== "active") {
      return this.rejected(request, "SESSION_EXPIRED", "No active session is recorded at the source. Reconnect first.");
    }
    if (this.session.actorRef !== request.actorRef) {
      return this.rejected(
        request,
        "IDENTITY_MISMATCH",
        `The active session belongs to ${this.session.actorRef}, not ${request.actorRef}. Re-login does not reuse another actor's session.`,
      );
    }
    return null;
  }

  private emptyRefs(): MobileWriteRefs {
    return {
      installRef: this.install?.installRef ?? null,
      shellRef: this.install?.shellRef ?? null,
      updateRef: this.updatePending?.updateRef ?? null,
      sessionRef: this.session?.sessionRef ?? null,
      vaultRef: null,
      presentationRef: null,
      orderRef: this.order?.orderRef ?? null,
      orderVersion: this.order?.version ?? null,
      paymentRef: this.order?.paymentRef ?? null,
      withdrawalRef: this.order?.withdrawalRef ?? null,
    };
  }

  private nonClaims(): MobileNonClaims {
    return this.scenario === "receipt-claims"
      ? ({ ...MOBILE_NON_CLAIMS, admissionGrant: true } as unknown as MobileNonClaims)
      : { ...MOBILE_NON_CLAIMS };
  }

  private confirmed(request: MobileWriteRequest, refs: Partial<MobileWriteRefs>): MobileWriteOutcome {
    return {
      kind: "confirmed",
      step: request.step,
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      refs: { ...this.emptyRefs(), ...refs },
      nonClaims: this.nonClaims(),
    };
  }

  private applyInstall(request: Extract<MobileWriteRequest, { step: "install" }>): MobileWriteOutcome {
    if (this.install !== null) {
      return this.rejected(
        request,
        "ALREADY_INSTALLED",
        `Install ${this.install.installRef} is already on this device. Installing again is not an update.`,
      );
    }
    this.installSerial += 1;
    this.shellSerial += 1;
    this.sessionSerial += 1;
    this.install = {
      installRef: mobileRef("install", this.installSerial),
      shellRef: mobileRef("shell", this.shellSerial),
      version: 1,
      deviceId: request.deviceId,
    };
    this.session = { sessionRef: mobileRef("session", this.sessionSerial), actorRef: request.actorRef, verdict: "active" };
    this.counts.installs += 1;
    this.generation += 1;
    return this.confirmed(request, {});
  }

  private applyUpdate(request: Extract<MobileWriteRequest, { step: "update" }>): MobileWriteOutcome {
    const device = this.deviceGate(request);
    if (device !== null) {
      return device;
    }
    if (this.updatePending === null) {
      return this.rejected(request, "NO_UPDATE", "The source offers no shell update. There is nothing to apply.");
    }
    if (this.updatePending.updateRef !== request.updateRef) {
      return this.rejected(request, "UNKNOWN_REF", `Update ${request.updateRef} is not the update the source offers.`);
    }
    if (this.install !== null && this.install.version !== request.expectedVersion) {
      return this.rejected(
        request,
        "VERSION_STALE",
        `The install is no longer at version ${request.expectedVersion}. Read again before applying the update.`,
      );
    }
    this.shellSerial += 1;
    if (this.install !== null) {
      this.install.shellRef = this.updatePending.toShell;
      this.install.version += 1;
    }
    this.updatePending = null;
    this.counts.updates += 1;
    this.generation += 1;
    return this.confirmed(request, { updateRef: null });
  }

  private applyReconnect(request: Extract<MobileWriteRequest, { step: "reconnect" }>): MobileWriteOutcome {
    const device = this.deviceGate(request);
    if (device !== null) {
      return device;
    }
    if (this.session !== null && this.session.verdict === "active" && this.session.actorRef === request.actorRef) {
      return this.rejected(
        request,
        "SESSION_ACTIVE",
        `Session ${this.session.sessionRef} is already active for ${request.actorRef}. Reconnecting mints no second session.`,
      );
    }
    this.sessionSerial += 1;
    this.session = { sessionRef: mobileRef("session", this.sessionSerial), actorRef: request.actorRef, verdict: "active" };
    this.counts.reconnects += 1;
    this.generation += 1;
    return this.confirmed(request, {});
  }

  private applyPresent(request: Extract<MobileWriteRequest, { step: "present" }>): MobileWriteOutcome {
    const gate = this.sessionGate(request);
    if (gate !== null) {
      return gate;
    }
    const item = this.vault.find((entry) => entry.vaultRef === request.vaultRef);
    if (!item) {
      return this.rejected(request, "UNKNOWN_REF", `Vault item ${request.vaultRef} is not at the source.`);
    }
    if (item.ownerRef !== request.actorRef) {
      return this.rejected(
        request,
        "IDENTITY_MISMATCH",
        `Vault item ${item.vaultRef} belongs to ${item.ownerRef}, not ${request.actorRef}. A stored copy is not transferable.`,
      );
    }
    if (item.kind !== "pass") {
      return this.rejected(
        request,
        "PASS_NOT_PRESENTABLE",
        `Vault item ${item.vaultRef} is a ${item.kind} copy, not a pass. It grants no admission and is never presented.`,
      );
    }
    if (item.verdict !== "valid") {
      return this.rejected(
        request,
        "PASS_NOT_PRESENTABLE",
        `The source verdict on ${item.vaultRef} is ${item.verdict}, stated at ${item.verdictAt}. A stored copy cannot be presented and mints no admission.`,
      );
    }
    this.presentationSerial += 1;
    const presentationRef = mobileRef("presentation", this.presentationSerial);
    this.counts.presents += 1;
    this.generation += 1;
    return this.confirmed(request, { vaultRef: item.vaultRef, presentationRef });
  }

  private applySettle(request: Extract<MobileWriteRequest, { step: "confirm" | "withdraw" }>): MobileWriteOutcome {
    const gate = this.sessionGate(request);
    if (gate !== null) {
      return gate;
    }
    if (this.order === null || this.order.orderRef !== request.orderRef) {
      return this.rejected(request, "UNKNOWN_REF", `Order ${request.orderRef} is not at the source.`);
    }
    if (this.order.state !== "pending") {
      return this.rejected(
        request,
        "ORDER_NOT_PENDING",
        `Order ${this.order.orderRef} is ${this.order.state}. A settled order takes no second write.`,
      );
    }
    if (this.order.version !== request.expectedVersion) {
      return this.rejected(
        request,
        "VERSION_STALE",
        `Order ${this.order.orderRef} is no longer at version ${request.expectedVersion}. Read again.`,
      );
    }
    if (request.step === "confirm") {
      this.paymentSerial += 1;
      this.order.state = "confirmed";
      this.order.paymentRef = mobileRef("payment", this.paymentSerial);
      this.counts.confirms += 1;
    } else {
      this.withdrawalSerial += 1;
      this.order.state = "withdrawn";
      this.order.withdrawalRef = mobileRef("withdrawal", this.withdrawalSerial);
      this.counts.withdraws += 1;
    }
    this.order.version += 1;
    this.generation += 1;
    if (this.scenario === "confirm-lost" && request.step === "confirm") {
      return this.lost(request, "The response to the confirmation never arrived. The source may have recorded it.");
    }
    if (this.scenario === "withdraw-lost" && request.step === "withdraw") {
      return this.lost(request, "The response to the withdrawal never arrived. The source may have recorded it.");
    }
    return this.confirmed(request, {
      orderRef: this.order.orderRef,
      orderVersion: this.order.version,
      paymentRef: this.order.paymentRef,
      withdrawalRef: this.order.withdrawalRef,
    });
  }
}

// ---------------------------------------------------------------------------
// The not-bound port
// ---------------------------------------------------------------------------

class NotBoundMobileShell implements MobileShellPort {
  readonly environment = "integration-http" as const;
  readonly source = "none" as const;
  readonly scenario: MobileScenario;

  constructor(scenario: MobileScenario) {
    this.scenario = scenario;
  }

  link(): MobileLink {
    return "online";
  }

  read(): Promise<MobileReadOutcome> {
    return Promise.resolve({ kind: "not-bound", reason: MOBILE_NOT_BOUND_REASON });
  }

  submit(request: MobileWriteRequest): Promise<MobileWriteOutcome> {
    return Promise.resolve({
      kind: "not-bound",
      step: String(request.step),
      intentRef: String(request.intentRef),
      contextKey: String(request.contextKey),
      reason: MOBILE_NOT_BOUND_REASON,
    });
  }

  dropConnection(): void {}
  restoreConnection(): void {}
  offerUpdate(): void {}
  expireSession(): void {}

  deliverHeld(): number {
    return 0;
  }

  deliverLate(): readonly MobileLateDelivery[] {
    return [];
  }
}

/**
 * The default port is the synthetic source. On integration-http the same port
 * is not-bound: no producer tuple exists for an installable shell, the
 * contract-only catalogue has no install, session, vault, presentation, or
 * device command, and this module does not invent one, send a second attempt,
 * or fall back to the stub.
 */
export type StubMobileShellOptions = {
  scenario?: MobileScenario;
  tuple?: DiscoveryReadTuple;
  environment?: string;
};

export function createStubMobileShell(options: StubMobileShellOptions = {}): StubMobileShell {
  return new StubMobileShell(options);
}

export function createNotBoundMobileShell(scenario: MobileScenario = "clean"): MobileShellPort {
  return new NotBoundMobileShell(scenario);
}

export function mobileShellPortFor(
  environment: "stub" | "integration-http",
  options: {
    scenario?: MobileScenario;
    tuple?: DiscoveryReadTuple;
    environment?: string;
  } = {},
): MobileShellPort {
  if (environment === "integration-http") {
    return new NotBoundMobileShell(options.scenario ?? "clean");
  }
  return new StubMobileShell(options);
}
