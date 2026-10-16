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
 * The journey context desk. Every row is a synthetic observation judged against
 * the current context key; nothing here is a producer receipt or a proof of
 * payment, issuance, or admission.
 */
export function JourneyIdentityPanel({ live }: { live: IdentityDeskLive }) {
  const { model, actions } = live;
  const [pendingScenario, setPendingScenario] = useState<JourneyIdentityScenario>(live.scenario);
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? `identity:${model.lastSeq}` : null, "identity-status");
  return (
    <section aria-label={IDENTITY_TITLE} data-identity-state={model.state} data-adapter-environment={live.environment} data-source={live.environment === "stub" ? "synthetic-identity" : "none"}>
      <h2>{IDENTITY_TITLE}</h2>
      <p className="muted">{IDENTITY_SOURCE_LINE}</p>
      <p className="muted">{IDENTITY_BOUNDARY}</p>
      <p className="muted">{IDENTITY_RULE_NOTE}</p>
      <p className="muted">{IDENTITY_SESSION_NOTE}</p>

      <div role="status" id="identity-status" tabIndex={-1} aria-live="polite" data-testid="identity-status">
        <p data-field="status">{model.statusLine}</p>
        {model.detailLine ? <p className="muted">{model.detailLine}</p> : null}
        {model.lastLine ? <p data-field="last">{model.lastLine}</p> : null}
        <p className="muted">{model.freshnessWord}</p>
        <p className="muted">{model.countersLine}</p>
        {model.actionLabel ? (
          <button
            type="button"
            onClick={() => {
              if (model.actionLabel === "Reset synthetic source") {
                actions.resetSource();
              } else {
                actions.refresh();
              }
            }}
          >
            {model.actionLabel}
          </button>
        ) : null}
      </div>

      <h3>Current context</h3>
      <table aria-label="Current context key fields">
        <tbody>
          {model.contextRows.map((row) => (
            <tr key={row.field} data-context-field={row.field}>
              <th scope="row">{row.field}</th>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Observations and receipts</h3>
      {model.items.length === 0 ? (
        <p className="muted">No adjudicated rows in this read.</p>
      ) : (
        <div className="identity-scroll" role="region" aria-label="Adjudicated observations, scrollable" tabIndex={0}>
        <table aria-label="Adjudicated observations">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Kind</th>
              <th scope="col">Subject</th>
              <th scope="col">Issued under</th>
              <th scope="col">Verdict</th>
              <th scope="col">Attach</th>
            </tr>
          </thead>
          <tbody>
            {model.items.map((row) => (
              <tr key={row.itemId} data-item={row.itemId} data-verdict={row.verdict} data-kind={row.kind}>
                <td>{row.itemId}</td>
                <td>{row.kind}</td>
                <td>{row.subjectRef}</td>
                <td>{row.issuedLine}</td>
                <td>
                  {row.verdict}
                  <span className="muted"> — {row.detail}</span>
                </td>
                <td>
                  <GuardedButton id={`attach-${row.itemId}`} label="Attach" control={row.attach} onPress={() => actions.attach(row.itemId)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      <h3>Session journal</h3>
      {model.intents.length === 0 && model.quarantineLines.length === 0 && model.isolatedLines.length === 0 ? (
        <p className="muted">No writes or quarantined results yet.</p>
      ) : (
        <ul>
          {model.intents.map((intent) => (
            <li key={intent.seq} data-outcome={intent.outcome} data-scope={intent.scope}>
              {intent.intentRef} on {intent.scope}: {intent.outcome}
              {intent.code ? ` (${intent.code})` : ""}
              {intent.lateLine ? ` ${intent.lateLine}` : ""}
            </li>
          ))}
          {model.quarantineLines.map((line) => (
            <li key={line} data-outcome="QUARANTINED">
              {line}
            </li>
          ))}
          {model.isolatedLines.map((line) => (
            <li key={line} data-outcome="ISOLATED">
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
          <select
            aria-label="Scenario"
            value={pendingScenario}
            onChange={(event) => setPendingScenario(event.target.value as JourneyIdentityScenario)}
          >
            {IDENTITY_SCENARIOS.map((scenario) => (
              <option key={scenario} value={scenario}>
                {scenario}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={pendingScenario === live.scenario} onClick={() => actions.setScenario(pendingScenario)}>
          Apply this scenario
        </button>
        <p className="muted">{IDENTITY_SCENARIO_NOTES[pendingScenario]}</p>
        <p className="muted">Applying a scenario binds this page to a new synthetic source. Earlier unknown writes stay on record and keep fencing their subject, and intent numbers keep counting. Only a reload clears them.</p>
        <button type="button" onClick={() => actions.refresh()}>
          Read again
        </button>
        <button type="button" onClick={() => actions.switchActor()}>
          Switch actor
        </button>
        <button type="button" onClick={() => actions.switchRole()}>
          Switch role
        </button>
        <button type="button" onClick={() => actions.rotateCut()}>
          Rotate source cut
        </button>
        <button type="button" onClick={() => actions.resetSource()}>
          Reset synthetic source
        </button>
        {live.heldSupported ? (
          <button type="button" onClick={() => actions.deliverHeld()}>
            Deliver held response
          </button>
        ) : null}
        {live.lateSupported ? (
          <button type="button" onClick={() => actions.deliverLate()}>
            Deliver late result
          </button>
        ) : null}
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
