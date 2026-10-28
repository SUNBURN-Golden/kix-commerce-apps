import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TestProject } from "vitest/node";
import { watchClock, type ClockReport } from "./clock-watch";
import { recordDir } from "./record-dir";

/**
 * Per-test timing for the run records.
 *
 * `durationMs` and `state` come from Vitest's own result for every test, so each test has them. The wall, step,
 * loop-stall and CPU figures come from hooks that `useBrowser` registers, so only tests that use the browser
 * have them. For the rest those fields are `null`: unavailable, never zero. All figures are whole milliseconds,
 * so no 9-digit run reaches the record redaction scan.
 */

const E2E_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The path of a test file relative to `apps/e2e`, with forward slashes. */
export function relativeTestFile(filepath: string): string {
  return path.relative(E2E_ROOT, filepath).split(path.sep).join("/");
}

interface NamedTask {
  name: string;
  type?: string;
  suite?: NamedTask;
}

/** "describe > nested describe > test": the same text Vitest's `TestCase.fullName` gives on the main side. */
export function testFullName(task: NamedTask): string {
  const names = [task.name];
  for (let parent = task.suite; parent && parent.type !== "file"; parent = parent.suite) {
    if (parent.name !== "") {
      names.unshift(parent.name);
    }
  }
  return names.join(" > ");
}

export interface HookTiming {
  file: string;
  name: string;
  wallMs: number;
  monoMs: number;
  /** Wall ms minus monotonic ms over the test. Positive: the wall clock ran ahead of the monotonic clock. */
  clockStepMs: number;
  maxLoopStallMs: number;
  cpuMs: number;
  /** Memory `full` stall ms the kernel counted during the test (`/proc/pressure/memory`). Null where the host has none. */
  memoryFullMs: number | null;
}

/** Starts measuring one test. Call the result when the test body and its own hooks are done. */
export function startMeasure(file: string, name: string): () => HookTiming {
  const wall = Date.now();
  const mono = performance.now();
  const cpu = process.cpuUsage();
  const watch = watchClock();
  return () => {
    const report = watch.stop();
    const wallMs = Date.now() - wall;
    const monoMs = performance.now() - mono;
    const used = process.cpuUsage(cpu);
    return {
      file,
      name,
      wallMs: Math.round(wallMs),
      monoMs: Math.round(monoMs),
      clockStepMs: Math.round(wallMs - monoMs),
      maxLoopStallMs: report.maxLoopStallMs,
      cpuMs: Math.round((used.user + used.system) / 1000),
      memoryFullMs: report.pressure?.memoryFullMs ?? null,
    };
  };
}

export function recordTiming(line: HookTiming): void {
  fs.appendFileSync(path.join(recordDir(), "timings.jsonl"), JSON.stringify(line) + "\n");
}

export function readTimings(dir: string): HookTiming[] {
  const file = path.join(dir, "timings.jsonl");
  if (!fs.existsSync(file)) {
    return [];
  }
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as HookTiming);
}

/** A wall-clock step or event-loop stall this long overlapping a test is recorded as a host event. */
const HOST_EVENT_MS = 1000;

export type TestState = "pass" | "fail" | "skip";

/** One test as Vitest's final state reports it, after every hook and teardown assertion ran. */
export interface RunnerTest {
  file: string;
  name: string;
  state: TestState;
  durationMs: number | null;
}

export interface TestTiming extends RunnerTest {
  wallMs: number | null;
  clockStepMs: number | null;
  maxLoopStallMs: number | null;
  cpuMs: number | null;
  memoryFullMs: number | null;
}

export interface TimingBlock {
  source: "vitest-state+hooks";
  /** Tests Vitest ran (passed, failed or skipped). */
  count: number;
  /** Tests with hook measurements (wall, clock step, loop stall, CPU). */
  measured: number;
  /** p50 and p95 are nearest-rank over `durationMs` of passed and failed tests. Skipped tests are left out. */
  ranked: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  /** The largest `clockStepMs` over measured tests. */
  maxClockStepMs: number;
  maxLoopStallMs: number;
  maxMemoryFullMs: number;
  /**
   * Failed tests by what the hooks saw while they ran. `withHostEvent`: a wall-clock step or an event-loop stall of at
   * least one second overlapped the test (a host pause is a candidate cause). `withoutHostEvent`: neither did, so the
   * failure is not explained by the clock. `unmeasured`: the test has no hook measurement.
   */
  failed: { withHostEvent: number; withoutHostEvent: number; unmeasured: number };
  hostClock: ClockReport;
  tests: TestTiming[];
}

/** Nearest-rank percentile of an ascending list. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1] ?? 0;
}

/** Reads every test's final result from the Vitest instance. Run it in the global teardown. */
export function collectRunnerTests(project: TestProject): RunnerTest[] {
  const out: RunnerTest[] = [];
  for (const module of project.vitest.state.getTestModules()) {
    const file = relativeTestFile(module.moduleId);
    for (const test of module.children.allTests()) {
      const result = test.result().state;
      const state: TestState = result === "passed" ? "pass" : result === "failed" ? "fail" : "skip";
      const duration = test.diagnostic()?.duration;
      out.push({ file, name: test.fullName, state, durationMs: duration === undefined ? null : Math.round(duration) });
    }
  }
  return out;
}

/**
 * Joins Vitest's results with the hook measurements by file and test name (a repeated name pairs in order).
 * A hook line with no Vitest test, or a Vitest test that ran twice with only one line, is a problem, not a blank.
 */
export function buildTiming(runner: readonly RunnerTest[], hooks: readonly HookTiming[], host: ClockReport): { block: TimingBlock; problems: string[] } {
  const problems: string[] = [];
  if (runner.length === 0) {
    problems.push("timing: Vitest reported no tests, so no per-test duration exists");
  }
  const queue = new Map<string, HookTiming[]>();
  for (const line of hooks) {
    const key = `${line.file}\u0000${line.name}`;
    queue.set(key, [...(queue.get(key) ?? []), line]);
  }
  const tests: TestTiming[] = runner.map((test) => {
    const line = queue.get(`${test.file}\u0000${test.name}`)?.shift();
    return {
      ...test,
      wallMs: line?.wallMs ?? null,
      clockStepMs: line?.clockStepMs ?? null,
      maxLoopStallMs: line?.maxLoopStallMs ?? null,
      cpuMs: line?.cpuMs ?? null,
      memoryFullMs: line?.memoryFullMs ?? null,
    };
  });
  for (const [key, left] of queue) {
    if (left.length > 0) {
      problems.push(`timing: ${left.length} hook measurement(s) match no Vitest test: ${key.replace("\u0000", " :: ")}`);
    }
  }
  for (const test of tests) {
    if (test.state !== "skip" && test.durationMs === null) problems.push(`timing: missing runner duration for ${test.file} :: ${test.name}`);
  }
  const ranked = tests.flatMap((test) => test.state !== "skip" && test.durationMs !== null ? [test.durationMs] : []).sort((a, b) => a - b);
  const measured = tests.filter((test) => test.wallMs !== null);
  const failed = tests.filter((test) => test.state === "fail");
  const hostEvent = (test: TestTiming) => Math.max(Math.abs(test.clockStepMs ?? 0), test.maxLoopStallMs ?? 0) >= HOST_EVENT_MS;
  const max = (values: (number | null)[]) => Math.max(0, ...values.map((value) => value ?? 0));
  return {
    block: {
      source: "vitest-state+hooks",
      count: tests.length,
      measured: measured.length,
      ranked: ranked.length,
      p50Ms: percentile(ranked, 50),
      p95Ms: percentile(ranked, 95),
      maxMs: ranked[ranked.length - 1] ?? 0,
      maxClockStepMs: max(measured.map((test) => test.clockStepMs)),
      maxLoopStallMs: max(measured.map((test) => test.maxLoopStallMs)),
      maxMemoryFullMs: max(measured.map((test) => test.memoryFullMs)),
      failed: {
        withHostEvent: failed.filter((test) => test.wallMs !== null && hostEvent(test)).length,
        withoutHostEvent: failed.filter((test) => test.wallMs !== null && !hostEvent(test)).length,
        unmeasured: failed.filter((test) => test.wallMs === null).length,
      },
      hostClock: host,
      tests,
    },
    problems,
  };
}
