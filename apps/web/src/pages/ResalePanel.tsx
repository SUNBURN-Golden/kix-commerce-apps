import type { ResaleCaseView, ResaleRightView } from "@kix/protocol-adapter";
import { formatWhen } from "../format";

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
  { command: "advance_mock_clock", label: "Advance mock clock", needs: "always" },
  { command: "adopt", label: "Adopt mock right", needs: "no-right" },
  { command: "list", label: "List mock phase", needs: "right" },
  { command: "hold_buy", label: "Hold mock buyer", needs: "right" },
  { command: "release_hold", label: "Release mock hold", needs: "right" },
  { command: "cancel", label: "Cancel mock listing", needs: "right" },
  { command: "observe_payment", label: "Note simulated payment", needs: "right" },
  { command: "bind_settlement", label: "Bind mock settlement", needs: "right" },
  { command: "accept_transfer", label: "Accept mock transfer", needs: "right" },
  { command: "close", label: "Close mock listing", needs: "right" },
  { command: "reconcile", label: "Reconcile process-local", needs: "right" },
  { command: "reject_external", label: "Reject external marketplace", needs: "always" },
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
  const phase = view?.phase ?? (right?.eligible ? "ELIGIBLE" : right?.salePhase ?? (right ? "LOCKED" : "Not opened"));
  const holder = view
    ? `${view.holderRole} · v${view.currentVersion}`
    : right
      ? `${right.holderRole} · v${right.version}`
      : "None";

  return (
    <aside className="panel" aria-label="Mock resale case">
      <p className="eyebrow">{view?.surface ?? right?.surface ?? "wave4.resale.R01-R05.fsm"}</p>
      <h3>Mock resale case</h3>
      <p className="muted">{eventTitle}</p>
      <p>
        Simulated mock phase on the adapter stub. Not live marketplace. R01–R05 stay 설계중. Protocol truth remains in
        kix-protocol. Commands on this panel call the adapter stub only.
      </p>
      <p className="muted">
        Listing eligibility, a pending sale, and a transferred holder are mock phase labels. Economic finality claimed
        stays false. A bound transfer waits for a mock COMMITTED settlement view. A failed mock settlement does not move
        funds. Reconcile matched is process-local. The prior credential flag is simulated, not a venue reissue.
      </p>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <dl className="facts">
        <div>
          <dt>Mock phase</dt>
          <dd className="phase-name">{phase}</dd>
        </div>
        <div>
          <dt>Listing eligibility</dt>
          <dd>{right?.eligible || view?.rightEligible ? "ELIGIBLE" : "Not eligible"}</dd>
        </div>
        <div>
          <dt>Pending sale</dt>
          <dd>{view?.pendingSale ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Terminal</dt>
          <dd>{view?.terminal ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Last error</dt>
          <dd>{view?.lastRejectCode ?? right?.lastRejectCode ?? "None"}</dd>
        </div>
        <div>
          <dt>Holder and version</dt>
          <dd>{holder}</dd>
        </div>
        <div>
          <dt>Listing version</dt>
          <dd>{view ? `v${view.version}` : "None"}</dd>
        </div>
        <div>
          <dt>Ownership transferred</dt>
          <dd>{view?.ownershipTransferred ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Prior credential invalidated</dt>
          <dd>{view?.priorCredentialInvalidated ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Settlement gate</dt>
          <dd>{view?.settlementGate ?? "None"}</dd>
        </div>
        <div>
          <dt>Settlement failure</dt>
          <dd>{view?.settlementFailure ? "Yes" : "No"}</dd>
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
          <dt>Venue credential reissued</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>External marketplace</dt>
          <dd>UNSUPPORTED</dd>
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
          <dd>{clockLabel(view?.logicalTimeMs ?? right?.logicalTimeMs ?? 0)}</dd>
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
        {CONTROLS.map((control) => (
          <button
            key={control.command}
            type="button"
            className={control.command === "adopt" || control.command === "list" ? undefined : "ghost"}
            disabled={pending || disabled(control.needs, right !== null)}
            onClick={() => onCommand(control.command)}
          >
            {control.label}
          </button>
        ))}
      </div>
    </aside>
  );
}

function clockLabel(logicalTimeMs: number): string {
  if (logicalTimeMs <= 0) {
    return "Not advanced";
  }
  return formatWhen(new Date(logicalTimeMs).toISOString());
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
