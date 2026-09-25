import { SURFACES, type SurfaceId } from "./surfaces.js";

/**
 * App view models. Field names are local until bound to kix-protocol OpenAPI.
 * They are not Move struct layouts.
 */

export interface Performance {
  eventId: string;
  title: string;
  venue: string;
  startsAt: string;
  remainingCapacity: number;
}

export interface Hold {
  holdId: string;
  eventId: string;
  quantity: number;
  expiresAt: string;
  surface: typeof SURFACES.booking;
}

export interface Booking {
  bookingId: string;
  eventId: string;
  quantity: number;
  rightsRef: string;
  status: "confirmed" | "transferred";
  /** This app never moves funds. */
  payment: "simulated-no-funds";
  surfaces: SurfaceId[];
}

export interface AdmissionDecision {
  admitted: boolean;
  /** Human-readable stub or remote detail. Not a claimed protocol enum. */
  detail: string;
  rightsRef: string;
  gateId: string;
  surface: typeof SURFACES.admission;
  zkSurface: typeof SURFACES.zkGate;
  proofMode: "stub" | "remote";
}

export interface ResaleListing {
  listingId: string;
  bookingId: string;
  rightsRef: string;
  eventId: string;
  /** Display text only. Never parsed or charged. */
  askLabel: string;
  status: "open" | "transferred";
  surface: typeof SURFACES.resale;
}

export interface SettlementPreview {
  eventId: string;
  mode: "mock";
  surface: typeof SURFACES.settlementMock;
  /** Codes named by the Task 005 charter. This app does not define split rules. */
  references: readonly ["F01", "F02", "F03"];
  note: string;
}

export interface AdapterMeta {
  adapter: "stub" | "http";
  liveChain: false;
  fundsMovement: "none";
  surfaces: SurfaceId[];
}

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolError";
  }
}
