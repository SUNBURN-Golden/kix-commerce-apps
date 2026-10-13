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
  const live = useCreditServicing();
  const model = live.model;
  // A block, a refusal, or an unknown result takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "servicing-status");

  return (
    <div className="discovery servicing" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label="Servicing sections">
        <a href="#servicing-controls">Controls</a>
        <a href="#servicing-status">Status</a>
        <a href="#servicing-draw">Draw and exposure</a>
        <a href="#servicing-schedule">Schedule</a>
        <a href="#servicing-payments">Payments</a>
        <a href="#servicing-case">Case</a>
        <a href="#servicing-timeline">Timeline</a>
        <a href="#servicing-reasons">Reasons</a>
        <a href="#servicing-requests">Requests</a>
        <a href="#servicing-session">Session record</a>
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
            {model.actionLabel}
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
