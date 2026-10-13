import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  DISCOVERY_READ_TUPLE_LITERALS,
  JOURNEY_NOT_COMPOSED,
  PINNED_ACTIONS,
  PLATFORM_CHANNELS,
  PLATFORM_COMPENSATION_UNDEFINED,
  PLATFORM_FACETS,
  PLATFORM_HOLD_NOT_BOUND,
  PLATFORM_IDENTITY_REGISTER,
  PLATFORM_JOURNEY_RULING,
  PLATFORM_NOT_BOUND_REASON,
  PLATFORM_NOT_COMPOSED,
  PLATFORM_REF_KINDS,
  PLATFORM_SCENARIOS,
  PLATFORM_STALE_FLOOR,
  PLATFORM_STEPS,
  PLATFORM_TIERS,
  createNotBoundPlatformJourney,
  createStubPlatformJourney,
  isPlatformRef,
  platformJourneyPortFor,
  platformRef,
  platformRefKind,
  type PlatformReadOutcome,
  type PlatformSnapshot,
  type PlatformWriteOutcome,
  type PlatformWriteRequest,
  type StubPlatformJourney,
} from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

const CTX = "stub|kix|platform-desk|1";

function base(intentRef: string) {
  return { contextKey: CTX, actorRef: "platform-desk", intentRef };
}

async function snapshotOf(port: StubPlatformJourney): Promise<PlatformSnapshot> {
  const outcome = await port.read({ contextKey: CTX, watermarkFloor: null });
  if (outcome.kind !== "ready") {
    throw new Error(`expected a ready read, received ${outcome.kind}`);
  }
  return outcome.snapshot;
}

function bookRequest(intentRef: string, listingRef = "lst-0001", version = 7): PlatformWriteRequest {
  const rightRef = listingRef === "lst-0003" ? "rgt-0002" : "rgt-0001";
  const termsRef = { "lst-0001": "trm-0001", "lst-0002": "trm-0002", "lst-0003": "trm-0003" }[listingRef] ?? "trm-0001";
  return { ...base(intentRef), step: "book", listingRef, rightRef, termsRef, expectedVersion: version };
}

function transferRequest(intentRef: string, tradeRef: string, patch: Partial<Extract<PlatformWriteRequest, { step: "transfer" }>> = {}): PlatformWriteRequest {
  return {
    ...base(intentRef),
    step: "transfer",
    tradeRef,
    listingRef: "lst-0001",
    rightRef: "rgt-0001",
    termsRef: "trm-0001",
    expectedVersion: 7,
    ...patch,
  };
}

function kind(outcome: PlatformWriteOutcome): string {
  return outcome.kind === "rejected" ? `rejected:${outcome.code}` : outcome.kind;
}

describe("platform identity register", () => {
  const pin = JSON.parse(
    readFileSync(path.join(repoRoot, "packages/protocol-adapter/vendor/kix-protocol.contract-only.openapi.json"), "utf8"),
  ) as { components: { schemas: Record<string, { properties?: Record<string, unknown> }> } };

  it("names a published body field only where the pin has it, and says not-bound where it has none", () => {
    expect(new Set(PLATFORM_IDENTITY_REGISTER.map((row) => row.id)).size).toBe(PLATFORM_IDENTITY_REGISTER.length);
    for (const row of PLATFORM_IDENTITY_REGISTER) {
      expect(row.reason.length, row.id).toBeGreaterThan(20);
      if (row.status === "field-named") {
        expect(row.bodyFields.length, row.id).toBeGreaterThan(0);
        for (const entry of row.bodyFields) {
          expect(PINNED_ACTIONS as readonly string[], `${row.id} ${entry.action}`).toContain(entry.action);
          const schema = pin.components.schemas[entry.action];
          expect(schema?.properties, `${row.id} ${entry.action}`).toBeDefined();
          expect(Object.keys(schema?.properties ?? {}), `${row.id} ${entry.action}.${entry.field}`).toContain(entry.field);
        }
      } else {
        expect(row.bodyFields, row.id).toEqual([]);
      }
    }
    const status = Object.fromEntries(PLATFORM_IDENTITY_REGISTER.map((row) => [row.id, row.status]));
    expect(status).toEqual({
      listing: "field-named",
      right: "field-named",
      trade: "field-named",
      terms: "field-named",
      version: "field-named",
      payment: "not-bound",
      transfer: "not-bound",
      refund: "not-bound",
      tier: "not-bound",
    });
  });

  it("backs each not-bound reason with the pin", () => {
    const withField = (field: string) =>
      Object.entries(pin.components.schemas)
        .filter(([, schema]) => schema.properties && field in schema.properties)
        .map(([name]) => name)
        .sort();
    // A payment id is named only by money-posting and payment-effect commands. Each of them also
    // carries an amount and a currency, and this journey composes none of them.
    const paymentActions = withField("paymentId");
    expect(paymentActions).toEqual([
      "adjust_pg_cancel",
      "capture",
      "finalize_effect",
      "observe_effect",
      "observe_return",
      "settle_capture",
    ]);
    for (const action of paymentActions) {
      const names = Object.keys(pin.components.schemas[action]?.properties ?? {});
      expect(names, action).toContain("amount");
      expect(names, action).toContain("currency");
    }
    const recorded = JOURNEY_NOT_COMPOSED.map((entry) => entry.action as string);
    expect(recorded).toContain("capture");
    expect(recorded).toContain("settle_capture");
    const composed = PLATFORM_STEPS as readonly string[];
    for (const action of paymentActions) {
      expect(composed).not.toContain(action);
    }
    // No transfer id or refund id exists in any pinned body.
    expect(withField("transferId")).toEqual([]);
    expect(withField("refundId")).toEqual([]);
    // No update-listing command is pinned.
    expect(PINNED_ACTIONS as readonly string[]).not.toContain("update_listing");
    expect(PINNED_ACTIONS as readonly string[]).not.toContain("reprice_listing");
    // refund_ticket is pinned, and its body names a right and a version only.
    expect(Object.keys(pin.components.schemas.refund_ticket?.properties ?? {}).sort()).toEqual([
      "domain",
      "expectedVersion",
      "ticketId",
    ]);
  });

  it("records the not-composed commands and the locked hold binding without remapping them", () => {
    expect(PLATFORM_NOT_COMPOSED.map((entry) => entry.action)).toEqual([
      "capture",
      "settle_capture",
      "commit_trade",
      "open_admission",
      "admit",
      "refund_ticket",
    ]);
    for (const entry of PLATFORM_NOT_COMPOSED) {
      expect(entry.reason, entry.action).toContain(PLATFORM_JOURNEY_RULING);
    }
    expect(PLATFORM_JOURNEY_RULING).toBe("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
    expect(PLATFORM_HOLD_NOT_BOUND.consideredAction).toBe("reserve_listing");
    expect(PLATFORM_HOLD_NOT_BOUND.status).toBe("not-bound");
    expect(PLATFORM_HOLD_NOT_BOUND.reason).toBe(COMMERCE_COMMAND_BINDINGS.placeHold.reason);
    expect(PLATFORM_HOLD_NOT_BOUND.mappedOntoPrepareTrade).toBe(false);
    const bindings = readFileSync(path.join(repoRoot, "packages/protocol-adapter/src/commerce-bindings.ts"));
    expect(createHash("sha256").update(bindings).digest("hex")).toBe(
      "83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249",
    );
  });
});

describe("platform references", () => {
  it("gives every kind its own prefix and never reads one kind as another", () => {
    const refs = PLATFORM_REF_KINDS.map((refKind) => platformRef(refKind, 12));
    expect(new Set(refs).size).toBe(PLATFORM_REF_KINDS.length);
    for (const refKind of PLATFORM_REF_KINDS) {
      const ref = platformRef(refKind, 7);
      expect(platformRefKind(ref)).toBe(refKind);
      for (const other of PLATFORM_REF_KINDS) {
        expect(isPlatformRef(ref, other)).toBe(other === refKind);
      }
    }
    expect(platformRef("trade", 3)).toBe("trd-0003");
    expect(platformRefKind("trd-3")).toBeNull();
    expect(platformRefKind("order-0003")).toBeNull();
    expect(isPlatformRef(7, "trade")).toBe(false);
  });
});

describe("platform port selection", () => {
  it("serves the synthetic source on stub and a not-bound port on integration-http with no stub switch", async () => {
    const stub = platformJourneyPortFor("stub");
    expect(stub.environment).toBe("stub");
    expect(stub.source).toBe("synthetic-platform");
    const bound = platformJourneyPortFor("integration-http", { scenario: "clean" });
    expect(bound.environment).toBe("integration-http");
    expect(bound.source).toBe("none");
    expect(bound.scenario).toBe("clean");
    expect(await bound.read({ contextKey: CTX, watermarkFloor: null })).toEqual({
      kind: "not-bound",
      reason: PLATFORM_NOT_BOUND_REASON,
    });
    expect(await bound.submit(bookRequest("intent-1"))).toEqual({ kind: "not-bound", reason: PLATFORM_NOT_BOUND_REASON });
    expect(bound.deliverHeld()).toBe(0);
    expect(bound.deliverLate()).toEqual([]);
    expect(createNotBoundPlatformJourney().source).toBe("none");
    expect(PLATFORM_NOT_BOUND_REASON).toContain("not-bound on integration-http");
  });
});

describe("platform read", () => {
  it("reads two channels on one right and a second right, with no trade yet", async () => {
    const snapshot = await snapshotOf(createStubPlatformJourney());
    expect(snapshot.listings.map((item) => [item.listingRef, item.rightRef, item.channel, item.status])).toEqual([
      ["lst-0001", "rgt-0001", "web-board", "open"],
      ["lst-0002", "rgt-0001", "partner-board", "open"],
      ["lst-0003", "rgt-0002", "web-board", "open"],
    ]);
    expect(snapshot.rights).toEqual([
      { rightRef: "rgt-0001", holder: "holder-seed-1", version: 7 },
      { rightRef: "rgt-0002", holder: "holder-seed-2", version: 3 },
    ]);
    expect(snapshot.trades).toEqual([]);
    expect(snapshot.snapshotId).toBe(1);
    expect(PLATFORM_CHANNELS).toEqual(["web-board", "partner-board"]);
    expect(new Set(snapshot.listings.map((item) => item.channel))).toEqual(new Set(PLATFORM_CHANNELS));
  });

  it("serves empty and stale as their own outcomes", async () => {
    const empty = await createStubPlatformJourney({ scenario: "empty" }).read({ contextKey: CTX, watermarkFloor: null });
    expect(empty).toMatchObject({ kind: "empty" });
    const stale = await createStubPlatformJourney({ scenario: "stale" }).read({ contextKey: CTX, watermarkFloor: null });
    expect(stale).toMatchObject({ kind: "stale", floor: PLATFORM_STALE_FLOOR });
    const floored = await createStubPlatformJourney().read({ contextKey: CTX, watermarkFloor: "2026-10-14T00:00:00.000Z" });
    expect(floored.kind).toBe("stale");
  });

  it("checks the pin tuple before any read or effect", async () => {
    const changed = { ...DISCOVERY_READ_TUPLE_LITERALS, protocolMergeSha: "0".repeat(40) };
    const port = createStubPlatformJourney({ expectedTuple: changed });
    const read = await port.read({ contextKey: CTX, watermarkFloor: null });
    expect(read).toMatchObject({ kind: "tuple-changed", field: "protocolMergeSha" });
    const write = await port.submit(bookRequest("intent-1"));
    expect(write).toMatchObject({ kind: "tuple-changed", field: "protocolMergeSha", intentRef: "intent-1" });
    expect(port.effects()).toEqual({ submits: 0, books: 0, paymentObservations: 0, transfers: 0, rivalTransfers: 0, reprices: 0 });
  });

  it("covers every scenario with a port that answers a read", async () => {
    for (const scenario of PLATFORM_SCENARIOS) {
      const outcome: PlatformReadOutcome = await createStubPlatformJourney({ scenario }).read({ contextKey: CTX, watermarkFloor: null });
      expect(["ready", "empty", "stale"], scenario).toContain(outcome.kind);
    }
  });
});

describe("platform writes on the synthetic source", () => {
  it("books a trade, shows four independent facets, and moves the right once", async () => {
    const port = createStubPlatformJourney();
    const booked = await port.submit(bookRequest("intent-1"));
    expect(booked).toMatchObject({ kind: "confirmed", step: "book", refs: { tradeRef: "trd-0001", rightRef: "rgt-0001", rightVersion: 7 } });
    const afterBook = await snapshotOf(port);
    const trade = afterBook.trades[0];
    expect(trade?.tradeRef).toBe("trd-0001");
    expect(Object.keys(trade?.facets ?? {})).toEqual([...PLATFORM_FACETS]);
    expect(trade?.facets.booking.state).toBe("observed");
    expect(trade?.facets.payment).toMatchObject({ state: "observed", ref: "pay-0001" });
    expect(trade?.facets.issuance.state).toBe("none");
    expect(trade?.facets.refund.state).toBe("none");
    // The booking does not lock or move the right.
    expect(afterBook.rights[0]).toEqual({ rightRef: "rgt-0001", holder: "holder-seed-1", version: 7 });

    const moved = await port.submit(transferRequest("intent-2", "trd-0001"));
    expect(moved).toMatchObject({ kind: "confirmed", step: "transfer", refs: { transferRef: "xfr-0001", rightVersion: 8 } });
    const afterMove = await snapshotOf(port);
    expect(afterMove.rights[0]).toEqual({ rightRef: "rgt-0001", holder: "platform-desk", version: 8 });
    expect(afterMove.trades[0]?.facets.issuance).toMatchObject({ state: "observed", ref: "xfr-0001" });
    expect(afterMove.trades[0]?.originalRight).toEqual({ holder: "holder-seed-1", version: 7 });
    expect(port.effects()).toMatchObject({ books: 1, paymentObservations: 1, transfers: 1 });

    // The same right cannot move twice on the version the first move used.
    expect(kind(await port.submit(transferRequest("intent-3", "trd-0001")))).toBe("rejected:VERSION_STALE");
    expect(port.effects().transfers).toBe(1);
  });

  it("lets two channels book the same right, and lets only one transfer win", async () => {
    const port = createStubPlatformJourney();
    expect((await port.submit(bookRequest("a-book", "lst-0001"))).kind).toBe("confirmed");
    expect((await port.submit(bookRequest("b-book", "lst-0002"))).kind).toBe("confirmed");
    expect(port.effects()).toMatchObject({ books: 2, paymentObservations: 2 });
    const first = await port.submit(transferRequest("a-move", "trd-0001"));
    const second = await port.submit(
      transferRequest("b-move", "trd-0002", { listingRef: "lst-0002", termsRef: "trm-0002" }),
    );
    expect(first.kind).toBe("confirmed");
    expect(kind(second)).toBe("rejected:VERSION_STALE");
    const snapshot = await snapshotOf(port);
    const moved = snapshot.trades.filter((item) => item.facets.issuance.state === "observed");
    expect(moved.map((item) => item.tradeRef)).toEqual(["trd-0001"]);
    const loser = snapshot.trades.find((item) => item.tradeRef === "trd-0002");
    expect(loser?.facets.payment.state).toBe("observed");
    expect(loser?.facets.issuance.state).toBe("none");
    expect(loser?.facets.refund).toMatchObject({ state: "unavailable", code: PLATFORM_COMPENSATION_UNDEFINED, ref: null });
  });

  it("refuses a repriced listing, makes the earlier terms stale, and never computes an amount", async () => {
    const port = createStubPlatformJourney();
    await port.submit(bookRequest("book"));
    const repriced = await port.submit({ ...base("reprice"), step: "reprice", listingRef: "lst-0001", nextTier: "tier-3" });
    expect(repriced).toMatchObject({
      kind: "confirmed",
      step: "reprice",
      refs: { listingRef: "lst-0004", supersededListingRef: "lst-0001", termsRef: "trm-0004" },
    });
    const snapshot = await snapshotOf(port);
    expect(snapshot.listings.find((item) => item.listingRef === "lst-0001")).toMatchObject({ status: "superseded", supersededBy: "lst-0004" });
    expect(snapshot.listings.find((item) => item.listingRef === "lst-0004")).toMatchObject({ status: "open", tier: "tier-3", channel: "web-board" });
    expect(kind(await port.submit(bookRequest("book-old", "lst-0001")))).toBe("rejected:LISTING_SUPERSEDED");
    expect(kind(await port.submit({ ...base("reprice-old"), step: "reprice", listingRef: "lst-0001", nextTier: "tier-1" }))).toBe(
      "rejected:LISTING_SUPERSEDED",
    );
    expect(kind(await port.submit(transferRequest("move", "trd-0001")))).toBe("rejected:TERMS_CHANGED");
    const stranded = (await snapshotOf(port)).trades[0];
    expect(stranded?.facets.payment.state).toBe("observed");
    expect(stranded?.facets.refund.code).toBe(PLATFORM_COMPENSATION_UNDEFINED);
    expect(JSON.stringify(snapshot)).not.toMatch(/amount|currency|price|fee|share|\bKRW\b|\bUSD\b/i);
    expect(PLATFORM_TIERS).toEqual(["tier-1", "tier-2", "tier-3"]);
  });

  it("rejects a booking on stale terms or a stale right version, and an unknown or foreign reference", async () => {
    const port = createStubPlatformJourney();
    expect(kind(await port.submit(bookRequest("v", "lst-0001", 6)))).toBe("rejected:VERSION_STALE");
    expect(kind(await port.submit({ ...bookRequest("t"), termsRef: "trm-0002" } as PlatformWriteRequest))).toBe("rejected:TERMS_CHANGED");
    expect(kind(await port.submit({ ...bookRequest("u"), listingRef: "lst-0099" } as PlatformWriteRequest))).toBe("rejected:UNKNOWN_REF");
    expect(kind(await port.submit({ ...bookRequest("m"), rightRef: "rgt-0002" } as PlatformWriteRequest))).toBe("rejected:IDENTITY_MISMATCH");
    expect(kind(await port.submit(transferRequest("x", "trd-0042")))).toBe("rejected:UNKNOWN_REF");
    await port.submit(bookRequest("book"));
    expect(kind(await port.submit(transferRequest("y", "trd-0001", { rightRef: "rgt-0002" })))).toBe("rejected:IDENTITY_MISMATCH");
    expect(port.effects()).toMatchObject({ books: 1, transfers: 0 });
  });

  it("refuses an invalid request before any effect", async () => {
    const port = createStubPlatformJourney();
    const cases: [string, PlatformWriteRequest][] = [
      ["INTENT", { ...bookRequest(""), intentRef: " " } as PlatformWriteRequest],
      ["STEP", { ...bookRequest("s"), step: "capture" } as unknown as PlatformWriteRequest],
      ["IDENTITY", { ...bookRequest("i"), listingRef: "trd-0001" } as PlatformWriteRequest],
      ["IDENTITY", { ...transferRequest("i2", "lst-0001") } as PlatformWriteRequest],
      ["IDENTITY", { ...transferRequest("i3", "trd-0001"), termsRef: "lst-0001" } as PlatformWriteRequest],
      ["VERSION", { ...bookRequest("v"), expectedVersion: 7.5 } as PlatformWriteRequest],
      ["TIER", { ...base("t"), step: "reprice", listingRef: "lst-0001", nextTier: "tier-9" } as PlatformWriteRequest],
      ["TIER", { ...base("t2"), step: "reprice", listingRef: "lst-0001", nextTier: "tier-2" } as PlatformWriteRequest],
      ["IDENTITY", { ...base("p"), step: "reprice", listingRef: "pay-0001", nextTier: "tier-1" } as PlatformWriteRequest],
    ];
    for (const [code, request] of cases) {
      const outcome = await port.submit(request);
      expect(outcome, code).toMatchObject({ kind: "invalid-request", code });
    }
    expect(port.effects().books + port.effects().transfers + port.effects().reprices).toBe(0);
  });

  it("is naive: a repeated intent is applied again, so only a client fence prevents a second effect", async () => {
    const port = createStubPlatformJourney();
    await port.submit(bookRequest("same"));
    await port.submit(bookRequest("same"));
    expect(port.effects()).toMatchObject({ books: 2, paymentObservations: 2 });
  });
});

describe("platform fault scenarios", () => {
  it("payment-lost books a trade with no payment observation and refuses the transfer", async () => {
    const port = createStubPlatformJourney({ scenario: "payment-lost" });
    expect((await port.submit(bookRequest("book"))).kind).toBe("confirmed");
    const trade = (await snapshotOf(port)).trades[0];
    expect(trade?.facets.payment).toMatchObject({ state: "unknown", ref: null, code: "PAYMENT_OBSERVATION_MISSING" });
    expect(trade?.facets.refund).toMatchObject({ state: "unavailable", code: PLATFORM_COMPENSATION_UNDEFINED });
    expect(kind(await port.submit(transferRequest("move", "trd-0001")))).toBe("rejected:PAYMENT_NOT_OBSERVED");
    expect((await snapshotOf(port)).rights[0]?.version).toBe(7);
    expect(port.effects().paymentObservations).toBe(0);
  });

  it("book-lost applies the booking and its payment observation and answers unknown", async () => {
    const port = createStubPlatformJourney({ scenario: "book-lost" });
    const outcome = await port.submit(bookRequest("book"));
    expect(outcome).toMatchObject({ kind: "unknown", step: "book", intentRef: "book" });
    expect(port.effects()).toMatchObject({ books: 1, paymentObservations: 1 });
    expect((await snapshotOf(port)).trades).toHaveLength(1);
  });

  it("transfer-lost applies the transfer, answers unknown, and a repeat would read as stale", async () => {
    const port = createStubPlatformJourney({ scenario: "transfer-lost" });
    await port.submit(bookRequest("book"));
    expect(await port.submit(transferRequest("move", "trd-0001"))).toMatchObject({ kind: "unknown", step: "transfer" });
    expect((await snapshotOf(port)).rights[0]).toMatchObject({ version: 8 });
    // A repeat reads as a plain rejection while the first one did apply. That is why an unknown write is not resent.
    expect(kind(await port.submit(transferRequest("move-again", "trd-0001")))).toBe("rejected:VERSION_STALE");
    expect(port.effects().transfers).toBe(1);
    expect(port.deliverLate()).toEqual([]);
  });

  it("transfer-late answers unknown now and queues a late result for an explicit delivery", async () => {
    const port = createStubPlatformJourney({ scenario: "transfer-late" });
    await port.submit(bookRequest("book"));
    expect(await port.submit(transferRequest("move", "trd-0001"))).toMatchObject({ kind: "unknown" });
    const late = port.deliverLate();
    expect(late).toEqual([{ intentRef: "move", contextKey: CTX, step: "transfer", result: "confirmed", code: null }]);
    expect(port.deliverLate()).toEqual([]);

    const notApplied = createStubPlatformJourney({ scenario: "transfer-late", lateResult: "rejected" });
    await notApplied.submit(bookRequest("book"));
    expect(await notApplied.submit(transferRequest("move", "trd-0001"))).toMatchObject({ kind: "unknown" });
    expect(notApplied.effects().transfers).toBe(0);
    expect(notApplied.deliverLate()).toEqual([{ intentRef: "move", contextKey: CTX, step: "transfer", result: "rejected", code: "VERSION_STALE" }]);
  });

  it("rival-channel lands another channel's transfer first, so ours is stale and only one transfer exists", async () => {
    const port = createStubPlatformJourney({ scenario: "rival-channel" });
    await port.submit(bookRequest("book"));
    expect(kind(await port.submit(transferRequest("move", "trd-0001")))).toBe("rejected:VERSION_STALE");
    const snapshot = await snapshotOf(port);
    expect(snapshot.rights[0]).toEqual({ rightRef: "rgt-0001", holder: "holder-rival", version: 8 });
    const issued = snapshot.trades.filter((item) => item.facets.issuance.state === "observed");
    expect(issued.map((item) => [item.tradeRef, item.bookedBy, item.channel])).toEqual([["trd-0002", "holder-rival", "partner-board"]]);
    const ours = snapshot.trades.find((item) => item.tradeRef === "trd-0001");
    expect(ours?.facets.payment.state).toBe("observed");
    expect(ours?.facets.issuance.state).toBe("none");
    expect(ours?.facets.refund.code).toBe(PLATFORM_COMPENSATION_UNDEFINED);
    expect(ours?.originalRight).toEqual({ holder: "holder-seed-1", version: 7 });
    expect(port.effects()).toMatchObject({ rivalTransfers: 1, transfers: 0 });
  });

  it("held-response applies the effect now and holds the answer until it is delivered", async () => {
    const port = createStubPlatformJourney({ scenario: "held-response" });
    let settled = false;
    const pending = port.submit(bookRequest("book")).then((outcome) => {
      settled = true;
      return outcome;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(port.effects().books).toBe(1);
    expect(port.deliverHeld()).toBe(1);
    expect(await pending).toMatchObject({ kind: "confirmed" });
    expect(port.deliverHeld()).toBe(0);
  });
});

describe("platform source", () => {
  it("sends nothing, reads no clock, uses no randomness, and names no money posting", () => {
    for (const file of ["platform-journey.ts", "platform-controller.ts"]) {
      const source = readFileSync(path.join(here, "../src", file), "utf8");
      for (const token of [
        "fetch(",
        "XMLHttpRequest",
        "Date.now(",
        "new Date(",
        "Math.random(",
        "setTimeout",
        "setInterval",
        "capture",
        "settle_capture",
        "invokeLocalCall",
        "Idempotency-Key",
        "retry(",
      ]) {
        expect(source, `${file} ${token}`).not.toContain(token);
      }
    }
  });
});
