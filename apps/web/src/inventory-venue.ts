import { connectedActions } from "./connectivity/write-guard";
/**
 * The seat and GA selection read on top of the adapter's bounded port.
 * Stub scope: the default port is the synthetic inventory. On integration-http
 * the same port is not-bound — the contract-only catalogue has no inventory,
 * hold, or queue read command, and this module does not invent one, send a
 * second attempt, or switch adapters.
 * Flow: summary, then one bounded page, then one selection detail. Refresh is
 * explicit. Nothing here polls, sets a timer, or reads a clock.
 * A selection is local to the screen. It sends nothing and confirms nothing.
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  INVENTORY_DESK_SCOPE,
  INVENTORY_GENERATION,
  INVENTORY_HOLD_NOT_BOUND,
  INVENTORY_PAGE_BOUND,
  INVENTORY_QUANTITY_BOUND,
  inventoryReadPortFor,
  inventoryUnitLabel,
  type InventoryMode,
  type InventoryPageOutcome,
  type InventoryQueueView,
  type InventoryReadCursor,
  type InventoryReadPort,
  type InventoryScenario,
  type InventorySectionSummary,
  type InventorySelectionOutcome,
  type InventorySummaryOutcome,
  type InventoryUnit,
} from "@kix/protocol-adapter";
import { formatWhen } from "./format";
import { protocol } from "./connectivity/desk-protocol";

export const INVENTORY_TITLE = "Seats and GA (synthetic)";

export const INVENTORY_SOURCE_LINE =
  "Rows come from a synthetic inventory projection on this page load. They are not a producer read and not a catalogue receipt.";

export const INVENTORY_BOUNDARY =
  "A free label is an observation. It is not a hold, not a sale, and not an approval from the economic writer. Trade commands re-check on their own path.";

export const INVENTORY_SELECTION_BOUNDARY =
  "Selected on this screen only. Nothing was reserved, held, sold, or paid, and nothing was sent.";

export const INVENTORY_GA_NOTE = "GA is a quantity in a pool. No seat is assigned and no seat is owned.";

export const INVENTORY_QUEUE_BOUNDARY =
  "Queue admission is access to these pages. It is not a hold, a payment, an issued right, or entry at the door.";

export const INVENTORY_QUEUE_JOIN_NOTE = "No command to join or rejoin a queue is published, so this desk cannot join one.";

export const INVENTORY_PAGE_NOTE = `One bounded page per click, at most ${INVENTORY_PAGE_BOUND} rows. The seat list never arrives as one response. Refresh is explicit and nothing polls.`;

export const INVENTORY_SCOPE_NOTE = `Access scope ${INVENTORY_DESK_SCOPE.tenantId}. The subject string is not an authentication result.`;

export const INVENTORY_HOLD_NOTE = `Reserving a seat is not available here. ${INVENTORY_HOLD_NOT_BOUND.reason} The booking journey re-checks inventory on its own path.`;

export const INVENTORY_ACCESSIBLE_NOTE =
  "Unsupported. The policy is undetermined, so this desk neither offers nor hides these seats.";

export const INVENTORY_ADVANCE_LABEL = "Advance generation";

export type InventoryStage = "summary" | "page" | "selection";

export type InventoryReturnMode = "again" | "page" | "first" | "summary" | "resync";

type Loading = { kind: "loading" };

export type SummaryState = InventorySummaryOutcome | Loading;
export type PageState = InventoryPageOutcome | Loading;
export type SelectionState = InventorySelectionOutcome | Loading;

type AnyOutcome = SummaryState | PageState | SelectionState;

/** The user return action each outcome maps to. Null means the screen offers none. */
export function inventoryReturnMode(stage: InventoryStage, outcome: AnyOutcome): InventoryReturnMode | null {
  const mode = rawReturnMode(outcome);
  if (mode === null || stage !== "summary") {
    return mode;
  }
  return outcome.kind === "tuple-changed" ? "resync" : "again";
}

function rawReturnMode(outcome: AnyOutcome): InventoryReturnMode | null {
  switch (outcome.kind) {
    case "gap":
    case "tenant-mismatch":
    case "tuple-changed":
      return "resync";
    case "stale":
    case "unknown":
    case "hold-stale":
    case "queue-blocked":
      return "again";
    case "cursor-invalid":
      return "first";
    case "invalid-request":
      return outcome.code === "SECTION" ? "summary" : "first";
    case "generation-changed":
    case "mode-mismatch":
      return "summary";
    case "unit-unavailable":
      return "page";
    case "ready":
    case "empty":
    case "unsupported":
    case "not-bound":
    case "loading":
      return null;
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}

export function inventoryReturnLabel(mode: InventoryReturnMode): string {
  switch (mode) {
    case "resync":
      return "Start over";
    case "again":
      return "Read again";
    case "first":
      return "Back to first page";
    case "page":
      return "Back to page";
    case "summary":
      return "Back to summary";
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

export function inventoryStatusLine(outcome: AnyOutcome): { statusLine: string; detailLine: string } {
  switch (outcome.kind) {
    case "loading":
      return { statusLine: "Loading inventory.", detailLine: "" };
    case "ready":
      return { statusLine: "Read ready.", detailLine: "" };
    case "empty":
      return { statusLine: "Nothing to show in this read.", detailLine: "" };
    case "unsupported":
      return { statusLine: "Unsupported mode.", detailLine: outcome.reason };
    case "mode-mismatch":
      return {
        statusLine: `Mode mismatch in ${outcome.sectionId}.`,
        detailLine: `This read expected ${outcome.expected} and the section is ${outcome.actual} now. Nothing was converted between modes.`,
      };
    case "generation-changed":
      return {
        statusLine: "Inventory generation changed.",
        detailLine: `You read generation ${outcome.held} and the inventory now serves generation ${outcome.current}. Nothing was carried over.`,
      };
    case "queue-blocked":
      return { statusLine: `Queue ${outcome.queue.state}. Selection pages are closed.`, detailLine: outcome.queue.note };
    case "cursor-invalid":
      return { statusLine: `Cursor invalid (${outcome.code}).`, detailLine: outcome.detail };
    case "gap":
      return { statusLine: `Gap in the synthetic inventory (${outcome.code}).`, detailLine: outcome.detail };
    case "tenant-mismatch":
      return {
        statusLine: "A unit from another tenant arrived.",
        detailLine: `unit ${outcome.unitId}. tenant ${outcome.tenantId}.`,
      };
    case "stale":
      return {
        statusLine: "Stale inventory watermark.",
        detailLine: `watermark ${formatWhen(outcome.watermark)}. floor ${formatWhen(outcome.floor)}.`,
      };
    case "tuple-changed":
      return {
        statusLine: `Projection tuple changed (${outcome.field}).`,
        detailLine: `expected ${outcome.expected}. actual ${outcome.actual}.`,
      };
    case "not-bound":
      return { statusLine: outcome.reason, detailLine: "" };
    case "invalid-request":
      return { statusLine: `Blocked read (${outcome.code}).`, detailLine: outcome.detail };
    case "unknown":
      return { statusLine: "Unknown read.", detailLine: `${outcome.message} The outcome is not confirmed.` };
    case "unit-unavailable":
      return {
        statusLine: `Not free in the latest read (${outcome.observed}).`,
        detailLine: outcome.changedSincePage
          ? "It changed since the page was read. Nothing was reserved for you."
          : "Nothing was reserved for you.",
      };
    case "hold-stale":
      return {
        statusLine: "The observed hold is stale.",
        detailLine:
          outcome.reason === "expired"
            ? "It has expired. The seat is not shown as free until a later read says so."
            : `It was recorded under generation ${outcome.hold.holdGeneration}, not the current one. The seat is not shown as free.`,
      };
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}

export function modeWord(mode: InventoryMode): string {
  if (mode === "seat") {
    return "SEAT";
  }
  return mode === "ga" ? "GA" : "ACCESSIBLE";
}

export function bandWord(band: "available" | "limited" | "none"): string {
  return `${band.toUpperCase()} (observed band)`;
}

export interface SummarySectionView {
  sectionId: string;
  label: string;
  mode: InventoryMode;
  modeWord: string;
  supported: boolean;
  unsupportedLine: string | null;
  capacityLine: string | null;
  bandLine: string | null;
  noteLine: string;
}

export interface QueueModel {
  state: InventoryQueueView["state"];
  stateLine: string;
  positionLine: string | null;
  deadline: { expiresAt: string; expired: boolean } | null;
  accessLine: string;
  note: string;
}

export interface SummaryModel {
  state: SummaryState["kind"];
  statusLine: string;
  detailLine: string;
  metaLine: string;
  generationBehind: boolean;
  sections: readonly SummarySectionView[];
  queue: QueueModel | null;
  actionLabel: string | null;
}

export function describeQueue(queue: InventoryQueueView): QueueModel {
  const stateLine =
    queue.state === "none"
      ? "Queue: none in front of the selection pages."
      : `Queue: ${queue.state}.`;
  return {
    state: queue.state,
    stateLine,
    positionLine: queue.position === null ? null : `Position ${queue.position} (synthetic).`,
    deadline: queue.admittedUntil === null || queue.expired === null ? null : { expiresAt: queue.admittedUntil, expired: queue.expired },
    accessLine: queue.grantsSelectionAccess ? "Selection pages are open." : "Selection pages are closed.",
    note: queue.note,
  };
}

export function describeSection(section: InventorySectionSummary): SummarySectionView {
  const noteLine =
    section.mode === "ga"
      ? INVENTORY_GA_NOTE
      : section.mode === "seat"
        ? "Each seat is its own unit. A page lists at most " + String(INVENTORY_PAGE_BOUND) + " seats."
        : INVENTORY_ACCESSIBLE_NOTE;
  return {
    sectionId: section.sectionId,
    label: section.label,
    mode: section.mode,
    modeWord: modeWord(section.mode),
    supported: section.supported,
    unsupportedLine: section.unsupportedReason,
    capacityLine:
      section.capacityEstimate === null
        ? null
        : `declared capacity about ${section.capacityEstimate} (synthetic). A label, not remaining stock.`,
    bandLine: section.band === null ? null : bandWord(section.band),
    noteLine,
  };
}

export function buildSummaryModel(input: {
  outcome: SummaryState;
  scenario: InventoryScenario;
  servedGeneration: number;
  heldGeneration: number | null;
}): SummaryModel {
  const { outcome } = input;
  const { statusLine, detailLine } = inventoryStatusLine(outcome);
  const mode = inventoryReturnMode("summary", outcome);
  const generationBehind = input.heldGeneration !== null && input.heldGeneration !== input.servedGeneration;
  const read = input.heldGeneration === null ? "none yet" : String(input.heldGeneration);
  let metaLine = `scenario ${input.scenario}. served generation ${input.servedGeneration}. last summary read generation ${read}.`;
  if (outcome.kind === "ready") {
    metaLine = `${metaLine} watermark ${formatWhen(outcome.watermark)}.`;
  }
  return {
    state: outcome.kind,
    statusLine: outcome.kind === "ready" ? "Summary ready." : statusLine,
    detailLine,
    metaLine,
    generationBehind,
    sections: outcome.kind === "ready" ? outcome.sections.map(describeSection) : [],
    queue: outcome.kind === "ready" || outcome.kind === "empty" ? describeQueue(outcome.queue) : null,
    actionLabel: mode === null ? null : inventoryReturnLabel(mode),
  };
}

export type ObservedKind = "free" | "held" | "hold-expired" | "hold-other-generation" | "taken";

export interface PageRowView {
  unitId: string;
  mode: "seat" | "ga";
  title: string;
  observedKind: ObservedKind | null;
  observedWord: string;
  observedLine: string;
  hold: { expiresAt: string; expired: boolean } | null;
  /** The adapter label the page shows. A later detail read compares against it. */
  seenAs: string;
  capacityLine: string | null;
  noteLine: string | null;
}

export function describeUnit(unit: InventoryUnit): PageRowView {
  if (unit.mode === "ga") {
    return {
      unitId: unit.unitId,
      mode: "ga",
      title: `${unit.poolLabel} pool`,
      observedKind: null,
      observedWord: bandWord(unit.band),
      observedLine: unit.band === "none" ? "No quantity is free in this pool in the latest read." : "A quantity may be free in this pool in the latest read.",
      hold: null,
      seenAs: inventoryUnitLabel(unit),
      capacityLine: `declared capacity about ${unit.capacityEstimate} (synthetic). A label, not remaining stock.`,
      noteLine: INVENTORY_GA_NOTE,
    };
  }
  const base = { unitId: unit.unitId, mode: "seat" as const, title: unit.seatLabel, seenAs: inventoryUnitLabel(unit), capacityLine: null, noteLine: null };
  if (unit.observed === "free") {
    return {
      ...base,
      observedKind: "free",
      observedWord: "FREE (observed)",
      observedLine: "Free in the latest read. This is not a hold and not a sale.",
      hold: null,
    };
  }
  if (unit.observed === "taken") {
    return { ...base, observedKind: "taken", observedWord: "TAKEN (observed)", observedLine: "Taken in the latest read.", hold: null };
  }
  const hold = unit.hold;
  const view = hold === null ? null : { expiresAt: hold.expiresAt, expired: hold.expired };
  if (hold !== null && hold.expired) {
    return {
      ...base,
      observedKind: "hold-expired",
      observedWord: "HOLD EXPIRED (observed)",
      observedLine: "The observed hold has expired. This seat is not shown as free. Read again.",
      hold: view,
    };
  }
  if (hold !== null && !hold.currentGeneration) {
    return {
      ...base,
      observedKind: "hold-other-generation",
      observedWord: "HOLD FROM EARLIER GENERATION (observed)",
      observedLine: `The observed hold was recorded under generation ${hold.holdGeneration}, not the current one. This seat is not shown as free.`,
      hold: view,
    };
  }
  return {
    ...base,
    observedKind: "held",
    observedWord: "HELD (observed)",
    observedLine: "Held by another selection in the latest read.",
    hold: view,
  };
}

export interface PageModel {
  state: PageState["kind"];
  sectionId: string;
  sectionLabel: string;
  mode: InventoryMode | null;
  statusLine: string;
  detailLine: string;
  metaLine: string;
  rows: readonly PageRowView[];
  canNext: boolean;
  freeOnly: boolean;
  queue: QueueModel | null;
  actionLabel: string | null;
}

export function buildPageModel(input: {
  outcome: PageState;
  sectionId: string;
  section: InventorySectionSummary | null;
  freeOnly: boolean;
}): PageModel {
  const { outcome } = input;
  const { statusLine, detailLine } = inventoryStatusLine(outcome);
  const mode = inventoryReturnMode("page", outcome);
  const section = outcome.kind === "ready" || outcome.kind === "empty" ? outcome.section : input.section;
  let metaLine = `filter ${input.freeOnly ? "free only" : "all"}.`;
  let statusOut = statusLine;
  let detailOut = detailLine;
  if (outcome.kind === "ready") {
    metaLine = `${metaLine} generation ${outcome.generation}. watermark ${formatWhen(outcome.watermark)}. scanned ${outcome.scannedCount} of about ${outcome.totalEstimate}.`;
    statusOut = outcome.rows.length === 0 ? "Page ready. No free-observed units in the scanned window." : "Page ready.";
    detailOut = outcome.rows.length === 0 && outcome.nextCursor !== null ? "The next page continues the scan." : "";
  } else if (outcome.kind === "empty") {
    statusOut = "No seats in this section.";
  }
  return {
    state: outcome.kind,
    sectionId: input.sectionId,
    sectionLabel: section?.label ?? input.sectionId,
    mode: section?.mode ?? null,
    statusLine: statusOut,
    detailLine: detailOut,
    metaLine,
    rows: outcome.kind === "ready" ? outcome.rows.map(describeUnit) : [],
    canNext: outcome.kind === "ready" && outcome.nextCursor !== null,
    freeOnly: input.freeOnly,
    queue: outcome.kind === "ready" ? describeQueue(outcome.queue) : outcome.kind === "queue-blocked" ? describeQueue(outcome.queue) : null,
    actionLabel: mode === null ? null : inventoryReturnLabel(mode),
  };
}

export interface SelectionModel {
  state: SelectionState["kind"];
  statusLine: string;
  detailLine: string;
  mode: "seat" | "ga" | null;
  title: string | null;
  observedWord: string | null;
  quantityLine: string | null;
  assignmentLine: string | null;
  hold: { expiresAt: string; expired: boolean } | null;
  changedSincePage: boolean;
  selected: boolean;
  boundaryLine: string | null;
  /** Code of a refused request, so the screen can send focus back to the control that holds it. */
  invalidCode: string | null;
  actionLabel: string | null;
}

export function buildSelectionModel(input: { outcome: SelectionState }): SelectionModel {
  const { outcome } = input;
  const { statusLine, detailLine } = inventoryStatusLine(outcome);
  const mode = inventoryReturnMode("selection", outcome);
  const base: SelectionModel = {
    state: outcome.kind,
    statusLine,
    detailLine,
    mode: null,
    title: null,
    observedWord: null,
    quantityLine: null,
    assignmentLine: null,
    hold: null,
    changedSincePage: false,
    selected: false,
    boundaryLine: null,
    invalidCode: outcome.kind === "invalid-request" ? outcome.code : null,
    actionLabel: mode === null ? null : inventoryReturnLabel(mode),
  };
  if (outcome.kind === "ready") {
    const { selection } = outcome;
    if (selection.mode === "ga") {
      return {
        ...base,
        statusLine: "Selection ready.",
        mode: "ga",
        title: `${selection.unit.poolLabel} pool`,
        observedWord: bandWord(selection.unit.band),
        quantityLine: `Quantity ${selection.quantity}. A count, not a price.`,
        assignmentLine: `No seat assigned. ${INVENTORY_GA_NOTE}`,
        changedSincePage: outcome.changedSincePage,
        selected: true,
        boundaryLine: INVENTORY_SELECTION_BOUNDARY,
      };
    }
    return {
      ...base,
      statusLine: "Selection ready.",
      mode: "seat",
      title: selection.unit.seatLabel,
      observedWord: "FREE (observed)",
      quantityLine: null,
      assignmentLine: null,
      changedSincePage: outcome.changedSincePage,
      selected: true,
      boundaryLine: INVENTORY_SELECTION_BOUNDARY,
    };
  }
  if (outcome.kind === "unit-unavailable") {
    return {
      ...base,
      hold: outcome.hold === null ? null : { expiresAt: outcome.hold.expiresAt, expired: outcome.hold.expired },
      changedSincePage: outcome.changedSincePage,
    };
  }
  if (outcome.kind === "hold-stale") {
    return { ...base, hold: { expiresAt: outcome.hold.expiresAt, expired: outcome.hold.expired } };
  }
  if (outcome.kind === "empty") {
    return { ...base, statusLine: "No unit for this id.", detailLine: "" };
  }
  return base;
}

/**
 * The unit the page may mark as selected. Opening a detail is not a selection:
 * only a ready read selects, so a refused or unfree unit is never marked.
 */
export function selectedUnitFor(model: SelectionModel | null, unitId: string | null): string | null {
  return model !== null && model.selected ? unitId : null;
}

export interface InventoryLocation {
  section?: string;
  unit?: string;
  quantity?: string;
}

interface Snapshot {
  id: number;
  generation: number;
  modes: Readonly<Record<string, InventoryMode>>;
  sections: readonly InventorySectionSummary[];
}

function raiseFloor(current: string | null, watermark: string | null): string | null {
  if (watermark === null || Number.isNaN(Date.parse(watermark))) {
    return current;
  }
  if (current === null || Date.parse(watermark) > Date.parse(current)) {
    return watermark;
  }
  return current;
}

export interface InventoryActions {
  readSummaryAgain(): void;
  nextPage(): void;
  readPageAgain(): void;
  readSelectionAgain(): void;
  setFreeOnly(next: boolean): void;
  setScenario(next: InventoryScenario): void;
  advanceGeneration(): void;
  runReturn(stage: InventoryStage): void;
}

export function useInventoryRead(options: {
  sectionId: string | null;
  unitId: string | null;
  quantity: number | null;
  setLocation(next: InventoryLocation): void;
}): {
  environment: "stub" | "integration-http";
  scenario: InventoryScenario;
  servedGeneration: number;
  summaryModel: SummaryModel;
  pageModel: PageModel | null;
  selectionModel: SelectionModel | null;
  actions: InventoryActions;
} {
  const environment = protocol.describe().environment;
  const portRef = useRef<InventoryReadPort | null>(null);
  if (portRef.current === null) {
    portRef.current = inventoryReadPortFor(environment, { scenario: "clean", generation: INVENTORY_GENERATION });
  }
  const [scenario, setScenarioState] = useState<InventoryScenario>("clean");
  const [servedGeneration, setServedGeneration] = useState<number>(INVENTORY_GENERATION);
  const [epoch, setEpoch] = useState(0);
  const [freeOnly, setFreeOnlyState] = useState(false);
  const [summary, setSummary] = useState<SummaryState>({ kind: "loading" });
  const [page, setPage] = useState<PageState | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const floor = useRef<string | null>(null);
  const summaryTicket = useRef(0);
  const pageTicket = useRef(0);
  const selectionTicket = useRef(0);
  const snapshotCount = useRef(0);
  const sentCursor = useRef<InventoryReadCursor | null>(null);
  const seenRows = useRef<ReadonlyMap<string, string>>(new Map());
  const summaryKey = useRef("");
  const pageKey = useRef("");
  const selectionKey = useRef("");
  const latest = useRef({ sectionId: options.sectionId, unitId: options.unitId, quantity: options.quantity, freeOnly, snapshot });
  latest.current = { sectionId: options.sectionId, unitId: options.unitId, quantity: options.quantity, freeOnly, snapshot };
  const { setLocation } = options;

  const issueSummary = useCallback(() => {
    const port = portRef.current;
    if (!port) {
      return;
    }
    const ticket = ++summaryTicket.current;
    setSummary({ kind: "loading" });
    void port.readSummary({ scope: INVENTORY_DESK_SCOPE, watermarkFloor: floor.current }).then((next) => {
      if (ticket !== summaryTicket.current) {
        return;
      }
      setSummary(next);
      if (next.kind === "ready") {
        floor.current = raiseFloor(floor.current, next.watermark);
        snapshotCount.current += 1;
        setSnapshot({
          id: snapshotCount.current,
          generation: next.generation,
          modes: Object.fromEntries(next.sections.map((section) => [section.sectionId, section.mode])),
          sections: next.sections,
        });
      } else {
        setSnapshot(null);
      }
    });
  }, []);

  const issuePage = useCallback((cursor: InventoryReadCursor | null) => {
    const port = portRef.current;
    const { sectionId, snapshot: held, freeOnly: only } = latest.current;
    if (!port || !held || sectionId === null) {
      return;
    }
    const mode = held.modes[sectionId];
    if (mode === undefined) {
      pageTicket.current += 1;
      setPage({
        kind: "invalid-request",
        code: "SECTION",
        detail: `Section ${sectionId} is not in the summary this page read.`,
      });
      return;
    }
    const ticket = ++pageTicket.current;
    sentCursor.current = cursor;
    setPage({ kind: "loading" });
    void port
      .readPage({
        scope: INVENTORY_DESK_SCOPE,
        sectionId,
        expectedMode: mode,
        heldGeneration: held.generation,
        pageSize: INVENTORY_PAGE_BOUND,
        cursor,
        freeOnly: only,
        watermarkFloor: floor.current,
      })
      .then((next) => {
        if (ticket !== pageTicket.current) {
          return;
        }
        setPage(next);
        if (next.kind === "ready") {
          floor.current = raiseFloor(floor.current, next.watermark);
          seenRows.current = new Map(next.rows.map((row) => [row.unitId, inventoryUnitLabel(row)]));
        }
      });
  }, []);

  const issueSelection = useCallback(() => {
    const port = portRef.current;
    const { sectionId, unitId, quantity, snapshot: held } = latest.current;
    if (!port || !held || sectionId === null || unitId === null) {
      return;
    }
    const mode = held.modes[sectionId];
    if (mode === undefined) {
      selectionTicket.current += 1;
      setSelection({
        kind: "invalid-request",
        code: "SECTION",
        detail: `Section ${sectionId} is not in the summary this page read.`,
      });
      return;
    }
    const ticket = ++selectionTicket.current;
    setSelection({ kind: "loading" });
    void port
      .readSelection({
        scope: INVENTORY_DESK_SCOPE,
        sectionId,
        unitId,
        expectedMode: mode,
        heldGeneration: held.generation,
        quantity,
        seenAs: seenRows.current.get(unitId) ?? null,
        watermarkFloor: floor.current,
      })
      .then((next) => {
        if (ticket !== selectionTicket.current) {
          return;
        }
        setSelection(next);
        if (next.kind === "ready") {
          floor.current = raiseFloor(floor.current, next.selection.unit.watermark);
        }
      });
  }, []);

  useEffect(() => {
    const key = String(epoch);
    if (summaryKey.current === key) {
      return;
    }
    summaryKey.current = key;
    issueSummary();
  }, [epoch, issueSummary]);

  const snapshotId = snapshot === null ? null : snapshot.id;
  const sectionId = options.sectionId;
  const unitId = options.unitId;
  const quantity = options.quantity;

  useEffect(() => {
    if (sectionId === null || snapshotId === null) {
      pageKey.current = "";
      setPage(null);
      return;
    }
    const key = `${snapshotId}:${sectionId}:${String(freeOnly)}`;
    if (pageKey.current === key) {
      return;
    }
    pageKey.current = key;
    issuePage(null);
  }, [snapshotId, sectionId, freeOnly, issuePage]);

  useEffect(() => {
    if (sectionId === null || unitId === null || snapshotId === null) {
      selectionKey.current = "";
      setSelection(null);
      return;
    }
    const key = `${snapshotId}:${sectionId}:${unitId}:${String(quantity)}`;
    if (selectionKey.current === key) {
      return;
    }
    selectionKey.current = key;
    issueSelection();
  }, [snapshotId, sectionId, unitId, quantity, issueSelection]);

  const readSummaryAgain = useCallback(() => issueSummary(), [issueSummary]);

  const nextPage = useCallback(() => {
    if (page === null || page.kind !== "ready" || page.nextCursor === null) {
      return;
    }
    issuePage(page.nextCursor);
  }, [issuePage, page]);

  const readPageAgain = useCallback(() => issuePage(sentCursor.current), [issuePage]);

  const readSelectionAgain = useCallback(() => issueSelection(), [issueSelection]);

  const setFreeOnly = useCallback((next: boolean) => setFreeOnlyState(next), []);

  const setScenario = useCallback(
    (next: InventoryScenario) => {
      portRef.current = inventoryReadPortFor(environment, { scenario: next, generation: servedGeneration });
      floor.current = null;
      setScenarioState(next);
      setEpoch((current) => current + 1);
    },
    [environment, servedGeneration],
  );

  const advanceGeneration = useCallback(() => {
    const next = servedGeneration + 1;
    portRef.current = inventoryReadPortFor(environment, { scenario, generation: next });
    setServedGeneration(next);
  }, [environment, scenario, servedGeneration]);

  const runReturn = useCallback(
    (stage: InventoryStage) => {
      const outcome: AnyOutcome | null = stage === "summary" ? summary : stage === "page" ? page : selection;
      if (outcome === null) {
        return;
      }
      const mode = inventoryReturnMode(stage, outcome);
      const { sectionId: at } = latest.current;
      if (mode === "again") {
        if (stage === "summary") {
          issueSummary();
        } else if (stage === "page") {
          issuePage(sentCursor.current);
        } else {
          issueSelection();
        }
      } else if (mode === "page") {
        setLocation(at === null ? {} : { section: at });
        issuePage(null);
      } else if (mode === "first") {
        issuePage(null);
      } else if (mode === "summary") {
        setLocation({});
        issueSummary();
      } else if (mode === "resync") {
        floor.current = null;
        setLocation({});
        issueSummary();
      }
    },
    [issuePage, issueSelection, issueSummary, page, selection, setLocation, summary],
  );

  const heldSections = snapshot === null ? null : snapshot.sections;
  const section = sectionId === null || heldSections === null ? null : (heldSections.find((item) => item.sectionId === sectionId) ?? null);

  return {
    environment,
    scenario,
    servedGeneration,
    summaryModel: buildSummaryModel({
      outcome: summary,
      scenario,
      servedGeneration,
      heldGeneration: snapshot === null ? null : snapshot.generation,
    }),
    pageModel:
      sectionId === null
        ? null
        : buildPageModel({
            outcome: page ?? { kind: "loading" },
            sectionId,
            section,
            freeOnly,
          }),
    selectionModel: unitId === null || sectionId === null ? null : buildSelectionModel({ outcome: selection ?? { kind: "loading" } }),
    actions: connectedActions({
      readSummaryAgain,
      nextPage,
      readPageAgain,
      readSelectionAgain,
      setFreeOnly,
      setScenario,
      advanceGeneration,
      runReturn,
    }, ["setScenario", "advanceGeneration"]),
  };
}

/** Parses a quantity query value. The port decides whether the number is allowed. */
export function quantityFromParam(raw: string | null): number | null {
  if (raw === null) {
    return null;
  }
  return Number(raw);
}

export const INVENTORY_QUANTITY_HINT = `A whole count from 1 to ${INVENTORY_QUANTITY_BOUND}. A count, not a price.`;
