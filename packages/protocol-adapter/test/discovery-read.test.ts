import { KIX_SDK_0_CONSUMPTION_DIGESTS } from "../src/sdk-consumption-tuple.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DISCOVERY_CURSOR_VERSION,
  DISCOVERY_DESK_SCOPE,
  DISCOVERY_PROJECTION_NAME,
  DISCOVERY_PROJECTION_REVISION,
  DISCOVERY_READ_NOT_BOUND_REASON,
  DISCOVERY_READ_PAGE_BOUND,
  DISCOVERY_READ_RULING,
  DISCOVERY_READ_TENANT,
  DISCOVERY_READ_TEXT_BOUND,
  DISCOVERY_READ_TUPLE_LITERALS,
  DISCOVERY_STREAMS,
  EMPTY_DISCOVERY_FILTER,
  OPENAPI_INTEGRATION_GATE_PIN,
  assertDiscoveryReadTuple,
  checkDiscoveryReadTuple,
  createStubDiscoveryRead,
  discoveryFilterKey,
  discoveryReadPortFor,
  lazyDiscoveryRow,
  liveDiscoveryReadTuple,
  type DiscoveryReadCursor,
  type DiscoveryReadOutcome,
  type DiscoveryReadRequest,
} from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const SCOPE = DISCOVERY_DESK_SCOPE;

function requestOf(patch: Partial<DiscoveryReadRequest> = {}): DiscoveryReadRequest {
  return {
    scope: SCOPE,
    filter: EMPTY_DISCOVERY_FILTER,
    pageSize: DISCOVERY_READ_PAGE_BOUND,
    cursor: null,
    watermarkFloor: null,
    ...patch,
  };
}

async function readOnce(outcome: Promise<DiscoveryReadOutcome>): Promise<DiscoveryReadOutcome> {
  return outcome;
}

describe("discovery read tuple", () => {
  it("binds the read to the live pin tuple and consumed SDK", () => {
    expect(DISCOVERY_READ_RULING).toBe(
      "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce",
    );
    expect(() => assertDiscoveryReadTuple()).not.toThrow();
    expect(checkDiscoveryReadTuple()).toBeNull();
    const live = liveDiscoveryReadTuple();
    expect(live.contractOpenApiSha256).toBe(DISCOVERY_READ_TUPLE_LITERALS.contractOpenApiSha256);
    expect(live.gateOpenApiSha256).toBe(DISCOVERY_READ_TUPLE_LITERALS.gateOpenApiSha256);
    expect(live.protocolMergeSha).toBe(DISCOVERY_READ_TUPLE_LITERALS.protocolMergeSha);
    expect(live.pinnedActions).toEqual(DISCOVERY_READ_TUPLE_LITERALS.pinnedActions);
    expect(DISCOVERY_READ_TUPLE_LITERALS.sdkDigest).toBe(KIX_SDK_0_CONSUMPTION_DIGESTS.sdkDigest);
    expect(DISCOVERY_READ_TUPLE_LITERALS.manifestDigest).toBe(KIX_SDK_0_CONSUMPTION_DIGESTS.manifestDigest);
    expect(DISCOVERY_READ_TUPLE_LITERALS.vectorDigest).toBe(KIX_SDK_0_CONSUMPTION_DIGESTS.vectorDigest);
    const workflow = readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");
    const pinned = workflow.match(/KIX_PROTOCOL_GATE_SHA: ([0-9a-f]{40})/);
    expect(pinned?.[1]).toBe(DISCOVERY_READ_TUPLE_LITERALS.protocolMergeSha);
    expect(OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha).toBe(
      DISCOVERY_READ_TUPLE_LITERALS.protocolMergeSha,
    );
  });

  it.each(["sdkDigest", "manifestDigest", "vectorDigest"] as const)("fences %s drift before rows", async (field) => {
    for (const value of ["changed", null]) {
      let materialized = 0;
      const expectedTuple = { ...DISCOVERY_READ_TUPLE_LITERALS, [field]: value as unknown as string };
      const mismatch = checkDiscoveryReadTuple(expectedTuple);
      expect(mismatch).toEqual({ field: "sdkTuple", expected: `${field}:${value}`, actual: `${field}:${KIX_SDK_0_CONSUMPTION_DIGESTS[field]}` });
      const port = createStubDiscoveryRead({ expectedTuple, rowCount: 100, rowAt: (index) => {
        materialized += 1;
        return lazyDiscoveryRow(index);
      } });
      expect(await port.readPage(requestOf())).toMatchObject({ kind: "tuple-changed", field: "sdkTuple" });
      expect(await port.readRow("pro-0001", SCOPE)).toMatchObject({ kind: "tuple-changed", field: "sdkTuple" });
      expect(materialized).toBe(0);
    }
  });

  it("detects a changed projection tuple before any row is read", async () => {
    let materialized = 0;
    const port = createStubDiscoveryRead({
      rowCount: 100,
      rowAt: (index) => {
        materialized += 1;
        return lazyDiscoveryRow(index);
      },
      expectedTuple: {
        ...DISCOVERY_READ_TUPLE_LITERALS,
        protocolMergeSha: "0".repeat(40),
      },
    });
    const outcome = await readOnce(port.readPage(requestOf()));
    expect(materialized).toBe(0);
    expect(outcome).toMatchObject({ kind: "tuple-changed", field: "protocolMergeSha" });
    const rowOutcome = await port.readRow("pro-0001", SCOPE);
    expect(rowOutcome).toMatchObject({ kind: "tuple-changed" });
    expect(materialized).toBe(0);
  });
});

describe("discovery read bounds", () => {
  it("refuses an unbounded or malformed request before reading", async () => {
    const port = createStubDiscoveryRead();
    for (const pageSize of [0, -1, 1.5, DISCOVERY_READ_PAGE_BOUND + 1, Number.NaN]) {
      expect(await port.readPage(requestOf({ pageSize }))).toMatchObject({
        kind: "invalid-request",
        code: "PAGE_SIZE",
      });
    }
    expect(
      await port.readPage(requestOf({ filter: { ...EMPTY_DISCOVERY_FILTER, text: "x".repeat(DISCOVERY_READ_TEXT_BOUND + 1) } })),
    ).toMatchObject({ kind: "invalid-request", code: "FILTER" });
    expect(
      await port.readPage(
        requestOf({ filter: { ...EMPTY_DISCOVERY_FILTER, kinds: ["venue" as never] } }),
      ),
    ).toMatchObject({ kind: "invalid-request", code: "FILTER" });
    expect(
      await port.readPage(
        requestOf({ filter: { ...EMPTY_DISCOVERY_FILTER, statuses: ["refunded" as never] } }),
      ),
    ).toMatchObject({ kind: "invalid-request", code: "FILTER" });
    expect(
      await port.readPage(
        requestOf({ filter: { ...EMPTY_DISCOVERY_FILTER, from: "not-a-date" } }),
      ),
    ).toMatchObject({ kind: "invalid-request", code: "FILTER" });
    expect(
      await port.readPage(
        requestOf({ filter: { ...EMPTY_DISCOVERY_FILTER, from: "2026-10-20", to: "2026-10-01" } }),
      ),
    ).toMatchObject({ kind: "invalid-request", code: "FILTER" });
    expect(
      await port.readPage(requestOf({ scope: { tenantId: "tenant-other", subject: "desk" } })),
    ).toMatchObject({ kind: "invalid-request", code: "SCOPE" });
    expect(
      await port.readPage(requestOf({ scope: { tenantId: DISCOVERY_READ_TENANT, subject: "  " } })),
    ).toMatchObject({ kind: "invalid-request", code: "SCOPE" });
    expect(await port.readPage(requestOf({ watermarkFloor: "not-an-instant" }))).toMatchObject({
      kind: "invalid-request",
      code: "BOUND",
    });
  });

  it("serves bounded pages and never materializes the whole stream", async () => {
    let materialized = 0;
    const port = createStubDiscoveryRead({
      rowCount: 1_000_000,
      rowAt: (index) => {
        materialized += 1;
        return lazyDiscoveryRow(index);
      },
    });
    const first = await port.readPage(requestOf());
    expect(first.kind).toBe("ready");
    if (first.kind !== "ready") {
      return;
    }
    expect(first.rows.length).toBe(DISCOVERY_READ_PAGE_BOUND);
    expect(first.totalEstimate).toBe(1_000_000);
    expect(first.scannedCount).toBe(DISCOVERY_READ_PAGE_BOUND);
    expect(materialized).toBe(DISCOVERY_READ_PAGE_BOUND);
    expect(first.nextCursor).not.toBeNull();

    const second = await port.readPage(requestOf({ cursor: first.nextCursor }));
    expect(second.kind).toBe("ready");
    if (second.kind !== "ready") {
      return;
    }
    expect(second.rows[0]?.sequence).toBe(DISCOVERY_READ_PAGE_BOUND + 1);
    expect(materialized).toBe(DISCOVERY_READ_PAGE_BOUND * 2);
  });
});

describe("discovery read paging", () => {
  it("walks the stream to the end and marks rows non-confirming", async () => {
    const port = createStubDiscoveryRead();
    let cursor: DiscoveryReadCursor | null = null;
    const seen: number[] = [];
    for (let turn = 0; turn < 8; turn += 1) {
      const outcome = await port.readPage(requestOf({ cursor }));
      expect(outcome.kind).toBe("ready");
      if (outcome.kind !== "ready") {
        return;
      }
      seen.push(...outcome.rows.map((row) => row.sequence));
      cursor = outcome.nextCursor;
      if (cursor === null) {
        break;
      }
    }
    expect(cursor).toBeNull();
    expect(seen.length).toBe(96);
    expect(new Set(seen).size).toBe(96);
    expect(seen[0]).toBe(1);
    expect(seen[seen.length - 1]).toBe(96);
    for (const sequence of seen.slice(1)) {
      expect(sequence).toBeGreaterThan(seen[seen.indexOf(sequence) - 1] ?? 0);
    }
    const portAgain = createStubDiscoveryRead();
    const outcome = await portAgain.readPage(requestOf());
    expect(outcome.kind).toBe("ready");
    if (outcome.kind !== "ready") {
      return;
    }
    for (const row of outcome.rows) {
      expect(row.confirmsSale).toBe(false);
      expect(row.confirmsOwnership).toBe(false);
      expect(row.confirmsPayment).toBe(false);
    }
  });

  it("applies the validated filter inside the bounded window", async () => {
    const port = createStubDiscoveryRead();
    const outcome = await port.readPage(
      requestOf({ filter: { ...EMPTY_DISCOVERY_FILTER, kinds: ["listing"] } }),
    );
    expect(outcome.kind).toBe("ready");
    if (outcome.kind !== "ready") {
      return;
    }
    expect(outcome.scannedCount).toBe(DISCOVERY_READ_PAGE_BOUND);
    expect(outcome.rows.every((row) => row.kind === "listing")).toBe(true);
    expect(outcome.rows.length).toBeLessThan(DISCOVERY_READ_PAGE_BOUND);

    const text = await createStubDiscoveryRead().readPage(
      requestOf({ filter: { ...EMPTY_DISCOVERY_FILTER, text: "lanterns" } }),
    );
    expect(text.kind).toBe("ready");
    if (text.kind === "ready") {
      expect(text.rows.length).toBeGreaterThan(0);
      expect(text.rows.every((row) => row.title.toLowerCase().includes("lanterns"))).toBe(true);
    }
  });
});

describe("discovery read cursor", () => {
  async function firstCursor(port: ReturnType<typeof createStubDiscoveryRead>): Promise<DiscoveryReadCursor> {
    const outcome = await port.readPage(requestOf());
    if (outcome.kind !== "ready" || outcome.nextCursor === null) {
      throw new Error("expected a ready first page with a cursor");
    }
    return outcome.nextCursor;
  }

  it("accepts its own cursor and rejects a changed filter", async () => {
    const port = createStubDiscoveryRead();
    const cursor = await firstCursor(port);
    const next = await port.readPage(requestOf({ cursor }));
    expect(next.kind).toBe("ready");
    const mismatch = await port.readPage(
      requestOf({ cursor, filter: { ...EMPTY_DISCOVERY_FILTER, kinds: ["event"] } }),
    );
    expect(mismatch).toMatchObject({ kind: "cursor-invalid", code: "FILTER" });
  });

  it("rejects a cursor after the projection is rebuilt", async () => {
    const port = createStubDiscoveryRead();
    const cursor = await firstCursor(port);
    const rebuilt = createStubDiscoveryRead({ revision: "syn-2" });
    expect(await rebuilt.readPage(requestOf({ cursor }))).toMatchObject({
      kind: "cursor-invalid",
      code: "REBUILT",
    });
    const fresh = await rebuilt.readPage(requestOf());
    expect(fresh.kind).toBe("ready");
    if (fresh.kind === "ready" && fresh.nextCursor) {
      expect(fresh.nextCursor.projectionRevision).toBe("syn-2");
    }
  });

  it("rejects a cursor for another tenant, a wrong version, and bad shapes", async () => {
    const port = createStubDiscoveryRead();
    const cursor = await firstCursor(port);
    expect(
      await port.readPage(requestOf({ cursor: { ...cursor, tenantId: "tenant-other" } })),
    ).toMatchObject({ kind: "cursor-invalid", code: "TENANT" });
    expect(
      await port.readPage(requestOf({ cursor: { ...cursor, cursorVersion: 2 } })),
    ).toMatchObject({ kind: "cursor-invalid", code: "VERSION" });
    expect(
      await port.readPage(requestOf({ cursor: { ...cursor, projectionName: "other" } })),
    ).toMatchObject({ kind: "cursor-invalid", code: "SHAPE" });
    expect(
      await port.readPage(requestOf({ cursor: { ...cursor, afterSequence: 10_000_000 } })),
    ).toMatchObject({ kind: "cursor-invalid", code: "SHAPE" });
    expect(
      await port.readPage(requestOf({ cursor: { ...cursor, watermark: "not-an-instant" } })),
    ).toMatchObject({ kind: "cursor-invalid", code: "SHAPE" });
    expect(
      await port.readPage(requestOf({ cursor: "opaque" as unknown as DiscoveryReadCursor })),
    ).toMatchObject({ kind: "cursor-invalid", code: "SHAPE" });
    const good = cursor;
    expect(good.projectionName).toBe(DISCOVERY_PROJECTION_NAME);
    expect(good.projectionRevision).toBe(DISCOVERY_PROJECTION_REVISION);
    expect(good.cursorVersion).toBe(DISCOVERY_CURSOR_VERSION);
    expect(good.filterKey).toBe(discoveryFilterKey(EMPTY_DISCOVERY_FILTER));
  });
});

describe("discovery read stream integrity", () => {
  async function secondPage(stream: (typeof DISCOVERY_STREAMS)[number]): Promise<DiscoveryReadOutcome> {
    const port = createStubDiscoveryRead({ stream });
    const first = await port.readPage(requestOf());
    if (first.kind !== "ready" || first.nextCursor === null) {
      throw new Error(`expected first page ready on ${stream}, received ${first.kind}`);
    }
    return port.readPage(requestOf({ cursor: first.nextCursor }));
  }

  it("detects a duplicated row across pages", async () => {
    const outcome = await secondPage("duplicate");
    expect(outcome).toMatchObject({ kind: "gap", code: "DUPLICATE" });
  });

  it("detects an out-of-order row", async () => {
    const outcome = await secondPage("reorder");
    expect(outcome).toMatchObject({ kind: "gap", code: "ORDER" });
  });

  it("detects a skipped sequence", async () => {
    const outcome = await secondPage("gap");
    expect(outcome).toMatchObject({ kind: "gap", code: "SEQUENCE" });
  });

  it("detects a row from another tenant", async () => {
    const outcome = await secondPage("tenant-mix");
    expect(outcome).toMatchObject({ kind: "tenant-mismatch", tenantId: "tenant-other" });
  });

  it("detects a stale watermark", async () => {
    const port = createStubDiscoveryRead({ stream: "stale" });
    const outcome = await port.readPage(requestOf());
    expect(outcome.kind).toBe("stale");
    if (outcome.kind === "stale") {
      expect(Date.parse(outcome.watermark)).toBeLessThan(Date.parse(outcome.floor));
    }
  });

  it("does not book seen rows on a refused page, so one more attempt stays clean", async () => {
    const port = createStubDiscoveryRead({ stream: "duplicate" });
    const first = await port.readPage(requestOf());
    expect(first.kind).toBe("ready");
    const second = await port.readPage(
      requestOf({ cursor: first.kind === "ready" ? first.nextCursor : null }),
    );
    expect(second.kind).toBe("gap");
    port.reset();
    const again = await port.readPage(requestOf());
    expect(again.kind).toBe("ready");
  });
});

describe("discovery read detail and not-bound port", () => {
  it("reads one row and refuses a wrong shape or scope", async () => {
    const port = createStubDiscoveryRead();
    const ready = await port.readRow("pro-0001", SCOPE);
    expect(ready.kind).toBe("ready");
    if (ready.kind === "ready") {
      expect(ready.row.rowId).toBe("pro-0001");
      expect(ready.row.confirmsSale).toBe(false);
    }
    expect(await port.readRow("pro-9999", SCOPE)).toMatchObject({ kind: "empty" });
    expect(await port.readRow("syn-event-lanterns", SCOPE)).toMatchObject({
      kind: "invalid-request",
      code: "ROW_ID",
    });
    expect(
      await port.readRow("pro-0001", { tenantId: "tenant-other", subject: "desk" }),
    ).toMatchObject({ kind: "invalid-request", code: "SCOPE" });
    const stale = await createStubDiscoveryRead({ stream: "stale" }).readRow("pro-0001", SCOPE);
    expect(stale.kind).toBe("stale");
  });

  it("keeps the read not-bound on integration-http without touching the stub", async () => {
    const port = discoveryReadPortFor("integration-http");
    expect(port.environment).toBe("integration-http");
    expect(port.source).toBe("none");
    expect(await port.readPage(requestOf())).toEqual({
      kind: "not-bound",
      reason: DISCOVERY_READ_NOT_BOUND_REASON,
    });
    expect(await port.readRow("pro-0001", SCOPE)).toEqual({
      kind: "not-bound",
      reason: DISCOVERY_READ_NOT_BOUND_REASON,
    });
    const stub = discoveryReadPortFor("stub");
    expect(stub.environment).toBe("stub");
    expect(stub.source).toBe("synthetic-projection");
  });
});
