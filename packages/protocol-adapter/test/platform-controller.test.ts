import { describe, expect, it } from "vitest";
import {
  PLATFORM_COMPENSATION_UNDEFINED,
  PLATFORM_FACETS,
  PlatformJourneyController,
  createNotBoundPlatformJourney,
  createStubPlatformJourney,
  platformFacetList,
  projectPlatform,
  type PlatformControllerState,
  type PlatformJourneyPort,
  type PlatformReadOutcome,
  type PlatformScenario,
  type PlatformStepResult,
  type PlatformTradeProjection,
  type PlatformWriteOutcome,
  type PlatformWriteRequest,
  type StubPlatformJourney,
} from "../src/index.js";

function controllerFor(scenario: PlatformScenario = "clean", actorRef = "platform-desk") {
  const port = createStubPlatformJourney({ scenario });
  const controller = new PlatformJourneyController(port, { actorRef });
  return { port, controller };
}

function tradeOf(controller: PlatformJourneyController, tradeRef: string): PlatformTradeProjection {
  const trade = projectPlatform(controller.state()).trades.find((item) => item.tradeRef === tradeRef);
  if (!trade) {
    throw new Error(`trade ${tradeRef} is not on the projection`);
  }
  return trade;
}

function confirmed(result: PlatformStepResult): string {
  expect(result.kind).toBe("CONFIRMED");
  if (result.kind !== "CONFIRMED") {
    throw new Error("not confirmed");
  }
  return result.intent.refs?.tradeRef ?? "";
}

/** Counts every write that reaches the port, and can hold a read or a write. */
function spyOn(inner: PlatformJourneyPort, options: { holdReads?: boolean } = {}) {
  const writes: PlatformWriteRequest[] = [];
  const reads: { release: () => void }[] = [];
  const port: PlatformJourneyPort = {
    environment: inner.environment,
    source: inner.source,
    scenario: inner.scenario,
    read(request) {
      if (!options.holdReads) {
        return inner.read(request);
      }
      return new Promise<PlatformReadOutcome>((resolve, reject) => {
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
    deliverHeld: () => inner.deliverHeld(),
    deliverLate: () => inner.deliverLate(),
  };
  return { port, writes, reads };
}

describe("platform controller context and reads", () => {
  it("keys the context on mode, domain, actor, and incarnation, and moves it only on a switch", () => {
    const { controller } = controllerFor();
    const first = controller.state().context;
    expect(first).toMatchObject({ environment: "stub", actorRef: "platform-desk", incarnation: 1 });
    expect(first.key).toBe(`stub|${first.domain}|platform-desk|1`);
    const next = controller.switchContext({ actorRef: "other-desk" });
    expect(next.incarnation).toBe(2);
    expect(next.actorRef).toBe("other-desk");
    expect(next.key).not.toBe(first.key);
    expect(controller.switchContext().actorRef).toBe("other-desk");
  });

  it("starts with no read, no write, and no completion state", () => {
    const { controller } = controllerFor();
    const state = controller.state();
    expect(state.readState).toBe("none");
    expect(state.freshness).toBe("UNAVAILABLE");
    expect(state.intents).toEqual([]);
    expect(state.counters).toEqual({ sent: 0, fenced: 0, notSent: 0, droppedReads: 0 });
    expect(controller.gateFor({ step: "book", intentRef: "i-1", listingRef: "lst-0001" })).toEqual({ reason: "no-snapshot" });
  });

  it("applies a read as current, and reads empty, stale, and a changed tuple as their own states", async () => {
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
  });

  it("drops a read from an earlier context and a read that arrives after a newer one", async () => {
    const inner = createStubPlatformJourney();
    const { port, reads } = spyOn(inner, { holdReads: true });
    const controller = new PlatformJourneyController(port, { actorRef: "platform-desk" });
    const first = controller.refresh();
    controller.switchContext({ actorRef: "other-desk" });
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

describe("platform controller write fence", () => {
  it("copies target fields from the read and sends a booking once", async () => {
    const inner = createStubPlatformJourney();
    const { port, writes } = spyOn(inner);
    const controller = new PlatformJourneyController(port, { actorRef: "platform-desk" });
    await controller.refresh();
    const result = await controller.run({ step: "book", intentRef: "intent-1", listingRef: "lst-0001" });
    expect(confirmed(result)).toBe("trd-0001");
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      step: "book",
      intentRef: "intent-1",
      listingRef: "lst-0001",
      rightRef: "rgt-0001",
      termsRef: "trm-0001",
      expectedVersion: 7,
      actorRef: "platform-desk",
    });
    const state = controller.state();
    expect(state.counters.sent).toBe(1);
    expect(state.intents[0]).toMatchObject({ outcome: "CONFIRMED", scope: "rgt-0001", targetRef: "lst-0001" });
    // The write landed after the read, so the page waits for a read before the next write.
    expect(state.refreshRequired).toBe("own-write");
    expect(controller.gateFor({ step: "book", intentRef: "intent-2", listingRef: "lst-0003" })).toEqual({
      reason: "snapshot-stale",
      cause: "own-write",
    });
  });

  it("does not send a write before a read, a repeated intent, or a malformed target", async () => {
    const inner = createStubPlatformJourney();
    const { port, writes } = spyOn(inner);
    const controller = new PlatformJourneyController(port, { actorRef: "platform-desk" });
    expect(await controller.run({ step: "book", intentRef: "i-1", listingRef: "lst-0001" })).toEqual({
      kind: "FENCED",
      fence: { reason: "no-snapshot" },
    });
    await controller.refresh();
    expect(await controller.run({ step: "book", intentRef: " ", listingRef: "lst-0001" })).toMatchObject({
      kind: "NOT_SENT",
      reason: "invalid-intent",
    });
    expect(await controller.run({ step: "book", intentRef: "i-2", listingRef: "rgt-0001" })).toMatchObject({
      kind: "NOT_SENT",
      reason: "identity",
    });
    expect(await controller.run({ step: "transfer", intentRef: "i-3", tradeRef: "pay-0001" })).toMatchObject({
      kind: "NOT_SENT",
      reason: "identity",
    });
    expect(await controller.run({ step: "reprice", intentRef: "i-4", listingRef: "lst-0001", nextTier: "tier-9" })).toMatchObject({
      kind: "NOT_SENT",
      reason: "tier",
    });
    expect(await controller.run({ step: "book", intentRef: "i-5", listingRef: "lst-0099" })).toMatchObject({
      kind: "NOT_SENT",
      reason: "unknown-ref",
    });
    expect(writes).toHaveLength(0);
    await controller.run({ step: "book", intentRef: "i-6", listingRef: "lst-0003" });
    await controller.refresh();
    expect(await controller.run({ step: "book", intentRef: "i-6", listingRef: "lst-0001" })).toEqual({
      kind: "FENCED",
      fence: { reason: "duplicate-intent", intentRef: "i-6" },
    });
    expect(writes).toHaveLength(1);
    expect(controller.state().counters).toMatchObject({ sent: 1, fenced: 2, notSent: 5 });
  });

  it("serialises writes per right: a second write on the same right never reaches the port, another right is free", async () => {
    const inner = createStubPlatformJourney({ scenario: "held-response" });
    const { port, writes } = spyOn(inner);
    const controller = new PlatformJourneyController(port, { actorRef: "platform-desk" });
    await controller.refresh();
    const first = controller.run({ step: "book", intentRef: "web", listingRef: "lst-0001" });
    const doubleClick = await controller.run({ step: "book", intentRef: "web-again", listingRef: "lst-0001" });
    const otherChannel = await controller.run({ step: "book", intentRef: "partner", listingRef: "lst-0002" });
    const reprice = await controller.run({ step: "reprice", intentRef: "price", listingRef: "lst-0001", nextTier: "tier-3" });
    expect(doubleClick).toEqual({ kind: "FENCED", fence: { reason: "in-flight", intentRef: "web" } });
    expect(otherChannel).toEqual({ kind: "FENCED", fence: { reason: "in-flight", intentRef: "web" } });
    expect(reprice).toEqual({ kind: "FENCED", fence: { reason: "in-flight", intentRef: "web" } });
    const otherRight = controller.run({ step: "book", intentRef: "other-right", listingRef: "lst-0003" });
    expect(writes.map((write) => write.intentRef)).toEqual(["web", "other-right"]);
    expect(inner.deliverHeld()).toBe(2);
    expect((await first).kind).toBe("CONFIRMED");
    expect((await otherRight).kind).toBe("CONFIRMED");
    expect(inner.effects()).toMatchObject({ books: 2, paymentObservations: 2 });
  });

  it("treats a rejection as no effect and asks for a fresh read only when the rejection says the read was behind", async () => {
    const { port, controller } = controllerFor();
    await controller.refresh();
    const tradeRef = confirmed(await controller.run({ step: "book", intentRef: "book", listingRef: "lst-0001" }));
    await controller.refresh();
    // Another actor moves the right behind this page's back.
    await port.submit({
      contextKey: "stub|kix|other|1",
      actorRef: "other",
      intentRef: "elsewhere",
      step: "book",
      listingRef: "lst-0002",
      rightRef: "rgt-0001",
      termsRef: "trm-0002",
      expectedVersion: 7,
    });
    await port.submit({
      contextKey: "stub|kix|other|1",
      actorRef: "other",
      intentRef: "elsewhere-move",
      step: "transfer",
      tradeRef: "trd-0002",
      listingRef: "lst-0002",
      rightRef: "rgt-0001",
      termsRef: "trm-0002",
      expectedVersion: 7,
    });
    const rejected = await controller.run({ step: "transfer", intentRef: "move", tradeRef });
    expect(rejected).toMatchObject({ kind: "REJECTED", intent: { outcome: "REJECTED", code: "VERSION_STALE" } });
    expect(controller.state().refreshRequired).toBe("stale-rejection");
    expect(controller.gateFor({ step: "book", intentRef: "next", listingRef: "lst-0003" })).toEqual({
      reason: "snapshot-stale",
      cause: "stale-rejection",
    });
    await controller.refresh();
    expect(controller.gateFor({ step: "book", intentRef: "next", listingRef: "lst-0003" })).toBeNull();
    // A rejection is a no-effect answer, so it does not fence the right.
    expect(controller.state().intents.some((intent) => intent.outcome === "UNKNOWN")).toBe(false);
  });
});

describe("two channels race for the same right", () => {
  it("one page: the second channel's booking and transfer are serialised, and the right moves once", async () => {
    const { port, controller } = controllerFor();
    await controller.refresh();
    const [web, partner] = await Promise.all([
      controller.run({ step: "book", intentRef: "web-book", listingRef: "lst-0001" }),
      controller.run({ step: "book", intentRef: "partner-book", listingRef: "lst-0002" }),
    ]);
    expect(web.kind).toBe("CONFIRMED");
    expect(partner).toEqual({ kind: "FENCED", fence: { reason: "in-flight", intentRef: "web-book" } });
    expect(port.effects().books).toBe(1);

    await controller.refresh();
    const partnerTrade = confirmed(await controller.run({ step: "book", intentRef: "partner-book-2", listingRef: "lst-0002" }));
    await controller.refresh();
    expect(port.effects()).toMatchObject({ books: 2, paymentObservations: 2 });

    const [first, second] = await Promise.all([
      controller.run({ step: "transfer", intentRef: "web-move", tradeRef: "trd-0001" }),
      controller.run({ step: "transfer", intentRef: "partner-move", tradeRef: partnerTrade }),
    ]);
    expect(first.kind).toBe("CONFIRMED");
    expect(second).toEqual({ kind: "FENCED", fence: { reason: "in-flight", intentRef: "web-move" } });
    await controller.refresh();
    const lateSecond = await controller.run({ step: "transfer", intentRef: "partner-move-2", tradeRef: partnerTrade });
    expect(lateSecond).toMatchObject({ kind: "REJECTED", intent: { code: "VERSION_STALE" } });

    const projection = projectPlatform(controller.state());
    const right = projection.rights.find((item) => item.rightRef === "rgt-0001");
    expect(right).toMatchObject({ version: 8, observedTransfers: 1, integrityFault: false });
    expect(controller.state().intents.filter((intent) => intent.step === "transfer" && intent.outcome === "CONFIRMED")).toHaveLength(1);
    expect(port.effects().transfers).toBe(1);

    const winner = tradeOf(controller, "trd-0001");
    expect(winner.shape).toBe("booking-payment-right");
    const loser = tradeOf(controller, partnerTrade);
    expect(loser.shape).toBe("payment-without-right");
    expect(loser.facets.issuance).toMatchObject({ outcome: "REJECTED", code: "VERSION_STALE" });
    expect(loser.facets.refund.observed?.code).toBe(PLATFORM_COMPENSATION_UNDEFINED);
    expect(loser.originalRight).toEqual({ holder: "holder-seed-1", version: 7 });
    expect(loser.currentRight).toEqual({ holder: "platform-desk", version: 8 });
  });

  it("two pages on one source: the source decides, exactly one transfer is confirmed", async () => {
    const source: StubPlatformJourney = createStubPlatformJourney();
    const a = new PlatformJourneyController(source, { actorRef: "buyer-a" });
    const b = new PlatformJourneyController(source, { actorRef: "buyer-b" });
    await Promise.all([a.refresh(), b.refresh()]);
    const tradeA = confirmed(await a.run({ step: "book", intentRef: "a-book", listingRef: "lst-0001" }));
    const tradeB = confirmed(await b.run({ step: "book", intentRef: "b-book", listingRef: "lst-0002" }));
    await Promise.all([a.refresh(), b.refresh()]);
    const results = await Promise.all([
      a.run({ step: "transfer", intentRef: "a-move", tradeRef: tradeA }),
      b.run({ step: "transfer", intentRef: "b-move", tradeRef: tradeB }),
    ]);
    expect(results.map((result) => result.kind).sort()).toEqual(["CONFIRMED", "REJECTED"]);
    expect(source.effects()).toMatchObject({ books: 2, paymentObservations: 2, transfers: 1 });
    await Promise.all([a.refresh(), b.refresh()]);
    for (const page of [a, b]) {
      const projection = projectPlatform(page.state());
      const right = projection.rights.find((item) => item.rightRef === "rgt-0001");
      expect(right?.observedTransfers).toBe(1);
      expect(right?.integrityFault).toBe(false);
    }
    const confirmedMoves = [a, b].flatMap((page) =>
      page.state().intents.filter((intent) => intent.step === "transfer" && intent.outcome === "CONFIRMED"),
    );
    expect(confirmedMoves).toHaveLength(1);
    const loserPage = results[0]?.kind === "CONFIRMED" ? b : a;
    const loserTrade = loserPage === a ? tradeA : tradeB;
    expect(tradeOf(loserPage, loserTrade).shape).toBe("payment-without-right");
    expect(tradeOf(loserPage, loserTrade).facets.issuance.outcome).toBe("REJECTED");
  });

  it("a rival channel lands first: this page shows zero successes and one observed transfer that is not its own", async () => {
    const { port, controller } = controllerFor("rival-channel");
    await controller.refresh();
    const tradeRef = confirmed(await controller.run({ step: "book", intentRef: "book", listingRef: "lst-0001" }));
    await controller.refresh();
    const result = await controller.run({ step: "transfer", intentRef: "move", tradeRef });
    expect(result).toMatchObject({ kind: "REJECTED", intent: { code: "VERSION_STALE" } });
    await controller.refresh();
    const projection = projectPlatform(controller.state());
    const right = projection.rights.find((item) => item.rightRef === "rgt-0001");
    expect(right).toMatchObject({ holder: "holder-rival", version: 8, observedTransfers: 1, integrityFault: false });
    const rival = projection.trades.find((item) => item.bookedBy === "holder-rival");
    expect(rival).toMatchObject({ linked: false, shape: "booking-payment-right" });
    expect(rival?.facets.issuance.outcome).toBeNull();
    expect(controller.state().intents.filter((intent) => intent.outcome === "CONFIRMED" && intent.step === "transfer")).toHaveLength(0);
    expect(tradeOf(controller, tradeRef).shape).toBe("payment-without-right");
    expect(port.effects()).toMatchObject({ rivalTransfers: 1, transfers: 0 });
  });

  it("flags two observed transfers on one right as an integrity fault instead of showing two successes", async () => {
    const { controller } = controllerFor();
    await controller.refresh();
    const state = controller.state();
    const snapshot = state.snapshot;
    if (!snapshot) {
      throw new Error("no snapshot");
    }
    const issued = (tradeRef: string, transferRef: string) => ({
      tradeRef,
      channel: "web-board" as const,
      listingRef: "lst-0001",
      rightRef: "rgt-0001",
      termsRef: "trm-0001",
      expectedVersion: 7,
      bookedBy: "platform-desk",
      originalRight: { holder: "holder-seed-1", version: 7 },
      facets: {
        booking: { facet: "booking" as const, state: "observed" as const, ref: tradeRef, code: null, note: "" },
        payment: { facet: "payment" as const, state: "observed" as const, ref: "pay-0001", code: null, note: "" },
        issuance: { facet: "issuance" as const, state: "observed" as const, ref: transferRef, code: null, note: "" },
        refund: { facet: "refund" as const, state: "none" as const, ref: null, code: null, note: "" },
      },
    });
    const tampered: PlatformControllerState = {
      ...state,
      snapshot: { ...snapshot, trades: [issued("trd-0001", "xfr-0001"), issued("trd-0002", "xfr-0002")] },
    };
    const right = projectPlatform(tampered).rights.find((item) => item.rightRef === "rgt-0001");
    expect(right).toMatchObject({ observedTransfers: 2, integrityFault: true });
  });
});

describe("payment lost", () => {
  it("shows booking, payment, issuance, and refund apart, blocks the transfer, and leaves the right as it was", async () => {
    const { port, controller } = controllerFor("payment-lost");
    await controller.refresh();
    const tradeRef = confirmed(await controller.run({ step: "book", intentRef: "book", listingRef: "lst-0001" }));
    await controller.refresh();
    const trade = tradeOf(controller, tradeRef);
    expect(trade.shape).toBe("payment-unknown");
    expect(trade.linked).toBe(true);
    expect(platformFacetList(trade).map((view) => view.facet)).toEqual([...PLATFORM_FACETS]);
    expect(trade.facets.booking).toMatchObject({ outcome: "CONFIRMED", observed: { state: "observed" } });
    expect(trade.facets.payment).toMatchObject({ outcome: "NOT_BOUND", observed: { state: "unknown", code: "PAYMENT_OBSERVATION_MISSING" } });
    expect(trade.facets.issuance).toMatchObject({ outcome: null, observed: { state: "none" } });
    expect(trade.facets.refund).toMatchObject({ outcome: "NOT_BOUND", code: PLATFORM_COMPENSATION_UNDEFINED, observed: { state: "unavailable" } });
    expect(trade.currentRight).toEqual({ holder: "holder-seed-1", version: 7 });
    expect(controller.gateFor({ step: "transfer", intentRef: "move", tradeRef })).toEqual({
      reason: "payment-unobserved",
      tradeRef,
    });
    const blocked = await controller.run({ step: "transfer", intentRef: "move", tradeRef });
    expect(blocked).toEqual({ kind: "FENCED", fence: { reason: "payment-unobserved", tradeRef } });
    expect(controller.state().counters.sent).toBe(1);
    expect(port.effects()).toMatchObject({ transfers: 0, paymentObservations: 0 });
    // The source refuses it too, if a caller goes around the page.
    const around = await port.submit({
      contextKey: controller.state().context.key,
      actorRef: "platform-desk",
      intentRef: "around",
      step: "transfer",
      tradeRef,
      listingRef: "lst-0001",
      rightRef: "rgt-0001",
      termsRef: "trm-0001",
      expectedVersion: 7,
    });
    expect(around).toMatchObject({ kind: "rejected", code: "PAYMENT_NOT_OBSERVED" });
  });
});

describe("client retry makes no new payment effect", () => {
  it("a lost booking response fences every further write on the right, and no read, click, or channel lifts it", async () => {
    const inner = createStubPlatformJourney({ scenario: "book-lost" });
    const { port, writes } = spyOn(inner);
    const controller = new PlatformJourneyController(port, { actorRef: "platform-desk" });
    await controller.refresh();
    const lost = await controller.run({ step: "book", intentRef: "book-1", listingRef: "lst-0001" });
    expect(lost).toMatchObject({ kind: "UNKNOWN", intent: { outcome: "UNKNOWN", code: "RESPONSE_LOST" } });
    expect(inner.effects()).toMatchObject({ books: 1, paymentObservations: 1 });

    const fence = { reason: "unknown-outcome", intentRef: "book-1", lateRecorded: false, earlierContext: false };
    const sameListing = await controller.run({ step: "book", intentRef: "book-2", listingRef: "lst-0001" });
    expect(sameListing).toEqual({ kind: "FENCED", fence });
    const otherChannel = await controller.run({ step: "book", intentRef: "book-3", listingRef: "lst-0002" });
    expect(otherChannel).toEqual({ kind: "FENCED", fence });

    // A read shows the trade, and the read does not resolve the unknown write or link the trade to it.
    await controller.refresh();
    const projection = projectPlatform(controller.state());
    expect(projection.trades).toHaveLength(1);
    expect(projection.trades[0]).toMatchObject({ tradeRef: "trd-0001", linked: false });
    expect(projection.trades[0]?.facets.booking.outcome).toBeNull();
    expect(projection.unlinkedIntents.map((intent) => [intent.intentRef, intent.outcome])).toEqual([["book-1", "UNKNOWN"]]);
    const afterRead = await controller.run({ step: "reprice", intentRef: "price", listingRef: "lst-0001", nextTier: "tier-3" });
    expect(afterRead).toEqual({ kind: "FENCED", fence });

    expect(writes).toHaveLength(1);
    expect(inner.effects()).toMatchObject({ submits: 1, books: 1, paymentObservations: 1 });
    expect(controller.state().counters).toMatchObject({ sent: 1, fenced: 3 });

    // Another right is a different scope and stays open.
    const otherRight = await controller.run({ step: "book", intentRef: "book-4", listingRef: "lst-0003" });
    expect(otherRight.kind).toBe("UNKNOWN");
    expect(writes).toHaveLength(2);
  });

  it("a lost transfer response keeps the right fenced while a read shows the right moved", async () => {
    const { port, controller } = controllerFor("transfer-lost");
    await controller.refresh();
    const tradeRef = confirmed(await controller.run({ step: "book", intentRef: "book", listingRef: "lst-0001" }));
    await controller.refresh();
    const lost = await controller.run({ step: "transfer", intentRef: "move", tradeRef });
    expect(lost.kind).toBe("UNKNOWN");
    await controller.refresh();
    const trade = tradeOf(controller, tradeRef);
    expect(trade.facets.issuance).toMatchObject({ outcome: "UNKNOWN", code: "RESPONSE_LOST", observed: { state: "observed" } });
    expect(trade.shape).toBe("unknown-effect");
    expect(trade.currentRight).toEqual({ holder: "platform-desk", version: 8 });
    const again = await controller.run({ step: "transfer", intentRef: "move-again", tradeRef });
    expect(again).toMatchObject({ kind: "FENCED", fence: { reason: "unknown-outcome", intentRef: "move" } });
    expect(port.effects().transfers).toBe(1);
    expect(controller.state().counters.sent).toBe(2);
  });

  it("an exception after send, and a result for another intent, are unknown and are not sent again", async () => {
    const inner = createStubPlatformJourney();
    let calls = 0;
    const throwing: PlatformJourneyPort = {
      environment: inner.environment,
      source: inner.source,
      scenario: inner.scenario,
      read: (request) => inner.read(request),
      submit: async () => {
        calls += 1;
        throw new Error("socket closed after send");
      },
      deliverHeld: () => 0,
      deliverLate: () => [],
    };
    const controller = new PlatformJourneyController(throwing, { actorRef: "platform-desk" });
    await controller.refresh();
    const result = await controller.run({ step: "book", intentRef: "book", listingRef: "lst-0001" });
    expect(result).toMatchObject({ kind: "UNKNOWN", intent: { code: "RESPONSE_LOST", message: "socket closed after send" } });
    expect(await controller.run({ step: "book", intentRef: "book-2", listingRef: "lst-0001" })).toMatchObject({ kind: "FENCED" });
    expect(calls).toBe(1);

    const wrong: PlatformJourneyPort = {
      ...throwing,
      submit: async (request): Promise<PlatformWriteOutcome> => ({
        kind: "unknown",
        step: "book",
        intentRef: "someone-else",
        contextKey: request.contextKey,
        message: "x",
      }),
    };
    const second = new PlatformJourneyController(wrong, { actorRef: "platform-desk" });
    await second.refresh();
    const miscorrelated = await second.run({ step: "book", intentRef: "book", listingRef: "lst-0001" });
    expect(miscorrelated).toMatchObject({ kind: "UNKNOWN", intent: { code: "CORRELATION" } });
  });
});

describe("late results", () => {
  it("records a late result as evidence and leaves the write unknown and the right fenced", async () => {
    const { port, controller } = controllerFor("transfer-late");
    await controller.refresh();
    const tradeRef = confirmed(await controller.run({ step: "book", intentRef: "book", listingRef: "lst-0001" }));
    await controller.refresh();
    expect((await controller.run({ step: "transfer", intentRef: "move", tradeRef })).kind).toBe("UNKNOWN");
    const deliveries = port.deliverLate();
    expect(deliveries).toHaveLength(1);
    const recorded = controller.acceptLate(deliveries[0] as NonNullable<(typeof deliveries)[number]>);
    expect(recorded).toMatchObject({ kind: "RECORDED", intent: { outcome: "UNKNOWN", late: { result: "confirmed", code: null } } });
    const fence = await controller.run({ step: "transfer", intentRef: "move-2", tradeRef });
    expect(fence).toEqual({
      kind: "FENCED",
      fence: { reason: "unknown-outcome", intentRef: "move", lateRecorded: true, earlierContext: false },
    });
    await controller.refresh();
    expect(tradeOf(controller, tradeRef).facets.issuance).toMatchObject({ outcome: "UNKNOWN", lateRecorded: true });
    expect(port.effects().transfers).toBe(1);
  });

  it("quarantines a late result for another context, an unknown intent, or a write that is not unknown", async () => {
    const { port, controller } = controllerFor("transfer-late");
    await controller.refresh();
    const tradeRef = confirmed(await controller.run({ step: "book", intentRef: "book", listingRef: "lst-0001" }));
    await controller.refresh();
    await controller.run({ step: "transfer", intentRef: "move", tradeRef });
    const [delivery] = port.deliverLate();
    if (!delivery) {
      throw new Error("no late delivery");
    }
    expect(controller.acceptLate({ ...delivery, intentRef: "never-sent" })).toEqual({ kind: "QUARANTINED", cause: "no-unknown-intent" });
    expect(controller.acceptLate({ ...delivery, intentRef: "book" })).toEqual({ kind: "QUARANTINED", cause: "no-unknown-intent" });
    controller.switchContext({ actorRef: "other-desk" });
    expect(controller.acceptLate(delivery)).toEqual({ kind: "QUARANTINED", cause: "different-context" });
    expect(controller.state().quarantined.map((item) => item.cause)).toEqual([
      "no-unknown-intent",
      "no-unknown-intent",
      "different-context",
    ]);
    expect(controller.state().intents.find((intent) => intent.intentRef === "move")?.late).toBeNull();
  });

  it("a late rejection also leaves the write unknown, because unknown is not the same as not applied", async () => {
    const port = createStubPlatformJourney({ scenario: "transfer-late", lateResult: "rejected" });
    const controller = new PlatformJourneyController(port, { actorRef: "platform-desk" });
    await controller.refresh();
    const tradeRef = confirmed(await controller.run({ step: "book", intentRef: "book", listingRef: "lst-0001" }));
    await controller.refresh();
    await controller.run({ step: "transfer", intentRef: "move", tradeRef });
    for (const delivery of port.deliverLate()) {
      controller.acceptLate(delivery);
    }
    const intent = controller.state().intents.find((item) => item.intentRef === "move");
    expect(intent).toMatchObject({ outcome: "UNKNOWN", late: { result: "rejected", code: "VERSION_STALE" } });
    expect((await controller.run({ step: "transfer", intentRef: "move-2", tradeRef })).kind).toBe("FENCED");
  });
});

describe("stale session", () => {
  it("a result that arrives after a context switch is quarantined, and the unknown fence outlives the switch", async () => {
    const inner = createStubPlatformJourney({ scenario: "held-response" });
    const { port, writes } = spyOn(inner);
    const controller = new PlatformJourneyController(port, { actorRef: "platform-desk" });
    await controller.refresh();
    const pending = controller.run({ step: "book", intentRef: "book", listingRef: "lst-0001" });
    expect(controller.state().intents[0]?.outcome).toBe("IN_FLIGHT");

    controller.switchContext({ actorRef: "other-desk" });
    const afterSwitch = controller.state();
    expect(afterSwitch.snapshot).toBeNull();
    expect(afterSwitch.refreshRequired).toBe("context-switch");
    expect(afterSwitch.intents[0]).toMatchObject({ outcome: "UNKNOWN", code: "CONTEXT_SWITCHED" });

    expect(inner.deliverHeld()).toBe(1);
    const settled = await pending;
    expect(settled).toMatchObject({ kind: "QUARANTINED", intent: { outcome: "UNKNOWN", refs: null } });
    expect(controller.state().quarantined).toEqual([
      { intentRef: "book", contextKey: "stub|" + afterSwitch.context.domain + "|platform-desk|1", arrived: "confirmed", code: null, cause: "context-changed" },
    ]);
    // The discarded result created no linked trade and resolved nothing.
    expect(projectPlatform(controller.state()).trades).toEqual([]);

    // In the new context the right is still fenced by the earlier unknown write. Another right is not.
    await controller.refresh();
    const blocked = await controller.run({ step: "book", intentRef: "book-2", listingRef: "lst-0002" });
    expect(blocked).toEqual({
      kind: "FENCED",
      fence: { reason: "unknown-outcome", intentRef: "book", lateRecorded: false, earlierContext: true },
    });
    const free = controller.run({ step: "book", intentRef: "book-3", listingRef: "lst-0003" });
    expect(inner.deliverHeld()).toBe(1);
    expect((await free).kind).toBe("CONFIRMED");
    expect(writes.map((write) => write.intentRef)).toEqual(["book", "book-3"]);
    expect(writes[1]?.actorRef).toBe("other-desk");
    expect(inner.effects().paymentObservations).toBe(2);
  });

  it("a stale read after a rejection must be read again before the next write", async () => {
    const { controller } = controllerFor("rival-channel");
    await controller.refresh();
    const tradeRef = confirmed(await controller.run({ step: "book", intentRef: "book", listingRef: "lst-0001" }));
    await controller.refresh();
    await controller.run({ step: "transfer", intentRef: "move", tradeRef });
    expect(controller.state()).toMatchObject({ freshness: "STALE", refreshRequired: "stale-rejection" });
    const fenced = await controller.run({ step: "reprice", intentRef: "price", listingRef: "lst-0002", nextTier: "tier-3" });
    expect(fenced).toEqual({ kind: "FENCED", fence: { reason: "snapshot-stale", cause: "stale-rejection" } });
    await controller.refresh();
    expect(controller.state().freshness).toBe("CURRENT");
  });
});

describe("changed price", () => {
  it("makes the earlier booking terms stale, and the trade that took payment shows no right and no refund", async () => {
    const { port, controller } = controllerFor();
    await controller.refresh();
    const tradeRef = confirmed(await controller.run({ step: "book", intentRef: "book", listingRef: "lst-0001" }));
    await controller.refresh();
    const repriced = await controller.run({ step: "reprice", intentRef: "price", listingRef: "lst-0001", nextTier: "tier-3" });
    expect(repriced).toMatchObject({
      kind: "CONFIRMED",
      intent: { refs: { listingRef: "lst-0004", supersededListingRef: "lst-0001", termsRef: "trm-0004" } },
    });
    await controller.refresh();
    const moved = await controller.run({ step: "transfer", intentRef: "move", tradeRef });
    expect(moved).toMatchObject({ kind: "REJECTED", intent: { code: "TERMS_CHANGED" } });
    await controller.refresh();
    const trade = tradeOf(controller, tradeRef);
    expect(trade.shape).toBe("payment-without-right");
    expect(trade.facets.refund.observed).toMatchObject({ state: "unavailable", code: PLATFORM_COMPENSATION_UNDEFINED, ref: null });
    expect(trade.identities).toEqual({
      listing: "lst-0001",
      right: "rgt-0001",
      trade: tradeRef,
      payment: "pay-0001",
      transfer: null,
      refund: null,
    });
    const projection = projectPlatform(controller.state());
    expect(projection.listings.map((item) => [item.listingRef, item.status])).toEqual([
      ["lst-0001", "superseded"],
      ["lst-0002", "open"],
      ["lst-0003", "open"],
      ["lst-0004", "open"],
    ]);
    expect(port.effects()).toMatchObject({ reprices: 1, transfers: 0 });
  });
});

describe("not-bound and changed tuple", () => {
  it("never switches to the stub: the not-bound port is read-only text and a write is fenced before any send", async () => {
    const port = createNotBoundPlatformJourney();
    const controller = new PlatformJourneyController(port, { actorRef: "platform-desk" });
    expect(controller.state().context.environment).toBe("integration-http");
    expect(await controller.refresh()).toEqual({ kind: "APPLIED", readState: "not-bound" });
    expect(controller.state()).toMatchObject({ freshness: "UNAVAILABLE", snapshot: null });
    expect(controller.state().readDetail).toContain("not-bound on integration-http");
    expect(await controller.run({ step: "book", intentRef: "book", listingRef: "lst-0001" })).toEqual({
      kind: "FENCED",
      fence: { reason: "not-bound" },
    });
    expect(controller.state().counters).toMatchObject({ sent: 0, fenced: 1 });
    expect(controller.state().intents).toEqual([]);
  });

  it("reads a changed tuple as its own state and never applies a snapshot", async () => {
    const port = createStubPlatformJourney({
      expectedTuple: { ...(await tupleLiterals()), protocolMergeSha: "1".repeat(40) },
    });
    const controller = new PlatformJourneyController(port, { actorRef: "platform-desk" });
    expect(await controller.refresh()).toEqual({ kind: "APPLIED", readState: "tuple-changed" });
    expect(controller.state()).toMatchObject({ freshness: "UNAVAILABLE", snapshot: null });
    expect(controller.state().readDetail).toContain("protocolMergeSha");
    expect(port.effects().submits).toBe(0);
  });

  it("reads a throwing source as unavailable and not as empty", async () => {
    const inner = createStubPlatformJourney();
    const broken: PlatformJourneyPort = {
      environment: inner.environment,
      source: inner.source,
      scenario: inner.scenario,
      read: async () => {
        throw new Error("source lost");
      },
      submit: (request) => inner.submit(request),
      deliverHeld: () => 0,
      deliverLate: () => [],
    };
    const controller = new PlatformJourneyController(broken, { actorRef: "platform-desk" });
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
