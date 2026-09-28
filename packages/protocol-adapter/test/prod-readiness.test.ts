import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  HttpProtocolAdapter,
  INTEGRATION_HTTP_RETRY_POLICY,
  PINNED_PROTOCOL_DOMAIN,
  ProtocolError,
  StubProtocolAdapter,
  assertSingleAttempt,
  createProtocol,
  echoIntegrationGateHeaders,
  mapOperationalError,
  rejectRetryHeader,
} from "../src/index.js";
import { assertReviewedCheckout, protocolRoot, REVIEWED_GATE_RUNS, startGate, stopGate } from "./support/reviewed-gate.js";

const describeGate = REVIEWED_GATE_RUNS ? describe : describe.skip;

const TRACE_TOKEN = /^[A-Za-z0-9._:-]{1,64}$/;

function probe(status: "up" | "ready", extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status,
    role: "integration-gate",
    liveHttpServer: "non-production-local-integration",
    production: false,
    publicHost: false,
    productionReadiness: false,
    productionConformance: false,
    protocolTruth: false,
    localFileJournal: false,
    ...(status === "ready"
      ? { liveMoney: false, durable: false, commandCount: 40, domain: PINNED_PROTOCOL_DOMAIN }
      : {}),
    ...extra,
  };
}

describe("integration HTTP environment", () => {
  it("keeps stub as the default and refuses a public production mode", () => {
    const stub = createProtocol();
    expect(stub.describe()).toMatchObject({
      adapter: "stub",
      environment: "stub",
      publicDeploy: false,
      productionConformance: false,
      protocolTruth: false,
    });
    expect(createProtocol({ mode: "stub", baseUrl: "http://127.0.0.1:8765" }).describe().adapter).toBe("stub");
    const http = createProtocol({ mode: "integration-http", baseUrl: "http://127.0.0.1:8765" });
    expect(http.describe()).toMatchObject({
      adapter: "http",
      environment: "integration-http",
      publicDeploy: false,
      productionConformance: false,
      protocolTruth: false,
    });
    expect(createProtocol({ mode: "http", baseUrl: "http://127.0.0.1:8765" }).describe().environment).toBe(
      "integration-http",
    );
    for (const mode of ["production", "prod", "public", "prod-public", "live"]) {
      expect(() => createProtocol({ mode, baseUrl: "https://example.test" })).toThrow(ProtocolError);
      expect(() => createProtocol({ mode, baseUrl: "https://example.test" })).toThrow(/will not fall back to the stub/);
    }
    expect(() => createProtocol({ mode: "integration-http" })).toThrow(/does not fall back to the stub/);
  });

  it("maps operational failures without a retry or a stub fallback", () => {
    expect(INTEGRATION_HTTP_RETRY_POLICY).toMatchObject({
      maxAttempts: 1,
      automaticRetries: 0,
      retryNonIdempotent: false,
      httpIdempotencyKeyHeader: false,
    });
    expect(() => assertSingleAttempt(1)).not.toThrow();
    expect(() => assertSingleAttempt(2)).toThrow(/single attempt|sends each local call once/);
    expect(() => assertSingleAttempt(Number.POSITIVE_INFINITY)).toThrow(ProtocolError);
    expect(mapOperationalError("OVERLOADED")).toMatchObject({ state: "degraded", retry: false, fallbackToStub: false });
    expect(mapOperationalError("NOT_READY")).toMatchObject({ state: "degraded", retry: false, fallbackToStub: false });
    expect(mapOperationalError("GATE_UNAVAILABLE")).toMatchObject({
      state: "unavailable",
      retry: false,
      fallbackToStub: false,
    });
    expect(mapOperationalError("STALE_RESPONSE").retry).toBe(false);
    expect(mapOperationalError("OPERATION_ID_CONFLICT")).toMatchObject({
      state: "rejected",
      retry: false,
      fallbackToStub: false,
    });
    expect(() => rejectRetryHeader(new Headers({ "Idempotency-Key": "again" }))).toThrow(/RETRY_FORBIDDEN|Idempotency-Key/);
    const refused = (() => {
      try {
        rejectRetryHeader(new Headers({ "Idempotency-Key": "again" }));
      } catch (error) {
        return error;
      }
      return undefined;
    })();
    expect(refused).toMatchObject({ code: "RETRY_FORBIDDEN" });
  });

  it("does not fall back to the stub when the gate is down, and it does not retry", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      throw new Error("connect ECONNREFUSED");
    };
    const http = new HttpProtocolAdapter("http://127.0.0.1:1", fetchImpl);
    const status = await http.observeTransport();
    expect(status).toMatchObject({
      environment: "integration-http",
      state: "unavailable",
      code: "GATE_UNAVAILABLE",
      productionReadiness: false,
      productionConformance: false,
      protocolTruth: false,
      publicDeploy: false,
      durable: false,
      fallbackToStub: false,
      retry: false,
    });
    expect(http.describe().adapter).toBe("http");
    expect(calls).toBe(1);
    expect(status.detail).not.toMatch(/production-ready/i);
    const stub = new StubProtocolAdapter();
    expect((await stub.observeTransport()).environment).toBe("stub");
    expect((await stub.observeTransport()).state).toBe("local");
  });

  it("rejects a stale response and an idempotency-key retry without a second attempt", async () => {
    let calls = 0;
    const stale: typeof fetch = async (_input, init) => {
      calls += 1;
      return new Response(JSON.stringify(probe("up")), {
        status: 200,
        headers: echoIntegrationGateHeaders(init, { "x-request-id": "stale-other-request" }),
      });
    };
    const http = new HttpProtocolAdapter("http://127.0.0.1:8765", stale);
    await expect(http.readGateHealth()).rejects.toMatchObject({ code: "STALE_RESPONSE" });
    expect(calls).toBe(1);

    let keyed = 0;
    const keyedAdapter = new HttpProtocolAdapter("http://127.0.0.1:8765", async (_input, init) => {
      keyed += 1;
      const headers = new Headers(init?.headers);
      if (headers.has("Idempotency-Key")) {
        throw new Error("client forwarded Idempotency-Key");
      }
      return new Response(JSON.stringify({ error: "HIDDEN", rejected: true }), {
        status: 200,
        headers: echoIntegrationGateHeaders(init),
      });
    });
    await expect(
      keyedAdapter.invokeLocalCall({
        operationId: "op-once",
        actor: "operator",
        action: "advance_clock",
        body: { domain: PINNED_PROTOCOL_DOMAIN, now: 1 },
      }),
    ).rejects.toMatchObject({ code: "HIDDEN" });
    expect(keyed).toBe(1);
  });

  it("surfaces a degraded ready probe and refuses a production-readiness claim", async () => {
    let calls = 0;
    const degraded: typeof fetch = async (input, init) => {
      calls += 1;
      const url = String(input);
      if (url.endsWith("/health")) {
        return new Response(JSON.stringify(probe("up")), { status: 200, headers: echoIntegrationGateHeaders(init) });
      }
      return new Response(
        JSON.stringify({
          error: "NOT_READY",
          rejected: true,
          production: false,
          productionReadiness: false,
          productionConformance: false,
          protocolTruth: false,
          role: "integration-gate",
        }),
        { status: 503, headers: echoIntegrationGateHeaders(init) },
      );
    };
    const http = new HttpProtocolAdapter("http://127.0.0.1:8765", degraded);
    const status = await http.observeTransport();
    expect(status.state).toBe("degraded");
    expect(status.code).toBe("NOT_READY");
    expect(status.fallbackToStub).toBe(false);
    expect(status.retry).toBe(false);
    expect(status.environment).toBe("integration-http");
    expect(calls).toBe(2);
    expect(http.describe().adapter).toBe("http");

    const claiming: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        return new Response(JSON.stringify(probe("up")), { status: 200, headers: echoIntegrationGateHeaders(init) });
      }
      return new Response(JSON.stringify(probe("ready", { productionReadiness: true })), {
        status: 200,
        headers: echoIntegrationGateHeaders(init),
      });
    };
    const claimed = new HttpProtocolAdapter("http://127.0.0.1:8765", claiming);
    const refused = await claimed.observeTransport();
    expect(refused.state).toBe("unavailable");
    expect(refused.code).toBe("PRODUCTION_ENDPOINT");
    expect(refused.productionReadiness).toBe(false);
    expect(refused.detail).not.toMatch(/production-ready/i);

    const durableClaim: typeof fetch = async (input, init) => {
      if (String(input).endsWith("/health")) {
        return new Response(JSON.stringify(probe("up")), { status: 200, headers: echoIntegrationGateHeaders(init) });
      }
      return new Response(JSON.stringify(probe("ready", { durable: true })), {
        status: 200,
        headers: echoIntegrationGateHeaders(init),
      });
    };
    const durableStatus = await new HttpProtocolAdapter("http://127.0.0.1:8765", durableClaim).observeTransport();
    expect(durableStatus.state).toBe("unavailable");
    expect(durableStatus.durable).toBe(false);
    expect(durableStatus.productionReadiness).toBe(false);
  });
});

describeGate("loopback readiness journal", () => {
  const journalDir = mkdtempSync(path.join(tmpdir(), "kix-ig-journal-"));
  let baseUrl = "";
  let child: Awaited<ReturnType<typeof startGate>>["child"] | undefined;

  afterAll(async () => {
    await stopGate(child);
    rmSync(journalDir, { recursive: true, force: true });
  });

  it("replays one committed local call after restart and still denies production conformance", async () => {
    const root = protocolRoot();
    assertReviewedCheckout(root);
    const first = await startGate(root, ["--readiness-dir", journalDir]);
    baseUrl = first.baseUrl;
    child = first.child;
    const seen: { requestId: string | null; correlationId: string | null; idempotency: string | null; truth: string | null }[] =
      [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      const response = await fetch(input, init);
      seen.push({
        requestId: headers.get("x-request-id"),
        correlationId: headers.get("x-correlation-id"),
        idempotency: headers.get("idempotency-key"),
        truth: response.headers.get("x-kix-protocol-truth"),
      });
      expect(response.headers.get("x-request-id")).toBe(headers.get("x-request-id"));
      expect(response.headers.get("x-correlation-id")).toBe(headers.get("x-correlation-id"));
      expect(response.headers.get("x-kix-production-conformance")).toBe("false");
      expect(response.headers.get("x-kix-production-endpoint")).toBe("false");
      return response;
    };
    const http = new HttpProtocolAdapter(baseUrl, fetchImpl);
    const body = {
      domain: PINNED_PROTOCOL_DOMAIN,
      eventId: "show",
      organizer: "organizer",
      policy: {
        primaryPrice: 100000,
        resaleCap: 150000,
        primaryFeeBps: 500,
        resaleFeeBps: 300,
        resaleOrganizerBps: 200,
        resaleAllowed: true,
        refundProfile: "FULL_CHAIN_UNWIND_FIXTURE",
      },
      seats: ["A1"],
    };
    const created = await http.invokeLocalCall({
      operationId: "op-event",
      actor: "operator",
      action: "create_event",
      body,
    });
    expect(created).toMatchObject({ action: "create_event", operationId: "op-event", sequence: 1 });
    const ready = await http.readGateReady();
    expect(ready).toMatchObject({
      localFileJournal: true,
      durable: false,
      productionReadiness: false,
      productionConformance: false,
      protocolTruth: false,
      liveMoney: false,
    });
    expect(ready).toHaveProperty("journalRecords");
    await stopGate(child);
    child = undefined;

    const second = await startGate(root, ["--readiness-dir", journalDir]);
    baseUrl = second.baseUrl;
    child = second.child;
    const restarted = new HttpProtocolAdapter(baseUrl, fetchImpl);
    const replayed = await restarted.invokeLocalCall({
      operationId: "op-event",
      actor: "operator",
      action: "create_event",
      body,
    });
    expect(replayed).toEqual(created);
    await expect(
      restarted.invokeLocalCall({
        operationId: "op-event-2",
        actor: "operator",
        action: "create_event",
        body,
      }),
    ).rejects.toMatchObject({ code: "EVENT_EXISTS" });
    const observation = await restarted.observeTransport();
    expect(observation).toMatchObject({
      environment: "integration-http",
      state: "up",
      localFileJournal: true,
      durable: false,
      productionReadiness: false,
      productionConformance: false,
      protocolTruth: false,
      publicDeploy: false,
      fallbackToStub: false,
      retry: false,
    });
    expect(observation.detail).not.toMatch(/production-ready/i);
    expect(seen.length).toBeGreaterThan(0);
    for (const line of seen) {
      expect(line.requestId).toMatch(TRACE_TOKEN);
      expect(line.correlationId).toMatch(TRACE_TOKEN);
      expect(line.idempotency).toBeNull();
      expect(line.truth).toBe("false");
    }
  }, 30000);
});
