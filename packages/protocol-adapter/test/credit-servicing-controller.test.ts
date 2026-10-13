import { describe, expect, it } from "vitest";
import {
  CreditServicingController,
  DISCOVERY_READ_TUPLE_LITERALS,
  SERVICING_APPROVER_ACTOR,
  SERVICING_DESK_ACTOR,
  SERVICING_FOREIGN_REF,
  SERVICING_NOT_BOUND_REASON,
  SERVICING_OWN_REF,
  SERVICING_TENANT,
  SERVICING_VIEWER_ACTOR,
  createNotBoundCreditServicing,
  createStubCreditServicing,
  type ServicingActOutcome,
  type ServicingActRequest,
  type ServicingPort,
  type ServicingReadOutcome,
  type ServicingReadRequest,
  type ServicingScenario,
  type StubCreditServicing,
  type StubCreditServicingOptions,
} from "../src/index.js";

function controllerFor(
  scenario: ServicingScenario = "clean",
  options: { actorRef?: string; obligationRef?: string; expectedTuple?: StubCreditServicingOptions["expectedTuple"] } = {},
) {
  const port = createStubCreditServicing({ scenario, expectedTuple: options.expectedTuple });
  const controller = new CreditServicingController(port, { actorRef: options.actorRef, obligationRef: options.obligationRef });
  return { port, controller };
}

/** Records every call and can hold a read or a request so ordering can be staged. */
function spyOn(inner: StubCreditServicing, options: { holdReads?: boolean; holdActs?: boolean } = {}) {
  const readRequests: ServicingReadRequest[] = [];
  const actRequests: ServicingActRequest[] = [];
  const heldReads: { release: () => void }[] = [];
  const heldActs: { release: () => void }[] = [];
  const port: ServicingPort = {
    environment: inner.environment,
    source: inner.source,
    scenario: inner.scenario,
    read(request) {
      readRequests.push(structuredClone(request));
      if (!options.holdReads) {
        return inner.read(request);
      }
      return new Promise<ServicingReadOutcome>((resolve, reject) => {
        heldReads.push({
          release: () => {
            inner.read(request).then(resolve, reject);
          },
        });
      });
    },
    act(request) {
      actRequests.push(structuredClone(request));
      if (!options.holdActs) {
        return inner.act(request);
      }
      return new Promise<ServicingActOutcome>((resolve, reject) => {
        heldActs.push({
          release: () => {
            inner.act(request).then(resolve, reject);
          },
        });
      });
    },
    synthetic: (control) => inner.synthetic(control),
  };
  return { port, readRequests, actRequests, heldReads, heldActs };
}

/** A port that answers what the test says, for outcomes the stub does not produce. */
function scriptedPort(script: { read?: ServicingReadOutcome; act?: ServicingActOutcome }): ServicingPort {
  return {
    environment: "stub",
    source: "synthetic-servicing",
    scenario: "clean",
    read: () => Promise.resolve(script.read ?? { kind: "unknown", message: "unscripted read" }),
    act: () => Promise.resolve(script.act ?? { kind: "unknown", message: "unscripted act" }),
    synthetic: () => false,
  };
}

describe("servicing controller context and reads", () => {
  it("keys the context on mode, domain, actor, tenant, obligation, and incarnation", () => {
    const { controller } = controllerFor();
    const context = controller.state().context;
    expect(context).toMatchObject({
      environment: "stub",
      actorRef: SERVICING_DESK_ACTOR,
      incarnation: 1,
      scope: { tenantId: SERVICING_TENANT, obligationRef: SERVICING_OWN_REF },
    });
    expect(context.key).toBe(`stub|${context.domain}|${SERVICING_DESK_ACTOR}|${SERVICING_TENANT}|${SERVICING_OWN_REF}|1`);
  });

  it("starts with no read, no fence, no record, and no usable freshness", () => {
    const { controller } = controllerFor();
    const state = controller.state();
    expect(state).toMatchObject({
      readState: "none",
      freshness: "UNAVAILABLE",
      snapshot: null,
      assessment: null,
      behind: false,
      fence: null,
      last: null,
      earlierUnknown: 0,
    });
    expect(state.counters).toEqual({ reads: 0, acts: 0, notSent: 0, droppedReads: 0 });
  });

  it("applies a ready read with its assessment and holds its watermark as the next floor", async () => {
    const { port, readRequests } = spyOn(createStubCreditServicing());
    const controller = new CreditServicingController(port);
    expect(await controller.read()).toEqual({ kind: "APPLIED", readState: "ready" });
    const state = controller.state();
    expect(state.freshness).toBe("CURRENT");
    expect(state.snapshot?.draw).toMatchObject({ instruction: "recorded", observation: "observed" });
    expect(state.assessment).toMatchObject({ cutState: "clean" });
    expect(readRequests[0]?.watermarkFloor).toBeNull();
    await controller.read();
    expect(readRequests[1]?.watermarkFloor).toBe(state.snapshot?.watermark);
    expect(controller.state().counters).toMatchObject({ reads: 2, acts: 0 });
  });

  it("clears the rows on every read that is not ready, and says which kind it was", async () => {
    const cases: [ServicingScenario, string, string | null][] = [
      ["empty", "empty", null],
      ["stale", "stale", null],
      ["denied", "denied", "GRANT_REVOKED"],
      ["claims-restored", "refused", "CLAIM"],
      ["scope-leak", "refused", "SCOPE_LEAK"],
      ["read-lost", "unavailable", null],
    ];
    for (const [scenario, readState, code] of cases) {
      const { controller } = controllerFor(scenario);
      await controller.read();
      const state = controller.state();
      expect(state.readState, scenario).toBe(readState);
      expect(state.readCode, scenario).toBe(code);
      expect(state.snapshot, scenario).toBeNull();
      expect(state.assessment, scenario).toBeNull();
    }
    const { controller } = controllerFor("stale");
    await controller.read();
    expect(controller.state().freshness).toBe("STALE");
    const empty = controllerFor("empty");
    await empty.controller.read();
    expect(empty.controller.state().freshness).toBe("CURRENT");
  });

  it("drops the rows when a ready read is followed by a withdrawn grant", async () => {
    const { port, controller } = controllerFor();
    await controller.read();
    expect(controller.state().snapshot).not.toBeNull();
    port.synthetic("revoke-grant");
    await controller.read();
    expect(controller.state()).toMatchObject({ readState: "denied", readCode: "GRANT_REVOKED", snapshot: null, assessment: null });
  });

  it("maps invalid, tuple-changed, and not-bound reads to their own state", async () => {
    const invalid = new CreditServicingController(scriptedPort({ read: { kind: "invalid-request", code: "SCOPE", detail: "d" } }));
    await invalid.read();
    expect(invalid.state()).toMatchObject({ readState: "invalid", readCode: "SCOPE" });
    const { controller: changed } = controllerFor("clean", { expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, protocolMergeSha: "0".repeat(40) } });
    await changed.read();
    expect(changed.state()).toMatchObject({ readState: "tuple-changed", snapshot: null });
    const notBound = new CreditServicingController(createNotBoundCreditServicing());
    await notBound.read();
    expect(notBound.state()).toMatchObject({ readState: "not-bound", readDetail: SERVICING_NOT_BOUND_REASON });
  });

  it("switches scope into a new context, clears the earlier rows, and gets a denial for a foreign obligation", async () => {
    const { controller } = controllerFor();
    await controller.read();
    const before = controller.state().context.key;
    const next = controller.switchScope(SERVICING_FOREIGN_REF);
    expect(next).toMatchObject({ incarnation: 2, scope: { obligationRef: SERVICING_FOREIGN_REF } });
    expect(next?.key).not.toBe(before);
    expect(controller.state()).toMatchObject({ snapshot: null, readState: "none", behind: false, last: null });
    await controller.read();
    expect(controller.state()).toMatchObject({ readState: "denied", readCode: "SCOPE_DENIED", snapshot: null });
  });

  it("switches actor into a new context and the capabilities decide which requests may be sent", async () => {
    const { controller } = controllerFor("unallocated");
    await controller.read();
    expect(controller.canSend("propose-allocation").allowed).toBe(true);
    const next = controller.switchActor(SERVICING_VIEWER_ACTOR);
    expect(next).toMatchObject({ incarnation: 2, actorRef: SERVICING_VIEWER_ACTOR });
    await controller.read();
    const state = controller.state();
    expect(state.readState).toBe("ready");
    expect(state.snapshot?.payments.some((row) => row.paymentRef === "pmt-0003")).toBe(true);
    expect(controller.canSend("propose-allocation").reason).toContain("no propose capability");
    expect(controller.canSend("approve-proposal").reason).toContain("no approve capability");
    expect(await controller.proposeAllocation("pmt-0003", "ins-0002")).toMatchObject({ kind: "NOT_SENT", reason: "blocked" });
  });

  it("drops a read that lands after the context changed, and an older read behind a newer one", async () => {
    const held = spyOn(createStubCreditServicing(), { holdReads: true });
    const controller = new CreditServicingController(held.port);
    const inFlight = controller.read();
    controller.switchScope(SERVICING_FOREIGN_REF);
    held.heldReads[0]?.release();
    expect(await inFlight).toEqual({ kind: "DROPPED", cause: "context-changed" });
    expect(controller.state()).toMatchObject({ snapshot: null, readState: "none" });
    expect(controller.state().counters.droppedReads).toBe(1);

    const staged = spyOn(createStubCreditServicing(), { holdReads: true });
    const other = new CreditServicingController(staged.port);
    const older = other.read();
    const newer = other.read();
    staged.heldReads[1]?.release();
    expect(await newer).toEqual({ kind: "APPLIED", readState: "ready" });
    staged.heldReads[0]?.release();
    expect(await older).toEqual({ kind: "DROPPED", cause: "older-read" });
    expect(other.state().counters.droppedReads).toBe(1);
  });

  it("notifies subscribers and stops when they unsubscribe", async () => {
    const { controller } = controllerFor();
    let calls = 0;
    const off = controller.subscribe(() => {
      calls += 1;
    });
    await controller.read();
    expect(calls).toBeGreaterThan(0);
    off();
    const seen = calls;
    await controller.read();
    expect(calls).toBe(seen);
  });
});

describe("servicing controller requests", () => {
  it("sends nothing before a ready read and names why", async () => {
    const { port, controller } = controllerFor();
    expect(await controller.proposeAllocation("pmt-0001", "ins-0002")).toMatchObject({ kind: "NOT_SENT", reason: "no-snapshot" });
    expect(await controller.proposeCaseTransition("to-recovery")).toMatchObject({ kind: "NOT_SENT", reason: "no-snapshot" });
    expect(await controller.approveProposal("prp-0001")).toMatchObject({ kind: "NOT_SENT", reason: "no-snapshot" });
    expect(port.effects().acts).toBe(0);
    expect(controller.state().counters.notSent).toBe(3);
    expect(controller.canSend("propose-allocation")).toMatchObject({ allowed: false });
  });

  it("builds an allocation proposal from the read and records it, never applies it, once", async () => {
    const spy = spyOn(createStubCreditServicing({ scenario: "unallocated" }));
    const controller = new CreditServicingController(spy.port);
    await controller.read();
    const result = await controller.proposeAllocation("pmt-0003", "ins-0002");
    expect(result.kind).toBe("APPLIED");
    expect(spy.actRequests).toHaveLength(1);
    expect(spy.actRequests[0]?.action).toEqual({ kind: "propose-allocation", paymentRef: "pmt-0003", installmentRef: "ins-0002" });
    expect(spy.actRequests[0]?.contextKey).toBe(controller.state().context.key);
    const state = controller.state();
    expect(state.behind).toBe(true);
    expect(state.fence).toBeNull();
    expect(state.last).toMatchObject({ phase: "applied", receipt: { kind: "propose-allocation", proposalRef: "prp-0002", stateAfter: "proposal-recorded" } });
    // A recorded proposal applied nothing: the read's payment stays unallocated on screen.
    expect(state.snapshot?.payments.find((row) => row.paymentRef === "pmt-0003")).toMatchObject({ state: "unallocated" });
    expect(controller.canSend("propose-adjustment").reason).toContain("Read again");
    expect(await controller.proposeAdjustment("ins-0002", "note", "x")).toMatchObject({ kind: "NOT_SENT", reason: "stale-read" });
    await controller.read();
    const after = controller.state();
    expect(after.behind).toBe(false);
    expect(after.snapshot?.proposals[0]).toMatchObject({ proposalRef: "prp-0002", state: "pending", actorRef: SERVICING_DESK_ACTOR });
    expect(spy.actRequests).toHaveLength(1);
  });

  it("refuses to send a request whose references the read does not list", async () => {
    const { port, controller } = controllerFor("unallocated");
    await controller.read();
    expect(await controller.proposeAllocation("pmt-0099", "ins-0002")).toMatchObject({ kind: "NOT_SENT", reason: "unknown-ref" });
    expect(await controller.proposeAllocation("pmt-0001", "ins-0002")).toMatchObject({ kind: "NOT_SENT", reason: "unknown-ref" });
    expect(await controller.proposeAllocation("pmt-0003", "ins-0001")).toMatchObject({ kind: "NOT_SENT", reason: "unknown-ref" });
    expect(await controller.proposeAdjustment("ins-0001", "note", "x")).toMatchObject({ kind: "NOT_SENT", reason: "unknown-ref" });
    expect(await controller.approveProposal("prp-0099")).toMatchObject({ kind: "NOT_SENT", reason: "blocked" });
    expect(await controller.proposeCaseTransition("to-closed")).toMatchObject({ kind: "NOT_SENT", reason: "unknown-ref" });
    expect(port.effects().acts).toBe(0);

    const approver = controllerFor("proposal-pending", { actorRef: SERVICING_APPROVER_ACTOR });
    await approver.controller.read();
    expect(await approver.controller.approveProposal("prp-0099")).toMatchObject({ kind: "NOT_SENT", reason: "unknown-ref" });
    expect(approver.port.effects().acts).toBe(0);
  });

  it("keeps the desk actor's approval off and the viewer's proposal off, with the capability named", async () => {
    const desk = controllerFor("proposal-pending");
    await desk.controller.read();
    expect(desk.controller.canSend("approve-proposal").reason).toContain("no approve capability");
    expect(await desk.controller.approveProposal("prp-0001")).toMatchObject({ kind: "NOT_SENT", reason: "blocked" });
    expect(desk.port.effects().acts).toBe(0);

    const viewer = controllerFor("unallocated", { actorRef: SERVICING_VIEWER_ACTOR });
    await viewer.controller.read();
    expect(await viewer.controller.proposeAllocation("pmt-0003", "ins-0002")).toMatchObject({ kind: "NOT_SENT", reason: "blocked" });
    expect(viewer.port.effects().acts).toBe(0);
  });

  it("applies a proposal only when a different actor approves it, and the lanes come from a fresh read", async () => {
    const spy = spyOn(createStubCreditServicing({ scenario: "proposal-pending" }));
    const controller = new CreditServicingController(spy.port, { actorRef: SERVICING_APPROVER_ACTOR });
    await controller.read();
    expect(controller.canSend("approve-proposal").allowed).toBe(true);
    const result = await controller.approveProposal("prp-0001");
    expect(result).toMatchObject({ kind: "APPLIED", record: { phase: "applied", receipt: { kind: "approve-proposal", stateAfter: "applied" } } });
    expect(spy.actRequests[0]?.action).toEqual({ kind: "approve-proposal", proposalRef: "prp-0001" });
    expect(spy.actRequests[0]?.actorRef).toBe(SERVICING_APPROVER_ACTOR);
    await controller.read();
    const snapshot = controller.state().snapshot;
    expect(snapshot?.proposals[0]).toMatchObject({ state: "applied" });
    expect(snapshot?.payments.find((row) => row.paymentRef === "pmt-0003")).toMatchObject({ state: "allocated" });
    expect(snapshot?.installments.find((row) => row.installmentRef === "ins-0002")).toMatchObject({ state: "satisfied" });
  });

  it("shows a business rejection as a rejection, marks the view behind, and does not fence", async () => {
    const { controller } = controllerFor("self-approval", { actorRef: SERVICING_APPROVER_ACTOR });
    await controller.read();
    const result = await controller.approveProposal("prp-0001");
    expect(result).toMatchObject({ kind: "REJECTED", record: { phase: "rejected", code: "SELF_APPROVAL" } });
    const state = controller.state();
    expect(state.fence).toBeNull();
    expect(state.behind).toBe(true);
    expect(state.snapshot?.proposals[0]).toMatchObject({ state: "pending" });
    await controller.read();
    expect(controller.state().snapshot?.proposals[0]).toMatchObject({ state: "pending" });
  });

  it("sends once, treats a lost answer as unknown, fences every later request, and does not lift the fence on a read", async () => {
    const spy = spyOn(createStubCreditServicing({ scenario: "act-lost" }));
    const controller = new CreditServicingController(spy.port);
    await controller.read();
    const result = await controller.proposeAdjustment("ins-0002", "note", "x");
    expect(result).toMatchObject({ kind: "UNKNOWN", record: { phase: "unknown" } });
    expect(spy.actRequests).toHaveLength(1);
    const state = controller.state();
    expect(state.fence).toMatchObject({ reason: "unknown-outcome", action: "propose-adjustment" });
    expect(state.last?.detail).toContain("never arrived");
    expect(await controller.proposeAdjustment("ins-0003", "note", "x")).toMatchObject({ kind: "FENCED", fence: { reason: "unknown-outcome" } });
    expect(await controller.proposeCaseTransition("to-recovery")).toMatchObject({ kind: "FENCED" });
    await controller.read();
    expect(controller.state().snapshot?.proposals[0]).toMatchObject({ state: "pending" });
    expect(controller.state().fence).toMatchObject({ reason: "unknown-outcome" });
    expect(await controller.proposeCaseTransition("to-recovery")).toMatchObject({ kind: "FENCED" });
    expect(spy.actRequests).toHaveLength(1);
    expect(controller.canSend("propose-adjustment").reason).toContain("unknown outcome");
  });

  it("treats an untrusted answer as unknown too, because the request may have applied", async () => {
    const { port, controller } = controllerFor("approve-claims-closure", { actorRef: SERVICING_APPROVER_ACTOR });
    await controller.read();
    const result = await controller.approveProposal("prp-0001");
    expect(result).toMatchObject({ kind: "UNKNOWN", record: { phase: "refused", code: "CLAIM" } });
    expect(controller.state().fence).toMatchObject({ reason: "unknown-outcome" });
    expect(port.effects().acts).toBe(1);
    expect(await controller.approveProposal("prp-0001")).toMatchObject({ kind: "FENCED" });
    expect(port.effects().acts).toBe(1);
  });

  it("serialises requests: one in flight, a second is fenced, and the context cannot change under it", async () => {
    const spy = spyOn(createStubCreditServicing({ scenario: "unallocated" }), { holdActs: true });
    const controller = new CreditServicingController(spy.port);
    await controller.read();
    const first = controller.proposeAllocation("pmt-0003", "ins-0002");
    await Promise.resolve();
    expect(controller.state().fence).toEqual({ reason: "in-flight", action: "propose-allocation" });
    expect(await controller.proposeAdjustment("ins-0002", "note", "x")).toMatchObject({ kind: "FENCED", fence: { reason: "in-flight" } });
    expect(controller.switchScope(SERVICING_FOREIGN_REF)).toBeNull();
    expect(controller.switchActor(SERVICING_APPROVER_ACTOR)).toBeNull();
    expect(controller.state().context.incarnation).toBe(1);
    expect(spy.actRequests).toHaveLength(1);
    spy.heldActs[0]?.release();
    expect(await first).toMatchObject({ kind: "APPLIED" });
    expect(controller.state().fence).toBeNull();
  });

  it("counts an unknown outcome of an earlier context and does not forget it", async () => {
    const { controller } = controllerFor("act-lost");
    await controller.read();
    await controller.proposeAdjustment("ins-0002", "note", "x");
    expect(controller.state().fence).not.toBeNull();
    controller.switchScope(SERVICING_OWN_REF);
    expect(controller.state()).toMatchObject({ fence: null, earlierUnknown: 1 });
    controller.switchActor(SERVICING_APPROVER_ACTOR);
    expect(controller.state().context.actorRef).toBe(SERVICING_APPROVER_ACTOR);
  });

  it("is not sent on a not-bound port, and the port is never called", async () => {
    const port = createNotBoundCreditServicing();
    let calls = 0;
    const counted: ServicingPort = {
      ...port,
      act(request) {
        calls += 1;
        return port.act(request);
      },
    };
    const controller = new CreditServicingController(counted);
    await controller.read();
    expect(await controller.proposeAllocation("pmt-0001", "ins-0002")).toMatchObject({ kind: "NOT_SENT", reason: "not-bound" });
    expect(await controller.approveProposal("prp-0001")).toMatchObject({ kind: "NOT_SENT", reason: "not-bound" });
    expect(controller.canSend("propose-allocation")).toEqual({ allowed: false, reason: SERVICING_NOT_BOUND_REASON });
    expect(calls).toBe(0);
  });

  it("records a withdrawn grant and a changed tuple as rejected requests, without a fence", async () => {
    const { port, controller } = controllerFor();
    await controller.read();
    port.synthetic("revoke-grant");
    expect(await controller.proposeAdjustment("ins-0002", "note", "x")).toMatchObject({
      kind: "REJECTED",
      record: { phase: "denied", code: "GRANT_REVOKED" },
    });
    expect(controller.state().fence).toBeNull();

    const scripted = new CreditServicingController(
      scriptedPort({
        read: (await createStubCreditServicing().read({
          contextKey: "k",
          actorRef: SERVICING_DESK_ACTOR,
          scope: { tenantId: SERVICING_TENANT, obligationRef: SERVICING_OWN_REF },
          watermarkFloor: null,
        })) as ServicingReadOutcome,
        act: { kind: "tuple-changed", field: "protocolMergeSha", expected: "a", actual: "b" },
      }),
    );
    await scripted.read();
    expect(await scripted.proposeAdjustment("ins-0002", "note", "x")).toMatchObject({ kind: "REJECTED", record: { phase: "tuple-changed" } });
    expect(scripted.state().behind).toBe(false);
    expect(scripted.state().fence).toBeNull();
  });
});
