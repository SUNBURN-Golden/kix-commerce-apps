// @vitest-environment jsdom
import { act, useEffect, useState, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { NotificationInboxController, createNotBoundNotificationInbox, NOTIFY_BUYER_ACTOR } from "@kix/protocol-adapter";
import { buildNotifyModel } from "../src/notification-inbox";
import { NotificationsScreen } from "../src/pages/Notifications";
import { LocaleContext, stateFor } from "../src/i18n/locale-context";
import { notificationFixture } from "./support/notification-pagination-fixture";
import { renderRoute as renderRouted } from "./support/render-route";
import { button, change, click, element } from "./support/render-dom";

// Keep the router mounted when a controlled model or locale changes.
async function renderRoute(node: ReactNode, entry: string) {
  let update: (node: ReactNode) => void = () => {};
  function Current() {
    const [current, setCurrent] = useState(node);
    update = setCurrent;
    return current;
  }
  const view = await renderRouted(<Current />, entry);
  return { ...view, rerender: async (next: ReactNode) => { await act(async () => update(next)); } };
}

type Fixture = ReturnType<typeof notificationFixture>;
function Screen({ fixture, locale = "en" }: { fixture: Fixture; locale?: "en" | "ko" }) {
  const [, tick] = useState(0);
  useEffect(() => fixture.controller.subscribe(() => tick((value) => value + 1)), [fixture]);
  return <LocaleContext.Provider value={stateFor(locale, () => {})}><NotificationsScreen live={fixture.live()} /></LocaleContext.Provider>;
}
const ids = (container: ParentNode, table = false) => Array.from(container.querySelectorAll(table ? "[data-notification-row]" : "[data-notification]"), (row) => row.getAttribute(table ? "data-notification-row" : "data-notification"));
const status = (container: ParentNode) => element(container, "#notify-page-status");
async function filter(container: ParentNode, value: string) {
  await change(element<HTMLSelectElement>(container, "#read-filter"), value);
  await click(element(container, "#read-apply-filter"));
}
async function readSize(fixture: Fixture, size: number) {
  await act(async () => { fixture.resize(size); await fixture.controller.read(); });
}

describe("notification pages on the real screen", () => {
  it("renders the identical bounded action/table slice without omissions or source calls", async () => {
    const fixture = notificationFixture(); await fixture.controller.read();
    const view = await renderRoute(<Screen fixture={fixture} />, "/notifications");
    expect(status(view.container).getAttribute("aria-live")).toBe("off");
    const seen = [];
    const unread = element(view.container, "[data-unread-line]").textContent;
    for (let page = 1; page <= 6; page++) {
      expect(ids(view.container)).toEqual(ids(view.container, true));
      expect(ids(view.container)).toHaveLength(page === 6 ? 5 : 20);
      seen.push(...ids(view.container));
      expect(element(view.container, "[data-unread-line]").textContent).toBe(unread);
      if (page < 6) await click(button(view.container, "Next"));
    }
    expect(seen).toEqual(fixture.live().model.rows.map((row) => row.notificationRef));
    expect(status(view.container).textContent).toContain("101–105 of 105 matching; 105 total. Page 6 of 6.");
    await click(button(view.container, "Next"));
    expect(ids(view.container)).toHaveLength(5);
    expect(status(view.container).getAttribute("aria-live")).toBe("polite");
    await click(button(view.container, "First"));
    for (const value of ["unread", "read"] as const) {
      await filter(view.container, value);
      expect(ids(view.container)).toHaveLength(20);
      expect(ids(view.container)).toEqual(ids(view.container, true));
      expect(element(view.container, "[data-unread-line]").textContent).toBe(unread);
      expect(element(view.container, "#notify-inbox").getAttribute("data-filtered-count")).toBe(String(value === "unread" ? 70 : 35));
      expect(view.container.querySelector(`[data-notification-read="${value === "read" ? "false" : "true"}"]`)).toBeNull();
    }
    expect(fixture.calls).toEqual({ read: 1, act: 0, inquiry: 0 });
  });

  it("restores deep links after deferred membership; pager can leave selection until a URL visit or membership change", async () => {
    const fixture = notificationFixture();
    const view = await renderRoute(<Screen fixture={fixture} />, "/notifications?filter=all&item=ntf-0001");
    expect(view.router.state.location.search).toContain("item=ntf-0001");
    await act(async () => { await fixture.controller.read(); });
    expect(status(view.container).textContent).toContain("Page 6 of 6");
    expect(element(view.container, '[data-read-selected="true"]').getAttribute("data-notification")).toBe("ntf-0001");
    await click(button(view.container, "First"));
    await view.rerender(<Screen fixture={fixture} />);
    expect(status(view.container).textContent).toContain("Page 1 of 6");
    await filter(view.container, "unread");
    expect(view.router.state.historyAction).toBe("PUSH");
    expect(view.router.state.location.search).not.toContain("item=");
    await act(async () => { await view.router.navigate(-1); });
    expect(status(view.container).textContent).toContain("Page 6 of 6");
    await act(async () => { await view.router.navigate(1); });
    expect(status(view.container).textContent).toContain("Page 1 of 4");
    await click(element(view.container, '[data-read-choice="item"]'));
    expect(view.router.state.historyAction).toBe("REPLACE");
    expect(fixture.calls).toEqual({ read: 1, act: 0, inquiry: 0 });
  });

  it("cleans initially invalid/filtered-out links and does not rewrite a previously valid removed item's URL", async () => {
    for (const item of ["missing", "ntf-1001"]) {
      const fixture = notificationFixture(); await fixture.controller.read();
      const view = await renderRoute(<Screen fixture={fixture} />, `/notifications?filter=unread&item=${item}`);
      expect(view.router.state.location.search).toBe("?filter=unread");
      expect(view.container.querySelector("[data-read-notice]")).not.toBeNull();
    }
    const fixture = notificationFixture(); await fixture.controller.read();
    const view = await renderRoute(<Screen fixture={fixture} />, "/notifications?item=ntf-1100");
    await readSize(fixture, 20);
    expect(view.router.state.location.search).toBe("?item=ntf-1100");
    expect(view.container.querySelector('[data-read-selected="true"]')).toBeNull();
    expect(status(view.container).textContent).toContain("Page 1 of 1");
  });

  it("restores selection on ordered membership changes but leaves an explicit page alone on a same-membership read", async () => {
    const fixture = notificationFixture(); await fixture.controller.read();
    const view = await renderRoute(<Screen fixture={fixture} />, "/notifications?item=ntf-0001");
    await click(button(view.container, "First"));
    await act(async () => { await fixture.controller.read(); });
    // A fresh model with identical membership must not undo explicit paging.
    expect(status(view.container).textContent).toContain("Page 1 of 6");
    await click(button(view.container, "Last"));
    await act(async () => { fixture.reverse(); await fixture.controller.read(); });
    expect(status(view.container).textContent).toContain("Page 1 of 6");
    expect(element(view.container, '[data-read-selected="true"]').getAttribute("data-notification")).toBe("ntf-0001");
  });

  it("does not pull an explicit page back when a delayed read returns unchanged membership", async () => {
    const fixture = notificationFixture(); await fixture.controller.read();
    const live = fixture.live();
    const view = await renderRoute(<NotificationsScreen live={live} />, "/notifications?item=ntf-0001");
    await click(button(view.container, "First"));
    await view.rerender(<NotificationsScreen live={{ ...live, model: { ...live.model, state: "loading" } }} />);
    await view.rerender(<NotificationsScreen live={fixture.live()} />);
    expect(status(view.container).textContent).toContain("Page 1 of 6");
    // A cleared view, unlike a retained pending read, must restore the valid URL selection.
    await view.rerender(<NotificationsScreen live={{ ...live, model: { ...live.model, state: "loading", rows: [] } }} />);
    expect(ids(view.container)).toHaveLength(0);
    await view.rerender(<NotificationsScreen live={fixture.live()} />);
    expect(status(view.container).textContent).toContain("Page 6 of 6");
    expect(element(view.container, '[data-read-selected="true"]').getAttribute("data-notification")).toBe("ntf-0001");
  });

  it("keeps the real not-bound controller closed under pagination and filtering", async () => {
    const fixture = notificationFixture();
    const controller = new NotificationInboxController(createNotBoundNotificationInbox(), { actorRef: NOTIFY_BUYER_ACTOR, role: "buyer" });
    await controller.read();
    const model = buildNotifyModel({ controller, last: null });
    const view = await renderRoute(<NotificationsScreen live={{ ...fixture.live(), environment: "integration-http", model }} />, "/notifications");
    await click(button(view.container, "Last")); await filter(view.container, "unread");
    expect(model.state).toBe("not-bound");
    expect(ids(view.container)).toHaveLength(0);
    expect(controller.canSend("mark-read").allowed).toBe(false);
    expect(controller.canSend("resolve").allowed).toBe(false);
    expect(controller.state().counters).toEqual(expect.objectContaining({ acts: 0 }));
  });

  it("commits clamping through 41→20→0→21 and does not resurrect an old page", async () => {
    const fixture = notificationFixture(41); await fixture.controller.read();
    const view = await renderRoute(<Screen fixture={fixture} />, "/notifications");
    await click(button(view.container, "Last"));
    expect(status(view.container).textContent).toContain("Page 3 of 3");
    for (const size of [20, 0, 21]) {
      await readSize(fixture, size);
      expect(ids(view.container)).toHaveLength(Math.min(size, 20));
      expect(ids(view.container)).toEqual(ids(view.container, true));
      expect(status(view.container).textContent).toContain(size ? `Page 1 of ${Math.ceil(size / 20)}` : "0–0 of 0 matching; 0 total. Page 0 of 0");
    }
  });

  it("marks the last unread row once, retains the snapshot until explicit refresh, clamps and recovers lost row focus", async () => {
    const fixture = notificationFixture(21, "clean", true); await fixture.controller.read();
    const view = await renderRoute(<Screen fixture={fixture} />, "/notifications?filter=unread");
    await click(button(view.container, "Last"));
    const mark = element(view.container, "#notify-mark-ntf-0001"); mark.focus();
    await click(mark);
    expect(fixture.calls).toEqual({ read: 1, act: 1, inquiry: 0 });
    expect(ids(view.container)).toEqual(["ntf-0001"]);
    expect(fixture.controller.state().behind).toBe(true);
    await act(async () => { await fixture.controller.read(); });
    expect(ids(view.container)).toHaveLength(20);
    expect(status(view.container).textContent).toContain("Page 1 of 1");
    expect(document.activeElement).toBe(status(view.container));
    // Empty filtered results after the same real action on a single unread row.
    const single = notificationFixture(1, "clean", true); await single.controller.read();
    const empty = await renderRoute(<Screen fixture={single} />, "/notifications?filter=unread");
    await click(element(empty.container, "#notify-mark-ntf-0001"));
    await click(element(empty.container, "#notify-refresh"));
    expect(status(empty.container).textContent).toContain("0–0 of 0 matching; 1 total. Page 0 of 0");
    expect(empty.container.textContent).toContain("No notifications match this filter.");
  });

  it("preserves surviving/external focus and gives attention status precedence", async () => {
    const fixture = notificationFixture(41); await fixture.controller.read();
    let live = fixture.live();
    const view = await renderRoute(<NotificationsScreen live={live} />, "/notifications");
    const survivor = element(view.container, '[data-read-choice="item"]'); survivor.focus();
    await act(async () => { fixture.resize(20); await fixture.controller.read(); });
    live = fixture.live(); await view.rerender(<NotificationsScreen live={live} />);
    expect(document.activeElement).toBe(survivor);
    const outside = element(view.container, "#notify-refresh"); outside.focus();
    await view.rerender(<NotificationsScreen live={{ ...live, model: { ...live.model, rows: [] } }} />);
    expect(document.activeElement).toBe(outside);
    await view.rerender(<NotificationsScreen live={live} />);
    element(view.container, '[data-read-choice="item"]').focus();
    await view.rerender(<NotificationsScreen live={{ ...live, model: { ...live.model, rows: [], focusToken: "test-attention" } }} />);
    expect(document.activeElement?.id).toBe("notify-status");
    expect(status(view.container).getAttribute("aria-live")).toBe("off");
    await view.rerender(<NotificationsScreen live={{ ...live, model: { ...live.model, focusToken: "test-attention" } }} />);
    expect(status(view.container).getAttribute("aria-live")).toBe("polite");
  });

  it("keeps interim cleared reads and attention quiet, then announces paging retained UNKNOWN rows", async () => {
    const fixture = notificationFixture(105, "act-lost"); await fixture.controller.read();
    let live = fixture.live();
    const view = await renderRoute(<NotificationsScreen live={live} />, "/notifications");
    await view.rerender(<NotificationsScreen live={{ ...live, model: { ...live.model, state: "loading", rows: [] } }} />);
    expect(status(view.container).getAttribute("aria-live")).toBe("off");
    await act(async () => { await fixture.controller.markRead("ntf-0001"); });
    live = fixture.live();
    live.model.focusToken = "unknown-attention";
    await view.rerender(<NotificationsScreen live={live} />);
    expect(status(view.container).getAttribute("aria-live")).toBe("off");
    await click(button(view.container, "Next"));
    expect(status(view.container).getAttribute("aria-live")).toBe("polite");
    expect(status(view.container).textContent).toContain("Page 2 of 6");
    await view.rerender(<NotificationsScreen live={{ ...live, model: { ...live.model, state: "denied", rows: [], focusToken: "denied-attention" } }} />);
    expect(status(view.container).getAttribute("aria-live")).toBe("off");
    expect(fixture.calls).toEqual({ read: 1, act: 1, inquiry: 0 });
  });

  it("uses ko/en announcements without changing canonical filtering", async () => {
    const fixture = notificationFixture(); await fixture.controller.read();
    const view = await renderRoute(<Screen fixture={fixture} locale="ko" />, "/notifications?filter=unread&lang=ko");
    const before = ids(view.container);
    expect(status(view.container).textContent).toContain("일치 70개 중 1–20; 전체 105개. 1/4 페이지.");
    await click(button(view.container, "다음"));
    expect(status(view.container).textContent).toContain("21–40");
    await click(button(view.container, "처음"));
    await view.rerender(<Screen fixture={fixture} locale="en" />);
    expect(ids(view.container)).toEqual(before);
    expect(status(view.container).textContent).toContain("1–20 of 70 matching; 105 total. Page 1 of 4.");
    expect(fixture.calls.act).toBe(0);
  });

  it.each(["act-lost", "grant-rotated", "late", "denied"] as const)("keeps real %s guards across presentation changes", async (scenario) => {
    const fixture = notificationFixture(41, scenario); await fixture.controller.read();
    if (scenario === "act-lost") { await fixture.controller.markRead("ntf-0001"); }
    if (scenario === "grant-rotated") {
      fixture.source.synthetic("rotate-grant", fixture.controller.state().snapshot?.grantRef);
      await fixture.controller.markRead("ntf-0001");
    }
    const before = fixture.live().model;
    const calls = { ...fixture.calls };
    const view = await renderRoute(<Screen fixture={fixture} />, "/notifications");
    await click(button(view.container, "Last")); await click(button(view.container, "First"));
    await filter(view.container, "unread");
    const after = fixture.live().model;
    expect(after.markBlock).toBe(before.markBlock);
    expect(after.resolveBlock).toBe(before.resolveBlock);
    expect(after.rows).toEqual(before.rows);
    expect(fixture.calls).toEqual(calls);
    for (const control of Array.from(view.container.querySelectorAll<HTMLButtonElement>('[id^="notify-mark-"], [id^="notify-resolve-"]'))) {
      if (control.getAttribute("aria-disabled") === "true") await click(control);
    }
    expect(fixture.calls).toEqual(calls);
  });
});
