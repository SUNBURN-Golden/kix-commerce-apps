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
  /** Reuses the ids and paths of the accessibility matrix. */
  screenId: string;
  path: string;
}

export const VISUAL_SCREENS: readonly VisualScreen[] = [
  { screenId: "box-office", path: "/" },
  { screenId: "buyer", path: "/buyer" },
  { screenId: "discovery", path: "/discovery" },
  { screenId: "booking", path: "/booking/evt_lanterns" },
  // /receipts is out: receipt-explorer.ts mints a page session id per load, so no two pictures can match.
  { screenId: "organizer-workspace", path: "/organizer/workspace" },
  { screenId: "handoff", path: "/handoff" },
  { screenId: "help", path: "/help" },
];

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
 * a few megabytes. The sideways-overflow probe still looks at the whole document; what lies below the cut is not compared.
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
