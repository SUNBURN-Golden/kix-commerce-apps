/** Gated test fixture; ordinary fault-origin visits still render the real notification screen. */
import { NotificationsPage as RealNotificationsPage } from "../../web/src/pages/Notifications";
import { PaginationNotifications } from "./notifications-pagination";

export function NotificationsPage() {
  return window.__kixNotificationPagination ? <PaginationNotifications /> : <RealNotificationsPage />;
}
