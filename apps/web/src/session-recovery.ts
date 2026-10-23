import { messages as sourceCopy } from "./i18n/messages/session-recovery";
import { sourceMessage } from "./i18n/source-message";
import { connectivityPort, connectivityController, connectedActions } from "./connectivity/write-guard";
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
import { protocol } from "./connectivity/desk-protocol";
import { pageSessionStore } from "./session-store";

export const SESSION_TITLE = sourceCopy.en["s1jt"];

export const SESSION_SOURCE_LINE =
  sourceCopy.en["s22t"];

export const SESSION_BOUNDARY =
  sourceCopy.en["s1te"];

export const SESSION_STANDING_NOTICE =
  sourceCopy.en["san"];

export const SESSION_RECOVERY_RULE =
  sourceCopy.en["s25"];

export const SESSION_RETENTION_NOTE = sourceMessage(sourceCopy.en["p.t412"], { v1: SESSION_RETENTION_POLICY });

export const SESSION_SCENARIOS = ["clean", "attach-lost", "held-response"] as const satisfies readonly JourneyIdentityScenario[];

export type SessionScenario = (typeof SESSION_SCENARIOS)[number];

export const SESSION_SCENARIO_NOTES: Readonly<Record<SessionScenario, string>> = {
  clean: sourceCopy.en["s3n"],
  "attach-lost": sourceCopy.en["s3p"],
  "held-response": sourceCopy.en["s1q1"],
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
      return sourceCopy.en["s21i"];
    case "UNSUPPORTED_VERSION":
      return sourceCopy.en["s21h"];
    case "LOST_DURING_SESSION":
      return sourceCopy.en["s21g"];
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
      return sourceMessage(sourceCopy.en["p.t413"], { v1: SESSION_EVIDENCE_LOST, v2: fence.cause, v3: evidenceLostCauseLine(fence.cause) });
    case "unavailable":
      return sourceMessage(sourceCopy.en["p.t414"], { v1: fence.cause });
    case "unresolved": {
      if (fence.inFlight) {
        return sourceMessage(sourceCopy.en["p.t237"], { v1: fence.intentRef });
      }
      const where = fence.recovered ? " It was in flight when the page went away." : "";
      const earlier = fence.earlierLoad ? " It was sent in an earlier page load." : "";
      return sourceMessage(sourceCopy.en["p.t415"], { v1: fence.intentRef, v2: fence.code ?? "no code", v3: where, v4: earlier });
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
      return sourceCopy.en["s90"];
    case "REJECTED":
      return sourceMessage(sourceCopy.en["p.t416"], { v1: result.record.code ?? "no code" });
    case "UNKNOWN": {
      const seen =
        result.observed === null
          ? ""
          : sourceMessage(sourceCopy.en["p.t417"], { v1: result.observed });
      return sourceMessage(sourceCopy.en["p.t418"], { v1: result.record.code ?? "no code", v2: seen });
    }
    case "FENCED":
      return sourceMessage(sourceCopy.en["p.t242"], { v1: sessionFenceLine(result.fence) });
    case "NOT_SENT":
      return sourceMessage(sourceCopy.en["p.t242"], { v1: result.detail });
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
  const base = sourceMessage(sourceCopy.en["p.t575"], { v1: record.intentRef, v2: record.scope, v3: record.outcome, v4: record.code ? ` (${record.code})` : "" });
  switch (kind) {
    case "history":
      return sourceMessage(sourceCopy.en["p.t419"], { v1: base, v2: record.loadNo });
    case "recovered-unknown":
      return sourceMessage(sourceCopy.en["p.t420"], { v1: base });
    case "unknown":
      return sourceMessage(sourceCopy.en["p.t421"], { v1: base, v2: record.loadNo < load ? " It was sent in an earlier page load." : "" });
    case "in-flight":
      return sourceMessage(sourceCopy.en["p.t422"], { v1: base });
    case "rejected":
      return sourceMessage(sourceCopy.en["p.t423"], { v1: base });
    default:
      return base;
  }
}

function statusFor(state: SessionScreenState, snapshot: SessionControllerState | null): { statusLine: string; detailLine: string } {
  switch (state) {
    case "empty":
      return { statusLine: sourceCopy.en["s1jr"], detailLine: "" };
    case "ready":
      return { statusLine: sourceCopy.en["s1jq"], detailLine: "" };
    case "in-progress":
      return { statusLine: sourceCopy.en["s9d"], detailLine: sourceCopy.en["sns"] };
    case "recovered": {
      const count = snapshot?.records.filter((record) => record.outcome === "UNKNOWN").length ?? 0;
      return {
        statusLine: sourceMessage(sourceCopy.en["p.t424"], { v1: count, v2: count === 1 ? "" : "s" }),
        detailLine: sourceCopy.en["shx"],
      };
    }
    case "evidence-lost": {
      const status = snapshot?.status;
      const cause = status !== undefined && status.kind === "evidence-lost" ? status.cause : "CORRUPT";
      return { statusLine: sourceMessage(sourceCopy.en["p.t425"], { v1: SESSION_EVIDENCE_LOST }), detailLine: evidenceLostCauseLine(cause) };
    }
    case "unavailable":
      return { statusLine: sourceCopy.en["s23o"], detailLine: sourceCopy.en["s9e"] };
    case "full":
      return { statusLine: sourceCopy.en["s1xz"], detailLine: sourceCopy.en["s118"] };
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
      reason = sourceMessage(sourceCopy.en["p.t537"], { v1: verdict.verdict, v2: verdict.detail });
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
        ? sourceCopy.en["spd"]
        : sourceMessage(sourceCopy.en["p.t426"], { v1: budget.usedRecords, v2: budget.maxRecords, v3: budget.usedBytes, v4: budget.maxBytes }),
    countersLine: sourceMessage(sourceCopy.en["p.t427"], { v1: counters.sent, v2: counters.fenced, v3: counters.notSent, v4: counters.recoveredUnknown }),
    loadLine: load === 0 ? sourceCopy.en["svt"] : sourceMessage(sourceCopy.en["p.t428"], { v1: load }),
    observationLines: (snapshot?.observations ?? []).map(
      (item) => sourceMessage(sourceCopy.en["p.t429"], { v1: item.observed, v2: item.intentRef }),
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
    const port = connectivityPort(journeyIdentityPortFor(environment, { scenario }), "session-recovery");
    const identity = connectivityController(new JourneyIdentityController(port, { actorRef: JOURNEY_IDENTITY_DESK_ACTOR, role: "operator" }), port);
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
      note(count === 0 ? sourceCopy.en["svq"] : sourceMessage(sourceCopy.en["p.t130"], { v1: count, v2: count === 1 ? "" : "s" }));
    },
    setScenario(next) {
      setScenarioState(next);
      note(sourceMessage(sourceCopy.en["p.t430"], { v1: next }));
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
    actions: connectedActions(actions, ['attach', 'setScenario'], deskRef.current?.port),
  };
}
