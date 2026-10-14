import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  DISCOVERY_READ_TUPLE_LITERALS,
  MARKETING_CHANNEL,
  MARKETING_CONSENT_NOT_POSTED,
  MARKETING_CONTRACT_REGISTER,
  MARKETING_CRM_SCOPE,
  MARKETING_DESK_ACTOR,
  MARKETING_FOREIGN_SUBJECT,
  MARKETING_HOLD_NOT_BOUND,
  MARKETING_JOURNEY_RULING,
  MARKETING_LANES,
  MARKETING_NON_CLAIM_FIELDS,
  MARKETING_NOT_BOUND_REASON,
  MARKETING_NOT_COMPOSED,
  MARKETING_OWN_SUBJECT,
  MARKETING_REF_KINDS,
  MARKETING_REJECT_CODES,
  MARKETING_RETURN_ACTIONS,
  MARKETING_SCENARIOS,
  MARKETING_STALE_FLOOR,
  MARKETING_STEPS,
  MARKETING_SYNTHETIC_CONTROLS,
  MARKETING_UNDETERMINED,
  PINNED_ACTIONS,
  createNotBoundMarketingJourney,
  createStubMarketingJourney,
  findMarketingClaim,
  isMarketingRef,
  marketingJourneyPortFor,
  marketingRef,
  marketingRefKind,
  refuseMarketingReceipt,
  refuseMarketingSnapshot,
  type MarketingReadOutcome,
  type MarketingReceipt,
  type MarketingSnapshot,
  type MarketingWriteOutcome,
  type MarketingWriteRequest,
  type StubMarketingJourney,
} from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

const CTX = "stub|kix|fan-desk|sub-0001|1";

function base(intentRef: string) {
  return { contextKey: CTX, actorRef: MARKETING_DESK_ACTOR, subjectRef: MARKETING_OWN_SUBJECT, intentRef };
}

async function snapshotOf(port: StubMarketingJourney): Promise<MarketingSnapshot> {
  const outcome = await port.read({ contextKey: CTX, actorRef: MARKETING_DESK_ACTOR, subjectRef: MARKETING_OWN_SUBJECT, watermarkFloor: null });
  if (outcome.kind !== "ready") {
    throw new Error(`expected a ready read, received ${outcome.kind}`);
  }
  return outcome.snapshot;
}

function readOf(port: StubMarketingJourney, patch: { actorRef?: string; subjectRef?: string; watermarkFloor?: string | null } = {}): Promise<MarketingReadOutcome> {
  return port.read({
    contextKey: CTX,
    actorRef: patch.actorRef ?? MARKETING_DESK_ACTOR,
    subjectRef: patch.subjectRef ?? MARKETING_OWN_SUBJECT,
    watermarkFloor: patch.watermarkFloor ?? null,
  });
}

function applyRequest(
  intentRef: string,
  benefitRef: string,
  orderRef = "ord-0001",
  versions: { eligibility?: number; consent?: number } = {},
): Extract<MarketingWriteRequest, { step: "apply" }> {
  return {
    ...base(intentRef),
    step: "apply",
    benefitRef,
    orderRef,
    expectedEligibilityVersion: versions.eligibility ?? 3,
    expectedConsentVersion: versions.consent ?? 2,
  };
}

function reclaimRequest(intentRef: string, applicationRef: string): Extract<MarketingWriteRequest, { step: "reclaim" }> {
  return { ...base(intentRef), step: "reclaim", applicationRef };
}

function kind(outcome: MarketingWriteOutcome): string {
  return outcome.kind === "rejected" ? `rejected:${outcome.code}` : outcome.kind;
}

function confirmed(outcome: MarketingWriteOutcome): MarketingReceipt {
  if (outcome.kind !== "confirmed") {
    throw new Error(`expected a confirmed write, received ${kind(outcome)}`);
  }
  return outcome.receipt;
}

describe("marketing contract register", () => {
  const pin = JSON.parse(
    readFileSync(path.join(repoRoot, "packages/protocol-adapter/vendor/kix-protocol.contract-only.openapi.json"), "utf8"),
  ) as { components: { schemas: Record<string, { properties?: Record<string, unknown> }> } };

  it("names a published body field only where the pin has it, and says not-bound where it has none", () => {
    expect(new Set(MARKETING_CONTRACT_REGISTER.map((row) => row.id)).size).toBe(MARKETING_CONTRACT_REGISTER.length);
    for (const row of MARKETING_CONTRACT_REGISTER) {
      expect(row.reason.length, row.id).toBeGreaterThan(20);
      if (row.status === "field-named") {
        expect(row.bodyFields.length, row.id).toBeGreaterThan(0);
        for (const entry of row.bodyFields) {
          expect(PINNED_ACTIONS as readonly string[], `${row.id} ${entry.action}`).toContain(entry.action);
          const schema = pin.components.schemas[entry.action];
          expect(Object.keys(schema?.properties ?? {}), `${row.id} ${entry.action}.${entry.field}`).toContain(entry.field);
        }
      } else {
        expect(row.bodyFields, row.id).toEqual([]);
      }
    }
    const status = Object.fromEntries(MARKETING_CONTRACT_REGISTER.map((row) => [row.id, row.status]));
    expect(status).toEqual({
      "consent-state": "field-named",
      "consent-version": "field-named",
      "consent-purpose": "field-named",
      authorization: "field-named",
      eligibility: "not-bound",
      priority: "not-bound",
      "usage-count": "not-bound",
      "coupon-budget": "not-bound",
      "referral-attribution": "not-bound",
      "benefit-application": "not-bound",
      reclaim: "not-bound",
    });
  });

  it("backs each not-bound row with the pin: no command, field, or schema names these concepts", () => {
    const words = ["coupon", "member", "presale", "referral", "reward", "promotion", "benefit", "campaign", "attribut", "reclaim", "usage", "budget", "eligib", "priority"];
    const names = [
      ...(PINNED_ACTIONS as readonly string[]),
      ...Object.keys(pin.components.schemas),
      ...Object.values(pin.components.schemas).flatMap((schema) => Object.keys(schema.properties ?? {})),
    ].map((name) => name.toLowerCase());
    for (const word of words) {
      expect(
        names.filter((name) => name.includes(word)),
        word,
      ).toEqual([]);
    }
    // The only marketing-shaped commands the pin publishes are the two consent commands.
    expect((PINNED_ACTIONS as readonly string[]).filter((name) => /consent|marketing/.test(name)).sort()).toEqual([
      "authorize_marketing",
      "set_consent",
    ]);
  });

  it("records the not-composed commands, the consent commands it never posts, and the locked hold binding", () => {
    expect(MARKETING_NOT_COMPOSED.map((entry) => entry.action)).toEqual([
      "capture",
      "settle_capture",
      "commit_trade",
      "open_admission",
      "admit",
      "refund_ticket",
    ]);
    for (const entry of MARKETING_NOT_COMPOSED) {
      expect(entry.reason, entry.action).toContain(MARKETING_JOURNEY_RULING);
    }
    expect(MARKETING_JOURNEY_RULING).toBe("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
    expect(MARKETING_CONSENT_NOT_POSTED.map((entry) => entry.action)).toEqual(["set_consent", "authorize_marketing"]);
    for (const entry of MARKETING_CONSENT_NOT_POSTED) {
      expect(entry.sender).toBe("ConsentBind");
      expect(entry.route).toBe("/marketing/m05");
      expect(entry.reason).toContain(MARKETING_JOURNEY_RULING);
      expect(PINNED_ACTIONS as readonly string[]).toContain(entry.action);
    }
    // Neither the two synthetic writes nor the consent commands are a catalogue command of this journey.
    for (const step of MARKETING_STEPS) {
      expect(PINNED_ACTIONS as readonly string[]).not.toContain(step);
    }
    expect(MARKETING_HOLD_NOT_BOUND.consideredAction).toBe("reserve_listing");
    expect(MARKETING_HOLD_NOT_BOUND.status).toBe("not-bound");
    expect(MARKETING_HOLD_NOT_BOUND.reason).toBe(COMMERCE_COMMAND_BINDINGS.placeHold.reason);
    expect(MARKETING_HOLD_NOT_BOUND.mappedOntoPrepareTrade).toBe(false);
    const bindings = readFileSync(path.join(repoRoot, "packages/protocol-adapter/src/commerce-bindings.ts"));
    expect(createHash("sha256").update(bindings).digest("hex")).toBe(
      "83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249",
    );
  });

  it("separates the CRM scope: only the consent read is consumed, nothing completes a CRM product", () => {
    expect(new Set(MARKETING_CRM_SCOPE.map((row) => row.id)).size).toBe(MARKETING_CRM_SCOPE.length);
    expect(MARKETING_CRM_SCOPE.filter((row) => row.scope === "consumed").map((row) => row.id)).toEqual([
      "consent-state-read",
      "authorization-check",
    ]);
    expect(MARKETING_CRM_SCOPE.filter((row) => row.scope === "outside-this-journey").map((row) => row.id)).toEqual([
      "audience-segmentation",
      "campaign-send",
      "crm-profile",
      "data-use-export",
    ]);
    for (const row of MARKETING_CRM_SCOPE) {
      expect(row.completesCrm, row.id).toBe(false);
      expect(row.reason, row.id).not.toMatch(/\bcomplete[sd]? the CRM\b|CRM is complete/i);
    }
    expect(MARKETING_CHANNEL).toBe("none");
    expect([...MARKETING_NON_CLAIM_FIELDS]).toEqual([
      "noticeConfirmsPurchase",
      "applicationConfirmsPurchase",
      "rewardPaid",
      "discountApplied",
      "crmSendPerformed",
      "crmProductComplete",
      "withdrawnAuthorizationReused",
    ]);
    expect([...MARKETING_LANES]).toEqual(["discover", "apply", "reject", "reclaim"]);
  });

  it("offers exactly one return action per rejection code", () => {
    expect(Object.keys(MARKETING_RETURN_ACTIONS).sort()).toEqual([...MARKETING_REJECT_CODES].sort());
    for (const code of MARKETING_REJECT_CODES) {
      expect(["read-again", "manage-consent", "none"], code).toContain(MARKETING_RETURN_ACTIONS[code]);
    }
    for (const code of ["CONSENT_REQUIRED", "CONSENT_WITHDRAWN", "AUTHORIZATION_STALE"] as const) {
      expect(MARKETING_RETURN_ACTIONS[code]).toBe("manage-consent");
    }
    for (const code of ["ELIGIBILITY_STALE", "CONSENT_VERSION_STALE", "DUPLICATE_USE", "ORDER_NOT_OPEN"] as const) {
      expect(MARKETING_RETURN_ACTIONS[code]).toBe("read-again");
    }
    for (const code of ["NOT_ELIGIBLE", "USAGE_LIMIT_REACHED", "BUDGET_EXHAUSTED", "NOT_STACKABLE", "ATTRIBUTION_TAKEN"] as const) {
      expect(MARKETING_RETURN_ACTIONS[code]).toBe("none");
    }
  });
});

describe("marketing references", () => {
  it("gives every kind its own prefix and never reads one kind as another", () => {
    const refs = MARKETING_REF_KINDS.map((refKind) => marketingRef(refKind, 12));
    expect(new Set(refs).size).toBe(MARKETING_REF_KINDS.length);
    for (const refKind of MARKETING_REF_KINDS) {
      const ref = marketingRef(refKind, 7);
      expect(marketingRefKind(ref)).toBe(refKind);
      for (const other of MARKETING_REF_KINDS) {
        expect(isMarketingRef(ref, other)).toBe(other === refKind);
      }
    }
    expect(marketingRef("application", 3)).toBe("app-0003");
    expect(marketingRefKind("app-3")).toBeNull();
    expect(marketingRefKind("coupon-0003")).toBeNull();
    expect(isMarketingRef(7, "order")).toBe(false);
  });
});

describe("marketing port selection", () => {
  it("serves the synthetic source on stub and a not-bound port on integration-http with no stub switch", async () => {
    const stub = marketingJourneyPortFor("stub");
    expect(stub.environment).toBe("stub");
    expect(stub.source).toBe("synthetic-marketing");
    const http = marketingJourneyPortFor("integration-http", { scenario: "clean" });
    expect(http.environment).toBe("integration-http");
    expect(http.source).toBe("none");
    for (const port of [http, createNotBoundMarketingJourney()]) {
      const read = await port.read({ contextKey: CTX, actorRef: MARKETING_DESK_ACTOR, subjectRef: MARKETING_OWN_SUBJECT, watermarkFloor: null });
      expect(read).toEqual({ kind: "not-bound", reason: MARKETING_NOT_BOUND_REASON });
      const write = await port.submit(applyRequest("i-1", "ben-0001"));
      expect(write).toEqual({ kind: "not-bound", reason: MARKETING_NOT_BOUND_REASON });
      expect(port.simulate({ control: "withdraw-consent" })).toEqual({ kind: "ignored", control: "withdraw-consent", reason: "not-bound" });
      expect(port.deliverHeld()).toBe(0);
    }
    expect(MARKETING_NOT_BOUND_REASON).toContain("wave7-marketing-contracts");
    expect(MARKETING_NOT_BOUND_REASON).toContain("set_consent and authorize_marketing only");
  });
});

describe("marketing read", () => {
  it("reads benefits with the source's own verdicts, consent as an observation, and two open orders with no application", async () => {
    const port = createStubMarketingJourney();
    const snapshot = await snapshotOf(port);
    expect(snapshot.subjectRef).toBe("sub-0001");
    expect(snapshot.membership).toEqual({ subjectRef: "sub-0001", tier: "member", version: 3 });
    expect(snapshot.consent).toEqual({
      state: "granted",
      version: 2,
      purpose: "benefit-notice",
      channel: "none",
      authorization: { state: "valid", atVersion: 2 },
    });
    expect(snapshot.benefits.map((benefit) => [benefit.benefitRef, benefit.kind, benefit.verdict])).toEqual([
      ["ben-0001", "presale", "eligible"],
      ["ben-0002", "coupon", "eligible"],
      ["ben-0003", "coupon", "budget-exhausted"],
      ["ben-0004", "referral", "eligible"],
    ]);
    expect(snapshot.benefits.map((benefit) => benefit.priorityRank)).toEqual([1, 2, 3, 4]);
    const coupon = snapshot.benefits.find((benefit) => benefit.benefitRef === "ben-0002");
    expect(coupon?.usage).toEqual({ allowed: 1, recorded: 0 });
    expect(coupon?.budget).toEqual({ unit: "redemption", limit: 3, committed: 2, state: "available" });
    expect(snapshot.benefits.find((benefit) => benefit.benefitRef === "ben-0004")?.attribution).toEqual({
      referrerRef: MARKETING_FOREIGN_SUBJECT,
      state: "unattributed",
    });
    expect(snapshot.orders.map((order) => [order.orderRef, order.state])).toEqual([
      ["ord-0001", "open"],
      ["ord-0002", "open"],
    ]);
    expect(snapshot.applications).toEqual([]);
    expect(Object.values(snapshot.nonClaims)).toEqual([false, false, false, false, false, false, false]);
    expect(findMarketingClaim(snapshot.nonClaims)).toBeNull();
    // A read sends nothing and changes nothing.
    expect(port.effects()).toEqual({ submits: 0, applies: 0, reclaims: 0, simulations: 0 });
    expect((await snapshotOf(port)).snapshotId).toBe(snapshot.snapshotId + 1);
  });

  it("serves empty and stale as their own outcomes", async () => {
    const empty = await readOf(createStubMarketingJourney({ scenario: "empty" }));
    expect(empty).toMatchObject({ kind: "empty" });
    const stale = await readOf(createStubMarketingJourney({ scenario: "stale" }));
    expect(stale).toMatchObject({ kind: "stale", floor: MARKETING_STALE_FLOOR });
    const floor = await readOf(createStubMarketingJourney(), { watermarkFloor: "2026-10-14T00:00:00.000Z" });
    expect(floor).toMatchObject({ kind: "stale" });
  });

  it("checks the pin tuple before any read or effect", async () => {
    const changed = { ...DISCOVERY_READ_TUPLE_LITERALS, protocolMergeSha: "0".repeat(40) };
    const port = createStubMarketingJourney({ expectedTuple: changed });
    expect(await readOf(port)).toMatchObject({ kind: "tuple-changed", field: "protocolMergeSha" });
    const write = await port.submit(applyRequest("i-1", "ben-0002"));
    expect(write).toMatchObject({ kind: "tuple-changed", step: "apply", intentRef: "i-1" });
    expect(port.effects().submits).toBe(0);
  });

  it("denies a read and a write for a subject or an actor with no grant, and returns no row", async () => {
    const port = createStubMarketingJourney();
    expect(await readOf(port, { subjectRef: MARKETING_FOREIGN_SUBJECT })).toMatchObject({ kind: "denied", code: "SCOPE_DENIED" });
    expect(await readOf(port, { actorRef: "fan-desk-2" })).toMatchObject({ kind: "denied", code: "SCOPE_DENIED" });
    const write = await port.submit({ ...applyRequest("i-1", "ben-0002"), subjectRef: MARKETING_FOREIGN_SUBJECT });
    expect(write).toMatchObject({ kind: "denied", code: "SCOPE_DENIED", step: "apply" });
    expect(port.effects().submits).toBe(0);
    const revoked = createStubMarketingJourney({ scenario: "denied" });
    expect(await readOf(revoked)).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
    expect(await revoked.submit(applyRequest("i-1", "ben-0002"))).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
  });

  it("shows each staged consent, usage, and attribution verdict as the source's own", async () => {
    const verdicts = async (scenario: (typeof MARKETING_SCENARIOS)[number]) => {
      const snapshot = await snapshotOf(createStubMarketingJourney({ scenario }));
      return Object.fromEntries(snapshot.benefits.map((benefit) => [benefit.benefitRef, benefit.verdict]));
    };
    expect(await verdicts("consent-unset")).toMatchObject({ "ben-0001": "consent-required", "ben-0002": "eligible", "ben-0004": "consent-required" });
    expect(await verdicts("consent-withdrawn")).toMatchObject({ "ben-0001": "consent-withdrawn", "ben-0002": "eligible", "ben-0004": "consent-withdrawn" });
    expect(await verdicts("authorization-stale")).toMatchObject({ "ben-0001": "authorization-stale", "ben-0004": "authorization-stale" });
    expect(await verdicts("usage-limit")).toMatchObject({ "ben-0002": "usage-limit-reached" });
    expect(await verdicts("attribution-taken")).toMatchObject({ "ben-0004": "attribution-taken" });
    const staged = await snapshotOf(createStubMarketingJourney({ scenario: "usage-limit" }));
    expect(staged.applications.map((application) => [application.applicationRef, application.channel, application.orderRef])).toEqual([
      ["app-0001", "other-channel", "ord-0002"],
    ]);
  });
});

describe("marketing writes on the synthetic source", () => {
  it("applies a benefit, records the application, and confirms no purchase, reward, discount, or message", async () => {
    const port = createStubMarketingJourney();
    const outcome = await port.submit(applyRequest("i-1", "ben-0001"));
    const receipt = confirmed(outcome);
    expect(receipt).toMatchObject({
      step: "apply",
      applicationRef: "app-0001",
      benefitRef: "ben-0001",
      orderRef: "ord-0001",
      state: "applied",
      eligibilityVersion: 3,
      consentVersion: 2,
      usageRestoration: MARKETING_UNDETERMINED,
    });
    expect(Object.values(receipt.nonClaims)).toEqual([false, false, false, false, false, false, false]);
    const after = await snapshotOf(port);
    expect(after.applications).toHaveLength(1);
    expect(after.applications[0]).toMatchObject({ applicationRef: "app-0001", state: "applied", channel: "this-desk", dueReason: null, consentWithdrawnSince: false });
    expect(after.benefits.find((benefit) => benefit.benefitRef === "ben-0001")?.usage).toEqual({ allowed: 1, recorded: 1 });
    expect(after.benefits.find((benefit) => benefit.benefitRef === "ben-0001")?.verdict).toBe("usage-limit-reached");
    expect(after.orders.every((order) => order.state === "open")).toBe(true);
    expect(port.effects()).toMatchObject({ submits: 1, applies: 1, reclaims: 0 });
  });

  it("counts a coupon against its budget, attributes a referral, and moves nothing else", async () => {
    const port = createStubMarketingJourney();
    confirmed(await port.submit(applyRequest("i-1", "ben-0002")));
    confirmed(await port.submit(applyRequest("i-2", "ben-0004")));
    const after = await snapshotOf(port);
    const coupon = after.benefits.find((benefit) => benefit.benefitRef === "ben-0002");
    expect(coupon?.budget).toEqual({ unit: "redemption", limit: 3, committed: 3, state: "exhausted" });
    expect(coupon?.usage).toEqual({ allowed: 1, recorded: 1 });
    expect(after.benefits.find((benefit) => benefit.benefitRef === "ben-0004")?.attribution?.state).toBe("attributed-to-referrer");
    // The other benefits are untouched.
    expect(after.benefits.find((benefit) => benefit.benefitRef === "ben-0001")?.usage).toEqual({ allowed: 1, recorded: 0 });
    expect(after.membership).toEqual({ subjectRef: "sub-0001", tier: "member", version: 3 });
  });

  it("rejects a duplicate, a coupon in the same group, a missing reference, and a closed order, each with its own code", async () => {
    const port = createStubMarketingJourney();
    confirmed(await port.submit(applyRequest("i-1", "ben-0002")));
    expect(kind(await port.submit(applyRequest("i-2", "ben-0002")))).toBe("rejected:DUPLICATE_USE");
    expect(kind(await port.submit(applyRequest("i-3", "ben-0003")))).toBe("rejected:NOT_STACKABLE");
    expect(kind(await port.submit(applyRequest("i-4", "ben-0099")))).toBe("rejected:UNKNOWN_REF");
    expect(kind(await port.submit(applyRequest("i-5", "ben-0001", "ord-0099")))).toBe("rejected:UNKNOWN_REF");
    // The same coupon on the other order is a second use of a benefit allowed once.
    expect(kind(await port.submit(applyRequest("i-6", "ben-0002", "ord-0002")))).toBe("rejected:USAGE_LIMIT_REACHED");
    port.simulate({ control: "cancel-order", orderRef: "ord-0002" });
    expect(kind(await port.submit(applyRequest("i-7", "ben-0001", "ord-0002")))).toBe("rejected:ORDER_NOT_OPEN");
    expect((await snapshotOf(port)).applications).toHaveLength(1);
    expect(port.effects().applies).toBe(1);
  });

  it("rejects an exhausted budget, a taken attribution, and a usage limit at the source", async () => {
    expect(kind(await createStubMarketingJourney().submit(applyRequest("i-1", "ben-0003")))).toBe("rejected:BUDGET_EXHAUSTED");
    const taken = createStubMarketingJourney({ scenario: "attribution-taken" });
    expect(kind(await taken.submit(applyRequest("i-1", "ben-0004")))).toBe("rejected:ATTRIBUTION_TAKEN");
    const used = createStubMarketingJourney({ scenario: "usage-limit" });
    expect(kind(await used.submit(applyRequest("i-1", "ben-0002")))).toBe("rejected:USAGE_LIMIT_REACHED");
    expect(used.effects().applies).toBe(0);
  });

  it("makes eligibility stale when the membership basis moves, and rejects a lapsed tier on the new version", async () => {
    const port = createStubMarketingJourney();
    port.simulate({ control: "lapse-eligibility" });
    const stale = await port.submit(applyRequest("i-1", "ben-0001"));
    expect(kind(stale)).toBe("rejected:ELIGIBILITY_STALE");
    const fresh = await port.submit(applyRequest("i-2", "ben-0001", "ord-0001", { eligibility: 4 }));
    expect(kind(fresh)).toBe("rejected:NOT_ELIGIBLE");
    const after = await snapshotOf(port);
    expect(after.membership).toEqual({ subjectRef: "sub-0001", tier: "fan", version: 4 });
    expect(after.benefits.find((benefit) => benefit.benefitRef === "ben-0001")?.verdict).toBe("not-eligible");
    expect(after.benefits.find((benefit) => benefit.benefitRef === "ben-0002")?.verdict).toBe("eligible");
    // A fan-tier benefit applies on the new version.
    expect(confirmed(await port.submit(applyRequest("i-3", "ben-0002", "ord-0001", { eligibility: 4 }))).eligibilityVersion).toBe(4);
    port.simulate({ control: "lapse-eligibility" });
    port.simulate({ control: "lapse-eligibility" });
    expect(port.simulate({ control: "lapse-eligibility" })).toMatchObject({ kind: "ignored" });
  });

  it("never reuses an authorization after consent is withdrawn: withdrawal, grant, and a new authorization are three steps", async () => {
    const port = createStubMarketingJourney();
    expect(port.simulate({ control: "authorize-marketing" })).toMatchObject({ kind: "ignored" });
    expect(port.simulate({ control: "grant-consent" })).toMatchObject({ kind: "ignored" });
    expect(port.simulate({ control: "withdraw-consent" })).toMatchObject({ kind: "done" });
    expect(port.simulate({ control: "withdraw-consent" })).toMatchObject({ kind: "ignored" });
    let snapshot = await snapshotOf(port);
    expect(snapshot.consent).toMatchObject({ state: "withdrawn", version: 3, authorization: { state: "stale", atVersion: 2 } });
    expect(kind(await port.submit(applyRequest("i-1", "ben-0001", "ord-0001", { consent: 3 })))).toBe("rejected:CONSENT_WITHDRAWN");
    expect(port.simulate({ control: "authorize-marketing" })).toMatchObject({ kind: "ignored" });
    // A benefit that needs no consent is unaffected by the withdrawal.
    expect(confirmed(await port.submit(applyRequest("i-2", "ben-0002", "ord-0001", { consent: 3 }))).consentVersion).toBeNull();

    expect(port.simulate({ control: "grant-consent" })).toMatchObject({ kind: "done" });
    snapshot = await snapshotOf(port);
    expect(snapshot.consent).toMatchObject({ state: "granted", version: 4, authorization: { state: "stale", atVersion: 2 } });
    expect(snapshot.benefits.find((benefit) => benefit.benefitRef === "ben-0001")?.verdict).toBe("authorization-stale");
    // The version the page read is current, and the old authorization is still not reused.
    expect(kind(await port.submit(applyRequest("i-3", "ben-0001", "ord-0001", { consent: 4 })))).toBe("rejected:AUTHORIZATION_STALE");

    expect(port.simulate({ control: "authorize-marketing" })).toMatchObject({ kind: "done" });
    snapshot = await snapshotOf(port);
    expect(snapshot.consent.authorization).toEqual({ state: "valid", atVersion: 4 });
    // A request built on the version before the new authorization is stale on the consent version.
    expect(kind(await port.submit(applyRequest("i-4", "ben-0001", "ord-0001", { consent: 2 })))).toBe("rejected:CONSENT_VERSION_STALE");
    const receipt = confirmed(await port.submit(applyRequest("i-5", "ben-0001", "ord-0001", { consent: 4 })));
    expect(receipt.consentVersion).toBe(4);
    expect(receipt.nonClaims.withdrawnAuthorizationReused).toBe(false);
    // Five writes reached the source, and none of them was a consent command or a message.
    expect(port.effects().submits).toBe(5);
    expect(port.effects().applies).toBe(2);
  });

  it("flags an application that relied on consent withdrawn afterwards, and leaves it for the policy that is not published", async () => {
    const port = createStubMarketingJourney();
    confirmed(await port.submit(applyRequest("i-1", "ben-0001")));
    port.simulate({ control: "withdraw-consent" });
    const snapshot = await snapshotOf(port);
    const application = snapshot.applications[0];
    expect(application).toMatchObject({ state: "applied", consentVersion: 2, consentWithdrawnSince: true, dueReason: null });
    expect(application?.usageRestoration).toBe(MARKETING_UNDETERMINED);
  });

  it("requires consent that was never set", async () => {
    const port = createStubMarketingJourney({ scenario: "consent-unset" });
    expect(kind(await port.submit(applyRequest("i-1", "ben-0001", "ord-0001", { consent: 0 })))).toBe("rejected:CONSENT_REQUIRED");
    expect(port.simulate({ control: "authorize-marketing" })).toMatchObject({ kind: "ignored" });
    port.simulate({ control: "grant-consent" });
    expect((await snapshotOf(port)).consent).toMatchObject({ state: "granted", version: 1, authorization: { state: "none", atVersion: null } });
    expect(kind(await port.submit(applyRequest("i-2", "ben-0001", "ord-0001", { consent: 1 })))).toBe("rejected:AUTHORIZATION_STALE");
    port.simulate({ control: "authorize-marketing" });
    expect(confirmed(await port.submit(applyRequest("i-3", "ben-0001", "ord-0001", { consent: 1 }))).consentVersion).toBe(1);
  });

  it("marks an applied benefit due for reclaim when its order is cancelled or a refund is observed, and moves nothing else", async () => {
    const port = createStubMarketingJourney();
    confirmed(await port.submit(applyRequest("i-1", "ben-0001", "ord-0001")));
    confirmed(await port.submit(applyRequest("i-2", "ben-0002", "ord-0002")));
    expect(port.simulate({ control: "cancel-order", orderRef: "ord-0001" })).toMatchObject({ kind: "done" });
    expect(port.simulate({ control: "refund-order", orderRef: "ord-0002" })).toMatchObject({ kind: "done" });
    expect(port.simulate({ control: "cancel-order", orderRef: "ord-0099" })).toMatchObject({ kind: "ignored" });
    expect(port.simulate({ control: "cancel-order", orderRef: "ord-0001" })).toMatchObject({ kind: "ignored" });
    const snapshot = await snapshotOf(port);
    expect(snapshot.orders.map((order) => order.state)).toEqual(["cancelled", "refund-observed"]);
    expect(snapshot.applications.map((application) => [application.applicationRef, application.state, application.dueReason])).toEqual([
      ["app-0001", "reclaim-due", "order-cancelled"],
      ["app-0002", "reclaim-due", "refund-observed"],
    ]);
    // Nothing was reclaimed, restored, or refunded by the order event itself.
    expect(snapshot.benefits.find((benefit) => benefit.benefitRef === "ben-0001")?.usage.recorded).toBe(1);
    expect(snapshot.benefits.find((benefit) => benefit.benefitRef === "ben-0002")?.budget?.committed).toBe(3);
    expect(port.effects().reclaims).toBe(0);
    // A refund observed after a cancel moves the order and keeps the first reason on the application.
    expect(port.simulate({ control: "refund-order", orderRef: "ord-0001" })).toMatchObject({ kind: "done" });
    const later = await snapshotOf(port);
    expect(later.orders[0]?.state).toBe("refund-observed");
    expect(later.applications[0]).toMatchObject({ state: "reclaim-due", dueReason: "order-cancelled" });
  });

  it("reclaims on request, states the usage restoration as undetermined, and moves no count", async () => {
    const port = createStubMarketingJourney();
    confirmed(await port.submit(applyRequest("i-1", "ben-0002")));
    port.simulate({ control: "cancel-order", orderRef: "ord-0001" });
    const receipt = confirmed(await port.submit(reclaimRequest("i-2", "app-0001")));
    expect(receipt).toMatchObject({ step: "reclaim", applicationRef: "app-0001", state: "reclaimed", usageRestoration: MARKETING_UNDETERMINED });
    expect(Object.values(receipt.nonClaims).every((value) => value === false)).toBe(true);
    const snapshot = await snapshotOf(port);
    expect(snapshot.applications[0]).toMatchObject({ state: "reclaimed", usageRestoration: MARKETING_UNDETERMINED });
    const coupon = snapshot.benefits.find((benefit) => benefit.benefitRef === "ben-0002");
    expect(coupon?.usage).toEqual({ allowed: 1, recorded: 1 });
    expect(coupon?.budget?.committed).toBe(3);
    expect(kind(await port.submit(reclaimRequest("i-3", "app-0001")))).toBe("rejected:ALREADY_RECLAIMED");
    expect(kind(await port.submit(reclaimRequest("i-4", "app-0099")))).toBe("rejected:UNKNOWN_REF");
    expect(port.effects()).toMatchObject({ applies: 1, reclaims: 1 });
  });

  it("refuses an invalid request before any effect", async () => {
    const port = createStubMarketingJourney();
    const cases: [MarketingWriteRequest, string][] = [
      [{ ...applyRequest("", "ben-0001") }, "INTENT"],
      [{ ...applyRequest("i-1", "ben-0001"), contextKey: "" }, "INTENT"],
      [{ ...applyRequest("i-1", "ben-0001"), step: "settle" as unknown as "apply" }, "STEP"],
      [{ ...applyRequest("i-1", "ben-0001"), subjectRef: "sub-1" }, "IDENTITY"],
      [applyRequest("i-1", "ord-0001", "ord-0001"), "IDENTITY"],
      [applyRequest("i-1", "ben-0001", "app-0001"), "IDENTITY"],
      [reclaimRequest("i-1", "ben-0001"), "IDENTITY"],
      [{ ...applyRequest("i-1", "ben-0001"), expectedEligibilityVersion: 1.5 }, "VERSION"],
      [{ ...applyRequest("i-1", "ben-0001"), expectedConsentVersion: Number.NaN }, "VERSION"],
    ];
    for (const [request, code] of cases) {
      const outcome = await port.submit(request);
      expect(outcome, code).toMatchObject({ kind: "invalid-request", code });
    }
    expect(port.effects().submits).toBe(0);
    expect((await snapshotOf(port)).applications).toEqual([]);
  });

  it("is naive: it does not de-duplicate on the intent, so only the client fence keeps a resend from a second effect", async () => {
    const port = createStubMarketingJourney();
    confirmed(await port.submit(applyRequest("same-intent", "ben-0004", "ord-0001")));
    // The same intent on another order is applied again by the source, which is why the client sends once.
    expect(kind(await port.submit(applyRequest("same-intent", "ben-0004", "ord-0002")))).toBe("rejected:USAGE_LIMIT_REACHED");
    expect(port.effects().applies).toBe(1);
    const open = createStubMarketingJourney();
    confirmed(await open.submit(applyRequest("same-intent", "ben-0001", "ord-0001")));
    expect(kind(await open.submit(applyRequest("same-intent", "ben-0001", "ord-0001")))).toBe("rejected:DUPLICATE_USE");
  });
});

describe("marketing fault scenarios", () => {
  it("apply-lost applies the effect and answers unknown, and a repeat would read as a duplicate", async () => {
    const port = createStubMarketingJourney({ scenario: "apply-lost" });
    const outcome = await port.submit(applyRequest("i-1", "ben-0002"));
    expect(outcome).toMatchObject({ kind: "unknown", step: "apply", intentRef: "i-1", contextKey: CTX });
    expect(port.effects().applies).toBe(1);
    expect((await snapshotOf(port)).applications).toHaveLength(1);
    expect(kind(await port.submit(applyRequest("i-2", "ben-0002")))).toBe("rejected:DUPLICATE_USE");
  });

  it("reclaim-lost applies the reclaim and answers unknown", async () => {
    const port = createStubMarketingJourney({ scenario: "reclaim-lost" });
    confirmed(await port.submit(applyRequest("i-1", "ben-0002")));
    expect(await port.submit(reclaimRequest("i-2", "app-0001"))).toMatchObject({ kind: "unknown", step: "reclaim" });
    expect((await snapshotOf(port)).applications[0]?.state).toBe("reclaimed");
    expect(port.effects().reclaims).toBe(1);
  });

  it("duplicate-elsewhere lands another channel's application first, so ours is a duplicate and is not ours", async () => {
    const port = createStubMarketingJourney({ scenario: "duplicate-elsewhere" });
    expect(kind(await port.submit(applyRequest("i-1", "ben-0001")))).toBe("rejected:DUPLICATE_USE");
    const snapshot = await snapshotOf(port);
    expect(snapshot.applications.map((application) => [application.applicationRef, application.channel])).toEqual([["app-0001", "other-channel"]]);
    expect(port.effects().applies).toBe(0);
  });

  it("budget-race exhausts the budget between a read and a write", async () => {
    const port = createStubMarketingJourney({ scenario: "budget-race" });
    expect((await snapshotOf(port)).benefits.find((benefit) => benefit.benefitRef === "ben-0002")?.verdict).toBe("eligible");
    expect(kind(await port.submit(applyRequest("i-1", "ben-0002")))).toBe("rejected:BUDGET_EXHAUSTED");
    expect((await snapshotOf(port)).benefits.find((benefit) => benefit.benefitRef === "ben-0002")?.verdict).toBe("budget-exhausted");
  });

  it("held-response applies the effect now and holds the answer until it is delivered", async () => {
    const port = createStubMarketingJourney({ scenario: "held-response" });
    let settled: MarketingWriteOutcome | null = null;
    const pending = port.submit(applyRequest("i-1", "ben-0002")).then((outcome) => {
      settled = outcome;
    });
    await Promise.resolve();
    expect(settled).toBeNull();
    expect(port.effects().applies).toBe(1);
    expect(port.deliverHeld()).toBe(1);
    await pending;
    expect(settled).toMatchObject({ kind: "confirmed" });
    expect(port.deliverHeld()).toBe(0);
  });

  it("refuses a receipt that claims a reward, after the source recorded the application", async () => {
    const port = createStubMarketingJourney({ scenario: "receipt-claims-reward" });
    const outcome = await port.submit(applyRequest("i-1", "ben-0002"));
    expect(outcome).toMatchObject({ kind: "refused", code: "CLAIM", field: "nonClaims.rewardPaid", step: "apply", intentRef: "i-1" });
    expect(port.effects().applies).toBe(1);
  });

  it("refuses a snapshot whole when it claims a CRM product complete or carries another subject's row", async () => {
    expect(await readOf(createStubMarketingJourney({ scenario: "snapshot-claims-crm" }))).toMatchObject({
      kind: "refused",
      code: "CLAIM",
      field: "nonClaims.crmProductComplete",
    });
    expect(await readOf(createStubMarketingJourney({ scenario: "scope-leak" }))).toMatchObject({
      kind: "refused",
      code: "SCOPE_LEAK",
      ref: "app-0099",
    });
  });

  it("covers every scenario with a port that answers a read", async () => {
    for (const scenario of MARKETING_SCENARIOS) {
      const outcome = await readOf(createStubMarketingJourney({ scenario }));
      expect(["ready", "empty", "stale", "refused", "denied"], scenario).toContain(outcome.kind);
    }
    expect(MARKETING_SYNTHETIC_CONTROLS).toEqual([
      "withdraw-consent",
      "grant-consent",
      "authorize-marketing",
      "lapse-eligibility",
      "cancel-order",
      "refund-order",
    ]);
  });
});

describe("marketing payload validation", () => {
  async function good(): Promise<MarketingSnapshot> {
    return snapshotOf(createStubMarketingJourney({ scenario: "usage-limit" }));
  }

  it("refuses a payload whole when a non-claim is missing or is anything but the literal false", async () => {
    for (const field of MARKETING_NON_CLAIM_FIELDS) {
      const snapshot = await good();
      expect(refuseMarketingSnapshot(snapshot, "sub-0001")).toBeNull();
      for (const value of [true, "false", 0, null, undefined]) {
        const claims = { ...snapshot.nonClaims, [field]: value } as unknown as MarketingSnapshot["nonClaims"];
        expect(refuseMarketingSnapshot({ ...snapshot, nonClaims: claims }, "sub-0001"), `${field} ${String(value)}`).toMatchObject({
          code: "CLAIM",
          field: `nonClaims.${field}`,
        });
      }
      const missing = { ...snapshot.nonClaims } as Record<string, unknown>;
      delete missing[field];
      expect(refuseMarketingSnapshot({ ...snapshot, nonClaims: missing as unknown as MarketingSnapshot["nonClaims"] }, "sub-0001")).toMatchObject({ code: "CLAIM" });
    }
    expect(findMarketingClaim(undefined)).toBe("noticeConfirmsPurchase");
  });

  it("refuses a bad reference, kind, state, count, or subject before any row shows", async () => {
    const snapshot = await good();
    const first = snapshot.benefits[0];
    const order = snapshot.orders[0];
    const application = snapshot.applications[0];
    if (!first || !order || !application) {
      throw new Error("fixture rows are missing");
    }
    const refusal = (patch: Partial<MarketingSnapshot>) => refuseMarketingSnapshot({ ...snapshot, ...patch }, "sub-0001");
    expect(refusal({ benefits: [{ ...first, benefitRef: "ord-0001" }] })).toMatchObject({ code: "REF" });
    expect(refusal({ benefits: [{ ...first, verdict: "paid" as never }] })).toMatchObject({ code: "KIND" });
    expect(refusal({ benefits: [{ ...first, kind: "token" as never }] })).toMatchObject({ code: "KIND" });
    expect(refusal({ benefits: [{ ...first, usage: { allowed: 1, recorded: 1.5 } }] })).toMatchObject({ code: "COUNT" });
    expect(refusal({ benefits: [{ ...first, usage: { allowed: -1, recorded: 0 } }] })).toMatchObject({ code: "COUNT" });
    expect(refusal({ benefits: [{ ...first, budget: { unit: "redemption", limit: 3, committed: 0.5, state: "available" } }] })).toMatchObject({ code: "COUNT" });
    expect(refusal({ benefits: [{ ...first, attribution: { referrerRef: "sub-0002", state: "paid" as never } }] })).toMatchObject({ code: "STATE" });
    expect(refusal({ orders: [{ ...order, state: "delivered" as never }] })).toMatchObject({ code: "STATE" });
    expect(refusal({ orders: [{ ...order, subjectRef: "sub-0002" }] })).toMatchObject({ code: "SCOPE_LEAK" });
    expect(refusal({ applications: [{ ...application, state: "paid" as never }] })).toMatchObject({ code: "STATE" });
    expect(refusal({ applications: [{ ...application, subjectRef: "sub-0002" }] })).toMatchObject({ code: "SCOPE_LEAK" });
    expect(refusal({ applications: [{ ...application, benefitRef: "ben-0099" }] })).toMatchObject({ code: "REF" });
    expect(refusal({ subjectRef: "sub-0002" })).toMatchObject({ code: "SCOPE_LEAK" });
    expect(refusal({ membership: { ...snapshot.membership, tier: "gold" as never } })).toMatchObject({ code: "STATE" });
    expect(refusal({ consent: { ...snapshot.consent, state: "pending" as never } })).toMatchObject({ code: "STATE" });
    expect(refusal({ consent: { ...snapshot.consent, version: 1.5 } })).toMatchObject({ code: "COUNT" });
  });

  it("refuses a valid authorization beside consent that is not granted, and an application that states a restoration policy", async () => {
    const snapshot = await good();
    const application = snapshot.applications[0];
    if (!application) {
      throw new Error("fixture rows are missing");
    }
    for (const state of ["withdrawn", "unset"] as const) {
      expect(
        refuseMarketingSnapshot({ ...snapshot, consent: { ...snapshot.consent, state, authorization: { state: "valid", atVersion: snapshot.consent.version } } }, "sub-0001"),
        state,
      ).toMatchObject({ code: "STATE", field: "consent.authorization" });
    }
    // A stale or absent authorization beside withdrawn consent is the honest shape.
    expect(
      refuseMarketingSnapshot({ ...snapshot, consent: { ...snapshot.consent, state: "withdrawn", authorization: { state: "stale", atVersion: 2 } } }, "sub-0001"),
    ).toBeNull();
    expect(refuseMarketingSnapshot({ ...snapshot, applications: [{ ...application, usageRestoration: "restored" as never }] }, "sub-0001")).toMatchObject({
      code: "STATE",
      field: "applications[].usageRestoration",
    });
  });

  it("refuses a receipt that names another step, another application, or a restoration policy it cannot state", async () => {
    const request = applyRequest("i-1", "ben-0002");
    const receipt = confirmed(await createStubMarketingJourney().submit(request));
    expect(refuseMarketingReceipt(receipt, request)).toBeNull();
    expect(refuseMarketingReceipt({ ...receipt, step: "reclaim" }, request)).toMatchObject({ code: "KIND" });
    expect(refuseMarketingReceipt({ ...receipt, benefitRef: "ben-0001" }, request)).toMatchObject({ code: "REF" });
    expect(refuseMarketingReceipt({ ...receipt, orderRef: "ord-0002" }, request)).toMatchObject({ code: "REF" });
    expect(refuseMarketingReceipt({ ...receipt, applicationRef: "ord-0001" }, request)).toMatchObject({ code: "REF" });
    expect(refuseMarketingReceipt({ ...receipt, usageRestoration: "restored" }, request)).toMatchObject({ code: "STATE", field: "usageRestoration" });
    expect(refuseMarketingReceipt({ ...receipt, state: "reclaimed" }, request)).toMatchObject({ code: "STATE", field: "state" });
    const reclaim = reclaimRequest("i-2", "app-0001");
    expect(refuseMarketingReceipt({ ...receipt, step: "reclaim", state: "reclaimed", applicationRef: "app-0002" }, reclaim)).toMatchObject({ code: "REF" });
    const claim = { ...receipt, nonClaims: { ...receipt.nonClaims, discountApplied: true } } as unknown as MarketingReceipt;
    expect(refuseMarketingReceipt(claim, request)).toMatchObject({ code: "CLAIM", field: "nonClaims.discountApplied" });
  });
});

describe("marketing source", () => {
  it("sends nothing, reads no clock, uses no randomness, posts no consent command, and names no money posting", () => {
    for (const file of ["marketing-journey.ts", "marketing-journey-controller.ts"]) {
      const source = readFileSync(path.join(here, "../src", file), "utf8");
      for (const token of [
        "fetch(",
        "XMLHttpRequest",
        "Date.now(",
        "new Date(",
        "Math.random(",
        "setTimeout",
        "setInterval",
        "capture",
        "settle_capture",
        "invokeLocalCall",
        "Idempotency-Key",
        "retry",
        "fallback",
        "Number(",
        "parseInt",
        "BigInt",
        ".reduce(",
        "localStorage",
        "sessionStorage",
      ]) {
        expect(source, `${file} ${token}`).not.toContain(token);
      }
    }
  });
});
