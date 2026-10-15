import { QUALIFICATION_SCENARIOS, type QualificationScenario } from "@kix/protocol-adapter";
import { StatusMark } from "../a11y/marks";
import {
  QUALIFICATION_ACTOR_NOTE,
  QUALIFICATION_BOUNDARY,
  QUALIFICATION_PENDING_NOTE,
  QUALIFICATION_RUN_NOTE,
  QUALIFICATION_SOURCE_LINE,
  QUALIFICATION_TITLE,
  SCENARIO_NOTES,
  type PacketModel,
  type QualificationActions,
  type QualificationModel,
} from "../operational-qualification";
import { WORKSPACE_RULING } from "../workspace/registry";

function Synthetic() {
  return (
    <span className="discovery-badge" data-provenance="synthetic">
      SYNTHETIC
    </span>
  );
}

export function QualificationBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: QualificationScenario;
  model: QualificationModel;
}) {
  return (
    <header className="section-head discovery-section" data-adapter-environment={environment} data-scenario={scenario}>
      <h2>{QUALIFICATION_TITLE}</h2>
      <p>
        <Synthetic /> {QUALIFICATION_SOURCE_LINE}
      </p>
      <p className="muted">{QUALIFICATION_BOUNDARY}</p>
      <p className="muted">{SCENARIO_NOTES[scenario]}</p>
      <p className="muted">{QUALIFICATION_PENDING_NOTE}</p>
      <p className="muted">{WORKSPACE_RULING}</p>
      <p className="muted">{model.contextLine}</p>
    </header>
  );
}

export function QualificationControls({
  scenario,
  heldSupported,
  model,
  actions,
}: {
  scenario: QualificationScenario;
  heldSupported: boolean;
  model: QualificationModel;
  actions: QualificationActions;
}) {
  return (
    <section id="oq-controls" className="discovery-section" aria-labelledby="oq-controls-head">
      <h3 id="oq-controls-head">Controls</h3>
      <p className="muted">{QUALIFICATION_RUN_NOTE}</p>
      <p className="muted">{QUALIFICATION_ACTOR_NOTE}</p>
      <div className="discovery-controls">
        <label htmlFor="oq-scenario">Synthetic scenario</label>
        <select
          id="oq-scenario"
          value={scenario}
          onChange={(event) => actions.setScenario(event.target.value as QualificationScenario)}
        >
          {QUALIFICATION_SCENARIOS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button
          type="button"
          id="oq-run"
          className="discovery-action"
          disabled={!model.runControl.enabled}
          aria-disabled={model.runControl.enabled ? undefined : true}
          aria-describedby={model.runControl.reason ? "oq-run-reason" : undefined}
          onClick={() => actions.run()}
        >
          Run the qualification once
        </button>
        {model.runControl.reason ? (
          <p id="oq-run-reason" className="muted">
            {model.runControl.reason}
          </p>
        ) : null}
        <button
          type="button"
          id="oq-deliver-held"
          className="discovery-action"
          disabled={!heldSupported}
          aria-disabled={heldSupported ? undefined : true}
          aria-describedby="oq-held-note"
          onClick={() => actions.deliverHeld()}
        >
          Deliver held answers
        </button>
        <p id="oq-held-note" className="muted">
          Held answers exist only in the held scenario. A real qualifier offers no such control.
        </p>
        <button type="button" id="oq-switch-actor" className="discovery-action" onClick={() => actions.switchActor()}>
          Switch the actor
        </button>
        <button type="button" id="oq-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          New synthetic session
        </button>
      </div>
    </section>
  );
}

export function QualificationStatus({ model }: { model: QualificationModel }) {
  return (
    <section id="oq-status" className="discovery-section" aria-labelledby="oq-status-head" tabIndex={-1}>
      <h3 id="oq-status-head">Status</h3>
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

export function PacketSummary({ packet }: { packet: PacketModel }) {
  return (
    <section id="oq-packet" className="discovery-section" aria-labelledby="oq-packet-head" data-packet={packet.packetId}>
      <h3 id="oq-packet-head">Qualification packet</h3>
      <p className="muted">{packet.stateLine}</p>
      <p className="muted">{packet.summaryLine}</p>
      <p className="muted">{packet.promotionLine}</p>
      <p className="muted">Non-claims, each a literal false: {packet.nonClaimsLine}</p>
      <ul className="discovery-list" aria-label="Pin tuple">
        {packet.pinLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

export function JourneysSection({ packet }: { packet: PacketModel }) {
  return (
    <section id="oq-journeys" className="discovery-section" aria-labelledby="oq-journeys-head">
      <h3 id="oq-journeys-head">Journeys</h3>
      <p className="muted">
        A journey closes on the terminal state of its whole leg sequence. A per-call confirmed inside it never closes it.
      </p>
      {packet.journeys.map((journey) => (
        <section key={journey.id} className="discovery-subsection" data-journey={journey.id} data-verdict={journey.verdict}>
          <h4>
            {journey.title} <span className="status-word">{journey.verdictWord}.</span>
          </h4>
          <p className="muted">
            Surface {journey.surface}. Actor {journey.actor}. {journey.reason}
          </p>
          <ul className="discovery-list" aria-label={`Legs of ${journey.id}`}>
            {journey.callLines.map((line, index) => (
              <li key={`${journey.id}-${index}`}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

export function ExercisesSection({ packet }: { packet: PacketModel }) {
  return (
    <section id="oq-exercises" className="discovery-section" aria-labelledby="oq-exercises-head">
      <h3 id="oq-exercises-head">Exercise classes</h3>
      <p className="muted">
        Each class keeps its own record. A listed class with no recorded exercise is uncovered, never inferred.
      </p>
      <table className="discovery-table" aria-label="Exercise records">
        <thead>
          <tr>
            <th scope="col">Exercise</th>
            <th scope="col">Class</th>
            <th scope="col">Surface</th>
            <th scope="col">Verdict</th>
            <th scope="col">Expected</th>
            <th scope="col">Observed</th>
          </tr>
        </thead>
        <tbody>
          {packet.exercises.map((row) => (
            <tr key={row.id} data-exercise={row.id} data-verdict={row.verdict}>
              <td>{row.id}</td>
              <td>{row.klass}</td>
              <td>{row.surface}</td>
              <td>{row.verdict}</td>
              <td>{row.expected}</td>
              <td>{row.observed}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="discovery-list" aria-label="Exercise notes">
        {packet.exercises.map((row) => (
          <li key={`${row.id}-note`}>
            {row.id}: {row.note}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DenominatorsSection({ packet }: { packet: PacketModel }) {
  return (
    <section id="oq-denominators" className="discovery-section" aria-labelledby="oq-denominators-head">
      <h3 id="oq-denominators-head">Unresolved items on their own denominators</h3>
      <p className="muted">
        Source, device, provider, rights, and finance each keep their own denominator. The areas are never merged into
        one readiness figure, and a synthetic run resolves none of them.
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

export function EvidenceSection({ packet }: { packet: PacketModel }) {
  return (
    <section id="oq-evidence" className="discovery-section" aria-labelledby="oq-evidence-head">
      <h3 id="oq-evidence-head">Evidence by scope</h3>
      {packet.evidence.map((scope) => (
        <section key={scope.scope} className="discovery-subsection" data-evidence-scope={scope.scope}>
          <h4>{scope.scope}</h4>
          <p className="muted">{scope.headline}</p>
          <ul className="discovery-list" aria-label={`${scope.scope} evidence`}>
            {scope.rows.map((row) => (
              <li key={row.id} data-evidence={row.id} data-basis={row.basis}>
                {row.id} ({row.basis}) — {row.note}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

export function CandidatesSection({ packet }: { packet: PacketModel }) {
  return (
    <section id="oq-candidates" className="discovery-section" aria-labelledby="oq-candidates-head">
      <h3 id="oq-candidates-head">Real-user review candidates</h3>
      <p className="muted">Each candidate stays a candidate: no real user ran it in this session.</p>
      <table className="discovery-table" aria-label="Review candidates">
        <thead>
          <tr>
            <th scope="col">Route</th>
            <th scope="col">Surface</th>
            <th scope="col">Focus</th>
            <th scope="col">Keyboard</th>
            <th scope="col">Note</th>
          </tr>
        </thead>
        <tbody>
          {packet.candidates.map((row) => (
            <tr key={row.route} data-candidate={row.surface}>
              <td>{row.route}</td>
              <td>{row.surface}</td>
              <td>{row.focus}</td>
              <td>{row.keyboard}</td>
              <td>{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function OpsSection({ packet }: { packet: PacketModel }) {
  return (
    <section id="oq-ops" className="discovery-section" aria-labelledby="oq-ops-head">
      <h3 id="oq-ops-head">Operational support, incident handoff, and UI review material</h3>
      <ul className="discovery-list" aria-label="Operations bundle">
        {packet.opsLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="muted">{packet.boundaryNote}</p>
    </section>
  );
}

export function QualificationSession({ model }: { model: QualificationModel }) {
  return (
    <section id="oq-session" className="discovery-section" aria-labelledby="oq-session-head">
      <h3 id="oq-session-head">Session record</h3>
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
