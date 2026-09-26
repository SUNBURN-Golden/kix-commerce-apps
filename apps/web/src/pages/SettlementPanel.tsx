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
  { command: "initiate", label: "Initiate mock case", needsCase: false },
  { command: "authorize", label: "Authorize mock phase", needsCase: true },
  { command: "capture", label: "Simulate CAPTURED phase", needsCase: true },
  { command: "commit", label: "Simulate COMMITTED phase", needsCase: true },
  { command: "fail", label: "Fail mock case", needsCase: true },
  { command: "cancel", label: "Cancel mock case", needsCase: true },
  { command: "reconcile", label: "Reconcile process-local", needsCase: true },
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
  const opened = view !== null;
  const rejectLabel = view?.failureReason ?? view?.cancelReason ?? "None";

  return (
    <aside className="panel" aria-label="Mock settlement case">
      <p className="eyebrow">{view?.surface ?? "wave3.settlement.F01-F03.fsm"}</p>
      <h3>Mock settlement case</h3>
      <p className="muted">{eventTitle}</p>
      <p>
        Simulated mock phase on the adapter stub. Not live funds. F01, F02, and F03 stay 설계중. Protocol
        truth remains in kix-protocol. Commands on this panel call the adapter stub only.
      </p>
      <p className="muted">
        CAPTURED and COMMITTED here are mock phase names. Not live funds. FAILED and CANCELLED are terminal
        mock phases. Reconcile matched is process-local.
      </p>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <dl className="facts">
        <div>
          <dt>Mock phase</dt>
          <dd className="phase-name">{view?.phase ?? "Not opened"}</dd>
        </div>
        <div>
          <dt>Terminal</dt>
          <dd>{view?.terminal ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Last error</dt>
          <dd>{view?.lastRejectCode ?? "None"}</dd>
        </div>
        <div>
          <dt>Reject label</dt>
          <dd>{rejectLabel}</dd>
        </div>
        <div>
          <dt>Reconcile matched</dt>
          <dd>{view?.reconcileMatched ? "Matched (process-local)" : "Not run"}</dd>
        </div>
        <div>
          <dt>Idempotency key</dt>
          <dd>{view?.idempotencyKey ?? "None"}</dd>
        </div>
        <div>
          <dt>Provenance</dt>
          <dd>MOCK_SETTLEMENT_ONLY</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>mock</dd>
        </div>
      </dl>
      <div className="row-actions">
        {CONTROLS.map((control) => (
          <button
            key={control.command}
            type="button"
            className={control.command === "initiate" ? undefined : "ghost"}
            disabled={pending || (control.needsCase ? !opened : opened)}
            onClick={() => onCommand(control.command)}
          >
            {control.label}
          </button>
        ))}
        <button type="button" className="ghost" disabled={pending} onClick={onClose}>
          Close
        </button>
      </div>
    </aside>
  );
}
