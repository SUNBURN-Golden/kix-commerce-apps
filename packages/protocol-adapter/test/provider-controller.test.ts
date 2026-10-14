import { describe, expect, it } from "vitest";
import {
  PROVIDER_DESK_ACTOR,
  PROVIDER_FACETS,
  PROVIDER_SANDBOX,
  ProviderJourneyController,
  createNotBoundProviderJourney,
  createStubProviderJourney,
  projectProvider,
  providerFacetList,
  type ProviderJourneyPort,
  type ProviderOrderProjection,
  type ProviderReadOutcome,
  type ProviderScenario,
  type ProviderStepResult,
  type ProviderWriteOutcome,
  type ProviderWriteRequest,
} from "../src/index.js";

function controllerFor(scenario: ProviderScenario = "clean", actorRef = PROVIDER_DESK_ACTOR) {
  const port = createStubProviderJourney({ scenario });
  const controller = new ProviderJourneyController(port, { actorRef });
  return { port, controller };
}

function orderOf(controller: ProviderJourneyController, orderRef: string): ProviderOrderProjection {
  const order = projectProvider(controller.state()).orders.find((item) => item.orderRef === orderRef);
  if (!order) {
    throw new Error(`order ${orderRef} is not on the projection`);
  }
  return order;
}

function confirmed(result: ProviderStepResult): { checkoutRef: string | null } {
  expect(result.kind).toBe("CONFIRMED");
  if (result.kind !== "CONFIRMED") {
    throw new Error("not confirmed");
  }
  return { checkoutRef: result.intent.refs?.checkoutRef ?? null };
}

/** Counts every write that reaches the port, and can hold a read or a write. */
function spyOn(inner: ProviderJourneyPort, options: { holdReads?: boolean } = {}) {
  const writes: ProviderWriteRequest[] = [];
  const reads: { release: () => void }[] = [];
  const port: ProviderJourneyPort = {
    environment: inner.environment,
    source: inner.source,
    scenario: inner.scenario,
    read(request) {
      if (!options.holdReads) {
        return inner.read(request);
      }
      return new Promise<ProviderReadOutcome>((resolve, reject) => {
        reads.push({
          release: () => {
            inner.read(request).then(resolve, reject);
          },
        });
      });
    },
    submit(request) {
      writes.push(structuredClone(request));
      return inner.submit(request);
    },
    deliverReturn: (checkoutRef) => inner.deliverReturn(checkoutRef),
    deliverCallback: (checkoutRef) => inner.deliverCallback(checkoutRef),
    markAbandoned: (checkoutRef) => inner.markAbandoned(checkoutRef),
    deliverHeld: () => inner.deliverHeld(),
    deliverLate: () => inner.deliverLate(),
  };
  return { port, writes, reads };
}

describe("provider controller context and reads", () => {
  it("keys the context on mode, domain, actor, and incarnation, and moves it only on a switch", () => {
    const { controller } = controllerFor();
    const first = controller.state().context;
    expect(first).toMatchObject({ environment: "stub", actorRef: PROVIDER_DESK_ACTOR, incarnation: 1 });
    expect(first.key).toBe(`stub|${first.domain}|${PROVIDER_DESK_ACTOR}|1`);
    const next = controller.switchContext({ actorRef: "other-buyer" });
    expect(next.incarnation).toBe(2);
    expect(next.actorRef).toBe("other-buyer");
    expect(next.key).not.toBe(first.key);
    expect(controller.switchContext().actorRef).toBe("other-buyer");
  });

  it("starts with no read, no write, and no completion state", () => {
    const { controller } = controllerFor();
    const state = controller.state();
    expect(state.readState).toBe("none");
    expect(state.freshness).toBe("UNAVAILABLE");
    expect(state.intents).toEqual([]);
    expect(state.counters).toEqual({ sent: 0, fenced: 0, notSent: 0, droppedReads: 0 });
    expect(controller.gateFor({ step: "begin", intentRef: "i-1", orderRef: "ord-0001" })).toEqual({ reason: "no-snapshot" });
  });

  it("applies a read as current, and reads empty, stale, refused, and a changed tuple as their own states", async () => {
    const { controller } = controllerFor();
    expect(await controller.refresh()).toEqual({ kind: "APPLIED", readState: "ready" });
    expect(controller.state()).toMatchObject({ readState: "ready", freshness: "CURRENT", refreshRequired: null });
    const empty = controllerFor("empty").controller;
    expect(await empty.refresh()).toEqual({ kind: "APPLIED", readState: "empty" });
    expect(empty.state()).toMatchObject({ freshness: "CURRENT", snapshot: null });
    const stale = controllerFor("stale").controller;
    expect(await stale.refresh()).toEqual({ kind: "APPLIED", readState: "stale" });
    expect(stale.state()).toMatchObject({ freshness: "STALE", snapshot: null });
    expect(stale.state().readDetail).toContain("older than the floor");
    const claimed = controllerFor("claims-real").controller;
    expect(await claimed.refresh()).toEqual({ kind: "APPLIED", readState: "refused" });
    expect(claimed.state().readDetail).toContain("realPayment");
    const refusedWrite = await claimed.run({ step: "begin", intentRef: "b", orderRef: "ord-0001" });
    expect(refusedWrite).toEqual({ kind: "FENCED", fence: { reason: "no-snapshot" } });
  });

  it("refuses a declared production environment before any snapshot is applied, and fences every write", async () => {
    const { controller } = controllerFor("production-claimed");
    expect(await controller.refresh()).toEqual({ kind: "APPLIED", readState: "environment-refused" });
    expect(controller.state()).toMatchObject({ freshness: "UNAVAILABLE", snapshot: null });
    expect(controller.state().readDetail).toContain("production");
    expect(await controller.run({ step: "begin", intentRef: "b", orderRef: "ord-0001" })).toEqual({
      kind: "FENCED",
      fence: { reason: "environment" },
    });
  });

  it("drops a read from an earlier context and a read that arrives after a newer one", async () => {
    const inner = createStubProviderJourney();
    const { port, reads } = spyOn(inner, { holdReads: true });
    const controller = new ProviderJourneyController(port, { actorRef: PROVIDER_DESK_ACTOR });
    const first = controller.refresh();
    controller.switchContext({ actorRef: "other-buyer" });
    reads[0]?.release();
    expect(await first).toEqual({ kind: "DROPPED", cause: "context-changed" });
    expect(controller.state().snapshot).toBeNull();

    const older = controller.refresh();
    const newer = controller.refresh();
    reads[2]?.release();
    expect(await newer).toMatchObject({ kind: "APPLIED" });
    const heldSnapshot = controller.state().snapshot;
    reads[1]?.release();
    expect(await older).toEqual({ kind: "DROPPED", cause: "older-read" });
    expect(controller.state().snapshot).toBe(heldSnapshot);
    expect(controller.state().counters.droppedReads).toBe(2);
  });
});

describe("provider controller write fence", () => {
  it("copies target fields from the read, declares the sandbox, and sends a begin once", async () => {
    const inner = createStubProviderJourney();
    const { port, writes } = spyOn(inner);
    const controller = new ProviderJourneyController(port, { actorRef: PROVIDER_DESK_ACTOR });
    await controller.refresh();
    const result = await controller.run({ step: "begin", intentRef: "begin-1", orderRef: "ord-0001" });
    expect(confirmed(result)).toEqual({ checkoutRef: "cko-0001" });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      step: "begin",
      intentRef: "begin-1",
      orderRef: "ord-0001",
      expectedVersion: 4,
      declaredEnvironment: PROVIDER_SANDBOX,
      actorRef: PROVIDER_DESK_ACTOR,
    });
    const state = controller.state();
    expect(state.counters.sent).toBe(1);
    expect(state.intents[0]).toMatchObject({ outcome: "CONFIRMED", scope: "ord-0001", targetRef: "ord-0001" });
    // The write landed after the read, so the page waits for a read before the next write.
    expect(state.refreshRequired).toBe("own-write");
    expect(controller.gateFor({ step: "begin", intentRef: "begin-2", orderRef: "ord-0002" })).toEqual({
      reason: "snapshot-stale",
      cause: "own-write",
    });
  });

  it("does not send a write before a read, a repeated intent, or a malformed target", async () => {
    const inner = createStubProviderJourney();
    const { port, writes } = spyOn(inner);
    const controller = new ProviderJourneyController(port, { actorRef: PROVIDER_DESK_ACTOR });
    expect(await controller.run({ step: "begin", intentRef: "i-1", orderRef: "ord-0001" })).toEqual({
      kind: "FENCED",
      fence: { reason: "no-snapshot" },
    });
    await controller.refresh();
    expect(await controller.run({ step: "begin", intentRef: " ", orderRef: "ord-0001" })).toMatchObject({
      kind: "NOT_SENT",
      reason: "invalid-intent",
    });
    expect(await controller.run({ step: "begin", intentRef: "i-2", orderRef: "cko-0001" })).toMatchObject({
      kind: "NOT_SENT",
      reason: "identity",
    });
    expect(await controller.run({ step: "observe", intentRef: "i-3", checkoutRef: "ord-0001" })).toMatchObject({
      kind: "NOT_SENT",
      reason: "identity",
    });
    expect(await controller.run({ step: "refund", intentRef: "i-4", orderRef: "psp-0001" })).toMatchObject({
      kind: "NOT_SENT",
      reason: "identity",
    });
    expect(await controller.run({ step: "begin", intentRef: "i-5", orderRef: "ord-0099" })).toMatchObject({
      kind: "NOT_SENT",
      reason: "unknown-ref",
    });
    expect(await controller.run({ step: "observe", intentRef: "i-6", checkoutRef: "cko-0042" })).toMatchObject({
      kind: "NOT_SENT",
      reason: "unknown-ref",
    });
    expect(writes).toHaveLength(0);
    await controller.run({ step: "begin", intentRef: "i-7", orderRef: "ord-0002" });
    await controller.refresh();
    expect(await controller.run({ step: "begin", intentRef: "i-7", orderRef: "ord-0001" })).toEqual({
      kind: "FENCED",
      fence: { reason: "duplicate-intent", intentRef: "i-7" },
    });
    expect(writes).toHaveLength(1);
    expect(controller.state().counters).toMatchObject({ sent: 1, fenced: 2, notSent: 6 });
  });

  it("serialises writes per order: a second write on the same order never reaches the port, another order is free", async () => {
    const inner = createStubProviderJourney({ scenario: "held-response" });
    const { port, writes } = spyOn(inner);
    const controller = new ProviderJourneyController(port, { actorRef: PROVIDER_DESK_ACTOR });
    await controller.refresh();
    const first = controller.run({ step: "begin", intentRef: "buyer", orderRef: "ord-0001" });
    const doubleClick = await controller.run({ step: "begin", intentRef: "buyer-again", orderRef: "ord-0001" });
    expect(doubleClick).toEqual({ kind: "FENCED", fence: { reason: "in-flight", intentRef: "buyer" } });
    const otherOrder = controller.run({ step: "begin", intentRef: "other", orderRef: "ord-0002" });
    expect(writes.map((write) => write.intentRef)).toEqual(["buyer", "other"]);
    expect(inner.deliverHeld()).toBe(2);
    expect((await first).kind).toBe("CONFIRMED");
    expect((await otherOrder).kind).toBe("CONFIRMED");
    expect(inner.effects().begins).toBe(2);
  });
});

describe("provider journey end to end", () => {
  async function toReturned(controller: ProviderJourneyController): Promise<string> {
    const { checkoutRef } = confirmed(await controller.run({ step: "begin", intentRef: "begin", orderRef: "ord-0001" }));
    if (checkoutRef === null) {
      throw new Error("no checkout");
    }
    return checkoutRef;
  }

  it("links redirect, return, observation, issuance, and refund as five independent facets of one order", async () => {
    const { port, controller } = controllerFor();
    await controller.refresh();
    const checkoutRef = await toReturned(controller);
    await controller.refresh();
    let order = orderOf(controller, "ord-0001");
    expect(order.shape).toBe("checkout-open");
    expect(order.linked).toBe(true);
    expect(order.facets.redirect).toMatchObject({ outcome: "CONFIRMED", observed: { state: "open", ref: "cko-0001" } });
    expect(order.facets.return).toMatchObject({ outcome: "NOT_BOUND", observed: { state: "none" } });
    expect(order.facets.payment).toMatchObject({ outcome: null, observed: { state: "none" } });

    // The buyer lands on the return URL. A return alone is never a payment observation.
    port.deliverReturn(checkoutRef);
    await controller.refresh();
    order = orderOf(controller, "ord-0001");
    expect(order.shape).toBe("returned-unobserved");
    expect(order.facets.return.observed).toMatchObject({ state: "landed", ref: "ret-0001" });
    expect(order.facets.payment.observed?.state).toBe("pending");

    // The observe write is sent, and the provider's pending report rejects it.
    const early = await controller.run({ step: "observe", intentRef: "observe-early", checkoutRef });
    expect(early).toMatchObject({ kind: "REJECTED", intent: { code: "PAYMENT_PENDING" } });

    // The provider's own report arrives. Only then does observe confirm.
    port.deliverCallback(checkoutRef);
    await controller.refresh();
    const observed = await controller.run({ step: "observe", intentRef: "observe", checkoutRef });
    expect(observed).toMatchObject({ kind: "CONFIRMED", intent: { refs: { paymentRef: "psp-0001" } } });
    await controller.refresh();
    order = orderOf(controller, "ord-0001");
    expect(order.shape).toBe("payment-observed");
    expect(order.facets.payment).toMatchObject({ outcome: "CONFIRMED", observed: { state: "observed", ref: "psp-0001" } });

    // Before the payment was observed the refund was fenced; it never reached the port.
    const issued = await controller.run({ step: "issue", intentRef: "issue", checkoutRef });
    expect(issued).toMatchObject({ kind: "CONFIRMED", intent: { refs: { issuanceRef: "iss-0001", rightRef: "rgt-0001" } } });
    await controller.refresh();
    const refunded = await controller.run({ step: "refund", intentRef: "refund", orderRef: "ord-0001" });
    expect(refunded).toMatchObject({ kind: "CONFIRMED", intent: { refs: { refundRef: "rfd-0001", paymentRef: "psp-0001" } } });
    await controller.refresh();
    order = orderOf(controller, "ord-0001");
    expect(order.shape).toBe("refund-recorded");
    expect(providerFacetList(order).map((view) => view.facet)).toEqual([...PROVIDER_FACETS]);
    expect(order.facets.issuance).toMatchObject({ outcome: "CONFIRMED", observed: { state: "issued", ref: "iss-0001" } });
    expect(order.facets.refund).toMatchObject({ outcome: "CONFIRMED", observed: { state: "recorded", ref: "rfd-0001" } });
    expect(order.identities).toEqual({
      order: "ord-0001",
      checkout: "cko-0001",
      return: "ret-0001",
      callback: "cbk-0001",
      payment: "psp-0001",
      issuance: "iss-0001",
      right: "rgt-0001",
      refund: "rfd-0001",
    });
    expect(port.effects()).toMatchObject({ begins: 1, observations: 1, issues: 1, refunds: 1 });
  });

  it("fences an issue and a refund until a payment is observed, so neither reaches the port", async () => {
    const { port, controller } = controllerFor();
    await controller.refresh();
    const checkoutRef = await toReturned(controller);
    port.deliverReturn(checkoutRef);
    await controller.refresh();
    const issued = await controller.run({ step: "issue", intentRef: "issue", checkoutRef });
    expect(issued).toEqual({ kind: "FENCED", fence: { reason: "payment-unobserved", orderRef: "ord-0001" } });
    const refunded = await controller.run({ step: "refund", intentRef: "refund", orderRef: "ord-0001" });
    expect(refunded).toEqual({ kind: "FENCED", fence: { reason: "payment-unobserved", orderRef: "ord-0001" } });
    expect(port.effects()).toMatchObject({ issues: 0, refunds: 0 });
    // The source refuses it too, if a caller goes around the page.
    const around = await port.submit({
      contextKey: controller.state().context.key,
      actorRef: PROVIDER_DESK_ACTOR,
      intentRef: "around",
      declaredEnvironment: PROVIDER_SANDBOX,
      step: "issue",
      orderRef: "ord-0001",
      checkoutRef,
      expectedVersion: 6,
    });
    expect(around).toMatchObject({ kind: "rejected", code: "PAYMENT_NOT_OBSERVED" });
  });

  it("keeps an abandoned checkout closed: return, callback, and observe all read as abandonment", async () => {
    const { port, controller } = controllerFor();
    await controller.refresh();
    const checkoutRef = await toReturned(controller);
    port.markAbandoned(checkoutRef);
    await controller.refresh();
    const order = orderOf(controller, "ord-0001");
    expect(order.shape).toBe("abandoned");
    expect(order.facets.redirect.observed?.state).toBe("abandoned");
    expect(order.facets.return.observed?.state).toBe("none");
    expect(port.deliverReturn(checkoutRef)).toBeNull();
    const observed = await controller.run({ step: "observe", intentRef: "observe", checkoutRef });
    expect(observed).toMatchObject({ kind: "REJECTED", intent: { code: "CHECKOUT_ABANDONED" } });
    expect(port.effects().observations).toBe(0);
  });

  it("a late report does not land on a closed checkout, and a reported checkout cannot be abandoned", async () => {
    // Abandoned while the report was still pending: a report delivered later
    // applies nothing, and issue and refund stay fenced at the client.
    const { port, controller } = controllerFor();
    await controller.refresh();
    const checkoutRef = await toReturned(controller);
    port.deliverReturn(checkoutRef);
    port.markAbandoned(checkoutRef);
    expect(port.deliverCallback(checkoutRef)).toBeNull();
    await controller.refresh();
    let order = orderOf(controller, "ord-0001");
    expect(order.shape).toBe("abandoned");
    expect(order.facets.payment.observed?.state).toBe("pending");
    expect(order.facets.payment.observed?.ref).toBeNull();
    expect(await controller.run({ step: "observe", intentRef: "observe", checkoutRef })).toMatchObject({
      kind: "REJECTED",
      intent: { code: "CHECKOUT_ABANDONED" },
    });
    expect(await controller.run({ step: "issue", intentRef: "issue", checkoutRef })).toEqual({
      kind: "FENCED",
      fence: { reason: "payment-unobserved", orderRef: "ord-0001" },
    });
    expect(await controller.run({ step: "refund", intentRef: "refund", orderRef: "ord-0001" })).toEqual({
      kind: "FENCED",
      fence: { reason: "payment-unobserved", orderRef: "ord-0001" },
    });
    expect(port.effects()).toMatchObject({ callbacks: 0, observations: 0, issues: 0, refunds: 0 });

    // The report landed first: the checkout is decided and cannot be abandoned.
    const second = controllerFor();
    await second.controller.refresh();
    const secondRef = await toReturned(second.controller);
    second.port.deliverReturn(secondRef);
    second.port.deliverCallback(secondRef);
    expect(second.port.markAbandoned(secondRef)).toBeNull();
    await second.controller.refresh();
    order = orderOf(second.controller, "ord-0001");
    expect(order.shape).toBe("payment-observed");
    expect(order.facets.redirect.observed?.state).toBe("returned");
  });

  it("records a declined payment as a declined facet, and issuance and refund stay unfenced-free", async () => {
    const { port, controller } = controllerFor("declined");
    await controller.refresh();
    const checkoutRef = await toReturned(controller);
    port.deliverReturn(checkoutRef);
    port.deliverCallback(checkoutRef);
    await controller.refresh();
    const observed = await controller.run({ step: "observe", intentRef: "observe", checkoutRef });
    expect(observed).toMatchObject({ kind: "REJECTED", intent: { code: "PAYMENT_DECLINED" } });
    await controller.refresh();
    const order = orderOf(controller, "ord-0001");
    expect(order.shape).toBe("payment-declined");
    expect(order.facets.payment).toMatchObject({ outcome: "REJECTED", code: "PAYMENT_DECLINED", observed: { state: "declined" } });
    expect(await controller.run({ step: "issue", intentRef: "issue", checkoutRef })).toMatchObject({ kind: "FENCED" });
    expect(port.effects()).toMatchObject({ issues: 0, refunds: 0 });
  });
});

describe("client retry makes no new provider effect", () => {
  it("a lost begin response fences every further write on the order, and no read lifts it", async () => {
    const inner = createStubProviderJourney({ scenario: "begin-lost" });
    const { port, writes } = spyOn(inner);
    const controller = new ProviderJourneyController(port, { actorRef: PROVIDER_DESK_ACTOR });
    await controller.refresh();
    const lost = await controller.run({ step: "begin", intentRef: "begin-1", orderRef: "ord-0001" });
    expect(lost).toMatchObject({ kind: "UNKNOWN", intent: { outcome: "UNKNOWN", code: "RESPONSE_LOST" } });
    expect(inner.effects().begins).toBe(1);

    const fence = { reason: "unknown-outcome", intentRef: "begin-1", lateRecorded: false, earlierContext: false };
    expect(await controller.run({ step: "begin", intentRef: "begin-2", orderRef: "ord-0001" })).toEqual({ kind: "FENCED", fence });

    // A read shows the checkout, and the read does not resolve the unknown write or link the checkout to it.
    await controller.refresh();
    const projection = projectProvider(controller.state());
    const order = projection.orders.find((item) => item.orderRef === "ord-0001");
    expect(order).toMatchObject({ linked: false, shape: "checkout-open" });
    expect(order?.facets.redirect.outcome).toBeNull();
    expect(projection.unlinkedIntents.map((intent) => [intent.intentRef, intent.outcome])).toEqual([["begin-1", "UNKNOWN"]]);
    // An observe on the checkout the unknown write opened is still fenced on the same order scope.
    expect(await controller.run({ step: "observe", intentRef: "observe", checkoutRef: "cko-0001" })).toEqual({
      kind: "FENCED",
      fence,
    });
    expect(writes).toHaveLength(1);
    expect(inner.effects()).toMatchObject({ submits: 1, begins: 1 });

    // Another order is a different scope and stays open.
    const other = await controller.run({ step: "begin", intentRef: "begin-3", orderRef: "ord-0002" });
    expect(other.kind).toBe("UNKNOWN");
    expect(writes).toHaveLength(2);
  });

  it("a lost observe response keeps the order fenced while a read shows the payment observed", async () => {
    const { port, controller } = controllerFor("observe-lost");
    await controller.refresh();
    const { checkoutRef } = confirmed(await controller.run({ step: "begin", intentRef: "begin", orderRef: "ord-0001" }));
    if (checkoutRef === null) {
      throw new Error("no checkout");
    }
    port.deliverReturn(checkoutRef);
    port.deliverCallback(checkoutRef);
    await controller.refresh();
    const lost = await controller.run({ step: "observe", intentRef: "observe", checkoutRef });
    expect(lost.kind).toBe("UNKNOWN");
    await controller.refresh();
    const order = orderOf(controller, "ord-0001");
    expect(order.facets.payment).toMatchObject({ outcome: "UNKNOWN", code: "RESPONSE_LOST", observed: { state: "observed" } });
    expect(order.shape).toBe("unknown-effect");
    const again = await controller.run({ step: "observe", intentRef: "observe-again", checkoutRef });
    expect(again).toMatchObject({ kind: "FENCED", fence: { reason: "unknown-outcome", intentRef: "observe" } });
    const issued = await controller.run({ step: "issue", intentRef: "issue", checkoutRef });
    expect(issued).toMatchObject({ kind: "FENCED", fence: { reason: "unknown-outcome", intentRef: "observe" } });
    expect(port.effects().observations).toBe(1);
    expect(controller.state().counters.sent).toBe(2);
  });

  it("an exception after send, and a result for another intent, are unknown and are not sent again", async () => {
    const inner = createStubProviderJourney();
    let calls = 0;
    const throwing: ProviderJourneyPort = {
      environment: inner.environment,
      source: inner.source,
      scenario: inner.scenario,
      read: (request) => inner.read(request),
      submit: async () => {
        calls += 1;
        throw new Error("socket closed after send");
      },
      deliverReturn: () => null,
      deliverCallback: () => null,
      markAbandoned: () => null,
      deliverHeld: () => 0,
      deliverLate: () => [],
    };
    const controller = new ProviderJourneyController(throwing, { actorRef: PROVIDER_DESK_ACTOR });
    await controller.refresh();
    const result = await controller.run({ step: "begin", intentRef: "begin", orderRef: "ord-0001" });
    expect(result).toMatchObject({ kind: "UNKNOWN", intent: { code: "RESPONSE_LOST", message: "socket closed after send" } });
    expect(await controller.run({ step: "begin", intentRef: "begin-2", orderRef: "ord-0001" })).toMatchObject({ kind: "FENCED" });
    expect(calls).toBe(1);

    const wrong: ProviderJourneyPort = {
      ...throwing,
      submit: async (request): Promise<ProviderWriteOutcome> => ({
        kind: "unknown",
        step: "begin",
        intentRef: "someone-else",
        contextKey: request.contextKey,
        message: "x",
      }),
    };
    const second = new ProviderJourneyController(wrong, { actorRef: PROVIDER_DESK_ACTOR });
    await second.refresh();
    const miscorrelated = await second.run({ step: "begin", intentRef: "begin", orderRef: "ord-0001" });
    expect(miscorrelated).toMatchObject({ kind: "UNKNOWN", intent: { code: "CORRELATION" } });
  });

  it("a confirmed answer that claims a real payment is unknown, not confirmed", async () => {
    const { controller } = controllerFor("receipt-claims");
    await controller.refresh();
    const result = await controller.run({ step: "begin", intentRef: "begin", orderRef: "ord-0001" });
    expect(result).toMatchObject({ kind: "UNKNOWN", intent: { code: "UNTRUSTED_RECEIPT" } });
    expect(controller.state().intents[0]?.message).toContain("realPayment");
  });
});

describe("late results", () => {
  it("records a late observe result as evidence and leaves the write unknown and the order fenced", async () => {
    const { port, controller } = controllerFor("observe-late");
    await controller.refresh();
    const { checkoutRef } = confirmed(await controller.run({ step: "begin", intentRef: "begin", orderRef: "ord-0001" }));
    if (checkoutRef === null) {
      throw new Error("no checkout");
    }
    port.deliverReturn(checkoutRef);
    port.deliverCallback(checkoutRef);
    await controller.refresh();
    expect((await controller.run({ step: "observe", intentRef: "observe", checkoutRef })).kind).toBe("UNKNOWN");
    const deliveries = port.deliverLate();
    expect(deliveries).toHaveLength(1);
    const recorded = controller.acceptLate(deliveries[0] as NonNullable<(typeof deliveries)[number]>);
    expect(recorded).toMatchObject({ kind: "RECORDED", intent: { outcome: "UNKNOWN", late: { result: "confirmed", code: null } } });
    const fence = await controller.run({ step: "issue", intentRef: "issue", checkoutRef });
    expect(fence).toEqual({
      kind: "FENCED",
      fence: { reason: "unknown-outcome", intentRef: "observe", lateRecorded: true, earlierContext: false },
    });
    await controller.refresh();
    expect(orderOf(controller, "ord-0001").facets.payment).toMatchObject({ outcome: "UNKNOWN", lateRecorded: true });
  });

  it("quarantines a late result for another context, an unknown intent, or a write that is not unknown", async () => {
    const { port, controller } = controllerFor("observe-late");
    await controller.refresh();
    const { checkoutRef } = confirmed(await controller.run({ step: "begin", intentRef: "begin", orderRef: "ord-0001" }));
    if (checkoutRef === null) {
      throw new Error("no checkout");
    }
    port.deliverReturn(checkoutRef);
    port.deliverCallback(checkoutRef);
    await controller.refresh();
    await controller.run({ step: "observe", intentRef: "observe", checkoutRef });
    const [delivery] = port.deliverLate();
    if (!delivery) {
      throw new Error("no late delivery");
    }
    expect(controller.acceptLate({ ...delivery, intentRef: "never-sent" })).toEqual({ kind: "QUARANTINED", cause: "no-unknown-intent" });
    expect(controller.acceptLate({ ...delivery, intentRef: "begin" })).toEqual({ kind: "QUARANTINED", cause: "no-unknown-intent" });
    controller.switchContext({ actorRef: "other-buyer" });
    expect(controller.acceptLate(delivery)).toEqual({ kind: "QUARANTINED", cause: "different-context" });
    expect(controller.state().quarantined.map((item) => item.cause)).toEqual([
      "no-unknown-intent",
      "no-unknown-intent",
      "different-context",
    ]);
    expect(controller.state().intents.find((intent) => intent.intentRef === "observe")?.late).toBeNull();
  });
});

describe("stale session", () => {
  it("a result that arrives after a context switch is quarantined, and the unknown fence outlives the switch", async () => {
    const inner = createStubProviderJourney({ scenario: "held-response" });
    const { port, writes } = spyOn(inner);
    const controller = new ProviderJourneyController(port, { actorRef: PROVIDER_DESK_ACTOR });
    await controller.refresh();
    const pending = controller.run({ step: "begin", intentRef: "begin", orderRef: "ord-0001" });
    expect(controller.state().intents[0]?.outcome).toBe("IN_FLIGHT");

    controller.switchContext({ actorRef: "other-buyer" });
    const afterSwitch = controller.state();
    expect(afterSwitch.snapshot).toBeNull();
    expect(afterSwitch.refreshRequired).toBe("context-switch");
    expect(afterSwitch.intents[0]).toMatchObject({ outcome: "UNKNOWN", code: "CONTEXT_SWITCHED" });

    expect(inner.deliverHeld()).toBe(1);
    const settled = await pending;
    expect(settled).toMatchObject({ kind: "QUARANTINED", intent: { outcome: "UNKNOWN", refs: null } });
    expect(controller.state().quarantined).toEqual([
      {
        intentRef: "begin",
        contextKey: `stub|${afterSwitch.context.domain}|${PROVIDER_DESK_ACTOR}|1`,
        arrived: "confirmed",
        code: null,
        cause: "context-changed",
      },
    ]);
    // The discarded result created no linked order and resolved nothing.
    expect(projectProvider(controller.state()).orders.every((order) => !order.linked)).toBe(true);

    // In a later context of the qualified desk actor the order is still fenced by the
    // earlier unknown write. Another order is not.
    controller.switchContext({ actorRef: PROVIDER_DESK_ACTOR });
    await controller.refresh();
    const blocked = await controller.run({ step: "begin", intentRef: "begin-2", orderRef: "ord-0001" });
    expect(blocked).toEqual({
      kind: "FENCED",
      fence: { reason: "unknown-outcome", intentRef: "begin", lateRecorded: false, earlierContext: true },
    });
    const free = controller.run({ step: "begin", intentRef: "begin-3", orderRef: "ord-0002" });
    expect(inner.deliverHeld()).toBe(1);
    expect((await free).kind).toBe("CONFIRMED");
    expect(writes.map((write) => write.intentRef)).toEqual(["begin", "begin-3"]);
    expect(writes[1]?.actorRef).toBe(PROVIDER_DESK_ACTOR);
  });

  it("a rejection that says the read was old must be read again before the next write", async () => {
    const { port, controller } = controllerFor();
    await controller.refresh();
    const { checkoutRef } = confirmed(await controller.run({ step: "begin", intentRef: "begin", orderRef: "ord-0001" }));
    if (checkoutRef === null) {
      throw new Error("no checkout");
    }
    await controller.refresh();
    // The checkout moved after the read, so the observe is built on an old version.
    port.deliverReturn(checkoutRef);
    const rejected = await controller.run({ step: "observe", intentRef: "observe", checkoutRef });
    expect(rejected).toMatchObject({ kind: "REJECTED", intent: { code: "VERSION_STALE" } });
    expect(controller.state().refreshRequired).toBe("stale-rejection");
    const fenced = await controller.run({ step: "begin", intentRef: "begin-2", orderRef: "ord-0002" });
    expect(fenced).toEqual({ kind: "FENCED", fence: { reason: "snapshot-stale", cause: "stale-rejection" } });
    await controller.refresh();
    expect(controller.state().freshness).toBe("CURRENT");
  });
});

describe("unqualified account", () => {
  it("reads the environment as unqualified and fences every write before any send", async () => {
    const { port, controller } = controllerFor("unqualified");
    await controller.refresh();
    expect(controller.state().readState).toBe("ready");
    expect(controller.state().snapshot?.environment.account.qualification).toBe("unqualified");
    expect(await controller.run({ step: "begin", intentRef: "begin", orderRef: "ord-0001" })).toEqual({
      kind: "FENCED",
      fence: { reason: "account-unqualified", actorRef: PROVIDER_DESK_ACTOR },
    });
    expect(port.effects().begins).toBe(0);
  });

  it("reads a guest actor unqualified on a clean source and fences the write the same way", async () => {
    const { port, controller } = controllerFor("clean", "guest-visitor");
    await controller.refresh();
    expect(controller.state().snapshot?.environment.account).toEqual({ actorRef: "guest-visitor", qualification: "unqualified" });
    expect(await controller.run({ step: "begin", intentRef: "begin", orderRef: "ord-0001" })).toMatchObject({
      kind: "FENCED",
      fence: { reason: "account-unqualified" },
    });
    expect(port.effects().begins).toBe(0);
  });
});

describe("not-bound and changed tuple", () => {
  it("never switches to the stub: the not-bound port is read-only text and a write is fenced before any send", async () => {
    const port = createNotBoundProviderJourney();
    const controller = new ProviderJourneyController(port, { actorRef: PROVIDER_DESK_ACTOR });
    expect(controller.state().context.environment).toBe("integration-http");
    expect(await controller.refresh()).toEqual({ kind: "APPLIED", readState: "not-bound" });
    expect(controller.state()).toMatchObject({ freshness: "UNAVAILABLE", snapshot: null });
    expect(controller.state().readDetail).toContain("not-bound on integration-http");
    expect(await controller.run({ step: "begin", intentRef: "begin", orderRef: "ord-0001" })).toEqual({
      kind: "FENCED",
      fence: { reason: "not-bound" },
    });
    expect(controller.state().counters).toMatchObject({ sent: 0, fenced: 1 });
    expect(controller.state().intents).toEqual([]);
  });

  it("reads a changed tuple as its own state and never applies a snapshot", async () => {
    const port = createStubProviderJourney({
      expectedTuple: { ...(await tupleLiterals()), protocolMergeSha: "1".repeat(40) },
    });
    const controller = new ProviderJourneyController(port, { actorRef: PROVIDER_DESK_ACTOR });
    expect(await controller.refresh()).toEqual({ kind: "APPLIED", readState: "tuple-changed" });
    expect(controller.state()).toMatchObject({ freshness: "UNAVAILABLE", snapshot: null });
    expect(controller.state().readDetail).toContain("protocolMergeSha");
    expect(port.effects().submits).toBe(0);
  });

  it("reads a throwing source as unavailable and not as empty", async () => {
    const inner = createStubProviderJourney();
    const broken: ProviderJourneyPort = {
      environment: inner.environment,
      source: inner.source,
      scenario: inner.scenario,
      read: async () => {
        throw new Error("source lost");
      },
      submit: (request) => inner.submit(request),
      deliverReturn: () => null,
      deliverCallback: () => null,
      markAbandoned: () => null,
      deliverHeld: () => 0,
      deliverLate: () => [],
    };
    const controller = new ProviderJourneyController(broken, { actorRef: PROVIDER_DESK_ACTOR });
    expect(await controller.refresh()).toEqual({ kind: "APPLIED", readState: "unavailable" });
    expect(controller.state()).toMatchObject({ freshness: "UNAVAILABLE", readDetail: "source lost" });
  });
});

describe("subscription", () => {
  it("tells a listener about every change and stops after unsubscribe", async () => {
    const { controller } = controllerFor();
    let count = 0;
    const off = controller.subscribe(() => {
      count += 1;
    });
    await controller.refresh();
    expect(count).toBeGreaterThan(0);
    off();
    const seen = count;
    await controller.refresh();
    expect(count).toBe(seen);
  });
});

async function tupleLiterals() {
  const mod = await import("../src/index.js");
  return mod.DISCOVERY_READ_TUPLE_LITERALS;
}
