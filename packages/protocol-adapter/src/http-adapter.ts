import { CONSUMED_SURFACES, type CommerceProtocol } from "./protocol.js";
import { PROVISIONAL_HTTP_PATHS } from "./surfaces.js";
import {
  ProtocolError,
  type AdapterMeta,
  type AdmissionDecision,
  type Booking,
  type Hold,
  type Performance,
  type ResaleListing,
  type SettlementPreview,
} from "./types.js";

type FetchLike = typeof fetch;

/**
 * Calls a configured kix-protocol HTTP base.
 * Paths come from PROVISIONAL_HTTP_PATHS and must be replaced when OpenAPI is bound.
 * There is no credit disbursement method on this client.
 */
export class HttpProtocolAdapter implements CommerceProtocol {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    if (!baseUrl) {
      throw new ProtocolError("KIX_PROTOCOL_API_BASE is required for http mode.");
    }
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
    return this.request("GET", PROVISIONAL_HTTP_PATHS.listPerformances).then((body) =>
      asArray(body, "performances").map(asPerformance),
    );
  }

  placeHold(input: { eventId: string; quantity: number }): Promise<Hold> {
    return this.request("POST", PROVISIONAL_HTTP_PATHS.placeHold, input).then(asHold);
  }

  async releaseHold(holdId: string): Promise<void> {
    await this.request("DELETE", `${PROVISIONAL_HTTP_PATHS.releaseHold}/${encodeURIComponent(holdId)}`);
  }

  confirmBooking(holdId: string): Promise<Booking> {
    return this.request("POST", PROVISIONAL_HTTP_PATHS.confirmBooking, { holdId }).then(asBooking);
  }

  async getBooking(bookingId: string): Promise<Booking | null> {
    const response = await this.fetchImpl(this.url(`${PROVISIONAL_HTTP_PATHS.getBooking}/${encodeURIComponent(bookingId)}`), {
      method: "GET",
      headers: { accept: "application/json" },
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new ProtocolError(`kix-protocol GET booking failed: ${response.status}`);
    }
    return asBooking(await response.json());
  }

  checkAdmission(input: { rightsRef: string; gateId: string }): Promise<AdmissionDecision> {
    return this.request("POST", PROVISIONAL_HTTP_PATHS.checkAdmission, input).then(asAdmission);
  }

  listResale(eventId?: string): Promise<ResaleListing[]> {
    const path = eventId
      ? `${PROVISIONAL_HTTP_PATHS.listResale}?eventId=${encodeURIComponent(eventId)}`
      : PROVISIONAL_HTTP_PATHS.listResale;
    return this.request("GET", path).then((body) => asArray(body, "listings").map(asListing));
  }

  openResale(input: { bookingId: string; askLabel: string }): Promise<ResaleListing> {
    return this.request("POST", PROVISIONAL_HTTP_PATHS.openResale, input).then(asListing);
  }

  acceptResale(listingId: string): Promise<{ listing: ResaleListing; booking: Booking }> {
    return this.request(
      "POST",
      `${PROVISIONAL_HTTP_PATHS.acceptResale}/${encodeURIComponent(listingId)}/accept`,
      {},
    ).then(asTransfer);
  }

  settlementPreview(eventId: string): Promise<SettlementPreview> {
    return this.request(
      "GET",
      `${PROVISIONAL_HTTP_PATHS.settlementPreview}/${encodeURIComponent(eventId)}`,
    ).then(asSettlement);
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await this.fetchImpl(this.url(path), {
      method,
      headers: {
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      throw new ProtocolError(`kix-protocol ${method} ${path} failed: ${response.status}`);
    }
    if (response.status === 204) {
      return undefined;
    }
    return response.json();
  }

  private url(path: string): string {
    const base = this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`;
    const relative = path.startsWith("/") ? path.slice(1) : path;
    return new URL(relative, base).toString();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asArray(value: unknown, key: string): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (isRecord(value) && Array.isArray(value[key])) {
    return value[key];
  }
  throw new ProtocolError(`Expected a list at ${key}.`);
}

function readString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== "string" || field.length === 0) {
    throw new ProtocolError(`Missing string field ${key}.`);
  }
  return field;
}

function asPerformance(value: unknown): Performance {
  if (!isRecord(value)) {
    throw new ProtocolError("Performance payload was not an object.");
  }
  const remaining = value.remainingCapacity;
  if (typeof remaining !== "number" || !Number.isInteger(remaining) || remaining < 0) {
    throw new ProtocolError("Missing remainingCapacity.");
  }
  return {
    eventId: readString(value, "eventId"),
    title: readString(value, "title"),
    venue: readString(value, "venue"),
    startsAt: readString(value, "startsAt"),
    remainingCapacity: remaining,
  };
}

function asHold(value: unknown): Hold {
  if (!isRecord(value)) {
    throw new ProtocolError("Hold payload was not an object.");
  }
  const quantity = value.quantity;
  if (typeof quantity !== "number" || !Number.isInteger(quantity)) {
    throw new ProtocolError("Missing hold quantity.");
  }
  return {
    holdId: readString(value, "holdId"),
    eventId: readString(value, "eventId"),
    quantity,
    expiresAt: readString(value, "expiresAt"),
    surface: "wave4.booking.B01-B05",
  };
}

function asBooking(value: unknown): Booking {
  if (!isRecord(value)) {
    throw new ProtocolError("Booking payload was not an object.");
  }
  const status = value.status;
  if (status !== "confirmed" && status !== "transferred") {
    throw new ProtocolError("Booking status must be confirmed or transferred.");
  }
  if (value.payment !== "simulated-no-funds") {
    throw new ProtocolError("This client only accepts simulated-no-funds bookings.");
  }
  const quantity = value.quantity;
  if (typeof quantity !== "number" || !Number.isInteger(quantity)) {
    throw new ProtocolError("Missing booking quantity.");
  }
  return {
    bookingId: readString(value, "bookingId"),
    eventId: readString(value, "eventId"),
    quantity,
    rightsRef: readString(value, "rightsRef"),
    status,
    payment: "simulated-no-funds",
    surfaces: ["wave4.booking.B01-B05", "wave2.rights"],
  };
}

function asAdmission(value: unknown): AdmissionDecision {
  if (!isRecord(value) || typeof value.admitted !== "boolean") {
    throw new ProtocolError("Admission payload was missing admitted.");
  }
  return {
    admitted: value.admitted,
    detail: readString(value, "detail"),
    rightsRef: readString(value, "rightsRef"),
    gateId: readString(value, "gateId"),
    surface: "wave4.admission.P03",
    zkSurface: "wave2.zk_gate",
    proofMode: "remote",
  };
}

function asListing(value: unknown): ResaleListing {
  if (!isRecord(value)) {
    throw new ProtocolError("Listing payload was not an object.");
  }
  const status = value.status;
  if (status !== "open" && status !== "transferred") {
    throw new ProtocolError("Listing status must be open or transferred.");
  }
  return {
    listingId: readString(value, "listingId"),
    bookingId: readString(value, "bookingId"),
    rightsRef: readString(value, "rightsRef"),
    eventId: readString(value, "eventId"),
    askLabel: readString(value, "askLabel"),
    status,
    surface: "wave4.resale.R01-R05",
  };
}

function asTransfer(value: unknown): { listing: ResaleListing; booking: Booking } {
  if (!isRecord(value)) {
    throw new ProtocolError("Transfer payload was not an object.");
  }
  return { listing: asListing(value.listing), booking: asBooking(value.booking) };
}

function asSettlement(value: unknown): SettlementPreview {
  if (!isRecord(value)) {
    throw new ProtocolError("Settlement payload was not an object.");
  }
  const references = value.references;
  if (
    !Array.isArray(references) ||
    references.length !== 3 ||
    references[0] !== "F01" ||
    references[1] !== "F02" ||
    references[2] !== "F03"
  ) {
    throw new ProtocolError("Settlement preview must reference F01, F02, and F03 only.");
  }
  if (value.mode !== "mock") {
    throw new ProtocolError("Settlement preview must stay in mock mode.");
  }
  return {
    eventId: readString(value, "eventId"),
    mode: "mock",
    surface: "wave3.settlement.F01-F03",
    references: ["F01", "F02", "F03"],
    note: readString(value, "note"),
  };
}
