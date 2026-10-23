import { messages as copy0 } from "../i18n/messages/pages--OperationalQualificationPanels";
import { messages as copy1 } from "../i18n/messages/operational-qualification";
import { messages as copy2 } from "../i18n/messages/handoff--packet";
import { messages as copy3 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
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
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <header className="section-head discovery-section" data-adapter-environment={environment} data-scenario={scenario}>
      <h2>{deskText(t, QUALIFICATION_TITLE)}</h2>
      <p>
        <Synthetic /> {deskText(t, QUALIFICATION_SOURCE_LINE)}
      </p>
      <p className="muted">{deskText(t, QUALIFICATION_BOUNDARY)}</p>
      <p className="muted">{deskText(t, SCENARIO_NOTES[scenario])}</p>
      <p className="muted">{deskText(t, QUALIFICATION_PENDING_NOTE)}</p>
      <p className="muted">{deskText(t, WORKSPACE_RULING)}</p>
      <p className="muted">{deskText(t, model.contextLine)}</p>
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
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="oq-controls" className="discovery-section" aria-labelledby="oq-controls-head">
      <h3 id="oq-controls-head">{t("sed")}</h3>
      <p className="muted">{deskText(t, QUALIFICATION_RUN_NOTE)}</p>
      <p className="muted">{deskText(t, QUALIFICATION_ACTOR_NOTE)}</p>
      <div className="discovery-controls">
        <label htmlFor="oq-scenario">{t("s1p5")}</label>
        <select
          id="oq-scenario"
          value={scenario}
          onChange={(event) => actions.setScenario(event.target.value as QualificationScenario)}
        >
          {deskText(t, QUALIFICATION_SCENARIOS.map((item) => (
            <option key={item} value={item}>
              {deskText(t, item)}
            </option>
          )))}
        </select>
        <ConnectivityWriteButton
          type="button"
          id="oq-run"
          className="discovery-action"
          aria-disabled={model.runControl.enabled ? undefined : true}
          aria-describedby={model.runControl.reason ? "oq-run-reason" : undefined}
          data-enabled={model.runControl.enabled ? "true" : "false"}
          onClick={model.runControl.enabled ? () => actions.run() : undefined}
        >
          {t("s1i0")}</ConnectivityWriteButton>
        {model.runControl.reason ? (
          <p id="oq-run-reason" className="muted">
            {deskText(t, model.runControl.reason)}
          </p>
        ) : null}
        <button
          type="button"
          id="oq-deliver-held"
          className="discovery-action"
          aria-disabled={heldSupported ? undefined : true}
          aria-describedby="oq-held-note"
          data-enabled={heldSupported ? "true" : "false"}
          onClick={heldSupported ? () => actions.deliverHeld() : undefined}
        >
          {t("sg1")}</button>
        <p id="oq-held-note" className="muted">
          {t("sn5")}</p>
        <button type="button" id="oq-switch-actor" className="discovery-action" onClick={() => actions.switchActor()}>
          {t("s1o4")}</button>
        <ConnectivityWriteButton type="button" id="oq-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          {t("sto")}</ConnectivityWriteButton>
      </div>
    </section>
  );
}

export function QualificationStatus({ model }: { model: QualificationModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="oq-status" className="discovery-section" aria-labelledby="oq-status-head" tabIndex={-1}>
      <h3 id="oq-status-head">{t("s1mj")}</h3>
      <p role="status" data-run-state={model.state}>
        <StatusMark kind={model.state === "ready" ? "selected" : model.state === "in-flight" ? "loading" : "blocked"} />{" "}
        {deskText(t, model.statusLine)}
      </p>
      {model.detailLine ? <p className="muted">{deskText(t, model.detailLine)}</p> : null}
      {model.lastLine ? (
        <p role="status" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {deskText(t, model.lastLine)}
        </p>
      ) : null}
    </section>
  );
}

export function PacketSummary({ packet }: { packet: PacketModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="oq-packet" className="discovery-section" aria-labelledby="oq-packet-head" data-packet={packet.packetId}>
      <h3 id="oq-packet-head">{t("s1ai")}</h3>
      <p className="muted">{deskText(t, packet.stateLine)}</p>
      <p className="muted">{deskText(t, packet.summaryLine)}</p>
      <p className="muted">{deskText(t, packet.promotionLine)}</p>
      <p className="muted">{t("sw7")}{" "}{deskText(t, packet.nonClaimsLine)}</p>
      <ul className="discovery-list" aria-label={t("s188")}>
        {deskText(t, packet.pinLines.map((line) => (
          <li key={line}>{deskText(t, line)}</li>
        )))}
      </ul>
    </section>
  );
}

export function JourneysSection({ packet }: { packet: PacketModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="oq-journeys" className="discovery-section" aria-labelledby="oq-journeys-head">
      <h3 id="oq-journeys-head">{t("route.journeys")}</h3>
      <p className="muted">
        {t("s2g")}</p>
      {deskText(t, packet.journeys.map((journey) => (
        <section key={journey.id} className="discovery-subsection" data-journey={journey.id} data-verdict={journey.verdict}>
          <h4>
            {deskText(t, journey.title)} <span className="status-word">{deskText(t, journey.verdictWord)}.</span>
          </h4>
          <p className="muted">
            {t("s1np")}{" "}{deskText(t, journey.surface)}{t("s13")}{" "}{deskText(t, journey.actor)}. {deskText(t, journey.reason)}
          </p>
          <ul className="discovery-list" aria-label={t("sqq", { id: journey.id })}>
            {journey.callLines.map((line, index) => (
              <li key={`${journey.id}-${index}`}>{deskText(t, line)}</li>
            ))}
          </ul>
        </section>
      )))}
    </section>
  );
}

export function ExercisesSection({ packet }: { packet: PacketModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="oq-exercises" className="discovery-section" aria-labelledby="oq-exercises-head">
      <h3 id="oq-exercises-head">{t("sk1")}</h3>
      <p className="muted">
        {t("shs")}</p>
      <table className="discovery-table" aria-label={t("sk3")}>
        <thead>
          <tr>
            <th scope="col">{t("sk0")}</th>
            <th scope="col">{t("scm")}</th>
            <th scope="col">{t("s1np")}</th>
            <th scope="col">{t("s25y")}</th>
            <th scope="col">{t("sk4")}</th>
            <th scope="col">{t("s13j")}</th>
          </tr>
        </thead>
        <tbody>
          {deskText(t, packet.exercises.map((row) => (
            <tr key={row.id} data-exercise={row.id} data-verdict={row.verdict}>
              <td>{deskText(t, row.id)}</td>
              <td>{deskText(t, row.klass)}</td>
              <td>{deskText(t, row.surface)}</td>
              <td>{deskText(t, row.verdict)}</td>
              <td>{deskText(t, row.expected)}</td>
              <td>{deskText(t, row.observed)}</td>
            </tr>
          )))}
        </tbody>
      </table>
      <ul className="discovery-list" aria-label={t("sk2")}>
        {deskText(t, packet.exercises.map((row) => (
          <li key={`${row.id}-note`}>
            {deskText(t, row.id)}: {deskText(t, row.note)}
          </li>
        )))}
      </ul>
    </section>
  );
}

export function DenominatorsSection({ packet }: { packet: PacketModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="oq-denominators" className="discovery-section" aria-labelledby="oq-denominators-head">
      <h3 id="oq-denominators-head">{t("s25m")}</h3>
      <p className="muted">
        {t("s1l8")}</p>
      {deskText(t, packet.denominators.map((area) => (
        <section key={area.area} className="discovery-subsection" data-area={area.area}>
          <h4>
            {deskText(t, area.area)} <span className="status-word">{deskText(t, area.line)}</span>
          </h4>
          <ul className="discovery-list" aria-label={t("s25l", { area: area.area })}>
            {area.itemLines.map((line) => (
              <li key={line}>{deskText(t, line)}</li>
            ))}
          </ul>
        </section>
      )))}
    </section>
  );
}

export function EvidenceSection({ packet }: { packet: PacketModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="oq-evidence" className="discovery-section" aria-labelledby="oq-evidence-head">
      <h3 id="oq-evidence-head">{t("sjv")}</h3>
      {deskText(t, packet.evidence.map((scope) => (
        <section key={scope.scope} className="discovery-subsection" data-evidence-scope={scope.scope}>
          <h4>{deskText(t, scope.scope)}</h4>
          <p className="muted">{deskText(t, scope.headline)}</p>
          <ul className="discovery-list" aria-label={t("s1ik", { scope: scope.scope })}>
            {scope.rows.map((row) => (
              <li key={row.id} data-evidence={row.id} data-basis={row.basis}>
                {deskText(t, row.id)} ({deskText(t, row.basis)}) — {deskText(t, row.note)}
              </li>
            ))}
          </ul>
        </section>
      )))}
    </section>
  );
}

export function CandidatesSection({ packet }: { packet: PacketModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="oq-candidates" className="discovery-section" aria-labelledby="oq-candidates-head">
      <h3 id="oq-candidates-head">{t("s1d4")}</h3>
      <p className="muted">{t("shq")}</p>
      <table className="discovery-table" aria-label={t("s1h0")}>
        <thead>
          <tr>
            <th scope="col">{t("s1ho")}</th>
            <th scope="col">{t("s1np")}</th>
            <th scope="col">{t("slp")}</th>
            <th scope="col">{t("spr")}</th>
            <th scope="col">{t("s10r")}</th>
          </tr>
        </thead>
        <tbody>
          {deskText(t, packet.candidates.map((row) => (
            <tr key={row.route} data-candidate={row.surface}>
              <td>{deskText(t, row.route)}</td>
              <td>{deskText(t, row.surface)}</td>
              <td>{deskText(t, row.focus)}</td>
              <td>{deskText(t, row.keyboard)}</td>
              <td>{deskText(t, row.note)}</td>
            </tr>
          )))}
        </tbody>
      </table>
    </section>
  );
}

export function OpsSection({ packet }: { packet: PacketModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="oq-ops" className="discovery-section" aria-labelledby="oq-ops-head">
      <h3 id="oq-ops-head">{t("s15k")}</h3>
      <ul className="discovery-list" aria-label={t("s15n")}>
        {deskText(t, packet.opsLines.map((line) => (
          <li key={line}>{deskText(t, line)}</li>
        )))}
      </ul>
      <p className="muted">{deskText(t, packet.boundaryNote)}</p>
    </section>
  );
}

export function QualificationSession({ model }: { model: QualificationModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="oq-session" className="discovery-section" aria-labelledby="oq-session-head">
      <h3 id="oq-session-head">{t("s1js")}</h3>
      <p className="muted">{deskText(t, model.countersLine)}</p>
      {model.intentLines.length === 0 ? <p className="muted">{t("sy9")}</p> : null}
      <ul className="discovery-list" aria-label={t("s1hz")}>
        {deskText(t, model.intentLines.map((line) => (
          <li key={line}>{deskText(t, line)}</li>
        )))}
      </ul>
      {model.quarantineLines.length === 0 ? <p className="muted">{t("sxd")}</p> : null}
      <ul className="discovery-list" aria-label={t("s1an")}>
        {deskText(t, model.quarantineLines.map((line) => (
          <li key={line}>{deskText(t, line)}</li>
        )))}
      </ul>
    </section>
  );
}
