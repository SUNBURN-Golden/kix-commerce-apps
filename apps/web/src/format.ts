import { presentInstant, type DisplayLocale } from "./a11y/present";

/** Desk clock. The default display locale is en-GB; a caller may pass the user's chosen locale. It does not decide expiry. */
export function formatWhen(iso: string, locale: DisplayLocale = "en-GB"): string {
  return presentInstant(iso, locale);
}
