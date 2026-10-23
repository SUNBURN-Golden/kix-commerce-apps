import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingJourney } from "../src/booking-journey.js";
import { COMMERCE_COMMAND_BINDINGS } from "../src/commerce-bindings.js";
import { parseGateJson } from "../src/gate-json.js";
import { GateRejectedError, HttpProtocolAdapter } from "../src/http-adapter.js";
import { assertLocalCallReceipt, enforceRemotePayloadGuards } from "../src/payload-guards.js";
import { createSdk0MockScenario, SDK0_MOCK_SCENARIO_IDS, type Sdk0MockScenario } from "../src/sdk0-mock-scenarios.js";
import { ProtocolError } from "../src/types.js";
import { createFakeLoopbackGate, type FakeLoopbackGate, type GateAnswer } from "./support/fake-loopback-gate.js";

type Success = Extract<Sdk0MockScenario, { klass: "SUCCESS" }>;
type Sent = Exclude<Sdk0MockScenario, { klass: "NOT_BOUND" }>;
const root = fileURLToPath(new URL("../../../", import.meta.url));
const docPath = `${root}docs/c-plan-c-loopback-replay-conformance-stub-apps-bind.md`;
const covered = new Set<string>();
const steps = ["create_event", "prepare_trade", "accept_trade"] as const;
function success(action: typeof steps[number], seed = 7): Success {
  const scenario = createSdk0MockScenario({ fixtureId: `booking-journey.${action}.success`, seed });
  if (scenario.klass !== "SUCCESS") throw new Error("Expected SUCCESS fixture");
  return scenario;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Earlier journey steps are pure fixture reads; only the target goes through HTTP. */
async function replayStep(scenario: Sent, gate: FakeLoopbackGate) {
  const adapter = new HttpProtocolAdapter(gate.baseUrl, gate.fetch);
  let thrown: unknown;
  let returned: unknown;
  const journey = new BookingJourney({ invokeLocalCall: async (input) => {
    if (input.action !== scenario.envelope.action) return success(input.action as typeof steps[number], scenario.seed).receipt;
    expect(input).toEqual(scenario.envelope);
    try { returned = await adapter.invokeLocalCall(input); return returned; }
    catch (error) { thrown = error; throw error; }
  } });
  const create = success("create_event", scenario.seed).envelope;
  const prepare = success("prepare_trade", scenario.seed).envelope;
  const createBody = create.body;
  const created = await journey.createEvent({ operationId: scenario.envelope.action === "create_event" ? scenario.envelope.operationId : create.operationId,
    eventId: createBody.eventId as string, organizer: createBody.organizer as string,
    policy: createBody.policy as { primaryPrice: number }, seats: createBody.seats as string[] });
  let outcome = created;
  if (scenario.envelope.action !== "create_event") {
    expect(created.kind).toBe("RECEIPT");
    outcome = await journey.prepareTrade({ operationId: prepare.operationId, tradeId: prepare.body.tradeId as string, buyer: prepare.body.buyer as string });
  }
  if (scenario.envelope.action === "accept_trade") {
    expect(outcome.kind).toBe("RECEIPT");
    outcome = await journey.acceptTrade({ operationId: scenario.envelope.operationId });
  }
  return { thrown, returned, outcome, journey };
}

describe.each([0, 7, 0xffff_ffff])("SDK0 offline HTTP replay seed %i", (seed) => {
  it.each(SDK0_MOCK_SCENARIO_IDS)("%s", async (fixtureId) => {
    const scenario = createSdk0MockScenario({ fixtureId, seed });
    covered.add(fixtureId);
    const gate = createFakeLoopbackGate({ scenario });
    if (scenario.klass === "NOT_BOUND") {
      const adapter = new HttpProtocolAdapter(gate.baseUrl, gate.fetch);
      const invoke = () => {
        switch (scenario.method) {
          case "placeHold": return adapter.placeHold({ eventId: "show-mock-00000007", quantity: 1 });
          case "confirmBooking": return adapter.confirmBooking("hold-mock");
          case "settlementPreview": return adapter.settlementPreview("show-mock");
          default: throw new Error("Unhandled NOT_BOUND method");
        }
      };
      await expect(invoke()).rejects.toMatchObject({ message: expect.stringContaining(`${scenario.method} is not-bound`), requestId: undefined });
      expect(scenario.consideredAction).toBe(COMMERCE_COMMAND_BINDINGS[scenario.method].consideredAction);
      expect(COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction).toBe("reserve_listing");
      expect(gate.calls).toHaveLength(0);
      return;
    }
    if (scenario.failure) vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce(scenario.failure.requestId as `${string}-${string}-${string}-${string}-${string}`)
      .mockReturnValueOnce(scenario.failure.correlationId as `${string}-${string}-${string}-${string}-${string}`);
    const replay = await replayStep(scenario, gate);
    switch (scenario.klass) {
      case "SUCCESS":
        expect(replay.thrown).toBeUndefined();
        expect(replay.returned).toEqual(scenario.receipt);
        expect(() => assertLocalCallReceipt(replay.returned, scenario.envelope)).not.toThrow();
        expect(() => enforceRemotePayloadGuards(replay.returned)).not.toThrow();
        expect(replay.outcome).toMatchObject({ kind: "RECEIPT", receipt: scenario.receipt });
        break;
      case "REJECT": case "UNKNOWN": case "STALE":
        expect(replay.thrown).toBeInstanceOf(ProtocolError);
        if (scenario.klass === "REJECT") {
          expect(replay.thrown).toBeInstanceOf(GateRejectedError);
          expect(replay.thrown).toMatchObject({ status: 422 });
        }
        expect(replay.thrown).toMatchObject(scenario.failure);
        expect(replay.outcome).toMatchObject({ kind: scenario.klass === "REJECT" ? "REJECTED" : "UNKNOWN", code: scenario.failure.code });
        expect((await replay.journey.prepareTrade({ operationId: "never-sent", tradeId: "never-sent", buyer: "buyer-a" })).kind).toBe("FENCED");
        break;
      default: { const exhaustive: never = scenario; throw new Error(String(exhaustive)); }
    }
    expect(gate.calls).toHaveLength(1);
    expect(gate.calls[0]).toMatchObject({ redirect: "manual", idempotencyKey: false, envelope: scenario.envelope });
  });
});

it("covers exactly every SDK0 scenario id", () => expect([...covered].sort()).toEqual([...SDK0_MOCK_SCENARIO_IDS].sort()));

type Path = (string | number)[];
function paths(value: unknown, path: Path = []): Path[] {
  return [path, ...value !== null && typeof value === "object" ? Object.entries(value).flatMap(([key, child]) =>
    paths(child, [...path, Array.isArray(value) ? Number(key) : key])) : []];
}
const fieldMutations = ["delete", "swapType", "addKey", "inject:economicFinalityClaimed", "inject:fundsExecuted", "inject:productionEndpoint"] as const;
type FieldMutation = typeof fieldMutations[number];
function mutate(receipt: Success["receipt"], path: Path, mutation: FieldMutation): string {
  const copy = structuredClone(receipt);
  let current: unknown = copy;
  let parent: Record<string | number, unknown> | unknown[] | undefined;
  for (const key of path) {
    parent = current as Record<string | number, unknown>;
    current = (parent as Record<string | number, unknown>)[key];
  }
  let next: unknown;
  if (mutation === "delete") {
    if (!parent) return ""; // root deletion: no receipt body
    if (Array.isArray(parent)) parent.splice(path.at(-1) as number, 1);
    else delete parent[path.at(-1)!];
    return JSON.stringify(copy);
  }
  if (mutation === "swapType") next = typeof current === "string" ? 1 : typeof current === "number" ? "1"
    : typeof current === "boolean" ? "true" : Array.isArray(current) ? {} : [];
  else {
    const key = mutation === "addKey" ? "extraKey" : mutation.slice("inject:".length);
    const extra = { [key]: mutation === "addKey" ? "x" : true };
    // Array named properties vanish in JSON. Append an element instead.
    next = Array.isArray(current) ? [...current, extra]
      : current !== null && typeof current === "object" ? { ...current, ...extra } : { value: current, ...extra };
  }
  if (!parent) return JSON.stringify(next);
  (parent as Record<string | number, unknown>)[path.at(-1)!] = next;
  return JSON.stringify(copy);
}
interface SweepRow { fixtureId: string; path: string; mutation: string; code: string }
interface SweepCase { scenario: Success; row: SweepRow; answer: (base: GateAnswer) => GateAnswer }
const sweep: SweepCase[] = [];
function add(scenario: Success, path: string, mutation: string, code: string, answer: SweepCase["answer"]) {
  sweep.push({ scenario, row: { fixtureId: scenario.fixtureId, path, mutation, code }, answer });
}
for (const action of steps) {
  const scenario = success(action);
  for (const path of paths(scenario.receipt)) {
    for (const mutation of fieldMutations) {
      // Independent intended precedence: unsafe JSON, then production claims,
      // then coded payload/envelope/result checks (all GATE_STATUS).
      const code = mutation === "inject:productionEndpoint" ? "PRODUCTION_ENDPOINT" : "GATE_STATUS";
      const body = mutate(scenario.receipt, path, mutation);
      if (body === JSON.stringify(scenario.receipt)) throw new Error("Mutation was lost during serialization");
      add(scenario, "$" + path.map((key) => `.${key}`).join(""), mutation, code, (base) => ({ ...base, body }));
    }
  }
  for (const [mutation, patch] of [
    ["operationId:changed", { operationId: "other-operation" }],
    ["action:other-pinned", { action: action === "create_event" ? "accept_trade" : "create_event" }],
    ["action:unpinned", { action: "not_a_pinned_action" }],
  ] as const) add(scenario, "$", mutation, "GATE_STATUS", (base) => ({ ...base, body: JSON.stringify({ ...scenario.receipt, ...patch }) }));
  for (const [header, code] of [
    ["x-request-id", "STALE_RESPONSE"], ["x-correlation-id", "STALE_RESPONSE"],
    ["x-kix-transport", "GATE_TRANSPORT"], ["x-kix-production-endpoint", "GATE_TRANSPORT"],
    ["x-kix-protocol-truth", "PRODUCTION_ENDPOINT"], ["x-kix-production-conformance", "PRODUCTION_ENDPOINT"],
  ]) add(scenario, "$headers", `drop:${header}`, code, (base) => {
    const headers = { ...base.headers }; delete headers[header]; return { ...base, headers };
  });
  for (const [name, url] of [["other-port", "http://127.0.0.1:8766/"], ["localhost", "http://localhost:8765/"]]) {
    add(scenario, "$origin", `origin:${name}`, "GATE_TRANSPORT", (base) => ({ ...base, url }));
  }
  add(scenario, "$", "array:two-receipts", "GATE_STATUS", (base) => ({ ...base, body: JSON.stringify([scenario.receipt, scenario.receipt]) }));
}
function renderTable(rows: SweepRow[]) {
  return ["| Fixture | Path | Mutation | ProtocolError code |", "| --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.fixtureId} | ${row.path} | ${row.mutation} | ${row.code} |`)].join("\n");
}

it("rejects every serialization-safe mutation at the adapter, once, and fences the journey", async () => {
  expect(steps.map((step) => paths(success(step).receipt).length)).toEqual([11, 11, 7]);
  expect(sweep).toHaveLength(210); // (11 + 11 + 7) * 6 + 3 * 12
  expect(new Set(sweep.map(({ row }) => `${row.fixtureId}:${row.path}:${row.mutation}`)).size).toBe(210);
  const common = ["$", "$.domain", "$.operationId", "$.sequence", "$.action", "$.result"];
  const requiredPaths = [
    [...common, "$.result.eventId", "$.result.policyHash", "$.result.inventoryIds", "$.result.inventoryIds.0", "$.result.reservationSeconds"],
    [...common, "$.result.tradeId", "$.result.ticketId", "$.result.externalOrderId", "$.result.status", "$.result.termsHash"],
    [...common, "$.result.accepted"],
  ];
  const requiredPairs = steps.flatMap((step, index) => requiredPaths[index].flatMap((path) => fieldMutations.map((mutation) =>
    `${success(step).fixtureId}:${path}:${mutation}`)));
  expect(sweep.filter(({ row }) => fieldMutations.includes(row.mutation as FieldMutation))
    .map(({ row }) => `${row.fixtureId}:${row.path}:${row.mutation}`).sort()).toEqual(requiredPairs.sort());
  for (const { scenario, row, answer } of sweep) {
    const gate = createFakeLoopbackGate({ scenario, answer: (base) => {
      const mutated = answer(base);
      expect(JSON.stringify(mutated), JSON.stringify(row)).not.toBe(JSON.stringify(base));
      return mutated;
    } });
    const replay = await replayStep(scenario, gate);
    expect(replay.thrown, JSON.stringify(row)).toBeInstanceOf(ProtocolError);
    expect(replay.thrown, JSON.stringify(row)).toMatchObject({ code: row.code,
      requestId: gate.calls[0]?.requestId, correlationId: gate.calls[0]?.correlationId });
    expect(replay.outcome).toMatchObject({ kind: "UNKNOWN", code: row.code });
    const prior = scenario.envelope.action === "create_event" ? "none" : scenario.envelope.action === "prepare_trade" ? "create_event" : "prepare_trade";
    expect(replay.journey.state().completedThrough).toBe(prior);
    expect((await replay.journey.acceptTrade({ operationId: "never-sent" })).kind).toBe("FENCED");
    expect(gate.calls).toHaveLength(1);
  }
  const table = renderTable(sweep.map(({ row }) => row));
  console.log(`<!-- loopback-sweep:start -->\n${table}\n<!-- loopback-sweep:end -->`);
  const documented = readFileSync(docPath, "utf8").split("<!-- loopback-sweep:start -->\n")[1]?.split("\n<!-- loopback-sweep:end -->")[0];
  expect(documented).toBe(table);
});

it("rejects isolated hostile raw JSON without prototype pollution, once", async () => {
  const scenario = success("create_event");
  const raw = JSON.stringify(scenario.receipt);
  // Insert raw members at the root only; preserve duplicate keys verbatim.
  const withRootMembers = (members: string) => `{${members},${raw.slice(1)}`;
  const cases = [
    withRootMembers('"__proto__":{"polluted":true}'),
    raw.replace('"result":{', '"result":{"__proto__":{"polluted":true},'),
    withRootMembers('"constructor":{"prototype":{"polluted":true}}'),
    raw.replace('"result":{', '"result":{"constructor":{"polluted":true},'),
    raw.replace('"result":{', '"result":{"prototype":{"polluted":true},'),
    withRootMembers('"__proto__":{},"__proto__":{"polluted":true}'),
    raw.replace('"action":"create_event"', '"action":"create_event","action":"create_event"'),
    raw.replace('"policyHash":"policy-hash"', '"policyHash":"first","policyHash":"policy-hash"'),
    raw.replace('"policyHash":"policy-hash"', '"policyHash":"\\uD800"'),
    raw.replace('"policyHash":"policy-hash"', '"policyHash":"\\uDC00"'),
    raw.replace('"policyHash":"policy-hash"', '"policyHash":"valid\\uD800suffix"'),
    raw.replace('"policyHash":"policy-hash"', '"policyHash":"first","policy\\u0048ash":"policy-hash"'),
  ];
  const descriptors = Object.getOwnPropertyDescriptors(Object.prototype);
  const names = Object.getOwnPropertyNames(Object.prototype);
  for (const rawBody of cases) {
    expect(rawBody).not.toBe(raw);
    const gate = createFakeLoopbackGate({ scenario, rawBody });
    await expect(new HttpProtocolAdapter(gate.baseUrl, gate.fetch).invokeLocalCall(scenario.envelope))
      .rejects.toMatchObject({ code: "GATE_STATUS", requestId: expect.any(String), correlationId: expect.any(String) });
    expect(gate.calls).toHaveLength(1);
    expect(Object.getOwnPropertyNames(Object.prototype)).toEqual(names);
    expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(descriptors);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  }
});

it("preserves ordinary JSON whitespace, key order, paired Unicode and duplicate values in different objects", async () => {
  const ordinary = { first: { id: "same" }, second: { id: "same" },
    list: [null, false, 1.25, { id: "same", text: 'braces {} [] : and an escaped quote "' }], empty: {}, array: [] };
  expect(parseGateJson(JSON.stringify(ordinary, null, 2))).toEqual(ordinary);
  const scenario = success("create_event");
  const receipt = structuredClone(scenario.receipt);
  receipt.result.policyHash = "paired-😀";
  const gate = createFakeLoopbackGate({ scenario, rawBody: JSON.stringify(receipt, null, 2) });
  await expect(new HttpProtocolAdapter(gate.baseUrl, gate.fetch).invokeLocalCall(scenario.envelope)).resolves.toEqual(receipt);
  expect(gate.calls).toHaveLength(1);
});

it("keeps the offline double test-only and outside the live-suite denominator", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
      ? sourceFiles(`${dir}/${entry.name}`) : entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [`${dir}/${entry.name}`] : []);
  }
  for (const file of [...sourceFiles(`${root}packages/protocol-adapter/src`), ...sourceFiles(`${root}apps/web/src`)]) {
    expect(readFileSync(file, "utf8"), file).not.toMatch(/fake-loopback-gate|test\/support/);
  }
  const pkg = JSON.parse(readFileSync(`${root}packages/protocol-adapter/package.json`, "utf8")) as { exports: unknown; files?: unknown };
  expect(JSON.stringify([pkg.exports, pkg.files])).not.toContain("test");
  const gateSource = readFileSync(new URL("./support/fake-loopback-gate.ts", import.meta.url), "utf8");
  expect(gateSource).not.toMatch(/setTimeout|setInterval|node:net|node:http|createServer|listen\(|Math.random|\bDate\b|WebSocket/);
  // Mirror the evidence scanner's raw-text predicate without matching ourselves.
  const liveMarker = ["support", "reviewed-gate"].join("/");
  const liveFiles = readdirSync(new URL("./", import.meta.url)).filter((file) => file.endsWith(".test.ts"))
    .filter((file) => readFileSync(new URL(file, import.meta.url), "utf8").includes(liveMarker));
  expect(liveFiles).not.toContain("loopback-replay-conformance.test.ts");
});
