#!/usr/bin/env node
/** Foreground, sequential full-suite evidence. Every invocation gets a unique directory; failed attempts are retained. */
import process from "node:process";
import console from "node:console";
import { setInterval, clearInterval } from "node:timers";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const runs = Number(process.argv[2] ?? "3");
assert(Number.isInteger(runs) && runs > 0, "usage: determinism-runs.mjs [runs] [untouched-baseline-directory] [instrumentation-baseline-directory]");
const baseline = process.argv[3];
const instrumentedBaseline = process.argv[4];
const out = fs.mkdtempSync(path.join(os.tmpdir(), "kix-det-candidate-"));
console.log(`Evidence: ${out}`);
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
fs.writeFileSync(path.join(out, "source.patch"), git("diff", "HEAD", "--", "apps/e2e"));
const source = [...new Set([...git("ls-files", "apps/e2e").trim().split("\n"), ...git("ls-files", "--others", "--exclude-standard", "apps/e2e").trim().split("\n")])].filter(Boolean).sort();
for (const file of source) {
  const target = path.join(out, "source", file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(root, file), target);
}
const hashes = Object.fromEntries(source.map((file) => [file, createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")]));
fs.writeFileSync(path.join(out, "source.json"), JSON.stringify({ appHead: git("rev-parse", "HEAD").trim(), files: hashes }, null, 2));
const results = [];
const identities = new Map();
const clocks = fs.createWriteStream(path.join(out, "clock.jsonl"));
let lastWall = Date.now(); let lastMono = performance.now();
const timer = setInterval(() => {
  const wall = Date.now(); const mono = performance.now();
  clocks.write(JSON.stringify({ wallMs: wall - lastWall, monoMs: Math.round(mono - lastMono), clockStepMs: Math.round(wall - lastWall - (mono - lastMono)) }) + "\n");
  lastWall = wall; lastMono = mono;
}, 1000);
const suites = ["e2e", "a11y", "visual", "budget"];
const ids = (record, suite) => {
  if (suite === "e2e") return record.checks.map((check) => check.checkId).sort();
  if (suite === "a11y") return record.checkIds.slice().sort();
  if (suite === "visual") return record.shots.map((shot) => shot.id).sort();
  return record.render.map((scenario) => scenario.id).sort();
};
function verify(record, suite, log) {
  assert.deepEqual(record.ledger, { nonLoopback: 0, nonGet: 0, appNetworkCalls: 0 });
  assert(record.timing.count > 0);
  assert.equal(record.timing.count, record.timing.tests.length);
  assert(record.timing.tests.every((test) => test.state === "pass" && Number.isInteger(test.durationMs) && (test.wallMs === null || Number.isInteger(test.wallMs)) && (test.clockStepMs === null || Number.isInteger(test.clockStepMs))));
  assert.equal(record.timing.measured, record.timing.tests.filter((test) => test.wallMs !== null).length);
  const summary = log.match(/Tests\s+(\d+) passed\s+\((\d+)\)/);
  assert(summary, "missing all-passed runner summary");
  assert.equal(Number(summary[1]), record.timing.count, "record and runner test counts differ");
  const lifecycle = record.lifecycle;
  for (const key of ["leakedAtTestEnd", "leakedInFailedTests", "leakedAtTeardown", "survivorsAfterCleanup", "pendingApiCallsAtTestEnd", "pendingRoutesAtTestEnd", "pendingApiCallsAtTeardown", "pendingRoutesAtTeardown", "unreleasedGatesAtTestEnd", "cleanupErrors"]) assert.equal(lifecycle[key], 0, key);
  for (const kind of ["browsers", "contexts", "pages"]) assert.equal(lifecycle[kind + "Opened"], lifecycle[kind + "Closed"], kind);
  assert.equal(lifecycle.testsTracked, lifecycle.tests.length);
  assert(lifecycle.tests.every((test) => test.pendingApiCalls.length === 0 && test.pendingRoutes === 0));
  if (suite === "visual") assert.equal(record.run, "compare");
  const testIds = record.timing.tests.map((test) => `${test.file} > ${test.name}`).sort();
  assert.equal(new Set(testIds).size, testIds.length, "duplicate test identities");
  if (identities.has(suite)) assert.deepEqual(testIds, identities.get(suite), "test identities changed between consecutive runs");
  identities.set(suite, testIds);
  if (instrumentedBaseline) {
    const before = JSON.parse(fs.readFileSync(path.join(instrumentedBaseline, `1-${suite}`, "record.json"), "utf8"));
    const afterTests = new Set(testIds);
    for (const test of before.timing.tests) assert(afterTests.has(`${test.file} > ${test.name}`), "removed test identity");
  }
  if (baseline) {
    const before = JSON.parse(fs.readFileSync(path.join(baseline, `1-${suite}`, "record.json"), "utf8"));
    const afterIds = new Set(ids(record, suite));
    const baselineIds = fs.readdirSync(baseline).filter((name) => new RegExp(`^[0-9]+-${suite}$`).test(name)).flatMap((name) => {
      const file = path.join(baseline, name, "record.json");
      return fs.existsSync(file) ? ids(JSON.parse(fs.readFileSync(file, "utf8")), suite) : [];
    });
    assert(baselineIds.length > 0, "no baseline matrix identities available");
    for (const id of baselineIds) assert(afterIds.has(id), `removed matrix identity: ${id}`);
    if (suite === "a11y") assert.deepEqual(record.screens.map((screen) => screen.screenId).sort(), before.screens.map((screen) => screen.screenId).sort());
  }
}
try {
  for (let attempt = 1; attempt <= runs; attempt++) {
    for (const suite of suites) {
      const dir = path.join(out, `${attempt}-${suite}`); fs.mkdirSync(dir);
      const record = path.join(dir, "record.json");
      const command = `npm run test:${suite}`;
      const env = { ...process.env, [`KIX_${suite.toUpperCase()}_RECORD_OUT`]: record, KIX_VISUAL_OUT: path.join(dir, "visual"), KIX_VISUAL_UPDATE: "0" };
      const logFile = path.join(dir, "log.txt"); const log = fs.openSync(logFile, "w");
      const start = performance.now(); console.log(`START ${attempt}/${runs} ${command}`);
      const child = spawn("npm", ["run", `test:${suite}`], { cwd: root, env, stdio: ["ignore", log, log] });
      let code;
      try { code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", (status) => resolve(status)); }); }
      finally { fs.closeSync(log); }
      const result = { attempt, suite, command, exit: code, durationMs: Math.round(performance.now() - start), verified: false };
      results.push(result); fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2));
      assert.equal(code, 0, `${command} failed; retained ${logFile}`);
      const data = JSON.parse(fs.readFileSync(record, "utf8"));
      verify(data, suite, fs.readFileSync(logFile, "utf8"));
      Object.assign(result, { verified: true, tests: data.timing.count, p95Ms: data.timing.p95Ms, matrix: ids(data, suite).length });
      fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2));
      console.log(`PASS ${suite}: ${result.tests} tests; p95 ${result.p95Ms} ms; ledger and lifecycle clean`);
    }
  }
  // Fail, rather than merely display a diff, if any protected content changed.
  git("diff", "--exit-code", "HEAD", "--", "packages/protocol-adapter/src/commerce-bindings.ts", ".aiops", "docs/aiops", ".github", "apps/e2e/vitest.config.ts", "apps/e2e/vitest.a11y.config.ts", "apps/e2e/vitest.visual.config.ts", "apps/e2e/vitest.budget.config.ts", "apps/e2e/visual-baselines", "apps/e2e/src/a11y-matrix.ts", "apps/e2e/src/visual-matrix.ts");
  const matrixFile = "apps/e2e/src/journey-matrix.ts";
  assert.equal(fs.readFileSync(path.join(root, matrixFile), "utf8").split("export const SHARED_CHECKS")[0], git("show", `HEAD:${matrixFile}`).split("export const SHARED_CHECKS")[0], "journey matrix identities changed");
  for (const [file, hash] of Object.entries(hashes)) assert.equal(createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex"), hash, `source changed during evidence sequence: ${file}`);
  console.log(`Complete: ${runs} consecutive full runs per suite, ${out}`);
} finally { clearInterval(timer); clocks.end(); }
