// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { InventoryPage } from "../src/pages/Inventory";
import { button, change, click, dispatch, element, renderDom } from "./support/render-dom";

describe("mounted synthetic inventory", () => {
  it("opens a bounded page, supports keyboard detail, filters, and refuses an old generation", async () => {
    const { container } = await renderDom(<MemoryRouter initialEntries={["/inventory?section=sec-orch"]}><InventoryPage /></MemoryRouter>);
    expect(element(container, "#inventory-summary").getAttribute("data-inventory-state")).toBe("ready");
    expect(container.querySelectorAll('[role="option"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[role="option"]').length).toBeLessThanOrEqual(25);
    const first = element(container, '[role="option"]').id;
    await click(button(container, "Next page"));
    expect(element(container, '[role="option"]').id).not.toBe(first);
    const list = element(container, '[role="listbox"]');
    await dispatch(list, new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    await dispatch(list, new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(container.querySelector("#inventory-selection")).not.toBeNull();
    await click(button(container, "Read detail again"));
    await click(button(container, container.querySelector('[data-selected="true"]') ? "Clear selection" : "Close detail"));
    expect(container.querySelector("#inventory-selection")).toBeNull();
    await click(element(container, "#inventory-free-only"));
    expect(Array.from(container.querySelectorAll('[role="option"]')).every((row) => row.getAttribute("data-observed") === "free")).toBe(true);
    await click(button(container, "Read page again"));
    await click(button(container, "Advance generation"));
    expect(container.querySelector('[data-generation="behind"]')).not.toBeNull();
    await click(button(container, "Read page again"));
    expect(element(container, "#inventory-page").getAttribute("data-inventory-state")).toBe("generation-changed");
    await click(button(element(container, "#inventory-page"), "Back to summary"));
    expect(container.querySelector("#inventory-page")).toBeNull();
    expect(container.querySelector('[data-generation="behind"]')).toBeNull();
    await change(element(container, "#inventory-scenario"), "stale");
    expect(element(container, "#inventory-summary").getAttribute("data-inventory-state")).toBe("stale");
    await click(button(container, "Read summary again"));
    expect(element(container, "#inventory-summary").textContent).toContain("Stale inventory watermark");
  });

  it("keeps invalid GA input, focuses it, and selects a count only after correction", async () => {
    const { container } = await renderDom(<MemoryRouter initialEntries={["/inventory?section=sec-pit"]}><InventoryPage /></MemoryRouter>);
    await change(element(container, "#inventory-quantity"), "1.5");
    await click(button(container, "Select quantity"));
    expect(element(container, "#inventory-selection").getAttribute("data-inventory-state")).toBe("invalid-request");
    expect(document.activeElement?.id).toBe("inventory-quantity");
    expect(element<HTMLInputElement>(container, "#inventory-quantity").value).toBe("1.5");
    await change(element(container, "#inventory-quantity"), "2");
    await click(button(container, "Select quantity"));
    expect(element(container, '[data-selected="true"]').textContent).toContain("Quantity 2");
    expect(container.textContent).toContain("Nothing was reserved, held, sold, or paid");
    await click(button(container, "Clear selection"));
    expect(container.querySelector("#inventory-selection")).toBeNull();
  });
});
