import { messages as copy0 } from "../i18n/messages/pages--CrossSurfaceJourneysPanels";
import { messages as copy1 } from "../i18n/messages/cross-surface-journeys";
import { messages as copy2 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
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
  const t = useT(copy0, copy1, copy2);
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
        {deskText(t, label)}
      </button>
      {control.reason ? (
        <span id={reasonId} className="muted">
          {deskText(t, control.reason)}
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
  const t = useT(copy0, copy1, copy2);
  return (
    <label htmlFor={id}>
      {deskText(t, label)}
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{deskText(t, anyLabel)}</option>
        {deskText(t, options.map((item) => (
          <option key={item.value} value={item.value}>
            {deskText(t, item.label)}
          </option>
        )))}
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
  const t = useT(copy0, copy1, copy2);
  const stub = environment === "stub";
  return (
    <header className="section-head discovery-section" data-adapter-environment={environment} data-scenario={scenario}>
      <h2>{deskText(t, XS_TITLE)}</h2>
      {stub ? (
        <p>
          <Synthetic /> {deskText(t, XS_SOURCE_LINE)}
        </p>
      ) : (
        <p>{t("s22z")}</p>
      )}
      <p className="muted">{deskText(t, XS_BOUNDARY)}</p>
      {stub ? <p className="muted">{deskText(t, XS_SCENARIO_NOTES[scenario])}</p> : null}
      <p className="muted">{deskText(t, XS_PENDING_NOTE)}</p>
      <p className="muted">{deskText(t, WORKSPACE_RULING)}</p>
      <p className="muted">{deskText(t, model.contextLine)}</p>
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
  const t = useT(copy0, copy1, copy2);
  const [draftScenario, setDraftScenario] = useState<CrossSurfaceScenario>(scenario);
  const [journey, setJourney] = useState<string>(filter.journey ?? "");
  const [branch, setBranch] = useState<string>(filter.branch ?? "");
  const [status, setStatus] = useState<string>(filter.status ?? "");
  const heldControl: XsControl = model.heldSupported
    ? { enabled: true, reason: null }
    : { enabled: false, reason: copy0.en["e.18"] };
  return (
    <section id="xs-controls" className="discovery-section" aria-labelledby="xs-controls-head">
      <h3 id="xs-controls-head">{t("sed")}</h3>
      <p className="muted">{deskText(t, XS_READ_NOTE)}</p>
      <p className="muted">{t("swb")}</p>
      <div className="discovery-controls" role="group" aria-label={t("s1pb")}>
        <GuardedButton id="xs-read" label={t("s1cw")} control={model.readControl} onPress={() => actions.read()} />
        <GuardedButton id="xs-deliver-held" label={t("sg1")} control={heldControl} onPress={() => actions.deliverHeld()} />
        <button type="button" id="xs-switch-context" className="discovery-action" onClick={() => actions.switchContext()}>
          {t("s1o5")}</button>
      </div>
      <div className="discovery-controls" role="group" aria-label={t("s1p5")}>
        <label htmlFor="xs-scenario">
          {t("s1p5")}<select id="xs-scenario" value={draftScenario} onChange={(event) => setDraftScenario(event.target.value as CrossSurfaceScenario)}>
            {deskText(t, CROSS_SURFACE_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {deskText(t, item)}
              </option>
            )))}
          </select>
        </label>
        <GuardedButton id="xs-apply-scenario" label={t("s5o")} control={model.scenarioControl} onPress={() => actions.applyScenario(draftScenario)} />
      </div>
      <div className="discovery-controls" role="group" aria-label={t("sl5")}>
        <Select id="xs-filter-journey" label={t("spe")} value={journey} options={XS_JOURNEY_OPTIONS} anyLabel="Any journey" onChange={setJourney} />
        <Select id="xs-filter-branch" label={t("saj")} value={branch} options={XS_BRANCH_OPTIONS} anyLabel="Any branch" onChange={setBranch} />
        <Select id="xs-filter-status" label={t("s1mj")} value={status} options={XS_STATUS_OPTIONS} anyLabel="Any status" onChange={setStatus} />
        <button type="button" id="xs-apply-filter" className="discovery-action" onClick={() => actions.applyFilter({ journey, branch, status })}>
          {t("s5m")}</button>
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
          {t("scp")}</button>
      </div>
    </section>
  );
}

export function CrossSurfaceStatus({ model }: { model: XsModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="xs-status" className="discovery-section" aria-labelledby="xs-status-head" tabIndex={-1}>
      <h3 id="xs-status-head">{t("s1mj")}</h3>
      <p role="status" data-screen-state={model.state}>
        <StatusMark kind={model.state === "ready" ? "selected" : model.state === "in-progress" ? "loading" : "blocked"} /> {deskText(t, model.statusLine)}
      </p>
      {model.detailLine ? <p className="muted">{deskText(t, model.detailLine)}</p> : null}
      {model.lastLine ? (
        <p role="status" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {deskText(t, model.lastLine)}
        </p>
      ) : null}
      {model.summaryLine ? <p className="muted">{deskText(t, model.summaryLine)}</p> : null}
    </section>
  );
}

function RowView({ row }: { row: XsRowModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <tr data-row={row.id} data-status={row.status} data-compensation={row.compensationState}>
      <th scope="row">
        {deskText(t, row.journey)}
        <br />
        <span className="muted">{deskText(t, row.branch)}</span>
      </th>
      <td>
        <span className="status-word">{deskText(t, row.statusWord)}</span>
        <br />
        <span className="muted">{deskText(t, row.basis)}</span>
      </td>
      <td>{deskText(t, row.lastConfirmed)}</td>
      <td>{deskText(t, row.unconfirmed)}</td>
      <td>
        {row.blockedLines.length === 0 ? (
          t("common.empty")
        ) : (
          <ul className="discovery-list" aria-label={t("sa8", { id: row.id })}>
            {deskText(t, row.blockedLines.map((line) => (
              <li key={line}>{deskText(t, line)}</li>
            )))}
          </ul>
        )}
      </td>
      <td>
        <strong>{deskText(t, row.compensationState)}</strong>
        <br />
        <span className="muted">{deskText(t, row.compensationNote)}</span>
      </td>
      <td>
        <details>
          <summary>{t("sqp")}</summary>
          <p className="muted">{deskText(t, row.sourceLine)}</p>
          {row.reuseLine ? <p className="muted">{deskText(t, row.reuseLine)}</p> : null}
          <p className="muted">{deskText(t, row.note)}</p>
          {row.legLines.length === 0 ? (
            <p className="muted">{t("svw")}</p>
          ) : (
            <ul className="discovery-list" aria-label={t("sqq", { id: row.id })}>
              {deskText(t, row.legLines.map((line, index) => (
                <li key={`${row.id}-${index}`}>{deskText(t, line)}</li>
              )))}
            </ul>
          )}
        </details>
      </td>
    </tr>
  );
}

export function CrossSurfaceTableSection({ model }: { model: XsModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="xs-table" className="discovery-section" aria-labelledby="xs-table-head">
      <h3 id="xs-table-head">{t("spm")}</h3>
      <p className="muted">{deskText(t, XS_COMPENSATION_NOTE)}</p>
      <p className="muted">
        {t("s1k9")}{" "}{deskText(t, model.rowCount)} {t("s13t")}{" "}{deskText(t, model.totalRows)} {t("s1hs")}</p>
      {model.rows.length === 0 ? (
        <p className="muted" data-empty={model.emptyReason ?? "none"}>
          {model.state === "ready" || model.state === "empty" ? t("sy7") : t("sz4")}
        </p>
      ) : (
        <div className="xs-scroll" role="region" aria-label={t("spq")} tabIndex={0}>
          <table className="discovery-table" aria-label={t("sf4")}>
            <thead>
              <tr>
                <th scope="col">{t("spf")}</th>
                <th scope="col">{t("s1mj")}</th>
                <th scope="col">{t("sq9")}</th>
                <th scope="col">{t("s251")}</th>
                <th scope="col">{t("sa7")}</th>
                <th scope="col">{t("sdd")}</th>
                <th scope="col">{t("sqo")}</th>
              </tr>
            </thead>
            <tbody>
              {deskText(t, model.rows.map((row) => (
                <RowView key={row.id} row={row} />
              )))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function CrossSurfaceNotComposed({ model }: { model: XsModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="xs-not-composed" className="discovery-section" aria-labelledby="xs-not-composed-head">
      <h3 id="xs-not-composed-head">{t("s1ds")}</h3>
      <p className="muted">{deskText(t, XS_NOT_COMPOSED_NOTE)}</p>
      <ul className="discovery-list" aria-label={t("sz")}>
        {deskText(t, model.notComposedLines.map((line) => (
          <li key={line}>{deskText(t, line)}</li>
        )))}
      </ul>
      <p className="muted">{deskText(t, model.holdLine)}</p>
      <p className="muted">{deskText(t, XS_UNDETERMINED_NOTE)}</p>
      <p className="muted">{t("sw7")}{" "}{deskText(t, model.nonClaimsLine)}.</p>
    </section>
  );
}

export function CrossSurfaceSession({ model }: { model: XsModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="xs-session" className="discovery-section" aria-labelledby="xs-session-head">
      <h3 id="xs-session-head">{t("s1js")}</h3>
      <p className="muted">{deskText(t, model.countersLine)}</p>
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
  const t = useT(copy0, copy1, copy2);
  const model = live.model;
  // A dropped, refused, or unavailable read takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "xs-status");
  return (
    <div className="discovery cross-surface" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label={t("sf5")}>
        <a href="#xs-controls">{t("sed")}</a>
        <a href="#xs-status">{t("s1mj")}</a>
        <a href="#xs-table">{t("route.journeys")}</a>
        <a href="#xs-not-composed">{t("stm")}</a>
        <a href="#xs-session">{t("s1js")}</a>
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
