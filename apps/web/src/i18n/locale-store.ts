import { DEFAULT_LOCALE, LOCALE_PARAM, parseLocale, type Locale } from "./locales";

/**
 * The only file in the app that names the tab's session storage for the display-language choice.
 * It holds a preference, not evidence: it is no part of the session journal, and no retention value is set here (the record TTL stays UNDETERMINED).
 * A blocked or missing store means the choice lives in memory only.
 */
export const LOCALE_STORAGE_KEY = "kix-locale";

function store(): Storage | null {
  try {
    const found = globalThis.sessionStorage;
    return found === undefined || found === null ? null : found;
  } catch {
    return null;
  }
}

export function readStoredLocale(): Locale | null {
  try {
    return parseLocale(store()?.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: Locale): void {
  try {
    store()?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Blocked or full: the choice stays in memory for this page load.
  }
}

/** The `lang` parameter of a query string, if it is exactly "ko" or "en". */
export function localeFromSearch(search: string): Locale | null {
  try {
    return parseLocale(new URLSearchParams(search).get(LOCALE_PARAM));
  } catch {
    return null;
  }
}

/** Start-up order: the URL parameter, then the tab's stored choice, then the default. No browser-language guess. */
export function initialLocale(search: string): Locale {
  return localeFromSearch(search) ?? readStoredLocale() ?? DEFAULT_LOCALE;
}
