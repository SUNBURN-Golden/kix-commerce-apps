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
  const reasonId = `${id}-reason`;
  return (
    <span className="refund-guard">
      <button
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
      </button>
      {control.reason ? (
        <span id={reasonId} className="muted">
          {control.reason}
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
  const { model, actions } = live;
  const [pendingScenario, setPendingScenario] = useState<SessionScenario>(live.scenario);
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? `session:${model.lastSeq}` : null, "session-status");
  const bound = live.environment === "stub";
  return (
    <section aria-label={SESSION_TITLE} data-session-state={model.state} data-adapter-environment={live.environment} data-source={bound ? "synthetic-session" : "none"}>
      <h2>{SESSION_TITLE}</h2>
      <p className="muted">{SESSION_SOURCE_LINE}</p>
      <p className="muted">{SESSION_BOUNDARY}</p>
      <p className="muted">{SESSION_RECOVERY_RULE}</p>
      <p data-field="standing-notice" role="note">
        {SESSION_STANDING_NOTICE}
      </p>
      <p className="muted">{SESSION_RETENTION_NOTE}</p>

      <div role="status" id="session-status" tabIndex={-1} aria-live="polite" aria-busy={model.state === "in-progress"} data-testid="session-status">
        {model.state === "in-progress" || model.state === "empty" || model.state === "recovered" || model.state === "not-bound" ? (
          <AsyncState kind={model.state === "in-progress" ? "loading" : model.state === "recovered" ? "unknown" : model.state} label="Session" announcement="parent" />
        ) : null}
        <p data-field="status">{model.statusLine}</p>
        {model.detailLine ? <p className="muted">{model.detailLine}</p> : null}
        {model.lastLine ? <p data-field="last">{model.lastLine}</p> : null}
        <p className="muted">{model.loadLine}</p>
        <p className="muted">{model.countersLine}</p>
        <p className="muted">{model.budgetLine}</p>
      </div>

      <h3>Subjects</h3>
      {model.items.length === 0 ? (
        <p className="muted">No subject to attach in this read.</p>
      ) : (
        <div className="identity-scroll" role="region" aria-label="Subjects, scrollable" tabIndex={0}>
          <table aria-label="Subjects">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Subject</th>
                <th scope="col">Verdict</th>
                <th scope="col">Attach</th>
              </tr>
            </thead>
            <tbody>
              {model.items.map((row) => (
                <tr key={row.itemId} data-item={row.itemId} data-verdict={row.verdict}>
                  <td>{row.itemId}</td>
                  <td>{row.subjectRef}</td>
                  <td>{row.verdict}</td>
                  <td>
                    <GuardedButton id={`session-attach-${row.itemId}`} label="Attach" control={row.attach} onPress={() => actions.attach(row.itemId)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Session journal</h3>
      {model.records.length === 0 && model.observationLines.length === 0 ? (
        <p className="muted">No writes recorded in this tab session.</p>
      ) : (
        <ul>
          {model.records.map((row) => (
            <li key={row.seq} data-outcome={row.outcome} data-kind={row.kind} data-scope={row.scope} data-load={row.loadNo}>
              {row.kind === "unknown" || row.kind === "recovered-unknown" ? <AsyncState kind="unknown" label="Session record" announcement="parent"><p>{row.line}</p></AsyncState> : row.line}
            </li>
          ))}
          {model.observationLines.map((line) => (
            <li key={line} data-outcome="OBSERVED">
              {line}
            </li>
          ))}
        </ul>
      )}

      <h3>Synthetic controls</h3>
      <p className="muted">These stand in for events a real producer would cause. A real producer offers none of them.</p>
      <div role="group" aria-label="Synthetic controls">
        <label>
          Scenario{" "}
          <select aria-label="Scenario" value={pendingScenario} onChange={(event) => setPendingScenario(event.target.value as SessionScenario)}>
            {SESSION_SCENARIOS.map((scenario) => (
              <option key={scenario} value={scenario}>
                {scenario}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={pendingScenario === live.scenario} onClick={() => actions.setScenario(pendingScenario)}>
          Start new source with this scenario
        </button>
        <p className="muted">{SESSION_SCENARIO_NOTES[pendingScenario]}</p>
        <p className="muted">A new source keeps this tab&apos;s journal. An unknown write keeps blocking its subject.</p>
        <button type="button" onClick={() => actions.refresh()}>
          Read again
        </button>
        {live.heldSupported ? (
          <button type="button" onClick={() => actions.deliverHeld()}>
            Deliver held response
          </button>
        ) : null}
        <button type="button" onClick={() => actions.reloadPage()}>
          Reload this page
        </button>
        <p className="muted">Reloading keeps this tab&apos;s journal. It sends nothing.</p>
      </div>

      <h3>Recorded and never sent</h3>
      <ul>
        {model.notComposed.map((entry) => (
          <li key={entry.action} data-action={entry.action}>
            {entry.action}: {entry.reason}
          </li>
        ))}
      </ul>
    </section>
  );
}
