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
export const CONSENT_DESK_NOT_BOUND: readonly ConsentDeskNotBound[] = [deskQuote()];

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

const SET_RESULT_KEYS = ["allowed", "consentVersion"] as const;
const AUTHORIZE_RESULT_KEYS = [
  "authorizedAt",
  "consentVersion",
  "dispatchDecision",
  "networkSendPerformed",
] as const;

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

function deskQuote(): ConsentDeskNotBound {
  const binding = COMMERCE_COMMAND_BINDINGS.placeHold;
  return {
    method: "placeHold",
    consideredAction: binding.consideredAction,
    reason: binding.reason,
  };
}

function attemptIdentity(step: ConsentStep, operationId: string, actor: string): CallIdentity {
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

function readSetReceipt(body: Record<string, unknown>, receipt: Record<string, unknown>): boolean {
  const result = closedResult(receipt, SET_RESULT_KEYS);
  if (result === null) {
    return false;
  }
  if (typeof result.allowed !== "boolean" || result.allowed !== body.allowed) {
    return false;
  }
  return typeof result.consentVersion === "number" && Number.isInteger(result.consentVersion);
}

function readAuthorizeReceipt(input: ConsentAuthorizeInput, receipt: Record<string, unknown>): boolean {
  const result = closedResult(receipt, AUTHORIZE_RESULT_KEYS);
  if (result === null) {
    return false;
  }
  if (result.dispatchDecision !== "AUTHORIZED_FIXTURE_INTENT" || result.networkSendPerformed !== false) {
    return false;
  }
  if (typeof result.authorizedAt !== "number" || !Number.isInteger(result.authorizedAt)) {
    return false;
  }
  return result.consentVersion === input.expectedConsentVersion && Number.isInteger(result.consentVersion);
}
