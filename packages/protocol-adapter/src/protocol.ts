import type { SurfaceId } from "./surfaces.js";
import type {
  AdapterMeta,
  AdmissionDecision,
  Booking,
  Hold,
  Performance,
  ResaleListing,
  SettlementPreview,
} from "./types.js";

/**
 * App-facing seam for Wave 2–4 commerce surfaces.
 * Implementations must not embed Move, settlement math, or credit disbursement.
 */
export interface CommerceProtocol {
  describe(): AdapterMeta;
  listPerformances(): Promise<Performance[]>;
  placeHold(input: { eventId: string; quantity: number }): Promise<Hold>;
  releaseHold(holdId: string): Promise<void>;
  confirmBooking(holdId: string): Promise<Booking>;
  getBooking(bookingId: string): Promise<Booking | null>;
  checkAdmission(input: { rightsRef: string; gateId: string }): Promise<AdmissionDecision>;
  listResale(eventId?: string): Promise<ResaleListing[]>;
  openResale(input: { bookingId: string; askLabel: string }): Promise<ResaleListing>;
  acceptResale(listingId: string): Promise<{ listing: ResaleListing; booking: Booking }>;
  settlementPreview(eventId: string): Promise<SettlementPreview>;
}

export const CONSUMED_SURFACES: SurfaceId[] = [
  "wave2.rights",
  "wave2.zk_gate",
  "wave3.settlement.F01-F03",
  "wave4.booking.B01-B05",
  "wave4.resale.R01-R05",
  "wave4.admission.P03",
];
