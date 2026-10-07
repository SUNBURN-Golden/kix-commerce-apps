import { COMMERCE_COMMAND_BINDINGS } from "./commerce-bindings.js";
import { buildLocalCallEnvelope, type LocalCallInput } from "./local-call.js";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import { assertLocalCallReceipt, enforceRemotePayloadGuards } from "./payload-guards.js";
import { isRecord } from "./record.js";
import { ProtocolError } from "./types.js";

/**
 * One local-call transport. The desk stub has no catalogue caller.
 * HTTP mode passes HttpProtocolAdapter. A test can pass a fake.
 */
export interface JourneyLocalCaller {
  invokeLocalCall(input: LocalCallInput): Promise<unknown>;
}

export interface JourneyShowPolicy {
  readonly primaryPrice: number;
  readonly resaleCap: number;
  readonly primaryFeeBps: number;
  readonly resaleFeeBps: number;
  readonly resaleOrganizerBps: number;
  readonly resaleAllowed: boolean;
  readonly refundProfile: string;
}

/**
 * Operation ids are the caller's. This helper never mints or replaces one.
 */
export interface PrimarySeatJourneyInput {
  readonly operationIds: {
    readonly createEvent: string;
    readonly prepareTrade: string;
    readonly acceptTrade: string;
    readonly capture: string;
    readonly commitTrade: string;
    readonly openAdmission: string;
    readonly admit: string;
  };
  readonly eventId: string;
  readonly organizer: string;
  readonly buyer: string;
  readonly tradeId: string;
  readonly paymentId: string;
  readonly seats: readonly string[];
  readonly policy: JourneyShowPolicy;
}

export interface CatalogueReceipt {
  readonly domain: string;
  readonly operationId: string;
  readonly sequence: number;
  readonly action: string;
  readonly result: Record<string, unknown>;
}

export const JOURNEY_COMPOSED_ACTIONS = [
  "create_event", "prepare_trade", "accept_trade", "capture", "commit_trade", "open_admission", "admit",
] as const;

export type JourneyComposedAction = (typeof JOURNEY_COMPOSED_ACTIONS)[number];

export interface JourneyComposedStep {
  readonly action: JourneyComposedAction;
  readonly operationId: string;
  readonly receipt: CatalogueReceipt;
}

export type JourneyFenceOutcome = "UNKNOWN" | "INVALID_RECEIPT" | "STALE_RESPONSE" | "REJECTED";

export interface JourneyFence {
  readonly outcome: JourneyFenceOutcome;
  readonly action: JourneyComposedAction;
  readonly operationId: string;
  readonly code: string;
  /** Present only when the transport returned a body this helper could read. */
  readonly receipt: CatalogueReceipt | null;
}

/**
 * Bindings already recorded on main. placeHold stays not-bound to
 * reserve_listing. confirmBooking does not send capture. Settlement does
 * not send settle_capture. This helper copies those reasons and does not
 * write a new placeHold mapping.
 */
export const JOURNEY_NOT_BOUND = [
  {
    deskMethod: "placeHold",
    status: COMMERCE_COMMAND_BINDINGS.placeHold.status,
    consideredAction: COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction,
    reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
    sends: false,
  },
  {
    deskMethod: "confirmBooking",
    status: COMMERCE_COMMAND_BINDINGS.confirmBooking.status,
    consideredAction: COMMERCE_COMMAND_BINDINGS.confirmBooking.consideredAction,
    reason: COMMERCE_COMMAND_BINDINGS.confirmBooking.reason,
    sends: false,
  },
  {
    deskMethod: "settlementPreview",
    status: COMMERCE_COMMAND_BINDINGS.settlementPreview.status,
    consideredAction: COMMERCE_COMMAND_BINDINGS.settlementPreview.consideredAction,
    reason: COMMERCE_COMMAND_BINDINGS.settlementPreview.reason,
    sends: false,
  },
] as const;

/**
 * Optional settlement is not required for reference issuance. Desk hold and
 * resale remain separate. See the 2026-10-07 PR26 User decision.
 */
export const JOURNEY_UNCOMPOSED = [
  {
    action: "settle_capture",
    reason: "Optional synthetic settlement is omitted. Reference issuance does not require it; capture is not available cash.",
  },
  {
    action: "reserve_listing",
    reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
  },
] as const;

export interface PrimarySeatJourneyResult {
  readonly composed: readonly JourneyComposedStep[];
  readonly fence: JourneyFence | null;
  readonly notBound: typeof JOURNEY_NOT_BOUND;
  readonly uncomposed: typeof JOURNEY_UNCOMPOSED;
}

const UNKNOWN_CODES = new Set(["REQUEST_TIMEOUT", "GATE_UNAVAILABLE", "GATE_TRANSPORT"]);

/**
 * Composes the approved synthetic primary-seat journey through invokeLocalCall.
 * Each call is one attempt. A lost response, an invalid receipt, UNKNOWN, or a
 * rejection fences the next write. No desk API is bound and no real funds move.
 */
export async function composePrimarySeatJourney(
  caller: JourneyLocalCaller,
  input: PrimarySeatJourneyInput,
): Promise<PrimarySeatJourneyResult> {
  // Snapshot this invocation before the first await. A caller may reuse its form
  // object while a transport is pending; later steps must keep this intent.
  const intent: PrimarySeatJourneyInput = {
    ...input,
    operationIds: { ...input.operationIds },
    seats: [...input.seats],
    policy: showPolicy(input.policy),
  };
  const composed: JourneyComposedStep[] = [];
  const policy = intent.policy;
  const ids = [intent.operationIds.createEvent, intent.operationIds.prepareTrade, intent.operationIds.acceptTrade,
    intent.operationIds.capture, intent.operationIds.commitTrade, intent.operationIds.openAdmission, intent.operationIds.admit];
  if (ids.some((id) => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length ||
      typeof intent.paymentId !== "string" || !intent.paymentId.trim()) {
    return result(composed, { outcome: "REJECTED", action: "create_event",
      operationId: intent.operationIds.createEvent, code: "INVALID_JOURNEY_INPUT", receipt: null });
  }

  const created = await takeStep(caller, {
    operationId: intent.operationIds.createEvent,
    actor: "operator",
    action: "create_event",
    body: {
      domain: PINNED_PROTOCOL_DOMAIN,
      eventId: intent.eventId,
      organizer: intent.organizer,
      policy: { ...policy },
      seats: [...intent.seats],
    },
  });
  if (created.fence) {
    return result(composed, created.fence);
  }
  const inventoryId = causalInventoryId(created.receipt, intent.eventId);
  if (typeof inventoryId !== "string") {
    return result(composed, inventoryId);
  }
  composed.push({
    action: "create_event",
    operationId: intent.operationIds.createEvent,
    receipt: created.receipt,
  });

  const prepared = await takeStep(caller, {
    operationId: intent.operationIds.prepareTrade,
    actor: intent.buyer,
    action: "prepare_trade",
    body: {
      domain: PINNED_PROTOCOL_DOMAIN,
      tradeId: intent.tradeId,
      inventoryId,
      buyer: intent.buyer,
      amount: policy.primaryPrice,
      expectedInventoryVersion: 0,
      expectedVersion: 0,
    },
  });
  if (prepared.fence) {
    return result(composed, prepared.fence);
  }
  const termsHash = causalTermsHash(prepared.receipt, intent.tradeId);
  if (typeof termsHash !== "string") {
    return result(composed, termsHash);
  }
  // Snapshot causal identity before awaiting later calls; never derive an order
  // from a trade ID or use a caller-mutated receipt as a new authority.
  const externalOrderId = prepared.receipt.result.externalOrderId as string;
  const ticketId = prepared.receipt.result.ticketId as string;
  composed.push({
    action: "prepare_trade",
    operationId: intent.operationIds.prepareTrade,
    receipt: prepared.receipt,
  });

  const accepted = await takeStep(caller, {
    operationId: intent.operationIds.acceptTrade,
    actor: intent.buyer,
    action: "accept_trade",
    body: {
      domain: PINNED_PROTOCOL_DOMAIN,
      tradeId: intent.tradeId,
      termsHash,
    },
  });
  if (accepted.fence) {
    return result(composed, accepted.fence);
  }
  const acceptedFence = causalAccepted(accepted.receipt, intent.operationIds.acceptTrade);
  if (acceptedFence) {
    return result(composed, acceptedFence);
  }
  composed.push({
    action: "accept_trade",
    operationId: intent.operationIds.acceptTrade,
    receipt: accepted.receipt,
  });

  const captured = await takeStep(caller, {
    operationId: intent.operationIds.capture, actor: "pg-adapter", action: "capture",
    body: { domain: PINNED_PROTOCOL_DOMAIN, tradeId: intent.tradeId, orderId: externalOrderId,
      buyer: intent.buyer, amount: policy.primaryPrice, currency: "KRW", paymentId: intent.paymentId,
      provenance: "synthetic",
      scope: { provider: "toss", environment: "test", merchant: "kix-fixture", channel: "card" } },
  });
  if (captured.fence) return result(composed, captured.fence);
  if (captured.receipt.result.captured !== true || captured.receipt.result.cashAvailable !== false) {
    return result(composed, invalidReceipt(captured.receipt));
  }
  composed.push({ action: "capture", operationId: intent.operationIds.capture, receipt: captured.receipt });

  const committed = await takeStep(caller, {
    operationId: intent.operationIds.commitTrade, actor: "operator", action: "commit_trade",
    body: { domain: PINNED_PROTOCOL_DOMAIN, tradeId: intent.tradeId },
  });
  if (committed.fence) return result(composed, committed.fence);
  const presentation = { ...committed.receipt.result };
  if (presentation.ticketId !== ticketId || presentation.owner !== intent.buyer ||
      !positiveVersion(presentation.rightsVersion) || !positiveVersion(presentation.admissionEpoch)) {
    return result(composed, invalidReceipt(committed.receipt));
  }
  composed.push({ action: "commit_trade", operationId: intent.operationIds.commitTrade, receipt: committed.receipt });

  const opened = await takeStep(caller, {
    operationId: intent.operationIds.openAdmission, actor: "operator", action: "open_admission",
    body: { domain: PINNED_PROTOCOL_DOMAIN, eventId: intent.eventId },
  });
  if (opened.fence) return result(composed, opened.fence);
  if (opened.receipt.result.admissionStatus !== "OPEN") return result(composed, invalidReceipt(opened.receipt));
  composed.push({ action: "open_admission", operationId: intent.operationIds.openAdmission, receipt: opened.receipt });

  const admitted = await takeStep(caller, {
    operationId: intent.operationIds.admit, actor: "venue", action: "admit",
    body: { domain: PINNED_PROTOCOL_DOMAIN, ticketId: presentation.ticketId, holder: presentation.owner,
      expectedVersion: presentation.rightsVersion, admissionEpoch: presentation.admissionEpoch },
  });
  if (admitted.fence) return result(composed, admitted.fence);
  if (admitted.receipt.result.decision !== "ADMITTED_ONCE" ||
      admitted.receipt.result.admissionId !== intent.operationIds.admit) {
    return result(composed, invalidReceipt(admitted.receipt));
  }
  composed.push({ action: "admit", operationId: intent.operationIds.admit, receipt: admitted.receipt });
  return result(composed, null);
}

function positiveVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function invalidReceipt(receipt: CatalogueReceipt): JourneyFence {
  return { outcome: "INVALID_RECEIPT", action: receipt.action as JourneyComposedAction,
    operationId: receipt.operationId, code: "GATE_STATUS", receipt };
}

function result(composed: readonly JourneyComposedStep[], fence: JourneyFence | null): PrimarySeatJourneyResult {
  return {
    composed,
    fence,
    notBound: JOURNEY_NOT_BOUND,
    uncomposed: JOURNEY_UNCOMPOSED,
  };
}

function showPolicy(policy: JourneyShowPolicy): JourneyShowPolicy {
  return {
    primaryPrice: policy.primaryPrice,
    resaleCap: policy.resaleCap,
    primaryFeeBps: policy.primaryFeeBps,
    resaleFeeBps: policy.resaleFeeBps,
    resaleOrganizerBps: policy.resaleOrganizerBps,
    resaleAllowed: policy.resaleAllowed,
    refundProfile: policy.refundProfile,
  };
}

type StepTaken =
  | { readonly receipt: CatalogueReceipt; readonly fence?: undefined }
  | { readonly fence: JourneyFence; readonly receipt?: undefined };

async function takeStep(
  caller: JourneyLocalCaller,
  input: LocalCallInput & { action: JourneyComposedAction },
): Promise<StepTaken> {
  try {
    buildLocalCallEnvelope(input);
  } catch (error) {
    return { fence: fenceFrom(error, input.action, input.operationId, null) };
  }
  let body: unknown;
  try {
    body = await caller.invokeLocalCall(input);
  } catch (error) {
    return { fence: fenceFrom(error, input.action, input.operationId, null) };
  }
  try {
    enforceRemotePayloadGuards(body);
    assertLocalCallReceipt(body, { action: input.action, operationId: input.operationId });
  } catch (error) {
    return { fence: fenceFrom(error, input.action, input.operationId, asCatalogueReceipt(body)) };
  }
  return { receipt: body as CatalogueReceipt };
}

function fenceFrom(
  error: unknown,
  action: JourneyComposedAction,
  operationId: string,
  receipt: CatalogueReceipt | null,
): JourneyFence {
  if (!(error instanceof ProtocolError)) {
    return { outcome: "UNKNOWN", action, operationId, code: "UNKNOWN", receipt: null };
  }
  const code = error.code ?? "REJECTED";
  if (code === "STALE_RESPONSE") {
    return { outcome: "STALE_RESPONSE", action, operationId, code, receipt };
  }
  if (code === "GATE_STATUS" || code === "PRODUCTION_ENDPOINT") {
    return { outcome: "INVALID_RECEIPT", action, operationId, code, receipt };
  }
  if (UNKNOWN_CODES.has(code)) {
    return { outcome: "UNKNOWN", action, operationId, code, receipt: null };
  }
  return { outcome: "REJECTED", action, operationId, code, receipt };
}

function asCatalogueReceipt(value: unknown): CatalogueReceipt | null {
  if (!isRecord(value) || !isRecord(value.result)) {
    return null;
  }
  if (
    typeof value.domain !== "string" ||
    typeof value.operationId !== "string" ||
    typeof value.sequence !== "number" ||
    typeof value.action !== "string"
  ) {
    return null;
  }
  return value as unknown as CatalogueReceipt;
}

function causalInventoryId(receipt: CatalogueReceipt, eventId: string): string | JourneyFence {
  const invalid: JourneyFence = {
    outcome: "INVALID_RECEIPT",
    action: "create_event",
    operationId: receipt.operationId,
    code: "GATE_STATUS",
    receipt,
  };
  const result = receipt.result;
  const ids = result.inventoryIds;
  if (result.eventId !== eventId || !Array.isArray(ids) || ids.length === 0) {
    return invalid;
  }
  if (!ids.every((id) => typeof id === "string" && id.length > 0)) {
    return invalid;
  }
  return ids[0] ?? invalid;
}

function causalTermsHash(receipt: CatalogueReceipt, tradeId: string): string | JourneyFence {
  const result = receipt.result;
  if (
    result.tradeId !== tradeId ||
    result.status !== "PREPARED" ||
    typeof result.termsHash !== "string" ||
    result.termsHash.length === 0 ||
    typeof result.ticketId !== "string" ||
    result.ticketId.length === 0 ||
    typeof result.externalOrderId !== "string" ||
    result.externalOrderId.length === 0
  ) {
    return {
      outcome: "INVALID_RECEIPT",
      action: "prepare_trade",
      operationId: receipt.operationId,
      code: "GATE_STATUS",
      receipt,
    };
  }
  return result.termsHash;
}

function causalAccepted(receipt: CatalogueReceipt, operationId: string): JourneyFence | null {
  if (receipt.result.accepted !== true) {
    return {
      outcome: "INVALID_RECEIPT",
      action: "accept_trade",
      operationId,
      code: "GATE_STATUS",
      receipt,
    };
  }
  return null;
}
