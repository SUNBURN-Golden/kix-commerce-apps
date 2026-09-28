import { type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CONTRACT_ONLY_LOCAL_CALL_PATH,
  CREDIT_BOUNDARY,
  HttpProtocolAdapter,
  INTEGRATION_GATE_HEALTH_PATH,
  INTEGRATION_GATE_READY_PATH,
  PINNED_PROTOCOL_DOMAIN,
  StubProtocolAdapter,
  admissionDeskState,
  echoIntegrationGateHeaders,
} from "../src/index.js";
import { assertReviewedCheckout, protocolRoot, REVIEWED_GATE_RUNS, startGate, stopGate } from "./support/reviewed-gate.js";

const describeGate = REVIEWED_GATE_RUNS ? describe.sequential : describe.skip;

/**
 * Reference Core.SCOPE from kix-protocol. The string is the in-memory fixture
 * label the gate compares. It is not an app payment integration.
 */
const REFERENCE_FIXTURE_SCOPE = {
  provider: "toss",
  environment: "test",
  merchant: "kix-fixture",
  channel: "card",
};

const SHOW_POLICY = {
  primaryPrice: 100000,
  resaleCap: 150000,
  primaryFeeBps: 500,
  resaleFeeBps: 300,
  resaleOrganizerBps: 200,
  resaleAllowed: true,
  refundProfile: "FULL_CHAIN_UNWIND_FIXTURE",
};


describe("http mode fail-closed without a server", () => {
  it("rejects a closed port, a wrong transport header, and a production claim", async () => {
    const dead = new HttpProtocolAdapter("http://127.0.0.1:1");
    await expect(
      dead.invokeLocalCall({
        operationId: "op-down",
        actor: "operator",
        action: "advance_clock",
        body: { domain: PINNED_PROTOCOL_DOMAIN, now: 1 },
      }),
    ).rejects.toMatchObject({ code: "GATE_UNAVAILABLE" });

    const fetchImpl: typeof fetch = async (_input, init) =>
      new Response(JSON.stringify({ production: true }), { status: 200, headers: echoIntegrationGateHeaders(init) });
    const claiming = new HttpProtocolAdapter("http://127.0.0.1:8765", fetchImpl);
    await expect(
      claiming.invokeLocalCall({
        operationId: "op-claim",
        actor: "operator",
        action: "advance_clock",
        body: { domain: PINNED_PROTOCOL_DOMAIN, now: 1 },
      }),
    ).rejects.toMatchObject({ code: "PRODUCTION_ENDPOINT" });

    const wrongHeader: typeof fetch = async (_input, init) =>
      new Response("{}", {
        status: 200,
        headers: echoIntegrationGateHeaders(init, { "x-kix-production-endpoint": "true" }),
      });
    const mismatched = new HttpProtocolAdapter("http://127.0.0.1:9", wrongHeader);
    await expect(
      mismatched.readGateHealth(),
    ).rejects.toMatchObject({ code: "GATE_TRANSPORT" });

    const hidden: typeof fetch = async (_input, init) =>
      new Response(JSON.stringify({ error: "HIDDEN", rejected: true }), {
        status: 200,
        headers: echoIntegrationGateHeaders(init),
      });
    const hiddenAdapter = new HttpProtocolAdapter("http://127.0.0.1:9", hidden);
    await expect(
      hiddenAdapter.invokeLocalCall({
        operationId: "op-hidden",
        actor: "operator",
        action: "advance_clock",
        body: { domain: PINNED_PROTOCOL_DOMAIN, now: 1 },
      }),
    ).rejects.toMatchObject({ code: "HIDDEN" });

    const listing: typeof fetch = async (_input, init) =>
      new Response(
        JSON.stringify({
          domain: PINNED_PROTOCOL_DOMAIN,
          operationId: "op-list",
          sequence: 1,
          action: "create_listing",
          result: { listingId: "lst_fixture", termsHash: "abc", rightLocked: false },
        }),
        { status: 200, headers: echoIntegrationGateHeaders(init) },
      );
    const listingAdapter = new HttpProtocolAdapter("http://127.0.0.1:9", listing);
    await expect(
      listingAdapter.invokeLocalCall({
        operationId: "op-list",
        actor: "seller",
        action: "create_listing",
        body: {
          domain: PINNED_PROTOCOL_DOMAIN,
          amount: 1,
          expectedVersion: 0,
          expiresAt: 10,
          listingId: "lst_fixture",
          ticketId: "right_fixture",
        },
      }),
    ).resolves.toMatchObject({
      action: "create_listing",
      result: { listingId: "lst_fixture", rightLocked: false },
    });
  });
});

describeGate("loopback integration gate", () => {
  let baseUrl = "";
  let child: ChildProcess | undefined;
  const calls: string[] = [];

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

  it("exercises desk flows over the real local-call transport and keeps stub semantics separate", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push(String(input));
      return fetch(input, init);
    };
    const http = new HttpProtocolAdapter(baseUrl, fetchImpl);
    expect(http.describe()).toMatchObject({
      adapter: "http",
      environment: "integration-http",
      liveChain: false,
      fundsMovement: "none",
      publicDeploy: false,
      productionConformance: false,
      protocolTruth: false,
    });
    expect("disburseCredit" in http).toBe(false);
    expect(CREDIT_BOUNDARY.action).toBe("none");

    await expect(http.initiateSettlement({
      settlementId: "stl_http",
      eventId: "evt_lanterns",
      idempotencyKey: "init-http",
    })).rejects.toThrow(/not-bound/);
    await expect(http.captureSettlement({ settlementId: "stl_http", idempotencyKey: "cap-http" })).rejects.toThrow(
      /not-bound/,
    );
    await expect(http.holdReservation({
      reservationId: "res_http",
      showId: "show_http",
      slot: "slot_http",
      buyerRole: "buyer",
      expiresAt: "2026-09-26T00:00:00.000Z",
      idempotencyKey: "hold-http",
    })).rejects.toThrow(/not-bound/);
    await expect(http.checkAdmission({ rightsRef: "right_http", gateId: "gate-main" })).rejects.toThrow(/not-bound/);
    await expect(
      http.consumeAdmissionCredential({
        consumeId: "csm_http",
        rightId: "iss_http",
        version: 1,
        gateRole: "gate-main",
        request: "desk-request",
        idempotencyKey: "consume-http",
      }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      http.authorizeAdmissionCredential({
        admissionId: "adm_http",
        rightId: "iss_http",
        version: 1,
        holderRole: "buyer",
        gateRole: "gate-main",
        request: "desk-request",
        expiresAt: "2099-06-01T00:00:00.000Z",
        idempotencyKey: "admit-http",
      }),
    ).rejects.toThrow(/not-bound/);
    await expect(http.openResale({ bookingId: "bkg_http", askLabel: "display" })).rejects.toThrow(/not-bound/);
    await expect(http.acceptResale("rsl_http")).rejects.toThrow(/not-bound/);
    await expect(
      http.offerCredit({
        advanceId: "adv_http",
        claimId: "claim_http",
        openFace: 100000,
        amount: 80000,
        beneficiaryRole: "desk-beneficiary",
        idempotencyKey: "offer-http",
        product: null,
      }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      http.drawCredit({ advanceId: "adv_http", drawId: "draw_http", idempotencyKey: "draw-http" }),
    ).rejects.toThrow(/not-bound/);
    expect(calls).toEqual([]);

    const health = await http.readGateHealth();
    const ready = await http.readGateReady();
    expect(health).toMatchObject({
      status: "up",
      liveHttpServer: "non-production-local-integration",
      production: false,
      publicHost: false,
      productionReadiness: false,
      productionConformance: false,
      protocolTruth: false,
      localFileJournal: false,
    });
    expect(health).not.toHaveProperty("commandCount");
    expect(health).not.toHaveProperty("durable");
    expect(ready).toMatchObject({
      status: "ready",
      production: false,
      publicHost: false,
      productionReadiness: false,
      productionConformance: false,
      protocolTruth: false,
      liveMoney: false,
      durable: false,
      localFileJournal: false,
      commandCount: 40,
      domain: PINNED_PROTOCOL_DOMAIN,
    });
    expect(ready).not.toHaveProperty("journalRecords");
    expect(calls.map((url) => new URL(url).pathname)).toEqual([
      INTEGRATION_GATE_HEALTH_PATH,
      INTEGRATION_GATE_READY_PATH,
    ]);

    const clockBody = { domain: PINNED_PROTOCOL_DOMAIN, now: 5 };
    const clock = asRecord(
      await http.invokeLocalCall({
        operationId: "op-clock",
        actor: "operator",
        action: "advance_clock",
        body: clockBody,
      }),
    );
    expect(clock).toMatchObject({
      domain: PINNED_PROTOCOL_DOMAIN,
      operationId: "op-clock",
      sequence: 1,
      action: "advance_clock",
      result: { logicalTime: 5 },
    });
    expect(clock).not.toHaveProperty("rejected");
    const replay = await http.invokeLocalCall({
      operationId: "op-clock",
      actor: "operator",
      action: "advance_clock",
      body: clockBody,
    });
    expect(replay).toEqual(clock);

    await expect(
      http.invokeLocalCall({
        operationId: "op-clock",
        actor: "operator",
        action: "advance_clock",
        body: { domain: PINNED_PROTOCOL_DOMAIN, now: 9 },
      }),
    ).rejects.toMatchObject({ code: "OPERATION_ID_CONFLICT" });
    await expect(
      http.invokeLocalCall({
        operationId: "op-back",
        actor: "operator",
        action: "advance_clock",
        body: { domain: PINNED_PROTOCOL_DOMAIN, now: 4 },
      }),
    ).rejects.toMatchObject({ code: "INVALID_FIXTURE_CLOCK" });

    const created = asRecord(
      await http.invokeLocalCall({
        operationId: "op-event",
        actor: "operator",
        action: "create_event",
        body: {
          domain: PINNED_PROTOCOL_DOMAIN,
          eventId: "show",
          organizer: "organizer",
          policy: SHOW_POLICY,
          seats: ["A1"],
        },
      }),
    );
    expect(created.action).toBe("create_event");
    expect(asRecord(created.result).eventId).toBe("show");
    expect(created).not.toHaveProperty("phase");

    const closed = asRecord(
      await http.invokeLocalCall({
        operationId: "op-close",
        actor: "operator",
        action: "close_sales",
        body: { domain: PINNED_PROTOCOL_DOMAIN, eventId: "show" },
      }),
    );
    expect(asRecord(closed.result).salesStatus).toBe("CLOSED");

    const opened = asRecord(
      await http.invokeLocalCall({
        operationId: "op-open",
        actor: "operator",
        action: "open_admission",
        body: { domain: PINNED_PROTOCOL_DOMAIN, eventId: "show" },
      }),
    );
    expect(asRecord(opened.result)).toEqual({ admissionStatus: "OPEN" });
    expect(opened).not.toHaveProperty("admitted");

    await expect(
      http.invokeLocalCall({
        operationId: "op-cap",
        actor: "pg-adapter",
        action: "capture",
        body: {
          domain: PINNED_PROTOCOL_DOMAIN,
          tradeId: "missing",
          orderId: "order-1",
          paymentId: "pay-1",
          amount: 1,
          currency: "KRW",
          buyer: "A",
          scope: REFERENCE_FIXTURE_SCOPE,
          provenance: "synthetic",
        },
      }),
    ).rejects.toMatchObject({ code: "TRADE_NOT_FOUND" });
    await expect(
      http.invokeLocalCall({
        operationId: "op-settle",
        actor: "pg-adapter",
        action: "settle_capture",
        body: {
          domain: PINNED_PROTOCOL_DOMAIN,
          tradeId: "missing",
          paymentId: "pay-1",
          currency: "KRW",
          amount: 1,
          feeAmount: 0,
          taxAmount: 0,
          heldAmount: 0,
          adjustmentAmount: 0,
          grossAmount: 1,
          feeBearer: "platform",
          contractRef: "fixture:settlement:v1",
          movementId: "mov-1",
          provenance: "synthetic",
          scope: REFERENCE_FIXTURE_SCOPE,
        },
      }),
    ).rejects.toMatchObject({ code: "TRADE_NOT_FOUND" });
    await expect(
      http.invokeLocalCall({
        operationId: "op-admit",
        actor: "venue",
        action: "admit",
        body: {
          domain: PINNED_PROTOCOL_DOMAIN,
          ticketId: "missing",
          holder: "A",
          expectedVersion: 0,
          admissionEpoch: 0,
        },
      }),
    ).rejects.toMatchObject({ code: "TICKET_NOT_FOUND" });
    await expect(
      http.invokeLocalCall({
        operationId: "op-reserve",
        actor: "buyer",
        action: "reserve_listing",
        body: {
          domain: PINNED_PROTOCOL_DOMAIN,
          expiresAt: 100,
          listingHash: "x",
          listingId: "missing",
          tradeId: "trade-missing",
        },
      }),
    ).rejects.toMatchObject({ code: "LISTING_NOT_FOUND" });
    await expect(
      http.invokeLocalCall({
        operationId: "op-release",
        actor: "operator",
        action: "release_inventory",
        body: {
          domain: PINNED_PROTOCOL_DOMAIN,
          closedRightId: "right-missing",
          expectedInventoryVersion: 0,
          inventoryId: "inv-missing",
        },
      }),
    ).rejects.toMatchObject({ code: "INVENTORY_NOT_FOUND" });
    await expect(
      http.invokeLocalCall({
        operationId: "op-listing",
        actor: "seller",
        action: "create_listing",
        body: {
          domain: PINNED_PROTOCOL_DOMAIN,
          amount: 1,
          expectedVersion: 0,
          expiresAt: 100,
          listingId: "lst-missing",
          ticketId: "missing",
        },
      }),
    ).rejects.toMatchObject({ code: "TICKET_NOT_FOUND" });
    await expect(
      http.invokeLocalCall({
        operationId: "op-accept",
        actor: "buyer",
        action: "accept_trade",
        body: { domain: PINNED_PROTOCOL_DOMAIN, termsHash: "x", tradeId: "missing" },
      }),
    ).rejects.toMatchObject({ code: "TRADE_NOT_FOUND" });
    await expect(
      http.invokeLocalCall({
        operationId: "op-gift",
        actor: "seller",
        action: "offer_gift",
        body: {
          domain: PINNED_PROTOCOL_DOMAIN,
          expectedVersion: 0,
          expiresAt: 100,
          giftId: "gift-1",
          recipient: "friend",
          ticketId: "missing",
        },
      }),
    ).rejects.toMatchObject({ code: "TICKET_NOT_FOUND" });
    await expect(
      http.invokeLocalCall({
        operationId: "op-draw",
        actor: "operator",
        action: "draw",
        body: { domain: PINNED_PROTOCOL_DOMAIN },
      }),
    ).rejects.toThrow(/Unknown protocol action/);

    const commandCalls = calls.slice(2);
    expect(commandCalls.length).toBeGreaterThan(0);
    expect(commandCalls.every((url) => new URL(url).pathname === CONTRACT_ONLY_LOCAL_CALL_PATH)).toBe(true);
    expect(commandCalls.some((url) => /\/v1\/|credit|disburse|marketplace/.test(url))).toBe(false);

    const stub = new StubProtocolAdapter();
    const openedSettlement = await stub.initiateSettlement({
      settlementId: "stl_stub",
      eventId: "evt_lanterns",
      idempotencyKey: "init-stub",
    });
    const replayedSettlement = await stub.initiateSettlement({
      settlementId: "stl_stub",
      eventId: "evt_lanterns",
      idempotencyKey: "init-stub",
    });
    expect(openedSettlement.duplicate).toBe(false);
    expect(replayedSettlement.duplicate).toBe(true);
    expect(openedSettlement.fundsExecuted).toBe(false);
    expect(openedSettlement.settlement.phase).toBe("INITIATED");
    expect(openedSettlement.settlement.mode).toBe("mock");
    expect(stub.describe().fundsMovement).toBe(http.describe().fundsMovement);
    expect(clock).not.toHaveProperty("phase");
    expect(clock).not.toHaveProperty("duplicate");

    const credit = await stub.offerCredit({
      advanceId: "adv_stub",
      claimId: "claim_stub",
      openFace: 100000,
      amount: 80000,
      beneficiaryRole: "desk-beneficiary",
      idempotencyKey: "offer-stub",
      product: null,
    });
    expect(credit.fundsExecuted).toBe(false);
    expect(credit.economicFinalityClaimed).toBe(false);
    expect(credit.credit.phase).toBe("OFFERED");
    expect(credit.credit.mode).toBe("mock");
  }, 20000);

  it("classifies a live missing admit as invalid and does not treat the gate as entry", async () => {
    const paths: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      paths.push(new URL(String(input)).pathname);
      return fetch(input, init);
    };
    const http = new HttpProtocolAdapter(baseUrl, fetchImpl);
    const boundary = await http.presentAdmission({ rightId: "missing", version: 0, holderRole: "A" });
    expect(boundary.deskState).toBe("invalid");
    expect(boundary.decision).toBe("NOT_BOUND");
    expect(boundary.fresh).toBe(false);
    expect(boundary.admissionRoutingProduction).toBe(false);
    expect(boundary.externalAdmission).toBe("UNSUPPORTED");
    expect(boundary.mode).toBe("http-boundary");
    expect(paths).toEqual([INTEGRATION_GATE_HEALTH_PATH]);

    const before = paths.length;
    await expect(
      http.invokeLocalCall({
        operationId: "op-admit-missing",
        actor: "venue",
        action: "admit",
        body: {
          domain: PINNED_PROTOCOL_DOMAIN,
          ticketId: "missing-ticket",
          holder: "A",
          expectedVersion: 0,
          admissionEpoch: 0,
        },
      }),
    ).rejects.toMatchObject({ code: "TICKET_NOT_FOUND" });
    await expect(
      http.invokeLocalCall({
        operationId: "op-admit-missing",
        actor: "venue",
        action: "admit",
        body: {
          domain: PINNED_PROTOCOL_DOMAIN,
          ticketId: "missing-ticket",
          holder: "A",
          expectedVersion: 0,
          admissionEpoch: 0,
        },
      }),
    ).rejects.toMatchObject({ code: "TICKET_NOT_FOUND" });
    expect(
      admissionDeskState({ decision: "TICKET_NOT_FOUND", fresh: false, transferObserved: false }),
    ).toBe("invalid");
    expect(
      admissionDeskState({ decision: "TICKET_NOT_FOUND", fresh: false, transferObserved: false }),
    ).toBe(boundary.deskState);

    const stub = new StubProtocolAdapter();
    const missing = await stub.presentAdmission({ rightId: "missing", version: 0, holderRole: "A" });
    expect(missing.deskState).toBe("invalid");
    expect(missing.admissionRoutingProduction).toBe(false);
    expect(missing.deskState).toBe(boundary.deskState);

    await expect(
      http.invokeLocalCall({
        operationId: "op-authorize-admission",
        actor: "venue",
        action: "authorize_admission",
        body: { domain: PINNED_PROTOCOL_DOMAIN },
      }),
    ).rejects.toThrow(/Unknown protocol action/);
    expect(paths.slice(before).every((path) => path === CONTRACT_ONLY_LOCAL_CALL_PATH)).toBe(true);
    expect(paths.includes("/admit")).toBe(false);
  });
});

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected object");
  }
  return value as Record<string, unknown>;
}
