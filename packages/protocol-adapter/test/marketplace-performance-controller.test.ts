import { describe, expect, it } from "vitest";

import {
  DISCOVERY_READ_TUPLE_LITERALS,
  MARKETPLACE_PAGE_BOUND,
  MARKETPLACE_TOTAL_LISTINGS,
  MarketplaceBenchController,
  createNotBoundMarketplaceBench,
  createStubMarketplaceBench,
  type MarketplaceBenchPort,
} from "../src/index.js";

function controller(
  port: MarketplaceBenchPort,
  options: ConstructorParameters<typeof MarketplaceBenchController>[1] = {},
): MarketplaceBenchController {
  return new MarketplaceBenchController(port, options);
}

describe("marketplace-performance controller", () => {
  it("applies a bounded window and reports the fixed memory denominator", async () => {
    const bench = controller(createStubMarketplaceBench({ scenario: "clean" }));
    const result = await bench.read();
    expect(result).toMatchObject({ kind: "APPLIED", readState: "ready" });
    const state = bench.state();
    expect(state.readState).toBe("ready");
    expect(state.freshness).toBe("CURRENT");
    expect(state.snapshot?.rows).toHaveLength(MARKETPLACE_PAGE_BOUND);
    expect(state.snapshot?.termsRef).toBe("trm-01");
    expect(state.memory).toEqual({
      heldRows: MARKETPLACE_PAGE_BOUND,
      totalEstimate: MARKETPLACE_TOTAL_LISTINGS,
      pageBound: MARKETPLACE_PAGE_BOUND,
    });
    expect(state.counters.reads).toBe(1);
    expect(state.measurements).toHaveLength(1);
    expect(state.measurements[0]).toMatchObject({
      call: "read",
      workload: "browse-window",
      deviceClass: "desktop-browser",
      realDevice: true,
      outcome: "ready",
      denominator: "browser-boundary",
    });
  });

  it("pages once per call through the issued cursor", async () => {
    const bench = controller(createStubMarketplaceBench({ scenario: "clean" }));
    await bench.read();
    const second = await bench.nextPage();
    expect(second).toMatchObject({ kind: "APPLIED", readState: "ready" });
    expect(bench.state().snapshot?.rows[0]?.sequence).toBe(MARKETPLACE_PAGE_BOUND + 1);
    expect(bench.state().counters.reads).toBe(2);
  });

  it("never sends a page call without a cursor", async () => {
    const bench = controller(createStubMarketplaceBench({ scenario: "clean", rowCount: 10 }));
    await bench.read();
    const result = await bench.nextPage();
    expect(result).toMatchObject({ kind: "NOT_SENT", reason: "no-cursor" });
    expect(bench.state().counters.reads).toBe(1);
    expect(bench.state().counters.notSent).toBe(1);
  });

  it("refuses to send an over-bound filter", async () => {
    const bench = controller(createStubMarketplaceBench({ scenario: "clean" }));
    const result = await bench.search("x".repeat(65));
    expect(result).toMatchObject({ kind: "NOT_SENT", reason: "invalid" });
    expect(bench.state().counters.reads).toBe(0);
  });

  it("keeps each call's own filter in the applied snapshot", async () => {
    const bench = controller(createStubMarketplaceBench({ scenario: "clean" }));
    const result = await bench.search("scale hall");
    expect(result).toMatchObject({ kind: "APPLIED", readState: "ready" });
    expect(bench.state().snapshot?.filter.text).toBe("scale hall");
  });

  it("drops the older answer in a rapid search transition", async () => {
    const port = createStubMarketplaceBench({ scenario: "held" });
    const bench = controller(port);
    const first = bench.read();
    const second = bench.search("z");
    expect(bench.state().inFlight).toHaveLength(2);
    port.synthetic("deliver-held");
    const [r1, r2] = await Promise.all([first, second]);
    // The newer read won. The source refuses the overlapping second window as
    // a duplicate — a gap, never a confirmation — and the older answer is
    // dropped rather than applied over it.
    expect(r2).toMatchObject({ kind: "APPLIED", readState: "gap" });
    expect(r1).toMatchObject({ kind: "DROPPED", cause: "older-read" });
    const state = bench.state();
    expect(state.counters.droppedOlder).toBe(1);
    expect(state.measurements.map((m) => m.outcome).sort()).toEqual(["dropped", "gap"]);
  });

  it("counts a cancelled answer and never applies or resends it", async () => {
    const port = createStubMarketplaceBench({ scenario: "held" });
    const bench = controller(port);
    const pending = bench.read();
    expect(bench.cancelReads()).toBe(1);
    port.synthetic("deliver-held");
    const result = await pending;
    expect(result).toMatchObject({ kind: "CANCELLED" });
    const state = bench.state();
    expect(state.snapshot).toBeNull();
    expect(state.readState).toBe("none");
    expect(state.counters.cancelledReads).toBe(1);
    expect(state.counters.reads).toBe(1);
    expect(state.measurements[0]?.outcome).toBe("cancelled");
  });

  it("keeps a lost read in flight and unknown; nothing resends it", async () => {
    const port = createStubMarketplaceBench({ scenario: "read-lost" });
    const bench = controller(port);
    let settled = false;
    void bench.read().then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(bench.state().inFlight).toHaveLength(1);
    expect(bench.cancelReads()).toBe(1);
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(bench.state().counters.reads).toBe(1);
    expect(bench.state().measurements).toHaveLength(0);
  });

  it("drops a late answer after a duplicate tab opened a new incarnation", async () => {
    const port = createStubMarketplaceBench({ scenario: "held" });
    const bench = controller(port);
    const pending = bench.read();
    bench.duplicateTab();
    port.synthetic("deliver-held");
    const result = await pending;
    expect(result).toMatchObject({ kind: "DROPPED", cause: "context-changed" });
    const state = bench.state();
    expect(state.context.incarnation).toBe(2);
    expect(state.counters.droppedContext).toBe(1);
    expect(state.snapshot).toBeNull();
    expect(state.measurements[0]?.outcome).toBe("dropped");
  });

  it("drops a late answer after an actor switch and serves the new actor fresh", async () => {
    const port = createStubMarketplaceBench({ scenario: "held" });
    const bench = controller(port);
    const pending = bench.read();
    bench.switchActor("marketplace-bench-2");
    port.synthetic("deliver-held");
    const result = await pending;
    expect(result).toMatchObject({ kind: "DROPPED", cause: "context-changed" });
    expect(bench.state().context.actorRef).toBe("marketplace-bench-2");
  });

  it("clears the view on every context switch", async () => {
    const bench = controller(createStubMarketplaceBench({ scenario: "clean" }));
    await bench.read();
    expect(bench.state().snapshot).not.toBeNull();
    bench.switchDevice("desktop-emulated-mobile");
    const state = bench.state();
    expect(state.snapshot).toBeNull();
    expect(state.readState).toBe("none");
    expect(state.queue).toBeNull();
    expect(state.context.deviceClass).toBe("desktop-emulated-mobile");
  });

  it("labels an emulated device profile as emulation, never real-device evidence", async () => {
    const bench = controller(
      createStubMarketplaceBench({ scenario: "clean" }),
      { deviceClass: "desktop-emulated-mobile" },
    );
    await bench.read();
    const report = bench.measurementReport();
    const row = report.rows.find((item) => item.deviceClass === "desktop-emulated-mobile");
    expect(row?.realDevice).toBe(false);
    expect(row?.realDeviceEvidence).toBe(false);
    expect(row?.deviceNote).toContain("Emulation");
    const mobile = report.unverified.find((item) => item.device === "real-mobile");
    expect(mobile).toMatchObject({ state: "unverified", calls: 0 });
  });

  it("runs the hot-page journey: blocked, queued, admitted, then expired", async () => {
    const port = createStubMarketplaceBench({ scenario: "clean" });
    const bench = controller(port, { workload: "hot-page" });
    const blocked = await bench.read();
    expect(blocked).toMatchObject({ kind: "APPLIED", readState: "queue-blocked" });
    const join = await bench.joinQueue();
    expect(join).toMatchObject({ kind: "APPLIED", phase: "waiting" });
    const admitted = await bench.refreshQueue();
    expect(admitted).toMatchObject({ kind: "APPLIED", phase: "admitted" });
    const ready = await bench.read();
    expect(ready).toMatchObject({ kind: "APPLIED", readState: "ready" });
    expect(bench.state().queue?.state).toBe("admitted");
    port.synthetic("expire-queue");
    const expired = await bench.read();
    expect(expired).toMatchObject({ kind: "APPLIED", readState: "queue-expired" });
    expect(bench.state().snapshot).toBeNull();
    expect(bench.state().queue?.grantsBrowseAccess).toBe(false);
  });

  it("serializes queue calls: a second join is not sent while one is in flight", async () => {
    const port = createStubMarketplaceBench({ scenario: "held" });
    const bench = controller(port, { workload: "hot-page" });
    const first = bench.joinQueue();
    const second = await bench.joinQueue();
    expect(second).toMatchObject({ kind: "NOT_SENT", reason: "in-flight" });
    port.synthetic("deliver-held");
    const result = await first;
    expect(result).toMatchObject({ kind: "APPLIED", phase: "waiting" });
    expect(bench.state().counters.queueCalls).toBe(1);
    expect(bench.state().counters.notSent).toBe(1);
  });

  it("clears the rows when the terms move under the held window", async () => {
    const port = createStubMarketplaceBench({ scenario: "clean" });
    const bench = controller(port);
    await bench.read();
    expect(bench.state().snapshot).not.toBeNull();
    port.synthetic("move-terms");
    const result = await bench.refresh();
    expect(result).toMatchObject({ kind: "APPLIED", readState: "terms-moved" });
    const state = bench.state();
    expect(state.freshness).toBe("STALE");
    expect(state.snapshot).toBeNull();
    expect(state.readDetail).toContain("moved");
  });

  it("shows stale, denied and unavailable without keeping rows", async () => {
    const stale = controller(createStubMarketplaceBench({ scenario: "stale" }));
    await stale.read();
    expect(stale.state().readState).toBe("stale");
    expect(stale.state().freshness).toBe("STALE");
    expect(stale.state().snapshot).toBeNull();

    const denied = controller(createStubMarketplaceBench({ scenario: "permission-lost" }));
    await denied.read();
    expect(denied.state().readState).toBe("denied");
    expect(denied.state().counters.denied).toBe(1);

    const lost = controller(createStubMarketplaceBench({ scenario: "read-lost" }));
    void lost.read();
    expect(lost.state().freshness).toBe("UNAVAILABLE");
  });

  it("maps a throwing port to unknown instead of fabricating a read", async () => {
    const port: MarketplaceBenchPort = {
      environment: "stub",
      source: "synthetic-marketplace",
      revision: "syn-1",
      scenario: "clean",
      readPage: () => Promise.reject(new Error("synthetic fault")),
      joinQueue: () => Promise.reject(new Error("synthetic fault")),
      readQueue: () => Promise.reject(new Error("synthetic fault")),
      synthetic: () => false,
    };
    const bench = controller(port);
    const result = await bench.read();
    expect(result).toMatchObject({ kind: "APPLIED", readState: "unavailable" });
    expect(bench.state().readDetail).toBe("synthetic fault");
    expect(bench.state().counters.unknowns).toBe(1);
    expect(bench.state().measurements[0]?.outcome).toBe("unknown");
  });

  it("keeps the not-bound environment not-bound on reads and the queue", async () => {
    const bench = controller(createNotBoundMarketplaceBench());
    const read = await bench.read();
    expect(read).toMatchObject({ kind: "APPLIED", readState: "not-bound" });
    expect(bench.state().readDetail).toContain("ps-07-scale-qualification");
    const join = await bench.joinQueue();
    expect(join).toMatchObject({ kind: "APPLIED", phase: "not-bound" });
  });

  it("fails closed on a drifted pin tuple", async () => {
    const bench = controller(
      createStubMarketplaceBench({
        scenario: "clean",
        expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, protocolMergeSha: "0".repeat(40) },
      }),
    );
    await bench.read();
    expect(bench.state().readState).toBe("tuple-changed");
    expect(bench.state().snapshot).toBeNull();
  });

  it("measures once per settled call under the browser-boundary denominator", async () => {
    let tick = 0;
    const bench = controller(createStubMarketplaceBench({ scenario: "clean" }), {
      now: () => {
        tick += 25;
        return tick;
      },
    });
    await bench.read();
    await bench.nextPage();
    const report = bench.measurementReport();
    expect(report.rows).toHaveLength(1);
    const row = report.rows[0];
    expect(row.calls).toBe(2);
    expect(row.ready).toBe(2);
    expect(row.denominator).toBe("browser-boundary-measurement");
    expect(row.producerLoadShare).toBe("none");
    expect(row.realDeviceEvidence).toBe(false);
    expect(row.maxMeasuredMs).toBe(25);
    expect(row.lastMeasuredMs).toBe(25);
    expect(row.maxOfferedMs).toBe(6);
    expect(report.unverified.map((item) => item.device)).toEqual(["real-mobile", "real-tablet"]);
  });

  it("groups measurements by workload and device class separately", async () => {
    const bench = controller(createStubMarketplaceBench({ scenario: "clean" }));
    await bench.read();
    bench.setWorkload("fast-search");
    await bench.search("hall");
    bench.switchDevice("desktop-emulated-mobile");
    bench.setWorkload("browse-window");
    await bench.read();
    const report = bench.measurementReport();
    const keys = report.rows.map((row) => `${row.deviceClass}/${row.workload}`).sort();
    expect(keys).toEqual([
      "desktop-browser/browse-window",
      "desktop-browser/fast-search",
      "desktop-emulated-mobile/browse-window",
    ]);
  });
});
