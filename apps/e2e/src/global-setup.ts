import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { TestProject } from "vitest/node";
import { buildStubApp, type BuiltApp } from "./build";
import { FAULT_CHECKS, FAULT_NOT_RUN, isFaultCheck } from "./fault-matrix";
import { expectedCheckIds, matrixProblems } from "./journey-matrix";
import { readChecks, readLedger, renderFaultRecord, renderRecord, NOT_RUN, type RunRecord } from "./run-record";
import { startRunDiagnostics, type RunDiagnosticsWatch } from "./run-diagnostics";
import { LOOPBACK, serveDirectory, type StaticServer } from "./static-server";

declare module "vitest" {
  export interface ProvidedContext {
    origin: string;
  }
}

let app: BuiltApp | null = null;
let server: StaticServer | null = null;
let recordDir = "";
let diagnostics: RunDiagnosticsWatch | null = null;

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
  diagnostics = startRunDiagnostics(project);
  try {
    app = await buildStubApp();
    server = await serveDirectory(app.outDir);
    project.provide("origin", server.origin);
  } catch (error) {
    try {
      await teardown();
    } catch (diagnosticError) {
      throw new AggregateError([error, diagnosticError], "Setup failed; teardown diagnostics were attempted");
    }
    throw error;
  }
}

/** Runs once after every test file. A matrix gap or a failed check fails the whole run. */
export async function teardown(): Promise<void> {
  const failures: unknown[] = [];
  try {
    const problems: string[] = [...matrixProblems()];
    const ran = new Set(readChecks(recordDir).map((line) => line.checkId));
    for (const id of [...expectedCheckIds(), ...FAULT_CHECKS]) {
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
    if (!diagnostics) {
      throw new Error("The run diagnostics were not started.");
    }
    const diag = diagnostics.finish(recordDir, ledgers.length);
    problems.push(...diag.problems);
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
        checks: [...ran].filter((id) => !isFaultCheck(id)).sort().map((checkId) => ({ checkId, pass: true })),
        timing: diag.timing,
        lifecycle: diag.lifecycle,
        notRun: [...NOT_RUN],
      };
      fs.writeFileSync(outFile, renderRecord(record) + "\n");
      // Fault cells keep their own record and denominator: never summed with the journeys cells.
      const faultRecord = {
        suite: "fault-injection",
        runner: "browser",
        mode: record.mode,
        source: "browser-production-bundle(stub)",
        appHead: git(["rev-parse", "HEAD"]),
        dirty: git(["status", "--porcelain"]) !== "",
        baseMainSha: record.baseMainSha,
        chrome: record.chrome,
        ledger: record.ledger,
        claims: { serviceQualification: false, ...record.claims },
        checks: [...ran].filter(isFaultCheck).sort().map((checkId) => ({ checkId, pass: true })),
        notRun: [...FAULT_NOT_RUN],
      };
      fs.writeFileSync(`${outFile}.fault.json`, renderFaultRecord(faultRecord) + "\n");
    }
    if (problems.length > 0) {
      throw new Error(`Browser journey matrix is incomplete:\n${problems.join("\n")}`);
    }
  } catch (error) {
    failures.push(error);
  } finally {
    const closed = await Promise.allSettled([server?.close()]);
    for (const result of closed) {
      if (result.status === "rejected") failures.push(result.reason);
    }
    try {
      app?.cleanup();
    } catch (error) {
      failures.push(error);
    }
    try {
      fs.rmSync(recordDir, { recursive: true, force: true });
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "Run and cleanup failed");
}
