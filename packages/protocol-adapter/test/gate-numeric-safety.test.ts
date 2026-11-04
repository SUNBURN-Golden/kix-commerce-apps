import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingJourney, type LocalCallInvoker } from "../src/booking-journey.js";
import { parseGateJson } from "../src/gate-json.js";
import { GateRejectedError, HttpProtocolAdapter, echoIntegrationGateHeaders } from "../src/http-adapter.js";
import { PINNED_ACTIONS, PINNED_PROTOCOL_DOMAIN } from "../src/openapi-contract-pin.js";
import { assertLocalCallReceipt } from "../src/payload-guards.js";
import { createSdk0MockScenario } from "../src/sdk0-mock-scenarios.js";
import { ProtocolError } from "../src/types.js";
import { createComposerFixtures, runComposerTarget, type ComposerAction } from "./support/composer-loopback-fixtures.js";
import { createFakeLoopbackGate, type FakeLoopbackGate } from "./support/fake-loopback-gate.js";
import { localCallReceipt } from "./support/receipt.js";

function success(action: "create_event" | "prepare_trade") {
  const fixture = createSdk0MockScenario({ fixtureId: `booking-journey.${action}.success`, seed: 7 });
  if (fixture.klass !== "SUCCESS") throw new Error("Expected successful SDK0 fixture");
  return fixture;
}
const fixture = success("create_event");
const composerFixtures = await createComposerFixtures(7);
const numericError = { code: "GATE_STATUS", message: "Integration gate returned a non-finite number." };
const receiptError = { code: "GATE_STATUS", message: "Integration gate success was not a published local-call receipt." };
const unsafeSequences = ["9007199254740992", "9007199254740993", "-9007199254740992", "-9007199254740993", "1e20"];
const invalidSequences = [...unsafeSequences, "1.5", '"1"', "null", "true"];
const safeSequences = ["0", "-0", "1", "-1", "9007199254740991", "-9007199254740991"];

// Replace only a known finite sequence token, never stringify an overflow or an unsafe JS literal.
function receiptWithSequence(receipt: unknown, token: string): string {
  const text = JSON.stringify(receipt);
  if (!/"sequence":\d+/.test(text)) throw new Error("Fixture must have a positive integer sequence");
  return text.replace(/"sequence":\d+/, `"sequence":${token}`);
}
function trace(gate: FakeLoopbackGate) {
  return { requestId: gate.calls[0].requestId, correlationId: gate.calls[0].correlationId };
}
function oneFetch(gate: FakeLoopbackGate, envelope: unknown) {
  expect(gate.calls).toHaveLength(1);
  expect(gate.calls[0]).toMatchObject({ url: `${gate.baseUrl}/x-kix-contract-only/local-call`,
    method: "POST", redirect: "manual", idempotencyKey: false, envelope });
  expect(gate.calls[0].requestId).toEqual(expect.any(String));
  expect(gate.calls[0].correlationId).toEqual(expect.any(String));
}
function assertUnknownError(error: unknown, expected: object) {
  expect(error).toBeInstanceOf(ProtocolError);
  expect(error).not.toBeInstanceOf(GateRejectedError);
  expect(error).toMatchObject(expected);
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  try { expect(vi.getTimerCount()).toBe(0); }
  finally { vi.useRealTimers(); vi.restoreAllMocks(); }
});

describe("receipt sequence representation", () => {
  it.each(invalidSequences)("rejects raw sequence %s through the receipt guard and HTTP", async (token) => {
    const rawBody = receiptWithSequence(fixture.receipt, token);
    expect(() => assertLocalCallReceipt(parseGateJson(rawBody), fixture.envelope)).toThrowError(
      new ProtocolError(receiptError.message, receiptError.code));
    const gate = createFakeLoopbackGate({ scenario: fixture, rawBody });
    const error: unknown = await new HttpProtocolAdapter(gate.baseUrl, gate.fetch).invokeLocalCall(fixture.envelope).catch((error: unknown) => error);
    assertUnknownError(error, { ...receiptError, ...trace(gate) });
    oneFetch(gate, fixture.envelope);
  });
  it.each(safeSequences)("accepts raw safe sequence %s without a sign policy", async (token) => {
    const rawBody = receiptWithSequence(localCallReceipt(fixture.envelope.operationId, fixture.envelope.action, fixture.receipt.result), token);
    const receipt = parseGateJson(rawBody);
    expect(() => assertLocalCallReceipt(receipt, fixture.envelope)).not.toThrow();
    const gate = createFakeLoopbackGate({ scenario: fixture, rawBody });
    await expect(new HttpProtocolAdapter(gate.baseUrl, gate.fetch).invokeLocalCall(fixture.envelope)).resolves.toEqual(receipt);
    oneFetch(gate, fixture.envelope);
  });
});

async function runJourneyTarget(invoker: LocalCallInvoker) {
  const journey = new BookingJourney(invoker);
  const create = success("create_event").envelope;
  const prepare = success("prepare_trade").envelope;
  expect((await journey.createEvent({ operationId: create.operationId, eventId: create.body.eventId as string,
    organizer: create.body.organizer as string, policy: create.body.policy as { primaryPrice: number }, seats: create.body.seats as string[] })).kind).toBe("RECEIPT");
  const outcome = await journey.prepareTrade({ operationId: prepare.operationId, tradeId: prepare.body.tradeId as string, buyer: prepare.body.buyer as string });
  return { outcome, state: () => journey.state(), fence: () => journey.acceptTrade({ operationId: "never-sent" }) };
}

const corruptCases = [
  ...[200, 400, 422].flatMap((status) => ["1e400", "-1e400"].map((token) => ({
    name: `overflow ${token} HTTP ${status}`, status, token, sequence: false,
  }))),
  ...unsafeSequences.map((token) => ({ name: `unsafe sequence ${token}`, status: 200, token, sequence: true })),
];
describe.each(["booking", "gift", "organizer", "consent"] as const)("%s numeric UNKNOWN and fence", (composer) => {
  it.each(corruptCases)("$name retains confirmed progress, traces and one attempt", async ({ status, token, sequence }) => {
    const action = composer === "gift" ? "accept_gift" : composer === "consent" ? "authorize_marketing" : "close_sales";
    const target = composer === "booking" ? success("prepare_trade") : composerFixtures.find((item) => item.envelope.action === action)!;
    // Corrupt success evidence lives inside result; rejection markers are otherwise valid.
    const rawBody = sequence ? receiptWithSequence(target.receipt, token)
      : status === 200 ? JSON.stringify(target.receipt).replace(/"result":\{/, `"result":{"diagnostic":[0,{"value":${token}}],`)
      : `{"rejected":true,"error":"INVALID","diagnostic":[0,{"value":${token}}]}`;
    const gate = createFakeLoopbackGate({ scenario: target, rawBody, answer: (base) => ({ ...base, status }) });
    const adapter = new HttpProtocolAdapter(gate.baseUrl, gate.fetch);
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
    assertUnknownError(thrown, { ...(sequence ? receiptError : numericError), ...trace(gate) });
    expect(replay.outcome).toMatchObject({ kind: "UNKNOWN", code: "GATE_STATUS", identity: { ...target.envelope, ...trace(gate) } });
    expect(replay.state().halted).toMatchObject({ kind: "UNKNOWN", identity: { ...target.envelope, ...trace(gate) } });
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
    oneFetch(gate, target.envelope);
  });
});

it.each([400, 422])("finite diagnostics retain explicit rejection at HTTP %i", async (status) => {
  const rawBody = '{"rejected":true,"error":"INVALID","diagnostic":[0,-0,1.25,{"value":1e308,"text":"1e400"}]}';
  const gate = createFakeLoopbackGate({ scenario: fixture, rawBody, answer: (base) => ({ ...base, status }) });
  const error: unknown = await new HttpProtocolAdapter(gate.baseUrl, gate.fetch).invokeLocalCall(fixture.envelope).catch((error: unknown) => error);
  expect(error).toBeInstanceOf(GateRejectedError);
  expect(error).toMatchObject({ code: "INVALID", ...trace(gate) });
  oneFetch(gate, fixture.envelope);
});

it("keeps unrelated finite numbers outside the safe-sequence restriction", async () => {
  const receipt = structuredClone(fixture.receipt);
  receipt.result.reservationSeconds = 1e20;
  const gate = createFakeLoopbackGate({ scenario: fixture, rawBody: JSON.stringify(receipt) });
  await expect(new HttpProtocolAdapter(gate.baseUrl, gate.fetch).invokeLocalCall(fixture.envelope)).resolves.toEqual(receipt);
  oneFetch(gate, fixture.envelope);
});

function probeBody(probe: "health" | "ready") {
  return { status: probe === "health" ? "up" : "ready", liveHttpServer: "non-production-local-integration",
    role: "integration-gate", production: false, publicHost: false, productionReadiness: false,
    productionConformance: false, protocolTruth: false, localFileJournal: false,
    ...(probe === "ready" ? { liveMoney: false, durable: false, commandCount: PINNED_ACTIONS.length, domain: PINNED_PROTOCOL_DOMAIN } : {}) };
}
function probeGate(probe: "health" | "ready", token: string) {
  const calls: { path: string; requestId: string | null; correlationId: string | null }[] = [];
  const fetchDouble = vi.fn<typeof fetch>(async (url, init) => {
    const path = new URL(String(url)).pathname;
    const headers = new Headers(init?.headers);
    calls.push({ path, requestId: headers.get("x-request-id"), correlationId: headers.get("x-correlation-id") });
    expect(String(url)).toBe(`http://127.0.0.1:8765/${probe}`);
    expect(init).toMatchObject({ method: "GET", redirect: "manual" });
    expect(headers.has("idempotency-key")).toBe(false);
    const rawBody = JSON.stringify(probeBody(probe)).replace(/}$/, `,"diagnostic":[{"value":${token}}]}`);
    return new Response(rawBody, { headers: echoIntegrationGateHeaders(init) });
  });
  return { adapter: new HttpProtocolAdapter("http://127.0.0.1:8765", fetchDouble), calls, fetchDouble };
}
describe.each(["health", "ready"] as const)("/%s numeric response guards", (probe) => {
  it.each(["1e400", "-1e400"])("rejects nested %s with traces and one request", async (token) => {
    const gate = probeGate(probe, token);
    const pending = probe === "health" ? gate.adapter.readGateHealth() : gate.adapter.readGateReady();
    const error: unknown = await pending.catch((error: unknown) => error);
    const { requestId, correlationId } = gate.calls[0];
    assertUnknownError(error, { ...numericError, requestId, correlationId });
    expect(gate.fetchDouble).toHaveBeenCalledOnce();
  });
  it.each(["0", "-0", "1.25", "1e308", "-1e308", '"1e400"'])("accepts finite/string diagnostic %s", async (token) => {
    const gate = probeGate(probe, token);
    const pending = probe === "health" ? gate.adapter.readGateHealth() : gate.adapter.readGateReady();
    await expect(pending).resolves.toMatchObject(probeBody(probe));
    expect(gate.fetchDouble).toHaveBeenCalledOnce();
  });
});
