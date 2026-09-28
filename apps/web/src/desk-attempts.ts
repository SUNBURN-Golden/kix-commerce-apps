/**
 * Attempt counters for desk idempotency keys. A desk moves to a new attempt
 * after a rejection or a reconcile, so the next click is a new command and
 * not a replay. The stub case outlives a route change, so the counter lives
 * in sessionStorage for the tab and in memory for this page load.
 * Storage that is missing, blocked, or full never throws here, and a read
 * never goes back below the highest attempt this page load has used.
 */
const memory = new Map<string, number>();

export function readDeskAttempt(desk: string, id: string): number {
  const trimmed = id.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  const key = attemptKey(desk, trimmed);
  return Math.max(readStored(key) ?? 0, memory.get(key) ?? 0);
}

export function writeDeskAttempt(desk: string, id: string, attempt: number): void {
  const key = attemptKey(desk, id.trim());
  memory.set(key, Math.max(attempt, memory.get(key) ?? 0));
  try {
    sessionStorage.setItem(key, String(attempt));
  } catch {
    // Memory keeps the attempt for this page load.
  }
}

function attemptKey(desk: string, id: string): string {
  return `kix-${desk}-attempt:${id}`;
}

function readStored(key: string): number | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) {
      return null;
    }
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  } catch {
    return null;
  }
}
