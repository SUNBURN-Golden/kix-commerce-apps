import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  DISCOVERY_DESK_SCOPE,
  DISCOVERY_PROJECTION_REVISION,
  DISCOVERY_READ_NOT_BOUND_REASON,
  DISCOVERY_READ_PAGE_BOUND,
  EMPTY_DISCOVERY_FILTER,
  createStubDiscoveryRead,
  discoveryReadPortFor,
  type DiscoveryReadFilter,
  type DiscoveryReadOutcome,
  type DiscoveryRowOutcome,
  type DiscoveryStreamKind,
} from "@kix/protocol-adapter";
import {
  LIVE_READ_BOUNDARY,
  LIVE_READ_REBUILD_LABEL,
  LIVE_READ_SOURCE_LINE,
  LIVE_READ_TITLE,
  buildLiveDetailModel,
  buildLiveListModel,
  liveReturnMode,
  type LiveListModel,
} from "../src/discovery-live";
import { LiveReadDetail, LiveReadSection } from "../src/pages/DiscoveryPanels";

const BANNED = /[$₩]|KRW|USD|still open|in stock/i;
const SCOPE = DISCOVERY_DESK_SCOPE;
const FILTER: DiscoveryReadFilter = EMPTY_DISCOVERY_FILTER;

function requestOf(patch: Record<string, unknown> = {}) {
  return {
    scope: SCOPE,
    filter: FILTER,
    pageSize: DISCOVERY_READ_PAGE_BOUND,
    cursor: null,
    watermarkFloor: null,
    ...patch,
  };
}

async function secondPage(stream: DiscoveryStreamKind): Promise<DiscoveryReadOutcome> {
  const port = createStubDiscoveryRead({ stream });
  const first = await port.readPage(requestOf());
  if (first.kind !== "ready" || first.nextCursor === null) {
    throw new Error(`expected first page ready on ${stream}, got ${first.kind}`);
  }
  return port.readPage(requestOf({ cursor: first.nextCursor }));
}

function modelFor(outcome: DiscoveryReadOutcome, stream: DiscoveryStreamKind = "clean"): LiveListModel {
  return buildLiveListModel({
    stream,
    revision: DISCOVERY_PROJECTION_REVISION,
    filter: FILTER,
    outcome,
    canNext: outcome.kind === "ready" && outcome.nextCursor !== null,
  });
}

const NO_HANDLERS = {
  nextPage() {},
  runReturn() {},
  setStream() {},
  setFilter() {},
  rebuildProjection() {},
};

function renderList(model: LiveListModel): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <LiveReadSection model={model} handlers={NO_HANDLERS} onOpen={() => undefined} />
    </MemoryRouter>,
  );
}

function renderDetail(outcome: DiscoveryRowOutcome): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <LiveReadDetail model={buildLiveDetailModel({ outcome })} handlers={{ readAgain() {} }} />
    </MemoryRouter>,
  );
}

describe("discovery live read section", () => {
  it("renders a ready synthetic page with the boundary copy and no purchase link", async () => {
    const outcome = await createStubDiscoveryRead().readPage(requestOf());
    expect(outcome.kind).toBe("ready");
    const html = renderList(modelFor(outcome));
    expect(html).toContain(LIVE_READ_TITLE);
    expect(html).toContain(LIVE_READ_SOURCE_LINE);
    expect(html).toContain(LIVE_READ_BOUNDARY);
    expect(html).toContain("Projection page ready.");
    expect(html).toContain('data-live-state="ready"');
    expect(html).toContain('data-source="synthetic-projection"');
    expect(html).toContain('role="listbox"');
    expect(html).toContain('aria-label="Synthetic projection rows"');
    expect(html).toContain("sequence 1");
    expect(html).toContain("Next page");
    expect(html).toContain(LIVE_READ_REBUILD_LABEL);
    expect(html).not.toContain("Start over");
    expect(html).not.toContain("Read again");
    expect(html).not.toContain("Back to first page");
    expect(html).not.toContain('href="/booking/');
    expect(html).not.toMatch(BANNED);
    if (outcome.kind === "ready") {
      expect(outcome.rows.length).toBe(DISCOVERY_READ_PAGE_BOUND);
      const rows = html.match(/data-source="synthetic-projection"/g) ?? [];
      expect(rows.length).toBe(DISCOVERY_READ_PAGE_BOUND + 1);
    }
  });

  it("maps duplicate, out-of-order, and skipped rows to a start-over action", async () => {
    for (const [stream, code] of [
      ["duplicate", "DUPLICATE"],
      ["reorder", "ORDER"],
      ["gap", "SEQUENCE"],
    ] as const) {
      const outcome = await secondPage(stream);
      const model = modelFor(outcome, stream);
      expect(model.state).toBe("gap");
      expect(model.statusLine).toContain(`Gap in the synthetic stream (${code})`);
      expect(model.actionLabel).toBe("Start over");
      const html = renderList(model);
      expect(html).toContain(`Gap in the synthetic stream (${code})`);
      expect(html).toContain(">Start over<");
      expect(html).not.toContain('data-source="synthetic-projection" data-kind');
      expect(html).not.toMatch(BANNED);
    }
  });

  it("maps a foreign tenant row to a start-over action with the tenant id", async () => {
    const outcome = await secondPage("tenant-mix");
    const model = modelFor(outcome, "tenant-mix");
    expect(model.state).toBe("tenant-mismatch");
    expect(model.statusLine).toBe("A row from another tenant arrived.");
    expect(model.detailLine).toContain("tenant-other");
    expect(model.actionLabel).toBe("Start over");
    const html = renderList(model);
    expect(html).toContain("A row from another tenant arrived.");
    expect(html).toContain("tenant-other");
    expect(html).toContain(">Start over<");
  });

  it("maps a stale watermark to a read-again action", async () => {
    const outcome = await createStubDiscoveryRead({ stream: "stale" }).readPage(requestOf());
    const model = modelFor(outcome, "stale");
    expect(model.state).toBe("stale");
    expect(model.statusLine).toBe("Stale projection watermark.");
    expect(model.actionLabel).toBe("Read again");
    const html = renderList(model);
    expect(html).toContain("Stale projection watermark.");
    expect(html).toContain(">Read again<");
  });

  it("maps a rebuilt projection cursor to a back-to-first-page action", async () => {
    const first = await createStubDiscoveryRead().readPage(requestOf());
    if (first.kind !== "ready" || first.nextCursor === null) {
      throw new Error("expected a first page with a cursor");
    }
    const rebuilt = createStubDiscoveryRead({ revision: "syn-2" });
    const outcome = await rebuilt.readPage(requestOf({ cursor: first.nextCursor }));
    const model = modelFor(outcome);
    expect(model.state).toBe("cursor-invalid");
    expect(model.statusLine).toBe("Cursor invalid (REBUILT).");
    expect(model.actionLabel).toBe("Back to first page");
    const html = renderList(model);
    expect(html).toContain("Cursor invalid (REBUILT).");
    expect(html).toContain(">Back to first page<");
  });

  it("renders the not-bound reason on integration-http with no action", async () => {
    const outcome = await discoveryReadPortFor("integration-http").readPage(requestOf());
    const model = modelFor(outcome);
    expect(model.state).toBe("not-bound");
    expect(model.statusLine).toBe(DISCOVERY_READ_NOT_BOUND_REASON);
    expect(model.actionLabel).toBeNull();
    const html = renderList(model);
    expect(html).toContain(DISCOVERY_READ_NOT_BOUND_REASON);
    expect(html).toContain('data-live-state="not-bound"');
    expect(html).not.toContain("Start over");
    expect(html).not.toContain('href="/booking/');
  });

  it("keeps the page bounded even when the stream reports a million rows", async () => {
    const port = createStubDiscoveryRead({
      rowCount: 1_000_000,
      rowAt: (index) => ({
        rowId: `pro-${String(index + 1).padStart(4, "0")}`,
        sequence: index + 1,
        title: `Synthetic stream row ${index + 1}`,
        kind: "event",
        statusLabel: "on-sale",
        venueLabel: "Scale venue",
        startsAt: "2026-10-14T00:00:00.000Z",
        watermark: "2026-10-13T00:00:00.000Z",
        tenantId: "tenant-desk",
        confirmsSale: false as const,
        confirmsOwnership: false as const,
        confirmsPayment: false as const,
      }),
    });
    const outcome = await port.readPage(requestOf());
    const model = modelFor(outcome);
    expect(model.rows.length).toBe(DISCOVERY_READ_PAGE_BOUND);
    expect(model.metaLine).toContain("about 1000000 rows");
    const html = renderList(model);
    expect(html).toContain("about 1000000 rows in the stream");
    expect((html.match(/<li\b/g) ?? []).length).toBeLessThanOrEqual(DISCOVERY_READ_PAGE_BOUND);
  });
});

describe("discovery live read detail", () => {
  it("renders a projection row as synthetic and never confirms trade facts", async () => {
    const outcome = await createStubDiscoveryRead().readRow("pro-0001", SCOPE);
    const html = renderDetail(outcome);
    expect(html).toContain("SYNTHETIC PROJECTION");
    expect(html).toContain('data-source="synthetic-projection"');
    expect(html).toContain("Lanterns");
    expect(html).toContain(LIVE_READ_BOUNDARY);
    expect(html).toContain("No purchase path runs from a projection row.");
    expect(html).not.toContain('href="/booking/');
    expect(html).not.toMatch(BANNED);
  });

  it("shows the empty detail state and the stale detail state", async () => {
    const empty = renderDetail(await createStubDiscoveryRead().readRow("pro-9999", SCOPE));
    expect(empty).toContain("No projection row for this id.");
    expect(empty).not.toContain("Read again");

    const stale = renderDetail(
      await createStubDiscoveryRead({ stream: "stale" }).readRow("pro-0001", SCOPE),
    );
    expect(stale).toContain("Stale projection watermark.");
    expect(stale).toContain(">Read again<");
  });
});

describe("live return mode", () => {
  it("maps every outcome kind to one user action", () => {
    expect(liveReturnMode({ kind: "loading" })).toBeNull();
    expect(
      liveReturnMode({
        kind: "ready",
        rows: [],
        nextCursor: null,
        watermark: null,
        totalEstimate: 0,
        scannedCount: 0,
        revision: "syn-1",
      }),
    ).toBeNull();
    expect(
      liveReturnMode({ kind: "empty", watermark: null, totalEstimate: 0, revision: "syn-1" }),
    ).toBeNull();
    expect(liveReturnMode({ kind: "gap", code: "DUPLICATE", detail: "d" })).toBe("resync");
    expect(liveReturnMode({ kind: "stale", watermark: "w", floor: "f" })).toBe("again");
    expect(liveReturnMode({ kind: "cursor-invalid", code: "REBUILT", detail: "d" })).toBe("first");
    expect(liveReturnMode({ kind: "tenant-mismatch", rowId: "r", tenantId: "t" })).toBe("resync");
    expect(
      liveReturnMode({ kind: "tuple-changed", field: "protocolMergeSha", expected: "a", actual: "b" }),
    ).toBe("resync");
    expect(liveReturnMode({ kind: "not-bound", reason: "r" })).toBeNull();
    expect(liveReturnMode({ kind: "invalid-request", code: "PAGE_SIZE", detail: "d" })).toBe("first");
    expect(liveReturnMode({ kind: "unknown", message: "m" })).toBe("again");
  });
});
