import { messages as sourceCopy } from "./i18n/messages/refund-return";
import { sourceMessage } from "./i18n/source-message";
import { connectivityPort, connectivityController, connectedActions } from "./connectivity/write-guard";
/**
 * The synthetic refund-and-return desk on top of the adapter's synthetic
 * source. Stub scope: the default port is the synthetic source. On
 * integration-http the same port is not-bound: the contract-only catalogue
 * has no order read or refund command, and this module does not invent one,
 * send a second attempt, or switch adapters.
 *
 * Reservation, payment observation, issuance, return-required, and
 * refund-done are five separate cells. Cancel, void, PG-cancel adjustment,
 * return observation, and refund are five separate lines. A return-required
 * marker is not a refund pre-stage, and a recorded refund executes nothing.
 * There is no aggregate state, and a read never resolves a write whose result
 * is unknown.
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { REFUND_FLOW_LINES, REFUND_HOLD_NOT_BOUND, REFUND_IDENTITY_REGISTER, REFUND_LINE_ACTIONS, REFUND_RETURN_DESK_ACTOR, REFUND_RETURN_NOT_BOUND_REASON, REFUND_RETURN_NOT_COMPOSED, refundReturnPortFor, type RefundCell, type RefundFlowLine, type RefundReturnPort, type RefundScenario, type RefundStep } from "../../../packages/protocol-adapter/src/refund-return";
import { RefundReturnController, projectRefundReturn, type RefundCaseProjection, type RefundFence, type RefundReadState, type RefundRefreshCause, type RefundStepResult } from "../../../packages/protocol-adapter/src/refund-return-controller";
import { protocol } from "./connectivity/desk-protocol";
import type { OutcomeTrack } from "./workspace/registry";

export const REFUND_TITLE = sourceCopy.en["s1gn"];

export const REFUND_SOURCE_LINE =
  sourceCopy.en["s1g7"];

export const REFUND_BOUNDARY =
  sourceCopy.en["si3"];

export const REFUND_RETURN_NOTE =
  sourceCopy.en["s1gt"];

export const REFUND_NOTSENT_NOTE =
  sourceCopy.en["s1em"];

export const REFUND_HOLD_NOTE = sourceMessage(sourceCopy.en["p.t8"], { v1: REFUND_HOLD_NOT_BOUND.reason });

export const REFUND_SESSION_NOTE =
  sourceCopy.en["sog"];

export const REFUND_FENCE_NOTE =
  sourceCopy.en["s14n"];

export const REFUND_READ_NOTE =
  sourceCopy.en["s14c"];

export const REFUND_SCENARIO_NOTES: Readonly<Record<RefundScenario, string>> = {
  clean: sourceCopy.en["s1ur"],
  "held-only": sourceCopy.en["s1x5"],
  unissued: sourceCopy.en["s1us"],
  returned: sourceCopy.en["s1y8"],
  "refund-recorded": sourceCopy.en["s6l"],
  empty: sourceCopy.en["s1zd"],
  stale: sourceCopy.en["s21a"],
  "refund-lost": sourceCopy.en["s6k"],
  "held-response": sourceCopy.en["s4p"],
  "claims-real": sourceCopy.en["s1w8"],
  "receipt-claims": sourceCopy.en["s1w3"],
};

const CELL_TRACKS: Readonly<Record<RefundCell, OutcomeTrack>> = {
  reservation: "reservation",
  payment: "payment",
  issuance: "issuance",
  returnRequired: "return-required",
  refundDone: "refund-done",
};

const CELL_LABELS: Readonly<Record<RefundCell, string>> = {
  reservation: sourceCopy.en["s1g4"],
  payment: sourceCopy.en["s17i"],
  issuance: sourceCopy.en["s1h9"],
  returnRequired: sourceCopy.en["s1gr"],
  refundDone: sourceCopy.en["s1er"],
};

const LINE_LABELS: Readonly<Record<RefundFlowLine, string>> = {
  cancel: sourceCopy.en["saw"],
  void: sourceCopy.en["s260"],
  pgAdjust: sourceCopy.en["s181"],
  returnObservation: sourceCopy.en["s1gq"],
  refund: sourceCopy.en["s1ek"],
};

const STEP_WORDS: Readonly<Record<RefundStep, string>> = {
  cancel: sourceCopy.en["saw"],
  void: sourceCopy.en["s260"],
  adjust: sourceCopy.en["s181"],
  "observe-return": sourceCopy.en["s1gq"],
  refund: sourceCopy.en["s1ek"],
};

const STEP_TO_LINE: Readonly<Record<RefundStep, RefundFlowLine>> = {
  cancel: "cancel",
  void: "void",
  adjust: "pgAdjust",
  "observe-return": "returnObservation",
  refund: "refund",
};

export type RefundScreenState =
  | "needs-order"
  | "loading"
  | "unread"
  | "ready"
  | "empty"
  | "stale"
  | "refused"
  | "not-bound"
  | "unavailable"
  | "tuple-changed";

export interface RefundControl {
  enabled: boolean;
  /** Why the control is off. Null when it is on. */
  reason: string | null;
}

export interface RefundCellModel {
  cell: RefundCell;
  /** The outcome track this cell wears. Five cells, five distinct tracks. */
  track: OutcomeTrack;
  label: string;
  state: string;
  ref: string | null;
  note: string;
}

export interface RefundLineModel {
  line: RefundFlowLine;
  label: string;
  /** The pinned action this line stands in for. Null for cancel. Never sent. */
  pinnedAction: string | null;
  writeKind: string;
  writeWord: string;
  observedState: "none" | "recorded";
  observedRef: string | null;
  note: string;
  control: RefundControl;
}

export interface RefundIntentRow {
  seq: number;
  intentRef: string;
  stepWord: string;
  outcome: string;
  code: string;
  lateLine: string;
}

export interface RefundSessionModel {
  contextLine: string;
  countersLine: string;
  intents: RefundIntentRow[];
  quarantineLines: string[];
}

export type RefundLastAction =
  | { seq: number; kind: "step"; step: RefundStep; result: RefundStepResult }
  | { seq: number; kind: "note"; text: string };

export interface RefundReturnModel {
  state: RefundScreenState;
  statusLine: string;
  detailLine: string;
  actionLabel: string | null;
  freshnessWord: string;
  orderRef: string | null;
  versionLine: string;
  cells: RefundCellModel[];
  lines: RefundLineModel[];
  session: RefundSessionModel;
  notComposed: { action: string; reason: string }[];
  lastLine: string | null;
  lastNeedsFocus: boolean;
  lastSeq: number | null;
}

export function refundCauseLine(cause: RefundRefreshCause): string {
  switch (cause) {
    case "own-write":
      return sourceCopy.en["s279"];
    case "stale-rejection":
      return sourceCopy.en["s20g"];
    case "context-switch":
      return sourceCopy.en["s1xw"];
    default: {
      const exhaustive: never = cause;
      return exhaustive;
    }
  }
}

/** Why a write is off. Each fence maps to one sentence and no fence is a failure of the page. */
export function refundFenceLine(fence: RefundFence): string {
  switch (fence.reason) {
    case "in-flight":
      return sourceMessage(sourceCopy.en["p.t384"], { v1: fence.intentRef });
    case "unknown-outcome": {
      const late = fence.lateRecorded ? " A late result was recorded, and it does not make the write known." : "";
      const earlier = fence.earlierContext ? " It was sent in an earlier session context." : "";
      return sourceMessage(sourceCopy.en["p.t385"], { v1: fence.intentRef, v2: late, v3: earlier });
    }
    case "no-snapshot":
      return sourceCopy.en["s1ct"];
    case "snapshot-stale":
      return sourceMessage(sourceCopy.en["p.t86"], { v1: refundCauseLine(fence.cause) });
    case "duplicate-intent":
      return sourceMessage(sourceCopy.en["p.t87"], { v1: fence.intentRef });
    case "payment-unobserved":
      return sourceMessage(sourceCopy.en["p.t406"], { v1: fence.orderRef });
    case "return-not-required":
      return sourceMessage(sourceCopy.en["p.t407"], { v1: fence.orderRef });
    case "already-issued":
      return sourceMessage(sourceCopy.en["p.t408"], { v1: fence.orderRef });
    case "cancel-closed":
      return sourceMessage(sourceCopy.en["p.t409"], { v1: fence.orderRef });
    case "not-bound":
      return REFUND_RETURN_NOT_BOUND_REASON;
    default: {
      const exhaustive: never = fence;
      return exhaustive;
    }
  }
}

export function refundStepResultLine(step: RefundStep, result: RefundStepResult): string {
  const word = STEP_WORDS[step];
  switch (result.kind) {
    case "CONFIRMED":
      return sourceMessage(sourceCopy.en["p.t410"], { v1: word });
    case "REJECTED":
      return sourceMessage(sourceCopy.en["p.t193"], { v1: word, v2: result.intent.code ?? "no code", v3: result.intent.message ?? "" }).trim();
    case "UNKNOWN":
      return sourceMessage(sourceCopy.en["p.t389"], { v1: word, v2: result.intent.code ?? "no code" });
    case "QUARANTINED":
      return sourceMessage(sourceCopy.en["p.t102"], { v1: word.toLowerCase() });
    case "FENCED":
      return sourceMessage(sourceCopy.en["p.t45"], { v1: word, v2: refundFenceLine(result.fence) });
    case "NOT_SENT":
      return sourceMessage(sourceCopy.en["p.t45"], { v1: word, v2: result.detail });
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

function attentionFor(last: RefundLastAction | null): boolean {
  if (last === null || last.kind === "note") {
    return false;
  }
  return last.result.kind !== "CONFIRMED";
}

function writeWord(view: RefundCaseProjection["lines"][RefundFlowLine]): { kind: string; word: string } {
  if (view.outcome === null) {
    return { kind: "none", word: sourceCopy.en["s138"] };
  }
  const code = view.code ? ` (${view.code})` : "";
  const late = view.lateRecorded ? " A late result is recorded." : "";
  switch (view.outcome) {
    case "CONFIRMED":
      return { kind: "confirmed", word: sourceCopy.en["s1dv"] };
    case "REJECTED":
      return { kind: "rejected", word: sourceMessage(sourceCopy.en["p.t560"], { v1: code }) };
    case "UNKNOWN":
      return { kind: "unknown", word: sourceMessage(sourceCopy.en["p.t561"], { v1: code, v2: late }) };
    case "IN_FLIGHT":
      return { kind: "in-flight", word: sourceCopy.en["snw"] };
    case "DRAFT":
      return { kind: "draft", word: sourceMessage(sourceCopy.en["p.t360"], { v1: code }) };
    default: {
      const exhaustive: never = view.outcome;
      return exhaustive;
    }
  }
}

function readStateToScreen(readState: RefundReadState, refreshRequired: RefundRefreshCause | null): RefundScreenState {
  switch (readState) {
    case "none":
      return refreshRequired === "context-switch" ? "unread" : "loading";
    case "ready":
      return "ready";
    case "empty":
      return "empty";
    case "stale":
      return "stale";
    case "refused":
      return "refused";
    case "not-bound":
      return "not-bound";
    case "tuple-changed":
      return "tuple-changed";
    case "unavailable":
      return "unavailable";
    default: {
      const exhaustive: never = readState;
      return exhaustive;
    }
  }
}

function statusFor(state: RefundScreenState, detail: string | null): { statusLine: string; detailLine: string; actionLabel: string | null } {
  switch (state) {
    case "needs-order":
      return { statusLine: sourceCopy.en["swm"], detailLine: sourceCopy.en["s184"], actionLabel: null };
    case "loading":
      return { statusLine: sourceCopy.en["s1bn"], detailLine: "", actionLabel: null };
    case "unread":
      return {
        statusLine: sourceCopy.en["s1xx"],
        detailLine: sourceCopy.en["s1b1"],
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "ready":
      return { statusLine: sourceCopy.en["s1eq"], detailLine: "", actionLabel: null };
    case "empty":
      return { statusLine: sourceCopy.en["sxp"], detailLine: sourceCopy.en["s114"], actionLabel: sourceCopy.en["s1ax"] };
    case "stale":
      return { statusLine: sourceCopy.en["s1lx"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    case "refused":
      return { statusLine: sourceCopy.en["s1w9"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1m2"] };
    case "not-bound":
      return { statusLine: REFUND_RETURN_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return { statusLine: sourceCopy.en["s1v8"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1m2"] };
    case "unavailable":
      return { statusLine: sourceCopy.en["s1z3"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function lateLineOf(intent: { late: { result: string; code: string | null } | null }): string {
  if (intent.late === null) {
    return "";
  }
  const code = intent.late.code ? ` (${intent.late.code})` : "";
  return sourceMessage(sourceCopy.en["p.t195"], { v1: intent.late.result, v2: code });
}

/** The unused-intent id the gate preview asks with. It is never sent. */
const GATE_PREVIEW = "gate-preview";

const EMPTY_CELL_STATES: Readonly<Record<RefundCell, string>> = {
  reservation: "not-read",
  payment: "not-read",
  issuance: "not-read",
  returnRequired: "not-read",
  refundDone: "not-read",
};

export function buildRefundReturnModel(input: { controller: RefundReturnController | null; last: RefundLastAction | null; hasOrder: boolean }): RefundReturnModel {
  const { controller } = input;
  const state = controller === null ? null : controller.state();
  const screen =
    controller === null || !input.hasOrder || state === null ? "needs-order" : readStateToScreen(state.readState, state.refreshRequired);
  const status = statusFor(screen, state?.readDetail ?? null);
  const projection = state === null ? { order: null, freshness: "UNAVAILABLE" as const } : projectRefundReturn(state);
  const freshnessWord =
    projection.freshness === "CURRENT"
      ? sourceCopy.en["s1tn"]
      : projection.freshness === "STALE"
        ? sourceCopy.en["s1ti"]
        : sourceCopy.en["s1wv"];

  const cells: RefundCellModel[] = (["reservation", "payment", "issuance", "returnRequired", "refundDone"] as const).map(
    (cell) => {
      const view = projection.order?.cells[cell] ?? null;
      return {
        cell,
        track: CELL_TRACKS[cell],
        label: CELL_LABELS[cell],
        state: view === null ? EMPTY_CELL_STATES[cell] : view.state,
        ref: view?.ref ?? null,
        note: view === null ? sourceCopy.en["s12e"] : view.note,
      };
    },
  );

  const lines: RefundLineModel[] = REFUND_FLOW_LINES.map((line) => {
    const step = (Object.keys(STEP_TO_LINE) as RefundStep[]).find((key) => STEP_TO_LINE[key] === line);
    if (step === undefined) {
      throw new Error(sourceMessage(sourceCopy.en["p.t411"], { v1: line }));
    }
    const view = projection.order?.lines[line] ?? null;
    const write = view === null ? { kind: "none", word: sourceCopy.en["s138"] } : writeWord(view);
    const fence = controller === null ? null : controller.gateFor({ step, intentRef: GATE_PREVIEW });
    return {
      line,
      label: LINE_LABELS[line],
      pinnedAction: REFUND_LINE_ACTIONS[line],
      writeKind: write.kind,
      writeWord: write.word,
      observedState: view?.observed.state ?? "none",
      observedRef: view?.observed.ref ?? null,
      note: view?.observed.note ?? "",
      control: fence === null ? { enabled: true, reason: null } : { enabled: false, reason: refundFenceLine(fence) },
    };
  });

  const intents: RefundIntentRow[] = (state?.intents ?? []).map((intent) => ({
    seq: intent.seq,
    intentRef: intent.intentRef,
    stepWord: STEP_WORDS[intent.step],
    outcome: intent.outcome,
    code: intent.code ?? "",
    lateLine: lateLineOf(intent),
  }));
  const quarantineLines = (state?.quarantined ?? []).map(
    (item) => sourceMessage(sourceCopy.en["p.t122"], { v1: item.arrived, v2: item.intentRef, v3: item.cause }),
  );
  const counters = state?.counters ?? { sent: 0, fenced: 0, notSent: 0, droppedReads: 0 };
  const session: RefundSessionModel = {
    contextLine:
      state === null
        ? sourceCopy.en["syh"]
        : sourceMessage(sourceCopy.en["p.t574"], { v1: state.context.actorRef, v2: state.context.orderRef, v3: state.context.incarnation, v4: state.context.environment }),
    countersLine: sourceMessage(sourceCopy.en["p.t206"], { v1: counters.sent, v2: counters.fenced, v3: counters.notSent, v4: counters.droppedReads }),
    intents,
    quarantineLines,
  };

  let lastLine: string | null = null;
  if (input.last !== null) {
    lastLine = input.last.kind === "note" ? input.last.text : refundStepResultLine(input.last.step, input.last.result);
  }

  return {
    state: screen,
    statusLine: status.statusLine,
    detailLine: status.detailLine,
    actionLabel: status.actionLabel,
    freshnessWord,
    orderRef: projection.order?.orderRef ?? null,
    versionLine: projection.order === null ? "" : sourceMessage(sourceCopy.en["p.t390"], { v1: projection.order.version }),
    cells,
    lines,
    session,
    notComposed: REFUND_RETURN_NOT_COMPOSED.map((entry) => ({ action: entry.action, reason: entry.reason })),
    lastLine,
    lastNeedsFocus: attentionFor(input.last),
    lastSeq: input.last === null ? null : input.last.seq,
  };
}

export const REFUND_IDENTITY_ROWS = REFUND_IDENTITY_REGISTER;

export interface RefundActions {
  refresh(): void;
  write(step: RefundStep): void;
  markReturnRequired(): void;
  deliverHeld(): void;
  deliverLate(): void;
  switchContext(): void;
  newSession(): void;
  setScenario(next: RefundScenario): void;
}

interface RefundSession {
  port: RefundReturnPort;
  controller: RefundReturnController;
}

function orderRefFor(eventId: string): string | null {
  const trimmed = eventId.trim();
  return trimmed.length === 0 ? null : `ord_${trimmed}`;
}

export function useRefundReturnDesk(eventId: string): {
  environment: "stub" | "integration-http";
  scenario: RefundScenario;
  orderRef: string | null;
  model: RefundReturnModel;
  heldSupported: boolean;
  lateSupported: boolean;
  actions: RefundActions;
} {
  const environment = protocol.describe().environment;
  const orderRef = orderRefFor(eventId);
  const sessionRef = useRef<RefundSession | null>(null);
  const sessionKeyRef = useRef<string | null>(null);
  const [scenario, setScenarioState] = useState<RefundScenario>("clean");
  const [, setTick] = useState(0);
  const [last, setLast] = useState<RefundLastAction | null>(null);
  const intentCounter = useRef(0);
  const actionSeq = useRef(0);

  const wantedKey = `${environment}|${scenario}|${orderRef ?? ""}`;
  if (orderRef !== null && sessionKeyRef.current !== wantedKey) {
    const port = connectivityPort(refundReturnPortFor(environment, { scenario }), "refund-return");
    sessionRef.current = { port, controller: connectivityController(new RefundReturnController(port, { actorRef: REFUND_RETURN_DESK_ACTOR, orderRef }), port) };
    sessionKeyRef.current = wantedKey;
  }
  if (orderRef === null) {
    sessionRef.current = null;
    sessionKeyRef.current = null;
  }

  const session = sessionRef.current;

  useEffect(() => {
    if (session === null) {
      return undefined;
    }
    const off = session.controller.subscribe(() => setTick((value) => value + 1));
    void session.controller.refresh();
    return off;
  }, [session]);

  const note = useCallback((text: string) => {
    actionSeq.current += 1;
    setLast({ seq: actionSeq.current, kind: "note", text });
  }, []);

  const run = useCallback(
    async (step: RefundStep) => {
      const current = sessionRef.current;
      if (current === null) {
        return;
      }
      intentCounter.current += 1;
      const result = await current.controller.run({ step, intentRef: `intent-${intentCounter.current}` });
      if (sessionRef.current !== current) {
        return;
      }
      actionSeq.current += 1;
      setLast({ seq: actionSeq.current, kind: "step", step, result });
      if (result.kind === "CONFIRMED" || result.kind === "REJECTED" || result.kind === "UNKNOWN") {
        await current.controller.refresh();
      }
    },
    [],
  );

  const actions: RefundActions = {
    refresh() {
      void sessionRef.current?.controller.refresh();
    },
    write(step) {
      void run(step);
    },
    markReturnRequired() {
      const current = sessionRef.current;
      if (current === null) {
        return;
      }
      note(
        current.port.markReturnRequired(current.controller.state().context.orderRef) === null
          ? sourceCopy.en["sxw"]
          : sourceCopy.en["s1zy"],
      );
      void current.controller.refresh();
    },
    deliverHeld() {
      const current = sessionRef.current;
      if (current === null) {
        return;
      }
      const count = current.port.deliverHeld();
      note(count === 0 ? sourceCopy.en["svq"] : sourceMessage(sourceCopy.en["p.t130"], { v1: count, v2: count === 1 ? "" : "s" }));
    },
    deliverLate() {
      const current = sessionRef.current;
      if (current === null) {
        return;
      }
      const due = current.port.deliverLate();
      if (due.length === 0) {
        note(sourceCopy.en["svv"]);
        return;
      }
      const lines = due.map((delivery) => {
        const outcome = current.controller.acceptLate(delivery);
        return outcome.kind === "RECORDED"
          ? sourceMessage(sourceCopy.en["p.t214"], { v1: delivery.result, v2: delivery.intentRef })
          : sourceMessage(sourceCopy.en["p.t215"], { v1: delivery.intentRef, v2: outcome.cause });
      });
      note(lines.join(" "));
    },
    switchContext() {
      const current = sessionRef.current;
      if (current === null) {
        return;
      }
      const next = current.controller.switchContext();
      note(sourceMessage(sourceCopy.en["p.t247"], { v1: next.actorRef, v2: next.incarnation }));
    },
    newSession() {
      const current = sessionRef.current;
      if (current === null) {
        return;
      }
      sessionKeyRef.current = null;
      const port = connectivityPort(refundReturnPortFor(environment, { scenario }), "refund-return");
      sessionRef.current = {
        port,
        controller: connectivityController(new RefundReturnController(port, { actorRef: REFUND_RETURN_DESK_ACTOR, orderRef: current.controller.state().context.orderRef }), port),
      };
      intentCounter.current = 0;
      note(sourceCopy.en["s1ma"]);
      setTick((value) => value + 1);
    },
    setScenario(next) {
      setScenarioState(next);
      intentCounter.current = 0;
      note(sourceMessage(sourceCopy.en["p.t217"], { v1: next }));
    },
  };

  return {
    environment,
    scenario,
    orderRef,
    model: buildRefundReturnModel({ controller: session?.controller ?? null, last, hasOrder: orderRef !== null }),
    heldSupported: scenario === "held-response",
    lateSupported: scenario === "refund-lost",
    actions: connectedActions(actions, ['write', 'markReturnRequired', 'newSession', 'setScenario'], sessionRef.current?.port),
  };
}
