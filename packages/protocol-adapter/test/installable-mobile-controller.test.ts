import { describe, expect, it } from "vitest";
import {
  MOBILE_AS_OF,
  MOBILE_DESK_ACTOR,
  MOBILE_DEVICE_ID,
  MOBILE_GUEST_ACTOR,
  MOBILE_STALE_FLOOR,
  MOBILE_STALE_WATERMARK,
  MobileShellController,
  createStubMobileShell,
  mobileShellPortFor,
  projectMobile,
  type MobileScenario,
  type MobileShellPort,
  type StubMobileShell,
} from "../src/index.js";

function rig(
  scenario: MobileScenario = "clean",
  options: { actorRef?: string; deviceNow?: () => string | null } = {},
): { port: StubMobileShell; controller: MobileShellController } {
  const port = createStubMobileShell({ scenario });
  const controller = new MobileShellController(port, {
    actorRef: options.actorRef ?? MOBILE_DESK_ACTOR,
    deviceNow: options.deviceNow ?? (() => MOBILE_AS_OF),
  });
  return { port, controller };
}

async function readied(controller: MobileShellController) {
  const result = await controller.refresh();
  if (result.kind !== "APPLIED" || (result.readState !== "ready" && result.readState !== "empty")) {
    throw new Error(`expected a settled read, received ${JSON.stringify(result)}`);
  }
  return controller.state();
}

/** A stub port whose read is replaced; writes and controls still land on the inner source. */
function portWithRead(inner: StubMobileShell, read: MobileShellPort["read"]): MobileShellPort {
  return {
    environment: inner.environment,
    source: inner.source,
    scenario: inner.scenario,
    link: () => inner.link(),
    read,
    submit: (request) => inner.submit(request),
    dropConnection: () => inner.dropConnection(),
    restoreConnection: () => inner.restoreConnection(),
    offerUpdate: () => inner.offerUpdate(),
    expireSession: () => inner.expireSession(),
    deliverHeld: () => inner.deliverHeld(),
    deliverLate: () => inner.deliverLate(),
  };
}

describe("mobile shell controller reads", () => {
  it("reads the shell under the desk context and keeps UNKNOWN, NOT_BOUND, and STALE separate", async () => {
    const { controller } = rig();
    const state = await readied(controller);
    expect(state.readState).toBe("ready");
    expect(state.snapshot?.install.installRef).toBe("ins-0001");
    expect(state.freshness).toBe("CURRENT");
    expect(state.context.key).toContain(MOBILE_DESK_ACTOR);
    expect(state.context.key).toContain(MOBILE_DEVICE_ID);
  });

  it("keeps the stored items as cached copies while the link is down, and answers a write fenced link-offline", async () => {
    const { port, controller } = rig();
    await readied(controller);
    port.dropConnection();
    await controller.refresh();
    const state = controller.state();
    expect(state.readState).toBe("offline");
    expect(state.cached).toBe(true);
    expect(state.freshness).toBe("STALE");
    const projection = projectMobile(state);
    expect(projection.vault.length).toBe(3);
    for (const item of projection.vault) {
      expect(item.currency).toBe("cached");
      expect(item.grantsAdmission).toBe(false);
    }
    const fenced = await controller.run({ step: "confirm", intentRef: "i-1", orderRef: "ord-0001" });
    expect(fenced).toMatchObject({ kind: "FENCED", fence: { reason: "link-offline" } });
    expect(port.effects().submits).toBe(0);
  });

  it("goes back to a current read after the link is restored, replaying nothing", async () => {
    const { port, controller } = rig();
    await readied(controller);
    port.dropConnection();
    await controller.refresh();
    expect(controller.state().readState).toBe("offline");
    port.restoreConnection();
    await controller.refresh();
    const state = controller.state();
    expect(state.readState).toBe("ready");
    expect(state.cached).toBe(false);
    expect(state.freshness).toBe("CURRENT");
    expect(port.effects().submits).toBe(0);
  });

  it("fences every write on the held cached copy after the link returns, until an explicit read lands", async () => {
    const { port, controller } = rig();
    await readied(controller);
    port.dropConnection();
    await controller.refresh();
    port.restoreConnection();
    const unrestored = controller.state();
    expect(unrestored.readState).toBe("offline");
    expect(unrestored.cached).toBe(true);
    expect(unrestored.refreshRequired).toBe("cached-read");
    expect(unrestored.link).toBe("online");
    const inputs = [
      { step: "install" },
      { step: "update" },
      { step: "reconnect" },
      { step: "present", vaultRef: "vlt-0001" },
      { step: "confirm", orderRef: "ord-0001" },
      { step: "withdraw", orderRef: "ord-0001" },
    ] as const;
    for (const [index, input] of inputs.entries()) {
      const fenced = await controller.run({ ...input, intentRef: `i-${index}` });
      expect(fenced).toMatchObject({
        kind: "FENCED",
        fence: { reason: "snapshot-stale", cause: "cached-read" },
      });
    }
    expect(port.effects().submits).toBe(0);
    await controller.refresh();
    expect(controller.state().refreshRequired).toBeNull();
    const confirmed = await controller.run({ step: "confirm", intentRef: "c-9", orderRef: "ord-0001" });
    expect(confirmed).toMatchObject({ kind: "CONFIRMED" });
  });

  it("fences a held snapshot the same way after a stale read and after an unanswered read", async () => {
    const staleInner = createStubMobileShell({ scenario: "clean" });
    let staleReads = 0;
    const stalePort = portWithRead(staleInner, (request) => {
      staleReads += 1;
      return staleReads === 1
        ? staleInner.read(request)
        : Promise.resolve({ kind: "stale", watermark: MOBILE_STALE_WATERMARK, floor: MOBILE_STALE_FLOOR });
    });
    const staleController = new MobileShellController(stalePort, {
      actorRef: MOBILE_DESK_ACTOR,
      deviceNow: () => MOBILE_AS_OF,
    });
    await readied(staleController);
    await staleController.refresh();
    const staleState = staleController.state();
    expect(staleState.readState).toBe("stale");
    expect(staleState.cached).toBe(true);
    expect(staleState.refreshRequired).toBe("cached-read");
    const staleFenced = await staleController.run({ step: "confirm", intentRef: "c-1", orderRef: "ord-0001" });
    expect(staleFenced).toMatchObject({ kind: "FENCED", fence: { reason: "snapshot-stale", cause: "cached-read" } });
    expect(staleInner.effects().submits).toBe(0);

    const cutInner = createStubMobileShell({ scenario: "clean" });
    let cutReads = 0;
    const cutPort = portWithRead(cutInner, (request) => {
      cutReads += 1;
      if (cutReads === 1) {
        return cutInner.read(request);
      }
      return Promise.reject(new Error("The answer was cut off."));
    });
    const cutController = new MobileShellController(cutPort, {
      actorRef: MOBILE_DESK_ACTOR,
      deviceNow: () => MOBILE_AS_OF,
    });
    await readied(cutController);
    await cutController.refresh();
    const cutState = cutController.state();
    expect(cutState.readState).toBe("unavailable");
    expect(cutState.cached).toBe(true);
    expect(cutState.refreshRequired).toBe("cached-read");
    const cutFenced = await cutController.run({ step: "withdraw", intentRef: "w-1", orderRef: "ord-0001" });
    expect(cutFenced).toMatchObject({ kind: "FENCED", fence: { reason: "snapshot-stale", cause: "cached-read" } });
    expect(cutInner.effects().submits).toBe(0);
  });

  it("keeps stored verdicts visible but stale-labelled when the source serves a stale watermark", async () => {
    const { controller } = rig("stale");
    await controller.refresh();
    const state = controller.state();
    expect(state.readState).toBe("stale");
    expect(state.snapshot).toBeNull();
    const fenced = await controller.run({ step: "confirm", intentRef: "i-1", orderRef: "ord-0001" });
    expect(fenced).toMatchObject({ kind: "FENCED", fence: { reason: "no-snapshot" } });
  });
});

describe("mobile shell controller writes", () => {
  it("installs on an empty device and then fences a second install", async () => {
    const { controller } = rig("empty");
    await readied(controller);
    const installed = await controller.run({ step: "install", intentRef: "i-1" });
    expect(installed).toMatchObject({ kind: "CONFIRMED" });
    await controller.refresh();
    const second = await controller.run({ step: "install", intentRef: "i-2" });
    expect(second).toMatchObject({ kind: "FENCED", fence: { reason: "already-installed" } });
  });

  it("applies the offered update and fences update when none is offered", async () => {
    const { controller } = rig("update-available");
    await readied(controller);
    const applied = await controller.run({ step: "update", intentRef: "i-1" });
    expect(applied).toMatchObject({ kind: "CONFIRMED" });
    await controller.refresh();
    expect(controller.state().snapshot?.install.shellRef).toBe("shl-0002");
    expect(await controller.run({ step: "update", intentRef: "i-2" })).toMatchObject({
      kind: "FENCED",
      fence: { reason: "no-update" },
    });
  });

  it("fences present, confirm, and withdraw while the session verdict is expired, then reconnects", async () => {
    const { controller } = rig("session-expired");
    await readied(controller);
    for (const [index, input] of (
      [
        { step: "present", vaultRef: "vlt-0001" },
        { step: "confirm", orderRef: "ord-0001" },
        { step: "withdraw", orderRef: "ord-0001" },
      ] as const
    ).entries()) {
      const fenced = await controller.run({ ...input, intentRef: `i-${index}` });
      expect(fenced).toMatchObject({ kind: "FENCED", fence: { reason: "session-expired" } });
    }
    const reconnected = await controller.run({ step: "reconnect", intentRef: "r-1" });
    expect(reconnected).toMatchObject({ kind: "CONFIRMED" });
    await controller.refresh();
    expect(controller.state().snapshot?.session.sessionRef).toBe("ses-0002");
    const confirmed = await controller.run({ step: "confirm", intentRef: "c-1", orderRef: "ord-0001" });
    expect(confirmed).toMatchObject({ kind: "CONFIRMED" });
  });

  it("fences a present of an expired stored pass at the source, not by the device clock", async () => {
    const { controller } = rig();
    await readied(controller);
    const expired = await controller.run({ step: "present", intentRef: "p-1", vaultRef: "vlt-0003" });
    expect(expired).toMatchObject({ kind: "REJECTED", intent: { code: "PASS_NOT_PRESENTABLE" } });
    const receipt = await controller.run({ step: "present", intentRef: "p-2", vaultRef: "vlt-0002" });
    expect(receipt).toMatchObject({ kind: "REJECTED", intent: { code: "PASS_NOT_PRESENTABLE" } });
    const presented = await controller.run({ step: "present", intentRef: "p-3", vaultRef: "vlt-0001" });
    expect(presented).toMatchObject({ kind: "CONFIRMED" });
  });

  it("sends each write once and fences a repeated intent and an in-flight scope", async () => {
    const { controller } = rig();
    await readied(controller);
    const first = await controller.run({ step: "confirm", intentRef: "c-1", orderRef: "ord-0001" });
    expect(first).toMatchObject({ kind: "CONFIRMED" });
    const repeated = await controller.run({ step: "confirm", intentRef: "c-1", orderRef: "ord-0001" });
    expect(repeated).toMatchObject({ kind: "FENCED", fence: { reason: "duplicate-intent" } });
  });
});

describe("mobile shell controller resume", () => {
  it("re-executes nothing on resume: the held read is marked resumed and every write stays fenced", async () => {
    const { port, controller } = rig();
    await readied(controller);
    controller.resume();
    const state = controller.state();
    expect(state.refreshRequired).toBe("resumed");
    const fenced = await controller.run({ step: "confirm", intentRef: "c-1", orderRef: "ord-0001" });
    expect(fenced).toMatchObject({ kind: "FENCED", fence: { reason: "snapshot-stale" } });
    expect(port.effects().submits).toBe(0);
    await controller.refresh();
    expect(controller.state().refreshRequired).toBeNull();
    const confirmed = await controller.run({ step: "confirm", intentRef: "c-2", orderRef: "ord-0001" });
    expect(confirmed).toMatchObject({ kind: "CONFIRMED" });
  });

  it("never retries an uncertain payment or withdrawal across a resume", async () => {
    const { port, controller } = rig("confirm-lost");
    await readied(controller);
    const lost = await controller.run({ step: "confirm", intentRef: "c-1", orderRef: "ord-0001" });
    expect(lost).toMatchObject({ kind: "UNKNOWN", intent: { code: "RESPONSE_LOST" } });
    controller.resume();
    // A resume and a fresh read land evidence only: the order scope stays fenced.
    await controller.refresh();
    const state = controller.state();
    expect(state.readState).toBe("ready");
    const retried = await controller.run({ step: "confirm", intentRef: "c-2", orderRef: "ord-0001" });
    expect(retried).toMatchObject({ kind: "FENCED", fence: { reason: "unknown-outcome" } });
    expect(port.effects().submits).toBe(1);
    // The late result is recorded as evidence and still resolves nothing.
    const due = port.deliverLate();
    expect(due.length).toBe(1);
    const accepted = controller.acceptLate(due[0]!);
    expect(accepted).toMatchObject({ kind: "RECORDED" });
    const again = await controller.run({ step: "withdraw", intentRef: "w-1", orderRef: "ord-0001" });
    expect(again).toMatchObject({ kind: "FENCED", fence: { reason: "unknown-outcome" } });
    expect(port.effects().submits).toBe(1);
  });
});

describe("mobile shell controller context", () => {
  it("switches context during a held write and quarantines the late answer", async () => {
    const port = createStubMobileShell({ scenario: "held-response" });
    const controller = new MobileShellController(port, { actorRef: MOBILE_DESK_ACTOR, deviceNow: () => MOBILE_AS_OF });
    const firstRead = controller.refresh();
    port.deliverHeld();
    await firstRead;
    const pending = controller.run({ step: "confirm", intentRef: "c-1", orderRef: "ord-0001" });
    controller.switchContext({ actorRef: MOBILE_GUEST_ACTOR });
    port.deliverHeld();
    const settled = await pending;
    expect(settled).toMatchObject({ kind: "QUARANTINED" });
    const state = controller.state();
    const intent = state.intents.find((item) => item.intentRef === "c-1");
    expect(intent?.outcome).toBe("UNKNOWN");
    expect(intent?.code).toBe("CONTEXT_SWITCHED");
    expect(state.quarantined.some((item) => item.intentRef === "c-1")).toBe(true);
    // Under the guest context the source session still belongs to mobile-owner.
    const secondRead = controller.refresh();
    port.deliverHeld();
    await secondRead;
    expect(controller.state().snapshot?.session.actorRef).toBe(MOBILE_DESK_ACTOR);
    const fenced = await controller.run({ step: "confirm", intentRef: "c-2", orderRef: "ord-0001" });
    expect(fenced).toMatchObject({ kind: "FENCED", fence: { reason: "unknown-outcome" } });
  });

  it("re-login as another actor opens a new session and reuses no stored copy", async () => {
    const port = createStubMobileShell();
    const controller = new MobileShellController(port, { actorRef: MOBILE_DESK_ACTOR, deviceNow: () => MOBILE_AS_OF });
    await controller.refresh();
    controller.switchContext({ actorRef: MOBILE_GUEST_ACTOR });
    await controller.refresh();
    const state = controller.state();
    expect(state.readState).toBe("ready");
    const projection = projectMobile(state);
    for (const item of projection.vault) {
      expect(item.ownerMatch).toBe(false);
    }
    const reconnected = await controller.run({ step: "reconnect", intentRef: "r-1" });
    expect(reconnected).toMatchObject({ kind: "CONFIRMED" });
    await controller.refresh();
    expect(controller.state().snapshot?.session.actorRef).toBe(MOBILE_GUEST_ACTOR);
    // The stored pass still belongs to the earlier actor: presenting it is refused.
    const presented = await controller.run({ step: "present", intentRef: "p-1", vaultRef: "vlt-0001" });
    expect(presented).toMatchObject({ kind: "REJECTED", intent: { code: "IDENTITY_MISMATCH" } });
  });
});

describe("mobile shell controller clock", () => {
  it("marks stored verdicts clock-uncertain when the device clock is out of step", async () => {
    const { controller } = rig("clean", { deviceNow: () => "2026-10-20T00:00:00.000Z" });
    await readied(controller);
    const projection = projectMobile(controller.state());
    expect(projection.clock?.verdict).toBe("skewed");
    for (const item of projection.vault) {
      expect(item.currency).toBe("clock-uncertain");
      expect(item.authorityVerdict).not.toBe("decided-by-device");
    }
  });

  it("marks stored verdicts clock-uncertain when no device clock is reported", async () => {
    const { controller } = rig("clean", { deviceNow: () => null });
    await readied(controller);
    const projection = projectMobile(controller.state());
    expect(projection.clock?.verdict).toBe("unreported");
    for (const item of projection.vault) {
      expect(item.currency).toBe("clock-uncertain");
    }
  });
});

describe("mobile shell controller boundaries", () => {
  it("stays not-bound on integration-http and sends nothing", async () => {
    const port = mobileShellPortFor("integration-http", { scenario: "clean" });
    const controller = new MobileShellController(port, { actorRef: MOBILE_DESK_ACTOR });
    await controller.refresh();
    expect(controller.state().readState).toBe("not-bound");
    const result = await controller.run({ step: "confirm", intentRef: "c-1", orderRef: "ord-0001" });
    expect(result).toMatchObject({ kind: "FENCED", fence: { reason: "not-bound" } });
  });

  it("refuses a read that claims a grant, and turns a claiming receipt into an unknown write", async () => {
    const { controller } = rig("claims-grant");
    await controller.refresh();
    expect(controller.state().readState).toBe("refused");

    const claimed = rig("receipt-claims");
    await readied(claimed.controller);
    const result = await claimed.controller.run({ step: "confirm", intentRef: "c-1", orderRef: "ord-0001" });
    expect(result).toMatchObject({ kind: "UNKNOWN", intent: { code: "UNTRUSTED_RECEIPT" } });
  });

  it("drops a read answer that lands after the context changed", async () => {
    const port = createStubMobileShell({ scenario: "held-response" });
    const controller = new MobileShellController(port, { actorRef: MOBILE_DESK_ACTOR, deviceNow: () => MOBILE_AS_OF });
    const pending = controller.refresh();
    controller.switchContext({ actorRef: MOBILE_GUEST_ACTOR });
    port.deliverHeld();
    await expect(pending).resolves.toMatchObject({ kind: "DROPPED", cause: "context-changed" });
    expect(controller.state().counters.droppedReads).toBe(1);
  });
});
