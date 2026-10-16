import { describe, expect, it } from "vitest";
import {
  CROSS_SURFACE_DESK_ACTOR,
  CROSS_SURFACE_HOLD_NOT_BOUND,
  CROSS_SURFACE_NOT_BOUND_REASON,
  CrossSurfaceController,
  composeCrossSurfaceRows,
  createNotBoundCrossSurface,
  createStubCrossSurface,
  summarizeCrossSurfaceRows,
  type CrossSurfacePort,
  type CrossSurfaceReadOutcome,
  type CrossSurfaceReadRequest,
  type CrossSurfaceScenario,
} from "../src/index.js";

function controller(port?: CrossSurfacePort) {
  return new CrossSurfaceController(port ?? createStubCrossSurface(), { actorRef: CROSS_SURFACE_DESK_ACTOR });
}

function scenarioController(scenario: CrossSurfaceScenario) {
  return controller(createStubCrossSurface({ scenario }));
}

/** A port that counts each call and lets a test settle each answer by hand. */
function manualPort() {
  const calls: CrossSurfaceReadRequest[] = [];
  const resolvers: Array<(outcome: CrossSurfaceReadOutcome) => void> = [];
  const port: CrossSurfacePort = {
    environment: "stub",
    source: "synthetic-journeys",
    scenario: "clean",
    read(request) {
      calls.push(request);
      return new Promise((resolve) => resolvers.push(resolve));
    },
    deliverHeld() {
      return 0;
    },
  };
  return { port, calls, resolvers };
}

describe("cross-surface controller", () => {
  it("applies one ready read and holds the table with a CURRENT freshness", async () => {
    const c = controller();
    expect(c.state().readState).toBe("none");
    expect(c.state().freshness).toBe("UNAVAILABLE");
    expect(await c.read()).toEqual({ kind: "APPLIED", readState: "ready" });
    const state = c.state();
    expect(state.readState).toBe("ready");
    expect(state.freshness).toBe("CURRENT");
    expect(state.table?.rows).toHaveLength(40);
    expect(state.counters).toEqual({ reads: 1, notSent: 0, droppedReads: 0 });
    expect(state.context.actorRef).toBe(CROSS_SURFACE_DESK_ACTOR);
  });

  it("filters by journey, branch, and status on rows already held", async () => {
    let reads = 0;
    const inner = createStubCrossSurface();
    const counted: CrossSurfacePort = {
      environment: inner.environment,
      source: inner.source,
      scenario: inner.scenario,
      read(request) {
        reads += 1;
        return inner.read(request);
      },
      deliverHeld: () => inner.deliverHeld(),
    };
    const c = controller(counted);
    await c.read();
    expect(c.view()).toHaveLength(40);
    c.setFilter({ journey: "refund" });
    expect(c.view().map((row) => row.id)).toEqual([
      "xs.refund.normal",
      "xs.refund.explicit-reject",
      "xs.refund.response-lost",
      "xs.refund.partial-success",
    ]);
    c.setFilter({ branch: "response-lost" });
    expect(c.view().map((row) => row.id)).toEqual(["xs.refund.response-lost"]);
    c.setFilter({ journey: "gift", branch: "explicit-reject", status: "closed" });
    expect(c.view()).toHaveLength(0);
    expect(c.state().readState).toBe("ready");
    c.clearFilter();
    expect(c.view()).toHaveLength(40);
    c.setFilter({ status: "unknown" });
    expect(c.view().every((row) => row.status === "unknown")).toBe(true);
    expect(reads).toBe(1);
  });

  it("shows a lost read as unavailable and not as an empty table", async () => {
    const c = scenarioController("read-lost");
    await c.read();
    const state = c.state();
    expect(state.readState).toBe("unavailable");
    expect(state.freshness).toBe("UNAVAILABLE");
    expect(state.table).toBeNull();
    expect(c.view()).toHaveLength(0);
    expect(state.readDetail).toContain("never arrived");
    expect(state.counters.reads).toBe(1);
  });

  it("shows a source with no rows as empty, which is a different state", async () => {
    const c = scenarioController("empty");
    await c.read();
    expect(c.state().readState).toBe("empty");
    expect(c.state().freshness).toBe("CURRENT");
    expect(c.view()).toHaveLength(0);
  });

  it("refuses a table that claims a compensation ran and leaves no row on screen", async () => {
    const c = scenarioController("claims-pass");
    await c.read();
    const state = c.state();
    expect(state.readState).toBe("refused");
    expect(state.readCode).toBe("CLAIM");
    expect(state.table).toBeNull();
    expect(c.view()).toHaveLength(0);
  });

  it("clears the rows of an earlier read when a later read is not ready", async () => {
    const inner = createStubCrossSurface();
    let lose = false;
    const port: CrossSurfacePort = {
      environment: "stub",
      source: "synthetic-journeys",
      scenario: "clean",
      read(request) {
        if (lose) {
          return Promise.reject(new Error("socket closed"));
        }
        return inner.read(request);
      },
      deliverHeld: () => 0,
    };
    const c = controller(port);
    await c.read();
    expect(c.view()).toHaveLength(40);
    lose = true;
    await c.read();
    expect(c.state().readState).toBe("unavailable");
    expect(c.state().readDetail).toBe("socket closed");
    expect(c.view()).toHaveLength(0);
  });

  it("drops an answer that arrives after the context switched", async () => {
    const port = createStubCrossSurface({ scenario: "held" });
    const c = controller(port);
    const pending = c.read();
    c.switchContext("journey-table-reader-2");
    expect(port.deliverHeld()).toBe(1);
    expect(await pending).toEqual({ kind: "DROPPED", cause: "context-changed" });
    const state = c.state();
    expect(state.readState).toBe("none");
    expect(state.table).toBeNull();
    expect(state.context.incarnation).toBe(2);
    expect(state.counters.droppedReads).toBe(1);
  });

  it("drops an older answer that arrives after a newer read was applied", async () => {
    const { port, resolvers } = manualPort();
    const c = controller(port);
    const first = c.read();
    const second = c.read();
    expect(resolvers).toHaveLength(2);
    const rows = await composeCrossSurfaceRows();
    const table = (id: string) => ({
      tableId: id,
      asOf: "x",
      state: "STUB_TABLE_RECORDED" as const,
      ruling: "r",
      environment: "stub" as const,
      rows,
      notComposed: [],
      holdNotBound: CROSS_SURFACE_HOLD_NOT_BOUND,
      nonClaims: {
        journeyCompleteClaimed: false,
        compensationExecuted: false,
        unknownResolved: false,
        realPayment: false,
        fundsMoved: false,
        productionEnvironment: false,
        realIntegrationComplete: false,
      } as const,
    });
    resolvers[1]?.({ kind: "ready", intentRef: "i2", contextKey: c.state().context.key, table: table("newer") });
    expect(await second).toEqual({ kind: "APPLIED", readState: "ready" });
    resolvers[0]?.({ kind: "ready", intentRef: "i1", contextKey: c.state().context.key, table: table("older") });
    expect(await first).toEqual({ kind: "DROPPED", cause: "older-read" });
    expect(c.state().table?.tableId).toBe("newer");
    expect(c.state().counters).toMatchObject({ reads: 2, droppedReads: 1 });
  });

  it("answers not-bound without calling the port", async () => {
    let calls = 0;
    const inner = createNotBoundCrossSurface();
    const counted: CrossSurfacePort = {
      environment: inner.environment,
      source: inner.source,
      scenario: inner.scenario,
      read(request) {
        calls += 1;
        return inner.read(request);
      },
      deliverHeld: () => inner.deliverHeld(),
    };
    const c = controller(counted);
    expect(await c.read()).toEqual({ kind: "NOT_SENT", reason: "not-bound" });
    expect(calls).toBe(0);
    const state = c.state();
    expect(state.readState).toBe("not-bound");
    expect(state.readDetail).toBe(CROSS_SURFACE_NOT_BOUND_REASON);
    expect(state.table).toBeNull();
    expect(state.counters).toEqual({ reads: 0, notSent: 1, droppedReads: 0 });
    expect(state.context.environment).toBe("integration-http");
  });

  it("makes one port call per read and never a second for a failed one", async () => {
    let calls = 0;
    const port: CrossSurfacePort = {
      environment: "stub",
      source: "synthetic-journeys",
      scenario: "clean",
      read() {
        calls += 1;
        return Promise.reject(new Error("boom"));
      },
      deliverHeld: () => 0,
    };
    const c = controller(port);
    await c.read();
    expect(calls).toBe(1);
    expect(c.state().counters.reads).toBe(1);
  });

  it("notifies subscribers and stops after unsubscribe", async () => {
    const c = controller();
    let seen = 0;
    const off = c.subscribe(() => {
      seen += 1;
    });
    await c.read();
    expect(seen).toBeGreaterThan(0);
    const before = seen;
    off();
    c.setFilter({ journey: "gift" });
    expect(seen).toBe(before);
  });

  it("summarises by status and never counts a pointer or a missing branch as closed", async () => {
    const rows = await composeCrossSurfaceRows();
    const summary = summarizeCrossSurfaceRows(rows);
    expect(summary.rows).toBe(40);
    expect(Object.values(summary.byStatus).reduce((a, b) => a + b, 0)).toBe(40);
    expect(summary.byStatus.reference).toBe(rows.filter((row) => row.status === "reference").length);
    expect(summary.byStatus.closed).toBe(rows.filter((row) => row.status === "closed" && row.legs.length > 0).length);
    expect(rows.filter((row) => row.status === "closed").every((row) => row.basis !== "no-source-branch" && row.legs.length > 0)).toBe(true);
    expect(summary.openRows).toBe(summary.byStatus.partial + summary.byStatus.unknown + summary.byStatus.blocked);
    expect(summary.byBasis["no-source-branch"]).toBe(2);
  });
});
