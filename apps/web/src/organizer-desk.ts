import { messages as sourceCopy } from "./i18n/messages/organizer-desk";
import { sourceMessage } from "./i18n/source-message";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  OrganizerConsole,
  ORGANIZER_COMPOSED,
  ProtocolError,
  type OrganizerCreateInput,
  type OrganizerEventInput,
  type OrganizerInvitationInput,
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
  create_event: sourceCopy.en["set"],
  close_sales: sourceCopy.en["sd0"],
  open_admission: sourceCopy.en["s14t"],
  complete_event: sourceCopy.en["sde"],
  cancel_event: sourceCopy.en["saz"],
  issue_invitation: sourceCopy.en["soy"],
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
  /** Blank or omitted uses the desk default. Never invented. */
  organizer?: string;
  /** Blank or omitted stays off the body. Never defaulted. */
  reservationSeconds?: string;
}

export interface OrganizerSendItemResult {
  status: "RECEIPT" | "REJECTED" | "UNKNOWN" | "NOT_SENT" | "FENCED";
  code: string | null;
  operationId: string | null;
  requestId: string | null;
  correlationId: string | null;
  note: string;
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
    attempt: number;
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
        note: sourceCopy.en["sih"],
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
        note: sourceCopy.en["s1d0"],
      };
    }
    return row;
  });
  return {
    source: snapshot.source,
    path: snapshot.path,
    rows,
    lastConfirmed: found?.lastConfirmed ?? sourceCopy.en["sq8"],
    unconfirmed: found?.unconfirmed ?? sourceCopy.en["s252"],
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
    await this.sendItem(eventId, step, draft);
  }

  async sendItem(eventId: string, step: OrganizerStep, draft: OrganizerDraft): Promise<OrganizerSendItemResult> {
    if (eventId.length === 0) {
      return fencedResult("empty-event-id", sourceCopy.en["sih"]);
    }
    this.retain(eventId);
    const record = this.records.get(eventId);
    if (!record) {
      return fencedResult("empty-event-id", sourceCopy.en["sih"]);
    }
    if (record.pending) {
      return fencedResult("in-flight", sourceCopy.en["snx"]);
    }
    if (record.localHalt || record.console?.state().halted) {
      return fencedResult("halted", sourceCopy.en["saa"]);
    }
    if (!writesOpen(this.path)) {
      return fencedResult("path-not-open", sourceCopy.en["s17d"]);
    }
    const current = record.steps.find((item) => item.step === step);
    if (!current || !stepSendable(record, step, draft)) {
      return fencedResult("already-sent", sourceCopy.en["s2z"]);
    }
    const operationId = organizerOperationId(eventId, record.attempt, step, draft.inventoryId);
    current.phase = "in-flight";
    current.operationId = operationId;
    current.actor = actorFor(step, draft);
    current.note = sourceCopy.en["snx"];
    record.pending = true;
    this.publish();
    try {
      const outcome = await this.dispatch(record, step, operationId, draft);
      this.applyOutcome(record, step, outcome, draft);
      return outcomeResult(outcome, operationId, current.note);
    } catch (error) {
      this.applyThrown(record, step, error);
      return thrownResult(record, step, operationId);
    } finally {
      record.pending = false;
      const stepRecord = record.steps.find((item) => item.step === step);
      if (stepRecord && stepRecord.phase === "in-flight") {
        stepRecord.phase = "not-sent";
        stepRecord.note = sourceCopy.en["s12l"];
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
        detail: sourceCopy.en["sod"],
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
      throw new ProtocolError(sourceCopy.en["s168"]);
    }
    const input = organizerCallInput(record.eventId, step, operationId, draft);
    if (step === "create_event") {
      return record.console.createEvent(input as OrganizerCreateInput);
    }
    if (step === "close_sales") {
      return record.console.closeSales(input as OrganizerEventInput);
    }
    if (step === "open_admission") {
      return record.console.openAdmission(input as OrganizerEventInput);
    }
    if (step === "complete_event") {
      return record.console.completeEvent(input as OrganizerEventInput);
    }
    if (step === "cancel_event") {
      return record.console.cancelEvent(input as OrganizerEventInput);
    }
    return record.console.issueInvitation(input as OrganizerInvitationInput);
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
      current.actor = actorFor(step, draft);
      current.code = null;
      current.requestId = null;
      current.correlationId = null;
      current.receipt = receiptFields(outcome.receipt);
      current.note =
        this.deps.source?.source === "stub-shape"
          ? sourceCopy.en["sdk"]
          : sourceCopy.en["sdj"];
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
      current.note = sourceMessage(sourceCopy.en["p.t4"], { v1: outcome.code });
      return;
    }
    if (outcome.kind === "UNKNOWN") {
      current.phase = "unconfirmed";
      current.actor = outcome.identity.actor;
      current.code = outcome.code;
      current.requestId = outcome.identity.requestId ?? null;
      current.correlationId = outcome.identity.correlationId ?? null;
      current.note = sourceCopy.en["s253"];
      return;
    }
    if (outcome.blockedBy.reason === "already-sent" && step === "issue_invitation") {
      current.phase = record.issued.length > 0 ? "confirmed" : "pending";
      current.note = sourceCopy.en["s30"];
      return;
    }
    current.phase = "pending";
    current.operationId = null;
    current.note = sourceCopy.en["saa"];
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
      current.note = sourceCopy.en["s253"];
      return;
    }
    current.phase = "not-sent";
    current.actor = halted?.identity.actor ?? current.actor;
    current.code = halted?.identity.code ?? null;
    current.requestId = halted?.identity.requestId ?? null;
    current.correlationId = halted?.identity.correlationId ?? null;
    const message = error instanceof Error ? error.message : sourceCopy.en["s21f"];
    current.note = sourceMessage(sourceCopy.en["p.t6"], { v1: message });
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
        attempt: record.attempt,
        pending: record.pending,
        halted: halted(record),
        issuedInventoryIds: [...record.issued],
        rows,
        lastConfirmed: summaryLine(sourceCopy.en["sq7"], lastRow(rows, "confirmed")),
        unconfirmed: summaryLine(sourceCopy.en["s251"], rows.find((row) => row.status === "unconfirmed")),
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
    organizer: "",
    reservationSeconds: "",
  };
}

export function organizerOperationId(
  eventId: string,
  attempt: number,
  step: OrganizerStep,
  inventoryId: string,
): string {
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

function actorFor(step: OrganizerStep, draft: OrganizerDraft): string {
  if (step === "issue_invitation") {
    return organizerId(draft);
  }
  return ORGANIZER_OPERATOR;
}

export function organizerCallInput(
  eventId: string,
  step: OrganizerStep,
  operationId: string,
  draft: OrganizerDraft,
): OrganizerCreateInput | OrganizerEventInput | OrganizerInvitationInput {
  if (step === "create_event") {
    const quota = typedInteger(draft.invitationQuota);
    const seconds = typedInteger(draft.reservationSeconds ?? "");
    const input: OrganizerCreateInput = {
      operationId,
      eventId,
      organizer: organizerId(draft),
      policy: SYNTHETIC_SHOW_POLICY,
      seats: callerSeats(draft.seats),
    };
    if (quota !== undefined) {
      input.invitationQuota = quota;
    }
    if (seconds !== undefined) {
      input.reservationSeconds = seconds;
    }
    return input;
  }
  if (step === "issue_invitation") {
    const input: OrganizerInvitationInput = {
      operationId,
      eventId,
      inventoryId: draft.inventoryId,
      expectedInventoryVersion: callerInteger(draft.expectedInventoryVersion),
      recipient: draft.recipient,
      organizer: organizerId(draft),
    };
    return input;
  }
  return { operationId, eventId };
}

function organizerId(draft: OrganizerDraft): string {
  if (draft.organizer === undefined || draft.organizer.length === 0) {
    return ORGANIZER_DEFAULT_ID;
  }
  return draft.organizer;
}

function fencedResult(code: string, note: string): OrganizerSendItemResult {
  return {
    status: "FENCED",
    code,
    operationId: null,
    requestId: null,
    correlationId: null,
    note,
  };
}

function outcomeResult(
  outcome: OrganizerStepOutcome,
  operationId: string,
  note: string,
): OrganizerSendItemResult {
  if (outcome.kind === "RECEIPT") {
    return {
      status: "RECEIPT",
      code: null,
      operationId,
      requestId: null,
      correlationId: null,
      note,
    };
  }
  if (outcome.kind === "REJECTED" || outcome.kind === "UNKNOWN") {
    return {
      status: outcome.kind,
      code: outcome.code,
      operationId: outcome.identity.operationId,
      requestId: outcome.identity.requestId ?? null,
      correlationId: outcome.identity.correlationId ?? null,
      note,
    };
  }
  return {
    status: "FENCED",
    code: outcome.blockedBy.reason,
    operationId: outcome.identity.operationId,
    requestId: outcome.identity.requestId ?? null,
    correlationId: outcome.identity.correlationId ?? null,
    note,
  };
}

function thrownResult(record: OrganizerRecord, step: OrganizerStep, operationId: string): OrganizerSendItemResult {
  const current = record.steps.find((item) => item.step === step);
  const halted = record.console?.state().halted ?? null;
  if (halted?.kind === "UNKNOWN" && halted.step === step) {
    return {
      status: "UNKNOWN",
      code: halted.identity.code ?? "UNKNOWN",
      operationId: halted.identity.operationId || operationId,
      requestId: halted.identity.requestId ?? null,
      correlationId: halted.identity.correlationId ?? null,
      note: current?.note ?? sourceCopy.en["s253"],
    };
  }
  return {
    status: "NOT_SENT",
    code: halted?.identity.code ?? null,
    operationId: current?.operationId ?? operationId,
    requestId: halted?.identity.requestId ?? null,
    correlationId: halted?.identity.correlationId ?? null,
    note: current?.note ?? sourceCopy.en["s12l"],
  };
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
    return sourceCopy.en["s1d1"];
  }
  if (status === "not-started") {
    return sourceCopy.en["s266"];
  }
  if (status === "blocked") {
    return sourceCopy.en["saa"];
  }
  if (status === "in-flight") {
    return sourceCopy.en["snx"];
  }
  if (status === "unavailable") {
    return sourceCopy.en["s250"];
  }
  return "";
}

function summaryLine(label: string, row: OrganizerRow | undefined): string {
  if (!row || !row.operationId) {
    return sourceMessage(sourceCopy.en["p.t464"], { v1: label });
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
