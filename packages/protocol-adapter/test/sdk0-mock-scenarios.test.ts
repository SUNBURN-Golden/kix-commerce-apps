import { readFileSync } from "node:fs";
import type { LocalCallEnvelope } from "#kix-sdk-0/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookingJourney } from "../src/booking-journey.js";
import { GateRejectedError } from "../src/http-adapter.js";
import { buildLocalCallEnvelope } from "../src/local-call.js";
import { assertLocalCallReceipt, enforceRemotePayloadGuards } from "../src/payload-guards.js";
import {
  FIXTURE_CLASSES, FIXTURE_TUPLE_LITERALS, classifyAgainstFixture, fixtureById,
} from "../src/contract-fixtures.js";
import {
  SDK0_MOCK_PROVENANCE, SDK0_MOCK_SCENARIO_IDS, createSdk0MockScenario, scenarioObservation,
} from "../src/sdk0-mock-scenarios.js";
import { KIX_SDK_0_PIN } from "../src/sdk-pin.js";
import { ProtocolError } from "../src/types.js";
import { SHOW_POLICY } from "./support/journey-fixture.js";

const createId = "booking-journey.create_event.success";
const successIds = [createId, "booking-journey.prepare_trade.success", "booking-journey.accept_trade.success"];
const expectedKeys = [
  ["eventId", "inventoryIds", "policyHash", "reservationSeconds"],
  ["externalOrderId", "status", "termsHash", "ticketId", "tradeId"],
  ["accepted"],
];

afterEach(() => vi.unstubAllGlobals());

describe("p-sdk-0 offline scenario kit", () => {
  it("binds all five classes to the existing catalogue and separately records BOOTSTRAP provenance", () => {
    expect(SDK0_MOCK_SCENARIO_IDS).toHaveLength(9);
    const scenarios = SDK0_MOCK_SCENARIO_IDS.map((fixtureId) => createSdk0MockScenario({ fixtureId, seed: 7 }));
    expect(new Set(scenarios.map((s) => s.klass))).toEqual(new Set(FIXTURE_CLASSES));
    expect(SDK0_MOCK_PROVENANCE).toMatchObject({
      producerMergeSha: "a74e7c459d3be6754ac3cf24503e43c7bc312358",
      manifestSha256: KIX_SDK_0_PIN.manifestSha256,
      catalogueSha256: KIX_SDK_0_PIN.catalogueSha256,
      profileKind: "BOOTSTRAP", profileRevision: "bootstrap-1", grants: "catalogue-schema-binding only",
      semanticConformance: false, productionEndpoint: false, protocolTruth: false,
    });
    expect(FIXTURE_TUPLE_LITERALS).toMatchObject({ sdkDigest: null, manifestDigest: null, vectorDigest: null });
    for (const scenario of scenarios) {
      expect(scenario.fixture).toEqual(fixtureById(scenario.fixtureId));
      expect(scenario.source).toBe("stub-shape");
      expect(scenario.sdkBinding).toEqual(SDK0_MOCK_PROVENANCE);
      expect(classifyAgainstFixture(scenario.fixtureId, scenarioObservation(scenario))).toEqual({
        ok: true, klass: scenario.klass, confirmed: scenario.klass === "SUCCESS", fallbackToStub: false, retry: false,
      });
      if (scenario.envelope) {
        // This assignment uses the actual vendored SDK declaration, not the app's wider action:string type.
        const envelope: LocalCallEnvelope = scenario.envelope;
        expect(buildLocalCallEnvelope(envelope)).toEqual(envelope);
        expect(envelope).toMatchObject(scenario.fixture.identity!);
      }
      if (scenario.klass === "SUCCESS") {
        expect(Object.keys(scenario.receipt).sort()).toEqual(["action", "domain", "operationId", "result", "sequence"]);
        expect(() => assertLocalCallReceipt(scenario.receipt, scenario.envelope)).not.toThrow();
        expect(() => enforceRemotePayloadGuards(scenario.receipt)).not.toThrow();
        expect(scenario.failure).toBeNull();
      } else {
        expect(scenario.receipt).toBeNull();
        expect(scenario.projection.confirmed).toBe(false);
      }
    }
    successIds.forEach((fixtureId, index) => {
      const s = createSdk0MockScenario({ fixtureId, seed: 7 });
      expect(Object.keys(s.receipt!.result).sort()).toEqual(expectedKeys[index]);
    });
  });

  it("is deterministic across repeated, interleaved and fresh-module calls at boundary seeds", async () => {
    const fresh = await import("../src/sdk0-mock-scenarios.js");
    for (const seed of [0, 7, 0xffff_ffff]) {
      for (const fixtureId of SDK0_MOCK_SCENARIO_IDS) {
        const original = createSdk0MockScenario({ fixtureId, seed });
        createSdk0MockScenario({ fixtureId: createId, seed: seed === 7 ? 8 : 7 });
        expect(createSdk0MockScenario({ fixtureId, seed })).toEqual(original);
        expect(JSON.parse(JSON.stringify(original))).toEqual(original);
        expect(fresh.createSdk0MockScenario({ fixtureId, seed })).toEqual(original);
      }
    }
    vi.resetModules();
    const reloaded = await import("../src/sdk0-mock-scenarios.js");
    expect(reloaded.createSdk0MockScenario({ fixtureId: createId, seed: 7 }))
      .toEqual(createSdk0MockScenario({ fixtureId: createId, seed: 7 }));
  });

  it("returns isolated objects and varies only synthetic labels with seed", () => {
    for (const fixtureId of SDK0_MOCK_SCENARIO_IDS) {
      const input = { fixtureId, seed: 7 };
      const original = createSdk0MockScenario(input);
      const changed = createSdk0MockScenario(input);
      changed.fixture.resultKeys = ["foreign"];
      if (changed.fixture.identity) changed.fixture.identity.actor = "foreign";
      changed.projection.confirmed = false;
      // Even mutation by an untyped consumer must not change module-level provenance.
      Reflect.set(changed.sdkBinding, "profileKind", "foreign");
      if (changed.envelope) {
        changed.envelope.body.domain = "foreign";
        if (Array.isArray(changed.envelope.body.seats)) changed.envelope.body.seats.push("foreign");
        if (changed.envelope.body.policy) Reflect.set(changed.envelope.body.policy as object, "primaryPrice", 1);
      }
      if (changed.receipt) {
        changed.receipt.result.foreign = true;
        if (Array.isArray(changed.receipt.result.inventoryIds)) changed.receipt.result.inventoryIds.push("foreign");
      }
      if (changed.failure) changed.failure.code = "foreign";
      expect(createSdk0MockScenario(input)).toEqual(original);
      const another = createSdk0MockScenario({ fixtureId, seed: 8 });
      expect(another.fixture).toEqual(original.fixture);
      expect(another.klass).toBe(original.klass);
      expect(another.projection).toEqual(original.projection);
      if (original.envelope && another.envelope) {
        expect(another.envelope.operationId).toBe(original.envelope.operationId);
        expect(another.envelope.actor).toBe(original.envelope.actor);
        expect(another.envelope.body).not.toEqual(original.envelope.body);
        if (original.envelope.action === "create_event") {
          expect(original.envelope.body.policy).toEqual(SHOW_POLICY);
          expect(another.envelope.body.policy).toEqual(SHOW_POLICY);
        }
        if (original.envelope.action === "prepare_trade") expect(another.envelope.body.amount).toBe(100000);
      }
    }
  });

  it("fails closed on unsupported cases, invalid seeds and malformed SDK bodies", () => {
    for (const seed of [-1, 0x1_0000_0000, 0.5, NaN, Infinity, -Infinity, "7", null, undefined]) {
      expect(() => createSdk0MockScenario({ fixtureId: createId, seed: seed as number })).toThrow(/unsigned 32-bit/);
    }
    for (const fixtureId of ["missing", "gift-transfer.offer_gift.success", "not-bound.checkAdmission", "capture", "settle_capture"]) {
      expect(() => createSdk0MockScenario({ fixtureId, seed: 7 })).toThrow(/Unsupported/);
    }
    for (const fixtureId of successIds) {
      const s = createSdk0MockScenario({ fixtureId, seed: 7 });
      const envelope = s.envelope!;
      expect(() => buildLocalCallEnvelope({ ...envelope, action: "new_command" })).toThrow(/Unknown protocol action/);
      expect(() => buildLocalCallEnvelope({ ...envelope, body: { ...envelope.body, extra: true } })).toThrow(/Unknown field/);
      expect(() => buildLocalCallEnvelope({ ...envelope, body: { ...envelope.body, domain: "foreign" } })).toThrow(/DOMAIN_MISMATCH/);
      const missing = { ...envelope.body };
      delete missing.domain;
      expect(() => buildLocalCallEnvelope({ ...envelope, body: missing })).toThrow(/Missing field/);
      expect(() => buildLocalCallEnvelope({ ...envelope, body: { ...envelope.body, domain: 1 } })).toThrow();
      expect(() => assertLocalCallReceipt({ ...s.receipt, extra: true }, envelope)).toThrow();
      expect(() => assertLocalCallReceipt({ ...s.receipt, operationId: "foreign" }, envelope)).toThrow();
      expect(() => enforceRemotePayloadGuards({ ...s.receipt, protocolTruth: true })).toThrow();
      expect(classifyAgainstFixture(fixtureId, { ...scenarioObservation(s), presentFields: [] }))
        .toMatchObject({ ok: false, reason: "MISSING_FIELD" });
    }
  });

  it("feeds the actual composed journey with linked snapshots and stops at accept_trade", async () => {
    const scenarios = successIds.map((fixtureId) => createSdk0MockScenario({ fixtureId, seed: 7 }));
    let calls = 0;
    const journey = new BookingJourney({ async invokeLocalCall(input) {
      const scenario = scenarios[calls++];
      expect(input).toEqual(scenario.envelope);
      return scenario.receipt;
    } });
    const created = await journey.createEvent({ operationId: "op-fix-create", eventId: "show-mock-00000007",
      organizer: "organizer", policy: SHOW_POLICY, seats: ["A1"] });
    const prepared = await journey.prepareTrade({ operationId: "op-fix-prepare", tradeId: "trade-mock-00000007", buyer: "buyer-a" });
    const accepted = await journey.acceptTrade({ operationId: "op-fix-accept" });
    expect([created.kind, prepared.kind, accepted.kind]).toEqual(["RECEIPT", "RECEIPT", "RECEIPT"]);
    expect(calls).toBe(3);
    expect((await journey.acceptTrade({ operationId: "again" })).kind).toBe("FENCED");
    expect(calls).toBe(3);
  });

  it.each(["reject", "unknown", "stale"])("keeps %s unconfirmed and fences the next journey write", async (suffix) => {
    const scenario = createSdk0MockScenario({ fixtureId: `booking-journey.create_event.${suffix}`, seed: 7 });
    if (!scenario.failure || !scenario.envelope) throw new Error("expected failure scenario");
    const failure = scenario.failure;
    let calls = 0;
    const journey = new BookingJourney({ async invokeLocalCall(input) {
      calls++;
      expect(input).toEqual(scenario.envelope);
      if (suffix === "reject") throw new GateRejectedError("synthetic rejection", failure.code, failure, 422);
      throw new ProtocolError("synthetic unconfirmed outcome", failure.code, failure);
    } });
    const outcome = await journey.createEvent({ operationId: scenario.envelope.operationId, eventId: "show-mock-00000007",
      organizer: "organizer", policy: SHOW_POLICY, seats: ["A1"] });
    expect(outcome.kind).toBe(suffix === "reject" ? "REJECTED" : "UNKNOWN");
    expect(outcome).toMatchObject({ code: failure.code, identity: { requestId: failure.requestId, correlationId: failure.correlationId } });
    expect((await journey.prepareTrade({ operationId: "next", tradeId: "trade", buyer: "buyer-a" })).kind).toBe("FENCED");
    expect(calls).toBe(1);
    expect(scenario.klass).toBe(suffix === "stale" ? "STALE" : suffix === "reject" ? "REJECT" : "UNKNOWN");
  });

  it("records locked not-bound reasons without envelopes or remapping", () => {
    for (const [method, consideredAction] of [["placeHold", "reserve_listing"], ["confirmBooking", "capture"], ["settlementPreview", "settle_capture"]]) {
      const s = createSdk0MockScenario({ fixtureId: `not-bound.${method}`, seed: 7 });
      expect(s).toMatchObject({ klass: "NOT_BOUND", envelope: null, receipt: null, failure: null,
        method, consideredAction, reason: fixtureById(`not-bound.${method}`).observation });
      expect(s.fixture.mappedOntoPrepareTrade).toBe(false);
    }
  });

  it("imports and constructs every case without network, storage, time or a process launcher", async () => {
    const forbidden = vi.fn(() => { throw new Error("offline kit used an external effect"); });
    for (const name of ["fetch", "WebSocket", "XMLHttpRequest", "localStorage", "sessionStorage"]) vi.stubGlobal(name, forbidden);
    vi.resetModules();
    const kit = await import("../src/sdk0-mock-scenarios.js");
    for (const fixtureId of kit.SDK0_MOCK_SCENARIO_IDS) kit.createSdk0MockScenario({ fixtureId, seed: 7 });
    expect(forbidden).not.toHaveBeenCalled();
    const source = readFileSync(new URL("../src/sdk0-mock-scenarios.ts", import.meta.url), "utf8");
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
    expect(imports.sort()).toEqual([
      "#kix-sdk-0/catalogue", "#kix-sdk-0/client", "./contract-fixtures.js", "./local-call.js",
      "./openapi-contract-pin.js", "./payload-guards.js", "./sdk-pin.js", "./types.js",
    ].sort());
    expect(source).not.toMatch(/\b(?:fetch|WebSocket|XMLHttpRequest|setTimeout|setInterval|randomUUID|Date)\b|Math\.random|node:|import\(/);
    const barrel = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    expect(barrel).not.toContain("sdk0-mock-scenarios");
  });

  it("documents every case, exact provenance and the limited offline claims", () => {
    const doc = readFileSync(new URL("../../../docs/c-sdk0-mock-scenario-kit-stub-apps-bind.md", import.meta.url), "utf8");
    for (const id of SDK0_MOCK_SCENARIO_IDS) expect(doc).toContain(id);
    for (const field of ["producerMergeSha", "producerSourceCommit", "manifestSha256", "catalogueSha256", "profileSha256"] as const) {
      expect(doc).toContain(SDK0_MOCK_PROVENANCE[field]);
    }
    expect(doc).toContain("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
    expect(doc).toContain("catalogue-schema-binding only");
    expect(doc).toContain("UNDETERMINED — 담당 사용자/법무");
    expect(doc).toContain("skipped, never passed");
    const readme = readFileSync(new URL("../../../README.md", import.meta.url), "utf8");
    expect(readme).toContain("docs/c-sdk0-mock-scenario-kit-stub-apps-bind.md");
  });
});
