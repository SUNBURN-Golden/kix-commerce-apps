/**
 * The visual baseline matrix. App-internal; not a public schema, operation, capability or ID.
 *
 * A matching screenshot says the layout did not move against a recorded picture on the same render profile.
 * It does not say the layout is right, accessible, accepted or released. Those are separate facets.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SessionOptions } from "./browser";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The suite launches Chrome with FONTCONFIG_FILE pointing here, so the only fonts a picture can
 * resolve are the four OFL files vendored in `apps/e2e/fonts/`. A machine's installed fonts never
 * reach a screenshot, which is what lets one committed profile match every Linux runner.
 */
export const VISUAL_FONTS_CONF = path.resolve(here, "../fonts/fonts.conf");
export const VISUAL_FONT_FILES = ["NanumGothic-Regular.ttf", "NanumGothic-Bold.ttf", "NanumMyeongjo-Regular.ttf", "NanumMyeongjo-Bold.ttf"] as const;

export const VISUAL_VIEWPORTS = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
} as const;
export type VisualViewport = keyof typeof VISUAL_VIEWPORTS;

/** Chosen through `?lang=` only, the same start-up parameter a user can use. The test never writes sessionStorage. */
export const VISUAL_LOCALES = ["en", "ko"] as const;
export type VisualLocale = (typeof VISUAL_LOCALES)[number];

export type VisualScheme = "light" | "dark" | "forced-colors";

export interface VisualScreen {
  /** Reuses the registry id and concrete sample path. */
  screenId: string;
  path: string;
  /** Full: both viewports × both locales. Coverage: phone/ko and desktop/en. */
  matrix: "full" | "coverage";
}

export const VISUAL_SCREENS: readonly VisualScreen[] = [
  { screenId: "box-office", path: "/", matrix: "full" },
  { screenId: "buyer", path: "/buyer", matrix: "full" },
  { screenId: "discovery", path: "/discovery", matrix: "full" },
  { screenId: "booking", path: "/booking/evt_lanterns", matrix: "full" },
  { screenId: "organizer-workspace", path: "/organizer/workspace", matrix: "full" },
  { screenId: "handoff", path: "/handoff", matrix: "full" },
  { screenId: "help", path: "/help", matrix: "full" },
  { screenId: "inventory", path: "/inventory", matrix: "coverage" },
  { screenId: "admission", path: "/admission", matrix: "coverage" },
  { screenId: "resale", path: "/resale", matrix: "coverage" },
  { screenId: "gift", path: "/gift", matrix: "coverage" },
  { screenId: "mobile", path: "/mobile", matrix: "coverage" },
  { screenId: "assistant", path: "/assistant", matrix: "coverage" },
  { screenId: "organizer", path: "/organizer", matrix: "coverage" },
  { screenId: "merchant", path: "/merchant", matrix: "coverage" },
  { screenId: "finance", path: "/finance", matrix: "coverage" },
  { screenId: "provider", path: "/provider", matrix: "coverage" },
  { screenId: "credit", path: "/credit", matrix: "coverage" },
  { screenId: "credit-origination", path: "/credit/origination", matrix: "coverage" },
  { screenId: "credit-servicing", path: "/credit/servicing", matrix: "coverage" },
  { screenId: "marketing", path: "/marketing", matrix: "coverage" },
  { screenId: "marketing-journey", path: "/marketing/journey", matrix: "coverage" },
  { screenId: "marketing-m01", path: "/marketing/m01", matrix: "coverage" },
  { screenId: "marketing-m02", path: "/marketing/m02", matrix: "coverage" },
  { screenId: "marketing-m03", path: "/marketing/m03", matrix: "coverage" },
  { screenId: "marketing-m04", path: "/marketing/m04", matrix: "coverage" },
  { screenId: "marketing-m05", path: "/marketing/m05", matrix: "coverage" },
  { screenId: "platform", path: "/platform", matrix: "coverage" },
  { screenId: "marketplace-performance", path: "/marketplace-performance", matrix: "coverage" },
  { screenId: "permissions", path: "/permissions", matrix: "coverage" },
  { screenId: "notifications", path: "/notifications", matrix: "coverage" },
  { screenId: "identity", path: "/identity", matrix: "coverage" },
  { screenId: "session", path: "/session", matrix: "coverage" },
  { screenId: "receipts", path: "/receipts", matrix: "coverage" },
  { screenId: "journeys", path: "/journeys", matrix: "coverage" },
  { screenId: "qualification", path: "/qualification", matrix: "coverage" },
  { screenId: "release", path: "/release", matrix: "coverage" },
];

export interface VisualExclusion { path: string; note: string }
export const VISUAL_EXCLUSIONS: readonly VisualExclusion[] = [
  { path: "/dev/gallery", note: "Development-only route, compile-time removed from the production bundle the suite serves; covered by the gallery a11y suite." },
];

/** Structural input keeps the web registry out of harness runtime imports. Hidden production routes count too. */
export function visualRouteProblems(
  routes: readonly { id: string; path: string; sample: string; nav: string }[],
  screens: readonly VisualScreen[] = VISUAL_SCREENS,
  exclusions: readonly VisualExclusion[] = VISUAL_EXCLUSIONS,
): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const excluded = new Set<string>();
  for (const exclusion of exclusions) {
    if (!exclusion.note.trim()) problems.push(`${exclusion.path}: exclusion needs a meaningful note`);
    if (excluded.has(exclusion.path)) problems.push(`${exclusion.path}: duplicate exclusion`);
    excluded.add(exclusion.path);
    const sample = routes.find((route) => route.path === exclusion.path)?.sample ?? exclusion.path;
    if (screens.some((screen) => screen.path === sample)) problems.push(`${exclusion.path}: both pictured and excluded`);
  }
  for (const screen of screens) {
    if (ids.has(screen.screenId)) problems.push(`${screen.screenId}: duplicate screen id`);
    ids.add(screen.screenId);
    const route = routes.find((item) => item.sample === screen.path);
    if (!route) problems.push(`${screen.path}: screen matches no registry sample`);
    else if (route.id !== screen.screenId) problems.push(`${screen.path}: screen id differs from registry id ${route.id}`);
  }
  for (const route of routes) {
    if (!screens.some((screen) => screen.path === route.sample) && !excluded.has(route.path)) {
      problems.push(`${route.id}: registry route (${route.nav}) has no visual screen or exclusion note`);
    }
  }
  return problems;
}

export interface VisualMask { maskId: string; selector: string; hasText?: string; count: number; reason: string }
export const VISUAL_MASKS: Readonly<Record<string, readonly VisualMask[]>> = {
  receipts: [
    { maskId: "receipts.session-id", selector: "#desk-main .receipt .section-head p", hasText: "page:[0-9a-f]{16}", count: 1, reason: "Entire session paragraph: pageSessionId is minted per load (receipt-explorer.ts mintSessionId)." },
    { maskId: "receipts.diagnostic-export", selector: "#receipt-diagnostic", count: 1, reason: "Entire diagnostic export textarea: exportText embeds the same sessionId alongside other diagnostics." },
  ],
};
export const VISUAL_MASK_COLOR = "#ff00ff";

export interface VisualShot {
  screenId: string;
  path: string;
  viewport: VisualViewport;
  locale: VisualLocale;
  scheme: VisualScheme;
}

/** Dark scheme and forced colours (the high-contrast mode) on a few screens. They are not repeated for every screen. */
export const VISUAL_DISPLAY_SHOTS: readonly { screenId: string; viewport: VisualViewport; locale: VisualLocale; scheme: Exclude<VisualScheme, "light"> }[] = [
  { screenId: "box-office", viewport: "desktop", locale: "en", scheme: "dark" },
  { screenId: "discovery", viewport: "phone", locale: "ko", scheme: "dark" },
  { screenId: "handoff", viewport: "desktop", locale: "en", scheme: "forced-colors" },
  { screenId: "booking", viewport: "phone", locale: "ko", scheme: "forced-colors" },
];

/**
 * A picture covers the top of the page, at most this many CSS pixels tall. Taller pages are cut here so the committed set stays
 * bounded as route coverage grows. The sideways-overflow probe still looks at the whole document; what lies below the cut is not compared.
 */
export const MAX_SHOT_HEIGHT = 2000;

/** The clock every page sees. `Date.now` and `new Date()` are frozen; timers keep running. */
export const FIXED_TIME_ISO = "2026-10-21T00:00:00.000Z";

/**
 * The comparison rule. A pixel differs when any of its R, G or B values differs by more than `channelDelta` (of 255).
 * A shot passes when the differing pixels are at most `maxDiffPpm` parts per million of the picture. A size mismatch
 * always fails. Same render profile and same build give 0 differing pixels; the allowance is for small anti-aliasing noise only.
 */
export const TOLERANCE = { channelDelta: 8, maxDiffPpm: 200 } as const;

/** Pinned in the harness, not in product code. Fonts, text rendering, colour profile and scale are fixed. */
export const VISUAL_SESSION: SessionOptions = {
  args: ["--font-render-hinting=none", "--disable-font-subpixel-positioning", "--disable-lcd-text", "--force-color-profile=srgb", "--force-device-scale-factor=1"],
  env: { FONTCONFIG_FILE: VISUAL_FONTS_CONF },
  // The app reads only `?lang=` and the tab's saved choice, never the browser language, so this value decides nothing on screen.
  context: { timezoneId: "UTC", locale: "en-US", deviceScaleFactor: 1, reducedMotion: "reduce" },
};

export const shotId = (screenId: string, viewport: VisualViewport, locale: VisualLocale, scheme: VisualScheme = "light"): string =>
  `${screenId}.${viewport}.${locale}.${scheme}`;

export const visualCheckId = (id: string): string => `visual.${id}`;

/** Every screenshot, in a stable order: the light matrix first, then the display variants. */
export function visualShots(): VisualShot[] {
  const shots: VisualShot[] = [];
  for (const screen of VISUAL_SCREENS) {
    if (screen.matrix === "coverage") {
      shots.push({ ...screen, viewport: "phone", locale: "ko", scheme: "light" }, { ...screen, viewport: "desktop", locale: "en", scheme: "light" });
      continue;
    }
    for (const viewport of Object.keys(VISUAL_VIEWPORTS) as VisualViewport[]) {
      for (const locale of VISUAL_LOCALES) {
        shots.push({ ...screen, viewport, locale, scheme: "light" });
      }
    }
  }
  for (const display of VISUAL_DISPLAY_SHOTS) {
    const screen = VISUAL_SCREENS.find((item) => item.screenId === display.screenId);
    if (!screen) {
      throw new Error(`Display shot names an unknown screen: ${display.screenId}`);
    }
    shots.push({ ...screen, viewport: display.viewport, locale: display.locale, scheme: display.scheme });
  }
  return shots;
}

export const idOf = (shot: VisualShot): string => shotId(shot.screenId, shot.viewport, shot.locale, shot.scheme);

/** Checks the harness tests record. A missing one fails the run. */
export const VISUAL_STATIC_CHECK_IDS: readonly string[] = [
  "visual.harness.route-coverage",
  "visual.harness.masks",
  "visual.harness.doc-table",
  "visual.harness.marketplace-layout",
  "visual.harness.identical",
  "visual.harness.shifted",
  "visual.harness.size-mismatch",
  "visual.harness.update-refused-in-ci",
  "visual.harness.baseline-set",
  "visual.harness.launch-flags",
  "visual.harness.fonts",
  "visual.harness.profile",
  "visual.harness.record-redaction",
];

export function expectedVisualCheckIds(): string[] {
  return [...visualShots().map((shot) => visualCheckId(idOf(shot))), ...VISUAL_STATIC_CHECK_IDS];
}
