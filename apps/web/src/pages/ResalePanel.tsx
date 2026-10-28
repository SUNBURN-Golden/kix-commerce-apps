import { messages as copy0 } from "../i18n/messages/pages--ResalePanel";
import { messages as copy1 } from "../i18n/messages/a11y--present";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import type { ResaleCaseView, ResaleRightView } from "@kix/protocol-adapter";
import { formatWhen } from "../format";
import { useLocale } from "../i18n/locale-context";
import type { DisplayLocale } from "../a11y/present";

export const RESALE_DESK_COMMANDS = [
  "advance_mock_clock",
  "adopt",
  "list",
  "hold_buy",
  "release_hold",
  "cancel",
  "observe_payment",
  "bind_settlement",
  "accept_transfer",
  "close",
  "reconcile",
  "reject_external",
] as const;

export type ResaleDeskCommand = (typeof RESALE_DESK_COMMANDS)[number];

const CONTROLS: readonly { command: ResaleDeskCommand; label: string; needs: "always" | "no-right" | "right" }[] = [
  { command: "advance_mock_clock", label: copy0.en["e.1"], needs: "always" },
  { command: "adopt", label: copy0.en["e.40"], needs: "no-right" },
  { command: "list", label: copy0.en["e.41"], needs: "right" },
  { command: "hold_buy", label: copy0.en["e.42"], needs: "right" },
  { command: "release_hold", label: copy0.en["e.43"], needs: "right" },
  { command: "cancel", label: copy0.en["e.44"], needs: "right" },
  { command: "observe_payment", label: copy0.en["e.45"], needs: "right" },
  { command: "bind_settlement", label: copy0.en["e.11"], needs: "right" },
  { command: "accept_transfer", label: copy0.en["e.46"], needs: "right" },
  { command: "close", label: copy0.en["e.47"], needs: "right" },
  { command: "reconcile", label: copy0.en["e.4"], needs: "right" },
  { command: "reject_external", label: copy0.en["e.48"], needs: "always" },
];

export function ResalePanel({
  eventTitle,
  view,
  right,
  error,
  pending,
  onCommand,
}: {
  eventTitle: string;
  view: ResaleCaseView | null;
  right: ResaleRightView | null;
  error: string | null;
  pending: boolean;
  onCommand: (command: ResaleDeskCommand) => void;
}) {
  const { clock } = useLocale();
  const t = useT(copy0, copy1);
  const phase = view?.phase ?? (right?.eligible ? "ELIGIBLE" : right?.salePhase ?? (right ? "LOCKED" : copy0.en["s121"]));
  const holder = view
    ? `${view.holderRole} · v${view.currentVersion}`
    : right
      ? `${right.holderRole} · v${right.version}`
      : copy0.en["sw8"];

  return (
    <aside className="panel" aria-label={t("st1")}>
      <p className="eyebrow">{deskText(t, view?.surface) ?? deskText(t, right?.surface) ?? t("s26d")}</p>
      <h3>{t("st1")}</h3>
      <p className="muted">{deskText(t, eventTitle)}</p>
      <p>
        {t("s1kk")}</p>
      <p className="muted">
        {t("sr2")}</p>
      {error ? (
        <p className="alert" role="alert">
          {deskText(t, error)}
        </p>
      ) : null}
      <dl className="facts">
        <div aria-live="polite">
          <dt>{t("st0")}</dt>
          <dd className="phase-name">{deskText(t, phase)}</dd>
        </div>
        <div>
          <dt>{t("sr1")}</dt>
          <dd>{right?.eligible || view?.rightEligible ? t("sia") : t("s10t")}</dd>
        </div>
        <div>
          <dt>{t("s17v")}</dt>
          <dd>{view?.pendingSale ? t("s276") : t("str")}</dd>
        </div>
        <div>
          <dt>{t("s1pk")}</dt>
          <dd>{view?.terminal ? t("s276") : t("str")}</dd>
        </div>
        <div>
          <dt>{t("sqa")}</dt>
          <dd>{deskText(t, view?.lastRejectCode) ?? deskText(t, right?.lastRejectCode) ?? t("sw8")}</dd>
        </div>
        <div>
          <dt>{t("sne")}</dt>
          <dd>{deskText(t, holder)}</dd>
        </div>
        <div>
          <dt>{t("sra")}</dt>
          <dd>{view ? t("s261", { version: view.version }) : t("sw8")}</dd>
        </div>
        <div>
          <dt>{t("s16p")}</dt>
          <dd>{view?.ownershipTransferred ? t("s276") : t("str")}</dd>
        </div>
        <div>
          <dt>{t("s196")}</dt>
          <dd>{view?.priorCredentialInvalidated ? t("s276") : t("str")}</dd>
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
          <dt>{t("s25w")}</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>{t("skp")}</dt>
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
          <dt>{t("sst")}</dt>
          <dd>{deskText(t, clockLabel(view?.logicalTimeMs ?? right?.logicalTimeMs ?? 0, clock))}</dd>
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
        {deskText(t, CONTROLS.map((control) => (
          <ConnectivityWriteButton
            key={control.command}
            type="button"
            className={control.command === "adopt" || control.command === "list" ? undefined : "ghost"}
            disabled={pending || disabled(control.needs, right !== null)}
            onClick={() => onCommand(control.command)}
          >
            {deskText(t, control.label)}
          </ConnectivityWriteButton>
        )))}
      </div>
    </aside>
  );
}

function clockLabel(logicalTimeMs: number, locale: DisplayLocale): string {
  if (logicalTimeMs <= 0) {
    return copy0.en["sze"];
  }
  return formatWhen(new Date(logicalTimeMs).toISOString(), locale);
}

function disabled(needs: "always" | "no-right" | "right", adopted: boolean): boolean {
  if (needs === "always") {
    return false;
  }
  if (needs === "no-right") {
    return adopted;
  }
  return !adopted;
}
