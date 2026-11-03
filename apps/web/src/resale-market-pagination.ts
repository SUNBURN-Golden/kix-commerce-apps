/** Presentation only: accepted snapshots remain complete and in source order. */
export const MARKET_HISTORY_PAGE_SIZE = 50;

export interface MarketHistoryPage<T> {
  rows: readonly T[];
  totalCount: number;
  page: number;
  pageCount: number;
  start: number;
  end: number;
}

export function buildMarketHistoryPage<T>(records: readonly T[], requestedPage: number): MarketHistoryPage<T> {
  const totalCount = records.length;
  const pageCount = Math.ceil(totalCount / MARKET_HISTORY_PAGE_SIZE);
  const normalized = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const page = pageCount ? Math.min(normalized, pageCount) : 0;
  const offset = Math.max(0, (page - 1) * MARKET_HISTORY_PAGE_SIZE);
  const rows = records.slice(offset, offset + MARKET_HISTORY_PAGE_SIZE);
  return { rows, totalCount, page, pageCount, start: rows.length ? offset + 1 : 0, end: offset + rows.length };
}
