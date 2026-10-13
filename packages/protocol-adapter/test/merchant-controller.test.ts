import { describe, expect, it } from "vitest";
import {
  DISCOVERY_READ_TUPLE_LITERALS,
  MERCHANT_DESK_ACTOR,
  MERCHANT_FOREIGN_REF,
  MERCHANT_NOT_BOUND_REASON,
  MERCHANT_OWN_REF,
  MERCHANT_TENANT,
  MerchantOperationsController,
  createNotBoundMerchantOperations,
  createStubMerchantOperations,
  type MerchantExportOutcome,
  type MerchantExportRequest,
  type MerchantOperationsPort,
  type MerchantReadOutcome,
  type MerchantReadRequest,
  type MerchantScenario,
  type StubMerchantOperations,
  type StubMerchantOperationsOptions,
} from "../src/index.js";

function controllerFor(
  scenario: MerchantScenario = "clean",
  options: { actorRef?: string; merchantRef?: string; expectedTuple?: StubMerchantOperationsOptions["expectedTuple"] } = {},
) {
  const port = createStubMerchantOperations({ scenario, expectedTuple: options.expectedTuple });
  const controller = new MerchantOperationsController(port, {
    actorRef: options.actorRef ?? MERCHANT_DESK_ACTOR,
    merchantRef: options.merchantRef,
  });
  return { port, controller };
}

/** Counts calls and can hold a read or an export so ordering can be staged. */
function spyOn(inner: StubMerchantOperations, options: { holdReads?: boolean; holdExports?: boolean } = {}) {
  const readRequests: MerchantReadRequest[] = [];
  const exportRequests: MerchantExportRequest[] = [];
  const heldReads: { release: () => void }[] = [];
  const heldExports: { release: () => void }[] = [];
  const port: MerchantOperationsPort = {
    environment: inner.environment,
    source: inner.source,
    scenario: inner.scenario,
    read(request) {
      readRequests.push(structuredClone(request));
      if (!options.holdReads) {
        return inner.read(request);
      }
      return new Promise<MerchantReadOutcome>((resolve, reject) => {
        heldReads.push({
          release: () => {
            inner.read(request).then(resolve, reject);
          },
        });
      });
    },
    readExport(request) {
      exportRequests.push(structuredClone(request));
      if (!options.holdExports) {
        return inner.readExport(request);
      }
      return new Promise<MerchantExportOutcome>((resolve, reject) => {
        heldExports.push({
          release: () => {
            inner.readExport(request).then(resolve, reject);
          },
        });
      });
    },
    revokeGrant: () => inner.revokeGrant(),
    advanceCut: () => inner.advanceCut(),
  };
  return { port, readRequests, exportRequests, heldReads, heldExports };
}

/** A port that answers what the test says, for outcomes the stub does not produce. */
function scriptedPort(script: { read?: MerchantReadOutcome; export?: MerchantExportOutcome }): MerchantOperationsPort {
  return {
    environment: "stub",
    source: "synthetic-merchant",
    scenario: "clean",
    read: () => Promise.resolve(script.read ?? { kind: "unknown", message: "unscripted read" }),
    readExport: () => Promise.resolve(script.export ?? { kind: "unknown", message: "unscripted export" }),
    revokeGrant: () => false,
    advanceCut: () => false,
  };
}

describe("merchant controller context and reads", () => {
  it("keys the context on mode, domain, actor, tenant, merchant, and incarnation", () => {
    const { controller } = controllerFor();
    const context = controller.state().context;
    expect(context).toMatchObject({
      environment: "stub",
      actorRef: MERCHANT_DESK_ACTOR,
      incarnation: 1,
      scope: { tenantId: MERCHANT_TENANT, merchantRef: MERCHANT_OWN_REF },
    });
    expect(context.key).toBe(`stub|${context.domain}|${MERCHANT_DESK_ACTOR}|${MERCHANT_TENANT}|${MERCHANT_OWN_REF}|1`);
  });

  it("starts with no read, no export, and no usable freshness", () => {
    const { controller } = controllerFor();
    const state = controller.state();
    expect(state.readState).toBe("none");
    expect(state.freshness).toBe("UNAVAILABLE");
    expect(state.snapshot).toBeNull();
    expect(state.assessment).toBeNull();
    expect(state.export).toMatchObject({ phase: "none", value: null, verdict: null });
    expect(state.counters).toEqual({ reads: 0, exports: 0, notSent: 0, droppedReads: 0, droppedExports: 0 });
  });

  it("applies a ready read with its assessment and remembers the watermark as the floor", async () => {
    const inner = createStubMerchantOperations();
    const { port, readRequests } = spyOn(inner);
    const controller = new MerchantOperationsController(port, { actorRef: MERCHANT_DESK_ACTOR });
    expect(readRequests).toHaveLength(0);
    expect(await controller.read()).toEqual({ kind: "APPLIED", readState: "ready" });
    const state = controller.state();
    expect(state.freshness).toBe("CURRENT");
    expect(state.snapshot?.lines).toHaveLength(7);
    expect(state.assessment).toMatchObject({ cutState: "single", aggregate: { state: "current" } });
    expect(readRequests[0]?.watermarkFloor).toBeNull();
    await controller.read();
    // The second read carries the last watermark as its floor: the page asks for newer than what it saw.
    expect(readRequests[1]?.watermarkFloor).toBe(state.snapshot?.watermark);
  });

  it("reads empty, stale, denied, refused, tuple-changed, and lost as their own states and keeps no row", async () => {
    const empty = controllerFor("empty").controller;
    expect(await empty.read()).toEqual({ kind: "APPLIED", readState: "empty" });
    expect(empty.state()).toMatchObject({ freshness: "CURRENT", snapshot: null });

    const stale = controllerFor("stale").controller;
    expect(await stale.read()).toEqual({ kind: "APPLIED", readState: "stale" });
    expect(stale.state()).toMatchObject({ freshness: "STALE", snapshot: null });

    const denied = controllerFor("denied").controller;
    expect(await denied.read()).toEqual({ kind: "APPLIED", readState: "denied" });
    expect(denied.state().readCode).toBe("GRANT_REVOKED");

    const leaked = controllerFor("scope-leak").controller;
    expect(await leaked.read()).toEqual({ kind: "APPLIED", readState: "refused" });
    expect(leaked.state().readCode).toBe("SCOPE_LEAK");
    expect(leaked.state().snapshot).toBeNull();

    const changed = controllerFor("clean", {
      expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, domain: "kix:other" },
    }).controller;
    expect(await changed.read()).toEqual({ kind: "APPLIED", readState: "tuple-changed" });
    expect(changed.state().readDetail).toContain("domain");

    const lost = controllerFor("read-lost").controller;
    expect(await lost.read()).toEqual({ kind: "APPLIED", readState: "unavailable" });
    expect(lost.state().readDetail).toContain("never arrived");
  });

  it("drops a read that lands after the scope switched and a read older than a newer applied one", async () => {
    const inner = createStubMerchantOperations();
    const { port, heldReads } = spyOn(inner, { holdReads: true });
    const controller = new MerchantOperationsController(port, { actorRef: MERCHANT_DESK_ACTOR });

    const first = controller.read();
    controller.switchScope(MERCHANT_FOREIGN_REF);
    heldReads[0]?.release();
    expect(await first).toEqual({ kind: "DROPPED", cause: "context-changed" });
    expect(controller.state().snapshot).toBeNull();
    expect(controller.state().counters.droppedReads).toBe(1);

    controller.switchScope(MERCHANT_OWN_REF);
    const older = controller.read();
    const newer = controller.read();
    heldReads[2]?.release();
    expect(await newer).toEqual({ kind: "APPLIED", readState: "ready" });
    heldReads[1]?.release();
    expect(await older).toEqual({ kind: "DROPPED", cause: "older-read" });
    expect(controller.state().counters.droppedReads).toBe(2);
  });

  it("clears the rows and the export when a read stops being ready", async () => {
    const { port, controller } = controllerFor();
    await controller.read();
    await controller.loadExport();
    expect(controller.state().snapshot).not.toBeNull();
    expect(controller.state().export.phase).toBe("loaded");
    port.revokeGrant();
    expect(await controller.read()).toEqual({ kind: "APPLIED", readState: "denied" });
    const state = controller.state();
    expect(state.snapshot).toBeNull();
    expect(state.assessment).toBeNull();
    expect(state.export).toMatchObject({ phase: "none", value: null, verdict: null });
  });

  it("switches scope to a fresh context and leaves nothing of the earlier merchant on screen", async () => {
    const { controller } = controllerFor();
    await controller.read();
    expect(controller.state().snapshot?.scope.merchantRef).toBe(MERCHANT_OWN_REF);
    const next = controller.switchScope(MERCHANT_FOREIGN_REF);
    expect(next.incarnation).toBe(2);
    expect(next.scope.merchantRef).toBe(MERCHANT_FOREIGN_REF);
    const state = controller.state();
    expect(state.readState).toBe("none");
    expect(state.snapshot).toBeNull();
    expect(state.freshness).toBe("UNAVAILABLE");
    // The desk actor holds no grant for the foreign merchant, so the next read is denied.
    expect(await controller.read()).toEqual({ kind: "APPLIED", readState: "denied" });
    expect(controller.state().readCode).toBe("SCOPE_DENIED");
  });
});

describe("merchant controller export", () => {
  it("sends no export before a ready read and counts the refusal", async () => {
    const { port, controller } = controllerFor();
    expect(await controller.loadExport()).toEqual({ kind: "NOT_SENT", reason: "no-snapshot" });
    expect(controller.state().counters).toMatchObject({ exports: 0, notSent: 1 });
    expect(port.effects()).toEqual({ reads: 0, exports: 0 });
  });

  it("sends no export on a not-bound port and says why without calling it", async () => {
    const controller = new MerchantOperationsController(createNotBoundMerchantOperations(), { actorRef: MERCHANT_DESK_ACTOR });
    expect(await controller.loadExport()).toEqual({ kind: "NOT_SENT", reason: "not-bound" });
    const state = controller.state();
    expect(state.export).toMatchObject({ phase: "not-bound", detail: MERCHANT_NOT_BOUND_REASON, value: null });
    expect(state.counters).toMatchObject({ exports: 0, notSent: 1 });
  });

  it("loads an export and judges it current against the last read", async () => {
    const { controller } = controllerFor();
    await controller.read();
    expect(await controller.loadExport()).toEqual({ kind: "APPLIED", phase: "loaded" });
    const exported = controller.state().export;
    expect(exported.value?.exportRef).toBe("exp-0001");
    expect(exported.verdict).toEqual({ state: "current" });
  });

  it("re-judges a held export on every state call, so it turns stale after the source moves", async () => {
    const { port, controller } = controllerFor();
    await controller.read();
    await controller.loadExport();
    expect(controller.state().export.verdict).toEqual({ state: "current" });
    port.advanceCut();
    await controller.read();
    expect(controller.state().export).toMatchObject({ phase: "loaded", verdict: { state: "withheld", reasons: ["STALE_CUT"] } });
  });

  it("applies a denied, an unavailable, and a tuple-changed export as its own phase", async () => {
    const denied = controllerFor("export-denied").controller;
    await denied.read();
    expect(await denied.loadExport()).toEqual({ kind: "APPLIED", phase: "denied" });
    expect(denied.state().export.code).toBe("EXPORT_DENIED");

    const broken = new MerchantOperationsController(
      {
        environment: "stub",
        source: "synthetic-merchant",
        scenario: "clean",
        read: (request) => createStubMerchantOperations().read(request),
        readExport: () => Promise.reject(new Error("export answer lost")),
        revokeGrant: () => false,
        advanceCut: () => false,
      },
      { actorRef: MERCHANT_DESK_ACTOR },
    );
    await broken.read();
    expect(await broken.loadExport()).toEqual({ kind: "APPLIED", phase: "unavailable" });
    expect(broken.state().export.detail).toContain("export answer lost");

    const changed = controllerFor("clean", {
      expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, protocolMergeSha: "0".repeat(40) },
    }).controller;
    // The read itself is tuple-changed, so no export is even attempted: no snapshot.
    expect(await changed.read()).toEqual({ kind: "APPLIED", readState: "tuple-changed" });
    expect(await changed.loadExport()).toEqual({ kind: "NOT_SENT", reason: "no-snapshot" });
  });

  it("applies a staged refused and not-bound export phase", async () => {
    const port = scriptedPort({
      read: undefined,
      export: { kind: "refused", code: "AMOUNT", field: "amount", ref: "obl-0001", detail: "staged refusal" },
    });
    const controller = new MerchantOperationsController(
      {
        ...port,
        read: (request) => createStubMerchantOperations().read(request),
      },
      { actorRef: MERCHANT_DESK_ACTOR },
    );
    await controller.read();
    expect(await controller.loadExport()).toEqual({ kind: "APPLIED", phase: "refused" });
    expect(controller.state().export).toMatchObject({ code: "AMOUNT", detail: "staged refusal", value: null, verdict: null });
  });

  it("drops an export that lands after the scope switched and an older in-flight export", async () => {
    const inner = createStubMerchantOperations();
    const { port, heldExports } = spyOn(inner, { holdExports: true });
    const controller = new MerchantOperationsController(port, { actorRef: MERCHANT_DESK_ACTOR });
    await controller.read();

    const first = controller.loadExport();
    controller.switchScope(MERCHANT_FOREIGN_REF);
    heldExports[0]?.release();
    expect(await first).toEqual({ kind: "DROPPED", cause: "context-changed" });
    expect(controller.state().counters.droppedExports).toBe(1);

    controller.switchScope(MERCHANT_OWN_REF);
    await controller.read();
    const older = controller.loadExport();
    const newer = controller.loadExport();
    heldExports[2]?.release();
    expect(await newer).toEqual({ kind: "APPLIED", phase: "loaded" });
    heldExports[1]?.release();
    expect(await older).toEqual({ kind: "DROPPED", cause: "older-export" });
    expect(controller.state().counters.droppedExports).toBe(2);
  });

  it("notifies a subscriber when state changes", async () => {
    const { controller } = controllerFor();
    let calls = 0;
    const off = controller.subscribe(() => {
      calls += 1;
    });
    await controller.read();
    expect(calls).toBeGreaterThan(0);
    off();
    const before = calls;
    await controller.read();
    expect(calls).toBe(before);
  });
});
