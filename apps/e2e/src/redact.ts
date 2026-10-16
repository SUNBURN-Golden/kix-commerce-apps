/**
 * The run record is built from an allow-list. This scan is a second guard: it finds text that looks like
 * an email address, a bearer or token string, or a long digit run, so none of it can reach a record or a log.
 */
const PATTERNS: readonly [string, RegExp][] = [
  ["email", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
  ["bearer", /\bbearer\s+[A-Za-z0-9._~+/=-]{8,}/i],
  ["token", /\b(?:ghp|gho|ghs|sk|pk|xox[abp])[-_][A-Za-z0-9_-]{12,}/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./],
  ["long-digits", /\d{9,}/],
];

export function findSensitive(text: string): string[] {
  return PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}
