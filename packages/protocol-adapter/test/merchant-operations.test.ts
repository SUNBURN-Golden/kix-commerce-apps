import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  DISCOVERY_READ_TUPLE_LITERALS,
  JOURNEY_NOT_COMPOSED,
  MERCHANT_DESK_ACTOR,
  MERCHANT_FOREIGN_REF,
  MERCHANT_HOLD_NOT_BOUND,
  MERCHANT_LINE_KINDS,
  MERCHANT_NOT_BOUND_REASON,
  MERCHANT_NOT_COMPOSED,
  MERCHANT_OPERATIONS_RULING,
  MERCHANT_OWN_REF,
  MERCHANT_REF_KINDS,
  MERCHANT_SCENARIOS,
  MERCHANT_STALE_FLOOR,
  MERCHANT_TENANT,
  assessMerchantSnapshot,
  createNotBoundMerchantOperations,
  createStubMerchantOperations,
  findMerchantClaim,
  isMerchantAmount,
  isMerchantRef,
  judgeMerchantExport,
  merchantOperationsPortFor,
  merchantRefFor,
  merchantRefKind,
  refuseMerchantExport,
  refuseMerchantSnapshot,
  type MerchantExport,
  type MerchantExportOutcome,
  type MerchantLine,
  type MerchantReadOutcome,
  type MerchantScenario,
  type MerchantScope,
  type MerchantSnapshot,
  type StubMerchantOperations,
} from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

const CTX = "stub|kix|merchant-desk|1";
const OWN: MerchantScope = { tenantId: MERCHANT_TENANT, merchantRef: MERCHANT_OWN_REF };
const FOREIGN: MerchantScope = { tenantId: MERCHANT_TENANT, merchantRef: MERCHANT_FOREIGN_REF };

function readRequest(scope: MerchantScope = OWN, actorRef = MERCHANT_DESK_ACTOR, watermarkFloor: string | null = null) {
  return { contextKey: CTX, actorRef, scope, watermarkFloor };
}

function exportRequest(scope: MerchantScope = OWN, actorRef = MERCHANT_DESK_ACTOR) {
  return { contextKey: CTX, actorRef, scope };
}

async function ready(port: StubMerchantOperations, scope: MerchantScope = OWN): Promise<MerchantSnapshot> {
  const outcome = await port.read(readRequest(scope));
  if (outcome.kind !== "ready") {
    throw new Error(`expected a ready read, received ${outcome.kind}`);
  }
  return outcome.snapshot;
}

async function exported(port: StubMerchantOperations, scope: MerchantScope = OWN): Promise<MerchantExport> {
  const outcome = await port.readExport(exportRequest(scope));
  if (outcome.kind !== "ready") {
    throw new Error(`expected a ready export, received ${outcome.kind}`);
  }
  return outcome.export;
}

function stub(scenario: MerchantScenario = "clean"): StubMerchantOperations {
  return createStubMerchantOperations({ scenario });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("identity and amount shapes", () => {
  it("gives each reference kind its own prefix and never reads one kind as another", () => {
    expect([...MERCHANT_REF_KINDS]).toEqual(["merchant", "event", "listing", "trade", "obligation", "cut", "export"]);
    const prefixes = new Set<string>();
    for (const kind of MERCHANT_REF_KINDS) {
      const ref = merchantRefFor(kind, 7);
      expect(merchantRefKind(ref)).toBe(kind);
      expect(isMerchantRef(ref, kind)).toBe(true);
      prefixes.add(ref.slice(0, 3));
      for (const other of MERCHANT_REF_KINDS) {
        if (other !== kind) {
          expect(isMerchantRef(ref, other), `${ref} as ${other}`).toBe(false);
        }
      }
    }
    expect(prefixes.size).toBe(MERCHANT_REF_KINDS.length);
    expect(merchantRefFor("obligation", 12)).toBe("obl-0012");
    for (const bad of ["obl-1", "obl-00012", "OBL-0001", "obl-000a", "", "obl-0001 ", 1, null, undefined]) {
      expect(isMerchantRef(bad, "obligation"), String(bad)).toBe(false);
    }
  });

  it("accepts only a whole-unit string as an amount", () => {
    for (const good of ["0", "1", "1200", "999999999999"]) {
      expect(isMerchantAmount(good), good).toBe(true);
    }
    for (const bad of ["", "01", "-1", "+1", "1.5", "1,200", "1e3", " 1", "1 ", "0x10", "٣", "1234567890123", 1200, null, undefined]) {
      expect(isMerchantAmount(bad), String(bad)).toBe(false);
    }
  });
});

describe("locked bindings and the not-composed record", () => {
  it("quotes the locked hold binding and does not map it", () => {
    expect(MERCHANT_HOLD_NOT_BOUND).toMatchObject({ method: "placeHold", status: "not-bound", consideredAction: "reserve_listing", mappedOntoPrepareTrade: false });
    expect(MERCHANT_HOLD_NOT_BOUND.reason).toBe(COMMERCE_COMMAND_BINDINGS.placeHold.reason);
    expect(MERCHANT_HOLD_NOT_BOUND.consideredAction).toBe(COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction);
  });

  it("records the journey list plus refund_ticket as not composed, and composes none", () => {
    expect(MERCHANT_NOT_COMPOSED.map((entry) => entry.action)).toEqual([
      ...JOURNEY_NOT_COMPOSED.map((entry) => entry.action),
      "refund_ticket",
    ]);
    expect(MERCHANT_NOT_COMPOSED.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(["capture", "settle_capture", "commit_trade", "open_admission", "admit", "refund_ticket"]),
    );
    expect(MERCHANT_OPERATIONS_RULING).toBe("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
  });

  it("leaves commerce-bindings.ts byte-identical", () => {
    const bindings = readFileSync(path.join(repoRoot, "packages/protocol-adapter/src/commerce-bindings.ts"));
    expect(createHash("sha256").update(bindings).digest("hex")).toBe(
      "83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249",
    );
  });
});

describe("port choice", () => {
  it("serves the synthetic source on stub and a not-bound port on integration-http", async () => {
    expect(merchantOperationsPortFor("stub")).toMatchObject({ environment: "stub", source: "synthetic-merchant", scenario: "clean" });
    const bound = merchantOperationsPortFor("integration-http", { scenario: "clean" });
    expect(bound).toMatchObject({ environment: "integration-http", source: "none" });
    expect(await bound.read(readRequest())).toEqual({ kind: "not-bound", reason: MERCHANT_NOT_BOUND_REASON });
    expect(await bound.readExport(exportRequest())).toEqual({ kind: "not-bound", reason: MERCHANT_NOT_BOUND_REASON });
    expect(bound.revokeGrant()).toBe(false);
    expect(bound.advanceCut()).toBe(false);
    expect(MERCHANT_NOT_BOUND_REASON).toContain("no read command");
    expect(MERCHANT_NOT_BOUND_REASON).toContain("no export command");
    expect(MERCHANT_NOT_BOUND_REASON).toContain("not-bound on integration-http");
    expect(createNotBoundMerchantOperations().source).toBe("none");
  });

  it("never falls back to the stub on integration-http", () => {
    const port = merchantOperationsPortFor("integration-http", { scenario: "exceptions" });
    expect(port.source).toBe("none");
    expect(port.scenario).toBe("clean");
  });
});

describe("a clean read", () => {
  it("returns the four lenses for the granted merchant only, all on one cut", async () => {
    const snapshot = await ready(stub());
    expect(snapshot.scope).toEqual(OWN);
    expect(snapshot.events.map((row) => row.eventRef)).toEqual(["evt-0001", "evt-0002"]);
    expect(snapshot.listings.map((row) => row.listingRef)).toEqual(["lst-0001", "lst-0002", "lst-0003"]);
    expect(snapshot.trades.map((row) => row.tradeRef)).toEqual(["trd-0001", "trd-0002", "trd-0003"]);
    expect(snapshot.lines.map((row) => row.obligationRef)).toEqual(["obl-0001", "obl-0002", "obl-0003", "obl-0004", "obl-0005", "obl-0006", "obl-0007"]);
    const everyRow = [...snapshot.events, ...snapshot.listings, ...snapshot.trades, ...snapshot.lines];
    expect(everyRow.every((row) => row.merchantRef === MERCHANT_OWN_REF)).toBe(true);
    expect(new Set(everyRow.map((row) => row.cutRef))).toEqual(new Set(["cut-0001"]));
    expect(snapshot.cuts).toHaveLength(1);
    expect(JSON.stringify(snapshot)).not.toContain(MERCHANT_FOREIGN_REF);
    expect(JSON.stringify(snapshot)).not.toContain("obl-0008");
  });

  it("keeps the four money kinds as separate lines and states every claim field as false", async () => {
    const snapshot = await ready(stub());
    expect(new Set(snapshot.lines.map((line) => line.kind))).toEqual(new Set(MERCHANT_LINE_KINDS));
    for (const line of snapshot.lines) {
      expect(line.settled).toBe(false);
      expect(line.fundsAvailable).toBe(false);
      expect(line.lendable).toBe(false);
      expect(isMerchantAmount(line.amount)).toBe(true);
      expect(line.unit).toBe("mock-unit");
    }
    expect(findMerchantClaim(snapshot.lines)).toBeNull();
    const sales = snapshot.lines.filter((line) => line.kind === "sales-observed");
    expect(sales.length).toBeGreaterThan(0);
    expect(sales.every((line) => line.settled === false && line.lendable === false)).toBe(true);
  });

  it("copies the source aggregate as typed text and its counts match the lines it names", async () => {
    const snapshot = await ready(stub());
    expect(snapshot.aggregate.map((row) => `${row.kind}:${row.lineCount}:${row.amount}`)).toEqual([
      "sales-observed:3:3300",
      "unpaid:2:1900",
      "held:1:1100",
      "refund-burden:1:900",
    ]);
    expect(snapshot.aggregate.every((row) => typeof row.amount === "string")).toBe(true);
    const assessment = assessMerchantSnapshot(snapshot);
    expect(assessment).toMatchObject({ cutState: "single", aggregate: { state: "current", flags: [] }, unlinked: [] });
    expect(assessment.usedCuts.map((cut) => cut.cutRef)).toEqual(["cut-0001"]);
  });

  it("counts calls that reached the source and numbers each read", async () => {
    const port = stub();
    const first = await ready(port);
    const second = await ready(port);
    expect(second.snapshotId).toBe(first.snapshotId + 1);
    await exported(port);
    expect(port.effects()).toEqual({ reads: 2, exports: 1 });
  });
});

describe("request bounds", () => {
  it("rejects a malformed request before it reads anything", async () => {
    const port = stub();
    expect(await port.read({ ...readRequest(), contextKey: " " })).toMatchObject({ kind: "invalid-request", code: "CONTEXT" });
    expect(await port.read({ ...readRequest(), actorRef: "" })).toMatchObject({ kind: "invalid-request", code: "ACTOR" });
    expect(await port.read(readRequest({ tenantId: "tenant-other", merchantRef: MERCHANT_OWN_REF }))).toMatchObject({ kind: "invalid-request", code: "SCOPE" });
    expect(await port.read(readRequest({ tenantId: MERCHANT_TENANT, merchantRef: "evt-0001" }))).toMatchObject({ kind: "invalid-request", code: "SCOPE" });
    expect(await port.read(readRequest({ tenantId: MERCHANT_TENANT, merchantRef: "mrc-1" }))).toMatchObject({ kind: "invalid-request", code: "SCOPE" });
    expect(await port.read(readRequest(OWN, MERCHANT_DESK_ACTOR, "not an instant"))).toMatchObject({ kind: "invalid-request", code: "FLOOR" });
    const missingScope = await port.read({ ...readRequest(), scope: undefined as unknown as MerchantScope });
    expect(missingScope).toMatchObject({ kind: "invalid-request", code: "SCOPE" });
    expect(await port.readExport({ ...exportRequest(), contextKey: "" })).toMatchObject({ kind: "invalid-request", code: "CONTEXT" });
  });
});

describe("permission rejection", () => {
  it("refuses another merchant's scope and returns no row of it", async () => {
    const outcome = await stub().read(readRequest(FOREIGN));
    expect(outcome).toMatchObject({ kind: "denied", code: "SCOPE_DENIED", merchantRef: MERCHANT_FOREIGN_REF });
    expect(JSON.stringify(outcome)).not.toContain("evt-0003");
    expect(JSON.stringify(outcome)).not.toContain("obl-0008");
    const exportOutcome = await stub().readExport(exportRequest(FOREIGN));
    expect(exportOutcome).toMatchObject({ kind: "denied", code: "SCOPE_DENIED" });
  });

  it("refuses an actor with no grant, including a name that exists on the object prototype", async () => {
    for (const actor of ["someone-else", "constructor", "__proto__", "toString"]) {
      expect(await stub().read(readRequest(OWN, actor)), actor).toMatchObject({ kind: "denied", code: "SCOPE_DENIED" });
    }
  });

  it("refuses every read once the grant is withdrawn, and says so as a revoked grant", async () => {
    const port = stub();
    await ready(port);
    expect(port.revokeGrant()).toBe(true);
    expect(await port.read(readRequest())).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
    expect(await port.readExport(exportRequest())).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
    expect(await stub("denied").read(readRequest())).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
  });

  it("grants a read and refuses the export in its own scenario", async () => {
    const port = stub("export-denied");
    await ready(port);
    expect(await port.readExport(exportRequest())).toMatchObject({ kind: "denied", code: "EXPORT_DENIED" });
  });

  it("checks the request before it checks for an empty ledger", async () => {
    expect(await stub("empty").read(readRequest(FOREIGN))).toMatchObject({ kind: "denied" });
  });
});

describe("empty, stale, and lost reads", () => {
  it("reads an empty ledger as empty, not as zero money", async () => {
    const outcome = await stub("empty").read(readRequest());
    expect(outcome).toMatchObject({ kind: "empty", scope: OWN });
    expect(JSON.stringify(outcome)).not.toContain("amount");
  });

  it("reads a watermark older than the floor as stale and returns no row", async () => {
    const outcome = await stub("stale").read(readRequest());
    expect(outcome).toMatchObject({ kind: "stale", floor: MERCHANT_STALE_FLOOR });
    expect(Object.keys(outcome)).not.toContain("snapshot");
    const fresh = await stub().read(readRequest(OWN, MERCHANT_DESK_ACTOR, "2026-10-14T00:00:00.000Z"));
    expect(fresh).toMatchObject({ kind: "stale" });
  });

  it("loses a read by rejecting the promise, which the controller turns into unavailable", async () => {
    await expect(stub("read-lost").read(readRequest())).rejects.toThrow(/never arrived/);
  });
});

describe("refusing a payload that cannot be trusted", () => {
  it("refuses a line that claims it is settled, and returns no row of the page", async () => {
    const outcome = await stub("claims-settled").read(readRequest());
    expect(outcome).toMatchObject({ kind: "refused", code: "CLAIM", field: "settled", ref: "obl-0001" });
    expect(Object.keys(outcome)).not.toContain("snapshot");
  });

  it("refuses a row that belongs to another merchant", async () => {
    const outcome = await stub("scope-leak").read(readRequest());
    expect(outcome).toMatchObject({ kind: "refused", code: "SCOPE_LEAK", ref: "trd-0004" });
  });

  it("names the first claim field, and counts a missing field as a claim", async () => {
    const lines = clone((await ready(stub())).lines) as unknown as Record<string, unknown>[];
    expect(findMerchantClaim(lines)).toBeNull();
    for (const field of ["settled", "fundsAvailable", "lendable"] as const) {
      const copy = clone(lines);
      copy[2] = { ...copy[2], [field]: true };
      expect(findMerchantClaim(copy), field).toEqual({ obligationRef: "obl-0003", field });
      const missing = clone(lines);
      delete missing[1]?.[field];
      expect(findMerchantClaim(missing), `${field} missing`).toEqual({ obligationRef: "obl-0002", field });
    }
    const stringy = clone(lines);
    stringy[0] = { ...stringy[0], lendable: "false" };
    expect(findMerchantClaim(stringy)).toEqual({ obligationRef: "obl-0001", field: "lendable" });
    expect(findMerchantClaim([null, 3])).toEqual({ obligationRef: "(no reference)", field: "settled" });
  });

  it("refuses each malformed line or aggregate field with its own code", async () => {
    const base = await ready(stub());
    const withLine = (patch: Partial<MerchantLine>): MerchantSnapshot => {
      const copy = clone(base);
      copy.lines = copy.lines.map((line, index) => (index === 0 ? ({ ...line, ...patch } as MerchantLine) : line));
      return copy;
    };
    expect(refuseMerchantSnapshot(base)).toBeNull();
    for (const amount of ["12.5", "-1", "01", "1e3", "", " 5", "1,000"]) {
      expect(refuseMerchantSnapshot(withLine({ amount })), amount).toMatchObject({ code: "AMOUNT", ref: "obl-0001" });
    }
    expect(refuseMerchantSnapshot(withLine({ amount: 1200 as unknown as string }))).toMatchObject({ code: "AMOUNT" });
    expect(refuseMerchantSnapshot(withLine({ unit: "KRW" as unknown as "mock-unit" }))).toMatchObject({ code: "UNIT" });
    expect(refuseMerchantSnapshot(withLine({ kind: "paid-out" as unknown as "unpaid" }))).toMatchObject({ code: "KIND" });
    expect(refuseMerchantSnapshot(withLine({ state: "settled" as unknown as "observed" }))).toMatchObject({ code: "STATE" });
    expect(refuseMerchantSnapshot(withLine({ obligationRef: "trd-0001" }))).toMatchObject({ code: "REF" });
    expect(refuseMerchantSnapshot(withLine({ cutRef: "cut-0009" }))).toMatchObject({ code: "CUT" });
    expect(refuseMerchantSnapshot(withLine({ merchantRef: MERCHANT_FOREIGN_REF }))).toMatchObject({ code: "SCOPE_LEAK" });
    expect(refuseMerchantSnapshot(withLine({ fundsAvailable: true as unknown as false }))).toMatchObject({ code: "CLAIM", field: "fundsAvailable" });

    const badAggregate = clone(base);
    badAggregate.aggregate = badAggregate.aggregate.map((row, index) => (index === 1 ? { ...row, amount: "19.00" } : row));
    expect(refuseMerchantSnapshot(badAggregate)).toMatchObject({ code: "AMOUNT", ref: "unpaid@cut-0001" });
    const badUnit = clone(base);
    badUnit.aggregate = badUnit.aggregate.map((row, index) => (index === 0 ? { ...row, unit: "USD" as unknown as "mock-unit" } : row));
    expect(refuseMerchantSnapshot(badUnit)).toMatchObject({ code: "UNIT" });
    const badKind = clone(base);
    badKind.aggregate = badKind.aggregate.map((row, index) => (index === 0 ? { ...row, kind: "balance" as unknown as "unpaid" } : row));
    expect(refuseMerchantSnapshot(badKind)).toMatchObject({ code: "KIND" });
    const badCut = clone(base);
    badCut.cuts = badCut.cuts.map((cut) => ({ ...cut, cutRef: "cut-x" }));
    expect(refuseMerchantSnapshot(badCut)).toMatchObject({ code: "REF", field: "cutRef" });
  });
});

describe("what a snapshot can support", () => {
  it("marks an aggregate built at an older generation as stale and still lists the lines", async () => {
    const snapshot = await ready(stub("stale-aggregate"));
    const assessment = assessMerchantSnapshot(snapshot);
    expect(assessment.aggregate.state).toBe("stale");
    expect(assessment.aggregate.flags.map((flag) => flag.code)).toEqual(["STALE_GENERATION", "STALE_GENERATION", "STALE_GENERATION", "STALE_GENERATION"]);
    expect(assessment.aggregate.flags[0]?.detail).toContain("generation 4");
    expect(assessment.aggregate.flags[0]?.detail).toContain("generation 5");
    expect(snapshot.lines).toHaveLength(7);
  });

  it("marks an aggregate whose line count differs from the lines as a mismatch", async () => {
    const assessment = assessMerchantSnapshot(await ready(stub("aggregate-mismatch")));
    expect(assessment.aggregate.state).toBe("mismatch");
    expect(assessment.aggregate.flags).toHaveLength(1);
    expect(assessment.aggregate.flags[0]).toMatchObject({ code: "COUNT_DIFFERS", kind: "unpaid", cutRef: "cut-0001" });
    expect(assessment.aggregate.flags[0]?.detail).toContain("counts 3");
    expect(assessment.aggregate.flags[0]?.detail).toContain("lists 2");
  });

  it("names a missing aggregate and an aggregate on an unknown cut", async () => {
    const base = await ready(stub());
    const noAggregate = { ...base, aggregate: [] };
    const missing = assessMerchantSnapshot(noAggregate);
    expect(missing.aggregate.state).toBe("mismatch");
    expect(missing.aggregate.flags.map((flag) => `${flag.code}:${flag.kind}`)).toEqual([
      "MISSING:sales-observed",
      "MISSING:unpaid",
      "MISSING:held",
      "MISSING:refund-burden",
    ]);
    const unknownCut = { ...base, aggregate: base.aggregate.map((row, index) => (index === 0 ? { ...row, cutRef: "cut-0009" } : row)) };
    const flagged = assessMerchantSnapshot(unknownCut);
    expect(flagged.aggregate.flags.map((flag) => flag.code)).toContain("UNKNOWN_CUT");
    expect(flagged.aggregate.state).toBe("mismatch");
  });

  it("keeps figures from different cuts apart and calls the view mixed", async () => {
    const snapshot = await ready(stub("mixed-cut"));
    const assessment = assessMerchantSnapshot(snapshot);
    expect(assessment.cutState).toBe("mixed");
    expect(assessment.usedCuts.map((cut) => cut.cutRef)).toEqual(["cut-0001", "cut-0002"]);
    const hold = snapshot.cuts.find((cut) => cut.cutRef === "cut-0002");
    const main = snapshot.cuts.find((cut) => cut.cutRef === "cut-0001");
    expect(hold?.source).toBe("hold-register");
    expect(main?.source).toBe("merchant-ledger");
    expect(hold?.generation).toBeLessThan(main?.generation ?? 0);
    expect(snapshot.lines.filter((line) => line.cutRef === "cut-0002").map((line) => line.kind)).toEqual(["held"]);
    expect(snapshot.aggregate.find((row) => row.kind === "held")?.cutRef).toBe("cut-0002");
    expect(assessment.aggregate.state).toBe("current");
    // The source states one figure per kind and per cut. Nothing here joins them.
    expect(snapshot.aggregate.every((row) => Object.keys(row).every((key) => key !== "total" && key !== "balance"))).toBe(true);
  });

  it("names a row whose link does not resolve instead of attaching it elsewhere", async () => {
    const assessment = assessMerchantSnapshot(await ready(stub("dangling-link")));
    expect(assessment.unlinked).toEqual([{ lens: "obligations", ref: "obl-0007", missing: "trade", missingRef: "trd-0099" }]);
    const base = await ready(stub());
    const orphans = assessMerchantSnapshot({
      ...base,
      listings: base.listings.map((row, index) => (index === 0 ? { ...row, eventRef: "evt-0099" } : row)),
      trades: base.trades.map((row, index) => (index === 0 ? { ...row, listingRef: "lst-0099" } : row)),
    });
    expect(orphans.unlinked.map((item) => `${item.lens}:${item.ref}:${item.missing}`)).toEqual([
      "listings:lst-0001:event",
      "trades:trd-0001:listing",
    ]);
  });

  it("carries exceptions and an unknown line as their own states", async () => {
    const snapshot = await ready(stub("exceptions"));
    const byState = (state: string) => snapshot.lines.filter((line) => line.state === state).map((line) => `${line.obligationRef}:${line.reasonCode ?? "-"}`);
    expect(byState("exception")).toEqual(["obl-0004:UNMATCHED", "obl-0005:DUPLICATE", "obl-0006:LATE", "obl-0007:MISMATCH"]);
    expect(byState("unknown")).toEqual(["obl-0002:-"]);
    expect(assessMerchantSnapshot(snapshot).aggregate.state).toBe("current");
  });
});

describe("the current export", () => {
  it("is current when it is one complete export of the cut the read saw", async () => {
    const port = stub();
    const snapshot = await ready(port);
    const assessment = assessMerchantSnapshot(snapshot);
    const exportedOnce = await exported(port);
    expect(exportedOnce).toMatchObject({ exportRef: "exp-0001", cutRef: "cut-0001", complete: true, declaredRowCount: 7, digest: "syn-digest-0001" });
    expect(exportedOnce.rows).toHaveLength(7);
    expect(judgeMerchantExport(snapshot, assessment, exportedOnce)).toEqual({ state: "current" });
  });

  const reasonsFor = async (scenario: MerchantScenario) => {
    const port = stub(scenario);
    const snapshot = await ready(port);
    const verdict = judgeMerchantExport(snapshot, assessMerchantSnapshot(snapshot), await exported(port));
    return verdict.state === "current" ? [] : [...verdict.reasons];
  };

  it("withholds a partial export with every reason that applies", async () => {
    expect(await reasonsFor("export-partial")).toEqual(["PARTIAL", "COUNT", "LINES_DIFFER"]);
  });

  it("withholds an export taken at an older generation", async () => {
    expect(await reasonsFor("export-stale")).toEqual(["STALE_CUT"]);
  });

  it("withholds an export whose lines differ from the read, comparing amounts as text", async () => {
    expect(await reasonsFor("export-lines-differ")).toEqual(["LINES_DIFFER"]);
  });

  it("withholds an export that spans cuts, and a read that spans cuts has no single export", async () => {
    expect(await reasonsFor("mixed-cut")).toEqual(["SNAPSHOT_MIXED"]);
    const port = stub("mixed-cut");
    const snapshot = await ready(port);
    const base = await exported(port);
    const mixedRows = judgeMerchantExport(snapshot, assessMerchantSnapshot(snapshot), base);
    expect(mixedRows).toMatchObject({ state: "withheld" });
    const spans = { ...base, rows: base.rows.map((row, index) => (index === 0 ? { ...row, cutRef: "cut-0002" } : row)) };
    const verdict = judgeMerchantExport(snapshot, assessMerchantSnapshot(snapshot), spans);
    expect(verdict.state === "withheld" ? verdict.reasons : []).toEqual(expect.arrayContaining(["SNAPSHOT_MIXED", "MIXED_CUT", "LINES_DIFFER"]));
  });

  it("withholds an export for another scope, an unknown cut, and with no read to compare to", async () => {
    const port = stub();
    const snapshot = await ready(port);
    const assessment = assessMerchantSnapshot(snapshot);
    const base = await exported(port);
    const elsewhere = judgeMerchantExport(snapshot, assessment, { ...base, scope: FOREIGN });
    expect(elsewhere.state === "withheld" ? elsewhere.reasons : []).toContain("SCOPE");
    const otherTenant = judgeMerchantExport(snapshot, assessment, { ...base, scope: { ...OWN, tenantId: "tenant-other" } });
    expect(otherTenant.state === "withheld" ? otherTenant.reasons : []).toContain("SCOPE");
    const unknown = judgeMerchantExport(snapshot, assessment, { ...base, cutRef: "cut-0009" });
    expect(unknown.state === "withheld" ? unknown.reasons : []).toEqual(expect.arrayContaining(["UNKNOWN_CUT", "MIXED_CUT"]));
    expect(judgeMerchantExport(null, null, base)).toEqual({ state: "withheld", reasons: ["NO_SNAPSHOT"] });
    expect(judgeMerchantExport(snapshot, null, base)).toEqual({ state: "withheld", reasons: ["NO_SNAPSHOT"] });
  });

  it("turns stale when the source moves on after the export, and ahead when the read is behind", async () => {
    const port = stub();
    const first = await ready(port);
    const early = await exported(port);
    expect(judgeMerchantExport(first, assessMerchantSnapshot(first), early)).toEqual({ state: "current" });
    expect(port.advanceCut()).toBe(true);
    const second = await ready(port);
    expect(second.cuts[0]?.generation).toBe((first.cuts[0]?.generation ?? 0) + 1);
    expect(judgeMerchantExport(second, assessMerchantSnapshot(second), early)).toEqual({ state: "withheld", reasons: ["STALE_CUT"] });
    const late = await exported(port);
    expect(judgeMerchantExport(second, assessMerchantSnapshot(second), late)).toEqual({ state: "current" });
    expect(judgeMerchantExport(first, assessMerchantSnapshot(first), late)).toEqual({ state: "withheld", reasons: ["AHEAD_CUT"] });
  });

  it("catches duplicate rows and a row count that does not match the declaration", async () => {
    const port = stub();
    const snapshot = await ready(port);
    const assessment = assessMerchantSnapshot(snapshot);
    const base = await exported(port);
    const duplicated = { ...base, rows: [...base.rows.slice(0, 6), base.rows[0] as MerchantExport["rows"][number]] };
    const reasons = judgeMerchantExport(snapshot, assessment, duplicated);
    expect(reasons.state === "withheld" ? reasons.reasons : []).toContain("LINES_DIFFER");
    const lying = judgeMerchantExport(snapshot, assessment, { ...base, declaredRowCount: 9 });
    expect(lying).toEqual({ state: "withheld", reasons: ["COUNT"] });
  });

  it("refuses an export payload for another scope or with a malformed row before it is returned", async () => {
    const base = await exported(stub());
    expect(refuseMerchantExport(base, OWN)).toBeNull();
    expect(refuseMerchantExport({ ...base, scope: FOREIGN }, OWN)).toMatchObject({ code: "SCOPE_LEAK" });
    expect(refuseMerchantExport({ ...base, exportRef: "obl-0001" }, OWN)).toMatchObject({ code: "REF", field: "exportRef" });
    const row = (patch: Record<string, unknown>) => ({ ...base, rows: base.rows.map((item, index) => (index === 0 ? { ...item, ...patch } : item)) }) as MerchantExport;
    expect(refuseMerchantExport(row({ amount: "1.5" }), OWN)).toMatchObject({ code: "AMOUNT", ref: "obl-0001" });
    expect(refuseMerchantExport(row({ unit: "USD" }), OWN)).toMatchObject({ code: "UNIT" });
    expect(refuseMerchantExport(row({ kind: "balance" }), OWN)).toMatchObject({ code: "KIND" });
    expect(refuseMerchantExport(row({ obligationRef: "trd-0001" }), OWN)).toMatchObject({ code: "REF" });
  });

  it("sends no digest verdict: the digest is opaque producer text", async () => {
    const source = readFileSync(path.join(repoRoot, "packages/protocol-adapter/src/merchant-operations.ts"), "utf8");
    expect(source).not.toMatch(/createHash|sha256Hex|digest\s*===|digest\s*!==/);
  });
});

describe("a changed producer tuple", () => {
  it("returns tuple-changed before any row on a read and on an export", async () => {
    const changed = { ...DISCOVERY_READ_TUPLE_LITERALS, protocolMergeSha: "0".repeat(40) };
    const port = createStubMerchantOperations({ expectedTuple: changed });
    const outcome = await port.read(readRequest());
    expect(outcome).toMatchObject({ kind: "tuple-changed", field: "protocolMergeSha", expected: "0".repeat(40) });
    expect(Object.keys(outcome)).not.toContain("snapshot");
    expect(await port.readExport(exportRequest())).toMatchObject({ kind: "tuple-changed", field: "protocolMergeSha" });
    const sdk = createStubMerchantOperations({ expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, sdkDigest: "sha256:x" } });
    expect(await sdk.read(readRequest())).toMatchObject({ kind: "tuple-changed", field: "sdkTuple" });
  });
});

describe("every scenario", () => {
  it("returns a defined outcome for a read and an export, and none is a write", async () => {
    for (const scenario of MERCHANT_SCENARIOS) {
      const port = stub(scenario);
      let read: MerchantReadOutcome | "rejected";
      try {
        read = await port.read(readRequest());
      } catch {
        read = "rejected";
      }
      const sent: MerchantExportOutcome = await port.readExport(exportRequest());
      expect(read, scenario).toBeDefined();
      expect(sent.kind, scenario).toBeDefined();
      expect(port.effects(), scenario).toEqual({ reads: 1, exports: 1 });
    }
  });
});

describe("source", () => {
  const files = ["merchant-operations.ts", "merchant-controller.ts"].map((name) =>
    readFileSync(path.join(repoRoot, "packages/protocol-adapter/src", name), "utf8"),
  );

  it("sends nothing, keeps no clock or timer, and does no money arithmetic", () => {
    const combined = files.join("\n");
    for (const token of [
      "fetch(",
      "XMLHttpRequest",
      "WebSocket",
      "invokeLocalCall",
      "Idempotency-Key",
      "setTimeout",
      "setInterval",
      "Date.now(",
      "new Date(",
      "Math.random(",
      "retry",
      "fallback",
      ".reduce(",
      "parseInt",
      "parseFloat",
      "BigInt",
      "Number(",
      "toFixed",
      "localStorage",
      "sessionStorage",
    ]) {
      expect(combined, token).not.toContain(token);
    }
  });

  it("imports no command module and composes no catalogue action", () => {
    const combined = files.join("\n");
    expect(combined).not.toMatch(/from "\.\/(local-call|http-adapter|booking-journey|organizer-console|gift-transfer|consent-bind|journey-invoker)\.js"/);
    expect(combined).not.toMatch(/action:\s*"(capture|settle_capture|commit_trade|admit|refund_ticket|open_admission)"/);
  });
});
