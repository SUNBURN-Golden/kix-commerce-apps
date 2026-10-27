import { afterAll, afterEach, beforeAll, beforeEach, expect, inject } from "vitest";
import type { Page } from "playwright-core";
import { networkCalls, openSession, type Session, type SessionOptions } from "./browser";
import { assertFileClean, assertNoLeaks, type Gate, type TeardownReport } from "./lifecycle";
import { recordCheck, recordLedger } from "./run-record";
import { recordTiming, relativeTestFile, startMeasure, testFullName, type HookTiming } from "./timing";

export interface Suite {
  origin: string;
  /** The origin of the shell-fault build. Set only in the accessibility suite. */
  faultOrigin: string | undefined;
  session: () => Session;
  /** Opens a page in the shared context. */
  newPage: () => Promise<Page>;
  /** Asserts the page made no application request. Call it before a full page load clears the counter. */
  quiet: (page: Page, what: string) => Promise<void>;
  /** Asserts the page made no application request, then records the check as passed. */
  pass: (page: Page, checkId: string) => Promise<void>;
  /** A closed gate for a held route. A gate the test never releases is released when the test ends. */
  gate: () => Gate;
}

/**
 * One browser per test file. At the end the ledger must show no external request and no non-GET request.
 * Each test is timed, and what it left open or pending is read, cleaned up and recorded. A test that leaves a page
 * or context open fails, after the harness has closed it, so the next test starts on a clean session.
 */
export function useBrowser(options: SessionOptions = {}): Suite {
  const origin = inject("origin");
  const faultOrigin = (inject as (key: string) => unknown)("faultOrigin") as string | undefined;
  const galleryOrigin = (inject as (key: string) => unknown)("galleryOrigin") as string | undefined;
  let current: Session | null = null;
  let file = "unknown";
  let measure: (() => HookTiming) | null = null;
  beforeAll(async (suite) => {
    file = relativeTestFile(suite.file.filepath);
    current = await openSession(origin, [faultOrigin, galleryOrigin].filter((value): value is string => value !== undefined), options);
    current.tracker.file = file;
  });
  beforeEach((context) => {
    current?.tracker.beginTest();
    measure = startMeasure(file, testFullName(context.task));
  });
  afterEach(async (context) => {
    if (!current || !measure) {
      return;
    }
    const open = current;
    const timing = measure();
    measure = null;
    let life;
    try {
      recordTiming(timing);
    } finally {
      life = await open.tracker.endTest();
      open.ledger.appNetworkCalls += life.leakedPageNetworkCalls;
      open.tracker.recordTest(timing.name, (context.task.result?.errors?.length ?? 0) > 0, life);
    }
    const bodyFailed = (context.task.result?.errors?.length ?? 0) > 0;
    assertNoLeaks(life, bodyFailed);
  });
  afterAll(async () => {
    if (!current) {
      return;
    }
    const { ledger, version } = current;
    let report: TeardownReport | undefined;
    try {
      report = await current.close();
    } finally {
      recordLedger({ chrome: version, nonLoopback: ledger.nonLoopback.length, nonGet: ledger.nonGet.length, appNetworkCalls: ledger.appNetworkCalls });
    }
    expect(ledger.nonLoopback, "requests to a non-loopback origin").toEqual([]);
    expect(ledger.nonGet, "requests that were not GET").toEqual([]);
    expect(ledger.appNetworkCalls, "fetch, XHR, beacon or WebSocket calls by page scripts").toBe(0);
    assertFileClean(report);
  });
  const session = () => {
    if (!current) {
      throw new Error("The browser is not open.");
    }
    return current;
  };
  return {
    origin,
    faultOrigin,
    session,
    newPage: () => session().context.newPage(),
    gate: () => session().tracker.gate(),
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
