import { readFileSync, readdirSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONSENT_COMPOSED } from "../src/consent-bind.js";
import { GIFT_COMPOSED } from "../src/gift-transfer.js";
import { ORGANIZER_COMPOSED } from "../src/organizer-console.js";
import { readAcceptGiftReceipt, readAcceptGiftStructure } from "../src/composer-receipts.js";
import { HttpProtocolAdapter } from "../src/http-adapter.js";
import { ProtocolError } from "../src/types.js";
import { COMPOSER_ACTIONS, createComposerFixtures, runComposerTarget, type ComposerFixture } from "./support/composer-loopback-fixtures.js";
import { createFakeLoopbackGate, type FakeLoopbackGate, type GateAnswer } from "./support/fake-loopback-gate.js";

const seeds = [0, 7, 0xffff_ffff] as const;
const fixturesBySeed = await Promise.all(seeds.map(createComposerFixtures));
const trace = { requestId: "00000000-0000-4000-8000-000000000001", correlationId: "00000000-0000-4000-8000-000000000002" };
beforeEach(() => {
  vi.useFakeTimers();
  let call = 0;
  vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => {
    const id = call++ % 2 === 0 ? trace.requestId : trace.correlationId;
    return id as ReturnType<Crypto["randomUUID"]>;
  });
});
afterEach(() => {
  try { expect(vi.getTimerCount()).toBe(0); }
  finally { vi.useRealTimers(); vi.restoreAllMocks(); }
});

async function replayComposer(fixture: ComposerFixture, gate: FakeLoopbackGate) {
  const adapter = new HttpProtocolAdapter(gate.baseUrl, gate.fetch);
  const fixtures = fixturesBySeed[seeds.indexOf(fixture.seed as typeof seeds[number])];
  let thrown: unknown;
  let returned: unknown;
  const replay = await runComposerTarget(fixture.envelope.action as typeof COMPOSER_ACTIONS[number], fixture.seed, {
    invokeLocalCall: async (input) => {
      if (input.action !== fixture.envelope.action) {
        const prior = fixtures.find((item) => item.envelope.action === input.action);
        if (!prior) throw new Error("Missing prerequisite fixture");
        expect(input).toEqual(prior.envelope);
        return structuredClone(prior.receipt);
      }
      expect(input).toEqual(fixture.envelope);
      try { returned = await adapter.invokeLocalCall(input); return returned; }
      catch (error) { thrown = error; throw error; }
    },
  });
  return { ...replay, thrown, returned };
}

function assertOneFetch(fixture: ComposerFixture, gate: FakeLoopbackGate) {
  expect(gate.calls).toHaveLength(1);
  expect(gate.calls[0]).toEqual({ url: `${gate.baseUrl}/x-kix-contract-only/local-call`, method: "POST",
    redirect: "manual", idempotencyKey: false, envelope: fixture.envelope, ...trace });
}

type Path = (string | number)[];
function paths(value: unknown, path: Path = []): Path[] {
  return [path, ...value !== null && typeof value === "object" ? Object.entries(value).flatMap(([key, child]) =>
    paths(child, [...path, Array.isArray(value) ? Number(key) : key])) : []];
}
const fieldMutations = ["delete", "swapType", "addKey", "inject:economicFinalityClaimed", "inject:fundsExecuted", "inject:productionEndpoint"] as const;
type FieldMutation = typeof fieldMutations[number];
function mutate(receipt: ComposerFixture["receipt"], path: Path, mutation: FieldMutation): string {
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
interface SweepRow { fixtureId: string; path: string; mutation: string; expected: string }
interface SweepCase { fixture: ComposerFixture; row: SweepRow; answer: (base: GateAnswer) => GateAnswer }
const openActions = ["close_sales", "issue_invitation", "complete_event", "cancel_event"];
function sweepFor(fixtures: ComposerFixture[]): SweepCase[] {
  const sweep: SweepCase[] = [];
  function add(fixture: ComposerFixture, path: string, mutation: string, expected: string, answer: SweepCase["answer"]) {
    sweep.push({ fixture, row: { fixtureId: fixture.fixtureId, path, mutation, expected }, answer });
  }
  for (const fixture of fixtures) {
    for (const path of paths(fixture.receipt)) {
      for (const mutation of fieldMutations) {
        const name = "$" + path.map((key) => `.${key}`).join("");
        // Owner ruling 2026-10-26 13:06 KST: preserve exactly four open predicates.
        const expected = name === "$.result" && mutation === "addKey" && openActions.includes(fixture.envelope.action)
          ? "ACCEPT" : mutation === "inject:productionEndpoint" ? "PRODUCTION_ENDPOINT" : "GATE_STATUS";
        const body = mutate(fixture.receipt, path, mutation);
        if (body === JSON.stringify(fixture.receipt)) throw new Error("Mutation disappeared in JSON");
        add(fixture, name, mutation, expected, (base) => ({ ...base, body }));
      }
    }
    const group = fixture.composer === "gift" ? GIFT_COMPOSED : fixture.composer === "consent" ? CONSENT_COMPOSED : ORGANIZER_COMPOSED;
    const otherAction = group[(group.findIndex((action) => action === fixture.envelope.action) + 1) % group.length];
    for (const [mutation, patch] of [
      ["operationId:changed", { operationId: "other-operation" }],
      ["action:other-pinned", { action: otherAction }],
      ["action:unpinned", { action: "not_a_pinned_action" }],
    ] as const) add(fixture, "$", mutation, "GATE_STATUS", (base) => ({ ...base, body: JSON.stringify({ ...fixture.receipt, ...patch }) }));
    for (const [header, code] of [
      ["x-request-id", "STALE_RESPONSE"], ["x-correlation-id", "STALE_RESPONSE"],
      ["x-kix-transport", "GATE_TRANSPORT"], ["x-kix-production-endpoint", "GATE_TRANSPORT"],
      ["x-kix-protocol-truth", "PRODUCTION_ENDPOINT"], ["x-kix-production-conformance", "PRODUCTION_ENDPOINT"],
    ]) add(fixture, "$headers", `drop:${header}`, code, (base) => {
      const headers = { ...base.headers }; delete headers[header]; return { ...base, headers };
    });
    for (const [name, url] of [["other-port", "http://127.0.0.1:8766/"], ["localhost", "http://localhost:8765/"]]) {
      add(fixture, "$origin", `origin:${name}`, "GATE_TRANSPORT", (base) => ({ ...base, url }));
    }
    add(fixture, "$", "array:two-receipts", "GATE_STATUS", (base) => ({ ...base, body: JSON.stringify([fixture.receipt, fixture.receipt]) }));
  }
  return sweep;
}
function renderTable(rows: SweepRow[]) {
  return ["| Fixture | Path | Mutation | Expected outcome |", "| --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.fixtureId} | ${row.path} | ${row.mutation} | ${row.expected} |`)].join("\n");
}
const commonPaths = ["$", "$.domain", "$.operationId", "$.sequence", "$.action", "$.result"];
// Explicit path oracle, independent of recursion and the fixtures' current result keys.
const resultPaths = [
  ["giftId", "termsHash"], ["ticketId", "owner", "rightsVersion", "financialEntries"], ["giftState"],
  ["eventId", "policyHash", "inventoryIds", "inventoryIds.0", "reservationSeconds"],
  ["salesStatus"], ["admissionStatus"], [], [], ["ticketId", "financialEntries"],
  ["allowed", "consentVersion"], ["authorizedAt", "consentVersion", "dispatchDecision", "networkSendPerformed"],
];
const fixedMutations = ["operationId:changed", "action:other-pinned", "action:unpinned",
  "drop:x-request-id", "drop:x-correlation-id", "drop:x-kix-transport", "drop:x-kix-production-endpoint",
  "drop:x-kix-protocol-truth", "drop:x-kix-production-conformance", "origin:other-port", "origin:localhost", "array:two-receipts"];

describe.each(seeds)("composer loopback seed %i", (seed) => {
  const fixtures = fixturesBySeed[seeds.indexOf(seed)];
  const sweep = sweepFor(fixtures);
  it("covers exactly eleven authorized actions and every path/mutation once", () => {
    const actions = fixtures.map((fixture) => fixture.envelope.action).sort();
    expect(actions).toEqual([...COMPOSER_ACTIONS].sort());
    expect(actions).toEqual([...GIFT_COMPOSED, ...ORGANIZER_COMPOSED, ...CONSENT_COMPOSED].sort());
    expect(fixtures.map((fixture) => paths(fixture.receipt).length)).toEqual([8, 10, 7, 11, 7, 7, 6, 6, 8, 8, 10]);
    expect(sweep).toHaveLength(660);
    const key = (row: SweepRow) => `${row.fixtureId}:${row.path}:${row.mutation}`;
    expect(new Set(sweep.map(({ row }) => key(row))).size).toBe(660);
    const required = fixtures.flatMap((fixture, i) => [
      ...[...commonPaths, ...resultPaths[i].map((path) => `$.result.${path}`)].flatMap((path) =>
        fieldMutations.map((mutation) => key({ fixtureId: fixture.fixtureId, path, mutation, expected: "" }))),
      ...fixedMutations.map((mutation) => key({ fixtureId: fixture.fixtureId,
        path: mutation.startsWith("drop:") ? "$headers" : mutation.startsWith("origin:") ? "$origin" : "$", mutation, expected: "" })),
    ]);
    expect(sweep.map(({ row }) => key(row)).sort()).toEqual(required.sort());
    expect(sweep.filter(({ row }) => row.expected === "ACCEPT").map(({ fixture, row }) =>
      `${fixture.envelope.action}:${row.path}:${row.mutation}`).sort()).toEqual([
      "cancel_event:$.result:addKey", "close_sales:$.result:addKey", "complete_event:$.result:addKey", "issue_invitation:$.result:addKey",
    ]);
    for (const fixture of fixtures) {
      expect(["capture", "settle_capture", "commit_trade", "admit", "prepare_trade", "accept_trade"]).not.toContain(fixture.envelope.action);
    }
  });

  it.each(fixtures)("accepts unmodified $fixtureId through its composer", async (fixture) => {
    const gate = createFakeLoopbackGate({ scenario: fixture });
    const replay = await replayComposer(fixture, gate);
    expect(replay.thrown).toBeUndefined();
    expect(replay.returned).toEqual(fixture.receipt);
    expect(replay.outcome).toMatchObject({ kind: "RECEIPT", receipt: fixture.receipt });
    expect(replay.state().halted).toBeNull();
    assertOneFetch(fixture, gate);
  });

  it("enforces all 660 asserted outcomes with one fetch and fences every UNKNOWN", async () => {
    for (const { fixture, row, answer } of sweep) {
      const gate = createFakeLoopbackGate({ scenario: fixture, answer: (base) => {
        const mutated = answer(base);
        expect(mutated, JSON.stringify(row)).not.toEqual(base);
        return mutated;
      } });
      const replay = await replayComposer(fixture, gate);
      assertOneFetch(fixture, gate);
      if (row.expected === "ACCEPT") {
        expect(replay.thrown, JSON.stringify(row)).toBeUndefined();
        expect(replay.outcome).toMatchObject({ kind: "RECEIPT" });
        expect(replay.returned).toEqual({ ...fixture.receipt, result: { ...fixture.receipt.result, extraKey: "x" } });
        expect(replay.state().halted).toBeNull();
      } else {
        expect(replay.thrown, JSON.stringify(row)).toBeInstanceOf(ProtocolError);
        expect(replay.thrown, JSON.stringify(row)).toMatchObject({ code: row.expected, ...trace });
        expect(replay.outcome).toMatchObject({ kind: "UNKNOWN", code: row.expected, identity: { ...fixture.envelope, ...trace } });
        expect(replay.state().halted).toMatchObject({ kind: "UNKNOWN", identity: { ...fixture.envelope, ...trace } });
        expect(await replay.fence()).toMatchObject({ kind: "FENCED", blockedBy: { reason: "halted" } });
        assertOneFetch(fixture, gate);
      }
    }
  });
});

it("emits the seed-7 sweep table verbatim from the bind document", () => {
  const table = renderTable(sweepFor(fixturesBySeed[1]).map(({ row }) => row));
  console.info(`<!-- composer-loopback-sweep:start -->\n${table}\n<!-- composer-loopback-sweep:end -->`);
  const doc = readFileSync(new URL("../../../docs/c-plan-d-invoker-loopback-conformance-stub-apps-bind.md", import.meta.url), "utf8");
  expect(doc.split("<!-- composer-loopback-sweep:start -->\n")[1]?.split("\n<!-- composer-loopback-sweep:end -->")[0]).toBe(table);
});

it("keeps contextual gift acceptance distinct from stateless HTTP validation", () => {
  const receipt = fixturesBySeed[1].find((fixture) => fixture.envelope.action === "accept_gift")!.receipt;
  expect(readAcceptGiftStructure(receipt)).toBe(true);
  expect(readAcceptGiftReceipt(receipt, null)).toBe(false);
  expect(readAcceptGiftReceipt(receipt, { ticketId: "another-ticket", recipient: receipt.result.owner as string })).toBe(false);
  expect(readAcceptGiftReceipt(receipt, { ticketId: receipt.result.ticketId as string, recipient: "another-recipient" })).toBe(false);
});

it.each([
  ["offer_gift", "termsHash"], ["open_admission", "admissionStatus"], ["authorize_marketing", "dispatchDecision"],
] as const)("rejects all 12 hostile JSON cases for %s and leaves prototypes intact", async (action, field) => {
  const fixture = fixturesBySeed[1].find((item) => item.envelope.action === action)!;
  const raw = JSON.stringify(fixture.receipt);
  const rootMembers = (members: string) => `{${members},${raw.slice(1)}`;
  const member = JSON.stringify(field) + ":" + JSON.stringify(fixture.receipt.result[field]);
  const fieldValue = (value: string) => raw.replace(member, `${JSON.stringify(field)}:${value}`);
  const cases = [
    rootMembers('"__proto__":{"polluted":true}'),
    raw.replace('"result":{', '"result":{"__proto__":{"polluted":true},'),
    rootMembers('"constructor":{"prototype":{"polluted":true}}'),
    raw.replace('"result":{', '"result":{"constructor":{"polluted":true},'),
    raw.replace('"result":{', '"result":{"prototype":{"polluted":true},'),
    rootMembers('"__proto__":{},"__proto__":{"polluted":true}'),
    raw.replace(`"action":"${action}"`, `"action":"${action}","action":"${action}"`),
    fieldValue(`"first",${member}`),
    fieldValue('"\\uD800"'), fieldValue('"\\uDC00"'), fieldValue('"valid\\uD800suffix"'),
    fieldValue(`"first",${JSON.stringify(field).replace(field[0], "\\u" + field.charCodeAt(0).toString(16).padStart(4, "0"))}:${JSON.stringify(fixture.receipt.result[field])}`),
  ];
  expect(cases).toHaveLength(12);
  expect(new Set(cases).size).toBe(12);
  const descriptors = Object.getOwnPropertyDescriptors(Object.prototype);
  const names = Object.getOwnPropertyNames(Object.prototype);
  for (const rawBody of cases) {
    expect(rawBody).not.toBe(raw);
    const gate = createFakeLoopbackGate({ scenario: fixture, rawBody });
    const replay = await replayComposer(fixture, gate);
    expect(replay.thrown).toBeInstanceOf(ProtocolError);
    expect(replay.thrown).toMatchObject({ code: "GATE_STATUS", ...trace });
    expect(replay.outcome).toMatchObject({ kind: "UNKNOWN", code: "GATE_STATUS", identity: trace });
    expect(await replay.fence()).toMatchObject({ kind: "FENCED", blockedBy: { reason: "halted" } });
    assertOneFetch(fixture, gate);
    expect(Object.getOwnPropertyNames(Object.prototype)).toEqual(names);
    expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(descriptors);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  }
});

it("keeps offline support outside live evidence and enforces the double's source boundary", () => {
  const source = readFileSync(new URL("./support/fake-loopback-gate.ts", import.meta.url), "utf8");
  expect(source).not.toMatch(/setTimeout|setInterval|node:net|node:http|createServer|listen\(|Math.random|\bDate\b|WebSocket/);
  const liveMarker = ["support", "reviewed-gate"].join("/");
  const liveFiles = readdirSync(new URL("./", import.meta.url)).filter((file) => file.endsWith(".test.ts"))
    .filter((file) => readFileSync(new URL(file, import.meta.url), "utf8").includes(liveMarker));
  expect(liveFiles).not.toContain("composer-loopback-conformance.test.ts");
});
