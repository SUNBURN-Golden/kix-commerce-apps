import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy0 } from "../i18n/messages/pages--MerchantPanels";
import { messages as copy1 } from "../i18n/messages/merchant-operations";
import { messages as copy2 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
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
    <div className="merchant-scroll" role="region" aria-label={deskText(t, label)} tabIndex={0}>
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
      <button
        type="button"
        id={id}
        className="discovery-action"
        aria-disabled={control.enabled ? undefined : true}
        aria-describedby={control.reason ? reasonId : undefined}
        data-enabled={control.enabled ? "true" : "false"}
        onClick={control.enabled ? onPress : undefined}
      >
        {deskText(t, label)}
      </button>
      {control.reason ? (
        <p id={reasonId} className="muted" data-blocked-reason="true">
          <WordMark word={t("status.transport.blocked")} /> {deskText(t, control.reason)}
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
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">{t("s1j4")}</p>
      <h2>{deskText(t, MERCHANT_PAGE_TITLE)}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-merchant">
        SYNTHETIC. {deskText(t, MERCHANT_SOURCE_LINE)}
      </p>
      <p>{deskText(t, MERCHANT_BOUNDARY)}</p>
      <AmountNotice />
      <p>{deskText(t, MERCHANT_CLAIM_NOTE)}</p>
      <p>{deskText(t, MERCHANT_CUT_NOTE)}</p>
      <p>{deskText(t, MERCHANT_AGGREGATE_NOTE)}</p>
      <p>{deskText(t, MERCHANT_EXPORT_NOTE)}</p>
      <p>{deskText(t, MERCHANT_SCOPE_NOTE)}</p>
      <p>{deskText(t, MERCHANT_ACTOR_NOTE)}</p>
      <p>{deskText(t, MERCHANT_READ_NOTE)}</p>
      <p>{deskText(t, MERCHANT_SESSION_NOTE)}</p>
      <p>{deskText(t, WORKSPACE_RULING)}</p>
      <p data-hold-record="not-bound">{deskText(t, model.session.holdLine)}</p>
      <p data-not-composed="recorded">{deskText(t, model.session.notComposedLine)}</p>
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
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="merchant-controls" className="discovery-section" aria-label={t("s1o9")}>
      <div className="discovery-controls">
        <label htmlFor="merchant-scenario">
          {t("s1p5")}<select id="merchant-scenario" value={scenario} onChange={(event) => actions.setScenario(event.target.value as MerchantScenario)}>
            {deskText(t, MERCHANT_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {deskText(t, item)}
              </option>
            )))}
          </select>
        </label>
        <button type="button" id="merchant-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          {t("s1ax")}</button>
        <GuardedButton id="merchant-export" label={t("srf")} control={model.exportControl} onPress={() => actions.loadExport()} />
        <button type="button" id="merchant-switch" className="discovery-action" onClick={() => actions.switchScope()}>
          {t("s1nv")}</button>
        <button type="button" id="merchant-revoke" className="discovery-action" onClick={() => actions.revokeGrant()}>
          {t("s1h6")}</button>
        <button type="button" id="merchant-advance" className="discovery-action" onClick={() => actions.advanceCut()}>
          {t("s1y")}</button>
        <button type="button" id="merchant-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          {t("s1m2")}</button>
      </div>
      <p className="muted" data-scenario-note={scenario}>
        {deskText(t, SCENARIO_NOTES[scenario])} {t("sbx")}</p>
      <p className="muted">{deskText(t, MERCHANT_SYNTHETIC_CONTROL_NOTE)}</p>
    </section>
  );
}

export function MerchantStatus({ model }: { model: MerchantModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="merchant-status" className="discovery-section" tabIndex={-1} data-merchant-state={model.state}>
      <h3>{t("s1mj")}</h3>
      <p role="status" data-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {deskText(t, model.statusLine)}
        {model.detailLine ? t("sgg", { detailLine: model.detailLine }) : ""}
      </p>
      <p className="muted">{deskText(t, model.freshnessWord)}</p>
      <p className="muted">{deskText(t, model.scopeLine)}</p>
      <p className="muted">{deskText(t, model.watermarkLine)}</p>
      {model.lastLine ? (
        <p role="status" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word={t("s91")} /> : null} {deskText(t, model.lastLine)}
        </p>
      ) : null}
    </section>
  );
}

export function CutsSection({ model }: { model: MerchantModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="merchant-cuts" className="discovery-section" aria-label={t("s1l7")} data-cut-state={model.cutState}>
      <h3>{t("s1l7")}</h3>
      <p data-cut-line={model.cutState}>{deskText(t, model.cutLine)}</p>
      {model.cuts.length === 0 ? <p data-state="empty">{t("syo")}</p> : null}
      {model.cuts.length > 0 ? (
        <ScrollTable label={t("s1l7")}>
          <table className="merchant-cuts">
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

export function LensesSection({ model }: { model: MerchantModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="merchant-lenses" className="discovery-section" aria-label={t("siw")}>
      <h3>{t("siw")}</h3>
      <h4>{t("sit")}</h4>
      {model.events.length === 0 ? <p data-state="empty">{t("svd")}</p> : null}
      {model.events.length > 0 ? (
        <ul className="discovery-list" aria-label={t("siv")}>
          {deskText(t, model.events.map((row) => (
            <li key={row.eventRef} className="discovery-row" data-event={row.eventRef} data-cut={row.cutRef} data-provenance="synthetic" data-source="synthetic-merchant">
              <p>
                <span className="discovery-badge" data-provenance="synthetic">
                  SYNTHETIC
                </span>{" "}
                <span className="discovery-badge">{deskText(t, row.statusWord)}</span>
              </p>
              <h5>{deskText(t, row.eventRef)}</h5>
              <p>{deskText(t, row.title)}</p>
              <p>{t("sfe")}{" "}{deskText(t, row.cutRef)}.</p>
            </li>
          )))}
        </ul>
      ) : null}
      <h4>{t("desk.resale.title")}</h4>
      {model.listings.length === 0 ? <p data-state="empty">{t("sw0")}</p> : null}
      {model.listings.length > 0 ? (
        <ul className="discovery-list" aria-label={t("sr6")}>
          {deskText(t, model.listings.map((row) => (
            <li key={row.listingRef} className="discovery-row" data-listing={row.listingRef} data-cut={row.cutRef} data-provenance="synthetic" data-source="synthetic-merchant">
              <p>
                <span className="discovery-badge" data-provenance="synthetic">
                  SYNTHETIC
                </span>{" "}
                <span className="discovery-badge">{deskText(t, row.statusWord)}</span>
              </p>
              <h5>{deskText(t, row.listingRef)}</h5>
              <p>
                {deskText(t, row.channel)} {t("siq")}{" "}{deskText(t, row.eventRef)}
              </p>
              <p>{t("sfe")}{" "}{deskText(t, row.cutRef)}.</p>
            </li>
          )))}
        </ul>
      ) : null}
      <h4>{t("s24g")}</h4>
      {model.trades.length === 0 ? <p data-state="empty">{t("s12a")}</p> : null}
      {model.trades.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s24h")}>
          {deskText(t, model.trades.map((row) => (
            <li key={row.tradeRef} className="discovery-row" data-trade={row.tradeRef} data-cut={row.cutRef} data-provenance="synthetic" data-source="synthetic-merchant">
              <p>
                <span className="discovery-badge" data-provenance="synthetic">
                  SYNTHETIC
                </span>{" "}
                <span className="discovery-badge">{deskText(t, row.statusWord)}</span>
              </p>
              <h5>{deskText(t, row.tradeRef)}</h5>
              <p>
                {t("sqz")}{" "}{deskText(t, row.listingRef)} {t("siq")}{" "}{deskText(t, row.eventRef)}
              </p>
              <p>{deskText(t, row.statusLine)}</p>
              <p>{t("sfe")}{" "}{deskText(t, row.cutRef)}.</p>
            </li>
          )))}
        </ul>
      ) : null}
    </section>
  );
}

function LineCard({ line }: { line: MerchantLineModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
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
        <span className="discovery-badge">{deskText(t, line.kindWord)}</span>{" "}
        <span className="discovery-badge" data-line-state={line.state}>
          {deskText(t, line.stateWord)}
        </span>
      </p>
      <h5>{deskText(t, line.obligationRef)}</h5>
      <p data-amount="copied">{deskText(t, line.amountLine)}</p>
      <p data-claims="all-false">{deskText(t, line.claimLine)}</p>
      <p>{deskText(t, line.reasonLine)}</p>
      <p>{t("sfe")}{" "}{deskText(t, line.cutRef)}.</p>
    </li>
  );
}

export function LinesSection({ model }: { model: MerchantModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="merchant-lines" className="discovery-section" aria-label={t("st9")}>
      <h3>{t("st9")}</h3>
      <p className="muted">
        {t("s1i3")}</p>
      {model.lines.length === 0 ? <p data-state="empty">{t("sw6")}</p> : null}
      {model.lines.length > 0 ? (
        <ul className="discovery-list" aria-label={t("sta")}>
          {deskText(t, model.lines.map((line) => (
            <LineCard key={line.obligationRef} line={line} />
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

function AggregateRow({ row }: { row: MerchantAggregateModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <tr data-aggregate={row.kind} data-cut={row.cutRef} data-flagged={row.flagLines.length > 0 ? "true" : "false"}>
      <th scope="row">{deskText(t, row.kindWord)}</th>
      <td>{deskText(t, row.cutRef)}</td>
      <td>{row.generation}</td>
      <td>{deskText(t, row.lineCount)}</td>
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
  );
}

export function AggregateSection({ model }: { model: MerchantModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="merchant-aggregate" className="discovery-section" aria-label={t("s1la")} data-aggregate-state={model.aggregateState}>
      <h3>{t("s1la")}</h3>
      <p className="muted">
        {model.aggregateState === "current" ? t("shw") : model.aggregateState === "stale" ? t("s21") : model.aggregateState === "mismatch" ? t("s20") : t("syp")}
      </p>
      {model.aggregate.length > 0 ? (
        <ScrollTable label={t("s1lb")}>
          <table className="merchant-aggregate">
            <caption>{t("s1yh")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("sps")}</th>
                <th scope="col">{t("sfe")}</th>
                <th scope="col">{t("sme")}</th>
                <th scope="col">{t("sqt")}</th>
                <th scope="col">{t("s36")}</th>
                <th scope="col">{t("slo")}</th>
              </tr>
            </thead>
            <tbody>
              {deskText(t, model.aggregate.map((row) => (
                <AggregateRow key={`${row.kind}|${row.cutRef}`} row={row} />
              )))}
            </tbody>
          </table>
        </ScrollTable>
      ) : null}
    </section>
  );
}

export function ExportSection({ model }: { model: MerchantModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  const exported = model.export;
  return (
    <section id="merchant-export-panel" className="discovery-section" aria-label={t("ski")} data-export-phase={exported.phase} data-verdict={exported.verdictWord}>
      <h3>{t("ski")}</h3>
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
      {exported.cutLine ? <p>{deskText(t, exported.cutLine)}</p> : null}
      {exported.rowsLine ? <p>{deskText(t, exported.rowsLine)}</p> : null}
      {exported.completeLine ? <p>{deskText(t, exported.completeLine)}</p> : null}
      {exported.digestLine ? <p className="muted">{deskText(t, exported.digestLine)}</p> : null}
      {exported.rows.length > 0 ? (
        <ScrollTable label={t("skl")}>
          <table className="merchant-export-rows">
            <caption>{t("s1hw")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("s13g")}</th>
                <th scope="col">{t("sps")}</th>
                <th scope="col">{t("s1mi")}</th>
                <th scope="col">{t("s24e")}</th>
                <th scope="col">{t("s36")}</th>
                <th scope="col">{t("sfe")}</th>
              </tr>
            </thead>
            <tbody>
              {deskText(t, exported.rows.map((row) => (
                <tr key={row.obligationRef} data-export-row={row.obligationRef} data-cut={row.cutRef}>
                  <th scope="row">{deskText(t, row.obligationRef)}</th>
                  <td>{deskText(t, row.kindWord)}</td>
                  <td>{deskText(t, row.stateWord)}</td>
                  <td>{deskText(t, row.tradeRef)}</td>
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

export function MerchantSessionSection({ session }: { session: MerchantSessionModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="merchant-session" className="discovery-section" aria-label={t("s1js")}>
      <h3>{t("s1js")}</h3>
      <p>{deskText(t, session.contextLine)}</p>
      <p data-counters="true">{deskText(t, session.countersLine)}</p>
      <p className="muted">{deskText(t, session.notComposedLine)}</p>
      <p className="muted">{deskText(t, session.holdLine)}</p>
    </section>
  );
}
