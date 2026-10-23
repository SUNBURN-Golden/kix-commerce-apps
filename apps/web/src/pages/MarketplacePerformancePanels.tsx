import { messages as copy0 } from "../i18n/messages/pages--MarketplacePerformancePanels";
import { messages as copy1 } from "../i18n/messages/marketplace-performance";
import { messages as copy2 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import {
  MARKETPLACE_DEVICE_PROFILES,
  MARKETPLACE_SCENARIOS,
  MARKETPLACE_SYNTHETIC_CONTROLS,
  MARKETPLACE_WORKLOADS,
  type MarketplaceDeviceClass,
  type MarketplaceScenario,
  type MarketplaceWorkload,
} from "@kix/protocol-adapter";
import { StatusMark } from "../a11y/marks";
import {
  MARKETPLACE_BENCH_ACTORS,
  MARKETPLACE_BENCH_BOUND_NOTE,
  MARKETPLACE_BENCH_BOUNDARY,
  MARKETPLACE_BENCH_DEVICE_NOTE,
  MARKETPLACE_BENCH_MEASURE_NOTE,
  MARKETPLACE_BENCH_MEMORY_NOTE,
  MARKETPLACE_BENCH_QUEUE_NOTE,
  MARKETPLACE_BENCH_READ_NOTE,
  MARKETPLACE_BENCH_SCENARIO_NOTES,
  MARKETPLACE_BENCH_SOURCE_LINE,
  MARKETPLACE_BENCH_SYNTHETIC_CONTROL_NOTE,
  MARKETPLACE_BENCH_TITLE,
  type MarketplaceBenchActions,
  type MarketplaceBenchModel,
} from "../marketplace-performance";
import { WORKSPACE_RULING } from "../workspace/registry";

function Synthetic() {
  return (
    <span className="discovery-badge" data-provenance="synthetic">
      SYNTHETIC
    </span>
  );
}

export function BenchBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: MarketplaceScenario;
  model: MarketplaceBenchModel;
}) {
  const t = useT(copy0, copy1, copy2);
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
    >
      <h2>{deskText(t, MARKETPLACE_BENCH_TITLE)}</h2>
      <p>
        <Synthetic /> {deskText(t, MARKETPLACE_BENCH_SOURCE_LINE)}
      </p>
      <p className="muted">{deskText(t, MARKETPLACE_BENCH_BOUNDARY)}</p>
      <p className="muted">{deskText(t, MARKETPLACE_BENCH_SCENARIO_NOTES[scenario])}</p>
      <p className="muted">{deskText(t, WORKSPACE_RULING)}</p>
      <p className="muted">{deskText(t, model.contextLine)}</p>
    </header>
  );
}

export function BenchControls({
  scenario,
  workload,
  actions,
}: {
  scenario: MarketplaceScenario;
  workload: MarketplaceWorkload;
  actions: MarketplaceBenchActions;
}) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mperf-controls" className="discovery-section" aria-labelledby="mperf-controls-head">
      <h3 id="mperf-controls-head">{t("sed")}</h3>
      <p className="muted">{deskText(t, MARKETPLACE_BENCH_READ_NOTE)}</p>
      <p className="muted">{deskText(t, MARKETPLACE_BENCH_SYNTHETIC_CONTROL_NOTE)}</p>
      <div className="discovery-controls">
        <label htmlFor="mperf-scenario">{t("s1p5")}</label>
        <select
          id="mperf-scenario"
          value={scenario}
          onChange={(event) => actions.setScenario(event.target.value as MarketplaceScenario)}
        >
          {deskText(t, MARKETPLACE_SCENARIOS.map((item) => (
            <option key={item} value={item}>
              {deskText(t, item)}
            </option>
          )))}
        </select>
        <label htmlFor="mperf-workload">{t("s26y")}</label>
        <select
          id="mperf-workload"
          value={workload}
          onChange={(event) => actions.setWorkload(event.target.value as MarketplaceWorkload)}
        >
          {deskText(t, MARKETPLACE_WORKLOADS.map((item) => (
            <option key={item} value={item}>
              {deskText(t, item)}
            </option>
          )))}
        </select>
        <label htmlFor="mperf-actor">{t("sgd")}</label>
        <select
          id="mperf-actor"
          defaultValue={MARKETPLACE_BENCH_ACTORS[0]}
          onChange={(event) => actions.switchActor(event.target.value)}
        >
          {deskText(t, MARKETPLACE_BENCH_ACTORS.map((actor) => (
            <option key={actor} value={actor}>
              {deskText(t, actor)}
            </option>
          )))}
        </select>
        <label htmlFor="mperf-device">{t("sgj")}</label>
        <select
          id="mperf-device"
          defaultValue={MARKETPLACE_DEVICE_PROFILES[0].deviceClass}
          onChange={(event) => actions.switchDevice(event.target.value as MarketplaceDeviceClass)}
        >
          {deskText(t, MARKETPLACE_DEVICE_PROFILES.map((profile) => (
            <option key={profile.deviceClass} value={profile.deviceClass}>
              {deskText(t, profile.deviceClass)}
            </option>
          )))}
        </select>
        <button type="button" id="mperf-second-tab" className="discovery-action" onClick={() => actions.openSecondTab()}>
          {t("s14x")}</button>
        <ConnectivityWriteButton type="button" id="mperf-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          {t("sto")}</ConnectivityWriteButton>
      </div>
      <div className="discovery-controls" aria-label={t("s1o9")}>
        {deskText(t, MARKETPLACE_SYNTHETIC_CONTROLS.map((control) => (
          <ConnectivityWriteButton
            key={control}
            type="button"
            id={`mperf-sim-${control}`}
            className="discovery-action"
            onClick={() => actions.synthetic(control)}
          >
            {t("s1kc")}{" "}{deskText(t, control)}
          </ConnectivityWriteButton>
        )))}
      </div>
    </section>
  );
}

export function BenchStatus({ model, actions }: { model: MarketplaceBenchModel; actions: MarketplaceBenchActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mperf-status" className="discovery-section" aria-labelledby="mperf-status-head" tabIndex={-1}>
      <h3 id="mperf-status-head">{t("s1mj")}</h3>
      <p role="status" data-read-state={model.state}>
        <StatusMark kind={model.state === "loading" ? "loading" : model.state === "ready" ? "selected" : "blocked"} />{" "}
        {deskText(t, model.statusLine)}
      </p>
      {model.detailLine ? <p className="muted">{deskText(t, model.detailLine)}</p> : null}
      <p className="muted">{deskText(t, model.freshnessWord)}</p>
      <p className="muted">{deskText(t, model.watermarkLine)}</p>
      <p className="muted">{deskText(t, model.inFlightLine)}</p>
      {model.lastLine ? <p className="muted">{deskText(t, model.lastLine)}</p> : null}
      <div className="discovery-controls">
        <button type="button" id="mperf-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          {t("s1ax")}</button>
        <button type="button" id="mperf-cancel" className="discovery-action" onClick={() => actions.cancel()}>
          {t("sb6")}</button>
      </div>
    </section>
  );
}

export function BenchQueue({ model, actions }: { model: MarketplaceBenchModel; actions: MarketplaceBenchActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mperf-queue" className="discovery-section" aria-labelledby="mperf-queue-head">
      <h3 id="mperf-queue-head">{t("s1ar")}</h3>
      <p className="muted">{deskText(t, MARKETPLACE_BENCH_QUEUE_NOTE)}</p>
      <p role="status" data-queue-phase={model.queue.phaseWord}>
        <span className="status-word">{deskText(t, model.queue.phaseWord)}.</span> {deskText(t, model.queue.stateWord)}. {deskText(t, model.queue.grantsLine)}
      </p>
      {model.queue.positionLine ? <p className="muted">{deskText(t, model.queue.positionLine)}</p> : null}
      {model.queue.admittedLine ? <p className="muted">{deskText(t, model.queue.admittedLine)}</p> : null}
      {model.queue.detailLine ? <p className="muted">{deskText(t, model.queue.detailLine)}</p> : null}
      <div className="discovery-controls">
        <ConnectivityWriteButton type="button" id="mperf-join" className="discovery-action" onClick={() => actions.joinQueue()}>
          {t("spc")}</ConnectivityWriteButton>
        <button type="button" id="mperf-poll" className="discovery-action" onClick={() => actions.pollQueue()}>
          {t("sc7")}</button>
      </div>
    </section>
  );
}

export function BenchWindow({ model, actions }: { model: MarketplaceBenchModel; actions: MarketplaceBenchActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mperf-window" className="discovery-section" aria-labelledby="mperf-window-head">
      <h3 id="mperf-window-head">{t("s26o")}</h3>
      <p className="muted">{deskText(t, MARKETPLACE_BENCH_BOUND_NOTE)}</p>
      <p className="muted">{deskText(t, model.filterLine)}</p>
      {model.rows.length === 0 ? (
        <p className="muted">{t("sy3")}</p>
      ) : (
        <div className="finance-scroll" role="region" aria-label={t("sn8")} tabIndex={0}>
          <table>
            <caption>{deskText(t, model.memoryLine)} {t("s7i")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("s1jd")}</th>
                <th scope="col">{t("sr4")}</th>
                <th scope="col">{t("sip")}</th>
                <th scope="col">{t("s25v")}</th>
                <th scope="col">{t("s244")}</th>
                <th scope="col">{t("s1mj")}</th>
                <th scope="col">{t("s1pl")}</th>
              </tr>
            </thead>
            <tbody>
              {deskText(t, model.rows.map((row) => (
                <tr key={row.listingRef} data-sequence={row.sequence}>
                  <td>{deskText(t, row.sequence)}</td>
                  <td>{deskText(t, row.listingRef)}</td>
                  <td>{deskText(t, row.eventLabel)}</td>
                  <td>{deskText(t, row.venueLabel)}</td>
                  <td>{deskText(t, row.tier)}</td>
                  <td>{deskText(t, row.status)}</td>
                  <td>{deskText(t, row.termsRef)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}
      <div className="discovery-controls">
        <button
          type="button"
          id="mperf-next"
          className="discovery-action"
          aria-disabled={model.hasNextCursor ? undefined : true}
          aria-describedby={model.hasNextCursor ? undefined : "mperf-next-reason"}
          data-enabled={model.hasNextCursor ? "true" : "false"}
          onClick={model.hasNextCursor ? () => actions.nextPage() : undefined}
        >
          {t("stq")}</button>
        {model.hasNextCursor ? null : (
          <p id="mperf-next-reason" className="muted">
            {t("sa9")}</p>
        )}
      </div>
    </section>
  );
}

export function BenchMeasurements({ model }: { model: MarketplaceBenchModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mperf-measure" className="discovery-section" aria-labelledby="mperf-measure-head">
      <h3 id="mperf-measure-head">{t("sse")}</h3>
      <p className="muted">{deskText(t, MARKETPLACE_BENCH_MEASURE_NOTE)}</p>
      <p className="muted">{deskText(t, MARKETPLACE_BENCH_DEVICE_NOTE)}</p>
      {model.report.length === 0 ? (
        <p className="muted">{t("sym")}</p>
      ) : (
        <div className="finance-scroll" role="region" aria-label={t("sak")} tabIndex={0}>
          <table>
            <caption>{t("sal")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("sgi")}</th>
                <th scope="col">{t("s1d3")}</th>
                <th scope="col">{t("s26x")}</th>
                <th scope="col">{t("sav")}</th>
                <th scope="col">{t("s16i")}</th>
                <th scope="col">{t("sqd")}</th>
                <th scope="col">{t("ssb")}</th>
                <th scope="col">{t("ssc")}</th>
              </tr>
            </thead>
            <tbody>
              {deskText(t, model.report.map((row) => (
                <tr key={`${row.deviceClass}/${row.workload}`} data-real-device={row.realDevice ? "true" : "false"}>
                  <td>{deskText(t, row.deviceClass)}</td>
                  <td>{row.realDevice ? t("s1d2") : t("sic")}</td>
                  <td>{deskText(t, row.workload)}</td>
                  <td>{deskText(t, row.calls)}</td>
                  <td>{deskText(t, row.outcomeLine)}</td>
                  <td>{deskText(t, row.lastMeasuredMs) ?? t("common.empty")}</td>
                  <td>{deskText(t, row.maxMeasuredMs) ?? t("common.empty")}</td>
                  <td>{deskText(t, row.maxOfferedMs) ?? t("common.empty")}</td>
                </tr>
              )))}
              {deskText(t, model.unverified.map((row) => (
                <tr key={row.device} data-real-device="unverified">
                  <td>{deskText(t, row.device)}</td>
                  <td>{t("s25q")}</td>
                  <td>{t("common.empty")}</td>
                  <td>0</td>
                  <td colSpan={4}>{deskText(t, row.note)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">{deskText(t, MARKETPLACE_BENCH_MEMORY_NOTE)}</p>
      <p className="muted">{deskText(t, model.memoryLine)}</p>
    </section>
  );
}

export function BenchSession({ model }: { model: MarketplaceBenchModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mperf-session" className="discovery-section" aria-labelledby="mperf-session-head">
      <h3 id="mperf-session-head">{t("s1js")}</h3>
      <p className="muted">{deskText(t, model.countersLine)}</p>
      {deskText(t, model.sessionLines.map((line) => (
        <p key={line} className="muted">
          {deskText(t, line)}
        </p>
      )))}
    </section>
  );
}
