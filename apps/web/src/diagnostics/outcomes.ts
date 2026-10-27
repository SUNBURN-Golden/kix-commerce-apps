import { sweepExport } from "../receipt-redaction";

export const DIAGNOSTICS_OUTCOME_LIMIT = 10;
type Context = "journey" | "gift" | "consent" | "organizer";
export interface OutcomeRow {
  step: string; status: string; actor: string | null; operationId: string | null;
  requestId: string | null; correlationId: string | null; code: string | null; note: string;
}
export interface OutcomeFlow { refId: string; rows: readonly OutcomeRow[] }
export interface DiagnosticOutcome {
  ordinal: number; context: Context; journeyRef: string; action: string;
  operationId: string | null; requestId: string | null; correlationId: string | null;
  outcome: string; code: string | null; reason: string;
}
const terminal = new Set(["confirmed", "rejected", "unconfirmed", "not-sent"]);

/** Actor substitution precedes the explorer's support-export sweep. Arbitrary notes never escape. */
function clean(value: string | null, actors: readonly string[]): string | null {
  if (value === null) return null;
  if (value.length > 512) return "[redacted]";
  let text = value;
  for (const actor of actors) {
    text = text.replace(new RegExp(actor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[redacted-actor]");
  }
  text = sweepExport(text)
    .replace(/[A-Z]{2}\d{2}[A-Z0-9]{11,30}|\d{12,}/gi, "[redacted-account]")
    .replace(/\$|currency|(?:KRW|USD|(?:settle_)?capture)|in stock|still open/gi, "[redacted]");
  return /^[A-Za-z0-9:_.[\]-]{1,512}$/.test(text) && !/\b\d{1,3}(?:\.\d{1,3}){3}\b/.test(text) ? text : "[redacted]";
}

/** Bounded page-lifetime record: completion order, no persistence and no clock. */
export function createOutcomeRecord() {
  let ordinal = 0;
  // Only actors attached to the retained completions are held, never exported.
  let held: { row: DiagnosticOutcome; actor: string | null }[] = [];
  let snapshot: { outcomes: readonly DiagnosticOutcome[]; omittedOutcomeCount: number } = { outcomes: [], omittedOutcomeCount: 0 };
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    observe(context: Context, before: readonly OutcomeFlow[], after: readonly OutcomeFlow[]) {
      const actors = [...new Set([
        ...held.map((item) => item.actor ?? ""),
        ...[...before, ...after].flatMap((flow) => flow.rows.map((row) => row.actor ?? "")),
      ].filter(Boolean))].sort((a, b) => b.length - a.length);
      const previousFlows = new Map(before.map((flow) => [flow.refId, flow]));
      const added: typeof held = [];
      for (const flow of after) for (const row of flow.rows) {
        if (!row.operationId || !terminal.has(row.status)) continue;
        const previous = previousFlows.get(flow.refId)?.rows.find((item) => item.step === row.step);
        if (previous && JSON.stringify(previous) === JSON.stringify(row)) continue;
        // Ignore receipt-field/UI-only changes to a settled row.
        if (previous && previous.operationId === row.operationId && previous.status === row.status && previous.requestId === row.requestId && previous.correlationId === row.correlationId && previous.note === row.note && previous.code === row.code) continue;
        added.push({ actor: row.actor, row: {
          ordinal: ++ordinal, context, journeyRef: clean(`${context}:${flow.refId}`, actors) ?? "",
          action: clean(row.step, actors) ?? "", operationId: clean(row.operationId, actors),
          requestId: clean(row.requestId, actors), correlationId: clean(row.correlationId, actors),
          outcome: row.status === "unconfirmed" ? "UNKNOWN" : row.status.toUpperCase().replaceAll("-", "_"),
          code: clean(row.code, actors),
          reason: row.status === "unconfirmed" ? "UNKNOWN" : "DETAIL_REDACTED",
        } });
      }
      const all = [...held, ...added];
      const next = all.slice(-DIAGNOSTICS_OUTCOME_LIMIT).map((item) => ({ ...item, row: {
        ...item.row,
        journeyRef: clean(item.row.journeyRef, actors) ?? "",
        action: clean(item.row.action, actors) ?? "",
        operationId: clean(item.row.operationId, actors),
        requestId: clean(item.row.requestId, actors),
        correlationId: clean(item.row.correlationId, actors),
        code: clean(item.row.code, actors),
      } }));
      if (!added.length && next.every((item, index) => JSON.stringify(item.row) === JSON.stringify(held[index]?.row))) return;
      held = next;
      snapshot = { outcomes: held.map((item) => item.row), omittedOutcomeCount: snapshot.omittedOutcomeCount + Math.max(0, all.length - DIAGNOSTICS_OUTCOME_LIMIT) };
      listeners.forEach((listener) => listener());
    },
  };
}
export const pageOutcomes = createOutcomeRecord();
