import { messages as sourceCopy } from "./i18n/messages/marketplace-performance";
import { sourceMessage } from "./i18n/source-message";
/**
 * The marketplace scale bench on top of the adapter's synthetic bench port.
 * Stub scope: the default port is the synthetic lazy stream. On
 * integration-http the same port is not-bound — the contract-only catalogue
 * has no marketplace read, queue, or search command. This module does not
 * invent one, send a second attempt, or switch adapters. The page calls no
 * fetch of its own.
 *
 * This module decides no access and measures nothing itself. It copies what
 * the controller holds: every row is the source's own, the measured figure is
 * the controller's client-boundary clock, and the offered figure is the
 * source's own label. A row confirms no price, no right, no sale, and no
 * ownership. Queue admission is browse access to the contended page — never a
 * hold, a payment, an issued right, or entry. A desktop emulation profile is
 * never real mobile evidence, and no producer load figure is mixed into the
 * browser-boundary measurements.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MARKETPLACE_DEVICE_PROFILES,
  MARKETPLACE_NOT_BOUND_REASON,
  MARKETPLACE_PAGE_BOUND,
  MARKETPLACE_RULING,
  MARKETPLACE_SCENARIOS,
  MARKETPLACE_TOTAL_LISTINGS,
  MARKETPLACE_UNVERIFIED_DEVICES,
  MARKETPLACE_WORKLOADS,
  MarketplaceBenchController,
  marketplaceBenchPortFor,
  type MarketplaceBenchPort,
  type MarketplaceDeviceClass,
  type MarketplaceScenario,
  type MarketplaceSyntheticControl,
  type MarketplaceWorkload,
} from "@kix/protocol-adapter";
import { protocol } from "./protocol";

export const MARKETPLACE_BENCH_TITLE = sourceCopy.en["ss1"];

export const MARKETPLACE_BENCH_SOURCE_LINE =
  sourceCopy.en["sr5"];

export const MARKETPLACE_BENCH_BOUNDARY =
  sourceCopy.en["s7k"];

export const MARKETPLACE_BENCH_BOUND_NOTE = sourceMessage(sourceCopy.en["p.t288"], { v1: MARKETPLACE_PAGE_BOUND });

export const MARKETPLACE_BENCH_QUEUE_NOTE =
  "The contended page is behind a synthetic queue. Join and check are each one explicit call; nothing polls. Queue admission is browse access to that page only — never a hold, a payment, an issued right, or entry — and an expired admission grants nothing.";

export const MARKETPLACE_BENCH_READ_NOTE =
  sourceCopy.en["s6c"];

export const MARKETPLACE_BENCH_MEMORY_NOTE = sourceMessage(sourceCopy.en["p.t289"], { v1: MARKETPLACE_PAGE_BOUND, v2: MARKETPLACE_TOTAL_LISTINGS });

export const MARKETPLACE_BENCH_DEVICE_NOTE =
  sourceCopy.en["s1rw"];

export const MARKETPLACE_BENCH_MEASURE_NOTE =
  sourceCopy.en["sjo"];

export const MARKETPLACE_BENCH_HIDE_NOTE =
  sourceCopy.en["s2d"];

export const MARKETPLACE_BENCH_SESSION_NOTE =
  sourceCopy.en["s1c8"];

export const MARKETPLACE_BENCH_SYNTHETIC_CONTROL_NOTE =
  sourceCopy.en["s1y5"];

export const MARKETPLACE_BENCH_CLAIM_NOTE =
  sourceCopy.en["sjk"];

export const MARKETPLACE_BENCH_TUPLE_NOTE =
  sourceCopy.en["s1vd"];

export const MARKETPLACE_BENCH_SCENARIO_NOTES: Readonly<Record<MarketplaceScenario, string>> = {
  clean: sourceCopy.en["sj0"],
  empty: sourceCopy.en["s1zs"],
  stale: sourceCopy.en["s21a"],
  slow: sourceCopy.en["s1yq"],
  held: sourceCopy.en["siy"],
  contended: sourceCopy.en["s1vv"],
  "queue-lapsed": sourceCopy.en["s1vu"],
  "permission-lost": sourceCopy.en["s1qj"],
  "terms-moved": sourceCopy.en["s1u4"],
  "read-lost": sourceCopy.en["s1q2"],
  "claims-price": sourceCopy.en["s20z"],
  "claims-device": sourceCopy.en["s210"],
};

export const MARKETPLACE_BENCH_ACTORS = ["marketplace-bench", "marketplace-bench-2"] as const;

export type MarketplaceBenchScreenState =
  | "loading"
  | "ready"
  | "empty"
  | "stale"
  | "terms-moved"
  | "queue-blocked"
  | "queue-expired"
  | "denied"
  | "refused"
  | "gap"
  | "cursor-invalid"
  | "invalid"
  | "tuple-changed"
  | "not-bound"
  | "unavailable";

export interface MarketplaceBenchRowModel {
  sequence: number;
  listingRef: string;
  eventLabel: string;
  venueLabel: string;
  tier: string;
  status: string;
  termsRef: string;
  watermark: string;
}

export interface MarketplaceBenchQueueModel {
  phaseWord: string;
  stateWord: string;
  positionLine: string | null;
  admittedLine: string | null;
  grantsLine: string;
  detailLine: string | null;
}

export interface MarketplaceBenchReportModel {
  deviceClass: string;
  realDevice: boolean;
  workload: string;
  calls: number;
  outcomeLine: string;
  lastMeasuredMs: number | null;
  maxMeasuredMs: number | null;
  maxOfferedMs: number | null;
}

export interface MarketplaceBenchModel {
  state: MarketplaceBenchScreenState;
  statusLine: string;
  detailLine: string;
  freshnessWord: string;
  contextLine: string;
  filterLine: string;
  watermarkLine: string;
  memoryLine: string;
  inFlightLine: string;
  rows: MarketplaceBenchRowModel[];
  hasNextCursor: boolean;
  queue: MarketplaceBenchQueueModel;
  report: MarketplaceBenchReportModel[];
  unverified: { device: string; note: string }[];
  countersLine: string;
  lastLine: string | null;
  sessionLines: string[];
  focusToken: string | null;
}

const PHASE_WORDS: Readonly<Record<string, string>> = {
  none: sourceCopy.en["sxe"],
  waiting: sourceCopy.en["s265"],
  admitted: sourceCopy.en["s1q"],
  expired: sourceCopy.en["sk9"],
  denied: sourceCopy.en["sga"],
  invalid: sourceCopy.en["s1et"],
  "tuple-changed": sourceCopy.en["s24r"],
  "not-bound": sourceCopy.en["s10c"],
  unavailable: sourceCopy.en["s24z"],
};

function statusFor(
  state: MarketplaceBenchScreenState,
  code: string | null,
  detail: string | null,
): { statusLine: string; detailLine: string } {
  const suffix = code ? ` (${code})` : "";
  switch (state) {
    case "loading":
      return { statusLine: sourceCopy.en["s1bc"], detailLine: "" };
    case "ready":
      return { statusLine: sourceCopy.en["s9t"], detailLine: "" };
    case "empty":
      return {
        statusLine: sourceCopy.en["s1zt"],
        detailLine: detail ?? sourceCopy.en["s3z"],
      };
    case "stale":
      return { statusLine: sourceCopy.en["s1lw"], detailLine: detail ?? "" };
    case "terms-moved":
      return { statusLine: sourceCopy.en["s1u3"], detailLine: detail ?? "" };
    case "queue-blocked":
      return { statusLine: sourceCopy.en["s1r4"], detailLine: detail ?? "" };
    case "queue-expired":
      return { statusLine: sourceCopy.en["s1vt"], detailLine: detail ?? "" };
    case "denied":
      return {
        statusLine: sourceMessage(sourceCopy.en["p.t290"], { v1: suffix }),
        detailLine: sourceMessage(sourceCopy.en["p.t291"], { v1: detail ?? "" }),
      };
    case "refused":
      return {
        statusLine: sourceMessage(sourceCopy.en["p.t11"], { v1: suffix }),
        detailLine: sourceMessage(sourceCopy.en["p.t12"], { v1: detail ?? "" }),
      };
    case "gap":
      return {
        statusLine: sourceMessage(sourceCopy.en["p.t292"], { v1: suffix }),
        detailLine: sourceMessage(sourceCopy.en["p.t293"], { v1: detail ?? "" }),
      };
    case "cursor-invalid":
      return { statusLine: sourceMessage(sourceCopy.en["p.t294"], { v1: suffix }), detailLine: detail ?? "" };
    case "invalid":
      return { statusLine: sourceMessage(sourceCopy.en["p.t13"], { v1: suffix }), detailLine: detail ?? "" };
    case "tuple-changed":
      return {
        statusLine: sourceCopy.en["s1v8"],
        detailLine: detail ?? "",
      };
    case "not-bound":
      return { statusLine: MARKETPLACE_NOT_BOUND_REASON, detailLine: "" };
    case "unavailable":
      return {
        statusLine: sourceCopy.en["s1z5"],
        detailLine: detail ?? "",
      };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

export function buildMarketplaceModel(input: { controller: MarketplaceBenchController }): MarketplaceBenchModel {
  const { controller } = input;
  const state = controller.state();
  const screen: MarketplaceBenchScreenState = state.readState === "none" ? "loading" : state.readState;
  const status = statusFor(screen, state.readCode, state.readDetail);
  const snapshot = state.snapshot;
  const report = controller.measurementReport();

  const freshnessWord =
    state.freshness === "CURRENT"
      ? sourceCopy.en["s1tn"]
      : state.freshness === "STALE"
        ? sourceCopy.en["s1to"]
        : sourceCopy.en["s1wv"];

  const context = state.context;
  const contextLine = sourceMessage(sourceCopy.en["p.t295"], { v1: context.environment, v2: context.domain, v3: context.actorRef, v4: context.scope.tenantId, v5: context.scope.subject, v6: context.deviceClass, v7: context.incarnation });

  const filterLine = snapshot
    ? sourceMessage(sourceCopy.en["p.t296"], { v1: snapshot.filter.text })
    : sourceCopy.en["su4"];

  const watermarkLine = snapshot
    ? sourceMessage(sourceCopy.en["p.t541"], { v1: snapshot.watermark, v2: snapshot.revision, v3: snapshot.termsRef })
    : sourceCopy.en["s133"];

  const memoryLine = sourceMessage(sourceCopy.en["p.t297"], { v1: state.memory.heldRows, v2: state.memory.totalEstimate, v3: state.memory.pageBound });

  const inFlightLine =
    state.inFlight.length === 0
      ? sourceCopy.en["sue"]
      : sourceMessage(sourceCopy.en["p.t298"], { v1: state.inFlight.length, v2: state.inFlight.length === 1 ? "" : "s", v3: state.inFlight
          .map((flight) => `${flight.call} seq ${flight.seq} (${flight.workload}, ${flight.deviceClass})`)
          .join("; ") });

  const rows: MarketplaceBenchRowModel[] = (snapshot?.rows ?? []).map((row) => ({
    sequence: row.sequence,
    listingRef: row.listingRef,
    eventLabel: row.eventLabel,
    venueLabel: row.venueLabel,
    tier: row.tier,
    status: row.status,
    termsRef: row.termsRef,
    watermark: row.watermark,
  }));

  const queue: MarketplaceBenchQueueModel = {
    phaseWord: PHASE_WORDS[state.queuePhase] ?? state.queuePhase,
    stateWord: state.queue === null ? sourceCopy.en["sxf"] : PHASE_WORDS[state.queue.state] ?? state.queue.state,
    positionLine:
      state.queue?.position !== null && state.queue?.position !== undefined
        ? sourceMessage(sourceCopy.en["p.t543"], { v1: state.queue.position })
        : null,
    admittedLine: state.queue?.admittedUntil ? sourceMessage(sourceCopy.en["p.t299"], { v1: state.queue.admittedUntil }) : null,
    grantsLine:
      state.queue === null
        ? sourceCopy.en["stz"]
        : state.queue.grantsBrowseAccess
          ? sourceCopy.en["smu"]
          : sourceCopy.en["smx"],
    detailLine: state.queueDetail,
  };

  const reportRows: MarketplaceBenchReportModel[] = report.rows.map((row) => ({
    deviceClass: row.deviceClass,
    realDevice: row.realDevice,
    workload: row.workload,
    calls: row.calls,
    outcomeLine: sourceMessage(sourceCopy.en["p.t544"], { v1: row.ready, v2: row.empty, v3: row.stale, v4: row.denied, v5: row.refused, v6: row.unknown, v7: row.notBound, v8: row.dropped, v9: row.cancelled, v10: row.other }),
    lastMeasuredMs: row.lastMeasuredMs,
    maxMeasuredMs: row.maxMeasuredMs,
    maxOfferedMs: row.maxOfferedMs,
  }));

  const last = state.last;
  const lastLine =
    last === null
      ? null
      : last.kind === "applied"
        ? sourceMessage(sourceCopy.en["p.t300"], { v1: last.seq, v2: last.call, v3: last.outcomeKind })
        : last.kind === "dropped"
          ? sourceMessage(sourceCopy.en["p.t301"], { v1: last.seq, v2: last.call, v3: last.cause })
          : last.kind === "cancelled"
            ? sourceMessage(sourceCopy.en["p.t302"], { v1: last.seq, v2: last.call })
            : sourceMessage(sourceCopy.en["p.t303"], { v1: last.seq, v2: last.call, v3: last.reason });

  const focusToken =
    last !== null && last.kind !== "applied" ? `mperf-${last.seq}-${last.kind}` : null;

  return {
    state: screen,
    statusLine: status.statusLine,
    detailLine: status.detailLine,
    freshnessWord,
    contextLine,
    filterLine,
    watermarkLine,
    memoryLine,
    inFlightLine,
    rows,
    hasNextCursor: snapshot?.nextCursor !== null && snapshot?.nextCursor !== undefined,
    queue,
    report: reportRows,
    unverified: report.unverified.map((row) => ({ device: row.device, note: row.note })),
    countersLine: sourceMessage(sourceCopy.en["p.t304"], { v1: state.counters.reads, v2: state.counters.queueCalls, v3: state.counters.cancelledReads, v4: state.counters.droppedContext, v5: state.counters.droppedOlder, v6: state.counters.denied, v7: state.counters.refused, v8: state.counters.unknowns, v9: state.counters.notSent }),
    lastLine,
    sessionLines: [
      MARKETPLACE_BENCH_SESSION_NOTE,
      MARKETPLACE_BENCH_HIDE_NOTE,
      MARKETPLACE_BENCH_CLAIM_NOTE,
      MARKETPLACE_BENCH_TUPLE_NOTE,
      sourceMessage(sourceCopy.en["p.t545"], { v1: MARKETPLACE_RULING }),
      sourceMessage(sourceCopy.en["p.t305"], { v1: MARKETPLACE_DEVICE_PROFILES.map((profile) => profile.deviceClass).join(", "), v2: MARKETPLACE_UNVERIFIED_DEVICES.join(", ") }),
    ],
    focusToken,
  };
}

export interface MarketplaceBenchActions {
  refresh(): void;
  nextPage(): void;
  search(text: string): void;
  cancel(): void;
  joinQueue(): void;
  pollQueue(): void;
  switchActor(actor: string): void;
  switchDevice(device: MarketplaceDeviceClass): void;
  openSecondTab(): void;
  setWorkload(workload: MarketplaceWorkload): void;
  synthetic(control: MarketplaceSyntheticControl): void;
  setScenario(next: MarketplaceScenario): void;
  newSession(): void;
}

interface Session {
  port: MarketplaceBenchPort;
  controller: MarketplaceBenchController;
}

function createSession(
  environment: "stub" | "integration-http",
  scenario: MarketplaceScenario,
): Session {
  const port = marketplaceBenchPortFor(environment, { scenario });
  return { port, controller: new MarketplaceBenchController(port, {}) };
}

export function useMarketplaceBench(): {
  environment: "stub" | "integration-http";
  scenario: MarketplaceScenario;
  workload: MarketplaceWorkload;
  model: MarketplaceBenchModel;
  actions: MarketplaceBenchActions;
} {
  const environment = protocol.describe().environment;
  const sessionRef = useRef<Session | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createSession(environment, "clean");
  }
  const [scenario, setScenarioState] = useState<MarketplaceScenario>("clean");
  const [workload, setWorkloadState] = useState<MarketplaceWorkload>("browse-window");
  const [epoch, setEpoch] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    const session = sessionRef.current;
    if (session === null) {
      return undefined;
    }
    const off = session.controller.subscribe(() => setTick((value) => value + 1));
    void session.controller.read();
    return off;
  }, [epoch]);

  const startSession = useCallback(
    (next: MarketplaceScenario) => {
      sessionRef.current = createSession(environment, next);
      setScenarioState(next);
      setEpoch((value) => value + 1);
    },
    [environment],
  );

  const actions: MarketplaceBenchActions = {
    refresh() {
      void sessionRef.current?.controller.refresh();
    },
    nextPage() {
      void sessionRef.current?.controller.nextPage();
    },
    search(text) {
      void sessionRef.current?.controller.search(text);
    },
    cancel() {
      sessionRef.current?.controller.cancelReads();
    },
    joinQueue() {
      void sessionRef.current?.controller.joinQueue();
    },
    pollQueue() {
      void sessionRef.current?.controller.refreshQueue();
    },
    switchActor(actor) {
      sessionRef.current?.controller.switchActor(actor);
      void sessionRef.current?.controller.read();
    },
    switchDevice(device) {
      sessionRef.current?.controller.switchDevice(device);
      void sessionRef.current?.controller.read();
    },
    openSecondTab() {
      sessionRef.current?.controller.duplicateTab();
      void sessionRef.current?.controller.read();
    },
    setWorkload(workload) {
      sessionRef.current?.controller.setWorkload(workload);
      setWorkloadState(workload);
    },
    synthetic(control) {
      sessionRef.current?.port.synthetic(control);
    },
    setScenario(next) {
      if ((MARKETPLACE_SCENARIOS as readonly string[]).includes(next)) {
        startSession(next);
      }
    },
    newSession() {
      startSession(scenario);
    },
  };

  return {
    environment,
    scenario,
    workload,
    model: buildMarketplaceModel({ controller: sessionRef.current.controller }),
    actions,
  };
}

export { MARKETPLACE_WORKLOADS };
