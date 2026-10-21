import { AsyncState } from "../components/AsyncState";
import { useState } from "react";
import { useRestoreFocus } from "../a11y/focus";
import { CROSS_SURFACE_SCENARIOS, type CrossSurfaceFilter, type CrossSurfaceScenario } from "@kix/protocol-adapter";
import { StatusMark } from "../a11y/marks";
import {
  XS_BOUNDARY,
  XS_BRANCH_OPTIONS,
  XS_COMPENSATION_NOTE,
  XS_JOURNEY_OPTIONS,
  XS_NOT_COMPOSED_NOTE,
  XS_PENDING_NOTE,
  XS_READ_NOTE,
  XS_SCENARIO_NOTES,
  XS_SOURCE_LINE,
  XS_STATUS_OPTIONS,
  XS_TITLE,
  XS_UNDETERMINED_NOTE,
  type XsActions,
  type XsControl,
  type XsModel,
  type XsOption,
  type XsRowModel,
} from "../cross-surface-journeys";
import { WORKSPACE_RULING } from "../workspace/registry";

function Synthetic() {
  return (
    <span className="discovery-badge" data-provenance="synthetic">
      SYNTHETIC
    </span>
  );
}

/**
 * A control that is off stays focusable and says why. A native disabled button is
 * skipped by the keyboard, so its reason would never be reached.
 */
function GuardedButton({ id, label, control, onPress }: { id: string; label: string; control: XsControl; onPress: () => void }) {
  const reasonId = `${id}-reason`;
  return (
    <span className="refund-guard">
      <button
        id={id}
        type="button"
        className="discovery-action"
        aria-disabled={control.enabled ? undefined : true}
        aria-describedby={control.reason ? reasonId : undefined}
        data-enabled={control.enabled ? "true" : "false"}
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

function Select({
  id,
  label,
  value,
  options,
  anyLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly XsOption[];
  anyLabel: string;
  onChange: (next: string) => void;
}) {
  return (
    <label htmlFor={id}>
      {label}
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{anyLabel}</option>
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CrossSurfaceBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: CrossSurfaceScenario;
  model: XsModel;
}) {
  const stub = environment === "stub";
  return (
    <header className="section-head discovery-section" data-adapter-environment={environment} data-scenario={scenario}>
      <h2>{XS_TITLE}</h2>
      {stub ? (
        <p>
          <Synthetic /> {XS_SOURCE_LINE}
        </p>
      ) : (
        <p>This environment is integration-http. The table is not bound here, no source is read, and no request is made.</p>
      )}
      <p className="muted">{XS_BOUNDARY}</p>
      {stub ? <p className="muted">{XS_SCENARIO_NOTES[scenario]}</p> : null}
      <p className="muted">{XS_PENDING_NOTE}</p>
      <p className="muted">{WORKSPACE_RULING}</p>
      <p className="muted">{model.contextLine}</p>
    </header>
  );
}

export function CrossSurfaceControls({
  scenario,
  filter,
  model,
  actions,
}: {
  scenario: CrossSurfaceScenario;
  filter: CrossSurfaceFilter;
  model: XsModel;
  actions: XsActions;
}) {
  const [draftScenario, setDraftScenario] = useState<CrossSurfaceScenario>(scenario);
  const [journey, setJourney] = useState<string>(filter.journey ?? "");
  const [branch, setBranch] = useState<string>(filter.branch ?? "");
  const [status, setStatus] = useState<string>(filter.status ?? "");
  const heldControl: XsControl = model.heldSupported
    ? { enabled: true, reason: null }
    : { enabled: false, reason: "Held answers exist only in the held scenario. A real source offers no such control." };
  return (
    <section id="xs-controls" className="discovery-section" aria-labelledby="xs-controls-head">
      <h3 id="xs-controls-head">Controls</h3>
      <p className="muted">{XS_READ_NOTE}</p>
      <p className="muted">None of these controls sends a command. The filter works on the rows already held and does not read again.</p>
      <div className="discovery-controls" role="group" aria-label="Table read">
        <GuardedButton id="xs-read" label="Read the table" control={model.readControl} onPress={() => actions.read()} />
        <GuardedButton id="xs-deliver-held" label="Deliver held answers" control={heldControl} onPress={() => actions.deliverHeld()} />
        <button type="button" id="xs-switch-context" className="discovery-action" onClick={() => actions.switchContext()}>
          Switch the context
        </button>
      </div>
      <div className="discovery-controls" role="group" aria-label="Synthetic scenario">
        <label htmlFor="xs-scenario">
          Synthetic scenario
          <select id="xs-scenario" value={draftScenario} onChange={(event) => setDraftScenario(event.target.value as CrossSurfaceScenario)}>
            {CROSS_SURFACE_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <GuardedButton id="xs-apply-scenario" label="Apply scenario" control={model.scenarioControl} onPress={() => actions.applyScenario(draftScenario)} />
      </div>
      <div className="discovery-controls" role="group" aria-label="Filter">
        <Select id="xs-filter-journey" label="Journey" value={journey} options={XS_JOURNEY_OPTIONS} anyLabel="Any journey" onChange={setJourney} />
        <Select id="xs-filter-branch" label="Branch" value={branch} options={XS_BRANCH_OPTIONS} anyLabel="Any branch" onChange={setBranch} />
        <Select id="xs-filter-status" label="Status" value={status} options={XS_STATUS_OPTIONS} anyLabel="Any status" onChange={setStatus} />
        <button type="button" id="xs-apply-filter" className="discovery-action" onClick={() => actions.applyFilter({ journey, branch, status })}>
          Apply filter
        </button>
        <button
          type="button"
          id="xs-clear-filter"
          className="discovery-action"
          onClick={() => {
            setJourney("");
            setBranch("");
            setStatus("");
            actions.clearFilter();
          }}
        >
          Clear filter
        </button>
      </div>
    </section>
  );
}

export function CrossSurfaceStatus({ model }: { model: XsModel }) {
  return (
    <section id="xs-status" className="discovery-section" aria-labelledby="xs-status-head" tabIndex={-1}>
      <h3 id="xs-status-head">Status</h3>
      {model.state === "in-progress" || model.state === "empty" || model.state === "not-bound" ? (
        <AsyncState kind={model.state === "in-progress" ? "loading" : model.state} label="Journeys" data-screen-state={model.state}><p>{model.statusLine}</p></AsyncState>
      ) : <p role="status" data-screen-state={model.state}><StatusMark kind={model.state === "ready" ? "selected" : "blocked"} /> {model.statusLine}</p>}
      {model.detailLine ? <p className="muted">{model.detailLine}</p> : null}
      {model.lastLine ? (
        <p role="status" aria-live="polite" aria-busy={false} data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastLine}
        </p>
      ) : null}
      {model.summaryLine ? <p className="muted">{model.summaryLine}</p> : null}
    </section>
  );
}

function RowView({ row }: { row: XsRowModel }) {
  return (
    <tr data-row={row.id} data-status={row.status} data-compensation={row.compensationState}>
      <th scope="row">
        {row.journey}
        <br />
        <span className="muted">{row.branch}</span>
      </th>
      <td>
        {row.status === "unknown" ? <AsyncState kind="unknown" label="Journey" announcement="parent" /> : null}
        <span className="status-word">{row.statusWord}</span>
        <br />
        <span className="muted">{row.basis}</span>
      </td>
      <td>{row.lastConfirmed}</td>
      <td>{row.unconfirmed}</td>
      <td>
        {row.blockedLines.length === 0 ? (
          "none"
        ) : (
          <ul className="discovery-list" aria-label={`Blocked next actions of ${row.id}`}>
            {row.blockedLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </td>
      <td>
        <strong>{row.compensationState}</strong>
        <br />
        <span className="muted">{row.compensationNote}</span>
      </td>
      <td>
        <details>
          <summary>Legs and source</summary>
          <p className="muted">{row.sourceLine}</p>
          {row.reuseLine ? <p className="muted">{row.reuseLine}</p> : null}
          <p className="muted">{row.note}</p>
          {row.legLines.length === 0 ? (
            <p className="muted">No leg was run here.</p>
          ) : (
            <ul className="discovery-list" aria-label={`Legs of ${row.id}`}>
              {row.legLines.map((line, index) => (
                <li key={`${row.id}-${index}`}>{line}</li>
              ))}
            </ul>
          )}
        </details>
      </td>
    </tr>
  );
}

export function CrossSurfaceTableSection({ model }: { model: XsModel }) {
  return (
    <section id="xs-table" className="discovery-section" aria-labelledby="xs-table-head">
      <h3 id="xs-table-head">Journeys and branches</h3>
      <p className="muted">{XS_COMPENSATION_NOTE}</p>
      <p className="muted">
        Showing {model.rowCount} of {model.totalRows} rows.
      </p>
      {model.rows.length === 0 ? (
        <p className="muted" data-empty={model.emptyReason ?? "none"}>
          {model.state === "ready" || model.state === "empty" ? "No row to show." : "No table is held, so there is no row to show."}
        </p>
      ) : (
        <div className="xs-scroll" role="region" aria-label="Journey table" tabIndex={0}>
          <table className="discovery-table" aria-label="Cross-surface journeys">
            <thead>
              <tr>
                <th scope="col">Journey and branch</th>
                <th scope="col">Status</th>
                <th scope="col">Last confirmed step</th>
                <th scope="col">Unconfirmed request</th>
                <th scope="col">Blocked next action</th>
                <th scope="col">Compensation path</th>
                <th scope="col">Legs</th>
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row) => (
                <RowView key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function CrossSurfaceNotComposed({ model }: { model: XsModel }) {
  return (
    <section id="xs-not-composed" className="discovery-section" aria-labelledby="xs-not-composed-head">
      <h3 id="xs-not-composed-head">Recorded and never composed</h3>
      <p className="muted">{XS_NOT_COMPOSED_NOTE}</p>
      <ul className="discovery-list" aria-label="Actions never composed">
        {model.notComposedLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="muted">{model.holdLine}</p>
      <p className="muted">{XS_UNDETERMINED_NOTE}</p>
      <p className="muted">Non-claims, each a literal false: {model.nonClaimsLine}.</p>
    </section>
  );
}

export function CrossSurfaceSession({ model }: { model: XsModel }) {
  return (
    <section id="xs-session" className="discovery-section" aria-labelledby="xs-session-head">
      <h3 id="xs-session-head">Session record</h3>
      <p className="muted">{model.countersLine}</p>
    </section>
  );
}

export interface CrossSurfaceLive {
  environment: "stub" | "integration-http";
  scenario: CrossSurfaceScenario;
  filter: CrossSurfaceFilter;
  model: XsModel;
  actions: XsActions;
}

/** The whole screen. It reads what the model holds and sends no command. */
export function CrossSurfacePanel({ live }: { live: CrossSurfaceLive }) {
  const model = live.model;
  // A dropped, refused, or unavailable read takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "xs-status");
  return (
    <div className="discovery cross-surface" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label="Cross-surface journey sections">
        <a href="#xs-controls">Controls</a>
        <a href="#xs-status">Status</a>
        <a href="#xs-table">Journeys</a>
        <a href="#xs-not-composed">Never composed</a>
        <a href="#xs-session">Session record</a>
      </nav>
      <div className="discovery-body">
        <CrossSurfaceBanner environment={live.environment} scenario={live.scenario} model={model} />
        <CrossSurfaceControls scenario={live.scenario} filter={live.filter} model={model} actions={live.actions} />
        <CrossSurfaceStatus model={model} />
        <CrossSurfaceTableSection model={model} />
        <CrossSurfaceNotComposed model={model} />
        <CrossSurfaceSession model={model} />
      </div>
    </div>
  );
}
