import type { LifecycleBlock } from "../src/lifecycle";
import type { TimingBlock } from "../src/timing";

/** A clean lifecycle block for record tests: one session, everything opened was closed. */
export function lifecycleFixture(overrides: Partial<LifecycleBlock> = {}): LifecycleBlock {
  return {
    tests: [],
    files: [],
    sessions: 1,
    browsersOpened: 1,
    browsersClosed: 1,
    contextsOpened: 1,
    contextsClosed: 1,
    pagesOpened: 2,
    pagesClosed: 2,
    testsTracked: 2,
    leakedAtTestEnd: 0,
    leakedInFailedTests: 0,
    survivorsAfterCleanup: 0,
    leakedAtTeardown: 0,
    pendingApiCallsAtTestEnd: 0,
    pendingRoutesAtTestEnd: 0,
    unreleasedGatesAtTestEnd: 0,
    pendingApiCallsAtTeardown: 0,
    pendingRoutesAtTeardown: 0,
    cleanupErrors: 0,
    leakedPageNetworkCalls: 0,
    ...overrides,
  };
}

/** A timing block with two measured tests and one the hooks did not measure (null, never zero). */
export function timingFixture(overrides: Partial<TimingBlock> = {}): TimingBlock {
  return {
    source: "vitest-state+hooks",
    count: 3,
    measured: 2,
    ranked: 3,
    p50Ms: 1412,
    p95Ms: 1803,
    maxMs: 1803,
    maxClockStepMs: 0,
    maxLoopStallMs: 12,
    maxMemoryFullMs: 0,
    failed: { withHostEvent: 0, withoutHostEvent: 0, unmeasured: 0 },
    hostClock: { intervalMs: 250, samples: 40, maxWallStepMs: 0, maxLoopStallMs: 12, events: [], droppedEvents: 0, pressure: { memoryFullMs: 0, memorySomeMs: 4, ioFullMs: 0, cpuSomeMs: 20, memAvailableMinMb: 3100 } },
    tests: [
      { file: "tests/a.e2e.test.ts", name: "a > one", state: "pass", durationMs: 1412, wallMs: 1410, clockStepMs: 0, maxLoopStallMs: 12, cpuMs: 310, memoryFullMs: 0 },
      { file: "tests/a.e2e.test.ts", name: "a > two", state: "pass", durationMs: 1803, wallMs: 1801, clockStepMs: 0, maxLoopStallMs: 9, cpuMs: 295, memoryFullMs: 0 },
      { file: "tests/b.e2e.test.ts", name: "b > no browser", state: "pass", durationMs: 3, wallMs: null, clockStepMs: null, maxLoopStallMs: null, cpuMs: null, memoryFullMs: null },
    ],
    ...overrides,
  };
}
