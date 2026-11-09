import type { DisplayLocale } from "./a11y/present";
import { useDisplayLocale } from "./i18n/locale-context";
import { messages as sourceCopy } from "./i18n/messages/discovery-live";
import { sourceMessage } from "./i18n/source-message";
import { connectedActions } from "./connectivity/write-guard";
/**
 * The discovery projection read on top of the adapter's bounded port.
 * Stub scope: the default port is the synthetic stream. On integration-http
 * the same port is not-bound — the contract-only catalogue has no read
 * command, and this module does not invent one, retry, or switch adapters.
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 * This module posts nothing and reads no clock.
 */

import { useCallback, useLayoutEffect, useRef, useState } from "react";
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
import { settleRead, unknownRead } from "./read-lifecycle";
import { formatWhen } from "./format";
import { protocol } from "./connectivity/desk-protocol";

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

export function liveStatusLine(outcome: LiveOutcome | DiscoveryRowOutcome, locale: DisplayLocale): {
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
        detailLine: sourceMessage(sourceCopy.en["p.t502"], { v1: formatWhen(outcome.watermark, locale), v2: formatWhen(outcome.floor, locale) }),
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
  locale: DisplayLocale;
  stream: DiscoveryStreamKind;
  revision: string;
  filter: DiscoveryReadFilter;
  outcome: LiveOutcome;
  canNext: boolean;
}): LiveListModel {
  const { outcome, locale } = input;
  const { statusLine, detailLine } = liveStatusLine(outcome, locale);
  const mode = liveReturnMode(outcome);
  let metaLine = sourceMessage(sourceCopy.en["p.t505"], { v1: input.stream, v2: input.revision });
  if (outcome.kind === "ready") {
    metaLine = sourceMessage(sourceCopy.en["p.t142"], { v1: metaLine, v2: outcome.watermark ? formatWhen(outcome.watermark, locale) : "none", v3: outcome.scannedCount, v4: outcome.totalEstimate });
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
  locale: DisplayLocale;
  outcome: DiscoveryRowOutcome | { kind: "loading" };
}): LiveDetailModel {
  const { outcome, locale } = input;
  const { statusLine, detailLine } =
    outcome.kind === "empty"
      ? { statusLine: sourceCopy.en["swz"], detailLine: "" }
      : liveStatusLine(outcome, locale);
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
  const locale = useDisplayLocale();
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
  const floor = useRef<string | null>(null);
  const generation = useRef(0);
  const detailGeneration = useRef(0);
  const sourceEpoch = useRef(0);
  const alive = useRef(false);
  const sentCursor = useRef<DiscoveryReadCursor | null>(null);
  const committed = useRef<LiveOutcome>({ kind: "unknown", message: "" });
  const [detailOutcome, setDetailOutcome] = useState<DiscoveryRowOutcome | { kind: "loading" }>({ kind: "empty" });
  const detailOwner = useRef<string | null>(null);
  const { rowId, detailEnabled } = options;
  const stateRef = useRef({ filter, rowId, detailEnabled });
  stateRef.current = { filter, rowId, detailEnabled };

  // Each effect setup owns a new lifetime, including StrictMode's second setup.
  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current += 1;
      detailGeneration.current += 1;
      sourceEpoch.current += 1;
    };
  }, []);

  const invalidate = useCallback(() => {
    generation.current += 1;
    detailGeneration.current += 1;
    sourceEpoch.current += 1;
    floor.current = null;
    detailOwner.current = null;
    setDetailOutcome(unknownRead());
  }, []);

  const issue = useCallback((cursor: DiscoveryReadCursor | null, floorAt: string | null, filterAt: DiscoveryReadFilter, reset = false) => {
    const port = portRef.current;
    if (!port || !alive.current) return;
    const ticket = ++generation.current;
    const epoch = sourceEpoch.current;
    sentCursor.current = cursor;
    setOutcome({ kind: "loading" });
    void settleRead(
      () => {
        if (reset) port.reset();
        return port.readPage({ scope: DISCOVERY_DESK_SCOPE, filter: filterAt, pageSize: DISCOVERY_READ_PAGE_BOUND, cursor, watermarkFloor: floorAt });
      },
      () => alive.current && ticket === generation.current && epoch === sourceEpoch.current && port === portRef.current,
      (next) => {
        committed.current = next;
        setOutcome(next);
        if (next.kind === "ready") floor.current = raiseFloor(floor.current, next.watermark);
      },
    );
  }, []);

  useLayoutEffect(() => {
    issue(null, null, EMPTY_DISCOVERY_FILTER);
  }, [issue]);

  const resync = useCallback((nextFilter: DiscoveryReadFilter) => {
    invalidate();
    sentCursor.current = null;
    issue(null, null, nextFilter, true);
  }, [invalidate, issue]);

  const nextPage = useCallback(() => {
    if (outcome.kind === "ready" && outcome.nextCursor !== null) {
      issue(outcome.nextCursor, floor.current, stateRef.current.filter);
    }
  }, [issue, outcome]);

  const runReturn = useCallback(() => {
    const mode = liveReturnMode(outcome);
    if (mode === "resync") resync(stateRef.current.filter);
    else if (mode === "first") issue(null, floor.current, stateRef.current.filter, true);
    else if (mode === "again") issue(sentCursor.current, floor.current, stateRef.current.filter);
  }, [issue, outcome, resync]);

  const setStream = useCallback((next: DiscoveryStreamKind) => {
    invalidate();
    portRef.current = discoveryReadPortFor(environment, { stream: next, revision });
    setStreamState(next);
    setFilterState(EMPTY_DISCOVERY_FILTER);
    stateRef.current.filter = EMPTY_DISCOVERY_FILTER;
    resync(EMPTY_DISCOVERY_FILTER);
  }, [environment, revision, invalidate, resync]);

  const setFilter = useCallback((next: DiscoveryReadFilter) => {
    stateRef.current.filter = next;
    setFilterState(next);
    resync(next);
  }, [resync]);

  const rebuildProjection = useCallback(() => {
    invalidate();
    const next = `${revision}+r${revision.split("+r").length}`;
    setRevision(next);
    portRef.current = discoveryReadPortFor(environment, { stream, revision: next });
    // The committed page/cursor is retained only for the explicit REBUILT demo.
    // No old in-flight completion can turn it back into fresh evidence.
    setOutcome(committed.current);
  }, [environment, stream, revision, invalidate]);

  const readDetail = useCallback(() => {
    const port = portRef.current;
    const at = stateRef.current;
    if (!port || !alive.current || at.rowId === null || !at.detailEnabled) return;
    const id = at.rowId;
    const ticket = ++detailGeneration.current;
    const epoch = sourceEpoch.current;
    detailOwner.current = id;
    setDetailOutcome({ kind: "loading" });
    void settleRead(
      () => port.readRow(id, DISCOVERY_DESK_SCOPE),
      () => alive.current && ticket === detailGeneration.current && epoch === sourceEpoch.current && port === portRef.current && stateRef.current.rowId === id && stateRef.current.detailEnabled,
      setDetailOutcome,
    );
  }, []);

  useLayoutEffect(() => {
    detailGeneration.current += 1;
    detailOwner.current = null;
    setDetailOutcome({ kind: "empty" });
    if (rowId !== null && detailEnabled) readDetail();
    return () => { detailGeneration.current += 1; };
  }, [rowId, detailEnabled, readDetail]);

  return {
    listModel: buildLiveListModel({ locale, stream, revision, filter, outcome, canNext: outcome.kind === "ready" && outcome.nextCursor !== null }),
    listHandlers: connectedActions({ nextPage, runReturn, setStream, setFilter, rebuildProjection }, ["setStream", "rebuildProjection"]),
    detailModel: buildLiveDetailModel({ locale, outcome: !detailEnabled || rowId === null ? { kind: "empty" } : detailOwner.current === rowId ? detailOutcome : unknownRead() }),
    detailHandlers: { readAgain: readDetail },
  };
}
