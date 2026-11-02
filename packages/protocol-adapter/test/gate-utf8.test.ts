import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingJourney, type LocalCallInvoker } from "../src/booking-journey.js";
import { GateRejectedError, HttpProtocolAdapter, echoIntegrationGateHeaders } from "../src/http-adapter.js";
import { PINNED_ACTIONS, PINNED_PROTOCOL_DOMAIN } from "../src/openapi-contract-pin.js";
import { createSdk0MockScenario } from "../src/sdk0-mock-scenarios.js";
import { ProtocolError } from "../src/types.js";
import { createFakeLoopbackGate, type FakeLoopbackGate } from "./support/fake-loopback-gate.js";

const encoder = new TextEncoder();
const scenario = createSdk0MockScenario({ fixtureId: "booking-journey.create_event.success", seed: 7 });
if (scenario.klass !== "SUCCESS") throw new Error("Expected successful SDK0 fixture");
const fixture = scenario;
const invalid = [
  { name: "invalid continuation", bytes: [0xc3, 0x28] },
  { name: "isolated continuation", bytes: [0x80] },
  { name: "two-byte overlong", bytes: [0xc0, 0xaf] },
  { name: "three-byte overlong", bytes: [0xe0, 0x80, 0xaf] },
  { name: "four-byte overlong", bytes: [0xf0, 0x80, 0x80, 0xaf] },
  { name: "high surrogate", bytes: [0xed, 0xa0, 0x80] },
  { name: "low surrogate", bytes: [0xed, 0xbf, 0xbf] },
  { name: "incomplete three-byte", bytes: [0xe2, 0x82] },
  { name: "incomplete four-byte", bytes: [0xf0, 0x9f, 0x98] },
  { name: "truncated at EOF", bytes: [0xf0, 0x9f, 0x98], eof: true },
];
const decodingError = { message: "Integration gate returned invalid UTF-8.", code: "GATE_STATUS" };

// Insert literal bytes between encoded JSON fragments, never through a JS string.
function bodyBytes(status: number, bytes: number[], eof = false) {
  const receipt = structuredClone(fixture.receipt);
  receipt.result.policyHash = "UTF8_MARKER";
  const text = status === 200 ? JSON.stringify(receipt) : '{"rejected":true,"error":"UTF8_MARKER"}';
  const [prefix, suffix] = text.split("UTF8_MARKER");
  return new Uint8Array([...encoder.encode(prefix), ...bytes, ...encoder.encode(eof ? "" : suffix)]);
}
function streamed(bytes: Uint8Array, split?: number) {
  const chunks = split === undefined ? [bytes] : [bytes.subarray(0, split), bytes.subarray(split)];
  let index = 0;
  return new ReadableStream<Uint8Array>({ pull(controller) {
    if (index < chunks.length) controller.enqueue(chunks[index++]);
    else controller.close();
  } }, { highWaterMark: 0 });
}
function trace(gate: FakeLoopbackGate) {
  return { requestId: gate.calls[0].requestId, correlationId: gate.calls[0].correlationId };
}
function oneFetch(gate: FakeLoopbackGate) {
  expect(gate.calls).toHaveLength(1);
  expect(gate.calls[0]).toMatchObject({ method: "POST", redirect: "manual", idempotencyKey: false, envelope: fixture.envelope });
  expect(gate.calls[0].requestId).toEqual(expect.any(String));
  expect(gate.calls[0].correlationId).toEqual(expect.any(String));
}
function assertDecodeError(error: unknown, { requestId, correlationId }: { requestId: string | null; correlationId: string | null }) {
  expect(error).toBeInstanceOf(ProtocolError);
  expect(error).not.toBeInstanceOf(GateRejectedError);
  expect(error).toMatchObject({ ...decodingError, requestId, correlationId });
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  try { expect(vi.getTimerCount()).toBe(0); }
  finally { vi.useRealTimers(); vi.restoreAllMocks(); }
});

describe.each([200, 400, 422])("strict UTF-8 before interpreting HTTP %i", (status) => {
  for (const vector of invalid) {
    for (const split of [false, true]) {
      it(`${vector.name}, ${split ? "byte chunks" : "whole body"}: traced UNKNOWN fences the next write`, async () => {
        const bytes = bodyBytes(status, vector.bytes, vector.eof);
        // One byte per chunk also splits every malformed multi-byte sequence.
        const body = split ? new ReadableStream<Uint8Array>({ start(controller) {
          for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
          controller.close();
        } }) : streamed(bytes);
        const gate = createFakeLoopbackGate({ scenario: fixture, streamBody: () => body,
          answer: (base) => ({ ...base, status }) });
        const adapter = new HttpProtocolAdapter(gate.baseUrl, gate.fetch);
        const meta = adapter.describe();
        let thrown: unknown;
        const invoker: LocalCallInvoker = { invokeLocalCall: async (input) => {
          try { return await adapter.invokeLocalCall(input); }
          catch (error) { thrown = error; throw error; }
        } };
        const journey = new BookingJourney(invoker);
        const { operationId, body: input } = fixture.envelope;
        const outcome = await journey.createEvent({ operationId, eventId: input.eventId as string,
          organizer: input.organizer as string, policy: input.policy as { primaryPrice: number }, seats: input.seats as string[] });
        assertDecodeError(thrown, trace(gate));
        expect(outcome).toMatchObject({ kind: "UNKNOWN", code: "GATE_STATUS", identity: { ...fixture.envelope, ...trace(gate) } });
        expect(journey.state()).toMatchObject({ completedThrough: "none", halted: { kind: "UNKNOWN", identity: trace(gate) } });
        expect(await journey.prepareTrade({ operationId: "never-sent", tradeId: "trade", buyer: "buyer" }))
          .toMatchObject({ kind: "FENCED", blockedBy: { reason: "halted" } });
        expect(body.locked).toBe(false);
        expect(adapter.describe()).toEqual(meta);
        expect(meta).toMatchObject({ adapter: "http", environment: "integration-http", liveChain: false,
          fundsMovement: "none", publicDeploy: false, productionConformance: false, protocolTruth: false });
        oneFetch(gate);
      });
    }
  }
});

describe.each([200, 400, 422])("valid Unicode in HTTP %i", (status) => {
  it("accepts Korean and supplementary characters across every byte boundary", async () => {
    const unicode = encoder.encode("한글😀");
    const bytes = bodyBytes(status, [...unicode]);
    const offset = bytes.indexOf(unicode[0]);
    for (let split = offset + 1; split < offset + unicode.length; split++) {
      await acceptUnicode(status, bytes, "한글😀", split);
    }
  });
  it("accepts explicitly encoded U+FFFD", async () => {
    await acceptUnicode(status, bodyBytes(status, [0xef, 0xbf, 0xbd]), "\uFFFD");
  });
  it("accepts JSON-escaped U+FFFD", async () => {
    await acceptUnicode(status, bodyBytes(status, [...encoder.encode("\\uFFFD")]), "\uFFFD");
  });
});
async function acceptUnicode(status: number, bytes: Uint8Array, value: string, split?: number) {
  const gate = createFakeLoopbackGate({ scenario: fixture, streamBody: () => streamed(bytes, split),
    answer: (base) => ({ ...base, status }) });
  const pending = new HttpProtocolAdapter(gate.baseUrl, gate.fetch).invokeLocalCall(fixture.envelope);
  if (status === 200) {
    const receipt = structuredClone(fixture.receipt);
    receipt.result.policyHash = value;
    await expect(pending).resolves.toEqual(receipt);
  } else {
    const error: unknown = await pending.catch((error: unknown) => error);
    expect(error).toBeInstanceOf(GateRejectedError);
    expect(error).toMatchObject({ code: value, ...trace(gate) });
  }
  oneFetch(gate);
}

function probeBody(probe: "health" | "ready") {
  return { status: probe === "health" ? "up" : "ready", liveHttpServer: "non-production-local-integration",
    role: "integration-gate", production: false, publicHost: false, productionReadiness: false,
    productionConformance: false, protocolTruth: false, localFileJournal: false,
    ...(probe === "ready" ? { liveMoney: false, durable: false, commandCount: PINNED_ACTIONS.length, domain: PINNED_PROTOCOL_DOMAIN } : {}) };
}
function probeGate(failed: "health" | "ready", vector: typeof invalid[number]) {
  const calls: { path: string; requestId: string | null; correlationId: string | null }[] = [];
  const fetchDouble = vi.fn<typeof fetch>(async (url, init) => {
    const path = new URL(String(url)).pathname;
    const headers = new Headers(init?.headers);
    calls.push({ path, requestId: headers.get("x-request-id"), correlationId: headers.get("x-correlation-id") });
    expect(init).toMatchObject({ method: "GET", redirect: "manual" });
    expect(headers.has("idempotency-key")).toBe(false);
    const text = JSON.stringify({ ...probeBody(path === "/health" ? "health" : "ready"), note: "UTF8_MARKER" });
    const [prefix, suffix] = text.split("UTF8_MARKER");
    const bytes = path === `/${failed}` ? new Uint8Array([...encoder.encode(prefix), ...vector.bytes,
      ...encoder.encode(vector.eof ? "" : suffix)]) : encoder.encode(text);
    return new Response(streamed(bytes, bytes.length - 1), { headers: echoIntegrationGateHeaders(init) });
  });
  return { adapter: new HttpProtocolAdapter("http://127.0.0.1:8765", fetchDouble), calls, fetchDouble };
}
describe.each(["health", "ready"] as const)("malformed /%s cannot imply readiness", (probe) => {
  it.each(invalid)("$name: direct probe returns traced GATE_STATUS", async (vector) => {
    const gate = probeGate(probe, vector);
    const pending = probe === "health" ? gate.adapter.readGateHealth() : gate.adapter.readGateReady();
    const error: unknown = await pending.catch((error: unknown) => error);
    assertDecodeError(error, gate.calls[0]);
    expect(gate.fetchDouble).toHaveBeenCalledOnce();
    expect(gate.calls.map((call) => call.path)).toEqual([`/${probe}`]);
  });
  it.each(invalid)("$name: observation stays unavailable", async (vector) => {
    const gate = probeGate(probe, vector);
    const observation = await gate.adapter.observeTransport();
    expect(gate.calls.map((call) => call.path)).toEqual(probe === "health" ? ["/health"] : ["/health", "/ready"]);
    const { requestId, correlationId } = gate.calls.at(-1)!;
    expect(observation).toMatchObject({ state: "unavailable", code: "GATE_STATUS", requestId, correlationId,
      localFileJournal: null, productionReadiness: false, productionConformance: false, protocolTruth: false,
      publicDeploy: false, durable: false, retry: false, fallbackToStub: false });
    expect(gate.fetchDouble).toHaveBeenCalledTimes(probe === "health" ? 1 : 2);
  });
});
