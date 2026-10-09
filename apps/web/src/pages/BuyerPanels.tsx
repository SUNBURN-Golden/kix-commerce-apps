import { Link } from "react-router-dom";
import type { BuyerEvidenceRow, BuyerProgressRow, BuyerReturnAction, BuyerWorkspaceModel } from "../buyer-workspace";
import { TRACK_STATE_CONTRACT } from "../workspace/registry";

export function StateNotice({ model }: { model: BuyerWorkspaceModel }) {
  if (model.catalog.kind === "error") {
    return (
      <p className="alert" role="alert">
        {model.catalog.message}
      </p>
    );
  }
  if (model.catalog.kind === "not-bound") {
    return (
      <p className="alert" role="alert">
        {model.catalog.reason}
      </p>
    );
  }
  if (model.catalog.kind === "loading") {
    return (
      <p className="muted" role="status">
        Loading performances.
      </p>
    );
  }
  if (model.catalog.kind === "empty") {
    return <p className="empty">No performances on this adapter.</p>;
  }
  return null;
}

export function ReturnAction({ action, onReadAgain }: { action: BuyerReturnAction; onReadAgain: () => void }) {
  if (action.readAgain) {
    return (
      <button type="button" className="buyer-action" onClick={() => onReadAgain()}>
        {action.label}
      </button>
    );
  }
  if (action.to) {
    return (
      <Link className="button buyer-action" to={action.to}>
        {action.label}
      </Link>
    );
  }
  return null;
}

export function ProgressRow({ row, onReadAgain }: { row: BuyerProgressRow; onReadAgain: () => void }) {
  const contract = TRACK_STATE_CONTRACT[row.state];
  return (
    <li
      className="buyer-progress"
      data-stage={row.stage}
      data-track={row.track ?? ""}
      data-state={row.state}
      data-source={row.source}
    >
      <p className="eyebrow">{row.stage}</p>
      <h3>{row.label}</h3>
      <p>{row.track ?? "No outcome track"}</p>
      <p>{row.state}</p>
      <p>{contract.copy}</p>
      <p>{contract.provenance}</p>
      {row.reason ? <p>{row.reason}</p> : null}
      <p>source {row.source}</p>
      {row.returnAction ? <ReturnAction action={row.returnAction} onReadAgain={onReadAgain} /> : null}
    </li>
  );
}

export function EvidenceRow({ row }: { row: BuyerEvidenceRow }) {
  return (
    <li className="buyer-evidence" data-kind={row.kind} data-source={row.source}>
      <p className="eyebrow">{row.kind}</p>
      <p>
        <Link className="button buyer-action" to={row.deskRoute}>
          {row.refId}
        </Link>
      </p>
      <p>{row.operationId ?? "none"}</p>
      <p>{row.step}</p>
      <p>{row.status}</p>
      <p>source {row.source}</p>
    </li>
  );
}
