import type { ComponentType } from "react";

/**
 * Loads each screen's code once and keeps the outcome. App-internal; not a public schema, operation or ID.
 * It holds no desk, no adapter and no storage: a failed load sends nothing and clears nothing.
 *
 * A failed load is kept as the outcome, so React drawing the slot again does not import again.
 * It is tried a second time only when `forgetFailedScreens` runs (the "Load this screen again" button or a move to another screen).
 */
export type ScreenImport = () => Promise<{ default: ComponentType }>;

export const SCREEN_LOAD_CODE = "SCREEN_LOAD_FAILED";

/** Thrown while drawing a screen whose code could not be loaded. Carries the screen id and the original error as `cause` only. */
export class ScreenLoadError extends Error {
  readonly code = SCREEN_LOAD_CODE;
  readonly screenId: string;
  constructor(screenId: string, cause: unknown) {
    // The message is constant: it never repeats a URL, a file hash or a response body.
    super("A screen file could not be loaded.", { cause });
    this.name = "ScreenLoadError";
    this.screenId = screenId;
  }
}

type Entry =
  | { state: "pending"; wait: Promise<void> }
  | { state: "ready"; component: ComponentType }
  | { state: "failed"; error: ScreenLoadError };

export type ScreenState = "idle" | "pending" | "ready" | "failed";

export interface ScreenLoader<K extends string> {
  /** The settled component. Throws a promise while the import runs and the stored ScreenLoadError after a failure. */
  read: (id: K) => ComponentType;
  state: (id: K) => ScreenState;
  /** Imports every screen once. Resolves when all have settled; never rejects. */
  preload: () => Promise<void>;
}

const loaders = new Set<{ forget: () => void }>();

/** Clears every failed outcome so the next read makes one new import. Ready and pending screens are untouched. */
export function forgetFailedScreens(): void {
  for (const loader of loaders) {
    loader.forget();
  }
}

export function createScreenLoader<K extends string>(imports: Record<K, ScreenImport>): ScreenLoader<K> {
  const entries = new Map<K, Entry>();

  const start = (id: K): Entry => {
    let run: Promise<{ default: ComponentType }>;
    try {
      run = imports[id]();
    } catch (error) {
      run = Promise.reject(error);
    }
    const wait = run.then(
      (module) => {
        entries.set(id, { state: "ready", component: module.default });
      },
      (error: unknown) => {
        entries.set(id, { state: "failed", error: new ScreenLoadError(id, error) });
      },
    );
    const entry: Entry = { state: "pending", wait };
    entries.set(id, entry);
    return entry;
  };

  loaders.add({
    forget: () => {
      for (const [id, entry] of entries) {
        if (entry.state === "failed") {
          entries.delete(id);
        }
      }
    },
  });

  return {
    read: (id) => {
      const entry = entries.get(id) ?? start(id);
      if (entry.state === "ready") {
        return entry.component;
      }
      if (entry.state === "failed") {
        throw entry.error;
      }
      throw entry.wait;
    },
    state: (id) => entries.get(id)?.state ?? "idle",
    preload: async () => {
      // One at a time, in registry order, so module evaluation order is the same on every run.
      for (const id of Object.keys(imports) as K[]) {
        const entry = entries.get(id) ?? start(id);
        if (entry.state === "pending") {
          await entry.wait;
        }
      }
    },
  };
}
