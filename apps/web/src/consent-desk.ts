import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  ConsentBind,
  CONSENT_AUTHORIZE_ACTOR,
  CONSENT_COMPOSED,
  CONSENT_DESK_NOT_BOUND,
  CONSENT_NOT_COMPOSED,
  ProtocolError,
  type ConsentStep,
  type ConsentStepOutcome,
  type TransportObservation,
} from "@kix/protocol-adapter";
import type { ConsentInvokerSource, ConsentSource } from "@kix/protocol-adapter";
import { readDeskAttempt, writeDeskAttempt } from "./desk-attempts";
import { consentSource } from "./consent-source";
import { protocol } from "./protocol";

/**
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 * Page-load consent bind. A reload clears it. Body fields have no default.
 * set_consent before authorize_marketing is desk behavior for this page.
 */
const STEP_LABEL: Record<ConsentStep, string> = {
  set_consent: "Set consent",
  authorize_marketing: "Authorize marketing",
};

export type ConsentRowStatus =
  | "not-started"
  | "ready"
  | "in-flight"
  | "confirmed"
  | "rejected"
  | "unconfirmed"
  | "not-sent"
  | "blocked"
  | "unavailable";

export type ConsentPathStatus =
  | { kind: "available-stub-shape" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "unavailable"; code: string | null; detail: string };

export interface ConsentReceiptField {
  key: string;
  value: string;
}

export interface ConsentDraft {
  subject: string;
  business: string;
  channel: string;
  purpose: string;
  expectedConsentVersion: string;
  allowed: string;
}

export interface ConsentRow {
  step: ConsentStep;
  label: string;
  status: ConsentRowStatus;
  operationId: string | null;
  actor: string | null;
  code: string | null;
  requestId: string | null;
  correlationId: string | null;
  receipt: ConsentReceiptField[] | null;
  note: string;
  canSend: boolean;
}

export interface ConsentQuote {
  label: string;
  detail: string;
}

export interface OpenedConsent {
  eventId: string;
  lastConfirmed: string;
  unconfirmed: string;
}

export interface ConsentPanelModel {
  source: ConsentSource | null;
  path: ConsentPathStatus;
  rows: ConsentRow[];
  lastConfirmed: string;
  unconfirmed: string;
  pending: boolean;
  opened: OpenedConsent[];
  notComposed: ConsentQuote[];
  deskNotBound: ConsentQuote[];
  send: (step: ConsentStep) => void;
}

export interface ConsentDeskSnapshot {
  source: ConsentSource | null;
  path: ConsentPathStatus;
  template: ConsentRow[];
  notComposed: ConsentQuote[];
  deskNotBound: ConsentQuote[];
  events: Array<{
    eventId: string;
    pending: boolean;
    rows: ConsentRow[];
    lastConfirmed: string;
    unconfirmed: string;
  }>;
}

export interface ConsentDeskProtocol {
  describe(): { environment: "stub" | "integration-http" };
  observeTransport(): Promise<TransportObservation>;
}

export interface ConsentDeskDeps {
  protocol: ConsentDeskProtocol;
  source: ConsentInvokerSource | null;
}

type StepPhase = "pending" | "in-flight" | "confirmed" | "rejected" | "unconfirmed" | "not-sent";

interface StepRecord {
  step: ConsentStep;
  phase: StepPhase;
  operationId: string | null;
  actor: string | null;
  code: string | null;
  requestId: string | null;
  correlationId: string | null;
  receipt: ConsentReceiptField[] | null;
  note: string;
}

interface ConsentRecord {
  eventId: string;
  attempt: number;
  pending: boolean;
  localHalt: boolean;
  bind: ConsentBind | null;
  steps: StepRecord[];
}

export function consentPathStatus(
  environment: "stub" | "integration-http",
  observation: TransportObservation | null,
): ConsentPathStatus {
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

export function selectConsentView(
  snapshot: ConsentDeskSnapshot,
  eventId: string,
  send: (step: ConsentStep) => void,
): ConsentPanelModel {
  const found = eventId.length > 0 ? snapshot.events.find((item) => item.eventId === eventId) : undefined;
  const rows = (found?.rows ?? snapshot.template).map((row) => {
    if (eventId.length > 0) {
      return row;
    }
    if (row.status !== "ready") {
      return { ...row, canSend: false };
    }
    return {
      ...row,
      status: "not-started" as const,
      canSend: false,
      note: "Enter an event id. The desk does not mint one.",
    };
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
    notComposed: snapshot.notComposed,
    deskNotBound: snapshot.deskNotBound,
    send,
  };
}

export class ConsentDesk {
  private readonly environment: "stub" | "integration-http";
  private readonly records = new Map<string, ConsentRecord>();
  private readonly listeners = new Set<() => void>();
  private path: ConsentPathStatus;
  private snapshot: ConsentDeskSnapshot;
  private probePromise: Promise<void> | null = null;

  constructor(private readonly deps: ConsentDeskDeps) {
    this.environment = deps.protocol.describe().environment;
    this.path = consentPathStatus(this.environment, null);
    this.snapshot = this.buildSnapshot();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ConsentDeskSnapshot => this.snapshot;

  reset(): void {
    this.records.clear();
    this.probePromise = null;
    this.path = consentPathStatus(this.environment, null);
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
    const attempt = readDeskAttempt("consent", eventId) + 1;
    writeDeskAttempt("consent", eventId, attempt);
    const record: ConsentRecord = {
      eventId,
      attempt,
      pending: false,
      localHalt: false,
      bind: this.deps.source ? new ConsentBind(this.deps.source.invoker) : null,
      steps: blankSteps(),
    };
    this.records.set(eventId, record);
    this.publish();
  }

  async send(eventId: string, step: ConsentStep, draft: ConsentDraft): Promise<void> {
    if (eventId.length === 0) {
      return;
    }
    this.retain(eventId);
    const record = this.records.get(eventId);
    if (!record || record.pending || halted(record)) {
      return;
    }
    if (!writesOpen(this.path)) {
      return;
    }
    const current = record.steps.find((item) => item.step === step);
    if (!current || !stepSendable(record, step)) {
      return;
    }
    if (step === "set_consent" && current.phase === "confirmed") {
      record.attempt += 1;
      writeDeskAttempt("consent", eventId, record.attempt);
    }
    const operationId = consentOperationId(eventId, record.attempt, step);
    current.phase = "in-flight";
    current.operationId = operationId;
    current.actor = actorFor(step, draft);
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

  view(eventId: string): ConsentPanelModel {
    return selectConsentView(this.snapshot, eventId, (step) => {
      void this.send(eventId, step, emptyConsentDraft());
    });
  }

  viewWith(eventId: string, draft: ConsentDraft): ConsentPanelModel {
    return selectConsentView(this.snapshot, eventId, (step) => {
      void this.send(eventId, step, draft);
    });
  }

  private async readProbe(): Promise<void> {
    try {
      const observation = await this.deps.protocol.observeTransport();
      this.path = consentPathStatus(this.environment, observation);
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
    record: ConsentRecord,
    step: ConsentStep,
    operationId: string,
    draft: ConsentDraft,
  ): Promise<ConsentStepOutcome> {
    if (this.deps.source === null || record.bind === null) {
      throw new ProtocolError("Consent invoker is not selected.");
    }
    const shared = {
      business: draft.business,
      channel: draft.channel,
      eventId: record.eventId,
      expectedConsentVersion: callerInteger(draft.expectedConsentVersion),
      purpose: draft.purpose,
    };
    if (step === "set_consent") {
      return record.bind.setConsent({
        operationId,
        subject: draft.subject,
        allowed: callerAllowed(draft.allowed),
        ...shared,
      });
    }
    return record.bind.authorizeMarketing({
      operationId,
      subject: draft.subject,
      ...shared,
    });
  }

  private applyOutcome(record: ConsentRecord, step: ConsentStep, outcome: ConsentStepOutcome): void {
    const current = record.steps.find((item) => item.step === step);
    if (!current) {
      return;
    }
    if (outcome.kind === "RECEIPT") {
      current.phase = "confirmed";
      current.code = null;
      current.requestId = null;
      current.correlationId = null;
      current.receipt = receiptFields(outcome.receipt);
      current.note =
        this.deps.source?.source === "stub-shape"
          ? "Confirmed stub-shape receipt. Not from the gate."
          : "Confirmed receipt.";
      if (step === "set_consent") {
        const authorize = record.steps.find((item) => item.step === "authorize_marketing");
        if (authorize) {
          authorize.phase = "pending";
          authorize.operationId = null;
          authorize.actor = null;
          authorize.code = null;
          authorize.requestId = null;
          authorize.correlationId = null;
          authorize.receipt = null;
          authorize.note = "";
        }
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
    current.phase = "pending";
    current.operationId = null;
    current.note = `Fenced (${outcome.blockedBy.reason}). Nothing was sent.`;
    if (outcome.blockedBy.reason !== "out-of-order") {
      record.localHalt = true;
    }
  }

  private applyThrown(record: ConsentRecord, step: ConsentStep, error: unknown): void {
    const current = record.steps.find((item) => item.step === step);
    const stopped = record.bind?.state().halted ?? null;
    if (!current) {
      record.localHalt = true;
      return;
    }
    if (stopped?.kind === "UNKNOWN" && stopped.step === step) {
      current.phase = "unconfirmed";
      current.actor = stopped.identity.actor;
      current.code = stopped.identity.code ?? "UNKNOWN";
      current.requestId = stopped.identity.requestId ?? null;
      current.correlationId = stopped.identity.correlationId ?? null;
      current.note = "Unconfirmed: sent, no authoritative receipt. May have applied. Not a rejection.";
      return;
    }
    current.phase = "not-sent";
    current.actor = stopped?.identity.actor ?? current.actor;
    current.code = stopped?.identity.code ?? null;
    current.requestId = stopped?.identity.requestId ?? null;
    current.correlationId = stopped?.identity.correlationId ?? null;
    const message = error instanceof Error ? error.message : "The step was not sent.";
    current.note = `Not sent. ${message}`;
    record.localHalt = stopped === null;
  }

  private publish(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) {
      listener();
    }
  }

  private buildSnapshot(): ConsentDeskSnapshot {
    const events = [...this.records.values()].map((record) => {
      const rows = deriveRows(record, this.path);
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
      template: deriveRows(blankRecord(), this.path),
      notComposed: CONSENT_NOT_COMPOSED.map((entry) => ({
        label: entry.action,
        detail: entry.reason,
      })),
      deskNotBound: CONSENT_DESK_NOT_BOUND.map((entry) => ({
        label: entry.method,
        detail: `${entry.consideredAction ?? "none"} · not-bound. ${entry.reason}`,
      })),
      events,
    };
  }
}

function halted(record: ConsentRecord): boolean {
  return record.localHalt || record.bind?.state().halted != null;
}

export function createConsentDesk(deps: ConsentDeskDeps): ConsentDesk {
  return new ConsentDesk(deps);
}

export const consentDesk = new ConsentDesk({ protocol, source: consentSource });

export function useConsentDesk(eventId: string, draft: ConsentDraft): ConsentPanelModel {
  const snapshot = useSyncExternalStore(consentDesk.subscribe, consentDesk.getSnapshot, consentDesk.getSnapshot);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    consentDesk.retain(eventId);
    void consentDesk.probe();
  }, [eventId]);
  const send = useCallback(
    (step: ConsentStep) => {
      void consentDesk.send(eventId, step, draftRef.current);
    },
    [eventId],
  );
  return selectConsentView(snapshot, eventId, send);
}

export function emptyConsentDraft(): ConsentDraft {
  return {
    subject: "",
    business: "",
    channel: "",
    purpose: "",
    expectedConsentVersion: "",
    allowed: "",
  };
}

function consentOperationId(eventId: string, attempt: number, step: ConsentStep): string {
  return `cns:${eventId}:${attempt}:${step}`;
}

function blankSteps(): StepRecord[] {
  return CONSENT_COMPOSED.map((step) => ({
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

function blankRecord(): ConsentRecord {
  return {
    eventId: "",
    attempt: 0,
    pending: false,
    localHalt: false,
    bind: null,
    steps: blankSteps(),
  };
}

function stepSendable(record: ConsentRecord, step: ConsentStep): boolean {
  const current = record.steps.find((item) => item.step === step);
  if (!current) {
    return false;
  }
  if (step === "set_consent") {
    return current.phase === "pending" || current.phase === "confirmed";
  }
  return current.phase === "pending";
}

function writesOpen(path: ConsentPathStatus): boolean {
  return path.kind === "available" || path.kind === "available-stub-shape";
}

function actorFor(step: ConsentStep, draft: ConsentDraft): string {
  return step === "authorize_marketing" ? CONSENT_AUTHORIZE_ACTOR : draft.subject;
}

function lastRow(rows: ConsentRow[], status: ConsentRowStatus): ConsentRow | undefined {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row?.status === status) {
      return row;
    }
  }
  return undefined;
}

function deriveRows(record: ConsentRecord, path: ConsentPathStatus): ConsentRow[] {
  const open = writesOpen(path);
  const isHalted = halted(record);
  return record.steps.map((step) => {
    let status: ConsentRowStatus;
    let canSend = false;
    if (step.phase === "in-flight") {
      status = "in-flight";
    } else if (step.phase === "confirmed" && step.step === "set_consent" && open && !isHalted && !record.pending) {
      status = "confirmed";
      canSend = true;
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
      receipt: step.receipt,
      note: step.note,
      canSend,
    };
  });
}

function summaryLine(label: string, row: ConsentRow | undefined): string {
  if (!row?.operationId) {
    return `${label}: none`;
  }
  return `${label}: ${row.step} · ${row.operationId}`;
}

function receiptFields(receipt: Record<string, unknown>): ConsentReceiptField[] {
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
 * request. This desk does not supply expectedConsentVersion.
 */
function callerInteger(raw: string): number {
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) {
    return Number.NaN;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : Number.NaN;
}

/** Blank stays not a boolean, so the helper rejects it before a request. */
function callerAllowed(raw: string): boolean {
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  return undefined as unknown as boolean;
}
