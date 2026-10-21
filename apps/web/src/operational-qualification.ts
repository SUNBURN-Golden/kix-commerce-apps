import { messages as sourceCopy } from "./i18n/messages/operational-qualification";
import { sourceMessage } from "./i18n/source-message";
/**
 * The platform operational qualification screen on top of the adapter's synthetic
 * qualification runner. Stub scope: the default port is the synthetic runner. On
 * integration-http the same port is not-bound: the pending node is not promoted,
 * kix-protocol:ps-07-scale-qualification and kix-protocol:cr-10-credit-qualification
 * are not merged, and this module does not invent a connection, send a second
 * attempt, or switch adapters.
 *
 * This module computes nothing about qualification. It copies what the runner and
 * the controller hold: journey verdicts, exercise records, the five denominators,
 * the per-scope evidence, the review candidates, and the ops bundle. A run is sent
 * once per intent, and the packet it returns is a record, never a promotion.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  OperationalQualificationController,
  QUALIFICATION_CLASSES,
  QUALIFICATION_DESK_ACTOR,
  QUALIFICATION_DENOMINATOR_AREAS,
  QUALIFICATION_EVIDENCE_SCOPES,
  QUALIFICATION_GUEST_ACTOR,
  QUALIFICATION_NOT_BOUND_REASON,
  QUALIFICATION_RULING,
  QUALIFICATION_SCENARIOS,
  QUALIFICATION_STATE,
  qualificationFenceLine,
  qualificationRunnerPortFor,
  type QualificationControllerState,
  type QualificationFence,
  type QualificationPacket,
  type QualificationRunResult,
  type QualificationRunnerPort,
  type QualificationScenario,
} from "@kix/protocol-adapter";
import { PENDING_PRODUCERS } from "./handoff/packet";
import { protocol } from "./protocol";

export const QUALIFICATION_TITLE = sourceCopy.en["s18g"];

export const QUALIFICATION_SOURCE_LINE =
  sourceCopy.en["s23d"];

export const QUALIFICATION_BOUNDARY =
  sourceCopy.en["s56"];

export const QUALIFICATION_RUN_NOTE =
  sourceCopy.en["s14f"];

export const QUALIFICATION_ACTOR_NOTE =
  sourceCopy.en["s1px"];

export const QUALIFICATION_PENDING_NOTE =
  sourceCopy.en["s1wf"];

export const SCENARIO_NOTES: Readonly<Record<QualificationScenario, string>> = {
  clean: sourceCopy.en["sj5"],
  held: sourceCopy.en["s1xj"],
  "read-lost": sourceCopy.en["s1xk"],
  "claims-pass": sourceCopy.en["s1uv"],
};

export type QualificationScreenState =
  | "none"
  | "in-flight"
  | "ready"
  | "rejected"
  | "unknown"
  | "refused"
  | "not-bound"
  | "tuple-changed";

export interface ControlModel {
  enabled: boolean;
  /** Why the control is off. Null when it is on. */
  reason: string | null;
}

export interface JourneyRowModel {
  id: string;
  title: string;
  surface: string;
  actor: string;
  verdict: string;
  verdictWord: string;
  reason: string;
  callLines: string[];
}

export interface ExerciseRowModel {
  id: string;
  klass: string;
  surface: string;
  verdict: string;
  expected: string;
  observed: string;
  note: string;
}

export interface DenominatorModel {
  area: string;
  line: string;
  itemLines: string[];
}

export interface EvidenceScopeModel {
  scope: string;
  headline: string;
  rows: { id: string; basis: string; note: string }[];
}

export interface CandidateModel {
  route: string;
  surface: string;
  focus: string;
  keyboard: string;
  note: string;
}

export interface PacketModel {
  packetId: string;
  generatedAt: string;
  stateLine: string;
  summaryLine: string;
  pinLines: string[];
  promotionLine: string;
  nonClaimsLine: string;
  journeys: JourneyRowModel[];
  exercises: ExerciseRowModel[];
  denominators: DenominatorModel[];
  evidence: EvidenceScopeModel[];
  candidates: CandidateModel[];
  opsLines: string[];
  boundaryNote: string;
}

export interface QualificationModel {
  state: QualificationScreenState;
  statusLine: string;
  detailLine: string | null;
  runControl: ControlModel;
  switchControl: ControlModel;
  heldSupported: boolean;
  packet: PacketModel | null;
  intentLines: string[];
  quarantineLines: string[];
  countersLine: string;
  contextLine: string;
  lastLine: string | null;
  lastNeedsFocus: boolean;
  lastSeq: number | null;
}

export type LastAction =
  | { seq: number; kind: "run"; result: QualificationRunResult }
  | { seq: number; kind: "note"; text: string };

const CLASS_WORDS: Readonly<Record<string, string>> = {
  success: sourceCopy.en["sy0"],
  decline: sourceCopy.en["sfm"],
  stale: sourceCopy.en["s1li"],
  unknown: sourceCopy.en["s258"],
  cancel: sourceCopy.en["saw"],
  refund: sourceCopy.en["s1ek"],
  recovery: sourceCopy.en["s1eb"],
  "permission-revocation": sourceCopy.en["s17y"],
};

const STATE_LINES: Readonly<Record<QualificationScreenState, string>> = {
  none: sourceCopy.en["sxb"],
  "in-flight": sourceCopy.en["s67"],
  ready: sourceCopy.en["s1vr"],
  rejected: sourceCopy.en["s1tt"],
  unknown: sourceCopy.en["s1ts"],
  refused: sourceCopy.en["s1xl"],
  "not-bound": sourceCopy.en["s1vs"],
  "tuple-changed": sourceCopy.en["s1vb"],
};

export function runResultLine(result: QualificationRunResult): string {
  switch (result.kind) {
    case "CONFIRMED":
      return sourceCopy.en["s1ak"];
    case "REJECTED":
      return sourceMessage(sourceCopy.en["p.t334"], { v1: result.intent.code ?? "no code", v2: result.intent.message ?? "" }).trim();
    case "UNKNOWN":
      return sourceMessage(sourceCopy.en["p.t335"], { v1: result.intent.code ?? "no code" });
    case "QUARANTINED":
      return sourceCopy.en["s1xi"];
    case "FENCED":
      return sourceMessage(sourceCopy.en["p.t336"], { v1: qualificationFenceLine(result.fence) });
    case "NOT_SENT":
      return sourceMessage(sourceCopy.en["p.t336"], { v1: result.detail });
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

function callLineOf(label: string, outcome: string, code: string | null, note: string): string {
  const codeText = code ? ` (${code})` : "";
  return `${label}: ${outcome}${codeText}${note ? ` — ${note}` : ""}`;
}

function packetModel(packet: QualificationPacket): PacketModel {
  const s = packet.summary;
  return {
    packetId: packet.packetId,
    generatedAt: packet.generatedAt,
    stateLine: sourceMessage(sourceCopy.en["p.t337"], { v1: packet.qualificationState, v2: packet.environment, v3: packet.ruling }),
    summaryLine: sourceMessage(sourceCopy.en["p.t338"], { v1: s.journeys, v2: s.closed, v3: s.open, v4: s.blocked, v5: s.exercises, v6: s.recorded, v7: s.deviations, v8: s.classesCovered, v9: s.classesTotal }),
    pinLines: [
      sourceMessage(sourceCopy.en["p.t339"], { v1: packet.pins.contractOpenApiSha256 }),
      sourceMessage(sourceCopy.en["p.t340"], { v1: packet.pins.gateOpenApiSha256 }),
      sourceMessage(sourceCopy.en["p.t341"], { v1: packet.pins.protocolMergeSha }),
      sourceMessage(sourceCopy.en["p.t342"], { v1: packet.pins.sdkDigest ?? "none", v2: packet.pins.manifestDigest ?? "none", v3: packet.pins.vectorDigest ?? "none" }),
      sourceMessage(sourceCopy.en["p.t343"], { v1: packet.pins.consumedProducerChange ? "yes" : "no" }),
    ],
    promotionLine: sourceMessage(sourceCopy.en["p.t344"], { v1: packet.promotion.promoted, v2: packet.promotion.publicDeploy, v3: packet.promotion.realMoneyApproval, v4: packet.promotion.serviceQualification, v5: packet.promotion.note }),
    nonClaimsLine: Object.entries(packet.nonClaims)
      .map(([field, value]) => `${field} ${String(value)}`)
      .join(". "),
    journeys: packet.journeys.map((item) => ({
      id: item.id,
      title: item.title,
      surface: item.surface,
      actor: item.actor,
      verdict: item.verdict,
      verdictWord: item.verdict === "closed" ? sourceCopy.en["scy"] : item.verdict === "open" ? sourceCopy.en["s14s"] : "Blocked",
      reason: item.reason,
      callLines: item.calls.map((leg) => callLineOf(leg.label, leg.outcome, leg.code, leg.note)),
    })),
    exercises: packet.exercises.map((item) => ({
      id: item.id,
      klass: `${CLASS_WORDS[item.klass] ?? item.klass} (${item.klass})`,
      surface: item.surface,
      verdict: item.verdict,
      expected: item.expected,
      observed: item.observed,
      note: item.note,
    })),
    denominators: packet.denominators.map((area) => ({
      area: area.area,
      line: sourceMessage(sourceCopy.en["p.t345"], { v1: area.unresolved, v2: area.denominator }),
      itemLines: area.items.map((item) => sourceMessage(sourceCopy.en["p.t346"], { v1: item.id, v2: item.note, v3: item.blockedBy })),
    })),
    evidence: packet.evidence.map((scope) => ({
      scope: scope.scope,
      headline: scope.headline,
      rows: scope.rows.map((row) => ({ id: row.id, basis: row.basis, note: row.note })),
    })),
    candidates: packet.reviewCandidates.map((item) => ({
      route: item.route,
      surface: item.surface,
      focus: item.focus,
      keyboard: item.keyboard,
      note: item.note,
    })),
    opsLines: [
      sourceMessage(sourceCopy.en["p.t347"], { v1: packet.opsBundle.opsSupport.diagnosis, v2: packet.opsBundle.opsSupport.route, v3: packet.opsBundle.opsSupport.keptSeparate.join(", "), v4: packet.opsBundle.opsSupport.note }),
      sourceMessage(sourceCopy.en["p.t348"], { v1: packet.opsBundle.incidentHandoff.packetModule, v2: packet.opsBundle.incidentHandoff.route, v3: PENDING_PRODUCERS.length, v4: packet.opsBundle.incidentHandoff.pendingProducerList, v5: packet.opsBundle.incidentHandoff.note }),
      sourceMessage(sourceCopy.en["p.t349"], { v1: packet.opsBundle.uiReviewMaterial.fixtureVersion, v2: packet.opsBundle.uiReviewMaterial.fixtureScreens, v3: packet.opsBundle.uiReviewMaterial.surfacesDocumented, v4: packet.opsBundle.uiReviewMaterial.note }),
    ],
    boundaryNote: packet.boundaryNote,
  };
}

function attentionFor(last: LastAction | null): boolean {
  if (last === null || last.kind === "note") {
    return false;
  }
  return last.result.kind !== "CONFIRMED";
}

export function buildQualificationModel(
  state: QualificationControllerState,
  last: LastAction | null,
  fence: QualificationFence | null = null,
): QualificationModel {
  const runState = state.runState;
  const runControl: ControlModel = fence
    ? { enabled: false, reason: qualificationFenceLine(fence) }
    : { enabled: true, reason: null };
  return {
    state: runState,
    statusLine: STATE_LINES[runState],
    detailLine: state.runDetail,
    runControl,
    switchControl: { enabled: true, reason: null },
    heldSupported: false,
    packet: state.packet === null ? null : packetModel(state.packet),
    intentLines: state.intents.map(
      (item) => `#${item.seq} ${item.intentRef} — ${item.outcome}${item.code ? ` (${item.code})` : ""}${item.packetId ? sourceMessage(sourceCopy.en["p.t556"], { v1: item.packetId }) : ""}`,
    ),
    quarantineLines: state.quarantined.map(
      (item) => sourceMessage(sourceCopy.en["p.t350"], { v1: item.intentRef, v2: item.arrived }),
    ),
    countersLine: sourceMessage(sourceCopy.en["p.t351"], { v1: state.counters.sent, v2: state.counters.fenced, v3: state.counters.notSent }),
    contextLine: sourceMessage(sourceCopy.en["p.t487"], { v1: state.context.environment, v2: state.context.actorRef, v3: state.context.incarnation }),
    lastLine: last === null ? null : last.kind === "note" ? last.text : runResultLine(last.result),
    lastNeedsFocus: attentionFor(last),
    lastSeq: last?.seq ?? null,
  };
}

interface Session {
  port: QualificationRunnerPort;
  controller: OperationalQualificationController;
}

function createSession(environment: "stub" | "integration-http", scenario: QualificationScenario): Session {
  const port = qualificationRunnerPortFor(environment, { scenario });
  return { port, controller: new OperationalQualificationController(port, { actorRef: QUALIFICATION_DESK_ACTOR }) };
}

export interface QualificationActions {
  run(): void;
  deliverHeld(): void;
  switchActor(): void;
  setScenario(next: QualificationScenario): void;
  newSession(): void;
}

export function useOperationalQualification(): {
  environment: "stub" | "integration-http";
  scenario: QualificationScenario;
  model: QualificationModel;
  heldSupported: boolean;
  actions: QualificationActions;
} {
  const environment = protocol.describe().environment;
  const sessionRef = useRef<Session | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createSession(environment, "clean");
  }
  const [scenario, setScenarioState] = useState<QualificationScenario>("clean");
  const [epoch, setEpoch] = useState(0);
  const [, setTick] = useState(0);
  const [last, setLast] = useState<LastAction | null>(null);
  const intentCounter = useRef(0);
  const actionSeq = useRef(0);

  useEffect(() => {
    const session = sessionRef.current;
    if (session === null) {
      return undefined;
    }
    return session.controller.subscribe(() => setTick((value) => value + 1));
  }, [epoch]);

  const note = useCallback((text: string) => {
    actionSeq.current += 1;
    setLast({ seq: actionSeq.current, kind: "note", text });
  }, []);

  const nextIntent = useCallback(() => {
    intentCounter.current += 1;
    return `oq-run-${intentCounter.current}`;
  }, []);

  const actions: QualificationActions = {
    run() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const intentRef = nextIntent();
      void session.controller.run(intentRef).then((result) => {
        if (sessionRef.current !== session) {
          return;
        }
        actionSeq.current += 1;
        setLast({ seq: actionSeq.current, kind: "run", result });
      });
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
    switchActor() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const current = session.controller.state().context.actorRef;
      const next = current === QUALIFICATION_DESK_ACTOR ? QUALIFICATION_GUEST_ACTOR : QUALIFICATION_DESK_ACTOR;
      const context = session.controller.switchContext({ actorRef: next });
      note(sourceMessage(sourceCopy.en["p.t352"], { v1: context.actorRef, v2: context.incarnation }));
    },
    setScenario(next) {
      sessionRef.current = createSession(environment, next);
      intentCounter.current = 0;
      setScenarioState(next);
      setEpoch((value) => value + 1);
      note(sourceMessage(sourceCopy.en["p.t79"], { v1: next, v2: SCENARIO_NOTES[next] }));
    },
    newSession() {
      sessionRef.current = createSession(environment, sessionRef.current?.port.scenario ?? "clean");
      intentCounter.current = 0;
      setEpoch((value) => value + 1);
      note(sourceCopy.en["stp"]);
    },
  };

  const state = sessionRef.current.controller.state();
  const model = buildQualificationModel(state, last, sessionRef.current.controller.gateFor("oq-next"));
  return {
    environment,
    scenario,
    model: { ...model, heldSupported: sessionRef.current.port.scenario === "held" },
    heldSupported: sessionRef.current.port.scenario === "held",
    actions,
  };
}

export { QUALIFICATION_CLASSES, QUALIFICATION_DENOMINATOR_AREAS, QUALIFICATION_EVIDENCE_SCOPES, QUALIFICATION_NOT_BOUND_REASON, QUALIFICATION_RULING, QUALIFICATION_SCENARIOS, QUALIFICATION_STATE };
