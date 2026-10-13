import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  DISCOVERY_READ_TUPLE_LITERALS,
  JOURNEY_NOT_COMPOSED,
  ORIGINATION_ACTION_KINDS,
  ORIGINATION_DESK_ACTOR,
  ORIGINATION_FOREIGN_REF,
  ORIGINATION_HOLD_NOT_BOUND,
  ORIGINATION_NON_CLAIM_FIELDS,
  ORIGINATION_NOT_BOUND_REASON,
  ORIGINATION_NOT_COMPOSED,
  ORIGINATION_OWN_REF,
  ORIGINATION_PRODUCER_TUPLE,
  ORIGINATION_REF_KINDS,
  ORIGINATION_RULING,
  ORIGINATION_SCENARIOS,
  ORIGINATION_STALE_FLOOR,
  ORIGINATION_SYNTHETIC_CONTROLS,
  ORIGINATION_TENANT,
  assessOriginationSnapshot,
  createNotBoundCreditOrigination,
  createStubCreditOrigination,
  creditOriginationPortFor,
  findOriginationClaim,
  isOriginationAmount,
  isOriginationRef,
  originationEligibility,
  originationRefFor,
  originationRefKind,
  refuseOriginationReceipt,
  refuseOriginationSnapshot,
  type OriginationActOutcome,
  type OriginationActionRequest,
  type OriginationReadOutcome,
  type OriginationReceipt,
  type OriginationScenario,
  type OriginationScope,
  type OriginationSnapshot,
  type StubCreditOrigination,
} from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

const CTX = "stub|kix|credit-origination-desk|1";
const OWN: OriginationScope = { tenantId: ORIGINATION_TENANT, applicantRef: ORIGINATION_OWN_REF };
const FOREIGN: OriginationScope = { tenantId: ORIGINATION_TENANT, applicantRef: ORIGINATION_FOREIGN_REF };

function readRequest(scope: OriginationScope = OWN, actorRef = ORIGINATION_DESK_ACTOR, watermarkFloor: string | null = null) {
  return { contextKey: CTX, actorRef, scope, watermarkFloor };
}

function actRequest(action: OriginationActionRequest, scope: OriginationScope = OWN, actorRef = ORIGINATION_DESK_ACTOR) {
  return { contextKey: CTX, actorRef, scope, action };
}

async function ready(port: StubCreditOrigination, scope: OriginationScope = OWN): Promise<OriginationSnapshot> {
  const outcome = await port.read(readRequest(scope));
  if (outcome.kind !== "ready") {
    throw new Error(`expected a ready read, received ${outcome.kind}`);
  }
  return outcome.snapshot;
}

async function applied(port: StubCreditOrigination, action: OriginationActionRequest): Promise<OriginationReceipt> {
  const outcome = await port.act(actRequest(action));
  if (outcome.kind !== "applied") {
    throw new Error(`expected an applied request, received ${outcome.kind}`);
  }
  return outcome.receipt;
}

function stub(scenario: OriginationScenario = "clean"): StubCreditOrigination {
  return createStubCreditOrigination({ scenario });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const SUBMIT: OriginationActionRequest = { kind: "submit", requestedAmount: "1000", claimRefs: ["clm-0001", "clm-0002"] };

describe("identity and amount shapes", () => {
  it("gives each reference kind its own prefix and never reads one kind as another", () => {
    const prefixes = new Set<string>();
    for (const kind of ORIGINATION_REF_KINDS) {
      const ref = originationRefFor(kind, 7);
      expect(originationRefKind(ref)).toBe(kind);
      expect(isOriginationRef(ref, kind)).toBe(true);
      prefixes.add(ref.slice(0, 3));
      for (const other of ORIGINATION_REF_KINDS) {
        if (other !== kind) {
          expect(isOriginationRef(ref, other), `${ref} as ${other}`).toBe(false);
        }
      }
    }
    expect(prefixes.size).toBe(ORIGINATION_REF_KINDS.length);
    expect(originationRefFor("commitment", 12)).toBe("cmt-0012");
    for (const bad of ["app-1", "app-00012", "APP-0001", "app-000a", "", "app-0001 ", 1, null, undefined]) {
      expect(isOriginationRef(bad, "application"), String(bad)).toBe(false);
    }
  });

  it("accepts only a whole-unit string as an amount", () => {
    for (const good of ["0", "1", "1000", "999999999999"]) {
      expect(isOriginationAmount(good), good).toBe(true);
    }
    for (const bad of ["", "01", "-1", "+1", "1.5", "1,000", "1e3", " 1", "1 ", "0x10", "٣", "1234567890123", 1000, null, undefined]) {
      expect(isOriginationAmount(bad), String(bad)).toBe(false);
    }
  });
});

describe("what the desk records and keeps locked", () => {
  it("cites the owner ruling and keeps placeHold not-bound with the locked consideredAction", () => {
    expect(ORIGINATION_RULING).toBe("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
    expect(ORIGINATION_HOLD_NOT_BOUND).toMatchObject({
      method: "placeHold",
      status: "not-bound",
      consideredAction: "reserve_listing",
      mappedOntoPrepareTrade: false,
    });
    expect(ORIGINATION_HOLD_NOT_BOUND.consideredAction).toBe(COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction);
    expect(ORIGINATION_HOLD_NOT_BOUND.reason).toBe(COMMERCE_COMMAND_BINDINGS.placeHold.reason);
  });

  it("records the unsent actions and the ruling, and composes none of them", () => {
    const recorded = ORIGINATION_NOT_COMPOSED.map((entry) => entry.action);
    for (const entry of JOURNEY_NOT_COMPOSED) {
      expect(recorded).toContain(entry.action);
    }
    expect(recorded).toContain("refund_ticket");
    for (const entry of JOURNEY_NOT_COMPOSED) {
      expect(entry.reason).toContain(ORIGINATION_RULING);
    }
  });

  it("leaves the locked bindings file byte-identical", () => {
    const bytes = readFileSync(path.join(repoRoot, "packages/protocol-adapter/src/commerce-bindings.ts"));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249");
  });

  it("has no producer tuple, so the connection is NOT_BOUND and every digest is null", () => {
    expect(ORIGINATION_PRODUCER_TUPLE).toMatchObject({
      bound: false,
      status: "NOT_BOUND",
      sdkDigest: null,
      manifestDigest: null,
      vectorDigest: null,
    });
    expect(ORIGINATION_PRODUCER_TUPLE.waitingOn).toEqual([
      "kix-protocol:cr-08-producer-sdk",
      "bind-credit-fsm",
      "c-finance-projection",
      "c-journey-identity",
    ]);
    expect(ORIGINATION_NOT_BOUND_REASON).toContain("kix-protocol:cr-08-producer-sdk");
    expect(ORIGINATION_NOT_BOUND_REASON).toContain("NOT_BOUND");
    expect(DISCOVERY_READ_TUPLE_LITERALS.sdkDigest).toBeNull();
  });
});

describe("the application, the decision, the commitment, and the drawdown stay four lanes", () => {
  it("opens with no application, no decision, no commitment, no terms, and no permission to draw", async () => {
    const snapshot = await ready(stub());
    expect(snapshot.application).toMatchObject({ state: "not-started", revision: 0, requestedAmount: null });
    expect(snapshot.decision).toBeNull();
    expect(snapshot.commitment).toBeNull();
    expect(snapshot.terms).toBeNull();
    expect(snapshot.explanation).toBeNull();
    expect(snapshot.reasons).toEqual([]);
    expect(snapshot.drawdown).toMatchObject({ permission: "not-permitted", requests: [] });
    expect(snapshot.nonClaims).toEqual({
      submissionIsApproval: false,
      explanationIsApproval: false,
      approvalIsCommitment: false,
      commitmentIsDrawdown: false,
      disbursed: false,
    });
    expect(snapshot.claims.map((row) => row.claimRef)).toEqual(["clm-0001", "clm-0002"]);
    expect(snapshot.burdens.map((row) => row.burdenRef)).toEqual(["bdn-0001", "bdn-0002"]);
    const assessment = assessOriginationSnapshot(snapshot);
    expect(assessment).toMatchObject({ cutState: "single", limitState: "none", staleLanes: [], contradictions: [], unlinked: [] });
    expect(assessment.consentBlocks).toEqual([]);
    expect(assessment.documentBlocks).toEqual([]);
  });

  it("copies every claim, burden, and requested figure as text and keeps burdens apart from claims", async () => {
    const port = stub();
    const snapshot = await ready(port);
    expect(snapshot.claims.map((row) => row.faceAmount)).toEqual(["1100", "800"]);
    expect(snapshot.burdens.map((row) => row.amount)).toEqual(["300", "200"]);
    expect(snapshot.burdens.map((row) => row.kind)).toEqual(["refund-burden", "prior-pledge"]);
    expect(Object.keys(snapshot.claims[0] ?? {})).not.toContain("net");
    // The requested amount is the person's text, copied back verbatim.
    await applied(port, { ...SUBMIT, requestedAmount: "700" });
    const after = await ready(port);
    expect(after.application.requestedAmount).toBe("700");
    expect(after.application.state).toBe("submitted");
  });

  it("shows a submission as submitted with a pending decision, and the explanation carries no decision", async () => {
    const port = stub();
    const receipt = await applied(port, SUBMIT);
    expect(receipt).toMatchObject({ kind: "submit", revision: 1, decisionAfter: "pending", commitmentAfter: "none", drawdownRef: null });
    const snapshot = await ready(port);
    expect(snapshot.decision).toMatchObject({ kind: "pending", applicationRevision: 1 });
    expect(snapshot.terms).toBeNull();
    expect(snapshot.commitment).toBeNull();
    expect(snapshot.drawdown.permission).toBe("not-permitted");
    expect(snapshot.explanation).toMatchObject({ provenance: "assistant-generated" });
    expect(Object.keys(snapshot.explanation ?? {})).toEqual(["explanationRef", "provenance", "text"]);
  });

  it("does not read an assistant explanation that mentions approval as a decision", async () => {
    const snapshot = await ready(stub("explanation-says-approved"));
    expect(snapshot.explanation?.text.toLowerCase()).toContain("approved");
    expect(snapshot.decision?.kind).toBe("pending");
    expect(snapshot.commitment).toBeNull();
    expect(snapshot.drawdown.permission).toBe("not-permitted");
    expect(assessOriginationSnapshot(snapshot).contradictions).toEqual([]);
  });

  it("keeps an approval apart from a commitment, and a commitment apart from permission to draw", async () => {
    const approved = await ready(stub("approved"));
    expect(approved.decision?.kind).toBe("approved");
    expect(approved.commitment).toBeNull();
    expect(approved.drawdown.permission).toBe("not-permitted");
    expect(approved.terms).not.toBeNull();

    const offered = await ready(stub("offered"));
    expect(offered.commitment).toMatchObject({ state: "offered" });
    expect(offered.drawdown.permission).toBe("not-permitted");

    const committed = await ready(stub("committed"));
    expect(committed.commitment).toMatchObject({ state: "accepted" });
    expect(committed.drawdown.permission).toBe("permitted");
    expect(committed.drawdown.requests).toEqual([]);
    expect(assessOriginationSnapshot(committed).contradictions).toEqual([]);
  });

  it("separates conditional, more-information, and rejected decisions, each with the reasons and paths it names", async () => {
    const conditional = await ready(stub("conditional"));
    expect(conditional.decision).toMatchObject({ kind: "conditional", conditions: ["CONDITION_PLEDGE_LESS", "CONDITION_EVIDENCE"] });
    expect(conditional.reasons.map((row) => row.remedy)).toEqual(["amend-application", "provide-document"]);
    expect(conditional.commitment).toBeNull();
    expect(conditional.drawdown.permission).toBe("not-permitted");

    const more = await ready(stub("more-information"));
    expect(more.decision?.kind).toBe("more-information");
    expect(more.documents.find((row) => row.documentRef === "doc-0003")).toMatchObject({ state: "requested", kind: "additional-evidence" });
    expect(more.reasons.map((row) => row.code)).toEqual(["EVIDENCE_REQUESTED"]);

    const rejected = await ready(stub("rejected"));
    expect(rejected.decision?.kind).toBe("rejected");
    expect(rejected.terms).toBeNull();
    expect(rejected.reasons.map((row) => row.remedy)).toEqual(["amend-application", "request-re-review"]);
    expect(rejected.commitment).toBeNull();
  });

  it("copies the rate label and the schedule the source typed, and sends none when no terms exist", async () => {
    const approved = await ready(stub("approved"));
    expect(approved.terms).toMatchObject({ policyRevision: 4, rateLabel: "syn-rate-label-0001", unit: "mock-unit" });
    expect(approved.terms?.scheduleRows?.map((row) => row.amount)).toEqual(["500", "400", "300"]);
    expect(approved.limit).toMatchObject({ limitRef: "lim-0001", amount: "1500", contention: "none" });
    const rejected = await ready(stub("rejected"));
    expect(rejected.terms).toBeNull();
  });
});

describe("stale policy, withdrawn consent, expired document, and the shared limit", () => {
  it("flags a decision, a commitment, and terms built under an older policy revision and withholds permission", async () => {
    const snapshot = await ready(stub("stale-policy"));
    expect(snapshot.policy.currentRevision).toBe(4);
    expect(snapshot.decision?.policyRevision).toBe(3);
    expect(snapshot.drawdown.permission).toBe("permitted");
    const assessment = assessOriginationSnapshot(snapshot);
    expect(assessment.staleLanes).toEqual([
      { lane: "review", builtUnder: 3, currentRevision: 4 },
      { lane: "commitment", builtUnder: 3, currentRevision: 4 },
      { lane: "terms", builtUnder: 3, currentRevision: 4 },
    ]);
    expect(assessment.contradictions.map((item) => item.code)).toEqual(["DRAWDOWN_STALE_POLICY"]);
    expect(snapshot.reasons.map((row) => [row.code, row.remedy])).toEqual([["POLICY_REVISION_SUPERSEDED", "request-re-review"]]);
    expect(originationEligibility(snapshot, assessment, "request-drawdown").allowed).toBe(false);
    expect(originationEligibility(snapshot, assessment, "request-drawdown").reason).toContain("older policy revision");
    expect(originationEligibility(snapshot, assessment, "re-review").allowed).toBe(true);
  });

  it("moves the policy on demand and reports the source's own suspension with the revision difference", async () => {
    const port = stub("committed");
    expect((await ready(port)).drawdown.permission).toBe("permitted");
    expect(port.synthetic("advance-policy")).toBe(true);
    const snapshot = await ready(port);
    expect(snapshot.policy.currentRevision).toBe(5);
    expect(snapshot.drawdown).toMatchObject({ permission: "suspended", reasonCodes: ["POLICY_REVISION_SUPERSEDED"] });
    expect(assessOriginationSnapshot(snapshot).staleLanes.map((item) => item.lane)).toEqual(["review", "commitment", "terms"]);
  });

  it("shows a withdrawn consent as a block with a renewal path and suspends permission", async () => {
    const snapshot = await ready(stub("consent-withdrawn"));
    expect(snapshot.consents.find((row) => row.consentRef === "cns-0002")).toMatchObject({ purpose: "credit-assessment", state: "withdrawn" });
    const assessment = assessOriginationSnapshot(snapshot);
    expect(assessment.consentBlocks).toEqual(["cns-0002"]);
    expect(snapshot.drawdown).toMatchObject({ permission: "suspended", reasonCodes: ["CONSENT_WITHDRAWN"] });
    expect(snapshot.reasons.map((row) => [row.lane, row.remedy])).toEqual([["consent", "renew-consent"]]);
    expect(originationEligibility(snapshot, assessment, "correct", "consent").allowed).toBe(true);
    expect(originationEligibility(snapshot, assessment, "request-drawdown").allowed).toBe(false);
  });

  it("withdraws a consent on demand and refuses the next drawdown request with the consent code", async () => {
    const port = stub("committed");
    expect(port.synthetic("withdraw-consent")).toBe(true);
    const outcome = await port.act(actRequest({ kind: "request-drawdown", commitmentRef: "cmt-0001" }));
    expect(outcome).toMatchObject({ kind: "rejected", code: "CONSENT_WITHDRAWN" });
    const receipt = await applied(port, { kind: "correct", target: "consent", ref: "cns-0002" });
    expect(receipt.kind).toBe("correct");
    expect((await ready(port)).drawdown.permission).toBe("permitted");
  });

  it("shows an expired document as a block with a provide path, with the source's own expiry flag", async () => {
    const snapshot = await ready(stub("docs-expired"));
    const doc = snapshot.documents.find((row) => row.documentRef === "doc-0001");
    expect(doc).toMatchObject({ state: "expired", expired: true, expiresLabel: "2026-10-11T00:00:00.000Z" });
    const assessment = assessOriginationSnapshot(snapshot);
    expect(assessment.documentBlocks).toEqual(["doc-0001"]);
    expect(snapshot.drawdown).toMatchObject({ permission: "suspended", reasonCodes: ["DOCUMENT_EXPIRED"] });
    expect(originationEligibility(snapshot, assessment, "correct", "document").allowed).toBe(true);
    const port = stub("committed");
    expect(port.synthetic("expire-document")).toBe(true);
    expect(await port.act(actRequest({ kind: "request-drawdown", commitmentRef: "cmt-0001" }))).toMatchObject({
      kind: "rejected",
      code: "DOCUMENT_EXPIRED",
    });
  });

  it("ranks a shared limit as the source ordered it and offers no correction that changes the order", async () => {
    const snapshot = await ready(stub("limit-contended"));
    expect(snapshot.limit).toMatchObject({ contention: "contended" });
    expect(snapshot.limit.ranks).toEqual([
      { applicationRef: "app-0002", rank: 1 },
      { applicationRef: "app-0001", rank: 2 },
    ]);
    const assessment = assessOriginationSnapshot(snapshot);
    expect(assessment.limitState).toBe("contended-behind");
    expect(snapshot.drawdown).toMatchObject({ permission: "suspended", reasonCodes: ["LIMIT_TAKEN"] });
    expect(snapshot.reasons.map((row) => [row.lane, row.remedy])).toEqual([["limit", "none"]]);
  });

  it("serves a permitted read and then loses the limit to a rival request before the drawdown lands", async () => {
    const port = stub("limit-race");
    const first = await ready(port);
    expect(first.drawdown.permission).toBe("permitted");
    expect(first.limit.contention).toBe("none");
    expect(originationEligibility(first, assessOriginationSnapshot(first), "request-drawdown").allowed).toBe(true);
    const outcome = await port.act(actRequest({ kind: "request-drawdown", commitmentRef: "cmt-0001" }));
    expect(outcome).toMatchObject({ kind: "rejected", code: "LIMIT_TAKEN" });
    const second = await ready(port);
    expect(second.limit.contention).toBe("contended");
    expect(second.drawdown.permission).toBe("suspended");
    expect(second.drawdown.requests).toEqual([]);
    expect(assessOriginationSnapshot(second).limitState).toBe("contended-behind");
  });
});

describe("a drawdown request is recorded and never disbursed", () => {
  it("walks submit, review, offer, accept, and request with each step its own lane and no arithmetic", async () => {
    const port = stub();
    expect((await applied(port, SUBMIT)).decisionAfter).toBe("pending");
    expect(port.synthetic("advance-review")).toBe(true);
    let snapshot = await ready(port);
    expect(snapshot.decision?.kind).toBe("approved");
    expect(snapshot.commitment).toBeNull();
    expect(await port.act(actRequest({ kind: "accept-commitment", commitmentRef: "cmt-0001" }))).toMatchObject({ kind: "rejected", code: "NO_COMMITMENT" });
    expect(port.synthetic("advance-review")).toBe(true);
    snapshot = await ready(port);
    expect(snapshot.commitment?.state).toBe("offered");
    expect(snapshot.drawdown.permission).toBe("not-permitted");
    const accepted = await applied(port, { kind: "accept-commitment", commitmentRef: "cmt-0001" });
    expect(accepted).toMatchObject({ commitmentAfter: "accepted", drawdownRef: null });
    snapshot = await ready(port);
    expect(snapshot.drawdown.permission).toBe("permitted");
    const drawn = await applied(port, { kind: "request-drawdown", commitmentRef: "cmt-0001" });
    expect(drawn.drawdownRef).toBe("drw-0001");
    expect(drawn.nonClaims.disbursed).toBe(false);
    snapshot = await ready(port);
    expect(snapshot.drawdown.requests).toEqual([{ drawdownRef: "drw-0001", state: "recorded" }]);
    expect(snapshot.nonClaims.disbursed).toBe(false);
    expect(port.synthetic("advance-review")).toBe(false);
  });

  it("refuses a second submission, an unknown claim, a bad amount, and an unknown action", async () => {
    const port = stub();
    expect(await port.act(actRequest({ ...SUBMIT, requestedAmount: "10.5" }))).toMatchObject({ kind: "invalid-request", code: "AMOUNT" });
    expect(await port.act(actRequest({ ...SUBMIT, requestedAmount: "" }))).toMatchObject({ kind: "invalid-request", code: "AMOUNT" });
    expect(await port.act(actRequest({ ...SUBMIT, claimRefs: [] }))).toMatchObject({ kind: "invalid-request", code: "REF" });
    expect(await port.act(actRequest({ ...SUBMIT, claimRefs: ["clm-0003"] }))).toMatchObject({ kind: "rejected", code: "CLAIM_NOT_VALID" });
    expect(await port.act(actRequest({ kind: "disburse" } as unknown as OriginationActionRequest))).toMatchObject({ kind: "invalid-request", code: "ACTION" });
    await applied(port, SUBMIT);
    expect(await port.act(actRequest(SUBMIT))).toMatchObject({ kind: "rejected", code: "ALREADY_SUBMITTED" });
  });

  it("rejects each request the source cannot honour, with its own code", async () => {
    const fresh = stub();
    expect(await fresh.act(actRequest({ kind: "re-review" }))).toMatchObject({ kind: "rejected", code: "NOT_SUBMITTED" });
    expect(await fresh.act(actRequest({ kind: "correct", target: "application", requestedAmount: "500" }))).toMatchObject({ kind: "rejected", code: "NOT_SUBMITTED" });
    expect(await fresh.act(actRequest({ kind: "request-drawdown", commitmentRef: "cmt-0001" }))).toMatchObject({ kind: "rejected", code: "NO_COMMITMENT" });
    const review = stub("in-review");
    expect(await review.act(actRequest({ kind: "re-review" }))).toMatchObject({ kind: "rejected", code: "REVIEW_IN_PROGRESS" });
    expect(await review.act(actRequest({ kind: "correct", target: "application", requestedAmount: "500" }))).toMatchObject({ kind: "rejected", code: "REVIEW_IN_PROGRESS" });
    const committed = stub("committed");
    expect(await committed.act(actRequest({ kind: "correct", target: "document", ref: "doc-0002" }))).toMatchObject({ kind: "rejected", code: "NOT_CORRECTABLE" });
    expect(await committed.act(actRequest({ kind: "correct", target: "consent", ref: "cns-0002" }))).toMatchObject({ kind: "rejected", code: "NOT_CORRECTABLE" });
    expect(await committed.act(actRequest({ kind: "correct", target: "consent", ref: "doc-0002" }))).toMatchObject({ kind: "invalid-request", code: "REF" });
    expect(await committed.act(actRequest({ kind: "accept-commitment", commitmentRef: "cmt-0001" }))).toMatchObject({ kind: "rejected", code: "NO_COMMITMENT" });
    expect(await committed.act(actRequest({ kind: "accept-commitment", commitmentRef: "app-0001" }))).toMatchObject({ kind: "invalid-request", code: "REF" });
  });

  it("refuses to accept a commitment built under an older policy revision", async () => {
    const port = stub("offered");
    expect(port.synthetic("advance-policy")).toBe(true);
    expect(await port.act(actRequest({ kind: "accept-commitment", commitmentRef: "cmt-0001" }))).toMatchObject({ kind: "rejected", code: "STALE_POLICY" });
    const drawn = stub("stale-policy");
    expect(await drawn.act(actRequest({ kind: "request-drawdown", commitmentRef: "cmt-0001" }))).toMatchObject({ kind: "rejected", code: "STALE_POLICY" });
  });
});

describe("correction and review paths", () => {
  it("amends a rejected application into a new revision with a pending review, then reaches approval only by review", async () => {
    const port = stub("rejected");
    const receipt = await applied(port, { kind: "correct", target: "application", requestedAmount: "600" });
    expect(receipt).toMatchObject({ kind: "correct", revision: 2, decisionAfter: "pending" });
    const after = await ready(port);
    expect(after.application).toMatchObject({ revision: 2, requestedAmount: "600" });
    expect(after.decision).toMatchObject({ kind: "pending", applicationRevision: 2 });
    expect(after.reasons).toEqual([]);
    expect(after.terms).toBeNull();
    expect(port.synthetic("advance-review")).toBe(true);
    expect((await ready(port)).decision?.kind).toBe("approved");
  });

  it("opens a new review on request and withdraws a commitment the older review produced", async () => {
    const port = stub("stale-policy");
    const receipt = await applied(port, { kind: "re-review" });
    expect(receipt).toMatchObject({ kind: "re-review", decisionAfter: "pending", commitmentAfter: "withdrawn" });
    const after = await ready(port);
    expect(after.decision).toMatchObject({ kind: "pending", policyRevision: 4 });
    expect(after.commitment).toMatchObject({ state: "withdrawn" });
    expect(after.drawdown.permission).toBe("not-permitted");
    expect(assessOriginationSnapshot(after).staleLanes.map((item) => item.lane)).toEqual(["commitment"]);
    expect(port.synthetic("advance-review")).toBe(true);
    expect(port.synthetic("advance-review")).toBe(true);
    const offered = await ready(port);
    expect(offered.commitment).toMatchObject({ state: "offered", policyRevision: 4 });
    expect(assessOriginationSnapshot(offered).staleLanes).toEqual([]);
  });

  it("provides a requested document, which reopens the review", async () => {
    const port = stub("more-information");
    const receipt = await applied(port, { kind: "correct", target: "document", ref: "doc-0003" });
    expect(receipt.decisionAfter).toBe("pending");
    const after = await ready(port);
    expect(after.documents.find((row) => row.documentRef === "doc-0003")?.state).toBe("valid");
    expect(after.reasons).toEqual([]);
  });
});

describe("outcomes the desk will not trust", () => {
  it("refuses a submission answer that calls a submission an approval, after the source applied it", async () => {
    const port = stub("submit-claims-approval");
    const outcome = await port.act(actRequest(SUBMIT));
    expect(outcome).toMatchObject({ kind: "refused", code: "CLAIM", field: "decisionAfter" });
    const snapshot = await ready(port);
    expect(snapshot.application.state).toBe("submitted");
    expect(snapshot.decision?.kind).toBe("pending");
  });

  it("loses the answer to a request that took effect, and says nothing about the effect", async () => {
    const port = stub("act-lost");
    await expect(port.act(actRequest(SUBMIT))).rejects.toThrow("never arrived");
    expect(port.effects()).toMatchObject({ acts: 1 });
    expect((await ready(port)).application.state).toBe("submitted");
  });

  it("refuses a read whose non-claim fields are not the literal false", async () => {
    const approval = await stub("claims-approval").read(readRequest());
    expect(approval).toMatchObject({ kind: "refused", code: "CLAIM", field: "submissionIsApproval" });
    const disbursed = await stub("claims-disbursed").read(readRequest());
    expect(disbursed).toMatchObject({ kind: "refused", code: "CLAIM", field: "disbursed" });
  });

  it("refuses a row that belongs to another applicant", async () => {
    const outcome = await stub("scope-leak").read(readRequest());
    expect(outcome).toMatchObject({ kind: "refused", code: "SCOPE_LEAK", ref: "bdn-0003" });
  });

  it("names a burden whose claim the read does not list and attaches it nowhere", async () => {
    const snapshot = await ready(stub("dangling-link"));
    expect(assessOriginationSnapshot(snapshot).unlinked).toEqual([{ lens: "burdens", ref: "bdn-0002", missingRef: "clm-0099" }]);
  });

  it("keeps claims and burdens on separate cuts apart and blocks a submission on them", async () => {
    const snapshot = await ready(stub("mixed-cut"));
    const assessment = assessOriginationSnapshot(snapshot);
    expect(assessment.cutState).toBe("mixed");
    expect(assessment.usedCuts.map((cut) => cut.cutRef)).toEqual(["cut-0001", "cut-0002"]);
    expect(snapshot.burdens.every((row) => row.cutRef === "cut-0002")).toBe(true);
    expect(originationEligibility(snapshot, assessment, "submit")).toMatchObject({ allowed: false });
  });
});

describe("read outcomes", () => {
  it("answers empty, stale, denied, and lost reads as their own outcomes", async () => {
    expect(await stub("empty").read(readRequest())).toMatchObject({ kind: "empty", scope: OWN });
    expect(await stub("stale").read(readRequest())).toMatchObject({ kind: "stale", floor: ORIGINATION_STALE_FLOOR });
    expect(await stub("denied").read(readRequest())).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
    await expect(stub("read-lost").read(readRequest())).rejects.toThrow("never arrived");
    const clean = stub();
    expect(await clean.read(readRequest(OWN, ORIGINATION_DESK_ACTOR, "2026-10-14T00:00:00.000Z"))).toMatchObject({ kind: "stale" });
    expect(await clean.read(readRequest(OWN, ORIGINATION_DESK_ACTOR, "2026-10-01T00:00:00.000Z"))).toMatchObject({ kind: "ready" });
  });

  it("denies a scope the actor holds no grant for, and a withdrawn grant, and returns no row", async () => {
    expect(await stub().read(readRequest(FOREIGN))).toMatchObject({ kind: "denied", code: "SCOPE_DENIED", applicantRef: ORIGINATION_FOREIGN_REF });
    expect(await stub().read(readRequest(OWN, "some-other-actor"))).toMatchObject({ kind: "denied", code: "SCOPE_DENIED" });
    const port = stub();
    expect(port.synthetic("revoke-grant")).toBe(true);
    expect(await port.read(readRequest())).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
    expect(await port.act(actRequest(SUBMIT))).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
  });

  it("refuses a malformed request before it reads or acts", async () => {
    const port = stub();
    expect(await port.read({ ...readRequest(), contextKey: " " })).toMatchObject({ kind: "invalid-request", code: "CONTEXT" });
    expect(await port.read({ ...readRequest(), actorRef: "" })).toMatchObject({ kind: "invalid-request", code: "ACTOR" });
    expect(await port.read({ ...readRequest(), scope: { tenantId: "other", applicantRef: ORIGINATION_OWN_REF } })).toMatchObject({ kind: "invalid-request", code: "SCOPE" });
    expect(await port.read({ ...readRequest(), scope: { tenantId: ORIGINATION_TENANT, applicantRef: "app-0001" } })).toMatchObject({ kind: "invalid-request", code: "SCOPE" });
    expect(await port.read(readRequest(OWN, ORIGINATION_DESK_ACTOR, "not an instant"))).toMatchObject({ kind: "invalid-request", code: "FLOOR" });
    expect(await port.act({ ...actRequest(SUBMIT), contextKey: "" })).toMatchObject({ kind: "invalid-request", code: "CONTEXT" });
  });

  it("stops on a changed pin tuple before it reads or acts", async () => {
    const changed = createStubCreditOrigination({ expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, protocolMergeSha: "0".repeat(40) } });
    expect(await changed.read(readRequest())).toMatchObject({ kind: "tuple-changed", field: "protocolMergeSha" });
    expect(await changed.act(actRequest(SUBMIT))).toMatchObject({ kind: "tuple-changed", field: "protocolMergeSha" });
    const sdk = createStubCreditOrigination({ expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, sdkDigest: "sha256:x" as unknown as null } });
    expect(await sdk.read(readRequest())).toMatchObject({ kind: "tuple-changed", field: "sdkTuple" });
  });

  it("is NOT_BOUND on integration-http for a read and a request, with no stub switch", async () => {
    const port = creditOriginationPortFor("integration-http");
    expect(port).toMatchObject({ environment: "integration-http", source: "none" });
    expect(await port.read(readRequest())).toEqual({ kind: "not-bound", reason: ORIGINATION_NOT_BOUND_REASON });
    expect(await port.act(actRequest(SUBMIT))).toEqual({ kind: "not-bound", reason: ORIGINATION_NOT_BOUND_REASON });
    for (const control of ORIGINATION_SYNTHETIC_CONTROLS) {
      expect(port.synthetic(control), control).toBe(false);
    }
    expect(createNotBoundCreditOrigination().scenario).toBe("clean");
    expect(creditOriginationPortFor("stub").source).toBe("synthetic-origination");
  });
});

describe("refusal checks on a payload", () => {
  async function base(): Promise<OriginationSnapshot> {
    return clone(await ready(stub("committed")));
  }

  it("accepts a whole committed payload", async () => {
    expect(refuseOriginationSnapshot(await base())).toBeNull();
  });

  it("refuses each non-claim field that is true or missing", async () => {
    for (const field of ORIGINATION_NON_CLAIM_FIELDS) {
      const snapshot = await base();
      (snapshot.nonClaims as unknown as Record<string, unknown>)[field] = true;
      expect(refuseOriginationSnapshot(snapshot), field).toMatchObject({ code: "CLAIM", field });
      const silent = await base();
      delete (silent.nonClaims as unknown as Record<string, unknown>)[field];
      expect(refuseOriginationSnapshot(silent), `${field} missing`).toMatchObject({ code: "CLAIM", field });
      expect(findOriginationClaim({ ...snapshot.nonClaims })).toBe(field);
    }
    expect(findOriginationClaim(null)).toBe("submissionIsApproval");
    expect(findOriginationClaim(undefined)).toBe("submissionIsApproval");
  });

  it("refuses a malformed reference, state, kind, amount, unit, cut, or scope", async () => {
    const cases: [string, (s: OriginationSnapshot) => void, string][] = [
      ["claim ref", (s) => { s.claims[0]!.claimRef = "bdn-0001"; }, "REF"],
      ["application ref", (s) => { s.application.applicationRef = "clm-0001"; }, "REF"],
      ["consent ref", (s) => { s.consents[0]!.consentRef = "doc-0001"; }, "REF"],
      ["document ref", (s) => { s.documents[0]!.documentRef = "cns-0001"; }, "REF"],
      ["reason ref", (s) => { s.reasons = [{ reasonRef: "x", lane: "claim", code: "C", text: "t", remedy: "none" }]; }, "REF"],
      ["decision ref", (s) => { s.decision!.decisionRef = "app-0001"; }, "REF"],
      ["cut ref", (s) => { s.cuts[0]!.cutRef = "cmt-0001"; }, "REF"],
      ["application state", (s) => { (s.application as { state: string }).state = "approved"; }, "STATE"],
      ["claim state", (s) => { (s.claims[0] as { state: string }).state = "paid"; }, "STATE"],
      ["burden state", (s) => { (s.burdens[0] as { state: string }).state = "paid"; }, "STATE"],
      ["consent state", (s) => { (s.consents[0] as { state: string }).state = "ok"; }, "STATE"],
      ["document state", (s) => { (s.documents[0] as { state: string }).state = "fine"; }, "STATE"],
      ["commitment state", (s) => { (s.commitment as { state: string }).state = "signed"; }, "STATE"],
      ["permission", (s) => { (s.drawdown as { permission: string }).permission = "granted"; }, "STATE"],
      ["decision kind", (s) => { (s.decision as { kind: string }).kind = "fine"; }, "KIND"],
      ["burden kind", (s) => { (s.burdens[0] as { kind: string }).kind = "tax"; }, "KIND"],
      ["consent purpose", (s) => { (s.consents[0] as { purpose: string }).purpose = "ads"; }, "KIND"],
      ["document kind", (s) => { (s.documents[0] as { kind: string }).kind = "id"; }, "KIND"],
      ["cut source", (s) => { (s.cuts[0] as { source: string }).source = "bank"; }, "KIND"],
      ["reason lane", (s) => { s.reasons = [{ reasonRef: "rsn-0001", lane: "x" as "claim", code: "C", text: "t", remedy: "none" }]; }, "KIND"],
      ["reason remedy", (s) => { s.reasons = [{ reasonRef: "rsn-0001", lane: "claim", code: "C", text: "t", remedy: "x" as "none" }]; }, "KIND"],
      ["claim amount", (s) => { s.claims[0]!.faceAmount = "11.5"; }, "AMOUNT"],
      ["burden amount", (s) => { s.burdens[0]!.amount = "-3"; }, "AMOUNT"],
      ["requested amount", (s) => { s.application.requestedAmount = "1e3"; }, "AMOUNT"],
      ["limit amount", (s) => { s.limit.amount = "0.5"; }, "AMOUNT"],
      ["schedule amount", (s) => { s.terms!.scheduleRows![0]!.amount = "5 0"; }, "AMOUNT"],
      ["claim unit", (s) => { (s.claims[0] as { unit: string }).unit = "USD"; }, "UNIT"],
      ["burden unit", (s) => { (s.burdens[0] as { unit: string }).unit = "KRW"; }, "UNIT"],
      ["terms unit", (s) => { (s.terms as { unit: string }).unit = "EUR"; }, "UNIT"],
      ["row cut", (s) => { s.claims[0]!.cutRef = "cut-0099"; }, "CUT"],
      ["claim applicant", (s) => { s.claims[0]!.applicantRef = ORIGINATION_FOREIGN_REF; }, "SCOPE_LEAK"],
      ["application applicant", (s) => { s.application.applicantRef = ORIGINATION_FOREIGN_REF; }, "SCOPE_LEAK"],
    ];
    for (const [label, mutate, code] of cases) {
      const snapshot = await base();
      mutate(snapshot);
      expect(refuseOriginationSnapshot(snapshot), label).toMatchObject({ kind: "refused", code });
    }
  });

  it("refuses a receipt that overstates what a request did", () => {
    const receipt: OriginationReceipt = {
      kind: "submit",
      applicationRef: "app-0001",
      revision: 1,
      decisionAfter: "pending",
      commitmentAfter: "none",
      drawdownRef: null,
      nonClaims: { submissionIsApproval: false, explanationIsApproval: false, approvalIsCommitment: false, commitmentIsDrawdown: false, disbursed: false },
    };
    expect(refuseOriginationReceipt(receipt, SUBMIT)).toBeNull();
    for (const request of [SUBMIT, { kind: "re-review" } as const, { kind: "correct", target: "application", requestedAmount: "5" } as const]) {
      expect(refuseOriginationReceipt({ ...receipt, decisionAfter: "approved" }, request), request.kind).toMatchObject({ code: "CLAIM", field: "decisionAfter" });
    }
    expect(refuseOriginationReceipt({ ...receipt, decisionAfter: "approved" }, { kind: "accept-commitment", commitmentRef: "cmt-0001" })).toBeNull();
    expect(refuseOriginationReceipt({ ...receipt, drawdownRef: "drw-0001" }, { kind: "accept-commitment", commitmentRef: "cmt-0001" })).toMatchObject({ field: "drawdownRef" });
    expect(refuseOriginationReceipt({ ...receipt, drawdownRef: null }, { kind: "request-drawdown", commitmentRef: "cmt-0001" })).toMatchObject({ code: "REF" });
    expect(refuseOriginationReceipt({ ...receipt, applicationRef: "clm-0001" }, SUBMIT)).toMatchObject({ code: "REF" });
    expect(refuseOriginationReceipt({ ...receipt, nonClaims: { ...receipt.nonClaims, disbursed: true } as unknown as OriginationReceipt["nonClaims"] }, SUBMIT)).toMatchObject({ code: "CLAIM", field: "disbursed" });
  });
});

describe("cross-lane contradictions", () => {
  async function committed(): Promise<OriginationSnapshot> {
    return clone(await ready(stub("committed")));
  }

  it("withholds a decision with no submitted application", async () => {
    const snapshot = await committed();
    snapshot.application.state = "not-started";
    expect(assessOriginationSnapshot(snapshot).contradictions.map((item) => item.code)).toContain("APPROVAL_WITHOUT_SUBMISSION");
  });

  it("withholds a commitment whose decision is not approved", async () => {
    const snapshot = await committed();
    snapshot.decision!.kind = "conditional";
    const found = assessOriginationSnapshot(snapshot).contradictions.find((item) => item.code === "COMMITMENT_WITHOUT_APPROVAL");
    expect(found).toMatchObject({ lane: "commitment" });
    expect(originationEligibility(snapshot, assessOriginationSnapshot(snapshot), "accept-commitment").allowed).toBe(false);
  });

  it("withholds permission with no accepted commitment, and for each blocker the source did not honour", async () => {
    const none = await committed();
    none.commitment = null;
    expect(assessOriginationSnapshot(none).contradictions.map((item) => item.code)).toContain("DRAWDOWN_WITHOUT_COMMITMENT");
    const offered = await committed();
    offered.commitment!.state = "offered";
    expect(assessOriginationSnapshot(offered).contradictions.map((item) => item.code)).toContain("DRAWDOWN_WITHOUT_COMMITMENT");

    const consent = await committed();
    consent.consents[1]!.state = "withdrawn";
    expect(assessOriginationSnapshot(consent).contradictions.map((item) => item.code)).toEqual(["DRAWDOWN_CONSENT"]);

    const doc = await committed();
    doc.documents[0]!.state = "expired";
    expect(assessOriginationSnapshot(doc).contradictions.map((item) => item.code)).toEqual(["DRAWDOWN_DOCUMENT"]);

    const limit = await committed();
    limit.limit = { ...limit.limit, contention: "contended", ranks: [{ applicationRef: "app-0002", rank: 1 }, { applicationRef: "app-0001", rank: 2 }] };
    const assessed = assessOriginationSnapshot(limit);
    expect(assessed.contradictions.map((item) => item.code)).toEqual(["DRAWDOWN_LIMIT"]);
    expect(originationEligibility(limit, assessed, "request-drawdown").allowed).toBe(false);

    const first = await committed();
    first.limit = { ...first.limit, contention: "contended", ranks: [{ applicationRef: "app-0001", rank: 1 }, { applicationRef: "app-0002", rank: 2 }] };
    expect(assessOriginationSnapshot(first)).toMatchObject({ limitState: "contended-first", contradictions: [] });
  });
});

describe("eligibility", () => {
  it("offers each action only on the lane that supports it", async () => {
    const eligible = async (scenario: OriginationScenario, kind: (typeof ORIGINATION_ACTION_KINDS)[number], target?: "application" | "document" | "consent") => {
      const snapshot = await ready(stub(scenario));
      return originationEligibility(snapshot, assessOriginationSnapshot(snapshot), kind, target);
    };
    expect((await eligible("clean", "submit")).allowed).toBe(true);
    expect((await eligible("in-review", "submit")).allowed).toBe(false);
    expect((await eligible("clean", "correct", "application")).allowed).toBe(false);
    expect((await eligible("rejected", "correct", "application")).allowed).toBe(true);
    expect((await eligible("rejected", "re-review")).allowed).toBe(true);
    expect((await eligible("rejected", "correct", "document")).allowed).toBe(false);
    expect((await eligible("more-information", "correct", "document")).allowed).toBe(true);
    expect((await eligible("more-information", "re-review")).allowed).toBe(false);
    expect((await eligible("in-review", "re-review")).reason).toContain("in progress");
    expect((await eligible("clean", "re-review")).allowed).toBe(false);
    expect((await eligible("approved", "accept-commitment")).reason).toContain("An approval is not a commitment");
    expect((await eligible("offered", "accept-commitment")).allowed).toBe(true);
    expect((await eligible("committed", "accept-commitment")).allowed).toBe(false);
    expect((await eligible("offered", "request-drawdown")).reason).toContain("no accepted commitment");
    expect((await eligible("committed", "request-drawdown")).allowed).toBe(true);
    expect((await eligible("consent-withdrawn", "request-drawdown")).reason).toContain("suspended");
    expect((await eligible("consent-withdrawn", "accept-commitment")).allowed).toBe(false);
    expect((await eligible("clean", "correct")).reason).toBeTruthy();
  });

  it("does not offer a submission with a consent that is not granted, or with no valid claim", async () => {
    const snapshot = clone(await ready(stub()));
    snapshot.consents[1]!.state = "expired";
    expect(originationEligibility(snapshot, assessOriginationSnapshot(snapshot), "submit").reason).toContain("cns-0002");
    const none = clone(await ready(stub()));
    none.claims.forEach((row) => { row.state = "disputed"; });
    expect(originationEligibility(none, assessOriginationSnapshot(none), "submit").reason).toContain("no valid claim");
  });
});

describe("synthetic controls", () => {
  it("names six controls and moves the source only where there is something to move", async () => {
    expect([...ORIGINATION_SYNTHETIC_CONTROLS]).toEqual([
      "advance-review",
      "advance-policy",
      "withdraw-consent",
      "expire-document",
      "rival-request",
      "revoke-grant",
    ]);
    const fresh = stub();
    expect(fresh.synthetic("advance-review")).toBe(false);
    const rival = stub("committed");
    expect(rival.synthetic("rival-request")).toBe(true);
    expect((await ready(rival)).limit.contention).toBe("contended");
  });
});

describe("every scenario", () => {
  it("returns a defined outcome for a read and for each action, and a read never writes", async () => {
    expect(new Set(ORIGINATION_SCENARIOS).size).toBe(ORIGINATION_SCENARIOS.length);
    for (const scenario of ORIGINATION_SCENARIOS) {
      const port = stub(scenario);
      let read: OriginationReadOutcome | "rejected";
      try {
        read = await port.read(readRequest());
      } catch {
        read = "rejected";
      }
      expect(read, scenario).toBeDefined();
      expect(port.effects(), scenario).toEqual({ reads: 1, acts: 0 });
      let act: OriginationActOutcome | "rejected";
      try {
        act = await port.act(actRequest({ kind: "re-review" }));
      } catch {
        act = "rejected";
      }
      expect(act, scenario).toBeDefined();
      expect(port.effects(), scenario).toEqual({ reads: 1, acts: 1 });
    }
  });
});

describe("source", () => {
  const files = ["credit-origination.ts", "credit-origination-controller.ts"].map((name) =>
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
