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
