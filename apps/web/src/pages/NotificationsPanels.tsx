import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { AsyncState } from "../components/AsyncState";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  NOTIFY_ACTORS,
  NOTIFY_FOREIGN,
  NOTIFY_OWN,
  NOTIFY_ROLES,
  NOTIFY_SCENARIOS,
  type NotifyRole,
  type NotifyScenario,
} from "@kix/protocol-adapter";
import {
  NOTIFY_ACTION_NOTE,
  NOTIFY_ACTOR_NOTE,
  NOTIFY_BOUNDARY,
  NOTIFY_CLAIM_NOTE,
  NOTIFY_CURRENT_NOTE,
  NOTIFY_DEDUPE_NOTE,
  NOTIFY_HIDE_NOTE,
  NOTIFY_INQUIRY_NOTE,
  NOTIFY_PAGE_TITLE,
  NOTIFY_READ_NOTE,
  NOTIFY_SCENARIO_NOTES,
  NOTIFY_SCOPE_NOTE,
  NOTIFY_SENSITIVE_NOTE,
  NOTIFY_SESSION_NOTE,
  NOTIFY_SOURCE_LINE,
  NOTIFY_SYNTHETIC_CONTROL_NOTE,
  type ControlModel,
  type NotifyActions,
  type NotifyModel,
  type NotifySessionModel,
} from "../notification-inbox";
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
      <ConnectivityWriteButton inspection={id === "notify-open-inquiry"}
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

export function NotifyBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: NotifyScenario;
  model: NotifyModel;
}) {
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">Notification inbox</p>
      <h2>{NOTIFY_PAGE_TITLE}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-notification-inbox">
        SYNTHETIC. {NOTIFY_SOURCE_LINE}
      </p>
      <p>{NOTIFY_BOUNDARY}</p>
      <p>{NOTIFY_DEDUPE_NOTE}</p>
      <p>{NOTIFY_CURRENT_NOTE}</p>
      <p>{NOTIFY_SENSITIVE_NOTE}</p>
      <p>{NOTIFY_ACTION_NOTE}</p>
      <p>{NOTIFY_INQUIRY_NOTE}</p>
      <p data-hide-note="true">{NOTIFY_HIDE_NOTE}</p>
      <p>{NOTIFY_SCOPE_NOTE}</p>
      <p>{NOTIFY_ACTOR_NOTE}</p>
      <p>{NOTIFY_CLAIM_NOTE}</p>
      <p>{NOTIFY_READ_NOTE}</p>
      <p>{NOTIFY_SESSION_NOTE}</p>
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

export function NotifyControls({
  scenario,
  actorRef,
  role,
  actions,
}: {
  scenario: NotifyScenario;
  actorRef: string;
  role: NotifyRole;
  actions: NotifyActions;
}) {
  const [focusText, setFocusText] = useState("");
  return (
    <section id="notify-controls" className="discovery-section" aria-label="Synthetic controls">
      <div className="discovery-controls">
        <PickAndApply
          id="notify-scenario"
          label="Synthetic scenario"
          value={scenario}
          options={NOTIFY_SCENARIOS}
          applyId="notify-apply-scenario"
          applyLabel="Start a session with this scenario"
          onApply={(next) => actions.setScenario(next as NotifyScenario)}
        />
        <PickAndApply
          id="notify-actor"
          label="Desk actor"
          value={actorRef}
          options={NOTIFY_ACTORS}
          applyId="notify-apply-actor"
          applyLabel="Switch to this actor"
          onApply={(next) => actions.switchActor(next)}
        />
        <PickAndApply
          id="notify-role"
          label="Role for this actor"
          value={role}
          options={NOTIFY_ROLES}
          applyId="notify-apply-role"
          applyLabel="Switch to this role"
          onApply={(next) => actions.switchRole(next as NotifyRole)}
        />
        <button type="button" id="notify-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          Read again
        </button>
        <button type="button" id="notify-switch-tenant" className="discovery-action" onClick={() => actions.switchTenant()}>
          Switch tenant ({NOTIFY_OWN} / {NOTIFY_FOREIGN})
        </button>
        <ConnectivityWriteButton type="button" id="notify-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          Start a new synthetic session
        </ConnectivityWriteButton>
      </div>
      <div className="discovery-controls" role="group" aria-label="Direct open by reference">
        <label htmlFor="notify-focus-ref">
          Open a notification by reference
          <input
            id="notify-focus-ref"
            name="notify-focus-ref"
            autoComplete="off"
            placeholder="ntf-0001…"
            value={focusText}
            onChange={(event) => setFocusText(event.target.value)}
          />
        </label>
        <button type="button" id="notify-open-ref" className="discovery-action" onClick={() => actions.openNotification(focusText)}>
          Open this notification
        </button>
      </div>
      <div className="discovery-controls" role="group" aria-label="Synthetic source controls">
        <ConnectivityWriteButton type="button" id="notify-revoke-grant" className="discovery-action" onClick={() => actions.revokeGrant()}>
          Simulate a revoked grant
        </ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="notify-rotate-grant" className="discovery-action" onClick={() => actions.rotateGrant()}>
          Simulate a rotated grant generation
        </ConnectivityWriteButton>
        <button type="button" id="notify-deliver-late" className="discovery-action" onClick={() => actions.deliverLate()}>
          Simulate a late delivery
        </button>
      </div>
      <p className="muted">
        A pasted reference is a direct open, like a typed URL. The source answers a ref outside this tenant or addressed to
        another subject with denied — never a row of another tenant, never a row of another subject.
      </p>
      <p className="muted" data-scenario-note={scenario}>
        {NOTIFY_SCENARIO_NOTES[scenario]} Choosing a scenario does nothing until you start a session with it, and starting one clears earlier reads, material, and requests.
      </p>
      <p className="muted">{NOTIFY_SYNTHETIC_CONTROL_NOTE}</p>
    </section>
  );
}

export function NotifyStatus({ model }: { model: NotifyModel }) {
  return (
    <section id="notify-status" className="discovery-section" tabIndex={-1} data-notify-state={model.state}>
      <h3>Status</h3>
      {model.state === "loading" || model.state === "empty" || model.state === "stale" || model.state === "not-bound" ? (
        <AsyncState kind={model.state} label="Inbox" data-status={model.state}><p>{model.statusLine} {model.detailLine}</p></AsyncState>
      ) : <p role="status" data-status={model.state}>{model.statusLine} {model.detailLine}</p>}
      <p className="muted">{model.freshnessWord}</p>
      <p className="muted">{model.scopeLine}</p>
      <p className="muted">{model.generationLine}</p>
      <p className="muted">{model.watermarkLine}</p>
      <p className="muted" data-unread-line="true">
        {model.unreadLine}
      </p>
      <p className="muted" data-dedupe-line="true">
        {model.dedupeLine}
      </p>
      {model.lastLine ? (
        <p role="status" aria-live="polite" aria-busy={false} data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word="Attention." /> : null} {model.lastLine}
        </p>
      ) : null}
    </section>
  );
}

export function NotifyAuthoritySection({ model }: { model: NotifyModel }) {
  return (
    <section id="notify-authority" className="discovery-section" aria-label="Who may do what">
      <h3>Who may do what</h3>
      <p className="muted">
        Reading the inbox, marking read, resolving an offered action, reading the support material, and seeing a sensitive
        detail stay separate capabilities. The grant is the source&apos;s own record, separate from the desk&apos;s role
        assignment.
      </p>
      <ScrollTable label="Capabilities and the roles that hold them">
        <table className="finance-authority">
          <caption>The source&apos;s capabilities on this inbox</caption>
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

export function NotifyFocusSection({ model }: { model: NotifyModel }) {
  if (model.focus === null) {
    return null;
  }
  return (
    <section id="notify-focus" className="discovery-section" aria-label="Deep-opened notification" data-focus-kind="notification">
      <h3>{model.focus.title}</h3>
      {model.focus.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </section>
  );
}

export function NotifyInboxSection({ model, actions }: { model: NotifyModel; actions: NotifyActions }) {
  return (
    <section id="notify-inbox" className="discovery-section" aria-label="Inbox" data-row-count={model.rows.length}>
      <h3>Inbox</h3>
      <p className="muted">
        A row reports what the source recorded. An arrival confirms no economic effect. A stale-issued row keeps its place
        but its offered action resolves nothing.
      </p>
      {model.markBlock ? (
        <p id="notify-mark-reason" className="muted" data-blocked-reason="true" data-block="mark-read">
          <WordMark word="Blocked." /> Marking read is off: {model.markBlock}
        </p>
      ) : null}
      {model.resolveBlock ? (
        <p id="notify-resolve-reason" className="muted" data-blocked-reason="true" data-block="resolve">
          <WordMark word="Blocked." /> Resolving offered actions is off: {model.resolveBlock}
        </p>
      ) : null}
      {model.rows.length === 0 ? <p data-state="empty">No notification in this read.</p> : null}
      {model.rows.length > 0 ? (
        <ul className="discovery-list" aria-label="Notifications in the last read">
          {model.rows.map((row) => (
            <li
              key={row.notificationRef}
              data-notification={row.notificationRef}
              data-notification-read={row.readWord === "Read" ? "true" : "false"}
              data-issue-state={row.issueState}
            >
              <Synthetic /> <strong>{row.notificationRef}</strong> {row.kindWord} (seq {row.seq}). {row.headline}{" "}
              <span className="muted">
                {row.readWord}. {row.issueWord}. Issued {row.issuedAt}. {row.sensitiveLine}
              </span>
              <br />
              {row.detailLine ? <span data-detail="notification">{row.detailLine}</span> : null}
              <br />
              <span className="muted">{row.offerWord}</span>
              <br />
              {row.markRead === null ? null : (
                <GuardedButton
                  id={`notify-mark-${row.notificationRef}`}
                  label={`Mark ${row.notificationRef} read`}
                  control={row.markRead}
                  describedBy={model.markBlock ? "notify-mark-reason" : undefined}
                  onPress={() => actions.markRead(row.notificationRef)}
                />
              )}
              {row.resolve === null ? null : (
                <GuardedButton
                  id={`notify-resolve-${row.notificationRef}`}
                  label={`Resolve the offered action on ${row.notificationRef}`}
                  control={row.resolve}
                  describedBy={model.resolveBlock ? "notify-resolve-reason" : undefined}
                  onPress={() => actions.resolveAction(row.notificationRef)}
                />
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <ScrollTable label="Notification fields">
        {model.rows.length > 0 ? (
          <table className="finance-cuts">
            <caption>Dedupe keys and issue generations the read reported</caption>
            <thead>
              <tr>
                <th scope="col">Notification</th>
                <th scope="col">Dedupe key</th>
                <th scope="col">Kind</th>
                <th scope="col">Seq</th>
                <th scope="col">Read</th>
                <th scope="col">Issue</th>
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row) => (
                <tr key={row.notificationRef} data-notification-row={row.notificationRef}>
                  <th scope="row">{row.notificationRef}</th>
                  <td>{row.dedupeKey}</td>
                  <td>{row.kindWord}</td>
                  <td>{row.seq}</td>
                  <td>{row.readWord}</td>
                  <td>{row.issueWord}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </ScrollTable>
    </section>
  );
}

export function NotifyInquirySection({ model, actions }: { model: NotifyModel; actions: NotifyActions }) {
  const inquiry = model.inquiry;
  const destination = model.request?.destination ?? null;
  return (
    <section id="notify-inquiry" className="discovery-section" aria-label="Support material" data-inquiry-phase={inquiry.phase}>
      <h3>Support material</h3>
      <p data-inquiry-status={inquiry.phase}>{inquiry.statusLine}</p>
      {inquiry.detailLine ? <p className="muted">{inquiry.detailLine}</p> : null}
      {destination !== null && destination.kind === "authority" ? (
        <p data-destination="authority">
          The resolve landed on the authority query.{" "}
          <Link to={destination.href}>Open the receipts desk</Link> and look up <strong>{destination.ref}</strong> — the
          reference text travels with you; nothing was sent.
        </p>
      ) : null}
      {destination !== null && destination.kind === "support" ? (
        <p data-destination="support">
          The resolve landed on support material {destination.inquiryRef}.{" "}
          <GuardedButton
            id="notify-open-inquiry"
            label={`Open the support material ${destination.inquiryRef}`}
            control={model.inquiryControl}
            onPress={() => actions.loadInquiry(destination.inquiryRef)}
          />
        </p>
      ) : null}
      {inquiry.declarationLine ? (
        <p className="muted" data-inquiry-declaration="declared">
          {inquiry.declarationLine}
        </p>
      ) : null}
      {inquiry.notificationRef ? <p className="muted">Material for notification {inquiry.notificationRef}.</p> : null}
      {inquiry.rows.length > 0 ? (
        <dl data-inquiry-lines="true">
          {inquiry.rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.text}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="muted">{NOTIFY_INQUIRY_NOTE}</p>
    </section>
  );
}

export function NotifyRequestsSection({ model }: { model: NotifyModel }) {
  return (
    <section id="notify-requests" className="discovery-section" aria-label="Requests">
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
          {model.request.phase === "unknown" ? <AsyncState kind="unknown" label="Notification request" announcement="parent" /> : null}
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

export function NotifySessionSection({ session }: { session: NotifySessionModel }) {
  return (
    <section id="notify-session" className="discovery-section" aria-label="Session record">
      <h3>Session record</h3>
      <p className="muted">{session.contextLine}</p>
      <p className="muted">{session.capabilityLine}</p>
      <p className="muted">{session.countersLine}</p>
      <p className="muted">{session.earlierUnknownLine}</p>
      <p className="muted" data-hold-record="not-bound">
        {session.holdLine}
      </p>
      <p className="muted" data-not-composed="recorded">
        {session.notComposedLine}
      </p>
    </section>
  );
}
