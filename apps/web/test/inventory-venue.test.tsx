import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  COMMERCE_COMMAND_BINDINGS,
  INVENTORY_ACCESSIBLE_UNSUPPORTED_REASON,
  INVENTORY_AS_OF,
  INVENTORY_DESK_SCOPE,
  INVENTORY_GENERATION,
  INVENTORY_PAGE_BOUND,
  INVENTORY_READ_NOT_BOUND_REASON,
  createStubInventoryRead,
  inventoryReadPortFor,
  inventoryUnitId,
  inventoryUnitLabel,
  type InventoryPageOutcome,
  type InventoryPageRequest,
  type InventoryReadPort,
  type InventoryScenario,
  type InventorySectionSpec,
  type InventorySelectionRequest,
  type InventorySummaryOutcome,
} from "@kix/protocol-adapter";
import { App } from "../src/App";
import {
  INVENTORY_BOUNDARY,
  INVENTORY_GA_NOTE,
  INVENTORY_QUEUE_BOUNDARY,
  INVENTORY_SELECTION_BOUNDARY,
  buildPageModel,
  buildSelectionModel,
  buildSummaryModel,
  inventoryReturnLabel,
  inventoryReturnMode,
  quantityFromParam,
  selectedUnitFor,
  type InventoryActions,
  type InventoryReturnMode,
  type PageState,
  type SelectionState,
  type SummaryState,
} from "../src/inventory-venue";
import { InventoryBanner, InventoryControls, PageSection, SelectionSection, SummarySection } from "../src/pages/InventoryPanels";
import { WORKSPACE_RULING } from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BANNED = /[$₩]|KRW|USD|still open|in stock/i;

/** Wording that would turn an observation into a decision. None may appear on screen. */
const POSITIVE_CLAIMS = [
  "Reserved for you",
  "Seat reserved",
  "Booked",
  "Purchased",
  "Payment received",
  "Payment complete",
  "You own",
  "Ticket issued",
  "Right issued",
  "Entry granted",
  "Confirmed seat",
];

const NO_ACTIONS: InventoryActions = {
  readSummaryAgain() {},
  nextPage() {},
  readPageAgain() {},
  readSelectionAgain() {},
  setFreeOnly() {},
  setScenario() {},
  advanceGeneration() {},
  runReturn() {},
};

const SCOPE = INVENTORY_DESK_SCOPE;

function stub(scenario: InventoryScenario, more: { generation?: number; sections?: readonly InventorySectionSpec[] } = {}) {
  return createStubInventoryRead({ scenario, ...more });
}

async function summaryOf(port: InventoryReadPort): Promise<InventorySummaryOutcome> {
  return port.readSummary({ scope: SCOPE, watermarkFloor: null });
}

function pageRequest(patch: Partial<InventoryPageRequest> = {}): InventoryPageRequest {
  return {
    scope: SCOPE,
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

function selectionRequest(patch: Partial<InventorySelectionRequest> = {}): InventorySelectionRequest {
  return {
    scope: SCOPE,
    sectionId: "sec-orch",
    expectedMode: "seat",
    heldGeneration: INVENTORY_GENERATION,
    unitId: inventoryUnitId({ sectionId: "sec-orch", mode: "seat" }, 3),
    quantity: null,
    seenAs: null,
    watermarkFloor: null,
    ...patch,
  };
}

function summaryModelFor(outcome: SummaryState, held: number | null = INVENTORY_GENERATION, served = INVENTORY_GENERATION, scenario: InventoryScenario = "clean") {
  return buildSummaryModel({ locale: "en-GB", outcome, scenario, servedGeneration: served, heldGeneration: held });
}

function pageModelFor(outcome: PageState, sectionId = "sec-orch", freeOnly = false) {
  return buildPageModel({ locale: "en-GB", outcome, sectionId, section: null, freeOnly });
}

function html(node: React.ReactNode): string {
  return renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);
}

function renderSummary(outcome: SummaryState, held: number | null = INVENTORY_GENERATION, served = INVENTORY_GENERATION): string {
  return html(<SummarySection model={summaryModelFor(outcome, held, served)} actions={NO_ACTIONS} />);
}

function renderPage(outcome: PageState, extra: { selectedUnitId?: string | null; sectionId?: string; quantityText?: string; invalid?: boolean } = {}): string {
  return html(
    <PageSection
      model={pageModelFor(outcome, extra.sectionId ?? "sec-orch")}
      actions={NO_ACTIONS}
      selectedUnitId={extra.selectedUnitId ?? null}
      quantityText={extra.quantityText ?? "1"}
      quantityInvalid={extra.invalid ?? false}
      onQuantity={() => undefined}
      onOpen={() => undefined}
      onSelectPool={() => undefined}
    />,
  );
}

function renderSelection(outcome: SelectionState, sectionId = "sec-orch", unitId = "sec-orch-s000003"): string {
  return html(
    <SelectionSection
      model={buildSelectionModel({ locale: "en-GB", outcome })}
      sectionId={sectionId}
      unitId={unitId}
      actions={NO_ACTIONS}
      onClear={() => undefined}
    />,
  );
}

function liCount(markup: string): number {
  return markup.match(/<li\b/g)?.length ?? 0;
}

function expectNoPositiveClaim(markup: string): void {
  for (const claim of POSITIVE_CLAIMS) {
    expect(markup, claim).not.toContain(claim);
  }
  expect(markup).not.toMatch(BANNED);
}

describe("inventory summary screen", () => {
  it("lists each section with its own mode, leaves accessible seating unsupported, and posts nothing", async () => {
    const outcome = await summaryOf(stub("clean"));
    const markup = renderSummary(outcome);
    expect(markup).toContain('data-inventory-state="ready"');
    expect(markup).toContain("Summary ready.");
    expect(markup).toContain('data-source="synthetic-inventory"');
    expect(markup).toContain("SYNTHETIC");
    for (const word of ["SEAT", "GA", "ACCESSIBLE"]) {
      expect(markup).toContain(`>${word}<`);
    }
    expect(markup).toContain('href="/inventory?section=sec-orch"');
    expect(markup).toContain('href="/inventory?section=sec-pit"');
    expect(markup).not.toContain('href="/inventory?section=sec-acc"');
    expect(markup).toContain('data-supported="false"');
    expect(markup).toContain(INVENTORY_ACCESSIBLE_UNSUPPORTED_REASON);
    expect(markup).toContain("UNDETERMINED");
    expect(markup).toContain("A label, not remaining stock.");
    expect(markup).not.toContain("<form");
    expect(markup).not.toContain('href="/booking/');
    expectNoPositiveClaim(markup);
  });

  it("separates loading, empty, stale, tuple change, and not-bound", async () => {
    expect(renderSummary({ kind: "loading" })).toContain('data-status-mark="loading"');
    const empty = await summaryOf(stub("clean", { sections: [] }));
    expect(renderSummary(empty)).toContain('data-inventory-state="empty"');
    const stale = await summaryOf(stub("stale"));
    const staleHtml = renderSummary(stale);
    expect(staleHtml).toContain('data-inventory-state="stale"');
    expect(staleHtml).toContain("Stale inventory watermark.");
    expect(staleHtml).toContain("Read again");

    const tuple = await createStubInventoryRead({
      expectedTuple: { ...(await tupleLiterals()), gateOpenApiSha256: "0".repeat(64) },
    }).readSummary({ scope: SCOPE, watermarkFloor: null });
    const tupleHtml = renderSummary(tuple);
    expect(tupleHtml).toContain("Projection tuple changed (gateOpenApiSha256).");
    expect(tupleHtml).toContain("Start over");
    expect(tupleHtml).not.toContain('href="/inventory?section=');

    const http = await summaryOf(inventoryReadPortFor("integration-http"));
    const httpHtml = renderSummary(http);
    expect(httpHtml).toContain('data-inventory-state="not-bound"');
    expect(httpHtml).toContain(INVENTORY_READ_NOT_BOUND_REASON);
    expect(httpHtml).not.toContain('href="/inventory?section=');
    expect(httpHtml).not.toContain("SEAT");
  });
});

async function tupleLiterals() {
  const { DISCOVERY_READ_TUPLE_LITERALS } = await import("@kix/protocol-adapter");
  return DISCOVERY_READ_TUPLE_LITERALS;
}

describe("inventory page screen", () => {
  it("shows one bounded seat page as a keyboard listbox with a word for every state", async () => {
    const page = await stub("clean").readPage(pageRequest());
    const markup = renderPage(page);
    expect(markup).toContain('role="listbox"');
    expect(markup).toMatch(/tab[iI]ndex="0"/);
    expect(markup).toContain("aria-activedescendant=");
    expect((markup.match(/role="option"/g) ?? []).length).toBe(INVENTORY_PAGE_BOUND);
    for (const word of ["FREE (observed)", "HELD (observed)", "TAKEN (observed)"]) {
      expect(markup, word).toContain(word);
    }
    expect(markup).toContain("This is not a hold and not a sale.");
    expect(markup).toContain("Open detail");
    expect(markup).toContain("Next page");
    expect(markup).toContain("Free-observed only");
    expect(liCount(markup)).toBeLessThanOrEqual(INVENTORY_PAGE_BOUND + 1);
    expectNoPositiveClaim(markup);
  });

  it("does not mount a million-seat section on the page", async () => {
    const sections: InventorySectionSpec[] = [
      { sectionId: "sec-orch", label: "Huge", mode: "seat", capacity: 1_000_000, band: "available" },
    ];
    const page = await createStubInventoryRead({ sections }).readPage(pageRequest());
    if (page.kind !== "ready") {
      throw new Error("expected ready");
    }
    expect(page.totalEstimate).toBe(1_000_000);
    const markup = renderPage(page);
    expect((markup.match(/role="option"/g) ?? []).length).toBeLessThanOrEqual(INVENTORY_PAGE_BOUND);
    expect(markup).toContain("about 1000000");
  });

  it("shows GA as a quantity in a pool with no seat label and no listbox", async () => {
    const page = await stub("clean").readPage(pageRequest({ sectionId: "sec-pit", expectedMode: "ga" }));
    const markup = renderPage(page, { sectionId: "sec-pit" });
    expect(markup).toContain('data-mode="ga"');
    expect(markup).toContain('data-pool="sec-pit-pool"');
    expect(markup).toContain(INVENTORY_GA_NOTE);
    expect(markup).toContain('id="inventory-quantity"');
    expect(markup).toContain("Select quantity");
    expect(markup).not.toContain('role="listbox"');
    expect(markup).not.toContain('role="option"');
    expect(markup).not.toMatch(/ R\d+ S\d+/);
    expect(markup).not.toContain("Next page");
    expectNoPositiveClaim(markup);
  });

  it("marks a refused quantity invalid and keeps the typed value", async () => {
    const page = await stub("clean").readPage(pageRequest({ sectionId: "sec-pit", expectedMode: "ga" }));
    const markup = renderPage(page, { sectionId: "sec-pit", quantityText: "99", invalid: true });
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('value="99"');
    expect(markup).toContain('aria-describedby="inventory-quantity-hint"');
  });

  it("separates empty, loading, unsupported, and stale pages", async () => {
    const empty = await stub("clean").readPage(pageRequest({ sectionId: "sec-side" }));
    const emptyHtml = renderPage(empty, { sectionId: "sec-side" });
    expect(emptyHtml).toContain('data-inventory-state="empty"');
    expect(emptyHtml).toContain("No seats in this section.");
    expect(emptyHtml).not.toContain('role="option"');

    expect(renderPage({ kind: "loading" })).toContain('data-status-mark="loading"');

    const unsupported = await stub("clean").readPage(pageRequest({ sectionId: "sec-acc", expectedMode: "accessible" }));
    const unsupportedHtml = renderPage(unsupported, { sectionId: "sec-acc" });
    expect(unsupportedHtml).toContain('data-inventory-state="unsupported"');
    expect(unsupportedHtml).toContain(INVENTORY_ACCESSIBLE_UNSUPPORTED_REASON);
    expect(unsupportedHtml).not.toContain('role="option"');
    expect(unsupportedHtml).not.toContain("Read again");

    const stale = await stub("stale").readPage(pageRequest());
    const staleHtml = renderPage(stale);
    expect(staleHtml).toContain('data-inventory-state="stale"');
    expect(staleHtml).toContain("Read again");
  });

  it("says when a free-only scan finds nothing and that the next page continues it", () => {
    const outcome: InventoryPageOutcome = {
      kind: "ready",
      section: {
        sectionId: "sec-orch",
        label: "Orchestra",
        mode: "seat",
        supported: true,
        unsupportedReason: null,
        capacityEstimate: 20_000,
        band: "available",
        watermark: INVENTORY_AS_OF,
        generation: INVENTORY_GENERATION,
      },
      rows: [],
      nextCursor: {
        cursorVersion: 1,
        projectionName: "kix.inventory.venue",
        generation: INVENTORY_GENERATION,
        tenantId: SCOPE.tenantId,
        sectionId: "sec-orch",
        filterKey: "free-only",
        afterSequence: 25,
        watermark: INVENTORY_AS_OF,
      },
      watermark: INVENTORY_AS_OF,
      scannedCount: 25,
      totalEstimate: 20_000,
      generation: INVENTORY_GENERATION,
      queue: stubQueue(),
    };
    const model = pageModelFor(outcome, "sec-orch", true);
    expect(model.statusLine).toBe("Page ready. No free-observed units in the scanned window.");
    expect(model.detailLine).toBe("The next page continues the scan.");
    expect(model.canNext).toBe(true);
  });
});

function stubQueue() {
  return {
    state: "none",
    position: null,
    admittedUntil: null,
    expired: null,
    grantsSelectionAccess: true,
    grantsReservation: false,
    grantsPayment: false,
    grantsRight: false,
    grantsDoorEntry: false,
    joinSupported: false,
    note: "No queue is in front of the selection pages.",
  } as const;
}

describe("inventory selection screen", () => {
  it("shows a free seat as a local selection that reserves, sells, and pays nothing", async () => {
    const outcome = await stub("clean").readSelection(selectionRequest());
    const markup = renderSelection(outcome);
    expect(markup).toContain('data-selection="seat"');
    expect(markup).toContain('data-selected="true"');
    expect(markup).toContain("Selected");
    expect(markup).toContain(INVENTORY_SELECTION_BOUNDARY);
    expect(markup).toContain(INVENTORY_BOUNDARY);
    expect(markup).toContain("No purchase path runs from this selection.");
    expect(markup).toContain("FREE (observed)");
    expect(markup).not.toContain('href="/booking/');
    expect(markup).not.toContain("<form");
    expectNoPositiveClaim(markup);
  });

  it("shows a GA selection as a count with no seat assigned", async () => {
    const outcome = await stub("clean").readSelection(
      selectionRequest({ sectionId: "sec-pit", expectedMode: "ga", unitId: "sec-pit-pool", quantity: 3 }),
    );
    const markup = renderSelection(outcome, "sec-pit", "sec-pit-pool");
    expect(markup).toContain('data-selection="ga"');
    expect(markup).toContain("Quantity 3.");
    expect(markup).toContain("A count, not a price.");
    expect(markup).toContain('data-assignment="none"');
    expect(markup).toContain("No seat assigned.");
    expect(markup).toContain(INVENTORY_GA_NOTE);
    expect(markup).not.toMatch(/ R\d+ S\d+/);
    expect(markup).not.toMatch(/seat [A-Z]?\d+/i);
    expect(markup).toContain(INVENTORY_SELECTION_BOUNDARY);
    expectNoPositiveClaim(markup);
  });

  it("refuses a GA quantity that is not allowed and keeps the screen on the refusal", async () => {
    const outcome = await stub("clean").readSelection(
      selectionRequest({ sectionId: "sec-pit", expectedMode: "ga", unitId: "sec-pit-pool", quantity: 99 }),
    );
    const model = buildSelectionModel({ locale: "en-GB", outcome });
    expect(model.invalidCode).toBe("QUANTITY");
    expect(model.selected).toBe(false);
    const markup = renderSelection(outcome, "sec-pit", "sec-pit-pool");
    expect(markup).toContain('data-selected="false"');
    expect(markup).toContain("Blocked read (QUANTITY).");
    expect(markup).not.toContain('data-assignment="none"');
    expect(markup).toContain("Back to first page");
  });

  it("shows a loading selection and an unknown id apart", async () => {
    expect(renderSelection({ kind: "loading" })).toContain('data-status-mark="loading"');
    const missing = await stub("clean").readSelection(selectionRequest({ unitId: "sec-orch-s999999" }));
    const markup = renderSelection(missing, "sec-orch", "sec-orch-s999999");
    expect(markup).toContain('data-inventory-state="empty"');
    expect(markup).toContain("No unit for this id.");
    expect(markup).toContain('data-selected="false"');
  });

  it("maps an unknown outcome to Read again and never to a selection", () => {
    const markup = renderSelection({ kind: "unknown", message: "source lost" });
    expect(markup).toContain("Unknown read.");
    expect(markup).toContain("The outcome is not confirmed.");
    expect(markup).toContain("Read again");
    expect(markup).toContain('data-selected="false"');
  });
});

describe("inventory hot page", () => {
  it("shows a seat free on the page and taken in the detail, and says it changed", async () => {
    const port = stub("hot");
    const first = await port.readPage(pageRequest());
    if (first.kind !== "ready") {
      throw new Error("expected ready");
    }
    const seat3 = first.rows.find((row) => row.unitId === "sec-orch-s000003");
    expect(seat3 && seat3.mode === "seat" ? seat3.observed : null).toBe("free");
    const pageHtml = renderPage(first);
    expect(pageHtml).toContain('id="inventory-row-sec-orch-s000003"');
    const seat3Markup = rowMarkup(pageHtml, "sec-orch-s000003");
    expect(seat3Markup).toContain("FREE (observed)");

    const detail = await port.readSelection(selectionRequest({ seenAs: seat3 ? inventoryUnitLabel(seat3) : null }));
    const detailHtml = renderSelection(detail);
    expect(detailHtml).toContain("Not free in the latest read (taken).");
    expect(detailHtml).toContain("It changed since the page was read. Nothing was reserved for you.");
    expect(detailHtml).toContain('data-selected="false"');
    expect(detailHtml).toContain("Back to page");
    expect(detailHtml).not.toContain(INVENTORY_SELECTION_BOUNDARY);

    const refreshed = await port.readPage(pageRequest());
    const refreshedSeat3 = rowMarkup(renderPage(refreshed), "sec-orch-s000003");
    expect(refreshedSeat3).toContain("TAKEN (observed)");
    expect(refreshedSeat3).not.toContain("FREE (observed)");
  });

  it("keeps a bounded page bounded however hot it is", async () => {
    const port = stub("hot");
    for (let read = 0; read < 4; read += 1) {
      const page = await port.readPage(pageRequest());
      expect(page.kind).toBe("ready");
      expect((renderPage(page).match(/role="option"/g) ?? []).length).toBe(INVENTORY_PAGE_BOUND);
    }
  });
});

function rowMarkup(markup: string, unitId: string): string {
  const start = markup.indexOf(`id="inventory-row-${unitId}"`);
  if (start < 0) {
    throw new Error(`row ${unitId} is not on the page`);
  }
  const end = markup.indexOf("</li>", start);
  return markup.slice(start, end);
}

describe("inventory stale hold", () => {
  it("shows an expired hold with the adapter flag and never as free", async () => {
    const page = await stub("stale-hold").readPage(pageRequest());
    const markup = renderPage(page);
    expect(markup).toContain('data-observed="hold-expired"');
    expect(markup).toContain('data-hold-expired="true"');
    expect(markup).toContain("HOLD EXPIRED (observed)");
    expect(markup).toContain("This seat is not shown as free. Read again.");
    expect(markup).toContain("expired true");
    expect(markup).toContain("Display locale does not decide expiry.");
    const expiredRow = rowMarkup(markup, "sec-orch-s000002");
    expect(expiredRow).not.toContain("FREE (observed)");

    const detail = await stub("stale-hold").readSelection(selectionRequest({ unitId: "sec-orch-s000002", seenAs: "held" }));
    const detailHtml = renderSelection(detail, "sec-orch", "sec-orch-s000002");
    expect(detailHtml).toContain("The observed hold is stale.");
    expect(detailHtml).toContain("The seat is not shown as free until a later read says so.");
    expect(detailHtml).toContain("expired true");
    expect(detailHtml).toContain('data-selected="false"');
    expect(detailHtml).toContain("Read again");
  });

  it("shows a hold from an earlier generation as not current", async () => {
    const port = stub("old-generation-hold", { generation: 2 });
    const page = await port.readPage(pageRequest({ heldGeneration: 2 }));
    const markup = renderPage(page);
    expect(markup).toContain('data-observed="hold-other-generation"');
    expect(markup).toContain("recorded under generation 1, not the current one");
    const detail = await port.readSelection(selectionRequest({ heldGeneration: 2, unitId: "sec-orch-s000002" }));
    const detailHtml = renderSelection(detail, "sec-orch", "sec-orch-s000002");
    expect(detailHtml).toContain("recorded under generation 1, not the current one");
    expect(detailHtml).toContain('data-selected="false"');
  });

  it("shows a current hold as held by another selection", async () => {
    const page = await stub("clean").readPage(pageRequest());
    const markup = renderPage(page);
    expect(markup).toContain('data-observed="held"');
    expect(markup).toContain("Held by another selection in the latest read.");
    expect(markup).toContain("expired false");
  });
});

describe("inventory generation and mode mismatch", () => {
  it("tells the person the generation moved, and offers the summary rather than a carried-over page", async () => {
    const port = stub("clean", { generation: 2 });
    const page = await port.readPage(pageRequest({ heldGeneration: 1 }));
    const markup = renderPage(page);
    expect(markup).toContain("Inventory generation changed.");
    expect(markup).toContain("You read generation 1 and the inventory now serves generation 2. Nothing was carried over.");
    expect(markup).toContain("Back to summary");
    expect(markup).not.toContain('role="option"');

    const controls = html(
      <InventoryControls scenario="clean" summary={summaryModelFor({ kind: "loading" }, 1, 2)} actions={NO_ACTIONS} />,
    );
    expect(controls).toContain('data-generation="behind"');
    expect(controls).toContain("The inventory serves a newer generation than your last summary read.");
    expect(controls).toContain("Advance generation");
  });

  it("refuses a mode mismatch without converting between seat and GA", async () => {
    const port = stub("clean");
    const seatAsGa = await port.readPage(pageRequest({ expectedMode: "ga" }));
    const markup = renderPage(seatAsGa);
    expect(markup).toContain("Mode mismatch in sec-orch.");
    expect(markup).toContain("expected ga and the section is seat now. Nothing was converted between modes.");
    expect(markup).toContain("Back to summary");
    expect(markup).not.toContain('role="option"');
    expect(markup).not.toContain('id="inventory-quantity"');

    const seatIdOnGa = await port.readSelection(
      selectionRequest({ sectionId: "sec-pit", expectedMode: "ga", unitId: "sec-pit-s000001", quantity: 2 }),
    );
    const selectionHtml = renderSelection(seatIdOnGa, "sec-pit", "sec-pit-s000001");
    expect(selectionHtml).toContain("Mode mismatch in sec-pit.");
    expect(selectionHtml).toContain('data-selected="false"');
    expect(selectionHtml).not.toContain('data-assignment="none"');
  });

  it("reports a section that is not in the summary as a refusal that goes back to the summary", () => {
    const outcome: PageState = { kind: "invalid-request", code: "SECTION", detail: "Section sec-gone is not in the summary this page read." };
    const model = pageModelFor(outcome, "sec-gone");
    expect(model.actionLabel).toBe("Back to summary");
    expect(model.rows).toEqual([]);
  });
});

describe("inventory queue admission", () => {
  it("shows a waiting queue as closed pages, not as a purchase or a right", async () => {
    const port = stub("queue-waiting");
    const summary = await summaryOf(port);
    const summaryHtml = renderSummary(summary);
    expect(summaryHtml).toContain('data-queue-state="waiting"');
    expect(summaryHtml).toContain("Queue: waiting.");
    expect(summaryHtml).toContain("Position 1842 (synthetic).");
    expect(summaryHtml).toContain("Selection pages are closed.");
    expect(summaryHtml).toContain(INVENTORY_QUEUE_BOUNDARY);
    expect(summaryHtml).toContain("No command to join or rejoin a queue is published");
    expectNoPositiveClaim(summaryHtml);

    const page = await port.readPage(pageRequest());
    const pageHtml = renderPage(page);
    expect(pageHtml).toContain('data-inventory-state="queue-blocked"');
    expect(pageHtml).toContain("Queue waiting. Selection pages are closed.");
    expect(pageHtml).not.toContain('role="option"');
    expect(pageHtml).toContain("Read again");
  });

  it("shows an admitted queue as access only, with the adapter expiry", async () => {
    const port = stub("queue-admitted");
    const summaryHtml = renderSummary(await summaryOf(port));
    expect(summaryHtml).toContain('data-queue-state="admitted"');
    expect(summaryHtml).toContain("Selection pages are open.");
    expect(summaryHtml).toContain("Admitted until");
    expect(summaryHtml).toContain("expired false");
    expect(summaryHtml).toContain("It is not a hold, a payment, an issued right, or entry at the door.");
    expectNoPositiveClaim(summaryHtml);

    const selection = await port.readSelection(selectionRequest());
    const selectionHtml = renderSelection(selection);
    expect(selectionHtml).toContain(INVENTORY_SELECTION_BOUNDARY);
    expect(selectionHtml).not.toContain("Queue admitted");
    expectNoPositiveClaim(selectionHtml);
  });

  it("shows a lapsed admission as expired with no way to join again", async () => {
    const port = stub("queue-lapsed");
    const summaryHtml = renderSummary(await summaryOf(port));
    expect(summaryHtml).toContain('data-queue-state="lapsed"');
    expect(summaryHtml).toContain("expired true");
    expect(summaryHtml).toContain("Selection pages are closed.");
    expect(summaryHtml).not.toContain("Join the queue");
    expect(summaryHtml).not.toContain("Rejoin");
  });
});

describe("inventory return actions", () => {
  const stages = ["summary", "page", "selection"] as const;

  const EXPECTED: ReadonlyArray<[string, InventoryReturnMode | null]> = [
    ["gap", "resync"],
    ["tenant-mismatch", "resync"],
    ["tuple-changed", "resync"],
    ["stale", "again"],
    ["unknown", "again"],
    ["hold-stale", "again"],
    ["queue-blocked", "again"],
    ["cursor-invalid", "first"],
    ["generation-changed", "summary"],
    ["mode-mismatch", "summary"],
    ["unit-unavailable", "page"],
    ["ready", null],
    ["empty", null],
    ["unsupported", null],
    ["not-bound", null],
  ];

  function outcomeOf(kind: string): PageState | SelectionState | SummaryState {
    const base = {
      gap: { kind: "gap", code: "SEQUENCE", detail: "d" },
      "tenant-mismatch": { kind: "tenant-mismatch", unitId: "u", tenantId: "t" },
      "tuple-changed": { kind: "tuple-changed", field: "f", expected: "e", actual: "a" },
      stale: { kind: "stale", watermark: INVENTORY_AS_OF, floor: INVENTORY_AS_OF },
      unknown: { kind: "unknown", message: "m" },
      "cursor-invalid": { kind: "cursor-invalid", code: "SHAPE", detail: "d" },
      "generation-changed": { kind: "generation-changed", held: 1, current: 2 },
      "mode-mismatch": { kind: "mode-mismatch", sectionId: "s", expected: "seat", actual: "ga" },
      "unit-unavailable": { kind: "unit-unavailable", unitId: "u", observed: "taken", hold: null, changedSincePage: false },
      "hold-stale": {
        kind: "hold-stale",
        unitId: "u",
        reason: "expired",
        hold: { expiresAt: INVENTORY_AS_OF, expired: true, holdGeneration: 1, currentGeneration: true },
      },
      "queue-blocked": { kind: "queue-blocked", queue: stubQueue() },
      ready: { kind: "loading" },
      empty: { kind: "empty", unitId: "u" },
      unsupported: { kind: "unsupported", sectionId: "s", mode: "accessible", reason: "r" },
      "not-bound": { kind: "not-bound", reason: "r" },
    } as const;
    return base[kind as keyof typeof base] as unknown as PageState;
  }

  it("maps each failure to exactly one user action, and a plain read to none", () => {
    for (const [kind, expected] of EXPECTED) {
      if (kind === "ready") {
        continue;
      }
      const outcome = outcomeOf(kind);
      const mode = inventoryReturnMode("page", outcome);
      expect(mode, kind).toBe(expected);
      if (expected !== null) {
        expect(inventoryReturnLabel(expected).length, kind).toBeGreaterThan(0);
      }
    }
    expect(inventoryReturnMode("page", { kind: "loading" })).toBeNull();
    expect(inventoryReturnMode("page", { kind: "invalid-request", code: "SECTION", detail: "d" })).toBe("summary");
    expect(inventoryReturnMode("page", { kind: "invalid-request", code: "PAGE_SIZE", detail: "d" })).toBe("first");
  });

  it("reads the summary stage as read again, except a changed tuple, which starts over", () => {
    for (const kind of ["stale", "unknown", "gap", "cursor-invalid", "generation-changed"]) {
      const mode = inventoryReturnMode("summary", outcomeOf(kind));
      expect(mode, kind).toBe("again");
    }
    expect(inventoryReturnMode("summary", outcomeOf("tuple-changed"))).toBe("resync");
    expect(inventoryReturnMode("summary", outcomeOf("not-bound"))).toBeNull();
    for (const stage of stages) {
      expect(inventoryReturnMode(stage, { kind: "loading" })).toBeNull();
    }
  });

  it("labels the five actions", () => {
    expect(
      (["again", "page", "first", "summary", "resync"] as const).map((mode) => inventoryReturnLabel(mode)),
    ).toEqual(["Read again", "Back to page", "Back to first page", "Back to summary", "Start over"]);
  });

  it("marks a unit selected only after a ready selection read", async () => {
    const port = stub("hot");
    const ready = await stub("clean").readSelection(selectionRequest());
    expect(selectedUnitFor(buildSelectionModel({ locale: "en-GB", outcome: ready }), "sec-orch-s000003")).toBe("sec-orch-s000003");
    await port.readPage(pageRequest());
    const unfree = await port.readSelection(selectionRequest());
    expect(unfree.kind).toBe("unit-unavailable");
    expect(selectedUnitFor(buildSelectionModel({ locale: "en-GB", outcome: unfree }), "sec-orch-s000003")).toBeNull();
    expect(selectedUnitFor(buildSelectionModel({ locale: "en-GB", outcome: { kind: "loading" } }), "sec-orch-s000003")).toBeNull();
    expect(selectedUnitFor(null, "sec-orch-s000003")).toBeNull();
    const markup = renderPage(await port.readPage(pageRequest()), { selectedUnitId: selectedUnitFor(buildSelectionModel({ locale: "en-GB", outcome: unfree }), "sec-orch-s000003") });
    expect(markup).not.toContain('aria-selected="true"');
  });

  it("parses a quantity param without deciding whether it is allowed", () => {
    expect(quantityFromParam(null)).toBeNull();
    expect(quantityFromParam("3")).toBe(3);
    expect(Number.isNaN(quantityFromParam("abc"))).toBe(true);
  });
});

describe("inventory screen as mounted", () => {
  it("mounts on /inventory in the loading state with the banner, rulings, and hold record", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/inventory"]}>
        <App />
      </MemoryRouter>,
    );
    expect(markup).toContain("Seats and GA (synthetic)");
    expect(markup).toContain('href="/inventory"');
    expect(markup).toContain('data-status-mark="loading"');
    expect(markup).toContain(WORKSPACE_RULING);
    expect(markup).toContain(COMMERCE_COMMAND_BINDINGS.placeHold.reason);
    expect(markup).toContain('data-hold-record="not-bound"');
    expect(markup).toContain("reserve_listing");
    expect(markup).toContain('data-source="synthetic-inventory"');
    expect(markup).not.toContain('href="/booking/');
    expect(markup).not.toMatch(BANNED);
  });

  it("mounts a deep link to a section without reading before the summary is ready", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/inventory?section=sec-pit&unit=sec-pit-pool&quantity=2"]}>
        <App />
      </MemoryRouter>,
    );
    expect(markup).toContain('id="inventory-page"');
    expect(markup).toContain('id="inventory-selection"');
    expect(markup).not.toContain('role="option"');
    expect(markup).not.toContain('data-selected="true"');
  });

  it("renders the banner for an integration-http adapter without a stub switch", () => {
    const summary = summaryModelFor({ kind: "not-bound", reason: INVENTORY_READ_NOT_BOUND_REASON });
    const markup = html(
      <InventoryBanner environment="integration-http" scenario="clean" servedGeneration={1} summary={summary} />,
    );
    expect(markup).toContain('data-adapter-environment="integration-http"');
    expect(summary.sections).toEqual([]);
    expect(summary.queue).toBeNull();
    expect(summary.statusLine).toBe(INVENTORY_READ_NOT_BOUND_REASON);
  });

  it("keeps the new screen free of sends, clocks, and timers, and keeps its style rules", () => {
    const files = ["src/inventory-venue.ts", "src/pages/Inventory.tsx", "src/pages/InventoryPanels.tsx"];
    const combined = files.map((file) => readFileSync(path.join(webRoot, file), "utf8")).join("\n");
    for (const token of [
      "fetch(",
      "XMLHttpRequest",
      "WebSocket",
      "EventSource",
      "sendBeacon",
      "invokeLocalCall",
      ".send(",
      "/health",
      "/ready",
      "127.0.0.1",
      "capture",
      "settle_capture",
      "commit_trade",
      "fallback",
      "Date.now(",
      "new Date(",
      "Math.random(",
      "setInterval",
      "setTimeout",
      "requestAnimationFrame",
      "placeHold",
      "Idempotency-Key",
      "retry",
    ]) {
      expect(combined, token).not.toContain(token);
    }
    const css = readFileSync(path.join(webRoot, "src/styles.css"), "utf8");
    expect(css).toContain(".inventory");
    expect(css).not.toContain("@keyframes");
    expect(css).not.toMatch(/animation\s*:/);
  });
});
