import {
  DISCOVERY_PROJECTION_AS_OF,
  DISCOVERY_READ_TUPLE_LITERALS,
  checkDiscoveryReadTuple,
  type DiscoveryReadTuple,
} from "./discovery-read.js";
import { PLATFORM_HOLD_NOT_BOUND, PLATFORM_NOT_COMPOSED } from "./platform-journey.js";
import {
  TENANT_ACTORS,
  TENANT_BUYER_ACTOR,
  TENANT_DUAL_ACTOR,
  TENANT_FOREIGN,
  TENANT_FOREIGN_ACTOR,
  TENANT_KNOWN,
  TENANT_ORGANIZER_ACTOR,
  TENANT_OWN,
  TENANT_ROLES,
  TENANT_SETTLER_ACTOR,
  TENANT_SUPPORT_ACTOR,
  TENANT_UNASSIGNED_ACTOR,
  type TenantRole,
} from "./tenant-permissions.js";

/**
 * Synthetic notification inbox source: the desk actors' tenants and people, the
 * notification grants they hold, a feed of producer-contracted event
 * notifications, dedupe and read state, currentness by watermark and grant
 * generation, sensitive-detail display rules, offered actions that move the
 * person to the current authority query or to support material, and the inquiry
 * material itself.
 *
 * This is the stub-scope stand-in for a producer. The real connection stays
 * pending on kix-protocol:k-operator-contract; pending node c-notification-inbox
 * keeps it. The contract-only catalogue has no notification read, no dedupe or
 * read-state command, no offered-action resolve, and no support-inquiry
 * command. No producer tuple exists, so the inbox is NOT_BOUND on
 * integration-http. No SDK, manifest, or vector is consumed, no external send
 * or provider API is wired, and this module sends nothing over a network.
 *
 * Nothing here composes a catalogue command: no money posting is sent, and the
 * not-composed record below only quotes why. A notification arrival confirms no
 * economic effect — not a payment, not a settled trade, not an issued right.
 *
 * Rules, all enforced here and not only in copy:
 *  - A request names a tenant, an actor, and a role. The actor string and the
 *    role string are context labels, not an authentication result. The source
 *    decides access with its own synthetic grants.
 *  - Only producer-contracted event kinds reach the inbox. The contracted list
 *    below stands in for the producer contract that is not merged. An event
 *    kind it does not name is refused, never projected.
 *  - A notification is addressed to one subject in one tenant. A row of another
 *    tenant or another subject refuses the whole payload before anything is
 *    shown.
 *  - Deliveries deduplicate on the source's own dedupe key. A second delivery
 *    of the same key is dropped once, counted, and never shown twice.
 *  - A notification carries the grant generation it was issued under. A
 *    notification issued under an older generation keeps its row but is marked
 *    stale-issue, and its offered action resolves nothing — an old
 *    notification's action never skips the current-generation check.
 *  - Marking read and resolving an offered action are the two request kinds.
 *    Every request carries the grant generation the last read reported, and a
 *    request built under an older one is rejected as generation-stale.
 *  - A sensitive notification shows its detail only to a role that holds
 *    read-sensitive. For any other role the detail stays withheld at the
 *    source; a payload that delivers it anyway is refused whole.
 *  - The inquiry material is the source's own support file: synthetic, redacted,
 *    no real personal data, not delivered externally, not an authority record.
 *    A payload that says otherwise, or carries a sensitive token, is refused.
 *  - Hiding a control is not enforcement. The port checks every read, inquiry,
 *    and request against the grant and the capability.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const NOTIFY_INBOX_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const NOTIFY_NOT_BOUND_REASON =
  "No current producer tuple exists for the notification inbox: kix-protocol:k-operator-contract is not merged and pending node c-notification-inbox is not promoted. The contract-only catalogue has no notification read, no dedupe or read-state command, no offered-action resolve, and no support-inquiry command. The inbox stays NOT_BOUND on integration-http.";

export const NOTIFY_PROJECTION_NAME = "kix.notification.inbox";

/** What a producer connection would need. All of it is absent, so every connection claim is false. */
export const NOTIFY_PRODUCER_TUPLE = {
  bound: false,
  status: "NOT_BOUND",
  sdkDigest: null,
  manifestDigest: null,
  vectorDigest: null,
  waitingOn: ["kix-protocol:k-operator-contract", "c-notification-inbox"],
} as const;

/** Fixed instant the synthetic source claims to be built at. */
export const NOTIFY_AS_OF = DISCOVERY_PROJECTION_AS_OF;

/** Watermark the stale scenario serves, and the floor a reader holds against it. */
export const NOTIFY_STALE_WATERMARK = "2026-10-10T00:00:00.000Z";
export const NOTIFY_STALE_FLOOR = "2026-10-12T00:00:00.000Z";

/** Quote of the locked hold binding. H1 keeps this consideredAction and keeps it not-bound. */
export const NOTIFY_HOLD_NOT_BOUND = PLATFORM_HOLD_NOT_BOUND;

/** Catalogue commands this module records and does not send. Nothing is composed here at all. */
export const NOTIFY_NOT_COMPOSED = PLATFORM_NOT_COMPOSED;

// ---------------------------------------------------------------------------
// Tenants and people. The inbox shares the desk's tenants and actors: a
// notification is addressed to one person in one tenant, and the notification
// grant is its own record, separate from the desk's role assignment.
// ---------------------------------------------------------------------------

export const NOTIFY_OWN = TENANT_OWN;
export const NOTIFY_FOREIGN = TENANT_FOREIGN;
export const NOTIFY_KNOWN = TENANT_KNOWN;

export const NOTIFY_BUYER_ACTOR = TENANT_BUYER_ACTOR;
export const NOTIFY_ORGANIZER_ACTOR = TENANT_ORGANIZER_ACTOR;
export const NOTIFY_SETTLER_ACTOR = TENANT_SETTLER_ACTOR;
export const NOTIFY_SUPPORT_ACTOR = TENANT_SUPPORT_ACTOR;
export const NOTIFY_DUAL_ACTOR = TENANT_DUAL_ACTOR;
export const NOTIFY_FOREIGN_ACTOR = TENANT_FOREIGN_ACTOR;
export const NOTIFY_UNASSIGNED_ACTOR = TENANT_UNASSIGNED_ACTOR;

export const NOTIFY_ACTORS = TENANT_ACTORS;
export type NotifyActor = (typeof NOTIFY_ACTORS)[number];

/** The inbox roles are the desk's own four. A role decides the capability set. */
export const NOTIFY_ROLES = TENANT_ROLES;
export type NotifyRole = TenantRole;

/**
 * What a role may do on this surface. Reading the inbox, marking read,
 * resolving an offered action, reading the support material, and seeing a
 * sensitive notification's detail stay separate capabilities.
 */
export const NOTIFY_CAPABILITIES = [
  "read-inbox",
  "mark-read",
  "resolve-action",
  "read-sensitive",
  "read-inquiry",
] as const;
export type NotifyCapability = (typeof NOTIFY_CAPABILITIES)[number];

const NOTIFY_ROLE_CAPABILITIES: Readonly<Record<NotifyRole, readonly NotifyCapability[]>> = {
  buyer: ["read-inbox", "mark-read", "resolve-action", "read-inquiry"],
  organizer: ["read-inbox", "mark-read", "resolve-action", "read-sensitive", "read-inquiry"],
  settler: ["read-inbox", "mark-read", "resolve-action", "read-sensitive", "read-inquiry"],
  support: ["read-inbox", "mark-read", "resolve-action", "read-sensitive", "read-inquiry"],
};

/** The capabilities a role holds on the inbox. An unknown role holds none. */
export function notifyCapabilities(role: string): readonly NotifyCapability[] {
  return (NOTIFY_ROLE_CAPABILITIES as Record<string, readonly NotifyCapability[]>)[role] ?? [];
}

/** What a person may do on this surface. The capability rows stay separate. */
export interface NotifyAuthorityRow {
  capability: NotifyCapability;
  heldBy: readonly NotifyRole[];
}

export function notifyAuthorityTable(): readonly NotifyAuthorityRow[] {
  return NOTIFY_CAPABILITIES.map((capability) => ({
    capability,
    heldBy: NOTIFY_ROLES.filter((role) => NOTIFY_ROLE_CAPABILITIES[role].includes(capability)),
  }));
}

// ---------------------------------------------------------------------------
// Contracted event kinds. This list stands in for the producer contract that is
// not merged. An event kind it does not name is refused, never projected.
// ---------------------------------------------------------------------------

export const NOTIFY_EVENT_KINDS = [
  "trade-recorded",
  "hold-expiring",
  "payment-observed",
  "right-moved",
  "grant-changed",
  "support-answered",
  "inquiry-ready",
] as const;
export type NotifyEventKind = (typeof NOTIFY_EVENT_KINDS)[number];

/** The offered actions a notification may carry. Each is a move, not a send. */
export const NOTIFY_OFFER_KINDS = ["open-authority", "open-support"] as const;
export type NotifyOfferKind = (typeof NOTIFY_OFFER_KINDS)[number];

// ---------------------------------------------------------------------------
// Codes and enums.
// ---------------------------------------------------------------------------

export const NOTIFY_DENIED_CODES = [
  "GRANT_DENIED",
  "GRANT_REVOKED",
  "RESOURCE_DENIED",
  "INQUIRY_DENIED",
] as const;
export type NotifyDeniedCode = (typeof NOTIFY_DENIED_CODES)[number];

export const NOTIFY_REFUSAL_CODES = [
  "CLAIM",
  "KIND",
  "STATE",
  "REF",
  "SCOPE_LEAK",
  "SUBJECT_LEAK",
  "SENSITIVE_LEAK",
  "UNCONTRACTED",
] as const;
export type NotifyRefusalCode = (typeof NOTIFY_REFUSAL_CODES)[number];

export const NOTIFY_INVALID_CODES = [
  "CONTEXT",
  "ACTOR",
  "SCOPE",
  "ROLE",
  "FLOOR",
  "GENERATION",
  "ACTION",
  "REF",
] as const;
export type NotifyInvalidCode = (typeof NOTIFY_INVALID_CODES)[number];

export const NOTIFY_REJECTION_CODES = [
  "NO_CAPABILITY",
  "GENERATION_STALE",
  "STALE_ISSUE",
  "UNKNOWN_NOTIFICATION",
  "ALREADY_READ",
  "OFFER_MISSING",
  "UNKNOWN_INQUIRY",
] as const;
export type NotifyRejectionCode = (typeof NOTIFY_REJECTION_CODES)[number];

/** Whether the notification was issued under the grant generation now current. */
export const NOTIFY_ISSUE_STATES = ["current", "stale-issue"] as const;
export type NotifyIssueState = (typeof NOTIFY_ISSUE_STATES)[number];

/** Whether the source sent the row's detail. */
export const NOTIFY_DETAIL_STATES = ["shown", "withheld"] as const;
export type NotifyDetailState = (typeof NOTIFY_DETAIL_STATES)[number];

export const NOTIFY_ACTION_KINDS = ["mark-read", "resolve"] as const;
export type NotifyActionKind = (typeof NOTIFY_ACTION_KINDS)[number];

export const NOTIFY_SYNTHETIC_CONTROLS = ["revoke-grant", "rotate-grant", "deliver-late"] as const;
export type NotifySyntheticControl = (typeof NOTIFY_SYNTHETIC_CONTROLS)[number];

/**
 * Claims the source states as the literal false, on every read. A missing field
 * counts: the source has to say it, and silence is not a no.
 */
export const NOTIFY_NON_CLAIM_FIELDS = [
  "arrivalConfirmsEffect",
  "externalSendWired",
  "actorIsAuthenticated",
  "crossTenantDelivery",
  "sensitiveDetailShownWithoutGrant",
  "actionSkipsGenerationCheck",
  "inboxIsCompleteRecord",
] as const;
export type NotifyNonClaimField = (typeof NOTIFY_NON_CLAIM_FIELDS)[number];
export type NotifyNonClaims = Readonly<Record<NotifyNonClaimField, false>>;

export const NOTIFY_SCENARIOS = [
  "clean",
  "empty",
  "stale",
  "denied",
  "tenant-mix",
  "subject-mix",
  "duplicate",
  "late",
  "grant-rotated",
  "kind-uncontracted",
  "sensitive-leak",
  "claims-arrival",
  "external-wired",
  "read-lost",
  "act-lost",
  "inquiry-denied",
  "inquiry-leak",
  "resolve-claims",
] as const;
export type NotifyScenario = (typeof NOTIFY_SCENARIOS)[number];

// ---------------------------------------------------------------------------
// Identity. Each kind has its own prefix and one kind is never read as another.
// ---------------------------------------------------------------------------

export const NOTIFY_REF_KINDS = ["notification", "grant", "inquiry"] as const;
export type NotifyRefKind = (typeof NOTIFY_REF_KINDS)[number];

const REF_PREFIX: Readonly<Record<NotifyRefKind, string>> = {
  notification: "ntf-",
  grant: "ngr-",
  inquiry: "nqy-",
};

const REF_PATTERN = /^(ntf|ngr|nqy)-[0-9]{4}$/;

export function notifyRefFor(kind: NotifyRefKind, serial: number): string {
  return `${REF_PREFIX[kind]}${String(serial).padStart(4, "0")}`;
}

export function notifyRefKind(ref: string): NotifyRefKind | null {
  if (!REF_PATTERN.test(ref)) {
    return null;
  }
  for (const kind of NOTIFY_REF_KINDS) {
    if (ref.startsWith(REF_PREFIX[kind])) {
      return kind;
    }
  }
  return null;
}

export function isNotifyRef(ref: unknown, kind: NotifyRefKind): ref is string {
  return typeof ref === "string" && notifyRefKind(ref) === kind;
}

// ---------------------------------------------------------------------------
// Read model shapes
// ---------------------------------------------------------------------------

/** The scope every call carries: the tenant, and the role the actor acts under. */
export interface NotifyScope {
  tenantId: string;
  role: NotifyRole;
}

/** What an offered action resolves to. The destination is the source's word. */
export type NotifyOffer =
  | { kind: "open-authority"; ref: string }
  | { kind: "open-support"; inquiryRef: string };

/**
 * One notification row. It confirms no economic effect: a payment-observed row
 * reports an observation, and an issued kind reports the source's own record.
 * An arrival is not a receipt.
 */
export interface NotifyNotification {
  notificationRef: string;
  tenantId: string;
  /** The one person this notification is addressed to. */
  subjectRef: string;
  kind: NotifyEventKind;
  /** The source's own dedupe key. A second delivery of the same key is dropped. */
  dedupeKey: string;
  seq: number;
  /** The grant generation the notification was issued under. */
  issueGeneration: number;
  issuedAt: string;
  read: boolean;
  /** Sensitive rows hold detail only for a role that holds read-sensitive. */
  sensitive: boolean;
  headline: string;
  detail: string | null;
  detailState: NotifyDetailState;
  issueState: NotifyIssueState;
  offer: NotifyOffer | null;
}

export interface NotifySnapshot {
  /** Read serial on this port. It orders reads and is not a commit position. */
  snapshotId: number;
  watermark: string;
  scenario: NotifyScenario;
  scope: NotifyScope;
  actorRef: string;
  /** The notification grant this read ran under. Its own kind of ref. */
  grantRef: string;
  /** The generation of the actor's notification grant as of this read. */
  grantGeneration: number;
  /** The capabilities this role holds on the inbox. */
  capabilities: readonly NotifyCapability[];
  notifications: readonly NotifyNotification[];
  /** The source's own count of unread rows after dedupe. */
  unreadCount: number;
  /** Second deliveries dropped by the dedupe key in this read. */
  droppedDuplicates: number;
  /** The deep-opened notification when the read asked for one, or null. */
  focus: NotifyFocus | null;
  /** The literal false for each claim field, or the whole payload is refused. */
  nonClaims: NotifyNonClaims;
}

/** One deep-opened notification. The shape is the row's own; the page copies it. */
export type NotifyFocus = { kind: "notification"; row: NotifyNotification };

export interface NotifyInquiryLine {
  label: string;
  text: string;
}

/** What the inquiry material says about its own scope. Anything else is refused. */
export interface NotifyInquiryDeclaration {
  provenance: "synthetic";
  realPersonalData: false;
  deliveredExternally: false;
  authorityRecord: false;
}

/** Support material for one notification. Redacted by the source, never built on the page. */
export interface NotifyInquiry {
  inquiryRef: string;
  notificationRef: string;
  tenantId: string;
  subjectRef: string;
  declaration: NotifyInquiryDeclaration;
  lines: readonly NotifyInquiryLine[];
}

export interface NotifyReadRequest {
  contextKey: string;
  actorRef: string;
  scope: NotifyScope;
  /** A deep-open: the notification ref the URL or the open control named. */
  focusRef: string | null;
  /** The grant generation the caller's view was built under, or null for a first read. */
  grantFloor: number | null;
  watermarkFloor: string | null;
}

export interface NotifyInquiryRequest {
  contextKey: string;
  actorRef: string;
  scope: NotifyScope;
  inquiryRef: string;
}

export type NotifyActionRequest =
  | { kind: "mark-read"; notificationRef: string }
  | { kind: "resolve"; notificationRef: string };

export interface NotifyActRequest {
  contextKey: string;
  actorRef: string;
  /** The scope plus the grant generation the request was built under. */
  scope: NotifyScope & { grantGeneration: number };
  action: NotifyActionRequest;
}

/** Where a resolve lands the person. The page maps the kind to a surface. */
export type NotifyDestination =
  | { kind: "authority"; ref: string }
  | { kind: "support"; inquiryRef: string };

/**
 * What the source answers to a request. A marked read changes read state and
 * nothing else; a resolved offer yields a destination and nothing else. Neither
 * confirms an economic effect and neither is an external send.
 */
export interface NotifyReceipt {
  kind: "read-marked" | "resolved";
  notificationRef: string;
  /** For a resolve, where the offered action lands. Null for a mark-read. */
  destination: NotifyDestination | null;
  /** The grant generation the answer was checked under. */
  checkedGeneration: number;
  confirmsEconomicEffect: false;
  externalSendWired: false;
}

export type NotifyTupleChanged = { kind: "tuple-changed"; field: string; expected: string; actual: string };

export type NotifyDenied = { kind: "denied"; code: NotifyDeniedCode; detail: string };

export type NotifyRefused = { kind: "refused"; code: NotifyRefusalCode; field: string; ref: string | null; detail: string };

export type NotifyInvalid = { kind: "invalid-request"; code: NotifyInvalidCode; detail: string };

/** The caller's grant floor is behind the grant generation the source holds now. */
export type NotifyGenerationStale = { kind: "generation-stale"; expected: number; actual: number };

export type NotifyReadOutcome =
  | { kind: "ready"; snapshot: NotifySnapshot }
  | { kind: "empty"; watermark: string; snapshotId: number; scope: NotifyScope }
  | { kind: "stale"; watermark: string; floor: string }
  | NotifyGenerationStale
  | NotifyDenied
  | NotifyRefused
  | NotifyInvalid
  | NotifyTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export type NotifyInquiryOutcome =
  | { kind: "ready"; inquiry: NotifyInquiry }
  | NotifyDenied
  | NotifyRefused
  | NotifyInvalid
  | NotifyTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export type NotifyActOutcome =
  | { kind: "applied"; receipt: NotifyReceipt }
  | { kind: "rejected"; code: NotifyRejectionCode; detail: string }
  | NotifyDenied
  | NotifyRefused
  | NotifyInvalid
  | NotifyTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export interface NotificationInboxPort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic-notification-inbox" | "none";
  readonly scenario: NotifyScenario;
  read(request: NotifyReadRequest): Promise<NotifyReadOutcome>;
  readInquiry(request: NotifyInquiryRequest): Promise<NotifyInquiryOutcome>;
  act(request: NotifyActRequest): Promise<NotifyActOutcome>;
  /**
   * Synthetic control: moves the source itself. A real producer offers none of
   * them. Returns false when there is no source to move or nothing for the
   * control to act on.
   */
  synthetic(control: NotifySyntheticControl, ref?: string): boolean;
}

export interface StubNotificationInboxOptions {
  scenario?: NotifyScenario;
  /** Expected tuple override. Used to stage a producer change in tests. */
  expectedTuple?: DiscoveryReadTuple;
}

export interface NotifyEffectCounts {
  reads: number;
  inquiries: number;
  acts: number;
}

export function createStubNotificationInbox(options: StubNotificationInboxOptions = {}): StubNotificationInbox {
  return new StubNotificationInbox(options);
}

export function createNotBoundNotificationInbox(): NotificationInboxPort {
  const outcome = { kind: "not-bound", reason: NOTIFY_NOT_BOUND_REASON } as const;
  return {
    environment: "integration-http",
    source: "none",
    scenario: "clean",
    read() {
      return Promise.resolve({ ...outcome });
    },
    readInquiry() {
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

export function notificationInboxPortFor(
  environment: "stub" | "integration-http",
  options: StubNotificationInboxOptions = {},
): NotificationInboxPort {
  if (environment === "stub") {
    return createStubNotificationInbox(options);
  }
  return createNotBoundNotificationInbox();
}

// ---------------------------------------------------------------------------
// Pure checks. The port uses them before it returns a row, and the controller
// and the screen use them to say what a snapshot can and cannot support.
// ---------------------------------------------------------------------------

/** The first claim field that is not the literal false. A missing field counts. */
export function findNotifyClaim(nonClaims: unknown): NotifyNonClaimField | null {
  const record = (typeof nonClaims === "object" && nonClaims !== null ? nonClaims : {}) as Record<string, unknown>;
  for (const field of NOTIFY_NON_CLAIM_FIELDS) {
    if (record[field] !== false) {
      return field;
    }
  }
  return null;
}

function refuse(code: NotifyRefusalCode, field: string, ref: string | null, detail: string): NotifyRefused {
  return { kind: "refused", code, field, ref, detail };
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

function isGeneration(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isIssueGeneration(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isInstant(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

/**
 * The source's own redaction check on inquiry material. A line that carries a
 * sensitive token — an address, an account-shaped number, a bearer or key
 * material shape — is not support material, and the payload is refused.
 */
const SENSITIVE_TOKEN =
  /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.[A-Za-z]{2,24}|\b(?:sk|pk|tok|key|api|secret|pwd|bearer)[-_][A-Za-z0-9]{6,}|\b\d{12,19}\b|\beyJ[A-Za-z0-9_-]{10,}/;

export function notifyTextSafe(text: string): boolean {
  return !SENSITIVE_TOKEN.test(text);
}

function refuseOffer(offer: NotifyOffer | null): NotifyRefused | null {
  if (offer === null) {
    return null;
  }
  if (offer.kind === "open-authority") {
    if (!isNonEmpty(offer.ref)) {
      return refuse("REF", "notifications[].offer.ref", String(offer.ref), "An open-authority offer names a reference.");
    }
    return null;
  }
  if (offer.kind === "open-support") {
    if (!isNotifyRef(offer.inquiryRef, "inquiry")) {
      return refuse("REF", "notifications[].offer.inquiryRef", String(offer.inquiryRef), "An open-support offer names an inquiry reference.");
    }
    return null;
  }
  return refuse("KIND", "notifications[].offer.kind", null, "An offered action is not a known value.");
}

function refuseNotification(
  row: NotifyNotification,
  scope: NotifyScope,
  actorRef: string,
  capabilities: readonly NotifyCapability[],
): NotifyRefused | null {
  if (!isNotifyRef(row.notificationRef, "notification")) {
    return refuse("REF", "notifications[].notificationRef", String(row.notificationRef), "A notification is named by a notification reference.");
  }
  if (row.tenantId !== scope.tenantId) {
    return refuse("SCOPE_LEAK", "notifications[].tenantId", row.notificationRef, `Notification ${row.notificationRef} belongs to another tenant.`);
  }
  if (row.subjectRef !== actorRef) {
    return refuse("SUBJECT_LEAK", "notifications[].subjectRef", row.notificationRef, `Notification ${row.notificationRef} belongs to another subject.`);
  }
  if (!includes(NOTIFY_EVENT_KINDS, row.kind)) {
    return refuse(
      "UNCONTRACTED",
      "notifications[].kind",
      row.notificationRef,
      `Event kind ${String(row.kind)} is not one the producer contract names. The inbox projects contracted events only.`,
    );
  }
  if (!includes(NOTIFY_DETAIL_STATES, row.detailState) || !includes(NOTIFY_ISSUE_STATES, row.issueState)) {
    return refuse("KIND", "notifications[]", row.notificationRef, "A notification detail or issue state is not a known value.");
  }
  if (!isNonEmpty(row.dedupeKey) || !isNonEmpty(row.headline)) {
    return refuse("STATE", "notifications[]", row.notificationRef, "A notification carries a dedupe key and a headline.");
  }
  if (!isIssueGeneration(row.issueGeneration) || !Number.isInteger(row.seq) || row.seq < 1) {
    return refuse("STATE", "notifications[]", row.notificationRef, "A notification sequence is a whole number from 1 and its issue generation a whole number from 0.");
  }
  if (!isInstant(row.issuedAt)) {
    return refuse("STATE", "notifications[].issuedAt", row.notificationRef, "A notification states the instant it was issued.");
  }
  if (row.detailState === "shown" && row.detail === null) {
    return refuse("STATE", "notifications[].detail", row.notificationRef, "A shown detail is the source's own text.");
  }
  if (row.detailState === "withheld" && row.detail !== null) {
    return refuse("STATE", "notifications[].detail", row.notificationRef, "A withheld detail sends no text.");
  }
  if (row.sensitive && row.detailState === "shown" && !capabilities.includes("read-sensitive")) {
    return refuse(
      "SENSITIVE_LEAK",
      "notifications[].detail",
      row.notificationRef,
      `Notification ${row.notificationRef} is sensitive and this role holds no read-sensitive capability. The detail stays withheld at the source; a payload that sends it anyway is refused whole.`,
    );
  }
  return refuseOffer(row.offer);
}

/**
 * Checks a payload the source returned before any row is shown. A failure means
 * the payload cannot be trusted as a whole, so the port returns no row from it.
 */
export function refuseNotifySnapshot(snapshot: NotifySnapshot): NotifyRefused | null {
  const claim = findNotifyClaim(snapshot.nonClaims);
  if (claim !== null) {
    return refuse(
      "CLAIM",
      claim,
      null,
      `The payload does not state ${claim} as false. An arrival confirms no economic effect, no external send or provider API is wired, an actor label is not authentication, no row crosses a tenant boundary, a sensitive detail is never shown without the capability, and a stale notification's action never skips the current-generation check.`,
    );
  }
  if (!includes(NOTIFY_KNOWN, snapshot.scope.tenantId)) {
    return refuse("SCOPE_LEAK", "scope.tenantId", null, `The snapshot names tenant ${String(snapshot.scope.tenantId)}.`);
  }
  if (!includes(NOTIFY_ROLES, snapshot.scope.role)) {
    return refuse("KIND", "scope.role", null, "The snapshot names an unknown role.");
  }
  if (!isNotifyRef(snapshot.grantRef, "grant")) {
    return refuse("REF", "grantRef", String(snapshot.grantRef), "The read names the notification grant it ran under.");
  }
  if (!isGeneration(snapshot.grantGeneration)) {
    return refuse("STATE", "grantGeneration", null, "The read states the grant generation it was taken under.");
  }
  const seenKeys = new Set<string>();
  const seenRefs = new Set<string>();
  for (const row of snapshot.notifications) {
    const bad = refuseNotification(row, snapshot.scope, snapshot.actorRef, snapshot.capabilities);
    if (bad !== null) {
      return bad;
    }
    if (seenKeys.has(row.dedupeKey)) {
      return refuse("STATE", "notifications[].dedupeKey", row.notificationRef, `Dedupe key ${row.dedupeKey} arrives twice in one snapshot. A second delivery is dropped, not listed.`);
    }
    seenKeys.add(row.dedupeKey);
    if (seenRefs.has(row.notificationRef)) {
      return refuse("REF", "notifications[].notificationRef", row.notificationRef, `Notification ${row.notificationRef} arrives twice in one snapshot.`);
    }
    seenRefs.add(row.notificationRef);
  }
  for (const capability of snapshot.capabilities) {
    if (!includes(NOTIFY_CAPABILITIES, capability)) {
      return refuse("KIND", "capabilities", null, "A capability is not a known value.");
    }
  }
  const focus = snapshot.focus;
  if (focus !== null) {
    if (focus.kind !== "notification") {
      return refuse("KIND", "focus.kind", null, "A focused row is a notification.");
    }
    if (focus.row.tenantId !== snapshot.scope.tenantId) {
      return refuse("SCOPE_LEAK", "focus.tenantId", focus.row.notificationRef, "A focused notification belongs to another tenant.");
    }
    if (focus.row.subjectRef !== snapshot.actorRef) {
      return refuse("SUBJECT_LEAK", "focus.subjectRef", focus.row.notificationRef, "A focused notification belongs to another subject.");
    }
  }
  return null;
}

/** Checks the inquiry material's own declaration and lines before one is shown. */
export function refuseNotifyInquiry(inquiry: NotifyInquiry, scope: NotifyScope, actorRef: string): NotifyRefused | null {
  if (!isNotifyRef(inquiry.inquiryRef, "inquiry")) {
    return refuse("REF", "inquiryRef", String(inquiry.inquiryRef), "An inquiry is named by an inquiry reference.");
  }
  const declaration = inquiry.declaration;
  if (
    declaration.provenance !== "synthetic" ||
    declaration.realPersonalData !== false ||
    declaration.deliveredExternally !== false ||
    declaration.authorityRecord !== false
  ) {
    return refuse(
      "CLAIM",
      "declaration",
      inquiry.inquiryRef,
      "The inquiry material does not declare itself synthetic, holding no real personal data, not delivered externally, and not an authority record.",
    );
  }
  if (inquiry.tenantId !== scope.tenantId) {
    return refuse("SCOPE_LEAK", "tenantId", inquiry.inquiryRef, "The inquiry material names another tenant.");
  }
  if (inquiry.subjectRef !== actorRef) {
    return refuse("SUBJECT_LEAK", "subjectRef", inquiry.inquiryRef, "The inquiry material belongs to another subject.");
  }
  if (!isNotifyRef(inquiry.notificationRef, "notification")) {
    return refuse("REF", "notificationRef", inquiry.inquiryRef, "An inquiry names the notification it supports.");
  }
  for (const line of inquiry.lines) {
    if (!isNonEmpty(line.label) || !isNonEmpty(line.text)) {
      return refuse("STATE", "lines[]", inquiry.inquiryRef, "An inquiry line carries a label and text.");
    }
    if (!notifyTextSafe(line.text)) {
      return refuse(
        "SENSITIVE_LEAK",
        "lines[].text",
        inquiry.inquiryRef,
        `Inquiry ${inquiry.inquiryRef} carries a line with a sensitive token. The source redacts support material; a payload that does not is refused whole.`,
      );
    }
  }
  return null;
}

/** Checks a request receipt before it is trusted as recorded. */
export function refuseNotifyReceipt(receipt: NotifyReceipt, action: NotifyActionRequest): NotifyRefused | null {
  if (receipt.confirmsEconomicEffect !== false || receipt.externalSendWired !== false) {
    return refuse(
      "CLAIM",
      "confirmsEconomicEffect",
      receipt.notificationRef,
      "The answer claims a notification request confirmed an economic effect or wired an external send. A marked read changes read state only, and a resolve yields a destination only.",
    );
  }
  if (!isNotifyRef(receipt.notificationRef, "notification")) {
    return refuse("REF", "notificationRef", String(receipt.notificationRef), "A receipt names a notification reference.");
  }
  if (action.kind === "mark-read") {
    if (receipt.kind !== "read-marked") {
      return refuse("KIND", "kind", receipt.notificationRef, "A mark-read is answered as read-marked.");
    }
    if (receipt.destination !== null) {
      return refuse("STATE", "destination", receipt.notificationRef, "A marked read carries no destination.");
    }
    return null;
  }
  if (receipt.kind !== "resolved") {
    return refuse("KIND", "kind", receipt.notificationRef, "A resolve is answered as resolved.");
  }
  if (receipt.destination === null) {
    return refuse("STATE", "destination", receipt.notificationRef, "A resolved offer carries its destination.");
  }
  if (receipt.destination.kind === "authority" && !isNonEmpty(receipt.destination.ref)) {
    return refuse("REF", "destination.ref", receipt.notificationRef, "An authority destination names a reference.");
  }
  if (receipt.destination.kind === "support" && !isNotifyRef(receipt.destination.inquiryRef, "inquiry")) {
    return refuse("REF", "destination.inquiryRef", receipt.notificationRef, "A support destination names an inquiry reference.");
  }
  if (!isGeneration(receipt.checkedGeneration)) {
    return refuse("STATE", "checkedGeneration", receipt.notificationRef, "A resolve states the generation it was checked under.");
  }
  return null;
}

// ---------------------------------------------------------------------------
// Assessment and eligibility. What the last read offers, against the source's
// own rows. The screen and the request path both ask these.
// ---------------------------------------------------------------------------

export interface NotifyAssessment {
  /** Unread rows the mark-read request may name, copied from the last read. */
  markable: readonly NotifyNotification[];
  /** Rows whose offered action may be resolved: an offer, and a current issue. */
  resolvable: readonly NotifyNotification[];
  /** Rows issued under an older grant generation. Their offers resolve nothing. */
  staleIssue: readonly NotifyNotification[];
}

export function assessNotifySnapshot(snapshot: NotifySnapshot): NotifyAssessment {
  return {
    markable: snapshot.notifications.filter((row) => !row.read),
    resolvable: snapshot.notifications.filter((row) => row.offer !== null && row.issueState === "current"),
    staleIssue: snapshot.notifications.filter((row) => row.issueState === "stale-issue"),
  };
}

export interface NotifyEligibility {
  allowed: boolean;
  reason: string | null;
}

/**
 * Whether the last read supports a request of this kind from this actor. The
 * page shows the reason and the request path enforces it, so a control that is
 * off is a request that never leaves — and the port decides again when one does.
 */
export function notifyEligibility(snapshot: NotifySnapshot, kind: NotifyActionKind): NotifyEligibility {
  const capabilities = notifyCapabilities(snapshot.scope.role);
  const needed: NotifyCapability = kind === "mark-read" ? "mark-read" : "resolve-action";
  if (!capabilities.includes(needed)) {
    return { allowed: false, reason: `Role ${snapshot.scope.role} holds no ${needed} capability at the source.` };
  }
  const assessment = assessNotifySnapshot(snapshot);
  if (kind === "mark-read") {
    if (assessment.markable.length === 0) {
      return { allowed: false, reason: "The last read lists no unread notification." };
    }
    return { allowed: true, reason: null };
  }
  if (assessment.resolvable.length === 0) {
    return {
      allowed: false,
      reason:
        snapshot.notifications.length === 0
          ? "The last read lists no notification."
          : "No notification in the last read offers a resolvable action. A notification with no offer, or one issued under an older grant generation, resolves nothing.",
    };
  }
  return { allowed: true, reason: null };
}

// ---------------------------------------------------------------------------
// The synthetic source.
// ---------------------------------------------------------------------------

interface SeedGrant {
  grantRef: string;
  tenantId: string;
  actorRef: string;
}

interface SeedNotification {
  notificationRef: string;
  tenantId: string;
  subjectRef: string;
  kind: NotifyEventKind | string;
  dedupeKey: string;
  seq: number;
  issueGeneration: number;
  issuedAt: string;
  read: boolean;
  sensitive: boolean;
  headline: string;
  detail: string;
  offer: NotifyOffer | null;
}

interface SeedInquiry {
  inquiryRef: string;
  notificationRef: string;
  tenantId: string;
  subjectRef: string;
  lines: readonly NotifyInquiryLine[];
}

const SEED_GRANTS: readonly SeedGrant[] = [
  { grantRef: "ngr-0001", tenantId: TENANT_OWN, actorRef: TENANT_BUYER_ACTOR },
  { grantRef: "ngr-0002", tenantId: TENANT_OWN, actorRef: TENANT_ORGANIZER_ACTOR },
  { grantRef: "ngr-0003", tenantId: TENANT_OWN, actorRef: TENANT_SETTLER_ACTOR },
  { grantRef: "ngr-0004", tenantId: TENANT_OWN, actorRef: TENANT_SUPPORT_ACTOR },
  { grantRef: "ngr-0005", tenantId: TENANT_OWN, actorRef: TENANT_DUAL_ACTOR },
  { grantRef: "ngr-9001", tenantId: TENANT_FOREIGN, actorRef: TENANT_FOREIGN_ACTOR },
];

const SEED_NOTIFICATIONS: readonly SeedNotification[] = [
  {
    notificationRef: "ntf-0001",
    tenantId: TENANT_OWN,
    subjectRef: TENANT_BUYER_ACTOR,
    kind: "trade-recorded",
    dedupeKey: "evt-1001",
    seq: 1,
    issueGeneration: 1,
    issuedAt: "2026-10-12T09:00:00.000Z",
    read: false,
    sensitive: false,
    headline: "Trade trd-0001 was recorded at the source.",
    detail: "The record says nothing about payment or settlement.",
    offer: { kind: "open-authority", ref: "trd-0001" },
  },
  {
    notificationRef: "ntf-0002",
    tenantId: TENANT_OWN,
    subjectRef: TENANT_BUYER_ACTOR,
    kind: "payment-observed",
    dedupeKey: "evt-1002",
    seq: 2,
    issueGeneration: 1,
    issuedAt: "2026-10-12T09:30:00.000Z",
    read: false,
    sensitive: false,
    headline: "A payment observation was recorded on trade trd-0001.",
    detail: "An observation is not confirmed funds.",
    offer: { kind: "open-support", inquiryRef: "nqy-0001" },
  },
  {
    notificationRef: "ntf-0003",
    tenantId: TENANT_OWN,
    subjectRef: TENANT_BUYER_ACTOR,
    kind: "hold-expiring",
    dedupeKey: "evt-1003",
    seq: 3,
    issueGeneration: 1,
    issuedAt: "2026-10-12T10:00:00.000Z",
    read: true,
    sensitive: false,
    headline: "Hold rgt-0007 nears its expiry label.",
    detail: "The label is a display value, not a deadline computed here.",
    // No offered action: a row can carry nothing to resolve.
    offer: null,
  },
  {
    notificationRef: "ntf-0004",
    tenantId: TENANT_OWN,
    subjectRef: TENANT_BUYER_ACTOR,
    kind: "grant-changed",
    dedupeKey: "evt-1004",
    seq: 4,
    issueGeneration: 1,
    issuedAt: "2026-10-12T10:30:00.000Z",
    read: false,
    sensitive: true,
    headline: "A grant on this membership moved at the source.",
    detail: "The source's own text: membership tail mem-4417 rotated.",
    offer: { kind: "open-support", inquiryRef: "nqy-0002" },
  },
  {
    notificationRef: "ntf-0011",
    tenantId: TENANT_OWN,
    subjectRef: TENANT_ORGANIZER_ACTOR,
    kind: "right-moved",
    dedupeKey: "evt-1011",
    seq: 1,
    issueGeneration: 1,
    issuedAt: "2026-10-12T08:00:00.000Z",
    read: false,
    sensitive: false,
    headline: "Right rgt-0009 moved at the source.",
    detail: "A move record, not a settlement record.",
    offer: { kind: "open-authority", ref: "rgt-0009" },
  },
  {
    notificationRef: "ntf-0012",
    tenantId: TENANT_OWN,
    subjectRef: TENANT_ORGANIZER_ACTOR,
    kind: "support-answered",
    dedupeKey: "evt-1012",
    seq: 2,
    issueGeneration: 1,
    issuedAt: "2026-10-12T08:30:00.000Z",
    read: true,
    sensitive: false,
    headline: "The support case on event evn-0001 has an answer.",
    detail: "The answer is on the case record.",
    offer: { kind: "open-support", inquiryRef: "nqy-0003" },
  },
  {
    notificationRef: "ntf-0021",
    tenantId: TENANT_OWN,
    subjectRef: TENANT_SETTLER_ACTOR,
    kind: "inquiry-ready",
    dedupeKey: "evt-1021",
    seq: 1,
    issueGeneration: 1,
    issuedAt: "2026-10-12T07:00:00.000Z",
    read: false,
    sensitive: true,
    headline: "Inquiry material is ready for trade trd-0002.",
    detail: "The source's own text: trade tail trd-9902 reconciled.",
    offer: { kind: "open-support", inquiryRef: "nqy-0004" },
  },
  {
    notificationRef: "ntf-0022",
    tenantId: TENANT_OWN,
    subjectRef: TENANT_SETTLER_ACTOR,
    kind: "payment-observed",
    dedupeKey: "evt-1022",
    seq: 2,
    issueGeneration: 1,
    issuedAt: "2026-10-12T07:30:00.000Z",
    read: false,
    sensitive: false,
    headline: "A payment observation was recorded on trade trd-0002.",
    detail: "An observation is not confirmed funds.",
    offer: { kind: "open-authority", ref: "trd-0002" },
  },
  {
    notificationRef: "ntf-0031",
    tenantId: TENANT_OWN,
    subjectRef: TENANT_SUPPORT_ACTOR,
    kind: "support-answered",
    dedupeKey: "evt-1031",
    seq: 1,
    issueGeneration: 1,
    issuedAt: "2026-10-12T06:00:00.000Z",
    read: false,
    sensitive: false,
    headline: "The case queue answered case tck-0001.",
    detail: "The answer is on the case record.",
    offer: { kind: "open-support", inquiryRef: "nqy-0005" },
  },
  {
    notificationRef: "ntf-0032",
    tenantId: TENANT_OWN,
    subjectRef: TENANT_SUPPORT_ACTOR,
    kind: "grant-changed",
    dedupeKey: "evt-1032",
    seq: 2,
    issueGeneration: 1,
    issuedAt: "2026-10-12T06:30:00.000Z",
    read: false,
    sensitive: true,
    headline: "A grant on this membership moved at the source.",
    detail: "The source's own text: membership tail mem-0019 rotated.",
    offer: { kind: "open-authority", ref: "acc-0001" },
  },
  {
    notificationRef: "ntf-0041",
    tenantId: TENANT_OWN,
    subjectRef: TENANT_DUAL_ACTOR,
    kind: "trade-recorded",
    dedupeKey: "evt-1041",
    seq: 1,
    issueGeneration: 1,
    issuedAt: "2026-10-12T05:00:00.000Z",
    read: false,
    sensitive: false,
    headline: "Trade trd-0003 was recorded at the source.",
    detail: "The record says nothing about payment or settlement.",
    offer: { kind: "open-authority", ref: "trd-0003" },
  },
  {
    notificationRef: "ntf-9001",
    tenantId: TENANT_FOREIGN,
    subjectRef: TENANT_FOREIGN_ACTOR,
    kind: "trade-recorded",
    dedupeKey: "evt-9001",
    seq: 1,
    issueGeneration: 1,
    issuedAt: "2026-10-12T05:00:00.000Z",
    read: false,
    sensitive: false,
    headline: "Foreign trade trd-9001 was recorded.",
    detail: "A row of another tenant. Never served to this desk.",
    offer: { kind: "open-authority", ref: "trd-9001" },
  },
];

const SEED_INQUIRIES: readonly SeedInquiry[] = [
  {
    inquiryRef: "nqy-0001",
    notificationRef: "ntf-0002",
    tenantId: TENANT_OWN,
    subjectRef: TENANT_BUYER_ACTOR,
    lines: [
      { label: "What we know", text: "A payment observation was recorded on trade trd-0001. It is not confirmed funds." },
      { label: "What to send", text: "The notification ref ntf-0002 and the trade ref trd-0001, as they appear here." },
      { label: "What this is not", text: "Not a payment confirmation, not a settled trade, and not an authority record." },
    ],
  },
  {
    inquiryRef: "nqy-0002",
    notificationRef: "ntf-0004",
    tenantId: TENANT_OWN,
    subjectRef: TENANT_BUYER_ACTOR,
    lines: [
      { label: "What we know", text: "A grant on this membership moved at the source. Read again under the current grant." },
      { label: "What to send", text: "The notification ref ntf-0004." },
    ],
  },
  {
    inquiryRef: "nqy-0003",
    notificationRef: "ntf-0012",
    tenantId: TENANT_OWN,
    subjectRef: TENANT_ORGANIZER_ACTOR,
    lines: [
      { label: "What we know", text: "The support case on event evn-0001 carries an answer." },
      { label: "What to send", text: "The notification ref ntf-0012 and the event ref evn-0001." },
    ],
  },
  {
    inquiryRef: "nqy-0004",
    notificationRef: "ntf-0021",
    tenantId: TENANT_OWN,
    subjectRef: TENANT_SETTLER_ACTOR,
    lines: [
      { label: "What we know", text: "The inquiry material for trade trd-0002 is ready." },
      { label: "What to send", text: "The notification ref ntf-0021 and the trade ref trd-0002." },
    ],
  },
  {
    inquiryRef: "nqy-0005",
    notificationRef: "ntf-0031",
    tenantId: TENANT_OWN,
    subjectRef: TENANT_SUPPORT_ACTOR,
    lines: [
      { label: "What we know", text: "Case tck-0001 carries an answer from the case queue." },
      { label: "What to send", text: "The notification ref ntf-0031 and the case ref tck-0001." },
    ],
  },
];

const NON_CLAIMS: NotifyNonClaims = {
  arrivalConfirmsEffect: false,
  externalSendWired: false,
  actorIsAuthenticated: false,
  crossTenantDelivery: false,
  sensitiveDetailShownWithoutGrant: false,
  actionSkipsGenerationCheck: false,
  inboxIsCompleteRecord: false,
};

/** Synthetic source. State lives in this object, so a new port is a new session. */
export class StubNotificationInbox implements NotificationInboxPort {
  readonly environment = "stub" as const;
  readonly source = "synthetic-notification-inbox" as const;
  readonly scenario: NotifyScenario;
  private readonly expectedTuple: DiscoveryReadTuple;
  private snapshotSerial = 0;
  private deliveredSerial = 50;
  /** Grant generation by grant ref. Rotated by the synthetic control. */
  private readonly generations = new Map<string, number>();
  private readonly revoked = new Set<string>();
  /** Notifications marked read at the source. */
  private readonly readSet = new Set<string>();
  /** Notifications the deliver-late control pushed mid-session. */
  private readonly delivered: SeedNotification[] = [];
  private readonly counts: NotifyEffectCounts = { reads: 0, inquiries: 0, acts: 0 };

  constructor(options: StubNotificationInboxOptions) {
    this.scenario = options.scenario ?? "clean";
    this.expectedTuple = options.expectedTuple ?? DISCOVERY_READ_TUPLE_LITERALS;
    for (const grant of SEED_GRANTS) {
      this.generations.set(grant.grantRef, 1);
    }
    if (this.scenario === "grant-rotated") {
      // Every grant moved a generation at the source before the inbox's first read.
      for (const grant of SEED_GRANTS) {
        this.generations.set(grant.grantRef, 2);
      }
    }
    if (this.scenario === "late") {
      // A notification issued under an older grant generation arrived before
      // the read. It keeps its row, is marked stale-issue, and its offered
      // action resolves nothing.
      this.delivered.push({
        notificationRef: "ntf-0050",
        tenantId: TENANT_OWN,
        subjectRef: TENANT_BUYER_ACTOR,
        kind: "inquiry-ready",
        dedupeKey: "evt-late-0050",
        seq: 50,
        issueGeneration: 0,
        issuedAt: "2026-10-11T23:00:00.000Z",
        read: false,
        sensitive: false,
        headline: "An inquiry was prepared under an older grant generation.",
        detail: "A late delivery. Its offered action resolves nothing.",
        offer: { kind: "open-authority", ref: "trd-0001" },
      });
    }
    if (this.scenario === "denied") {
      for (const grant of SEED_GRANTS) {
        this.revoked.add(grant.grantRef);
      }
    }
  }

  /** Test seam. Counts of what reached the source. Not part of the port. */
  effects(): NotifyEffectCounts {
    return { ...this.counts };
  }

  synthetic(control: NotifySyntheticControl, ref?: string): boolean {
    if (control === "revoke-grant" || control === "rotate-grant") {
      const grant = SEED_GRANTS.find((row) => row.grantRef === ref);
      if (grant === undefined || this.revoked.has(grant.grantRef)) {
        return false;
      }
      if (control === "revoke-grant") {
        this.revoked.add(grant.grantRef);
      }
      this.generations.set(grant.grantRef, (this.generations.get(grant.grantRef) ?? 1) + 1);
      return true;
    }
    // deliver-late: a notification issued under the previous grant generation
    // arrives mid-session. The next read lists it stale-issue and its offered
    // action resolves nothing.
    const grant = SEED_GRANTS.find((row) => row.actorRef === ref && row.tenantId === TENANT_OWN);
    if (grant === undefined || this.revoked.has(grant.grantRef)) {
      return false;
    }
    const current = this.generations.get(grant.grantRef) ?? 1;
    this.deliveredSerial += 1;
    this.delivered.push({
      notificationRef: notifyRefFor("notification", 500 + this.deliveredSerial),
      tenantId: TENANT_OWN,
      subjectRef: grant.actorRef,
      kind: "inquiry-ready",
      dedupeKey: `evt-late-${this.deliveredSerial}`,
      seq: 90 + this.deliveredSerial,
      issueGeneration: Math.max(0, current - 1),
      issuedAt: "2026-10-11T23:00:00.000Z",
      read: false,
      sensitive: false,
      headline: "An inquiry for this actor was prepared under an older grant generation.",
      detail: "A late delivery. Its offered action resolves nothing.",
      offer: { kind: "open-authority", ref: "trd-0001" },
    });
    return true;
  }

  private grantOf(actorRef: string, tenantId: string): SeedGrant | undefined {
    return SEED_GRANTS.find((row) => row.actorRef === actorRef && row.tenantId === tenantId);
  }

  private generationOf(grantRef: string): number {
    return this.generations.get(grantRef) ?? 1;
  }

  private gate(request: { contextKey: unknown; actorRef: unknown; scope: Partial<NotifyScope> | null | undefined }):
    | { invalid: NotifyInvalid }
    | { denied: NotifyDenied }
    | { grant: SeedGrant } {
    const scope = request.scope;
    if (!isNonEmpty(request.contextKey)) {
      return { invalid: { kind: "invalid-request", code: "CONTEXT", detail: "A request carries a context key." } };
    }
    if (!isNonEmpty(request.actorRef)) {
      return { invalid: { kind: "invalid-request", code: "ACTOR", detail: "A request carries an actor string. It is a label, not an authentication result." } };
    }
    if (scope === null || scope === undefined || !includes(NOTIFY_KNOWN, scope.tenantId)) {
      return {
        invalid: { kind: "invalid-request", code: "SCOPE", detail: `A scope names a tenant of ${NOTIFY_KNOWN.join(" or ")}.` },
      };
    }
    if (!includes(NOTIFY_ROLES, scope.role)) {
      return {
        invalid: { kind: "invalid-request", code: "ROLE", detail: `A scope names a role of ${NOTIFY_ROLES.join(", ")}.` },
      };
    }
    const typed = scope as NotifyScope;
    const grant = this.grantOf(String(request.actorRef), typed.tenantId);
    if (grant === undefined) {
      return {
        denied: { kind: "denied", code: "GRANT_DENIED", detail: `Actor ${String(request.actorRef)} holds no notification grant in tenant ${typed.tenantId} at the source. No row is returned.` },
      };
    }
    if (this.revoked.has(grant.grantRef)) {
      return {
        denied: { kind: "denied", code: "GRANT_REVOKED", detail: `The notification grant ${grant.grantRef} of ${String(request.actorRef)} in tenant ${typed.tenantId} was revoked at the source. No row is returned.` },
      };
    }
    return { grant };
  }

  read(request: NotifyReadRequest): Promise<NotifyReadOutcome> {
    this.counts.reads += 1;
    if (this.scenario === "read-lost") {
      return Promise.reject(new Error("The answer to the read never arrived."));
    }
    return Promise.resolve(this.readNow(request));
  }

  readInquiry(request: NotifyInquiryRequest): Promise<NotifyInquiryOutcome> {
    this.counts.inquiries += 1;
    return Promise.resolve(this.inquiryNow(request));
  }

  act(request: NotifyActRequest): Promise<NotifyActOutcome> {
    this.counts.acts += 1;
    const outcome = this.actNow(request);
    if (this.scenario === "act-lost" && outcome.kind === "applied") {
      // The request took effect at the source. Its answer never arrives.
      return Promise.reject(new Error("The answer to the request never arrived."));
    }
    return Promise.resolve(outcome);
  }

  private readNow(request: NotifyReadRequest): NotifyReadOutcome {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return { kind: "tuple-changed", field: tuple.field, expected: tuple.expected, actual: tuple.actual };
    }
    const gated = this.gate(request);
    if ("invalid" in gated) {
      return gated.invalid;
    }
    if ("denied" in gated) {
      return gated.denied;
    }
    const grant = gated.grant;
    const scope: NotifyScope = { tenantId: grant.tenantId, role: (request.scope as NotifyScope).role };
    const current = this.generationOf(grant.grantRef);
    if (request.grantFloor !== null && request.grantFloor !== undefined) {
      if (!isGeneration(request.grantFloor)) {
        return { kind: "invalid-request", code: "GENERATION", detail: "The grant floor is a whole generation number." };
      }
      if (request.grantFloor < current) {
        return { kind: "generation-stale", expected: request.grantFloor, actual: current };
      }
    }
    if (request.watermarkFloor !== null && request.watermarkFloor !== undefined && Number.isNaN(Date.parse(request.watermarkFloor))) {
      return { kind: "invalid-request", code: "FLOOR", detail: "The watermark floor is not an instant." };
    }
    const capabilities = notifyCapabilities(scope.role);
    if (!capabilities.includes("read-inbox")) {
      return {
        kind: "denied",
        code: "RESOURCE_DENIED",
        detail: `Role ${scope.role} holds no read-inbox capability at the source. The control being absent on screen is not what denies it.`,
      };
    }
    this.snapshotSerial += 1;
    const watermark = this.scenario === "stale" ? NOTIFY_STALE_WATERMARK : NOTIFY_AS_OF;
    const floor = request.watermarkFloor ?? (this.scenario === "stale" ? NOTIFY_STALE_FLOOR : null);
    if (floor !== null && Date.parse(watermark) < Date.parse(floor)) {
      return { kind: "stale", watermark, floor };
    }
    const focused = this.focusFor(request.focusRef ?? null, scope, String(request.actorRef), capabilities);
    if ("denied" in focused) {
      return focused.denied;
    }
    if ("invalid" in focused) {
      return focused.invalid;
    }
    const rows = this.inboxFor(scope, String(request.actorRef), current, capabilities);
    const deduped = this.dedupe(rows);
    if (this.scenario === "empty" || deduped.rows.length === 0) {
      return { kind: "empty", watermark, snapshotId: this.snapshotSerial, scope: { ...scope } };
    }
    const snapshot: NotifySnapshot = {
      snapshotId: this.snapshotSerial,
      watermark,
      scenario: this.scenario,
      scope: { ...scope },
      actorRef: String(request.actorRef),
      grantRef: grant.grantRef,
      grantGeneration: current,
      capabilities,
      notifications: deduped.rows,
      unreadCount: deduped.rows.filter((row) => !row.read).length,
      droppedDuplicates: deduped.dropped,
      focus: focused.focus,
      nonClaims: this.nonClaims(),
    };
    const refused = refuseNotifySnapshot(snapshot);
    if (refused !== null) {
      return refused;
    }
    return { kind: "ready", snapshot };
  }

  private nonClaims(): NotifyNonClaims {
    if (this.scenario === "claims-arrival") {
      return { ...NON_CLAIMS, arrivalConfirmsEffect: true } as unknown as NotifyNonClaims;
    }
    if (this.scenario === "external-wired") {
      return { ...NON_CLAIMS, externalSendWired: true } as unknown as NotifyNonClaims;
    }
    return { ...NON_CLAIMS };
  }

  /** Rows for this subject in this tenant, mapped to the read's own shape. */
  private inboxFor(
    scope: NotifyScope,
    actorRef: string,
    grantGeneration: number,
    capabilities: readonly NotifyCapability[],
  ): NotifyNotification[] {
    const seeds: readonly SeedNotification[] = [...SEED_NOTIFICATIONS, ...this.delivered];
    const feed = seeds.filter((row) => row.tenantId === scope.tenantId && row.subjectRef === actorRef);
    const canSensitive = capabilities.includes("read-sensitive");
    const rows = feed.map((row) => this.rowFor(row, grantGeneration, canSensitive));
    if (this.scenario === "tenant-mix") {
      const leaked = SEED_NOTIFICATIONS.find((row) => row.tenantId === TENANT_FOREIGN);
      if (leaked !== undefined) {
        rows.push(this.rowFor(leaked, grantGeneration, canSensitive));
      }
    }
    if (this.scenario === "subject-mix") {
      const leaked = SEED_NOTIFICATIONS.find((row) => row.tenantId === scope.tenantId && row.subjectRef !== actorRef);
      if (leaked !== undefined) {
        rows.push(this.rowFor(leaked, grantGeneration, canSensitive));
      }
    }
    if (this.scenario === "duplicate" && rows.length > 0) {
      // A second delivery of the first row's dedupe key. Dedupe drops it; the
      // snapshot counts the drop and lists one row.
      const first = rows[0]!;
      rows.push({ ...first, notificationRef: notifyRefFor("notification", 9999), seq: first.seq + 40 });
    }
    if (this.scenario === "kind-uncontracted") {
      const uncontracted: SeedNotification = {
        notificationRef: "ntf-0060",
        tenantId: scope.tenantId,
        subjectRef: actorRef,
        kind: "blast-uncontracted",
        dedupeKey: "evt-blast-0060",
        seq: 60,
        issueGeneration: grantGeneration,
        issuedAt: "2026-10-12T11:00:00.000Z",
        read: false,
        sensitive: false,
        headline: "An event kind the producer contract does not name.",
        detail: "Never projected.",
        offer: null,
      };
      rows.push(this.rowFor(uncontracted, grantGeneration, canSensitive));
    }
    return rows;
  }

  /** The read's own shape of a feed row: withheld detail, issue state, read flag. */
  private rowFor(seed: SeedNotification, grantGeneration: number, canSensitive: boolean): NotifyNotification {
    const leak = this.scenario === "sensitive-leak" && seed.sensitive && !canSensitive;
    const withhold = seed.sensitive && !canSensitive && !leak;
    return {
      notificationRef: seed.notificationRef,
      tenantId: seed.tenantId,
      subjectRef: seed.subjectRef,
      kind: seed.kind as NotifyEventKind,
      dedupeKey: seed.dedupeKey,
      seq: seed.seq,
      issueGeneration: seed.issueGeneration,
      issuedAt: seed.issuedAt,
      read: seed.read || this.readSet.has(seed.notificationRef),
      sensitive: seed.sensitive,
      headline: seed.headline,
      detail: withhold ? null : seed.detail,
      detailState: withhold ? "withheld" : "shown",
      issueState: seed.issueGeneration < grantGeneration ? "stale-issue" : "current",
      offer: seed.offer === null ? null : { ...seed.offer },
    };
  }

  /** Dedupe on the source's own key. First delivery wins; the drop is counted. */
  private dedupe(rows: NotifyNotification[]): { rows: NotifyNotification[]; dropped: number } {
    const seen = new Set<string>();
    const kept: NotifyNotification[] = [];
    let dropped = 0;
    for (const row of [...rows].sort((a, b) => a.seq - b.seq)) {
      if (seen.has(row.dedupeKey)) {
        dropped += 1;
        continue;
      }
      seen.add(row.dedupeKey);
      kept.push(row);
    }
    return { rows: kept, dropped };
  }

  /** Resolves a deep-open ref. Anything else is denied, not empty. */
  private focusFor(
    focusRef: string | null,
    scope: NotifyScope,
    actorRef: string,
    capabilities: readonly NotifyCapability[],
  ): { focus: NotifyFocus | null } | { denied: NotifyDenied } | { invalid: NotifyInvalid } {
    if (focusRef === null) {
      return { focus: null };
    }
    const kind = notifyRefKind(focusRef);
    if (kind === null || kind !== "notification") {
      return { invalid: { kind: "invalid-request", code: "REF", detail: `${focusRef} is not a notification reference.` } };
    }
    const seeds: readonly SeedNotification[] = [...SEED_NOTIFICATIONS, ...this.delivered];
    const found = seeds.find((row) => row.notificationRef === focusRef);
    if (found === undefined) {
      return { denied: { kind: "denied", code: "RESOURCE_DENIED", detail: `The source holds no notification ${focusRef}.` } };
    }
    if (found.tenantId !== scope.tenantId) {
      return {
        denied: { kind: "denied", code: "RESOURCE_DENIED", detail: `Notification ${focusRef} belongs to another tenant. No row is returned, and no row of this tenant stands in for it.` },
      };
    }
    if (found.subjectRef !== actorRef) {
      return { denied: { kind: "denied", code: "RESOURCE_DENIED", detail: `Notification ${focusRef} belongs to another subject.` } };
    }
    const grant = this.grantOf(actorRef, scope.tenantId);
    const generation = grant === undefined ? 1 : this.generationOf(grant.grantRef);
    return { focus: { kind: "notification", row: this.rowFor(found, generation, capabilities.includes("read-sensitive")) } };
  }

  private inquiryNow(request: NotifyInquiryRequest): NotifyInquiryOutcome {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return { kind: "tuple-changed", field: tuple.field, expected: tuple.expected, actual: tuple.actual };
    }
    const gated = this.gate(request);
    if ("invalid" in gated) {
      return gated.invalid;
    }
    if ("denied" in gated) {
      return gated.denied;
    }
    const scope = request.scope as NotifyScope;
    if (!isNotifyRef(request.inquiryRef, "inquiry")) {
      return { kind: "invalid-request", code: "REF", detail: `${String(request.inquiryRef)} is not an inquiry reference.` };
    }
    if (this.scenario === "inquiry-denied" || !notifyCapabilities(scope.role).includes("read-inquiry")) {
      return {
        kind: "denied",
        code: "INQUIRY_DENIED",
        detail: "The source grants this role the inbox read and no inquiry material. No material is returned.",
      };
    }
    const found = SEED_INQUIRIES.find((row) => row.inquiryRef === request.inquiryRef);
    if (found === undefined || found.tenantId !== scope.tenantId || found.subjectRef !== String(request.actorRef)) {
      return {
        kind: "denied",
        code: "RESOURCE_DENIED",
        detail: `The source holds no inquiry ${request.inquiryRef} for this subject in this tenant.`,
      };
    }
    const lines =
      this.scenario === "inquiry-leak"
        ? [...found.lines, { label: "Contact", text: "Reach the member at member@example.test." }]
        : found.lines;
    const inquiry: NotifyInquiry = {
      inquiryRef: found.inquiryRef,
      notificationRef: found.notificationRef,
      tenantId: found.tenantId,
      subjectRef: found.subjectRef,
      declaration: { provenance: "synthetic", realPersonalData: false, deliveredExternally: false, authorityRecord: false },
      lines,
    };
    const refused = refuseNotifyInquiry(inquiry, scope, String(request.actorRef));
    if (refused !== null) {
      return refused;
    }
    return { kind: "ready", inquiry };
  }

  private actNow(request: NotifyActRequest): NotifyActOutcome {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return { kind: "tuple-changed", field: tuple.field, expected: tuple.expected, actual: tuple.actual };
    }
    const gated = this.gate(request);
    if ("invalid" in gated) {
      return gated.invalid;
    }
    if ("denied" in gated) {
      return gated.denied;
    }
    const grant = gated.grant;
    const scope = request.scope as NotifyScope & { grantGeneration: number };
    const action = request.action as Partial<NotifyActionRequest> | null | undefined;
    if (action === null || action === undefined || !includes(NOTIFY_ACTION_KINDS, action.kind)) {
      return { kind: "invalid-request", code: "ACTION", detail: `An action is one of ${NOTIFY_ACTION_KINDS.join(", ")}.` };
    }
    const current = this.generationOf(grant.grantRef);
    if (!isGeneration(scope.grantGeneration)) {
      return { kind: "invalid-request", code: "GENERATION", detail: "A request carries the grant generation it was built under." };
    }
    if (scope.grantGeneration !== current) {
      return {
        kind: "rejected",
        code: "GENERATION_STALE",
        detail: `The notification grant moved to generation ${current} at the source. The request was built under ${scope.grantGeneration}. Nothing is recorded.`,
      };
    }
    if (!isNotifyRef(action.notificationRef, "notification")) {
      return { kind: "invalid-request", code: "REF", detail: `${String(action.notificationRef)} is not a notification reference.` };
    }
    const capabilities = notifyCapabilities(scope.role);
    const needed: NotifyCapability = action.kind === "mark-read" ? "mark-read" : "resolve-action";
    if (!capabilities.includes(needed)) {
      return { kind: "rejected", code: "NO_CAPABILITY", detail: `Role ${scope.role} holds no ${needed} capability at the source.` };
    }
    const seeds: readonly SeedNotification[] = [...SEED_NOTIFICATIONS, ...this.delivered];
    const found = seeds.find(
      (row) => row.notificationRef === action.notificationRef && row.tenantId === scope.tenantId && row.subjectRef === String(request.actorRef),
    );
    if (found === undefined) {
      return {
        kind: "rejected",
        code: "UNKNOWN_NOTIFICATION",
        detail: `The source holds no notification ${action.notificationRef} for this subject in this tenant.`,
      };
    }
    if (action.kind === "mark-read") {
      return this.markReadNow(found, current);
    }
    return this.resolveNow(found, current);
  }

  private markReadNow(seed: SeedNotification, generation: number): NotifyActOutcome {
    const alreadyRead = seed.read || this.readSet.has(seed.notificationRef);
    if (alreadyRead) {
      return {
        kind: "rejected",
        code: "ALREADY_READ",
        detail: `Notification ${seed.notificationRef} is already marked read at the source. A second mark records nothing.`,
      };
    }
    this.readSet.add(seed.notificationRef);
    return this.answer(
      { kind: "read-marked", notificationRef: seed.notificationRef, destination: null, checkedGeneration: generation },
      "mark-read",
    );
  }

  private resolveNow(seed: SeedNotification, generation: number): NotifyActOutcome {
    if (seed.issueGeneration < generation) {
      return {
        kind: "rejected",
        code: "STALE_ISSUE",
        detail: `Notification ${seed.notificationRef} was issued under grant generation ${seed.issueGeneration}; the source holds ${generation}. A stale notification's action resolves nothing — it does not skip the current-generation check.`,
      };
    }
    if (seed.offer === null) {
      return {
        kind: "rejected",
        code: "OFFER_MISSING",
        detail: `Notification ${seed.notificationRef} offers no action.`,
      };
    }
    const destination: NotifyDestination =
      seed.offer.kind === "open-authority"
        ? { kind: "authority", ref: seed.offer.ref }
        : { kind: "support", inquiryRef: seed.offer.inquiryRef };
    if (destination.kind === "support" && !SEED_INQUIRIES.some((row) => row.inquiryRef === destination.inquiryRef)) {
      return {
        kind: "rejected",
        code: "UNKNOWN_INQUIRY",
        detail: `The source holds no inquiry ${destination.inquiryRef}.`,
      };
    }
    return this.answer({ kind: "resolved", notificationRef: seed.notificationRef, destination, checkedGeneration: generation }, "resolve");
  }

  /** Builds the answer, and refuses it when it claims anything a request cannot mean. */
  private answer(base: Omit<NotifyReceipt, "confirmsEconomicEffect" | "externalSendWired">, actionKind: NotifyActionKind): NotifyActOutcome {
    const claims = this.scenario === "resolve-claims" && base.kind === "resolved";
    const receipt = { ...base, confirmsEconomicEffect: claims, externalSendWired: false } as unknown as NotifyReceipt;
    const refused = refuseNotifyReceipt(receipt, { kind: actionKind, notificationRef: base.notificationRef });
    if (refused !== null) {
      return refused;
    }
    return { kind: "applied", receipt };
  }
}
