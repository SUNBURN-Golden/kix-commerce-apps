import type { TestProject } from "vitest/node";
import { watchClock } from "./clock-watch";
import { lifecycleProblems, readLifecycle, summarizeLifecycle, type LifecycleBlock } from "./lifecycle";
import { buildTiming, collectRunnerTests, readTimings, type TimingBlock } from "./timing";

export interface RunDiagnostics {
  timing: TimingBlock;
  lifecycle: LifecycleBlock;
  /** Defects in the timing or lifecycle evidence itself. The caller adds them to the run's problems. */
  problems: string[];
}

export interface RunDiagnosticsWatch {
  /** Call in the global teardown, after every test file ran. `sessions` is how many browser sessions reported a ledger. */
  finish: (recordDir: string, sessions: number) => RunDiagnostics;
}

/** Starts the main-process clock watch. Call it in the global setup, once the project is known. */
export function startRunDiagnostics(project: TestProject): RunDiagnosticsWatch {
  const watch = watchClock();
  return {
    finish: (recordDir, sessions) => {
      const host = watch.stop();
      const hooks = readTimings(recordDir);
      const lines = readLifecycle(recordDir);
      const { block: timing, problems } = buildTiming(collectRunnerTests(project), hooks, host);
      const lifecycle = summarizeLifecycle(lines);
      problems.push(...lifecycleProblems(lifecycle, sessions));
      if (sessions > 0 && timing.measured === 0) {
        problems.push("timing: browser sessions ran but no test has a hook measurement");
      }
      for (const test of lifecycle.tests) {
        if (!hooks.some((hook) => hook.file === test.file && hook.name === test.name)) {
          problems.push(`timing: missing hook measurement for browser test ${test.file} :: ${test.name}`);
        }
      }
      if (hooks.length !== lifecycle.testsTracked) {
        problems.push(`timing: ${hooks.length} timing lines and ${lifecycle.testsTracked} lifecycle test lines disagree`);
      }
      return { timing, lifecycle, problems };
    },
  };
}
