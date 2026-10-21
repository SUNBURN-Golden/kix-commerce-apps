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
  return (
    <span className="status-mark" data-status-mark="blocked">
      <span className="status-word">{word}</span>
    </span>
  );
}

/** A wide table scrolls inside its own region, so the page does not scroll sideways. */
function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="finance-scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
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
        {label}
      </ConnectivityWriteButton>
      {control.reason && describedBy === undefined ? (
        <p id={reasonId} className="muted" data-blocked-reason="true">
          <WordMark word="Blocked." /> {control.reason}
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
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">Finance operations</p>
      <h2>{FINANCE_PAGE_TITLE}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-finance">
        SYNTHETIC. {FINANCE_SOURCE_LINE}
      </p>
      <p>{FINANCE_BOUNDARY}</p>
      <p data-no-force="true">{FINANCE_NO_FORCE_NOTE}</p>
      <AmountNotice />
      <p>{FINANCE_CLAIM_NOTE}</p>
      <p>{FINANCE_CUT_NOTE}</p>
      <p>{FINANCE_FIGURES_NOTE}</p>
      <p>{FINANCE_EXPORT_NOTE}</p>
      <p>{FINANCE_SCOPE_NOTE}</p>
      <p>{FINANCE_ACTOR_NOTE}</p>
      <p>{FINANCE_READ_NOTE}</p>
      <p>{FINANCE_SESSION_NOTE}</p>
      <p>{WORKSPACE_RULING}</p>
      <p data-hold-record="not-bound">{model.session.holdLine}</p>
      <p data-not-composed="recorded">{model.session.notComposedLine}</p>
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
  return (
    <section id="finance-controls" className="discovery-section" aria-label="Synthetic controls">
      <div className="discovery-controls">
        <PickAndApply
          id="finance-scenario"
          label="Synthetic scenario"
          value={scenario}
          options={FINANCE_SCENARIOS}
          applyId="finance-apply-scenario"
          applyLabel="Start a session with this scenario"
          onApply={(next) => actions.setScenario(next as FinanceScenario)}
        />
        <PickAndApply
          id="finance-actor"
          label="Desk actor"
          value={actorRef}
          options={FINANCE_ACTORS}
          applyId="finance-apply-actor"
          applyLabel="Switch to this actor"
          onApply={(next) => actions.switchActor(next)}
        />
        <button type="button" id="finance-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          Read again
        </button>
        <GuardedButton id="finance-export" label="Load the export" control={model.exportControl} onPress={() => actions.loadExport()} />
        <button type="button" id="finance-switch" className="discovery-action" onClick={() => actions.switchScope()}>
          Switch book scope
        </button>
        <ConnectivityWriteButton type="button" id="finance-revoke" className="discovery-action" onClick={() => actions.revokeGrant()}>
          Simulate: withdraw the grant
        </ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="finance-advance" className="discovery-action" onClick={() => actions.advanceCut()}>
          Simulate: the source moves to its next cut
        </ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="finance-post-correction" className="discovery-action" onClick={() => actions.postSourceCorrection()}>
          Simulate: the source posts a later cut
        </ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="finance-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          Start a new synthetic session
        </ConnectivityWriteButton>
      </div>
      <p className="muted" data-scenario-note={scenario}>
        {SCENARIO_NOTES[scenario]} Choosing a scenario does nothing until you start a session with it, and starting one clears earlier reads, exports, and requests.
      </p>
      <p className="muted">{FINANCE_SYNTHETIC_CONTROL_NOTE}</p>
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
  const [choice, setChoice] = useState(value);
  useEffect(() => {
    setChoice(value);
  }, [value]);
  return (
    <>
      <label htmlFor={id}>
        {label}
        <select id={id} value={choice} onChange={(event) => setChoice(event.target.value)}>
          {options.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <button type="button" id={applyId} className="discovery-action" onClick={() => onApply(choice)}>
        {applyLabel}
      </button>
    </>
  );
}

export function FinanceStatus({ model }: { model: FinanceModel }) {
  return (
    <section id="finance-status" className="discovery-section" tabIndex={-1} data-finance-state={model.state}>
      <h3>Status</h3>
      <p role="status" data-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {model.statusLine}
        {model.detailLine ? ` ${model.detailLine}` : ""}
      </p>
      <p className="muted">{model.freshnessWord}</p>
      <p className="muted">{model.scopeLine}</p>
      <p className="muted">{model.watermarkLine}</p>
      <p className="muted" data-queue-line="true">
        {model.queueLine}
      </p>
      {model.lastLine ? (
        <p role="status" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word="Attention." /> : null} {model.lastLine}
        </p>
      ) : null}
    </section>
  );
}

export function AuthoritySection({ model }: { model: FinanceModel }) {
  return (
    <section id="finance-authority" className="discovery-section" aria-label="Who may do what">
      <h3>Who may do what</h3>
      <p className="muted">
        A correction proposal and the authority to change economic state are different things. A proposal and an approval are
        records. Only the last row moves the ledger, and no actor on this desk holds it.
      </p>
      <ScrollTable label="Authorities and who holds them">
        <table className="finance-authority">
          <caption>The source&apos;s authorities for the book on this page</caption>
          <thead>
            <tr>
              <th scope="col">Authority</th>
              <th scope="col">Held by</th>
              <th scope="col">Effect</th>
              <th scope="col">Changes economic state</th>
            </tr>
          </thead>
          <tbody>
            {model.authority.map((row) => (
              <tr key={row.authority} data-authority={row.authority} data-changes-economic-state={row.changesEconomicState ? "true" : "false"} data-held-by-actor={row.heldByActor ? "true" : "false"}>
                <th scope="row">{row.word}</th>
                <td>
                  {row.heldByLine}
                  {row.heldByActor ? " The actor on screen holds it." : ""}
                </td>
                <td>{row.effectLine}</td>
                <td>{row.changesEconomicState ? "Yes, and nobody here holds it." : "No."}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
    </section>
  );
}

export function CutsSection({ model }: { model: FinanceModel }) {
  return (
    <section id="finance-cuts" className="discovery-section" aria-label="Source cuts" data-cut-alignment={model.cutAlignment}>
      <h3>Source cuts</h3>
      <p data-cut-line={model.cutAlignment}>{model.cutLine}</p>
      {model.cuts.length === 0 ? <p data-state="empty">No source cut is listed in this read.</p> : null}
      {model.cuts.length > 0 ? (
        <ScrollTable label="Source cuts">
          <table className="finance-cuts">
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
                <tr key={cut.cutRef} data-cut={cut.cutRef} data-cut-source={cut.source}>
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

function CaseCard({ row, model, actions }: { row: FinanceCaseModel; model: FinanceModel; actions: FinanceActions }) {
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
        <Synthetic /> <span className="discovery-badge">{row.categoryWord}</span>{" "}
        <span className="discovery-badge" data-case-state={row.state}>
          {row.stateWord}
        </span>
      </p>
      <h4>{row.caseRef}</h4>
      <p data-verdict-word={row.verdict}>{row.verdictWord}.</p>
      {row.explanationLines.map((line) => (
        <p key={line} data-explanation="true">
          {line}
        </p>
      ))}
      <p data-original-trade={row.tradeLinked ? "linked" : "unlinked"}>
        {!row.tradeLinked ? <WordMark word="Attention." /> : null} {row.tradeLine}{" "}
        {row.tradeLinked ? <Link to="/merchant">Open the merchant workroom</Link> : null}
      </p>
      {row.merchantLineLine ? <p data-link="merchant-line">{row.merchantLineLine}</p> : null}
      {row.paymentLine ? (
        <p data-link="servicing-payment">
          {row.paymentLine} <Link to="/credit/servicing">Open the credit servicing desk</Link>
        </p>
      ) : null}
      <p className="finance-figures-line">
        <span data-amount="copied">{row.expectedLine}</span> · <span data-amount="copied">{row.observedLine}</span> ·{" "}
        <span data-amount="copied">{row.differenceLine}</span>
      </p>
      <p>
        {row.sidesLine} {row.reasonLine} Cut {row.cutRef}.
      </p>
      {row.skewLine ? (
        <p data-timing-uncertain="true">
          <WordMark word="Attention." /> {row.skewLine}
        </p>
      ) : null}
      {row.contradictionLine ? (
        <p data-contradiction="true">
          <WordMark word="Attention." /> {row.contradictionLine}
        </p>
      ) : null}

      {row.facts.length > 0 ? (
        <>
          <h5>Facts</h5>
          <ul className="finance-facts" aria-label={`Facts of ${row.caseRef}`}>
            {row.facts.map((fact) => (
              <li key={fact.factRef} data-fact={fact.factRef} data-arrival={fact.late ? "after-cut" : "in-cut"} data-cut={fact.cutRef}>
                <strong>{fact.factRef}</strong> {fact.kindWord}. {fact.amountLine}. {fact.arrivalWord}, cut {fact.cutRef}. {fact.label}
                {fact.late ? (
                  <>
                    {" "}
                    <WordMark word="Late." /> It is its own fact and is not folded into the cut it missed.
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {row.allocations.length > 0 ? (
        <>
          <h5>Payee allocations</h5>
          <ScrollTable label={`Allocations of ${row.caseRef}`}>
            <table className="finance-allocations">
              <caption>The source&apos;s own shares and remainder for {row.caseRef}</caption>
              <thead>
                <tr>
                  <th scope="col">Allocation</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Role</th>
                  <th scope="col">Payee</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Cut</th>
                </tr>
              </thead>
              <tbody>
                {row.allocations.map((item) => (
                  <tr key={item.allocationRef} data-allocation={item.allocationRef} data-remainder={item.remainder ? "true" : "false"} data-cut={item.cutRef}>
                    <th scope="row">{item.allocationRef}</th>
                    <td>{item.kindWord}</td>
                    <td>{item.roleWord}</td>
                    <td>{item.payeeLine}</td>
                    <td data-amount="copied">{item.amountLine}</td>
                    <td>{item.cutRef}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        </>
      ) : null}

      {row.proposals.length > 0 ? (
        <>
          <h5>Correction proposals</h5>
          <ul className="finance-proposals" aria-label={`Proposals on ${row.caseRef}`}>
            {row.proposals.map((proposal) => (
              <li key={proposal.proposalRef} data-proposal={proposal.proposalRef} data-proposal-state={proposal.state}>
                <strong>{proposal.proposalRef}</strong> {proposal.correctionWord}. Proposed by {proposal.proposedBy}. {proposal.stateWord}. Note: {proposal.note}
                <br />
                <GuardedButton
                  id={`finance-approve-${proposal.proposalRef}`}
                  label={`Record an approval of ${proposal.proposalRef}`}
                  control={proposal.approve}
                  describedBy={model.approveBlock ? "finance-approve-reason" : undefined}
                  onPress={() => actions.approveProposal(proposal.proposalRef)}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {row.corrections.length > 0 ? (
        <div className="discovery-controls" role="group" aria-label={`Propose a correction on ${row.caseRef}`}>
          {row.corrections.map((item) => (
            <GuardedButton
              key={item.correction}
              id={`finance-propose-${row.caseRef}-${item.correction}`}
              label={item.label}
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
          ))}
        </div>
      ) : null}
      {row.caseBlock ? (
        <p id={blockId} className="muted" data-case-block="true" data-blocked-reason="true">
          <WordMark word="Blocked." /> {row.caseBlock}
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
  return (
    <section id="finance-queue" className="discovery-section" aria-label="Exception queue" data-case-count={model.cases.length}>
      <h3>Exception queue</h3>
      <p className="muted">
        Each case is a mismatch the source states, linked to its original trade. Unmatched, duplicate, late, several-payee,
        residual, and balance cases keep their own words. A control here records a proposal; none changes the ledger.
      </p>
      <div className="discovery-controls">
        <label htmlFor="finance-note">
          Note for a proposal
          <input id="finance-note" name="finance-note" autoComplete="off" defaultValue="Reviewed against the source cuts." />
        </label>
      </div>
      {model.proposeBlock ? (
        <p id="finance-propose-reason" className="muted" data-blocked-reason="true" data-block="propose">
          <WordMark word="Blocked." /> Corrections are off: {model.proposeBlock}
        </p>
      ) : null}
      {model.approveBlock ? (
        <p id="finance-approve-reason" className="muted" data-blocked-reason="true" data-block="approve">
          <WordMark word="Blocked." /> Approvals are off: {model.approveBlock}
        </p>
      ) : null}
      {model.cases.length === 0 ? <p data-state="empty">No case in this read.</p> : null}
      {model.cases.length > 0 ? (
        <ul className="discovery-list" aria-label="Cases in the last read">
          {model.cases.map((row) => (
            <CaseCard key={row.caseRef} row={row} model={model} actions={actions} />
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

export function FiguresSection({ model }: { model: FinanceModel }) {
  return (
    <section id="finance-figures" className="discovery-section" aria-label="Source figures" data-totals-state={model.totalsState}>
      <h3>Source figures</h3>
      <p className="muted">
        {model.totalsState === "current"
          ? "Each total matches the cut and the case count of this read."
          : model.totalsState === "stale"
            ? "A total was built at an older generation. It stays flagged and is not recomputed."
            : model.totalsState === "mismatch"
              ? "A total disagrees with this read. It stays flagged and is not merged."
              : "No source total in this read."}
      </p>
      {model.totals.length > 0 ? (
        <ScrollTable label="Source totals per category and cut">
          <table className="finance-totals">
            <caption>The source&apos;s own total per category and cut</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Cut</th>
                <th scope="col">Generation</th>
                <th scope="col">Cases</th>
                <th scope="col">Total</th>
                <th scope="col">Flags</th>
              </tr>
            </thead>
            <tbody>
              {model.totals.map((row) => (
                <tr key={`${row.category}|${row.cutRef}`} data-total={row.category} data-cut={row.cutRef} data-flagged={row.flagLines.length > 0 ? "true" : "false"}>
                  <th scope="row">{row.categoryWord}</th>
                  <td>{row.cutRef}</td>
                  <td>{row.generation}</td>
                  <td>{row.caseCount}</td>
                  <td data-amount="copied">{row.amountLine}</td>
                  <td>
                    {row.flagLines.length === 0
                      ? "No flag."
                      : row.flagLines.map((line) => (
                          <p key={line} data-flag="true">
                            <WordMark word="Attention." /> {line}
                          </p>
                        ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      ) : null}
      <h4>Balances between sources</h4>
      {model.balances.length === 0 ? <p data-state="empty">No balance in this read.</p> : null}
      {model.balances.length > 0 ? (
        <ScrollTable label="Balances between sources">
          <table className="finance-balances">
            <caption>The source&apos;s own comparison of two sources</caption>
            <thead>
              <tr>
                <th scope="col">Balance</th>
                <th scope="col">Sources</th>
                <th scope="col">Left</th>
                <th scope="col">Right</th>
                <th scope="col">Difference</th>
                <th scope="col">Verdict</th>
                <th scope="col">Flags</th>
              </tr>
            </thead>
            <tbody>
              {model.balances.map((row) => (
                <tr key={row.balanceRef} data-balance={row.balanceRef} data-verdict={row.verdict} data-flagged={row.flags.length > 0 ? "true" : "false"}>
                  <th scope="row">{row.balanceRef}</th>
                  <td>{row.label}</td>
                  <td data-amount="copied">{row.leftLine}</td>
                  <td data-amount="copied">{row.rightLine}</td>
                  <td data-amount="copied">{row.differenceLine}</td>
                  <td>{row.verdictWord}.</td>
                  <td>
                    {row.flags.length === 0
                      ? "No flag."
                      : row.flags.map((flag) =>
                          flag.kind === "contradiction" ? (
                            <p key={flag.text} data-contradiction="true">
                              <WordMark word="Attention." /> {flag.text}
                            </p>
                          ) : (
                            <p key={flag.text} data-timing-uncertain="true">
                              <WordMark word="Attention." /> {flag.text}
                            </p>
                          ),
                        )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      ) : null}
    </section>
  );
}

export function ExportSection({ model }: { model: FinanceModel }) {
  const exported = model.export;
  return (
    <section id="finance-export-panel" className="discovery-section" aria-label="Export" data-export-phase={exported.phase} data-verdict={exported.verdictWord}>
      <h3>Accounting export</h3>
      <p role="status" data-export-status={exported.phase}>
        {exported.statusLine}
      </p>
      {exported.detailLine ? <p className="muted">{exported.detailLine}</p> : null}
      {exported.verdictLines.map((line) => (
        <p key={line} data-verdict-reason="true">
          {exported.verdictWord === "withheld" ? <WordMark word="Withheld." /> : null} {line}
        </p>
      ))}
      {exported.exportRef ? <p>Export {exported.exportRef}.</p> : null}
      {exported.scopeLine ? (
        <p data-export-scope="synthetic">
          <WordMark word="Synthetic." /> {exported.scopeLine} This file is not an accounting record.
        </p>
      ) : null}
      {exported.cutLines.map((line) => (
        <p key={line} className="muted" data-export-cut="true">
          {line}
        </p>
      ))}
      {exported.rowsLine ? <p>{exported.rowsLine}</p> : null}
      {exported.completeLine ? <p>{exported.completeLine}</p> : null}
      {exported.digestLine ? <p className="muted">{exported.digestLine}</p> : null}
      {exported.rows.length > 0 ? (
        <ScrollTable label="Export rows">
          <table className="finance-export-rows">
            <caption>Rows of the loaded export, copied</caption>
            <thead>
              <tr>
                <th scope="col">Entry</th>
                <th scope="col">Kind</th>
                <th scope="col">Case</th>
                <th scope="col">Payee</th>
                <th scope="col">Category</th>
                <th scope="col">Amount</th>
                <th scope="col">Cut</th>
              </tr>
            </thead>
            <tbody>
              {exported.rows.map((row) => (
                <tr key={row.entryRef} data-export-row={row.entryRef} data-cut={row.cutRef}>
                  <th scope="row">{row.entryRef}</th>
                  <td>{row.kindWord}</td>
                  <td>{row.caseRef}</td>
                  <td>{row.payeeLine}</td>
                  <td>{row.categoryWord}</td>
                  <td data-amount="copied">{row.amountLine}</td>
                  <td>{row.cutRef}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      ) : null}
    </section>
  );
}

export function RequestsSection({ model }: { model: FinanceModel }) {
  const request = model.request;
  return (
    <section id="finance-requests" className="discovery-section" aria-label="Requests">
      <h3>Requests</h3>
      <p className="muted">
        A request is built from the last read and sent once. A control that is off is a request that never leaves, and its reason
        is shown. The reviewer proposes; the approver approves. Both are records. Recorded is not applied.
      </p>
      {model.fenceLine ? (
        <p data-fence="true">
          <WordMark word="Fenced." /> {model.fenceLine}
        </p>
      ) : null}
      {model.behindLine ? (
        <p data-behind="true">
          <WordMark word="Behind." /> {model.behindLine}
        </p>
      ) : null}
      {request === null ? (
        <p data-state="empty">No request sent in this session.</p>
      ) : (
        <div className="discovery-detail" data-last-request={request.seq} data-phase={request.phase}>
          <h4>
            Request {request.seq}: {request.kindWord}
          </h4>
          <p data-phase-word={request.phase}>
            {request.phaseWord}
            {request.code ? ` (${request.code})` : ""}.
          </p>
          {request.detail ? <p className="muted">{request.detail}</p> : null}
          {request.receiptLines.map((line) => (
            <p key={line} data-receipt-line="true">
              {line}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

export function FinanceSessionSection({ session }: { session: FinanceSessionModel }) {
  return (
    <section id="finance-session" className="discovery-section" aria-label="Session record">
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
