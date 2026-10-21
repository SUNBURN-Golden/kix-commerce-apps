import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { RELEASE_SCENARIOS, type ReleaseScenario } from "@kix/protocol-adapter";
import { StatusMark } from "../a11y/marks";
import {
  RELEASE_ACTOR_NOTE,
  RELEASE_BOUNDARY,
  RELEASE_PENDING_NOTE,
  RELEASE_RUN_NOTE,
  RELEASE_SOURCE_LINE,
  RELEASE_TITLE,
  RELEASE_TUPLE_NOTE,
  SCENARIO_NOTES,
  type ReleaseActions,
  type ReleaseModel,
  type ReleasePacketModel,
} from "../platform-release";
import { WORKSPACE_RULING } from "../workspace/registry";

function Synthetic() {
  return (
    <span className="discovery-badge" data-provenance="synthetic">
      SYNTHETIC
    </span>
  );
}

export function ReleaseBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: ReleaseScenario;
  model: ReleaseModel;
}) {
  return (
    <header className="section-head discovery-section" data-adapter-environment={environment} data-scenario={scenario}>
      <h2>{RELEASE_TITLE}</h2>
      <p>
        <Synthetic /> {RELEASE_SOURCE_LINE}
      </p>
      <p className="muted">{RELEASE_BOUNDARY}</p>
      <p className="muted">{SCENARIO_NOTES[scenario]}</p>
      <p className="muted">{RELEASE_PENDING_NOTE}</p>
      <p className="muted">{RELEASE_TUPLE_NOTE}</p>
      <p className="muted">{WORKSPACE_RULING}</p>
      <p className="muted">{model.contextLine}</p>
    </header>
  );
}

export function ReleaseControls({
  scenario,
  heldSupported,
  model,
  actions,
}: {
  scenario: ReleaseScenario;
  heldSupported: boolean;
  model: ReleaseModel;
  actions: ReleaseActions;
}) {
  return (
    <section id="rel-controls" className="discovery-section" aria-labelledby="rel-controls-head">
      <h3 id="rel-controls-head">Controls</h3>
      <p className="muted">{RELEASE_RUN_NOTE}</p>
      <p className="muted">{RELEASE_ACTOR_NOTE}</p>
      <div className="discovery-controls">
        <label htmlFor="rel-scenario">Synthetic scenario</label>
        <select
          id="rel-scenario"
          value={scenario}
          onChange={(event) => actions.setScenario(event.target.value as ReleaseScenario)}
        >
          {RELEASE_SCENARIOS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <ConnectivityWriteButton
          type="button"
          id="rel-run"
          className="discovery-action"
          aria-disabled={model.runControl.enabled ? undefined : true}
          aria-describedby={model.runControl.reason ? "rel-run-reason" : undefined}
          data-enabled={model.runControl.enabled ? "true" : "false"}
          onClick={model.runControl.enabled ? () => actions.run() : undefined}
        >
          Assemble the release candidate once
        </ConnectivityWriteButton>
        {model.runControl.reason ? (
          <p id="rel-run-reason" className="muted">
            {model.runControl.reason}
          </p>
        ) : null}
        <button
          type="button"
          id="rel-deliver-held"
          className="discovery-action"
          aria-disabled={heldSupported ? undefined : true}
          aria-describedby="rel-held-note"
          data-enabled={heldSupported ? "true" : "false"}
          onClick={heldSupported ? () => actions.deliverHeld() : undefined}
        >
          Deliver held answers
        </button>
        <p id="rel-held-note" className="muted">
          Held answers exist only in the held scenario. A real release gate offers no such control.
        </p>
        <button type="button" id="rel-switch-actor" className="discovery-action" onClick={() => actions.switchActor()}>
          Switch the actor
        </button>
        <ConnectivityWriteButton type="button" id="rel-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          New synthetic session
        </ConnectivityWriteButton>
      </div>
    </section>
  );
}

export function ReleaseStatus({ model }: { model: ReleaseModel }) {
  return (
    <section id="rel-status" className="discovery-section" aria-labelledby="rel-status-head" tabIndex={-1}>
      <h3 id="rel-status-head">Status</h3>
      <p role="status" data-run-state={model.state}>
        <StatusMark kind={model.state === "ready" ? "selected" : model.state === "in-flight" ? "loading" : "blocked"} />{" "}
        {model.statusLine}
      </p>
      {model.detailLine ? <p className="muted">{model.detailLine}</p> : null}
      {model.lastLine ? (
        <p role="status" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastLine}
        </p>
      ) : null}
    </section>
  );
}

export function PacketSummary({ packet }: { packet: ReleasePacketModel }) {
  return (
    <section id="rel-packet" className="discovery-section" aria-labelledby="rel-packet-head" data-packet={packet.packetId}>
      <h3 id="rel-packet-head">Release candidate packet</h3>
      <p className="muted">{packet.stateLine}</p>
      <p className="muted">{packet.releaseLine}</p>
      <p className="muted">Non-claims, each a literal false: {packet.nonClaimsLine}</p>
      <p className="muted">{packet.boundaryNote}</p>
    </section>
  );
}

export function CandidateSection({ packet }: { packet: ReleasePacketModel }) {
  return (
    <section id="rel-candidate" className="discovery-section" aria-labelledby="rel-candidate-head">
      <h3 id="rel-candidate-head">Candidate source, artifact, and config tuple</h3>
      <ul className="discovery-list" aria-label="Candidate tuple">
        {packet.candidateLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

export function QualificationSection({ packet }: { packet: ReleasePacketModel }) {
  return (
    <section id="rel-qualification" className="discovery-section" aria-labelledby="rel-qualification-head">
      <h3 id="rel-qualification-head">Technical qualification record</h3>
      <p className="muted">
        The sibling qualification run is technical evidence only. It is never real user acceptance, and the two records
        stay separate.
      </p>
      <ul className="discovery-list" aria-label="Qualification record">
        {packet.qualificationLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="muted">{packet.acceptanceLine}</p>
    </section>
  );
}

export function DecisionsSection({ packet }: { packet: ReleasePacketModel }) {
  return (
    <section id="rel-decisions" className="discovery-section" aria-labelledby="rel-decisions-head">
      <h3 id="rel-decisions-head">Install, publish, and operate decisions</h3>
      <p className="muted">
        Each decision is presented to the user and none is taken on this page. A decision that is not open is blocked,
        not denied silently.
      </p>
      <table className="discovery-table" aria-label="Release decisions">
        <thead>
          <tr>
            <th scope="col">Decision</th>
            <th scope="col">State</th>
            <th scope="col">Basis</th>
            <th scope="col">Blocked by</th>
            <th scope="col">Note</th>
          </tr>
        </thead>
        <tbody>
          {packet.decisions.map((row) => (
            <tr key={row.id} data-decision={row.id} data-decision-state={row.decision}>
              <td>{row.title}</td>
              <td>{row.decision}</td>
              <td>{row.basis}</td>
              <td>{row.blockedBy ?? "none"}</td>
              <td>{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {packet.decisions.map((row) =>
        row.evidence.length > 0 ? (
          <p key={`${row.id}-evidence`} className="muted" data-decision-evidence={row.id}>
            {row.id} evidence: {row.evidence.join(" · ")}
          </p>
        ) : null,
      )}
    </section>
  );
}

export function HandoffSection({ packet }: { packet: ReleasePacketModel }) {
  return (
    <section id="rel-handoff" className="discovery-section" aria-labelledby="rel-handoff-head">
      <h3 id="rel-handoff-head">Operations checklist and support/update handoffs</h3>
      <p className="muted">{packet.pendingLine}</p>
      <ul className="discovery-list" aria-label="Handoff lanes">
        {packet.lanes.map((lane) => (
          <li key={lane.lane} data-lane={lane.lane}>
            {lane.line}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DenominatorsSection({ packet }: { packet: ReleasePacketModel }) {
  return (
    <section id="rel-denominators" className="discovery-section" aria-labelledby="rel-denominators-head">
      <h3 id="rel-denominators-head">Deferred scope and unresolved items on their own denominators</h3>
      <p className="muted">
        Scope, acceptance, environment, operations, and gate each keep their own denominator. The areas are never
        merged into one readiness figure, and a synthetic run resolves none of them.
      </p>
      {packet.denominators.map((area) => (
        <section key={area.area} className="discovery-subsection" data-area={area.area}>
          <h4>
            {area.area} <span className="status-word">{area.line}</span>
          </h4>
          <ul className="discovery-list" aria-label={`Unresolved items on ${area.area}`}>
            {area.itemLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

export function ChecksSection({ packet }: { packet: ReleasePacketModel }) {
  return (
    <section id="rel-checks" className="discovery-section" aria-labelledby="rel-checks-head">
      <h3 id="rel-checks-head">Binding-integrity checks</h3>
      <ul className="discovery-list" aria-label="Binding checks">
        {packet.checks.map((check) => (
          <li key={check.id} data-check={check.id} data-verdict={check.verdict}>
            {check.id}: {check.verdict}. Expected {check.expected}; observed {check.observed}. {check.note}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReleaseSession({ model }: { model: ReleaseModel }) {
  return (
    <section id="rel-session" className="discovery-section" aria-labelledby="rel-session-head">
      <h3 id="rel-session-head">Session record</h3>
      <p className="muted">{model.countersLine}</p>
      {model.intentLines.length === 0 ? <p className="muted">No run sent in this session.</p> : null}
      <ul className="discovery-list" aria-label="Run intents">
        {model.intentLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {model.quarantineLines.length === 0 ? <p className="muted">No quarantined answer.</p> : null}
      <ul className="discovery-list" aria-label="Quarantined answers">
        {model.quarantineLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
