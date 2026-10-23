import type { CommandName } from "#kix-sdk-0/catalogue";
import type { LocalCallEnvelope } from "#kix-sdk-0/client";
import {
  assertCatalogueBound,
  fixtureById,
  liveTupleKey,
  projectFixture,
  type ContractFixture,
  type FixtureObservation,
  type FixtureProjection,
} from "./contract-fixtures.js";
import { buildLocalCallEnvelope } from "./local-call.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import { assertLocalCallReceipt, enforceRemotePayloadGuards } from "./payload-guards.js";
import { requireSdkPin } from "./sdk-pin.js";
import { ProtocolError } from "./types.js";

/** App-internal offline demo/test material. Import directly, outside the runtime barrel. */
export const SDK0_MOCK_SCENARIO_IDS = Object.freeze([
  "booking-journey.create_event.success",
  "booking-journey.prepare_trade.success",
  "booking-journey.accept_trade.success",
  "booking-journey.create_event.reject",
  "booking-journey.create_event.unknown",
  "booking-journey.create_event.stale",
  "not-bound.placeHold",
  "not-bound.confirmBooking",
  "not-bound.settlementPreview",
] as const);

export type Sdk0MockScenarioId = (typeof SDK0_MOCK_SCENARIO_IDS)[number];
type MockCommand = Extract<CommandName, "create_event" | "prepare_trade" | "accept_trade">;

const pin = requireSdkPin();
/** BOOTSTRAP provenance complements the current v2 consumption tuple; v1 stays history. */
export const SDK0_MOCK_PROVENANCE = Object.freeze({
  producerMergeSha: pin.producerMergeSha,
  producerSourceCommit: pin.producerSourceCommit,
  manifestSha256: pin.manifestSha256,
  catalogueSha256: pin.catalogueSha256,
  profileKind: pin.profileKind,
  profileRevision: pin.profileRevision,
  profileSha256: pin.profileSha256,
  grants: pin.grants,
  semanticConformance: false,
  productionEndpoint: false,
  protocolTruth: false,
} as const);

interface ScenarioBase {
  fixtureId: Sdk0MockScenarioId;
  seed: number;
  source: "stub-shape";
  tupleKey: string;
  fixture: ContractFixture;
  projection: FixtureProjection;
  sdkBinding: typeof SDK0_MOCK_PROVENANCE;
}

/** Locally guarded shape; p-sdk-0 does not supply generated result types. */
interface MockReceipt {
  domain: string;
  operationId: string;
  sequence: number;
  action: MockCommand;
  result: Record<string, unknown>;
}

export type Sdk0MockScenario = ScenarioBase & (
  | { klass: "SUCCESS"; envelope: LocalCallEnvelope; receipt: MockReceipt; failure: null }
  | { klass: "REJECT" | "UNKNOWN" | "STALE"; envelope: LocalCallEnvelope; receipt: null;
      failure: { code: string; requestId: string; correlationId: string } }
  | { klass: "NOT_BOUND"; envelope: null; receipt: null; failure: null;
      method: NonNullable<ContractFixture["method"]>; consideredAction: string | null; reason: string }
);

/** Shared catalogue observation construction for the full fixture library, with negative-test patches. */
export function fixtureObservationFor(
  fixture: ContractFixture,
  patch: Partial<FixtureObservation> = {},
): FixtureObservation {
  return {
    tupleKey: liveTupleKey(),
    klass: fixture.klass,
    operationId: fixture.identity?.operationId,
    actor: fixture.identity?.actor,
    action: fixture.identity?.action,
    method: fixture.method ?? undefined,
    code: fixture.code ?? undefined,
    presentFields: [...fixture.resultKeys],
    callSucceeded: fixture.klass === "SUCCESS",
    substituteStub: false,
    compute: "none",
    ...patch,
  };
}

/** Observe constructed output, rather than assuming receipt keys match the catalogue. */
export function scenarioObservation(scenario: Sdk0MockScenario): FixtureObservation {
  return fixtureObservationFor(scenario.fixture, {
    tupleKey: scenario.tupleKey,
    klass: scenario.klass,
    operationId: scenario.envelope?.operationId,
    actor: scenario.envelope?.actor,
    action: scenario.envelope?.action,
    code: scenario.failure?.code,
    presentFields: scenario.receipt ? Object.keys(scenario.receipt.result) : [],
    callSucceeded: scenario.receipt !== null,
  });
}

/**
 * Pure snapshots, no transport or runtime adapter selection. A seed changes only
 * synthetic references and trace labels, never policy, identity, or outcome.
 */
export function createSdk0MockScenario(input: { fixtureId: string; seed: number }): Sdk0MockScenario {
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffff_ffff) {
    throw new ProtocolError("Mock scenario seed must be an unsigned 32-bit integer.", "INVALID_SEED");
  }
  const fixtureId = SDK0_MOCK_SCENARIO_IDS.find((id) => id === input.fixtureId);
  if (!fixtureId) {
    throw new ProtocolError(`Unsupported SDK0 mock scenario ${input.fixtureId}.`, "UNKNOWN_CASE");
  }
  assertCatalogueBound();
  const fixture = structuredClone(fixtureById(fixtureId));
  const base: ScenarioBase = {
    fixtureId,
    seed: input.seed,
    source: "stub-shape",
    tupleKey: fixture.tupleKey,
    fixture,
    projection: projectFixture(fixture),
    sdkBinding: { ...SDK0_MOCK_PROVENANCE },
  };
  if (fixture.klass === "NOT_BOUND" && fixture.method) {
    return { ...base, klass: "NOT_BOUND", envelope: null, receipt: null, failure: null,
      method: fixture.method, consideredAction: fixture.consideredAction, reason: fixture.observation };
  }
  const label = input.seed.toString(16).padStart(8, "0");
  const eventId = `show-mock-${label}`;
  const inventoryId = `inv-mock-${label}`;
  const tradeId = `trade-mock-${label}`;
  const termsHash = `terms-mock-${label}`;
  // Existing SHOW_POLICY test literals; no price, fee, or expiry policy is derived.
  const snapshots: Record<MockCommand, { body: Record<string, unknown>; result: Record<string, unknown>; sequence: number }> = {
    create_event: {
      body: { domain: PINNED_PROTOCOL_DOMAIN, eventId, organizer: "organizer", seats: ["A1"],
        policy: { primaryPrice: 100000, resaleCap: 150000, primaryFeeBps: 500, resaleFeeBps: 300,
          resaleOrganizerBps: 200, resaleAllowed: true, refundProfile: "FULL_CHAIN_UNWIND_FIXTURE" } },
      result: { eventId, policyHash: "policy-hash", inventoryIds: [inventoryId], reservationSeconds: 900 },
      sequence: 1,
    },
    prepare_trade: {
      body: { domain: PINNED_PROTOCOL_DOMAIN, tradeId, inventoryId, amount: 100000, buyer: "buyer-a",
        expectedInventoryVersion: 0, expectedVersion: 0 },
      result: { tradeId, ticketId: `ticket-mock-${label}`, externalOrderId: `order-mock-${label}`,
        status: "PREPARED", termsHash },
      sequence: 2,
    },
    accept_trade: {
      body: { domain: PINNED_PROTOCOL_DOMAIN, tradeId, termsHash },
      result: { accepted: true },
      sequence: 3,
    },
  };
  const identity = fixture.identity;
  if (!identity || (identity.action !== "create_event" && identity.action !== "prepare_trade" && identity.action !== "accept_trade")) {
    throw new ProtocolError("SDK0 mock command is outside the composed journey.");
  }
  const snapshot = snapshots[identity.action];
  const envelope = { ...identity, action: identity.action, body: snapshot.body } satisfies LocalCallEnvelope;
  buildLocalCallEnvelope(envelope);
  if (fixture.klass === "SUCCESS") {
    const receipt = { domain: PINNED_PROTOCOL_DOMAIN, operationId: envelope.operationId,
      sequence: snapshot.sequence, action: identity.action, result: snapshot.result } satisfies MockReceipt;
    assertLocalCallReceipt(receipt, envelope);
    enforceRemotePayloadGuards(receipt);
    return { ...base, klass: "SUCCESS", envelope, receipt, failure: null };
  }
  if ((fixture.klass === "REJECT" || fixture.klass === "UNKNOWN" || fixture.klass === "STALE") && fixture.code) {
    return { ...base, klass: fixture.klass, envelope, receipt: null,
      failure: { code: fixture.code, requestId: `req-mock-${label}`, correlationId: `corr-mock-${label}` } };
  }
  throw new ProtocolError("SDK0 mock fixture has an unsupported disposition.");
}
