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

export const MARKETPLACE_BENCH_TITLE = "Marketplace scale bench (synthetic)";

export const MARKETPLACE_BENCH_SOURCE_LINE =
  "Listing rows, the queue view, the terms references, and the offered latencies come from a synthetic lazy stream of 150000 rows on this page load. They are not a producer read, not a marketplace receipt, and not a load test.";

export const MARKETPLACE_BENCH_BOUNDARY =
  "A row is a label set. It confirms no price, no right, no sale, and no ownership, and a fast page never confirms a stale price or a stale right: a read that stops being ready clears every row.";

export const MARKETPLACE_BENCH_BOUND_NOTE = `A read asks for at most ${MARKETPLACE_PAGE_BOUND} rows and a filter of at most 64 characters. A larger ask is refused, never clamped. The page keeps only the last ready window.`;

export const MARKETPLACE_BENCH_QUEUE_NOTE =
  "The contended page is behind a synthetic queue. Join and check are each one explicit call; nothing polls. Queue admission is browse access to that page only — never a hold, a payment, an issued right, or entry — and an expired admission grants nothing.";

export const MARKETPLACE_BENCH_READ_NOTE =
  "A read, a search, and a page are each one call. A cancelled read is never sent again and its late answer is counted, not applied. An answer older than the newest read, or one that lands after the actor, the device profile, or the session incarnation changed, is dropped and counted. A lost answer stays unknown.";

export const MARKETPLACE_BENCH_MEMORY_NOTE = `The memory denominator is the held window: at most ${MARKETPLACE_PAGE_BOUND} rows against the source's own total estimate of ${MARKETPLACE_TOTAL_LISTINGS}. The bound is the page size, not the stream length, and this denominator is never a producer load figure.`;

export const MARKETPLACE_BENCH_DEVICE_NOTE =
  "The desktop browser profile is the real device this page ran in. The small-viewport profile is emulation: it is never reported as real mobile evidence. No real handset or tablet ran in this session, so those classes stay unverified and are never filled with a desktop measurement.";

export const MARKETPLACE_BENCH_MEASURE_NOTE =
  "Every settled call is measured once at the browser boundary under its own workload and device labels. The denominator is browser-boundary-measurement only: the source's offeredMs is a separate label, no producer load figure is mixed in, and no row claims real-device evidence.";

export const MARKETPLACE_BENCH_HIDE_NOTE =
  "A hidden or greyed control is not enforcement. The source checks every read and queue call against the scope, the bounds, the cursor, the queue, and the terms, and the tests send requests straight to the port to prove a hidden control is never the check.";

export const MARKETPLACE_BENCH_SESSION_NOTE =
  "Reads, queue calls, and measurements live in this page load only. A reload or a new synthetic session clears them and resolves nothing at a producer.";

export const MARKETPLACE_BENCH_SYNTHETIC_CONTROL_NOTE =
  "The Simulate controls are synthetic controls a real producer does not offer. They stand in for a held answer delivered late, a lapsed queue admission, a permission revocation, and a terms move on the catalogue side.";

export const MARKETPLACE_BENCH_CLAIM_NOTE =
  "Every ready outcome states realDeviceEvidence and producerLoadMeasurement as false, and every row states confirmsPrice, confirmsRight, confirmsSale, and confirmsOwnership as false. A payload that says otherwise is refused whole before a row is shown.";

export const MARKETPLACE_BENCH_TUPLE_NOTE =
  "The port checks the pin tuple before the first row. A drifted tuple returns tuple-changed and clears the view; it is never shown as ready.";

export const MARKETPLACE_BENCH_SCENARIO_NOTES: Readonly<Record<MarketplaceScenario, string>> = {
  clean: "Every call is answered.",
  empty: "The source lists no listing for this scope.",
  stale: "The source serves a watermark older than the floor this page holds.",
  slow: "The source declares a long offered latency on every answer.",
  held: "Every answer waits for the synthetic deliver control.",
  contended: "The queue admits one position at a time.",
  "queue-lapsed": "The queue admission is already expired at the source.",
  "permission-lost": "The browse permission is revoked at the source.",
  "terms-moved": "The listing terms move under every read.",
  "read-lost": "The answer to a call never arrives.",
  "claims-price": "The source sends a payload that claims a row confirms a price. It is refused.",
  "claims-device": "The source sends a payload that claims real-device evidence. It is refused.",
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
  none: "No queue call yet",
  waiting: "Waiting",
  admitted: "Admitted",
  expired: "Expired",
  denied: "Denied",
  invalid: "Refused",
  "tuple-changed": "Tuple changed",
  "not-bound": "Not bound",
  unavailable: "Unavailable",
};

function statusFor(
  state: MarketplaceBenchScreenState,
  code: string | null,
  detail: string | null,
): { statusLine: string; detailLine: string } {
  const suffix = code ? ` (${code})` : "";
  switch (state) {
    case "loading":
      return { statusLine: "Reading the synthetic bench source. Nothing is shown yet.", detailLine: "" };
    case "ready":
      return { statusLine: "Bench window read.", detailLine: "" };
    case "empty":
      return {
        statusLine: "The source lists no listing for this scope in this read.",
        detailLine: detail ?? "An empty read is not denied and not unknown.",
      };
    case "stale":
      return { statusLine: "Stale read.", detailLine: detail ?? "" };
    case "terms-moved":
      return { statusLine: "The listing terms moved under this view.", detailLine: detail ?? "" };
    case "queue-blocked":
      return { statusLine: "The contended page is behind the queue.", detailLine: detail ?? "" };
    case "queue-expired":
      return { statusLine: "The queue admission expired at the source.", detailLine: detail ?? "" };
    case "denied":
      return {
        statusLine: `The source denied this call${suffix}.`,
        detailLine: `${detail ?? ""} No row is shown, and a hidden control was not what denied it.`,
      };
    case "refused":
      return {
        statusLine: `The source sent a payload this page does not trust${suffix}.`,
        detailLine: `${detail ?? ""} No row from it is shown.`,
      };
    case "gap":
      return {
        statusLine: `The stream broke its own sequence${suffix}.`,
        detailLine: `${detail ?? ""} No row from a gapped window is shown.`,
      };
    case "cursor-invalid":
      return { statusLine: `The cursor was refused${suffix}.`, detailLine: detail ?? "" };
    case "invalid":
      return { statusLine: `The request was refused before it read${suffix}.`, detailLine: detail ?? "" };
    case "tuple-changed":
      return {
        statusLine: "The pin tuple changed. Nothing was read and nothing was applied.",
        detailLine: detail ?? "",
      };
    case "not-bound":
      return { statusLine: MARKETPLACE_NOT_BOUND_REASON, detailLine: "" };
    case "unavailable":
      return {
        statusLine: "The source did not answer. This is not an empty market.",
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
      ? "The last read is current."
      : state.freshness === "STALE"
        ? "The last read is stale or moved. No row under it is shown."
        : "There is no usable read.";

  const context = state.context;
  const contextLine = `Environment ${context.environment}. Domain ${context.domain}. Actor ${context.actorRef} (a context label, not an authentication result). Tenant ${context.scope.tenantId}, subject ${context.scope.subject}. Device ${context.deviceClass}. Session incarnation ${context.incarnation}.`;

  const filterLine = snapshot
    ? `Filter "${snapshot.filter.text}" — the text the applied call carried, kept with this window.`
    : "No applied window. No filter is held.";

  const watermarkLine = snapshot
    ? `Watermark ${snapshot.watermark}. Revision ${snapshot.revision}. Terms ${snapshot.termsRef}.`
    : "No watermark is held.";

  const memoryLine = `Held rows ${state.memory.heldRows} of an estimated ${state.memory.totalEstimate}. Page bound ${state.memory.pageBound}.`;

  const inFlightLine =
    state.inFlight.length === 0
      ? "No call in flight."
      : `${state.inFlight.length} call${state.inFlight.length === 1 ? "" : "s"} in flight: ${state.inFlight
          .map((flight) => `${flight.call} seq ${flight.seq} (${flight.workload}, ${flight.deviceClass})`)
          .join("; ")}.`;

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
    stateWord: state.queue === null ? "No queue state" : PHASE_WORDS[state.queue.state] ?? state.queue.state,
    positionLine:
      state.queue?.position !== null && state.queue?.position !== undefined
        ? `Position ${state.queue.position}.`
        : null,
    admittedLine: state.queue?.admittedUntil ? `Admitted until ${state.queue.admittedUntil}.` : null,
    grantsLine:
      state.queue === null
        ? "No admission is held."
        : state.queue.grantsBrowseAccess
          ? "Grants browse access to the contended page. Never a hold, a payment, a right, or entry."
          : "Grants nothing. An expired or waiting admission is not browse access.",
    detailLine: state.queueDetail,
  };

  const reportRows: MarketplaceBenchReportModel[] = report.rows.map((row) => ({
    deviceClass: row.deviceClass,
    realDevice: row.realDevice,
    workload: row.workload,
    calls: row.calls,
    outcomeLine: `ready ${row.ready} · empty ${row.empty} · stale ${row.stale} · denied ${row.denied} · refused ${row.refused} · unknown ${row.unknown} · not-bound ${row.notBound} · dropped ${row.dropped} · cancelled ${row.cancelled} · other ${row.other}`,
    lastMeasuredMs: row.lastMeasuredMs,
    maxMeasuredMs: row.maxMeasuredMs,
    maxOfferedMs: row.maxOfferedMs,
  }));

  const last = state.last;
  const lastLine =
    last === null
      ? null
      : last.kind === "applied"
        ? `Call ${last.seq} (${last.call}) applied with outcome ${last.outcomeKind}.`
        : last.kind === "dropped"
          ? `Call ${last.seq} (${last.call}) dropped: ${last.cause}. Its answer was never applied.`
          : last.kind === "cancelled"
            ? `Call ${last.seq} (${last.call}) cancelled. Its late answer was counted, not applied.`
            : `Call ${last.seq} (${last.call}) not sent: ${last.reason}.`;

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
    countersLine: `reads ${state.counters.reads} · queue calls ${state.counters.queueCalls} · cancelled ${state.counters.cancelledReads} · dropped-context ${state.counters.droppedContext} · dropped-older ${state.counters.droppedOlder} · denied ${state.counters.denied} · refused ${state.counters.refused} · unknown ${state.counters.unknowns} · not-sent ${state.counters.notSent}`,
    lastLine,
    sessionLines: [
      MARKETPLACE_BENCH_SESSION_NOTE,
      MARKETPLACE_BENCH_HIDE_NOTE,
      MARKETPLACE_BENCH_CLAIM_NOTE,
      MARKETPLACE_BENCH_TUPLE_NOTE,
      `Ruling: ${MARKETPLACE_RULING}`,
      `Device classes ${MARKETPLACE_DEVICE_PROFILES.map((profile) => profile.deviceClass).join(", ")}. Unverified: ${MARKETPLACE_UNVERIFIED_DEVICES.join(", ")}.`,
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
