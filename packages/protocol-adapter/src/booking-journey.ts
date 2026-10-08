import { COMMERCE_COMMAND_BINDINGS } from "./commerce-bindings.js";
import { GateRejectedError } from "./http-adapter.js";
import { type LocalCallInput, buildLocalCallEnvelope } from "./local-call.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import { assertLocalCallReceipt } from "./payload-guards.js";
import { isRecord } from "./record.js";
import { ProtocolError } from "./types.js";

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
  deskQuote("placeHold"),
  deskQuote("confirmBooking"),
  deskQuote("settlementPreview"),
  deskQuote("checkAdmission"),
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

const CREATE_RESULT_KEYS = ["eventId", "policyHash", "inventoryIds", "reservationSeconds"] as const;
const PREPARE_RESULT_KEYS = ["tradeId", "ticketId", "externalOrderId", "status", "termsHash"] as const;
const ACCEPT_RESULT_KEYS = ["accepted"] as const;

interface CreatedEvent {
  eventId: string;
  primaryPrice: unknown;
  inventoryIds: string[];
}

interface PreparedTrade {
  tradeId: string;
  termsHash: string;
  buyer: string;
}

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
    return this.run("create_event", input.operationId, CREATE_ACTOR, () => createEventBody(input), (body, receipt) => {
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

function deskQuote(method: JourneyDeskNotBound["method"]): JourneyDeskNotBound {
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

function attemptIdentity(step: JourneyStep, operationId: string, actor: string): CallIdentity {
  return {
    operationId,
    actor,
    action: step,
    body: {},
  };
}

function createEventBody(input: {
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

function readCreateReceipt(body: Record<string, unknown>, receipt: Record<string, unknown>): CreatedEvent | null {
  const result = closedResult(receipt, CREATE_RESULT_KEYS);
  if (result === null) {
    return null;
  }
  const seats = body.seats;
  if (!Array.isArray(seats)) {
    return null;
  }
  if (typeof result.eventId !== "string" || result.eventId !== body.eventId) {
    return null;
  }
  if (typeof result.policyHash !== "string" || result.policyHash.length === 0) {
    return null;
  }
  if (!Array.isArray(result.inventoryIds) || result.inventoryIds.length !== seats.length || result.inventoryIds.length === 0) {
    return null;
  }
  const inventoryIds = result.inventoryIds.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (inventoryIds.length !== seats.length) {
    return null;
  }
  if (typeof result.reservationSeconds !== "number" || !Number.isInteger(result.reservationSeconds)) {
    return null;
  }
  const policy = body.policy;
  return {
    eventId: result.eventId,
    primaryPrice: isRecord(policy) ? policy.primaryPrice : undefined,
    inventoryIds,
  };
}

function readPrepareReceipt(body: Record<string, unknown>, receipt: Record<string, unknown>): PreparedTrade | null {
  const result = closedResult(receipt, PREPARE_RESULT_KEYS);
  if (result === null) {
    return null;
  }
  if (typeof result.tradeId !== "string" || result.tradeId !== body.tradeId || result.status !== "PREPARED") {
    return null;
  }
  if (typeof result.ticketId !== "string" || result.ticketId.length === 0) {
    return null;
  }
  if (typeof result.externalOrderId !== "string" || result.externalOrderId.length === 0) {
    return null;
  }
  if (typeof result.termsHash !== "string" || result.termsHash.length === 0) {
    return null;
  }
  if (typeof body.buyer !== "string" || body.buyer.length === 0) {
    return null;
  }
  return { tradeId: result.tradeId, termsHash: result.termsHash, buyer: body.buyer };
}

function readAcceptReceipt(receipt: Record<string, unknown>): boolean {
  const result = closedResult(receipt, ACCEPT_RESULT_KEYS);
  return result !== null && result.accepted === true;
}

function closedResult(
  receipt: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> | null {
  if (!isRecord(receipt.result) || !sameKeys(receipt.result, keys)) {
    return null;
  }
  return receipt.result;
}

function sameKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function snapshot(body: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(body);
}

interface ThrownClass {
  disposition: "not-sent" | "rejected" | "unknown";
  code: string;
  requestId?: string;
  correlationId?: string;
}

function classifyThrown(error: unknown): ThrownClass {
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

function traceIdentity(base: CallIdentity, error: unknown): CallIdentity {
  if (error instanceof ProtocolError) {
    return withTrace(base, {
      code: error.code,
      requestId: error.requestId,
      correlationId: error.correlationId,
    });
  }
  return base;
}

function withTrace(
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
