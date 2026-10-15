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
import { protocol } from "./protocol";

export const QUALIFICATION_TITLE = "Platform operational qualification (synthetic)";

export const QUALIFICATION_SOURCE_LINE =
  "This page runs one synthetic qualification matrix over the stub surfaces on this page load. It is not a service qualification and not a real-user review.";

export const QUALIFICATION_BOUNDARY =
  "A per-call confirmed is never an end-to-end journey close. UNKNOWN, NOT_BOUND, and STALE stay separate rows, and none is a success. The packet this run records is never promoted to a public deployment, a real-money approval, or a service qualification.";

export const QUALIFICATION_RUN_NOTE =
  "One run is sent at a time and each is sent once. This page does not mint an intent for a re-send, does not retry a lost answer, and does not resolve an unknown run.";

export const QUALIFICATION_ACTOR_NOTE =
  "The actor string is a context label. It is not an authentication result, and a run under a changed actor reuses nothing from the earlier context.";

export const QUALIFICATION_PENDING_NOTE =
  "The real qualification stays on pending node c-platform-operational-qualification after kix-protocol:ps-07-scale-qualification, kix-protocol:cr-10-credit-qualification, and commerce-integration-closeout land. This screen stands in for it at stub scope only.";

export const SCENARIO_NOTES: Readonly<Record<QualificationScenario, string>> = {
  clean: "Every leg is answered. The packet records the whole matrix.",
  held: "The run's answer is held until you deliver it. Use it to switch the actor while a run is in flight.",
  "read-lost": "The run's answer never arrives. The run stays in flight and later runs are fenced.",
  "claims-pass": "The packet claims a promotion it can never claim. The controller leaves the run unknown.",
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
  success: "Normal",
  decline: "Decline",
  stale: "Stale",
  unknown: "Unknown",
  cancel: "Cancel",
  refund: "Refund",
  recovery: "Recovery",
  "permission-revocation": "Permission revocation",
};

const STATE_LINES: Readonly<Record<QualificationScreenState, string>> = {
  none: "No qualification run has been sent in this session.",
  "in-flight": "A qualification run is in flight. Its answer is applied here only if it correlates with the run that was sent.",
  ready: "The qualification packet is recorded below. It states STUB_RUN_RECORDED and claims nothing else.",
  rejected: "The last run was explicitly rejected. That is a refusal, not a failure of this page.",
  unknown: "The last run's result is unknown. It may have recorded a packet. Runs stay fenced; nothing retries it.",
  refused: "The run was refused before a packet was trusted. The refusal is recorded, not worked around.",
  "not-bound": "The qualification run is not bound on this environment.",
  "tuple-changed": "The pin tuple changed under the run. Nothing was applied.",
};

export function runResultLine(result: QualificationRunResult): string {
  switch (result.kind) {
    case "CONFIRMED":
      return "Qualification run recorded a synthetic packet. This is not a service qualification.";
    case "REJECTED":
      return `Run refused (${result.intent.code ?? "no code"}). ${result.intent.message ?? ""}`.trim();
    case "UNKNOWN":
      return `Run result unknown (${result.intent.code ?? "no code"}). It may or may not have recorded a packet. Runs are blocked and nothing retries it.`;
    case "QUARANTINED":
      return "The run's answer arrived after the session context changed. It was quarantined and applied nowhere. The run stays unknown.";
    case "FENCED":
      return `Run not sent. ${qualificationFenceLine(result.fence)}`;
    case "NOT_SENT":
      return `Run not sent. ${result.detail}`;
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
    stateLine: `Qualification state ${packet.qualificationState}. Environment ${packet.environment}. Ruling ${packet.ruling}`,
    summaryLine: `${s.journeys} journeys (${s.closed} closed, ${s.open} open, ${s.blocked} blocked). ${s.exercises} exercises, ${s.recorded} recorded, ${s.deviations} deviations. ${s.classesCovered}/${s.classesTotal} exercise classes covered.`,
    pinLines: [
      `Contract OpenAPI ${packet.pins.contractOpenApiSha256}`,
      `Gate OpenAPI ${packet.pins.gateOpenApiSha256}`,
      `Protocol merge ${packet.pins.protocolMergeSha}`,
      `SDK digest ${packet.pins.sdkDigest ?? "none"}. Manifest digest ${packet.pins.manifestDigest ?? "none"}. Vector digest ${packet.pins.vectorDigest ?? "none"}.`,
      `Consumed producer change ${packet.pins.consumedProducerChange ? "yes" : "no"}.`,
    ],
    promotionLine: `Promoted ${packet.promotion.promoted}. Public deploy ${packet.promotion.publicDeploy}. Real-money approval ${packet.promotion.realMoneyApproval}. Service qualification ${packet.promotion.serviceQualification}. ${packet.promotion.note}`,
    nonClaimsLine: Object.entries(packet.nonClaims)
      .map(([field, value]) => `${field} ${String(value)}`)
      .join(". "),
    journeys: packet.journeys.map((item) => ({
      id: item.id,
      title: item.title,
      surface: item.surface,
      actor: item.actor,
      verdict: item.verdict,
      verdictWord: item.verdict === "closed" ? "Closed on the whole sequence" : item.verdict === "open" ? "Open" : "Blocked",
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
      line: `${area.unresolved} unresolved of ${area.denominator} items on this area's own denominator.`,
      itemLines: area.items.map((item) => `${item.id} — ${item.note} (blocked by ${item.blockedBy})`),
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
      `Operational support: ${packet.opsBundle.opsSupport.diagnosis} at ${packet.opsBundle.opsSupport.route}. Kept separate: ${packet.opsBundle.opsSupport.keptSeparate.join(", ")}. ${packet.opsBundle.opsSupport.note}`,
      `Incident handoff: ${packet.opsBundle.incidentHandoff.packetModule} at ${packet.opsBundle.incidentHandoff.route}; ${packet.opsBundle.incidentHandoff.pendingProducers} pending producers listed. ${packet.opsBundle.incidentHandoff.note}`,
      `UI review material: fixture catalogue v${packet.opsBundle.uiReviewMaterial.fixtureVersion}, ${packet.opsBundle.uiReviewMaterial.fixtureScreens} screens, ${packet.opsBundle.uiReviewMaterial.surfacesDocumented} documented surfaces. ${packet.opsBundle.uiReviewMaterial.note}`,
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
      (item) => `#${item.seq} ${item.intentRef} — ${item.outcome}${item.code ? ` (${item.code})` : ""}${item.packetId ? ` packet ${item.packetId}` : ""}`,
    ),
    quarantineLines: state.quarantined.map(
      (item) => `${item.intentRef} — a ${item.arrived} answer arrived after the context changed and was quarantined.`,
    ),
    countersLine: `Sent ${state.counters.sent}. Fenced ${state.counters.fenced}. Not sent ${state.counters.notSent}.`,
    contextLine: `Environment ${state.context.environment}. Actor ${state.context.actorRef}. Session ${state.context.incarnation}.`,
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
        note("Held answers exist only in the held scenario. Nothing was delivered.");
        return;
      }
      const released = session.port.deliverHeld();
      note(`Delivered ${released} held answer(s).`);
    },
    switchActor() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const current = session.controller.state().context.actorRef;
      const next = current === QUALIFICATION_DESK_ACTOR ? QUALIFICATION_GUEST_ACTOR : QUALIFICATION_DESK_ACTOR;
      const context = session.controller.switchContext({ actorRef: next });
      note(`Session context switched to actor ${context.actorRef} (incarnation ${context.incarnation}). An in-flight run is now unknown.`);
    },
    setScenario(next) {
      sessionRef.current = createSession(environment, next);
      intentCounter.current = 0;
      setScenarioState(next);
      setEpoch((value) => value + 1);
      note(`New synthetic session under scenario ${next}. ${SCENARIO_NOTES[next]}`);
    },
    newSession() {
      sessionRef.current = createSession(environment, sessionRef.current?.port.scenario ?? "clean");
      intentCounter.current = 0;
      setEpoch((value) => value + 1);
      note("New synthetic session. The earlier intents and fences are gone with the last page state; nothing was recovered at a producer.");
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
