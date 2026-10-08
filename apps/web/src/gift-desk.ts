import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  GiftTransfer,
  GIFT_COMPOSED,
  ProtocolError,
  type GiftStep,
  type GiftStepOutcome,
  type TransportObservation,
} from "@kix/protocol-adapter";
import type { GiftInvokerSource, GiftSource } from "@kix/protocol-adapter";
import { readDeskAttempt, writeDeskAttempt } from "./desk-attempts";
import { giftSource } from "./gift-source";
import { protocol } from "./protocol";

/**
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 * Page-load gift transfer for offer_gift, then accept_gift or cancel_gift.
 * A reload clears it. expiresAt has no default.
 */
export const GIFT_DONOR = "desk-donor";
export const GIFT_DEFAULT_RECIPIENT = "desk-recipient";

const STEP_LABEL: Record<GiftStep, string> = {
  offer_gift: "Offer gift",
  accept_gift: "Accept gift",
  cancel_gift: "Cancel gift",
};

export type GiftRowStatus =
  | "not-started"
  | "ready"
  | "in-flight"
  | "confirmed"
  | "rejected"
  | "unconfirmed"
  | "not-sent"
  | "blocked"
  | "unavailable";

export type GiftPathStatus =
  | { kind: "available-stub-shape" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "unavailable"; code: string | null; detail: string };

export interface GiftReceiptField {
  key: string;
  value: string;
}

export interface GiftDraft {
  ticketId: string;
  expectedVersion: string;
  expiresAt: string;
  recipient: string;
}

export interface GiftRow {
  step: GiftStep;
  label: string;
  status: GiftRowStatus;
  operationId: string | null;
  actor: string | null;
  code: string | null;
  requestId: string | null;
  correlationId: string | null;
  receipt: GiftReceiptField[] | null;
  note: string;
  canSend: boolean;
}

export interface OpenedGift {
  giftId: string;
  lastConfirmed: string;
  unconfirmed: string;
}

export interface GiftPanelModel {
  source: GiftSource | null;
  path: GiftPathStatus;
  rows: GiftRow[];
  lastConfirmed: string;
  unconfirmed: string;
  pending: boolean;
  opened: OpenedGift[];
  send: (step: GiftStep) => void;
}

export interface GiftDeskSnapshot {
  source: GiftSource | null;
  path: GiftPathStatus;
  template: GiftRow[];
  gifts: Array<{
    giftId: string;
    pending: boolean;
    rows: GiftRow[];
    lastConfirmed: string;
    unconfirmed: string;
  }>;
}

export interface GiftDeskProtocol {
  describe(): { environment: "stub" | "integration-http" };
  observeTransport(): Promise<TransportObservation>;
}

export interface GiftDeskDeps {
  protocol: GiftDeskProtocol;
  source: GiftInvokerSource | null;
}

type StepPhase = "pending" | "in-flight" | "confirmed" | "rejected" | "unconfirmed" | "not-sent";

interface StepRecord {
  step: GiftStep;
  phase: StepPhase;
  operationId: string | null;
  actor: string | null;
  code: string | null;
  requestId: string | null;
  correlationId: string | null;
  receipt: GiftReceiptField[] | null;
  note: string;
}

interface GiftRecord {
  giftId: string;
  attempt: number;
  pending: boolean;
  localHalt: boolean;
  transfer: GiftTransfer | null;
  steps: StepRecord[];
  recipient: string;
}

export function giftPathStatus(
  environment: "stub" | "integration-http",
  observation: TransportObservation | null,
): GiftPathStatus {
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

export function selectGiftView(
  snapshot: GiftDeskSnapshot,
  giftId: string,
  send: (step: GiftStep) => void,
): GiftPanelModel {
  const found = giftId.length > 0 ? snapshot.gifts.find((item) => item.giftId === giftId) : undefined;
  const rows = (found?.rows ?? snapshot.template).map((row) => {
    if (giftId.length > 0) {
      return row;
    }
    if (row.status !== "ready") {
      return { ...row, canSend: false };
    }
    return {
      ...row,
      status: "not-started" as const,
      canSend: false,
      note: "Enter a gift id. The desk does not mint one.",
    };
  });
  return {
    source: snapshot.source,
    path: snapshot.path,
    rows,
    lastConfirmed: found?.lastConfirmed ?? "Last confirmed receipt: none",
    unconfirmed: found?.unconfirmed ?? "Unconfirmed request: none",
    pending: found?.pending ?? false,
    opened: snapshot.gifts.map((item) => ({
      giftId: item.giftId,
      lastConfirmed: item.lastConfirmed,
      unconfirmed: item.unconfirmed,
    })),
    send,
  };
}

export class GiftDesk {
  private readonly environment: "stub" | "integration-http";
  private readonly records = new Map<string, GiftRecord>();
  private readonly listeners = new Set<() => void>();
  private path: GiftPathStatus;
  private snapshot: GiftDeskSnapshot;
  private probePromise: Promise<void> | null = null;

  constructor(private readonly deps: GiftDeskDeps) {
    this.environment = deps.protocol.describe().environment;
    this.path = giftPathStatus(this.environment, null);
    this.snapshot = this.buildSnapshot();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): GiftDeskSnapshot => this.snapshot;

  reset(): void {
    this.records.clear();
    this.probePromise = null;
    this.path = giftPathStatus(this.environment, null);
    this.publish();
  }

  probe(): Promise<void> {
    if (this.probePromise) {
      return this.probePromise;
    }
    this.probePromise = this.readProbe();
    return this.probePromise;
  }

  retain(giftId: string): void {
    if (giftId.length === 0 || this.records.has(giftId)) {
      return;
    }
    const attempt = readDeskAttempt("gift", giftId) + 1;
    writeDeskAttempt("gift", giftId, attempt);
    const record: GiftRecord = {
      giftId,
      attempt,
      pending: false,
      localHalt: false,
      transfer: this.deps.source ? new GiftTransfer(this.deps.source.invoker) : null,
      steps: blankSteps(),
      recipient: GIFT_DEFAULT_RECIPIENT,
    };
    this.records.set(giftId, record);
    this.publish();
  }

  async send(giftId: string, step: GiftStep, draft: GiftDraft): Promise<void> {
    if (giftId.length === 0) {
      return;
    }
    this.retain(giftId);
    const record = this.records.get(giftId);
    if (!record || record.pending || record.localHalt || record.transfer?.state().halted) {
      return;
    }
    if (!writesOpen(this.path)) {
      return;
    }
    const current = record.steps.find((item) => item.step === step);
    if (!current || current.phase !== "pending" || !stepSendable(record, step)) {
      return;
    }
    if (step === "offer_gift") {
      record.recipient = draft.recipient;
    }
    const operationId = giftOperationId(giftId, record.attempt, step);
    current.phase = "in-flight";
    current.operationId = operationId;
    current.actor = actorFor(step, record);
    current.note = "In flight. One attempt.";
    record.pending = true;
    this.publish();
    try {
      const outcome = await this.dispatch(record, step, operationId, draft);
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

  view(giftId: string, draft: GiftDraft = emptyDraft()): GiftPanelModel {
    return selectGiftView(this.snapshot, giftId, (step) => {
      void this.send(giftId, step, draft);
    });
  }

  private async readProbe(): Promise<void> {
    try {
      const observation = await this.deps.protocol.observeTransport();
      this.path = giftPathStatus(this.environment, observation);
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
    record: GiftRecord,
    step: GiftStep,
    operationId: string,
    draft: GiftDraft,
  ): Promise<GiftStepOutcome> {
    if (this.deps.source === null || record.transfer === null) {
      throw new ProtocolError("Gift invoker is not selected.");
    }
    if (step === "offer_gift") {
      return record.transfer.offerGift({
        operationId,
        giftId: record.giftId,
        donor: GIFT_DONOR,
        recipient: draft.recipient,
        ticketId: draft.ticketId,
        expectedVersion: callerInteger(draft.expectedVersion),
        expiresAt: callerInteger(draft.expiresAt),
      });
    }
    if (step === "accept_gift") {
      return record.transfer.acceptGift({ operationId });
    }
    return record.transfer.cancelGift({ operationId });
  }

  private applyOutcome(record: GiftRecord, step: GiftStep, outcome: GiftStepOutcome): void {
    const current = record.steps.find((item) => item.step === step);
    if (!current) {
      return;
    }
    if (outcome.kind === "RECEIPT") {
      current.phase = "confirmed";
      current.actor = actorFor(step, record);
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

  private applyThrown(record: GiftRecord, step: GiftStep, error: unknown): void {
    const current = record.steps.find((item) => item.step === step);
    const halted = record.transfer?.state().halted ?? null;
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

  private buildSnapshot(): GiftDeskSnapshot {
    const gifts = [...this.records.values()].map((record) => {
      const rows = deriveRows(record, this.path);
      return {
        giftId: record.giftId,
        pending: record.pending,
        rows,
        lastConfirmed: summaryLine("Last confirmed receipt", lastRow(rows, "confirmed")),
        unconfirmed: summaryLine("Unconfirmed request", rows.find((row) => row.status === "unconfirmed")),
      };
    });
    return {
      source: this.deps.source?.source ?? null,
      path: this.path,
      template: deriveRows(
        {
          giftId: "",
          attempt: 0,
          pending: false,
          localHalt: false,
          transfer: null,
          steps: blankSteps(),
          recipient: GIFT_DEFAULT_RECIPIENT,
        },
        this.path,
      ),
      gifts,
    };
  }
}

function halted(record: GiftRecord): boolean {
  return record.localHalt || record.transfer?.state().halted != null;
}

export function createGiftDesk(deps: GiftDeskDeps): GiftDesk {
  return new GiftDesk(deps);
}

export const giftDesk = new GiftDesk({ protocol, source: giftSource });

export function useGiftDesk(giftId: string, draft: GiftDraft): GiftPanelModel {
  const snapshot = useSyncExternalStore(giftDesk.subscribe, giftDesk.getSnapshot, giftDesk.getSnapshot);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    giftDesk.retain(giftId);
    void giftDesk.probe();
  }, [giftId]);
  const send = useCallback(
    (step: GiftStep) => {
      void giftDesk.send(giftId, step, draftRef.current);
    },
    [giftId],
  );
  return selectGiftView(snapshot, giftId, send);
}

export function emptyDraft(): GiftDraft {
  return {
    ticketId: "",
    expectedVersion: "",
    expiresAt: "",
    recipient: GIFT_DEFAULT_RECIPIENT,
  };
}

function giftOperationId(giftId: string, attempt: number, step: GiftStep): string {
  return `gft:${giftId}:${attempt}:${step}`;
}

function blankSteps(): StepRecord[] {
  return GIFT_COMPOSED.map((step) => ({
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

function stepSendable(record: GiftRecord, step: GiftStep): boolean {
  const offer = record.steps.find((item) => item.step === "offer_gift");
  if (step === "offer_gift") {
    return offer?.phase === "pending";
  }
  if (offer?.phase !== "confirmed") {
    return false;
  }
  const sibling = step === "accept_gift" ? "cancel_gift" : "accept_gift";
  const other = record.steps.find((item) => item.step === sibling);
  return other?.phase === "pending";
}

function writesOpen(path: GiftPathStatus): boolean {
  return path.kind === "available" || path.kind === "available-stub-shape";
}

function actorFor(step: GiftStep, record: GiftRecord): string {
  return step === "accept_gift" ? record.recipient : GIFT_DONOR;
}

function lastRow(rows: GiftRow[], status: GiftRowStatus): GiftRow | undefined {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row?.status === status) {
      return row;
    }
  }
  return undefined;
}

function deriveRows(record: GiftRecord, path: GiftPathStatus): GiftRow[] {
  const open = writesOpen(path);
  const isHalted = halted(record);
  const offer = record.steps.find((item) => item.step === "offer_gift");
  const offerConfirmed = offer?.phase === "confirmed";
  return record.steps.map((step) => {
    let status: GiftRowStatus;
    let canSend = false;
    if (step.phase === "in-flight") {
      status = "in-flight";
    } else if (step.phase !== "pending") {
      status = step.phase;
    } else if (!open) {
      status = path.kind === "checking" ? "not-started" : "unavailable";
    } else if (isHalted || record.pending) {
      status = "blocked";
    } else if (step.step === "offer_gift") {
      status = "ready";
      canSend = true;
    } else if (!offerConfirmed) {
      status = "not-started";
    } else if (siblingPending(record, step.step)) {
      status = "ready";
      canSend = true;
    } else {
      status = "blocked";
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

function siblingPending(record: GiftRecord, step: GiftStep): boolean {
  const sibling = step === "accept_gift" ? "cancel_gift" : "accept_gift";
  return record.steps.find((item) => item.step === sibling)?.phase === "pending";
}

function noteFor(status: GiftRowStatus): string {
  if (status === "ready") {
    return "Ready to send. One attempt.";
  }
  if (status === "not-started") {
    return "Waiting for the offer receipt.";
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

function summaryLine(label: string, row: GiftRow | undefined): string {
  if (!row || !row.operationId) {
    return `${label}: none`;
  }
  return `${label}: ${row.step} · ${row.operationId}`;
}

function receiptFields(receipt: Record<string, unknown>): GiftReceiptField[] {
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

/**
 * A non-canonical integer becomes NaN so the helper schema rejects it before a
 * request. This desk does not supply expiresAt or expectedVersion.
 */
function callerInteger(raw: string): number {
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) {
    return Number.NaN;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : Number.NaN;
}
