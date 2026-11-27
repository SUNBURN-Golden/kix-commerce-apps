import { assertAllowedStorageKey } from "./storage-allow-list";

export const COUNTER_EXHAUSTED = "COUNTER_EXHAUSTED";
const memory = new Map<string, number | null>();

function attemptKey(desk: string, id: string): string {
  return `kix-${desk}-attempt:${id.trim()}`;
}

function readStored(key: string): number | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return 0;
    const parsed = Number(raw);
    return /^\d+$/.test(raw) && Number.isSafeInteger(parsed) ? parsed : null;
  } catch {
    return 0;
  }
}

export function readDeskAttempt(desk: string, id: string): number | null {
  if (!id.trim()) return 0;
  const key = attemptKey(desk, id);
  const stored = readStored(key);
  const previous = memory.get(key) ?? 0;
  const current = stored === null || memory.get(key) === null ? null : Math.max(stored, previous);
  memory.set(key, current);
  return current;
}

export function writeDeskAttempt(desk: string, id: string, attempt: number | null): boolean {
  if (!id.trim()) return false;
  const key = attemptKey(desk, id);
  assertAllowedStorageKey(key);
  const current = readDeskAttempt(desk, id);
  const next = attempt === null || !Number.isSafeInteger(attempt) || attempt < 0 || current === null
    ? null : Math.max(current, attempt);
  memory.set(key, next);
  const value = next === null ? COUNTER_EXHAUSTED : String(next);
  try {
    sessionStorage.setItem(key, value);
    return sessionStorage.getItem(key) === value;
  } catch {
    // Memory keeps the high-water mark when storage is blocked or full.
    return false;
  }
}

export function nextDeskAttempt(current: number | null): number | null {
  return current !== null && Number.isSafeInteger(current) && current >= 0 && current < Number.MAX_SAFE_INTEGER
    ? current + 1 : null;
}

/** Journey counters store the last allocated ID. */
export function allocateDeskAttempt(desk: string, id: string): number | null {
  const next = nextDeskAttempt(readDeskAttempt(desk, id));
  if (next === null) return null;
  const saved = writeDeskAttempt(desk, id, next);
  if (next === Number.MAX_SAFE_INTEGER && !saved) return null;
  return next;
}

/** Legacy desks store the current attempt. Consume the final value before dispatch. */
export function claimCurrentDeskAttempt(
  id: string, read: (id: string) => number | null, write: (id: string, value: number | null) => boolean,
): number | null {
  const current = read(id);
  if (current === null || !Number.isSafeInteger(current) || current < 0) return null;
  if (current === Number.MAX_SAFE_INTEGER && !write(id, null)) return null;
  return current;
}
