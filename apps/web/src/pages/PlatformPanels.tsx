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
  return (
    <span className="status-mark" data-status-mark="blocked">
      <span className="status-word">{word}</span>
    </span>
  );
}

/** A wide table scrolls inside its own region, so the page does not scroll sideways. */
function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="platform-scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
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

export function PlatformBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: PlatformScenario;
  model: PlatformModel;
}) {
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">Multi-channel trade</p>
      <h2>{PLATFORM_TITLE}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-platform">
        SYNTHETIC. {PLATFORM_SOURCE_LINE}
      </p>
      <p>{PLATFORM_BOUNDARY}</p>
      <AmountNotice />
      <p>{PLATFORM_TIER_NOTE}</p>
      <p>{WORKSPACE_RULING}</p>
      <p data-hold-record="not-bound">{PLATFORM_HOLD_NOTE}</p>
      <p data-refund-record="not-bound">{PLATFORM_REFUND_NOTE}</p>
      <p>{PLATFORM_ACTOR_NOTE}</p>
      <p>{PLATFORM_FENCE_NOTE}</p>
      <p>{PLATFORM_READ_NOTE}</p>
      <p>{PLATFORM_SESSION_NOTE}</p>
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
  return (
    <section id="platform-controls" className="discovery-section" aria-label="Synthetic controls">
      <div className="discovery-controls">
        <label htmlFor="platform-scenario">
          Synthetic scenario
          <select
            id="platform-scenario"
            value={scenario}
            onChange={(event) => actions.setScenario(event.target.value as PlatformScenario)}
          >
            {PLATFORM_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button type="button" id="platform-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          Read again
        </button>
        <button type="button" id="platform-switch" className="discovery-action" onClick={() => actions.switchContext()}>
          Switch session context
        </button>
        <button type="button" id="platform-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          Start a new synthetic session
        </button>
        <button
          type="button"
          id="platform-deliver-held"
          className="discovery-action"
          aria-disabled={heldSupported ? undefined : true}
          aria-describedby="platform-deliver-note"
          onClick={heldSupported ? () => actions.deliverHeld() : undefined}
        >
          Deliver held response
        </button>
        <button
          type="button"
          id="platform-deliver-late"
          className="discovery-action"
          aria-disabled={lateSupported ? undefined : true}
          aria-describedby="platform-deliver-note"
          onClick={lateSupported ? () => actions.deliverLate() : undefined}
        >
          Deliver late result
        </button>
      </div>
      <p className="muted" data-scenario-note={scenario}>
        {SCENARIO_NOTES[scenario]} Changing the scenario starts a new synthetic session.
      </p>
      <p className="muted" id="platform-deliver-note">
        Switch session context moves to another actor string and a new session number. Start a new synthetic session clears every intent, as a
        reload does, and resolves nothing at a producer. The two deliver controls work only in the scenarios named for them.
      </p>
    </section>
  );
}

export function PlatformStatus({ model }: { model: PlatformModel }) {
  return (
    <section id="platform-status" className="discovery-section" tabIndex={-1} data-platform-state={model.state}>
      <h3>Status</h3>
      <p role="status" data-platform-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {model.statusLine}
        {model.detailLine ? ` ${model.detailLine}` : ""}
      </p>
      <p className="muted">{model.freshnessWord}</p>
      {model.lastLine ? (
        <p role="status" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word="Attention." /> : null} {model.lastLine}
        </p>
      ) : null}
    </section>
  );
}

function ListingCard({ listing, actions }: { listing: ListingModel; actions: PlatformActions }) {
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
        <span className="discovery-badge">{listing.channelWord}</span>
      </p>
      <h4>{listing.listingRef}</h4>
      <p>
        {listing.tier} · terms {listing.termsRef}
      </p>
      <p>{listing.statusLine}</p>
      <GuardedButton
        id={`platform-book-${listing.listingRef}`}
        label={`Book on ${listing.channelWord}`}
        control={listing.book}
        onPress={() => actions.book(listing.listingRef)}
      />
      {listing.open ? (
        <div className="discovery-controls">
          <label htmlFor={selectId}>
            Change tier
            <select id={selectId} value={tier} onChange={(event) => setTier(event.target.value as PlatformTier)}>
              {options.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <GuardedButton
            id={`platform-reprice-${listing.listingRef}`}
            label="Apply tier"
            control={listing.reprice}
            onPress={() => actions.reprice(listing.listingRef, tier)}
          />
        </div>
      ) : null}
    </li>
  );
}

function RightCard({ right, actions }: { right: RightModel; actions: PlatformActions }) {
  return (
    <section
      className="discovery-row"
      data-right={right.rightRef}
      data-integrity={right.integrityFault ? "fault" : "ok"}
      data-provenance="synthetic"
      data-source="synthetic-platform"
    >
      <h3>Right {right.rightRef}</h3>
      <p>{right.holderLine}</p>
      <p>{right.transfersLine}</p>
      <ul className="discovery-list" aria-label={`Listings of ${right.rightRef}`}>
        {right.listings.map((listing) => (
          <ListingCard key={listing.listingRef} listing={listing} actions={actions} />
        ))}
      </ul>
    </section>
  );
}

export function RightsSection({ model, actions }: { model: PlatformModel; actions: PlatformActions }) {
  return (
    <section id="platform-rights" className="discovery-section" aria-label="Rights and listings">
      <h3>Rights and listings</h3>
      {model.rights.length === 0 ? <p data-state="empty">No right is listed in this read.</p> : null}
      {model.rights.map((right) => (
        <RightCard key={right.rightRef} right={right} actions={actions} />
      ))}
    </section>
  );
}

function TradeCard({ trade, actions }: { trade: TradeModel; actions: PlatformActions }) {
  return (
    <li
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
        <span className="discovery-badge">{trade.channelWord}</span>
      </p>
      <h4>Trade {trade.tradeRef}</h4>
      <p>{trade.linkLine}</p>
      <p data-shape-line={trade.shape}>{trade.shapeLine}</p>
      <ScrollTable label="Identities of this trade">
      <table className="platform-identities">
        <caption>Identities, each its own kind</caption>
        <thead>
          <tr>
            <th scope="col">Kind</th>
            <th scope="col">Reference</th>
          </tr>
        </thead>
        <tbody>
          {trade.identities.map((item) => (
            <tr key={item.kind} data-identity={item.kind}>
              <th scope="row">{item.kind}</th>
              <td>{item.ref ?? "none"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </ScrollTable>
      <ScrollTable label="Four independent lines of this trade">
      <table className="platform-facets">
        <caption>Four independent lines</caption>
        <thead>
          <tr>
            <th scope="col">Line</th>
            <th scope="col">This page&apos;s write</th>
            <th scope="col">Last read</th>
          </tr>
        </thead>
        <tbody>
          {trade.facets.map((facet) => (
            <tr key={facet.facet} data-facet={facet.facet} data-write={facet.writeKind} data-observed={facet.observedKind}>
              <th scope="row">{facet.label}</th>
              <td>{facet.writeWord}</td>
              <td>
                {facet.observedWord} {facet.note}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </ScrollTable>
      {trade.rightLines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <p data-refund-line={trade.stranded ? "undefined" : "none"}>{trade.refundLine}</p>
      <GuardedButton
        id={`platform-transfer-${trade.tradeRef}`}
        label="Transfer the right"
        control={trade.transfer}
        onPress={() => actions.transfer(trade.tradeRef)}
      />
    </li>
  );
}

export function TradesSection({ model, actions }: { model: PlatformModel; actions: PlatformActions }) {
  return (
    <section id="platform-trades" className="discovery-section" aria-label="Trades">
      <h3>Trades</h3>
      {model.trades.length === 0 ? <p data-state="empty">No trade yet. Book a listing to start one.</p> : null}
      {model.trades.length > 0 ? (
        <ul className="discovery-list" aria-label="Trades in the last read">
          {model.trades.map((trade) => (
            <TradeCard key={trade.tradeRef} trade={trade} actions={actions} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function SessionSection({ session }: { session: SessionModel }) {
  return (
    <section id="platform-session" className="discovery-section" aria-label="Session record">
      <h3>Session record</h3>
      <p>{session.contextLine}</p>
      <p data-counters="true">{session.countersLine}</p>
      {session.intents.length === 0 ? (
        <p data-state="empty">No write has been sent in this session.</p>
      ) : (
        <ScrollTable label="Writes in this session">
        <table className="platform-intents">
          <caption>Writes in this session</caption>
          <thead>
            <tr>
              <th scope="col">Intent</th>
              <th scope="col">Write</th>
              <th scope="col">Target</th>
              <th scope="col">Outcome</th>
              <th scope="col">Code</th>
              <th scope="col">Late</th>
            </tr>
          </thead>
          <tbody>
            {session.intents.map((intent) => (
              <tr key={intent.intentRef} data-intent={intent.intentRef} data-outcome={intent.outcome}>
                <th scope="row">{intent.intentRef}</th>
                <td>{intent.stepWord}</td>
                <td>{intent.targetRef}</td>
                <td>{intent.outcome}</td>
                <td>{intent.code}</td>
                <td>{intent.lateLine}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </ScrollTable>
      )}
      {session.unlinkedLines.map((line) => (
        <p key={line} data-unlinked="true">
          {line}
        </p>
      ))}
      {session.quarantineLines.map((line) => (
        <p key={line} data-quarantined="true">
          {line}
        </p>
      ))}
    </section>
  );
}

export function IdentitySection({ rows }: { rows: IdentityRowModel[] }) {
  return (
    <section id="platform-identity" className="discovery-section" aria-label="Identity links">
      <h3>Identity links</h3>
      <p className="muted">
        Naming a field in the pin is not binding it. The values on this page are synthetic references, and no body is built from them.
      </p>
      <ScrollTable label="Identity links">
      <table className="platform-register">
        <caption>Which identity has a named field in the pinned catalogue</caption>
        <thead>
          <tr>
            <th scope="col">Identity</th>
            <th scope="col">Field here</th>
            <th scope="col">Status</th>
            <th scope="col">Pinned fields</th>
            <th scope="col">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-identity-row={row.id} data-status={row.status}>
              <th scope="row">{row.id}</th>
              <td>{row.platformField}</td>
              <td>{row.statusWord}</td>
              <td>{row.bodyFields}</td>
              <td>{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </ScrollTable>
    </section>
  );
}
