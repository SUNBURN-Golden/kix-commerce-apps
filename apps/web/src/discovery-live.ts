import { messages as sourceCopy } from "./i18n/messages/discovery-live";
import { sourceMessage } from "./i18n/source-message";
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
import { protocol } from "./protocol";

export const LIVE_READ_TITLE = sourceCopy.en["s19f"];

export const LIVE_READ_SOURCE_LINE =
  sourceCopy.en["s1hv"];

export const LIVE_READ_BOUNDARY =
  sourceCopy.en["s61"];

export const LIVE_READ_SCOPE_NOTE = sourceMessage(sourceCopy.en["p.t136"], { v1: DISCOVERY_READ_TENANT });

export const LIVE_READ_PAGE_NOTE = sourceMessage(sourceCopy.en["p.t137"], { v1: DISCOVERY_READ_PAGE_BOUND });

export const LIVE_READ_REBUILD_LABEL = sourceCopy.en["s1da"];

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
    return sourceCopy.en["s1me"];
  }
  if (mode === "again") {
    return sourceCopy.en["s1ax"];
  }
  return sourceCopy.en["s9h"];
}

export function liveStatusLine(outcome: LiveOutcome | DiscoveryRowOutcome): {
  statusLine: string;
  detailLine: string;
} {
  switch (outcome.kind) {
    case "loading":
      return { statusLine: sourceCopy.en["sre"], detailLine: "" };
    case "ready":
      return { statusLine: sourceCopy.en["s19e"], detailLine: "" };
    case "empty":
      return { statusLine: sourceCopy.en["sx0"], detailLine: "" };
    case "gap":
      return { statusLine: sourceMessage(sourceCopy.en["p.t138"], { v1: outcome.code }), detailLine: outcome.detail };
    case "stale":
      return {
        statusLine: sourceCopy.en["s1lu"],
        detailLine: sourceMessage(sourceCopy.en["p.t502"], { v1: formatWhen(outcome.watermark), v2: formatWhen(outcome.floor) }),
      };
    case "cursor-invalid":
      return { statusLine: sourceMessage(sourceCopy.en["p.t139"], { v1: outcome.code }), detailLine: outcome.detail };
    case "tenant-mismatch":
      return {
        statusLine: sourceCopy.en["s7j"],
        detailLine: sourceMessage(sourceCopy.en["p.t503"], { v1: outcome.rowId, v2: outcome.tenantId }),
      };
    case "tuple-changed":
      return {
        statusLine: sourceMessage(sourceCopy.en["p.t140"], { v1: outcome.field }),
        detailLine: sourceMessage(sourceCopy.en["p.t504"], { v1: outcome.expected, v2: outcome.actual }),
      };
    case "not-bound":
      return { statusLine: outcome.reason, detailLine: "" };
    case "invalid-request":
      return { statusLine: sourceMessage(sourceCopy.en["p.t141"], { v1: outcome.code }), detailLine: outcome.detail };
    case "unknown":
      return { statusLine: sourceCopy.en["s25d"], detailLine: outcome.message };
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
  let metaLine = sourceMessage(sourceCopy.en["p.t505"], { v1: input.stream, v2: input.revision });
  if (outcome.kind === "ready") {
    metaLine = sourceMessage(sourceCopy.en["p.t142"], { v1: metaLine, v2: outcome.watermark ? formatWhen(outcome.watermark) : "none", v3: outcome.scannedCount, v4: outcome.totalEstimate });
  } else if (outcome.kind === "empty") {
    metaLine = sourceMessage(sourceCopy.en["p.t143"], { v1: metaLine, v2: outcome.totalEstimate });
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
      ? { statusLine: sourceCopy.en["swz"], detailLine: "" }
      : liveStatusLine(outcome);
  const mode = outcome.kind === "empty" ? null : liveReturnMode(outcome);
  return {
    state: outcome.kind,
    statusLine,
    detailLine,
    actionLabel: mode === null ? null : sourceCopy.en["s1ax"],
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
    listHandlers: { nextPage, runReturn, setStream, setFilter, rebuildProjection },
    detailModel: buildLiveDetailModel({ outcome: detailEnabled ? detailOutcome : { kind: "loading" } }),
    detailHandlers: { readAgain: readDetail },
  };
}
