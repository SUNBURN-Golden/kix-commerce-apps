import { useReadState } from "../shell/read-state-params";
import { readSettled, ReadView } from "./ReadState";
import { messages as copy0 } from "../i18n/messages/pages--MarketingJourney";
import { messages as copy1 } from "../i18n/messages/marketing-journey";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
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
  const t = useT(copy0, copy1);
  const live = useMarketingJourney();
  const model = live.model;
  const read = useReadState("marketing-journey", { benefit:  !readSettled(model.state) ? null : model.benefits.map((row) => row.benefitRef) });
  // A block, a rejection, an unknown result, or a refused read takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "mkj-status");

  return (
    <ReadView state={read}>
    <div className="discovery mkj" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label={t("srw")}>
        <a href="#mkj-controls">{t("sed")}</a>
        <a href="#mkj-status">{t("s1mj")}</a>
        <a href="#mkj-lanes">{t("s1lg")}</a>
        <a href="#mkj-consent">{t("sdo")}</a>
        <a href="#mkj-benefits">{t("s9v")}</a>
        <a href="#mkj-orders">{t("s15v")}</a>
        <a href="#mkj-rejections">{t("s1ew")}</a>
        <a href="#mkj-session">{t("s1js")}</a>
        <a href="#mkj-register">{t("sec")}</a>
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
            {deskText(t, model.actionLabel)}
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
    </ReadView>
  );
}
