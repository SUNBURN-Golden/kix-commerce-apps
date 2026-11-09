// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import * as adapter from "@kix/protocol-adapter";
import { heldRead } from "./support/held-read";
import { useInventoryRead } from "../src/inventory-venue";
import { InventoryPage } from "../src/pages/Inventory";
import { button, change, click, element, renderDom } from "./support/render-dom";

describe("inventory response ownership", () => {
  it("drops an older summary after changing scenario and never restores its sections", async () => {
    const factory = adapter.inventoryReadPortFor;
    let release: (() => void) | undefined;
    let first = true;
    vi.spyOn(adapter, "inventoryReadPortFor").mockImplementation((...args) => {
      const port = factory(...args);
      if (!first) return port;
      first = false;
      const readSummary = port.readSummary.bind(port);
      port.readSummary = async (input) => {
        const answer = await readSummary(input);
        await new Promise<void>((resolve) => { release = resolve; });
        return answer;
      };
      return port;
    });
    const { container } = await renderDom(<MemoryRouter><InventoryPage /></MemoryRouter>);
    expect(element(container, "#inventory-summary").getAttribute("data-inventory-state")).toBe("loading");
    await change(element(container, "#inventory-scenario"), "stale");
    expect(element(container, "#inventory-summary").getAttribute("data-inventory-state")).toBe("stale");
    await act(async () => { release!(); });
    expect(element(container, "#inventory-summary").getAttribute("data-inventory-state")).toBe("stale");
    expect(container.querySelector('[aria-label="Venue sections"]')).toBeNull();
  });

  it("keeps the fresh page when an earlier bounded-page response arrives late", async () => {
    const factory = adapter.inventoryReadPortFor;
    let release: (() => void) | undefined;
    let firstPage = true;
    vi.spyOn(adapter, "inventoryReadPortFor").mockImplementation((...args) => {
      const port = factory(...args);
      const readPage = port.readPage.bind(port);
      port.readPage = async (input) => {
        const answer = await readPage(input);
        if (firstPage) {
          firstPage = false;
          await new Promise<void>((resolve) => { release = resolve; });
          return { kind: "unknown", message: "Obsolete synthetic answer" };
        }
        return answer;
      };
      return port;
    });
    const { container } = await renderDom(<MemoryRouter initialEntries={["/inventory?section=sec-orch"]}><InventoryPage /></MemoryRouter>);
    expect(element(container, "#inventory-page").getAttribute("data-inventory-state")).toBe("loading");
    await click(button(container, "Read page again"));
    expect(element(container, "#inventory-page").getAttribute("data-inventory-state")).toBe("ready");
    const firstRow = element(container, '[role="option"]').id;
    await act(async () => { release!(); });
    expect(element(container, "#inventory-page").getAttribute("data-inventory-state")).toBe("ready");
    expect(element(container, '[role="option"]').id).toBe(firstRow);
    expect(container.textContent).not.toContain("Obsolete synthetic answer");
  });
});

function controlled(port: adapter.InventoryReadPort) {
  return {
    summary: heldRead(port.readSummary.bind(port)),
    page: heldRead(port.readPage.bind(port)),
    selection: heldRead(port.readSelection.bind(port)),
  };
}

function lifecycleFixture() {
  const factory = adapter.inventoryReadPortFor;
  const ports: ReturnType<typeof controlled>[] = [];
  vi.spyOn(adapter, "inventoryReadPortFor").mockImplementation((...args) => {
    const port = factory(...args);
    const held = controlled(port);
    ports.push(held);
    return new Proxy(port, { get(target, key) {
      if (key === "readSummary") return held.summary.invoke;
      if (key === "readPage") return held.page.invoke;
      if (key === "readSelection") return held.selection.invoke;
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    } });
  });
  let view!: ReturnType<typeof useInventoryRead>;
  const location = vi.fn();
  function Probe({ section = "sec-orch", unit = "sec-orch-s000003", quantity = null }: { section?: string | null; unit?: string | null; quantity?: number | null }) {
    view = useInventoryRead({ sectionId: section, unitId: unit, quantity, setLocation: location });
    return null;
  }
  const ready = async () => {
    await act(async () => { await ports[0]!.summary.calls[0]!.resolve(); });
    await act(async () => { await ports[0]!.page.calls[0]!.resolve(); });
  };
  return { ports, Probe, view: () => view, ready, location };
}

describe("inventory lifecycle fences", () => {
  it.each(["clear-unit", "clear-section", "quantity", "section", "free-only", "page"] as const)("fences selected evidence and seenAs on %s", async (change) => {
    const f = lifecycleFixture();
    const dom = await renderDom(<f.Probe />);
    await f.ready();
    const old = f.ports[0]!.selection.calls[0]!;
    if (change === "free-only") await act(async () => f.view().actions.setFreeOnly(true));
    else if (change === "page") await act(async () => f.view().actions.nextPage());
    else await dom.rerender(<f.Probe section={change === "clear-section" ? null : change === "section" ? "sec-pit" : "sec-orch"} unit={change === "clear-unit" ? null : "sec-orch-s000003"} quantity={change === "quantity" ? 2 : null} />);
    await act(async () => { await old.resolve(); });
    expect(f.view().selectionModel?.selected ?? false).toBe(false);
    expect(f.view().selectionModel?.changedSincePage ?? false).toBe(false);
    if (change === "free-only" || change === "page") {
      await act(async () => { await f.ports[0]!.page.calls.at(-1)!.resolve(); });
      const newest = f.ports[0]!.selection.calls.at(-1)!;
      expect(newest).not.toBe(old);
      if (change === "page") expect(newest.args[0].seenAs).toBeNull();
    }
  });

  it("A→B→A never revives an earlier page or selection; obsolete rejection is consumed", async () => {
    const f = lifecycleFixture();
    const dom = await renderDom(<f.Probe />);
    await f.ready();
    const oldSelection = f.ports[0]!.selection.calls[0]!;
    await act(async () => f.view().actions.readPageAgain());
    const oldPage = f.ports[0]!.page.calls[1]!;
    await dom.rerender(<f.Probe section="sec-pit" unit="sec-pit-pool" quantity={2} />);
    await dom.rerender(<f.Probe />);
    await act(async () => { await f.ports[0]!.page.calls.at(-1)!.resolve(); });
    const rows = f.view().pageModel!.rows;
    await act(async () => { oldPage.reject(); await oldSelection.resolve(); });
    expect(f.view().pageModel!.rows).toEqual(rows);
    expect(f.view().selectionModel!.selected).toBe(false);
    expect(f.ports[0]!.page.calls.at(-1)!.args[0].cursor).toBeNull();
  });

  it.each(["scenario", "generation", "summary"] as const)("invalidates every dependent stage on %s and preserves explicit generation refusal", async (trigger) => {
    const f = lifecycleFixture();
    await renderDom(<f.Probe />);
    await f.ready();
    const oldSelection = f.ports[0]!.selection.calls[0]!;
    await act(async () => f.view().actions.readPageAgain());
    const oldPage = f.ports[0]!.page.calls[1]!;
    await act(async () => {
      if (trigger === "scenario") f.view().actions.setScenario("stale");
      else if (trigger === "generation") f.view().actions.advanceGeneration();
      else f.view().actions.readSummaryAgain();
    });
    await act(async () => { await oldPage.resolve(); await oldSelection.resolve(); });
    expect(f.view().pageModel?.rows ?? []).toEqual([]);
    expect(f.view().selectionModel?.selected ?? false).toBe(false);
    if (trigger === "generation") {
      expect(f.ports[1]!.summary.calls).toHaveLength(0);
      await act(async () => f.view().actions.readPageAgain());
      const next = f.ports[1]!.page.calls[0]!;
      expect(next.args[0].heldGeneration).toBe(adapter.INVENTORY_GENERATION);
      expect(next.args[0].watermarkFloor).toBeNull();
      await act(async () => { await next.resolve(); });
      expect(f.view().pageModel!.state).toBe("generation-changed");
      await act(async () => f.view().actions.runReturn("page"));
      expect(f.location).toHaveBeenLastCalledWith({});
      expect(f.ports[1]!.summary.calls).toHaveLength(1);
      expect(f.view().pageModel).toBeNull();
    } else {
      expect(f.view().pageModel).toBeNull();
      const next = f.ports.at(-1)!.summary.calls.at(-1)!;
      await act(async () => next.reject());
      expect(f.view().summaryModel.state).toBe("unknown");
      expect(f.view().summaryModel.actionLabel).toBe("Read again");
      expect(f.view().pageModel).toBeNull();
    }
  });

  it.each(["scenario", "generation"] as const)("fences a pending summary on %s", async (trigger) => {
    const f = lifecycleFixture();
    await renderDom(<f.Probe />);
    await act(async () => trigger === "scenario" ? f.view().actions.setScenario("stale") : f.view().actions.advanceGeneration());
    await act(async () => { await f.ports[0]!.summary.calls[0]!.resolve(); });
    expect(f.view().summaryModel.sections).toEqual([]);
    expect(f.view().summaryModel.state).not.toBe("ready");
    expect(f.view().pageModel).toBeNull();
  });

  it("StrictMode replaces cancelled summary and unmount invalidates all stages", async () => {
    const f = lifecycleFixture();
    const dom = await renderDom(<StrictMode><f.Probe /></StrictMode>);
    const port = f.ports[0]!;
    expect(port.summary.calls).toHaveLength(2);
    await act(async () => { await port.summary.calls[1]!.resolve(); });
    await act(async () => { await port.page.calls.at(-1)!.resolve(); });
    await act(async () => f.view().actions.readPageAgain());
    await dom.unmount();
    await act(async () => {
      port.summary.calls[0]!.reject();
      await port.page.calls.at(-1)!.resolve();
      port.selection.calls[0]!.reject();
    });
  });

  it.each(["readSummary", "readPage", "readSelection"] as const)("converts current throws and rejections at %s; explicit recovery sends one read", async (method) => {
    const factory = adapter.inventoryReadPortFor;
    let mode: "throw" | "reject" | "normal" = "throw";
    const calls = vi.fn();
    vi.spyOn(adapter, "inventoryReadPortFor").mockImplementation((...args) => {
      const port = factory(...args);
      return new Proxy(port, { get(target, key) {
        const value = Reflect.get(target, key);
        if (key === method) return (...input: unknown[]) => {
          calls();
          if (mode === "throw") throw new Error("private");
          if (mode === "reject") return Promise.reject(new Error("private"));
          return Reflect.apply(value, target, input);
        };
        return typeof value === "function" ? value.bind(target) : value;
      } });
    });
    let view!: ReturnType<typeof useInventoryRead>;
    function Probe() { view = useInventoryRead({ sectionId: "sec-orch", unitId: "sec-orch-s000003", quantity: null, setLocation: vi.fn() }); return null; }
    await renderDom(<Probe />);
    const stage = method === "readSummary" ? "summary" : method === "readPage" ? "page" : "selection";
    const model = () => stage === "summary" ? view.summaryModel : stage === "page" ? view.pageModel! : view.selectionModel!;
    expect(model().state).toBe("unknown");
    expect(model().actionLabel).toBe("Read again");
    expect(calls).toHaveBeenCalledTimes(1);
    mode = "reject";
    await act(async () => view.actions.runReturn(stage));
    expect(model().state).toBe("unknown");
    expect(model().detailLine).not.toContain("private");
    expect(calls).toHaveBeenCalledTimes(2);
    mode = "normal";
    await act(async () => view.actions.runReturn(stage));
    expect(model().state).toBe("ready");
    expect(calls).toHaveBeenCalledTimes(3);
  });
  it.each(["page", "selection"] as const)("current deferred %s rejection is recoverable without an automatic retry", async (stage) => {
    const f = lifecycleFixture();
    await renderDom(<f.Probe />);
    await act(async () => { await f.ports[0]!.summary.calls[0]!.resolve(); });
    if (stage === "selection") await act(async () => { await f.ports[0]!.page.calls[0]!.resolve(); });
    const held = f.ports[0]![stage];
    await act(async () => held.calls[0]!.reject());
    expect(stage === "page" ? f.view().pageModel!.state : f.view().selectionModel!.state).toBe("unknown");
    expect(held.calls).toHaveLength(1);
    await act(async () => f.view().actions.runReturn(stage));
    expect(held.calls).toHaveLength(2);
    await act(async () => { await held.calls[1]!.resolve(); });
    expect(stage === "page" ? f.view().pageModel!.state : f.view().selectionModel!.state).toBe("ready");
  });

  it("old selection watermark cannot restore freshness after quantity changes", async () => {
    const f = lifecycleFixture();
    const dom = await renderDom(<f.Probe />);
    await f.ready();
    const old = f.ports[0]!.selection.calls[0]!;
    const answer = await adapter.createStubInventoryRead().readSelection(old.args[0]);
    if (answer.kind !== "ready") throw new Error("Expected fixture ready");
    await dom.rerender(<f.Probe quantity={2} />);
    await act(async () => { await old.resolve({ ...answer, selection: { ...answer.selection, unit: { ...answer.selection.unit, watermark: "2099-01-01T00:00:00Z" } } } as adapter.InventorySelectionOutcome); });
    expect(f.view().selectionModel!.selected).toBe(false);
    await act(async () => f.view().actions.readPageAgain());
    expect(f.ports[0]!.page.calls.at(-1)!.args[0].watermarkFloor).not.toContain("2099");
  });

  it("integration-http remains NOT_BOUND without dependent reads, fallback or fetch", async () => {
    const factory = adapter.inventoryReadPortFor;
    vi.spyOn(adapter, "inventoryReadPortFor").mockImplementation((_environment, options) => factory("integration-http", options));
    let view!: ReturnType<typeof useInventoryRead>;
    function Probe() { view = useInventoryRead({ sectionId: "sec-orch", unitId: "sec-orch-s000003", quantity: null, setLocation: vi.fn() }); return null; }
    await renderDom(<Probe />);
    expect(view.summaryModel.state).toBe("not-bound");
    expect(view.summaryModel.sections).toEqual([]);
    expect(view.pageModel).toBeNull();
    expect(view.selectionModel).toBeNull();
    expect(view.summaryModel.actionLabel).toBeNull();
  });

});
