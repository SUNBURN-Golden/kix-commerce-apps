import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  JOURNEY_RULING,
  ORGANIZER_COMPOSED,
  ORGANIZER_DESK_NOT_BOUND,
  ORGANIZER_NOT_COMPOSED,
  previewOrganizerStep,
  type OrganizerStep,
} from "@kix/protocol-adapter";
import {
  organizerCallInput,
  organizerDesk,
  organizerOperationId,
  type OrganizerDeskSnapshot,
  type OrganizerDraft,
  type OrganizerPathStatus,
  type OrganizerSendItemResult,
} from "./organizer-desk";

/**
 * Organizer workspace over the shared page-load desk.
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 * Each command is its own request. A reload clears page-load state.
 */

export const ORGANIZER_WS_RULING = JOURNEY_RULING;

export const BATCH_NOT_ATOMIC =
  "Each command is its own request with its own result. They are not one atomic transaction. An earlier receipt is not undone by a later rejection.";

export const ORGANIZER_WS_STUB = "Stub-shape receipts are not from the gate.";

export const ORGANIZER_WS_ACTOR = "Operator is a local-call actor string, not an authentication result.";

export const ORGANIZER_WS_FUNDS = "No funds.";

export const ORGANIZER_WS_RELOAD = "Reload clears page-load state. A reload uses a new attempt id.";

export const ORGANIZER_UNCONNECTED = [
  {
    id: "edit-after-create",
    label: "Edit after create",
    reason: "No published command updates an event after create_event. The draft stays local until a listed command is sent.",
  },
  {
    id: "date-time-venue",
    label: "Date, time, and venue",
    reason: "No published field carries an event date, time, or venue.",
  },
  {
    id: "capacity-read",
    label: "Capacity, sales, and inventory read",
    reason: "No published read of capacity, sales, or inventory. Typed seats are caller input. The gate decides inventory.",
  },
  {
    id: "settlement",
    label: "Settlement and funds",
    reason: "Settlement and funds stay unconnected. No funds.",
  },
] as const;

export { ORGANIZER_COMPOSED, ORGANIZER_DESK_NOT_BOUND, ORGANIZER_NOT_COMPOSED };

export interface OrganizerChangeRow {
  key: string;
  eventId: string;
  step: OrganizerStep;
  draft: OrganizerDraft;
}

export interface OrganizerPreviewItem {
  key: string;
  eventId: string;
  step: OrganizerStep;
  action: OrganizerStep | null;
  actor: string | null;
  body: Record<string, unknown> | null;
  operationIdHint: string | null;
  state: "ready" | "blocked" | "invalid";
  reason: string;
  basis: string;
}

export interface OrganizerBatchPlan {
  planId: string;
  items: OrganizerPreviewItem[];
  preparedAt: number;
}

export type OrganizerBatchItemStatus =
  | "RECEIPT"
  | "REJECTED"
  | "UNKNOWN"
  | "NOT_SENT"
  | "FENCED"
  | "STALE"
  | "NOT_ATTEMPTED";

export interface OrganizerBatchItemResult {
  key: string;
  eventId: string;
  step: OrganizerStep;
  status: OrganizerBatchItemStatus;
  code: string | null;
  operationId: string | null;
  requestId: string | null;
  correlationId: string | null;
  note: string;
}

export interface OrganizerBatchResult {
  planId: string;
  items: OrganizerBatchItemResult[];
  summary: string;
}

export interface OrganizerBatchSender {
  getSnapshot(): OrganizerDeskSnapshot;
  sendItem(eventId: string, step: OrganizerStep, draft: OrganizerDraft): Promise<OrganizerSendItemResult>;
}

export interface OrganizerEditor {
  step: OrganizerStep;
  eventId: string;
  draft: OrganizerDraft;
}

export interface OrganizerEditorPatch {
  step?: OrganizerStep;
  eventId?: string;
  draft?: Partial<OrganizerDraft>;
}

const SUMMARY_LABELS: ReadonlyArray<readonly [OrganizerBatchItemStatus, string, string]> = [
  ["RECEIPT", "receipt", "receipts"],
  ["REJECTED", "rejected", "rejected"],
  ["UNKNOWN", "unknown", "unknown"],
  ["NOT_SENT", "not sent", "not sent"],
  ["FENCED", "fenced", "fenced"],
  ["STALE", "stale", "stale"],
  ["NOT_ATTEMPTED", "not attempted", "not attempted"],
];

let planSeq = 0;
let rowSeq = 0;

export function seatsTypedLine(seats: string): string {
  const count = seats
    .split(",")
    .map((seat) => seat.trim())
    .filter((seat) => seat.length > 0).length;
  return `seats typed: ${count}, caller input; the gate decides inventory`;
}

export function inventorySuggestions(snapshot: OrganizerDeskSnapshot, eventId: string): string[] {
  if (eventId.length === 0) {
    return [];
  }
  const event = snapshot.events.find((item) => item.eventId === eventId);
  const created = event?.rows.find((row) => row.step === "create_event" && row.status === "confirmed");
  const field = created?.receipt?.find((entry) => entry.key === "inventoryIds");
  if (!field) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(field.value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export function copyOrganizerDraft(draft: OrganizerDraft): OrganizerDraft {
  return {
    seats: draft.seats,
    invitationQuota: draft.invitationQuota,
    inventoryId: draft.inventoryId,
    expectedInventoryVersion: draft.expectedInventoryVersion,
    recipient: draft.recipient,
    organizer: draft.organizer ?? "",
    reservationSeconds: draft.reservationSeconds ?? "",
  };
}

export function organizerChangeRow(
  key: string,
  eventId: string,
  step: OrganizerStep,
  draft: OrganizerDraft,
): OrganizerChangeRow {
  return { key, eventId, step, draft: copyOrganizerDraft(draft) };
}

export function nextOrganizerChangeRow(eventId: string, step: OrganizerStep, draft: OrganizerDraft): OrganizerChangeRow {
  rowSeq += 1;
  return organizerChangeRow(`row-${rowSeq}`, eventId, step, draft);
}

export function planOrganizerBatch(rows: readonly OrganizerChangeRow[], snapshot: OrganizerDeskSnapshot): OrganizerBatchPlan {
  planSeq += 1;
  return {
    planId: `local-plan-${planSeq}`,
    items: previewRows(rows, snapshot),
    preparedAt: Date.now(),
  };
}

export function submissionAllowed(input: {
  rowCount: number;
  plan: OrganizerBatchPlan | null;
  planCurrent: boolean;
  submitting: boolean;
  pathOpen: boolean;
}): boolean {
  if (input.rowCount === 0 || input.plan === null || !input.planCurrent || input.submitting || !input.pathOpen) {
    return false;
  }
  return input.plan.items.some((item) => item.state === "ready" || item.state === "invalid");
}

export function pathWritesOpen(path: OrganizerPathStatus): boolean {
  return path.kind === "available" || path.kind === "available-stub-shape";
}

export function summarizeBatch(items: readonly OrganizerBatchItemResult[]): string {
  const parts: string[] = [];
  for (const [status, one, many] of SUMMARY_LABELS) {
    const count = items.filter((item) => item.status === status).length;
    if (count === 0) {
      continue;
    }
    parts.push(`${count} ${count === 1 ? one : many}`);
  }
  return parts.join(", ");
}

export class OrganizerBatchRun {
  private latch: Promise<OrganizerBatchResult> | null = null;

  constructor(
    readonly plan: OrganizerBatchPlan,
    private readonly rows: readonly OrganizerChangeRow[],
    private readonly sender: OrganizerBatchSender,
  ) {}

  submit(): Promise<OrganizerBatchResult> {
    if (this.latch) {
      return this.latch;
    }
    this.latch = this.execute();
    return this.latch;
  }

  private async execute(): Promise<OrganizerBatchResult> {
    const items: OrganizerBatchItemResult[] = [];
    let stopped = false;
    for (const planned of this.plan.items) {
      if (stopped) {
        items.push(itemResult(planned, "NOT_ATTEMPTED", null, null, null, null, "Not attempted."));
        continue;
      }
      const row = this.rows.find((candidate) => candidate.key === planned.key);
      const fresh = previewRows(this.rows, this.sender.getSnapshot()).find((candidate) => candidate.key === planned.key);
      if (!row || !fresh || fresh.basis !== planned.basis) {
        items.push(
          itemResult(
            planned,
            "STALE",
            null,
            null,
            null,
            null,
            "Stale selection. The local selection changed. Nothing was sent.",
          ),
        );
        stopped = true;
        continue;
      }
      if (fresh.state === "blocked") {
        items.push(itemResult(planned, "FENCED", fresh.reason, null, null, null, `Fenced. ${fresh.reason}`));
        stopped = true;
        continue;
      }
      const sent = await this.sender.sendItem(row.eventId, row.step, row.draft);
      items.push(
        itemResult(planned, sent.status, sent.code, sent.operationId, sent.requestId, sent.correlationId, sent.note),
      );
      if (sent.status !== "RECEIPT") {
        stopped = true;
      }
    }
    return { planId: this.plan.planId, items, summary: summarizeBatch(items) };
  }
}

export interface OrganizerWorkspaceModel {
  ruling: string;
  stubSentence: string;
  actorNote: string;
  fundsNote: string;
  reloadNote: string;
  batchNote: string;
  path: OrganizerPathStatus;
  pathOpen: boolean;
  suggestions: string[];
  editor: OrganizerEditor;
  rows: OrganizerChangeRow[];
  plan: OrganizerBatchPlan | null;
  planCurrent: boolean;
  submitting: boolean;
  results: OrganizerBatchResult | null;
  canPrepare: boolean;
  canSubmit: boolean;
  writesDisabled: boolean;
  setEditor: (partial: OrganizerEditorPatch) => void;
  addRow: () => void;
  removeRow: (key: string) => void;
  prepare: () => void;
  submit: () => void;
}

export function emptyOrganizerEditor(): OrganizerEditor {
  return {
    step: "create_event",
    eventId: "",
    draft: copyOrganizerDraft({
      seats: "",
      invitationQuota: "",
      inventoryId: "",
      expectedInventoryVersion: "",
      recipient: "",
      organizer: "",
      reservationSeconds: "",
    }),
  };
}

export function useOrganizerWorkspace(): OrganizerWorkspaceModel {
  const snapshot = useSyncExternalStore(organizerDesk.subscribe, organizerDesk.getSnapshot, organizerDesk.getSnapshot);
  const [editor, setEditorState] = useState<OrganizerEditor>(emptyOrganizerEditor);
  const [rows, setRows] = useState<OrganizerChangeRow[]>([]);
  const [plan, setPlan] = useState<OrganizerBatchPlan | null>(null);
  const [planCurrent, setPlanCurrent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<OrganizerBatchResult | null>(null);
  const [usedPlanId, setUsedPlanId] = useState<string | null>(null);
  const runRef = useRef<OrganizerBatchRun | null>(null);
  const usedRef = useRef<string | null>(null);
  const editorRef = useRef(editor);
  const rowsRef = useRef(rows);
  const planRef = useRef(plan);
  const planCurrentRef = useRef(planCurrent);
  editorRef.current = editor;
  rowsRef.current = rows;
  planRef.current = plan;
  planCurrentRef.current = planCurrent;

  useEffect(() => {
    void organizerDesk.probe();
  }, []);

  const setEditor = useCallback((partial: OrganizerEditorPatch) => {
    setEditorState((current) => ({
      step: partial.step ?? current.step,
      eventId: partial.eventId ?? current.eventId,
      draft: { ...current.draft, ...partial.draft },
    }));
  }, []);

  const addRow = useCallback(() => {
    const current = editorRef.current;
    setRows((existing) => [...existing, nextOrganizerChangeRow(current.eventId, current.step, current.draft)]);
    setPlanCurrent(false);
    planCurrentRef.current = false;
    runRef.current = null;
    usedRef.current = null;
    setUsedPlanId(null);
  }, []);

  const removeRow = useCallback((key: string) => {
    setRows((existing) => existing.filter((row) => row.key !== key));
    setPlanCurrent(false);
    planCurrentRef.current = false;
    runRef.current = null;
    usedRef.current = null;
    setUsedPlanId(null);
  }, []);

  const prepare = useCallback(() => {
    const currentRows = rowsRef.current;
    for (const row of currentRows) {
      if (row.eventId.length > 0) {
        organizerDesk.retain(row.eventId);
      }
    }
    const next = planOrganizerBatch(currentRows, organizerDesk.getSnapshot());
    setPlan(next);
    planRef.current = next;
    setPlanCurrent(true);
    planCurrentRef.current = true;
    setResults(null);
    runRef.current = null;
    usedRef.current = null;
    setUsedPlanId(null);
  }, []);

  const submit = useCallback(() => {
    const currentPlan = planRef.current;
    const currentRows = rowsRef.current;
    if (currentPlan && usedRef.current === currentPlan.planId && runRef.current) {
      void runRef.current.submit();
      return;
    }
    const open = pathWritesOpen(organizerDesk.getSnapshot().path);
    if (
      !submissionAllowed({
        rowCount: currentRows.length,
        plan: currentPlan,
        planCurrent: planCurrentRef.current,
        submitting: false,
        pathOpen: open,
      })
    ) {
      return;
    }
    if (currentPlan === null) {
      return;
    }
    usedRef.current = currentPlan.planId;
    setUsedPlanId(currentPlan.planId);
    const run = new OrganizerBatchRun(currentPlan, currentRows, organizerDesk);
    runRef.current = run;
    setSubmitting(true);
    void run.submit().then((result) => {
      setResults(result);
      setSubmitting(false);
    });
  }, []);

  const pathOpen = pathWritesOpen(snapshot.path);
  return {
    ruling: ORGANIZER_WS_RULING,
    stubSentence: ORGANIZER_WS_STUB,
    actorNote: ORGANIZER_WS_ACTOR,
    fundsNote: ORGANIZER_WS_FUNDS,
    reloadNote: ORGANIZER_WS_RELOAD,
    batchNote: BATCH_NOT_ATOMIC,
    path: snapshot.path,
    pathOpen,
    suggestions: inventorySuggestions(snapshot, editor.eventId),
    editor,
    rows,
    plan,
    planCurrent,
    submitting,
    results,
    canPrepare: rows.length > 0 && !submitting,
    canSubmit:
      usedPlanId !== plan?.planId &&
      submissionAllowed({
        rowCount: rows.length,
        plan,
        planCurrent,
        submitting,
        pathOpen,
      }),
    writesDisabled: submitting || !pathOpen,
    setEditor,
    addRow,
    removeRow,
    prepare,
    submit,
  };
}

function previewRows(rows: readonly OrganizerChangeRow[], snapshot: OrganizerDeskSnapshot): OrganizerPreviewItem[] {
  return rows.map((row, index) => previewOne(row, rows.slice(0, index), snapshot));
}

function previewOne(
  row: OrganizerChangeRow,
  earlier: readonly OrganizerChangeRow[],
  snapshot: OrganizerDeskSnapshot,
): OrganizerPreviewItem {
  const event = snapshot.events.find((item) => item.eventId === row.eventId);
  const attempt = event?.attempt ?? 0;
  const operationIdHint =
    row.eventId.length === 0 ? null : organizerOperationId(row.eventId, attempt, row.step, row.draft.inventoryId);
  const duplicate = duplicateReason(row, earlier);
  const blocked = blockReason(row, snapshot, duplicate);
  let action: OrganizerStep | null = null;
  let actor: string | null = null;
  let body: Record<string, unknown> | null = null;
  let invalid = "";
  if (operationIdHint !== null) {
    try {
      const input = organizerCallInput(row.eventId, row.step, operationIdHint, row.draft);
      const preview = previewOrganizerStep(row.step, input);
      action = preview.action;
      actor = preview.actor;
      body = preview.body;
    } catch (error) {
      invalid = error instanceof Error ? error.message : "The command is invalid.";
    }
  }
  const state = blocked !== null ? "blocked" : invalid.length > 0 ? "invalid" : "ready";
  const reason = blocked ?? invalid;
  return {
    key: row.key,
    eventId: row.eventId,
    step: row.step,
    action,
    actor,
    body,
    operationIdHint,
    state,
    reason,
    basis: fingerprint({
      status: duplicate !== null ? "duplicate" : deskStatus(row, snapshot),
      operationId: duplicate !== null ? null : deskOperationId(row, snapshot),
      halted: event?.halted ?? false,
      pending: event?.pending ?? false,
      issuedHit:
        row.step === "issue_invitation" &&
        row.draft.inventoryId.length > 0 &&
        (event?.issuedInventoryIds.includes(row.draft.inventoryId) ?? false),
      path: snapshot.path.kind,
      hint: operationIdHint,
      body: hashText(JSON.stringify(body)),
      state,
      reason,
    }),
  };
}

function blockReason(row: OrganizerChangeRow, snapshot: OrganizerDeskSnapshot, duplicate: string | null): string | null {
  if (row.eventId.length === 0) {
    return "Empty event id.";
  }
  if (!pathWritesOpen(snapshot.path)) {
    return "Path not open.";
  }
  if (duplicate !== null) {
    return duplicate;
  }
  const event = snapshot.events.find((item) => item.eventId === row.eventId);
  const stepRow = event?.rows.find((item) => item.step === row.step);
  if (event?.pending || stepRow?.status === "in-flight") {
    return "In flight.";
  }
  if (event?.halted) {
    return "Console halted.";
  }
  if (row.step === "issue_invitation") {
    if (row.draft.inventoryId.length > 0 && event?.issuedInventoryIds.includes(row.draft.inventoryId)) {
      return "Already sent.";
    }
  } else if (stepRow?.status === "confirmed") {
    return "Already sent.";
  }
  return null;
}

function duplicateReason(row: OrganizerChangeRow, earlier: readonly OrganizerChangeRow[]): string | null {
  for (const other of earlier) {
    if (other.eventId.length === 0 || other.eventId !== row.eventId) {
      continue;
    }
    if (row.step === "issue_invitation" && other.step === "issue_invitation") {
      if (row.draft.inventoryId.length > 0 && row.draft.inventoryId === other.draft.inventoryId) {
        return "Duplicate inventory id.";
      }
      continue;
    }
    if (other.step === row.step) {
      return "Duplicate command for this event.";
    }
  }
  return null;
}

function deskStatus(row: OrganizerChangeRow, snapshot: OrganizerDeskSnapshot): string {
  const event = snapshot.events.find((item) => item.eventId === row.eventId);
  return event?.rows.find((item) => item.step === row.step)?.status ?? "absent";
}

function deskOperationId(row: OrganizerChangeRow, snapshot: OrganizerDeskSnapshot): string | null {
  const event = snapshot.events.find((item) => item.eventId === row.eventId);
  return event?.rows.find((item) => item.step === row.step)?.operationId ?? null;
}

function fingerprint(value: unknown): string {
  return JSON.stringify(value);
}

function hashText(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function itemResult(
  planned: OrganizerPreviewItem,
  status: OrganizerBatchItemStatus,
  code: string | null,
  operationId: string | null,
  requestId: string | null,
  correlationId: string | null,
  note: string,
): OrganizerBatchItemResult {
  return {
    key: planned.key,
    eventId: planned.eventId,
    step: planned.step,
    status,
    code,
    operationId,
    requestId,
    correlationId,
    note,
  };
}
