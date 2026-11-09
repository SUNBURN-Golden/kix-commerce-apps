import { describe, expect, it, vi } from "vitest";
import { ProtocolError, StubProtocolAdapter, type Booking, type Hold, type Performance } from "../src/index.js";

const T0 = Date.parse("2026-10-01T00:00:00.000Z");
const TEN_MINUTES = 10 * 60 * 1000;
const DATE_MAX = 8_640_000_000_000_000;
const INPUT = { eventId: "event-clock", quantity: 2 };
const CLOCK_MESSAGE = "Stub hold clock must return a valid Date timestamp.";
const invalidClocks = [
  { name: "throw", read: (): number => { throw new Error("private clock failure"); } },
  ...[
    ["NaN", NaN], ["positive infinity", Infinity], ["negative infinity", -Infinity],
    ["above Date range", DATE_MAX + 1], ["below Date range", -DATE_MAX - 1],
  ].map(([name, value]) => ({ name: String(name), read: () => value as number })),
];

function fixture() {
  let read = () => T0;
  const clock = vi.fn(() => read());
  const adapter = new StubProtocolAdapter([{
    eventId: INPUT.eventId, title: "Clock fixture", venue: "Synthetic hall",
    startsAt: new Date(T0).toISOString(), remainingCapacity: 20,
  }], clock);
  return { adapter, clock, setTime: (now: number) => { read = () => now; },
    setClock: (next: () => number) => { read = next; } };
}

// Test-only inspection: snapshot before any public read can sweep expired holds.
function snapshot(adapter: StubProtocolAdapter) {
  const state = adapter as unknown as {
    performances: Performance[];
    holds: Map<string, Hold & { consumed: boolean; expired: boolean }>;
    bookings: Map<string, Booking>;
    seq: number;
  };
  return structuredClone({ performances: state.performances, holds: [...state.holds],
    bookings: [...state.bookings], seq: state.seq });
}

const operations = ["listPerformances", "placeHold", "releaseHold", "confirmBooking"] as const;
function operate(adapter: StubProtocolAdapter, op: typeof operations[number], holdId: string) {
  switch (op) {
    case "listPerformances": return adapter.listPerformances();
    case "placeHold": return adapter.placeHold(INPUT);
    case "releaseHold": return adapter.releaseHold(holdId);
    case "confirmBooking": return adapter.confirmBooking(holdId);
  }
}

async function capacity(adapter: StubProtocolAdapter, expected: number) {
  expect((await adapter.listPerformances())[0]?.remainingCapacity).toBe(expected);
}

describe("synthetic hold clock atomicity", () => {
  for (const populated of [false, true]) {
    for (const op of operations) {
      it.each(invalidClocks)(`${op}: $name preserves ${populated ? "populated" : "empty"} state and recovers`, async ({ read }) => {
        const f = fixture();
        let target = "hold_missing";
        let booking: Booking | undefined;
        if (populated) {
          const confirmed = await f.adapter.placeHold(INPUT);
          booking = await f.adapter.confirmBooking(confirmed.holdId);
          const released = await f.adapter.placeHold(INPUT);
          await f.adapter.releaseHold(released.holdId);
          target = (await f.adapter.placeHold(INPUT)).holdId;
        }
        const before = snapshot(f.adapter);
        f.setClock(read);
        f.clock.mockClear();
        await expect(operate(f.adapter, op, target)).rejects.toMatchObject({
          name: "ProtocolError", message: CLOCK_MESSAGE, code: undefined,
        });
        expect(f.clock).toHaveBeenCalledTimes(1);
        expect(snapshot(f.adapter)).toEqual(before);
        f.setTime(T0 + TEN_MINUTES);
        await capacity(f.adapter, populated ? 18 : 20);
        await capacity(f.adapter, populated ? 18 : 20);
        if (booking) expect(await f.adapter.getBooking(booking.bookingId)).toEqual(booking);
        const hold = await f.adapter.placeHold(INPUT);
        expect(hold.holdId).toBe(`hold_${before.seq + 1}`);
        const next = await f.adapter.confirmBooking(hold.holdId);
        expect(next.bookingId).toBe(`bkg_${before.seq + 2}`);
        expect(next.payment).toBe("simulated-no-funds");
        const release = await f.adapter.placeHold(INPUT);
        await f.adapter.releaseHold(release.holdId);
        await capacity(f.adapter, populated ? 16 : 18);
      });
    }
  }

  for (const op of ["releaseHold", "confirmBooking"] as const) {
    for (const terminal of ["unknown", "confirmed", "released", "expired"] as const) {
      it.each(invalidClocks)(`${op}: $name precedes ${terminal} hold refusal without mutation`, async ({ read }) => {
        const f = fixture();
        const hold = await f.adapter.placeHold(INPUT);
        if (terminal === "confirmed") await f.adapter.confirmBooking(hold.holdId);
        if (terminal === "released") await f.adapter.releaseHold(hold.holdId);
        if (terminal === "expired") {
          f.setTime(T0 + TEN_MINUTES);
          await capacity(f.adapter, 20);
        }
        const before = snapshot(f.adapter);
        f.setClock(read);
        await expect(f.adapter[op](terminal === "unknown" ? "missing" : hold.holdId))
          .rejects.toThrow(CLOCK_MESSAGE);
        expect(snapshot(f.adapter)).toEqual(before);
      });
    }
    it.each(invalidClocks)(`${op}: $name cannot transition a due hold; recovery releases exactly once`, async ({ read }) => {
      const f = fixture();
      const hold = await f.adapter.placeHold(INPUT);
      f.setTime(T0 + TEN_MINUTES);
      const before = snapshot(f.adapter);
      f.setClock(read);
      await expect(f.adapter[op](hold.holdId)).rejects.toBeInstanceOf(ProtocolError);
      expect(snapshot(f.adapter)).toEqual(before);
      f.setTime(T0 + TEN_MINUTES);
      await expect(f.adapter[op](hold.holdId)).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
      await expect(f.adapter.confirmBooking(hold.holdId)).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
      await expect(f.adapter.releaseHold(hold.holdId)).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
      await capacity(f.adapter, 20);
      expect((await f.adapter.placeHold(INPUT)).holdId).toBe("hold_2");
    });
  }

  it("refuses unrepresentable derived expiry before sweeping a due hold or allocating an ID", async () => {
    const f = fixture();
    const due = await f.adapter.placeHold(INPUT);
    const before = snapshot(f.adapter);
    f.setTime(DATE_MAX - TEN_MINUTES + 1);
    await expect(f.adapter.placeHold(INPUT)).rejects.toThrow("Stub hold expiry is outside the Date range.");
    expect(snapshot(f.adapter)).toEqual(before);
    f.setTime(DATE_MAX - TEN_MINUTES);
    const hold = await f.adapter.placeHold(INPUT);
    expect(hold.holdId).toBe("hold_2");
    expect(hold.expiresAt).toBe(new Date(DATE_MAX).toISOString());
    await expect(f.adapter.confirmBooking(due.holdId)).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
    await capacity(f.adapter, 18);
    // A valid observation needs no representable future expiry for reads/transitions.
    f.setTime(DATE_MAX - 1);
    await capacity(f.adapter, 18);
    expect((await f.adapter.confirmBooking(hold.holdId)).bookingId).toBe("bkg_3");
    f.setTime(DATE_MAX);
    await capacity(f.adapter, 18);
  });

  it.each([-DATE_MAX, 0, T0, DATE_MAX - TEN_MINUTES])("creates the ten-minute expiry at valid epoch %s", async (now) => {
    const f = fixture();
    f.setTime(now);
    const hold = await f.adapter.placeHold(INPUT);
    expect(Date.parse(hold.expiresAt) - now).toBe(TEN_MINUTES);
    await f.adapter.releaseHold(hold.holdId);
    await capacity(f.adapter, 20);
  });

  it.each(operations)("%s observes the clock once, including a multi-hold sweep", async (op) => {
    const f = fixture();
    await f.adapter.placeHold(INPUT);
    await f.adapter.placeHold(INPUT);
    f.setTime(T0 + TEN_MINUTES / 2);
    const active = await f.adapter.placeHold(INPUT);
    f.clock.mockClear();
    let reads = 0;
    f.setClock(() => {
      if (++reads > 1) throw new Error("second read forbidden");
      return T0 + TEN_MINUTES;
    });
    const result = await operate(f.adapter, op, active.holdId);
    expect(f.clock).toHaveBeenCalledTimes(1);
    if (op === "placeHold") expect((result as Hold).expiresAt).toBe(new Date(T0 + 2 * TEN_MINUTES).toISOString());
    f.setTime(T0 + TEN_MINUTES);
    await capacity(f.adapter, op === "releaseHold" ? 20 : op === "placeHold" ? 16 : 18);
  });

  it("uses the first observation when a second read would cross expiry", async () => {
    const f = fixture();
    const hold = await f.adapter.placeHold(INPUT);
    f.clock.mockReset().mockReturnValueOnce(T0 + TEN_MINUTES - 1).mockReturnValue(T0 + TEN_MINUTES);
    expect((await f.adapter.confirmBooking(hold.holdId)).bookingId).toBe("bkg_2");
    expect(f.clock).toHaveBeenCalledTimes(1);
  });

  for (const delta of [-1, 0, 1]) {
    for (const op of ["listPerformances", "confirmBooking", "releaseHold"] as const) {
      it(`${op} at expiry ${delta}ms releases capacity at most once`, async () => {
        const f = fixture();
        const hold = await f.adapter.placeHold(INPUT);
        f.setTime(T0 + TEN_MINUTES + delta);
        if (delta < 0) {
          await operate(f.adapter, op, hold.holdId);
          await capacity(f.adapter, op === "releaseHold" ? 20 : 18);
          f.setTime(T0 + TEN_MINUTES);
        } else if (op !== "listPerformances") {
          await expect(operate(f.adapter, op, hold.holdId)).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
        }
        await capacity(f.adapter, delta < 0 && op === "confirmBooking" ? 18 : 20);
        const code = delta < 0 && op !== "listPerformances" ? "HOLD_NOT_ACTIVE" : "HOLD_EXPIRED";
        for (let repeat = 0; repeat < 2; repeat++) {
          await expect(f.adapter.confirmBooking(hold.holdId)).rejects.toMatchObject({ code });
          await expect(f.adapter.releaseHold(hold.holdId)).rejects.toMatchObject({ code });
          await capacity(f.adapter, delta < 0 && op === "confirmBooking" ? 18 : 20);
        }
        const next = await f.adapter.placeHold(INPUT);
        expect(next.holdId).toBe(delta < 0 && op === "confirmBooking" ? "hold_3" : "hold_2");
      });
    }
  }

  it.each([
    { input: { eventId: "unknown", quantity: 1 }, message: "Unknown performance." },
    { input: { ...INPUT, quantity: 0 }, message: "Quantity must be a whole number from 1 to 6." },
  ])("input refusal ($message) precedes the clock and never sweeps", async ({ input, message }) => {
    const f = fixture();
    await f.adapter.placeHold(INPUT);
    const before = snapshot(f.adapter);
    f.setClock(() => { throw new Error("clock must not be read"); });
    f.clock.mockClear();
    await expect(f.adapter.placeHold(input)).rejects.toThrow(message);
    expect(f.clock).not.toHaveBeenCalled();
    expect(snapshot(f.adapter)).toEqual(before);
    f.setTime(T0 + TEN_MINUTES);
    await expect(f.adapter.placeHold(input)).rejects.toThrow(message);
    expect(snapshot(f.adapter)).toEqual(before);
    await capacity(f.adapter, 20);
  });
});
