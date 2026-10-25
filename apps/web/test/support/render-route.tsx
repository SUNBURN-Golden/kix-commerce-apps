import { transferableAbortController } from "node:util";
import { vi } from "vitest";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { renderDom } from "./render-dom";

export async function renderRoute(node: ReactNode, entry = "/") {
  // Match Node Request's AbortSignal realm; jsdom owns the DOM, not the data router transport.
  vi.stubGlobal("AbortController", transferableAbortController().constructor);
  const router = createMemoryRouter([{ path: "*", element: node }], { initialEntries: [entry] });
  const view = await renderDom(<RouterProvider router={router} />);
  return { ...view, router };
}
