import { afterEach, beforeEach, vi } from "vitest";
import type { PageSessionStore } from "../../src/session-store";

export function memoryStore(): PageSessionStore {
  const rows = new Map<string, string>();
  return {
    keys: () => [...rows.keys()],
    getItem: key => rows.get(key) ?? null,
    setItem: (key, value) => { rows.set(key, value); },
    removeItem: key => { rows.delete(key); },
  };
}

/** Provides tab storage for Node-based tests that dispatch desk commands. */
export function installAttemptStorage(): void {
  beforeEach(() => { vi.stubGlobal("sessionStorage", memoryStore()); });
  afterEach(() => { vi.unstubAllGlobals(); });
}
