import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  BookingJourney,
  COMMERCE_COMMAND_BINDINGS,
  COMMERCE_METHODS,
  GateRejectedError,
  HttpProtocolAdapter,
  JOURNEY_COMPOSED,
  JOURNEY_DESK_NOT_BOUND,
  JOURNEY_NOT_COMPOSED,
  JOURNEY_RULING,
  PINNED_PROTOCOL_DOMAIN,
  ProtocolError,
  echoIntegrationGateHeaders,
  type JourneyStepOutcome,
  type LocalCallInvoker,
} from "../src/index.js";
import type { LocalCallInput } from "../src/local-call.js";
import { localCallReceipt } from "./support/receipt.js";

const SHOW_POLICY = {
  primaryPrice: 100000,
  resaleCap: 150000,
  primaryFeeBps: 500,
  resaleFeeBps: 300,
  resaleOrganizerBps: 200,
  resaleAllowed: true,
  refundProfile: "FULL_CHAIN_UNWIND_FIXTURE",
};

const REFERENCE_FIXTURE_SCOPE = {
  provider: "toss",
  environment: "test",
  merchant: "kix-fixture",
  channel: "card",
};

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

function listen(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    });
  });
}

function gateHeaders(req: IncomingMessage): Record<string, string> {
  return echoIntegrationGateHeaders({
    headers: {
      "x-request-id": String(req.headers["x-request-id"] ?? ""),
      "x-correlation-id": String(req.headers["x-correlation-id"] ?? ""),
    },
  });
}

function readRequest(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function successResult(action: string, body: Record<string, unknown>): Record<string, unknown> {
  if (action === "create_event") {
    const seats = Array.isArray(body.seats) ? body.seats : [];
    return {
      eventId: body.eventId,
      policyHash: "policy-hash",
      inventoryIds: seats.map((_, index) => `inv-${index}`),
      reservationSeconds: 900,
    };
  }
  if (action === "prepare_trade") {
    return {
      tradeId: body.tradeId,
      ticketId: "ticket-1",
      externalOrderId: "order-1",
      status: "PREPARED",
      termsHash: "terms-hash",
    };
  }
  return { accepted: true };
}

function receiptFor(input: LocalCallInput): Record<string, unknown> {
  if (!isRecord(input.body)) {
    throw new Error("expected a body");
  }
  return localCallReceipt(input.operationId, input.action, successResult(input.action, input.body));
}

function scriptedInvoker(seen: LocalCallInput[] = []): LocalCallInvoker {
  return {
    async invokeLocalCall(input) {
      seen.push(structuredClone(input));
      return receiptFor(input);
    },
  };
}

function createInput(operationId = "op-create") {
  return {
    operationId,
    eventId: "show-1",
    organizer: "organizer",
    policy: SHOW_POLICY,
    seats: ["A1"],
  };
}

async function happyChain(journey: BookingJourney): Promise<JourneyStepOutcome[]> {
  const created = await journey.createEvent(createInput());
  const prepared = await journey.prepareTrade({ operationId: "op-prepare", tradeId: "trade-1", buyer: "buyer-a" });
  const accepted = await journey.acceptTrade({ operationId: "op-accept" });
  return [created, prepared, accepted];
}

describe("booking journey composition", () => {
  it("records the M2 + H1 ruling and the commands it does not send", () => {
    expect(JOURNEY_RULING).toBe("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
    expect(JOURNEY_COMPOSED).toEqual(["create_event", "prepare_trade", "accept_trade"]);
    expect(JOURNEY_NOT_COMPOSED.map((entry) => entry.action)).toEqual([
      "capture",
      "settle_capture",
      "commit_trade",
      "open_admission",
      "admit",
    ]);
    expect(JOURNEY_NOT_COMPOSED.every((entry) => entry.reason.includes(JOURNEY_RULING))).toBe(true);
    expect(JOURNEY_DESK_NOT_BOUND.map((entry) => entry.method)).toEqual([
      "placeHold",
      "confirmBooking",
      "settlementPreview",
      "checkAdmission",
    ]);
    expect(JOURNEY_DESK_NOT_BOUND[0]).toEqual({
      method: "placeHold",
      consideredAction: "reserve_listing",
      reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
    });
    expect(COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction).toBe("reserve_listing");
    expect(COMMERCE_COMMAND_BINDINGS.placeHold.status).toBe("not-bound");
    for (const method of COMMERCE_METHODS) {
      expect(COMMERCE_COMMAND_BINDINGS[method].status).toBe("not-bound");
    }
    const names = Object.getOwnPropertyNames(BookingJourney.prototype);
    for (const banned of ["capture", "settleCapture", "commitTrade", "openAdmission", "admit", "placeHold"]) {
      expect(names).not.toContain(banned);
    }
  });

  it("composes only the published bodies, in order, and copies the receipt links", async () => {
    const seen: LocalCallInput[] = [];
    const journey = new BookingJourney(scriptedInvoker(seen));
    const [created, prepared, accepted] = await happyChain(journey);
    expect(created).toMatchObject({ kind: "RECEIPT", step: "create_event" });
    expect(prepared).toMatchObject({ kind: "RECEIPT", step: "prepare_trade" });
    expect(accepted).toMatchObject({
      kind: "RECEIPT",
      step: "accept_trade",
      receipt: { result: { accepted: true } },
    });
    expect(seen.map((call) => call.action)).toEqual([...JOURNEY_COMPOSED]);
    expect(seen.map((call) => call.operationId)).toEqual(["op-create", "op-prepare", "op-accept"]);
    expect(seen[0]).toMatchObject({ actor: "operator" });
    expect(seen[1]).toMatchObject({ actor: "buyer-a" });
    expect(seen[2]).toMatchObject({ actor: "buyer-a" });
    expect(seen[0]?.body).toEqual({
      domain: PINNED_PROTOCOL_DOMAIN,
      eventId: "show-1",
      organizer: "organizer",
      policy: SHOW_POLICY,
      seats: ["A1"],
    });
    expect(seen[1]?.body).toEqual({
      domain: PINNED_PROTOCOL_DOMAIN,
      tradeId: "trade-1",
      inventoryId: "inv-0",
      amount: SHOW_POLICY.primaryPrice,
      buyer: "buyer-a",
      expectedInventoryVersion: 0,
      expectedVersion: 0,
    });
    expect(seen[2]?.body).toEqual({
      domain: PINNED_PROTOCOL_DOMAIN,
      tradeId: "trade-1",
      termsHash: "terms-hash",
    });
    expect(journey.state()).toMatchObject({
      completedThrough: "accept_trade",
      halted: null,
      notComposed: JOURNEY_NOT_COMPOSED,
    });
    const again = await journey.acceptTrade({ operationId: "op-accept-again" });
    expect(again).toMatchObject({ kind: "FENCED", blockedBy: { reason: "already-sent" } });
    expect(seen).toHaveLength(3);
  });

  it("uses the selected inventory id and does not default a price", async () => {
    const seen: LocalCallInput[] = [];
    const journey = new BookingJourney(scriptedInvoker(seen));
    await journey.createEvent({ ...createInput(), seats: ["A1", "A2"] });
    await journey.prepareTrade({ operationId: "op-prepare", tradeId: "trade-1", buyer: "buyer-a", seatIndex: 1 });
    expect(seen[1]?.body).toMatchObject({ inventoryId: "inv-1", amount: 100000 });

    const unpriced = new BookingJourney(scriptedInvoker());
    await unpriced.createEvent({
      ...createInput("op-unpriced"),
      policy: { refundProfile: "FULL_CHAIN_UNWIND_FIXTURE" } as unknown as { primaryPrice: number },
    });
    await expect(
      unpriced.prepareTrade({ operationId: "op-prepare-unpriced", tradeId: "trade-x", buyer: "buyer-a" }),
    ).rejects.toThrow(/does not supply a price/);
    expect(unpriced.state().halted).toMatchObject({ kind: "NOT_SENT", step: "prepare_trade" });
    const fenced = await unpriced.acceptTrade({ operationId: "op-accept-unpriced" });
    expect(fenced).toMatchObject({ kind: "FENCED", blockedBy: { reason: "halted" } });
  });

  it("fences a step that is out of order or already in flight, and sends nothing", async () => {
    const seen: LocalCallInput[] = [];
    const early = new BookingJourney(scriptedInvoker(seen));
    const outOfOrder = await early.prepareTrade({ operationId: "op-early", tradeId: "trade-1", buyer: "buyer-a" });
    expect(outOfOrder).toMatchObject({ kind: "FENCED", step: "prepare_trade", blockedBy: { reason: "out-of-order" } });
    expect(seen).toHaveLength(0);
    await early.createEvent(createInput());
    expect(seen).toHaveLength(1);

    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const slow: LocalCallInvoker = {
      async invokeLocalCall(input) {
        calls += 1;
        await gate;
        return receiptFor(input);
      },
    };
    const concurrent = new BookingJourney(slow);
    const first = concurrent.createEvent(createInput());
    const second = await concurrent.createEvent(createInput("op-create-2"));
    expect(second).toMatchObject({ kind: "FENCED", blockedBy: { reason: "in-flight" } });
    expect(calls).toBe(1);
    if (release === undefined) {
      throw new Error("missing release");
    }
    release();
    await expect(first).resolves.toMatchObject({ kind: "RECEIPT" });
    expect(calls).toBe(1);
  });
});

describe("booking journey fences", () => {
  it("treats a 422, including a transport-shaped error string, as a rejection and fences", async () => {
    const requests: Array<{ action: string; idempotency: string | undefined }> = [];
    const base = await listen(async (req, res) => {
      const text = await readRequest(req);
      const envelope = JSON.parse(text) as { action: string };
      requests.push({ action: envelope.action, idempotency: req.headers["idempotency-key"] as string | undefined });
      const payload = JSON.stringify({ error: "REQUEST_TIMEOUT", rejected: true });
      res.writeHead(422, gateHeaders(req));
      res.end(payload);
    });
    const journey = new BookingJourney(new HttpProtocolAdapter(base));
    const rejected = await journey.createEvent(createInput());
    expect(rejected.kind).toBe("REJECTED");
    if (rejected.kind !== "REJECTED") {
      return;
    }
    expect(rejected.code).toBe("REQUEST_TIMEOUT");
    expect(rejected.identity).toMatchObject({
      operationId: "op-create",
      actor: "operator",
      action: "create_event",
      code: "REQUEST_TIMEOUT",
    });
    expect(rejected.identity.requestId).toEqual(expect.any(String));
    expect(rejected.identity.correlationId).toEqual(expect.any(String));
    expect(rejected.identity.body).toMatchObject({ eventId: "show-1", seats: ["A1"] });
    expect(journey.state().halted?.identity).toEqual(rejected.identity);
    const next = await journey.prepareTrade({ operationId: "op-prepare", tradeId: "trade-1", buyer: "buyer-a" });
    expect(next).toMatchObject({
      kind: "FENCED",
      blockedBy: { reason: "halted", identity: rejected.identity },
    });
    expect(requests).toEqual([{ action: "create_event", idempotency: undefined }]);
  });

  it("keeps a non-422 response without rejected:true as unknown", async () => {
    const base = await listen(async (req, res) => {
      await readRequest(req);
      res.writeHead(503, gateHeaders(req));
      res.end(JSON.stringify({ error: "INTERNAL_ERROR" }));
    });
    const journey = new BookingJourney(new HttpProtocolAdapter(base));
    const outcome = await journey.createEvent(createInput());
    expect(outcome).toMatchObject({ kind: "UNKNOWN", code: "INTERNAL_ERROR" });
    const adapter = new HttpProtocolAdapter(base);
    await expect(adapter.invokeLocalCall({
      operationId: "op-plain",
      actor: "operator",
      action: "advance_clock",
      body: { domain: PINNED_PROTOCOL_DOMAIN, now: 1 },
    })).rejects.toBeInstanceOf(ProtocolError);
    await expect(adapter.invokeLocalCall({
      operationId: "op-plain-2",
      actor: "operator",
      action: "advance_clock",
      body: { domain: PINNED_PROTOCOL_DOMAIN, now: 2 },
    })).rejects.not.toBeInstanceOf(GateRejectedError);
  });

  it.each([
    ["timeout", "timeout"],
    ["cutoff", "cutoff"],
    ["closed-port", "closed-port"],
    ["stale", "stale"],
    ["wrong-operation", "wrong-operation"],
    ["extra-keys", "extra-keys"],
    ["bad-result", "bad-result"],
  ] as const)("fences after %s and does not mint an operationId", async (label, kind) => {
    expect(label.length).toBeGreaterThan(0);
    const seen: string[] = [];
    const journey = await journeyForFault(kind, seen);
    const outcome = await journey.createEvent(createInput());
    expect(outcome.kind).toBe("UNKNOWN");
    if (outcome.kind !== "UNKNOWN") {
      return;
    }
    expect(outcome.identity.operationId).toBe("op-create");
    expect(outcome.identity.action).toBe("create_event");
    expect(outcome.identity.body).toMatchObject({ eventId: "show-1" });
    expect(journey.state().halted?.identity).toEqual(outcome.identity);
    const before = seen.length;
    const next = await journey.prepareTrade({ operationId: "op-prepare-new", tradeId: "trade-1", buyer: "buyer-a" });
    expect(next.kind).toBe("FENCED");
    expect(seen).toHaveLength(before);
    expect(seen.some((operationId) => operationId === "op-prepare-new")).toBe(false);
    if (kind === "timeout") {
      expect(outcome.code).toBe("REQUEST_TIMEOUT");
    }
    if (kind === "stale") {
      expect(outcome.code).toBe("STALE_RESPONSE");
    }
    if (kind === "wrong-operation" || kind === "extra-keys") {
      expect(outcome.code).toBe("GATE_STATUS");
    }
    if (kind === "bad-result") {
      expect(outcome.code).toBe("INVALID_RECEIPT");
    }
    if (kind !== "bad-result") {
      expect(outcome.identity.requestId).toEqual(expect.any(String));
      expect(outcome.identity.correlationId).toEqual(expect.any(String));
    }
  });

  it("halts on a pre-send failure and does not call the invoker", async () => {
    const seen: LocalCallInput[] = [];
    const journey = new BookingJourney(scriptedInvoker(seen));
    await expect(journey.createEvent({ ...createInput(), operationId: "" })).rejects.toThrow(/operationId/);
    expect(seen).toHaveLength(0);
    expect(journey.state().halted).toMatchObject({
      kind: "NOT_SENT",
      step: "create_event",
      identity: { operationId: "", action: "create_event", actor: "operator" },
    });
    expect(journey.state().halted?.identity.requestId).toBeUndefined();
    const next = await journey.prepareTrade({ operationId: "op-prepare", tradeId: "trade-1", buyer: "buyer-a" });
    expect(next.kind).toBe("FENCED");
    expect(seen).toHaveLength(0);
  });
});

describe("booking journey boundary injection", () => {
  it.each(["create_event", "prepare_trade", "accept_trade"] as const)(
    "records one %s effect and then loses the response",
    async (dropAction) => {
      const applied: string[] = [];
      const base = await listen(async (req, res) => {
        const envelope = JSON.parse(await readRequest(req)) as {
          operationId: string;
          action: string;
          body: Record<string, unknown>;
        };
        expect(req.headers["idempotency-key"]).toBeUndefined();
        if (envelope.action === dropAction) {
          applied.push(envelope.operationId);
          res.writeHead(200, { ...gateHeaders(req), "content-length": "400" });
          res.write('{"domain":');
          setTimeout(() => res.socket?.destroy(), 20);
          return;
        }
        applied.push(envelope.operationId);
        const payload = JSON.stringify(
          localCallReceipt(envelope.operationId, envelope.action, successResult(envelope.action, envelope.body)),
        );
        res.writeHead(200, gateHeaders(req));
        res.end(payload);
      });
      const journey = new BookingJourney(new HttpProtocolAdapter(base, fetch, { timeoutMs: 2000 }));
      if (dropAction === "create_event") {
        const outcome = await journey.createEvent(createInput());
        expect(outcome).toMatchObject({ kind: "UNKNOWN", code: "GATE_UNAVAILABLE" });
        expect(applied).toEqual(["op-create"]);
        await journey.prepareTrade({ operationId: "op-prepare", tradeId: "trade-1", buyer: "buyer-a" });
        expect(applied).toEqual(["op-create"]);
        return;
      }
      await journey.createEvent(createInput());
      if (dropAction === "prepare_trade") {
        const outcome = await journey.prepareTrade({ operationId: "op-prepare", tradeId: "trade-1", buyer: "buyer-a" });
        expect(outcome).toMatchObject({ kind: "UNKNOWN" });
        expect(applied).toEqual(["op-create", "op-prepare"]);
        await journey.acceptTrade({ operationId: "op-accept" });
        expect(applied).toEqual(["op-create", "op-prepare"]);
        return;
      }
      await journey.createEvent(createInput());
      await journey.prepareTrade({ operationId: "op-prepare", tradeId: "trade-1", buyer: "buyer-a" });
      const outcome = await journey.acceptTrade({ operationId: "op-accept" });
      expect(outcome).toMatchObject({ kind: "UNKNOWN" });
      expect(applied).toEqual(["op-create", "op-prepare", "op-accept"]);
      await journey.acceptTrade({ operationId: "op-accept-2" });
      expect(applied).toEqual(["op-create", "op-prepare", "op-accept"]);
    },
  );

  it("does not apply an effect for a pre-send failure or an HTTP 422", async () => {
    const seen: string[] = [];
    const base = await listen(async (req, res) => {
      const envelope = JSON.parse(await readRequest(req)) as { action: string };
      seen.push(envelope.action);
      res.writeHead(422, gateHeaders(req));
      res.end(JSON.stringify({ error: "EVENT_EXISTS", rejected: true }));
    });
    const rejected = new BookingJourney(new HttpProtocolAdapter(base));
    const outcome = await rejected.createEvent(createInput());
    expect(outcome).toMatchObject({ kind: "REJECTED", code: "EVENT_EXISTS" });
    await rejected.prepareTrade({ operationId: "op-prepare", tradeId: "trade-1", buyer: "buyer-a" });
    expect(seen).toEqual(["create_event"]);

    const preSendSeen: LocalCallInput[] = [];
    const preSend = new BookingJourney(scriptedInvoker(preSendSeen));
    await expect(preSend.createEvent({ ...createInput(), seats: [] })).rejects.toThrow(/seats/);
    expect(preSendSeen).toHaveLength(0);
    expect((await preSend.prepareTrade({ operationId: "op-prepare", tradeId: "trade-1", buyer: "buyer-a" })).kind).toBe(
      "FENCED",
    );
    expect(preSendSeen).toHaveLength(0);
  });
});

describe("payload guards against catalogue receipts", () => {
  const domain = PINNED_PROTOCOL_DOMAIN;

  const accepted: Array<[string, string, Record<string, unknown>, Record<string, unknown>]> = [
    [
      "create_event",
      "operator",
      { domain, eventId: "show", organizer: "organizer", policy: SHOW_POLICY, seats: ["A1"] },
      { eventId: "show", policyHash: "policy-hash", inventoryIds: ["inv-0"], reservationSeconds: 900 },
    ],
    [
      "prepare_trade",
      "buyer",
      {
        domain,
        tradeId: "trade-1",
        inventoryId: "inv-0",
        amount: 100000,
        buyer: "buyer-a",
        expectedInventoryVersion: 0,
        expectedVersion: 0,
      },
      {
        tradeId: "trade-1",
        ticketId: "ticket-1",
        externalOrderId: "order-1",
        status: "PREPARED",
        termsHash: "terms-hash",
      },
    ],
    ["accept_trade", "buyer", { domain, tradeId: "trade-1", termsHash: "terms-hash" }, { accepted: true }],
    [
      "capture",
      "pg-adapter",
      {
        domain,
        tradeId: "trade-1",
        orderId: "order-1",
        paymentId: "pay-1",
        amount: 100000,
        currency: "KRW",
        buyer: "buyer-a",
        scope: REFERENCE_FIXTURE_SCOPE,
        provenance: "synthetic",
      },
      { captured: true, cashAvailable: false },
    ],
    [
      "settle_capture",
      "pg-adapter",
      {
        domain,
        tradeId: "trade-1",
        paymentId: "pay-1",
        currency: "KRW",
        amount: 100000,
        feeAmount: 0,
        taxAmount: 0,
        heldAmount: 0,
        adjustmentAmount: 0,
        grossAmount: 100000,
        feeBearer: "platform",
        contractRef: "fixture:settlement:v1",
        movementId: "mov-1",
        provenance: "synthetic",
        scope: REFERENCE_FIXTURE_SCOPE,
      },
      { settled: 100000, grossAccounted: 100000, feeBearer: "platform" },
    ],
    ["commit_trade", "operator", { domain, tradeId: "trade-1" }, {
      ticketId: "ticket-1",
      owner: "buyer-a",
      rightsVersion: 1,
      admissionEpoch: 1,
    }],
    ["open_admission", "operator", { domain, eventId: "show" }, { admissionStatus: "OPEN" }],
    [
      "admit",
      "venue",
      { domain, ticketId: "ticket-1", holder: "buyer-a", expectedVersion: 1, admissionEpoch: 1 },
      { admissionId: "adm-1", decision: "ADMITTED_ONCE" },
    ],
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
    await expect(
      adapter.invokeLocalCall({ operationId: "op-guard", actor, action, body }),
    ).resolves.toMatchObject({ action, result });
  });

  it("still rejects nested payment, mode, and listing amount claims", async () => {
    const rejected: Array<[Record<string, unknown>, RegExp]> = [
      [{ booking: { bookingId: "b", payment: "card-captured" } }, /simulated-no-funds/],
      [{ settlement: { eventId: "e", mode: "live", references: ["F01", "F02", "F03"], note: "n" } }, /mock mode/],
      [{ receipt: { listingId: "l", amount: 1, currency: "KRW" } }, /amount or a fee split/],
    ];
    for (const [result, message] of rejected) {
      const adapter = new HttpProtocolAdapter(
        "http://127.0.0.1:8765",
        async (_input, init) =>
          new Response(JSON.stringify(localCallReceipt("op-guard", "close_sales", result)), {
            status: 200,
            headers: echoIntegrationGateHeaders(init),
          }),
      );
      await expect(
        adapter.invokeLocalCall({
          operationId: "op-guard",
          actor: "operator",
          action: "close_sales",
          body: { domain: PINNED_PROTOCOL_DOMAIN, eventId: "show" },
        }),
      ).rejects.toThrow(message);
    }
  });
});

type FaultKind = "timeout" | "cutoff" | "closed-port" | "stale" | "wrong-operation" | "extra-keys" | "bad-result";

async function journeyForFault(kind: FaultKind, seen: string[]): Promise<BookingJourney> {
  if (kind === "closed-port") {
    const fetchImpl: typeof fetch = async (input, init) => {
      seen.push("sent");
      return fetch(input, init);
    };
    return new BookingJourney(new HttpProtocolAdapter("http://127.0.0.1:1", fetchImpl));
  }
  if (kind === "stale" || kind === "wrong-operation" || kind === "extra-keys" || kind === "bad-result") {
    const fetchImpl: typeof fetch = async (_input, init) => {
      seen.push("op-create");
      const headers =
        kind === "stale"
          ? echoIntegrationGateHeaders(init, { "x-correlation-id": "not-this-request" })
          : echoIntegrationGateHeaders(init);
      const good = {
        eventId: "show-1",
        policyHash: "policy-hash",
        inventoryIds: ["inv-0"],
        reservationSeconds: 900,
      };
      let body: unknown = localCallReceipt("op-create", "create_event", good);
      if (kind === "wrong-operation") {
        body = localCallReceipt("op-other", "create_event", good);
      }
      if (kind === "extra-keys") {
        body = { ...localCallReceipt("op-create", "create_event", good), extra: true };
      }
      if (kind === "bad-result") {
        body = localCallReceipt("op-create", "create_event", { ...good, extra: true });
      }
      return new Response(JSON.stringify(body), { status: 200, headers });
    };
    return new BookingJourney(new HttpProtocolAdapter("http://127.0.0.1:8765", fetchImpl));
  }
  const base = await listen((req, res) => {
    seen.push("op-create");
    if (kind === "timeout") {
      return;
    }
    res.writeHead(200, { ...gateHeaders(req), "content-length": "400" });
    res.write('{"domain":');
    setTimeout(() => res.socket?.destroy(), 20);
  });
  const timeoutMs = kind === "timeout" ? 150 : 2000;
  return new BookingJourney(new HttpProtocolAdapter(base, fetch, { timeoutMs }));
}
