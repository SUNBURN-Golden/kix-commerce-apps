import { presentInstant } from "./a11y/present";

/** Desk clock. Locale is the default display locale. It does not decide expiry. */
export function formatWhen(iso: string): string {
  return presentInstant(iso, "en-GB");
}
