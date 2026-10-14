import { useRestoreFocus } from "../a11y/focus";
import { useProviderJourney } from "../provider-journey";
import {
  IdentitySection,
  OrdersSection,
  ProviderBanner,
  ProviderControls,
  ProviderStatus,
  SessionSection,
} from "./ProviderJourneyPanels";

export function ProviderJourneyPage() {
  const live = useProviderJourney();
  const model = live.model;
  // A block, a rejection, or an unknown result takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "provider-status");

  return (
    <div className="discovery provider" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label="Provider sections">
        <a href="#provider-controls">Controls</a>
        <a href="#provider-status">Status</a>
        <a href="#provider-orders">Orders</a>
        <a href="#provider-session">Session record</a>
        <a href="#provider-identity">Identity links</a>
      </nav>
      <div className="discovery-body">
        <ProviderBanner environment={live.environment} scenario={live.scenario} model={model} />
        <ProviderControls
          scenario={live.scenario}
          heldSupported={live.heldSupported}
          lateSupported={live.lateSupported}
          actions={live.actions}
        />
        <ProviderStatus model={model} />
        {model.actionLabel ? (
          <button
            type="button"
            id="provider-return-action"
            className="discovery-action"
            onClick={() =>
              model.state === "tuple-changed" || model.state === "refused" || model.state === "environment-refused"
                ? live.actions.newSession()
                : live.actions.refresh()
            }
          >
            {model.actionLabel}
          </button>
        ) : null}
        <OrdersSection model={model} actions={live.actions} />
        <SessionSection session={model.session} />
        <IdentitySection rows={model.identity} />
      </div>
    </div>
  );
}
