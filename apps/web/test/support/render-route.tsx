import { createMarketReturnMemory, MarketReturnContext } from "../../src/resale-market-return-focus";
import { transferableAbortController } from "node:util";
import { vi } from "vitest";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { renderDom } from "./render-dom";

export async function renderRoute(node: ReactNode, entry = "/") {
  // Match Node Request's AbortSignal realm; jsdom owns the DOM, not the data router transport.
  vi.stubGlobal("AbortController", transferableAbortController().constructor);
  const memory = createMarketReturnMemory();
  const router = createMemoryRouter([{ path: "*", element: <MarketReturnContext.Provider value={memory}>{node}</MarketReturnContext.Provider> }], { initialEntries: [entry] });
  const unsubscribe = router.subscribe(state => memory.depart(state.location.pathname));
  const view = await renderDom(<RouterProvider router={router} />);
  return { ...view, router, async unmount() { unsubscribe(); await view.unmount(); } };
}
