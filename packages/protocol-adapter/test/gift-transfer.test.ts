import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  COMMERCE_METHODS,
  GIFT_COMPOSED,
  GIFT_DESK_NOT_BOUND,
  GIFT_NOT_COMPOSED,
  GiftTransfer,
  HttpProtocolAdapter,
  JOURNEY_RULING,
  PINNED_PROTOCOL_DOMAIN,
  ProtocolError,
  createStubGiftInvoker,
  echoIntegrationGateHeaders,
  type GiftOfferInput,
  type GiftStepOutcome,
  type LocalCallInvoker,
} from "../src/index.js";
import type { LocalCallInput } from "../src/local-call.js";
import { pinnedCommandSchemas } from "../src/openapi-contract-pin.js";
import { localCallReceipt } from "./support/receipt.js";

const OFFER: GiftOfferInput = {
  operationId: "op-offer",
  giftId: "gift-1",
  donor: "donor-a",
  recipient: "recipient-b",
  ticketId: "ticket-9",
  expectedVersion: 1,
  expiresAt: 600,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordingStub(seen: LocalCallInput[] = []): LocalCallInvoker {
  const stub = createStubGiftInvoker();
  return {
    async invokeLocalCall(input) {
      seen.push(structuredClone(input));
      return stub.invokeLocalCall(input);
    },
  };
}

function requiredKeys(action: string): string[] {
  const schema = pinnedCommandSchemas()[action];
  if (!isRecord(schema) || !Array.isArray(schema.required)) {
    throw new Error(`missing schema for ${action}`);
  }
  return schema.required.filter((key): key is string => typeof key === "string").sort();
}

async function offerAccept(transfer: GiftTransfer): Promise<GiftStepOutcome[]> {
  const offered = await transfer.offerGift(OFFER);
  const accepted = await transfer.acceptGift({ operationId: "op-accept" });
  return [offered, accepted];
}

describe("gift transfer composition", () => {
  it("records the ruling and the commands it does not send", () => {
    expect(JOURNEY_RULING).toBe("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
    expect(GIFT_COMPOSED).toEqual(["offer_gift", "accept_gift", "cancel_gift"]);
    expect(GIFT_NOT_COMPOSED.map((entry) => entry.action)).toEqual([
      "capture",
      "settle_capture",
      "commit_trade",
      "issue_invitation",
    ]);
    expect(GIFT_NOT_COMPOSED.every((entry) => entry.reason.includes(JOURNEY_RULING))).toBe(true);
    expect(GIFT_DESK_NOT_BOUND.map((entry) => entry.method)).toEqual([
      "offerCredit",
      "acceptResale",
      "cancelResaleListing",
    ]);
    expect(GIFT_DESK_NOT_BOUND[0]).toEqual({
      method: "offerCredit",
      consideredAction: null,
      reason: COMMERCE_COMMAND_BINDINGS.offerCredit.reason,
    });
    expect(COMMERCE_COMMAND_BINDINGS.offerCredit.status).toBe("not-bound");
    expect(COMMERCE_METHODS).not.toContain("offerGift");
    expect(COMMERCE_METHODS).not.toContain("acceptGift");
    expect(COMMERCE_METHODS).not.toContain("cancelGift");
    const names = Object.getOwnPropertyNames(GiftTransfer.prototype);
    for (const banned of ["capture", "settleCapture", "commitTrade", "issueInvitation", "offerCredit", "placeHold"]) {
      expect(names).not.toContain(banned);
    }
  });

  it("offers then accepts with pinned body keys and one call per step", async () => {
    const seen: LocalCallInput[] = [];
    const transfer = new GiftTransfer(recordingStub(seen));
    const [offered, accepted] = await offerAccept(transfer);
    expect(offered).toMatchObject({
      kind: "RECEIPT",
      step: "offer_gift",
      receipt: { result: { giftId: "gift-1", termsHash: "terms-hash" } },
    });
    expect(accepted).toMatchObject({
      kind: "RECEIPT",
      step: "accept_gift",
      receipt: {
        result: { ticketId: "ticket-9", owner: "recipient-b", rightsVersion: 1, financialEntries: 0 },
      },
    });
    expect(seen.map((call) => call.action)).toEqual(["offer_gift", "accept_gift"]);
    expect(seen.map((call) => call.operationId)).toEqual(["op-offer", "op-accept"]);
    expect(seen[0]).toMatchObject({ actor: "donor-a" });
    expect(seen[1]).toMatchObject({ actor: "recipient-b" });
    expect(Object.keys(seen[0]?.body ?? {}).sort()).toEqual(requiredKeys("offer_gift"));
    expect(Object.keys(seen[1]?.body ?? {}).sort()).toEqual(requiredKeys("accept_gift"));
    expect(seen[0]?.body).toEqual({
      domain: PINNED_PROTOCOL_DOMAIN,
      giftId: "gift-1",
      ticketId: "ticket-9",
      expectedVersion: 1,
      recipient: "recipient-b",
      expiresAt: 600,
    });
    expect(seen[1]?.body).toEqual({
      domain: PINNED_PROTOCOL_DOMAIN,
      giftId: "gift-1",
      termsHash: "terms-hash",
    });
    expect(seen.some((call) => call.action === "capture" || call.action === "settle_capture")).toBe(false);
    expect(transfer.state()).toMatchObject({ offered: true, resolvedBy: "accept_gift", halted: null });
    const again = await transfer.cancelGift({ operationId: "op-cancel" });
    expect(again).toMatchObject({ kind: "FENCED", blockedBy: { reason: "already-sent" } });
    expect(seen).toHaveLength(2);
  });

  it("offers then cancels and fences a second offer", async () => {
    const seen: LocalCallInput[] = [];
    const transfer = new GiftTransfer(recordingStub(seen));
    const offered = await transfer.offerGift({ ...OFFER, operationId: "op-offer-c" });
    const cancelled = await transfer.cancelGift({ operationId: "op-cancel" });
    expect(offered.kind).toBe("RECEIPT");
    expect(cancelled).toMatchObject({
      kind: "RECEIPT",
      step: "cancel_gift",
      receipt: { result: { giftState: "CANCELLED" } },
    });
    expect(Object.keys(seen[1]?.body ?? {}).sort()).toEqual(requiredKeys("cancel_gift"));
    expect(seen[1]?.body).toEqual({ domain: PINNED_PROTOCOL_DOMAIN, giftId: "gift-1" });
    expect(seen[1]).toMatchObject({ actor: "donor-a" });
    expect(transfer.state().resolvedBy).toBe("cancel_gift");
    const accept = await transfer.acceptGift({ operationId: "op-accept" });
    expect(accept).toMatchObject({ kind: "FENCED", blockedBy: { reason: "already-sent" } });
    const second = await transfer.offerGift({ ...OFFER, operationId: "op-offer-2" });
    expect(second).toMatchObject({ kind: "FENCED", blockedBy: { reason: "already-sent" } });
    expect(seen).toHaveLength(2);
    expect(seen.some((call) => call.action === "capture" || call.action === "settle_capture")).toBe(false);
  });

  it("fences accept and cancel before an offer, and a call that is in flight", async () => {
    const seen: LocalCallInput[] = [];
    const early = new GiftTransfer(recordingStub(seen));
    const outOfOrder = await early.acceptGift({ operationId: "op-early" });
    expect(outOfOrder).toMatchObject({ kind: "FENCED", step: "accept_gift", blockedBy: { reason: "out-of-order" } });
    const cancelEarly = await early.cancelGift({ operationId: "op-early-cancel" });
    expect(cancelEarly).toMatchObject({ kind: "FENCED", blockedBy: { reason: "out-of-order" } });
    expect(seen).toHaveLength(0);

    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const slow: LocalCallInvoker = {
      async invokeLocalCall(input) {
        calls += 1;
        await gate;
        return recordingStub().invokeLocalCall(input);
      },
    };
    const concurrent = new GiftTransfer(slow);
    const first = concurrent.offerGift(OFFER);
    const second = await concurrent.offerGift({ ...OFFER, operationId: "op-offer-2" });
    expect(second).toMatchObject({ kind: "FENCED", blockedBy: { reason: "in-flight" } });
    expect(calls).toBe(1);
    if (release === undefined) {
      throw new Error("missing release");
    }
    release();
    await expect(first).resolves.toMatchObject({ kind: "RECEIPT" });
    expect(calls).toBe(1);
  });

  it("treats an unknown offer as a halt and does not send cancel_gift", async () => {
    const seen: LocalCallInput[] = [];
    const transfer = new GiftTransfer({
      async invokeLocalCall(input) {
        seen.push(structuredClone(input));
        throw new ProtocolError("timed out", "REQUEST_TIMEOUT", {
          requestId: "req-timeout",
          correlationId: "corr-timeout",
        });
      },
    });
    const unknown = await transfer.offerGift(OFFER);
    expect(unknown).toMatchObject({
      kind: "UNKNOWN",
      step: "offer_gift",
      code: "REQUEST_TIMEOUT",
      identity: { operationId: "op-offer", requestId: "req-timeout", correlationId: "corr-timeout" },
    });
    const cancel = await transfer.cancelGift({ operationId: "op-cancel" });
    expect(cancel).toMatchObject({ kind: "FENCED", step: "cancel_gift", blockedBy: { reason: "halted" } });
    const accept = await transfer.acceptGift({ operationId: "op-accept" });
    expect(accept).toMatchObject({ kind: "FENCED", blockedBy: { reason: "halted" } });
    expect(seen.map((call) => call.action)).toEqual(["offer_gift"]);
  });

  it("halts on a pre-send failure and does not call the invoker", async () => {
    const seen: LocalCallInput[] = [];
    const transfer = new GiftTransfer(recordingStub(seen));
    await expect(transfer.offerGift({ ...OFFER, expiresAt: Number.NaN })).rejects.toThrow(/integer/);
    expect(seen).toHaveLength(0);
    expect(transfer.state().halted).toMatchObject({ kind: "NOT_SENT", step: "offer_gift" });
    const cancel = await transfer.cancelGift({ operationId: "op-cancel" });
    expect(cancel).toMatchObject({ kind: "FENCED", blockedBy: { reason: "halted" } });
    expect(seen).toHaveLength(0);
  });

  it("records an invalid accept receipt as unknown and fences the next write", async () => {
    const seen: LocalCallInput[] = [];
    const stub = createStubGiftInvoker();
    const transfer = new GiftTransfer({
      async invokeLocalCall(input) {
        seen.push(structuredClone(input));
        const receipt = await stub.invokeLocalCall(input);
        if (input.action === "accept_gift" && isRecord(receipt) && isRecord(receipt.result)) {
          return { ...receipt, result: { ...receipt.result, extra: true } };
        }
        return receipt;
      },
    });
    expect((await transfer.offerGift(OFFER)).kind).toBe("RECEIPT");
    const accepted = await transfer.acceptGift({ operationId: "op-accept" });
    expect(accepted).toMatchObject({ kind: "UNKNOWN", code: "INVALID_RECEIPT" });
    const cancel = await transfer.cancelGift({ operationId: "op-cancel" });
    expect(cancel.kind).toBe("FENCED");
    expect(seen.map((call) => call.action)).toEqual(["offer_gift", "accept_gift"]);
  });
});

describe("gift receipts and credit", () => {
  const domain = PINNED_PROTOCOL_DOMAIN;
  const accepted: Array<[string, string, Record<string, unknown>, Record<string, unknown>]> = [
    [
      "offer_gift",
      "donor-a",
      {
        domain,
        giftId: "gift-1",
        ticketId: "ticket-9",
        expectedVersion: 1,
        recipient: "recipient-b",
        expiresAt: 600,
      },
      { giftId: "gift-1", termsHash: "terms-hash" },
    ],
    [
      "accept_gift",
      "recipient-b",
      { domain, giftId: "gift-1", termsHash: "terms-hash" },
      { ticketId: "ticket-9", owner: "recipient-b", rightsVersion: 2, financialEntries: 0 },
    ],
    ["cancel_gift", "donor-a", { domain, giftId: "gift-1" }, { giftState: "CANCELLED" }],
  ];

  it.each(accepted)("accepts a %s success receipt", async (action, actor, body, result) => {
    const adapter = new HttpProtocolAdapter(
      "http://127.0.0.1:8765",
      async (_input, init) =>
        new Response(JSON.stringify(localCallReceipt("op-guard", action, result)), {
          status: 200,
          headers: echoIntegrationGateHeaders(init),
        }),
    );
    await expect(adapter.invokeLocalCall({ operationId: "op-guard", actor, action, body })).resolves.toMatchObject({
      action,
      result,
    });
  });

  it("still rejects a gift receipt that carries disburseCredit", async () => {
    const adapter = new HttpProtocolAdapter(
      "http://127.0.0.1:8765",
      async (_input, init) =>
        new Response(
          JSON.stringify(
            localCallReceipt("op-guard", "accept_gift", {
              ticketId: "ticket-9",
              owner: "recipient-b",
              rightsVersion: 2,
              financialEntries: 0,
              disburseCredit: true,
            }),
          ),
          { status: 200, headers: echoIntegrationGateHeaders(init) },
        ),
    );
    await expect(
      adapter.invokeLocalCall({
        operationId: "op-guard",
        actor: "recipient-b",
        action: "accept_gift",
        body: { domain, giftId: "gift-1", termsHash: "terms-hash" },
      }),
    ).rejects.toThrow(/does not disburse credit/);
  });

  it("leaves offerCredit not-bound and sends no request", async () => {
    let calls = 0;
    const http = new HttpProtocolAdapter("http://127.0.0.1:9", async () => {
      calls += 1;
      throw new Error("sent");
    });
    await expect(
      http.offerCredit({
        advanceId: "adv",
        claimId: "claim",
        openFace: 1,
        amount: 1,
        beneficiaryRole: "buyer",
        idempotencyKey: "offer-http",
        product: null,
      }),
    ).rejects.toThrow(/not-bound/);
    expect(calls).toBe(0);
    expect(COMMERCE_COMMAND_BINDINGS.offerCredit.consideredAction).toBeNull();
  });
});
