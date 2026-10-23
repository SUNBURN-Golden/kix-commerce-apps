import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KIX_SDK_0_CONSUMPTION_DIGESTS } from "../src/sdk-consumption-tuple.js";
import { KIX_SDK_0_PIN, requireSdkPin, VENDORED_SDK_PIN_INPUTS } from "../src/sdk-pin.js";
import {
  FIXTURE_CATALOGUE_VERSION, FIXTURE_TUPLE_KEY, FIXTURE_TUPLE_LITERALS,
  FIXTURE_V1_TUPLE_KEY, FIXTURE_V1_TUPLE_LITERALS,
  acceptRecordedPass, assertCatalogueBound, classifyAgainstFixture, fixtureById,
  liveTupleKey, liveTupleParts, tupleKeyFrom,
} from "../src/contract-fixtures.js";
import { DISCOVERY_READ_TUPLE_LITERALS, liveDiscoveryReadTuple } from "../src/discovery-read.js";
import { createStubReleaseRunner, refuseReleasePacket } from "../src/platform-release.js";
import { createStubQualificationRunner } from "../src/operational-qualification.js";
import { fixtureObservationFor } from "../src/sdk0-mock-scenarios.js";

const sha256 = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const digestFields = ["sdkDigest", "manifestDigest", "vectorDigest"] as const;

describe("SDK consumption evidence tuple v2", () => {
  it("derives the digests from verified bytes and preserves manifest vector order", () => {
    expect(requireSdkPin()).toBe(KIX_SDK_0_PIN);
    const manifest = JSON.parse(VENDORED_SDK_PIN_INPUTS.manifestRaw) as {
      vectors: { name: string; path: string; sha256: string }[];
    };
    const vectors = manifest.vectors.map((vector) => {
      const bytes = readFileSync(new URL(`../vendor/kix-sdk-0/${vector.path.slice(4)}`, import.meta.url));
      expect(sha256(bytes)).toBe(vector.sha256);
      return `${vector.name}:${sha256(bytes)}`;
    }).join(" ");
    expect(KIX_SDK_0_CONSUMPTION_DIGESTS).toEqual({
      sdkDigest: sha256(VENDORED_SDK_PIN_INPUTS.catalogueRaw),
      manifestDigest: sha256(VENDORED_SDK_PIN_INPUTS.manifestRaw),
      vectorDigest: vectors,
    });
    expect(Object.isFrozen(KIX_SDK_0_CONSUMPTION_DIGESTS)).toBe(true);
  });

  it("keeps the original v1 key as history and refuses it as current evidence", async () => {
    expect(FIXTURE_V1_TUPLE_LITERALS).toMatchObject({
      catalogueVersion: "1", sdkDigest: null, manifestDigest: null, vectorDigest: null,
    });
    expect(sha256(FIXTURE_V1_TUPLE_KEY)).toBe("74e2d30c3fd115eb74cb9309dafda79c72d92cc7df75a9fc0947a71216dda1aa");
    expect(FIXTURE_V1_TUPLE_KEY).not.toBe(liveTupleKey());
    const fixture = fixtureById("booking-journey.create_event.success");
    expect(acceptRecordedPass({ tupleKey: FIXTURE_V1_TUPLE_KEY, caseId: fixture.id, klass: "SUCCESS" }, fixture.id))
      .toEqual({ accepted: false, reason: "DIFFERENT_TUPLE" });
    expect(classifyAgainstFixture(fixture.id, { ...fixtureObservationFor(fixture), tupleKey: FIXTURE_V1_TUPLE_KEY }))
      .toMatchObject({ ok: false, reason: "DIFFERENT_TUPLE" });
    const outcome = await createStubReleaseRunner().run({ contextKey: "sdk-tuple", intentRef: "history" });
    expect(outcome.kind).toBe("ready");
    if (outcome.kind !== "ready") throw new Error("missing release packet");
    expect(refuseReleasePacket({ ...outcome.packet, candidate: { ...outcome.packet.candidate, tupleKey: FIXTURE_V1_TUPLE_KEY } }))
      .toMatchObject({ field: "candidate.tupleKey" });
  });

  it.each(digestFields)("includes %s in identity and refuses drift and legacy nulls", async (field) => {
    const outcome = await createStubReleaseRunner().run({ contextKey: "sdk-tuple", intentRef: "drift" });
    if (outcome.kind !== "ready") throw new Error("missing release packet");
    const fixture = fixtureById("booking-journey.create_event.success");
    for (const value of ["changed", null]) {
      const key = tupleKeyFrom({ ...liveTupleParts(), [field]: value });
      expect(key).not.toBe(FIXTURE_TUPLE_KEY);
      expect(refuseReleasePacket({ ...outcome.packet, candidate: { ...outcome.packet.candidate, tupleKey: key } }))
        .toMatchObject({ field: "candidate.tupleKey" });
      expect(acceptRecordedPass({ tupleKey: key, caseId: fixture.id, klass: "SUCCESS" }, fixture.id))
        .toMatchObject({ accepted: false, reason: "DIFFERENT_TUPLE" });
      expect(classifyAgainstFixture(fixture.id, { ...fixtureObservationFor(fixture), tupleKey: key }))
        .toMatchObject({ ok: false, reason: "DIFFERENT_TUPLE" });
    }
    const recorded = FIXTURE_TUPLE_LITERALS[field];
    try {
      FIXTURE_TUPLE_LITERALS[field] = "changed";
      expect(() => assertCatalogueBound()).toThrow(/DIFFERENT_TUPLE|does not match/);
    } finally {
      FIXTURE_TUPLE_LITERALS[field] = recorded;
    }
  });

  it("aligns discovery, fixtures, release, and qualification without promoting their authority", async () => {
    for (const tuple of [liveTupleParts(), FIXTURE_TUPLE_LITERALS, DISCOVERY_READ_TUPLE_LITERALS, liveDiscoveryReadTuple()]) {
      expect(tuple).toMatchObject(KIX_SDK_0_CONSUMPTION_DIGESTS);
    }
    const release = await createStubReleaseRunner().run({ contextKey: "sdk-tuple", intentRef: "release" });
    const qualification = await createStubQualificationRunner().run({ contextKey: "sdk-tuple", intentRef: "qualification" });
    if (release.kind !== "ready" || qualification.kind !== "ready") throw new Error("missing packets");
    expect(release.packet.candidate.producer).toMatchObject({ ...KIX_SDK_0_CONSUMPTION_DIGESTS, consumedProducerChange: true });
    expect(qualification.packet.pins).toMatchObject({ ...KIX_SDK_0_CONSUMPTION_DIGESTS, consumedProducerChange: true });
    expect(release.packet.candidate.consumer.fixtureCatalogueVersion).toBe(FIXTURE_CATALOGUE_VERSION);
    expect(qualification.packet.opsBundle.uiReviewMaterial.fixtureVersion).toBe(FIXTURE_CATALOGUE_VERSION);
    expect(release.packet.candidate.artifact.digest).toBeNull();
    expect(release.packet.releaseState).toBe("STUB_CANDIDATE_RECORDED");
    expect(qualification.packet.qualificationState).toBe("STUB_RUN_RECORDED");
    expect(JSON.stringify(release.packet)).not.toContain('"blockedBy":"consume-p-sdk-0"');
  });
});
