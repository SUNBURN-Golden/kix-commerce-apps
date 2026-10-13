import { OPENAPI_INTEGRATION_GATE_PIN } from "./integration-gate-pin.js";
import { OPENAPI_CONTRACT_PIN, PINNED_ACTIONS, PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import { isRecord } from "./record.js";
import { sha256Hex } from "./sha256.js";
import { ProtocolError } from "./types.js";

/**
 * Bounded synthetic projection read for the discovery screen.
 *
 * This is the stub-scope stand-in for the producer read contract. The real
 * producer read stays pending on kix-protocol:ps-05-query-projections,
 * bind-list-read, and c-journey-identity. No producer SDK, manifest, or
 * vector is consumed, so those digests stay null.
 *
 * Rows are synthetic projection labels. A row confirms no sale, no
 * ownership, and no payment. This module sends nothing, retries nothing,
 * and reads no clock.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const DISCOVERY_READ_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const DISCOVERY_READ_NOT_BOUND_REASON =
  "The contract-only catalogue has no read command for a query projection. The discovery read stays on the synthetic stub.";

export const DISCOVERY_PROJECTION_NAME = "kix.discovery.search";

export const DISCOVERY_PROJECTION_REVISION = "syn-1";

/** Hard bound on rows per read call. A larger request is refused, not clamped. */
export const DISCOVERY_READ_PAGE_BOUND = 25;

/** Hard bound on the filter text. A longer text is refused, not truncated. */
export const DISCOVERY_READ_TEXT_BOUND = 64;

/** The only tenant this synthetic projection serves. */
export const DISCOVERY_READ_TENANT = "tenant-desk";

/** The desk's own access scope. The subject string is not an authentication result. */
export const DISCOVERY_DESK_SCOPE = {
  tenantId: DISCOVERY_READ_TENANT,
  subject: "discovery-desk",
} as const;

/** Fixed instant the synthetic projection claims to be built at. */
export const DISCOVERY_PROJECTION_AS_OF = "2026-10-13T00:00:00.000Z";

/** A page watermark older than this span before AS_OF is stale. */
export const DISCOVERY_READ_STALE_AFTER_MS = 86_400_000;

export const DISCOVERY_CURSOR_VERSION = 1;

export const DISCOVERY_STREAMS = [
  "clean",
  "duplicate",
  "reorder",
  "gap",
  "tenant-mix",
  "stale",
] as const;

export type DiscoveryStreamKind = (typeof DISCOVERY_STREAMS)[number];

export const DISCOVERY_ROW_KINDS = ["event", "right", "listing"] as const;

export type DiscoveryRowKind = (typeof DISCOVERY_ROW_KINDS)[number];

export const DISCOVERY_ROW_STATUSES = ["on-sale", "sold-out", "cancelled"] as const;

export type DiscoveryRowStatus = (typeof DISCOVERY_ROW_STATUSES)[number];

/**
 * The pin tuple this read is recorded against. The same producer-change rule
 * applies: a catalogue or gate change moves both OpenAPI pins, PINNED_ACTIONS,
 * the CI gate SHA, protocolMergeSha, and the SDK/manifest/vector tuple
 * together. The SDK, manifest, and vector digests stay null; none is consumed.
 */
export interface DiscoveryReadTuple {
  contractOpenApiSha256: string;
  contractInfoVersion: string;
  contractMainSha: string;
  gateOpenApiSha256: string;
  protocolMergeSha: string;
  protocolFeatureSha: string;
  sourceProtocolContractSha256: string;
  domain: string;
  pinnedActions: readonly string[];
  sdkDigest: null;
  manifestDigest: null;
  vectorDigest: null;
}

export const DISCOVERY_READ_TUPLE_LITERALS: DiscoveryReadTuple = {
  contractOpenApiSha256: "fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e",
  contractInfoVersion: "0.3-rc1+sha256:ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e",
  contractMainSha: "a744b0a036d7e1edb48416871af20cd182f23df4",
  gateOpenApiSha256: "2a2af554cb1a8b128f2cf1b1d5b8cf6b1c8fa90adf30865dbc3e64932b3bd13f",
  protocolMergeSha: "52a9b5cbf7777df55d2d2062cb8d99d862b423bb",
  protocolFeatureSha: "c7238bc24a399a6cabbab87ac23dbfd7e9c252dd",
  sourceProtocolContractSha256: "ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e",
  domain: "kix:fixture:lifecycle:0.3",
  pinnedActions: PINNED_ACTIONS,
  sdkDigest: null,
  manifestDigest: null,
  vectorDigest: null,
};

export interface DiscoveryProjectionRow {
  /** Stream position. Contiguous and increasing on a clean stream. */
  sequence: number;
  tenantId: string;
  rowId: string;
  kind: DiscoveryRowKind;
  title: string;
  venueLabel: string;
  startsAt: string;
  statusLabel: DiscoveryRowStatus;
  watermark: string;
  /** Search rows never confirm these. They stay literal false. */
  confirmsSale: false;
  confirmsOwnership: false;
  confirmsPayment: false;
}

export interface DiscoveryReadFilter {
  text: string;
  kinds: readonly DiscoveryRowKind[];
  statuses: readonly DiscoveryRowStatus[];
  from: string;
  to: string;
}

export const EMPTY_DISCOVERY_FILTER: DiscoveryReadFilter = {
  text: "",
  kinds: [],
  statuses: [],
  from: "",
  to: "",
};

export interface DiscoveryAccessScope {
  tenantId: string;
  subject: string;
}

/** Issued by the port. Callers hold it opaquely and return it unchanged. */
export interface DiscoveryReadCursor {
  cursorVersion: number;
  projectionName: string;
  projectionRevision: string;
  tenantId: string;
  filterKey: string;
  afterSequence: number;
  watermark: string;
}

export interface DiscoveryReadRequest {
  scope: DiscoveryAccessScope;
  filter: DiscoveryReadFilter;
  pageSize: number;
  cursor: DiscoveryReadCursor | null;
  watermarkFloor: string | null;
}

export const DISCOVERY_READ_INVALID_CODES = ["SCOPE", "FILTER", "PAGE_SIZE", "BOUND", "ROW_ID"] as const;

export type DiscoveryReadInvalidCode = (typeof DISCOVERY_READ_INVALID_CODES)[number];

export const DISCOVERY_GAP_CODES = ["SEQUENCE", "ORDER", "DUPLICATE", "OVER_BOUND"] as const;

export type DiscoveryGapCode = (typeof DISCOVERY_GAP_CODES)[number];

export const DISCOVERY_CURSOR_CODES = ["VERSION", "REBUILT", "FILTER", "TENANT", "SHAPE"] as const;

export type DiscoveryCursorCode = (typeof DISCOVERY_CURSOR_CODES)[number];

export type DiscoveryReadOutcome =
  | {
      kind: "ready";
      rows: readonly DiscoveryProjectionRow[];
      nextCursor: DiscoveryReadCursor | null;
      watermark: string | null;
      scannedCount: number;
      totalEstimate: number;
      revision: string;
    }
  | { kind: "empty"; watermark: string | null; totalEstimate: number; revision: string }
  | { kind: "gap"; code: DiscoveryGapCode; detail: string }
  | { kind: "stale"; watermark: string; floor: string }
  | { kind: "cursor-invalid"; code: DiscoveryCursorCode; detail: string }
  | { kind: "tenant-mismatch"; rowId: string; tenantId: string }
  | { kind: "tuple-changed"; field: string; expected: string; actual: string }
  | { kind: "not-bound"; reason: string }
  | { kind: "invalid-request"; code: DiscoveryReadInvalidCode; detail: string }
  | { kind: "unknown"; message: string };

export type DiscoveryRowOutcome =
  | { kind: "ready"; row: DiscoveryProjectionRow }
  | { kind: "empty" }
  | { kind: "stale"; watermark: string; floor: string }
  | { kind: "tenant-mismatch"; rowId: string; tenantId: string }
  | { kind: "tuple-changed"; field: string; expected: string; actual: string }
  | { kind: "not-bound"; reason: string }
  | { kind: "invalid-request"; code: DiscoveryReadInvalidCode; detail: string }
  | { kind: "unknown"; message: string };

export interface DiscoveryReadPort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic-projection" | "none";
  readonly revision: string;
  /** Clears the session duplicate ledger. Resync calls this first. */
  reset(): void;
  readPage(request: DiscoveryReadRequest): Promise<DiscoveryReadOutcome>;
  readRow(rowId: string, scope: DiscoveryAccessScope): Promise<DiscoveryRowOutcome>;
}

export interface StubDiscoveryReadOptions {
  /** Faulted synthetic stream. Default clean. */
  stream?: DiscoveryStreamKind;
  /** Projection revision this source serves. Default DISCOVERY_PROJECTION_REVISION. */
  revision?: string;
  /** Materialized stream rows. Default the synthetic base stream. */
  rows?: readonly DiscoveryProjectionRow[];
  /** Count-only lazy stream length. Used instead of rows when rowAt is set. */
  rowCount?: number;
  /** Lazy row generator for rowCount. The port calls it for the window only. */
  rowAt?: (index: number) => DiscoveryProjectionRow;
  /** Expected tuple override. Used to stage a producer change in tests. */
  expectedTuple?: DiscoveryReadTuple;
}

interface TupleMismatch {
  field: string;
  expected: string;
  actual: string;
}

export function liveDiscoveryReadTuple(): DiscoveryReadTuple {
  return {
    contractOpenApiSha256: OPENAPI_CONTRACT_PIN.openApiFileSha256,
    contractInfoVersion: OPENAPI_CONTRACT_PIN.infoVersion,
    contractMainSha: OPENAPI_CONTRACT_PIN.protocolMainSha,
    gateOpenApiSha256: OPENAPI_INTEGRATION_GATE_PIN.openApiFileSha256,
    protocolMergeSha: OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha,
    protocolFeatureSha: OPENAPI_INTEGRATION_GATE_PIN.protocolFeatureSha,
    sourceProtocolContractSha256: OPENAPI_CONTRACT_PIN.sourceProtocolContractSha256,
    domain: PINNED_PROTOCOL_DOMAIN,
    pinnedActions: PINNED_ACTIONS,
    sdkDigest: null,
    manifestDigest: null,
    vectorDigest: null,
  };
}

export function checkDiscoveryReadTuple(expected: DiscoveryReadTuple = DISCOVERY_READ_TUPLE_LITERALS): TupleMismatch | null {
  const live = liveDiscoveryReadTuple();
  const scalarFields = [
    "contractOpenApiSha256",
    "contractInfoVersion",
    "contractMainSha",
    "gateOpenApiSha256",
    "protocolMergeSha",
    "protocolFeatureSha",
    "sourceProtocolContractSha256",
    "domain",
  ] as const;
  for (const field of scalarFields) {
    if (live[field] !== expected[field]) {
      return { field, expected: expected[field], actual: live[field] };
    }
  }
  if (!sameList(live.pinnedActions, expected.pinnedActions)) {
    return { field: "pinnedActions", expected: expected.pinnedActions.join(","), actual: live.pinnedActions.join(",") };
  }
  if (expected.sdkDigest !== null || expected.manifestDigest !== null || expected.vectorDigest !== null) {
    return { field: "sdkTuple", expected: "null digests", actual: "consumed digests" };
  }
  if (live.sdkDigest !== expected.sdkDigest || live.manifestDigest !== expected.manifestDigest || live.vectorDigest !== expected.vectorDigest) {
    return { field: "sdkTuple", expected: "null digests", actual: "live digests differ" };
  }
  return null;
}

export function assertDiscoveryReadTuple(expected: DiscoveryReadTuple = DISCOVERY_READ_TUPLE_LITERALS): void {
  const mismatch = checkDiscoveryReadTuple(expected);
  if (mismatch !== null) {
    throw new ProtocolError(
      `Discovery read tuple ${mismatch.field} does not match the live pin.`,
      "DIFFERENT_TUPLE",
    );
  }
}

export function discoveryFilterKey(filter: DiscoveryReadFilter): string {
  return sha256Hex(
    JSON.stringify({
      text: filter.text,
      kinds: [...filter.kinds],
      statuses: [...filter.statuses],
      from: filter.from,
      to: filter.to,
    }),
  );
}

export function createStubDiscoveryRead(options: StubDiscoveryReadOptions = {}): DiscoveryReadPort {
  return new StubDiscoveryRead(options);
}

export function createNotBoundDiscoveryRead(): DiscoveryReadPort {
  const outcome = { kind: "not-bound", reason: DISCOVERY_READ_NOT_BOUND_REASON } as const;
  return {
    environment: "integration-http",
    source: "none",
    revision: DISCOVERY_PROJECTION_REVISION,
    reset() {
      return;
    },
    readPage() {
      return Promise.resolve({ ...outcome });
    },
    readRow() {
      return Promise.resolve({ ...outcome });
    },
  };
}

export function discoveryReadPortFor(
  environment: "stub" | "integration-http",
  options: StubDiscoveryReadOptions = {},
): DiscoveryReadPort {
  if (environment === "stub") {
    return createStubDiscoveryRead(options);
  }
  return createNotBoundDiscoveryRead();
}

/** Count-only lazy row for the scale source. The caller chooses the size. */
export function lazyDiscoveryRow(index: number): DiscoveryProjectionRow {
  const sequence = index + 1;
  return {
    sequence,
    tenantId: DISCOVERY_READ_TENANT,
    rowId: `pro-${pad4(sequence)}`,
    kind: DISCOVERY_ROW_KINDS[index % DISCOVERY_ROW_KINDS.length] ?? "event",
    title: `Lazy projection row ${sequence}`,
    venueLabel: "Scale venue",
    startsAt: plusHours(DISCOVERY_PROJECTION_AS_OF, sequence),
    statusLabel: DISCOVERY_ROW_STATUSES[index % DISCOVERY_ROW_STATUSES.length] ?? "on-sale",
    watermark: DISCOVERY_PROJECTION_AS_OF,
    confirmsSale: false,
    confirmsOwnership: false,
    confirmsPayment: false,
  };
}

interface StreamWindow {
  rows: DiscoveryProjectionRow[];
  endOfStream: boolean;
}

interface ProjectionStream {
  readonly revision: string;
  readonly totalEstimate: number;
  page(afterSequence: number, limit: number): StreamWindow;
  lookup(rowId: string): DiscoveryProjectionRow | null;
}

class ArrayProjectionStream implements ProjectionStream {
  constructor(
    private readonly streamRows: readonly DiscoveryProjectionRow[],
    readonly revision: string,
  ) {}

  get totalEstimate(): number {
    return this.streamRows.length;
  }

  page(afterSequence: number, limit: number): StreamWindow {
    const start = Math.max(0, Math.min(this.streamRows.length, afterSequence));
    return {
      rows: this.streamRows.slice(start, start + limit),
      endOfStream: start + limit >= this.streamRows.length,
    };
  }

  lookup(rowId: string): DiscoveryProjectionRow | null {
    return this.streamRows.find((row) => row.rowId === rowId) ?? null;
  }
}

class LazyProjectionStream implements ProjectionStream {
  constructor(
    private readonly size: number,
    private readonly rowAt: (index: number) => DiscoveryProjectionRow,
    readonly revision: string,
  ) {}

  get totalEstimate(): number {
    return this.size;
  }

  page(afterSequence: number, limit: number): StreamWindow {
    const start = Math.max(0, Math.min(this.size, afterSequence));
    const end = Math.min(this.size, start + limit);
    const rows: DiscoveryProjectionRow[] = [];
    for (let index = start; index < end; index += 1) {
      rows.push(this.rowAt(index));
    }
    return { rows, endOfStream: end >= this.size };
  }

  lookup(rowId: string): DiscoveryProjectionRow | null {
    const match = /^pro-([0-9]+)$/.exec(rowId);
    if (!match?.[1]) {
      return null;
    }
    const sequence = Number(match[1]);
    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > this.size) {
      return null;
    }
    const row = this.rowAt(sequence - 1);
    return row.rowId === rowId ? row : null;
  }
}

class StubDiscoveryRead implements DiscoveryReadPort {
  readonly environment = "stub" as const;
  readonly source = "synthetic-projection" as const;
  readonly revision: string;
  private readonly stream: ProjectionStream;
  private readonly expectedTuple: DiscoveryReadTuple;
  private readonly seenRowIds = new Set<string>();

  constructor(options: StubDiscoveryReadOptions) {
    const revision = options.revision ?? DISCOVERY_PROJECTION_REVISION;
    this.revision = revision;
    this.expectedTuple = options.expectedTuple ?? DISCOVERY_READ_TUPLE_LITERALS;
    if (options.rowAt) {
      this.stream = new LazyProjectionStream(options.rowCount ?? 0, options.rowAt, revision);
    } else {
      const base = options.rows ?? baseStreamRows(options.stream ?? "clean");
      this.stream = new ArrayProjectionStream(base, revision);
    }
  }

  reset(): void {
    this.seenRowIds.clear();
  }

  readPage(request: DiscoveryReadRequest): Promise<DiscoveryReadOutcome> {
    const tuple = this.tupleCheck();
    if (tuple) {
      return Promise.resolve(tuple);
    }
    const invalid = validateRequest(request);
    if (invalid) {
      return Promise.resolve(invalid);
    }
    const cursorCheck = this.checkCursor(request.cursor, request.scope, request.filter);
    if (cursorCheck) {
      return Promise.resolve(cursorCheck);
    }
    const afterSequence = request.cursor === null ? 0 : request.cursor.afterSequence;
    let windowed: StreamWindow;
    try {
      windowed = this.stream.page(afterSequence, request.pageSize);
    } catch (reason) {
      return Promise.resolve({ kind: "unknown", message: messageOf(reason) });
    }
    const delivered = windowed.rows;
    if (delivered.length > request.pageSize) {
      return Promise.resolve({
        kind: "gap",
        code: "OVER_BOUND",
        detail: `The stream delivered ${delivered.length} rows for page size ${request.pageSize}.`,
      });
    }
    let expectedSequence = afterSequence + 1;
    const pageRowIds = new Set<string>();
    const newRowIds: string[] = [];
    let pageWatermark: string | null = null;
    for (const row of delivered) {
      if (!Number.isSafeInteger(row.sequence) || row.sequence !== expectedSequence) {
        const code: DiscoveryGapCode =
          Number.isSafeInteger(row.sequence) && row.sequence > expectedSequence ? "SEQUENCE" : "ORDER";
        return Promise.resolve({
          kind: "gap",
          code,
          detail: `Expected sequence ${expectedSequence} and received ${row.sequence} (${row.rowId}).`,
        });
      }
      expectedSequence += 1;
      if (row.tenantId !== request.scope.tenantId) {
        return Promise.resolve({ kind: "tenant-mismatch", rowId: row.rowId, tenantId: row.tenantId });
      }
      if (pageRowIds.has(row.rowId) || this.seenRowIds.has(row.rowId)) {
        return Promise.resolve({
          kind: "gap",
          code: "DUPLICATE",
          detail: `Row ${row.rowId} was delivered twice in this session.`,
        });
      }
      pageRowIds.add(row.rowId);
      newRowIds.push(row.rowId);
      pageWatermark = minInstant(pageWatermark, row.watermark);
    }
    const floor = staleFloor(request.watermarkFloor);
    if (pageWatermark !== null && Date.parse(pageWatermark) < Date.parse(floor)) {
      return Promise.resolve({ kind: "stale", watermark: pageWatermark, floor });
    }
    for (const rowId of newRowIds) {
      this.seenRowIds.add(rowId);
    }
    const matched = delivered.filter((row) => matchesFilter(request.filter, row));
    const scannedThrough = afterSequence + delivered.length;
    if (matched.length === 0 && delivered.length === 0 && windowed.endOfStream) {
      return Promise.resolve({
        kind: "empty",
        watermark: pageWatermark,
        totalEstimate: this.stream.totalEstimate,
        revision: this.revision,
      });
    }
    const nextCursor: DiscoveryReadCursor | null = windowed.endOfStream
      ? null
      : {
          cursorVersion: DISCOVERY_CURSOR_VERSION,
          projectionName: DISCOVERY_PROJECTION_NAME,
          projectionRevision: this.revision,
          tenantId: request.scope.tenantId,
          filterKey: discoveryFilterKey(request.filter),
          afterSequence: scannedThrough,
          watermark: pageWatermark ?? "",
        };
    return Promise.resolve({
      kind: "ready",
      rows: matched,
      nextCursor,
      watermark: pageWatermark,
      scannedCount: delivered.length,
      totalEstimate: this.stream.totalEstimate,
      revision: this.revision,
    });
  }

  readRow(rowId: string, scope: DiscoveryAccessScope): Promise<DiscoveryRowOutcome> {
    const tuple = this.tupleCheck();
    if (tuple) {
      return Promise.resolve(tuple);
    }
    const scopeCheck = validateScope(scope);
    if (scopeCheck) {
      return Promise.resolve(scopeCheck);
    }
    if (typeof rowId !== "string" || !/^pro-[0-9]+$/.test(rowId)) {
      return Promise.resolve({
        kind: "invalid-request",
        code: "ROW_ID",
        detail: "A projection row id has the pro- shape.",
      });
    }
    let row: DiscoveryProjectionRow | null;
    try {
      row = this.stream.lookup(rowId);
    } catch (reason) {
      return Promise.resolve({ kind: "unknown", message: messageOf(reason) });
    }
    if (row === null) {
      return Promise.resolve({ kind: "empty" });
    }
    if (row.tenantId !== scope.tenantId) {
      return Promise.resolve({ kind: "tenant-mismatch", rowId: row.rowId, tenantId: row.tenantId });
    }
    const floor = staleFloor(null);
    if (Date.parse(row.watermark) < Date.parse(floor)) {
      return Promise.resolve({ kind: "stale", watermark: row.watermark, floor });
    }
    return Promise.resolve({ kind: "ready", row });
  }

  private tupleCheck(): Extract<DiscoveryReadOutcome, { kind: "tuple-changed" }> | null {
    const mismatch = checkDiscoveryReadTuple(this.expectedTuple);
    if (mismatch === null) {
      return null;
    }
    return { kind: "tuple-changed", field: mismatch.field, expected: mismatch.expected, actual: mismatch.actual };
  }

  private checkCursor(
    cursor: DiscoveryReadCursor | null,
    scope: DiscoveryAccessScope,
    filter: DiscoveryReadFilter,
  ): DiscoveryReadOutcome | null {
    if (cursor === null) {
      return null;
    }
    if (!isRecord(cursor)) {
      return { kind: "cursor-invalid", code: "SHAPE", detail: "The cursor is not an object." };
    }
    if (cursor.cursorVersion !== DISCOVERY_CURSOR_VERSION) {
      return { kind: "cursor-invalid", code: "VERSION", detail: "The cursor version is not supported." };
    }
    if (cursor.projectionName !== DISCOVERY_PROJECTION_NAME) {
      return { kind: "cursor-invalid", code: "SHAPE", detail: "The cursor names a different projection." };
    }
    if (cursor.projectionRevision !== this.revision) {
      return {
        kind: "cursor-invalid",
        code: "REBUILT",
        detail: `The projection was rebuilt. Cursor names ${cursor.projectionRevision} and the stream serves ${this.revision}.`,
      };
    }
    if (cursor.tenantId !== scope.tenantId) {
      return { kind: "cursor-invalid", code: "TENANT", detail: "The cursor belongs to another tenant." };
    }
    if (cursor.filterKey !== discoveryFilterKey(filter)) {
      return { kind: "cursor-invalid", code: "FILTER", detail: "The filter changed after the cursor was issued." };
    }
    if (!Number.isSafeInteger(cursor.afterSequence) || cursor.afterSequence < 0) {
      return { kind: "cursor-invalid", code: "SHAPE", detail: "The cursor position is not a sequence." };
    }
    if (cursor.afterSequence > this.stream.totalEstimate) {
      return { kind: "cursor-invalid", code: "SHAPE", detail: "The cursor is past the stream end." };
    }
    if (typeof cursor.watermark !== "string" || !isInstant(cursor.watermark)) {
      return { kind: "cursor-invalid", code: "SHAPE", detail: "The cursor watermark is not an instant." };
    }
    return null;
  }
}

function validateRequest(request: DiscoveryReadRequest): DiscoveryReadOutcome | null {
  if (!isRecord(request)) {
    return { kind: "invalid-request", code: "BOUND", detail: "The request is not an object." };
  }
  const scopeCheck = validateScope(request.scope);
  if (scopeCheck) {
    return scopeCheck;
  }
  if (!isRecord(request.filter)) {
    return { kind: "invalid-request", code: "FILTER", detail: "The filter is not an object." };
  }
  const filterCheck = validateFilter(request.filter);
  if (filterCheck) {
    return filterCheck;
  }
  if (!Number.isSafeInteger(request.pageSize) || request.pageSize < 1 || request.pageSize > DISCOVERY_READ_PAGE_BOUND) {
    return {
      kind: "invalid-request",
      code: "PAGE_SIZE",
      detail: `pageSize must be an integer from 1 to ${DISCOVERY_READ_PAGE_BOUND}.`,
    };
  }
  if (request.watermarkFloor !== null && !isInstant(request.watermarkFloor)) {
    return { kind: "invalid-request", code: "BOUND", detail: "watermarkFloor is not an instant." };
  }
  return null;
}

function validateScope(
  scope: DiscoveryAccessScope,
): Extract<DiscoveryReadOutcome, { kind: "invalid-request" }> | null {
  if (!isRecord(scope)) {
    return { kind: "invalid-request", code: "SCOPE", detail: "The access scope is not an object." };
  }
  if (scope.tenantId !== DISCOVERY_READ_TENANT) {
    return {
      kind: "invalid-request",
      code: "SCOPE",
      detail: `This read serves ${DISCOVERY_READ_TENANT} only.`,
    };
  }
  if (
    typeof scope.subject !== "string" ||
    scope.subject.length === 0 ||
    scope.subject.length > 100 ||
    scope.subject !== scope.subject.trim()
  ) {
    return { kind: "invalid-request", code: "SCOPE", detail: "The subject is not a non-empty trimmed string." };
  }
  return null;
}

function validateFilter(filter: DiscoveryReadFilter): DiscoveryReadOutcome | null {
  if (typeof filter.text !== "string" || filter.text.length > DISCOVERY_READ_TEXT_BOUND) {
    return {
      kind: "invalid-request",
      code: "FILTER",
      detail: `Filter text must be a string of at most ${DISCOVERY_READ_TEXT_BOUND} characters.`,
    };
  }
  if (!Array.isArray(filter.kinds) || !filter.kinds.every((kind) => (DISCOVERY_ROW_KINDS as readonly string[]).includes(kind))) {
    return { kind: "invalid-request", code: "FILTER", detail: "A kind is outside the enum." };
  }
  if (
    !Array.isArray(filter.statuses) ||
    !filter.statuses.every((status) => (DISCOVERY_ROW_STATUSES as readonly string[]).includes(status))
  ) {
    return { kind: "invalid-request", code: "FILTER", detail: "A status is outside the enum." };
  }
  const from = boundInstant(filter.from);
  const to = boundInstant(filter.to);
  if ((filter.from.length > 0 && from === null) || (filter.to.length > 0 && to === null)) {
    return { kind: "invalid-request", code: "FILTER", detail: "A date bound is not an instant." };
  }
  if (from !== null && to !== null && Date.parse(from) > Date.parse(to)) {
    return { kind: "invalid-request", code: "FILTER", detail: "The from date is after the to date." };
  }
  return null;
}

function matchesFilter(filter: DiscoveryReadFilter, row: DiscoveryProjectionRow): boolean {
  const needle = filter.text.trim().toLowerCase();
  if (needle.length > 0) {
    const hay = `${row.title} ${row.venueLabel} ${row.rowId}`.toLowerCase();
    if (!hay.includes(needle)) {
      return false;
    }
  }
  if (filter.kinds.length > 0 && !filter.kinds.includes(row.kind)) {
    return false;
  }
  if (filter.statuses.length > 0 && !filter.statuses.includes(row.statusLabel)) {
    return false;
  }
  const from = boundInstant(filter.from);
  if (from !== null && Date.parse(row.startsAt) < Date.parse(from)) {
    return false;
  }
  const to = boundInstant(filter.to);
  if (to !== null && Date.parse(row.startsAt) > Date.parse(to)) {
    return false;
  }
  return true;
}

function staleFloor(requestFloor: string | null): string {
  const staleBound = new Date(Date.parse(DISCOVERY_PROJECTION_AS_OF) - DISCOVERY_READ_STALE_AFTER_MS).toISOString();
  if (requestFloor !== null && isInstant(requestFloor) && Date.parse(requestFloor) > Date.parse(staleBound)) {
    return requestFloor;
  }
  return staleBound;
}

function boundInstant(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00.000Z` : trimmed;
  return isInstant(normalized) ? normalized : null;
}

function isInstant(value: string): boolean {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function minInstant(left: string | null, right: string): string {
  if (left === null) {
    return right;
  }
  return Date.parse(right) < Date.parse(left) ? right : left;
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : "The projection source failed.";
}

function pad4(value: number): string {
  return String(value).padStart(4, "0");
}

function plusHours(base: string, hours: number): string {
  return new Date(Date.parse(base) + hours * 3_600_000).toISOString();
}

function makeProjectionRow(fields: {
  sequence: number;
  rowId: string;
  kind: DiscoveryRowKind;
  title: string;
  venueLabel: string;
  startsAt: string;
  statusLabel: DiscoveryRowStatus;
  watermark: string;
  tenantId?: string;
}): DiscoveryProjectionRow {
  return {
    sequence: fields.sequence,
    tenantId: fields.tenantId ?? DISCOVERY_READ_TENANT,
    rowId: fields.rowId,
    kind: fields.kind,
    title: fields.title,
    venueLabel: fields.venueLabel,
    startsAt: fields.startsAt,
    statusLabel: fields.statusLabel,
    watermark: fields.watermark,
    confirmsSale: false,
    confirmsOwnership: false,
    confirmsPayment: false,
  };
}

const STREAM_VENUES = ["Paper hall", "North annex", "Studio shed", "Hall C"] as const;

const STREAM_TITLES: Record<number, { kind: DiscoveryRowKind; title: string; statusLabel: DiscoveryRowStatus }> = {
  1: { kind: "event", title: "Lanterns projection event", statusLabel: "on-sale" },
  2: { kind: "event", title: "Paper orchestra projection", statusLabel: "on-sale" },
  3: { kind: "event", title: "Last ferry projection", statusLabel: "on-sale" },
  4: { kind: "right", title: "Lanterns right marker", statusLabel: "on-sale" },
  5: { kind: "listing", title: "Lanterns listing marker", statusLabel: "sold-out" },
  6: { kind: "event", title: "Cancelled projection show", statusLabel: "cancelled" },
};

const BASE_STREAM_SIZE = 96;

function baseProjectionRow(index: number): DiscoveryProjectionRow {
  const sequence = index + 1;
  const named = STREAM_TITLES[sequence];
  const kind = named?.kind ?? DISCOVERY_ROW_KINDS[index % DISCOVERY_ROW_KINDS.length] ?? "event";
  const statusLabel =
    named?.statusLabel ?? DISCOVERY_ROW_STATUSES[(index + 1) % DISCOVERY_ROW_STATUSES.length] ?? "on-sale";
  return makeProjectionRow({
    sequence,
    rowId: `pro-${pad4(sequence)}`,
    kind,
    title: named?.title ?? `Projection row ${sequence}`,
    venueLabel: STREAM_VENUES[index % STREAM_VENUES.length] ?? "Paper hall",
    startsAt: plusHours(DISCOVERY_PROJECTION_AS_OF, 24 + sequence),
    statusLabel,
    watermark: DISCOVERY_PROJECTION_AS_OF,
  });
}

function cleanStreamRows(): DiscoveryProjectionRow[] {
  return Array.from({ length: BASE_STREAM_SIZE }, (_, index) => baseProjectionRow(index));
}

const STALE_STREAM_WATERMARK = new Date(
  Date.parse(DISCOVERY_PROJECTION_AS_OF) - 2 * DISCOVERY_READ_STALE_AFTER_MS,
).toISOString();

function baseStreamRows(stream: DiscoveryStreamKind): DiscoveryProjectionRow[] {
  const rows = cleanStreamRows();
  if (stream === "clean") {
    return rows;
  }
  if (stream === "duplicate") {
    // Row 35 carries the rowId of row 3. The sequence stays contiguous.
    const earlier = rows[2];
    if (!earlier) {
      return rows;
    }
    rows[34] = { ...earlier, sequence: 35 };
    return rows;
  }
  if (stream === "reorder") {
    // Sequence 22 arrives again at position 35: a regression inside the window.
    const earlier = rows[21];
    if (earlier) {
      rows[34] = earlier;
    }
    return rows;
  }
  if (stream === "gap") {
    // Sequence 33 is never delivered. The window jumps to 34.
    return rows.filter((row) => row.sequence !== 33);
  }
  if (stream === "tenant-mix") {
    // Sequence 40 arrives under a different tenant.
    const foreign = rows[39];
    if (foreign) {
      rows[39] = { ...foreign, tenantId: "tenant-other" };
    }
    return rows;
  }
  // stale: the whole stream reports an old watermark.
  return rows.map((row) => ({ ...row, watermark: STALE_STREAM_WATERMARK }));
}
