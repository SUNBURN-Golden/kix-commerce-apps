import { afterEach, describe, expect, it, vi } from "vitest";
import { StubProtocolAdapter } from "@kix/protocol-adapter";
import { allocateDeskAttempt, claimCurrentDeskAttempt, COUNTER_EXHAUSTED, readDeskAttempt, writeDeskAttempt } from "../src/desk-attempts";

const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");

function installStorage(storage: Partial<Storage>): void {
  Object.defineProperty(globalThis, "sessionStorage", { value: storage, configurable: true });
}

afterEach(() => {
  if (original) {
    Object.defineProperty(globalThis, "sessionStorage", original);
  } else {
    delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
  }
});

describe("desk attempt counter", () => {
  it("never goes back below an attempt this page load used when storage stops accepting writes", () => {
    const stored = new Map<string, string>();
    let full = false;
    installStorage({
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => {
        if (full) {
          throw new DOMException("quota", "QuotaExceededError");
        }
        stored.set(key, value);
      },
    });
    writeDeskAttempt("settlement", "stl_quota", 1);
    full = true;
    expect(() => writeDeskAttempt("settlement", "stl_quota", 2)).not.toThrow();
    expect(stored.get("kix-settlement-attempt:stl_quota")).toBe("1");
    expect(readDeskAttempt("settlement", "stl_quota")).toBe(2);
  });

  it("refuses an unreadable counter and leaves storage alone", () => {
    const setItem = vi.fn();
    installStorage({
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem,
    });
    expect(writeDeskAttempt("reservation", "evt_blocked", 3)).toBe(false);
    expect(readDeskAttempt("reservation", "evt_blocked")).toBeNull();
    expect(allocateDeskAttempt("reservation", "evt_blocked")).toBeNull();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("reads a counter another page load left in storage", () => {
    installStorage({ getItem: (key) => (key === "kix-resale-attempt:evt_prior" ? "5" : null), setItem: () => undefined });
    expect(readDeskAttempt("resale", "evt_prior")).toBe(5);
    expect(readDeskAttempt("resale", "  ")).toBe(0);
  });
});

it("refuses settlement on reload when the stored exhaustion marker is unreadable", async () => {
  const protocol = new StubProtocolAdapter();
  const [{ eventId }] = await protocol.listPerformances();
  const key = `kix-settlement-attempt:stl_${eventId}`;
  const stored = new Map([[key, String(Number.MAX_SAFE_INTEGER)]]);
  let unreadable = false;
  installStorage({
    getItem: id => {
      if (id === key && unreadable) throw new DOMException("blocked", "SecurityError");
      return stored.get(id) ?? null;
    },
    setItem: (id, value) => { stored.set(id, value); },
  });
  const send = vi.spyOn(protocol, "initiateSettlement");
  const { runSettlementCommand } = await import("../src/settlement-desk");
  await runSettlementCommand(protocol, "initiate", eventId);
  expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    idempotencyKey: `desk-initiate:stl_${eventId}:${Number.MAX_SAFE_INTEGER}`,
  }));
  expect(stored.get(key)).toBe(COUNTER_EXHAUSTED);

  unreadable = true;
  vi.resetModules();
  const reloaded = await import("../src/settlement-desk");
  await expect(reloaded.runSettlementCommand(protocol, "initiate", eventId)).rejects.toMatchObject({ code: COUNTER_EXHAUSTED });
  expect(send).toHaveBeenCalledTimes(1);
  expect(stored.get(key)).toBe(COUNTER_EXHAUSTED);
});

it("allocates the last safe ID and holds exhausted storage and rollback", () => {
  const key = "kix-journey-attempt:safe-limit";
  const stored = new Map([[key, String(Number.MAX_SAFE_INTEGER - 1)]]);
  installStorage({ getItem: id => stored.get(id) ?? null, setItem: (id, value) => { stored.set(id, value); } });
  expect(allocateDeskAttempt("journey", "safe-limit")).toBe(Number.MAX_SAFE_INTEGER);
  expect(stored.get(key)).toBe(String(Number.MAX_SAFE_INTEGER));
  expect(allocateDeskAttempt("journey", "safe-limit")).toBeNull();
  stored.set(key, "0");
  expect(allocateDeskAttempt("journey", "safe-limit")).toBeNull();
  stored.set("kix-journey-attempt:unsafe-limit", "9007199254740992");
  expect(allocateDeskAttempt("journey", "unsafe-limit")).toBeNull();
  stored.delete("kix-journey-attempt:unsafe-limit");
  expect(allocateDeskAttempt("journey", "unsafe-limit")).toBeNull();
});

it("refuses the final journey ID when storage ignores the new counter", () => {
  installStorage({ getItem: () => String(Number.MAX_SAFE_INTEGER - 1), setItem: () => undefined });
  expect(allocateDeskAttempt("journey", "unwritten-limit")).toBeNull();
  expect(allocateDeskAttempt("journey", "unwritten-limit")).toBeNull();
});

it("consumes the final current attempt before a legacy desk sends", () => {
  const key = "kix-settlement-attempt:legacy-limit";
  const stored = new Map([[key, String(Number.MAX_SAFE_INTEGER)]]);
  installStorage({ getItem: id => stored.get(id) ?? null, setItem: (id, value) => { stored.set(id, value); } });
  const claim = () => claimCurrentDeskAttempt("legacy-limit", id => readDeskAttempt("settlement", id),
    (id, count) => writeDeskAttempt("settlement", id, count));
  expect(claim()).toBe(Number.MAX_SAFE_INTEGER);
  expect(stored.get(key)).toBe(COUNTER_EXHAUSTED);
  expect(claim()).toBeNull();
});

it.each(["throws", "ignores"] as const)("refuses a final settlement command across reload when storage %s the marker write", async fault => {
  const eventId = `legacy-limit-${fault}`;
  const key = `kix-settlement-attempt:stl_${eventId}`;
  const finalAttempt = String(Number.MAX_SAFE_INTEGER);
  installStorage({
    getItem: id => id === key ? finalAttempt : null,
    setItem: () => {
      if (fault === "throws") throw new DOMException("quota", "QuotaExceededError");
    },
  });
  const protocol = new StubProtocolAdapter();
  const send = vi.spyOn(protocol, "initiateSettlement");

  for (let load = 0; load < 2; load += 1) {
    vi.resetModules();
    const { runSettlementCommand } = await import("../src/settlement-desk");
    await expect(runSettlementCommand(protocol, "initiate", eventId)).rejects.toMatchObject({ code: COUNTER_EXHAUSTED });
    expect(sessionStorage.getItem(key)).toBe(finalAttempt);
    expect(send).toHaveBeenCalledTimes(0);
  }
});
