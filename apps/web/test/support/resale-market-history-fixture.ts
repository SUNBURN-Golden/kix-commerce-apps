import type { ResaleMarketController } from "../../../../packages/protocol-adapter/src/resale-market-controller";

type Detail = NonNullable<ReturnType<ResaleMarketController["detail"]>>;
/** Deterministic test data only; retain the accepted detail's claims, quotes and schema. */
export function marketHistoryFixture(detail: Detail, count = 1001, wideCount = 51, generation = 0) {
  const productId = detail.product.productId;
  const variants = detail.product.variantIds.flatMap(variantId => Array.from({ length: variantId === "standard" ? count : wideCount }, (_, i) => ({ variantId, i })));
  return {
    ...detail,
    product: { ...detail.product, variantIds: [...detail.product.variantIds] },
    quotes: detail.quotes.map(q => ({ ...q })),
    series: detail.series.map(p => ({ ...p })),
    offers: variants.map(({ variantId, i }) => ({ offerId: `offer-${generation}-${variantId}-${i}`, productId, variantId, side: i % 2 ? "ask" as const : "bid" as const, mockUnits: String(900719925474099312345n + BigInt(i)), state: "open" as const })),
    trades: variants.map(({ variantId, i }) => ({ tradeId: `trade-${generation}-${variantId}-${i}`, productId, variantId, mockUnits: String(900719925474099312345n + BigInt(i)), occurredAt: `2026-11-01T12:${String(Math.floor(i / 60) % 60).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}Z`, state: "simulated" as const })),
  };
}
