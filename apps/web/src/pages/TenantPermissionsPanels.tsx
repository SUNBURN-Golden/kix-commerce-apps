import { messages as copy0 } from "../i18n/messages/pages--TenantPermissionsPanels";
import { messages as copy1 } from "../i18n/messages/tenant-permissions";
import { messages as copy2 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
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
    <div className="finance-scroll" role="region" aria-label={deskText(t, label)} tabIndex={0}>
      {deskText(t, children)}
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
  const t = useT(copy0, copy1, copy2);
  const reasonId = `${id}-reason`;
  const pointer = control.reason ? (describedBy ?? reasonId) : undefined;
  return (
    <>
      <button
        type="button"
        id={id}
        className="discovery-action"
        aria-disabled={control.enabled ? undefined : true}
        aria-describedby={pointer}
        data-enabled={control.enabled ? "true" : "false"}
        onClick={control.enabled ? onPress : undefined}
      >
        {deskText(t, label)}
      </button>
      {control.reason && describedBy === undefined ? (
        <p id={reasonId} className="muted" data-blocked-reason="true">
          <WordMark word={t("status.transport.blocked")} /> {deskText(t, control.reason)}
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
  const t = useT(copy0, copy1, copy2);
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">{t("s1ph")}</p>
      <h2>{deskText(t, TENANT_PAGE_TITLE)}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-tenant-permissions">
        SYNTHETIC. {deskText(t, TENANT_SOURCE_LINE)}
      </p>
      <p>{deskText(t, TENANT_BOUNDARY)}</p>
      <p data-hide-note="true">{deskText(t, TENANT_HIDE_NOTE)}</p>
      <p>{deskText(t, TENANT_CLAIM_NOTE)}</p>
      <p>{deskText(t, TENANT_MAKER_NOTE)}</p>
      <p>{deskText(t, TENANT_ROLE_NOTE)}</p>
      <p>{deskText(t, TENANT_EXPORT_NOTE)}</p>
      <p>{deskText(t, TENANT_SCOPE_NOTE)}</p>
      <p>{deskText(t, TENANT_ACTOR_NOTE)}</p>
      <p>{deskText(t, TENANT_READ_NOTE)}</p>
      <p>{deskText(t, TENANT_SESSION_NOTE)}</p>
      <p>{deskText(t, WORKSPACE_RULING)}</p>
      <p data-hold-record="not-bound">{deskText(t, model.session.holdLine)}</p>
      <p data-not-composed="recorded">{deskText(t, model.session.notComposedLine)}</p>
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
  const t = useT(copy0, copy1, copy2);
  const [choice, setChoice] = useState(value);
  useEffect(() => {
    setChoice(value);
  }, [value]);
  return (
    <>
      <label htmlFor={id}>
        {deskText(t, label)}
        <select id={id} value={choice} onChange={(event) => setChoice(event.target.value)}>
          {deskText(t, options.map((item) => (
            <option key={item} value={item}>
              {deskText(t, item)}
            </option>
          )))}
        </select>
      </label>
      <button type="button" id={applyId} className="discovery-action" onClick={() => onApply(choice)}>
        {deskText(t, applyLabel)}
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
  const t = useT(copy0, copy1, copy2);
  const [focusText, setFocusText] = useState("");
  return (
    <section id="tenant-controls" className="discovery-section" aria-label={t("s1o9")}>
      <div className="discovery-controls">
        <PickAndApply
          id="tenant-scenario"
          label={t("s1p5")}
          value={scenario}
          options={TENANT_SCENARIOS}
          applyId="tenant-apply-scenario"
          applyLabel={t("s1m5")}
          onApply={(next) => actions.setScenario(next as TenantScenario)}
        />
        <PickAndApply
          id="tenant-actor"
          label={t("sgd")}
          value={actorRef}
          options={TENANT_ACTORS}
          applyId="tenant-apply-actor"
          applyLabel={t("s1o6")}
          onApply={(next) => actions.switchActor(next)}
        />
        <PickAndApply
          id="tenant-role"
          label={t("s1hg")}
          value={role}
          options={TENANT_ROLES}
          applyId="tenant-apply-role"
          applyLabel={t("s1o7")}
          onApply={(next) => actions.switchRole(next as TenantRole)}
        />
        <button type="button" id="tenant-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          {t("s1ax")}</button>
        <button type="button" id="tenant-switch-tenant" className="discovery-action" onClick={() => actions.switchTenant()}>
          {t("s1o3")}{deskText(t, TENANT_OWN)} / {deskText(t, TENANT_FOREIGN)})
        </button>
        <GuardedButton id="tenant-export" label={t("srg")} control={model.exportControl} onPress={() => actions.loadExport()} />
        <button type="button" id="tenant-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          {t("s1m2")}</button>
      </div>
      <div className="discovery-controls" role="group" aria-label={t("sgn")}>
        <label htmlFor="tenant-focus-ref">
          {t("s14w")}<input
            id="tenant-focus-ref"
            name="tenant-focus-ref"
            autoComplete="off"
            placeholder={t("sjx")}
            value={focusText}
            onChange={(event) => setFocusText(event.target.value)}
          />
        </label>
        <button type="button" id="tenant-open-ref" className="discovery-action" onClick={() => actions.openResource(focusText)}>
          {t("s15i")}</button>
      </div>
      <p className="muted">
        {t("s4w")}</p>
      <p className="muted" data-scenario-note={scenario}>
        {deskText(t, SCENARIO_NOTES[scenario])} {t("scc")}</p>
      <p className="muted">{deskText(t, TENANT_SYNTHETIC_CONTROL_NOTE)}</p>
    </section>
  );
}

export function TenantStatus({ model }: { model: TenantModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="tenant-status" className="discovery-section" tabIndex={-1} data-tenant-state={model.state}>
      <h3>{t("s1mj")}</h3>
      <p role="status" data-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {deskText(t, model.statusLine)}
        {model.detailLine ? t("sgg", { detailLine: model.detailLine }) : ""}
      </p>
      <p className="muted">{deskText(t, model.freshnessWord)}</p>
      <p className="muted">{deskText(t, model.scopeLine)}</p>
      <p className="muted">{deskText(t, model.generationLine)}</p>
      <p className="muted">{deskText(t, model.watermarkLine)}</p>
      <p className="muted" data-workspace-line="true">
        {deskText(t, model.workspaceLine)}
      </p>
      {model.lastLine ? (
        <p role="status" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word={t("s91")} /> : null} {deskText(t, model.lastLine)}
        </p>
      ) : null}
    </section>
  );
}

export function TenantAuthoritySection({ model }: { model: TenantModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="tenant-authority" className="discovery-section" aria-label={t("s26m")}>
      <h3>{t("s26m")}</h3>
      <p className="muted">
        {t("s1c1")}</p>
      <ScrollTable label={t("sba")}>
        <table className="finance-authority">
          <caption>{t("s1yf")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("sbb")}</th>
              <th scope="col">{t("sn9")}</th>
            </tr>
          </thead>
          <tbody>
            {deskText(t, model.authority.map((row) => (
              <tr key={row.capability} data-capability={row.capability} data-held-by-role={row.heldByRole ? "true" : "false"}>
                <th scope="row">{deskText(t, row.capability)}</th>
                <td>
                  {deskText(t, row.heldByLine)}
                  {row.heldByRole ? (" " + t("s1xf")) : ""}
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </ScrollTable>
    </section>
  );
}

export function TenantFocusSection({ model }: { model: TenantModel }) {
  const t = useT(copy0, copy1, copy2);
  if (model.focus === null) {
    return null;
  }
  return (
    <section id="tenant-focus" className="discovery-section" aria-label={t("sfq")} data-focus-kind={model.focus.kind}>
      <h3>{deskText(t, model.focus.title)}</h3>
      {deskText(t, model.focus.lines.map((line) => (
        <p key={line}>{deskText(t, line)}</p>
      )))}
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
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="tenant-workspace" className="discovery-section" aria-label={t("s1hm")}>
      <h3>{t("s1hm")}</h3>
      <div className="discovery-controls">
        <label htmlFor="tenant-note">
          {t("s10s")}<input id="tenant-note" name="tenant-note" autoComplete="off" defaultValue="Reviewed against the last read." />
        </label>
      </div>
      {model.accountBlock ? (
        <p id="tenant-account-reason" className="muted" data-blocked-reason="true" data-block="account-change">
          <WordMark word={t("status.transport.blocked")} /> {t("sk")}{" "}{deskText(t, model.accountBlock)}
        </p>
      ) : null}
      {model.revokeBlock ? (
        <p id="tenant-revoke-reason" className="muted" data-blocked-reason="true" data-block="role-revoke">
          <WordMark word={t("status.transport.blocked")} /> {t("s1hl")}{" "}{deskText(t, model.revokeBlock)}
        </p>
      ) : null}

      {model.members.length > 0 ? (
        <>
          <h4>{t("ssg")}</h4>
          <ScrollTable label={t("ssj")}>
            <table className="finance-cuts">
              <caption>{t("s1hf")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("ssh")}</th>
                  <th scope="col">{t("s180")}</th>
                  <th scope="col">{t("s1he")}</th>
                  <th scope="col">{t("sme")}</th>
                  <th scope="col">{t("s1mi")}</th>
                  <th scope="col">{t("s19s")}</th>
                </tr>
              </thead>
              <tbody>
                {deskText(t, model.members.map((row) => (
                  <tr key={row.memberRef} data-member={row.memberRef} data-member-state={row.state}>
                    <th scope="row">{deskText(t, row.memberRef)}</th>
                    <td>{deskText(t, row.actorRef)}</td>
                    <td>{deskText(t, row.role)}</td>
                    <td>{deskText(t, row.generation)}</td>
                    <td>{deskText(t, row.stateWord)}</td>
                    <td>
                      {row.proposeRevoke === null ? (
                        <span className="muted">{t("sxy")}</span>
                      ) : (
                        <GuardedButton
                          id={`tenant-revoke-${row.memberRef}`}
                          label={t("s19x", { memberRef: row.memberRef })}
                          control={row.proposeRevoke}
                          describedBy={model.revokeBlock ? "tenant-revoke-reason" : undefined}
                          onPress={() => actions.proposeRoleRevoke(row.memberRef, noteValue())}
                        />
                      )}
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </ScrollTable>
        </>
      ) : null}

      {model.orders.length > 0 ? (
        <>
          <h4>{t("s15u")}</h4>
          <ul className="discovery-list" aria-label={t("s15z")}>
            {deskText(t, model.orders.map((row) => (
              <li key={row.orderRef} data-order={row.orderRef} data-order-state={row.state}>
                <Synthetic /> <strong>{deskText(t, row.orderRef)}</strong> {deskText(t, row.label)}{t("s1n4")}{" "}{deskText(t, row.subjectRef)}{t("sir")}{" "}{deskText(t, row.eventRef)}. {deskText(t, row.state)}.
              </li>
            )))}
          </ul>
        </>
      ) : null}

      {model.events.length > 0 ? (
        <>
          <h4>{t("sit")}</h4>
          <ul className="discovery-list" aria-label={t("siv")}>
            {deskText(t, model.events.map((row) => (
              <li key={row.eventRef} data-event={row.eventRef} data-event-state={row.state}>
                <Synthetic /> <strong>{deskText(t, row.eventRef)}</strong> {deskText(t, row.title)}. {deskText(t, row.state)}.
              </li>
            )))}
          </ul>
        </>
      ) : null}

      {model.accounts.length > 0 ? (
        <>
          <h4>{t("s1jy")}</h4>
          <ul className="discovery-list" aria-label={t("sm")}>
            {deskText(t, model.accounts.map((row) => (
              <li key={row.accountRef} data-account={row.accountRef} data-account-state={row.state}>
                <Synthetic /> <strong>{deskText(t, row.accountRef)}</strong> {deskText(t, row.label)}. {deskText(t, row.tailLine)} {deskText(t, row.stateWord)}.
                <br />
                {row.proposeChange === null ? null : (
                  <GuardedButton
                    id={`tenant-account-${row.accountRef}`}
                    label={t("s19q", { accountRef: row.accountRef })}
                    control={row.proposeChange}
                    describedBy={model.accountBlock ? "tenant-account-reason" : undefined}
                    onPress={() => actions.proposeAccountChange(row.accountRef, noteValue())}
                  />
                )}
              </li>
            )))}
          </ul>
        </>
      ) : null}

      {model.cases.length > 0 ? (
        <>
          <h4>{t("s1nh")}</h4>
          <ul className="discovery-list" aria-label={t("sbj")}>
            {deskText(t, model.cases.map((row) => (
              <li key={row.caseRef} data-case={row.caseRef} data-case-state={row.state}>
                <Synthetic /> <strong>{deskText(t, row.caseRef)}</strong> {deskText(t, row.topic)}{t("s1n4")}{" "}{deskText(t, row.subjectRef)}. {deskText(t, row.state)}.
              </li>
            )))}
          </ul>
        </>
      ) : null}

      {model.members.length === 0 &&
      model.orders.length === 0 &&
      model.events.length === 0 &&
      model.accounts.length === 0 &&
      model.cases.length === 0 ? (
        <p data-state="empty">{t("s23i")}</p>
      ) : null}
    </section>
  );
}

export function TenantProposalsSection({ model, actions }: { model: TenantModel; actions: TenantActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="tenant-proposals" className="discovery-section" aria-label={t("s19i")} data-proposal-count={model.proposals.length}>
      <h3>{t("s19i")}</h3>
      <p className="muted">
        {t("sn")}</p>
      {model.approveBlock ? (
        <p id="tenant-approve-reason" className="muted" data-blocked-reason="true" data-block="approve">
          <WordMark word={t("status.transport.blocked")} /> {t("s5w")}{" "}{deskText(t, model.approveBlock)}
        </p>
      ) : null}
      {model.proposals.length === 0 ? <p data-state="empty">{t("sx1")}</p> : null}
      {model.proposals.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s19j")}>
          {deskText(t, model.proposals.map((proposal) => (
            <li key={proposal.proposalRef} data-proposal={proposal.proposalRef} data-proposal-state={proposal.state}>
              <Synthetic /> <strong>{deskText(t, proposal.proposalRef)}</strong> {deskText(t, proposal.kindWord)} {t("s140")}{" "}{deskText(t, proposal.targetRef)}.{" "}
              {deskText(t, proposal.proposedLine)} {deskText(t, proposal.stateWord)}{t("s10q")}{" "}{deskText(t, proposal.note)}
              <br />
              <GuardedButton
                id={`tenant-approve-${proposal.proposalRef}`}
                label={t("s1dp", { proposalRef: proposal.proposalRef })}
                control={proposal.approve}
                describedBy={model.approveBlock ? "tenant-approve-reason" : undefined}
                onPress={() => actions.approveProposal(proposal.proposalRef)}
              />
            </li>
          )))}
        </ul>
      ) : null}
    </section>
  );
}

export function TenantAuditSection({ model }: { model: TenantModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="tenant-audit" className="discovery-section" aria-label={t("s94")} data-audit-count={model.audit.length}>
      <h3>{t("s94")}</h3>
      <p className="muted">
        {t("s1yi")}</p>
      {model.audit.length === 0 ? <p data-state="empty">{t("su6")}</p> : null}
      {model.audit.length > 0 ? (
        <ScrollTable label={t("s93")}>
          <table className="finance-cuts">
            <caption>{t("sfl")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("sij")}</th>
                <th scope="col">{t("s12")}</th>
                <th scope="col">{t("s1he")}</th>
                <th scope="col">{t("sy")}</th>
                <th scope="col">{t("s1pe")}</th>
                <th scope="col">{t("sfj")}</th>
                <th scope="col">{t("sgf")}</th>
              </tr>
            </thead>
            <tbody>
              {deskText(t, model.audit.map((row) => (
                <tr key={row.auditRef} data-audit={row.auditRef} data-audit-decision={row.decision}>
                  <th scope="row">
                    {deskText(t, row.auditRef)} {t("s1je")}{" "}{deskText(t, row.seq)})
                  </th>
                  <td>{deskText(t, row.actorRef)}</td>
                  <td>{deskText(t, row.role)}</td>
                  <td>{deskText(t, row.action)}</td>
                  <td>{deskText(t, row.targetRef) ?? "—"}</td>
                  <td>{deskText(t, row.decision)}</td>
                  <td>{deskText(t, row.detail)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </ScrollTable>
      ) : null}
    </section>
  );
}

export function TenantExportSection({ model }: { model: TenantModel }) {
  const t = useT(copy0, copy1, copy2);
  const exported = model.export;
  return (
    <section id="tenant-export-panel" className="discovery-section" aria-label={t("s1jc")} data-export-phase={exported.phase}>
      <h3>{t("s1jc")}</h3>
      <p data-export-status={exported.phase}>{deskText(t, exported.statusLine)}</p>
      {exported.detailLine ? <p className="muted">{deskText(t, exported.detailLine)}</p> : null}
      {deskText(t, exported.verdictLines.map((line) => (
        <p key={line} data-export-verdict={exported.verdictWord}>
          {exported.verdictWord === "withheld" ? <WordMark word={t("s26v")} /> : null} {deskText(t, line)}
        </p>
      )))}
      {exported.scopeLine ? <p className="muted" data-export-scope="declared">{deskText(t, exported.scopeLine)}</p> : null}
      {exported.exportRef ? <p className="muted">{t("ski")}{" "}{deskText(t, exported.exportRef)}.</p> : null}
      {exported.rowsLine ? <p className="muted">{deskText(t, exported.rowsLine)}</p> : null}
      {exported.rows.length > 0 ? (
        <ScrollTable label={t("skl")}>
          <table className="finance-cuts">
            <caption>{t("s1hx")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("sij")}</th>
                <th scope="col">{t("sps")}</th>
                <th scope="col">{t("spx")}</th>
                <th scope="col">{t("sgf")}</th>
              </tr>
            </thead>
            <tbody>
              {deskText(t, exported.rows.map((row) => (
                <tr key={row.entryRef} data-export-row={row.entryRef}>
                  <th scope="row">{deskText(t, row.entryRef)}</th>
                  <td>{deskText(t, row.kindWord)}</td>
                  <td>{deskText(t, row.label)}</td>
                  <td>{deskText(t, row.detail)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </ScrollTable>
      ) : null}
      <p className="muted">{deskText(t, TENANT_EXPORT_NOTE)}</p>
    </section>
  );
}

export function TenantRequestsSection({ model }: { model: TenantModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="tenant-requests" className="discovery-section" aria-label={t("s1fv")}>
      <h3>{t("s1fv")}</h3>
      {model.behindLine ? <p data-behind="true">{deskText(t, model.behindLine)}</p> : null}
      {model.fenceLine ? (
        <p data-fence="true">
          <WordMark word={t("sky")} /> {deskText(t, model.fenceLine)}
        </p>
      ) : null}
      {model.request === null ? <p data-state="empty">{t("sxr")}</p> : null}
      {model.request !== null ? (
        <div data-request-seq={model.request.seq} data-request-phase={model.request.phase}>
          <p>
            {t("s1fq")}{" "}{deskText(t, model.request.seq)}: {deskText(t, model.request.kindWord)}. {deskText(t, model.request.phaseWord)}
            {model.request.code ? (" " + t("sd2", { code: model.request.code })) : ""}.
          </p>
          {model.request.detail ? <p className="muted">{deskText(t, model.request.detail)}</p> : null}
          {deskText(t, model.request.receiptLines.map((line) => (
            <p key={line} className="muted">
              {deskText(t, line)}
            </p>
          )))}
        </div>
      ) : null}
    </section>
  );
}

export function TenantSessionSection({ session }: { session: TenantSessionModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="tenant-session" className="discovery-section" aria-label={t("s1js")}>
      <h3>{t("s1js")}</h3>
      <p className="muted">{deskText(t, session.contextLine)}</p>
      <p className="muted">{deskText(t, session.capabilityLine)}</p>
      <p className="muted">{deskText(t, session.countersLine)}</p>
      <p className="muted">{deskText(t, session.earlierUnknownLine)}</p>
      <p className="muted" data-hold-record="not-bound">{deskText(t, session.holdLine)}</p>
      <p className="muted" data-not-composed="recorded">{deskText(t, session.notComposedLine)}</p>
    </section>
  );
}
