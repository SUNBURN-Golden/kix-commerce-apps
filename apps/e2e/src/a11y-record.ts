import fs from "node:fs";
import path from "node:path";
import type { LifecycleBlock } from "./lifecycle";
import { findSensitiveInRecord } from "./redact";
import { recordDir } from "./record-dir";
import type { TimingBlock } from "./timing";
import type { ManualFacet, ScreenRecord, ViewportName } from "./a11y-matrix";

/** One line per observation. Only ids, rule ids and fixed words are written: no DOM text and no typed values. */
export type FacetLine =
  | { kind: "axe"; screenId: string; viewport: ViewportName; violations: string[]; incomplete: string[] }
  | { kind: "keyboard" | "reflow" | "structure"; screenId: string; result: ManualFacet; problems: string[] }
  | { kind: "observation"; id: string; note: string };

export function recordFacet(line: FacetLine): void {
  fs.appendFileSync(path.join(recordDir(), "facets.jsonl"), JSON.stringify(line) + "\n");
}

export function readFacets(dir: string): FacetLine[] {
  const file = path.join(dir, "facets.jsonl");
  if (!fs.existsSync(file)) {
    return [];
  }
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as FacetLine);
}

export interface A11yRecord {
  kind: "a11y-observation";
  mode: "stub";
  source: "stub-shape";
  bind: string;
  date: string;
  appHead: string;
  baseMainSha: string;
  tool: { axe: string; playwrightCore: string; chrome: string };
  tags: readonly string[];
  targetStandard: "UNDETERMINED";
  ledger: { nonLoopback: number; nonGet: number; appNetworkCalls: number };
  claims: {
    wcagConformance: false;
    userAccepted: false;
    assistiveTechRun: false;
    released: false;
    productionQualification: false;
  };
  screens: ScreenRecord[];
  findings: { screenId: string; viewport: ViewportName; ruleId: string; status: "OPEN" | "FIXED" }[];
  observations: { id: string; note: string }[];
  checkIds: string[];
  /** Per-test duration, wall and monotonic time, and the host clock watch. */
  timing: TimingBlock;
  /** Browsers, contexts and pages opened and closed, and what tests left open or pending. */
  lifecycle: LifecycleBlock;
  notRun: string[];
}

export const A11Y_NOT_RUN = [
  "screen reader (NVDA, JAWS, VoiceOver, TalkBack)",
  "real device and touch",
  "browser zoom (a 200% root font size probe is an approximation only)",
  "browsers other than Chrome",
  "HTTP mode in a browser (the gate sends no CORS header)",
  "integration-http not-bound state in a browser",
  "a target standard and level (UNDETERMINED)",
  "user acceptance (PENDING for every screen)",
  "release permission (NOT_AUTHORIZED)",
] as const;

/** The type has no accepted or rejected value. This guards a record that came from somewhere else. */
export function assertNoAcceptance(value: unknown): void {
  const text = JSON.stringify(value);
  if (/"(ACCEPTED|REJECTED|APPROVED|CONFORMANT)"/.test(text)) {
    throw new Error("An acceptance, approval or conformance state was found. This node only writes PENDING.");
  }
  if (/"(inheritedFrom|approvedBy)":\s*"[^"]+/.test(text)) {
    throw new Error("An inherited approval was found. Other products' and earlier stub approvals are not reused.");
  }
}

export function renderA11yRecord(record: A11yRecord): string {
  assertNoAcceptance(record);
  if (Object.values(record.claims).some((claim) => claim !== false)) {
    throw new Error("Every claim in the accessibility record must be false.");
  }
  const hits = findSensitiveInRecord(record);
  if (hits.length > 0) {
    throw new Error(`The accessibility record holds text that looks sensitive: ${hits.join(", ")}`);
  }
  return JSON.stringify(record, null, 2);
}
