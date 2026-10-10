import { describe, expect, it } from "vitest";
import {
  DISCOVERY_FIXTURE,
  FIXTURE_IDS,
  FIXTURE_LENGTH,
  FIXTURE_NOW,
  SCALE_OVERSCAN,
  SCALE_ROW_HEIGHT,
  SCALE_TOTAL,
  SCALE_VIEWPORT_HEIGHT,
  STALE_AFTER_MS,
  STALE_PRICE_AS_OF,
  STUB_EVENT_IDS,
  scaleRowAt,
  type DiscoveryRow,
} from "../src/discovery/fixture";
import {
  DEFAULT_DISCOVERY_QUERY,
  applyConflictClear,
  applyPageKey,
  applyScaleKey,
  describeRow,
  detectConflicts,
  findDiscoveryRow,
  isPriceStale,
  moveListFocus,
  paramsFromQuery,
  queryFromParams,
  runDiscoveryQuery,
  scaleWindow,
  windowRange,
  type DiscoveryQuery,
} from "../src/discovery/model";

const BANNED = /[$₩]|KRW|USD|still open|in stock/i;

describe("discovery model", () => {
  it("keeps the materialized sample small and the scale total count-only", () => {
    expect(DISCOVERY_FIXTURE.length).toBe(FIXTURE_LENGTH);
    expect(DISCOVERY_FIXTURE.length).toBeLessThanOrEqual(400);
    expect(SCALE_TOTAL).toBe(1_000_000);
    expect(new Set(DISCOVERY_FIXTURE.map((row) => row.rowId)).size).toBe(DISCOVERY_FIXTURE.length);
    for (const row of DISCOVERY_FIXTURE) {
      expect(row.provenance).toBe("synthetic");
      expect(JSON.stringify(describeRow(row))).not.toMatch(BANNED);
      if (row.kind === "event") {
        expect(row.inventoryMode).toBe("none");
        expect(row.section).toBeNull();
        expect(row.syntheticCount).toBeNull();
        expect(row.resale).toBeNull();
      }
      if (row.kind === "seat") {
        expect(row.inventoryMode).toBe("seat");
        expect(row.section).not.toBeNull();
        expect(row.resale).toBeNull();
      }
      if (row.kind === "ga") {
        expect(row.inventoryMode).toBe("ga");
        expect(row.section).toBeNull();
      }
      if (row.kind === "resale") {
        expect(row.resale?.listingLabel).toBe("listing (synthetic)");
      }
      if (row.kind !== "event") {
        expect(row.stubEventId).toBeNull();
      }
    }
    const linked = DISCOVERY_FIXTURE.filter((row) => row.stubEventId !== null);
    expect(linked.length).toBeGreaterThan(0);
    for (const row of linked) {
      expect(row.kind).toBe("event");
      expect(STUB_EVENT_IDS).toContain(row.stubEventId);
    }
  });

  it("builds scale rows one index at a time", () => {
    const first = scaleRowAt(0);
    const last = scaleRowAt(SCALE_TOTAL - 1);
    expect(first.rowId).toBe("scale-0");
    expect(last.rowId).toBe(`scale-${SCALE_TOTAL - 1}`);
    expect(first.stubEventId).toBeNull();
    expect(last.stubEventId).toBeNull();
    expect(first.provenance).toBe("synthetic");
    expect(scaleRowAt(12345)).toEqual(scaleRowAt(12345));
    expect(findDiscoveryRow("scale-3")?.rowId).toBe("scale-3");
    expect(findDiscoveryRow("scale-1000000")).toBeNull();
    expect(findDiscoveryRow("scale-01")).toBeNull();
    expect(findDiscoveryRow("missing")).toBeNull();
    expect(findDiscoveryRow(FIXTURE_IDS.lanterns)?.stubEventId).toBe("evt_lanterns");
  });

  it("marks a tier stale only after the fixed span", () => {
    expect(isPriceStale(STALE_PRICE_AS_OF)).toBe(true);
    expect(isPriceStale(FIXTURE_NOW)).toBe(false);
    const boundary = new Date(Date.parse(FIXTURE_NOW) - STALE_AFTER_MS).toISOString();
    const justPast = new Date(Date.parse(FIXTURE_NOW) - STALE_AFTER_MS - 1).toISOString();
    expect(isPriceStale(boundary)).toBe(false);
    expect(isPriceStale(justPast)).toBe(true);
    expect(describeRow(findDiscoveryRow(FIXTURE_IDS.stale)!).stale).toBe(true);
    expect(describeRow(findDiscoveryRow(FIXTURE_IDS.lanterns)!).stale).toBe(false);
  });

  it("describes event, seat, GA, and resale as different facts", () => {
    const event = describeRow(findDiscoveryRow(FIXTURE_IDS.lanterns)!);
    const seat = describeRow(findDiscoveryRow(FIXTURE_IDS.seat)!);
    const ga = describeRow(findDiscoveryRow(FIXTURE_IDS.ga)!);
    const resale = describeRow(findDiscoveryRow(FIXTURE_IDS.resale)!);
    expect(event.inventoryLine).toBeNull();
    expect(event.countLine).toBeNull();
    expect(event.kindLine).toBe("kind event");
    expect(seat.inventoryLine).toBe("section A");
    expect(seat.countLine).toBe("synthetic count 4");
    expect(ga.inventoryLine).toBe("no seat assigned");
    expect(ga.countLine).toBe("synthetic count 80");
    expect(resale.resaleLine).toBe("listing (synthetic)");
    expect(resale.tierLine).toBe("synthetic tier T3");
    expect(describeRow(findDiscoveryRow(FIXTURE_IDS.cancelled)!).statusLine).toBe("cancelled (synthetic)");
  });

  it("filters, sorts, and pages without running a conflicting query", () => {
    const alpha = sample({ rowId: "a", title: "Alpha", syntheticTier: "T3", startsAt: "2026-10-12T00:00:00.000Z" });
    const beta = sample({
      rowId: "b",
      title: "Beta",
      kind: "seat",
      inventoryMode: "seat",
      section: "A",
      syntheticCount: 2,
      syntheticTier: "T2",
      startsAt: "2026-10-10T00:00:00.000Z",
    });
    const gamma = sample({
      rowId: "c",
      title: "Gamma",
      syntheticTier: null,
      startsAt: "2026-10-11T00:00:00.000Z",
      status: "cancelled",
    });
    const rows = [alpha, beta, gamma];

    expect(runDiscoveryQuery({ ...DEFAULT_DISCOVERY_QUERY, sort: "date-asc" }, rows).rows.map((row) => row.rowId)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(runDiscoveryQuery({ ...DEFAULT_DISCOVERY_QUERY, sort: "title" }, rows).rows.map((row) => row.rowId)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(runDiscoveryQuery({ ...DEFAULT_DISCOVERY_QUERY, sort: "tier-asc" }, rows).rows.map((row) => row.rowId)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(runDiscoveryQuery({ ...DEFAULT_DISCOVERY_QUERY, sort: "tier-desc" }, rows).rows.map((row) => row.rowId)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(runDiscoveryQuery({ ...DEFAULT_DISCOVERY_QUERY, kinds: ["seat"] }, rows).rows.map((row) => row.rowId)).toEqual(["b"]);
    expect(runDiscoveryQuery({ ...DEFAULT_DISCOVERY_QUERY, text: "ALPHA" }, rows).rows.map((row) => row.rowId)).toEqual(["a"]);
    expect(
      runDiscoveryQuery({ ...DEFAULT_DISCOVERY_QUERY, purchasableOnly: true }, rows).rows.map((row) => row.rowId),
    ).toEqual(["b", "a"]);
    expect(runDiscoveryQuery({ ...DEFAULT_DISCOVERY_QUERY, section: "A" }, rows).rows.map((row) => row.rowId)).toEqual(["b"]);
    expect(
      runDiscoveryQuery({ ...DEFAULT_DISCOVERY_QUERY, from: "2026-10-11", to: "2026-10-12" }, rows).rows.map(
        (row) => row.rowId,
      ),
    ).toEqual(["c", "a"]);

    const page = runDiscoveryQuery({ ...DEFAULT_DISCOVERY_QUERY, pageSize: 10, page: 2 });
    const first = runDiscoveryQuery({ ...DEFAULT_DISCOVERY_QUERY, pageSize: 10, page: 1 });
    expect(first.rows.length).toBeLessThanOrEqual(10);
    expect(page.rows.length).toBeLessThanOrEqual(10);
    expect(first.rows.map((row) => row.rowId)).not.toEqual(page.rows.map((row) => row.rowId));
    expect(first.totalMatching).toBe(DISCOVERY_FIXTURE.length);
    expect(page.totalMatching).toBe(first.totalMatching);
    expect(page.ofFixtureRows).toBe(DISCOVERY_FIXTURE.length);
    expect(runDiscoveryQuery(DEFAULT_DISCOVERY_QUERY)).toEqual(runDiscoveryQuery(DEFAULT_DISCOVERY_QUERY));
  });

  it("keeps an empty result apart from a filter conflict", () => {
    const empty = runDiscoveryQuery({ ...DEFAULT_DISCOVERY_QUERY, text: "zzzz-no-such-row" });
    expect(empty.state).toBe("empty");
    expect(empty.conflicts).toEqual([]);
    expect(empty.rows).toEqual([]);

    const weird = sample({ kind: "ga", inventoryMode: "ga", section: "A", syntheticCount: 3 });
    const gaSection = runDiscoveryQuery({ ...DEFAULT_DISCOVERY_QUERY, kinds: ["ga"], section: "A" }, [weird]);
    expect(gaSection.state).toBe("filter-conflict");
    expect(gaSection.totalMatching).toBe(0);
    expect(gaSection.rows).toEqual([]);
    expect(gaSection.conflicts.map((conflict) => conflict.code)).toEqual(["ga-section"]);

    const cancelled = runDiscoveryQuery(
      { ...DEFAULT_DISCOVERY_QUERY, statuses: ["cancelled"], purchasableOnly: true },
      [sample({ status: "cancelled" })],
    );
    expect(cancelled.state).toBe("filter-conflict");
    expect(cancelled.conflicts.map((conflict) => conflict.code)).toEqual(["cancelled-purchasable"]);

    const dates = runDiscoveryQuery(
      { ...DEFAULT_DISCOVERY_QUERY, from: "2026-12-01", to: "2026-01-01" },
      [sample()],
    );
    expect(dates.state).toBe("filter-conflict");
    expect(dates.conflicts.map((conflict) => conflict.code)).toContain("from-after-to");

    const stacked = detectConflicts({
      ...DEFAULT_DISCOVERY_QUERY,
      kinds: ["ga"],
      section: "A",
      statuses: ["cancelled"],
      purchasableOnly: true,
      from: "2026-12-01",
      to: "2026-01-01",
    });
    expect(stacked.map((conflict) => conflict.code)).toEqual(["ga-section", "cancelled-purchasable", "from-after-to"]);
    expect(detectConflicts({ ...DEFAULT_DISCOVERY_QUERY, kinds: ["ga", "seat"], section: "A" })).toEqual([]);
    expect(detectConflicts({ ...DEFAULT_DISCOVERY_QUERY, statuses: ["cancelled", "on-sale"], purchasableOnly: true })).toEqual(
      [],
    );

    const cleared = applyConflictClear({ ...DEFAULT_DISCOVERY_QUERY, kinds: ["ga"], section: "A" }, "ga-section");
    expect(cleared.section).toBe("");
    expect(detectConflicts(cleared)).toEqual([]);
    expect(runDiscoveryQuery(cleared, [weird]).state).toBe("ready");
  });

  it("mounts only the scale window", () => {
    const visible = Math.ceil(SCALE_VIEWPORT_HEIGHT / SCALE_ROW_HEIGHT);
    let calls = 0;
    const viewed = scaleWindow({
      scrollTop: 0,
      rowAt(index) {
        calls += 1;
        return scaleRowAt(index);
      },
    });
    expect(calls).toBeLessThanOrEqual(visible + SCALE_OVERSCAN);
    expect(viewed.rows).toHaveLength(calls);
    expect(viewed.rows.length).toBeLessThanOrEqual(60);
    expect(viewed.end - viewed.start).toBeLessThanOrEqual(visible + SCALE_OVERSCAN);

    const end = applyScaleKey({ scrollTop: 0, focus: 0 }, "End");
    expect(end.focus).toBe(SCALE_TOTAL - 1);
    expect(end.open).toBe(false);
    let tailCalls = 0;
    const tail = scaleWindow({
      scrollTop: end.scrollTop,
      rowAt(index) {
        tailCalls += 1;
        return scaleRowAt(index);
      },
    });
    expect(tailCalls).toBeLessThanOrEqual(visible + SCALE_OVERSCAN);
    expect(tail.end).toBe(SCALE_TOTAL);
    expect(tail.rows).toHaveLength(tailCalls);

    const opened = windowRange({ total: 100, rowHeight: 48, viewportHeight: 192, scrollTop: 0, overscan: 4 });
    expect(opened).toEqual({ start: 0, end: 8 });
    expect(opened.end - opened.start).toBeLessThanOrEqual(4 + 4);
    expect(windowRange({ total: 0, rowHeight: 48, viewportHeight: 192, scrollTop: 0, overscan: 4 })).toEqual({
      start: 0,
      end: 0,
    });
  });

  it("moves list focus by arrow, home, end, and page keys", () => {
    expect(moveListFocus(0, "ArrowDown", 20, 10)).toBe(1);
    expect(moveListFocus(0, "ArrowUp", 20, 10)).toBe(0);
    expect(moveListFocus(3, "Home", 20, 10)).toBe(0);
    expect(moveListFocus(3, "End", 20, 10)).toBe(19);
    expect(moveListFocus(0, "PageDown", 20, 10)).toBe(10);
    expect(moveListFocus(15, "PageUp", 20, 10)).toBe(5);
    expect(applyPageKey(0, "PageDown", 20)).toEqual({ index: 10, open: false });
    expect(applyPageKey(0, "End", 20)).toEqual({ index: 19, open: false });
    expect(applyPageKey(4, "Enter", 20)).toEqual({ index: 4, open: true });
    expect(applyPageKey(0, "Tab", 20)).toEqual({ index: 0, open: false });
    expect(applyScaleKey({ scrollTop: 0, focus: 0 }, "ArrowDown").focus).toBe(1);
    expect(applyScaleKey({ scrollTop: 400, focus: 9 }, "Home")).toEqual({ scrollTop: 0, focus: 0, open: false });
    expect(applyScaleKey({ scrollTop: 0, focus: 2 }, "Enter").open).toBe(true);
    const paged = applyScaleKey({ scrollTop: 0, focus: 0 }, "PageDown");
    expect(paged.scrollTop).toBeGreaterThan(0);
    expect(paged.focus).toBeGreaterThan(0);
  });

  it("round-trips the query through search params", () => {
    const query: DiscoveryQuery = {
      ...DEFAULT_DISCOVERY_QUERY,
      text: "lantern",
      kinds: ["event", "seat"],
      statuses: ["on-sale"],
      tiers: ["T2"],
      section: "A",
      from: "2026-10-01",
      to: "2026-10-31",
      purchasableOnly: true,
      sort: "title",
      page: 2,
      pageSize: 50,
    };
    expect(queryFromParams(paramsFromQuery(query))).toEqual(query);
    expect(queryFromParams(paramsFromQuery(DEFAULT_DISCOVERY_QUERY))).toEqual(DEFAULT_DISCOVERY_QUERY);
    const unknown = queryFromParams(new URLSearchParams("sort=nope&pageSize=15&page=0"));
    expect(unknown.sort).toBe("date-asc");
    expect(unknown.pageSize).toBe(20);
    expect(unknown.page).toBe(1);
  });
});

function sample(patch: Partial<DiscoveryRow> = {}): DiscoveryRow {
  return {
    rowId: "row-a",
    kind: "event",
    title: "Alpha",
    venueLabel: "Hall",
    startsAt: "2026-10-20T00:00:00.000Z",
    status: "on-sale",
    inventoryMode: "none",
    section: null,
    syntheticCount: null,
    syntheticTier: "T1",
    priceAsOf: FIXTURE_NOW,
    resale: null,
    stubEventId: null,
    provenance: "synthetic",
    ...patch,
  };
}
