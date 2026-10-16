/**
 * The synthetic session recovery desk. A write is recorded in a tab-session
 * journal before it is sent. After a reload or a tab resume, an intent that
 * was not settled is UNKNOWN, and this page sends nothing for it. A cached
 * confirmed record from an earlier load is history, not a current fact.
 *
 * The journal format is app-internal. It is not a public schema, operation,
 * capability, or identifier. Browser storage can be cleared, lost, or copied,
 * so none of this is an exactly-once guarantee, and how long a record is kept
 * is UNDETERMINED.
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  JOURNEY_IDENTITY_DESK_ACTOR,
  JOURNEY_IDENTITY_NOT_BOUND_REASON,
  JOURNEY_IDENTITY_NOT_COMPOSED,
  JourneyIdentityController,
  SESSION_EVIDENCE_LOST,
  SESSION_RETENTION_POLICY,
  SessionRecoveryController,
  identitySender,
  journeyIdentityPortFor,
  openSessionJournal,
  type EvidenceLostCause,
  type JourneyIdentityPort,
  type JourneyIdentityScenario,
  type SessionControllerState,
  type SessionFence,
  type SessionRecord,
  type SessionRunResult,
} from "@kix/protocol-adapter";
import { identityFenceLine } from "./journey-identity";
import { protocol } from "./protocol";
import { pageSessionStore } from "./session-store";

export const SESSION_TITLE = "Session recovery (synthetic)";

export const SESSION_SOURCE_LINE =
  "The write on this page is a synthetic attach on an in-process source. It is not a producer write, not a protocol receipt, and never a proof of payment, issuance, or admission.";

export const SESSION_BOUNDARY =
  "The journal lives in this tab's session storage only. Its format is app-internal: it is not a public schema, operation, capability, or identifier. A record holds short tokens and a hash of the context, never an actor label or free text.";

export const SESSION_STANDING_NOTICE =
  "Browser storage can be cleared, lost, or copied with a duplicated tab. A cleared tab looks the same as a new session, so this journal cannot tell them apart. It is not an exactly-once guarantee and it does not survive losing the tab's storage.";

export const SESSION_RECOVERY_RULE =
  "After a reload or a tab resume, an intent that was not settled is UNKNOWN. This page sends nothing to settle it, and no new write or compensation goes out for that subject. Neither a read nor a late answer resolves it.";

export const SESSION_RETENTION_NOTE = `Retention is ${SESSION_RETENTION_POLICY}. No record expires, and nothing on this page removes a fence.`;

export const SESSION_SCENARIOS = ["clean", "attach-lost", "held-response"] as const satisfies readonly JourneyIdentityScenario[];

export type SessionScenario = (typeof SESSION_SCENARIOS)[number];

export const SESSION_SCENARIO_NOTES: Readonly<Record<SessionScenario, string>> = {
  clean: "An attach is answered and recorded as confirmed in this load.",
  "attach-lost": "An attach is applied and its answer is lost. The subject stays unknown, also after a reload.",
  "held-response": "The answer is held until you deliver it. Reload while it is held to see the in-flight recovery.",
};

export type SessionScreenState =
  | "empty"
  | "ready"
  | "in-progress"
  | "recovered"
  | "evidence-lost"
  | "unavailable"
  | "full"
  | "not-bound";

export interface SessionControl {
  enabled: boolean;
  reason: string | null;
}

export interface SessionItemRow {
  itemId: string;
  subjectRef: string;
  verdict: string;
  attach: SessionControl;
}

export type SessionRecordKind = "history" | "recovered-unknown" | "unknown" | "in-flight" | "this-load" | "rejected";

export interface SessionRecordRow {
  seq: number;
  intentRef: string;
  scope: string;
  outcome: string;
  code: string;
  loadNo: number;
  kind: SessionRecordKind;
  line: string;
}

export interface SessionRecoveryModel {
  state: SessionScreenState;
  statusLine: string;
  detailLine: string;
  items: SessionItemRow[];
  records: SessionRecordRow[];
  budgetLine: string;
  countersLine: string;
  loadLine: string;
  observationLines: string[];
  notComposed: { action: string; reason: string }[];
  lastLine: string | null;
  lastNeedsFocus: boolean;
  lastSeq: number | null;
}

export function evidenceLostCauseLine(cause: EvidenceLostCause): string {
  switch (cause) {
    case "CORRUPT":
      return "The stored journal was damaged. It was set aside and nothing in it is trusted.";
    case "UNSUPPORTED_VERSION":
      return "The stored journal has a version this page does not read. It was set aside and nothing in it is trusted.";
    case "LOST_DURING_SESSION":
      return "The stored journal disappeared during this session. A cleared store cannot be told from a new tab, so nothing is assumed.";
    default: {
      const exhaustive: never = cause;
      return exhaustive;
    }
  }
}

/** Why a write is off. Each fence maps to one sentence. */
export function sessionFenceLine(fence: SessionFence): string {
  switch (fence.reason) {
    case "not-bound":
      return JOURNEY_IDENTITY_NOT_BOUND_REASON;
    case "evidence-lost":
      return `${SESSION_EVIDENCE_LOST} (${fence.cause}). ${evidenceLostCauseLine(fence.cause)} Every write is held and no new reference is issued.`;
    case "unavailable":
      return `This tab's session storage is not usable (${fence.cause}). A write is recorded before it is sent, so every write is held.`;
    case "unresolved": {
      if (fence.inFlight) {
        return `Another write on this subject is in flight (${fence.intentRef}). Wait for its answer.`;
      }
      const where = fence.recovered ? " It was in flight when the page went away." : "";
      const earlier = fence.earlierLoad ? " It was sent in an earlier page load." : "";
      return `An earlier write on this subject has an unknown result (${fence.intentRef}, ${fence.code ?? "no code"}).${where}${earlier} This page does not send it again, and nothing new or compensating is sent for this subject.`;
    }
    case "underlying":
      return identityFenceLine(fence.identity);
    default: {
      const exhaustive: never = fence;
      return exhaustive;
    }
  }
}

export function sessionRunResultLine(result: SessionRunResult): string {
  switch (result.kind) {
    case "CONFIRMED":
      return "Attach recorded by the synthetic source and in the session journal. This is a synthetic evidence record, not a producer receipt.";
    case "REJECTED":
      return `Attach rejected (${result.record.code ?? "no code"}). The source applied nothing for this write.`;
    case "UNKNOWN": {
      const seen =
        result.observed === null
          ? ""
          : ` An answer (${result.observed}) arrived but could not be trusted as the record. It is kept in memory as evidence only.`;
      return `Attach result unknown (${result.record.code ?? "no code"}). It may or may not have applied.${seen} Writes on this subject are blocked, and neither a read nor a late answer resolves it.`;
    }
    case "FENCED":
      return `Attach not sent. ${sessionFenceLine(result.fence)}`;
    case "NOT_SENT":
      return `Attach not sent. ${result.detail}`;
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

export type SessionLastAction =
  | { seq: number; kind: "step"; result: SessionRunResult }
  | { seq: number; kind: "note"; text: string };

function recordKind(record: SessionRecord, load: number): SessionRecordKind {
  if (record.outcome === "IN_FLIGHT") {
    return "in-flight";
  }
  if (record.outcome === "UNKNOWN") {
    return record.code === "RECOVERED_AFTER_RELOAD" || record.code === "TAB_RESUMED" ? "recovered-unknown" : "unknown";
  }
  if (record.outcome === "REJECTED") {
    return "rejected";
  }
  return record.loadNo < load ? "history" : "this-load";
}

function recordLine(record: SessionRecord, kind: SessionRecordKind, load: number): string {
  const base = `${record.intentRef} on ${record.scope}: ${record.outcome}${record.code ? ` (${record.code})` : ""}.`;
  switch (kind) {
    case "history":
      return `${base} History from load ${record.loadNo}. It is not a current fact and it lifts no fence.`;
    case "recovered-unknown":
      return `${base} Its answer never reached the journal. It stays unknown and this page does not send it again.`;
    case "unknown":
      return `${base} It stays unknown and blocks its subject.${record.loadNo < load ? " It was sent in an earlier page load." : ""}`;
    case "in-flight":
      return `${base} Waiting for the answer.`;
    case "rejected":
      return `${base} The source applied nothing.`;
    default:
      return base;
  }
}

function statusFor(state: SessionScreenState, snapshot: SessionControllerState | null): { statusLine: string; detailLine: string } {
  switch (state) {
    case "empty":
      return { statusLine: "Session journal ready. Nothing has been written in this tab yet.", detailLine: "" };
    case "ready":
      return { statusLine: "Session journal ready.", detailLine: "" };
    case "in-progress":
      return { statusLine: "A write is in flight. Nothing is confirmed yet.", detailLine: "If the page goes away now, the intent comes back as unknown and is not sent again." };
    case "recovered": {
      const count = snapshot?.records.filter((record) => record.outcome === "UNKNOWN").length ?? 0;
      return {
        statusLine: `${count} unresolved write${count === 1 ? "" : "s"} came back as UNKNOWN.`,
        detailLine: "Each one may or may not have applied. Nothing was sent again, and the subject stays blocked.",
      };
    }
    case "evidence-lost": {
      const status = snapshot?.status;
      const cause = status !== undefined && status.kind === "evidence-lost" ? status.cause : "CORRUPT";
      return { statusLine: `${SESSION_EVIDENCE_LOST}. Every write is held.`, detailLine: evidenceLostCauseLine(cause) };
    }
    case "unavailable":
      return { statusLine: "This tab's session storage is not usable. Every write is held.", detailLine: "A write is recorded before it is sent, so nothing goes out without that record." };
    case "full":
      return { statusLine: "The session journal is full. No further write is sent from this tab session.", detailLine: "Nothing is evicted, because an eviction could drop a fence." };
    case "not-bound":
      return { statusLine: JOURNEY_IDENTITY_NOT_BOUND_REASON, detailLine: "" };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function screenFor(environment: "stub" | "integration-http", snapshot: SessionControllerState | null): SessionScreenState {
  if (environment === "integration-http") {
    return "not-bound";
  }
  if (snapshot === null) {
    return "empty";
  }
  if (snapshot.status.kind === "evidence-lost") {
    return "evidence-lost";
  }
  if (snapshot.status.kind === "unavailable") {
    return "unavailable";
  }
  if (snapshot.records.some((record) => record.outcome === "IN_FLIGHT")) {
    return "in-progress";
  }
  if (snapshot.records.some((record) => record.outcome === "UNKNOWN" && (recordKind(record, snapshot.load) === "recovered-unknown" || record.loadNo < snapshot.load))) {
    return "recovered";
  }
  if (snapshot.records.length >= snapshot.budget.maxRecords) {
    return "full";
  }
  return snapshot.records.length === 0 ? "empty" : "ready";
}

export function buildSessionModel(input: {
  environment: "stub" | "integration-http";
  recovery: SessionRecoveryController | null;
  identity: JourneyIdentityController | null;
  last: SessionLastAction | null;
}): SessionRecoveryModel {
  const { recovery, identity } = input;
  const snapshot = recovery === null ? null : recovery.state();
  const state = screenFor(input.environment, snapshot);
  const status = statusFor(state, snapshot);

  const items: SessionItemRow[] = (identity?.state().adjudications ?? []).map((verdict) => {
    const itemId = verdict.item.itemId;
    const fence = recovery === null ? null : recovery.gateFor(itemId);
    let reason: string | null = null;
    if (verdict.verdict !== "current") {
      reason = `Verdict ${verdict.verdict}. ${verdict.detail}`;
    } else if (fence !== null) {
      reason = sessionFenceLine(fence);
    }
    return {
      itemId,
      subjectRef: verdict.item.subjectRef,
      verdict: verdict.verdict,
      attach: reason === null ? { enabled: true, reason: null } : { enabled: false, reason },
    };
  });

  const load = snapshot?.load ?? 0;
  const records: SessionRecordRow[] = (snapshot?.records ?? []).map((record) => {
    const kind = recordKind(record, load);
    return {
      seq: record.seq,
      intentRef: record.intentRef,
      scope: record.scope,
      outcome: record.outcome,
      code: record.code ?? "",
      loadNo: record.loadNo,
      kind,
      line: recordLine(record, kind, load),
    };
  });

  const counters = snapshot?.counters ?? { sent: 0, fenced: 0, notSent: 0, recoveredUnknown: 0 };
  const budget = snapshot?.budget;
  let lastLine: string | null = null;
  if (input.last !== null) {
    lastLine = input.last.kind === "note" ? input.last.text : sessionRunResultLine(input.last.result);
  }
  return {
    state,
    statusLine: status.statusLine,
    detailLine: status.detailLine,
    items,
    records,
    budgetLine:
      budget === undefined
        ? "Journal budget not in use."
        : `Journal: ${budget.usedRecords} of ${budget.maxRecords} records, ${budget.usedBytes} of ${budget.maxBytes} bytes. Nothing is evicted.`,
    countersLine: `Sent ${counters.sent} in this load. Blocked before sending ${counters.fenced}. Not sent ${counters.notSent}. Recovered as unknown ${counters.recoveredUnknown}.`,
    loadLine: load === 0 ? "No journal load." : `This is page load ${load} of this tab session.`,
    observationLines: (snapshot?.observations ?? []).map(
      (item) => `Answer (${item.observed}) for ${item.intentRef} could not be recorded. Kept in memory as evidence only; it resolves nothing.`,
    ),
    notComposed: JOURNEY_IDENTITY_NOT_COMPOSED.map((entry) => ({ action: entry.action, reason: entry.reason })),
    lastLine,
    lastNeedsFocus: input.last !== null && input.last.kind === "step" && input.last.result.kind !== "CONFIRMED",
    lastSeq: input.last === null ? null : input.last.seq,
  };
}

export interface SessionActions {
  attach(itemId: string): void;
  refresh(): void;
  deliverHeld(): void;
  setScenario(next: SessionScenario): void;
  reloadPage(): void;
}

interface SessionDesk {
  port: JourneyIdentityPort;
  identity: JourneyIdentityController;
}

/** One recovery controller per page load. The journal opens once, so a render never counts as a reload. */
let pageRecovery: SessionRecoveryController | null = null;

function recoveryFor(desk: SessionDesk, bound: boolean): SessionRecoveryController {
  const sender = identitySender(desk.identity, { bound });
  const key = desk.identity.state().context.key;
  if (pageRecovery === null) {
    pageRecovery = new SessionRecoveryController(openSessionJournal(pageSessionStore()), sender, key);
  } else {
    pageRecovery.rebind(sender, key);
  }
  return pageRecovery;
}

export function useSessionRecoveryDesk(): {
  environment: "stub" | "integration-http";
  scenario: SessionScenario;
  model: SessionRecoveryModel;
  heldSupported: boolean;
  actions: SessionActions;
} {
  const environment = protocol.describe().environment;
  const deskRef = useRef<SessionDesk | null>(null);
  const keyRef = useRef<string | null>(null);
  const recoveryRef = useRef<SessionRecoveryController | null>(null);
  const [scenario, setScenarioState] = useState<SessionScenario>("clean");
  const [, setTick] = useState(0);
  const [last, setLast] = useState<SessionLastAction | null>(null);
  const actionSeq = useRef(0);

  const wantedKey = `${environment}|${scenario}`;
  if (keyRef.current !== wantedKey) {
    const port = journeyIdentityPortFor(environment, { scenario });
    const identity = new JourneyIdentityController(port, { actorRef: JOURNEY_IDENTITY_DESK_ACTOR, role: "operator" });
    deskRef.current = { port, identity };
    recoveryRef.current = recoveryFor(deskRef.current, environment === "stub");
    keyRef.current = wantedKey;
  }
  const desk = deskRef.current;
  const recovery = recoveryRef.current;

  useEffect(() => {
    if (desk === null || recovery === null) {
      return undefined;
    }
    const offRecovery = recovery.subscribe(() => setTick((value) => value + 1));
    const offIdentity = desk.identity.subscribe(() => setTick((value) => value + 1));
    void desk.identity.refresh();
    const onShow = (event: Event) => {
      if ((event as PageTransitionEvent).persisted) {
        recovery.resume();
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        recovery.verify();
      }
    };
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      offRecovery();
      offIdentity();
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [desk, recovery]);

  const note = useCallback((text: string) => {
    actionSeq.current += 1;
    setLast({ seq: actionSeq.current, kind: "note", text });
  }, []);

  const run = useCallback(async (itemId: string) => {
    const current = deskRef.current;
    const controller = recoveryRef.current;
    if (current === null || controller === null) {
      return;
    }
    const result = await controller.run(itemId);
    actionSeq.current += 1;
    setLast({ seq: actionSeq.current, kind: "step", result });
    if (result.kind === "CONFIRMED" || result.kind === "REJECTED" || result.kind === "UNKNOWN") {
      await current.identity.refresh();
    }
  }, []);

  const actions: SessionActions = {
    attach(itemId) {
      void run(itemId);
    },
    refresh() {
      void deskRef.current?.identity.refresh();
    },
    deliverHeld() {
      const current = deskRef.current;
      if (current === null) {
        return;
      }
      const count = current.port.deliverHeld();
      note(count === 0 ? "No held response to deliver." : `Delivered ${count} held response${count === 1 ? "" : "s"}.`);
    },
    setScenario(next) {
      setScenarioState(next);
      note(`Started a new synthetic source with scenario ${next}. This tab's journal is kept: an earlier unknown write keeps blocking its subject.`);
    },
    reloadPage() {
      window.location.reload();
    },
  };

  return {
    environment,
    scenario,
    model: buildSessionModel({ environment, recovery, identity: desk?.identity ?? null, last }),
    heldSupported: scenario === "held-response",
    actions,
  };
}
