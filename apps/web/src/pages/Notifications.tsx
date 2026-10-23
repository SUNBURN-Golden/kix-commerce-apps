import { messages as copy0 } from "../i18n/messages/pages--Notifications";
import { messages as copy1 } from "../i18n/messages/notification-inbox";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
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
  const t = useT(copy0, copy1);
  const live = useNotificationInbox();
  const model = live.model;
  // A block, a refusal, a denial, a read that did not answer, or an unknown result takes focus to the status region.
  useRestoreFocus(model.focusToken, "notify-status");

  return (
    <div className="discovery platform finance" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label={t("s11r")}>
        <a href="#notify-controls">{t("sed")}</a>
        <a href="#notify-status">{t("s1mj")}</a>
        <a href="#notify-authority">{t("s26m")}</a>
        <a href="#notify-inbox">{t("snt")}</a>
        <a href="#notify-inquiry">{t("s1nm")}</a>
        <a href="#notify-requests">{t("s1fv")}</a>
        <a href="#notify-session">{t("s1js")}</a>
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
            {deskText(t, model.actionLabel)}
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
