import { assertAllowedStorageKey } from "./storage-allow-list";

export const COUNTER_EXHAUSTED = "COUNTER_EXHAUSTED";
const memory = new Map<string, number | null>();

function attemptKey(desk: string, id: string): string {
  return `kix-${desk}-attempt:${id.trim()}`;
}

function readAttempt(key: string): number | null | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    const stored = Number(raw);
    const previous = memory.get(key);
    const current = previous === null || (raw !== null && !/^\d+$/.test(raw)) || !Number.isSafeInteger(stored)
      ? null : Math.max(stored, previous ?? 0);
    memory.set(key, current);
    return current;
  } catch {
    return undefined;
  }
}

export function readDeskAttempt(desk: string, id: string): number | null {
  return id.trim() ? readAttempt(attemptKey(desk, id)) ?? null : 0;
}

export function writeDeskAttempt(desk: string, id: string, attempt: number | null): boolean {
  if (!id.trim()) return false;
  const key = attemptKey(desk, id);
  const current = readAttempt(key);
  if (current === undefined) return false;
  const next = attempt === null || !Number.isSafeInteger(attempt) || attempt < 0 || current === null
    ? null : Math.max(current, attempt);
  return saveAttempt(key, next);
}

function saveAttempt(key: string, next: number | null): boolean {
  assertAllowedStorageKey(key);
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
  if (!id.trim()) return null;
  const key = attemptKey(desk, id);
  const next = nextDeskAttempt(readAttempt(key) ?? null);
  if (next === null) return null;
  const saved = saveAttempt(key, next);
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
