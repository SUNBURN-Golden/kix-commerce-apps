/** Large snapshots are available only in the test fault build under an explicit flag. */
import { useEffect, useState } from "react";
import { NotificationsScreen } from "../../web/src/pages/Notifications";
import { notificationFixture } from "../../web/test/support/notification-pagination-fixture";

declare global {
  interface Window {
    __kixNotificationPagination?: boolean;
    __kixNotificationChange?: (count: number, allUnread?: boolean) => void;
  }
}

export function PaginationNotifications() {
  const [fixture, setFixture] = useState(() => notificationFixture());
  const [, tick] = useState(0);
  useEffect(() => {
    const off = fixture.controller.subscribe(() => tick((value) => value + 1));
    void fixture.controller.read();
    window.__kixNotificationChange = (count, allUnread) => {
      if (allUnread !== undefined) setFixture(notificationFixture(count, "clean", allUnread));
      else { fixture.resize(count); void fixture.controller.read(); }
    };
    return () => { off(); delete window.__kixNotificationChange; };
  }, [fixture]);
  return <NotificationsScreen live={fixture.live()} />;
}
