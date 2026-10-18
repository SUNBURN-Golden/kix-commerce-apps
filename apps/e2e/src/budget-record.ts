import fs from "node:fs";
import path from "node:path";
import { findSensitiveInRecord } from "./redact";
import { recordDir } from "./run-record";

/** One measured scenario: every run's value, in milliseconds. A tripwire reading, not a service level. */
export interface RenderMeasurement {
  id: string;
  runs: number[];
  min: number;
  median: number;
  max: number;
  capMs: number;
  rows: number;
  domNodes: number;
}

export interface SplitMeasurement {
  /** Gzip bytes of the JS files the browser requested when it loaded "/". */
  landingJsGzip: number;
  landingJsFiles: number;
}

export interface BudgetRecord {
  kind: "bundle-budget-observation";
  mode: "stub";
  scope: string;
  bind: string;
  date: string;
  appHead: string;
  baseMainSha: string;
  chrome: string;
  claims: { slo: false; qualification: false; productionPerformance: false; released: false };
  split: SplitMeasurement | null;
  render: RenderMeasurement[];
  chunkFailure: { observations: { id: string; note: string }[] };
  ledger: { nonLoopback: number; nonGet: number; appNetworkCalls: number };
  notRun: string[];
}

export const BUDGET_NOT_RUN = [
  "a runner other than this one: caps are a multiple of one local median, and a single run is not a service level",
  "HTTP mode in a browser (needs a kix-protocol gate change)",
  "real device, throttled CPU or throttled network",
  "screen reader",
  "production, public deployment or any SLO",
] as const;

const file = (name: string) => path.join(recordDir(), name);

export function recordLine(name: string, value: object): void {
  fs.appendFileSync(file(name), JSON.stringify(value) + "\n");
}

export function readLines<T>(dir: string, name: string): T[] {
  const target = path.join(dir, name);
  if (!fs.existsSync(target)) {
    return [];
  }
  return fs
    .readFileSync(target, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);
}

export function renderBudgetRecord(record: BudgetRecord): string {
  const hits = findSensitiveInRecord(record);
  if (hits.length > 0) {
    throw new Error(`The budget record holds text that looks sensitive: ${hits.join(", ")}`);
  }
  return JSON.stringify(record, null, 2);
}

export const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};
