import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { canonicalStringify } from "#kix-sdk-0/jsonschema";
import { QUALIFIED_FIXTURE_SHA256, verifiedFixtureWrites } from "../src/commerce-fixture-qualification.js";
import * as commands from "../src/commerce-journey-command.js";
import type { CommerceJourneyCall, CommerceJourneyPort, CommerceJourneyStep, FixtureStep } from "../src/commerce-journey-command.js";
import type { CommerceJourneyBranch, FixtureContext } from "../src/commerce-journey.js";
import { HttpProtocolAdapter } from "../src/http-adapter.js";
import type { MarketStep } from "../src/resale-journey-fixture.js";
import { StubProtocolAdapter } from "../src/stub-adapter.js";
import { journeyFor } from "./support/commerce-journey.js";
import { fixtureJourney, through } from "./support/resale-journey.js";

type Tuple = {
  level: string;
  source_authentication: string;
  method: string;
  path: string;
  action: string;
  machine: string;
  op: string;
  subject_field: string;
  body_schema_sha256: string;
  contexts: { context: FixtureContext; steps: Record<string, string[]>; control_vector_ids: string[] }[];
};
type Vector = {
  id: string;
  context: FixtureContext;
  commerce_step?: FixtureStep;
  setup: string[];
  envelope: { operationId: string; action: string; actor: string; body: Record<string, unknown> };
  expected: { kind: string };
};

const read = (file: string) => JSON.parse(readFileSync(new URL("../vendor/" + file, import.meta.url), "utf8"));
const table = read("commerce-journey/docs/status/COMMERCE_FIXTURE_TUPLE_CONFORMANCE_V1.json") as {
  record_schema_version: string;
  producer: { repository: string; source_commit: string };
  pins: { producer: { path: string; sha256: string }[] };
  tuples: Tuple[];
};
const { vectors } = read("kix-sdk-0/conformance/vectors/commerce-fixture-tuple.vectors.json") as { vectors: Vector[] };
const { commands: fsm } = read("commerce-journey/docs/contracts/openapi/fsm-command-contract.json") as {
  commands: Record<string, { machine: string; op: string; subject_field: string; schema: unknown }>;
};
const vectorById = new Map(vectors.map(vector => [vector.id, vector]));
const targets = table.tuples.flatMap(tuple => tuple.contexts.flatMap(({ context, steps }) =>
  Object.entries(steps).flatMap(([step, ids]) => ids.map(id => {
    const vector = vectorById.get(id)!;
    const prior = vector.setup.map(setup => vectorById.get(setup)!).reverse().find(item => item.expected.kind === "accept");
    const { idempotency_key, ...body } = vector.envelope.body;
    return { tuple, context, step: step as FixtureStep, vector, confirmed: prior?.commerce_step ?? null, body, idempotency_key };
  })),
));
const digest = (value: unknown) => createHash("sha256").update(canonicalStringify(value)).digest("hex");

it("authorizes exactly the published 28 actions, 62 context/step pairs and 63 prior-state transitions", () => {
  expect(table.record_schema_version).toBe("kix-commerce-fixture-tuple-conformance/1");
  expect(table.producer.source_commit).toBe("8ba7f6c36373ac0ec49246f51f7471c164ac3a28");
  expect(new Set(table.tuples.map(row => row.action)).size).toBe(28);
  expect(new Set(targets.map(({ context, step }) => `${context}|${step}`)).size).toBe(62);
  const expected = Object.fromEntries(targets.map(({ tuple, context, step, confirmed, vector, body, idempotency_key }) => {
    const { action, machine, op, subject_field, body_schema_sha256 } = tuple;
    expect(tuple).toMatchObject({
      level: "SEMANTIC_CONFORMANCE", source_authentication: "FIXTURE_ONLY", method: "POST",
      path: "/x-kix-contract-only/local-call",
    });
    expect(fsm[action]).toMatchObject({ machine, op, subject_field });
    expect(digest(fsm[action].schema), action).toBe(body_schema_sha256);
    expect(vector).toMatchObject({ context, commerce_step: step, envelope: { action } });
    expect(idempotency_key).toEqual(expect.any(String));
    expect(idempotency_key).not.toBe(vector.envelope.operationId);
    return [`${context}|${confirmed ?? ""}|${step}`, [
      action, machine, op, subject_field, body_schema_sha256, vector.envelope.actor, body,
    ]];
  }));
  expect(Object.keys(expected)).toHaveLength(63);
  const pins = new Map(table.pins.producer.map(pin => [pin.path, pin.sha256]));
  expect(digest([
    table.producer.repository, "4472b0fb64d377d97fd2993673a4485459986606",
    pins.get("docs/contracts/openapi/kix-protocol.contract-only.openapi.json"),
    pins.get("docs/contracts/openapi/kix-protocol.integration-gate.openapi.json"),
    pins.get("sdk/generated/catalogue.ts"), "POST", "/x-kix-contract-only/local-call", expected,
  ])).toBe(QUALIFIED_FIXTURE_SHA256);
  expect(verifiedFixtureWrites()).toEqual(expected);
});

function fixture(context: FixtureContext, port: CommerceJourneyPort) {
  if (context === "resale-market") {
    const journey = fixtureJourney(port);
    return { state: () => journey.state(), run: (step: FixtureStep) => journey.run(step as MarketStep) };
  }
  const journey = journeyFor(context.slice("booking-".length) as CommerceJourneyBranch, port);
  return { state: () => journey.state(), run: (step: FixtureStep) => journey.run(step as CommerceJourneyStep) };
}

const BASE = "http://127.0.0.1:8765";
const recorder = () => vi.fn<typeof fetch>().mockRejectedValue(new Error("record the send"));

it.each(targets)("sends only the reviewed envelope for $context/$step after $confirmed", async ({ context, confirmed, step, vector }) => {
  const fetch = recorder();
  const http = new HttpProtocolAdapter(BASE, fetch);
  const stub = new StubProtocolAdapter();
  let useHttp = false;
  const journey = fixture(context, {
    advanceCommerceJourney: call => (useHttp ? http : stub).advanceCommerceJourney(call),
  });
  while (journey.state().confirmed !== confirmed) {
    const next = journey.state().next;
    if (next === undefined) throw new Error(`Unreachable predecessor ${confirmed}`);
    expect(await journey.run(next), next).toMatchObject({ kind: "CONFIRMED" });
  }
  useHttp = true;
  const outcome = await journey.run(step);
  expect(outcome).toMatchObject({ kind: "UNKNOWN" });
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init] = fetch.mock.calls[0];
  expect(url).toBe(BASE + "/x-kix-contract-only/local-call");
  expect(init).toMatchObject({ method: "POST", redirect: "manual" });
  expect(new Headers(init?.headers).has("Idempotency-Key")).toBe(false);
  const envelope = JSON.parse(String(init?.body));
  expect(envelope).toEqual({
    ...vector.envelope, operationId: outcome?.operationId,
    body: { ...vector.envelope.body, idempotency_key: outcome?.idempotencyKey },
  });
  expect(envelope.operationId).not.toBe(envelope.body.idempotency_key);
  expect(await journey.run(step)).toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("holds an unlisted action and an offline replay at the HTTP boundary with zero sends", async () => {
  const fetch = recorder();
  const http = new HttpProtocolAdapter(BASE, fetch);
  const unlisted = { operationId: "op-release", actor: "commerce-journey-fixture", action: "resale_release_hold",
    body: { hold_id: "hold-1", buyer_role: "buyer-2", idempotency_key: "key-release" } };
  expect(table.tuples.some(row => row.action === unlisted.action)).toBe(false);
  await expect(http.invokeLocalCall(unlisted)).rejects.toMatchObject({ code: "FSM_VERIFIER_REQUIRED" });
  await expect(http.advanceCommerceJourney({ step: unlisted.action as FixtureStep, links: {},
    operationId: unlisted.operationId, idempotencyKey: unlisted.body.idempotency_key })).rejects.toMatchObject({ code: "NOT_BOUND" });
  const replay = vectorById.get("booking-admission/replay-consume-B")!;
  await expect(http.invokeLocalCall(replay.envelope)).rejects.toMatchObject({ code: "FSM_VERIFIER_REQUIRED" });
  await expect(http.advanceCommerceJourney({ step: "consume-B", links: {}, operationId: replay.envelope.operationId,
    idempotencyKey: String(replay.envelope.body.idempotency_key) })).rejects.toMatchObject({ code: "NOT_BOUND" });
  expect(fetch).not.toHaveBeenCalled();
});

it("holds a refund cancellation substituted into the admission context before any send", async () => {
  const fetch = recorder();
  const http = new HttpProtocolAdapter(BASE, fetch);
  const stub = new StubProtocolAdapter();
  const journey = journeyFor("admission", {
    advanceCommerceJourney: call => (call.step === "cancel-after-payment" ? http : stub).advanceCommerceJourney(call),
  });
  while (journey.state().confirmed !== "payment-B") {
    const next = journey.state().next!;
    expect(await journey.run(next)).toMatchObject({ kind: "CONFIRMED" });
  }
  const build = commands.commandFor;
  const override = vi.spyOn(commands, "commandFor").mockImplementationOnce(call =>
    build({ ...call, step: "cancel-C", links: { reservation_id: "reserve-C" } }));
  try {
    expect(await journey.run("cancel-after-payment")).toMatchObject({ kind: "NOT_SENT", code: "NOT_BOUND" });
    expect(journey.state()).toMatchObject({ confirmed: "payment-B", fenced: true });
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    override.mockRestore();
  }
});

it("holds market cancellation after payment both in the journey and as a direct call", async () => {
  const stub = new StubProtocolAdapter();
  const fetch = recorder();
  const http = new HttpProtocolAdapter(BASE, fetch);
  const journey = fixtureJourney({
    advanceCommerceJourney: call => (call.step === "market-cancel" ? http : stub).advanceCommerceJourney(call),
  });
  await through(journey, "market-pay");
  expect(await journey.run("market-cancel")).toBeUndefined();
  await expect(http.advanceCommerceJourney({ step: "market-cancel", operationId: "op-cancel", idempotencyKey: "key-cancel",
    links: { listing_id: "list-1" } })).rejects.toMatchObject({ code: "NOT_BOUND" });
  expect(fetch).not.toHaveBeenCalled();
});

it("consumes the exact journey call once and holds a copy, a repeat and a direct call", async () => {
  const fetch = recorder();
  const http = new HttpProtocolAdapter(BASE, fetch);
  const journey = journeyFor("refund", {
    async advanceCommerceJourney(call: CommerceJourneyCall) {
      await expect(http.advanceCommerceJourney({ ...call })).rejects.toMatchObject({ code: "NOT_BOUND" });
      const [first, repeat] = await Promise.allSettled([
        http.advanceCommerceJourney(call), http.advanceCommerceJourney(call),
      ]);
      expect(repeat).toMatchObject({ status: "rejected", reason: { code: "NOT_BOUND" } });
      if (first.status === "rejected") throw first.reason;
      return first.value;
    },
  });
  expect(await journey.run("reservation-clock")).toMatchObject({ kind: "UNKNOWN", code: "GATE_UNAVAILABLE" });
  expect(await journey.run("reservation-clock")).toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(1);
});
