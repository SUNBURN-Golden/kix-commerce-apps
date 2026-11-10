import type { SessionControllerState, SessionJournalPeek } from "@kix/protocol-adapter";
import type { ConnectivitySnapshot } from "../connectivity/store";
import type { Locale } from "../i18n/locales";
import { redactSupportText } from "../receipt-redaction";
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
  const journal = journalView(input.journal, input.liveJournal);
  const view = {
    kind: "kix-app-diagnostics",
    // Only this imported build identity is trusted; input fields never gain a pin exemption.
    buildIdentity: {
      appVersion: buildIdentity.appVersion,
      pinDigestAlgorithm: buildIdentity.pinDigestAlgorithm,
      pinDigest: buildIdentity.pinDigest,
      pins: {
        contractOnlyOpenApiSha256: buildIdentity.pins.contractOnlyOpenApiSha256,
        integrationGateOpenApiSha256: buildIdentity.pins.integrationGateOpenApiSha256,
        sdk0ManifestSha256: buildIdentity.pins.sdk0ManifestSha256,
        sdk0CatalogueSha256: buildIdentity.pins.sdk0CatalogueSha256,
      },
    }, mode: input.mode,
    origin: input.mode === "stub" ? "none" : "loopback", locale: redactSupportText(input.locale),
    display: { colorScheme: redactSupportText(input.display.colorScheme), forcedColors: redactSupportText(input.display.forcedColors), reducedMotion: redactSupportText(input.display.reducedMotion) },
    connectivity: { state: input.connectivity.state, writesBlocked: input.connectivity.writesBlocked, epoch: input.connectivity.epoch },
    sessionJournal: { state: journal.state, cause: redactSupportText(journal.cause), usedRecords: journal.usedRecords, maxRecords: journal.maxRecords },
    outcomes: input.outcomes.slice(-DIAGNOSTICS_OUTCOME_LIMIT).map((row) => ({
      ordinal: row.ordinal, context: redactSupportText(row.context), journeyRef: redactSupportText(row.journeyRef), action: redactSupportText(row.action),
      operationId: redactSupportText(row.operationId), requestId: redactSupportText(row.requestId), correlationId: redactSupportText(row.correlationId),
      outcome: redactSupportText(row.outcome), code: redactSupportText(row.code), reason: redactSupportText(row.reason),
    })),
    outcomeLimit: DIAGNOSTICS_OUTCOME_LIMIT,
    omittedOutcomeCount: input.omittedOutcomeCount + Math.max(0, input.outcomes.length - DIAGNOSTICS_OUTCOME_LIMIT),
    sent: false, notEvidence: true, notApproval: true, productionReadiness: false,
  };
  return { view, exportText: JSON.stringify(view, null, 2) };
}
export type DiagnosticsModel = ReturnType<typeof buildDiagnostics>;
