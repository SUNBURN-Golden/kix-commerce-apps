import { messages as sourceCopy } from "./i18n/messages/platform-release";
import { sourceMessage } from "./i18n/source-message";
import { connectivityPort, connectivityController, connectedActions } from "./connectivity/write-guard";
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
import { protocol } from "./connectivity/desk-protocol";

export const RELEASE_TITLE = sourceCopy.en["s18i"];

export const RELEASE_SOURCE_LINE =
  sourceCopy.en["s237"];

export const RELEASE_BOUNDARY =
  sourceCopy.en["s6i"];

export const RELEASE_RUN_NOTE =
  sourceCopy.en["s14f"];

export const RELEASE_ACTOR_NOTE =
  sourceCopy.en["s1px"];

export const RELEASE_PENDING_NOTE =
  sourceCopy.en["s1we"];

export const RELEASE_TUPLE_NOTE =
  sourceCopy.en["s1qq"];

export const SCENARIO_NOTES: Readonly<Record<ReleaseScenario, string>> = {
  clean: sourceCopy.en["s1xh"],
  held: sourceCopy.en["s1xj"],
  "read-lost": sourceCopy.en["s1xk"],
  "claims-pass": sourceCopy.en["s1uw"],
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
  none: sourceCopy.en["sxq"],
  "in-flight": sourceCopy.en["s6s"],
  ready: sourceCopy.en["s1wy"],
  rejected: sourceCopy.en["s1tt"],
  unknown: sourceCopy.en["s1ts"],
  refused: sourceCopy.en["s1xl"],
  "not-bound": sourceCopy.en["s1x0"],
  "tuple-changed": sourceCopy.en["s1vc"],
};

export function runResultLine(result: ReleaseRunResult): string {
  switch (result.kind) {
    case "CONFIRMED":
      return sourceCopy.en["s1f8"];
    case "REJECTED":
      return sourceMessage(sourceCopy.en["p.t334"], { v1: result.intent.code ?? "no code", v2: result.intent.message ?? "" }).trim();
    case "UNKNOWN":
      return sourceMessage(sourceCopy.en["p.t335"], { v1: result.intent.code ?? "no code" });
    case "QUARANTINED":
      return sourceCopy.en["s1xi"];
    case "FENCED":
      return sourceMessage(sourceCopy.en["p.t336"], { v1: releaseFenceLine(result.fence) });
    case "NOT_SENT":
      return sourceMessage(sourceCopy.en["p.t336"], { v1: result.detail });
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
    stateLine: sourceMessage(sourceCopy.en["p.t371"], { v1: packet.releaseState, v2: packet.environment, v3: packet.ruling }),
    releaseLine: sourceMessage(sourceCopy.en["p.t372"], { v1: packet.release.released, v2: packet.release.publicDeploy, v3: packet.release.realMoneyApproval, v4: packet.release.realOperationsStarted, v5: packet.release.note }),
    nonClaimsLine: Object.entries(packet.nonClaims)
      .map(([field, value]) => `${field} ${String(value)}`)
      .join(". "),
    candidateLines: [
      sourceMessage(sourceCopy.en["p.t373"], { v1: c.candidateId, v2: c.tupleKey.slice(0, 24) }),
      sourceMessage(sourceCopy.en["p.t374"], { v1: c.producer.contractOpenApiSha256, v2: c.producer.contractInfoVersion, v3: c.producer.gateOpenApiSha256, v4: c.producer.protocolMergeSha, v5: c.producer.protocolFeatureSha, v6: c.producer.sourceProtocolContractSha256, v7: c.producer.domain, v8: c.producer.pinnedActionCount }),
      sourceMessage(sourceCopy.en["p.t375"], { v1: c.producer.sdkDigest ?? "none", v2: c.producer.manifestDigest ?? "none", v3: c.producer.vectorDigest ?? "none", v4: c.producer.consumedProducerChange }),
      sourceMessage(sourceCopy.en["p.t376"], { v1: c.consumer.descriptor, v2: c.consumer.surfaces, v3: c.consumer.fixtureCatalogueVersion, v4: c.consumer.fixtureScreens }),
      sourceMessage(sourceCopy.en["p.t377"], { v1: c.artifact.kind, v2: c.artifact.package, v3: c.artifact.build, v4: c.artifact.digest ?? "none", v5: c.artifact.deployed, v6: c.artifact.note }),
      sourceMessage(sourceCopy.en["p.t378"], { v1: c.config.defaultMode, v2: c.config.httpModes.join(", "), v3: c.config.baseUrl, v4: c.config.oneAttempt, v5: c.config.retry, v6: c.config.idempotencyKey, v7: c.config.followRedirects, v8: c.config.stubFallback, v9: c.config.proxy, v10: c.config.uiFetch, v11: c.config.productionFlags, v12: c.config.truthFlags, v13: c.config.runtimeEnabled }),
    ],
    qualificationLines: [
      sourceMessage(sourceCopy.en["p.t379"], { v1: q.runOutcome, v2: q.packetId ? `, packet ${q.packetId}` : "", v3: q.qualificationState ? `, state ${q.qualificationState}` : "" }),
      q.journeys === null
        ? sourceCopy.en["sx9"]
        : sourceMessage(sourceCopy.en["p.t338"], { v1: q.journeys, v2: q.closed, v3: q.open, v4: q.blocked, v5: q.exercises, v6: q.recorded, v7: q.deviations, v8: q.classesCovered, v9: q.classesTotal }),
      sourceMessage(sourceCopy.en["p.t380"], { v1: q.technicalOnly, v2: q.acceptanceSeparated, v3: q.note }),
    ],
    acceptanceLine: sourceMessage(sourceCopy.en["p.t381"], { v1: packet.userAcceptance.state, v2: packet.userAcceptance.decidedBy, v3: packet.userAcceptance.realUserAcceptance, v4: packet.userAcceptance.technicalQualificationIsAcceptance, v5: packet.userAcceptance.note }),
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
        line: sourceMessage(sourceCopy.en["p.t566"], { v1: item.lane, v2: item.route, v3: item.module ? `, module ${item.module}` : "", v4: item.keptSeparate ? `; kept separate: ${item.keptSeparate.join(", ")}` : "", v5: item.note }),
      };
    }),
    pendingLine: sourceMessage(sourceCopy.en["p.t383"], { v1: PENDING_PRODUCERS.length }),
    denominators: packet.denominators.map((area) => ({
      area: area.area,
      line: sourceMessage(sourceCopy.en["p.t345"], { v1: area.unresolved, v2: area.denominator }),
      itemLines: area.items.map((item) => sourceMessage(sourceCopy.en["p.t346"], { v1: item.id, v2: item.note, v3: item.blockedBy })),
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
  port: ReleaseRunnerPort;
  controller: PlatformReleaseController;
}

function createSession(environment: "stub" | "integration-http", scenario: ReleaseScenario): Session {
  const port = connectivityPort(releaseRunnerPortFor(environment, { scenario }), "platform-release");
  return { port, controller: connectivityController(new PlatformReleaseController(port, { actorRef: RELEASE_DESK_ACTOR }), port) };
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
      const next = current === RELEASE_DESK_ACTOR ? RELEASE_GUEST_ACTOR : RELEASE_DESK_ACTOR;
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
  const model = buildReleaseModel(state, last, sessionRef.current.controller.gateFor("rel-next"));
  return {
    environment,
    scenario,
    model: { ...model, heldSupported: sessionRef.current.port.scenario === "held" },
    heldSupported: sessionRef.current.port.scenario === "held",
    actions: connectedActions(actions, ['run', 'setScenario', 'newSession'], sessionRef.current?.port),
  };
}

export { RELEASE_DECISION_ITEMS, RELEASE_DENOMINATOR_AREAS, RELEASE_HANDOFF_LANES, RELEASE_NOT_BOUND_REASON, RELEASE_RULING, RELEASE_SCENARIOS, RELEASE_STATE, PENDING_PRODUCERS };
