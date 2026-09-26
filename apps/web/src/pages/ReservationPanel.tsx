import type { ReservationCaseView } from "@kix/protocol-adapter";
import { formatWhen } from "../format";

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
    { command: "register_show", label: "Register mock show", needs: "no-show" },
    { command: "advance_mock_clock", label: "Advance mock clock", needs: "event" },
    { command: "hold", label: "Hold mock slot", needs: "show" },
    { command: "release", label: "Release mock hold", needs: "case" },
    { command: "confirm", label: "Confirm mock order", needs: "case" },
    { command: "cancel", label: "Cancel mock order", needs: "case" },
    { command: "observe_payment", label: "Note simulated payment", needs: "case" },
    { command: "bind_settlement", label: "Bind mock settlement", needs: "case" },
    { command: "issue", label: "Issue mock right", needs: "case" },
    { command: "reconcile", label: "Reconcile process-local", needs: "case" },
  ];

const ADMISSION_CONTROLS: readonly { command: ReservationDeskCommand; label: string; needs: "case" }[] = [
  { command: "reconcile", label: "Reconcile process-local", needs: "case" },
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
  const controls = variant === "booking" ? BOOKING_CONTROLS : ADMISSION_CONTROLS;
  const surface =
    variant === "admission"
      ? (view?.admissionSurface ?? "wave4.admission.P03.fsm")
      : (view?.surface ?? "wave4.booking.B01-B05.fsm");

  return (
    <aside className="panel" aria-label={variant === "admission" ? "Mock admission phase" : "Mock reservation case"}>
      <p className="eyebrow">{surface}</p>
      <h3>{variant === "admission" ? "Mock admission phase" : "Mock reservation case"}</h3>
      <p className="muted">{eventTitle}</p>
      <p>
        Simulated mock phase on the adapter stub. Not live admission. B01–B05 and P03 stay 설계중. Protocol truth
        remains in kix-protocol. Commands on this panel call the adapter stub only.
      </p>
      <p className="muted">
        An expired mock hold stays in its phase until release. Economic finality claimed stays false. A bound issue
        waits for a mock COMMITTED settlement view. Reconcile matched is process-local.
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
          <dt>Slot</dt>
          <dd>{view ? `${view.slot} · ${view.slotState}` : "None"}</dd>
        </div>
        <div>
          <dt>Case holds slot</dt>
          <dd>{view?.slotHeldByCase ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Expired</dt>
          <dd>{view?.expired ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Issue status</dt>
          <dd>{issueLabel(view)}</dd>
        </div>
        <div>
          <dt>Consume status</dt>
          <dd>{view?.issueStatus === "consumed" ? "Mock consumed once" : "Not consumed"}</dd>
        </div>
        <div>
          <dt>Settlement gate</dt>
          <dd>{view?.settlementGate ?? "None"}</dd>
        </div>
        <div>
          <dt>Mock settlement commit observed</dt>
          <dd>{view?.mockSettlementCommitObserved ? "Observed" : "Not observed"}</dd>
        </div>
        <div>
          <dt>Economic finality claimed</dt>
          <dd>false</dd>
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
          <dt>Mock clock</dt>
          <dd>{view && view.logicalTimeMs > 0 ? formatWhen(new Date(view.logicalTimeMs).toISOString()) : "Not advanced"}</dd>
        </div>
        <div>
          <dt>Provenance</dt>
          <dd>MOCK_GATE_ONLY</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>mock</dd>
        </div>
      </dl>
      <div className="row-actions">
        {controls.map((control) => (
          <button
            key={control.command}
            type="button"
            className={control.command === "register_show" || control.command === "authorize_admission" ? undefined : "ghost"}
            disabled={pending || !eventReady || disabled(control.needs, showRegistered, view !== null)}
            onClick={() => onCommand(control.command)}
          >
            {control.label}
          </button>
        ))}
      </div>
    </aside>
  );
}

function issueLabel(view: ReservationCaseView | null): string {
  if (!view || view.issueStatus === "unissued") {
    return "Not issued";
  }
  if (view.issueStatus === "consumed") {
    return "Mock consumed once";
  }
  return "Mock issued";
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
