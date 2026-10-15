import { useState } from "react";
import { Link } from "react-router-dom";
import { AmountNotice, StatusMark } from "../a11y/marks";
import { formatWhen } from "../format";
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
  return (
    <div className="buyer">
      <nav className="buyer-nav" aria-label="Buyer sections" data-adapter-environment={model.environment}>
        <a href="#buyer-shows">Shows</a>
        <a href="#buyer-progress">Progress</a>
        <a href="#buyer-evidence">Evidence</a>
      </nav>
      <div className="buyer-body">
        <header className="section-head buyer-section" data-adapter-environment={model.environment}>
          <p className="eyebrow">Buyer workspace</p>
          <h2>Buyer workspace</h2>
          <p>{model.ruling}</p>
          <p>{model.stubSentence}</p>
          <p>{model.reloadNote}</p>
          <AmountNotice />
        </header>
        <section
          id="buyer-shows"
          className="buyer-section"
          data-adapter-environment={model.environment}
          data-catalog={model.catalog.kind}
          data-source={model.catalogSource}
        >
          <h3>Shows</h3>
          <p>source {model.catalogSource}</p>
          <StateNotice model={model} />
          {model.selectedEventId ? (
            <p>
              <StatusMark kind="selected" /> Show {model.selectedEventId}.
            </p>
          ) : null}
          {model.catalogAction ? <ReturnAction action={model.catalogAction} onReadAgain={onReadAgain} /> : null}
          {model.catalog.kind === "ready" ? (
            <ul className="buyer-list">
              {model.catalog.performances.map((item) => (
                <li key={item.eventId} className="buyer-show-row">
                  <p className="when">
                    <time dateTime={item.startsAt}>{formatWhen(item.startsAt)}</time>
                  </p>
                  <h3>{item.title}</h3>
                  <p className="muted">{item.venue}</p>
                  <button
                    type="button"
                    className="buyer-show"
                    aria-pressed={model.selectedEventId === item.eventId}
                    onClick={() => onSelectEvent(item.eventId)}
                  >
                    {item.title}
                  </button>
                  <Link className="button buyer-action" to={`/booking/${encodeURIComponent(item.eventId)}`}>
                    Open booking
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <section
          id="buyer-progress"
          className="buyer-section"
          data-adapter-environment={model.environment}
          data-source={model.catalogSource}
        >
          <h3>Progress</h3>
          {model.confirmedSummaries.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <ul className="buyer-list">
            {model.progress.map((row, index) => (
              <ProgressRow key={`${index}:${row.stage}:${row.label}`} row={row} onReadAgain={onReadAgain} />
            ))}
          </ul>
        </section>
        <section
          id="buyer-evidence"
          className="buyer-section"
          data-adapter-environment={model.environment}
          data-source={model.catalogSource}
        >
          <h3>Evidence</h3>
          {model.evidence.length === 0 ? <p className="empty">No receipt on this page load.</p> : null}
          <ul className="buyer-list">
            {model.evidence.map((row) => (
              <EvidenceRow key={`${row.kind}:${row.refId}:${row.operationId ?? row.step}`} row={row} />
            ))}
          </ul>
        </section>
        <section className="buyer-section" data-adapter-environment={model.environment} data-source="none">
          <h3>Recorded and not sent</h3>
          <ul className="buyer-list">
            {model.recorded.map((entry) => (
              <li key={entry.action} className="buyer-progress" data-state="not-bound" data-source="none">
                <p>{entry.action}</p>
                <p>{entry.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
