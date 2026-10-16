import { afterAll, beforeAll, expect, inject } from "vitest";
import type { Page } from "playwright-core";
import { networkCalls, openSession, type Session } from "./browser";
import { recordCheck, recordLedger } from "./run-record";

export interface Suite {
  origin: string;
  session: () => Session;
  /** Opens a page in the shared context. */
  newPage: () => Promise<Page>;
  /** Asserts the page made no application request. Call it before a full page load clears the counter. */
  quiet: (page: Page, what: string) => Promise<void>;
  /** Asserts the page made no application request, then records the check as passed. */
  pass: (page: Page, checkId: string) => Promise<void>;
}

/** One browser per test file. At the end the ledger must show no external request and no non-GET request. */
export function useBrowser(): Suite {
  const origin = inject("origin");
  let current: Session | null = null;
  beforeAll(async () => {
    current = await openSession(origin);
  });
  afterAll(async () => {
    if (!current) {
      return;
    }
    const { ledger, version } = current;
    await current.close();
    recordLedger({ chrome: version, nonLoopback: ledger.nonLoopback.length, nonGet: ledger.nonGet.length, appNetworkCalls: ledger.appNetworkCalls });
    expect(ledger.nonLoopback, "requests to a non-loopback origin").toEqual([]);
    expect(ledger.nonGet, "requests that were not GET").toEqual([]);
    expect(ledger.appNetworkCalls, "fetch, XHR, beacon or WebSocket calls by page scripts").toBe(0);
  });
  const session = () => {
    if (!current) {
      throw new Error("The browser is not open.");
    }
    return current;
  };
  return {
    origin,
    session,
    newPage: () => session().context.newPage(),
    quiet: async (page, what) => {
      const calls = await networkCalls(page);
      session().ledger.appNetworkCalls += calls;
      expect(calls, `application network calls in ${what}`).toBe(0);
    },
    pass: async (page, checkId) => {
      const calls = await networkCalls(page);
      session().ledger.appNetworkCalls += calls;
      expect(calls, `application network calls in ${checkId}`).toBe(0);
      recordCheck(checkId);
    },
  };
}
