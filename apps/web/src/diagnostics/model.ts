import type { SessionControllerState, SessionJournalPeek } from "@kix/protocol-adapter";
import type { ConnectivitySnapshot } from "../connectivity/store";
import type { Locale } from "../i18n/locales";
import { sweepExport } from "../receipt-redaction";
import { buildIdentity } from "./build-identity";
import type { DisplayPreferences } from "./display-prefs";
import { DIAGNOSTICS_OUTCOME_LIMIT, type DiagnosticOutcome } from "./outcomes";

export function journalView(peek: SessionJournalPeek, live: SessionControllerState | null) {
  const base = { state: "EMPTY", cause: null as string | null, usedRecords: null as number | null, maxRecords: null as number | null };
  // Known loss survives even if the backing store has subsequently been replaced.
  if (live?.status.kind === "evidence-lost") return { ...base, state: "EVIDENCE_LOST", cause: live.status.cause };
  if (peek.kind === "evidence-lost") return { ...base, state: "EVIDENCE_LOST", cause: peek.cause };
  if (peek.kind === "empty" && live?.status.kind === "ready") return { ...base, state: "EVIDENCE_LOST", cause: "LOST_DURING_SESSION" };
  if (live?.status.kind === "unavailable") return { ...base, state: "UNAVAILABLE", cause: live.status.cause };
  if (peek.kind === "unavailable") return { ...base, state: "UNAVAILABLE", cause: peek.cause };
  if (peek.kind === "empty") return base;
  return { ...base, state: peek.full ? "QUOTA" : "OK", usedRecords: peek.usedRecords, maxRecords: peek.maxRecords };
}
export interface DiagnosticsInput {
  mode: "stub" | "integration-http";
  locale: Locale; display: DisplayPreferences; connectivity: ConnectivitySnapshot;
  journal: SessionJournalPeek; liveJournal: SessionControllerState | null;
  outcomes: readonly DiagnosticOutcome[]; omittedOutcomeCount: number;
}
export function buildDiagnostics(input: DiagnosticsInput) {
  const view = {
    kind: "kix-app-diagnostics", buildIdentity, mode: input.mode,
    origin: input.mode === "stub" ? "none" : "loopback", locale: input.locale,
    display: { colorScheme: input.display.colorScheme, forcedColors: input.display.forcedColors, reducedMotion: input.display.reducedMotion },
    connectivity: { state: input.connectivity.state, writesBlocked: input.connectivity.writesBlocked, epoch: input.connectivity.epoch },
    sessionJournal: journalView(input.journal, input.liveJournal),
    outcomes: input.outcomes.slice(-DIAGNOSTICS_OUTCOME_LIMIT).map((row) => ({
      ordinal: row.ordinal, context: row.context, journeyRef: row.journeyRef, action: row.action,
      operationId: row.operationId, requestId: row.requestId, correlationId: row.correlationId,
      outcome: row.outcome, code: row.code, reason: row.reason,
    })),
    outcomeLimit: DIAGNOSTICS_OUTCOME_LIMIT,
    omittedOutcomeCount: input.omittedOutcomeCount + Math.max(0, input.outcomes.length - DIAGNOSTICS_OUTCOME_LIMIT),
    sent: false, notEvidence: true, notApproval: true, productionReadiness: false,
  };
  return { view, exportText: sweepExport(JSON.stringify(view, null, 2)) };
}
export type DiagnosticsModel = ReturnType<typeof buildDiagnostics>;
