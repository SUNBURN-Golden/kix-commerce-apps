// @vitest-environment jsdom
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ReceiptScreen } from "../src/pages/Receipts";
import { buildReceiptExplorer, type ReceiptExplorerModel } from "../src/receipt-explorer";
import type { WorkspaceRole } from "../src/workspace/registry";
import { button, change, click, dispatch, element, renderDom } from "./support/render-dom";
import { paginationInput, paginationModel, receiptCandidate } from "./support/receipt-pagination-fixture";

const view = (model: ReceiptExplorerModel) => <MemoryRouter><ReceiptScreen model={model} role={model.role} onRole={() => undefined} /></MemoryRouter>;
const rows = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLButtonElement>("#receipt-timeline button[data-entry-id]"));
const detail = (root: ParentNode) => element(root, "#receipt-detail").textContent!;
const count = (root: ParentNode) => element(root, "#receipt-timeline-status").textContent!;
const exported = (root: ParentNode) => element<HTMLTextAreaElement>(root, "#receipt-diagnostic").value;
const key = (node: Element, value: string) => dispatch(node, new KeyboardEvent("keydown", { key: value, bubbles: true }));

describe("receipt filters and pagination on the real screen", () => {
  it("bounds 5000 mounted entries, reaches first/last, combines filters and leaves export byte-identical", async () => {
    const model = paginationModel();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const { container } = await renderDom(view(model));
    const before = exported(container);
    expect(element(container, "#receipt-timeline-status").getAttribute("aria-live")).toBe("off");
    await click(button(container, "Copy diagnostic"));
    expect(writeText).toHaveBeenLastCalledWith(before);
    expect(rows(container)).toHaveLength(50);
    expect(count(container)).toContain("Showing 1–50 of 5000 matching; 5000 total.");
    expect(count(container)).toContain("UNKNOWN): 1000");
    await click(button(container, "Last"));
    expect(element(container, "#receipt-timeline-status").getAttribute("aria-live")).toBe("polite");
    expect(rows(container)).toHaveLength(50);
    expect(rows(container)[49]?.textContent).toContain("op-page-4999");
    expect(detail(container)).toContain("op-page-0");
    expect(detail(container)).toContain("outside this page or filter");
    await click(button(container, "Next"));
    expect(count(container)).toContain("4951–5000");
    await click(button(container, "First"));
    await change(element(container, "#receipt-status-filter"), "unknown");
    await change(element(container, "#receipt-context-filter"), "gift");
    expect(count(container)).toContain("1–50 of 250 matching; 5000 total");
    expect(rows(container).every((row) => row.textContent?.includes("unknown"))).toBe(true);
    expect(detail(container)).toContain("op-page-0");
    expect(exported(container)).toBe(before);
    await click(button(container, "Copy diagnostic"));
    expect(writeText).toHaveBeenLastCalledWith(before);
    await change(element(container, "#receipt-status-filter"), "loading");
    expect(count(container)).toContain("0–0 of 0 matching; 5000 total");
    expect(rows(container)).toHaveLength(0);
    expect(element(container, "#receipt-timeline").textContent).toContain("No receipts match");
    expect(button(container, "Last").getAttribute("aria-disabled")).toBe("true");
    await click(button(container, "Clear filters"));
    expect(rows(container)).toHaveLength(50);
    expect(exported(container)).toBe(before);
    expect(storage).not.toHaveBeenCalled();
  });

  it("arrows cross visible groups; Home/End stay within the page; removed focus recovers to the single status", async () => {
    const input = paginationInput("operator", 60);
    input.extra = input.extra!.map((item, index) => ({ ...(item as object), refId: `group-${Math.floor(index / 10)}` }));
    const model = buildReceiptExplorer(input);
    const dom = await renderDom(view(model));
    rows(dom.container)[9]!.focus();
    await key(rows(dom.container)[9]!, "ArrowDown");
    expect(document.activeElement).toBe(rows(dom.container)[10]);
    await key(document.activeElement!, "End");
    expect(document.activeElement).toBe(rows(dom.container)[49]);
    await key(document.activeElement!, "Home");
    expect(document.activeElement).toBe(rows(dom.container)[0]);
    const next = button(dom.container, "Next");
    next.focus();
    await click(next);
    expect(document.activeElement).toBe(next);
    rows(dom.container)[0]!.focus();
    await dom.rerender(view(buildReceiptExplorer({ ...input, extra: input.extra!.slice(0, 50) })));
    expect(rows(dom.container)).toHaveLength(50);
    expect(count(dom.container)).toContain("1–50");
    expect(document.activeElement?.id).toBe("receipt-timeline-status");
    expect(dom.container.querySelectorAll("#receipt-timeline [aria-live]")).toHaveLength(1);
  });

  it("preserves transport DOM identity and focus through preceding path insertion/removal and clears on removal", async () => {
    const input = paginationInput("operator", 3);
    input.gift.path = { kind: "checking" };
    const dom = await renderDom(view(buildReceiptExplorer(input)));
    const transport = rows(dom.container)[0]!;
    transport.focus();
    await click(transport);
    input.journey.path = { kind: "checking" };
    await dom.rerender(view(buildReceiptExplorer(input)));
    expect(rows(dom.container)[1]).toBe(transport);
    expect(document.activeElement).toBe(transport);
    expect(transport.dataset.entryId).toContain("gift");
    input.journey.path = { kind: "available-stub-shape" };
    await dom.rerender(view(buildReceiptExplorer(input)));
    expect(rows(dom.container)[0]).toBe(transport);
    expect(document.activeElement).toBe(transport);
    input.gift.path = { kind: "available-stub-shape" };
    await dom.rerender(view(buildReceiptExplorer(input)));
    expect(document.activeElement?.id).toBe("receipt-timeline-status");
    expect(element(dom.container, "#receipt-detail").getAttribute("data-state")).toBe("empty");
    input.gift.path = { kind: "checking" };
    await dom.rerender(view(buildReceiptExplorer(input)));
    expect(element(dom.container, "#receipt-detail").getAttribute("data-state")).toBe("empty");
  });

  it("missing or ambiguous selection is permanently invalidated, including ambiguous initialization", async () => {
    const input = paginationInput("buyer", 2);
    const one = receiptCandidate(1);
    const model = (extra: readonly unknown[]) => buildReceiptExplorer({ ...input, extra });
    const dom = await renderDom(view(model([one])));
    expect(detail(dom.container)).toContain("op-page-1");
    expect(element(dom.container, "#receipt-detail").getAttribute("data-state")).toBe("unknown");
    for (const invalid of [[], [one, { ...one, sequence: 999, status: "confirmed" }]]) {
      rows(dom.container)[0]!.focus();
      await click(rows(dom.container)[0]!);
      await dom.rerender(view(model(invalid)));
      expect(document.activeElement?.id).toBe("receipt-timeline-status");
      expect(element(dom.container, "#receipt-detail").getAttribute("data-state")).toBe("empty");
      await dom.rerender(view(model([one])));
      expect(element(dom.container, "#receipt-detail").getAttribute("data-state")).toBe("empty");
      expect(rows(dom.container)[0]?.textContent).toContain("unknown");
    }
    const duplicate = await renderDom(view(model([one, { ...one, sequence: 2 }])));
    expect(element(duplicate.container, "#receipt-detail").getAttribute("data-state")).toBe("empty");
    await duplicate.rerender(view(model([one])));
    expect(element(duplicate.container, "#receipt-detail").getAttribute("data-state")).toBe("empty");
  });

  it("empty-to-populated stays unselected and arrivals preserve page, selection, and focus", async () => {
    const dom = await renderDom(view(paginationModel("buyer", 0)));
    await dom.rerender(view(paginationModel("buyer", 100)));
    expect(element(dom.container, "#receipt-detail").getAttribute("data-state")).toBe("empty");
    expect(detail(dom.container)).toContain("No receipt selected.");
    expect(element(dom.container, "#receipt-timeline-status").getAttribute("aria-live")).toBe("polite");
    await click(rows(dom.container)[1]!);
    await click(button(dom.container, "Last"));
    rows(dom.container)[10]!.focus();
    const focused = document.activeElement;
    const input = paginationInput("buyer", 100);
    input.extra = [receiptCandidate(100, { refId: "earlier-group", sequence: 1 }), ...input.extra!.map((item) => ({ ...(item as object), sequence: 200 }))];
    await dom.rerender(view(buildReceiptExplorer(input)));
    expect(count(dom.container)).toContain("51–100 of 101");
    expect(detail(dom.container)).toContain("op-page-1");
    expect(element(dom.container, "#receipt-detail").getAttribute("data-state")).toBe("unknown");
    expect(document.activeElement).toBe(focused);
  });

  it("role tab keys reset filters/selection and expose only authorized contexts; session switches clear detail", async () => {
    function Roles() {
      const [role, setRole] = useState<WorkspaceRole>("operator");
      return <ReceiptScreen model={paginationModel(role)} role={role} onRole={setRole} />;
    }
    const dom = await renderDom(<MemoryRouter><Roles /></MemoryRouter>);
    await change(element(dom.container, "#receipt-context-filter"), "gift");
    await click(rows(dom.container)[0]!);
    const tab = element(dom.container, "#receipt-tab-operator");
    tab.focus();
    await key(tab, "ArrowLeft");
    expect(document.activeElement?.id).toBe("receipt-tab-organizer");
    expect(count(dom.container)).toContain("1250 total");
    expect(count(dom.container)).toContain("UNKNOWN): 250");
    expect(element<HTMLSelectElement>(dom.container, "#receipt-context-filter").value).toBe("all");
    expect(Array.from(element<HTMLSelectElement>(dom.container, "#receipt-context-filter").options).map((option) => option.value)).toEqual(["all", "organizer", "transport"]);
    expect(detail(dom.container)).not.toContain("op-page-1250");
    expect(element(dom.container, "#receipt-detail").getAttribute("data-state")).toBe("empty");
    expect(exported(dom.container)).not.toContain("op-page-1250");
    await key(document.activeElement!, "Home");
    expect(document.activeElement?.id).toBe("receipt-tab-buyer");
    expect(count(dom.container)).toContain("3750 total");
    expect(element(dom.container, "#receipt-context-filter").textContent).not.toContain("Organizer");
    const other = await renderDom(view(paginationModel("buyer", 3)));
    rows(other.container)[0]!.focus();
    const input = paginationInput("buyer", 3);
    input.screenSessionId = "new-session";
    await other.rerender(view(buildReceiptExplorer(input)));
    expect(rows(other.container)).toHaveLength(0);
    expect(document.activeElement?.id).toBe("receipt-timeline-status");
    expect(detail(other.container)).not.toContain("op-page");
    input.extra = [receiptCandidate(5, { sessionId: "new-session" })];
    await other.rerender(view(buildReceiptExplorer(input)));
    expect(rows(other.container)).toHaveLength(1);
    expect(element(other.container, "#receipt-detail").getAttribute("data-state")).toBe("empty");
  });
});
