import { describe, expect, it } from "vitest";
import {
  JOURNEY_IDENTITY_DESK_ACTOR,
  JourneyIdentityController,
  SessionRecoveryController,
  createNotBoundJourneyIdentity,
  createStubJourneyIdentity,
  identitySender,
  openSessionJournal,
  type JourneyIdentityPort,
  type JourneyIdentityScenario,
  type SessionJournal,
  type SessionSender,
} from "../src/index.js";
import { FakeSessionStore } from "./support/fake-session-store.js";

interface Spy {
  submits: number;
}

/** One page load: a stub source, an identity controller, a journal over the shared store, and the recovery controller. */
async function load(store: FakeSessionStore, spy: Spy, scenario: JourneyIdentityScenario = "attach-lost") {
  const stub = createStubJourneyIdentity({ scenario });
  const port: JourneyIdentityPort = {
    environment: stub.environment,
    source: stub.source,
    scenario: stub.scenario,
    currentGeneration: () => stub.currentGeneration(),
    read: (request) => stub.read(request),
    submit: (request) => {
      spy.submits += 1;
      return stub.submit(request);
    },
    rotateCut: () => stub.rotateCut(),
    deliverHeld: () => stub.deliverHeld(),
    deliverLate: () => stub.deliverLate(),
  };
  const identity = new JourneyIdentityController(port, { actorRef: JOURNEY_IDENTITY_DESK_ACTOR, role: "operator" });
  await identity.refresh();
  const journal = openSessionJournal(store);
  const controller = new SessionRecoveryController(journal, identitySender(identity, { bound: true }), identity.state().context.key);
  return { stub, identity, journal, controller };
}

const FIRST = "obs-0001";
const SECOND = "obs-0002";

describe("session recovery controller", () => {
  it("writes the intent before the send and settles after", async () => {
    const store = new FakeSessionStore();
    const spy: Spy = { submits: 0 };
    const { controller, journal } = await load(store, spy, "clean");
    const seen: string[] = [];
    controller.subscribe(() => seen.push(journal.records()[0]?.outcome ?? "none"));
    const result = await controller.run(FIRST);
    expect(result).toMatchObject({ kind: "CONFIRMED", record: { intentRef: "intent-1", outcome: "CONFIRMED" } });
    expect(seen[0]).toBe("IN_FLIGHT");
    expect(spy.submits).toBe(1);
    expect(controller.state().counters).toMatchObject({ sent: 1, fenced: 0, notSent: 0 });
  });

  it("recovers a lost answer as UNKNOWN after a reload and sends nothing", async () => {
    const store = new FakeSessionStore();
    const spy: Spy = { submits: 0 };
    const first = await load(store, spy);
    const lost = await first.controller.run(FIRST);
    expect(lost).toMatchObject({ kind: "UNKNOWN", record: { outcome: "UNKNOWN", code: "RESPONSE_LOST" } });
    expect(spy.submits).toBe(1);

    const second = await load(store, spy);
    expect(spy.submits).toBe(1);
    expect(second.controller.state().counters.sent).toBe(0);
    const fence = second.controller.gateFor(FIRST);
    expect(fence).toMatchObject({ reason: "unresolved", earlierLoad: true, inFlight: false });
    expect(await second.controller.run(FIRST)).toMatchObject({ kind: "FENCED", fence: { reason: "unresolved" } });
    expect(spy.submits).toBe(1);
    expect(second.controller.state()).toMatchObject({ exactlyOnceClaimed: false, durableAcrossStorageLoss: false });
  });

  it("recovers an intent that was in flight at reload as UNKNOWN with no resend", async () => {
    const store = new FakeSessionStore();
    const spy: Spy = { submits: 0 };
    const first = await load(store, spy, "held-response");
    const pending = first.controller.run(FIRST);
    await Promise.resolve();
    expect(first.journal.records()[0]?.outcome).toBe("IN_FLIGHT");
    // The page goes away here: the second load opens the same store.
    const second = await load(store, spy, "held-response");
    expect(second.journal.records()[0]).toMatchObject({ outcome: "UNKNOWN", code: "RECOVERED_AFTER_RELOAD" });
    expect(second.controller.state().counters.recoveredUnknown).toBe(1);
    expect(await second.controller.run(FIRST)).toMatchObject({ kind: "FENCED" });
    expect(spy.submits).toBe(1);
    first.stub.deliverHeld();
    await pending;
  });

  it("holds the scope and sends nothing new or compensating after an UNKNOWN, but lets another scope through", async () => {
    const store = new FakeSessionStore();
    const spy: Spy = { submits: 0 };
    const first = await load(store, spy);
    await first.controller.run(FIRST);
    const second = await load(store, spy);
    for (let i = 0; i < 5; i += 1) {
      expect(await second.controller.run(FIRST)).toMatchObject({ kind: "FENCED" });
    }
    expect(spy.submits).toBe(1);
    expect(second.stub.effects().attaches).toBe(0);
    expect(second.controller.state().counters).toMatchObject({ sent: 0, fenced: 5 });
    const other = await second.controller.run(SECOND);
    expect(other.kind).not.toBe("FENCED");
    expect(spy.submits).toBe(2);
    // Intent numbers continue across loads.
    expect(second.journal.records().map((r) => r.intentRef)).toEqual(["intent-1", "intent-2"]);
  });

  it("shows a confirmed record from an earlier load as history that lifts no fence", async () => {
    const store = new FakeSessionStore();
    const spy: Spy = { submits: 0 };
    const first = await load(store, spy, "clean");
    expect(await first.controller.run(FIRST)).toMatchObject({ kind: "CONFIRMED" });
    const second = await load(store, spy, "clean");
    const state = second.controller.state();
    expect(state.records[0]).toMatchObject({ outcome: "CONFIRMED", loadNo: 1 });
    expect(state.load).toBe(2);
    expect(spy.submits).toBe(1);
    expect(state.counters.sent).toBe(0);
  });

  it("refuses to send when the write-ahead record is refused", async () => {
    const store = new FakeSessionStore();
    const spy: Spy = { submits: 0 };
    const { controller, journal } = await load(store, spy, "clean");
    store.quota = 5;
    const result = await controller.run(FIRST);
    expect(result).toMatchObject({ kind: "NOT_SENT", reason: "write-refused" });
    expect(spy.submits).toBe(0);
    expect(journal.records()).toHaveLength(0);
    expect(controller.state().counters).toMatchObject({ sent: 0, notSent: 1 });
  });

  it("locks the scope UNKNOWN when the answer cannot be recorded, keeps the answer in memory only, and stays locked after a reload", async () => {
    const store = new FakeSessionStore();
    const spy: Spy = { submits: 0 };
    const { controller } = await load(store, spy, "clean");
    const original = store.setItem.bind(store);
    let writes = 0;
    store.setItem = (key, value) => {
      writes += 1;
      // The first write (the intent) lands; every later write fails.
      if (writes > 1) {
        throw new Error("QuotaExceededError");
      }
      original(key, value);
    };
    const result = await controller.run(FIRST);
    expect(result).toMatchObject({ kind: "UNKNOWN", observed: "confirmed", record: { outcome: "UNKNOWN", code: "JOURNAL_SETTLE_FAILED" } });
    expect(controller.state().observations).toEqual([{ intentRef: "intent-1", observed: "confirmed", code: null }]);
    expect(await controller.run(FIRST)).toMatchObject({ kind: "FENCED", fence: { reason: "unresolved", code: "JOURNAL_SETTLE_FAILED" } });
    store.setItem = original;
    const second = await load(store, spy, "clean");
    expect(await second.controller.run(FIRST)).toMatchObject({ kind: "FENCED", fence: { reason: "unresolved" } });
    expect(spy.submits).toBe(1);
  });

  it("holds every write when the journal is lost, and issues no new reference", async () => {
    const store = new FakeSessionStore();
    const spy: Spy = { submits: 0 };
    const first = await load(store, spy, "clean");
    await first.controller.run(FIRST);
    store.data.set("kix-session-journal", "{broken");
    const second = await load(store, spy, "clean");
    expect(second.controller.state().status).toEqual({ kind: "evidence-lost", cause: "CORRUPT" });
    expect(await second.controller.run(FIRST)).toMatchObject({ kind: "FENCED", fence: { reason: "evidence-lost", cause: "CORRUPT" } });
    expect(await second.controller.run(SECOND)).toMatchObject({ kind: "FENCED", fence: { reason: "evidence-lost" } });
    expect(spy.submits).toBe(1);
    expect(second.journal.nextSeq()).toBe(0);
    expect(second.controller.state().records).toEqual([]);
  });

  it("locks the session when the store is cleared mid-session", async () => {
    const store = new FakeSessionStore();
    const spy: Spy = { submits: 0 };
    const { controller } = await load(store, spy, "clean");
    store.data.clear();
    expect(await controller.run(FIRST)).toMatchObject({ kind: "FENCED", fence: { reason: "evidence-lost", cause: "LOST_DURING_SESSION" } });
    expect(spy.submits).toBe(0);
  });

  it("keeps the hold after a reload when the store was cleared and then checked mid-session", async () => {
    const store = new FakeSessionStore();
    const spy: Spy = { submits: 0 };
    const first = await load(store, spy);
    expect(await first.controller.run(FIRST)).toMatchObject({ kind: "UNKNOWN" });
    store.data.clear();
    first.controller.verify();
    const second = await load(store, spy);
    expect(second.controller.gateFor(FIRST)).toMatchObject({ reason: "evidence-lost", cause: "LOST_DURING_SESSION" });
    expect(await second.controller.run(FIRST)).toMatchObject({ kind: "FENCED", fence: { reason: "evidence-lost", cause: "LOST_DURING_SESSION" } });
    expect(await second.controller.run(SECOND)).toMatchObject({ kind: "FENCED", fence: { reason: "evidence-lost", cause: "LOST_DURING_SESSION" } });
    expect(spy.submits).toBe(1);
    expect(second.stub.effects().attaches).toBe(0);
    expect(second.journal.nextSeq()).toBe(0);
  });

  it("records a store cleared while a send was in flight as an UNKNOWN the page cannot persist", async () => {
    const store = new FakeSessionStore();
    const spy: Spy = { submits: 0 };
    const { controller, stub } = await load(store, spy, "held-response");
    const pending = controller.run(FIRST);
    await Promise.resolve();
    store.data.clear();
    stub.deliverHeld();
    const result = await pending;
    expect(result).toMatchObject({ kind: "UNKNOWN", record: { code: "JOURNAL_SETTLE_FAILED" } });
    expect(await controller.run(FIRST)).toMatchObject({ kind: "FENCED" });
    expect(spy.submits).toBe(1);
    const reopened = await load(store, spy);
    expect(await reopened.controller.run(FIRST)).toMatchObject({ kind: "FENCED", fence: { reason: "evidence-lost", cause: "LOST_DURING_SESSION" } });
    expect(spy.submits).toBe(1);
    expect(reopened.controller.state().records).toEqual([]);
  });

  it("turns an in-flight intent UNKNOWN on a tab resume, and a later answer is evidence only", async () => {
    const store = new FakeSessionStore();
    const spy: Spy = { submits: 0 };
    const { controller, stub, journal } = await load(store, spy, "held-response");
    const pending = controller.run(FIRST);
    await Promise.resolve();
    expect(controller.resume()).toBe(1);
    expect(journal.records()[0]).toMatchObject({ outcome: "UNKNOWN", code: "TAB_RESUMED" });
    expect(controller.state().counters.recoveredUnknown).toBe(1);
    stub.deliverHeld();
    const result = await pending;
    expect(result).toMatchObject({ kind: "UNKNOWN", record: { outcome: "UNKNOWN", code: "TAB_RESUMED" } });
    expect(journal.records()[0]).toMatchObject({ outcome: "UNKNOWN", code: "TAB_RESUMED" });
    expect(controller.state().observations).toHaveLength(1);
    expect(await controller.run(FIRST)).toMatchObject({ kind: "FENCED" });
    expect(spy.submits).toBe(1);
  });

  it("serialises a second write on the same scope while the first is in flight", async () => {
    const store = new FakeSessionStore();
    const spy: Spy = { submits: 0 };
    const { controller, stub } = await load(store, spy, "held-response");
    const pending = controller.run(FIRST);
    await Promise.resolve();
    expect(await controller.run(FIRST)).toMatchObject({ kind: "FENCED", fence: { reason: "unresolved", inFlight: true } });
    stub.deliverHeld();
    await pending;
    expect(spy.submits).toBe(1);
  });

  it("refuses the next write when the journal is full, with no eviction", async () => {
    const store = new FakeSessionStore();
    const spy: Spy = { submits: 0 };
    const stub = createStubJourneyIdentity({ scenario: "clean" });
    const identity = new JourneyIdentityController(stub, { actorRef: JOURNEY_IDENTITY_DESK_ACTOR, role: "operator" });
    await identity.refresh();
    const journal = openSessionJournal(store, { budget: { maxRecords: 1, maxBytes: 12288 } });
    const base = identitySender(identity, { bound: true });
    const sender: SessionSender = { ...base, send: (target, ref) => { spy.submits += 1; return base.send(target, ref); } };
    const controller = new SessionRecoveryController(journal, sender, identity.state().context.key);
    expect(await controller.run(FIRST)).toMatchObject({ kind: "CONFIRMED" });
    await identity.refresh();
    expect(await controller.run(SECOND)).toMatchObject({ kind: "NOT_SENT", reason: "journal-full" });
    expect(spy.submits).toBe(1);
    expect(journal.records()).toHaveLength(1);
  });

  it("keeps the not-bound reason and records nothing on integration-http", async () => {
    const store = new FakeSessionStore();
    const identity = new JourneyIdentityController(createNotBoundJourneyIdentity(), { actorRef: JOURNEY_IDENTITY_DESK_ACTOR, role: "operator" });
    await identity.refresh();
    const journal: SessionJournal = openSessionJournal(store);
    const controller = new SessionRecoveryController(journal, identitySender(identity, { bound: false }), identity.state().context.key);
    expect(await controller.run(FIRST)).toMatchObject({ kind: "FENCED", fence: { reason: "not-bound" } });
    expect(journal.records()).toEqual([]);
  });

  it("offers no resend, resolve, clear, or compensate call", async () => {
    const { controller } = await load(new FakeSessionStore(), { submits: 0 });
    const target = controller as unknown as Record<string, unknown>;
    for (const name of ["resend", "resolve", "clear", "compensate", "retryUnknown", "forget", "reset"]) {
      expect(target[name], name).toBeUndefined();
    }
  });

  it("stores no actor label or context key", async () => {
    const store = new FakeSessionStore();
    const { controller } = await load(store, { submits: 0 }, "clean");
    await controller.run(FIRST);
    const text = store.getItem("kix-session-journal") as string;
    expect(text).not.toContain(JOURNEY_IDENTITY_DESK_ACTOR);
    expect(text).not.toContain("|");
  });
});
