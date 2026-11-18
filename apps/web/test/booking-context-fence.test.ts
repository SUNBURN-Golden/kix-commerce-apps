import { describe, expect, it, vi } from "vitest";
import { ProtocolError, SURFACES, type Booking, type Hold, type Performance } from "@kix/protocol-adapter";
import { createBookingContextStore } from "../src/booking-context";
import { connectivity } from "../src/connectivity/store";
import { ConnectivityInterrupted } from "../src/connectivity/write-guard";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const rows: Performance[] = ["A", "B"].map((eventId) => ({ eventId, title: `Show ${eventId}`, venue: "Stub", startsAt: "2030-01-01T00:00:00Z", remainingCapacity: 20 }));
const hold = (eventId = "A"): Hold => ({ holdId: `hold-${eventId}`, eventId, quantity: 2, expiresAt: "2030-01-01T00:00:00Z", surface: SURFACES.booking });
const booking = (eventId = "A"): Booking => ({ eventId, bookingId: `booking-${eventId}`, quantity: 2, rightsRef: `right-${eventId}`, payment: "simulated-no-funds", status: "confirmed", surfaces: [] });
function fixture() {
  const port = {
    listPerformances: vi.fn(async () => rows), placeHold: vi.fn(async ({ eventId }: { eventId: string; quantity: number }) => hold(eventId)),
    releaseHold: vi.fn(async (_id: string) => {}), confirmBooking: vi.fn(async (_id: string) => booking()),
  };
  const store = createBookingContextStore({ port });
  return { port, store };
}

describe("booking event ownership", () => {
  it.each(["hold", "release", "confirm"] as const)("retains unresolved %s through A-B-A and fences every competing activation", async (kind) => {
    const { port, store } = fixture();
    await store.load("A"); store.setQuantity("A", "2");
    if (kind !== "hold") await store.placeHold("A");
    const answer = deferred<Hold & Booking>();
    if (kind === "hold") port.placeHold.mockImplementationOnce(() => answer.promise);
    if (kind === "release") port.releaseHold.mockImplementationOnce(() => answer.promise.then(() => {}));
    if (kind === "confirm") port.confirmBooking.mockImplementationOnce(() => answer.promise);
    const run = () => kind === "hold" ? store.placeHold("A") : kind === "release" ? store.releaseHold("A") : store.confirm("A");
    const done = run();
    const owner = store.getSnapshot("A").pending;
    expect(owner).toMatchObject({ eventId: "A", kind, holdId: kind === "hold" ? null : "hold-A", quantity: kind === "hold" ? 2 : null });
    await run(); await store.releaseHold("A"); await store.confirm("A"); await store.placeHold("A");
    await store.load("B"); await store.placeHold("B");
    const b = store.getSnapshot("B");
    expect(store.getSnapshot("A").pending).toBe(owner);
    const reads = port.listPerformances.mock.calls.length;
    await store.load("A"); await store.load("B");
    expect(port.listPerformances).toHaveBeenCalledTimes(reads);
    expect(store.getSnapshot("A").pending).toBe(owner);
    answer.resolve({ ...hold(), ...booking() }); await done;
    expect(store.getSnapshot("B")).toBe(b);
    expect(store.getSnapshot("A").pending).toBeNull();
    expect(store.getSnapshot("A").hold).toEqual(kind === "hold" ? expect.objectContaining({ eventId: "A" }) : null);
    expect(store.getSnapshot("A").booking).toEqual(kind === "confirm" ? expect.objectContaining(booking()) : null);
    expect(port.placeHold.mock.calls).toEqual([[{ eventId: "A", quantity: 2 }], [{ eventId: "B", quantity: 1 }]]);
    expect(port.releaseHold.mock.calls).toEqual(kind === "release" ? [["hold-A"]] : []);
    expect(port.confirmBooking.mock.calls).toEqual(kind === "confirm" ? [["hold-A"]] : []);
  });

  it.each(["hold", "release", "confirm"] as const)("keeps rejected %s and error on its original event", async (kind) => {
    const { port, store } = fixture();
    await store.load("A"); if (kind !== "hold") await store.placeHold("A");
    const answer = deferred<never>();
    if (kind === "hold") port.placeHold.mockImplementationOnce(() => answer.promise);
    if (kind === "release") port.releaseHold.mockImplementationOnce(() => answer.promise);
    if (kind === "confirm") port.confirmBooking.mockImplementationOnce(() => answer.promise);
    const done = kind === "hold" ? store.placeHold("A") : kind === "release" ? store.releaseHold("A") : store.confirm("A");
    await store.load("B"); const b = store.getSnapshot("B");
    answer.reject(new Error(`rejected ${kind}`)); await done;
    expect(store.getSnapshot("B")).toBe(b);
    await store.load("A");
    expect(store.getSnapshot("A")).toMatchObject({ pending: null, writeError: `rejected ${kind}`, hold: kind === "hold" ? null : hold() });
  });

  it.each(["hold", "release", "confirm"] as const)("keeps the %s fence through its own failed catalogue refresh", async (kind) => {
    const { port, store } = fixture();
    await store.load("A"); if (kind !== "hold") await store.placeHold("A");
    const refresh = deferred<Performance[]>(); port.listPerformances.mockImplementationOnce(() => refresh.promise);
    const done = kind === "hold" ? store.placeHold("A") : kind === "release" ? store.releaseHold("A") : store.confirm("A");
    await Promise.resolve();
    const owner = store.getSnapshot("A").pending;
    await store.load("B"); const b = store.getSnapshot("B");
    void store.load("A"); await store.placeHold("A"); await store.releaseHold("A"); await store.confirm("A");
    expect(store.getSnapshot("A").pending).toBe(owner);
    expect(port.listPerformances).toHaveBeenCalledTimes(kind === "hold" ? 3 : 4);
    refresh.reject(new Error("catalogue fault")); await done;
    expect(store.getSnapshot("B")).toBe(b);
    expect(store.getSnapshot("A")).toMatchObject({ pending: null, readState: "error", readError: expect.any(String), writeError: null, hold: kind === "hold" ? hold() : null, booking: kind === "confirm" ? booking() : null });
  });

  it("coalesces initial reads, retains settled ready/empty/error reads, and isolates out-of-order event results", async () => {
    const { port, store } = fixture();
    const a = deferred<Performance[]>(), b = deferred<Performance[]>();
    port.listPerformances.mockImplementationOnce(() => a.promise).mockImplementationOnce(() => b.promise);
    const initial = store.load("A"); expect(store.load("A")).toBe(initial);
    const other = store.load("B"); b.resolve(rows); await other;
    const saved = store.getSnapshot("B"); a.resolve(rows); await initial;
    expect(store.getSnapshot("B")).toBe(saved);
    await store.load("A"); expect(port.listPerformances).toHaveBeenCalledTimes(2);
    port.listPerformances.mockResolvedValueOnce([]); await store.load("empty"); await store.load("empty");
    port.listPerformances.mockRejectedValueOnce(new Error("failed")); await store.load("error"); await store.load("error");
    expect(port.listPerformances).toHaveBeenCalledTimes(4);
    expect(store.getSnapshot("empty").readState).toBe("empty"); expect(store.getSnapshot("error").readState).toBe("error");
    expect(store.getSnapshot("A")).toBe(store.getSnapshot("A"));
  });

  it.each(["hold", "confirm"] as const)("withholds foreign %s evidence permanently without compensation", async (kind) => {
    const { port, store } = fixture(); await store.load("A");
    if (kind === "confirm") { await store.placeHold("A"); port.confirmBooking.mockResolvedValueOnce(booking("B")); await store.confirm("A"); }
    else { port.placeHold.mockResolvedValueOnce(hold("B")); await store.placeHold("A"); }
    expect(store.getSnapshot("A")).toMatchObject({ pending: null, blocked: true, booking: null, hold: kind === "hold" ? null : hold() });
    const counts = [port.placeHold.mock.calls.length, port.releaseHold.mock.calls.length, port.confirmBooking.mock.calls.length];
    await store.load("A"); await store.placeHold("A"); await store.releaseHold("A"); await store.confirm("A");
    expect([port.placeHold.mock.calls.length, port.releaseHold.mock.calls.length, port.confirmBooking.mock.calls.length]).toEqual(counts);
  });

  it.each(["HOLD_EXPIRED", "HOLD_NOT_ACTIVE"])("cleans only the captured ended hold on %s", async (code) => {
    const { port, store } = fixture(); await store.load("A"); await store.placeHold("A"); await store.load("B"); await store.placeHold("B");
    port.confirmBooking.mockRejectedValueOnce(new ProtocolError(code, code)); await store.confirm("A");
    expect(store.getSnapshot("A")).toMatchObject({ hold: null, pending: null, writeError: code });
    expect(store.getSnapshot("B").hold).toEqual(hold("B")); expect(port.releaseHold).not.toHaveBeenCalled();
  });

  it("retains the UNKNOWN connectivity fence after interruption", async () => {
    const { port, store } = fixture(); await store.load("A");
    port.placeHold.mockRejectedValueOnce(new ConnectivityInterrupted()); await store.placeHold("A");
    expect(store.getSnapshot("A")).toMatchObject({ blocked: true, pending: null, writeError: expect.stringContaining("UNKNOWN") });
    await store.placeHold("A"); expect(port.placeHold).toHaveBeenCalledTimes(1);
  });
  it("validates quantity and connectivity before dispatch, keeping HTTP NOT_BOUND errors as returned", async () => {
    const { port, store } = fixture(); await store.load("A");
    store.setQuantity("A", "bad"); await store.placeHold("A");
    expect(store.getSnapshot("A")).toMatchObject({ quantity: "bad", pending: null, writeError: expect.stringContaining("typed value was kept") });
    expect(port.placeHold).not.toHaveBeenCalled();
    store.setQuantity("A", "2");
    connectivity.setBrowserOnline(false);
    try { await store.placeHold("A"); expect(port.placeHold).not.toHaveBeenCalled(); }
    finally { connectivity.setBrowserOnline(true); }
    port.placeHold.mockRejectedValueOnce(new ProtocolError("NOT_BOUND reserve_listing", "NOT_BOUND"));
    await store.placeHold("A");
    expect(store.getSnapshot("A")).toMatchObject({ quantity: "2", hold: null, pending: null, writeError: "NOT_BOUND reserve_listing" });
    expect(port.placeHold).toHaveBeenCalledTimes(1);
    expect(port.releaseHold).not.toHaveBeenCalled(); expect(port.confirmBooking).not.toHaveBeenCalled();
  });

});
