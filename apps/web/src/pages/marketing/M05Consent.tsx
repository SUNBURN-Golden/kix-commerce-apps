import { useState, type FormEvent } from "react";
import { emptyConsentDraft, useConsentDesk, type ConsentDraft, type ConsentPanelModel, type ConsentRowStatus } from "../../consent-desk";
import { formatWhen } from "../../format";
import { MARKETING_CONTRACT_ALIGNMENT } from "../../marketing/contracts";
import { marketingSession } from "../../marketing/session";
import { useMarketingSnapshot } from "../../marketing/useMarketingSnapshot";
import { MarketingChrome } from "./MarketingChrome";

export function M05Page() {
  const { snapshot, refresh } = useMarketingSnapshot();
  const [performanceNotes, setPerformanceNotes] = useState(snapshot.consent.performanceNotes);
  const [membershipNotes, setMembershipNotes] = useState(snapshot.consent.membershipNotes);
  const [eventId, setEventId] = useState("");
  const [draft, setDraft] = useState<ConsentDraft>(emptyConsentDraft());
  const bind = useConsentDesk(eventId, draft);
  const consent = snapshot.consent;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    marketingSession.saveConsent({ performanceNotes, membershipNotes });
    refresh();
  }

  function withdraw() {
    const next = marketingSession.withdrawConsent();
    setPerformanceNotes(next.performanceNotes);
    setMembershipNotes(next.membershipNotes);
    refresh();
  }

  return (
    <MarketingChrome id="M05">
      <form className="panel" onSubmit={onSubmit}>
        <label className="check">
          <input
            type="checkbox"
            checked={performanceNotes}
            onChange={(event) => setPerformanceNotes(event.target.checked)}
          />
          <span>
            <span lang="ko">공연 안내 플래그</span>
            <span className="muted"> Performance-note flag. No address is collected.</span>
          </span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={membershipNotes}
            onChange={(event) => setMembershipNotes(event.target.checked)}
          />
          <span>
            <span lang="ko">멤버십 소식 플래그</span>
            <span className="muted"> Membership-note flag. No address is collected.</span>
          </span>
        </label>
        <p className="muted">
          Saving writes flags on this stub. Channel send stays {consent.channelSend}. Storage is {consent.storage}.
          These flags are not the set_consent body. Missing field names:{" "}
          {MARKETING_CONTRACT_ALIGNMENT.M05.missingFromStub.join(", ")}. channelSend: {consent.channelSend}.
        </p>
        <div className="row-actions">
          <button type="submit">Save consent flags</button>
          <button type="button" className="ghost" onClick={withdraw}>
            Withdraw flags
          </button>
        </div>
      </form>
      <article className="stamp">
        <p className="stamp-word">{consent.state}</p>
        <p>
          {consent.updatedAt ? `Updated ${formatWhen(consent.updatedAt)}` : "No consent write on this session yet."}
        </p>
        <p className="muted">Outbound send: {consent.channelSend}. This screen has no sender.</p>
      </article>
      <ConsentBindPanel
        eventId={eventId}
        draft={draft}
        model={bind}
        onEventId={setEventId}
        onDraft={(partial) => setDraft((current) => ({ ...current, ...partial }))}
      />
    </MarketingChrome>
  );
}

const ROW_STATUS: Record<ConsentRowStatus, string> = {
  "not-started": "Not started",
  ready: "Ready",
  "in-flight": "In flight",
  confirmed: "Confirmed",
  rejected: "Rejected by the gate",
  unconfirmed: "Unconfirmed",
  "not-sent": "Not sent",
  blocked: "Blocked",
  unavailable: "Unavailable",
};

function ConsentBindPanel({
  eventId,
  draft,
  model,
  onEventId,
  onDraft,
}: {
  eventId: string;
  draft: ConsentDraft;
  model: ConsentPanelModel;
  onEventId: (value: string) => void;
  onDraft: (partial: Partial<ConsentDraft>) => void;
}) {
  const unavailable = model.path.kind === "unavailable";
  return (
    <aside className="panel" aria-label="Consent bind" data-consent-path={model.path.kind}>
      <p className="eyebrow">{eyebrow(model)}</p>
      <h3>Consent bind</h3>
      <p>The actor is not an authentication result.</p>
      {model.source === "stub-shape" || model.path.kind === "available-stub-shape" ? (
        <p>Stub-shape receipts are not gate receipts.</p>
      ) : null}
      <p className="muted">
        Sending set consent before authorize marketing is desk behavior for this page. It is not protocol law. Fields
        start empty. This page does not choose business, channel, purpose, or subject.
      </p>
      <p className="muted">Reload clears page-load state. A reload uses a new attempt id. CRM campaign editing stays out.</p>
      {model.path.kind === "checking" ? (
        <p className="muted">Environment integration-http. Loopback status is not loaded yet.</p>
      ) : null}
      {unavailable ? (
        <p className="alert" role="alert">
          Consent path unavailable. The reviewed gate answers no CORS preflight; the desk stays on integration HTTP and
          does not fall back to the stub.
          {model.path.kind === "unavailable" && model.path.code ? ` Code ${model.path.code}.` : ""}
        </p>
      ) : null}
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label>
          Event id
          <input value={eventId} onChange={(event) => onEventId(event.target.value)} autoComplete="off" />
        </label>
        <label>
          Subject
          <input value={draft.subject} onChange={(event) => onDraft({ subject: event.target.value })} autoComplete="off" />
        </label>
        <label>
          Business
          <input
            value={draft.business}
            onChange={(event) => onDraft({ business: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          Channel
          <input value={draft.channel} onChange={(event) => onDraft({ channel: event.target.value })} autoComplete="off" />
        </label>
        <label>
          Purpose
          <input value={draft.purpose} onChange={(event) => onDraft({ purpose: event.target.value })} autoComplete="off" />
        </label>
        <label>
          Expected consent version
          <input
            value={draft.expectedConsentVersion}
            inputMode="numeric"
            placeholder="Caller-supplied integer"
            onChange={(event) => onDraft({ expectedConsentVersion: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          Allowed
          <select value={draft.allowed} onChange={(event) => onDraft({ allowed: event.target.value })}>
            <option value="">Choose allowed</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </label>
      </form>
      <p>{model.lastConfirmed}</p>
      <p>{model.unconfirmed}</p>
      <ol className="journey-steps">
        {model.rows.map((row) => (
          <li key={row.step} className="journey-step" data-status={row.status}>
            <p className="eyebrow">{row.label}</p>
            <p>{row.step}</p>
            <dl className="facts">
              <div>
                <dt>Status</dt>
                <dd>{ROW_STATUS[row.status]}</dd>
              </div>
              <div>
                <dt>Operation</dt>
                <dd>{row.operationId ?? "none"}</dd>
              </div>
              <div>
                <dt>Actor</dt>
                <dd>{row.actor && row.actor.length > 0 ? row.actor : "none"}</dd>
              </div>
              <div>
                <dt>Code</dt>
                <dd>{row.code ?? "none"}</dd>
              </div>
            </dl>
            {row.note ? <p>{row.note}</p> : null}
            {row.receipt ? (
              <dl className="facts">
                {row.receipt.map((field) => (
                  <div key={field.key}>
                    <dt>{field.key}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <div className="row-actions">
              <button type="button" disabled={!row.canSend} onClick={() => model.send(row.step)}>
                Send {row.step}
              </button>
            </div>
          </li>
        ))}
      </ol>
      <p className="eyebrow">Not composed</p>
      <dl className="facts">
        {model.notComposed.map((entry) => (
          <div key={entry.label}>
            <dt>{entry.label}</dt>
            <dd>Not composed. {entry.detail}</dd>
          </div>
        ))}
      </dl>
      <p className="eyebrow">Desk methods not bound</p>
      <dl className="facts">
        {model.deskNotBound.map((entry) => (
          <div key={entry.label}>
            <dt>{entry.label}</dt>
            <dd>{entry.detail}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function eyebrow(model: ConsentPanelModel): string {
  if (model.path.kind === "available-stub-shape" || model.source === "stub-shape") {
    return "Consent bind · stub-shape receipts";
  }
  if (model.path.kind === "unavailable") {
    return "integration-http · unavailable";
  }
  if (model.path.kind === "checking") {
    return "integration-http · checking";
  }
  if (model.path.kind === "available") {
    return "integration-http · available";
  }
  return "Consent bind";
}
