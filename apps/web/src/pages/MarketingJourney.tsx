import { useRestoreFocus } from "../a11y/focus";
import { useMarketingJourney } from "../marketing-journey";
import {
  BenefitsSection,
  ConsentSection,
  LanesSection,
  MarketingBanner,
  MarketingControls,
  MarketingStatus,
  OrdersSection,
  RegisterSection,
  RejectionsSection,
  SessionSection,
} from "./MarketingJourneyPanels";

export function MarketingJourneyPage() {
  const live = useMarketingJourney();
  const model = live.model;
  // A block, a rejection, an unknown result, or a refused read takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "mkj-status");

  return (
    <div className="discovery mkj" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label="Marketing journey sections">
        <a href="#mkj-controls">Controls</a>
        <a href="#mkj-status">Status</a>
        <a href="#mkj-lanes">Stages</a>
        <a href="#mkj-consent">Consent</a>
        <a href="#mkj-benefits">Benefits</a>
        <a href="#mkj-orders">Orders and applications</a>
        <a href="#mkj-rejections">Rejected</a>
        <a href="#mkj-session">Session record</a>
        <a href="#mkj-register">Contract register</a>
      </nav>
      <div className="discovery-body">
        <MarketingBanner environment={live.environment} scenario={live.scenario} model={model} />
        <MarketingControls
          environment={live.environment}
          scenario={live.scenario}
          heldSupported={live.heldSupported}
          subjectRef={model.subjectRef}
          actions={live.actions}
        />
        <MarketingStatus model={model} />
        {model.actionLabel ? (
          <button
            type="button"
            id="mkj-return-action"
            className="discovery-action"
            onClick={() => (model.state === "tuple-changed" ? live.actions.newSession() : live.actions.refresh())}
          >
            {model.actionLabel}
          </button>
        ) : null}
        <LanesSection model={model} />
        <ConsentSection model={model} />
        <BenefitsSection model={model} actions={live.actions} />
        <OrdersSection model={model} environment={live.environment} actions={live.actions} />
        <RejectionsSection model={model} actions={live.actions} />
        <SessionSection session={model.session} />
        <RegisterSection model={model} />
      </div>
    </div>
  );
}
