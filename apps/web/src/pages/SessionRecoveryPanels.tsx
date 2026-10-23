import { messages as mergedCopy } from "../i18n/messages/merged-surfaces";
import { messages as copy0 } from "../i18n/messages/pages--SessionRecoveryPanels";
import { messages as copy1 } from "../i18n/messages/session-recovery";
import { messages as copy2 } from "../i18n/messages/journey-identity";
import { messages as copy3 } from "../i18n/messages/storage-allow-list";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { AsyncState } from "../components/AsyncState";
import { useState } from "react";
import { useRestoreFocus } from "../a11y/focus";
import {
  SESSION_BOUNDARY,
  SESSION_RECOVERY_RULE,
  SESSION_RETENTION_NOTE,
  SESSION_SCENARIOS,
  SESSION_SCENARIO_NOTES,
  SESSION_SOURCE_LINE,
  SESSION_STANDING_NOTICE,
  SESSION_TITLE,
  type SessionActions,
  type SessionControl,
  type SessionRecoveryModel,
  type SessionScenario,
} from "../session-recovery";

export interface SessionDeskLive {
  environment: "stub" | "integration-http";
  scenario: SessionScenario;
  model: SessionRecoveryModel;
  heldSupported: boolean;
  actions: SessionActions;
}

/**
 * A control that is off stays focusable and says why. A native disabled button is
 * skipped by the keyboard, so its reason would never be reached.
 */
function GuardedButton({ id, label, control, onPress }: { id: string; label: string; control: SessionControl; onPress: () => void }) {
  const t = useT(mergedCopy, copy0, copy1, copy2, copy3);
  const reasonId = `${id}-reason`;
  return (
    <span className="refund-guard">
      <ConnectivityWriteButton
        id={id}
        type="button"
        aria-disabled={control.enabled ? undefined : true}
        aria-describedby={control.reason ? reasonId : undefined}
        onClick={() => {
          if (control.enabled) {
            onPress();
          }
        }}
      >
        {deskText(t, label)}
      </ConnectivityWriteButton>
      {control.reason ? (
        <span id={reasonId} className="muted">
          {deskText(t, control.reason)}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The session recovery desk. The journal here is a tab-session record of what
 * was sent. It is not proof that anything applied, and not an exactly-once guarantee.
 */
export function SessionRecoveryPanel({ live }: { live: SessionDeskLive }) {
  const t = useT(mergedCopy, copy0, copy1, copy2, copy3);
  const { model, actions } = live;
  const [pendingScenario, setPendingScenario] = useState<SessionScenario>(live.scenario);
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? `session:${model.lastSeq}` : null, "session-status");
  const bound = live.environment === "stub";
  return (
    <section aria-label={deskText(t, SESSION_TITLE)} data-session-state={model.state} data-adapter-environment={live.environment} data-source={bound ? "synthetic-session" : "none"}>
      <h2>{deskText(t, SESSION_TITLE)}</h2>
      <p className="muted">{deskText(t, SESSION_SOURCE_LINE)}</p>
      <p className="muted">{deskText(t, SESSION_BOUNDARY)}</p>
      <p className="muted">{deskText(t, SESSION_RECOVERY_RULE)}</p>
      <p data-field="standing-notice" role="note">
        {deskText(t, SESSION_STANDING_NOTICE)}
      </p>
      <p className="muted">{deskText(t, SESSION_RETENTION_NOTE)}</p>

      <div role="status" id="session-status" tabIndex={-1} aria-live="polite" aria-busy={model.state === "in-progress"} data-testid="session-status">
        {model.state === "in-progress" || model.state === "empty" || model.state === "recovered" || model.state === "not-bound" ? (
          <AsyncState kind={model.state === "in-progress" ? "loading" : model.state === "recovered" ? "unknown" : model.state} label={t("merge.session")} announcement="parent" />
        ) : null}
        <p data-field="status">{deskText(t, model.statusLine)}</p>
        {model.detailLine ? <p className="muted">{deskText(t, model.detailLine)}</p> : null}
        {model.lastLine ? <p data-field="last">{deskText(t, model.lastLine)}</p> : null}
        <p className="muted">{deskText(t, model.loadLine)}</p>
        <p className="muted">{deskText(t, model.countersLine)}</p>
        <p className="muted">{deskText(t, model.budgetLine)}</p>
      </div>

      <h3>{t("s1n5")}</h3>
      {model.items.length === 0 ? (
        <p className="muted">{t("syu")}</p>
      ) : (
        <div className="identity-scroll" role="region" aria-label={t("s1n7")} tabIndex={0}>
          <table aria-label={t("s1n5")}>
            <thead>
              <tr>
                <th scope="col">{t("sp2")}</th>
                <th scope="col">{t("s1n3")}</th>
                <th scope="col">{t("s25y")}</th>
                <th scope="col">{t("s8v")}</th>
              </tr>
            </thead>
            <tbody>
              {deskText(t, model.items.map((row) => (
                <tr key={row.itemId} data-item={row.itemId} data-verdict={row.verdict}>
                  <td>{deskText(t, row.itemId)}</td>
                  <td>{deskText(t, row.subjectRef)}</td>
                  <td>{deskText(t, row.verdict)}</td>
                  <td>
                    <GuardedButton id={`session-attach-${row.itemId}`} label={t("s8v")} control={row.attach} onPress={() => actions.attach(row.itemId)} />
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}

      <h3>{t("s1jp")}</h3>
      {model.records.length === 0 && model.observationLines.length === 0 ? (
        <p className="muted">{t("s13a")}</p>
      ) : (
        <ul>
          {deskText(t, model.records.map((row) => (
            <li key={row.seq} data-outcome={row.outcome} data-kind={row.kind} data-scope={row.scope} data-load={row.loadNo}>
              {deskText(t, row.kind === "unknown" || row.kind === "recovered-unknown" ? <AsyncState kind="unknown" label={t("merge.sessionRecord")} announcement="parent"><p>{deskText(t, row.line)}</p></AsyncState> : row.line)}
            </li>
          )))}
          {deskText(t, model.observationLines.map((line) => (
            <li key={line} data-outcome="OBSERVED">
              {deskText(t, line)}
            </li>
          )))}
        </ul>
      )}

      <h3>{t("s1o9")}</h3>
      <p className="muted">{t("s1y1")}</p>
      <div role="group" aria-label={t("s1o9")}>
        <label>
          {t("s1ic")}{" "}
          <select aria-label={t("s1ic")} value={pendingScenario} onChange={(event) => setPendingScenario(event.target.value as SessionScenario)}>
            {deskText(t, SESSION_SCENARIOS.map((scenario) => (
              <option key={scenario} value={scenario}>
                {deskText(t, scenario)}
              </option>
            )))}
          </select>
        </label>
        <ConnectivityWriteButton type="button" disabled={pendingScenario === live.scenario} onClick={() => actions.setScenario(pendingScenario)}>
          {t("s1md")}</ConnectivityWriteButton>
        <p className="muted">{deskText(t, SESSION_SCENARIO_NOTES[pendingScenario])}</p>
        <p className="muted">{t("s43")}</p>
        <button type="button" onClick={() => actions.refresh()}>
          {t("s1ax")}</button>
        {live.heldSupported ? (
          <button type="button" onClick={() => actions.deliverHeld()}>
            {t("sg2")}</button>
        ) : null}
        <button type="button" onClick={() => actions.reloadPage()}>
          {t("s1fe")}</button>
        <p className="muted">{t("s1fd")}</p>
      </div>

      <h3>{t("s1dt")}</h3>
      <ul>
        {deskText(t, model.notComposed.map((entry) => (
          <li key={entry.action} data-action={entry.action}>
            {deskText(t, entry.action)}: {deskText(t, entry.reason)}
          </li>
        )))}
      </ul>
    </section>
  );
}
