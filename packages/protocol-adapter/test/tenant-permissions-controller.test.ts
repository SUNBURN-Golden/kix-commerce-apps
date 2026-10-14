import { describe, expect, it } from "vitest";
import {
  TENANT_BUYER_ACTOR,
  TENANT_DUAL_ACTOR,
  TENANT_FOREIGN,
  TENANT_NOT_BOUND_REASON,
  TENANT_ORGANIZER_ACTOR,
  TENANT_OWN,
  TENANT_SETTLER_ACTOR,
  TENANT_SUPPORT_ACTOR,
  TenantPermissionsController,
  createNotBoundTenantPermissions,
  createStubTenantPermissions,
  type StubTenantPermissions,
  type TenantActOutcome,
  type TenantActRequest,
  type TenantExportOutcome,
  type TenantExportRequest,
  type TenantPermissionsPort,
  type TenantReadOutcome,
  type TenantReadRequest,
  type TenantRole,
  type TenantScenario,
} from "../src/index.js";

function controllerFor(
  scenario: TenantScenario = "clean",
  options: { actorRef?: string; tenantId?: string; role?: TenantRole } = {},
) {
  const port = createStubTenantPermissions({ scenario });
  const controller = new TenantPermissionsController(port, {
    actorRef: options.actorRef ?? TENANT_ORGANIZER_ACTOR,
    tenantId: options.tenantId,
    role: options.role,
  });
  return { port, controller };
}

/** Counts calls and can hold a read, an export, or a request so ordering can be staged. */
function spyOn(inner: StubTenantPermissions, options: { holdReads?: boolean; holdExports?: boolean; holdActs?: boolean } = {}) {
  const readRequests: TenantReadRequest[] = [];
  const exportRequests: TenantExportRequest[] = [];
  const actRequests: TenantActRequest[] = [];
  const heldReads: { release: () => void }[] = [];
  const heldExports: { release: () => void }[] = [];
  const heldActs: { release: () => void }[] = [];
  const port: TenantPermissionsPort = {
    environment: inner.environment,
    source: inner.source,
    scenario: inner.scenario,
    read(request) {
      readRequests.push(structuredClone(request));
      if (!options.holdReads) {
        return inner.read(request);
      }
      return new Promise<TenantReadOutcome>((resolve, reject) => {
        heldReads.push({ release: () => void inner.read(request).then(resolve, reject) });
      });
    },
    readExport(request) {
      exportRequests.push(structuredClone(request));
      if (!options.holdExports) {
        return inner.readExport(request);
      }
      return new Promise<TenantExportOutcome>((resolve, reject) => {
        heldExports.push({ release: () => void inner.readExport(request).then(resolve, reject) });
      });
    },
    act(request) {
      actRequests.push(structuredClone(request));
      if (!options.holdActs) {
        return inner.act(request);
      }
      return new Promise<TenantActOutcome>((resolve, reject) => {
        heldActs.push({ release: () => void inner.act(request).then(resolve, reject) });
      });
    },
    synthetic: (control, ref) => inner.synthetic(control, ref),
  };
  return { port, readRequests, exportRequests, actRequests, heldReads, heldExports, heldActs };
}

describe("tenant controller context and reads", () => {
  it("keys the context on mode, domain, actor, tenant, role, and incarnation", () => {
    const { controller } = controllerFor();
    const context = controller.state().context;
    expect(context).toMatchObject({
      environment: "stub",
      actorRef: TENANT_ORGANIZER_ACTOR,
      incarnation: 1,
      scope: { tenantId: TENANT_OWN, role: "organizer" },
    });
    expect(context.key).toBe(`stub|${context.domain}|${TENANT_ORGANIZER_ACTOR}|${TENANT_OWN}|organizer|1`);
  });

  it("starts with no read, no export, no fence, and no usable freshness", () => {
    const { controller } = controllerFor();
    const state = controller.state();
    expect(state.readState).toBe("none");
    expect(state.snapshot).toBeNull();
    expect(state.freshness).toBe("UNAVAILABLE");
    expect(state.export.phase).toBe("none");
    expect(state.fence).toBeNull();
    expect(state.behind).toBe(false);
  });

  it("applies a ready read and keeps the snapshot, assessment, and watermark", async () => {
    const { controller } = controllerFor();
    const result = await controller.read();
    expect(result).toEqual({ kind: "APPLIED", readState: "ready" });
    const state = controller.state();
    expect(state.snapshot?.scope.role).toBe("organizer");
    expect(state.assessment?.accountTargets.length).toBe(0);
    expect(state.freshness).toBe("CURRENT");
  });

  it("a denied read leaves no row of an earlier read on screen", async () => {
    const { port, controller } = controllerFor();
    await controller.read();
    expect(controller.state().snapshot).not.toBeNull();
    port.synthetic("revoke-role", "mbr-0002");
    const result = await controller.read();
    expect(result).toEqual({ kind: "APPLIED", readState: "denied" });
    const state = controller.state();
    expect(state.snapshot).toBeNull();
    expect(state.readCode).toBe("ROLE_REVOKED");
  });

  it("marks a stale read stale and a role-stale read role-stale, both without rows", async () => {
    const stale = controllerFor("stale");
    await stale.controller.read();
    expect(stale.controller.state().readState).toBe("stale");
    expect(stale.controller.state().freshness).toBe("STALE");

    const rotated = controllerFor("clean", { actorRef: TENANT_SETTLER_ACTOR, role: "settler" });
    await rotated.controller.read();
    expect(rotated.controller.state().snapshot?.roleGeneration).toBe(1);
    // The assignment moves at the source; a read built under the old generation
    // comes back role-stale and leaves no row on screen.
    rotated.port.synthetic("rotate-role", "mbr-0003");
    await rotated.controller.read();
    expect(rotated.controller.state().readState).toBe("role-stale");
    expect(rotated.controller.state().freshness).toBe("STALE");
    expect(rotated.controller.state().snapshot).toBeNull();
  });

  it("sends the last read's role floor and generation on the wire", async () => {
    const inner = createStubTenantPermissions();
    const spy = spyOn(inner);
    const controller = new TenantPermissionsController(spy.port, { actorRef: TENANT_SETTLER_ACTOR, role: "settler" });
    await controller.read();
    expect(spy.readRequests[0]?.roleFloor).toBeNull();
    await controller.read();
    expect(spy.readRequests[1]?.roleFloor).toBe(1);
    const result = await controller.proposeAccountChange("acc-0001", "Move the payout account.");
    expect(result.kind).toBe("APPLIED");
    expect(spy.actRequests[0]?.scope.roleGeneration).toBe(1);
  });

  it("drops a read that lands after the role context changed", async () => {
    const inner = createStubTenantPermissions();
    const spy = spyOn(inner, { holdReads: true });
    const controller = new TenantPermissionsController(spy.port, { actorRef: TENANT_DUAL_ACTOR, role: "organizer" });
    const pending = controller.read();
    controller.switchRole("support");
    spy.heldReads[0]!.release();
    const result = await pending;
    expect(result).toEqual({ kind: "DROPPED", cause: "context-changed" });
    const state = controller.state();
    expect(state.context.scope.role).toBe("support");
    expect(state.context.incarnation).toBe(2);
    expect(state.readState).toBe("none");
    expect(state.snapshot).toBeNull();
    expect(state.counters.droppedReads).toBe(1);
    // The new context reads the support workspace, not the organizer's.
    const next = controller.read();
    spy.heldReads[1]!.release();
    expect(await next).toEqual({ kind: "APPLIED", readState: "ready" });
    expect(controller.state().snapshot?.scope.role).toBe("support");
    expect(controller.state().snapshot?.cases.length).toBeGreaterThan(0);
  });

  it("drops an older read answer when a newer read already applied", async () => {
    const inner = createStubTenantPermissions();
    const spy = spyOn(inner, { holdReads: true });
    const controller = new TenantPermissionsController(spy.port);
    const first = controller.read();
    const second = controller.read();
    spy.heldReads[1]!.release();
    await second;
    spy.heldReads[0]!.release();
    const firstResult = await first;
    expect(firstResult).toEqual({ kind: "DROPPED", cause: "older-read" });
  });
});

describe("tenant controller deep-open and scope switching", () => {
  it("deep-opens a ref inside the role's kinds and denies one outside them", async () => {
    const { controller } = controllerFor();
    const ok = await controller.read("evn-0001");
    expect(ok).toEqual({ kind: "APPLIED", readState: "ready" });
    expect(controller.state().snapshot?.focus?.kind).toBe("event");
    const denied = await controller.read("acc-0001");
    expect(denied).toEqual({ kind: "APPLIED", readState: "denied" });
    expect(controller.state().readCode).toBe("RESOURCE_DENIED");
    expect(controller.state().snapshot).toBeNull();
  });

  it("a deep-open into another tenant's resource is denied and keeps no row", async () => {
    const { controller } = controllerFor();
    const result = await controller.read("evn-9001");
    expect(result).toEqual({ kind: "APPLIED", readState: "denied" });
    expect(controller.state().readCode).toBe("RESOURCE_DENIED");
  });

  it("a tenant switch clears the view and drops a read in flight for the old tenant", async () => {
    const inner = createStubTenantPermissions();
    const spy = spyOn(inner, { holdReads: true });
    const controller = new TenantPermissionsController(spy.port, { actorRef: "person-foreign", tenantId: TENANT_FOREIGN, role: "organizer" });
    const pending = controller.read();
    controller.switchTenant(TENANT_OWN);
    spy.heldReads[0]!.release();
    const result = await pending;
    expect(result).toEqual({ kind: "DROPPED", cause: "context-changed" });
    const state = controller.state();
    expect(state.context.scope.tenantId).toBe(TENANT_OWN);
    expect(state.snapshot).toBeNull();
    // The own tenant read is denied: this actor holds nothing there.
    const next = controller.read();
    spy.heldReads[1]!.release();
    expect(await next).toEqual({ kind: "APPLIED", readState: "denied" });
  });

  it("a role switch for the same person starts a new session that shares no rows", async () => {
    const { controller } = controllerFor("clean", { actorRef: TENANT_DUAL_ACTOR, role: "organizer" });
    await controller.read();
    expect(controller.state().snapshot?.events.length).toBe(2);
    const before = controller.state().context.key;
    const next = controller.switchRole("support");
    expect(next?.incarnation).toBe(2);
    expect(controller.state().context.key).not.toBe(before);
    expect(controller.state().snapshot).toBeNull();
    await controller.read();
    const state = controller.state();
    expect(state.snapshot?.events.length).toBe(0);
    expect(state.snapshot?.cases.length).toBe(2);
  });
});

describe("tenant controller sends", () => {
  it("a settler proposes an account change from the read, and the answer marks the view behind", async () => {
    const { controller } = controllerFor("clean", { actorRef: TENANT_SETTLER_ACTOR, role: "settler" });
    await controller.read();
    expect(controller.canSend("propose-account-change").allowed).toBe(true);
    const result = await controller.proposeAccountChange("acc-0001", "Move the payout account.");
    expect(result.kind).toBe("APPLIED");
    if (result.kind !== "APPLIED") {
      return;
    }
    expect(result.record.receipt?.kind).toBe("proposal-recorded");
    expect(controller.state().behind).toBe(true);
    // Until a newer ready read lands, the next send is fenced by the stale read.
    const next = await controller.proposeAccountChange("acc-0002", "Another.");
    expect(next.kind).toBe("NOT_SENT");
    if (next.kind === "NOT_SENT") {
      expect(next.reason).toBe("stale-read");
    }
  });

  it("a send with no read is not sent, and no port call is made", async () => {
    const inner = createStubTenantPermissions();
    const spy = spyOn(inner);
    const controller = new TenantPermissionsController(spy.port, { actorRef: TENANT_SETTLER_ACTOR, role: "settler" });
    const result = await controller.proposeAccountChange("acc-0001", "x");
    expect(result).toEqual({ kind: "NOT_SENT", reason: "no-snapshot", detail: expect.any(String) });
    expect(spy.actRequests.length).toBe(0);
  });

  it("a send by a role without the capability is not sent, and the port is never called", async () => {
    const inner = createStubTenantPermissions();
    const spy = spyOn(inner);
    const controller = new TenantPermissionsController(spy.port, { actorRef: TENANT_ORGANIZER_ACTOR, role: "organizer" });
    await controller.read();
    const result = await controller.proposeAccountChange("acc-0001", "Privilege escalation.");
    expect(result.kind).toBe("NOT_SENT");
    if (result.kind === "NOT_SENT") {
      expect(result.reason).toBe("no-capability");
    }
    // The screen never sent it. And when a request does reach the port anyway,
    // the source runs its own check.
    expect(spy.actRequests.length).toBe(0);
    const direct = await spy.port.act({
      contextKey: "direct",
      actorRef: TENANT_ORGANIZER_ACTOR,
      scope: { tenantId: TENANT_OWN, role: "organizer", roleGeneration: 1 },
      action: { kind: "propose-account-change", accountRef: "acc-0001", note: "x" },
    });
    expect(direct).toMatchObject({ kind: "rejected", code: "NO_CAPABILITY" });
  });

  it("an organizer approves a proposal another actor made; the settler cannot approve its own", async () => {
    const { controller } = controllerFor("proposal-pending");
    await controller.read();
    const eligibility = controller.canSend("approve-proposal");
    expect(eligibility.allowed).toBe(true);
    const result = await controller.approveProposal("ppr-0001");
    expect(result.kind).toBe("APPLIED");

    const settler = controllerFor("proposal-pending", { actorRef: TENANT_SETTLER_ACTOR, role: "settler" });
    await settler.controller.read();
    const own = settler.controller.canSend("approve-proposal");
    expect(own.allowed).toBe(false);
    expect(own.reason).toContain("approve-change");
  });

  it("the same person's second role does not approve its first role's proposal", async () => {
    // The dual-role person proposed a role-revoke as support. Switching the same
    // person to the organizer role does not make the approval sendable, and the
    // source rejects it even if a request reaches it.
    const { port, controller } = controllerFor("self-approval", { actorRef: TENANT_DUAL_ACTOR, role: "support" });
    await controller.read();
    controller.switchRole("organizer");
    await controller.read();
    const result = await controller.approveProposal("ppr-0001");
    expect(result.kind).toBe("NOT_SENT");
    if (result.kind === "NOT_SENT") {
      expect(result.reason).toBe("blocked");
      expect(result.detail).toContain("different actor");
    }
    const direct = await port.act({
      contextKey: "direct",
      actorRef: TENANT_DUAL_ACTOR,
      scope: { tenantId: TENANT_OWN, role: "organizer", roleGeneration: 1 },
      action: { kind: "approve-proposal", proposalRef: "ppr-0001" },
    });
    expect(direct).toMatchObject({ kind: "rejected", code: "SELF_APPROVAL" });
  });

  it("a write built under a rotated role is rejected ROLE_STALE and marks the view behind", async () => {
    const { port, controller } = controllerFor("proposal-pending");
    await controller.read();
    port.synthetic("rotate-role", "mbr-0002");
    const result = await controller.approveProposal("ppr-0001");
    expect(result.kind).toBe("REJECTED");
    if (result.kind === "REJECTED") {
      expect(result.record.code).toBe("ROLE_STALE");
    }
    expect(controller.state().behind).toBe(true);
  });

  it("an unknown request outcome fences every later request until a new context", async () => {
    const inner = createStubTenantPermissions();
    const port: TenantPermissionsPort = {
      environment: inner.environment,
      source: inner.source,
      scenario: inner.scenario,
      read: (request) => inner.read(request),
      readExport: (request) => inner.readExport(request),
      act: () => Promise.resolve({ kind: "unknown", message: "The answer to the request never arrived." }),
      synthetic: (control, ref) => inner.synthetic(control, ref),
    };
    const controller = new TenantPermissionsController(port, { actorRef: TENANT_SETTLER_ACTOR, role: "settler" });
    await controller.read();
    const result = await controller.proposeAccountChange("acc-0001", "x");
    expect(result.kind).toBe("UNKNOWN");
    const second = await controller.proposeAccountChange("acc-0002", "y");
    expect(second.kind).toBe("FENCED");
    if (second.kind === "FENCED") {
      expect(second.fence.reason).toBe("unknown-outcome");
    }
    // A role switch starts a new context and counts the unknown outcome.
    controller.switchRole("buyer");
    expect(controller.state().earlierUnknown).toBe(1);
  });

  it("fences a second send while the first is in flight", async () => {
    const inner = createStubTenantPermissions();
    const spy = spyOn(inner, { holdActs: true });
    const controller = new TenantPermissionsController(spy.port, { actorRef: TENANT_SETTLER_ACTOR, role: "settler" });
    await controller.read();
    const pending = controller.proposeAccountChange("acc-0001", "first");
    const during = await controller.proposeAccountChange("acc-0002", "second");
    expect(during.kind).toBe("FENCED");
    if (during.kind === "FENCED") {
      expect(during.fence.reason).toBe("in-flight");
    }
    spy.heldActs[0]!.release();
    const result = await pending;
    expect(result.kind).toBe("APPLIED");
  });
});

describe("tenant controller export", () => {
  it("a settler export is judged against the last read and turns stale when it moves", async () => {
    const { port, controller } = controllerFor("proposal-pending", { actorRef: TENANT_SETTLER_ACTOR, role: "settler" });
    await controller.read();
    expect(controller.canExport().allowed).toBe(true);
    const loaded = await controller.loadExport();
    expect(loaded).toEqual({ kind: "APPLIED", phase: "loaded" });
    expect(controller.state().export.verdict).toEqual({ current: true, reasons: [] });
    // The account change applies at the source; the next read moves the rows the
    // export was judged against.
    await port.act({
      contextKey: "k",
      actorRef: TENANT_ORGANIZER_ACTOR,
      scope: { tenantId: TENANT_OWN, role: "organizer", roleGeneration: 1 },
      action: { kind: "approve-proposal", proposalRef: "ppr-0001" },
    });
    port.synthetic("apply-approved-change");
    await controller.read();
    const verdict = controller.state().export.verdict;
    expect(verdict?.current).toBe(false);
    expect(verdict?.reasons).toContain("ROWS_DIFFER");
  });

  it("a role without the export capability cannot send one, and the port decides the same", async () => {
    const inner = createStubTenantPermissions();
    const spy = spyOn(inner);
    const controller = new TenantPermissionsController(spy.port, { actorRef: TENANT_ORGANIZER_ACTOR, role: "organizer" });
    await controller.read();
    const eligibility = controller.canExport();
    expect(eligibility.allowed).toBe(false);
    const result = await controller.loadExport();
    expect(result).toEqual({ kind: "NOT_SENT", reason: "no-capability", detail: expect.any(String) });
    expect(spy.exportRequests.length).toBe(0);
  });

  it("a denied export answer leaves no export value on screen", async () => {
    const inner = createStubTenantPermissions({ scenario: "export-denied" });
    const spy = spyOn(inner);
    const controller = new TenantPermissionsController(spy.port, { actorRef: TENANT_SETTLER_ACTOR, role: "settler" });
    await controller.read();
    const result = await controller.loadExport();
    expect(result).toEqual({ kind: "APPLIED", phase: "denied" });
    const state = controller.state();
    expect(state.export.phase).toBe("denied");
    expect(state.export.code).toBe("EXPORT_DENIED");
    expect(state.export.value).toBeNull();
  });

  it("a refused export (a foreign row inside it) is shown refused and never displayed", async () => {
    // The export-leak payload reaches the page but is judged against the read:
    // it is not current and its rows are not shown as the tenant's own.
    const inner = createStubTenantPermissions({ scenario: "export-leak" });
    const spy = spyOn(inner);
    const controller = new TenantPermissionsController(spy.port, { actorRef: TENANT_SETTLER_ACTOR, role: "settler" });
    await controller.read();
    const result = await controller.loadExport();
    expect(result).toEqual({ kind: "APPLIED", phase: "loaded" });
    const verdict = controller.state().export.verdict;
    expect(verdict?.current).toBe(false);
    expect(verdict?.reasons).toContain("ROWS_DIFFER");
  });

  it("an export that lands after a context switch is dropped", async () => {
    const inner = createStubTenantPermissions();
    const spy = spyOn(inner, { holdExports: true });
    const controller = new TenantPermissionsController(spy.port, { actorRef: TENANT_SETTLER_ACTOR, role: "settler" });
    await controller.read();
    const pending = controller.loadExport();
    controller.switchRole("buyer");
    spy.heldExports[0]!.release();
    const result = await pending;
    expect(result).toEqual({ kind: "DROPPED", cause: "context-changed" });
    expect(controller.state().counters.droppedExports).toBe(1);
  });
});

describe("tenant controller not-bound", () => {
  it("a not-bound port reads not-bound, sends nothing, and shows the reason", async () => {
    const controller = new TenantPermissionsController(createNotBoundTenantPermissions());
    const read = await controller.read();
    expect(read).toEqual({ kind: "APPLIED", readState: "not-bound" });
    expect(controller.state().readDetail).toBe(TENANT_NOT_BOUND_REASON);
    const exported = await controller.loadExport();
    expect(exported).toEqual({ kind: "NOT_SENT", reason: "not-bound", detail: TENANT_NOT_BOUND_REASON });
    const acted = await controller.approveProposal("ppr-0001");
    expect(acted.kind).toBe("NOT_SENT");
    if (acted.kind === "NOT_SENT") {
      expect(acted.reason).toBe("not-bound");
    }
    const counters = controller.state().counters;
    expect(counters.acts).toBe(0);
    expect(counters.exports).toBe(0);
  });
});

describe("support role workspace on the desk", () => {
  it("the support role reads cases and audit but sends no export", async () => {
    const { controller } = controllerFor("clean", { actorRef: TENANT_SUPPORT_ACTOR, role: "support" });
    // A denied deep-open is a decision the source records in the audit trail.
    await controller.read("acc-0001");
    expect(controller.state().readState).toBe("denied");
    await controller.read();
    const state = controller.state();
    expect(state.snapshot?.cases.length).toBe(2);
    expect(state.snapshot?.audit.length).toBeGreaterThanOrEqual(1);
    expect(state.snapshot?.audit.some((row) => row.decision === "denied" && row.targetRef === "acc-0001")).toBe(true);
    expect(controller.canExport().allowed).toBe(false);
    expect(controller.canSend("propose-role-revoke").allowed).toBe(true);
    const result = await controller.proposeRoleRevoke("mbr-0001", "Close out the membership.");
    expect(result.kind).toBe("APPLIED");
  });

  it("the buyer role reads only its own rows", async () => {
    const { controller } = controllerFor("clean", { actorRef: TENANT_BUYER_ACTOR, role: "buyer" });
    await controller.read();
    const state = controller.state();
    expect(state.snapshot?.visibleKinds).toEqual(["member", "order"]);
    expect(state.snapshot?.members.map((row) => row.actorRef)).toEqual([TENANT_BUYER_ACTOR]);
  });
});
