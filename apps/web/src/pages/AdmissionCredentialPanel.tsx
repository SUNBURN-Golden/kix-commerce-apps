import { messages as copy0 } from "../i18n/messages/pages--AdmissionCredentialPanel";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { RefusalScope } from "../connectivity/refusal";
import type { AdmissionPresentation } from "@kix/protocol-adapter";
import { SafeText } from "../safe-text";

export const ADMISSION_DESK_COMMANDS = [
  "adopt_issued",
  "advance_mock_clock",
  "authorize",
  "consume",
  "reconcile",
] as const;

export type AdmissionDeskCommand = (typeof ADMISSION_DESK_COMMANDS)[number];

const CONTROLS: readonly { command: AdmissionDeskCommand; label: string }[] = [
  { command: "adopt_issued", label: copy0.en["e.0"] },
  { command: "advance_mock_clock", label: copy0.en["e.1"] },
  { command: "authorize", label: copy0.en["e.2"] },
  { command: "consume", label: copy0.en["e.3"] },
  { command: "reconcile", label: copy0.en["e.4"] },
];

export function AdmissionCredentialPanel({
  title,
  presentation,
  error,
  pending,
  commands,
  onCommand,
}: {
  title: string;
  presentation: AdmissionPresentation | null;
  error: string | null;
  pending: boolean;
  commands: boolean;
  onCommand?: (command: AdmissionDeskCommand) => void;
}) {
  const t = useT(copy0);
  return (
    <RefusalScope reason={error ? "credential-refusal" : null}>
    <aside className="panel" aria-label={t("s1m")}>
      <p className="eyebrow">{deskText(t, presentation?.surface) ?? t("s26c")}</p>
      <h3>{t("s1m")}</h3>
      <p className="muted"><SafeText value={title} /></p>
      <p>
        {deskText(t, presentation?.note) ?? t("sev")}
      </p>
      <p className="muted">
        {t("s199")}</p>
      {error ? (
        <p className="alert" role="alert" id="credential-refusal">
          {deskText(t, error)}
        </p>
      ) : null}
      <dl className="facts">
        <div aria-live="polite">
          <dt>{t("sew")}</dt>
          <dd className="phase-name">{deskText(t, presentation?.deskState) ?? t("s121")}</dd>
        </div>
        <div>
          <dt>{t("sfj")}</dt>
          <dd>{deskText(t, presentation?.decision) ?? t("sw8")}</dd>
        </div>
        <div>
          <dt>{t("sm4")}</dt>
          <dd>{presentation ? (presentation.fresh ? t("s276") : t("str")) : t("str")}</dd>
        </div>
        <div>
          <dt>{t("s182")}</dt>
          <dd>{presentation?.phase ?? t("sw8")}</dd>
        </div>
        <div>
          <dt>{t("s24k")}</dt>
          <dd>{presentation?.transferObserved ? t("s276") : t("str")}</dd>
        </div>
        <div>
          <dt>{t("s198")}</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>{t("skn")}</dt>
          <dd>UNSUPPORTED</dd>
        </div>
        <div>
          <dt>{t("s13z")}</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>{t("st8")}</dt>
          <dd>{presentation?.mode ?? t("s121")}</dd>
        </div>
      </dl>
      {commands ? (
        <div className="row-actions">
          {deskText(t, CONTROLS.map((control) => (
            <ConnectivityWriteButton
              key={control.command}
              type="button"
              className={control.command === "adopt_issued" ? undefined : "ghost"}
              disabled={pending || !onCommand}
              onClick={() => onCommand?.(control.command)}
            >
              {deskText(t, control.label)}
            </ConnectivityWriteButton>
          )))}
        </div>
      ) : (
        <p className="muted">{t("s22y")}</p>
      )}
    </aside>
    </RefusalScope>
  );
}
