import { SERVICING_LANES } from "@kix/protocol-adapter";
import { useReadState } from "../shell/read-state-params";
import { readSettled, ReadView, ReadFilter, ReadObligation, ReadLane } from "./ReadState";
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
  const read = useReadState("credit-servicing", { lane: SERVICING_LANES, obligation:  !readSettled(model.state) ? null : model.draw || model.installments.length || model.servicingCase ? [live.obligationRef] : [] });
  // A block, a refusal, or an unknown result takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "servicing-status");

  return (
    <ReadView state={read}>
    <ReadFilter state={read} name="lane" options={SERVICING_LANES} />
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
        <ReadObligation value={live.obligationRef}><DrawSection model={model} />
        <ReadLane lane="schedule"><ScheduleSection model={model} /></ReadLane>
        <ReadLane lane="payment"><PaymentsSection model={model} actions={live.actions} /></ReadLane>
        <CaseSection model={model} actions={live.actions} />
        </ReadObligation>
        <TimelineSection model={model} />
        <ServicingReasonsSection model={model} />
        <ServicingRequestsSection model={model} actions={live.actions} />
        <ServicingSessionSection session={model.session} />
      </div>
    </div>
    </ReadView>
  );
}
