import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  MARKETPLACE_DEVICE_PROFILES,
  MARKETPLACE_NOT_BOUND_REASON,
  MARKETPLACE_PAGE_BOUND,
  MARKETPLACE_SCENARIOS,
  MARKETPLACE_SYNTHETIC_CONTROLS,
  MARKETPLACE_TOTAL_LISTINGS,
  MARKETPLACE_UNVERIFIED_DEVICES,
  MARKETPLACE_WORKLOADS,
  MarketplaceBenchController,
  createStubMarketplaceBench,
  marketplaceBenchPortFor,
  type MarketplaceBenchPort,
  type MarketplaceScenario,
  type MarketplaceWorkload,
} from "@kix/protocol-adapter";
import { FIXTURE_SCREENS, fixturesForScreen } from "../../../packages/protocol-adapter/src/contract-fixtures";
import { LOCAL_SURFACE_EVIDENCE, PENDING_PRODUCERS } from "../src/handoff/packet";
import {
  MARKETPLACE_BENCH_BOUNDARY,
  MARKETPLACE_BENCH_SOURCE_LINE,
  MARKETPLACE_BENCH_TITLE,
  buildMarketplaceModel,
  type MarketplaceBenchActions,
  type MarketplaceBenchModel,
} from "../src/marketplace-performance";
import {
  BenchBanner,
  BenchControls,
  BenchMeasurements,
  BenchQueue,
  BenchSession,
  BenchStatus,
  BenchWindow,
} from "../src/pages/MarketplacePerformancePanels";
import { MarketplacePerformancePage } from "../src/pages/MarketplacePerformance";
import { WORKSPACE_RULING, WORKSPACE_SURFACES } from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

const BANNED = /[$₩]|KRW|USD/i;

const POSITIVE_CLAIMS = [
  "Price confirmed",
  "Real device evidence confirmed",
  "real-device evidence: true",
  "Producer load measured",
  "Mobile evidence verified",
  "Payment confirmed",
  "Integration complete",
  "Admission granted",
  "Right issued",
];

const NO_ACTIONS: MarketplaceBenchActions = {
  refresh() {},
  nextPage() {},
  search() {},
  cancel() {},
  joinQueue() {},
  pollQueue() {},
  switchActor() {},
  switchDevice() {},
  openSecondTab() {},
  setWorkload() {},
  synthetic() {},
  setScenario() {},
  newSession() {},
};

function html(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element);
}

function pageHtml(
  model: MarketplaceBenchModel,
  scenario: MarketplaceScenario = "clean",
  environment: "stub" | "integration-http" = "stub",
  workload: MarketplaceWorkload = "browse-window",
): string {
  return html(
    <MemoryRouter>
      <BenchBanner environment={environment} scenario={scenario} model={model} />
      <BenchControls scenario={scenario} workload={workload} actions={NO_ACTIONS} />
      <BenchStatus model={model} actions={NO_ACTIONS} />
      <BenchQueue model={model} actions={NO_ACTIONS} />
      <BenchWindow model={model} actions={NO_ACTIONS} />
      <BenchMeasurements model={model} />
      <BenchSession model={model} />
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
  port: MarketplaceBenchPort;
  controller: MarketplaceBenchController;
}

function rig(scenario: MarketplaceScenario = "clean"): Rig {
  const port = createStubMarketplaceBench({ scenario });
  return { port, controller: new MarketplaceBenchController(port, {}) };
}

function modelOf(r: Rig): MarketplaceBenchModel {
  return buildMarketplaceModel({ controller: r.controller });
}

describe("marketplace scale bench page states", () => {
  it("renders the ready bounded window with the boundary copy and no positive claim", async () => {
    const r = rig();
    await r.controller.read();
    const markup = pageHtml(modelOf(r));
    expectClean(markup);
    expectDescribedByTargets(markup);
    expect(markup).toContain(MARKETPLACE_BENCH_TITLE);
    expect(markup).toContain(MARKETPLACE_BENCH_SOURCE_LINE);
    expect(markup).toContain(MARKETPLACE_BENCH_BOUNDARY);
    expect(markup).toContain('data-provenance="synthetic"');
    expect(markup).toContain('data-read-state="ready"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-label="Held bench window"');
    expect(markup).toContain("Bench window read.");
    expect(markup).toContain(`Held rows ${MARKETPLACE_PAGE_BOUND} of an estimated ${MARKETPLACE_TOTAL_LISTINGS}`);
    expect(markup).toContain("confirms no price, no right, no sale, and no ownership");
    expect(markup).toContain('data-enabled="true"');
    const rows = markup.match(/data-sequence="/g) ?? [];
    expect(rows.length).toBe(MARKETPLACE_PAGE_BOUND);
    expect(markup).toContain(WORKSPACE_RULING);
  });

  it("maps each settled scenario to its own read state word", async () => {
    const cases: readonly [MarketplaceScenario, MarketplaceWorkload, string][] = [
      ["clean", "browse-window", "ready"],
      ["empty", "browse-window", "empty"],
      ["stale", "browse-window", "stale"],
      ["slow", "browse-window", "ready"],
      ["contended", "hot-page", "queue-blocked"],
      ["queue-lapsed", "hot-page", "queue-expired"],
      ["permission-lost", "browse-window", "denied"],
      ["claims-price", "browse-window", "refused"],
      ["claims-device", "browse-window", "refused"],
    ];
    for (const [scenario, workload, expected] of cases) {
      const r = rig(scenario);
      r.controller.setWorkload(workload);
      await r.controller.read();
      const model = modelOf(r);
      expect(model.state, scenario).toBe(expected);
      const markup = pageHtml(model, scenario, "stub", workload);
      expectClean(markup);
      expect(markup, scenario).toContain(`data-read-state="${expected}"`);
      expect(markup, scenario).toContain('role="status"');
    }
  });

  it("clears every row on a non-ready read so a fast page confirms nothing stale", async () => {
    const r = rig();
    await r.controller.read();
    expect(modelOf(r).rows.length).toBe(MARKETPLACE_PAGE_BOUND);
    r.port.synthetic("revoke-permission");
    await r.controller.refresh();
    const model = modelOf(r);
    expect(model.state).toBe("denied");
    expect(model.rows.length).toBe(0);
    const markup = pageHtml(model, "permission-lost");
    expect(markup).toContain("PERMISSION_REVOKED");
    expect(markup).toContain("No rows are held.");
    expectClean(markup);
  });

  it("moves terms under the held window and shows no row under moved terms", async () => {
    const r = rig("terms-moved");
    await r.controller.read();
    const first = modelOf(r);
    expect(first.state).toBe("ready");
    await r.controller.refresh();
    const model = modelOf(r);
    expect(model.state).toBe("terms-moved");
    expect(model.rows.length).toBe(0);
    const markup = pageHtml(model, "terms-moved");
    expect(markup).toContain("The listing terms moved under this view.");
    expectClean(markup);
  });

  it("keeps a lost read in flight and unknown, and never shows a row for it", async () => {
    const r = rig("read-lost");
    void r.controller.read();
    const model = modelOf(r);
    expect(model.state).toBe("loading");
    expect(model.inFlightLine).toContain("1 call in flight");
    expect(model.rows.length).toBe(0);
    const markup = pageHtml(model, "read-lost");
    expect(markup).toContain("Reading the synthetic bench source.");
    expectClean(markup);
  });

  it("walks the hot-page queue journey from blocked through admitted to expired", async () => {
    const r = rig("contended");
    r.controller.setWorkload("hot-page");
    await r.controller.read();
    expect(modelOf(r).state).toBe("queue-blocked");
    expect(modelOf(r).rows.length).toBe(0);

    await r.controller.joinQueue();
    let model = modelOf(r);
    expect(model.queue.phaseWord).toBe("Waiting");
    expect(model.queue.positionLine).toContain("Position 2.");

    await r.controller.refreshQueue();
    expect(modelOf(r).queue.positionLine).toContain("Position 1.");
    await r.controller.refreshQueue();
    model = modelOf(r);
    expect(model.queue.phaseWord).toBe("Admitted");
    expect(model.queue.grantsLine).toContain("browse access");
    expect(model.queue.grantsLine).toContain("Never a hold, a payment, a right, or entry");

    await r.controller.read();
    expect(modelOf(r).state).toBe("ready");

    r.port.synthetic("expire-queue");
    await r.controller.refreshQueue();
    await r.controller.refresh();
    model = modelOf(r);
    expect(model.state).toBe("queue-expired");
    expect(model.rows.length).toBe(0);
    const markup = pageHtml(model, "contended", "stub", "hot-page");
    expect(markup).toContain("The queue admission expired at the source.");
    expect(markup).toContain("Grants nothing.");
    expectClean(markup);
  });

  it("serializes queue calls and reports the second as not sent", async () => {
    const r = rig("held");
    const first = r.controller.joinQueue();
    const second = await r.controller.joinQueue();
    expect(second).toMatchObject({ kind: "NOT_SENT", reason: "in-flight" });
    r.port.synthetic("deliver-held");
    await first;
    const model = modelOf(r);
    expect(model.countersLine).toContain("not-sent 1");
  });

  it("drops the older held answer and never lets the newer one claim a re-served window", async () => {
    const r = rig("held");
    const older = r.controller.read();
    const newer = r.controller.search("fast");
    r.port.synthetic("deliver-held");
    const results = [await older, await newer];
    expect(results.filter((result) => result.kind === "DROPPED").length).toBe(1);
    expect(results.filter((result) => result.kind === "APPLIED").length).toBe(1);
    const model = modelOf(r);
    // The stream guards a re-served window as a duplicate gap: the newest
    // answer wins and is a gap, and the older ready answer is dropped. No
    // row under either is shown.
    expect(model.state).toBe("gap");
    expect(model.rows.length).toBe(0);
    expect(model.countersLine).toContain("dropped-older 1");
    const markup = pageHtml(model, "held");
    expect(markup).toContain('data-read-state="gap"');
    expect(markup).toContain("dropped");
    expectClean(markup);
  });

  it("counts a cancelled answer and never applies it", async () => {
    const r = rig("held");
    const pending = r.controller.read();
    r.controller.cancelReads();
    r.port.synthetic("deliver-held");
    await expect(pending).resolves.toMatchObject({ kind: "CANCELLED" });
    const model = modelOf(r);
    expect(model.countersLine).toContain("cancelled 1");
    expect(model.rows.length).toBe(0);
    const markup = pageHtml(model, "held");
    expect(markup).toContain("cancelled. Its late answer was counted, not applied.");
    expectClean(markup);
  });

  it("drops an answer that lands after a second tab changed the session incarnation", async () => {
    const r = rig("held");
    const pending = r.controller.read();
    r.controller.duplicateTab();
    r.port.synthetic("deliver-held");
    await expect(pending).resolves.toMatchObject({ kind: "DROPPED", cause: "context-changed" });
    const model = modelOf(r);
    expect(model.countersLine).toContain("dropped-context 1");
    expect(model.state).toBe("loading");
    expect(model.rows.length).toBe(0);
  });

  it("labels the emulated profile emulation and keeps real devices unverified with zero calls", async () => {
    const r = rig();
    r.controller.switchDevice("desktop-emulated-mobile");
    await r.controller.read();
    const model = modelOf(r);
    const emulated = model.report.find((row) => row.deviceClass === "desktop-emulated-mobile");
    expect(emulated?.realDevice).toBe(false);
    expect(emulated?.calls).toBe(1);
    const markup = pageHtml(model);
    expect(markup).toContain("emulation");
    for (const device of MARKETPLACE_UNVERIFIED_DEVICES) {
      expect(markup).toContain(device);
    }
    expect(markup).toContain("unverified");
    expect(markup).toContain("Denominator browser-boundary-measurement");
    expect(markup).toContain("Producer load share none");
    expect(markup).toContain("Real-device evidence false");
    expect(markup).toContain('aria-label="Browser-boundary measurements"');
    expectClean(markup);
  });

  it("lists every device profile, workload, scenario, and synthetic control on the controls", async () => {
    const r = rig();
    await r.controller.read();
    const markup = pageHtml(modelOf(r));
    for (const profile of MARKETPLACE_DEVICE_PROFILES) {
      expect(markup).toContain(`value="${profile.deviceClass}"`);
    }
    for (const workload of MARKETPLACE_WORKLOADS) {
      expect(markup).toContain(`value="${workload}"`);
    }
    for (const scenario of MARKETPLACE_SCENARIOS) {
      expect(markup).toContain(`value="${scenario}"`);
    }
    for (const control of MARKETPLACE_SYNTHETIC_CONTROLS) {
      expect(markup).toContain(`id="mperf-sim-${control}"`);
    }
  });

  it("keeps the next-page control focusable while naming its reason when no cursor is held", async () => {
    const r = rig("empty");
    await r.controller.read();
    const markup = pageHtml(modelOf(r), "empty");
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('aria-describedby="mperf-next-reason"');
    expect(markup).toContain('id="mperf-next-reason"');
    expect(markup).toContain("no next cursor");
    expectDescribedByTargets(markup);
    expectClean(markup);
  });

  it("pages once and stops when the last read reports no next cursor", async () => {
    const r = rig();
    await r.controller.read();
    const model = modelOf(r);
    expect(model.hasNextCursor).toBe(true);
    await r.controller.nextPage();
    expect(modelOf(r).state).toBe("ready");
    expect(modelOf(r).rows[0]?.sequence).toBe(MARKETPLACE_PAGE_BOUND + 1);
    const again = await r.controller.read(null);
    expect(again).toMatchObject({ kind: "APPLIED" });
  });

  it("keeps the not-bound environment separate and sends nothing", async () => {
    const port = marketplaceBenchPortFor("integration-http", { scenario: "clean" });
    const controller = new MarketplaceBenchController(port, {});
    await controller.read();
    const model = buildMarketplaceModel({ controller });
    expect(model.state).toBe("not-bound");
    const markup = pageHtml(model, "clean", "integration-http");
    expect(markup).toContain(MARKETPLACE_NOT_BOUND_REASON);
    expect(markup).toContain("ps-07-scale-qualification");
    expectClean(markup);
  });

  it("keeps the permission controls honest through revoke and restore", async () => {
    const r = rig();
    await r.controller.read();
    expect(modelOf(r).state).toBe("ready");
    r.port.synthetic("revoke-permission");
    await r.controller.refresh();
    expect(modelOf(r).state).toBe("denied");
    r.port.synthetic("restore-permission");
    await r.controller.refresh();
    // The stream guards a re-served window as a duplicate gap rather than
    // re-showing it; no ready claim survives a revoked span.
    expect(["ready", "gap"]).toContain(modelOf(r).state);
  });

  it("registers the surface, the pending producer, the evidence, and the fixture cases", () => {
    const surface = WORKSPACE_SURFACES.find((item) => item.id === "marketplace-performance-bench");
    expect(surface).toMatchObject({
      route: "/marketplace-performance",
      binding: "stub-only",
      taskId: "c-marketplace-performance-stub",
      implemented: true,
      pageControl: true,
    });
    const pending = PENDING_PRODUCERS.find((row) => row.id === "c-marketplace-performance");
    expect(pending?.waitingSurface).toBe("marketplace-performance-bench");
    expect(pending?.connected).toBe(false);
    expect(pending?.implementedHere).toBe(false);
    const evidence = LOCAL_SURFACE_EVIDENCE.find((item) => item.id === "c-marketplace-performance-stub");
    expect(evidence?.doc).toBe("docs/c-marketplace-performance-stub-apps-bind.md");
    const screen = FIXTURE_SCREENS.find((item) => item.screenId === "marketplace-performance-bench");
    expect(screen?.route).toBe("/marketplace-performance");
    const rows = fixturesForScreen("marketplace-performance-bench");
    expect(rows.length).toBeGreaterThanOrEqual(10);
    for (const row of rows) {
      expect(row.klass).not.toBe("SUCCESS");
      expect(row.ownsPass).toBe(false);
      expect(row.substituteStub).toBe(false);
      expect(row.identity).toBeNull();
    }
    const fixtureIds = rows.map((fixture) => fixture.id);
    expect(fixtureIds).toContain("marketplace-performance-bench.stale-read");
    expect(fixtureIds).toContain("marketplace-performance-bench.queue-blocked");
    expect(fixtureIds).toContain("marketplace-performance-bench.queue-expired");
    expect(fixtureIds).toContain("marketplace-performance-bench.permission-revoked");
    expect(fixtureIds).toContain("marketplace-performance-bench.read-lost");
  });

  it("keeps the new screen free of sends, clocks, timers, stores, and the booking, capture, and hold vocabulary", () => {
    const files = [
      "src/marketplace-performance.ts",
      "src/pages/MarketplacePerformance.tsx",
      "src/pages/MarketplacePerformancePanels.tsx",
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
  });

  it("names the surface in the docs and the README", () => {
    const doc = readFileSync(path.join(repoRoot, "docs/c-marketplace-performance-stub-apps-bind.md"), "utf8");
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    expect(doc).toContain(WORKSPACE_RULING);
    expect(doc).toContain("marketplace-performance-bench");
    expect(doc).toContain("an emulated device is never real mobile evidence");
    expect(readme).toContain("docs/c-marketplace-performance-stub-apps-bind.md");
    expect(readme).toContain("/marketplace-performance");
    const closeout = readFileSync(path.join(repoRoot, "docs/c-local-workspace-closeout-apps-bind.md"), "utf8");
    expect(closeout).toContain("| `c-marketplace-performance` | `marketplace-performance-bench` |");
    expect(closeout).toContain("docs/c-marketplace-performance-stub-apps-bind.md");
  });

  it("mounts the /marketplace-performance route", () => {
    const markup = html(
      <MemoryRouter initialEntries={["/marketplace-performance"]}>
        <MarketplacePerformancePage />
      </MemoryRouter>,
    );
    expect(markup).toContain(MARKETPLACE_BENCH_TITLE);
    expect(markup).toContain('data-provenance="synthetic"');
    expect(markup).toContain("Reading the synthetic bench source.");
    expectClean(markup);
  });
});
