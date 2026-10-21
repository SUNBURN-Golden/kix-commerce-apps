import { readFileSync } from "node:fs";
import ts from "typescript";
import { SYNTHETIC_WRITERS, CATALOGUE_WRITERS } from "./support/connectivity-actions";
import { PROTOCOL_READS, actionAllowed, connectedActions, connectivityController, connectivityPort, guardedWrite, connectivityInvoker, connectivityProtocol } from "../src/connectivity/write-guard";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BookingJourney, createStubJourneyInvoker, createStubJourneyIdentity, identitySender,
  JOURNEY_IDENTITY_DESK_ACTOR, JourneyIdentityController, openSessionJournal,
  SessionRecoveryController, StubProtocolAdapter, type SessionStorePort,
} from "@kix/protocol-adapter";
import { connectivity, createConnectivityStore } from "../src/connectivity/store";
import { runSettlementCommand } from "../src/settlement-desk";
import { MarketingStubDesk } from "../src/marketing/desk";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
afterEach(() => { connectivity.setBrowserOnline(true); vi.restoreAllMocks(); });

describe("connectivity dispatch boundary", () => {
  it("distinguishes nothing sent from an interrupted dispatch; reconnect stores no work", async () => {
    const store = createConnectivityStore("stub", false);
    const held = deferred<string>();
    const send = vi.fn(() => held.promise);
    await expect(guardedWrite(send, store)).rejects.toMatchObject({ code: "CONNECTIVITY_BLOCKED" });
    expect(send).not.toHaveBeenCalled();
    store.setBrowserOnline(true);
    const pending = guardedWrite(send, store);
    const rejected = expect(pending).rejects.toThrow("UNKNOWN");
    store.setBrowserOnline(false);
    await rejected;
    store.setBrowserOnline(true);
    held.resolve("late success");
    await Promise.resolve();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("puts the UNKNOWN fence inside the catalogue controller and ignores a late success", async () => {
    const source = createStubJourneyInvoker();
    const held = deferred<unknown>();
    const call = vi.fn(() => held.promise);
    const journey = new BookingJourney(connectivityInvoker({ invokeLocalCall: call }));
    const input = { operationId: "offline-create-1", eventId: "offline-event", organizer: "organizer", seats: ["seat-1"], policy: { primaryPrice: 100 } };
    const pending = journey.createEvent(input);
    connectivity.setBrowserOnline(false);
    expect((await pending).kind).toBe("UNKNOWN");
    connectivity.setBrowserOnline(true);
    // A plain interruption error must not be misclassified as an untraced ProtocolError / NOT_SENT.
    expect(journey.state().halted?.kind).toBe("UNKNOWN");
    held.resolve(await source.invokeLocalCall({ operationId: input.operationId, actor: "organizer", action: "create_event", body: { eventId: input.eventId, organizer: "organizer", seats: ["seat-1"], policy: { primaryPrice: 100 } } }));
    await Promise.resolve();
    expect((await journey.createEvent({ ...input, operationId: "offline-create-2" })).kind).toBe("FENCED");
    expect(journey.state().halted?.kind).toBe("UNKNOWN");
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("does not consume a legacy attempt when blocked before dispatch", async () => {
    const attempts = { read: vi.fn(() => 0), write: vi.fn() };
    connectivity.setBrowserOnline(false);
    await expect(runSettlementCommand(new StubProtocolAdapter(), "initiate", "pre-send", attempts)).rejects.toMatchObject({ code: "CONNECTIVITY_BLOCKED" });
    expect(attempts.read).not.toHaveBeenCalled();
    expect(attempts.write).not.toHaveBeenCalled();
  });

  it("keeps legacy settlement interruption fenced even when its catch increments the attempt", async () => {
    const adapter = new StubProtocolAdapter();
    const held = deferred<Awaited<ReturnType<typeof adapter.initiateSettlement>>>();
    const send = vi.spyOn(adapter, "initiateSettlement").mockReturnValue(held.promise);
    const guarded = connectivityProtocol(adapter);
    const attempts = { read: () => 0, write: vi.fn() };
    const pending = runSettlementCommand(guarded, "initiate", "offline-legacy", attempts);
    const rejected = expect(pending).rejects.toThrow("UNKNOWN");
    connectivity.setBrowserOnline(false);
    await rejected;
    connectivity.setBrowserOnline(true);
    await guarded.viewSettlement("stl_offline-legacy").catch(() => {});
    await expect(runSettlementCommand(guarded, "initiate", "offline-legacy", attempts)).rejects.toThrow("UNKNOWN");
    expect(send).toHaveBeenCalledTimes(1);
    expect(attempts.write).toHaveBeenCalled();
  });

  it("settles /session interruption through its existing journal, survives late delivery and reload", async () => {
    const source = createStubJourneyIdentity({ scenario: "held-response" });
    const port = connectivityPort(source, "test-session");
    const identity = connectivityController(new JourneyIdentityController(port, { actorRef: JOURNEY_IDENTITY_DESK_ACTOR, role: "operator" }), port);
    await identity.refresh();
    const data = new Map<string, string>();
    const store: SessionStorePort = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: (key) => { data.delete(key); } };
    const sender = identitySender(identity, { bound: true });
    const recovery = new SessionRecoveryController(openSessionJournal(store), sender, identity.state().context.key);
    const pending = recovery.run("obs-0001");
    connectivity.setBrowserOnline(false);
    expect((await pending).kind).toBe("UNKNOWN");
    expect(recovery.state().records[0]?.outcome).toBe("UNKNOWN");
    connectivity.setBrowserOnline(true);
    source.deliverHeld();
    await identity.refresh();
    expect((await recovery.run("obs-0001")).kind).toBe("FENCED");
    const reloaded = new SessionRecoveryController(openSessionJournal(store), sender, identity.state().context.key);
    expect((await reloaded.run("obs-0001")).kind).toBe("FENCED");
    expect(reloaded.state().counters.sent).toBe(0);
    expect(source.effects().submits).toBe(1);
    // The controller's own subject scope remains authoritative; an unrelated subject stays usable.
    const other = recovery.run("obs-0002");
    source.deliverHeld();
    expect((await other).kind).toBe("CONFIRMED");
  });

  it("does not allocate an intent through a direct handler while offline, and keeps synchronous marketing saves off", () => {
    const attach = vi.fn();
    const originalActions = { attach, refresh: vi.fn() };
    const actions = connectedActions(originalActions, ["attach"]);
    const marketing = new MarketingStubDesk();
    const before = marketing.snapshot();
    connectivity.setBrowserOnline(false);
    actions.attach();
    expect(attach).not.toHaveBeenCalled();
    expect(() => marketing.join({ displayName: "draft", tier: "fan" })).toThrow("Nothing sent");
    expect(() => marketing.reset()).toThrow("Nothing sent");
    expect(() => marketing.withdrawConsent()).toThrow("Nothing sent");
    expect(marketing.snapshot()).toEqual(before);
    connectivity.setBrowserOnline(true);
    expect(attach).not.toHaveBeenCalled();
  });

  it("reconnect requires an accepted current read; an old-epoch or refused read cannot clear cached status", async () => {
    const source = createStubJourneyIdentity();
    const original = source.read.bind(source);
    const read = vi.spyOn(source, "read");
    const port = connectivityPort(source, "test-read-epoch");
    const identity = connectivityController(new JourneyIdentityController(port, { actorRef: JOURNEY_IDENTITY_DESK_ACTOR, role: "operator" }), port);
    await identity.refresh();
    expect(actionAllowed(port)).toBe(true);
    const held = deferred<Awaited<ReturnType<typeof source.read>>>();
    read.mockImplementationOnce(() => held.promise);
    const pending = identity.refresh();
    connectivity.setBrowserOnline(false);
    connectivity.setBrowserOnline(true);
    held.resolve(await original({ contextKey: identity.state().context.key, watermarkFloor: null }));
    await pending;
    expect(actionAllowed(port)).toBe(false);
    read.mockResolvedValueOnce({ kind: "not-bound", reason: "still no reader" });
    await identity.refresh();
    expect(actionAllowed(port)).toBe(false);
    await identity.refresh();
    expect(actionAllowed(port)).toBe(true);
  });
});

describe("write entry point inventory", () => {
  it("blocks every CommerceProtocol write before its source is called", async () => {
    const source = readFileSync(new URL("../../../packages/protocol-adapter/src/protocol.ts", import.meta.url), "utf8");
    const parsed = ts.createSourceFile("protocol.ts", source, ts.ScriptTarget.Latest, true);
    const contract = parsed.statements.find((node): node is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(node) && node.name.text === "CommerceProtocol");
    const reads = new Set<string>([...PROTOCOL_READS, "describe", "observeTransport"]);
    const names = contract!.members.map((member) => member.name?.getText(parsed)).filter((name): name is string => Boolean(name) && !reads.has(name!));
    expect(names.length).toBeGreaterThan(40);
    const adapter = new StubProtocolAdapter();
    const called = new Map(names.map((name) => [name, vi.spyOn(adapter, name as keyof typeof adapter)]));
    const guarded = connectivityProtocol(adapter);
    connectivity.setBrowserOnline(false);
    for (const name of names) {
      const method = Reflect.get(guarded, name) as () => Promise<unknown>;
      await expect(method(), name).rejects.toMatchObject({ code: "CONNECTIVITY_BLOCKED" });
      expect(called.get(name), name).not.toHaveBeenCalled();
    }
  });

  it("covers each synthetic sender and each catalogue invoker without changing published bodies", () => {
    for (const writer of SYNTHETIC_WRITERS) {
      const source = readFileSync(new URL(`../src/${writer}.ts`, import.meta.url), "utf8");
      expect(source, writer).toContain("connectivityPort(");
      expect(source, writer).toContain("connectedActions(actions,");
    }
    for (const writer of CATALOGUE_WRITERS) {
      const source = readFileSync(new URL(`../src/${writer}-desk.ts`, import.meta.url), "utf8");
      expect(source, writer).toContain("connectivityInvoker(this.deps.source.invoker)");
      expect(source, writer).toContain("connectedHandler()");
    }
  });
});

describe("read and dispatch failure distinctions", () => {
  it("requires a new accepted legacy read after reconnect; failed reads and offline reads preserve the cached fence", async () => {
    const adapter = new StubProtocolAdapter();
    const read = vi.spyOn(adapter, "listPerformances");
    const guarded = connectivityProtocol(adapter);
    const rows = await guarded.listPerformances();
    expect(rows.length).toBeGreaterThan(0);
    connectivity.setBrowserOnline(false);
    await guarded.listPerformances();
    connectivity.setBrowserOnline(true);
    await expect(guarded.placeHold({ eventId: rows[0].eventId, quantity: 1 })).rejects.toMatchObject({ code: "CONNECTIVITY_BLOCKED" });
    read.mockRejectedValueOnce(new Error("read unavailable"));
    await expect(guarded.listPerformances()).rejects.toThrow("read unavailable");
    await expect(guarded.placeHold({ eventId: rows[0].eventId, quantity: 1 })).rejects.toMatchObject({ code: "CONNECTIVITY_BLOCKED" });
    await guarded.listPerformances();
    expect(await guarded.placeHold({ eventId: rows[0].eventId, quantity: 1 })).toHaveProperty("holdId");
  });

  it("propagates an answered rejection and a synchronous dispatch error without manufacturing UNKNOWN", async () => {
    const store = createConnectivityStore("stub", true);
    const rejection = new Error("explicit source refusal");
    await expect(guardedWrite(() => Promise.reject(rejection), store)).rejects.toBe(rejection);
    await expect(guardedWrite(() => { throw rejection; }, store)).rejects.toBe(rejection);
    expect(await guardedWrite(() => Promise.resolve("confirmed"), store)).toBe("confirmed");
  });

  it("consumes a late rejected response without an unhandled rejection or clearing the interruption", async () => {
    const store = createConnectivityStore("stub", true);
    let reject!: (reason: unknown) => void;
    const answer = new Promise<never>((_resolve, no) => { reject = no; });
    const pending = guardedWrite(() => answer, store);
    const unknown = expect(pending).rejects.toThrow("UNKNOWN");
    store.setBrowserOnline(false);
    await unknown;
    reject(new Error("late refusal"));
    await Promise.resolve();
    expect(store.getSnapshot().writesBlocked).toBe(true);
  });

  it("never promotes ready-looking evidence the controller refuses, then accepts a current empty read", async () => {
    const source = createStubJourneyIdentity();
    const read = vi.spyOn(source, "read");
    const port = connectivityPort(source, "test-refused-read");
    const identity = connectivityController(new JourneyIdentityController(port, { actorRef: JOURNEY_IDENTITY_DESK_ACTOR, role: "operator" }), port);
    await identity.refresh();
    connectivity.setBrowserOnline(false);
    connectivity.setBrowserOnline(true);
    read.mockResolvedValueOnce({ kind: "stale", watermark: "cut-0", floor: "cut-1" });
    await identity.refresh();
    expect(actionAllowed(port)).toBe(false);
    read.mockResolvedValueOnce({ kind: "empty", watermark: "cut-2", generation: identity.state().context.cutGeneration, snapshotId: 2 });
    await identity.refresh();
    expect(identity.state().readState).toBe("empty");
    expect(actionAllowed(port)).toBe(true);
    // Rebinding the same controller keeps its controller identity and its fences.
    expect(connectivityController(identity, port)).toBe(identity);
  });
});
