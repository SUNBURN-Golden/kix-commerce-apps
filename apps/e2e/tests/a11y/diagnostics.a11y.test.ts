import { describe, expect, it } from "vitest";
import { A11Y_BASELINE } from "../../src/a11y-matrix";
import { runAxe } from "../../src/a11y-axe";
import { useBrowser } from "../../src/suite";

describe("diagnostics accessibility (stub)", () => {
  const suite = useBrowser();
  for (const width of [390, 1280]) it(`axe clean at ${width}px`, async () => {
    const page = await suite.newPage(); await page.setViewportSize({ width, height: 844 });
    await page.goto(suite.origin + "/diagnostics"); await page.locator("#diagnostics-copy").waitFor();
    const scan = await runAxe(page, A11Y_BASELINE.tags); expect(scan.violations).toEqual([]);
    await suite.pass(page, `a11y.diagnostics.${width}`); await page.close();
  });
});
