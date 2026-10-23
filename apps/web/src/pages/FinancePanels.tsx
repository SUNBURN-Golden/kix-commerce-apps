import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy0 } from "../i18n/messages/pages--FinancePanels";
import { messages as copy1 } from "../i18n/messages/finance-operations";
import { messages as copy2 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { FINANCE_ACTORS, FINANCE_SCENARIOS, type FinanceScenario } from "@kix/protocol-adapter";
import { AmountNotice, StatusMark } from "../a11y/marks";
import {
  FINANCE_ACTOR_NOTE,
  FINANCE_BOUNDARY,
  FINANCE_CLAIM_NOTE,
  FINANCE_CUT_NOTE,
  FINANCE_EXPORT_NOTE,
  FINANCE_FIGURES_NOTE,
  FINANCE_NO_FORCE_NOTE,
  FINANCE_PAGE_TITLE,
  FINANCE_READ_NOTE,
  FINANCE_SCOPE_NOTE,
  FINANCE_SESSION_NOTE,
  FINANCE_SOURCE_LINE,
  FINANCE_SYNTHETIC_CONTROL_NOTE,
  SCENARIO_NOTES,
  type ControlModel,
  type FinanceActions,
  type FinanceCaseModel,
  type FinanceModel,
  type FinanceSessionModel,
} from "../finance-operations";
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
    <div className="finance-scroll" role="region" aria-label={deskText(t, label)} tabIndex={0}>
      {deskText(t, children)}
    </div>
  );
}

/**
 * A control that is off stays focusable and says why. A native disabled button is
 * skipped by the keyboard, so its reason would never be reached. When many controls share
 * one reason, the page prints it once and each control points at it.
 */
function GuardedButton({
  id,
  label,
  control,
  describedBy,
  onPress,
}: {
  id: string;
  label: string;
  control: ControlModel;
  /** The id of a paragraph that holds the shared reason. Without it the reason is printed here. */
  describedBy?: string;
  onPress: () => void;
}) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  const reasonId = `${id}-reason`;
  const pointer = control.reason ? (describedBy ?? reasonId) : undefined;
  return (
    <>
      <ConnectivityWriteButton
        type="button"
        id={id}
        className="discovery-action"
        aria-disabled={control.enabled ? undefined : true}
        aria-describedby={pointer}
        data-enabled={control.enabled ? "true" : "false"}
        onClick={control.enabled ? onPress : undefined}
      >
        {deskText(t, label)}
      </ConnectivityWriteButton>
      {control.reason && describedBy === undefined ? (
        <p id={reasonId} className="muted" data-blocked-reason="true">
          <WordMark word={t("status.transport.blocked")} /> {deskText(t, control.reason)}
        </p>
      ) : null}
    </>
  );
}

function Synthetic() {
  return (
    <span className="discovery-badge" data-provenance="synthetic">
      SYNTHETIC
    </span>
  );
}

export function FinanceBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: FinanceScenario;
  model: FinanceModel;
}) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">{t("slc")}</p>
      <h2>{deskText(t, FINANCE_PAGE_TITLE)}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-finance">
        SYNTHETIC. {deskText(t, FINANCE_SOURCE_LINE)}
      </p>
      <p>{deskText(t, FINANCE_BOUNDARY)}</p>
      <p data-no-force="true">{deskText(t, FINANCE_NO_FORCE_NOTE)}</p>
      <AmountNotice />
      <p>{deskText(t, FINANCE_CLAIM_NOTE)}</p>
      <p>{deskText(t, FINANCE_CUT_NOTE)}</p>
      <p>{deskText(t, FINANCE_FIGURES_NOTE)}</p>
      <p>{deskText(t, FINANCE_EXPORT_NOTE)}</p>
      <p>{deskText(t, FINANCE_SCOPE_NOTE)}</p>
      <p>{deskText(t, FINANCE_ACTOR_NOTE)}</p>
      <p>{deskText(t, FINANCE_READ_NOTE)}</p>
      <p>{deskText(t, FINANCE_SESSION_NOTE)}</p>
      <p>{deskText(t, WORKSPACE_RULING)}</p>
      <p data-hold-record="not-bound">{deskText(t, model.session.holdLine)}</p>
      <p data-not-composed="recorded">{deskText(t, model.session.notComposedLine)}</p>
    </header>
  );
}

export function FinanceControls({
  scenario,
  actorRef,
  model,
  actions,
}: {
  scenario: FinanceScenario;
  actorRef: string;
  model: FinanceModel;
  actions: FinanceActions;
}) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="finance-controls" className="discovery-section" aria-label={t("s1o9")}>
      <div className="discovery-controls">
        <PickAndApply
          id="finance-scenario"
          label={t("s1p5")}
          value={scenario}
          options={FINANCE_SCENARIOS}
          applyId="finance-apply-scenario"
          applyLabel={t("s1m5")}
          onApply={(next) => actions.setScenario(next as FinanceScenario)}
        />
        <PickAndApply
          id="finance-actor"
          label={t("sgd")}
          value={actorRef}
          options={FINANCE_ACTORS}
          applyId="finance-apply-actor"
          applyLabel={t("s1o6")}
          onApply={(next) => actions.switchActor(next)}
        />
        <button type="button" id="finance-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          {t("s1ax")}</button>
        <GuardedButton id="finance-export" label={t("srf")} control={model.exportControl} onPress={() => actions.loadExport()} />
        <button type="button" id="finance-switch" className="discovery-action" onClick={() => actions.switchScope()}>
          {t("s1nt")}</button>
        <ConnectivityWriteButton type="button" id="finance-revoke" className="discovery-action" onClick={() => actions.revokeGrant()}>
          {t("s1ky")}</ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="finance-advance" className="discovery-action" onClick={() => actions.advanceCut()}>
          {t("s1kw")}</ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="finance-post-correction" className="discovery-action" onClick={() => actions.postSourceCorrection()}>
          {t("s1kx")}</ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="finance-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          {t("s1m2")}</ConnectivityWriteButton>
      </div>
      <p className="muted" data-scenario-note={scenario}>
        {deskText(t, SCENARIO_NOTES[scenario])} {t("scc")}</p>
      <p className="muted">{deskText(t, FINANCE_SYNTHETIC_CONTROL_NOTE)}</p>
    </section>
  );
}

/**
 * A choice that applies only when asked. Moving through a list with the arrow keys changes
 * nothing, so a keyboard user does not reset the session once per option.
 */
function PickAndApply({
  id,
  label,
  value,
  options,
  applyId,
  applyLabel,
  onApply,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  applyId: string;
  applyLabel: string;
  onApply: (next: string) => void;
}) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  const [choice, setChoice] = useState(value);
  useEffect(() => {
    setChoice(value);
  }, [value]);
  return (
    <>
      <label htmlFor={id}>
        {deskText(t, label)}
        <select id={id} value={choice} onChange={(event) => setChoice(event.target.value)}>
          {deskText(t, options.map((item) => (
            <option key={item} value={item}>
              {deskText(t, item)}
            </option>
          )))}
        </select>
      </label>
      <button type="button" id={applyId} className="discovery-action" onClick={() => onApply(choice)}>
        {deskText(t, applyLabel)}
      </button>
    </>
  );
}

export function FinanceStatus({ model }: { model: FinanceModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="finance-status" className="discovery-section" tabIndex={-1} data-finance-state={model.state}>
      <h3>{t("s1mj")}</h3>
      <p role="status" data-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {deskText(t, model.statusLine)}
        {model.detailLine ? t("sgg", { detailLine: model.detailLine }) : ""}
      </p>
      <p className="muted">{deskText(t, model.freshnessWord)}</p>
      <p className="muted">{deskText(t, model.scopeLine)}</p>
      <p className="muted">{deskText(t, model.watermarkLine)}</p>
      <p className="muted" data-queue-line="true">
        {deskText(t, model.queueLine)}
      </p>
      {model.lastLine ? (
        <p role="status" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word={t("s91")} /> : null} {deskText(t, model.lastLine)}
        </p>
      ) : null}
    </section>
  );
}

export function AuthoritySection({ model }: { model: FinanceModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="finance-authority" className="discovery-section" aria-label={t("s26m")}>
      <h3>{t("s26m")}</h3>
      <p className="muted">
        {t("sv")}</p>
      <ScrollTable label={t("s96")}>
        <table className="finance-authority">
          <caption>{t("s1yd")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("s97")}</th>
              <th scope="col">{t("sn9")}</th>
              <th scope="col">{t("si9")}</th>
              <th scope="col">{t("sbv")}</th>
            </tr>
          </thead>
          <tbody>
            {deskText(t, model.authority.map((row) => (
              <tr key={row.authority} data-authority={row.authority} data-changes-economic-state={row.changesEconomicState ? "true" : "false"} data-held-by-actor={row.heldByActor ? "true" : "false"}>
                <th scope="row">{deskText(t, row.word)}</th>
                <td>
                  {deskText(t, row.heldByLine)}
                  {row.heldByActor ? (" " + t("s1pt")) : ""}
                </td>
                <td>{deskText(t, row.effectLine)}</td>
                <td>{row.changesEconomicState ? t("s278") : t("sts")}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </ScrollTable>
    </section>
  );
}

export function CutsSection({ model }: { model: FinanceModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="finance-cuts" className="discovery-section" aria-label={t("s1l7")} data-cut-alignment={model.cutAlignment}>
      <h3>{t("s1l7")}</h3>
      <p data-cut-line={model.cutAlignment}>{deskText(t, model.cutLine)}</p>
      {model.cuts.length === 0 ? <p data-state="empty">{t("syo")}</p> : null}
      {model.cuts.length > 0 ? (
        <ScrollTable label={t("s1l7")}>
          <table className="finance-cuts">
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
                <tr key={cut.cutRef} data-cut={cut.cutRef} data-cut-source={cut.source}>
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

function CaseCard({ row, model, actions }: { row: FinanceCaseModel; model: FinanceModel; actions: FinanceActions }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  const blockId = `finance-case-${row.caseRef}-block`;
  return (
    <li
      className="discovery-row"
      data-case={row.caseRef}
      data-category={row.category}
      data-state={row.state}
      data-verdict={row.verdict}
      data-cut={row.cutRef}
      data-provenance="synthetic"
      data-source="synthetic-finance"
    >
      <p>
        <Synthetic /> <span className="discovery-badge">{deskText(t, row.categoryWord)}</span>{" "}
        <span className="discovery-badge" data-case-state={row.state}>
          {deskText(t, row.stateWord)}
        </span>
      </p>
      <h4>{deskText(t, row.caseRef)}</h4>
      <p data-verdict-word={row.verdict}>{deskText(t, row.verdictWord)}.</p>
      {deskText(t, row.explanationLines.map((line) => (
        <p key={line} data-explanation="true">
          {deskText(t, line)}
        </p>
      )))}
      <p data-original-trade={row.tradeLinked ? "linked" : "unlinked"}>
        {!row.tradeLinked ? <WordMark word={t("s91")} /> : null} {deskText(t, row.tradeLine)}{" "}
        {row.tradeLinked ? <Link to="/merchant">{t("s15e")}</Link> : null}
      </p>
      {row.merchantLineLine ? <p data-link="merchant-line">{deskText(t, row.merchantLineLine)}</p> : null}
      {row.paymentLine ? (
        <p data-link="servicing-payment">
          {deskText(t, row.paymentLine)} <Link to="/credit/servicing">{t("s15c")}</Link>
        </p>
      ) : null}
      <p className="finance-figures-line">
        <span data-amount="copied">{deskText(t, row.expectedLine)}</span> · <span data-amount="copied">{deskText(t, row.observedLine)}</span> ·{" "}
        <span data-amount="copied">{deskText(t, row.differenceLine)}</span>
      </p>
      <p>
        {deskText(t, row.sidesLine)} {deskText(t, row.reasonLine)} {t("sfe")}{" "}{deskText(t, row.cutRef)}.
      </p>
      {row.skewLine ? (
        <p data-timing-uncertain="true">
          <WordMark word={t("s91")} /> {deskText(t, row.skewLine)}
        </p>
      ) : null}
      {row.contradictionLine ? (
        <p data-contradiction="true">
          <WordMark word={t("s91")} /> {deskText(t, row.contradictionLine)}
        </p>
      ) : null}

      {row.facts.length > 0 ? (
        <>
          <h5>{t("skq")}</h5>
          <ul className="finance-facts" aria-label={t("skr", { caseRef: row.caseRef })}>
            {deskText(t, row.facts.map((fact) => (
              <li key={fact.factRef} data-fact={fact.factRef} data-arrival={fact.late ? "after-cut" : "in-cut"} data-cut={fact.cutRef}>
                <strong>{deskText(t, fact.factRef)}</strong> {deskText(t, fact.kindWord)}. {deskText(t, fact.amountLine)}. {deskText(t, fact.arrivalWord)}{t("sff")}{" "}{deskText(t, fact.cutRef)}. {deskText(t, fact.label)}
                {fact.late ? (
                  <>
                    {" "}
                    <WordMark word={t("sqf")} /> {t("sp4")}</>
                ) : null}
              </li>
            )))}
          </ul>
        </>
      ) : null}

      {row.allocations.length > 0 ? (
        <>
          <h5>{t("s17f")}</h5>
          <ScrollTable label={t("s2x", { caseRef: row.caseRef })}>
            <table className="finance-allocations">
              <caption>{t("s1yk")}{" "}{deskText(t, row.caseRef)}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("s2s")}</th>
                  <th scope="col">{t("sps")}</th>
                  <th scope="col">{t("s1he")}</th>
                  <th scope="col">{t("s17e")}</th>
                  <th scope="col">{t("s36")}</th>
                  <th scope="col">{t("sfe")}</th>
                </tr>
              </thead>
              <tbody>
                {deskText(t, row.allocations.map((item) => (
                  <tr key={item.allocationRef} data-allocation={item.allocationRef} data-remainder={item.remainder ? "true" : "false"} data-cut={item.cutRef}>
                    <th scope="row">{deskText(t, item.allocationRef)}</th>
                    <td>{deskText(t, item.kindWord)}</td>
                    <td>{deskText(t, item.roleWord)}</td>
                    <td>{deskText(t, item.payeeLine)}</td>
                    <td data-amount="copied">{deskText(t, item.amountLine)}</td>
                    <td>{deskText(t, item.cutRef)}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </ScrollTable>
        </>
      ) : null}

      {row.proposals.length > 0 ? (
        <>
          <h5>{t("seh")}</h5>
          <ul className="finance-proposals" aria-label={t("s19l", { caseRef: row.caseRef })}>
            {deskText(t, row.proposals.map((proposal) => (
              <li key={proposal.proposalRef} data-proposal={proposal.proposalRef} data-proposal-state={proposal.state}>
                <strong>{deskText(t, proposal.proposalRef)}</strong> {deskText(t, proposal.correctionWord)}{t("s19w")}{" "}{deskText(t, proposal.proposedBy)}. {deskText(t, proposal.stateWord)}{t("s10q")}{" "}{deskText(t, proposal.note)}
                <br />
                <GuardedButton
                  id={`finance-approve-${proposal.proposalRef}`}
                  label={t("s1dp", { proposalRef: proposal.proposalRef })}
                  control={proposal.approve}
                  describedBy={model.approveBlock ? "finance-approve-reason" : undefined}
                  onPress={() => actions.approveProposal(proposal.proposalRef)}
                />
              </li>
            )))}
          </ul>
        </>
      ) : null}

      {row.corrections.length > 0 ? (
        <div className="discovery-controls" role="group" aria-label={t("s19o", { caseRef: row.caseRef })}>
          {deskText(t, row.corrections.map((item) => (
            <GuardedButton
              key={item.correction}
              id={`finance-propose-${row.caseRef}-${item.correction}`}
              label={deskText(t, item.label)}
              control={item.control}
              describedBy={
                item.control.reason !== null && item.control.reason === model.proposeBlock
                  ? "finance-propose-reason"
                  : row.caseBlock
                    ? blockId
                    : undefined
              }
              onPress={() => actions.proposeCorrection(row.caseRef, item.correction, noteValue())}
            />
          )))}
        </div>
      ) : null}
      {row.caseBlock ? (
        <p id={blockId} className="muted" data-case-block="true" data-blocked-reason="true">
          <WordMark word={t("status.transport.blocked")} /> {deskText(t, row.caseBlock)}
        </p>
      ) : null}
    </li>
  );
}

/** The note the person typed, as text. The source bounds it; nothing here parses it. */
function noteValue(): string {
  if (typeof document === "undefined") {
    return "";
  }
  const node = document.getElementById("finance-note");
  return node instanceof HTMLInputElement ? node.value : "";
}

export function QueueSection({ model, actions }: { model: FinanceModel; actions: FinanceActions }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="finance-queue" className="discovery-section" aria-label={t("sjz")} data-case-count={model.cases.length}>
      <h3>{t("sjz")}</h3>
      <p className="muted">
        {t("shr")}</p>
      <div className="discovery-controls">
        <label htmlFor="finance-note">
          {t("s10s")}<input id="finance-note" name="finance-note" autoComplete="off" defaultValue="Reviewed against the source cuts." />
        </label>
      </div>
      {model.proposeBlock ? (
        <p id="finance-propose-reason" className="muted" data-blocked-reason="true" data-block="propose">
          <WordMark word={t("status.transport.blocked")} /> {t("sej")}{" "}{deskText(t, model.proposeBlock)}
        </p>
      ) : null}
      {model.approveBlock ? (
        <p id="finance-approve-reason" className="muted" data-blocked-reason="true" data-block="approve">
          <WordMark word={t("status.transport.blocked")} /> {t("s5w")}{" "}{deskText(t, model.approveBlock)}
        </p>
      ) : null}
      {model.cases.length === 0 ? <p data-state="empty">{t("suh")}</p> : null}
      {model.cases.length > 0 ? (
        <ul className="discovery-list" aria-label={t("sbj")}>
          {deskText(t, model.cases.map((row) => (
            <CaseCard key={row.caseRef} row={row} model={model} actions={actions} />
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

export function FiguresSection({ model }: { model: FinanceModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="finance-figures" className="discovery-section" aria-label={t("s1la")} data-totals-state={model.totalsState}>
      <h3>{t("s1la")}</h3>
      <p className="muted">
        {model.totalsState === "current" ? t("si5") : model.totalsState === "stale" ? t("s8r") : model.totalsState === "mismatch" ? t("s8q") : t("syr")}
      </p>
      {model.totals.length > 0 ? (
        <ScrollTable label={t("s1ld")}>
          <table className="finance-totals">
            <caption>{t("s1yl")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("sbr")}</th>
                <th scope="col">{t("sfe")}</th>
                <th scope="col">{t("sme")}</th>
                <th scope="col">{t("sbh")}</th>
                <th scope="col">{t("s24c")}</th>
                <th scope="col">{t("slo")}</th>
              </tr>
            </thead>
            <tbody>
              {deskText(t, model.totals.map((row) => (
                <tr key={`${row.category}|${row.cutRef}`} data-total={row.category} data-cut={row.cutRef} data-flagged={row.flagLines.length > 0 ? "true" : "false"}>
                  <th scope="row">{deskText(t, row.categoryWord)}</th>
                  <td>{deskText(t, row.cutRef)}</td>
                  <td>{deskText(t, row.generation)}</td>
                  <td>{deskText(t, row.caseCount)}</td>
                  <td data-amount="copied">{deskText(t, row.amountLine)}</td>
                  <td>
                    {row.flagLines.length === 0
                      ? t("svj")
                      : row.flagLines.map((line) => (
                          <p key={line} data-flag="true">
                            <WordMark word={t("s91")} /> {deskText(t, line)}
                          </p>
                        ))}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </ScrollTable>
      ) : null}
      <h4>{t("s9n")}</h4>
      {model.balances.length === 0 ? <p data-state="empty">{t("su9")}</p> : null}
      {model.balances.length > 0 ? (
        <ScrollTable label={t("s9n")}>
          <table className="finance-balances">
            <caption>{t("s1yg")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("s9l")}</th>
                <th scope="col">{t("s1lc")}</th>
                <th scope="col">{t("sqn")}</th>
                <th scope="col">{t("desk.booking.right")}</th>
                <th scope="col">{t("sgm")}</th>
                <th scope="col">{t("s25y")}</th>
                <th scope="col">{t("slo")}</th>
              </tr>
            </thead>
            <tbody>
              {deskText(t, model.balances.map((row) => (
                <tr key={row.balanceRef} data-balance={row.balanceRef} data-verdict={row.verdict} data-flagged={row.flags.length > 0 ? "true" : "false"}>
                  <th scope="row">{deskText(t, row.balanceRef)}</th>
                  <td>{deskText(t, row.label)}</td>
                  <td data-amount="copied">{deskText(t, row.leftLine)}</td>
                  <td data-amount="copied">{deskText(t, row.rightLine)}</td>
                  <td data-amount="copied">{deskText(t, row.differenceLine)}</td>
                  <td>{deskText(t, row.verdictWord)}.</td>
                  <td>
                    {row.flags.length === 0
                      ? t("svj")
                      : row.flags.map((flag) =>
                          flag.kind === "contradiction" ? (
                            <p key={flag.text} data-contradiction="true">
                              <WordMark word={t("s91")} /> {deskText(t, flag.text)}
                            </p>
                          ) : (
                            <p key={flag.text} data-timing-uncertain="true">
                              <WordMark word={t("s91")} /> {deskText(t, flag.text)}
                            </p>
                          ),
                        )}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </ScrollTable>
      ) : null}
    </section>
  );
}

export function ExportSection({ model }: { model: FinanceModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  const exported = model.export;
  return (
    <section id="finance-export-panel" className="discovery-section" aria-label={t("ski")} data-export-phase={exported.phase} data-verdict={exported.verdictWord}>
      <h3>{t("sl")}</h3>
      <p role="status" data-export-status={exported.phase}>
        {deskText(t, exported.statusLine)}
      </p>
      {exported.detailLine ? <p className="muted">{deskText(t, exported.detailLine)}</p> : null}
      {deskText(t, exported.verdictLines.map((line) => (
        <p key={line} data-verdict-reason="true">
          {exported.verdictWord === "withheld" ? <WordMark word={t("s26v")} /> : null} {deskText(t, line)}
        </p>
      )))}
      {exported.exportRef ? <p>{t("ski")}{" "}{deskText(t, exported.exportRef)}.</p> : null}
      {exported.scopeLine ? (
        <p data-export-scope="synthetic">
          <WordMark word={t("s1o8")} /> {deskText(t, exported.scopeLine)} {t("s231")}</p>
      ) : null}
      {deskText(t, exported.cutLines.map((line) => (
        <p key={line} className="muted" data-export-cut="true">
          {deskText(t, line)}
        </p>
      )))}
      {exported.rowsLine ? <p>{deskText(t, exported.rowsLine)}</p> : null}
      {exported.completeLine ? <p>{deskText(t, exported.completeLine)}</p> : null}
      {exported.digestLine ? <p className="muted">{deskText(t, exported.digestLine)}</p> : null}
      {exported.rows.length > 0 ? (
        <ScrollTable label={t("skl")}>
          <table className="finance-export-rows">
            <caption>{t("s1hw")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("sij")}</th>
                <th scope="col">{t("sps")}</th>
                <th scope="col">{t("sbe")}</th>
                <th scope="col">{t("s17e")}</th>
                <th scope="col">{t("sbr")}</th>
                <th scope="col">{t("s36")}</th>
                <th scope="col">{t("sfe")}</th>
              </tr>
            </thead>
            <tbody>
              {deskText(t, exported.rows.map((row) => (
                <tr key={row.entryRef} data-export-row={row.entryRef} data-cut={row.cutRef}>
                  <th scope="row">{deskText(t, row.entryRef)}</th>
                  <td>{deskText(t, row.kindWord)}</td>
                  <td>{deskText(t, row.caseRef)}</td>
                  <td>{deskText(t, row.payeeLine)}</td>
                  <td>{deskText(t, row.categoryWord)}</td>
                  <td data-amount="copied">{deskText(t, row.amountLine)}</td>
                  <td>{deskText(t, row.cutRef)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </ScrollTable>
      ) : null}
    </section>
  );
}

export function RequestsSection({ model }: { model: FinanceModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  const request = model.request;
  return (
    <section id="finance-requests" className="discovery-section" aria-label={t("s1fv")}>
      <h3>{t("s1fv")}</h3>
      <p className="muted">
        {t("s70")}</p>
      {model.fenceLine ? (
        <p data-fence="true">
          <WordMark word={t("sky")} /> {deskText(t, model.fenceLine)}
        </p>
      ) : null}
      {model.behindLine ? (
        <p data-behind="true">
          <WordMark word={t("s9s")} /> {deskText(t, model.behindLine)}
        </p>
      ) : null}
      {request === null ? (
        <p data-state="empty">{t("sxs")}</p>
      ) : (
        <div className="discovery-detail" data-last-request={request.seq} data-phase={request.phase}>
          <h4>
            {t("s1fq")}{" "}{deskText(t, request.seq)}: {deskText(t, request.kindWord)}
          </h4>
          <p data-phase-word={request.phase}>
            {deskText(t, request.phaseWord)}
            {request.code ? (" " + t("sd2", { code: request.code })) : ""}.
          </p>
          {request.detail ? <p className="muted">{deskText(t, request.detail)}</p> : null}
          {deskText(t, request.receiptLines.map((line) => (
            <p key={line} data-receipt-line="true">
              {deskText(t, line)}
            </p>
          )))}
        </div>
      )}
    </section>
  );
}

export function FinanceSessionSection({ session }: { session: FinanceSessionModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="finance-session" className="discovery-section" aria-label={t("s1js")}>
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
