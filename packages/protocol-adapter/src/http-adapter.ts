import { COMMERCE_COMMAND_BINDINGS, type CommerceMethod } from "./commerce-bindings.js";
import { buildLocalCallEnvelope, type LocalCallInput } from "./local-call.js";
import {
  CONTRACT_ONLY_LOCAL_CALL_METHOD,
  CONTRACT_ONLY_LOCAL_CALL_PATH,
  requireOpenApiContractPin,
} from "./openapi-contract-pin.js";
import { enforceRemotePayloadGuards } from "./payload-guards.js";
import { CONSUMED_SURFACES, type CommerceProtocol } from "./protocol.js";
import {
  ProtocolError,
  type AdapterMeta,
  type AdmissionDecision,
  type Booking,
  type Hold,
  type Performance,
  type ResaleListing,
  type ReservationAuthorize,
  type ReservationBind,
  type ReservationCaseView,
  type ReservationClock,
  type ReservationCommandReceipt,
  type ReservationConfirm,
  type ReservationConsume,
  type ReservationHold,
  type ReservationIssue,
  type ReservationPayment,
  type ReservationReconcileReceipt,
  type ReservationShowRegister,
  type ReservationShowView,
  type ReservationStep,
  type ResaleAccept,
  type ResaleAdopt,
  type ResaleBind,
  type ResaleCancelListing,
  type ResaleCaseView,
  type ResaleClock,
  type ResaleCommandReceipt,
  type ResaleHoldBuy,
  type ResaleList,
  type ResalePayment,
  type ResalePresentationQuery,
  type ResalePresentationView,
  type ResaleReconcileReceipt,
  type ResaleReleaseHold,
  type ResaleRightView,
  type ResaleStep,
  type SettlementCaseView,
  type SettlementCommandReceipt,
  type SettlementInitiate,
  type SettlementPreview,
  type SettlementReason,
  type SettlementReconcileReceipt,
  type SettlementStep,
} from "./types.js";

type FetchLike = typeof fetch;

/**
 * HTTP mode talks only to an explicit base URL, and only with the published
 * local-call placeholder. Desk methods stay not-bound until a 1:1 command
 * body exists. This class does not start a server and does not disburse credit.
 * POST is the OpenAPI grammar slot on that placeholder, not a published protocol method.
 */
export class HttpProtocolAdapter implements CommerceProtocol {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    requireOpenApiContractPin();
    const trimmed = baseUrl.trim();
    if (!trimmed) {
      throw new ProtocolError("KIX_PROTOCOL_API_BASE is required for http mode.");
    }
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new ProtocolError("KIX_PROTOCOL_API_BASE is not a valid URL.");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ProtocolError("KIX_PROTOCOL_API_BASE must be an http(s) URL.");
    }
    this.baseUrl = trimmed;
  }

  describe(): AdapterMeta {
    return {
      adapter: "http",
      liveChain: false,
      fundsMovement: "none",
      surfaces: [...CONSUMED_SURFACES],
    };
  }

  listPerformances(): Promise<Performance[]> {
    return Promise.reject(unbound("listPerformances"));
  }

  placeHold(_input: { eventId: string; quantity: number }): Promise<Hold> {
    return Promise.reject(unbound("placeHold"));
  }

  releaseHold(_holdId: string): Promise<void> {
    return Promise.reject(unbound("releaseHold"));
  }

  confirmBooking(_holdId: string): Promise<Booking> {
    return Promise.reject(unbound("confirmBooking"));
  }

  getBooking(_bookingId: string): Promise<Booking | null> {
    return Promise.reject(unbound("getBooking"));
  }

  checkAdmission(_input: { rightsRef: string; gateId: string }): Promise<AdmissionDecision> {
    return Promise.reject(unbound("checkAdmission"));
  }

  listResale(_eventId?: string): Promise<ResaleListing[]> {
    return Promise.reject(unbound("listResale"));
  }

  openResale(_input: { bookingId: string; askLabel: string }): Promise<ResaleListing> {
    return Promise.reject(unbound("openResale"));
  }

  acceptResale(_listingId: string): Promise<{ listing: ResaleListing; booking: Booking }> {
    return Promise.reject(unbound("acceptResale"));
  }

  settlementPreview(_eventId: string): Promise<SettlementPreview> {
    return Promise.reject(unbound("settlementPreview"));
  }

  initiateSettlement(_input: SettlementInitiate): Promise<SettlementCommandReceipt> {
    return Promise.reject(unbound("initiateSettlement"));
  }

  authorizeSettlement(_input: SettlementStep): Promise<SettlementCommandReceipt> {
    return Promise.reject(unbound("authorizeSettlement"));
  }

  captureSettlement(_input: SettlementStep): Promise<SettlementCommandReceipt> {
    return Promise.reject(unbound("captureSettlement"));
  }

  commitSettlement(_input: SettlementStep): Promise<SettlementCommandReceipt> {
    return Promise.reject(unbound("commitSettlement"));
  }

  failSettlement(_input: SettlementReason): Promise<SettlementCommandReceipt> {
    return Promise.reject(unbound("failSettlement"));
  }

  cancelSettlement(_input: SettlementReason): Promise<SettlementCommandReceipt> {
    return Promise.reject(unbound("cancelSettlement"));
  }

  reconcileSettlement(_input: SettlementStep): Promise<SettlementReconcileReceipt> {
    return Promise.reject(unbound("reconcileSettlement"));
  }

  viewSettlement(_settlementId: string): Promise<SettlementCaseView> {
    return Promise.reject(unbound("viewSettlement"));
  }

  rejectExternalSettlement(_kind: string): Promise<never> {
    return Promise.reject(unbound("rejectExternalSettlement"));
  }

  advanceReservationClock(_input: ReservationClock): Promise<ReservationCommandReceipt> {
    return Promise.reject(unbound("advanceReservationClock"));
  }

  registerReservationShow(_input: ReservationShowRegister): Promise<ReservationCommandReceipt> {
    return Promise.reject(unbound("registerReservationShow"));
  }

  holdReservation(_input: ReservationHold): Promise<ReservationCommandReceipt> {
    return Promise.reject(unbound("holdReservation"));
  }

  releaseReservation(_input: ReservationStep): Promise<ReservationCommandReceipt> {
    return Promise.reject(unbound("releaseReservation"));
  }

  confirmReservation(_input: ReservationConfirm): Promise<ReservationCommandReceipt> {
    return Promise.reject(unbound("confirmReservation"));
  }

  cancelReservation(_input: ReservationStep): Promise<ReservationCommandReceipt> {
    return Promise.reject(unbound("cancelReservation"));
  }

  observeReservationPayment(_input: ReservationPayment): Promise<ReservationCommandReceipt> {
    return Promise.reject(unbound("observeReservationPayment"));
  }

  bindReservationSettlement(_input: ReservationBind): Promise<ReservationCommandReceipt> {
    return Promise.reject(unbound("bindReservationSettlement"));
  }

  issueReservation(_input: ReservationIssue): Promise<ReservationCommandReceipt> {
    return Promise.reject(unbound("issueReservation"));
  }

  authorizeReservationAdmission(_input: ReservationAuthorize): Promise<ReservationCommandReceipt> {
    return Promise.reject(unbound("authorizeReservationAdmission"));
  }

  consumeReservation(_input: ReservationConsume): Promise<ReservationCommandReceipt> {
    return Promise.reject(unbound("consumeReservation"));
  }

  reconcileReservation(_input: ReservationStep): Promise<ReservationReconcileReceipt> {
    return Promise.reject(unbound("reconcileReservation"));
  }

  viewReservation(_reservationId: string): Promise<ReservationCaseView> {
    return Promise.reject(unbound("viewReservation"));
  }

  viewReservationShow(_showId: string): Promise<ReservationShowView> {
    return Promise.reject(unbound("viewReservationShow"));
  }

  rejectExternalReservation(_kind: string): Promise<never> {
    return Promise.reject(unbound("rejectExternalReservation"));
  }

  advanceResaleClock(_input: ResaleClock): Promise<ResaleCommandReceipt> {
    return Promise.reject(unbound("advanceResaleClock"));
  }

  adoptResaleIssued(_input: ResaleAdopt): Promise<ResaleCommandReceipt> {
    return Promise.reject(unbound("adoptResaleIssued"));
  }

  listResaleCase(_input: ResaleList): Promise<ResaleCommandReceipt> {
    return Promise.reject(unbound("listResaleCase"));
  }

  holdResaleBuy(_input: ResaleHoldBuy): Promise<ResaleCommandReceipt> {
    return Promise.reject(unbound("holdResaleBuy"));
  }

  releaseResaleHold(_input: ResaleReleaseHold): Promise<ResaleCommandReceipt> {
    return Promise.reject(unbound("releaseResaleHold"));
  }

  cancelResaleListing(_input: ResaleCancelListing): Promise<ResaleCommandReceipt> {
    return Promise.reject(unbound("cancelResaleListing"));
  }

  observeResalePayment(_input: ResalePayment): Promise<ResaleCommandReceipt> {
    return Promise.reject(unbound("observeResalePayment"));
  }

  bindResaleSettlement(_input: ResaleBind): Promise<ResaleCommandReceipt> {
    return Promise.reject(unbound("bindResaleSettlement"));
  }

  acceptResaleTransfer(_input: ResaleAccept): Promise<ResaleCommandReceipt> {
    return Promise.reject(unbound("acceptResaleTransfer"));
  }

  closeResaleListing(_input: ResaleStep): Promise<ResaleCommandReceipt> {
    return Promise.reject(unbound("closeResaleListing"));
  }

  reconcileResale(_input: ResaleStep): Promise<ResaleReconcileReceipt> {
    return Promise.reject(unbound("reconcileResale"));
  }

  viewResaleCase(_listingId: string): Promise<ResaleCaseView> {
    return Promise.reject(unbound("viewResaleCase"));
  }

  viewResaleRight(_rightId: string): Promise<ResaleRightView> {
    return Promise.reject(unbound("viewResaleRight"));
  }

  viewResalePresentation(_input: ResalePresentationQuery): Promise<ResalePresentationView> {
    return Promise.reject(unbound("viewResalePresentation"));
  }

  rejectExternalResale(_kind: string): Promise<never> {
    return Promise.reject(unbound("rejectExternalResale"));
  }

  /**
   * Sends one local-call envelope. The URL path is the contract-only placeholder.
   * action must be one of the pinned commands. Unknown actions fail closed.
   */
  async invokeLocalCall(input: LocalCallInput): Promise<unknown> {
    const envelope = buildLocalCallEnvelope(input);
    const response = await this.fetchImpl(this.endpoint(), {
      method: CONTRACT_ONLY_LOCAL_CALL_METHOD,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(envelope),
    });
    if (!response.ok) {
      throw new ProtocolError(
        `Local-call placeholder request failed (${response.status}). HTTP status is not a kix-protocol transport contract.`,
      );
    }
    const text = await response.text();
    if (!text) {
      return undefined;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ProtocolError("Local-call placeholder returned non-JSON.");
    }
    enforceRemotePayloadGuards(parsed);
    return parsed;
  }

  private endpoint(): string {
    const base = this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`;
    const relative = CONTRACT_ONLY_LOCAL_CALL_PATH.slice(1);
    return new URL(relative, base).toString();
  }
}

function unbound(method: CommerceMethod): ProtocolError {
  return new ProtocolError(`${method} is not-bound. ${COMMERCE_COMMAND_BINDINGS[method].reason}`);
}
