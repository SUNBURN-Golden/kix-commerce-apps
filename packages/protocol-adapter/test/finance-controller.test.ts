import { describe, expect, it } from "vitest";
import {
  DISCOVERY_READ_TUPLE_LITERALS,
  FINANCE_APPROVER_ACTOR,
  FINANCE_FOREIGN_REF,
  FINANCE_NOT_BOUND_REASON,
  FINANCE_OWN_REF,
  FINANCE_REVIEWER_ACTOR,
  FINANCE_TENANT,
  FINANCE_VIEWER_ACTOR,
  FinanceOperationsController,
  createNotBoundFinanceOperations,
  createStubFinanceOperations,
  type FinanceActOutcome,
  type FinanceActRequest,
  type FinanceExportOutcome,
  type FinanceExportRequest,
  type FinanceOperationsPort,
  type FinanceReadOutcome,
  type FinanceReadRequest,
  type FinanceScenario,
  type StubFinanceOperations,
  type StubFinanceOperationsOptions,
} from "../src/index.js";

function controllerFor(
  scenario: FinanceScenario = "clean",
  options: { actorRef?: string; bookRef?: string; expectedTuple?: StubFinanceOperationsOptions["expectedTuple"] } = {},
) {
  const port = createStubFinanceOperations({ scenario, expectedTuple: options.expectedTuple });
  const controller = new FinanceOperationsController(port, { actorRef: options.actorRef ?? FINANCE_REVIEWER_ACTOR, bookRef: options.bookRef });
  return { port, controller };
}

/** Counts calls and can hold a read, an export, or a request so ordering can be staged. */
function spyOn(inner: StubFinanceOperations, options: { holdReads?: boolean; holdExports?: boolean; holdActs?: boolean } = {}) {
  const readRequests: FinanceReadRequest[] = [];
  const exportRequests: FinanceExportRequest[] = [];
  const actRequests: FinanceActRequest[] = [];
  const heldReads: { release: () => void }[] = [];
  const heldExports: { release: () => void }[] = [];
  const heldActs: { release: () => void }[] = [];
  const port: FinanceOperationsPort = {
    environment: inner.environment,
    source: inner.source,
    scenario: inner.scenario,
    read(request) {
      readRequests.push(structuredClone(request));
      if (!options.holdReads) {
        return inner.read(request);
      }
      return new Promise<FinanceReadOutcome>((resolve, reject) => {
        heldReads.push({ release: () => void inner.read(request).then(resolve, reject) });
      });
    },
    readExport(request) {
      exportRequests.push(structuredClone(request));
      if (!options.holdExports) {
        return inner.readExport(request);
      }
      return new Promise<FinanceExportOutcome>((resolve, reject) => {
        heldExports.push({ release: () => void inner.readExport(request).then(resolve, reject) });
      });
    },
    act(request) {
      actRequests.push(structuredClone(request));
      if (!options.holdActs) {
        return inner.act(request);
      }
      return new Promise<FinanceActOutcome>((resolve, reject) => {
        heldActs.push({ release: () => void inner.act(request).then(resolve, reject) });
      });
    },
    synthetic: (control) => inner.synthetic(control),
  };
  return { port, readRequests, exportRequests, actRequests, heldReads, heldExports, heldActs };
}

/** A port that delegates to another and overrides the calls a test wants to script. */
function wrap(base: FinanceOperationsPort, over: Partial<FinanceOperationsPort>): FinanceOperationsPort {
  return {
    environment: base.environment,
    source: base.source,
    scenario: base.scenario,
    read: (request) => base.read(request),
    readExport: (request) => base.readExport(request),
    act: (request) => base.act(request),
    synthetic: (control) => base.synthetic(control),
    ...over,
  };
}

/** A port that answers what the test says, for outcomes the stub does not produce. */
function scriptedPort(script: { read?: FinanceReadOutcome; export?: FinanceExportOutcome; act?: FinanceActOutcome }): FinanceOperationsPort {
  return {
    environment: "stub",
    source: "synthetic-finance",
    scenario: "clean",
    read: () => Promise.resolve(script.read ?? { kind: "unknown", message: "unscripted read" }),
    readExport: () => Promise.resolve(script.export ?? { kind: "unknown", message: "unscripted export" }),
    act: () => Promise.resolve(script.act ?? { kind: "unknown", message: "unscripted request" }),
    synthetic: () => false,
  };
}

describe("finance controller context and reads", () => {
  it("keys the context on mode, domain, actor, tenant, book, and incarnation", () => {
    const { controller } = controllerFor();
    const context = controller.state().context;
    expect(context).toMatchObject({
      environment: "stub",
      actorRef: FINANCE_REVIEWER_ACTOR,
      incarnation: 1,
      scope: { tenantId: FINANCE_TENANT, bookRef: FINANCE_OWN_REF },
    });
    expect(context.key).toBe(`stub|${context.domain}|${FINANCE_REVIEWER_ACTOR}|${FINANCE_TENANT}|${FINANCE_OWN_REF}|1`);
  });

  it("starts with no read, no export, no fence, and no usable freshness", () => {
    const { controller } = controllerFor();
    const state = controller.state();
    expect(state.readState).toBe("none");
    expect(state.freshness).toBe("UNAVAILABLE");
    expect(state.snapshot).toBeNull();
    expect(state.assessment).toBeNull();
    expect(state.export).toMatchObject({ phase: "none", value: null, verdict: null });
    expect(state.behind).toBe(false);
    expect(state.fence).toBeNull();
    expect(state.last).toBeNull();
    expect(state.earlierUnknown).toBe(0);
    expect(state.counters).toEqual({ reads: 0, exports: 0, acts: 0, notSent: 0, droppedReads: 0, droppedExports: 0 });
  });

  it("applies a ready read with its assessment and holds its watermark as the next floor", async () => {
    const { port, readRequests } = spyOn(createStubFinanceOperations());
    const controller = new FinanceOperationsController(port);
    expect(await controller.read()).toEqual({ kind: "APPLIED", readState: "ready" });
    const state = controller.state();
    expect(state.freshness).toBe("CURRENT");
    expect(state.snapshot?.cases).toHaveLength(7);
    expect(state.assessment?.cutAlignment).toBe("aligned");
    expect(readRequests[0]?.watermarkFloor).toBeNull();
    await controller.read();
    expect(readRequests[1]?.watermarkFloor).toBe(state.snapshot?.watermark);
    expect(controller.state().counters.reads).toBe(2);
  });

  it("clears the rows and the export on every read that is not ready, and says which kind it was", async () => {
    const cases: [FinanceScenario, string, "CURRENT" | "STALE" | "UNAVAILABLE"][] = [
      ["empty", "empty", "CURRENT"],
      ["stale", "stale", "STALE"],
      ["denied", "denied", "UNAVAILABLE"],
      ["claims-forced", "refused", "UNAVAILABLE"],
      ["scope-leak", "refused", "UNAVAILABLE"],
      ["read-lost", "unavailable", "UNAVAILABLE"],
    ];
    for (const [scenario, expected, freshness] of cases) {
      const { controller } = controllerFor(scenario);
      await controller.read();
      const state = controller.state();
      expect(state.readState, scenario).toBe(expected);
      expect(state.freshness, scenario).toBe(freshness);
      expect(state.snapshot, scenario).toBeNull();
      expect(state.assessment, scenario).toBeNull();
      expect(state.export.phase, scenario).toBe("none");
    }
    const refused = controllerFor("claims-forced");
    await refused.controller.read();
    expect(refused.controller.state()).toMatchObject({ readCode: "CLAIM" });
    const lost = controllerFor("read-lost");
    await lost.controller.read();
    expect(lost.controller.state().readDetail).toContain("never arrived");
  });

  it("drops the rows and the export when a ready read is followed by a withdrawn grant", async () => {
    const { port, controller } = controllerFor();
    await controller.read();
    await controller.loadExport();
    expect(controller.state().export.phase).toBe("loaded");
    port.synthetic("revoke-grant");
    await controller.read();
    expect(controller.state()).toMatchObject({ readState: "denied", readCode: "GRANT_REVOKED", snapshot: null });
    expect(controller.state().export).toMatchObject({ phase: "none", value: null });
  });

  it("maps invalid, tuple-changed, and not-bound reads to their own state", async () => {
    const changed = controllerFor("clean", { expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, protocolMergeSha: "0".repeat(40) } });
    await changed.controller.read();
    expect(changed.controller.state()).toMatchObject({ readState: "tuple-changed" });
    expect(changed.controller.state().readDetail).toContain("protocolMergeSha");
    const invalid = new FinanceOperationsController(
      scriptedPort({ read: { kind: "invalid-request", code: "SCOPE", detail: "A scope names a book." } }),
    );
    await invalid.read();
    expect(invalid.state()).toMatchObject({ readState: "invalid", readCode: "SCOPE" });
    const notBound = new FinanceOperationsController(createNotBoundFinanceOperations());
    await notBound.read();
    expect(notBound.state()).toMatchObject({ readState: "not-bound", readDetail: FINANCE_NOT_BOUND_REASON, snapshot: null });
    expect(notBound.state().context.environment).toBe("integration-http");
  });

  it("switches scope into a new context, clears the earlier rows and export, and gets a denial for a foreign book", async () => {
    const { controller } = controllerFor();
    await controller.read();
    await controller.loadExport();
    const before = controller.state().context;
    const next = controller.switchScope(FINANCE_FOREIGN_REF);
    expect(next).toMatchObject({ incarnation: 2, scope: { bookRef: FINANCE_FOREIGN_REF } });
    expect(next?.key).not.toBe(before.key);
    expect(controller.state()).toMatchObject({ readState: "none", snapshot: null });
    expect(controller.state().export).toMatchObject({ phase: "none", value: null });
    await controller.read();
    expect(controller.state()).toMatchObject({ readState: "denied", readCode: "SCOPE_DENIED", snapshot: null });
  });

  it("switches actor into a new context, and the capabilities decide which exports and requests may be sent", async () => {
    const { controller } = controllerFor();
    await controller.read();
    expect(controller.canExport().allowed).toBe(true);
    expect(controller.canSend("propose-correction").allowed).toBe(true);
    expect(controller.canSend("approve-proposal").allowed).toBe(false);
    const toApprover = controller.switchActor(FINANCE_APPROVER_ACTOR);
    expect(toApprover).toMatchObject({ incarnation: 2, actorRef: FINANCE_APPROVER_ACTOR });
    expect(controller.state().snapshot).toBeNull();
    await controller.read();
    expect(controller.canSend("propose-correction").reason).toContain("holds no propose capability");
    controller.switchActor(FINANCE_VIEWER_ACTOR);
    await controller.read();
    expect(controller.canExport().reason).toContain("holds no export capability");
    expect(controller.canSend("approve-proposal").reason).toContain("holds no approve capability");
  });

  it("drops a read that lands after the context changed, and an older read behind a newer one", async () => {
    const spy = spyOn(createStubFinanceOperations(), { holdReads: true });
    const controller = new FinanceOperationsController(spy.port);
    const stale = controller.read();
    controller.switchScope(FINANCE_FOREIGN_REF);
    spy.heldReads[0]?.release();
    expect(await stale).toEqual({ kind: "DROPPED", cause: "context-changed" });
    expect(controller.state()).toMatchObject({ readState: "none", snapshot: null });

    const first = controller.read();
    const second = controller.read();
    spy.heldReads[2]?.release();
    expect(await second).toMatchObject({ kind: "APPLIED" });
    spy.heldReads[1]?.release();
    expect(await first).toEqual({ kind: "DROPPED", cause: "older-read" });
    expect(controller.state().counters.droppedReads).toBe(2);
  });

  it("notifies subscribers and stops when they unsubscribe", async () => {
    const { controller } = controllerFor();
    let calls = 0;
    const off = controller.subscribe(() => {
      calls += 1;
    });
    await controller.read();
    const seen = calls;
    expect(seen).toBeGreaterThan(0);
    off();
    await controller.read();
    expect(calls).toBe(seen);
  });
});

describe("finance controller export", () => {
  it("sends no export before a ready read, and names why", async () => {
    const spy = spyOn(createStubFinanceOperations());
    const controller = new FinanceOperationsController(spy.port);
    expect(controller.canExport()).toEqual({ allowed: false, reason: "An export is judged against the last read. Read the queue first." });
    expect(await controller.loadExport()).toMatchObject({ kind: "NOT_SENT", reason: "no-snapshot" });
    expect(spy.exportRequests).toHaveLength(0);
    expect(controller.state().counters).toMatchObject({ exports: 0, notSent: 1 });
    expect(controller.state().export.phase).toBe("none");
  });

  it("sends no export for an actor that holds none, and never calls the port", async () => {
    const spy = spyOn(createStubFinanceOperations());
    const controller = new FinanceOperationsController(spy.port, { actorRef: FINANCE_VIEWER_ACTOR });
    await controller.read();
    expect(await controller.loadExport()).toMatchObject({ kind: "NOT_SENT", reason: "no-capability" });
    expect(spy.exportRequests).toHaveLength(0);
    expect(controller.state().export.phase).toBe("none");
  });

  it("is not sent on a not-bound port, and the port is never called", async () => {
    const port = createNotBoundFinanceOperations();
    let called = 0;
    const counting: FinanceOperationsPort = {
      ...port,
      readExport: (request) => {
        called += 1;
        return port.readExport(request);
      },
    };
    const controller = new FinanceOperationsController(counting);
    expect(controller.canExport()).toEqual({ allowed: false, reason: FINANCE_NOT_BOUND_REASON });
    expect(await controller.loadExport()).toMatchObject({ kind: "NOT_SENT", reason: "not-bound" });
    expect(called).toBe(0);
    expect(controller.state().export).toMatchObject({ phase: "not-bound", detail: FINANCE_NOT_BOUND_REASON, value: null });
  });

  it("loads one export after a ready read and judges it against that read", async () => {
    const spy = spyOn(createStubFinanceOperations());
    const controller = new FinanceOperationsController(spy.port);
    await controller.read();
    expect(await controller.loadExport()).toEqual({ kind: "APPLIED", phase: "loaded" });
    expect(spy.exportRequests).toHaveLength(1);
    const exported = controller.state().export;
    expect(exported.verdict).toEqual({ state: "current" });
    expect(exported.value?.rows).toHaveLength(13);
    expect(exported.value?.scopeDeclaration).toMatchObject({ provenance: "synthetic", realMoney: false });
  });

  it("re-judges the export each time state is read, so a source that moved on turns it stale without a second export", async () => {
    const { port, controller } = controllerFor();
    await controller.read();
    await controller.loadExport();
    expect(controller.state().export.verdict).toEqual({ state: "current" });
    port.synthetic("advance-cut");
    await controller.read();
    expect(controller.state().export.verdict).toEqual({ state: "withheld", reasons: ["STALE_CUT"] });
    expect(controller.state().counters.exports).toBe(1);
    await controller.loadExport();
    expect(controller.state().export.verdict).toEqual({ state: "current" });
  });

  it("withholds the export of a read whose sources are skewed", async () => {
    const { controller } = controllerFor("source-cut-skew");
    await controller.read();
    await controller.loadExport();
    expect(controller.state().export.verdict).toEqual({ state: "withheld", reasons: ["SOURCES_SKEWED"] });
  });

  it("keeps denied, refused, lost, and withheld exports as their own phases, with no value for the refused", async () => {
    for (const [scenario, phase, code] of [
      ["export-denied", "denied", "EXPORT_DENIED"],
      ["export-claims-real", "refused", "CLAIM"],
    ] as const) {
      const { controller } = controllerFor(scenario);
      await controller.read();
      await controller.loadExport();
      expect(controller.state().export, scenario).toMatchObject({ phase, code, value: null, verdict: null });
    }
    const partial = controllerFor("export-partial");
    await partial.controller.read();
    await partial.controller.loadExport();
    expect(partial.controller.state().export.verdict).toEqual({ state: "withheld", reasons: ["PARTIAL", "COUNT", "ROWS_DIFFER"] });
    const unavailable = new FinanceOperationsController(
      wrap(createStubFinanceOperations(), { readExport: () => Promise.reject(new Error("The export never arrived.")) }),
    );
    await unavailable.read();
    await unavailable.loadExport();
    expect(unavailable.state().export).toMatchObject({ phase: "unavailable", detail: "The export never arrived." });
    expect(unavailable.state().counters.exports).toBe(1);
  });

  it("maps invalid, tuple-changed, and not-bound export answers to their own phase", async () => {
    for (const [outcome, phase] of [
      [{ kind: "invalid-request", code: "SCOPE", detail: "bad" }, "invalid"],
      [{ kind: "tuple-changed", field: "sdkTuple", expected: "a", actual: "b" }, "tuple-changed"],
      [{ kind: "not-bound", reason: "no producer" }, "not-bound"],
    ] as const) {
      const controller = new FinanceOperationsController(
        wrap(createStubFinanceOperations(), { readExport: () => Promise.resolve(outcome as FinanceExportOutcome) }),
      );
      await controller.read();
      await controller.loadExport();
      expect(controller.state().export.phase).toBe(phase);
    }
  });

  it("drops an export that lands after the read stopped being ready, and shows no export with no row", async () => {
    const spy = spyOn(createStubFinanceOperations(), { holdExports: true });
    const controller = new FinanceOperationsController(spy.port);
    await controller.read();
    const pending = controller.loadExport();
    spy.port.synthetic("revoke-grant");
    await controller.read();
    expect(controller.state()).toMatchObject({ readState: "denied", snapshot: null });
    spy.heldExports[0]?.release();
    expect(await pending).toEqual({ kind: "DROPPED", cause: "read-not-ready" });
    expect(controller.state().export).toMatchObject({ phase: "none", value: null, verdict: null });
    expect(controller.state().counters).toMatchObject({ exports: 1, droppedExports: 1 });
  });

  it("drops an export that lands after the context changed, and an older export behind a newer one", async () => {
    const spy = spyOn(createStubFinanceOperations(), { holdExports: true });
    const controller = new FinanceOperationsController(spy.port);
    await controller.read();
    const stale = controller.loadExport();
    controller.switchScope(FINANCE_FOREIGN_REF);
    spy.heldExports[0]?.release();
    expect(await stale).toEqual({ kind: "DROPPED", cause: "context-changed" });
    expect(controller.state().export.phase).toBe("none");

    controller.switchScope(FINANCE_OWN_REF);
    await controller.read();
    const first = controller.loadExport();
    const second = controller.loadExport();
    spy.heldExports[2]?.release();
    expect(await second).toMatchObject({ kind: "APPLIED" });
    spy.heldExports[1]?.release();
    expect(await first).toEqual({ kind: "DROPPED", cause: "older-export" });
    expect(controller.state().counters.droppedExports).toBe(2);
  });
});

describe("finance controller requests", () => {
  it("sends nothing before a ready read and names why", async () => {
    const spy = spyOn(createStubFinanceOperations());
    const controller = new FinanceOperationsController(spy.port);
    expect(controller.canSend("propose-correction").reason).toBe("Requests are built from the last read. Read the queue first.");
    expect(await controller.proposeCorrection("rcs-0001", "link-observation", "n")).toMatchObject({ kind: "NOT_SENT", reason: "no-snapshot" });
    expect(await controller.approveProposal("prp-0001")).toMatchObject({ kind: "NOT_SENT", reason: "no-snapshot" });
    expect(spy.actRequests).toHaveLength(0);
    expect(controller.state().counters).toMatchObject({ acts: 0, notSent: 2 });
  });

  it("builds a proposal from the read and records it once, and applies nothing", async () => {
    const spy = spyOn(createStubFinanceOperations());
    const controller = new FinanceOperationsController(spy.port);
    await controller.read();
    const before = controller.state().snapshot;
    const result = await controller.proposeCorrection("rcs-0001", "link-observation", "  Link it to the later payment.  ");
    expect(result.kind).toBe("APPLIED");
    expect(spy.actRequests).toHaveLength(1);
    expect(spy.actRequests[0]?.action).toEqual({ kind: "propose-correction", caseRef: "rcs-0001", correction: "link-observation", note: "Link it to the later payment." });
    const state = controller.state();
    expect(state.last).toMatchObject({
      seq: 1,
      phase: "applied",
      receipt: { kind: "proposal-recorded", proposalRef: "prp-0001", economicStateChanged: false, confirmationForcesMatch: false },
    });
    expect(state.behind).toBe(true);
    expect(state.fence).toBeNull();
    // The rows on screen are still the last read's. Only the next read shows the proposal.
    expect(state.snapshot).toBe(before);
    expect(state.snapshot?.proposals).toEqual([]);
    expect(state.counters.acts).toBe(1);
    await controller.read();
    expect(controller.state().behind).toBe(false);
    expect(controller.state().snapshot?.proposals).toHaveLength(1);
    expect(controller.state().snapshot?.cases.find((row) => row.caseRef === "rcs-0001")).toMatchObject({ state: "open", differenceAmount: "1100" });
  });

  it("refuses to send a request whose references the read does not list", async () => {
    const spy = spyOn(createStubFinanceOperations());
    const controller = new FinanceOperationsController(spy.port);
    await controller.read();
    expect(await controller.proposeCorrection("rcs-0099", "link-observation", "n")).toMatchObject({ kind: "NOT_SENT", reason: "unknown-ref" });
    expect(await controller.proposeCorrection("rcs-0008", "link-observation", "n")).toMatchObject({ kind: "NOT_SENT", reason: "unknown-ref" });
    expect(await controller.proposeCorrection("rcs-0001", "mark-duplicate", "n")).toMatchObject({ kind: "NOT_SENT", reason: "unknown-ref" });
    expect(await controller.proposeCorrection("rcs-0001", "link-observation", "   ")).toMatchObject({ kind: "NOT_SENT", reason: "bad-note" });
    expect(spy.actRequests).toHaveLength(0);
    expect(controller.state().counters).toMatchObject({ acts: 0, notSent: 4 });
    expect(controller.state().behind).toBe(false);
  });

  it("offers only a request to look again on a case whose sides are on skewed cuts", async () => {
    const spy = spyOn(createStubFinanceOperations({ scenario: "source-cut-skew" }));
    const controller = new FinanceOperationsController(spy.port);
    await controller.read();
    expect(await controller.proposeCorrection("rcs-0001", "link-observation", "n")).toMatchObject({ kind: "NOT_SENT", reason: "unknown-ref" });
    expect(spy.actRequests).toHaveLength(0);
    expect((await controller.proposeCorrection("rcs-0001", "request-source-review", "Ask the processor for its cut.")).kind).toBe("APPLIED");
  });

  it("keeps the reviewer's approval off, the approver's proposal off, and the viewer's both off, with the capability named", async () => {
    const reviewer = controllerFor("proposal-pending");
    await reviewer.controller.read();
    expect(await reviewer.controller.approveProposal("prp-0001")).toMatchObject({ kind: "NOT_SENT", reason: "no-capability" });
    expect(reviewer.controller.canSend("approve-proposal").reason).toContain("holds no approve capability");
    const approver = controllerFor("clean", { actorRef: FINANCE_APPROVER_ACTOR });
    await approver.controller.read();
    expect(await approver.controller.proposeCorrection("rcs-0001", "link-observation", "n")).toMatchObject({ kind: "NOT_SENT", reason: "no-capability" });
    const viewer = controllerFor("proposal-pending", { actorRef: FINANCE_VIEWER_ACTOR });
    await viewer.controller.read();
    expect(await viewer.controller.proposeCorrection("rcs-0001", "link-observation", "n")).toMatchObject({ kind: "NOT_SENT", reason: "no-capability" });
    expect(await viewer.controller.approveProposal("prp-0001")).toMatchObject({ kind: "NOT_SENT", reason: "no-capability" });
    for (const item of [reviewer, approver, viewer]) {
      expect(item.port.effects().acts).toBe(0);
    }
  });

  it("records an approval only when a different actor approves, and the cases come from a fresh read", async () => {
    const { port } = controllerFor("proposal-pending");
    const approver = new FinanceOperationsController(port, { actorRef: FINANCE_APPROVER_ACTOR });
    await approver.read();
    const before = approver.state().snapshot;
    const result = await approver.approveProposal("prp-0001");
    expect(result.kind).toBe("APPLIED");
    expect(approver.state().last).toMatchObject({
      phase: "applied",
      receipt: { kind: "approval-recorded", economicStateChanged: false, confirmationForcesMatch: false },
    });
    expect(approver.state().snapshot).toBe(before);
    expect(approver.state().snapshot?.proposals[0]?.state).toBe("pending");
    expect(await approver.approveProposal("prp-0001")).toMatchObject({ kind: "NOT_SENT", reason: "stale-read" });
    await approver.read();
    expect(approver.state().snapshot?.proposals[0]?.state).toBe("approval-recorded");
    expect(approver.state().snapshot?.cases.every((row) => row.state !== "resolved-by-source")).toBe(true);
    expect(await approver.approveProposal("prp-0001")).toMatchObject({ kind: "NOT_SENT", reason: "blocked" });
    expect(approver.canSend("approve-proposal").reason).toBe("The read lists no pending proposal to approve.");
  });

  it("shows a business rejection as a rejection, marks the view behind, and does not fence", async () => {
    const { port } = controllerFor("self-approval");
    const approver = new FinanceOperationsController(port, { actorRef: FINANCE_APPROVER_ACTOR });
    await approver.read();
    const result = await approver.approveProposal("prp-0001");
    expect(result).toMatchObject({ kind: "REJECTED", record: { phase: "rejected", code: "SELF_APPROVAL" } });
    expect(approver.state().behind).toBe(true);
    expect(approver.state().fence).toBeNull();
    await approver.read();
    expect(approver.state().behind).toBe(false);
    expect(approver.state().last).toMatchObject({ phase: "rejected" });
  });

  it("sends once, treats a lost answer as unknown, fences every later request, and does not lift the fence on a read", async () => {
    const spy = spyOn(createStubFinanceOperations({ scenario: "act-lost" }));
    const controller = new FinanceOperationsController(spy.port);
    await controller.read();
    const result = await controller.proposeCorrection("rcs-0001", "link-observation", "n");
    expect(result).toMatchObject({ kind: "UNKNOWN", record: { phase: "unknown", detail: "The answer to the request never arrived." } });
    expect(spy.actRequests).toHaveLength(1);
    expect(controller.state().fence).toEqual({ reason: "unknown-outcome", seq: 1, action: "propose-correction" });
    expect(await controller.proposeCorrection("rcs-0002", "mark-duplicate", "n")).toMatchObject({ kind: "FENCED" });
    expect(await controller.approveProposal("prp-0001")).toMatchObject({ kind: "FENCED" });
    expect(spy.actRequests).toHaveLength(1);
    await controller.read();
    expect(controller.state().fence).not.toBeNull();
    expect(controller.canSend("propose-correction").reason).toContain("unknown outcome");
    expect(controller.state().snapshot?.proposals).toHaveLength(1);
  });

  it("keeps the view behind when a read that began before a request lands after it", async () => {
    // A second read begins, and a request completes before its answer lands.
    const slow = spyOn(createStubFinanceOperations(), { holdReads: true });
    const held = new FinanceOperationsController(slow.port);
    const first = held.read();
    slow.heldReads[0]?.release();
    await first;
    const second = held.read();
    const sent = await held.proposeCorrection("rcs-0001", "link-observation", "n");
    expect(sent.kind).toBe("APPLIED");
    expect(held.state().behind).toBe(true);
    slow.heldReads[1]?.release();
    expect(await second).toMatchObject({ kind: "APPLIED", readState: "ready" });
    // The read that landed may not show the request, so the view is still behind and a second request waits.
    expect(held.state().behind).toBe(true);
    expect(held.canSend("propose-correction").reason).toContain("Read again before the next request");
    expect(await held.proposeCorrection("rcs-0002", "mark-duplicate", "n")).toMatchObject({ kind: "NOT_SENT", reason: "stale-read" });
    const third = held.read();
    slow.heldReads[2]?.release();
    await third;
    expect(held.state().behind).toBe(false);
    expect(held.state().snapshot?.proposals).toHaveLength(1);
  });

  it("treats an untrusted answer as unknown too, because the approval may have been recorded", async () => {
    const { port } = controllerFor("approve-claims-applied");
    const reviewer = new FinanceOperationsController(port);
    await reviewer.read();
    await reviewer.proposeCorrection("rcs-0001", "link-observation", "n");
    const approver = new FinanceOperationsController(port, { actorRef: FINANCE_APPROVER_ACTOR });
    await approver.read();
    const result = await approver.approveProposal("prp-0001");
    expect(result).toMatchObject({ kind: "UNKNOWN", record: { phase: "refused", code: "CLAIM" } });
    expect(approver.state().fence).toMatchObject({ reason: "unknown-outcome" });
    await approver.read();
    expect(approver.state().snapshot?.proposals[0]?.state).toBe("approval-recorded");
    expect(approver.state().fence).not.toBeNull();
  });

  it("serialises requests: one in flight, a second is fenced, and the context cannot change under it", async () => {
    const spy = spyOn(createStubFinanceOperations(), { holdActs: true });
    const controller = new FinanceOperationsController(spy.port);
    await controller.read();
    const first = controller.proposeCorrection("rcs-0001", "link-observation", "n");
    expect(controller.state().fence).toEqual({ reason: "in-flight", action: "propose-correction" });
    expect(await controller.proposeCorrection("rcs-0002", "mark-duplicate", "n")).toMatchObject({ kind: "FENCED", fence: { reason: "in-flight" } });
    expect(controller.switchScope(FINANCE_FOREIGN_REF)).toBeNull();
    expect(controller.switchActor(FINANCE_APPROVER_ACTOR)).toBeNull();
    expect(spy.actRequests).toHaveLength(1);
    spy.heldActs[0]?.release();
    expect((await first).kind).toBe("APPLIED");
    expect(controller.state().fence).toBeNull();
    expect(controller.switchScope(FINANCE_FOREIGN_REF)).not.toBeNull();
  });

  it("counts an unknown outcome of an earlier context and does not forget it", async () => {
    const { controller } = controllerFor("act-lost");
    await controller.read();
    await controller.proposeCorrection("rcs-0001", "link-observation", "n");
    expect(controller.state().earlierUnknown).toBe(0);
    controller.switchActor(FINANCE_APPROVER_ACTOR);
    expect(controller.state()).toMatchObject({ earlierUnknown: 1, fence: null, last: null, behind: false });
    controller.switchScope(FINANCE_OWN_REF);
    expect(controller.state().earlierUnknown).toBe(1);
  });

  it("is not sent on a not-bound port, and the port is never called", async () => {
    const port = createNotBoundFinanceOperations();
    let called = 0;
    const counting: FinanceOperationsPort = {
      ...port,
      act: (request) => {
        called += 1;
        return port.act(request);
      },
    };
    const controller = new FinanceOperationsController(counting);
    await controller.read();
    expect(controller.canSend("propose-correction")).toEqual({ allowed: false, reason: FINANCE_NOT_BOUND_REASON });
    expect(await controller.proposeCorrection("rcs-0001", "link-observation", "n")).toMatchObject({ kind: "NOT_SENT", reason: "not-bound" });
    expect(await controller.approveProposal("prp-0001")).toMatchObject({ kind: "NOT_SENT", reason: "not-bound" });
    expect(called).toBe(0);
  });

  it("records a withdrawn grant and a changed tuple as rejected requests, without a fence", async () => {
    const { port, controller } = controllerFor();
    await controller.read();
    port.synthetic("revoke-grant");
    const denied = await controller.proposeCorrection("rcs-0001", "link-observation", "n");
    expect(denied).toMatchObject({ kind: "REJECTED", record: { phase: "denied", code: "GRANT_REVOKED" } });
    expect(controller.state().fence).toBeNull();

    const scripted = new FinanceOperationsController(
      wrap(createStubFinanceOperations(), {
        act: () => Promise.resolve({ kind: "tuple-changed", field: "sdkTuple", expected: "a", actual: "b" }),
      }),
    );
    await scripted.read();
    expect(await scripted.proposeCorrection("rcs-0001", "link-observation", "n")).toMatchObject({
      kind: "REJECTED",
      record: { phase: "tuple-changed" },
    });
    expect(scripted.state().fence).toBeNull();
  });

  it("maps an invalid or not-bound answer to a request into its own phase", async () => {
    for (const [outcome, phase] of [
      [{ kind: "invalid-request", code: "TEXT", detail: "bad" }, "invalid"],
      [{ kind: "not-bound", reason: "no producer" }, "not-bound"],
    ] as const) {
      const controller = new FinanceOperationsController(
        wrap(createStubFinanceOperations(), { act: () => Promise.resolve(outcome as FinanceActOutcome) }),
      );
      await controller.read();
      const result = await controller.proposeCorrection("rcs-0001", "link-observation", "n");
      expect(result, phase).toMatchObject({ kind: "REJECTED", record: { phase } });
    }
  });
});
