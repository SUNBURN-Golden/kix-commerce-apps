import fs from "node:fs";
import path from "node:path";
import { findSensitive } from "./redact";

export interface CheckLine {
  checkId: string;
  pass: boolean;
}

export function recordDir(): string {
  const dir = process.env.KIX_E2E_RECORD_DIR;
  if (!dir) {
    throw new Error("KIX_E2E_RECORD_DIR is not set. The global setup sets it.");
  }
  return dir;
}

/** Appends one passed check. Only the id and the result are written. */
export function recordCheck(checkId: string): void {
  fs.appendFileSync(path.join(recordDir(), "checks.jsonl"), JSON.stringify({ checkId, pass: true } satisfies CheckLine) + "\n");
}

export function readChecks(dir: string): CheckLine[] {
  const file = path.join(dir, "checks.jsonl");
  if (!fs.existsSync(file)) {
    return [];
  }
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as CheckLine);
}

export interface RunRecord {
  mode: "stub";
  bind: string;
  date: string;
  chrome: string;
  playwrightCore: string;
  baseMainSha: string;
  ledger: { nonLoopback: number; nonGet: number; appNetworkCalls: number };
  claims: { httpModePass: false; productionQualification: false; realPayment: false; released: false };
  checks: CheckLine[];
  notRun: string[];
}

export const NOT_RUN = [
  "HTTP mode in a browser (needs a kix-protocol gate change)",
  "latency injection and SLO figures (fault cells are in the separate fault record)",
  "in-flight screen (the stub resolves at once)",
  "real device",
  "screen reader",
  "axe or other automated a11y acceptance (c-a11y-acceptance-stub)",
] as const;

export function renderRecord(record: RunRecord): string {
  const text = JSON.stringify(record, null, 2);
  const hits = findSensitive(text);
  if (hits.length > 0) {
    throw new Error(`The run record holds text that looks sensitive: ${hits.join(", ")}`);
  }
  return text;
}

export interface LedgerLine {
  chrome: string;
  nonLoopback: number;
  nonGet: number;
  appNetworkCalls: number;
}

export function recordLedger(line: LedgerLine): void {
  fs.appendFileSync(path.join(recordDir(), "ledger.jsonl"), JSON.stringify(line) + "\n");
}

export function readLedger(dir: string): LedgerLine[] {
  const file = path.join(dir, "ledger.jsonl");
  if (!fs.existsSync(file)) {
    return [];
  }
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as LedgerLine);
}

/** The fault record is a separate document from the journeys record. It goes through the same redaction check. */
export function renderFaultRecord(record: object): string {
  const text = JSON.stringify(record, null, 2);
  const hits = findSensitive(text);
  if (hits.length > 0) {
    throw new Error(`The fault record holds text that looks sensitive: ${hits.join(", ")}`);
  }
  return text;
}
