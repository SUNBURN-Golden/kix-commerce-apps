import type { DisplayLocale } from "../a11y/present";

/**
 * The display locales the app can show. App-internal; not a public schema, operation, capability or ID.
 * The default stays "en": choosing another locale is the user's act (URL parameter or the switch), never a guess from the browser.
 */
export const LOCALES = ["en", "ko"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** The name of the URL parameter read once at start-up: `?lang=ko` or `?lang=en`. */
export const LOCALE_PARAM = "lang";

/** The value for `<html lang>`. */
export function htmlLang(locale: Locale): string {
  return locale;
}

/** The Intl tag for clock text. It changes the words of the clock only; it never decides expiry. */
export function intlTag(locale: Locale): DisplayLocale {
  return locale === "ko" ? "ko-KR" : "en-GB";
}

/** Exact strings only: "ko" and "en". Anything else (case variants, region tags, empty) is not a choice. */
export function parseLocale(raw: unknown): Locale | null {
  for (const locale of LOCALES) {
    if (raw === locale) {
      return locale;
    }
  }
  return null;
}
