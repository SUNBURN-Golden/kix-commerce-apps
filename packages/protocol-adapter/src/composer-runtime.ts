/** Existing composer implementations, grouped to compress their shared vocabulary.
 * Command bodies, readers, state transitions and fences are unchanged. */
import { readCreateReceipt, readPrepareReceipt, readAcceptReceipt, type CreatedEvent, type PreparedTrade } from "./journey-receipts.js";
import { COMMERCE_COMMAND_BINDINGS } from "./commerce-bindings.js";
import { GateRejectedError } from "./http-adapter.js";
import { type LocalCallInput, buildLocalCallEnvelope } from "./local-call.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import { assertLocalCallReceipt } from "./payload-guards.js";
import { isRecord } from "./record.js";
import { ProtocolError } from "./types.js";
import { readOfferReceipt, readAcceptGiftReceipt, readCancelReceipt, readOrganizerCreateReceipt, readCloseReceipt, readOpenReceipt, readIssueReceipt, readRecordResult, readSetReceipt, readAuthorizeReceipt } from "./composer-receipts.js";

export { closedResult, sameKeys } from "./journey-receipts.js";

/**
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 * The helper composes create_event, prepare_trade, and accept_trade only.
 */
export const JOURNEY_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const JOURNEY_COMPOSED = ["create_event", "prepare_trade", "accept_trade"] as const;

export type JourneyStep = (typeof JOURNEY_COMPOSED)[number];

export interface LocalCallInvoker {
  invokeLocalCall(input: LocalCallInput): Promise<unknown>;
}

export interface CallIdentity {
  operationId: string;
  actor: string;
  action: string;
  body: Record<string, unknown>;
  requestId?: string;
  correlationId?: string;
  code?: string;
}

export interface JourneyNotComposed {
  action: "capture" | "settle_capture" | "commit_trade" | "open_admission" | "admit";
  reason: string;
}

export interface JourneyDeskNotBound {
  method: "placeHold" | "confirmBooking" | "settlementPreview" | "checkAdmission";
  consideredAction: string | null;
  reason: string;
}

/**
 * Catalogue commands this helper records and does not send.
 * capture and settle_capture stay out. commit_trade, open_admission, and admit
 * stay uncomposed because the chain stops at accept_trade.
 */
export const JOURNEY_NOT_COMPOSED: readonly JourneyNotComposed[] = [
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
    action: "open_admission",
    reason: `${JOURNEY_RULING}. open_admission stays uncomposed. The journey stops at accept_trade. No desk method posts open_admission.`,
  },
  {
    action: "admit",
    reason: `${JOURNEY_RULING}. admit stays uncomposed. ${COMMERCE_COMMAND_BINDINGS.checkAdmission.reason}`,
  },
];

/** Desk methods quoted from the locked bindings. placeHold stays reserve_listing. */
export const JOURNEY_DESK_NOT_BOUND: readonly JourneyDeskNotBound[] = [
  journeyDeskQuote("placeHold"),
  journeyDeskQuote("confirmBooking"),
  journeyDeskQuote("settlementPreview"),
  journeyDeskQuote("checkAdmission"),
];

export type JourneyFenceReason =
  | { reason: "in-flight" }
  | { reason: "out-of-order" }
  | { reason: "already-sent" }
  | { reason: "halted"; identity: CallIdentity };

export interface JourneyHalt {
  step: JourneyStep;
  kind: "REJECTED" | "UNKNOWN" | "NOT_SENT";
  identity: CallIdentity;
}

export type JourneyStepOutcome =
  | { kind: "RECEIPT"; step: JourneyStep; receipt: Record<string, unknown> }
  | { kind: "REJECTED"; step: JourneyStep; code: string; identity: CallIdentity }
  | { kind: "UNKNOWN"; step: JourneyStep; code: string; identity: CallIdentity }
  | { kind: "FENCED"; step: JourneyStep; blockedBy: JourneyFenceReason; identity: CallIdentity };

export interface JourneyState {
  completedThrough: "none" | JourneyStep;
  halted: JourneyHalt | null;
  notComposed: readonly JourneyNotComposed[];
}

const CREATE_ACTOR = "operator";

const STEP_ORDER = ["none", "create_event", "prepare_trade", "accept_trade"] as const;

/**
 * Composes the approved primary-seat journey through an existing local-call invoker.
 * Each step is one caller-chosen operationId. A rejection, an unknown outcome, or
 * an invalid receipt fences every later write. This class does not retry, does not
 * mint an operationId, and does not send capture or settle_capture.
 * A pre-send validation failure throws and still fences later steps.
 */
export class BookingJourney {
  private completedThrough: JourneyState["completedThrough"] = "none";
  private halted: JourneyHalt | null = null;
  private inFlight = false;
  private created: CreatedEvent | null = null;
  private prepared: PreparedTrade | null = null;

  constructor(private readonly invoker: LocalCallInvoker) {}

  state(): JourneyState {
    return {
      completedThrough: this.completedThrough,
      halted: this.halted,
      notComposed: JOURNEY_NOT_COMPOSED,
    };
  }

  createEvent(input: {
    operationId: string;
    eventId: string;
    organizer: string;
    policy: { primaryPrice: number; [key: string]: unknown };
    seats: string[];
  }): Promise<JourneyStepOutcome> {
    return this.run("create_event", input.operationId, CREATE_ACTOR, () => journeyCreateEventBody(input), (body, receipt) => {
      const read = readCreateReceipt(body, receipt);
      if (read === null) {
        return false;
      }
      this.created = read;
      return true;
    });
  }

  prepareTrade(input: {
    operationId: string;
    tradeId: string;
    buyer: string;
    seatIndex?: number;
  }): Promise<JourneyStepOutcome> {
    return this.run("prepare_trade", input.operationId, input.buyer, () => this.prepareBody(input), (body, receipt) => {
      const read = readPrepareReceipt(body, receipt);
      if (read === null) {
        return false;
      }
      this.prepared = read;
      return true;
    });
  }

  acceptTrade(input: { operationId: string }): Promise<JourneyStepOutcome> {
    return this.run(
      "accept_trade",
      input.operationId,
      this.prepared?.buyer ?? "buyer",
      () => this.acceptBody(),
      (_body, receipt) => readAcceptReceipt(receipt),
    );
  }

  private async run(
    step: JourneyStep,
    operationId: string,
    actor: string,
    build: () => Record<string, unknown>,
    remember: (body: Record<string, unknown>, receipt: Record<string, unknown>) => boolean,
  ): Promise<JourneyStepOutcome> {
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
      this.completedThrough = step;
      return { kind: "RECEIPT", step, receipt: parsed };
    } finally {
      this.inFlight = false;
    }
  }

  private fence(step: JourneyStep, operationId: string, actor: string): JourneyStepOutcome | null {
    const identity = journeyAttemptIdentity(step, operationId, actor);
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
    if (stepIndex(this.completedThrough) >= stepIndex(step)) {
      return { kind: "FENCED", step, blockedBy: { reason: "already-sent" }, identity };
    }
    if (stepIndex(this.completedThrough) + 1 !== stepIndex(step)) {
      return { kind: "FENCED", step, blockedBy: { reason: "out-of-order" }, identity };
    }
    return null;
  }

  private halt(step: JourneyStep, kind: JourneyHalt["kind"], identity: CallIdentity): void {
    this.halted = { step, kind, identity };
  }

  private unknownReceipt(
    step: JourneyStep,
    body: Record<string, unknown>,
    operationId: string,
    actor: string,
    code: string,
  ): JourneyStepOutcome {
    const identity: CallIdentity = { operationId, actor, action: step, body, code };
    this.halt(step, "UNKNOWN", identity);
    return { kind: "UNKNOWN", step, code, identity };
  }

  private prepareBody(input: { tradeId: string; buyer: string; seatIndex?: number }): Record<string, unknown> {
    if (this.created === null) {
      throw new ProtocolError("prepare_trade has no create_event receipt.");
    }
    const seatIndex = input.seatIndex ?? 0;
    if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= this.created.inventoryIds.length) {
      throw new ProtocolError("prepare_trade seatIndex is outside the create_event inventoryIds.");
    }
    const amount = this.created.primaryPrice;
    if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount < 0 ||
      amount > 1_000_000_000_000
    ) {
      throw new ProtocolError(
        "prepare_trade amount is the create_event primaryPrice. The helper does not supply a price.",
      );
    }
    const inventoryId = this.created.inventoryIds[seatIndex];
    if (inventoryId === undefined) {
      throw new ProtocolError("prepare_trade seatIndex is outside the create_event inventoryIds.");
    }
    return {
      domain: PINNED_PROTOCOL_DOMAIN,
      tradeId: input.tradeId,
      inventoryId,
      amount,
      buyer: input.buyer,
      expectedInventoryVersion: 0,
      expectedVersion: 0,
    };
  }

  private acceptBody(): Record<string, unknown> {
    if (this.prepared === null) {
      throw new ProtocolError("accept_trade has no prepare_trade receipt.");
    }
    return {
      domain: PINNED_PROTOCOL_DOMAIN,
      tradeId: this.prepared.tradeId,
      termsHash: this.prepared.termsHash,
    };
  }
}

function journeyDeskQuote(method: JourneyDeskNotBound["method"]): JourneyDeskNotBound {
  const binding = COMMERCE_COMMAND_BINDINGS[method];
  return {
    method,
    consideredAction: binding.consideredAction,
    reason: binding.reason,
  };
}

function stepIndex(step: "none" | JourneyStep): number {
  return STEP_ORDER.indexOf(step);
}

function journeyAttemptIdentity(step: JourneyStep, operationId: string, actor: string): CallIdentity {
  return {
    operationId,
    actor,
    action: step,
    body: {},
  };
}

function journeyCreateEventBody(input: {
  eventId: string;
  organizer: string;
  policy: { primaryPrice: number; [key: string]: unknown };
  seats: string[];
}): Record<string, unknown> {
  if (!isRecord(input.policy)) {
    throw new ProtocolError("create_event policy must be an object. The helper does not supply policy defaults.");
  }
  if (
    !Array.isArray(input.seats) ||
    input.seats.length === 0 ||
    input.seats.some((seat) => typeof seat !== "string" || seat.length === 0)
  ) {
    throw new ProtocolError("create_event seats must be a non-empty array of strings.");
  }
  return {
    domain: PINNED_PROTOCOL_DOMAIN,
    eventId: input.eventId,
    organizer: input.organizer,
    policy: input.policy,
    seats: [...input.seats],
  };
}

export function snapshot(body: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(body);
}

interface ThrownClass {
  disposition: "not-sent" | "rejected" | "unknown";
  code: string;
  requestId?: string;
  correlationId?: string;
}

export function classifyThrown(error: unknown): ThrownClass {
  if (error instanceof GateRejectedError) {
    return {
      disposition: "rejected",
      code: error.code ?? "GATE_REJECTED",
      requestId: error.requestId,
      correlationId: error.correlationId,
    };
  }
  if (error instanceof ProtocolError && error.requestId === undefined && error.correlationId === undefined) {
    return { disposition: "not-sent", code: error.code ?? "NOT_SENT" };
  }
  const code = error instanceof ProtocolError && error.code ? error.code : "UNKNOWN";
  return {
    disposition: "unknown",
    code,
    requestId: error instanceof ProtocolError ? error.requestId : undefined,
    correlationId: error instanceof ProtocolError ? error.correlationId : undefined,
  };
}

export function traceIdentity(base: CallIdentity, error: unknown): CallIdentity {
  if (error instanceof ProtocolError) {
    return withTrace(base, {
      code: error.code,
      requestId: error.requestId,
      correlationId: error.correlationId,
    });
  }
  return base;
}

export function withTrace(
  base: CallIdentity,
  trace: { code?: string; requestId?: string; correlationId?: string },
): CallIdentity {
  const identity: CallIdentity = {
    operationId: base.operationId,
    actor: base.actor,
    action: base.action,
    body: base.body,
  };
  if (trace.code !== undefined) {
    identity.code = trace.code;
  }
  if (trace.requestId !== undefined) {
    identity.requestId = trace.requestId;
  }
  if (trace.correlationId !== undefined) {
    identity.correlationId = trace.correlationId;
  }
  return identity;
}

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
  giftDeskQuote("offerCredit"),
  giftDeskQuote("acceptResale"),
  giftDeskQuote("cancelResaleListing"),
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
      (_body, receipt) => readAcceptGiftReceipt(receipt, this.gift),
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
    const identity = giftAttemptIdentity(step, operationId, actor);
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
}

function giftDeskQuote(method: GiftDeskNotBound["method"]): GiftDeskNotBound {
  const binding = COMMERCE_COMMAND_BINDINGS[method];
  return {
    method,
    consideredAction: binding.consideredAction,
    reason: binding.reason,
  };
}

function giftAttemptIdentity(step: GiftStep, operationId: string, actor: string): CallIdentity {
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

/**
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 * The booking journey composes nothing past accept_trade. This console is a
 * separate surface. It posts the organizer lifecycle commands below and does
 * not send capture or settle_capture. BookingJourney still does not compose
 * open_admission.
 */
export const ORGANIZER_COMPOSED = [
  "create_event",
  "close_sales",
  "open_admission",
  "complete_event",
  "cancel_event",
  "issue_invitation",
] as const;

export type OrganizerStep = (typeof ORGANIZER_COMPOSED)[number];

export interface OrganizerNotComposed {
  action: "capture" | "settle_capture" | "commit_trade" | "admit";
  reason: string;
}

export interface OrganizerDeskNotBound {
  method:
    | "cancelSettlement"
    | "cancelReservation"
    | "cancelCredit"
    | "registerReservationShow"
    | "checkAdmission";
  consideredAction: string | null;
  reason: string;
}

/**
 * Commands this helper records and does not send.
 * capture and settle_capture stay out under the journey ruling.
 * commit_trade and admit stay uncomposed. open_admission is not in this list:
 * the journey leaves it uncomposed, and this console is the surface that posts it.
 */
export const ORGANIZER_NOT_COMPOSED: readonly OrganizerNotComposed[] = [
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
    action: "admit",
    reason: `${JOURNEY_RULING}. admit stays uncomposed. ${COMMERCE_COMMAND_BINDINGS.checkAdmission.reason}`,
  },
];

/**
 * Desk methods quoted from the locked bindings. None of them is create_event
 * or cancel_event. checkAdmission stays admit.
 */
export const ORGANIZER_DESK_NOT_BOUND: readonly OrganizerDeskNotBound[] = [
  organizerDeskQuote("cancelSettlement"),
  organizerDeskQuote("cancelReservation"),
  organizerDeskQuote("cancelCredit"),
  organizerDeskQuote("registerReservationShow"),
  organizerDeskQuote("checkAdmission"),
];

export type OrganizerFenceReason =
  | { reason: "in-flight" }
  | { reason: "out-of-order" }
  | { reason: "already-sent" }
  | { reason: "halted"; identity: CallIdentity };

export interface OrganizerHalt {
  step: OrganizerStep;
  kind: "REJECTED" | "UNKNOWN" | "NOT_SENT";
  identity: CallIdentity;
}

export type OrganizerStepOutcome =
  | { kind: "RECEIPT"; step: OrganizerStep; receipt: Record<string, unknown> }
  | { kind: "REJECTED"; step: OrganizerStep; code: string; identity: CallIdentity }
  | { kind: "UNKNOWN"; step: OrganizerStep; code: string; identity: CallIdentity }
  | { kind: "FENCED"; step: OrganizerStep; blockedBy: OrganizerFenceReason; identity: CallIdentity };

export interface OrganizerState {
  sent: OrganizerStep[];
  halted: OrganizerHalt | null;
  notComposed: readonly OrganizerNotComposed[];
}

const OPERATOR = "operator";

export interface OrganizerPolicy {
  primaryPrice: number;
  [key: string]: unknown;
}

export interface OrganizerCreateInput {
  operationId: string;
  eventId: string;
  organizer: string;
  policy: OrganizerPolicy;
  seats: string[];
  invitationQuota?: number;
  /** Included only when the caller typed one. The helper does not default it. */
  reservationSeconds?: number;
}

/** Exact action, actor, and body a later send would post. Preview does no I/O. */
export interface OrganizerPreview {
  step: OrganizerStep;
  action: OrganizerStep;
  actor: string;
  body: Record<string, unknown>;
}

export interface OrganizerEventInput {
  operationId: string;
  eventId: string;
}

export interface OrganizerInvitationInput {
  operationId: string;
  eventId: string;
  inventoryId: string;
  expectedInventoryVersion: number;
  recipient: string;
  /** Actor for issue_invitation. Not written into the body. */
  organizer: string;
}

/**
 * Posts organizer lifecycle commands through an existing local-call invoker.
 * create_event is optional. The gate decides whether a later command is legal.
 * Each non-invitation step is sent at most once. issue_invitation is once per
 * inventoryId. A rejection, an unknown outcome, or a pre-send failure fences
 * every later write. This class does not retry, does not mint an operationId,
 * and does not send capture or settle_capture.
 * out-of-order is part of the fence vocabulary and is not produced: this
 * console does not copy a lifecycle order.
 */
export class OrganizerConsole {
  private sent: OrganizerStep[] = [];
  private readonly issued = new Set<string>();
  private halted: OrganizerHalt | null = null;
  private inFlight = false;

  constructor(private readonly invoker: LocalCallInvoker) {}

  state(): OrganizerState {
    return {
      sent: [...this.sent],
      halted: this.halted,
      notComposed: ORGANIZER_NOT_COMPOSED,
    };
  }

  createEvent(input: OrganizerCreateInput): Promise<OrganizerStepOutcome> {
    return this.run(
      "create_event",
      input.operationId,
      OPERATOR,
      undefined,
      () => organizerCreateEventBody(input),
      (body, receipt) => readOrganizerCreateReceipt(body, receipt),
    );
  }

  closeSales(input: OrganizerEventInput): Promise<OrganizerStepOutcome> {
    return this.eventStep("close_sales", input, readCloseReceipt);
  }

  openAdmission(input: OrganizerEventInput): Promise<OrganizerStepOutcome> {
    return this.eventStep("open_admission", input, readOpenReceipt);
  }

  completeEvent(input: OrganizerEventInput): Promise<OrganizerStepOutcome> {
    return this.eventStep("complete_event", input, readRecordResult);
  }

  cancelEvent(input: OrganizerEventInput): Promise<OrganizerStepOutcome> {
    return this.eventStep("cancel_event", input, readRecordResult);
  }

  issueInvitation(input: OrganizerInvitationInput): Promise<OrganizerStepOutcome> {
    return this.run(
      "issue_invitation",
      input.operationId,
      input.organizer,
      input.inventoryId,
      () => invitationBody(input),
      (_body, receipt) => readIssueReceipt(receipt),
    );
  }

  private eventStep(
    step: "close_sales" | "open_admission" | "complete_event" | "cancel_event",
    input: OrganizerEventInput,
    remember: (receipt: Record<string, unknown>) => boolean,
  ): Promise<OrganizerStepOutcome> {
    return this.run(step, input.operationId, OPERATOR, undefined, () => eventBody(input.eventId), (_body, receipt) =>
      remember(receipt),
    );
  }

  private async run(
    step: OrganizerStep,
    operationId: string,
    actor: string,
    inventoryId: string | undefined,
    build: () => Record<string, unknown>,
    remember: (body: Record<string, unknown>, receipt: Record<string, unknown>) => boolean,
  ): Promise<OrganizerStepOutcome> {
    const fenced = this.fence(step, operationId, actor, inventoryId);
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
      this.sent.push(step);
      if (step === "issue_invitation" && typeof sent.inventoryId === "string") {
        this.issued.add(sent.inventoryId);
      }
      return { kind: "RECEIPT", step, receipt: parsed };
    } finally {
      this.inFlight = false;
    }
  }

  private fence(
    step: OrganizerStep,
    operationId: string,
    actor: string,
    inventoryId: string | undefined,
  ): OrganizerStepOutcome | null {
    const identity = organizerAttemptIdentity(step, operationId, actor);
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
    if (step === "issue_invitation") {
      if (inventoryId !== undefined && this.issued.has(inventoryId)) {
        return { kind: "FENCED", step, blockedBy: { reason: "already-sent" }, identity };
      }
      return null;
    }
    if (this.sent.includes(step)) {
      return { kind: "FENCED", step, blockedBy: { reason: "already-sent" }, identity };
    }
    return null;
  }

  private halt(step: OrganizerStep, kind: OrganizerHalt["kind"], identity: CallIdentity): void {
    this.halted = { step, kind, identity };
  }

  private unknownReceipt(
    step: OrganizerStep,
    body: Record<string, unknown>,
    operationId: string,
    actor: string,
    code: string,
  ): OrganizerStepOutcome {
    const identity: CallIdentity = { operationId, actor, action: step, body, code };
    this.halt(step, "UNKNOWN", identity);
    return { kind: "UNKNOWN", step, code, identity };
  }
}

function organizerDeskQuote(method: OrganizerDeskNotBound["method"]): OrganizerDeskNotBound {
  const binding = COMMERCE_COMMAND_BINDINGS[method];
  return {
    method,
    consideredAction: binding.consideredAction,
    reason: binding.reason,
  };
}

function organizerAttemptIdentity(step: OrganizerStep, operationId: string, actor: string): CallIdentity {
  return {
    operationId,
    actor,
    action: step,
    body: {},
  };
}

function organizerCreateEventBody(input: OrganizerCreateInput): Record<string, unknown> {
  if (!isRecord(input.policy)) {
    throw new ProtocolError("create_event policy must be an object. The helper does not supply policy defaults.");
  }
  if (
    !Array.isArray(input.seats) ||
    input.seats.length === 0 ||
    input.seats.some((seat) => typeof seat !== "string" || seat.length === 0)
  ) {
    throw new ProtocolError("create_event seats must be a non-empty array of strings.");
  }
  const body: Record<string, unknown> = {
    domain: PINNED_PROTOCOL_DOMAIN,
    eventId: input.eventId,
    organizer: input.organizer,
    policy: input.policy,
    seats: [...input.seats],
  };
  if (input.invitationQuota !== undefined) {
    body.invitationQuota = input.invitationQuota;
  }
  if (input.reservationSeconds !== undefined) {
    body.reservationSeconds = input.reservationSeconds;
  }
  return body;
}

/**
 * Builds the envelope a send would post and returns the body the invoker would see.
 * It does not call the invoker and does not change console state.
 */
export function previewOrganizerStep(
  step: OrganizerStep,
  input: OrganizerCreateInput | OrganizerEventInput | OrganizerInvitationInput,
): OrganizerPreview {
  if (step === "create_event") {
    if (!isCreateInput(input)) {
      throw new ProtocolError("create_event preview needs organizer, policy, and seats.");
    }
    return sealPreview(step, input.operationId, OPERATOR, organizerCreateEventBody(input));
  }
  if (step === "issue_invitation") {
    if (!isInvitationInput(input)) {
      throw new ProtocolError(
        "issue_invitation preview needs inventoryId, expectedInventoryVersion, recipient, and organizer.",
      );
    }
    return sealPreview(step, input.operationId, input.organizer, invitationBody(input));
  }
  if (!isEventInput(input)) {
    throw new ProtocolError("Event preview needs an eventId.");
  }
  return sealPreview(step, input.operationId, OPERATOR, eventBody(input.eventId));
}

function sealPreview(
  step: OrganizerStep,
  operationId: string,
  actor: string,
  body: Record<string, unknown>,
): OrganizerPreview {
  const envelope = buildLocalCallEnvelope({ operationId, actor, action: step, body });
  return { step, action: step, actor: envelope.actor, body: snapshot(envelope.body) };
}

function isCreateInput(
  input: OrganizerCreateInput | OrganizerEventInput | OrganizerInvitationInput,
): input is OrganizerCreateInput {
  return "seats" in input && "policy" in input;
}

function isInvitationInput(
  input: OrganizerCreateInput | OrganizerEventInput | OrganizerInvitationInput,
): input is OrganizerInvitationInput {
  return "inventoryId" in input && "recipient" in input && "expectedInventoryVersion" in input;
}

function isEventInput(
  input: OrganizerCreateInput | OrganizerEventInput | OrganizerInvitationInput,
): input is OrganizerEventInput {
  return "eventId" in input && "operationId" in input;
}

function eventBody(eventId: string): Record<string, unknown> {
  return {
    domain: PINNED_PROTOCOL_DOMAIN,
    eventId,
  };
}

function invitationBody(input: OrganizerInvitationInput): Record<string, unknown> {
  if (input.eventId.length === 0) {
    throw new ProtocolError("issue_invitation eventId is caller-supplied. It is not part of the body.");
  }
  return {
    domain: PINNED_PROTOCOL_DOMAIN,
    inventoryId: input.inventoryId,
    expectedInventoryVersion: input.expectedInventoryVersion,
    recipient: input.recipient,
  };
}

/**
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 * Consent posts set_consent, then authorize_marketing. It does not send
 * capture or settle_capture. placeHold stays not-bound.
 */
export const CONSENT_COMPOSED = ["set_consent", "authorize_marketing"] as const;

export type ConsentStep = (typeof CONSENT_COMPOSED)[number];

/**
 * Observed on the reviewed gate: authorize_marketing calls role("marketing-adapter").
 * Any other actor is UNAUTHORIZED_FIXTURE_ACTOR. This is the local-call actor,
 * not an authentication result, and it is not a body field.
 */
export const CONSENT_AUTHORIZE_ACTOR = "marketing-adapter";

export interface ConsentNotComposed {
  action: "capture" | "settle_capture";
  reason: string;
}

export interface ConsentDeskNotBound {
  method: "placeHold";
  consideredAction: string | null;
  reason: string;
}

/**
 * Commands this helper records and does not send.
 * capture and settle_capture stay out under the journey ruling.
 */
export const CONSENT_NOT_COMPOSED: readonly ConsentNotComposed[] = [
  {
    action: "capture",
    reason: `${JOURNEY_RULING}. The adapter composes nothing past accept_trade. capture is never composed and never sent. ${COMMERCE_COMMAND_BINDINGS.confirmBooking.reason}`,
  },
  {
    action: "settle_capture",
    reason: `${JOURNEY_RULING}. settle_capture stays out of the journey and is never sent. ${COMMERCE_COMMAND_BINDINGS.settlementPreview.reason}`,
  },
];

/**
 * Desk method quoted from the locked bindings.
 * placeHold stays reserve_listing. It is not set_consent.
 */
export const CONSENT_DESK_NOT_BOUND: readonly ConsentDeskNotBound[] = [consentDeskQuote()];

export type ConsentFenceReason =
  | { reason: "in-flight" }
  | { reason: "out-of-order" }
  | { reason: "already-sent" }
  | { reason: "halted"; identity: CallIdentity };

export interface ConsentHalt {
  step: ConsentStep;
  kind: "REJECTED" | "UNKNOWN" | "NOT_SENT";
  identity: CallIdentity;
}

export type ConsentStepOutcome =
  | { kind: "RECEIPT"; step: ConsentStep; receipt: Record<string, unknown> }
  | { kind: "REJECTED"; step: ConsentStep; code: string; identity: CallIdentity }
  | { kind: "UNKNOWN"; step: ConsentStep; code: string; identity: CallIdentity }
  | { kind: "FENCED"; step: ConsentStep; blockedBy: ConsentFenceReason; identity: CallIdentity };

export interface ConsentState {
  consented: boolean;
  allowed: boolean | null;
  authorized: boolean;
  halted: ConsentHalt | null;
  notComposed: readonly ConsentNotComposed[];
}

export interface ConsentSetInput {
  operationId: string;
  /** Local-call actor for set_consent. Not written into the body. */
  subject: string;
  allowed: boolean;
  business: string;
  channel: string;
  eventId: string;
  expectedConsentVersion: number;
  purpose: string;
}

export interface ConsentAuthorizeInput {
  operationId: string;
  business: string;
  channel: string;
  eventId: string;
  expectedConsentVersion: number;
  purpose: string;
  subject: string;
}

/**
 * Posts set_consent, then authorize_marketing, through an existing local-call
 * invoker. Each step is one caller-chosen operationId. A further set_consent
 * is how a caller records allowed false. A rejection, an unknown outcome, or
 * a pre-send failure fences every later write. This class does not retry,
 * does not mint an operationId, does not add one to a version, and does not
 * send capture or settle_capture. business, channel, purpose, subject, and
 * expectedConsentVersion have no default.
 */
export class ConsentBind {
  private consented = false;
  private allowed: boolean | null = null;
  private authorized = false;
  private halted: ConsentHalt | null = null;
  private inFlight = false;

  constructor(private readonly invoker: LocalCallInvoker) {}

  state(): ConsentState {
    return {
      consented: this.consented,
      allowed: this.allowed,
      authorized: this.authorized,
      halted: this.halted,
      notComposed: CONSENT_NOT_COMPOSED,
    };
  }

  setConsent(input: ConsentSetInput): Promise<ConsentStepOutcome> {
    return this.run("set_consent", input.operationId, input.subject, () => setBody(input), (body, receipt) =>
      readSetReceipt(body, receipt),
    );
  }

  authorizeMarketing(input: ConsentAuthorizeInput): Promise<ConsentStepOutcome> {
    return this.run(
      "authorize_marketing",
      input.operationId,
      CONSENT_AUTHORIZE_ACTOR,
      () => authorizeBody(input),
      (_body, receipt) => readAuthorizeReceipt(input, receipt),
    );
  }

  private async run(
    step: ConsentStep,
    operationId: string,
    actor: string,
    build: () => Record<string, unknown>,
    remember: (body: Record<string, unknown>, receipt: Record<string, unknown>) => boolean,
  ): Promise<ConsentStepOutcome> {
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
      if (step === "set_consent") {
        this.consented = true;
        this.allowed = sent.allowed === true;
        this.authorized = false;
      } else {
        this.authorized = true;
      }
      return { kind: "RECEIPT", step, receipt: parsed };
    } finally {
      this.inFlight = false;
    }
  }

  private fence(step: ConsentStep, operationId: string, actor: string): ConsentStepOutcome | null {
    const identity = consentAttemptIdentity(step, operationId, actor);
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
    if (step === "set_consent") {
      return null;
    }
    if (!this.consented || this.allowed !== true) {
      return { kind: "FENCED", step, blockedBy: { reason: "out-of-order" }, identity };
    }
    if (this.authorized) {
      return { kind: "FENCED", step, blockedBy: { reason: "already-sent" }, identity };
    }
    return null;
  }

  private halt(step: ConsentStep, kind: ConsentHalt["kind"], identity: CallIdentity): void {
    this.halted = { step, kind, identity };
  }

  private unknownReceipt(
    step: ConsentStep,
    body: Record<string, unknown>,
    operationId: string,
    actor: string,
    code: string,
  ): ConsentStepOutcome {
    const identity: CallIdentity = { operationId, actor, action: step, body, code };
    this.halt(step, "UNKNOWN", identity);
    return { kind: "UNKNOWN", step, code, identity };
  }
}

function consentDeskQuote(): ConsentDeskNotBound {
  const binding = COMMERCE_COMMAND_BINDINGS.placeHold;
  return {
    method: "placeHold",
    consideredAction: binding.consideredAction,
    reason: binding.reason,
  };
}

function consentAttemptIdentity(step: ConsentStep, operationId: string, actor: string): CallIdentity {
  return {
    operationId,
    actor,
    action: step,
    body: {},
  };
}

function setBody(input: ConsentSetInput): Record<string, unknown> {
  if (typeof input.subject !== "string") {
    throw new ProtocolError("set_consent subject must be a string.");
  }
  return {
    domain: PINNED_PROTOCOL_DOMAIN,
    allowed: input.allowed,
    business: input.business,
    channel: input.channel,
    eventId: input.eventId,
    expectedConsentVersion: input.expectedConsentVersion,
    purpose: input.purpose,
  };
}

function authorizeBody(input: ConsentAuthorizeInput): Record<string, unknown> {
  return {
    domain: PINNED_PROTOCOL_DOMAIN,
    business: input.business,
    channel: input.channel,
    eventId: input.eventId,
    expectedConsentVersion: input.expectedConsentVersion,
    purpose: input.purpose,
    subject: input.subject,
  };
}
