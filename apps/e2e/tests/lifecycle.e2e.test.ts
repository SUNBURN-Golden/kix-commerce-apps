import { describe, expect, inject, it, vi } from "vitest";
import { openSession } from "../src/browser";
import { watchClock } from "../src/clock-watch";
import { assertFileClean, assertNoLeaks } from "../src/lifecycle";
import { recordCheck } from "../src/run-record";
import { buildTiming, percentile, startMeasure, testFullName, type RunnerTest } from "../src/timing";

/** A private session: its deliberate leaks stay out of the run record. */
const privateSession = () => openSession(inject("origin"), [], { recordLifecycle: false });

describe("lifecycle accounting (stub, headless Chrome)", () => {
  it("reports a page, a context and a page in a context that a test left open, closes them, and fails the test that left them", async () => {
    const session = await privateSession();
    try {
      const { tracker, context } = session;
      tracker.beginTest();
      const page = await context.newPage();
      const first = await tracker.endTest();
      expect(first.leakedPages).toBe(1);
      expect(first.survivorPages).toBe(0);
      expect(page.isClosed()).toBe(true);
      expect(() => assertNoLeaks(first, false)).toThrow(/left 1 page/);
      // A test whose body already failed is not blamed twice, but a survivor still throws.
      expect(() => assertNoLeaks(first, true)).not.toThrow();
      expect(() => assertNoLeaks({ ...first, survivorPages: 1 }, true)).toThrow(/could not close/);

      tracker.beginTest();
      const extra = await session.browser.newContext();
      await extra.newPage();
      const second = await tracker.endTest();
      expect(second.leakedContexts).toBe(1);
      expect(second.leakedPages).toBe(1);
      expect(second.survivorContexts).toBe(0);
      expect(second.counts).toMatchObject({ contextsOpened: 1, contextsClosed: 1, pagesOpened: 1, pagesClosed: 1 });
      expect(() => assertNoLeaks(second, false)).toThrow(/1 context/);

      tracker.beginTest();
      const clean = await context.newPage();
      await clean.close();
      const transient = await session.browser.newContext();
      await transient.close();
      const third = await tracker.endTest();
      expect(third.counts).toMatchObject({ contextsOpened: 1, contextsClosed: 1 });
      expect(third).toMatchObject({ leakedPages: 0, leakedContexts: 0, survivorPages: 0, survivorContexts: 0, pendingRoutes: 0, unreleasedGates: 0, cleanupErrors: 0 });
      expect(() => assertNoLeaks(third, false)).not.toThrow();

      tracker.beginTest();
      const survivor = await session.browser.newContext();
      const close = vi.spyOn(survivor, "close").mockRejectedValue(new Error("deliberate close failure"));
      try {
        const failed = await tracker.endTest();
        expect(failed.survivorContexts).toBe(1);
        expect(failed.cleanupErrors).toBe(1);
        expect(() => assertNoLeaks(failed, true)).toThrow(/could not close/);
        const guarded = await survivor.newPage();
        const blocked = session.ledger.nonLoopback.length;
        await guarded.goto("http://example.invalid/").catch(() => undefined);
        expect(session.ledger.nonLoopback.length).toBeGreaterThan(blocked);
        await guarded.close();
      } finally {
        close.mockRestore();
        await survivor.close();
      }

      // A page opened between tests belongs to nobody: the file-level report finds it.
      await context.newPage();
      const report = await tracker.closeSession();
      expect(report.leakedPages).toBe(1);
      expect(() => assertFileClean(report)).toThrow(/still open when the file ended/);
    } finally {
      await session.close();
    }
    const { counts } = session.tracker;
    expect(counts.browsersOpened).toBe(1);
    expect(counts.browsersClosed).toBe(1);
    expect(counts.contextsOpened).toBe(counts.contextsClosed);
    expect(counts.pagesOpened).toBe(5);
    expect(counts.pagesClosed).toBe(5);
    recordCheck("harness.lifecycle-leak");
  });

  it("sees a held page route, a held context route, a pending navigation and a losing wait, then releases the gate and cleans up", async () => {
    const session = await privateSession();
    const origin = inject("origin");
    try {
      const { tracker, context } = session;
      tracker.beginTest();
      const page = await context.newPage();
      const gate = tracker.gate();
      await page.route("**/held-resource", async (route) => {
        await gate.opened;
        await route.fulfill({ status: 200, body: "ok" });
      });
      await context.route("**/held-in-context", async (route) => {
        await gate.opened;
        await route.fulfill({ status: 200, body: "ok" });
      });
      const navigation = page.goto(`${origin}/held-resource`, { waitUntil: "commit" }).catch(() => "closed");
      const other = await context.newPage();
      const contextHeld = other.goto(`${origin}/held-in-context`, { waitUntil: "commit" }).catch(() => "closed");
      // The losing branch of a race: the wait keeps running after the race is settled.
      const losing = Promise.race([page.waitForSelector("#never-there", { timeout: 20_000 }).catch(() => null), Promise.resolve("won")]);
      expect(await losing).toBe("won");
      // The held handlers have started once the browser asked for the files.
      await vi.waitFor(() => {
        expect(tracker.pending().routes).toBeGreaterThanOrEqual(2);
      });
      const life = await tracker.endTest();
      expect(life.pendingRoutes).toBeGreaterThanOrEqual(2);
      expect(life.pendingApiCalls).toEqual(expect.arrayContaining(["page.goto", "page.waitForSelector"]));
      expect(life.unreleasedGates).toBe(1);
      expect(life.leakedPages).toBe(2);
      expect(gate.released).toBe(true);
      // Released and then closed: each navigation either finished or was cut off, and neither is left pending.
      await Promise.all([navigation, contextHeld]);
      // Reading the counter of a page that is mid-navigation can fail; that is counted, and the page still closes.
      expect(life.survivorPages).toBe(0);

      // After cleanup nothing is pending, the test routes are gone, and the permanent loopback route still blocks other origins.
      tracker.beginTest();
      const after = await context.newPage();
      await after.goto(`${origin}/held-resource`).catch(() => undefined);
      const blocked = session.ledger.nonLoopback.length;
      await after.goto("http://example.invalid/").catch(() => undefined);
      expect(session.ledger.nonLoopback.length).toBeGreaterThan(blocked);
      await after.close();
      const quiet = await tracker.endTest();
      expect(quiet).toMatchObject({ pendingRoutes: 0, unreleasedGates: 0, leakedPages: 0 });
      expect(quiet.pendingApiCalls).toEqual([]);
      tracker.beginTest();
      const guarded = await session.browser.newContext();
      const guardPage = await guarded.newPage();
      const before = session.ledger.nonLoopback.length;
      await guardPage.goto("http://example.invalid/").catch(() => undefined);
      expect(session.ledger.nonLoopback.length).toBeGreaterThan(before);
      await guarded.close();
      expect((await tracker.endTest()).leakedContexts).toBe(0);
    } finally {
      await session.close();
    }
    recordCheck("harness.lifecycle-pending");
  });

  it("puts the shared context back online after a test that went offline and did not return", async () => {
    const session = await privateSession();
    try {
      const { tracker, context } = session;
      tracker.beginTest();
      await context.setOffline(true);
      await tracker.endTest();
      tracker.beginTest();
      const page = await context.newPage();
      await page.goto(`${inject("origin")}/`);
      await page.close();
      expect((await tracker.endTest()).leakedPages).toBe(0);
    } finally {
      await session.close();
    }
    recordCheck("harness.lifecycle-pending");
  });
});

describe("per-test timing and the host clock watch", () => {
  it("ranks p50 and p95 by nearest rank, rounds, and marks a test the hooks did not measure as null rather than zero", () => {
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(sorted, 50)).toBe(50);
    expect(percentile(sorted, 95)).toBe(100);
    expect(percentile([7], 95)).toBe(7);
    expect(percentile([], 95)).toBe(0);
    const runner: RunnerTest[] = [
      { file: "tests/a.e2e.test.ts", name: "a > one", state: "pass", durationMs: 1500 },
      { file: "tests/a.e2e.test.ts", name: "a > one", state: "fail", durationMs: 15727 },
      { file: "tests/b.e2e.test.ts", name: "b > plain", state: "pass", durationMs: 2 },
      { file: "tests/b.e2e.test.ts", name: "b > skipped", state: "skip", durationMs: 0 },
    ];
    const host = { intervalMs: 250, samples: 3, maxWallStepMs: 0, maxLoopStallMs: 0, events: [], droppedEvents: 0, pressure: null };
    const hooks = [
      { file: "tests/a.e2e.test.ts", name: "a > one", wallMs: 1490, monoMs: 1490, clockStepMs: 0, maxLoopStallMs: 5, cpuMs: 200, memoryFullMs: 0 },
      { file: "tests/a.e2e.test.ts", name: "a > one", wallMs: 60000, monoMs: 15700, clockStepMs: 44300, maxLoopStallMs: 44000, cpuMs: 10, memoryFullMs: 43000 },
    ];
    const { block, problems } = buildTiming(runner, hooks, host);
    expect(problems).toEqual([]);
    expect(block.count).toBe(4);
    expect(block.measured).toBe(2);
    expect(block.ranked).toBe(3);
    expect(block.p95Ms).toBe(15727);
    expect(block.maxClockStepMs).toBe(44300);
    expect(block.maxMemoryFullMs).toBe(43000);
    // The failed test overlapped a 44 s clock step and a 44 s stall, so the record says a host event, not a test defect.
    expect(block.failed).toEqual({ withHostEvent: 1, withoutHostEvent: 0, unmeasured: 0 });
    expect(buildTiming([{ ...runner[0]!, state: "fail" }, { ...runner[2]!, state: "fail" }], [hooks[0]!], host).block.failed).toEqual({ withHostEvent: 0, withoutHostEvent: 1, unmeasured: 1 });
    expect(block.tests[2]).toMatchObject({ wallMs: null, clockStepMs: null, cpuMs: null });
    expect(block.tests[1]).toMatchObject({ state: "fail", wallMs: 60000, clockStepMs: 44300 });
    const stray = buildTiming(runner, [...hooks, { ...hooks[0]!, name: "a > not a test" }], host);
    expect(stray.problems.join("\n")).toMatch(/match no Vitest test/);
    expect(buildTiming([], [], host).problems.join("\n")).toMatch(/no per-test duration/);
    expect(testFullName({ name: "t", suite: { name: "inner", type: "suite", suite: { name: "outer", type: "suite", suite: { name: "f.ts", type: "file" } } } })).toBe("outer > inner > t");
    const stop = startMeasure("tests/x.e2e.test.ts", "x");
    const line = stop();
    for (const value of [line.wallMs, line.monoMs, line.clockStepMs, line.maxLoopStallMs, line.cpuMs, line.memoryFullMs]) {
      expect(value === null || Number.isInteger(value)).toBe(true);
    }
    recordCheck("harness.timing");
  });

  it("sees a wall clock that steps forward while the monotonic clock does not, and an event loop that stalls", async () => {
    const real = Date.now.bind(Date);
    let offset = 0;
    const spy = vi.spyOn(Date, "now").mockImplementation(() => real() + offset);
    try {
      const watch = watchClock(20, 100);
      await new Promise((resolve) => setTimeout(resolve, 70));
      offset = 5000;
      await new Promise((resolve) => setTimeout(resolve, 70));
      const report = watch.stop();
      expect(report.maxWallStepMs).toBeGreaterThanOrEqual(4900);
      expect(report.events.some((event) => event.wallStepMs >= 4900)).toBe(true);
    } finally {
      spy.mockRestore();
    }
    const stalled = watchClock(20, 100);
    await new Promise((resolve) => setTimeout(resolve, 30));
    const until = performance.now() + 250;
    while (performance.now() < until) {
      // Blocks the event loop on purpose.
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
    const stall = stalled.stop();
    expect(stall.maxLoopStallMs).toBeGreaterThanOrEqual(200);
    // Linux hosts report pressure counters; others report null, never a made-up zero.
    expect(stall.pressure === null || (stall.pressure.memoryFullMs >= 0 && stall.pressure.memAvailableMinMb !== 0)).toBe(true);
    recordCheck("harness.timing");
  });
});
