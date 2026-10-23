import {
  DISCOVERY_PROJECTION_AS_OF,
  DISCOVERY_READ_TUPLE_LITERALS,
  checkDiscoveryReadTuple,
  type DiscoveryReadTuple,
} from "./discovery-read.js";
import { PLATFORM_HOLD_NOT_BOUND, PLATFORM_NOT_COMPOSED } from "./platform-journey.js";

/**
 * Synthetic tenant permissions source: organizations, people, role assignments,
 * resource scopes, maker/checker proposals, permission revocation, an account
 * change, a sensitive export, and the audit record.
 *
 * This is the stub-scope stand-in for a producer. The real connection stays pending
 * on kix-protocol:k-operator-contract; pending node c-tenant-permissions keeps it.
 * The contract-only catalogue has no read command for an organization, a role
 * assignment, an account, a support case, an audit entry, or a sensitive export,
 * and no command that grants or revokes a permission. No producer tuple exists, so
 * the desk is NOT_BOUND on integration-http. No domain producer SDK, manifest, or vector is
 * consumed, and this module sends nothing over a network.
 *
 * Nothing here composes a catalogue command: no money posting is sent, and the
 * not-composed record below only quotes why.
 *
 * Rules, all enforced here and not only in copy:
 *  - A request names a tenant, an actor, and a role. The actor string and the role
 *    string are context labels, not an authentication result. The source decides
 *    access with its own synthetic assignments.
 *  - A role decides which resource kinds a read returns. A buyer sees its own
 *    orders and its own membership. A read-tenant role sees the tenant's rows of
 *    its own kinds. The audit record goes only to a role that holds read-audit.
 *  - A row from another tenant, or a row owned by another subject, refuses the
 *    whole payload before anything is shown.
 *  - A change is a proposal. A different actor approves it, and the approval is a
 *    record: the account and the member rows change only when the source applies
 *    them later. No actor here holds the authority to change them directly.
 *  - A role assignment carries a generation. A write built under an older
 *    generation is rejected as role-stale, and a read under an older floor is
 *    stale. A revoked assignment denies every read, export, and write.
 *  - The export is the source's own file. It carries a scope declaration that
 *    says synthetic, no real personal data, not shared outside the tenant, and
 *    not an authority record. A payload that says anything else is refused
 *    before a row is returned.
 *  - Hiding a control is not enforcement. The port checks every request against
 *    the assignment and the capability, and a denied or rejected call is
 *    recorded in the audit trail.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const TENANT_PERMISSIONS_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const TENANT_NOT_BOUND_REASON =
  "No current producer tuple exists for tenant permissions: kix-protocol:k-operator-contract is not merged and pending node c-tenant-permissions is not promoted. The contract-only catalogue has no read command for an organization, a role assignment, an account, a support case, an audit entry, or a sensitive export, and no command that grants or revokes a permission. The permissions desk stays NOT_BOUND on integration-http.";

export const TENANT_PROJECTION_NAME = "kix.tenant.permissions";

/** What a producer connection would need. All of it is absent, so every connection claim is false. */
export const TENANT_PRODUCER_TUPLE = {
  bound: false,
  status: "NOT_BOUND",
  sdkDigest: null,
  manifestDigest: null,
  vectorDigest: null,
  waitingOn: ["kix-protocol:k-operator-contract", "c-tenant-permissions"],
} as const;

/** Fixed instant the synthetic source claims to be built at. */
export const TENANT_AS_OF = DISCOVERY_PROJECTION_AS_OF;

/** Watermark the stale scenario serves, and the floor a reader holds against it. */
export const TENANT_STALE_WATERMARK = "2026-10-10T00:00:00.000Z";
export const TENANT_STALE_FLOOR = "2026-10-12T00:00:00.000Z";

/** The organization the desk actors belong to, and one they do not. */
export const TENANT_OWN = "ten-0001";
export const TENANT_FOREIGN = "ten-0002";
export const TENANT_KNOWN = [TENANT_OWN, TENANT_FOREIGN] as const;

/** Quote of the locked hold binding. H1 keeps this consideredAction and keeps it not-bound. */
export const TENANT_HOLD_NOT_BOUND = PLATFORM_HOLD_NOT_BOUND;

/** Catalogue commands this module records and does not send. Nothing is composed here at all. */
export const TENANT_NOT_COMPOSED = PLATFORM_NOT_COMPOSED;

// ---------------------------------------------------------------------------
// People and roles. A person string is a context label, not an authentication
// result. An assignment is the source's own record of which role a person holds
// in which tenant, at which generation.
// ---------------------------------------------------------------------------

/** The desk people. Each string is a label only. */
export const TENANT_BUYER_ACTOR = "person-buyer";
export const TENANT_ORGANIZER_ACTOR = "person-organizer";
export const TENANT_SETTLER_ACTOR = "person-settler";
export const TENANT_SUPPORT_ACTOR = "person-support";
/** One person holding two assignments in the same tenant: organizer and support. */
export const TENANT_DUAL_ACTOR = "person-dual";
/** An organizer of the foreign tenant. It holds nothing in the own tenant. */
export const TENANT_FOREIGN_ACTOR = "person-foreign";
/** A person with no assignment anywhere. */
export const TENANT_UNASSIGNED_ACTOR = "person-unassigned";

export const TENANT_ACTORS = [
  TENANT_BUYER_ACTOR,
  TENANT_ORGANIZER_ACTOR,
  TENANT_SETTLER_ACTOR,
  TENANT_SUPPORT_ACTOR,
  TENANT_DUAL_ACTOR,
  TENANT_FOREIGN_ACTOR,
  TENANT_UNASSIGNED_ACTOR,
] as const;
export type TenantActor = (typeof TENANT_ACTORS)[number];

/** The four desk roles: buyer, organizer, settlement staff, support staff. */
export const TENANT_ROLES = ["buyer", "organizer", "settler", "support"] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

/**
 * What a role may do. Read-own, read-tenant, and read-audit stay separate, and
 * each maker and checker capability names the one change kind it covers.
 */
export const TENANT_CAPABILITIES = [
  "read-own",
  "read-tenant",
  "read-audit",
  "propose-account-change",
  "propose-role-revoke",
  "approve-change",
  "export-sensitive",
] as const;
export type TenantCapability = (typeof TENANT_CAPABILITIES)[number];

const ROLE_CAPABILITIES: Readonly<Record<TenantRole, readonly TenantCapability[]>> = {
  buyer: ["read-own"],
  organizer: ["read-own", "read-tenant", "approve-change"],
  settler: ["read-own", "read-tenant", "propose-account-change", "export-sensitive"],
  support: ["read-own", "read-tenant", "read-audit", "propose-role-revoke"],
};

/** The capabilities a role holds. An unknown role holds none. */
export function tenantCapabilities(role: string): readonly TenantCapability[] {
  return (ROLE_CAPABILITIES as Record<string, readonly TenantCapability[]>)[role] ?? [];
}

/** The two sensitive change kinds. Each has one maker role and one checker role. */
export const TENANT_CHANGE_KINDS = ["account-change", "role-revoke"] as const;
export type TenantChangeKind = (typeof TENANT_CHANGE_KINDS)[number];

/** The maker capability a change kind needs at the source. */
export const TENANT_MAKER_CAPABILITY: Readonly<Record<TenantChangeKind, TenantCapability>> = {
  "account-change": "propose-account-change",
  "role-revoke": "propose-role-revoke",
};

/** The checker capability every approval needs. A different actor approves than proposed. */
export const TENANT_CHECKER_CAPABILITY: TenantCapability = "approve-change";

/** The target ref kind a change kind names. */
export const TENANT_CHANGE_TARGET_KIND: Readonly<Record<TenantChangeKind, "account" | "member">> = {
  "account-change": "account",
  "role-revoke": "member",
};

/** What a person may do on this desk. The export and the audit read stay their own rows. */
export interface TenantAuthorityRow {
  capability: TenantCapability;
  heldBy: readonly TenantRole[];
}

export function tenantAuthorityTable(): readonly TenantAuthorityRow[] {
  return TENANT_CAPABILITIES.map((capability) => ({
    capability,
    heldBy: TENANT_ROLES.filter((role) => ROLE_CAPABILITIES[role].includes(capability)),
  }));
}

// ---------------------------------------------------------------------------
// Resource kinds and the role visibility the source enforces.
// ---------------------------------------------------------------------------

export const TENANT_RESOURCE_KINDS = ["member", "order", "event", "account", "case", "proposal", "audit"] as const;
export type TenantResourceKind = (typeof TENANT_RESOURCE_KINDS)[number];

/** The resource kinds a role's workspace may list. Anything else stays absent, not hidden. */
export const TENANT_ROLE_RESOURCES: Readonly<Record<TenantRole, readonly TenantResourceKind[]>> = {
  buyer: ["member", "order"],
  organizer: ["member", "event", "proposal"],
  settler: ["member", "account", "proposal"],
  support: ["member", "case", "proposal", "audit"],
};

export function tenantRoleResources(role: string): readonly TenantResourceKind[] {
  return (TENANT_ROLE_RESOURCES as Record<string, readonly TenantResourceKind[]>)[role] ?? [];
}

/** The change kinds whose proposals a role may see in the last read. */
export const TENANT_PROPOSAL_READER_ROLES: readonly TenantRole[] = ["organizer", "settler", "support"];

// ---------------------------------------------------------------------------
// Codes and enums.
// ---------------------------------------------------------------------------

export const TENANT_DENIED_CODES = [
  "TENANT_DENIED",
  "ROLE_DENIED",
  "ROLE_REVOKED",
  "RESOURCE_DENIED",
  "EXPORT_DENIED",
] as const;
export type TenantDeniedCode = (typeof TENANT_DENIED_CODES)[number];

export const TENANT_REFUSAL_CODES = ["CLAIM", "KIND", "STATE", "REF", "SCOPE_LEAK", "SUBJECT_LEAK"] as const;
export type TenantRefusalCode = (typeof TENANT_REFUSAL_CODES)[number];

export const TENANT_INVALID_CODES = [
  "CONTEXT",
  "ACTOR",
  "SCOPE",
  "ROLE",
  "FLOOR",
  "GENERATION",
  "ACTION",
  "REF",
  "TEXT",
] as const;
export type TenantInvalidCode = (typeof TENANT_INVALID_CODES)[number];

export const TENANT_REJECTION_CODES = [
  "NO_CAPABILITY",
  "SELF_APPROVAL",
  "UNKNOWN_RESOURCE",
  "UNKNOWN_PROPOSAL",
  "NOT_PENDING",
  "DUPLICATE_PENDING",
  "ROLE_STALE",
  "TARGET_STATE",
] as const;
export type TenantRejectionCode = (typeof TENANT_REJECTION_CODES)[number];

export const TENANT_MEMBER_STATES = ["active", "revoked"] as const;
export type TenantMemberState = (typeof TENANT_MEMBER_STATES)[number];

export const TENANT_ORDER_STATES = ["placed", "cancelled"] as const;
export type TenantOrderState = (typeof TENANT_ORDER_STATES)[number];

export const TENANT_EVENT_STATES = ["on-sale", "closed"] as const;
export type TenantEventState = (typeof TENANT_EVENT_STATES)[number];

export const TENANT_ACCOUNT_STATES = ["active", "changed-by-source"] as const;
export type TenantAccountState = (typeof TENANT_ACCOUNT_STATES)[number];

export const TENANT_CASE_STATES = ["open", "answered"] as const;
export type TenantCaseState = (typeof TENANT_CASE_STATES)[number];

/** pending, approval recorded, closed rejected by the source, or applied by the source. */
export const TENANT_PROPOSAL_STATES = ["pending", "approval-recorded", "rejected", "applied-by-source"] as const;
export type TenantProposalState = (typeof TENANT_PROPOSAL_STATES)[number];

export const TENANT_ACTION_KINDS = ["propose-account-change", "propose-role-revoke", "approve-proposal"] as const;
export type TenantActionKind = (typeof TENANT_ACTION_KINDS)[number];

export const TENANT_AUDIT_DECISIONS = ["allowed", "denied", "rejected", "refused"] as const;
export type TenantAuditDecision = (typeof TENANT_AUDIT_DECISIONS)[number];

export const TENANT_AUDIT_ACTIONS = ["read", "export", ...TENANT_ACTION_KINDS] as const;
export type TenantAuditAction = (typeof TENANT_AUDIT_ACTIONS)[number];

export const TENANT_SYNTHETIC_CONTROLS = ["revoke-role", "rotate-role", "apply-approved-change"] as const;
export type TenantSyntheticControl = (typeof TENANT_SYNTHETIC_CONTROLS)[number];

/**
 * Claims the source states as the literal false, on every read. A missing field
 * counts: the source has to say it, and silence is not a no.
 */
export const TENANT_NON_CLAIM_FIELDS = [
  "uiHidingIsEnforcement",
  "actorIsAuthenticated",
  "exportHasRealPersonalData",
  "approvalChangesResource",
  "crossTenantAccess",
  "auditIsCompleteRecord",
] as const;
export type TenantNonClaimField = (typeof TENANT_NON_CLAIM_FIELDS)[number];
export type TenantNonClaims = Readonly<Record<TenantNonClaimField, false>>;

export const TENANT_SCENARIOS = [
  "clean",
  "empty",
  "stale",
  "denied",
  "tenant-mix",
  "subject-mix",
  "role-rotated",
  "proposal-pending",
  "self-approval",
  "claims-enforced",
  "audit-leak",
  "read-lost",
  "act-lost",
  "export-denied",
  "export-leak",
  "export-claims-real",
  "approve-claims-applied",
] as const;
export type TenantScenario = (typeof TENANT_SCENARIOS)[number];

// ---------------------------------------------------------------------------
// Identity. Each kind has its own prefix and one kind is never read as another.
// ---------------------------------------------------------------------------

export const TENANT_REF_KINDS = ["member", "order", "event", "account", "case", "proposal", "audit", "export"] as const;
export type TenantRefKind = (typeof TENANT_REF_KINDS)[number];

const REF_PREFIX: Readonly<Record<TenantRefKind, string>> = {
  member: "mbr-",
  order: "ord-",
  event: "evn-",
  account: "acc-",
  case: "tck-",
  proposal: "ppr-",
  audit: "aud-",
  export: "tpx-",
};

const REF_PATTERN = /^(mbr|ord|evn|acc|tck|ppr|aud|tpx)-[0-9]{4}$/;

export function tenantRefFor(kind: TenantRefKind, serial: number): string {
  return `${REF_PREFIX[kind]}${String(serial).padStart(4, "0")}`;
}

export function tenantRefKind(ref: string): TenantRefKind | null {
  if (!REF_PATTERN.test(ref)) {
    return null;
  }
  for (const kind of TENANT_REF_KINDS) {
    if (ref.startsWith(REF_PREFIX[kind])) {
      return kind;
    }
  }
  return null;
}

export function isTenantRef(ref: unknown, kind: TenantRefKind): ref is string {
  return typeof ref === "string" && tenantRefKind(ref) === kind;
}

// ---------------------------------------------------------------------------
// Read model shapes
// ---------------------------------------------------------------------------

/** The scope every call carries: the tenant, and the role the actor acts under. */
export interface TenantScope {
  tenantId: string;
  role: TenantRole;
}

interface TenantRowBase {
  tenantId: string;
}

/** A role assignment. The generation moves when the source rotates or revokes it. */
export interface TenantMember extends TenantRowBase {
  memberRef: string;
  actorRef: string;
  role: TenantRole;
  generation: number;
  state: TenantMemberState;
}

/** A buyer's own order row. Only its own subject sees it. */
export interface TenantOrder extends TenantRowBase {
  orderRef: string;
  subjectRef: string;
  eventRef: string;
  state: TenantOrderState;
  label: string;
}

/** An event row the organizer's workspace lists. */
export interface TenantEventRow extends TenantRowBase {
  eventRef: string;
  title: string;
  state: TenantEventState;
}

/**
 * A settlement account row the settler's workspace lists. The account tail is the
 * source's own synthetic text. A change to it arrives only through a proposal the
 * source later applies; nothing on this desk edits it.
 */
export interface TenantAccount extends TenantRowBase {
  accountRef: string;
  label: string;
  /** Synthetic tail text. Not a real account number. */
  accountTail: string;
  state: TenantAccountState;
}

/** A support case row the support workspace lists. */
export interface TenantCase extends TenantRowBase {
  caseRef: string;
  subjectRef: string;
  topic: string;
  state: TenantCaseState;
}

/**
 * A sensitive-change proposal. Pending is not applied, an approval is a record,
 * and only the source applying it changes the target row.
 */
export interface TenantProposal extends TenantRowBase {
  proposalRef: string;
  kind: TenantChangeKind;
  targetRef: string;
  note: string;
  proposedBy: string;
  /** The role the proposing actor acted under. */
  proposedAs: TenantRole;
  state: TenantProposalState;
  /** The source never claims a recorded proposal changed the resource. */
  resourceChanged: false;
}

/** The source's own record of one decision it made on a call. */
export interface TenantAuditEntry extends TenantRowBase {
  auditRef: string;
  seq: number;
  actorRef: string;
  role: string;
  action: TenantAuditAction;
  targetRef: string | null;
  decision: TenantAuditDecision;
  detail: string;
}

export interface TenantSnapshot {
  /** Read serial on this port. It orders reads and is not a commit position. */
  snapshotId: number;
  watermark: string;
  scenario: TenantScenario;
  scope: TenantScope;
  actorRef: string;
  /** The generation of the actor's assignment as of this read. */
  roleGeneration: number;
  /** The resource kinds this role's workspace may list. */
  visibleKinds: readonly TenantResourceKind[];
  members: readonly TenantMember[];
  orders: readonly TenantOrder[];
  events: readonly TenantEventRow[];
  accounts: readonly TenantAccount[];
  cases: readonly TenantCase[];
  proposals: readonly TenantProposal[];
  audit: readonly TenantAuditEntry[];
  /** The deep-linked resource when the read asked for one, or null. */
  focus: TenantFocus | null;
  /** The literal false for each claim field, or the whole payload is refused. */
  nonClaims: TenantNonClaims;
}

/** One deep-opened resource. The shape is the row's own; the page copies it. */
export type TenantFocus =
  | { kind: "member"; row: TenantMember }
  | { kind: "order"; row: TenantOrder }
  | { kind: "event"; row: TenantEventRow }
  | { kind: "account"; row: TenantAccount }
  | { kind: "case"; row: TenantCase }
  | { kind: "proposal"; row: TenantProposal }
  | { kind: "audit"; row: TenantAuditEntry };

export interface TenantExportRow {
  entryRef: string;
  entryKind: "member" | "account";
  /** Synthetic text only. Never a real personal field. */
  label: string;
  detail: string;
}

/** What the export says about its own scope. A payload that says otherwise is refused. */
export interface TenantExportScope {
  provenance: "synthetic";
  realPersonalData: false;
  sharedOutsideTenant: false;
  authorityRecord: false;
  target: "none";
}

/** A sensitive export. The client compares it with the last read and never repairs it. */
export interface TenantExport {
  exportRef: string;
  scope: TenantScope;
  watermark: string;
  declaredRowCount: number;
  complete: boolean;
  digest: string | null;
  scopeDeclaration: TenantExportScope;
  rows: readonly TenantExportRow[];
}

export interface TenantReadRequest {
  contextKey: string;
  actorRef: string;
  scope: TenantScope;
  /** A deep-open: the resource ref the URL or the open control named. */
  focusRef: string | null;
  /** The assignment generation the caller's view was built under, or null for a first read. */
  roleFloor: number | null;
  watermarkFloor: string | null;
}

export interface TenantExportRequest {
  contextKey: string;
  actorRef: string;
  scope: TenantScope;
}

export type TenantActionRequest =
  | { kind: "propose-account-change"; accountRef: string; note: string }
  | { kind: "propose-role-revoke"; memberRef: string; note: string }
  | { kind: "approve-proposal"; proposalRef: string };

export interface TenantActRequest {
  contextKey: string;
  actorRef: string;
  /** The scope plus the assignment generation the write was built under. */
  scope: TenantScope & { roleGeneration: number };
  action: TenantActionRequest;
}

/** What the source answers to a request. Both records say no resource changed. */
export interface TenantReceipt {
  kind: "proposal-recorded" | "approval-recorded";
  proposalRef: string;
  targetRef: string;
  changeKind: TenantChangeKind;
  resourceChanged: false;
  approvalChangesResource: false;
}

export type TenantTupleChanged = { kind: "tuple-changed"; field: string; expected: string; actual: string };

export type TenantDenied = { kind: "denied"; code: TenantDeniedCode; detail: string };

export type TenantRefused = { kind: "refused"; code: TenantRefusalCode; field: string; ref: string | null; detail: string };

export type TenantInvalid = { kind: "invalid-request"; code: TenantInvalidCode; detail: string };

/** The caller's role floor is behind the assignment the source holds now. */
export type TenantRoleStale = { kind: "role-stale"; expected: number; actual: number };

export type TenantReadOutcome =
  | { kind: "ready"; snapshot: TenantSnapshot }
  | { kind: "empty"; watermark: string; snapshotId: number; scope: TenantScope }
  | { kind: "stale"; watermark: string; floor: string }
  | TenantRoleStale
  | TenantDenied
  | TenantRefused
  | TenantInvalid
  | TenantTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export type TenantExportOutcome =
  | { kind: "ready"; export: TenantExport }
  | TenantDenied
  | TenantRefused
  | TenantInvalid
  | TenantTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export type TenantActOutcome =
  | { kind: "applied"; receipt: TenantReceipt }
  | { kind: "rejected"; code: TenantRejectionCode; detail: string }
  | TenantDenied
  | TenantRefused
  | TenantInvalid
  | TenantTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export interface TenantPermissionsPort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic-tenant-permissions" | "none";
  readonly scenario: TenantScenario;
  read(request: TenantReadRequest): Promise<TenantReadOutcome>;
  readExport(request: TenantExportRequest): Promise<TenantExportOutcome>;
  act(request: TenantActRequest): Promise<TenantActOutcome>;
  /**
   * Synthetic control: moves the source itself. A real producer offers none of
   * them. Returns false when there is no source to move or nothing for the
   * control to act on.
   */
  synthetic(control: TenantSyntheticControl, ref?: string): boolean;
}

export interface StubTenantPermissionsOptions {
  scenario?: TenantScenario;
  /** Expected tuple override. Used to stage a producer change in tests. */
  expectedTuple?: DiscoveryReadTuple;
}

export interface TenantEffectCounts {
  reads: number;
  exports: number;
  acts: number;
}

export function createStubTenantPermissions(options: StubTenantPermissionsOptions = {}): StubTenantPermissions {
  return new StubTenantPermissions(options);
}

export function createNotBoundTenantPermissions(): TenantPermissionsPort {
  const outcome = { kind: "not-bound", reason: TENANT_NOT_BOUND_REASON } as const;
  return {
    environment: "integration-http",
    source: "none",
    scenario: "clean",
    read() {
      return Promise.resolve({ ...outcome });
    },
    readExport() {
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

export function tenantPermissionsPortFor(
  environment: "stub" | "integration-http",
  options: StubTenantPermissionsOptions = {},
): TenantPermissionsPort {
  if (environment === "stub") {
    return createStubTenantPermissions(options);
  }
  return createNotBoundTenantPermissions();
}

// ---------------------------------------------------------------------------
// Pure checks. The port uses them before it returns a row, and the controller
// and the screen use them to say what a snapshot can and cannot support.
// ---------------------------------------------------------------------------

/** The first claim field that is not the literal false. A missing field counts. */
export function findTenantClaim(nonClaims: unknown): TenantNonClaimField | null {
  const record = (typeof nonClaims === "object" && nonClaims !== null ? nonClaims : {}) as Record<string, unknown>;
  for (const field of TENANT_NON_CLAIM_FIELDS) {
    if (record[field] !== false) {
      return field;
    }
  }
  return null;
}

function refuse(code: TenantRefusalCode, field: string, ref: string | null, detail: string): TenantRefused {
  return { kind: "refused", code, field, ref, detail };
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

function isGeneration(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function refuseMember(member: TenantMember, scope: TenantScope): TenantRefused | null {
  if (!isTenantRef(member.memberRef, "member")) {
    return refuse("REF", "members[].memberRef", String(member.memberRef), "A member is named by a member reference.");
  }
  if (member.tenantId !== scope.tenantId) {
    return refuse("SCOPE_LEAK", "members[].tenantId", member.memberRef, `Member ${member.memberRef} belongs to another tenant.`);
  }
  if (!includes(TENANT_ROLES, member.role) || !includes(TENANT_MEMBER_STATES, member.state)) {
    return refuse("KIND", "members[]", member.memberRef, "A member role or state is not a known value.");
  }
  if (!isGeneration(member.generation)) {
    return refuse("STATE", "members[].generation", member.memberRef, "A member generation is a whole number from 1.");
  }
  return null;
}

function refuseOrder(order: TenantOrder, scope: TenantScope, actorRef: string): TenantRefused | null {
  if (!isTenantRef(order.orderRef, "order")) {
    return refuse("REF", "orders[].orderRef", String(order.orderRef), "An order is named by an order reference.");
  }
  if (order.tenantId !== scope.tenantId) {
    return refuse("SCOPE_LEAK", "orders[].tenantId", order.orderRef, `Order ${order.orderRef} belongs to another tenant.`);
  }
  if (scope.role === "buyer" && order.subjectRef !== actorRef) {
    return refuse("SUBJECT_LEAK", "orders[].subjectRef", order.orderRef, `Order ${order.orderRef} belongs to another subject.`);
  }
  if (!includes(TENANT_ORDER_STATES, order.state)) {
    return refuse("KIND", "orders[].state", order.orderRef, "An order state is not a known value.");
  }
  return null;
}

function refuseEvent(row: TenantEventRow, scope: TenantScope): TenantRefused | null {
  if (!isTenantRef(row.eventRef, "event")) {
    return refuse("REF", "events[].eventRef", String(row.eventRef), "An event is named by an event reference.");
  }
  if (row.tenantId !== scope.tenantId) {
    return refuse("SCOPE_LEAK", "events[].tenantId", row.eventRef, `Event ${row.eventRef} belongs to another tenant.`);
  }
  if (!includes(TENANT_EVENT_STATES, row.state)) {
    return refuse("KIND", "events[].state", row.eventRef, "An event state is not a known value.");
  }
  return null;
}

function refuseAccount(row: TenantAccount, scope: TenantScope): TenantRefused | null {
  if (!isTenantRef(row.accountRef, "account")) {
    return refuse("REF", "accounts[].accountRef", String(row.accountRef), "An account is named by an account reference.");
  }
  if (row.tenantId !== scope.tenantId) {
    return refuse("SCOPE_LEAK", "accounts[].tenantId", row.accountRef, `Account ${row.accountRef} belongs to another tenant.`);
  }
  if (!includes(TENANT_ACCOUNT_STATES, row.state)) {
    return refuse("KIND", "accounts[].state", row.accountRef, "An account state is not a known value.");
  }
  if (typeof row.accountTail !== "string" || row.accountTail.trim().length === 0) {
    return refuse("STATE", "accounts[].accountTail", row.accountRef, "An account tail is the source's own text.");
  }
  return null;
}

function refuseCase(row: TenantCase, scope: TenantScope): TenantRefused | null {
  if (!isTenantRef(row.caseRef, "case")) {
    return refuse("REF", "cases[].caseRef", String(row.caseRef), "A case is named by a case reference.");
  }
  if (row.tenantId !== scope.tenantId) {
    return refuse("SCOPE_LEAK", "cases[].tenantId", row.caseRef, `Case ${row.caseRef} belongs to another tenant.`);
  }
  if (!includes(TENANT_CASE_STATES, row.state)) {
    return refuse("KIND", "cases[].state", row.caseRef, "A case state is not a known value.");
  }
  return null;
}

function refuseProposal(row: TenantProposal, scope: TenantScope): TenantRefused | null {
  if (!isTenantRef(row.proposalRef, "proposal")) {
    return refuse("REF", "proposals[].proposalRef", String(row.proposalRef), "A proposal is named by a proposal reference.");
  }
  if (row.tenantId !== scope.tenantId) {
    return refuse("SCOPE_LEAK", "proposals[].tenantId", row.proposalRef, `Proposal ${row.proposalRef} belongs to another tenant.`);
  }
  if (!includes(TENANT_CHANGE_KINDS, row.kind) || !includes(TENANT_PROPOSAL_STATES, row.state)) {
    return refuse("KIND", "proposals[]", row.proposalRef, "A proposal kind or state is not a known value.");
  }
  if (!includes(TENANT_ROLES, row.proposedAs)) {
    return refuse("KIND", "proposals[].proposedAs", row.proposalRef, "A proposal names the role its maker acted under.");
  }
  if (row.resourceChanged !== false) {
    return refuse("CLAIM", "proposals[].resourceChanged", row.proposalRef, "A recorded proposal claims its resource changed.");
  }
  const expectedKind = TENANT_CHANGE_TARGET_KIND[row.kind];
  if (tenantRefKind(row.targetRef) !== expectedKind) {
    return refuse("REF", "proposals[].targetRef", row.proposalRef, `A ${row.kind} proposal names a ${expectedKind} reference.`);
  }
  return null;
}

function refuseAudit(row: TenantAuditEntry, scope: TenantScope): TenantRefused | null {
  if (!isTenantRef(row.auditRef, "audit")) {
    return refuse("REF", "audit[].auditRef", String(row.auditRef), "An audit entry is named by an audit reference.");
  }
  if (row.tenantId !== scope.tenantId) {
    return refuse("SCOPE_LEAK", "audit[].tenantId", row.auditRef, `Audit entry ${row.auditRef} belongs to another tenant.`);
  }
  if (!includes(TENANT_AUDIT_ACTIONS, row.action) || !includes(TENANT_AUDIT_DECISIONS, row.decision)) {
    return refuse("KIND", "audit[]", row.auditRef, "An audit action or decision is not a known value.");
  }
  return null;
}

/**
 * Checks a payload the source returned before any row is shown. A failure means
 * the payload cannot be trusted as a whole, so the port returns no row from it.
 */
export function refuseTenantSnapshot(snapshot: TenantSnapshot): TenantRefused | null {
  const claim = findTenantClaim(snapshot.nonClaims);
  if (claim !== null) {
    return refuse(
      "CLAIM",
      claim,
      null,
      `The payload does not state ${claim} as false. Hiding a control is not enforcement, an actor label is not authentication, an approval changes no resource by itself, no row crosses a tenant boundary, and the export holds no real personal data.`,
    );
  }
  if (snapshot.scope.tenantId !== TENANT_OWN && snapshot.scope.tenantId !== TENANT_FOREIGN) {
    return refuse("SCOPE_LEAK", "scope.tenantId", null, `The snapshot names tenant ${String(snapshot.scope.tenantId)}.`);
  }
  for (const member of snapshot.members) {
    const bad = refuseMember(member, snapshot.scope);
    if (bad !== null) {
      return bad;
    }
  }
  for (const order of snapshot.orders) {
    const bad = refuseOrder(order, snapshot.scope, snapshot.actorRef);
    if (bad !== null) {
      return bad;
    }
  }
  for (const row of snapshot.events) {
    const bad = refuseEvent(row, snapshot.scope);
    if (bad !== null) {
      return bad;
    }
  }
  for (const row of snapshot.accounts) {
    const bad = refuseAccount(row, snapshot.scope);
    if (bad !== null) {
      return bad;
    }
  }
  for (const row of snapshot.cases) {
    const bad = refuseCase(row, snapshot.scope);
    if (bad !== null) {
      return bad;
    }
  }
  for (const row of snapshot.proposals) {
    const bad = refuseProposal(row, snapshot.scope);
    if (bad !== null) {
      return bad;
    }
  }
  for (const row of snapshot.audit) {
    const bad = refuseAudit(row, snapshot.scope);
    if (bad !== null) {
      return bad;
    }
  }
  if (!isGeneration(snapshot.roleGeneration)) {
    return refuse("STATE", "roleGeneration", null, "The read states the actor's assignment generation.");
  }
  const focus = snapshot.focus;
  if (focus !== null) {
    const rows: Record<TenantFocus["kind"], { ref: string; tenantId: string }> = {
      member: { ref: focus.kind === "member" ? focus.row.memberRef : "", tenantId: focus.row.tenantId },
      order: { ref: focus.kind === "order" ? focus.row.orderRef : "", tenantId: focus.row.tenantId },
      event: { ref: focus.kind === "event" ? focus.row.eventRef : "", tenantId: focus.row.tenantId },
      account: { ref: focus.kind === "account" ? focus.row.accountRef : "", tenantId: focus.row.tenantId },
      case: { ref: focus.kind === "case" ? focus.row.caseRef : "", tenantId: focus.row.tenantId },
      proposal: { ref: focus.kind === "proposal" ? focus.row.proposalRef : "", tenantId: focus.row.tenantId },
      audit: { ref: focus.kind === "audit" ? focus.row.auditRef : "", tenantId: focus.row.tenantId },
    };
    const picked = rows[focus.kind];
    if (tenantRefKind(picked.ref) !== focus.kind) {
      return refuse("REF", "focus", picked.ref, "A focused row is named by a reference of its own kind.");
    }
    if (picked.tenantId !== snapshot.scope.tenantId) {
      return refuse("SCOPE_LEAK", "focus.tenantId", picked.ref, "A focused row belongs to another tenant.");
    }
    if (!snapshot.visibleKinds.includes(focus.kind)) {
      return refuse("SCOPE_LEAK", "focus.kind", picked.ref, "A focused row is not a kind this role may read.");
    }
  }
  for (const kind of snapshot.visibleKinds) {
    if (!includes(TENANT_RESOURCE_KINDS, kind)) {
      return refuse("KIND", "visibleKinds", null, "A visible kind is not a known value.");
    }
  }
  return null;
}

/** Checks the export payload's own declaration and rows before one is shown. */
export function refuseTenantExport(exported: TenantExport, scope: TenantScope): TenantRefused | null {
  const declaration = exported.scopeDeclaration;
  if (
    declaration.provenance !== "synthetic" ||
    declaration.realPersonalData !== false ||
    declaration.sharedOutsideTenant !== false ||
    declaration.authorityRecord !== false ||
    declaration.target !== "none"
  ) {
    return refuse(
      "CLAIM",
      "scopeDeclaration",
      exported.exportRef,
      "The export does not declare itself synthetic with no real personal data, not shared outside the tenant, and not an authority record.",
    );
  }
  if (exported.scope.tenantId !== scope.tenantId || exported.scope.role !== scope.role) {
    return refuse("SCOPE_LEAK", "scope", exported.exportRef, "The export names another tenant or role.");
  }
  for (const row of exported.rows) {
    if (!isTenantRef(row.entryRef, row.entryKind)) {
      return refuse("REF", "rows[].entryRef", String(row.entryRef), "An export row names a member or an account reference.");
    }
  }
  return null;
}

/** Checks a request receipt before it is trusted as recorded. */
export function refuseTenantReceipt(receipt: TenantReceipt, action: TenantActionRequest): TenantRefused | null {
  if (receipt.resourceChanged !== false || receipt.approvalChangesResource !== false) {
    return refuse(
      "CLAIM",
      "resourceChanged",
      receipt.proposalRef,
      "The answer claims a recorded request changed a resource. A proposal and an approval are records; the source alone applies a change later.",
    );
  }
  if (!isTenantRef(receipt.proposalRef, "proposal")) {
    return refuse("REF", "proposalRef", String(receipt.proposalRef), "A receipt names a proposal reference.");
  }
  if (!includes(TENANT_CHANGE_KINDS, receipt.changeKind)) {
    return refuse("KIND", "changeKind", receipt.proposalRef, "A receipt names a known change kind.");
  }
  if (tenantRefKind(receipt.targetRef) !== TENANT_CHANGE_TARGET_KIND[receipt.changeKind]) {
    return refuse("REF", "targetRef", receipt.targetRef, "A receipt names the target of its own change kind.");
  }
  if (action.kind === "approve-proposal" && receipt.kind !== "approval-recorded") {
    return refuse("KIND", "kind", receipt.proposalRef, "An approval is answered as approval-recorded.");
  }
  if (action.kind !== "approve-proposal" && receipt.kind !== "proposal-recorded") {
    return refuse("KIND", "kind", receipt.proposalRef, "A proposal is answered as proposal-recorded.");
  }
  return null;
}

// ---------------------------------------------------------------------------
// Assessment and eligibility. What the last read offers, against the source's
// own rows. The screen and the send path both ask these.
// ---------------------------------------------------------------------------

export interface TenantAssessment {
  pending: readonly TenantProposal[];
  /** Pending proposals this actor may still approve: not its own, correct kind coverage. */
  approvable: readonly TenantProposal[];
  /** Accounts an account-change proposal may name, from the last read. */
  accountTargets: readonly TenantAccount[];
  /** Members a role-revoke proposal may name: active, and not the actor's own assignment. */
  memberTargets: readonly TenantMember[];
}

export function assessTenantSnapshot(snapshot: TenantSnapshot, actorRef: string): TenantAssessment {
  const pending = snapshot.proposals.filter((row) => row.state === "pending");
  const approvable = pending.filter((row) => row.proposedBy !== actorRef);
  return {
    pending,
    approvable,
    accountTargets: snapshot.accounts.filter((row) => row.state === "active"),
    memberTargets: snapshot.members.filter((row) => row.state === "active" && row.actorRef !== actorRef),
  };
}

export interface TenantEligibility {
  allowed: boolean;
  reason: string | null;
}

/**
 * Whether the last read supports a request of this kind from this actor. The
 * page shows the reason and the send path enforces it, so a control that is off
 * is a request that never leaves — and the port decides again when one does.
 */
export function tenantEligibility(
  snapshot: TenantSnapshot,
  assessment: TenantAssessment,
  kind: TenantActionKind,
  _actorRef: string,
): TenantEligibility {
  const capabilities = tenantCapabilities(snapshot.scope.role);
  if (kind === "approve-proposal") {
    if (!capabilities.includes(TENANT_CHECKER_CAPABILITY)) {
      return { allowed: false, reason: `Role ${snapshot.scope.role} holds no approve capability at the source.` };
    }
    if (assessment.approvable.length === 0) {
      return {
        allowed: false,
        reason: assessment.pending.length === 0
          ? "The last read lists no pending proposal."
          : "Every pending proposal was proposed by this actor. A different actor approves it.",
      };
    }
    return { allowed: true, reason: null };
  }
  const needed = TENANT_MAKER_CAPABILITY[kind === "propose-account-change" ? "account-change" : "role-revoke"];
  if (!capabilities.includes(needed)) {
    return { allowed: false, reason: `Role ${snapshot.scope.role} holds no ${needed} capability at the source.` };
  }
  const targets = kind === "propose-account-change" ? assessment.accountTargets : assessment.memberTargets;
  if (targets.length === 0) {
    return { allowed: false, reason: `The last read lists no target a ${kind} proposal may name.` };
  }
  return { allowed: true, reason: null };
}

/** Pending proposals this actor may approve, from the last read. */
export function tenantApprovableProposals(snapshot: TenantSnapshot, actorRef: string): readonly TenantProposal[] {
  return snapshot.proposals.filter((row) => row.state === "pending" && row.proposedBy !== actorRef);
}

export const TENANT_EXPORT_REASONS = [
  "NO_SNAPSHOT",
  "SCOPE",
  "WATERMARK",
  "PARTIAL",
  "COUNT",
  "ROWS_DIFFER",
] as const;
export type TenantExportReason = (typeof TENANT_EXPORT_REASONS)[number];

export interface TenantExportVerdict {
  current: boolean;
  reasons: readonly TenantExportReason[];
}

/** The export rows the read yields: the members and the accounts the role saw. */
export function tenantExportRowsFor(snapshot: TenantSnapshot): readonly TenantExportRow[] {
  const rows: TenantExportRow[] = [];
  for (const member of snapshot.members) {
    rows.push({
      entryRef: member.memberRef,
      entryKind: "member",
      label: `${member.actorRef} as ${member.role}`,
      detail: `generation ${member.generation}, ${member.state}`,
    });
  }
  for (const account of snapshot.accounts) {
    rows.push({
      entryRef: account.accountRef,
      entryKind: "account",
      label: account.label,
      detail: `tail ${account.accountTail}, ${account.state}`,
    });
  }
  return rows;
}

/**
 * Judges the export against the last read and nothing else. An export is current
 * only when it is one complete export of the very rows the last read saw at the
 * same watermark, for the same scope.
 */
export function judgeTenantExport(
  snapshot: TenantSnapshot | null,
  exported: TenantExport,
): TenantExportVerdict {
  const reasons: TenantExportReason[] = [];
  if (snapshot === null) {
    return { current: false, reasons: ["NO_SNAPSHOT"] };
  }
  if (exported.scope.tenantId !== snapshot.scope.tenantId || exported.scope.role !== snapshot.scope.role) {
    reasons.push("SCOPE");
  }
  if (exported.watermark !== snapshot.watermark) {
    reasons.push("WATERMARK");
  }
  if (!exported.complete) {
    reasons.push("PARTIAL");
  }
  const expected = tenantExportRowsFor(snapshot);
  if (exported.declaredRowCount !== expected.length || exported.rows.length !== expected.length) {
    reasons.push("COUNT");
  }
  const keyOf = (row: TenantExportRow) => `${row.entryRef}|${row.entryKind}|${row.label}|${row.detail}`;
  if (JSON.stringify(exported.rows.map(keyOf)) !== JSON.stringify(expected.map(keyOf))) {
    reasons.push("ROWS_DIFFER");
  }
  return { current: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// The synthetic source.
// ---------------------------------------------------------------------------

interface SeedMember {
  memberRef: string;
  tenantId: string;
  actorRef: string;
  role: TenantRole;
  state: TenantMemberState;
}

const SEED_MEMBERS: readonly SeedMember[] = [
  { memberRef: "mbr-0001", tenantId: TENANT_OWN, actorRef: TENANT_BUYER_ACTOR, role: "buyer", state: "active" },
  { memberRef: "mbr-0002", tenantId: TENANT_OWN, actorRef: TENANT_ORGANIZER_ACTOR, role: "organizer", state: "active" },
  { memberRef: "mbr-0003", tenantId: TENANT_OWN, actorRef: TENANT_SETTLER_ACTOR, role: "settler", state: "active" },
  { memberRef: "mbr-0004", tenantId: TENANT_OWN, actorRef: TENANT_SUPPORT_ACTOR, role: "support", state: "active" },
  { memberRef: "mbr-0005", tenantId: TENANT_OWN, actorRef: TENANT_DUAL_ACTOR, role: "organizer", state: "active" },
  { memberRef: "mbr-0006", tenantId: TENANT_OWN, actorRef: TENANT_DUAL_ACTOR, role: "support", state: "active" },
  { memberRef: "mbr-0007", tenantId: TENANT_FOREIGN, actorRef: TENANT_FOREIGN_ACTOR, role: "organizer", state: "active" },
  { memberRef: "mbr-0008", tenantId: TENANT_OWN, actorRef: "person-former", role: "buyer", state: "revoked" },
];

const SEED_ORDERS: readonly TenantOrder[] = [
  { orderRef: "ord-0001", tenantId: TENANT_OWN, subjectRef: TENANT_BUYER_ACTOR, eventRef: "evn-0001", state: "placed", label: "Two seats, row C" },
  { orderRef: "ord-0002", tenantId: TENANT_OWN, subjectRef: TENANT_BUYER_ACTOR, eventRef: "evn-0002", state: "placed", label: "GA standing" },
  { orderRef: "ord-0003", tenantId: TENANT_OWN, subjectRef: TENANT_DUAL_ACTOR, eventRef: "evn-0001", state: "cancelled", label: "One seat, row A" },
  { orderRef: "ord-9001", tenantId: TENANT_FOREIGN, subjectRef: TENANT_FOREIGN_ACTOR, eventRef: "evn-9001", state: "placed", label: "Foreign order" },
];

const SEED_EVENTS: readonly TenantEventRow[] = [
  { eventRef: "evn-0001", tenantId: TENANT_OWN, title: "North Station Lanterns", state: "on-sale" },
  { eventRef: "evn-0002", tenantId: TENANT_OWN, title: "Harbor Night", state: "closed" },
  { eventRef: "evn-9001", tenantId: TENANT_FOREIGN, title: "Foreign gala", state: "on-sale" },
];

const SEED_ACCOUNTS: readonly TenantAccount[] = [
  { accountRef: "acc-0001", tenantId: TENANT_OWN, label: "Settlement payout account", accountTail: "tail-3921", state: "active" },
  { accountRef: "acc-0002", tenantId: TENANT_OWN, label: "Refund holding account", accountTail: "tail-8810", state: "active" },
  { accountRef: "acc-9001", tenantId: TENANT_FOREIGN, label: "Foreign payout account", accountTail: "tail-0000", state: "active" },
];

const SEED_CASES: readonly TenantCase[] = [
  { caseRef: "tck-0001", tenantId: TENANT_OWN, subjectRef: TENANT_BUYER_ACTOR, topic: "Order not delivered", state: "open" },
  { caseRef: "tck-0002", tenantId: TENANT_OWN, subjectRef: TENANT_BUYER_ACTOR, topic: "Name change request", state: "answered" },
  { caseRef: "tck-9001", tenantId: TENANT_FOREIGN, subjectRef: TENANT_FOREIGN_ACTOR, topic: "Foreign case", state: "open" },
];

const NON_CLAIMS: TenantNonClaims = {
  uiHidingIsEnforcement: false,
  actorIsAuthenticated: false,
  exportHasRealPersonalData: false,
  approvalChangesResource: false,
  crossTenantAccess: false,
  auditIsCompleteRecord: false,
};

const NOTE_LIMIT = 200;
// Intentionally rejects ASCII control characters in tenant notes.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidNote(value: unknown): value is string {
  return isNonEmpty(value) && value.trim().length <= NOTE_LIMIT && !CONTROL_CHARACTERS.test(value);
}

/** Synthetic source. State lives in this object, so a new port is a new session. */
export class StubTenantPermissions implements TenantPermissionsPort {
  readonly environment = "stub" as const;
  readonly source = "synthetic-tenant-permissions" as const;
  readonly scenario: TenantScenario;
  private readonly expectedTuple: DiscoveryReadTuple;
  private snapshotSerial = 0;
  private auditSerial = 0;
  private proposalSerial = 0;
  private exportSerial = 0;
  /** Assignment generation by member ref. Rotated by the synthetic control. */
  private readonly generations = new Map<string, number>();
  private readonly revoked = new Set<string>();
  private readonly appliedAccounts = new Map<string, string>();
  private readonly proposals: TenantProposal[] = [];
  private readonly auditTrail: TenantAuditEntry[] = [];
  private readonly counts: TenantEffectCounts = { reads: 0, exports: 0, acts: 0 };

  constructor(options: StubTenantPermissionsOptions) {
    this.scenario = options.scenario ?? "clean";
    this.expectedTuple = options.expectedTuple ?? DISCOVERY_READ_TUPLE_LITERALS;
    for (const member of SEED_MEMBERS) {
      this.generations.set(member.memberRef, 1);
    }
    if (this.scenario === "role-rotated") {
      // The settler assignment moved at the source before the desk's first read of it.
      this.generations.set("mbr-0003", 2);
    }
    if (this.scenario === "denied") {
      for (const member of SEED_MEMBERS) {
        this.revoked.add(member.memberRef);
      }
    }
    if (this.scenario === "proposal-pending") {
      this.proposals.push({
        tenantId: TENANT_OWN,
        proposalRef: "ppr-0001",
        kind: "account-change",
        targetRef: "acc-0001",
        note: "Move the payout account to the tail the finance review recorded.",
        proposedBy: TENANT_SETTLER_ACTOR,
        proposedAs: "settler",
        state: "pending",
        resourceChanged: false,
      });
      this.proposalSerial = 1;
    }
    if (this.scenario === "self-approval") {
      // A role-revoke proposal from the dual-role person acting as support. The same
      // person holds the checker role, so the source has a reason to reject it.
      this.proposals.push({
        tenantId: TENANT_OWN,
        proposalRef: "ppr-0001",
        kind: "role-revoke",
        targetRef: "mbr-0008",
        note: "Close out the former buyer membership.",
        proposedBy: TENANT_DUAL_ACTOR,
        proposedAs: "support",
        state: "pending",
        resourceChanged: false,
      });
      this.proposalSerial = 1;
    }
  }

  /** Test seam. Counts of what reached the source. Not part of the port. */
  effects(): TenantEffectCounts {
    return { ...this.counts };
  }

  synthetic(control: TenantSyntheticControl, ref?: string): boolean {
    if (control === "revoke-role") {
      const member = SEED_MEMBERS.find((row) => row.memberRef === ref && row.state === "active");
      if (member === undefined || this.revoked.has(member.memberRef)) {
        return false;
      }
      this.revoked.add(member.memberRef);
      this.generations.set(member.memberRef, (this.generations.get(member.memberRef) ?? 1) + 1);
      return true;
    }
    if (control === "rotate-role") {
      const member = SEED_MEMBERS.find((row) => row.memberRef === ref && row.state === "active");
      if (member === undefined || this.revoked.has(member.memberRef)) {
        return false;
      }
      this.generations.set(member.memberRef, (this.generations.get(member.memberRef) ?? 1) + 1);
      return true;
    }
    // The source applies its oldest recorded approval. The proposal is applied by
    // the source, not by the approval: the approval was only a record.
    const next = this.proposals.find((row) => row.state === "approval-recorded");
    if (next === undefined) {
      return false;
    }
    next.state = "applied-by-source";
    if (next.kind === "account-change") {
      this.appliedAccounts.set(next.targetRef, "tail-5507");
    }
    if (next.kind === "role-revoke") {
      this.revoked.add(next.targetRef);
      this.generations.set(next.targetRef, (this.generations.get(next.targetRef) ?? 1) + 1);
    }
    return true;
  }

  private memberOf(actorRef: string, tenantId: string, role: TenantRole): SeedMember | undefined {
    return SEED_MEMBERS.find((row) => row.actorRef === actorRef && row.tenantId === tenantId && row.role === role);
  }

  private generationOf(memberRef: string): number {
    return this.generations.get(memberRef) ?? 1;
  }

  private audit(scope: TenantScope, actorRef: string, action: TenantAuditAction, targetRef: string | null, decision: TenantAuditDecision, detail: string): void {
    if (scope.tenantId !== TENANT_OWN && scope.tenantId !== TENANT_FOREIGN) {
      return;
    }
    this.auditSerial += 1;
    this.auditTrail.push({
      auditRef: tenantRefFor("audit", this.auditSerial),
      seq: this.auditSerial,
      tenantId: scope.tenantId,
      actorRef,
      role: scope.role,
      action,
      targetRef,
      decision,
      detail,
    });
  }

  private gate(request: { contextKey: unknown; actorRef: unknown; scope: Partial<TenantScope> | null | undefined }):
    | { invalid: TenantInvalid }
    | { denied: TenantDenied }
    | { assignment: SeedMember } {
    const scope = request.scope;
    if (!isNonEmpty(request.contextKey)) {
      return { invalid: { kind: "invalid-request", code: "CONTEXT", detail: "A request carries a context key." } };
    }
    if (!isNonEmpty(request.actorRef)) {
      return { invalid: { kind: "invalid-request", code: "ACTOR", detail: "A request carries an actor string. It is a label, not an authentication result." } };
    }
    if (scope === null || scope === undefined || !includes(TENANT_KNOWN, scope.tenantId) || !includes(TENANT_ROLES, scope.role)) {
      return {
        invalid: { kind: "invalid-request", code: "SCOPE", detail: `A scope names a tenant of ${TENANT_KNOWN.join(" or ")} and a role of ${TENANT_ROLES.join(", ")}.` },
      };
    }
    const typed = scope as TenantScope;
    const assignment = this.memberOf(String(request.actorRef), typed.tenantId, typed.role);
    if (assignment === undefined) {
      this.audit(typed, String(request.actorRef), "read", null, "denied", "No such assignment at the source.");
      return {
        denied: { kind: "denied", code: "ROLE_DENIED", detail: `Actor ${String(request.actorRef)} holds no ${typed.role} assignment in tenant ${typed.tenantId} at the source. No row is returned.` },
      };
    }
    if (this.revoked.has(assignment.memberRef) || assignment.state === "revoked") {
      this.audit(typed, String(request.actorRef), "read", assignment.memberRef, "denied", "The assignment was revoked at the source.");
      return {
        denied: { kind: "denied", code: "ROLE_REVOKED", detail: `The ${typed.role} assignment of ${String(request.actorRef)} in tenant ${typed.tenantId} was revoked at the source. No row is returned.` },
      };
    }
    return { assignment };
  }

  read(request: TenantReadRequest): Promise<TenantReadOutcome> {
    this.counts.reads += 1;
    if (this.scenario === "read-lost") {
      return Promise.reject(new Error("The answer to the read never arrived."));
    }
    return Promise.resolve(this.readNow(request));
  }

  readExport(request: TenantExportRequest): Promise<TenantExportOutcome> {
    this.counts.exports += 1;
    return Promise.resolve(this.exportNow(request));
  }

  act(request: TenantActRequest): Promise<TenantActOutcome> {
    this.counts.acts += 1;
    const outcome = this.actNow(request);
    if (this.scenario === "act-lost" && outcome.kind === "applied") {
      // The request took effect at the source. Its answer never arrives.
      return Promise.reject(new Error("The answer to the request never arrived."));
    }
    return Promise.resolve(outcome);
  }

  private readNow(request: TenantReadRequest): TenantReadOutcome {
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
    const assignment = gated.assignment;
    const roleScope: TenantScope = { tenantId: assignment.tenantId, role: assignment.role };
    const current = this.generationOf(assignment.memberRef);
    if (request.roleFloor !== null && request.roleFloor !== undefined) {
      if (!isGeneration(request.roleFloor)) {
        return { kind: "invalid-request", code: "GENERATION", detail: "The role floor is a whole generation number." };
      }
      if (request.roleFloor < current) {
        return { kind: "role-stale", expected: request.roleFloor, actual: current };
      }
    }
    if (request.watermarkFloor !== null && request.watermarkFloor !== undefined && Number.isNaN(Date.parse(request.watermarkFloor))) {
      return { kind: "invalid-request", code: "FLOOR", detail: "The watermark floor is not an instant." };
    }
    this.snapshotSerial += 1;
    const watermark = this.scenario === "stale" ? TENANT_STALE_WATERMARK : TENANT_AS_OF;
    const floor = request.watermarkFloor ?? (this.scenario === "stale" ? TENANT_STALE_FLOOR : null);
    if (floor !== null && Date.parse(watermark) < Date.parse(floor)) {
      return { kind: "stale", watermark, floor };
    }
    const focused = this.focusFor(request.focusRef ?? null, roleScope, String(request.actorRef));
    if ("denied" in focused) {
      return focused.denied;
    }
    if ("invalid" in focused) {
      return focused.invalid;
    }
    const visible = tenantRoleResources(roleScope.role);
    const rows = {
      members: this.membersFor(roleScope, String(request.actorRef), visible),
      orders: this.ordersFor(roleScope, String(request.actorRef), visible),
      events: this.eventsFor(roleScope, visible),
      accounts: this.accountsFor(roleScope, visible),
      cases: this.casesFor(roleScope, visible),
      proposals: this.proposalsFor(roleScope, visible),
      audit: this.auditFor(roleScope, visible),
    };
    const total = rows.members.length + rows.orders.length + rows.events.length + rows.accounts.length + rows.cases.length;
    if (this.scenario === "empty" || total === 0) {
      this.audit(roleScope, String(request.actorRef), "read", null, "allowed", "Read answered with no row.");
      return { kind: "empty", watermark, snapshotId: this.snapshotSerial, scope: { ...roleScope } };
    }
    const snapshot: TenantSnapshot = {
      snapshotId: this.snapshotSerial,
      watermark,
      scenario: this.scenario,
      scope: { ...roleScope },
      actorRef: String(request.actorRef),
      roleGeneration: current,
      visibleKinds: visible,
      members: rows.members,
      orders: rows.orders,
      events: rows.events,
      accounts: rows.accounts,
      cases: rows.cases,
      proposals: rows.proposals,
      audit: rows.audit,
      focus: focused.focus,
      nonClaims:
        this.scenario === "claims-enforced"
          ? ({ ...NON_CLAIMS, uiHidingIsEnforcement: true } as unknown as TenantNonClaims)
          : { ...NON_CLAIMS },
    };
    const refused = refuseTenantSnapshot(snapshot);
    if (refused !== null) {
      this.audit(roleScope, String(request.actorRef), "read", null, "refused", refused.detail);
      return refused;
    }
    this.audit(roleScope, String(request.actorRef), "read", null, "allowed", `Read answered for role ${roleScope.role}.`);
    return { kind: "ready", snapshot };
  }

  /** Resolves a deep-open ref against the role's visibility. Anything else is denied, not empty. */
  private focusFor(
    focusRef: string | null,
    scope: TenantScope,
    actorRef: string,
  ): { focus: TenantFocus | null } | { denied: TenantDenied } | { invalid: TenantInvalid } {
    if (focusRef === null) {
      return { focus: null };
    }
    const kind = tenantRefKind(focusRef);
    if (kind === null || kind === "export") {
      return { invalid: { kind: "invalid-request", code: "REF", detail: `${focusRef} is not a resource reference.` } };
    }
    if (!tenantRoleResources(scope.role).includes(kind)) {
      this.audit(scope, actorRef, "read", focusRef, "denied", `Role ${scope.role} may not read ${kind} rows.`);
      return {
        denied: { kind: "denied", code: "RESOURCE_DENIED", detail: `Role ${scope.role} may not read ${kind} rows. The control being absent on screen is not what denies it.` },
      };
    }
    const member = SEED_MEMBERS.find((row) => row.memberRef === focusRef);
    const order = SEED_ORDERS.find((row) => row.orderRef === focusRef);
    const event = SEED_EVENTS.find((row) => row.eventRef === focusRef);
    const account = SEED_ACCOUNTS.find((row) => row.accountRef === focusRef);
    const ticket = SEED_CASES.find((row) => row.caseRef === focusRef);
    const proposal = this.proposals.find((row) => row.proposalRef === focusRef);
    const auditRow = this.auditTrail.find((row) => row.auditRef === focusRef);
    const tenantId =
      member?.tenantId ?? order?.tenantId ?? event?.tenantId ?? account?.tenantId ?? ticket?.tenantId ?? proposal?.tenantId ?? auditRow?.tenantId;
    if (tenantId === undefined) {
      this.audit(scope, actorRef, "read", focusRef, "denied", "The source holds no such resource.");
      return { denied: { kind: "denied", code: "RESOURCE_DENIED", detail: `The source holds no resource ${focusRef}.` } };
    }
    if (tenantId !== scope.tenantId) {
      this.audit(scope, actorRef, "read", focusRef, "denied", "The resource belongs to another tenant.");
      return {
        denied: { kind: "denied", code: "RESOURCE_DENIED", detail: `Resource ${focusRef} belongs to another tenant. No row is returned, and no row of this tenant stands in for it.` },
      };
    }
    if (order !== undefined && scope.role === "buyer" && order.subjectRef !== actorRef) {
      this.audit(scope, actorRef, "read", focusRef, "denied", "The order belongs to another subject.");
      return { denied: { kind: "denied", code: "RESOURCE_DENIED", detail: `Order ${focusRef} belongs to another subject.` } };
    }
    if (member !== undefined && !tenantCapabilities(scope.role).includes("read-tenant") && member.actorRef !== actorRef) {
      this.audit(scope, actorRef, "read", focusRef, "denied", "The membership belongs to another person.");
      return { denied: { kind: "denied", code: "RESOURCE_DENIED", detail: `Membership ${focusRef} belongs to another person. A read-own role sees its own rows only.` } };
    }
    const focus: TenantFocus | null =
      member !== undefined
        ? { kind: "member", row: { ...member, generation: this.generationOf(member.memberRef), state: this.revoked.has(member.memberRef) ? "revoked" : member.state } }
        : order !== undefined
          ? { kind: "order", row: { ...order } }
          : event !== undefined
            ? { kind: "event", row: { ...event } }
            : account !== undefined
              ? { kind: "account", row: { ...account, accountTail: this.appliedAccounts.get(account.accountRef) ?? account.accountTail, state: this.appliedAccounts.has(account.accountRef) ? "changed-by-source" : account.state } }
              : ticket !== undefined
                ? { kind: "case", row: { ...ticket } }
                : proposal !== undefined
                  ? { kind: "proposal", row: { ...proposal } }
                  : auditRow !== undefined
                    ? { kind: "audit", row: { ...auditRow } }
                    : null;
    this.audit(scope, actorRef, "read", focusRef, "allowed", `Deep-open read for ${focusRef}.`);
    return { focus };
  }

  private membersFor(scope: TenantScope, actorRef: string, visible: readonly TenantResourceKind[]): TenantMember[] {
    if (!visible.includes("member")) {
      return [];
    }
    const canReadTenant = tenantCapabilities(scope.role).includes("read-tenant");
    const rows = SEED_MEMBERS.filter(
      (row) => row.tenantId === scope.tenantId && (canReadTenant || row.actorRef === actorRef),
    );
    const mapped = rows.map((row) => ({
      ...row,
      generation: this.generationOf(row.memberRef),
      state: this.revoked.has(row.memberRef) ? ("revoked" as const) : row.state,
    }));
    if (this.scenario === "tenant-mix") {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guarded by mapped.length > 0.
      const leaked = mapped.length > 0 ? { ...mapped[0]!, memberRef: "mbr-0007", tenantId: TENANT_FOREIGN } : null;
      if (leaked !== null) {
        mapped.push(leaked);
      }
    }
    return mapped;
  }

  private ordersFor(scope: TenantScope, actorRef: string, visible: readonly TenantResourceKind[]): TenantOrder[] {
    if (!visible.includes("order")) {
      return [];
    }
    const rows = SEED_ORDERS.filter((row) => row.tenantId === scope.tenantId && row.subjectRef === actorRef).map((row) => ({ ...row }));
    if (this.scenario === "subject-mix") {
      const leaked = SEED_ORDERS.find((row) => row.tenantId === scope.tenantId && row.subjectRef !== actorRef);
      if (leaked !== undefined) {
        rows.push({ ...leaked });
      }
    }
    return rows;
  }

  private eventsFor(scope: TenantScope, visible: readonly TenantResourceKind[]): TenantEventRow[] {
    if (!visible.includes("event")) {
      return [];
    }
    return SEED_EVENTS.filter((row) => row.tenantId === scope.tenantId).map((row) => ({ ...row }));
  }

  private accountsFor(scope: TenantScope, visible: readonly TenantResourceKind[]): TenantAccount[] {
    if (!visible.includes("account")) {
      return [];
    }
    return SEED_ACCOUNTS.filter((row) => row.tenantId === scope.tenantId).map((row) => ({
      ...row,
      accountTail: this.appliedAccounts.get(row.accountRef) ?? row.accountTail,
      state: this.appliedAccounts.has(row.accountRef) ? "changed-by-source" : row.state,
    }));
  }

  private casesFor(scope: TenantScope, visible: readonly TenantResourceKind[]): TenantCase[] {
    if (!visible.includes("case")) {
      return [];
    }
    return SEED_CASES.filter((row) => row.tenantId === scope.tenantId).map((row) => ({ ...row }));
  }

  private proposalsFor(scope: TenantScope, visible: readonly TenantResourceKind[]): TenantProposal[] {
    if (!visible.includes("proposal")) {
      return [];
    }
    return this.proposals.filter((row) => row.tenantId === scope.tenantId).map((row) => ({ ...row }));
  }

  private auditFor(scope: TenantScope, visible: readonly TenantResourceKind[]): TenantAuditEntry[] {
    if (!visible.includes("audit")) {
      return [];
    }
    const rows = this.auditTrail.filter((row) => row.tenantId === scope.tenantId).map((row) => ({ ...row }));
    if (this.scenario === "audit-leak") {
      rows.push({
        auditRef: "aud-9001",
        seq: 9001,
        tenantId: TENANT_FOREIGN,
        actorRef: TENANT_FOREIGN_ACTOR,
        role: "organizer",
        action: "read",
        targetRef: null,
        decision: "allowed",
        detail: "A foreign tenant audit entry that must not reach this read.",
      });
    }
    return rows;
  }

  private exportNow(request: TenantExportRequest): TenantExportOutcome {
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
    const scope = request.scope as TenantScope;
    if (this.scenario === "export-denied" || !tenantCapabilities(scope.role).includes("export-sensitive")) {
      this.audit(scope, String(request.actorRef), "export", null, "denied", "The role holds no sensitive-export capability.");
      return { kind: "denied", code: "EXPORT_DENIED", detail: "The source grants this role a read and no export. No export is returned." };
    }
    const snapshot: TenantSnapshot = {
      snapshotId: this.snapshotSerial,
      watermark: TENANT_AS_OF,
      scenario: this.scenario,
      scope: { ...scope },
      actorRef: String(request.actorRef),
      roleGeneration: this.generationOf(gated.assignment.memberRef),
      visibleKinds: tenantRoleResources(scope.role),
      members: this.membersFor(scope, String(request.actorRef), tenantRoleResources(scope.role)),
      orders: [],
      events: [],
      accounts: this.accountsFor(scope, tenantRoleResources(scope.role)),
      cases: [],
      proposals: [],
      audit: [],
      focus: null,
      nonClaims: { ...NON_CLAIMS },
    };
    let rows = tenantExportRowsFor(snapshot);
    const complete = true;
    if (this.scenario === "export-leak") {
      rows = [...rows, { entryRef: "acc-9001", entryKind: "account", label: "Foreign payout account", detail: "tail tail-0000, active" }];
    }
    this.exportSerial += 1;
    const exported: TenantExport = {
      exportRef: tenantRefFor("export", this.exportSerial),
      scope: { ...scope },
      watermark: TENANT_AS_OF,
      declaredRowCount: rows.length,
      complete,
      digest: `syn-digest-${String(this.exportSerial).padStart(4, "0")}`,
      scopeDeclaration:
        this.scenario === "export-claims-real"
          ? ({ provenance: "synthetic", realPersonalData: true, sharedOutsideTenant: false, authorityRecord: false, target: "none" } as unknown as TenantExportScope)
          : { provenance: "synthetic", realPersonalData: false, sharedOutsideTenant: false, authorityRecord: false, target: "none" },
      rows,
    };
    const refused = refuseTenantExport(exported, scope);
    if (refused !== null) {
      this.audit(scope, String(request.actorRef), "export", null, "refused", refused.detail);
      return refused;
    }
    this.audit(scope, String(request.actorRef), "export", exported.exportRef, "allowed", "Sensitive export answered.");
    return { kind: "ready", export: exported };
  }

  private actNow(request: TenantActRequest): TenantActOutcome {
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
    const assignment = gated.assignment;
    const scope = request.scope as TenantScope & { roleGeneration: number };
    const action = request.action as Partial<TenantActionRequest> | null | undefined;
    if (action === null || action === undefined || !includes(TENANT_ACTION_KINDS, action.kind)) {
      return { kind: "invalid-request", code: "ACTION", detail: `An action is one of ${TENANT_ACTION_KINDS.join(", ")}.` };
    }
    const current = this.generationOf(assignment.memberRef);
    if (!isGeneration(scope.roleGeneration)) {
      return { kind: "invalid-request", code: "GENERATION", detail: "A write carries the assignment generation it was built under." };
    }
    if (scope.roleGeneration !== current) {
      this.audit(scope, String(request.actorRef), action.kind, null, "rejected", `The write was built under generation ${scope.roleGeneration}; the source holds ${current}.`);
      return {
        kind: "rejected",
        code: "ROLE_STALE",
        detail: `The ${scope.role} assignment moved to generation ${current} at the source. The write was built under ${scope.roleGeneration}. Nothing is recorded.`,
      };
    }
    const capabilities = tenantCapabilities(scope.role);
    if (action.kind === "approve-proposal") {
      return this.approveNow(request, action as Extract<TenantActionRequest, { kind: "approve-proposal" }>, capabilities, scope);
    }
    return this.proposeNow(
      request,
      action as Extract<TenantActionRequest, { kind: "propose-account-change" | "propose-role-revoke" }>,
      capabilities,
      scope,
    );
  }

  private proposeNow(
    request: TenantActRequest,
    action: Extract<TenantActionRequest, { kind: "propose-account-change" | "propose-role-revoke" }>,
    capabilities: readonly TenantCapability[],
    scope: TenantScope,
  ): TenantActOutcome {
    const kind: TenantChangeKind = action.kind === "propose-account-change" ? "account-change" : "role-revoke";
    const needed = TENANT_MAKER_CAPABILITY[kind];
    const targetRef = action.kind === "propose-account-change" ? action.accountRef : action.memberRef;
    if (!isTenantRef(targetRef, TENANT_CHANGE_TARGET_KIND[kind])) {
      return { kind: "invalid-request", code: "REF", detail: `${String(targetRef)} is not a ${TENANT_CHANGE_TARGET_KIND[kind]} reference.` };
    }
    if (!isValidNote(action.note)) {
      return { kind: "invalid-request", code: "TEXT", detail: `A note is one to ${NOTE_LIMIT} characters with no control character.` };
    }
    if (!capabilities.includes(needed)) {
      this.audit(scope, String(request.actorRef), action.kind, targetRef, "rejected", `Role ${scope.role} holds no ${needed} capability.`);
      return { kind: "rejected", code: "NO_CAPABILITY", detail: `Role ${scope.role} holds no ${needed} capability at the source. Proposal, approval, export, and audit stay separate.` };
    }
    const targetTenant = this.targetTenant(kind, targetRef);
    if (targetTenant !== scope.tenantId) {
      this.audit(scope, String(request.actorRef), action.kind, targetRef, "rejected", "The target is not in this tenant.");
      return { kind: "rejected", code: "UNKNOWN_RESOURCE", detail: `The source holds no ${kind} target ${targetRef} in this tenant.` };
    }
    if (kind === "account-change" && this.appliedAccounts.has(targetRef)) {
      return { kind: "rejected", code: "TARGET_STATE", detail: `Account ${targetRef} was already changed by the source.` };
    }
    if (kind === "role-revoke") {
      const member = SEED_MEMBERS.find((row) => row.memberRef === targetRef);
      if (member === undefined || member.state !== "active" || this.revoked.has(targetRef)) {
        return { kind: "rejected", code: "TARGET_STATE", detail: `Member ${targetRef} holds no active assignment to revoke.` };
      }
    }
    if (this.proposals.some((row) => row.tenantId === scope.tenantId && row.kind === kind && row.targetRef === targetRef && row.state === "pending")) {
      return { kind: "rejected", code: "DUPLICATE_PENDING", detail: `A ${kind} proposal on ${targetRef} is already pending.` };
    }
    this.proposalSerial += 1;
    const proposalRef = tenantRefFor("proposal", this.proposalSerial);
    this.proposals.push({
      tenantId: scope.tenantId,
      proposalRef,
      kind,
      targetRef,
      note: action.note.trim(),
      proposedBy: String(request.actorRef),
      proposedAs: scope.role,
      state: "pending",
      resourceChanged: false,
    });
    this.audit(scope, String(request.actorRef), action.kind, proposalRef, "allowed", `Proposal ${proposalRef} recorded as pending.`);
    return this.answer({ kind: "proposal-recorded", proposalRef, targetRef, changeKind: kind }, request.action);
  }

  private approveNow(
    request: TenantActRequest,
    action: Extract<TenantActionRequest, { kind: "approve-proposal" }>,
    capabilities: readonly TenantCapability[],
    scope: TenantScope,
  ): TenantActOutcome {
    if (!isTenantRef(action.proposalRef, "proposal")) {
      return { kind: "invalid-request", code: "REF", detail: `${String(action.proposalRef)} is not a proposal reference.` };
    }
    if (!capabilities.includes(TENANT_CHECKER_CAPABILITY)) {
      this.audit(scope, String(request.actorRef), "approve-proposal", action.proposalRef, "rejected", `Role ${scope.role} holds no ${TENANT_CHECKER_CAPABILITY} capability.`);
      return { kind: "rejected", code: "NO_CAPABILITY", detail: `Role ${scope.role} holds no ${TENANT_CHECKER_CAPABILITY} capability at the source. Proposal, approval, export, and audit stay separate.` };
    }
    const proposal = this.proposals.find((row) => row.proposalRef === action.proposalRef && row.tenantId === scope.tenantId);
    if (proposal === undefined) {
      return { kind: "rejected", code: "UNKNOWN_PROPOSAL", detail: `The source holds no proposal ${action.proposalRef} in this tenant.` };
    }
    if (proposal.state !== "pending") {
      return { kind: "rejected", code: "NOT_PENDING", detail: `Proposal ${proposal.proposalRef} is ${proposal.state}. A proposal is approved only while it is pending.` };
    }
    if (proposal.proposedBy === request.actorRef) {
      this.audit(scope, String(request.actorRef), "approve-proposal", proposal.proposalRef, "rejected", "The proposing actor may not approve it.");
      return { kind: "rejected", code: "SELF_APPROVAL", detail: `Actor ${String(request.actorRef)} proposed ${proposal.proposalRef} as ${proposal.proposedAs}. A different actor approves it, and the same person's other role is not a different actor.` };
    }
    // The approval is recorded. The target row changes only when the source applies it.
    proposal.state = "approval-recorded";
    this.audit(scope, String(request.actorRef), "approve-proposal", proposal.proposalRef, "allowed", `Proposal ${proposal.proposalRef} approval recorded.`);
    return this.answer(
      { kind: "approval-recorded", proposalRef: proposal.proposalRef, targetRef: proposal.targetRef, changeKind: proposal.kind },
      request.action,
    );
  }

  private targetTenant(kind: TenantChangeKind, targetRef: string): string | undefined {
    if (kind === "account-change") {
      return SEED_ACCOUNTS.find((row) => row.accountRef === targetRef)?.tenantId;
    }
    return SEED_MEMBERS.find((row) => row.memberRef === targetRef)?.tenantId;
  }

  /** Builds the answer, and refuses it when it claims anything a recorded request cannot mean. */
  private answer(base: Pick<TenantReceipt, "kind" | "proposalRef" | "targetRef" | "changeKind">, action: TenantActionRequest): TenantActOutcome {
    const claims = this.scenario === "approve-claims-applied" && base.kind === "approval-recorded";
    const receipt = { ...base, resourceChanged: false, approvalChangesResource: claims } as unknown as TenantReceipt;
    const refused = refuseTenantReceipt(receipt, action);
    if (refused !== null) {
      return refused;
    }
    return { kind: "applied", receipt };
  }
}
