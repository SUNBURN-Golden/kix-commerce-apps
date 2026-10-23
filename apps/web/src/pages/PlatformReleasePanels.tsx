import { messages as copy0 } from "../i18n/messages/pages--PlatformReleasePanels";
import { messages as copy1 } from "../i18n/messages/platform-release";
import { messages as copy2 } from "../i18n/messages/handoff--packet";
import { messages as copy3 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
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
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <header className="section-head discovery-section" data-adapter-environment={environment} data-scenario={scenario}>
      <h2>{deskText(t, RELEASE_TITLE)}</h2>
      <p>
        <Synthetic /> {deskText(t, RELEASE_SOURCE_LINE)}
      </p>
      <p className="muted">{deskText(t, RELEASE_BOUNDARY)}</p>
      <p className="muted">{deskText(t, SCENARIO_NOTES[scenario])}</p>
      <p className="muted">{deskText(t, RELEASE_PENDING_NOTE)}</p>
      <p className="muted">{deskText(t, RELEASE_TUPLE_NOTE)}</p>
      <p className="muted">{deskText(t, WORKSPACE_RULING)}</p>
      <p className="muted">{deskText(t, model.contextLine)}</p>
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
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="rel-controls" className="discovery-section" aria-labelledby="rel-controls-head">
      <h3 id="rel-controls-head">{t("sed")}</h3>
      <p className="muted">{deskText(t, RELEASE_RUN_NOTE)}</p>
      <p className="muted">{deskText(t, RELEASE_ACTOR_NOTE)}</p>
      <div className="discovery-controls">
        <label htmlFor="rel-scenario">{t("s1p5")}</label>
        <select
          id="rel-scenario"
          value={scenario}
          onChange={(event) => actions.setScenario(event.target.value as ReleaseScenario)}
        >
          {deskText(t, RELEASE_SCENARIOS.map((item) => (
            <option key={item} value={item}>
              {deskText(t, item)}
            </option>
          )))}
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
          {t("s8a")}</ConnectivityWriteButton>
        {model.runControl.reason ? (
          <p id="rel-run-reason" className="muted">
            {deskText(t, model.runControl.reason)}
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
          {t("sg1")}</button>
        <p id="rel-held-note" className="muted">
          {t("sn6")}</p>
        <button type="button" id="rel-switch-actor" className="discovery-action" onClick={() => actions.switchActor()}>
          {t("s1o4")}</button>
        <ConnectivityWriteButton type="button" id="rel-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          {t("sto")}</ConnectivityWriteButton>
      </div>
    </section>
  );
}

export function ReleaseStatus({ model }: { model: ReleaseModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="rel-status" className="discovery-section" aria-labelledby="rel-status-head" tabIndex={-1}>
      <h3 id="rel-status-head">{t("s1mj")}</h3>
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

export function PacketSummary({ packet }: { packet: ReleasePacketModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="rel-packet" className="discovery-section" aria-labelledby="rel-packet-head" data-packet={packet.packetId}>
      <h3 id="rel-packet-head">{t("s1f4")}</h3>
      <p className="muted">{deskText(t, packet.stateLine)}</p>
      <p className="muted">{deskText(t, packet.releaseLine)}</p>
      <p className="muted">{t("sw7")}{" "}{deskText(t, packet.nonClaimsLine)}</p>
      <p className="muted">{deskText(t, packet.boundaryNote)}</p>
    </section>
  );
}

export function CandidateSection({ packet }: { packet: ReleasePacketModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="rel-candidate" className="discovery-section" aria-labelledby="rel-candidate-head">
      <h3 id="rel-candidate-head">{t("sb8")}</h3>
      <ul className="discovery-list" aria-label={t("sb9")}>
        {deskText(t, packet.candidateLines.map((line) => (
          <li key={line}>{deskText(t, line)}</li>
        )))}
      </ul>
    </section>
  );
}

export function QualificationSection({ packet }: { packet: ReleasePacketModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="rel-qualification" className="discovery-section" aria-labelledby="rel-qualification-head">
      <h3 id="rel-qualification-head">{t("s1pg")}</h3>
      <p className="muted">
        {t("s1y4")}</p>
      <ul className="discovery-list" aria-label={t("s1aj")}>
        {deskText(t, packet.qualificationLines.map((line) => (
          <li key={line}>{deskText(t, line)}</li>
        )))}
      </ul>
      <p className="muted">{deskText(t, packet.acceptanceLine)}</p>
    </section>
  );
}

export function DecisionsSection({ packet }: { packet: ReleasePacketModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="rel-decisions" className="discovery-section" aria-labelledby="rel-decisions-head">
      <h3 id="rel-decisions-head">{t("so5")}</h3>
      <p className="muted">
        {t("shu")}</p>
      <table className="discovery-table" aria-label={t("s1f6")}>
        <thead>
          <tr>
            <th scope="col">{t("sfj")}</th>
            <th scope="col">{t("s1mi")}</th>
            <th scope="col">{t("s9q")}</th>
            <th scope="col">{t("sa6")}</th>
            <th scope="col">{t("s10r")}</th>
          </tr>
        </thead>
        <tbody>
          {deskText(t, packet.decisions.map((row) => (
            <tr key={row.id} data-decision={row.id} data-decision-state={row.decision}>
              <td>{deskText(t, row.title)}</td>
              <td>{deskText(t, row.decision)}</td>
              <td>{deskText(t, row.basis)}</td>
              <td>{deskText(t, row.blockedBy) ?? t("common.empty")}</td>
              <td>{deskText(t, row.note)}</td>
            </tr>
          )))}
        </tbody>
      </table>
      {deskText(t, packet.decisions.map((row) =>
        row.evidence.length > 0 ? (
          <p key={`${row.id}-evidence`} className="muted" data-decision-evidence={row.id}>
            {deskText(t, row.id)} {t("sju")}{" "}{row.evidence.join(" · ")}
          </p>
        ) : null,
      ))}
    </section>
  );
}

export function HandoffSection({ packet }: { packet: ReleasePacketModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="rel-handoff" className="discovery-section" aria-labelledby="rel-handoff-head">
      <h3 id="rel-handoff-head">{t("s15o")}</h3>
      <p className="muted">{deskText(t, packet.pendingLine)}</p>
      <ul className="discovery-list" aria-label={t("sn1")}>
        {deskText(t, packet.lanes.map((lane) => (
          <li key={lane.lane} data-lane={lane.lane}>
            {deskText(t, lane.line)}
          </li>
        )))}
      </ul>
    </section>
  );
}

export function DenominatorsSection({ packet }: { packet: ReleasePacketModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="rel-denominators" className="discovery-section" aria-labelledby="rel-denominators-head">
      <h3 id="rel-denominators-head">{t("sfs")}</h3>
      <p className="muted">
        {t("s1ij")}</p>
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

export function ChecksSection({ packet }: { packet: ReleasePacketModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="rel-checks" className="discovery-section" aria-labelledby="rel-checks-head">
      <h3 id="rel-checks-head">{t("sa2")}</h3>
      <ul className="discovery-list" aria-label={t("sa1")}>
        {deskText(t, packet.checks.map((check) => (
          <li key={check.id} data-check={check.id} data-verdict={check.verdict}>
            {deskText(t, check.id)}: {deskText(t, check.verdict)}{t("sk5")}{" "}{deskText(t, check.expected)}{t("s13k")}{" "}{deskText(t, check.observed)}. {deskText(t, check.note)}
          </li>
        )))}
      </ul>
    </section>
  );
}

export function ReleaseSession({ model }: { model: ReleaseModel }) {
  const t = useT(copy0, copy1, copy2, copy3);
  return (
    <section id="rel-session" className="discovery-section" aria-labelledby="rel-session-head">
      <h3 id="rel-session-head">{t("s1js")}</h3>
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
