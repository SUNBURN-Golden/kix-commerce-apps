import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy0 } from "../i18n/messages/pages--CreditPanel";
import { messages as copy1 } from "../i18n/messages/a11y--present";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import type { CreditCaseView } from "@kix/protocol-adapter";
import { AmountNotice, StatusMark } from "../a11y/marks";
import { presentIntegerUnits } from "../a11y/present";

export const CREDIT_DESK_COMMANDS = [
  "offer",
  "approve",
  "reject",
  "cancel",
  "bind_settlement",
  "draw",
  "repay",
  "close",
  "default",
  "reconcile",
  "reject_real_funds",
  "reject_undefined_product",
] as const;

export type CreditDeskCommand = (typeof CREDIT_DESK_COMMANDS)[number];

const CONTROLS: readonly { command: CreditDeskCommand; label: string; needs: "always" | "case" | "no-case" }[] = [
  { command: "offer", label: copy0.en["e.7"], needs: "no-case" },
  { command: "approve", label: copy0.en["e.8"], needs: "case" },
  { command: "reject", label: copy0.en["e.9"], needs: "case" },
  { command: "cancel", label: copy0.en["e.10"], needs: "case" },
  { command: "bind_settlement", label: copy0.en["e.11"], needs: "case" },
  { command: "draw", label: copy0.en["e.12"], needs: "case" },
  { command: "repay", label: copy0.en["e.13"], needs: "case" },
  { command: "close", label: copy0.en["e.14"], needs: "case" },
  { command: "default", label: copy0.en["e.15"], needs: "case" },
  { command: "reconcile", label: copy0.en["e.4"], needs: "case" },
  { command: "reject_real_funds", label: copy0.en["e.16"], needs: "always" },
  { command: "reject_undefined_product", label: copy0.en["e.17"], needs: "always" },
];

export function CreditPanel({
  eventTitle,
  view,
  error,
  pending,
  onCommand,
}: {
  eventTitle: string;
  view: CreditCaseView | null;
  error: string | null;
  pending: boolean;
  onCommand: (command: CreditDeskCommand) => void;
}) {
  const t = useT(deskCopy, copy0, copy1);
  return (
    <aside className="panel" aria-label={t("desk.credit.title")}>
      <p className="eyebrow">{deskText(t, view?.surface) ?? t("s26e")}</p>
      <h3>{t("desk.credit.title")}</h3>
      <p className="muted">{deskText(t, eventTitle)}</p>
      <p>
        {t("s1kj")}</p>
      <AmountNotice />
      {pending ? (
        <p className="muted" role="status">
          <StatusMark kind="loading" /> {t("desk.booking.oneAttempt")}</p>
      ) : null}
      <p className="muted">
        {t("s9a")}</p>
      {error ? (
        <p className="alert" role="alert">
          <StatusMark kind="blocked" /> {deskText(t, error)}
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
          <dt>{t("s99")}</dt>
          <dd>{deskText(t, units(view?.availableCredit))}</dd>
        </div>
        <div>
          <dt>{t("s17q")}</dt>
          <dd>{deskText(t, units(view?.pendingDraw))}</dd>
        </div>
        <div>
          <dt>{t("s16m")}</dt>
          <dd>{deskText(t, units(view?.outstandingExposure))}</dd>
        </div>
        <div>
          <dt>{t("s1fm")}</dt>
          <dd>{deskText(t, units(view?.repaidExposure))}</dd>
        </div>
        <div>
          <dt>{t("s153")}</dt>
          <dd>{deskText(t, units(view?.openFace))}</dd>
        </div>
        <div>
          <dt>{t("s1ga")}</dt>
          <dd>{deskText(t, units(view?.reservedOpen))}</dd>
        </div>
        <div>
          <dt>{t("s10x")}</dt>
          <dd>{deskText(t, view?.noteStatus) ?? t("sw8")}</dd>
        </div>
        <div>
          <dt>{t("s1k3")}</dt>
          <dd>{deskText(t, view?.settlementGate) ?? t("sw8")}</dd>
        </div>
        <div>
          <dt>{t("s1k2")}</dt>
          <dd>{view?.settlementFailure ? t("s276") : t("str")}</dd>
        </div>
        <div>
          <dt>{t("st7")}</dt>
          <dd>{view?.mockSettlementCommitObserved ? t("s13j") : t("s11z")}</dd>
        </div>
        <div>
          <dt>{t("si7")}</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>{t("sm9")}</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>{t("s9o")}</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>{t("s1fn")}</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>{t("soi")}</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>{t("s256")}</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>{t("spw")}</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>{t("s16o")}</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>{t("sko")}</dt>
          <dd>UNSUPPORTED</dd>
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
          <dd>{t("ssq")}</dd>
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
            className={control.command === "offer" || control.command === "draw" ? undefined : "ghost"}
            disabled={pending || disabled(control.needs, view !== null)}
            onClick={() => onCommand(control.command)}
          >
            {deskText(t, control.label)}
          </button>
        )))}
      </div>
    </aside>
  );
}

function units(value: number | undefined): string {
  if (value === undefined) {
    return copy0.en["sw8"];
  }
  return presentIntegerUnits(value, "mock units");
}

function disabled(needs: "always" | "case" | "no-case", opened: boolean): boolean {
  if (needs === "no-case") {
    return opened;
  }
  if (needs === "case") {
    return !opened;
  }
  return false;
}
