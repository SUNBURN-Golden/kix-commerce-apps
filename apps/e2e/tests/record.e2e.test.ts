import { describe, expect, it } from "vitest";
import { A11Y_NOT_RUN, renderA11yRecord, type A11yRecord } from "../src/a11y-record";
import { BUDGET_NOT_RUN, renderBudgetRecord, type BudgetRecord } from "../src/budget-record";
import { lifecycleProblems, summarizeLifecycle, type LifecycleLine } from "../src/lifecycle";
import { findSensitive, findSensitiveInRecord, maskGitIds } from "../src/redact";
import { NOT_RUN, recordCheck, renderFaultRecord, renderRecord, type RunRecord } from "../src/run-record";
import { VISUAL_NOT_RUN, koreanLayoutNote, renderVisualRecord, type VisualRecord } from "../src/visual-record";
import { lifecycleFixture, timingFixture } from "./record-fixtures";

/** The refs/pull/75/merge commit CI ran at. Its hex holds an eleven digit run, so the raw text scan flagged it. */
const MERGE_ID_WITH_DIGIT_RUN = "c17425a76a48010fa4ece21554538337cc301a5a";

const journeys: RunRecord = {
  mode: "stub",
  bind: "127.0.0.1",
  date: "2026-10-17",
  chrome: "Chrome test",
  playwrightCore: "1.58.2",
  baseMainSha: MERGE_ID_WITH_DIGIT_RUN,
  ledger: { nonLoopback: 0, nonGet: 0, appNetworkCalls: 0 },
  claims: { httpModePass: false, productionQualification: false, realPayment: false, released: false },
  checks: [{ checkId: "x", pass: true }],
  timing: timingFixture(),
  lifecycle: lifecycleFixture(),
  notRun: [...NOT_RUN],
};

describe("run records written by the teardown", () => {
  it("still flags a digit run in free text, and a git id outside its own keys", () => {
    expect(findSensitive(MERGE_ID_WITH_DIGIT_RUN)).toEqual(["long-digits"]);
    expect(findSensitiveInRecord({ chrome: MERGE_ID_WITH_DIGIT_RUN })).toEqual(["long-digits"]);
    expect(findSensitiveInRecord({ appHead: "owner@example.com" })).toEqual(["email"]);
    expect(findSensitiveInRecord({ appHead: "12345678901" })).toEqual(["long-digits"]);
  });

  it("masks only a 40-hex value under appHead, baseMainSha or evidenceHead", () => {
    expect(maskGitIds({ appHead: MERGE_ID_WITH_DIGIT_RUN, baseMainSha: "unknown", nested: [{ evidenceHead: MERGE_ID_WITH_DIGIT_RUN }] })).toEqual({
      appHead: "<git-object-id>",
      baseMainSha: "unknown",
      nested: [{ evidenceHead: "<git-object-id>" }],
    });
    expect(maskGitIds({ appHead: "C17425A76A48010FA4ECE21554538337CC301A5A" })).toEqual({ appHead: "C17425A76A48010FA4ECE21554538337CC301A5A" });
  });

  it("renders the journeys, fault and accessibility records at a merge commit whose id holds a digit run", () => {
    expect(JSON.parse(renderRecord(journeys)).baseMainSha).toBe(MERGE_ID_WITH_DIGIT_RUN);
    const fault = { suite: "fault-injection", appHead: MERGE_ID_WITH_DIGIT_RUN, baseMainSha: MERGE_ID_WITH_DIGIT_RUN, claims: { serviceQualification: false } };
    expect(JSON.parse(renderFaultRecord(fault)).appHead).toBe(MERGE_ID_WITH_DIGIT_RUN);
    const a11y: A11yRecord = {
      kind: "a11y-observation",
      mode: "stub",
      source: "stub-shape",
      bind: "127.0.0.1",
      date: "2026-10-17",
      appHead: MERGE_ID_WITH_DIGIT_RUN,
      baseMainSha: "unknown",
      tool: { axe: "4.14.0", playwrightCore: "1.58.2", chrome: "Chrome test" },
      tags: ["wcag2a"],
      targetStandard: "UNDETERMINED",
      ledger: { nonLoopback: 0, nonGet: 0, appNetworkCalls: 0 },
      claims: { wcagConformance: false, userAccepted: false, assistiveTechRun: false, released: false, productionQualification: false },
      screens: [
        {
          screenId: "discovery",
          path: "/discovery",
          automated: { desktop: { violations: [], incomplete: [] }, narrow: { violations: [], incomplete: [] } },
          keyboard: "OBSERVED",
          reflow: "OBSERVED",
          structure: "OBSERVED",
          assistiveTech: "NOT_RUN",
          userAcceptance: { state: "PENDING", decider: "user", baseline: "none", evidenceHead: MERGE_ID_WITH_DIGIT_RUN, inheritedFrom: null },
          release: "NOT_AUTHORIZED",
          traceCheckIds: [],
          outcome: "OBSERVED_CLEAN",
        },
      ],
      findings: [],
      observations: [],
      checkIds: [],
      timing: timingFixture(),
      lifecycle: lifecycleFixture(),
      notRun: [...A11Y_NOT_RUN],
    };
    const parsed = JSON.parse(renderA11yRecord(a11y)) as A11yRecord;
    expect(parsed.appHead).toBe(MERGE_ID_WITH_DIGIT_RUN);
    expect(parsed.screens[0]!.userAcceptance.evidenceHead).toBe(MERGE_ID_WITH_DIGIT_RUN);
    expect(() => renderFaultRecord({ ...fault, note: "12345678901" })).toThrow(/long-digits/);
    expect(() => renderA11yRecord({ ...a11y, tool: { ...a11y.tool, chrome: "owner@example.com" } })).toThrow(/email/);
  });
});

const closeLine = (overrides: Partial<Extract<LifecycleLine, { kind: "session-close" }>> = {}): LifecycleLine => ({
  kind: "session-close",
  file: "tests/a.e2e.test.ts",
  browsersOpened: 1,
  browsersClosed: 1,
  contextsOpened: 1,
  contextsClosed: 1,
  pagesOpened: 2,
  pagesClosed: 2,
  leakedPages: 0,
  leakedContexts: 0,
  fileScopePages: 0,
  pendingApiCalls: 0,
  pendingRoutes: 0,
  closeErrors: 0,
  ...overrides,
});

const testLine = (overrides: Partial<Extract<LifecycleLine, { kind: "test" }>> = {}): LifecycleLine => ({
  kind: "test",
  file: "tests/a.e2e.test.ts",
  name: "a > one",
  bodyFailed: false,
  leakedPages: 0,
  leakedContexts: 0,
  survivorPages: 0,
  survivorContexts: 0,
  pendingApiCalls: [],
  pendingRoutes: 0,
  unreleasedGates: 0,
  leakedPageNetworkCalls: 0,
  cleanupErrors: 0,
  counts: { browsersOpened: 0, browsersClosed: 0, contextsOpened: 0, contextsClosed: 0, pagesOpened: 1, pagesClosed: 1 },
  ...overrides,
});

describe("timing and lifecycle blocks in the run records", () => {
  it("serialise in all four record formats, with whole-millisecond figures and null for an unmeasured test", () => {
    const budget: BudgetRecord = {
      kind: "bundle-budget-observation",
      mode: "stub",
      scope: "test",
      bind: "127.0.0.1",
      date: "2026-10-26",
      appHead: MERGE_ID_WITH_DIGIT_RUN,
      baseMainSha: "unknown",
      chrome: "Chrome test",
      claims: { slo: false, qualification: false, productionPerformance: false, released: false },
      split: null,
      render: [],
      chunkFailure: { observations: [] },
      ledger: { nonLoopback: 0, nonGet: 0, appNetworkCalls: 0 },
      timing: timingFixture(),
      lifecycle: lifecycleFixture(),
      notRun: [...BUDGET_NOT_RUN],
    };
    const parsedBudget = JSON.parse(renderBudgetRecord(budget)) as BudgetRecord;
    expect(parsedBudget.appHead).toBe(MERGE_ID_WITH_DIGIT_RUN);
    expect(parsedBudget.timing.tests[2]?.wallMs).toBeNull();
    // No run began, so the visual record says the render profile is unavailable instead of inventing one.
    const early: VisualRecord = {
      kind: "visual-baseline-observation",
      mode: "stub",
      run: "compare",
      bind: "127.0.0.1",
      date: "2026-10-26",
      appHead: MERGE_ID_WITH_DIGIT_RUN,
      baseMainSha: "unknown",
      chrome: "unknown",
      playwrightCore: "1.58.2",
      profile: "unavailable",
      cjkGlyphs: "unavailable",
      koreanLayout: koreanLayoutNote("unavailable"),
      tolerance: { channelDelta: 2, maxDiffPpm: 100 },
      shots: [],
      ledger: { nonLoopback: 0, nonGet: 0, appNetworkCalls: 0 },
      claims: { qualification: false, userAccepted: false, released: false, designApproved: false, otherRunners: false },
      timing: timingFixture({ count: 0, measured: 0, ranked: 0, p50Ms: 0, p95Ms: 0, maxMs: 0, tests: [] }),
      lifecycle: lifecycleFixture({ sessions: 0, browsersOpened: 0, browsersClosed: 0, contextsOpened: 0, contextsClosed: 0, pagesOpened: 0, pagesClosed: 0, testsTracked: 0 }),
      notRun: [...VISUAL_NOT_RUN],
    };
    expect(JSON.parse(renderVisualRecord(early)).profile).toBe("unavailable");
    expect(koreanLayoutNote("unavailable")).toContain("no shot was rendered");
    // A figure that is not whole milliseconds can hold a 9-digit run, which the redaction scan refuses.
    expect(() => renderRecord({ ...journeys, timing: timingFixture({ p95Ms: 1234.567891234 }) })).toThrow(/sensitive/);
    // Nothing in a timing or lifecycle block needs a new git-id key.
    expect(findSensitiveInRecord({ appHead: MERGE_ID_WITH_DIGIT_RUN, timing: timingFixture(), lifecycle: lifecycleFixture() })).toEqual([]);
    for (const block of [journeys.timing, journeys.lifecycle]) {
      for (const value of Object.values(block)) {
        if (typeof value === "number") {
          expect(Number.isInteger(value)).toBe(true);
        }
      }
    }
    recordCheck("harness.records");
  });

  it("names a leak, a pending route, an unclosed browser and a missing session; a clean run has none and absent lines never read as zero", () => {
    const clean = summarizeLifecycle([{ kind: "session-open" }, testLine(), closeLine()]);
    expect(lifecycleProblems(clean, 1)).toEqual([]);
    expect(clean.testsTracked).toBe(1);
    expect(clean.tests[0]).toMatchObject({ file: "tests/a.e2e.test.ts", name: "a > one", counts: { pagesOpened: 1, pagesClosed: 1 } });
    expect(clean.files[0]?.file).toBe("tests/a.e2e.test.ts");
    const leaking = summarizeLifecycle([
      { kind: "session-open" },
      testLine({ leakedPages: 1, pendingRoutes: 2, pendingApiCalls: ["page.goto"], unreleasedGates: 1 }),
      testLine({ name: "a > failed", bodyFailed: true, leakedPages: 1 }),
      closeLine({ pagesClosed: 1, pendingRoutes: 1, leakedContexts: 1 }),
    ]);
    expect(leaking.leakedAtTestEnd).toBe(1);
    expect(leaking.leakedInFailedTests).toBe(1);
    const problems = lifecycleProblems(leaking, 1).join("\n");
    expect(problems).toMatch(/2 pages opened, 1 closed/);
    expect(problems).toMatch(/left open at the end of a test/);
    expect(problems).toMatch(/route handlers still pending at the end of a test/);
    expect(problems).toMatch(/Playwright calls still pending at the end of a test/);
    expect(problems).toMatch(/held gates never released/);
    expect(problems).toMatch(/left open at the end of a file/);
    expect(problems).toMatch(/route handlers still pending at the end of a file/);
    // A browser that opened and never reported closing is a defect, and so is a ledger with no lifecycle session behind it.
    expect(lifecycleProblems(summarizeLifecycle([{ kind: "session-open" }]), 1).join("\n")).toMatch(/1 browsers opened, 0 closed/);
    expect(lifecycleProblems(summarizeLifecycle([]), 3).join("\n")).toMatch(/0 browser sessions reported, 3 reported a ledger/);
    recordCheck("harness.records");
  });
});
