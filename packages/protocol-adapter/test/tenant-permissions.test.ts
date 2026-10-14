import { describe, expect, it } from "vitest";
import {
  DISCOVERY_READ_TUPLE_LITERALS,
  TENANT_BUYER_ACTOR,
  TENANT_CAPABILITIES,
  TENANT_CHANGE_KINDS,
  TENANT_DUAL_ACTOR,
  TENANT_FOREIGN,
  TENANT_FOREIGN_ACTOR,
  TENANT_KNOWN,
  TENANT_MAKER_CAPABILITY,
  TENANT_NON_CLAIM_FIELDS,
  TENANT_NOT_BOUND_REASON,
  TENANT_ORGANIZER_ACTOR,
  TENANT_OWN,
  TENANT_PRODUCER_TUPLE,
  TENANT_RESOURCE_KINDS,
  TENANT_ROLES,
  TENANT_SCENARIOS,
  TENANT_SETTLER_ACTOR,
  TENANT_SUPPORT_ACTOR,
  TENANT_UNASSIGNED_ACTOR,
  assessTenantSnapshot,
  createNotBoundTenantPermissions,
  createStubTenantPermissions,
  findTenantClaim,
  isTenantRef,
  judgeTenantExport,
  refuseTenantSnapshot,
  tenantApprovableProposals,
  tenantAuthorityTable,
  tenantCapabilities,
  tenantPermissionsPortFor,
  tenantRefFor,
  tenantRefKind,
  tenantRoleResources,
  type TenantActRequest,
  type TenantReadRequest,
  type TenantScenario,
  type TenantScope,
  type TenantSnapshot,
} from "../src/index.js";

const SCOPE_ORGANIZER: TenantScope = { tenantId: TENANT_OWN, role: "organizer" };
const SCOPE_SETTLER: TenantScope = { tenantId: TENANT_OWN, role: "settler" };
const SCOPE_SUPPORT: TenantScope = { tenantId: TENANT_OWN, role: "support" };
const SCOPE_BUYER: TenantScope = { tenantId: TENANT_OWN, role: "buyer" };

function readRequest(actorRef: string, scope: TenantScope, overrides: Partial<TenantReadRequest> = {}): TenantReadRequest {
  return { contextKey: "test-context", actorRef, scope, focusRef: null, roleFloor: null, watermarkFloor: null, ...overrides };
}

function actRequest(actorRef: string, scope: TenantScope, generation: number, action: TenantActRequest["action"]): TenantActRequest {
  return { contextKey: "test-context", actorRef, scope: { ...scope, roleGeneration: generation }, action };
}

async function readySnapshot(
  actorRef: string,
  scope: TenantScope,
  options: { scenario?: TenantScenario } = {},
): Promise<TenantSnapshot> {
  const port = createStubTenantPermissions({ scenario: options.scenario ?? "clean" });
  const outcome = await port.read(readRequest(actorRef, scope));
  expect(outcome.kind).toBe("ready");
  if (outcome.kind !== "ready") {
    throw new Error("unreachable");
  }
  return outcome.snapshot;
}

describe("tenant permission model", () => {
  it("lists every declared scenario, role, capability, and resource kind", () => {
    expect(TENANT_SCENARIOS.length).toBeGreaterThanOrEqual(15);
    expect(TENANT_ROLES).toEqual(["buyer", "organizer", "settler", "support"]);
    expect(TENANT_CAPABILITIES).toContain("export-sensitive");
    expect(TENANT_CAPABILITIES).toContain("read-audit");
    for (const kind of TENANT_RESOURCE_KINDS) {
      expect(typeof kind).toBe("string");
    }
    for (const role of TENANT_ROLES) {
      expect(tenantRoleResources(role).length).toBeGreaterThan(0);
    }
    for (const kind of TENANT_CHANGE_KINDS) {
      expect(TENANT_MAKER_CAPABILITY[kind]).toMatch(/^propose-/);
    }
    expect(TENANT_KNOWN).toContain(TENANT_OWN);
    expect(TENANT_PRODUCER_TUPLE.bound).toBe(false);
    expect(TENANT_PRODUCER_TUPLE.sdkDigest).toBeNull();
  });

  it("keeps read, export, proposal, approval, and audit as separate authority rows", () => {
    const table = tenantAuthorityTable();
    const heldBy = (capability: string) => table.find((row) => row.capability === capability)?.heldBy ?? [];
    expect(heldBy("export-sensitive")).toEqual(["settler"]);
    expect(heldBy("approve-change")).toEqual(["organizer"]);
    expect(heldBy("read-audit")).toEqual(["support"]);
    expect(heldBy("propose-account-change")).toEqual(["settler"]);
    expect(heldBy("propose-role-revoke")).toEqual(["support"]);
    // No role holds every capability: access and execution stay separate.
    for (const role of TENANT_ROLES) {
      expect(tenantCapabilities(role).length).toBeLessThan(TENANT_CAPABILITIES.length);
    }
  });

  it("names refs by kind and never reads one kind as another", () => {
    expect(tenantRefKind("acc-0001")).toBe("account");
    expect(tenantRefKind("ppr-0001")).toBe("proposal");
    expect(tenantRefKind("mbr-0001")).toBe("member");
    expect(tenantRefKind("tck-0001")).toBe("case");
    expect(tenantRefKind("aud-0001")).toBe("audit");
    expect(tenantRefKind("tpx-0001")).toBe("export");
    expect(tenantRefKind("acc-00x1")).toBeNull();
    expect(tenantRefKind("trd-0001")).toBeNull();
    expect(tenantRefFor("proposal", 7)).toBe("ppr-0007");
    expect(isTenantRef("acc-0002", "account")).toBe(true);
    expect(isTenantRef("acc-0002", "member")).toBe(false);
  });
});

describe("role workspaces", () => {
  it("a buyer sees its own membership and its own orders, nothing tenant-wide", async () => {
    const snapshot = await readySnapshot(TENANT_BUYER_ACTOR, SCOPE_BUYER);
    expect(snapshot.scope).toEqual(SCOPE_BUYER);
    expect(snapshot.visibleKinds).toEqual(["member", "order"]);
    expect(snapshot.members.map((row) => row.actorRef)).toEqual([TENANT_BUYER_ACTOR]);
    expect(snapshot.orders.length).toBe(2);
    for (const order of snapshot.orders) {
      expect(order.subjectRef).toBe(TENANT_BUYER_ACTOR);
    }
    expect(snapshot.events).toEqual([]);
    expect(snapshot.accounts).toEqual([]);
    expect(snapshot.cases).toEqual([]);
    expect(snapshot.audit).toEqual([]);
    expect(snapshot.proposals).toEqual([]);
  });

  it("an organizer sees tenant members, events, and proposals but no accounts or audit", async () => {
    const snapshot = await readySnapshot(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER, { scenario: "proposal-pending" });
    expect(snapshot.visibleKinds).toEqual(["member", "event", "proposal"]);
    expect(snapshot.members.length).toBeGreaterThanOrEqual(7);
    expect(snapshot.events.length).toBe(2);
    expect(snapshot.proposals.map((row) => row.proposalRef)).toEqual(["ppr-0001"]);
    expect(snapshot.accounts).toEqual([]);
    expect(snapshot.cases).toEqual([]);
    expect(snapshot.audit).toEqual([]);
  });

  it("a settler sees accounts but no audit record", async () => {
    const snapshot = await readySnapshot(TENANT_SETTLER_ACTOR, SCOPE_SETTLER);
    expect(snapshot.accounts.map((row) => row.accountRef)).toEqual(["acc-0001", "acc-0002"]);
    expect(snapshot.audit).toEqual([]);
    expect(snapshot.cases).toEqual([]);
  });

  it("a support operator sees cases and the tenant audit record", async () => {
    const port = createStubTenantPermissions();
    // Two earlier decisions exist for the audit to record.
    await port.read(readRequest(TENANT_UNASSIGNED_ACTOR, SCOPE_BUYER));
    const outcome = await port.read(readRequest(TENANT_SUPPORT_ACTOR, SCOPE_SUPPORT));
    expect(outcome.kind).toBe("ready");
    if (outcome.kind !== "ready") {
      return;
    }
    expect(outcome.snapshot.cases.length).toBe(2);
    // The audit the read returns predates this read's own entry.
    expect(outcome.snapshot.audit.length).toBeGreaterThanOrEqual(1);
    const denied = outcome.snapshot.audit.find((row) => row.decision === "denied");
    expect(denied?.actorRef).toBe(TENANT_UNASSIGNED_ACTOR);
    expect(outcome.snapshot.audit.every((row) => row.tenantId === TENANT_OWN)).toBe(true);
  });

  it("states every non-claim as the literal false on a ready read", async () => {
    const snapshot = await readySnapshot(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER);
    for (const field of TENANT_NON_CLAIM_FIELDS) {
      expect(snapshot.nonClaims[field]).toBe(false);
    }
    expect(findTenantClaim(snapshot.nonClaims)).toBeNull();
    expect(refuseTenantSnapshot(snapshot)).toBeNull();
  });
});

describe("denied and refused reads", () => {
  it("denies an actor with no assignment and returns no row", async () => {
    const port = createStubTenantPermissions();
    const outcome = await port.read(readRequest(TENANT_UNASSIGNED_ACTOR, SCOPE_BUYER));
    expect(outcome).toMatchObject({ kind: "denied", code: "ROLE_DENIED" });
  });

  it("denies an actor a role it does not hold in that tenant", async () => {
    const port = createStubTenantPermissions();
    const outcome = await port.read(readRequest(TENANT_BUYER_ACTOR, SCOPE_SETTLER));
    expect(outcome).toMatchObject({ kind: "denied", code: "ROLE_DENIED" });
  });

  it("denies an actor asking under a tenant where it holds nothing", async () => {
    const port = createStubTenantPermissions();
    const outcome = await port.read(readRequest(TENANT_ORGANIZER_ACTOR, { tenantId: TENANT_FOREIGN, role: "organizer" }));
    expect(outcome).toMatchObject({ kind: "denied", code: "ROLE_DENIED" });
  });

  it("lets the foreign tenant's own organizer read its own tenant", async () => {
    const port = createStubTenantPermissions();
    const outcome = await port.read(readRequest(TENANT_FOREIGN_ACTOR, { tenantId: TENANT_FOREIGN, role: "organizer" }));
    expect(outcome.kind).toBe("ready");
    if (outcome.kind === "ready") {
      expect(outcome.snapshot.scope.tenantId).toBe(TENANT_FOREIGN);
      expect(outcome.snapshot.members.every((row) => row.tenantId === TENANT_FOREIGN)).toBe(true);
    }
  });

  it("denies every call once the assignment is revoked at the source", async () => {
    const port = createStubTenantPermissions();
    expect(port.synthetic("revoke-role", "mbr-0003")).toBe(true);
    const read = await port.read(readRequest(TENANT_SETTLER_ACTOR, SCOPE_SETTLER));
    expect(read).toMatchObject({ kind: "denied", code: "ROLE_REVOKED" });
    const exported = await port.readExport({ contextKey: "k", actorRef: TENANT_SETTLER_ACTOR, scope: SCOPE_SETTLER });
    expect(exported).toMatchObject({ kind: "denied", code: "ROLE_REVOKED" });
    const acted = await port.act(actRequest(TENANT_SETTLER_ACTOR, SCOPE_SETTLER, 2, { kind: "propose-account-change", accountRef: "acc-0001", note: "x" }));
    expect(acted).toMatchObject({ kind: "denied", code: "ROLE_REVOKED" });
  });

  it("refuses a read payload that mixes another tenant's row", async () => {
    const port = createStubTenantPermissions({ scenario: "tenant-mix" });
    const outcome = await port.read(readRequest(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER));
    expect(outcome.kind).toBe("refused");
    if (outcome.kind === "refused") {
      expect(outcome.code).toBe("SCOPE_LEAK");
      expect(outcome.field).toBe("members[].tenantId");
    }
  });

  it("refuses a read payload that mixes another subject's order", async () => {
    const port = createStubTenantPermissions({ scenario: "subject-mix" });
    const outcome = await port.read(readRequest(TENANT_BUYER_ACTOR, SCOPE_BUYER));
    expect(outcome.kind).toBe("refused");
    if (outcome.kind === "refused") {
      expect(outcome.code).toBe("SUBJECT_LEAK");
    }
  });

  it("refuses a read payload that leaks another tenant's audit entry", async () => {
    const port = createStubTenantPermissions({ scenario: "audit-leak" });
    const outcome = await port.read(readRequest(TENANT_SUPPORT_ACTOR, SCOPE_SUPPORT));
    expect(outcome.kind).toBe("refused");
    if (outcome.kind === "refused") {
      expect(outcome.code).toBe("SCOPE_LEAK");
      expect(outcome.field).toBe("audit[].tenantId");
    }
  });

  it("refuses a payload that claims hidden controls enforce anything", async () => {
    const port = createStubTenantPermissions({ scenario: "claims-enforced" });
    const outcome = await port.read(readRequest(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER));
    expect(outcome).toMatchObject({ kind: "refused", code: "CLAIM", field: "uiHidingIsEnforcement" });
  });

  it("reports a tuple change before any read row is trusted", async () => {
    const port = createStubTenantPermissions({ expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, sdkDigest: "sha256:x" as unknown as null } });
    const outcome = await port.read(readRequest(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER));
    expect(outcome.kind).toBe("tuple-changed");
  });

  it("answers empty for the empty scenario and stale for a read under a newer floor", async () => {
    const empty = await createStubTenantPermissions({ scenario: "empty" }).read(readRequest(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER));
    expect(empty.kind).toBe("empty");
    const stale = await createStubTenantPermissions({ scenario: "stale" }).read(readRequest(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER));
    expect(stale.kind).toBe("stale");
  });
});

describe("deep-open reads", () => {
  it("opens a resource the role may read and reports it as the focus", async () => {
    const port = createStubTenantPermissions();
    const outcome = await port.read(readRequest(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER, { focusRef: "evn-0001" }));
    expect(outcome.kind).toBe("ready");
    if (outcome.kind === "ready") {
      expect(outcome.snapshot.focus?.kind).toBe("event");
    }
  });

  it("a direct URL into a kind the role cannot read is denied, not empty", async () => {
    const port = createStubTenantPermissions();
    const asOrganizer = await port.read(readRequest(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER, { focusRef: "acc-0001" }));
    expect(asOrganizer).toMatchObject({ kind: "denied", code: "RESOURCE_DENIED" });
    const asBuyer = await port.read(readRequest(TENANT_BUYER_ACTOR, SCOPE_BUYER, { focusRef: "tck-0001" }));
    expect(asBuyer).toMatchObject({ kind: "denied", code: "RESOURCE_DENIED" });
  });

  it("a direct URL into another tenant's resource is denied, not substituted", async () => {
    const port = createStubTenantPermissions();
    const outcome = await port.read(readRequest(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER, { focusRef: "evn-9001" }));
    expect(outcome).toMatchObject({ kind: "denied", code: "RESOURCE_DENIED" });
    if (outcome.kind === "denied") {
      expect(outcome.detail).toContain("another tenant");
    }
  });

  it("a buyer deep-open of another subject's order is denied", async () => {
    const port = createStubTenantPermissions();
    const outcome = await port.read(readRequest(TENANT_BUYER_ACTOR, SCOPE_BUYER, { focusRef: "ord-0003" }));
    expect(outcome).toMatchObject({ kind: "denied", code: "RESOURCE_DENIED" });
  });
});

describe("maker/checker proposals", () => {
  it("records an account-change proposal and changes no account", async () => {
    const port = createStubTenantPermissions();
    const outcome = await port.act(
      actRequest(TENANT_SETTLER_ACTOR, SCOPE_SETTLER, 1, {
        kind: "propose-account-change",
        accountRef: "acc-0001",
        note: "Move payout to the reviewed account.",
      }),
    );
    expect(outcome.kind).toBe("applied");
    if (outcome.kind !== "applied") {
      return;
    }
    expect(outcome.receipt.kind).toBe("proposal-recorded");
    expect(outcome.receipt.changeKind).toBe("account-change");
    expect(outcome.receipt.resourceChanged).toBe(false);
    // The next read lists the proposal pending and the account unchanged.
    const read = await port.read(readRequest(TENANT_SETTLER_ACTOR, SCOPE_SETTLER));
    expect(read.kind).toBe("ready");
    if (read.kind === "ready") {
      const proposal = read.snapshot.proposals.find((row) => row.proposalRef === outcome.receipt.proposalRef);
      expect(proposal?.state).toBe("pending");
      expect(proposal?.proposedBy).toBe(TENANT_SETTLER_ACTOR);
      expect(read.snapshot.accounts.find((row) => row.accountRef === "acc-0001")?.accountTail).toBe("tail-3921");
    }
  });

  it("rejects a proposal from a role without the maker capability", async () => {
    const port = createStubTenantPermissions();
    const outcome = await port.act(
      actRequest(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER, 1, {
        kind: "propose-account-change",
        accountRef: "acc-0001",
        note: "Privilege escalation attempt.",
      }),
    );
    expect(outcome).toMatchObject({ kind: "rejected", code: "NO_CAPABILITY" });
  });

  it("rejects a buyer proposing a role revoke and a support approving a proposal", async () => {
    const port = createStubTenantPermissions({ scenario: "proposal-pending" });
    const asBuyer = await port.act(
      actRequest(TENANT_BUYER_ACTOR, SCOPE_BUYER, 1, { kind: "propose-role-revoke", memberRef: "mbr-0001", note: "x" }),
    );
    expect(asBuyer).toMatchObject({ kind: "rejected", code: "NO_CAPABILITY" });
    const asSupport = await port.act(
      actRequest(TENANT_SUPPORT_ACTOR, SCOPE_SUPPORT, 1, { kind: "approve-proposal", proposalRef: "ppr-0001" }),
    );
    expect(asSupport).toMatchObject({ kind: "rejected", code: "NO_CAPABILITY" });
  });

  it("rejects an approval by the proposing actor even when that person holds the checker role", async () => {
    const port = createStubTenantPermissions({ scenario: "self-approval" });
    const outcome = await port.act(
      actRequest(TENANT_DUAL_ACTOR, { tenantId: TENANT_OWN, role: "organizer" }, 1, { kind: "approve-proposal", proposalRef: "ppr-0001" }),
    );
    expect(outcome).toMatchObject({ kind: "rejected", code: "SELF_APPROVAL" });
    if (outcome.kind === "rejected") {
      expect(outcome.detail).toContain("different actor");
    }
  });

  it("records an approval from a different actor and changes no resource", async () => {
    const port = createStubTenantPermissions({ scenario: "proposal-pending" });
    const outcome = await port.act(
      actRequest(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER, 1, { kind: "approve-proposal", proposalRef: "ppr-0001" }),
    );
    expect(outcome.kind).toBe("applied");
    if (outcome.kind !== "applied") {
      return;
    }
    expect(outcome.receipt.kind).toBe("approval-recorded");
    expect(outcome.receipt.approvalChangesResource).toBe(false);
    expect(outcome.receipt.resourceChanged).toBe(false);
    const read = await port.read(readRequest(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER));
    if (read.kind === "ready") {
      expect(read.snapshot.proposals[0]?.state).toBe("approval-recorded");
      expect(read.snapshot.focus).toBeNull();
    }
    // A second approval is rejected: the proposal is no longer pending.
    const again = await port.act(
      actRequest(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER, 1, { kind: "approve-proposal", proposalRef: "ppr-0001" }),
    );
    expect(again).toMatchObject({ kind: "rejected", code: "NOT_PENDING" });
  });

  it("applies an approved change only at the source, never at the approval", async () => {
    const port = createStubTenantPermissions({ scenario: "proposal-pending" });
    await port.act(actRequest(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER, 1, { kind: "approve-proposal", proposalRef: "ppr-0001" }));
    let read = await port.read(readRequest(TENANT_SETTLER_ACTOR, SCOPE_SETTLER));
    if (read.kind === "ready") {
      expect(read.snapshot.accounts.find((row) => row.accountRef === "acc-0001")?.accountTail).toBe("tail-3921");
    }
    expect(port.synthetic("apply-approved-change")).toBe(true);
    read = await port.read(readRequest(TENANT_SETTLER_ACTOR, SCOPE_SETTLER));
    expect(read.kind).toBe("ready");
    if (read.kind === "ready") {
      const account = read.snapshot.accounts.find((row) => row.accountRef === "acc-0001");
      expect(account?.state).toBe("changed-by-source");
      expect(account?.accountTail).toBe("tail-5507");
      expect(read.snapshot.proposals[0]?.state).toBe("applied-by-source");
    }
  });

  it("rejects a write built under an older role generation as ROLE_STALE", async () => {
    const port = createStubTenantPermissions();
    // The organizer assignment moves at the source after the read was taken.
    expect(port.synthetic("rotate-role", "mbr-0002")).toBe(true);
    const outcome = await port.act(
      actRequest(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER, 1, { kind: "approve-proposal", proposalRef: "ppr-0001" }),
    );
    expect(outcome).toMatchObject({ kind: "rejected", code: "ROLE_STALE" });
  });

  it("a read under an older role floor is role-stale, not empty and not stale-by-watermark", async () => {
    const port = createStubTenantPermissions({ scenario: "role-rotated" });
    const outcome = await port.read(readRequest(TENANT_SETTLER_ACTOR, SCOPE_SETTLER, { roleFloor: 1 }));
    expect(outcome).toMatchObject({ kind: "role-stale", expected: 1, actual: 2 });
  });

  it("rejects a proposal on a foreign tenant's member", async () => {
    const port = createStubTenantPermissions();
    const outcome = await port.act(
      actRequest(TENANT_SUPPORT_ACTOR, SCOPE_SUPPORT, 1, { kind: "propose-role-revoke", memberRef: "mbr-0007", note: "x" }),
    );
    expect(outcome).toMatchObject({ kind: "rejected", code: "UNKNOWN_RESOURCE" });
  });

  it("rejects a duplicate pending proposal on the same target", async () => {
    const port = createStubTenantPermissions();
    const first = await port.act(
      actRequest(TENANT_SETTLER_ACTOR, SCOPE_SETTLER, 1, { kind: "propose-account-change", accountRef: "acc-0001", note: "first" }),
    );
    expect(first.kind).toBe("applied");
    const second = await port.act(
      actRequest(TENANT_SETTLER_ACTOR, SCOPE_SETTLER, 1, { kind: "propose-account-change", accountRef: "acc-0001", note: "again" }),
    );
    expect(second).toMatchObject({ kind: "rejected", code: "DUPLICATE_PENDING" });
  });

  it("rejects malformed writes as invalid requests without recording", async () => {
    const port = createStubTenantPermissions();
    const badRef = await port.act(
      actRequest(TENANT_SETTLER_ACTOR, SCOPE_SETTLER, 1, { kind: "propose-account-change", accountRef: "evn-0001", note: "x" }),
    );
    expect(badRef).toMatchObject({ kind: "invalid-request", code: "REF" });
    const badNote = await port.act(
      actRequest(TENANT_SETTLER_ACTOR, SCOPE_SETTLER, 1, { kind: "propose-account-change", accountRef: "acc-0001", note: "  " }),
    );
    expect(badNote).toMatchObject({ kind: "invalid-request", code: "TEXT" });
  });

  it("refuses an approval answer that claims the resource changed", async () => {
    const port = createStubTenantPermissions({ scenario: "approve-claims-applied" });
    const staged = await port.act(
      actRequest(TENANT_SETTLER_ACTOR, SCOPE_SETTLER, 1, { kind: "propose-account-change", accountRef: "acc-0001", note: "x" }),
    );
    expect(staged.kind).toBe("applied");
    const outcome = await port.act(
      actRequest(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER, 1, { kind: "approve-proposal", proposalRef: "ppr-0001" }),
    );
    expect(outcome).toMatchObject({ kind: "refused", code: "CLAIM", field: "resourceChanged" });
  });
});

describe("sensitive export", () => {
  it("denies the export to every role but the settler", async () => {
    const port = createStubTenantPermissions();
    for (const [actor, scope] of [
      [TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER],
      [TENANT_SUPPORT_ACTOR, SCOPE_SUPPORT],
      [TENANT_BUYER_ACTOR, SCOPE_BUYER],
    ] as const) {
      const outcome = await port.readExport({ contextKey: "k", actorRef: actor, scope });
      expect(outcome).toMatchObject({ kind: "denied", code: "EXPORT_DENIED" });
    }
  });

  it("a settler export declares itself synthetic and holds only its own scope rows", async () => {
    const port = createStubTenantPermissions();
    const snapshot = await readySnapshot(TENANT_SETTLER_ACTOR, SCOPE_SETTLER);
    const outcome = await port.readExport({ contextKey: "k", actorRef: TENANT_SETTLER_ACTOR, scope: SCOPE_SETTLER });
    expect(outcome.kind).toBe("ready");
    if (outcome.kind !== "ready") {
      return;
    }
    const exported = outcome.export;
    expect(exported.scopeDeclaration).toEqual({
      provenance: "synthetic",
      realPersonalData: false,
      sharedOutsideTenant: false,
      authorityRecord: false,
      target: "none",
    });
    expect(exported.scope).toEqual(SCOPE_SETTLER);
    expect(exported.rows.length).toBe(snapshot.members.length + snapshot.accounts.length);
    const verdict = judgeTenantExport(snapshot, exported);
    expect(verdict).toEqual({ current: true, reasons: [] });
  });

  it("a leaked export is judged against the last read, not repaired", async () => {
    const port = createStubTenantPermissions({ scenario: "export-leak" });
    const snapshot = await readySnapshot(TENANT_SETTLER_ACTOR, SCOPE_SETTLER);
    const outcome = await port.readExport({ contextKey: "k", actorRef: TENANT_SETTLER_ACTOR, scope: SCOPE_SETTLER });
    expect(outcome.kind).toBe("ready");
    if (outcome.kind !== "ready") {
      return;
    }
    expect(outcome.export.rows.some((row) => row.entryRef === "acc-9001")).toBe(true);
    const verdict = judgeTenantExport(snapshot, outcome.export);
    expect(verdict.current).toBe(false);
    expect(verdict.reasons).toContain("COUNT");
    expect(verdict.reasons).toContain("ROWS_DIFFER");
  });

  it("an export that claims real personal data is refused before a row is returned", async () => {
    const port = createStubTenantPermissions({ scenario: "export-claims-real" });
    const outcome = await port.readExport({ contextKey: "k", actorRef: TENANT_SETTLER_ACTOR, scope: SCOPE_SETTLER });
    expect(outcome).toMatchObject({ kind: "refused", code: "CLAIM", field: "scopeDeclaration" });
  });

  it("the export-denied scenario denies even the settler at the source", async () => {
    const port = createStubTenantPermissions({ scenario: "export-denied" });
    const outcome = await port.readExport({ contextKey: "k", actorRef: TENANT_SETTLER_ACTOR, scope: SCOPE_SETTLER });
    expect(outcome).toMatchObject({ kind: "denied", code: "EXPORT_DENIED" });
  });
});

describe("not-bound port and effects", () => {
  it("the not-bound port answers every call not-bound and moves nothing", async () => {
    const port = createNotBoundTenantPermissions();
    expect(port.source).toBe("none");
    expect(port.environment).toBe("integration-http");
    const read = await port.read(readRequest(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER));
    expect(read).toMatchObject({ kind: "not-bound", reason: TENANT_NOT_BOUND_REASON });
    const exported = await port.readExport({ contextKey: "k", actorRef: TENANT_SETTLER_ACTOR, scope: SCOPE_SETTLER });
    expect(exported).toMatchObject({ kind: "not-bound" });
    const acted = await port.act(actRequest(TENANT_SETTLER_ACTOR, SCOPE_SETTLER, 1, { kind: "propose-account-change", accountRef: "acc-0001", note: "x" }));
    expect(acted).toMatchObject({ kind: "not-bound" });
    expect(port.synthetic("rotate-role", "mbr-0001")).toBe(false);
  });

  it("portFor gives the stub only for stub and never falls back", () => {
    expect(tenantPermissionsPortFor("stub").source).toBe("synthetic-tenant-permissions");
    expect(tenantPermissionsPortFor("integration-http").source).toBe("none");
    expect(tenantPermissionsPortFor("integration-http").environment).toBe("integration-http");
  });

  it("a lost read answer rejects the promise so the client marks it unknown", async () => {
    const port = createStubTenantPermissions({ scenario: "read-lost" });
    await expect(port.read(readRequest(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER))).rejects.toThrow();
  });

  it("a lost request answer was recorded at the source even though it never arrived", async () => {
    const port = createStubTenantPermissions({ scenario: "act-lost" });
    await expect(
      port.act(actRequest(TENANT_SETTLER_ACTOR, SCOPE_SETTLER, 1, { kind: "propose-account-change", accountRef: "acc-0001", note: "x" })),
    ).rejects.toThrow();
    const read = await port.read(readRequest(TENANT_SETTLER_ACTOR, SCOPE_SETTLER));
    expect(read.kind).toBe("ready");
    if (read.kind === "ready") {
      expect(read.snapshot.proposals.length).toBe(1);
    }
  });

  it("counts the effects that reached the source", async () => {
    const port = createStubTenantPermissions();
    await port.read(readRequest(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER));
    await port.read(readRequest(TENANT_UNASSIGNED_ACTOR, SCOPE_BUYER));
    expect(port.effects()).toEqual({ reads: 2, exports: 0, acts: 0 });
  });
});

describe("assessment helpers", () => {
  it("separates pending proposals from the ones this actor may approve", async () => {
    const snapshot = await readySnapshot(TENANT_ORGANIZER_ACTOR, SCOPE_ORGANIZER, { scenario: "proposal-pending" });
    const assessment = assessTenantSnapshot(snapshot, TENANT_ORGANIZER_ACTOR);
    expect(assessment.pending.length).toBe(1);
    expect(assessment.approvable.length).toBe(1);
    // The proposing settler may not approve its own proposal.
    const settlerView = assessTenantSnapshot(snapshot, TENANT_SETTLER_ACTOR);
    expect(settlerView.approvable.length).toBe(0);
    expect(tenantApprovableProposals(snapshot, TENANT_SETTLER_ACTOR).length).toBe(0);
    // Targets for the maker actions come from the read: the organizer sees the
    // members it may name for a revoke, never its own assignment.
    expect(assessment.memberTargets.map((row) => row.memberRef)).not.toContain("mbr-0002");
    expect(assessment.memberTargets.length).toBeGreaterThan(0);
  });
});
