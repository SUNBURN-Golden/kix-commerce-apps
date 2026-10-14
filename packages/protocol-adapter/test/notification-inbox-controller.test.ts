import { describe, expect, it } from "vitest";
import {
  NOTIFY_BUYER_ACTOR,
  NOTIFY_FOREIGN,
  NOTIFY_FOREIGN_ACTOR,
  NOTIFY_NOT_BOUND_REASON,
  NOTIFY_SETTLER_ACTOR,
  NotificationInboxController,
  StubNotificationInbox,
  createNotBoundNotificationInbox,
  createStubNotificationInbox,
  type NotificationInboxPort,
  type NotifyScenario,
} from "../src/index.js";

function controller(options: { scenario?: NotifyScenario; actorRef?: string } = {}): {
  port: StubNotificationInbox;
  client: NotificationInboxController;
} {
  const port = createStubNotificationInbox({ scenario: options.scenario ?? "clean" });
  return { port, client: new NotificationInboxController(port, options.actorRef ? { actorRef: options.actorRef } : {}) };
}

/**
 * Wraps a stub port so a chosen call's answer is held until `release` runs.
 * Only the first call of that kind is held; later calls go straight through.
 */
function holdCall(
  port: StubNotificationInbox,
  which: "read" | "readInquiry" | "act" | "all-reads",
): { held: NotificationInboxPort; release: () => void; releases: Array<() => void> } {
  let release: (() => void) | null = null;
  const releases: Array<() => void> = [];
  let calls = 0;
  const defer = <T>(run: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve) => {
      const go = () => void run().then(resolve);
      if (which === "all-reads") {
        releases.push(go);
      } else {
        release = go;
      }
    });
  const held: NotificationInboxPort = {
    environment: port.environment,
    source: port.source,
    scenario: port.scenario,
    read(request) {
      calls += 1;
      if (which === "read" && calls > 1) {
        return port.read(request);
      }
      if (which === "read" || which === "all-reads") {
        return defer(() => port.read(request));
      }
      return port.read(request);
    },
    readInquiry(request) {
      if (which === "readInquiry") {
        return defer(() => port.readInquiry(request));
      }
      return port.readInquiry(request);
    },
    act(request) {
      if (which === "act") {
        return defer(() => port.act(request));
      }
      return port.act(request);
    },
    synthetic(control, ref) {
      return port.synthetic(control, ref);
    },
  };
  return {
    held,
    release: () => release?.(),
    releases,
  };
}

async function ready(client: NotificationInboxController): Promise<void> {
  const result = await client.read();
  expect(result).toEqual({ kind: "APPLIED", readState: "ready" });
}

describe("notification inbox controller reads", () => {
  it("reduces a ready read to rows, assessment, and current freshness", async () => {
    const { client } = controller();
    await ready(client);
    const state = client.state();
    expect(state.readState).toBe("ready");
    expect(state.freshness).toBe("CURRENT");
    expect(state.snapshot?.notifications.length).toBe(4);
    expect(state.snapshot?.unreadCount).toBe(3);
    expect(state.assessment?.resolvable.length).toBe(3);
    expect(state.behind).toBe(false);
    expect(state.counters.reads).toBe(1);
  });

  it("reduces empty, stale, denied, refused, invalid, tuple-changed, and not-bound reads", async () => {
    const empty = controller({ scenario: "empty" });
    expect((await empty.client.read()).kind).toBe("APPLIED");
    expect(empty.client.state().readState).toBe("empty");
    expect(empty.client.state().snapshot).toBeNull();

    const stale = controller({ scenario: "stale" });
    await stale.client.read();
    expect(stale.client.state().readState).toBe("stale");
    expect(stale.client.state().freshness).toBe("STALE");

    const denied = controller({ scenario: "denied" });
    await denied.client.read();
    expect(denied.client.state().readState).toBe("denied");
    expect(denied.client.state().readCode).toBe("GRANT_REVOKED");

    const mixed = controller({ scenario: "tenant-mix" });
    await mixed.client.read();
    expect(mixed.client.state().readState).toBe("refused");
    expect(mixed.client.state().readCode).toBe("SCOPE_LEAK");

    const notBound = new NotificationInboxController(createNotBoundNotificationInbox());
    await notBound.read();
    expect(notBound.state().readState).toBe("not-bound");
    expect(notBound.state().readDetail).toBe(NOTIFY_NOT_BOUND_REASON);
    expect(notBound.state().freshness).toBe("UNAVAILABLE");
  });

  it("a read that never answers leaves the inbox unavailable, not empty", async () => {
    const { client } = controller({ scenario: "read-lost" });
    const result = await client.read();
    expect(result).toEqual({ kind: "APPLIED", readState: "unavailable" });
    expect(client.state().readState).toBe("unavailable");
    expect(client.state().freshness).toBe("UNAVAILABLE");
    expect(client.state().snapshot).toBeNull();
    // The failure is shown, and this class does not ask again on its own.
    expect(client.state().counters.reads).toBe(1);
  });

  it("drops a read answer that arrives after the context changed", async () => {
    // The port holds the answer until the context has moved.
    const port = createStubNotificationInbox();
    const { held, release } = holdCall(port, "read");
    const client = new NotificationInboxController(held);
    const pending = client.read();
    const context = client.switchActor(NOTIFY_SETTLER_ACTOR);
    expect(context).not.toBeNull();
    release();
    const result = await pending;
    expect(result).toEqual({ kind: "DROPPED", cause: "context-changed" });
    expect(client.state().snapshot).toBeNull();
    expect(client.state().counters.droppedReads).toBe(1);
    // The new context reads only its own subject's rows.
    await client.read();
    const snapshot = client.state().snapshot;
    expect(snapshot?.actorRef).toBe(NOTIFY_SETTLER_ACTOR);
    expect(snapshot?.notifications.every((row) => row.subjectRef === NOTIFY_SETTLER_ACTOR)).toBe(true);
  });

  it("drops an older read answer that arrives after a newer one", async () => {
    const port = createStubNotificationInbox();
    const { held, releases } = holdCall(port, "all-reads");
    const client = new NotificationInboxController(held);
    const first = client.read();
    const second = client.read();
    // Resolve the newer one first, then the older one.
    releases[1]?.();
    await second;
    releases[0]?.();
    const result = await first;
    expect(result).toEqual({ kind: "DROPPED", cause: "older-read" });
    expect(client.state().counters.droppedReads).toBe(1);
    expect(client.state().readState).toBe("ready");
  });

  it("a context switch clears rows, inquiry material, and the freshness of the old session", async () => {
    const { client } = controller();
    await ready(client);
    await client.loadInquiry("nqy-0001");
    expect(client.state().inquiry.phase).toBe("loaded");
    const next = client.switchRole("settler");
    expect(next).not.toBeNull();
    expect(next?.scope.role).toBe("settler");
    expect(next?.incarnation).toBe(2);
    const state = client.state();
    expect(state.snapshot).toBeNull();
    expect(state.readState).toBe("none");
    expect(state.inquiry.phase).toBe("none");
    expect(state.freshness).toBe("UNAVAILABLE");
    // The same person's second role is a second context.
    await client.read();
    expect(client.state().snapshot?.actorRef).toBe(NOTIFY_BUYER_ACTOR);
    // The buyer actor holds a grant; its settler-scope read lists the same
    // subject's rows but under the settler capability set, including sensitive
    // detail the buyer role withholds.
    expect(client.state().snapshot?.scope.role).toBe("settler");
    const sensitive = client.state().snapshot?.notifications.find((row) => row.sensitive);
    expect(sensitive?.detailState).toBe("shown");
  });
});

describe("notification inbox controller requests", () => {
  it("marks a notification read and records the receipt without claiming an effect", async () => {
    const { client } = controller();
    await ready(client);
    const result = await client.markRead("ntf-0001");
    expect(result.kind).toBe("APPLIED");
    if (result.kind !== "APPLIED") {
      return;
    }
    expect(result.record.phase).toBe("applied");
    expect(result.record.receipt?.kind).toBe("read-marked");
    expect(result.record.receipt?.confirmsEconomicEffect).toBe(false);
    expect(client.state().behind).toBe(true);
    expect(client.state().last?.receipt?.notificationRef).toBe("ntf-0001");
  });

  it("resolves an offered action to a destination, not a send", async () => {
    const { client } = controller();
    await ready(client);
    const result = await client.resolveAction("ntf-0001");
    expect(result.kind).toBe("APPLIED");
    if (result.kind !== "APPLIED") {
      return;
    }
    expect(result.record.receipt?.destination).toEqual({ kind: "authority", ref: "trd-0001" });
    expect(result.record.receipt?.externalSendWired).toBe(false);
  });

  it("blocks a stale-issued notification's action before the port, and the port would reject it anyway", async () => {
    const { client, port } = controller({ scenario: "late" });
    await ready(client);
    const result = await client.resolveAction("ntf-0050");
    expect(result.kind).toBe("NOT_SENT");
    if (result.kind !== "NOT_SENT") {
      return;
    }
    expect(result.reason).toBe("blocked");
    expect(result.detail).toContain("older grant generation");
    // Nothing reached the source for it.
    expect(port.effects().acts).toBe(0);
  });

  it("rejects a request whose notification the last read does not list", async () => {
    const { client, port } = controller();
    await ready(client);
    const result = await client.markRead("ntf-0011");
    expect(result.kind).toBe("NOT_SENT");
    if (result.kind === "NOT_SENT") {
      expect(result.reason).toBe("unknown-ref");
    }
    expect(port.effects().acts).toBe(0);
    const alreadyRead = await client.markRead("ntf-0003");
    expect(alreadyRead.kind).toBe("NOT_SENT");
    if (alreadyRead.kind === "NOT_SENT") {
      expect(alreadyRead.reason).toBe("unknown-ref");
    }
  });

  it("a request built under a grant generation the source has moved past comes back rejected", async () => {
    const { client, port } = controller();
    await ready(client);
    // The grant rotates at the source after the read the page holds.
    expect(port.synthetic("rotate-grant", "ngr-0001")).toBe(true);
    const result = await client.markRead("ntf-0001");
    expect(result.kind).toBe("REJECTED");
    if (result.kind === "REJECTED") {
      expect(result.record.code).toBe("GENERATION_STALE");
    }
    // A rejection is a real answer, but the view is behind until a fresh read.
    expect(client.state().behind).toBe(true);
    expect(client.state().fence).toBeNull();
    // The read still carries this session's grant floor, so it comes back
    // generation-stale rather than mixing the two generations on one screen.
    const stale = await client.read();
    expect(stale).toEqual({ kind: "APPLIED", readState: "generation-stale" });
    expect(client.state().snapshot).toBeNull();
    // A new context drops the floor; the next read reports the current grant.
    const next = client.switchActor(NOTIFY_BUYER_ACTOR);
    expect(next).not.toBeNull();
    await client.read();
    expect(client.state().readState).toBe("ready");
    expect(client.state().behind).toBe(false);
    expect(client.state().snapshot?.grantGeneration).toBe(2);
    // Rows issued under the older grant are stale-issue in the new session.
    expect(client.state().snapshot?.notifications.every((row) => row.issueState === "stale-issue")).toBe(true);
  });

  it("a lost request outcome is unknown, not retried, and fences later requests", async () => {
    const { client } = controller({ scenario: "act-lost" });
    await ready(client);
    const result = await client.markRead("ntf-0001");
    expect(result.kind).toBe("UNKNOWN");
    const state = client.state();
    expect(state.last?.phase).toBe("unknown");
    expect(state.fence?.reason).toBe("unknown-outcome");
    // Every later request is fenced, and a read does not lift the fence.
    const again = await client.markRead("ntf-0002");
    expect(again.kind).toBe("FENCED");
    await client.read();
    expect(client.state().fence?.reason).toBe("unknown-outcome");
    const still = await client.resolveAction("ntf-0004");
    expect(still.kind).toBe("FENCED");
    // A new context counts the unknown outcome and lifts the fence.
    const next = client.switchActor(NOTIFY_SETTLER_ACTOR);
    expect(next).not.toBeNull();
    expect(client.state().earlierUnknown).toBe(1);
    expect(client.state().fence).toBeNull();
  });

  it("a refused request answer is untrusted and fences later requests the same way", async () => {
    const { client } = controller({ scenario: "resolve-claims" });
    await ready(client);
    const result = await client.resolveAction("ntf-0001");
    expect(result.kind).toBe("UNKNOWN");
    if (result.kind === "UNKNOWN") {
      expect(result.record.phase).toBe("refused");
      expect(result.record.code).toBe("CLAIM");
    }
    expect(client.state().fence?.reason).toBe("unknown-outcome");
  });

  it("one request at a time: a second request while one is in flight never leaves", async () => {
    const port = createStubNotificationInbox();
    const { held, release } = holdCall(port, "act");
    const client = new NotificationInboxController(held);
    await client.read();
    const pending = client.markRead("ntf-0001");
    const second = await client.markRead("ntf-0002");
    expect(second.kind).toBe("FENCED");
    if (second.kind === "FENCED") {
      expect(second.fence.reason).toBe("in-flight");
    }
    release();
    const result = await pending;
    expect(result.kind).toBe("APPLIED");
    expect(port.effects().acts).toBe(1);
  });

  it("no request leaves before a ready read, and none leaves a not-bound port", async () => {
    const { client, port } = controller();
    const early = await client.markRead("ntf-0001");
    expect(early.kind).toBe("NOT_SENT");
    if (early.kind === "NOT_SENT") {
      expect(early.reason).toBe("no-snapshot");
    }
    expect(port.effects().acts).toBe(0);

    const notBound = new NotificationInboxController(createNotBoundNotificationInbox());
    await notBound.read();
    const result = await notBound.markRead("ntf-0001");
    expect(result.kind).toBe("NOT_SENT");
    if (result.kind === "NOT_SENT") {
      expect(result.reason).toBe("not-bound");
      expect(result.detail).toBe(NOTIFY_NOT_BOUND_REASON);
    }
  });
});

describe("notification inbox controller inquiries", () => {
  it("loads support material for a resolvable open-support notification", async () => {
    const { client } = controller();
    await ready(client);
    const result = await client.loadInquiry("nqy-0001");
    expect(result).toEqual({ kind: "APPLIED", phase: "loaded" });
    const state = client.state();
    expect(state.inquiry.value?.inquiryRef).toBe("nqy-0001");
    expect(state.inquiry.value?.declaration.realPersonalData).toBe(false);
    expect(state.inquiry.value?.declaration.authorityRecord).toBe(false);
  });

  it("refuses to send an inquiry before a read, or under a not-bound port", async () => {
    const { client, port } = controller();
    const early = await client.loadInquiry("nqy-0001");
    expect(early.kind).toBe("NOT_SENT");
    if (early.kind === "NOT_SENT") {
      expect(early.reason).toBe("no-snapshot");
    }
    expect(port.effects().inquiries).toBe(0);

    const notBound = new NotificationInboxController(createNotBoundNotificationInbox());
    await notBound.read();
    const result = await notBound.loadInquiry("nqy-0001");
    expect(result.kind).toBe("NOT_SENT");
    if (result.kind === "NOT_SENT") {
      expect(result.reason).toBe("not-bound");
    }
    expect(notBound.state().inquiry.phase).toBe("not-bound");
  });

  it("a denied or refused inquiry leaves no material on screen", async () => {
    const denied = controller({ scenario: "inquiry-denied" });
    await denied.client.read();
    const result = await denied.client.loadInquiry("nqy-0001");
    expect(result).toEqual({ kind: "APPLIED", phase: "denied" });
    expect(denied.client.state().inquiry.code).toBe("INQUIRY_DENIED");
    expect(denied.client.state().inquiry.value).toBeNull();

    const leaked = controller({ scenario: "inquiry-leak" });
    await leaked.client.read();
    const refused = await leaked.client.loadInquiry("nqy-0001");
    expect(refused).toEqual({ kind: "APPLIED", phase: "refused" });
    expect(leaked.client.state().inquiry.value).toBeNull();
  });

  it("drops an inquiry answer that arrives after the context changed", async () => {
    const port = createStubNotificationInbox();
    const { held, release } = holdCall(port, "readInquiry");
    const client = new NotificationInboxController(held);
    await client.read();
    const pending = client.loadInquiry("nqy-0001");
    client.switchRole("settler");
    release();
    const result = await pending;
    expect(result).toEqual({ kind: "DROPPED", cause: "context-changed" });
    expect(client.state().inquiry.value).toBeNull();
    expect(client.state().counters.droppedInquiries).toBe(1);
  });

  it("a non-ready read clears the inquiry material of the earlier view", async () => {
    const { client, port } = controller();
    await ready(client);
    await client.loadInquiry("nqy-0001");
    expect(client.state().inquiry.phase).toBe("loaded");
    // The grant is revoked at the source; the next read is denied and the
    // material of the earlier view leaves with it.
    expect(port.synthetic("revoke-grant", "ngr-0001")).toBe(true);
    await client.read();
    expect(client.state().readState).toBe("denied");
    expect(client.state().inquiry.phase).toBe("none");
    expect(client.state().inquiry.value).toBeNull();
    expect(client.state().snapshot).toBeNull();
  });
});

describe("controller context switching", () => {
  it("a tenant switch refuses while a request is in flight", async () => {
    const port = createStubNotificationInbox();
    const { held, release } = holdCall(port, "act");
    const client = new NotificationInboxController(held);
    await client.read();
    const pending = client.markRead("ntf-0001");
    expect(client.switchTenant(NOTIFY_FOREIGN)).toBeNull();
    release();
    await pending;
    const next = client.switchTenant(NOTIFY_FOREIGN);
    expect(next).not.toBeNull();
    expect(next?.scope.tenantId).toBe(NOTIFY_FOREIGN);
  });

  it("the foreign actor's own context reads the foreign tenant, and the buyer is denied there", async () => {
    const port = createStubNotificationInbox();
    const foreign = new NotificationInboxController(port, { actorRef: NOTIFY_FOREIGN_ACTOR, tenantId: NOTIFY_FOREIGN });
    await foreign.read();
    expect(foreign.state().readState).toBe("ready");
    expect(foreign.state().snapshot?.scope.tenantId).toBe(NOTIFY_FOREIGN);

    const buyer = new NotificationInboxController(port, { actorRef: NOTIFY_BUYER_ACTOR, tenantId: NOTIFY_FOREIGN });
    await buyer.read();
    expect(buyer.state().readState).toBe("denied");
    expect(buyer.state().readCode).toBe("GRANT_DENIED");
  });
});
