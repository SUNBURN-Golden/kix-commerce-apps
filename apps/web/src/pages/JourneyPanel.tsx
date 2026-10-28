import { messages as bindingCopy } from "../i18n/messages/workspace--registry";
import { useStepOutcome } from "../a11y/focus";
import { messages as copy0 } from "../i18n/messages/pages--JourneyPanel";
import { messages as copy1 } from "../i18n/messages/journey-desk";
import { messages as copy2 } from "../i18n/messages/storage-allow-list";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { Link } from "react-router-dom";
import { JOURNEY_DESK_NOT_BOUND, JOURNEY_NOT_COMPOSED, JOURNEY_RULING } from "../../../../packages/protocol-adapter/src/booking-journey";
import type { JourneyPanelModel, JourneyRowStatus } from "../journey-desk";

const STATUS_TEXT: Record<JourneyRowStatus, string> = {
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

export function JourneyPanel({ variant, model }: { variant: "booking" | "box-office"; model: JourneyPanelModel }) {
  const t = useT(bindingCopy, copy0, copy1, copy2);
  const outcome = useStepOutcome("journey", model.rows);
  const unavailable = model.path.kind === "unavailable";
  return (
    <aside
      className="panel journey-panel"
      aria-label={t("sbp")}
      data-journey-variant={variant}
      data-journey-path={model.path.kind}
    >
      <p className="eyebrow">{deskText(t, eyebrow(model))}</p>
      <h3>{t("sbp")}</h3>
      <p>{deskText(t, JOURNEY_RULING)}</p>
      {model.source === "stub-shape" ? <p>{t("s1n0")}</p> : null}
      <p>{t("s18c")}</p>
      <p>{t("ssz")}</p>
      <p className="muted">{t("s18o")}</p>
      <p className="muted">{t("s6x")}</p>
      {model.path.kind === "checking" ? (
        <p className="muted">{t("sim")}</p>
      ) : null}
      {unavailable ? (
        <p className="alert" role="alert">
          {t("spk")}{model.path.kind === "unavailable" && model.path.code ? t("sd4", { code: model.path.code }) : ""}
        </p>
      ) : null}
      <p>{deskText(t, model.lastConfirmed)}</p>
      <p>{deskText(t, model.unconfirmed)}</p>
      {variant === "box-office" ? <p>{t("s271")}</p> : null}
      <ol className="journey-steps">
        {deskText(t, model.rows.map((row) => (
          <li key={row.step} className="journey-step" data-status={row.status}>
            <p className="eyebrow">{deskText(t, row.label)}</p>
            <p>
              {deskText(t, row.step)}
              {variant === "box-office" ? (" " + t("s18e")) : ""}
            </p>
            <dl className="facts">
              <div {...outcome.statusProps(row.step, row.status)}>
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
            {row.note ? <p id={outcome.noteId(row.step)}>{deskText(t, row.note)}</p> : null}
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
            {variant === "booking" ? (
              <div className="row-actions">
                <ConnectivityWriteButton type="button" disabled={!row.canSend} {...outcome.reasonProps(row.step, row.canSend, row.note)} onClick={() => {
                outcome.markSent(row.step);
                model.send(row.step);
              }}>
                  {t("s1j5")}{" "}{deskText(t, row.step)}
                </ConnectivityWriteButton>
              </div>
            ) : (
              <p className="muted">{t("s18f")}</p>
            )}
          </li>
        )))}
      </ol>
      {variant === "box-office" ? <OpenedList opened={model.opened} /> : null}
      <p className="eyebrow">{t("s10i")}</p>
      <dl className="facts">
        {deskText(t, JOURNEY_NOT_COMPOSED.map((entry) => (
          <div key={entry.action}>
            <dt>{deskText(t, entry.action)}</dt>
            <dd>{t("s10j")}{" "}{deskText(t, entry.reason)}</dd>
          </div>
        )))}
      </dl>
      <p className="eyebrow">{t("sge")}</p>
      <dl className="facts">
        {deskText(t, JOURNEY_DESK_NOT_BOUND.map((entry) => (
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

function OpenedList({ opened }: { opened: JourneyPanelModel["opened"] }) {
  const t = useT(bindingCopy, copy0, copy1, copy2);
  return (
    <div>
      <p className="eyebrow">{t("spo")}</p>
      {opened.length === 0 ? (
        <p className="empty">{t("svu")}</p>
      ) : (
        <ul className="journey-opened">
          {deskText(t, opened.map((item) => (
            <li key={item.eventId}>
              <Link to={`/booking/${encodeURIComponent(item.eventId)}`}>{deskText(t, item.eventId)}</Link>
              <p>{deskText(t, item.lastConfirmed)}</p>
              <p>{deskText(t, item.unconfirmed)}</p>
            </li>
          )))}
        </ul>
      )}
    </div>
  );
}

function eyebrow(model: JourneyPanelModel): string {
  if (model.path.kind === "available-stub-shape" || model.source === "stub-shape") {
    return copy0.en["e.30"];
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
  return "wave6a.journey";
}
