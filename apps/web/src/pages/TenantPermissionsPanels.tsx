import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { useEffect, useState, type ReactNode } from "react";
import {
  TENANT_ACTORS,
  TENANT_FOREIGN,
  TENANT_OWN,
  TENANT_ROLES,
  TENANT_SCENARIOS,
  type TenantRole,
  type TenantScenario,
} from "@kix/protocol-adapter";
import { StatusMark } from "../a11y/marks";
import {
  SCENARIO_NOTES,
  TENANT_ACTOR_NOTE,
  TENANT_BOUNDARY,
  TENANT_CLAIM_NOTE,
  TENANT_EXPORT_NOTE,
  TENANT_HIDE_NOTE,
  TENANT_MAKER_NOTE,
  TENANT_PAGE_TITLE,
  TENANT_READ_NOTE,
  TENANT_ROLE_NOTE,
  TENANT_SCOPE_NOTE,
  TENANT_SESSION_NOTE,
  TENANT_SOURCE_LINE,
  TENANT_SYNTHETIC_CONTROL_NOTE,
  type ControlModel,
  type TenantActions,
  type TenantModel,
  type TenantSessionModel,
} from "../tenant-permissions";
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
    <div className="finance-scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

/**
 * A control that is off stays focusable and says why. A native disabled button is
 * skipped by the keyboard, so its reason would never be reached. When many controls share
 * one reason, the page prints it once and each control points at it.
 */
function GuardedButton({
  id,
  label,
  control,
  describedBy,
  onPress,
}: {
  id: string;
  label: string;
  control: ControlModel;
  /** The id of a paragraph that holds the shared reason. Without it the reason is printed here. */
  describedBy?: string;
  onPress: () => void;
}) {
  const reasonId = `${id}-reason`;
  const pointer = control.reason ? (describedBy ?? reasonId) : undefined;
  return (
    <>
      <ConnectivityWriteButton inspection={id === "tenant-export"}
        type="button"
        id={id}
        className="discovery-action"
        aria-disabled={control.enabled ? undefined : true}
        aria-describedby={pointer}
        data-enabled={control.enabled ? "true" : "false"}
        onClick={control.enabled ? onPress : undefined}
      >
        {label}
      </ConnectivityWriteButton>
      {control.reason && describedBy === undefined ? (
        <p id={reasonId} className="muted" data-blocked-reason="true">
          <WordMark word="Blocked." /> {control.reason}
        </p>
      ) : null}
    </>
  );
}

function Synthetic() {
  return (
    <span className="discovery-badge" data-provenance="synthetic">
      SYNTHETIC
    </span>
  );
}

export function TenantBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: TenantScenario;
  model: TenantModel;
}) {
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">Tenant permissions</p>
      <h2>{TENANT_PAGE_TITLE}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-tenant-permissions">
        SYNTHETIC. {TENANT_SOURCE_LINE}
      </p>
      <p>{TENANT_BOUNDARY}</p>
      <p data-hide-note="true">{TENANT_HIDE_NOTE}</p>
      <p>{TENANT_CLAIM_NOTE}</p>
      <p>{TENANT_MAKER_NOTE}</p>
      <p>{TENANT_ROLE_NOTE}</p>
      <p>{TENANT_EXPORT_NOTE}</p>
      <p>{TENANT_SCOPE_NOTE}</p>
      <p>{TENANT_ACTOR_NOTE}</p>
      <p>{TENANT_READ_NOTE}</p>
      <p>{TENANT_SESSION_NOTE}</p>
      <p>{WORKSPACE_RULING}</p>
      <p data-hold-record="not-bound">{model.session.holdLine}</p>
      <p data-not-composed="recorded">{model.session.notComposedLine}</p>
    </header>
  );
}

/**
 * A choice that applies only when asked. Moving through a list with the arrow keys changes
 * nothing, so a keyboard user does not reset the session once per option.
 */
function PickAndApply({
  id,
  label,
  value,
  options,
  applyId,
  applyLabel,
  onApply,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  applyId: string;
  applyLabel: string;
  onApply: (next: string) => void;
}) {
  const [choice, setChoice] = useState(value);
  useEffect(() => {
    setChoice(value);
  }, [value]);
  return (
    <>
      <label htmlFor={id}>
        {label}
        <select id={id} value={choice} onChange={(event) => setChoice(event.target.value)}>
          {options.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <button type="button" id={applyId} className="discovery-action" onClick={() => onApply(choice)}>
        {applyLabel}
      </button>
    </>
  );
}

export function TenantControls({
  scenario,
  actorRef,
  role,
  model,
  actions,
}: {
  scenario: TenantScenario;
  actorRef: string;
  role: TenantRole;
  model: TenantModel;
  actions: TenantActions;
}) {
  const [focusText, setFocusText] = useState("");
  return (
    <section id="tenant-controls" className="discovery-section" aria-label="Synthetic controls">
      <div className="discovery-controls">
        <PickAndApply
          id="tenant-scenario"
          label="Synthetic scenario"
          value={scenario}
          options={TENANT_SCENARIOS}
          applyId="tenant-apply-scenario"
          applyLabel="Start a session with this scenario"
          onApply={(next) => actions.setScenario(next as TenantScenario)}
        />
        <PickAndApply
          id="tenant-actor"
          label="Desk actor"
          value={actorRef}
          options={TENANT_ACTORS}
          applyId="tenant-apply-actor"
          applyLabel="Switch to this actor"
          onApply={(next) => actions.switchActor(next)}
        />
        <PickAndApply
          id="tenant-role"
          label="Role for this actor"
          value={role}
          options={TENANT_ROLES}
          applyId="tenant-apply-role"
          applyLabel="Switch to this role"
          onApply={(next) => actions.switchRole(next as TenantRole)}
        />
        <button type="button" id="tenant-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          Read again
        </button>
        <button type="button" id="tenant-switch-tenant" className="discovery-action" onClick={() => actions.switchTenant()}>
          Switch tenant ({TENANT_OWN} / {TENANT_FOREIGN})
        </button>
        <GuardedButton id="tenant-export" label="Load the sensitive export" control={model.exportControl} onPress={() => actions.loadExport()} />
        <ConnectivityWriteButton type="button" id="tenant-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          Start a new synthetic session
        </ConnectivityWriteButton>
      </div>
      <div className="discovery-controls" role="group" aria-label="Direct open by reference">
        <label htmlFor="tenant-focus-ref">
          Open a resource by reference
          <input
            id="tenant-focus-ref"
            name="tenant-focus-ref"
            autoComplete="off"
            placeholder="evn-0001, acc-0001, tck-0001…"
            value={focusText}
            onChange={(event) => setFocusText(event.target.value)}
          />
        </label>
        <button type="button" id="tenant-open-ref" className="discovery-action" onClick={() => actions.openResource(focusText)}>
          Open this resource
        </button>
      </div>
      <p className="muted">
        A pasted reference is a direct open, like a typed URL. The source answers a ref outside this role&apos;s kinds or outside
        this tenant with denied — never a row of another tenant, never a row of another subject.
      </p>
      <p className="muted" data-scenario-note={scenario}>
        {SCENARIO_NOTES[scenario]} Choosing a scenario does nothing until you start a session with it, and starting one clears earlier reads, exports, and requests.
      </p>
      <p className="muted">{TENANT_SYNTHETIC_CONTROL_NOTE}</p>
    </section>
  );
}

export function TenantStatus({ model }: { model: TenantModel }) {
  return (
    <section id="tenant-status" className="discovery-section" tabIndex={-1} data-tenant-state={model.state}>
      <h3>Status</h3>
      <p role="status" data-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {model.statusLine}
        {model.detailLine ? ` ${model.detailLine}` : ""}
      </p>
      <p className="muted">{model.freshnessWord}</p>
      <p className="muted">{model.scopeLine}</p>
      <p className="muted">{model.generationLine}</p>
      <p className="muted">{model.watermarkLine}</p>
      <p className="muted" data-workspace-line="true">
        {model.workspaceLine}
      </p>
      {model.lastLine ? (
        <p role="status" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word="Attention." /> : null} {model.lastLine}
        </p>
      ) : null}
    </section>
  );
}

export function TenantAuthoritySection({ model }: { model: TenantModel }) {
  return (
    <section id="tenant-authority" className="discovery-section" aria-label="Who may do what">
      <h3>Who may do what</h3>
      <p className="muted">
        Read-own, read-tenant, and read-audit stay separate, and each proposal and the approval keep their own capability. The
        export is a separate grant from the read. No role here holds them all.
      </p>
      <ScrollTable label="Capabilities and the roles that hold them">
        <table className="finance-authority">
          <caption>The source&apos;s capabilities on this desk</caption>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              <th scope="col">Held by</th>
            </tr>
          </thead>
          <tbody>
            {model.authority.map((row) => (
              <tr key={row.capability} data-capability={row.capability} data-held-by-role={row.heldByRole ? "true" : "false"}>
                <th scope="row">{row.capability}</th>
                <td>
                  {row.heldByLine}
                  {row.heldByRole ? " The role on screen holds it." : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
    </section>
  );
}

export function TenantFocusSection({ model }: { model: TenantModel }) {
  if (model.focus === null) {
    return null;
  }
  return (
    <section id="tenant-focus" className="discovery-section" aria-label="Deep-opened resource" data-focus-kind={model.focus.kind}>
      <h3>{model.focus.title}</h3>
      {model.focus.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </section>
  );
}

/** The note the person typed, as text. The source bounds it; nothing here parses it. */
function noteValue(): string {
  if (typeof document === "undefined") {
    return "";
  }
  const node = document.getElementById("tenant-note");
  return node instanceof HTMLInputElement ? node.value : "";
}

export function TenantWorkspaceSection({ model, actions }: { model: TenantModel; actions: TenantActions }) {
  return (
    <section id="tenant-workspace" className="discovery-section" aria-label="Role workspace">
      <h3>Role workspace</h3>
      <div className="discovery-controls">
        <label htmlFor="tenant-note">
          Note for a proposal
          <input id="tenant-note" name="tenant-note" autoComplete="off" defaultValue="Reviewed against the last read." />
        </label>
      </div>
      {model.accountBlock ? (
        <p id="tenant-account-reason" className="muted" data-blocked-reason="true" data-block="account-change">
          <WordMark word="Blocked." /> Account changes are off: {model.accountBlock}
        </p>
      ) : null}
      {model.revokeBlock ? (
        <p id="tenant-revoke-reason" className="muted" data-blocked-reason="true" data-block="role-revoke">
          <WordMark word="Blocked." /> Role revokes are off: {model.revokeBlock}
        </p>
      ) : null}

      {model.members.length > 0 ? (
        <>
          <h4>Members</h4>
          <ScrollTable label="Memberships in the last read">
            <table className="finance-cuts">
              <caption>Role assignments the read listed</caption>
              <thead>
                <tr>
                  <th scope="col">Membership</th>
                  <th scope="col">Person</th>
                  <th scope="col">Role</th>
                  <th scope="col">Generation</th>
                  <th scope="col">State</th>
                  <th scope="col">Propose a revoke</th>
                </tr>
              </thead>
              <tbody>
                {model.members.map((row) => (
                  <tr key={row.memberRef} data-member={row.memberRef} data-member-state={row.state}>
                    <th scope="row">{row.memberRef}</th>
                    <td>{row.actorRef}</td>
                    <td>{row.role}</td>
                    <td>{row.generation}</td>
                    <td>{row.stateWord}</td>
                    <td>
                      {row.proposeRevoke === null ? (
                        <span className="muted">No revoke control for this role.</span>
                      ) : (
                        <GuardedButton
                          id={`tenant-revoke-${row.memberRef}`}
                          label={`Propose revoking ${row.memberRef}`}
                          control={row.proposeRevoke}
                          describedBy={model.revokeBlock ? "tenant-revoke-reason" : undefined}
                          onPress={() => actions.proposeRoleRevoke(row.memberRef, noteValue())}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        </>
      ) : null}

      {model.orders.length > 0 ? (
        <>
          <h4>Orders</h4>
          <ul className="discovery-list" aria-label="Orders in the last read">
            {model.orders.map((row) => (
              <li key={row.orderRef} data-order={row.orderRef} data-order-state={row.state}>
                <Synthetic /> <strong>{row.orderRef}</strong> {row.label}. Subject {row.subjectRef}. Event {row.eventRef}. {row.state}.
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {model.events.length > 0 ? (
        <>
          <h4>Events</h4>
          <ul className="discovery-list" aria-label="Events in the last read">
            {model.events.map((row) => (
              <li key={row.eventRef} data-event={row.eventRef} data-event-state={row.state}>
                <Synthetic /> <strong>{row.eventRef}</strong> {row.title}. {row.state}.
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {model.accounts.length > 0 ? (
        <>
          <h4>Settlement accounts</h4>
          <ul className="discovery-list" aria-label="Accounts in the last read">
            {model.accounts.map((row) => (
              <li key={row.accountRef} data-account={row.accountRef} data-account-state={row.state}>
                <Synthetic /> <strong>{row.accountRef}</strong> {row.label}. {row.tailLine} {row.stateWord}.
                <br />
                {row.proposeChange === null ? null : (
                  <GuardedButton
                    id={`tenant-account-${row.accountRef}`}
                    label={`Propose an account change on ${row.accountRef}`}
                    control={row.proposeChange}
                    describedBy={model.accountBlock ? "tenant-account-reason" : undefined}
                    onPress={() => actions.proposeAccountChange(row.accountRef, noteValue())}
                  />
                )}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {model.cases.length > 0 ? (
        <>
          <h4>Support cases</h4>
          <ul className="discovery-list" aria-label="Cases in the last read">
            {model.cases.map((row) => (
              <li key={row.caseRef} data-case={row.caseRef} data-case-state={row.state}>
                <Synthetic /> <strong>{row.caseRef}</strong> {row.topic}. Subject {row.subjectRef}. {row.state}.
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {model.members.length === 0 &&
      model.orders.length === 0 &&
      model.events.length === 0 &&
      model.accounts.length === 0 &&
      model.cases.length === 0 ? (
        <p data-state="empty">This role&apos;s workspace lists no row in this read.</p>
      ) : null}
    </section>
  );
}

export function TenantProposalsSection({ model, actions }: { model: TenantModel; actions: TenantActions }) {
  return (
    <section id="tenant-proposals" className="discovery-section" aria-label="Proposals" data-proposal-count={model.proposals.length}>
      <h3>Proposals</h3>
      <p className="muted">
        A change is a proposal, and a different actor approves it. The same person&apos;s second role is not a different actor.
        Recorded is not applied: the target row changes only when the source applies it.
      </p>
      {model.approveBlock ? (
        <p id="tenant-approve-reason" className="muted" data-blocked-reason="true" data-block="approve">
          <WordMark word="Blocked." /> Approvals are off: {model.approveBlock}
        </p>
      ) : null}
      {model.proposals.length === 0 ? <p data-state="empty">No proposal in this read.</p> : null}
      {model.proposals.length > 0 ? (
        <ul className="discovery-list" aria-label="Proposals in the last read">
          {model.proposals.map((proposal) => (
            <li key={proposal.proposalRef} data-proposal={proposal.proposalRef} data-proposal-state={proposal.state}>
              <Synthetic /> <strong>{proposal.proposalRef}</strong> {proposal.kindWord} on {proposal.targetRef}.{" "}
              {proposal.proposedLine} {proposal.stateWord}. Note: {proposal.note}
              <br />
              <GuardedButton
                id={`tenant-approve-${proposal.proposalRef}`}
                label={`Record an approval of ${proposal.proposalRef}`}
                control={proposal.approve}
                describedBy={model.approveBlock ? "tenant-approve-reason" : undefined}
                onPress={() => actions.approveProposal(proposal.proposalRef)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function TenantAuditSection({ model }: { model: TenantModel }) {
  return (
    <section id="tenant-audit" className="discovery-section" aria-label="Audit record" data-audit-count={model.audit.length}>
      <h3>Audit record</h3>
      <p className="muted">
        The source&apos;s own record of the decisions it made on calls in this tenant. Only a role that holds read-audit sees it,
        and it is not a complete record.
      </p>
      {model.audit.length === 0 ? <p data-state="empty">No audit entry in this read, or this role may not read them.</p> : null}
      {model.audit.length > 0 ? (
        <ScrollTable label="Audit entries in the last read">
          <table className="finance-cuts">
            <caption>Decisions the source recorded</caption>
            <thead>
              <tr>
                <th scope="col">Entry</th>
                <th scope="col">Actor</th>
                <th scope="col">Role</th>
                <th scope="col">Action</th>
                <th scope="col">Target</th>
                <th scope="col">Decision</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              {model.audit.map((row) => (
                <tr key={row.auditRef} data-audit={row.auditRef} data-audit-decision={row.decision}>
                  <th scope="row">
                    {row.auditRef} (seq {row.seq})
                  </th>
                  <td>{row.actorRef}</td>
                  <td>{row.role}</td>
                  <td>{row.action}</td>
                  <td>{row.targetRef ?? "—"}</td>
                  <td>{row.decision}</td>
                  <td>{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      ) : null}
    </section>
  );
}

export function TenantExportSection({ model }: { model: TenantModel }) {
  const exported = model.export;
  return (
    <section id="tenant-export-panel" className="discovery-section" aria-label="Sensitive export" data-export-phase={exported.phase}>
      <h3>Sensitive export</h3>
      <p data-export-status={exported.phase}>{exported.statusLine}</p>
      {exported.detailLine ? <p className="muted">{exported.detailLine}</p> : null}
      {exported.verdictLines.map((line) => (
        <p key={line} data-export-verdict={exported.verdictWord}>
          {exported.verdictWord === "withheld" ? <WordMark word="Withheld." /> : null} {line}
        </p>
      ))}
      {exported.scopeLine ? <p className="muted" data-export-scope="declared">{exported.scopeLine}</p> : null}
      {exported.exportRef ? <p className="muted">Export {exported.exportRef}.</p> : null}
      {exported.rowsLine ? <p className="muted">{exported.rowsLine}</p> : null}
      {exported.rows.length > 0 ? (
        <ScrollTable label="Export rows">
          <table className="finance-cuts">
            <caption>Rows of the sensitive export, withheld unless it is the current export of the last read</caption>
            <thead>
              <tr>
                <th scope="col">Entry</th>
                <th scope="col">Kind</th>
                <th scope="col">Label</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              {exported.rows.map((row) => (
                <tr key={row.entryRef} data-export-row={row.entryRef}>
                  <th scope="row">{row.entryRef}</th>
                  <td>{row.kindWord}</td>
                  <td>{row.label}</td>
                  <td>{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      ) : null}
      <p className="muted">{TENANT_EXPORT_NOTE}</p>
    </section>
  );
}

export function TenantRequestsSection({ model }: { model: TenantModel }) {
  return (
    <section id="tenant-requests" className="discovery-section" aria-label="Requests">
      <h3>Requests</h3>
      {model.behindLine ? <p data-behind="true">{model.behindLine}</p> : null}
      {model.fenceLine ? (
        <p data-fence="true">
          <WordMark word="Fenced." /> {model.fenceLine}
        </p>
      ) : null}
      {model.request === null ? <p data-state="empty">No request has been sent from this session.</p> : null}
      {model.request !== null ? (
        <div data-request-seq={model.request.seq} data-request-phase={model.request.phase}>
          <p>
            Request {model.request.seq}: {model.request.kindWord}. {model.request.phaseWord}
            {model.request.code ? ` (${model.request.code})` : ""}.
          </p>
          {model.request.detail ? <p className="muted">{model.request.detail}</p> : null}
          {model.request.receiptLines.map((line) => (
            <p key={line} className="muted">
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function TenantSessionSection({ session }: { session: TenantSessionModel }) {
  return (
    <section id="tenant-session" className="discovery-section" aria-label="Session record">
      <h3>Session record</h3>
      <p className="muted">{session.contextLine}</p>
      <p className="muted">{session.capabilityLine}</p>
      <p className="muted">{session.countersLine}</p>
      <p className="muted">{session.earlierUnknownLine}</p>
      <p className="muted" data-hold-record="not-bound">{session.holdLine}</p>
      <p className="muted" data-not-composed="recorded">{session.notComposedLine}</p>
    </section>
  );
}
