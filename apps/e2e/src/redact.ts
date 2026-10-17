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

/** Record keys whose value is a git object id written by the teardown itself (`git rev-parse`, `git merge-base`). */
export const GIT_ID_KEYS = ["appHead", "baseMainSha", "evidenceHead"] as const;

const GIT_OBJECT_ID = /^[0-9a-f]{40}$/;

/**
 * A git object id is hex, so by chance it can hold a run of nine or more digits
 * (the PR merge commit c17425a76a48010fa4ece21554538337cc301a5a did). Under one of
 * the id keys, a value with exactly that shape is masked before the text scan.
 * Any other value under those keys, and every other field, is scanned as is.
 */
export function maskGitIds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskGitIds);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const isId = (GIT_ID_KEYS as readonly string[]).includes(key) && typeof item === "string" && GIT_OBJECT_ID.test(item);
      out[key] = isId ? "<git-object-id>" : maskGitIds(item);
    }
    return out;
  }
  return value;
}

/** Scans a record as JSON text with the teardown's own git ids masked. Returns the pattern names that hit. */
export function findSensitiveInRecord(record: object): string[] {
  return findSensitive(JSON.stringify(maskGitIds(record), null, 2));
}
