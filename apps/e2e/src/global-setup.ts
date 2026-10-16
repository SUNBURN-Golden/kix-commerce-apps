import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { TestProject } from "vitest/node";
import { buildStubApp, type BuiltApp } from "./build";
import { expectedCheckIds, matrixProblems } from "./journey-matrix";
import { readChecks, readLedger, renderRecord, NOT_RUN, type RunRecord } from "./run-record";
import { LOOPBACK, serveDirectory, type StaticServer } from "./static-server";

declare module "vitest" {
  export interface ProvidedContext {
    origin: string;
  }
}

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
  recordDir = fs.mkdtempSync(path.join(os.tmpdir(), "kix-e2e-record-"));
  process.env.KIX_E2E_RECORD_DIR = recordDir;
  app = await buildStubApp();
  server = await serveDirectory(app.outDir);
  project.provide("origin", server.origin);
}

/** Runs once after every test file. A matrix gap or a failed check fails the whole run. */
export async function teardown(): Promise<void> {
  const problems: string[] = [...matrixProblems()];
  const ran = new Set(readChecks(recordDir).map((line) => line.checkId));
  for (const id of expectedCheckIds()) {
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
  const outFile = process.env.KIX_E2E_RECORD_OUT;
  if (outFile) {
    const record: RunRecord = {
      mode: "stub",
      bind: server?.address ?? "none",
      date: new Date().toISOString().slice(0, 10),
      chrome: ledgers[0]?.chrome ?? "unknown",
      playwrightCore: "1.58.2",
      baseMainSha: git(["merge-base", "HEAD", "origin/main"]),
      ledger: { nonLoopback: sum("nonLoopback"), nonGet: sum("nonGet"), appNetworkCalls: sum("appNetworkCalls") },
      claims: { httpModePass: false, productionQualification: false, realPayment: false, released: false },
      checks: [...ran].sort().map((checkId) => ({ checkId, pass: true })),
      notRun: [...NOT_RUN],
    };
    fs.writeFileSync(outFile, renderRecord(record) + "\n");
  }
  await server?.close();
  app?.cleanup();
  fs.rmSync(recordDir, { recursive: true, force: true });
  if (problems.length > 0) {
    throw new Error(`Browser journey matrix is incomplete:\n${problems.join("\n")}`);
  }
}
