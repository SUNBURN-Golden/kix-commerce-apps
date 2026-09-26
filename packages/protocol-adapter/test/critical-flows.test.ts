import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  CONTRACT_ONLY_LOCAL_CALL_PATH,
  CREDIT_BOUNDARY,
  createProtocol,
  HttpProtocolAdapter,
  PINNED_PROTOCOL_DOMAIN,
  ProtocolError,
  StubProtocolAdapter,
} from "../src/index.js";

describe("booking, admission, and resale stub flows", () => {
  it("books a hold and admits the issued right only once", async () => {
    const protocol = new StubProtocolAdapter();
    const [first] = await protocol.listPerformances();
    expect(first?.eventId).toBe("evt_lanterns");

    const before = first!.remainingCapacity;
    const hold = await protocol.placeHold({ eventId: first!.eventId, quantity: 2 });
    const during = await protocol.listPerformances();
    expect(during.find((item) => item.eventId === first!.eventId)?.remainingCapacity).toBe(before - 2);

    const booking = await protocol.confirmBooking(hold.holdId);
    expect(booking.payment).toBe("simulated-no-funds");
    expect(booking.rightsRef).toMatch(/^right_/);
    expect(booking.surfaces).toContain("wave2.rights");
    expect(booking.surfaces).toContain("wave4.booking.B01-B05");

    const admitted = await protocol.checkAdmission({
      rightsRef: booking.rightsRef,
      gateId: "gate-main",
    });
    expect(admitted.admitted).toBe(true);
    expect(admitted.surface).toBe("wave4.admission.P03");
    expect(admitted.zkSurface).toBe("wave2.zk_gate");
    expect(admitted.proofMode).toBe("stub");

    const second = await protocol.checkAdmission({
      rightsRef: booking.rightsRef,
      gateId: "gate-main",
    });
    expect(second.admitted).toBe(false);
  });

  it("blocks admission while a listing is open, then admits only the transferred right", async () => {
    const protocol = new StubProtocolAdapter();
    const hold = await protocol.placeHold({ eventId: "evt_paper_orchestra", quantity: 1 });
    const original = await protocol.confirmBooking(hold.holdId);
    const listing = await protocol.openResale({
      bookingId: original.bookingId,
      askLabel: "display only",
    });

    const blocked = await protocol.checkAdmission({
      rightsRef: original.rightsRef,
      gateId: "gate-side",
    });
    expect(blocked.admitted).toBe(false);

    const transferred = await protocol.acceptResale(listing.listingId);
    expect(transferred.booking.payment).toBe("simulated-no-funds");
    expect(transferred.booking.rightsRef).not.toBe(original.rightsRef);
    expect(transferred.listing.status).toBe("transferred");

    const oldRight = await protocol.checkAdmission({
      rightsRef: original.rightsRef,
      gateId: "gate-side",
    });
    expect(oldRight.admitted).toBe(false);

    const newRight = await protocol.checkAdmission({
      rightsRef: transferred.booking.rightsRef,
      gateId: "gate-side",
    });
    expect(newRight.admitted).toBe(true);
  });

  it("releases a hold back to capacity and rejects unknown rights", async () => {
    const protocol = new StubProtocolAdapter([], () => 1_700_000_000_000);
    await expect(protocol.listPerformances()).resolves.toEqual([]);

    const seeded = new StubProtocolAdapter();
    const hold = await seeded.placeHold({ eventId: "evt_last_ferry", quantity: 1 });
    await seeded.releaseHold(hold.holdId);
    const restored = await seeded.listPerformances();
    expect(restored.find((item) => item.eventId === "evt_last_ferry")?.remainingCapacity).toBe(12);
    await expect(seeded.confirmBooking(hold.holdId)).rejects.toBeInstanceOf(ProtocolError);

    const decision = await seeded.checkAdmission({ rightsRef: "right_missing", gateId: "gate-main" });
    expect(decision.admitted).toBe(false);
  });

  it("points at settlement codes without computing a split", async () => {
    const protocol = new StubProtocolAdapter();
    const preview = await protocol.settlementPreview("evt_lanterns");
    expect(preview.mode).toBe("mock");
    expect(preview.references).toEqual(["F01", "F02", "F03"]);
    expect(preview.surface).toBe("wave3.settlement.F01-F03");
    expect(preview).not.toHaveProperty("amount");
    expect(preview).not.toHaveProperty("currency");
  });

  it("keeps credit disbursement off the client", () => {
    expect(CREDIT_BOUNDARY.action).toBe("none");
    const protocol = createProtocol();
    expect(protocol.describe().adapter).toBe("stub");
    expect("disburseCredit" in protocol).toBe(false);
    expect(protocol.describe().fundsMovement).toBe("none");
    expect(protocol.describe().liveChain).toBe(false);
  });
});

describe("http adapter binding", () => {
  it("refuses http mode without an explicit loopback base URL", () => {
    expect(() => createProtocol({ mode: "http" })).toThrow(ProtocolError);
    expect(() => createProtocol({ mode: "http", baseUrl: "   " })).toThrow(ProtocolError);
    expect(() => createProtocol({ mode: "http", baseUrl: "file:///tmp/kix" })).toThrow(ProtocolError);
    expect(() => createProtocol({ mode: "http", baseUrl: "https://127.0.0.1:8765" })).toThrow(/127\.0\.0\.1/);
    expect(() => createProtocol({ mode: "http", baseUrl: "http://localhost:8765" })).toThrow(/no default public host/);
    expect(() => createProtocol({ mode: "http", baseUrl: "http://127.0.0.1" })).toThrow(/explicit/);
    expect(() => createProtocol({ mode: "http", baseUrl: "http://127.0.0.1:8765/v1" })).toThrow(/origin only/);
    expect(() => createProtocol({ mode: "http", baseUrl: "http://example.test:8765" })).toThrow(/no default public host/);
    expect(createProtocol({ mode: "http", baseUrl: "http://127.0.0.1:8765" }).describe()).toMatchObject({
      adapter: "http",
      liveChain: false,
      fundsMovement: "none",
    });
    expect(createProtocol().describe().adapter).toBe("stub");
  });

  it("leaves desk methods not-bound and does not call provisional REST paths", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input));
      return jsonResponse({});
    };
    const protocol = new HttpProtocolAdapter("http://127.0.0.1:8765", fetchImpl);
    expect(protocol.describe().adapter).toBe("http");
    expect(protocol.describe().fundsMovement).toBe("none");
    expect(protocol.describe().liveChain).toBe(false);
    expect("disburseCredit" in protocol).toBe(false);

    await expect(protocol.listPerformances()).rejects.toThrow(/not-bound/);
    await expect(protocol.placeHold({ eventId: "evt_lanterns", quantity: 1 })).rejects.toThrow(/not-bound/);
    await expect(protocol.releaseHold("hold_9")).rejects.toThrow(/not-bound/);
    await expect(protocol.confirmBooking("hold_9")).rejects.toThrow(/not-bound/);
    await expect(protocol.getBooking("bkg_9")).rejects.toThrow(/not-bound/);
    await expect(protocol.checkAdmission({ rightsRef: "right_9", gateId: "gate-main" })).rejects.toThrow(/not-bound/);
    await expect(protocol.listResale("evt_lanterns")).rejects.toThrow(/not-bound/);
    await expect(protocol.openResale({ bookingId: "bkg_9", askLabel: "display" })).rejects.toThrow(/not-bound/);
    await expect(protocol.acceptResale("rsl_9")).rejects.toThrow(/not-bound/);
    await expect(protocol.settlementPreview("evt_lanterns")).rejects.toThrow(/not-bound/);
    await expect(
      protocol.initiateSettlement({
        settlementId: "stl_evt_lanterns",
        eventId: "evt_lanterns",
        idempotencyKey: "init-http",
      }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      protocol.authorizeSettlement({ settlementId: "stl_evt_lanterns", idempotencyKey: "auth-http" }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      protocol.captureSettlement({ settlementId: "stl_evt_lanterns", idempotencyKey: "cap-http" }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      protocol.commitSettlement({ settlementId: "stl_evt_lanterns", idempotencyKey: "commit-http" }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      protocol.failSettlement({
        settlementId: "stl_evt_lanterns",
        idempotencyKey: "fail-http",
        reason: "FIXTURE_DECLINE",
      }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      protocol.cancelSettlement({
        settlementId: "stl_evt_lanterns",
        idempotencyKey: "cancel-http",
        reason: "FIXTURE_WITHDRAW",
      }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      protocol.reconcileSettlement({ settlementId: "stl_evt_lanterns", idempotencyKey: "recon-http" }),
    ).rejects.toThrow(/not-bound/);
    await expect(protocol.viewSettlement("stl_evt_lanterns")).rejects.toThrow(/not-bound/);
    await expect(protocol.rejectExternalSettlement("EXTERNAL_ATTEMPT")).rejects.toThrow(/not-bound/);

    expect(calls).toEqual([]);
    expect(Object.values(COMMERCE_COMMAND_BINDINGS).every((binding) => binding.status === "not-bound")).toBe(true);
    expect(JSON.stringify(COMMERCE_COMMAND_BINDINGS)).not.toContain("/v1/commerce");
    expect(CONTRACT_ONLY_LOCAL_CALL_PATH).toBe("/x-kix-contract-only/local-call");
  });

  it("posts a pinned local-call envelope and keeps booking and settlement guards", async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    let responseBody: unknown = {
      domain: PINNED_PROTOCOL_DOMAIN,
      operationId: "op-close-1",
      sequence: 1,
      action: "close_sales",
      result: {},
    };
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : undefined,
      });
      return jsonResponse(responseBody);
    };
    const protocol = new HttpProtocolAdapter("http://127.0.0.1:8765/", fetchImpl);
    const commandBody = { domain: PINNED_PROTOCOL_DOMAIN, eventId: "evt_lanterns" };

    const receipt = await protocol.invokeLocalCall({
      operationId: "op-close-1",
      actor: "fixture-actor",
      action: "close_sales",
      body: commandBody,
    });
    expect(receipt).toMatchObject({ action: "close_sales" });
    expect(calls[0]).toEqual({
      method: "POST",
      url: `http://127.0.0.1:8765${CONTRACT_ONLY_LOCAL_CALL_PATH}`,
      body: JSON.stringify({
        operationId: "op-close-1",
        actor: "fixture-actor",
        action: "close_sales",
        body: commandBody,
      }),
    });
    expect(calls.some((call) => /credit|disburse|\/v1\/commerce/.test(call.url))).toBe(false);

    await expect(
      protocol.invokeLocalCall({
        operationId: "op-unknown",
        actor: "fixture-actor",
        action: "list_performances",
        body: commandBody,
      }),
    ).rejects.toThrow(/Unknown protocol action/);
    await expect(
      protocol.invokeLocalCall({
        operationId: "op-extra",
        actor: "fixture-actor",
        action: "close_sales",
        body: { ...commandBody, note: "extra" },
      }),
    ).rejects.toThrow(/Unknown field body\.note/);
    await expect(
      protocol.invokeLocalCall({
        operationId: "op-domain",
        actor: " fixture-actor",
        action: "close_sales",
        body: { domain: "kix:other", eventId: "evt_lanterns" },
      }),
    ).rejects.toThrow(/no leading or trailing whitespace/);
    await expect(
      protocol.invokeLocalCall({
        operationId: "op-domain",
        actor: "fixture-actor",
        action: "close_sales",
        body: { domain: "kix:other", eventId: "evt_lanterns" },
      }),
    ).rejects.toThrow(/DOMAIN_MISMATCH/);
    expect(calls).toHaveLength(1);

    responseBody = {
      bookingId: "bkg_remote",
      eventId: "evt_lanterns",
      quantity: 1,
      rightsRef: "right_remote",
      status: "confirmed",
      payment: "card",
    };
    await expect(
      protocol.invokeLocalCall({
        operationId: "op-close-2",
        actor: "fixture-actor",
        action: "close_sales",
        body: commandBody,
      }),
    ).rejects.toThrow(/simulated-no-funds/);

    responseBody = {
      bookingId: "bkg_remote",
      eventId: "evt_lanterns",
      quantity: 1,
      rightsRef: "right_remote",
      status: "confirmed",
      payment: "simulated-no-funds",
    };
    await expect(
      protocol.invokeLocalCall({
        operationId: "op-close-3",
        actor: "fixture-actor",
        action: "close_sales",
        body: commandBody,
      }),
    ).resolves.toMatchObject({ payment: "simulated-no-funds" });

    responseBody = {
      eventId: "evt_lanterns",
      mode: "live",
      references: ["F01", "F02", "F03"],
      note: "remote",
    };
    await expect(
      protocol.invokeLocalCall({
        operationId: "op-close-4",
        actor: "fixture-actor",
        action: "close_sales",
        body: commandBody,
      }),
    ).rejects.toThrow(/mock mode/);

    responseBody = {
      eventId: "evt_lanterns",
      mode: "mock",
      references: ["F01", "F02", "F04"],
      note: "remote",
    };
    await expect(
      protocol.invokeLocalCall({
        operationId: "op-close-5",
        actor: "fixture-actor",
        action: "close_sales",
        body: commandBody,
      }),
    ).rejects.toThrow(/F01, F02, and F03/);

    responseBody = {
      eventId: "evt_lanterns",
      mode: "mock",
      references: ["F01", "F02", "F03"],
      note: "remote mock pointer",
      amount: 1,
    };
    await expect(
      protocol.invokeLocalCall({
        operationId: "op-close-6",
        actor: "fixture-actor",
        action: "close_sales",
        body: commandBody,
      }),
    ).rejects.toThrow(/amount or currency/);

    responseBody = { disburseCredit: { amount: 1 } };
    await expect(
      protocol.invokeLocalCall({
        operationId: "op-close-7",
        actor: "fixture-actor",
        action: "close_sales",
        body: commandBody,
      }),
    ).rejects.toThrow(/does not disburse credit/);

    responseBody = {
      eventId: "evt_lanterns",
      mode: "mock",
      references: ["F01", "F02", "F03"],
      note: "remote mock pointer",
      phase: "PAID",
    };
    await expect(
      protocol.invokeLocalCall({
        operationId: "op-close-8",
        actor: "fixture-actor",
        action: "close_sales",
        body: commandBody,
      }),
    ).rejects.toThrow(/mock FSM phase/);

    responseBody = {
      eventId: "evt_lanterns",
      mode: "mock",
      references: ["F01", "F02", "F03"],
      note: "remote mock pointer",
      fundsExecuted: true,
    };
    await expect(
      protocol.invokeLocalCall({
        operationId: "op-close-9",
        actor: "fixture-actor",
        action: "close_sales",
        body: commandBody,
      }),
    ).rejects.toThrow(/executed funds/);

    responseBody = {
      eventId: "evt_lanterns",
      mode: "mock",
      references: ["F01", "F02", "F03"],
      note: "remote mock pointer",
      provenance: "LIVE",
    };
    await expect(
      protocol.invokeLocalCall({
        operationId: "op-close-10",
        actor: "fixture-actor",
        action: "close_sales",
        body: commandBody,
      }),
    ).rejects.toThrow(/MOCK_SETTLEMENT_ONLY/);

    responseBody = {
      eventId: "evt_lanterns",
      mode: "mock",
      references: ["F01", "F02", "F03"],
      note: "remote mock pointer",
      externalPayment: "CARD",
    };
    await expect(
      protocol.invokeLocalCall({
        operationId: "op-close-11",
        actor: "fixture-actor",
        action: "close_sales",
        body: commandBody,
      }),
    ).rejects.toThrow(/external payment unsupported/);

    responseBody = {
      eventId: "evt_lanterns",
      mode: "mock",
      references: ["F01", "F02", "F03"],
      note: "remote mock pointer",
      providerAuthorizationExecuted: true,
    };
    await expect(
      protocol.invokeLocalCall({
        operationId: "op-close-12",
        actor: "fixture-actor",
        action: "close_sales",
        body: commandBody,
      }),
    ).rejects.toThrow(/provider authorization/);

    responseBody = {
      eventId: "evt_lanterns",
      mode: "mock",
      references: ["F01", "F02", "F03"],
      note: "remote mock pointer",
      phase: "CAPTURED",
      fundsExecuted: false,
      provenance: "MOCK_SETTLEMENT_ONLY",
      externalPayment: "UNSUPPORTED",
      providerAuthorizationExecuted: false,
    };
    await expect(
      protocol.invokeLocalCall({
        operationId: "op-close-13",
        actor: "fixture-actor",
        action: "close_sales",
        body: commandBody,
      }),
    ).resolves.toMatchObject({ mode: "mock", references: ["F01", "F02", "F03"], phase: "CAPTURED" });
    expect(calls.every((call) => call.url === `http://127.0.0.1:8765${CONTRACT_ONLY_LOCAL_CALL_PATH}`)).toBe(
      true,
    );
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "x-kix-transport": "integration-gate",
      "x-kix-production-endpoint": "false",
    },
  });
}
