import { isDeepStrictEqual } from "node:util";
import { echoIntegrationGateHeaders } from "../../src/http-adapter.js";
import { INTEGRATION_GATE_LOOPBACK_HOST } from "../../src/integration-gate-pin.js";
import { CONTRACT_ONLY_LOCAL_CALL_METHOD, CONTRACT_ONLY_LOCAL_CALL_PATH } from "../../src/openapi-contract-pin.js";
import type { LocalCallEnvelope } from "../../src/local-call.js";

export type FakeGateScenario =
  | { klass: "NOT_BOUND" }
  | { klass: "SUCCESS"; envelope: LocalCallEnvelope; receipt: unknown }
  | { klass: "REJECT" | "UNKNOWN"; envelope: LocalCallEnvelope; failure: { code: string } }
  | { klass: "STALE"; envelope: LocalCallEnvelope; failure: { requestId: string; correlationId: string } };

export interface GateAnswer { status: number; body: string | null; headers: Record<string, string>; url?: string }
export interface FakeGateCall {
  url: string; method: string; redirect: RequestRedirect | undefined;
  idempotencyKey: boolean; requestId: string | null; correlationId: string | null; envelope: unknown;
}
export interface FakeLoopbackGate { baseUrl: string; fetch: typeof fetch; calls: readonly FakeGateCall[] }

/** Offline fetch double. Raw text is returned verbatim, including duplicate keys. */
export function createFakeLoopbackGate(input: {
  scenario: FakeGateScenario; port?: number;
  answer?: (base: GateAnswer, call: FakeGateCall) => GateAnswer;
  rawBody?: string;
}): FakeLoopbackGate {
  const baseUrl = `http://${INTEGRATION_GATE_LOOPBACK_HOST}:${input.port ?? 8765}`;
  const calls: FakeGateCall[] = [];
  const fetchDouble: typeof fetch = async (url, init) => {
    const headers = new Headers(init?.headers);
    const call: FakeGateCall = {
      url: String(url), method: init?.method ?? "GET", redirect: init?.redirect,
      idempotencyKey: headers.has("idempotency-key"), requestId: headers.get("x-request-id"),
      correlationId: headers.get("x-correlation-id"), envelope: undefined,
    };
    calls.push(call);
    const scenario = input.scenario;
    if (scenario.klass === "NOT_BOUND") throw new Error("NOT_BOUND scenario reached the gate");
    call.envelope = JSON.parse(String(init?.body));
    if (call.url !== `${baseUrl}${CONTRACT_ONLY_LOCAL_CALL_PATH}` || call.method !== CONTRACT_ONLY_LOCAL_CALL_METHOD
      || call.redirect !== "manual" || call.idempotencyKey || !isDeepStrictEqual(call.envelope, scenario.envelope)) {
      throw new Error("Fake gate received an unexpected local call");
    }
    const base: GateAnswer = { status: 200, body: null, headers: echoIntegrationGateHeaders(init), url: call.url };
    switch (scenario.klass) {
      case "SUCCESS": base.body = JSON.stringify(scenario.receipt); break;
      case "REJECT": base.status = 422; base.body = JSON.stringify({ rejected: true, error: scenario.failure.code }); break;
      case "UNKNOWN": base.status = 500; base.body = JSON.stringify({ error: scenario.failure.code }); break;
      case "STALE":
        base.headers["x-request-id"] = `${scenario.failure.requestId}-prior`;
        base.headers["x-correlation-id"] = `${scenario.failure.correlationId}-prior`;
        break;
    }
    if (input.rawBody !== undefined) base.body = input.rawBody;
    const answer = input.answer?.(base, call) ?? base;
    const response = new Response(answer.body, { status: answer.status, headers: answer.headers });
    if (answer.url !== undefined) Object.defineProperty(response, "url", { value: answer.url });
    return response;
  };
  return { baseUrl, fetch: fetchDouble, calls };
}
