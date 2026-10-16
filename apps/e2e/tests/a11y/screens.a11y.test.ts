import { describe, expect, it } from "vitest";
import { SCREENS, kbdCheckId, ratchet, reflowCheckId, structCheckId, type ViewportName } from "../../src/a11y-matrix";
import { overflowProblems, rootFontProblems, skipLinkProblems, structureProblems, tabWalkProblems } from "../../src/a11y-keyboard";
import { recordFacet } from "../../src/a11y-record";
import { useBrowser } from "../../src/suite";
import { openScreen } from "./helpers";

const startsWith = (prefix: string) => (ruleId: string) => ruleId.startsWith(prefix);

describe("per-screen keyboard, structure and reflow probes (stub, headless Chrome)", () => {
  const suite = useBrowser();

  async function settle(kind: "keyboard" | "reflow" | "structure", screenId: string, viewport: ViewportName, problems: string[], prefix: string) {
    recordFacet({ kind, screenId, result: problems.length > 0 ? "FINDING" : "OBSERVED", problems });
    const { unlisted, vanished } = ratchet(screenId, viewport, problems, startsWith(prefix));
    expect(unlisted, `${kind} problems not in KNOWN_FINDINGS on ${screenId}`).toEqual([]);
    expect(vanished, `OPEN ${kind} findings that no longer show on ${screenId}; mark them FIXED`).toEqual([]);
  }

  for (const screen of SCREENS) {
    it(`${screen.screenId}: skip link, Tab walk without a trap, names and focus marks (keys only)`, async () => {
      const page = await suite.newPage();
      await openScreen(page, suite.origin, screen.path, "desktop");
      const problems = [...(await skipLinkProblems(page))];
      const walk = await tabWalkProblems(page);
      problems.push(...walk.problems);
      expect(walk.stops, "the Tab walk reached no stop").toBeGreaterThan(0);
      await settle("keyboard", screen.screenId, "desktop", problems, "kbd.");
      await suite.pass(page, kbdCheckId(screen.screenId));
      await page.close();
    });

    it(`${screen.screenId}: table names and headers, scroll regions, status words, labels, error links at 320px`, async () => {
      const page = await suite.newPage();
      await openScreen(page, suite.origin, screen.path, "narrow");
      await settle("structure", screen.screenId, "narrow", await structureProblems(page), "struct.");
      await suite.pass(page, structCheckId(screen.screenId));
      await page.close();
    });

    it(`${screen.screenId}: no sideways document scroll at 320px, and at a 200% root font (approximation, not zoom)`, async () => {
      const page = await suite.newPage();
      await openScreen(page, suite.origin, screen.path, "narrow");
      const problems = [...(await overflowProblems(page, "reflow.narrow-overflow")), ...(await rootFontProblems(page))];
      await settle("reflow", screen.screenId, "narrow", problems, "reflow.");
      await suite.pass(page, reflowCheckId(screen.screenId));
      await page.close();
    });
  }
});
