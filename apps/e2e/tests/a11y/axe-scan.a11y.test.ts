import { describe, expect, it } from "vitest";
import { A11Y_BASELINE, SCREENS, VIEWPORTS, axeCheckId, ratchet, type ViewportName } from "../../src/a11y-matrix";
import { runAxe } from "../../src/a11y-axe";
import { recordFacet } from "../../src/a11y-record";
import { useBrowser } from "../../src/suite";
import { openScreen } from "./helpers";

describe("automated scan: axe-core on every screen, desktop and 320px (stub, headless Chrome)", () => {
  const suite = useBrowser();

  for (const screen of SCREENS) {
    for (const viewport of Object.keys(VIEWPORTS) as ViewportName[]) {
      it(`${screen.screenId} at ${viewport}: no violation outside KNOWN_FINDINGS`, async () => {
        const page = await suite.newPage();
        await openScreen(page, suite.origin, screen.path, viewport);
        const result = await runAxe(page, A11Y_BASELINE.tags);
        const violations = result.violations.map((rule) => rule.ruleId).sort();
        const incomplete = result.incomplete.map((rule) => rule.ruleId).sort();
        recordFacet({ kind: "axe", screenId: screen.screenId, viewport, violations, incomplete });
        const { unlisted, vanished } = ratchet(screen.screenId, viewport, violations, (id) => !id.includes("."));
        expect(unlisted, `violations not in KNOWN_FINDINGS on ${screen.path} at ${viewport}`).toEqual([]);
        expect(vanished, `OPEN findings that no longer show on ${screen.path} at ${viewport}; mark them FIXED`).toEqual([]);
        await suite.pass(page, axeCheckId(screen.screenId, viewport));
        await page.close();
      });
    }
  }
});
