import { messages as mergedCopy } from "../i18n/messages/merged-surfaces";
import { sourceMessage } from "../i18n/source-message";
import { messages as copy0 } from "../i18n/messages/pages--OrganizerWorkspace";
import { messages as copy1 } from "../i18n/messages/organizer-workspace";
import { messages as copy2 } from "../i18n/messages/organizer-desk";
import { messages as copy3 } from "../i18n/messages/storage-allow-list";
import { messages as copy4 } from "../i18n/messages/journey-desk";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import type { ValidationHandle } from "../forms/useFormValidation";
import { ValidatedForm } from "../forms/ValidatedForm";
import { field } from "../forms/validation";
import { AsyncState } from "../components/AsyncState";
import { useEffect, useRef } from "react";
import { COMMERCE_COMMAND_BINDINGS, ORGANIZER_COMPOSED, type OrganizerStep } from "@kix/protocol-adapter";
import { focusControl } from "../a11y/focus";
import { AmountNotice, StatusMark } from "../a11y/marks";
import {
  ORGANIZER_DESK_NOT_BOUND,
  ORGANIZER_NOT_COMPOSED,
  ORGANIZER_UNCONNECTED,
  seatsTypedLine,
  useOrganizerWorkspace,
  type OrganizerBatchItemResult,
  type OrganizerWorkspaceModel,
} from "../organizer-workspace";

export function OrganizerWorkspacePage() {
  const model = useOrganizerWorkspace();
  return <OrganizerWorkspaceScreen model={model} />;
}

export function OrganizerWorkspaceScreen({ model }: { model: OrganizerWorkspaceModel }) {
  const t = useT(mergedCopy, copy0, copy1, copy2, copy3, copy4);
  const validation = useRef<ValidationHandle>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const previewFault = model.plan?.items.find((item) => item.state !== "ready") ?? null;
  useEffect(() => {
    if (model.submitting || !model.results) {
      return;
    }
    const failed = model.results.items.some((item) => item.status !== "RECEIPT");
    if (failed) {
      focusControl("organizer-ws-event-id");
      return;
    }
    resultsRef.current?.focus();
  }, [model.results, model.submitting]);
  useEffect(() => {
    if (!previewFault) {
      return;
    }
    focusControl("organizer-ws-event-id");
  }, [previewFault]);

  const closed = !model.pathOpen;
  const createFields = model.editor.step === "create_event";
  const inviteFields = model.editor.step === "issue_invitation";

  return (
    <section className="organizer-ws" aria-busy={model.submitting}>
      <header className="section-head organizer-ws-section">
        <p className="eyebrow">{t("route.organizer-workspace")}</p>
        <h2>{t("route.organizer-workspace")}</h2>
        <p>{deskText(t, model.ruling)}</p>
        {model.path.kind === "available-stub-shape" ? <p>{deskText(t, model.stubSentence)}</p> : null}
        <p>{deskText(t, model.actorNote)}</p>
        <p>{deskText(t, model.fundsNote)}</p>
        <p>{deskText(t, model.reloadNote)}</p>
        <p>{deskText(t, model.batchNote)}</p>
        <AmountNotice />
      </header>
      {closed ? (
        <p className="alert" role="alert">
          <StatusMark kind="blocked" /> {t("s16a")}{model.path.kind === "unavailable" && model.path.code ? t("sd4", { code: model.path.code }) : ""}
        </p>
      ) : null}
      {/* One polite region: the empty, submitting and result lines replace each other inside it. */}
      <div id="organizer-ws-status" role="status" aria-live="polite" aria-busy={model.submitting}>
        {model.submitting || !model.results ? (
          <AsyncState announcement="parent" kind={model.submitting ? "loading" : "empty"} label={t("merge.organizerResults")} className="organizer-ws-status">
            <p>{model.submitting ? t("s1nd") : t("sxv")}</p>
          </AsyncState>
        ) : <p className="organizer-ws-status">{deskText(t, model.results.summary)}</p>}
      </div>
      <ValidatedForm id="organizer-workspace-form" validationRef={validation} submitFields={[]} fields={[
          field("organizer-ws-event-id", "validation.label.eventId"),
          field("organizer-ws-seats", "validation.label.seats", { kind: "seats" }),
          field("organizer-ws-quota", "validation.label.quota", { kind: "integer", optional: true }),
          field("organizer-ws-seconds", "validation.label.seconds", { kind: "integer", optional: true }),
          field("organizer-ws-inventory-id", "validation.label.inventoryId"),
          field("organizer-ws-version", "validation.label.version", { kind: "integer" }),
          field("organizer-ws-recipient", "validation.label.recipient"),
        ]}
        className="organizer-ws-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (model.canSubmit) {
            model.submit();
          }
        }}
      >
        <fieldset className="organizer-ws-fields" disabled={model.writesDisabled} aria-busy={model.submitting} style={{ overflowWrap: "anywhere" }}>
          <div className="panel organizer-ws-editor">
            <h3>{t("s1hq")}</h3>
            <label>
              {t("s1mn")}<select
                value={model.editor.step}
                onChange={(event) => model.setEditor({ step: event.target.value as OrganizerStep })}
              >
                {deskText(t, ORGANIZER_COMPOSED.map((step) => (
                  <option key={step} value={step}>
                    {deskText(t, step)}
                  </option>
                )))}
              </select>
            </label>
            <label htmlFor="organizer-ws-event-id">
              {t("sis")}<input
                id="organizer-ws-event-id"
                value={model.editor.eventId}
                autoComplete="off"
                aria-invalid={previewFault !== null}
                aria-describedby={previewFault ? "organizer-ws-preview-error" : undefined}
                onChange={(event) => model.setEditor({ eventId: event.target.value })}
              />
            </label>
            {createFields ? (
              <>
                <label>
                  {t("s1ir")}<input id="organizer-ws-seats"
                    value={model.editor.draft.seats}
                    autoComplete="off"
                    placeholder={t("sd8")}
                    onChange={(event) => model.setEditor({ draft: { seats: event.target.value } })}
                  />
                </label>
                <p>{deskText(t, seatsTypedLine(model.editor.draft.seats))}</p>
                <label>
                  {t("soq")}<input id="organizer-ws-quota"
                    value={model.editor.draft.invitationQuota}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={t("sat")}
                    onChange={(event) => model.setEditor({ draft: { invitationQuota: event.target.value } })}
                  />
                </label>
                <label>
                  {t("s1g8")}<input id="organizer-ws-seconds"
                    value={model.editor.draft.reservationSeconds ?? ""}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={t("sat")}
                    onChange={(event) => model.setEditor({ draft: { reservationSeconds: event.target.value } })}
                  />
                </label>
              </>
            ) : null}
            {createFields || inviteFields ? (
              <label>
                {t("s167")}<input
                  value={model.editor.draft.organizer ?? ""}
                  autoComplete="off"
                  placeholder={t("sa4")}
                  onChange={(event) => model.setEditor({ draft: { organizer: event.target.value } })}
                />
              </label>
            ) : null}
            {inviteFields ? (
              <>
                <label>
                  {t("son")}<input id="organizer-ws-inventory-id"
                    value={model.editor.draft.inventoryId}
                    list="organizer-ws-inventory"
                    autoComplete="off"
                    placeholder={t("sau")}
                    onChange={(event) => model.setEditor({ draft: { inventoryId: event.target.value } })}
                  />
                </label>
                <datalist id="organizer-ws-inventory">
                  {deskText(t, model.suggestions.map((id) => (
                    <option key={id} value={id} />
                  )))}
                </datalist>
                {model.suggestions.length > 0 ? (
                  <p>{t("s1dd")}</p>
                ) : null}
                <label>
                  {t("sk7")}<input id="organizer-ws-version"
                    value={model.editor.draft.expectedInventoryVersion}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={t("sas")}
                    onChange={(event) => model.setEditor({ draft: { expectedInventoryVersion: event.target.value } })}
                  />
                </label>
                <label>
                  {t("s1di")}<input id="organizer-ws-recipient"
                    value={model.editor.draft.recipient}
                    autoComplete="off"
                    onChange={(event) => model.setEditor({ draft: { recipient: event.target.value } })}
                  />
                </label>
              </>
            ) : null}
            <p className="muted">{t("s21x")}</p>
            <button type="button" className="organizer-ws-button" onClick={() => { if (validation.current?.validate()) model.addRow(); }}>
              {t("s17")}</button>
          </div>
          <div className="panel organizer-ws-list">
            <h3>{t("sbu")}</h3>
            {model.rows.length === 0 ? <p id="organizer-ws-empty">{t("suq")}</p> : null}
            <ul className="organizer-ws-rows">
              {deskText(t, model.rows.map((row) => (
                <li key={row.key} className="organizer-ws-row">
                  <p>
                    {deskText(t, row.step)} · {row.eventId.length > 0 ? deskText(t, row.eventId) : t("svc")}
                  </p>
                  <button type="button" className="organizer-ws-button" onClick={() => model.removeRow(row.key)}>
                    {t("s1fi")}</button>
                </li>
              )))}
            </ul>
            <button type="button" className="organizer-ws-button" disabled={!model.canPrepare} aria-describedby={model.rows.length === 0 ? "organizer-ws-empty" : undefined} onClick={model.prepare}>
              {t("s18q")}</button>
            {model.plan && !model.planCurrent ? <p id="organizer-ws-plan-stale">{t("s1qu")}</p> : null}
          </div>
          {model.plan ? (
            <div className="panel organizer-ws-preview">
              <h3>{t("s191")}</h3>
              {model.results ? null : <StatusMark kind="review" />}
              {previewFault ? (
                <p id="organizer-ws-preview-error" className="alert" role="alert">
                  <StatusMark kind="blocked" /> {deskText(t, previewFault.reason)}
                </p>
              ) : null}
              <table>
                <caption>{t("s14e")}</caption>
                <thead>
                  <tr>
                    <th>{t("sy")}</th>
                    <th>{t("s12")}</th>
                    <th>{t("sac")}</th>
                    <th>{t("s1mi")}</th>
                  </tr>
                </thead>
                <tbody>
                  {deskText(t, model.plan.items.map((item) => (
                    <tr key={item.key} data-preview-state={item.state}>
                      <td>{deskText(t, item.action) ?? deskText(t, item.step)}</td>
                      <td>{deskText(t, item.actor) ?? t("common.empty")}</td>
                      <td>
                        <pre>{item.body ? JSON.stringify(item.body) : t("common.empty")}</pre>
                      </td>
                      <td>
                        {deskText(t, item.state)}
                        {item.reason.length > 0 ? t("s1d5", { reason: item.reason }) : ""}
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          ) : null}
          <ConnectivityWriteButton type="submit" className="organizer-ws-button" disabled={!model.canSubmit}
            aria-describedby={model.rows.length === 0 ? "organizer-ws-empty" : model.plan && !model.planCurrent ? "organizer-ws-plan-stale" : undefined}>
            {t("s1na")}</ConnectivityWriteButton>
        </fieldset>
      </ValidatedForm>
      <div className="panel organizer-ws-results" style={{ overflowWrap: "anywhere" }}>
        <h3 id="organizer-ws-results" tabIndex={-1} ref={resultsRef}>
          {t("s1gl")}</h3>
        {model.results ? <p>{deskText(t, model.results.summary)}</p> : <p>{t("sxv")}</p>}
        {model.results ? (
          <ol className="organizer-ws-rows">
            {deskText(t, model.results.items.map((item) => (
              <li key={item.key} className="organizer-ws-result" data-result={item.status}>
                <p>
                  {deskText(t, item.step)} · {deskText(t, item.eventId)}
                </p>
                <p>{resultText(item)}</p>
                <p>{t("s15j")}{" "}{deskText(t, item.operationId) ?? t("common.empty")}</p>
                {item.code ? <p>{t("error.fact.code")}{" "}{deskText(t, item.code)}</p> : null}
                {item.requestId ? <p>{t("s1fq")}{" "}{deskText(t, item.requestId)}</p> : null}
                {item.correlationId ? <p>{t("sek")}{" "}{deskText(t, item.correlationId)}</p> : null}
              </li>
            )))}
          </ol>
        ) : null}
      </div>
      <div className="panel organizer-ws-unconnected">
        <h3>{t("s10k")}</h3>
        <dl className="facts">
          {deskText(t, ORGANIZER_UNCONNECTED.map((entry) => (
            <div key={entry.id}>
              <dt>{deskText(t, entry.label)}</dt>
              <dd>
                {t("sz1")}{" "}{deskText(t, entry.reason)}
              </dd>
            </div>
          )))}
        </dl>
        <p className="eyebrow">{t("s10i")}</p>
        <dl className="facts">
          {deskText(t, ORGANIZER_NOT_COMPOSED.map((entry) => (
            <div key={entry.action}>
              <dt>{deskText(t, entry.action)}</dt>
              <dd>{t("s10j")}{" "}{deskText(t, entry.reason)}</dd>
            </div>
          )))}
        </dl>
        <p className="eyebrow">{t("sge")}</p>
        <dl className="facts">
          {deskText(t, ORGANIZER_DESK_NOT_BOUND.map((entry) => (
            <div key={entry.method}>
              <dt>{deskText(t, entry.method)}</dt>
              <dd>
                <AsyncState kind="not-bound" label={t("merge.organizerDesk")} binding={{ method: entry.method, record: COMMERCE_COMMAND_BINDINGS[entry.method] }} />
              </dd>
            </div>
          )))}
        </dl>
      </div>
    </section>
  );
}

function resultText(item: OrganizerBatchItemResult): string {
  if (item.status === "REJECTED") {
    return sourceMessage(copy0.en["p.t4"], { v1: item.code ?? "" });
  }
  if (item.status === "UNKNOWN") {
    return copy0.en["s253"];
  }
  if (item.status === "STALE") {
    return copy0.en["s1ly"];
  }
  if (item.status === "NOT_ATTEMPTED") {
    return copy0.en["s109"];
  }
  if (item.status === "NOT_SENT") {
    return item.note.startsWith(copy0.en["e.24"]) ? item.note : sourceMessage(copy0.en["p.t6"], { v1: item.note });
  }
  if (item.status === "FENCED") {
    return item.note.length > 0 ? item.note : copy0.en["sky"];
  }
  return item.note.length > 0 ? item.note : copy0.en["e.33"];
}
