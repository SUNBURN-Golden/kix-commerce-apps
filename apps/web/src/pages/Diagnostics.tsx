import { useRef, useState, useSyncExternalStore } from "react";
import { peekSessionJournal } from "@kix/protocol-adapter";
import { connectivity } from "../connectivity/store";
import { protocol } from "../connectivity/desk-protocol";
import { useLocale } from "../i18n/locale-context";
import { useT } from "../i18n/desk-context";
import { messages } from "../i18n/messages/pages--Diagnostics";
import { pageSessionJournalState } from "../session-recovery";
import { pageSessionStore } from "../session-store";
import { useDisplayPreferences } from "../diagnostics/display-prefs";
import { pageOutcomes } from "../diagnostics/outcomes";
import { buildDiagnostics, type DiagnosticsModel } from "../diagnostics/model";

export function DiagnosticsPage() {
  const { locale } = useLocale();
  const display = useDisplayPreferences();
  const connection = useSyncExternalStore(connectivity.subscribe, connectivity.getSnapshot, connectivity.getSnapshot);
  const outcomes = useSyncExternalStore(pageOutcomes.subscribe, pageOutcomes.getSnapshot, pageOutcomes.getSnapshot);
  const model = buildDiagnostics({ mode: protocol.describe().environment, locale, display, connectivity: connection,
    journal: peekSessionJournal(pageSessionStore()), liveJournal: pageSessionJournalState(), ...outcomes });
  return <DiagnosticsView model={model} />;
}

export function DiagnosticsView({ model }: { model: DiagnosticsModel }) {
  const t = useT(messages);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState<"diag.idle" | "diag.selected" | "diag.copied">("diag.idle");
  const v = model.view;
  function copy() {
    ref.current?.focus();
    ref.current?.select();
    setNote("diag.selected");
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(model.exportText).then(() => setNote("diag.copied"), () => setNote("diag.selected"));
    }
  }
  const displayValue = (value: string | number) => value === "yes" ? t("diag.yes") : value === "no" ? t("diag.no") : value;
  const fields = [
    ["diag.mode", v.mode], ["diag.origin", v.origin], ["diag.locale", v.locale],
    ["diag.scheme", v.display.colorScheme], ["diag.forced", v.display.forcedColors], ["diag.motion", v.display.reducedMotion],
    ["diag.connection", v.connectivity.state], ["diag.epoch", v.connectivity.epoch], ["diag.blocked", String(v.connectivity.writesBlocked)],
  ] as const;
  return <section className="receipt" data-page="diagnostics" data-adapter-environment={v.mode}>
    <header className="section-head"><h2>{t("diag.title")}</h2><p>{t("diag.boundary")}</p></header>
    <section className="panel" aria-labelledby="diagnostics-build"><h3 id="diagnostics-build">{t("diag.build")}</h3>
      <dl className="receipt-detail">
        <dt>{t("diag.version")}</dt><dd>{v.buildIdentity.appVersion}</dd>
        <dt>{t("diag.digest")}</dt><dd style={{ overflowWrap: "anywhere" }}>{v.buildIdentity.pinDigestAlgorithm} · {v.buildIdentity.pinDigest}</dd>
        <dt>{t("diag.pins")}</dt><dd style={{ overflowWrap: "anywhere" }}>{Object.entries(v.buildIdentity.pins).map(([key, value]) => <p key={key}>{key} · {value}</p>)}</dd>
      </dl>
    </section>
    <section className="panel"><h3>{t("diag.state")}</h3><dl className="receipt-detail">
      {fields.map(([key, value]) => <div key={key}><dt>{t(key)}</dt><dd>{displayValue(value)}</dd></div>)}
    </dl></section>
    <section className="panel"><h3>{t("diag.journal")}</h3><p>{v.sessionJournal.state}</p>
      <dl className="receipt-detail"><dt>{t("diag.cause")}</dt><dd>{v.sessionJournal.cause ?? t("common.empty")}</dd>
      <dt>{t("diag.records")}</dt><dd>{v.sessionJournal.usedRecords ?? t("common.empty")} / {v.sessionJournal.maxRecords ?? t("common.empty")}</dd></dl>
    </section>
    <section className="panel"><h3>{t("diag.outcomes")}</h3><p>{t("diag.limit", { count: v.outcomeLimit, omitted: v.omittedOutcomeCount })}</p>
      {v.outcomes.length === 0 ? <p className="empty">{t("diag.empty")}</p> : <ol className="receipt-list">{v.outcomes.map((row) => <li key={row.ordinal} data-outcome={row.outcome} style={{ overflowWrap: "anywhere" }}>
        <p>{row.ordinal} · {row.context} · {row.action} · {row.outcome}</p>
        <dl><dt>{t("diag.trace")}</dt><dd>{row.journeyRef} / {row.operationId} / {row.requestId} / {row.correlationId}</dd>
        <dt>{t("diag.reason")}</dt><dd>{row.code} · {row.reason}</dd></dl>
      </li>)}</ol>}
    </section>
    <section className="panel receipt-export"><h3>{t("diag.export")}</h3>
      <label htmlFor="diagnostics-export">{t("diag.export")}</label>
      <textarea id="diagnostics-export" ref={ref} value={model.exportText} readOnly spellCheck={false} />
      <button id="diagnostics-copy" type="button" onClick={copy}>{t("diag.copy")}</button><p role="status">{t(note)}</p>
    </section>
  </section>;
}
