import { useRestoreFocus } from "../a11y/focus";
import { useCreditOrigination } from "../credit-origination";
import {
  ApplicationSection,
  BasisSection,
  CommitmentSection,
  OriginationBanner,
  OriginationControls,
  OriginationSessionSection,
  OriginationStatus,
  PolicySection,
  ReasonsSection,
  RequestsSection,
} from "./CreditOriginationPanels";

export function CreditOriginationPage() {
  const live = useCreditOrigination();
  const model = live.model;
  // A block, a refusal, or an unknown result takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "origination-status");

  return (
    <div className="discovery origination" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label="Origination sections">
        <a href="#origination-controls">Controls</a>
        <a href="#origination-status">Status</a>
        <a href="#origination-application">Application and review</a>
        <a href="#origination-basis">Claim basis</a>
        <a href="#origination-policy">Policy and consents</a>
        <a href="#origination-reasons">Reasons and paths</a>
        <a href="#origination-commitment">Commitment and drawdown</a>
        <a href="#origination-requests">Requests</a>
        <a href="#origination-session">Session record</a>
      </nav>
      <div className="discovery-body">
        <OriginationBanner environment={live.environment} scenario={live.scenario} model={model} />
        <OriginationControls scenario={live.scenario} actions={live.actions} />
        <OriginationStatus model={model} />
        {model.actionLabel ? (
          <button
            type="button"
            id="origination-return-action"
            className="discovery-action"
            onClick={() => (model.state === "tuple-changed" ? live.actions.newSession() : live.actions.refresh())}
          >
            {model.actionLabel}
          </button>
        ) : null}
        <ApplicationSection model={model} />
        <BasisSection model={model} />
        <PolicySection model={model} actions={live.actions} />
        <ReasonsSection model={model} />
        <CommitmentSection model={model} />
        <RequestsSection model={model} actions={live.actions} />
        <OriginationSessionSection session={model.session} />
      </div>
    </div>
  );
}
