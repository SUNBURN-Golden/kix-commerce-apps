import { messages as copy0 } from "../i18n/messages/pages--JourneyIdentityPanels";
import { messages as copy1 } from "../i18n/messages/journey-identity";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { useState } from "react";
import { useRestoreFocus } from "../a11y/focus";
import {
  IDENTITY_BOUNDARY,
  IDENTITY_RULE_NOTE,
  IDENTITY_SCENARIO_NOTES,
  IDENTITY_SCENARIOS,
  IDENTITY_SESSION_NOTE,
  IDENTITY_SOURCE_LINE,
  IDENTITY_TITLE,
  type IdentityActions,
  type IdentityControl,
  type JourneyIdentityModel,
} from "../journey-identity";
import type { JourneyIdentityScenario } from "@kix/protocol-adapter";

export interface IdentityDeskLive {
  environment: "stub" | "integration-http";
  scenario: JourneyIdentityScenario;
  model: JourneyIdentityModel;
  heldSupported: boolean;
  lateSupported: boolean;
  actions: IdentityActions;
}

/**
 * A control that is off stays focusable and says why. A native disabled button is
 * skipped by the keyboard, so its reason would never be reached.
 */
function GuardedButton({ id, label, control, onPress }: { id: string; label: string; control: IdentityControl; onPress: () => void }) {
  const t = useT(copy0, copy1);
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
 * The journey context desk. Every row is a synthetic observation judged against
 * the current context key; nothing here is a producer receipt or a proof of
 * payment, issuance, or admission.
 */
export function JourneyIdentityPanel({ live }: { live: IdentityDeskLive }) {
  const t = useT(copy0, copy1);
  const { model, actions } = live;
  const [pendingScenario, setPendingScenario] = useState<JourneyIdentityScenario>(live.scenario);
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? `identity:${model.lastSeq}` : null, "identity-status");
  return (
    <section aria-label={deskText(t, IDENTITY_TITLE)} data-identity-state={model.state} data-adapter-environment={live.environment} data-source={live.environment === "stub" ? "synthetic-identity" : "none"}>
      <h2>{deskText(t, IDENTITY_TITLE)}</h2>
      <p className="muted">{deskText(t, IDENTITY_SOURCE_LINE)}</p>
      <p className="muted">{deskText(t, IDENTITY_BOUNDARY)}</p>
      <p className="muted">{deskText(t, IDENTITY_RULE_NOTE)}</p>
      <p className="muted">{deskText(t, IDENTITY_SESSION_NOTE)}</p>

      <div role="status" id="identity-status" tabIndex={-1} aria-live="polite" data-testid="identity-status">
        <p data-field="status">{deskText(t, model.statusLine)}</p>
        {model.detailLine ? <p className="muted">{deskText(t, model.detailLine)}</p> : null}
        {model.lastLine ? <p data-field="last">{deskText(t, model.lastLine)}</p> : null}
        <p className="muted">{deskText(t, model.freshnessWord)}</p>
        <p className="muted">{deskText(t, model.countersLine)}</p>
        {model.actionLabel ? (
          <button
            type="button"
            onClick={() => {
              if (model.actionLabel === copy0.en["s1gc"]) {
                actions.resetSource();
              } else {
                actions.refresh();
              }
            }}
          >
            {deskText(t, model.actionLabel)}
          </button>
        ) : null}
      </div>

      <h3>{t("sf8")}</h3>
      <table aria-label={t("sf9")}>
        <tbody>
          {deskText(t, model.contextRows.map((row) => (
            <tr key={row.field} data-context-field={row.field}>
              <th scope="row">{deskText(t, row.field)}</th>
              <td>{deskText(t, row.value)}</td>
            </tr>
          )))}
        </tbody>
      </table>

      <h3>{t("s13i")}</h3>
      {model.items.length === 0 ? (
        <p className="muted">{t("stx")}</p>
      ) : (
        <div className="identity-scroll" role="region" aria-label={t("s1d")} tabIndex={0}>
        <table aria-label={t("s1c")}>
          <thead>
            <tr>
              <th scope="col">{t("sp2")}</th>
              <th scope="col">{t("sps")}</th>
              <th scope="col">{t("s1n3")}</th>
              <th scope="col">{t("sox")}</th>
              <th scope="col">{t("s25y")}</th>
              <th scope="col">{t("s8v")}</th>
            </tr>
          </thead>
          <tbody>
            {deskText(t, model.items.map((row) => (
              <tr key={row.itemId} data-item={row.itemId} data-verdict={row.verdict} data-kind={row.kind}>
                <td>{deskText(t, row.itemId)}</td>
                <td>{deskText(t, row.kind)}</td>
                <td>{deskText(t, row.subjectRef)}</td>
                <td>{deskText(t, row.issuedLine)}</td>
                <td>
                  {deskText(t, row.verdict)}
                  <span className="muted"> — {deskText(t, row.detail)}</span>
                </td>
                <td>
                  <GuardedButton id={`attach-${row.itemId}`} label={t("s8v")} control={row.attach} onPress={() => actions.attach(row.itemId)} />
                </td>
              </tr>
            )))}
          </tbody>
        </table>
        </div>
      )}

      <h3>{t("s1jp")}</h3>
      {model.intents.length === 0 && model.quarantineLines.length === 0 && model.isolatedLines.length === 0 ? (
        <p className="muted">{t("s139")}</p>
      ) : (
        <ul>
          {deskText(t, model.intents.map((intent) => (
            <li key={intent.seq} data-outcome={intent.outcome} data-scope={intent.scope}>
              {deskText(t, intent.intentRef)} {t("s140")}{" "}{deskText(t, intent.scope)}: {deskText(t, intent.outcome)}
              {intent.code ? (" " + t("sd2", { code: intent.code })) : ""}
              {intent.lateLine ? t("sqk", { lateLine: intent.lateLine }) : ""}
            </li>
          )))}
          {deskText(t, model.quarantineLines.map((line) => (
            <li key={line} data-outcome="QUARANTINED">
              {deskText(t, line)}
            </li>
          )))}
          {deskText(t, model.isolatedLines.map((line) => (
            <li key={line} data-outcome="ISOLATED">
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
          <select
            aria-label={t("s1ic")}
            value={pendingScenario}
            onChange={(event) => setPendingScenario(event.target.value as JourneyIdentityScenario)}
          >
            {deskText(t, IDENTITY_SCENARIOS.map((scenario) => (
              <option key={scenario} value={scenario}>
                {deskText(t, scenario)}
              </option>
            )))}
          </select>
        </label>
        <ConnectivityWriteButton type="button" disabled={pendingScenario === live.scenario} onClick={() => actions.setScenario(pendingScenario)}>
          {t("s5q")}</ConnectivityWriteButton>
        <p className="muted">{deskText(t, IDENTITY_SCENARIO_NOTES[pendingScenario])}</p>
        <p className="muted">{t("s5n")}</p>
        <button type="button" onClick={() => actions.refresh()}>
          {t("s1ax")}</button>
        <button type="button" onClick={() => actions.switchActor()}>
          {t("s1nr")}</button>
        <button type="button" onClick={() => actions.switchRole()}>
          {t("s1ny")}</button>
        <ConnectivityWriteButton type="button" onClick={() => actions.rotateCut()}>
          {t("s1hn")}</ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" onClick={() => actions.resetSource()}>
          {t("s1gc")}</ConnectivityWriteButton>
        {live.heldSupported ? (
          <button type="button" onClick={() => actions.deliverHeld()}>
            {t("sg2")}</button>
        ) : null}
        {live.lateSupported ? (
          <button type="button" onClick={() => actions.deliverLate()}>
            {t("sg4")}</button>
        ) : null}
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
