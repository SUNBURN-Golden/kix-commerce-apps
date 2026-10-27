import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { TestProject } from "vitest/node";
import { buildStubApp, type BuiltApp } from "./build";
import { readChecks, readLedger } from "./run-record";
import { startRunDiagnostics, type RunDiagnosticsWatch } from "./run-diagnostics";
import { LOOPBACK, serveDirectory, type StaticServer } from "./static-server";
import { BASELINE_ROOT, assertUpdateAllowed, baselineProblems, isUpdate, pngHash, profileDir, type BaselineManifest } from "./visual-compare";
import { TOLERANCE, expectedVisualCheckIds, idOf, visualShots } from "./visual-matrix";
import { VISUAL_NOT_RUN, koreanLayoutNote, readShots, renderVisualRecord, type VisualRecord } from "./visual-record";

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
  assertUpdateAllowed(process.env);
  recordDir = fs.mkdtempSync(path.join(os.tmpdir(), "kix-visual-record-"));
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

/** Runs once after every test file. A missing check, a baseline that matches no shot, a non-loopback bind or a failed assertion fails the whole run. */
export async function teardown(): Promise<void> {
  const failures: unknown[] = [];
  try {
    const problems: string[] = [];
    const ran = new Set(readChecks(recordDir).map((line) => line.checkId));
    for (const id of expectedVisualCheckIds()) {
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
    const lines = readShots(recordDir);
    const first = lines[0];
    const update = isUpdate();
    const shotIds = visualShots().map(idOf);
    const complete = shotIds.every((id) => lines.some((line) => line.id === id));
    if (!complete) {
      problems.push("not every shot in the matrix was taken in this run");
    }
    if (update && first && complete && problems.length === 0) {
      // Only a complete recording gets a manifest, so a partial run cannot leave a committable set behind.
      const manifest: BaselineManifest = {
        profile: first.render.profile,
        platform: first.render.platform,
        chrome: first.render.chrome,
        fontWidths: first.render.fontWidths,
        cjkGlyphs: first.render.cjkGlyphs,
        tolerance: { ...TOLERANCE },
        appHead: git(["rev-parse", "HEAD"]),
        recordedOn: new Date().toISOString().slice(0, 10),
        shots: shotIds.length,
        hashes: Object.fromEntries(shotIds.map((id) => [id, pngHash(fs.readFileSync(path.join(profileDir(first.render.profile), `${id}.png`)))])),
      };
      fs.writeFileSync(path.join(profileDir(manifest.profile), "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    }
    problems.push(...baselineProblems(BASELINE_ROOT, shotIds));
    const outFile = process.env.KIX_VISUAL_RECORD_OUT;
    if (outFile) {
      // Written even when no shot was taken, so a run that failed early still leaves its timing and lifecycle. The render fields then read unavailable.
      const render = first?.render;
      const cjkGlyphs = render?.cjkGlyphs ?? "unavailable";
      const record: VisualRecord = {
        kind: "visual-baseline-observation",
        mode: "stub",
        run: update ? "record-baselines" : "compare",
        bind: server?.address ?? "none",
        date: new Date().toISOString().slice(0, 10),
        appHead: git(["rev-parse", "HEAD"]),
        baseMainSha: git(["merge-base", "HEAD", "origin/main"]),
        chrome: render?.chrome ?? ledgers[0]?.chrome ?? "unknown",
        playwrightCore: "1.58.2",
        profile: render?.profile ?? "unavailable",
        cjkGlyphs,
        koreanLayout: koreanLayoutNote(cjkGlyphs),
        tolerance: { ...TOLERANCE },
        shots: lines.map(({ render: _render, ...shot }) => shot),
        ledger: { nonLoopback: sum("nonLoopback"), nonGet: sum("nonGet"), appNetworkCalls: sum("appNetworkCalls") },
        claims: { qualification: false, userAccepted: false, released: false, designApproved: false, otherRunners: false },
        timing: diag.timing,
        lifecycle: diag.lifecycle,
        notRun: [...VISUAL_NOT_RUN],
      };
      fs.writeFileSync(outFile, renderVisualRecord(record) + "\n");
    }
    if (problems.length > 0) {
      throw new Error(`Visual baseline suite is incomplete:\n${problems.join("\n")}`);
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
