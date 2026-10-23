import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy0 } from "../i18n/messages/pages--CreditServicingPanels";
import { messages as copy1 } from "../i18n/messages/credit-servicing";
import { messages as copy2 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
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
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <span className="status-mark" data-status-mark="blocked">
      <span className="status-word">{deskText(t, word)}</span>
    </span>
  );
}

/** A wide table scrolls inside its own region, so the page does not scroll sideways. */
function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <div className="servicing-scroll" role="region" aria-label={deskText(t, label)} tabIndex={0}>
      {deskText(t, children)}
    </div>
  );
}

/**
 * A control that is off stays focusable and says why. A native disabled button is
 * skipped by the keyboard, so its reason would never be reached.
 */
function GuardedButton({ id, label, control, onPress }: { id: string; label: string; control: ControlModel; onPress: () => void }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  const reasonId = `${id}-reason`;
  return (
    <>
      <ConnectivityWriteButton
        type="button"
        id={id}
        className="discovery-action"
        aria-disabled={control.enabled ? undefined : true}
        aria-describedby={control.reason ? reasonId : undefined}
        data-enabled={control.enabled ? "true" : "false"}
        onClick={control.enabled ? onPress : undefined}
      >
        {deskText(t, label)}
      </ConnectivityWriteButton>
      {control.reason ? (
        <p id={reasonId} className="muted" data-blocked-reason="true">
          <WordMark word={t("status.transport.blocked")} /> {deskText(t, control.reason)}
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
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">{t("s1jh")}</p>
      <h2>{deskText(t, SERVICING_PAGE_TITLE)}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-servicing">
        SYNTHETIC. {deskText(t, SERVICING_SOURCE_LINE)}
      </p>
      <p>{deskText(t, SERVICING_BOUNDARY)}</p>
      <AmountNotice />
      <p>{deskText(t, SERVICING_PARTIAL_NOTE)}</p>
      <p>{deskText(t, SERVICING_CLOSURE_NOTE)}</p>
      <p>{deskText(t, SERVICING_REVERSAL_NOTE)}</p>
      <p>{deskText(t, SERVICING_FIGURE_NOTE)}</p>
      <p>{deskText(t, SERVICING_CLAIM_NOTE)}</p>
      <p>{deskText(t, SERVICING_ACTOR_NOTE)}</p>
      <p>{deskText(t, SERVICING_SCOPE_NOTE)}</p>
      <p>{deskText(t, SERVICING_READ_NOTE)}</p>
      <p>{deskText(t, SERVICING_FENCE_NOTE)}</p>
      <p>{deskText(t, SERVICING_SESSION_NOTE)}</p>
      <p>{deskText(t, WORKSPACE_RULING)}</p>
      <p data-hold-record="not-bound">{deskText(t, model.session.holdLine)}</p>
      <p data-not-composed="recorded">{deskText(t, model.session.notComposedLine)}</p>
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
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="servicing-controls" className="discovery-section" aria-label={t("s1o9")}>
      <div className="discovery-controls">
        <label htmlFor="servicing-scenario">
          {t("s1p5")}<select
            id="servicing-scenario"
            value={scenario}
            onChange={(event) => actions.setScenario(event.target.value as ServicingScenario)}
          >
            {deskText(t, SERVICING_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {deskText(t, item)}
              </option>
            )))}
          </select>
        </label>
        <label htmlFor="servicing-actor">
          {t("sgd")}<select id="servicing-actor" value={actorRef} onChange={() => actions.switchActor()}>
            {deskText(t, SERVICING_ACTORS.map((item) => (
              <option key={item} value={item}>
                {deskText(t, item)}
              </option>
            )))}
          </select>
        </label>
        <button type="button" id="servicing-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          {t("s1ax")}</button>
        <button type="button" id="servicing-switch" className="discovery-action" onClick={() => actions.switchScope()}>
          {t("s1nw")}</button>
        <button type="button" id="servicing-switch-actor" className="discovery-action" onClick={() => actions.switchActor()}>
          {t("s1nu")}</button>
        <ConnectivityWriteButton type="button" id="servicing-observe-draw" className="discovery-action" onClick={() => actions.observeDraw()}>
          {t("s13r")}</ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="servicing-receive-payment" className="discovery-action" onClick={() => actions.receivePayment()}>
          {t("s1dh")}</ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="servicing-reverse-allocation" className="discovery-action" onClick={() => actions.reverseAllocation()}>
          {t("s1gy")}</ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="servicing-mark-overdue" className="discovery-action" onClick={() => actions.markOverdue()}>
          {t("ss5")}</ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="servicing-advance-schedule" className="discovery-action" onClick={() => actions.advanceSchedule()}>
          {t("s1x")}</ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="servicing-revoke" className="discovery-action" onClick={() => actions.revokeGrant()}>
          {t("s1h6")}</ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="servicing-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          {t("s1m2")}</ConnectivityWriteButton>
      </div>
      <p className="muted" data-scenario-note={scenario}>
        {deskText(t, SERVICING_SCENARIO_NOTES[scenario])} {t("sbx")}</p>
      <p className="muted">{deskText(t, SERVICING_SYNTHETIC_CONTROL_NOTE)}</p>
    </section>
  );
}

export function ServicingStatus({ model }: { model: ServicingModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="servicing-status" className="discovery-section" tabIndex={-1} data-servicing-state={model.state}>
      <h3>{t("s1mj")}</h3>
      <p role="status" data-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {deskText(t, model.statusLine)}
        {model.detailLine ? t("sgg", { detailLine: model.detailLine }) : ""}
      </p>
      <p className="muted">{deskText(t, model.freshnessWord)}</p>
      <p className="muted">{deskText(t, model.scopeLine)}</p>
      <p className="muted">{deskText(t, model.actorLine)}</p>
      <p className="muted">{deskText(t, model.watermarkLine)}</p>
      {model.behindLine ? <p data-behind="true">{deskText(t, model.behindLine)}</p> : null}
      {model.fenceLine ? (
        <p data-fence="true">
          <WordMark word={t("sky")} /> {deskText(t, model.fenceLine)}
        </p>
      ) : null}
      {model.lastLine ? (
        <p role="status" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word={t("s91")} /> : null} {deskText(t, model.lastLine)}
        </p>
      ) : null}
    </section>
  );
}

export function DrawSection({ model }: { model: ServicingModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  const draw = model.draw;
  const reservation = model.reservation;
  const exposure = model.exposure;
  const limit = model.limit;
  return (
    <section id="servicing-draw" className="discovery-section" aria-label={t("shg")}>
      <h3>{t("shh")}</h3>
      <p className="muted">
        {t("slu")}</p>
      {draw === null ? (
        <p data-state="empty" data-draw="none">
          {t("sv9")}</p>
      ) : (
        <div className="discovery-row" data-draw={draw.drawRef} data-observation={draw.observation}>
          <p>
            <span className="discovery-badge" data-provenance="synthetic">
              SYNTHETIC
            </span>{" "}
            <span className="discovery-badge" data-instruction={draw.instruction}>
              {t("so8")}{" "}{deskText(t, draw.instructionWord)}
            </span>{" "}
            <span className="discovery-badge" data-observation-state={draw.observation}>
              {t("s13h")}{" "}{deskText(t, draw.observationWord)}
            </span>
          </p>
          <h4>{deskText(t, draw.drawRef)}</h4>
          <p data-amount="copied">{deskText(t, draw.amountLine)}</p>
        </div>
      )}
      <h4>{t("s1g4")}</h4>
      {reservation === null ? (
        <p data-state="empty" data-reservation="none">
          {t("sxu")}</p>
      ) : (
        <div className="discovery-row" data-reservation={reservation.reservationRef} data-state={reservation.state}>
          <p>
            <span className="discovery-badge" data-reservation-state={reservation.state}>
              {deskText(t, reservation.stateWord)}
            </span>
          </p>
          <h4>{deskText(t, reservation.reservationRef)}</h4>
          <p>{t("s2b")}</p>
        </div>
      )}
      <h4>{t("skm")}</h4>
      {exposure === null ? (
        <p data-state="empty" data-exposure="none">
          {t("svh")}</p>
      ) : (
        <div
          className="discovery-row"
          data-exposure={exposure.exposureRef}
          data-state={exposure.state}
          data-withheld={exposure.withheld ? "true" : "false"}
        >
          <p>
            <span className="discovery-badge" data-exposure-state={exposure.state}>
              {deskText(t, exposure.stateWord)}
            </span>
          </p>
          <h4>{deskText(t, exposure.exposureRef)}</h4>
          <p data-amount="copied">{deskText(t, exposure.amountLine)}</p>
          {exposure.withheld ? (
            <p data-withheld-line="exposure">
              <WordMark word={t("s26v")} /> {t("s20e")}</p>
          ) : null}
        </div>
      )}
      <h4>{t("sdc")}</h4>
      {limit === null ? (
        <p data-state="empty" data-limit="none">
          {t("svx")}</p>
      ) : (
        <div className="discovery-row" data-limit={limit.limitRef} data-state={limit.state}>
          <p>
            <span className="discovery-badge" data-limit-state={limit.state}>
              {deskText(t, limit.stateWord)}
            </span>
          </p>
          <p data-amount="copied">{deskText(t, limit.amountLine)}</p>
          <p>{t("s4s")}</p>
        </div>
      )}
      {deskText(t, model.contradictionLines.map((line) => (
        <p key={line} data-contradiction="true">
          <WordMark word={t("s26v")} /> {deskText(t, line)}
        </p>
      )))}
    </section>
  );
}

function InstallmentCard({ row }: { row: ServicingInstallmentModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
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
          {deskText(t, row.stateWord)}
        </span>
      </p>
      <h5>
        {deskText(t, row.installmentRef)} {t("s1hp")}{" "}{deskText(t, row.ordinal)})
      </h5>
      <p>{t("shj")}{" "}{deskText(t, row.dueLabel)} {t("s8g")}</p>
      <p data-amount="copied">{deskText(t, row.amountLine)}</p>
      <p>{deskText(t, row.planLine)}</p>
      {row.staleLine ? (
        <p data-stale-lane="schedule">
          <WordMark word={t("s1lh")} /> {deskText(t, row.staleLine)}
        </p>
      ) : null}
    </li>
  );
}

export function ScheduleSection({ model }: { model: ServicingModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="servicing-schedule" className="discovery-section" aria-label={t("s1fo")} data-cut-state={model.cutState}>
      <h3>{t("s1fo")}</h3>
      <p>{deskText(t, model.scheduleLine)}</p>
      <p data-cut-line={model.cutState}>{deskText(t, model.cutLine)}</p>
      <p data-claims="all-false">{deskText(t, model.nonClaimsLine)}</p>
      {deskText(t, model.staleInstallmentLines.map((line) => (
        <p key={line} data-stale-lane-flag="true">
          <WordMark word={t("s1lh")} /> {deskText(t, line)}
        </p>
      )))}
      {model.installments.length === 0 ? <p data-state="empty">{t("syb")}</p> : null}
      {model.installments.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s1ih")}>
          {deskText(t, model.installments.map((row) => (
            <InstallmentCard key={row.installmentRef} row={row} />
          )))}
        </ul>
      ) : null}
      <h4>{t("s1j")}</h4>
      <p className="muted">
        {t("s7u")}</p>
      {model.adjustments.length === 0 ? <p data-state="empty">{t("sty")}</p> : null}
      {model.adjustments.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s1k")}>
          {deskText(t, model.adjustments.map((row) => (
            <li key={row.adjustmentRef} className="discovery-row" data-adjustment={row.adjustmentRef} data-state={row.state} data-kind={row.kind}>
              <p>
                <span className="discovery-badge">{deskText(t, row.kindWord)}</span>{" "}
                <span className="discovery-badge" data-adjustment-state={row.state}>
                  {deskText(t, row.stateWord)}
                </span>
              </p>
              <h5>{deskText(t, row.adjustmentRef)}</h5>
              <p>{t("s141")}{" "}{deskText(t, row.installmentRef)}.</p>
              <p>{deskText(t, row.text)}</p>
            </li>
          )))}
        </ul>
      ) : null}
      <h4>{t("s1l7")}</h4>
      {model.cuts.length === 0 ? <p data-state="empty">{t("syo")}</p> : null}
      {model.cuts.length > 0 ? (
        <ScrollTable label={t("s1l7")}>
          <table className="servicing-cuts">
            <caption>{t("s1ve")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("sfe")}</th>
                <th scope="col">{t("s1l5")}</th>
                <th scope="col">{t("sme")}</th>
                <th scope="col">{t("s269")}</th>
                <th scope="col">{t("s1hr")}</th>
              </tr>
            </thead>
            <tbody>
              {deskText(t, model.cuts.map((cut) => (
                <tr key={cut.cutRef} data-cut={cut.cutRef} data-source={cut.source}>
                  <th scope="row">{deskText(t, cut.cutRef)}</th>
                  <td>{deskText(t, cut.source)}</td>
                  <td>{deskText(t, cut.generation)}</td>
                  <td>{deskText(t, cut.watermark)}</td>
                  <td>{deskText(t, cut.usedBy)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </ScrollTable>
      ) : null}
    </section>
  );
}

function PaymentCard({ row, actions }: { row: ServicingPaymentModel; actions: ServicingActions }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
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
          {deskText(t, row.stateWord)}
        </span>{" "}
        <span className="discovery-badge" data-payment-timing={row.timing}>
          {deskText(t, row.timingWord)}
        </span>
      </p>
      <h5>{deskText(t, row.paymentRef)}</h5>
      <p data-amount="copied">{deskText(t, row.amountLine)}</p>
      <p data-unallocated="true">{deskText(t, row.unallocatedLine)}</p>
      <GuardedButton
        id={`servicing-propose-${row.paymentRef}`}
        label={t("s19p", { paymentRef: row.paymentRef })}
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
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="servicing-payments" className="discovery-section" aria-label={t("s17l")}>
      <h3>{t("s17l")}</h3>
      <p className="muted">
        {t("s50")}</p>
      <h4>{t("s17k")}</h4>
      {model.payments.length === 0 ? <p data-state="empty">{t("swu")}</p> : null}
      {model.payments.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s17m")}>
          {deskText(t, model.payments.map((row) => (
            <PaymentCard key={row.paymentRef} row={row} actions={actions} />
          )))}
        </ul>
      ) : null}
      <h4>{t("s2v")}</h4>
      {model.allocations.length === 0 ? <p data-state="empty">{t("su0")}</p> : null}
      {model.allocations.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s2w")}>
          {deskText(t, model.allocations.map((row) => (
            <li key={row.allocationRef} className="discovery-row" data-allocation={row.allocationRef} data-state={row.state}>
              <p>
                <span className="discovery-badge" data-allocation-state={row.state}>
                  {deskText(t, row.stateWord)}
                </span>
              </p>
              <h5>{deskText(t, row.allocationRef)}</h5>
              <p>
                {deskText(t, row.paymentRef)} {t("s249")}{" "}{deskText(t, row.installmentRef)}.
              </p>
              <p data-amount="copied">{deskText(t, row.amountLine)}</p>
            </li>
          )))}
        </ul>
      ) : null}
      <h4>{t("s1gw")}</h4>
      {model.reversals.length === 0 ? <p data-state="empty">{t("sxx")}</p> : null}
      {model.reversals.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s1gx")}>
          {deskText(t, model.reversals.map((row) => (
            <li key={row.reversalRef} className="discovery-row" data-reversal={row.reversalRef}>
              <h5>{deskText(t, row.reversalRef)}</h5>
              <p>
                {deskText(t, row.label)}{t("s1fj")}{" "}{deskText(t, row.allocationRef)}{t("sah")}</p>
            </li>
          )))}
        </ul>
      ) : null}
      {deskText(t, model.unlinkedLines.map((line) => (
        <p key={line} data-unlinked="true">
          <WordMark word={t("s91")} /> {deskText(t, line)}
        </p>
      )))}
    </section>
  );
}

function ProposalCard({ row, actions }: { row: ServicingProposalModel; actions: ServicingActions }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <li className="discovery-row" data-proposal={row.proposalRef} data-state={row.state} data-kind={row.kind} data-actor={row.actorRef}>
      <p>
        <span className="discovery-badge">{deskText(t, row.kindWord)}</span>{" "}
        <span className="discovery-badge" data-proposal-state={row.state}>
          {deskText(t, row.stateWord)}
        </span>
      </p>
      <h5>{deskText(t, row.proposalRef)}</h5>
      <p>{t("s19v")}{" "}{row.actorRef}{t("s63")}</p>
      <p>{deskText(t, row.text)}</p>
      <GuardedButton
        id={`servicing-approve-${row.proposalRef}`}
        label={t("s5z", { proposalRef: row.proposalRef })}
        control={row.approve}
        onPress={() => actions.approveProposal(row.proposalRef)}
      />
    </li>
  );
}

export function CaseSection({ model, actions }: { model: ServicingModel; actions: ServicingActions }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  const item = model.servicingCase;
  return (
    <section id="servicing-case" className="discovery-section" aria-label={t("s1ji")}>
      <h3>{t("s1ji")}</h3>
      <p className="muted">
        {t("s9")}</p>
      {item === null ? (
        <p data-state="empty" data-case="none">
          {t("syg")}</p>
      ) : (
        <div className="discovery-row" data-case={item.caseRef} data-status={item.status}>
          <p>
            <span className="discovery-badge" data-case-status={item.status}>
              {deskText(t, item.statusWord)}
            </span>{" "}
            <span className="discovery-badge" data-case-closure="true">
              {deskText(t, item.closureWord)}
            </span>
          </p>
          <h4>{deskText(t, item.caseRef)}</h4>
          <p data-debt-label="not-extinguished">{deskText(t, item.debtLine)}</p>
          <h5>{t("sbf")}</h5>
          <ol className="discovery-list" aria-label={t("sbf")}>
            {deskText(t, item.history.map((entry) => (
              <li key={entry.label} data-history={entry.label}>
                {deskText(t, entry.label)} — {deskText(t, entry.statusWord)}
                {entry.closureWord !== "open" ? t("sd1", { closureWord: entry.closureWord }) : ""}. {deskText(t, entry.note)}
              </li>
            )))}
          </ol>
        </div>
      )}
      <h4>{t("s19i")}</h4>
      {model.proposals.length === 0 ? <p data-state="empty">{t("sx1")}</p> : null}
      {model.proposals.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s19j")}>
          {deskText(t, model.proposals.map((row) => (
            <ProposalCard key={row.proposalRef} row={row} actions={actions} />
          )))}
        </ul>
      ) : null}
    </section>
  );
}

function EventRow({ row }: { row: ServicingEventModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <li className="discovery-row" data-event={row.eventRef} data-kind={row.kind} data-seq={row.seq}>
      <p>
        <span className="discovery-badge" data-event-kind={row.kind}>
          {deskText(t, row.kindWord)}
        </span>
      </p>
      <h5>
        {deskText(t, row.seq)}. {deskText(t, row.eventRef)}
      </h5>
      <p>{deskText(t, row.label)}</p>
      {row.targetRef === null ? <p>{t("s104")}</p> : <p>{t("s141")}{" "}{deskText(t, row.targetRef)}.</p>}
    </li>
  );
}

export function TimelineSection({ model }: { model: ServicingModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="servicing-timeline" className="discovery-section" aria-label={t("snv")}>
      <h3>{t("snv")}</h3>
      <p className="muted">
        {t("s22l")}</p>
      {model.events.length === 0 ? <p data-state="empty">{t("svd")}</p> : null}
      {model.events.length > 0 ? (
        <ol className="discovery-list" aria-label={t("siv")}>
          {deskText(t, model.events.map((row) => (
            <EventRow key={row.eventRef} row={row} />
          )))}
        </ol>
      ) : null}
    </section>
  );
}

export function ServicingReasonsSection({ model }: { model: ServicingModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="servicing-reasons" className="discovery-section" aria-label={t("s1d7")}>
      <h3>{t("s1d7")}</h3>
      <p className="muted">
        {t("shz")}</p>
      {model.reasons.length === 0 ? <p data-state="empty">{t("sxj")}</p> : null}
      {model.reasons.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s1d8")}>
          {deskText(t, model.reasons.map((reason) => (
            <li key={reason.reasonRef} className="discovery-row" data-reason={reason.reasonRef} data-lane={reason.lane} data-code={reason.code}>
              <p>
                <span className="discovery-badge">{deskText(t, reason.lane)}</span>{" "}
                <span className="discovery-badge" data-reason-code={reason.code}>
                  {deskText(t, reason.code)}
                </span>
              </p>
              <h5>{deskText(t, reason.reasonRef)}</h5>
              <p>{deskText(t, reason.text)}</p>
              <p data-remedy={reason.remedy}>{t("s17b")}{" "}{deskText(t, reason.remedyWord)}.</p>
            </li>
          )))}
        </ul>
      ) : null}
    </section>
  );
}

export function ServicingRequestsSection({ model, actions }: { model: ServicingModel; actions: ServicingActions }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="servicing-requests" className="discovery-section" aria-label={t("s1fv")}>
      <h3>{t("s1fv")}</h3>
      <p className="muted">
        {t("s6z")}</p>
      <div className="discovery-controls">
        <label htmlFor="servicing-target-installment">
          {t("s1pf")}<select id="servicing-target-installment">
            {deskText(t, model.installments
              .filter((row) => row.state === "scheduled" || row.state === "due" || row.state === "overdue")
              .map((row) => (
                <option key={row.installmentRef} value={row.installmentRef}>
                  {deskText(t, row.installmentRef)}
                </option>
              )))}
          </select>
        </label>
        <label htmlFor="servicing-adjustment-kind">
          {t("s1g")}<select id="servicing-adjustment-kind">
            {deskText(t, SERVICING_ADJUSTMENT_KINDS.map((item) => (
              <option key={item} value={item}>
                {deskText(t, item)}
              </option>
            )))}
          </select>
        </label>
        <label htmlFor="servicing-adjustment-text">
          {t("s1h")}<input id="servicing-adjustment-text" name="servicing-adjustment-text" autoComplete="off" defaultValue="Schedule review note." />
        </label>
        <GuardedButton
          id="servicing-propose-adjustment"
          label={t("s19t")}
          control={model.proposeAdjustmentControl}
          onPress={() => actions.proposeAdjustment(firstOpenInstallmentId(), adjustmentKindValue(), adjustmentTextValue())}
        />
        {deskText(t, model.transitionOptions.map((option) => (
          <GuardedButton
            key={option.transition}
            id={`servicing-transition-${option.transition}`}
            label={deskText(t, option.word)}
            control={option.control}
            onPress={() => actions.proposeCaseTransition(option.transition)}
          />
        )))}
      </div>
      {model.last === null ? (
        <p data-state="empty">{t("sxs")}</p>
      ) : (
        <div className="discovery-detail" data-last-request={model.last.seq} data-phase={model.last.phase}>
          <h4>
            {t("s1fq")}{" "}{deskText(t, model.last.seq)}: {deskText(t, model.last.kindWord)}
          </h4>
          <p data-phase-word={model.last.phase}>
            {deskText(t, model.last.phaseWord)}
            {model.last.code ? (" " + t("sd2", { code: model.last.code })) : ""}.
          </p>
          {model.last.detail ? <p className="muted">{deskText(t, model.last.detail)}</p> : null}
          {deskText(t, model.last.receiptLines.map((line) => (
            <p key={line} data-receipt-line="true">
              {deskText(t, line)}
            </p>
          )))}
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
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="servicing-session" className="discovery-section" aria-label={t("s1js")}>
      <h3>{t("s1js")}</h3>
      <p>{deskText(t, session.contextLine)}</p>
      <p data-capabilities="true">{deskText(t, session.capabilityLine)}</p>
      <p data-counters="true">{deskText(t, session.countersLine)}</p>
      <p>{deskText(t, session.earlierUnknownLine)}</p>
      <p className="muted">{deskText(t, session.notComposedLine)}</p>
      <p className="muted">{deskText(t, session.holdLine)}</p>
    </section>
  );
}
