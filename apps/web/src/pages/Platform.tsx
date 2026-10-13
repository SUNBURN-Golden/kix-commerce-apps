import { useRestoreFocus } from "../a11y/focus";
import { usePlatformJourney } from "../platform-journey";
import {
  IdentitySection,
  PlatformBanner,
  PlatformControls,
  PlatformStatus,
  RightsSection,
  SessionSection,
  TradesSection,
} from "./PlatformPanels";

export function PlatformPage() {
  const live = usePlatformJourney();
  const model = live.model;
  // A block, a rejection, or an unknown result takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "platform-status");

  return (
    <div className="discovery platform" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label="Platform sections">
        <a href="#platform-controls">Controls</a>
        <a href="#platform-status">Status</a>
        <a href="#platform-rights">Rights and listings</a>
        <a href="#platform-trades">Trades</a>
        <a href="#platform-session">Session record</a>
        <a href="#platform-identity">Identity links</a>
      </nav>
      <div className="discovery-body">
        <PlatformBanner environment={live.environment} scenario={live.scenario} model={model} />
        <PlatformControls
          scenario={live.scenario}
          heldSupported={live.heldSupported}
          lateSupported={live.lateSupported}
          actions={live.actions}
        />
        <PlatformStatus model={model} />
        {model.actionLabel ? (
          <button
            type="button"
            id="platform-return-action"
            className="discovery-action"
            onClick={() => (model.state === "tuple-changed" ? live.actions.newSession() : live.actions.refresh())}
          >
            {model.actionLabel}
          </button>
        ) : null}
        <RightsSection model={model} actions={live.actions} />
        <TradesSection model={model} actions={live.actions} />
        <SessionSection session={model.session} />
        <IdentitySection rows={model.identity} />
      </div>
    </div>
  );
}
