import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingJourney, type LocalCallInvoker } from "../src/booking-journey.js";
import { MAX_GATE_RESPONSE_BYTES, readGateResponseText } from "../src/gate-json.js";
import { GateRejectedError, HttpProtocolAdapter, echoIntegrationGateHeaders } from "../src/http-adapter.js";
import { PINNED_ACTIONS, PINNED_PROTOCOL_DOMAIN } from "../src/openapi-contract-pin.js";
import { createSdk0MockScenario } from "../src/sdk0-mock-scenarios.js";
import { ProtocolError } from "../src/types.js";
import { createComposerFixtures, runComposerTarget, type ComposerAction } from "./support/composer-loopback-fixtures.js";
import { createFakeLoopbackGate, type FakeLoopbackGate, type GateAnswer } from "./support/fake-loopback-gate.js";

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
function streamed(chunks: Uint8Array[], end: End = "eof", cancellation: "resolve" | "reject" | "hang" | "deferred" = "resolve") {
  const stats = { pulls: 0, cancels: 0 };
  let rejectCancellation!: (error: Error) => void;
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
      if (cancellation === "deferred") return new Promise<void>((_resolve, reject) => { rejectCancellation = reject; });
    },
  }, { highWaterMark: 0 }); // No producer prefetch: assertions count requested chunks.
  return { body, stats, rejectCancellation: () => rejectCancellation(new Error("late cancellation rejection")) };
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
          const cancel = vi.spyOn(validSource.body, "cancel");
          const gate = createFakeLoopbackGate({ scenario: fixture, streamBody: () => validSource.body,
            answer: (base) => ({ ...base, headers: { ...base.headers,
              ...(advertised === undefined ? {} : { "content-length": advertised }) } }) });
          const result = new HttpProtocolAdapter(gate.baseUrl, gate.fetch).invokeLocalCall(fixture.envelope);
          if (accepted) {
            await expect(result).resolves.toEqual(fixture.receipt);
            expect(validSource.stats).toEqual({ pulls: chunks.length + 1, cancels: 0 });
            expect(cancel).not.toHaveBeenCalled();
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
  const cancel = vi.spyOn(source.body, "cancel");
  const gate = createFakeLoopbackGate({ scenario: fixture, streamBody: () => source.body, answer: (base) => ({ ...base, status }) });
  await expect(new HttpProtocolAdapter(gate.baseUrl, gate.fetch).invokeLocalCall(fixture.envelope)).rejects.toBeInstanceOf(GateRejectedError);
  expect(cancel).not.toHaveBeenCalled();
  expect(source.stats.cancels).toBe(0);
  assertOneFetch(gate);
}, HEAVY_MS);

type EarlyRejection = {
  name: string; code: string; message: string; status?: number; url?: string;
  headers?: Record<string, string | null>; redirected?: boolean; type?: ResponseType;
};
const redirectError = { code: "GATE_TRANSPORT", message: "Integration gate answered with a redirect. The client only talks to the loopback origin." };
const traceError = { code: "STALE_RESPONSE", message: "Integration gate response does not match this request." };
const transportError = { code: "GATE_TRANSPORT", message: "Remote transport is not the non-production integration gate." };
const productionError = { code: "PRODUCTION_ENDPOINT", message: "Remote transport claims protocol truth or production conformance." };
const earlyRejections: EarlyRejection[] = [
  { name: "followed redirect", redirected: true, ...redirectError },
  { name: "opaque redirect", type: "opaqueredirect", ...redirectError },
  ...[300, 307, 399].map((status) => ({ name: `redirect status ${status}`, status, ...redirectError })),
  ...["http://example.invalid:8765/", "http://127.0.0.1:8766/", "https://127.0.0.1:8765/", "not a URL"]
    .map((url) => ({ name: `foreign/malformed origin ${url}`, url, ...redirectError })),
  ...["x-request-id", "x-correlation-id"].flatMap((header) => [null, "wrong"].map((value) => ({
    name: `${header}=${value}`, headers: { [header]: value }, ...traceError,
  }))),
  ...["x-kix-transport", "x-kix-production-endpoint"].flatMap((header) => [null, "wrong"].map((value) => ({
    name: `${header}=${value}`, headers: { [header]: value }, ...transportError,
  }))),
  ...["x-kix-protocol-truth", "x-kix-production-conformance"].flatMap((header) => [null, "true"].map((value) => ({
    name: `${header}=${value}`, headers: { [header]: value }, ...productionError,
  }))),
  { name: "redirect before all header failures", status: 307, headers: { "x-request-id": "wrong",
    "x-kix-transport": "wrong", "x-kix-protocol-truth": "true" }, ...redirectError },
  { name: "trace before transport and truth", headers: { "x-correlation-id": "wrong",
    "x-kix-transport": "wrong", "x-kix-production-conformance": "true" }, ...traceError },
  { name: "transport before truth", headers: { "x-kix-production-endpoint": "true",
    "x-kix-protocol-truth": "true" }, ...transportError },
];
const disposalModes = ["resolve", "reject", "hang", "null", "throw", "deferred"] as const;
type DisposalMode = typeof disposalModes[number];
function unreadSource(mode: DisposalMode) {
  const source = streamed([new Uint8Array(limit + 1)], "eof", mode === "null" || mode === "throw" ? "resolve" : mode);
  const cancel = vi.spyOn(source.body, "cancel");
  if (mode === "throw") cancel.mockImplementation(() => { throw new Error("synchronous cancel failure"); });
  const getReader = vi.spyOn(source.body, "getReader");
  return { ...source, cancel, getReader, responseBody: mode === "null" ? null : source.body };
}
function earlyAnswer(base: GateAnswer, fault: EarlyRejection): GateAnswer {
  const headers = { ...base.headers };
  for (const [name, value] of Object.entries(fault.headers ?? {})) {
    if (value === null) delete headers[name];
    else headers[name] = value;
  }
  return { ...base, body: null, headers, status: fault.status ?? base.status, url: fault.url ?? base.url };
}
function observeResponse(response: Response, fault: Pick<EarlyRejection, "redirected" | "type"> = {}) {
  if (fault.redirected !== undefined) Object.defineProperty(response, "redirected", { value: fault.redirected });
  if (fault.type !== undefined) Object.defineProperty(response, "type", { value: fault.type });
  return [vi.spyOn(response, "text"), vi.spyOn(response, "json"), vi.spyOn(response, "arrayBuffer")];
}
function assertUnreadDisposal(source: ReturnType<typeof unreadSource>, mode: DisposalMode) {
  expect(source.cancel).toHaveBeenCalledTimes(mode === "null" ? 0 : 1);
  expect(source.stats).toEqual({ pulls: 0, cancels: mode === "null" || mode === "throw" ? 0 : 1 });
  // As in gate-json/gate-numeric-safety tests, observe consumption rather than spying on an ESM export.
  // No reader or Response convenience read means no response bytes can reach parseGateJson.
  expect(source.getReader).not.toHaveBeenCalled();
  expect(source.body.locked).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
}

describe.each(["local-call", "health", "ready"] as const)("%s unread early rejection disposal", (entry) => {
  describe.each(disposalModes)("cancel=%s", (mode) => {
    it.each(earlyRejections)("$name keeps the original error without waiting for cleanup", async (fault) => {
      const source = unreadSource(mode);
      const gate = createFakeLoopbackGate({ scenario: fixture,
        ...(mode === "null" ? {} : { streamBody: () => source.body }), answer: (base) => earlyAnswer(base, fault) });
      let sent: RequestInit | undefined;
      let reads: ReturnType<typeof observeResponse> = [];
      const fetchDouble = vi.fn<typeof fetch>(async (url, init) => {
        sent = init;
        let response: Response;
        if (entry === "local-call") response = await gate.fetch(url, init);
        else {
          expect(String(url)).toBe(`${gate.baseUrl}/${entry}`);
          expect(init?.method).toBe("GET");
          const answer = earlyAnswer({ status: 200, body: null, headers: echoIntegrationGateHeaders(init), url: String(url) }, fault);
          response = new Response(source.responseBody, { status: answer.status, headers: answer.headers });
          Object.defineProperty(response, "url", { value: answer.url });
        }
        reads = observeResponse(response, fault);
        return response;
      });
      const adapter = new HttpProtocolAdapter(gate.baseUrl, fetchDouble, { timeoutMs: 50 });
      const pending = entry === "local-call" ? adapter.invokeLocalCall(fixture.envelope)
        : entry === "health" ? adapter.readGateHealth() : adapter.readGateReady();
      // Do not advance the deadline: a hanging/deferred cancellation cannot delay rejection.
      const error: unknown = await pending.catch((error: unknown) => error);
      expect(error).toBeInstanceOf(ProtocolError);
      expect(error).not.toBeInstanceOf(GateRejectedError);
      const headers = new Headers(sent?.headers);
      expect(error).toMatchObject({ code: fault.code, message: fault.message,
        requestId: headers.get("x-request-id"), correlationId: headers.get("x-correlation-id") });
      expect(error).not.toMatchObject({ code: "REQUEST_TIMEOUT" });
      expect(sent?.signal?.aborted).toBe(false);
      expect(sent?.redirect).toBe("manual");
      expect(headers.has("idempotency-key")).toBe(false);
      expect(fetchDouble).toHaveBeenCalledOnce();
      if (entry === "local-call") assertOneFetch(gate);
      assertUnreadDisposal(source, mode);
      for (const read of reads) expect(read).not.toHaveBeenCalled();
      if (mode === "deferred") source.rejectCancellation();
      // Flush rejected cancellation promises after the exchange has settled. Vitest's
      // default unhandled-rejection detection stays enabled.
      await vi.advanceTimersByTimeAsync(0);
      expect(sent?.signal?.aborted).toBe(false);
    });
  });
});

describe.each(["booking", "gift", "organizer", "consent"] as const)("%s early rejection UNKNOWN and fence", (composer) => {
  it.each(earlyRejections)("$name preserves progress and blocks follow-up writes", async (fault) => {
    const action = composer === "gift" ? "accept_gift" : composer === "consent" ? "authorize_marketing" : "close_sales";
    const target = composer === "booking" ? success("prepare_trade") : composerFixtures.find((item) => item.envelope.action === action)!;
    const source = unreadSource("hang");
    const gate = createFakeLoopbackGate({ scenario: target, streamBody: () => source.body,
      answer: (base) => earlyAnswer(base, fault) });
    let reads: ReturnType<typeof observeResponse> = [];
    const adapter = new HttpProtocolAdapter(gate.baseUrl, async (url, init) => {
      const response = await gate.fetch(url, init);
      reads = observeResponse(response, fault);
      return response;
    }, { timeoutMs: 50 });
    const meta = adapter.describe();
    let thrown: unknown;
    const invoked: string[] = [];
    const invoker: LocalCallInvoker = { invokeLocalCall: async (input) => {
      invoked.push(input.action);
      if (input.action !== target.envelope.action) {
        const prior = composer === "booking" ? success("create_event") : composerFixtures.find((item) => item.envelope.action === input.action)!;
        expect(input).toEqual(prior.envelope);
        return structuredClone(prior.receipt);
      }
      try { return await adapter.invokeLocalCall(input); }
      catch (error) { thrown = error; throw error; }
    } };
    const replay = composer === "booking" ? await runJourneyTarget(invoker) : await runComposerTarget(action as ComposerAction, 7, invoker);
    expect(thrown).toBeInstanceOf(ProtocolError);
    expect(thrown).not.toBeInstanceOf(GateRejectedError);
    expect(thrown).toMatchObject({ code: fault.code, message: fault.message, ...traceFor(gate) });
    expect(replay.outcome).toMatchObject({ kind: "UNKNOWN", code: fault.code, identity: { ...target.envelope, ...traceFor(gate) } });
    expect(replay.state().halted).toMatchObject({ kind: "UNKNOWN", identity: { ...target.envelope, ...traceFor(gate) } });
    const confirmed = composer === "booking" ? { completedThrough: "create_event" }
      : composer === "gift" ? { offered: true, resolvedBy: null }
      : composer === "consent" ? { consented: true, allowed: true, authorized: false } : { sent: [] };
    expect(replay.state()).toMatchObject(confirmed);
    const state = replay.state();
    const sent = [...invoked];
    expect(await replay.fence()).toMatchObject({ kind: "FENCED", blockedBy: { reason: "halted" } });
    expect(replay.state()).toEqual(state);
    expect(invoked).toEqual(sent);
    expect(adapter.describe()).toEqual(meta);
    expect(meta).toMatchObject({ adapter: "http", environment: "integration-http", liveChain: false,
      fundsMovement: "none", publicDeploy: false, productionConformance: false, protocolTruth: false });
    assertUnreadDisposal(source, "hang");
    for (const read of reads) expect(read).not.toHaveBeenCalled();
    assertOneFetch(gate);
  });
});

it.each(["unresolved", ...disposalModes] as const)("times out a fetch ignoring abort; late resolution=%s cannot consume or parse", async (mode) => {
  let resolve!: (response: Response) => void;
  let sent: RequestInit | undefined;
  const fetchDouble = vi.fn<typeof fetch>((_url, init) => { sent = init; return new Promise<Response>((done) => { resolve = done; }); });
  const result = new HttpProtocolAdapter("http://127.0.0.1:8765", fetchDouble, { timeoutMs: 50 }).invokeLocalCall(fixture.envelope);
  const assertion = expect(result).rejects.toMatchObject({ code: "REQUEST_TIMEOUT",
    requestId: new Headers(sent?.headers).get("x-request-id"), correlationId: new Headers(sent?.headers).get("x-correlation-id") });
  await vi.advanceTimersByTimeAsync(50);
  await assertion;
  if (mode !== "unresolved") {
    const source = unreadSource(mode);
    const parser = vi.spyOn(JSON, "parse");
    const response = new Response(source.responseBody, { headers: echoIntegrationGateHeaders(sent) });
    const reads = observeResponse(response);
    resolve(response);
    await vi.advanceTimersByTimeAsync(0);
    assertUnreadDisposal(source, mode);
    for (const read of reads) expect(read).not.toHaveBeenCalled();
    expect(parser).not.toHaveBeenCalled();
    if (mode === "deferred") source.rejectCancellation();
    await vi.advanceTimersByTimeAsync(0);
  }
  expect(fetchDouble).toHaveBeenCalledOnce();
});

it.each(disposalModes)("defensively disposes a response if the injected fetch removes the abort signal (%s)", async (mode) => {
  const source = unreadSource(mode);
  let sent: RequestInit | undefined;
  let signal: AbortSignal | null | undefined;
  let reads: ReturnType<typeof observeResponse> = [];
  const fetchDouble = vi.fn<typeof fetch>(async (_url, init) => {
    sent = init;
    signal = init?.signal;
    // This cannot happen with native fetch; exercise the defensive branch without
    // exporting the cleanup helper or accessing private adapter methods.
    delete init!.signal;
    const response = new Response(source.responseBody, { headers: echoIntegrationGateHeaders(init) });
    reads = observeResponse(response);
    return response;
  });
  const pending = new HttpProtocolAdapter("http://127.0.0.1:8765", fetchDouble, { timeoutMs: 50 }).invokeLocalCall(fixture.envelope);
  const error: unknown = await pending.catch((error: unknown) => error);
  expect(error).toBeInstanceOf(ProtocolError);
  expect(error).toMatchObject({ code: "GATE_TRANSPORT", message: "Integration gate exchange is missing its abort signal.",
    requestId: new Headers(sent?.headers).get("x-request-id"), correlationId: new Headers(sent?.headers).get("x-correlation-id") });
  assertUnreadDisposal(source, mode);
  expect(signal?.aborted).toBe(false);
  for (const read of reads) expect(read).not.toHaveBeenCalled();
  if (mode === "deferred") source.rejectCancellation();
  await vi.advanceTimersByTimeAsync(0);
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
      const cancel = vi.spyOn(source.body, "cancel");
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
      if (kind === "exact") expect(cancel).not.toHaveBeenCalled();
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
