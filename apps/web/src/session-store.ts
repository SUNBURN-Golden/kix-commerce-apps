import type { SessionStorePort } from "../../../packages/protocol-adapter/src/shell-entry";
import { assertAllowedStorageKey } from "./storage-allow-list";

export type PageSessionStore = SessionStorePort & { keys(): string[] };

/**
 * The only place the web app names the tab's session storage for the session
 * journal. A blocked or missing store returns null, and the journal then holds
 * every write instead of guessing.
 */
export function pageSessionStore(): PageSessionStore | null {
  try {
    const store = globalThis.sessionStorage;
    if (store === undefined || store === null) {
      return null;
    }
    return {
      keys: () => Object.keys(store),
      getItem: (key) => {
        assertAllowedStorageKey(key);
        return store.getItem(key);
      },
      setItem: (key, value) => {
        assertAllowedStorageKey(key);
        store.setItem(key, value);
      },
      removeItem: (key) => {
        assertAllowedStorageKey(key);
        store.removeItem(key);
      },
    };
  } catch {
    return null;
  }
}
