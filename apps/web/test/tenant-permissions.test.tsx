import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  TENANT_BUYER_ACTOR,
  TENANT_DUAL_ACTOR,
  TENANT_NOT_BOUND_REASON,
  TENANT_ORGANIZER_ACTOR,
  TENANT_SCENARIOS,
  TENANT_SETTLER_ACTOR,
  TENANT_SUPPORT_ACTOR,
  TENANT_UNASSIGNED_ACTOR,
  TenantPermissionsController,
  createNotBoundTenantPermissions,
  createStubTenantPermissions,
  type StubTenantPermissions,
  type TenantRole,
  type TenantScenario,
} from "@kix/protocol-adapter";
import { FIXTURE_SCREENS, fixturesForScreen } from "../../../packages/protocol-adapter/src/contract-fixtures";
import { LOCAL_SURFACE_EVIDENCE, PENDING_PRODUCERS } from "../src/handoff/packet";
import { buildTenantModel, type TenantActions, type TenantLastAction, type TenantModel } from "../src/tenant-permissions";
import {
  TenantAuditSection,
  TenantAuthoritySection,
  TenantBanner,
  TenantControls,
  TenantExportSection,
  TenantFocusSection,
  TenantProposalsSection,
  TenantRequestsSection,
  TenantSessionSection,
  TenantStatus,
  TenantWorkspaceSection,
} from "../src/pages/TenantPermissionsPanels";
import { TenantPermissionsPage } from "../src/pages/TenantPermissions";
import { WORKSPACE_RULING, WORKSPACE_SURFACES } from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

const BANNED = /[$₩]|KRW|USD/i;

const POSITIVE_CLAIMS = [
  "Access granted by the page",
  "Permission granted",
  "Real permission",
  "Role assigned",
  "Access revoked by the operator",
  "Audit complete",
  "Integration complete",
];

const NO_ACTIONS: TenantActions = {
  refresh() {},
  openResource() {},
  loadExport() {},
  proposeAccountChange() {},
  proposeRoleRevoke() {},
  approveProposal() {},
  switchRole() {},
  switchActor() {},
  switchTenant() {},
  revokeRole() {},
  rotateRole() {},
  applyApproved() {},
  setScenario() {},
  newSession() {},
};

function html(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element);
}

function pageHtml(
  model: TenantModel,
  scenario: TenantScenario = "clean",
  environment: "stub" | "integration-http" = "stub",
  actorRef: string = TENANT_ORGANIZER_ACTOR,
  role: TenantRole = "organizer",
): string {
  return html(
    <MemoryRouter>
      <TenantBanner environment={environment} scenario={scenario} model={model} />
      <TenantControls scenario={scenario} actorRef={actorRef} role={role} model={model} actions={NO_ACTIONS} />
      <TenantStatus model={model} />
      <TenantAuthoritySection model={model} />
      <TenantFocusSection model={model} />
      <TenantWorkspaceSection model={model} actions={NO_ACTIONS} />
      <TenantProposalsSection model={model} actions={NO_ACTIONS} />
      <TenantAuditSection model={model} />
      <TenantExportSection model={model} />
      <TenantRequestsSection model={model} />
      <TenantSessionSection session={model.session} />
    </MemoryRouter>,
  );
}

function expectClean(markup: string): void {
  expect(markup).not.toMatch(BANNED);
  for (const claim of POSITIVE_CLAIMS) {
    expect(markup, claim).not.toContain(claim);
  }
}

interface Rig {
  port: StubTenantPermissions;
  controller: TenantPermissionsController;
  last: TenantLastAction | null;
}

function rig(scenario: TenantScenario = "clean", actorRef: string = TENANT_ORGANIZER_ACTOR, role: TenantRole = "organizer"): Rig {
  const port = createStubTenantPermissions({ scenario });
  return { port, controller: new TenantPermissionsController(port, { actorRef, role }), last: null };
}

function modelOf(r: Rig): TenantModel {
  return buildTenantModel({ controller: r.controller, last: r.last });
}

/** Every id a describedby points at must exist in the markup. */
function expectDescribedByTargets(markup: string): void {
  for (const match of markup.matchAll(/aria-describedby="([^"]+)"/g)) {
    const id = match[1];
    expect(markup, `missing describedby target ${id}`).toContain(`id="${id}"`);
  }
}

async function ready(r: Rig): Promise<void> {
  const result = await r.controller.read();
  expect(result).toMatchObject({ kind: "APPLIED", readState: "ready" });
}

describe("tenant permissions page states", () => {
  it("lists every scenario on the scenario control and keeps each note", async () => {
    for (const scenario of TENANT_SCENARIOS) {
      const r = rig(scenario);
      await r.controller.read();
      const markup = pageHtml(modelOf(r), scenario);
      expectClean(markup);
      expect(markup).toContain(`data-scenario-note="${scenario}"`);
      expect(markup).toContain(`value="${scenario}"`);
    }
  });

  it("states synthetic provenance, the ruling, the hold record, and the not-composed record", async () => {
    const r = rig();
    await ready(r);
    const markup = pageHtml(modelOf(r));
    expect(markup).toContain('data-provenance="synthetic"');
    expect(markup).toContain('data-source="synthetic-tenant-permissions"');
    expect(markup).toContain(WORKSPACE_RULING);
    expect(markup).toContain('data-hold-record="not-bound"');
    expect(markup).toContain("reserve_listing");
    expect(markup).toContain('data-not-composed="recorded"');
    expect(markup).toContain("hidden");
    expectClean(markup);
  });

  it("an organizer workspace lists members, events, and proposals but no account or audit table", async () => {
    const r = rig("proposal-pending");
    await ready(r);
    const markup = pageHtml(modelOf(r));
    expect(markup).toContain('data-member="mbr-0002"');
    expect(markup).toContain('data-event="evn-0001"');
    expect(markup).toContain('data-proposal="ppr-0001"');
    expect(markup).not.toContain("data-account=");
    expect(markup).not.toContain("data-audit=");
    expect(markup).toContain("This role&#x27;s workspace lists: member, event, proposal");
    // The organizer holds no propose-role-revoke capability, so a member row names it.
    expect(markup).toContain("No revoke control for this role.");
    expectClean(markup);
  });

  it("a buyer workspace lists only its own membership and its own orders", async () => {
    const r = rig("clean", TENANT_BUYER_ACTOR, "buyer");
    await ready(r);
    const markup = pageHtml(modelOf(r), "clean", "stub", TENANT_BUYER_ACTOR, "buyer");
    expect(markup).toContain('data-member="mbr-0001"');
    expect(markup).not.toContain('data-member="mbr-0002"');
    expect(markup).toContain('data-order="ord-0001"');
    expect(markup).toContain('data-order="ord-0002"');
    expect(markup).not.toContain("ord-0003");
    expect(markup).not.toContain("data-event=");
    expectClean(markup);
  });

  it("a settler workspace lists accounts and no audit; a support workspace lists cases and audit", async () => {
    const settler = rig("clean", TENANT_SETTLER_ACTOR, "settler");
    await ready(settler);
    const settlerMarkup = pageHtml(modelOf(settler), "clean", "stub", TENANT_SETTLER_ACTOR, "settler");
    expect(settlerMarkup).toContain('data-account="acc-0001"');
    expect(settlerMarkup).toContain("tail-3921");
    expect(settlerMarkup).not.toContain("data-audit=");
    expectClean(settlerMarkup);

    const support = rig("clean", TENANT_SUPPORT_ACTOR, "support");
    await support.controller.read("acc-0001");
    await support.controller.read();
    const supportMarkup = pageHtml(modelOf(support), "clean", "stub", TENANT_SUPPORT_ACTOR, "support");
    expect(supportMarkup).toContain('data-case="tck-0001"');
    expect(supportMarkup).toContain('data-audit="aud-0001"');
    expect(supportMarkup).toContain('data-audit-decision="denied"');
    expectClean(supportMarkup);
  });

  it("the authority table names every capability and which roles hold it", async () => {
    const r = rig();
    await ready(r);
    const markup = pageHtml(modelOf(r));
    for (const capability of ["read-own", "read-tenant", "read-audit", "propose-account-change", "propose-role-revoke", "approve-change", "export-sensitive"]) {
      expect(markup).toContain(`data-capability="${capability}"`);
    }
    expect(markup).toContain('data-held-by-role="true"');
    expectClean(markup);
  });
});

describe("tenant permissions denied and direct open", () => {
  it("a denied read shows the denial and no workspace row", async () => {
    const r = rig("clean", TENANT_UNASSIGNED_ACTOR, "buyer");
    await r.controller.read();
    const model = modelOf(r);
    expect(model.state).toBe("denied");
    const markup = pageHtml(model, "clean", "stub", TENANT_UNASSIGNED_ACTOR, "buyer");
    expect(markup).toContain('data-status="denied"');
    expect(markup).toContain("ROLE_DENIED");
    expect(markup).not.toContain("data-member=");
    expectClean(markup);
  });

  it("a direct open of a kind outside the role shows denied, not the row", async () => {
    const r = rig();
    const result = await r.controller.read("acc-0001");
    expect(result).toMatchObject({ kind: "APPLIED", readState: "denied" });
    const model = modelOf(r);
    expect(model.state).toBe("denied");
    const markup = pageHtml(model);
    expect(markup).toContain('data-status="denied"');
    expect(markup).toContain("RESOURCE_DENIED");
    expect(markup).not.toContain("tail-3921");
    expectClean(markup);
  });

  it("a direct open of another tenant's resource shows denied, never the row", async () => {
    const r = rig();
    const result = await r.controller.read("evn-9001");
    expect(result).toMatchObject({ kind: "APPLIED", readState: "denied" });
    const markup = pageHtml(modelOf(r));
    expect(markup).toContain("another tenant");
    expect(markup).not.toContain("Foreign gala");
    expectClean(markup);
  });

  it("a direct open inside the role renders the focused resource", async () => {
    const r = rig();
    await r.controller.read("evn-0001");
    const model = modelOf(r);
    expect(model.state).toBe("ready");
    const markup = pageHtml(model);
    expect(markup).toContain('data-focus-kind="event"');
    expect(markup).toContain("North Station Lanterns");
    expectClean(markup);
  });

  it("a refused payload (tenant mix) shows refused and no row", async () => {
    const r = rig("tenant-mix");
    await r.controller.read();
    const model = modelOf(r);
    expect(model.state).toBe("refused");
    const markup = pageHtml(model, "tenant-mix");
    expect(markup).toContain('data-status="refused"');
    expect(markup).toContain("SCOPE_LEAK");
    expect(markup).not.toContain("data-member=");
    expectClean(markup);
  });

  it("a role-stale read is its own state, not empty and not stale-by-watermark", async () => {
    const r = rig("clean", TENANT_SETTLER_ACTOR, "settler");
    await ready(r);
    r.port.synthetic("rotate-role", "mbr-0003");
    await r.controller.read();
    const model = modelOf(r);
    expect(model.state).toBe("role-stale");
    const markup = pageHtml(model, "clean", "stub", TENANT_SETTLER_ACTOR, "settler");
    expect(markup).toContain('data-status="role-stale"');
    expect(markup).toContain("generation");
    expect(markup).not.toContain("data-account=");
    expectClean(markup);
  });
});

describe("tenant permissions maker/checker and export on screen", () => {
  it("a pending proposal offers an approval to the organizer and not to the proposing settler", async () => {
    const organizer = rig("proposal-pending");
    await ready(organizer);
    const markup = pageHtml(modelOf(organizer), "proposal-pending");
    expect(markup).toContain('id="tenant-approve-ppr-0001"');
    expect(markup).toContain('data-enabled="true"');

    const settler = rig("proposal-pending", TENANT_SETTLER_ACTOR, "settler");
    await ready(settler);
    const settlerMarkup = pageHtml(modelOf(settler), "proposal-pending", "stub", TENANT_SETTLER_ACTOR, "settler");
    expect(settlerMarkup).toContain('data-block="approve"');
    expect(settlerMarkup).toContain("approve-change");
    expectClean(settlerMarkup);
  });

  it("the same person's second role does not unlock the approval control", async () => {
    const r = rig("self-approval", TENANT_DUAL_ACTOR, "support");
    await r.controller.read();
    r.controller.switchRole("organizer");
    await r.controller.read();
    const markup = pageHtml(modelOf(r), "self-approval", "stub", TENANT_DUAL_ACTOR, "organizer");
    expect(markup).toContain('id="tenant-approve-ppr-0001"');
    expect(markup).toContain('data-enabled="false"');
    expect(markup).toContain("different actor");
    expectClean(markup);
  });

  it("a support member row carries a guarded revoke control on every active target", async () => {
    const r = rig("clean", TENANT_SUPPORT_ACTOR, "support");
    await ready(r);
    const markup = pageHtml(modelOf(r), "clean", "stub", TENANT_SUPPORT_ACTOR, "support");
    expect(markup).toContain('id="tenant-revoke-mbr-0001"');
    expect(markup).toContain('data-enabled="true"');
    // Support holds propose-role-revoke, so a member row gets a control, never a flat no.
    expect(markup).not.toContain("No revoke control for this role.");
    // Support's own membership is not a revoke target on this read.
    expect(markup).toContain('id="tenant-revoke-mbr-0004"');
    expect(markup).toContain("The read offers no role-revoke on this membership.");
    expectDescribedByTargets(markup);
    expectClean(markup);
  });

  it("a settler account row offers an account change; an organizer member table offers no account control", async () => {
    const settler = rig("clean", TENANT_SETTLER_ACTOR, "settler");
    await ready(settler);
    const settlerMarkup = pageHtml(modelOf(settler), "clean", "stub", TENANT_SETTLER_ACTOR, "settler");
    expect(settlerMarkup).toContain('id="tenant-account-acc-0001"');
    expect(settlerMarkup).toContain('data-enabled="true"');
    expectDescribedByTargets(settlerMarkup);

    const organizer = rig();
    await ready(organizer);
    const organizerMarkup = pageHtml(modelOf(organizer));
    expect(organizerMarkup).toContain('data-block="account-change"');
    expect(organizerMarkup).not.toContain('id="tenant-account-acc');
    expectClean(organizerMarkup);
  });

  it("a recorded request shows the receipt keeps both resource claims false", async () => {
    const r = rig("clean", TENANT_SETTLER_ACTOR, "settler");
    await ready(r);
    const result = await r.controller.proposeAccountChange("acc-0001", "Move the payout account.");
    expect(result.kind).toBe("APPLIED");
    const markup = pageHtml(modelOf(r), "clean", "stub", TENANT_SETTLER_ACTOR, "settler");
    expect(markup).toContain("resourceChanged false");
    expect(markup).toContain("approvalChangesResource false");
    expect(markup).toContain("Recorded is not applied");
    expect(markup).toContain('data-behind="true"');
    expectClean(markup);
  });

  it("the export control is on for the settler and off with a reason for every other role", async () => {
    const settler = rig("clean", TENANT_SETTLER_ACTOR, "settler");
    await ready(settler);
    const settlerMarkup = pageHtml(modelOf(settler), "clean", "stub", TENANT_SETTLER_ACTOR, "settler");
    expect(settlerMarkup).toContain('id="tenant-export"');
    expect(settlerMarkup).toContain('data-enabled="true"');

    for (const [actor, role] of [
      [TENANT_ORGANIZER_ACTOR, "organizer"],
      [TENANT_SUPPORT_ACTOR, "support"],
      [TENANT_BUYER_ACTOR, "buyer"],
    ] as const) {
      const r = rig("clean", actor, role);
      await ready(r);
      const markup = pageHtml(modelOf(r), "clean", "stub", actor, role);
      expect(markup).toContain('id="tenant-export"');
      expect(markup).toContain('data-enabled="false"');
      expect(markup).toContain("sensitive-export");
      expectDescribedByTargets(markup);
      expectClean(markup);
    }
  });

  it("a loaded settler export shows its synthetic scope declaration", async () => {
    const r = rig("clean", TENANT_SETTLER_ACTOR, "settler");
    await ready(r);
    const loaded = await r.controller.loadExport();
    expect(loaded).toMatchObject({ kind: "APPLIED", phase: "loaded" });
    const markup = pageHtml(modelOf(r), "clean", "stub", TENANT_SETTLER_ACTOR, "settler");
    expect(markup).toContain('data-export-phase="loaded"');
    expect(markup).toContain("realPersonalData false");
    expect(markup).toContain("sharedOutsideTenant false");
    expect(markup).toContain("authorityRecord false");
    expect(markup).toContain('data-export-row="acc-0001"');
    expect(markup).not.toContain("acc-9001");
    expectClean(markup);
  });

  it("a leaked export is withheld on screen and its foreign row is not shown as the tenant's", async () => {
    const r = rig("export-leak", TENANT_SETTLER_ACTOR, "settler");
    await ready(r);
    await r.controller.loadExport();
    const model = modelOf(r);
    expect(model.export.verdictWord).toBe("withheld");
    const markup = pageHtml(model, "export-leak", "stub", TENANT_SETTLER_ACTOR, "settler");
    expect(markup).toContain("Withheld.");
    expect(markup).toContain("ROWS_DIFFER");
    // The withheld export renders no row: the foreign account must not leak through it.
    expect(markup).not.toContain("data-export-row=");
    expect(markup).not.toContain("acc-9001");
    expect(markup).not.toContain("Foreign payout account");
    expectClean(markup);
  });

  it("a session record carries counters, capabilities, and the not-composed note", async () => {
    const r = rig();
    await ready(r);
    const markup = pageHtml(modelOf(r));
    expect(markup).toContain("Reads");
    expect(markup).toContain("Role organizer holds:");
    expect(markup).toContain("commit_trade");
    expect(markup).toContain("capture");
    expectClean(markup);
  });
});

describe("tenant permissions not-bound and registry", () => {
  it("a not-bound port shows NOT_BOUND and sends nothing", async () => {
    const controller = new TenantPermissionsController(createNotBoundTenantPermissions());
    await controller.read();
    const model = buildTenantModel({ controller, last: null });
    const markup = pageHtml(model, "clean", "integration-http");
    expect(markup).toContain('data-status="not-bound"');
    expect(markup).toContain("k-operator-contract");
    expect(markup).toContain('data-export-phase="none"');
    expect(model.exportControl.enabled).toBe(false);
    expect(model.exportControl.reason).toBe(TENANT_NOT_BOUND_REASON);
    expectClean(markup);
  });

  it("registers the surface, the pending producer, and the fixture cases", () => {
    const surface = WORKSPACE_SURFACES.find((item) => item.id === "tenant-permissions");
    expect(surface).toMatchObject({ route: "/permissions", binding: "stub-only", taskId: "c-tenant-permissions-stub", implemented: true, pageControl: true });
    const pending = PENDING_PRODUCERS.find((row) => row.id === "c-tenant-permissions");
    expect(pending?.waitingSurface).toBe("tenant-permissions");
    expect(pending?.connected).toBe(false);
    const evidence = LOCAL_SURFACE_EVIDENCE.find((item) => item.id === "c-tenant-permissions-stub");
    expect(evidence?.doc).toBe("docs/c-tenant-permissions-stub-apps-bind.md");
    const screen = FIXTURE_SCREENS.find((item) => item.screenId === "tenant-permissions");
    expect(screen?.route).toBe("/permissions");
    const rows = fixturesForScreen("tenant-permissions");
    expect(rows).toHaveLength(10);
    for (const row of rows) {
      expect(row.klass).not.toBe("SUCCESS");
      expect(row.ownsPass).toBe(false);
      expect(row.substituteStub).toBe(false);
      expect(row.identity).toBeNull();
    }
    const fixtureIds = rows.map((fixture) => fixture.id);
    expect(fixtureIds).toContain("tenant-permissions.tenant-mix");
    expect(fixtureIds).toContain("tenant-permissions.role-stale");
    expect(fixtureIds).toContain("tenant-permissions.privilege-escalation");
    expect(fixtureIds).toContain("tenant-permissions.self-approval");
  });

  it("keeps the new screen free of sends, clocks, timers, stores, and the booking, capture, and hold vocabulary", () => {
    const files = ["src/tenant-permissions.ts", "src/pages/TenantPermissions.tsx", "src/pages/TenantPermissionsPanels.tsx"];
    const combined = files.map((file) => readFileSync(path.join(webRoot, file), "utf8")).join("\n");
    for (const token of [
      "fetch(",
      "XMLHttpRequest",
      "WebSocket",
      "EventSource",
      "sendBeacon",
      "invokeLocalCall",
      ".send(",
      "/health",
      "/ready",
      "127.0.0.1",
      "capture",
      "settle_capture",
      "commit_trade",
      "fallback",
      "Date.now(",
      "new Date(",
      "Math.random(",
      "setInterval",
      "setTimeout",
      "requestAnimationFrame",
      "placeHold",
      "Idempotency-Key",
      "retry",
      "contract-fixtures",
      "localStorage",
      "sessionStorage",
    ]) {
      expect(combined, token).not.toContain(token);
    }
  });

  it("names the surface in the docs and the README", () => {
    const doc = readFileSync(path.join(repoRoot, "docs/c-tenant-permissions-stub-apps-bind.md"), "utf8");
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    expect(doc).toContain(WORKSPACE_RULING);
    expect(doc).toContain("tenant-permissions");
    expect(doc).toContain("a hidden control is never enforcement");
    expect(readme).toContain("docs/c-tenant-permissions-stub-apps-bind.md");
    expect(readme).toContain("/permissions");
    const closeout = readFileSync(path.join(repoRoot, "docs/c-local-workspace-closeout-apps-bind.md"), "utf8");
    expect(closeout).toContain("| `c-tenant-permissions` | `tenant-permissions` |");
    expect(closeout).toContain("docs/c-tenant-permissions-stub-apps-bind.md");
  });

  it("mounts the /permissions route", () => {
    const markup = html(
      <MemoryRouter initialEntries={["/permissions"]}>
        <TenantPermissionsPage />
      </MemoryRouter>,
    );
    expect(markup).toContain("Tenant permissions desk (synthetic)");
    expect(markup).toContain('data-provenance="synthetic"');
    expectClean(markup);
  });
});
