import type { CreditCaseView } from "@kix/protocol-adapter";

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
  { command: "offer", label: "Offer mock phase", needs: "no-case" },
  { command: "approve", label: "Approve mock phase", needs: "case" },
  { command: "reject", label: "Reject mock phase", needs: "case" },
  { command: "cancel", label: "Cancel mock phase", needs: "case" },
  { command: "bind_settlement", label: "Bind mock settlement", needs: "case" },
  { command: "draw", label: "Draw mock exposure", needs: "case" },
  { command: "repay", label: "Note mock repayment", needs: "case" },
  { command: "close", label: "Close mock case", needs: "case" },
  { command: "default", label: "Mark mock default", needs: "case" },
  { command: "reconcile", label: "Reconcile process-local", needs: "case" },
  { command: "reject_real_funds", label: "Reject real-funds label", needs: "always" },
  { command: "reject_undefined_product", label: "Reject undefined product", needs: "always" },
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
  return (
    <aside className="panel" aria-label="Mock credit case">
      <p className="eyebrow">{view?.surface ?? "wave5.credit.F04.fsm"}</p>
      <h3>Mock credit case</h3>
      <p className="muted">{eventTitle}</p>
      <p>
        Simulated exposure on the adapter stub. Not live credit. F04 and E06 stay 설계중. Protocol truth remains in
        kix-protocol. Commands on this panel call the adapter stub only.
      </p>
      <p className="muted">
        Available credit, a pending draw, outstanding exposure, and repayment are mock phase amounts. Economic finality
        claimed stays false. Funds executed stays false. A bound draw waits for a mock COMMITTED settlement view. A
        failed mock settlement does not move funds. Reconcile matched is process-local. This case does not change a
        booking or a resale holder.
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
          <dt>Available credit</dt>
          <dd>{units(view?.availableCredit)}</dd>
        </div>
        <div>
          <dt>Pending draw</dt>
          <dd>{units(view?.pendingDraw)}</dd>
        </div>
        <div>
          <dt>Outstanding exposure</dt>
          <dd>{units(view?.outstandingExposure)}</dd>
        </div>
        <div>
          <dt>Repaid exposure</dt>
          <dd>{units(view?.repaidExposure)}</dd>
        </div>
        <div>
          <dt>Open face</dt>
          <dd>{units(view?.openFace)}</dd>
        </div>
        <div>
          <dt>Reserved open</dt>
          <dd>{units(view?.reservedOpen)}</dd>
        </div>
        <div>
          <dt>Note status</dt>
          <dd>{view?.noteStatus ?? "None"}</dd>
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
          <dt>Funds executed</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>Bank debit observed</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>Repayment observed</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>Interest defined</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>Underwriting executed</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>KYC executed</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>Ownership mutated</dt>
          <dd>false</dd>
        </div>
        <div>
          <dt>External credit</dt>
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
          <dt>Provenance</dt>
          <dd>MOCK_CREDIT_F04_ONLY</dd>
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
            className={control.command === "offer" || control.command === "draw" ? undefined : "ghost"}
            disabled={pending || disabled(control.needs, view !== null)}
            onClick={() => onCommand(control.command)}
          >
            {control.label}
          </button>
        ))}
      </div>
    </aside>
  );
}

function units(value: number | undefined): string {
  if (value === undefined) {
    return "None";
  }
  return `${value} mock units`;
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
