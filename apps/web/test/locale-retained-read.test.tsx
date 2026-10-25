// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import * as adapter from "@kix/protocol-adapter";
import { LocaleProvider } from "../src/i18n/LocaleProvider";
import { useLocale } from "../src/i18n/locale-context";
import { presentInstant } from "../src/a11y/present";
import { InventoryPage } from "../src/pages/Inventory";
import { DiscoveryPage } from "../src/pages/Discovery";
import { button, click, renderDom } from "./support/render-dom";

function Switch() {
  const { locale, setLocale } = useLocale();
  return <button onClick={() => setLocale(locale === "en" ? "ko" : "en")}>switch</button>;
}

afterEach(() => history.replaceState(null, "", "/"));

describe("retained read models change display locale without another read", () => {
  for (const scenario of ["clean", "stale"] as const) {
    it(`reformats inventory ${scenario} summary/page/selection in place`, async () => {
      const port = adapter.createStubInventoryRead({ scenario });
      const summaryRead = vi.spyOn(port, "readSummary");
      const pageRead = vi.spyOn(port, "readPage");
      const selectionRead = vi.spyOn(port, "readSelection");
      const factory = vi.spyOn(adapter, "inventoryReadPortFor").mockReturnValue(port);
      const expected = await adapter.createStubInventoryRead({ scenario }).readSummary({ scope: adapter.INVENTORY_DESK_SCOPE, watermarkFloor: null });
      if (expected.kind !== "ready" && expected.kind !== "stale") throw new Error("Expected clock-bearing inventory outcome");
      const instants = expected.kind === "stale" ? [expected.watermark, expected.floor] : [expected.watermark];
      history.replaceState(null, "", "/?lang=en");
      const { container } = await renderDom(<LocaleProvider><Switch /><MemoryRouter initialEntries={["/inventory?section=sec-orch&unit=sec-orch-s000003"]}><InventoryPage /></MemoryRouter></LocaleProvider>);
      const counts = [summaryRead.mock.calls.length, pageRead.mock.calls.length, selectionRead.mock.calls.length];
      expect(counts).toEqual(scenario === "clean" ? [1, 1, 1] : [1, 0, 0]);
      expect(container.querySelector("#inventory-summary")?.getAttribute("data-inventory-state")).toBe(scenario === "clean" ? "ready" : "stale");
      if (scenario === "clean") {
        expect(container.querySelector("#inventory-page")?.getAttribute("data-inventory-state")).toBe("ready");
        expect(container.querySelector("#inventory-selection")?.getAttribute("data-inventory-state")).toBe("ready");
      }
      const rows = Array.from(container.querySelectorAll('[role="option"]'), (row) => row.id);
      for (const iso of instants) expect(container.textContent).toContain(presentInstant(iso, "en-GB"));
      await click(button(container, "switch"));
      for (const iso of instants) {
        expect(container.textContent).toContain(presentInstant(iso, "ko-KR"));
        expect(container.textContent).not.toContain(presentInstant(iso, "en-GB"));
      }
      expect([summaryRead.mock.calls.length, pageRead.mock.calls.length, selectionRead.mock.calls.length]).toEqual(counts);
      expect(factory).toHaveBeenCalledTimes(1);
      expect(Array.from(container.querySelectorAll('[role="option"]'), (row) => row.id)).toEqual(rows);
      await click(button(container, "switch"));
      for (const iso of instants) expect(container.textContent).toContain(presentInstant(iso, "en-GB"));
      expect([summaryRead.mock.calls.length, pageRead.mock.calls.length, selectionRead.mock.calls.length]).toEqual(counts);
    });

    it(`reformats discovery ${scenario} list in place`, async () => {
      const port = adapter.createStubDiscoveryRead({ stream: scenario });
      const read = vi.spyOn(port, "readPage");
      const detail = vi.spyOn(port, "readRow");
      const factory = vi.spyOn(adapter, "discoveryReadPortFor").mockReturnValue(port);
      const expected = await adapter.createStubDiscoveryRead({ stream: scenario }).readPage({ scope: adapter.DISCOVERY_DESK_SCOPE, filter: adapter.EMPTY_DISCOVERY_FILTER, pageSize: adapter.DISCOVERY_READ_PAGE_BOUND, cursor: null, watermarkFloor: null });
      if (expected.kind !== "ready" && expected.kind !== "stale") throw new Error("Expected clock-bearing discovery outcome");
      const instants = expected.kind === "stale" ? [expected.watermark, expected.floor] : [expected.watermark!];
      history.replaceState(null, "", "/?lang=en");
      const { container } = await renderDom(<LocaleProvider><Switch /><MemoryRouter initialEntries={["/discovery"]}><DiscoveryPage /></MemoryRouter></LocaleProvider>);
      expect(read).toHaveBeenCalledTimes(1);
      const rows = Array.from(container.querySelectorAll('[role="option"]'), (row) => row.id);
      for (const iso of instants) expect(container.textContent).toContain(presentInstant(iso, "en-GB"));
      await click(button(container, "switch"));
      for (const iso of instants) {
        expect(container.textContent).toContain(presentInstant(iso, "ko-KR"));
        expect(container.textContent).not.toContain(presentInstant(iso, "en-GB"));
      }
      expect(read).toHaveBeenCalledTimes(1);
      expect(detail).not.toHaveBeenCalled();
      expect(factory).toHaveBeenCalledTimes(1);
      expect(Array.from(container.querySelectorAll('[role="option"]'), (row) => row.id)).toEqual(rows);
    });
  }
});
