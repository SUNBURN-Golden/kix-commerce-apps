import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  HttpProtocolAdapter,
  INTEGRATION_HTTP_TIMEOUT_MS,
  OPENAPI_INTEGRATION_GATE_PIN,
  PINNED_PROTOCOL_DOMAIN,
  createProtocol,
  echoIntegrationGateHeaders,
} from "../src/index.js";
import { localCallReceipt } from "./support/receipt.js";

const CLOSE_SALES = {
  operationId: "op-close",
  actor: "fixture-actor",
  action: "close_sales" as const,
  body: { domain: PINNED_PROTOCOL_DOMAIN, eventId: "evt_lanterns" },
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

function answering(body: unknown): typeof fetch {
  return async (_input, init) =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status: 200,
      headers: echoIntegrationGateHeaders(init),
    });
}

describe("integration HTTP redirects", () => {
  it("does not follow a redirect off the loopback origin", async () => {
    let elsewhere = 0;
    const target = await listen((req, res) => {
      elsewhere += 1;
      res.writeHead(200, gateHeaders(req));
      res.end(JSON.stringify(localCallReceipt("op-close", "close_sales", {})));
    });
    const redirecting = await listen((_req, res) => {
      res.writeHead(307, { location: `${target.replace("127.0.0.1", "localhost")}/elsewhere` });
      res.end();
    });
    const adapter = new HttpProtocolAdapter(redirecting);
    await expect(adapter.invokeLocalCall(CLOSE_SALES)).rejects.toMatchObject({ code: "GATE_TRANSPORT" });
    expect(elsewhere).toBe(0);
  });

  it("refuses a redirect status or a response from another origin", async () => {
    const status: typeof fetch = async (_input, init) =>
      new Response(null, { status: 307, headers: { ...echoIntegrationGateHeaders(init), location: "http://localhost:1/" } });
    await expect(new HttpProtocolAdapter("http://127.0.0.1:8765", status).invokeLocalCall(CLOSE_SALES)).rejects.toMatchObject({
      code: "GATE_TRANSPORT",
    });

    const moved: typeof fetch = async (_input, init) => {
      const response = new Response(JSON.stringify(localCallReceipt("op-close", "close_sales", {})), {
        status: 200,
        headers: echoIntegrationGateHeaders(init),
      });
      Object.defineProperty(response, "url", { value: "http://localhost:8765/x-kix-contract-only/local-call" });
      return response;
    };
    await expect(new HttpProtocolAdapter("http://127.0.0.1:8765", moved).invokeLocalCall(CLOSE_SALES)).rejects.toMatchObject({
      code: "GATE_TRANSPORT",
    });

    const followed: typeof fetch = async (_input, init) => {
      const response = new Response(JSON.stringify(localCallReceipt("op-close", "close_sales", {})), {
        status: 200,
        headers: echoIntegrationGateHeaders(init),
      });
      Object.defineProperty(response, "redirected", { value: true });
      return response;
    };
    await expect(new HttpProtocolAdapter("http://127.0.0.1:8765", followed).invokeLocalCall(CLOSE_SALES)).rejects.toMatchObject({
      code: "GATE_TRANSPORT",
    });
  });

  it("asks fetch not to follow redirects", async () => {
    const seen: RequestInit[] = [];
    const recording: typeof fetch = async (_input, init) => {
      seen.push(init ?? {});
      return new Response(JSON.stringify(localCallReceipt("op-close", "close_sales", {})), {
        status: 200,
        headers: echoIntegrationGateHeaders(init),
      });
    };
    await new HttpProtocolAdapter("http://127.0.0.1:8765", recording).invokeLocalCall(CLOSE_SALES);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.redirect).toBe("manual");
    expect(seen[0]?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("integration HTTP timeouts", () => {
  it("defaults to twice the pinned gate timeout", () => {
    expect(INTEGRATION_HTTP_TIMEOUT_MS).toBe(OPENAPI_INTEGRATION_GATE_PIN.requestTimeoutSeconds * 2000);
    for (const timeoutMs of [0, -1, 1.5, 2_147_483_648]) {
      expect(() => new HttpProtocolAdapter("http://127.0.0.1:8765", fetch, { timeoutMs })).toThrow(/positive integer/);
    }
    expect(() => new HttpProtocolAdapter("http://127.0.0.1:8765", fetch, { timeoutMs: 2_147_483_647 })).not.toThrow();
  });

  it("times out a gate that accepts the connection and never answers, once", async () => {
    let requests = 0;
    const base = await listen(() => {
      requests += 1;
    });
    const adapter = new HttpProtocolAdapter(base, fetch, { timeoutMs: 150 });
    await expect(adapter.invokeLocalCall(CLOSE_SALES)).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" });
    expect(requests).toBe(1);
    const observed = await adapter.observeTransport();
    expect(observed).toMatchObject({ state: "unavailable", code: "REQUEST_TIMEOUT", fallbackToStub: false, retry: false });
  });

  it("times out a fetch that ignores the abort signal", async () => {
    const hanging: typeof fetch = () => new Promise<Response>(() => undefined);
    const adapter = new HttpProtocolAdapter("http://127.0.0.1:8765", hanging, { timeoutMs: 50 });
    await expect(adapter.readGateHealth()).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" });
  });

  it("maps a body cut off mid-stream to a ProtocolError", async () => {
    const base = await listen((req, res) => {
      res.writeHead(200, { ...gateHeaders(req), "content-length": "400" });
      res.write('{"domain":');
      setTimeout(() => res.socket?.destroy(), 20);
    });
    const adapter = new HttpProtocolAdapter(base, fetch, { timeoutMs: 2000 });
    await expect(adapter.invokeLocalCall(CLOSE_SALES)).rejects.toMatchObject({ code: "GATE_UNAVAILABLE" });
  });
});

describe("integration HTTP success receipts", () => {
  it("rejects a success that is not exactly one published receipt", async () => {
    for (const body of ["", "[]", '"ok"', "{}"]) {
      const adapter = new HttpProtocolAdapter("http://127.0.0.1:8765", answering(body));
      await expect(adapter.invokeLocalCall(CLOSE_SALES)).rejects.toMatchObject({ code: "GATE_STATUS" });
    }

    const extraKey = new HttpProtocolAdapter(
      "http://127.0.0.1:8765",
      answering({ ...localCallReceipt("SOMEONE-ELSE", "settle_capture", {}), extra: 1 }),
    );
    await expect(extraKey.invokeLocalCall(CLOSE_SALES)).rejects.toMatchObject({ code: "GATE_STATUS" });

    const otherOperation = new HttpProtocolAdapter(
      "http://127.0.0.1:8765",
      answering(localCallReceipt("op-other", "close_sales", {})),
    );
    await expect(otherOperation.invokeLocalCall(CLOSE_SALES)).rejects.toThrow(/does not match the local call/);
    await expect(otherOperation.invokeLocalCall(CLOSE_SALES)).rejects.toMatchObject({
      code: "GATE_STATUS",
      requestId: expect.any(String),
      correlationId: expect.any(String),
    });

    const otherAction = new HttpProtocolAdapter(
      "http://127.0.0.1:8765",
      answering(localCallReceipt("op-close", "open_admission", {})),
    );
    await expect(otherAction.invokeLocalCall(CLOSE_SALES)).rejects.toThrow(/does not match the local call/);

    const good = new HttpProtocolAdapter(
      "http://127.0.0.1:8765",
      answering(localCallReceipt("op-close", "close_sales", { salesStatus: "CLOSED" })),
    );
    await expect(good.invokeLocalCall(CLOSE_SALES)).resolves.toEqual(
      localCallReceipt("op-close", "close_sales", { salesStatus: "CLOSED" }),
    );
  });

  it("checks nested payloads, not only the top level and result", async () => {
    const nested: Array<[Record<string, unknown>, RegExp]> = [
      [{ booking: { bookingId: "b", payment: "card-captured" } }, /simulated-no-funds/],
      [{ settlement: { eventId: "e", mode: "live", references: ["F01", "F02", "F03"], note: "n" } }, /mock mode/],
      [{ receipt: { listingId: "l", amount: 1, currency: "KRW" } }, /amount or a fee split/],
      [{ lines: [{ advanceId: "a", mode: "mock", provenance: "MOCK_CREDIT_F04_ONLY", fundsExecuted: true }] }, /executed funds/],
      [{ deep: { deeper: { reservationId: "r", mode: "mock", provenance: "MOCK_GATE_ONLY", economicFinalityClaimed: true } } }, /economic finality/],
    ];
    for (const [result, message] of nested) {
      const adapter = new HttpProtocolAdapter(
        "http://127.0.0.1:8765",
        answering(localCallReceipt("op-close", "close_sales", result)),
      );
      await expect(adapter.invokeLocalCall(CLOSE_SALES)).rejects.toThrow(message);
    }
  });

  it("refuses a payload nested past the walk limit", async () => {
    let deep: Record<string, unknown> = { leaf: true };
    for (let index = 0; index < 64; index += 1) {
      deep = { next: deep };
    }
    const adapter = new HttpProtocolAdapter(
      "http://127.0.0.1:8765",
      answering(localCallReceipt("op-close", "close_sales", deep)),
    );
    await expect(adapter.invokeLocalCall(CLOSE_SALES)).rejects.toThrow(/nested too deeply/);
  });
});

describe("integration HTTP default fetch", () => {
  it("calls the global fetch without the adapter as its receiver", async () => {
    const original = globalThis.fetch;
    let receiver: unknown = "unset";
    globalThis.fetch = async function (this: unknown, _input: RequestInfo | URL, init?: RequestInit) {
      receiver = this;
      return new Response(JSON.stringify(localCallReceipt("op-close", "close_sales", {})), {
        status: 200,
        headers: echoIntegrationGateHeaders(init),
      });
    } as typeof fetch;
    try {
      const adapter = new HttpProtocolAdapter("http://127.0.0.1:8765");
      await adapter.invokeLocalCall(CLOSE_SALES);
      expect(receiver === undefined || receiver === globalThis).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("integration HTTP base URL", () => {
  it("refuses port 0 and keeps a default port out", () => {
    expect(() => createProtocol({ mode: "http", baseUrl: "http://127.0.0.1:0" })).toThrow(/port 0/);
    expect(() => createProtocol({ mode: "http", baseUrl: "http://127.0.0.1:80" })).toThrow(/non-default port/);
  });
});
