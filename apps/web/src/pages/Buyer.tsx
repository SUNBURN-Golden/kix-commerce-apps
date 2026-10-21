import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy0 } from "../i18n/messages/buyer-workspace";
import { messages as copy1 } from "../i18n/messages/gift-desk";
import { messages as copy2 } from "../i18n/messages/storage-allow-list";
import { messages as copy3 } from "../i18n/messages/journey-desk";
import { messages as copy4 } from "../i18n/messages/resale-desk";
import { messages as copy5 } from "../i18n/messages/reservation-desk";
import { messages as copy6 } from "../i18n/messages/workspace--registry";
import { messages as copy7 } from "../i18n/messages/refund-return";
import { deskText } from "../i18n/desk-translate";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AmountNotice, StatusMark } from "../a11y/marks";
import { useT } from "../i18n/desk-context";
import { useFormatWhen } from "../i18n/locale-context";
import { useBuyerWorkspace, type BuyerWorkspaceModel } from "../buyer-workspace";
import { useRefundReturnDesk } from "../refund-return";
import { EvidenceRow, ProgressRow, ReturnAction, StateNotice } from "./BuyerPanels";
import { RefundReturnPanel } from "./RefundReturnPanel";

export function BuyerPage() {
  const [eventId, setEventId] = useState("");
  const { model, readAgain } = useBuyerWorkspace(eventId);
  const refundDesk = useRefundReturnDesk(eventId);
  return (
    <>
      <BuyerScreen model={model} onReadAgain={readAgain} onSelectEvent={setEventId} />
      <RefundReturnPanel live={refundDesk} variant="buyer" />
    </>
  );
}

export function BuyerScreen({
  model,
  onReadAgain,
  onSelectEvent,
}: {
  model: BuyerWorkspaceModel;
  onReadAgain: () => void;
  onSelectEvent: (eventId: string) => void;
}) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7);
  const formatWhen = useFormatWhen();
  return (
    <div className="buyer">
      <nav className="buyer-nav" aria-label={t("desk.buyer.sections")} data-adapter-environment={model.environment}>
        <a href="#buyer-shows">{t("desk.buyer.shows")}</a>
        <a href="#buyer-progress">{t("desk.buyer.progress")}</a>
        <a href="#buyer-evidence">{t("desk.buyer.evidence")}</a>
      </nav>
      <div className="buyer-body">
        <header className="section-head buyer-section" data-adapter-environment={model.environment}>
          <p className="eyebrow">{t("desk.buyer.workspace")}</p>
          <h2>{t("desk.buyer.workspace")}</h2>
          <p>{deskText(t, model.ruling)}</p>
          <p>{deskText(t, model.stubSentence)}</p>
          <p>{deskText(t, model.reloadNote)}</p>
          <AmountNotice />
        </header>
        <section
          id="buyer-shows"
          className="buyer-section"
          data-adapter-environment={model.environment}
          data-catalog={model.catalog.kind}
          data-source={model.catalogSource}
        >
          <h3>{t("desk.buyer.shows")}</h3>
          <p>{t("desk.buyer.source")} {deskText(t, model.catalogSource)}</p>
          <StateNotice model={model} />
          {model.selectedEventId ? (
            <p>
              <StatusMark kind="selected" /> {t("desk.buyer.show")}{" "}{deskText(t, model.selectedEventId)}.
            </p>
          ) : null}
          {model.catalogAction ? <ReturnAction action={model.catalogAction} onReadAgain={onReadAgain} /> : null}
          {model.catalog.kind === "ready" ? (
            <ul className="buyer-list">
              {deskText(t, model.catalog.performances.map((item) => (
                <li key={item.eventId} className="buyer-show-row">
                  <p className="when">
                    <time dateTime={item.startsAt}>{formatWhen(item.startsAt)}</time>
                  </p>
                  <h3>{deskText(t, item.title)}</h3>
                  <p className="muted">{deskText(t, item.venue)}</p>
                  <button
                    type="button"
                    className="buyer-show"
                    aria-pressed={model.selectedEventId === item.eventId}
                    onClick={() => onSelectEvent(item.eventId)}
                  >
                    {deskText(t, item.title)}
                  </button>
                  <Link className="button buyer-action" to={`/booking/${encodeURIComponent(item.eventId)}`}>
                    {t("desk.buyer.open")}</Link>
                </li>
              )))}
            </ul>
          ) : null}
        </section>
        <section
          id="buyer-progress"
          className="buyer-section"
          data-adapter-environment={model.environment}
          data-source={model.catalogSource}
        >
          <h3>{t("desk.buyer.progress")}</h3>
          {deskText(t, model.confirmedSummaries.map((line) => (
            <p key={line}>{deskText(t, line)}</p>
          )))}
          <ul className="buyer-list">
            {deskText(t, model.progress.map((row, index) => (
              <ProgressRow key={`${index}:${row.stage}:${row.label}`} row={row} onReadAgain={onReadAgain} />
            )))}
          </ul>
        </section>
        <section
          id="buyer-evidence"
          className="buyer-section"
          data-adapter-environment={model.environment}
          data-source={model.catalogSource}
        >
          <h3>{t("desk.buyer.evidence")}</h3>
          {model.evidence.length === 0 ? <p className="empty">{t("desk.buyer.empty")}</p> : null}
          <ul className="buyer-list">
            {deskText(t, model.evidence.map((row) => (
              <EvidenceRow key={`${row.kind}:${row.refId}:${row.operationId ?? row.step}`} row={row} />
            )))}
          </ul>
        </section>
        <section className="buyer-section" data-adapter-environment={model.environment} data-source="none">
          <h3>{t("desk.buyer.recorded")}</h3>
          <ul className="buyer-list">
            {deskText(t, model.recorded.map((entry) => (
              <li key={entry.action} className="buyer-progress" data-state="not-bound" data-source="none">
                <p>{deskText(t, entry.action)}</p>
                <p>{deskText(t, entry.reason)}</p>
              </li>
            )))}
          </ul>
        </section>
      </div>
    </div>
  );
}
