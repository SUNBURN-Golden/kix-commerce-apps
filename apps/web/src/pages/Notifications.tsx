import { useContext, useState } from "react";
import { UNSAFE_LocationContext } from "react-router-dom";
import { buildNotificationPage, filterNotificationRows, notificationPageForItem, type NotificationFilter } from "../notification-pagination";
import { useReadState } from "../shell/read-state-params";
import { readSettled, ReadView, ReadFilter } from "./ReadState";
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
  return <NotificationsScreen live={useNotificationInbox()} />;
}

export function NotificationsScreen({ live }: { live: ReturnType<typeof useNotificationInbox> }) {
  const t = useT(copy0, copy1);
  const location = useContext(UNSAFE_LocationContext)?.location;
  const model = live.model;
  const rowsFor = (filter?: string) => filterNotificationRows(model.rows, (filter ?? "all") as NotificationFilter);
  const read = useReadState("notifications", { filter: ["all", "unread", "read"], item: (values) =>  !readSettled(model.state) ? null : rowsFor(values.filter).map((row) => row.notificationRef) });
  const filter = (read.values.filter ?? "all") as NotificationFilter;
  const filtered = rowsFor(filter);
  // References/order, URL visits and selection drive restoration; model allocation does not.
  const [position, setPosition] = useState({ key: "", filter, page: 1 });
  // A pending read temporarily hides validated selection. Restore only after membership settles.
  const key = readSettled(model.state)
    ? JSON.stringify([location?.key, filter, read.values.item, filtered.map((row) => row.notificationRef)])
    : position.key;
  const requested = key === position.key && position.page !== 0 ? position.page
    : notificationPageForItem(filtered, read.values.item) ?? (filter === position.filter ? position.page : 1);
  const page = buildNotificationPage(model.rows, { filter, page: requested });
  // Commit normalization, including zero, so a later growing snapshot cannot resurrect an old page.
  if (key !== position.key || position.page !== page.page) setPosition({ key, filter, page: page.page });
  // A block, a refusal, a denial, a read that did not answer, or an unknown result takes focus to the status region.
  useRestoreFocus(model.focusToken, "notify-status");

  return (
    <ReadView state={read}>
    <ReadFilter state={read} name="filter" options={["all", "unread", "read"]} />
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
        <NotifyInboxSection model={model} actions={live.actions} page={page} onPageChange={(next) => setPosition({ key, filter, page: next })} />
        <NotifyInquirySection model={model} actions={live.actions} />
        <NotifyRequestsSection model={model} />
        <NotifySessionSection session={model.session} />
      </div>
    </div>
    </ReadView>
  );
}
