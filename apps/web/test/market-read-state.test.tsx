// @vitest-environment jsdom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { parseMarketReadState } from "../src/shell/market-read-state";
import { ResaleMarketPage } from "../src/pages/ResaleMarket";
import { ResaleProductPage } from "../src/pages/ResaleProduct";
import { marketController } from "../src/resale-market";
import { createMockResaleMarket, MARKET_CLAIMS, type ResaleMarketRead } from "../../../packages/protocol-adapter/src/resale-market";
import { LocaleContext, stateFor } from "../src/i18n/locale-context";
import { renderRoute } from "./support/render-route";
import { button, change, click, element } from "./support/render-dom";

const screens = <Routes><Route path="/resale/market" element={<ResaleMarketPage />} /><Route path="/resale/market/:productId" element={<ResaleProductPage />} /></Routes>;
describe("market URL read context", () => {
  it("round-trips Unicode and spaces without changing other identifier validators", () => {
    expect(parseMarketReadState("?page=2&q=%EA%B6%A4%EB%8F%84+%EC%98%A4%EB%B8%8C%EC%A0%9C&lang=ko")).toMatchObject({ query: "궤도 오브제", page: 2, lang: "ko", invalid: false });
    expect(parseMarketReadState("?q=" + "a".repeat(100)).query).toHaveLength(100);
    expect(parseMarketReadState("?q=++Orbit++&page=1&lang=en").search).toBe("?lang=en&q=Orbit");
    expect(parseMarketReadState("?q=&page=1").search).toBe("");
  });
  it.each(["q=a&q=b&page=2", "q=" + "x".repeat(101) + "&page=2", "q=%00", "q=%EF%BF%BD", "page=0", "page=-1", "page=1.5", "page=01", "page=1e2", "page=9007199254740992", "page=", "page=2&page=2", "lang=ko&lang=en", "lang=xx", "amount=120&operationId=x&outcome=CONFIRMED&return=https://example.com"])("safely cleans %s", search => {
    const result = parseMarketReadState("?" + search);
    expect(result.invalid).toBe(true); expect(result.page).toBe(1); expect(result.search).toBe("");
  });
  it("commits atomically, preserves product/return context, and restores input through history", async () => {
    const send = vi.spyOn(marketController, "submit");
    const view = await renderRoute(screens, "/resale/market?lang=en&q=object&page=2");
    expect(view.container.textContent).toContain("Arc object");
    await change(element(view.container, "#market-search"), "draft only");
    expect(view.router.state.location.search).toContain("q=object&page=2");
    const product = element<HTMLAnchorElement>(view.container, ".market-card");
    expect(product.getAttribute("href")).toBe("/resale/market/demo-003?lang=en&q=object&page=2");
    await click(product);
    const back = element<HTMLAnchorElement>(view.container, 'a[href="/resale/market?lang=en&q=object&page=2"]');
    await click(back); expect(element<HTMLInputElement>(view.container,"#market-search").value).toBe("object");
    await change(element(view.container, "#market-search"), "궤도"); await click(button(view.container,"Search"));
    expect(view.router.state.location.search).toBe("?lang=en&q=%EA%B6%A4%EB%8F%84"); expect(view.router.state.historyAction).toBe("PUSH");
    await act(async () => { await view.router.navigate(-1); });
    expect(element<HTMLInputElement>(view.container,"#market-search").value).toBe("object"); expect(view.container.textContent).toContain("Arc object");
    await act(async () => { await view.router.navigate(1); });
    expect(element<HTMLInputElement>(view.container,"#market-search").value).toBe("궤도"); expect(send).not.toHaveBeenCalled();
  });
  it("restores committed input on a page-only history transition", async () => {
    const view = await renderRoute(screens, "/resale/market?q=object");
    await click(button(view.container, "Next page"));
    await change(element(view.container, "#market-search"), "uncommitted");
    await act(async () => { await view.router.navigate(-1); });
    expect(element<HTMLInputElement>(view.container, "#market-search").value).toBe("object");
    expect(view.container.textContent).toContain("Orbit object");
  });
  it.each(["en", "ko"] as const)("retains localized feedback after replacement cleanup (%s)", async locale => {
    const view = await renderRoute(<LocaleContext.Provider value={stateFor(locale, () => {})}>{screens}</LocaleContext.Provider>, `/resale/market?lang=${locale}&q=object&page=999&amount=8`);
    expect(view.router.state.location.search).toBe(`?lang=${locale}&q=object`);
    expect(view.router.state.historyAction).toBe("REPLACE");
    expect(element(view.container,"[data-market-read-notice]").textContent).toContain(locale === "ko" ? "검색 조건을 초기화" : "search context was reset");
    expect(view.container.textContent).toContain(locale === "ko" ? "궤도 오브제" : "Orbit object");
  });
  it.each(["held", "object"])("only matching settled responses prove availability and fence late reads (%s)", async heldQuery => {
    const source = createMockResaleMarket();
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const sourceRead = vi.spyOn(source, "read").mockImplementation(async (input: ResaleMarketRead) => {
      if (input.kind === "list" && input.query === heldQuery && input.page === 2) await held;
      return createMockResaleMarket().read(input);
    });
    // Replace the controller port only inside this test; the production hook/controller stay intact.
    const controller = marketController as unknown as { port: typeof source };
    const original = controller.port; controller.port = source;
    try {
      const view = await renderRoute(screens, `/resale/market?q=${heldQuery}&page=2`);
      expect(view.router.state.location.search).toBe(`?q=${heldQuery}&page=2`);
      const destination = heldQuery === "held" ? "?q=object&page=2" : "?q=object";
      const productName = heldQuery === "held" ? "Arc object" : "Orbit object";
      await act(async () => { await view.router.navigate("/resale/market" + destination); });
      expect(view.container.textContent).toContain(productName);
      await act(async () => { release(); await held; });
      expect(view.router.state.location.search).toBe(destination); expect(view.container.textContent).toContain(productName);
      sourceRead.mockRejectedValueOnce(new Error("read failed"));
      await act(async () => { await view.router.navigate("/resale/market?page=900"); });
      expect(view.router.state.location.search).toBe("?page=900");
      sourceRead.mockResolvedValueOnce({ ...MARKET_CLAIMS, kind: "NOT_BOUND" });
      await act(async () => { await view.router.navigate("/resale/market?page=901"); });
      expect(view.router.state.location.search).toBe("?page=901"); expect(marketController.state().readState).toBe("not-bound");
      await view.unmount();
    } finally { release(); controller.port = original; }
  });
  it("query changes never clear UNKNOWN or dispatch a simulation", async () => {
    const source = createMockResaleMarket();
    const submit = vi.fn(async () => { throw new Error("lost"); });
    const controller = marketController as unknown as { port: typeof source };
    const original = controller.port; controller.port = { read: source.read, submit };
    try {
      await marketController.read({ kind: "detail", productId: "demo-001" });
      await marketController.submit({ kind: "bid", productId: "demo-001", variantId: "standard", expectedVersion: 0, mockUnits: "115" });
      const view = await renderRoute(screens, "/resale/market?q=object&page=2");
      await change(element(view.container, "#market-search"), "궤도"); await click(button(view.container,"Search"));
      expect(marketController.state()).toMatchObject({ outcome: "UNKNOWN", fenced: true }); expect(submit).toHaveBeenCalledTimes(1);
      await click(element(view.container, ".market-card"));
      expect(view.container.textContent).toContain("UNKNOWN"); expect(button(view.container,"Review simulation").disabled).toBe(true);
      await view.unmount();
    } finally { controller.port = original; }
  });
});
