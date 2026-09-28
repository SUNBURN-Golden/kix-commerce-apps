import { describe, expect, it } from "vitest";
import { HttpProtocolAdapter, PINNED_PROTOCOL_DOMAIN, echoIntegrationGateHeaders } from "../src/index.js";
import { localCallReceipt } from "./support/receipt.js";

const OBSERVE_RECOVERY = {
  domain: PINNED_PROTOCOL_DOMAIN,
  allocationId: null,
  amount: 1,
  currency: "KRW",
  movementId: "move-1",
  payer: "payer-1",
  provenance: "fixture",
  scope: {},
  tradeId: "trade-1",
};

function recording(): { adapter: HttpProtocolAdapter; sent: unknown[] } {
  const sent: unknown[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    const envelope = JSON.parse(String(init?.body)) as { operationId: string; action: string };
    sent.push(envelope);
    return new Response(JSON.stringify(localCallReceipt(envelope.operationId, envelope.action, {})), {
      status: 200,
      headers: echoIntegrationGateHeaders(init),
    });
  };
  return { adapter: new HttpProtocolAdapter("http://127.0.0.1:8765", fetchImpl), sent };
}

describe("local-call schema check", () => {
  it("accepts null and a string for a pinned string-or-null field", async () => {
    const { adapter, sent } = recording();
    await adapter.invokeLocalCall({ operationId: "op-rec-null", actor: "fixture-actor", action: "observe_recovery", body: OBSERVE_RECOVERY });
    await adapter.invokeLocalCall({
      operationId: "op-rec-string",
      actor: "fixture-actor",
      action: "observe_recovery",
      body: { ...OBSERVE_RECOVERY, allocationId: "alloc-1" },
    });
    expect(sent).toHaveLength(2);
  });

  it("still checks the string branch and rejects other types before a request", async () => {
    const { adapter, sent } = recording();
    for (const allocationId of ["", "x".repeat(301), 7, true, {}]) {
      await expect(
        adapter.invokeLocalCall({
          operationId: "op-rec-bad",
          actor: "fixture-actor",
          action: "observe_recovery",
          body: { ...OBSERVE_RECOVERY, allocationId },
        }),
      ).rejects.toThrow(/allocationId/);
    }
    expect(sent).toEqual([]);
  });

  it("rejects body keys that only exist on the object prototype", async () => {
    const { adapter, sent } = recording();
    for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      const body = JSON.parse(`{"domain":"${PINNED_PROTOCOL_DOMAIN}","eventId":"evt","${key}":1}`) as Record<string, unknown>;
      await expect(
        adapter.invokeLocalCall({ operationId: "op-proto", actor: "fixture-actor", action: "close_sales", body }),
      ).rejects.toThrow(/Unknown field/);
    }
    expect(sent).toEqual([]);
  });

  it("does not treat an inherited property as a required field", async () => {
    const { adapter, sent } = recording();
    const body = Object.create({ eventId: "evt_inherited" }) as Record<string, unknown>;
    body.domain = PINNED_PROTOCOL_DOMAIN;
    await expect(
      adapter.invokeLocalCall({ operationId: "op-inherit", actor: "fixture-actor", action: "close_sales", body }),
    ).rejects.toThrow(/Missing field body.eventId/);
    expect(sent).toEqual([]);
  });
});
