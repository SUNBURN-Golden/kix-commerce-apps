import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import type { TestProject } from "vitest/node";
import { buildGalleryApp, buildShellFaultApp, buildStubApp, type BuiltApp } from "./build";
import { A11Y_BASELINE, KNOWN_FINDINGS, SCREENS, VIEWPORTS, expectedCheckIds, matrixProblems, type ScreenRecord, type ViewportName } from "./a11y-matrix";
import { A11Y_NOT_RUN, readFacets, renderA11yRecord, type A11yRecord, type FacetLine } from "./a11y-record";
import { keyboardFacetLine } from "./journey-matrix";
import { readChecks, readLedger } from "./run-record";
import { startRunDiagnostics, type RunDiagnosticsWatch } from "./run-diagnostics";
import { LOOPBACK, serveDirectory, type StaticServer } from "./static-server";

declare module "vitest" {
  export interface ProvidedContext {
    origin: string;
    faultOrigin: string;
    galleryOrigin: string;
  }
}

let app: BuiltApp | null = null;
let server: StaticServer | null = null;
let faultApp: BuiltApp | null = null;
let faultServer: StaticServer | null = null;
let recordDir = "";
let diagnostics: RunDiagnosticsWatch | null = null;
let galleryApp: BuiltApp | null = null;
let galleryServer: StaticServer | null = null;
const require = createRequire(import.meta.url);

function git(args: string[]): string {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export async function setup(project: TestProject): Promise<void> {
  recordDir = fs.mkdtempSync(path.join(os.tmpdir(), "kix-a11y-record-"));
  process.env.KIX_E2E_RECORD_DIR = recordDir;
  process.env.KIX_E2E_AXE_SOURCE = require.resolve("axe-core/axe.min.js");
  diagnostics = startRunDiagnostics(project);
  try {
    app = await buildStubApp();
    server = await serveDirectory(app.outDir);
    project.provide("origin", server.origin);
    faultApp = await buildShellFaultApp();
    faultServer = await serveDirectory(faultApp.outDir);
    project.provide("faultOrigin", faultServer.origin);
    galleryApp = await buildGalleryApp();
    galleryServer = await serveDirectory(galleryApp.outDir);
    project.provide("galleryOrigin", galleryServer.origin);
  } catch (error) {
    try {
      await teardown();
    } catch (diagnosticError) {
      throw new AggregateError([error, diagnosticError], "Setup failed; teardown diagnostics were attempted");
    }
    throw error;
  }
}

function screenRecords(facets: FacetLine[], checks: Set<string>, head: string): ScreenRecord[] {
  return SCREENS.map((screen) => {
    const automated = {} as ScreenRecord["automated"];
    for (const viewport of Object.keys(VIEWPORTS) as ViewportName[]) {
      const line = facets.find((item) => item.kind === "axe" && item.screenId === screen.screenId && item.viewport === viewport);
      automated[viewport] = line && line.kind === "axe" ? { violations: line.violations, incomplete: line.incomplete } : { violations: [], incomplete: [] };
    }
    const manual = (kind: "keyboard" | "reflow" | "structure") => {
      const line = facets.find((item) => item.kind === kind && item.screenId === screen.screenId);
      return line && line.kind === kind ? line.result : ("NOT_RUN" as const);
    };
    const keyboard = manual("keyboard");
    const reflow = manual("reflow");
    const structure = manual("structure");
    const withFindings =
      keyboard === "FINDING" || reflow === "FINDING" || structure === "FINDING" || Object.values(automated).some((entry) => entry.violations.length > 0);
    return {
      screenId: screen.screenId,
      path: screen.path,
      automated,
      keyboard,
      reflow,
      structure,
      assistiveTech: "NOT_RUN",
      userAcceptance: { state: "PENDING", decider: "user", baseline: "none", evidenceHead: head, inheritedFrom: null },
      release: "NOT_AUTHORIZED",
      traceCheckIds: [...checks].filter((id) => id.split(".").includes(screen.screenId) || id === `a11y.reflow.${screen.screenId}`).sort(),
      outcome: withFindings ? "OBSERVED_WITH_FINDINGS" : "OBSERVED_CLEAN",
    };
  });
}

/** Runs once after every test file. A matrix gap, a missing check, or a non-loopback bind fails the whole run. */
export async function teardown(): Promise<void> {
  const failures: unknown[] = [];
  try {
    const problems: string[] = [...matrixProblems()];
    const facetLine = keyboardFacetLine();
    console.log(facetLine);
    const ran = new Set(readChecks(recordDir).map((line) => line.checkId));
    for (const id of expectedCheckIds()) {
      if (!ran.has(id)) {
        problems.push(`check did not pass in this run: ${id}`);
      }
    }
    for (const bound of [server, faultServer, galleryServer]) {
      if (bound && bound.address !== LOOPBACK) {
        problems.push(`server bound to ${bound.address}`);
      }
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
    const outFile = process.env.KIX_A11Y_RECORD_OUT;
    if (outFile) {
      const facets = readFacets(recordDir);
      const head = git(["rev-parse", "HEAD"]);
      const record: A11yRecord = {
        kind: "a11y-observation",
        mode: "stub",
        source: "stub-shape",
        bind: server?.address ?? "none",
        date: new Date().toISOString().slice(0, 10),
        appHead: head,
        baseMainSha: git(["merge-base", "HEAD", "origin/main"]),
        tool: { axe: A11Y_BASELINE.version, playwrightCore: "1.58.2", chrome: ledgers[0]?.chrome ?? "unknown" },
        tags: A11Y_BASELINE.tags,
        targetStandard: A11Y_BASELINE.targetStandard,
        ledger: { nonLoopback: sum("nonLoopback"), nonGet: sum("nonGet"), appNetworkCalls: sum("appNetworkCalls") },
        claims: { wcagConformance: false, userAccepted: false, assistiveTechRun: false, released: false, productionQualification: false },
        screens: screenRecords(facets, ran, head),
        findings: KNOWN_FINDINGS.map(({ screenId, viewport, ruleId, status }) => ({ screenId, viewport, ruleId, status })),
        observations: [
          ...facets.flatMap((item) => (item.kind === "observation" ? [{ id: item.id, note: item.note }] : [])),
          { id: "a11y.kbd.outcome.facet", note: facetLine },
        ],
        checkIds: [...ran].sort(),
        timing: diag.timing,
        lifecycle: diag.lifecycle,
        notRun: [...A11Y_NOT_RUN],
      };
      fs.writeFileSync(outFile, renderA11yRecord(record) + "\n");
    }
    if (problems.length > 0) {
      throw new Error(`Accessibility observation matrix is incomplete:\n${problems.join("\n")}`);
    }
  } catch (error) {
    failures.push(error);
  } finally {
    const closed = await Promise.allSettled([server?.close(), faultServer?.close(), galleryServer?.close()]);
    for (const result of closed) {
      if (result.status === "rejected") failures.push(result.reason);
    }
    try {
      galleryApp?.cleanup();
    } catch (error) {
      failures.push(error);
    }
    try {
      app?.cleanup();
    } catch (error) {
      failures.push(error);
    }
    try {
      faultApp?.cleanup();
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
