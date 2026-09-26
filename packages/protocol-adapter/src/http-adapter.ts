import { COMMERCE_COMMAND_BINDINGS, type CommerceMethod } from "./commerce-bindings.js";
import {
  INTEGRATION_GATE_HEALTH_PATH,
  INTEGRATION_GATE_LOOPBACK_HOST,
  INTEGRATION_GATE_READY_PATH,
  INTEGRATION_GATE_TRANSPORT,
  OPENAPI_INTEGRATION_GATE_PIN,
  requireIntegrationGatePin,
} from "./integration-gate-pin.js";
import { buildLocalCallEnvelope, type LocalCallInput } from "./local-call.js";
import {
  CONTRACT_ONLY_LOCAL_CALL_METHOD,
  CONTRACT_ONLY_LOCAL_CALL_PATH,
  PINNED_ACTIONS,
  PINNED_PROTOCOL_DOMAIN,
  requireOpenApiContractPin,
} from "./openapi-contract-pin.js";
import { enforceRemotePayloadGuards } from "./payload-guards.js";
import { isRecord } from "./record.js";
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
  type CreditBind,
  type CreditCaseView,
  type CreditCommandReceipt,
  type CreditDraw,
  type CreditOffer,
  type CreditReason,
  type CreditReconcileReceipt,
  type CreditRepay,
  type CreditStep,
} from "./types.js";

type FetchLike = typeof fetch;

/**
 * HTTP mode talks only to an explicit loopback base URL, and only with the
 * published local-call path. Desk methods stay not-bound when their arguments
 * are not a command body. invokeLocalCall posts that envelope to the
 * non-production integration gate. This class does not start a server, does
 * not choose a public host, and does not disburse credit.
 * A successful local call is not production approval.
 */
export class HttpProtocolAdapter implements CommerceProtocol {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    requireOpenApiContractPin();
    requireIntegrationGatePin();
    this.baseUrl = requireLoopbackBase(baseUrl);
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

  offerCredit(_input: CreditOffer): Promise<CreditCommandReceipt> {
    return Promise.reject(unbound("offerCredit"));
  }

  approveCredit(_input: CreditStep): Promise<CreditCommandReceipt> {
    return Promise.reject(unbound("approveCredit"));
  }

  rejectCredit(_input: CreditReason): Promise<CreditCommandReceipt> {
    return Promise.reject(unbound("rejectCredit"));
  }

  cancelCredit(_input: CreditReason): Promise<CreditCommandReceipt> {
    return Promise.reject(unbound("cancelCredit"));
  }

  bindCreditSettlement(_input: CreditBind): Promise<CreditCommandReceipt> {
    return Promise.reject(unbound("bindCreditSettlement"));
  }

  drawCredit(_input: CreditDraw): Promise<CreditCommandReceipt> {
    return Promise.reject(unbound("drawCredit"));
  }

  repayCredit(_input: CreditRepay): Promise<CreditCommandReceipt> {
    return Promise.reject(unbound("repayCredit"));
  }

  closeCredit(_input: CreditStep): Promise<CreditCommandReceipt> {
    return Promise.reject(unbound("closeCredit"));
  }

  defaultCredit(_input: CreditReason): Promise<CreditCommandReceipt> {
    return Promise.reject(unbound("defaultCredit"));
  }

  reconcileCredit(_input: CreditStep): Promise<CreditReconcileReceipt> {
    return Promise.reject(unbound("reconcileCredit"));
  }

  viewCredit(_advanceId: string): Promise<CreditCaseView> {
    return Promise.reject(unbound("viewCredit"));
  }

  rejectUnsupportedCredit(_kind: string): Promise<never> {
    return Promise.reject(unbound("rejectUnsupportedCredit"));
  }

  /**
   * Process liveness. Not a protocol command and not readiness.
   */
  readGateHealth(): Promise<unknown> {
    return this.readProbe(INTEGRATION_GATE_HEALTH_PATH);
  }

  /**
   * In-memory reference core is loaded. Not production readiness.
   */
  readGateReady(): Promise<unknown> {
    return this.readProbe(INTEGRATION_GATE_READY_PATH);
  }

  /**
   * Sends one local-call envelope to the published integration-gate path.
   * action must be one of the pinned commands. Unknown actions fail closed
   * before a request. A non-success HTTP status stays a reject.
   */
  async invokeLocalCall(input: LocalCallInput): Promise<unknown> {
    const envelope = buildLocalCallEnvelope(input);
    const parsed = await this.exchange(this.endpoint(CONTRACT_ONLY_LOCAL_CALL_PATH), {
      method: CONTRACT_ONLY_LOCAL_CALL_METHOD,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(envelope),
    });
    enforceRemotePayloadGuards(parsed.body, {
      action: envelope.action,
      operationId: envelope.operationId,
    });
    if (!parsed.ok || (isRecord(parsed.body) && parsed.body.rejected === true)) {
      const code = isRecord(parsed.body) && typeof parsed.body.error === "string" ? parsed.body.error : "GATE_REJECTED";
      throw new ProtocolError(`Integration gate rejected the local call (${code}).`, code);
    }
    return parsed.body;
  }

  private async readProbe(path: "/health" | "/ready"): Promise<unknown> {
    const parsed = await this.exchange(this.endpoint(path), {
      method: "GET",
      headers: { accept: "application/json" },
    });
    enforceRemotePayloadGuards(parsed.body);
    if (!parsed.ok || (isRecord(parsed.body) && parsed.body.rejected === true)) {
      const code = isRecord(parsed.body) && typeof parsed.body.error === "string" ? parsed.body.error : "GATE_UNAVAILABLE";
      throw new ProtocolError(`Integration gate probe failed (${code}).`, code);
    }
    assertProbeBody(path, parsed.body);
    return parsed.body;
  }

  private async exchange(url: string, init: RequestInit): Promise<{ ok: boolean; body: unknown }> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, init);
    } catch {
      throw new ProtocolError("Integration gate is unavailable.", "GATE_UNAVAILABLE");
    }
    const transport = response.headers.get("x-kix-transport");
    const production = response.headers.get("x-kix-production-endpoint");
    if (transport !== INTEGRATION_GATE_TRANSPORT || production !== "false") {
      throw new ProtocolError("Remote transport is not the non-production integration gate.", "GATE_TRANSPORT");
    }
    const text = await response.text();
    if (!text) {
      return { ok: response.ok, body: undefined };
    }
    try {
      return { ok: response.ok, body: JSON.parse(text) as unknown };
    } catch {
      throw new ProtocolError("Integration gate returned non-JSON.", "GATE_STATUS");
    }
  }

  private endpoint(path: string): string {
    return `${this.baseUrl}${path}`;
  }
}

function requireLoopbackBase(baseUrl: string): string {
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
  if (parsed.username || parsed.password) {
    throw new ProtocolError("KIX_PROTOCOL_API_BASE must not carry credentials.");
  }
  if (parsed.protocol !== "http:" || parsed.hostname !== INTEGRATION_GATE_LOOPBACK_HOST || !parsed.port) {
    throw new ProtocolError(
      "KIX_PROTOCOL_API_BASE must be an explicit http://127.0.0.1 URL with a port. There is no default public host.",
    );
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new ProtocolError("KIX_PROTOCOL_API_BASE must be the loopback origin only. The client appends the published path.");
  }
  return `http://${INTEGRATION_GATE_LOOPBACK_HOST}:${parsed.port}`;
}

function assertProbeBody(path: "/health" | "/ready", body: unknown): void {
  if (!isRecord(body)) {
    throw new ProtocolError("Integration gate probe was not an object.", "GATE_STATUS");
  }
  if (
    body.production !== false ||
    body.publicHost !== false ||
    body.productionReadiness !== false ||
    body.liveHttpServer !== OPENAPI_INTEGRATION_GATE_PIN.liveHttpServerMode ||
    body.role !== "integration-gate"
  ) {
    throw new ProtocolError("Integration gate probe claims production readiness.", "PRODUCTION_ENDPOINT");
  }
  if (path === INTEGRATION_GATE_HEALTH_PATH) {
    if (body.status !== "up" || "commandCount" in body || "liveMoney" in body || "durable" in body) {
      throw new ProtocolError("Health probe must stay liveness only.", "GATE_STATUS");
    }
    return;
  }
  if (
    body.status !== "ready" ||
    body.liveMoney !== false ||
    body.durable !== false ||
    body.commandCount !== PINNED_ACTIONS.length ||
    body.domain !== PINNED_PROTOCOL_DOMAIN
  ) {
    throw new ProtocolError("Integration gate readiness does not match the published catalogue.", "GATE_STATUS");
  }
}

function unbound(method: CommerceMethod): ProtocolError {
  return new ProtocolError(`${method} is not-bound. ${COMMERCE_COMMAND_BINDINGS[method].reason}`);
}
