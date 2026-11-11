// @vitest-environment jsdom
import { act, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { MARKET_CLAIMS, createMockResaleMarket, resaleMarketPortFor } from "../../../packages/protocol-adapter/src/resale-market";
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

import { renderDom, change, click, button, element, dispatch } from "./support/render-dom";
import { FORM_MESSAGES } from "../src/forms/catalogue";
import { formatUnits } from "../src/format";
import { ResaleMarketPage } from "../src/pages/ResaleMarket";
import { ResaleProductPage } from "../src/pages/ResaleProduct";
describe("mounted resale marketplace", () => {
  it.each((["en", "ko"] as const).flatMap(locale => (["bid", "ask"] as const).map(kind => ({ locale, kind }))))("preserves exact mock units through edit, review, one submission and offers ($locale/$kind)", async ({ locale, kind }) => {
    const p = createMockResaleMarket(); const submit = vi.fn(p.submit);
    const c = new ResaleMarketController({ read: p.read, submit }); await c.read(read);
    let language = locale;
    function Live() { useSyncExternalStore(c.subscribe, c.state, c.state); return panels(c, language); }
    const { container, rerender } = await renderDom(<Live />);
    await change(element(container, "#market-action"), kind);
    const reviewLabel = () => language === "ko" ? "모의 거래 검토" : "Review simulation";
    const values = ["0", "9007199254740993", "12345678901234567890123456789", "999999999999999999999999999999"];
    for (const [index, value] of values.entries()) {
      const input = element<HTMLInputElement>(container, "#market-units");
      expect(input.hasAttribute("maxlength")).toBe(false);
      await change(input, value); expect(input.value).toBe(value);
      language = language === "ko" ? "en" : "ko"; await rerender(<Live />);
      expect(input.value).toBe(value);
      await click(button(container, reviewLabel()));
      const label = language === "ko" ? "모의 단위" : "mock units";
      const exact = `${value} ${label}`;
      expect(formatUnits(value, label, language === "ko" ? "ko-KR" : "en-GB")).toBe(exact);
      expect(container.querySelector(".market-review p:nth-of-type(3)")?.textContent).toBe(exact);
      expect(document.activeElement).toBe(container.querySelector(".market-review h4"));
      expect(submit).toHaveBeenCalledTimes(index);
      await click(button(container, language === "ko" ? "입력으로 돌아가기" : "Back to edit"));
      expect(element<HTMLInputElement>(container, "#market-units").value).toBe(value);
      await click(button(container, reviewLabel()));
      await click(button(container, language === "ko" ? "모의 거래 한 번 기록" : "Record simulation once"));
      expect(submit).toHaveBeenCalledTimes(index + 1);
      expect(submit.mock.calls[index][0]).toEqual({ kind, productId: "demo-001", variantId: "standard", expectedVersion: index, mockUnits: value });
      expect(c.state()).toMatchObject({ outcome: "CONFIRMED", outcomeRequest: { mockUnits: value } });
      expect(c.detail()?.offers[index]).toMatchObject({ side: kind, mockUnits: value, state: "open" });
      expect(container.querySelectorAll("#market-offers-rows li")[index]?.textContent).toContain(exact);
    }
  });

  it.each(["ko", "en"] as const)("retains malformed drafts, links localized errors and focuses only deliberate refusal (%s)", async locale => {
    const p = createMockResaleMarket(); const submit = vi.fn(p.submit);
    const c = new ResaleMarketController({ read: p.read, submit }); await c.read(read);
    const snapshot = c.detail();
    const { container } = await renderDom(panels(c, locale));
    await change(element(container, "#market-action"), "ask");
    const input = element<HTMLInputElement>(container, "#market-units");
    const review = button(container, locale === "ko" ? "모의 거래 검토" : "Review simulation");
    for (const value of ["00", "01", "+1", "-1", "1.0", "1e3", "1,000", "1_000", "1 000", "１", " 0", "0 ", "9".repeat(31), "9".repeat(100)]) {
      await change(input, value); await act(async () => input.focus());
      await act(async () => review.focus());
      expect(document.activeElement).toBe(review);
      expect(input.value).toBe(value);
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(input.getAttribute("aria-describedby")).toBe("market-units-format-error");
      expect(element(container, "#market-units-format-error").textContent).toBe(FORM_MESSAGES[locale]["validation.integer"]);
      await click(review);
      expect(document.activeElement).toBe(container.querySelector(".error-summary"));
      await click(element(container, '.error-summary a[href="#market-units"]'));
      expect(document.activeElement).toBe(input);
      expect(container.querySelector(".market-review")).toBeNull();
      expect(submit).not.toHaveBeenCalled(); expect(c.detail()).toBe(snapshot);
    }
    await dispatch(input, new CompositionEvent("compositionstart", { bubbles: true }));
    await change(input, "999999999999999999999999999999");
    await dispatch(input, new CompositionEvent("compositionend", { bubbles: true }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
    expect(input.getAttribute("aria-invalid")).toBe("false");
    await click(review); expect(container.querySelector(".market-review")).not.toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });
  it("publishes stable immutable snapshots to mounted controls and keeps UNKNOWN disabled", async () => {
    const p = createMockResaleMarket();
    const submit = vi.fn(async (i: Parameters<typeof p.submit>[0]) => { await p.submit(i); throw new Error("lost after effect"); });
    const c = new ResaleMarketController({ read: p.read, submit }); await c.read(read);
    const stable = c.state(); const detail = c.detail(); let renders = 0;
    function Live() { useSyncExternalStore(c.subscribe, c.state, c.state); ++renders; return panels(c); }
    const off = c.subscribe(() => {
      expect(Reflect.set(c.state(), "fenced", false)).toBe(false);
      expect(Reflect.set(c.state(), "outcome", null)).toBe(false);
      expect(Reflect.set(c.detail()!.quotes[0]!, "available", true)).toBe(false);
    });
    const { container, unmount } = await renderDom(<Live />);
    expect(c.state()).toBe(stable); expect(c.detail()).toBe(detail);
    expect(renders).toBe(1);
    expect(Reflect.set(c.state(), "freshness", "STALE")).toBe(false);
    expect(c.state()).toBe(stable); expect(renders).toBe(1);
    await click(button(container, "Review simulation"));
    await click(button(container, "Record simulation once"));
    expect(c.state()).toMatchObject({ outcome: "UNKNOWN", fenced: true });
    expect(container.textContent).toContain("UNKNOWN");
    expect(button(container, "Review simulation").disabled).toBe(true);
    const unknown = c.state();
    await click(button(container, "Read current fixtures"));
    expect(c.state()).not.toBe(unknown); expect(c.detail()).not.toBe(detail);
    expect(c.state()).toMatchObject({ outcome: "UNKNOWN", fenced: true, freshness: "CURRENT" });
    expect(button(container, "Review simulation").disabled).toBe(true);
    await c.submit({ kind: "bid", productId: "demo-001", variantId: "standard", expectedVersion: 1, mockUnits: "115" });
    expect(submit).toHaveBeenCalledTimes(1); expect(renders).toBeLessThan(12);
    expect(stable).toMatchObject({ outcome: null, fenced: false });
    off(); await unmount();
  });

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


describe("product-attributed resale outcomes", () => {
  it.each(["confirmed", "rejected", "unknown"] as const)("isolates %s from another product while retaining the global fence", async result => {
    const p = createMockResaleMarket();
    const submit = vi.fn(async (i: Parameters<typeof p.submit>[0]) => {
      if (result === "unknown") throw new Error("lost");
      if (result === "rejected") return { kind: "REJECTED", request: i, code: "STALE_VERSION", ...MARKET_CLAIMS } as const;
      return p.submit(i);
    });
    const c = new ResaleMarketController({ read: p.read, submit }); await c.read(read);
    function Live() { useSyncExternalStore(c.subscribe, c.state, c.state); return c.detail() ? panels(c) : null; }
    const { container, unmount } = await renderDom(<Live />);
    await click(button(container, "Review simulation")); await click(button(container, "Record simulation once"));
    expect(container.querySelector("#market-outcome")?.getAttribute("data-market-outcome")).toBe(result.toUpperCase());
    if (result === "rejected") expect(button(container, "Review simulation").disabled).toBe(true);
    await act(async () => { await c.read({ kind: "detail", productId: "demo-002" }); });
    const outcome = container.querySelector("#market-outcome")!;
    expect(outcome.getAttribute("data-market-outcome")).toBe(result === "unknown" ? "UNKNOWN" : "");
    expect(outcome.textContent).not.toMatch(/\bCONFIRMED\b/); expect(outcome.textContent).not.toMatch(/\bREJECTED\b/);
    expect(button(container, "Review simulation").disabled).toBe(result === "unknown");
    if (result === "unknown") {
      expect(container.querySelector('[data-async-state="unknown"]')).not.toBeNull();
      await c.submit({ kind: "bid", productId: "demo-002", variantId: "standard", expectedVersion: 0, mockUnits: "115" });
      expect(submit).toHaveBeenCalledTimes(1);
    }
    await unmount();
  });
  it("scopes variant/action rendering and focuses each new same-kind terminal result once", async () => {
    const c = new ResaleMarketController(createMockResaleMarket()); await c.read(read);
    function Live() { useSyncExternalStore(c.subscribe, c.state, c.state); return c.detail() ? panels(c) : null; }
    const { container, unmount } = await renderDom(<Live />);
    await change(element(container, "#market-action"), "bid");
    for (let i = 0; i < 2; i++) {
      await click(button(container, "Review simulation")); await click(button(container, "Record simulation once"));
      expect(document.activeElement).toBe(container.querySelector("#market-outcome"));
      expect(container.querySelector("#market-outcome")?.textContent).toContain("CONFIRMED");
    }
    element<HTMLElement>(container, "#market-variant").focus();
    await change(element(container, "#market-variant"), "wide");
    expect(container.querySelector("#market-outcome")?.textContent).toBe("");
    await change(element(container, "#market-variant"), "standard");
    await change(element(container, "#market-action"), "ask");
    expect(container.querySelector("#market-outcome")?.textContent).toBe("");
    expect(document.activeElement).not.toBe(container.querySelector("#market-outcome"));
    await unmount();
  });
  it("focuses and latches a new rejection even when the submitted fields are identical", async () => {
    const p = createMockResaleMarket();
    const submit = vi.fn(async (i: Parameters<typeof p.submit>[0]) => ({ ...MARKET_CLAIMS, kind: "REJECTED", request: i, code: "STALE_VERSION" } as const));
    const c = new ResaleMarketController({ read: p.read, submit }); await c.read(read);
    function Live() { useSyncExternalStore(c.subscribe, c.state, c.state); return panels(c); }
    const { container, unmount } = await renderDom(<Live />);
    await change(element(container, "#market-action"), "bid");
    let previous = c.state().outcomeRequest;
    for (let index = 0; index < 2; index++) {
      await click(button(container, "Review simulation")); await click(button(container, "Record simulation once"));
      expect(c.state().outcomeRequest).not.toBe(previous); previous = c.state().outcomeRequest;
      expect(document.activeElement).toBe(container.querySelector("#market-outcome"));
      expect(button(container, "Review simulation").disabled).toBe(true);
      element<HTMLElement>(container, "#market-units").focus();
      await change(element(container, "#market-units"), "116");
      await change(element(container, "#market-units"), "115");
      expect(button(container, "Review simulation").disabled).toBe(false);
    }
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[0]).toEqual(submit.mock.calls[1]);
    await unmount();
  });

});
