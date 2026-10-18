import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, intlTag, type Locale } from "./locales";
import { makeTranslate, type Translate } from "./translate";
import type { DisplayLocale } from "../a11y/present";
import { formatWhen as formatWhenIn } from "../format";

export interface LocaleState {
  locale: Locale;
  t: Translate;
  /** The Intl tag for clock text. */
  clock: DisplayLocale;
  /** Set by the user's choice only. Without a provider this does nothing. */
  setLocale: (locale: Locale) => void;
}

/** Without a provider the app is the English app, so a render with no provider is unchanged. */
const DEFAULT_STATE: LocaleState = {
  locale: DEFAULT_LOCALE,
  t: makeTranslate(DEFAULT_LOCALE),
  clock: intlTag(DEFAULT_LOCALE),
  setLocale: () => {},
};

export const LocaleContext = createContext<LocaleState>(DEFAULT_STATE);

export function useLocale(): LocaleState {
  return useContext(LocaleContext);
}

export function useT(): Translate {
  return useContext(LocaleContext).t;
}

export function stateFor(locale: Locale, setLocale: (locale: Locale) => void): LocaleState {
  return { locale, t: makeTranslate(locale), clock: intlTag(locale), setLocale };
}

/** A formatter for `<time>` text. The locale changes the clock words only; expiry is never read from it. */
export function useFormatWhen(): (iso: string) => string {
  const { clock } = useLocale();
  return useMemo(() => (iso: string) => formatWhenIn(iso, clock), [clock]);
}
