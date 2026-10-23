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
import { REFUND_SCENARIOS, type RefundScenario, type RefundStep } from "@kix/protocol-adapter";

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
        {label}
      </ConnectivityWriteButton>
      {control.reason ? (
        <span id={reasonId} className="muted">
          {control.reason}
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
  const model = live.model;
  const readOnly = variant === "buyer";
  const baseId = `refund-${variant}`;
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? `${baseId}:${model.lastSeq}` : null, `${baseId}-status`);

  return (
    <section
      id={baseId}
      className="refund-desk panel"
      aria-label={REFUND_TITLE}
      data-refund-variant={variant}
      data-refund-state={model.state}
      data-adapter-environment={live.environment}
      data-source={live.environment === "stub" ? "synthetic-refund" : "none"}
    >
      <header className="section-head">
        <p className="eyebrow">{REFUND_TITLE}</p>
        <h3>{REFUND_TITLE}</h3>
        <p className="muted">{REFUND_SOURCE_LINE}</p>
        <p className="muted">{REFUND_BOUNDARY}</p>
        <p className="muted">{REFUND_RETURN_NOTE}</p>
        <p className="muted">{REFUND_NOTSENT_NOTE}</p>
        <AmountNotice />
      </header>

      <p id={`${baseId}-status`} className={model.state === "ready" ? "muted" : "alert"} role="status" tabIndex={-1}>
        {model.statusLine} {model.detailLine}
      </p>
      {model.lastLine ? <p className="muted">{model.lastLine}</p> : null}
      {model.actionLabel ? (
        <button
          type="button"
          className="ghost"
          onClick={() =>
            model.state === "tuple-changed" || model.state === "refused" ? live.actions.newSession() : live.actions.refresh()
          }
        >
          {model.actionLabel}
        </button>
      ) : null}

      <h4>Five separate order states</h4>
      <ol className="refund-states">
        {model.cells.map((cell) => (
          <li key={cell.cell} className="refund-cell" data-track={cell.track} data-state={cell.state}>
            <p className="eyebrow">{cell.track}</p>
            <p>
              <strong>{cell.label}</strong> — {cell.state}
            </p>
            <p className="muted">{cell.ref ?? "no ref"}</p>
            <p className="muted">{cell.note}</p>
          </li>
        ))}
      </ol>

      <h4>Five separate refund-flow lines</h4>
      <ul className="refund-lines">
        {model.lines.map((line) => (
          <li key={line.line} className="refund-line" data-line={line.line} data-state={line.observedState} data-write={line.writeKind}>
            <p>
              <strong>{line.label}</strong> — {line.observedState === "recorded" ? `recorded ${line.observedRef}` : "none"}
            </p>
            <p className="muted">{line.writeWord}</p>
            <p className="muted">{line.note}</p>
            <p className="muted">
              {line.pinnedAction === null
                ? "No pinned booking-cancel command exists. This line sends nothing."
                : `${line.pinnedAction} is recorded and not sent.`}
            </p>
            {readOnly ? null : (
              <GuardedButton
                id={`${baseId}-${line.line}`}
                label={`Record ${line.label.toLowerCase()}`}
                control={line.control}
                onPress={() => live.actions.write(LINE_STEPS[line.line])}
              />
            )}
          </li>
        ))}
      </ul>

      {readOnly ? null : (
        <div className="refund-controls">
          <h4>Synthetic controls</h4>
          <p className="muted">{REFUND_SESSION_NOTE}</p>
          <p className="muted">{REFUND_FENCE_NOTE}</p>
          <p className="muted">{REFUND_READ_NOTE}</p>
          <div className="row-actions">
            <button type="button" className="ghost" onClick={() => live.actions.refresh()}>
              Read again
            </button>
            <ConnectivityWriteButton type="button" className="ghost" onClick={() => live.actions.markReturnRequired()}>
              Mark a return required
            </ConnectivityWriteButton>
            <GuardedButton
              id={`${baseId}-held`}
              label="Deliver held response"
              control={
                live.heldSupported
                  ? { enabled: true, reason: null }
                  : { enabled: false, reason: "Only the held-response scenario holds answers." }
              }
              onPress={() => live.actions.deliverHeld()}
            />
            <GuardedButton
              id={`${baseId}-late`}
              label="Deliver late result"
              control={
                live.lateSupported
                  ? { enabled: true, reason: null }
                  : { enabled: false, reason: "Only a lost scenario holds a late result." }
              }
              onPress={() => live.actions.deliverLate()}
            />
            <button type="button" className="ghost" onClick={() => live.actions.switchContext()}>
              Switch session context
            </button>
            <ConnectivityWriteButton type="button" className="ghost" onClick={() => live.actions.newSession()}>
              New synthetic session
            </ConnectivityWriteButton>
          </div>
          {live.environment === "stub" ? (
            <label className="refund-scenario">
              Synthetic scenario
              <select
                value={live.scenario}
                onChange={(event) => live.actions.setScenario(event.target.value as RefundScenario)}
              >
                {REFUND_SCENARIOS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <span className="muted">{REFUND_SCENARIO_NOTES[live.scenario]}</span>
            </label>
          ) : null}
        </div>
      )}

      <h4>Session record</h4>
      <p className="muted">{model.session.contextLine}</p>
      <p className="muted">{model.session.countersLine}</p>
      <p className="muted">{model.freshnessWord} {model.versionLine}</p>
      <ul className="refund-session">
        {model.session.intents.map((intent) => (
          <li key={intent.seq} data-outcome={intent.outcome}>
            {intent.stepWord} · {intent.intentRef} · {intent.outcome}
            {intent.code ? ` (${intent.code})` : ""} {intent.lateLine}
          </li>
        ))}
        {model.session.quarantineLines.map((line) => (
          <li key={line} data-outcome="QUARANTINED">
            {line}
          </li>
        ))}
      </ul>

      <h4>Recorded and not sent</h4>
      <ul className="refund-not-sent">
        {model.notComposed.map((entry) => (
          <li key={entry.action} data-action={entry.action}>
            <p>{entry.action}</p>
            <p className="muted">{entry.reason}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
