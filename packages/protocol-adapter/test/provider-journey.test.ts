import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  DISCOVERY_READ_TUPLE_LITERALS,
  PINNED_ACTIONS,
  PROVIDER_DESK_ACTOR,
  PROVIDER_GUEST_ACTOR,
  PROVIDER_HOLD_NOT_BOUND,
  PROVIDER_IDENTITY_REGISTER,
  PROVIDER_JOURNEY_RULING,
  PROVIDER_NON_CLAIM_FIELDS,
  PROVIDER_NOT_BOUND_REASON,
  PROVIDER_NOT_COMPOSED,
  PROVIDER_REF_KINDS,
  PROVIDER_SANDBOX,
  PROVIDER_SCENARIOS,
  PROVIDER_STALE_FLOOR,
  PROVIDER_STEPS,
  PROVIDER_UNIT,
  createNotBoundProviderJourney,
  createStubProviderJourney,
  isProviderRef,
  providerJourneyPortFor,
  providerRef,
  providerRefKind,
  refuseProviderReceipt,
  refuseProviderSnapshot,
  type ProviderReadOutcome,
  type ProviderSnapshot,
  type ProviderWriteOutcome,
  type ProviderWriteRequest,
  type StubProviderJourney,
} from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

const CTX = "stub|kix|provider-buyer|1";

function base(intentRef: string) {
  return { contextKey: CTX, actorRef: PROVIDER_DESK_ACTOR, intentRef, declaredEnvironment: PROVIDER_SANDBOX };
}

async function snapshotOf(port: StubProviderJourney, actorRef = PROVIDER_DESK_ACTOR): Promise<ProviderSnapshot> {
  const outcome = await port.read({ contextKey: CTX, actorRef, watermarkFloor: null });
  if (outcome.kind !== "ready") {
    throw new Error(`expected a ready read, received ${outcome.kind}`);
  }
  return outcome.snapshot;
}

function beginRequest(intentRef: string, orderRef = "ord-0001", version = 4, actorRef = PROVIDER_DESK_ACTOR): ProviderWriteRequest {
  return { ...base(intentRef), actorRef, step: "begin", orderRef, expectedVersion: version };
}

function observeRequest(intentRef: string, checkoutRef: string, orderRef = "ord-0001", version = 6): ProviderWriteRequest {
  return { ...base(intentRef), step: "observe", orderRef, checkoutRef, expectedVersion: version };
}

function issueRequest(intentRef: string, checkoutRef: string, orderRef = "ord-0001", version = 7): ProviderWriteRequest {
  return { ...base(intentRef), step: "issue", orderRef, checkoutRef, expectedVersion: version };
}

function refundRequest(intentRef: string, paymentRef: string, orderRef = "ord-0001", version = 8): ProviderWriteRequest {
  return { ...base(intentRef), step: "refund", orderRef, paymentRef, expectedVersion: version };
}

function kind(outcome: ProviderWriteOutcome): string {
  return outcome.kind === "rejected" ? `rejected:${outcome.code}` : outcome.kind;
}

/** Runs the clean chain to an observed payment. Returns the checkout and payment refs. */
async function toObserved(port: StubProviderJourney): Promise<{ checkoutRef: string; paymentRef: string }> {
  const began = await port.submit(beginRequest("begin"));
  if (began.kind !== "confirmed" || began.refs.checkoutRef === null) {
    throw new Error("expected a confirmed begin");
  }
  const checkoutRef = began.refs.checkoutRef;
  const returned = port.deliverReturn(checkoutRef);
  if (returned === null) {
    throw new Error("expected a return landing");
  }
  const callback = port.deliverCallback(checkoutRef);
  if (callback === null || callback.result !== "observed") {
    throw new Error("expected an observed callback");
  }
  const observed = await port.submit(observeRequest("observe", checkoutRef, "ord-0001", 7));
  if (observed.kind !== "confirmed" || observed.refs.paymentRef === null) {
    throw new Error("expected a confirmed observe");
  }
  return { checkoutRef, paymentRef: observed.refs.paymentRef };
}

describe("provider identity register", () => {
  const pin = JSON.parse(
    readFileSync(path.join(repoRoot, "packages/protocol-adapter/vendor/kix-protocol.contract-only.openapi.json"), "utf8"),
  ) as { components: { schemas: Record<string, { properties?: Record<string, unknown> }> } };

  it("names a published body field only where the pin has it, and says not-bound where it has none", () => {
    expect(new Set(PROVIDER_IDENTITY_REGISTER.map((row) => row.id)).size).toBe(PROVIDER_IDENTITY_REGISTER.length);
    for (const row of PROVIDER_IDENTITY_REGISTER) {
      expect(row.reason.length, row.id).toBeGreaterThan(20);
      if (row.status === "field-named") {
        expect(row.bodyFields.length, row.id).toBeGreaterThan(0);
        for (const entry of row.bodyFields) {
          expect(PINNED_ACTIONS as readonly string[], `${row.id} ${entry.action}`).toContain(entry.action);
          const schema = pin.components.schemas[entry.action];
          expect(schema?.properties, `${row.id} ${entry.action}`).toBeDefined();
          expect(Object.keys(schema?.properties ?? {}), `${row.id} ${entry.action}.${entry.field}`).toContain(entry.field);
        }
      } else {
        expect(row.bodyFields, row.id).toEqual([]);
      }
    }
    const status = Object.fromEntries(PROVIDER_IDENTITY_REGISTER.map((row) => [row.id, row.status]));
    expect(status).toEqual({
      order: "not-bound",
      checkout: "not-bound",
      return: "not-bound",
      callback: "not-bound",
      payment: "not-bound",
      issuance: "not-bound",
      right: "field-named",
      refund: "not-bound",
      version: "field-named",
      amount: "not-bound",
    });
  });

  it("backs each not-bound reason with the pin", () => {
    const withField = (field: string) =>
      Object.entries(pin.components.schemas)
        .filter(([, schema]) => schema.properties && field in schema.properties)
        .map(([name]) => name)
        .sort();
    // A payment id is named only by money-posting and payment-effect commands. Each of them also
    // carries an amount and a currency, and this journey composes none of them.
    const paymentActions = withField("paymentId");
    expect(paymentActions).toEqual([
      "adjust_pg_cancel",
      "capture",
      "finalize_effect",
      "observe_effect",
      "observe_return",
      "settle_capture",
    ]);
    for (const action of paymentActions) {
      const names = Object.keys(pin.components.schemas[action]?.properties ?? {});
      expect(names, action).toContain("amount");
      expect(names, action).toContain("currency");
    }
    // The only order id in the pin sits on the money posting, which is never composed.
    expect(withField("orderId")).toEqual(["capture"]);
    // No checkout, return-landing, callback, issuance, or refund id exists in any pinned body.
    for (const field of ["checkoutId", "returnId", "callbackId", "issuanceId", "refundId"]) {
      expect(withField(field), field).toEqual([]);
    }
    // refund_ticket is pinned, and its body names a right and a version only.
    expect(Object.keys(pin.components.schemas.refund_ticket?.properties ?? {}).sort()).toEqual([
      "domain",
      "expectedVersion",
      "ticketId",
    ]);
    const composed = PROVIDER_STEPS as readonly string[];
    for (const action of PINNED_ACTIONS) {
      expect(composed).not.toContain(action);
    }
  });

  it("records the not-composed commands and the locked hold binding without remapping them", () => {
    expect(PROVIDER_NOT_COMPOSED.map((entry) => entry.action)).toEqual([
      "capture",
      "settle_capture",
      "commit_trade",
      "open_admission",
      "admit",
      "refund_ticket",
      "adjust_pg_cancel",
      "finalize_effect",
      "observe_effect",
      "observe_return",
    ]);
    for (const entry of PROVIDER_NOT_COMPOSED) {
      expect(entry.reason, entry.action).toContain(PROVIDER_JOURNEY_RULING);
    }
    expect(PROVIDER_JOURNEY_RULING).toBe("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
    expect(PROVIDER_HOLD_NOT_BOUND.consideredAction).toBe("reserve_listing");
    expect(PROVIDER_HOLD_NOT_BOUND.status).toBe("not-bound");
    expect(PROVIDER_HOLD_NOT_BOUND.reason).toBe(COMMERCE_COMMAND_BINDINGS.placeHold.reason);
    expect(PROVIDER_HOLD_NOT_BOUND.mappedOntoPrepareTrade).toBe(false);
    const bindings = readFileSync(path.join(repoRoot, "packages/protocol-adapter/src/commerce-bindings.ts"));
    expect(createHash("sha256").update(bindings).digest("hex")).toBe(
      "83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249",
    );
  });
});

describe("provider references", () => {
  it("gives every kind its own prefix and never reads one kind as another", () => {
    const refs = PROVIDER_REF_KINDS.map((refKind) => providerRef(refKind, 12));
    expect(new Set(refs).size).toBe(PROVIDER_REF_KINDS.length);
    for (const refKind of PROVIDER_REF_KINDS) {
      const ref = providerRef(refKind, 7);
      expect(providerRefKind(ref)).toBe(refKind);
      for (const other of PROVIDER_REF_KINDS) {
        expect(isProviderRef(ref, other)).toBe(other === refKind);
      }
    }
    expect(providerRef("checkout", 3)).toBe("cko-0003");
    expect(providerRefKind("cko-3")).toBeNull();
    expect(providerRefKind("payment-0003")).toBeNull();
    expect(isProviderRef(7, "checkout")).toBe(false);
  });
});

describe("provider port selection", () => {
  it("serves the synthetic source on stub and a not-bound port on integration-http with no stub switch", async () => {
    const stub = providerJourneyPortFor("stub");
    expect(stub.environment).toBe("stub");
    expect(stub.source).toBe("synthetic-provider");
    const bound = providerJourneyPortFor("integration-http", { scenario: "clean" });
    expect(bound.environment).toBe("integration-http");
    expect(bound.source).toBe("none");
    expect(bound.scenario).toBe("clean");
    expect(await bound.read({ contextKey: CTX, actorRef: PROVIDER_DESK_ACTOR, watermarkFloor: null })).toEqual({
      kind: "not-bound",
      reason: PROVIDER_NOT_BOUND_REASON,
    });
    expect(await bound.submit(beginRequest("intent-1"))).toEqual({ kind: "not-bound", reason: PROVIDER_NOT_BOUND_REASON });
    expect(bound.deliverReturn("cko-0001")).toBeNull();
    expect(bound.deliverCallback("cko-0001")).toBeNull();
    expect(bound.markAbandoned("cko-0001")).toBeNull();
    expect(bound.deliverHeld()).toBe(0);
    expect(bound.deliverLate()).toEqual([]);
    expect(createNotBoundProviderJourney().source).toBe("none");
    expect(PROVIDER_NOT_BOUND_REASON).toContain("not-bound on integration-http");
  });
});

describe("provider read", () => {
  it("reads two orders on the sandbox with a qualified account and every non-claim false", async () => {
    const snapshot = await snapshotOf(createStubProviderJourney());
    expect(snapshot.orders.map((item) => [item.orderRef, item.amount, item.version])).toEqual([
      ["ord-0001", "1200", 4],
      ["ord-0002", null, 2],
    ]);
    expect(snapshot.orders[0]?.currency).toBe(PROVIDER_UNIT);
    expect(snapshot.orders[0]?.checkout).toBeNull();
    expect(snapshot.orders[0]?.payment.state).toBe("none");
    expect(snapshot.environment).toEqual({
      providerEnvironment: "sandbox",
      account: { actorRef: PROVIDER_DESK_ACTOR, qualification: "sandbox-qualified" },
    });
    for (const field of PROVIDER_NON_CLAIM_FIELDS) {
      expect(snapshot.nonClaims[field], field).toBe(false);
    }
    expect(snapshot.snapshotId).toBe(1);
  });

  it("reports the guest actor unqualified, and serves empty and stale as their own outcomes", async () => {
    const guest = await snapshotOf(createStubProviderJourney(), PROVIDER_GUEST_ACTOR);
    expect(guest.environment.account).toEqual({ actorRef: PROVIDER_GUEST_ACTOR, qualification: "unqualified" });
    const empty = await createStubProviderJourney({ scenario: "empty" }).read({ contextKey: CTX, actorRef: PROVIDER_DESK_ACTOR, watermarkFloor: null });
    expect(empty).toMatchObject({ kind: "empty" });
    const stale = await createStubProviderJourney({ scenario: "stale" }).read({ contextKey: CTX, actorRef: PROVIDER_DESK_ACTOR, watermarkFloor: null });
    expect(stale).toMatchObject({ kind: "stale", floor: PROVIDER_STALE_FLOOR });
    const floored = await createStubProviderJourney().read({ contextKey: CTX, actorRef: PROVIDER_DESK_ACTOR, watermarkFloor: "2026-10-14T00:00:00.000Z" });
    expect(floored.kind).toBe("stale");
  });

  it("checks the pin tuple before any read or effect", async () => {
    const changed = { ...DISCOVERY_READ_TUPLE_LITERALS, protocolMergeSha: "0".repeat(40) };
    const port = createStubProviderJourney({ expectedTuple: changed });
    const read = await port.read({ contextKey: CTX, actorRef: PROVIDER_DESK_ACTOR, watermarkFloor: null });
    expect(read).toMatchObject({ kind: "tuple-changed", field: "protocolMergeSha" });
    const write = await port.submit(beginRequest("intent-1"));
    expect(write).toMatchObject({ kind: "tuple-changed", field: "protocolMergeSha", intentRef: "intent-1" });
    expect(port.effects()).toEqual({
      submits: 0,
      begins: 0,
      returns: 0,
      callbacks: 0,
      abandons: 0,
      observations: 0,
      issues: 0,
      refunds: 0,
    });
  });

  it("covers every scenario with a port that answers a read", async () => {
    for (const scenario of PROVIDER_SCENARIOS) {
      const outcome: ProviderReadOutcome = await createStubProviderJourney({ scenario }).read({
        contextKey: CTX,
        actorRef: PROVIDER_DESK_ACTOR,
        watermarkFloor: null,
      });
      expect(["ready", "empty", "stale", "refused"], scenario).toContain(outcome.kind);
    }
    // Only claims-real refuses the read; production-claimed still answers with a declared environment.
    const production = await createStubProviderJourney({ scenario: "production-claimed" }).read({
      contextKey: CTX,
      actorRef: PROVIDER_DESK_ACTOR,
      watermarkFloor: null,
    });
    expect(production.kind).toBe("ready");
    if (production.kind === "ready") {
      expect(production.snapshot.environment.providerEnvironment).toBe("production");
    }
  });
});

describe("provider writes on the synthetic source", () => {
  it("links redirect, return, observation, issuance, and refund by receipt, five separate lines", async () => {
    const port = createStubProviderJourney();
    const began = await port.submit(beginRequest("begin"));
    expect(began).toMatchObject({ kind: "confirmed", step: "begin", refs: { orderRef: "ord-0001", checkoutRef: "cko-0001" } });
    let snapshot = await snapshotOf(port);
    expect(snapshot.orders[0]?.checkout).toEqual({ checkoutRef: "cko-0001", state: "open", returnRef: null });
    expect(snapshot.orders[0]?.version).toBe(5);

    // The buyer lands on the return URL. The return alone is not a payment observation.
    expect(port.deliverReturn("cko-0001")).toEqual({ checkoutRef: "cko-0001", orderRef: "ord-0001", returnRef: "ret-0001" });
    snapshot = await snapshotOf(port);
    expect(snapshot.orders[0]?.checkout?.state).toBe("returned");
    expect(snapshot.orders[0]?.payment).toMatchObject({ state: "pending", paymentRef: null });
    expect(kind(await port.submit(observeRequest("early", "cko-0001", "ord-0001", 6)))).toBe("rejected:PAYMENT_PENDING");

    // The provider's own report arrives. Only then does observe confirm the observation.
    expect(port.deliverCallback("cko-0001")).toMatchObject({ result: "observed", callbackRef: "cbk-0001" });
    const observed = await port.submit(observeRequest("observe", "cko-0001", "ord-0001", 7));
    expect(observed).toMatchObject({
      kind: "confirmed",
      step: "observe",
      refs: { paymentRef: "psp-0001", callbackRef: "cbk-0001" },
    });
    snapshot = await snapshotOf(port);
    expect(snapshot.orders[0]?.payment).toMatchObject({ state: "observed", paymentRef: "psp-0001" });
    expect(Object.keys(snapshot.orders[0] ?? {})).not.toContain("paid");
    expect(Object.keys(snapshot.orders[0] ?? {})).not.toContain("complete");

    const issued = await port.submit(issueRequest("issue", "cko-0001", "ord-0001", 8));
    expect(issued).toMatchObject({ kind: "confirmed", step: "issue", refs: { issuanceRef: "iss-0001", rightRef: "rgt-0001" } });
    const refunded = await port.submit(refundRequest("refund", "psp-0001", "ord-0001", 9));
    expect(refunded).toMatchObject({ kind: "confirmed", step: "refund", refs: { refundRef: "rfd-0001", paymentRef: "psp-0001" } });
    snapshot = await snapshotOf(port);
    expect(snapshot.orders[0]?.issuance).toMatchObject({ state: "issued", issuanceRef: "iss-0001", rightRef: "rgt-0001" });
    expect(snapshot.orders[0]?.refund).toMatchObject({ state: "recorded", refundRef: "rfd-0001", executed: false });
    expect(port.effects()).toMatchObject({ begins: 1, returns: 1, callbacks: 1, observations: 1, issues: 1, refunds: 1 });
    // Every confirmed answer states the non-claims as false.
    for (const outcome of [began, observed, issued, refunded]) {
      if (outcome.kind === "confirmed") {
        for (const field of PROVIDER_NON_CLAIM_FIELDS) {
          expect(outcome.nonClaims[field], field).toBe(false);
        }
      }
    }
  });

  it("never treats a return landing as success, and rejects every order of events that is out of order", async () => {
    const port = createStubProviderJourney();
    await port.submit(beginRequest("begin"));
    // Observe before any return: the checkout is still open.
    expect(kind(await port.submit(observeRequest("too-early", "cko-0001", "ord-0001", 5)))).toBe("rejected:CHECKOUT_OPEN");
    port.deliverReturn("cko-0001");
    // Issue before any observation.
    expect(kind(await port.submit(issueRequest("issue-early", "cko-0001", "ord-0001", 6)))).toBe("rejected:PAYMENT_NOT_OBSERVED");
    // Refund before any observation.
    expect(kind(await port.submit(refundRequest("refund-early", "psp-0001", "ord-0001", 6)))).toBe("rejected:REFUND_UNAVAILABLE");
    port.deliverCallback("cko-0001");
    await port.submit(observeRequest("observe", "cko-0001", "ord-0001", 7));
    // Refund with the wrong payment reference.
    expect(kind(await port.submit(refundRequest("refund-wrong", "psp-0009", "ord-0001", 8)))).toBe("rejected:REFUND_UNAVAILABLE");
    await port.submit(issueRequest("issue", "cko-0001", "ord-0001", 8));
    expect(kind(await port.submit(issueRequest("issue-again", "cko-0001", "ord-0001", 9)))).toBe("rejected:ALREADY_ISSUED");
    await port.submit(refundRequest("refund", "psp-0001", "ord-0001", 9));
    expect(kind(await port.submit(refundRequest("refund-again", "psp-0001", "ord-0001", 10)))).toBe("rejected:ALREADY_REFUNDED");
    expect(port.effects()).toMatchObject({ observations: 1, issues: 1, refunds: 1 });
  });

  it("rejects stale versions, unknown or foreign references, and writes from an unqualified actor", async () => {
    const port = createStubProviderJourney();
    expect(kind(await port.submit(beginRequest("v", "ord-0001", 3)))).toBe("rejected:VERSION_STALE");
    expect(kind(await port.submit(beginRequest("u", "ord-0099", 4)))).toBe("rejected:UNKNOWN_REF");
    expect(kind(await port.submit(beginRequest("g", "ord-0001", 4, PROVIDER_GUEST_ACTOR)))).toBe("rejected:ACCOUNT_UNQUALIFIED");
    await port.submit(beginRequest("begin"));
    expect(kind(await port.submit(beginRequest("second", "ord-0001", 5)))).toBe("confirmed");
    // The naive source opened a second checkout on the same order. Only a client fence prevents it.
    expect(port.effects().begins).toBe(2);
    expect(kind(await port.submit(observeRequest("x", "cko-0002", "ord-0002", 2)))).toBe("rejected:IDENTITY_MISMATCH");
    expect(kind(await port.submit(observeRequest("y", "ord-0001" as unknown as string, "ord-0001", 5)))).toBe("invalid-request");
    expect((await snapshotOf(port)).orders[0]?.checkout?.checkoutRef).toBe("cko-0002");
  });

  it("refuses an invalid request before any effect, including a declared environment that is not sandbox", async () => {
    const port = createStubProviderJourney();
    const cases: [string, ProviderWriteRequest][] = [
      ["INTENT", { ...beginRequest(""), intentRef: " " } as ProviderWriteRequest],
      ["STEP", { ...beginRequest("s"), step: "capture" } as unknown as ProviderWriteRequest],
      ["ENVIRONMENT", { ...beginRequest("prod"), declaredEnvironment: "production" } as ProviderWriteRequest],
      ["VERSION", { ...beginRequest("v"), expectedVersion: 4.5 } as ProviderWriteRequest],
      ["IDENTITY", { ...beginRequest("i"), orderRef: "cko-0001" } as ProviderWriteRequest],
      ["IDENTITY", { ...observeRequest("i2", "ord-0001") } as ProviderWriteRequest],
      ["IDENTITY", { ...refundRequest("i3", "ord-0001") } as ProviderWriteRequest],
    ];
    for (const [code, request] of cases) {
      const outcome = await port.submit(request);
      expect(outcome, code).toMatchObject({ kind: "invalid-request", code });
    }
    expect(port.effects()).toMatchObject({ begins: 0, observations: 0, issues: 0, refunds: 0 });
  });

  it("is naive: a repeated intent is applied again, so only a client fence prevents a second effect", async () => {
    const port = createStubProviderJourney();
    await port.submit(beginRequest("same"));
    await port.submit(beginRequest("same", "ord-0001", 5));
    expect(port.effects().begins).toBe(2);
    // One intent opened two checkouts. The client fence exists to stop exactly this.
    const snapshot = await snapshotOf(port);
    expect(snapshot.orders[0]?.checkout?.checkoutRef).toBe("cko-0002");
  });
});

describe("provider fault scenarios", () => {
  it("provider-error refuses the begin and opens nothing", async () => {
    const port = createStubProviderJourney({ scenario: "provider-error" });
    expect(kind(await port.submit(beginRequest("begin")))).toBe("rejected:PROVIDER_ERROR");
    expect((await snapshotOf(port)).orders[0]?.checkout).toBeNull();
    expect(port.effects().begins).toBe(0);
  });

  it("return-only lands the buyer and never reports, so every observe stays pending", async () => {
    const port = createStubProviderJourney({ scenario: "return-only" });
    await port.submit(beginRequest("begin"));
    port.deliverReturn("cko-0001");
    expect(port.deliverCallback("cko-0001")).toBeNull();
    expect(kind(await port.submit(observeRequest("observe", "cko-0001", "ord-0001", 6)))).toBe("rejected:PAYMENT_PENDING");
    expect((await snapshotOf(port)).orders[0]?.payment.state).toBe("pending");
    expect(port.effects().observations).toBe(0);
  });

  it("declined reports a decline through the callback and observe stays a rejection", async () => {
    const port = createStubProviderJourney({ scenario: "declined" });
    await port.submit(beginRequest("begin"));
    port.deliverReturn("cko-0001");
    expect(port.deliverCallback("cko-0001")).toMatchObject({ result: "declined" });
    expect(kind(await port.submit(observeRequest("observe", "cko-0001", "ord-0001", 7)))).toBe("rejected:PAYMENT_DECLINED");
    expect((await snapshotOf(port)).orders[0]?.payment.state).toBe("declined");
  });

  it("markAbandoned closes the checkout and observe reports the abandonment", async () => {
    const port = createStubProviderJourney();
    await port.submit(beginRequest("begin"));
    expect(port.markAbandoned("cko-0001")).toEqual({ checkoutRef: "cko-0001", orderRef: "ord-0001" });
    expect(port.deliverReturn("cko-0001")).toBeNull();
    expect(kind(await port.submit(observeRequest("observe", "cko-0001", "ord-0001", 6)))).toBe("rejected:CHECKOUT_ABANDONED");
    expect((await snapshotOf(port)).orders[0]?.checkout?.state).toBe("abandoned");
    // A buyer who left after the return lands the same way.
    const second = createStubProviderJourney();
    await second.submit(beginRequest("begin", "ord-0002", 2));
    second.deliverReturn("cko-0001");
    expect(second.markAbandoned("cko-0001")).toMatchObject({ orderRef: "ord-0002" });
    expect(kind(await second.submit(observeRequest("observe", "cko-0001", "ord-0002", 5)))).toBe("rejected:CHECKOUT_ABANDONED");
  });

  it("unqualified reports the desk actor unqualified and rejects every write", async () => {
    const port = createStubProviderJourney({ scenario: "unqualified" });
    const snapshot = await snapshotOf(port);
    expect(snapshot.environment.account.qualification).toBe("unqualified");
    expect(kind(await port.submit(beginRequest("begin")))).toBe("rejected:ACCOUNT_UNQUALIFIED");
    expect(port.effects().begins).toBe(0);
  });

  it("production-claimed declares production and refuses every write at the source", async () => {
    const port = createStubProviderJourney({ scenario: "production-claimed" });
    const outcome = await port.submit(beginRequest("begin"));
    expect(outcome).toMatchObject({ kind: "invalid-request", code: "ENVIRONMENT" });
    expect(port.effects().begins).toBe(0);
  });

  it("claims-real refuses the whole read payload before a row is shown", async () => {
    const port = createStubProviderJourney({ scenario: "claims-real" });
    const read = await port.read({ contextKey: CTX, actorRef: PROVIDER_DESK_ACTOR, watermarkFloor: null });
    expect(read).toMatchObject({ kind: "refused", code: "CLAIM", field: "realPayment" });
  });

  it("receipt-claims confirms a begin whose answer claims a real payment, and the answer is untrusted", async () => {
    const port = createStubProviderJourney({ scenario: "receipt-claims" });
    const read = await port.read({ contextKey: CTX, actorRef: PROVIDER_DESK_ACTOR, watermarkFloor: null });
    expect(read.kind).toBe("ready");
    const receipt = await port.submit(beginRequest("begin"));
    expect(receipt.kind).toBe("confirmed");
    if (receipt.kind === "confirmed") {
      expect(receipt.nonClaims.realPayment).toBe(true);
      expect(refuseProviderReceipt(receipt.nonClaims)).toMatchObject({
        kind: "refused",
        code: "CLAIM",
        field: "realPayment",
      });
    }
  });

  it("begin-lost opens the checkout and answers unknown; a repeat reads as stale", async () => {
    const port = createStubProviderJourney({ scenario: "begin-lost" });
    expect(await port.submit(beginRequest("begin"))).toMatchObject({ kind: "unknown", step: "begin" });
    const snapshot = await snapshotOf(port);
    expect(snapshot.orders[0]?.checkout?.checkoutRef).toBe("cko-0001");
    expect(port.effects().begins).toBe(1);
    // A repeat reads as a plain rejection while the first one did apply. That is why an unknown write is not resent.
    expect(kind(await port.submit(beginRequest("begin-again")))).toBe("rejected:VERSION_STALE");
  });

  it("observe-lost records the observation and answers unknown", async () => {
    const port = createStubProviderJourney({ scenario: "observe-lost" });
    await toObservedBegin(port);
    expect(await port.submit(observeRequest("observe", "cko-0001", "ord-0001", 7))).toMatchObject({ kind: "unknown", step: "observe" });
    expect((await snapshotOf(port)).orders[0]?.payment.state).toBe("observed");
    expect(port.effects().observations).toBe(1);
  });

  it("observe-late answers unknown now and queues a late result for an explicit delivery", async () => {
    const port = createStubProviderJourney({ scenario: "observe-late" });
    await toObservedBegin(port);
    expect(await port.submit(observeRequest("observe", "cko-0001", "ord-0001", 7))).toMatchObject({ kind: "unknown" });
    expect(port.deliverLate()).toEqual([
      { intentRef: "observe", contextKey: CTX, step: "observe", result: "confirmed", code: null },
    ]);
    expect(port.deliverLate()).toEqual([]);

    const declined = createStubProviderJourney({ scenario: "observe-late", lateResult: "rejected" });
    await toObservedBegin(declined);
    expect(await declined.submit(observeRequest("observe", "cko-0001", "ord-0001", 7))).toMatchObject({ kind: "unknown" });
    expect(declined.deliverLate()).toEqual([
      { intentRef: "observe", contextKey: CTX, step: "observe", result: "rejected", code: "PAYMENT_DECLINED" },
    ]);
  });

  it("issue-lost records the issuance and answers unknown", async () => {
    const port = createStubProviderJourney({ scenario: "issue-lost" });
    const { checkoutRef } = await toObserved(port);
    expect(await port.submit(issueRequest("issue", checkoutRef, "ord-0001", 8))).toMatchObject({ kind: "unknown", step: "issue" });
    expect((await snapshotOf(port)).orders[0]?.issuance.state).toBe("issued");
    expect(port.effects().issues).toBe(1);
  });

  it("refund-lost records the refund and answers unknown", async () => {
    const port = createStubProviderJourney({ scenario: "refund-lost" });
    const { checkoutRef, paymentRef } = await toObserved(port);
    await port.submit(issueRequest("issue", checkoutRef, "ord-0001", 8));
    expect(await port.submit(refundRequest("refund", paymentRef, "ord-0001", 9))).toMatchObject({ kind: "unknown", step: "refund" });
    expect((await snapshotOf(port)).orders[0]?.refund.state).toBe("recorded");
    expect(port.effects().refunds).toBe(1);
  });

  it("held-response applies the effect now and holds the answer until it is delivered", async () => {
    const port = createStubProviderJourney({ scenario: "held-response" });
    let settled = false;
    const pending = port.submit(beginRequest("begin")).then((outcome) => {
      settled = true;
      return outcome;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(port.effects().begins).toBe(1);
    expect(port.deliverHeld()).toBe(1);
    expect(await pending).toMatchObject({ kind: "confirmed" });
    expect(port.deliverHeld()).toBe(0);
  });
});

/** begin + return + callback on a fresh port, leaving the order ready to observe at version 7. */
async function toObservedBegin(port: StubProviderJourney): Promise<void> {
  const began = await port.submit(beginRequest("begin"));
  if (began.kind !== "confirmed" || began.refs.checkoutRef === null) {
    throw new Error("expected a confirmed begin");
  }
  port.deliverReturn(began.refs.checkoutRef);
  port.deliverCallback(began.refs.checkoutRef);
}

describe("provider payload validation", () => {
  it("refuses a malformed, foreign-kind, wrong-unit, claimed, or executed payload whole", async () => {
    const clean = await snapshotOf(createStubProviderJourney());
    const order = clean.orders[0];
    if (!order) {
      throw new Error("expected an order");
    }
    const bad: [string, ProviderSnapshot][] = [
      ["orderRef", { ...clean, orders: [{ ...order, orderRef: "order-0001" }] }],
      ["amount", { ...clean, orders: [{ ...order, amount: "12.5" }] }],
      ["amount", { ...clean, orders: [{ ...order, currency: "KRW" }] }],
      ["version", { ...clean, orders: [{ ...order, version: 1.5 }] }],
      [
        "realPayment",
        {
          ...clean,
          nonClaims: { ...clean.nonClaims, realPayment: true } as unknown as ProviderSnapshot["nonClaims"],
        },
      ],
    ];
    for (const [field, snapshot] of bad) {
      expect(refuseProviderSnapshot(snapshot), field).toMatchObject({ kind: "refused", code: "CLAIM", field });
    }
    expect(refuseProviderSnapshot(clean)).toBeNull();
  });
});

describe("provider source", () => {
  it("sends nothing, reads no clock, uses no randomness, and names no money posting", () => {
    for (const file of ["provider-journey.ts", "provider-controller.ts"]) {
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
        "retry(",
      ]) {
        expect(source, `${file} ${token}`).not.toContain(token);
      }
    }
  });
});
