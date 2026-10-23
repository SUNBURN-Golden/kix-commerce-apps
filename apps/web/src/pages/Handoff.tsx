import { messages as mergedCopy } from "../i18n/messages/merged-surfaces";
import { messages as copy0 } from "../i18n/messages/pages--Handoff";
import { messages as copy1 } from "../i18n/messages/handoff--packet";
import { messages as copy2 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { ValidatedForm } from "../forms/ValidatedForm";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { StatusMark } from "../a11y/marks";
import {
  buildHandoffView,
  CONSUMED_PRODUCERS,
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
import { protocol } from "../connectivity/desk-protocol";
import { WORKSPACE_ROLES, type WorkspaceRole } from "../workspace/registry";

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  buyer: "Buyer",
  organizer: "Organizer",
  operator: copy0.en["s15p"],
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
  const t = useT(mergedCopy, copy0, copy1, copy2);
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
        <p className="eyebrow">{t("route.handoff")}</p>
        <h2>{t("srk")}</h2>
        <p>{deskText(t, HANDOFF_RULING)}</p>
        <p>{t("s19z")}</p>
        <p>
          {t("route.qualification")}{" "}{deskText(t, HANDOFF_NON_CLAIMS.qualificationState)}{t("s1f3")}{" "}{deskText(t, HANDOFF_NON_CLAIMS.releaseState)}{t("s14")}{" "}{deskText(t, adapter)}{t("sik")}{" "}{deskText(t, environment)}{t("sm7")}{" "}{deskText(t, fundsMovement)}{t("s1a9")}{" "}{publicDeploy ? t("s277") : t("stt")}.
        </p>
      </header>
      {view.state === "loading" ? (
        <p className="panel" role="status">
          <StatusMark kind="loading" /> {t("s1bb")}</p>
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
  const t = useT(mergedCopy, copy0, copy1, copy2);
  const queryInvalid = view.focusId === "handoff-query";
  const codeInvalid = view.focusId === "handoff-code";
  return (
    <div>
      <section className="panel" aria-label={t("snz")}>
        <h3>{t("slf")}</h3>
        <ol>
          <li>
            <code>{FIRST_RUN.install}</code>
          </li>
          <li>
            <code>{FIRST_RUN.test}</code>
          </li>
          <li>
            <code>{FIRST_RUN.dev}</code> {t("s1ro")}{" "}{deskText(t, FIRST_RUN.port)}.
          </li>
        </ol>
        <p>{deskText(t, FIRST_RUN.reload)}</p>
        <p>{deskText(t, FIRST_RUN.ciSkip)}</p>
        <p>
          {t("s1my")}{deskText(t, STUB_MODE.modeValues.join(copy0.en["e.29"]))}{t("sil")}{" "}{STUB_MODE.environment}{t("s1")}</p>
        <p>
          {t("sro")}{" "}{deskText(t, LOOPBACK.modes.join(copy0.en["e.29"]))}{t("s9p")}{" "}{deskText(t, LOOPBACK.exampleBase)}{t("s144")}{" "}
          {LOOPBACK.retry ? t("s140") : t("s13u")}{t("s1mx")}{" "}{LOOPBACK.stubFallback ? t("s140") : t("s13u")}{t("s1ed")}</p>
        <p>
          {t("sm6")}{" "}{deskText(t, GATE_START.repo)} {t("sc2")}{" "}<code>{GATE_START.command}</code>{t("sa0")}{" "}{deskText(t, GATE_START.bindHost)}{t("sam")}{" "}
          {LOOPBACK.browserCors ? t("s14q") : t("scu")}.
        </p>
        <h3>{t("s1mg")}</h3>
        <ul>
          {deskText(t, STARTUP_FAULTS.map((fault) => (
            <li key={fault.id}>
              {deskText(t, fault.when)}. {deskText(t, fault.result)}
            </li>
          )))}
        </ul>
      </section>

      <ValidatedForm id="handoff-filter-form" fields={[]} reportedIssues={view.focusId ? [{ fieldId: view.focusId, labelKey: "validation.label.filter", messageKey: "validation.filter", params: { max: 0 } }] : []} className="panel" onSubmit={onQuery} aria-label={t("sn0")}>
        <label htmlFor="handoff-query">
          {t("sl9")}<input
            id="handoff-query"
            value={query}
            aria-invalid={queryInvalid}
            aria-describedby={queryInvalid ? "handoff-error" : undefined}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <label htmlFor="handoff-code">
          {t("sgl")}<input
            id="handoff-code"
            value={code}
            aria-invalid={codeInvalid}
            aria-describedby={codeInvalid ? "handoff-error" : undefined}
            onChange={(event) => onCodeChange(event.target.value)}
          />
        </label>
        <button type="submit">{t("s5m")}</button>
        <p className="muted">{t("sii")}</p>
      </ValidatedForm>

      {view.error ? (
        <p id="handoff-error" className="alert" role="alert" data-focus={view.focusId ?? ""}>
          <StatusMark kind="blocked" /> {deskText(t, view.error)}
        </p>
      ) : null}

      {view.diagnosis ? (
        <p className="panel" data-diagnosis={view.diagnosis.kind} data-confirmed="false">
          <StatusMark kind="review" /> {deskText(t, view.diagnosis.title)}. {deskText(t, view.diagnosis.detail)}
        </p>
      ) : null}

      {view.state === "empty" ? (
        <p className="empty" role="status">
          {t("svp")}</p>
      ) : null}

      {view.state === "ready" ? <FeatureTable rows={view.features} /> : null}
      {view.state === "error" && view.features.length > 0 ? <FeatureTable rows={view.features} /> : null}

      <section className="panel">
        <h3>{t("s1nk")}</h3>
        <p>
          <StatusMark kind="review" /> {t("s1xu")}</p>
        <div className="handoff-scroll" role="region" aria-label={t("s1nj")} tabIndex={0}>
          <table>
            <caption>{t("sd7")}</caption>
            <thead>
              <tr>
                <th>{t("sd5")}</th>
                <th>{t("s1j7")}</th>
                <th>{t("shell.nav")}</th>
              </tr>
            </thead>
            <tbody>
              {deskText(t, SUPPORTED_COMMANDS.map((command) => (
                <tr key={`${command.sender}-${command.action}`} data-command={command.action} data-integration="not-complete">
                  <td>{deskText(t, command.action)}</td>
                  <td>{deskText(t, command.sender)}</td>
                  <td>{command.surfaces.join(", ")}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
        <p>
          {t("s12n")}{" "}{deskText(t, NEVER_SENT_HANDOFF.join(", "))}{t("s1k4")}</p>
        <p>
          {t("s18b")}{" "}{PLACE_HOLD_HANDOFF.status}{t("se3")}{" "}{PLACE_HOLD_HANDOFF.consideredAction}{t("srp")}{" "}{PLACE_HOLD_HANDOFF.mappedOntoPrepareTrade ? t("s277") : t("stt")}.
        </p>
        <p>
          {t("sri")}{" "}{deskText(t, LOCAL_COMMAND_SCREENS.map((row) => row.id).join(", "))}{t("s254")}{" "}
          {deskText(t, UNCONNECTED_SCREENS.map((row) => row.id).join(", "))}.
        </p>
      </section>

      <section className="panel">
        <h3>{t("s17s")}</h3>
        <p>{t("s1xs")}</p>
        <div className="handoff-scroll" role="region" aria-label={t("s17t")} tabIndex={0}>
          <table>
            <caption>{t("s17u")}</caption>
            <thead>
              <tr>
                <th>{t("snl")}</th>
                <th>{t("s1np")}</th>
                <th>{t("sdn")}</th>
                <th>{t("s10r")}</th>
              </tr>
            </thead>
            <tbody>
              {deskText(t, PENDING_PRODUCERS.map((row) => (
                <tr key={row.id} data-pending={row.id} data-connected="false">
                  <td>{deskText(t, row.id)}</td>
                  <td>{deskText(t, row.waitingSurface) ?? t("sw9")}</td>
                  <td>{t("stt")}</td>
                  <td>{deskText(t, row.note)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h3>{t("s1hh")}</h3>
        <div role="tablist" aria-label={t("sn2")}>
          {deskText(t, WORKSPACE_ROLES.map((item) => (
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
              {deskText(t, ROLE_LABEL[item])}
            </button>
          )))}
        </div>
        <div id={panelId} role="tabpanel" aria-labelledby={`handoff-tab-${view.role}`}>
          <p>
            <StatusMark kind="selected" /> {deskText(t, ROLE_LABEL[view.role])} {t("spn")}</p>
          <ol>
            {deskText(t, view.steps.map((step) => (
              <li key={step.id} data-step={step.id} data-integration="not-complete">
                <strong>{deskText(t, step.id)}</strong>{" "}
                {step.link ? <Link to={step.link}>{deskText(t, step.route)}</Link> : <span>{deskText(t, step.route)}</span>}{" "}
                {step.statuses.join(", ") || t("s25n")}. {deskText(t, step.note)}
              </li>
            )))}
          </ol>
        </div>
      </section>

      <section className="panel">
        <h3>{t("s190")}</h3>
        <p>{t("s1ut")}</p>
        <ul>
          {deskText(t, ORIGINAL10_EVIDENCE.map((item) => (
            <li key={item.id}>
              {deskText(t, item.id)} · {deskText(t, item.doc)}
            </li>
          )))}
        </ul>
        <p>
          {t("s187")}{" "}{deskText(t, HANDOFF_PINS.contractOpenApiSha256.slice(0, 12))} {t("s3s")}{" "}{deskText(t, HANDOFF_PINS.gateOpenApiSha256.slice(0, 12))}{t("ssn")}{" "}{deskText(t, HANDOFF_PINS.protocolMergeSha.slice(0, 12))}{". "}{t("merge.featureRows")} {deskText(t, FEATURE_ROWS.length)}{t("spl")}{" "}{deskText(t, Object.keys(ROLE_JOURNEYS).join(", "))}.
        </p>
        <p>
          {CONSUMED_PRODUCERS.map((producer) => (
            <span key={producer.id}>
              {t("merge.consumedProducer", { id: producer.id, pr: producer.pr, sha: producer.producerMergeSha.slice(0, 12), catalogue: producer.catalogueSha256.slice(0, 12), manifest: producer.manifestSha256.slice(0, 12), profile: producer.profileRevision, grants: producer.grants })}
            </span>
          ))}
        </p>
      </section>
    </div>
  );
}

function FeatureTable({ rows }: { rows: readonly FeatureRow[] }) {
  const t = useT(mergedCopy, copy0, copy1, copy2);
  return (
    <div className="handoff-scroll" role="region" aria-label={t("skx")} tabIndex={0}>
      <table>
        <caption>{t("skv")}</caption>
        <thead>
          <tr>
            <th>{t("sku")}</th>
            <th>{t("s1ho")}</th>
            <th>{t("s1he")}</th>
            <th>{t("s1mj")}</th>
            <th>{t("sob")}</th>
            <th>{t("sd6")}</th>
          </tr>
        </thead>
        <tbody>
          {deskText(t, rows.map((row) => (
            <tr key={row.id} data-feature={row.id} data-status={row.status} data-integration="not-complete">
              <td>{deskText(t, row.id)}</td>
              <td>
                {row.route.startsWith("/") && !row.route.includes(":") ? <Link to={row.route}>{deskText(t, row.route)}</Link> : row.route}
              </td>
              <td>{deskText(t, row.role)}</td>
              <td>{deskText(t, row.status)}</td>
              <td>{t("s10h")}</td>
              <td>{row.commands.length > 0 ? row.commands.join(", ") : t("common.empty")}</td>
            </tr>
          )))}
        </tbody>
      </table>
    </div>
  );
}
