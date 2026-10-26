import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy0 } from "../i18n/messages/pages--RefundReturnPanel";
import { messages as copy1 } from "../i18n/messages/refund-return";
import { messages as copy2 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { useRestoreFocus } from "../a11y/focus";
import { AmountNotice } from "../a11y/marks";
import {
  REFUND_BOUNDARY,
  REFUND_FENCE_NOTE,
  REFUND_NOTSENT_NOTE,
  REFUND_READ_NOTE,
  REFUND_RETURN_NOTE,
  REFUND_SCENARIO_NOTES,
  REFUND_SESSION_NOTE,
  REFUND_SOURCE_LINE,
  REFUND_TITLE,
  type RefundActions,
  type RefundControl,
  type RefundReturnModel,
} from "../refund-return";
import { REFUND_SCENARIOS, type RefundScenario, type RefundStep } from "../../../../packages/protocol-adapter/src/refund-return";

export interface RefundDeskLive {
  environment: "stub" | "integration-http";
  scenario: RefundScenario;
  orderRef: string | null;
  model: RefundReturnModel;
  heldSupported: boolean;
  lateSupported: boolean;
  actions: RefundActions;
}

/**
 * A control that is off stays focusable and says why. A native disabled button is
 * skipped by the keyboard, so its reason would never be reached.
 */
function GuardedButton({
  id,
  label,
  control,
  onPress,
}: {
  id: string;
  label: string;
  control: RefundControl;
  onPress: () => void;
}) {
  const t = useT(deskCopy, copy0, copy1, copy2);
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

const LINE_STEPS: Readonly<Record<string, RefundStep>> = {
  cancel: "cancel",
  void: "void",
  pgAdjust: "adjust",
  returnObservation: "observe-return",
  refund: "refund",
};

/**
 * The synthetic refund-and-return desk. Mounted on the booking page and the
 * box-office settlement area with write controls (`booking`, `settlement`),
 * and read-only on the buyer workspace (`buyer`). Every row is synthetic and
 * sends nothing to a protocol.
 */
export function RefundReturnPanel({
  live,
  variant,
}: {
  live: RefundDeskLive;
  /** booking and settlement render the write controls; buyer is read-only. */
  variant: "booking" | "settlement" | "buyer";
}) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  const model = live.model;
  const readOnly = variant === "buyer";
  const baseId = `refund-${variant}`;
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? `${baseId}:${model.lastSeq}` : null, `${baseId}-status`);

  return (
    <section
      id={baseId}
      className="refund-desk panel"
      aria-label={deskText(t, REFUND_TITLE)}
      data-refund-variant={variant}
      data-refund-state={model.state}
      data-adapter-environment={live.environment}
      data-source={live.environment === "stub" ? "synthetic-refund" : "none"}
    >
      <header className="section-head">
        <p className="eyebrow">{deskText(t, REFUND_TITLE)}</p>
        <h3>{deskText(t, REFUND_TITLE)}</h3>
        <p className="muted">{deskText(t, REFUND_SOURCE_LINE)}</p>
        <p className="muted">{deskText(t, REFUND_BOUNDARY)}</p>
        <p className="muted">{deskText(t, REFUND_RETURN_NOTE)}</p>
        <p className="muted">{deskText(t, REFUND_NOTSENT_NOTE)}</p>
        <AmountNotice />
      </header>

      <p id={`${baseId}-status`} className={model.state === "ready" ? "muted" : "alert"} role="status" tabIndex={-1}>
        {deskText(t, model.statusLine)} {deskText(t, model.detailLine)}
      </p>
      {model.lastLine ? <p className="muted">{deskText(t, model.lastLine)}</p> : null}
      {model.actionLabel ? (
        <button
          type="button"
          className="ghost"
          onClick={() =>
            model.state === "tuple-changed" || model.state === "refused" ? live.actions.newSession() : live.actions.refresh()
          }
        >
          {deskText(t, model.actionLabel)}
        </button>
      ) : null}

      <h4>{t("sli")}</h4>
      <ol className="refund-states">
        {deskText(t, model.cells.map((cell) => (
          <li key={cell.cell} className="refund-cell" data-track={cell.track} data-state={cell.state}>
            <p className="eyebrow">{deskText(t, cell.track)}</p>
            <p>
              <strong>{deskText(t, cell.label)}</strong> — {deskText(t, cell.state)}
            </p>
            <p className="muted">{deskText(t, cell.ref) ?? t("sxo")}</p>
            <p className="muted">{deskText(t, cell.note)}</p>
          </li>
        )))}
      </ol>

      <h4>{t("slj")}</h4>
      <ul className="refund-lines">
        {deskText(t, model.lines.map((line) => (
          <li key={line.line} className="refund-line" data-line={line.line} data-state={line.observedState} data-write={line.writeKind}>
            <p>
              <strong>{deskText(t, line.label)}</strong> — {line.observedState === "recorded" ? t("s1e0", { observedRef: line.observedRef ?? "" }) : t("common.empty")}
            </p>
            <p className="muted">{deskText(t, line.writeWord)}</p>
            <p className="muted">{deskText(t, line.note)}</p>
            <p className="muted">
              {line.pinnedAction === null ? t("sww") : t("s185", { pinnedAction: line.pinnedAction })}
            </p>
            {readOnly ? null : (
              <GuardedButton
                id={`${baseId}-${line.line}`}
                label={t("s1e9", { v1: line.label.toLowerCase() })}
                control={line.control}
                onPress={() => live.actions.write(LINE_STEPS[line.line])}
              />
            )}
          </li>
        )))}
      </ul>

      {readOnly ? null : (
        <div className="refund-controls">
          <h4>{t("s1o9")}</h4>
          <p className="muted">{deskText(t, REFUND_SESSION_NOTE)}</p>
          <p className="muted">{deskText(t, REFUND_FENCE_NOTE)}</p>
          <p className="muted">{deskText(t, REFUND_READ_NOTE)}</p>
          <div className="row-actions">
            <button type="button" className="ghost" onClick={() => live.actions.refresh()}>
              {t("s1ax")}</button>
            <ConnectivityWriteButton type="button" className="ghost" onClick={() => live.actions.markReturnRequired()}>
              {t("srr")}</ConnectivityWriteButton>
            <GuardedButton
              id={`${baseId}-held`}
              label={t("sg2")}
              control={
                live.heldSupported
                  ? { enabled: true, reason: null }
                  : { enabled: false, reason: copy0.en["e.37"] }
              }
              onPress={() => live.actions.deliverHeld()}
            />
            <GuardedButton
              id={`${baseId}-late`}
              label={t("sg4")}
              control={
                live.lateSupported
                  ? { enabled: true, reason: null }
                  : { enabled: false, reason: copy0.en["e.38"] }
              }
              onPress={() => live.actions.deliverLate()}
            />
            <button type="button" className="ghost" onClick={() => live.actions.switchContext()}>
              {t("s1nz")}</button>
            <ConnectivityWriteButton type="button" className="ghost" onClick={() => live.actions.newSession()}>
              {t("sto")}</ConnectivityWriteButton>
          </div>
          {live.environment === "stub" ? (
            <label className="refund-scenario">
              {t("s1p5")}<select
                value={live.scenario}
                onChange={(event) => live.actions.setScenario(event.target.value as RefundScenario)}
              >
                {deskText(t, REFUND_SCENARIOS.map((name) => (
                  <option key={name} value={name}>
                    {deskText(t, name)}
                  </option>
                )))}
              </select>
              <span className="muted">{deskText(t, REFUND_SCENARIO_NOTES[live.scenario])}</span>
            </label>
          ) : null}
        </div>
      )}

      <h4>{t("s1js")}</h4>
      <p className="muted">{deskText(t, model.session.contextLine)}</p>
      <p className="muted">{deskText(t, model.session.countersLine)}</p>
      <p className="muted">{deskText(t, model.freshnessWord)} {deskText(t, model.versionLine)}</p>
      <ul className="refund-session">
        {deskText(t, model.session.intents.map((intent) => (
          <li key={intent.seq} data-outcome={intent.outcome}>
            {deskText(t, intent.stepWord)} · {deskText(t, intent.intentRef)} · {deskText(t, intent.outcome)}
            {intent.code ? (" " + t("sd2", { code: intent.code })) : ""} {deskText(t, intent.lateLine)}
          </li>
        )))}
        {deskText(t, model.session.quarantineLines.map((line) => (
          <li key={line} data-outcome="QUARANTINED">
            {deskText(t, line)}
          </li>
        )))}
      </ul>

      <h4>{t("desk.buyer.recorded")}</h4>
      <ul className="refund-not-sent">
        {deskText(t, model.notComposed.map((entry) => (
          <li key={entry.action} data-action={entry.action}>
            <p>{deskText(t, entry.action)}</p>
            <p className="muted">{deskText(t, entry.reason)}</p>
          </li>
        )))}
      </ul>
    </section>
  );
}
