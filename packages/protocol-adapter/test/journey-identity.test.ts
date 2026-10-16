import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  DISCOVERY_READ_TUPLE_LITERALS,
  JOURNEY_CONTEXT_FIELDS,
  JOURNEY_IDENTITY_DESK_ACTOR,
  JOURNEY_IDENTITY_HOLD_NOT_BOUND,
  JOURNEY_IDENTITY_NOT_COMPOSED,
  JOURNEY_IDENTITY_PEER_ACTOR,
  JOURNEY_IDENTITY_RULING,
  JOURNEY_IDENTITY_STALE_FLOOR,
  PINNED_PROTOCOL_DOMAIN,
  adjudicateObservation,
  createNotBoundJourneyIdentity,
  createStubJourneyIdentity,
  journeyContextKey,
  journeyIdentityPortFor,
  type JourneyContext,
  type JourneyIdentityItem,
} from "../src/index.js";
import { liveTupleKey } from "../src/contract-fixtures.js";

function context(patch: Partial<JourneyContext> = {}): JourneyContext {
  const parts = {
    environment: "stub" as const,
    actorRef: JOURNEY_IDENTITY_DESK_ACTOR,
    role: "operator" as const,
    domain: PINNED_PROTOCOL_DOMAIN,
    cutGeneration: 1,
    tupleKey: liveTupleKey(),
    incarnation: 1,
  };
  const merged = { ...parts, ...patch };
  return { ...merged, key: journeyContextKey(merged) };
}

function item(patch: Partial<JourneyIdentityItem> = {}): JourneyIdentityItem {
  return {
    itemId: "obs-0001",
    kind: "observation",
    subjectRef: "sub-0001",
    stamp: {
      environment: "stub",
      domain: PINNED_PROTOCOL_DOMAIN,
      tupleKey: liveTupleKey(),
      cutGeneration: 1,
      actorRef: null,
      role: null,
      incarnation: null,
    },
    watermark: "2026-10-13T00:00:00.000Z",
    note: "n",
    confirmsPayment: false,
    confirmsIssuance: false,
    confirmsAdmission: false,
    realIntegration: false,
    productionEnvironment: false,
    ...patch,
  };
}

describe("journey identity context key", () => {
  it("binds mode, actor, role, domain, cut generation, pin tuple, and incarnation", () => {
    expect([...JOURNEY_CONTEXT_FIELDS]).toEqual([
      "environment",
      "actorRef",
      "role",
      "domain",
      "cutGeneration",
      "tupleKey",
      "incarnation",
    ]);
    const base = context();
    expect(base.key).toContain("stub");
    expect(base.key).toContain(JOURNEY_IDENTITY_DESK_ACTOR);
    expect(base.key).toContain("operator");
    expect(base.key).toContain(PINNED_PROTOCOL_DOMAIN);
    expect(base.key).toContain("cut-1");
    expect(base.key).toContain("session-1");
    for (const patch of [
      { actorRef: JOURNEY_IDENTITY_PEER_ACTOR },
      { role: "buyer" as const },
      { environment: "integration-http" as const, cutGeneration: 0 },
      { cutGeneration: 2 },
      { incarnation: 2 },
      { tupleKey: "tuple:previous" },
      { domain: "kix:other" },
    ]) {
      expect(context(patch).key).not.toBe(base.key);
    }
  });

  it("keeps the ruling and the locked hold quote, and composes nothing", () => {
    expect(JOURNEY_IDENTITY_RULING).toContain("M2 + H1");
    expect(JOURNEY_IDENTITY_HOLD_NOT_BOUND.consideredAction).toBe("reserve_listing");
    expect(JOURNEY_IDENTITY_HOLD_NOT_BOUND.consideredAction).toBe(COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction);
    expect(JOURNEY_IDENTITY_HOLD_NOT_BOUND.mappedOntoPrepareTrade).toBe(false);
    const actions = JOURNEY_IDENTITY_NOT_COMPOSED.map((entry) => entry.action);
    expect(actions).toContain("capture");
    expect(actions).toContain("settle_capture");
    expect(actions).toContain("commit_trade");
    expect(actions).toContain("open_admission");
    expect(actions).toContain("admit");
    expect(actions).toContain("refund_ticket");
  });
});

describe("adjudicateObservation", () => {
  const ctx = context();

  it("marks a matching observation current and never a proof", () => {
    const verdict = adjudicateObservation(ctx, item(), null);
    expect(verdict.verdict).toBe("current");
    expect(verdict.detail).toContain("not a proof of payment, issuance, or admission");
  });

  it("marks an older watermark and an older cut stale", () => {
    expect(adjudicateObservation(ctx, item({ watermark: "2026-10-10T00:00:00.000Z" }), JOURNEY_IDENTITY_STALE_FLOOR).verdict).toBe("stale");
    const older = adjudicateObservation(ctx, item({ stamp: { ...item().stamp, cutGeneration: 0 } }), null);
    expect(older.verdict).toBe("stale");
    expect(older.cause).toBe("generation-behind");
  });

  it("refuses mode, domain, tuple, and newer-cut items as foreign", () => {
    const stamp = item().stamp;
    expect(adjudicateObservation(ctx, item({ stamp: { ...stamp, environment: "integration-http" } }), null).cause).toBe("mode");
    expect(adjudicateObservation(ctx, item({ stamp: { ...stamp, domain: "kix:other" } }), null).cause).toBe("domain");
    expect(adjudicateObservation(ctx, item({ stamp: { ...stamp, tupleKey: "tuple:previous" } }), null).cause).toBe("tuple");
    expect(adjudicateObservation(ctx, item({ stamp: { ...stamp, cutGeneration: 2 } }), null).cause).toBe("generation-ahead");
    for (const stampPatch of [{ environment: "integration-http" as const }, { domain: "kix:other" }, { tupleKey: "x" }, { cutGeneration: 2 }]) {
      expect(adjudicateObservation(ctx, item({ stamp: { ...stamp, ...stampPatch } }), null).verdict).toBe("foreign");
    }
  });

  it("refuses a receipt recorded under another actor, role, or session", () => {
    const receipt = item({
      itemId: "evd-0001",
      kind: "receipt",
      stamp: { ...item().stamp, actorRef: JOURNEY_IDENTITY_DESK_ACTOR, role: "operator", incarnation: 1 },
    });
    expect(adjudicateObservation(ctx, receipt, null).verdict).toBe("current");
    const otherActor = { ...receipt.stamp, actorRef: JOURNEY_IDENTITY_PEER_ACTOR };
    const otherRole = { ...receipt.stamp, role: "buyer" as const };
    const otherSession = { ...receipt.stamp, incarnation: 7 };
    expect(adjudicateObservation(ctx, item({ ...receipt, stamp: otherActor }), null).cause).toBe("actor");
    expect(adjudicateObservation(ctx, item({ ...receipt, stamp: otherRole }), null).cause).toBe("role");
    expect(adjudicateObservation(ctx, item({ ...receipt, stamp: otherSession }), null).cause).toBe("session");
  });

  it("refuses a claim and a malformed item", () => {
    const claim = adjudicateObservation(ctx, item({ confirmsPayment: true } as unknown as JourneyIdentityItem), null);
    expect(claim.verdict).toBe("refused");
    expect(claim.cause).toBe("claim");
    const shape = adjudicateObservation(ctx, item({ itemId: "bad" }), null);
    expect(shape.verdict).toBe("refused");
    expect(shape.cause).toBe("shape");
  });
});

describe("stub journey identity source", () => {
  it("serves a clean read and confirms an attach on the bound cut", async () => {
    const port = createStubJourneyIdentity({ scenario: "clean" });
    const ctx = context();
    const read = await port.read({ contextKey: ctx.key, watermarkFloor: null });
    expect(read.kind).toBe("ready");
    if (read.kind !== "ready") return;
    expect(read.snapshot.generation).toBe(1);
    expect(read.snapshot.items).toHaveLength(2);
    const written = await port.submit({
      contextKey: ctx.key,
      actorRef: ctx.actorRef,
      role: ctx.role,
      incarnation: ctx.incarnation,
      intentRef: "i1",
      observationId: "obs-0001",
      expectedCut: 1,
    });
    expect(written.kind).toBe("confirmed");
    const again = await port.read({ contextKey: ctx.key, watermarkFloor: null });
    expect(again.kind).toBe("ready");
    if (again.kind !== "ready") return;
    expect(again.snapshot.items.some((row) => row.kind === "receipt" && row.stamp.actorRef === ctx.actorRef)).toBe(true);
  });

  it("serves empty and stale outcomes", async () => {
    const empty = await createStubJourneyIdentity({ scenario: "empty" }).read({ contextKey: "k", watermarkFloor: null });
    expect(empty.kind).toBe("empty");
    const stale = await createStubJourneyIdentity({ scenario: "stale" }).read({ contextKey: "k", watermarkFloor: null });
    expect(stale).toMatchObject({ kind: "stale", watermark: "2026-10-10T00:00:00.000Z", floor: JOURNEY_IDENTITY_STALE_FLOOR });
  });

  it("adjudicates the foreign-mix read into current, foreign, and session-foreign rows", async () => {
    const port = createStubJourneyIdentity({ scenario: "foreign-mix" });
    const ctx = context();
    const read = await port.read({ contextKey: ctx.key, watermarkFloor: null });
    expect(read.kind).toBe("ready");
    if (read.kind !== "ready") return;
    const verdicts = read.snapshot.items.map((row) => adjudicateObservation(ctx, row, null));
    expect(verdicts.map((row) => row.verdict)).toEqual(["current", "foreign", "foreign", "foreign", "foreign", "foreign"]);
    expect(verdicts[5]?.cause).toBe("session");
  });

  it("adjudicates the older-cut read into current, stale, and foreign rows", async () => {
    const port = createStubJourneyIdentity({ scenario: "older-cut" });
    const ctx = context({ cutGeneration: 2 });
    const read = await port.read({ contextKey: ctx.key, watermarkFloor: null });
    expect(read.kind).toBe("ready");
    if (read.kind !== "ready") return;
    const verdicts = read.snapshot.items.map((row) => adjudicateObservation(ctx, row, null));
    expect(verdicts.map((row) => row.verdict)).toEqual(["current", "stale", "stale", "foreign"]);
    expect(verdicts[3]?.cause).toBe("generation-ahead");
  });

  it("refuses the whole read when an item claims a proof", async () => {
    const read = await createStubJourneyIdentity({ scenario: "claims-proof" }).read({ contextKey: "k", watermarkFloor: null });
    expect(read).toMatchObject({ kind: "refused", code: "CLAIM" });
  });

  it("rejects an attach on a foreign, stale, or old-cut item, and a reused receipt", async () => {
    const port = createStubJourneyIdentity({ scenario: "foreign-mix" });
    const ctx = context();
    const base = { contextKey: ctx.key, actorRef: ctx.actorRef, role: ctx.role, incarnation: ctx.incarnation, intentRef: "i1" };
    expect(await port.submit({ ...base, observationId: "obs-0002", expectedCut: 1 })).toMatchObject({ kind: "rejected", code: "EVIDENCE_FOREIGN" });
    expect(await port.submit({ ...base, observationId: "evd-0005", expectedCut: 1 })).toMatchObject({ kind: "rejected", code: "EVIDENCE_FOREIGN" });
    const older = createStubJourneyIdentity({ scenario: "older-cut" });
    const bound = context({ cutGeneration: 2 });
    const olderBase = { contextKey: bound.key, actorRef: bound.actorRef, role: bound.role, incarnation: bound.incarnation, intentRef: "i1" };
    expect(await older.submit({ ...olderBase, observationId: "obs-0002", expectedCut: 2 })).toMatchObject({ kind: "rejected", code: "EVIDENCE_STALE" });
    expect(await older.submit({ ...olderBase, observationId: "obs-0001", expectedCut: 1 })).toMatchObject({ kind: "rejected", code: "GENERATION_STALE" });
    const confirmed = await port.submit({ ...base, observationId: "obs-0001", expectedCut: 1 });
    expect(confirmed.kind).toBe("confirmed");
    if (confirmed.kind !== "confirmed") return;
    expect(await port.submit({ ...base, observationId: confirmed.refs.evidenceRef, expectedCut: 1 })).toMatchObject({ kind: "rejected", code: "ALREADY_RECORDED" });
    expect(await port.submit({ ...base, observationId: "obs-9999", expectedCut: 1 })).toMatchObject({ kind: "rejected", code: "UNKNOWN_REF" });
  });

  it("loses the attach answer in attach-lost and holds the late result", async () => {
    const port = createStubJourneyIdentity({ scenario: "attach-lost" });
    const ctx = context();
    const outcome = await port.submit({
      contextKey: ctx.key,
      actorRef: ctx.actorRef,
      role: ctx.role,
      incarnation: ctx.incarnation,
      intentRef: "i1",
      observationId: "obs-0001",
      expectedCut: 1,
    });
    expect(outcome.kind).toBe("unknown");
    expect(port.deliverLate()).toHaveLength(1);
    expect(port.deliverLate()).toHaveLength(0);
  });

  it("answers a tuple change on read and write and stays not-bound on integration-http", async () => {
    const moved = createStubJourneyIdentity({ expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, contractMainSha: "moved" } });
    expect(await moved.read({ contextKey: "k", watermarkFloor: null })).toMatchObject({ kind: "tuple-changed", field: "contractMainSha" });
    const ctx = context();
    expect(
      await moved.submit({ contextKey: ctx.key, actorRef: ctx.actorRef, role: ctx.role, incarnation: 1, intentRef: "i", observationId: "obs-0001", expectedCut: 1 }),
    ).toMatchObject({ kind: "tuple-changed" });
    const nb = createNotBoundJourneyIdentity();
    expect(await nb.read({ contextKey: "k", watermarkFloor: null })).toMatchObject({ kind: "not-bound" });
    expect(journeyIdentityPortFor("integration-http").source).toBe("none");
    expect(journeyIdentityPortFor("stub").source).toBe("synthetic-identity");
  });

  it("rotates the cut under the synthetic control", () => {
    const port = createStubJourneyIdentity();
    expect(port.currentGeneration()).toBe(1);
    expect(port.rotateCut()).toBe(2);
  });
});
