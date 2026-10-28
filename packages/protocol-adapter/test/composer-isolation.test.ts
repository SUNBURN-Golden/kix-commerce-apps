import { describe, expect, it } from "vitest";
import {
  BookingJourney, GiftTransfer, OrganizerConsole, ConsentBind, GateRejectedError, ProtocolError,
  type LocalCallInvoker,
} from "../src/index.js";
import type { LocalCallInput } from "../src/local-call.js";
import { composerInputs } from "./support/composer-loopback-fixtures.js";
import { localCallReceipt } from "./support/receipt.js";

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("expected object");
  return value as Record<string, unknown>;
}

/** Deliberately change nested objects and arrays as well as envelope primitives. */
function mutate(value: object): void {
  for (const key of Object.keys(value)) {
    const obj = value as Record<string, unknown>;
    const child = obj[key];
    if (typeof child === "object" && child !== null) mutate(child);
    else if (typeof child === "string") obj[key] = "mutated";
    else if (typeof child === "number") obj[key] = 99;
    else if (typeof child === "boolean") obj[key] = !child;
  }
}

function deferredInvoker(mutateOnDispatch = false) {
  const pending: {
    received: LocalCallInput;
    expected: LocalCallInput;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }[] = [];
  const invoker: LocalCallInvoker = {
    invokeLocalCall(received) {
      const expected = structuredClone(received);
      if (mutateOnDispatch) mutate(received);
      return new Promise((resolve, reject) => pending.push({ received, expected, resolve, reject }));
    },
  };
  function call(index = 0) {
    const value = pending[index];
    if (!value) throw new Error(`missing call ${index}`);
    return value;
  }
  return { invoker, pending, call };
}

// Literal fixture results, with no protocol transition or settlement calculation.
function receipt(input: LocalCallInput) {
  const body = record(input.body);
  const result = input.action === "create_event"
    ? { eventId: body.eventId, policyHash: "policy-hash", inventoryIds: ["inventory-original"], reservationSeconds: 900 }
    : input.action === "prepare_trade"
      ? { tradeId: body.tradeId, ticketId: "ticket-original", externalOrderId: "order-original", status: "PREPARED", termsHash: "trade-terms" }
      : input.action === "accept_trade" ? { accepted: true }
        : input.action === "offer_gift" ? { giftId: body.giftId, termsHash: "gift-terms" }
          : input.action === "cancel_gift" ? { giftState: "CANCELLED" }
            : input.action === "accept_gift" ? { ticketId: composerInputs(1).offer.ticketId, owner: composerInputs(1).offer.recipient, rightsVersion: 1, financialEntries: 0 }
              : input.action === "issue_invitation" ? { ticketId: "invitation-ticket", financialEntries: 0, invitationsIssued: 1 }
                : input.action === "close_sales" ? { salesStatus: "CLOSED" }
                  : input.action === "set_consent" ? { allowed: body.allowed, consentVersion: 1 }
                    : { authorizedAt: 0, consentVersion: body.expectedConsentVersion, dispatchDecision: "AUTHORIZED_FIXTURE_INTENT", networkSendPerformed: false };
  return localCallReceipt(input.operationId, input.action, result);
}

const scenarios = [
  {
    name: "booking",
    create(invoker: LocalCallInvoker) {
      const instance = new BookingJourney(invoker);
      const input = { ...composerInputs(1).create, operationId: "create-original" };
      return { input, state: () => instance.state(), send: () => instance.createEvent(input),
        next: () => instance.prepareTrade({ operationId: "prepare-original", tradeId: "trade-original", buyer: "buyer-original" }) };
    },
  },
  {
    name: "gift",
    create(invoker: LocalCallInvoker) {
      const instance = new GiftTransfer(invoker);
      const input = { ...composerInputs(1).offer, operationId: "offer-original" };
      return { input, state: () => instance.state(), send: () => instance.offerGift(input),
        next: () => instance.cancelGift({ operationId: "cancel-original" }) };
    },
  },
  {
    name: "organizer",
    create(invoker: LocalCallInvoker) {
      const instance = new OrganizerConsole(invoker);
      const input = { ...composerInputs(1).create, operationId: "create-original" };
      return { input, state: () => instance.state(), send: () => instance.createEvent(input),
        next: () => instance.closeSales({ operationId: "close-original", eventId: composerInputs(1).eventId }) };
    },
  },
  {
    name: "consent",
    create(invoker: LocalCallInvoker) {
      const instance = new ConsentBind(invoker);
      const input = { ...composerInputs(1).consent, allowed: true, operationId: "set-original" };
      return { input, state: () => instance.state(), send: () => instance.setConsent(input),
        next: () => instance.authorizeMarketing({ ...composerInputs(1).consent, operationId: "authorize-original" }) };
    },
  },
];

for (const scenario of scenarios) {
  describe(`${scenario.name} evidence ownership`, () => {
    it("detaches receipts and captures caller values before synchronous and deferred invoker mutation", async () => {
      const harness = deferredInvoker(true);
      const subject = scenario.create(harness.invoker);
      const originalInput = structuredClone(subject.input);
      const first = subject.send();
      expect(harness.call().expected.operationId).toBe(originalInput.operationId);
      mutate(subject.input);
      mutate(harness.call().received);
      expect(await subject.next()).toMatchObject({ kind: "FENCED", blockedBy: { reason: "in-flight" } });
      const sourceReceipt = receipt(harness.call().expected);
      const originalReceipt = structuredClone(sourceReceipt);
      harness.call().resolve(sourceReceipt);
      const outcome = await first;
      expect(outcome).toMatchObject({ kind: "RECEIPT", receipt: originalReceipt });
      if (outcome.kind !== "RECEIPT") throw new Error("missing receipt");
      expect(outcome.receipt).not.toBe(sourceReceipt);
      expect(outcome.receipt.result).not.toBe(sourceReceipt.result);
      mutate(sourceReceipt);
      expect(outcome.receipt).toEqual(originalReceipt);
      mutate(outcome.receipt);
      const next = subject.next();
      const expected = harness.call(1).expected;
      if (scenario.name === "booking") expect(expected).toMatchObject({ actor: "buyer-original", body: { inventoryId: "inventory-original", amount: 100000, tradeId: "trade-original" } });
      if (scenario.name === "gift") expect(expected).toMatchObject({ actor: composerInputs(1).offer.donor, body: { giftId: composerInputs(1).offer.giftId } });
      if (scenario.name === "consent") expect(subject.state()).toMatchObject({ consented: true, allowed: true });
      harness.call(1).resolve(receipt(expected));
      expect((await next).kind).toBe("RECEIPT");
      expect(harness.pending).toHaveLength(2);
    });

    for (const failure of ["UNKNOWN", "REJECTED", "NOT_SENT", "INVALID_RECEIPT", "UNCLONEABLE"] as const) {
      it(`isolates ${failure} outcomes, state and fenced identities without clearing the halt`, async () => {
        const harness = deferredInvoker();
        const subject = scenario.create(harness.invoker);
        const other = scenario.create(harness.invoker);
        const first = subject.send();
        const expected = structuredClone(harness.call().expected);
        mutate(subject.input);
        mutate(harness.call().received);
        const rejected = failure === "NOT_SENT" ? expect(first).rejects.toThrow("not sent") : undefined;
        if (failure === "UNKNOWN") harness.call().reject(new ProtocolError("lost", "REQUEST_TIMEOUT", { requestId: "request-original", correlationId: "correlation-original" }));
        else if (failure === "REJECTED") harness.call().reject(new GateRejectedError("refused", "REJECTED_FIXTURE", { requestId: "request-original", correlationId: "correlation-original" }, 422));
        else if (failure === "NOT_SENT") harness.call().reject(new ProtocolError("not sent", "NOT_SENT"));
        else {
          const bad = receipt(expected);
          if (failure === "UNCLONEABLE") bad.result = { ...bad.result, uncloneable: () => undefined };
          else bad.result = {};
          harness.call().resolve(bad);
        }
        if (rejected) await rejected;
        else {
          const outcome = await first;
          expect(outcome).toMatchObject({ kind: failure === "REJECTED" ? "REJECTED" : "UNKNOWN", identity: expected });
          if (outcome.kind !== "UNKNOWN" && outcome.kind !== "REJECTED") throw new Error("missing halt identity");
          mutate(outcome.identity);
        }
        const original = subject.state();
        expect(original.halted?.identity).toMatchObject(expected);
        if (failure === "UNKNOWN" || failure === "REJECTED") expect(original.halted?.identity).toMatchObject({ requestId: "request-original", correlationId: "correlation-original" });
        if (failure === "UNCLONEABLE" || failure === "INVALID_RECEIPT") expect(original.halted?.identity.code).toBe("INVALID_RECEIPT");
        const snapshot = structuredClone(original);
        mutate(original);
        original.halted = null;
        expect(subject.state()).toEqual(snapshot);
        const fenced = await subject.next();
        expect(fenced).toMatchObject({ kind: "FENCED", blockedBy: { reason: "halted", identity: snapshot.halted?.identity } });
        if (fenced.kind !== "FENCED" || fenced.blockedBy.reason !== "halted") throw new Error("missing fence");
        mutate(fenced.blockedBy.identity);
        mutate(fenced.identity);
        expect(subject.state()).toEqual(snapshot);
        expect((await subject.next()).kind).toBe("FENCED");
        expect(harness.pending).toHaveLength(1);
        expect(other.state().halted).toBeNull();
      });
    }

    it("keeps pre-dispatch validation failures fenced after state mutation", async () => {
      const harness = deferredInvoker();
      const subject = scenario.create(harness.invoker);
      subject.input.operationId = "";
      await expect(subject.send()).rejects.toThrow();
      const original = structuredClone(subject.state());
      expect(original.halted?.kind).toBe("NOT_SENT");
      const exposed = subject.state();
      mutate(exposed);
      exposed.halted = null;
      expect(subject.state()).toEqual(original);
      expect(await subject.next()).toMatchObject({ kind: "FENCED", blockedBy: { reason: "halted", identity: original.halted?.identity } });
      expect(harness.pending).toHaveLength(0);
    });

    it("returns independent explanation arrays and entries across snapshots and instances", () => {
      const harness = deferredInvoker();
      const subject = scenario.create(harness.invoker);
      const other = scenario.create(harness.invoker);
      const original = subject.state();
      const expected = structuredClone(original);
      mutate(original.notComposed);
      (original.notComposed as unknown[]).splice(0);
      if ("sent" in original) original.sent.push("close_sales");
      expect(subject.state()).toEqual(expected);
      expect(other.state()).toEqual(expected);
    });
  });
}

it("booking retains buyer, tradeId and termsHash after prepare receipt and input mutation", async () => {
  const harness = deferredInvoker(true);
  const journey = new BookingJourney(harness.invoker);
  const create = journey.createEvent({ ...composerInputs(1).create, operationId: "create" });
  harness.call().resolve(receipt(harness.call().expected));
  await create;
  const input = { operationId: "prepare", tradeId: "trade-original", buyer: "buyer-original" };
  const prepare = journey.prepareTrade(input);
  mutate(input);
  const source = receipt(harness.call(1).expected);
  harness.call(1).resolve(source);
  const outcome = await prepare;
  expect(outcome.kind).toBe("RECEIPT");
  mutate(source);
  if (outcome.kind === "RECEIPT") mutate(outcome.receipt);
  const accept = journey.acceptTrade({ operationId: "accept" });
  expect(harness.call(2).expected).toMatchObject({ operationId: "accept", actor: "buyer-original", body: { tradeId: "trade-original", termsHash: "trade-terms" } });
  harness.call(2).resolve(receipt(harness.call(2).expected));
  expect((await accept).kind).toBe("RECEIPT");
  expect(harness.pending).toHaveLength(3);
});

it("gift acceptance retains the original recipient, ticket, giftId and termsHash", async () => {
  const harness = deferredInvoker(true);
  const gift = new GiftTransfer(harness.invoker);
  const input = { ...composerInputs(1).offer, operationId: "offer" };
  const offer = gift.offerGift(input);
  mutate(input);
  const source = receipt(harness.call().expected);
  harness.call().resolve(source);
  const outcome = await offer;
  mutate(source);
  if (outcome.kind !== "RECEIPT") throw new Error("missing offer receipt");
  mutate(outcome.receipt);
  const accept = gift.acceptGift({ operationId: "accept" });
  expect(harness.call(1).expected).toMatchObject({ actor: composerInputs(1).offer.recipient, body: { giftId: composerInputs(1).offer.giftId, termsHash: "gift-terms" } });
  harness.call(1).resolve(receipt(harness.call(1).expected));
  expect((await accept).kind).toBe("RECEIPT");
  expect(harness.pending).toHaveLength(2);
});

it("organizer invitation deduplication retains the original inventory despite both mutations", async () => {
  const harness = deferredInvoker(true);
  const organizer = new OrganizerConsole(harness.invoker);
  const input = { ...composerInputs(1).invitation, operationId: "invite" };
  const send = organizer.issueInvitation(input);
  mutate(input);
  mutate(harness.call().received);
  harness.call().resolve(receipt(harness.call().expected));
  expect((await send).kind).toBe("RECEIPT");
  expect(await organizer.issueInvitation({ ...composerInputs(1).invitation, operationId: "repeat" })).toMatchObject({ kind: "FENCED", blockedBy: { reason: "already-sent" } });
  const distinct = organizer.issueInvitation({ ...composerInputs(1).invitation, inventoryId: "distinct", operationId: "distinct" });
  harness.call(1).resolve(receipt(harness.call(1).expected));
  expect((await distinct).kind).toBe("RECEIPT");
  expect(harness.pending).toHaveLength(2);
});

for (const mutatedOnly of [false, true]) {
  it(`consent authorization matches the captured version (mutated-only receipt: ${mutatedOnly})`, async () => {
    const harness = deferredInvoker(true);
    const consent = new ConsentBind(harness.invoker);
    const set = consent.setConsent({ ...composerInputs(1).consent, allowed: true, operationId: "set" });
    harness.call().resolve(receipt(harness.call().expected));
    await set;
    const input = { ...composerInputs(1).consent, operationId: "authorize" };
    const authorize = consent.authorizeMarketing(input);
    mutate(input);
    const result = receipt(harness.call(1).expected);
    if (mutatedOnly) result.result.consentVersion = input.expectedConsentVersion;
    harness.call(1).resolve(result);
    expect((await authorize).kind).toBe(mutatedOnly ? "UNKNOWN" : "RECEIPT");
    expect(consent.state().authorized).toBe(!mutatedOnly);
    if (mutatedOnly) expect((await consent.setConsent({ ...composerInputs(1).consent, allowed: false, operationId: "blocked" })).kind).toBe("FENCED");
    expect(harness.pending).toHaveLength(2);
  });
}

for (const name of ["booking", "gift", "organizer", "consent"]) {
  it(`${name} rejects receipts that match only the invoker-mutated body`, async () => {
    const scenario = scenarios.find((entry) => entry.name === name);
    if (!scenario) throw new Error("missing scenario");
    const harness = deferredInvoker();
    const subject = scenario.create(harness.invoker);
    const send = subject.send();
    const call = harness.call();
    const body = record(call.received.body);
    if (name === "consent") body.allowed = false;
    else if (name === "gift") body.giftId = "foreign-gift";
    else body.eventId = "foreign-event";
    call.resolve(receipt(call.received));
    const outcome = await send;
    expect(outcome).toMatchObject({ kind: "UNKNOWN", code: "INVALID_RECEIPT", identity: call.expected });
    expect((await subject.next()).kind).toBe("FENCED");
    expect(harness.pending).toHaveLength(1);
  });
}
