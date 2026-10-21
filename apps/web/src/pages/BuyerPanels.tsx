import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy0 } from "../i18n/messages/pages--BuyerPanels";
import { messages as copy1 } from "../i18n/messages/buyer-workspace";
import { messages as copy2 } from "../i18n/messages/gift-desk";
import { messages as copy3 } from "../i18n/messages/storage-allow-list";
import { messages as copy4 } from "../i18n/messages/journey-desk";
import { messages as copy5 } from "../i18n/messages/resale-desk";
import { messages as copy6 } from "../i18n/messages/reservation-desk";
import { messages as copy7 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { Link } from "react-router-dom";
import { StatusMark } from "../a11y/marks";
import type { BuyerEvidenceRow, BuyerProgressRow, BuyerReturnAction, BuyerWorkspaceModel } from "../buyer-workspace";
import { TRACK_STATE_CONTRACT } from "../workspace/registry";

export function StateNotice({ model }: { model: BuyerWorkspaceModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7);
  if (model.catalog.kind === "error") {
    return (
      <p className="alert" role="alert">
        <StatusMark kind="blocked" /> {deskText(t, model.catalog.message)}
      </p>
    );
  }
  if (model.catalog.kind === "not-bound") {
    return (
      <p className="alert" role="alert">
        <StatusMark kind="blocked" /> {deskText(t, model.catalog.reason)}
      </p>
    );
  }
  if (model.catalog.kind === "loading") {
    return (
      <p className="muted" role="status">
        <StatusMark kind="loading" /> {t("desk.performance.loading")}</p>
    );
  }
  if (model.catalog.kind === "empty") {
    return <p className="empty">{t("desk.performance.empty")}</p>;
  }
  return null;
}

export function ReturnAction({ action, onReadAgain }: { action: BuyerReturnAction; onReadAgain: () => void }) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7);
  if (action.readAgain) {
    return (
      <button type="button" className="buyer-action" onClick={() => onReadAgain()}>
        {deskText(t, action.label)}
      </button>
    );
  }
  if (action.to) {
    return (
      <Link className="button buyer-action" to={action.to}>
        {deskText(t, action.label)}
      </Link>
    );
  }
  return null;
}

export function ProgressRow({ row, onReadAgain }: { row: BuyerProgressRow; onReadAgain: () => void }) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7);
  const contract = TRACK_STATE_CONTRACT[row.state];
  return (
    <li
      className="buyer-progress"
      data-stage={row.stage}
      data-track={row.track ?? ""}
      data-state={row.state}
      data-source={row.source}
    >
      <p className="eyebrow">{deskText(t, row.stage)}</p>
      <h3>{deskText(t, row.label)}</h3>
      <p>{deskText(t, row.track) ?? t("swo")}</p>
      <p>{row.state}</p>
      <p>{deskText(t, contract.copy)}</p>
      <p>{deskText(t, contract.provenance)}</p>
      {row.reason ? <p>{deskText(t, row.reason)}</p> : null}
      <p>{t("desk.buyer.source")}{" "}{row.source}</p>
      {row.returnAction ? <ReturnAction action={row.returnAction} onReadAgain={onReadAgain} /> : null}
    </li>
  );
}

export function EvidenceRow({ row }: { row: BuyerEvidenceRow }) {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7);
  return (
    <li className="buyer-evidence" data-kind={row.kind} data-source={row.source}>
      <p className="eyebrow">{row.kind}</p>
      <p>
        <Link className="button buyer-action" to={row.deskRoute}>
          {deskText(t, row.refId)}
        </Link>
      </p>
      <p>{row.operationId ?? t("common.empty")}</p>
      <p>{deskText(t, row.step)}</p>
      <p>{row.status}</p>
      <p>{t("desk.buyer.source")}{" "}{row.source}</p>
    </li>
  );
}
