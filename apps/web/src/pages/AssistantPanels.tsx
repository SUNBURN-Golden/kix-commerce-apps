import { ReadRow } from "./ReadState";
import { messages as copy0 } from "../i18n/messages/pages--AssistantPanels";
import { messages as copy1 } from "../i18n/messages/delegated-assistant";
import { messages as copy2 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { ValidatedForm } from "../forms/ValidatedForm";
import { field } from "../forms/validation";
import { useState, type FormEvent, type ReactNode } from "react";
import { DELEGATION_SCENARIOS, type DelegationScenario } from "@kix/protocol-adapter";
import { StatusMark } from "../a11y/marks";
import {
  CONTROL_LABELS,
  DELEGATION_ACTOR_NOTE,
  DELEGATION_ALT_PRINCIPAL_NOTE,
  DELEGATION_BOUNDARY,
  DELEGATION_FENCE_NOTE,
  DELEGATION_HOLD_NOTE,
  DELEGATION_MODE_NOTE,
  DELEGATION_NON_CLAIM_NOTE,
  DELEGATION_NOT_BOUND_BANNER,
  DELEGATION_READ_NOTE,
  DELEGATION_SCENARIO_OFF_NOTE,
  DELEGATION_SESSION_NOTE,
  DELEGATION_SOURCE_LINE,
  DELEGATION_TARGET_NOTE,
  DELEGATION_TEXT_NOTE,
  DELEGATION_TITLE,
  SCENARIO_NOTES,
  type ControlModel,
  type DelegationAssistantActions,
  type DelegationAssistantModel,
  type GrantModel,
  type ListingModel,
  type ProposalModel,
  type RejectionModel,
  type SessionModel,
  type TurnModel,
} from "../delegated-assistant";
import { WORKSPACE_RULING } from "../workspace/registry";

/** A word, not only a color. */
function WordMark({ word }: { word: string }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <span className="status-mark" data-status-mark="blocked">
      <span className="status-word">{deskText(t, word)}</span>
    </span>
  );
}

/** A wide table scrolls inside its own region, so the page does not scroll sideways. */
function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <div className="dlg-scroll" role="region" aria-label={deskText(t, label)} tabIndex={0}>
      {deskText(t, children)}
    </div>
  );
}

/**
 * A control that is off stays focusable and says why. A native disabled button is
 * skipped by the keyboard, so its reason would never be reached.
 */
function GuardedButton({
  id,
  label,
  control,
  onPress,
}: {
  id: string;
  label: string;
  control: ControlModel;
  onPress: () => void;
}) {
  const t = useT(copy0, copy1, copy2);
  const reasonId = `${id}-reason`;
  return (
    <>
      <ConnectivityWriteButton
        type="button"
        id={id}
        className="discovery-action"
        aria-disabled={control.enabled ? undefined : true}
        aria-describedby={control.reason ? reasonId : undefined}
        data-enabled={control.enabled ? "true" : "false"}
        onClick={control.enabled ? onPress : undefined}
      >
        {deskText(t, label)}
      </ConnectivityWriteButton>
      {control.reason ? (
        <p id={reasonId} className="muted" data-blocked-reason="true">
          <WordMark word={t("status.transport.blocked")} /> {deskText(t, control.reason)}
        </p>
      ) : null}
    </>
  );
}

export function AssistantBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: DelegationScenario;
  model: DelegationAssistantModel;
}) {
  const t = useT(copy0, copy1, copy2);
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">{t("s2h")}</p>
      <h2>{deskText(t, DELEGATION_TITLE)}</h2>
      {environment === "stub" ? (
        <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-delegation">
          SYNTHETIC. {deskText(t, DELEGATION_SOURCE_LINE)}
        </p>
      ) : (
        <p className="discovery-banner" data-provenance="none" data-source="none">
          {deskText(t, DELEGATION_NOT_BOUND_BANNER)}
        </p>
      )}
      <p>{deskText(t, DELEGATION_BOUNDARY)}</p>
      <p data-non-claims="false">{deskText(t, DELEGATION_NON_CLAIM_NOTE)}</p>
      <p data-interpreter="deterministic">{deskText(t, DELEGATION_TEXT_NOTE)}</p>
      <p data-mode-record="source-owned">{deskText(t, DELEGATION_MODE_NOTE)}</p>
      <p>{deskText(t, WORKSPACE_RULING)}</p>
      <p data-hold-record="not-bound">{deskText(t, DELEGATION_HOLD_NOTE)}</p>
      <p>{deskText(t, DELEGATION_ACTOR_NOTE)}</p>
      <p>{deskText(t, DELEGATION_FENCE_NOTE)}</p>
      <p>{deskText(t, DELEGATION_READ_NOTE)}</p>
      <p data-policy-record="undetermined">{deskText(t, DELEGATION_TARGET_NOTE)}</p>
      <p>{deskText(t, DELEGATION_SESSION_NOTE)}</p>
    </header>
  );
}

export function AssistantControls({
  environment,
  scenario,
  heldSupported,
  principalRef,
  actions,
}: {
  environment: "stub" | "integration-http";
  scenario: DelegationScenario;
  heldSupported: boolean;
  principalRef: string;
  actions: DelegationAssistantActions;
}) {
  const t = useT(copy0, copy1, copy2);
  // The picker only chooses. Starting a session is its own button, so moving through the
  // list with the arrow keys resets nothing.
  const [picked, setPicked] = useState<DelegationScenario>(scenario);
  const simulated = environment === "stub";
  const simulateNote = simulated ? "dlg-simulate-note" : "dlg-scenario-off dlg-simulate-note";
  return (
    <section id="dlg-controls" className="discovery-section" aria-label={t("s1o9")}>
      <div className="discovery-controls">
        <label htmlFor="dlg-scenario">
          {t("s1p5")}<select id="dlg-scenario" value={picked} onChange={(event) => setPicked(event.target.value as DelegationScenario)}>
            {deskText(t, DELEGATION_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {deskText(t, item)}
              </option>
            )))}
          </select>
        </label>
        <ConnectivityWriteButton
          type="button"
          id="dlg-apply-scenario"
          className="discovery-action"
          aria-disabled={simulated ? undefined : true}
          aria-describedby={simulated ? undefined : "dlg-scenario-off"}
          onClick={simulated ? () => actions.setScenario(picked) : undefined}
        >
          {t("s1m5")}</ConnectivityWriteButton>
        <button type="button" id="dlg-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          {t("s1ax")}</button>
        <button type="button" id="dlg-switch" className="discovery-action" onClick={() => actions.switchScope()}>
          {t("s1nx")}</button>
        <ConnectivityWriteButton type="button" id="dlg-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          {t("s1m2")}</ConnectivityWriteButton>
        <button
          type="button"
          id="dlg-deliver-held"
          className="discovery-action"
          aria-disabled={heldSupported ? undefined : true}
          aria-describedby="dlg-deliver-note"
          onClick={heldSupported ? () => actions.deliverHeld() : undefined}
        >
          {t("sg2")}</button>
      </div>
      {simulated ? (
        <p className="muted" data-scenario-note={scenario}>
          {deskText(t, SCENARIO_NOTES[scenario])} {t("sbx")}</p>
      ) : (
        <p className="muted" id="dlg-scenario-off" data-blocked-reason="true" data-scenario-note="off">
          <WordMark word={t("status.transport.blocked")} /> {deskText(t, DELEGATION_SCENARIO_OFF_NOTE)}
        </p>
      )}
      <p className="muted" id="dlg-deliver-note" data-principal={principalRef}>
        {t("s195")}{" "}{deskText(t, principalRef)}. {deskText(t, DELEGATION_ALT_PRINCIPAL_NOTE)} {t("s1m3")}</p>
      <div className="discovery-controls" role="group" aria-label={t("s1kn")}>
        {deskText(t, (Object.keys(CONTROL_LABELS) as (keyof typeof CONTROL_LABELS)[]).map((controlName) => (
          <ConnectivityWriteButton
            key={controlName}
            type="button"
            id={`dlg-simulate-${controlName}`}
            className="discovery-action"
            data-simulate={controlName}
            aria-disabled={simulated ? undefined : true}
            aria-describedby={simulateNote}
            onClick={simulated ? () => actions.simulate(controlName) : undefined}
          >
            {deskText(t, CONTROL_LABELS[controlName])}
          </ConnectivityWriteButton>
        )))}
      </div>
      <p className="muted" id="dlg-simulate-note">
        {t("s83")}</p>
    </section>
  );
}

export function AssistantStatus({ model }: { model: DelegationAssistantModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="dlg-status" className="discovery-section" tabIndex={-1} data-delegation-state={model.state}>
      <h3>{t("s1mj")}</h3>
      <p role="status" data-delegation-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {deskText(t, model.statusLine)}
        {model.detailLine ? t("sgg", { detailLine: model.detailLine }) : ""}
      </p>
      <p className="muted">{deskText(t, model.freshnessWord)}</p>
      {model.lastLine ? (
        <p role="status" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word={t("s91")} /> : null} {deskText(t, model.lastLine)}
        </p>
      ) : null}
    </section>
  );
}

/**
 * The request box. Text goes in as untrusted intent. It is never an approval: only
 * the approve control on a recorded proposal sends anything.
 */
export function AssistantRequest({ actions }: { actions: DelegationAssistantActions }) {
  const t = useT(copy0, copy1, copy2);
  const [text, setText] = useState("");
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    actions.ask(text);
    setText("");
  };
  return (
    <section id="dlg-request" className="discovery-section" aria-label={t("s1fq")}>
      <h3>{t("s88")}</h3>
      <p className="muted">
        {t("s24w")}{" "}
        <code>{t("sha")}</code> {t("s15r")}{" "}<code>{t("say")}</code>{t("s22r")}</p>
      <ValidatedForm id="assistant-request-form" fields={[field("dlg-request-text", "validation.label.request")]} onSubmit={onSubmit} className="discovery-controls">
        <label htmlFor="dlg-request-text">
          {t("s1fx")}<input
            id="dlg-request-text"
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            autoComplete="off"
            aria-describedby="dlg-request-note"
          />
        </label>
        <ConnectivityWriteButton type="submit" id="dlg-ask" className="discovery-action">
          {t("s85")}</ConnectivityWriteButton>
      </ValidatedForm>
      <p className="muted" id="dlg-request-note">
        {t("soa")}</p>
    </section>
  );
}

export function LanesSection({ model }: { model: DelegationAssistantModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="dlg-lanes" className="discovery-section" aria-label={t("s1sw")}>
      <h3>{t("s1aq")}</h3>
      <p className="muted">{t("sly")}</p>
      <ol className="discovery-list" aria-label={t("s8d")}>
        {deskText(t, model.lanes.map((lane) => (
          <li key={lane.lane} className="discovery-row" data-lane={lane.lane} data-count={lane.count === null ? "none" : String(lane.count)}>
            <h4>{deskText(t, lane.label)}</h4>
            <p>{deskText(t, lane.line)}</p>
          </li>
        )))}
      </ol>
    </section>
  );
}

function GrantCard({ grant }: { grant: GrantModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <ReadRow as="li" name="grant" value={grant.grantRef} className="discovery-row" data-grant={grant.grantRef} data-provenance="synthetic" data-source="synthetic-delegation">
      <p>
        <span className="discovery-badge" data-provenance="synthetic">
          SYNTHETIC
        </span>{" "}
        <span className="discovery-badge">{deskText(t, grant.grantRef)}</span>
      </p>
      <p>{deskText(t, grant.scopeLine)}</p>
      <p>{deskText(t, grant.targetLine)}</p>
      <p>{deskText(t, grant.deadlineLine)}</p>
      <p data-budget-line="source">{deskText(t, grant.budgetLine)}</p>
      <p>{deskText(t, grant.actionsLine)}</p>
      <p data-mode={grant.grantRef}>{deskText(t, grant.modeLine)}</p>
      <p>{deskText(t, grant.versionLine)}</p>
      <p>{deskText(t, grant.stateLine)}</p>
    </ReadRow>
  );
}

export function GrantsSection({ model }: { model: DelegationAssistantModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="dlg-grants" className="discovery-section" aria-label={t("smt")}>
      <h3>{t("sfy")}</h3>
      <p className="muted">
        {t("s29")}</p>
      {model.grants.length === 0 ? <p data-state="empty">{t("svo")}</p> : null}
      {model.grants.length > 0 ? (
        <ul className="discovery-list" aria-label={t("smv")}>
          {deskText(t, model.grants.map((grant) => (
            <GrantCard key={grant.grantRef} grant={grant} />
          )))}
        </ul>
      ) : null}
    </section>
  );
}

function ListingCard({ listing }: { listing: ListingModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <li className="discovery-row" data-listing={listing.listingRef} data-state={listing.state} data-source="synthetic-delegation">
      <h4>
        {deskText(t, listing.title)} ({listing.listingRef})
      </h4>
      <p>
        {t("s255")}{" "}{deskText(t, listing.eventRef)}. {deskText(t, listing.tierLine)}
      </p>
      <p>{deskText(t, listing.stateLine)}</p>
      {listing.drafts.length > 0 ? (
        <ul className="discovery-list" aria-label={t("shc", { listingRef: listing.listingRef })}>
          {deskText(t, listing.drafts.map((draft) => (
            <li key={draft.draftRef} data-draft={draft.draftRef} data-state={draft.state} data-linked={draft.linkLine.startsWith(copy0.en["e.5"]) ? "true" : "false"}>
              <p>
                {deskText(t, draft.draftRef)}: {deskText(t, draft.stateLine)}
              </p>
              <p>{deskText(t, draft.grantLine)}</p>
              <p>{deskText(t, draft.linkLine)}</p>
            </li>
          )))}
        </ul>
      ) : (
        <p className="muted">{t("sv6")}</p>
      )}
    </li>
  );
}

export function BoardSection({ model }: { model: DelegationAssistantModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="dlg-board" className="discovery-section" aria-label={t("sr0")}>
      <h3>{t("sr0")}</h3>
      <p className="muted">
        {t("s1u2")}</p>
      {model.listings.length === 0 ? <p data-state="empty">{t("sw2")}</p> : null}
      {model.listings.length > 0 ? (
        <ul className="discovery-list" aria-label={t("sr6")}>
          {deskText(t, model.listings.map((listing) => (
            <ListingCard key={listing.listingRef} listing={listing} />
          )))}
        </ul>
      ) : null}
    </section>
  );
}

function ProposalCard({ proposal, actions }: { proposal: ProposalModel; actions: DelegationAssistantActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <li className="discovery-row" data-proposal={proposal.proposalRef} data-state={proposal.stateWord} data-provenance="synthetic">
      <h4>
        {deskText(t, proposal.proposalRef)}: {deskText(t, proposal.stepWord)} {t("s140")}{" "}{deskText(t, proposal.targetRef)}
      </h4>
      <p data-proposal-state={proposal.stateWord}>{deskText(t, proposal.stateWord)}{t("s64")}</p>
      <p>{deskText(t, proposal.detail)}</p>
      <GuardedButton
        id={`dlg-approve-${proposal.proposalRef}`}
        label={t("s5z", { proposalRef: proposal.proposalRef })}
        control={proposal.approve}
        onPress={() => actions.approve(proposal.proposalRef)}
      />
      <GuardedButton
        id={`dlg-dismiss-${proposal.proposalRef}`}
        label={t("sgw", { proposalRef: proposal.proposalRef })}
        control={proposal.dismiss}
        onPress={() => actions.dismiss(proposal.proposalRef)}
      />
    </li>
  );
}

export function ProposalsSection({ model, actions }: { model: DelegationAssistantModel; actions: DelegationAssistantActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="dlg-proposals" className="discovery-section" aria-label={t("s19i")}>
      <h3>{t("s1e1")}</h3>
      <p className="muted">
        {t("s14o")}</p>
      {model.proposals.length === 0 ? <p data-state="empty">{t("sx2")}</p> : null}
      {model.proposals.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s19k")}>
          {deskText(t, model.proposals.map((proposal) => (
            <ProposalCard key={proposal.proposalRef} proposal={proposal} actions={actions} />
          )))}
        </ul>
      ) : null}
    </section>
  );
}

function TurnRow({ turn }: { turn: TurnModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <li className="discovery-row" data-turn={turn.seq} data-kind={turn.kind} data-proposal={turn.proposalRef ?? "none"}>
      <h4>
        {t("s24s")}{" "}{deskText(t, turn.seq)}: {deskText(t, turn.kindWord)}
      </h4>
      <p>
        <q>{deskText(t, turn.excerpt)}</q>
      </p>
      <p>{deskText(t, turn.detail)}</p>
      {turn.lines.length > 0 ? (
        <ul>
          {deskText(t, turn.lines.map((line, index) => (
            <li key={index}>{deskText(t, line)}</li>
          )))}
        </ul>
      ) : null}
    </li>
  );
}

export function TurnsSection({ model }: { model: DelegationAssistantModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="dlg-turns" className="discovery-section" aria-label={t("s1fw")}>
      <h3>{t("s1fw")}</h3>
      <p className="muted">
        {t("si0")}</p>
      {model.turns.length === 0 ? <p data-state="empty">{t("sxt")}</p> : null}
      {model.turns.length > 0 ? (
        <ol className="discovery-list" aria-label={t("s24u")}>
          {deskText(t, model.turns.map((turn) => (
            <TurnRow key={turn.seq} turn={turn} />
          )))}
        </ol>
      ) : null}
    </section>
  );
}

function RejectionCard({ row, actions }: { row: RejectionModel; actions: DelegationAssistantActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <li className="discovery-row" data-rejection={row.intentRef} data-code={row.code} data-return-action={row.returnAction}>
      <h4>
        {deskText(t, row.stepWord)} {t("s1ex")}{deskText(t, row.code)})
      </h4>
      <p>{deskText(t, row.target)}</p>
      <p>{deskText(t, row.detail)}</p>
      <p>{deskText(t, row.returnLine)}</p>
      {row.returnAction === "read-again" ? (
        <button type="button" id={`dlg-return-${row.intentRef}`} className="discovery-action" onClick={() => actions.refresh()}>
          {t("s1ax")}</button>
      ) : null}
    </li>
  );
}

export function RejectionsSection({ model, actions }: { model: DelegationAssistantModel; actions: DelegationAssistantActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="dlg-rejections" className="discovery-section" aria-label={t("s1f0")}>
      <h3>{t("s1ez")}</h3>
      {model.rejections.length === 0 ? (
        <p data-state="empty">{t("s1zl")}</p>
      ) : (
        <ul className="discovery-list" aria-label={t("s1f1")}>
          {deskText(t, model.rejections.map((row) => (
            <RejectionCard key={row.intentRef} row={row} actions={actions} />
          )))}
        </ul>
      )}
    </section>
  );
}

export function SessionSection({ session }: { session: SessionModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="dlg-session" className="discovery-section" aria-label={t("s1js")}>
      <h3>{t("s1js")}</h3>
      <p>{deskText(t, session.contextLine)}</p>
      <p data-counters="true">{deskText(t, session.countersLine)}</p>
      {session.intents.length === 0 ? (
        <p data-state="empty">{t("s13b")}</p>
      ) : (
        <ScrollTable label={t("s273")}>
          <table className="dlg-register">
            <caption>{t("s274")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("soe")}</th>
                <th scope="col">{t("s1mn")}</th>
                <th scope="col">{t("s19g")}</th>
                <th scope="col">{t("smo")}</th>
                <th scope="col">{t("s1pe")}</th>
                <th scope="col">{t("s16g")}</th>
                <th scope="col">{t("error.fact.code")}</th>
              </tr>
            </thead>
            <tbody>
              {deskText(t, session.intents.map((intent) => (
                <tr key={intent.seq} data-intent={intent.intentRef} data-outcome={intent.outcome}>
                  <th scope="row">{deskText(t, intent.intentRef)}</th>
                  <td>{deskText(t, intent.stepWord)}</td>
                  <td>{deskText(t, intent.proposalRef)}</td>
                  <td>{deskText(t, intent.grantRef)}</td>
                  <td>{deskText(t, intent.targetRef)}</td>
                  <td>{deskText(t, intent.outcome)}</td>
                  <td>{deskText(t, intent.code)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </ScrollTable>
      )}
      {session.quarantineLines.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s1ao")}>
          {deskText(t, session.quarantineLines.map((line, index) => (
            <li key={index} data-quarantined="true">
              {deskText(t, line)}
            </li>
          )))}
        </ul>
      ) : null}
      {session.unlinkedLines.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s275")}>
          {deskText(t, session.unlinkedLines.map((line, index) => (
            <li key={index} data-unlinked="true">
              {deskText(t, line)}
            </li>
          )))}
        </ul>
      ) : null}
    </section>
  );
}

export function RegisterSection({ model }: { model: DelegationAssistantModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="dlg-register" className="discovery-section" aria-label={t("sec")}>
      <h3>{t("sec")}</h3>
      <p className="muted">
        {t("shv")}</p>
      <ScrollTable label={t("sfw")}>
        <table className="dlg-register">
          <caption>{t("sfx")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("sdf")}</th>
              <th scope="col">{t("sl1")}</th>
              <th scope="col">{t("s1mj")}</th>
              <th scope="col">{t("s1ab")}</th>
              <th scope="col">{t("s26n")}</th>
            </tr>
          </thead>
          <tbody>
            {deskText(t, model.register.map((row) => (
              <tr key={row.id} data-register-row={row.id} data-status={row.status}>
                <th scope="row">{deskText(t, row.id)}</th>
                <td>{deskText(t, row.field)}</td>
                <td>{deskText(t, row.statusWord)}</td>
                <td>{deskText(t, row.bodyFields)}</td>
                <td>{deskText(t, row.reason)}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </ScrollTable>
      <ul className="discovery-list" aria-label={t("sbo")}>
        {deskText(t, model.notComposed.map((row) => (
          <li key={row.action} data-not-sent={row.action}>
            {deskText(t, row.action)}: {deskText(t, row.reason)}
          </li>
        )))}
      </ul>
    </section>
  );
}
