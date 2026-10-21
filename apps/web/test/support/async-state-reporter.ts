import path from "node:path";
import type { Reporter, TestModule } from "vitest/node";
import { SCREEN_STATE_MATRIX } from "../../src/async-state/matrix";
import { referenceProblems } from "./async-state-references";

/** When the matrix runs, all of its web evidence must run too. A partial run cannot claim the matrix. */
export class AsyncStateReporter implements Reporter {
  onTestRunEnd(modules: readonly TestModule[]) {
    if (!modules.some((module) => module.moduleId.endsWith("/async-state-matrix.test.tsx"))) return;
    const results = modules.flatMap((module) => [...module.children.allTests()].map((test) => ({ file: path.basename(module.moduleId), title: test.name, state: test.result().state })));
    const problems = referenceProblems(SCREEN_STATE_MATRIX, results);
    if (problems.length) throw new Error(`Async state matrix evidence incomplete:\n${problems.join("\n")}`);
  }
}
