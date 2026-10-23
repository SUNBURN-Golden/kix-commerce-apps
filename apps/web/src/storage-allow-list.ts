export const STORAGE_ALLOW_LIST = [
  "kix-session-journal",
  "kix-session-journal-quarantine",
  "kix-locale",
  "kix-onboarding",
  "kix-reservation-attempt:",
  "kix-resale-attempt:",
  "kix-organizer-attempt:",
  "kix-journey-attempt:",
  "kix-gift-attempt:",
  "kix-credit-attempt:",
  "kix-consent-attempt:",
  "kix-admission-attempt:",
  "kix-settlement-attempt:",
] as const;

const EXACT_KEYS = new Set<string>(STORAGE_ALLOW_LIST.slice(0, 4));
const PREFIXES: readonly string[] = STORAGE_ALLOW_LIST.slice(4);

export function isAllowedStorageKey(key: string): boolean {
  return EXACT_KEYS.has(key) || PREFIXES.some((prefix) => key.startsWith(prefix) && key.length > prefix.length);
}

export function assertAllowedStorageKey(key: string): void {
  if (!isAllowedStorageKey(key)) {
    throw new Error(`Browser storage key is not allowed: ${key}`);
  }
}

export function scanStorageViolations(store: Pick<Storage, "key" | "length">): string[] {
  const violations: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key !== null && !isAllowedStorageKey(key)) {
      violations.push(key);
    }
  }
  return violations;
}
