/** Test-build substitution only. No fault hook enters the production bundle. */
import type {} from "../src/resale-fault-types";
import { marketHistoryFixture } from "../../web/test/support/resale-market-history-fixture";
import { createMockResaleMarket, MARKET_CLAIMS, resaleMarketPortFor as original, type ResaleMarketPort } from "../../../packages/protocol-adapter/src/../src/resale-market";
export * from "../../../packages/protocol-adapter/src/../src/resale-market";
export function resaleMarketPortFor(environment: "stub" | "integration-http"): ResaleMarketPort {
  if (environment !== "stub") return original(environment);
  const source = createMockResaleMarket();
  return { async read(input) {
    const fault = window.__kixResaleFault;
    if (fault) fault.reads = (fault.reads ?? 0) + 1;
    if (input.kind === "list") {
      if (fault?.list?.mode === "held") await new Promise<void>(resolve => { fault.releaseRead = resolve; });
      if (fault?.list?.mode === "error") throw new Error("fixture list error");
      if (fault?.list?.mode === "not-bound") return { ...MARKET_CLAIMS, kind: "NOT_BOUND" };
    }
    const result = await source.read(input);
    if (fault?.missingProduct && result.kind !== "NOT_BOUND" && result.payload.kind === "detail") {
      result.payload.detail = null; result.kind = "empty";
    }
    if (fault?.list && result.kind !== "NOT_BOUND" && result.payload.kind === "list") {
      if (fault.list.productIds) {
        const products = [];
        for (const productId of fault.list.productIds) {
          const detail = await source.read({ kind: "detail", productId });
          if (detail.kind !== "NOT_BOUND" && detail.payload.kind === "detail" && detail.payload.detail) products.push(detail.payload.detail.product);
        }
        result.payload.products = products;
        result.kind = products.length ? "ready" : "empty";
      }
      if (fault.list.total !== undefined) result.payload.total = fault.list.total;
    }
    if (fault?.history && result.kind !== "NOT_BOUND" && result.payload.kind === "detail" && result.payload.detail) {
      const { count, wideCount, generation, reverse } = fault.history;
      result.payload.detail = marketHistoryFixture(result.payload.detail, count, wideCount, generation);
      if (reverse) { result.payload.detail.offers.reverse(); result.payload.detail.trades.reverse(); }
    }
    return result;
  }, async submit(input) {
    const fault = window.__kixResaleFault;
    if (!fault) return source.submit(input);
    fault.dispatches++;
    (fault.requests ??= []).push(structuredClone(input));
    if (fault.mode === "reject") return { ...MARKET_CLAIMS, kind: "REJECTED", request: input, code: "STALE_VERSION" };
    if (fault.mode === "wrong-side") return source.submit({ ...input, kind: "instant-buy", quoteId: `${input.productId}-${input.variantId}-bid` });
    const result = await source.submit(input);
    (fault.results ??= []).push(structuredClone(result));
    if (fault.mode === "normal") return result;
    if (fault.mode === "lost") throw new Error("fixture effect followed by lost answer");
    await new Promise<void>(resolve => { fault.release = resolve; });
    return result;
  } };
}
