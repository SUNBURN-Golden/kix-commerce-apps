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
  deskQuote("cancelSettlement"),
  deskQuote("cancelReservation"),
  deskQuote("cancelCredit"),
  deskQuote("registerReservationShow"),
  deskQuote("checkAdmission"),
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

const CREATE_RESULT_KEYS = ["eventId", "policyHash", "inventoryIds", "reservationSeconds"] as const;

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
      () => createEventBody(input),
      (body, receipt) => readCreateReceipt(body, receipt),
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

function deskQuote(method: OrganizerDeskNotBound["method"]): OrganizerDeskNotBound {
  const binding = COMMERCE_COMMAND_BINDINGS[method];
  return {
    method,
    consideredAction: binding.consideredAction,
    reason: binding.reason,
  };
}

function attemptIdentity(step: OrganizerStep, operationId: string, actor: string): CallIdentity {
  return {
    operationId,
    actor,
    action: step,
    body: {},
  };
}

function createEventBody(input: OrganizerCreateInput): Record<string, unknown> {
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
  return body;
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

function readCreateReceipt(body: Record<string, unknown>, receipt: Record<string, unknown>): boolean {
  const result = closedResult(receipt, CREATE_RESULT_KEYS);
  if (result === null) {
    return false;
  }
  const seats = body.seats;
  if (!Array.isArray(seats)) {
    return false;
  }
  if (typeof result.eventId !== "string" || result.eventId !== body.eventId) {
    return false;
  }
  if (typeof result.policyHash !== "string" || result.policyHash.length === 0) {
    return false;
  }
  if (!Array.isArray(result.inventoryIds) || result.inventoryIds.length !== seats.length || result.inventoryIds.length === 0) {
    return false;
  }
  const inventoryIds = result.inventoryIds.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (inventoryIds.length !== seats.length) {
    return false;
  }
  return typeof result.reservationSeconds === "number" && Number.isInteger(result.reservationSeconds);
}

function readCloseReceipt(receipt: Record<string, unknown>): boolean {
  return isRecord(receipt.result) && receipt.result.salesStatus === "CLOSED";
}

function readOpenReceipt(receipt: Record<string, unknown>): boolean {
  const result = closedResult(receipt, ["admissionStatus"]);
  return result !== null && result.admissionStatus === "OPEN";
}

function readIssueReceipt(receipt: Record<string, unknown>): boolean {
  if (!isRecord(receipt.result)) {
    return false;
  }
  return (
    typeof receipt.result.ticketId === "string" &&
    receipt.result.ticketId.length > 0 &&
    receipt.result.financialEntries === 0
  );
}

function readRecordResult(receipt: Record<string, unknown>): boolean {
  return isRecord(receipt.result);
}
