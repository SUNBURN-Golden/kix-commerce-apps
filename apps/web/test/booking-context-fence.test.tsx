// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { StubProtocolAdapter, type Booking, type Hold } from "@kix/protocol-adapter";
import { BookingPage } from "../src/pages/Booking";
import { createBookingContextStore } from "../src/booking-context";
import { LocaleProvider } from "../src/i18n/LocaleProvider";
import { change, click, element, renderDom } from "./support/render-dom";

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const A = "evt_lanterns", B = "evt_paper_orchestra";
async function mount() {
  const adapter = new StubProtocolAdapter();
  const port = {
    listPerformances: vi.fn(() => adapter.listPerformances()),
    placeHold: vi.fn((input: { eventId: string; quantity: number }) => adapter.placeHold(input)),
    releaseHold: vi.fn((id: string) => adapter.releaseHold(id)),
    confirmBooking: vi.fn((id: string) => adapter.confirmBooking(id)),
  };
  const store = createBookingContextStore({ port });
  const node = <StrictMode><LocaleProvider initial="en"><MemoryRouter initialEntries={[`/booking/${A}`]}>
    <Link id="to-A" to={`/booking/${A}`}>A</Link><Link id="to-B" to={`/booking/${B}`}>B</Link><Link id="away" to="/away">Away</Link>
    <Routes><Route path="/booking/:eventId" element={<BookingPage store={store} />} /><Route path="/away" element={<p>Away</p>} /></Routes>
  </MemoryRouter></LocaleProvider></StrictMode>;
  return { ...await renderDom(node), port, store, adapter };
}

describe("mounted booking context", () => {
  it.each(["hold", "release", "confirm"] as const)("keeps %s blocked through direct navigation and route unmount, without replay", async (kind) => {
    const { container, port, store, adapter } = await mount();
    await change(element(container, "#booking-quantity"), "2");
    if (kind !== "hold") await click(element(container, "#booking-place"));
    const savedHold = store.getSnapshot(A).hold;
    const answer = deferred<Hold | Booking | undefined>();
    if (kind === "hold") port.placeHold.mockImplementationOnce(() => answer.promise as Promise<Hold>);
    if (kind === "release") port.releaseHold.mockImplementationOnce(() => answer.promise as Promise<void>);
    if (kind === "confirm") port.confirmBooking.mockImplementationOnce(() => answer.promise as Promise<Booking>);
    // Two activations in one React turn, before a rerender, must acquire just one token.
    await act(async () => {
      const control = element<HTMLElement>(container, `#booking-${kind === "hold" ? "place" : kind}`);
      control.click(); control.click();
      if (kind === "release") element<HTMLElement>(container, "#booking-confirm").click();
    });
    const pending = store.getSnapshot(A).pending;
    await click(element(container, "#to-B"));
    expect(container.textContent).toContain("Paper Orchestra");
    expect(element<HTMLInputElement>(container, "#booking-quantity").value).toBe("1");
    expect(element<HTMLButtonElement>(container, "#booking-place").disabled).toBe(false);
    expect(container.textContent).not.toContain(savedHold?.holdId ?? "hold_fake");
    await click(element(container, "#booking-place"));
    await click(element(container, "#away")); await click(element(container, "#to-A"));
    expect(store.getSnapshot(A).pending).toBe(pending);
    expect(element<HTMLButtonElement>(container, `#booking-${kind === "hold" ? "place" : "confirm"}`).disabled).toBe(true);
    expect(element<HTMLInputElement>(container, "#booking-quantity").value).toBe("2");
    expect(container.textContent).toContain("One attempt");
    await click(element(container, "#to-B"));
    const b = store.getSnapshot(B);
    await act(async () => {
      answer.resolve(kind === "hold" ? await adapter.placeHold({ eventId: A, quantity: 2 }) : kind === "confirm" ? await adapter.confirmBooking(savedHold!.holdId) : (await adapter.releaseHold(savedHold!.holdId), undefined));
      await answer.promise;
    });
    expect(store.getSnapshot(B)).toBe(b);
    expect(container.textContent).toContain("Paper Orchestra");
    expect(container.querySelector('a[href*="rightsRef="]')).toBeNull();
    await click(element(container, "#to-A"));
    if (kind === "confirm") {
      const link = element<HTMLAnchorElement>(container, 'a[href*="rightsRef="]');
      const url = new URL(link.href);
      expect(url.searchParams.get("eventId")).toBe(A);
      expect(url.searchParams.get("rightsRef")).toBe(store.getSnapshot(A).booking?.rightsRef);
    } else expect(element<HTMLButtonElement>(container, kind === "hold" ? "#booking-confirm" : "#booking-place").disabled).toBe(false);
    expect(port.placeHold).toHaveBeenCalledTimes(2);
    expect(port.releaseHold).toHaveBeenCalledTimes(kind === "release" ? 1 : 0);
    expect(port.confirmBooking).toHaveBeenCalledTimes(kind === "confirm" ? 1 : 0);
    expect(port.listPerformances).toHaveBeenCalledTimes(kind === "hold" ? 4 : 5);
  });

  it("drops inactive focus intents, resets validation on event changes, and preserves each quantity", async () => {
    const { container, port } = await mount();
    await change(element(container, "#booking-quantity"), "bad"); await click(element(container, "#booking-place"));
    expect(container.querySelector(".error-summary")).not.toBeNull();
    await click(element(container, "#to-B"));
    expect(container.querySelector(".error-summary")).toBeNull();
    expect(element(container, "#booking-quantity").getAttribute("aria-invalid")).toBe("false");
    await click(element(container, "#to-A"));
    expect(element<HTMLInputElement>(container, "#booking-quantity").value).toBe("bad");
    await change(element(container, "#booking-quantity"), "2");
    const answer = deferred<Hold>(); port.placeHold.mockImplementationOnce(() => answer.promise);
    await click(element(container, "#booking-place")); await click(element(container, "#to-B"));
    const bInput = element<HTMLInputElement>(container, "#booking-quantity"); bInput.focus();
    await act(async () => answer.reject(new Error("A failed")));
    expect(document.activeElement).toBe(bInput); expect(container.textContent).not.toContain("A failed");
    await click(element(container, "#to-A"));
    expect(container.textContent).toContain("A failed");
    expect(document.activeElement?.id).not.toBe("booking-quantity");
  });

  it("announces refresh failure separately without invalidating quantity or losing a successful hold", async () => {
    const { container, port } = await mount();
    port.listPerformances.mockRejectedValueOnce(new Error("read failed"));
    await click(element(container, "#booking-place"));
    expect(container.textContent).toContain("Could not load the performance");
    expect(container.querySelector("#booking-error")).toBeNull();
    expect(element(container, "#booking-quantity").getAttribute("aria-invalid")).toBe("false");
    expect(container.querySelector("#booking-confirm")).not.toBeNull();
  });

  it("withholds a foreign booking and blocks further writes without an admission link", async () => {
    const { container, port, adapter } = await mount();
    await click(element(container, "#booking-place"));
    const foreignHold = await adapter.placeHold({ eventId: B, quantity: 1 });
    port.confirmBooking.mockResolvedValueOnce(await adapter.confirmBooking(foreignHold.holdId));
    await click(element(container, "#booking-confirm"));
    expect(container.querySelector('a[href*="rightsRef="]')).toBeNull();
    expect(element<HTMLButtonElement>(container, "#booking-confirm").disabled).toBe(true);
    expect(container.textContent).toContain("One attempt");
  });
  it("keeps deferred catalogue results and refresh blocks with the original event", async () => {
    const { container, port, store, adapter } = await mount();
    const refresh = deferred<Awaited<ReturnType<typeof adapter.listPerformances>>>();
    port.listPerformances.mockImplementationOnce(() => refresh.promise);
    await click(element(container, "#booking-place"));
    const owner = store.getSnapshot(A).pending;
    await click(element(container, "#to-B"));
    expect(container.textContent).toContain("Paper Orchestra");
    await click(element(container, "#booking-place"));
    await click(element(container, "#to-A"));
    expect(store.getSnapshot(A).pending).toBe(owner);
    expect(element<HTMLButtonElement>(container, "#booking-confirm").disabled).toBe(true);
    expect(port.listPerformances).toHaveBeenCalledTimes(4);
    await click(element(container, "#to-B"));
    const b = store.getSnapshot(B);
    await act(async () => refresh.resolve(await adapter.listPerformances()));
    expect(store.getSnapshot(B)).toBe(b);
    expect(container.textContent).toContain("Paper Orchestra");
    await click(element(container, "#to-A"));
    expect(element<HTMLButtonElement>(container, "#booking-confirm").disabled).toBe(false);
    expect(port.listPerformances).toHaveBeenCalledTimes(4);
  });

  it.each(["hold", "release", "confirm"] as const)("restores only the active %s error control and keeps the quantity", async (kind) => {
    const { container, port } = await mount();
    await change(element(container, "#booking-quantity"), "2");
    if (kind !== "hold") await click(element(container, "#booking-place"));
    if (kind === "hold") port.placeHold.mockRejectedValueOnce(new Error("write refused"));
    if (kind === "release") port.releaseHold.mockRejectedValueOnce(new Error("write refused"));
    if (kind === "confirm") port.confirmBooking.mockRejectedValueOnce(new Error("write refused"));
    await click(element(container, `#booking-${kind === "hold" ? "place" : kind}`));
    expect(document.activeElement?.id).toBe(kind === "hold" ? "booking-quantity" : `booking-${kind}`);
    expect(element<HTMLInputElement>(container, "#booking-quantity").value).toBe("2");
    expect(container.textContent).toContain("write refused");
  });

});
