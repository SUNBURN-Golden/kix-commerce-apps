import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BookingJourney,
  COMMERCE_COMMAND_BINDINGS,
  COMMERCE_METHODS,
  ConsentBind,
  GiftTransfer,
  HttpProtocolAdapter,
  OPENAPI_INTEGRATION_GATE_PIN,
  OrganizerConsole,
  PINNED_ACTIONS,
  ProtocolError,
  createStubConsentInvoker,
  createStubGiftInvoker,
  createStubJourneyInvoker,
  createStubOrganizerInvoker,
  mapOperationalError,
} from "../src/index.js";
import {
  CONTRACT_FIXTURES,
  FIXTURE_CATALOGUE_VERSION,
  FIXTURE_CLASSES,
  FIXTURE_NEVER_SUCCESS_ACTIONS,
  FIXTURE_RULING,
  FIXTURE_TUPLE_KEY,
  FIXTURE_TUPLE_LITERALS,
  acceptRecordedPass,
  assertCatalogueBound,
  classifyAgainstFixture,
  classifyFailedLive,
  fixtureById,
  generateFixture,
  liveTupleKey,
} from "../src/contract-fixtures.js";
import type { LocalCallInput } from "../src/local-call.js";
import { fixtureObservationFor } from "../src/sdk0-mock-scenarios.js";
import { SHOW_POLICY } from "./support/journey-fixture.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resultKeys(outcome: { kind: string; receipt?: Record<string, unknown> }): string[] {
  if (outcome.kind !== "RECEIPT" || !isRecord(outcome.receipt) || !isRecord(outcome.receipt.result)) {
    throw new Error(`expected a receipt, received ${outcome.kind}`);
  }
  return Object.keys(outcome.receipt.result).sort();
}

describe("contract fixture catalogue", () => {
  it("binds version 1 to the live pin tuple and consumes no SDK", () => {
    expect(FIXTURE_CATALOGUE_VERSION).toBe("1");
    expect(FIXTURE_RULING).toBe("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
    expect(() => assertCatalogueBound()).not.toThrow();
    expect(liveTupleKey()).toBe(FIXTURE_TUPLE_KEY);
    expect(FIXTURE_TUPLE_LITERALS.sdkDigest).toBeNull();
    expect(FIXTURE_TUPLE_LITERALS.manifestDigest).toBeNull();
    expect(FIXTURE_TUPLE_LITERALS.vectorDigest).toBeNull();
    expect(FIXTURE_TUPLE_LITERALS.protocolMergeSha).toBe(OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha);
    expect(FIXTURE_TUPLE_LITERALS.pinnedActions).toEqual([...PINNED_ACTIONS]);
    const workflow = readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");
    const pinned = workflow.match(/KIX_PROTOCOL_GATE_SHA: ([0-9a-f]{40})/);
    expect(pinned?.[1]).toBe(FIXTURE_TUPLE_LITERALS.protocolMergeSha);
  });

  it("classifies success, reject, unknown, not-bound, and stale without a shared pass", () => {
    expect(new Set(CONTRACT_FIXTURES.map((fixture) => fixture.klass))).toEqual(new Set(FIXTURE_CLASSES));
    const bookingSuccess = CONTRACT_FIXTURES.filter(
      (fixture) => fixture.screenId === "booking-journey" && fixture.klass === "SUCCESS",
    ).map((fixture) => fixture.identity?.action);
    expect(bookingSuccess).toEqual(["create_event", "prepare_trade", "accept_trade"]);
    for (const fixture of CONTRACT_FIXTURES) {
      const projected = classifyAgainstFixture(fixture.id, fixtureObservationFor(fixture));
      expect(projected.ok, fixture.id).toBe(true);
      if (projected.ok) {
        expect(projected.klass).toBe(fixture.klass);
        expect(projected.confirmed).toBe(fixture.klass === "SUCCESS");
        expect(projected.fallbackToStub).toBe(false);
        expect(projected.retry).toBe(false);
      }
      if (fixture.klass === "SUCCESS" && fixture.identity) {
        expect(FIXTURE_NEVER_SUCCESS_ACTIONS).not.toContain(fixture.identity.action);
      }
    }
    const create = "booking-journey.create_event.success";
    const prepare = "booking-journey.prepare_trade.success";
    expect(acceptRecordedPass({ tupleKey: liveTupleKey(), caseId: create, klass: "SUCCESS" }, create)).toEqual({
      accepted: true,
      caseId: create,
    });
    expect(acceptRecordedPass({ tupleKey: liveTupleKey(), caseId: create, klass: "SUCCESS" }, prepare)).toEqual({
      accepted: false,
      reason: "DIFFERENT_CASE",
    });
    expect(
      acceptRecordedPass({ tupleKey: `${FIXTURE_TUPLE_KEY}|previous`, caseId: create, klass: "SUCCESS" }, create),
    ).toEqual({ accepted: false, reason: "DIFFERENT_TUPLE" });
    expect(
      acceptRecordedPass({ tupleKey: liveTupleKey(), caseId: "not-bound.placeHold", klass: "NOT_BOUND" }, "not-bound.placeHold"),
    ).toEqual({ accepted: false, reason: "NOT_SUCCESS" });
    expect(acceptRecordedPass({ tupleKey: liveTupleKey(), caseId: "missing", klass: "SUCCESS" }, "missing")).toEqual({
      accepted: false,
      reason: "UNKNOWN_CASE",
    });
  });

  it("rejects a new enum, a missing field, a different identity, and a different tuple", () => {
    const success = fixtureById("booking-journey.create_event.success");
    expect(classifyAgainstFixture(success.id, fixtureObservationFor(success, { klass: "CAPTURED" }))).toMatchObject({
      ok: false,
      reason: "NEW_ENUM",
    });
    expect(classifyAgainstFixture(success.id, fixtureObservationFor(success, { action: "mint_right" }))).toMatchObject({
      ok: false,
      reason: "NEW_ENUM",
      field: "action",
    });
    expect(
      classifyAgainstFixture(success.id, fixtureObservationFor(success, { presentFields: success.resultKeys.filter((key) => key !== "policyHash") })),
    ).toMatchObject({ ok: false, reason: "MISSING_FIELD", field: "policyHash" });
    expect(classifyAgainstFixture(success.id, fixtureObservationFor(success, { operationId: "op-other" }))).toMatchObject({
      ok: false,
      reason: "DIFFERENT_IDENTITY",
    });
    expect(classifyAgainstFixture(success.id, fixtureObservationFor(success, { actor: "other-buyer" }))).toMatchObject({
      ok: false,
      reason: "DIFFERENT_IDENTITY",
    });
    expect(classifyAgainstFixture(success.id, fixtureObservationFor(success, { tupleKey: "tuple-0" }))).toMatchObject({
      ok: false,
      reason: "DIFFERENT_TUPLE",
    });
    expect(classifyAgainstFixture(success.id, fixtureObservationFor(success, { presentFields: [...success.resultKeys, "feeShare"] }))).toMatchObject({
      ok: false,
      reason: "INVALID",
      field: "feeShare",
    });
    expect(classifyAgainstFixture("missing-case", fixtureObservationFor(success))).toMatchObject({ ok: false, reason: "INVALID" });

    const held = fixtureById("not-bound.placeHold");
    expect(held.consideredAction).toBe("reserve_listing");
    expect(held.consideredAction).toBe(COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction);
    expect(held.mappedOntoPrepareTrade).toBe(false);
    expect(classifyAgainstFixture(held.id, fixtureObservationFor(held, { action: "prepare_trade" }))).toMatchObject({
      ok: false,
      reason: "DIFFERENT_IDENTITY",
    });
    expect(classifyAgainstFixture(held.id, fixtureObservationFor(held, { action: "reserve_listing" }))).toMatchObject({
      ok: false,
      reason: "DIFFERENT_IDENTITY",
    });
    expect(classifyAgainstFixture(held.id, fixtureObservationFor(held))).toMatchObject({
      ok: true,
      klass: "NOT_BOUND",
      confirmed: false,
    });
  });

  it("does not replace a failed live call with a stub success", () => {
    expect(classifyFailedLive("STALE_RESPONSE")).toMatchObject({
      klass: "STALE",
      substituteStub: false,
      confirmed: false,
      fallbackToStub: false,
      retry: false,
    });
    expect(classifyFailedLive("INTERNAL_ERROR").klass).toBe("UNKNOWN");
    expect(classifyFailedLive("GATE_UNAVAILABLE").klass).toBe("UNKNOWN");
    expect(classifyFailedLive("").code).toBe("GATE_UNAVAILABLE");
    expect(classifyFailedLive("EVENT_EXISTS").klass).toBe("REJECT");
    expect(classifyFailedLive("STALE_CONSENT_VERSION").klass).toBe("REJECT");
    expect(classifyFailedLive("STALE_VERSION").klass).toBe("STALE");
    expect(classifyFailedLive("CREDENTIAL_STALE").klass).toBe("STALE");
    expect(mapOperationalError("STALE_RESPONSE")).toMatchObject({
      state: "unavailable",
      fallbackToStub: false,
      retry: false,
    });
    expect(() => classifyFailedLive("EVENT_EXISTS", { promoteToStubSuccess: true })).toThrow(ProtocolError);
    expect(() => classifyFailedLive("EVENT_EXISTS", { promoteToStubSuccess: true })).toThrow(/stub success/);

    const success = fixtureById("booking-journey.create_event.success");
    expect(classifyAgainstFixture(success.id, fixtureObservationFor(success, { callSucceeded: false }))).toMatchObject({
      ok: false,
      reason: "STUB_SUBSTITUTE",
    });
    expect(classifyAgainstFixture(success.id, fixtureObservationFor(success, { substituteStub: true }))).toMatchObject({
      ok: false,
      reason: "STUB_SUBSTITUTE",
    });
    expect(classifyAgainstFixture(success.id, fixtureObservationFor(success, { compute: "finance" }))).toMatchObject({
      ok: false,
      reason: "GENERATOR_BOUNDARY",
    });
  });

  it("copies key names and refuses finance and rights", () => {
    const offer = fixtureById("gift-transfer.offer_gift.success");
    const copied = generateFixture({ fixtureId: offer.id, compute: "copy" });
    expect(copied.resultKeys).toEqual(["giftId", "termsHash"]);
    expect(copied.amounts).toBeNull();
    expect(copied.rights).toBeNull();
    expect(copied.financialEntries).toBeNull();
    expect(copied.shares).toBeNull();
    expect(copied.fallbackToStub).toBe(false);
    expect(copied.retry).toBe(false);
    expect(Object.values(copied).some((value) => typeof value === "number")).toBe(false);
    expect(() => generateFixture({ fixtureId: offer.id, compute: "finance" })).toThrow(/does not compute finance or rights/);
    expect(() => generateFixture({ fixtureId: offer.id, compute: "rights" })).toThrow(ProtocolError);
    const source = readFileSync(path.join(repoRoot, "packages/protocol-adapter/src/contract-fixtures.ts"), "utf8");
    expect(source).not.toContain("Idempotency-Key");
    expect(source).not.toContain("fetch(");
    expect(source).not.toMatch(/primaryPrice\s*:/);
  });

  it("keeps every desk method not-bound on its recorded screen", () => {
    expect(CONTRACT_FIXTURES.filter((fixture) => fixture.klass === "NOT_BOUND")).toHaveLength(COMMERCE_METHODS.length);
    for (const method of COMMERCE_METHODS) {
      const fixture = fixtureById(`not-bound.${method}`);
      expect(fixture.method).toBe(method);
      expect(fixture.consideredAction).toBe(COMMERCE_COMMAND_BINDINGS[method].consideredAction);
      expect(fixture.observation).toBe(COMMERCE_COMMAND_BINDINGS[method].reason);
      expect(fixture.mappedOntoPrepareTrade).toBe(false);
      expect(fixture.ownsPass).toBe(false);
    }
    expect(fixtureById("not-bound.confirmBooking").consideredAction).toBe("capture");
    expect(fixtureById("not-bound.settlementPreview").consideredAction).toBe("settle_capture");
    expect(fixtureById("not-bound.checkAdmission").consideredAction).toBe("admit");
  });
});

describe("adapter receipts use the catalogue key names", () => {
  it("accepts the booking success key sets and does not confirm a short or foreign receipt", async () => {
    const seen: LocalCallInput[] = [];
    const stub = createStubJourneyInvoker();
    const journey = new BookingJourney({
      async invokeLocalCall(input) {
        seen.push(structuredClone(input));
        return stub.invokeLocalCall(input);
      },
    });
    const created = await journey.createEvent({
      operationId: "op-fix-create",
      eventId: "show-1",
      organizer: "organizer",
      policy: SHOW_POLICY,
      seats: ["A1"],
    });
    const prepared = await journey.prepareTrade({ operationId: "op-fix-prepare", tradeId: "trade-1", buyer: "buyer-a" });
    const accepted = await journey.acceptTrade({ operationId: "op-fix-accept" });
    expect(resultKeys(created)).toEqual([...fixtureById("booking-journey.create_event.success").resultKeys].sort());
    expect(resultKeys(prepared)).toEqual([...fixtureById("booking-journey.prepare_trade.success").resultKeys].sort());
    expect(resultKeys(accepted)).toEqual([...fixtureById("booking-journey.accept_trade.success").resultKeys].sort());
    expect(seen.map((call) => call.action)).toEqual(["create_event", "prepare_trade", "accept_trade"]);
    expect(seen.every((call) => call.action !== "capture" && call.action !== "settle_capture")).toBe(true);

    const short = createStubJourneyInvoker();
    const dropped = new BookingJourney({
      async invokeLocalCall(input) {
        const receipt = await short.invokeLocalCall(input);
        if (!isRecord(receipt) || !isRecord(receipt.result)) {
          return receipt;
        }
        const rest = { ...receipt.result };
        delete rest.policyHash;
        return { ...receipt, result: rest };
      },
    });
    const unknown = await dropped.createEvent({
      operationId: "op-fix-create",
      eventId: "show-1",
      organizer: "organizer",
      policy: SHOW_POLICY,
      seats: ["A1"],
    });
    expect(unknown.kind).toBe("UNKNOWN");
    expect(
      acceptRecordedPass(
        { tupleKey: liveTupleKey(), caseId: "booking-journey.create_event.success", klass: "SUCCESS" },
        "booking-journey.create_event.unknown",
      ),
    ).toEqual({ accepted: false, reason: "DIFFERENT_CASE" });

    const swapped = createStubJourneyInvoker();
    const foreign = new BookingJourney({
      async invokeLocalCall(input) {
        const receipt = await swapped.invokeLocalCall(input);
        if (!isRecord(receipt)) {
          return receipt;
        }
        return { ...receipt, operationId: "op-other" };
      },
    });
    const mismatched = await foreign.createEvent({
      operationId: "op-fix-create",
      eventId: "show-1",
      organizer: "organizer",
      policy: SHOW_POLICY,
      seats: ["A1"],
    });
    expect(mismatched.kind).toBe("UNKNOWN");
  });

  it("matches gift, consent, and organizer success key names from the same catalogue", async () => {
    const gift = new GiftTransfer(createStubGiftInvoker());
    const offered = await gift.offerGift({
      operationId: "op-fix-offer",
      giftId: "gift-1",
      donor: "desk-donor",
      recipient: "recipient-b",
      ticketId: "ticket-9",
      expectedVersion: 1,
      expiresAt: 600,
    });
    expect(resultKeys(offered)).toEqual([...fixtureById("gift-transfer.offer_gift.success").resultKeys].sort());

    const consent = new ConsentBind(createStubConsentInvoker());
    const set = await consent.setConsent({
      operationId: "op-fix-consent",
      subject: "subject-a",
      allowed: true,
      business: "desk-business",
      channel: "desk-channel",
      eventId: "show-1",
      expectedConsentVersion: 0,
      purpose: "desk-purpose",
    });
    expect(resultKeys(set)).toEqual([...fixtureById("marketing-m05.set_consent.success").resultKeys].sort());

    const organizer = new OrganizerConsole(createStubOrganizerInvoker());
    const created = await organizer.createEvent({
      operationId: "op-fix-org-create",
      eventId: "show-1",
      organizer: "organizer",
      policy: SHOW_POLICY,
      seats: ["A1"],
    });
    expect(resultKeys(created)).toEqual([...fixtureById("organizer-console.create_event.success").resultKeys].sort());
    expect(resultKeys(created)).toEqual([...fixtureById("booking-journey.create_event.success").resultKeys].sort());
    expect(
      acceptRecordedPass(
        { tupleKey: liveTupleKey(), caseId: "booking-journey.create_event.success", klass: "SUCCESS" },
        "organizer-console.create_event.success",
      ),
    ).toEqual({ accepted: false, reason: "DIFFERENT_CASE" });
  });

  it("leaves a failed http placeHold not-bound and does not call fetch", async () => {
    let called = false;
    const fetchImpl: typeof fetch = async () => {
      called = true;
      throw new Error("fetch");
    };
    const http = new HttpProtocolAdapter("http://127.0.0.1:9", fetchImpl);
    await expect(http.placeHold({ eventId: "evt_lanterns", quantity: 1 })).rejects.toThrow(/not-bound/);
    await expect(http.placeHold({ eventId: "evt_lanterns", quantity: 1 })).rejects.toThrow(/reserve_listing/);
    expect(called).toBe(false);
    const held = fixtureById("not-bound.placeHold");
    expect(held.klass).toBe("NOT_BOUND");
    expect(held.mappedOntoPrepareTrade).toBe(false);
  });
});
