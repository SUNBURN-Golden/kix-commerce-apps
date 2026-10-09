/**
 * Search, filter, sort, page, and scale-window maths.
 * No adapter import and no clock read.
 */

import {
  DISCOVERY_FIXTURE,
  DISCOVERY_KINDS,
  DISCOVERY_STATUSES,
  FIXTURE_NOW,
  SCALE_OVERSCAN,
  SCALE_ROW_HEIGHT,
  SCALE_TOTAL,
  SCALE_VIEWPORT_HEIGHT,
  STALE_AFTER_MS,
  SYNTHETIC_TIERS,
  scaleRowAt,
  type DiscoveryKind,
  type DiscoveryRow,
  type DiscoveryStatus,
  type SyntheticTier,
} from "./fixture";

export { SCALE_TOTAL, SCALE_VIEWPORT_HEIGHT, SCALE_ROW_HEIGHT, SCALE_OVERSCAN };

export const PAGE_SIZES = [10, 20, 50] as const;

export type PageSize = (typeof PAGE_SIZES)[number];

export const DISCOVERY_SORTS = ["date-asc", "date-desc", "tier-asc", "tier-desc", "title"] as const;

export type DiscoverySort = (typeof DISCOVERY_SORTS)[number];

export interface DiscoveryQuery {
  readonly text: string;
  readonly kinds: readonly DiscoveryKind[];
  readonly statuses: readonly DiscoveryStatus[];
  readonly tiers: readonly SyntheticTier[];
  readonly section: string;
  readonly from: string;
  readonly to: string;
  readonly purchasableOnly: boolean;
  readonly sort: DiscoverySort;
  readonly page: number;
  readonly pageSize: PageSize;
}

export const DEFAULT_DISCOVERY_QUERY: DiscoveryQuery = {
  text: "",
  kinds: [],
  statuses: [],
  tiers: [],
  section: "",
  from: "",
  to: "",
  purchasableOnly: false,
  sort: "date-asc",
  page: 1,
  pageSize: 20,
};

export const CONFLICT_CODES = ["ga-section", "cancelled-purchasable", "from-after-to"] as const;

export type ConflictCode = (typeof CONFLICT_CODES)[number];

export interface DiscoveryConflict {
  code: ConflictCode;
  message: string;
}

export type DiscoveryResultState = "ready" | "empty" | "filter-conflict";

export interface DiscoveryPageResult {
  state: DiscoveryResultState;
  rows: DiscoveryRow[];
  totalMatching: number;
  ofFixtureRows: number;
  page: number;
  pageCount: number;
  conflicts: DiscoveryConflict[];
}

export interface RowFacts {
  kindLine: string;
  inventoryLine: string | null;
  countLine: string | null;
  tierLine: string | null;
  resaleLine: string | null;
  statusLine: string;
  stale: boolean;
}

export interface ScaleWindow {
  start: number;
  end: number;
  rows: DiscoveryRow[];
}

export interface ScaleKeyState {
  scrollTop: number;
  focus: number;
  open: boolean;
}

const SCALE_ID = /^scale-(0|[1-9][0-9]*)$/;

export function isDiscoverySort(value: string): value is DiscoverySort {
  return (DISCOVERY_SORTS as readonly string[]).includes(value);
}

export function isPageSize(value: number): value is PageSize {
  return value === 10 || value === 20 || value === 50;
}

export function isPriceStale(priceAsOf: string, now = FIXTURE_NOW): boolean {
  const asOf = Date.parse(priceAsOf);
  const current = Date.parse(now);
  if (Number.isNaN(asOf) || Number.isNaN(current)) {
    return false;
  }
  return current - asOf > STALE_AFTER_MS;
}

export function describeRow(row: DiscoveryRow, now = FIXTURE_NOW): RowFacts {
  const tierLine = row.syntheticTier === null ? null : `synthetic tier ${row.syntheticTier}`;
  const countLine =
    row.kind === "event" || row.syntheticCount === null ? null : `synthetic count ${row.syntheticCount}`;
  let inventoryLine: string | null = null;
  if (row.kind === "seat") {
    inventoryLine = `section ${row.section ?? ""}`;
  } else if (row.kind === "ga") {
    inventoryLine = "no seat assigned";
  }
  return {
    kindLine: `kind ${row.kind}`,
    inventoryLine,
    countLine,
    tierLine,
    resaleLine: row.kind === "resale" ? "listing (synthetic)" : null,
    statusLine: `${row.status} (synthetic)`,
    stale: isPriceStale(row.priceAsOf, now),
  };
}

export function detectConflicts(query: DiscoveryQuery): DiscoveryConflict[] {
  const conflicts: DiscoveryConflict[] = [];
  const section = query.section.trim();
  if (section.length > 0 && query.kinds.length === 1 && query.kinds[0] === "ga") {
    conflicts.push({ code: "ga-section", message: "A GA kind cannot take a section." });
  }
  if (query.purchasableOnly && query.statuses.length === 1 && query.statuses[0] === "cancelled") {
    conflicts.push({
      code: "cancelled-purchasable",
      message: "Cancelled status cannot combine with purchasable only.",
    });
  }
  const fromMs = boundMs(query.from);
  const toMs = boundMs(query.to);
  if (fromMs !== null && toMs !== null && fromMs > toMs) {
    conflicts.push({ code: "from-after-to", message: "The from date is after the to date." });
  }
  return conflicts;
}

export function applyConflictClear(query: DiscoveryQuery, code: ConflictCode): DiscoveryQuery {
  if (code === "ga-section") {
    return { ...query, section: "", page: 1 };
  }
  if (code === "cancelled-purchasable") {
    return { ...query, purchasableOnly: false, page: 1 };
  }
  return { ...query, from: "", to: "", page: 1 };
}

export function clearFilters(query: DiscoveryQuery): DiscoveryQuery {
  return {
    ...DEFAULT_DISCOVERY_QUERY,
    sort: query.sort,
    pageSize: query.pageSize,
  };
}

export function withFilter(query: DiscoveryQuery, patch: Partial<DiscoveryQuery>): DiscoveryQuery {
  return {
    ...query,
    ...patch,
    page: patch.page ?? 1,
  };
}

export function toggleValue<T extends string>(values: readonly T[], value: T, order: readonly T[]): T[] {
  const next = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  return order.filter((item) => next.includes(item));
}

export function runDiscoveryQuery(
  query: DiscoveryQuery,
  rows: readonly DiscoveryRow[] = DISCOVERY_FIXTURE,
): DiscoveryPageResult {
  const conflicts = detectConflicts(query);
  if (conflicts.length > 0) {
    return {
      state: "filter-conflict",
      rows: [],
      totalMatching: 0,
      ofFixtureRows: rows.length,
      page: query.page,
      pageCount: 0,
      conflicts,
    };
  }
  const matched = rows.filter((row) => matches(query, row));
  const sorted = [...matched].sort((left, right) => compareRows(query.sort, left, right));
  const pageCount = sorted.length === 0 ? 0 : Math.ceil(sorted.length / query.pageSize);
  const start = (query.page - 1) * query.pageSize;
  const slice = start >= sorted.length || start < 0 ? [] : sorted.slice(start, start + query.pageSize);
  return {
    state: sorted.length === 0 ? "empty" : "ready",
    rows: slice,
    totalMatching: sorted.length,
    ofFixtureRows: rows.length,
    page: query.page,
    pageCount,
    conflicts: [],
  };
}

export function windowRange(input: {
  total: number;
  rowHeight: number;
  viewportHeight: number;
  scrollTop: number;
  overscan: number;
}): { start: number; end: number } {
  const total = Math.max(0, Math.floor(input.total));
  if (total === 0 || input.rowHeight <= 0) {
    return { start: 0, end: 0 };
  }
  const visible = Math.max(1, Math.ceil(input.viewportHeight / input.rowHeight));
  const overscan = Math.max(0, Math.floor(input.overscan));
  const scrollTop = Number.isFinite(input.scrollTop) ? Math.max(0, input.scrollTop) : 0;
  const first = Math.min(total - 1, Math.floor(scrollTop / input.rowHeight));
  const start = Math.max(0, first - Math.floor(overscan / 2));
  const end = Math.min(total, start + visible + overscan);
  return { start, end };
}

export function maxScaleScroll(viewportHeight = SCALE_VIEWPORT_HEIGHT): number {
  const visible = Math.max(1, Math.ceil(viewportHeight / SCALE_ROW_HEIGHT));
  return Math.max(0, (SCALE_TOTAL - visible) * SCALE_ROW_HEIGHT);
}

export function scaleWindow(input: {
  scrollTop: number;
  viewportHeight?: number;
  rowAt?: (index: number) => DiscoveryRow;
}): ScaleWindow {
  const viewportHeight = input.viewportHeight ?? SCALE_VIEWPORT_HEIGHT;
  const range = windowRange({
    total: SCALE_TOTAL,
    rowHeight: SCALE_ROW_HEIGHT,
    viewportHeight,
    scrollTop: input.scrollTop,
    overscan: SCALE_OVERSCAN,
  });
  const rowAt = input.rowAt ?? scaleRowAt;
  const rows: DiscoveryRow[] = [];
  for (let index = range.start; index < range.end; index += 1) {
    rows.push(rowAt(index));
  }
  return { start: range.start, end: range.end, rows };
}

export function findDiscoveryRow(rowId: string, rows: readonly DiscoveryRow[] = DISCOVERY_FIXTURE): DiscoveryRow | null {
  const found = rows.find((row) => row.rowId === rowId);
  if (found) {
    return found;
  }
  const match = SCALE_ID.exec(rowId);
  if (!match?.[1]) {
    return null;
  }
  const index = Number(match[1]);
  if (!Number.isSafeInteger(index) || index < 0 || index >= SCALE_TOTAL) {
    return null;
  }
  return scaleRowAt(index);
}

export function moveListFocus(index: number, key: string, count: number, windowStep: number): number {
  if (count <= 0) {
    return 0;
  }
  const current = Math.min(count - 1, Math.max(0, index));
  const step = Math.max(1, windowStep);
  if (key === "ArrowDown") {
    return Math.min(count - 1, current + 1);
  }
  if (key === "ArrowUp") {
    return Math.max(0, current - 1);
  }
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return count - 1;
  }
  if (key === "PageDown") {
    return Math.min(count - 1, current + step);
  }
  if (key === "PageUp") {
    return Math.max(0, current - step);
  }
  return current;
}

export function isListKey(key: string): boolean {
  return (
    key === "ArrowDown" ||
    key === "ArrowUp" ||
    key === "Home" ||
    key === "End" ||
    key === "PageDown" ||
    key === "PageUp" ||
    key === "Enter"
  );
}

export function applyPageKey(index: number, key: string, count: number): { index: number; open: boolean } {
  if (count <= 0) {
    return { index: 0, open: false };
  }
  const current = Math.min(count - 1, Math.max(0, index));
  if (key === "Enter") {
    return { index: current, open: true };
  }
  const step = Math.max(1, Math.min(10, count));
  return { index: moveListFocus(current, key, count, step), open: false };
}

export function applyScaleKey(
  state: { scrollTop: number; focus: number },
  key: string,
  viewportHeight = SCALE_VIEWPORT_HEIGHT,
): ScaleKeyState {
  const current = scaleWindow({ scrollTop: state.scrollTop, viewportHeight });
  const step = Math.max(1, Math.ceil(viewportHeight / SCALE_ROW_HEIGHT));
  if (key === "Enter") {
    return {
      scrollTop: state.scrollTop,
      focus: clampFocus(state.focus, current),
      open: current.rows.length > 0,
    };
  }
  if (key === "Home") {
    return { scrollTop: 0, focus: 0, open: false };
  }
  if (key === "End") {
    const scrollTop = maxScaleScroll(viewportHeight);
    const tail = scaleWindow({ scrollTop, viewportHeight });
    return { scrollTop, focus: Math.max(0, tail.end - 1), open: false };
  }
  if (key === "PageDown") {
    const scrollTop = Math.min(maxScaleScroll(viewportHeight), state.scrollTop + viewportHeight);
    const next = scaleWindow({ scrollTop, viewportHeight });
    return { scrollTop, focus: next.start, open: false };
  }
  if (key === "PageUp") {
    const scrollTop = Math.max(0, state.scrollTop - viewportHeight);
    const next = scaleWindow({ scrollTop, viewportHeight });
    return { scrollTop, focus: next.start, open: false };
  }
  if (key === "ArrowDown" || key === "ArrowUp") {
    const local = clampFocus(state.focus, current) - current.start;
    const moved = moveListFocus(local, key, current.end - current.start, step);
    return { scrollTop: state.scrollTop, focus: current.start + moved, open: false };
  }
  return { scrollTop: state.scrollTop, focus: clampFocus(state.focus, current), open: false };
}

export function queryFromParams(params: URLSearchParams): DiscoveryQuery {
  const pageRaw = Number(params.get("page"));
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  const pageSizeRaw = Number(params.get("pageSize"));
  const sortRaw = params.get("sort") ?? "";
  return {
    text: params.get("q") ?? "",
    kinds: parseList(params.get("kinds"), DISCOVERY_KINDS),
    statuses: parseList(params.get("statuses"), DISCOVERY_STATUSES),
    tiers: parseList(params.get("tiers"), SYNTHETIC_TIERS),
    section: params.get("section") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    purchasableOnly: params.get("purchasable") === "1",
    sort: isDiscoverySort(sortRaw) ? sortRaw : "date-asc",
    page,
    pageSize: isPageSize(pageSizeRaw) ? pageSizeRaw : 20,
  };
}

export function paramsFromQuery(query: DiscoveryQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.text.length > 0) {
    params.set("q", query.text);
  }
  const kinds = DISCOVERY_KINDS.filter((kind) => query.kinds.includes(kind));
  if (kinds.length > 0) {
    params.set("kinds", kinds.join(","));
  }
  const statuses = DISCOVERY_STATUSES.filter((status) => query.statuses.includes(status));
  if (statuses.length > 0) {
    params.set("statuses", statuses.join(","));
  }
  const tiers = SYNTHETIC_TIERS.filter((tier) => query.tiers.includes(tier));
  if (tiers.length > 0) {
    params.set("tiers", tiers.join(","));
  }
  if (query.section.length > 0) {
    params.set("section", query.section);
  }
  if (query.from.length > 0) {
    params.set("from", query.from);
  }
  if (query.to.length > 0) {
    params.set("to", query.to);
  }
  if (query.purchasableOnly) {
    params.set("purchasable", "1");
  }
  if (query.sort !== "date-asc") {
    params.set("sort", query.sort);
  }
  if (query.page !== 1) {
    params.set("page", String(query.page));
  }
  if (query.pageSize !== 20) {
    params.set("pageSize", String(query.pageSize));
  }
  return params;
}

export function searchSuffix(params: URLSearchParams): string {
  const text = params.toString();
  return text.length > 0 ? `?${text}` : "";
}

function matches(query: DiscoveryQuery, row: DiscoveryRow): boolean {
  const needle = query.text.trim().toLowerCase();
  if (needle.length > 0) {
    const hay = `${row.title} ${row.venueLabel} ${row.rowId}`.toLowerCase();
    if (!hay.includes(needle)) {
      return false;
    }
  }
  if (query.kinds.length > 0 && !query.kinds.includes(row.kind)) {
    return false;
  }
  if (query.statuses.length > 0 && !query.statuses.includes(row.status)) {
    return false;
  }
  if (query.tiers.length > 0 && (row.syntheticTier === null || !query.tiers.includes(row.syntheticTier))) {
    return false;
  }
  const section = query.section.trim();
  if (section.length > 0 && row.section !== section) {
    return false;
  }
  if (query.purchasableOnly && row.status !== "on-sale") {
    return false;
  }
  const from = startBound(query.from);
  if (from !== null && row.startsAt < from) {
    return false;
  }
  const to = endBound(query.to);
  if (to !== null && row.startsAt > to) {
    return false;
  }
  return true;
}

function compareRows(sort: DiscoverySort, left: DiscoveryRow, right: DiscoveryRow): number {
  let primary = 0;
  if (sort === "date-asc" || sort === "date-desc") {
    primary = left.startsAt < right.startsAt ? -1 : left.startsAt > right.startsAt ? 1 : 0;
    if (sort === "date-desc") {
      primary = -primary;
    }
  } else if (sort === "title") {
    primary = left.title < right.title ? -1 : left.title > right.title ? 1 : 0;
  } else {
    const leftNull = left.syntheticTier === null;
    const rightNull = right.syntheticTier === null;
    if (leftNull || rightNull) {
      primary = tierKey(left.syntheticTier) - tierKey(right.syntheticTier);
    } else {
      primary = tierKey(left.syntheticTier) - tierKey(right.syntheticTier);
      if (sort === "tier-desc") {
        primary = -primary;
      }
    }
  }
  if (primary !== 0) {
    return primary;
  }
  return left.rowId < right.rowId ? -1 : left.rowId > right.rowId ? 1 : 0;
}

function tierKey(tier: SyntheticTier | null): number {
  if (tier === "T1") {
    return 1;
  }
  if (tier === "T2") {
    return 2;
  }
  if (tier === "T3") {
    return 3;
  }
  return 99;
}

function parseList<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) {
    return [];
  }
  const wanted = new Set(
    raw
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0),
  );
  return allowed.filter((item) => wanted.has(item));
}

function boundMs(value: string): number | null {
  const bound = startBound(value);
  if (bound === null) {
    return null;
  }
  const ms = Date.parse(bound);
  return Number.isNaN(ms) ? null : ms;
}

function startBound(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00.000Z`;
  }
  if (Number.isNaN(Date.parse(trimmed))) {
    return null;
  }
  return trimmed;
}

function endBound(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T23:59:59.999Z`;
  }
  if (Number.isNaN(Date.parse(trimmed))) {
    return null;
  }
  return trimmed;
}

function clampFocus(focus: number, windowed: { start: number; end: number }): number {
  if (windowed.end <= windowed.start) {
    return windowed.start;
  }
  if (focus < windowed.start) {
    return windowed.start;
  }
  if (focus >= windowed.end) {
    return windowed.end - 1;
  }
  return focus;
}
