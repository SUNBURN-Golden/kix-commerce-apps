// @vitest-environment jsdom
import { act, useSyncExternalStore } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createMockResaleMarket } from "../../../packages/protocol-adapter/src/resale-market";
import { ResaleMarketController } from "../../../packages/protocol-adapter/src/resale-market-controller";
import { ProductPanels } from "../src/pages/ResaleMarketPanels";
import { LocaleContext, stateFor } from "../src/i18n/locale-context";
import { marketHistoryFixture } from "./support/resale-market-history-fixture";
import { renderDom, button, element, change, click } from "./support/render-dom";

const input = { kind: "detail", productId: "demo-001" } as const;
async function setup(lost = false) {
  const source = createMockResaleMarket();
  let count = 1001, wide = 51, generation = 0, reverse = false;
  const read = vi.fn(async () => {
    const result = await source.read(input);
    if (result.kind !== "NOT_BOUND" && result.payload.kind === "detail" && result.payload.detail) {
      result.payload.detail = marketHistoryFixture(result.payload.detail, count, wide, generation);
      if (reverse) { result.payload.detail.offers.reverse(); result.payload.detail.trades.reverse(); }
    }
    return result;
  });
  const submit = vi.fn(async (i: Parameters<typeof source.submit>[0]) => { const result = await source.submit(i); if (lost) throw new Error("lost after effect"); return result; });
  const c = new ResaleMarketController({ read, submit }); await c.read(input);
  let locale: "en" | "ko" = "en";
  function Live() {
    useSyncExternalStore(c.subscribe, c.state, c.state);
    return <MemoryRouter><LocaleContext.Provider value={stateFor(locale, () => {})}><ProductPanels detail={c.detail()!} market={{ state: c.state(), controller: c, actions: { submit: i => c.submit(i) } }} /></LocaleContext.Provider></MemoryRouter>;
  }
  const dom = await renderDom(<Live />);
  return { ...dom, c, read, submit, async update(n: number, w = wide, g = generation, backwards = false) { count = n; wide = w; generation = g; reverse = backwards; await act(async () => c.read(input)); }, async language(next: "en" | "ko") { locale = next; await dom.rerender(<Live />); } };
}
const status = (host: ParentNode, section = "trades") => element(host, `#market-${section}-status`);
const nav = (host: ParentNode, section = "trades") => element(host, `nav[aria-describedby="market-${section}-status"]`);
const ids = (host: ParentNode, section = "trades") => Array.from(host.querySelectorAll(`#market-${section}-rows > *`), row => row.getAttribute(section === "trades" ? "data-trade-id" : "data-offer-id"));

describe("independent mounted resale history pages", () => {
  it("traverses every source row once, bounds both sections, and keeps focus without reads or writes", async () => {
    const { container, read, submit } = await setup();
    expect(status(container).getAttribute("aria-live")).toBe("off");
    expect(ids(container)).toHaveLength(50); expect(ids(container, "offers")).toHaveLength(50);
    expect(container.textContent).toContain("900719925474099312345");
    for (const section of ["trades", "offers"]) {
      const seen = [...ids(container, section)];
      const next = button(nav(container, section), "Next page"); next.focus();
      for (let i = 1; i <= 20; i++) {
        await click(next);
        expect(document.activeElement).toBe(next);
        expect(ids(container, section).length).toBeLessThanOrEqual(50);
        seen.push(...ids(container, section));
      }
      expect(seen).toEqual(Array.from({ length: 1001 }, (_, i) => `${section === "trades" ? "trade" : "offer"}-0-standard-${i}`));
      expect(status(container, section).textContent).toContain("1001–1001 of 1001; page 21 of 21");
      expect(next.getAttribute("aria-disabled")).toBe("true"); await click(next); expect(ids(container, section)).toHaveLength(1);
      await click(button(nav(container, section), "First page"));
      expect(status(container, section).getAttribute("aria-live")).toBe("polite");
    }
    expect(read).toHaveBeenCalledTimes(1); expect(submit).not.toHaveBeenCalled();
  });
  it("resets variants synchronously, handles empty variants and retains independent locale positions", async () => {
    const dom = await setup(); const { container } = dom;
    await click(button(nav(container), "Last page"));
    await click(button(nav(container, "offers"), "Next page"));
    await dom.language("ko");
    expect(status(container).textContent).toContain("21페이지");
    expect(status(container, "offers").textContent).toContain("51–100개");
    const variant = element<HTMLSelectElement>(container, "#market-variant"); variant.focus(); await change(variant, "wide");
    expect(document.activeElement).toBe(variant);
    for (const section of ["trades", "offers"]) expect(status(container, section).textContent).toContain("와이드: 전체 51개 중 1–50개; 2페이지 중 1페이지");
    await dom.update(1001, 0);
    for (const section of ["trades", "offers"]) {
      expect(ids(container, section)).toHaveLength(0);
      expect(status(container, section).textContent).toContain("전체 0개 중 0–0개; 0페이지 중 0페이지");
      for (const control of Array.from(nav(container, section).querySelectorAll<HTMLButtonElement>("button"))) { expect(control.disabled).toBe(false); expect(control.getAttribute("aria-disabled")).toBe("true"); await click(control); }
    }
    await change(variant, "standard"); expect(ids(container)[0]).toBe("trade-0-standard-0");
  });
  it("retains valid pages through appends/replacements and permanently clamps shrinking/empty snapshots", async () => {
    const dom = await setup(); const { container } = dom;
    await dom.update(1002); expect(ids(container)[0]).toBe("trade-0-standard-0");
    await click(button(nav(container), "Last page"));
    await click(button(nav(container, "offers"), "Next page"));
    const last = button(nav(container), "Last page"); last.focus();
    await dom.update(1051); expect(document.activeElement).toBe(last);
    expect(status(container).textContent).toContain("1001–1050 of 1051; page 21 of 22");
    await dom.update(1051, 51, 1, true);
    expect(ids(container)[0]).toBe("trade-1-standard-50");
    expect(ids(container, "offers")[0]).toBe("offer-1-standard-1000");
    await dom.update(51); expect(status(container).textContent).toContain("51–51 of 51; page 2 of 2");
    await dom.update(1001); expect(status(container).textContent).toContain("51–100 of 1001; page 2 of 21");
    await dom.update(0, 0); expect(status(container).textContent).toContain("0–0 of 0; page 0 of 0");
    await dom.update(1001); expect(status(container).textContent).toContain("1–50 of 1001; page 1 of 21");
    expect(dom.submit).not.toHaveBeenCalled();
  });
  it("keeps the automatic post-submit read quiet and restores range announcements for user actions", async () => {
    const dom = await setup(); const { container } = dom;
    for (const section of ["trades", "offers"]) await click(button(nav(container, section), "Next page"));
    await click(button(container, "Review simulation")); await click(button(container, "Record simulation once"));
    expect(element(container, "#market-outcome").textContent).toContain("CONFIRMED");
    for (const section of ["trades", "offers"]) {
      expect(status(container, section).getAttribute("aria-live")).toBe("off");
      await click(button(nav(container, section), "Next page"));
      expect(status(container, section).getAttribute("aria-live")).toBe("polite");
    }
    await click(button(container, "Read current fixtures"));
    for (const section of ["trades", "offers"]) expect(status(container, section).getAttribute("aria-live")).toBe("polite");
    expect(dom.submit).toHaveBeenCalledTimes(1);
  });
  it("keeps UNKNOWN visible and writes fenced through paging, refresh and locale changes", async () => {
    const dom = await setup(true); const { container } = dom;
    await click(button(container, "Review simulation")); await click(button(container, "Record simulation once"));
    expect(dom.submit).toHaveBeenCalledTimes(1);
    expect(dom.c.state()).toMatchObject({ outcome: "UNKNOWN", fenced: true });
    const reads = dom.read.mock.calls.length;
    for (const section of ["offers", "trades"]) await click(button(nav(container, section), "Last page"));
    expect(dom.read).toHaveBeenCalledTimes(reads);
    expect(element(container, "#market-outcome").textContent).toContain("UNKNOWN");
    expect(button(container, "Review simulation").disabled).toBe(true);
    await click(button(container, "Read current fixtures")); await dom.language("ko");
    expect(element(container, "#market-outcome").textContent).toContain("UNKNOWN");
    expect(button(container, "모의 거래 검토").disabled).toBe(true);
    await click(button(container, "모의 거래 검토")); expect(dom.submit).toHaveBeenCalledTimes(1);
    expect(dom.c.detail()!.offers.length).toBe(1052);
  });
});
