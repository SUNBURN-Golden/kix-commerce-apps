import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import type { ReactNode } from "react";
import { ORIGINATION_SCENARIOS, type OriginationScenario } from "@kix/protocol-adapter";
import { AmountNotice, StatusMark } from "../a11y/marks";
import {
  ORIGINATION_ACTOR_NOTE,
  ORIGINATION_BOUNDARY,
  ORIGINATION_CLAIM_NOTE,
  ORIGINATION_EXPLANATION_NOTE,
  ORIGINATION_FENCE_NOTE,
  ORIGINATION_FIGURE_NOTE,
  ORIGINATION_LIMIT_NOTE,
  ORIGINATION_PAGE_TITLE,
  ORIGINATION_POLICY_NOTE,
  ORIGINATION_READ_NOTE,
  ORIGINATION_SCENARIO_NOTES,
  ORIGINATION_SCOPE_NOTE,
  ORIGINATION_SESSION_NOTE,
  ORIGINATION_SOURCE_LINE,
  ORIGINATION_SYNTHETIC_CONTROL_NOTE,
  type ControlModel,
  type OriginationActions,
  type OriginationBurdenModel,
  type OriginationClaimModel,
  type OriginationConsentModel,
  type OriginationDocumentModel,
  type OriginationModel,
  type OriginationSessionModel,
} from "../credit-origination";
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
    <div className="origination-scroll" role="region" aria-label={label} tabIndex={0}>
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

export function OriginationBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: OriginationScenario;
  model: OriginationModel;
}) {
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">Seller advance application</p>
      <h2>{ORIGINATION_PAGE_TITLE}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-origination">
        SYNTHETIC. {ORIGINATION_SOURCE_LINE}
      </p>
      <p>{ORIGINATION_BOUNDARY}</p>
      <AmountNotice />
      <p>{ORIGINATION_EXPLANATION_NOTE}</p>
      <p>{ORIGINATION_FIGURE_NOTE}</p>
      <p>{ORIGINATION_CLAIM_NOTE}</p>
      <p>{ORIGINATION_POLICY_NOTE}</p>
      <p>{ORIGINATION_LIMIT_NOTE}</p>
      <p>{ORIGINATION_SCOPE_NOTE}</p>
      <p>{ORIGINATION_ACTOR_NOTE}</p>
      <p>{ORIGINATION_READ_NOTE}</p>
      <p>{ORIGINATION_FENCE_NOTE}</p>
      <p>{ORIGINATION_SESSION_NOTE}</p>
      <p>{WORKSPACE_RULING}</p>
      <p data-hold-record="not-bound">{model.session.holdLine}</p>
      <p data-not-composed="recorded">{model.session.notComposedLine}</p>
    </header>
  );
}

export function OriginationControls({
  scenario,
  actions,
}: {
  scenario: OriginationScenario;
  actions: OriginationActions;
}) {
  return (
    <section id="origination-controls" className="discovery-section" aria-label="Synthetic controls">
      <div className="discovery-controls">
        <label htmlFor="origination-scenario">
          Synthetic scenario
          <select
            id="origination-scenario"
            value={scenario}
            onChange={(event) => actions.setScenario(event.target.value as OriginationScenario)}
          >
            {ORIGINATION_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button type="button" id="origination-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          Read again
        </button>
        <button type="button" id="origination-switch" className="discovery-action" onClick={() => actions.switchScope()}>
          Switch applicant scope
        </button>
        <ConnectivityWriteButton type="button" id="origination-advance-review" className="discovery-action" onClick={() => actions.advanceReview()}>
          Advance review
        </ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="origination-advance-policy" className="discovery-action" onClick={() => actions.advancePolicy()}>
          Advance policy
        </ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="origination-withdraw-consent" className="discovery-action" onClick={() => actions.withdrawConsent()}>
          Withdraw consent
        </ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="origination-expire-document" className="discovery-action" onClick={() => actions.expireDocument()}>
          Expire document
        </ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="origination-rival-request" className="discovery-action" onClick={() => actions.rivalRequest()}>
          Rival request
        </ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="origination-revoke" className="discovery-action" onClick={() => actions.revokeGrant()}>
          Revoke grant
        </ConnectivityWriteButton>
        <ConnectivityWriteButton type="button" id="origination-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          Start a new synthetic session
        </ConnectivityWriteButton>
      </div>
      <p className="muted" data-scenario-note={scenario}>
        {ORIGINATION_SCENARIO_NOTES[scenario]} Changing the scenario starts a new synthetic session.
      </p>
      <p className="muted">{ORIGINATION_SYNTHETIC_CONTROL_NOTE}</p>
    </section>
  );
}

export function OriginationStatus({ model }: { model: OriginationModel }) {
  return (
    <section id="origination-status" className="discovery-section" tabIndex={-1} data-origination-state={model.state}>
      <h3>Status</h3>
      <p role="status" data-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {model.statusLine}
        {model.detailLine ? ` ${model.detailLine}` : ""}
      </p>
      <p className="muted">{model.freshnessWord}</p>
      <p className="muted">{model.scopeLine}</p>
      <p className="muted">{model.watermarkLine}</p>
      {model.behindLine ? <p data-behind="true">{model.behindLine}</p> : null}
      {model.fenceLine ? (
        <p data-fence="true">
          <WordMark word="Fenced." /> {model.fenceLine}
        </p>
      ) : null}
      {model.lastLine ? (
        <p role="status" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word="Attention." /> : null} {model.lastLine}
        </p>
      ) : null}
    </section>
  );
}

export function ApplicationSection({ model }: { model: OriginationModel }) {
  const application = model.application;
  const decision = model.decision;
  return (
    <section id="origination-application" className="discovery-section" aria-label="Application and review">
      <h3>Application and review</h3>
      <p className="muted">
        The application lane and the review lane stay apart. A submitted application is not a decision, and an
        explanation is never a decision.
      </p>
      {application === null ? (
        <p data-state="empty">No application in this read.</p>
      ) : (
        <div className="discovery-row" data-application={application.applicationRef} data-state={application.state}>
          <p>
            <span className="discovery-badge" data-provenance="synthetic">
              SYNTHETIC
            </span>{" "}
            <span className="discovery-badge" data-application-state={application.state}>
              {application.stateWord}
            </span>
          </p>
          <h4>{application.applicationRef}</h4>
          <p>{application.revisionLine}</p>
          <p data-amount="copied">{application.requestLine}</p>
          <p>{application.claimLine}</p>
        </div>
      )}
      <h4>Review decision</h4>
      {decision === null ? (
        <p data-state="empty" data-decision="none">
          No decision in this read. An explanation is not a decision.
        </p>
      ) : (
        <div
          className="discovery-row"
          data-decision={decision.decisionRef}
          data-kind={decision.kind}
          data-withheld={decision.withheld ? "true" : "false"}
          data-stale={decision.staleLine !== null ? "true" : "false"}
        >
          <p>
            <span className="discovery-badge" data-provenance="synthetic">
              SYNTHETIC
            </span>{" "}
            <span className="discovery-badge" data-decision-kind={decision.kind}>
              {decision.kindWord}
            </span>
          </p>
          <h4>{decision.decisionRef}</h4>
          <p>{decision.policyLine}</p>
          <p>{decision.applicationLine}</p>
          {decision.staleLine ? (
            <p data-stale-lane="review">
              <WordMark word="Stale." /> {decision.staleLine}
            </p>
          ) : null}
          {decision.withheld ? (
            <p data-withheld-line="review">
              <WordMark word="Withheld." /> This decision is withheld because a later lane contradicts it.
            </p>
          ) : null}
          {decision.conditionLines.map((line) => (
            <p key={line} data-condition="true">
              {line}
            </p>
          ))}
        </div>
      )}
      {model.explanation === null ? null : (
        <div className="discovery-detail" data-explanation={model.explanation.explanationRef} data-provenance="assistant-generated">
          <h4>Assistant explanation</h4>
          <p>{model.explanation.text}</p>
          <p className="muted">
            Assistant-generated. It is shown as an explanation, and it is never a review decision.
          </p>
        </div>
      )}
      {model.contradictionLines.map((line) => (
        <p key={line} data-contradiction="true">
          <WordMark word="Withheld." /> {line}
        </p>
      ))}
    </section>
  );
}

function ClaimCard({ claim }: { claim: OriginationClaimModel }) {
  return (
    <li
      className="discovery-row"
      data-claim={claim.claimRef}
      data-state={claim.state}
      data-cut={claim.cutRef}
      data-provenance="synthetic"
      data-source="synthetic-origination"
    >
      <p>
        <span className="discovery-badge" data-provenance="synthetic">
          SYNTHETIC
        </span>{" "}
        <span className="discovery-badge">Claim</span>{" "}
        <span className="discovery-badge" data-claim-state={claim.state}>
          {claim.stateWord}
        </span>
      </p>
      <h5>{claim.claimRef}</h5>
      <p>Trade {claim.tradeRef}.</p>
      <p data-amount="copied">{claim.faceLine}</p>
      <p>{claim.reasonLine}</p>
      <p>Cut {claim.cutRef}.</p>
    </li>
  );
}

function BurdenCard({ burden }: { burden: OriginationBurdenModel }) {
  return (
    <li
      className="discovery-row"
      data-burden={burden.burdenRef}
      data-kind={burden.kind}
      data-state={burden.state}
      data-cut={burden.cutRef}
      data-provenance="synthetic"
      data-source="synthetic-origination"
    >
      <p>
        <span className="discovery-badge" data-provenance="synthetic">
          SYNTHETIC
        </span>{" "}
        <span className="discovery-badge">{burden.kindWord}</span>{" "}
        <span className="discovery-badge" data-burden-state={burden.state}>
          {burden.stateWord}
        </span>
      </p>
      <h5>{burden.burdenRef}</h5>
      <p>On claim {burden.claimRef}.</p>
      <p data-amount="copied">{burden.amountLine}</p>
      <p>A burden stays its own row. It is never subtracted from a face.</p>
      <p>Cut {burden.cutRef}.</p>
    </li>
  );
}

export function BasisSection({ model }: { model: OriginationModel }) {
  return (
    <section id="origination-basis" className="discovery-section" aria-label="Claim basis" data-cut-state={model.cutState}>
      <h3>Claim basis</h3>
      <p data-cut-line={model.cutState}>{model.cutLine}</p>
      <p data-claims="all-false">{model.nonClaimsLine}</p>
      <h4>Claims</h4>
      {model.claims.length === 0 ? <p data-state="empty">No claim in this read.</p> : null}
      {model.claims.length > 0 ? (
        <ul className="discovery-list" aria-label="Claims in the last read">
          {model.claims.map((claim) => (
            <ClaimCard key={claim.claimRef} claim={claim} />
          ))}
        </ul>
      ) : null}
      <h4>Burdens</h4>
      {model.burdens.length === 0 ? <p data-state="empty">No burden in this read.</p> : null}
      {model.burdens.length > 0 ? (
        <ul className="discovery-list" aria-label="Burdens in the last read">
          {model.burdens.map((burden) => (
            <BurdenCard key={burden.burdenRef} burden={burden} />
          ))}
        </ul>
      ) : null}
      {model.unlinkedLines.map((line) => (
        <p key={line} data-unlinked="true">
          <WordMark word="Attention." /> {line}
        </p>
      ))}
      <h4>Source cuts</h4>
      {model.cuts.length === 0 ? <p data-state="empty">No source cut is listed in this read.</p> : null}
      {model.cuts.length > 0 ? (
        <ScrollTable label="Source cuts">
          <table className="origination-cuts">
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

function ConsentRow({ consent, actions }: { consent: OriginationConsentModel; actions: OriginationActions }) {
  return (
    <li className="discovery-row" data-consent={consent.consentRef} data-state={consent.state} data-purpose={consent.purpose}>
      <p>
        <span className="discovery-badge">{consent.purposeWord}</span>{" "}
        <span className="discovery-badge" data-consent-state={consent.state}>
          {consent.stateWord}
        </span>
      </p>
      <h5>{consent.consentRef}</h5>
      <p>{consent.versionLine}</p>
      <p>{consent.setLine}</p>
      <GuardedButton
        id={`origination-renew-${consent.consentRef}`}
        label={`Renew ${consent.consentRef}`}
        control={consent.renew}
        onPress={() => actions.renewConsent(consent.consentRef)}
      />
    </li>
  );
}

function DocumentRow({ document, actions }: { document: OriginationDocumentModel; actions: OriginationActions }) {
  return (
    <li className="discovery-row" data-document={document.documentRef} data-state={document.state} data-kind={document.kind}>
      <p>
        <span className="discovery-badge">{document.kindWord}</span>{" "}
        <span className="discovery-badge" data-document-state={document.state}>
          {document.stateWord}
        </span>
      </p>
      <h5>{document.documentRef}</h5>
      <p>{document.claimLine}</p>
      <p>{document.expiryLine}</p>
      <p>{document.verdictLine}</p>
      <GuardedButton
        id={`origination-provide-${document.documentRef}`}
        label={`Provide ${document.documentRef}`}
        control={document.provide}
        onPress={() => actions.provideDocument(document.documentRef)}
      />
    </li>
  );
}

export function PolicySection({ model, actions }: { model: OriginationModel; actions: OriginationActions }) {
  return (
    <section id="origination-policy" className="discovery-section" aria-label="Policy, consents, and documents">
      <h3>Policy, consents, and documents</h3>
      <p>{model.policyLine}</p>
      {model.staleLaneLines.map((line) => (
        <p key={line} data-stale-lane-flag="true">
          <WordMark word="Stale." /> {line}
        </p>
      ))}
      <h4>Consents</h4>
      {model.consents.length === 0 ? <p data-state="empty">No consent in this read.</p> : null}
      {model.consents.length > 0 ? (
        <ul className="discovery-list" aria-label="Consents in the last read">
          {model.consents.map((consent) => (
            <ConsentRow key={consent.consentRef} consent={consent} actions={actions} />
          ))}
        </ul>
      ) : null}
      <h4>Documents</h4>
      {model.documents.length === 0 ? <p data-state="empty">No document in this read.</p> : null}
      {model.documents.length > 0 ? (
        <ul className="discovery-list" aria-label="Documents in the last read">
          {model.documents.map((document) => (
            <DocumentRow key={document.documentRef} document={document} actions={actions} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function ReasonsSection({ model }: { model: OriginationModel }) {
  return (
    <section id="origination-reasons" className="discovery-section" aria-label="Review reasons and paths">
      <h3>Reasons and paths</h3>
      <p className="muted">
        Each reason names the lane it belongs to and the one correction path the source offers. This page offers only
        the paths the source names.
      </p>
      {model.reasons.length === 0 ? <p data-state="empty">No reason in this read.</p> : null}
      {model.reasons.length > 0 ? (
        <ul className="discovery-list" aria-label="Reasons in the last read">
          {model.reasons.map((reason) => (
            <li key={reason.reasonRef} className="discovery-row" data-reason={reason.reasonRef} data-lane={reason.lane} data-code={reason.code}>
              <p>
                <span className="discovery-badge">{reason.lane}</span>{" "}
                <span className="discovery-badge" data-reason-code={reason.code}>
                  {reason.code}
                </span>
              </p>
              <h5>{reason.reasonRef}</h5>
              <p>{reason.text}</p>
              <p data-remedy={reason.remedy}>Path: {reason.remedyWord}.</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function CommitmentSection({ model }: { model: OriginationModel }) {
  const commitment = model.commitment;
  const terms = model.terms;
  const drawdown = model.drawdown;
  return (
    <section id="origination-commitment" className="discovery-section" aria-label="Commitment and drawdown">
      <h3>Commitment and drawdown</h3>
      <p className="muted">
        An approval is not a commitment, a commitment is not permission to draw, and a recorded request is not a
        disbursement.
      </p>
      <h4>Commitment</h4>
      {commitment === null ? (
        <p data-state="empty" data-commitment="none">
          No commitment in this read.
        </p>
      ) : (
        <div
          className="discovery-row"
          data-commitment={commitment.commitmentRef}
          data-state={commitment.state}
          data-withheld={commitment.withheld ? "true" : "false"}
          data-stale={commitment.staleLine !== null ? "true" : "false"}
        >
          <p>
            <span className="discovery-badge" data-provenance="synthetic">
              SYNTHETIC
            </span>{" "}
            <span className="discovery-badge" data-commitment-state={commitment.state}>
              {commitment.stateWord}
            </span>
          </p>
          <h4>{commitment.commitmentRef}</h4>
          <p>{commitment.policyLine}</p>
          {commitment.staleLine ? (
            <p data-stale-lane="commitment">
              <WordMark word="Stale." /> {commitment.staleLine}
            </p>
          ) : null}
          {commitment.withheld ? (
            <p data-withheld-line="commitment">
              <WordMark word="Withheld." /> This commitment is withheld because a later lane contradicts it.
            </p>
          ) : null}
        </div>
      )}
      <h4>Terms</h4>
      {terms === null ? (
        <p data-state="empty" data-terms="none">
          No terms in this read. Rate and schedule stay UNDETERMINED without them.
        </p>
      ) : (
        <div className="discovery-row" data-terms="present" data-stale={terms.staleLine !== null ? "true" : "false"}>
          <p>{terms.policyLine}</p>
          <p data-rate="copied">{terms.rateLine}</p>
          {terms.staleLine ? (
            <p data-stale-lane="terms">
              <WordMark word="Stale." /> {terms.staleLine}
            </p>
          ) : null}
          {terms.rows.length > 0 ? (
            <ScrollTable label="Schedule rows">
              <table className="origination-schedule">
                <caption>The source&apos;s own schedule rows, copied</caption>
                <thead>
                  <tr>
                    <th scope="col">Installment</th>
                    <th scope="col">Due</th>
                    <th scope="col">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {terms.rows.map((row) => (
                    <tr key={row.installmentLabel} data-schedule={row.installmentLabel}>
                      <th scope="row">{row.installmentLabel}</th>
                      <td>{row.dueLabel}</td>
                      <td data-amount="copied">{row.amountLine}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollTable>
          ) : (
            <p data-state="empty">No schedule rows from the source.</p>
          )}
        </div>
      )}
      <h4>Drawdown permission</h4>
      <div className="discovery-row" data-permission={drawdown.permission} data-withheld={drawdown.withheld ? "true" : "false"}>
        <p>
          <span className="discovery-badge" data-permission-state={drawdown.permission}>
            {drawdown.permissionWord}
          </span>
        </p>
        <p>{drawdown.commitmentLine}</p>
        {drawdown.withheld ? (
          <p data-withheld-line="drawdown">
            <WordMark word="Withheld." /> Permission is withheld here even where the source states it.
          </p>
        ) : null}
        {drawdown.reasonLines.map((line) => (
          <p key={line} data-drawdown-reason="true">
            {line}
          </p>
        ))}
        {drawdown.requests.length === 0 ? (
          <p data-state="empty">No drawdown request recorded.</p>
        ) : (
          <ul className="discovery-list" aria-label="Recorded drawdown requests">
            {drawdown.requests.map((row) => (
              <li key={row.drawdownRef} data-drawdown={row.drawdownRef}>
                {row.drawdownRef} — {row.stateWord}
              </li>
            ))}
          </ul>
        )}
      </div>
      <h4>Shared limit</h4>
      <div className="discovery-row" data-limit={model.limit.limitRef || "none"} data-contention={model.limit.contention}>
        <p>
          <span className="discovery-badge" data-contention={model.limit.contention}>
            {model.limit.contentionWord}
          </span>
        </p>
        {model.limit.amountLine ? <p data-amount="copied">{model.limit.amountLine}</p> : null}
        <p>{model.limit.limitWord}</p>
        {model.limit.rankLines.map((line) => (
          <p key={line} data-limit-rank="true">
            {line}
          </p>
        ))}
      </div>
    </section>
  );
}

export function RequestsSection({ model, actions }: { model: OriginationModel; actions: OriginationActions }) {
  return (
    <section id="origination-requests" className="discovery-section" aria-label="Requests">
      <h3>Requests</h3>
      <p className="muted">
        A request is built from the last read and sent once. A control that is off is a request that never leaves, and
        its reason is shown. The typed amount is checked for whole-unit shape only; it is never parsed or compared.
      </p>
      <div className="discovery-controls">
        <label htmlFor="origination-amount">
          Requested amount (whole units of the source&apos;s unit)
          <input id="origination-amount" name="origination-amount" inputMode="numeric" autoComplete="off" defaultValue="1000" />
        </label>
        <GuardedButton
          id="origination-submit"
          label="Submit the application"
          control={model.submitControl}
          onPress={() => actions.submit(amountValue())}
        />
        <GuardedButton
          id="origination-amend"
          label="Amend the application"
          control={model.amendControl}
          onPress={() => actions.amend(amountValue())}
        />
        <GuardedButton
          id="origination-rereview"
          label="Ask for a new review"
          control={model.rereviewControl}
          onPress={() => actions.rereview()}
        />
        <GuardedButton
          id="origination-accept"
          label="Accept the offered commitment"
          control={model.acceptControl}
          onPress={() => actions.acceptCommitment()}
        />
        <GuardedButton
          id="origination-drawdown"
          label="Request a drawdown"
          control={model.drawdownControl}
          onPress={() => actions.requestDrawdown()}
        />
      </div>
      {model.last === null ? (
        <p data-state="empty">No request sent in this session.</p>
      ) : (
        <div className="discovery-detail" data-last-request={model.last.seq} data-phase={model.last.phase}>
          <h4>
            Request {model.last.seq}: {model.last.kindWord}
          </h4>
          <p data-phase-word={model.last.phase}>
            {model.last.phaseWord}
            {model.last.code ? ` (${model.last.code})` : ""}.
          </p>
          {model.last.detail ? <p className="muted">{model.last.detail}</p> : null}
          {model.last.receiptLines.map((line) => (
            <p key={line} data-receipt-line="true">
              {line}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

/** The amount the person typed, as text. It is checked for shape by the controller, never parsed here. */
function amountValue(): string {
  if (typeof document === "undefined") {
    return "";
  }
  const node = document.getElementById("origination-amount");
  return node instanceof HTMLInputElement ? node.value : "";
}

export function OriginationSessionSection({ session }: { session: OriginationSessionModel }) {
  return (
    <section id="origination-session" className="discovery-section" aria-label="Session record">
      <h3>Session record</h3>
      <p>{session.contextLine}</p>
      <p data-counters="true">{session.countersLine}</p>
      <p>{session.earlierUnknownLine}</p>
      <p className="muted">{session.notComposedLine}</p>
      <p className="muted">{session.holdLine}</p>
    </section>
  );
}
