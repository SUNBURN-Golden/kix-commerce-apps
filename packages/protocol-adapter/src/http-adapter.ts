import { ADMISSION_TRANSPORT_NOTE, admissionBoundaryPresentation } from "./admission-case.js";
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
import { integrationHttpObservation, mapOperationalError, type TransportObservation } from "./operational-error.js";
import { assertLocalCallReceipt, enforceRemotePayloadGuards } from "./payload-guards.js";
import { isRecord } from "./record.js";
import { assertSingleAttempt, rejectRetryHeader } from "./retry-policy.js";
import { CONSUMED_SURFACES, type CommerceProtocol } from "./protocol.js";
import {
  ProtocolError,
  type AdapterMeta,
  type AdmissionAdopt,
  type AdmissionAuthorize,
  type AdmissionClock,
  type AdmissionCommandReceipt,
  type AdmissionConsume,
  type AdmissionDecision,
  type AdmissionPresentation,
  type AdmissionPresentationQuery,
  type AdmissionReconcile,
  type AdmissionReconcileReceipt,
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
 * A browser refuses `fetch` called with any receiver other than the global
 * object, so the default is a wrapper and not the bare function.
 */
const globalFetch: FetchLike = (input, init) => fetch(input, init);

/** Largest delay setTimeout honors. A larger one fires at once. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * Client-side ceiling for one exchange, including the body read. It is twice
 * the pinned gate request timeout, so a gate that answers inside its own limit
 * is never cut off. A timeout is not a retry signal.
 */
export const INTEGRATION_HTTP_TIMEOUT_MS = OPENAPI_INTEGRATION_GATE_PIN.requestTimeoutSeconds * 2 * 1000;

export interface HttpProtocolAdapterOptions {
  /** Overrides INTEGRATION_HTTP_TIMEOUT_MS. Must be a positive integer. */
  timeoutMs?: number;
}

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
  private readonly timeoutMs: number;

  constructor(
    baseUrl: string,
    private readonly fetchImpl: FetchLike = globalFetch,
    options: HttpProtocolAdapterOptions = {},
  ) {
    requireOpenApiContractPin();
    requireIntegrationGatePin();
    this.baseUrl = requireLoopbackBase(baseUrl);
    const timeoutMs = options.timeoutMs ?? INTEGRATION_HTTP_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMER_MS) {
      throw new ProtocolError(
        `Integration HTTP timeout must be a positive integer of milliseconds no larger than ${MAX_TIMER_MS}.`,
      );
    }
    this.timeoutMs = timeoutMs;
  }

  describe(): AdapterMeta {
    return {
      adapter: "http",
      environment: "integration-http",
      liveChain: false,
      fundsMovement: "none",
      publicDeploy: false,
      productionConformance: false,
      protocolTruth: false,
      surfaces: [...CONSUMED_SURFACES],
    };
  }

  /**
   * Reads the loopback probes. A failure stays on this adapter.
   * It does not construct a stub and it does not retry.
   */
  async observeTransport(): Promise<TransportObservation> {
    try {
      await this.readGateHealth();
    } catch (error) {
      return observationFromError(error);
    }
    try {
      const ready = await this.readProbe(INTEGRATION_GATE_READY_PATH);
      const journal = ready.body.localFileJournal === true;
      return integrationHttpObservation({
        state: "up",
        code: null,
        requestId: ready.requestId,
        correlationId: ready.correlationId,
        localFileJournal: journal,
        detail: journal
          ? "Loopback gate answered with a process-local file journal. That journal is not production readiness and durable stays false."
          : "Loopback gate answered in memory. Restart drops that state. Not production readiness.",
      });
    } catch (error) {
      return observationFromError(error);
    }
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

  advanceAdmissionClock(_input: AdmissionClock): Promise<AdmissionCommandReceipt> {
    return Promise.reject(unbound("advanceAdmissionClock"));
  }

  adoptAdmissionIssued(_input: AdmissionAdopt): Promise<AdmissionCommandReceipt> {
    return Promise.reject(unbound("adoptAdmissionIssued"));
  }

  authorizeAdmissionCredential(_input: AdmissionAuthorize): Promise<AdmissionCommandReceipt> {
    return Promise.reject(unbound("authorizeAdmissionCredential"));
  }

  consumeAdmissionCredential(_input: AdmissionConsume): Promise<AdmissionCommandReceipt> {
    return Promise.reject(unbound("consumeAdmissionCredential"));
  }

  reconcileAdmission(_input: AdmissionReconcile): Promise<AdmissionReconcileReceipt> {
    return Promise.reject(unbound("reconcileAdmission"));
  }

  rejectExternalAdmission(_kind: string): Promise<never> {
    return Promise.reject(unbound("rejectExternalAdmission"));
  }

  /**
   * Classifies the loopback health probe. Does not post admit.
   * A closed port is unavailable-server. A reachable gate is not a fresh credential.
   */
  async presentAdmission(input: AdmissionPresentationQuery): Promise<AdmissionPresentation> {
    const version = typeof input.version === "number" ? input.version : 0;
    try {
      await this.readGateHealth();
    } catch (error) {
      const code = error instanceof ProtocolError && error.code ? error.code : "GATE_UNAVAILABLE";
      return admissionBoundaryPresentation({
        rightId: input.rightId,
        version,
        holderRole: input.holderRole,
        decision: code,
        fresh: false,
        transferObserved: false,
        phase: null,
        mode: "http-boundary",
        lifecycleAuthority: "INTEGRATION_GATE_TRANSPORT",
        note: ADMISSION_TRANSPORT_NOTE,
      });
    }
    return admissionBoundaryPresentation({
      rightId: input.rightId,
      version,
      holderRole: input.holderRole,
      decision: "NOT_BOUND",
      fresh: false,
      transferObserved: false,
      phase: null,
      mode: "http-boundary",
      lifecycleAuthority: "INTEGRATION_GATE_TRANSPORT",
      note: ADMISSION_TRANSPORT_NOTE,
    });
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
    return this.readProbe(INTEGRATION_GATE_HEALTH_PATH).then((parsed) => parsed.body);
  }

  /**
   * In-memory reference core is loaded. Not production readiness.
   */
  readGateReady(): Promise<unknown> {
    return this.readProbe(INTEGRATION_GATE_READY_PATH).then((parsed) => parsed.body);
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
    try {
      enforceRemotePayloadGuards(parsed.body);
      if (!parsed.ok || (isRecord(parsed.body) && parsed.body.rejected === true)) {
        const code = isRecord(parsed.body) && typeof parsed.body.error === "string" ? parsed.body.error : "GATE_REJECTED";
        throw new ProtocolError(`Integration gate rejected the local call (${code}).`, code);
      }
      assertLocalCallReceipt(parsed.body, {
        action: envelope.action,
        operationId: envelope.operationId,
      });
    } catch (error) {
      if (error instanceof ProtocolError) {
        throw new ProtocolError(error.message, error.code, parsed.trace);
      }
      throw error;
    }
    return parsed.body;
  }

  private async readProbe(path: "/health" | "/ready"): Promise<{
    body: Record<string, unknown>;
    requestId: string;
    correlationId: string;
  }> {
    const parsed = await this.exchange(this.endpoint(path), {
      method: "GET",
      headers: { accept: "application/json" },
    });
    enforceRemotePayloadGuards(parsed.body);
    if (!parsed.ok || (isRecord(parsed.body) && parsed.body.rejected === true)) {
      const code = isRecord(parsed.body) && typeof parsed.body.error === "string" ? parsed.body.error : "GATE_UNAVAILABLE";
      throw new ProtocolError(`Integration gate probe failed (${code}).`, code, parsed.trace);
    }
    return {
      body: assertProbeBody(path, parsed.body),
      requestId: parsed.trace.requestId,
      correlationId: parsed.trace.correlationId,
    };
  }

  private async exchange(
    url: string,
    init: RequestInit,
  ): Promise<{ ok: boolean; body: unknown; trace: { requestId: string; correlationId: string } }> {
    assertSingleAttempt(1);
    const trace = { requestId: newTraceId(), correlationId: newTraceId() };
    const headers = new Headers(init.headers);
    try {
      rejectRetryHeader(headers);
    } catch (error) {
      if (error instanceof ProtocolError) {
        throw new ProtocolError(error.message, error.code, trace);
      }
      throw error;
    }
    headers.set("X-Request-Id", trace.requestId);
    headers.set("X-Correlation-Id", trace.correlationId);
    const controller = new AbortController();
    // The race also covers a fetch that ignores the abort signal.
    const aborted = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener("abort", () => reject(controller.signal.reason));
    });
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await Promise.race([
        this.exchangeOnce(url, { ...init, headers, redirect: "manual", signal: controller.signal }, trace),
        aborted,
      ]);
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ProtocolError(
          `Integration gate did not answer within ${this.timeoutMs} ms. The client does not retry. The operationId may already have applied.`,
          "REQUEST_TIMEOUT",
          trace,
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private async exchangeOnce(
    url: string,
    init: RequestInit,
    trace: { requestId: string; correlationId: string },
  ): Promise<{ ok: boolean; body: unknown; trace: { requestId: string; correlationId: string } }> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, init);
    } catch {
      throw new ProtocolError("Integration gate is unavailable.", "GATE_UNAVAILABLE", trace);
    }
    if (
      response.redirected ||
      response.type === "opaqueredirect" ||
      (response.status >= 300 && response.status < 400) ||
      !sameLoopbackOrigin(response.url, this.baseUrl)
    ) {
      throw new ProtocolError("Integration gate answered with a redirect. The client only talks to the loopback origin.", "GATE_TRANSPORT", trace);
    }
    const echoedRequest = response.headers.get("x-request-id");
    const echoedCorrelation = response.headers.get("x-correlation-id");
    if (echoedRequest !== trace.requestId || echoedCorrelation !== trace.correlationId) {
      throw new ProtocolError("Integration gate response does not match this request.", "STALE_RESPONSE", trace);
    }
    const transport = response.headers.get("x-kix-transport");
    const production = response.headers.get("x-kix-production-endpoint");
    if (transport !== INTEGRATION_GATE_TRANSPORT || production !== "false") {
      throw new ProtocolError("Remote transport is not the non-production integration gate.", "GATE_TRANSPORT", trace);
    }
    const protocolTruth = response.headers.get("x-kix-protocol-truth");
    const conformance = response.headers.get("x-kix-production-conformance");
    if (protocolTruth !== "false" || conformance !== "false") {
      throw new ProtocolError(
        "Remote transport claims protocol truth or production conformance.",
        "PRODUCTION_ENDPOINT",
        trace,
      );
    }
    let text: string;
    try {
      text = await response.text();
    } catch (error) {
      if (init.signal?.aborted) {
        throw error;
      }
      throw new ProtocolError("Integration gate response body was cut off.", "GATE_UNAVAILABLE", trace);
    }
    if (!text) {
      return { ok: response.ok, body: undefined, trace };
    }
    try {
      return { ok: response.ok, body: JSON.parse(text) as unknown, trace };
    } catch {
      throw new ProtocolError("Integration gate returned non-JSON.", "GATE_STATUS", trace);
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
      "KIX_PROTOCOL_API_BASE must be an explicit http://127.0.0.1 URL with a non-default port. There is no default public host.",
    );
  }
  if (parsed.port === "0") {
    throw new ProtocolError("KIX_PROTOCOL_API_BASE port 0 is not a listening gate. Use the port the gate printed.");
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new ProtocolError("KIX_PROTOCOL_API_BASE must be the loopback origin only. The client appends the published path.");
  }
  return `http://${INTEGRATION_GATE_LOOPBACK_HOST}:${parsed.port}`;
}

/**
 * A mock Response has no url. A real one must still be the loopback origin
 * this adapter was built with.
 */
function sameLoopbackOrigin(responseUrl: string, baseUrl: string): boolean {
  if (!responseUrl) {
    return true;
  }
  try {
    return new URL(responseUrl).origin === baseUrl;
  } catch {
    return false;
  }
}

function assertProbeBody(path: "/health" | "/ready", body: unknown): Record<string, unknown> {
  if (!isRecord(body)) {
    throw new ProtocolError("Integration gate probe was not an object.", "GATE_STATUS");
  }
  if (
    body.production !== false ||
    body.publicHost !== false ||
    body.productionReadiness !== false ||
    body.productionConformance !== false ||
    body.protocolTruth !== false
  ) {
    throw new ProtocolError("Integration gate probe claims production readiness.", "PRODUCTION_ENDPOINT");
  }
  if (
    body.liveHttpServer !== OPENAPI_INTEGRATION_GATE_PIN.liveHttpServerMode ||
    body.role !== "integration-gate" ||
    typeof body.localFileJournal !== "boolean"
  ) {
    throw new ProtocolError("Integration gate probe does not match the published non-production marker.", "GATE_STATUS");
  }
  if (path === INTEGRATION_GATE_HEALTH_PATH) {
    if (
      body.status !== "up" ||
      "commandCount" in body ||
      "liveMoney" in body ||
      "durable" in body ||
      "journalRecords" in body
    ) {
      throw new ProtocolError("Health probe must stay liveness only.", "GATE_STATUS");
    }
    return body;
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
  if (body.localFileJournal === true) {
    if (typeof body.journalRecords !== "number" || !Number.isInteger(body.journalRecords) || body.journalRecords < 0) {
      throw new ProtocolError("Integration gate journal count is not a process-local total.", "GATE_STATUS");
    }
  } else if ("journalRecords" in body) {
    throw new ProtocolError("Integration gate reported a journal count while the file journal is off.", "GATE_STATUS");
  }
  return body;
}

function observationFromError(error: unknown): TransportObservation {
  const code = error instanceof ProtocolError && error.code ? error.code : "GATE_UNAVAILABLE";
  const mapped = mapOperationalError(code);
  return integrationHttpObservation({
    state: mapped.state === "degraded" ? "degraded" : "unavailable",
    code,
    requestId: error instanceof ProtocolError ? error.requestId ?? null : null,
    correlationId: error instanceof ProtocolError ? error.correlationId ?? null : null,
    localFileJournal: null,
    detail: mapped.detail,
  });
}

const TRACE_TOKEN = /^[A-Za-z0-9._:-]{1,64}$/;

function newTraceId(): string {
  const id = globalThis.crypto.randomUUID();
  if (!TRACE_TOKEN.test(id)) {
    throw new ProtocolError("Client trace id is not a gate token.", "GATE_STATUS");
  }
  return id;
}

/**
 * Copies the trace ids from a request onto a mock or test response.
 * The adapter rejects a response whose ids do not match the request it sent.
 */
export function echoIntegrationGateHeaders(
  init: RequestInit | undefined,
  overrides: Record<string, string> = {},
): Record<string, string> {
  const sent = new Headers(init?.headers);
  return {
    "content-type": "application/json",
    "x-kix-transport": INTEGRATION_GATE_TRANSPORT,
    "x-kix-production-endpoint": "false",
    "x-kix-protocol-truth": "false",
    "x-kix-production-conformance": "false",
    "x-request-id": sent.get("x-request-id") ?? "",
    "x-correlation-id": sent.get("x-correlation-id") ?? "",
    ...overrides,
  };
}

function unbound(method: CommerceMethod): ProtocolError {
  return new ProtocolError(`${method} is not-bound. ${COMMERCE_COMMAND_BINDINGS[method].reason}`);
}
