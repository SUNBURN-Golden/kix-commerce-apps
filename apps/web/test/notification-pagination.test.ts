import { describe, expect, it } from "vitest";
import { buildNotificationPage, filterNotificationRows, notificationPageForItem } from "../src/notification-pagination";
import { notificationFixture } from "./support/notification-pagination-fixture";

describe("local notification projection", () => {
  it("preserves every ordered adjudicated row exactly once, including withheld/stale evidence", async () => {
    const fixture = notificationFixture();
    await fixture.controller.read();
    expect(fixture.controller.state().readDetail).toBeNull();
    const rows = fixture.live().model.rows;
    expect(rows).toHaveLength(105);
    expect(rows.some((row) => row.issueState === "stale-issue")).toBe(true);
    expect(rows.some((row) => /withheld/i.test(row.detailLine))).toBe(true);
    for (const filter of ["all", "unread", "read"] as const) {
      const filtered = filterNotificationRows(rows, filter);
      const concatenated = [];
      for (let page = 1; page <= Math.ceil(filtered.length / 20); page++) {
        const view = buildNotificationPage(rows, { filter, page });
        expect(view.rows.length).toBeLessThanOrEqual(20);
        expect(view.totalCount).toBe(105);
        expect(view.filteredCount).toBe(filtered.length);
        expect(view.start).toBe((page - 1) * 20 + 1);
        expect(view.end).toBe(Math.min(page * 20, filtered.length));
        concatenated.push(...view.rows);
      }
      expect(concatenated).toEqual(filtered);
      concatenated.forEach((row, i) => expect(row).toBe(filtered[i]));
    }
    expect(notificationPageForItem(rows, "ntf-0001")).toBe(6);
    expect(notificationPageForItem(rows, "missing")).toBeNull();
    expect(fixture.calls).toEqual({ read: 1, act: 0, inquiry: 0 });
  });
  it("normalizes invalid pages, clamps oversize and uses zero for empty results", async () => {
    const fixture = notificationFixture(41);
    await fixture.controller.read();
    expect(fixture.controller.state().readDetail).toBeNull();
    const rows = fixture.live().model.rows;
    for (const page of [NaN, Infinity, -1, 0, 1.5]) expect(buildNotificationPage(rows, { filter: "all", page }).page).toBe(1);
    expect(buildNotificationPage(rows, { filter: "all", page: 999 }).page).toBe(3);
    expect(buildNotificationPage([], { filter: "all", page: 999 })).toEqual({ rows: [], totalCount: 0, filteredCount: 0, page: 0, pageCount: 0, start: 0, end: 0 });
  });
});
