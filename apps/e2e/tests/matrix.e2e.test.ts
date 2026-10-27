import { describe, expect, it } from "vitest";
import { JOURNEYS, MATRIX, OUTCOMES, expectedCheckIds, matrixProblems, SEND_CONTROL_JOURNEYS, oneAttemptCheckIds } from "../src/journey-matrix";
import { NOT_RUN, renderRecord, type RunRecord } from "../src/run-record";
import { lifecycleFixture, timingFixture } from "./record-fixtures";

describe("journey matrix", () => {
  it("has exactly one cell for every journey and outcome, each with the evidence its kind needs", () => {
    expect(MATRIX).toHaveLength(JOURNEYS.length * OUTCOMES.length);
    expect(matrixProblems()).toEqual([]);
  });

  it("names a unique check for every browser or checked reference cell", () => {
    const ids = MATRIX.filter((cell) => cell.checkId).map((cell) => cell.checkId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(expectedCheckIds()).toEqual(expect.arrayContaining(ids as string[]));
  });

  it("marks only honestly unreachable UNKNOWN cells as not reachable, each owned by the fault-injection node", () => {
    const unreachable = MATRIX.filter((cell) => cell.kind === "NOT_REACHABLE");
    expect(unreachable.every((cell) => cell.outcome === "UNKNOWN" && cell.owner === "c-fault-injection-stub")).toBe(true);
    expect(unreachable.map((cell) => cell.journey).sort()).toEqual(["admission", "box-office", "credit", "marketing", "marketing-m01", "marketing-m02", "marketing-m03", "marketing-m04"]);
  });

  it("requires every send journey one-attempt check, including the existing booking checks", () => {
    for (const journey of SEND_CONTROL_JOURNEYS) {
      expect(expectedCheckIds()).toEqual(expect.arrayContaining([...oneAttemptCheckIds(journey)]));
    }
    expect(oneAttemptCheckIds("booking")).toEqual(["one-attempt.double-click", "one-attempt.keyboard", "one-attempt.reload"]);
  });

  it("renders a run record that claims no HTTP-mode pass, no production qualification and no payment", () => {
    const record: RunRecord = {
      mode: "stub",
      bind: "127.0.0.1",
      date: "2026-10-16",
      chrome: "Chrome test",
      playwrightCore: "1.58.2",
      baseMainSha: "0".repeat(7),
      ledger: { nonLoopback: 0, nonGet: 0, appNetworkCalls: 0 },
      claims: { httpModePass: false, productionQualification: false, realPayment: false, released: false },
      checks: [{ checkId: "x", pass: true }],
      timing: timingFixture(),
      lifecycle: lifecycleFixture(),
      notRun: [...NOT_RUN],
    };
    const parsed = JSON.parse(renderRecord(record)) as RunRecord;
    expect(Object.values(parsed.claims).every((value) => value === false)).toBe(true);
    expect(parsed.notRun.join(" ")).toMatch(/HTTP mode/);
    expect(() => renderRecord({ ...record, chrome: "owner@example.com" })).toThrow(/sensitive/);
  });
});
