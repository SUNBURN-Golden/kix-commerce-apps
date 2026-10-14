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
  return (
    <span className="status-mark" data-status-mark="blocked">
      <span className="status-word">{word}</span>
    </span>
  );
}

/** A wide table scrolls inside its own region, so the page does not scroll sideways. */
function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mkj-scroll" role="region" aria-label={label} tabIndex={0}>
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

export function MarketingBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: MarketingScenario;
  model: MarketingJourneyModel;
}) {
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">Fan benefits in the buying flow</p>
      <h2>{MARKETING_JOURNEY_TITLE}</h2>
      {environment === "stub" ? (
        <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-marketing">
          SYNTHETIC. {MARKETING_SOURCE_LINE}
        </p>
      ) : (
        <p className="discovery-banner" data-provenance="none" data-source="none">
          {MARKETING_NOT_BOUND_BANNER}
        </p>
      )}
      <p>{MARKETING_BOUNDARY}</p>
      <p data-non-claims="false">{MARKETING_NON_CLAIM_NOTE}</p>
      <AmountNotice />
      <p>{WORKSPACE_RULING}</p>
      <p data-hold-record="not-bound">{MARKETING_HOLD_NOTE}</p>
      <p data-consent-record="read-only">{MARKETING_CONSENT_NOTE}</p>
      <p data-crm-record="outside-this-journey">{MARKETING_CRM_NOTE}</p>
      <p>{MARKETING_ACTOR_NOTE}</p>
      <p>{MARKETING_FENCE_NOTE}</p>
      <p>{MARKETING_READ_NOTE}</p>
      <p data-policy-record="undetermined">{MARKETING_POLICY_NOTE}</p>
      <p>{MARKETING_SESSION_NOTE}</p>
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
  // The picker only chooses. Starting a session is its own button, so moving through the
  // list with the arrow keys resets nothing.
  const [picked, setPicked] = useState<MarketingScenario>(scenario);
  const simulated = environment === "stub";
  const simulateNote = simulated ? "mkj-simulate-note" : "mkj-scenario-off mkj-simulate-note";
  return (
    <section id="mkj-controls" className="discovery-section" aria-label="Synthetic controls">
      <div className="discovery-controls">
        <label htmlFor="mkj-scenario">
          Synthetic scenario
          <select id="mkj-scenario" value={picked} onChange={(event) => setPicked(event.target.value as MarketingScenario)}>
            {MARKETING_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          id="mkj-apply-scenario"
          className="discovery-action"
          aria-disabled={simulated ? undefined : true}
          aria-describedby={simulated ? undefined : "mkj-scenario-off"}
          onClick={simulated ? () => actions.setScenario(picked) : undefined}
        >
          Start a session with this scenario
        </button>
        <button type="button" id="mkj-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          Read again
        </button>
        <button type="button" id="mkj-switch" className="discovery-action" onClick={() => actions.switchScope()}>
          Switch subject scope
        </button>
        <button type="button" id="mkj-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          Start a new synthetic session
        </button>
        <button
          type="button"
          id="mkj-deliver-held"
          className="discovery-action"
          aria-disabled={heldSupported ? undefined : true}
          aria-describedby="mkj-deliver-note"
          onClick={heldSupported ? () => actions.deliverHeld() : undefined}
        >
          Deliver held response
        </button>
      </div>
      {simulated ? (
        <p className="muted" data-scenario-note={scenario}>
          {SCENARIO_NOTES[scenario]} Changing the scenario starts a new synthetic session.
        </p>
      ) : (
        <p className="muted" id="mkj-scenario-off" data-blocked-reason="true" data-scenario-note="off">
          <WordMark word="Blocked." /> {MARKETING_SCENARIO_OFF_NOTE}
        </p>
      )}
      <p className="muted" id="mkj-deliver-note" data-subject={subjectRef}>
        Subject scope is {subjectRef}. {MARKETING_ALT_SUBJECT_NOTE} Start a new synthetic session clears every intent, as a reload does, and
        resolves nothing at a producer. Deliver held response works only in the held-response scenario.
      </p>
      <div className="discovery-controls" role="group" aria-label="Simulated producer events">
        {(Object.keys(CONTROL_LABELS) as (keyof typeof CONTROL_LABELS)[]).map((control) => (
          <button
            key={control}
            type="button"
            id={`mkj-simulate-${control}`}
            className="discovery-action"
            data-simulate={control}
            aria-disabled={simulated ? undefined : true}
            aria-describedby={simulateNote}
            onClick={simulated ? () => actions.simulate(control) : undefined}
          >
            {CONTROL_LABELS[control]}
          </button>
        ))}
      </div>
      <p className="muted" id="mkj-simulate-note">
        A Simulate control stands in for an event a real producer or the consent page would cause. This page does not see its effect until it
        reads, and a real producer offers no such control. None of them is an approval, a payment, or a message.
      </p>
    </section>
  );
}

export function MarketingStatus({ model }: { model: MarketingJourneyModel }) {
  return (
    <section id="mkj-status" className="discovery-section" tabIndex={-1} data-marketing-state={model.state}>
      <h3>Status</h3>
      <p role="status" data-marketing-status={model.state}>
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

export function LanesSection({ model }: { model: MarketingJourneyModel }) {
  return (
    <section id="mkj-lanes" className="discovery-section" aria-label="The four stages">
      <h3>Discover, apply, rejected, reclaim</h3>
      <p className="muted">Four separate lines. None of them is a summary of the others, and no line says the journey is done.</p>
      <ol className="discovery-list" aria-label="Journey stages">
        {model.lanes.map((lane) => (
          <li key={lane.lane} className="discovery-row" data-lane={lane.lane} data-count={lane.count === null ? "none" : String(lane.count)}>
            <h4>{lane.label}</h4>
            <p>{lane.line}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ConsentSection({ model }: { model: MarketingJourneyModel }) {
  const consent = model.consent;
  return (
    <section id="mkj-consent" className="discovery-section" aria-label="Consent as consumed here">
      <h3>Consent, consumed here and set elsewhere</h3>
      {consent === null ? (
        <p data-state="empty">No consent is read. See the status.</p>
      ) : (
        <div className="discovery-row" data-consent-state={consent.state} data-authorization={consent.authorization} data-source="synthetic-marketing">
          <p>
            <span className="discovery-badge" data-provenance="synthetic">
              SYNTHETIC
            </span>{" "}
            <span className="discovery-badge">Consent {consent.stateWord}</span>
          </p>
          <p>{consent.versionLine}</p>
          <p>{consent.authorizationLine}</p>
          <p>{consent.purposeLine}</p>
          <p>{consent.membershipLine}</p>
        </div>
      )}
      <p>
        <Link to={CONSENT_PAGE_ROUTE} id="mkj-consent-link">
          Open the consent page
        </Link>{" "}
        to set consent or authorize marketing. This journey posts neither.
      </p>
      <ul className="discovery-list" aria-label="Consent commands this page never posts">
        {model.consentNotPosted.map((row) => (
          <li key={row.action} data-not-posted={row.action}>
            {row.action}: {row.reason}
          </li>
        ))}
      </ul>
      <ScrollTable label="CRM scope">
        <table className="mkj-crm">
          <caption>What this journey takes from the CRM scope, and what it leaves out</caption>
          <thead>
            <tr>
              <th scope="col">Part</th>
              <th scope="col">Scope</th>
              <th scope="col">Note</th>
            </tr>
          </thead>
          <tbody>
            {model.crm.map((row) => (
              <tr key={row.id} data-crm-row={row.id} data-scope={row.scope} data-completes-crm="false">
                <th scope="row">{row.id}</th>
                <td>{row.scopeWord}</td>
                <td>{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
    </section>
  );
}

function BenefitCard({ benefit, actions }: { benefit: BenefitModel; actions: MarketingJourneyActions }) {
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
        <span className="discovery-badge">{benefit.kindWord}</span>
      </p>
      <h4>
        {benefit.title} ({benefit.benefitRef})
      </h4>
      <p data-verdict-line={benefit.verdict}>
        Source verdict {benefit.verdict}. {benefit.verdictLine}
      </p>
      <p>{benefit.rankLine}</p>
      <p>{benefit.consentLine}</p>
      <p data-usage-line="source">{benefit.usageLine}</p>
      {benefit.budgetLine ? <p data-budget-state={benefit.budgetState}>{benefit.budgetLine}</p> : null}
      {benefit.attributionLine ? <p>{benefit.attributionLine}</p> : null}
      <ul className="discovery-list" aria-label={`Orders for ${benefit.benefitRef}`}>
        {benefit.orders.map((order) => (
          <li key={order.orderRef} data-benefit-order={`${benefit.benefitRef}:${order.orderRef}`} data-order-state={order.orderStateWord}>
            <p>
              {order.label} ({order.orderRef}), {order.orderStateWord} at the order source.
              {order.applicationRef ? ` Applied as ${order.applicationRef}. It confirms no purchase and applies no discount.` : ""}
            </p>
            <GuardedButton
              id={`mkj-apply-${benefit.benefitRef}-${order.orderRef}`}
              label={`Apply ${benefit.benefitRef} to ${order.orderRef}`}
              control={order.apply}
              onPress={() => actions.apply(benefit.benefitRef, order.orderRef)}
            />
          </li>
        ))}
      </ul>
    </li>
  );
}

export function BenefitsSection({ model, actions }: { model: MarketingJourneyModel; actions: MarketingJourneyActions }) {
  return (
    <section id="mkj-benefits" className="discovery-section" aria-label="Benefits">
      <h3>Benefits: discover and apply</h3>
      <p className="muted">
        A listed benefit is not an applied benefit, and an apply is the source's decision at send time. The verdict, the figures, and the rank
        are the source's own words.
      </p>
      {model.benefits.length === 0 ? <p data-state="empty">No benefit is listed in this read.</p> : null}
      {model.benefits.length > 0 ? (
        <ul className="discovery-list" aria-label="Benefits in the last read">
          {model.benefits.map((benefit) => (
            <BenefitCard key={benefit.benefitRef} benefit={benefit} actions={actions} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function OrderCard({ order, actions, simulated }: { order: OrderModel; actions: MarketingJourneyActions; simulated: boolean }) {
  return (
    <li className="discovery-row" data-order={order.orderRef} data-state={order.state} data-source="synthetic-marketing">
      <h4>
        {order.label} ({order.orderRef})
      </h4>
      <p>{order.stateLine}</p>
      {simulated ? (
        <div className="discovery-controls">
          <GuardedButton
            id={`mkj-cancel-${order.orderRef}`}
            label={`Simulate: ${order.orderRef} is cancelled at the order source`}
            control={order.cancel}
            onPress={() => actions.simulate("cancel-order", order.orderRef)}
          />
          <GuardedButton
            id={`mkj-refund-${order.orderRef}`}
            label={`Simulate: a refund is observed for ${order.orderRef}`}
            control={order.refund}
            onPress={() => actions.simulate("refund-order", order.orderRef)}
          />
        </div>
      ) : null}
    </li>
  );
}

function ApplicationCard({ application, actions }: { application: ApplicationModel; actions: MarketingJourneyActions }) {
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
        Application {application.applicationRef}: {application.benefitRef} on {application.orderRef}
      </h4>
      <p>{application.stateLine}</p>
      <p data-due-line={application.state}>{application.dueLine}</p>
      <p>{application.channelLine}</p>
      <p>{application.linkLine}</p>
      <p>{application.consentLine}</p>
      <p data-restoration="undetermined">{application.restorationLine}</p>
      <GuardedButton
        id={`mkj-reclaim-${application.applicationRef}`}
        label={`Reclaim ${application.applicationRef}`}
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
  return (
    <section id="mkj-orders" className="discovery-section" aria-label="Orders and applications">
      <h3>Orders and applications: reclaim</h3>
      <p className="muted">
        An order is the order source's own fact. A cancel or an observed refund makes an applied benefit due for reclaim and reclaims nothing.
        A reclaim is its own request. {MARKETING_POLICY_NOTE}
      </p>
      {model.orders.length === 0 ? <p data-state="empty">No order is listed in this read.</p> : null}
      {model.orders.length > 0 ? (
        <ul className="discovery-list" aria-label="Orders in the last read">
          {model.orders.map((order) => (
            <OrderCard key={order.orderRef} order={order} actions={actions} simulated={environment === "stub"} />
          ))}
        </ul>
      ) : null}
      <h4>Applications</h4>
      {model.applications.length === 0 ? <p data-state="empty">No application is listed in this read.</p> : null}
      {model.applications.length > 0 ? (
        <ul className="discovery-list" aria-label="Applications in the last read">
          {model.applications.map((application) => (
            <ApplicationCard key={application.applicationRef} application={application} actions={actions} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function RejectionCard({ row, actions }: { row: RejectionModel; actions: MarketingJourneyActions }) {
  return (
    <li className="discovery-row" data-rejection={row.intentRef} data-code={row.code} data-return-action={row.returnAction}>
      <h4>
        {row.stepWord} rejected ({row.code})
      </h4>
      <p>{row.target}</p>
      <p>{row.detail}</p>
      <p>{row.returnLine}</p>
      {row.returnAction === "read-again" ? (
        <button type="button" id={`mkj-return-${row.intentRef}`} className="discovery-action" onClick={() => actions.refresh()}>
          Read again
        </button>
      ) : null}
      {row.returnAction === "manage-consent" ? (
        <Link to={CONSENT_PAGE_ROUTE} id={`mkj-return-${row.intentRef}`}>
          Open the consent page
        </Link>
      ) : null}
    </li>
  );
}

export function RejectionsSection({ model, actions }: { model: MarketingJourneyModel; actions: MarketingJourneyActions }) {
  return (
    <section id="mkj-rejections" className="discovery-section" aria-label="Rejections">
      <h3>Rejected by the source</h3>
      {model.rejections.length === 0 ? (
        <p data-state="empty">The source has rejected no write of this page in this session.</p>
      ) : (
        <ul className="discovery-list" aria-label="Rejections in this session">
          {model.rejections.map((row) => (
            <RejectionCard key={row.intentRef} row={row} actions={actions} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function SessionSection({ session }: { session: SessionModel }) {
  return (
    <section id="mkj-session" className="discovery-section" aria-label="Session record">
      <h3>Session record</h3>
      <p>{session.contextLine}</p>
      <p data-counters="true">{session.countersLine}</p>
      {session.intents.length === 0 ? (
        <p data-state="empty">No write has been sent in this session.</p>
      ) : (
        <ScrollTable label="Writes in this session">
          <table className="mkj-intents">
            <caption>Writes in this session</caption>
            <thead>
              <tr>
                <th scope="col">Intent</th>
                <th scope="col">Write</th>
                <th scope="col">Target</th>
                <th scope="col">Outcome</th>
                <th scope="col">Code</th>
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

export function RegisterSection({ model }: { model: MarketingJourneyModel }) {
  return (
    <section id="mkj-register" className="discovery-section" aria-label="Contract register">
      <h3>Contract register</h3>
      <p className="muted">
        Naming a field in the pin is not binding it. Only consent has named fields. Eligibility, priority, usage count, coupon budget, referral
        attribution, apply, and reclaim have none, and kix-protocol:wave7-marketing-contracts is not merged. The values on this page are
        synthetic observations, and no body is built from them.
      </p>
      <ScrollTable label="Contract register">
        <table className="mkj-register">
          <caption>Which concept has a named field in the pinned catalogue</caption>
          <thead>
            <tr>
              <th scope="col">Concept</th>
              <th scope="col">Field here</th>
              <th scope="col">Status</th>
              <th scope="col">Pinned fields</th>
              <th scope="col">Note</th>
            </tr>
          </thead>
          <tbody>
            {model.register.map((row) => (
              <tr key={row.id} data-register-row={row.id} data-status={row.status}>
                <th scope="row">{row.id}</th>
                <td>{row.field}</td>
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
