import type { SessionStorePort } from "@kix/protocol-adapter";

/**
 * The only place the web app names the tab's session storage for the session
 * journal. A blocked or missing store returns null, and the journal then holds
 * every write instead of guessing.
 */
export function pageSessionStore(): SessionStorePort | null {
  try {
    const store = globalThis.sessionStorage;
    return store === undefined || store === null ? null : store;
  } catch {
    return null;
  }
}
