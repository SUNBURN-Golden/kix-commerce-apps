import type { ReceiptContext, ReceiptEntry, ReceiptExplorerModel, ReceiptGroup } from "./receipt-explorer";
import type { TrackState } from "./workspace/registry";

export const RECEIPT_PAGE_SIZE = 50;

export interface ReceiptTimelineQuery {
  status: "all" | TrackState;
  context: "all" | ReceiptContext;
  page: number;
}

export interface ReceiptTimelinePage {
  entries: readonly ReceiptEntry[];
  paths: readonly ReceiptEntry[];
  groups: readonly ReceiptGroup[];
  totalCount: number;
  filteredCount: number;
  unknownCount: number;
  page: number;
  pageCount: number;
  start: number;
  end: number;
}

/** Only adjudicated evidence enters this presentation projection. Explanations and export stay whole. */
export function buildReceiptTimelinePage(model: ReceiptExplorerModel, query: ReceiptTimelineQuery): ReceiptTimelinePage {
  const all = [...model.paths, ...model.groups.flatMap((group) => group.entries)];
  const matching = all.filter((entry) => (query.status === "all" || entry.status === query.status)
    && (query.context === "all" || entry.context === query.context));
  const pageCount = Math.ceil(matching.length / RECEIPT_PAGE_SIZE);
  const page = pageCount === 0 ? 0 : Math.max(1, Math.min(pageCount, Number.isFinite(query.page) ? Math.trunc(query.page) : 1));
  const offset = Math.max(0, (page - 1) * RECEIPT_PAGE_SIZE);
  const entries = matching.slice(offset, offset + RECEIPT_PAGE_SIZE);
  const visible = new Set(entries);
  return {
    entries,
    paths: model.paths.filter((entry) => visible.has(entry)),
    groups: model.groups.flatMap((group) => {
      const entries = group.entries.filter((entry) => visible.has(entry));
      return entries.length ? [{ ...group, entries }] : [];
    }),
    totalCount: all.length,
    filteredCount: matching.length,
    unknownCount: all.filter((entry) => entry.status === "unknown").length,
    page,
    pageCount,
    start: entries.length ? offset + 1 : 0,
    end: offset + entries.length,
  };
}

/** No mutable sequence, status, or page index participates in receipt identity. */
export function receiptSelectionKey(model: ReceiptExplorerModel, entry: ReceiptEntry): string {
  return JSON.stringify([model.sessionId, model.role, entry.role, entry.context, entry.refId, entry.action, entry.operationId]);
}
