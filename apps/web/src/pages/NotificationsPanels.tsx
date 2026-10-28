import { ReadRow } from "./ReadState";
import { messages as mergedCopy } from "../i18n/messages/merged-surfaces";
import { messages as copy0 } from "../i18n/messages/pages--NotificationsPanels";
import { messages as copy1 } from "../i18n/messages/notification-inbox";
import { messages as copy2 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
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
  const t = useT(mergedCopy, copy0, copy1, copy2);
  return (
    <span className="status-mark" data-status-mark="blocked">
      <span className="status-word">{deskText(t, word)}</span>
    </span>
  );
}

/** A wide table scrolls inside its own region, so the page does not scroll sideways. */
function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  const t = useT(mergedCopy, copy0, copy1, copy2);
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
  const t = useT(mergedCopy, copy0, copy1, copy2);
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
        {deskText(t, label)}
      </ConnectivityWriteButton>
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

export function NotifyBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: NotifyScenario;
  model: NotifyModel;
}) {
  const t = useT(mergedCopy, copy0, copy1, copy2);
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">{t("s11q")}</p>
      <h2>{deskText(t, NOTIFY_PAGE_TITLE)}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-notification-inbox">
        SYNTHETIC. {deskText(t, NOTIFY_SOURCE_LINE)}
      </p>
      <p>{deskText(t, NOTIFY_BOUNDARY)}</p>
      <p>{deskText(t, NOTIFY_DEDUPE_NOTE)}</p>
      <p>{deskText(t, NOTIFY_CURRENT_NOTE)}</p>
      <p>{deskText(t, NOTIFY_SENSITIVE_NOTE)}</p>
      <p>{deskText(t, NOTIFY_ACTION_NOTE)}</p>
      <p>{deskText(t, NOTIFY_INQUIRY_NOTE)}</p>
      <p data-hide-note="true">{deskText(t, NOTIFY_HIDE_NOTE)}</p>
      <p>{deskText(t, NOTIFY_SCOPE_NOTE)}</p>
      <p>{deskText(t, NOTIFY_ACTOR_NOTE)}</p>
      <p>{deskText(t, NOTIFY_CLAIM_NOTE)}</p>
      <p>{deskText(t, NOTIFY_READ_NOTE)}</p>
      <p>{deskText(t, NOTIFY_SESSION_NOTE)}</p>
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
  const t = useT(mergedCopy, copy0, copy1, copy2);
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
  const t = useT(mergedCopy, copy0, copy1, copy2);
  const [focusText, setFocusText] = useState("");
  return (
    <section id="notify-controls" className="discovery-section" aria-label={t("s1o9")}>
      <div className="discovery-controls">
        <PickAndApply
          id="notify-scenario"
          label={t("s1p5")}
          value={scenario}
          options={NOTIFY_SCENARIOS}
          applyId="notify-apply-scenario"
          applyLabel={t("s1m5")}
          onApply={(next) => actions.setScenario(next as NotifyScenario)}
        />
        <PickAndApply
          id="notify-actor"
          label={t("sgd")}
          value={actorRef}
          options={NOTIFY_ACTORS}
          applyId="notify-apply-actor"
          applyLabel={t("s1o6")}
          onApply={(next) => actions.switchActor(next)}
        />
        <PickAndApply
          id="notify-role"
          label={t("s1hg")}
          value={role}
          options={NOTIFY_ROLES}
          applyId="notify-apply-role"
          applyLabel={t("s1o7")}
          onApply={(next) => actions.switchRole(next as NotifyRole)}
        />
        <button type="button" id="notify-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          {t("s1ax")}</button>
        <button type="button" id="notify-switch-tenant" className="discovery-action" onClick={() => actions.switchTenant()}>
          {t("s1o3")}{deskText(t, NOTIFY_OWN)} / {deskText(t, NOTIFY_FOREIGN)})
        </button>
        <ConnectivityWriteButton type="button" id="notify-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          {t("s1m2")}</ConnectivityWriteButton>
      </div>
      <div className="discovery-controls" role="group" aria-label={t("sgn")}>
        <label htmlFor="notify-focus-ref">
          {t("s14u")}<input
            id="notify-focus-ref"
            name="notify-focus-ref"
            autoComplete="off"
            placeholder={t("s13f")}
            value={focusText}
            onChange={(event) => setFocusText(event.target.value)}
          />
        </label>
        <button type="button" id="notify-open-ref" className="discovery-action" onClick={() => actions.openNotification(focusText)}>
          {t("s15h")}</button>
      </div>
      <div className="discovery-controls" role="group" aria-label={t("s1p9")}>
        <ConnectivityWriteButton type="button" id="notify-revoke-grant" className="discovery-action" onClick={() => actions.revokeGrant()}>
          {t("s1kh")}</ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="notify-rotate-grant" className="discovery-action" onClick={() => actions.rotateGrant()}>
          {t("s1ki")}</ConnectivityWriteButton>
        <button type="button" id="notify-deliver-late" className="discovery-action" onClick={() => actions.deliverLate()}>
          {t("s1kd")}</button>
      </div>
      <p className="muted">
        {t("s4v")}</p>
      <p className="muted" data-scenario-note={scenario}>
        {deskText(t, NOTIFY_SCENARIO_NOTES[scenario])} {t("scd")}</p>
      <p className="muted">{deskText(t, NOTIFY_SYNTHETIC_CONTROL_NOTE)}</p>
    </section>
  );
}

export function NotifyStatus({ model }: { model: NotifyModel }) {
  const t = useT(mergedCopy, copy0, copy1, copy2);
  return (
    <section id="notify-status" className="discovery-section" tabIndex={-1} aria-live="polite" aria-busy={model.state === "loading"} data-notify-state={model.state}>
      <h3>{t("s1mj")}</h3>
      {model.state === "loading" || model.state === "empty" || model.state === "stale" || model.state === "not-bound" ? (
        <AsyncState announcement="parent" kind={model.state} label={t("merge.inbox")} data-status={model.state}><p>{deskText(t, model.statusLine)} {deskText(t, model.detailLine)}</p></AsyncState>
      ) : <p data-status={model.state}>{deskText(t, model.statusLine)}
        {model.detailLine ? t("sgg", { detailLine: model.detailLine }) : ""}
      </p>}
      <p className="muted" aria-live="off">{deskText(t, model.freshnessWord)}</p>
      <p className="muted" aria-live="off">{deskText(t, model.scopeLine)}</p>
      <p className="muted" aria-live="off">{deskText(t, model.generationLine)}</p>
      <p className="muted" aria-live="off">{deskText(t, model.watermarkLine)}</p>
      <p className="muted" aria-live="off" data-unread-line="true">
        {deskText(t, model.unreadLine)}
      </p>
      <p className="muted" aria-live="off" data-dedupe-line="true">
        {deskText(t, model.dedupeLine)}
      </p>
      {model.lastLine ? (
        <p data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word={t("s91")} /> : null} {deskText(t, model.lastLine)}
        </p>
      ) : null}
    </section>
  );
}

export function NotifyAuthoritySection({ model }: { model: NotifyModel }) {
  const t = useT(mergedCopy, copy0, copy1, copy2);
  return (
    <section id="notify-authority" className="discovery-section" aria-label={t("s26m")}>
      <h3>{t("s26m")}</h3>
      <p className="muted">
        {t("s1ba")}</p>
      <ScrollTable label={t("sba")}>
        <table className="finance-authority">
          <caption>{t("s1ye")}</caption>
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

export function NotifyFocusSection({ model }: { model: NotifyModel }) {
  const t = useT(mergedCopy, copy0, copy1, copy2);
  if (model.focus === null) {
    return null;
  }
  return (
    <section id="notify-focus" className="discovery-section" aria-label={t("sfp")} data-focus-kind="notification">
      <h3>{deskText(t, model.focus.title)}</h3>
      {deskText(t, model.focus.lines.map((line) => (
        <p key={line}>{deskText(t, line)}</p>
      )))}
    </section>
  );
}

export function NotifyInboxSection({ model, actions }: { model: NotifyModel; actions: NotifyActions }) {
  const t = useT(mergedCopy, copy0, copy1, copy2);
  return (
    <section id="notify-inbox" className="discovery-section" aria-label={t("snt")} data-row-count={model.rows.length}>
      <h3>{t("snt")}</h3>
      <p className="muted">
        {t("s7l")}</p>
      {model.markBlock ? (
        <p id="notify-mark-reason" className="muted" data-blocked-reason="true" data-block="mark-read">
          <WordMark word={t("status.transport.blocked")} /> {t("ss3")}{" "}{deskText(t, model.markBlock)}
        </p>
      ) : null}
      {model.resolveBlock ? (
        <p id="notify-resolve-reason" className="muted" data-blocked-reason="true" data-block="resolve">
          <WordMark word={t("status.transport.blocked")} /> {t("s1gi")}{" "}{deskText(t, model.resolveBlock)}
        </p>
      ) : null}
      {model.rows.length === 0 ? <p data-state="empty">{t("swf")}</p> : null}
      {model.rows.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s11u")}>
          {deskText(t, model.rows.map((row) => (
            <ReadRow as="li" name="item" value={row.notificationRef}
              key={row.notificationRef}
              data-notification={row.notificationRef}
              data-notification-read={row.readWord === copy0.en["s1av"] ? "true" : "false"}
              data-issue-state={row.issueState}
            >
              <Synthetic /> <strong>{deskText(t, row.notificationRef)}</strong> {deskText(t, row.kindWord)} {t("s1je")}{" "}{deskText(t, row.seq)}). {deskText(t, row.headline)}{" "}
              <span className="muted">
                {deskText(t, row.readWord)}. {deskText(t, row.issueWord)}{t("sov")}{" "}{deskText(t, row.issuedAt)}. {deskText(t, row.sensitiveLine)}
              </span>
              <br />
              {row.detailLine ? <span data-detail="notification">{deskText(t, row.detailLine)}</span> : null}
              <br />
              <span className="muted">{deskText(t, row.offerWord)}</span>
              <br />
              {row.markRead === null ? null : (
                <GuardedButton
                  id={`notify-mark-${row.notificationRef}`}
                  label={t("ss4", { notificationRef: row.notificationRef })}
                  control={row.markRead}
                  describedBy={model.markBlock ? "notify-mark-reason" : undefined}
                  onPress={() => actions.markRead(row.notificationRef)}
                />
              )}
              {row.resolve === null ? null : (
                <GuardedButton
                  id={`notify-resolve-${row.notificationRef}`}
                  label={t("s1gh", { notificationRef: row.notificationRef })}
                  control={row.resolve}
                  describedBy={model.resolveBlock ? "notify-resolve-reason" : undefined}
                  onPress={() => actions.resolveAction(row.notificationRef)}
                />
              )}
            </ReadRow>
          )))}
        </ul>
      ) : null}
      <ScrollTable label={t("s11p")}>
        {model.rows.length > 0 ? (
          <table className="finance-cuts">
            <caption>{t("sfo")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("s11o")}</th>
                <th scope="col">{t("sfn")}</th>
                <th scope="col">{t("sps")}</th>
                <th scope="col">{t("s1jd")}</th>
                <th scope="col">{t("s1av")}</th>
                <th scope="col">{t("sos")}</th>
              </tr>
            </thead>
            <tbody>
              {deskText(t, model.rows.map((row) => (
                <tr key={row.notificationRef} data-notification-row={row.notificationRef}>
                  <th scope="row">{deskText(t, row.notificationRef)}</th>
                  <td>{deskText(t, row.dedupeKey)}</td>
                  <td>{deskText(t, row.kindWord)}</td>
                  <td>{deskText(t, row.seq)}</td>
                  <td>{deskText(t, row.readWord)}</td>
                  <td>{deskText(t, row.issueWord)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        ) : null}
      </ScrollTable>
    </section>
  );
}

export function NotifyInquirySection({ model, actions }: { model: NotifyModel; actions: NotifyActions }) {
  const t = useT(mergedCopy, copy0, copy1, copy2);
  const inquiry = model.inquiry;
  const destination = model.request?.destination ?? null;
  return (
    <section id="notify-inquiry" className="discovery-section" aria-label={t("s1nm")} data-inquiry-phase={inquiry.phase}>
      <h3>{t("s1nm")}</h3>
      <p data-inquiry-status={inquiry.phase}>{deskText(t, inquiry.statusLine)}</p>
      {inquiry.detailLine ? <p className="muted">{deskText(t, inquiry.detailLine)}</p> : null}
      {destination !== null && destination.kind === "authority" ? (
        <p data-destination="authority">
          {t("s1x7")}{" "}
          <Link to={destination.href}>{t("s15f")}</Link> {t("s3t")}{" "}<strong>{destination.ref}</strong> {t("s1wh")}</p>
      ) : null}
      {destination !== null && destination.kind === "support" ? (
        <p data-destination="support">
          {t("s1x6")}{" "}{deskText(t, destination.inquiryRef)}.{" "}
          <GuardedButton
            id="notify-open-inquiry"
            label={t("s15g", { inquiryRef: destination.inquiryRef })}
            control={model.inquiryControl}
            onPress={() => actions.loadInquiry(destination.inquiryRef)}
          />
        </p>
      ) : null}
      {inquiry.declarationLine ? (
        <p className="muted" data-inquiry-declaration="declared">
          {deskText(t, inquiry.declarationLine)}
        </p>
      ) : null}
      {inquiry.notificationRef ? <p className="muted">{t("ss9")}{" "}{deskText(t, inquiry.notificationRef)}.</p> : null}
      {inquiry.rows.length > 0 ? (
        <dl data-inquiry-lines="true">
          {deskText(t, inquiry.rows.map((row) => (
            <div key={row.label}>
              <dt>{deskText(t, row.label)}</dt>
              <dd>{deskText(t, row.text)}</dd>
            </div>
          )))}
        </dl>
      ) : null}
      <p className="muted">{deskText(t, NOTIFY_INQUIRY_NOTE)}</p>
    </section>
  );
}

export function NotifyRequestsSection({ model }: { model: NotifyModel }) {
  const t = useT(mergedCopy, copy0, copy1, copy2);
  return (
    <section id="notify-requests" className="discovery-section" aria-label={t("s1fv")}>
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
          {model.request.phase === "unknown" ? <AsyncState kind="unknown" label={t("merge.notifyRequest")} announcement="parent" /> : null}
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

export function NotifySessionSection({ session }: { session: NotifySessionModel }) {
  const t = useT(mergedCopy, copy0, copy1, copy2);
  return (
    <section id="notify-session" className="discovery-section" aria-label={t("s1js")}>
      <h3>{t("s1js")}</h3>
      <p className="muted">{deskText(t, session.contextLine)}</p>
      <p className="muted">{deskText(t, session.capabilityLine)}</p>
      <p className="muted">{deskText(t, session.countersLine)}</p>
      <p className="muted">{deskText(t, session.earlierUnknownLine)}</p>
      <p className="muted" data-hold-record="not-bound">
        {deskText(t, session.holdLine)}
      </p>
      <p className="muted" data-not-composed="recorded">
        {deskText(t, session.notComposedLine)}
      </p>
    </section>
  );
}
