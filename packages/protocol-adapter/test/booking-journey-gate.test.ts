import { type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BookingJourney,
  CONTRACT_ONLY_LOCAL_CALL_METHOD,
  CONTRACT_ONLY_LOCAL_CALL_PATH,
  HttpProtocolAdapter,
  JOURNEY_COMPOSED,
  PINNED_PROTOCOL_DOMAIN,
  type JourneyStepOutcome,
  type LocalCallInvoker,
} from "../src/index.js";
import type { LocalCallInput } from "../src/local-call.js";
import { assertReviewedCheckout, protocolRoot, REVIEWED_GATE_RUNS, startGate, stopGate } from "./support/reviewed-gate.js";
import {
  EXPECTED_STEP_REPORT,
  JOURNEY_BUYER,
  SHOW_POLICY,
  journeyStepReport,
  runComposedJourney,
  stubJourneyInvoker,
} from "./support/journey-fixture.js";

const describeGate = REVIEWED_GATE_RUNS ? describe.sequential : describe.skip;

function freshId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function watchLocalCalls(baseUrl: string, seen: LocalCallInput[]): HttpProtocolAdapter {
  return new HttpProtocolAdapter(baseUrl, async (input, init) => {
    const headers = new Headers(init?.headers);
    expect(headers.has("Idempotency-Key")).toBe(false);
    expect(init?.method).toBe(CONTRACT_ONLY_LOCAL_CALL_METHOD);
    const url = new URL(String(input));
    expect(url.protocol).toBe("http:");
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.pathname).toBe(CONTRACT_ONLY_LOCAL_CALL_PATH);
    if (typeof init?.body !== "string") {
      throw new Error("local-call body was not a string");
    }
    seen.push(JSON.parse(init.body) as LocalCallInput);
    return fetch(input, init);
  });
}

describeGate("booking journey live gate parity", () => {
  let baseUrl = "";
  let child: ChildProcess | undefined;

  beforeAll(async () => {
    const root = protocolRoot();
    assertReviewedCheckout(root);
    const started = await startGate(root);
    baseUrl = started.baseUrl;
    child = started.child;
  }, 20000);

  afterAll(async () => {
    await stopGate(child);
  });

  it("matches the stub step report on the live gate", async () => {
    const stubSeen: LocalCallInput[] = [];
    const stubJourney = new BookingJourney(stubJourneyInvoker(stubSeen));
    const stubOutcomes = await runComposedJourney(stubJourney, {
      eventId: "show-1",
      tradeId: "trade-1",
      createOperationId: "op-create",
      prepareOperationId: "op-prepare",
      acceptOperationId: "op-accept",
    });
    const stubReport = journeyStepReport(stubSeen, stubOutcomes);

    const seen: LocalCallInput[] = [];
    const http = watchLocalCalls(baseUrl, seen);
    expect(http.describe()).toMatchObject({
      liveChain: false,
      fundsMovement: "none",
      publicDeploy: false,
      productionConformance: false,
      protocolTruth: false,
    });
    const journey = new BookingJourney(http);
    const outcomes = await runComposedJourney(journey, {
      eventId: freshId("show"),
      tradeId: freshId("trade"),
      createOperationId: freshId("op-create"),
      prepareOperationId: freshId("op-prepare"),
      acceptOperationId: freshId("op-accept"),
    });
    const liveReport = journeyStepReport(seen, outcomes);
    expect(liveReport).toEqual(EXPECTED_STEP_REPORT);
    expect(liveReport).toEqual(stubReport);
    expect(seen.map((call) => call.action)).toEqual([...JOURNEY_COMPOSED]);
    expect(seen).toHaveLength(3);
    const accepted = outcomes[2];
    expect(accepted).toMatchObject({ kind: "RECEIPT", step: "accept_trade" });
    if (accepted?.kind === "RECEIPT") {
      expect(accepted.receipt.result).toEqual({ accepted: true });
    }
    expect(journey.state()).toMatchObject({ completedThrough: "accept_trade", halted: null });
    expect(seen.some((call) => call.action === "capture" || call.action === "settle_capture")).toBe(false);
  }, 20000);

  it("does not send prepare_trade when seatIndex is outside the created inventory", async () => {
    const seen: LocalCallInput[] = [];
    const journey = new BookingJourney(watchLocalCalls(baseUrl, seen));
    const created = await journey.createEvent({
      operationId: freshId("op-create"),
      eventId: freshId("show"),
      organizer: "organizer",
      policy: SHOW_POLICY,
      seats: ["A1"],
    });
    expect(created.kind).toBe("RECEIPT");
    const before = seen.length;
    await expect(
      journey.prepareTrade({
        operationId: freshId("op-prepare"),
        tradeId: freshId("trade"),
        buyer: JOURNEY_BUYER,
        seatIndex: 1,
      }),
    ).rejects.toThrow(/seatIndex/);
    expect(journey.state().halted).toMatchObject({ kind: "NOT_SENT", step: "prepare_trade" });
    expect(seen).toHaveLength(before);
    const fenced = await journey.acceptTrade({ operationId: freshId("op-accept") });
    expect(fenced.kind).toBe("FENCED");
    expect(seen).toHaveLength(before);
    expect(seen.map((call) => call.action)).toEqual(["create_event"]);
  }, 20000);

  it("fences the next write after the gate rejects an unknown inventory id", async () => {
    const seen: LocalCallInput[] = [];
    const http = watchLocalCalls(baseUrl, seen);
    const tamper: LocalCallInvoker = {
      async invokeLocalCall(input) {
        if (input.action === "prepare_trade" && isRecord(input.body)) {
          return http.invokeLocalCall({
            ...input,
            body: { ...input.body, inventoryId: "missing-inventory" },
          });
        }
        return http.invokeLocalCall(input);
      },
    };
    const journey = new BookingJourney(tamper);
    const created = await journey.createEvent({
      operationId: freshId("op-create"),
      eventId: freshId("show"),
      organizer: "organizer",
      policy: SHOW_POLICY,
      seats: ["A1"],
    });
    expect(created.kind).toBe("RECEIPT");
    const rejected = await journey.prepareTrade({
      operationId: freshId("op-prepare"),
      tradeId: freshId("trade"),
      buyer: JOURNEY_BUYER,
    });
    expect(rejected).toMatchObject({ kind: "REJECTED", code: "INVENTORY_NOT_FOUND" });
    if (rejected.kind === "REJECTED") {
      expect(rejected.identity.body.inventoryId).not.toBe("missing-inventory");
    }
    expect(journey.state().halted?.kind).toBe("REJECTED");
    const fenced = await journey.acceptTrade({ operationId: freshId("op-accept") });
    expect(fenced.kind).toBe("FENCED");
    expect(seen.map((call) => call.action)).toEqual(["create_event", "prepare_trade"]);
  }, 20000);

  it("keeps a refreshed journey incomplete after a discarded create_event", async () => {
    const eventId = freshId("show");
    const operationId = freshId("op-create");
    let sends = 0;
    const discarding = new HttpProtocolAdapter(baseUrl, async (input, init) => {
      sends += 1;
      const response = await fetch(input, init);
      const headers = new Headers();
      for (const name of [
        "content-type",
        "x-kix-transport",
        "x-kix-production-endpoint",
        "x-kix-protocol-truth",
        "x-kix-production-conformance",
        "x-request-id",
        "x-correlation-id",
      ]) {
        const value = response.headers.get(name);
        if (value !== null) {
          headers.set(name, value);
        }
      }
      await response.body?.cancel();
      return new Response("", { status: response.status, headers });
    });
    const journey = new BookingJourney(discarding);
    const lost = await journey.createEvent({
      operationId,
      eventId,
      organizer: "organizer",
      policy: SHOW_POLICY,
      seats: ["A1"],
    });
    expect(lost).toMatchObject({ kind: "UNKNOWN" });
    expect(journey.state()).toMatchObject({ completedThrough: "none", halted: { kind: "UNKNOWN" } });
    if (lost.kind === "UNKNOWN") {
      expect(lost.identity.operationId).toBe(operationId);
    }
    const stayed = await journey.prepareTrade({
      operationId: freshId("op-prepare"),
      tradeId: freshId("trade"),
      buyer: JOURNEY_BUYER,
    });
    expect(stayed.kind).toBe("FENCED");
    expect(sends).toBe(1);

    let refreshSends = 0;
    const refreshed = new BookingJourney(
      new HttpProtocolAdapter(baseUrl, async (input, init) => {
        refreshSends += 1;
        return fetch(input, init);
      }),
    );
    expect(refreshed.state().completedThrough).toBe("none");
    const outOfOrder = await refreshed.prepareTrade({
      operationId: freshId("op-prepare"),
      tradeId: freshId("trade"),
      buyer: JOURNEY_BUYER,
    });
    expect(outOfOrder).toMatchObject({ kind: "FENCED", blockedBy: { reason: "out-of-order" } });
    expect(refreshSends).toBe(0);

    const retryId = freshId("op-create");
    const rejected = await refreshed.createEvent({
      operationId: retryId,
      eventId,
      organizer: "organizer",
      policy: SHOW_POLICY,
      seats: ["A1"],
    });
    expect(rejected).toMatchObject({ kind: "REJECTED", code: "EVENT_EXISTS" });
    expect(retryId).not.toBe(operationId);
    expect(refreshed.state()).toMatchObject({ completedThrough: "none", halted: { kind: "REJECTED" } });
    expect(refreshSends).toBe(1);
  }, 20000);

  it("rejects accept_trade once the dedicated gate clock reaches expiry", async () => {
    // Own process. advance_clock is monotonic for the whole gate, so this
    // test does not share the process used above.
    // reference/v0.3-rc1/core.py starts clock at 0.
    // prepare_trade omits expiresAt, so lifecycle.py sets expiresAt to
    // clock + reservationSeconds. accept_trade rejects TRADE_NOT_ACCEPTABLE
    // when clock >= expiresAt. advance_clock is a test-only raw call.
    // BookingJourney does not send it.
    const root = protocolRoot();
    assertReviewedCheckout(root);
    const started = await startGate(root);
    try {
      const seen: LocalCallInput[] = [];
      const http = watchLocalCalls(started.baseUrl, seen);
      const journey = new BookingJourney(http);
      const eventId = freshId("show");
      const tradeId = freshId("trade");
      const created = await journey.createEvent({
        operationId: freshId("op-create"),
        eventId,
        organizer: "organizer",
        policy: SHOW_POLICY,
        seats: ["A1"],
      });
      expect(created.kind).toBe("RECEIPT");
      if (created.kind !== "RECEIPT" || !isRecord(created.receipt.result)) {
        throw new Error("create_event did not return a receipt");
      }
      const reservationSeconds = created.receipt.result.reservationSeconds;
      if (typeof reservationSeconds !== "number" || !Number.isInteger(reservationSeconds) || reservationSeconds < 1) {
        throw new Error("create_event did not return reservationSeconds");
      }
      const prepared = await journey.prepareTrade({
        operationId: freshId("op-prepare"),
        tradeId,
        buyer: JOURNEY_BUYER,
      });
      expect(prepared).toMatchObject({ kind: "RECEIPT", receipt: { result: { status: "PREPARED" } } });

      const clock = await http.invokeLocalCall({
        operationId: freshId("op-clock"),
        actor: "operator",
        action: "advance_clock",
        body: { domain: PINNED_PROTOCOL_DOMAIN, now: reservationSeconds },
      });
      expect(clock).toMatchObject({ action: "advance_clock", result: { logicalTime: reservationSeconds } });

      const expired: JourneyStepOutcome = await journey.acceptTrade({ operationId: freshId("op-accept") });
      expect(expired).toMatchObject({ kind: "REJECTED", code: "TRADE_NOT_ACCEPTABLE" });
      expect(journey.state().halted?.kind).toBe("REJECTED");
      const again = await journey.acceptTrade({ operationId: freshId("op-accept-2") });
      expect(again.kind).toBe("FENCED");
      expect(seen.map((call) => call.action)).toEqual([
        "create_event",
        "prepare_trade",
        "advance_clock",
        "accept_trade",
      ]);
    } finally {
      await stopGate(started.child);
    }
  }, 20000);
});
