import { messages as sourceCopy } from "./i18n/messages/journey-identity";
import { sourceMessage } from "./i18n/source-message";
import { connectivityPort, connectivityController, connectedActions } from "./connectivity/write-guard";
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
import { protocol } from "./connectivity/desk-protocol";

export const IDENTITY_TITLE = sourceCopy.en["spg"];

export const IDENTITY_SOURCE_LINE =
  sourceCopy.en["seb"];

export const IDENTITY_BOUNDARY =
  sourceCopy.en["s1r5"];

export const IDENTITY_RULE_NOTE =
  sourceCopy.en["s4d"];

export const IDENTITY_SESSION_NOTE =
  sourceCopy.en["s8j"];

export const IDENTITY_SCENARIO_NOTES: Readonly<Record<JourneyIdentityScenario, string>> = {
  clean: sourceCopy.en["s24v"],
  empty: sourceCopy.en["s1zm"],
  stale: sourceCopy.en["s21a"],
  "foreign-mix": sourceCopy.en["s1vw"],
  "older-cut": sourceCopy.en["s1vx"],
  "claims-proof": sourceCopy.en["s4c"],
  "attach-lost": sourceCopy.en["s3o"],
  "held-response": sourceCopy.en["s4p"],
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
      return sourceCopy.en["s279"];
    case "stale-rejection":
      return sourceCopy.en["s20g"];
    case "context-switch":
      return sourceCopy.en["s1xw"];
    case "source-reset":
      return sourceCopy.en["s22b"];
    case "generation-moved":
      return sourceCopy.en["s201"];
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
      return sourceMessage(sourceCopy.en["p.t237"], { v1: fence.intentRef });
    case "unknown-outcome": {
      const late = fence.lateRecorded ? " A late result was recorded, and it does not make the write known." : "";
      const earlier = fence.earlierContext ? " It was sent in an earlier session context." : "";
      return sourceMessage(sourceCopy.en["p.t238"], { v1: fence.intentRef, v2: late, v3: earlier });
    }
    case "no-snapshot":
      return sourceCopy.en["s1ci"];
    case "snapshot-stale":
      return sourceMessage(sourceCopy.en["p.t86"], { v1: identityCauseLine(fence.cause) });
    case "duplicate-intent":
      return sourceMessage(sourceCopy.en["p.t87"], { v1: fence.intentRef });
    case "not-current":
      return sourceMessage(sourceCopy.en["p.t239"], { v1: fence.observationId, v2: fence.verdict });
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
      return sourceCopy.en["s8z"];
    case "REJECTED":
      return sourceMessage(sourceCopy.en["p.t240"], { v1: result.intent.code ?? "no code", v2: result.intent.message ?? "" }).trim();
    case "UNKNOWN":
      return sourceMessage(sourceCopy.en["p.t241"], { v1: result.intent.code ?? "no code" });
    case "QUARANTINED":
      return sourceCopy.en["s1qd"];
    case "FENCED":
      return sourceMessage(sourceCopy.en["p.t242"], { v1: identityFenceLine(result.fence) });
    case "NOT_SENT":
      return sourceMessage(sourceCopy.en["p.t242"], { v1: result.detail });
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
      return { statusLine: sourceCopy.en["s1bd"], detailLine: "", actionLabel: null };
    case "unread":
      return {
        statusLine: sourceCopy.en["s1xx"],
        detailLine: sourceCopy.en["s1az"],
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "ready":
      return { statusLine: sourceCopy.en["sea"], detailLine: "", actionLabel: null };
    case "empty":
      return { statusLine: sourceCopy.en["swg"], detailLine: sourceCopy.en["s112"], actionLabel: sourceCopy.en["s1ax"] };
    case "stale":
      return { statusLine: sourceCopy.en["s1lk"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    case "generation-moved":
      return {
        statusLine: sourceCopy.en["s202"],
        detailLine: sourceMessage(sourceCopy.en["p.t243"], { v1: detail ?? "" }),
        actionLabel: sourceCopy.en["s1gc"],
      };
    case "refused":
      return { statusLine: sourceCopy.en["s1w9"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1gc"] };
    case "not-bound":
      return { statusLine: JOURNEY_IDENTITY_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return { statusLine: sourceCopy.en["s1v8"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1gc"] };
    case "unavailable":
      return { statusLine: sourceCopy.en["s1z3"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
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
      ? sourceMessage(sourceCopy.en["p.t244"], { v1: stamp.actorRef ?? "?", v2: stamp.role ?? "?", v3: stamp.incarnation ?? "?" })
      : "ambient";
  return sourceMessage(sourceCopy.en["p.t534"], { v1: stamp.environment, v2: stamp.domain, v3: stamp.cutGeneration, v4: who });
}

function tupleTag(tupleKey: string): string {
  const fields = tupleKey.split("|");
  return sourceMessage(sourceCopy.en["p.t535"], { v1: fields[5]?.slice(0, 12) ?? "unknown" });
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
      ? sourceCopy.en["s1wv"]
      : projection.freshness === "CURRENT"
        ? sourceCopy.en["s1tn"]
        : projection.freshness === "STALE"
          ? sourceCopy.en["s1ti"]
          : sourceCopy.en["s1wv"];

  const contextRows: IdentityContextRow[] =
    state === null
      ? []
      : [
          { field: "mode", value: state.context.environment },
          { field: "actor", value: sourceMessage(sourceCopy.en["p.t245"], { v1: state.context.actorRef }) },
          { field: "role", value: state.context.role },
          { field: "domain", value: state.context.domain },
          { field: sourceCopy.en["s1l6"], value: String(state.context.cutGeneration) },
          { field: sourceCopy.en["s189"], value: sourceMessage(sourceCopy.en["p.t536"], { v1: tupleTag(state.context.tupleKey) }) },
          { field: sourceCopy.en["s1jo"], value: String(state.context.incarnation) },
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
                ? sourceMessage(sourceCopy.en["p.t537"], { v1: verdict.verdict, v2: verdict.detail })
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
    lateLine: intent.late === null ? "" : sourceMessage(sourceCopy.en["p.t195"], { v1: intent.late.result, v2: intent.late.code ? ` (${intent.late.code})` : "" }),
  }));
  const quarantineLines = (state?.quarantined ?? []).map(
    (row) => sourceMessage(sourceCopy.en["p.t122"], { v1: row.arrived, v2: row.intentRef, v3: row.cause }),
  );
  const isolatedLines = (state?.isolated ?? []).map(
    (row) =>
      sourceMessage(sourceCopy.en["p.t246"], { v1: row.incarnation, v2: row.actorRef, v3: row.role, v4: row.cutGeneration, v5: row.cause, v6: row.unknownIntents, v7: row.unknownIntents === 1 ? "" : "s", v8: row.unknownIntents === 1 ? "s" : "" }),
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
    countersLine: sourceMessage(sourceCopy.en["p.t206"], { v1: counters.sent, v2: counters.fenced, v3: counters.notSent, v4: counters.droppedReads }),
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

export interface IdentitySession {
  port: JourneyIdentityPort;
  controller: JourneyIdentityController;
}

/** Applies a scenario by rebinding the same session to a fresh synthetic source, so the journal and its unknown fences stay. */
export function applyIdentityScenario(session: IdentitySession, environment: "stub" | "integration-http", scenario: JourneyIdentityScenario) {
  return resetIdentitySession(session, connectivityPort(journeyIdentityPortFor(environment, { scenario }), "journey-identity"));
}

/** Rebinds the page and its controller to one new source, so page actions never act on a discarded source. */
export function resetIdentitySession(session: IdentitySession, port: JourneyIdentityPort) {
  connectivityController(session.controller, port);
  const next = session.controller.resetSource(port);
  session.port = port;
  return next;
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

  const wantedKey = environment;
  if (sessionKeyRef.current !== wantedKey) {
    const port = connectivityPort(journeyIdentityPortFor(environment, { scenario }), "journey-identity");
    sessionRef.current = { port, controller: connectivityController(new JourneyIdentityController(port, { actorRef: actorRef.current, role: roleRef.current }), port) };
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
      note(sourceMessage(sourceCopy.en["p.t247"], { v1: next.actorRef, v2: next.incarnation }));
    },
    switchRole() {
      const current = sessionRef.current;
      if (current === null) {
        return;
      }
      const index = JOURNEY_IDENTITY_ROLES.indexOf(roleRef.current);
      roleRef.current = JOURNEY_IDENTITY_ROLES[(index + 1) % JOURNEY_IDENTITY_ROLES.length] ?? "operator";
      const next = current.controller.switchContext({ role: roleRef.current });
      note(sourceMessage(sourceCopy.en["p.t248"], { v1: next.role, v2: next.incarnation }));
    },
    rotateCut() {
      const current = sessionRef.current;
      if (current === null || current.port.source === "none") {
        note(sourceCopy.en["sz0"]);
        return;
      }
      const next = current.port.rotateCut();
      note(sourceMessage(sourceCopy.en["p.t249"], { v1: next }));
      void current.controller.refresh();
    },
    resetSource() {
      const current = sessionRef.current;
      if (current === null) {
        return;
      }
      const next = applyIdentityScenario(current, environment, scenario);
      // Earlier unknowns keep fencing their subject because the deterministic stub seed repeats subject refs.
      note(sourceMessage(sourceCopy.en["p.t250"], { v1: next.incarnation, v2: next.cutGeneration }));
      setTick((value) => value + 1);
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
    setScenario(next) {
      const current = sessionRef.current;
      if (current === null) {
        return;
      }
      const bound = applyIdentityScenario(current, environment, next);
      setScenarioState(next);
      note(sourceMessage(sourceCopy.en["p.t251"], { v1: next, v2: bound.incarnation, v3: bound.cutGeneration }));
      void current.controller.refresh();
    },
  };

  return {
    environment,
    scenario,
    model: buildIdentityModel({ controller: session?.controller ?? null, last }),
    heldSupported: scenario === "held-response",
    lateSupported: scenario === "attach-lost",
    actions: connectedActions(actions, ['attach', 'rotateCut', 'resetSource', 'setScenario'], sessionRef.current?.port),
  };
}
