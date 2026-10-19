import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { LocaleContext, stateFor } from "./locale-context";
import { htmlLang, type Locale } from "./locales";
import { initialLocale, writeStoredLocale } from "./locale-store";

/**
 * Holds the display language. It is read once at start-up (URL parameter, then the tab's stored choice, then "en")
 * and changes only when the user presses the switch. `initial` is for tests and server renders.
 */
export function LocaleProvider({ children, initial }: { children: ReactNode; initial?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => initial ?? initialLocale(typeof location === "undefined" ? "" : location.search));

  useEffect(() => {
    document.documentElement.lang = htmlLang(locale);
  }, [locale]);

  // A choice made through the URL is kept for the tab as well, so a route change (which drops the query) keeps it.
  useEffect(() => {
    if (initial === undefined) {
      writeStoredLocale(locale);
    }
  }, [initial, locale]);

  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);
  const value = useMemo(() => stateFor(locale, setLocale), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
