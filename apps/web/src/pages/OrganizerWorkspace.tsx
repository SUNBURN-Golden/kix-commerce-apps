import { useEffect, useRef } from "react";
import { ORGANIZER_COMPOSED, type OrganizerStep } from "@kix/protocol-adapter";
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
  const resultsRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (model.results && !model.submitting) {
      resultsRef.current?.focus();
    }
  }, [model.results, model.submitting]);

  const closed = !model.pathOpen;
  const createFields = model.editor.step === "create_event";
  const inviteFields = model.editor.step === "issue_invitation";

  return (
    <section className="organizer-ws" aria-busy={model.submitting}>
      <header className="section-head organizer-ws-section">
        <p className="eyebrow">Organizer workspace</p>
        <h2>Organizer workspace</h2>
        <p>{model.ruling}</p>
        {model.path.kind === "available-stub-shape" ? <p>{model.stubSentence}</p> : null}
        <p>{model.actorNote}</p>
        <p>{model.fundsNote}</p>
        <p>{model.reloadNote}</p>
        <p>{model.batchNote}</p>
      </header>
      {closed ? (
        <p className="alert" role="alert">
          Organizer path unavailable. The reviewed gate answers no CORS preflight. The desk stays on integration HTTP
          and does not fall back to the stub. Node tests exercise the live gate. A browser path needs a kix-protocol
          gate change.
          {model.path.kind === "unavailable" && model.path.code ? ` Code ${model.path.code}.` : ""}
        </p>
      ) : null}
      <p className="organizer-ws-status" role="status">
        {model.submitting ? "Submitting. One attempt each." : model.results ? model.results.summary : "No results yet."}
      </p>
      <form
        className="organizer-ws-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (model.canSubmit) {
            model.submit();
          }
        }}
      >
        <fieldset className="organizer-ws-fields" disabled={model.writesDisabled} aria-busy={model.submitting}>
          <div className="panel organizer-ws-editor">
            <h3>Row editor</h3>
            <label>
              Step
              <select
                value={model.editor.step}
                onChange={(event) => model.setEditor({ step: event.target.value as OrganizerStep })}
              >
                {ORGANIZER_COMPOSED.map((step) => (
                  <option key={step} value={step}>
                    {step}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Event id
              <input
                value={model.editor.eventId}
                autoComplete="off"
                onChange={(event) => model.setEditor({ eventId: event.target.value })}
              />
            </label>
            {createFields ? (
              <>
                <label>
                  Seats
                  <input
                    value={model.editor.draft.seats}
                    autoComplete="off"
                    placeholder="Comma-separated seat ids"
                    onChange={(event) => model.setEditor({ draft: { seats: event.target.value } })}
                  />
                </label>
                <p>{seatsTypedLine(model.editor.draft.seats)}</p>
                <label>
                  Invitation quota
                  <input
                    value={model.editor.draft.invitationQuota}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Caller-supplied integer, or leave blank"
                    onChange={(event) => model.setEditor({ draft: { invitationQuota: event.target.value } })}
                  />
                </label>
                <label>
                  Reservation seconds
                  <input
                    value={model.editor.draft.reservationSeconds ?? ""}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Caller-supplied integer, or leave blank"
                    onChange={(event) => model.setEditor({ draft: { reservationSeconds: event.target.value } })}
                  />
                </label>
              </>
            ) : null}
            {createFields || inviteFields ? (
              <label>
                Organizer id
                <input
                  value={model.editor.draft.organizer ?? ""}
                  autoComplete="off"
                  placeholder="Blank uses the desk organizer id"
                  onChange={(event) => model.setEditor({ draft: { organizer: event.target.value } })}
                />
              </label>
            ) : null}
            {inviteFields ? (
              <>
                <label>
                  Inventory id
                  <input
                    value={model.editor.draft.inventoryId}
                    list="organizer-ws-inventory"
                    autoComplete="off"
                    placeholder="Caller-supplied inventory id"
                    onChange={(event) => model.setEditor({ draft: { inventoryId: event.target.value } })}
                  />
                </label>
                <datalist id="organizer-ws-inventory">
                  {model.suggestions.map((id) => (
                    <option key={id} value={id} />
                  ))}
                </datalist>
                {model.suggestions.length > 0 ? (
                  <p>Receipt inventory ids for this event. Typed by the caller on a later row. Not a capacity figure.</p>
                ) : null}
                <label>
                  Expected inventory version
                  <input
                    value={model.editor.draft.expectedInventoryVersion}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Caller-supplied integer"
                    onChange={(event) => model.setEditor({ draft: { expectedInventoryVersion: event.target.value } })}
                  />
                </label>
                <label>
                  Recipient
                  <input
                    value={model.editor.draft.recipient}
                    autoComplete="off"
                    onChange={(event) => model.setEditor({ draft: { recipient: event.target.value } })}
                  />
                </label>
              </>
            ) : null}
            <p className="muted">The synthetic show policy is a fixture, not a policy. It is inside the create_event body.</p>
            <button type="button" className="organizer-ws-button" onClick={model.addRow}>
              Add to change list
            </button>
          </div>
          <div className="panel organizer-ws-list">
            <h3>Change list</h3>
            {model.rows.length === 0 ? <p>No commands in the change list.</p> : null}
            <ul className="organizer-ws-rows">
              {model.rows.map((row) => (
                <li key={row.key} className="organizer-ws-row">
                  <p>
                    {row.step} · {row.eventId.length > 0 ? row.eventId : "no event id"}
                  </p>
                  <button type="button" className="organizer-ws-button" onClick={() => model.removeRow(row.key)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="organizer-ws-button" disabled={!model.canPrepare} onClick={model.prepare}>
              Prepare preview
            </button>
            {model.plan && !model.planCurrent ? <p>The change list was edited. Prepare preview again.</p> : null}
          </div>
          {model.plan ? (
            <div className="panel organizer-ws-preview">
              <h3>Preview</h3>
              <table>
                <caption>One row per command. The body is the body a send would post.</caption>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Body</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {model.plan.items.map((item) => (
                    <tr key={item.key} data-preview-state={item.state}>
                      <td>{item.action ?? item.step}</td>
                      <td>{item.actor ?? "none"}</td>
                      <td>
                        <pre>{item.body ? JSON.stringify(item.body) : "none"}</pre>
                      </td>
                      <td>
                        {item.state}
                        {item.reason.length > 0 ? ` ${item.reason}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <button type="submit" className="organizer-ws-button" disabled={!model.canSubmit}>
            Submit
          </button>
        </fieldset>
      </form>
      <div className="panel organizer-ws-results">
        <h3 id="organizer-ws-results" tabIndex={-1} ref={resultsRef}>
          Results
        </h3>
        {model.results ? <p>{model.results.summary}</p> : <p>No results yet.</p>}
        {model.results ? (
          <ol className="organizer-ws-rows">
            {model.results.items.map((item) => (
              <li key={item.key} className="organizer-ws-result" data-result={item.status}>
                <p>
                  {item.step} · {item.eventId}
                </p>
                <p>{resultText(item)}</p>
                <p>Operation {item.operationId ?? "none"}</p>
                {item.code ? <p>Code {item.code}</p> : null}
                {item.requestId ? <p>Request {item.requestId}</p> : null}
                {item.correlationId ? <p>Correlation {item.correlationId}</p> : null}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
      <div className="panel organizer-ws-unconnected">
        <h3>Not connected</h3>
        <dl className="facts">
          {ORGANIZER_UNCONNECTED.map((entry) => (
            <div key={entry.id}>
              <dt>{entry.label}</dt>
              <dd>
                NOT_BOUND. {entry.reason}
              </dd>
            </div>
          ))}
        </dl>
        <p className="eyebrow">Not composed</p>
        <dl className="facts">
          {ORGANIZER_NOT_COMPOSED.map((entry) => (
            <div key={entry.action}>
              <dt>{entry.action}</dt>
              <dd>Not composed. {entry.reason}</dd>
            </div>
          ))}
        </dl>
        <p className="eyebrow">Desk methods not bound</p>
        <dl className="facts">
          {ORGANIZER_DESK_NOT_BOUND.map((entry) => (
            <div key={entry.method}>
              <dt>{entry.method}</dt>
              <dd>
                {entry.consideredAction ?? "none"} · not-bound. {entry.reason}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function resultText(item: OrganizerBatchItemResult): string {
  if (item.status === "REJECTED") {
    return `Rejected by the gate (${item.code ?? ""}).`;
  }
  if (item.status === "UNKNOWN") {
    return "Unconfirmed: sent, no authoritative receipt. May have applied. Not a rejection.";
  }
  if (item.status === "STALE") {
    return "Stale selection. The local selection changed. Nothing was sent.";
  }
  if (item.status === "NOT_ATTEMPTED") {
    return "Not attempted.";
  }
  if (item.status === "NOT_SENT") {
    return item.note.startsWith("Not sent") ? item.note : `Not sent. ${item.note}`;
  }
  if (item.status === "FENCED") {
    return item.note.length > 0 ? item.note : "Fenced.";
  }
  return item.note.length > 0 ? item.note : "Receipt.";
}
