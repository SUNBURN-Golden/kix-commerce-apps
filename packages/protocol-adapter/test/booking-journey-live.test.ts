import { type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BookingJourney,
  COMMERCE_COMMAND_BINDINGS,
  HttpProtocolAdapter,
  PINNED_PROTOCOL_DOMAIN,
  type LocalCallInvoker,
} from "../src/index.js";
import type { LocalCallInput } from "../src/local-call.js";
import { assertReviewedCheckout, protocolRoot, REVIEWED_GATE_RUNS, startGate, stopGate } from "./support/reviewed-gate.js";

const describeGate = REVIEWED_GATE_RUNS ? describe.sequential : describe.skip;

const SHOW_POLICY = {
  primaryPrice: 100000,
  resaleCap: 150000,
  primaryFeeBps: 500,
  resaleFeeBps: 300,
  resaleOrganizerBps: 200,
  resaleAllowed: true,
  refundProfile: "FULL_CHAIN_UNWIND_FIXTURE",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function freshId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

describeGate("booking journey against the reviewed gate", () => {
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

  it("composes create_event, prepare_trade, and accept_trade on a fresh event", async () => {
    const seen: LocalCallInput[] = [];
    const http = new HttpProtocolAdapter(baseUrl, async (input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.has("Idempotency-Key")).toBe(false);
      const body = init?.body === undefined ? undefined : JSON.parse(String(init.body)) as LocalCallInput;
      if (body) {
        seen.push(body);
      }
      return fetch(input, init);
    });
    await expect(http.placeHold({ eventId: "show", quantity: 1 })).rejects.toThrow(/not-bound/);
    expect(COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction).toBe("reserve_listing");

    const eventId = freshId("show");
    const tradeId = freshId("trade");
    const journey = new BookingJourney(http);
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
    const inventoryIds = created.receipt.result.inventoryIds;
    expect(Array.isArray(inventoryIds)).toBe(true);

    const prepared = await journey.prepareTrade({
      operationId: freshId("op-prepare"),
      tradeId,
      buyer: "buyer-a",
    });
    expect(prepared.kind).toBe("RECEIPT");
    if (prepared.kind !== "RECEIPT" || !isRecord(prepared.receipt.result)) {
      throw new Error("prepare_trade did not return a receipt");
    }
    expect(prepared.receipt.result.status).toBe("PREPARED");
    expect(prepared.receipt.result.tradeId).toBe(tradeId);

    const accepted = await journey.acceptTrade({ operationId: freshId("op-accept") });
    expect(accepted).toMatchObject({ kind: "RECEIPT", receipt: { result: { accepted: true } } });
    expect(journey.state().completedThrough).toBe("accept_trade");
    expect(journey.state().halted).toBeNull();
    expect(seen.map((call) => call.action)).toEqual(["create_event", "prepare_trade", "accept_trade"]);
    expect(seen[1]?.body).toMatchObject({
      inventoryId: Array.isArray(inventoryIds) ? inventoryIds[0] : undefined,
      amount: SHOW_POLICY.primaryPrice,
      expectedInventoryVersion: 0,
      expectedVersion: 0,
      tradeId,
    });
    expect(seen[1]?.body).not.toHaveProperty("ticketId");
    expect(seen[1]?.body).not.toHaveProperty("listingId");
    expect(seen[1]?.body).not.toHaveProperty("listingHash");
    expect(seen[1]?.body).not.toHaveProperty("expiresAt");
    expect(seen[2]?.body).toEqual({
      domain: PINNED_PROTOCOL_DOMAIN,
      tradeId,
      termsHash: prepared.receipt.result.termsHash,
    });
    expect(seen.some((call) => call.action === "capture" || call.action === "settle_capture")).toBe(false);
  }, 20000);

  it("fences the next write after a pre-commit rejection", async () => {
    const eventId = freshId("show");
    const http = new HttpProtocolAdapter(baseUrl);
    const first = new BookingJourney(http);
    const created = await first.createEvent({
      operationId: freshId("op-create"),
      eventId,
      organizer: "organizer",
      policy: SHOW_POLICY,
      seats: ["A1"],
    });
    expect(created.kind).toBe("RECEIPT");

    let calls = 0;
    const counting = new HttpProtocolAdapter(baseUrl, async (input, init) => {
      calls += 1;
      return fetch(input, init);
    });
    const duplicate = new BookingJourney(counting);
    const rejected = await duplicate.createEvent({
      operationId: freshId("op-dup"),
      eventId,
      organizer: "organizer",
      policy: SHOW_POLICY,
      seats: ["A1"],
    });
    expect(rejected).toMatchObject({ kind: "REJECTED", code: "EVENT_EXISTS" });
    if (rejected.kind !== "REJECTED") {
      return;
    }
    expect(rejected.identity.action).toBe("create_event");
    expect(duplicate.state().halted?.identity).toEqual(rejected.identity);
    const fenced = await duplicate.prepareTrade({
      operationId: freshId("op-prepare"),
      tradeId: freshId("trade"),
      buyer: "buyer-a",
    });
    expect(fenced.kind).toBe("FENCED");
    expect(calls).toBe(1);

    const tradeId = freshId("trade");
    const prepared = await first.prepareTrade({
      operationId: freshId("op-prepare"),
      tradeId,
      buyer: "buyer-a",
    });
    expect(prepared.kind).toBe("RECEIPT");
    await expect(
      http.invokeLocalCall({
        operationId: freshId("op-bad-terms"),
        actor: "buyer-a",
        action: "accept_trade",
        body: { domain: PINNED_PROTOCOL_DOMAIN, tradeId, termsHash: "not-the-prepare-hash" },
      }),
    ).rejects.toMatchObject({ name: "GateRejectedError", code: "TERMS_MISMATCH" });

    let acceptSends = 0;
    const tamper: LocalCallInvoker = {
      async invokeLocalCall(input) {
        if (input.action === "accept_trade" && isRecord(input.body)) {
          acceptSends += 1;
          return http.invokeLocalCall({
            ...input,
            body: { ...input.body, termsHash: "not-the-prepare-hash" },
          });
        }
        return http.invokeLocalCall(input);
      },
    };
    const tampered = new BookingJourney(tamper);
    await tampered.createEvent({
      operationId: freshId("op-create"),
      eventId: freshId("show"),
      organizer: "organizer",
      policy: SHOW_POLICY,
      seats: ["A1"],
    });
    await tampered.prepareTrade({
      operationId: freshId("op-prepare"),
      tradeId: freshId("trade"),
      buyer: "buyer-a",
    });
    const mismatched = await tampered.acceptTrade({ operationId: freshId("op-accept") });
    expect(mismatched).toMatchObject({ kind: "REJECTED", code: "TERMS_MISMATCH" });
    if (mismatched.kind === "REJECTED") {
      expect(mismatched.identity.body.termsHash).not.toBe("not-the-prepare-hash");
    }
    const again = await tampered.acceptTrade({ operationId: freshId("op-accept-2") });
    expect(again.kind).toBe("FENCED");
    expect(acceptSends).toBe(1);
  }, 20000);

  it("treats a discarded success response as unknown and does not send the next step", async () => {
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
    expect(lost.kind).toBe("UNKNOWN");
    if (lost.kind !== "UNKNOWN") {
      return;
    }
    expect(lost.identity.operationId).toBe(operationId);
    expect(sends).toBe(1);
    const fenced = await journey.prepareTrade({
      operationId: freshId("op-prepare"),
      tradeId: freshId("trade"),
      buyer: "buyer-a",
    });
    expect(fenced.kind).toBe("FENCED");
    expect(sends).toBe(1);

    // Test-only oracle. The helper does not replay, retry, or mint a replacement id.
    const oracle = new HttpProtocolAdapter(baseUrl);
    const replayed = await oracle.invokeLocalCall({
      operationId: lost.identity.operationId,
      actor: lost.identity.actor,
      action: lost.identity.action,
      body: lost.identity.body,
    });
    const replayedAgain = await oracle.invokeLocalCall({
      operationId: lost.identity.operationId,
      actor: lost.identity.actor,
      action: lost.identity.action,
      body: lost.identity.body,
    });
    expect(replayedAgain).toEqual(replayed);
    expect(replayed).toMatchObject({
      operationId,
      action: "create_event",
      result: { eventId },
    });
  }, 20000);
});
