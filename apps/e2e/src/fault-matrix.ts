/**
 * Browser fault cells. App-internal ids, not a public schema. These run on the
 * production stub bundle in headless Chrome and are recorded apart from the
 * journeys record and from the Node suite: different runner, different source,
 * different denominator. Faults are injected with addInitScript and
 * page.evaluate only. No hook exists in production source.
 */
export const FAULT_CHECKS = [
  "fault.FI-B01.storage-quota-on-attach",
  "fault.FI-B02.corrupt-blob-before-reload",
  "fault.FI-B03.storage-cleared-mid-session",
  "fault.FI-B04.blocked-session-storage",
  "fault.FI-B05.repeated-reload-held-answer",
] as const;

export const FAULT_NOT_RUN = [
  "FI-B06 concurrent gift, resale and admit across tabs (no shared source across tabs)",
  "FI-B07 HTTP mode in a browser (needs a gate with CORS; none is consumed)",
  "real storage-pressure or crash behaviour of a real device",
  "latency and SLO figures",
] as const;

export function isFaultCheck(id: string): boolean {
  return id.startsWith("fault.");
}
