import { describe, expect, it } from "vitest";
import { A11Y_NOT_RUN, renderA11yRecord, type A11yRecord } from "../src/a11y-record";
import { findSensitive, findSensitiveInRecord, maskGitIds } from "../src/redact";
import { NOT_RUN, renderFaultRecord, renderRecord, type RunRecord } from "../src/run-record";

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
      notRun: [...A11Y_NOT_RUN],
    };
    const parsed = JSON.parse(renderA11yRecord(a11y)) as A11yRecord;
    expect(parsed.appHead).toBe(MERGE_ID_WITH_DIGIT_RUN);
    expect(parsed.screens[0]!.userAcceptance.evidenceHead).toBe(MERGE_ID_WITH_DIGIT_RUN);
    expect(() => renderFaultRecord({ ...fault, note: "12345678901" })).toThrow(/long-digits/);
    expect(() => renderA11yRecord({ ...a11y, tool: { ...a11y.tool, chrome: "owner@example.com" } })).toThrow(/email/);
  });
});
