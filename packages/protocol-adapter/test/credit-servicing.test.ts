import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  DISCOVERY_READ_TUPLE_LITERALS,
  JOURNEY_NOT_COMPOSED,
  SERVICING_ACTION_KINDS,
  SERVICING_APPROVER_ACTOR,
  SERVICING_DESK_ACTOR,
  SERVICING_FOREIGN_REF,
  SERVICING_HOLD_NOT_BOUND,
  SERVICING_NON_CLAIM_FIELDS,
  SERVICING_NOT_BOUND_REASON,
  SERVICING_NOT_COMPOSED,
  SERVICING_OWN_REF,
  SERVICING_PRODUCER_TUPLE,
  SERVICING_REF_KINDS,
  SERVICING_RULING,
  SERVICING_SCENARIOS,
  SERVICING_STALE_FLOOR,
  SERVICING_SYNTHETIC_CONTROLS,
  SERVICING_TENANT,
  SERVICING_VIEWER_ACTOR,
  assessServicingSnapshot,
  createNotBoundCreditServicing,
  createStubCreditServicing,
  creditServicingPortFor,
  findServicingClaim,
  isServicingAmount,
  isServicingRef,
  refuseServicingReceipt,
  refuseServicingSnapshot,
  servicingAllocatablePayments,
  servicingAdjustableInstallments,
  servicingCapabilities,
  servicingCaseTransitions,
  servicingEligibility,
  servicingRefFor,
  servicingRefKind,
  type ServicingActOutcome,
  type ServicingActionRequest,
  type ServicingReadOutcome,
  type ServicingReceipt,
  type ServicingScenario,
  type ServicingScope,
  type ServicingSnapshot,
  type StubCreditServicing,
} from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

const CTX = "stub|kix|credit-servicing-desk|1";
const OWN: ServicingScope = { tenantId: SERVICING_TENANT, obligationRef: SERVICING_OWN_REF };
const FOREIGN: ServicingScope = { tenantId: SERVICING_TENANT, obligationRef: SERVICING_FOREIGN_REF };

function readRequest(scope: ServicingScope = OWN, actorRef = SERVICING_DESK_ACTOR, watermarkFloor: string | null = null) {
  return { contextKey: CTX, actorRef, scope, watermarkFloor };
}

function actRequest(
  action: ServicingActionRequest,
  scope: ServicingScope = OWN,
  actorRef = SERVICING_DESK_ACTOR,
) {
  return { contextKey: CTX, actorRef, scope, action };
}

async function ready(port: StubCreditServicing, scope: ServicingScope = OWN, actorRef = SERVICING_DESK_ACTOR): Promise<ServicingSnapshot> {
  const outcome = await port.read(readRequest(scope, actorRef));
  if (outcome.kind !== "ready") {
    throw new Error(`expected a ready read, received ${outcome.kind}`);
  }
  return outcome.snapshot;
}

async function applied(
  port: StubCreditServicing,
  action: ServicingActionRequest,
  actorRef = SERVICING_DESK_ACTOR,
): Promise<ServicingReceipt> {
  const outcome = await port.act(actRequest(action, OWN, actorRef));
  if (outcome.kind !== "applied") {
    throw new Error(`expected an applied request, received ${outcome.kind}`);
  }
  return outcome.receipt;
}

function stub(scenario: ServicingScenario = "clean"): StubCreditServicing {
  return createStubCreditServicing({ scenario });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const PROPOSE_ADJUST: ServicingActionRequest = {
  kind: "propose-adjustment",
  installmentRef: "ins-0002",
  adjustmentKind: "note",
  text: "Schedule review note.",
};

describe("identity and amount shapes", () => {
  it("gives each reference kind its own prefix and never reads one kind as another", () => {
    const prefixes = new Set<string>();
    for (const kind of SERVICING_REF_KINDS) {
      const ref = servicingRefFor(kind, 7);
      expect(servicingRefKind(ref)).toBe(kind);
      expect(isServicingRef(ref, kind)).toBe(true);
      prefixes.add(ref.slice(0, 3));
      for (const other of SERVICING_REF_KINDS) {
        if (other !== kind) {
          expect(isServicingRef(ref, other), `${ref} as ${other}`).toBe(false);
        }
      }
    }
    expect(prefixes.size).toBe(SERVICING_REF_KINDS.length);
    expect(servicingRefFor("payment", 12)).toBe("pmt-0012");
    expect(servicingRefFor("proposal", 3)).toBe("prp-0003");
    for (const bad of ["pmt-1", "pmt-00012", "PMT-0001", "pmt-000a", "", "pmt-0001 ", 1, null, undefined]) {
      expect(isServicingRef(bad, "payment"), String(bad)).toBe(false);
    }
  });

  it("accepts only a whole-unit string as an amount", () => {
    for (const good of ["0", "1", "1000", "999999999999"]) {
      expect(isServicingAmount(good), good).toBe(true);
    }
    for (const bad of ["", "01", "-1", "+1", "1.5", "1,000", "1e3", " 1", "1 ", "0x10", "٣", "1234567890123", 1000, null, undefined]) {
      expect(isServicingAmount(bad), String(bad)).toBe(false);
    }
  });
});

describe("what the desk records and keeps locked", () => {
  it("cites the owner ruling and keeps placeHold not-bound with the locked consideredAction", () => {
    expect(SERVICING_RULING).toBe("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
    expect(SERVICING_HOLD_NOT_BOUND).toMatchObject({
      method: "placeHold",
      status: "not-bound",
      consideredAction: "reserve_listing",
      mappedOntoPrepareTrade: false,
    });
    expect(SERVICING_HOLD_NOT_BOUND.consideredAction).toBe(COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction);
    expect(SERVICING_HOLD_NOT_BOUND.reason).toBe(COMMERCE_COMMAND_BINDINGS.placeHold.reason);
  });

  it("records the unsent actions and the ruling, and composes none of them", () => {
    const recorded = SERVICING_NOT_COMPOSED.map((entry) => entry.action);
    for (const entry of JOURNEY_NOT_COMPOSED) {
      expect(recorded).toContain(entry.action);
    }
    expect(recorded).toContain("refund_ticket");
    for (const entry of JOURNEY_NOT_COMPOSED) {
      expect(entry.reason).toContain(SERVICING_RULING.slice(0, 6));
    }
  });

  it("leaves the locked bindings file byte-identical", () => {
    const bytes = readFileSync(path.join(repoRoot, "packages/protocol-adapter/src/commerce-bindings.ts"));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249");
  });

  it("has no producer tuple, so the connection is NOT_BOUND and every digest is null", () => {
    expect(SERVICING_PRODUCER_TUPLE).toMatchObject({
      bound: false,
      status: "NOT_BOUND",
      sdkDigest: null,
      manifestDigest: null,
      vectorDigest: null,
    });
    expect(SERVICING_PRODUCER_TUPLE.waitingOn).toEqual([
      "kix-protocol:cr-08-producer-sdk",
      "c-async-session-fence",
      "c-finance-projection",
      "c-journey-identity",
    ]);
    expect(SERVICING_NOT_BOUND_REASON).toContain("kix-protocol:cr-08-producer-sdk");
    expect(SERVICING_NOT_BOUND_REASON).toContain("NOT_BOUND");
    expect(DISCOVERY_READ_TUPLE_LITERALS.sdkDigest).toBeNull();
  });
});

describe("the draw, the observation, the reservation, and the exposure stay four facts", () => {
  it("opens with an observation, a held reservation, an open exposure, and a monitoring case on two ledger cuts", async () => {
    const snapshot = await ready(stub());
    expect(snapshot.draw).toMatchObject({
      drawRef: "drw-0001",
      instruction: "recorded",
      observation: "observed",
      amountLabel: "1200",
      cutRef: "cut-0001",
    });
    expect(snapshot.reservation).toMatchObject({ reservationRef: "rsv-0001", state: "held" });
    expect(snapshot.exposure).toMatchObject({ exposureRef: "exp-0001", state: "open", amountLabel: "800" });
    expect(snapshot.limit).toMatchObject({ limitRef: "lim-0001", amount: "1500", state: "held" });
    expect(snapshot.schedule.revision).toBe(2);
    expect(snapshot.installments.map((row) => [row.installmentRef, row.state])).toEqual([
      ["ins-0001", "satisfied"],
      ["ins-0002", "due"],
      ["ins-0003", "scheduled"],
    ]);
    expect(snapshot.payments).toEqual([
      expect.objectContaining({ paymentRef: "pmt-0001", amount: "400", state: "allocated", timing: "scheduled-window", unallocatedLabel: "0" }),
    ]);
    expect(snapshot.allocations).toEqual([
      expect.objectContaining({ allocationRef: "alc-0001", paymentRef: "pmt-0001", installmentRef: "ins-0001", amount: "400", state: "applied" }),
    ]);
    expect(snapshot.servicingCase).toMatchObject({ caseRef: "cse-0001", status: "monitoring", closureKind: null, debtLabel: "not-extinguished" });
    expect(snapshot.nonClaims).toEqual({
      instructionIsDisbursement: false,
      observationIsConfirmedFunds: false,
      partialRepaymentRestoresLimit: false,
      reversalErasesHistory: false,
      caseClosureIsDebtExtinguished: false,
      contactMade: false,
      collectionExecuted: false,
      disbursed: false,
    });
    expect(snapshot.cuts.map((cut) => [cut.cutRef, cut.source])).toEqual([
      ["cut-0001", "obligation-ledger"],
      ["cut-0002", "payment-ledger"],
    ]);
    expect(snapshot.payments.every((row) => row.cutRef === "cut-0002")).toBe(true);
    const assessment = assessServicingSnapshot(snapshot);
    expect(assessment).toMatchObject({ cutState: "clean", staleInstallments: [], contradictions: [], unlinked: [] });
    expect(assessment.offeredTransitions).toEqual(["to-recovery"]);
  });

  it("keeps an unknown observation unknown and shows no exposure amount it does not have", async () => {
    const snapshot = await ready(stub("draw-unknown"));
    expect(snapshot.draw).toMatchObject({ instruction: "recorded", observation: "unknown" });
    expect(snapshot.exposure).toMatchObject({ state: "unknown", amountLabel: null });
    expect(snapshot.events.some((event) => event.kind === "observation")).toBe(false);
    expect(assessServicingSnapshot(snapshot).contradictions).toEqual([]);
  });

  it("flags an open exposure with no observed disbursement, and an observation with no instruction", async () => {
    const open = clone(await ready(stub()));
    open.draw!.observation = "not-observed";
    const flagged = assessServicingSnapshot(open);
    expect(flagged.contradictions.map((item) => item.code)).toEqual(["EXPOSURE_WITHOUT_OBSERVATION"]);
    expect(flagged.contradictions[0]?.lane).toBe("exposure");

    const observed = clone(await ready(stub()));
    observed.draw!.instruction = "none";
    expect(assessServicingSnapshot(observed).contradictions.map((item) => item.code)).toEqual(["OBSERVATION_WITHOUT_INSTRUCTION"]);
  });
});

describe("schedule, payments, allocations, reversals, and the case stay linked to one obligation", () => {
  it("shows a partial repayment with its own unallocated remainder and restores no limit", async () => {
    const snapshot = await ready(stub("partial-repayment"));
    expect(snapshot.payments.find((row) => row.paymentRef === "pmt-0002")).toMatchObject({
      amount: "500",
      state: "partial",
      timing: "late",
      unallocatedLabel: "300",
    });
    expect(snapshot.allocations.find((row) => row.allocationRef === "alc-0002")).toMatchObject({
      paymentRef: "pmt-0002",
      installmentRef: "ins-0002",
      amount: "200",
      state: "applied",
    });
    // The limit line is the source's own state, and the partial repayment did not restore it.
    expect(snapshot.limit).toMatchObject({ state: "held", amount: "1500" });
    expect(snapshot.nonClaims.partialRepaymentRestoresLimit).toBe(false);
    expect(snapshot.reasons).toEqual([
      expect.objectContaining({ lane: "payment", code: "UNALLOCATED_PART", remedy: "propose-allocation" }),
    ]);
    expect(servicingAllocatablePayments(snapshot).map((row) => row.paymentRef)).toEqual(["pmt-0002"]);
  });

  it("keeps a reversal and the reversed allocation on the timeline together", async () => {
    const snapshot = await ready(stub("reversal"));
    expect(snapshot.allocations[0]).toMatchObject({ allocationRef: "alc-0001", state: "reversed" });
    expect(snapshot.payments[0]).toMatchObject({ paymentRef: "pmt-0001", state: "reversed", unallocatedLabel: "400" });
    expect(snapshot.reversals).toEqual([
      expect.objectContaining({ reversalRef: "rev-0001", allocationRef: "alc-0001" }),
    ]);
    const kinds = snapshot.events.map((event) => event.kind);
    expect(kinds).toContain("allocation");
    expect(kinds).toContain("reversal");
    expect(snapshot.nonClaims.reversalErasesHistory).toBe(false);
  });

  it("closes a charged-off case as a bookkeeping state that extinguishes no debt", async () => {
    const snapshot = await ready(stub("charged-off"));
    expect(snapshot.servicingCase).toMatchObject({ status: "closed", closureKind: "charged-off", debtLabel: "not-extinguished" });
    expect(snapshot.servicingCase?.history.at(-1)).toMatchObject({ status: "closed", closureKind: "charged-off" });
    expect(snapshot.installments.map((row) => row.state)).toEqual(["satisfied", "charged-off", "charged-off"]);
    expect(snapshot.reservation).toMatchObject({ state: "released" });
    expect(snapshot.limit).toMatchObject({ state: "released" });
    expect(snapshot.nonClaims.caseClosureIsDebtExtinguished).toBe(false);
    expect(assessServicingSnapshot(snapshot).offeredTransitions).toEqual([]);
  });

  it("keeps a post-charge-off payment a fact of its own that reopens nothing", async () => {
    const snapshot = await ready(stub("post-charge-off-payment"));
    expect(snapshot.payments.find((row) => row.paymentRef === "pmt-0002")).toMatchObject({
      state: "late-unallocated",
      timing: "post-charge-off",
      unallocatedLabel: "150",
      amount: "150",
    });
    expect(snapshot.servicingCase).toMatchObject({ status: "closed", closureKind: "charged-off", debtLabel: "not-extinguished" });
    expect(snapshot.reasons).toEqual([
      expect.objectContaining({ lane: "payment", code: "POST_CLOSURE_PAYMENT", remedy: "propose-allocation" }),
    ]);
    const assessment = assessServicingSnapshot(snapshot);
    expect(assessment.offeredTransitions).toEqual([]);
    expect(servicingEligibility(snapshot, assessment, "propose-case-transition").allowed).toBe(false);
  });

  it("marks a delinquent schedule row and a delinquent case with the transitions the source offers", async () => {
    const snapshot = await ready(stub("delinquent"));
    expect(snapshot.installments.find((row) => row.installmentRef === "ins-0002")).toMatchObject({ state: "overdue" });
    expect(snapshot.servicingCase).toMatchObject({ status: "delinquent", closureKind: null });
    expect(snapshot.reasons.map((row) => [row.code, row.remedy])).toEqual([
      ["INSTALLMENT_OVERDUE", "propose-adjustment"],
      ["CASE_DELINQUENT", "propose-case-transition"],
    ]);
    expect(assessServicingSnapshot(snapshot).offeredTransitions).toEqual(["to-recovery", "to-charge-off"]);
  });

  it("flags every schedule row built under an older schedule revision, never as current", async () => {
    const snapshot = await ready(stub("stale-schedule"));
    expect(snapshot.schedule.revision).toBe(3);
    const stale = assessServicingSnapshot(snapshot).staleInstallments;
    expect(stale).toEqual([
      { installmentRef: "ins-0001", planRevision: 2, currentRevision: 3 },
      { installmentRef: "ins-0002", planRevision: 2, currentRevision: 3 },
      { installmentRef: "ins-0003", planRevision: 2, currentRevision: 3 },
    ]);
  });

  it("shows an applied adjustment as its own record and keeps the earlier rows", async () => {
    const snapshot = await ready(stub("adjustment-applied"));
    expect(snapshot.adjustments).toEqual([
      expect.objectContaining({ adjustmentRef: "adj-0001", installmentRef: "ins-0002", kind: "due-label", state: "applied" }),
    ]);
    expect(snapshot.installments.find((row) => row.installmentRef === "ins-0002")).toMatchObject({ state: "adjusted" });
    expect(snapshot.events.some((event) => event.kind === "adjustment")).toBe(true);
  });

  it("flags rows on the wrong ledger's cut and merges nothing", async () => {
    const snapshot = await ready(stub("mixed-cut"));
    const assessment = assessServicingSnapshot(snapshot);
    expect(assessment.cutState).toBe("mixed");
    expect(assessment.usedCuts.map((cut) => cut.cutRef)).toEqual(["cut-0001"]);
    expect(assessment.contradictions.map((item) => item.code)).toEqual([
      "WRONG_LEDGER_CUT",
      "WRONG_LEDGER_CUT",
      "WRONG_LEDGER_CUT",
      "WRONG_LEDGER_CUT",
    ]);
    expect(assessment.contradictions.every((item) => item.lane === "payment")).toBe(true);
    expect(servicingEligibility(snapshot, assessment, "propose-allocation").allowed).toBe(false);
  });

  it("names an allocation whose payment the read does not list and attaches it nowhere", async () => {
    const snapshot = await ready(stub("dangling-link"));
    expect(assessServicingSnapshot(snapshot).unlinked).toEqual([{ lens: "allocations", ref: "alc-0001", missingRef: "pmt-0099" }]);
  });
});

describe("view, proposal, and approval stay three capabilities", () => {
  it("grants read and propose to the desk, read and approve to the approver, and read only to the viewer", () => {
    expect(servicingCapabilities(SERVICING_DESK_ACTOR)).toEqual(["read", "propose"]);
    expect(servicingCapabilities(SERVICING_APPROVER_ACTOR)).toEqual(["read", "approve"]);
    expect(servicingCapabilities(SERVICING_VIEWER_ACTOR)).toEqual(["read"]);
    expect(servicingCapabilities("some-other-actor")).toEqual([]);
  });

  it("rejects a proposal from an actor with no propose capability, and an approval from one with no approve", async () => {
    const viewer = stub("unallocated");
    expect(
      await viewer.act(actRequest({ kind: "propose-allocation", paymentRef: "pmt-0003", installmentRef: "ins-0002" }, OWN, SERVICING_VIEWER_ACTOR)),
    ).toMatchObject({ kind: "rejected", code: "NO_CAPABILITY" });
    const desk = stub("proposal-pending");
    expect(await desk.act(actRequest({ kind: "approve-proposal", proposalRef: "prp-0001" }))).toMatchObject({
      kind: "rejected",
      code: "NO_CAPABILITY",
    });
    const viewerApprove = stub("proposal-pending");
    expect(
      await viewerApprove.act(actRequest({ kind: "approve-proposal", proposalRef: "prp-0001" }, OWN, SERVICING_VIEWER_ACTOR)),
    ).toMatchObject({ kind: "rejected", code: "NO_CAPABILITY" });
  });

  it("refuses an actor approving its own proposal even when it holds the approval capability", async () => {
    const port = stub("self-approval");
    const snapshot = await ready(port, OWN, SERVICING_APPROVER_ACTOR);
    expect(snapshot.proposals[0]).toMatchObject({ actorRef: SERVICING_APPROVER_ACTOR, state: "pending" });
    expect(
      await port.act(actRequest({ kind: "approve-proposal", proposalRef: "prp-0001" }, OWN, SERVICING_APPROVER_ACTOR)),
    ).toMatchObject({ kind: "rejected", code: "SELF_APPROVAL" });
    expect((await ready(port, OWN, SERVICING_APPROVER_ACTOR)).proposals[0]).toMatchObject({ state: "pending" });
  });

  it("records a proposal and applies it only after a different actor approves it", async () => {
    const port = stub("unallocated");
    const receipt = await applied(port, { kind: "propose-allocation", paymentRef: "pmt-0003", installmentRef: "ins-0002" });
    expect(receipt).toMatchObject({ kind: "propose-allocation", proposalRef: "prp-0002", stateAfter: "proposal-recorded" });
    let snapshot = await ready(port);
    expect(snapshot.proposals[0]).toMatchObject({
      proposalRef: "prp-0002",
      kind: "allocation",
      actorRef: SERVICING_DESK_ACTOR,
      state: "pending",
      targetRef: "pmt-0003",
      installmentRef: "ins-0002",
    });
    // A recorded proposal applied nothing: the payment is still unallocated.
    expect(snapshot.payments.find((row) => row.paymentRef === "pmt-0003")).toMatchObject({ state: "unallocated" });

    const approval = await applied(port, { kind: "approve-proposal", proposalRef: "prp-0002" }, SERVICING_APPROVER_ACTOR);
    expect(approval).toMatchObject({ kind: "approve-proposal", proposalRef: "prp-0002", stateAfter: "applied" });
    snapshot = await ready(port);
    expect(snapshot.proposals[0]).toMatchObject({ state: "applied" });
    expect(snapshot.allocations.find((row) => row.allocationRef === "alc-0003")).toMatchObject({
      paymentRef: "pmt-0003",
      installmentRef: "ins-0002",
      amount: "300",
      state: "applied",
    });
    expect(snapshot.payments.find((row) => row.paymentRef === "pmt-0003")).toMatchObject({ state: "allocated", unallocatedLabel: "0" });
    expect(snapshot.installments.find((row) => row.installmentRef === "ins-0002")).toMatchObject({ state: "satisfied" });
  });

  it("applies a seeded pending proposal and closes the case charged-off on approval, extinguishing nothing", async () => {
    const port = stub("delinquent");
    const proposal = await applied(port, { kind: "propose-case-transition", transition: "to-charge-off" });
    expect(proposal).toMatchObject({ kind: "propose-case-transition", proposalRef: "prp-0002", stateAfter: "proposal-recorded" });
    expect((await ready(port)).servicingCase).toMatchObject({ status: "delinquent" });
    const approval = await applied(port, { kind: "approve-proposal", proposalRef: "prp-0002" }, SERVICING_APPROVER_ACTOR);
    expect(approval.stateAfter).toBe("applied");
    const snapshot = await ready(port);
    expect(snapshot.servicingCase).toMatchObject({ status: "closed", closureKind: "charged-off", debtLabel: "not-extinguished" });
    expect(snapshot.reservation).toMatchObject({ state: "released" });
    expect(snapshot.limit).toMatchObject({ state: "released" });
    expect(snapshot.installments.map((row) => row.state)).toEqual(["satisfied", "charged-off", "charged-off"]);
    expect(snapshot.events.map((event) => event.kind)).toEqual(
      expect.arrayContaining(["proposal", "approval", "case"]),
    );
  });

  it("refuses an approval of an unknown or non-pending proposal, and of a closed case transition", async () => {
    const port = stub("proposal-pending");
    expect(await port.act(actRequest({ kind: "approve-proposal", proposalRef: "prp-0099" }, OWN, SERVICING_APPROVER_ACTOR))).toMatchObject({
      kind: "rejected",
      code: "NO_PROPOSAL",
    });
    await applied(port, { kind: "approve-proposal", proposalRef: "prp-0001" }, SERVICING_APPROVER_ACTOR);
    expect(await port.act(actRequest({ kind: "approve-proposal", proposalRef: "prp-0001" }, OWN, SERVICING_APPROVER_ACTOR))).toMatchObject({
      kind: "rejected",
      code: "PROPOSAL_STATE",
    });
    const closed = stub("charged-off");
    expect(await closed.act(actRequest({ kind: "propose-case-transition", transition: "to-recovery" }))).toMatchObject({
      kind: "rejected",
      code: "CASE_STATE",
    });
    const monitoring = stub();
    expect(await monitoring.act(actRequest({ kind: "propose-case-transition", transition: "to-closed" }))).toMatchObject({
      kind: "rejected",
      code: "CASE_STATE",
    });
  });

  it("refuses an approval answer that claims the closure extinguished the debt", async () => {
    const port = stub("approve-claims-closure");
    const outcome = await port.act(actRequest({ kind: "approve-proposal", proposalRef: "prp-0001" }, OWN, SERVICING_APPROVER_ACTOR));
    expect(outcome).toMatchObject({ kind: "refused", code: "CLAIM", field: "caseClosureIsDebtExtinguished" });
    // The request took effect; the answer is what cannot be trusted.
    const snapshot = await ready(port);
    expect(snapshot.proposals[0]).toMatchObject({ state: "applied" });
    expect(snapshot.nonClaims.caseClosureIsDebtExtinguished).toBe(false);
  });
});

describe("requests the source cannot honour", () => {
  it("rejects each proposal target the source does not list or cannot take, with its own code", async () => {
    const port = stub();
    expect(await port.act(actRequest({ kind: "propose-allocation", paymentRef: "x", installmentRef: "ins-0002" }))).toMatchObject({
      kind: "invalid-request",
      code: "REF",
    });
    expect(await port.act(actRequest({ kind: "propose-allocation", paymentRef: "pmt-0099", installmentRef: "ins-0002" }))).toMatchObject({
      kind: "rejected",
      code: "NO_PAYMENT",
    });
    expect(await port.act(actRequest({ kind: "propose-allocation", paymentRef: "pmt-0001", installmentRef: "ins-0002" }))).toMatchObject({
      kind: "rejected",
      code: "PAYMENT_STATE",
    });
    const unallocated = stub("unallocated");
    expect(await unallocated.act(actRequest({ kind: "propose-allocation", paymentRef: "pmt-0003", installmentRef: "ins-0099" }))).toMatchObject({
      kind: "rejected",
      code: "NO_INSTALLMENT",
    });
    expect(await unallocated.act(actRequest({ kind: "propose-allocation", paymentRef: "pmt-0003", installmentRef: "ins-0001" }))).toMatchObject({
      kind: "rejected",
      code: "INSTALLMENT_STATE",
    });
  });

  it("validates an adjustment proposal's row, kind, and note before it is recorded", async () => {
    const port = stub();
    expect(await port.act(actRequest({ kind: "propose-adjustment", installmentRef: "x", adjustmentKind: "note", text: "n" }))).toMatchObject({
      kind: "invalid-request",
      code: "REF",
    });
    expect(
      await port.act(
        actRequest({ kind: "propose-adjustment", installmentRef: "ins-0002", adjustmentKind: "x" as "note", text: "n" }),
      ),
    ).toMatchObject({ kind: "invalid-request", code: "ACTION" });
    expect(await port.act(actRequest({ kind: "propose-adjustment", installmentRef: "ins-0002", adjustmentKind: "note", text: "" }))).toMatchObject({
      kind: "invalid-request",
      code: "TEXT",
    });
    expect(
      await port.act(actRequest({ kind: "propose-adjustment", installmentRef: "ins-0002", adjustmentKind: "note", text: "n".repeat(121) })),
    ).toMatchObject({ kind: "invalid-request", code: "TEXT" });
    expect(await port.act(actRequest({ kind: "propose-adjustment", installmentRef: "ins-0099", adjustmentKind: "note", text: "n" }))).toMatchObject({
      kind: "rejected",
      code: "NO_INSTALLMENT",
    });
    expect(await port.act(actRequest({ kind: "propose-adjustment", installmentRef: "ins-0001", adjustmentKind: "note", text: "n" }))).toMatchObject({
      kind: "rejected",
      code: "INSTALLMENT_STATE",
    });
    expect(await port.act(actRequest({ kind: "collect" } as unknown as ServicingActionRequest))).toMatchObject({
      kind: "invalid-request",
      code: "ACTION",
    });
    expect(await port.act(actRequest({ kind: "approve-proposal", proposalRef: "x" }, OWN, SERVICING_APPROVER_ACTOR))).toMatchObject({
      kind: "invalid-request",
      code: "REF",
    });
  });

  it("records an adjustment proposal and applies it on approval without erasing the earlier row", async () => {
    const port = stub();
    const receipt = await applied(port, PROPOSE_ADJUST);
    expect(receipt).toMatchObject({ kind: "propose-adjustment", proposalRef: "prp-0002", stateAfter: "proposal-recorded" });
    await applied(port, { kind: "approve-proposal", proposalRef: "prp-0002" }, SERVICING_APPROVER_ACTOR);
    const snapshot = await ready(port);
    expect(snapshot.adjustments.find((row) => row.adjustmentRef === "adj-0002")).toMatchObject({
      installmentRef: "ins-0002",
      kind: "note",
      state: "applied",
    });
    expect(snapshot.installments.find((row) => row.installmentRef === "ins-0002")).toMatchObject({ state: "adjusted" });
    expect(snapshot.installments.find((row) => row.installmentRef === "ins-0001")).toMatchObject({ state: "satisfied" });
  });
});

describe("outcomes the desk will not trust", () => {
  it("refuses a read that claims a restored limit, an extinguished debt, or a contact", async () => {
    expect(await stub("claims-restored").read(readRequest())).toMatchObject({ kind: "refused", code: "CLAIM", field: "partialRepaymentRestoresLimit" });
    expect(await stub("claims-extinguished").read(readRequest())).toMatchObject({ kind: "refused", code: "CLAIM", field: "caseClosureIsDebtExtinguished" });
    expect(await stub("claims-contact").read(readRequest())).toMatchObject({ kind: "refused", code: "CLAIM", field: "contactMade" });
  });

  it("refuses a row that belongs to another obligation", async () => {
    expect(await stub("scope-leak").read(readRequest())).toMatchObject({ kind: "refused", code: "SCOPE_LEAK", ref: "pmt-0009" });
  });

  it("loses the answer to a request that took effect, and says nothing about the effect", async () => {
    const port = stub("act-lost");
    await expect(port.act(actRequest(PROPOSE_ADJUST))).rejects.toThrow("never arrived");
    expect(port.effects()).toMatchObject({ acts: 1 });
    const snapshot = await ready(port);
    expect(snapshot.proposals[0]).toMatchObject({ kind: "adjustment", state: "pending", actorRef: SERVICING_DESK_ACTOR });
  });
});

describe("read outcomes", () => {
  it("answers empty, stale, denied, and lost reads as their own outcomes", async () => {
    expect(await stub("empty").read(readRequest())).toMatchObject({ kind: "empty", scope: OWN });
    expect(await stub("stale").read(readRequest())).toMatchObject({ kind: "stale", floor: SERVICING_STALE_FLOOR });
    expect(await stub("denied").read(readRequest())).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
    await expect(stub("read-lost").read(readRequest())).rejects.toThrow("never arrived");
    const clean = stub();
    expect(await clean.read(readRequest(OWN, SERVICING_DESK_ACTOR, "2026-10-14T00:00:00.000Z"))).toMatchObject({ kind: "stale" });
    expect(await clean.read(readRequest(OWN, SERVICING_DESK_ACTOR, "2026-10-01T00:00:00.000Z"))).toMatchObject({ kind: "ready" });
  });

  it("denies a scope the actor holds no grant for, and a withdrawn grant, and returns no row", async () => {
    expect(await stub().read(readRequest(FOREIGN))).toMatchObject({ kind: "denied", code: "SCOPE_DENIED", obligationRef: SERVICING_FOREIGN_REF });
    expect(await stub().read(readRequest(OWN, "some-other-actor"))).toMatchObject({ kind: "denied", code: "SCOPE_DENIED" });
    const port = stub();
    expect(port.synthetic("revoke-grant")).toBe(true);
    expect(await port.read(readRequest())).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
    expect(await port.act(actRequest(PROPOSE_ADJUST))).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
  });

  it("refuses a malformed request before it reads or acts", async () => {
    const port = stub();
    expect(await port.read({ ...readRequest(), contextKey: " " })).toMatchObject({ kind: "invalid-request", code: "CONTEXT" });
    expect(await port.read({ ...readRequest(), actorRef: "" })).toMatchObject({ kind: "invalid-request", code: "ACTOR" });
    expect(await port.read({ ...readRequest(), scope: { tenantId: "other", obligationRef: SERVICING_OWN_REF } })).toMatchObject({
      kind: "invalid-request",
      code: "SCOPE",
    });
    expect(await port.read({ ...readRequest(), scope: { tenantId: SERVICING_TENANT, obligationRef: "cse-0001" } })).toMatchObject({
      kind: "invalid-request",
      code: "SCOPE",
    });
    expect(await port.read(readRequest(OWN, SERVICING_DESK_ACTOR, "not an instant"))).toMatchObject({ kind: "invalid-request", code: "FLOOR" });
    expect(await port.act({ ...actRequest(PROPOSE_ADJUST), contextKey: "" })).toMatchObject({ kind: "invalid-request", code: "CONTEXT" });
  });

  it("stops on a changed pin tuple before it reads or acts", async () => {
    const changed = createStubCreditServicing({ expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, protocolMergeSha: "0".repeat(40) } });
    expect(await changed.read(readRequest())).toMatchObject({ kind: "tuple-changed", field: "protocolMergeSha" });
    expect(await changed.act(actRequest(PROPOSE_ADJUST))).toMatchObject({ kind: "tuple-changed", field: "protocolMergeSha" });
    const sdk = createStubCreditServicing({ expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, sdkDigest: "sha256:x" as unknown as null } });
    expect(await sdk.read(readRequest())).toMatchObject({ kind: "tuple-changed", field: "sdkTuple" });
  });

  it("is NOT_BOUND on integration-http for a read and a request, with no stub switch", async () => {
    const port = creditServicingPortFor("integration-http");
    expect(port).toMatchObject({ environment: "integration-http", source: "none" });
    expect(await port.read(readRequest())).toEqual({ kind: "not-bound", reason: SERVICING_NOT_BOUND_REASON });
    expect(await port.act(actRequest(PROPOSE_ADJUST))).toEqual({ kind: "not-bound", reason: SERVICING_NOT_BOUND_REASON });
    for (const control of SERVICING_SYNTHETIC_CONTROLS) {
      expect(port.synthetic(control), control).toBe(false);
    }
    expect(createNotBoundCreditServicing().scenario).toBe("clean");
    expect(creditServicingPortFor("stub").source).toBe("synthetic-servicing");
  });
});

describe("refusal checks on a payload", () => {
  async function base(): Promise<ServicingSnapshot> {
    return clone(await ready(stub("post-charge-off-payment")));
  }

  it("accepts a whole post-charge-off payload", async () => {
    expect(refuseServicingSnapshot(await base())).toBeNull();
  });

  it("refuses each non-claim field that is true or missing", async () => {
    for (const field of SERVICING_NON_CLAIM_FIELDS) {
      const snapshot = await base();
      (snapshot.nonClaims as unknown as Record<string, unknown>)[field] = true;
      expect(refuseServicingSnapshot(snapshot), field).toMatchObject({ code: "CLAIM", field });
      const silent = await base();
      delete (silent.nonClaims as unknown as Record<string, unknown>)[field];
      expect(refuseServicingSnapshot(silent), `${field} missing`).toMatchObject({ code: "CLAIM", field });
      expect(findServicingClaim({ ...snapshot.nonClaims })).toBe(field);
    }
    expect(findServicingClaim(null)).toBe("instructionIsDisbursement");
    expect(findServicingClaim(undefined)).toBe("instructionIsDisbursement");
  });

  it("refuses a malformed reference, state, kind, amount, unit, cut, or scope", async () => {
    const cases: [string, (s: ServicingSnapshot) => void, string][] = [
      ["draw ref", (s) => { s.draw!.drawRef = "pmt-0001"; }, "REF"],
      ["reservation ref", (s) => { s.reservation!.reservationRef = "rsv-99"; }, "REF"],
      ["exposure ref", (s) => { s.exposure!.exposureRef = "lim-0001"; }, "REF"],
      ["limit ref", (s) => { s.limit!.limitRef = "exp-0001"; }, "REF"],
      ["installment ref", (s) => { s.installments[0]!.installmentRef = "pmt-0001"; }, "REF"],
      ["payment ref", (s) => { s.payments[0]!.paymentRef = "ins-0001"; }, "REF"],
      ["allocation ref", (s) => { s.allocations[0]!.allocationRef = "rev-0001"; }, "REF"],
      ["allocation payment ref", (s) => { s.allocations[0]!.paymentRef = "alc-0002"; }, "REF"],
      ["reversal ref", (s) => { s.reversals = [{ reversalRef: "pmt-0001", allocationRef: "alc-0001", label: "l", obligationRef: SERVICING_OWN_REF, cutRef: "cut-0002" }]; }, "REF"],
      ["adjustment ref", (s) => { s.adjustments = [{ adjustmentRef: "x", installmentRef: "ins-0001", kind: "note", state: "applied", text: "t", obligationRef: SERVICING_OWN_REF, cutRef: "cut-0001" }]; }, "REF"],
      ["proposal ref", (s) => { s.proposals = [{ proposalRef: "x", kind: "allocation", actorRef: SERVICING_DESK_ACTOR, state: "pending", targetRef: null, installmentRef: null, transition: null, text: "t", obligationRef: SERVICING_OWN_REF, cutRef: "cut-0001" }]; }, "REF"],
      ["case ref", (s) => { s.servicingCase!.caseRef = "obl-0001"; }, "REF"],
      ["event ref", (s) => { s.events[0]!.eventRef = "pmt-0001"; }, "REF"],
      ["reason ref", (s) => { s.reasons = [{ reasonRef: "x", lane: "payment", code: "C", text: "t", remedy: "none" }]; }, "REF"],
      ["cut ref", (s) => { s.cuts[0]!.cutRef = "obl-0001"; }, "REF"],
      ["instruction state", (s) => { (s.draw as { instruction: string }).instruction = "sent"; }, "STATE"],
      ["observation state", (s) => { (s.draw as { observation: string }).observation = "confirmed"; }, "STATE"],
      ["reservation state", (s) => { (s.reservation as { state: string }).state = "used"; }, "STATE"],
      ["exposure state", (s) => { (s.exposure as { state: string }).state = "paid"; }, "STATE"],
      ["limit state", (s) => { (s.limit as { state: string }).state = "restored"; }, "STATE"],
      ["installment state", (s) => { (s.installments[0] as { state: string }).state = "paid"; }, "STATE"],
      ["installment revision", (s) => { s.installments[0]!.planRevision = 0; }, "STATE"],
      ["payment state", (s) => { (s.payments[0] as { state: string }).state = "settled"; }, "STATE"],
      ["allocation state", (s) => { (s.allocations[0] as { state: string }).state = "confirmed"; }, "STATE"],
      ["proposal state", (s) => { s.proposals = [{ proposalRef: "prp-0009", kind: "allocation", actorRef: SERVICING_DESK_ACTOR, state: "live" as "pending", targetRef: null, installmentRef: null, transition: null, text: "t", obligationRef: SERVICING_OWN_REF, cutRef: "cut-0001" }]; }, "STATE"],
      ["case status", (s) => { (s.servicingCase as { status: string }).status = "resolved"; }, "STATE"],
      ["history status", (s) => { (s.servicingCase!.history[0] as { status: string }).status = "done"; }, "STATE"],
      ["event sequence", (s) => { s.events[1]!.seq = 1; }, "STATE"],
      ["payment timing", (s) => { (s.payments[0] as { timing: string }).timing = "early"; }, "KIND"],
      ["adjustment kind", (s) => { s.adjustments = [{ adjustmentRef: "adj-0009", installmentRef: "ins-0001", kind: "waiver" as "note", state: "applied", text: "t", obligationRef: SERVICING_OWN_REF, cutRef: "cut-0001" }]; }, "KIND"],
      ["proposal kind", (s) => { s.proposals = [{ proposalRef: "prp-0009", kind: "forgive" as "allocation", actorRef: SERVICING_DESK_ACTOR, state: "pending", targetRef: null, installmentRef: null, transition: null, text: "t", obligationRef: SERVICING_OWN_REF, cutRef: "cut-0001" }]; }, "KIND"],
      ["proposal transition", (s) => { s.proposals = [{ proposalRef: "prp-0009", kind: "case-transition", actorRef: SERVICING_DESK_ACTOR, state: "pending", targetRef: null, installmentRef: null, transition: "to-forgiven" as "to-closed", text: "t", obligationRef: SERVICING_OWN_REF, cutRef: "cut-0001" }]; }, "KIND"],
      ["case closure", (s) => { (s.servicingCase as { closureKind: string | null }).closureKind = "forgiven"; }, "KIND"],
      ["history closure", (s) => { (s.servicingCase!.history[0] as { closureKind: string | null }).closureKind = "forgiven"; }, "KIND"],
      ["cut source", (s) => { (s.cuts[0] as { source: string }).source = "bank"; }, "KIND"],
      ["event kind", (s) => { (s.events[0] as { kind: string }).kind = "collection"; }, "KIND"],
      ["reason lane", (s) => { s.reasons = [{ reasonRef: "rsn-0001", lane: "collection" as "payment", code: "C", text: "t", remedy: "none" }]; }, "KIND"],
      ["reason remedy", (s) => { s.reasons = [{ reasonRef: "rsn-0001", lane: "payment", code: "C", text: "t", remedy: "call" as "none" }]; }, "KIND"],
      ["draw amount", (s) => { s.draw!.amountLabel = "12.5"; }, "AMOUNT"],
      ["exposure amount", (s) => { s.exposure!.amountLabel = "-1"; }, "AMOUNT"],
      ["limit amount", (s) => { s.limit!.amount = "1e3"; }, "AMOUNT"],
      ["installment amount", (s) => { s.installments[0]!.amount = "4.5"; }, "AMOUNT"],
      ["payment amount", (s) => { s.payments[0]!.amount = "0x10"; }, "AMOUNT"],
      ["unallocated label", (s) => { s.payments[0]!.unallocatedLabel = "3 0"; }, "AMOUNT"],
      ["allocation amount", (s) => { s.allocations[0]!.amount = "01"; }, "AMOUNT"],
      ["draw unit", (s) => { (s.draw as { unit: string }).unit = "USD"; }, "UNIT"],
      ["payment unit", (s) => { (s.payments[0] as { unit: string }).unit = "KRW"; }, "UNIT"],
      ["snapshot unit", (s) => { (s as { unit: string }).unit = "EUR"; }, "UNIT"],
      ["row cut", (s) => { s.payments[0]!.cutRef = "cut-0099"; }, "CUT"],
      ["payment scope", (s) => { s.payments[0]!.obligationRef = SERVICING_FOREIGN_REF; }, "SCOPE_LEAK"],
      ["case scope", (s) => { s.servicingCase!.obligationRef = SERVICING_FOREIGN_REF; }, "SCOPE_LEAK"],
      ["debt label", (s) => { (s.servicingCase as { debtLabel: string }).debtLabel = "extinguished"; }, "CLAIM"],
    ];
    for (const [label, mutate, code] of cases) {
      const snapshot = await base();
      mutate(snapshot);
      expect(refuseServicingSnapshot(snapshot), label).toMatchObject({ kind: "refused", code });
    }
  });

  it("refuses a receipt that overstates what a request did", () => {
    const request: ServicingActionRequest = { kind: "propose-allocation", paymentRef: "pmt-0003", installmentRef: "ins-0002" };
    const approval: ServicingActionRequest = { kind: "approve-proposal", proposalRef: "prp-0001" };
    const receipt: ServicingReceipt = {
      kind: "propose-allocation",
      obligationRef: "obl-0001",
      proposalRef: "prp-0002",
      stateAfter: "proposal-recorded",
      nonClaims: {
        instructionIsDisbursement: false,
        observationIsConfirmedFunds: false,
        partialRepaymentRestoresLimit: false,
        reversalErasesHistory: false,
        caseClosureIsDebtExtinguished: false,
        contactMade: false,
        collectionExecuted: false,
        disbursed: false,
      },
    };
    expect(refuseServicingReceipt(receipt, request)).toBeNull();
    expect(refuseServicingReceipt({ ...receipt, kind: "approve-proposal", stateAfter: "applied" }, approval)).toBeNull();
    expect(refuseServicingReceipt({ ...receipt, stateAfter: "applied" }, request)).toMatchObject({ code: "CLAIM", field: "stateAfter" });
    expect(refuseServicingReceipt({ ...receipt, kind: "approve-proposal", stateAfter: "applied" }, request)).toMatchObject({ code: "CLAIM" });
    expect(refuseServicingReceipt({ ...receipt, kind: "approve-proposal", stateAfter: "proposal-recorded" }, approval)).toMatchObject({
      code: "CLAIM",
      field: "stateAfter",
    });
    expect(refuseServicingReceipt({ ...receipt, proposalRef: "pmt-0001" }, request)).toMatchObject({ code: "REF" });
    expect(refuseServicingReceipt({ ...receipt, obligationRef: "prp-0001" }, request)).toMatchObject({ code: "REF" });
    expect(
      refuseServicingReceipt(
        { ...receipt, nonClaims: { ...receipt.nonClaims, caseClosureIsDebtExtinguished: true } as unknown as ServicingReceipt["nonClaims"] },
        request,
      ),
    ).toMatchObject({ code: "CLAIM", field: "caseClosureIsDebtExtinguished" });
  });
});

describe("eligibility", () => {
  it("offers each action only where the read supports it", async () => {
    const eligible = async (scenario: ServicingScenario, kind: (typeof SERVICING_ACTION_KINDS)[number]) => {
      const snapshot = await ready(stub(scenario));
      return servicingEligibility(snapshot, assessServicingSnapshot(snapshot), kind);
    };
    expect((await eligible("clean", "propose-allocation")).allowed).toBe(false);
    expect((await eligible("unallocated", "propose-allocation")).allowed).toBe(true);
    expect((await eligible("partial-repayment", "propose-allocation")).allowed).toBe(true);
    expect((await eligible("post-charge-off-payment", "propose-allocation")).reason).toContain("no open schedule row");
    expect((await eligible("mixed-cut", "propose-allocation")).reason).toContain("ledgers are not merged");
    expect((await eligible("clean", "propose-adjustment")).allowed).toBe(true);
    expect((await eligible("charged-off", "propose-adjustment")).allowed).toBe(false);
    expect((await eligible("clean", "propose-case-transition")).allowed).toBe(true);
    expect((await eligible("delinquent", "propose-case-transition")).allowed).toBe(true);
    expect((await eligible("charged-off", "propose-case-transition")).allowed).toBe(false);
    expect((await eligible("proposal-pending", "approve-proposal")).allowed).toBe(true);
    expect((await eligible("clean", "approve-proposal")).allowed).toBe(false);
  });

  it("lists the transitions the source offers from each case status", async () => {
    expect(servicingCaseTransitions("monitoring")).toEqual(["to-recovery"]);
    expect(servicingCaseTransitions("delinquent")).toEqual(["to-recovery", "to-charge-off"]);
    expect(servicingCaseTransitions("recovery")).toEqual(["to-charge-off", "to-closed"]);
    expect(servicingCaseTransitions("closed")).toEqual([]);
    const snapshot = await ready(stub());
    expect(servicingAdjustableInstallments(snapshot).map((row) => row.installmentRef)).toEqual(["ins-0002", "ins-0003"]);
  });
});

describe("synthetic controls", () => {
  it("names six controls and moves the source only where there is something to move", async () => {
    expect([...SERVICING_SYNTHETIC_CONTROLS]).toEqual([
      "observe-draw",
      "receive-payment",
      "reverse-allocation",
      "mark-overdue",
      "advance-schedule",
      "revoke-grant",
    ]);
    const clean = stub();
    expect(clean.synthetic("observe-draw")).toBe(false);
    const unknown = stub("draw-unknown");
    expect(unknown.synthetic("observe-draw")).toBe(true);
    const after = await ready(unknown);
    expect(after.draw).toMatchObject({ observation: "observed" });
    expect(after.exposure).toMatchObject({ state: "open", amountLabel: "800" });
  });

  it("observes a payment after the case closed without reopening it", async () => {
    const port = stub("charged-off");
    expect(port.synthetic("receive-payment")).toBe(true);
    const snapshot = await ready(port);
    expect(snapshot.payments.find((row) => row.paymentRef === "pmt-0004")).toMatchObject({
      state: "late-unallocated",
      timing: "post-charge-off",
      unallocatedLabel: "150",
    });
    expect(snapshot.servicingCase).toMatchObject({ status: "closed", closureKind: "charged-off" });
    const open = stub();
    expect(open.synthetic("receive-payment")).toBe(true);
    expect((await ready(open)).payments.find((row) => row.paymentRef === "pmt-0004")).toMatchObject({
      state: "unallocated",
      timing: "late",
    });
  });

  it("reverses an applied allocation and marks a schedule row overdue, keeping both events", async () => {
    const port = stub();
    expect(port.synthetic("reverse-allocation")).toBe(true);
    let snapshot = await ready(port);
    expect(snapshot.reversals[0]).toMatchObject({ reversalRef: "rev-0002", allocationRef: "alc-0001" });
    expect(snapshot.allocations[0]).toMatchObject({ state: "reversed" });
    expect(snapshot.payments[0]).toMatchObject({ state: "reversed" });
    expect(port.synthetic("reverse-allocation")).toBe(false);
    expect(port.synthetic("mark-overdue")).toBe(true);
    snapshot = await ready(port);
    expect(snapshot.installments.find((row) => row.installmentRef === "ins-0002")).toMatchObject({ state: "overdue" });
    expect(snapshot.servicingCase).toMatchObject({ status: "delinquent" });
    expect(snapshot.events.map((event) => event.kind)).toEqual(expect.arrayContaining(["reversal", "case"]));
  });

  it("moves the schedule revision so rows built under an older one stay flagged", async () => {
    const port = stub();
    expect(port.synthetic("advance-schedule")).toBe(true);
    const snapshot = await ready(port);
    expect(snapshot.schedule.revision).toBe(3);
    expect(assessServicingSnapshot(snapshot).staleInstallments).toHaveLength(3);
  });
});

describe("every scenario", () => {
  it("returns a defined outcome for a read and for each action, and a read never writes", async () => {
    expect(new Set(SERVICING_SCENARIOS).size).toBe(SERVICING_SCENARIOS.length);
    for (const scenario of SERVICING_SCENARIOS) {
      const port = stub(scenario);
      let read: ServicingReadOutcome | "rejected";
      try {
        read = await port.read(readRequest());
      } catch {
        read = "rejected";
      }
      expect(read, scenario).toBeDefined();
      expect(port.effects(), scenario).toEqual({ reads: 1, acts: 0 });
      let act: ServicingActOutcome | "rejected";
      try {
        act = await port.act(actRequest({ kind: "propose-case-transition", transition: "to-recovery" }));
      } catch {
        act = "rejected";
      }
      expect(act, scenario).toBeDefined();
      expect(port.effects(), scenario).toEqual({ reads: 1, acts: 1 });
    }
  });
});

describe("source", () => {
  const files = ["credit-servicing.ts", "credit-servicing-controller.ts"].map((name) =>
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
    expect(combined).not.toMatch(/action:\s*"(capture|settle_capture|commit_trade|admit|refund_ticket|open_admission|prepare_trade|accept_trade|create_event)"/);
  });
});
