import { ReadRow } from "./ReadState";
import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy0 } from "../i18n/messages/pages--PlatformPanels";
import { messages as copy1 } from "../i18n/messages/platform-journey";
import { messages as copy2 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { RefusalScope } from "../connectivity/refusal";
import { useState, type ReactNode } from "react";
import { PLATFORM_SCENARIOS, PLATFORM_TIERS, type PlatformScenario, type PlatformTier } from "@kix/protocol-adapter";
import { AmountNotice, StatusMark } from "../a11y/marks";
import {
  PLATFORM_ACTOR_NOTE,
  PLATFORM_BOUNDARY,
  PLATFORM_FENCE_NOTE,
  PLATFORM_HOLD_NOTE,
  PLATFORM_READ_NOTE,
  PLATFORM_REFUND_NOTE,
  PLATFORM_SESSION_NOTE,
  PLATFORM_SOURCE_LINE,
  PLATFORM_TIER_NOTE,
  PLATFORM_TITLE,
  SCENARIO_NOTES,
  type ControlModel,
  type IdentityRowModel,
  type ListingModel,
  type PlatformActions,
  type PlatformModel,
  type RightModel,
  type SessionModel,
  type TradeModel,
} from "../platform-journey";
import { WORKSPACE_RULING } from "../workspace/registry";

/** A word, not only a color. The shared mark carries a sentence about fields that does not fit a fence. */
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
    <div className="platform-scroll" role="region" aria-label={deskText(t, label)} tabIndex={0}>
      {deskText(t, children)}
    </div>
  );
}

/**
 * A control that is off stays focusable and says why. A native disabled button is
 * skipped by the keyboard, so its reason would never be reached.
 */
function GuardedButton({
  id,
  label,
  control,
  onPress,
}: {
  id: string;
  label: string;
  control: ControlModel;
  onPress: () => void;
}) {
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

export function PlatformBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: PlatformScenario;
  model: PlatformModel;
}) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">{t("ste")}</p>
      <h2>{deskText(t, PLATFORM_TITLE)}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-platform">
        SYNTHETIC. {deskText(t, PLATFORM_SOURCE_LINE)}
      </p>
      <p>{deskText(t, PLATFORM_BOUNDARY)}</p>
      <AmountNotice />
      <p>{deskText(t, PLATFORM_TIER_NOTE)}</p>
      <p>{deskText(t, WORKSPACE_RULING)}</p>
      <p data-hold-record="not-bound">{deskText(t, PLATFORM_HOLD_NOTE)}</p>
      <p data-refund-record="not-bound">{deskText(t, PLATFORM_REFUND_NOTE)}</p>
      <p>{deskText(t, PLATFORM_ACTOR_NOTE)}</p>
      <p>{deskText(t, PLATFORM_FENCE_NOTE)}</p>
      <p>{deskText(t, PLATFORM_READ_NOTE)}</p>
      <p>{deskText(t, PLATFORM_SESSION_NOTE)}</p>
    </header>
  );
}

export function PlatformControls({
  scenario,
  heldSupported,
  lateSupported,
  actions,
}: {
  scenario: PlatformScenario;
  heldSupported: boolean;
  lateSupported: boolean;
  actions: PlatformActions;
}) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="platform-controls" className="discovery-section" aria-label={t("s1o9")}>
      <div className="discovery-controls">
        <label htmlFor="platform-scenario">
          {t("s1p5")}<select
            id="platform-scenario"
            value={scenario}
            onChange={(event) => actions.setScenario(event.target.value as PlatformScenario)}
          >
            {deskText(t, PLATFORM_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {deskText(t, item)}
              </option>
            )))}
          </select>
        </label>
        <button type="button" id="platform-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          {t("s1ax")}</button>
        <button type="button" id="platform-switch" className="discovery-action" onClick={() => actions.switchContext()}>
          {t("s1nz")}</button>
        <ConnectivityWriteButton type="button" id="platform-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          {t("s1m2")}</ConnectivityWriteButton>
        <button
          type="button"
          id="platform-deliver-held"
          className="discovery-action"
          aria-disabled={heldSupported ? undefined : true}
          aria-describedby="platform-deliver-note"
          onClick={heldSupported ? () => actions.deliverHeld() : undefined}
        >
          {t("sg2")}</button>
        <button
          type="button"
          id="platform-deliver-late"
          className="discovery-action"
          aria-disabled={lateSupported ? undefined : true}
          aria-describedby="platform-deliver-note"
          onClick={lateSupported ? () => actions.deliverLate() : undefined}
        >
          {t("sg4")}</button>
      </div>
      <p className="muted" data-scenario-note={scenario}>
        {deskText(t, SCENARIO_NOTES[scenario])} {t("sbx")}</p>
      <p className="muted" id="platform-deliver-note">
        {t("s1o0")}</p>
    </section>
  );
}

export function PlatformStatus({ model }: { model: PlatformModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="platform-status" className="discovery-section" tabIndex={-1} aria-live="polite" aria-busy={model.state === "loading"} data-platform-state={model.state}>
      <h3>{t("s1mj")}</h3>
      <p data-platform-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {deskText(t, model.statusLine)}
        {model.detailLine ? t("sgg", { detailLine: model.detailLine }) : ""}
      </p>
      <p className="muted" aria-live="off">{deskText(t, model.freshnessWord)}</p>
      {model.lastLine ? (
        <p id="platform-last" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word={t("s91")} /> : null} {deskText(t, model.lastLine)}
        </p>
      ) : null}
    </section>
  );
}

function ListingCard({ listing, actions }: { listing: ListingModel; actions: PlatformActions }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  const options = PLATFORM_TIERS.filter((tier) => tier !== listing.tier);
  const [tier, setTier] = useState<PlatformTier>(options[0] ?? PLATFORM_TIERS[0]);
  const selectId = `platform-tier-${listing.listingRef}`;
  return (
    <li
      className="discovery-row"
      data-listing={listing.listingRef}
      data-channel={listing.channel}
      data-status={listing.open ? "open" : "superseded"}
      data-provenance="synthetic"
      data-source="synthetic-platform"
    >
      <p>
        <span className="discovery-badge" data-provenance="synthetic">
          SYNTHETIC
        </span>{" "}
        <span className="discovery-badge">{deskText(t, listing.channelWord)}</span>
      </p>
      <h4>{listing.listingRef}</h4>
      <p>
        {deskText(t, listing.tier)} {t("s1pm")}{" "}{deskText(t, listing.termsRef)}
      </p>
      <p>{deskText(t, listing.statusLine)}</p>
      <GuardedButton
        id={`platform-book-${listing.listingRef}`}
        label={t("sag", { channelWord: listing.channelWord })}
        control={listing.book}
        onPress={() => actions.book(listing.listingRef)}
      />
      {listing.open ? (
        <div className="discovery-controls">
          <label htmlFor={selectId}>
            {t("sbw")}<select id={selectId} value={tier} onChange={(event) => setTier(event.target.value as PlatformTier)}>
              {deskText(t, options.map((item) => (
                <option key={item} value={item}>
                  {deskText(t, item)}
                </option>
              )))}
            </select>
          </label>
          <GuardedButton
            id={`platform-reprice-${listing.listingRef}`}
            label={t("s5r")}
            control={listing.reprice}
            onPress={() => actions.reprice(listing.listingRef, tier)}
          />
        </div>
      ) : null}
    </li>
  );
}

function RightCard({ right, actions }: { right: RightModel; actions: PlatformActions }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section
      className="discovery-row"
      data-right={right.rightRef}
      data-integrity={right.integrityFault ? "fault" : "ok"}
      data-provenance="synthetic"
      data-source="synthetic-platform"
    >
      <h3>{t("desk.booking.right")}{" "}{right.rightRef}</h3>
      <p>{deskText(t, right.holderLine)}</p>
      <p>{deskText(t, right.transfersLine)}</p>
      <ul className="discovery-list" aria-label={t("sr7", { rightRef: right.rightRef })}>
        {deskText(t, right.listings.map((listing) => (
          <ListingCard key={listing.listingRef} listing={listing} actions={actions} />
        )))}
      </ul>
    </section>
  );
}

export function RightsSection({ model, actions }: { model: PlatformModel; actions: PlatformActions }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="platform-rights" className="discovery-section" aria-label={t("s1hb")}>
      <h3>{t("s1hb")}</h3>
      {model.rights.length === 0 ? <p data-state="empty">{t("sxz")}</p> : null}
      {deskText(t, model.rights.map((right) => (
        <RightCard key={right.rightRef} right={right} actions={actions} />
      )))}
    </section>
  );
}

function TradeCard({ trade, actions }: { trade: TradeModel; actions: PlatformActions }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <ReadRow as="li" name="trade" value={trade.tradeRef}
      className="discovery-row"
      data-trade={trade.tradeRef}
      data-shape={trade.shape}
      data-linked={trade.linked ? "true" : "false"}
      data-stranded={trade.stranded ? "true" : "false"}
      data-provenance="synthetic"
      data-source="synthetic-platform"
    >
      <p>
        <span className="discovery-badge" data-provenance="synthetic">
          SYNTHETIC
        </span>{" "}
        <span className="discovery-badge">{deskText(t, trade.channelWord)}</span>
      </p>
      <h4>{t("s24e")}{" "}{deskText(t, trade.tradeRef)}</h4>
      <p>{deskText(t, trade.linkLine)}</p>
      <p data-shape-line={trade.shape}>{deskText(t, trade.shapeLine)}</p>
      <ScrollTable label={t("snp")}>
      <table className="platform-identities">
        <caption>{t("snn")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("sps")}</th>
            <th scope="col">{t("error.fact.reference")}</th>
          </tr>
        </thead>
        <tbody>
          {deskText(t, trade.identities.map((item) => (
            <tr key={item.kind} data-identity={item.kind}>
              <th scope="row">{deskText(t, item.kind)}</th>
              <td>{deskText(t, item.ref) ?? t("common.empty")}</td>
            </tr>
          )))}
        </tbody>
      </table>
      </ScrollTable>
      <ScrollTable label={t("slw")}>
      <table className="platform-facets">
        <caption>{t("slv")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("sqs")}</th>
            <th scope="col">{t("s236")}</th>
            <th scope="col">{t("sqe")}</th>
          </tr>
        </thead>
        <tbody>
          {deskText(t, trade.facets.map((facet) => (
            <tr key={facet.facet} data-facet={facet.facet} data-write={facet.writeKind} data-observed={facet.observedKind}>
              <th scope="row">{deskText(t, facet.label)}</th>
              <td>{deskText(t, facet.writeWord)}</td>
              <td>
                {deskText(t, facet.observedWord)} {deskText(t, facet.note)}
              </td>
            </tr>
          )))}
        </tbody>
      </table>
      </ScrollTable>
      {deskText(t, trade.rightLines.map((line) => (
        <p key={line}>{deskText(t, line)}</p>
      )))}
      <p data-refund-line={trade.stranded ? "undefined" : "none"}>{deskText(t, trade.refundLine)}</p>
      <GuardedButton
        id={`platform-transfer-${trade.tradeRef}`}
        label={t("s24l")}
        control={trade.transfer}
        onPress={() => actions.transfer(trade.tradeRef)}
      />
    </ReadRow>
  );
}

export function TradesSection({ model, actions }: { model: PlatformModel; actions: PlatformActions }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <RefusalScope reason={model.lastNeedsFocus ? "platform-last" : null}>
    <section id="platform-trades" className="discovery-section" aria-label={t("s24g")}>
      <h3>{t("s24g")}</h3>
      {model.trades.length === 0 ? <p data-state="empty">{t("s12b")}</p> : null}
      {model.trades.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s24h")}>
          {deskText(t, model.trades.map((trade) => (
            <TradeCard key={trade.tradeRef} trade={trade} actions={actions} />
          )))}
        </ul>
      ) : null}
    </section>
    </RefusalScope>
  );
}

export function SessionSection({ session }: { session: SessionModel }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="platform-session" className="discovery-section" aria-label={t("s1js")}>
      <h3>{t("s1js")}</h3>
      <p>{deskText(t, session.contextLine)}</p>
      <p data-counters="true">{deskText(t, session.countersLine)}</p>
      {session.intents.length === 0 ? (
        <p data-state="empty">{t("s137")}</p>
      ) : (
        <ScrollTable label={t("s272")}>
        <table className="platform-intents">
          <caption>{t("s272")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("soe")}</th>
              <th scope="col">{t("s270")}</th>
              <th scope="col">{t("s1pe")}</th>
              <th scope="col">{t("s16g")}</th>
              <th scope="col">{t("error.fact.code")}</th>
              <th scope="col">{t("sqg")}</th>
            </tr>
          </thead>
          <tbody>
            {deskText(t, session.intents.map((intent) => (
              <tr key={intent.intentRef} data-intent={intent.intentRef} data-outcome={intent.outcome}>
                <th scope="row">{deskText(t, intent.intentRef)}</th>
                <td>{deskText(t, intent.stepWord)}</td>
                <td>{deskText(t, intent.targetRef)}</td>
                <td>{deskText(t, intent.outcome)}</td>
                <td>{deskText(t, intent.code)}</td>
                <td>{deskText(t, intent.lateLine)}</td>
              </tr>
            )))}
          </tbody>
        </table>
        </ScrollTable>
      )}
      {deskText(t, session.unlinkedLines.map((line) => (
        <p key={line} data-unlinked="true">
          {deskText(t, line)}
        </p>
      )))}
      {deskText(t, session.quarantineLines.map((line) => (
        <p key={line} data-quarantined="true">
          {deskText(t, line)}
        </p>
      )))}
    </section>
  );
}

export function IdentitySection({ rows }: { rows: IdentityRowModel[] }) {
  const t = useT(deskCopy, copy0, copy1, copy2);
  return (
    <section id="platform-identity" className="discovery-section" aria-label={t("snr")}>
      <h3>{t("snr")}</h3>
      <p className="muted">
        {t("sth")}</p>
      <ScrollTable label={t("snr")}>
      <table className="platform-register">
        <caption>{t("s26l")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("snq")}</th>
            <th scope="col">{t("sl2")}</th>
            <th scope="col">{t("s1mj")}</th>
            <th scope="col">{t("s186")}</th>
            <th scope="col">{t("s10r")}</th>
          </tr>
        </thead>
        <tbody>
          {deskText(t, rows.map((row) => (
            <tr key={row.id} data-identity-row={row.id} data-status={row.status}>
              <th scope="row">{deskText(t, row.id)}</th>
              <td>{deskText(t, row.platformField)}</td>
              <td>{deskText(t, row.statusWord)}</td>
              <td>{deskText(t, row.bodyFields)}</td>
              <td>{deskText(t, row.reason)}</td>
            </tr>
          )))}
        </tbody>
      </table>
      </ScrollTable>
    </section>
  );
}
