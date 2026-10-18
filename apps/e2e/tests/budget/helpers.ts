import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import type { Page } from "playwright-core";

export interface BudgetLimits {
  landingJsGzip: number;
  render: { discoveryReadyMs: number; discoveryPage50Ms: number; inventorySectionMs: number };
}

export function readLimits(budgetFile: string): BudgetLimits {
  return (JSON.parse(fs.readFileSync(budgetFile, "utf8")) as { limits: BudgetLimits }).limits;
}

export const gzipOf = (distDir: string, assetPath: string): number =>
  zlib.gzipSync(fs.readFileSync(path.join(distDir, assetPath)), { level: 9 }).length;

/** Collects the JS files the page requests from now on, as dist-relative paths. */
export function trackScripts(page: Page): Set<string> {
  const seen = new Set<string>();
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith(".js")) {
      seen.add(pathname.replace(/^\//, ""));
    }
  });
  return seen;
}

export function distScripts(distDir: string): string[] {
  return fs
    .readdirSync(path.join(distDir, "assets"))
    .filter((name) => name.endsWith(".js"))
    .map((name) => `assets/${name}`);
}

/** The screen name in a chunk file name: assets/Gift-AbC123.js -> Gift. */
export const stem = (file: string): string => path.basename(file).replace(/-[A-Za-z0-9_-]{8}\.js$/, "");

export async function openHome(page: Page, origin: string): Promise<void> {
  await page.goto(origin + "/");
  await page.getByRole("heading", { name: "Tonight’s window" }).waitFor();
}
