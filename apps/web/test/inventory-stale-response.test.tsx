// @vitest-environment jsdom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import * as adapter from "@kix/protocol-adapter";
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
