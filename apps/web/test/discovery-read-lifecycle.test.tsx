// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import * as adapter from "@kix/protocol-adapter";
import { MemoryRouter } from "react-router-dom";
import { LocaleProvider } from "../src/i18n/LocaleProvider";
import { LiveReadSection } from "../src/pages/DiscoveryPanels";
import { InventoryPage } from "../src/pages/Inventory";
import { useDiscoveryLiveRead } from "../src/discovery-live";
import { heldRead } from "./support/held-read";
import { button, click, renderDom } from "./support/render-dom";

function fixture() {
  const factory = adapter.discoveryReadPortFor;
  const ports: { page: ReturnType<typeof heldRead<Parameters<adapter.DiscoveryReadPort["readPage"]>, adapter.DiscoveryReadOutcome>>; detail: ReturnType<typeof heldRead<Parameters<adapter.DiscoveryReadPort["readRow"]>, adapter.DiscoveryRowOutcome>> }[] = [];
  vi.spyOn(adapter, "discoveryReadPortFor").mockImplementation((...args) => {
    const port = factory(...args);
    const page = heldRead(port.readPage.bind(port));
    const detail = heldRead(port.readRow.bind(port));
    ports.push({ page, detail });
    return { ...port, reset: port.reset.bind(port), readPage: page.invoke, readRow: detail.invoke };
  });
  let view!: ReturnType<typeof useDiscoveryLiveRead>;
  function Probe({ row = "pro-0001", enabled = true }: { row?: string | null; enabled?: boolean }) {
    view = useDiscoveryLiveRead({ rowId: row, detailEnabled: enabled });
    return null;
  }
  return { ports, Probe, view: () => view };
}

describe("discovery read ownership", () => {
  it.each(["clear", "disable"] as const)("invalidates detail on %s even without a replacement read", async (kind) => {
    const f = fixture();
    const dom = await renderDom(<f.Probe />);
    const old = f.ports[0]!.detail.calls[0]!;
    await dom.rerender(<f.Probe row={kind === "clear" ? null : "pro-0001"} enabled={kind !== "disable"} />);
    await act(async () => { f.view().detailHandlers.readAgain(); await old.resolve(); });
    expect(f.ports[0]!.detail.calls).toHaveLength(1);
    expect(f.view().detailModel.state).toBe("empty");
    expect(f.view().detailModel.row).toBeNull();
    await dom.rerender(<f.Probe />);
    expect(f.ports[0]!.detail.calls).toHaveLength(2);
    await act(async () => { await f.ports[0]!.detail.calls[1]!.resolve(); });
    expect(f.view().detailModel.state).not.toBe("loading");
  });

  it("fences A→B→A and reverse completion without restoring the first detail", async () => {
    const f = fixture();
    const dom = await renderDom(<f.Probe row="a" />);
    await dom.rerender(<f.Probe row="b" />);
    await dom.rerender(<f.Probe row="a" />);
    const calls = f.ports[0]!.detail.calls;
    await act(async () => { await calls[2]!.resolve({ kind: "unknown", message: "current" }); });
    await act(async () => { await calls[0]!.resolve({ kind: "unknown", message: "obsolete" }); calls[1]!.reject(); });
    expect(f.view().detailModel.detailLine).toBe("current");
  });

  it.each(["filter", "stream", "rebuild"] as const)("invalidates list/detail and cached freshness on %s", async (kind) => {
    const f = fixture();
    await renderDom(<f.Probe />);
    const initial = f.ports[0]!;
    await act(async () => {
      if (kind === "filter") f.view().listHandlers.setFilter({ ...adapter.EMPTY_DISCOVERY_FILTER, text: "paper" });
      else if (kind === "stream") f.view().listHandlers.setStream("stale");
      else f.view().listHandlers.rebuildProjection();
    });
    await act(async () => { await initial.page.calls[0]!.resolve(); await initial.detail.calls[0]!.resolve(); });
    expect(f.view().listModel.rows).toEqual([]);
    expect(f.view().detailModel.row).toBeNull();
    if (kind === "rebuild") {
      expect(f.view().listModel.state).toBe("unknown");
      expect(f.view().listModel.actionLabel).toBe("Read again");
      await act(async () => f.view().listHandlers.runReturn());
    }
    const newest = f.ports.at(-1)!.page.calls.at(-1)!;
    expect(newest.args[0].cursor).toBeNull();
    expect(newest.args[0].watermarkFloor).toBeNull();
  });

  it("preserves the committed old cursor for REBUILT without accepting a pending page", async () => {
    const f = fixture();
    await renderDom(<f.Probe row={null} />);
    await act(async () => { await f.ports[0]!.page.calls[0]!.resolve(); });
    const firstRows = f.view().listModel.rows;
    await act(async () => f.view().listHandlers.nextPage());
    const obsolete = f.ports[0]!.page.calls[1]!;
    await act(async () => f.view().listHandlers.rebuildProjection());
    await act(async () => { await obsolete.resolve(); });
    expect(f.view().listModel.rows).toEqual(firstRows);
    await act(async () => f.view().listHandlers.nextPage());
    const request = f.ports[1]!.page.calls[0]!;
    expect(request.args[0].cursor).not.toBeNull();
    expect(request.args[0].watermarkFloor).toBeNull();
    await act(async () => { await request.resolve(); });
    expect(f.view().listModel.statusLine).toContain("REBUILT");
  });

  it("StrictMode replaces cancelled reads; post-unmount resolves and rejections are consumed", async () => {
    const f = fixture();
    const dom = await renderDom(<StrictMode><f.Probe /></StrictMode>);
    const port = f.ports[0]!;
    expect(port.page.calls).toHaveLength(2);
    expect(port.detail.calls).toHaveLength(2);
    await act(async () => { await port.page.calls[1]!.resolve(); await port.detail.calls[1]!.resolve(); });
    expect(f.view().listModel.state).toBe("ready");
    await dom.unmount();
    await act(async () => { port.page.calls[0]!.reject(); await port.detail.calls[0]!.resolve(); });
    const remount = await renderDom(<f.Probe />);
    expect(f.view().listModel.state).toBe("loading");
    await act(async () => { await f.ports.at(-1)!.page.calls[0]!.resolve(); });
    expect(f.view().listModel.state).toBe("ready");
    await remount.unmount();
  });

  it.each(["readPage", "readRow", "reset"] as const)("consumes throws/rejections from %s and recovers only explicitly", async (method) => {
    const factory = adapter.discoveryReadPortFor;
    let fail: "throw" | "reject" | "normal" = "throw";
    const read = vi.fn();
    vi.spyOn(adapter, "discoveryReadPortFor").mockImplementation((...args) => {
      const port = factory(...args);
      const original = port[method].bind(port);
      return new Proxy(port, { get(target, key) {
        if (key === method) return (...input: never[]) => {
          read();
          if (fail !== "normal") {
            if (fail === "reject" && method !== "reset") return Promise.reject(new Error("private"));
            throw new Error("private");
          }
          return Reflect.apply(original, port, input);
        };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      } });
    });
    let view!: ReturnType<typeof useDiscoveryLiveRead>;
    function Probe() { view = useDiscoveryLiveRead({ rowId: "pro-0001", detailEnabled: true }); return null; }
    await renderDom(<Probe />);
    if (method === "reset") await act(async () => view.listHandlers.setFilter(adapter.EMPTY_DISCOVERY_FILTER));
    expect(method === "readRow" ? view.detailModel.state : view.listModel.state).toBe("unknown");
    expect(method === "readRow" ? view.detailModel.detailLine : view.listModel.detailLine).not.toContain("private");
    expect(read).toHaveBeenCalledTimes(1);
    if (method !== "reset") {
      fail = "reject";
      await act(async () => { if (method === "readRow") view.detailHandlers.readAgain(); else view.listHandlers.runReturn(); });
      expect(method === "readRow" ? view.detailModel.state : view.listModel.state).toBe("unknown");
      expect(read).toHaveBeenCalledTimes(2);
    }
    fail = "normal";
    await act(async () => { if (method === "readRow") view.detailHandlers.readAgain(); else view.listHandlers.runReturn(); });
    expect(method === "readRow" ? view.detailModel.state : view.listModel.state).not.toBe("loading");
  });
  it("a current deferred rejection settles unknown and one explicit read recovers", async () => {
    const f = fixture();
    await renderDom(<f.Probe />);
    const port = f.ports[0]!;
    await act(async () => { port.page.calls[0]!.reject(); port.detail.calls[0]!.reject(); });
    expect(f.view().listModel.state).toBe("unknown");
    expect(f.view().detailModel.state).toBe("unknown");
    expect(f.view().listModel.actionLabel).toBe("Read again");
    expect(f.view().detailModel.actionLabel).toBe("Read again");
    await act(async () => { f.view().listHandlers.runReturn(); f.view().detailHandlers.readAgain(); });
    expect(port.page.calls).toHaveLength(2);
    expect(port.detail.calls).toHaveLength(2);
    await act(async () => { await port.page.calls[1]!.resolve(); await port.detail.calls[1]!.resolve(); });
    expect(f.view().listModel.state).toBe("ready");
    expect(f.view().detailModel.state).toBe("ready");
  });

  it("an obsolete list watermark/cursor cannot contaminate the next request", async () => {
    const f = fixture();
    await renderDom(<f.Probe row={null} />);
    await act(async () => f.view().listHandlers.setFilter(adapter.EMPTY_DISCOVERY_FILTER));
    const page = f.ports[0]!.page;
    await act(async () => { await page.calls[1]!.resolve(); });
    const rows = f.view().listModel.rows;
    const answer = await adapter.createStubDiscoveryRead().readPage(page.calls[0]!.args[0]);
    if (answer.kind !== "ready") throw new Error("Expected fixture ready");
    await act(async () => { await page.calls[0]!.resolve({ ...answer, watermark: "2099-01-01T00:00:00Z" }); });
    expect(f.view().listModel.rows).toEqual(rows);
    await act(async () => f.view().listHandlers.nextPage());
    expect(page.calls[2]!.args[0].watermarkFloor).not.toContain("2099");
    expect(page.calls[2]!.args[0].cursor).not.toBeNull();
  });

  it("keeps integration-http reads NOT_BOUND through the unchanged factory, with zero fetches", async () => {
    const factory = adapter.discoveryReadPortFor;
    vi.spyOn(adapter, "discoveryReadPortFor").mockImplementation((_environment, options) => factory("integration-http", options));
    let view!: ReturnType<typeof useDiscoveryLiveRead>;
    function Probe() { view = useDiscoveryLiveRead({ rowId: "pro-0001", detailEnabled: true }); return null; }
    await renderDom(<Probe />);
    expect(view.listModel.state).toBe("not-bound");
    expect(view.detailModel.state).toBe("not-bound");
    expect(view.listModel.rows).toEqual([]);
    expect(view.listModel.actionLabel).toBeNull();
  });

  it.each(["en", "ko"] as const)("%s initial reads keep focus; explicit recovery repairs removed-button focus", async (locale) => {
    const factory = adapter.discoveryReadPortFor;
    const initialPort = factory("stub");
    const held = heldRead(initialPort.readPage.bind(initialPort));
    vi.spyOn(adapter, "discoveryReadPortFor").mockImplementation((...args) => {
      const port = factory(...args);
      return { ...port, reset: port.reset.bind(port), readRow: port.readRow.bind(port), readPage: held.invoke };
    });
    let view!: ReturnType<typeof useDiscoveryLiveRead>;
    function Probe() {
      view = useDiscoveryLiveRead({ rowId: null, detailEnabled: false });
      return <LiveReadSection model={view.listModel} handlers={view.listHandlers} onOpen={() => {}} />;
    }
    const dom = await renderDom(<LocaleProvider initial={locale}><Probe /></LocaleProvider>);
    await act(async () => { await held.calls[0]!.resolve(); });
    expect(document.activeElement).toBe(document.body);
    await act(async () => view.listHandlers.setFilter(adapter.EMPTY_DISCOVERY_FILTER));
    await act(async () => held.calls[1]!.reject());
    const recovery = button(dom.container, locale === "en" ? "Read again" : "다시 조회");
    recovery.focus();
    await click(recovery);
    await act(async () => { await held.calls[2]!.resolve(); });
    expect(document.activeElement?.id).toBe("discovery-live-status");
    await dom.unmount();
    const inventory = await renderDom(<LocaleProvider initial={locale}><MemoryRouter initialEntries={["/inventory?section=sec-orch"]}><InventoryPage /></MemoryRouter></LocaleProvider>);
    expect(document.activeElement).toBe(document.body);
    expect(inventory.container.querySelector('[data-inventory-state="ready"]')).not.toBeNull();
  });

});
