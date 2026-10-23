import type { ScreenStateCell } from "../../src/async-state/matrix";

export interface ExecutedStateTest { file: string; title: string; state: string }

/** A title found in a file is not evidence: it must have executed and passed exactly once. */
export function referenceProblems(cells: readonly ScreenStateCell[], results: readonly ExecutedStateTest[]): string[] {
  const problems: string[] = [];
  for (const cell of cells) {
    if (cell.kind !== "REFERENCE" || !cell.check || !("file" in cell.check)) continue;
    const check = cell.check;
    const matches = results.filter((result) => result.file === check.file && result.title === check.title);
    if (matches.length > 1) problems.push(`ambiguous reference ${cell.checkId}: ${check.file}#${check.title}`);
    if (matches.length !== 1 || matches[0]?.state !== "passed") problems.push(`reference did not pass ${cell.checkId}: ${check.file}#${check.title}`);
  }
  return problems;
}
