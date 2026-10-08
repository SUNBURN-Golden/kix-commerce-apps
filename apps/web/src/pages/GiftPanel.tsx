import { GIFT_DESK_NOT_BOUND, GIFT_NOT_COMPOSED, JOURNEY_RULING } from "@kix/protocol-adapter";
import type { GiftPanelModel, GiftRowStatus } from "../gift-desk";

const STATUS_TEXT: Record<GiftRowStatus, string> = {
  "not-started": "Not started",
  ready: "Ready",
  "in-flight": "In flight",
  confirmed: "Confirmed",
  rejected: "Rejected by the gate",
  unconfirmed: "Unconfirmed",
  "not-sent": "Not sent",
  blocked: "Blocked",
  unavailable: "Unavailable",
};

export function GiftPanel({ model }: { model: GiftPanelModel }) {
  const unavailable = model.path.kind === "unavailable";
  return (
    <aside className="panel gift-panel" aria-label="Gift transfer" data-gift-path={model.path.kind}>
      <p className="eyebrow">{eyebrow(model)}</p>
      <h3>Gift transfer</h3>
      <p>{JOURNEY_RULING}</p>
      {model.source === "stub-shape" ? <p>Stub-shape receipts are not from the gate.</p> : null}
      <p>Gift offer is not a credit draw.</p>
      <p>No funds.</p>
      <p>The right must already be held. The booking journey does not produce a giftable right.</p>
      <p className="muted">The donor and recipient are caller-supplied strings. They are not an authentication result.</p>
      <p className="muted">expiresAt and expectedVersion are caller-supplied. This desk does not default them.</p>
      <p className="muted">A reload clears this page-load transfer and uses a new attempt id.</p>
      <p className="muted">The same gift id after a reload is a new attempt. It is not a confirmation of the earlier request.</p>
      {model.path.kind === "checking" ? (
        <p className="muted">Environment integration-http. Loopback status is not loaded yet.</p>
      ) : null}
      {unavailable ? (
        <p className="alert" role="alert">
          Gift path unavailable. The reviewed gate answers no CORS preflight; the desk stays on integration HTTP and
          does not fall back to the stub. Node tests exercise the live gate. A browser path needs a kix-protocol gate
          change.
          {model.path.kind === "unavailable" && model.path.code ? ` Code ${model.path.code}.` : ""}
        </p>
      ) : null}
      <p>{model.lastConfirmed}</p>
      <p>{model.unconfirmed}</p>
      <ol className="journey-steps">
        {model.rows.map((row) => (
          <li key={row.step} className="journey-step" data-status={row.status}>
            <p className="eyebrow">{row.label}</p>
            <p>{row.step}</p>
            <dl className="facts">
              <div>
                <dt>Status</dt>
                <dd>{STATUS_TEXT[row.status]}</dd>
              </div>
              <div>
                <dt>Operation</dt>
                <dd>{row.operationId ?? "none"}</dd>
              </div>
              <div>
                <dt>Actor</dt>
                <dd>{row.actor ?? "none"}</dd>
              </div>
              <div>
                <dt>Code</dt>
                <dd>{row.code ?? "none"}</dd>
              </div>
              {row.requestId ? (
                <div>
                  <dt>Request</dt>
                  <dd>{row.requestId}</dd>
                </div>
              ) : null}
              {row.correlationId ? (
                <div>
                  <dt>Correlation</dt>
                  <dd>{row.correlationId}</dd>
                </div>
              ) : null}
            </dl>
            {row.note ? <p>{row.note}</p> : null}
            {row.receipt ? (
              <dl className="facts">
                {row.receipt.map((field) => (
                  <div key={field.key}>
                    <dt>{field.key}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <div className="row-actions">
              <button type="button" disabled={!row.canSend} onClick={() => model.send(row.step)}>
                Send {row.step}
              </button>
            </div>
          </li>
        ))}
      </ol>
      <p className="eyebrow">Not composed</p>
      <dl className="facts">
        {GIFT_NOT_COMPOSED.map((entry) => (
          <div key={entry.action}>
            <dt>{entry.action}</dt>
            <dd>Not composed. {entry.reason}</dd>
          </div>
        ))}
      </dl>
      <p className="eyebrow">Desk methods not bound</p>
      <dl className="facts">
        {GIFT_DESK_NOT_BOUND.map((entry) => (
          <div key={entry.method}>
            <dt>{entry.method}</dt>
            <dd>
              {entry.consideredAction ?? "none"} · not-bound. {entry.reason}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function eyebrow(model: GiftPanelModel): string {
  if (model.path.kind === "available-stub-shape" || model.source === "stub-shape") {
    return "P02 transfer · stub-shape receipts";
  }
  if (model.path.kind === "unavailable") {
    return "integration-http · unavailable";
  }
  if (model.path.kind === "checking") {
    return "integration-http · checking";
  }
  if (model.path.kind === "available") {
    return "integration-http · available";
  }
  return "P02 transfer";
}
