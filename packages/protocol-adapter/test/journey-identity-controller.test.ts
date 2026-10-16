import { describe, expect, it } from "vitest";
import {
  JOURNEY_IDENTITY_DESK_ACTOR,
  JOURNEY_IDENTITY_PEER_ACTOR,
  JourneyIdentityController,
  createNotBoundJourneyIdentity,
  createStubJourneyIdentity,
  projectIdentity,
  type JourneyIdentityPort,
  type JourneyIdentityScenario,
} from "../src/index.js";

function rig(scenario: JourneyIdentityScenario = "clean") {
  const port = createStubJourneyIdentity({ scenario });
  return {
    port,
    controller: new JourneyIdentityController(port, { actorRef: JOURNEY_IDENTITY_DESK_ACTOR, role: "operator" }),
  };
}

describe("journey identity controller", () => {
  it("fences an attach before the first read and after an own-write until a refresh", async () => {
    const { controller } = rig();
    expect(controller.gateFor({ observationId: "obs-0001", intentRef: "i1" })).toEqual({ reason: "no-snapshot" });
    await controller.refresh();
    expect(controller.gateFor({ observationId: "obs-0001", intentRef: "i1" })).toBeNull();
    expect(await controller.run({ observationId: "obs-0001", intentRef: "i1" })).toMatchObject({ kind: "CONFIRMED" });
    expect(controller.gateFor({ observationId: "obs-0002", intentRef: "i2" })).toEqual({ reason: "snapshot-stale", cause: "own-write" });
    await controller.refresh();
    expect(controller.gateFor({ observationId: "obs-0002", intentRef: "i2" })).toBeNull();
  });

  it("never lets a foreign or stale row become evidence", async () => {
    const { controller } = rig("foreign-mix");
    await controller.refresh();
    const projection = projectIdentity(controller.state());
    expect(projection.current.map((row) => row.item.itemId)).toEqual(["obs-0001"]);
    expect(projection.foreign).toHaveLength(5);
    for (const id of ["obs-0002", "obs-0003", "obs-0004", "evd-0005", "evd-0006"]) {
      const fence = controller.gateFor({ observationId: id, intentRef: `i-${id}` });
      expect(fence, id).toMatchObject({ reason: "not-current", verdict: "foreign" });
      expect(await controller.run({ observationId: id, intentRef: `i-${id}` })).toMatchObject({ kind: "FENCED" });
    }
    expect(controller.state().counters.sent).toBe(0);
  });

  it("marks an older-cut row stale and fences its attach", async () => {
    const { controller } = rig("older-cut");
    await controller.refresh();
    const projection = projectIdentity(controller.state());
    expect(projection.stale.map((row) => row.item.itemId)).toEqual(["obs-0002", "evd-0003"]);
    expect(projection.foreign.map((row) => row.cause)).toEqual(["generation-ahead"]);
    expect(controller.gateFor({ observationId: "obs-0002", intentRef: "i1" })).toMatchObject({ reason: "not-current", verdict: "stale" });
  });

  it("keeps an unknown attach fenced after a stub reset and never resolves it with a read", async () => {
    const { port, controller } = rig("attach-lost");
    await controller.refresh();
    expect(await controller.run({ observationId: "obs-0001", intentRef: "i1" })).toMatchObject({ kind: "UNKNOWN" });
    const due = port.deliverLate();
    expect(controller.acceptLate(due[0]!)).toMatchObject({ kind: "RECORDED" });
    const before = controller.state().intents[0];
    expect(before?.outcome).toBe("UNKNOWN");

    const fresh = createStubJourneyIdentity({ scenario: "clean" });
    controller.resetSource(fresh);
    const state = controller.state();
    expect(state.isolated).toHaveLength(1);
    expect(state.isolated[0]).toMatchObject({ cause: "source-reset", unknownIntents: 1 });
    expect(state.intents[0]?.outcome).toBe("UNKNOWN");
    await controller.refresh();
    expect(projectIdentity(controller.state()).intents[0]?.outcome).toBe("UNKNOWN");
    expect(controller.gateFor({ observationId: "obs-0001", intentRef: "i2" })).toMatchObject({ reason: "unknown-outcome", intentRef: "i1", earlierContext: true });
    expect(await controller.run({ observationId: "obs-0001", intentRef: "i2" })).toMatchObject({ kind: "FENCED" });
    expect(fresh.effects().submits).toBe(0);
  });

  it("quarantines a held answer that lands after a context switch", async () => {
    const { port, controller } = rig("held-response");
    await controller.refresh();
    const pending = controller.run({ observationId: "obs-0001", intentRef: "i1" });
    controller.switchContext({ actorRef: JOURNEY_IDENTITY_PEER_ACTOR });
    port.deliverHeld();
    expect(await pending).toMatchObject({ kind: "QUARANTINED" });
    const state = controller.state();
    expect(state.quarantined).toHaveLength(1);
    expect(state.intents[0]?.code).toBe("CONTEXT_SWITCHED");
    expect(state.context.actorRef).toBe(JOURNEY_IDENTITY_PEER_ACTOR);
    expect(state.isolated[0]).toMatchObject({ cause: "context-switch" });
  });

  it("marks the read generation-moved after the source cut rotates", async () => {
    const { port, controller } = rig("clean");
    await controller.refresh();
    port.rotateCut();
    await controller.refresh();
    expect(controller.state().readState).toBe("generation-moved");
    expect(controller.gateFor({ observationId: "obs-0001", intentRef: "i1" })).toMatchObject({ reason: "snapshot-stale", cause: "generation-moved" });
  });

  it("drops a read that lands after the context switched", async () => {
    const { controller } = rig("clean");
    const pending = controller.refresh();
    controller.switchContext();
    expect(await pending).toMatchObject({ kind: "DROPPED", cause: "context-changed" });
    expect(controller.state().readState).toBe("none");
  });

  it("stays not-bound on integration-http and sends nothing", async () => {
    const port: JourneyIdentityPort = createNotBoundJourneyIdentity();
    const controller = new JourneyIdentityController(port, { actorRef: JOURNEY_IDENTITY_DESK_ACTOR, role: "operator" });
    await controller.refresh();
    expect(controller.state().readState).toBe("not-bound");
    expect(controller.gateFor({ observationId: "obs-0001", intentRef: "i1" })).toEqual({ reason: "not-bound" });
    expect(await controller.run({ observationId: "obs-0001", intentRef: "i1" })).toMatchObject({ kind: "FENCED" });
    expect(controller.state().counters.sent).toBe(0);
  });

  it("marks an untrusted confirmed answer unknown", async () => {
    const base = createStubJourneyIdentity({ scenario: "clean" });
    const port: JourneyIdentityPort = {
      environment: base.environment,
      source: base.source,
      scenario: base.scenario,
      currentGeneration: () => base.currentGeneration(),
      read: (request) => base.read(request),
      submit: async (request) => {
        const outcome = await base.submit(request);
        if (outcome.kind !== "confirmed") {
          return outcome;
        }
        return { ...outcome, nonClaims: { ...outcome.nonClaims, confirmsPayment: true } as unknown as typeof outcome.nonClaims };
      },
      rotateCut: () => base.rotateCut(),
      deliverHeld: () => base.deliverHeld(),
      deliverLate: () => base.deliverLate(),
    };
    const controller = new JourneyIdentityController(port, { actorRef: JOURNEY_IDENTITY_DESK_ACTOR, role: "operator" });
    await controller.refresh();
    const result = await controller.run({ observationId: "obs-0001", intentRef: "i1" });
    expect(result).toMatchObject({ kind: "UNKNOWN", intent: { outcome: "UNKNOWN", code: "UNTRUSTED_RECEIPT" } });
  });

  it("refuses a claims-proof read", async () => {
    const { controller } = rig("claims-proof");
    await controller.refresh();
    expect(controller.state().readState).toBe("refused");
  });

  it("does not let a read that started before a write settled clear the refresh flag", async () => {
    const { controller } = rig("clean");
    await controller.refresh();
    const early = controller.refresh();
    expect(await controller.run({ observationId: "obs-0001", intentRef: "i1" })).toMatchObject({ kind: "CONFIRMED" });
    await early;
    expect(controller.gateFor({ observationId: "obs-0002", intentRef: "i2" })).toEqual({ reason: "snapshot-stale", cause: "own-write" });
    await controller.refresh();
    expect(controller.gateFor({ observationId: "obs-0002", intentRef: "i2" })).toBeNull();
  });
});
