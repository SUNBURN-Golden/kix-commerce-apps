import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  BookingJourney,
  JOURNEY_COMPOSED,
  ProtocolError,
  type JourneyStep,
  type JourneyStepOutcome,
  type TransportObservation,
} from "@kix/protocol-adapter";
import type { JourneyInvokerSource, JourneySource } from "@kix/protocol-adapter";
import { readDeskAttempt, writeDeskAttempt } from "./desk-attempts";
import { journeySource } from "./journey-source";
import { protocol } from "./protocol";

/**
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 * Page-load journey for create_event, prepare_trade, and accept_trade.
 * A reload clears it. The synthetic policy is not rendered.
 */
export const SYNTHETIC_SHOW_POLICY = {
  primaryPrice: 100000,
  resaleCap: 150000,
  primaryFeeBps: 500,
  resaleFeeBps: 300,
  resaleOrganizerBps: 200,
  resaleAllowed: true,
  refundProfile: "FULL_CHAIN_UNWIND_FIXTURE",
};

const ORGANIZER = "desk-organizer";
const BUYER = "desk-buyer";
const SEATS = ["A1"];

const STEP_LABEL: Record<JourneyStep, string> = {
  create_event: "Create event",
  prepare_trade: "Prepare trade",
  accept_trade: "Accept trade",
};

const HIDDEN_RECEIPT_KEYS = new Set([
  "primaryPrice",
  "resaleCap",
  "primaryFeeBps",
  "resaleFeeBps",
  "resaleOrganizerBps",
  "refundProfile",
  "amount",
  "currency",
  "paymentId",
]);

export type JourneyRowStatus =
  | "not-started"
  | "ready"
  | "in-flight"
  | "confirmed"
  | "rejected"
  | "unconfirmed"
  | "not-sent"
  | "blocked"
  | "unavailable";

export type JourneyPathStatus =
  | { kind: "available-stub-shape" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "unavailable"; code: string | null; detail: string };

export interface JourneyReceiptField {
  key: string;
  value: string;
}

export interface JourneyRow {
  step: JourneyStep;
  label: string;
  status: JourneyRowStatus;
  operationId: string | null;
  actor: string | null;
  code: string | null;
  requestId: string | null;
  correlationId: string | null;
  receipt: JourneyReceiptField[] | null;
  note: string;
  canSend: boolean;
}

export interface OpenedJourney {
  eventId: string;
  lastConfirmed: string;
  unconfirmed: string;
}

export interface JourneyPanelModel {
  source: JourneySource | null;
  path: JourneyPathStatus;
  rows: JourneyRow[];
  lastConfirmed: string;
  unconfirmed: string;
  pending: boolean;
  opened: OpenedJourney[];
  send: (step: JourneyStep) => void;
}

export interface JourneyDeskSnapshot {
  source: JourneySource | null;
  path: JourneyPathStatus;
  template: JourneyRow[];
  journeys: Array<{
    eventId: string;
    pending: boolean;
    rows: JourneyRow[];
    lastConfirmed: string;
    unconfirmed: string;
  }>;
}

export interface JourneyDeskProtocol {
  describe(): { environment: "stub" | "integration-http" };
  observeTransport(): Promise<TransportObservation>;
}

export interface JourneyDeskDeps {
  protocol: JourneyDeskProtocol;
  source: JourneyInvokerSource | null;
}

type StepPhase = "pending" | "in-flight" | "confirmed" | "rejected" | "unconfirmed" | "not-sent";

interface StepRecord {
  step: JourneyStep;
  phase: StepPhase;
  operationId: string | null;
  actor: string | null;
  code: string | null;
  requestId: string | null;
  correlationId: string | null;
  receipt: JourneyReceiptField[] | null;
  note: string;
}

interface JourneyRecord {
  eventId: string;
  attempt: number;
  pending: boolean;
  localHalt: boolean;
  journey: BookingJourney | null;
  steps: StepRecord[];
}

export function journeyPathStatus(
  environment: "stub" | "integration-http",
  observation: TransportObservation | null,
): JourneyPathStatus {
  if (environment === "stub") {
    return { kind: "available-stub-shape" };
  }
  if (observation === null) {
    return { kind: "checking" };
  }
  if (observation.state === "up") {
    return { kind: "available" };
  }
  return {
    kind: "unavailable",
    code: observation.code,
    detail: observation.detail,
  };
}

export function selectJourneyView(
  snapshot: JourneyDeskSnapshot,
  eventId: string,
  send: (step: JourneyStep) => void,
): JourneyPanelModel {
  const found = eventId.length > 0 ? snapshot.journeys.find((item) => item.eventId === eventId) : undefined;
  return {
    source: snapshot.source,
    path: snapshot.path,
    rows: found?.rows ?? snapshot.template,
    lastConfirmed: found?.lastConfirmed ?? "Last confirmed receipt: none",
    unconfirmed: found?.unconfirmed ?? "Unconfirmed request: none",
    pending: found?.pending ?? false,
    opened: snapshot.journeys.map((item) => ({
      eventId: item.eventId,
      lastConfirmed: item.lastConfirmed,
      unconfirmed: item.unconfirmed,
    })),
    send,
  };
}

export class JourneyDesk {
  private readonly environment: "stub" | "integration-http";
  private readonly records = new Map<string, JourneyRecord>();
  private readonly listeners = new Set<() => void>();
  private path: JourneyPathStatus;
  private snapshot: JourneyDeskSnapshot;
  private probePromise: Promise<void> | null = null;

  constructor(private readonly deps: JourneyDeskDeps) {
    this.environment = deps.protocol.describe().environment;
    this.path = journeyPathStatus(this.environment, null);
    this.snapshot = this.buildSnapshot();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): JourneyDeskSnapshot => this.snapshot;

  reset(): void {
    this.records.clear();
    this.probePromise = null;
    this.path = journeyPathStatus(this.environment, null);
    this.publish();
  }

  probe(): Promise<void> {
    if (this.probePromise) {
      return this.probePromise;
    }
    this.probePromise = this.readProbe();
    return this.probePromise;
  }

  retain(eventId: string): void {
    if (eventId.length === 0 || this.records.has(eventId)) {
      return;
    }
    const attempt = readDeskAttempt("journey", eventId) + 1;
    writeDeskAttempt("journey", eventId, attempt);
    const record: JourneyRecord = {
      eventId,
      attempt,
      pending: false,
      localHalt: false,
      journey: this.deps.source ? new BookingJourney(this.deps.source.invoker) : null,
      steps: blankSteps(),
    };
    this.records.set(eventId, record);
    this.publish();
  }

  async send(eventId: string, step: JourneyStep): Promise<void> {
    if (eventId.length === 0) {
      return;
    }
    this.retain(eventId);
    const record = this.records.get(eventId);
    if (!record || record.pending || record.localHalt || record.journey?.state().halted) {
      return;
    }
    if (!writesOpen(this.path)) {
      return;
    }
    const current = record.steps.find((item) => item.step === step);
    if (!current || current.phase !== "pending" || nextPending(record) !== step) {
      return;
    }
    const operationId = journeyOperationId(eventId, record.attempt, step);
    current.phase = "in-flight";
    current.operationId = operationId;
    current.actor = actorFor(step);
    current.note = "In flight. One attempt.";
    record.pending = true;
    this.publish();
    try {
      const outcome = await this.dispatch(record, step, operationId);
      this.applyOutcome(record, step, outcome);
    } catch (error) {
      this.applyThrown(record, step, error);
    } finally {
      record.pending = false;
      const stepRecord = record.steps.find((item) => item.step === step);
      if (stepRecord && stepRecord.phase === "in-flight") {
        stepRecord.phase = "not-sent";
        stepRecord.note = "Not sent.";
        record.localHalt = true;
      }
      this.publish();
    }
  }

  view(eventId: string): JourneyPanelModel {
    return selectJourneyView(this.snapshot, eventId, (step) => {
      void this.send(eventId, step);
    });
  }

  private async readProbe(): Promise<void> {
    try {
      const observation = await this.deps.protocol.observeTransport();
      this.path = journeyPathStatus(this.environment, observation);
    } catch (error) {
      const code = error instanceof ProtocolError && error.code ? error.code : "GATE_UNAVAILABLE";
      this.path = {
        kind: "unavailable",
        code,
        detail: "Integration HTTP stayed selected. The desk did not fall back to the stub.",
      };
    }
    this.publish();
  }

  private async dispatch(record: JourneyRecord, step: JourneyStep, operationId: string): Promise<JourneyStepOutcome> {
    if (this.deps.source === null || record.journey === null) {
      throw new ProtocolError("Journey invoker is not selected.");
    }
    if (step === "create_event") {
      return record.journey.createEvent({
        operationId,
        eventId: record.eventId,
        organizer: ORGANIZER,
        policy: SYNTHETIC_SHOW_POLICY,
        seats: SEATS,
      });
    }
    if (step === "prepare_trade") {
      return record.journey.prepareTrade({
        operationId,
        tradeId: `trd_${record.eventId}`,
        buyer: BUYER,
      });
    }
    return record.journey.acceptTrade({ operationId });
  }

  private applyOutcome(record: JourneyRecord, step: JourneyStep, outcome: JourneyStepOutcome): void {
    const current = record.steps.find((item) => item.step === step);
    if (!current) {
      return;
    }
    if (outcome.kind === "RECEIPT") {
      current.phase = "confirmed";
      current.actor = actorFor(step);
      current.code = null;
      current.requestId = null;
      current.correlationId = null;
      current.receipt = receiptFields(outcome.receipt);
      current.note =
        this.deps.source?.source === "stub-shape"
          ? "Confirmed stub-shape receipt. Not from the gate."
          : "Confirmed receipt.";
      return;
    }
    if (outcome.kind === "REJECTED") {
      current.phase = "rejected";
      current.actor = outcome.identity.actor;
      current.code = outcome.code;
      current.requestId = outcome.identity.requestId ?? null;
      current.correlationId = outcome.identity.correlationId ?? null;
      current.note = `Rejected by the gate (${outcome.code}).`;
      return;
    }
    if (outcome.kind === "UNKNOWN") {
      current.phase = "unconfirmed";
      current.actor = outcome.identity.actor;
      current.code = outcome.code;
      current.requestId = outcome.identity.requestId ?? null;
      current.correlationId = outcome.identity.correlationId ?? null;
      current.note = "Unconfirmed: sent, no authoritative receipt. May have applied. Not a rejection.";
      return;
    }
    current.phase = "pending";
    current.operationId = null;
    current.note = "Blocked. The next write stays blocked.";
    record.localHalt = true;
  }

  private applyThrown(record: JourneyRecord, step: JourneyStep, error: unknown): void {
    const current = record.steps.find((item) => item.step === step);
    const halted = record.journey?.state().halted ?? null;
    if (!current) {
      record.localHalt = true;
      return;
    }
    if (halted?.kind === "UNKNOWN" && halted.step === step) {
      current.phase = "unconfirmed";
      current.actor = halted.identity.actor;
      current.code = halted.identity.code ?? "UNKNOWN";
      current.requestId = halted.identity.requestId ?? null;
      current.correlationId = halted.identity.correlationId ?? null;
      current.note = "Unconfirmed: sent, no authoritative receipt. May have applied. Not a rejection.";
      return;
    }
    current.phase = "not-sent";
    current.actor = halted?.identity.actor ?? current.actor;
    current.code = halted?.identity.code ?? null;
    current.requestId = halted?.identity.requestId ?? null;
    current.correlationId = halted?.identity.correlationId ?? null;
    const message = error instanceof Error ? error.message : "The step was not sent.";
    current.note = `Not sent. ${message}`;
    record.localHalt = halted === null;
  }

  private publish(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) {
      listener();
    }
  }

  private buildSnapshot(): JourneyDeskSnapshot {
    const journeys = [...this.records.values()].map((record) => {
      const rows = deriveRows(record.steps, this.path, halted(record), record.pending);
      return {
        eventId: record.eventId,
        pending: record.pending,
        rows,
        lastConfirmed: summaryLine("Last confirmed receipt", lastRow(rows, "confirmed")),
        unconfirmed: summaryLine("Unconfirmed request", rows.find((row) => row.status === "unconfirmed")),
      };
    });
    return {
      source: this.deps.source?.source ?? null,
      path: this.path,
      template: deriveRows(blankSteps(), this.path, false, false),
      journeys,
    };
  }
}

function halted(record: JourneyRecord): boolean {
  return record.localHalt || record.journey?.state().halted != null;
}

export function createJourneyDesk(deps: JourneyDeskDeps): JourneyDesk {
  return new JourneyDesk(deps);
}

export const journeyDesk = new JourneyDesk({ protocol, source: journeySource });

export function useJourneyDesk(eventId: string): JourneyPanelModel {
  const snapshot = useSyncExternalStore(journeyDesk.subscribe, journeyDesk.getSnapshot, journeyDesk.getSnapshot);
  useEffect(() => {
    journeyDesk.retain(eventId);
    void journeyDesk.probe();
  }, [eventId]);
  const send = useCallback(
    (step: JourneyStep) => {
      void journeyDesk.send(eventId, step);
    },
    [eventId],
  );
  return selectJourneyView(snapshot, eventId, send);
}

function journeyOperationId(eventId: string, attempt: number, step: JourneyStep): string {
  return `jrn:${eventId}:${attempt}:${step}`;
}

function blankSteps(): StepRecord[] {
  return JOURNEY_COMPOSED.map((step) => ({
    step,
    phase: "pending",
    operationId: null,
    actor: null,
    code: null,
    requestId: null,
    correlationId: null,
    receipt: null,
    note: "",
  }));
}

function nextPending(record: JourneyRecord): JourneyStep | null {
  const found = record.steps.find((item) => item.phase === "pending");
  return found?.step ?? null;
}

function writesOpen(path: JourneyPathStatus): boolean {
  return path.kind === "available" || path.kind === "available-stub-shape";
}

function actorFor(step: JourneyStep): string {
  return step === "create_event" ? "operator" : BUYER;
}

function lastRow(rows: JourneyRow[], status: JourneyRowStatus): JourneyRow | undefined {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row?.status === status) {
      return row;
    }
  }
  return undefined;
}

function deriveRows(steps: StepRecord[], path: JourneyPathStatus, isHalted: boolean, pending: boolean): JourneyRow[] {
  const open = writesOpen(path);
  let armed = false;
  return steps.map((step) => {
    let status: JourneyRowStatus;
    let canSend = false;
    if (step.phase === "in-flight") {
      status = "in-flight";
    } else if (step.phase !== "pending") {
      status = step.phase;
    } else if (!open) {
      status = path.kind === "checking" ? "not-started" : "unavailable";
    } else if (isHalted || pending) {
      status = "blocked";
    } else if (!armed) {
      status = "ready";
      canSend = true;
      armed = true;
    } else {
      status = "not-started";
    }
    return {
      step: step.step,
      label: STEP_LABEL[step.step],
      status,
      operationId: step.operationId,
      actor: step.actor,
      code: step.code,
      requestId: step.requestId,
      correlationId: step.correlationId,
      receipt: step.receipt ? step.receipt.map((field) => ({ ...field })) : null,
      note: step.note.length > 0 ? step.note : noteFor(status),
      canSend,
    };
  });
}

function noteFor(status: JourneyRowStatus): string {
  if (status === "ready") {
    return "Ready to send. One attempt.";
  }
  if (status === "not-started") {
    return "Waiting for the previous step.";
  }
  if (status === "blocked") {
    return "Blocked. The next write stays blocked.";
  }
  if (status === "in-flight") {
    return "In flight. One attempt.";
  }
  if (status === "unavailable") {
    return "Unavailable. No write is sent.";
  }
  return "";
}

function summaryLine(label: string, row: JourneyRow | undefined): string {
  if (!row || !row.operationId) {
    return `${label}: none`;
  }
  return `${label}: ${row.step} · ${row.operationId}`;
}

function receiptFields(receipt: Record<string, unknown>): JourneyReceiptField[] {
  const result = receipt.result;
  if (!isPlainRecord(result)) {
    return [];
  }
  return Object.keys(result)
    .filter((key) => !HIDDEN_RECEIPT_KEYS.has(key))
    .sort()
    .map((key) => ({ key, value: formatReceiptValue(result[key]) }));
}

function formatReceiptValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
