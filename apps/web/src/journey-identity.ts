/**
 * The synthetic journey context desk on top of the adapter's identity source.
 * Stub scope: the default port is the synthetic source. On integration-http
 * the same port is not-bound: the contract-only catalogue has no journey read
 * or evidence command, and this module does not invent one, send a second
 * attempt, or switch adapters.
 *
 * A session is bound to one context key — mode, actor, role, domain, source
 * cut generation, pin tuple, incarnation — all app-internal labels, never a
 * public identifier and never an authentication result. A read is judged row
 * by row: current observations may be shown, stale and foreign rows are never
 * this journey's evidence, and nothing is a proof of payment, issuance, or
 * admission.
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  JOURNEY_CONTEXT_FIELDS,
  JOURNEY_IDENTITY_DESK_ACTOR,
  JOURNEY_IDENTITY_NOT_BOUND_REASON,
  JOURNEY_IDENTITY_NOT_COMPOSED,
  JOURNEY_IDENTITY_PEER_ACTOR,
  JOURNEY_IDENTITY_ROLES,
  JOURNEY_IDENTITY_SCENARIOS,
  JourneyIdentityController,
  journeyIdentityPortFor,
  projectIdentity,
  type IdentityFence,
  type IdentityReadState,
  type IdentityRefreshCause,
  type IdentityStepResult,
  type JourneyIdentityPort,
  type JourneyIdentityScenario,
  type JourneyRole,
  type ObservationVerdict,
} from "@kix/protocol-adapter";
import { protocol } from "./protocol";

export const IDENTITY_TITLE = "Journey context (synthetic)";

export const IDENTITY_SOURCE_LINE =
  "Context rows and observations come from a synthetic source on this page load. They are not a producer read, not a protocol receipt, and never a proof of payment, issuance, or admission. Every row is labelled synthetic.";

export const IDENTITY_BOUNDARY =
  "The context key is an app-internal binding: mode, actor, role, domain, source cut generation, pin tuple, and session incarnation. It is not a public identifier, and the actor label is not an authentication result.";

export const IDENTITY_RULE_NOTE =
  "An observation binds to the cut it was minted on. A receipt also binds to the actor, role, and session that recorded it. A foreign or stale row is never evidence for this journey, and a read never resolves an unknown write.";

export const IDENTITY_SESSION_NOTE =
  "A stub reset keeps the journal: an earlier unknown write stays unknown and keeps fencing its subject. Intents live in this page load only and nothing is stored.";

export const IDENTITY_SCENARIO_NOTES: Readonly<Record<JourneyIdentityScenario, string>> = {
  clean: "Two ambient observations minted on the bound cut.",
  empty: "The source holds no items.",
  stale: "The source serves a watermark older than the floor this page holds.",
  "foreign-mix": "The read carries rows minted under another mode, domain, tuple, actor, and an earlier session.",
  "older-cut": "The read carries rows minted under older and newer cuts.",
  "claims-proof": "An item claims it proves a payment. The whole read is refused before a row shows.",
  "attach-lost": "An attach is applied and its answer is lost. The write stays unknown.",
  "held-response": "Answers are held until you deliver them.",
};

export type IdentityScreenState =
  | "loading"
  | "unread"
  | "ready"
  | "empty"
  | "stale"
  | "generation-moved"
  | "refused"
  | "not-bound"
  | "unavailable"
  | "tuple-changed";

export interface IdentityControl {
  enabled: boolean;
  reason: string | null;
}

export interface IdentityItemModel {
  itemId: string;
  kind: string;
  subjectRef: string;
  issuedLine: string;
  verdict: string;
  detail: string;
  attach: IdentityControl;
}

export interface IdentityIntentRow {
  seq: number;
  intentRef: string;
  outcome: string;
  code: string;
  scope: string;
  lateLine: string;
}

export interface IdentityContextRow {
  field: string;
  value: string;
}

export interface JourneyIdentityModel {
  state: IdentityScreenState;
  statusLine: string;
  detailLine: string;
  actionLabel: string | null;
  freshnessWord: string;
  contextRows: IdentityContextRow[];
  items: IdentityItemModel[];
  intents: IdentityIntentRow[];
  quarantineLines: string[];
  isolatedLines: string[];
  countersLine: string;
  notComposed: { action: string; reason: string }[];
  lastLine: string | null;
  lastNeedsFocus: boolean;
  lastSeq: number | null;
}

export function identityCauseLine(cause: IdentityRefreshCause): string {
  switch (cause) {
    case "own-write":
      return "Your own write landed after the last read.";
    case "stale-rejection":
      return "The source said the last read was behind.";
    case "context-switch":
      return "The session context changed.";
    case "source-reset":
      return "The synthetic source was reset.";
    case "generation-moved":
      return "The source moved to a new cut.";
    default: {
      const exhaustive: never = cause;
      return exhaustive;
    }
  }
}

/** Why a write is off. Each fence maps to one sentence. */
export function identityFenceLine(fence: IdentityFence): string {
  switch (fence.reason) {
    case "in-flight":
      return `Another write on this subject is in flight (${fence.intentRef}). Wait for its answer.`;
    case "unknown-outcome": {
      const late = fence.lateRecorded ? " A late result was recorded, and it does not make the write known." : "";
      const earlier = fence.earlierContext ? " It was sent in an earlier session context." : "";
      return `An earlier write on this subject has an unknown result (${fence.intentRef}).${late}${earlier} Writes on this subject stay blocked. A read does not resolve it.`;
    }
    case "no-snapshot":
      return "Read the context desk first.";
    case "snapshot-stale":
      return `Read again before the next write. ${identityCauseLine(fence.cause)}`;
    case "duplicate-intent":
      return `Intent ${fence.intentRef} was already used. This page does not send the same intent twice.`;
    case "not-current":
      return `Item ${fence.observationId} is ${fence.verdict} on this context. A stale or foreign row is never this journey's evidence.`;
    case "not-bound":
      return JOURNEY_IDENTITY_NOT_BOUND_REASON;
    default: {
      const exhaustive: never = fence;
      return exhaustive;
    }
  }
}

export function identityStepResultLine(result: IdentityStepResult): string {
  switch (result.kind) {
    case "CONFIRMED":
      return "Attach recorded by the synthetic source. This is a synthetic evidence record, not a producer receipt.";
    case "REJECTED":
      return `Attach rejected (${result.intent.code ?? "no code"}). ${result.intent.message ?? ""} The source applied nothing for this write.`.trim();
    case "UNKNOWN":
      return `Attach result unknown (${result.intent.code ?? "no code"}). It may or may not have applied. Writes on this subject are blocked, and neither a read nor a late result resolves it.`;
    case "QUARANTINED":
      return "The attach answer arrived after the session context changed. It was quarantined and applied nowhere. The write stays unknown.";
    case "FENCED":
      return `Attach not sent. ${identityFenceLine(result.fence)}`;
    case "NOT_SENT":
      return `Attach not sent. ${result.detail}`;
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

export type IdentityLastAction =
  | { seq: number; kind: "step"; result: IdentityStepResult }
  | { seq: number; kind: "note"; text: string };

function readStateToScreen(readState: IdentityReadState, refreshRequired: IdentityRefreshCause | null): IdentityScreenState {
  switch (readState) {
    case "none":
      return refreshRequired === null ? "loading" : "unread";
    case "ready":
      return "ready";
    case "empty":
      return "empty";
    case "stale":
      return "stale";
    case "generation-moved":
      return "generation-moved";
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

function statusFor(state: IdentityScreenState, detail: string | null): { statusLine: string; detailLine: string; actionLabel: string | null } {
  switch (state) {
    case "loading":
      return { statusLine: "Reading the synthetic context desk. Nothing is confirmed yet.", detailLine: "", actionLabel: null };
    case "unread":
      return {
        statusLine: "The session context changed, so there is no read in this context.",
        detailLine: "Read again to see the desk from this context. An earlier unknown write still blocks its subject.",
        actionLabel: "Read again",
      };
    case "ready":
      return { statusLine: "Context desk read.", detailLine: "", actionLabel: null };
    case "empty":
      return { statusLine: "No observations in this synthetic session.", detailLine: "Nothing can be attached.", actionLabel: "Read again" };
    case "stale":
      return { statusLine: "Stale context read.", detailLine: detail ?? "", actionLabel: "Read again" };
    case "generation-moved":
      return {
        statusLine: "The source moved to a new cut. This session stays bound to the earlier cut.",
        detailLine: `${detail ?? ""} Start a new synthetic session to bind the current cut.`,
        actionLabel: "Reset synthetic source",
      };
    case "refused":
      return { statusLine: "The read payload was refused whole before any row was shown.", detailLine: detail ?? "", actionLabel: "Reset synthetic source" };
    case "not-bound":
      return { statusLine: JOURNEY_IDENTITY_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return { statusLine: "The pin tuple changed. Nothing was read and nothing was applied.", detailLine: detail ?? "", actionLabel: "Reset synthetic source" };
    case "unavailable":
      return { statusLine: "The source did not answer. This is not an empty desk.", detailLine: detail ?? "", actionLabel: "Read again" };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function issuedLine(verdict: ObservationVerdict): string {
  const stamp = verdict.item.stamp;
  const who =
    verdict.item.kind === "receipt"
      ? `recorded by ${stamp.actorRef ?? "?"} as ${stamp.role ?? "?"} in session ${stamp.incarnation ?? "?"}`
      : "ambient";
  return `${stamp.environment} · ${stamp.domain} · cut ${stamp.cutGeneration} · ${who}`;
}

function tupleTag(tupleKey: string): string {
  const fields = tupleKey.split("|");
  return `merge ${fields[5]?.slice(0, 12) ?? "unknown"}…`;
}

/** The unused-intent id the gate preview asks with. It is never sent. */
const GATE_PREVIEW = "gate-preview";

export function buildIdentityModel(input: { controller: JourneyIdentityController | null; last: IdentityLastAction | null }): JourneyIdentityModel {
  const { controller } = input;
  const state = controller?.state() ?? null;
  const screen = state === null ? "loading" : readStateToScreen(state.readState, state.refreshRequired);
  const status = statusFor(screen, state?.readDetail ?? null);
  const projection = state === null ? null : projectIdentity(state);
  const freshnessWord =
    projection === null
      ? "There is no usable read."
      : projection.freshness === "CURRENT"
        ? "The last read is current."
        : projection.freshness === "STALE"
          ? "The last read is behind."
          : "There is no usable read.";

  const contextRows: IdentityContextRow[] =
    state === null
      ? []
      : [
          { field: "mode", value: state.context.environment },
          { field: "actor", value: `${state.context.actorRef} (a label, not authentication)` },
          { field: "role", value: state.context.role },
          { field: "domain", value: state.context.domain },
          { field: "source cut generation", value: String(state.context.cutGeneration) },
          { field: "pin tuple", value: `${tupleTag(state.context.tupleKey)} (app-internal)` },
          { field: "session incarnation", value: String(state.context.incarnation) },
        ];

  const items: IdentityItemModel[] = (state?.adjudications ?? []).map((verdict) => {
    const fence =
      controller === null || verdict.verdict !== "current"
        ? ({ reason: "not-current", observationId: verdict.item.itemId, verdict: verdict.verdict } as IdentityFence)
        : controller.gateFor({ observationId: verdict.item.itemId, intentRef: GATE_PREVIEW });
    const usable = verdict.verdict === "current" && fence === null;
    return {
      itemId: verdict.item.itemId,
      kind: verdict.item.kind,
      subjectRef: verdict.item.subjectRef,
      issuedLine: issuedLine(verdict),
      verdict: verdict.verdict,
      detail: verdict.detail,
      attach: usable
        ? { enabled: true, reason: null }
        : {
            enabled: false,
            reason:
              verdict.verdict !== "current"
                ? `Verdict ${verdict.verdict}. ${verdict.detail}`
                : fence === null
                  ? null
                  : identityFenceLine(fence),
          },
    };
  });

  const intents: IdentityIntentRow[] = (state?.intents ?? []).map((intent) => ({
    seq: intent.seq,
    intentRef: intent.intentRef,
    outcome: intent.outcome,
    code: intent.code ?? "",
    scope: intent.scope,
    lateLine: intent.late === null ? "" : `Late result ${intent.late.result}${intent.late.code ? ` (${intent.late.code})` : ""}. Evidence only.`,
  }));
  const quarantineLines = (state?.quarantined ?? []).map(
    (row) => `Result ${row.arrived} for ${row.intentRef} was quarantined (${row.cause}). It changed nothing.`,
  );
  const isolatedLines = (state?.isolated ?? []).map(
    (row) =>
      `Session ${row.incarnation} (${row.actorRef} as ${row.role}, cut ${row.cutGeneration}) was isolated (${row.cause}). ${row.unknownIntents} unknown write${row.unknownIntents === 1 ? "" : "s"} stay${row.unknownIntents === 1 ? "s" : ""} on record.`,
  );
  const counters = state?.counters ?? { sent: 0, fenced: 0, notSent: 0, droppedReads: 0 };

  let lastLine: string | null = null;
  if (input.last !== null) {
    lastLine = input.last.kind === "note" ? input.last.text : identityStepResultLine(input.last.result);
  }
  const lastNeedsFocus = input.last !== null && input.last.kind === "step" && input.last.result.kind !== "CONFIRMED";

  return {
    state: screen,
    statusLine: status.statusLine,
    detailLine: status.detailLine,
    actionLabel: status.actionLabel,
    freshnessWord,
    contextRows,
    items,
    intents,
    quarantineLines,
    isolatedLines,
    countersLine: `Sent ${counters.sent}. Blocked before sending ${counters.fenced}. Not sent ${counters.notSent}. Reads dropped ${counters.droppedReads}.`,
    notComposed: JOURNEY_IDENTITY_NOT_COMPOSED.map((entry) => ({ action: entry.action, reason: entry.reason })),
    lastLine,
    lastNeedsFocus,
    lastSeq: input.last === null ? null : input.last.seq,
  };
}

export const IDENTITY_CONTEXT_FIELDS = JOURNEY_CONTEXT_FIELDS;
export const IDENTITY_SCENARIOS = JOURNEY_IDENTITY_SCENARIOS;

export interface IdentityActions {
  refresh(): void;
  attach(observationId: string): void;
  switchActor(): void;
  switchRole(): void;
  rotateCut(): void;
  resetSource(): void;
  deliverHeld(): void;
  deliverLate(): void;
  setScenario(next: JourneyIdentityScenario): void;
}

interface IdentitySession {
  port: JourneyIdentityPort;
  controller: JourneyIdentityController;
}

export function useJourneyIdentityDesk(): {
  environment: "stub" | "integration-http";
  scenario: JourneyIdentityScenario;
  model: JourneyIdentityModel;
  heldSupported: boolean;
  lateSupported: boolean;
  actions: IdentityActions;
} {
  const environment = protocol.describe().environment;
  const sessionRef = useRef<IdentitySession | null>(null);
  const sessionKeyRef = useRef<string | null>(null);
  const [scenario, setScenarioState] = useState<JourneyIdentityScenario>("clean");
  const [, setTick] = useState(0);
  const [last, setLast] = useState<IdentityLastAction | null>(null);
  const intentCounter = useRef(0);
  const actionSeq = useRef(0);
  const actorRef = useRef<string>(JOURNEY_IDENTITY_DESK_ACTOR);
  const roleRef = useRef<JourneyRole>("operator");

  const wantedKey = `${environment}|${scenario}`;
  if (sessionKeyRef.current !== wantedKey) {
    const port = journeyIdentityPortFor(environment, { scenario });
    sessionRef.current = { port, controller: new JourneyIdentityController(port, { actorRef: actorRef.current, role: roleRef.current }) };
    sessionKeyRef.current = wantedKey;
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

  const run = useCallback(async (observationId: string) => {
    const current = sessionRef.current;
    if (current === null) {
      return;
    }
    intentCounter.current += 1;
    const result = await current.controller.run({ observationId, intentRef: `intent-${intentCounter.current}` });
    if (sessionRef.current !== current) {
      return;
    }
    actionSeq.current += 1;
    setLast({ seq: actionSeq.current, kind: "step", result });
    if (result.kind === "CONFIRMED" || result.kind === "REJECTED" || result.kind === "UNKNOWN") {
      await current.controller.refresh();
    }
  }, []);

  const actions: IdentityActions = {
    refresh() {
      void sessionRef.current?.controller.refresh();
    },
    attach(observationId) {
      void run(observationId);
    },
    switchActor() {
      const current = sessionRef.current;
      if (current === null) {
        return;
      }
      actorRef.current = actorRef.current === JOURNEY_IDENTITY_DESK_ACTOR ? JOURNEY_IDENTITY_PEER_ACTOR : JOURNEY_IDENTITY_DESK_ACTOR;
      const next = current.controller.switchContext({ actorRef: actorRef.current });
      note(`Session context switched to ${next.actorRef}, session ${next.incarnation}. A write in flight is now unknown and its result will be quarantined. Read again.`);
    },
    switchRole() {
      const current = sessionRef.current;
      if (current === null) {
        return;
      }
      const index = JOURNEY_IDENTITY_ROLES.indexOf(roleRef.current);
      roleRef.current = JOURNEY_IDENTITY_ROLES[(index + 1) % JOURNEY_IDENTITY_ROLES.length] ?? "operator";
      const next = current.controller.switchContext({ role: roleRef.current });
      note(`Session context switched to role ${next.role}, session ${next.incarnation}. A write in flight is now unknown and its result will be quarantined. Read again.`);
    },
    rotateCut() {
      const current = sessionRef.current;
      if (current === null || current.port.source === "none") {
        note("No synthetic source to rotate.");
        return;
      }
      const next = current.port.rotateCut();
      note(`The source moved to cut ${next}. This session stays bound to its earlier cut; read again to see the superseded state.`);
      void current.controller.refresh();
    },
    resetSource() {
      const current = sessionRef.current;
      if (current === null) {
        return;
      }
      const port = journeyIdentityPortFor(environment, { scenario });
      const next = current.controller.resetSource(port);
      note(`Started a new synthetic source and bound session ${next.incarnation} to cut ${next.cutGeneration}. Earlier unknown writes stay on record and keep fencing their subject.`);
      setTick((value) => value + 1);
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
    setScenario(next) {
      setScenarioState(next);
      intentCounter.current = 0;
      actorRef.current = JOURNEY_IDENTITY_DESK_ACTOR;
      roleRef.current = "operator";
      note(`Started a new synthetic session with scenario ${next}. Earlier intents are gone, as after a reload.`);
    },
  };

  return {
    environment,
    scenario,
    model: buildIdentityModel({ controller: session?.controller ?? null, last }),
    heldSupported: scenario === "held-response",
    lateSupported: scenario === "attach-lost",
    actions,
  };
}
