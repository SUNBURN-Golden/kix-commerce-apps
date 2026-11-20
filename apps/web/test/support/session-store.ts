import type { SessionStorePort } from "@kix/protocol-adapter";

export function memoryStore(): SessionStorePort {
  const rows = new Map<string, string>();
  return {
    getItem: key => rows.get(key) ?? null,
    setItem: (key, value) => { rows.set(key, value); },
    removeItem: key => { rows.delete(key); },
  };
}
