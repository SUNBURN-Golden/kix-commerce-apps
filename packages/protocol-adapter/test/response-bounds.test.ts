import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingJourney, type LocalCallInvoker } from "../src/booking-journey.js";
import { MAX_GATE_RESPONSE_BYTES, readGateResponseText } from "../src/gate-json.js";
import { GateRejectedError, HttpProtocolAdapter, echoIntegrationGateHeaders } from "../src/http-adapter.js";
import { PINNED_ACTIONS, PINNED_PROTOCOL_DOMAIN } from "../src/openapi-contract-pin.js";
import { createSdk0MockScenario } from "../src/sdk0-mock-scenarios.js";
import { ProtocolError } from "../src/types.js";
import { createComposerFixtures, runComposerTarget, type ComposerAction } from "./support/composer-loopback-fixtures.js";
import { createFakeLoopbackGate, type FakeLoopbackGate } from "./support/fake-loopback-gate.js";

const encoder = new TextEncoder();
const limit = MAX_GATE_RESPONSE_BYTES;
// MiB-scale streamed bodies can outlast the default 5 s timeout on a loaded worker.
const HEAVY_MS = 30_000;
function success(action: "create_event" | "prepare_trade") {
  const fixture = createSdk0MockScenario({ fixtureId: `booking-journey.${action}.success`, seed: 7 });
  if (fixture.klass !== "SUCCESS") throw new Error("Expected successful SDK0 fixture");
  return fixture;
}
const fixture = success("create_event");
const composerFixtures = await createComposerFixtures(7);
const rawReceipt = JSON.stringify(fixture.receipt);
const pad = (text: string, size: number) => text + " ".repeat(size - encoder.encode(text).byteLength);
function nested(depth: number): string { return "[".repeat(depth) + "0" + "]".repeat(depth); }

type End = "eof" | "error" | "stall";
function streamed(chunks: Uint8Array[], end: End = "eof", cancellation: "resolve" | "reject" | "hang" = "resolve") {
  const stats = { pulls: 0, cancels: 0 };
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      stats.pulls++;
      if (index < chunks.length) controller.enqueue(chunks[index++]);
      else if (end === "eof") controller.close();
      else if (end === "error") controller.error(new Error("interrupted stream"));
    },
    cancel() {
      stats.cancels++;
      if (cancellation === "reject") return Promise.reject(new Error("cancel rejected"));
      if (cancellation === "hang") return new Promise<void>(() => undefined);
    },
  }, { highWaterMark: 0 }); // No producer prefetch: assertions count requested chunks.
  return { body, stats };
}
function chunksFor(text: string, multiple: boolean) {
  const bytes = encoder.encode(text);
  return multiple ? [bytes.subarray(0, 17), bytes.subarray(17, bytes.length - 1), bytes.subarray(bytes.length - 1)] : [bytes];
}
function traceFor(gate: FakeLoopbackGate) {
  return { requestId: gate.calls[0].requestId, correlationId: gate.calls[0].correlationId };
}
function assertOneFetch(gate: FakeLoopbackGate) {
  expect(gate.calls).toHaveLength(1);
  expect(gate.calls[0]).toMatchObject({ redirect: "manual", idempotencyKey: false });
  expect(gate.calls[0].requestId).toEqual(expect.any(String));
  expect(gate.calls[0].correlationId).toEqual(expect.any(String));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  try { expect(vi.getTimerCount()).toBe(0); }
  finally { vi.useRealTimers(); vi.restoreAllMocks(); }
});

describe("actual response bytes independently of Content-Length", () => {
  it("uses the documented 1 MiB client limit", () => expect(limit).toBe(1_048_576));
  for (const advertised of [undefined, "0", "1", "999999999", "malformed"]) {
    for (const multiple of [false, true]) {
      for (const size of [limit - 1, limit, limit + 1]) {
        it(`${size} bytes, length=${advertised}, ${multiple ? "multiple chunks" : "one chunk"}`, async () => {
          const chunks = chunksFor(pad(rawReceipt, size), multiple);
          const source = streamed([...chunks, encoder.encode("never consumed")]);
          // Valid bodies must actually reach EOF; overflow must not ask for more.
          const accepted = size <= limit;
          const validSource = accepted ? streamed(chunks) : source;
          const gate = createFakeLoopbackGate({ scenario: fixture, streamBody: () => validSource.body,
            answer: (base) => ({ ...base, headers: { ...base.headers,
              ...(advertised === undefined ? {} : { "content-length": advertised }) } }) });
          const result = new HttpProtocolAdapter(gate.baseUrl, gate.fetch).invokeLocalCall(fixture.envelope);
          if (accepted) {
            await expect(result).resolves.toEqual(fixture.receipt);
            expect(validSource.stats).toEqual({ pulls: chunks.length + 1, cancels: 0 });
          } else {
            const error: unknown = await result.catch((error: unknown) => error);
            expect(error).toBeInstanceOf(ProtocolError);
            expect(error).not.toBeInstanceOf(GateRejectedError);
            expect(error).toMatchObject({ code: "GATE_STATUS", ...traceFor(gate) });
            expect(source.stats).toEqual({ pulls: chunks.length, cancels: 1 });
          }
          expect(validSource.body.locked).toBe(false);
          assertOneFetch(gate);
        }, HEAVY_MS);
      }
    }
  }

  it("handles many tiny chunks without per-chunk retention", async () => {
    const chunks = Array.from(encoder.encode(rawReceipt), (byte) => new Uint8Array([byte]));
    const source = streamed(chunks);
    const gate = createFakeLoopbackGate({ scenario: fixture, streamBody: () => source.body });
    await expect(new HttpProtocolAdapter(gate.baseUrl, gate.fetch).invokeLocalCall(fixture.envelope)).resolves.toEqual(fixture.receipt);
    expect(source.stats.pulls).toBe(chunks.length + 1);
  }, HEAVY_MS);

  it("waits for EOF at the exact limit and refuses a later extra byte", async () => {
    const source = streamed([encoder.encode(pad(rawReceipt, limit)), encoder.encode(" "), encoder.encode("unused")]);
    const gate = createFakeLoopbackGate({ scenario: fixture, streamBody: () => source.body });
    await expect(new HttpProtocolAdapter(gate.baseUrl, gate.fetch).invokeLocalCall(fixture.envelope)).rejects.toMatchObject({ code: "GATE_STATUS" });
    expect(source.stats).toEqual({ pulls: 2, cancels: 1 });
    assertOneFetch(gate);
  }, HEAVY_MS);

  it.each(["reject", "hang"] as const)("does not await or replace overflow when cancellation will %s", async (cancellation) => {
    const source = streamed([new Uint8Array(limit + 1)], "eof", cancellation);
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, "addEventListener");
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    await expect(readGateResponseText(new Response(source.body), controller.signal)).rejects.toMatchObject({ code: "GATE_STATUS" });
    expect(controller.signal.aborted).toBe(false);
    expect(source.body.locked).toBe(false);
    expect(source.stats.cancels).toBe(1);
    expect(remove.mock.calls[0]).toEqual(add.mock.calls[0].slice(0, 2));
  }, HEAVY_MS);
});

it("joins Korean and supplementary UTF-8 at every byte split and counts bytes rather than characters", async () => {
  const receipt = structuredClone(fixture.receipt);
  receipt.result.policyHash = "한글😀";
  const text = JSON.stringify(receipt);
  const bytes = encoder.encode(text);
  const offset = encoder.encode(text.slice(0, text.indexOf("한"))).byteLength;
  const unicodeLength = encoder.encode("한글😀").byteLength;
  for (let split = offset + 1; split < offset + unicodeLength; split++) {
    const source = streamed([bytes.subarray(0, split), bytes.subarray(split)]);
    const gate = createFakeLoopbackGate({ scenario: fixture, streamBody: () => source.body });
    await expect(new HttpProtocolAdapter(gate.baseUrl, gate.fetch).invokeLocalCall(fixture.envelope)).resolves.toEqual(receipt);
    assertOneFetch(gate);
  }
  for (const size of [limit, limit + 1]) {
    const padded = pad(text, size);
    expect(padded.length).toBeLessThan(limit);
    const source = streamed(chunksFor(padded, true));
    const gate = createFakeLoopbackGate({ scenario: fixture, streamBody: () => source.body,
      answer: (base) => ({ ...base, headers: { ...base.headers, "content-length": String(padded.length) } }) });
    const result = new HttpProtocolAdapter(gate.baseUrl, gate.fetch).invokeLocalCall(fixture.envelope);
    if (size === limit) await expect(result).resolves.toEqual(receipt);
    else await expect(result).rejects.toMatchObject({ code: "GATE_STATUS", ...traceFor(gate) });
    expect(source.stats.cancels).toBe(size > limit ? 1 : 0);
  }
}, HEAVY_MS);

const invalidCases = [
  { name: "oversized success", status: 200, kind: "bytes", code: "GATE_STATUS" },
  { name: "oversized 400 rejection", status: 400, kind: "bytes", code: "GATE_STATUS" },
  { name: "oversized 422 rejection", status: 422, kind: "bytes", code: "GATE_STATUS" },
  { name: "deep success", status: 200, kind: "depth", code: "GATE_STATUS" },
  { name: "deep 400 rejection", status: 400, kind: "depth", code: "GATE_STATUS" },
  { name: "deep 422 rejection", status: 422, kind: "depth", code: "GATE_STATUS" },
  { name: "interrupted success", status: 200, kind: "error", code: "GATE_UNAVAILABLE" },
  { name: "interrupted 422 rejection", status: 422, kind: "error", code: "GATE_UNAVAILABLE" },
  { name: "stalled success", status: 200, kind: "stall", code: "REQUEST_TIMEOUT" },
  { name: "stalled 422 rejection", status: 422, kind: "stall", code: "REQUEST_TIMEOUT" },
] as const;
function invalidSource(kind: typeof invalidCases[number]["kind"]) {
  const rejection = '{"rejected":true,"error":"INVALID"}';
  const text = kind === "bytes" ? pad(rejection, limit + 1)
    : kind === "depth" ? `{"rejected":true,"error":"INVALID","nested":${nested(32)}}` : rejection;
  return streamed(chunksFor(text, true), kind === "error" || kind === "stall" ? kind : "eof");
}

async function runJourneyTarget(invoker: LocalCallInvoker) {
  const journey = new BookingJourney(invoker);
  const create = success("create_event").envelope;
  const prepare = success("prepare_trade").envelope;
  expect((await journey.createEvent({ operationId: create.operationId, eventId: create.body.eventId as string,
    organizer: create.body.organizer as string, policy: create.body.policy as { primaryPrice: number }, seats: create.body.seats as string[] })).kind).toBe("RECEIPT");
  const outcome = await journey.prepareTrade({ operationId: prepare.operationId, tradeId: prepare.body.tradeId as string, buyer: prepare.body.buyer as string });
  return { outcome, state: () => journey.state(), fence: () => journey.acceptTrade({ operationId: "never-sent" }) };
}

describe.each(["booking", "gift", "organizer", "consent"] as const)("%s UNKNOWN and subsequent fence", (composer) => {
  it.each(invalidCases)("$name preserves traces with one fetch and no fallback", async ({ status, kind, code }) => {
    const action = composer === "gift" ? "accept_gift" : composer === "consent" ? "authorize_marketing" : "close_sales";
    const target = composer === "booking" ? success("prepare_trade") : composerFixtures.find((item) => item.envelope.action === action)!;
    const source = invalidSource(kind);
    const gate = createFakeLoopbackGate({ scenario: target, streamBody: () => source.body, answer: (base) => ({ ...base, status }) });
    const adapter = new HttpProtocolAdapter(gate.baseUrl, gate.fetch, { timeoutMs: 50 });
    let thrown: unknown;
    const invoker: LocalCallInvoker = { invokeLocalCall: async (input) => {
      if (input.action !== target.envelope.action) {
        const prior = composer === "booking" ? success("create_event") : composerFixtures.find((item) => item.envelope.action === input.action)!;
        expect(input).toEqual(prior.envelope);
        return structuredClone(prior.receipt);
      }
      try { return await adapter.invokeLocalCall(input); }
      catch (error) { thrown = error; throw error; }
    } };
    const pending = composer === "booking" ? runJourneyTarget(invoker) : runComposerTarget(action as ComposerAction, 7, invoker);
    if (kind === "stall") await vi.advanceTimersByTimeAsync(50);
    const replay = await pending;
    expect(thrown).toBeInstanceOf(ProtocolError);
    expect(thrown).not.toBeInstanceOf(GateRejectedError);
    expect(thrown).toMatchObject({ code, ...traceFor(gate) });
    expect(replay.outcome).toMatchObject({ kind: "UNKNOWN", code, identity: { ...target.envelope, ...traceFor(gate) } });
    expect(replay.state().halted).toMatchObject({ kind: "UNKNOWN", identity: traceFor(gate) });
    expect(await replay.fence()).toMatchObject({ kind: "FENCED", blockedBy: { reason: "halted" } });
    expect(source.stats.cancels).toBe(kind === "bytes" || kind === "stall" ? 1 : 0);
    expect(source.body.locked).toBe(false);
    assertOneFetch(gate);
  }, HEAVY_MS);
});

it.each([400, 422])("still recognizes a valid explicit rejection at exactly the byte limit (%i)", async (status) => {
  const source = streamed(chunksFor(pad('{"rejected":true,"error":"INVALID"}', limit), true));
  const gate = createFakeLoopbackGate({ scenario: fixture, streamBody: () => source.body, answer: (base) => ({ ...base, status }) });
  await expect(new HttpProtocolAdapter(gate.baseUrl, gate.fetch).invokeLocalCall(fixture.envelope)).rejects.toBeInstanceOf(GateRejectedError);
  expect(source.stats.cancels).toBe(0);
  assertOneFetch(gate);
}, HEAVY_MS);

it.each(["redirect", "trace", "transport", "production"] as const)("checks %s before consuming or parsing the body", async (kind) => {
  const source = streamed([new Uint8Array(limit + 1)]);
  const gate = createFakeLoopbackGate({ scenario: fixture, streamBody: () => source.body, answer: (base) => ({ ...base,
    status: kind === "redirect" ? 307 : 200, headers: { ...base.headers,
      ...(kind === "trace" ? { "x-request-id": "wrong" } : kind === "transport" ? { "x-kix-transport": "wrong" }
        : kind === "production" ? { "x-kix-protocol-truth": "true" } : {}) } }) });
  await expect(new HttpProtocolAdapter(gate.baseUrl, gate.fetch).invokeLocalCall(fixture.envelope)).rejects.toMatchObject({
    code: kind === "trace" ? "STALE_RESPONSE" : kind === "production" ? "PRODUCTION_ENDPOINT" : "GATE_TRANSPORT",
  });
  expect(source.stats.pulls).toBe(0);
  expect(source.body.locked).toBe(false);
}, HEAVY_MS);

it.each([false, true])("times out a fetch ignoring abort; late resolution=%s cannot consume or parse", async (late) => {
  let resolve!: (response: Response) => void;
  let sent: RequestInit | undefined;
  const fetchDouble = vi.fn<typeof fetch>((_url, init) => { sent = init; return new Promise<Response>((done) => { resolve = done; }); });
  const result = new HttpProtocolAdapter("http://127.0.0.1:8765", fetchDouble, { timeoutMs: 50 }).invokeLocalCall(fixture.envelope);
  const assertion = expect(result).rejects.toMatchObject({ code: "REQUEST_TIMEOUT",
    requestId: new Headers(sent?.headers).get("x-request-id"), correlationId: new Headers(sent?.headers).get("x-correlation-id") });
  await vi.advanceTimersByTimeAsync(50);
  await assertion;
  if (late) {
    const source = streamed([encoder.encode(rawReceipt)]);
    const parser = vi.spyOn(JSON, "parse");
    resolve(new Response(source.body, { headers: echoIntegrationGateHeaders(sent) }));
    await vi.advanceTimersByTimeAsync(0);
    expect(source.stats).toEqual({ pulls: 0, cancels: 1 });
    expect(source.body.locked).toBe(false);
    expect(parser).not.toHaveBeenCalled();
  }
  expect(fetchDouble).toHaveBeenCalledOnce();
});

it("times out while waiting for EOF at exactly the limit and cleans up even if cancel hangs", async () => {
  const source = streamed([encoder.encode(pad(rawReceipt, limit))], "stall", "hang");
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  const result = readGateResponseText(new Response(source.body), controller.signal);
  const assertion = expect(result).rejects.toThrow("timeout");
  // Let the reader consume the prefix and block on the next pull.
  await vi.advanceTimersByTimeAsync(0);
  controller.abort(new Error("timeout"));
  await assertion;
  expect(source.stats).toEqual({ pulls: 2, cancels: 1 });
  expect(source.body.locked).toBe(false);
  expect(remove).toHaveBeenCalledOnce();
}, HEAVY_MS);

describe.each(["health", "ready"] as const)("/%s response guards", (probe) => {
  for (const kind of ["exact", "bytes", "depth", "error", "stall"] as const) {
    it(kind, async () => {
      const body = { status: probe === "health" ? "up" : "ready", liveHttpServer: "non-production-local-integration",
        role: "integration-gate", production: false, publicHost: false, productionReadiness: false,
        productionConformance: false, protocolTruth: false, localFileJournal: false,
        ...(probe === "ready" ? { liveMoney: false, durable: false, commandCount: PINNED_ACTIONS.length, domain: PINNED_PROTOCOL_DOMAIN } : {}) };
      const source = kind === "exact" ? streamed(chunksFor(pad(JSON.stringify(body), limit), true)) : invalidSource(kind);
      let sent: RequestInit | undefined;
      const fetchDouble = vi.fn<typeof fetch>(async (url, init) => {
        expect(String(url)).toBe(`http://127.0.0.1:8765/${probe}`);
        sent = init;
        expect(init?.method).toBe("GET");
        expect(init?.redirect).toBe("manual");
        expect(new Headers(init?.headers).has("idempotency-key")).toBe(false);
        return new Response(source.body, { headers: echoIntegrationGateHeaders(init, { "content-length": "0" }) });
      });
      const adapter = new HttpProtocolAdapter("http://127.0.0.1:8765", fetchDouble, { timeoutMs: 50 });
      const result = probe === "health" ? adapter.readGateHealth() : adapter.readGateReady();
      const assertion = kind === "exact" ? expect(result).resolves.toEqual(body) : expect(result).rejects.toMatchObject({
        code: kind === "error" ? "GATE_UNAVAILABLE" : kind === "stall" ? "REQUEST_TIMEOUT" : "GATE_STATUS",
        requestId: new Headers(sent?.headers).get("x-request-id"), correlationId: new Headers(sent?.headers).get("x-correlation-id"),
      });
      if (kind === "stall") await vi.advanceTimersByTimeAsync(50);
      await assertion;
      expect(source.stats.cancels).toBe(kind === "bytes" || kind === "stall" ? 1 : 0);
      expect(source.body.locked).toBe(false);
      expect(fetchDouble).toHaveBeenCalledOnce();
    }, HEAVY_MS);
  }
});

it("does not parse even a complete JSON prefix until stream EOF", async () => {
  const source = streamed([encoder.encode(rawReceipt)], "stall");
  const gate = createFakeLoopbackGate({ scenario: fixture, streamBody: () => source.body });
  const result = new HttpProtocolAdapter(gate.baseUrl, gate.fetch, { timeoutMs: 50 }).invokeLocalCall(fixture.envelope);
  const assertion = expect(result).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" });
  await vi.advanceTimersByTimeAsync(0);
  const parser = vi.spyOn(JSON, "parse");
  await vi.advanceTimersByTimeAsync(50);
  await assertion;
  expect(parser).not.toHaveBeenCalled();
  expect(source.stats.cancels).toBe(1);
});
