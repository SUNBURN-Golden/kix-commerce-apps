import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  JOURNEY_NOT_COMPOSED,
  QUALIFICATION_CLASSES,
  QUALIFICATION_DENOMINATOR_AREAS,
  QUALIFICATION_DENOMINATORS,
  QUALIFICATION_EVIDENCE_SCOPES,
  QUALIFICATION_GUEST_ACTOR,
  QUALIFICATION_HOLD_NOT_BOUND,
  QUALIFICATION_NON_CLAIM_FIELDS,
  QUALIFICATION_NOT_BOUND_REASON,
  QUALIFICATION_NOT_COMPOSED,
  QUALIFICATION_REVIEW_CANDIDATES,
  QUALIFICATION_RULING,
  QUALIFICATION_STATE,
  createNotBoundQualificationRunner,
  createStubQualificationRunner,
  qualificationOpsBundle,
  qualificationRunnerPortFor,
  refuseQualificationPacket,
  type QualificationPacket,
} from "../src/index.js";
import { FIXTURE_SCREENS } from "../src/contract-fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

const CTX = "stub|kix|qualification-runner|1";

async function packetOf(scenario: "clean" | "claims-pass" = "clean"): Promise<QualificationPacket> {
  const port = createStubQualificationRunner({ scenario });
  const outcome = await port.run({ contextKey: CTX, intentRef: "oq-run-1" });
  if (outcome.kind !== "ready") {
    throw new Error(`expected a ready packet, received ${outcome.kind}`);
  }
  return outcome.packet;
}

describe("operational qualification packet", () => {
  it("runs the whole matrix and records every exercise class", async () => {
    const packet = await packetOf();
    expect(packet.qualificationState).toBe(QUALIFICATION_STATE);
    expect(packet.environment).toBe("stub");
    expect(packet.ruling).toBe(QUALIFICATION_RULING);
    expect(packet.summary.classesCovered).toBe(QUALIFICATION_CLASSES.length);
    expect(packet.summary.classesTotal).toBe(QUALIFICATION_CLASSES.length);
    for (const klass of QUALIFICATION_CLASSES) {
      const covering = packet.exercises.filter((item) => item.klass === klass);
      expect(covering.length, `class ${klass} has no exercise`).toBeGreaterThan(0);
      expect(covering.every((item) => item.verdict === "recorded"), `class ${klass} has a deviation`).toBe(true);
    }
    expect(packet.summary.deviations).toBe(0);
    expect(packet.journeys.length).toBeGreaterThanOrEqual(14);
  });

  it("never substitutes a per-call success for an end-to-end journey close", async () => {
    const packet = await packetOf();
    const rival = packet.journeys.find((item) => item.id === "journey.platform-trade-rival");
    expect(rival).toBeDefined();
    expect(rival?.verdict).toBe("open");
    const book = rival?.calls.find((item) => item.label === "book");
    expect(book?.outcome).toBe("CONFIRMED");
    const declined = packet.journeys.find((item) => item.id === "journey.provider-declined");
    expect(declined?.verdict).toBe("open");
    const begin = declined?.calls.find((item) => item.label === "begin");
    expect(begin?.outcome).toBe("CONFIRMED");
    const clean = packet.journeys.find((item) => item.id === "journey.platform-trade-clean");
    expect(clean?.verdict).toBe("closed");
  });

  it("keeps the five unresolved areas on separate denominators", async () => {
    const packet = await packetOf();
    expect(packet.denominators.map((area) => area.area)).toEqual([...QUALIFICATION_DENOMINATOR_AREAS]);
    for (const area of packet.denominators) {
      expect(area.denominator).toBe(area.items.length);
      expect(area.unresolved).toBe(area.items.length);
      expect(area.items.length).toBeGreaterThan(0);
      for (const item of area.items) {
        expect(item.blockedBy.length).toBeGreaterThan(0);
      }
    }
    const ops = qualificationOpsBundle();
    const pending = QUALIFICATION_DENOMINATORS.flatMap((area) => area.items).length;
    expect(ops.incidentHandoff.pendingProducers).toBe(pending);
  });

  it("reports evidence per scope and keeps unverified items unverified", async () => {
    const packet = await packetOf();
    expect(packet.evidence.map((scope) => scope.scope)).toEqual([...QUALIFICATION_EVIDENCE_SCOPES]);
    for (const scope of packet.evidence) {
      expect(scope.rows.length).toBeGreaterThan(0);
    }
    const performance = packet.evidence.find((scope) => scope.scope === "performance");
    expect(performance?.rows.some((row) => row.basis === "unverified")).toBe(true);
    const security = packet.evidence.find((scope) => scope.scope === "security");
    expect(security?.rows.some((row) => row.id === "security.identity-switch")).toBe(true);
  });

  it("states every non-claim as literal false and never promotes", async () => {
    const packet = await packetOf();
    for (const field of QUALIFICATION_NON_CLAIM_FIELDS) {
      expect(packet.nonClaims[field], `${field} is not false`).toBe(false);
    }
    expect(packet.promotion.promoted).toBe(false);
    expect(packet.promotion.publicDeploy).toBe(false);
    expect(packet.promotion.realMoneyApproval).toBe(false);
    expect(packet.promotion.serviceQualification).toBe(false);
    expect(refuseQualificationPacket(packet)).toBeNull();
  });

  it("refuses a packet that claims a promotion or is malformed", async () => {
    const packet = await packetOf("claims-pass");
    const refusal = refuseQualificationPacket(packet);
    expect(refusal).not.toBeNull();
    expect(refusal?.field).toBe("publicDeploy");
  });

  it("records the locked bindings and the never-composed list without remapping them", async () => {
    const packet = await packetOf();
    const hold = packet.bindingChecks.find((item) => item.id === "bindings.hold-record");
    expect(hold?.verdict).toBe("recorded");
    expect(COMMERCE_COMMAND_BINDINGS.placeHold.status).toBe("not-bound");
    expect(COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction).toBe("reserve_listing");
    expect(QUALIFICATION_HOLD_NOT_BOUND.mappedOntoPrepareTrade).toBe(false);
    const neverComposed = packet.bindingChecks.find((item) => item.id === "bindings.never-composed");
    expect(neverComposed?.verdict).toBe("recorded");
    expect(QUALIFICATION_NOT_COMPOSED.map((row) => row.action)).toEqual([
      ...JOURNEY_NOT_COMPOSED.map((row) => row.action),
      "refund_ticket",
    ]);
    const notBound = packet.bindingChecks.find((item) => item.id === "bindings.not-bound-ports");
    expect(notBound?.verdict).toBe("recorded");
  });

  it("records the pin tuple and keeps the producer digests null", async () => {
    const packet = await packetOf();
    expect(packet.pins.contractOpenApiSha256.length).toBeGreaterThan(0);
    expect(packet.pins.gateOpenApiSha256.length).toBeGreaterThan(0);
    expect(packet.pins.protocolMergeSha.length).toBeGreaterThan(0);
    expect(packet.pins.sdkDigest).toBeNull();
    expect(packet.pins.manifestDigest).toBeNull();
    expect(packet.pins.vectorDigest).toBeNull();
    expect(packet.pins.consumedProducerChange).toBe(false);
  });

  it("bundles the review candidates and the operations material", async () => {
    const packet = await packetOf();
    expect(packet.reviewCandidates).toEqual(QUALIFICATION_REVIEW_CANDIDATES);
    expect(packet.reviewCandidates.every((item) => item.status === "candidate")).toBe(true);
    expect(packet.reviewCandidates.some((item) => item.route === "/qualification")).toBe(true);
    expect(packet.opsBundle.opsSupport.keptSeparate).toContain("UNKNOWN");
    expect(packet.opsBundle.opsSupport.keptSeparate).toContain("NOT_BOUND");
    expect(packet.opsBundle.opsSupport.keptSeparate).toContain("STALE");
    expect(packet.opsBundle.uiReviewMaterial.fixtureScreens).toBe(FIXTURE_SCREENS.length);
  });

  it("is deterministic apart from the packet id", async () => {
    const port = createStubQualificationRunner();
    const first = await port.run({ contextKey: CTX, intentRef: "oq-1" });
    const second = await port.run({ contextKey: CTX, intentRef: "oq-2" });
    if (first.kind !== "ready" || second.kind !== "ready") {
      throw new Error("expected two ready packets");
    }
    expect(first.packet.packetId).not.toBe(second.packet.packetId);
    const { packetId: _a, ...restA } = first.packet;
    const { packetId: _b, ...restB } = second.packet;
    expect(restA).toEqual(restB);
  });

  it("answers not-bound on integration-http and claims nothing on read-lost", async () => {
    const notBound = createNotBoundQualificationRunner();
    const outcome = await notBound.run({ contextKey: CTX, intentRef: "oq-nb" });
    expect(outcome.kind).toBe("not-bound");
    if (outcome.kind === "not-bound") {
      expect(outcome.reason).toBe(QUALIFICATION_NOT_BOUND_REASON);
    }
    const viaFactory = qualificationRunnerPortFor("integration-http");
    expect((await viaFactory.run({ contextKey: CTX, intentRef: "oq-nb-2" })).kind).toBe("not-bound");
    expect(qualificationRunnerPortFor("stub").source).toBe("synthetic-qualification");
  });

  it("fails closed when the pin tuple changes", async () => {
    const port = createStubQualificationRunner({
      expectedTuple: {
        contractOpenApiSha256: "changed",
        contractInfoVersion: "x",
        contractMainSha: "x",
        gateOpenApiSha256: "x",
        protocolMergeSha: "x",
        protocolFeatureSha: "x",
        sourceProtocolContractSha256: "x",
        domain: "kix:fixture:lifecycle:0.3",
        pinnedActions: [],
        sdkDigest: null,
        manifestDigest: null,
        vectorDigest: null,
      },
    });
    const outcome = await port.run({ contextKey: CTX, intentRef: "oq-tuple" });
    expect(outcome.kind).toBe("tuple-changed");
    if (outcome.kind === "tuple-changed") {
      expect(outcome.field).toBe("contractOpenApiSha256");
    }
  });

  it("composes no protocol command and contains no forbidden tokens", () => {
    const source = readFileSync(path.join(repoRoot, "packages/protocol-adapter/src/operational-qualification.ts"), "utf8");
    for (const forbidden of ["invokeLocalCall", "Idempotency-Key", "Math.random", "Date.now", "fetch("]) {
      expect(source.includes(forbidden), `operational-qualification.ts mentions ${forbidden}`).toBe(false);
    }
    const controllerSource = readFileSync(
      path.join(repoRoot, "packages/protocol-adapter/src/operational-qualification-controller.ts"),
      "utf8",
    );
    for (const forbidden of ["invokeLocalCall", "Idempotency-Key", "Math.random", "Date.now", "fetch("]) {
      expect(controllerSource.includes(forbidden), `operational-qualification-controller.ts mentions ${forbidden}`).toBe(false);
    }
  });

  it("keeps the guest actor a separate context label", () => {
    expect(QUALIFICATION_GUEST_ACTOR).toBe("qualification-reviewer");
    expect(QUALIFICATION_GUEST_ACTOR).not.toBe("platform-desk");
  });
});
