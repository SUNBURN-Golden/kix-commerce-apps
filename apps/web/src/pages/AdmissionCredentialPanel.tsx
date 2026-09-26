import type { AdmissionPresentation } from "@kix/protocol-adapter";

export const ADMISSION_DESK_COMMANDS = [
  "adopt_issued",
  "advance_mock_clock",
  "authorize",
  "consume",
  "reconcile",
] as const;

export type AdmissionDeskCommand = (typeof ADMISSION_DESK_COMMANDS)[number];

const CONTROLS: readonly { command: AdmissionDeskCommand; label: string }[] = [
  { command: "adopt_issued", label: "Adopt issued mock credential" },
  { command: "advance_mock_clock", label: "Advance mock clock" },
  { command: "authorize", label: "Authorize mock credential" },
  { command: "consume", label: "Consume mock credential once" },
  { command: "reconcile", label: "Reconcile process-local" },
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
  return (
    <aside className="panel" aria-label="Admission credential">
      <p className="eyebrow">{presentation?.surface ?? "wave4.admission.P03.fsm"}</p>
      <h3>Admission credential</h3>
      <p className="muted">{title}</p>
      <p>
        {presentation?.note ??
          "Credential label comes from the adapter. Not venue admission. P03 stays 설계중. Protocol truth remains in kix-protocol."}
      </p>
      <p className="muted">
        Production admission routing stays false. External admission stays unsupported. This panel does not decide entry.
      </p>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <dl className="facts">
        <div>
          <dt>Credential state</dt>
          <dd className="phase-name">{presentation?.deskState ?? "Not opened"}</dd>
        </div>
        <div>
          <dt>Decision</dt>
          <dd>{presentation?.decision ?? "None"}</dd>
        </div>
        <div>
          <dt>Fresh</dt>
          <dd>{presentation ? (presentation.fresh ? "Yes" : "No") : "No"}</dd>
        </div>
        <div>
          <dt>Phase</dt>
          <dd>{presentation?.phase ?? "None"}</dd>
        </div>
        <div>
          <dt>Transfer observed</dt>
          <dd>{presentation?.transferObserved ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Production admission routing</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>External admission</dt>
          <dd>UNSUPPORTED</dd>
        </div>
        <div>
          <dt>Offline admission</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{presentation?.mode ?? "Not opened"}</dd>
        </div>
      </dl>
      {commands ? (
        <div className="row-actions">
          {CONTROLS.map((control) => (
            <button
              key={control.command}
              type="button"
              className={control.command === "adopt_issued" ? undefined : "ghost"}
              disabled={pending || !onCommand}
              onClick={() => onCommand?.(control.command)}
            >
              {control.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="muted">This desk does not authorize or consume a credential.</p>
      )}
    </aside>
  );
}
