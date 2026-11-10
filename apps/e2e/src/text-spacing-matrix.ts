/** Structural only: global setup must not import the web runtime/message graph. */
export const SPACING_LOCALES = ["ko", "en"] as const;
export const spacingCheckId = (id: string, locale: string) => `a11y.spacing.${id}.${locale}`;
export const SPACING_EXTRA_CASES: readonly Pick<import("./text-spacing").TextSpacingObservation, "checkId" | "routeId" | "path" | "locale" | "state">[] = [
  { checkId: "a11y.spacing.fixture", routeId: "fixture", path: "fixture", locale: "en", state: "fixture" },
  ...SPACING_LOCALES.flatMap((locale) => [
    { checkId: spacingCheckId("discovery-alias", locale), routeId: "discovery", path: "/discovery/row_1", locale, state: "default" as const },
    { checkId: spacingCheckId("menu-open", locale), routeId: "box-office", path: "/", locale, state: "menu-open" as const },
    { checkId: spacingCheckId("booking-validation", locale), routeId: "booking", path: "/booking/evt_lanterns", locale, state: "validation" as const },
    { checkId: spacingCheckId("session-unknown", locale), routeId: "session", path: "/session", locale, state: "unknown" as const },
  ]),
];
export const SPACING_EXTRA_IDS = SPACING_EXTRA_CASES.map((row) => row.checkId);

/** Independent of pass markers: a successful marker without a measured row cannot satisfy coverage. */
export function spacingCoverageProblems(
  screens: readonly { screenId: string; path: string }[],
  observations: readonly import("./text-spacing").TextSpacingObservation[],
): string[] {
  const expected = [
    ...screens.flatMap((screen) => SPACING_LOCALES.map((locale) => ({ checkId: spacingCheckId(screen.screenId, locale), routeId: screen.screenId, path: screen.path, locale, state: "default" }))),
    ...SPACING_EXTRA_CASES,
  ];
  const problems: string[] = [];
  for (const want of expected) {
    const rows = observations.filter((row) => row.checkId === want.checkId);
    if (rows.length !== 1) { problems.push(`spacing observation count ${want.checkId}: ${rows.length}`); continue; }
    const row = rows[0];
    if (!row) continue;
    if (row.result !== "OBSERVED" || row.problems.length || row.textNodesChecked <= 0 || row.controlsChecked <= 0 || row.viewport.width !== 320 || row.viewport.height !== 568) problems.push(`spacing observation incomplete ${want.checkId}`);
    for (const [key, value] of Object.entries(want)) if (row[key as keyof typeof row] !== value) problems.push(`spacing observation mismatched ${want.checkId}: ${key}`);
  }
  for (const row of observations) if (!expected.some((want) => want.checkId === row.checkId) && row.checkId !== "a11y.spacing.fixture.negative") problems.push(`unexpected spacing observation ${row.checkId}`);
  return problems;
}
