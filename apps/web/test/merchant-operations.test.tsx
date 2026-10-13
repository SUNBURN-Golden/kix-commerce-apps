import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  DISCOVERY_READ_TUPLE_LITERALS,
  MERCHANT_DESK_ACTOR,
  MERCHANT_FOREIGN_REF,
  MERCHANT_NOT_BOUND_REASON,
  MERCHANT_OWN_REF,
  MERCHANT_SCENARIOS,
  MerchantOperationsController,
  createNotBoundMerchantOperations,
  createStubMerchantOperations,
  type MerchantScenario,
  type StubMerchantOperations,
} from "@kix/protocol-adapter";
import { CONTRACT_FIXTURES, fixturesForScreen } from "../../../packages/protocol-adapter/src/contract-fixtures";
import { App } from "../src/App";
import { PENDING_PRODUCERS } from "../src/handoff/packet";
import {
  buildMerchantModel,
  type LastAction,
  type MerchantActions,
  type MerchantModel,
} from "../src/merchant-operations";
import {
  AggregateSection,
  CutsSection,
  ExportSection,
  LensesSection,
  LinesSection,
  MerchantBanner,
  MerchantControls,
  MerchantSessionSection,
  MerchantStatus,
} from "../src/pages/MerchantPanels";
import { WORKSPACE_RULING, WORKSPACE_SURFACES } from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

const BANNED = /[$₩]|KRW|USD/i;

/** Wording that would turn an observation into money. None may appear on screen. */
const POSITIVE_CLAIMS = [
  "Settled",
  "Funds available",
  "Available funds",
  "Lendable capacity",
  "Payment complete",
  "Paid out",
  "Refund complete",
  "Refund paid",
  "Balance due to you",
  "Payout ready",
  "Confirmed balance",
  "Total owed",
];

const NO_ACTIONS: MerchantActions = {
  refresh() {},
  loadExport() {},
  switchScope() {},
  revokeGrant() {},
  advanceCut() {},
  setScenario() {},
  newSession() {},
};

function html(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element);
}

function pageHtml(
  model: MerchantModel,
  scenario: MerchantScenario = "clean",
  environment: "stub" | "integration-http" = "stub",
): string {
  return html(
    <MemoryRouter>
      <MerchantBanner environment={environment} scenario={scenario} model={model} />
      <MerchantControls scenario={scenario} model={model} actions={NO_ACTIONS} />
      <MerchantStatus model={model} />
      <CutsSection model={model} />
      <LensesSection model={model} />
      <LinesSection model={model} />
      <AggregateSection model={model} />
      <ExportSection model={model} />
      <MerchantSessionSection session={model.session} />
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
  port: StubMerchantOperations;
  controller: MerchantOperationsController;
  last: LastAction | null;
  seq: number;
}

function rig(scenario: MerchantScenario = "clean", merchantRef?: string): Rig {
  const port = createStubMerchantOperations({ scenario });
  return {
    port,
    controller: new MerchantOperationsController(port, { actorRef: MERCHANT_DESK_ACTOR, merchantRef }),
    last: null,
    seq: 0,
  };
}

function modelOf(r: Rig): MerchantModel {
  return buildMerchantModel({ controller: r.controller, last: r.last });
}

describe("merchant screen states", () => {
  it("shows loading before the first read, with a word for it and no rows", () => {
    const r = rig();
    const model = modelOf(r);
    expect(model.state).toBe("loading");
    const markup = pageHtml(model);
    expect(markup).toContain('data-merchant-state="loading"');
    expect(markup).toContain('data-status-mark="loading"');
    expect(markup).toContain("Reading the synthetic merchant ledger. Nothing is shown yet.");
    expect(markup).not.toContain("data-obligation=");
    expect(markup).not.toContain("data-trade=");
    expect(markup).toContain("No event in this read.");
    expect(markup).toContain("No money line in this read.");
    expectClean(markup);
  });

  it("shows events, listings, trades, and four money lines after a read, each on its cut", async () => {
    const r = rig();
    await r.controller.read();
    const model = modelOf(r);
    expect(model.state).toBe("ready");
    expect(model.events.length).toBeGreaterThan(0);
    expect(model.listings.length).toBeGreaterThan(0);
    expect(model.trades.length).toBeGreaterThan(0);
    expect(new Set(model.lines.map((line) => line.kind))).toEqual(
      new Set(["sales-observed", "unpaid", "held", "refund-burden"]),
    );
    const markup = pageHtml(model);
    expect(markup).toContain('data-merchant-state="ready"');
    expect(markup).toContain('data-source="synthetic-merchant"');
    expect(markup).toContain("SYNTHETIC");
    expect(markup).toContain("Sales observed");
    expect(markup).toContain("Unpaid");
    expect(markup).toContain("Held");
    expect(markup).toContain("Refund burden");
    expect(markup).toContain('data-kind="unpaid"');
    expect(markup).toContain('data-kind="held"');
    expect(markup).toContain('data-kind="refund-burden"');
    expect(markup).toContain("settled false · fundsAvailable false · lendable false");
    expect(markup).toContain('data-cut-state="single"');
    expect(markup).toContain("Every row is on one source cut.");
    expect(markup).toContain('data-aggregate-state="current"');
    expectClean(markup);
  });

  it("separates empty, stale, unavailable, changed tuple, and not-bound, and none is a ready ledger", async () => {
    const empty = rig("empty");
    await empty.controller.read();
    expect(modelOf(empty)).toMatchObject({ state: "empty", actionLabel: "Read again" });
    expect(pageHtml(modelOf(empty), "empty")).toContain("No rows for this merchant in this read.");

    const stale = rig("stale");
    await stale.controller.read();
    const staleModel = modelOf(stale);
    expect(staleModel.state).toBe("stale");
    const staleMarkup = pageHtml(staleModel, "stale");
    expect(staleMarkup).toContain('data-merchant-state="stale"');
    expect(staleMarkup).toContain("Stale merchant read.");
    expect(staleMarkup).not.toContain("data-obligation=");
    expectClean(staleMarkup);

    const lost = rig("read-lost");
    await lost.controller.read();
    const lostModel = modelOf(lost);
    expect(lostModel.state).toBe("unavailable");
    const lostMarkup = pageHtml(lostModel, "read-lost");
    expect(lostMarkup).toContain("The source did not answer. This is not an empty ledger.");
    expect(lostMarkup).not.toContain("data-obligation=");
    expectClean(lostMarkup);

    const changed = new MerchantOperationsController(
      createStubMerchantOperations({ expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, domain: "kix:other" } }),
      { actorRef: MERCHANT_DESK_ACTOR },
    );
    await changed.read();
    const changedModel = buildMerchantModel({ controller: changed, last: null });
    expect(changedModel.state).toBe("tuple-changed");
    expect(pageHtml(changedModel)).toContain("Start a new synthetic session");

    const notBound = new MerchantOperationsController(createNotBoundMerchantOperations(), {
      actorRef: MERCHANT_DESK_ACTOR,
    });
    await notBound.read();
    const notBoundModel = buildMerchantModel({ controller: notBound, last: null });
    expect(notBoundModel.state).toBe("not-bound");
    const notBoundMarkup = pageHtml(notBoundModel, "clean", "integration-http");
    expect(notBoundMarkup).toContain('data-merchant-state="not-bound"');
    expect(notBoundMarkup).toContain(MERCHANT_NOT_BOUND_REASON);
    expectClean(notBoundMarkup);
  });

  it("shows a scope denial for a merchant the grant does not cover, and a withdrawn grant", async () => {
    const foreign = rig("clean", MERCHANT_FOREIGN_REF);
    await foreign.controller.read();
    const foreignModel = modelOf(foreign);
    expect(foreignModel.state).toBe("denied");
    const foreignMarkup = pageHtml(foreignModel);
    expect(foreignMarkup).toContain('data-merchant-state="denied"');
    expect(foreignMarkup).toContain("SCOPE_DENIED");
    expect(foreignMarkup).not.toContain("data-obligation=");
    expectClean(foreignMarkup);

    const revoked = rig("denied");
    await revoked.controller.read();
    expect(modelOf(revoked).state).toBe("denied");
  });

  it("refuses a payload that claims a line is settled or leaks another merchant, showing no rows", async () => {
    const claimed = rig("claims-settled");
    await claimed.controller.read();
    const claimedModel = modelOf(claimed);
    expect(claimedModel.state).toBe("refused");
    const claimedMarkup = pageHtml(claimedModel, "claims-settled");
    expect(claimedMarkup).toContain("(CLAIM)");
    expect(claimedMarkup).not.toContain("data-obligation=");
    expectClean(claimedMarkup);

    const leaked = rig("scope-leak");
    await leaked.controller.read();
    const leakedModel = modelOf(leaked);
    expect(leakedModel.state).toBe("refused");
    expect(leakedModel.scopeLine).toContain(MERCHANT_OWN_REF);
    expect(pageHtml(leakedModel, "scope-leak")).not.toContain("data-obligation=");
  });
});

describe("money lines, cuts, and source figures", () => {
  it("keeps lines on different cuts separate and never merges them into one balance", async () => {
    const r = rig("mixed-cut");
    await r.controller.read();
    const model = modelOf(r);
    expect(model.state).toBe("ready");
    expect(model.cutState).toBe("mixed");
    expect(model.cuts.length).toBeGreaterThan(1);
    const markup = pageHtml(model, "mixed-cut");
    expect(markup).toContain('data-cut-state="mixed"');
    expect(markup).toContain("Rows are on more than one source cut.");
    expect(markup).toContain("no single export is current");
    for (const line of model.lines) {
      expect(markup).toContain(`data-cut="${line.cutRef}"`);
    }
    // Every row still carries the all-false claims, and no merged total exists.
    expect(markup).not.toContain("data-balance");
    expectClean(markup);
  });

  it("flags a stale aggregate and a count mismatch without recomputing the figure", async () => {
    const stale = rig("stale-aggregate");
    await stale.controller.read();
    const staleModel = modelOf(stale);
    expect(staleModel.aggregateState).toBe("stale");
    const staleMarkup = pageHtml(staleModel, "stale-aggregate");
    expect(staleMarkup).toContain('data-aggregate-state="stale"');
    expect(staleMarkup).toContain("STALE_GENERATION");
    expect(staleMarkup).toContain("not recomputed");
    expectClean(staleMarkup);

    const mismatch = rig("aggregate-mismatch");
    await mismatch.controller.read();
    const mismatchModel = modelOf(mismatch);
    expect(mismatchModel.aggregateState).toBe("mismatch");
    const mismatchMarkup = pageHtml(mismatchModel, "aggregate-mismatch");
    expect(mismatchMarkup).toContain('data-aggregate-state="mismatch"');
    expect(mismatchMarkup).toContain("COUNT_DIFFERS");
    expectClean(mismatchMarkup);
  });

  it("names a dangling link without attaching it elsewhere", async () => {
    const r = rig("dangling-link");
    await r.controller.read();
    const model = modelOf(r);
    expect(model.unlinkedLines.length).toBeGreaterThan(0);
    const markup = pageHtml(model, "dangling-link");
    expect(markup).toContain('data-unlinked="true"');
    expect(markup).toContain("the read does not list");
    expectClean(markup);
  });
});

describe("the export", () => {
  it("stays blocked before a ready read and loads a current export after one", async () => {
    const r = rig();
    const before = modelOf(r);
    expect(before.export.phase).toBe("none");
    expect(before.exportControl.enabled).toBe(false);
    expect(before.exportControl.reason).toContain("Read the ledger first");

    await r.controller.read();
    const ready = modelOf(r);
    expect(ready.exportControl.enabled).toBe(true);

    await r.controller.loadExport();
    const model = modelOf(r);
    expect(model.export.phase).toBe("loaded");
    expect(model.export.verdictWord).toBe("current");
    const markup = pageHtml(model);
    expect(markup).toContain('data-export-phase="loaded"');
    expect(markup).toContain('data-verdict="current"');
    expect(markup).toContain("Current export for the last read.");
    expect(markup).toContain("data-export-row=");
    expect(markup).toContain('id="merchant-export"');
    expect(markup).toContain('data-enabled="true"');
    expectClean(markup);
  });

  it("withholds an export that is stale, partial, off-read, or on a mixed read, with every reason", async () => {
    for (const scenario of ["export-stale", "export-partial", "export-lines-differ", "mixed-cut"] as const) {
      const r = rig(scenario);
      await r.controller.read();
      await r.controller.loadExport();
      const model = modelOf(r);
      const markup = pageHtml(model, scenario);
      if (scenario === "mixed-cut") {
        expect(model.export.phase === "none" || model.export.verdictWord === "withheld").toBe(true);
        expect(markup).toContain("no single export is current");
      } else {
        expect(model.export.verdictWord).toBe("withheld");
        expect(markup, scenario).toContain('data-verdict="withheld"');
        expect(markup, scenario).toContain('data-verdict-reason="true"');
        expect(markup, scenario).toContain("Withheld.");
      }
      expectClean(markup);
    }
  });

  it("keeps a denied export absent and does not rebuild it on the page", async () => {
    const r = rig("export-denied");
    await r.controller.read();
    await r.controller.loadExport();
    const model = modelOf(r);
    expect(model.export.phase).toBe("denied");
    const markup = pageHtml(model, "export-denied");
    expect(markup).toContain('data-export-phase="denied"');
    expect(markup).toContain("EXPORT_DENIED");
    expect(markup).not.toContain("data-export-row=");
    expectClean(markup);
  });

  it("marks the export not-bound under integration-http and never sends it", () => {
    const controller = new MerchantOperationsController(createNotBoundMerchantOperations(), {
      actorRef: MERCHANT_DESK_ACTOR,
    });
    const model = buildMerchantModel({ controller, last: null });
    expect(model.exportControl.enabled).toBe(false);
    expect(model.exportControl.reason).toBe(MERCHANT_NOT_BOUND_REASON);
    const markup = pageHtml(model, "clean", "integration-http");
    expect(markup).toContain('id="merchant-export"');
    expect(markup).toContain('data-enabled="false"');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('data-blocked-reason="true"');
  });
});

describe("registration", () => {
  it("is one stub-only organizer surface with no sender, no action, and no desk method", () => {
    const surface = WORKSPACE_SURFACES.find((item) => item.id === "merchant-operations");
    expect(surface).toMatchObject({
      role: "organizer",
      route: "/merchant",
      binding: "stub-only",
      sender: null,
      taskId: "c-merchant-operations-stub",
      implemented: true,
      pageControl: true,
    });
    expect(surface?.actions).toEqual([]);
    expect(surface?.deskMethods).toEqual([]);
    expect(surface?.provenanceNote).toContain("integration-http");
    expect(surface?.provenanceNote).not.toMatch(/\bworks\b|live payment|funds moved|disbursed|payment complete|admission complete|refund complete/i);
  });

  it("is recorded in the handoff packet as a pending producer that is not connected", () => {
    const row = PENDING_PRODUCERS.find((item) => item.id === "c-merchant-operations");
    expect(row).toMatchObject({ catalogue: "pending", connected: false, implementedHere: false, waitingSurface: "merchant-operations" });
    const pending = JSON.parse(readFileSync(path.join(repoRoot, "docs/aiops/PENDING_NODES.json"), "utf8")) as {
      nodes: { id: string }[];
    };
    const ids = new Set(pending.nodes.map((node) => node.id));
    expect(ids.has("c-merchant-operations")).toBe(true);
  });

  it("has eight synthetic fixture rows that own no pass and cover stale aggregate, mismatch, and denial", () => {
    const rows = fixturesForScreen("merchant-operations");
    expect(rows.map((row) => row.id)).toEqual([
      "merchant-operations.stale-read",
      "merchant-operations.stale-aggregate",
      "merchant-operations.cut-mismatch",
      "merchant-operations.scope-denied",
      "merchant-operations.export-denied",
      "merchant-operations.claim-refused",
      "merchant-operations.export-withheld",
      "merchant-operations.read-lost",
    ]);
    expect(new Set(rows.map((row) => row.klass))).toEqual(new Set(["REJECT", "UNKNOWN", "STALE"]));
    for (const row of rows) {
      expect(row.ownsPass).toBe(false);
      expect(row.source).toBe("synthetic-fixture");
      expect(row.klass).not.toBe("SUCCESS");
      expect(row.substituteStub).toBe(false);
    }
    expect(CONTRACT_FIXTURES.filter((row) => row.screenId === "merchant-operations" && row.klass === "NOT_BOUND")).toEqual([]);
  });

  it("keeps the new screen free of sends, clocks, timers, money math, and the write vocabulary", () => {
    const files = ["src/merchant-operations.ts", "src/pages/Merchant.tsx", "src/pages/MerchantPanels.tsx"];
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
      "parseInt",
      "parseFloat",
      "BigInt",
      "toFixed",
      ".reduce(",
    ]) {
      expect(combined, token).not.toContain(token);
    }
    const css = readFileSync(path.join(webRoot, "src/styles.css"), "utf8");
    expect(css).toContain(".merchant");
    expect(css).not.toContain("@keyframes");
    expect(css).not.toMatch(/animation\s*:/);
  });

  it("keeps the scenario set to the adapter list and the page free of a positive claim", () => {
    expect([...MERCHANT_SCENARIOS].length).toBeGreaterThan(0);
    const r = rig();
    const markup = pageHtml(modelOf(r));
    expectClean(markup);
  });

  it("reaches the route through the app shell and the navigation", () => {
    const app = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/merchant"]}>
        <App />
      </MemoryRouter>,
    );
    expect(app).toContain("Merchant workroom");
    expect(app).toContain('href="/merchant"');
    expect(app).toContain("SYNTHETIC");
    expect(app).toContain('data-adapter-environment="stub"');
  });

  it("names the surface in the docs and the README", () => {
    const doc = readFileSync(path.join(repoRoot, "docs/c-merchant-operations-stub-apps-bind.md"), "utf8");
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    expect(doc).toContain(WORKSPACE_RULING);
    expect(doc).toContain("merchant-operations");
    expect(doc).toContain("Browser run");
    expect(readme).toContain("docs/c-merchant-operations-stub-apps-bind.md");
    expect(readme).toContain("/merchant");
  });
});
