import { ValidatedForm } from "../forms/ValidatedForm";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { StatusMark } from "../a11y/marks";
import {
  buildHandoffView,
  FEATURE_ROWS,
  FIRST_RUN,
  GATE_START,
  HANDOFF_NON_CLAIMS,
  HANDOFF_PINS,
  HANDOFF_RULING,
  LOCAL_COMMAND_SCREENS,
  LOOPBACK,
  NEVER_SENT_HANDOFF,
  nextRole,
  ORIGINAL10_EVIDENCE,
  PENDING_PRODUCERS,
  PLACE_HOLD_HANDOFF,
  ROLE_JOURNEYS,
  STARTUP_FAULTS,
  STUB_MODE,
  SUPPORTED_COMMANDS,
  UNCONNECTED_SCREENS,
  type FeatureRow,
  type HandoffView,
} from "../handoff/packet";
import { protocol } from "../protocol";
import { WORKSPACE_ROLES, type WorkspaceRole } from "../workspace/registry";

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  buyer: "Buyer",
  organizer: "Organizer",
  operator: "Operator",
};

export function HandoffPage() {
  const meta = protocol.describe();
  const [phase, setPhase] = useState<"loading" | "settled">("loading");
  useEffect(() => {
    setPhase("settled");
  }, []);
  return (
    <HandoffScreen
      phase={phase}
      adapter={meta.adapter}
      environment={meta.environment}
      fundsMovement={meta.fundsMovement}
      publicDeploy={meta.publicDeploy}
    />
  );
}

export function HandoffScreen({
  phase,
  adapter,
  environment,
  fundsMovement,
  publicDeploy,
  initialQuery = "",
  initialCode = "",
  initialRole = "buyer",
}: {
  phase: "loading" | "settled";
  adapter: string;
  environment: string;
  fundsMovement: string;
  publicDeploy: boolean;
  initialQuery?: string;
  initialCode?: string;
  initialRole?: WorkspaceRole;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [code, setCode] = useState(initialCode);
  const [role, setRole] = useState<WorkspaceRole>(initialRole);
  const view = buildHandoffView({ phase, query, code, role });
  const panelId = useId();
  const keyboardRole = useRef(false);
  const seenError = useRef<{ state: string; focusId: string | null }>({ state: "loading", focusId: null });

  useEffect(() => {
    const previous = seenError.current;
    const entered = view.state === "error" && (previous.state !== "error" || previous.focusId !== view.focusId);
    seenError.current = { state: view.state, focusId: view.focusId };
    if (entered && view.focusId) {
      document.getElementById(view.focusId)?.focus();
    }
  }, [view.state, view.focusId]);

  useEffect(() => {
    if (!keyboardRole.current || view.state === "loading") {
      return;
    }
    keyboardRole.current = false;
    document.getElementById(`handoff-tab-${role}`)?.focus();
  }, [role, view.state]);

  function onQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function chooseRole(next: WorkspaceRole, fromKeyboard: boolean) {
    keyboardRole.current = fromKeyboard;
    setRole(next);
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, current: WorkspaceRole) {
    const next = nextRole(current, event.key);
    if (!next) {
      return;
    }
    event.preventDefault();
    chooseRole(next, true);
  }

  return (
    <section className="handoff" data-handoff="packet" data-state={view.state} aria-busy={view.state === "loading"}>
      <header className="section-head">
        <p className="eyebrow">Local handoff</p>
        <h2>Local product handoff</h2>
        <p>{HANDOFF_RULING}</p>
        <p>Protocol integration is not complete. Public service, real payment, and venue admission stay unqualified.</p>
        <p>
          Qualification {HANDOFF_NON_CLAIMS.qualificationState}. Release {HANDOFF_NON_CLAIMS.releaseState}. Adapter {adapter}.
          Environment {environment}. Funds {fundsMovement}. Public deploy {publicDeploy ? "yes" : "no"}.
        </p>
      </header>
      {view.state === "loading" ? (
        <p className="panel" role="status">
          <StatusMark kind="loading" /> Reading the local handoff packet. Nothing is sent.
        </p>
      ) : (
        <HandoffBody
          view={view}
          query={query}
          code={code}
          panelId={panelId}
          onQuery={onQuery}
          onQueryChange={setQuery}
          onCodeChange={setCode}
          onRole={(next) => chooseRole(next, false)}
          onTabKey={onTabKey}
        />
      )}
    </section>
  );
}

function HandoffBody({
  view,
  query,
  code,
  panelId,
  onQuery,
  onQueryChange,
  onCodeChange,
  onRole,
  onTabKey,
}: {
  view: HandoffView;
  query: string;
  code: string;
  panelId: string;
  onQuery: (event: FormEvent<HTMLFormElement>) => void;
  onQueryChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onRole: (role: WorkspaceRole) => void;
  onTabKey: (event: KeyboardEvent<HTMLButtonElement>, role: WorkspaceRole) => void;
}) {
  const queryInvalid = view.focusId === "handoff-query";
  const codeInvalid = view.focusId === "handoff-code";
  return (
    <div>
      <section className="panel" aria-label="Install">
        <h3>First run</h3>
        <ol>
          <li>
            <code>{FIRST_RUN.install}</code>
          </li>
          <li>
            <code>{FIRST_RUN.test}</code>
          </li>
          <li>
            <code>{FIRST_RUN.dev}</code> The desk listens on port {FIRST_RUN.port}.
          </li>
        </ol>
        <p>{FIRST_RUN.reload}</p>
        <p>{FIRST_RUN.ciSkip}</p>
        <p>
          Stub mode is the default ({STUB_MODE.modeValues.join(" or ")}). Environment {STUB_MODE.environment}. A base URL in
          stub mode does not open HTTP.
        </p>
        <p>
          Loopback is opt-in. Mode {LOOPBACK.modes.join(" or ")}. Base {LOOPBACK.exampleBase}. One attempt. Retry{" "}
          {LOOPBACK.retry ? "on" : "off"}. Stub fallback {LOOPBACK.stubFallback ? "on" : "off"}. Redirects are not followed.
          This repo does not start the gate.
        </p>
        <p>
          From a {GATE_START.repo} checkout: <code>{GATE_START.command}</code>. Bind {GATE_START.bindHost}. Browser CORS is{" "}
          {LOOPBACK.browserCors ? "open" : "closed"}.
        </p>
        <h3>Startup faults</h3>
        <ul>
          {STARTUP_FAULTS.map((fault) => (
            <li key={fault.id}>
              {fault.when}. {fault.result}
            </li>
          ))}
        </ul>
      </section>

      <ValidatedForm id="handoff-filter-form" fields={[]} reportedIssues={view.focusId ? [{ fieldId: view.focusId, labelKey: "validation.label.filter", messageKey: "validation.filter", params: { max: 0 } }] : []} className="panel" onSubmit={onQuery} aria-label="Handoff filter">
        <label htmlFor="handoff-query">
          Filter features
          <input
            id="handoff-query"
            value={query}
            aria-invalid={queryInvalid}
            aria-describedby={queryInvalid ? "handoff-error" : undefined}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <label htmlFor="handoff-code">
          Diagnosis code
          <input
            id="handoff-code"
            value={code}
            aria-invalid={codeInvalid}
            aria-describedby={codeInvalid ? "handoff-error" : undefined}
            onChange={(event) => onCodeChange(event.target.value)}
          />
        </label>
        <button type="submit">Apply filter</button>
        <p className="muted">Enter applies the text already in the fields. This page does not post.</p>
      </ValidatedForm>

      {view.error ? (
        <p id="handoff-error" className="alert" role="alert" data-focus={view.focusId ?? ""}>
          <StatusMark kind="blocked" /> {view.error}
        </p>
      ) : null}

      {view.diagnosis ? (
        <p className="panel" data-diagnosis={view.diagnosis.kind} data-confirmed="false">
          <StatusMark kind="review" /> {view.diagnosis.title}. {view.diagnosis.detail}
        </p>
      ) : null}

      {view.state === "empty" ? (
        <p className="empty" role="status">
          No handoff row matches this query. Clear the filter to return to the full packet.
        </p>
      ) : null}

      {view.state === "ready" ? <FeatureTable rows={view.features} /> : null}
      {view.state === "error" && view.features.length > 0 ? <FeatureTable rows={view.features} /> : null}

      <section className="panel">
        <h3>Supported local commands</h3>
        <p>
          <StatusMark kind="review" /> These names are posted only by the named sender. Local only. Protocol integration is
          not complete.
        </p>
        <div className="handoff-scroll" role="region" aria-label="Supported commands, scrollable" tabIndex={0}>
          <table>
            <caption>Commands this desk can post on the stub or the loopback gate</caption>
            <thead>
              <tr>
                <th>Command</th>
                <th>Sender</th>
                <th>Surfaces</th>
              </tr>
            </thead>
            <tbody>
              {SUPPORTED_COMMANDS.map((command) => (
                <tr key={`${command.sender}-${command.action}`} data-command={command.action} data-integration="not-complete">
                  <td>{command.action}</td>
                  <td>{command.sender}</td>
                  <td>{command.surfaces.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Not sent from any sender: {NEVER_SENT_HANDOFF.join(", ")}. settlementPreview stays not-bound. Its considered action
          is recorded on the locked binding and is not sent from this page.
        </p>
        <p>
          placeHold stays {PLACE_HOLD_HANDOFF.status}. consideredAction {PLACE_HOLD_HANDOFF.consideredAction}. Mapped onto
          prepare_trade: {PLACE_HOLD_HANDOFF.mappedOntoPrepareTrade ? "yes" : "no"}.
        </p>
        <p>
          Local-command screens: {LOCAL_COMMAND_SCREENS.map((row) => row.id).join(", ")}. Unconnected screens:{" "}
          {UNCONNECTED_SCREENS.map((row) => row.id).join(", ")}.
        </p>
      </section>

      <section className="panel">
        <h3>Pending producers</h3>
        <p>These catalogue ids are not connected and are not implemented on this desk.</p>
        <div className="handoff-scroll" role="region" aria-label="Pending producers, scrollable" tabIndex={0}>
          <table>
            <caption>Pending producers the local desk does not consume</caption>
            <thead>
              <tr>
                <th>Id</th>
                <th>Surface</th>
                <th>Connected</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {PENDING_PRODUCERS.map((row) => (
                <tr key={row.id} data-pending={row.id} data-connected="false">
                  <td>{row.id}</td>
                  <td>{row.waitingSurface ?? "(none)"}</td>
                  <td>no</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h3>Role journey</h3>
        <div role="tablist" aria-label="Handoff role">
          {WORKSPACE_ROLES.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              id={`handoff-tab-${item}`}
              className="handoff-tab"
              aria-selected={view.role === item}
              aria-controls={panelId}
              tabIndex={view.role === item ? 0 : -1}
              onClick={() => onRole(item)}
              onKeyDown={(event) => onTabKey(event, item)}
            >
              {ROLE_LABEL[item]}
            </button>
          ))}
        </div>
        <div id={panelId} role="tabpanel" aria-labelledby={`handoff-tab-${view.role}`}>
          <p>
            <StatusMark kind="selected" /> {ROLE_LABEL[view.role]} journey. Selection is not a reservation and not a payment.
          </p>
          <ol>
            {view.steps.map((step) => (
              <li key={step.id} data-step={step.id} data-integration="not-complete">
                <strong>{step.id}</strong>{" "}
                {step.link ? <Link to={step.link}>{step.route}</Link> : <span>{step.route}</span>}{" "}
                {step.statuses.join(", ") || "unsupported"}. {step.note}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="panel">
        <h3>Preserved evidence</h3>
        <p>The original ten nodes stay cited. This page does not replace their documents.</p>
        <ul>
          {ORIGINAL10_EVIDENCE.map((item) => (
            <li key={item.id}>
              {item.id} · {item.doc}
            </li>
          ))}
        </ul>
        <p>
          Pins stay on contract {HANDOFF_PINS.contractOpenApiSha256.slice(0, 12)} and gate {HANDOFF_PINS.gateOpenApiSha256.slice(0, 12)}.
          Merge {HANDOFF_PINS.protocolMergeSha.slice(0, 12)}. SDK digest is null. No producer change is consumed. Feature rows{" "}
          {FEATURE_ROWS.length}. Journey roles {Object.keys(ROLE_JOURNEYS).join(", ")}.
        </p>
      </section>
    </div>
  );
}

function FeatureTable({ rows }: { rows: readonly FeatureRow[] }) {
  return (
    <div className="handoff-scroll" role="region" aria-label="Feature status, scrollable" tabIndex={0}>
      <table>
        <caption>Feature connection status. A row with a screen is still not protocol integration.</caption>
        <thead>
          <tr>
            <th>Feature</th>
            <th>Route</th>
            <th>Role</th>
            <th>Status</th>
            <th>Integration</th>
            <th>Commands</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-feature={row.id} data-status={row.status} data-integration="not-complete">
              <td>{row.id}</td>
              <td>
                {row.route.startsWith("/") && !row.route.includes(":") ? <Link to={row.route}>{row.route}</Link> : row.route}
              </td>
              <td>{row.role}</td>
              <td>{row.status}</td>
              <td>not complete</td>
              <td>{row.commands.length > 0 ? row.commands.join(", ") : "none"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
