import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ALT_STATES, KNOWN_FINDINGS, SCREENS } from "../../src/a11y-matrix";
import { ROUTES } from "../../../web/src/shell/route-registry";
import { A11Y_NOT_RUN, assertNoAcceptance, renderA11yRecord, type A11yRecord } from "../../src/a11y-record";
import { recordCheck } from "../../src/run-record";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const doc = read("docs/c-a11y-acceptance-stub-apps-bind.md");

/** The routes the app draws, read from the route registry that App.tsx and the nav derive from. The discovery alias is not a registry route. */
function appRoutes(): string[] {
  expect(read("apps/web/src/App.tsx"), "App.tsx writes no route path of its own").not.toMatch(/<Route\s+path="\//);
  return ROUTES.map((route) => route.path);
}

function minimalRecord(): A11yRecord {
  return {
    kind: "a11y-observation",
    mode: "stub",
    source: "stub-shape",
    bind: "127.0.0.1",
    date: "2026-10-17",
    appHead: "head",
    baseMainSha: "base",
    tool: { axe: "4.14.0", playwrightCore: "1.58.2", chrome: "x" },
    tags: [],
    targetStandard: "UNDETERMINED",
    ledger: { nonLoopback: 0, nonGet: 0, appNetworkCalls: 0 },
    claims: { wcagConformance: false, userAccepted: false, assistiveTechRun: false, released: false, productionQualification: false },
    screens: [],
    findings: [],
    observations: [],
    checkIds: [],
    notRun: [...A11Y_NOT_RUN],
  };
}

describe("user acceptance matrix: every screen is PENDING, and nothing here can say ACCEPTED", () => {
  it("the screen rows equal the registry routes (the discovery alias excluded) and the nav links are all covered", () => {
    const patterns = SCREENS.map((screen) => screen.pattern).sort();
    expect(patterns).toEqual(appRoutes().sort());
    const paths = new Set(SCREENS.map((screen) => screen.pattern));
    for (const link of ROUTES.filter((route) => route.nav === "link")) {
      expect(paths.has(link.path), `a nav link without a screen row: ${link.path}`).toBe(true);
    }
  });

  it("the doc's user acceptance table has one PENDING row per screen and no accepted row", () => {
    const table = doc.split("## User acceptance matrix")[1]?.split("\n## ")[0] ?? "";
    for (const screen of SCREENS) {
      const line = table.split("\n").find((entry) => entry.startsWith("|") && entry.includes(`\`${screen.screenId}\``));
      expect(line, `a user acceptance row for ${screen.screenId}`).toBeDefined();
      expect(line).toContain("PENDING");
    }
    for (const line of doc.split("\n").filter((entry) => entry.startsWith("|"))) {
      expect(line, "a table row must not carry an accepted state").not.toMatch(/\b(ACCEPTED|REJECTED|APPROVED)\b/);
    }
    for (const state of ALT_STATES) {
      expect(doc, `the doc names the alternate state ${state.id}`).toContain(state.id);
    }
  });

  it("every KNOWN_FINDING refers to a screen row or an alternate state, and is listed in the doc", () => {
    const ids = new Set([...SCREENS.map((screen) => screen.screenId), ...ALT_STATES.map((state) => state.id)]);
    for (const finding of KNOWN_FINDINGS) {
      expect(ids.has(finding.screenId)).toBe(true);
      expect(doc, `finding ${finding.screenId} ${finding.ruleId} in the doc`).toContain(finding.ruleId);
    }
  });

  it("the record writer refuses an accepted state, an inherited approval, and any true claim", () => {
    expect(() => renderA11yRecord(minimalRecord())).not.toThrow();
    expect(() => assertNoAcceptance({ userAcceptance: { state: "ACCEPTED" } })).toThrow();
    expect(() => assertNoAcceptance({ userAcceptance: { state: "PENDING", inheritedFrom: "c-browser-e2e-stub" } })).toThrow();
    expect(() => assertNoAcceptance({ userAcceptance: { state: "PENDING", inheritedFrom: null } })).not.toThrow();
    const lying = minimalRecord();
    (lying.claims as Record<string, boolean>).userAccepted = true;
    expect(() => renderA11yRecord(lying)).toThrow();
    const leaky = minimalRecord();
    leaky.notRun = ["person@example.com"];
    expect(() => renderA11yRecord(leaky)).toThrow();
  });

  it("CI, observation, acceptance and release are separate: the record has no CI field, and the doc says so", () => {
    expect(Object.keys(minimalRecord())).not.toContain("ci");
    expect(doc).toMatch(/CI (status )?is not (a field|recorded)/i);
    expect(doc).toContain("NOT_AUTHORIZED");
    recordCheck("a11y.accept.pending");
  });
});
