import { describe, expect, it } from "vitest";
import {
  CreditOriginationController,
  DISCOVERY_READ_TUPLE_LITERALS,
  ORIGINATION_DESK_ACTOR,
  ORIGINATION_FOREIGN_REF,
  ORIGINATION_NOT_BOUND_REASON,
  ORIGINATION_OWN_REF,
  ORIGINATION_TENANT,
  createNotBoundCreditOrigination,
  createStubCreditOrigination,
  type OriginationActOutcome,
  type OriginationActRequest,
  type OriginationPort,
  type OriginationReadOutcome,
  type OriginationReadRequest,
  type OriginationScenario,
  type StubCreditOrigination,
  type StubCreditOriginationOptions,
} from "../src/index.js";

function controllerFor(
  scenario: OriginationScenario = "clean",
  options: { actorRef?: string; applicantRef?: string; expectedTuple?: StubCreditOriginationOptions["expectedTuple"] } = {},
) {
  const port = createStubCreditOrigination({ scenario, expectedTuple: options.expectedTuple });
  const controller = new CreditOriginationController(port, { actorRef: options.actorRef, applicantRef: options.applicantRef });
  return { port, controller };
}

/** Records every call and can hold a read or a request so ordering can be staged. */
function spyOn(inner: StubCreditOrigination, options: { holdReads?: boolean; holdActs?: boolean } = {}) {
  const readRequests: OriginationReadRequest[] = [];
  const actRequests: OriginationActRequest[] = [];
  const heldReads: { release: () => void }[] = [];
  const heldActs: { release: () => void }[] = [];
  const port: OriginationPort = {
    environment: inner.environment,
    source: inner.source,
    scenario: inner.scenario,
    read(request) {
      readRequests.push(structuredClone(request));
      if (!options.holdReads) {
        return inner.read(request);
      }
      return new Promise<OriginationReadOutcome>((resolve, reject) => {
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
      return new Promise<OriginationActOutcome>((resolve, reject) => {
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
function scriptedPort(script: { read?: OriginationReadOutcome; act?: OriginationActOutcome }): OriginationPort {
  return {
    environment: "stub",
    source: "synthetic-origination",
    scenario: "clean",
    read: () => Promise.resolve(script.read ?? { kind: "unknown", message: "unscripted read" }),
    act: () => Promise.resolve(script.act ?? { kind: "unknown", message: "unscripted act" }),
    synthetic: () => false,
  };
}

describe("origination controller context and reads", () => {
  it("keys the context on mode, domain, actor, tenant, applicant, and incarnation", () => {
    const { controller } = controllerFor();
    const context = controller.state().context;
    expect(context).toMatchObject({
      environment: "stub",
      actorRef: ORIGINATION_DESK_ACTOR,
      incarnation: 1,
      scope: { tenantId: ORIGINATION_TENANT, applicantRef: ORIGINATION_OWN_REF },
    });
    expect(context.key).toBe(`stub|${context.domain}|${ORIGINATION_DESK_ACTOR}|${ORIGINATION_TENANT}|${ORIGINATION_OWN_REF}|1`);
  });

  it("starts with no read, no fence, no record, and no usable freshness", () => {
    const { controller } = controllerFor();
    const state = controller.state();
    expect(state).toMatchObject({ readState: "none", freshness: "UNAVAILABLE", snapshot: null, assessment: null, behind: false, fence: null, last: null, earlierUnknown: 0 });
    expect(state.counters).toEqual({ reads: 0, acts: 0, notSent: 0, droppedReads: 0 });
  });

  it("applies a ready read with its assessment and holds its watermark as the next floor", async () => {
    const { port, readRequests } = spyOn(createStubCreditOrigination());
    const controller = new CreditOriginationController(port);
    expect(await controller.read()).toEqual({ kind: "APPLIED", readState: "ready" });
    const state = controller.state();
    expect(state.freshness).toBe("CURRENT");
    expect(state.snapshot?.application.state).toBe("not-started");
    expect(state.assessment).toMatchObject({ cutState: "single" });
    expect(readRequests[0]?.watermarkFloor).toBeNull();
    await controller.read();
    expect(readRequests[1]?.watermarkFloor).toBe(state.snapshot?.watermark);
    expect(controller.state().counters).toMatchObject({ reads: 2, acts: 0 });
  });

  it("clears the rows on every read that is not ready, and says which kind it was", async () => {
    const cases: [OriginationScenario, string, string | null][] = [
      ["empty", "empty", null],
      ["stale", "stale", null],
      ["denied", "denied", "GRANT_REVOKED"],
      ["claims-approval", "refused", "CLAIM"],
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
    expect(controllerFor("empty").controller.state().freshness).toBe("UNAVAILABLE");
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
    expect(controller.state()).toMatchObject({ readState: "denied", snapshot: null, assessment: null });
  });

  it("maps invalid, tuple-changed, and not-bound reads to their own state", async () => {
    const invalid = new CreditOriginationController(scriptedPort({ read: { kind: "invalid-request", code: "SCOPE", detail: "d" } }));
    await invalid.read();
    expect(invalid.state()).toMatchObject({ readState: "invalid", readCode: "SCOPE" });
    const { controller: changed } = controllerFor("clean", { expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, protocolMergeSha: "0".repeat(40) } });
    await changed.read();
    expect(changed.state()).toMatchObject({ readState: "tuple-changed", snapshot: null });
    const notBound = new CreditOriginationController(createNotBoundCreditOrigination());
    await notBound.read();
    expect(notBound.state()).toMatchObject({ readState: "not-bound", readDetail: ORIGINATION_NOT_BOUND_REASON });
  });

  it("switches scope into a new context, clears the earlier rows, and gets a denial for a foreign applicant", async () => {
    const { controller } = controllerFor();
    await controller.read();
    const before = controller.state().context.key;
    const next = controller.switchScope(ORIGINATION_FOREIGN_REF);
    expect(next).toMatchObject({ incarnation: 2, scope: { applicantRef: ORIGINATION_FOREIGN_REF } });
    expect(next?.key).not.toBe(before);
    expect(controller.state()).toMatchObject({ snapshot: null, readState: "none", behind: false, last: null });
    await controller.read();
    expect(controller.state()).toMatchObject({ readState: "denied", readCode: "SCOPE_DENIED", snapshot: null });
  });

  it("drops a read that lands after the scope changed, and an older read behind a newer one", async () => {
    const held = spyOn(createStubCreditOrigination(), { holdReads: true });
    const controller = new CreditOriginationController(held.port);
    const inFlight = controller.read();
    controller.switchScope(ORIGINATION_FOREIGN_REF);
    held.heldReads[0]?.release();
    expect(await inFlight).toEqual({ kind: "DROPPED", cause: "context-changed" });
    expect(controller.state()).toMatchObject({ snapshot: null, readState: "none" });
    expect(controller.state().counters.droppedReads).toBe(1);

    const staged = spyOn(createStubCreditOrigination(), { holdReads: true });
    const other = new CreditOriginationController(staged.port);
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

describe("origination controller requests", () => {
  it("sends nothing before a ready read and names why", async () => {
    const { port, controller } = controllerFor();
    expect(await controller.submit("1000")).toMatchObject({ kind: "NOT_SENT", reason: "no-snapshot" });
    expect(await controller.requestReReview()).toMatchObject({ kind: "NOT_SENT", reason: "no-snapshot" });
    expect(port.effects().acts).toBe(0);
    expect(controller.state().counters.notSent).toBe(2);
    expect(controller.canSend("submit")).toMatchObject({ allowed: false });
  });

  it("checks only the shape of the typed amount, before anything is sent", async () => {
    const { port, controller } = controllerFor();
    await controller.read();
    for (const bad of ["", "12.5", "-3", "1e3", "01", " 5", "five"]) {
      expect(await controller.submit(bad), bad).toMatchObject({ kind: "NOT_SENT", reason: "invalid-amount" });
    }
    expect(port.effects().acts).toBe(0);
  });

  it("builds the body from the read and sends it once, and an accepted request is not a decision", async () => {
    const spy = spyOn(createStubCreditOrigination());
    const controller = new CreditOriginationController(spy.port);
    await controller.read();
    const result = await controller.submit("1000");
    expect(result.kind).toBe("APPLIED");
    expect(spy.actRequests).toHaveLength(1);
    expect(spy.actRequests[0]?.action).toEqual({ kind: "submit", requestedAmount: "1000", claimRefs: ["clm-0001", "clm-0002"] });
    expect(spy.actRequests[0]?.contextKey).toBe(controller.state().context.key);
    const state = controller.state();
    expect(state.behind).toBe(true);
    expect(state.fence).toBeNull();
    expect(state.last).toMatchObject({ phase: "applied", receipt: { kind: "submit", decisionAfter: "pending" } });
    // The lanes on screen are still the read before the request. Nothing is inferred from the receipt.
    expect(state.snapshot?.application.state).toBe("not-started");
    expect(state.snapshot?.decision).toBeNull();
    expect(controller.canSend("re-review").reason).toContain("Read again");
    expect(await controller.requestReReview()).toMatchObject({ kind: "NOT_SENT", reason: "stale-read" });
    await controller.read();
    const after = controller.state();
    expect(after.behind).toBe(false);
    expect(after.snapshot?.application.state).toBe("submitted");
    expect(after.snapshot?.decision?.kind).toBe("pending");
    expect(spy.actRequests).toHaveLength(1);
  });

  it("does not send a request the read says the source does not offer", async () => {
    const approved = controllerFor("approved");
    await approved.controller.read();
    expect(await approved.controller.acceptCommitment()).toMatchObject({ kind: "NOT_SENT", reason: "blocked" });
    expect((await approved.controller.acceptCommitment()) as { detail: string }).toMatchObject({ detail: expect.stringContaining("An approval is not a commitment") });
    expect(await approved.controller.requestDrawdown()).toMatchObject({ kind: "NOT_SENT", reason: "blocked" });
    expect(approved.port.effects().acts).toBe(0);

    const stale = controllerFor("stale-policy");
    await stale.controller.read();
    expect(await stale.controller.requestDrawdown()).toMatchObject({ kind: "NOT_SENT", reason: "blocked" });
    expect(stale.port.effects().acts).toBe(0);
    expect(await stale.controller.requestReReview()).toMatchObject({ kind: "APPLIED" });
  });

  it("copies the commitment, document, and consent references from the read and never from the caller", async () => {
    const committed = spyOn(createStubCreditOrigination({ scenario: "committed" }));
    const a = new CreditOriginationController(committed.port);
    await a.read();
    expect(await a.requestDrawdown()).toMatchObject({ kind: "APPLIED" });
    expect(committed.actRequests[0]?.action).toEqual({ kind: "request-drawdown", commitmentRef: "cmt-0001" });
    await a.read();
    expect((await a.requestDrawdown()).kind).toBe("APPLIED");
    expect(a.state().snapshot?.drawdown.requests.map((row) => row.drawdownRef)).toEqual(["drw-0001"]);

    const offered = spyOn(createStubCreditOrigination({ scenario: "offered" }));
    const b = new CreditOriginationController(offered.port);
    await b.read();
    expect(await b.acceptCommitment()).toMatchObject({ kind: "APPLIED" });
    expect(offered.actRequests[0]?.action).toEqual({ kind: "accept-commitment", commitmentRef: "cmt-0001" });

    const docs = spyOn(createStubCreditOrigination({ scenario: "more-information" }));
    const c = new CreditOriginationController(docs.port);
    await c.read();
    expect(await c.provideDocument("doc-0001")).toMatchObject({ kind: "NOT_SENT", reason: "unknown-ref" });
    expect(await c.provideDocument("doc-9999")).toMatchObject({ kind: "NOT_SENT", reason: "unknown-ref" });
    expect(await c.provideDocument("doc-0003")).toMatchObject({ kind: "APPLIED" });
    expect(docs.actRequests.map((row) => row.action)).toEqual([{ kind: "correct", target: "document", ref: "doc-0003" }]);

    const consent = spyOn(createStubCreditOrigination({ scenario: "consent-withdrawn" }));
    const d = new CreditOriginationController(consent.port);
    await d.read();
    expect(await d.renewConsent("cns-0001")).toMatchObject({ kind: "NOT_SENT", reason: "unknown-ref" });
    expect(await d.renewConsent("cns-0002")).toMatchObject({ kind: "APPLIED" });
    expect(consent.actRequests.map((row) => row.action)).toEqual([{ kind: "correct", target: "consent", ref: "cns-0002" }]);
  });

  it("amends with the typed amount only, as a new request that leaves the decision pending", async () => {
    const spy = spyOn(createStubCreditOrigination({ scenario: "rejected" }));
    const controller = new CreditOriginationController(spy.port);
    await controller.read();
    expect(await controller.amend("2.5")).toMatchObject({ kind: "NOT_SENT", reason: "invalid-amount" });
    const result = await controller.amend("600");
    expect(result).toMatchObject({ kind: "APPLIED", record: { receipt: { revision: 2, decisionAfter: "pending" } } });
    expect(spy.actRequests.map((row) => row.action)).toEqual([{ kind: "correct", target: "application", requestedAmount: "600" }]);
    await controller.read();
    expect(controller.state().snapshot?.decision?.kind).toBe("pending");
  });

  it("shows a business rejection as a rejection, marks the view behind, and does not fence", async () => {
    const { controller } = controllerFor("limit-race");
    await controller.read();
    const result = await controller.requestDrawdown();
    expect(result).toMatchObject({ kind: "REJECTED", record: { phase: "rejected", code: "LIMIT_TAKEN" } });
    const state = controller.state();
    expect(state.fence).toBeNull();
    expect(state.behind).toBe(true);
    expect(state.snapshot?.limit.contention).toBe("none");
    await controller.read();
    const after = controller.state();
    expect(after.snapshot?.limit.contention).toBe("contended");
    expect(after.snapshot?.drawdown.requests).toEqual([]);
    expect(after.assessment?.limitState).toBe("contended-behind");
    expect(controller.canSend("request-drawdown").allowed).toBe(false);
  });

  it("sends once, treats a lost answer as unknown, fences every later request, and does not lift the fence on a read", async () => {
    const spy = spyOn(createStubCreditOrigination({ scenario: "act-lost" }));
    const controller = new CreditOriginationController(spy.port);
    await controller.read();
    const result = await controller.submit("1000");
    expect(result).toMatchObject({ kind: "UNKNOWN", record: { phase: "unknown" } });
    expect(spy.actRequests).toHaveLength(1);
    const state = controller.state();
    expect(state.fence).toMatchObject({ reason: "unknown-outcome", action: "submit" });
    expect(state.last?.detail).toContain("never arrived");
    expect(await controller.submit("1000")).toMatchObject({ kind: "FENCED", fence: { reason: "unknown-outcome" } });
    expect(await controller.requestReReview()).toMatchObject({ kind: "FENCED" });
    await controller.read();
    expect(controller.state().snapshot?.application.state).toBe("submitted");
    expect(controller.state().fence).toMatchObject({ reason: "unknown-outcome" });
    expect(await controller.requestReReview()).toMatchObject({ kind: "FENCED" });
    expect(spy.actRequests).toHaveLength(1);
    expect(controller.canSend("re-review").reason).toContain("unknown outcome");
  });

  it("treats an untrusted answer as unknown too, because the request may have applied", async () => {
    const { port, controller } = controllerFor("submit-claims-approval");
    await controller.read();
    const result = await controller.submit("1000");
    expect(result).toMatchObject({ kind: "UNKNOWN", record: { phase: "refused", code: "CLAIM" } });
    expect(controller.state().fence).toMatchObject({ reason: "unknown-outcome" });
    expect(port.effects().acts).toBe(1);
    expect(await controller.submit("1000")).toMatchObject({ kind: "FENCED" });
    expect(port.effects().acts).toBe(1);
  });

  it("serialises requests: one in flight, a second is fenced, and the scope cannot change under it", async () => {
    const spy = spyOn(createStubCreditOrigination(), { holdActs: true });
    const controller = new CreditOriginationController(spy.port);
    await controller.read();
    const first = controller.submit("1000");
    await Promise.resolve();
    expect(controller.state().fence).toEqual({ reason: "in-flight", action: "submit" });
    expect(await controller.submit("1000")).toMatchObject({ kind: "FENCED", fence: { reason: "in-flight" } });
    expect(controller.switchScope(ORIGINATION_FOREIGN_REF)).toBeNull();
    expect(controller.state().context.incarnation).toBe(1);
    expect(spy.actRequests).toHaveLength(1);
    spy.heldActs[0]?.release();
    expect(await first).toMatchObject({ kind: "APPLIED" });
    expect(controller.state().fence).toBeNull();
  });

  it("counts an unknown outcome of an earlier scope and does not forget it", async () => {
    const { controller } = controllerFor("act-lost");
    await controller.read();
    await controller.submit("1000");
    expect(controller.state().fence).not.toBeNull();
    controller.switchScope(ORIGINATION_OWN_REF);
    expect(controller.state()).toMatchObject({ fence: null, earlierUnknown: 1 });
  });

  it("is not sent on a not-bound port, and the port is never called", async () => {
    const port = createNotBoundCreditOrigination();
    let calls = 0;
    const counted: OriginationPort = {
      ...port,
      act(request) {
        calls += 1;
        return port.act(request);
      },
    };
    const controller = new CreditOriginationController(counted);
    await controller.read();
    expect(await controller.submit("1000")).toMatchObject({ kind: "NOT_SENT", reason: "not-bound" });
    expect(await controller.acceptCommitment()).toMatchObject({ kind: "NOT_SENT", reason: "not-bound" });
    expect(controller.canSend("submit")).toEqual({ allowed: false, reason: ORIGINATION_NOT_BOUND_REASON });
    expect(calls).toBe(0);
  });

  it("records a withdrawn grant and a changed tuple as rejected requests, without a fence", async () => {
    const { port, controller } = controllerFor();
    await controller.read();
    port.synthetic("revoke-grant");
    expect(await controller.submit("1000")).toMatchObject({ kind: "REJECTED", record: { phase: "denied", code: "GRANT_REVOKED" } });
    expect(controller.state().fence).toBeNull();

    const scripted = new CreditOriginationController(
      scriptedPort({
        read: (await createStubCreditOrigination().read({
          contextKey: "k",
          actorRef: ORIGINATION_DESK_ACTOR,
          scope: { tenantId: ORIGINATION_TENANT, applicantRef: ORIGINATION_OWN_REF },
          watermarkFloor: null,
        })) as OriginationReadOutcome,
        act: { kind: "tuple-changed", field: "protocolMergeSha", expected: "a", actual: "b" },
      }),
    );
    await scripted.read();
    expect(await scripted.submit("1000")).toMatchObject({ kind: "REJECTED", record: { phase: "tuple-changed" } });
    expect(scripted.state().behind).toBe(false);
    expect(scripted.state().fence).toBeNull();
  });
});
