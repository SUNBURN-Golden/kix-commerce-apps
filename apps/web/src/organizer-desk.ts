import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  OrganizerConsole,
  ORGANIZER_COMPOSED,
  ProtocolError,
  type OrganizerStep,
  type OrganizerStepOutcome,
  type TransportObservation,
} from "@kix/protocol-adapter";
import type { OrganizerInvokerSource, OrganizerSource } from "@kix/protocol-adapter";
import { readDeskAttempt, writeDeskAttempt } from "./desk-attempts";
import { SYNTHETIC_SHOW_POLICY } from "./journey-desk";
import { organizerSource } from "./organizer-source";
import { protocol } from "./protocol";

/**
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 * Page-load organizer console. A reload clears it. The synthetic policy is a
 * fixture, not a policy, and it is not rendered.
 */
export const ORGANIZER_OPERATOR = "operator";
export const ORGANIZER_DEFAULT_ID = "desk-organizer";

const STEP_LABEL: Record<OrganizerStep, string> = {
  create_event: "Create event",
  close_sales: "Close sales",
  open_admission: "Open admission",
  complete_event: "Complete event",
  cancel_event: "Cancel event",
  issue_invitation: "Issue invitation",
};

export type OrganizerRowStatus =
  | "not-started"
  | "ready"
  | "in-flight"
  | "confirmed"
  | "rejected"
  | "unconfirmed"
  | "not-sent"
  | "blocked"
  | "unavailable";

export type OrganizerPathStatus =
  | { kind: "available-stub-shape" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "unavailable"; code: string | null; detail: string };

export interface OrganizerReceiptField {
  key: string;
  value: string;
}

export interface OrganizerDraft {
  seats: string;
  invitationQuota: string;
  inventoryId: string;
  expectedInventoryVersion: string;
  recipient: string;
}

export interface OrganizerRow {
  step: OrganizerStep;
  label: string;
  status: OrganizerRowStatus;
  operationId: string | null;
  actor: string | null;
  code: string | null;
  requestId: string | null;
  correlationId: string | null;
  receipt: OrganizerReceiptField[] | null;
  note: string;
  canSend: boolean;
}

export interface OpenedOrganizerEvent {
  eventId: string;
  lastConfirmed: string;
  unconfirmed: string;
}

export interface OrganizerPanelModel {
  source: OrganizerSource | null;
  path: OrganizerPathStatus;
  rows: OrganizerRow[];
  lastConfirmed: string;
  unconfirmed: string;
  pending: boolean;
  opened: OpenedOrganizerEvent[];
  send: (step: OrganizerStep) => void;
}

export interface OrganizerDeskSnapshot {
  source: OrganizerSource | null;
  path: OrganizerPathStatus;
  template: OrganizerRow[];
  events: Array<{
    eventId: string;
    pending: boolean;
    halted: boolean;
    issuedInventoryIds: string[];
    rows: OrganizerRow[];
    lastConfirmed: string;
    unconfirmed: string;
  }>;
}

export interface OrganizerDeskProtocol {
  describe(): { environment: "stub" | "integration-http" };
  observeTransport(): Promise<TransportObservation>;
}

export interface OrganizerDeskDeps {
  protocol: OrganizerDeskProtocol;
  source: OrganizerInvokerSource | null;
}

type StepPhase = "pending" | "in-flight" | "confirmed" | "rejected" | "unconfirmed" | "not-sent";

interface StepRecord {
  step: OrganizerStep;
  phase: StepPhase;
  operationId: string | null;
  actor: string | null;
  code: string | null;
  requestId: string | null;
  correlationId: string | null;
  receipt: OrganizerReceiptField[] | null;
  note: string;
}

interface OrganizerRecord {
  eventId: string;
  attempt: number;
  pending: boolean;
  localHalt: boolean;
  console: OrganizerConsole | null;
  steps: StepRecord[];
  issued: string[];
}

export function organizerPathStatus(
  environment: "stub" | "integration-http",
  observation: TransportObservation | null,
): OrganizerPathStatus {
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

export function selectOrganizerView(
  snapshot: OrganizerDeskSnapshot,
  eventId: string,
  draft: OrganizerDraft,
  send: (step: OrganizerStep) => void,
): OrganizerPanelModel {
  const found = eventId.length > 0 ? snapshot.events.find((item) => item.eventId === eventId) : undefined;
  const rows = (found?.rows ?? snapshot.template).map((row) => {
    if (eventId.length === 0) {
      if (row.status !== "ready") {
        return { ...row, canSend: false };
      }
      return {
        ...row,
        status: "not-started" as const,
        canSend: false,
        note: "Enter an event id. The desk does not mint one.",
      };
    }
    if (
      found &&
      !found.halted &&
      !found.pending &&
      writesOpen(snapshot.path) &&
      row.step === "issue_invitation" &&
      row.status === "confirmed" &&
      draft.inventoryId.length > 0 &&
      !found.issuedInventoryIds.includes(draft.inventoryId)
    ) {
      return {
        ...row,
        canSend: true,
        note: "Ready to send another inventory id. One attempt each.",
      };
    }
    return row;
  });
  return {
    source: snapshot.source,
    path: snapshot.path,
    rows,
    lastConfirmed: found?.lastConfirmed ?? "Last confirmed receipt: none",
    unconfirmed: found?.unconfirmed ?? "Unconfirmed request: none",
    pending: found?.pending ?? false,
    opened: snapshot.events.map((item) => ({
      eventId: item.eventId,
      lastConfirmed: item.lastConfirmed,
      unconfirmed: item.unconfirmed,
    })),
    send,
  };
}

export class OrganizerDesk {
  private readonly environment: "stub" | "integration-http";
  private readonly records = new Map<string, OrganizerRecord>();
  private readonly listeners = new Set<() => void>();
  private path: OrganizerPathStatus;
  private snapshot: OrganizerDeskSnapshot;
  private probePromise: Promise<void> | null = null;

  constructor(private readonly deps: OrganizerDeskDeps) {
    this.environment = deps.protocol.describe().environment;
    this.path = organizerPathStatus(this.environment, null);
    this.snapshot = this.buildSnapshot();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): OrganizerDeskSnapshot => this.snapshot;

  reset(): void {
    this.records.clear();
    this.probePromise = null;
    this.path = organizerPathStatus(this.environment, null);
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
    const attempt = readDeskAttempt("organizer", eventId) + 1;
    writeDeskAttempt("organizer", eventId, attempt);
    const record: OrganizerRecord = {
      eventId,
      attempt,
      pending: false,
      localHalt: false,
      console: this.deps.source ? new OrganizerConsole(this.deps.source.invoker) : null,
      steps: blankSteps(),
      issued: [],
    };
    this.records.set(eventId, record);
    this.publish();
  }

  async send(eventId: string, step: OrganizerStep, draft: OrganizerDraft): Promise<void> {
    if (eventId.length === 0) {
      return;
    }
    this.retain(eventId);
    const record = this.records.get(eventId);
    if (!record || record.pending || record.localHalt || record.console?.state().halted) {
      return;
    }
    if (!writesOpen(this.path)) {
      return;
    }
    const current = record.steps.find((item) => item.step === step);
    if (!current || !stepSendable(record, step, draft)) {
      return;
    }
    const operationId = organizerOperationId(eventId, record.attempt, step, draft.inventoryId);
    current.phase = "in-flight";
    current.operationId = operationId;
    current.actor = actorFor(step);
    current.note = "In flight. One attempt.";
    record.pending = true;
    this.publish();
    try {
      const outcome = await this.dispatch(record, step, operationId, draft);
      this.applyOutcome(record, step, outcome, draft);
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

  view(eventId: string, draft: OrganizerDraft = emptyDraft()): OrganizerPanelModel {
    return selectOrganizerView(this.snapshot, eventId, draft, (step) => {
      void this.send(eventId, step, draft);
    });
  }

  private async readProbe(): Promise<void> {
    try {
      const observation = await this.deps.protocol.observeTransport();
      this.path = organizerPathStatus(this.environment, observation);
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

  private async dispatch(
    record: OrganizerRecord,
    step: OrganizerStep,
    operationId: string,
    draft: OrganizerDraft,
  ): Promise<OrganizerStepOutcome> {
    if (this.deps.source === null || record.console === null) {
      throw new ProtocolError("Organizer invoker is not selected.");
    }
    if (step === "create_event") {
      const quota = typedInteger(draft.invitationQuota);
      return record.console.createEvent({
        operationId,
        eventId: record.eventId,
        organizer: ORGANIZER_DEFAULT_ID,
        policy: SYNTHETIC_SHOW_POLICY,
        seats: callerSeats(draft.seats),
        ...(quota === undefined ? {} : { invitationQuota: quota }),
      });
    }
    if (step === "close_sales") {
      return record.console.closeSales({ operationId, eventId: record.eventId });
    }
    if (step === "open_admission") {
      return record.console.openAdmission({ operationId, eventId: record.eventId });
    }
    if (step === "complete_event") {
      return record.console.completeEvent({ operationId, eventId: record.eventId });
    }
    if (step === "cancel_event") {
      return record.console.cancelEvent({ operationId, eventId: record.eventId });
    }
    return record.console.issueInvitation({
      operationId,
      eventId: record.eventId,
      inventoryId: draft.inventoryId,
      expectedInventoryVersion: callerInteger(draft.expectedInventoryVersion),
      recipient: draft.recipient,
      organizer: ORGANIZER_DEFAULT_ID,
    });
  }

  private applyOutcome(
    record: OrganizerRecord,
    step: OrganizerStep,
    outcome: OrganizerStepOutcome,
    draft: OrganizerDraft,
  ): void {
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
      if (step === "issue_invitation" && draft.inventoryId.length > 0 && !record.issued.includes(draft.inventoryId)) {
        record.issued.push(draft.inventoryId);
      }
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
    if (outcome.blockedBy.reason === "already-sent" && step === "issue_invitation") {
      current.phase = record.issued.length > 0 ? "confirmed" : "pending";
      current.note = "Already sent for this inventory id.";
      return;
    }
    current.phase = "pending";
    current.operationId = null;
    current.note = "Blocked. The next write stays blocked.";
    record.localHalt = true;
  }

  private applyThrown(record: OrganizerRecord, step: OrganizerStep, error: unknown): void {
    const current = record.steps.find((item) => item.step === step);
    const halted = record.console?.state().halted ?? null;
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

  private buildSnapshot(): OrganizerDeskSnapshot {
    const events = [...this.records.values()].map((record) => {
      const rows = deriveRows(record, this.path);
      return {
        eventId: record.eventId,
        pending: record.pending,
        halted: halted(record),
        issuedInventoryIds: [...record.issued],
        rows,
        lastConfirmed: summaryLine("Last confirmed receipt", lastRow(rows, "confirmed")),
        unconfirmed: summaryLine("Unconfirmed request", rows.find((row) => row.status === "unconfirmed")),
      };
    });
    return {
      source: this.deps.source?.source ?? null,
      path: this.path,
      template: deriveRows(blankRecord(), this.path),
      events,
    };
  }
}

function halted(record: OrganizerRecord): boolean {
  return record.localHalt || record.console?.state().halted != null;
}

export function createOrganizerDesk(deps: OrganizerDeskDeps): OrganizerDesk {
  return new OrganizerDesk(deps);
}

export const organizerDesk = new OrganizerDesk({ protocol, source: organizerSource });

export function useOrganizerDesk(eventId: string, draft: OrganizerDraft): OrganizerPanelModel {
  const snapshot = useSyncExternalStore(organizerDesk.subscribe, organizerDesk.getSnapshot, organizerDesk.getSnapshot);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    organizerDesk.retain(eventId);
    void organizerDesk.probe();
  }, [eventId]);
  const send = useCallback(
    (step: OrganizerStep) => {
      void organizerDesk.send(eventId, step, draftRef.current);
    },
    [eventId],
  );
  return selectOrganizerView(snapshot, eventId, draft, send);
}

export function emptyDraft(): OrganizerDraft {
  return {
    seats: "",
    invitationQuota: "",
    inventoryId: "",
    expectedInventoryVersion: "",
    recipient: "",
  };
}

function organizerOperationId(eventId: string, attempt: number, step: OrganizerStep, inventoryId: string): string {
  if (step === "issue_invitation") {
    return `org:${eventId}:${attempt}:${step}:${inventoryId}`;
  }
  return `org:${eventId}:${attempt}:${step}`;
}

function blankSteps(): StepRecord[] {
  return ORGANIZER_COMPOSED.map((step) => ({
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

function blankRecord(): OrganizerRecord {
  return {
    eventId: "",
    attempt: 0,
    pending: false,
    localHalt: false,
    console: null,
    steps: blankSteps(),
    issued: [],
  };
}

function stepSendable(record: OrganizerRecord, step: OrganizerStep, draft: OrganizerDraft): boolean {
  const current = record.steps.find((item) => item.step === step);
  if (!current) {
    return false;
  }
  if (step === "issue_invitation") {
    if (current.phase !== "pending" && current.phase !== "confirmed") {
      return false;
    }
    return !(draft.inventoryId.length > 0 && record.issued.includes(draft.inventoryId));
  }
  return current.phase === "pending";
}

function writesOpen(path: OrganizerPathStatus): boolean {
  return path.kind === "available" || path.kind === "available-stub-shape";
}

function actorFor(step: OrganizerStep): string {
  return step === "issue_invitation" ? ORGANIZER_DEFAULT_ID : ORGANIZER_OPERATOR;
}

function lastRow(rows: OrganizerRow[], status: OrganizerRowStatus): OrganizerRow | undefined {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row?.status === status) {
      return row;
    }
  }
  return undefined;
}

function deriveRows(record: OrganizerRecord, path: OrganizerPathStatus): OrganizerRow[] {
  const open = writesOpen(path);
  const isHalted = halted(record);
  return record.steps.map((step) => {
    let status: OrganizerRowStatus;
    let canSend = false;
    if (step.phase === "in-flight") {
      status = "in-flight";
    } else if (step.phase !== "pending") {
      status = step.phase;
    } else if (!open) {
      status = path.kind === "checking" ? "not-started" : "unavailable";
    } else if (isHalted || record.pending) {
      status = "blocked";
    } else {
      status = "ready";
      canSend = true;
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

function noteFor(status: OrganizerRowStatus): string {
  if (status === "ready") {
    return "Ready to send. One attempt.";
  }
  if (status === "not-started") {
    return "Waiting for an event id.";
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

function summaryLine(label: string, row: OrganizerRow | undefined): string {
  if (!row || !row.operationId) {
    return `${label}: none`;
  }
  return `${label}: ${row.step} · ${row.operationId}`;
}

function receiptFields(receipt: Record<string, unknown>): OrganizerReceiptField[] {
  const result = receipt.result;
  if (!isPlainRecord(result)) {
    return [];
  }
  return Object.keys(result)
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

function callerSeats(raw: string): string[] {
  return raw
    .split(",")
    .map((seat) => seat.trim())
    .filter((seat) => seat.length > 0);
}

/**
 * A blank quota is omitted. Any other string is parsed, and a non-canonical
 * integer becomes NaN so the helper schema rejects it before a request.
 */
function typedInteger(raw: string): number | undefined {
  if (raw.length === 0) {
    return undefined;
  }
  return callerInteger(raw);
}

function callerInteger(raw: string): number {
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) {
    return Number.NaN;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : Number.NaN;
}
