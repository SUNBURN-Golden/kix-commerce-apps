import { COMMERCE_COMMAND_BINDINGS } from "./commerce-bindings.js";
import {
  DISCOVERY_PROJECTION_AS_OF,
  DISCOVERY_READ_TENANT,
  DISCOVERY_READ_TUPLE_LITERALS,
  checkDiscoveryReadTuple,
  type DiscoveryAccessScope,
  type DiscoveryReadTuple,
} from "./discovery-read.js";
import { isRecord } from "./record.js";
import { ProtocolError } from "./types.js";

/**
 * Bounded synthetic inventory read for the seat and GA selection screen.
 *
 * This is the stub-scope stand-in for the producer read contract. The real
 * producer read stays pending on kix-protocol:ps-05-query-projections and
 * kix-protocol:ps-06-admission-load, and on the unpromoted bind-reservation-fsm
 * and bind-admission-fsm. The contract-only catalogue has no inventory, hold,
 * or queue read command, so no producer SDK, manifest, or vector is consumed.
 *
 * The flow is summary, then one bounded page, then one selection detail.
 * Every label is an observation. A free seat or a GA band is not a hold, not
 * a sale, and not an approval from the economic writer. The hold desk method
 * stays not-bound (H1). This module sends nothing, retries nothing, reads no
 * clock, and uses no randomness.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const INVENTORY_READ_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const INVENTORY_READ_NOT_BOUND_REASON =
  "The contract-only catalogue has no read command for an inventory, hold, or queue projection. The seat and GA selection read stays not-bound on integration-http.";

/** Quote of the locked hold binding. H1 keeps this consideredAction and keeps it not-bound. */
export const INVENTORY_HOLD_NOT_BOUND = {
  method: "placeHold",
  status: COMMERCE_COMMAND_BINDINGS.placeHold.status,
  consideredAction: COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction,
  reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
  mappedOntoPrepareTrade: false,
} as const;

export const INVENTORY_PROJECTION_NAME = "kix.inventory.venue";

/** Generation the stub serves unless a test or the screen advances it. */
export const INVENTORY_GENERATION = 1;

/** Hard bound on rows per page read. A larger request is refused, not clamped. */
export const INVENTORY_PAGE_BOUND = 25;

/** Hard bound on sections per summary. A larger venue is a configuration error. */
export const INVENTORY_SECTION_BOUND = 12;

/**
 * Request-shape bound on a GA quantity. It mirrors the booking form input check.
 * It is not a per-order sale policy and not an availability figure.
 */
export const INVENTORY_QUANTITY_BOUND = 6;

export const INVENTORY_READ_TENANT = DISCOVERY_READ_TENANT;

/** The desk's own access scope. The subject string is not an authentication result. */
export const INVENTORY_DESK_SCOPE = {
  tenantId: INVENTORY_READ_TENANT,
  subject: "inventory-desk",
} as const;

export type InventoryAccessScope = DiscoveryAccessScope;

/** Fixed instant the synthetic projection claims to be built at. */
export const INVENTORY_AS_OF = DISCOVERY_PROJECTION_AS_OF;

/** A watermark older than this span before AS_OF is stale. */
export const INVENTORY_STALE_AFTER_MS = 86_400_000;

/** A synthetic observed hold lasts this long past AS_OF. */
export const INVENTORY_HOLD_WINDOW_MS = 900_000;

export const INVENTORY_CURSOR_VERSION = 1;

export const INVENTORY_MODES = ["seat", "ga", "accessible"] as const;

export type InventoryMode = (typeof INVENTORY_MODES)[number];

/** Modes this desk can select in. Accessible seating policy is undetermined. */
export const INVENTORY_SUPPORTED_MODES = ["seat", "ga"] as const;

export const INVENTORY_ACCESSIBLE_UNSUPPORTED_REASON =
  "Accessibility seating policy is UNDETERMINED. This desk does not offer, hold, or hide accessible seats.";

export const INVENTORY_SCENARIOS = [
  "clean",
  "hot",
  "stale-hold",
  "old-generation-hold",
  "queue-waiting",
  "queue-admitted",
  "queue-lapsed",
  "stale",
] as const;

export type InventoryScenario = (typeof INVENTORY_SCENARIOS)[number];

export const INVENTORY_QUEUE_STATES = ["none", "waiting", "admitted", "lapsed"] as const;

export type InventoryQueueState = (typeof INVENTORY_QUEUE_STATES)[number];

/** What a seat unit looks like in the latest read. An observation, not a decision. */
export type InventoryObserved = "free" | "held" | "taken";

/** Coarse band for a GA pool or a section summary. Not a count of tickets. */
export type InventoryBand = "available" | "limited" | "none";

export const INVENTORY_INVALID_CODES = [
  "SCOPE",
  "SECTION",
  "MODE",
  "PAGE_SIZE",
  "FILTER",
  "GENERATION",
  "UNIT_ID",
  "QUANTITY",
  "BOUND",
] as const;

export type InventoryInvalidCode = (typeof INVENTORY_INVALID_CODES)[number];

export const INVENTORY_GAP_CODES = ["SEQUENCE", "ORDER", "DUPLICATE", "OVER_BOUND"] as const;

export type InventoryGapCode = (typeof INVENTORY_GAP_CODES)[number];

export const INVENTORY_CURSOR_CODES = ["VERSION", "GENERATION", "SECTION", "FILTER", "TENANT", "SHAPE"] as const;

export type InventoryCursorCode = (typeof INVENTORY_CURSOR_CODES)[number];

export type InventoryHoldStaleReason = "expired" | "other-generation";

/** One hold seen in the projection. The reader never places or extends one. */
export interface InventoryHoldObservation {
  expiresAt: string;
  /** Set by the port from the fixed AS_OF instant. The screen copies it. */
  expired: boolean;
  /** Generation the hold was recorded under. */
  holdGeneration: number;
  /** False when the hold belongs to an earlier generation than the unit's. */
  currentGeneration: boolean;
}

interface InventoryNonClaims {
  /** An observation never confirms any of these. They stay literal false. */
  confirmsReservation: false;
  confirmsOwnership: false;
  confirmsPayment: false;
  grantsEntry: false;
}

export interface InventorySeatUnit extends InventoryNonClaims {
  mode: "seat";
  sequence: number;
  tenantId: string;
  sectionId: string;
  unitId: string;
  seatLabel: string;
  observed: InventoryObserved;
  hold: InventoryHoldObservation | null;
  watermark: string;
  generation: number;
}

export interface InventoryGaPool extends InventoryNonClaims {
  mode: "ga";
  tenantId: string;
  sectionId: string;
  unitId: string;
  poolLabel: string;
  /** A GA pool has no seat. This stays null on every read. */
  seatLabel: null;
  assignment: "none";
  band: InventoryBand;
  capacityEstimate: number;
  watermark: string;
  generation: number;
}

export type InventoryUnit = InventorySeatUnit | InventoryGaPool;

export interface InventorySectionSummary {
  sectionId: string;
  label: string;
  mode: InventoryMode;
  supported: boolean;
  unsupportedReason: string | null;
  /** Declared seats or declared GA capacity. A label, not remaining stock. Null when unsupported. */
  capacityEstimate: number | null;
  band: InventoryBand | null;
  watermark: string;
  generation: number;
}

/**
 * Queue admission means access to the selection pages. It is not a hold,
 * not a payment, not an issued right, and not entry at the door. The desk has
 * no published command to join or rejoin a queue.
 */
export interface InventoryQueueView {
  state: InventoryQueueState;
  position: number | null;
  admittedUntil: string | null;
  expired: boolean | null;
  grantsSelectionAccess: boolean;
  grantsReservation: false;
  grantsPayment: false;
  grantsRight: false;
  grantsDoorEntry: false;
  joinSupported: false;
  note: string;
}

export interface InventorySectionSpec {
  sectionId: string;
  label: string;
  mode: InventoryMode;
  /** Seats for a seat section, declared pool capacity for GA, ignored for accessible. */
  capacity: number;
  /** Coarse band for the summary. A GA pool reads it back on its row. */
  band: InventoryBand | null;
}

export const INVENTORY_DEFAULT_SECTIONS: readonly InventorySectionSpec[] = [
  { sectionId: "sec-orch", label: "Orchestra", mode: "seat", capacity: 20_000, band: "available" },
  { sectionId: "sec-balc", label: "Balcony", mode: "seat", capacity: 4_800, band: "limited" },
  { sectionId: "sec-pit", label: "Standing pit", mode: "ga", capacity: 12_000, band: "available" },
  { sectionId: "sec-lawn", label: "Lawn", mode: "ga", capacity: 30_000, band: "limited" },
  { sectionId: "sec-acc", label: "Accessible block", mode: "accessible", capacity: 0, band: null },
  { sectionId: "sec-side", label: "Side stage (closed)", mode: "seat", capacity: 0, band: "none" },
];

export interface InventorySummaryRequest {
  scope: InventoryAccessScope;
  watermarkFloor: string | null;
}

export interface InventoryReadCursor {
  cursorVersion: number;
  projectionName: string;
  generation: number;
  tenantId: string;
  sectionId: string;
  filterKey: string;
  afterSequence: number;
  watermark: string;
}

export interface InventoryPageRequest {
  scope: InventoryAccessScope;
  sectionId: string;
  /** The mode the caller read in the summary. A different live mode is refused. */
  expectedMode: InventoryMode;
  /** The generation the caller read in the summary. */
  heldGeneration: number;
  pageSize: number;
  cursor: InventoryReadCursor | null;
  freeOnly: boolean;
  watermarkFloor: string | null;
}

export interface InventorySelectionRequest {
  scope: InventoryAccessScope;
  sectionId: string;
  unitId: string;
  expectedMode: InventoryMode;
  heldGeneration: number;
  /** A GA selection carries a whole quantity. A seat selection carries none. */
  quantity: number | null;
  /** The label the page showed for this unit. Used to report a change since the page. */
  seenAs: string | null;
  watermarkFloor: string | null;
}

/**
 * The result of a selection read. The selection is local to the screen.
 * It never confirms a reservation, ownership, or payment, and it carries no
 * approval from the economic writer.
 */
interface InventorySelectionBase {
  selectedLocally: true;
  reservationConfirmed: false;
  ownershipConfirmed: false;
  paymentConfirmed: false;
  economicWriterApproval: "none";
}

export interface InventorySeatSelection extends InventorySelectionBase {
  mode: "seat";
  unit: InventorySeatUnit;
}

export interface InventoryGaSelection extends InventorySelectionBase {
  mode: "ga";
  unit: InventoryGaPool;
  quantity: number;
  assignment: "none";
  seatLabel: null;
}

export type InventorySelection = InventorySeatSelection | InventoryGaSelection;

export type InventoryCommonFailure =
  | { kind: "tuple-changed"; field: string; expected: string; actual: string }
  | { kind: "not-bound"; reason: string }
  | { kind: "invalid-request"; code: InventoryInvalidCode; detail: string }
  | { kind: "unknown"; message: string };

export type InventorySummaryOutcome =
  | {
      kind: "ready";
      sections: readonly InventorySectionSummary[];
      queue: InventoryQueueView;
      generation: number;
      watermark: string;
      scenario: InventoryScenario;
    }
  | { kind: "empty"; queue: InventoryQueueView; generation: number; watermark: string }
  | { kind: "stale"; watermark: string; floor: string }
  | InventoryCommonFailure;

export type InventoryPageOutcome =
  | {
      kind: "ready";
      section: InventorySectionSummary;
      rows: readonly InventoryUnit[];
      nextCursor: InventoryReadCursor | null;
      watermark: string;
      scannedCount: number;
      totalEstimate: number;
      generation: number;
      queue: InventoryQueueView;
    }
  | { kind: "empty"; section: InventorySectionSummary; generation: number }
  | { kind: "unsupported"; sectionId: string; mode: InventoryMode; reason: string }
  | { kind: "mode-mismatch"; sectionId: string; expected: InventoryMode; actual: InventoryMode }
  | { kind: "generation-changed"; held: number; current: number }
  | { kind: "queue-blocked"; queue: InventoryQueueView }
  | { kind: "cursor-invalid"; code: InventoryCursorCode; detail: string }
  | { kind: "gap"; code: InventoryGapCode; detail: string }
  | { kind: "tenant-mismatch"; unitId: string; tenantId: string }
  | { kind: "stale"; watermark: string; floor: string }
  | InventoryCommonFailure;

export type InventorySelectionOutcome =
  | {
      kind: "ready";
      selection: InventorySelection;
      changedSincePage: boolean;
      generation: number;
      queue: InventoryQueueView;
    }
  | {
      kind: "unit-unavailable";
      unitId: string;
      observed: "held" | "taken" | "none";
      hold: InventoryHoldObservation | null;
      changedSincePage: boolean;
    }
  | { kind: "hold-stale"; unitId: string; hold: InventoryHoldObservation; reason: InventoryHoldStaleReason }
  | { kind: "empty"; unitId: string }
  | { kind: "unsupported"; sectionId: string; mode: InventoryMode; reason: string }
  | { kind: "mode-mismatch"; sectionId: string; expected: InventoryMode; actual: InventoryMode }
  | { kind: "generation-changed"; held: number; current: number }
  | { kind: "queue-blocked"; queue: InventoryQueueView }
  | { kind: "tenant-mismatch"; unitId: string; tenantId: string }
  | { kind: "stale"; watermark: string; floor: string }
  | InventoryCommonFailure;

export interface InventoryReadPort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic-inventory" | "none";
  readonly generation: number;
  readonly scenario: InventoryScenario;
  readSummary(request: InventorySummaryRequest): Promise<InventorySummaryOutcome>;
  readPage(request: InventoryPageRequest): Promise<InventoryPageOutcome>;
  readSelection(request: InventorySelectionRequest): Promise<InventorySelectionOutcome>;
}

export interface StubInventoryReadOptions {
  /** Synthetic scenario. Default clean. */
  scenario?: InventoryScenario;
  /** Generation this source serves. Default INVENTORY_GENERATION. */
  generation?: number;
  /** Venue layout. Default INVENTORY_DEFAULT_SECTIONS. */
  sections?: readonly InventorySectionSpec[];
  /** Lazy seat generator. The port calls it for the bounded window only. */
  seatAt?: (section: InventorySectionSpec, index: number, context: InventorySeatContext) => InventorySeatUnit;
  /** Expected tuple override. Used to stage a producer change in tests. */
  expectedTuple?: DiscoveryReadTuple;
}

export interface InventorySeatContext {
  scenario: InventoryScenario;
  generation: number;
  /** Number of row-reading calls this port has served, counting the current one. */
  tick: number;
}

export function createStubInventoryRead(options: StubInventoryReadOptions = {}): InventoryReadPort {
  return new StubInventoryRead(options);
}

export function createNotBoundInventoryRead(): InventoryReadPort {
  const outcome = { kind: "not-bound", reason: INVENTORY_READ_NOT_BOUND_REASON } as const;
  return {
    environment: "integration-http",
    source: "none",
    generation: INVENTORY_GENERATION,
    scenario: "clean",
    readSummary() {
      return Promise.resolve({ ...outcome });
    },
    readPage() {
      return Promise.resolve({ ...outcome });
    },
    readSelection() {
      return Promise.resolve({ ...outcome });
    },
  };
}

export function inventoryReadPortFor(
  environment: "stub" | "integration-http",
  options: StubInventoryReadOptions = {},
): InventoryReadPort {
  if (environment === "stub") {
    return createStubInventoryRead(options);
  }
  return createNotBoundInventoryRead();
}

export function inventoryUnitId(section: Pick<InventorySectionSpec, "sectionId" | "mode">, sequence: number): string {
  return section.mode === "ga" ? `${section.sectionId}-pool` : `${section.sectionId}-s${pad6(sequence)}`;
}

/** Label of a unit as a page or detail shows it, so a later read can report a change. */
export function inventoryUnitLabel(unit: InventoryUnit): string {
  return unit.mode === "seat" ? unit.observed : unit.band;
}

class StubInventoryRead implements InventoryReadPort {
  readonly environment = "stub" as const;
  readonly source = "synthetic-inventory" as const;
  readonly generation: number;
  readonly scenario: InventoryScenario;
  private readonly sections: readonly InventorySectionSpec[];
  private readonly seatAt: (section: InventorySectionSpec, index: number, context: InventorySeatContext) => InventorySeatUnit;
  private readonly expectedTuple: DiscoveryReadTuple;
  private tick = 0;

  constructor(options: StubInventoryReadOptions) {
    this.generation = options.generation ?? INVENTORY_GENERATION;
    this.scenario = options.scenario ?? "clean";
    this.sections = options.sections ?? INVENTORY_DEFAULT_SECTIONS;
    this.seatAt = options.seatAt ?? defaultSeatAt;
    this.expectedTuple = options.expectedTuple ?? DISCOVERY_READ_TUPLE_LITERALS;
    if (this.sections.length > INVENTORY_SECTION_BOUND) {
      throw new ProtocolError(
        `An inventory summary holds at most ${INVENTORY_SECTION_BOUND} sections.`,
        "INVENTORY_SECTION_BOUND",
      );
    }
  }

  readSummary(request: InventorySummaryRequest): Promise<InventorySummaryOutcome> {
    const tuple = this.tupleCheck();
    if (tuple) {
      return Promise.resolve(tuple);
    }
    if (!isRecord(request)) {
      return Promise.resolve(invalid("BOUND", "The request is not an object."));
    }
    const scope = validateScope(request.scope);
    if (scope) {
      return Promise.resolve(scope);
    }
    const floorCheck = validateFloor(request.watermarkFloor);
    if (floorCheck) {
      return Promise.resolve(floorCheck);
    }
    const watermark = this.watermark();
    const floor = staleFloor(request.watermarkFloor);
    if (Date.parse(watermark) < Date.parse(floor)) {
      return Promise.resolve({ kind: "stale", watermark, floor });
    }
    const queue = this.queueView();
    if (this.sections.length === 0) {
      return Promise.resolve({ kind: "empty", queue, generation: this.generation, watermark });
    }
    return Promise.resolve({
      kind: "ready",
      sections: this.sections.map((spec) => this.summaryOf(spec)),
      queue,
      generation: this.generation,
      watermark,
      scenario: this.scenario,
    });
  }

  readPage(request: InventoryPageRequest): Promise<InventoryPageOutcome> {
    const tuple = this.tupleCheck();
    if (tuple) {
      return Promise.resolve(tuple);
    }
    const bad = validatePageRequest(request);
    if (bad) {
      return Promise.resolve(bad);
    }
    if (request.heldGeneration !== this.generation) {
      return Promise.resolve({ kind: "generation-changed", held: request.heldGeneration, current: this.generation });
    }
    const spec = this.sections.find((item) => item.sectionId === request.sectionId);
    if (!spec) {
      return Promise.resolve(invalid("SECTION", `Section ${request.sectionId} is not in generation ${this.generation}.`));
    }
    if (spec.mode !== request.expectedMode) {
      return Promise.resolve({
        kind: "mode-mismatch",
        sectionId: spec.sectionId,
        expected: request.expectedMode,
        actual: spec.mode,
      });
    }
    if (!isSupported(spec.mode)) {
      return Promise.resolve({
        kind: "unsupported",
        sectionId: spec.sectionId,
        mode: spec.mode,
        reason: INVENTORY_ACCESSIBLE_UNSUPPORTED_REASON,
      });
    }
    const queue = this.queueView();
    if (!queue.grantsSelectionAccess) {
      return Promise.resolve({ kind: "queue-blocked", queue });
    }
    const cursorCheck = this.checkCursor(request.cursor, request, spec);
    if (cursorCheck) {
      return Promise.resolve(cursorCheck);
    }
    const section = this.summaryOf(spec);
    if (spec.capacity === 0) {
      return Promise.resolve({ kind: "empty", section, generation: this.generation });
    }
    const tick = ++this.tick;
    const context: InventorySeatContext = { scenario: this.scenario, generation: this.generation, tick };
    let delivered: InventoryUnit[];
    const afterSequence = request.cursor === null ? 0 : request.cursor.afterSequence;
    try {
      delivered = spec.mode === "ga" ? [this.poolOf(spec)] : this.seatWindow(spec, afterSequence, request.pageSize, context);
    } catch (reason) {
      return Promise.resolve({ kind: "unknown", message: messageOf(reason) });
    }
    if (delivered.length > request.pageSize) {
      return Promise.resolve({
        kind: "gap",
        code: "OVER_BOUND",
        detail: `The source delivered ${delivered.length} rows for page size ${request.pageSize}.`,
      });
    }
    let expectedSequence = afterSequence + 1;
    const unitIds = new Set<string>();
    let pageWatermark: string | null = null;
    for (const row of delivered) {
      if (row.mode === "seat") {
        if (!Number.isSafeInteger(row.sequence) || row.sequence !== expectedSequence) {
          const code: InventoryGapCode =
            Number.isSafeInteger(row.sequence) && row.sequence > expectedSequence ? "SEQUENCE" : "ORDER";
          return Promise.resolve({
            kind: "gap",
            code,
            detail: `Expected sequence ${expectedSequence} and received ${row.sequence} (${row.unitId}).`,
          });
        }
        expectedSequence += 1;
      }
      if (row.tenantId !== request.scope.tenantId) {
        return Promise.resolve({ kind: "tenant-mismatch", unitId: row.unitId, tenantId: row.tenantId });
      }
      if (unitIds.has(row.unitId)) {
        return Promise.resolve({ kind: "gap", code: "DUPLICATE", detail: `Unit ${row.unitId} was delivered twice on one page.` });
      }
      unitIds.add(row.unitId);
      pageWatermark = minInstant(pageWatermark, row.watermark);
    }
    const watermark = pageWatermark ?? this.watermark();
    const floor = staleFloor(request.watermarkFloor);
    if (Date.parse(watermark) < Date.parse(floor)) {
      return Promise.resolve({ kind: "stale", watermark, floor });
    }
    const rows = request.freeOnly ? delivered.filter(isFreeObserved) : delivered;
    const scannedThrough = afterSequence + delivered.length;
    const endOfStream = spec.mode === "ga" || scannedThrough >= spec.capacity;
    const nextCursor: InventoryReadCursor | null = endOfStream
      ? null
      : {
          cursorVersion: INVENTORY_CURSOR_VERSION,
          projectionName: INVENTORY_PROJECTION_NAME,
          generation: this.generation,
          tenantId: request.scope.tenantId,
          sectionId: spec.sectionId,
          filterKey: filterKeyOf(request.freeOnly),
          afterSequence: scannedThrough,
          watermark,
        };
    return Promise.resolve({
      kind: "ready",
      section,
      rows,
      nextCursor,
      watermark,
      scannedCount: delivered.length,
      totalEstimate: spec.capacity,
      generation: this.generation,
      queue,
    });
  }

  readSelection(request: InventorySelectionRequest): Promise<InventorySelectionOutcome> {
    const tuple = this.tupleCheck();
    if (tuple) {
      return Promise.resolve(tuple);
    }
    const bad = validateSelectionRequest(request);
    if (bad) {
      return Promise.resolve(bad);
    }
    if (request.heldGeneration !== this.generation) {
      return Promise.resolve({ kind: "generation-changed", held: request.heldGeneration, current: this.generation });
    }
    const spec = this.sections.find((item) => item.sectionId === request.sectionId);
    if (!spec) {
      return Promise.resolve(invalid("SECTION", `Section ${request.sectionId} is not in generation ${this.generation}.`));
    }
    if (spec.mode !== request.expectedMode) {
      return Promise.resolve({
        kind: "mode-mismatch",
        sectionId: spec.sectionId,
        expected: request.expectedMode,
        actual: spec.mode,
      });
    }
    if (!isSupported(spec.mode)) {
      return Promise.resolve({
        kind: "unsupported",
        sectionId: spec.sectionId,
        mode: spec.mode,
        reason: INVENTORY_ACCESSIBLE_UNSUPPORTED_REASON,
      });
    }
    const shape = unitShape(request.unitId, spec.sectionId);
    if (shape === null) {
      return Promise.resolve(invalid("UNIT_ID", `Unit id ${request.unitId} does not belong to ${spec.sectionId}.`));
    }
    if (shape.mode !== spec.mode) {
      return Promise.resolve({ kind: "mode-mismatch", sectionId: spec.sectionId, expected: shape.mode, actual: spec.mode });
    }
    if (spec.mode === "seat" && request.quantity !== null) {
      return Promise.resolve({ kind: "mode-mismatch", sectionId: spec.sectionId, expected: "ga", actual: "seat" });
    }
    if (spec.mode === "ga" && !validQuantity(request.quantity)) {
      return Promise.resolve(
        invalid("QUANTITY", `A GA selection takes a whole quantity from 1 to ${INVENTORY_QUANTITY_BOUND}.`),
      );
    }
    const queue = this.queueView();
    if (!queue.grantsSelectionAccess) {
      return Promise.resolve({ kind: "queue-blocked", queue });
    }
    if (spec.mode === "seat" && (shape.sequence < 1 || shape.sequence > spec.capacity)) {
      return Promise.resolve({ kind: "empty", unitId: request.unitId });
    }
    const tick = ++this.tick;
    const context: InventorySeatContext = { scenario: this.scenario, generation: this.generation, tick };
    let unit: InventoryUnit;
    try {
      unit = spec.mode === "ga" ? this.poolOf(spec) : this.seatAt(spec, shape.sequence - 1, context);
    } catch (reason) {
      return Promise.resolve({ kind: "unknown", message: messageOf(reason) });
    }
    if (unit.tenantId !== request.scope.tenantId) {
      return Promise.resolve({ kind: "tenant-mismatch", unitId: unit.unitId, tenantId: unit.tenantId });
    }
    if (unit.unitId !== request.unitId) {
      return Promise.resolve(invalid("UNIT_ID", `The source returned ${unit.unitId} for ${request.unitId}.`));
    }
    const floor = staleFloor(request.watermarkFloor);
    if (Date.parse(unit.watermark) < Date.parse(floor)) {
      return Promise.resolve({ kind: "stale", watermark: unit.watermark, floor });
    }
    const changedSincePage = request.seenAs !== null && request.seenAs !== inventoryUnitLabel(unit);
    if (unit.mode === "ga") {
      if (unit.band === "none") {
        return Promise.resolve({
          kind: "unit-unavailable",
          unitId: unit.unitId,
          observed: "none",
          hold: null,
          changedSincePage,
        });
      }
      return Promise.resolve({
        kind: "ready",
        selection: {
          mode: "ga",
          unit,
          quantity: request.quantity as number,
          assignment: "none",
          seatLabel: null,
          ...SELECTION_NON_CLAIMS,
        },
        changedSincePage,
        generation: this.generation,
        queue,
      });
    }
    if (unit.observed === "taken") {
      return Promise.resolve({ kind: "unit-unavailable", unitId: unit.unitId, observed: "taken", hold: null, changedSincePage });
    }
    if (unit.observed === "held") {
      const hold = unit.hold;
      if (hold === null) {
        return Promise.resolve({ kind: "unknown", message: `Unit ${unit.unitId} is held with no hold observation.` });
      }
      if (hold.expired || !hold.currentGeneration) {
        return Promise.resolve({
          kind: "hold-stale",
          unitId: unit.unitId,
          hold,
          reason: hold.expired ? "expired" : "other-generation",
        });
      }
      return Promise.resolve({ kind: "unit-unavailable", unitId: unit.unitId, observed: "held", hold, changedSincePage });
    }
    return Promise.resolve({
      kind: "ready",
      selection: { mode: "seat", unit, ...SELECTION_NON_CLAIMS },
      changedSincePage,
      generation: this.generation,
      queue,
    });
  }

  private tupleCheck(): Extract<InventoryCommonFailure, { kind: "tuple-changed" }> | null {
    const mismatch = checkDiscoveryReadTuple(this.expectedTuple);
    if (mismatch === null) {
      return null;
    }
    return { kind: "tuple-changed", field: mismatch.field, expected: mismatch.expected, actual: mismatch.actual };
  }

  private watermark(): string {
    return this.scenario === "stale" ? STALE_WATERMARK : INVENTORY_AS_OF;
  }

  private queueView(): InventoryQueueView {
    return queueFor(this.scenario);
  }

  private summaryOf(spec: InventorySectionSpec): InventorySectionSummary {
    const supported = isSupported(spec.mode);
    return {
      sectionId: spec.sectionId,
      label: spec.label,
      mode: spec.mode,
      supported,
      unsupportedReason: supported ? null : INVENTORY_ACCESSIBLE_UNSUPPORTED_REASON,
      capacityEstimate: supported ? spec.capacity : null,
      band: supported ? spec.band : null,
      watermark: this.watermark(),
      generation: this.generation,
    };
  }

  private poolOf(spec: InventorySectionSpec): InventoryGaPool {
    return {
      mode: "ga",
      tenantId: INVENTORY_READ_TENANT,
      sectionId: spec.sectionId,
      unitId: inventoryUnitId(spec, 1),
      poolLabel: spec.label,
      seatLabel: null,
      assignment: "none",
      band: spec.band ?? "none",
      capacityEstimate: spec.capacity,
      watermark: this.watermark(),
      generation: this.generation,
      confirmsReservation: false,
      confirmsOwnership: false,
      confirmsPayment: false,
      grantsEntry: false,
    };
  }

  private seatWindow(
    spec: InventorySectionSpec,
    afterSequence: number,
    limit: number,
    context: InventorySeatContext,
  ): InventoryUnit[] {
    const start = Math.max(0, Math.min(spec.capacity, afterSequence));
    const end = Math.min(spec.capacity, start + limit);
    const rows: InventoryUnit[] = [];
    for (let index = start; index < end; index += 1) {
      rows.push(this.seatAt(spec, index, context));
    }
    return rows;
  }

  private checkCursor(
    cursor: InventoryReadCursor | null,
    request: InventoryPageRequest,
    spec: InventorySectionSpec,
  ): InventoryPageOutcome | null {
    if (cursor === null) {
      return null;
    }
    if (!isRecord(cursor)) {
      return cursorInvalid("SHAPE", "The cursor is not an object.");
    }
    if (cursor.cursorVersion !== INVENTORY_CURSOR_VERSION) {
      return cursorInvalid("VERSION", "The cursor version is not supported.");
    }
    if (cursor.projectionName !== INVENTORY_PROJECTION_NAME) {
      return cursorInvalid("SHAPE", "The cursor names a different projection.");
    }
    if (cursor.generation !== this.generation) {
      return cursorInvalid(
        "GENERATION",
        `The cursor was issued under generation ${String(cursor.generation)} and the inventory serves generation ${this.generation}.`,
      );
    }
    if (cursor.tenantId !== request.scope.tenantId) {
      return cursorInvalid("TENANT", "The cursor belongs to another tenant.");
    }
    if (cursor.sectionId !== spec.sectionId) {
      return cursorInvalid("SECTION", "The cursor belongs to another section.");
    }
    if (cursor.filterKey !== filterKeyOf(request.freeOnly)) {
      return cursorInvalid("FILTER", "The filter changed after the cursor was issued.");
    }
    if (spec.mode === "ga") {
      return cursorInvalid("SHAPE", "A GA section has one pool and no later page.");
    }
    if (!Number.isSafeInteger(cursor.afterSequence) || cursor.afterSequence < 0) {
      return cursorInvalid("SHAPE", "The cursor position is not a sequence.");
    }
    if (cursor.afterSequence >= spec.capacity) {
      return cursorInvalid("SHAPE", "The cursor is at or past the section end.");
    }
    if (typeof cursor.watermark !== "string" || !isInstant(cursor.watermark)) {
      return cursorInvalid("SHAPE", "The cursor watermark is not an instant.");
    }
    return null;
  }
}

const SELECTION_NON_CLAIMS: InventorySelectionBase = {
  selectedLocally: true,
  reservationConfirmed: false,
  ownershipConfirmed: false,
  paymentConfirmed: false,
  economicWriterApproval: "none",
};

const STALE_WATERMARK = new Date(Date.parse(INVENTORY_AS_OF) - 2 * INVENTORY_STALE_AFTER_MS).toISOString();

function isSupported(mode: InventoryMode): boolean {
  return (INVENTORY_SUPPORTED_MODES as readonly string[]).includes(mode);
}

function isFreeObserved(unit: InventoryUnit): boolean {
  return unit.mode === "seat" ? unit.observed === "free" : unit.band !== "none";
}

function filterKeyOf(freeOnly: boolean): string {
  return freeOnly ? "free-only" : "all";
}

function invalid(code: InventoryInvalidCode, detail: string): Extract<InventoryCommonFailure, { kind: "invalid-request" }> {
  return { kind: "invalid-request", code, detail };
}

function cursorInvalid(code: InventoryCursorCode, detail: string): Extract<InventoryPageOutcome, { kind: "cursor-invalid" }> {
  return { kind: "cursor-invalid", code, detail };
}

function validateScope(scope: InventoryAccessScope): Extract<InventoryCommonFailure, { kind: "invalid-request" }> | null {
  if (!isRecord(scope)) {
    return invalid("SCOPE", "The access scope is not an object.");
  }
  if (scope.tenantId !== INVENTORY_READ_TENANT) {
    return invalid("SCOPE", `This read serves ${INVENTORY_READ_TENANT} only.`);
  }
  if (
    typeof scope.subject !== "string" ||
    scope.subject.length === 0 ||
    scope.subject.length > 100 ||
    scope.subject !== scope.subject.trim()
  ) {
    return invalid("SCOPE", "The subject is not a non-empty trimmed string.");
  }
  return null;
}

function validateFloor(floor: string | null): Extract<InventoryCommonFailure, { kind: "invalid-request" }> | null {
  if (floor !== null && (typeof floor !== "string" || !isInstant(floor))) {
    return invalid("BOUND", "watermarkFloor is not an instant.");
  }
  return null;
}

const SECTION_ID = /^[a-z][a-z0-9-]{0,39}$/;

function validateCommon(request: {
  scope: InventoryAccessScope;
  sectionId: string;
  expectedMode: InventoryMode;
  heldGeneration: number;
  watermarkFloor: string | null;
}): Extract<InventoryCommonFailure, { kind: "invalid-request" }> | null {
  const scope = validateScope(request.scope);
  if (scope) {
    return scope;
  }
  if (typeof request.sectionId !== "string" || !SECTION_ID.test(request.sectionId)) {
    return invalid("SECTION", "A section id is lower-case letters, digits, and hyphens.");
  }
  if (!(INVENTORY_MODES as readonly string[]).includes(request.expectedMode)) {
    return invalid("MODE", "expectedMode is outside the enum.");
  }
  if (!Number.isSafeInteger(request.heldGeneration) || request.heldGeneration < 0) {
    return invalid("GENERATION", "heldGeneration is not a non-negative integer.");
  }
  return validateFloor(request.watermarkFloor);
}

function validatePageRequest(request: InventoryPageRequest): Extract<InventoryCommonFailure, { kind: "invalid-request" }> | null {
  if (!isRecord(request)) {
    return invalid("BOUND", "The request is not an object.");
  }
  const common = validateCommon(request);
  if (common) {
    return common;
  }
  if (!Number.isSafeInteger(request.pageSize) || request.pageSize < 1 || request.pageSize > INVENTORY_PAGE_BOUND) {
    return invalid("PAGE_SIZE", `pageSize must be an integer from 1 to ${INVENTORY_PAGE_BOUND}.`);
  }
  if (typeof request.freeOnly !== "boolean") {
    return invalid("FILTER", "freeOnly is not a boolean.");
  }
  return null;
}

function validateSelectionRequest(
  request: InventorySelectionRequest,
): Extract<InventoryCommonFailure, { kind: "invalid-request" }> | null {
  if (!isRecord(request)) {
    return invalid("BOUND", "The request is not an object.");
  }
  const common = validateCommon(request);
  if (common) {
    return common;
  }
  if (typeof request.unitId !== "string" || request.unitId.length === 0 || request.unitId.length > 100) {
    return invalid("UNIT_ID", "A unit id is a non-empty string of at most 100 characters.");
  }
  if (request.quantity !== null && typeof request.quantity !== "number") {
    return invalid("QUANTITY", "quantity is neither null nor a number.");
  }
  if (request.seenAs !== null && (typeof request.seenAs !== "string" || request.seenAs.length > 32)) {
    return invalid("BOUND", "seenAs is neither null nor a short string.");
  }
  return null;
}

function validQuantity(value: number | null): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= INVENTORY_QUANTITY_BOUND;
}

/** The mode a unit id is shaped for, and its sequence for a seat. Null when it fits no shape of this section. */
function unitShape(unitId: string, sectionId: string): { mode: "seat"; sequence: number } | { mode: "ga"; sequence: 0 } | null {
  if (unitId === `${sectionId}-pool`) {
    return { mode: "ga", sequence: 0 };
  }
  const prefix = `${sectionId}-s`;
  if (!unitId.startsWith(prefix)) {
    return null;
  }
  const digits = unitId.slice(prefix.length);
  if (!/^[0-9]{6,9}$/.test(digits)) {
    return null;
  }
  return { mode: "seat", sequence: Number(digits) };
}

function queueFor(scenario: InventoryScenario): InventoryQueueView {
  const base = {
    grantsReservation: false,
    grantsPayment: false,
    grantsRight: false,
    grantsDoorEntry: false,
    joinSupported: false,
  } as const;
  if (scenario === "queue-waiting") {
    return {
      ...base,
      state: "waiting",
      position: 1842,
      admittedUntil: null,
      expired: null,
      grantsSelectionAccess: false,
      note: "Waiting in the queue. Selection pages are closed until the queue admits this session.",
    };
  }
  if (scenario === "queue-admitted") {
    return {
      ...base,
      state: "admitted",
      position: null,
      admittedUntil: plusMs(INVENTORY_AS_OF, INVENTORY_HOLD_WINDOW_MS),
      expired: false,
      grantsSelectionAccess: true,
      note: "Queue admission opens the selection pages. It is not a hold, a payment, an issued right, or entry at the door.",
    };
  }
  if (scenario === "queue-lapsed") {
    return {
      ...base,
      state: "lapsed",
      position: null,
      admittedUntil: plusMs(INVENTORY_AS_OF, -300_000),
      expired: true,
      grantsSelectionAccess: false,
      note: "Queue admission lapsed. This desk has no published command to join the queue again.",
    };
  }
  return {
    ...base,
    state: "none",
    position: null,
    admittedUntil: null,
    expired: null,
    grantsSelectionAccess: true,
    note: "No queue is in front of the selection pages.",
  };
}

/**
 * Baseline observation per sequence. The hot scenario flips the low sequences
 * from the second row-reading call on, as if they sold between two reads.
 */
function observedAt(sequence: number, context: InventorySeatContext): InventoryObserved {
  let observed: InventoryObserved = "free";
  if (sequence % 7 === 0) {
    observed = "taken";
  } else if (sequence % 5 === 2) {
    observed = "held";
  }
  if (context.scenario === "hot" && context.tick >= 2 && sequence <= 15 && observed === "free") {
    return sequence % 2 === 1 ? "taken" : "held";
  }
  return observed;
}

function holdFor(context: InventorySeatContext): InventoryHoldObservation {
  const staleHold = context.scenario === "stale-hold";
  const oldGeneration = context.scenario === "old-generation-hold";
  const expiresAt = plusMs(INVENTORY_AS_OF, staleHold ? -600_000 : INVENTORY_HOLD_WINDOW_MS);
  return {
    expiresAt,
    expired: Date.parse(expiresAt) <= Date.parse(INVENTORY_AS_OF),
    holdGeneration: oldGeneration ? context.generation - 1 : context.generation,
    currentGeneration: !oldGeneration,
  };
}

function defaultSeatAt(section: InventorySectionSpec, index: number, context: InventorySeatContext): InventorySeatUnit {
  const sequence = index + 1;
  const observed = observedAt(sequence, context);
  const row = Math.floor(index / 100) + 1;
  const seat = (index % 100) + 1;
  return {
    mode: "seat",
    sequence,
    tenantId: INVENTORY_READ_TENANT,
    sectionId: section.sectionId,
    unitId: inventoryUnitId(section, sequence),
    seatLabel: `${section.label} R${row} S${seat}`,
    observed,
    hold: observed === "held" ? holdFor(context) : null,
    watermark: context.scenario === "stale" ? STALE_WATERMARK : INVENTORY_AS_OF,
    generation: context.generation,
    confirmsReservation: false,
    confirmsOwnership: false,
    confirmsPayment: false,
    grantsEntry: false,
  };
}

function staleFloor(requestFloor: string | null): string {
  const staleBound = plusMs(INVENTORY_AS_OF, -INVENTORY_STALE_AFTER_MS);
  if (requestFloor !== null && isInstant(requestFloor) && Date.parse(requestFloor) > Date.parse(staleBound)) {
    return requestFloor;
  }
  return staleBound;
}

function isInstant(value: string): boolean {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function minInstant(left: string | null, right: string): string {
  if (left === null) {
    return right;
  }
  return Date.parse(right) < Date.parse(left) ? right : left;
}

function plusMs(base: string, ms: number): string {
  return new Date(Date.parse(base) + ms).toISOString();
}

function pad6(value: number): string {
  return String(value).padStart(6, "0");
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : "The inventory source failed.";
}
