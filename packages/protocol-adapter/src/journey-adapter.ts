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
  };
  readonly eventId: string;
  readonly organizer: string;
  readonly buyer: string;
  readonly tradeId: string;
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

export const JOURNEY_COMPOSED_ACTIONS = ["create_event", "prepare_trade", "accept_trade"] as const;

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
 * Steps the journey map lists after accept_trade. commit_trade needs a
 * capture receipt, and this helper does not send capture or settle_capture.
 * Later steps stay uncomposed so the helper does not reorder the map.
 */
export const JOURNEY_UNCOMPOSED = [
  {
    action: "capture",
    reason: COMMERCE_COMMAND_BINDINGS.confirmBooking.reason,
  },
  {
    action: "settle_capture",
    reason: COMMERCE_COMMAND_BINDINGS.settlementPreview.reason,
  },
  {
    action: "commit_trade",
    reason:
      "commit_trade requires a capture receipt. confirmBooking does not send capture, so this helper does not compose commit_trade.",
  },
  {
    action: "open_admission",
    reason:
      "open_admission follows the uncomposed capture step in the journey map. This helper does not send it ahead of that step.",
  },
  {
    action: "admit",
    reason: "admit copies the commit_trade receipt. This helper does not compose commit_trade.",
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
 * Composes create_event, prepare_trade, and accept_trade through invokeLocalCall.
 * Each call is one attempt. A lost response, an invalid receipt, UNKNOWN, or a
 * rejection fences the next write. capture and settle_capture are not sent.
 */
export async function composePrimarySeatJourney(
  caller: JourneyLocalCaller,
  input: PrimarySeatJourneyInput,
): Promise<PrimarySeatJourneyResult> {
  const composed: JourneyComposedStep[] = [];
  const policy = showPolicy(input.policy);

  const created = await takeStep(caller, {
    operationId: input.operationIds.createEvent,
    actor: "operator",
    action: "create_event",
    body: {
      domain: PINNED_PROTOCOL_DOMAIN,
      eventId: input.eventId,
      organizer: input.organizer,
      policy,
      seats: [...input.seats],
    },
  });
  if (created.fence) {
    return result(composed, created.fence);
  }
  const inventoryId = causalInventoryId(created.receipt, input.eventId);
  if (typeof inventoryId !== "string") {
    return result(composed, inventoryId);
  }
  composed.push({
    action: "create_event",
    operationId: input.operationIds.createEvent,
    receipt: created.receipt,
  });

  const prepared = await takeStep(caller, {
    operationId: input.operationIds.prepareTrade,
    actor: input.buyer,
    action: "prepare_trade",
    body: {
      domain: PINNED_PROTOCOL_DOMAIN,
      tradeId: input.tradeId,
      inventoryId,
      buyer: input.buyer,
      amount: policy.primaryPrice,
      expectedInventoryVersion: 0,
      expectedVersion: 0,
    },
  });
  if (prepared.fence) {
    return result(composed, prepared.fence);
  }
  const termsHash = causalTermsHash(prepared.receipt, input.tradeId);
  if (typeof termsHash !== "string") {
    return result(composed, termsHash);
  }
  composed.push({
    action: "prepare_trade",
    operationId: input.operationIds.prepareTrade,
    receipt: prepared.receipt,
  });

  const accepted = await takeStep(caller, {
    operationId: input.operationIds.acceptTrade,
    actor: input.buyer,
    action: "accept_trade",
    body: {
      domain: PINNED_PROTOCOL_DOMAIN,
      tradeId: input.tradeId,
      termsHash,
    },
  });
  if (accepted.fence) {
    return result(composed, accepted.fence);
  }
  const acceptedFence = causalAccepted(accepted.receipt, input.operationIds.acceptTrade);
  if (acceptedFence) {
    return result(composed, acceptedFence);
  }
  composed.push({
    action: "accept_trade",
    operationId: input.operationIds.acceptTrade,
    receipt: accepted.receipt,
  });
  return result(composed, null);
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
