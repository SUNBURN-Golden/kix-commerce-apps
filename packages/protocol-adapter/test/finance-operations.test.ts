import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  DISCOVERY_READ_TUPLE_LITERALS,
  FINANCE_ACTORS,
  FINANCE_APPROVER_ACTOR,
  FINANCE_AS_OF,
  FINANCE_AUTHORITIES,
  FINANCE_CATEGORIES,
  FINANCE_FOREIGN_REF,
  FINANCE_HOLD_NOT_BOUND,
  FINANCE_NON_CLAIM_FIELDS,
  FINANCE_NOT_BOUND_REASON,
  FINANCE_NOT_COMPOSED,
  FINANCE_OPERATIONS_RULING,
  FINANCE_OWN_REF,
  FINANCE_PRODUCER_TUPLE,
  FINANCE_REF_KINDS,
  FINANCE_REVIEWER_ACTOR,
  FINANCE_SCENARIOS,
  FINANCE_SKEW_WATERMARK,
  FINANCE_STALE_FLOOR,
  FINANCE_STALE_WATERMARK,
  FINANCE_TENANT,
  FINANCE_VIEWER_ACTOR,
  JOURNEY_NOT_COMPOSED,
  MERCHANT_DESK_ACTOR,
  MERCHANT_OWN_REF,
  MERCHANT_TENANT,
  SERVICING_DESK_ACTOR,
  SERVICING_OWN_REF,
  SERVICING_TENANT,
  assessFinanceSnapshot,
  createNotBoundFinanceOperations,
  createStubCreditServicing,
  createStubFinanceOperations,
  createStubMerchantOperations,
  financeApprovableProposals,
  financeAuthorityTable,
  financeCapabilities,
  financeEligibility,
  financeExportRowsFor,
  financeOperationsPortFor,
  financeProposableCases,
  financeProposableCorrections,
  financeRefFor,
  financeRefKind,
  findFinanceClaim,
  isFinanceAmount,
  isFinanceRef,
  judgeFinanceExport,
  refuseFinanceExport,
  refuseFinanceReceipt,
  refuseFinanceSnapshot,
  type FinanceActOutcome,
  type FinanceActionRequest,
  type FinanceExport,
  type FinanceExportOutcome,
  type FinanceReadOutcome,
  type FinanceScenario,
  type FinanceScope,
  type FinanceSnapshot,
  type StubFinanceOperations,
} from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

const CTX = "stub|kix|finance-reviewer|1";
const OWN: FinanceScope = { tenantId: FINANCE_TENANT, bookRef: FINANCE_OWN_REF };
const FOREIGN: FinanceScope = { tenantId: FINANCE_TENANT, bookRef: FINANCE_FOREIGN_REF };

function readRequest(scope: FinanceScope = OWN, actorRef: string = FINANCE_REVIEWER_ACTOR, watermarkFloor: string | null = null) {
  return { contextKey: CTX, actorRef, scope, watermarkFloor };
}

function exportRequest(scope: FinanceScope = OWN, actorRef: string = FINANCE_REVIEWER_ACTOR) {
  return { contextKey: CTX, actorRef, scope };
}

function actRequest(action: FinanceActionRequest, scope: FinanceScope = OWN, actorRef: string = FINANCE_REVIEWER_ACTOR) {
  return { contextKey: CTX, actorRef, scope, action };
}

async function ready(port: StubFinanceOperations, scope: FinanceScope = OWN, actorRef: string = FINANCE_REVIEWER_ACTOR): Promise<FinanceSnapshot> {
  const outcome = await port.read(readRequest(scope, actorRef));
  if (outcome.kind !== "ready") {
    throw new Error(`expected a ready read, received ${outcome.kind}`);
  }
  return outcome.snapshot;
}

async function exported(port: StubFinanceOperations, scope: FinanceScope = OWN, actorRef: string = FINANCE_REVIEWER_ACTOR): Promise<FinanceExport> {
  const outcome = await port.readExport(exportRequest(scope, actorRef));
  if (outcome.kind !== "ready") {
    throw new Error(`expected a ready export, received ${outcome.kind}`);
  }
  return outcome.export;
}

function stub(scenario: FinanceScenario = "clean"): StubFinanceOperations {
  return createStubFinanceOperations({ scenario });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The ledger part of a snapshot: everything a recorded request must leave alone. */
function ledgerOf(snapshot: FinanceSnapshot): unknown {
  return clone({
    cuts: snapshot.cuts,
    originals: snapshot.originals,
    cases: snapshot.cases,
    facts: snapshot.facts,
    allocations: snapshot.allocations,
    totals: snapshot.totals,
    balances: snapshot.balances,
  });
}

describe("identity and amount shapes", () => {
  it("gives each reference kind its own prefix and never reads one kind as another", () => {
    expect([...FINANCE_REF_KINDS]).toEqual([
      "book",
      "case",
      "fact",
      "payee",
      "allocation",
      "trade",
      "merchant-line",
      "payment",
      "cut",
      "export",
      "proposal",
      "balance",
    ]);
    const prefixes = new Set<string>();
    for (const kind of FINANCE_REF_KINDS) {
      const ref = financeRefFor(kind, 7);
      expect(financeRefKind(ref)).toBe(kind);
      expect(isFinanceRef(ref, kind)).toBe(true);
      prefixes.add(ref.slice(0, 3));
      for (const other of FINANCE_REF_KINDS) {
        if (other !== kind) {
          expect(isFinanceRef(ref, other), `${ref} as ${other}`).toBe(false);
        }
      }
    }
    expect(prefixes.size).toBe(FINANCE_REF_KINDS.length);
    expect(financeRefFor("case", 12)).toBe("rcs-0012");
    for (const bad of ["rcs-1", "rcs-00012", "RCS-0001", "rcs-000a", "", "rcs-0001 ", 1, null, undefined]) {
      expect(isFinanceRef(bad, "case"), String(bad)).toBe(false);
    }
  });

  it("accepts only a whole-unit string as an amount", () => {
    for (const good of ["0", "1", "1200", "999999999999"]) {
      expect(isFinanceAmount(good), good).toBe(true);
    }
    for (const bad of ["", "01", "-1", "+1", "1.5", "1,200", "1e3", " 1", "1 ", "0x10", "٣", "1234567890123", 1200, null, undefined]) {
      expect(isFinanceAmount(bad), String(bad)).toBe(false);
    }
  });
});

describe("locked bindings and the not-composed record", () => {
  it("quotes the locked hold binding and does not map it", () => {
    expect(FINANCE_HOLD_NOT_BOUND).toMatchObject({ method: "placeHold", status: "not-bound", consideredAction: "reserve_listing", mappedOntoPrepareTrade: false });
    expect(FINANCE_HOLD_NOT_BOUND.reason).toBe(COMMERCE_COMMAND_BINDINGS.placeHold.reason);
    expect(FINANCE_HOLD_NOT_BOUND.consideredAction).toBe(COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction);
  });

  it("records the journey list plus refund_ticket as not composed, and composes none", () => {
    expect(FINANCE_NOT_COMPOSED.map((entry) => entry.action)).toEqual([
      ...JOURNEY_NOT_COMPOSED.map((entry) => entry.action),
      "refund_ticket",
    ]);
    expect(FINANCE_NOT_COMPOSED.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(["capture", "settle_capture", "commit_trade", "open_admission", "admit", "refund_ticket"]),
    );
    expect(FINANCE_OPERATIONS_RULING).toBe("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
  });

  it("leaves commerce-bindings.ts byte-identical", () => {
    const bindings = readFileSync(path.join(repoRoot, "packages/protocol-adapter/src/commerce-bindings.ts"));
    expect(createHash("sha256").update(bindings).digest("hex")).toBe(
      "83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249",
    );
  });

  it("states a producer tuple that is absent, so every connection claim is false", () => {
    expect(FINANCE_PRODUCER_TUPLE).toMatchObject({ bound: false, status: "NOT_BOUND", sdkDigest: null, manifestDigest: null, vectorDigest: null });
    expect(FINANCE_PRODUCER_TUPLE.waitingOn).toEqual([
      "kix-protocol:fin-catalogue-read-model",
      "kix-protocol:cr-08-producer-sdk",
      "refund-surface",
    ]);
    expect(FINANCE_NOT_BOUND_REASON).toContain("fin-catalogue-read-model");
    expect(FINANCE_NOT_BOUND_REASON).toContain("NOT_BOUND");
  });
});

describe("who may do what", () => {
  it("keeps view, export, proposal, and approval as separate capabilities", () => {
    expect(financeCapabilities(FINANCE_REVIEWER_ACTOR)).toEqual(["read", "export", "propose"]);
    expect(financeCapabilities(FINANCE_APPROVER_ACTOR)).toEqual(["read", "export", "approve"]);
    expect(financeCapabilities(FINANCE_VIEWER_ACTOR)).toEqual(["read"]);
    expect(financeCapabilities("someone-else")).toEqual([]);
    for (const actor of FINANCE_ACTORS) {
      expect(financeCapabilities(actor)).toContain("read");
    }
    expect(financeCapabilities(FINANCE_REVIEWER_ACTOR)).not.toContain("approve");
    expect(financeCapabilities(FINANCE_APPROVER_ACTOR)).not.toContain("propose");
  });

  it("lists the authority to change economic state with no holder, and only that row changes it", () => {
    const table = financeAuthorityTable();
    expect(table.map((row) => row.authority)).toEqual([...FINANCE_AUTHORITIES]);
    const change = table.find((row) => row.authority === "change-economic-state");
    expect(change).toEqual({ authority: "change-economic-state", heldBy: [], changesEconomicState: true });
    for (const row of table.filter((item) => item.authority !== "change-economic-state")) {
      expect(row.changesEconomicState, row.authority).toBe(false);
      expect(row.heldBy.length, row.authority).toBeGreaterThan(0);
    }
    expect(table.find((row) => row.authority === "propose-correction")?.heldBy).toEqual([FINANCE_REVIEWER_ACTOR]);
    expect(table.find((row) => row.authority === "approve-proposal")?.heldBy).toEqual([FINANCE_APPROVER_ACTOR]);
    expect(table.find((row) => row.authority === "export")?.heldBy).toEqual([FINANCE_REVIEWER_ACTOR, FINANCE_APPROVER_ACTOR]);
    // No actor holds a capability that is named like a force, a match, or a post.
    for (const actor of FINANCE_ACTORS) {
      expect(financeCapabilities(actor).join(" ")).not.toMatch(/force|match|post|apply|adjust|change/i);
    }
  });
});

describe("the clean queue", () => {
  it("lists one case per category plus a second unmatched case, each linked to its original trade", async () => {
    const snapshot = await ready(stub());
    expect(snapshot.cases.map((row) => row.caseRef)).toEqual(["rcs-0001", "rcs-0002", "rcs-0003", "rcs-0004", "rcs-0005", "rcs-0006", "rcs-0007"]);
    expect(new Set(snapshot.cases.map((row) => row.category))).toEqual(new Set(FINANCE_CATEGORIES));
    expect(snapshot.cases.filter((row) => row.category === "UNMATCHED")).toHaveLength(2);
    const trades = new Set(snapshot.originals.map((row) => row.tradeRef));
    for (const row of snapshot.cases) {
      expect(trades.has(row.tradeRef), row.caseRef).toBe(true);
      expect(row.merchantLineRef, row.caseRef).not.toBeNull();
      expect(row.unit).toBe("mock-unit");
    }
    expect(snapshot.originals.map((row) => row.tradeRef)).toEqual(["trd-0001", "trd-0002", "trd-0003"]);
    expect(assessFinanceSnapshot(snapshot).unlinked).toEqual([]);
  });

  it("states the source's own figures as text, with UNDETERMINED left as null and never filled in", async () => {
    const snapshot = await ready(stub());
    const byRef = new Map(snapshot.cases.map((row) => [row.caseRef, row]));
    expect(byRef.get("rcs-0002")).toMatchObject({ expectedAmount: "1200", observedAmount: "2400", differenceAmount: "1200", verdict: "mismatch" });
    expect(byRef.get("rcs-0003")).toMatchObject({ observedAmount: null, differenceAmount: null, verdict: "unknown", state: "unknown" });
    expect(byRef.get("rcs-0004")).toMatchObject({ differenceAmount: null, verdict: "unknown" });
    expect(byRef.get("rcs-0006")).toMatchObject({ expectedAmount: "1200", observedAmount: "1150", differenceAmount: "50" });
    const totals = new Map(snapshot.totals.map((row) => [row.category, row]));
    expect(totals.get("UNMATCHED")).toMatchObject({ caseCount: 2, amount: "2000", cutRef: "cut-0001" });
    expect(totals.get("DUPLICATE_OBSERVATION")?.amount).toBe("1200");
    expect(totals.get("MULTI_PAYEE")?.amount).toBeNull();
    expect(totals.get("LATE_FACT")?.amount).toBeNull();
    expect(totals.get("RESIDUAL")?.amount).toBeNull();
    expect(totals.get("BALANCE_MISMATCH")?.amount).toBe("50");
    expect(snapshot.balances.map((row) => [row.balanceRef, row.verdict, row.differenceAmount])).toEqual([
      ["bal-0001", "mismatch", "4800"],
      ["bal-0002", "mismatch", "50"],
      ["bal-0003", "matched", "0"],
    ]);
  });

  it("keeps a late fact its own fact on the cut it missed", async () => {
    const snapshot = await ready(stub());
    const late = snapshot.facts.filter((row) => row.arrival === "after-cut");
    expect(late).toHaveLength(1);
    expect(late[0]).toMatchObject({ factRef: "fct-0005", caseRef: "rcs-0003", kind: "late-arrival", cutRef: "cut-0002", amount: "800" });
    expect(snapshot.cases.find((row) => row.caseRef === "rcs-0003")?.observedAmount).toBeNull();
    expect(assessFinanceSnapshot(snapshot).lateFacts).toEqual(["fct-0005"]);
  });

  it("lists payees and the unapplied remainder as the source allocated them", async () => {
    const snapshot = await ready(stub());
    const multi = snapshot.allocations.filter((row) => row.caseRef === "rcs-0004");
    expect(multi.map((row) => [row.role, row.amount, row.kind])).toEqual([
      ["seller", "700", "payee-share"],
      ["venue", "300", "payee-share"],
      ["platform", "100", "payee-share"],
    ]);
    expect(new Set(multi.map((row) => row.payeeRef)).size).toBe(3);
    const residual = snapshot.allocations.filter((row) => row.caseRef === "rcs-0005");
    expect(residual.map((row) => [row.role, row.amount, row.kind])).toEqual([
      ["seller", "400", "payee-share"],
      ["lender", "400", "payee-share"],
      [null, "100", "unapplied-remainder"],
    ]);
    expect(residual.find((row) => row.kind === "unapplied-remainder")?.payeeRef).toBeNull();
  });

  it("reads four source cuts at one position and assesses them as aligned and current", async () => {
    const snapshot = await ready(stub());
    const assessment = assessFinanceSnapshot(snapshot);
    expect(snapshot.cuts.map((cut) => [cut.cutRef, cut.source])).toEqual([
      ["cut-0001", "order-ledger"],
      ["cut-0002", "payment-observations"],
      ["cut-0003", "settlement-ledger"],
      ["cut-0004", "servicing-ledger"],
    ]);
    expect(new Set(snapshot.cuts.map((cut) => cut.watermark))).toEqual(new Set([FINANCE_AS_OF]));
    expect(assessment.cutAlignment).toBe("aligned");
    expect(assessment.usedCuts).toHaveLength(4);
    expect(assessment.totals).toEqual({ state: "current", flags: [] });
    expect(assessment.skew).toEqual([]);
    expect(assessment.contradictions).toEqual([]);
    expect(assessment.queue).toEqual({ open: 6, unknown: 1, resolvedBySource: 0 });
    expect(snapshot.watermark).toBe(FINANCE_AS_OF);
  });

  it("states every non-claim as the literal false", async () => {
    const snapshot = await ready(stub());
    expect([...FINANCE_NON_CLAIM_FIELDS]).toEqual([
      "confirmationForcesMatch",
      "proposalChangesEconomicState",
      "approvalChangesEconomicState",
      "payoutExecuted",
      "postedToAccountingSystem",
      "exportIsBookOfRecord",
    ]);
    for (const field of FINANCE_NON_CLAIM_FIELDS) {
      expect(snapshot.nonClaims[field], field).toBe(false);
    }
    expect(findFinanceClaim(snapshot.nonClaims)).toBeNull();
  });

  it("links every case to the sibling sources it names, and to nothing they do not hold", async () => {
    const snapshot = await ready(stub());
    const merchant = await createStubMerchantOperations().read({
      contextKey: "stub|kix|merchant-desk|1",
      actorRef: MERCHANT_DESK_ACTOR,
      scope: { tenantId: MERCHANT_TENANT, merchantRef: MERCHANT_OWN_REF },
      watermarkFloor: null,
    });
    if (merchant.kind !== "ready") {
      throw new Error("the merchant source did not answer");
    }
    const trades = new Map(merchant.snapshot.trades.map((row) => [row.tradeRef, row]));
    for (const original of snapshot.originals) {
      const sibling = trades.get(original.tradeRef);
      expect(sibling, original.tradeRef).toMatchObject({
        listingRef: original.listingRef,
        eventRef: original.eventRef,
        statusLabel: original.statusLabel,
      });
    }
    const lines = new Map(merchant.snapshot.lines.map((row) => [row.obligationRef, row]));
    for (const row of snapshot.cases) {
      const line = lines.get(row.merchantLineRef ?? "");
      expect(line, row.caseRef).toMatchObject({ tradeRef: row.tradeRef, kind: row.lineKind, amount: row.expectedAmount });
    }
    const servicing = await createStubCreditServicing().read({
      contextKey: "stub|kix|credit-servicing-desk|1",
      actorRef: SERVICING_DESK_ACTOR,
      scope: { tenantId: SERVICING_TENANT, obligationRef: SERVICING_OWN_REF },
      watermarkFloor: null,
    });
    if (servicing.kind !== "ready") {
      throw new Error("the servicing source did not answer");
    }
    const payments = new Map(servicing.snapshot.payments.map((row) => [row.paymentRef, row]));
    const linked = snapshot.cases.filter((row) => row.paymentRef !== null);
    expect(linked.map((row) => row.caseRef)).toEqual(["rcs-0005"]);
    const payment = payments.get(linked[0]?.paymentRef ?? "");
    expect(payment).toBeDefined();
    // The lender share is the servicing payment's own amount, compared as text.
    expect(snapshot.allocations.find((row) => row.caseRef === "rcs-0005" && row.role === "lender")?.amount).toBe(payment?.amount);
  });
});

describe("a book the actor holds no grant for", () => {
  it("denies another book and an unknown actor, and returns no row", async () => {
    const port = stub();
    expect(await port.read(readRequest(FOREIGN))).toMatchObject({ kind: "denied", code: "SCOPE_DENIED", bookRef: FINANCE_FOREIGN_REF });
    expect(await port.read(readRequest(OWN, "someone-else"))).toMatchObject({ kind: "denied", code: "SCOPE_DENIED" });
    expect(await port.readExport(exportRequest(FOREIGN))).toMatchObject({ kind: "denied", code: "SCOPE_DENIED" });
    expect(await port.act(actRequest({ kind: "approve-proposal", proposalRef: "prp-0001" }, FOREIGN, FINANCE_APPROVER_ACTOR))).toMatchObject({
      kind: "denied",
      code: "SCOPE_DENIED",
    });
  });

  it("returns a withdrawn grant as denied on a read, an export, and a request", async () => {
    const port = stub();
    expect(port.synthetic("revoke-grant")).toBe(true);
    expect(await port.read(readRequest())).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
    expect(await port.readExport(exportRequest())).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
    expect(
      await port.act(actRequest({ kind: "propose-correction", caseRef: "rcs-0001", correction: "link-observation", note: "x" })),
    ).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
    expect(await stub("denied").read(readRequest())).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
  });

  it("refuses a request that is malformed before it reads", async () => {
    const port = stub();
    expect(await port.read({ ...readRequest(), contextKey: "" })).toMatchObject({ kind: "invalid-request", code: "CONTEXT" });
    expect(await port.read({ ...readRequest(), actorRef: " " })).toMatchObject({ kind: "invalid-request", code: "ACTOR" });
    expect(await port.read(readRequest({ tenantId: "other", bookRef: FINANCE_OWN_REF }))).toMatchObject({ kind: "invalid-request", code: "SCOPE" });
    expect(await port.read(readRequest({ tenantId: FINANCE_TENANT, bookRef: "mrc-0001" }))).toMatchObject({ kind: "invalid-request", code: "SCOPE" });
    expect(await port.read(readRequest(OWN, FINANCE_REVIEWER_ACTOR, "not-an-instant"))).toMatchObject({ kind: "invalid-request", code: "FLOOR" });
  });
});

describe("empty, stale, and lost reads", () => {
  it("returns an empty read for a book with no cases, which is not a zero figure", async () => {
    const outcome = await stub("empty").read(readRequest());
    expect(outcome).toMatchObject({ kind: "empty", watermark: FINANCE_AS_OF, scope: OWN });
    expect(Object.keys(outcome)).not.toContain("snapshot");
  });

  it("returns a stale read when the watermark is older than the floor, with no row", async () => {
    const outcome = await stub("stale").read(readRequest());
    expect(outcome).toEqual({ kind: "stale", watermark: FINANCE_STALE_WATERMARK, floor: FINANCE_STALE_FLOOR });
    const held = await stub().read(readRequest(OWN, FINANCE_REVIEWER_ACTOR, "2026-10-14T00:00:00.000Z"));
    expect(held).toEqual({ kind: "stale", watermark: FINANCE_AS_OF, floor: "2026-10-14T00:00:00.000Z" });
  });

  it("loses the answer to a read, so the caller has no row and no verdict", async () => {
    await expect(stub("read-lost").read(readRequest())).rejects.toThrow("never arrived");
  });
});

describe("source figures and what they are checked against", () => {
  it("flags a total built at an older generation than its cut and keeps it unrecomputed", async () => {
    const snapshot = await ready(stub("stale-totals"));
    const assessment = assessFinanceSnapshot(snapshot);
    expect(assessment.totals.state).toBe("stale");
    expect(assessment.totals.flags.map((flag) => flag.code)).toEqual(Array(6).fill("STALE_GENERATION"));
    expect(snapshot.totals.find((row) => row.category === "UNMATCHED")?.amount).toBe("2000");
  });

  it("flags a total that counts cases the read does not list", async () => {
    const snapshot = await ready(stub("totals-mismatch"));
    const assessment = assessFinanceSnapshot(snapshot);
    expect(assessment.totals.state).toBe("mismatch");
    expect(assessment.totals.flags).toHaveLength(1);
    expect(assessment.totals.flags[0]).toMatchObject({ code: "COUNT_DIFFERS", category: "UNMATCHED", cutRef: "cut-0001" });
    expect(assessment.totals.flags[0]?.detail).toContain("counts 3");
  });

  it("flags a total on an unknown cut and a case category the source sent no total for", async () => {
    const snapshot = clone(await ready(stub()));
    snapshot.totals = snapshot.totals.filter((row) => row.category !== "LATE_FACT").map((row) => (row.category === "RESIDUAL" ? { ...row, cutRef: "cut-0009" } : row));
    const flags = assessFinanceSnapshot(snapshot).totals.flags.map((flag) => flag.code);
    expect(flags).toContain("UNKNOWN_CUT");
    expect(flags.filter((code) => code === "MISSING")).toHaveLength(2);
  });

  it("states a verdict its own difference text contradicts, and trusts neither", async () => {
    const snapshot = await ready(stub("balance-mismatch"));
    const assessment = assessFinanceSnapshot(snapshot);
    expect(assessment.contradictions).toHaveLength(1);
    expect(assessment.contradictions[0]).toMatchObject({ kind: "balance", ref: "bal-0003", code: "MATCHED_WITH_DIFFERENCE" });
    expect(assessment.contradictions[0]?.detail).toContain("not shown as reconciled");
    const flipped = clone(await ready(stub()));
    flipped.cases = flipped.cases.map((row) => (row.caseRef === "rcs-0006" ? { ...row, differenceAmount: "0" } : row));
    expect(assessFinanceSnapshot(flipped).contradictions).toEqual([
      expect.objectContaining({ kind: "case", ref: "rcs-0006", code: "MISMATCH_WITHOUT_DIFFERENCE" }),
    ]);
    // A case whose difference the source did not state is not a contradiction.
    expect(assessFinanceSnapshot(await ready(stub())).contradictions).toEqual([]);
  });

  it("flags a case whose trade the read does not list, and attaches it nowhere", async () => {
    const snapshot = await ready(stub("dangling-link"));
    const assessment = assessFinanceSnapshot(snapshot);
    expect(assessment.unlinked).toEqual([{ lens: "cases", ref: "rcs-0007", missing: "trade", missingRef: "trd-0099" }]);
    expect(financeProposableCorrections(snapshot, assessment, "rcs-0007")).toEqual(["request-source-review"]);
    expect(financeProposableCorrections(snapshot, assessment, "rcs-0001")).toEqual(["link-observation", "request-source-review"]);
  });

  it("flags a fact, an allocation, and a proposal that name a case the read does not list", async () => {
    const snapshot = clone(await ready(stub("proposal-pending")));
    snapshot.cases = snapshot.cases.filter((row) => row.caseRef !== "rcs-0005" && row.caseRef !== "rcs-0001");
    const lenses = assessFinanceSnapshot(snapshot).unlinked.map((item) => item.lens);
    expect(lenses).toContain("facts");
    expect(lenses).toContain("allocations");
    expect(lenses).toContain("proposals");
  });
});

describe("sources at different positions", () => {
  it("flags the cases whose sides sit on different cuts instead of calling them matched or mismatched", async () => {
    const snapshot = await ready(stub("source-cut-skew"));
    const assessment = assessFinanceSnapshot(snapshot);
    expect(snapshot.cuts.find((cut) => cut.cutRef === "cut-0002")?.watermark).toBe(FINANCE_SKEW_WATERMARK);
    expect(assessment.cutAlignment).toBe("skewed");
    expect(assessment.skew.filter((item) => item.kind === "case").map((item) => item.ref)).toEqual(["rcs-0001", "rcs-0002", "rcs-0003", "rcs-0007"]);
    expect(assessment.skew.filter((item) => item.kind === "balance").map((item) => item.ref)).toEqual(["bal-0001"]);
    expect(assessment.skew[0]).toMatchObject({ leftCutRef: "cut-0001", rightCutRef: "cut-0002" });
    // The cases are still the source's own text. Skew adds no verdict.
    expect(snapshot.cases.find((row) => row.caseRef === "rcs-0001")?.verdict).toBe("mismatch");
  });

  it("offers only a request for the source to look again on a skewed case", async () => {
    const snapshot = await ready(stub("source-cut-skew"));
    const assessment = assessFinanceSnapshot(snapshot);
    expect(financeProposableCorrections(snapshot, assessment, "rcs-0001")).toEqual(["request-source-review"]);
    expect(financeProposableCorrections(snapshot, assessment, "rcs-0002")).toEqual(["request-source-review"]);
    expect(financeProposableCorrections(snapshot, assessment, "rcs-0004")).toEqual(["reassign-payee", "request-source-review"]);
    expect(financeProposableCases(snapshot, assessment).map((row) => row.caseRef)).toHaveLength(7);
  });

  it("withholds the export while the sources are skewed, though it is a complete export of the same cut set", async () => {
    const port = stub("source-cut-skew");
    const snapshot = await ready(port);
    const verdict = judgeFinanceExport(snapshot, assessFinanceSnapshot(snapshot), await exported(port));
    expect(verdict).toEqual({ state: "withheld", reasons: ["SOURCES_SKEWED"] });
  });
});

describe("refusing a payload before a row is shown", () => {
  it("refuses a payload that claims a confirmation forces a match, with no row", async () => {
    const outcome = await stub("claims-forced").read(readRequest());
    expect(outcome).toMatchObject({ kind: "refused", code: "CLAIM", field: "confirmationForcesMatch" });
    expect(Object.keys(outcome)).not.toContain("snapshot");
  });

  it("refuses a payload that leaks a row of another book", async () => {
    const outcome = await stub("scope-leak").read(readRequest());
    expect(outcome).toMatchObject({ kind: "refused", code: "SCOPE_LEAK", ref: "rcs-0008" });
  });

  it("refuses a payload whose non-claim field is missing, because silence is not a no", async () => {
    const base = await ready(stub());
    for (const field of FINANCE_NON_CLAIM_FIELDS) {
      const missing = clone(base) as unknown as { nonClaims: Record<string, unknown> };
      delete missing.nonClaims[field];
      expect(refuseFinanceSnapshot(missing as unknown as FinanceSnapshot), field).toMatchObject({ code: "CLAIM", field });
      const truthy = clone(base) as unknown as { nonClaims: Record<string, unknown> };
      truthy.nonClaims[field] = true;
      expect(refuseFinanceSnapshot(truthy as unknown as FinanceSnapshot), field).toMatchObject({ code: "CLAIM", field });
    }
    expect(findFinanceClaim(undefined)).toBe("confirmationForcesMatch");
  });

  it("refuses a malformed reference, amount, unit, kind, state, cut, or scope", async () => {
    const base = await ready(stub());
    const mutate = (change: (snapshot: FinanceSnapshot) => void) => {
      const copy = clone(base);
      change(copy);
      return refuseFinanceSnapshot(copy);
    };
    expect(refuseFinanceSnapshot(base)).toBeNull();
    expect(mutate((s) => { (s.cases[0] as { caseRef: string }).caseRef = "obl-0001"; })).toMatchObject({ code: "REF" });
    expect(mutate((s) => { (s.cases[0] as { tradeRef: string }).tradeRef = "rcs-0001"; })).toMatchObject({ code: "REF" });
    expect(mutate((s) => { (s.cases[0] as { merchantLineRef: string | null }).merchantLineRef = "trd-0001"; })).toMatchObject({ code: "REF" });
    expect(mutate((s) => { (s.cases[4] as { paymentRef: string | null }).paymentRef = "obl-0001"; })).toMatchObject({ code: "REF" });
    expect(mutate((s) => { (s.cuts[0] as { cutRef: string }).cutRef = "cut-1"; })).toMatchObject({ code: "REF", field: "cutRef" });
    expect(mutate((s) => { (s.cases[1] as { expectedAmount: string | null }).expectedAmount = "1.5"; })).toMatchObject({ code: "AMOUNT", ref: "rcs-0002" });
    expect(mutate((s) => { (s.cases[1] as { differenceAmount: string | null }).differenceAmount = "-1"; })).toMatchObject({ code: "AMOUNT" });
    expect(mutate((s) => { (s.cases[1] as { unit: string }).unit = "USD"; })).toMatchObject({ code: "UNIT" });
    expect(mutate((s) => { (s.cases[1] as { category: string }).category = "OTHER"; })).toMatchObject({ code: "KIND" });
    expect(mutate((s) => { (s.cases[1] as { state: string }).state = "closed"; })).toMatchObject({ code: "STATE" });
    expect(mutate((s) => { (s.cases[1] as { verdict: string }).verdict = "fine"; })).toMatchObject({ code: "STATE" });
    expect(mutate((s) => { (s.cases[1] as { lineKind: string }).lineKind = "repayment"; })).toMatchObject({ code: "KIND" });
    expect(mutate((s) => { (s.cases[1] as { cutRef: string }).cutRef = "cut-0009"; })).toMatchObject({ code: "CUT" });
    expect(mutate((s) => { (s.cases[0] as { observedCutRef: string | null }).observedCutRef = "cut-0009"; })).toMatchObject({ code: "CUT", field: "observedCutRef" });
    expect(mutate((s) => { (s.cases[1] as { bookRef: string }).bookRef = FINANCE_FOREIGN_REF; })).toMatchObject({ code: "SCOPE_LEAK" });
    expect(mutate((s) => { (s.cases[0] as unknown as { offeredCorrections: string[] }).offeredCorrections = ["force-match"]; })).toMatchObject({ code: "KIND" });
    expect(mutate((s) => { (s.facts[0] as { kind: string }).kind = "rumour"; })).toMatchObject({ code: "KIND" });
    expect(mutate((s) => { (s.facts[0] as { arrival: string }).arrival = "early"; })).toMatchObject({ code: "STATE" });
    expect(mutate((s) => { (s.facts[0] as { amount: string | null }).amount = "1,000"; })).toMatchObject({ code: "AMOUNT" });
    expect(mutate((s) => { (s.allocations[0] as { amount: string }).amount = "700.5"; })).toMatchObject({ code: "AMOUNT" });
    expect(mutate((s) => { (s.allocations[0] as { unit: string }).unit = "KRW"; })).toMatchObject({ code: "UNIT" });
    expect(mutate((s) => { (s.allocations[0] as { role: string | null }).role = "buyer"; })).toMatchObject({ code: "KIND" });
    expect(mutate((s) => { (s.totals[0] as { amount: string | null }).amount = "2e3"; })).toMatchObject({ code: "AMOUNT" });
    expect(mutate((s) => { (s.totals[0] as { category: string }).category = "OTHER"; })).toMatchObject({ code: "KIND" });
    expect(mutate((s) => { (s.balances[0] as { leftAmount: string }).leftAmount = "7,200"; })).toMatchObject({ code: "AMOUNT" });
    expect(mutate((s) => { (s.balances[0] as { verdict: string }).verdict = "reconciled"; })).toMatchObject({ code: "STATE" });
    expect(mutate((s) => { (s.balances[0] as { leftCutRef: string }).leftCutRef = "cut-0009"; })).toMatchObject({ code: "CUT" });
    expect(mutate((s) => { (s.balances[0] as { bookRef: string }).bookRef = FINANCE_FOREIGN_REF; })).toMatchObject({ code: "SCOPE_LEAK" });
  });

  it("refuses a proposal row that claims it changed economic state", async () => {
    const base = clone(await ready(stub("proposal-pending")));
    expect(refuseFinanceSnapshot(base)).toBeNull();
    (base.proposals[0] as unknown as { economicStateChanged: boolean }).economicStateChanged = true;
    expect(refuseFinanceSnapshot(base)).toMatchObject({ code: "CLAIM", field: "economicStateChanged", ref: "prp-0001" });
    const wrong = clone(await ready(stub("proposal-pending")));
    (wrong.proposals[0] as unknown as { correction: string }).correction = "force-match";
    expect(refuseFinanceSnapshot(wrong)).toMatchObject({ code: "KIND" });
    const state = clone(await ready(stub("proposal-pending")));
    (state.proposals[0] as unknown as { state: string }).state = "applied";
    expect(refuseFinanceSnapshot(state)).toMatchObject({ code: "STATE" });
  });
});

describe("the export", () => {
  it("is current for the read it was taken at, with a synthetic scope declaration", async () => {
    const port = stub();
    const snapshot = await ready(port);
    const assessment = assessFinanceSnapshot(snapshot);
    const file = await exported(port);
    expect(judgeFinanceExport(snapshot, assessment, file)).toEqual({ state: "current" });
    expect(file.scopeDeclaration).toEqual({
      provenance: "synthetic",
      realMoney: false,
      postedToAccountingSystem: false,
      bookOfRecord: false,
      target: "none",
    });
    expect(file.rows).toHaveLength(13);
    expect(file.declaredRowCount).toBe(13);
    expect(file.complete).toBe(true);
    expect(file.cuts).toHaveLength(4);
    expect(file.digest).toBe("syn-digest-0001");
    expect(file.exportRef).toBe("fex-0001");
  });

  it("copies the read's own text into its rows and sums nothing", async () => {
    const port = stub();
    const snapshot = await ready(port);
    const rows = financeExportRowsFor(snapshot);
    expect(rows).toEqual((await exported(port)).rows);
    const byRef = new Map(rows.map((row) => [row.entryRef, row]));
    expect(byRef.get("rcs-0002")).toMatchObject({ entryKind: "case", amount: "1200", category: "DUPLICATE_OBSERVATION", cutRef: "cut-0001", payeeRef: null });
    expect(byRef.get("rcs-0003")?.amount).toBeNull();
    expect(byRef.get("fal-0002")).toMatchObject({ entryKind: "payee-share", amount: "300", payeeRef: "pye-0002", category: "MULTI_PAYEE", cutRef: "cut-0003" });
    expect(byRef.get("fal-0006")).toMatchObject({ entryKind: "unapplied-remainder", amount: "100", payeeRef: null, category: "RESIDUAL", cutRef: "cut-0004" });
  });

  it("is withheld with every reason that applies, and is never repaired", async () => {
    const port = stub();
    const snapshot = await ready(port);
    const assessment = assessFinanceSnapshot(snapshot);
    const base = await exported(port);
    const withheld = (change: Partial<FinanceExport>, expected: string[]) => {
      const verdict = judgeFinanceExport(snapshot, assessment, { ...clone(base), ...change });
      expect(verdict.state === "withheld" ? verdict.reasons : verdict, JSON.stringify(Object.keys(change))).toEqual(expected);
    };
    withheld({ scope: FOREIGN }, ["SCOPE"]);
    withheld({ complete: false }, ["PARTIAL"]);
    withheld({ declaredRowCount: 9 }, ["COUNT"]);
    withheld({ cuts: base.cuts.map((cut) => (cut.cutRef === "cut-0003" ? { ...cut, generation: cut.generation - 1 } : cut)) }, ["STALE_CUT"]);
    withheld({ cuts: base.cuts.map((cut) => (cut.cutRef === "cut-0003" ? { ...cut, generation: cut.generation + 1 } : cut)) }, ["AHEAD_CUT"]);
    withheld({ cuts: base.cuts.map((cut) => (cut.cutRef === "cut-0003" ? { ...cut, watermark: FINANCE_SKEW_WATERMARK } : cut)) }, ["STALE_CUT"]);
    withheld({ cuts: base.cuts.filter((cut) => cut.cutRef !== "cut-0004") }, ["CUT_MISSING", "ROW_OFF_CUT"]);
    withheld({ cuts: [...base.cuts, { cutRef: "cut-0009", source: "order-ledger", generation: 1, watermark: FINANCE_AS_OF }] }, ["UNKNOWN_CUT"]);
    withheld({ rows: base.rows.map((row) => (row.entryRef === "rcs-0002" ? { ...row, amount: "1300" } : row)) }, ["ROWS_DIFFER"]);
    withheld({ rows: base.rows.map((row) => (row.entryRef === "fal-0006" ? { ...row, payeeRef: "pye-0009" } : row)) }, ["ROWS_DIFFER"]);
    withheld({ rows: base.rows.map((row) => (row.entryRef === "fal-0001" ? { ...row, cutRef: "cut-0009" } : row)) }, ["ROW_OFF_CUT", "ROWS_DIFFER"]);
    withheld({ rows: [...base.rows, base.rows[0] as FinanceExport["rows"][number]], declaredRowCount: 14 }, ["ROWS_DIFFER"]);
    withheld({ rows: base.rows.slice(0, 10), declaredRowCount: 13, complete: false }, ["PARTIAL", "COUNT", "ROWS_DIFFER"]);
    expect(judgeFinanceExport(null, null, base)).toEqual({ state: "withheld", reasons: ["NO_SNAPSHOT"] });
  });

  it("turns withheld the moment the source moves on, without a second export", async () => {
    const port = stub();
    const first = await exported(port);
    expect(port.synthetic("advance-cut")).toBe(true);
    const snapshot = await ready(port);
    expect(judgeFinanceExport(snapshot, assessFinanceSnapshot(snapshot), first)).toEqual({ state: "withheld", reasons: ["STALE_CUT"] });
    const again = await exported(port);
    expect(judgeFinanceExport(snapshot, assessFinanceSnapshot(snapshot), again)).toEqual({ state: "current" });
    const behind = await ready(stub());
    const late = await exported((() => { const next = stub(); next.synthetic("advance-cut"); return next; })());
    expect(judgeFinanceExport(behind, assessFinanceSnapshot(behind), late)).toEqual({ state: "withheld", reasons: ["AHEAD_CUT"] });
  });

  it("judges the position of every cut: an unreadable position, another source, or a cut that is older and newer at once", async () => {
    const port = stub();
    const snapshot = await ready(port);
    const assessment = assessFinanceSnapshot(snapshot);
    const base = await exported(port);
    const reasonsFor = (cuts: FinanceExport["cuts"]) => {
      const verdict = judgeFinanceExport(snapshot, assessment, { ...clone(base), cuts });
      return verdict.state === "withheld" ? verdict.reasons : verdict;
    };
    const swap = (patch: Record<string, unknown>) => base.cuts.map((cut) => (cut.cutRef === "cut-0002" ? { ...cut, ...patch } : cut)) as FinanceExport["cuts"];
    // An unreadable watermark or generation is not a position, so it is not current.
    expect(reasonsFor(swap({ watermark: "garbage" }))).toEqual(["UNKNOWN_CUT"]);
    expect(reasonsFor(swap({ generation: Number.NaN }))).toEqual(["UNKNOWN_CUT"]);
    expect(reasonsFor(swap({ generation: 9.5 }))).toEqual(["UNKNOWN_CUT"]);
    // The same cut reference named for another source is another cut.
    expect(reasonsFor(swap({ source: "order-ledger" }))).toEqual(["UNKNOWN_CUT"]);
    // Older in generation and newer in watermark is both stale and ahead, and says so.
    expect(reasonsFor(swap({ generation: 8, watermark: "2026-10-14T00:00:00.000Z" }))).toEqual(["STALE_CUT", "AHEAD_CUT"]);
    // A cut the read lists but no row used must still appear: the cut set is the read's cut set.
    const wider = clone(snapshot);
    wider.cuts = [...wider.cuts, { cutRef: "cut-0005", source: "order-ledger", generation: 1, watermark: FINANCE_AS_OF }];
    expect(judgeFinanceExport(wider, assessFinanceSnapshot(wider), base)).toEqual({ state: "withheld", reasons: ["CUT_MISSING"] });
  });

  it("refuses a cut whose generation or watermark is not a position, on a read and on an export", async () => {
    const port = stub();
    const base = await ready(port);
    for (const patch of [{ watermark: "garbage" }, { generation: -1 }, { generation: 1.5 }, { generation: "5" }]) {
      const copy = clone(base);
      (copy.cuts[0] as unknown as Record<string, unknown>).generation = (patch as Record<string, unknown>).generation ?? copy.cuts[0]?.generation;
      (copy.cuts[0] as unknown as Record<string, unknown>).watermark = (patch as Record<string, unknown>).watermark ?? copy.cuts[0]?.watermark;
      expect(refuseFinanceSnapshot(copy), JSON.stringify(patch)).toMatchObject({ code: "CUT", field: "generation" });
    }
    const file = await exported(port);
    const bad = clone(file);
    (bad.cuts[1] as unknown as Record<string, unknown>).watermark = "garbage";
    expect(refuseFinanceExport(bad, OWN)).toMatchObject({ code: "CUT", field: "generation" });
    const other = clone(file);
    (other.cuts[1] as unknown as Record<string, unknown>).source = "bank";
    expect(refuseFinanceExport(other, OWN)).toMatchObject({ code: "KIND", field: "source" });
  });

  it("serves the export scenarios as partial, stale, or differing rows", async () => {
    for (const [scenario, expected] of [
      ["export-partial", ["PARTIAL", "COUNT", "ROWS_DIFFER"]],
      ["export-stale", ["STALE_CUT"]],
      ["export-rows-differ", ["ROWS_DIFFER"]],
    ] as const) {
      const port = stub(scenario);
      const snapshot = await ready(port);
      const verdict = judgeFinanceExport(snapshot, assessFinanceSnapshot(snapshot), await exported(port));
      expect(verdict, scenario).toEqual({ state: "withheld", reasons: expected });
    }
  });

  it("denies the export to an actor that holds none, and when the source grants the read only", async () => {
    expect(await stub().readExport(exportRequest(OWN, FINANCE_VIEWER_ACTOR))).toMatchObject({ kind: "denied", code: "EXPORT_DENIED" });
    expect(await stub("export-denied").readExport(exportRequest())).toMatchObject({ kind: "denied", code: "EXPORT_DENIED" });
    expect((await stub("export-denied").read(readRequest())).kind).toBe("ready");
    expect(await stub().readExport(exportRequest(OWN, FINANCE_APPROVER_ACTOR))).toMatchObject({ kind: "ready" });
  });

  it("refuses an export that claims real money, a posting, a book of record, an accounting target, or no provenance", async () => {
    expect(await stub("export-claims-real").readExport(exportRequest())).toMatchObject({ kind: "refused", code: "CLAIM", field: "realMoney" });
    const base = await exported(stub());
    expect(refuseFinanceExport(base, OWN)).toBeNull();
    const declare = (patch: Record<string, unknown>) => ({ ...clone(base), scopeDeclaration: { ...base.scopeDeclaration, ...patch } }) as unknown as FinanceExport;
    expect(refuseFinanceExport(declare({ postedToAccountingSystem: true }), OWN)).toMatchObject({ code: "CLAIM", field: "postedToAccountingSystem" });
    expect(refuseFinanceExport(declare({ bookOfRecord: true }), OWN)).toMatchObject({ code: "CLAIM", field: "bookOfRecord" });
    expect(refuseFinanceExport(declare({ bookOfRecord: undefined }), OWN)).toMatchObject({ code: "CLAIM", field: "bookOfRecord" });
    expect(refuseFinanceExport(declare({ provenance: "production" }), OWN)).toMatchObject({ code: "CLAIM", field: "provenance" });
    expect(refuseFinanceExport(declare({ target: "ledger-system" }), OWN)).toMatchObject({ code: "CLAIM", field: "target" });
    expect(refuseFinanceExport({ ...clone(base), scopeDeclaration: undefined } as unknown as FinanceExport, OWN)).toMatchObject({ code: "CLAIM", field: "provenance" });
  });

  it("refuses an export payload for another scope or with a malformed row before it is returned", async () => {
    const base = await exported(stub());
    expect(refuseFinanceExport({ ...base, scope: FOREIGN }, OWN)).toMatchObject({ code: "SCOPE_LEAK" });
    expect(refuseFinanceExport({ ...base, exportRef: "exp-0001" }, OWN)).toMatchObject({ code: "REF", field: "exportRef" });
    const row = (patch: Record<string, unknown>) =>
      ({ ...clone(base), rows: base.rows.map((item, index) => (index === 0 ? { ...item, ...patch } : item)) }) as FinanceExport;
    expect(refuseFinanceExport(row({ amount: "1.5" }), OWN)).toMatchObject({ code: "AMOUNT", ref: "rcs-0001" });
    expect(refuseFinanceExport(row({ unit: "USD" }), OWN)).toMatchObject({ code: "UNIT" });
    expect(refuseFinanceExport(row({ category: "OTHER" }), OWN)).toMatchObject({ code: "KIND" });
    expect(refuseFinanceExport(row({ entryKind: "ledger-entry" }), OWN)).toMatchObject({ code: "KIND", field: "entryKind" });
    expect(refuseFinanceExport(row({ entryRef: "fal-0001" }), OWN)).toMatchObject({ code: "REF" });
    expect(refuseFinanceExport({ ...clone(base), cuts: [{ ...base.cuts[0], cutRef: "x" }] } as unknown as FinanceExport, OWN)).toMatchObject({ code: "REF" });
  });

  it("sends no digest verdict: the digest is opaque producer text", () => {
    const source = readFileSync(path.join(repoRoot, "packages/protocol-adapter/src/finance-operations.ts"), "utf8");
    expect(source).not.toMatch(/createHash|sha256Hex|digest\s*===|digest\s*!==/);
  });
});

describe("a correction proposal is not a change of economic state", () => {
  const propose = (port: StubFinanceOperations, patch: Partial<Extract<FinanceActionRequest, { kind: "propose-correction" }>> = {}, actor: string = FINANCE_REVIEWER_ACTOR) =>
    port.act(actRequest({ kind: "propose-correction", caseRef: "rcs-0001", correction: "link-observation", note: "Link it to the later payment.", ...patch }, OWN, actor));

  it("records a proposal and leaves every case, figure, total, balance, and cut as it was", async () => {
    const port = stub();
    const before = await ready(port);
    const outcome = await propose(port);
    expect(outcome).toEqual({
      kind: "applied",
      receipt: { kind: "proposal-recorded", proposalRef: "prp-0001", caseRef: "rcs-0001", economicStateChanged: false, confirmationForcesMatch: false },
    });
    const after = await ready(port);
    expect(ledgerOf(after)).toEqual(ledgerOf(before));
    expect(after.proposals).toEqual([
      expect.objectContaining({ proposalRef: "prp-0001", caseRef: "rcs-0001", correction: "link-observation", state: "pending", proposedBy: FINANCE_REVIEWER_ACTOR, economicStateChanged: false }),
    ]);
    expect(after.cases.find((row) => row.caseRef === "rcs-0001")).toMatchObject({ state: "open", verdict: "mismatch", differenceAmount: "1100" });
  });

  it("records an approval by a different actor, and the ledger still does not move", async () => {
    const port = stub();
    const before = await ready(port);
    await propose(port);
    const outcome = await port.act(actRequest({ kind: "approve-proposal", proposalRef: "prp-0001" }, OWN, FINANCE_APPROVER_ACTOR));
    expect(outcome).toEqual({
      kind: "applied",
      receipt: { kind: "approval-recorded", proposalRef: "prp-0001", caseRef: "rcs-0001", economicStateChanged: false, confirmationForcesMatch: false },
    });
    const after = await ready(port);
    expect(after.proposals[0]).toMatchObject({ state: "approval-recorded", economicStateChanged: false });
    expect(ledgerOf(after)).toEqual(ledgerOf(before));
    // The case is still open with the same difference, and a second approval is refused.
    expect(after.cases.find((row) => row.caseRef === "rcs-0001")).toMatchObject({ state: "open", observedAmount: null, differenceAmount: "1100", verdict: "mismatch" });
    expect(await port.act(actRequest({ kind: "approve-proposal", proposalRef: "prp-0001" }, OWN, FINANCE_APPROVER_ACTOR))).toMatchObject({ kind: "rejected", code: "NOT_PENDING" });
  });

  it("separates the capabilities: only the reviewer proposes and only the approver approves", async () => {
    const port = stub();
    expect(await propose(port, {}, FINANCE_APPROVER_ACTOR)).toMatchObject({ kind: "rejected", code: "NO_CAPABILITY" });
    expect(await propose(port, {}, FINANCE_VIEWER_ACTOR)).toMatchObject({ kind: "rejected", code: "NO_CAPABILITY" });
    await propose(port);
    for (const actor of [FINANCE_REVIEWER_ACTOR, FINANCE_VIEWER_ACTOR]) {
      expect(await port.act(actRequest({ kind: "approve-proposal", proposalRef: "prp-0001" }, OWN, actor)), actor).toMatchObject({ kind: "rejected", code: "NO_CAPABILITY" });
    }
    expect(port.effects().acts).toBe(5);
  });

  it("rejects an actor approving a proposal it made itself", async () => {
    const port = stub("self-approval");
    const snapshot = await ready(port, OWN, FINANCE_APPROVER_ACTOR);
    expect(snapshot.proposals[0]).toMatchObject({ proposedBy: FINANCE_APPROVER_ACTOR, state: "pending" });
    expect(await port.act(actRequest({ kind: "approve-proposal", proposalRef: "prp-0001" }, OWN, FINANCE_APPROVER_ACTOR))).toMatchObject({
      kind: "rejected",
      code: "SELF_APPROVAL",
    });
    expect((await ready(port, OWN, FINANCE_APPROVER_ACTOR)).proposals[0]).toMatchObject({ state: "pending" });
  });

  it("rejects a correction the source does not offer, a case it does not hold, and a second pending proposal", async () => {
    const port = stub();
    expect(await propose(port, { correction: "mark-duplicate" })).toMatchObject({ kind: "rejected", code: "NOT_OFFERED" });
    expect(await propose(port, { caseRef: "rcs-0099" })).toMatchObject({ kind: "rejected", code: "UNKNOWN_CASE" });
    expect(await propose(port, { caseRef: "rcs-0008" })).toMatchObject({ kind: "rejected", code: "UNKNOWN_CASE" });
    expect(await propose(port, { correction: "request-source-review" })).toMatchObject({ kind: "applied" });
    expect(await propose(port, { correction: "request-source-review" })).toMatchObject({ kind: "rejected", code: "DUPLICATE_PENDING" });
    expect(await port.act(actRequest({ kind: "approve-proposal", proposalRef: "prp-0099" }, OWN, FINANCE_APPROVER_ACTOR))).toMatchObject({ kind: "rejected", code: "UNKNOWN_PROPOSAL" });
  });

  it("refuses a malformed request before it records anything", async () => {
    const port = stub();
    expect(await propose(port, { caseRef: "trd-0001" })).toMatchObject({ kind: "invalid-request", code: "REF" });
    expect(await propose(port, { note: " " })).toMatchObject({ kind: "invalid-request", code: "TEXT" });
    expect(await propose(port, { note: "x".repeat(201) })).toMatchObject({ kind: "invalid-request", code: "TEXT" });
    expect(await propose(port, { note: "a\u0007b" })).toMatchObject({ kind: "invalid-request", code: "TEXT" });
    expect(await propose(port, { correction: "force-match" as never })).toMatchObject({ kind: "invalid-request", code: "ACTION" });
    expect(await port.act(actRequest({ kind: "force-match" } as unknown as FinanceActionRequest))).toMatchObject({ kind: "invalid-request", code: "ACTION" });
    expect(await port.act(actRequest({ kind: "approve-proposal", proposalRef: "rcs-0001" }, OWN, FINANCE_APPROVER_ACTOR))).toMatchObject({ kind: "invalid-request", code: "REF" });
    expect((await ready(port)).proposals).toEqual([]);
  });

  it("answers every kind of request that would force, confirm, apply, or post as an invalid action and leaves the ledger alone", async () => {
    const port = stub();
    const before = await ready(port);
    for (const kind of ["force-match", "confirm-match", "mark-reconciled", "apply-correction", "change-economic-state", "post-adjustment", "settle", "pay-out", "approve-and-apply"]) {
      const outcome = await port.act(actRequest({ kind, caseRef: "rcs-0001", proposalRef: "prp-0001" } as unknown as FinanceActionRequest, OWN, FINANCE_APPROVER_ACTOR));
      expect(outcome, kind).toMatchObject({ kind: "invalid-request", code: "ACTION" });
    }
    const after = await ready(port);
    expect(ledgerOf(after)).toEqual(ledgerOf(before));
    expect(after.proposals).toEqual([]);
  });

  it("has no request that forces a match, applies a correction, or changes economic state", () => {
    const source = readFileSync(path.join(repoRoot, "packages/protocol-adapter/src/finance-operations.ts"), "utf8");
    expect(source).toContain('export const FINANCE_ACTION_KINDS = ["propose-correction", "approve-proposal"] as const;');
    expect(source).not.toMatch(/kind:\s*"(force-match|apply-correction|mark-reconciled|confirm-match|change-economic-state)"/);
    for (const kind of ["force-match", "apply-correction", "mark-reconciled", "confirm-match"]) {
      expect(source, kind).not.toContain(`"${kind}"`);
    }
  });

  it("answers an approval that claims the economy changed with a refused answer, and the approval was recorded", async () => {
    const port = stub("approve-claims-applied");
    await propose(port);
    const outcome = await port.act(actRequest({ kind: "approve-proposal", proposalRef: "prp-0001" }, OWN, FINANCE_APPROVER_ACTOR));
    expect(outcome).toMatchObject({ kind: "refused", code: "CLAIM", field: "economicStateChanged" });
    // The answer is not trusted, but the approval may have been recorded. It stays unknown to the caller.
    expect((await ready(port)).proposals[0]).toMatchObject({ state: "approval-recorded" });
  });

  it("loses the answer to a request that took effect, so the caller cannot tell", async () => {
    const port = stub("act-lost");
    await expect(propose(port)).rejects.toThrow("never arrived");
    expect((await ready(port)).proposals).toEqual([expect.objectContaining({ proposalRef: "prp-0001", state: "pending" })]);
  });

  it("refuses a receipt that does not state both non-claims as false, or that answers another request", () => {
    const request: FinanceActionRequest = { kind: "propose-correction", caseRef: "rcs-0001", correction: "link-observation", note: "n" };
    const receipt = { kind: "proposal-recorded", proposalRef: "prp-0001", caseRef: "rcs-0001", economicStateChanged: false, confirmationForcesMatch: false } as const;
    expect(refuseFinanceReceipt(receipt, request)).toBeNull();
    expect(refuseFinanceReceipt({ ...receipt, economicStateChanged: true } as never, request)).toMatchObject({ code: "CLAIM", field: "economicStateChanged" });
    expect(refuseFinanceReceipt({ ...receipt, confirmationForcesMatch: true } as never, request)).toMatchObject({ code: "CLAIM", field: "confirmationForcesMatch" });
    const silent: Record<string, unknown> = { ...receipt };
    delete silent.confirmationForcesMatch;
    expect(refuseFinanceReceipt(silent as never, request)).toMatchObject({ code: "CLAIM" });
    expect(refuseFinanceReceipt({ ...receipt, kind: "approval-recorded" }, request)).toMatchObject({ code: "STATE" });
    expect(refuseFinanceReceipt({ ...receipt, proposalRef: "rcs-0001" }, request)).toMatchObject({ code: "REF" });
    expect(refuseFinanceReceipt({ ...receipt, caseRef: "rcs-0002" }, request)).toMatchObject({ code: "REF", field: "caseRef" });
    const approve: FinanceActionRequest = { kind: "approve-proposal", proposalRef: "prp-0001" };
    expect(refuseFinanceReceipt({ ...receipt, kind: "approval-recorded" }, approve)).toBeNull();
    expect(refuseFinanceReceipt({ ...receipt, kind: "approval-recorded", proposalRef: "prp-0002" }, approve)).toMatchObject({ code: "REF", field: "proposalRef" });
  });

  it("offers a request only while the read supports it", async () => {
    const snapshot = await ready(stub());
    const assessment = assessFinanceSnapshot(snapshot);
    expect(financeEligibility(snapshot, assessment, "propose-correction")).toEqual({ allowed: true, reason: null });
    expect(financeEligibility(snapshot, assessment, "approve-proposal")).toMatchObject({ allowed: false });
    expect(financeApprovableProposals(snapshot)).toEqual([]);
    const pending = await ready(stub("proposal-pending"));
    expect(financeEligibility(pending, assessFinanceSnapshot(pending), "approve-proposal")).toEqual({ allowed: true, reason: null });
    const none = clone(snapshot);
    none.cases = none.cases.map((row) => ({ ...row, state: "resolved-by-source" as const }));
    expect(financeEligibility(none, assessFinanceSnapshot(none), "propose-correction")).toMatchObject({ allowed: false });
    expect(financeProposableCorrections(snapshot, assessment, "rcs-0099")).toEqual([]);
  });
});

describe("only the source moves the ledger", () => {
  it("resolves the next open case at a later cut, restates nothing it cannot, and turns an earlier export stale", async () => {
    const port = stub();
    const before = await ready(port);
    const earlier = await exported(port);
    expect(port.synthetic("post-source-correction")).toBe(true);
    const after = await ready(port);
    expect(after.cases.find((row) => row.caseRef === "rcs-0001")).toMatchObject({
      state: "resolved-by-source",
      verdict: "matched",
      differenceAmount: "0",
      observedAmount: "1100",
      offeredCorrections: [],
    });
    expect(after.cases.filter((row) => row.state === "resolved-by-source")).toHaveLength(1);
    expect(after.cuts[0]?.generation).toBe((before.cuts[0]?.generation ?? 0) + 1);
    // This stub holds no ledger to restate a total from, so the category total is stated as none.
    expect(after.totals.find((row) => row.category === "UNMATCHED")).toMatchObject({ amount: null, caseCount: 2 });
    const assessment = assessFinanceSnapshot(after);
    expect(assessment.totals.state).toBe("current");
    expect(assessment.queue).toEqual({ open: 5, unknown: 1, resolvedBySource: 1 });
    // The earlier export is behind the new cut, and its rows no longer match the resolved case.
    expect(judgeFinanceExport(after, assessment, earlier)).toEqual({ state: "withheld", reasons: ["STALE_CUT", "ROWS_DIFFER"] });
    expect(financeProposableCorrections(after, assessment, "rcs-0001")).toEqual([]);
    expect(await port.act(actRequest({ kind: "propose-correction", caseRef: "rcs-0001", correction: "link-observation", note: "n" }))).toMatchObject({
      kind: "rejected",
      code: "CASE_RESOLVED",
    });
  });

  it("resolves cases one at a time and then has nothing left to resolve", async () => {
    const port = stub();
    for (let index = 0; index < 7; index += 1) {
      expect(port.synthetic("post-source-correction"), String(index)).toBe(true);
    }
    expect(port.synthetic("post-source-correction")).toBe(false);
    const snapshot = await ready(port);
    expect(snapshot.cases.every((row) => row.state === "resolved-by-source")).toBe(true);
    expect(assessFinanceSnapshot(snapshot).contradictions).toEqual([]);
    expect(refuseFinanceSnapshot(snapshot)).toBeNull();
  });

  it("closes a proposal that is still pending on a case the source resolved, and leaves nothing to approve", async () => {
    const port = stub("proposal-pending");
    expect(port.synthetic("post-source-correction")).toBe(true);
    const snapshot = await ready(port, OWN, FINANCE_APPROVER_ACTOR);
    expect(snapshot.cases.find((row) => row.caseRef === "rcs-0001")?.state).toBe("resolved-by-source");
    expect(snapshot.proposals[0]).toMatchObject({ proposalRef: "prp-0001", state: "rejected", economicStateChanged: false });
    expect(financeApprovableProposals(snapshot)).toEqual([]);
    expect(financeEligibility(snapshot, assessFinanceSnapshot(snapshot), "approve-proposal")).toMatchObject({ allowed: false });
    expect(await port.act(actRequest({ kind: "approve-proposal", proposalRef: "prp-0001" }, OWN, FINANCE_APPROVER_ACTOR))).toMatchObject({
      kind: "rejected",
      code: "NOT_PENDING",
    });
    // An approval recorded before the source resolved the case stays what it was.
    const recorded = stub("proposal-pending");
    await recorded.act(actRequest({ kind: "approve-proposal", proposalRef: "prp-0001" }, OWN, FINANCE_APPROVER_ACTOR));
    recorded.synthetic("post-source-correction");
    expect((await ready(recorded)).proposals[0]?.state).toBe("approval-recorded");
    // A client that is handed a pending proposal on a resolved case offers no approval either.
    const stale = clone(await ready(stub("proposal-pending")));
    stale.cases = stale.cases.map((row) => (row.caseRef === "rcs-0001" ? { ...row, state: "resolved-by-source" as const } : row));
    expect(financeApprovableProposals(stale)).toEqual([]);
  });

  it("does not let an approval resolve a case, but a source cut does", async () => {
    const port = stub("proposal-pending");
    await port.act(actRequest({ kind: "approve-proposal", proposalRef: "prp-0001" }, OWN, FINANCE_APPROVER_ACTOR));
    expect((await ready(port)).cases.every((row) => row.state !== "resolved-by-source")).toBe(true);
    port.synthetic("post-source-correction");
    expect((await ready(port)).cases.filter((row) => row.state === "resolved-by-source")).toHaveLength(1);
  });
});

describe("the not-bound port", () => {
  it("answers not-bound on a read, an export, and a request, and offers no synthetic control", async () => {
    const port = createNotBoundFinanceOperations();
    expect(port).toMatchObject({ environment: "integration-http", source: "none" });
    for (const outcome of [
      await port.read(readRequest()),
      await port.readExport(exportRequest()),
      await port.act(actRequest({ kind: "approve-proposal", proposalRef: "prp-0001" })),
    ]) {
      expect(outcome).toEqual({ kind: "not-bound", reason: FINANCE_NOT_BOUND_REASON });
    }
    for (const control of ["revoke-grant", "advance-cut", "post-source-correction"] as const) {
      expect(port.synthetic(control), control).toBe(false);
    }
  });

  it("selects the stub only for the stub environment and never falls to the stub from integration-http", () => {
    expect(financeOperationsPortFor("stub")).toMatchObject({ environment: "stub", source: "synthetic-finance" });
    expect(financeOperationsPortFor("integration-http")).toMatchObject({ environment: "integration-http", source: "none" });
    expect(financeOperationsPortFor("integration-http", { scenario: "clean" }).source).toBe("none");
  });
});

describe("a changed producer tuple", () => {
  it("returns tuple-changed before any row on a read, an export, and a request", async () => {
    const changed = { ...DISCOVERY_READ_TUPLE_LITERALS, protocolMergeSha: "0".repeat(40) };
    const port = createStubFinanceOperations({ expectedTuple: changed });
    const outcome = await port.read(readRequest());
    expect(outcome).toMatchObject({ kind: "tuple-changed", field: "protocolMergeSha", expected: "0".repeat(40) });
    expect(Object.keys(outcome)).not.toContain("snapshot");
    expect(await port.readExport(exportRequest())).toMatchObject({ kind: "tuple-changed", field: "protocolMergeSha" });
    expect(await port.act(actRequest({ kind: "approve-proposal", proposalRef: "prp-0001" }, OWN, FINANCE_APPROVER_ACTOR))).toMatchObject({
      kind: "tuple-changed",
    });
    const sdk = createStubFinanceOperations({ expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, sdkDigest: "sha256:x" as unknown as null } });
    expect(await sdk.read(readRequest())).toMatchObject({ kind: "tuple-changed", field: "sdkTuple" });
  });
});

describe("every scenario", () => {
  it("returns a defined outcome for a read, an export, and a request, and none is a protocol write", async () => {
    for (const scenario of FINANCE_SCENARIOS) {
      const port = stub(scenario);
      let read: FinanceReadOutcome | "rejected";
      try {
        read = await port.read(readRequest());
      } catch {
        read = "rejected";
      }
      const sent: FinanceExportOutcome = await port.readExport(exportRequest());
      let acted: FinanceActOutcome | "rejected";
      try {
        acted = await port.act(actRequest({ kind: "propose-correction", caseRef: "rcs-0002", correction: "mark-duplicate", note: "same payment" }));
      } catch {
        acted = "rejected";
      }
      const readKinds = ["ready", "empty", "stale", "denied", "refused", "rejected"];
      const exportKinds = ["ready", "denied", "refused"];
      const actKinds = ["applied", "rejected", "denied", "refused", "rejected-answer"];
      expect(readKinds, scenario).toContain(read === "rejected" ? "rejected" : read.kind);
      expect(exportKinds, scenario).toContain(sent.kind);
      expect(actKinds, scenario).toContain(acted === "rejected" ? "rejected-answer" : acted.kind);
      // Nothing in any scenario is a tuple change, a not-bound answer, or an invalid request on this path.
      for (const kind of ["tuple-changed", "not-bound", "invalid-request", "unknown"]) {
        expect([read === "rejected" ? "" : read.kind, sent.kind, acted === "rejected" ? "" : acted.kind], scenario).not.toContain(kind);
      }
      expect(port.effects(), scenario).toEqual({ reads: 1, exports: 1, acts: 1 });
    }
  });

  it("names every scenario once", () => {
    expect(new Set(FINANCE_SCENARIOS).size).toBe(FINANCE_SCENARIOS.length);
    expect(FINANCE_SCENARIOS).toContain("clean");
  });
});

describe("source", () => {
  const files = ["finance-operations.ts", "finance-controller.ts"].map((name) =>
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

  it("copies figures and compares them as text, with no ordering and no sum over an amount", () => {
    const combined = files.join("\n");
    // No operator directly after an amount name, whatever the spacing, and no ordering helper.
    expect(combined).not.toMatch(/[aA]mount\s*(?:[-+*%<>]|\/(?![/*]))/);
    expect(combined).not.toMatch(/\+=\s*(row|line|item|case)\./);
    for (const token of ["Math.max", "Math.min", "Math.round", "Math.floor", "localeCompare", "Intl.NumberFormat", ".sort(", "+row.", "+line."]) {
      expect(combined, token).not.toContain(token);
    }
  });
});
