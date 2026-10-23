/** App-internal presentation vocabulary, separate from business outcomes and freshness reducers. */
export const ASYNC_STATES = ["loading", "empty", "error", "unknown", "stale", "not-bound"] as const;
export type AsyncStateKind = (typeof ASYNC_STATES)[number];
