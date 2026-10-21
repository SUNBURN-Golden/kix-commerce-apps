import { messages as copy0 } from "../i18n/messages/pages--SettlementPanel";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import type { SettlementCaseView } from "@kix/protocol-adapter";

export const SETTLEMENT_DESK_COMMANDS = [
  "initiate",
  "authorize",
  "capture",
  "commit",
  "fail",
  "cancel",
  "reconcile",
] as const;

export type SettlementDeskCommand = (typeof SETTLEMENT_DESK_COMMANDS)[number];

const CONTROLS: readonly { command: SettlementDeskCommand; label: string; needsCase: boolean }[] = [
  { command: "initiate", label: copy0.en["e.56"], needsCase: false },
  { command: "authorize", label: copy0.en["e.57"], needsCase: true },
  { command: "capture", label: copy0.en["e.58"], needsCase: true },
  { command: "commit", label: copy0.en["e.59"], needsCase: true },
  { command: "fail", label: copy0.en["e.60"], needsCase: true },
  { command: "cancel", label: copy0.en["e.61"], needsCase: true },
  { command: "reconcile", label: copy0.en["e.4"], needsCase: true },
];

export function SettlementPanel({
  eventTitle,
  view,
  error,
  pending,
  onCommand,
  onClose,
}: {
  eventTitle: string;
  view: SettlementCaseView | null;
  error: string | null;
  pending: boolean;
  onCommand: (command: SettlementDeskCommand) => void;
  onClose: () => void;
}) {
  const t = useT(copy0);
  const opened = view !== null;
  const rejectLabel = view?.failureReason ?? view?.cancelReason ?? copy0.en["sw8"];

  return (
    <aside className="panel" aria-label={t("st5")}>
      <p className="eyebrow">{deskText(t, view?.surface) ?? t("s26b")}</p>
      <h3>{t("st5")}</h3>
      <p className="muted">{deskText(t, eventTitle)}</p>
      <p>
        {t("s1km")}</p>
      <p className="muted">
        {t("sbd")}</p>
      {error ? (
        <p className="alert" role="alert">
          {deskText(t, error)}
        </p>
      ) : null}
      <dl className="facts">
        <div>
          <dt>{t("st0")}</dt>
          <dd className="phase-name">{view?.phase ?? t("s121")}</dd>
        </div>
        <div>
          <dt>{t("s1pk")}</dt>
          <dd>{view?.terminal ? t("s276") : t("str")}</dd>
        </div>
        <div>
          <dt>{t("sqa")}</dt>
          <dd>{deskText(t, view?.lastRejectCode) ?? t("sw8")}</dd>
        </div>
        <div>
          <dt>{t("s1f2")}</dt>
          <dd>{deskText(t, rejectLabel)}</dd>
        </div>
        <div>
          <dt>{t("s1dn")}</dt>
          <dd>{view?.reconcileMatched ? t("ss7") : t("s12i")}</dd>
        </div>
        <div>
          <dt>{t("snm")}</dt>
          <dd>{deskText(t, view?.idempotencyKey) ?? t("sw8")}</dd>
        </div>
        <div>
          <dt>{t("s1a1")}</dt>
          <dd>{t("sss")}</dd>
        </div>
        <div>
          <dt>{t("st8")}</dt>
          <dd>{t("ssp")}</dd>
        </div>
      </dl>
      <div className="row-actions">
        {deskText(t, CONTROLS.map((control) => (
          <button
            key={control.command}
            type="button"
            className={control.command === "initiate" ? undefined : "ghost"}
            disabled={pending || (control.needsCase ? !opened : opened)}
            onClick={() => onCommand(control.command)}
          >
            {deskText(t, control.label)}
          </button>
        )))}
        <button type="button" className="ghost" disabled={pending} onClick={onClose}>
          {t("scs")}</button>
      </div>
    </aside>
  );
}
