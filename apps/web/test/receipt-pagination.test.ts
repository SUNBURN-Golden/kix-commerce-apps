import { describe, expect, it } from "vitest";
import { buildReceiptExplorer } from "../src/receipt-explorer";
import { buildReceiptTimelinePage, receiptSelectionKey } from "../src/receipt-pagination";
import { paginationInput, paginationModel, receiptCandidate } from "./support/receipt-pagination-fixture";

const all = { status: "all", context: "all", page: 1 } as const;

describe("receipt presentation projection", () => {
  it("covers 5000 deterministic entries exactly once with one global 50 entry ceiling", () => {
    const model = paginationModel();
    const before = JSON.stringify(model);
    const seen = [];
    for (let page = 1; page <= 100; page++) {
      const result = buildReceiptTimelinePage(model, { ...all, page });
      expect(result.entries).toHaveLength(50);
      expect(result.paths.length + result.groups.reduce((n, group) => n + group.entries.length, 0)).toBe(50);
      expect([result.start, result.end, result.pageCount, result.totalCount, result.unknownCount]).toEqual([(page - 1) * 50 + 1, page * 50, 100, 5000, 1000]);
      seen.push(...result.entries.map((entry) => entry.operationId));
    }
    expect(seen).toEqual(model.diagnostic.entries.map((entry) => entry.operationId));
    expect(new Set(seen).size).toBe(5000);
    expect(JSON.stringify(model)).toBe(before);
  });

  it("counts authorized UNKNOWN independently of filters, preserves summaries, clamps empty and invalid pages", () => {
    for (const [role, total, unknown] of [["operator", 5000, 1000], ["buyer", 3750, 750], ["organizer", 1250, 250]] as const) {
      const model = paginationModel(role);
      const result = buildReceiptTimelinePage(model, { status: "unknown", context: "all", page: 999 });
      expect([result.totalCount, result.unknownCount, result.filteredCount, result.page]).toEqual([total, unknown, unknown, unknown / 50]);
      expect(result.entries.every((entry) => entry.status === "unknown" && !entry.confirmed)).toBe(true);
    }
    const model = paginationModel();
    const filtered = buildReceiptTimelinePage(model, { status: "unknown", context: "gift", page: 2 });
    expect(filtered.filteredCount).toBe(250);
    expect(filtered.groups[0]?.lastConfirmed).toBe(model.groups[1]?.lastConfirmed);
    expect(filtered.groups[0]?.unconfirmed).toBe(model.groups[1]?.unconfirmed);
    const empty = buildReceiptTimelinePage(model, { status: "loading", context: "gift", page: 99 });
    expect([empty.start, empty.end, empty.page, empty.pageCount, empty.filteredCount]).toEqual([0, 0, 0, 0, 0]);
    for (const page of [0, -1, NaN, Infinity]) expect(buildReceiptTimelinePage(model, { ...all, page }).page).toBe(1);
    expect(buildReceiptTimelinePage(model, { ...all, page: 2.7 }).page).toBe(2);
  });

  it("includes transport in the single global slice and retains the complete redacted export", () => {
    const input = paginationInput();
    input.journey.path = { kind: "checking" };
    input.gift.path = { kind: "unavailable", code: "GATE_UNAVAILABLE", detail: "secret" };
    const before = JSON.stringify(input);
    const model = buildReceiptExplorer(input);
    const first = buildReceiptTimelinePage(model, all);
    expect(first.entries).toHaveLength(50);
    expect(first.paths).toHaveLength(2);
    expect(first.groups[0]?.entries).toHaveLength(48);
    expect(buildReceiptTimelinePage(model, { ...all, page: 101 }).entries).toHaveLength(2);
    expect(model.diagnostic.entries).toHaveLength(5002);
    expect(model.exportText).not.toContain("person@example.test");
    expect(JSON.stringify(input)).toBe(before);
  });

  it("identity ignores sequence/status but includes session, role, context, reference, action and operation", () => {
    const model = paginationModel("buyer", 1);
    const entry = model.groups[0]!.entries[0]!;
    const key = receiptSelectionKey(model, entry);
    expect(receiptSelectionKey(model, { ...entry, sequence: 999, status: "unknown", id: "renumbered" })).toBe(key);
    for (const override of [{ role: "organizer" as const }, { context: "gift" as const }, { refId: "other" }, { action: "accept_trade" }, { operationId: null }]) {
      expect(receiptSelectionKey(model, { ...entry, ...override })).not.toBe(key);
    }
    expect(receiptSelectionKey({ ...model, sessionId: "other" }, entry)).not.toBe(key);
    expect(receiptSelectionKey({ ...model, role: "operator" }, entry)).not.toBe(key);
  });

  it("foreign sessions and disallowed contexts never become paginated evidence", () => {
    const input = paginationInput("buyer", 1);
    input.extra = [...input.extra!, receiptCandidate(1250), receiptCandidate(3750), receiptCandidate(12, { sessionId: "foreign" })];
    const model = buildReceiptExplorer(input);
    expect(buildReceiptTimelinePage(model, all).totalCount).toBe(2);
    expect(model.sessionDropped).toBe(1);
    expect(model.exportText).not.toContain("op-page-12\"");
    expect(model.groups.every((group) => group.context !== "organizer")).toBe(true);
  });
});
