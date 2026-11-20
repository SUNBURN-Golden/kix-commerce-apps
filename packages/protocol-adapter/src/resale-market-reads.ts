// Vector query names are producer identifiers. The other labels describe app needs only.
export const MARKET_READS = ["list_open_listings", "product search", "get_listing", "product detail", "variants",
  "quotes", "offers", "trade history", "price series", "get_right", "get_presentation", "get_settlement", "operation recovery"] as const;
export type MarketQuery = (typeof MARKET_READS)[number];
export function resaleRead(query: MarketQuery) {
  return { kind: "NOT_BOUND", query, reason: "No read endpoint at the pinned gate." } as const;
}
