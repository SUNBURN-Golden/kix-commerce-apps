import { afterEach, describe, expect, it } from "vitest";
import { readDeskAttempt, writeDeskAttempt } from "../src/desk-attempts";

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

  it("does not throw when storage is blocked", () => {
    installStorage({
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    expect(() => writeDeskAttempt("reservation", "evt_blocked", 3)).not.toThrow();
    expect(readDeskAttempt("reservation", "evt_blocked")).toBe(3);
  });

  it("reads a counter another page load left in storage", () => {
    installStorage({ getItem: (key) => (key === "kix-resale-attempt:evt_prior" ? "5" : null), setItem: () => undefined });
    expect(readDeskAttempt("resale", "evt_prior")).toBe(5);
    expect(readDeskAttempt("resale", "  ")).toBe(0);
  });
});
