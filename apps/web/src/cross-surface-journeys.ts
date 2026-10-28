import { messages as sourceCopy } from "./i18n/messages/cross-surface-journeys";
import { sourceMessage } from "./i18n/source-message";
/**
 * The cross-surface journeys screen on top of the adapter's synthetic table. Stub
 * scope: the default port builds the table in this process from the synthetic
 * sources that already exist. On integration-http the same port is not-bound:
 * pending node c-cross-surface-journeys is not promoted, and this module does not
 * invent a connection, make a second attempt, or switch adapters.
 *
 * This module computes nothing about a journey. It copies what the table and the
 * controller hold: per row, the last confirmed step, the unconfirmed requests, the
 * blocked next actions, and the compensation cell. The screen has no control that
 * sends a protocol command. The filter works on rows already held.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CROSS_SURFACE_BRANCHES,
  CROSS_SURFACE_DESK_ACTOR,
  CROSS_SURFACE_HOLD_NOT_BOUND,
  CROSS_SURFACE_JOURNEYS,
  CROSS_SURFACE_NON_CLAIM_FIELDS,
  CROSS_SURFACE_NOT_BOUND_REASON,
  CROSS_SURFACE_RULING,
  CROSS_SURFACE_SCENARIOS,
  CROSS_SURFACE_STATUSES,
  CrossSurfaceController,
  crossSurfacePortFor,
  summarizeCrossSurfaceRows,
  type CrossSurfaceBranch,
  type CrossSurfaceControllerState,
  type CrossSurfaceFilter,
  type CrossSurfaceJourney,
  type CrossSurfacePort,
  type CrossSurfaceReadResult,
  type CrossSurfaceRow,
  type CrossSurfaceScenario,
  type CrossSurfaceStatus,
} from "@kix/protocol-adapter";
import { protocol } from "./connectivity/desk-protocol";

export const XS_TITLE = sourceCopy.en["sf6"];

export const XS_SOURCE_LINE =
  sourceCopy.en["s23c"];

export const XS_BOUNDARY =
  sourceCopy.en["st"];

export const XS_COMPENSATION_NOTE =
  sourceCopy.en["s1r2"];

export const XS_NOT_COMPOSED_NOTE =
  sourceCopy.en["s1xr"];

export const XS_PENDING_NOTE =
  sourceCopy.en["s1wd"];

export const XS_READ_NOTE =
  sourceCopy.en["s8p"];

export const XS_UNDETERMINED_NOTE =
  sourceCopy.en["s257"];

export const XS_SCENARIO_NOTES: Readonly<Record<CrossSurfaceScenario, string>> = {
  clean: sourceCopy.en["s22e"],
  held: sourceCopy.en["s22i"],
  "read-lost": sourceCopy.en["s1q5"],
  "claims-pass": sourceCopy.en["s22d"],
  empty: sourceCopy.en["s1yc"],
};

export const XS_JOURNEY_WORDS: Readonly<Record<CrossSurfaceJourney, string>> = {
  "purchase-booking": sourceCopy.en["s1ae"],
  "purchase-provider": sourceCopy.en["s1af"],
  "resale-platform": sourceCopy.en["s1g2"],
  gift: "Gift",
  refund: sourceCopy.en["s1en"],
  "marketing-benefit": sourceCopy.en["sru"],
  delegation: sourceCopy.en["sft"],
  "credit-servicing": "Credit servicing",
  organizer: "Organizer",
  "session-recovery": "Session recovery",
};

export const XS_BRANCH_WORDS: Readonly<Record<CrossSurfaceBranch, string>> = {
  normal: sourceCopy.en["sy0"],
  "explicit-reject": sourceCopy.en["skh"],
  "response-lost": sourceCopy.en["s1gj"],
  "partial-success": sourceCopy.en["s178"],
};

export const XS_STATUS_WORDS: Readonly<Record<CrossSurfaceStatus, string>> = {
  closed: sourceCopy.en["scz"],
  rejected: sourceCopy.en["s1ez"],
  unknown: sourceCopy.en["s25f"],
  partial: sourceCopy.en["s177"],
  blocked: sourceCopy.en["sa5"],
  reference: sourceCopy.en["s18k"],
};

const BASIS_WORDS: Readonly<Record<string, string>> = {
  executed: sourceCopy.en["s1hy"],
  reused: sourceCopy.en["s1gu"],
  "no-source-branch": sourceCopy.en["syq"],
};

export type XsScreenState =
  | "none"
  | "in-progress"
  | "ready"
  | "empty"
  | "unavailable"
  | "refused"
  | "not-bound"
  | "tuple-changed"
  | "invalid";

export interface XsControl {
  enabled: boolean;
  /** Why the control is off. Null when it is on. */
  reason: string | null;
}

export interface XsRowModel {
  id: string;
  journey: string;
  branch: string;
  status: CrossSurfaceStatus;
  statusWord: string;
  basis: string;
  lastConfirmed: string;
  unconfirmed: string;
  blockedLines: string[];
  compensationState: string;
  compensationNote: string;
  legLines: string[];
  sourceLine: string;
  reuseLine: string | null;
  note: string;
}

export interface XsOption {
  value: string;
  label: string;
}

export interface XsModel {
  state: XsScreenState;
  statusLine: string;
  detailLine: string | null;
  emptyReason: "source" | "filter" | null;
  readControl: XsControl;
  scenarioControl: XsControl;
  heldSupported: boolean;
  summaryLine: string | null;
  rows: XsRowModel[];
  rowCount: number;
  totalRows: number;
  notComposedLines: string[];
  holdLine: string;
  nonClaimsLine: string;
  countersLine: string;
  contextLine: string;
  lastLine: string | null;
  lastNeedsFocus: boolean;
  lastSeq: number | null;
}

export type XsLastAction =
  | { seq: number; kind: "read"; result: CrossSurfaceReadResult }
  | { seq: number; kind: "note"; text: string };

export const XS_JOURNEY_OPTIONS: readonly XsOption[] = CROSS_SURFACE_JOURNEYS.map((value) => ({ value, label: XS_JOURNEY_WORDS[value] }));
export const XS_BRANCH_OPTIONS: readonly XsOption[] = CROSS_SURFACE_BRANCHES.map((value) => ({ value, label: XS_BRANCH_WORDS[value] }));
export const XS_STATUS_OPTIONS: readonly XsOption[] = CROSS_SURFACE_STATUSES.map((value) => ({ value, label: XS_STATUS_WORDS[value] }));

const STATE_LINES: Readonly<Record<XsScreenState, string>> = {
  none: sourceCopy.en["sz3"],
  "in-progress": sourceCopy.en["s8o"],
  ready: sourceCopy.en["s22g"],
  empty: sourceCopy.en["s1wg"],
  unavailable: sourceCopy.en["s22h"],
  refused: sourceCopy.en["s22j"],
  "not-bound": sourceCopy.en["s22f"],
  "tuple-changed": sourceCopy.en["s1va"],
  invalid: sourceCopy.en["s1wb"],
};

export function readResultLine(result: CrossSurfaceReadResult): string {
  switch (result.kind) {
    case "APPLIED":
      return sourceMessage(sourceCopy.en["p.t70"], { v1: result.readState });
    case "DROPPED":
      return sourceMessage(sourceCopy.en["p.t71"], { v1: result.cause === "context-changed" ? "context changed" : "newer read was applied" });
    case "NOT_SENT":
      return sourceCopy.en["s1bw"];
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

function legLine(item: { label: string; outcome: string; code: string | null; note: string }): string {
  const codeText = item.code ? ` (${item.code})` : "";
  return `${item.label}: ${item.outcome}${codeText}${item.note ? `. ${item.note}` : ""}`;
}

export function rowModel(row: CrossSurfaceRow): XsRowModel {
  return {
    id: row.id,
    journey: XS_JOURNEY_WORDS[row.journey],
    branch: XS_BRANCH_WORDS[row.branch],
    status: row.status,
    statusWord: XS_STATUS_WORDS[row.status],
    basis: BASIS_WORDS[row.basis] ?? row.basis,
    lastConfirmed: row.lastConfirmed,
    unconfirmed: row.unconfirmed.length === 0 ? "none" : row.unconfirmed.join("; "),
    blockedLines: row.blockedNext.map((item) => `${item.action}: ${item.reason}`),
    compensationState: row.compensation.state,
    compensationNote: row.compensation.note,
    legLines: row.legs.map((item) => legLine(item)),
    sourceLine: sourceMessage(sourceCopy.en["p.t485"], { v1: row.source }),
    reuseLine:
      row.reuse === null
        ? null
        : sourceMessage(sourceCopy.en["p.t72"], { v1: row.reuse.testPath, v2: row.reuse.testTitle, v3: row.reuse.qualificationJourneyId ? `, qualification journey ${row.reuse.qualificationJourneyId}` : "" }),
    note: row.note,
  };
}

function screenState(state: CrossSurfaceControllerState, inFlight: boolean): XsScreenState {
  if (inFlight) {
    return "in-progress";
  }
  switch (state.readState) {
    case "none":
      return "none";
    case "ready":
      return "ready";
    case "empty":
      return "empty";
    case "refused":
      return "refused";
    case "invalid":
      return "invalid";
    case "not-bound":
      return "not-bound";
    case "tuple-changed":
      return "tuple-changed";
    case "unavailable":
      return "unavailable";
    default: {
      const exhaustive: never = state.readState;
      return exhaustive;
    }
  }
}

export function buildCrossSurfaceModel(
  state: CrossSurfaceControllerState,
  view: readonly CrossSurfaceRow[],
  last: XsLastAction | null,
  inFlight: boolean,
  environment: "stub" | "integration-http",
  heldSupported: boolean,
): XsModel {
  let screen = screenState(state, inFlight);
  let emptyReason: XsModel["emptyReason"] = null;
  const totalRows = state.table?.rows.length ?? 0;
  if (screen === "empty") {
    emptyReason = "source";
  } else if (screen === "ready" && view.length === 0) {
    screen = "empty";
    emptyReason = "filter";
  }
  const statusLine =
    screen === "empty" && emptyReason === "filter" ? sourceCopy.en["sy2"] : STATE_LINES[screen];
  const stubOnly = environment === "stub";
  return {
    state: screen,
    statusLine,
    detailLine: state.readDetail,
    emptyReason,
    readControl: inFlight ? { enabled: false, reason: sourceCopy.en["s8n"] } : { enabled: true, reason: null },
    scenarioControl: stubOnly
      ? { enabled: true, reason: null }
      : { enabled: false, reason: sourceCopy.en["s1p6"] },
    heldSupported,
    summaryLine:
      state.table === null
        ? null
        : (() => {
            const sum = summarizeCrossSurfaceRows(state.table.rows);
            return sourceMessage(sourceCopy.en["p.t74"], { v1: sum.rows, v2: sum.byStatus.closed, v3: sum.byStatus.partial, v4: sum.byStatus.unknown, v5: sum.byStatus.rejected, v6: sum.byStatus.blocked, v7: sum.byStatus.reference });
          })(),
    rows: view.map((row) => rowModel(row)),
    rowCount: view.length,
    totalRows,
    notComposedLines: (state.table?.notComposed ?? []).map((item) => `${item.action}: ${item.reason}`),
    holdLine: sourceMessage(sourceCopy.en["p.t75"], { v1: CROSS_SURFACE_HOLD_NOT_BOUND.method, v2: CROSS_SURFACE_HOLD_NOT_BOUND.status, v3: CROSS_SURFACE_HOLD_NOT_BOUND.consideredAction, v4: CROSS_SURFACE_HOLD_NOT_BOUND.reason }),
    nonClaimsLine: CROSS_SURFACE_NON_CLAIM_FIELDS.map((field) => `${field} false`).join(". "),
    countersLine: sourceMessage(sourceCopy.en["p.t76"], { v1: state.counters.reads, v2: state.counters.notSent, v3: state.counters.droppedReads }),
    contextLine: sourceMessage(sourceCopy.en["p.t487"], { v1: state.context.environment, v2: state.context.actorRef, v3: state.context.incarnation }),
    lastLine: last === null ? null : last.kind === "note" ? last.text : readResultLine(last.result),
    lastNeedsFocus: last !== null && last.kind === "read" && last.result.kind !== "APPLIED",
    lastSeq: last?.seq ?? null,
  };
}

interface Session {
  port: CrossSurfacePort;
  controller: CrossSurfaceController;
}

function createSession(environment: "stub" | "integration-http", scenario: CrossSurfaceScenario): Session {
  const port = crossSurfacePortFor(environment, { scenario });
  return { port, controller: new CrossSurfaceController(port, { actorRef: CROSS_SURFACE_DESK_ACTOR }) };
}

export interface XsActions {
  read(): void;
  deliverHeld(): void;
  switchContext(): void;
  applyScenario(next: CrossSurfaceScenario): void;
  applyFilter(next: { journey: string; branch: string; status: string }): void;
  clearFilter(): void;
}

export function useCrossSurfaceJourneys(): {
  environment: "stub" | "integration-http";
  scenario: CrossSurfaceScenario;
  filter: CrossSurfaceFilter;
  model: XsModel;
  actions: XsActions;
} {
  const environment = protocol.describe().environment;
  const sessionRef = useRef<Session | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createSession(environment, "clean");
  }
  const startedRef = useRef<Session | null>(null);
  const [scenario, setScenarioState] = useState<CrossSurfaceScenario>("clean");
  const [epoch, setEpoch] = useState(0);
  const [, setTick] = useState(0);
  const [inFlight, setInFlight] = useState(false);
  const [last, setLast] = useState<XsLastAction | null>(null);
  const actionSeq = useRef(0);

  const note = useCallback((text: string) => {
    actionSeq.current += 1;
    setLast({ seq: actionSeq.current, kind: "note", text });
  }, []);

  const startRead = useCallback((session: Session) => {
    setInFlight(true);
    void session.controller.read().then((result) => {
      if (sessionRef.current !== session) {
        return;
      }
      setInFlight(false);
      actionSeq.current += 1;
      setLast({ seq: actionSeq.current, kind: "read", result });
    });
  }, []);

  useEffect(() => {
    const session = sessionRef.current;
    if (session === null) {
      return undefined;
    }
    return session.controller.subscribe(() => setTick((value) => value + 1));
  }, [epoch]);

  // The first read of a session is made once. A repeated mount of the same session does not make another.
  useEffect(() => {
    const session = sessionRef.current;
    if (session === null || startedRef.current === session) {
      return;
    }
    startedRef.current = session;
    startRead(session);
  }, [epoch, startRead]);

  const actions: XsActions = {
    read() {
      const session = sessionRef.current;
      if (session === null || inFlight) {
        return;
      }
      startRead(session);
    },
    deliverHeld() {
      const session = sessionRef.current;
      if (session === null || session.port.scenario !== "held") {
        note(sourceCopy.en["sn7"]);
        return;
      }
      const released = session.port.deliverHeld();
      note(sourceMessage(sourceCopy.en["p.t77"], { v1: released }));
    },
    switchContext() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const context = session.controller.switchContext(`${CROSS_SURFACE_DESK_ACTOR}-${session.controller.state().context.incarnation + 1}`);
      note(sourceMessage(sourceCopy.en["p.t78"], { v1: context.incarnation }));
    },
    applyScenario(next) {
      sessionRef.current = createSession(environment, next);
      // The new session's first read starts right away; the start note and its answer are one status update.
      setInFlight(true);
      setScenarioState(next);
      setEpoch((value) => value + 1);
      note(sourceMessage(sourceCopy.en["p.t79"], { v1: next, v2: XS_SCENARIO_NOTES[next] }));
    },
    applyFilter(next) {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const journey = (CROSS_SURFACE_JOURNEYS as readonly string[]).includes(next.journey) ? (next.journey as CrossSurfaceJourney) : null;
      const branch = (CROSS_SURFACE_BRANCHES as readonly string[]).includes(next.branch) ? (next.branch as CrossSurfaceBranch) : null;
      const status = (CROSS_SURFACE_STATUSES as readonly string[]).includes(next.status) ? (next.status as CrossSurfaceStatus) : null;
      session.controller.setFilter({ journey, branch, status });
      note(sourceCopy.en["sl6"]);
    },
    clearFilter() {
      sessionRef.current?.controller.clearFilter();
      note(sourceCopy.en["sl7"]);
    },
  };

  const session = sessionRef.current;
  const state = session.controller.state();
  const model = buildCrossSurfaceModel(state, session.controller.view(), last, inFlight, environment, session.port.scenario === "held");
  return { environment, scenario, filter: state.filter, model, actions };
}

export { CROSS_SURFACE_NOT_BOUND_REASON, CROSS_SURFACE_RULING, CROSS_SURFACE_SCENARIOS };
