/**
 * The platform release candidate screen on top of the adapter's synthetic
 * release runner. Stub scope: the default port is the synthetic runner. On
 * integration-http the same port is not-bound: pending node c-platform-release
 * is not promoted, kix-protocol:k-platform-release is not merged, and this
 * module does not invent a connection, send a second attempt, or switch
 * adapters.
 *
 * This module computes nothing about release. It copies what the runner and
 * the controller hold: the pinned source and contract tuple, the artifact and
 * config record, the technical qualification record, the user-acceptance
 * state, the presented decisions, the five handoff lanes, and the final
 * denominators. A run is sent once per intent, and the packet it returns is a
 * record, never a release.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PlatformReleaseController,
  RELEASE_DECISION_ITEMS,
  RELEASE_DENOMINATOR_AREAS,
  RELEASE_DESK_ACTOR,
  RELEASE_GUEST_ACTOR,
  RELEASE_HANDOFF_LANES,
  RELEASE_NOT_BOUND_REASON,
  RELEASE_RULING,
  RELEASE_SCENARIOS,
  RELEASE_STATE,
  releaseFenceLine,
  releaseRunnerPortFor,
  type ReleaseControllerState,
  type ReleaseFence,
  type ReleasePacket,
  type ReleaseRunResult,
  type ReleaseRunnerPort,
  type ReleaseScenario,
} from "@kix/protocol-adapter";
import { PENDING_PRODUCERS } from "./handoff/packet";
import { protocol } from "./protocol";

export const RELEASE_TITLE = "Platform release candidate (synthetic)";

export const RELEASE_SOURCE_LINE =
  "This page assembles one synthetic release candidate packet over the stub scope on this page load. It is not a release, not a public deployment, and not a real-user acceptance.";

export const RELEASE_BOUNDARY =
  "A recorded candidate is never a release: UNKNOWN, NOT_BOUND, and STALE stay separate rows, and none is a success. The packet this run records is never promoted to a public deployment, a real-money approval, or real operations, and no decision is taken before the user RELEASE decision.";

export const RELEASE_RUN_NOTE =
  "One run is sent at a time and each is sent once. This page does not mint an intent for a re-send, does not retry a lost answer, and does not resolve an unknown run.";

export const RELEASE_ACTOR_NOTE =
  "The actor string is a context label. It is not an authentication result, and a run under a changed actor reuses nothing from the earlier context.";

export const RELEASE_PENDING_NOTE =
  "The real final review and operations handoff stays on pending node c-platform-release after kix-protocol:k-platform-release lands and the RELEASE gate and the user RELEASE decision are taken. This screen stands in for it at stub scope only.";

export const RELEASE_TUPLE_NOTE =
  "The candidate is scoped to the exact source and contract tuple it was built under. An approval or a packet recorded under a different UI or contract is never reused.";

export const SCENARIO_NOTES: Readonly<Record<ReleaseScenario, string>> = {
  clean: "The run answers with a recorded candidate packet.",
  held: "The run's answer is held until you deliver it. Use it to switch the actor while a run is in flight.",
  "read-lost": "The run's answer never arrives. The run stays in flight and later runs are fenced.",
  "claims-pass": "The packet claims a release and an acceptance it can never claim. The controller leaves the run unknown.",
};

export type ReleaseScreenState =
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

export interface DecisionModel {
  id: string;
  title: string;
  decision: string;
  basis: string;
  blockedBy: string | null;
  evidence: string[];
  note: string;
}

export interface DenominatorModel {
  area: string;
  line: string;
  itemLines: string[];
}

export interface LaneModel {
  lane: string;
  line: string;
}

export interface CheckModel {
  id: string;
  expected: string;
  observed: string;
  verdict: string;
  note: string;
}

export interface ReleasePacketModel {
  packetId: string;
  generatedAt: string;
  stateLine: string;
  releaseLine: string;
  nonClaimsLine: string;
  candidateLines: string[];
  qualificationLines: string[];
  acceptanceLine: string;
  decisions: DecisionModel[];
  lanes: LaneModel[];
  pendingLine: string;
  denominators: DenominatorModel[];
  checks: CheckModel[];
  boundaryNote: string;
}

export interface ReleaseModel {
  state: ReleaseScreenState;
  statusLine: string;
  detailLine: string | null;
  runControl: ControlModel;
  switchControl: ControlModel;
  heldSupported: boolean;
  packet: ReleasePacketModel | null;
  intentLines: string[];
  quarantineLines: string[];
  countersLine: string;
  contextLine: string;
  lastLine: string | null;
  lastNeedsFocus: boolean;
  lastSeq: number | null;
}

export type LastAction =
  | { seq: number; kind: "run"; result: ReleaseRunResult }
  | { seq: number; kind: "note"; text: string };

const STATE_LINES: Readonly<Record<ReleaseScreenState, string>> = {
  none: "No release run has been sent in this session.",
  "in-flight": "A release run is in flight. Its answer is applied here only if it correlates with the run that was sent.",
  ready: "The release candidate packet is recorded below. It states STUB_CANDIDATE_RECORDED and releases nothing.",
  rejected: "The last run was explicitly rejected. That is a refusal, not a failure of this page.",
  unknown: "The last run's result is unknown. It may have recorded a packet. Runs stay fenced; nothing retries it.",
  refused: "The run was refused before a packet was trusted. The refusal is recorded, not worked around.",
  "not-bound": "The release run is not bound on this environment.",
  "tuple-changed": "The pin tuple changed under the run. Nothing was applied and no earlier approval is reused.",
};

export function runResultLine(result: ReleaseRunResult): string {
  switch (result.kind) {
    case "CONFIRMED":
      return "Release run recorded a synthetic candidate packet. This is not a release and not a user acceptance.";
    case "REJECTED":
      return `Run refused (${result.intent.code ?? "no code"}). ${result.intent.message ?? ""}`.trim();
    case "UNKNOWN":
      return `Run result unknown (${result.intent.code ?? "no code"}). It may or may not have recorded a packet. Runs are blocked and nothing retries it.`;
    case "QUARANTINED":
      return "The run's answer arrived after the session context changed. It was quarantined and applied nowhere. The run stays unknown.";
    case "FENCED":
      return `Run not sent. ${releaseFenceLine(result.fence)}`;
    case "NOT_SENT":
      return `Run not sent. ${result.detail}`;
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

function packetModel(packet: ReleasePacket): ReleasePacketModel {
  const c = packet.candidate;
  const q = packet.qualification;
  return {
    packetId: packet.packetId,
    generatedAt: packet.generatedAt,
    stateLine: `Release state ${packet.releaseState}. Environment ${packet.environment}. Ruling ${packet.ruling}`,
    releaseLine: `Released ${packet.release.released}. Public deploy ${packet.release.publicDeploy}. Real-money approval ${packet.release.realMoneyApproval}. Real operations started ${packet.release.realOperationsStarted}. ${packet.release.note}`,
    nonClaimsLine: Object.entries(packet.nonClaims)
      .map(([field, value]) => `${field} ${String(value)}`)
      .join(". "),
    candidateLines: [
      `Candidate ${c.candidateId} recorded under tuple ${c.tupleKey.slice(0, 24)}… (the live pin tuple key; an approval under a different tuple is never reused).`,
      `Producer: contract OpenAPI ${c.producer.contractOpenApiSha256} at ${c.producer.contractInfoVersion}; gate OpenAPI ${c.producer.gateOpenApiSha256}; protocol merge ${c.producer.protocolMergeSha}; feature ${c.producer.protocolFeatureSha}; source contract ${c.producer.sourceProtocolContractSha256}; domain ${c.producer.domain}; ${c.producer.pinnedActionCount} pinned actions.`,
      `Producer digests: SDK ${c.producer.sdkDigest ?? "none"}, manifest ${c.producer.manifestDigest ?? "none"}, vector ${c.producer.vectorDigest ?? "none"}. Consumed producer change ${c.producer.consumedProducerChange}.`,
      `Consumer: ${c.consumer.descriptor} ${c.consumer.surfaces} surfaces on fixture catalogue v${c.consumer.fixtureCatalogueVersion} (${c.consumer.fixtureScreens} screens).`,
      `Artifact: ${c.artifact.kind} for ${c.artifact.package} built with ${c.artifact.build}; digest ${c.artifact.digest ?? "none"}; deployed ${c.artifact.deployed}. ${c.artifact.note}`,
      `Config: default mode ${c.config.defaultMode}; HTTP modes ${c.config.httpModes.join(", ")}; base ${c.config.baseUrl}; one attempt ${c.config.oneAttempt}; retry ${c.config.retry}; idempotency key ${c.config.idempotencyKey}; follow redirects ${c.config.followRedirects}; stub fallback ${c.config.stubFallback}; proxy ${c.config.proxy}; UI fetch ${c.config.uiFetch}; production flags ${c.config.productionFlags}; truth flags ${c.config.truthFlags}; runtime enabled ${c.config.runtimeEnabled}.`,
    ],
    qualificationLines: [
      `Sibling qualification run: ${q.runOutcome}${q.packetId ? `, packet ${q.packetId}` : ""}${q.qualificationState ? `, state ${q.qualificationState}` : ""}.`,
      q.journeys === null
        ? "No qualification packet was recorded; the record above is the whole outcome."
        : `${q.journeys} journeys (${q.closed} closed, ${q.open} open, ${q.blocked} blocked). ${q.exercises} exercises, ${q.recorded} recorded, ${q.deviations} deviations. ${q.classesCovered}/${q.classesTotal} exercise classes covered.`,
      `Technical only ${q.technicalOnly}. Acceptance separated ${q.acceptanceSeparated}. ${q.note}`,
    ],
    acceptanceLine: `User acceptance state ${packet.userAcceptance.state}, decided by the ${packet.userAcceptance.decidedBy}. Real user acceptance ${packet.userAcceptance.realUserAcceptance}. Technical qualification is acceptance ${packet.userAcceptance.technicalQualificationIsAcceptance}. ${packet.userAcceptance.note}`,
    decisions: packet.decisions.map((item) => ({
      id: item.id,
      title: item.title,
      decision: item.decision,
      basis: item.basis,
      blockedBy: item.blockedBy,
      evidence: [...item.evidence],
      note: item.note,
    })),
    lanes: RELEASE_HANDOFF_LANES.map((lane) => {
      const item = packet.opsHandoff[lane];
      return {
        lane,
        line: `${item.lane}: route ${item.route}${item.module ? `, module ${item.module}` : ""}${item.keptSeparate ? `; kept separate: ${item.keptSeparate.join(", ")}` : ""}. ${item.note}`,
      };
    }),
    pendingLine: `${PENDING_PRODUCERS.length} pending producers listed in PENDING_PRODUCERS.`,
    denominators: packet.denominators.map((area) => ({
      area: area.area,
      line: `${area.unresolved} unresolved of ${area.denominator} items on this area's own denominator.`,
      itemLines: area.items.map((item) => `${item.id} — ${item.note} (blocked by ${item.blockedBy})`),
    })),
    checks: packet.bindingChecks.map((check) => ({
      id: check.id,
      expected: check.expected,
      observed: check.observed,
      verdict: check.verdict,
      note: check.note,
    })),
    boundaryNote: packet.boundaryNote,
  };
}

function attentionFor(last: LastAction | null): boolean {
  if (last === null || last.kind === "note") {
    return false;
  }
  return last.result.kind !== "CONFIRMED";
}

export function buildReleaseModel(
  state: ReleaseControllerState,
  last: LastAction | null,
  fence: ReleaseFence | null = null,
): ReleaseModel {
  const runState = state.runState;
  const runControl: ControlModel = fence
    ? { enabled: false, reason: releaseFenceLine(fence) }
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
  port: ReleaseRunnerPort;
  controller: PlatformReleaseController;
}

function createSession(environment: "stub" | "integration-http", scenario: ReleaseScenario): Session {
  const port = releaseRunnerPortFor(environment, { scenario });
  return { port, controller: new PlatformReleaseController(port, { actorRef: RELEASE_DESK_ACTOR }) };
}

export interface ReleaseActions {
  run(): void;
  deliverHeld(): void;
  switchActor(): void;
  setScenario(next: ReleaseScenario): void;
  newSession(): void;
}

export function usePlatformRelease(): {
  environment: "stub" | "integration-http";
  scenario: ReleaseScenario;
  model: ReleaseModel;
  heldSupported: boolean;
  actions: ReleaseActions;
} {
  const environment = protocol.describe().environment;
  const sessionRef = useRef<Session | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createSession(environment, "clean");
  }
  const [scenario, setScenarioState] = useState<ReleaseScenario>("clean");
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
    return `rel-run-${intentCounter.current}`;
  }, []);

  const actions: ReleaseActions = {
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
      const next = current === RELEASE_DESK_ACTOR ? RELEASE_GUEST_ACTOR : RELEASE_DESK_ACTOR;
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
  const model = buildReleaseModel(state, last, sessionRef.current.controller.gateFor("rel-next"));
  return {
    environment,
    scenario,
    model: { ...model, heldSupported: sessionRef.current.port.scenario === "held" },
    heldSupported: sessionRef.current.port.scenario === "held",
    actions,
  };
}

export { RELEASE_DECISION_ITEMS, RELEASE_DENOMINATOR_AREAS, RELEASE_HANDOFF_LANES, RELEASE_NOT_BOUND_REASON, RELEASE_RULING, RELEASE_SCENARIOS, RELEASE_STATE, PENDING_PRODUCERS };
