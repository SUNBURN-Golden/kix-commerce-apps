import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { COMMERCE_COMMAND_BINDINGS, JOURNEY_NOT_COMPOSED, type Performance } from "@kix/protocol-adapter";
import { giftDesk, type GiftDeskSnapshot, type GiftRowStatus } from "./gift-desk";
import { journeyDesk, type JourneyDeskSnapshot, type JourneyRowStatus } from "./journey-desk";
import { protocol } from "./protocol";
import { useResaleDesk } from "./resale-desk";
import { useReservationDesk } from "./reservation-desk";
import { PLACE_HOLD_RECORD, WORKSPACE_RULING, type OutcomeTrack, type TrackState } from "./workspace/registry";

/**
 * Read-only buyer workspace over receipts already on this page load.
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 * A reload clears page-load state. This module posts nothing.
 */

export const BUYER_RULING = WORKSPACE_RULING;

export const BUYER_STUB_SENTENCE = "Stub-shape receipts are not from the gate.";

export const BUYER_RELOAD_NOTE = "A reload clears page-load state and re-sends nothing.";

export type BuyerSource = "stub-shape" | "integration-gate" | "mock-case" | "none";

export type BuyerStage = "selection" | "reservation" | "order" | "issuance";

export type CatalogState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "not-bound"; reason: string }
  | { kind: "ready"; performances: Performance[] };

export interface BuyerReturnAction {
  label: string;
  to?: string;
  readAgain?: boolean;
}

export interface BuyerProgressRow {
  label: string;
  stage: BuyerStage;
  track: OutcomeTrack | null;
  state: TrackState;
  reason: string | null;
  source: BuyerSource;
  returnAction: BuyerReturnAction | null;
}

export interface BuyerEvidenceRow {
  kind: "journey-receipt" | "gift-receipt" | "mock-right";
  operationId: string | null;
  refId: string;
  step: string;
  status: string;
  source: BuyerSource;
  deskRoute: string;
}

export interface BuyerReservationFacts {
  reservationId: string;
  eventId: string;
  phase: string;
  expired: boolean;
  expiresAt: string;
  issueStatus: string;
  lastRejectCode: string | null;
}

export interface BuyerResaleFacts {
  rightId: string;
  eventId: string;
  eligibility: string;
  salePhase: string | null;
  lastRejectCode: string | null;
}

export interface BuyerWorkspaceInput {
  environment: "stub" | "integration-http";
  catalog: CatalogState;
  selectedEventId: string | null;
  journey: JourneyDeskSnapshot;
  gift: GiftDeskSnapshot;
  reservation: BuyerReservationFacts | null;
  reservationError: string | null;
  resaleRight: BuyerResaleFacts | null;
  resaleError: string | null;
}

export interface BuyerRecordedAction {
  action: string;
  reason: string;
}

export interface BuyerWorkspaceModel {
  environment: "stub" | "integration-http";
  ruling: string;
  stubSentence: string;
  reloadNote: string;
  catalog: CatalogState;
  catalogSource: BuyerSource;
  catalogAction: BuyerReturnAction | null;
  selectedEventId: string | null;
  progress: BuyerProgressRow[];
  evidence: BuyerEvidenceRow[];
  confirmedSummaries: string[];
  recorded: BuyerRecordedAction[];
}

export interface BuyerCatalogReader {
  listPerformances(): Promise<Performance[]>;
}

type DeskStatus = JourneyRowStatus | GiftRowStatus;

interface DeskStep {
  step: string;
  status: DeskStatus;
  operationId: string | null;
  code: string | null;
  note: string;
  receipt: readonly unknown[] | null;
}

export function notBoundReason(message: string): string | null {
  const match = /^([A-Za-z][A-Za-z0-9]*) is not-bound\./.exec(message);
  const method = match?.[1];
  if (method === undefined || !(method in COMMERCE_COMMAND_BINDINGS)) {
    return null;
  }
  return COMMERCE_COMMAND_BINDINGS[method as keyof typeof COMMERCE_COMMAND_BINDINGS].reason;
}

export async function loadBuyerCatalog(reader: BuyerCatalogReader): Promise<CatalogState> {
  try {
    const performances = await reader.listPerformances();
    if (performances.length === 0) {
      return { kind: "empty" };
    }
    return { kind: "ready", performances };
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Could not load performances.";
    const locked = notBoundReason(message);
    if (locked !== null) {
      return { kind: "not-bound", reason: locked };
    }
    return { kind: "error", message };
  }
}

export function buildBuyerWorkspace(input: BuyerWorkspaceInput): BuyerWorkspaceModel {
  const selected = input.selectedEventId ?? "";
  const catalogSource: BuyerSource = input.environment === "stub" ? "stub-shape" : "integration-gate";
  const catalogAction = actionForCatalog(input.catalog);
  const journeys = visibleJourneys(input.journey, selected);
  const progress: BuyerProgressRow[] = [
    selectionRow(input.catalog, selected, catalogSource, null),
    holdRow(selected),
  ];

  for (const journey of journeys) {
    for (const row of journey.rows) {
      progress.push(journeyProgress(journey.eventId, row, sourceFromDesk(input.journey.source)));
    }
  }

  progress.push(paymentRow(selected));

  if (input.reservation) {
    progress.push(reservationRow(input.reservation, input.reservationError));
  } else if (input.reservationError) {
    progress.push(readErrorRow("Reservation case", "reservation", "reservation", input.reservationError, selected));
  }

  progress.push(ticketReadRow());

  for (const gift of input.gift.gifts) {
    for (const row of gift.rows) {
      if (row.operationId === null) {
        continue;
      }
      progress.push(giftProgress(row, sourceFromDesk(input.gift.source)));
    }
  }

  if (input.resaleRight) {
    progress.push(resaleProgress(input.resaleRight));
  } else if (input.resaleError) {
    progress.push(readErrorRow("Resale right", "issuance", "issuance", input.resaleError, selected));
  }

  if (input.journey.path.kind === "unavailable") {
    progress.push(unavailableRow("Journey path", input.journey.path.code, sourceFromDesk(input.journey.source)));
  }
  if (input.gift.path.kind === "unavailable") {
    progress.push(unavailableRow("Gift path", input.gift.path.code, sourceFromDesk(input.gift.source)));
  }

  return {
    environment: input.environment,
    ruling: BUYER_RULING,
    stubSentence: BUYER_STUB_SENTENCE,
    reloadNote: BUYER_RELOAD_NOTE,
    catalog: input.catalog,
    catalogSource,
    catalogAction,
    selectedEventId: selected.length > 0 ? selected : null,
    progress,
    evidence: evidenceRows(input),
    confirmedSummaries: confirmedSummaries(journeys),
    recorded: JOURNEY_NOT_COMPOSED.map((entry) => ({ action: entry.action, reason: entry.reason })),
  };
}

export function useBuyerWorkspace(eventId: string): { model: BuyerWorkspaceModel; readAgain: () => void } {
  const [catalog, setCatalog] = useState<CatalogState>({ kind: "loading" });
  const generation = useRef(0);
  const readAgain = useCallback(() => {
    const ticket = ++generation.current;
    setCatalog({ kind: "loading" });
    void loadBuyerCatalog(protocol).then((next) => {
      if (ticket === generation.current) {
        setCatalog(next);
      }
    });
  }, []);

  useEffect(() => {
    readAgain();
  }, [readAgain]);

  const journey = useSyncExternalStore(journeyDesk.subscribe, journeyDesk.getSnapshot, journeyDesk.getSnapshot);
  const gift = useSyncExternalStore(giftDesk.subscribe, giftDesk.getSnapshot, giftDesk.getSnapshot);
  const reservation = useReservationDesk(eventId);
  const resale = useResaleDesk(eventId);
  const environment = protocol.describe().environment;
  const model = buildBuyerWorkspace({
    environment,
    catalog,
    selectedEventId: eventId.length > 0 ? eventId : null,
    journey,
    gift,
    reservation: reservation.view
      ? {
          reservationId: reservation.view.reservationId,
          eventId: reservation.view.eventId,
          phase: reservation.view.phase,
          expired: reservation.view.expired,
          expiresAt: reservation.view.expiresAt,
          issueStatus: reservation.view.issueStatus,
          lastRejectCode: reservation.view.lastRejectCode,
        }
      : null,
    reservationError: reservation.error,
    resaleRight: resale.right
      ? {
          rightId: resale.right.rightId,
          eventId: resale.right.eventId,
          eligibility: resale.right.eligibility,
          salePhase: resale.right.salePhase,
          lastRejectCode: resale.right.lastRejectCode,
        }
      : null,
    resaleError: resale.error,
  });
  return { model, readAgain };
}

function actionForCatalog(catalog: CatalogState): BuyerReturnAction | null {
  if (catalog.kind === "loading") {
    return { label: "Back to box office", to: "/" };
  }
  if (catalog.kind === "empty") {
    return { label: "Pick a show", to: "/" };
  }
  if (catalog.kind === "error") {
    return { label: "Read again", readAgain: true };
  }
  if (catalog.kind === "not-bound") {
    return { label: "Open box office", to: "/" };
  }
  return null;
}

function selectionRow(
  catalog: CatalogState,
  selected: string,
  source: BuyerSource,
  action: BuyerReturnAction | null,
): BuyerProgressRow {
  if (catalog.kind === "loading") {
    return row("Selection", "selection", null, "loading", null, "none", action);
  }
  if (catalog.kind === "empty") {
    return row("Selection", "selection", null, "empty", null, "none", action);
  }
  if (catalog.kind === "error") {
    return row("Selection", "selection", null, "error", catalog.message, "none", action);
  }
  if (catalog.kind === "not-bound") {
    return row("Selection", "selection", null, "not-bound", catalog.reason, "none", action);
  }
  return row("Selection", "selection", null, "empty", selected.length > 0 ? selected : null, source, null);
}

function holdRow(selected: string): BuyerProgressRow {
  return row(
    "Hold",
    "reservation",
    "reservation",
    "not-bound",
    `${PLACE_HOLD_RECORD.method} stays ${PLACE_HOLD_RECORD.status}. consideredAction ${PLACE_HOLD_RECORD.consideredAction}. mappedOntoPrepareTrade ${PLACE_HOLD_RECORD.mappedOntoPrepareTrade}. ${PLACE_HOLD_RECORD.reason}`,
    "none",
    bookingReturn(selected),
  );
}

function paymentRow(selected: string): BuyerProgressRow {
  return row(
    "Payment",
    "order",
    "payment",
    "not-bound",
    COMMERCE_COMMAND_BINDINGS.confirmBooking.reason,
    "none",
    bookingReturn(selected),
  );
}

function ticketReadRow(): BuyerProgressRow {
  return row(
    "Ticket read",
    "issuance",
    "issuance",
    "not-bound",
    COMMERCE_COMMAND_BINDINGS.getBooking.reason,
    "none",
    { label: "Buyer workspace", to: "/buyer" },
  );
}

function journeyProgress(eventId: string, step: DeskStep, source: BuyerSource): BuyerProgressRow {
  const placed = stageForJourneyStep(step.step);
  return row(
    step.step,
    placed.stage,
    placed.track,
    mapDeskState(step.status, step.receipt),
    joinReason(step.code, step.note),
    source,
    bookingReturn(eventId),
  );
}

function giftProgress(step: DeskStep, source: BuyerSource): BuyerProgressRow {
  return row(
    step.step,
    "issuance",
    "issuance",
    mapDeskState(step.status, step.receipt),
    joinReason(step.code, step.note),
    source,
    { label: "Open gift", to: "/gift" },
  );
}

function reservationRow(facts: BuyerReservationFacts, error: string | null): BuyerProgressRow {
  const parts = [
    `phase ${facts.phase}`,
    `expiresAt ${facts.expiresAt}`,
    `expired ${facts.expired ? "true" : "false"}`,
    `issueStatus ${facts.issueStatus}`,
    facts.lastRejectCode,
    error,
  ].filter((part): part is string => part !== null && part.length > 0);
  return row(
    "Reservation case",
    "reservation",
    "reservation",
    facts.lastRejectCode ? "rejected" : "empty",
    parts.join("; "),
    "mock-case",
    bookingReturn(facts.eventId),
  );
}

function resaleProgress(facts: BuyerResaleFacts): BuyerProgressRow {
  const parts = [facts.eligibility, facts.salePhase, facts.lastRejectCode].filter(
    (part): part is string => part !== null && part.length > 0,
  );
  return row(
    "Resale right",
    "issuance",
    "issuance",
    facts.lastRejectCode ? "rejected" : "empty",
    parts.join(" "),
    "mock-case",
    { label: "Open resale", to: "/resale" },
  );
}

function readErrorRow(
  label: string,
  stage: BuyerStage,
  track: OutcomeTrack,
  message: string,
  selected: string,
): BuyerProgressRow {
  const locked = notBoundReason(message);
  return row(
    label,
    stage,
    track,
    locked ? "not-bound" : "error",
    locked ?? message,
    locked ? "none" : "mock-case",
    stage === "issuance" ? { label: "Open resale", to: "/resale" } : bookingReturn(selected),
  );
}

function unavailableRow(label: string, code: string | null, source: BuyerSource): BuyerProgressRow {
  return row(label, "order", null, "unavailable", code, source, { label: "Buyer workspace", to: "/buyer" });
}

function evidenceRows(input: BuyerWorkspaceInput): BuyerEvidenceRow[] {
  const found: BuyerEvidenceRow[] = [];
  const journeySource = sourceFromDesk(input.journey.source);
  for (const journey of input.journey.journeys) {
    for (const step of journey.rows) {
      if (step.operationId === null) {
        continue;
      }
      found.push({
        kind: "journey-receipt",
        operationId: step.operationId,
        refId: journey.eventId,
        step: step.step,
        status: step.status,
        source: journeySource,
        deskRoute: bookingPath(journey.eventId),
      });
    }
  }
  const giftSource = sourceFromDesk(input.gift.source);
  for (const gift of input.gift.gifts) {
    for (const step of gift.rows) {
      if (step.operationId === null) {
        continue;
      }
      found.push({
        kind: "gift-receipt",
        operationId: step.operationId,
        refId: gift.giftId,
        step: step.step,
        status: step.status,
        source: giftSource,
        deskRoute: "/gift",
      });
    }
  }
  if (input.resaleRight) {
    found.push({
      kind: "mock-right",
      operationId: null,
      refId: input.resaleRight.rightId,
      step: input.resaleRight.salePhase ?? "none",
      status: input.resaleRight.eligibility,
      source: "mock-case",
      deskRoute: "/resale",
    });
  }
  return found;
}

function confirmedSummaries(journeys: JourneyDeskSnapshot["journeys"]): string[] {
  return journeys.map((journey) => journey.lastConfirmed).filter((line) => !line.endsWith(": none"));
}

function visibleJourneys(snapshot: JourneyDeskSnapshot, selected: string): JourneyDeskSnapshot["journeys"] {
  if (selected.length === 0) {
    return snapshot.journeys;
  }
  return snapshot.journeys.filter((journey) => journey.eventId === selected);
}

function stageForJourneyStep(step: string): { stage: BuyerStage; track: OutcomeTrack | null } {
  if (step === "prepare_trade") {
    return { stage: "reservation", track: "reservation" };
  }
  if (step === "accept_trade") {
    return { stage: "order", track: null };
  }
  return { stage: "selection", track: null };
}

function mapDeskState(status: DeskStatus, receipt: readonly unknown[] | null): TrackState {
  switch (status) {
    case "confirmed":
      return receipt !== null ? "confirmed" : "unknown";
    case "rejected":
      return "rejected";
    case "unconfirmed":
      return "unknown";
    case "not-sent":
      return "not-sent";
    case "blocked":
      return "fenced";
    case "unavailable":
      return "unavailable";
    case "in-flight":
      return "in-flight";
    case "ready":
    case "not-started":
      return "empty";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function sourceFromDesk(source: "stub-shape" | "integration-gate" | null): BuyerSource {
  if (source === "stub-shape" || source === "integration-gate") {
    return source;
  }
  return "none";
}

function bookingReturn(eventId: string): BuyerReturnAction {
  if (eventId.length > 0) {
    return { label: "Open booking", to: bookingPath(eventId) };
  }
  return { label: "Buyer workspace", to: "/buyer" };
}

function bookingPath(eventId: string): string {
  return `/booking/${encodeURIComponent(eventId)}`;
}

function joinReason(code: string | null, note: string): string | null {
  const parts = [code, note].filter((part): part is string => part !== null && part.length > 0);
  return parts.length > 0 ? parts.join(" ") : null;
}

function row(
  label: string,
  stage: BuyerStage,
  track: OutcomeTrack | null,
  state: TrackState,
  reason: string | null,
  source: BuyerSource,
  returnAction: BuyerReturnAction | null,
): BuyerProgressRow {
  return { label, stage, track, state, reason, source, returnAction };
}
