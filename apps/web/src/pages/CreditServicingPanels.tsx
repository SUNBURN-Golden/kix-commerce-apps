import type { ReactNode } from "react";
import {
  SERVICING_ACTORS,
  SERVICING_ADJUSTMENT_KINDS,
  SERVICING_SCENARIOS,
  type ServicingAdjustmentKind,
  type ServicingScenario,
} from "@kix/protocol-adapter";
import { AmountNotice, StatusMark } from "../a11y/marks";
import {
  SERVICING_ACTOR_NOTE,
  SERVICING_BOUNDARY,
  SERVICING_CLAIM_NOTE,
  SERVICING_CLOSURE_NOTE,
  SERVICING_FENCE_NOTE,
  SERVICING_FIGURE_NOTE,
  SERVICING_PAGE_TITLE,
  SERVICING_PARTIAL_NOTE,
  SERVICING_READ_NOTE,
  SERVICING_REVERSAL_NOTE,
  SERVICING_SCENARIO_NOTES,
  SERVICING_SCOPE_NOTE,
  SERVICING_SESSION_NOTE,
  SERVICING_SOURCE_LINE,
  SERVICING_SYNTHETIC_CONTROL_NOTE,
  type ControlModel,
  type ServicingActions,
  type ServicingEventModel,
  type ServicingInstallmentModel,
  type ServicingModel,
  type ServicingPaymentModel,
  type ServicingProposalModel,
  type ServicingSessionModel,
} from "../credit-servicing";
import { WORKSPACE_RULING } from "../workspace/registry";

/** A word, not only a color. */
function WordMark({ word }: { word: string }) {
  return (
    <span className="status-mark" data-status-mark="blocked">
      <span className="status-word">{word}</span>
    </span>
  );
}

/** A wide table scrolls inside its own region, so the page does not scroll sideways. */
function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="servicing-scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

/**
 * A control that is off stays focusable and says why. A native disabled button is
 * skipped by the keyboard, so its reason would never be reached.
 */
function GuardedButton({ id, label, control, onPress }: { id: string; label: string; control: ControlModel; onPress: () => void }) {
  const reasonId = `${id}-reason`;
  return (
    <>
      <button
        type="button"
        id={id}
        className="discovery-action"
        aria-disabled={control.enabled ? undefined : true}
        aria-describedby={control.reason ? reasonId : undefined}
        data-enabled={control.enabled ? "true" : "false"}
        onClick={control.enabled ? onPress : undefined}
      >
        {label}
      </button>
      {control.reason ? (
        <p id={reasonId} className="muted" data-blocked-reason="true">
          <WordMark word="Blocked." /> {control.reason}
        </p>
      ) : null}
    </>
  );
}

export function ServicingBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: ServicingScenario;
  model: ServicingModel;
}) {
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">Servicing and operations desk</p>
      <h2>{SERVICING_PAGE_TITLE}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-servicing">
        SYNTHETIC. {SERVICING_SOURCE_LINE}
      </p>
      <p>{SERVICING_BOUNDARY}</p>
      <AmountNotice />
      <p>{SERVICING_PARTIAL_NOTE}</p>
      <p>{SERVICING_CLOSURE_NOTE}</p>
      <p>{SERVICING_REVERSAL_NOTE}</p>
      <p>{SERVICING_FIGURE_NOTE}</p>
      <p>{SERVICING_CLAIM_NOTE}</p>
      <p>{SERVICING_ACTOR_NOTE}</p>
      <p>{SERVICING_SCOPE_NOTE}</p>
      <p>{SERVICING_READ_NOTE}</p>
      <p>{SERVICING_FENCE_NOTE}</p>
      <p>{SERVICING_SESSION_NOTE}</p>
      <p>{WORKSPACE_RULING}</p>
      <p data-hold-record="not-bound">{model.session.holdLine}</p>
      <p data-not-composed="recorded">{model.session.notComposedLine}</p>
    </header>
  );
}

export function ServicingControls({
  scenario,
  actorRef,
  actions,
}: {
  scenario: ServicingScenario;
  actorRef: string;
  actions: ServicingActions;
}) {
  return (
    <section id="servicing-controls" className="discovery-section" aria-label="Synthetic controls">
      <div className="discovery-controls">
        <label htmlFor="servicing-scenario">
          Synthetic scenario
          <select
            id="servicing-scenario"
            value={scenario}
            onChange={(event) => actions.setScenario(event.target.value as ServicingScenario)}
          >
            {SERVICING_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="servicing-actor">
          Desk actor
          <select id="servicing-actor" value={actorRef} onChange={() => actions.switchActor()}>
            {SERVICING_ACTORS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button type="button" id="servicing-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          Read again
        </button>
        <button type="button" id="servicing-switch" className="discovery-action" onClick={() => actions.switchScope()}>
          Switch obligation scope
        </button>
        <button type="button" id="servicing-switch-actor" className="discovery-action" onClick={() => actions.switchActor()}>
          Switch desk actor
        </button>
        <button type="button" id="servicing-observe-draw" className="discovery-action" onClick={() => actions.observeDraw()}>
          Observe draw
        </button>
        <button type="button" id="servicing-receive-payment" className="discovery-action" onClick={() => actions.receivePayment()}>
          Receive payment
        </button>
        <button type="button" id="servicing-reverse-allocation" className="discovery-action" onClick={() => actions.reverseAllocation()}>
          Reverse allocation
        </button>
        <button type="button" id="servicing-mark-overdue" className="discovery-action" onClick={() => actions.markOverdue()}>
          Mark overdue
        </button>
        <button type="button" id="servicing-advance-schedule" className="discovery-action" onClick={() => actions.advanceSchedule()}>
          Advance schedule
        </button>
        <button type="button" id="servicing-revoke" className="discovery-action" onClick={() => actions.revokeGrant()}>
          Revoke grant
        </button>
        <button type="button" id="servicing-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          Start a new synthetic session
        </button>
      </div>
      <p className="muted" data-scenario-note={scenario}>
        {SERVICING_SCENARIO_NOTES[scenario]} Changing the scenario starts a new synthetic session.
      </p>
      <p className="muted">{SERVICING_SYNTHETIC_CONTROL_NOTE}</p>
    </section>
  );
}

export function ServicingStatus({ model }: { model: ServicingModel }) {
  return (
    <section id="servicing-status" className="discovery-section" tabIndex={-1} data-servicing-state={model.state}>
      <h3>Status</h3>
      <p role="status" data-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {model.statusLine}
        {model.detailLine ? ` ${model.detailLine}` : ""}
      </p>
      <p className="muted">{model.freshnessWord}</p>
      <p className="muted">{model.scopeLine}</p>
      <p className="muted">{model.actorLine}</p>
      <p className="muted">{model.watermarkLine}</p>
      {model.behindLine ? <p data-behind="true">{model.behindLine}</p> : null}
      {model.fenceLine ? (
        <p data-fence="true">
          <WordMark word="Fenced." /> {model.fenceLine}
        </p>
      ) : null}
      {model.lastLine ? (
        <p role="status" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word="Attention." /> : null} {model.lastLine}
        </p>
      ) : null}
    </section>
  );
}

export function DrawSection({ model }: { model: ServicingModel }) {
  const draw = model.draw;
  const reservation = model.reservation;
  const exposure = model.exposure;
  const limit = model.limit;
  return (
    <section id="servicing-draw" className="discovery-section" aria-label="Draw, reservation, and exposure">
      <h3>Draw, reservation, exposure, and limit</h3>
      <p className="muted">
        Four facts stay four facts: the instruction, the observation, the reservation, and the exposure. An instruction
        is not an observation, an observation is not confirmed funds, a held reservation is not an exposure, and an
        open exposure is not proof anything was paid.
      </p>
      {draw === null ? (
        <p data-state="empty" data-draw="none">
          No draw in this read.
        </p>
      ) : (
        <div className="discovery-row" data-draw={draw.drawRef} data-observation={draw.observation}>
          <p>
            <span className="discovery-badge" data-provenance="synthetic">
              SYNTHETIC
            </span>{" "}
            <span className="discovery-badge" data-instruction={draw.instruction}>
              Instruction {draw.instructionWord}
            </span>{" "}
            <span className="discovery-badge" data-observation-state={draw.observation}>
              Observation {draw.observationWord}
            </span>
          </p>
          <h4>{draw.drawRef}</h4>
          <p data-amount="copied">{draw.amountLine}</p>
        </div>
      )}
      <h4>Reservation</h4>
      {reservation === null ? (
        <p data-state="empty" data-reservation="none">
          No reservation in this read.
        </p>
      ) : (
        <div className="discovery-row" data-reservation={reservation.reservationRef} data-state={reservation.state}>
          <p>
            <span className="discovery-badge" data-reservation-state={reservation.state}>
              {reservation.stateWord}
            </span>
          </p>
          <h4>{reservation.reservationRef}</h4>
          <p>A held reservation is not an exposure and not a disbursement.</p>
        </div>
      )}
      <h4>Exposure</h4>
      {exposure === null ? (
        <p data-state="empty" data-exposure="none">
          No exposure in this read.
        </p>
      ) : (
        <div
          className="discovery-row"
          data-exposure={exposure.exposureRef}
          data-state={exposure.state}
          data-withheld={exposure.withheld ? "true" : "false"}
        >
          <p>
            <span className="discovery-badge" data-exposure-state={exposure.state}>
              {exposure.stateWord}
            </span>
          </p>
          <h4>{exposure.exposureRef}</h4>
          <p data-amount="copied">{exposure.amountLine}</p>
          {exposure.withheld ? (
            <p data-withheld-line="exposure">
              <WordMark word="Withheld." /> The source reports an open exposure with no observed disbursement. The
              exposure is flagged, never shown as proof of payment.
            </p>
          ) : null}
        </div>
      )}
      <h4>Commitment limit</h4>
      {limit === null ? (
        <p data-state="empty" data-limit="none">
          No limit in this read.
        </p>
      ) : (
        <div className="discovery-row" data-limit={limit.limitRef} data-state={limit.state}>
          <p>
            <span className="discovery-badge" data-limit-state={limit.state}>
              {limit.stateWord}
            </span>
          </p>
          <p data-amount="copied">{limit.amountLine}</p>
          <p>A partial repayment does not restore this limit by itself. The state is the source&apos;s own.</p>
        </div>
      )}
      {model.contradictionLines.map((line) => (
        <p key={line} data-contradiction="true">
          <WordMark word="Withheld." /> {line}
        </p>
      ))}
    </section>
  );
}

function InstallmentCard({ row }: { row: ServicingInstallmentModel }) {
  return (
    <li
      className="discovery-row"
      data-installment={row.installmentRef}
      data-state={row.state}
      data-stale={row.staleLine !== null ? "true" : "false"}
      data-provenance="synthetic"
    >
      <p>
        <span className="discovery-badge" data-provenance="synthetic">
          SYNTHETIC
        </span>{" "}
        <span className="discovery-badge" data-installment-state={row.state}>
          {row.stateWord}
        </span>
      </p>
      <h5>
        {row.installmentRef} (row {row.ordinal})
      </h5>
      <p>Due {row.dueLabel} as the source labels it.</p>
      <p data-amount="copied">{row.amountLine}</p>
      <p>{row.planLine}</p>
      {row.staleLine ? (
        <p data-stale-lane="schedule">
          <WordMark word="Stale." /> {row.staleLine}
        </p>
      ) : null}
    </li>
  );
}

export function ScheduleSection({ model }: { model: ServicingModel }) {
  return (
    <section id="servicing-schedule" className="discovery-section" aria-label="Repayment schedule" data-cut-state={model.cutState}>
      <h3>Repayment schedule</h3>
      <p>{model.scheduleLine}</p>
      <p data-cut-line={model.cutState}>{model.cutLine}</p>
      <p data-claims="all-false">{model.nonClaimsLine}</p>
      {model.staleInstallmentLines.map((line) => (
        <p key={line} data-stale-lane-flag="true">
          <WordMark word="Stale." /> {line}
        </p>
      ))}
      {model.installments.length === 0 ? <p data-state="empty">No schedule row in this read.</p> : null}
      {model.installments.length > 0 ? (
        <ul className="discovery-list" aria-label="Schedule rows in the last read">
          {model.installments.map((row) => (
            <InstallmentCard key={row.installmentRef} row={row} />
          ))}
        </ul>
      ) : null}
      <h4>Adjustments</h4>
      <p className="muted">
        A schedule correction is proposed by one actor and approved by another. Proposed and applied stay different
        states, and the earlier rows stay on the timeline.
      </p>
      {model.adjustments.length === 0 ? <p data-state="empty">No adjustment in this read.</p> : null}
      {model.adjustments.length > 0 ? (
        <ul className="discovery-list" aria-label="Adjustments in the last read">
          {model.adjustments.map((row) => (
            <li key={row.adjustmentRef} className="discovery-row" data-adjustment={row.adjustmentRef} data-state={row.state} data-kind={row.kind}>
              <p>
                <span className="discovery-badge">{row.kindWord}</span>{" "}
                <span className="discovery-badge" data-adjustment-state={row.state}>
                  {row.stateWord}
                </span>
              </p>
              <h5>{row.adjustmentRef}</h5>
              <p>On {row.installmentRef}.</p>
              <p>{row.text}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <h4>Source cuts</h4>
      {model.cuts.length === 0 ? <p data-state="empty">No source cut is listed in this read.</p> : null}
      {model.cuts.length > 0 ? (
        <ScrollTable label="Source cuts">
          <table className="servicing-cuts">
            <caption>The position each source was read at</caption>
            <thead>
              <tr>
                <th scope="col">Cut</th>
                <th scope="col">Source</th>
                <th scope="col">Generation</th>
                <th scope="col">Watermark</th>
                <th scope="col">Rows</th>
              </tr>
            </thead>
            <tbody>
              {model.cuts.map((cut) => (
                <tr key={cut.cutRef} data-cut={cut.cutRef} data-source={cut.source}>
                  <th scope="row">{cut.cutRef}</th>
                  <td>{cut.source}</td>
                  <td>{cut.generation}</td>
                  <td>{cut.watermark}</td>
                  <td>{cut.usedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      ) : null}
    </section>
  );
}

function PaymentCard({ row, actions }: { row: ServicingPaymentModel; actions: ServicingActions }) {
  return (
    <li
      className="discovery-row"
      data-payment={row.paymentRef}
      data-state={row.state}
      data-timing={row.timing}
      data-provenance="synthetic"
    >
      <p>
        <span className="discovery-badge" data-provenance="synthetic">
          SYNTHETIC
        </span>{" "}
        <span className="discovery-badge" data-payment-state={row.state}>
          {row.stateWord}
        </span>{" "}
        <span className="discovery-badge" data-payment-timing={row.timing}>
          {row.timingWord}
        </span>
      </p>
      <h5>{row.paymentRef}</h5>
      <p data-amount="copied">{row.amountLine}</p>
      <p data-unallocated="true">{row.unallocatedLine}</p>
      <GuardedButton
        id={`servicing-propose-${row.paymentRef}`}
        label={`Propose allocating ${row.paymentRef}`}
        control={row.propose}
        onPress={() => actions.proposeAllocation(row.paymentRef, firstOpenInstallmentId())}
      />
    </li>
  );
}

/** The first open schedule row shown on this page. The controller re-checks it. */
function firstOpenInstallmentId(): string {
  if (typeof document === "undefined") {
    return "";
  }
  const node = document.getElementById("servicing-target-installment");
  return node instanceof HTMLSelectElement ? node.value : "";
}

export function PaymentsSection({ model, actions }: { model: ServicingModel; actions: ServicingActions }) {
  return (
    <section id="servicing-payments" className="discovery-section" aria-label="Payments, allocations, and reversals">
      <h3>Payments, allocations, and reversals</h3>
      <p className="muted">
        A payment keeps its unallocated remainder as the source&apos;s own label. An allocation is proposed by one actor
        and applied only after another approves it. A reversal removes the effect and keeps both events.
      </p>
      <h4>Payments</h4>
      {model.payments.length === 0 ? <p data-state="empty">No payment in this read.</p> : null}
      {model.payments.length > 0 ? (
        <ul className="discovery-list" aria-label="Payments in the last read">
          {model.payments.map((row) => (
            <PaymentCard key={row.paymentRef} row={row} actions={actions} />
          ))}
        </ul>
      ) : null}
      <h4>Allocations</h4>
      {model.allocations.length === 0 ? <p data-state="empty">No allocation in this read.</p> : null}
      {model.allocations.length > 0 ? (
        <ul className="discovery-list" aria-label="Allocations in the last read">
          {model.allocations.map((row) => (
            <li key={row.allocationRef} className="discovery-row" data-allocation={row.allocationRef} data-state={row.state}>
              <p>
                <span className="discovery-badge" data-allocation-state={row.state}>
                  {row.stateWord}
                </span>
              </p>
              <h5>{row.allocationRef}</h5>
              <p>
                {row.paymentRef} to {row.installmentRef}.
              </p>
              <p data-amount="copied">{row.amountLine}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <h4>Reversals</h4>
      {model.reversals.length === 0 ? <p data-state="empty">No reversal in this read.</p> : null}
      {model.reversals.length > 0 ? (
        <ul className="discovery-list" aria-label="Reversals in the last read">
          {model.reversals.map((row) => (
            <li key={row.reversalRef} className="discovery-row" data-reversal={row.reversalRef}>
              <h5>{row.reversalRef}</h5>
              <p>
                {row.label}. Removed the effect of {row.allocationRef}; both events stay on the timeline.
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {model.unlinkedLines.map((line) => (
        <p key={line} data-unlinked="true">
          <WordMark word="Attention." /> {line}
        </p>
      ))}
    </section>
  );
}

function ProposalCard({ row, actions }: { row: ServicingProposalModel; actions: ServicingActions }) {
  return (
    <li className="discovery-row" data-proposal={row.proposalRef} data-state={row.state} data-kind={row.kind} data-actor={row.actorRef}>
      <p>
        <span className="discovery-badge">{row.kindWord}</span>{" "}
        <span className="discovery-badge" data-proposal-state={row.state}>
          {row.stateWord}
        </span>
      </p>
      <h5>{row.proposalRef}</h5>
      <p>Proposed by {row.actorRef}. A proposal applies nothing alone.</p>
      <p>{row.text}</p>
      <GuardedButton
        id={`servicing-approve-${row.proposalRef}`}
        label={`Approve ${row.proposalRef}`}
        control={row.approve}
        onPress={() => actions.approveProposal(row.proposalRef)}
      />
    </li>
  );
}

export function CaseSection({ model, actions }: { model: ServicingModel; actions: ServicingActions }) {
  const item = model.servicingCase;
  return (
    <section id="servicing-case" className="discovery-section" aria-label="Servicing case">
      <h3>Servicing case</h3>
      <p className="muted">
        A case closure is a bookkeeping state. Charged-off and recovered are closure kinds, and neither extinguishes a
        debt. A payment observed after the case closed reopens nothing by itself.
      </p>
      {item === null ? (
        <p data-state="empty" data-case="none">
          No servicing case in this read.
        </p>
      ) : (
        <div className="discovery-row" data-case={item.caseRef} data-status={item.status}>
          <p>
            <span className="discovery-badge" data-case-status={item.status}>
              {item.statusWord}
            </span>{" "}
            <span className="discovery-badge" data-case-closure="true">
              {item.closureWord}
            </span>
          </p>
          <h4>{item.caseRef}</h4>
          <p data-debt-label="not-extinguished">{item.debtLine}</p>
          <h5>Case history</h5>
          <ol className="discovery-list" aria-label="Case history">
            {item.history.map((entry) => (
              <li key={entry.label} data-history={entry.label}>
                {entry.label} — {entry.statusWord}
                {entry.closureWord !== "open" ? ` (${entry.closureWord})` : ""}. {entry.note}
              </li>
            ))}
          </ol>
        </div>
      )}
      <h4>Proposals</h4>
      {model.proposals.length === 0 ? <p data-state="empty">No proposal in this read.</p> : null}
      {model.proposals.length > 0 ? (
        <ul className="discovery-list" aria-label="Proposals in the last read">
          {model.proposals.map((row) => (
            <ProposalCard key={row.proposalRef} row={row} actions={actions} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function EventRow({ row }: { row: ServicingEventModel }) {
  return (
    <li className="discovery-row" data-event={row.eventRef} data-kind={row.kind} data-seq={row.seq}>
      <p>
        <span className="discovery-badge" data-event-kind={row.kind}>
          {row.kindWord}
        </span>
      </p>
      <h5>
        {row.seq}. {row.eventRef}
      </h5>
      <p>{row.label}</p>
      {row.targetRef === null ? <p>No target.</p> : <p>On {row.targetRef}.</p>}
    </li>
  );
}

export function TimelineSection({ model }: { model: ServicingModel }) {
  return (
    <section id="servicing-timeline" className="discovery-section" aria-label="Incident timeline">
      <h3>Incident timeline</h3>
      <p className="muted">
        The timeline records facts in the source&apos;s order. It records and settles nothing: an event is not a
        receipt, and a reversal keeps both events.
      </p>
      {model.events.length === 0 ? <p data-state="empty">No event in this read.</p> : null}
      {model.events.length > 0 ? (
        <ol className="discovery-list" aria-label="Events in the last read">
          {model.events.map((row) => (
            <EventRow key={row.eventRef} row={row} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}

export function ServicingReasonsSection({ model }: { model: ServicingModel }) {
  return (
    <section id="servicing-reasons" className="discovery-section" aria-label="Reasons and paths">
      <h3>Reasons and paths</h3>
      <p className="muted">
        Each reason names the lane it belongs to and the one proposal path the source offers. This page offers only the
        paths the source names.
      </p>
      {model.reasons.length === 0 ? <p data-state="empty">No reason in this read.</p> : null}
      {model.reasons.length > 0 ? (
        <ul className="discovery-list" aria-label="Reasons in the last read">
          {model.reasons.map((reason) => (
            <li key={reason.reasonRef} className="discovery-row" data-reason={reason.reasonRef} data-lane={reason.lane} data-code={reason.code}>
              <p>
                <span className="discovery-badge">{reason.lane}</span>{" "}
                <span className="discovery-badge" data-reason-code={reason.code}>
                  {reason.code}
                </span>
              </p>
              <h5>{reason.reasonRef}</h5>
              <p>{reason.text}</p>
              <p data-remedy={reason.remedy}>Path: {reason.remedyWord}.</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function ServicingRequestsSection({ model, actions }: { model: ServicingModel; actions: ServicingActions }) {
  return (
    <section id="servicing-requests" className="discovery-section" aria-label="Requests">
      <h3>Requests</h3>
      <p className="muted">
        A request is built from the last read and sent once. A control that is off is a request that never leaves, and
        its reason is shown. The desk actor proposes; the approver actor approves. A proposal is recorded, not applied.
      </p>
      <div className="discovery-controls">
        <label htmlFor="servicing-target-installment">
          Target schedule row
          <select id="servicing-target-installment">
            {model.installments
              .filter((row) => row.state === "scheduled" || row.state === "due" || row.state === "overdue")
              .map((row) => (
                <option key={row.installmentRef} value={row.installmentRef}>
                  {row.installmentRef}
                </option>
              ))}
          </select>
        </label>
        <label htmlFor="servicing-adjustment-kind">
          Adjustment kind
          <select id="servicing-adjustment-kind">
            {SERVICING_ADJUSTMENT_KINDS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="servicing-adjustment-text">
          Adjustment note
          <input id="servicing-adjustment-text" name="servicing-adjustment-text" autoComplete="off" defaultValue="Schedule review note." />
        </label>
        <GuardedButton
          id="servicing-propose-adjustment"
          label="Propose a schedule correction"
          control={model.proposeAdjustmentControl}
          onPress={() => actions.proposeAdjustment(firstOpenInstallmentId(), adjustmentKindValue(), adjustmentTextValue())}
        />
        {model.transitionOptions.map((option) => (
          <GuardedButton
            key={option.transition}
            id={`servicing-transition-${option.transition}`}
            label={option.word}
            control={option.control}
            onPress={() => actions.proposeCaseTransition(option.transition)}
          />
        ))}
      </div>
      {model.last === null ? (
        <p data-state="empty">No request sent in this session.</p>
      ) : (
        <div className="discovery-detail" data-last-request={model.last.seq} data-phase={model.last.phase}>
          <h4>
            Request {model.last.seq}: {model.last.kindWord}
          </h4>
          <p data-phase-word={model.last.phase}>
            {model.last.phaseWord}
            {model.last.code ? ` (${model.last.code})` : ""}.
          </p>
          {model.last.detail ? <p className="muted">{model.last.detail}</p> : null}
          {model.last.receiptLines.map((line) => (
            <p key={line} data-receipt-line="true">
              {line}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function adjustmentKindValue(): ServicingAdjustmentKind {
  if (typeof document === "undefined") {
    return "note";
  }
  const node = document.getElementById("servicing-adjustment-kind");
  const value = node instanceof HTMLSelectElement ? node.value : "note";
  return (SERVICING_ADJUSTMENT_KINDS as readonly string[]).includes(value) ? (value as ServicingAdjustmentKind) : "note";
}

/** The note the person typed, as text. The source bounds it; nothing here parses it. */
function adjustmentTextValue(): string {
  if (typeof document === "undefined") {
    return "";
  }
  const node = document.getElementById("servicing-adjustment-text");
  return node instanceof HTMLInputElement ? node.value : "";
}

export function ServicingSessionSection({ session }: { session: ServicingSessionModel }) {
  return (
    <section id="servicing-session" className="discovery-section" aria-label="Session record">
      <h3>Session record</h3>
      <p>{session.contextLine}</p>
      <p data-capabilities="true">{session.capabilityLine}</p>
      <p data-counters="true">{session.countersLine}</p>
      <p>{session.earlierUnknownLine}</p>
      <p className="muted">{session.notComposedLine}</p>
      <p className="muted">{session.holdLine}</p>
    </section>
  );
}
