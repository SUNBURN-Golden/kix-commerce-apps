import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { TestProject } from "vitest/node";
import { buildStubApp, webRoot, type BuiltApp } from "./build";
import { BUDGET_NOT_RUN, readLines, renderBudgetRecord, type BudgetRecord, type RenderMeasurement, type SplitMeasurement } from "./budget-record";
import { readChecks, readLedger } from "./run-record";
import { LOOPBACK, serveDirectory, type StaticServer } from "./static-server";

declare module "vitest" {
  export interface ProvidedContext {
    origin: string;
    distDir: string;
    budgetFile: string;
  }
}

/** Check ids this suite must have recorded as passed. A missing one fails the run. */
export const BUDGET_CHECKS = [
  "budget.split.landing",
  "budget.split.gift",
  "budget.render.discovery-ready",
  "budget.render.discovery-page50",
  "budget.render.inventory-section",
  "budget.chunk-failure.status-while-loading",
  "budget.chunk-failure.missing-file",
  "budget.chunk-failure.wrong-content",
  "budget.chunk-failure.unknown-kept",
] as const;

let app: BuiltApp | null = null;
let server: StaticServer | null = null;
let recordDir = "";

function git(args: string[]): string {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export async function setup(project: TestProject): Promise<void> {
  recordDir = fs.mkdtempSync(path.join(os.tmpdir(), "kix-budget-record-"));
  process.env.KIX_E2E_RECORD_DIR = recordDir;
  app = await buildStubApp();
  server = await serveDirectory(app.outDir);
  project.provide("origin", server.origin);
  project.provide("distDir", app.outDir);
  project.provide("budgetFile", path.join(webRoot, "bundle-budget.json"));
}

/** Runs once after every test file. A missing check, a non-loopback bind or a failed assertion fails the whole run. */
export async function teardown(): Promise<void> {
  const problems: string[] = [];
  const ran = new Set(readChecks(recordDir).map((line) => line.checkId));
  for (const id of BUDGET_CHECKS) {
    if (!ran.has(id)) {
      problems.push(`check did not pass in this run: ${id}`);
    }
  }
  if (server && server.address !== LOOPBACK) {
    problems.push(`server bound to ${server.address}`);
  }
  const ledgers = readLedger(recordDir);
  if (ledgers.length === 0) {
    problems.push("no browser session reported a ledger");
  }
  const sum = (key: "nonLoopback" | "nonGet" | "appNetworkCalls") => ledgers.reduce((total, line) => total + line[key], 0);
  const outFile = process.env.KIX_BUDGET_RECORD_OUT;
  if (outFile) {
    const record: BudgetRecord = {
      kind: "bundle-budget-observation",
      mode: "stub",
      scope: "clean stub build, one runner, 5 runs per scenario; regression tripwires with generous caps",
      bind: server?.address ?? "none",
      date: new Date().toISOString().slice(0, 10),
      appHead: git(["rev-parse", "HEAD"]),
      baseMainSha: git(["merge-base", "HEAD", "origin/main"]),
      chrome: ledgers[0]?.chrome ?? "unknown",
      claims: { slo: false, qualification: false, productionPerformance: false, released: false },
      split: readLines<SplitMeasurement>(recordDir, "split.jsonl")[0] ?? null,
      render: readLines<RenderMeasurement>(recordDir, "render.jsonl"),
      chunkFailure: { observations: readLines<{ id: string; note: string }>(recordDir, "observations.jsonl") },
      ledger: { nonLoopback: sum("nonLoopback"), nonGet: sum("nonGet"), appNetworkCalls: sum("appNetworkCalls") },
      notRun: [...BUDGET_NOT_RUN],
    };
    fs.writeFileSync(outFile, renderBudgetRecord(record) + "\n");
  }
  await server?.close();
  app?.cleanup();
  fs.rmSync(recordDir, { recursive: true, force: true });
  if (problems.length > 0) {
    throw new Error(`Bundle budget suite is incomplete:\n${problems.join("\n")}`);
  }
}
