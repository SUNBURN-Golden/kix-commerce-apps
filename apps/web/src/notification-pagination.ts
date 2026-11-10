import type { NotifyRowModel } from "./notification-inbox";
import { messages } from "./i18n/messages/notification-inbox";

export const NOTIFICATION_PAGE_SIZE = 20;
export type NotificationFilter = "all" | "unread" | "read";

export interface NotificationPage {
  rows: readonly NotifyRowModel[];
  totalCount: number;
  filteredCount: number;
  page: number;
  pageCount: number;
  start: number;
  end: number;
}

/** Canonical model words, before translation. Only adjudicated row references enter this projection. */
export function filterNotificationRows(rows: readonly NotifyRowModel[], filter: NotificationFilter): readonly NotifyRowModel[] {
  return filter === "all" ? rows : rows.filter((row) => row.readWord === messages.en[filter === "read" ? "s1av" : "s25j"]);
}

export function buildNotificationPage(rows: readonly NotifyRowModel[], query: { filter: NotificationFilter; page: number }): NotificationPage {
  const filtered = filterNotificationRows(rows, query.filter);
  const pageCount = Math.ceil(filtered.length / NOTIFICATION_PAGE_SIZE);
  const requested = Number.isInteger(query.page) && query.page > 0 ? query.page : 1;
  const page = pageCount ? Math.min(pageCount, requested) : 0;
  const offset = Math.max(0, (page - 1) * NOTIFICATION_PAGE_SIZE);
  const slice = filtered.slice(offset, offset + NOTIFICATION_PAGE_SIZE);
  return { rows: slice, totalCount: rows.length, filteredCount: filtered.length, page, pageCount,
    start: slice.length ? offset + 1 : 0, end: offset + slice.length };
}

export function notificationPageForItem(filteredRows: readonly NotifyRowModel[], notificationRef?: string): number | null {
  const index = filteredRows.findIndex((row) => row.notificationRef === notificationRef);
  return index < 0 ? null : Math.floor(index / NOTIFICATION_PAGE_SIZE) + 1;
}
