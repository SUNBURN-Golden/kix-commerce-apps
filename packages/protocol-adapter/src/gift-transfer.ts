import {
  classifyThrown,
  closedResult,
  JOURNEY_RULING,
  snapshot,
  traceIdentity,
  withTrace,
  type CallIdentity,
  type LocalCallInvoker,
} from "./booking-journey.js";
import { COMMERCE_COMMAND_BINDINGS } from "./commerce-bindings.js";
import { buildLocalCallEnvelope } from "./local-call.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import { assertLocalCallReceipt } from "./payload-guards.js";
import { isRecord } from "./record.js";
import { ProtocolError } from "./types.js";

/**
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 * Gift posts offer_gift, then accept_gift or cancel_gift. It does not continue
 * the booking journey and it does not send capture or settle_capture.
 */
export const GIFT_COMPOSED = ["offer_gift", "accept_gift", "cancel_gift"] as const;

export type GiftStep = (typeof GIFT_COMPOSED)[number];

export type GiftResolution = "accept_gift" | "cancel_gift";

export interface GiftNotComposed {
  action: "capture" | "settle_capture" | "commit_trade" | "issue_invitation";
  reason: string;
}

export interface GiftDeskNotBound {
  method: "offerCredit" | "acceptResale" | "cancelResaleListing";
  consideredAction: string | null;
  reason: string;
}

/**
 * Commands this helper records and does not send.
 * capture and settle_capture stay out under the journey ruling.
 * commit_trade stays uncomposed, so this helper cannot mint a giftable right that way.
 * issue_invitation stays uncomposed here. A caller that already holds a right supplies ticketId.
 */
export const GIFT_NOT_COMPOSED: readonly GiftNotComposed[] = [
  {
    action: "capture",
    reason: `${JOURNEY_RULING}. The adapter composes nothing past accept_trade. capture is never composed and never sent. ${COMMERCE_COMMAND_BINDINGS.confirmBooking.reason}`,
  },
  {
    action: "settle_capture",
    reason: `${JOURNEY_RULING}. settle_capture stays out of the journey and is never sent. ${COMMERCE_COMMAND_BINDINGS.settlementPreview.reason}`,
  },
  {
    action: "commit_trade",
    reason: `${JOURNEY_RULING}. commit_trade stays uncomposed because this journey does not capture. ${COMMERCE_COMMAND_BINDINGS.commitSettlement.reason}`,
  },
  {
    action: "issue_invitation",
    reason: `${JOURNEY_RULING}. issue_invitation stays uncomposed on this helper. A giftable right is produced elsewhere. This surface does not send issue_invitation. ${COMMERCE_COMMAND_BINDINGS.commitSettlement.reason}`,
  },
];

/** Desk methods quoted from the locked bindings. None of them is a gift body. */
export const GIFT_DESK_NOT_BOUND: readonly GiftDeskNotBound[] = [
  deskQuote("offerCredit"),
  deskQuote("acceptResale"),
  deskQuote("cancelResaleListing"),
];

export type GiftFenceReason =
  | { reason: "in-flight" }
  | { reason: "out-of-order" }
  | { reason: "already-sent" }
  | { reason: "halted"; identity: CallIdentity };

export interface GiftHalt {
  step: GiftStep;
  kind: "REJECTED" | "UNKNOWN" | "NOT_SENT";
  identity: CallIdentity;
}

export type GiftStepOutcome =
  | { kind: "RECEIPT"; step: GiftStep; receipt: Record<string, unknown> }
  | { kind: "REJECTED"; step: GiftStep; code: string; identity: CallIdentity }
  | { kind: "UNKNOWN"; step: GiftStep; code: string; identity: CallIdentity }
  | { kind: "FENCED"; step: GiftStep; blockedBy: GiftFenceReason; identity: CallIdentity };

export interface GiftState {
  offered: boolean;
  resolvedBy: GiftResolution | null;
  halted: GiftHalt | null;
  notComposed: readonly GiftNotComposed[];
}

const OFFER_RESULT_KEYS = ["giftId", "termsHash"] as const;
const ACCEPT_RESULT_KEYS = ["ticketId", "owner", "rightsVersion", "financialEntries"] as const;
const CANCEL_RESULT_KEYS = ["giftState"] as const;

interface OfferedGift {
  giftId: string;
  ticketId: string;
  donor: string;
  recipient: string;
  termsHash: string;
}

export interface GiftOfferInput {
  operationId: string;
  giftId: string;
  donor: string;
  recipient: string;
  ticketId: string;
  expectedVersion: number;
  expiresAt: number;
}

/**
 * Posts offer_gift, then either accept_gift or cancel_gift, through an existing
 * local-call invoker. Each step is one caller-chosen operationId. A rejection,
 * an unknown outcome, or a pre-send failure fences every later write, including
 * cancel_gift. This class does not retry, does not mint an operationId, and
 * does not send capture or settle_capture. expiresAt, expectedVersion, recipient,
 * and ticketId have no default. A pre-send validation failure throws and still
 * fences later steps.
 */
export class GiftTransfer {
  private offered = false;
  private resolvedBy: GiftResolution | null = null;
  private halted: GiftHalt | null = null;
  private inFlight = false;
  private gift: OfferedGift | null = null;

  constructor(private readonly invoker: LocalCallInvoker) {}

  state(): GiftState {
    return {
      offered: this.offered,
      resolvedBy: this.resolvedBy,
      halted: this.halted,
      notComposed: GIFT_NOT_COMPOSED,
    };
  }

  offerGift(input: GiftOfferInput): Promise<GiftStepOutcome> {
    return this.run("offer_gift", input.operationId, input.donor, () => offerBody(input), (body, receipt) => {
      const read = readOfferReceipt(body, receipt);
      if (read === null) {
        return false;
      }
      if (typeof body.ticketId !== "string" || typeof body.recipient !== "string" || typeof body.giftId !== "string") {
        return false;
      }
      this.gift = {
        giftId: body.giftId,
        ticketId: body.ticketId,
        donor: input.donor,
        recipient: body.recipient,
        termsHash: read.termsHash,
      };
      return true;
    });
  }

  acceptGift(input: { operationId: string }): Promise<GiftStepOutcome> {
    return this.run(
      "accept_gift",
      input.operationId,
      this.gift?.recipient ?? "recipient",
      () => this.acceptBody(),
      (_body, receipt) => this.readAccept(receipt),
    );
  }

  cancelGift(input: { operationId: string }): Promise<GiftStepOutcome> {
    return this.run(
      "cancel_gift",
      input.operationId,
      this.gift?.donor ?? "donor",
      () => this.cancelBody(),
      (_body, receipt) => readCancelReceipt(receipt),
    );
  }

  private async run(
    step: GiftStep,
    operationId: string,
    actor: string,
    build: () => Record<string, unknown>,
    remember: (body: Record<string, unknown>, receipt: Record<string, unknown>) => boolean,
  ): Promise<GiftStepOutcome> {
    const fenced = this.fence(step, operationId, actor);
    if (fenced) {
      return fenced;
    }
    let body: Record<string, unknown> | undefined;
    try {
      body = snapshot(build());
      buildLocalCallEnvelope({ operationId, actor, action: step, body });
    } catch (error) {
      this.halt(step, "NOT_SENT", traceIdentity({ operationId, actor, action: step, body: body ?? {} }, error));
      throw error;
    }
    const sent = body;
    this.inFlight = true;
    try {
      let parsed: unknown;
      try {
        parsed = await this.invoker.invokeLocalCall({ operationId, actor, action: step, body: sent });
      } catch (error) {
        const classified = classifyThrown(error);
        if (classified.disposition === "not-sent") {
          this.halt(step, "NOT_SENT", traceIdentity({ operationId, actor, action: step, body: sent }, error));
          throw error;
        }
        if (classified.disposition === "rejected") {
          const identity = withTrace({ operationId, actor, action: step, body: sent, code: classified.code }, classified);
          this.halt(step, "REJECTED", identity);
          return { kind: "REJECTED", step, code: classified.code, identity };
        }
        const identity = withTrace({ operationId, actor, action: step, body: sent, code: classified.code }, classified);
        this.halt(step, "UNKNOWN", identity);
        return { kind: "UNKNOWN", step, code: classified.code, identity };
      }
      try {
        assertLocalCallReceipt(parsed, { action: step, operationId });
      } catch {
        return this.unknownReceipt(step, sent, operationId, actor, "GATE_STATUS");
      }
      if (!isRecord(parsed) || !remember(sent, parsed)) {
        return this.unknownReceipt(step, sent, operationId, actor, "INVALID_RECEIPT");
      }
      if (step === "offer_gift") {
        this.offered = true;
      } else {
        this.resolvedBy = step;
      }
      return { kind: "RECEIPT", step, receipt: parsed };
    } finally {
      this.inFlight = false;
    }
  }

  private fence(step: GiftStep, operationId: string, actor: string): GiftStepOutcome | null {
    const identity = attemptIdentity(step, operationId, actor);
    if (this.inFlight) {
      return { kind: "FENCED", step, blockedBy: { reason: "in-flight" }, identity };
    }
    if (this.halted) {
      return {
        kind: "FENCED",
        step,
        blockedBy: { reason: "halted", identity: this.halted.identity },
        identity,
      };
    }
    if (step === "offer_gift") {
      if (this.offered || this.resolvedBy !== null) {
        return { kind: "FENCED", step, blockedBy: { reason: "already-sent" }, identity };
      }
      return null;
    }
    if (this.resolvedBy !== null) {
      return { kind: "FENCED", step, blockedBy: { reason: "already-sent" }, identity };
    }
    if (!this.offered) {
      return { kind: "FENCED", step, blockedBy: { reason: "out-of-order" }, identity };
    }
    return null;
  }

  private halt(step: GiftStep, kind: GiftHalt["kind"], identity: CallIdentity): void {
    this.halted = { step, kind, identity };
  }

  private unknownReceipt(
    step: GiftStep,
    body: Record<string, unknown>,
    operationId: string,
    actor: string,
    code: string,
  ): GiftStepOutcome {
    const identity: CallIdentity = { operationId, actor, action: step, body, code };
    this.halt(step, "UNKNOWN", identity);
    return { kind: "UNKNOWN", step, code, identity };
  }

  private acceptBody(): Record<string, unknown> {
    if (this.gift === null) {
      throw new ProtocolError("accept_gift has no offer_gift receipt.");
    }
    return {
      domain: PINNED_PROTOCOL_DOMAIN,
      giftId: this.gift.giftId,
      termsHash: this.gift.termsHash,
    };
  }

  private cancelBody(): Record<string, unknown> {
    if (this.gift === null) {
      throw new ProtocolError("cancel_gift has no offer_gift receipt.");
    }
    return {
      domain: PINNED_PROTOCOL_DOMAIN,
      giftId: this.gift.giftId,
    };
  }

  private readAccept(receipt: Record<string, unknown>): boolean {
    if (this.gift === null) {
      return false;
    }
    const result = closedResult(receipt, ACCEPT_RESULT_KEYS);
    if (result === null) {
      return false;
    }
    if (result.ticketId !== this.gift.ticketId || result.owner !== this.gift.recipient) {
      return false;
    }
    if (typeof result.rightsVersion !== "number" || !Number.isInteger(result.rightsVersion)) {
      return false;
    }
    return result.financialEntries === 0;
  }
}

function deskQuote(method: GiftDeskNotBound["method"]): GiftDeskNotBound {
  const binding = COMMERCE_COMMAND_BINDINGS[method];
  return {
    method,
    consideredAction: binding.consideredAction,
    reason: binding.reason,
  };
}

function attemptIdentity(step: GiftStep, operationId: string, actor: string): CallIdentity {
  return {
    operationId,
    actor,
    action: step,
    body: {},
  };
}

function offerBody(input: GiftOfferInput): Record<string, unknown> {
  return {
    domain: PINNED_PROTOCOL_DOMAIN,
    giftId: input.giftId,
    ticketId: input.ticketId,
    expectedVersion: input.expectedVersion,
    recipient: input.recipient,
    expiresAt: input.expiresAt,
  };
}

function readOfferReceipt(
  body: Record<string, unknown>,
  receipt: Record<string, unknown>,
): { termsHash: string } | null {
  const result = closedResult(receipt, OFFER_RESULT_KEYS);
  if (result === null) {
    return null;
  }
  if (typeof result.giftId !== "string" || result.giftId !== body.giftId) {
    return null;
  }
  if (typeof result.termsHash !== "string" || result.termsHash.length === 0) {
    return null;
  }
  return { termsHash: result.termsHash };
}

function readCancelReceipt(receipt: Record<string, unknown>): boolean {
  const result = closedResult(receipt, CANCEL_RESULT_KEYS);
  return result !== null && result.giftState === "CANCELLED";
}
