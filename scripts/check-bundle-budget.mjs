#!/usr/bin/env node
/**
 * Bundle budget check for the stub web build. Node built-ins only; it reads files and sends nothing.
 *
 *   node scripts/check-bundle-budget.mjs --dist <dir> --budget <file> [--report-only] [--json-out <file>]
 *
 * "Initial" means the scripts, modulepreload links and stylesheets that dist/index.html references.
 * Every other JS file under the dist directory is a route (or shared) chunk.
 * Sizes are gzip level 9 bytes of the emitted file. They are build-size tripwires, not performance claims.
 *
 * Exit codes: 0 pass (or --report-only), 1 a budget problem, 2 a usage error.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const STATIC_LIMITS = ["initialJsGzip", "initialCssGzip", "chunkJsGzip", "landingJsGzip"];
const RENDER_SCENARIOS = ["discoveryReadyMs", "discoveryPage50Ms", "inventorySectionMs"];

class Usage extends Error {}

function parseArgs(argv) {
  const out = { dist: null, budget: null, reportOnly: false, jsonOut: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--report-only") {
      out.reportOnly = true;
    } else if (arg === "--dist" || arg === "--budget" || arg === "--json-out") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Usage(`${arg} needs a value`);
      }
      out[arg === "--dist" ? "dist" : arg === "--budget" ? "budget" : "jsonOut"] = value;
      i += 1;
    } else {
      throw new Usage(`unknown argument ${arg}`);
    }
  }
  if (!out.dist) {
    throw new Usage("--dist <dir> is required");
  }
  if (!out.budget && !out.reportOnly) {
    throw new Usage("--budget <file> is required unless --report-only is set");
  }
  return out;
}

const gzipSize = (file) => zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

/** The files index.html loads before the app can start: module scripts, modulepreload links, stylesheets. */
export function initialRefs(html) {
  const refs = new Set();
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) ?? []) {
    const attr = (name) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1];
    const isScript = /^<script/i.test(tag);
    const rel = (attr("rel") ?? "").toLowerCase();
    const ref = isScript ? attr("src") : rel === "modulepreload" || rel === "stylesheet" ? attr("href") : undefined;
    if (ref && !/^[a-z]+:/i.test(ref)) {
      refs.add(ref.replace(/^\//, "").replace(/^\.\//, ""));
    }
  }
  return [...refs];
}

export function measure(dist) {
  const indexFile = path.join(dist, "index.html");
  if (!fs.existsSync(indexFile)) {
    throw new Error(`missing index.html in ${dist}`);
  }
  const initial = new Set(initialRefs(fs.readFileSync(indexFile, "utf8")));
  const files = walk(dist)
    .map((full) => path.relative(dist, full).split(path.sep).join("/"))
    .filter((rel) => /\.(js|css)$/.test(rel));
  for (const ref of initial) {
    if (!fs.existsSync(path.join(dist, ref))) {
      throw new Error(`index.html references ${ref}, which is not in ${dist}`);
    }
  }
  const rows = files.map((rel) => ({
    file: rel,
    kind: rel.endsWith(".css") ? "css" : "js",
    initial: initial.has(rel),
    bytes: fs.statSync(path.join(dist, rel)).size,
    gzip: gzipSize(path.join(dist, rel)),
  }));
  const sum = (list) => list.reduce((total, row) => total + row.gzip, 0);
  const initialJs = rows.filter((row) => row.initial && row.kind === "js");
  const initialCss = rows.filter((row) => row.initial && row.kind === "css");
  const chunks = rows.filter((row) => !row.initial && row.kind === "js");
  if (initialJs.length === 0) {
    throw new Error("index.html references no script, so there is no initial bundle to measure");
  }
  return {
    rows,
    initialJsGzip: sum(initialJs),
    initialCssGzip: sum(initialCss),
    totalGzip: sum(rows),
    fileCount: rows.length,
    chunkCount: chunks.length,
    largestChunk: chunks.reduce((top, row) => (top === null || row.gzip > top.gzip ? row : top), null),
  };
}

const isCount = (value) => Number.isInteger(value) && value > 0;
const stable = (value) => JSON.stringify(value, (_key, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v));

export function budgetProblems(budget) {
  const problems = [];
  if (!budget || typeof budget !== "object" || Array.isArray(budget)) {
    return ["budget file is not a JSON object"];
  }
  const limits = budget.limits;
  if (!limits || typeof limits !== "object") {
    return ["budget file has no limits object"];
  }
  for (const name of STATIC_LIMITS) {
    if (!isCount(limits[name])) {
      problems.push(`limits.${name} must be a positive integer`);
    }
  }
  const growth = limits.totalGrowth;
  if (!growth || !isCount(growth.base) || typeof growth.maxRatio !== "number" || !(growth.maxRatio >= 1) || growth.maxRatio > 3) {
    problems.push("limits.totalGrowth needs a positive integer base and a maxRatio from 1 to 3");
  }
  const render = limits.render;
  for (const name of RENDER_SCENARIOS) {
    if (!render || !isCount(render[name])) {
      problems.push(`limits.render.${name} must be a positive integer (milliseconds)`);
    }
  }
  const history = budget.history;
  if (!Array.isArray(history) || history.length === 0) {
    problems.push("history must hold at least one entry");
  } else {
    history.forEach((entry, index) => {
      if (!entry || typeof entry.date !== "string" || typeof entry.reason !== "string" || entry.reason.trim() === "" || typeof entry.evidence !== "string" || entry.evidence.trim() === "") {
        problems.push(`history[${index}] needs a date, a reason and evidence`);
      }
    });
    const last = history[history.length - 1];
    if (last && stable(last.limits) !== stable(limits)) {
      problems.push("limits changed without a matching history entry: the last history entry's limits must equal the current limits");
    }
  }
  return problems;
}

export function overages(measured, limits) {
  const problems = [];
  if (measured.initialJsGzip > limits.initialJsGzip) {
    problems.push(`initialJsGzip ${measured.initialJsGzip} is over the limit ${limits.initialJsGzip}`);
  }
  if (measured.initialCssGzip > limits.initialCssGzip) {
    problems.push(`initialCssGzip ${measured.initialCssGzip} is over the limit ${limits.initialCssGzip}`);
  }
  for (const row of measured.rows) {
    if (row.kind === "js" && !row.initial && row.gzip > limits.chunkJsGzip) {
      problems.push(`chunkJsGzip ${row.file} is ${row.gzip}, over the limit ${limits.chunkJsGzip}`);
    }
  }
  const ceiling = Math.floor(limits.totalGrowth.base * limits.totalGrowth.maxRatio);
  if (measured.totalGzip > ceiling) {
    problems.push(`totalGrowth total ${measured.totalGzip} is over ${ceiling} (base ${limits.totalGrowth.base} x ${limits.totalGrowth.maxRatio})`);
  }
  return problems;
}

function table(measured) {
  const lines = ["file | kind | initial | bytes | gzip"];
  for (const row of [...measured.rows].sort((a, b) => b.gzip - a.gzip)) {
    lines.push(`${row.file} | ${row.kind} | ${row.initial ? "yes" : "no"} | ${row.bytes} | ${row.gzip}`);
  }
  return lines.join("\n");
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`usage error: ${error.message}`);
    console.error("usage: node scripts/check-bundle-budget.mjs --dist <dir> --budget <file> [--report-only] [--json-out <file>]");
    return 2;
  }
  let measured;
  try {
    measured = measure(args.dist);
  } catch (error) {
    console.error(`budget check failed: ${error.message}`);
    return 1;
  }
  console.log(table(measured));
  console.log("");
  console.log(`initialJsGzip=${measured.initialJsGzip} initialCssGzip=${measured.initialCssGzip} totalGzip=${measured.totalGzip} files=${measured.fileCount} chunks=${measured.chunkCount}`);
  if (measured.largestChunk) {
    console.log(`largest chunk: ${measured.largestChunk.file} gzip=${measured.largestChunk.gzip}`);
  }
  if (args.jsonOut) {
    fs.writeFileSync(args.jsonOut, JSON.stringify({ ...measured, rows: measured.rows }, null, 2) + "\n");
  }
  if (args.reportOnly) {
    console.log("report only: no budget compared.");
    return 0;
  }
  let budget;
  try {
    budget = JSON.parse(fs.readFileSync(args.budget, "utf8"));
  } catch (error) {
    console.error(`budget check failed: cannot read budget file ${args.budget}: ${error.message}`);
    return 1;
  }
  const problems = [...budgetProblems(budget)];
  if (problems.length === 0) {
    problems.push(...overages(measured, budget.limits));
  }
  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`budget check failed: ${problem}`);
    }
    return 1;
  }
  console.log("budget check passed: initial JS, initial CSS, every route chunk and total growth are within the limits.");
  return 0;
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
