import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  HttpProtocolAdapter,
  StubProtocolAdapter,
  createProtocol,
  createStubGiftInvoker,
  giftInvokerFor,
  type CommerceProtocol,
} from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("gift invoker selection", () => {
  it("uses a shape-only invoker for the stub and leaves the stub without invokeLocalCall", async () => {
    const stub = createProtocol();
    expect(stub).toBeInstanceOf(StubProtocolAdapter);
    const selected = giftInvokerFor(stub);
    expect(selected?.source).toBe("stub-shape");
    expect(selected?.invoker).not.toBe(stub);
    expect("invokeLocalCall" in stub).toBe(false);
    const offered = await selected?.invoker.invokeLocalCall({
      operationId: "op-offer",
      actor: "donor-a",
      action: "offer_gift",
      body: { giftId: "gift-1", ticketId: "ticket-9", recipient: "recipient-b" },
    });
    expect(offered).toMatchObject({
      sequence: 1,
      action: "offer_gift",
      result: { giftId: "gift-1", termsHash: "terms-hash" },
    });
    const accepted = await selected?.invoker.invokeLocalCall({
      operationId: "op-accept",
      actor: "recipient-b",
      action: "accept_gift",
      body: { giftId: "gift-1", termsHash: "terms-hash" },
    });
    expect(accepted).toMatchObject({
      sequence: 2,
      action: "accept_gift",
      result: { ticketId: "ticket-9", owner: "recipient-b", rightsVersion: 1, financialEntries: 0 },
    });
  });

  it("returns the http adapter itself for integration-gate", () => {
    const http = new HttpProtocolAdapter("http://127.0.0.1:9", async () => {
      throw new Error("unused");
    });
    const selected = giftInvokerFor(http);
    expect(selected).toEqual({ source: "integration-gate", invoker: http });
  });

  it("returns null for an unknown protocol", () => {
    expect(giftInvokerFor({} as CommerceProtocol)).toBeNull();
  });

  it("refuses any action outside the three", async () => {
    const invoker = createStubGiftInvoker();
    for (const action of ["capture", "settle_capture", "commit_trade", "issue_invitation", "create_event"]) {
      await expect(
        invoker.invokeLocalCall({
          operationId: "op-other",
          actor: "operator",
          action,
          body: {},
        }),
      ).rejects.toThrow(new RegExp(action));
    }
    const cancelled = await invoker.invokeLocalCall({
      operationId: "op-cancel",
      actor: "donor-a",
      action: "cancel_gift",
      body: { giftId: "gift-1" },
    });
    expect(cancelled).toMatchObject({ action: "cancel_gift", result: { giftState: "CANCELLED" } });
  });

  it("does not construct the other adapter", () => {
    const source = readFileSync(path.join(here, "../src/gift-invoker.ts"), "utf8");
    expect(source).not.toContain("new StubProtocolAdapter");
    expect(source).not.toContain("new HttpProtocolAdapter");
    expect(source).not.toContain("fallback");
  });
});
