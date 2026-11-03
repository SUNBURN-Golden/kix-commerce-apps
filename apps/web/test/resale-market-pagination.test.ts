import { describe, expect, it } from "vitest";
import { buildMarketHistoryPage, MARKET_HISTORY_PAGE_SIZE } from "../src/resale-market-pagination";
import { createMockResaleMarket, validMarketDetail } from "../../../packages/protocol-adapter/src/resale-market";
import { ResaleMarketController } from "../../../packages/protocol-adapter/src/resale-market-controller";
import { marketHistoryFixture } from "./support/resale-market-history-fixture";

describe("market history presentation projection", () => {
  it.each([0, 1, 49, 50, 51, 1000, 1001])("projects %i immutable records completely in source order", count => {
    const records = Object.freeze(Array.from({ length: count }, (_, i) => Object.freeze({ id: i, mockUnits: String(900719925474099312345n + BigInt(i)) })));
    const before = JSON.stringify(records);
    const seen = [];
    for (let page = 1; page <= Math.max(1, Math.ceil(count / 50)); page++) {
      const projection = buildMarketHistoryPage(records, page);
      expect(projection.rows.length).toBeLessThanOrEqual(MARKET_HISTORY_PAGE_SIZE);
      expect(projection).toMatchObject({ totalCount: count, pageCount: Math.ceil(count / 50), page: count ? page : 0, start: count ? (page - 1) * 50 + 1 : 0, end: Math.min(page * 50, count) });
      projection.rows.forEach(row => expect(row).toBe(records[row.id]));
      seen.push(...projection.rows);
    }
    expect(seen).toEqual(records);
    expect(new Set(seen).size).toBe(count);
    expect(JSON.stringify(records)).toBe(before);
    expect(buildMarketHistoryPage(records, 9999).end).toBe(count);
  });
  it.each([NaN, Infinity, -Infinity, -1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1])("normalizes invalid page %s to the first page", page => {
    expect(buildMarketHistoryPage(Array.from({ length: 1001 }), page).page).toBe(1);
    expect(buildMarketHistoryPage([], page)).toMatchObject({ rows: [], page: 0, pageCount: 0, start: 0, end: 0 });
  });
  it("builds valid large fixtures without changing original claims or exact digits", async () => {
    const c = new ResaleMarketController(createMockResaleMarket()); await c.read({ kind: "detail", productId: "demo-001" });
    const original = c.detail()!;
    const before = JSON.stringify(original);
    const fixture = marketHistoryFixture(original);
    expect(validMarketDetail(fixture)).toBe(true);
    expect(fixture.offers.filter(x => x.variantId === "standard")).toHaveLength(1001);
    expect(fixture.trades.filter(x => x.variantId === "standard")).toHaveLength(1001);
    expect(fixture.offers[0]?.mockUnits).toBe("900719925474099312345");
    expect(JSON.stringify(original)).toBe(before);
  });
});
