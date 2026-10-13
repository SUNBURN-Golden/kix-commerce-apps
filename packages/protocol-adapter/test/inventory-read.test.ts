import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  DISCOVERY_READ_TUPLE_LITERALS,
  INVENTORY_ACCESSIBLE_UNSUPPORTED_REASON,
  INVENTORY_AS_OF,
  INVENTORY_DEFAULT_SECTIONS,
  INVENTORY_DESK_SCOPE,
  INVENTORY_GENERATION,
  INVENTORY_HOLD_NOT_BOUND,
  INVENTORY_PAGE_BOUND,
  INVENTORY_QUANTITY_BOUND,
  INVENTORY_READ_NOT_BOUND_REASON,
  INVENTORY_READ_RULING,
  INVENTORY_SCENARIOS,
  INVENTORY_SECTION_BOUND,
  createNotBoundInventoryRead,
  createStubInventoryRead,
  inventoryReadPortFor,
  inventoryUnitId,
  inventoryUnitLabel,
  type InventoryMode,
  type InventoryPageOutcome,
  type InventoryPageRequest,
  type InventoryReadCursor,
  type InventoryScenario,
  type InventorySectionSpec,
  type InventorySeatUnit,
  type InventorySelectionOutcome,
  type InventorySelectionRequest,
  type StubInventoryReadOptions,
} from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function pageOf(patch: Partial<InventoryPageRequest> = {}): InventoryPageRequest {
  return {
    scope: INVENTORY_DESK_SCOPE,
    sectionId: "sec-orch",
    expectedMode: "seat",
    heldGeneration: INVENTORY_GENERATION,
    pageSize: INVENTORY_PAGE_BOUND,
    cursor: null,
    freeOnly: false,
    watermarkFloor: null,
    ...patch,
  };
}

function selectionOf(patch: Partial<InventorySelectionRequest> = {}): InventorySelectionRequest {
  return {
    scope: INVENTORY_DESK_SCOPE,
    sectionId: "sec-orch",
    expectedMode: "seat",
    heldGeneration: INVENTORY_GENERATION,
    quantity: null,
    seenAs: null,
    unitId: inventoryUnitId({ sectionId: "sec-orch", mode: "seat" }, 3),
    watermarkFloor: null,
    ...patch,
  };
}

function stub(scenario: InventoryScenario, more: StubInventoryReadOptions = {}) {
  return createStubInventoryRead({ scenario, ...more });
}

function seatRows(outcome: InventoryPageOutcome): InventorySeatUnit[] {
  if (outcome.kind !== "ready") {
    throw new Error(`expected a ready page, got ${outcome.kind}`);
  }
  return outcome.rows.filter((row): row is InventorySeatUnit => row.mode === "seat");
}

async function firstCursor(port: ReturnType<typeof stub>): Promise<InventoryReadCursor> {
  const first = await port.readPage(pageOf());
  if (first.kind !== "ready" || first.nextCursor === null) {
    throw new Error(`expected a first page with a cursor, got ${first.kind}`);
  }
  return first.nextCursor;
}

const SIX_SECTIONS_WITH_SEAT: readonly InventorySectionSpec[] = [
  { sectionId: "sec-orch", label: "Orchestra", mode: "seat", capacity: 100, band: "available" },
];

describe("inventory read tuple and binding", () => {
  it("records the ruling, keeps the hold desk method not-bound, and consumes no SDK", () => {
    expect(INVENTORY_READ_RULING).toBe("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
    expect(INVENTORY_HOLD_NOT_BOUND).toEqual({
      method: "placeHold",
      status: COMMERCE_COMMAND_BINDINGS.placeHold.status,
      consideredAction: "reserve_listing",
      reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
      mappedOntoPrepareTrade: false,
    });
    expect(INVENTORY_HOLD_NOT_BOUND.status).toBe("not-bound");
    expect(DISCOVERY_READ_TUPLE_LITERALS.sdkDigest).toBeNull();
    expect(DISCOVERY_READ_TUPLE_LITERALS.manifestDigest).toBeNull();
    expect(DISCOVERY_READ_TUPLE_LITERALS.vectorDigest).toBeNull();
  });

  it("detects a changed projection tuple before any row is materialized", async () => {
    let materialized = 0;
    const port = createStubInventoryRead({
      expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, gateOpenApiSha256: "0".repeat(64) },
      seatAt: () => {
        materialized += 1;
        throw new Error("a row must not be built after a tuple change");
      },
    });
    const summary = await port.readSummary({ scope: INVENTORY_DESK_SCOPE, watermarkFloor: null });
    const page = await port.readPage(pageOf());
    const selection = await port.readSelection(selectionOf());
    for (const outcome of [summary, page, selection]) {
      expect(outcome).toMatchObject({ kind: "tuple-changed", field: "gateOpenApiSha256" });
    }
    expect(materialized).toBe(0);
  });

  it("stays not-bound on integration-http with no stub switch", async () => {
    const port = inventoryReadPortFor("integration-http", { scenario: "hot" });
    expect(port.environment).toBe("integration-http");
    expect(port.source).toBe("none");
    expect(port.scenario).toBe("clean");
    const outcomes = [
      await port.readSummary({ scope: INVENTORY_DESK_SCOPE, watermarkFloor: null }),
      await port.readPage(pageOf()),
      await port.readSelection(selectionOf()),
    ];
    for (const outcome of outcomes) {
      expect(outcome).toEqual({ kind: "not-bound", reason: INVENTORY_READ_NOT_BOUND_REASON });
    }
    expect(createNotBoundInventoryRead().source).toBe("none");
    expect(inventoryReadPortFor("stub").source).toBe("synthetic-inventory");
  });
});

describe("inventory summary", () => {
  it("lists every section with its mode, and leaves accessible seating unsupported", async () => {
    const summary = await stub("clean").readSummary({ scope: INVENTORY_DESK_SCOPE, watermarkFloor: null });
    if (summary.kind !== "ready") {
      throw new Error(`expected ready, got ${summary.kind}`);
    }
    expect(summary.generation).toBe(INVENTORY_GENERATION);
    expect(summary.sections.map((section) => `${section.sectionId}:${section.mode}`)).toEqual([
      "sec-orch:seat",
      "sec-balc:seat",
      "sec-pit:ga",
      "sec-lawn:ga",
      "sec-acc:accessible",
      "sec-side:seat",
    ]);
    const accessible = summary.sections.find((section) => section.mode === "accessible");
    expect(accessible).toMatchObject({
      supported: false,
      capacityEstimate: null,
      band: null,
      unsupportedReason: INVENTORY_ACCESSIBLE_UNSUPPORTED_REASON,
    });
    expect(INVENTORY_ACCESSIBLE_UNSUPPORTED_REASON).toContain("UNDETERMINED");
    expect(summary.queue.state).toBe("none");
  });

  it("reports an empty venue, a stale summary, and a refused request", async () => {
    const empty = await stub("clean", { sections: [] }).readSummary({ scope: INVENTORY_DESK_SCOPE, watermarkFloor: null });
    expect(empty).toMatchObject({ kind: "empty", generation: INVENTORY_GENERATION });

    const stale = await stub("stale").readSummary({ scope: INVENTORY_DESK_SCOPE, watermarkFloor: null });
    expect(stale.kind).toBe("stale");

    const floored = await stub("clean").readSummary({
      scope: INVENTORY_DESK_SCOPE,
      watermarkFloor: "2026-10-14T00:00:00.000Z",
    });
    expect(floored.kind).toBe("stale");

    const foreign = await stub("clean").readSummary({
      scope: { tenantId: "tenant-other", subject: "inventory-desk" },
      watermarkFloor: null,
    });
    expect(foreign).toMatchObject({ kind: "invalid-request", code: "SCOPE" });
    const badFloor = await stub("clean").readSummary({ scope: INVENTORY_DESK_SCOPE, watermarkFloor: "not-an-instant" });
    expect(badFloor).toMatchObject({ kind: "invalid-request", code: "BOUND" });
  });

  it("refuses a venue larger than the section bound", () => {
    const sections: InventorySectionSpec[] = Array.from({ length: INVENTORY_SECTION_BOUND + 1 }, (_, index) => ({
      sectionId: `sec-x${index}`,
      label: `X${index}`,
      mode: "seat",
      capacity: 10,
      band: "available",
    }));
    expect(() => createStubInventoryRead({ sections })).toThrow(/at most 12 sections/);
  });
});

describe("inventory page bounds and cursor", () => {
  it("serves a bounded window from a million-seat section without building the rest", async () => {
    let built = 0;
    const sections: InventorySectionSpec[] = [
      { sectionId: "sec-orch", label: "Huge", mode: "seat", capacity: 1_000_000, band: "available" },
    ];
    const port = createStubInventoryRead({
      sections,
      seatAt: (section, index, context) => {
        built += 1;
        return {
          mode: "seat",
          sequence: index + 1,
          tenantId: INVENTORY_DESK_SCOPE.tenantId,
          sectionId: section.sectionId,
          unitId: inventoryUnitId(section, index + 1),
          seatLabel: `Huge #${index + 1}`,
          observed: "free",
          hold: null,
          watermark: INVENTORY_AS_OF,
          generation: context.generation,
          confirmsReservation: false,
          confirmsOwnership: false,
          confirmsPayment: false,
          grantsEntry: false,
        };
      },
    });
    const first = await port.readPage(pageOf());
    expect(first.kind).toBe("ready");
    if (first.kind !== "ready") {
      return;
    }
    expect(first.rows).toHaveLength(INVENTORY_PAGE_BOUND);
    expect(first.totalEstimate).toBe(1_000_000);
    expect(built).toBe(INVENTORY_PAGE_BOUND);
    const second = await port.readPage(pageOf({ cursor: first.nextCursor }));
    expect(second.kind).toBe("ready");
    expect(built).toBe(2 * INVENTORY_PAGE_BOUND);
    const detail = await port.readSelection(selectionOf({ unitId: inventoryUnitId(sections[0] as InventorySectionSpec, 999_999) }));
    expect(detail.kind).toBe("ready");
    expect(built).toBe(2 * INVENTORY_PAGE_BOUND + 1);
  });

  it("refuses a page size outside 1..25 and never clamps it", async () => {
    const port = stub("clean");
    for (const pageSize of [0, 26, 1000, -1, 2.5, Number.NaN]) {
      const outcome = await port.readPage(pageOf({ pageSize }));
      expect(outcome, String(pageSize)).toMatchObject({ kind: "invalid-request", code: "PAGE_SIZE" });
    }
    expect((await port.readPage(pageOf({ pageSize: 1 }))).kind).toBe("ready");
  });

  it("walks contiguous pages with a port-issued cursor", async () => {
    const port = stub("clean");
    const first = await port.readPage(pageOf());
    const cursor = await firstCursor(port);
    expect(cursor).toMatchObject({ sectionId: "sec-orch", generation: INVENTORY_GENERATION, afterSequence: 25 });
    const second = await port.readPage(pageOf({ cursor }));
    const rows = seatRows(second);
    expect(seatRows(first).at(-1)?.sequence).toBe(25);
    expect(rows[0]?.sequence).toBe(26);
    expect(rows.at(-1)?.sequence).toBe(50);
  });

  it("ends the section on the last page with no cursor", async () => {
    const port = stub("clean", { sections: SIX_SECTIONS_WITH_SEAT });
    let outcome = await port.readPage(pageOf());
    let pages = 1;
    while (outcome.kind === "ready" && outcome.nextCursor !== null) {
      outcome = await port.readPage(pageOf({ cursor: outcome.nextCursor }));
      pages += 1;
    }
    expect(pages).toBe(4);
    expect(outcome.kind).toBe("ready");
    if (outcome.kind === "ready") {
      expect(outcome.nextCursor).toBeNull();
      expect(outcome.rows).toHaveLength(25);
    }
  });

  it("refuses a cursor from another version, generation, section, filter, tenant, or shape", async () => {
    const port = stub("clean");
    const cursor = await firstCursor(port);
    const cases: ReadonlyArray<[string, InventoryReadCursor | null, Partial<InventoryPageRequest>, string]> = [
      ["version", { ...cursor, cursorVersion: 9 }, {}, "VERSION"],
      ["projection", { ...cursor, projectionName: "kix.other" }, {}, "SHAPE"],
      ["generation", { ...cursor, generation: 0 }, {}, "GENERATION"],
      ["tenant", { ...cursor, tenantId: "tenant-other" }, {}, "TENANT"],
      ["section", { ...cursor, sectionId: "sec-balc" }, {}, "SECTION"],
      ["filter", cursor, { freeOnly: true }, "FILTER"],
      ["negative", { ...cursor, afterSequence: -1 }, {}, "SHAPE"],
      ["fraction", { ...cursor, afterSequence: 1.5 }, {}, "SHAPE"],
      ["past end", { ...cursor, afterSequence: 20_000 }, {}, "SHAPE"],
      ["watermark", { ...cursor, watermark: "later" }, {}, "SHAPE"],
    ];
    for (const [name, held, patch, code] of cases) {
      const outcome = await port.readPage(pageOf({ cursor: held, ...patch }));
      expect(outcome, name).toMatchObject({ kind: "cursor-invalid", code });
    }
    const notObject = await port.readPage(pageOf({ cursor: "x" as unknown as InventoryReadCursor }));
    expect(notObject).toMatchObject({ kind: "cursor-invalid", code: "SHAPE" });
  });

  it("refuses a malformed page request before touching rows", async () => {
    let built = 0;
    const port = createStubInventoryRead({
      seatAt: () => {
        built += 1;
        throw new Error("not reached");
      },
    });
    const cases: ReadonlyArray<[Partial<InventoryPageRequest>, string]> = [
      [{ scope: { tenantId: "tenant-other", subject: "x" } }, "SCOPE"],
      [{ scope: { tenantId: INVENTORY_DESK_SCOPE.tenantId, subject: " padded " } }, "SCOPE"],
      [{ sectionId: "Bad Id" }, "SECTION"],
      [{ expectedMode: "stadium" as unknown as InventoryMode }, "MODE"],
      [{ heldGeneration: -1 }, "GENERATION"],
      [{ freeOnly: "yes" as unknown as boolean }, "FILTER"],
      [{ watermarkFloor: "nope" }, "BOUND"],
      [{ sectionId: "sec-missing" }, "SECTION"],
    ];
    for (const [patch, code] of cases) {
      const outcome = await port.readPage(pageOf(patch));
      expect(outcome, JSON.stringify(patch)).toMatchObject({ kind: "invalid-request", code });
    }
    expect(built).toBe(0);
  });
});

describe("inventory generation", () => {
  it("refuses a page or a selection read under another generation and does not carry it over", async () => {
    const port = stub("clean", { generation: 2 });
    const page = await port.readPage(pageOf({ heldGeneration: 1 }));
    expect(page).toEqual({ kind: "generation-changed", held: 1, current: 2 });
    const selection = await port.readSelection(selectionOf({ heldGeneration: 1 }));
    expect(selection).toEqual({ kind: "generation-changed", held: 1, current: 2 });
    expect((await port.readPage(pageOf({ heldGeneration: 2 }))).kind).toBe("ready");
  });

  it("refuses a cursor from the earlier generation when the caller already moved to the new one", async () => {
    const before = stub("clean");
    const cursor = await firstCursor(before);
    const after = stub("clean", { generation: 2 });
    const outcome = await after.readPage(pageOf({ heldGeneration: 2, cursor }));
    expect(outcome).toMatchObject({ kind: "cursor-invalid", code: "GENERATION" });
  });
});

describe("inventory mode mismatch", () => {
  it("refuses a page read whose expected mode differs from the live mode", async () => {
    const port = stub("clean");
    const asGa = await port.readPage(pageOf({ sectionId: "sec-orch", expectedMode: "ga" }));
    expect(asGa).toEqual({ kind: "mode-mismatch", sectionId: "sec-orch", expected: "ga", actual: "seat" });
    const asSeat = await port.readPage(pageOf({ sectionId: "sec-pit", expectedMode: "seat" }));
    expect(asSeat).toEqual({ kind: "mode-mismatch", sectionId: "sec-pit", expected: "seat", actual: "ga" });
    const accessibleAsSeat = await port.readPage(pageOf({ sectionId: "sec-acc", expectedMode: "seat" }));
    expect(accessibleAsSeat).toMatchObject({ kind: "mode-mismatch", actual: "accessible" });
  });

  it("detects a section that changed mode between the summary and the read", async () => {
    const wasSeat: InventorySectionSpec[] = [
      { sectionId: "sec-orch", label: "Orchestra", mode: "seat", capacity: 100, band: "available" },
    ];
    const nowGa: InventorySectionSpec[] = [
      { sectionId: "sec-orch", label: "Orchestra", mode: "ga", capacity: 100, band: "available" },
    ];
    const summary = await createStubInventoryRead({ sections: wasSeat }).readSummary({
      scope: INVENTORY_DESK_SCOPE,
      watermarkFloor: null,
    });
    if (summary.kind !== "ready") {
      throw new Error("expected ready");
    }
    const seen = summary.sections[0];
    const later = createStubInventoryRead({ sections: nowGa });
    const outcome = await later.readPage(pageOf({ expectedMode: seen?.mode ?? "seat" }));
    expect(outcome).toEqual({ kind: "mode-mismatch", sectionId: "sec-orch", expected: "seat", actual: "ga" });
  });

  it("refuses a seat id on a GA section, a quantity on a seat, and a GA selection with no quantity", async () => {
    const port = stub("clean");
    const seatIdOnGa = await port.readSelection(
      selectionOf({ sectionId: "sec-pit", expectedMode: "ga", unitId: "sec-pit-s000001", quantity: 2 }),
    );
    expect(seatIdOnGa).toEqual({ kind: "mode-mismatch", sectionId: "sec-pit", expected: "seat", actual: "ga" });
    const quantityOnSeat = await port.readSelection(selectionOf({ quantity: 2 }));
    expect(quantityOnSeat).toEqual({ kind: "mode-mismatch", sectionId: "sec-orch", expected: "ga", actual: "seat" });
    const poolOnSeat = await port.readSelection(selectionOf({ unitId: "sec-orch-pool" }));
    expect(poolOnSeat).toEqual({ kind: "mode-mismatch", sectionId: "sec-orch", expected: "ga", actual: "seat" });
    const noQuantity = await port.readSelection(
      selectionOf({ sectionId: "sec-pit", expectedMode: "ga", unitId: "sec-pit-pool", quantity: null }),
    );
    expect(noQuantity).toMatchObject({ kind: "invalid-request", code: "QUANTITY" });
    for (const quantity of [0, INVENTORY_QUANTITY_BOUND + 1, 1.5, Number.NaN]) {
      const outcome = await port.readSelection(
        selectionOf({ sectionId: "sec-pit", expectedMode: "ga", unitId: "sec-pit-pool", quantity }),
      );
      expect(outcome, String(quantity)).toMatchObject({ kind: "invalid-request", code: "QUANTITY" });
    }
  });

  it("keeps accessible seating unsupported on both reads and does not hide it", async () => {
    const port = stub("clean");
    const page = await port.readPage(pageOf({ sectionId: "sec-acc", expectedMode: "accessible" }));
    expect(page).toEqual({
      kind: "unsupported",
      sectionId: "sec-acc",
      mode: "accessible",
      reason: INVENTORY_ACCESSIBLE_UNSUPPORTED_REASON,
    });
    const selection = await port.readSelection(
      selectionOf({ sectionId: "sec-acc", expectedMode: "accessible", unitId: "sec-acc-s000001" }),
    );
    expect(selection.kind).toBe("unsupported");
  });

  it("refuses a unit id that belongs to another section", async () => {
    const outcome = await stub("clean").readSelection(selectionOf({ unitId: "sec-balc-s000003" }));
    expect(outcome).toMatchObject({ kind: "invalid-request", code: "UNIT_ID" });
    const junk = await stub("clean").readSelection(selectionOf({ unitId: "sec-orch-s12" }));
    expect(junk).toMatchObject({ kind: "invalid-request", code: "UNIT_ID" });
    const missing = await stub("clean").readSelection(selectionOf({ unitId: "sec-orch-s999999" }));
    expect(missing).toEqual({ kind: "empty", unitId: "sec-orch-s999999" });
  });
});

describe("inventory GA is a quantity, never a seat", () => {
  it("serves one pool row with no seat and no assignment", async () => {
    const page = await stub("clean").readPage(pageOf({ sectionId: "sec-pit", expectedMode: "ga" }));
    if (page.kind !== "ready") {
      throw new Error(`expected ready, got ${page.kind}`);
    }
    expect(page.rows).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
    const pool = page.rows[0];
    expect(pool).toMatchObject({ mode: "ga", seatLabel: null, assignment: "none", unitId: "sec-pit-pool" });
    expect(JSON.stringify(pool)).not.toMatch(/"sequence"|"observed"|"hold"/);
  });

  it("records a GA selection as a quantity with no seat label", async () => {
    const outcome = await stub("clean").readSelection(
      selectionOf({ sectionId: "sec-pit", expectedMode: "ga", unitId: "sec-pit-pool", quantity: 3 }),
    );
    if (outcome.kind !== "ready" || outcome.selection.mode !== "ga") {
      throw new Error(`expected a ready GA selection, got ${outcome.kind}`);
    }
    expect(outcome.selection.quantity).toBe(3);
    expect(outcome.selection.seatLabel).toBeNull();
    expect(outcome.selection.assignment).toBe("none");
    expect(outcome.selection.unit.seatLabel).toBeNull();
    expect(outcome.selection).toMatchObject({
      reservationConfirmed: false,
      ownershipConfirmed: false,
      paymentConfirmed: false,
      economicWriterApproval: "none",
    });
  });

  it("refuses a GA pool that reads none", async () => {
    const sections: InventorySectionSpec[] = [
      { sectionId: "sec-pit", label: "Pit", mode: "ga", capacity: 50, band: "none" },
    ];
    const outcome = await createStubInventoryRead({ sections }).readSelection(
      selectionOf({ sectionId: "sec-pit", expectedMode: "ga", unitId: "sec-pit-pool", quantity: 1, seenAs: "available" }),
    );
    expect(outcome).toEqual({
      kind: "unit-unavailable",
      unitId: "sec-pit-pool",
      observed: "none",
      hold: null,
      changedSincePage: true,
    });
  });
});

describe("inventory hot page", () => {
  it("shows a seat free on the first read and taken on the next, and reports the change", async () => {
    const port = stub("hot");
    const first = seatRows(await port.readPage(pageOf()));
    const seat3 = first.find((row) => row.sequence === 3);
    expect(seat3?.observed).toBe("free");
    const detail = await port.readSelection(selectionOf({ seenAs: seat3 ? inventoryUnitLabel(seat3) : null }));
    expect(detail).toMatchObject({
      kind: "unit-unavailable",
      observed: "taken",
      changedSincePage: true,
      unitId: seat3?.unitId,
    });
    const refreshed = seatRows(await port.readPage(pageOf()));
    expect(refreshed.find((row) => row.sequence === 3)?.observed).toBe("taken");
    expect(refreshed.find((row) => row.sequence === 4)?.observed).toBe("held");
    expect(refreshed.find((row) => row.sequence === 20)?.observed).toBe(first.find((row) => row.sequence === 20)?.observed);
  });

  it("filters to free seats inside the scanned window and keeps the cursor on the scan position", async () => {
    const port = stub("hot");
    await port.readPage(pageOf());
    const outcome = await port.readPage(pageOf({ freeOnly: true }));
    if (outcome.kind !== "ready") {
      throw new Error("expected ready");
    }
    expect(outcome.scannedCount).toBe(25);
    expect(outcome.rows.length).toBeLessThan(25);
    expect(outcome.rows.every((row) => row.mode === "seat" && row.observed === "free")).toBe(true);
    expect(outcome.nextCursor).toMatchObject({ afterSequence: 25, filterKey: "free-only" });
  });

  it("is deterministic: the same options give the same pages", async () => {
    const left = stub("hot");
    const right = stub("hot");
    for (let read = 0; read < 3; read += 1) {
      expect(await left.readPage(pageOf())).toEqual(await right.readPage(pageOf()));
    }
  });

  it("does not change in the other scenarios between reads", async () => {
    const port = stub("clean");
    const first = await port.readPage(pageOf());
    const second = await port.readPage(pageOf());
    expect(second).toEqual(first);
  });
});

describe("inventory stale hold", () => {
  it("marks an observed hold expired from the fixed instant, and never shows it as free", async () => {
    const port = stub("stale-hold");
    const rows = seatRows(await port.readPage(pageOf()));
    const held = rows.filter((row) => row.observed === "held");
    expect(held.length).toBeGreaterThan(0);
    for (const row of held) {
      expect(row.hold).toMatchObject({ expired: true, currentGeneration: true });
      expect(Date.parse(row.hold?.expiresAt ?? "")).toBeLessThan(Date.parse(INVENTORY_AS_OF));
    }
    const outcome = await port.readSelection(selectionOf({ unitId: held[0]?.unitId ?? "", seenAs: "held" }));
    expect(outcome).toMatchObject({ kind: "hold-stale", reason: "expired" });
    expect(outcome.kind).not.toBe("ready");
  });

  it("does not trust a hold recorded under an earlier generation", async () => {
    const port = stub("old-generation-hold", { generation: 2 });
    const rows = seatRows(await port.readPage(pageOf({ heldGeneration: 2 })));
    const held = rows.find((row) => row.observed === "held");
    expect(held?.hold).toMatchObject({ holdGeneration: 1, currentGeneration: false, expired: false });
    const outcome = await port.readSelection(selectionOf({ heldGeneration: 2, unitId: held?.unitId ?? "" }));
    expect(outcome).toMatchObject({ kind: "hold-stale", reason: "other-generation" });
  });

  it("keeps a current, unexpired hold unavailable rather than free", async () => {
    const port = stub("clean");
    const rows = seatRows(await port.readPage(pageOf()));
    const held = rows.find((row) => row.observed === "held");
    expect(held?.hold).toMatchObject({ expired: false, currentGeneration: true });
    const outcome = await port.readSelection(selectionOf({ unitId: held?.unitId ?? "" }));
    expect(outcome).toMatchObject({ kind: "unit-unavailable", observed: "held" });
  });

  it("reports a stale watermark on the page, the detail, and against a caller floor", async () => {
    const port = stub("stale");
    expect((await port.readPage(pageOf())).kind).toBe("stale");
    expect((await port.readSelection(selectionOf())).kind).toBe("stale");
    const floored = await stub("clean").readPage(pageOf({ watermarkFloor: "2026-10-14T00:00:00.000Z" }));
    expect(floored).toMatchObject({ kind: "stale" });
  });
});

describe("inventory queue admission", () => {
  it("closes the selection pages while waiting and never grants more than access", async () => {
    const port = stub("queue-waiting");
    const summary = await port.readSummary({ scope: INVENTORY_DESK_SCOPE, watermarkFloor: null });
    if (summary.kind !== "ready") {
      throw new Error("expected ready");
    }
    expect(summary.queue).toMatchObject({ state: "waiting", position: 1842, grantsSelectionAccess: false });
    const page = await port.readPage(pageOf());
    expect(page).toMatchObject({ kind: "queue-blocked", queue: { state: "waiting" } });
    const selection = await port.readSelection(selectionOf());
    expect(selection).toMatchObject({ kind: "queue-blocked" });
  });

  it("opens the pages when admitted, and the admission is not a hold, payment, right, or entry", async () => {
    const port = stub("queue-admitted");
    const summary = await port.readSummary({ scope: INVENTORY_DESK_SCOPE, watermarkFloor: null });
    if (summary.kind !== "ready") {
      throw new Error("expected ready");
    }
    expect(summary.queue).toMatchObject({
      state: "admitted",
      expired: false,
      grantsSelectionAccess: true,
      grantsReservation: false,
      grantsPayment: false,
      grantsRight: false,
      grantsDoorEntry: false,
      joinSupported: false,
    });
    const page = await port.readPage(pageOf());
    expect(page.kind).toBe("ready");
    const selection = await port.readSelection(selectionOf());
    expect(selection.kind).toBe("ready");
    if (selection.kind === "ready") {
      expect(selection.selection).toMatchObject({ reservationConfirmed: false, paymentConfirmed: false });
    }
  });

  it("blocks a lapsed admission and offers no way to join again", async () => {
    const port = stub("queue-lapsed");
    const page = await port.readPage(pageOf());
    expect(page).toMatchObject({
      kind: "queue-blocked",
      queue: { state: "lapsed", expired: true, joinSupported: false, grantsSelectionAccess: false },
    });
  });

  it("opens the first free seat only as a local selection with no writer approval", async () => {
    const outcome = await stub("clean").readSelection(selectionOf());
    if (outcome.kind !== "ready" || outcome.selection.mode !== "seat") {
      throw new Error(`expected a ready seat selection, got ${outcome.kind}`);
    }
    expect(outcome.selection).toMatchObject({
      selectedLocally: true,
      reservationConfirmed: false,
      ownershipConfirmed: false,
      paymentConfirmed: false,
      economicWriterApproval: "none",
    });
    expect(outcome.selection.unit).toMatchObject({
      confirmsReservation: false,
      confirmsOwnership: false,
      confirmsPayment: false,
      grantsEntry: false,
    });
    expect(outcome.changedSincePage).toBe(false);
  });
});

describe("inventory stream integrity", () => {
  function seatWith(patch: Partial<InventorySeatUnit>, base: InventorySeatUnit): InventorySeatUnit {
    return { ...base, ...patch };
  }

  function sourceWith(mutate: (rows: InventorySeatUnit[]) => InventorySeatUnit[]): StubInventoryReadOptions {
    const pool = Array.from({ length: 100 }, (_, index): InventorySeatUnit => ({
      mode: "seat",
      sequence: index + 1,
      tenantId: INVENTORY_DESK_SCOPE.tenantId,
      sectionId: "sec-orch",
      unitId: inventoryUnitId({ sectionId: "sec-orch", mode: "seat" }, index + 1),
      seatLabel: `S${index + 1}`,
      observed: "free",
      hold: null,
      watermark: INVENTORY_AS_OF,
      generation: INVENTORY_GENERATION,
      confirmsReservation: false,
      confirmsOwnership: false,
      confirmsPayment: false,
      grantsEntry: false,
    }));
    const rows = mutate(pool);
    return {
      sections: SIX_SECTIONS_WITH_SEAT,
      seatAt: (_section, index) => {
        const row = rows[index];
        if (!row) {
          throw new Error("no row");
        }
        return row;
      },
    };
  }

  it("refuses a skipped, regressed, or repeated sequence and a foreign tenant row", async () => {
    const skipped = createStubInventoryRead(
      sourceWith((rows) => rows.map((row, index) => (index === 4 ? seatWith({ sequence: 7 }, row) : row))),
    );
    expect(await skipped.readPage(pageOf())).toMatchObject({ kind: "gap", code: "SEQUENCE" });

    const regressed = createStubInventoryRead(
      sourceWith((rows) => rows.map((row, index) => (index === 4 ? seatWith({ sequence: 2 }, row) : row))),
    );
    expect(await regressed.readPage(pageOf())).toMatchObject({ kind: "gap", code: "ORDER" });

    const repeated = createStubInventoryRead(
      sourceWith((rows) =>
        rows.map((row, index) => (index === 4 ? seatWith({ unitId: rows[0]?.unitId ?? "" }, row) : row)),
      ),
    );
    expect(await repeated.readPage(pageOf())).toMatchObject({ kind: "gap", code: "DUPLICATE" });

    const foreign = createStubInventoryRead(
      sourceWith((rows) => rows.map((row, index) => (index === 4 ? seatWith({ tenantId: "tenant-other" }, row) : row))),
    );
    expect(await foreign.readPage(pageOf())).toMatchObject({ kind: "tenant-mismatch", tenantId: "tenant-other" });
  });

  it("maps a failing source to unknown and never to a ready page", async () => {
    const port = createStubInventoryRead({
      seatAt: () => {
        throw new Error("source lost");
      },
    });
    expect(await port.readPage(pageOf())).toEqual({ kind: "unknown", message: "source lost" });
    expect(await port.readSelection(selectionOf())).toEqual({ kind: "unknown", message: "source lost" });
  });
});

describe("inventory read source", () => {
  it("sends nothing, reads no clock, and uses no randomness", () => {
    const source = readFileSync(path.join(here, "../src/inventory-read.ts"), "utf8");
    for (const token of [
      "fetch(",
      "XMLHttpRequest",
      "Date.now(",
      "new Date()",
      "Math.random(",
      "setTimeout",
      "capture",
      "settle_capture",
      "invokeLocalCall",
      "Idempotency-Key",
      "retry(",
    ]) {
      expect(source, token).not.toContain(token);
    }
  });

  it("covers every scenario with a port that answers the summary", async () => {
    for (const scenario of INVENTORY_SCENARIOS) {
      const outcome = await stub(scenario).readSummary({ scope: INVENTORY_DESK_SCOPE, watermarkFloor: null });
      expect(["ready", "stale"], scenario).toContain(outcome.kind);
    }
    expect(INVENTORY_DEFAULT_SECTIONS.length).toBeLessThanOrEqual(INVENTORY_SECTION_BOUND);
  });

  it("types each outcome kind a screen has to map", async () => {
    const outcomes: ReadonlyArray<InventoryPageOutcome | InventorySelectionOutcome> = [
      await stub("clean").readPage(pageOf()),
      await stub("clean").readSelection(selectionOf()),
    ];
    expect(outcomes.map((outcome) => outcome.kind)).toEqual(["ready", "ready"]);
  });
});
