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
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
    >
      <h2>{MARKETPLACE_BENCH_TITLE}</h2>
      <p>
        <Synthetic /> {MARKETPLACE_BENCH_SOURCE_LINE}
      </p>
      <p className="muted">{MARKETPLACE_BENCH_BOUNDARY}</p>
      <p className="muted">{MARKETPLACE_BENCH_SCENARIO_NOTES[scenario]}</p>
      <p className="muted">{WORKSPACE_RULING}</p>
      <p className="muted">{model.contextLine}</p>
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
  return (
    <section id="mperf-controls" className="discovery-section" aria-labelledby="mperf-controls-head">
      <h3 id="mperf-controls-head">Controls</h3>
      <p className="muted">{MARKETPLACE_BENCH_READ_NOTE}</p>
      <p className="muted">{MARKETPLACE_BENCH_SYNTHETIC_CONTROL_NOTE}</p>
      <div className="discovery-controls">
        <label htmlFor="mperf-scenario">Synthetic scenario</label>
        <select
          id="mperf-scenario"
          value={scenario}
          onChange={(event) => actions.setScenario(event.target.value as MarketplaceScenario)}
        >
          {MARKETPLACE_SCENARIOS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <label htmlFor="mperf-workload">Workload label</label>
        <select
          id="mperf-workload"
          value={workload}
          onChange={(event) => actions.setWorkload(event.target.value as MarketplaceWorkload)}
        >
          {MARKETPLACE_WORKLOADS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <label htmlFor="mperf-actor">Desk actor</label>
        <select
          id="mperf-actor"
          defaultValue={MARKETPLACE_BENCH_ACTORS[0]}
          onChange={(event) => actions.switchActor(event.target.value)}
        >
          {MARKETPLACE_BENCH_ACTORS.map((actor) => (
            <option key={actor} value={actor}>
              {actor}
            </option>
          ))}
        </select>
        <label htmlFor="mperf-device">Device profile</label>
        <select
          id="mperf-device"
          defaultValue={MARKETPLACE_DEVICE_PROFILES[0].deviceClass}
          onChange={(event) => actions.switchDevice(event.target.value as MarketplaceDeviceClass)}
        >
          {MARKETPLACE_DEVICE_PROFILES.map((profile) => (
            <option key={profile.deviceClass} value={profile.deviceClass}>
              {profile.deviceClass}
            </option>
          ))}
        </select>
        <button type="button" id="mperf-second-tab" className="discovery-action" onClick={() => actions.openSecondTab()}>
          Open a second tab (new session incarnation)
        </button>
        <button type="button" id="mperf-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          New synthetic session
        </button>
      </div>
      <div className="discovery-controls" aria-label="Synthetic controls">
        {MARKETPLACE_SYNTHETIC_CONTROLS.map((control) => (
          <button
            key={control}
            type="button"
            id={`mperf-sim-${control}`}
            className="discovery-action"
            onClick={() => actions.synthetic(control)}
          >
            Simulate {control}
          </button>
        ))}
      </div>
    </section>
  );
}

export function BenchStatus({ model, actions }: { model: MarketplaceBenchModel; actions: MarketplaceBenchActions }) {
  return (
    <section id="mperf-status" className="discovery-section" aria-labelledby="mperf-status-head" tabIndex={-1}>
      <h3 id="mperf-status-head">Status</h3>
      <p role="status" data-read-state={model.state}>
        <StatusMark kind={model.state === "loading" ? "loading" : model.state === "ready" ? "selected" : "blocked"} />{" "}
        {model.statusLine}
      </p>
      {model.detailLine ? <p className="muted">{model.detailLine}</p> : null}
      <p className="muted">{model.freshnessWord}</p>
      <p className="muted">{model.watermarkLine}</p>
      <p className="muted">{model.inFlightLine}</p>
      {model.lastLine ? <p className="muted">{model.lastLine}</p> : null}
      <div className="discovery-controls">
        <button type="button" id="mperf-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          Read again
        </button>
        <button type="button" id="mperf-cancel" className="discovery-action" onClick={() => actions.cancel()}>
          Cancel reads in flight
        </button>
      </div>
    </section>
  );
}

export function BenchQueue({ model, actions }: { model: MarketplaceBenchModel; actions: MarketplaceBenchActions }) {
  return (
    <section id="mperf-queue" className="discovery-section" aria-labelledby="mperf-queue-head">
      <h3 id="mperf-queue-head">Queue</h3>
      <p className="muted">{MARKETPLACE_BENCH_QUEUE_NOTE}</p>
      <p role="status" data-queue-phase={model.queue.phaseWord}>
        <span className="status-word">{model.queue.phaseWord}.</span> {model.queue.stateWord}. {model.queue.grantsLine}
      </p>
      {model.queue.positionLine ? <p className="muted">{model.queue.positionLine}</p> : null}
      {model.queue.admittedLine ? <p className="muted">{model.queue.admittedLine}</p> : null}
      {model.queue.detailLine ? <p className="muted">{model.queue.detailLine}</p> : null}
      <div className="discovery-controls">
        <button type="button" id="mperf-join" className="discovery-action" onClick={() => actions.joinQueue()}>
          Join the queue once
        </button>
        <button type="button" id="mperf-poll" className="discovery-action" onClick={() => actions.pollQueue()}>
          Check the queue once
        </button>
      </div>
    </section>
  );
}

export function BenchWindow({ model, actions }: { model: MarketplaceBenchModel; actions: MarketplaceBenchActions }) {
  return (
    <section id="mperf-window" className="discovery-section" aria-labelledby="mperf-window-head">
      <h3 id="mperf-window-head">Window</h3>
      <p className="muted">{MARKETPLACE_BENCH_BOUND_NOTE}</p>
      <p className="muted">{model.filterLine}</p>
      {model.rows.length === 0 ? (
        <p className="muted">No rows are held. Loading, empty, stale, denied, refused, gapped, blocked, and unknown are each their own state — none of them lists a row.</p>
      ) : (
        <div className="finance-scroll" role="region" aria-label="Held bench window" tabIndex={0}>
          <table>
            <caption>{model.memoryLine} A row confirms no price, no right, no sale, and no ownership.</caption>
            <thead>
              <tr>
                <th scope="col">Seq</th>
                <th scope="col">Listing ref</th>
                <th scope="col">Event</th>
                <th scope="col">Venue</th>
                <th scope="col">Tier</th>
                <th scope="col">Status</th>
                <th scope="col">Terms</th>
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row) => (
                <tr key={row.listingRef} data-sequence={row.sequence}>
                  <td>{row.sequence}</td>
                  <td>{row.listingRef}</td>
                  <td>{row.eventLabel}</td>
                  <td>{row.venueLabel}</td>
                  <td>{row.tier}</td>
                  <td>{row.status}</td>
                  <td>{row.termsRef}</td>
                </tr>
              ))}
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
          Next page
        </button>
        {model.hasNextCursor ? null : (
          <p id="mperf-next-reason" className="muted">
            Blocked. The last read reported no next cursor, or no read is held. Nothing is paged past it.
          </p>
        )}
      </div>
    </section>
  );
}

export function BenchMeasurements({ model }: { model: MarketplaceBenchModel }) {
  return (
    <section id="mperf-measure" className="discovery-section" aria-labelledby="mperf-measure-head">
      <h3 id="mperf-measure-head">Measurements</h3>
      <p className="muted">{MARKETPLACE_BENCH_MEASURE_NOTE}</p>
      <p className="muted">{MARKETPLACE_BENCH_DEVICE_NOTE}</p>
      {model.report.length === 0 ? (
        <p className="muted">No settled call is measured yet.</p>
      ) : (
        <div className="finance-scroll" role="region" aria-label="Browser-boundary measurements" tabIndex={0}>
          <table>
            <caption>Browser-boundary measurements only. Denominator browser-boundary-measurement. Producer load share none. Real-device evidence false.</caption>
            <thead>
              <tr>
                <th scope="col">Device class</th>
                <th scope="col">Real device</th>
                <th scope="col">Workload</th>
                <th scope="col">Calls</th>
                <th scope="col">Outcomes</th>
                <th scope="col">Last ms</th>
                <th scope="col">Max ms</th>
                <th scope="col">Max offered ms</th>
              </tr>
            </thead>
            <tbody>
              {model.report.map((row) => (
                <tr key={`${row.deviceClass}/${row.workload}`} data-real-device={row.realDevice ? "true" : "false"}>
                  <td>{row.deviceClass}</td>
                  <td>{row.realDevice ? "real" : "emulation"}</td>
                  <td>{row.workload}</td>
                  <td>{row.calls}</td>
                  <td>{row.outcomeLine}</td>
                  <td>{row.lastMeasuredMs ?? "none"}</td>
                  <td>{row.maxMeasuredMs ?? "none"}</td>
                  <td>{row.maxOfferedMs ?? "none"}</td>
                </tr>
              ))}
              {model.unverified.map((row) => (
                <tr key={row.device} data-real-device="unverified">
                  <td>{row.device}</td>
                  <td>unverified</td>
                  <td>none</td>
                  <td>0</td>
                  <td colSpan={4}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">{MARKETPLACE_BENCH_MEMORY_NOTE}</p>
      <p className="muted">{model.memoryLine}</p>
    </section>
  );
}

export function BenchSession({ model }: { model: MarketplaceBenchModel }) {
  return (
    <section id="mperf-session" className="discovery-section" aria-labelledby="mperf-session-head">
      <h3 id="mperf-session-head">Session record</h3>
      <p className="muted">{model.countersLine}</p>
      {model.sessionLines.map((line) => (
        <p key={line} className="muted">
          {line}
        </p>
      ))}
    </section>
  );
}
