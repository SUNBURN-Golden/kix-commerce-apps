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
import {
  REFUND_FLOW_LINES,
  REFUND_HOLD_NOT_BOUND,
  REFUND_IDENTITY_REGISTER,
  REFUND_LINE_ACTIONS,
  REFUND_RETURN_DESK_ACTOR,
  REFUND_RETURN_NOT_BOUND_REASON,
  REFUND_RETURN_NOT_COMPOSED,
  RefundReturnController,
  projectRefundReturn,
  refundReturnPortFor,
  type RefundCaseProjection,
  type RefundCell,
  type RefundFence,
  type RefundFlowLine,
  type RefundReadState,
  type RefundRefreshCause,
  type RefundReturnPort,
  type RefundScenario,
  type RefundStep,
  type RefundStepResult,
} from "@kix/protocol-adapter";
import { protocol } from "./protocol";
import type { OutcomeTrack } from "./workspace/registry";

export const REFUND_TITLE = "Return and refund (synthetic)";

export const REFUND_SOURCE_LINE =
  "Reservation, payment observation, issuance, return, and refund rows come from a synthetic source on this page load. They are not a producer receipt, not a payment processor response, and not a real refund. Every row is labelled synthetic.";

export const REFUND_BOUNDARY =
  "Each row below is an observation or a synthetic write of this page. Reservation, payment observation, issuance, return-required, and refund-done are five separate cells, and cancel, void, PG-cancel adjustment, return observation, and refund are five separate lines. None of them completes the others.";

export const REFUND_RETURN_NOTE =
  "Return-required is its own state, not the step before a refund. Recording a return observation clears the marker only; it does not record a refund. Recording a refund clears nothing: a return required stays required.";

export const REFUND_NOTSENT_NOTE =
  "refund_ticket, void_unissued, adjust_pg_cancel, and observe_return are pinned and never sent. The catalogue has no booking-cancel command, so the cancel line names none. Every line here is a synthetic record that executes nothing.";

export const REFUND_HOLD_NOTE = `Holding a seat is not available here. ${REFUND_HOLD_NOT_BOUND.reason}`;

export const REFUND_SESSION_NOTE =
  "Intents live in this page load only. A reload or a new synthetic session clears them and resolves nothing at a producer. After a reload an unknown write is not recovered here.";

export const REFUND_FENCE_NOTE =
  "One write is sent at a time per order, and each is sent once. This page does not send a write again, does not mint an intent for you, and does not undo one with another.";

export const REFUND_READ_NOTE =
  "One read follows each settled write so the next step can use fresh evidence. Nothing polls. A read is evidence and never resolves an unknown write.";

export const REFUND_SCENARIO_NOTES: Readonly<Record<RefundScenario, string>> = {
  clean: "The order has an observed payment and an issuance. Every step is answered.",
  "held-only": "The reservation is held with no payment observation. Only a cancel can be recorded.",
  unissued: "The order has an observed payment and no issuance. A void can be recorded.",
  returned: "The source already recorded a return observation.",
  "refund-recorded": "A refund record exists and the return marker stays required. The two states are separate.",
  empty: "The source has no case for this order.",
  stale: "The source serves a watermark older than the floor this page holds.",
  "refund-lost": "A refund is applied and its answer is lost. The write stays unknown.",
  "held-response": "Answers are held until you deliver them.",
  "claims-real": "The read payload claims a real payment. The whole payload is refused before a row shows.",
  "receipt-claims": "The read is clean but a confirmed answer claims a real payment. The write is unknown.",
};

const CELL_TRACKS: Readonly<Record<RefundCell, OutcomeTrack>> = {
  reservation: "reservation",
  payment: "payment",
  issuance: "issuance",
  returnRequired: "return-required",
  refundDone: "refund-done",
};

const CELL_LABELS: Readonly<Record<RefundCell, string>> = {
  reservation: "Reservation",
  payment: "Payment observation",
  issuance: "Right issuance",
  returnRequired: "Return required",
  refundDone: "Refund done",
};

const LINE_LABELS: Readonly<Record<RefundFlowLine, string>> = {
  cancel: "Cancel",
  void: "Void",
  pgAdjust: "PG-cancel adjustment",
  returnObservation: "Return observation",
  refund: "Refund",
};

const STEP_WORDS: Readonly<Record<RefundStep, string>> = {
  cancel: "Cancel",
  void: "Void",
  adjust: "PG-cancel adjustment",
  "observe-return": "Return observation",
  refund: "Refund",
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
      return "Your own write landed after the last read.";
    case "stale-rejection":
      return "The source said the last read was behind.";
    case "context-switch":
      return "The session context changed.";
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
      return `Another write on this order is in flight (${fence.intentRef}). Wait for its answer.`;
    case "unknown-outcome": {
      const late = fence.lateRecorded ? " A late result was recorded, and it does not make the write known." : "";
      const earlier = fence.earlierContext ? " It was sent in an earlier session context." : "";
      return `An earlier write on this order has an unknown result (${fence.intentRef}).${late}${earlier} Writes on this order stay blocked. A read does not resolve it.`;
    }
    case "no-snapshot":
      return "Read the refund desk first.";
    case "snapshot-stale":
      return `Read again before the next write. ${refundCauseLine(fence.cause)}`;
    case "duplicate-intent":
      return `Intent ${fence.intentRef} was already used. This page does not send the same intent twice.`;
    case "payment-unobserved":
      return `No payment observation is recorded for ${fence.orderRef}. A refund or an adjustment waits on one.`;
    case "return-not-required":
      return `No return is required on ${fence.orderRef}. A return observation does not mark one required.`;
    case "already-issued":
      return `Order ${fence.orderRef} already has an issuance record. void_unissued voids an unissued right; nothing is voided here.`;
    case "cancel-closed":
      return `Order ${fence.orderRef} cannot take a cancel: it is cancelled already or a payment is observed. A cancel is not the refund path.`;
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
      return `${word} recorded by the synthetic source. This is not a producer receipt and not a real refund, void, or cancel.`;
    case "REJECTED":
      return `${word} rejected (${result.intent.code ?? "no code"}). ${result.intent.message ?? ""} The source applied nothing for this write.`.trim();
    case "UNKNOWN":
      return `${word} result unknown (${result.intent.code ?? "no code"}). It may or may not have applied. Writes on this order are blocked, and neither a read nor a late result resolves it.`;
    case "QUARANTINED":
      return `The result of the ${word.toLowerCase()} arrived after the session context changed. It was quarantined and applied nowhere. The write stays unknown.`;
    case "FENCED":
      return `${word} not sent. ${refundFenceLine(result.fence)}`;
    case "NOT_SENT":
      return `${word} not sent. ${result.detail}`;
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
    return { kind: "none", word: "No write sent by this page." };
  }
  const code = view.code ? ` (${view.code})` : "";
  const late = view.lateRecorded ? " A late result is recorded." : "";
  switch (view.outcome) {
    case "CONFIRMED":
      return { kind: "confirmed", word: "Recorded by the synthetic source." };
    case "REJECTED":
      return { kind: "rejected", word: `Rejected${code}.` };
    case "UNKNOWN":
      return { kind: "unknown", word: `Unknown${code}.${late}` };
    case "IN_FLIGHT":
      return { kind: "in-flight", word: "In flight." };
    case "DRAFT":
      return { kind: "draft", word: `Not sent${code}.` };
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
      return { statusLine: "No order is selected.", detailLine: "Pick a show or open a booking to see its refund desk.", actionLabel: null };
    case "loading":
      return { statusLine: "Reading the synthetic refund desk. Nothing is confirmed yet.", detailLine: "", actionLabel: null };
    case "unread":
      return {
        statusLine: "The session context changed, so there is no read in this context.",
        detailLine: "Read again to see the desk from this context. An earlier unknown write still blocks this order.",
        actionLabel: "Read again",
      };
    case "ready":
      return { statusLine: "Refund desk read.", detailLine: "", actionLabel: null };
    case "empty":
      return { statusLine: "No refund case for this order in this synthetic session.", detailLine: "Nothing can be cancelled, voided, adjusted, observed, or refunded.", actionLabel: "Read again" };
    case "stale":
      return { statusLine: "Stale refund read.", detailLine: detail ?? "", actionLabel: "Read again" };
    case "refused":
      return { statusLine: "The read payload was refused whole before any row was shown.", detailLine: detail ?? "", actionLabel: "Start a new synthetic session" };
    case "not-bound":
      return { statusLine: REFUND_RETURN_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return { statusLine: "The pin tuple changed. Nothing was read and nothing was applied.", detailLine: detail ?? "", actionLabel: "Start a new synthetic session" };
    case "unavailable":
      return { statusLine: "The source did not answer. This is not an empty desk.", detailLine: detail ?? "", actionLabel: "Read again" };
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
  return `Late result ${intent.late.result}${code}. Evidence only.`;
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
  const screen = controller === null || !input.hasOrder ? "needs-order" : readStateToScreen(state!.readState, state!.refreshRequired);
  const status = statusFor(screen, state?.readDetail ?? null);
  const projection = state === null ? { order: null, freshness: "UNAVAILABLE" as const } : projectRefundReturn(state);
  const freshnessWord =
    projection.freshness === "CURRENT"
      ? "The last read is current."
      : projection.freshness === "STALE"
        ? "The last read is behind."
        : "There is no usable read.";

  const cells: RefundCellModel[] = (["reservation", "payment", "issuance", "returnRequired", "refundDone"] as const).map(
    (cell) => {
      const view = projection.order?.cells[cell] ?? null;
      return {
        cell,
        track: CELL_TRACKS[cell],
        label: CELL_LABELS[cell],
        state: view === null ? EMPTY_CELL_STATES[cell] : view.state,
        ref: view?.ref ?? null,
        note: view === null ? "Not read in this session." : view.note,
      };
    },
  );

  const lines: RefundLineModel[] = REFUND_FLOW_LINES.map((line) => {
    const step = (Object.keys(STEP_TO_LINE) as RefundStep[]).find((key) => STEP_TO_LINE[key] === line)!;
    const view = projection.order?.lines[line] ?? null;
    const write = view === null ? { kind: "none", word: "No write sent by this page." } : writeWord(view);
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
    (item) => `Result ${item.arrived} for ${item.intentRef} was quarantined (${item.cause}). It changed nothing.`,
  );
  const counters = state?.counters ?? { sent: 0, fenced: 0, notSent: 0, droppedReads: 0 };
  const session: RefundSessionModel = {
    contextLine:
      state === null
        ? "No session."
        : `Actor ${state.context.actorRef}, order ${state.context.orderRef}, session ${state.context.incarnation}, mode ${state.context.environment}.`,
    countersLine: `Sent ${counters.sent}. Blocked before sending ${counters.fenced}. Not sent ${counters.notSent}. Reads dropped ${counters.droppedReads}.`,
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
    versionLine: projection.order === null ? "" : `Order at version ${projection.order.version} in the last read.`,
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
    const port = refundReturnPortFor(environment, { scenario });
    sessionRef.current = { port, controller: new RefundReturnController(port, { actorRef: REFUND_RETURN_DESK_ACTOR, orderRef }) };
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
          ? "No return was marked required. The order has no observed payment or a return is already marked."
          : "The source marked the right as due back. Return-required is its own state, not a refund.",
      );
      void current.controller.refresh();
    },
    deliverHeld() {
      const current = sessionRef.current;
      if (current === null) {
        return;
      }
      const count = current.port.deliverHeld();
      note(count === 0 ? "No held response to deliver." : `Delivered ${count} held response${count === 1 ? "" : "s"}.`);
    },
    deliverLate() {
      const current = sessionRef.current;
      if (current === null) {
        return;
      }
      const due = current.port.deliverLate();
      if (due.length === 0) {
        note("No late result is due.");
        return;
      }
      const lines = due.map((delivery) => {
        const outcome = current.controller.acceptLate(delivery);
        return outcome.kind === "RECORDED"
          ? `Late result ${delivery.result} recorded for ${delivery.intentRef}. The write stays unknown.`
          : `Late result for ${delivery.intentRef} was quarantined (${outcome.cause}).`;
      });
      note(lines.join(" "));
    },
    switchContext() {
      const current = sessionRef.current;
      if (current === null) {
        return;
      }
      const next = current.controller.switchContext();
      note(`Session context switched to ${next.actorRef}, session ${next.incarnation}. A write in flight is now unknown and its result will be quarantined. Read again.`);
    },
    newSession() {
      const current = sessionRef.current;
      if (current === null) {
        return;
      }
      sessionKeyRef.current = null;
      const port = refundReturnPortFor(environment, { scenario });
      sessionRef.current = {
        port,
        controller: new RefundReturnController(port, { actorRef: REFUND_RETURN_DESK_ACTOR, orderRef: current.controller.state().context.orderRef }),
      };
      intentCounter.current = 0;
      note("Started a new synthetic session. Earlier intents are gone, as after a reload. Nothing was resolved at a producer.");
      setTick((value) => value + 1);
    },
    setScenario(next) {
      setScenarioState(next);
      intentCounter.current = 0;
      note(`Started a new synthetic session with scenario ${next}. Earlier intents are gone, as after a reload.`);
    },
  };

  return {
    environment,
    scenario,
    orderRef,
    model: buildRefundReturnModel({ controller: session?.controller ?? null, last, hasOrder: orderRef !== null }),
    heldSupported: scenario === "held-response",
    lateSupported: scenario === "refund-lost",
    actions,
  };
}
