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
  return (
    <span className="status-mark" data-status-mark="blocked">
      <span className="status-word">{word}</span>
    </span>
  );
}

/** A wide table scrolls inside its own region, so the page does not scroll sideways. */
function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="dlg-scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
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
        {label}
      </ConnectivityWriteButton>
      {control.reason ? (
        <p id={reasonId} className="muted" data-blocked-reason="true">
          <WordMark word="Blocked." /> {control.reason}
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
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">A language request inside the delegated scope</p>
      <h2>{DELEGATION_TITLE}</h2>
      {environment === "stub" ? (
        <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-delegation">
          SYNTHETIC. {DELEGATION_SOURCE_LINE}
        </p>
      ) : (
        <p className="discovery-banner" data-provenance="none" data-source="none">
          {DELEGATION_NOT_BOUND_BANNER}
        </p>
      )}
      <p>{DELEGATION_BOUNDARY}</p>
      <p data-non-claims="false">{DELEGATION_NON_CLAIM_NOTE}</p>
      <p data-interpreter="deterministic">{DELEGATION_TEXT_NOTE}</p>
      <p data-mode-record="source-owned">{DELEGATION_MODE_NOTE}</p>
      <p>{WORKSPACE_RULING}</p>
      <p data-hold-record="not-bound">{DELEGATION_HOLD_NOTE}</p>
      <p>{DELEGATION_ACTOR_NOTE}</p>
      <p>{DELEGATION_FENCE_NOTE}</p>
      <p>{DELEGATION_READ_NOTE}</p>
      <p data-policy-record="undetermined">{DELEGATION_TARGET_NOTE}</p>
      <p>{DELEGATION_SESSION_NOTE}</p>
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
  // The picker only chooses. Starting a session is its own button, so moving through the
  // list with the arrow keys resets nothing.
  const [picked, setPicked] = useState<DelegationScenario>(scenario);
  const simulated = environment === "stub";
  const simulateNote = simulated ? "dlg-simulate-note" : "dlg-scenario-off dlg-simulate-note";
  return (
    <section id="dlg-controls" className="discovery-section" aria-label="Synthetic controls">
      <div className="discovery-controls">
        <label htmlFor="dlg-scenario">
          Synthetic scenario
          <select id="dlg-scenario" value={picked} onChange={(event) => setPicked(event.target.value as DelegationScenario)}>
            {DELEGATION_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
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
          Start a session with this scenario
        </ConnectivityWriteButton>
        <button type="button" id="dlg-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          Read again
        </button>
        <button type="button" id="dlg-switch" className="discovery-action" onClick={() => actions.switchScope()}>
          Switch principal scope
        </button>
        <ConnectivityWriteButton type="button" id="dlg-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          Start a new synthetic session
        </ConnectivityWriteButton>
        <button
          type="button"
          id="dlg-deliver-held"
          className="discovery-action"
          aria-disabled={heldSupported ? undefined : true}
          aria-describedby="dlg-deliver-note"
          onClick={heldSupported ? () => actions.deliverHeld() : undefined}
        >
          Deliver held response
        </button>
      </div>
      {simulated ? (
        <p className="muted" data-scenario-note={scenario}>
          {SCENARIO_NOTES[scenario]} Changing the scenario starts a new synthetic session.
        </p>
      ) : (
        <p className="muted" id="dlg-scenario-off" data-blocked-reason="true" data-scenario-note="off">
          <WordMark word="Blocked." /> {DELEGATION_SCENARIO_OFF_NOTE}
        </p>
      )}
      <p className="muted" id="dlg-deliver-note" data-principal={principalRef}>
        Principal scope is {principalRef}. {DELEGATION_ALT_PRINCIPAL_NOTE} Start a new synthetic session clears every intent and proposal,
        as a reload does, and resolves nothing at a producer. Deliver held response works only in the held-response scenario.
      </p>
      <div className="discovery-controls" role="group" aria-label="Simulated producer events">
        {(Object.keys(CONTROL_LABELS) as (keyof typeof CONTROL_LABELS)[]).map((controlName) => (
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
            {CONTROL_LABELS[controlName]}
          </ConnectivityWriteButton>
        ))}
      </div>
      <p className="muted" id="dlg-simulate-note">
        A Simulate control stands in for an event a real producer would cause: a grant revoked, superseded, or expired, a budget used by
        another channel, a listing closed. This page does not see its effect until it reads, and a real producer offers no such control.
        None of them raises a mode, adopts an execution delegation, approves a proposal, or sends a command.
      </p>
    </section>
  );
}

export function AssistantStatus({ model }: { model: DelegationAssistantModel }) {
  return (
    <section id="dlg-status" className="discovery-section" tabIndex={-1} data-delegation-state={model.state}>
      <h3>Status</h3>
      <p role="status" data-delegation-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {model.statusLine}
        {model.detailLine ? ` ${model.detailLine}` : ""}
      </p>
      <p className="muted">{model.freshnessWord}</p>
      {model.lastLine ? (
        <p role="status" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word="Attention." /> : null} {model.lastLine}
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
  const [text, setText] = useState("");
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    actions.ask(text);
    setText("");
  };
  return (
    <section id="dlg-request" className="discovery-section" aria-label="Request">
      <h3>Ask the assistant</h3>
      <p className="muted">
        Type a question, a draft request, or a cancel request, naming the reference it applies to (for example:{" "}
        <code>draft an order for lst-0001</code> or <code>cancel draft drf-0001</code>). The words are intent, not authority. A proposal
        they produce is recorded and sends nothing until its own approve control is pressed.
      </p>
      <ValidatedForm id="assistant-request-form" fields={[field("dlg-request-text", "validation.label.request")]} onSubmit={onSubmit} className="discovery-controls">
        <label htmlFor="dlg-request-text">
          Request text
          <input
            id="dlg-request-text"
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            autoComplete="off"
            aria-describedby="dlg-request-note"
          />
        </label>
        <ConnectivityWriteButton type="submit" id="dlg-ask" className="discovery-action">
          Ask
        </ConnectivityWriteButton>
      </ValidatedForm>
      <p className="muted" id="dlg-request-note">
        Instruction-like words refuse the whole request. A sentence can never approve a proposal, send a command, raise a mode, or create
        a grant.
      </p>
    </section>
  );
}

export function LanesSection({ model }: { model: DelegationAssistantModel }) {
  return (
    <section id="dlg-lanes" className="discovery-section" aria-label="The four lanes">
      <h3>Query, proposal, approval, command</h3>
      <p className="muted">Four separate lines. None of them is a summary of the others, and no line says a goal is done.</p>
      <ol className="discovery-list" aria-label="Assistant lanes">
        {model.lanes.map((lane) => (
          <li key={lane.lane} className="discovery-row" data-lane={lane.lane} data-count={lane.count === null ? "none" : String(lane.count)}>
            <h4>{lane.label}</h4>
            <p>{lane.line}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function GrantCard({ grant }: { grant: GrantModel }) {
  return (
    <li className="discovery-row" data-grant={grant.grantRef} data-provenance="synthetic" data-source="synthetic-delegation">
      <p>
        <span className="discovery-badge" data-provenance="synthetic">
          SYNTHETIC
        </span>{" "}
        <span className="discovery-badge">{grant.grantRef}</span>
      </p>
      <p>{grant.scopeLine}</p>
      <p>{grant.targetLine}</p>
      <p>{grant.deadlineLine}</p>
      <p data-budget-line="source">{grant.budgetLine}</p>
      <p>{grant.actionsLine}</p>
      <p data-mode={grant.grantRef}>{grant.modeLine}</p>
      <p>{grant.versionLine}</p>
      <p>{grant.stateLine}</p>
    </li>
  );
}

export function GrantsSection({ model }: { model: DelegationAssistantModel }) {
  return (
    <section id="dlg-grants" className="discovery-section" aria-label="Grants">
      <h3>Delegation grants</h3>
      <p className="muted">
        A grant is the source's own record of scope, deadline, target, budget, allowed actions, and the requested and adopted modes. This
        page copies them and decides none of them.
      </p>
      {model.grants.length === 0 ? <p data-state="empty">No grant is listed in this read.</p> : null}
      {model.grants.length > 0 ? (
        <ul className="discovery-list" aria-label="Grants in the last read">
          {model.grants.map((grant) => (
            <GrantCard key={grant.grantRef} grant={grant} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ListingCard({ listing }: { listing: ListingModel }) {
  return (
    <li className="discovery-row" data-listing={listing.listingRef} data-state={listing.state} data-source="synthetic-delegation">
      <h4>
        {listing.title} ({listing.listingRef})
      </h4>
      <p>
        Under {listing.eventRef}. {listing.tierLine}
      </p>
      <p>{listing.stateLine}</p>
      {listing.drafts.length > 0 ? (
        <ul className="discovery-list" aria-label={`Drafts on ${listing.listingRef}`}>
          {listing.drafts.map((draft) => (
            <li key={draft.draftRef} data-draft={draft.draftRef} data-state={draft.state} data-linked={draft.linkLine.startsWith("Named") ? "true" : "false"}>
              <p>
                {draft.draftRef}: {draft.stateLine}
              </p>
              <p>{draft.grantLine}</p>
              <p>{draft.linkLine}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No draft on this listing in the last read.</p>
      )}
    </li>
  );
}

export function BoardSection({ model }: { model: DelegationAssistantModel }) {
  return (
    <section id="dlg-board" className="discovery-section" aria-label="Listing board">
      <h3>Listing board</h3>
      <p className="muted">
        The listings the last read reported. Only a listing under a grant's target event is in scope, and the assistant never searches for
        or infers a grant.
      </p>
      {model.listings.length === 0 ? <p data-state="empty">No listing is listed in this read.</p> : null}
      {model.listings.length > 0 ? (
        <ul className="discovery-list" aria-label="Listings in the last read">
          {model.listings.map((listing) => (
            <ListingCard key={listing.listingRef} listing={listing} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ProposalCard({ proposal, actions }: { proposal: ProposalModel; actions: DelegationAssistantActions }) {
  return (
    <li className="discovery-row" data-proposal={proposal.proposalRef} data-state={proposal.stateWord} data-provenance="synthetic">
      <h4>
        {proposal.proposalRef}: {proposal.stepWord} on {proposal.targetRef}
      </h4>
      <p data-proposal-state={proposal.stateWord}>{proposal.stateWord}. A proposal is the page's own record. It is not an approval, and it sends nothing on its own.</p>
      <p>{proposal.detail}</p>
      <GuardedButton
        id={`dlg-approve-${proposal.proposalRef}`}
        label={`Approve ${proposal.proposalRef}`}
        control={proposal.approve}
        onPress={() => actions.approve(proposal.proposalRef)}
      />
      <GuardedButton
        id={`dlg-dismiss-${proposal.proposalRef}`}
        label={`Dismiss ${proposal.proposalRef}`}
        control={proposal.dismiss}
        onPress={() => actions.dismiss(proposal.proposalRef)}
      />
    </li>
  );
}

export function ProposalsSection({ model, actions }: { model: DelegationAssistantModel; actions: DelegationAssistantActions }) {
  return (
    <section id="dlg-proposals" className="discovery-section" aria-label="Proposals">
      <h3>Recorded proposals</h3>
      <p className="muted">
        Only a recorded open proposal can be approved. The approve control is the approval — a sentence is not — and an approval sends one
        synthetic command once, under the grant that covers the target. A dismissed proposal can never be approved.
      </p>
      {model.proposals.length === 0 ? <p data-state="empty">No proposal is recorded in this session.</p> : null}
      {model.proposals.length > 0 ? (
        <ul className="discovery-list" aria-label="Proposals in this session">
          {model.proposals.map((proposal) => (
            <ProposalCard key={proposal.proposalRef} proposal={proposal} actions={actions} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function TurnRow({ turn }: { turn: TurnModel }) {
  return (
    <li className="discovery-row" data-turn={turn.seq} data-kind={turn.kind} data-proposal={turn.proposalRef ?? "none"}>
      <h4>
        Turn {turn.seq}: {turn.kindWord}
      </h4>
      <p>
        <q>{turn.excerpt}</q>
      </p>
      <p>{turn.detail}</p>
      {turn.lines.length > 0 ? (
        <ul>
          {turn.lines.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function TurnsSection({ model }: { model: DelegationAssistantModel }) {
  return (
    <section id="dlg-turns" className="discovery-section" aria-label="Requests and turns">
      <h3>Requests and turns</h3>
      <p className="muted">
        Each request is kept as the page's own record with the first 160 characters it carried. A refused or clarified request produced no
        proposal and sent nothing.
      </p>
      {model.turns.length === 0 ? <p data-state="empty">No request was made in this session.</p> : null}
      {model.turns.length > 0 ? (
        <ol className="discovery-list" aria-label="Turns in this session">
          {model.turns.map((turn) => (
            <TurnRow key={turn.seq} turn={turn} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function RejectionCard({ row, actions }: { row: RejectionModel; actions: DelegationAssistantActions }) {
  return (
    <li className="discovery-row" data-rejection={row.intentRef} data-code={row.code} data-return-action={row.returnAction}>
      <h4>
        {row.stepWord} rejected ({row.code})
      </h4>
      <p>{row.target}</p>
      <p>{row.detail}</p>
      <p>{row.returnLine}</p>
      {row.returnAction === "read-again" ? (
        <button type="button" id={`dlg-return-${row.intentRef}`} className="discovery-action" onClick={() => actions.refresh()}>
          Read again
        </button>
      ) : null}
    </li>
  );
}

export function RejectionsSection({ model, actions }: { model: DelegationAssistantModel; actions: DelegationAssistantActions }) {
  return (
    <section id="dlg-rejections" className="discovery-section" aria-label="Rejections">
      <h3>Rejected by the source</h3>
      {model.rejections.length === 0 ? (
        <p data-state="empty">The source has rejected no write of this page in this session.</p>
      ) : (
        <ul className="discovery-list" aria-label="Rejections in this session">
          {model.rejections.map((row) => (
            <RejectionCard key={row.intentRef} row={row} actions={actions} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function SessionSection({ session }: { session: SessionModel }) {
  return (
    <section id="dlg-session" className="discovery-section" aria-label="Session record">
      <h3>Session record</h3>
      <p>{session.contextLine}</p>
      <p data-counters="true">{session.countersLine}</p>
      {session.intents.length === 0 ? (
        <p data-state="empty">No write was sent in this session.</p>
      ) : (
        <ScrollTable label="Writes sent in this session">
          <table className="dlg-register">
            <caption>Writes this page sent, each once, each with its own intent reference</caption>
            <thead>
              <tr>
                <th scope="col">Intent</th>
                <th scope="col">Step</th>
                <th scope="col">Proposal</th>
                <th scope="col">Grant</th>
                <th scope="col">Target</th>
                <th scope="col">Outcome</th>
                <th scope="col">Code</th>
              </tr>
            </thead>
            <tbody>
              {session.intents.map((intent) => (
                <tr key={intent.seq} data-intent={intent.intentRef} data-outcome={intent.outcome}>
                  <th scope="row">{intent.intentRef}</th>
                  <td>{intent.stepWord}</td>
                  <td>{intent.proposalRef}</td>
                  <td>{intent.grantRef}</td>
                  <td>{intent.targetRef}</td>
                  <td>{intent.outcome}</td>
                  <td>{intent.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      )}
      {session.quarantineLines.length > 0 ? (
        <ul className="discovery-list" aria-label="Quarantined results">
          {session.quarantineLines.map((line, index) => (
            <li key={index} data-quarantined="true">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      {session.unlinkedLines.length > 0 ? (
        <ul className="discovery-list" aria-label="Writes with no known result">
          {session.unlinkedLines.map((line, index) => (
            <li key={index} data-unlinked="true">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function RegisterSection({ model }: { model: DelegationAssistantModel }) {
  return (
    <section id="dlg-register" className="discovery-section" aria-label="Contract register">
      <h3>Contract register</h3>
      <p className="muted">
        Each delegation concept against the pinned contract-only catalogue. A named field is not a bound one, and no row here invents a
        field the catalogue does not publish.
      </p>
      <ScrollTable label="Delegation concepts and the pin">
        <table className="dlg-register">
          <caption>Delegation concepts and the pinned catalogue</caption>
          <thead>
            <tr>
              <th scope="col">Concept</th>
              <th scope="col">Field</th>
              <th scope="col">Status</th>
              <th scope="col">Published body fields</th>
              <th scope="col">Why</th>
            </tr>
          </thead>
          <tbody>
            {model.register.map((row) => (
              <tr key={row.id} data-register-row={row.id} data-status={row.status}>
                <th scope="row">{row.id}</th>
                <td>{row.field}</td>
                <td>{row.statusWord}</td>
                <td>{row.bodyFields}</td>
                <td>{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
      <ul className="discovery-list" aria-label="Catalogue commands this page never sends">
        {model.notComposed.map((row) => (
          <li key={row.action} data-not-sent={row.action}>
            {row.action}: {row.reason}
          </li>
        ))}
      </ul>
    </section>
  );
}
