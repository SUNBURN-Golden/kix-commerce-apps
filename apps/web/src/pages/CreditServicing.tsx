import { messages as copy0 } from "../i18n/messages/pages--CreditServicing";
import { messages as copy1 } from "../i18n/messages/credit-servicing";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { useRestoreFocus } from "../a11y/focus";
import { useCreditServicing } from "../credit-servicing";
import {
  CaseSection,
  DrawSection,
  PaymentsSection,
  ScheduleSection,
  ServicingBanner,
  ServicingControls,
  ServicingReasonsSection,
  ServicingRequestsSection,
  ServicingSessionSection,
  ServicingStatus,
  TimelineSection,
} from "./CreditServicingPanels";

export function CreditServicingPage() {
  const t = useT(copy0, copy1);
  const live = useCreditServicing();
  const model = live.model;
  // A block, a refusal, or an unknown result takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "servicing-status");

  return (
    <div className="discovery servicing" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label={t("s1jk")}>
        <a href="#servicing-controls">{t("sed")}</a>
        <a href="#servicing-status">{t("s1mj")}</a>
        <a href="#servicing-draw">{t("shd")}</a>
        <a href="#servicing-schedule">{t("s1ie")}</a>
        <a href="#servicing-payments">{t("s17k")}</a>
        <a href="#servicing-case">{t("sbe")}</a>
        <a href="#servicing-timeline">{t("s248")}</a>
        <a href="#servicing-reasons">{t("s1d6")}</a>
        <a href="#servicing-requests">{t("s1fv")}</a>
        <a href="#servicing-session">{t("s1js")}</a>
      </nav>
      <div className="discovery-body">
        <ServicingBanner environment={live.environment} scenario={live.scenario} model={model} />
        <ServicingControls scenario={live.scenario} actorRef={live.actorRef} actions={live.actions} />
        <ServicingStatus model={model} />
        {model.actionLabel ? (
          <button
            type="button"
            id="servicing-return-action"
            className="discovery-action"
            onClick={() => (model.state === "tuple-changed" ? live.actions.newSession() : live.actions.refresh())}
          >
            {deskText(t, model.actionLabel)}
          </button>
        ) : null}
        <DrawSection model={model} />
        <ScheduleSection model={model} />
        <PaymentsSection model={model} actions={live.actions} />
        <CaseSection model={model} actions={live.actions} />
        <TimelineSection model={model} />
        <ServicingReasonsSection model={model} />
        <ServicingRequestsSection model={model} actions={live.actions} />
        <ServicingSessionSection session={model.session} />
      </div>
    </div>
  );
}
