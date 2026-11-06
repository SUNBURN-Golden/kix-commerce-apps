/** Test-only synthetic snapshots; never imported into the product bundle. */
import {
  NOTIFY_BUYER_ACTOR, NotificationInboxController, createStubNotificationInbox, refuseNotifySnapshot,
  type NotificationInboxPort, type NotifyScenario,
} from "@kix/protocol-adapter";
import { buildNotifyModel, type NotifyActions } from "../../src/notification-inbox";

export function notificationFixture(count = 105, scenario: NotifyScenario = "clean", allUnread = false) {
  const source = createStubNotificationInbox({ scenario });
  let size = count;
  let reversed = false;
  const calls = { read: 0, act: 0, inquiry: 0 };
  const port: NotificationInboxPort = {
    environment: source.environment, source: source.source, scenario,
    async read(request) {
      calls.read++;
      const outcome = await source.read(request);
      if (outcome.kind !== "ready") return outcome;
      const base = outcome.snapshot;
      // Keep ntf-0001 last so action tests delegate to a real synthetic source row.
      const notifications = Array.from({ length: size }, (_, index) => {
        const template = base.notifications[index % base.notifications.length]!;
        const last = index === size - 1;
        return { ...template, notificationRef: last ? "ntf-0001" : `ntf-${String(index + 1001).padStart(4, "0")}`,
          dedupeKey: `pagination:${index}`, seq: index + 1,
          read: last ? base.notifications[0]!.read : allUnread ? false : index % 3 === 0,
          ...(last ? { ...base.notifications[0], seq: index + 1, dedupeKey: `pagination:${index}` } : {}),
          ...(!last && index % 11 === 0 ? { issueState: "stale-issue" as const, issueGeneration: 0 } : {}),
        };
      });
      if (reversed) notifications.reverse();
      const snapshot = { ...base, notifications, unreadCount: notifications.filter((row) => !row.read).length };
      const refusal = refuseNotifySnapshot(snapshot);
      if (refusal) throw new Error(`Invalid notification fixture: ${JSON.stringify(refusal)}`);
      return { ...outcome, snapshot };
    },
    async act(request) { calls.act++; return source.act(request); },
    async readInquiry(request) { calls.inquiry++; return source.readInquiry(request); },
    synthetic(control, ref) { return source.synthetic(control, ref); },
  };
  const controller = new NotificationInboxController(port, { actorRef: NOTIFY_BUYER_ACTOR, role: "buyer" });
  const actions: NotifyActions = {
    refresh: () => { void controller.read(); }, openNotification: (ref) => { void controller.read(ref); },
    markRead: (ref) => { void controller.markRead(ref); }, resolveAction: (ref) => { void controller.resolveAction(ref); },
    loadInquiry: (ref) => { void controller.loadInquiry(ref); },
    switchRole() {}, switchActor() {}, switchTenant() {}, revokeGrant() {}, rotateGrant() {}, deliverLate() {}, setScenario() {}, newSession() {},
  };
  return { source, controller, calls, actions,
    resize(next: number) { size = next; },
    reverse() { reversed = !reversed; },
    live() { return { environment: "stub" as const, scenario, actorRef: NOTIFY_BUYER_ACTOR, role: "buyer" as const,
      model: buildNotifyModel({ controller, last: null }), actions }; },
  };
}
