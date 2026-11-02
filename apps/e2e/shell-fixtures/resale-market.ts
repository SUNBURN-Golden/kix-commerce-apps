/** Test-build substitution only. No fault hook enters the production bundle. */
import { createMockResaleMarket, MARKET_CLAIMS, resaleMarketPortFor as original, type ResaleMarketPort } from "../../../packages/protocol-adapter/src/../src/resale-market";
export * from "../../../packages/protocol-adapter/src/../src/resale-market";
declare global { interface Window { __kixResaleFault?: { mode: "reject" | "lost" | "held" | "wrong-side"; dispatches: number; release?: () => void } } }
export function resaleMarketPortFor(environment: "stub" | "integration-http"): ResaleMarketPort {
  if (environment !== "stub") return original(environment);
  const source = createMockResaleMarket();
  return { read: source.read, async submit(input) {
    const fault = window.__kixResaleFault;
    if (!fault) return source.submit(input);
    fault.dispatches++;
    if (fault.mode === "reject") return { ...MARKET_CLAIMS, kind: "REJECTED", request: input, code: "STALE_VERSION" };
    if (fault.mode === "wrong-side") return source.submit({ ...input, kind: "instant-buy", quoteId: `${input.productId}-${input.variantId}-bid` });
    const result = await source.submit(input);
    if (fault.mode === "lost") throw new Error("fixture effect followed by lost answer");
    await new Promise<void>(resolve => { fault.release = resolve; });
    return result;
  } };
}
