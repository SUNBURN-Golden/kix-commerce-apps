import { describe, expect, it } from "vitest";
import { SCREENS } from "../src/a11y-matrix";
import { SPACING_EXTRA_CASES, SPACING_LOCALES, spacingCheckId, spacingCoverageProblems } from "../src/text-spacing-matrix";
import type { TextSpacingObservation } from "../src/text-spacing";

function complete(): TextSpacingObservation[] {
  const row: TextSpacingObservation = { checkId: "", routeId: "fixture", path: "fixture", locale: "en", state: "fixture", viewport: { width: 320, height: 568 }, result: "OBSERVED", textNodesChecked: 1, controlsChecked: 1, nativeControlsChecked: 0, scrollRegionsChecked: 0, problems: [] };
  return [
    ...SCREENS.flatMap((screen) => SPACING_LOCALES.map((locale) => ({ ...row, checkId: spacingCheckId(screen.screenId, locale), routeId: screen.screenId, path: screen.path, locale, state: "default" as const }))),
    ...SPACING_EXTRA_CASES.map((extra) => ({ ...row, ...extra })),
  ];
}

describe("text spacing observation denominator", () => {
  it("requires measured rows independently of pass markers; rejects missing, duplicate, wrong-locale and vacuous observations", () => {
    const rows = complete();
    expect(spacingCoverageProblems(SCREENS, rows)).toEqual([]);
    expect(spacingCoverageProblems(SCREENS, rows.slice(1)).join(" ")).toContain(rows[0]!.checkId);
    expect(spacingCoverageProblems(SCREENS, [...rows, rows[0]!]).join(" ")).toContain("count");
    for (const change of [{ locale: "en" }, { path: "/wrong" }, { textNodesChecked: 0 }, { controlsChecked: 0 }, { result: "NOT_RUN" }, { problems: [{ code: "spacing.text-clipped", target: '[data-spacing-node="0"]' }] }]) {
      expect(spacingCoverageProblems(SCREENS, [{ ...rows[0]!, ...change } as TextSpacingObservation, ...rows.slice(1)]).length).toBeGreaterThan(0);
    }
    expect(spacingCoverageProblems(SCREENS, [...rows, { ...rows[0]!, checkId: "a11y.spacing.ghost.en" }]).join(" ")).toContain("unexpected");
  });
});
