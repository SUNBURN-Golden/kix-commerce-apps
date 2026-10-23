import { DISCOVERY_READ_TUPLE_LITERALS } from "../src/discovery-read.js";
import { KIX_SDK_0_CONSUMPTION_DIGESTS } from "../src/sdk-consumption-tuple.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  JOURNEY_NOT_COMPOSED,
  RELEASE_DECISION_ITEMS,
  RELEASE_DENOMINATOR_AREAS,
  RELEASE_DENOMINATORS,
  RELEASE_GUEST_ACTOR,
  RELEASE_HANDOFF_LANES,
  RELEASE_HOLD_NOT_BOUND,
  RELEASE_NON_CLAIM_FIELDS,
  RELEASE_NOT_BOUND_REASON,
  RELEASE_NOT_COMPOSED,
  RELEASE_RULING,
  RELEASE_STATE,
  createNotBoundReleaseRunner,
  createStubReleaseRunner,
  refuseReleasePacket,
  releaseOpsHandoff,
  releaseRunnerPortFor,
  type ReleasePacket,
} from "../src/index.js";
import { FIXTURE_SCREENS, fixturesForScreen, liveTupleKey } from "../src/contract-fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

const CTX = "stub|kix|release-runner|1";

async function packetOf(scenario: "clean" | "claims-pass" = "clean"): Promise<ReleasePacket> {
  const port = createStubReleaseRunner({ scenario });
  const outcome = await port.run({ contextKey: CTX, intentRef: "rel-run-1" });
  if (outcome.kind !== "ready") {
    throw new Error(`expected a ready packet, received ${outcome.kind}`);
  }
  return outcome.packet;
}

describe("platform release packet", () => {
  it("records a release candidate packet pinned to the live source and contract tuple", async () => {
    const packet = await packetOf();
    expect(packet.releaseState).toBe(RELEASE_STATE);
    expect(packet.releaseState).toBe("STUB_CANDIDATE_RECORDED");
    expect(packet.environment).toBe("stub");
    expect(packet.ruling).toBe(RELEASE_RULING);
    expect(packet.candidate.tupleKey).toBe(liveTupleKey());
    expect(packet.candidate.producer.contractOpenApiSha256.length).toBeGreaterThan(0);
    expect(packet.candidate.producer.gateOpenApiSha256.length).toBeGreaterThan(0);
    expect(packet.candidate.producer.protocolMergeSha.length).toBeGreaterThan(0);
    expect(packet.candidate.producer.sdkDigest).toBe(KIX_SDK_0_CONSUMPTION_DIGESTS.sdkDigest);
    expect(packet.candidate.producer.manifestDigest).toBe(KIX_SDK_0_CONSUMPTION_DIGESTS.manifestDigest);
    expect(packet.candidate.producer.vectorDigest).toBe(KIX_SDK_0_CONSUMPTION_DIGESTS.vectorDigest);
    expect(packet.candidate.producer.consumedProducerChange).toBe(true);
    expect(packet.candidate.consumer.fixtureScreens).toBe(FIXTURE_SCREENS.length);
    expect(packet.candidate.artifact.digest).toBeNull();
    expect(packet.candidate.artifact.deployed).toBe(false);
    expect(packet.candidate.config.defaultMode).toBe("stub");
    expect(packet.candidate.config.retry).toBe(false);
    expect(packet.candidate.config.idempotencyKey).toBe(false);
    expect(packet.candidate.config.stubFallback).toBe(false);
    expect(packet.candidate.config.productionFlags).toBe(false);
    expect(packet.candidate.config.runtimeEnabled).toBe(false);
    expect(refuseReleasePacket(packet)).toBeNull();
  });

  it("keeps technical qualification and real user acceptance as separate records", async () => {
    const packet = await packetOf();
    expect(packet.qualification.source).toBe("synthetic-qualification");
    expect(packet.qualification.runOutcome).toBe("CONFIRMED");
    expect(packet.qualification.packetId).not.toBeNull();
    expect(packet.qualification.qualificationState).toBe("STUB_RUN_RECORDED");
    expect(packet.qualification.classesCovered).toBe(packet.qualification.classesTotal);
    expect(packet.qualification.technicalOnly).toBe(true);
    expect(packet.qualification.acceptanceSeparated).toBe(true);
    expect(packet.userAcceptance.state).toBe("PENDING_USER_DECISION");
    expect(packet.userAcceptance.realUserAcceptance).toBe(false);
    expect(packet.userAcceptance.technicalQualificationIsAcceptance).toBe(false);
    expect(packet.userAcceptance.decidedBy).toBe("user");
  });

  it("presents install, publish, and operate and takes none of them", async () => {
    const packet = await packetOf();
    expect(packet.decisions.map((item) => item.id)).toEqual([...RELEASE_DECISION_ITEMS]);
    const install = packet.decisions.find((item) => item.id === "install");
    expect(install?.decision).toBe("awaiting-user-decision");
    expect(install?.basis).toBe("verified-stub-scope");
    const publish = packet.decisions.find((item) => item.id === "publish");
    const operate = packet.decisions.find((item) => item.id === "operate");
    expect(publish?.decision).toBe("not-open");
    expect(operate?.decision).toBe("not-open");
    expect(publish?.blockedBy).toContain("k-platform-release");
    expect(packet.decisions.every((item) => item.decision !== "awaiting-user-decision" || item.basis === "verified-stub-scope")).toBe(true);
  });

  it("bundles the five handoff lanes", async () => {
    const packet = await packetOf();
    const lanes = Object.keys(packet.opsHandoff).sort();
    expect(lanes).toEqual([...RELEASE_HANDOFF_LANES].sort());
    const ops = releaseOpsHandoff();
    expect(ops.support.keptSeparate).toContain("UNKNOWN");
    expect(ops.support.keptSeparate).toContain("NOT_BOUND");
    expect(ops.support.keptSeparate).toContain("STALE");
    expect(ops.incident.note).toContain("PENDING_PRODUCERS");
    expect(ops.privacy.note).toContain("redact");
    expect(ops["update-rollback"].note).toContain("never promoted");
  });

  it("keeps deferred scope and unresolved items on five separate denominators", async () => {
    const packet = await packetOf();
    expect(packet.denominators.map((area) => area.area)).toEqual([...RELEASE_DENOMINATOR_AREAS]);
    for (const area of packet.denominators) {
      expect(area.denominator).toBe(area.items.length);
      expect(area.unresolved).toBe(area.items.length);
      expect(area.items.length).toBeGreaterThan(0);
      for (const item of area.items) {
        expect(item.blockedBy.length).toBeGreaterThan(0);
      }
    }
    const scope = packet.denominators.find((area) => area.area === "scope");
    expect(scope?.items.some((item) => item.id === "c-platform-release")).toBe(true);
    expect(scope?.items.some((item) => item.id === "c-platform-operational-qualification")).toBe(true);
    const gate = packet.denominators.find((area) => area.area === "gate");
    expect(gate?.items.some((item) => item.blockedBy.includes("k-platform-release"))).toBe(true);
    expect(gate?.items.some((item) => item.blockedBy.includes("user RELEASE decision"))).toBe(true);
    expect(RELEASE_DENOMINATORS).toEqual(packet.denominators);
  });

  it("states every non-claim as literal false and releases nothing", async () => {
    const packet = await packetOf();
    for (const field of RELEASE_NON_CLAIM_FIELDS) {
      expect(packet.nonClaims[field], `${field} is not false`).toBe(false);
    }
    expect(packet.release.released).toBe(false);
    expect(packet.release.publicDeploy).toBe(false);
    expect(packet.release.realMoneyApproval).toBe(false);
    expect(packet.release.realOperationsStarted).toBe(false);
    expect(refuseReleasePacket(packet)).toBeNull();
  });

  it("refuses a packet that claims a release or is malformed", async () => {
    const packet = await packetOf("claims-pass");
    const refusal = refuseReleasePacket(packet);
    expect(refusal).not.toBeNull();
    expect(refusal?.field).toBe("released");
  });

  it("refuses a packet scoped to a different source or contract tuple", async () => {
    const packet = await packetOf();
    const otherSource = {
      ...packet,
      candidate: { ...packet.candidate, tupleKey: "previous-tuple|different-source" },
    };
    const refusal = refuseReleasePacket(otherSource);
    expect(refusal?.field).toBe("candidate.tupleKey");
  });

  it("refuses a packet that decided or counted qualification as acceptance", async () => {
    const packet = await packetOf();
    const decided = {
      ...packet,
      decisions: packet.decisions.map((item) =>
        item.id === "install" ? { ...item, decision: "released" } : item,
      ),
    };
    expect(refuseReleasePacket(decided)?.field).toBe("decisions");
    const merged = {
      ...packet,
      userAcceptance: { ...packet.userAcceptance, state: "ACCEPTED" },
    };
    expect(refuseReleasePacket(merged)?.field).toBe("userAcceptance");
    const confused = {
      ...packet,
      qualification: { ...packet.qualification, acceptanceSeparated: false },
    };
    expect(refuseReleasePacket(confused)?.field).toBe("qualification");
  });

  it("refuses a malformed packet whole instead of throwing", async () => {
    const packet = await packetOf();
    const malformed: [string, unknown, string][] = [
      ["a non-packet answer", null, "packet"],
      ["a packet without nonClaims", { ...packet, nonClaims: undefined }, "nonClaims"],
      ["a packet claiming a state word", { ...packet, releaseState: "RELEASED" }, "releaseState"],
      ["a packet off the stub environment", { ...packet, environment: "production" }, "environment"],
      ["a packet without an id", { ...packet, packetId: "" }, "packetId"],
      ["a packet without a release record", { ...packet, release: undefined }, "release"],
      ["a packet with a partial release record", { ...packet, release: { note: "x" } }, "release"],
      ["a packet without a candidate", { ...packet, candidate: undefined }, "candidate.tupleKey"],
      ["a packet without decisions", { ...packet, decisions: undefined }, "decisions"],
      ["a packet with string denominators", { ...packet, denominators: "five" }, "denominators"],
    ];
    for (const [label, body, field] of malformed) {
      const refusal = refuseReleasePacket(body);
      expect(refusal, label).not.toBeNull();
      expect(refusal?.field, label).toBe(field);
    }
  });

  it("records the locked bindings and the never-composed list without remapping them", async () => {
    const packet = await packetOf();
    const hold = packet.bindingChecks.find((item) => item.id === "bindings.hold-record");
    expect(hold?.verdict).toBe("recorded");
    expect(COMMERCE_COMMAND_BINDINGS.placeHold.status).toBe("not-bound");
    expect(COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction).toBe("reserve_listing");
    expect(RELEASE_HOLD_NOT_BOUND.mappedOntoPrepareTrade).toBe(false);
    const neverComposed = packet.bindingChecks.find((item) => item.id === "bindings.never-composed");
    expect(neverComposed?.verdict).toBe("recorded");
    expect(RELEASE_NOT_COMPOSED.map((row) => row.action)).toEqual([
      ...JOURNEY_NOT_COMPOSED.map((row) => row.action),
      "refund_ticket",
    ]);
    const notBound = packet.bindingChecks.find((item) => item.id === "bindings.not-bound-port");
    expect(notBound?.verdict).toBe("recorded");
    const scope = packet.bindingChecks.find((item) => item.id === "bindings.approval-scope");
    expect(scope?.verdict).toBe("recorded");
  });

  it("is deterministic apart from the packet and candidate ids", async () => {
    const port = createStubReleaseRunner();
    const first = await port.run({ contextKey: CTX, intentRef: "rel-1" });
    const second = await port.run({ contextKey: CTX, intentRef: "rel-2" });
    if (first.kind !== "ready" || second.kind !== "ready") {
      throw new Error("expected two ready packets");
    }
    expect(first.packet.packetId).not.toBe(second.packet.packetId);
    const { packetId: _a, candidate: candA, ...restA } = first.packet;
    const { packetId: _b, candidate: candB, ...restB } = second.packet;
    expect(restA).toEqual(restB);
    const { candidateId: _ca, ...candidateA } = candA;
    const { candidateId: _cb, ...candidateB } = candB;
    expect(candidateA).toEqual(candidateB);
  });

  it("answers not-bound on integration-http and claims nothing on read-lost", async () => {
    const notBound = createNotBoundReleaseRunner();
    const outcome = await notBound.run({ contextKey: CTX, intentRef: "rel-nb" });
    expect(outcome.kind).toBe("not-bound");
    if (outcome.kind === "not-bound") {
      expect(outcome.reason).toBe(RELEASE_NOT_BOUND_REASON);
    }
    const viaFactory = releaseRunnerPortFor("integration-http");
    expect((await viaFactory.run({ contextKey: CTX, intentRef: "rel-nb-2" })).kind).toBe("not-bound");
    expect(releaseRunnerPortFor("stub").source).toBe("synthetic-release");
  });

  it.each(["sdkDigest", "manifestDigest", "vectorDigest"] as const)("refuses %s drift before building a packet", async (field) => {
    for (const value of ["changed", null]) {
      const port = createStubReleaseRunner({ expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, [field]: value as unknown as string } });
      expect(await port.run({ contextKey: CTX, intentRef: "digest-drift" })).toMatchObject({ kind: "tuple-changed", field: "sdkTuple" });
    }
  });

  it("fails closed when the pin tuple changes", async () => {
    const port = createStubReleaseRunner({
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
        ...KIX_SDK_0_CONSUMPTION_DIGESTS,
      },
    });
    const outcome = await port.run({ contextKey: CTX, intentRef: "rel-tuple" });
    expect(outcome.kind).toBe("tuple-changed");
    if (outcome.kind === "tuple-changed") {
      expect(outcome.field).toBe("contractOpenApiSha256");
    }
  });

  it("registers fixture rows for the screen and names no commerce method", async () => {
    const rows = fixturesForScreen("platform-release");
    expect(rows.length).toBeGreaterThanOrEqual(6);
    expect(rows.every((row) => row.method === null)).toBe(true);
    expect(rows.every((row) => row.klass !== "SUCCESS")).toBe(true);
    expect(rows.every((row) => row.ownsPass === false)).toBe(true);
  });

  it("composes no protocol command and contains no forbidden tokens", () => {
    const source = readFileSync(path.join(repoRoot, "packages/protocol-adapter/src/platform-release.ts"), "utf8");
    for (const forbidden of ["invokeLocalCall", "Idempotency-Key", "Math.random", "Date.now", "fetch("]) {
      expect(source.includes(forbidden), `platform-release.ts mentions ${forbidden}`).toBe(false);
    }
    const controllerSource = readFileSync(
      path.join(repoRoot, "packages/protocol-adapter/src/platform-release-controller.ts"),
      "utf8",
    );
    for (const forbidden of ["invokeLocalCall", "Idempotency-Key", "Math.random", "Date.now", "fetch("]) {
      expect(controllerSource.includes(forbidden), `platform-release-controller.ts mentions ${forbidden}`).toBe(false);
    }
  });

  it("keeps the guest actor a separate context label", () => {
    expect(RELEASE_GUEST_ACTOR).toBe("release-reviewer");
    expect(RELEASE_GUEST_ACTOR).not.toBe("release-runner");
  });
});
