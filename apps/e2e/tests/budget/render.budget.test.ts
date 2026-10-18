import { describe, expect, inject, it } from "vitest";
import type { Page } from "playwright-core";
import { median, recordLine, type RenderMeasurement } from "../../src/budget-record";
import { useBrowser } from "../../src/suite";
import { readLimits } from "./helpers";

const RUNS = 5;

/**
 * Time from the start of the page load until the long list has all its rows, read in the page with a
 * MutationObserver and performance.now(). It includes fetching the route chunk, so it is a cold-load reading.
 * It is a regression tripwire for this runner, not a service level, and nothing in the product source is hooked.
 */
const OBSERVER = ({ selector, want }: { selector: string; want: number }) => {
  const w = window as unknown as { __kixReadyAt: number | null };
  w.__kixReadyAt = null;
  const check = () => {
    if (w.__kixReadyAt === null && document.querySelectorAll(selector).length >= want) {
      w.__kixReadyAt = performance.now();
      observer.disconnect();
    }
  };
  const observer = new MutationObserver(check);
  observer.observe(document, { childList: true, subtree: true });
};

interface Scenario {
  id: "discoveryReadyMs" | "discoveryPage50Ms" | "inventorySectionMs";
  checkId: string;
  label: string;
  path: () => Promise<string>;
  selector: string;
  want: number;
}

describe("long-list render budget (stub, headless Chrome, loopback)", () => {
  const suite = useBrowser();
  const limits = readLimits(inject("budgetFile"));

  async function firstSectionPath(): Promise<string> {
    const page = await suite.newPage();
    await page.goto(suite.origin + "/inventory");
    const link = page.locator("a[href^='/inventory?section=']").first();
    await link.waitFor();
    const href = await link.getAttribute("href");
    await page.close();
    expect(href).toMatch(/^\/inventory\?section=/);
    return href!;
  }

  const scenarios: Scenario[] = [
    { id: "discoveryReadyMs", checkId: "budget.render.discovery-ready", label: "/discovery (default page, 20 rows)", path: async () => "/discovery", selector: "[role=listbox][aria-label='Discovery results'] [role=option]", want: 20 },
    { id: "discoveryPage50Ms", checkId: "budget.render.discovery-page50", label: "/discovery?pageSize=50 (50 rows)", path: async () => "/discovery?pageSize=50", selector: "[role=listbox][aria-label='Discovery results'] [role=option]", want: 50 },
    { id: "inventorySectionMs", checkId: "budget.render.inventory-section", label: "/inventory section page (25 seats)", path: firstSectionPath, selector: "[role=listbox][aria-label='Seats on this page'] [role=option]", want: 25 },
  ];

  async function once(path: string, scenario: Scenario): Promise<{ ms: number; rows: number; nodes: number }> {
    const page: Page = await suite.newPage();
    await page.addInitScript(OBSERVER, { selector: scenario.selector, want: scenario.want });
    await page.goto(suite.origin + path);
    await page.waitForFunction(() => (window as unknown as { __kixReadyAt: number | null }).__kixReadyAt !== null);
    const result = await page.evaluate((selector) => ({
      ms: (window as unknown as { __kixReadyAt: number }).__kixReadyAt,
      rows: document.querySelectorAll(selector).length,
      nodes: document.querySelectorAll("#desk-main *").length,
    }), scenario.selector);
    await page.close();
    return { ms: result.ms, rows: result.rows, nodes: result.nodes };
  }

  for (const scenario of scenarios) {
    it(`${scenario.label}: ${RUNS} cold loads, the slowest stays under the cap`, async () => {
      const path = await scenario.path();
      const results = [];
      for (let i = 0; i < RUNS; i += 1) {
        results.push(await once(path, scenario));
      }
      const runs = results.map((item) => Math.round(item.ms));
      const capMs = limits.render[scenario.id];
      const rows = results[0]!.rows;
      for (const item of results) {
        // The page bound: a list that grew past its page size is a render regression of its own.
        expect(item.rows, "rows drawn").toBe(scenario.want);
        expect(item.nodes, "DOM nodes in the main region stay bounded").toBeLessThan(scenario.want * 40 + 800);
      }
      const measurement: RenderMeasurement = { id: scenario.id, runs, min: Math.min(...runs), median: median(runs), max: Math.max(...runs), capMs, rows, domNodes: results[0]!.nodes };
      recordLine("render.jsonl", measurement);
      expect(measurement.max, `slowest of ${RUNS} runs ${JSON.stringify(runs)} ms against the cap`).toBeLessThanOrEqual(capMs);
      const page = await suite.newPage();
      await suite.pass(page, scenario.checkId);
      await page.close();
    });
  }
});
