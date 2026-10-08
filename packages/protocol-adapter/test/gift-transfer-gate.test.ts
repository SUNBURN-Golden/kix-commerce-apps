import { type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CONTRACT_ONLY_LOCAL_CALL_METHOD,
  CONTRACT_ONLY_LOCAL_CALL_PATH,
  GiftTransfer,
  HttpProtocolAdapter,
  PINNED_PROTOCOL_DOMAIN,
  type GiftOfferInput,
  type LocalCallInvoker,
} from "../src/index.js";
import type { LocalCallInput } from "../src/local-call.js";
import { SHOW_POLICY } from "./support/journey-fixture.js";
import { assertReviewedCheckout, protocolRoot, REVIEWED_GATE_RUNS, startGate, stopGate } from "./support/reviewed-gate.js";

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

/**
 * Test-side setup only. GiftTransfer does not send create_event or issue_invitation.
 * issue_invitation is the reviewed way to hold an ACTIVE right without capture or commit_trade.
 */
async function holdRight(http: HttpProtocolAdapter, donor: string): Promise<{ ticketId: string; expectedVersion: number }> {
  const created = await http.invokeLocalCall({
    operationId: freshId("op-create"),
    actor: "operator",
    action: "create_event",
    body: {
      domain: PINNED_PROTOCOL_DOMAIN,
      eventId: freshId("show"),
      organizer: "organizer",
      policy: SHOW_POLICY,
      seats: ["A1"],
      invitationQuota: 1,
    },
  });
  if (!isRecord(created) || !isRecord(created.result) || !Array.isArray(created.result.inventoryIds)) {
    throw new Error("create_event did not return inventoryIds");
  }
  const inventoryId = created.result.inventoryIds[0];
  if (typeof inventoryId !== "string" || inventoryId.length === 0) {
    throw new Error("create_event did not return an inventory id");
  }
  const issued = await http.invokeLocalCall({
    operationId: freshId("op-invite"),
    actor: "organizer",
    action: "issue_invitation",
    body: {
      domain: PINNED_PROTOCOL_DOMAIN,
      inventoryId,
      expectedInventoryVersion: 0,
      recipient: donor,
    },
  });
  if (!isRecord(issued) || !isRecord(issued.result) || typeof issued.result.ticketId !== "string") {
    throw new Error("issue_invitation did not return a ticketId");
  }
  expect(issued.result.financialEntries).toBe(0);
  return { ticketId: issued.result.ticketId, expectedVersion: 1 };
}

function offerInput(ticketId: string, donor: string, recipient: string): GiftOfferInput {
  return {
    operationId: freshId("op-offer"),
    giftId: freshId("gift"),
    donor,
    recipient,
    ticketId,
    expectedVersion: 1,
    expiresAt: 600,
  };
}

describeGate("gift transfer live gate", () => {
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

  it("offers then accepts and keeps financialEntries at 0", async () => {
    const seen: LocalCallInput[] = [];
    const http = watchLocalCalls(baseUrl, seen);
    const donor = freshId("donor");
    const recipient = freshId("recipient");
    const held = await holdRight(http, donor);
    const transfer = new GiftTransfer(http);
    const input = offerInput(held.ticketId, donor, recipient);
    input.expectedVersion = held.expectedVersion;
    const offered = await transfer.offerGift(input);
    expect(offered).toMatchObject({ kind: "RECEIPT", step: "offer_gift" });
    if (offered.kind !== "RECEIPT" || !isRecord(offered.receipt.result)) {
      throw new Error("offer_gift did not return a receipt");
    }
    expect(Object.keys(offered.receipt.result).sort()).toEqual(["giftId", "termsHash"]);
    expect(offered.receipt.result.giftId).toBe(input.giftId);
    expect(typeof offered.receipt.result.termsHash).toBe("string");
    const accepted = await transfer.acceptGift({ operationId: freshId("op-accept") });
    expect(accepted).toMatchObject({ kind: "RECEIPT", step: "accept_gift" });
    if (accepted.kind !== "RECEIPT" || !isRecord(accepted.receipt.result)) {
      throw new Error("accept_gift did not return a receipt");
    }
    expect(accepted.receipt.result).toMatchObject({
      ticketId: held.ticketId,
      owner: recipient,
      financialEntries: 0,
    });
    expect(Number.isInteger(accepted.receipt.result.rightsVersion)).toBe(true);
    expect(Object.keys(accepted.receipt.result).sort()).toEqual([
      "financialEntries",
      "owner",
      "rightsVersion",
      "ticketId",
    ]);
    expect(transfer.state()).toMatchObject({ offered: true, resolvedBy: "accept_gift", halted: null });
    expect(seen.some((call) => call.action === "capture" || call.action === "settle_capture")).toBe(false);
    expect(seen.every((call) => call.action !== "issue_invitation" || call.actor === "organizer")).toBe(true);
  }, 20000);

  it("offers then cancels", async () => {
    const seen: LocalCallInput[] = [];
    const http = watchLocalCalls(baseUrl, seen);
    const donor = freshId("donor");
    const held = await holdRight(http, donor);
    const transfer = new GiftTransfer(http);
    const offered = await transfer.offerGift(offerInput(held.ticketId, donor, freshId("recipient")));
    expect(offered.kind).toBe("RECEIPT");
    const cancelled = await transfer.cancelGift({ operationId: freshId("op-cancel") });
    expect(cancelled).toMatchObject({
      kind: "RECEIPT",
      step: "cancel_gift",
      receipt: { result: { giftState: "CANCELLED" } },
    });
    expect(transfer.state().resolvedBy).toBe("cancel_gift");
    const again = await transfer.acceptGift({ operationId: freshId("op-accept") });
    expect(again.kind).toBe("FENCED");
    expect(seen.some((call) => call.action === "capture" || call.action === "settle_capture")).toBe(false);
  }, 20000);

  it("rejects accept_gift from the wrong actor", async () => {
    const seen: LocalCallInput[] = [];
    const http = watchLocalCalls(baseUrl, seen);
    const donor = freshId("donor");
    const recipient = freshId("recipient");
    const held = await holdRight(http, donor);
    const tamper: LocalCallInvoker = {
      async invokeLocalCall(input) {
        if (input.action === "accept_gift") {
          return http.invokeLocalCall({ ...input, actor: freshId("other") });
        }
        return http.invokeLocalCall(input);
      },
    };
    const transfer = new GiftTransfer(tamper);
    const offered = await transfer.offerGift(offerInput(held.ticketId, donor, recipient));
    expect(offered.kind).toBe("RECEIPT");
    const rejected = await transfer.acceptGift({ operationId: freshId("op-accept") });
    expect(rejected).toMatchObject({ kind: "REJECTED", code: "UNAUTHORIZED_FIXTURE_ACTOR" });
    if (rejected.kind === "REJECTED") {
      expect(rejected.identity.actor).toBe(recipient);
    }
    const fenced = await transfer.cancelGift({ operationId: freshId("op-cancel") });
    expect(fenced.kind).toBe("FENCED");
  }, 20000);

  it("rejects an offer for a ticket that was not issued", async () => {
    const seen: LocalCallInput[] = [];
    const http = watchLocalCalls(baseUrl, seen);
    const transfer = new GiftTransfer(http);
    const rejected = await transfer.offerGift({
      operationId: freshId("op-offer"),
      giftId: freshId("gift"),
      donor: freshId("donor"),
      recipient: freshId("recipient"),
      ticketId: freshId("missing-ticket"),
      expectedVersion: 1,
      expiresAt: 600,
    });
    expect(rejected).toMatchObject({ kind: "REJECTED", code: "TICKET_NOT_FOUND" });
    const fenced = await transfer.cancelGift({ operationId: freshId("op-cancel") });
    expect(fenced.kind).toBe("FENCED");
    expect(seen.map((call) => call.action)).toEqual(["offer_gift"]);
  }, 20000);

  it("rejects accept on a fresh helper after a test-side cancel", async () => {
    // The cancel is a raw local call, like advance_clock in the journey suite.
    // GiftTransfer does not send it. The fresh helper still holds its offer
    // receipt, so it does send accept_gift, and the gate refuses the cancelled gift.
    const http = watchLocalCalls(baseUrl, []);
    const donor = freshId("donor");
    const recipient = freshId("recipient");
    const held = await holdRight(http, donor);
    const transfer = new GiftTransfer(http);
    const input = offerInput(held.ticketId, donor, recipient);
    const offered = await transfer.offerGift(input);
    expect(offered.kind).toBe("RECEIPT");
    if (offered.kind !== "RECEIPT" || !isRecord(offered.receipt.result)) {
      throw new Error("offer_gift did not return a receipt");
    }
    await http.invokeLocalCall({
      operationId: freshId("op-cancel-raw"),
      actor: donor,
      action: "cancel_gift",
      body: { domain: PINNED_PROTOCOL_DOMAIN, giftId: input.giftId },
    });
    const accepted = await transfer.acceptGift({ operationId: freshId("op-accept") });
    expect(accepted).toMatchObject({ kind: "REJECTED", code: "GIFT_NOT_ACCEPTABLE" });
    const fenced = await transfer.cancelGift({ operationId: freshId("op-cancel") });
    expect(fenced.kind).toBe("FENCED");
  }, 20000);

  it("rejects cancel on a fresh helper after a test-side accept", async () => {
    const http = watchLocalCalls(baseUrl, []);
    const donor = freshId("donor");
    const recipient = freshId("recipient");
    const held = await holdRight(http, donor);
    const transfer = new GiftTransfer(http);
    const input = offerInput(held.ticketId, donor, recipient);
    const offered = await transfer.offerGift(input);
    expect(offered.kind).toBe("RECEIPT");
    if (offered.kind !== "RECEIPT" || !isRecord(offered.receipt.result) || typeof offered.receipt.result.termsHash !== "string") {
      throw new Error("offer_gift did not return termsHash");
    }
    await http.invokeLocalCall({
      operationId: freshId("op-accept-raw"),
      actor: recipient,
      action: "accept_gift",
      body: {
        domain: PINNED_PROTOCOL_DOMAIN,
        giftId: input.giftId,
        termsHash: offered.receipt.result.termsHash,
      },
    });
    const cancelled = await transfer.cancelGift({ operationId: freshId("op-cancel") });
    expect(cancelled).toMatchObject({ kind: "REJECTED", code: "GIFT_NOT_CANCELLABLE" });
    const fenced = await transfer.acceptGift({ operationId: freshId("op-accept") });
    expect(fenced.kind).toBe("FENCED");
  }, 20000);

  it("fences the next write after a discarded offer response", async () => {
    const donor = freshId("donor");
    const heldHttp = watchLocalCalls(baseUrl, []);
    const held = await holdRight(heldHttp, donor);
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
    const transfer = new GiftTransfer(discarding);
    const lost = await transfer.offerGift(offerInput(held.ticketId, donor, freshId("recipient")));
    expect(lost).toMatchObject({ kind: "UNKNOWN" });
    expect(transfer.state()).toMatchObject({ offered: false, halted: { kind: "UNKNOWN" } });
    const stayed = await transfer.cancelGift({ operationId: freshId("op-cancel") });
    expect(stayed.kind).toBe("FENCED");
    expect(sends).toBe(1);
  }, 20000);
});
