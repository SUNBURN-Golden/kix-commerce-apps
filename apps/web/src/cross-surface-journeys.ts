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
import { protocol } from "./protocol";

export const XS_TITLE = "Cross-surface journeys (synthetic)";

export const XS_SOURCE_LINE =
  "This page reads one table of journeys over the synthetic sources that already exist on this page load. It is read-only and it sends no command. It is not a real integration.";

export const XS_BOUNDARY =
  "A confirmed leg is not a close. Closed means the last leg of a synthetic run was confirmed and nothing before it was unconfirmed. UNKNOWN is never shown as done and never shown as lost. A pointer row was not run here. A missing branch stays visible and is never counted as a success.";

export const XS_COMPENSATION_NOTE =
  "The compensation cell has three words. NONE_NEEDED: nothing was applied. FENCED: the request may have applied and later writes are held. COMPENSATION_UNDEFINED: a leg landed and a later one did not, and no compensation path is approved. No cell is a refund, a cancel, or an automatic command, and this page composes none.";

export const XS_NOT_COMPOSED_NOTE =
  "These actions are recorded and never composed. Under M2 the adapter composes nothing past accept_trade, and the opposite commands of the journeys above are not approved.";

export const XS_PENDING_NOTE =
  "The real cross-surface journeys stay on pending node c-cross-surface-journeys after the producer contracts they wait on are merged. This screen stands in for it at stub scope only.";

export const XS_READ_NOTE =
  "A table read is one request and is made once. This page does not make a second attempt for a lost answer. A lost read is shown as unavailable, not as an empty table.";

export const XS_UNDETERMINED_NOTE =
  "UNDETERMINED: whether a marketing reclaim restores a usage count or a budget, the refund and cancel policy values, and how long a fence is kept.";

export const XS_SCENARIO_NOTES: Readonly<Record<CrossSurfaceScenario, string>> = {
  clean: "The table is built from every source and every row is shown.",
  held: "The table's answer is held until you deliver it. Use it to switch the context while a read is in flight.",
  "read-lost": "The answer to the read never arrives. The page shows unavailable, never an empty table.",
  "claims-pass": "The table claims a compensation ran and an UNKNOWN resolved. The controller refuses it whole.",
  empty: "The source answers with no rows. This is an empty table, not an unavailable one.",
};

export const XS_JOURNEY_WORDS: Readonly<Record<CrossSurfaceJourney, string>> = {
  "purchase-booking": "Purchase: booking",
  "purchase-provider": "Purchase: provider checkout",
  "resale-platform": "Resale: platform trade",
  gift: "Gift",
  refund: "Refund and return",
  "marketing-benefit": "Marketing benefit",
  delegation: "Delegated assistant",
  "credit-servicing": "Credit servicing",
  organizer: "Organizer",
  "session-recovery": "Session recovery",
};

export const XS_BRANCH_WORDS: Readonly<Record<CrossSurfaceBranch, string>> = {
  normal: "Normal",
  "explicit-reject": "Explicit rejection",
  "response-lost": "Response lost",
  "partial-success": "Partly landed",
};

export const XS_STATUS_WORDS: Readonly<Record<CrossSurfaceStatus, string>> = {
  closed: "Closed on the whole sequence (synthetic)",
  rejected: "Rejected by the source",
  unknown: "Unknown: unconfirmed",
  partial: "Partial: some legs landed, some did not",
  blocked: "Blocked before send",
  reference: "Pointer: not run here",
};

const BASIS_WORDS: Readonly<Record<string, string>> = {
  executed: "Run here on the sibling's own stub",
  reused: "Reused from an existing run or test",
  "no-source-branch": "No source reproduces this branch",
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
  none: "No table has been read in this session.",
  "in-progress": "A table read is in progress. Its answer is applied here only if the context did not change.",
  ready: "The table is shown below. Each row states its own status; none of them is a promotion.",
  empty: "There are no rows to show.",
  unavailable: "The table is unavailable. The read was lost or unknown, and no row from an earlier read is kept.",
  refused: "The table was refused whole. It claimed something a journey table can never claim, and no row of it is shown.",
  "not-bound": "The table is not bound on this environment. No request was made.",
  "tuple-changed": "The pin tuple changed under the read. Nothing was applied.",
  invalid: "The read was refused before a table was built.",
};

export function readResultLine(result: CrossSurfaceReadResult): string {
  switch (result.kind) {
    case "APPLIED":
      return `Table read applied (${result.readState}).`;
    case "DROPPED":
      return `A table answer arrived after the ${result.cause === "context-changed" ? "context changed" : "newer read was applied"}. It was dropped and applied nowhere.`;
    case "NOT_SENT":
      return "Read not sent. The table is not bound on this environment.";
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
    sourceLine: `Source: ${row.source}.`,
    reuseLine:
      row.reuse === null
        ? null
        : `Pinned by ${row.reuse.testPath}, test "${row.reuse.testTitle}"${row.reuse.qualificationJourneyId ? `, qualification journey ${row.reuse.qualificationJourneyId}` : ""}.`,
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
    screen === "empty" && emptyReason === "filter" ? "No row matches the filter. The table itself holds rows; clear the filter to see them." : STATE_LINES[screen];
  const stubOnly = environment === "stub";
  return {
    state: screen,
    statusLine,
    detailLine: state.readDetail,
    emptyReason,
    readControl: inFlight ? { enabled: false, reason: "A table read is in flight. It is not sent again." } : { enabled: true, reason: null },
    scenarioControl: stubOnly
      ? { enabled: true, reason: null }
      : { enabled: false, reason: "Synthetic scenarios exist only on the stub. On integration-http the table is not bound." },
    heldSupported,
    summaryLine:
      state.table === null
        ? null
        : (() => {
            const sum = summarizeCrossSurfaceRows(state.table.rows);
            return `${sum.rows} rows. ${sum.byStatus.closed} closed, ${sum.byStatus.partial} partial, ${sum.byStatus.unknown} unknown, ${sum.byStatus.rejected} rejected, ${sum.byStatus.blocked} blocked, ${sum.byStatus.reference} pointers or missing branches (not counted as closed).`;
          })(),
    rows: view.map((row) => rowModel(row)),
    rowCount: view.length,
    totalRows,
    notComposedLines: (state.table?.notComposed ?? []).map((item) => `${item.action}: ${item.reason}`),
    holdLine: `${CROSS_SURFACE_HOLD_NOT_BOUND.method} is ${CROSS_SURFACE_HOLD_NOT_BOUND.status}. Its considered action stays ${CROSS_SURFACE_HOLD_NOT_BOUND.consideredAction} and it is never mapped onto prepare_trade. ${CROSS_SURFACE_HOLD_NOT_BOUND.reason}`,
    nonClaimsLine: CROSS_SURFACE_NON_CLAIM_FIELDS.map((field) => `${field} false`).join(". "),
    countersLine: `Read ${state.counters.reads}. Not sent ${state.counters.notSent}. Dropped ${state.counters.droppedReads}.`,
    contextLine: `Environment ${state.context.environment}. Actor ${state.context.actorRef}. Session ${state.context.incarnation}.`,
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
        note("Held answers exist only in the held scenario. Nothing was delivered.");
        return;
      }
      const released = session.port.deliverHeld();
      note(`Delivered ${released} held answer(s).`);
    },
    switchContext() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const context = session.controller.switchContext(`${CROSS_SURFACE_DESK_ACTOR}-${session.controller.state().context.incarnation + 1}`);
      note(`Session context switched (incarnation ${context.incarnation}). A read still in flight is dropped when it arrives.`);
    },
    applyScenario(next) {
      sessionRef.current = createSession(environment, next);
      setInFlight(false);
      setScenarioState(next);
      setEpoch((value) => value + 1);
      note(`New synthetic session under scenario ${next}. ${XS_SCENARIO_NOTES[next]}`);
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
      note("Filter applied to the rows already held. Nothing was read again.");
    },
    clearFilter() {
      sessionRef.current?.controller.clearFilter();
      note("Filter cleared.");
    },
  };

  const session = sessionRef.current;
  const state = session.controller.state();
  const model = buildCrossSurfaceModel(state, session.controller.view(), last, inFlight, environment, session.port.scenario === "held");
  return { environment, scenario, filter: state.filter, model, actions };
}

export { CROSS_SURFACE_NOT_BOUND_REASON, CROSS_SURFACE_RULING, CROSS_SURFACE_SCENARIOS };
