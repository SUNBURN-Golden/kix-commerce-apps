import { describe, expect, it } from "vitest";

import {
  DISCOVERY_READ_TUPLE_LITERALS,
  EMPTY_MARKETPLACE_FILTER,
  MARKETPLACE_FOREIGN_TENANT,
  MARKETPLACE_PAGE_BOUND,
  MARKETPLACE_SCENARIOS,
  MARKETPLACE_SYNTHETIC_CONTROLS,
  MARKETPLACE_TENANT,
  MARKETPLACE_TERMS_START,
  MARKETPLACE_TEXT_BOUND,
  MARKETPLACE_TOTAL_LISTINGS,
  createNotBoundMarketplaceBench,
  createStubMarketplaceBench,
  marketplaceBenchPortFor,
  marketplaceRowAt,
  type MarketplaceQueueRequest,
  type MarketplaceReadRequest,
} from "../src/index.js";

const DESK_SCOPE = { tenantId: MARKETPLACE_TENANT, subject: "marketplace-bench" };

function request(overrides: Partial<MarketplaceReadRequest> = {}): MarketplaceReadRequest {
  return {
    contextKey: "test-context",
    scope: DESK_SCOPE,
    filter: EMPTY_MARKETPLACE_FILTER,
    pageSize: MARKETPLACE_PAGE_BOUND,
    cursor: null,
    watermarkFloor: null,
    termsRef: null,
    workload: "browse-window",
    deviceClass: "desktop-browser",
    ...overrides,
  };
}

function queueRequest(overrides: Partial<MarketplaceQueueRequest> = {}): MarketplaceQueueRequest {
  return {
    contextKey: "test-context",
    scope: DESK_SCOPE,
    workload: "hot-page",
    deviceClass: "desktop-browser",
    ...overrides,
  };
}

describe("marketplace-performance port", () => {
  it("advertises a fixed scenario and control vocabulary", () => {
    expect([...MARKETPLACE_SCENARIOS]).toEqual([
      "clean",
      "empty",
      "stale",
      "slow",
      "held",
      "contended",
      "queue-lapsed",
      "permission-lost",
      "terms-moved",
      "read-lost",
      "claims-price",
      "claims-device",
    ]);
    expect([...MARKETPLACE_SYNTHETIC_CONTROLS]).toEqual([
      "deliver-held",
      "expire-queue",
      "revoke-permission",
      "restore-permission",
      "move-terms",
    ]);
  });

  it("readPage returns a bounded window over a lazy 150k projection", async () => {
    const port = createStubMarketplaceBench({ scenario: "clean" });
    const outcome = await port.readPage(request());
    expect(outcome.kind).toBe("ready");
    if (outcome.kind !== "ready") {
      return;
    }
    expect(outcome.rows).toHaveLength(MARKETPLACE_PAGE_BOUND);
    expect(outcome.rows[0]?.sequence).toBe(1);
    expect(outcome.rows[0]?.listingRef).toBe("mkl-000001");
    expect(outcome.rows[0]?.confirmsPrice).toBe(false);
    expect(outcome.rows[0]?.confirmsRight).toBe(false);
    expect(outcome.rows[0]?.confirmsSale).toBe(false);
    expect(outcome.rows[0]?.confirmsOwnership).toBe(false);
    expect(outcome.totalEstimate).toBe(MARKETPLACE_TOTAL_LISTINGS);
    expect(outcome.scannedCount).toBe(MARKETPLACE_PAGE_BOUND);
    expect(outcome.producerLoadMeasurement).toBe(false);
    expect(outcome.realDeviceEvidence).toBe(false);
    expect(outcome.offeredMs).toBeGreaterThan(0);
    expect(outcome.termsRef).toBe(MARKETPLACE_TERMS_START);
    expect(outcome.nextCursor?.termsRef).toBe(MARKETPLACE_TERMS_START);
    expect(outcome.nextCursor?.afterSequence).toBe(MARKETPLACE_PAGE_BOUND);
  });

  it("pages through cursors and validates them strictly", async () => {
    const port = createStubMarketplaceBench({ scenario: "clean" });
    const page1 = await port.readPage(request());
    if (page1.kind !== "ready" || !page1.nextCursor) {
      throw new Error("expected first page");
    }
    const page2 = await port.readPage(request({ cursor: page1.nextCursor }));
    expect(page2.kind).toBe("ready");
    if (page2.kind === "ready") {
      expect(page2.rows[0]?.sequence).toBe(MARKETPLACE_PAGE_BOUND + 1);
    }
    const foreign = await port.readPage(
      request({ cursor: { ...page1.nextCursor, tenantId: MARKETPLACE_FOREIGN_TENANT } }),
    );
    expect(foreign).toMatchObject({ kind: "cursor-invalid", code: "TENANT" });
    const wrongFilter = await port.readPage(
      request({ cursor: page1.nextCursor, filter: { text: "else" } }),
    );
    expect(wrongFilter).toMatchObject({ kind: "cursor-invalid", code: "FILTER" });
    const wrongVersion = await port.readPage(
      request({ cursor: { ...page1.nextCursor, cursorVersion: 99 } }),
    );
    expect(wrongVersion).toMatchObject({ kind: "cursor-invalid", code: "VERSION" });
  });

  it("refuses over-bound page sizes and filter text instead of clamping", async () => {
    const port = createStubMarketplaceBench({ scenario: "clean" });
    const page = await port.readPage(request({ pageSize: MARKETPLACE_PAGE_BOUND + 1 }));
    expect(page).toMatchObject({ kind: "invalid-request", code: "PAGE_SIZE" });
    const text = await port.readPage(
      request({ filter: { text: "x".repeat(MARKETPLACE_TEXT_BOUND + 1) } }),
    );
    expect(text).toMatchObject({ kind: "invalid-request", code: "FILTER" });
    const workload = await port.readPage(request({ workload: "bogus" as never }));
    expect(workload).toMatchObject({ kind: "invalid-request", code: "WORKLOAD" });
    const device = await port.readPage(request({ deviceClass: "real-mobile" as never }));
    expect(device).toMatchObject({ kind: "invalid-request", code: "DEVICE" });
  });

  it("keeps the window bounded under a filter and reports the scanned count", async () => {
    const port = createStubMarketplaceBench({ scenario: "clean" });
    const outcome = await port.readPage(request({ filter: { text: "scale hall" } }));
    expect(outcome.kind).toBe("ready");
    if (outcome.kind === "ready") {
      expect(outcome.rows.length).toBeLessThanOrEqual(MARKETPLACE_PAGE_BOUND);
      expect(outcome.scannedCount).toBe(MARKETPLACE_PAGE_BOUND);
      expect(outcome.rows.every((row) => row.venueLabel === "Scale hall")).toBe(true);
    }
  });

  it("reports a stale watermark instead of confirming old prices", async () => {
    const port = createStubMarketplaceBench({ scenario: "stale" });
    const outcome = await port.readPage(request());
    expect(outcome).toMatchObject({ kind: "stale" });
  });

  it("blocks the hot-page workload until the queue admits the caller", async () => {
    const port = createStubMarketplaceBench({ scenario: "clean" });
    const blocked = await port.readPage(request({ workload: "hot-page" }));
    expect(blocked).toMatchObject({ kind: "queue-blocked" });
    const join = await port.joinQueue(queueRequest());
    expect(join.kind).toBe("queued");
    if (join.kind === "queued") {
      expect(join.queue.state).toBe("waiting");
      expect(join.queue.grantsReservation).toBe(false);
      expect(join.queue.grantsPayment).toBe(false);
      expect(join.queue.grantsRight).toBe(false);
    }
    const admitted = await port.readQueue(queueRequest());
    expect(admitted.kind).toBe("queue-state");
    if (admitted.kind === "queue-state") {
      expect(admitted.queue.state).toBe("admitted");
      expect(admitted.queue.grantsBrowseAccess).toBe(true);
    }
    const ready = await port.readPage(request({ workload: "hot-page" }));
    expect(ready.kind).toBe("ready");
  });

  it("walks a contended queue down a position before admitting", async () => {
    const port = createStubMarketplaceBench({ scenario: "contended" });
    await port.joinQueue(queueRequest());
    const first = await port.readQueue(queueRequest());
    if (first.kind !== "queue-state") {
      throw new Error("expected queue-state");
    }
    expect(first.queue.state).toBe("waiting");
    expect(first.queue.position).toBe(1);
    const second = await port.readQueue(queueRequest());
    expect(second.kind === "queue-state" && second.queue.state).toBe("admitted");
  });

  it("expires queue admission so the page never fast-confirms a lapsed seat", async () => {
    const port = createStubMarketplaceBench({ scenario: "clean" });
    await port.joinQueue(queueRequest());
    await port.readQueue(queueRequest());
    expect(port.synthetic("expire-queue")).toBe(true);
    const outcome = await port.readPage(request({ workload: "hot-page" }));
    expect(outcome).toMatchObject({ kind: "queue-expired" });
    if (outcome.kind === "queue-expired") {
      expect(outcome.queue.grantsBrowseAccess).toBe(false);
    }
  });

  it("models a lapsed queue under the queue-lapsed scenario", async () => {
    const port = createStubMarketplaceBench({ scenario: "queue-lapsed" });
    const join = await port.joinQueue(queueRequest());
    expect(join.kind).toBe("queued");
    if (join.kind === "queued") {
      expect(join.queue.state).toBe("expired");
      expect(join.queue.grantsBrowseAccess).toBe(false);
    }
    const page = await port.readPage(request({ workload: "hot-page" }));
    expect(page).toMatchObject({ kind: "queue-expired" });
  });

  it("moves terms and refuses a held reference instead of confirming stale rights", async () => {
    const port = createStubMarketplaceBench({ scenario: "clean" });
    const first = await port.readPage(request());
    expect(first.kind).toBe("ready");
    port.synthetic("move-terms");
    const second = await port.readPage(request({ termsRef: MARKETPLACE_TERMS_START }));
    expect(second).toMatchObject({ kind: "terms-moved", held: MARKETPLACE_TERMS_START, current: "trm-02" });
    // A read under the moved terms is served: a fresh window on a fresh port.
    const moved = createStubMarketplaceBench({ scenario: "clean" });
    moved.synthetic("move-terms");
    const fresh = await moved.readPage(request({ termsRef: "trm-02" }));
    expect(fresh.kind).toBe("ready");
  });

  it("moves the terms under every read in the terms-moved scenario", async () => {
    const port = createStubMarketplaceBench({ scenario: "terms-moved" });
    const first = await port.readPage(request());
    expect(first.kind).toBe("ready");
    if (first.kind !== "ready") {
      return;
    }
    const second = await port.readPage(request({ termsRef: first.termsRef }));
    expect(second).toMatchObject({ kind: "terms-moved", held: first.termsRef });
  });

  it("denies reads after a permission revocation until the desk is restored", async () => {
    const port = createStubMarketplaceBench({ scenario: "clean" });
    port.synthetic("revoke-permission");
    const denied = await port.readPage(request());
    expect(denied).toMatchObject({ kind: "denied", code: "PERMISSION_REVOKED" });
    port.synthetic("restore-permission");
    const restored = await port.readPage(request());
    expect(restored.kind).toBe("ready");
  });

  it("denies every call under permission-lost, including the queue", async () => {
    const port = createStubMarketplaceBench({ scenario: "permission-lost" });
    const denied = await port.readPage(request());
    expect(denied).toMatchObject({ kind: "denied", code: "PERMISSION_REVOKED" });
    const join = await port.joinQueue(queueRequest());
    expect(join).toMatchObject({ kind: "denied", code: "PERMISSION_REVOKED" });
    const foreign = await port.readPage(request({ scope: { tenantId: MARKETPLACE_FOREIGN_TENANT, subject: "marketplace-bench" } }));
    expect(foreign).toMatchObject({ kind: "denied", code: "FOREIGN_TENANT" });
  });

  it("holds answers under held until deliver-held releases them", async () => {
    const port = createStubMarketplaceBench({ scenario: "held" });
    let settled: string | null = null;
    const pending = port.readPage(request()).then((outcome) => {
      settled = outcome.kind;
      return outcome;
    });
    await Promise.resolve();
    expect(settled).toBeNull();
    expect(port.synthetic("deliver-held")).toBe(true);
    const outcome = await pending;
    expect(outcome.kind).toBe("ready");
  });

  it("never resolves a lost answer so the caller can only cancel or show unknown", async () => {
    const port = createStubMarketplaceBench({ scenario: "read-lost" });
    let settled = false;
    void port.readPage(request()).then(() => {
      settled = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
  });

  it("refuses a payload that claims a price or a real device", async () => {
    const price = createStubMarketplaceBench({ scenario: "claims-price" });
    const priceOutcome = await price.readPage(request());
    expect(priceOutcome).toMatchObject({ kind: "refused", code: "PRICE_CLAIM" });
    const device = createStubMarketplaceBench({ scenario: "claims-device" });
    const deviceOutcome = await device.readPage(request());
    expect(deviceOutcome).toMatchObject({ kind: "refused", code: "DEVICE_CLAIM" });
  });

  it("reports a drifted tuple instead of failing closed silently", async () => {
    const port = createStubMarketplaceBench({
      scenario: "clean",
      expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, contractMainSha: "0".repeat(40) },
    });
    const outcome = await port.readPage(request());
    expect(outcome).toMatchObject({ kind: "tuple-changed", field: "contractMainSha" });
    const join = await port.joinQueue(queueRequest());
    expect(join.kind).toBe("tuple-changed");
  });

  it("flags sequence gaps, order faults and duplicates in the stream", async () => {
    const gapped = createStubMarketplaceBench({
      scenario: "clean",
      rowAt: (index) => marketplaceRowAt(index === 1 ? 3 : index),
    });
    const gapOutcome = await gapped.readPage(request({ pageSize: 4 }));
    expect(gapOutcome).toMatchObject({ kind: "gap", code: "SEQUENCE" });

    const dup = createStubMarketplaceBench({
      scenario: "clean",
      rowAt: (index) => {
        const row = marketplaceRowAt(index);
        return index === 1 ? { ...row, listingRef: "mkl-000001" } : row;
      },
    });
    const dupOutcome = await dup.readPage(request({ pageSize: 4 }));
    expect(dupOutcome).toMatchObject({ kind: "gap", code: "DUPLICATE" });
  });

  it("returns an empty read without inventing rows", async () => {
    const port = createStubMarketplaceBench({ scenario: "empty" });
    const outcome = await port.readPage(request());
    expect(outcome).toMatchObject({ kind: "empty", totalEstimate: 0 });
  });

  it("keeps the not-bound port bound to nothing and records why", async () => {
    const port = createNotBoundMarketplaceBench();
    const outcome = await port.readPage(request());
    expect(outcome).toMatchObject({ kind: "not-bound" });
    const join = await port.joinQueue(queueRequest());
    expect(join).toMatchObject({ kind: "not-bound" });
    const queue = await port.readQueue(queueRequest());
    expect(queue).toMatchObject({ kind: "not-bound" });
    expect(port.synthetic("deliver-held")).toBe(false);
  });

  it("routes the port factory by environment", async () => {
    const stub = marketplaceBenchPortFor("stub", { scenario: "clean" });
    const outcome = await stub.readPage(request());
    expect(outcome.kind).toBe("ready");
    const notBound = marketplaceBenchPortFor("integration-http");
    const denied = await notBound.readPage(request());
    expect(denied).toMatchObject({ kind: "not-bound" });
  });
});
