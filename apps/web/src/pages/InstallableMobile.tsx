import { useRestoreFocus } from "../a11y/focus";
import { useMobileShell } from "../installable-mobile";
import {
  DeviceSection,
  IdentitySection,
  InstallSection,
  MobileBanner,
  MobileControls,
  MobileStatus,
  OrderSection,
  RecordSection,
  SessionSection,
  SupportSection,
  VaultSection,
} from "./InstallableMobilePanels";

export function InstallableMobilePage() {
  const live = useMobileShell();
  const model = live.model;
  // A block, a rejection, or an unknown result takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "mobile-status");

  return (
    <div className="discovery mobile-shell" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label="Mobile shell sections">
        <a href="#mobile-controls">Controls</a>
        <a href="#mobile-status">Status</a>
        <a href="#mobile-device">Link and clock</a>
        <a href="#mobile-install">Install</a>
        <a href="#mobile-session">Session</a>
        <a href="#mobile-vault">Stored items</a>
        <a href="#mobile-order">Pending order</a>
        <a href="#mobile-support">Support range</a>
        <a href="#mobile-record">Session record</a>
        <a href="#mobile-identity">Identity links</a>
      </nav>
      <div className="discovery-body">
        <MobileBanner environment={live.environment} scenario={live.scenario} model={model} />
        <MobileControls scenario={live.scenario} clockMode={live.clockMode} actions={live.actions} />
        <MobileStatus model={model} />
        {model.actionLabel ? (
          <button
            type="button"
            id="mobile-return-action"
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
        <DeviceSection device={model.device} />
        <InstallSection install={model.install} actions={live.actions} />
        <SessionSection session={model.session} actions={live.actions} />
        <VaultSection model={model} actions={live.actions} />
        <OrderSection order={model.order} actions={live.actions} />
        <SupportSection support={model.support} />
        <RecordSection record={model.record} />
        <IdentitySection rows={model.identity} />
      </div>
    </div>
  );
}
