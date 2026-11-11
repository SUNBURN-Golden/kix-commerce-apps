// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Link, Route, Routes } from "react-router-dom";
import { createMarketReturnMemory, MARKET_RETURN_MEMORY_LIMIT, type MarketReturnEntry } from "../src/resale-market-return-focus";
import { ResaleMarketPage, ResaleProductPage } from "../src/pages/ResaleMarketPages";
import { marketController } from "../src/resale-market";
import { createMockResaleMarket, MARKET_CLAIMS, type ResaleMarketPort } from "../../../packages/protocol-adapter/src/resale-market";
import { renderRoute } from "./support/render-route";
import { click, dispatch, element } from "./support/render-dom";

const list = { visitKey: "list", search: "?lang=en&q=object&page=2", query: "object", page: 2, lang: "en" as const };
const product = { ...list, visitKey: "product", productId: "demo-003" };
const record = (listVisitKey = "list"): MarketReturnEntry => ({ ...list, listVisitKey, productVisitKey: null, productId: "demo-003", scrollX: 0, scrollY: 123, cardTop: 40, viewportWidth: 1024, viewportHeight: 768 });
function opened(memory = createMarketReturnMemory()) {
  memory.visit(list, "POP"); memory.remember(record()); memory.visit(product, "PUSH");
  return memory;
}
describe("bounded presentation memory", () => {
  it("evicts the 17th oldest visit, replaces without growing, and isolates instances", () => {
    const memory = createMarketReturnMemory();
    memory.visit(list, "POP"); memory.remember(record()); memory.visit(product, "PUSH");
    for (let i = 1; i < MARKET_RETURN_MEMORY_LIMIT; i++) memory.remember(record(String(i)));
    memory.remember(record("1")); expect(memory.size).toBe(16);
    memory.remember(record("17")); expect(memory.size).toBe(16);
    memory.visit(list, "POP"); expect(memory.pending).toBeNull();
    expect(createMarketReturnMemory().size).toBe(0);
  });
  it("restores only the exact POP departure and consumes it once", () => {
    const memory = opened(); memory.visit(list, "POP");
    expect(memory.pending?.entry.scrollY).toBe(123);
    memory.cancel(); memory.visit(product, "POP"); memory.visit(list, "POP");
    expect(memory.pending).toBeNull();
  });
  it("retains the origin across lazy-screen cleanup and delayed destination mount", async () => {
    const memory = createMarketReturnMemory(); memory.visit(list, "POP"); memory.remember(record());
    memory.leave(list.visitKey); await Promise.resolve(); memory.visit(product, "PUSH");
    memory.leave(product.visitKey); await Promise.resolve(); memory.visit(list, "POP");
    expect(memory.pending?.entry.productId).toBe("demo-003");
  });
  it.each(["PUSH", "REPLACE"])("does not infer a return from an unrelated %s", navigation => {
    const memory = opened(); memory.visit(list, navigation); expect(memory.pending).toBeNull();
  });
  it("requires explicit return arming and supports a fresh list key", () => {
    const memory = opened(); memory.armReturn(product.visitKey); memory.visit({ ...list, visitKey: "new-list" }, "PUSH");
    expect(memory.pending?.visitKey).toBe("new-list");
    memory.cancel(); memory.visit(product, "POP"); memory.visit({ ...list, visitKey: "new-list" }, "POP"); expect(memory.pending).toBeNull();
  });
  it("cannot borrow a card between two list entries with identical contexts", () => {
    const memory = opened(); memory.visit({ ...list, visitKey: "other-list" }, "POP"); expect(memory.pending).toBeNull();
  });
  it.each([{ query: "changed" }, { page: 1 }, { lang: "ko" as const }])("invalidates context changes %j", patch => {
    const memory = opened(); memory.visit({ ...product, ...patch, visitKey: "changed" }, "PUSH");
    memory.armReturn("changed"); memory.visit(list, "PUSH"); expect(memory.pending).toBeNull();
  });
  it("ignores initial POP, unassociated products and delayed unrelated departures", async () => {
    const memory = createMarketReturnMemory(); memory.visit(list, "POP"); expect(memory.pending).toBeNull();
    memory.visit(product, "PUSH"); memory.armReturn(product.visitKey); memory.visit(list, "PUSH"); expect(memory.pending).toBeNull();
    const other = opened(); other.depart("/other"); await Promise.resolve(); other.visit(list, "POP"); expect(other.pending).toBeNull();
  });
  it("survives StrictMode cleanup/setup but cancels actual unmount", async () => {
    const memory = opened(); memory.leave(product.visitKey); memory.visit(product, "PUSH"); await Promise.resolve();
    memory.visit(list, "POP"); expect(memory.pending).not.toBeNull();
    memory.leave(list.visitKey); await Promise.resolve(); expect(memory.pending).toBeNull();
  });
});

const screens = <StrictMode><Routes><Route path="/resale/market" element={<ResaleMarketPage />} /><Route path="/resale/market/:productId" element={<ResaleProductPage />} /><Route path="/other" element={<Link to="/resale/market?lang=en&q=object&page=2">Other market navigation</Link>} /></Routes></StrictMode>;
async function setup() {
  let frameId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { frames.set(++frameId, fn); return frameId; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const send = vi.spyOn(marketController, "submit");
  const view = await renderRoute(screens, "/resale/market?lang=en&q=object&page=2");
  const flush = async () => { await act(async () => { const work = [...frames.values()]; frames.clear(); work.forEach(fn => fn(0)); }); };
  const open = async () => click(element(view.container, "[data-market-product-id='demo-003']"));
  return { ...view, flush, scroll, send, open, frames };
}
function portOverride(read: ResaleMarketPort["read"]) {
  const controller = marketController as unknown as { port: ResaleMarketPort };
  const original = controller.port;
  controller.port = { ...original, read };
  return () => { controller.port = original; };
}
describe("committed marketplace restoration", () => {
  it.each(["back", "return"])("focuses the exact card after %s, once, with no writes", async mode => {
    const view = await setup(); await view.open();
    if (mode === "back") await act(async () => view.router.navigate(-1));
    else await click(element(view.container, "[data-market-return]"));
    const heading = element(view.container, "#market-results-heading");
    await act(async () => heading.focus()); // shell fallback must not cancel the card
    await dispatch(document, new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
    await dispatch(document, new Event("pointerup", { bubbles: true }));
    await view.flush();
    expect(document.activeElement).toBe(element(view.container, "[data-market-product-id='demo-003']"));
    expect(view.scroll).toHaveBeenCalledOnce(); expect(view.send).not.toHaveBeenCalled();
    await act(async () => marketController.read({ kind: "list", query: "object", page: 2 })); await view.flush(); expect(view.scroll).toHaveBeenCalledOnce();
    await view.unmount();
  });
  it.each(["keydown", "pointerdown", "touchstart", "wheel", "focus"])("cancels restoration on later %s", async kind => {
    const view = await setup(); await view.open(); await act(async () => view.router.navigate(-1));
    if (kind === "focus") await act(async () => element(view.container, "#market-search").focus());
    else await dispatch(document, new Event(kind, { bubbles: true }));
    expect(view.frames.size).toBe(0);
    await view.flush(); expect(view.scroll).not.toHaveBeenCalled();
  });
  it("does not remember modified or prevented activations", async () => {
    const view = await setup();
    const card = element(view.container, ".market-card");
    // Keep jsdom from attempting native new-tab navigation after React ignores it.
    card.addEventListener("click", event => event.preventDefault(), { once: true });
    await dispatch(card, new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }));
    const prevented = new MouseEvent("click", { bubbles: true, cancelable: true }); prevented.preventDefault();
    await dispatch(card, prevented);
    await act(async () => view.router.navigate("/resale/market/demo-003?lang=en&q=object&page=2"));
    await click(element(view.container, "[data-market-return]")); await view.flush(); expect(view.scroll).not.toHaveBeenCalled();
  });
  it("keeps direct entry/reload and unrelated market links at their normal focus", async () => {
    const view = await setup(); await view.flush(); expect(view.scroll).not.toHaveBeenCalled();
    await view.open(); await act(async () => view.router.navigate("/other"));
    await click(element(view.container, "a")); await view.flush(); expect(view.scroll).not.toHaveBeenCalled();
  });
  it.each(["missing", "empty", "error", "not-bound"])("keeps the heading fallback for settled %s", async mode => {
    const view = await setup(); await view.open();
    const source = createMockResaleMarket();
    const restore = portOverride(async input => {
      if (mode === "error") throw new Error("read failed");
      if (mode === "not-bound") return { ...MARKET_CLAIMS, kind: "NOT_BOUND" };
      const result = await source.read(input);
      if (result.kind !== "NOT_BOUND" && result.payload.kind === "list") {
        result.payload.products = mode === "missing" ? [{ ...result.payload.products[0]!, productId: "replacement" }] : [];
        result.kind = mode === "empty" ? "empty" : "ready";
      }
      return result;
    });
    try {
      await act(async () => view.router.navigate(-1));
      const heading = element(view.container, "#market-results-heading"); await act(async () => heading.focus());
      await view.flush(); expect(document.activeElement).toBe(heading); expect(view.scroll).not.toHaveBeenCalled();
    } finally { await view.unmount(); restore(); }
  });
  it.each([false, true])("waits for a matching delayed read; interaction=%s", async interact => {
    const view = await setup(); await view.open();
    const source = createMockResaleMarket();
    const releases: Array<() => void> = [];
    const restore = portOverride(async input => { await new Promise<void>(resolve => releases.push(resolve)); return source.read(input); });
    try {
      await act(async () => view.router.navigate(-1)); await view.flush(); expect(view.scroll).not.toHaveBeenCalled();
      if (interact) await act(async () => element(view.container, "#market-search").focus());
      await act(async () => releases.forEach(release => release())); await view.flush();
      expect(view.scroll).toHaveBeenCalledTimes(interact ? 0 : 1);
    } finally { await view.unmount(); restore(); }
  });
  it("restores the saved offset after a viewport/layout change and never focuses by index", async () => {
    const view = await setup();
    const origin = element(view.container, ".market-card");
    vi.spyOn(origin, "getBoundingClientRect").mockReturnValue({ top: 40 } as DOMRect);
    vi.stubGlobal("scrollY", 123);
    await view.open(); await act(async () => view.router.navigate(-1));
    vi.stubGlobal("innerHeight", 300);
    vi.spyOn(element(view.container, ".market-card"), "getBoundingClientRect").mockReturnValue({ top: 200, height: 280 } as DOMRect);
    await view.flush(); expect(view.scroll).toHaveBeenCalledWith({ left: 0, top: 303, behavior: "instant" });
  });
  it("ignores out-of-order list reads after an intervening query navigation", async () => {
    const view = await setup(); await view.open();
    const source = createMockResaleMarket();
    const releases: Array<() => void> = [];
    const restore = portOverride(async input => {
      if (input.kind === "list" && input.page === 2) await new Promise<void>(resolve => releases.push(resolve));
      return source.read(input);
    });
    try {
      await act(async () => view.router.navigate(-1));
      await act(async () => view.router.navigate("/resale/market?q=absent"));
      const search = element(view.container, "#market-search"); await act(async () => search.focus());
      await act(async () => releases.forEach(release => release())); await view.flush();
      expect(document.activeElement).toBe(search); expect(view.scroll).not.toHaveBeenCalled(); expect(view.container.querySelector(".market-card")).toBeNull();
    } finally { await view.unmount(); restore(); }
  });
  it("cancels scheduled frames on unmount", async () => {
    const view = await setup(); await view.open(); await act(async () => view.router.navigate(-1));
    expect(view.frames.size).toBe(1); await view.unmount(); expect(view.frames.size).toBe(0); await view.flush(); expect(view.scroll).not.toHaveBeenCalled();
  });
});
