import { assertAllowedStorageKey } from "../storage-allow-list";

export const ONBOARDING_STORAGE_KEY = "kix-onboarding";
export const ONBOARDING_DISMISSED = "dismissed";

function store(): Storage | null {
  assertAllowedStorageKey(ONBOARDING_STORAGE_KEY);
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function readOnboardingDismissed(): boolean {
  try {
    return store()?.getItem(ONBOARDING_STORAGE_KEY) === ONBOARDING_DISMISSED;
  } catch {
    return false;
  }
}

export function writeOnboardingDismissed(): void {
  try {
    store()?.setItem(ONBOARDING_STORAGE_KEY, ONBOARDING_DISMISSED);
  } catch {
    // A blocked or full store leaves the choice in page memory only.
  }
}

export function clearOnboardingDismissed(): void {
  try {
    store()?.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    // A blocked store leaves the choice in page memory only.
  }
}
