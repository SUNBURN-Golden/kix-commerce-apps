import { connectedActions } from "./connectivity/write-guard";
/**
 * The discovery projection read on top of the adapter's bounded port.
 * Stub scope: the default port is the synthetic stream. On integration-http
 * the same port is not-bound — the contract-only catalogue has no read
 * command, and this module does not invent one, retry, or switch adapters.
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 * This module posts nothing and reads no clock.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DISCOVERY_DESK_SCOPE,
  DISCOVERY_PROJECTION_REVISION,
  DISCOVERY_READ_PAGE_BOUND,
  DISCOVERY_READ_TENANT,
  EMPTY_DISCOVERY_FILTER,
  discoveryReadPortFor,
  type DiscoveryProjectionRow,
  type DiscoveryReadCursor,
  type DiscoveryReadFilter,
  type DiscoveryReadOutcome,
  type DiscoveryReadPort,
  type DiscoveryRowOutcome,
  type DiscoveryStreamKind,
} from "@kix/protocol-adapter";
import { formatWhen } from "./format";
import { protocol } from "./connectivity/desk-protocol";

export const LIVE_READ_TITLE = "Projection read (synthetic)";

export const LIVE_READ_SOURCE_LINE =
  "Rows come from a synthetic projection stream on this page load. They are not a producer read and not a catalogue receipt.";

export const LIVE_READ_BOUNDARY =
  "A projection row confirms no sale, no ownership, and no payment. Trade commands re-check on their own path.";

export const LIVE_READ_SCOPE_NOTE = `Access scope ${DISCOVERY_READ_TENANT}. The subject string is not an authentication result.`;

export const LIVE_READ_PAGE_NOTE = `One bounded page per click, at most ${DISCOVERY_READ_PAGE_BOUND} rows. The stream never arrives as one response.`;

export const LIVE_READ_REBUILD_LABEL = "Rebuild projection";

export type LiveOutcome = DiscoveryReadOutcome | { kind: "loading" };

export type LiveReturnMode = "resync" | "again" | "first";

export interface LiveListModel {
  stream: DiscoveryStreamKind;
  revision: string;
  filter: DiscoveryReadFilter;
  state: LiveOutcome["kind"];
  statusLine: string;
  detailLine: string;
  metaLine: string;
  rows: readonly DiscoveryProjectionRow[];
  canNext: boolean;
  actionLabel: string | null;
}

export interface LiveListHandlers {
  nextPage(): void;
  runReturn(): void;
  setStream(stream: DiscoveryStreamKind): void;
  setFilter(filter: DiscoveryReadFilter): void;
  rebuildProjection(): void;
}

export interface LiveDetailModel {
  state: (DiscoveryRowOutcome | { kind: "loading" })["kind"];
  statusLine: string;
  detailLine: string;
  actionLabel: string | null;
  row: DiscoveryProjectionRow | null;
}

export interface LiveDetailHandlers {
  readAgain(): void;
}

/** The user return action each read failure maps to. */
export function liveReturnMode(outcome: LiveOutcome | DiscoveryRowOutcome): LiveReturnMode | null {
  switch (outcome.kind) {
    case "gap":
    case "tenant-mismatch":
    case "tuple-changed":
      return "resync";
    case "stale":
    case "unknown":
      return "again";
    case "cursor-invalid":
    case "invalid-request":
      return "first";
    case "ready":
    case "empty":
    case "not-bound":
    case "loading":
      return null;
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}

export function liveReturnLabel(mode: LiveReturnMode): string {
  if (mode === "resync") {
    return "Start over";
  }
  if (mode === "again") {
    return "Read again";
  }
  return "Back to first page";
}

export function liveStatusLine(outcome: LiveOutcome | DiscoveryRowOutcome): {
  statusLine: string;
  detailLine: string;
} {
  switch (outcome.kind) {
    case "loading":
      return { statusLine: "Loading projection rows.", detailLine: "" };
    case "ready":
      return { statusLine: "Projection page ready.", detailLine: "" };
    case "empty":
      return { statusLine: "No projection rows on this stream.", detailLine: "" };
    case "gap":
      return { statusLine: `Gap in the synthetic stream (${outcome.code}).`, detailLine: outcome.detail };
    case "stale":
      return {
        statusLine: "Stale projection watermark.",
        detailLine: `watermark ${formatWhen(outcome.watermark)}. floor ${formatWhen(outcome.floor)}.`,
      };
    case "cursor-invalid":
      return { statusLine: `Cursor invalid (${outcome.code}).`, detailLine: outcome.detail };
    case "tenant-mismatch":
      return {
        statusLine: "A row from another tenant arrived.",
        detailLine: `row ${outcome.rowId}. tenant ${outcome.tenantId}.`,
      };
    case "tuple-changed":
      return {
        statusLine: `Projection tuple changed (${outcome.field}).`,
        detailLine: `expected ${outcome.expected}. actual ${outcome.actual}.`,
      };
    case "not-bound":
      return { statusLine: outcome.reason, detailLine: "" };
    case "invalid-request":
      return { statusLine: `Blocked read (${outcome.code}).`, detailLine: outcome.detail };
    case "unknown":
      return { statusLine: "Unknown read.", detailLine: outcome.message };
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}

export function buildLiveListModel(input: {
  stream: DiscoveryStreamKind;
  revision: string;
  filter: DiscoveryReadFilter;
  outcome: LiveOutcome;
  canNext: boolean;
}): LiveListModel {
  const { outcome } = input;
  const { statusLine, detailLine } = liveStatusLine(outcome);
  const mode = liveReturnMode(outcome);
  let metaLine = `stream ${input.stream}. revision ${input.revision}.`;
  if (outcome.kind === "ready") {
    metaLine = `${metaLine} watermark ${outcome.watermark ? formatWhen(outcome.watermark) : "none"}. scanned ${outcome.scannedCount}. about ${outcome.totalEstimate} rows in the stream.`;
  } else if (outcome.kind === "empty") {
    metaLine = `${metaLine} about ${outcome.totalEstimate} rows in the stream.`;
  }
  return {
    stream: input.stream,
    revision: input.revision,
    filter: input.filter,
    state: outcome.kind,
    statusLine,
    detailLine,
    metaLine,
    rows: outcome.kind === "ready" ? outcome.rows : [],
    canNext: input.canNext,
    actionLabel: mode === null ? null : liveReturnLabel(mode),
  };
}

export function buildLiveDetailModel(input: {
  outcome: DiscoveryRowOutcome | { kind: "loading" };
}): LiveDetailModel {
  const { outcome } = input;
  const { statusLine, detailLine } =
    outcome.kind === "empty"
      ? { statusLine: "No projection row for this id.", detailLine: "" }
      : liveStatusLine(outcome);
  const mode = outcome.kind === "empty" ? null : liveReturnMode(outcome);
  return {
    state: outcome.kind,
    statusLine,
    detailLine,
    actionLabel: mode === null ? null : "Read again",
    row: outcome.kind === "ready" ? outcome.row : null,
  };
}

function raiseFloor(current: string | null, watermark: string | null): string | null {
  if (watermark === null || Number.isNaN(Date.parse(watermark))) {
    return current;
  }
  if (current === null || Date.parse(watermark) > Date.parse(current)) {
    return watermark;
  }
  return current;
}

export function useDiscoveryLiveRead(options: { rowId: string | null; detailEnabled: boolean }): {
  listModel: LiveListModel;
  listHandlers: LiveListHandlers;
  detailModel: LiveDetailModel;
  detailHandlers: LiveDetailHandlers;
} {
  const environment = protocol.describe().environment;
  const portRef = useRef<DiscoveryReadPort | null>(null);
  if (portRef.current === null) {
    portRef.current = discoveryReadPortFor(environment, {
      stream: "clean",
      revision: DISCOVERY_PROJECTION_REVISION,
    });
  }
  const [stream, setStreamState] = useState<DiscoveryStreamKind>("clean");
  const [revision, setRevision] = useState<string>(DISCOVERY_PROJECTION_REVISION);
  const [filter, setFilterState] = useState<DiscoveryReadFilter>(EMPTY_DISCOVERY_FILTER);
  const [outcome, setOutcome] = useState<LiveOutcome>({ kind: "loading" });
  const [floor, setFloor] = useState<string | null>(null);
  const generation = useRef(0);
  const sentCursor = useRef<DiscoveryReadCursor | null>(null);
  const stateRef = useRef({ filter, floor });
  stateRef.current = { filter, floor };

  const issue = useCallback((cursor: DiscoveryReadCursor | null, floorAt: string | null, filterAt: DiscoveryReadFilter) => {
    const port = portRef.current;
    if (!port) {
      return;
    }
    const ticket = ++generation.current;
    sentCursor.current = cursor;
    setOutcome({ kind: "loading" });
    void port
      .readPage({
        scope: DISCOVERY_DESK_SCOPE,
        filter: filterAt,
        pageSize: DISCOVERY_READ_PAGE_BOUND,
        cursor,
        watermarkFloor: floorAt,
      })
      .then((next) => {
        if (ticket !== generation.current) {
          return;
        }
        setOutcome(next);
        if (next.kind === "ready") {
          setFloor(raiseFloor(stateRef.current.floor, next.watermark));
        }
      });
  }, []);

  useEffect(() => {
    issue(null, null, EMPTY_DISCOVERY_FILTER);
  }, [issue]);

  const resync = useCallback(
    (nextFilter: DiscoveryReadFilter) => {
      portRef.current?.reset();
      setFloor(null);
      issue(null, null, nextFilter);
    },
    [issue],
  );

  const nextPage = useCallback(() => {
    if (outcome.kind !== "ready" || outcome.nextCursor === null) {
      return;
    }
    issue(outcome.nextCursor, stateRef.current.floor, stateRef.current.filter);
  }, [issue, outcome]);

  const runReturn = useCallback(() => {
    const mode = liveReturnMode(outcome);
    if (mode === "resync") {
      resync(stateRef.current.filter);
      return;
    }
    if (mode === "first") {
      portRef.current?.reset();
      issue(null, stateRef.current.floor, stateRef.current.filter);
      return;
    }
    if (mode === "again") {
      issue(sentCursor.current, stateRef.current.floor, stateRef.current.filter);
    }
  }, [issue, outcome, resync]);

  const setStream = useCallback(
    (next: DiscoveryStreamKind) => {
      setStreamState(next);
      setFilterState(EMPTY_DISCOVERY_FILTER);
      portRef.current = discoveryReadPortFor(environment, { stream: next, revision });
      resync(EMPTY_DISCOVERY_FILTER);
    },
    [environment, revision, resync],
  );

  const setFilter = useCallback(
    (next: DiscoveryReadFilter) => {
      setFilterState(next);
      resync(next);
    },
    [resync],
  );

  const rebuildProjection = useCallback(() => {
    const next = `${revision}+r${revision.split("+r").length}`;
    setRevision(next);
    portRef.current = discoveryReadPortFor(environment, { stream, revision: next });
  }, [environment, stream, revision]);

  const [detailOutcome, setDetailOutcome] = useState<DiscoveryRowOutcome | { kind: "loading" }>({
    kind: "loading",
  });
  const detailGeneration = useRef(0);
  const rowId = options.rowId;
  const detailEnabled = options.detailEnabled;

  const readDetail = useCallback(() => {
    const port = portRef.current;
    if (!port || rowId === null) {
      return;
    }
    const ticket = ++detailGeneration.current;
    setDetailOutcome({ kind: "loading" });
    void port.readRow(rowId, DISCOVERY_DESK_SCOPE).then((next) => {
      if (ticket === detailGeneration.current) {
        setDetailOutcome(next);
      }
    });
  }, [rowId]);

  useEffect(() => {
    if (rowId !== null && detailEnabled) {
      readDetail();
    }
  }, [rowId, detailEnabled, readDetail]);

  return {
    listModel: buildLiveListModel({
      stream,
      revision,
      filter,
      outcome,
      canNext: outcome.kind === "ready" && outcome.nextCursor !== null,
    }),
    listHandlers: connectedActions({ nextPage, runReturn, setStream, setFilter, rebuildProjection }, ["setStream", "rebuildProjection"]),
    detailModel: buildLiveDetailModel({ outcome: detailEnabled ? detailOutcome : { kind: "loading" } }),
    detailHandlers: { readAgain: readDetail },
  };
}
