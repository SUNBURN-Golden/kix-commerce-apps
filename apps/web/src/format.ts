import { copiedIntegerDigits, presentIntegerUnits, presentInstant, type DisplayLocale } from "./a11y/present";

/** Desk clock. The default display locale is en-GB; a caller may pass the user's chosen locale. It does not decide expiry. */
export function formatWhen(iso: string, locale: DisplayLocale = "en-GB"): string {
  return presentInstant(iso, locale);
}

/** Display only: preserve whole-unit digits, including large copied strings, without rounding or arithmetic. */
export function formatNumber(value: number, locale: DisplayLocale = "en-GB"): string {
  const digits = copiedIntegerDigits(value);
  if (digits === null) return String(value);
  return value.toLocaleString(locale, { useGrouping: false });
}

/** Amounts remain copied whole units; the caller supplies a localized unit label, never a currency conversion. */
export function formatUnits(value: number | string, unitLabel: string, locale: DisplayLocale = "en-GB"): string {
  return presentIntegerUnits(typeof value === "number" && Number.isSafeInteger(value) ? formatNumber(value, locale) : value, unitLabel);
}
