import { formatWhen } from "../format";
import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy0 } from "../i18n/messages/pages--ReservationPanel";
import { messages as copy1 } from "../i18n/messages/a11y--present";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import type { ReservationCaseView } from "@kix/protocol-adapter";
import { DeadlineLine, StatusMark } from "../a11y/marks";
import { useDisplayLocale } from "../i18n/locale-context";

export const RESERVATION_DESK_COMMANDS = [
  "register_show",
  "advance_mock_clock",
  "hold",
  "release",
  "confirm",
  "cancel",
  "observe_payment",
  "bind_settlement",
  "issue",
  "authorize_admission",
  "consume",
  "reconcile",
] as const;

export type ReservationDeskCommand = (typeof RESERVATION_DESK_COMMANDS)[number];

const BOOKING_CONTROLS: readonly { command: ReservationDeskCommand; label: string; needs: "event" | "show" | "case" | "no-show" }[] =
  [
    { command: "register_show", label: copy0.en["e.49"], needs: "no-show" },
    { command: "advance_mock_clock", label: copy0.en["e.1"], needs: "event" },
    { command: "hold", label: copy0.en["e.50"], needs: "show" },
    { command: "release", label: copy0.en["e.43"], needs: "case" },
    { command: "confirm", label: copy0.en["e.51"], needs: "case" },
    { command: "cancel", label: copy0.en["e.52"], needs: "case" },
    { command: "observe_payment", label: copy0.en["e.45"], needs: "case" },
    { command: "bind_settlement", label: copy0.en["e.11"], needs: "case" },
    { command: "issue", label: copy0.en["e.53"], needs: "case" },
    { command: "reconcile", label: copy0.en["e.4"], needs: "case" },
  ];

const ADMISSION_CONTROLS: readonly { command: ReservationDeskCommand; label: string; needs: "case" }[] = [
  { command: "reconcile", label: copy0.en["e.4"], needs: "case" },
];

export function ReservationPanel({
  variant,
  eventTitle,
  view,
  showRegistered,
  eventReady,
  error,
  pending,
  onCommand,
}: {
  variant: "booking" | "admission";
  eventTitle: string;
  view: ReservationCaseView | null;
  showRegistered: boolean;
  eventReady: boolean;
  error: string | null;
  pending: boolean;
  onCommand: (command: ReservationDeskCommand) => void;
}) {
  const clock = useDisplayLocale();
  const t = useT(deskCopy, copy0, copy1);
  const controls = variant === "booking" ? BOOKING_CONTROLS : ADMISSION_CONTROLS;
  const surface =
    variant === "admission"
      ? (view?.admissionSurface ?? "wave4.admission.P03.fsm")
      : (view?.surface ?? "wave4.booking.B01-B05.fsm");

  return (
    <aside className="panel" aria-label={variant === "admission" ? t("desk.booking.admission") : t("st3")}>
      <p className="eyebrow">{deskText(t, surface)}</p>
      <h3>{variant === "admission" ? t("desk.booking.admission") : t("st3")}</h3>
      <p className="muted">{deskText(t, eventTitle)}</p>
      <p>
        {t("s1kl")}</p>
      <p className="muted">
        {t("s44")}</p>
      {pending ? (
        <p className="muted" role="status">
          <StatusMark kind="loading" /> {t("desk.booking.oneAttempt")}</p>
      ) : null}
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
          <dt>{t("s1l1")}</dt>
          <dd>{view ? t("s1l2", { slot: view.slot, slotState: view.slotState }) : t("sw8")}</dd>
        </div>
        <div>
          <dt>{t("sbg")}</dt>
          <dd>{view?.slotHeldByCase ? t("s276") : t("str")}</dd>
        </div>
        <div>
          <dt>{t("sk9")}</dt>
          <dd data-expiry-authority={view ? (view.expired ? "true" : "false") : "unspecified"}>
            {view?.expired ? t("s276") : t("str")}
          </dd>
        </div>
        <div>
          <dt>{t("sfh")}</dt>
          <dd>{view ? <DeadlineLine expiresAt={view.expiresAt} expired={view.expired} /> : t("sw8")}</dd>
        </div>
        <div>
          <dt>{t("soz")}</dt>
          <dd>{deskText(t, issueLabel(view))}</dd>
        </div>
        <div>
          <dt>{t("se7")}</dt>
          <dd>{view?.issueStatus === "consumed" ? t("ssu") : t("s10m")}</dd>
        </div>
        <div>
          <dt>{t("s1k3")}</dt>
          <dd>{deskText(t, view?.settlementGate) ?? t("sw8")}</dd>
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
          <dt>{t("s1dn")}</dt>
          <dd>{view?.reconcileMatched ? t("ss7") : t("s12i")}</dd>
        </div>
        <div>
          <dt>{t("snm")}</dt>
          <dd>{deskText(t, view?.idempotencyKey) ?? t("sw8")}</dd>
        </div>
        <div>
          <dt>{t("sst")}</dt>
          <dd>
            {view && view.logicalTimeMs > 0 ? (
              <time dateTime={new Date(view.logicalTimeMs).toISOString()}>
                {deskText(t, formatWhen(new Date(view.logicalTimeMs).toISOString(), clock))}
              </time>
            ) : (t("sze"))}
          </dd>
        </div>
        <div>
          <dt>{t("s1a1")}</dt>
          <dd>{t("ssr")}</dd>
        </div>
        <div>
          <dt>{t("st8")}</dt>
          <dd>{t("ssp")}</dd>
        </div>
      </dl>
      <div className="row-actions">
        {deskText(t, controls.map((control) => (
          <ConnectivityWriteButton
            key={control.command}
            type="button"
            className={control.command === "register_show" || control.command === "authorize_admission" ? undefined : "ghost"}
            disabled={pending || !eventReady || disabled(control.needs, showRegistered, view !== null)}
            onClick={() => onCommand(control.command)}
          >
            {deskText(t, control.label)}
          </ConnectivityWriteButton>
        )))}
      </div>
    </aside>
  );
}

function issueLabel(view: ReservationCaseView | null): string {
  if (!view || view.issueStatus === "unissued") {
    return copy0.en["e.54"];
  }
  if (view.issueStatus === "consumed") {
    return copy0.en["ssu"];
  }
  return copy0.en["e.55"];
}

function disabled(needs: "event" | "show" | "case" | "no-show", showRegistered: boolean, opened: boolean): boolean {
  if (needs === "event") {
    return false;
  }
  if (needs === "no-show") {
    return showRegistered;
  }
  if (needs === "show") {
    return !showRegistered;
  }
  return !opened;
}
