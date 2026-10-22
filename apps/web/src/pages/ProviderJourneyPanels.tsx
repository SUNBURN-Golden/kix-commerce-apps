import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import type { ReactNode } from "react";
import { PROVIDER_SCENARIOS, type ProviderScenario } from "@kix/protocol-adapter";
import { AmountNotice, StatusMark } from "../a11y/marks";
import {
  PROVIDER_ACTOR_NOTE,
  PROVIDER_AMOUNT_NOTE,
  PROVIDER_BOUNDARY,
  PROVIDER_ENVIRONMENT_NOTE,
  PROVIDER_FENCE_NOTE,
  PROVIDER_HOLD_NOTE,
  PROVIDER_ISSUANCE_NOTE,
  PROVIDER_READ_NOTE,
  PROVIDER_RETURN_NOTE,
  PROVIDER_SESSION_NOTE,
  PROVIDER_SOURCE_LINE,
  PROVIDER_TITLE,
  SCENARIO_NOTES,
  type ControlModel,
  type IdentityRowModel,
  type OrderModel,
  type ProviderActions,
  type ProviderModel,
  type SessionModel,
} from "../provider-journey";
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
      <ConnectivityWriteButton
        type="button"
        id={id}
        className="discovery-action"
        aria-disabled={control.enabled ? undefined : true}
        aria-describedby={control.reason ? reasonId : undefined}
        data-enabled={control.enabled ? "true" : "false"}
        onClick={control.enabled ? onPress : undefined}
      >
        {label}
      </ConnectivityWriteButton>
      {control.reason ? (
        <p id={reasonId} className="muted" data-blocked-reason="true">
          <WordMark word="Blocked." /> {control.reason}
        </p>
      ) : null}
    </>
  );
}

export function ProviderBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: ProviderScenario;
  model: ProviderModel;
}) {
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">Provider checkout</p>
      <h2>{PROVIDER_TITLE}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-provider">
        SYNTHETIC. {PROVIDER_SOURCE_LINE}
      </p>
      <p data-environment-line="true">{model.environmentLine}</p>
      <p>{PROVIDER_BOUNDARY}</p>
      <p data-return-note="true">{PROVIDER_RETURN_NOTE}</p>
      <p>{PROVIDER_ENVIRONMENT_NOTE}</p>
      <p>{PROVIDER_ISSUANCE_NOTE}</p>
      <AmountNotice />
      <p>{PROVIDER_AMOUNT_NOTE}</p>
      <p>{WORKSPACE_RULING}</p>
      <p data-hold-record="not-bound">{PROVIDER_HOLD_NOTE}</p>
      <p>{PROVIDER_ACTOR_NOTE}</p>
      <p>{PROVIDER_FENCE_NOTE}</p>
      <p>{PROVIDER_READ_NOTE}</p>
      <p>{PROVIDER_SESSION_NOTE}</p>
    </header>
  );
}

export function ProviderControls({
  scenario,
  heldSupported,
  lateSupported,
  actions,
}: {
  scenario: ProviderScenario;
  heldSupported: boolean;
  lateSupported: boolean;
  actions: ProviderActions;
}) {
  return (
    <section id="provider-controls" className="discovery-section" aria-label="Synthetic controls">
      <div className="discovery-controls">
        <label htmlFor="provider-scenario">
          Synthetic scenario
          <select
            id="provider-scenario"
            value={scenario}
            onChange={(event) => actions.setScenario(event.target.value as ProviderScenario)}
          >
            {PROVIDER_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button type="button" id="provider-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          Read again
        </button>
        <button type="button" id="provider-switch" className="discovery-action" onClick={() => actions.switchContext()}>
          Switch session context
        </button>
        <ConnectivityWriteButton type="button" id="provider-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          Start a new synthetic session
        </ConnectivityWriteButton>
        <button
          type="button"
          id="provider-deliver-held"
          className="discovery-action"
          aria-disabled={heldSupported ? undefined : true}
          aria-describedby="provider-deliver-note"
          onClick={heldSupported ? () => actions.deliverHeld() : undefined}
        >
          Deliver held response
        </button>
        <button
          type="button"
          id="provider-deliver-late"
          className="discovery-action"
          aria-disabled={lateSupported ? undefined : true}
          aria-describedby="provider-deliver-note"
          onClick={lateSupported ? () => actions.deliverLate() : undefined}
        >
          Deliver late result
        </button>
      </div>
      <p className="muted" data-scenario-note={scenario}>
        {SCENARIO_NOTES[scenario]} Changing the scenario starts a new synthetic session.
      </p>
      <p className="muted" id="provider-deliver-note">
        Switch session context moves to another actor string and a new session number. Start a new synthetic session clears every intent, as a
        reload does, and resolves nothing at a provider. The two deliver controls work only in the scenarios named for them.
      </p>
    </section>
  );
}

export function ProviderStatus({ model }: { model: ProviderModel }) {
  return (
    <section id="provider-status" className="discovery-section" tabIndex={-1} data-provider-state={model.state}>
      <h3>Status</h3>
      <p role="status" data-provider-status={model.state}>
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

function OrderCard({ order, actions }: { order: OrderModel; actions: ProviderActions }) {
  const checkoutRef = order.identities.find((identity) => identity.kind === "checkout")?.ref ?? null;
  return (
    <li
      className="discovery-row"
      data-order={order.orderRef}
      data-shape={order.shape}
      data-linked={order.linked ? "true" : "false"}
      data-provenance="synthetic"
      data-source="synthetic-provider"
    >
      <p>
        <span className="discovery-badge" data-provenance="synthetic">
          SYNTHETIC
        </span>{" "}
        <span className="discovery-badge">sandbox only</span>
      </p>
      <h4>Order {order.orderRef}</h4>
      <p>{order.linkLine}</p>
      <p>{order.amountWord}</p>
      <p>{order.versionLine}</p>
      <p data-shape-line={order.shape}>{order.shapeLine}</p>
      <ScrollTable label="Identities of this order">
        <table className="platform-identities">
          <caption>Identities, each its own kind</caption>
          <thead>
            <tr>
              <th scope="col">Kind</th>
              <th scope="col">Reference</th>
            </tr>
          </thead>
          <tbody>
            {order.identities.map((item) => (
              <tr key={item.kind} data-identity={item.kind}>
                <th scope="row">{item.kind}</th>
                <td>{item.ref ?? "none"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
      <ScrollTable label="Five independent lines of this order">
        <table className="platform-facets">
          <caption>Five independent lines</caption>
          <thead>
            <tr>
              <th scope="col">Line</th>
              <th scope="col">This page&apos;s write</th>
              <th scope="col">Last read</th>
            </tr>
          </thead>
          <tbody>
            {order.facets.map((facet) => (
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
      <GuardedButton
        id={`provider-begin-${order.orderRef}`}
        label="Begin checkout"
        control={order.begin}
        onPress={() => actions.begin(order.orderRef)}
      />
      {order.events.length > 0 ? (
        <div className="discovery-controls" data-source-events="true">
          {order.events.map((item) => (
            <ConnectivityWriteButton
              key={item.id}
              type="button"
              id={`provider-event-${item.id}-${order.orderRef}`}
              className="discovery-action"
              data-source-event={item.id}
              title={item.line}
              onClick={() =>
                checkoutRef === null
                  ? undefined
                  : item.id === "return"
                    ? actions.landReturn(checkoutRef)
                    : item.id === "callback"
                      ? actions.deliverReport(checkoutRef)
                      : actions.abandon(checkoutRef)
              }
            >
              {item.label}
            </ConnectivityWriteButton>
          ))}
          <p className="muted">Source events, not writes. A return landing is never a payment observation.</p>
        </div>
      ) : null}
      <GuardedButton
        id={`provider-observe-${order.orderRef}`}
        label="Record the payment observation"
        control={order.observe}
        onPress={() => (checkoutRef === null ? undefined : actions.observe(checkoutRef))}
      />
      <GuardedButton
        id={`provider-issue-${order.orderRef}`}
        label="Record the issuance"
        control={order.issue}
        onPress={() => (checkoutRef === null ? undefined : actions.issue(checkoutRef))}
      />
      <GuardedButton
        id={`provider-refund-${order.orderRef}`}
        label="Record the refund"
        control={order.refund}
        onPress={() => actions.refund(order.orderRef)}
      />
    </li>
  );
}

export function OrdersSection({ model, actions }: { model: ProviderModel; actions: ProviderActions }) {
  return (
    <section id="provider-orders" className="discovery-section" aria-label="Orders">
      <h3>Orders</h3>
      {model.orders.length === 0 ? <p data-state="empty">No order in this read. Begin a checkout to open one.</p> : null}
      {model.orders.length > 0 ? (
        <ul className="discovery-list" aria-label="Orders in the last read">
          {model.orders.map((order) => (
            <OrderCard key={order.orderRef} order={order} actions={actions} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function SessionSection({ session }: { session: SessionModel }) {
  return (
    <section id="provider-session" className="discovery-section" aria-label="Session record">
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
    <section id="provider-identity" className="discovery-section" aria-label="Identity links">
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
                <td>{row.providerField}</td>
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
