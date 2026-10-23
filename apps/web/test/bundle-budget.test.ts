import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const script = path.join(repo, "scripts/check-bundle-budget.mjs");
const scratch = mkdtempSync(path.join(os.tmpdir(), "kix-budget-test-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

type Limits = {
  initialJsGzip: number;
  initialCssGzip: number;
  chunkJsGzip: number;
  landingJsGzip: number;
  totalGrowth: { base: number; maxRatio: number };
  render: { discoveryReadyMs: number; discoveryPage50Ms: number; inventorySectionMs: number };
};

const LIMITS: Limits = {
  initialJsGzip: 6000,
  initialCssGzip: 1500,
  chunkJsGzip: 3000,
  landingJsGzip: 9000,
  totalGrowth: { base: 10000, maxRatio: 1.5 },
  render: { discoveryReadyMs: 5000, discoveryPage50Ms: 5000, inventorySectionMs: 5000 },
};

const entry = (limits: Limits, reason = "first budget") => ({ date: "2026-10-18", limits, reason, evidence: "fixture" });
const budgetOf = (limits: Limits = LIMITS) => ({ schema: "fixture", limits, history: [entry(limits)] });

let counter = 0;
/** Writes a dist directory whose files are random bytes, so gzip size is close to the byte size given. */
function makeDist(sizes: { js: number; css: number; chunks: number[]; withIndex?: boolean; missingScript?: boolean }): string {
  counter += 1;
  const dist = path.join(scratch, `dist-${counter}`);
  mkdirSync(path.join(dist, "assets"), { recursive: true });
  if (sizes.withIndex !== false) {
    writeFileSync(
      path.join(dist, "index.html"),
      `<!doctype html><html><head><link rel="stylesheet" crossorigin href="/assets/index-a.css"><script type="module" crossorigin src="/assets/index-a.js"></script></head><body></body></html>`,
    );
  }
  if (!sizes.missingScript) {
    writeFileSync(path.join(dist, "assets/index-a.js"), randomBytes(sizes.js));
  }
  writeFileSync(path.join(dist, "assets/index-a.css"), randomBytes(sizes.css));
  sizes.chunks.forEach((size, index) => writeFileSync(path.join(dist, `assets/Route${index}-b.js`), randomBytes(size)));
  return dist;
}

function writeBudget(value: unknown): string {
  counter += 1;
  const file = path.join(scratch, `budget-${counter}.json`);
  writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
  return file;
}

const run = (dist: string, budget: string | null, extra: string[] = []) => {
  const args = ["--dist", dist, ...(budget ? ["--budget", budget] : []), ...extra];
  const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
};

describe("check-bundle-budget.mjs", () => {
  it("passes a dist inside every limit and prints the per-chunk table", () => {
    const result = run(makeDist({ js: 4000, css: 800, chunks: [1000, 2000] }), writeBudget(budgetOf()));
    expect(result.code).toBe(0);
    expect(result.out).toContain("budget check passed");
    expect(result.out).toMatch(/Route1-b\.js \| js \| no/);
    expect(result.out).toMatch(/index-a\.js \| js \| yes/);
  });

  it("fails when the initial JS is over its limit, and names the limit", () => {
    const result = run(makeDist({ js: 7000, css: 800, chunks: [1000] }), writeBudget(budgetOf()));
    expect(result.code).toBe(1);
    expect(result.out).toContain("initialJsGzip");
  });

  it("fails when the initial CSS is over its limit", () => {
    const result = run(makeDist({ js: 4000, css: 2500, chunks: [1000] }), writeBudget(budgetOf()));
    expect(result.code).toBe(1);
    expect(result.out).toContain("initialCssGzip");
  });

  it("fails when one route chunk is over its limit, and names the file", () => {
    const result = run(makeDist({ js: 4000, css: 800, chunks: [1000, 3600] }), writeBudget(budgetOf()));
    expect(result.code).toBe(1);
    expect(result.out).toContain("chunkJsGzip");
    expect(result.out).toContain("Route1-b.js");
  });

  it("fails when the total grew past the allowed ratio even though each file is inside its limit", () => {
    const result = run(makeDist({ js: 5500, css: 1400, chunks: [2900, 2900, 2900, 2900] }), writeBudget(budgetOf()));
    expect(result.code).toBe(1);
    expect(result.out).toContain("totalGrowth");
    expect(result.out).not.toContain("budget check failed: initialJsGzip");
  });

  it("counts only index.html references as initial: a big route chunk is not initial", () => {
    const result = run(makeDist({ js: 4000, css: 800, chunks: [2900] }), writeBudget(budgetOf()));
    expect(result.code).toBe(0);
  });

  it("fails closed on a missing index.html, a missing referenced script and a missing dist", () => {
    expect(run(makeDist({ js: 4000, css: 800, chunks: [], withIndex: false }), writeBudget(budgetOf())).code).toBe(1);
    const missing = run(makeDist({ js: 4000, css: 800, chunks: [], missingScript: true }), writeBudget(budgetOf()));
    expect(missing.code).toBe(1);
    expect(missing.out).toContain("index-a.js");
    expect(run(path.join(scratch, "no-such-dist"), writeBudget(budgetOf())).code).toBe(1);
  });

  it("fails closed on a malformed budget: bad JSON, a missing limit, a bad ratio", () => {
    const dist = makeDist({ js: 4000, css: 800, chunks: [1000] });
    expect(run(dist, writeBudget("{not json")).code).toBe(1);
    expect(run(dist, path.join(scratch, "no-such-budget.json")).code).toBe(1);
    const missingLimit: Record<string, unknown> = { ...LIMITS };
    delete missingLimit.chunkJsGzip;
    const noLimit = run(dist, writeBudget({ ...budgetOf(), limits: missingLimit }));
    expect(noLimit.code).toBe(1);
    expect(noLimit.out).toContain("limits.chunkJsGzip");
    const badRatio = run(dist, writeBudget(budgetOf({ ...LIMITS, totalGrowth: { base: 10000, maxRatio: 0.5 } })));
    expect(badRatio.code).toBe(1);
    expect(badRatio.out).toContain("totalGrowth");
  });

  it("fails when a limit is raised without a matching history entry, and when an entry has no reason or evidence", () => {
    const dist = makeDist({ js: 4000, css: 800, chunks: [1000] });
    const raised = { ...LIMITS, initialJsGzip: 99999 };
    const silent = run(dist, writeBudget({ ...budgetOf(), limits: raised }));
    expect(silent.code).toBe(1);
    expect(silent.out).toContain("without a matching history entry");
    const noReason = run(dist, writeBudget({ ...budgetOf(), history: [{ date: "2026-10-18", limits: LIMITS, reason: " ", evidence: "x" }] }));
    expect(noReason.code).toBe(1);
    expect(noReason.out).toContain("a reason and evidence");
    const withEntry = run(dist, writeBudget({ ...budgetOf(), limits: raised, history: [entry(LIMITS), entry(raised, "needed the new calendar view")] }));
    expect(withEntry.code).toBe(0);
  });

  it("--report-only prints sizes and does not need or compare a budget; usage errors exit 2", () => {
    const dist = makeDist({ js: 9000, css: 4000, chunks: [4000] });
    const report = run(dist, null, ["--report-only"]);
    expect(report.code).toBe(0);
    expect(report.out).toContain("initialJsGzip=");
    expect(run(dist, null).code).toBe(2);
    expect(run(dist, writeBudget(budgetOf()), ["--nonsense"]).code).toBe(2);
    expect(spawnSync(process.execPath, [script], { encoding: "utf8" }).status).toBe(2);
  });

  it("writes the measurement as JSON with --json-out", () => {
    const out = path.join(scratch, "measure.json");
    const result = run(makeDist({ js: 4000, css: 800, chunks: [1000] }), writeBudget(budgetOf()), ["--json-out", out]);
    expect(result.code).toBe(0);
    const measured = JSON.parse(readFileSync(out, "utf8")) as { initialJsGzip: number; chunkCount: number };
    expect(measured.initialJsGzip).toBeGreaterThan(3500);
    expect(measured.chunkCount).toBe(1);
  });
});

describe("the repo budget file", () => {
  const budgetFile = path.join(here, "../bundle-budget.json");
  const budget = JSON.parse(readFileSync(budgetFile, "utf8")) as {
    limits: Limits;
    baseline: { preSplit: { initialJsGzip: number; totalGzip: number }; postSplit: { initialJsGzip: number; totalGzip: number; landingJsGzip: number }; localized: { initialJsGzip: number; totalGzip: number; sourceSha: string } };
    history: { limits: Limits; reason: string; evidence: string }[];
  };
  const doc = readFileSync(path.join(repo, "docs/c-bundle-performance-budget-stub-apps-bind.md"), "utf8");

  it("passes the script's own structural check on a fixture dist inside it", () => {
    const dist = makeDist({ js: 1000, css: 500, chunks: [1000] });
    expect(run(dist, budgetFile).code).toBe(0);
  });

  it("records a smaller initial JS after the split than before it, with both baselines", () => {
    expect(budget.baseline.postSplit.initialJsGzip).toBeLessThan(budget.baseline.preSplit.initialJsGzip);
    expect(budget.limits.initialJsGzip).toBeLessThan(budget.baseline.preSplit.initialJsGzip);
    expect(budget.baseline.postSplit.landingJsGzip).toBeLessThan(budget.baseline.preSplit.initialJsGzip);
    expect(budget.baseline.preSplit.totalGzip).toBe(527526);
    expect(budget.limits.totalGrowth.base).toBe(790000);
    expect(budget.limits.initialJsGzip).toBe(290000);
    expect(budget.limits.chunkJsGzip).toBe(30000);
    expect(budget.history.at(-1)?.reason).toContain("2026-10-23");
    expect(budget.baseline.localized.sourceSha).toContain("f7cd60c");
    expect(budget.limits.totalGrowth.maxRatio).toBe(1);
  });

  it("keeps every limit above the post-split measurement, so the budget is a tripwire and not already broken", () => {
    expect(budget.limits.initialJsGzip).toBeGreaterThan(budget.baseline.postSplit.initialJsGzip);
    expect(budget.limits.landingJsGzip).toBeGreaterThan(budget.baseline.postSplit.landingJsGzip);
    expect(Math.floor(budget.limits.totalGrowth.base * budget.limits.totalGrowth.maxRatio)).toBeGreaterThan(budget.baseline.postSplit.totalGzip);
  });

  it("has a last history entry equal to the limits, with a reason and evidence", () => {
    const last = budget.history[budget.history.length - 1]!;
    expect(last.limits).toEqual(budget.limits);
    expect(last.reason.length).toBeGreaterThan(20);
    expect(last.evidence.length).toBeGreaterThan(20);
  });

  it("is written out in the bind doc: every limit number, the pre- and post-split numbers, and the rule to raise one", () => {
    const numbers = [
      budget.limits.initialJsGzip,
      budget.limits.initialCssGzip,
      budget.limits.chunkJsGzip,
      budget.limits.landingJsGzip,
      budget.limits.totalGrowth.base,
      budget.limits.totalGrowth.maxRatio,
      ...Object.values(budget.limits.render),
      budget.baseline.preSplit.initialJsGzip,
      budget.baseline.postSplit.initialJsGzip,
    ];
    for (const value of numbers) {
      expect(doc, `doc names ${value}`).toContain(String(value));
    }
    expect(doc).toMatch(/## How to raise a budget/);
    expect(doc).toMatch(/history/);
  });

  it("makes no SLO, qualification or production claim in the doc and keeps the record claims false", () => {
    expect(doc).not.toMatch(/SLO (achieved|met|passed)/i);
    expect(doc).not.toMatch(/\d\s?%/);
    expect(doc).toContain("contract_change=NO");
    expect(doc).toContain("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
    const record = readFileSync(path.join(repo, "apps/e2e/src/budget-global-setup.ts"), "utf8");
    expect(record).toContain("claims: { slo: false, qualification: false, productionPerformance: false, released: false }");
  });
});
