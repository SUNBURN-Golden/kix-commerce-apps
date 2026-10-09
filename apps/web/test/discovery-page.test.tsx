import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { COMMERCE_COMMAND_BINDINGS, type Performance } from "@kix/protocol-adapter";
import { App } from "../src/App";
import { FIXTURE_IDS, STALE_PRICE_AS_OF } from "../src/discovery/fixture";
import { DEFAULT_DISCOVERY_QUERY, type DiscoveryQuery } from "../src/discovery/model";
import {
  buildDiscoveryModel,
  loadDiscoveryOnce,
  SEAT_GA_NOTE,
  type DiscoveryModel,
} from "../src/discovery-workspace";
import type { CatalogState } from "../src/buyer-workspace";
import { WORKSPACE_RULING } from "../src/workspace/registry";
import { DiscoveryDetail, DiscoveryScreen } from "../src/pages/Discovery";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BANNED = /[$₩]|KRW|USD|still open|in stock/i;

const PERFORMANCES: Performance[] = [
  {
    eventId: "evt_lanterns",
    title: "North Station Lanterns",
    venue: "Hall A",
    startsAt: "2026-10-03T19:00:00.000Z",
    remainingCapacity: 40,
  },
  {
    eventId: "evt_paper_orchestra",
    title: "Paper Orchestra",
    venue: "Hall B",
    startsAt: "2026-10-04T15:30:00.000Z",
    remainingCapacity: 24,
  },
  {
    eventId: "evt_last_ferry",
    title: "Last Ferry Diagram",
    venue: "Studio",
    startsAt: "2026-10-05T20:00:00.000Z",
    remainingCapacity: 12,
  },
];

const READY: CatalogState = { kind: "ready", performances: PERFORMANCES };

describe("discovery page", () => {
  it("renders the synthetic sample, the ruling, and distinct row kinds", () => {
    const html = renderScreen(modelFor(DEFAULT_DISCOVERY_QUERY, READY));
    expect(html).toContain("SYNTHETIC");
    expect(html).toContain('data-provenance="synthetic"');
    expect(html).toContain('data-source="synthetic-fixture"');
    expect(html).toContain(WORKSPACE_RULING);
    expect(html).toContain("Stub-shape receipts are not from the gate.");
    expect(html).toContain("A reload clears page-load state and re-sends nothing.");
    expect(html).toContain("Search and filters apply to the materialized sample only.");
    expect(html).toContain("synthetic scale 1000000");
    expect(html).toContain('data-state="ready"');
    expect(html).toContain('data-catalog="ready"');
    expect(html).toContain("source stub-shape");
    expect(html).toContain('role="listbox"');
    expect(html).toContain('aria-label="Discovery results"');
    expect(html).toContain('aria-label="Scale index"');
    expect(html).toMatch(/tab[iI]ndex="0"/);
    expect(html).not.toMatch(BANNED);
    expect(html).not.toContain('href="/booking/');
    expect(liCount(html)).toBeLessThanOrEqual(60);

    const event = sliceKind(html, "event");
    const seat = sliceKind(html, "seat");
    const ga = sliceKind(html, "ga");
    const resale = sliceKind(html, "resale");
    expect(event).toContain("kind event");
    expect(event).toContain("synthetic tier T1");
    expect(event).not.toContain("synthetic count");
    expect(event).not.toContain("no seat assigned");
    expect(event).not.toContain("listing (synthetic)");
    expect(seat).toContain("section A");
    expect(seat).toContain("synthetic count 4");
    expect(seat).not.toContain("no seat assigned");
    expect(ga).toContain("no seat assigned");
    expect(ga).toContain("synthetic count 80");
    expect(resale).toContain("listing (synthetic)");
    expect(resale).toContain(COMMERCE_COMMAND_BINDINGS.listResale.reason);
    expect(resale).toContain('data-state="not-bound"');
    expect(html).toContain("cancelled (synthetic)");
    expect(html).toContain("STALE");
    expect(html).toContain('data-state="stale"');
    expect(html).toContain(`dateTime="${STALE_PRICE_AS_OF}"`);
  });

  it("keeps a wide page inside the mounted window", () => {
    const html = renderScreen(modelFor({ ...DEFAULT_DISCOVERY_QUERY, pageSize: 50 }, READY));
    expect(liCount(html)).toBeLessThanOrEqual(60);
    expect(html).toContain("SYNTHETIC");
    expect(html).not.toMatch(BANNED);
  });

  it("shows an empty result apart from a filter conflict", () => {
    const empty = renderScreen(modelFor({ ...DEFAULT_DISCOVERY_QUERY, text: "zzzz-no-such-row" }, READY));
    expect(empty).toContain('data-state="empty"');
    expect(empty).toContain("Clear filters");
    expect(empty).toContain("No matching synthetic rows.");
    expect(empty).not.toContain('data-state="filter-conflict"');
    expect(empty).toContain("SYNTHETIC");

    const conflict = renderScreen(modelFor({ ...DEFAULT_DISCOVERY_QUERY, kinds: ["ga"], section: "A" }, READY));
    expect(conflict).toContain('data-state="filter-conflict"');
    expect(conflict).toContain("Clear conflict");
    expect(conflict).toContain("A GA kind cannot take a section.");
    expect(conflict).toContain("The query was not run.");
    expect(conflict).not.toContain('data-state="empty"');
  });

  it("shows loading, error, and not-bound catalogue states", () => {
    const loading = renderScreen(modelFor(DEFAULT_DISCOVERY_QUERY, { kind: "loading" }));
    expect(loading).toContain("Loading performances.");
    expect(loading).toContain('data-catalog="loading"');
    expect(loading).toContain("SYNTHETIC");

    const error = renderScreen(modelFor(DEFAULT_DISCOVERY_QUERY, { kind: "error", message: "list failed" }));
    expect(error).toContain("list failed");
    expect(error).toContain("Read again");
    expect(error).toContain('data-catalog="error"');

    const notBound = renderScreen(
      modelFor(DEFAULT_DISCOVERY_QUERY, {
        kind: "not-bound",
        reason: COMMERCE_COMMAND_BINDINGS.listPerformances.reason,
      }),
    );
    expect(notBound).toContain(COMMERCE_COMMAND_BINDINGS.listPerformances.reason);
    expect(notBound).toContain('data-catalog="not-bound"');
    expect(notBound).toContain('data-source="none"');
    expect(notBound).not.toContain('href="/booking/');
  });

  it("links only an on-sale event whose id is on the catalogue read", () => {
    expect(detailHtml(FIXTURE_IDS.lanterns, READY)).toContain('href="/booking/evt_lanterns"');
    expect(detailHtml(FIXTURE_IDS.lanterns, READY)).toContain("Open booking");
    expect(detailHtml(FIXTURE_IDS.paper, READY)).toContain('href="/booking/evt_paper_orchestra"');
    expect(detailHtml(FIXTURE_IDS.ferry, READY)).toContain('href="/booking/evt_last_ferry"');

    const stale = detailHtml(FIXTURE_IDS.stale, READY);
    expect(stale).toContain("STALE");
    expect(stale).toContain(`dateTime="${STALE_PRICE_AS_OF}"`);
    expect(stale).toContain('href="/booking/evt_paper_orchestra"');

    for (const rowId of [FIXTURE_IDS.cancelled, FIXTURE_IDS.seat, FIXTURE_IDS.ga, FIXTURE_IDS.resale, FIXTURE_IDS.soldOut, FIXTURE_IDS.unlinked]) {
      expect(detailHtml(rowId, READY)).not.toContain('href="/booking/');
    }
    expect(detailHtml(FIXTURE_IDS.cancelled, READY)).toContain("cancelled (synthetic)");
    expect(detailHtml(FIXTURE_IDS.seat, READY)).toContain(SEAT_GA_NOTE);
    expect(detailHtml(FIXTURE_IDS.ga, READY)).toContain(SEAT_GA_NOTE);
    expect(detailHtml(FIXTURE_IDS.resale, READY)).toContain(COMMERCE_COMMAND_BINDINGS.listResale.reason);
    expect(detailHtml(FIXTURE_IDS.resale, READY)).toContain('data-source="none"');

    const absent = detailHtml(FIXTURE_IDS.lanterns, { kind: "ready", performances: [] });
    expect(absent).not.toContain('href="/booking/');
    expect(absent).toContain("No supported purchase path on this row.");

    const http = buildDiscoveryModel({
      environment: "integration-http",
      catalog: { kind: "not-bound", reason: COMMERCE_COMMAND_BINDINGS.listPerformances.reason },
      query: DEFAULT_DISCOVERY_QUERY,
      rowId: FIXTURE_IDS.lanterns,
    });
    const httpHtml = renderDetail(http);
    expect(httpHtml).toContain(COMMERCE_COMMAND_BINDINGS.listPerformances.reason);
    expect(httpHtml).toContain('data-source="none"');
    expect(httpHtml).toContain('data-purchase="not-bound"');
    expect(httpHtml).not.toContain('href="/booking/');
    expect(httpHtml).toContain("SYNTHETIC");
    expect(httpHtml).not.toMatch(BANNED);
  });

  it("reads the catalogue once and does not switch to another adapter", async () => {
    let reads = 0;
    const notBound = await loadDiscoveryOnce({
      async listPerformances() {
        reads += 1;
        throw new Error("listPerformances is not-bound. catalogue has no list.");
      },
    });
    expect(reads).toBe(1);
    expect(notBound).toEqual({
      kind: "not-bound",
      reason: COMMERCE_COMMAND_BINDINGS.listPerformances.reason,
    });

    let readyReads = 0;
    const ready = await loadDiscoveryOnce({
      async listPerformances() {
        readyReads += 1;
        return PERFORMANCES;
      },
    });
    expect(readyReads).toBe(1);
    expect(ready).toEqual(READY);
  });

  it("mounts the discovery routes from the shell", () => {
    const list = renderAt("/discovery");
    expect(list).toContain(">Discover<");
    expect(list).toContain("SYNTHETIC");
    expect(list).toContain(WORKSPACE_RULING);
    expect(list).toContain("Loading performances.");
    expect(list).toContain('data-catalog="loading"');
    expect(list).not.toContain('href="/booking/');
    expect(list).not.toMatch(BANNED);

    const conflict = renderAt("/discovery?kinds=ga&section=A");
    expect(conflict).toContain('data-state="filter-conflict"');
    expect(conflict).toContain("Clear conflict");

    const detail = renderAt("/discovery/syn-event-lanterns?q=lanterns");
    expect(detail).toContain("Lanterns synthetic show");
    expect(detail).toContain("Loading performances.");
    expect(detail).not.toContain('href="/booking/');
    expect(detail).toContain('href="/discovery?q=lanterns"');
    expect(detail).toContain("SYNTHETIC");

    const missing = renderAt("/discovery/not-a-row");
    expect(missing).toContain("No synthetic row for this id.");
    expect(missing).toContain("SYNTHETIC");
  });

  it("keeps discovery sources off posts and off banned literals", () => {
    const files = [
      "src/discovery/fixture.ts",
      "src/discovery/model.ts",
      "src/discovery-workspace.ts",
      "src/pages/Discovery.tsx",
      "src/pages/DiscoveryPanels.tsx",
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
      "fallback",
      "Date.now(",
      "Math.random(",
      "placeHold",
    ]) {
      expect(combined, token).not.toContain(token);
    }
    const css = readFileSync(path.join(webRoot, "src/styles.css"), "utf8");
    expect(css).toContain(".discovery-nav");
    expect(css).toContain(".discovery-scale");
    expect(css).toContain("focus-visible");
    expect(css).toContain("44px");
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*\.discovery-nav[\s\S]*position:\s*sticky/);
    expect(css).not.toContain("@keyframes");
    expect(css).not.toMatch(/animation\s*:/);
  });
});

function modelFor(query: DiscoveryQuery, catalog: CatalogState, rowId: string | null = null): DiscoveryModel {
  return buildDiscoveryModel({ environment: "stub", catalog, query, rowId });
}

function renderScreen(model: DiscoveryModel): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <DiscoveryScreen
        model={model}
        query={model.result.state === "filter-conflict" ? conflictQuery(model) : queryOf(model)}
        onQuery={() => undefined}
        onOpen={() => undefined}
        onReadAgain={() => undefined}
      />
    </MemoryRouter>,
  );
}

function queryOf(model: DiscoveryModel): DiscoveryQuery {
  if (model.result.totalMatching === 0 && model.result.state === "empty") {
    return { ...DEFAULT_DISCOVERY_QUERY, text: "zzzz-no-such-row" };
  }
  if (model.result.rows.length > 20) {
    return { ...DEFAULT_DISCOVERY_QUERY, pageSize: 50 };
  }
  return DEFAULT_DISCOVERY_QUERY;
}

function conflictQuery(model: DiscoveryModel): DiscoveryQuery {
  if (model.result.conflicts.some((conflict) => conflict.code === "ga-section")) {
    return { ...DEFAULT_DISCOVERY_QUERY, kinds: ["ga"], section: "A" };
  }
  return DEFAULT_DISCOVERY_QUERY;
}

function detailHtml(rowId: string, catalog: CatalogState): string {
  return renderDetail(modelFor(DEFAULT_DISCOVERY_QUERY, catalog, rowId));
}

function renderDetail(model: DiscoveryModel, search = ""): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <DiscoveryDetail model={model} onReadAgain={() => undefined} backSearch={search} />
    </MemoryRouter>,
  );
}

function renderAt(pathname: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[pathname]}>
      <App />
    </MemoryRouter>,
  );
}

function liCount(html: string): number {
  return html.match(/<li\b/g)?.length ?? 0;
}

function sliceKind(html: string, kind: string): string {
  const match = new RegExp(`<li\\b[^>]*data-kind="${kind}"[\\s\\S]*?</li>`).exec(html);
  expect(match, kind).not.toBeNull();
  return match?.[0] ?? "";
}
