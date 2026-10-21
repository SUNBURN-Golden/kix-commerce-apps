import { messages as sourceCopy } from "./i18n/messages/inventory-venue";
import { sourceMessage } from "./i18n/source-message";
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
import { protocol } from "./protocol";

export const INVENTORY_TITLE = sourceCopy.en["s1is"];

export const INVENTORY_SOURCE_LINE =
  sourceCopy.en["s1hu"];

export const INVENTORY_BOUNDARY =
  sourceCopy.en["s22"];

export const INVENTORY_SELECTION_BOUNDARY =
  sourceCopy.en["s1iv"];

export const INVENTORY_GA_NOTE = sourceCopy.en["smb"];

export const INVENTORY_QUEUE_BOUNDARY =
  sourceCopy.en["s1at"];

export const INVENTORY_QUEUE_JOIN_NOTE = sourceCopy.en["sur"];

export const INVENTORY_PAGE_NOTE = sourceMessage(sourceCopy.en["p.t219"], { v1: INVENTORY_PAGE_BOUND });

export const INVENTORY_SCOPE_NOTE = sourceMessage(sourceCopy.en["p.t136"], { v1: INVENTORY_DESK_SCOPE.tenantId });

export const INVENTORY_HOLD_NOTE = sourceMessage(sourceCopy.en["p.t220"], { v1: INVENTORY_HOLD_NOT_BOUND.reason });

export const INVENTORY_ACCESSIBLE_NOTE =
  sourceCopy.en["s25p"];

export const INVENTORY_ADVANCE_LABEL = sourceCopy.en["s1t"];

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
      return sourceCopy.en["s1me"];
    case "again":
      return sourceCopy.en["s1ax"];
    case "first":
      return sourceCopy.en["s9h"];
    case "page":
      return sourceCopy.en["s9i"];
    case "summary":
      return sourceCopy.en["s9k"];
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

export function inventoryStatusLine(outcome: AnyOutcome): { statusLine: string; detailLine: string } {
  switch (outcome.kind) {
    case "loading":
      return { statusLine: sourceCopy.en["srd"], detailLine: "" };
    case "ready":
      return { statusLine: sourceCopy.en["s1c3"], detailLine: "" };
    case "empty":
      return { statusLine: sourceCopy.en["s11h"], detailLine: "" };
    case "unsupported":
      return { statusLine: sourceCopy.en["s25o"], detailLine: outcome.reason };
    case "mode-mismatch":
      return {
        statusLine: sourceMessage(sourceCopy.en["p.t221"], { v1: outcome.sectionId }),
        detailLine: sourceMessage(sourceCopy.en["p.t222"], { v1: outcome.expected, v2: outcome.actual }),
      };
    case "generation-changed":
      return {
        statusLine: sourceCopy.en["som"],
        detailLine: sourceMessage(sourceCopy.en["p.t223"], { v1: outcome.held, v2: outcome.current }),
      };
    case "queue-blocked":
      return { statusLine: sourceMessage(sourceCopy.en["p.t224"], { v1: outcome.queue.state }), detailLine: outcome.queue.note };
    case "cursor-invalid":
      return { statusLine: sourceMessage(sourceCopy.en["p.t139"], { v1: outcome.code }), detailLine: outcome.detail };
    case "gap":
      return { statusLine: sourceMessage(sourceCopy.en["p.t225"], { v1: outcome.code }), detailLine: outcome.detail };
    case "tenant-mismatch":
      return {
        statusLine: sourceCopy.en["s95"],
        detailLine: sourceMessage(sourceCopy.en["p.t524"], { v1: outcome.unitId, v2: outcome.tenantId }),
      };
    case "stale":
      return {
        statusLine: sourceCopy.en["s1ln"],
        detailLine: sourceMessage(sourceCopy.en["p.t502"], { v1: formatWhen(outcome.watermark), v2: formatWhen(outcome.floor) }),
      };
    case "tuple-changed":
      return {
        statusLine: sourceMessage(sourceCopy.en["p.t140"], { v1: outcome.field }),
        detailLine: sourceMessage(sourceCopy.en["p.t504"], { v1: outcome.expected, v2: outcome.actual }),
      };
    case "not-bound":
      return { statusLine: outcome.reason, detailLine: "" };
    case "invalid-request":
      return { statusLine: sourceMessage(sourceCopy.en["p.t141"], { v1: outcome.code }), detailLine: outcome.detail };
    case "unknown":
      return { statusLine: sourceCopy.en["s25d"], detailLine: sourceMessage(sourceCopy.en["p.t226"], { v1: outcome.message }) };
    case "unit-unavailable":
      return {
        statusLine: sourceMessage(sourceCopy.en["p.t227"], { v1: outcome.observed }),
        detailLine: outcome.changedSincePage
          ? sourceCopy.en["sp1"]
          : sourceCopy.en["s11n"],
      };
    case "hold-stale":
      return {
        statusLine: sourceCopy.en["s1un"],
        detailLine:
          outcome.reason === "expired"
            ? sourceCopy.en["sp3"]
            : sourceMessage(sourceCopy.en["p.t228"], { v1: outcome.hold.holdGeneration }),
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
  return sourceMessage(sourceCopy.en["p.t229"], { v1: band.toUpperCase() });
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
      ? sourceCopy.en["s1au"]
      : sourceMessage(sourceCopy.en["p.t525"], { v1: queue.state });
  return {
    state: queue.state,
    stateLine,
    positionLine: queue.position === null ? null : sourceMessage(sourceCopy.en["p.t526"], { v1: queue.position }),
    deadline: queue.admittedUntil === null || queue.expired === null ? null : { expiresAt: queue.admittedUntil, expired: queue.expired },
    accessLine: queue.grantsSelectionAccess ? sourceCopy.en["s1iz"] : sourceCopy.en["s1iy"],
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
        : sourceMessage(sourceCopy.en["p.t230"], { v1: section.capacityEstimate }),
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
  const read = input.heldGeneration === null ? sourceCopy.en["swe"] : String(input.heldGeneration);
  let metaLine = sourceMessage(sourceCopy.en["p.t231"], { v1: input.scenario, v2: input.servedGeneration, v3: read });
  if (outcome.kind === "ready") {
    metaLine = sourceMessage(sourceCopy.en["p.t527"], { v1: metaLine, v2: formatWhen(outcome.watermark) });
  }
  return {
    state: outcome.kind,
    statusLine: outcome.kind === "ready" ? sourceCopy.en["s1nf"] : statusLine,
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
      title: sourceMessage(sourceCopy.en["p.t528"], { v1: unit.poolLabel }),
      observedKind: null,
      observedWord: bandWord(unit.band),
      observedLine: unit.band === "none" ? sourceCopy.en["sxc"] : sourceCopy.en["s68"],
      hold: null,
      seenAs: inventoryUnitLabel(unit),
      capacityLine: sourceMessage(sourceCopy.en["p.t230"], { v1: unit.capacityEstimate }),
      noteLine: INVENTORY_GA_NOTE,
    };
  }
  const base = { unitId: unit.unitId, mode: "seat" as const, title: unit.seatLabel, seenAs: inventoryUnitLabel(unit), capacityLine: null, noteLine: null };
  if (unit.observed === "free") {
    return {
      ...base,
      observedKind: "free",
      observedWord: sourceCopy.en["sm1"],
      observedLine: sourceCopy.en["sm0"],
      hold: null,
    };
  }
  if (unit.observed === "taken") {
    return { ...base, observedKind: "taken", observedWord: sourceCopy.en["s1pd"], observedLine: sourceCopy.en["s1pc"], hold: null };
  }
  const hold = unit.hold;
  const view = hold === null ? null : { expiresAt: hold.expiresAt, expired: hold.expired };
  if (hold !== null && hold.expired) {
    return {
      ...base,
      observedKind: "hold-expired",
      observedWord: sourceCopy.en["snf"],
      observedLine: sourceCopy.en["s1um"],
      hold: view,
    };
  }
  if (hold !== null && !hold.currentGeneration) {
    return {
      ...base,
      observedKind: "hold-other-generation",
      observedWord: sourceCopy.en["snh"],
      observedLine: sourceMessage(sourceCopy.en["p.t232"], { v1: hold.holdGeneration }),
      hold: view,
    };
  }
  return {
    ...base,
    observedKind: "held",
    observedWord: sourceCopy.en["snd"],
    observedLine: sourceCopy.en["sna"],
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
  let metaLine = sourceMessage(sourceCopy.en["p.t529"], { v1: input.freeOnly ? "free only" : "all" });
  let statusOut = statusLine;
  let detailOut = detailLine;
  if (outcome.kind === "ready") {
    metaLine = sourceMessage(sourceCopy.en["p.t233"], { v1: metaLine, v2: outcome.generation, v3: formatWhen(outcome.watermark), v4: outcome.scannedCount, v5: outcome.totalEstimate });
    statusOut = outcome.rows.length === 0 ? sourceCopy.en["s16y"] : sourceCopy.en["s16x"];
    detailOut = outcome.rows.length === 0 && outcome.nextCursor !== null ? sourceCopy.en["s1uh"] : "";
  } else if (outcome.kind === "empty") {
    statusOut = sourceCopy.en["syf"];
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
        statusLine: sourceCopy.en["s1j0"],
        mode: "ga",
        title: sourceMessage(sourceCopy.en["p.t528"], { v1: selection.unit.poolLabel }),
        observedWord: bandWord(selection.unit.band),
        quantityLine: sourceMessage(sourceCopy.en["p.t530"], { v1: selection.quantity }),
        assignmentLine: sourceMessage(sourceCopy.en["p.t234"], { v1: INVENTORY_GA_NOTE }),
        changedSincePage: outcome.changedSincePage,
        selected: true,
        boundaryLine: INVENTORY_SELECTION_BOUNDARY,
      };
    }
    return {
      ...base,
      statusLine: sourceCopy.en["s1j0"],
      mode: "seat",
      title: selection.unit.seatLabel,
      observedWord: sourceCopy.en["sm1"],
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
    return { ...base, statusLine: sourceCopy.en["s12y"], detailLine: "" };
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
        detail: sourceMessage(sourceCopy.en["p.t235"], { v1: sectionId }),
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
        detail: sourceMessage(sourceCopy.en["p.t235"], { v1: sectionId }),
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
    actions: {
      readSummaryAgain,
      nextPage,
      readPageAgain,
      readSelectionAgain,
      setFreeOnly,
      setScenario,
      advanceGeneration,
      runReturn,
    },
  };
}

/** Parses a quantity query value. The port decides whether the number is allowed. */
export function quantityFromParam(raw: string | null): number | null {
  if (raw === null) {
    return null;
  }
  return Number(raw);
}

export const INVENTORY_QUANTITY_HINT = sourceMessage(sourceCopy.en["p.t236"], { v1: INVENTORY_QUANTITY_BOUND });
