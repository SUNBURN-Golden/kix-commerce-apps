import { messages as copy0 } from "../i18n/messages/pages--ProviderJourneyPanels";
import { messages as copy1 } from "../i18n/messages/provider-journey";
import { messages as copy2 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
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
  const t = useT(copy0, copy1, copy2);
  return (
    <span className="status-mark" data-status-mark="blocked">
      <span className="status-word">{deskText(t, word)}</span>
    </span>
  );
}

/** A wide table scrolls inside its own region, so the page does not scroll sideways. */
function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  const t = useT(copy0, copy1, copy2);
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
  const t = useT(copy0, copy1, copy2);
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

export function ProviderBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: ProviderScenario;
  model: ProviderModel;
}) {
  const t = useT(copy0, copy1, copy2);
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">{t("s1a4")}</p>
      <h2>{deskText(t, PROVIDER_TITLE)}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-provider">
        SYNTHETIC. {deskText(t, PROVIDER_SOURCE_LINE)}
      </p>
      <p data-environment-line="true">{deskText(t, model.environmentLine)}</p>
      <p>{deskText(t, PROVIDER_BOUNDARY)}</p>
      <p data-return-note="true">{deskText(t, PROVIDER_RETURN_NOTE)}</p>
      <p>{deskText(t, PROVIDER_ENVIRONMENT_NOTE)}</p>
      <p>{deskText(t, PROVIDER_ISSUANCE_NOTE)}</p>
      <AmountNotice />
      <p>{deskText(t, PROVIDER_AMOUNT_NOTE)}</p>
      <p>{deskText(t, WORKSPACE_RULING)}</p>
      <p data-hold-record="not-bound">{deskText(t, PROVIDER_HOLD_NOTE)}</p>
      <p>{deskText(t, PROVIDER_ACTOR_NOTE)}</p>
      <p>{deskText(t, PROVIDER_FENCE_NOTE)}</p>
      <p>{deskText(t, PROVIDER_READ_NOTE)}</p>
      <p>{deskText(t, PROVIDER_SESSION_NOTE)}</p>
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
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="provider-controls" className="discovery-section" aria-label={t("s1o9")}>
      <div className="discovery-controls">
        <label htmlFor="provider-scenario">
          {t("s1p5")}<select
            id="provider-scenario"
            value={scenario}
            onChange={(event) => actions.setScenario(event.target.value as ProviderScenario)}
          >
            {deskText(t, PROVIDER_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {deskText(t, item)}
              </option>
            )))}
          </select>
        </label>
        <button type="button" id="provider-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          {t("s1ax")}</button>
        <button type="button" id="provider-switch" className="discovery-action" onClick={() => actions.switchContext()}>
          {t("s1nz")}</button>
        <ConnectivityWriteButton type="button" id="provider-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          {t("s1m2")}</ConnectivityWriteButton>
        <button
          type="button"
          id="provider-deliver-held"
          className="discovery-action"
          aria-disabled={heldSupported ? undefined : true}
          aria-describedby="provider-deliver-note"
          onClick={heldSupported ? () => actions.deliverHeld() : undefined}
        >
          {t("sg2")}</button>
        <button
          type="button"
          id="provider-deliver-late"
          className="discovery-action"
          aria-disabled={lateSupported ? undefined : true}
          aria-describedby="provider-deliver-note"
          onClick={lateSupported ? () => actions.deliverLate() : undefined}
        >
          {t("sg4")}</button>
      </div>
      <p className="muted" data-scenario-note={scenario}>
        {deskText(t, SCENARIO_NOTES[scenario])} {t("sbx")}</p>
      <p className="muted" id="provider-deliver-note">
        {t("s1o1")}</p>
    </section>
  );
}

export function ProviderStatus({ model }: { model: ProviderModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="provider-status" className="discovery-section" tabIndex={-1} data-provider-state={model.state}>
      <h3>{t("s1mj")}</h3>
      <p role="status" data-provider-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {deskText(t, model.statusLine)}
        {model.detailLine ? t("sgg", { detailLine: model.detailLine }) : ""}
      </p>
      <p className="muted">{deskText(t, model.freshnessWord)}</p>
      {model.lastLine ? (
        <p role="status" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word={t("s91")} /> : null} {deskText(t, model.lastLine)}
        </p>
      ) : null}
    </section>
  );
}

function OrderCard({ order, actions }: { order: OrderModel; actions: ProviderActions }) {
  const t = useT(copy0, copy1, copy2);
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
        <span className="discovery-badge">{t("s1i5")}</span>
      </p>
      <h4>{t("s15s")}{" "}{order.orderRef}</h4>
      <p>{deskText(t, order.linkLine)}</p>
      <p>{deskText(t, order.amountWord)}</p>
      <p>{deskText(t, order.versionLine)}</p>
      <p data-shape-line={order.shape}>{deskText(t, order.shapeLine)}</p>
      <ScrollTable label={t("sno")}>
        <table className="platform-identities">
          <caption>{t("snn")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("sps")}</th>
              <th scope="col">{t("error.fact.reference")}</th>
            </tr>
          </thead>
          <tbody>
            {deskText(t, order.identities.map((item) => (
              <tr key={item.kind} data-identity={item.kind}>
                <th scope="row">{deskText(t, item.kind)}</th>
                <td>{deskText(t, item.ref) ?? t("common.empty")}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </ScrollTable>
      <ScrollTable label={t("slh")}>
        <table className="platform-facets">
          <caption>{t("slg")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("sqs")}</th>
              <th scope="col">{t("s236")}</th>
              <th scope="col">{t("sqe")}</th>
            </tr>
          </thead>
          <tbody>
            {deskText(t, order.facets.map((facet) => (
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
      <GuardedButton
        id={`provider-begin-${order.orderRef}`}
        label={t("s9r")}
        control={order.begin}
        onPress={() => actions.begin(order.orderRef)}
      />
      {order.events.length > 0 ? (
        <div className="discovery-controls" data-source-events="true">
          {deskText(t, order.events.map((item) => (
            <ConnectivityWriteButton
              key={item.id}
              type="button"
              id={`provider-event-${item.id}-${order.orderRef}`}
              className="discovery-action"
              data-source-event={item.id}
              title={deskText(t, item.line)}
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
              {deskText(t, item.label)}
            </ConnectivityWriteButton>
          )))}
          <p className="muted">{t("s1l9")}</p>
        </div>
      ) : null}
      <GuardedButton
        id={`provider-observe-${order.orderRef}`}
        label={t("s1e7")}
        control={order.observe}
        onPress={() => (checkoutRef === null ? undefined : actions.observe(checkoutRef))}
      />
      <GuardedButton
        id={`provider-issue-${order.orderRef}`}
        label={t("s1e6")}
        control={order.issue}
        onPress={() => (checkoutRef === null ? undefined : actions.issue(checkoutRef))}
      />
      <GuardedButton
        id={`provider-refund-${order.orderRef}`}
        label={t("s1e8")}
        control={order.refund}
        onPress={() => actions.refund(order.orderRef)}
      />
    </li>
  );
}

export function OrdersSection({ model, actions }: { model: ProviderModel; actions: ProviderActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="provider-orders" className="discovery-section" aria-label={t("s15u")}>
      <h3>{t("s15u")}</h3>
      {model.orders.length === 0 ? <p data-state="empty">{t("swk")}</p> : null}
      {model.orders.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s15z")}>
          {deskText(t, model.orders.map((order) => (
            <OrderCard key={order.orderRef} order={order} actions={actions} />
          )))}
        </ul>
      ) : null}
    </section>
  );
}

export function SessionSection({ session }: { session: SessionModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="provider-session" className="discovery-section" aria-label={t("s1js")}>
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
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="provider-identity" className="discovery-section" aria-label={t("snr")}>
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
                <td>{deskText(t, row.providerField)}</td>
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
