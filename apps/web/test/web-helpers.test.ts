import { afterEach, describe, expect, it, vi } from "vitest";
import { pageSessionStore } from "../src/session-store";

afterEach(() => vi.unstubAllGlobals());

describe("journal browser storage wrapper", () => {
  it("passes allowed reads, writes and removals through unchanged", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
      removeItem: vi.fn((key: string) => { values.delete(key); }),
    };
    vi.stubGlobal("sessionStorage", storage);
    const wrapped = pageSessionStore()!;
    expect(wrapped.getItem("kix-session-journal")).toBeNull();
    wrapped.setItem("kix-session-journal", "opaque evidence");
    expect(wrapped.getItem("kix-session-journal")).toBe("opaque evidence");
    wrapped.removeItem("kix-session-journal");
    expect(wrapped.getItem("kix-session-journal")).toBeNull();
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith("kix-session-journal", "opaque evidence");
    for (const operation of [() => wrapped.getItem("outside"), () => wrapped.setItem("outside", "x"), () => wrapped.removeItem("outside")]) {
      expect(operation).toThrow(/not allowed/);
    }
    expect(storage.getItem).toHaveBeenCalledTimes(3);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).toHaveBeenCalledTimes(1);
  });

  it("holds writes when storage is absent or access is blocked", () => {
    vi.stubGlobal("sessionStorage", undefined);
    expect(pageSessionStore()).toBeNull();
    vi.stubGlobal("sessionStorage", null);
    expect(pageSessionStore()).toBeNull();
    vi.stubGlobal("sessionStorage", {});
    vi.spyOn(globalThis, "sessionStorage", "get").mockImplementation(() => { throw new Error("blocked"); });
    expect(pageSessionStore()).toBeNull();
    vi.restoreAllMocks();
  });
});
