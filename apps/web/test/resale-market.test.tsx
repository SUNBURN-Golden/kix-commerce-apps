// @vitest-environment jsdom
import { act, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createMockResaleMarket, resaleMarketPortFor } from "../../../packages/protocol-adapter/src/resale-market";
import { ResaleMarketController } from "../../../packages/protocol-adapter/src/resale-market-controller";
import { PriceChart, ProductPanels } from "../src/pages/ResaleMarketPanels";
import { LocaleContext, stateFor } from "../src/i18n/locale-context";
import { connectivityController, connectivityPort, actionAllowed } from "../src/connectivity/write-guard";
import { connectivity } from "../src/connectivity/store";
function panels(c: ResaleMarketController, locale: "en" | "ko" = "en") {
  const detail = c.detail(); if (!detail) throw new Error("fixture");
  return <MemoryRouter><LocaleContext.Provider value={stateFor(locale, () => {})}><ProductPanels detail={detail} market={{ state: c.state(), controller: c, actions: { submit: i => c.submit(i) } }} /></LocaleContext.Provider></MemoryRouter>;
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const read = { kind: "detail", productId: "demo-001" } as const;
describe("resale market rendering", () => {
  it("renders fixtures, exact chart digits and bilingual no-funds labels", async () => {
    const c = new ResaleMarketController(createMockResaleMarket()); await c.read(read);
    for (const locale of ["en","ko"] as const) { const html = renderToStaticMarkup(panels(c,locale)); expect(html).toContain(locale === "en" ? "Simulated, no funds" : "모의 거래, 자금 이동 없음"); expect(html).toContain("120"); expect(html).toContain("110"); expect(html).toContain("<table>"); }
    for (const series of [[],[{ occurredAt: "2026-11-01T12:00:00Z", mockUnits: "900719925474099312345" }]]) { const html = renderToStaticMarkup(<PriceChart series={series} />); expect(html).not.toMatch(/NaN|Infinity/); if (series.length) expect(html).toContain("900719925474099312345"); }
  });
  it("renders empty, not-bound and UNKNOWN without clearing the fence", async () => {
    const p = createMockResaleMarket(); const c = new ResaleMarketController({ read: p.read, async submit(i) { await p.submit(i); throw new Error("lost"); } }); await c.read(read); await c.submit({ kind: "bid", productId: "demo-001", variantId: "standard", expectedVersion: 0, mockUnits: "115" }); await c.read(read);
    expect(renderToStaticMarkup(panels(c))).toContain("UNKNOWN"); expect(renderToStaticMarkup(panels(c,"ko"))).toContain("UNKNOWN"); expect(c.state().fenced).toBe(true);
    const http = new ResaleMarketController(resaleMarketPortFor("integration-http")); await http.read(read); expect(http.state().readState).toBe("not-bound");
    await c.read({ kind: "detail", productId: "absent" }); expect(c.state().readState).toBe("empty");
  });
  it("requires accepted current reads after reconnect and preserves UNKNOWN", async () => {
    connectivity.configure("stub"); connectivity.setBrowserOnline(true);
    const p = createMockResaleMarket(); const submit = vi.fn(async (i: Parameters<typeof p.submit>[0]) => { await p.submit(i); throw new Error("lost"); });
    const sourceRead = vi.fn(p.read);
    const port = connectivityPort({ read: sourceRead, submit }, "market-test"); const c = connectivityController(new ResaleMarketController(port),port);
    await c.read(read); expect(actionAllowed(port)).toBe(true); connectivity.setBrowserOnline(false); connectivity.setBrowserOnline(true); expect(actionAllowed(port)).toBe(false);
    sourceRead.mockResolvedValueOnce({ ...(await p.read(read)), protocolTruth: true } as never);
    await c.read(read); expect(actionAllowed(port)).toBe(false);
    await c.read(read); expect(c.state()).toMatchObject({ freshness: "CURRENT", readState: "ready" }); expect(actionAllowed(port)).toBe(true);
    await c.submit({ kind: "bid", productId: "demo-001", variantId: "standard", expectedVersion: 0, mockUnits: "115" }); connectivity.setBrowserOnline(false); connectivity.setBrowserOnline(true); await c.read(read); await c.submit({ kind: "ask", productId: "demo-001", variantId: "standard", expectedVersion: 1, mockUnits: "120" }); expect(submit).toHaveBeenCalledTimes(1); expect(c.state().fenced).toBe(true);
  });
  it("keeps a draft during locale changes and requires review before dispatch", async () => {
    const c = new ResaleMarketController(createMockResaleMarket()); await c.read(read); const send = vi.spyOn(c,"submit");
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(panels(c)));
    const select = host.querySelector<HTMLSelectElement>("#market-action")!;
    await act(async () => { select.value = "bid"; select.dispatchEvent(new Event("change",{ bubbles: true })); });
    await act(async () => root.render(panels(c,"ko")));
    expect(host.querySelector<HTMLSelectElement>("#market-action")?.value).toBe("bid");
    expect(send).not.toHaveBeenCalled(); await act(async () => root.unmount()); host.remove();
  });
});

import { renderDom, change, click, button, element } from "./support/render-dom";
import { ResaleMarketPage } from "../src/pages/ResaleMarket";
import { ResaleProductPage } from "../src/pages/ResaleProduct";
describe("mounted resale marketplace", () => {
  it("searches, paginates, renders missing products and enters product detail", async () => {
    const { container, unmount } = await renderDom(<MemoryRouter><ResaleMarketPage /></MemoryRouter>);
    expect(container.textContent).toContain("Orbit object");
    await click(button(container,"Next page")); expect(container.textContent).toContain("Arc object");
    await click(button(container,"Previous page"));
    await change(element(container,"#market-search"),"궤도"); await click(button(container,"Search")); expect(container.textContent).toContain("Orbit object");
    await change(element(container,"#market-search"),"absent"); await click(button(container,"Search")); expect(container.textContent).toContain("No synthetic products found"); await unmount();
    const missing = await renderDom(<MemoryRouter initialEntries={["/resale/market/absent"]}><Routes><Route path="/resale/market/:productId" element={<ResaleProductPage />} /></Routes></MemoryRouter>);
    expect(missing.container.textContent).toContain("Product unavailable");
  });
  it("edits, reviews, returns, submits each kind and displays unavailable quotes", async () => {
    const p = createMockResaleMarket(); const c = new ResaleMarketController(p); await c.read(read);
    function Live() { useSyncExternalStore(c.subscribe,c.state,c.state); return panels(c); }
    const { container } = await renderDom(<Live />);
    await change(element(container,"#market-variant"),"wide");
    for (const kind of ["bid","ask","instant-buy","instant-sell"]) {
      await change(element(container,"#market-action"),kind);
      if (kind === "bid" || kind === "ask") await change(element(container,"#market-units"),"119");
      await click(button(container,"Review simulation")); expect(container.textContent).toContain("Wide");
      await click(button(container,"Back to edit")); await click(button(container,"Review simulation"));
      await click(button(container,"Record simulation once")); expect(container.textContent).toContain("CONFIRMED");
    }
    expect(c.detail()?.trades.filter(x => x.variantId === "wide")).toHaveLength(2);
    await change(element(container,"#market-action"),"instant-buy"); expect(button(container,"Review simulation").disabled).toBe(true);
    await click(button(container,"Read current fixtures")); expect(c.detail()?.offers).toHaveLength(2);
  });
});

import { observeNavigation, onNavigation } from "../src/shell/navigation-observers";
describe("route departure before lazy cleanup", () => {
  it("fences an in-flight simulation before a replacement screen has mounted", async () => {
    const p = createMockResaleMarket(); let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
    const c = new ResaleMarketController({ read: p.read, async submit(i) { const result = await p.submit(i); await held; return result; } });
    await c.read(read); const off = onNavigation(() => c.invalidate()); const pending = c.submit({ kind: "bid", productId: "demo-001", variantId: "standard", expectedVersion: 0, mockUnits: "117" });
    observeNavigation("/resale/market"); expect(c.state()).toMatchObject({ outcome: "UNKNOWN", fenced: true });
    release(); await pending; expect(c.state().outcome).toBe("UNKNOWN"); off();
    const unchanged = c.state(); observeNavigation("/resale/market"); observeNavigation("/elsewhere"); expect(c.state()).toBe(unchanged);
  });
});
