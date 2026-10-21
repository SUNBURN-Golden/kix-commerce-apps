import { messages as copy0 } from "../i18n/messages/pages--OrganizerPanel";
import { messages as copy1 } from "../i18n/messages/organizer-desk";
import { messages as copy2 } from "../i18n/messages/storage-allow-list";
import { messages as copy3 } from "../i18n/messages/journey-desk";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { JOURNEY_RULING, ORGANIZER_DESK_NOT_BOUND, ORGANIZER_NOT_COMPOSED } from "@kix/protocol-adapter";
import type { OrganizerPanelModel, OrganizerRowStatus } from "../organizer-desk";

const STATUS_TEXT: Record<OrganizerRowStatus, string> = {
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

export function OrganizerPanel({ model }: { model: OrganizerPanelModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  const unavailable = model.path.kind === "unavailable";
  return (
    <aside className="panel organizer-panel" aria-label={t("s163")} data-organizer-path={model.path.kind}>
      <p className="eyebrow">{deskText(t, eyebrow(model))}</p>
      <h3>{t("s163")}</h3>
      <p>{deskText(t, JOURNEY_RULING)}</p>
      {model.source === "stub-shape" ? <p>{t("s1n0")}</p> : null}
      <p>{t("s15q")}</p>
      <p>{t("svk")}</p>
      <p className="muted">{t("s1fc")}</p>
      <p className="muted">
        {t("s14r")}</p>
      {model.path.kind === "checking" ? (
        <p className="muted">{t("sim")}</p>
      ) : null}
      {unavailable ? (
        <p className="alert" role="alert">
          {t("s169")}{model.path.kind === "unavailable" && model.path.code ? t("sd4", { code: model.path.code }) : ""}
        </p>
      ) : null}
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
                <dd>{deskText(t, STATUS_TEXT[row.status])}</dd>
              </div>
              <div>
                <dt>{t("s15j")}</dt>
                <dd>{deskText(t, row.operationId) ?? t("common.empty")}</dd>
              </div>
              <div>
                <dt>{t("s12")}</dt>
                <dd>{deskText(t, row.actor) ?? t("common.empty")}</dd>
              </div>
              <div>
                <dt>{t("error.fact.code")}</dt>
                <dd>{deskText(t, row.code) ?? t("common.empty")}</dd>
              </div>
              {row.requestId ? (
                <div>
                  <dt>{t("s1fq")}</dt>
                  <dd>{deskText(t, row.requestId)}</dd>
                </div>
              ) : null}
              {row.correlationId ? (
                <div>
                  <dt>{t("sek")}</dt>
                  <dd>{deskText(t, row.correlationId)}</dd>
                </div>
              ) : null}
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
        {deskText(t, ORGANIZER_NOT_COMPOSED.map((entry) => (
          <div key={entry.action}>
            <dt>{deskText(t, entry.action)}</dt>
            <dd>{t("s10j")}{" "}{deskText(t, entry.reason)}</dd>
          </div>
        )))}
      </dl>
      <p className="eyebrow">{t("sge")}</p>
      <dl className="facts">
        {deskText(t, ORGANIZER_DESK_NOT_BOUND.map((entry) => (
          <div key={entry.method}>
            <dt>{deskText(t, entry.method)}</dt>
            <dd>
              {deskText(t, entry.consideredAction) ?? t("common.empty")} {t("s10b")}{" "}{deskText(t, entry.reason)}
            </dd>
          </div>
        )))}
      </dl>
    </aside>
  );
}

function eyebrow(model: OrganizerPanelModel): string {
  if (model.path.kind === "available-stub-shape" || model.source === "stub-shape") {
    return copy0.en["e.31"];
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
  return copy0.en["e.32"];
}
