// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { MobileShellController, StubMobileShell, type MobileReadOutcome, type MobileWriteOutcome } from "@kix/protocol-adapter";
import { InstallableMobilePage } from "../src/pages/InstallableMobile";
import { LocaleProvider } from "../src/i18n/LocaleProvider";
import { useMobileShell } from "../src/installable-mobile";
import { MobileControls, MobileStatus } from "../src/pages/InstallableMobilePanels";
import { change, click, dispatch, element, renderDom } from "./support/render-dom";

const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");
let visibility: DocumentVisibilityState = "visible";
const originalRead = StubMobileShell.prototype.read;
const originalSubmit = StubMobileShell.prototype.submit;
const reads = () => vi.spyOn(StubMobileShell.prototype, "read");
const submits = () => vi.spyOn(StubMobileShell.prototype, "submit");

beforeEach(() => {
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  Object.defineProperty(document, "hidden", { configurable: true, get: () => visibility === "hidden" });
});
afterEach(() => {
  if (visibilityDescriptor) Object.defineProperty(document, "visibilityState", visibilityDescriptor);
  else Reflect.deleteProperty(document, "visibilityState");
  if (hiddenDescriptor) Object.defineProperty(document, "hidden", hiddenDescriptor);
  else Reflect.deleteProperty(document, "hidden");
});
async function visible(next: DocumentVisibilityState) {
  visibility = next;
  await dispatch(document, new Event("visibilitychange"));
}
async function show(persisted = true) {
  const event = new Event("pageshow");
  Object.defineProperty(event, "persisted", { value: persisted });
  await dispatch(window, event);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function open() { return renderDom(<MemoryRouter><InstallableMobilePage /></MemoryRouter>); }
async function press(container: HTMLElement, id: string) { await click(element(container, `#mobile-${id}`)); }
async function scenario(container: HTMLElement, next: string) {
  await change(element<HTMLSelectElement>(container, "#mobile-scenario"), next);
}
function stale(container: HTMLElement) {
  expect(element(container, "#mobile-status").textContent).toContain("STALE");
  expect(element(container, "#mobile-status").textContent).toContain("actual browser restoration is unverified");
  for (const node of Array.from(container.querySelectorAll<HTMLButtonElement>("[data-enabled]"))) {
    expect(node.dataset.enabled, node.id).toBe("false");
    expect(node.getAttribute("aria-describedby"), node.id).toBeTruthy();
  }
}

describe("mobile browser lifecycle fence (synthetic DOM events)", () => {
  it("invalidates hidden and foreground edges, retains cached rows, ignores redundant events and pairs pageshow across a user read", async () => {
    const read = reads(); const submit = submits();
    const { container } = await open();
    expect(read).toHaveBeenCalledTimes(1);
    await visible("hidden"); stale(container);
    expect(element(container, "#mobile-vault").textContent).toContain("cached copy");
    await visible("hidden"); await visible("visible"); await visible("visible"); await show(false);
    stale(container);
    expect(read).toHaveBeenCalledTimes(1); expect(submit).not.toHaveBeenCalled();
    await press(container, "refresh");
    expect(element(container, "#mobile-confirm-ord-0001").getAttribute("data-enabled")).toBe("true");
    await show(); // same foreground restoration, even though a read has already landed
    await visible("visible");
    expect(element(container, "#mobile-confirm-ord-0001").getAttribute("data-enabled")).toBe("true");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("persisted pageshow without hidden invalidates, ordinary pageshow and repeated events send nothing", async () => {
    const read = reads(); const submit = submits();
    const { container } = await open();
    await show(false);
    expect(element(container, "#mobile-confirm-ord-0001").dataset.enabled).toBe("true");
    await show(); await show(); stale(container);
    expect(read).toHaveBeenCalledTimes(1); expect(submit).not.toHaveBeenCalled();
    await press(container, "refresh");
    expect(element(container, "#mobile-confirm-ord-0001").dataset.enabled).toBe("true");
  });

  it("a separate restoration without an observed hidden edge cannot consume an older foreground pair", async () => {
    const read = reads(); const submit = submits(); const { container } = await open();
    await visible("hidden"); await visible("visible");
    await press(container, "refresh"); // a foreground return with no persisted pageshow
    await dispatch(window, new Event("pagehide")); // a later, separate navigation
    stale(container);
    await press(container, "refresh"); // a synthetic visible read before restoration delivery
    const count = read.mock.calls.length;
    await show();
    stale(container);
    expect(read).toHaveBeenCalledTimes(count); expect(submit).not.toHaveBeenCalled();
  });

  it("renders Korean lifecycle detail through the status and accessible control reasons", async () => {
    const { container } = await renderDom(<LocaleProvider initial="ko"><MemoryRouter><InstallableMobilePage /></MemoryRouter></LocaleProvider>);
    await show();
    expect(element(container, "#mobile-status").textContent).toContain("실제 브라우저 복원은 미검증");
    const control = element(container, "#mobile-confirm-ord-0001");
    expect(element(container, `#${control.getAttribute("aria-describedby")}`).textContent).toContain("명시적으로 다시 조회");
  });

  it("blocks all six action entry points before intent allocation, then uses intent-1 after an explicit read", async () => {
    let live!: ReturnType<typeof useMobileShell>;
    function Harness() { live = useMobileShell(); return <><MobileControls scenario={live.scenario} clockMode={live.clockMode} actions={live.actions} /><MobileStatus model={live.model} /></>; }
    const read = reads(); const submit = submits();
    const { container } = await renderDom(<Harness />);
    await visible("hidden"); await visible("visible");
    await act(async () => {
      live.actions.install(); live.actions.update(); live.actions.reconnect();
      live.actions.present("vault-ticket-0001"); live.actions.confirm("ord-0001"); live.actions.withdraw("ord-0001");
    });
    expect(submit).not.toHaveBeenCalled(); expect(read).toHaveBeenCalledTimes(1);
    expect(live.model.record.intents).toEqual([]);
    await press(container, "refresh");
    await act(async () => live.actions.confirm("ord-0001"));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]?.[0].intentRef).toBe("intent-1");
    expect(read).toHaveBeenCalledTimes(3); // explicit plus normal uninterrupted post-write read
  });

  it.each(["clean", "empty"])("initial %s read spanning suspension cannot clear the fence", async (kind) => {
    const held = deferred<MobileReadOutcome>();
    let answer!: Promise<MobileReadOutcome>;
    const read = reads().mockImplementationOnce(function (this: StubMobileShell, request) {
      answer = originalRead.call(this, request);
      return held.promise;
    });
    const submit = submits();
    const { container } = await open();
    await visible("hidden"); await visible("visible");
    await act(async () => held.resolve(kind === "empty" ? { kind: "empty", watermark: "0", generation: 0, snapshotId: 1 } : await answer));
    stale(container); expect(read).toHaveBeenCalledTimes(1); expect(submit).not.toHaveBeenCalled();
    await press(container, "refresh");
    expect(element(container, "#mobile-confirm-ord-0001").dataset.enabled).toBe("true");
  });

  it("an explicit empty read clears the fence and permits only install", async () => {
    const read = reads(); const { container } = await open();
    await scenario(container, "empty"); await show(); stale(container);
    await press(container, "refresh");
    expect(element(container, "#mobile-install-action").dataset.enabled).toBe("true");
    expect(read).toHaveBeenCalledTimes(3);
  });

  it.each(["hidden", "second-invalidation", "older-read", "context-changed"])("held explicit read cannot clear after %s", async (ordering) => {
    const read = reads(); const { container } = await open();
    await show();
    const held = deferred<MobileReadOutcome>(); let answer!: Promise<MobileReadOutcome>;
    read.mockImplementationOnce(function (this: StubMobileShell, request) { answer = originalRead.call(this, request); return held.promise; });
    if (ordering === "hidden") await visible("hidden");
    await press(container, "refresh");
    if (ordering === "second-invalidation") await show();
    if (ordering === "context-changed") await press(container, "switch");
    if (ordering === "older-read") {
      await press(container, "refresh"); // newer explicit read may clear
      await show(); // old read must not clear this new fence
    }
    await act(async () => held.resolve(await answer));
    if (ordering === "hidden") await visible("visible");
    stale(container);
  });

  it.each(["offline", "unknown", "not-bound", "stale", "refused"] as const)("%s explicit read does not clear the fence", async (kind) => {
    const read = reads(); const { container } = await open(); await show();
    const outcomes: Record<typeof kind, MobileReadOutcome> = {
      offline: { kind: "offline", detail: "offline" }, unknown: { kind: "unknown", detail: "unavailable" },
      "not-bound": { kind: "not-bound", reason: "NOT_BOUND" }, stale: { kind: "stale", watermark: "0", floor: "1" },
      refused: { kind: "refused", code: "CLAIM", detail: "refused" },
    };
    read.mockResolvedValueOnce(outcomes[kind]);
    await press(container, "refresh"); stale(container);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it.each(["CONFIRMED", "REJECTED", "UNKNOWN"] as const)("held %s write across suspension never starts a post-write read", async (outcome) => {
    for (const delivery of ["hidden", "visible", "after-explicit"] as const) {
      const read = reads(); const held = deferred<MobileWriteOutcome>();
      let answer!: Promise<MobileWriteOutcome>;
      const submit = submits().mockImplementationOnce(function (this: StubMobileShell, request) {
        answer = originalSubmit.call(this, request); return held.promise;
      });
      const mount = await open(); const { container } = mount;
      await press(container, "confirm-ord-0001");
      await visible("hidden");
      if (delivery !== "hidden") await visible("visible");
      if (delivery === "after-explicit") await press(container, "refresh");
      const count = read.mock.calls.length;
      await act(async () => {
        const actual = await answer;
        held.resolve(outcome === "CONFIRMED" ? actual : outcome === "UNKNOWN"
          ? { kind: "unknown", step: "confirm", intentRef: actual.intentRef, contextKey: actual.contextKey, message: "lost" }
          : { kind: "rejected", step: "confirm", intentRef: actual.intentRef, contextKey: actual.contextKey, code: "SESSION_EXPIRED", detail: "expired" });
      });
      expect(read).toHaveBeenCalledTimes(count); expect(submit).toHaveBeenCalledTimes(1);
      expect(element(container, "#mobile-record").textContent).toContain(outcome);
      if (outcome !== "REJECTED" || delivery !== "after-explicit") {
        expect(element(container, "#mobile-confirm-ord-0001").dataset.enabled).toBe("false");
      }
      if (delivery !== "after-explicit") stale(container);
      await mount.unmount(); vi.restoreAllMocks(); visibility = "visible";
    }
  });

  it("a held post-write automatic read spanning suspension cannot clear", async () => {
    const read = reads(); const { container } = await open();
    const held = deferred<MobileReadOutcome>(); let answer!: Promise<MobileReadOutcome>;
    read.mockImplementationOnce(function (this: StubMobileShell, request) { answer = originalRead.call(this, request); return held.promise; });
    await press(container, "confirm-ord-0001");
    expect(read).toHaveBeenCalledTimes(2);
    await visible("hidden"); await visible("visible");
    await act(async () => held.resolve(await answer)); stale(container);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it.each(["confirm-lost", "withdraw-lost"])("%s UNKNOWN survives lifecycle, reads and late delivery", async (next) => {
    const read = reads(); const submit = submits(); const { container } = await open();
    await scenario(container, next);
    await press(container, next === "confirm-lost" ? "confirm-ord-0001" : "withdraw-ord-0001");
    await visible("hidden"); await visible("visible"); stale(container);
    const count = read.mock.calls.length;
    await press(container, "deliver-late"); expect(read).toHaveBeenCalledTimes(count);
    await press(container, "refresh");
    for (const id of ["confirm-ord-0001", "withdraw-ord-0001"]) {
      expect(element(container, `#mobile-${id}`).dataset.enabled).toBe("false");
    }
    expect(element(container, "#mobile-record").textContent).toContain("UNKNOWN");
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("existing resume simulation uses the explicit fence without sending", async () => {
    const read = reads(); const { container } = await open();
    await press(container, "resume"); stale(container);
    expect(element(container, "#mobile-status").textContent).toContain("The app resumed.");
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("held-response source delivery preserves the fence", async () => {
    const read = reads(); const { container } = await open();
    await scenario(container, "held-response");
    await visible("hidden"); await visible("visible");
    await press(container, "deliver-held"); stale(container);
    expect(read).toHaveBeenCalledTimes(2);
    await press(container, "refresh"); await press(container, "deliver-held");
    expect(element(container, "#mobile-confirm-ord-0001").dataset.enabled).toBe("true");
  });

  it.each(["read", "write"])("session replacement discards an old held %s completion and detaches listeners", async (kind) => {
    const read = reads(); const submit = submits();
    const addDoc = vi.spyOn(document, "addEventListener"); const removeDoc = vi.spyOn(document, "removeEventListener");
    const addWin = vi.spyOn(window, "addEventListener"); const removeWin = vi.spyOn(window, "removeEventListener");
    const { container, unmount } = await open();
    const old = deferred<MobileReadOutcome | MobileWriteOutcome>();
    let answer!: Promise<MobileReadOutcome | MobileWriteOutcome>;
    if (kind === "read") {
      read.mockImplementationOnce(function (this: StubMobileShell, request) { answer = originalRead.call(this, request); return old.promise as Promise<MobileReadOutcome>; });
      await press(container, "refresh");
    } else {
      submit.mockImplementationOnce(function (this: StubMobileShell, request) { answer = originalSubmit.call(this, request); return old.promise as Promise<MobileWriteOutcome>; });
      await press(container, "confirm-ord-0001");
    }
    await visible("hidden"); await visible("visible");
    await press(container, "new-session");
    const before = container.textContent; const count = read.mock.calls.length;
    await act(async () => old.resolve(await answer));
    expect(container.textContent).toBe(before); expect(read).toHaveBeenCalledTimes(count);
    await show(); stale(container); // replacement listeners address replacement
    await unmount();
    for (const [name, callback] of addDoc.mock.calls.filter(([name]) => name === "visibilitychange")) expect(removeDoc).toHaveBeenCalledWith(name, callback);
    for (const [name, callback] of addWin.mock.calls.filter(([name]) => name === "pageshow" || name === "pagehide")) expect(removeWin).toHaveBeenCalledWith(name, callback);
    await visible("hidden"); await visible("visible"); await show();
    expect(read).toHaveBeenCalledTimes(count);
  });

  it("initially hidden mounts require a visible explicit read and unsubscribe on cleanup", async () => {
    visibility = "hidden";
    const offs: Array<ReturnType<typeof vi.fn>> = [];
    const subscribe = MobileShellController.prototype.subscribe;
    vi.spyOn(MobileShellController.prototype, "subscribe").mockImplementation(function (this: MobileShellController, listener) {
      const off = vi.fn(subscribe.call(this, listener));
      offs.push(off);
      return off;
    });
    const read = reads(); const { container, unmount } = await open();
    stale(container);
    await press(container, "refresh"); stale(container);
    await visible("visible"); stale(container);
    expect(read).toHaveBeenCalledTimes(2);
    await press(container, "refresh");
    expect(element(container, "#mobile-confirm-ord-0001").dataset.enabled).toBe("true");
    await unmount();
    expect(offs.length).toBeGreaterThan(0);
    for (const off of offs) expect(off).toHaveBeenCalledTimes(1);
  });

  it("context switch quarantines an old write without a completion read", async () => {
    const read = reads(); const held = deferred<MobileWriteOutcome>(); let answer!: Promise<MobileWriteOutcome>;
    submits().mockImplementationOnce(function (this: StubMobileShell, request) { answer = originalSubmit.call(this, request); return held.promise; });
    const { container } = await open(); await press(container, "confirm-ord-0001");
    await press(container, "switch");
    await act(async () => held.resolve(await answer));
    expect(read).toHaveBeenCalledTimes(1);
    expect(element(container, "#mobile-record").textContent).toContain("UNKNOWN");
    await press(container, "refresh");
    expect(element(container, "#mobile-record").textContent).toContain("UNKNOWN");
    expect(element(container, "#mobile-confirm-ord-0001").dataset.enabled).toBe("false");
  });

  it("unmount before a held write completion prevents updates and automatic reads", async () => {
    const read = reads(); const held = deferred<MobileWriteOutcome>(); let answer!: Promise<MobileWriteOutcome>;
    submits().mockImplementationOnce(function (this: StubMobileShell, request) { answer = originalSubmit.call(this, request); return held.promise; });
    const { container, unmount } = await open(); await press(container, "confirm-ord-0001");
    await unmount(); await act(async () => held.resolve(await answer));
    expect(read).toHaveBeenCalledTimes(1);
  });
});
