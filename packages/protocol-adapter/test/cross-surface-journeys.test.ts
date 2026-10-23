import { KIX_SDK_0_CONSUMPTION_DIGESTS } from "../src/sdk-consumption-tuple.js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  CROSS_SURFACE_BRANCHES,
  CROSS_SURFACE_COMPENSATION_STATES,
  CROSS_SURFACE_HOLD_NOT_BOUND,
  CROSS_SURFACE_JOURNEYS,
  CROSS_SURFACE_NON_CLAIMS,
  CROSS_SURFACE_NOT_BOUND_REASON,
  CROSS_SURFACE_NOT_COMPOSED,
  CROSS_SURFACE_RULING,
  CROSS_SURFACE_STATE,
  PLATFORM_COMPENSATION_UNDEFINED,
  composeCrossSurfaceRows,
  compensationFor,
  createNotBoundCrossSurface,
  createStubCrossSurface,
  createStubQualificationRunner,
  crossSurfacePortFor,
  judgeLegs,
  refuseCrossSurfaceTable,
  rowIdFor,
  type CrossSurfaceLeg,
  type CrossSurfaceTable,
} from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CTX = "stub|kix|xs-test|1";

afterEach(() => {
  vi.unstubAllGlobals();
});

async function table(): Promise<CrossSurfaceTable> {
  const outcome = await createStubCrossSurface().read({ contextKey: CTX, intentRef: "xs-1" });
  if (outcome.kind !== "ready") {
    throw new Error(`expected a ready table, got ${outcome.kind}`);
  }
  return outcome.table;
}

function legs(...items: Array<[string, CrossSurfaceLeg["outcome"]]>): CrossSurfaceLeg[] {
  return items.map(([label, outcome]) => ({ label, outcome, code: null, note: "" }));
}

describe("cross-surface journey table", () => {
  it("has exactly one row for every journey and branch, in order", async () => {
    const rows = await composeCrossSurfaceRows();
    expect(rows).toHaveLength(CROSS_SURFACE_JOURNEYS.length * CROSS_SURFACE_BRANCHES.length);
    expect(rows.map((row) => row.id)).toEqual(
      CROSS_SURFACE_JOURNEYS.flatMap((journey) => CROSS_SURFACE_BRANCHES.map((branch) => rowIdFor(journey, branch))),
    );
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    for (const row of rows) {
      expect(row.id).toBe(`xs.${row.journey}.${row.branch}`);
    }
  });

  it("states the ruling, the state, and every non-claim as a literal false", async () => {
    const t = await table();
    expect(t.ruling).toBe(CROSS_SURFACE_RULING);
    expect(CROSS_SURFACE_RULING).toContain("M2 + H1");
    expect(t.state).toBe(CROSS_SURFACE_STATE);
    expect(Object.values(CROSS_SURFACE_NON_CLAIMS).every((value) => value === false)).toBe(true);
    expect(t.environment).toBe("stub");
    expect(refuseCrossSurfaceTable(t)).toBeNull();
  });

  it("computes a status from the whole leg sequence and never closes on a per-call receipt", () => {
    expect(judgeLegs(legs(["a", "CONFIRMED"], ["b", "CONFIRMED"]), "b")).toBe("closed");
    // The terminal leg never ran.
    expect(judgeLegs(legs(["a", "CONFIRMED"], ["b", "FENCED"]), "b")).toBe("partial");
    // A receipt on the first leg is not a close when the journey ends later.
    expect(judgeLegs(legs(["a", "RECEIPT"], ["b", "NOT_SENT"]), "b")).toBe("partial");
    expect(judgeLegs(legs(["a", "RECEIPT"]), "b")).toBe("partial");
    // Nothing before the terminal may be unconfirmed or rejected.
    expect(judgeLegs(legs(["a", "UNKNOWN"], ["b", "CONFIRMED"]), "b")).toBe("partial");
    expect(judgeLegs(legs(["a", "REJECTED"], ["b", "CONFIRMED"]), "b")).toBe("partial");
    expect(judgeLegs(legs(["a", "UNKNOWN"]), "a")).toBe("unknown");
    expect(judgeLegs(legs(["a", "REJECTED"]), "a")).toBe("rejected");
    expect(judgeLegs(legs(["a", "FENCED"]), "a")).toBe("blocked");
    expect(judgeLegs([], null)).toBe("blocked");
  });

  it("never shows an UNKNOWN as closed, and never says no compensation is needed for it", async () => {
    const rows = await composeCrossSurfaceRows();
    const withUnknown = rows.filter((row) => row.legs.some((item) => item.outcome === "UNKNOWN"));
    expect(withUnknown.length).toBeGreaterThanOrEqual(6);
    for (const row of withUnknown) {
      expect(row.status, row.id).not.toBe("closed");
      expect(row.status, row.id).not.toBe("rejected");
      expect(row.unconfirmed.length, row.id).toBeGreaterThan(0);
      expect(row.compensation.state, row.id).not.toBe("NONE_NEEDED");
    }
    const lost = rows.filter((row) => row.branch === "response-lost" && row.basis === "executed");
    expect(lost.length).toBeGreaterThanOrEqual(5);
    for (const row of lost) {
      // An earlier confirmed leg makes the run partial; with none it stays unknown and fenced.
      if (row.lastConfirmed === "none") {
        expect(row.status, row.id).toBe("unknown");
        expect(row.compensation.state, row.id).toBe("FENCED");
      } else {
        expect(row.status, row.id).toBe("partial");
        expect(row.compensation.state, row.id).toBe("COMPENSATION_UNDEFINED");
      }
    }
    expect(lost.filter((row) => row.status === "unknown").map((row) => row.id)).toEqual([
      "xs.refund.response-lost",
      "xs.marketing-benefit.response-lost",
      "xs.delegation.response-lost",
      "xs.credit-servicing.response-lost",
    ]);
  });

  it("keeps COMPENSATION_UNDEFINED on every partly landed row and on a missing branch", async () => {
    const rows = await composeCrossSurfaceRows();
    const partial = rows.filter((row) => row.status === "partial");
    expect(partial.length).toBeGreaterThanOrEqual(6);
    for (const row of partial) {
      expect(row.compensation.state, row.id).toBe("COMPENSATION_UNDEFINED");
      expect(row.lastConfirmed, row.id).not.toBe("none");
    }
    const payment = rows.find((row) => row.id === "xs.resale-platform.partly-landed" || row.id === "xs.resale-platform.partial-success");
    expect(payment?.legs.map((item) => `${item.label}:${item.outcome}`)).toContain("transfer:FENCED");
    expect(payment?.compensation.state).toBe("COMPENSATION_UNDEFINED");
    expect(PLATFORM_COMPENSATION_UNDEFINED).toBeDefined();
    for (const row of rows.filter((item) => item.basis === "no-source-branch")) {
      expect(row.status).toBe("reference");
      expect(row.compensation.state).toBe("COMPENSATION_UNDEFINED");
      expect(row.note.length).toBeGreaterThan(20);
    }
    expect(rows.filter((item) => item.basis === "no-source-branch").map((item) => item.id)).toEqual([
      "xs.gift.explicit-reject",
      "xs.delegation.partial-success",
    ]);
  });

  it("uses three compensation words only and names no command in a cell", async () => {
    expect(CROSS_SURFACE_COMPENSATION_STATES).toEqual(["NONE_NEEDED", "FENCED", "COMPENSATION_UNDEFINED"]);
    const rows = await composeCrossSurfaceRows();
    for (const row of rows) {
      expect(CROSS_SURFACE_COMPENSATION_STATES, row.id).toContain(row.compensation.state);
      expect(row.compensation.note, row.id).not.toMatch(/\b(cancel_gift|cancel_event|refund_ticket|capture|settle_capture)\b/);
    }
    for (const status of ["closed", "rejected", "unknown", "partial", "blocked", "reference"] as const) {
      expect(CROSS_SURFACE_COMPENSATION_STATES).toContain(compensationFor(status).state);
    }
  });

  it("composes no opposite command: a reverse step is shown only fenced or not sent", async () => {
    const rows = await composeCrossSurfaceRows();
    const opposite = new Set(["cancel_gift", "cancel_event", "cancel-draft", "reclaim", "refund_ticket"]);
    for (const row of rows) {
      for (const item of row.legs) {
        if (opposite.has(item.label)) {
          expect(["FENCED", "NOT_SENT"], `${row.id} ${item.label}`).toContain(item.outcome);
        }
        expect(item.label, row.id).not.toMatch(/capture|settle_capture|commit_trade|open_admission|admit\b/);
      }
    }
    const partial = rows.find((row) => row.id === "xs.marketing-benefit.partial-success");
    expect(partial?.legs.at(-1)).toMatchObject({ label: "reclaim", outcome: "NOT_SENT", code: "reclaim-due" });
    expect(partial?.legs.at(-1)?.note).toContain("UNDETERMINED");
  });

  it("records the locked decisions and never composes capture, settle_capture, or a hold mapping", async () => {
    const t = await table();
    expect(t.holdNotBound).toEqual(CROSS_SURFACE_HOLD_NOT_BOUND);
    expect(CROSS_SURFACE_HOLD_NOT_BOUND).toMatchObject({
      method: "placeHold",
      status: COMMERCE_COMMAND_BINDINGS.placeHold.status,
      consideredAction: "reserve_listing",
      reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
      mappedOntoPrepareTrade: false,
    });
    expect(COMMERCE_COMMAND_BINDINGS.placeHold.status).toBe("not-bound");
    const actions = CROSS_SURFACE_NOT_COMPOSED.map((item) => item.action);
    for (const action of ["capture", "settle_capture", "commit_trade", "open_admission", "admit", "refund_ticket", "cancel_gift", "cancel_event", "cancel-draft", "reclaim"]) {
      expect(actions, action).toContain(action);
    }
    expect(t.notComposed).toEqual(CROSS_SURFACE_NOT_COMPOSED);
  });

  it("links each reused row to an exact existing test and a packet journey, and keeps executed rows apart", async () => {
    const rows = await composeCrossSurfaceRows();
    const runner = await createStubQualificationRunner().run({ contextKey: CTX, intentRef: "xs-q" });
    if (runner.kind !== "ready") {
      throw new Error("expected a ready qualification packet");
    }
    const packetIds = new Set(runner.packet.journeys.map((item) => item.id));
    expect(packetIds.size).toBe(14);
    const reused = rows.filter((row) => row.basis === "reused");
    expect(reused.length).toBeGreaterThanOrEqual(20);
    const qualificationIds = new Set<string>();
    for (const row of reused) {
      expect(row.reuse, row.id).not.toBeNull();
      const reuse = row.reuse;
      if (reuse === null) {
        continue;
      }
      const full = path.join(repoRoot, reuse.testPath);
      expect(existsSync(full), `${row.id} -> ${reuse.testPath}`).toBe(true);
      expect(readFileSync(full, "utf8"), `${row.id} title`).toContain(reuse.testTitle);
      if (reuse.qualificationJourneyId !== null) {
        expect(packetIds.has(reuse.qualificationJourneyId), reuse.qualificationJourneyId).toBe(true);
        expect(row.legs.length, row.id).toBeGreaterThan(0);
        qualificationIds.add(reuse.qualificationJourneyId);
      } else {
        expect(row.status, row.id).toBe("reference");
        expect(row.legs, row.id).toHaveLength(0);
      }
    }
    expect([...qualificationIds].sort()).toEqual([
      "journey.platform-trade-clean",
      "journey.platform-trade-rival",
      "journey.platform-transfer-late",
      "journey.provider-checkout",
      "journey.provider-declined",
    ]);
    for (const row of rows.filter((item) => item.basis === "executed")) {
      expect(row.reuse, row.id).toBeNull();
      expect(row.legs.length, row.id).toBeGreaterThan(0);
      expect(row.terminal, row.id).not.toBeNull();
    }
  });

  it("is deterministic apart from the table id", async () => {
    const a = await table();
    const b = await table();
    const { tableId: _a, ...restA } = a;
    const { tableId: _b, ...restB } = b;
    expect(restA).toEqual(restB);
  });

  it("makes no network request and sends no protocol command while it composes", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("the table must not fetch");
    });
    vi.stubGlobal("fetch", fetchSpy);
    await table();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("cross-surface table refusal", () => {
  async function mutated(change: (copy: Record<string, unknown>) => void): Promise<unknown> {
    const copy = structuredClone(await table()) as unknown as Record<string, unknown>;
    change(copy);
    return copy;
  }

  it("refuses a table that claims what a journey table can never claim", async () => {
    for (const field of ["journeyCompleteClaimed", "compensationExecuted", "unknownResolved", "realPayment", "fundsMoved", "productionEnvironment", "realIntegrationComplete"]) {
      const bad = await mutated((copy) => {
        (copy.nonClaims as Record<string, unknown>)[field] = true;
      });
      expect(refuseCrossSurfaceTable(bad), field).toMatchObject({ code: "CLAIM" });
    }
    expect(refuseCrossSurfaceTable(await mutated((copy) => { copy.state = "COMPLETE"; }))).toMatchObject({ code: "CLAIM" });
    expect(refuseCrossSurfaceTable(null)).toMatchObject({ code: "SHAPE" });
    expect(refuseCrossSurfaceTable({ rows: [] })).toMatchObject({ code: "SHAPE" });
  });

  it("refuses a row whose status its legs do not read, or whose UNKNOWN says nothing to undo", async () => {
    const closedUnknown = await mutated((copy) => {
      const row = (copy.rows as Record<string, unknown>[]).find((item) => item.id === "xs.refund.response-lost");
      if (row) {
        row.status = "closed";
      }
    });
    expect(refuseCrossSurfaceTable(closedUnknown)).toMatchObject({ code: "STATUS" });
    const noCompensation = await mutated((copy) => {
      const row = (copy.rows as Record<string, unknown>[]).find((item) => item.id === "xs.refund.response-lost");
      if (row) {
        (row.compensation as Record<string, unknown>).state = "NONE_NEEDED";
      }
    });
    expect(refuseCrossSurfaceTable(noCompensation)).toMatchObject({ code: "STATUS" });
    const pointerClosed = await mutated((copy) => {
      const row = (copy.rows as Record<string, unknown>[]).find((item) => item.id === "xs.gift.partial-success");
      if (row) {
        row.status = "closed";
      }
    });
    expect(refuseCrossSurfaceTable(pointerClosed)).toMatchObject({ code: "STATUS" });
  });

  it("refuses a fourth compensation word, a duplicate row, and a leg outside the vocabulary", async () => {
    const word = await mutated((copy) => {
      ((copy.rows as Record<string, unknown>[])[0]?.compensation as Record<string, unknown>).state = "REFUND_AUTOMATICALLY";
    });
    expect(refuseCrossSurfaceTable(word)).toMatchObject({ code: "SHAPE" });
    const duplicate = await mutated((copy) => {
      const rows = copy.rows as Record<string, unknown>[];
      rows.push(structuredClone(rows[0]) as Record<string, unknown>);
    });
    expect(refuseCrossSurfaceTable(duplicate)).toMatchObject({ code: "SHAPE" });
    const leg = await mutated((copy) => {
      const row = (copy.rows as Record<string, unknown>[]).find((item) => item.id === "xs.refund.normal");
      ((row?.legs as Record<string, unknown>[])[1] as Record<string, unknown>).outcome = "REFUNDED";
    });
    expect(refuseCrossSurfaceTable(leg)).toMatchObject({ code: "SHAPE" });
  });
});

describe("cross-surface port", () => {
  it("answers each scenario", async () => {
    const claims = await createStubCrossSurface({ scenario: "claims-pass" }).read({ contextKey: CTX, intentRef: "xs-c" });
    expect(claims.kind).toBe("ready");
    if (claims.kind === "ready") {
      expect(refuseCrossSurfaceTable(claims.table)).toMatchObject({ code: "CLAIM" });
    }
    const empty = await createStubCrossSurface({ scenario: "empty" }).read({ contextKey: CTX, intentRef: "xs-e" });
    expect(empty.kind === "ready" && empty.table.rows.length).toBe(0);
    const lost = await createStubCrossSurface({ scenario: "read-lost" }).read({ contextKey: CTX, intentRef: "xs-l" });
    expect(lost.kind).toBe("unknown");
    const invalidIntent = await createStubCrossSurface().read({ contextKey: CTX, intentRef: " " });
    expect(invalidIntent).toMatchObject({ kind: "invalid-request", code: "INTENT" });
    const invalidContext = await createStubCrossSurface().read({ contextKey: "", intentRef: "xs-x" });
    expect(invalidContext).toMatchObject({ kind: "invalid-request", code: "CONTEXT" });
  });

  it("holds a held answer until it is delivered", async () => {
    const port = createStubCrossSurface({ scenario: "held" });
    let settled = false;
    const pending = port.read({ contextKey: CTX, intentRef: "xs-h" }).then((outcome) => {
      settled = true;
      return outcome;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(port.deliverHeld()).toBe(1);
    expect((await pending).kind).toBe("ready");
    expect(port.deliverHeld()).toBe(0);
  });

  it("fails closed when the pin tuple changes", async () => {
    const port = createStubCrossSurface({
      expectedTuple: {
        contractOpenApiSha256: "changed",
        contractInfoVersion: "x",
        contractMainSha: "x",
        gateOpenApiSha256: "x",
        protocolMergeSha: "x",
        protocolFeatureSha: "x",
        sourceProtocolContractSha256: "x",
        domain: "kix:fixture:lifecycle:0.3",
        pinnedActions: [],
        ...KIX_SDK_0_CONSUMPTION_DIGESTS,
      },
    });
    const outcome = await port.read({ contextKey: CTX, intentRef: "xs-t" });
    expect(outcome).toMatchObject({ kind: "tuple-changed", field: "contractOpenApiSha256" });
  });

  it("answers not-bound on integration-http without a stub table", async () => {
    const outcome = await createNotBoundCrossSurface().read({ contextKey: CTX, intentRef: "xs-n" });
    expect(outcome).toMatchObject({ kind: "not-bound", reason: CROSS_SURFACE_NOT_BOUND_REASON });
    const viaFactory = crossSurfacePortFor("integration-http", { scenario: "claims-pass" });
    expect(viaFactory.source).toBe("none");
    expect((await viaFactory.read({ contextKey: CTX, intentRef: "xs-n2" })).kind).toBe("not-bound");
    expect(crossSurfacePortFor("stub").source).toBe("synthetic-journeys");
    expect(viaFactory.deliverHeld()).toBe(0);
  });
});

describe("cross-surface source scan", () => {
  it("keeps the adapter files free of banned tokens", () => {
    const files = ["cross-surface-journeys.ts", "cross-surface-branches.ts", "cross-surface-port.ts", "cross-surface-controller.ts"];
    for (const file of files) {
      const source = readFileSync(path.join(repoRoot, "packages/protocol-adapter/src", file), "utf8");
      for (const forbidden of ["retry", "fallback", "Number(", "Date.now(", "Math.random", ".reduce(", "parseInt", "BigInt", "fetch(", "Idempotency-Key", "invokeLocalCall", "localStorage", "sessionStorage"]) {
        expect(source.includes(forbidden), `${file} mentions ${forbidden}`).toBe(false);
      }
      // No import of the HTTP transport.
      expect(source, file).not.toMatch(/from "\.\/http-adapter\.js"/);
      expect(source, file).not.toMatch(/from "\.\/(booking|gift|organizer)-(journey|transfer|console)\.js"[^;]*BookingJourney/);
    }
  });

  it("does not use the booking, gift, or organizer classes that send local calls", () => {
    for (const file of ["cross-surface-branches.ts", "cross-surface-port.ts", "cross-surface-controller.ts"]) {
      const source = readFileSync(path.join(repoRoot, "packages/protocol-adapter/src", file), "utf8");
      for (const name of ["new BookingJourney", "new GiftTransfer", "new OrganizerConsole", "createStubJourneyInvoker", "createStubGiftInvoker", "createStubOrganizerInvoker"]) {
        expect(source.includes(name), `${file} uses ${name}`).toBe(false);
      }
    }
  });
});
