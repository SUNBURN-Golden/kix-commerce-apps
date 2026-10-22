import fs from "node:fs";
import path from "node:path";
import { findSensitiveInRecord } from "./redact";
import { recordDir } from "./run-record";
import type { RenderProfile, ShotResult } from "./visual-compare";

export interface ShotLine extends ShotResult {
  render: RenderProfile;
}

export interface VisualRecord {
  kind: "visual-baseline-observation";
  mode: "stub";
  /** `compare` is the pass evidence. `record-baselines` only wrote pictures and proves nothing. */
  run: "compare" | "record-baselines";
  bind: string;
  date: string;
  appHead: string;
  baseMainSha: string;
  chrome: string;
  playwrightCore: string;
  profile: string;
  cjkGlyphs: "present" | "missing";
  koreanLayout: string;
  tolerance: { channelDelta: number; maxDiffPpm: number };
  shots: ShotResult[];
  ledger: { nonLoopback: number; nonGet: number; appNetworkCalls: number };
  claims: { qualification: false; userAccepted: false; released: false; designApproved: false; otherRunners: false };
  notRun: string[];
}

export const VISUAL_NOT_RUN = [
  "a render profile other than the one named above: baselines are bound to the vendored fonts the browser resolved (a non-Linux runner needs its own)",
  "a Chrome version other than the one named above: a rendering change beyond the tolerance fails with diff pictures",
  "Firefox, Safari, a real device, a printer or a screen reader",
  "HTTP mode in a browser (needs a kix-protocol gate change)",
  "the receipts screen: receipt-explorer.ts mints a page session id per load, so no two pictures can match",
  "design review, user acceptance, qualification or release",
] as const;

export function recordShot(line: ShotLine): void {
  fs.appendFileSync(path.join(recordDir(), "shots.jsonl"), JSON.stringify(line) + "\n");
}

export function readShots(dir: string): ShotLine[] {
  const file = path.join(dir, "shots.jsonl");
  if (!fs.existsSync(file)) {
    return [];
  }
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as ShotLine);
}

export const koreanLayoutNote = (cjkGlyphs: "present" | "missing"): string =>
  cjkGlyphs === "present" ? "Korean glyphs are drawn on this profile" : "Korean layout not verified on this profile: Korean glyphs show as placeholder boxes";

export function renderVisualRecord(record: VisualRecord): string {
  const hits = findSensitiveInRecord(record);
  if (hits.length > 0) {
    throw new Error(`The visual record holds text that looks sensitive: ${hits.join(", ")}`);
  }
  return JSON.stringify(record, null, 2);
}
