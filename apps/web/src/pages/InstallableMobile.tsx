import { messages as copy0 } from "../i18n/messages/pages--InstallableMobile";
import { messages as copy1 } from "../i18n/messages/installable-mobile";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
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
  const t = useT(copy0, copy1);
  const live = useMobileShell();
  const model = live.model;
  // A block, a rejection, or an unknown result takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "mobile-status");

  return (
    <div className="discovery mobile-shell" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label={t("sso")}>
        <a href="#mobile-controls">{t("sed")}</a>
        <a href="#mobile-status">{t("s1mj")}</a>
        <a href="#mobile-device">{t("sqv")}</a>
        <a href="#mobile-install">{t("snz")}</a>
        <a href="#mobile-session">{t("s1jl")}</a>
        <a href="#mobile-vault">{t("s1ms")}</a>
        <a href="#mobile-order">{t("s17r")}</a>
        <a href="#mobile-support">{t("s1no")}</a>
        <a href="#mobile-record">{t("s1js")}</a>
        <a href="#mobile-identity">{t("snr")}</a>
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
            {deskText(t, model.actionLabel)}
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
