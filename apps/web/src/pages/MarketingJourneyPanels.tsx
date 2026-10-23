import { messages as copy0 } from "../i18n/messages/pages--MarketingJourneyPanels";
import { messages as copy1 } from "../i18n/messages/marketing-journey";
import { messages as copy2 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { MARKETING_SCENARIOS, type MarketingScenario } from "@kix/protocol-adapter";
import { AmountNotice, StatusMark } from "../a11y/marks";
import {
  CONSENT_PAGE_ROUTE,
  CONTROL_LABELS,
  MARKETING_ACTOR_NOTE,
  MARKETING_ALT_SUBJECT_NOTE,
  MARKETING_BOUNDARY,
  MARKETING_CONSENT_NOTE,
  MARKETING_CRM_NOTE,
  MARKETING_FENCE_NOTE,
  MARKETING_HOLD_NOTE,
  MARKETING_JOURNEY_TITLE,
  MARKETING_NON_CLAIM_NOTE,
  MARKETING_NOT_BOUND_BANNER,
  MARKETING_SCENARIO_OFF_NOTE,
  MARKETING_POLICY_NOTE,
  MARKETING_READ_NOTE,
  MARKETING_SESSION_NOTE,
  MARKETING_SOURCE_LINE,
  SCENARIO_NOTES,
  type ApplicationModel,
  type BenefitModel,
  type ControlModel,
  type MarketingJourneyActions,
  type MarketingJourneyModel,
  type OrderModel,
  type RejectionModel,
  type SessionModel,
} from "../marketing-journey";
import { WORKSPACE_RULING } from "../workspace/registry";

/** A word, not only a color. */
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
    <div className="mkj-scroll" role="region" aria-label={deskText(t, label)} tabIndex={0}>
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

export function MarketingBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: MarketingScenario;
  model: MarketingJourneyModel;
}) {
  const t = useT(copy0, copy1, copy2);
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">{t("sks")}</p>
      <h2>{deskText(t, MARKETING_JOURNEY_TITLE)}</h2>
      {environment === "stub" ? (
        <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-marketing">
          SYNTHETIC. {deskText(t, MARKETING_SOURCE_LINE)}
        </p>
      ) : (
        <p className="discovery-banner" data-provenance="none" data-source="none">
          {deskText(t, MARKETING_NOT_BOUND_BANNER)}
        </p>
      )}
      <p>{deskText(t, MARKETING_BOUNDARY)}</p>
      <p data-non-claims="false">{deskText(t, MARKETING_NON_CLAIM_NOTE)}</p>
      <AmountNotice />
      <p>{deskText(t, WORKSPACE_RULING)}</p>
      <p data-hold-record="not-bound">{deskText(t, MARKETING_HOLD_NOTE)}</p>
      <p data-consent-record="read-only">{deskText(t, MARKETING_CONSENT_NOTE)}</p>
      <p data-crm-record="outside-this-journey">{deskText(t, MARKETING_CRM_NOTE)}</p>
      <p>{deskText(t, MARKETING_ACTOR_NOTE)}</p>
      <p>{deskText(t, MARKETING_FENCE_NOTE)}</p>
      <p>{deskText(t, MARKETING_READ_NOTE)}</p>
      <p data-policy-record="undetermined">{deskText(t, MARKETING_POLICY_NOTE)}</p>
      <p>{deskText(t, MARKETING_SESSION_NOTE)}</p>
    </header>
  );
}

export function MarketingControls({
  environment,
  scenario,
  heldSupported,
  subjectRef,
  actions,
}: {
  environment: "stub" | "integration-http";
  scenario: MarketingScenario;
  heldSupported: boolean;
  subjectRef: string;
  actions: MarketingJourneyActions;
}) {
  const t = useT(copy0, copy1, copy2);
  // The picker only chooses. Starting a session is its own button, so moving through the
  // list with the arrow keys resets nothing.
  const [picked, setPicked] = useState<MarketingScenario>(scenario);
  const simulated = environment === "stub";
  const simulateNote = simulated ? "mkj-simulate-note" : "mkj-scenario-off mkj-simulate-note";
  return (
    <section id="mkj-controls" className="discovery-section" aria-label={t("s1o9")}>
      <div className="discovery-controls">
        <label htmlFor="mkj-scenario">
          {t("s1p5")}<select id="mkj-scenario" value={picked} onChange={(event) => setPicked(event.target.value as MarketingScenario)}>
            {deskText(t, MARKETING_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {deskText(t, item)}
              </option>
            )))}
          </select>
        </label>
        <ConnectivityWriteButton
          type="button"
          id="mkj-apply-scenario"
          className="discovery-action"
          aria-disabled={simulated ? undefined : true}
          aria-describedby={simulated ? undefined : "mkj-scenario-off"}
          onClick={simulated ? () => actions.setScenario(picked) : undefined}
        >
          {t("s1m5")}</ConnectivityWriteButton>
        <button type="button" id="mkj-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          {t("s1ax")}</button>
        <button type="button" id="mkj-switch" className="discovery-action" onClick={() => actions.switchScope()}>
          {t("s1o2")}</button>
        <ConnectivityWriteButton type="button" id="mkj-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          {t("s1m2")}</ConnectivityWriteButton>
        <button
          type="button"
          id="mkj-deliver-held"
          className="discovery-action"
          aria-disabled={heldSupported ? undefined : true}
          aria-describedby="mkj-deliver-note"
          onClick={heldSupported ? () => actions.deliverHeld() : undefined}
        >
          {t("sg2")}</button>
      </div>
      {simulated ? (
        <p className="muted" data-scenario-note={scenario}>
          {deskText(t, SCENARIO_NOTES[scenario])} {t("sbx")}</p>
      ) : (
        <p className="muted" id="mkj-scenario-off" data-blocked-reason="true" data-scenario-note="off">
          <WordMark word={t("status.transport.blocked")} /> {deskText(t, MARKETING_SCENARIO_OFF_NOTE)}
        </p>
      )}
      <p className="muted" id="mkj-deliver-note" data-subject={subjectRef}>
        {t("s1n6")}{" "}{deskText(t, subjectRef)}. {deskText(t, MARKETING_ALT_SUBJECT_NOTE)} {t("s1m4")}</p>
      <div className="discovery-controls" role="group" aria-label={t("s1kn")}>
        {deskText(t, (Object.keys(CONTROL_LABELS) as (keyof typeof CONTROL_LABELS)[]).map((control) => (
          <ConnectivityWriteButton
            key={control}
            type="button"
            id={`mkj-simulate-${control}`}
            className="discovery-action"
            data-simulate={control}
            aria-disabled={simulated ? undefined : true}
            aria-describedby={simulateNote}
            onClick={simulated ? () => actions.simulate(control) : undefined}
          >
            {deskText(t, CONTROL_LABELS[control])}
          </ConnectivityWriteButton>
        )))}
      </div>
      <p className="muted" id="mkj-simulate-note">
        {t("s84")}</p>
    </section>
  );
}

export function MarketingStatus({ model }: { model: MarketingJourneyModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mkj-status" className="discovery-section" tabIndex={-1} data-marketing-state={model.state}>
      <h3>{t("s1mj")}</h3>
      <p role="status" data-marketing-status={model.state}>
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

export function LanesSection({ model }: { model: MarketingJourneyModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mkj-lanes" className="discovery-section" aria-label={t("s1sx")}>
      <h3>{t("sgq")}</h3>
      <p className="muted">{t("slz")}</p>
      <ol className="discovery-list" aria-label={t("spp")}>
        {deskText(t, model.lanes.map((lane) => (
          <li key={lane.lane} className="discovery-row" data-lane={lane.lane} data-count={lane.count === null ? "none" : String(lane.count)}>
            <h4>{deskText(t, lane.label)}</h4>
            <p>{deskText(t, lane.line)}</p>
          </li>
        )))}
      </ol>
    </section>
  );
}

export function ConsentSection({ model }: { model: MarketingJourneyModel }) {
  const t = useT(copy0, copy1, copy2);
  const consent = model.consent;
  return (
    <section id="mkj-consent" className="discovery-section" aria-label={t("sdq")}>
      <h3>{t("sdu")}</h3>
      {consent === null ? (
        <p data-state="empty">{t("suv")}</p>
      ) : (
        <div className="discovery-row" data-consent-state={consent.state} data-authorization={consent.authorization} data-source="synthetic-marketing">
          <p>
            <span className="discovery-badge" data-provenance="synthetic">
              SYNTHETIC
            </span>{" "}
            <span className="discovery-badge">{t("sdo")}{" "}{deskText(t, consent.stateWord)}</span>
          </p>
          <p>{deskText(t, consent.versionLine)}</p>
          <p>{deskText(t, consent.authorizationLine)}</p>
          <p>{deskText(t, consent.purposeLine)}</p>
          <p>{deskText(t, consent.membershipLine)}</p>
        </div>
      )}
      <p>
        <Link to={CONSENT_PAGE_ROUTE} id="mkj-consent-link">
          {t("s15b")}</Link>{" "}
        {t("s24b")}</p>
      <ul className="discovery-list" aria-label={t("sdt")}>
        {deskText(t, model.consentNotPosted.map((row) => (
          <li key={row.action} data-not-posted={row.action}>
            {deskText(t, row.action)}: {deskText(t, row.reason)}
          </li>
        )))}
      </ul>
      <ScrollTable label={t("sf3")}>
        <table className="mkj-crm">
          <caption>{t("s26i")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("s175")}</th>
              <th scope="col">{t("s1ii")}</th>
              <th scope="col">{t("s10r")}</th>
            </tr>
          </thead>
          <tbody>
            {deskText(t, model.crm.map((row) => (
              <tr key={row.id} data-crm-row={row.id} data-scope={row.scope} data-completes-crm="false">
                <th scope="row">{deskText(t, row.id)}</th>
                <td>{deskText(t, row.scopeWord)}</td>
                <td>{deskText(t, row.reason)}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </ScrollTable>
    </section>
  );
}

function BenefitCard({ benefit, actions }: { benefit: BenefitModel; actions: MarketingJourneyActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <li
      className="discovery-row"
      data-benefit={benefit.benefitRef}
      data-kind={benefit.kind}
      data-verdict={benefit.verdict}
      data-provenance="synthetic"
      data-source="synthetic-marketing"
    >
      <p>
        <span className="discovery-badge" data-provenance="synthetic">
          SYNTHETIC
        </span>{" "}
        <span className="discovery-badge">{deskText(t, benefit.kindWord)}</span>
      </p>
      <h4>
        {deskText(t, benefit.title)} ({deskText(t, benefit.benefitRef)})
      </h4>
      <p data-verdict-line={benefit.verdict}>
        {t("s1le")}{" "}{benefit.verdict}. {deskText(t, benefit.verdictLine)}
      </p>
      <p>{deskText(t, benefit.rankLine)}</p>
      <p>{deskText(t, benefit.consentLine)}</p>
      <p data-usage-line="source">{deskText(t, benefit.usageLine)}</p>
      {benefit.budgetLine ? <p data-budget-state={benefit.budgetState}>{deskText(t, benefit.budgetLine)}</p> : null}
      {benefit.attributionLine ? <p>{deskText(t, benefit.attributionLine)}</p> : null}
      <ul className="discovery-list" aria-label={t("s15y", { benefitRef: benefit.benefitRef })}>
        {deskText(t, benefit.orders.map((order) => (
          <li key={order.orderRef} data-benefit-order={`${benefit.benefitRef}:${order.orderRef}`} data-order-state={order.orderStateWord}>
            <p>
              {deskText(t, order.label)} ({deskText(t, order.orderRef)}), {deskText(t, order.orderStateWord)} {t("s92")}{order.applicationRef ? t("s5d", { applicationRef: order.applicationRef }) : ""}
            </p>
            <GuardedButton
              id={`mkj-apply-${benefit.benefitRef}-${order.orderRef}`}
              label={t("s5k", { benefitRef: benefit.benefitRef, orderRef: order.orderRef })}
              control={order.apply}
              onPress={() => actions.apply(benefit.benefitRef, order.orderRef)}
            />
          </li>
        )))}
      </ul>
    </li>
  );
}

export function BenefitsSection({ model, actions }: { model: MarketingJourneyModel; actions: MarketingJourneyActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mkj-benefits" className="discovery-section" aria-label={t("s9v")}>
      <h3>{t("s9w")}</h3>
      <p className="muted">
        {t("s2o")}</p>
      {model.benefits.length === 0 ? <p data-state="empty">{t("sub")}</p> : null}
      {model.benefits.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s9y")}>
          {deskText(t, model.benefits.map((benefit) => (
            <BenefitCard key={benefit.benefitRef} benefit={benefit} actions={actions} />
          )))}
        </ul>
      ) : null}
    </section>
  );
}

function OrderCard({ order, actions, simulated }: { order: OrderModel; actions: MarketingJourneyActions; simulated: boolean }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <li className="discovery-row" data-order={order.orderRef} data-state={order.state} data-source="synthetic-marketing">
      <h4>
        {deskText(t, order.label)} ({order.orderRef})
      </h4>
      <p>{deskText(t, order.stateLine)}</p>
      {simulated ? (
        <div className="discovery-controls">
          <GuardedButton
            id={`mkj-cancel-${order.orderRef}`}
            label={t("s1ks", { orderRef: order.orderRef })}
            control={order.cancel}
            onPress={() => actions.simulate("cancel-order", order.orderRef)}
          />
          <GuardedButton
            id={`mkj-refund-${order.orderRef}`}
            label={t("s1kg", { orderRef: order.orderRef })}
            control={order.refund}
            onPress={() => actions.simulate("refund-order", order.orderRef)}
          />
        </div>
      ) : null}
    </li>
  );
}

function ApplicationCard({ application, actions }: { application: ApplicationModel; actions: MarketingJourneyActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <li
      className="discovery-row"
      data-application={application.applicationRef}
      data-state={application.state}
      data-consent-withdrawn-since={application.consentWithdrawnSince ? "true" : "false"}
      data-provenance="synthetic"
      data-source="synthetic-marketing"
    >
      <h4>
        {t("s57")}{" "}{deskText(t, application.applicationRef)}: {deskText(t, application.benefitRef)} {t("s140")}{" "}{application.orderRef}
      </h4>
      <p>{deskText(t, application.stateLine)}</p>
      <p data-due-line={application.state}>{deskText(t, application.dueLine)}</p>
      <p>{deskText(t, application.channelLine)}</p>
      <p>{deskText(t, application.linkLine)}</p>
      <p>{deskText(t, application.consentLine)}</p>
      <p data-restoration="undetermined">{deskText(t, application.restorationLine)}</p>
      <GuardedButton
        id={`mkj-reclaim-${application.applicationRef}`}
        label={t("s1dk", { applicationRef: application.applicationRef })}
        control={application.reclaim}
        onPress={() => actions.reclaim(application.applicationRef)}
      />
    </li>
  );
}

export function OrdersSection({
  model,
  environment,
  actions,
}: {
  model: MarketingJourneyModel;
  environment: "stub" | "integration-http";
  actions: MarketingJourneyActions;
}) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mkj-orders" className="discovery-section" aria-label={t("s15v")}>
      <h3>{t("s15w")}</h3>
      <p className="muted">
        {t("s4h")}{" "}{deskText(t, MARKETING_POLICY_NOTE)}
      </p>
      {model.orders.length === 0 ? <p data-state="empty">{t("swl")}</p> : null}
      {model.orders.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s15z")}>
          {deskText(t, model.orders.map((order) => (
            <OrderCard key={order.orderRef} order={order} actions={actions} simulated={environment === "stub"} />
          )))}
        </ul>
      ) : null}
      <h4>{t("s59")}</h4>
      {model.applications.length === 0 ? <p data-state="empty">{t("su3")}</p> : null}
      {model.applications.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s5a")}>
          {deskText(t, model.applications.map((application) => (
            <ApplicationCard key={application.applicationRef} application={application} actions={actions} />
          )))}
        </ul>
      ) : null}
    </section>
  );
}

function RejectionCard({ row, actions }: { row: RejectionModel; actions: MarketingJourneyActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <li className="discovery-row" data-rejection={row.intentRef} data-code={row.code} data-return-action={row.returnAction}>
      <h4>
        {deskText(t, row.stepWord)} {t("s1ex")}{deskText(t, row.code)})
      </h4>
      <p>{deskText(t, row.target)}</p>
      <p>{deskText(t, row.detail)}</p>
      <p>{deskText(t, row.returnLine)}</p>
      {row.returnAction === "read-again" ? (
        <button type="button" id={`mkj-return-${row.intentRef}`} className="discovery-action" onClick={() => actions.refresh()}>
          {t("s1ax")}</button>
      ) : null}
      {row.returnAction === "manage-consent" ? (
        <Link to={CONSENT_PAGE_ROUTE} id={`mkj-return-${row.intentRef}`}>
          {t("s15b")}</Link>
      ) : null}
    </li>
  );
}

export function RejectionsSection({ model, actions }: { model: MarketingJourneyModel; actions: MarketingJourneyActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mkj-rejections" className="discovery-section" aria-label={t("s1f0")}>
      <h3>{t("s1ez")}</h3>
      {model.rejections.length === 0 ? (
        <p data-state="empty">{t("s1zl")}</p>
      ) : (
        <ul className="discovery-list" aria-label={t("s1f1")}>
          {deskText(t, model.rejections.map((row) => (
            <RejectionCard key={row.intentRef} row={row} actions={actions} />
          )))}
        </ul>
      )}
    </section>
  );
}

export function SessionSection({ session }: { session: SessionModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mkj-session" className="discovery-section" aria-label={t("s1js")}>
      <h3>{t("s1js")}</h3>
      <p>{deskText(t, session.contextLine)}</p>
      <p data-counters="true">{deskText(t, session.countersLine)}</p>
      {session.intents.length === 0 ? (
        <p data-state="empty">{t("s137")}</p>
      ) : (
        <ScrollTable label={t("s272")}>
          <table className="mkj-intents">
            <caption>{t("s272")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("soe")}</th>
                <th scope="col">{t("s270")}</th>
                <th scope="col">{t("s1pe")}</th>
                <th scope="col">{t("s16g")}</th>
                <th scope="col">{t("error.fact.code")}</th>
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

export function RegisterSection({ model }: { model: MarketingJourneyModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="mkj-register" className="discovery-section" aria-label={t("sec")}>
      <h3>{t("sec")}</h3>
      <p className="muted">
        {t("sti")}</p>
      <ScrollTable label={t("sec")}>
        <table className="mkj-register">
          <caption>{t("s26k")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("sdf")}</th>
              <th scope="col">{t("sl2")}</th>
              <th scope="col">{t("s1mj")}</th>
              <th scope="col">{t("s186")}</th>
              <th scope="col">{t("s10r")}</th>
            </tr>
          </thead>
          <tbody>
            {deskText(t, model.register.map((row) => (
              <tr key={row.id} data-register-row={row.id} data-status={row.status}>
                <th scope="row">{deskText(t, row.id)}</th>
                <td>{deskText(t, row.field)}</td>
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
