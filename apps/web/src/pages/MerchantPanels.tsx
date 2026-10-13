import type { ReactNode } from "react";
import { MERCHANT_SCENARIOS, type MerchantScenario } from "@kix/protocol-adapter";
import { AmountNotice, StatusMark } from "../a11y/marks";
import {
  MERCHANT_ACTOR_NOTE,
  MERCHANT_AGGREGATE_NOTE,
  MERCHANT_BOUNDARY,
  MERCHANT_CLAIM_NOTE,
  MERCHANT_CUT_NOTE,
  MERCHANT_EXPORT_NOTE,
  MERCHANT_PAGE_TITLE,
  MERCHANT_READ_NOTE,
  MERCHANT_SCOPE_NOTE,
  MERCHANT_SESSION_NOTE,
  MERCHANT_SOURCE_LINE,
  MERCHANT_SYNTHETIC_CONTROL_NOTE,
  SCENARIO_NOTES,
  type ControlModel,
  type MerchantActions,
  type MerchantAggregateModel,
  type MerchantLineModel,
  type MerchantModel,
  type MerchantSessionModel,
} from "../merchant-operations";
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
    <div className="merchant-scroll" role="region" aria-label={label} tabIndex={0}>
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

export function MerchantBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: MerchantScenario;
  model: MerchantModel;
}) {
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">Seller operations</p>
      <h2>{MERCHANT_PAGE_TITLE}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-merchant">
        SYNTHETIC. {MERCHANT_SOURCE_LINE}
      </p>
      <p>{MERCHANT_BOUNDARY}</p>
      <AmountNotice />
      <p>{MERCHANT_CLAIM_NOTE}</p>
      <p>{MERCHANT_CUT_NOTE}</p>
      <p>{MERCHANT_AGGREGATE_NOTE}</p>
      <p>{MERCHANT_EXPORT_NOTE}</p>
      <p>{MERCHANT_SCOPE_NOTE}</p>
      <p>{MERCHANT_ACTOR_NOTE}</p>
      <p>{MERCHANT_READ_NOTE}</p>
      <p>{MERCHANT_SESSION_NOTE}</p>
      <p>{WORKSPACE_RULING}</p>
      <p data-hold-record="not-bound">{model.session.holdLine}</p>
      <p data-not-composed="recorded">{model.session.notComposedLine}</p>
    </header>
  );
}

export function MerchantControls({
  scenario,
  model,
  actions,
}: {
  scenario: MerchantScenario;
  model: MerchantModel;
  actions: MerchantActions;
}) {
  return (
    <section id="merchant-controls" className="discovery-section" aria-label="Synthetic controls">
      <div className="discovery-controls">
        <label htmlFor="merchant-scenario">
          Synthetic scenario
          <select id="merchant-scenario" value={scenario} onChange={(event) => actions.setScenario(event.target.value as MerchantScenario)}>
            {MERCHANT_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button type="button" id="merchant-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          Read again
        </button>
        <GuardedButton id="merchant-export" label="Load the export" control={model.exportControl} onPress={() => actions.loadExport()} />
        <button type="button" id="merchant-switch" className="discovery-action" onClick={() => actions.switchScope()}>
          Switch merchant scope
        </button>
        <button type="button" id="merchant-revoke" className="discovery-action" onClick={() => actions.revokeGrant()}>
          Revoke grant
        </button>
        <button type="button" id="merchant-advance" className="discovery-action" onClick={() => actions.advanceCut()}>
          Advance source cut
        </button>
        <button type="button" id="merchant-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          Start a new synthetic session
        </button>
      </div>
      <p className="muted" data-scenario-note={scenario}>
        {SCENARIO_NOTES[scenario]} Changing the scenario starts a new synthetic session.
      </p>
      <p className="muted">{MERCHANT_SYNTHETIC_CONTROL_NOTE}</p>
    </section>
  );
}

export function MerchantStatus({ model }: { model: MerchantModel }) {
  return (
    <section id="merchant-status" className="discovery-section" tabIndex={-1} data-merchant-state={model.state}>
      <h3>Status</h3>
      <p role="status" data-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {model.statusLine}
        {model.detailLine ? ` ${model.detailLine}` : ""}
      </p>
      <p className="muted">{model.freshnessWord}</p>
      <p className="muted">{model.scopeLine}</p>
      <p className="muted">{model.watermarkLine}</p>
      {model.lastLine ? (
        <p role="status" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word="Attention." /> : null} {model.lastLine}
        </p>
      ) : null}
    </section>
  );
}

export function CutsSection({ model }: { model: MerchantModel }) {
  return (
    <section id="merchant-cuts" className="discovery-section" aria-label="Source cuts" data-cut-state={model.cutState}>
      <h3>Source cuts</h3>
      <p data-cut-line={model.cutState}>{model.cutLine}</p>
      {model.cuts.length === 0 ? <p data-state="empty">No source cut is listed in this read.</p> : null}
      {model.cuts.length > 0 ? (
        <ScrollTable label="Source cuts">
          <table className="merchant-cuts">
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

export function LensesSection({ model }: { model: MerchantModel }) {
  return (
    <section id="merchant-lenses" className="discovery-section" aria-label="Events, listings, and trades">
      <h3>Events, listings, and trades</h3>
      <h4>Events</h4>
      {model.events.length === 0 ? <p data-state="empty">No event in this read.</p> : null}
      {model.events.length > 0 ? (
        <ul className="discovery-list" aria-label="Events in the last read">
          {model.events.map((row) => (
            <li key={row.eventRef} className="discovery-row" data-event={row.eventRef} data-cut={row.cutRef} data-provenance="synthetic" data-source="synthetic-merchant">
              <p>
                <span className="discovery-badge" data-provenance="synthetic">
                  SYNTHETIC
                </span>{" "}
                <span className="discovery-badge">{row.statusWord}</span>
              </p>
              <h5>{row.eventRef}</h5>
              <p>{row.title}</p>
              <p>Cut {row.cutRef}.</p>
            </li>
          ))}
        </ul>
      ) : null}
      <h4>Listings</h4>
      {model.listings.length === 0 ? <p data-state="empty">No listing in this read.</p> : null}
      {model.listings.length > 0 ? (
        <ul className="discovery-list" aria-label="Listings in the last read">
          {model.listings.map((row) => (
            <li key={row.listingRef} className="discovery-row" data-listing={row.listingRef} data-cut={row.cutRef} data-provenance="synthetic" data-source="synthetic-merchant">
              <p>
                <span className="discovery-badge" data-provenance="synthetic">
                  SYNTHETIC
                </span>{" "}
                <span className="discovery-badge">{row.statusWord}</span>
              </p>
              <h5>{row.listingRef}</h5>
              <p>
                {row.channel} · event {row.eventRef}
              </p>
              <p>Cut {row.cutRef}.</p>
            </li>
          ))}
        </ul>
      ) : null}
      <h4>Trades</h4>
      {model.trades.length === 0 ? <p data-state="empty">No trade in this read.</p> : null}
      {model.trades.length > 0 ? (
        <ul className="discovery-list" aria-label="Trades in the last read">
          {model.trades.map((row) => (
            <li key={row.tradeRef} className="discovery-row" data-trade={row.tradeRef} data-cut={row.cutRef} data-provenance="synthetic" data-source="synthetic-merchant">
              <p>
                <span className="discovery-badge" data-provenance="synthetic">
                  SYNTHETIC
                </span>{" "}
                <span className="discovery-badge">{row.statusWord}</span>
              </p>
              <h5>{row.tradeRef}</h5>
              <p>
                listing {row.listingRef} · event {row.eventRef}
              </p>
              <p>{row.statusLine}</p>
              <p>Cut {row.cutRef}.</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function LineCard({ line }: { line: MerchantLineModel }) {
  return (
    <li
      className="discovery-row"
      data-obligation={line.obligationRef}
      data-kind={line.kind}
      data-state={line.state}
      data-cut={line.cutRef}
      data-provenance="synthetic"
      data-source="synthetic-merchant"
    >
      <p>
        <span className="discovery-badge" data-provenance="synthetic">
          SYNTHETIC
        </span>{" "}
        <span className="discovery-badge">{line.kindWord}</span>{" "}
        <span className="discovery-badge" data-line-state={line.state}>
          {line.stateWord}
        </span>
      </p>
      <h5>{line.obligationRef}</h5>
      <p data-amount="copied">{line.amountLine}</p>
      <p data-claims="all-false">{line.claimLine}</p>
      <p>{line.reasonLine}</p>
      <p>Cut {line.cutRef}.</p>
    </li>
  );
}

export function LinesSection({ model }: { model: MerchantModel }) {
  return (
    <section id="merchant-lines" className="discovery-section" aria-label="Money lines">
      <h3>Money lines</h3>
      <p className="muted">
        Sales, unpaid, held, and refund burden stay four kinds on their own cuts. None is a settled or lendable figure.
      </p>
      {model.lines.length === 0 ? <p data-state="empty">No money line in this read.</p> : null}
      {model.lines.length > 0 ? (
        <ul className="discovery-list" aria-label="Money lines in the last read">
          {model.lines.map((line) => (
            <LineCard key={line.obligationRef} line={line} />
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

function AggregateRow({ row }: { row: MerchantAggregateModel }) {
  return (
    <tr data-aggregate={row.kind} data-cut={row.cutRef} data-flagged={row.flagLines.length > 0 ? "true" : "false"}>
      <th scope="row">{row.kindWord}</th>
      <td>{row.cutRef}</td>
      <td>{row.generation}</td>
      <td>{row.lineCount}</td>
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
  );
}

export function AggregateSection({ model }: { model: MerchantModel }) {
  return (
    <section id="merchant-aggregate" className="discovery-section" aria-label="Source figures" data-aggregate-state={model.aggregateState}>
      <h3>Source figures</h3>
      <p className="muted">
        {model.aggregateState === "current"
          ? "Each figure matches the cut and the line count of this read."
          : model.aggregateState === "stale"
            ? "A figure was built at an older generation. It stays flagged and is not recomputed."
            : model.aggregateState === "mismatch"
              ? "A figure disagrees with this read. It stays flagged and is not merged."
              : "No source figure in this read."}
      </p>
      {model.aggregate.length > 0 ? (
        <ScrollTable label="Source figures per kind and cut">
          <table className="merchant-aggregate">
            <caption>The source&apos;s own figure per kind and cut</caption>
            <thead>
              <tr>
                <th scope="col">Kind</th>
                <th scope="col">Cut</th>
                <th scope="col">Generation</th>
                <th scope="col">Lines</th>
                <th scope="col">Amount</th>
                <th scope="col">Flags</th>
              </tr>
            </thead>
            <tbody>
              {model.aggregate.map((row) => (
                <AggregateRow key={`${row.kind}|${row.cutRef}`} row={row} />
              ))}
            </tbody>
          </table>
        </ScrollTable>
      ) : null}
    </section>
  );
}

export function ExportSection({ model }: { model: MerchantModel }) {
  const exported = model.export;
  return (
    <section id="merchant-export-panel" className="discovery-section" aria-label="Export" data-export-phase={exported.phase} data-verdict={exported.verdictWord}>
      <h3>Export</h3>
      <p role="status" data-export-status={exported.phase}>
        {exported.statusLine}
      </p>
      {exported.detailLine ? <p className="muted">{exported.detailLine}</p> : null}
      {exported.verdictLines.map((line) => (
        <p key={line} data-verdict-reason="true">
          <WordMark word="Withheld." /> {line}
        </p>
      ))}
      {exported.exportRef ? <p>Export {exported.exportRef}.</p> : null}
      {exported.cutLine ? <p>{exported.cutLine}</p> : null}
      {exported.rowsLine ? <p>{exported.rowsLine}</p> : null}
      {exported.completeLine ? <p>{exported.completeLine}</p> : null}
      {exported.digestLine ? <p className="muted">{exported.digestLine}</p> : null}
      {exported.rows.length > 0 ? (
        <ScrollTable label="Export rows">
          <table className="merchant-export-rows">
            <caption>Rows of the loaded export, copied</caption>
            <thead>
              <tr>
                <th scope="col">Obligation</th>
                <th scope="col">Kind</th>
                <th scope="col">State</th>
                <th scope="col">Trade</th>
                <th scope="col">Amount</th>
                <th scope="col">Cut</th>
              </tr>
            </thead>
            <tbody>
              {exported.rows.map((row) => (
                <tr key={row.obligationRef} data-export-row={row.obligationRef} data-cut={row.cutRef}>
                  <th scope="row">{row.obligationRef}</th>
                  <td>{row.kindWord}</td>
                  <td>{row.stateWord}</td>
                  <td>{row.tradeRef}</td>
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

export function MerchantSessionSection({ session }: { session: MerchantSessionModel }) {
  return (
    <section id="merchant-session" className="discovery-section" aria-label="Session record">
      <h3>Session record</h3>
      <p>{session.contextLine}</p>
      <p data-counters="true">{session.countersLine}</p>
      <p className="muted">{session.notComposedLine}</p>
      <p className="muted">{session.holdLine}</p>
    </section>
  );
}
