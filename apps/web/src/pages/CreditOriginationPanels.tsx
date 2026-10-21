import { messages as copy0 } from "../i18n/messages/pages--CreditOriginationPanels";
import { messages as copy1 } from "../i18n/messages/credit-origination";
import { messages as copy2 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
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
    <div className="origination-scroll" role="region" aria-label={deskText(t, label)} tabIndex={0}>
      {deskText(t, children)}
    </div>
  );
}

/**
 * A control that is off stays focusable and says why. A native disabled button is
 * skipped by the keyboard, so its reason would never be reached.
 */
function GuardedButton({ id, label, control, onPress }: { id: string; label: string; control: ControlModel; onPress: () => void }) {
  const t = useT(copy0, copy1, copy2);
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

export function OriginationBanner({
  environment,
  scenario,
  model,
}: {
  environment: "stub" | "integration-http";
  scenario: OriginationScenario;
  model: OriginationModel;
}) {
  const t = useT(copy0, copy1, copy2);
  return (
    <header
      className="section-head discovery-section"
      data-adapter-environment={environment}
      data-scenario={scenario}
      data-freshness={model.freshnessWord}
    >
      <p className="eyebrow">{t("s1j3")}</p>
      <h2>{deskText(t, ORIGINATION_PAGE_TITLE)}</h2>
      <p className="discovery-banner" data-provenance="synthetic" data-source="synthetic-origination">
        SYNTHETIC. {deskText(t, ORIGINATION_SOURCE_LINE)}
      </p>
      <p>{deskText(t, ORIGINATION_BOUNDARY)}</p>
      <AmountNotice />
      <p>{deskText(t, ORIGINATION_EXPLANATION_NOTE)}</p>
      <p>{deskText(t, ORIGINATION_FIGURE_NOTE)}</p>
      <p>{deskText(t, ORIGINATION_CLAIM_NOTE)}</p>
      <p>{deskText(t, ORIGINATION_POLICY_NOTE)}</p>
      <p>{deskText(t, ORIGINATION_LIMIT_NOTE)}</p>
      <p>{deskText(t, ORIGINATION_SCOPE_NOTE)}</p>
      <p>{deskText(t, ORIGINATION_ACTOR_NOTE)}</p>
      <p>{deskText(t, ORIGINATION_READ_NOTE)}</p>
      <p>{deskText(t, ORIGINATION_FENCE_NOTE)}</p>
      <p>{deskText(t, ORIGINATION_SESSION_NOTE)}</p>
      <p>{deskText(t, WORKSPACE_RULING)}</p>
      <p data-hold-record="not-bound">{deskText(t, model.session.holdLine)}</p>
      <p data-not-composed="recorded">{deskText(t, model.session.notComposedLine)}</p>
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
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="origination-controls" className="discovery-section" aria-label={t("s1o9")}>
      <div className="discovery-controls">
        <label htmlFor="origination-scenario">
          {t("s1p5")}<select
            id="origination-scenario"
            value={scenario}
            onChange={(event) => actions.setScenario(event.target.value as OriginationScenario)}
          >
            {deskText(t, ORIGINATION_SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {deskText(t, item)}
              </option>
            )))}
          </select>
        </label>
        <button type="button" id="origination-refresh" className="discovery-action" onClick={() => actions.refresh()}>
          {t("s1ax")}</button>
        <button type="button" id="origination-switch" className="discovery-action" onClick={() => actions.switchScope()}>
          {t("s1ns")}</button>
        <button type="button" id="origination-advance-review" className="discovery-action" onClick={() => actions.advanceReview()}>
          {t("s1v")}</button>
        <button type="button" id="origination-advance-policy" className="discovery-action" onClick={() => actions.advancePolicy()}>
          {t("s1u")}</button>
        <button type="button" id="origination-withdraw-consent" className="discovery-action" onClick={() => actions.withdrawConsent()}>
          {t("s26q")}</button>
        <button type="button" id="origination-expire-document" className="discovery-action" onClick={() => actions.expireDocument()}>
          {t("ska")}</button>
        <button type="button" id="origination-rival-request" className="discovery-action" onClick={() => actions.rivalRequest()}>
          {t("s1hd")}</button>
        <button type="button" id="origination-revoke" className="discovery-action" onClick={() => actions.revokeGrant()}>
          {t("s1h6")}</button>
        <button type="button" id="origination-new-session" className="discovery-action" onClick={() => actions.newSession()}>
          {t("s1m2")}</button>
      </div>
      <p className="muted" data-scenario-note={scenario}>
        {deskText(t, ORIGINATION_SCENARIO_NOTES[scenario])} {t("sbx")}</p>
      <p className="muted">{deskText(t, ORIGINATION_SYNTHETIC_CONTROL_NOTE)}</p>
    </section>
  );
}

export function OriginationStatus({ model }: { model: OriginationModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="origination-status" className="discovery-section" tabIndex={-1} data-origination-state={model.state}>
      <h3>{t("s1mj")}</h3>
      <p role="status" data-status={model.state}>
        {model.state === "loading" ? <StatusMark kind="loading" /> : null} {deskText(t, model.statusLine)}
        {model.detailLine ? t("sgg", { detailLine: model.detailLine }) : ""}
      </p>
      <p className="muted">{deskText(t, model.freshnessWord)}</p>
      <p className="muted">{deskText(t, model.scopeLine)}</p>
      <p className="muted">{deskText(t, model.watermarkLine)}</p>
      {model.behindLine ? <p data-behind="true">{deskText(t, model.behindLine)}</p> : null}
      {model.fenceLine ? (
        <p data-fence="true">
          <WordMark word={t("sky")} /> {deskText(t, model.fenceLine)}
        </p>
      ) : null}
      {model.lastLine ? (
        <p role="status" data-last-action={model.lastNeedsFocus ? "attention" : "note"}>
          {model.lastNeedsFocus ? <WordMark word={t("s91")} /> : null} {deskText(t, model.lastLine)}
        </p>
      ) : null}
    </section>
  );
}

export function ApplicationSection({ model }: { model: OriginationModel }) {
  const t = useT(copy0, copy1, copy2);
  const application = model.application;
  const decision = model.decision;
  return (
    <section id="origination-application" className="discovery-section" aria-label={t("s58")}>
      <h3>{t("s58")}</h3>
      <p className="muted">
        {t("s1q9")}</p>
      {application === null ? (
        <p data-state="empty">{t("su2")}</p>
      ) : (
        <div className="discovery-row" data-application={application.applicationRef} data-state={application.state}>
          <p>
            <span className="discovery-badge" data-provenance="synthetic">
              SYNTHETIC
            </span>{" "}
            <span className="discovery-badge" data-application-state={application.state}>
              {deskText(t, application.stateWord)}
            </span>
          </p>
          <h4>{deskText(t, application.applicationRef)}</h4>
          <p>{deskText(t, application.revisionLine)}</p>
          <p data-amount="copied">{deskText(t, application.requestLine)}</p>
          <p>{deskText(t, application.claimLine)}</p>
        </div>
      )}
      <h4>{t("s1h1")}</h4>
      {decision === null ? (
        <p data-state="empty" data-decision="none">
          {t("sv1")}</p>
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
              {deskText(t, decision.kindWord)}
            </span>
          </p>
          <h4>{deskText(t, decision.decisionRef)}</h4>
          <p>{deskText(t, decision.policyLine)}</p>
          <p>{deskText(t, decision.applicationLine)}</p>
          {decision.staleLine ? (
            <p data-stale-lane="review">
              <WordMark word={t("s1lh")} /> {deskText(t, decision.staleLine)}
            </p>
          ) : null}
          {decision.withheld ? (
            <p data-withheld-line="review">
              <WordMark word={t("s26v")} /> {t("s22x")}</p>
          ) : null}
          {deskText(t, decision.conditionLines.map((line) => (
            <p key={line} data-condition="true">
              {deskText(t, line)}
            </p>
          )))}
        </div>
      )}
      {model.explanation === null ? null : (
        <div className="discovery-detail" data-explanation={model.explanation.explanationRef} data-provenance="assistant-generated">
          <h4>{t("s8b")}</h4>
          <p>{deskText(t, model.explanation.text)}</p>
          <p className="muted">
            {t("s8c")}</p>
        </div>
      )}
      {deskText(t, model.contradictionLines.map((line) => (
        <p key={line} data-contradiction="true">
          <WordMark word={t("s26v")} /> {deskText(t, line)}
        </p>
      )))}
    </section>
  );
}

function ClaimCard({ claim }: { claim: OriginationClaimModel }) {
  const t = useT(copy0, copy1, copy2);
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
        <span className="discovery-badge">{t("scf")}</span>{" "}
        <span className="discovery-badge" data-claim-state={claim.state}>
          {deskText(t, claim.stateWord)}
        </span>
      </p>
      <h5>{deskText(t, claim.claimRef)}</h5>
      <p>{t("s24e")}{" "}{deskText(t, claim.tradeRef)}.</p>
      <p data-amount="copied">{deskText(t, claim.faceLine)}</p>
      <p>{deskText(t, claim.reasonLine)}</p>
      <p>{t("sfe")}{" "}{deskText(t, claim.cutRef)}.</p>
    </li>
  );
}

function BurdenCard({ burden }: { burden: OriginationBurdenModel }) {
  const t = useT(copy0, copy1, copy2);
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
        <span className="discovery-badge">{deskText(t, burden.kindWord)}</span>{" "}
        <span className="discovery-badge" data-burden-state={burden.state}>
          {deskText(t, burden.stateWord)}
        </span>
      </p>
      <h5>{deskText(t, burden.burdenRef)}</h5>
      <p>{t("s142")}{" "}{deskText(t, burden.claimRef)}.</p>
      <p data-amount="copied">{deskText(t, burden.amountLine)}</p>
      <p>{t("s7")}</p>
      <p>{t("sfe")}{" "}{deskText(t, burden.cutRef)}.</p>
    </li>
  );
}

export function BasisSection({ model }: { model: OriginationModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="origination-basis" className="discovery-section" aria-label={t("scg")} data-cut-state={model.cutState}>
      <h3>{t("scg")}</h3>
      <p data-cut-line={model.cutState}>{deskText(t, model.cutLine)}</p>
      <p data-claims="all-false">{deskText(t, model.nonClaimsLine)}</p>
      <h4>{t("scj")}</h4>
      {model.claims.length === 0 ? <p data-state="empty">{t("sul")}</p> : null}
      {model.claims.length > 0 ? (
        <ul className="discovery-list" aria-label={t("scl")}>
          {deskText(t, model.claims.map((claim) => (
            <ClaimCard key={claim.claimRef} claim={claim} />
          )))}
        </ul>
      ) : null}
      <h4>{t("sao")}</h4>
      {model.burdens.length === 0 ? <p data-state="empty">{t("sud")}</p> : null}
      {model.burdens.length > 0 ? (
        <ul className="discovery-list" aria-label={t("sap")}>
          {deskText(t, model.burdens.map((burden) => (
            <BurdenCard key={burden.burdenRef} burden={burden} />
          )))}
        </ul>
      ) : null}
      {deskText(t, model.unlinkedLines.map((line) => (
        <p key={line} data-unlinked="true">
          <WordMark word={t("s91")} /> {deskText(t, line)}
        </p>
      )))}
      <h4>{t("s1l7")}</h4>
      {model.cuts.length === 0 ? <p data-state="empty">{t("syo")}</p> : null}
      {model.cuts.length > 0 ? (
        <ScrollTable label={t("s1l7")}>
          <table className="origination-cuts">
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

function ConsentRow({ consent, actions }: { consent: OriginationConsentModel; actions: OriginationActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <li className="discovery-row" data-consent={consent.consentRef} data-state={consent.state} data-purpose={consent.purpose}>
      <p>
        <span className="discovery-badge">{deskText(t, consent.purposeWord)}</span>{" "}
        <span className="discovery-badge" data-consent-state={consent.state}>
          {deskText(t, consent.stateWord)}
        </span>
      </p>
      <h5>{deskText(t, consent.consentRef)}</h5>
      <p>{deskText(t, consent.versionLine)}</p>
      <p>{deskText(t, consent.setLine)}</p>
      <GuardedButton
        id={`origination-renew-${consent.consentRef}`}
        label={t("s1fk", { consentRef: consent.consentRef })}
        control={consent.renew}
        onPress={() => actions.renewConsent(consent.consentRef)}
      />
    </li>
  );
}

function DocumentRow({ document, actions }: { document: OriginationDocumentModel; actions: OriginationActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <li className="discovery-row" data-document={document.documentRef} data-state={document.state} data-kind={document.kind}>
      <p>
        <span className="discovery-badge">{deskText(t, document.kindWord)}</span>{" "}
        <span className="discovery-badge" data-document-state={document.state}>
          {deskText(t, document.stateWord)}
        </span>
      </p>
      <h5>{deskText(t, document.documentRef)}</h5>
      <p>{deskText(t, document.claimLine)}</p>
      <p>{deskText(t, document.expiryLine)}</p>
      <p>{deskText(t, document.verdictLine)}</p>
      <GuardedButton
        id={`origination-provide-${document.documentRef}`}
        label={t("s1a3", { documentRef: document.documentRef })}
        control={document.provide}
        onPress={() => actions.provideDocument(document.documentRef)}
      />
    </li>
  );
}

export function PolicySection({ model, actions }: { model: OriginationModel; actions: OriginationActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="origination-policy" className="discovery-section" aria-label={t("s18n")}>
      <h3>{t("s18n")}</h3>
      <p>{deskText(t, model.policyLine)}</p>
      {deskText(t, model.staleLaneLines.map((line) => (
        <p key={line} data-stale-lane-flag="true">
          <WordMark word={t("s1lh")} /> {deskText(t, line)}
        </p>
      )))}
      <h4>{t("sdy")}</h4>
      {model.consents.length === 0 ? <p data-state="empty">{t("suu")}</p> : null}
      {model.consents.length > 0 ? (
        <ul className="discovery-list" aria-label={t("sdz")}>
          {deskText(t, model.consents.map((consent) => (
            <ConsentRow key={consent.consentRef} consent={consent} actions={actions} />
          )))}
        </ul>
      ) : null}
      <h4>{t("sh1")}</h4>
      {model.documents.length === 0 ? <p data-state="empty">{t("sv5")}</p> : null}
      {model.documents.length > 0 ? (
        <ul className="discovery-list" aria-label={t("sh2")}>
          {deskText(t, model.documents.map((document) => (
            <DocumentRow key={document.documentRef} document={document} actions={actions} />
          )))}
        </ul>
      ) : null}
    </section>
  );
}

export function ReasonsSection({ model }: { model: OriginationModel }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="origination-reasons" className="discovery-section" aria-label={t("s1h2")}>
      <h3>{t("s1d7")}</h3>
      <p className="muted">
        {t("shy")}</p>
      {model.reasons.length === 0 ? <p data-state="empty">{t("sxj")}</p> : null}
      {model.reasons.length > 0 ? (
        <ul className="discovery-list" aria-label={t("s1d8")}>
          {deskText(t, model.reasons.map((reason) => (
            <li key={reason.reasonRef} className="discovery-row" data-reason={reason.reasonRef} data-lane={reason.lane} data-code={reason.code}>
              <p>
                <span className="discovery-badge">{deskText(t, reason.lane)}</span>{" "}
                <span className="discovery-badge" data-reason-code={reason.code}>
                  {deskText(t, reason.code)}
                </span>
              </p>
              <h5>{deskText(t, reason.reasonRef)}</h5>
              <p>{deskText(t, reason.text)}</p>
              <p data-remedy={reason.remedy}>{t("s17b")}{" "}{deskText(t, reason.remedyWord)}.</p>
            </li>
          )))}
        </ul>
      ) : null}
    </section>
  );
}

export function CommitmentSection({ model }: { model: OriginationModel }) {
  const t = useT(copy0, copy1, copy2);
  const commitment = model.commitment;
  const terms = model.terms;
  const drawdown = model.drawdown;
  return (
    <section id="origination-commitment" className="discovery-section" aria-label={t("sdb")}>
      <h3>{t("sdb")}</h3>
      <p className="muted">
        {t("s3h")}</p>
      <h4>{t("sd9")}</h4>
      {commitment === null ? (
        <p data-state="empty" data-commitment="none">
          {t("sut")}</p>
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
              {deskText(t, commitment.stateWord)}
            </span>
          </p>
          <h4>{deskText(t, commitment.commitmentRef)}</h4>
          <p>{deskText(t, commitment.policyLine)}</p>
          {commitment.staleLine ? (
            <p data-stale-lane="commitment">
              <WordMark word={t("s1lh")} /> {deskText(t, commitment.staleLine)}
            </p>
          ) : null}
          {commitment.withheld ? (
            <p data-withheld-line="commitment">
              <WordMark word={t("s26v")} /> {t("s22w")}</p>
          ) : null}
        </div>
      )}
      <h4>{t("s1pl")}</h4>
      {terms === null ? (
        <p data-state="empty" data-terms="none">
          {t("s10w")}</p>
      ) : (
        <div className="discovery-row" data-terms="present" data-stale={terms.staleLine !== null ? "true" : "false"}>
          <p>{deskText(t, terms.policyLine)}</p>
          <p data-rate="copied">{deskText(t, terms.rateLine)}</p>
          {terms.staleLine ? (
            <p data-stale-lane="terms">
              <WordMark word={t("s1lh")} /> {deskText(t, terms.staleLine)}
            </p>
          ) : null}
          {terms.rows.length > 0 ? (
            <ScrollTable label={t("s1ig")}>
              <table className="origination-schedule">
                <caption>{t("s1yj")}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t("so4")}</th>
                    <th scope="col">{t("shj")}</th>
                    <th scope="col">{t("s36")}</th>
                  </tr>
                </thead>
                <tbody>
                  {deskText(t, terms.rows.map((row) => (
                    <tr key={row.installmentLabel} data-schedule={row.installmentLabel}>
                      <th scope="row">{deskText(t, row.installmentLabel)}</th>
                      <td>{deskText(t, row.dueLabel)}</td>
                      <td data-amount="copied">{deskText(t, row.amountLine)}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </ScrollTable>
          ) : (
            <p data-state="empty">{t("syc")}</p>
          )}
        </div>
      )}
      <h4>{t("she")}</h4>
      <div className="discovery-row" data-permission={drawdown.permission} data-withheld={drawdown.withheld ? "true" : "false"}>
        <p>
          <span className="discovery-badge" data-permission-state={drawdown.permission}>
            {deskText(t, drawdown.permissionWord)}
          </span>
        </p>
        <p>{deskText(t, drawdown.commitmentLine)}</p>
        {drawdown.withheld ? (
          <p data-withheld-line="drawdown">
            <WordMark word={t("s26v")} /> {t("s17x")}</p>
        ) : null}
        {deskText(t, drawdown.reasonLines.map((line) => (
          <p key={line} data-drawdown-reason="true">
            {deskText(t, line)}
          </p>
        )))}
        {drawdown.requests.length === 0 ? (
          <p data-state="empty">{t("sv8")}</p>
        ) : (
          <ul className="discovery-list" aria-label={t("s1dw")}>
            {deskText(t, drawdown.requests.map((row) => (
              <li key={row.drawdownRef} data-drawdown={row.drawdownRef}>
                {deskText(t, row.drawdownRef)} — {deskText(t, row.stateWord)}
              </li>
            )))}
          </ul>
        )}
      </div>
      <h4>{t("s1k6")}</h4>
      <div className="discovery-row" data-limit={model.limit.limitRef || "none"} data-contention={model.limit.contention}>
        <p>
          <span className="discovery-badge" data-contention={model.limit.contention}>
            {deskText(t, model.limit.contentionWord)}
          </span>
        </p>
        {model.limit.amountLine ? <p data-amount="copied">{deskText(t, model.limit.amountLine)}</p> : null}
        <p>{deskText(t, model.limit.limitWord)}</p>
        {deskText(t, model.limit.rankLines.map((line) => (
          <p key={line} data-limit-rank="true">
            {deskText(t, line)}
          </p>
        )))}
      </div>
    </section>
  );
}

export function RequestsSection({ model, actions }: { model: OriginationModel; actions: OriginationActions }) {
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="origination-requests" className="discovery-section" aria-label={t("s1fv")}>
      <h3>{t("s1fv")}</h3>
      <p className="muted">
        {t("s6y")}</p>
      <div className="discovery-controls">
        <label htmlFor="origination-amount">
          {t("s1ft")}<input id="origination-amount" name="origination-amount" inputMode="numeric" autoComplete="off" defaultValue="1000" />
        </label>
        <GuardedButton
          id="origination-submit"
          label={t("s1nc")}
          control={model.submitControl}
          onPress={() => actions.submit(amountValue())}
        />
        <GuardedButton
          id="origination-amend"
          label={t("s33")}
          control={model.amendControl}
          onPress={() => actions.amend(amountValue())}
        />
        <GuardedButton
          id="origination-rereview"
          label={t("s86")}
          control={model.rereviewControl}
          onPress={() => actions.rereview()}
        />
        <GuardedButton
          id="origination-accept"
          label={t("se")}
          control={model.acceptControl}
          onPress={() => actions.acceptCommitment()}
        />
        <GuardedButton
          id="origination-drawdown"
          label={t("s1fr")}
          control={model.drawdownControl}
          onPress={() => actions.requestDrawdown()}
        />
      </div>
      {model.last === null ? (
        <p data-state="empty">{t("sxs")}</p>
      ) : (
        <div className="discovery-detail" data-last-request={model.last.seq} data-phase={model.last.phase}>
          <h4>
            {t("s1fq")}{" "}{deskText(t, model.last.seq)}: {deskText(t, model.last.kindWord)}
          </h4>
          <p data-phase-word={model.last.phase}>
            {deskText(t, model.last.phaseWord)}
            {model.last.code ? (" " + t("sd2", { code: model.last.code })) : ""}.
          </p>
          {model.last.detail ? <p className="muted">{deskText(t, model.last.detail)}</p> : null}
          {deskText(t, model.last.receiptLines.map((line) => (
            <p key={line} data-receipt-line="true">
              {deskText(t, line)}
            </p>
          )))}
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
  const t = useT(copy0, copy1, copy2);
  return (
    <section id="origination-session" className="discovery-section" aria-label={t("s1js")}>
      <h3>{t("s1js")}</h3>
      <p>{deskText(t, session.contextLine)}</p>
      <p data-counters="true">{deskText(t, session.countersLine)}</p>
      <p>{deskText(t, session.earlierUnknownLine)}</p>
      <p className="muted">{deskText(t, session.notComposedLine)}</p>
      <p className="muted">{deskText(t, session.holdLine)}</p>
    </section>
  );
}
