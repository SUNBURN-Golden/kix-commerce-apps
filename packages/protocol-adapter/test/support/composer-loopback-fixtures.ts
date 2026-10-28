import type { LocalCallInvoker } from "../../src/booking-journey.js";
import { assertComposerResult } from "../../src/composer-receipts.js";
import { ConsentBind } from "../../src/consent-bind.js";
import { GiftTransfer } from "../../src/gift-transfer.js";
import { buildLocalCallEnvelope, type LocalCallEnvelope } from "../../src/local-call.js";
import { PINNED_PROTOCOL_DOMAIN } from "../../src/openapi-contract-pin.js";
import { OrganizerConsole } from "../../src/organizer-console.js";
import { assertLocalCallReceipt, enforceRemotePayloadGuards } from "../../src/payload-guards.js";

// Independent literal authority: expansion of a composer's constants cannot expand this scope.
export const COMPOSER_ACTIONS = ["offer_gift", "accept_gift", "cancel_gift", "create_event", "close_sales",
  "open_admission", "complete_event", "cancel_event", "issue_invitation", "set_consent", "authorize_marketing"] as const;
export type ComposerAction = typeof COMPOSER_ACTIONS[number];
export type Composer = "gift" | "organizer" | "consent";
export interface ComposerFixture {
  fixtureId: `${Composer}.${ComposerAction}.success`;
  composer: Composer;
  seed: number;
  klass: "SUCCESS";
  failure: null;
  envelope: LocalCallEnvelope;
  receipt: { domain: string; operationId: string; sequence: number; action: string; result: Record<string, unknown> };
}
export function composerFor(action: ComposerAction): Composer {
  return action.endsWith("_gift") ? "gift" : action === "set_consent" || action === "authorize_marketing" ? "consent" : "organizer";
}

/** Caller values and shape literals only; no protocol transition or economic calculations. */
export function composerInputs(seed: number) {
  const label = seed.toString(16).padStart(8, "0");
  const eventId = `show-mock-${label}`;
  const consent = { subject: `subject-mock-${label}`, business: "desk-business", channel: "desk-channel",
    eventId, expectedConsentVersion: 1, purpose: "desk-purpose" };
  return {
    operationId: (action: string) => `op-${action}-${label}`,
    eventId,
    offer: { giftId: `gift-mock-${label}`, ticketId: `ticket-mock-${label}`, donor: `donor-mock-${label}`,
      recipient: `recipient-mock-${label}`, expectedVersion: 0, expiresAt: 1000 },
    create: { eventId, organizer: "organizer", seats: ["A1"], policy: {
      primaryPrice: 100000, resaleCap: 150000, primaryFeeBps: 500, resaleFeeBps: 300,
      resaleOrganizerBps: 200, resaleAllowed: true, refundProfile: "FULL_CHAIN_UNWIND_FIXTURE",
    } },
    invitation: { eventId, inventoryId: `inv-mock-${label}`, expectedInventoryVersion: 0,
      recipient: `guest-mock-${label}`, organizer: "organizer" },
    consent,
  };
}

/** Prerequisites use the supplied invoker too, allowing replay to isolate its target. */
export async function runComposerTarget(action: ComposerAction, seed: number, invoker: LocalCallInvoker) {
  const input = composerInputs(seed);
  const operationId = input.operationId(action);
  const composer = composerFor(action);
  if (composer === "gift") {
    const instance = new GiftTransfer(invoker);
    let outcome = await instance.offerGift({ ...input.offer, operationId: input.operationId("offer_gift") });
    if (action !== "offer_gift") {
      if (outcome.kind !== "RECEIPT") throw new Error("Gift prerequisite failed");
      outcome = action === "accept_gift" ? await instance.acceptGift({ operationId }) : await instance.cancelGift({ operationId });
    }
    return { outcome, state: () => instance.state(), fence: () => action === "accept_gift"
      ? instance.cancelGift({ operationId: "never-sent" }) : instance.acceptGift({ operationId: "never-sent" }) };
  }
  if (composer === "consent") {
    const instance = new ConsentBind(invoker);
    let outcome = await instance.setConsent({ ...input.consent, allowed: true, operationId: input.operationId("set_consent") });
    if (action === "authorize_marketing") {
      if (outcome.kind !== "RECEIPT") throw new Error("Consent prerequisite failed");
      outcome = await instance.authorizeMarketing({ ...input.consent, operationId });
    }
    return { outcome, state: () => instance.state(), fence: () => instance.setConsent({ ...input.consent, allowed: false, operationId: "never-sent" }) };
  }
  const instance = new OrganizerConsole(invoker);
  const event = { eventId: input.eventId, operationId };
  const outcome = action === "create_event" ? await instance.createEvent({ ...input.create, operationId })
    : action === "close_sales" ? await instance.closeSales(event)
    : action === "open_admission" ? await instance.openAdmission(event)
    : action === "complete_event" ? await instance.completeEvent(event)
    : action === "cancel_event" ? await instance.cancelEvent(event)
    : await instance.issueInvitation({ ...input.invitation, operationId });
  return { outcome, state: () => instance.state(), fence: () => instance.closeSales({ ...event, operationId: "never-sent" }) };
}

export async function createComposerFixtures(seed: number): Promise<ComposerFixture[]> {
  const inputs = composerInputs(seed);
  const fixtures: ComposerFixture[] = [];
  for (const action of COMPOSER_ACTIONS) {
    let captured: ComposerFixture | undefined;
    const replay = await runComposerTarget(action, seed, { invokeLocalCall: async (input) => {
      const envelope = buildLocalCallEnvelope(input);
      const body = envelope.body;
      const result: Record<string, unknown> = input.action === "offer_gift" ? { giftId: body.giftId, termsHash: "terms-hash" }
        : input.action === "accept_gift" ? { ticketId: inputs.offer.ticketId, owner: inputs.offer.recipient, rightsVersion: 1, financialEntries: 0 }
        : input.action === "cancel_gift" ? { giftState: "CANCELLED" }
        : input.action === "create_event" ? { eventId: body.eventId, policyHash: "policy-hash", inventoryIds: [inputs.invitation.inventoryId], reservationSeconds: 900 }
        : input.action === "close_sales" ? { salesStatus: "CLOSED" }
        : input.action === "open_admission" ? { admissionStatus: "OPEN" }
        : input.action === "issue_invitation" ? { ticketId: "ticket-1", financialEntries: 0, invitationsIssued: 1 }
        : input.action === "complete_event" ? { eventStatus: "COMPLETED" }
        : input.action === "cancel_event" ? { eventStatus: "CANCELLED" }
        : input.action === "set_consent" ? { allowed: body.allowed, consentVersion: 1 }
        : input.action === "authorize_marketing" ? { authorizedAt: 0, consentVersion: body.expectedConsentVersion,
          dispatchDecision: "AUTHORIZED_FIXTURE_INTENT", networkSendPerformed: false } : {};
      const receipt = { domain: PINNED_PROTOCOL_DOMAIN, operationId: input.operationId,
        sequence: input.action === "accept_gift" || input.action === "cancel_gift" || input.action === "authorize_marketing" ? 2 : 1,
        action: input.action, result };
      assertLocalCallReceipt(receipt, envelope);
      enforceRemotePayloadGuards(receipt);
      assertComposerResult(receipt, envelope);
      if (input.action === action) captured = { fixtureId: `${composerFor(action)}.${action}.success`,
        composer: composerFor(action), seed, klass: "SUCCESS", failure: null, envelope, receipt };
      return receipt;
    } });
    if (!captured || replay.outcome.kind !== "RECEIPT") throw new Error(`Invalid fixture ${action}`);
    fixtures.push(captured);
  }
  return fixtures;
}
