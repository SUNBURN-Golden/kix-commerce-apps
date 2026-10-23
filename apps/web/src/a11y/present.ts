import { en as sourceEn } from "../i18n/messages/a11y--present.en";
import { sourceMessage } from "../i18n/source-message";
/**
 * Amount, quantity, and deadline presentation for the existing desks.
 * Amounts are copied whole-unit strings. This module does not add, scale,
 * or round a figure, and it does not decide whether a reservation expired.
 * A display locale changes only the clock words. The authority stays the
 * adapter instant and the adapter expired flag.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

export const DISPLAY_TIME_ZONE = "UTC";

export const DISPLAY_LOCALES = ["en-GB", "ko-KR"] as const;

export type DisplayLocale = (typeof DISPLAY_LOCALES)[number];

export const AMOUNT_NOTICE =
  "Price and fee display is UNDETERMINED. No amount is calculated on this page.";

export const QUANTITY_NOTE = sourceEn["sel"];

const INTEGER_DIGITS = /^-?(?:0|[1-9][0-9]*)$/;

/** Booking quantity is one of these digits. A longer or fractional string is refused. */
const BOOKING_QUANTITIES = ["1", "2", "3", "4", "5", "6"] as const;

export type BookingQuantityDigit = (typeof BOOKING_QUANTITIES)[number];

const clocks = new Map<DisplayLocale, Intl.DateTimeFormat>();

function clockFor(locale: DisplayLocale): Intl.DateTimeFormat {
  const existing = clocks.get(locale);
  if (existing) {
    return existing;
  }
  const created = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DISPLAY_TIME_ZONE,
  });
  clocks.set(locale, created);
  return created;
}

/**
 * Visible clock for an ISO instant. The zone label stays UTC.
 * An unparseable string is returned unchanged and is not treated as an expiry.
 */
export function presentInstant(iso: string, locale: DisplayLocale = "en-GB"): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return iso;
  }
  return `${clockFor(locale).format(parsed)} UTC`;
}

export interface ExpiryAuthority {
  readonly expiresAt: string;
  readonly expired: boolean | null;
}

/**
 * Copies the adapter expiry fields. `expired` null means this record has no
 * adapter flag. This function does not read the formatted clock and does not
 * compare the instant with the current time.
 */
export function expiryAuthority(input: { expiresAt: string; expired: boolean | null }): ExpiryAuthority {
  return {
    expiresAt: input.expiresAt,
    expired: input.expired,
  };
}

export function presentDeadline(input: {
  expiresAt: string;
  expired: boolean | null;
  locale?: DisplayLocale;
}): { authority: ExpiryAuthority; clock: string; authorityLine: string } {
  const authority = expiryAuthority({ expiresAt: input.expiresAt, expired: input.expired });
  const clock = presentInstant(authority.expiresAt, input.locale ?? "en-GB");
  const flag = authority.expired === null ? "not decided on this page" : authority.expired ? "true" : "false";
  const authorityLine = sourceMessage(sourceEn["p.t0"], { v1: authority.expiresAt, v2: flag });
  return { authority, clock, authorityLine };
}

/** Digits of a safe integer, copied. A float or an unsafe number is refused. */
export function copiedIntegerDigits(value: number): string | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    return null;
  }
  const digits = String(value);
  if (!INTEGER_DIGITS.test(digits)) {
    return null;
  }
  return digits;
}

/** Whole-unit label. A decimal string or a float is refused and is not recalculated. */
export function presentIntegerUnits(value: number | string, unitLabel: string): string {
  const digits = typeof value === "string" ? (INTEGER_DIGITS.test(value) ? value : null) : copiedIntegerDigits(value);
  if (digits === null) {
    return sourceEn["s38"];
  }
  return `${digits} ${unitLabel}`;
}

export function presentQuantityLine(value: number): string {
  const digits = copiedIntegerDigits(value);
  if (digits === null) {
    return sourceEn["s1am"];
  }
  return `${digits}. ${QUANTITY_NOTE}`;
}

export function capacityLine(count: number): string {
  const digits = copiedIntegerDigits(count);
  if (digits === null) {
    return sourceEn["s1am"];
  }
  return sourceMessage(sourceEn["p.t1"], { v1: digits, v2: QUANTITY_NOTE });
}

/**
 * Booking quantity, copied from one allowed digit. Anything else, including
 * a decimal, is refused. This does not compute a price.
 */
export function bookingQuantity(raw: string): BookingQuantityDigit | null {
  for (const allowed of BOOKING_QUANTITIES) {
    if (raw === allowed) {
      return allowed;
    }
  }
  return null;
}

/** The matched digit as the integer the existing hold call already accepts. */
export function bookingQuantityNumber(raw: string): number | null {
  const allowed = bookingQuantity(raw);
  if (allowed === null) {
    return null;
  }
  return allowed.charCodeAt(0) - 48;
}

export function syntheticCountLine(count: number): string {
  const digits = copiedIntegerDigits(count);
  if (digits === null) {
    return sourceEn["s1oa"];
  }
  return sourceMessage(sourceEn["p.t2"], { v1: digits });
}

export function syntheticTierLine(tier: string | null): string | null {
  if (tier === null) {
    return null;
  }
  return sourceMessage(sourceEn["p.t3"], { v1: tier });
}
