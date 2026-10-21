import { messages as copy0 } from "../../i18n/messages/pages--marketing--M05Consent";
import { messages as copy1 } from "../../i18n/messages/consent-desk";
import { messages as copy2 } from "../../i18n/messages/storage-allow-list";
import { messages as copy3 } from "../../i18n/messages/marketing--contracts";
import { messages as copy4 } from "../../i18n/messages/marketing--desk";
import { deskText } from "../../i18n/desk-translate";
import { useState, type FormEvent } from "react";
import { emptyConsentDraft, useConsentDesk, type ConsentDraft, type ConsentPanelModel, type ConsentRowStatus } from "../../consent-desk";
import { useT } from "../../i18n/desk-context";
import { useFormatWhen } from "../../i18n/locale-context";
import { MARKETING_CONTRACT_ALIGNMENT } from "../../marketing/contracts";
import { marketingSession } from "../../marketing/session";
import { useMarketingSnapshot } from "../../marketing/useMarketingSnapshot";
import { MarketingChrome } from "./MarketingChrome";

export function M05Page() {
  const t = useT(copy0, copy1, copy2, copy3, copy4);
  const formatWhen = useFormatWhen();
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
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- The input is nested inside the label and the visible text is in the sibling span; the control is therefore labeled. */}
        <label className="check" htmlFor="performance-notes">
          <input
            id="performance-notes"
            type="checkbox"
            checked={performanceNotes}
            onChange={(event) => setPerformanceNotes(event.target.checked)}
          />
          <span>
            <span lang="ko">{t("s27a")}</span>
            <span className="muted"> {t("s17w")}</span>
          </span>
        </label>
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- The input is nested inside the label and the visible text is in the sibling span; the control is therefore labeled. */}
        <label className="check" htmlFor="membership-notes">
          <input
            id="membership-notes"
            type="checkbox"
            checked={membershipNotes}
            onChange={(event) => setMembershipNotes(event.target.checked)}
          />
          <span>
            <span lang="ko">{t("s27e")}</span>
            <span className="muted"> {t("ssi")}</span>
          </span>
        </label>
        <p className="muted">
          {t("s1i8")}{" "}{deskText(t, consent.channelSend)}{t("s1mq")}{" "}{deskText(t, consent.storage)}{t("s1xt")}{" "}
          {deskText(t, MARKETING_CONTRACT_ALIGNMENT.M05.missingFromStub.join(", "))}{t("sbz")}{" "}{deskText(t, consent.channelSend)}.
        </p>
        <div className="row-actions">
          <button type="submit">{t("s1i7")}</button>
          <button type="button" className="ghost" onClick={withdraw}>
            {t("s26r")}</button>
        </div>
      </form>
      <article className="stamp">
        <p className="stamp-word">{consent.state}</p>
        <p>
          {consent.updatedAt ? t("s25r", { v1: formatWhen(consent.updatedAt) }) : t("sux")}
        </p>
        <p className="muted">{t("s16f")}{" "}{deskText(t, consent.channelSend)}{t("s23l")}</p>
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
  "not-started": copy0.en["s12p"],
  ready: copy0.en["e.19"],
  "in-flight": copy0.en["e.20"],
  confirmed: copy0.en["e.21"],
  rejected: copy0.en["e.22"],
  unconfirmed: copy0.en["e.23"],
  "not-sent": copy0.en["e.24"],
  blocked: "Blocked",
  unavailable: copy0.en["s24z"],
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
  const t = useT(copy0, copy1, copy2, copy3, copy4);
  const unavailable = model.path.kind === "unavailable";
  return (
    <aside className="panel" aria-label={t("sds")} data-consent-path={model.path.kind}>
      <p className="eyebrow">{deskText(t, eyebrow(model))}</p>
      <h3>{t("sds")}</h3>
      <p>{t("s1ps")}</p>
      {model.source === "stub-shape" || model.path.kind === "available-stub-shape" ? (
        <p>{t("s1n1")}</p>
      ) : null}
      <p className="muted">
        {t("s1j8")}</p>
      <p className="muted">{t("s1fb")}</p>
      {model.path.kind === "checking" ? (
        <p className="muted">{t("sim")}</p>
      ) : null}
      {unavailable ? (
        <p className="alert" role="alert">
          {t("sdx")}{model.path.kind === "unavailable" && model.path.code ? t("sd4", { code: model.path.code }) : ""}
        </p>
      ) : null}
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label>
          {t("sis")}<input value={eventId} onChange={(event) => onEventId(event.target.value)} autoComplete="off" />
        </label>
        <label>
          {t("s1n3")}<input value={draft.subject} onChange={(event) => onDraft({ subject: event.target.value })} autoComplete="off" />
        </label>
        <label>
          {t("saq")}<input
            value={draft.business}
            onChange={(event) => onDraft({ business: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          {t("sby")}<input value={draft.channel} onChange={(event) => onDraft({ channel: event.target.value })} autoComplete="off" />
        </label>
        <label>
          {t("s1ag")}<input value={draft.purpose} onChange={(event) => onDraft({ purpose: event.target.value })} autoComplete="off" />
        </label>
        <label>
          {t("sk6")}<input
            value={draft.expectedConsentVersion}
            inputMode="numeric"
            placeholder={t("sas")}
            onChange={(event) => onDraft({ expectedConsentVersion: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          {t("s2y")}<select value={draft.allowed} onChange={(event) => onDraft({ allowed: event.target.value })}>
            <option value="">{t("sca")}</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </label>
      </form>
      <p>{deskText(t, model.lastConfirmed)}</p>
      <p>{deskText(t, model.unconfirmed)}</p>
      <ol className="journey-steps">
        {deskText(t, model.rows.map((row) => (
          <li key={row.step} className="journey-step" data-status={row.status}>
            <p className="eyebrow">{deskText(t, row.label)}</p>
            <p>{deskText(t, row.step)}</p>
            <dl className="facts">
              <div>
                <dt>{t("s1mj")}</dt>
                <dd>{deskText(t, ROW_STATUS[row.status])}</dd>
              </div>
              <div>
                <dt>{t("s15j")}</dt>
                <dd>{deskText(t, row.operationId) ?? t("common.empty")}</dd>
              </div>
              <div>
                <dt>{t("s12")}</dt>
                <dd>{row.actor && row.actor.length > 0 ? deskText(t, row.actor) : t("common.empty")}</dd>
              </div>
              <div>
                <dt>{t("error.fact.code")}</dt>
                <dd>{deskText(t, row.code) ?? t("common.empty")}</dd>
              </div>
            </dl>
            {row.note ? <p>{deskText(t, row.note)}</p> : null}
            {row.receipt ? (
              <dl className="facts">
                {row.receipt.map((field) => (
                  <div key={field.key}>
                    <dt>{deskText(t, field.key)}</dt>
                    <dd>{deskText(t, field.value)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <div className="row-actions">
              <button type="button" disabled={!row.canSend} onClick={() => model.send(row.step)}>
                {t("s1j5")}{" "}{deskText(t, row.step)}
              </button>
            </div>
          </li>
        )))}
      </ol>
      <p className="eyebrow">{t("s10i")}</p>
      <dl className="facts">
        {deskText(t, model.notComposed.map((entry) => (
          <div key={entry.label}>
            <dt>{deskText(t, entry.label)}</dt>
            <dd>{t("s10j")}{" "}{deskText(t, entry.detail)}</dd>
          </div>
        )))}
      </dl>
      <p className="eyebrow">{t("sge")}</p>
      <dl className="facts">
        {deskText(t, model.deskNotBound.map((entry) => (
          <div key={entry.label}>
            <dt>{deskText(t, entry.label)}</dt>
            <dd>{deskText(t, entry.detail)}</dd>
          </div>
        )))}
      </dl>
    </aside>
  );
}

function eyebrow(model: ConsentPanelModel): string {
  if (model.path.kind === "available-stub-shape" || model.source === "stub-shape") {
    return copy0.en["e.66"];
  }
  if (model.path.kind === "unavailable") {
    return copy0.en["e.26"];
  }
  if (model.path.kind === "checking") {
    return copy0.en["e.27"];
  }
  if (model.path.kind === "available") {
    return copy0.en["e.28"];
  }
  return copy0.en["sds"];
}
