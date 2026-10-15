import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  COMMERCE_COMMAND_BINDINGS,
  MOBILE_AS_OF,
  MOBILE_DESK_ACTOR,
  MOBILE_GUEST_ACTOR,
  MOBILE_NOT_BOUND_REASON,
  MOBILE_SCENARIOS,
  MobileShellController,
  createNotBoundMobileShell,
  createStubMobileShell,
  type MobileFence,
  type MobileScenario,
  type MobileStepInput,
  type MobileStepResult,
  type StubMobileShell,
} from "@kix/protocol-adapter";
import { fixturesForScreen } from "../../../packages/protocol-adapter/src/contract-fixtures";
import { App } from "../src/App";
import { PENDING_PRODUCERS } from "../src/handoff/packet";
import {
  SCENARIO_NOTES,
  buildMobileModel,
  fenceLine,
  stepResultLine,
  type LastAction,
  type MobileActions,
  type MobileModel,
} from "../src/installable-mobile";
import {
  DeviceSection,
  IdentitySection,
  InstallSection,
  MobileBanner,
  MobileControls,
  MobileStatus,
  OrderSection,
  RecordSection,
  SessionSection,
  SupportSection,
  VaultSection,
} from "../src/pages/InstallableMobilePanels";
import { WORKSPACE_RULING, WORKSPACE_SURFACES } from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

const BANNED = /[$₩]|KRW|USD|still open|in stock/i;

/** Wording that would turn a synthetic record into a real install, payment, or admission. */
const POSITIVE_CLAIMS = [
  "Payment complete",
  "Payment received",
  "Payment captured",
  "Purchased",
  "You own",
  "You now own",
  "Ticket issued",
  "Admission granted",
  "You are admitted",
  "You may enter",
  "Install verified",
  "Device verified",
  "Signed in",
  "Withdrawal sent",
  "Refunded",
  "Settled",
];

const NO_ACTIONS: MobileActions = {
  refresh() {},
  install() {},
  update() {},
  reconnect() {},
  present() {},
  confirm() {},
  withdraw() {},
  resume() {},
  dropConnection() {},
  restoreConnection() {},
  offerUpdate() {},
  expireSession() {},
  deliverHeld() {},
  deliverLate() {},
  switchContext() {},
  newSession() {},
  setScenario() {},
  setClockMode() {},
};

function html(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element);
}

function pageHtml(
  model: MobileModel,
  scenario: MobileScenario = "clean",
  environment: "stub" | "integration-http" = "stub",
): string {
  return html(
    <MemoryRouter>
      <MobileBanner environment={environment} scenario={scenario} model={model} />
      <MobileControls scenario={scenario} clockMode="in-step" actions={NO_ACTIONS} />
      <MobileStatus model={model} />
      <DeviceSection device={model.device} />
      <InstallSection install={model.install} actions={NO_ACTIONS} />
      <SessionSection session={model.session} actions={NO_ACTIONS} />
      <VaultSection model={model} actions={NO_ACTIONS} />
      <OrderSection order={model.order} actions={NO_ACTIONS} />
      <SupportSection support={model.support} />
      <RecordSection record={model.record} />
      <IdentitySection rows={model.identity} />
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
  port: StubMobileShell;
  controller: MobileShellController;
  last: LastAction | null;
  seq: number;
  intent: number;
}

function rig(
  scenario: MobileScenario = "clean",
  options: { deviceNow?: () => string | null } = {},
): Rig {
  const port = createStubMobileShell({ scenario });
  return {
    port,
    controller: new MobileShellController(port, {
      actorRef: MOBILE_DESK_ACTOR,
      deviceNow: options.deviceNow ?? (() => MOBILE_AS_OF),
    }),
    last: null,
    seq: 0,
    intent: 0,
  };
}

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type StepNoIntent = DistOmit<MobileStepInput, "intentRef">;

async function step(r: Rig, input: StepNoIntent, options: { read?: boolean } = {}): Promise<MobileStepResult> {
  r.intent += 1;
  const withIntent = { ...input, intentRef: `intent-${r.intent}` } as MobileStepInput;
  const result = await r.controller.run(withIntent);
  r.seq += 1;
  r.last = { seq: r.seq, kind: "step", step: input.step, result };
  if (options.read !== false && result.kind !== "FENCED" && result.kind !== "NOT_SENT") {
    await r.controller.refresh();
  }
  return result;
}

function modelOf(r: Rig): MobileModel {
  return buildMobileModel({ controller: r.controller, last: r.last });
}

describe("mobile shell screen states", () => {
  it("shows loading before the first read, with a word for it and no rows", () => {
    const r = rig();
    const model = modelOf(r);
    expect(model.state).toBe("loading");
    const markup = pageHtml(model);
    expect(markup).toContain('data-mobile-state="loading"');
    expect(markup).toContain('data-status-mark="loading"');
    expect(markup).toContain("Reading the synthetic shell source. Nothing is confirmed yet.");
    expect(markup).not.toContain("data-vault=");
    expect(markup).toContain("No stored item in this read.");
    expect(markup).toContain("No install record in this read.");
    expectClean(markup);
  });

  it("shows the install, session, stored items, and pending order after a read", async () => {
    const r = rig();
    await r.controller.refresh();
    const model = modelOf(r);
    expect(model.state).toBe("ready");
    expect(model.install).toMatchObject({ stateWord: "installed" });
    expect(model.session).toMatchObject({ stateWord: "active" });
    expect(model.vault.map((item) => item.vaultRef)).toEqual(["vlt-0001", "vlt-0002", "vlt-0003"]);
    expect(model.vault.every((item) => item.currencyWord === "current")).toBe(true);
    expect(model.order?.orderRef).toBe("ord-0001");
    expect(model.order?.confirm.enabled).toBe(true);
    const markup = pageHtml(model);
    expect(markup).toContain('data-mobile-state="ready"');
    expect(markup).toContain('data-source="synthetic-mobile-shell"');
    expect(markup).toContain("SYNTHETIC");
    expect(markup).toContain("Environment installable-sandbox");
    expect(markup).toContain("current authority");
    expect(markup).toContain("grants no admission");
    expect(markup).toContain('id="mobile-confirm-ord-0001"');
    expect(markup).toContain('data-enabled="true"');
    expectClean(markup);
  });

  it("separates empty, stale, refused, declared-production, and not-bound", async () => {
    const empty = rig("empty");
    await empty.controller.refresh();
    expect(modelOf(empty)).toMatchObject({ state: "empty", actionLabel: "Read again" });
    expect(pageHtml(modelOf(empty), "empty")).toContain("Nothing is installed on this device.");

    const stale = rig("stale");
    await stale.controller.refresh();
    const staleModel = modelOf(stale);
    expect(staleModel.state).toBe("stale");
    expect(staleModel.detailLine).toContain("older than the floor");
    // The first read already served stale, so no copy is held to show.
    expect(staleModel.vault).toEqual([]);
    const staleMarkup = pageHtml(staleModel, "stale");
    expect(staleMarkup).toContain("Stale shell read.");

    const refused = rig("claims-grant");
    await refused.controller.refresh();
    const refusedModel = modelOf(refused);
    expect(refusedModel).toMatchObject({ state: "refused", actionLabel: "Start a new synthetic session" });
    expect(pageHtml(refusedModel, "claims-grant")).toContain("refused whole before any row was shown");
    expect(pageHtml(refusedModel, "claims-grant")).not.toContain("data-vault=");

    const production = rig("production-claimed");
    await production.controller.refresh();
    const prodModel = modelOf(production);
    expect(prodModel).toMatchObject({ state: "refused" });
    expect(prodModel.detailLine).toContain("declares a production environment");
    expect(pageHtml(prodModel, "production-claimed")).toContain("installable-sandbox only");

    const notBound = new MobileShellController(createNotBoundMobileShell(), { actorRef: MOBILE_DESK_ACTOR });
    await notBound.refresh();
    const notBoundModel = buildMobileModel({ controller: notBound, last: null });
    expect(notBoundModel.state).toBe("not-bound");
    expect(notBoundModel.statusLine).toBe(MOBILE_NOT_BOUND_REASON);
    const markup = pageHtml(notBoundModel, "clean", "integration-http");
    expect(markup).toContain('data-adapter-environment="integration-http"');
    expect(markup).toContain(MOBILE_NOT_BOUND_REASON);
    expect(markup).not.toContain("data-vault=");
    expect(markup).not.toContain("fall back");
    expectClean(markup);
  });
});

describe("offline and reconnect flow", () => {
  it("keeps stored items as cached copies while the link is down and fences every write", async () => {
    const r = rig();
    await r.controller.refresh();
    r.port.dropConnection();
    await r.controller.refresh();
    const model = modelOf(r);
    expect(model.state).toBe("offline");
    expect(model.device.linkWord).toBe("offline");
    expect(model.cachedWord).toContain("cached copy");
    expect(model.vault.every((item) => item.currencyWord === "cached")).toBe(true);
    expect(model.order?.confirm.enabled).toBe(false);
    expect(model.order?.confirm.reason).toContain("link is down");
    const markup = pageHtml(model, "offline");
    expect(markup).toContain('data-link="offline"');
    expect(markup).toContain('data-currency="cached"');
    expect(markup).toContain("not current authority");
    expect(markup).not.toContain('data-currency="current"');
    expectClean(markup);
  });

  it("returns to a current read when the link is restored and replays nothing", async () => {
    const r = rig();
    await r.controller.refresh();
    r.port.dropConnection();
    await r.controller.refresh();
    expect(modelOf(r).state).toBe("offline");
    const confirmed = await r.controller.run({ step: "confirm", intentRef: "c-1", orderRef: "ord-0001" });
    expect(confirmed).toMatchObject({ kind: "FENCED", fence: { reason: "link-offline" } });
    expect(r.port.effects().submits).toBe(0);
    r.port.restoreConnection();
    await r.controller.refresh();
    const model = modelOf(r);
    expect(model.state).toBe("ready");
    expect(model.order?.confirm.enabled).toBe(true);
    expect(r.port.effects().submits).toBe(0);
  });
});

describe("device clock is report-only", () => {
  it("marks stored verdicts clock-uncertain on a skewed or unreported clock and decides nothing", async () => {
    const skewed = rig("clean", { deviceNow: () => "2026-10-20T00:00:00.000Z" });
    await skewed.controller.refresh();
    const skewedModel = modelOf(skewed);
    expect(skewedModel.device.clockWord).toBe("skewed");
    expect(skewedModel.vault.every((item) => item.currencyWord === "clock-uncertain")).toBe(true);
    const skewedMarkup = pageHtml(skewedModel);
    expect(skewedMarkup).toContain('data-clock-verdict="skewed"');
    expect(skewedMarkup).toContain("clock-uncertain");
    // The expired pass stays expired by the source verdict, whatever the clock says.
    expect(skewedModel.vault.find((item) => item.vaultRef === "vlt-0003")?.verdictWord).toBe("expired");

    const silent = rig("clean", { deviceNow: () => null });
    await silent.controller.refresh();
    const silentModel = modelOf(silent);
    expect(silentModel.device.clockWord).toBe("unreported");
    expect(silentModel.vault.every((item) => item.currencyWord === "clock-uncertain")).toBe(true);
    expectClean(pageHtml(silentModel));
  });
});

describe("session and resume", () => {
  it("fences present, confirm, and withdraw under an expired session, then reconnects", async () => {
    const r = rig("session-expired");
    await r.controller.refresh();
    const model = modelOf(r);
    expect(model.session?.stateWord).toBe("expired");
    expect(model.order?.confirm.enabled).toBe(false);
    expect(model.order?.confirm.reason).toContain("session");
    expect(model.vault[0]?.present.enabled).toBe(false);
    expect(model.session?.reconnect.enabled).toBe(true);
    const reconnected = await step(r, { step: "reconnect" });
    expect(reconnected.kind).toBe("CONFIRMED");
    const after = modelOf(r);
    expect(after.session?.stateWord).toBe("active");
    expect(after.order?.confirm.enabled).toBe(true);
    expectClean(pageHtml(after, "session-expired"));
  });

  it("an app resume re-executes nothing: every write stays fenced until an explicit read", async () => {
    const r = rig();
    await r.controller.refresh();
    const confirmed = await step(r, { step: "confirm", orderRef: "ord-0001" });
    expect(confirmed.kind).toBe("CONFIRMED");
    const sentBefore = r.port.effects().submits;
    r.controller.resume();
    const model = modelOf(r);
    expect(model.freshnessWord).toContain("resumed");
    expect(model.order?.confirm.enabled).toBe(false);
    expect(model.order?.confirm.reason).toContain("app resumed");
    expect(model.order?.withdraw.enabled).toBe(false);
    // Resume sent no write and no read.
    expect(r.port.effects().submits).toBe(sentBefore);
    const markup = pageHtml(model);
    expect(markup).toContain("A resume re-executes nothing");
    expectClean(markup);
    await r.controller.refresh();
    expect(modelOf(r).order?.confirm.enabled).toBe(true);
  });

  it("re-login under another actor reuses no session and no stored copy", async () => {
    const r = rig();
    await r.controller.refresh();
    r.controller.switchContext({ actorRef: MOBILE_GUEST_ACTOR });
    const unread = modelOf(r);
    expect(unread.state).toBe("unread");
    expect(unread.actionLabel).toBe("Read again");
    const markup = pageHtml(unread);
    expect(markup).toContain("The session context changed, so there is no read in this context.");
    expect(markup).toContain("session 2");
    expect(markup).not.toContain("data-vault=");
    await r.controller.refresh();
    const model = modelOf(r);
    expect(model.vault.every((item) => !item.ownerLine.includes("the current context actor"))).toBe(true);
    expect(model.order?.confirm.enabled).toBe(false);
    expectClean(markup);
  });
});

describe("uncertain writes are never replayed", () => {
  it("a lost confirm blocks its order and a late result stays evidence only", async () => {
    const r = rig("confirm-lost");
    await r.controller.refresh();
    const lost = await step(r, { step: "confirm", orderRef: "ord-0001" });
    expect(lost.kind).toBe("UNKNOWN");
    const again = await step(r, { step: "confirm", orderRef: "ord-0001" });
    expect(again.kind).toBe("FENCED");
    for (const delivery of r.port.deliverLate()) {
      r.controller.acceptLate(delivery);
    }
    const model = modelOf(r);
    expect(model.order?.confirm.enabled).toBe(false);
    expect(model.order?.confirm.reason).toContain("unknown result");
    expect(model.order?.confirm.reason).toContain("A late result was recorded, and it does not make the write known.");
    const markup = pageHtml(model, "confirm-lost");
    expect(markup).toContain("Late result confirmed. Evidence only.");
    expect(markup).toContain('data-outcome="UNKNOWN"');
    // The late answer is never a payment and never a success claim.
    expect(markup).not.toContain("Payment complete");
    expectClean(markup);
  });

  it("a held write answered after a context switch is quarantined and blocks the scope in the new context", async () => {
    const r = rig("held-response");
    const firstRead = r.controller.refresh();
    r.port.deliverHeld();
    await firstRead;
    const pending = r.controller.run({ step: "confirm", intentRef: "held-c", orderRef: "ord-0001" });
    r.controller.switchContext({ actorRef: MOBILE_GUEST_ACTOR });
    r.port.deliverHeld();
    const settled = await pending;
    r.last = { seq: 1, kind: "step", step: "confirm", result: settled };
    expect(settled.kind).toBe("QUARANTINED");
    const model = modelOf(r);
    expect(model.state).toBe("unread");
    expect(model.record.quarantineLines.some((line) => line.includes("held-c"))).toBe(true);
    const markup = pageHtml(model, "held-response");
    expect(markup).toContain('data-quarantined="true"');
    expect(markup).toContain("CONTEXT_SWITCHED");
    expectClean(markup);
  });
});

describe("fence and result wording", () => {
  it("maps every fence to one distinct sentence", () => {
    const fences: MobileFence[] = [
      { reason: "in-flight", intentRef: "i-1" },
      { reason: "unknown-outcome", intentRef: "i-1", lateRecorded: false, earlierContext: false },
      { reason: "unknown-outcome", intentRef: "i-1", lateRecorded: true, earlierContext: true },
      { reason: "no-snapshot" },
      { reason: "empty-device" },
      { reason: "snapshot-stale", cause: "own-write" },
      { reason: "snapshot-stale", cause: "resumed" },
      { reason: "duplicate-intent", intentRef: "i-1" },
      { reason: "link-offline" },
      { reason: "environment" },
      { reason: "session-expired" },
      { reason: "already-installed", installRef: "ins-0001" },
      { reason: "session-active", sessionRef: "ses-0001" },
      { reason: "no-update" },
      { reason: "not-bound" },
    ];
    const lines = fences.map(fenceLine);
    expect(new Set(lines).size).toBe(fences.length);
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(10);
      expect(line).not.toMatch(BANNED);
    }
    expect(lines[1]).toContain("A read does not resolve it.");
    expect(lines[2]).toContain("does not make the write known");
    expect(lines[6]).toContain("app resumed");
    expect(lines[8]).toContain("link is down");
    expect(lines[11]).toContain("not an update");
    expect(lines[14]).toBe(MOBILE_NOT_BOUND_REASON);
  });

  it("words every result kind and never calls a lost result a rejection or a success", async () => {
    const r = rig("confirm-lost");
    await r.controller.refresh();
    const lost = await step(r, { step: "confirm", orderRef: "ord-0001" });
    const line = stepResultLine("confirm", lost);
    expect(line).toContain("result unknown");
    expect(line).toContain("may or may not have applied");
    expect(line).not.toMatch(/rejected|confirmed/);
    const ok = rig();
    await ok.controller.refresh();
    const confirmed = await step(ok, { step: "confirm", orderRef: "ord-0001" });
    expect(stepResultLine("confirm", confirmed)).toContain("synthetic record, not a payment");
    const fenced = await step(r, { step: "confirm", orderRef: "ord-0001" });
    expect(stepResultLine("confirm", fenced)).toContain("Confirm order not sent.");
  });
});

describe("mobile shell screen as mounted", () => {
  it("mounts on /mobile with the banner, the rulings, and the not-bound hold record", () => {
    const markup = html(
      <MemoryRouter initialEntries={["/mobile"]}>
        <App />
      </MemoryRouter>,
    );
    expect(markup).toContain("Installable mobile shell (synthetic)");
    expect(markup).toContain('href="/mobile"');
    expect(markup).toContain('data-status-mark="loading"');
    expect(markup).toContain(WORKSPACE_RULING);
    expect(markup).toContain(COMMERCE_COMMAND_BINDINGS.placeHold.reason);
    expect(markup).toContain('data-hold-record="not-bound"');
    expect(markup).toContain("reserve_listing");
    expect(markup).toContain('data-source="synthetic-mobile-shell"');
    expect(markup).toContain('data-adapter-environment="stub"');
    expect(markup).not.toMatch(BANNED);
  });

  it("offers every scenario and clock mode with a note, keyboard-reachable controls, and no positive tab order", () => {
    const markup = html(
      <MemoryRouter initialEntries={["/mobile"]}>
        <App />
      </MemoryRouter>,
    );
    for (const scenario of MOBILE_SCENARIOS) {
      expect(markup).toContain(`<option value="${scenario}"`);
      expect(SCENARIO_NOTES[scenario].length).toBeGreaterThan(10);
    }
    for (const mode of ["in-step", "skewed", "unreported"]) {
      expect(markup).toContain(`<option value="${mode}"`);
    }
    expect(markup).toContain('for="mobile-scenario"');
    expect(markup).toContain('for="mobile-clock"');
    expect(markup).toContain('id="mobile-refresh"');
    expect(markup).toContain('id="mobile-resume"');
    expect(markup).toContain('id="mobile-drop"');
    expect(markup).toContain('id="mobile-switch"');
    expect(markup).toContain('id="mobile-new-session"');
    expect(markup).toContain('id="mobile-status"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).not.toMatch(/tabindex="[1-9]/);
    expect(markup).toContain('aria-label="Mobile shell sections"');
  });
});

describe("registration", () => {
  it("is one stub-only buyer surface with no sender, no action, and no desk method", () => {
    const surface = WORKSPACE_SURFACES.find((item) => item.id === "installable-mobile-shell");
    expect(surface).toMatchObject({
      role: "buyer",
      route: "/mobile",
      binding: "stub-only",
      sender: null,
      taskId: "c-installable-mobile-stub",
      implemented: true,
      pageControl: true,
    });
    expect(surface?.actions).toEqual([]);
    expect(surface?.deskMethods).toEqual([]);
    expect(surface?.provenanceNote).toContain("integration-http");
    expect(surface?.provenanceNote).not.toMatch(/\bworks\b|live payment|funds moved|disbursed|payment complete|admission complete|refund complete/i);
  });

  it("is recorded in the handoff packet as a pending producer that is not connected", () => {
    const row = PENDING_PRODUCERS.find((item) => item.id === "c-installable-mobile");
    expect(row).toMatchObject({
      catalogue: "pending",
      connected: false,
      implementedHere: false,
      waitingSurface: "installable-mobile-shell",
    });
    const pending = JSON.parse(readFileSync(path.join(repoRoot, "docs/aiops/PENDING_NODES.json"), "utf8")) as {
      nodes: { id: string }[];
    };
    const ids = new Set(pending.nodes.map((node) => node.id));
    expect(ids.has("c-installable-mobile")).toBe(true);
  });

  it("has synthetic fixture rows that own no pass and cover offline, clock, resume, and stale cases", () => {
    const rows = fixturesForScreen("installable-mobile-shell");
    expect(rows.map((row) => row.id)).toEqual([
      "installable-mobile-shell.offline-cached",
      "installable-mobile-shell.offline-write-unknown",
      "installable-mobile-shell.offline-presentation",
      "installable-mobile-shell.expired-pass",
      "installable-mobile-shell.session-expired",
      "installable-mobile-shell.relogin-mismatch",
      "installable-mobile-shell.resume-replay",
      "installable-mobile-shell.write-lost",
      "installable-mobile-shell.late-answer",
      "installable-mobile-shell.stale-session",
      "installable-mobile-shell.stale-read",
      "installable-mobile-shell.clock-skew",
      "installable-mobile-shell.already-installed",
      "installable-mobile-shell.order-settled",
      "installable-mobile-shell.claim-refused",
      "installable-mobile-shell.read-lost",
    ]);
    for (const row of rows) {
      expect(row.ownsPass).toBe(false);
      expect(row.source).toBe("synthetic-fixture");
      expect(row.klass).not.toBe("SUCCESS");
      expect(row.substituteStub).toBe(false);
    }
  });

  it("keeps the new screen free of sends, clocks, timers, storage, and the capture and hold vocabulary", () => {
    const files = [
      "src/installable-mobile.ts",
      "src/pages/InstallableMobile.tsx",
      "src/pages/InstallableMobilePanels.tsx",
    ];
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
    const css = readFileSync(path.join(webRoot, "src/styles.css"), "utf8");
    expect(css).not.toContain("@keyframes");
    expect(css).not.toMatch(/animation\s*:/);
  });

  it("names the surface in the docs and the README", () => {
    const doc = readFileSync(path.join(repoRoot, "docs/c-installable-mobile-stub-apps-bind.md"), "utf8");
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    expect(doc).toContain(WORKSPACE_RULING);
    expect(doc).toContain("installable-mobile-shell");
    expect(doc).toContain("Browser run");
    expect(readme).toContain("docs/c-installable-mobile-stub-apps-bind.md");
    expect(readme).toContain("/mobile");
  });
});
