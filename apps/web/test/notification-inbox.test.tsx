import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  NOTIFY_BUYER_ACTOR,
  NOTIFY_FOREIGN,
  NOTIFY_FOREIGN_ACTOR,
  NOTIFY_NOT_BOUND_REASON,
  NOTIFY_SCENARIOS,
  NOTIFY_SETTLER_ACTOR,
  NOTIFY_UNASSIGNED_ACTOR,
  NotificationInboxController,
  createNotBoundNotificationInbox,
  createStubNotificationInbox,
  type NotifyRole,
  type NotifyScenario,
  type StubNotificationInbox,
} from "@kix/protocol-adapter";
import { FIXTURE_SCREENS, fixturesForScreen } from "../../../packages/protocol-adapter/src/contract-fixtures";
import { LOCAL_SURFACE_EVIDENCE, PENDING_PRODUCERS } from "../src/handoff/packet";
import { buildNotifyModel, type NotifyActions, type NotifyLastAction, type NotifyModel } from "../src/notification-inbox";
import {
  NotifyAuthoritySection,
  NotifyBanner,
  NotifyControls,
  NotifyFocusSection,
  NotifyInboxSection,
  NotifyInquirySection,
  NotifyRequestsSection,
  NotifySessionSection,
  NotifyStatus,
} from "../src/pages/NotificationsPanels";
import { NotificationsPage } from "../src/pages/Notifications";
import { WORKSPACE_RULING, WORKSPACE_SURFACES } from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

const BANNED = /[$₩]|KRW|USD/i;

const POSITIVE_CLAIMS = [
  "Permission granted",
  "Real permission",
  "Payment confirmed",
  "Settlement complete",
  "Notification delivered",
  "Integration complete",
  "Audit complete",
];

const NO_ACTIONS: NotifyActions = {
  refresh() {},
  openNotification() {},
  markRead() {},
  resolveAction() {},
  loadInquiry() {},
  switchRole() {},
  switchActor() {},
  switchTenant() {},
  revokeGrant() {},
  rotateGrant() {},
  deliverLate() {},
  setScenario() {},
  newSession() {},
};

function html(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element);
}

function pageHtml(
  model: NotifyModel,
  scenario: NotifyScenario = "clean",
  environment: "stub" | "integration-http" = "stub",
  actorRef: string = NOTIFY_BUYER_ACTOR,
  role: NotifyRole = "buyer",
): string {
  return html(
    <MemoryRouter>
      <NotifyBanner environment={environment} scenario={scenario} model={model} />
      <NotifyControls scenario={scenario} actorRef={actorRef} role={role} actions={NO_ACTIONS} />
      <NotifyStatus model={model} />
      <NotifyAuthoritySection model={model} />
      <NotifyFocusSection model={model} />
      <NotifyInboxSection model={model} actions={NO_ACTIONS} />
      <NotifyInquirySection model={model} actions={NO_ACTIONS} />
      <NotifyRequestsSection model={model} />
      <NotifySessionSection session={model.session} />
    </MemoryRouter>,
  );
}

function expectClean(markup: string): void {
  expect(markup).not.toMatch(BANNED);
  for (const claim of POSITIVE_CLAIMS) {
    expect(markup, claim).not.toContain(claim);
  }
}

/** Every id a describedby points at must exist in the markup. */
function expectDescribedByTargets(markup: string): void {
  for (const match of markup.matchAll(/aria-describedby="([^"]+)"/g)) {
    const id = match[1];
    expect(markup, `missing describedby target ${id}`).toContain(`id="${id}"`);
  }
}

interface Rig {
  port: StubNotificationInbox;
  controller: NotificationInboxController;
  last: NotifyLastAction | null;
}

function rig(scenario: NotifyScenario = "clean", actorRef: string = NOTIFY_BUYER_ACTOR, role: NotifyRole = "buyer"): Rig {
  const port = createStubNotificationInbox({ scenario });
  return { port, controller: new NotificationInboxController(port, { actorRef, role }), last: null };
}

function modelOf(r: Rig): NotifyModel {
  return buildNotifyModel({ controller: r.controller, last: r.last });
}

async function ready(r: Rig): Promise<void> {
  const result = await r.controller.read();
  expect(result).toMatchObject({ kind: "APPLIED", readState: "ready" });
}

describe("notification inbox page states", () => {
  it("lists every scenario on the scenario control and keeps each note", async () => {
    for (const scenario of NOTIFY_SCENARIOS) {
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
    expect(markup).toContain('data-source="synthetic-notification-inbox"');
    expect(markup).toContain(WORKSPACE_RULING);
    expect(markup).toContain('data-hold-record="not-bound"');
    expect(markup).toContain("reserve_listing");
    expect(markup).toContain('data-not-composed="recorded"');
    expect(markup).toContain("confirms no economic effect");
    expect(markup).toContain("hidden");
    expectClean(markup);
  });

  it("a buyer inbox lists only its own notifications with dedupe keys and read state", async () => {
    const r = rig();
    await ready(r);
    const markup = pageHtml(modelOf(r));
    for (const ref of ["ntf-0001", "ntf-0002", "ntf-0003", "ntf-0004"]) {
      expect(markup).toContain(`data-notification="${ref}"`);
    }
    expect(markup).not.toContain("ntf-0011");
    expect(markup).not.toContain("ntf-9001");
    expect(markup).toContain('data-notification-read="false"');
    expect(markup).toContain('data-notification-read="true"');
    expect(markup).toContain("3 unread of 4 listed");
    expect(markup).toContain("evt-1001");
    expectClean(markup);
  });

  it("the authority table names every capability and which roles hold it", async () => {
    const r = rig();
    await ready(r);
    const markup = pageHtml(modelOf(r));
    for (const capability of ["read-inbox", "mark-read", "resolve-action", "read-sensitive", "read-inquiry"]) {
      expect(markup).toContain(`data-capability="${capability}"`);
    }
    expect(markup).toContain('data-held-by-role="true"');
    expectClean(markup);
  });

  it("a sensitive notification's detail stays withheld for the buyer and shown for the settler", async () => {
    const buyer = rig();
    await ready(buyer);
    const markup = pageHtml(modelOf(buyer));
    expect(markup).toContain('data-notification="ntf-0004"');
    expect(markup).toContain("Detail withheld at the source.");
    expect(markup).not.toContain("mem-4417");

    const settler = rig("clean", NOTIFY_SETTLER_ACTOR, "settler");
    await ready(settler);
    const settlerMarkup = pageHtml(modelOf(settler), "clean", "stub", NOTIFY_SETTLER_ACTOR, "settler");
    expect(settlerMarkup).toContain("trd-9902");
    expectClean(markup);
    expectClean(settlerMarkup);
  });

  it("a late notification keeps its row marked stale-issue and its resolve is blocked with the reason", async () => {
    const r = rig("late");
    await ready(r);
    const markup = pageHtml(modelOf(r), "late");
    expect(markup).toContain('data-notification="ntf-0050"');
    expect(markup).toContain('data-issue-state="stale-issue"');
    expect(markup).toContain('id="notify-resolve-ntf-0050"');
    expect(markup).toContain('data-enabled="false"');
    expect(markup).toContain("older grant generation");
    expectDescribedByTargets(markup);
    expectClean(markup);
  });

  it("a duplicate delivery is dropped once and counted on screen", async () => {
    const r = rig("duplicate");
    await ready(r);
    const markup = pageHtml(modelOf(r), "duplicate");
    expect(markup).toContain("Dedupe dropped 1 second delivery");
    expect(markup.match(/data-notification="ntf-0001"/g)?.length).toBe(1);
    expectClean(markup);
  });

  it("every row shows a guarded mark-read and a guarded resolve that says why when off", async () => {
    const r = rig();
    await ready(r);
    const markup = pageHtml(modelOf(r));
    // ntf-0003 is already read and offers no action.
    expect(markup).toContain('id="notify-mark-ntf-0003"');
    expect(markup).toContain("already marked read");
    expect(markup).toContain('id="notify-resolve-ntf-0003"');
    expect(markup).toContain("offers no action");
    expectDescribedByTargets(markup);
    expectClean(markup);
  });
});

describe("notification inbox non-ready states and direct open", () => {
  it("an empty read, a stale read, and a generation-stale read are three distinct states", async () => {
    const empty = rig("empty");
    await empty.controller.read();
    expect(modelOf(empty).state).toBe("empty");
    expect(pageHtml(modelOf(empty), "empty")).toContain('data-status="empty"');

    const stale = rig("stale");
    await stale.controller.read();
    const staleModel = modelOf(stale);
    expect(staleModel.state).toBe("stale");
    const staleMarkup = pageHtml(staleModel, "stale");
    expect(staleMarkup).toContain('data-status="stale"');
    expect(staleMarkup).not.toContain("data-notification=");

    // The grant moves a generation at the source after the read the page holds,
    // so the next read under the pinned floor is generation-stale, not empty.
    const rotatedPort = createStubNotificationInbox({ scenario: "grant-rotated" });
    const client = new NotificationInboxController(rotatedPort);
    await client.read();
    rotatedPort.synthetic("rotate-grant", "ngr-0001");
    await client.read();
    const genModel = buildNotifyModel({ controller: client, last: null });
    expect(genModel.state).toBe("generation-stale");
    const genMarkup = pageHtml(genModel, "grant-rotated");
    expect(genMarkup).toContain('data-status="generation-stale"');
    expect(genMarkup).not.toContain("data-notification=");
    expectClean(staleMarkup);
    expectClean(genMarkup);
  });

  it("a denied read shows the denial and no notification row", async () => {
    const r = rig("clean", NOTIFY_UNASSIGNED_ACTOR, "buyer");
    await r.controller.read();
    const model = modelOf(r);
    expect(model.state).toBe("denied");
    const markup = pageHtml(model, "clean", "stub", NOTIFY_UNASSIGNED_ACTOR, "buyer");
    expect(markup).toContain('data-status="denied"');
    expect(markup).toContain("GRANT_DENIED");
    expect(markup).not.toContain("data-notification=");
    expectClean(markup);
  });

  it("a revoked grant denies the next read and clears the rows", async () => {
    const r = rig();
    await ready(r);
    r.port.synthetic("revoke-grant", "ngr-0001");
    await r.controller.read();
    const model = modelOf(r);
    expect(model.state).toBe("denied");
    const markup = pageHtml(model);
    expect(markup).toContain("GRANT_REVOKED");
    expect(markup).not.toContain("data-notification=");
    expectClean(markup);
  });

  it("refused payloads show refused and no row, for tenant mix, subject mix, uncontracted kind, and leaks", async () => {
    const cases: Array<{ scenario: NotifyScenario; code: string }> = [
      { scenario: "tenant-mix", code: "SCOPE_LEAK" },
      { scenario: "subject-mix", code: "SUBJECT_LEAK" },
      { scenario: "kind-uncontracted", code: "UNCONTRACTED" },
      { scenario: "sensitive-leak", code: "SENSITIVE_LEAK" },
      { scenario: "claims-arrival", code: "CLAIM" },
      { scenario: "external-wired", code: "CLAIM" },
    ];
    for (const { scenario, code } of cases) {
      const r = rig(scenario);
      await r.controller.read();
      const model = modelOf(r);
      expect(model.state).toBe("refused");
      const markup = pageHtml(model, scenario);
      expect(markup).toContain('data-status="refused"');
      expect(markup).toContain(code);
      expect(markup).not.toContain("data-notification=");
      expectClean(markup);
    }
  });

  it("a lost read is unavailable, which is not empty", async () => {
    const r = rig("read-lost");
    await r.controller.read();
    const model = modelOf(r);
    expect(model.state).toBe("unavailable");
    const markup = pageHtml(model, "read-lost");
    expect(markup).toContain('data-status="unavailable"');
    expect(markup).toContain("not an empty inbox");
    expectClean(markup);
  });

  it("a direct open renders the focused notification; a foreign or another subject's ref is denied", async () => {
    const r = rig();
    await r.controller.read("ntf-0002");
    const model = modelOf(r);
    expect(model.state).toBe("ready");
    const markup = pageHtml(model);
    expect(markup).toContain('data-focus-kind="notification"');
    expect(markup).toContain("Notification ntf-0002");
    expectClean(markup);

    const foreign = rig();
    await foreign.controller.read("ntf-9001");
    const foreignMarkup = pageHtml(modelOf(foreign));
    expect(foreignMarkup).toContain('data-status="denied"');
    expect(foreignMarkup).toContain("RESOURCE_DENIED");
    expect(foreignMarkup).not.toContain("trd-9001");
    expectClean(foreignMarkup);

    const subject = rig();
    await subject.controller.read("ntf-0011");
    const subjectMarkup = pageHtml(modelOf(subject));
    expect(subjectMarkup).toContain('data-status="denied"');
    expectClean(subjectMarkup);
  });
});

describe("notification inbox requests and destinations", () => {
  it("a marked read shows a receipt that claims no economic effect", async () => {
    const r = rig();
    await ready(r);
    const result = await r.controller.markRead("ntf-0001");
    expect(result.kind).toBe("APPLIED");
    const markup = pageHtml(modelOf(r));
    expect(markup).toContain("read-marked");
    expect(markup).toContain("confirmsEconomicEffect false");
    expect(markup).toContain("externalSendWired false");
    expect(markup).toContain('data-behind="true"');
    expectClean(markup);
  });

  it("a resolved open-authority offer renders the move to the receipts desk, not a send", async () => {
    const r = rig();
    await ready(r);
    const result = await r.controller.resolveAction("ntf-0001");
    expect(result.kind).toBe("APPLIED");
    const markup = pageHtml(modelOf(r));
    expect(markup).toContain('data-request-phase="applied"');
    expect(markup).toContain('data-destination="authority"');
    expect(markup).toContain('href="/receipts"');
    expect(markup).toContain("trd-0001");
    expectClean(markup);
  });

  it("a resolved open-support offer renders the support material control and loads the material", async () => {
    const r = rig();
    await ready(r);
    const result = await r.controller.resolveAction("ntf-0002");
    expect(result.kind).toBe("APPLIED");
    let markup = pageHtml(modelOf(r));
    expect(markup).toContain('data-destination="support"');
    expect(markup).toContain('id="notify-open-inquiry"');
    const loaded = await r.controller.loadInquiry("nqy-0001");
    expect(loaded).toMatchObject({ kind: "APPLIED", phase: "loaded" });
    markup = pageHtml(modelOf(r));
    expect(markup).toContain('data-inquiry-phase="loaded"');
    expect(markup).toContain("realPersonalData false");
    expect(markup).toContain("authorityRecord false");
    expect(markup).toContain("The notification ref ntf-0002");
    expectClean(markup);
  });

  it("a denied or refused inquiry renders its state and no material rows", async () => {
    const denied = rig("inquiry-denied");
    await ready(denied);
    await denied.controller.loadInquiry("nqy-0001");
    const deniedMarkup = pageHtml(modelOf(denied), "inquiry-denied");
    expect(deniedMarkup).toContain('data-inquiry-phase="denied"');
    expect(deniedMarkup).toContain("INQUIRY_DENIED");
    expect(deniedMarkup).not.toContain("data-inquiry-lines");
    expectClean(deniedMarkup);

    const leaked = rig("inquiry-leak");
    await ready(leaked);
    await leaked.controller.loadInquiry("nqy-0001");
    const leakedMarkup = pageHtml(modelOf(leaked), "inquiry-leak");
    expect(leakedMarkup).toContain('data-inquiry-phase="refused"');
    expect(leakedMarkup).not.toContain("member@example.test");
    expect(leakedMarkup).not.toContain("data-inquiry-lines");
    expectClean(leakedMarkup);
  });

  it("an unknown request outcome shows the fence and blocks the next request on screen", async () => {
    const r = rig("act-lost");
    await ready(r);
    const result = await r.controller.markRead("ntf-0001");
    expect(result.kind).toBe("UNKNOWN");
    const model = modelOf(r);
    expect(model.fenceLine).toContain("unknown outcome");
    const markup = pageHtml(model, "act-lost");
    expect(markup).toContain('data-request-phase="unknown"');
    expect(markup).toContain("Fenced.");
    expect(markup).toContain('data-enabled="false"');
    expectDescribedByTargets(markup);
    expectClean(markup);
  });

  it("a stale-issued notification's action never reaches the port", async () => {
    const r = rig("late");
    await ready(r);
    const result = await r.controller.resolveAction("ntf-0050");
    expect(result.kind).toBe("NOT_SENT");
    expect(r.port.effects().acts).toBe(0);
    const model = modelOf(r);
    const row = model.rows.find((item) => item.notificationRef === "ntf-0050");
    expect(row?.resolve?.enabled).toBe(false);
    expect(row?.resolve?.reason).toContain("older grant generation");
  });
});

describe("notification inbox not-bound and registry", () => {
  it("a not-bound port shows NOT_BOUND and sends nothing", async () => {
    const controller = new NotificationInboxController(createNotBoundNotificationInbox());
    await controller.read();
    const model = buildNotifyModel({ controller, last: null });
    const markup = pageHtml(model, "clean", "integration-http");
    expect(markup).toContain('data-status="not-bound"');
    expect(markup).toContain("k-operator-contract");
    expect(markup).toContain('data-inquiry-phase="none"');
    expect(model.inquiryControl.enabled).toBe(false);
    expect(model.inquiryControl.reason).toBe(NOTIFY_NOT_BOUND_REASON);
    expectClean(markup);
  });

  it("the foreign actor's inbox lists the foreign tenant's own rows only", async () => {
    const port = createStubNotificationInbox();
    const controller = new NotificationInboxController(port, { actorRef: NOTIFY_FOREIGN_ACTOR, tenantId: NOTIFY_FOREIGN });
    await controller.read();
    const markup = pageHtml(buildNotifyModel({ controller, last: null }), "clean", "stub", NOTIFY_FOREIGN_ACTOR, "buyer");
    expect(markup).toContain('data-notification="ntf-9001"');
    expect(markup).not.toContain('data-notification="ntf-0001"');
    expectClean(markup);
  });

  it("registers the surface, the pending producer, and the fixture cases", () => {
    const surface = WORKSPACE_SURFACES.find((item) => item.id === "notification-inbox");
    expect(surface).toMatchObject({
      route: "/notifications",
      binding: "stub-only",
      taskId: "c-notification-inbox-stub",
      implemented: true,
      pageControl: true,
    });
    const pending = PENDING_PRODUCERS.find((row) => row.id === "c-notification-inbox");
    expect(pending?.waitingSurface).toBe("notification-inbox");
    expect(pending?.connected).toBe(false);
    expect(pending?.implementedHere).toBe(false);
    const evidence = LOCAL_SURFACE_EVIDENCE.find((item) => item.id === "c-notification-inbox-stub");
    expect(evidence?.doc).toBe("docs/c-notification-inbox-stub-apps-bind.md");
    const screen = FIXTURE_SCREENS.find((item) => item.screenId === "notification-inbox");
    expect(screen?.route).toBe("/notifications");
    const rows = fixturesForScreen("notification-inbox");
    expect(rows.length).toBeGreaterThanOrEqual(10);
    for (const row of rows) {
      expect(row.klass).not.toBe("SUCCESS");
      expect(row.ownsPass).toBe(false);
      expect(row.substituteStub).toBe(false);
      expect(row.identity).toBeNull();
    }
    const fixtureIds = rows.map((fixture) => fixture.id);
    expect(fixtureIds).toContain("notification-inbox.tenant-mix");
    expect(fixtureIds).toContain("notification-inbox.late-stale-issue");
    expect(fixtureIds).toContain("notification-inbox.generation-stale");
    expect(fixtureIds).toContain("notification-inbox.write-lost");
  });

  it("keeps the new screen free of sends, clocks, timers, stores, and the booking, capture, and hold vocabulary", () => {
    const files = ["src/notification-inbox.ts", "src/pages/Notifications.tsx", "src/pages/NotificationsPanels.tsx"];
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
    const doc = readFileSync(path.join(repoRoot, "docs/c-notification-inbox-stub-apps-bind.md"), "utf8");
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    expect(doc).toContain(WORKSPACE_RULING);
    expect(doc).toContain("notification-inbox");
    expect(doc).toContain("an arrival confirms no economic effect");
    expect(readme).toContain("docs/c-notification-inbox-stub-apps-bind.md");
    expect(readme).toContain("/notifications");
    const closeout = readFileSync(path.join(repoRoot, "docs/c-local-workspace-closeout-apps-bind.md"), "utf8");
    expect(closeout).toContain("| `c-notification-inbox` | `notification-inbox` |");
    expect(closeout).toContain("docs/c-notification-inbox-stub-apps-bind.md");
  });

  it("mounts the /notifications route", () => {
    const markup = html(
      <MemoryRouter initialEntries={["/notifications"]}>
        <NotificationsPage />
      </MemoryRouter>,
    );
    expect(markup).toContain("Notification inbox (synthetic)");
    expect(markup).toContain('data-provenance="synthetic"');
    expectClean(markup);
  });
});
