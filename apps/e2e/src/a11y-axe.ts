import fs from "node:fs";
import { createRequire } from "node:module";
import type { Page } from "playwright-core";

const require = createRequire(import.meta.url);

/** axe-core is read from node_modules and injected from disk. No network, no wrapper package. */
const AXE_SOURCE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

export interface AxeRule {
  ruleId: string;
  impact: string;
  nodeCount: number;
}

export interface AxeSummary {
  version: string;
  violations: AxeRule[];
  incomplete: AxeRule[];
}

interface AxeResult {
  id: string;
  impact?: string | null;
  nodes: unknown[];
}

/** Runs axe on the current page and keeps only rule ids, impact and node counts. No DOM text leaves the page. */
export async function runAxe(page: Page, tags: readonly string[]): Promise<AxeSummary> {
  const present = await page.evaluate(() => "axe" in window);
  if (!present) {
    await page.addScriptTag({ content: AXE_SOURCE });
  }
  return page.evaluate(async (runTags: string[]) => {
    const axe = (window as unknown as { axe: { version: string; run: (ctx: Document, opts: object) => Promise<{ violations: AxeResult[]; incomplete: AxeResult[] }> } }).axe;
    const result = await axe.run(document, { runOnly: { type: "tag", values: runTags } });
    const slim = (list: AxeResult[]) => list.map((rule) => ({ ruleId: rule.id, impact: rule.impact ?? "none", nodeCount: rule.nodes.length }));
    return { version: axe.version, violations: slim(result.violations), incomplete: slim(result.incomplete) };
  }, [...tags]);
}

export function installedAxeVersion(): string {
  return (require("axe-core/package.json") as { version: string }).version;
}

export async function axeRuleCountForTag(page: Page, tag: string): Promise<number> {
  const present = await page.evaluate(() => "axe" in window);
  if (!present) {
    await page.addScriptTag({ content: AXE_SOURCE });
  }
  return page.evaluate((t: string) => (window as unknown as { axe: { getRules: (tags: string[]) => unknown[] } }).axe.getRules([t]).length, tag);
}
