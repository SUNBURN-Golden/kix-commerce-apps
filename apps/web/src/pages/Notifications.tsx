import { useRestoreFocus } from "../a11y/focus";
import { useNotificationInbox } from "../notification-inbox";
import {
  NotifyAuthoritySection,
  NotifyBanner,
  NotifyControls,
  NotifyFocusSection,
  NotifyInboxSection,
  NotifyInquirySection,
  NotifyRequestsSection,
  NotifySessionSection,
  NotifyStatus,
} from "./NotificationsPanels";

export function NotificationsPage() {
  const live = useNotificationInbox();
  const model = live.model;
  // A block, a refusal, a denial, a read that did not answer, or an unknown result takes focus to the status region.
  useRestoreFocus(model.focusToken, "notify-status");

  return (
    <div className="discovery platform finance" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label="Notification inbox sections">
        <a href="#notify-controls">Controls</a>
        <a href="#notify-status">Status</a>
        <a href="#notify-authority">Who may do what</a>
        <a href="#notify-inbox">Inbox</a>
        <a href="#notify-inquiry">Support material</a>
        <a href="#notify-requests">Requests</a>
        <a href="#notify-session">Session record</a>
      </nav>
      <div className="discovery-body">
        <NotifyBanner environment={live.environment} scenario={live.scenario} model={model} />
        <NotifyControls scenario={live.scenario} actorRef={live.actorRef} role={live.role} actions={live.actions} />
        <NotifyStatus model={model} />
        {model.actionLabel ? (
          <button
            type="button"
            id="notify-return-action"
            className="discovery-action"
            onClick={() => (model.state === "tuple-changed" || model.state === "generation-stale" ? live.actions.newSession() : live.actions.refresh())}
          >
            {model.actionLabel}
          </button>
        ) : null}
        <NotifyAuthoritySection model={model} />
        <NotifyFocusSection model={model} />
        <NotifyInboxSection model={model} actions={live.actions} />
        <NotifyInquirySection model={model} actions={live.actions} />
        <NotifyRequestsSection model={model} />
        <NotifySessionSection session={model.session} />
      </div>
    </div>
  );
}
