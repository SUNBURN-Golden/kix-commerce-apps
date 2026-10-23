import { messages as copy0 } from "../i18n/messages/pages--ProviderJourney";
import { messages as copy1 } from "../i18n/messages/provider-journey";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
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
  const t = useT(copy0, copy1);
  const live = useProviderJourney();
  const model = live.model;
  // A block, a rejection, or an unknown result takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "provider-status");

  return (
    <div className="discovery provider" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label={t("s1a8")}>
        <a href="#provider-controls">{t("sed")}</a>
        <a href="#provider-status">{t("s1mj")}</a>
        <a href="#provider-orders">{t("s15u")}</a>
        <a href="#provider-session">{t("s1js")}</a>
        <a href="#provider-identity">{t("snr")}</a>
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
            {deskText(t, model.actionLabel)}
          </button>
        ) : null}
        <OrdersSection model={model} actions={live.actions} />
        <SessionSection session={model.session} />
        <IdentitySection rows={model.identity} />
      </div>
    </div>
  );
}
