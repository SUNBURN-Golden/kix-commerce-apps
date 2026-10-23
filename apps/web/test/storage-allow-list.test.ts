import { SESSION_RETENTION_POLICY } from "@kix/protocol-adapter";
import { afterEach, describe, expect, it } from "vitest";
import { pageSessionStore } from "../src/session-store";
import { assertAllowedStorageKey, isAllowedStorageKey, scanStorageViolations, STORAGE_ALLOW_LIST } from "../src/storage-allow-list";
import { findSensitive } from "../../e2e/src/redact";
import { HOSTILE_FIXTURES } from "./support/hostile-fixtures";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");

afterEach(() => {
  if (original) {
    Object.defineProperty(globalThis, "sessionStorage", original);
  } else {
    delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
  }
});

describe("browser storage allow-list", () => {
  it("allows only the exact keys and named attempt prefixes", () => {
    for (const key of STORAGE_ALLOW_LIST.slice(0, 4)) {
      expect(isAllowedStorageKey(key)).toBe(true);
    }
    for (const prefix of STORAGE_ALLOW_LIST.slice(4)) {
      expect(isAllowedStorageKey(`${prefix}fixture`)).toBe(true);
      expect(isAllowedStorageKey(prefix)).toBe(false);
    }
    for (const key of ["kix-onboarding-x", "unknown", "kix-session-journal-copy", "kix-unknown-attempt:id"]) {
      expect(() => assertAllowedStorageKey(key)).toThrow(/not allowed/);
    }
  });

  it("finds every disallowed key and rejects it through the journal wrapper", () => {
    const storage = new MemoryStorage();
    storage.setItem("kix-session-journal", "{}");
    storage.setItem("outside", "value");
    expect(scanStorageViolations(storage)).toEqual(["outside"]);
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storage });
    const wrapped = pageSessionStore();
    expect(wrapped).not.toBeNull();
    expect(() => wrapped?.setItem("outside", "value")).toThrow(/not allowed/);
    expect(() => wrapped?.removeItem("outside")).toThrow(/not allowed/);
  });

  it("applies the e2e redaction scan to every stored value", () => {
    const storage = new MemoryStorage();
    storage.setItem("kix-session-journal", HOSTILE_FIXTURES.bearer);
    const findings = Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .flatMap((key) => key === null ? [] : findSensitive(storage.getItem(key) ?? ""));
    expect(findings).toContain("bearer");
    storage.setItem("kix-session-journal", '{"status":"UNKNOWN","operationId":"op_fixture"}');
    expect(findSensitive(storage.getItem("kix-session-journal") ?? "")).toEqual([]);
  });

  it("keeps retention policy undetermined", () => {
    expect(SESSION_RETENTION_POLICY).toBe("UNDETERMINED");
  });
});
