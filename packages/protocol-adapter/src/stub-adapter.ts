import {
  ADMISSION_CASE_NOTE,
  AdmissionCaseStore,
  admissionBoundaryPresentation,
  type AdmissionSources,
} from "./admission-case.js";
import { CreditCaseStore } from "./credit-case.js";
import { localStubObservation } from "./operational-error.js";
import { CONSUMED_SURFACES, type CommerceProtocol } from "./protocol.js";
import { ResaleCaseStore } from "./resale-case.js";
import { ReservationCaseStore } from "./reservation-case.js";
import { SettlementCaseStore } from "./settlement-case.js";
import { SURFACES } from "./surfaces.js";
import {
  ProtocolError,
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
  type AdapterMeta,
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

const HOLD_MS = 10 * 60 * 1000;

const DEFAULT_SEED: Performance[] = [
  {
    eventId: "evt_lanterns",
    title: "North Station Lanterns",
    venue: "Hall A",
    startsAt: "2026-10-03T19:00:00.000Z",
    remainingCapacity: 40,
  },
  {
    eventId: "evt_paper_orchestra",
    title: "Paper Orchestra",
    venue: "Hall B",
    startsAt: "2026-10-04T15:30:00.000Z",
    remainingCapacity: 24,
  },
  {
    eventId: "evt_last_ferry",
    title: "Last Ferry Diagram",
    venue: "Studio",
    startsAt: "2026-10-05T20:00:00.000Z",
    remainingCapacity: 12,
  },
];

interface HoldRecord extends Hold {
  consumed: boolean;
}

/**
 * In-memory stand-in used when no kix-protocol HTTP base is configured.
 * Wave 4 hold, resale, and admission policies here are stub policies for the UI and tests.
 * The reservation case, the resale case, and the credit case use protocol phase names at the UI contract only.
 * None of these paths is Move, and none of them is the protocol machine.
 */
export class StubProtocolAdapter implements CommerceProtocol {
  private readonly performances: Performance[];
  private readonly holds = new Map<string, HoldRecord>();
  private readonly bookings = new Map<string, Booking>();
  private readonly listings = new Map<string, ResaleListing>();
  private readonly admitted = new Set<string>();
  private readonly settlementCases = new SettlementCaseStore();
  private readonly reservationCases: ReservationCaseStore;
  private readonly resaleCases: ResaleCaseStore;
  private readonly admissionCases: AdmissionCaseStore;
  private readonly creditCases: CreditCaseStore;
  private seq = 0;

  constructor(seed: Performance[] = DEFAULT_SEED, private readonly now: () => number = Date.now) {
    this.performances = seed.map((item) => ({ ...item }));
    this.creditCases = new CreditCaseStore((settlementId) => {
      const view = this.settlementCases.view(settlementId);
      return { phase: view.phase, fundsExecuted: view.fundsExecuted };
    });
    this.reservationCases = new ReservationCaseStore((settlementId) => this.settlementCases.view(settlementId).phase);
    this.resaleCases = new ResaleCaseStore(
      (reservationId) => {
        const view = this.reservationCases.view(reservationId);
        return {
          phase: view.phase,
          rightId: view.rightId,
          buyerRole: view.buyerRole,
          admissionId: view.admissionId,
          showId: view.showId,
          slot: view.slot,
          eventId: view.eventId,
          economicFinalityClaimed: view.economicFinalityClaimed,
          fundsExecuted: view.fundsExecuted,
        };
      },
      (settlementId) => {
        const view = this.settlementCases.view(settlementId);
        return { phase: view.phase, fundsExecuted: view.fundsExecuted };
      },
    );
    this.admissionCases = new AdmissionCaseStore(this.admissionSources());
  }

  private admissionSources(): AdmissionSources {
    return {
      viewReservation: (reservationId) => this.reservationCases.view(reservationId),
      authorizeReservation: (input) => this.reservationCases.authorizeAdmission(input),
      consumeReservation: (input) => this.reservationCases.consume(input),
      viewResaleRight: (rightId) => this.resaleCases.viewRight(rightId),
      viewResalePresentation: (input) => this.resaleCases.viewPresentation(input),
      viewSettlement: (settlementId) => {
        const view = this.settlementCases.view(settlementId);
        return {
          fundsExecuted: view.fundsExecuted,
          economicFinalityClaimed: false,
          admissionGranted: false,
        };
      },
    };
  }

  describe(): AdapterMeta {
    return {
      adapter: "stub",
      environment: "stub",
      liveChain: false,
      fundsMovement: "none",
      publicDeploy: false,
      productionConformance: false,
      protocolTruth: false,
      surfaces: [...CONSUMED_SURFACES],
    };
  }

  observeTransport() {
    return Promise.resolve(localStubObservation());
  }

  async listPerformances(): Promise<Performance[]> {
    return this.performances.map((item) => ({ ...item }));
  }

  async placeHold(input: { eventId: string; quantity: number }): Promise<Hold> {
    const performance = this.requirePerformance(input.eventId);
    const quantity = requireQuantity(input.quantity);
    if (quantity > performance.remainingCapacity) {
      throw new ProtocolError("Not enough remaining capacity for that hold.");
    }
    performance.remainingCapacity -= quantity;
    const hold: HoldRecord = {
      holdId: this.nextId("hold"),
      eventId: performance.eventId,
      quantity,
      expiresAt: new Date(this.now() + HOLD_MS).toISOString(),
      surface: SURFACES.booking,
      consumed: false,
    };
    this.holds.set(hold.holdId, hold);
    return { ...hold };
  }

  async releaseHold(holdId: string): Promise<void> {
    const hold = this.holds.get(holdId);
    if (!hold || hold.consumed) {
      throw new ProtocolError("Hold is not active.");
    }
    hold.consumed = true;
    this.requirePerformance(hold.eventId).remainingCapacity += hold.quantity;
  }

  async confirmBooking(holdId: string): Promise<Booking> {
    const hold = this.holds.get(holdId);
    if (!hold || hold.consumed) {
      throw new ProtocolError("Hold is not active.");
    }
    if (Date.parse(hold.expiresAt) <= this.now()) {
      hold.consumed = true;
      this.requirePerformance(hold.eventId).remainingCapacity += hold.quantity;
      throw new ProtocolError("Hold has expired.");
    }
    hold.consumed = true;
    const bookingId = this.nextId("bkg");
    const booking: Booking = {
      bookingId,
      eventId: hold.eventId,
      quantity: hold.quantity,
      rightsRef: `right_${bookingId}`,
      status: "confirmed",
      payment: "simulated-no-funds",
      surfaces: [SURFACES.booking, SURFACES.rightsIssuance],
    };
    this.bookings.set(booking.bookingId, booking);
    return { ...booking, surfaces: [...booking.surfaces] };
  }

  async getBooking(bookingId: string): Promise<Booking | null> {
    const booking = this.bookings.get(bookingId);
    return booking ? { ...booking, surfaces: [...booking.surfaces] } : null;
  }

  async checkAdmission(input: { rightsRef: string; gateId: string }): Promise<AdmissionDecision> {
    const gateId = input.gateId.trim();
    const rightsRef = input.rightsRef.trim();
    const base = {
      rightsRef,
      gateId,
      surface: SURFACES.admission,
      zkSurface: SURFACES.zkGate,
      proofMode: "stub" as const,
    };
    if (!gateId) {
      return { ...base, admitted: false, detail: "Stub: a gate id is required." };
    }
    const booking = [...this.bookings.values()].find((item) => item.rightsRef === rightsRef);
    if (!booking) {
      return { ...base, admitted: false, detail: "Stub: unknown right." };
    }
    if (booking.status === "transferred") {
      return { ...base, admitted: false, detail: "Stub: right was transferred." };
    }
    const openListing = [...this.listings.values()].find(
      (item) => item.rightsRef === rightsRef && item.status === "open",
    );
    if (openListing) {
      return { ...base, admitted: false, detail: "Stub: right is in an open resale listing." };
    }
    if (this.admitted.has(rightsRef)) {
      return { ...base, admitted: false, detail: "Stub: right was already admitted." };
    }
    this.admitted.add(rightsRef);
    return {
      ...base,
      admitted: true,
      detail: "Stub: admitted once. zk_gate proof was not evaluated on a chain.",
    };
  }

  async listResale(eventId?: string): Promise<ResaleListing[]> {
    return [...this.listings.values()]
      .filter((item) => (eventId ? item.eventId === eventId : true))
      .map(copyListing);
  }

  async openResale(input: { bookingId: string; askLabel: string }): Promise<ResaleListing> {
    const booking = this.bookings.get(input.bookingId);
    if (!booking || booking.status !== "confirmed") {
      throw new ProtocolError("Only a confirmed booking can be listed.");
    }
    const askLabel = input.askLabel.trim();
    if (!askLabel || askLabel.length > 40) {
      throw new ProtocolError("Ask label must be 1–40 characters and is display-only.");
    }
    const already = [...this.listings.values()].find(
      (item) => item.bookingId === booking.bookingId && item.status === "open",
    );
    if (already) {
      throw new ProtocolError("That booking already has an open listing.");
    }
    if (this.admitted.has(booking.rightsRef)) {
      throw new ProtocolError("An admitted right cannot be listed.");
    }
    const listing: ResaleListing = {
      listingId: this.nextId("rsl"),
      bookingId: booking.bookingId,
      rightsRef: booking.rightsRef,
      eventId: booking.eventId,
      askLabel,
      status: "open",
      surface: SURFACES.resale,
    };
    this.listings.set(listing.listingId, listing);
    return copyListing(listing);
  }

  async acceptResale(listingId: string): Promise<{ listing: ResaleListing; booking: Booking }> {
    const listing = this.listings.get(listingId);
    if (!listing || listing.status !== "open") {
      throw new ProtocolError("Listing is not open.");
    }
    const previous = this.bookings.get(listing.bookingId);
    if (!previous || previous.status !== "confirmed") {
      throw new ProtocolError("Listing booking is no longer confirmed.");
    }
    listing.status = "transferred";
    previous.status = "transferred";
    const bookingId = this.nextId("bkg");
    const booking: Booking = {
      bookingId,
      eventId: previous.eventId,
      quantity: previous.quantity,
      rightsRef: `right_${bookingId}`,
      status: "confirmed",
      payment: "simulated-no-funds",
      surfaces: [SURFACES.resale, SURFACES.rightsIssuance],
    };
    this.bookings.set(booking.bookingId, booking);
    return {
      listing: copyListing(listing),
      booking: { ...booking, surfaces: [...booking.surfaces] },
    };
  }

  async settlementPreview(eventId: string): Promise<SettlementPreview> {
    this.requirePerformance(eventId);
    return {
      eventId,
      mode: "mock",
      surface: SURFACES.settlementMock,
      references: ["F01", "F02", "F03"],
      note: "Mock F01–F03 pointer. The desk case is the adapter stub FSM. This app does not compute shares or move funds.",
    };
  }

  async initiateSettlement(input: SettlementInitiate): Promise<SettlementCommandReceipt> {
    this.requirePerformance(input.eventId);
    return this.settlementCases.initiate(input);
  }

  async authorizeSettlement(input: SettlementStep): Promise<SettlementCommandReceipt> {
    return this.settlementCases.authorize(input);
  }

  async captureSettlement(input: SettlementStep): Promise<SettlementCommandReceipt> {
    return this.settlementCases.capture(input);
  }

  async commitSettlement(input: SettlementStep): Promise<SettlementCommandReceipt> {
    return this.settlementCases.commit(input);
  }

  async failSettlement(input: SettlementReason): Promise<SettlementCommandReceipt> {
    return this.settlementCases.fail(input);
  }

  async cancelSettlement(input: SettlementReason): Promise<SettlementCommandReceipt> {
    return this.settlementCases.cancel(input);
  }

  async reconcileSettlement(input: SettlementStep): Promise<SettlementReconcileReceipt> {
    return this.settlementCases.reconcile(input);
  }

  async viewSettlement(settlementId: string): Promise<SettlementCaseView> {
    return this.settlementCases.view(settlementId);
  }

  async rejectExternalSettlement(kind: string): Promise<never> {
    return this.settlementCases.rejectExternal(kind);
  }

  async advanceReservationClock(input: ReservationClock): Promise<ReservationCommandReceipt> {
    return this.reservationCases.advanceClock(input);
  }

  async registerReservationShow(input: ReservationShowRegister): Promise<ReservationCommandReceipt> {
    this.requirePerformance(input.eventId);
    return this.reservationCases.registerShow(input);
  }

  async holdReservation(input: ReservationHold): Promise<ReservationCommandReceipt> {
    return this.reservationCases.hold(input);
  }

  async releaseReservation(input: ReservationStep): Promise<ReservationCommandReceipt> {
    return this.reservationCases.release(input);
  }

  async confirmReservation(input: ReservationConfirm): Promise<ReservationCommandReceipt> {
    return this.reservationCases.confirm(input);
  }

  async cancelReservation(input: ReservationStep): Promise<ReservationCommandReceipt> {
    return this.reservationCases.cancel(input);
  }

  async observeReservationPayment(input: ReservationPayment): Promise<ReservationCommandReceipt> {
    return this.reservationCases.observePayment(input);
  }

  async bindReservationSettlement(input: ReservationBind): Promise<ReservationCommandReceipt> {
    return this.reservationCases.bindSettlement(input);
  }

  async issueReservation(input: ReservationIssue): Promise<ReservationCommandReceipt> {
    return this.reservationCases.issue(input);
  }

  async authorizeReservationAdmission(input: ReservationAuthorize): Promise<ReservationCommandReceipt> {
    return this.reservationCases.authorizeAdmission(input);
  }

  async consumeReservation(input: ReservationConsume): Promise<ReservationCommandReceipt> {
    return this.reservationCases.consume(input);
  }

  async reconcileReservation(input: ReservationStep): Promise<ReservationReconcileReceipt> {
    return this.reservationCases.reconcile(input);
  }

  async viewReservation(reservationId: string): Promise<ReservationCaseView> {
    return this.reservationCases.view(reservationId);
  }

  async viewReservationShow(showId: string): Promise<ReservationShowView> {
    return this.reservationCases.viewShow(showId);
  }

  async rejectExternalReservation(kind: string): Promise<never> {
    return this.reservationCases.rejectExternal(kind);
  }

  async advanceAdmissionClock(input: AdmissionClock): Promise<AdmissionCommandReceipt> {
    return this.admissionCases.advanceClock(input);
  }

  async adoptAdmissionIssued(input: AdmissionAdopt): Promise<AdmissionCommandReceipt> {
    return this.admissionCases.adoptIssued(input);
  }

  async authorizeAdmissionCredential(input: AdmissionAuthorize): Promise<AdmissionCommandReceipt> {
    return this.admissionCases.authorize(input);
  }

  async consumeAdmissionCredential(input: AdmissionConsume): Promise<AdmissionCommandReceipt> {
    return this.admissionCases.consume(input);
  }

  async reconcileAdmission(input: AdmissionReconcile): Promise<AdmissionReconcileReceipt> {
    return this.admissionCases.reconcile(input);
  }

  async rejectExternalAdmission(kind: string): Promise<never> {
    return this.admissionCases.rejectExternal(kind);
  }

  async presentAdmission(input: AdmissionPresentationQuery): Promise<AdmissionPresentation> {
    try {
      return this.admissionCases.present(input);
    } catch (error) {
      if (error instanceof ProtocolError && error.code) {
        return admissionBoundaryPresentation({
          rightId: input.rightId,
          version: typeof input.version === "number" ? input.version : 0,
          holderRole: input.holderRole,
          decision: error.code,
          fresh: false,
          transferObserved: false,
          phase: null,
          mode: "mock",
          lifecycleAuthority: "IN_MEMORY_FSM",
          note: ADMISSION_CASE_NOTE,
        });
      }
      throw error;
    }
  }

  async advanceResaleClock(input: ResaleClock): Promise<ResaleCommandReceipt> {
    return this.resaleCases.advanceClock(input);
  }

  async adoptResaleIssued(input: ResaleAdopt): Promise<ResaleCommandReceipt> {
    return this.resaleCases.adoptIssued(input);
  }

  async listResaleCase(input: ResaleList): Promise<ResaleCommandReceipt> {
    return this.resaleCases.list(input);
  }

  async holdResaleBuy(input: ResaleHoldBuy): Promise<ResaleCommandReceipt> {
    return this.resaleCases.holdBuy(input);
  }

  async releaseResaleHold(input: ResaleReleaseHold): Promise<ResaleCommandReceipt> {
    return this.resaleCases.releaseHold(input);
  }

  async cancelResaleListing(input: ResaleCancelListing): Promise<ResaleCommandReceipt> {
    return this.resaleCases.cancelListing(input);
  }

  async observeResalePayment(input: ResalePayment): Promise<ResaleCommandReceipt> {
    return this.resaleCases.observePayment(input);
  }

  async bindResaleSettlement(input: ResaleBind): Promise<ResaleCommandReceipt> {
    return this.resaleCases.bindSettlement(input);
  }

  async acceptResaleTransfer(input: ResaleAccept): Promise<ResaleCommandReceipt> {
    return this.resaleCases.acceptTransfer(input);
  }

  async closeResaleListing(input: ResaleStep): Promise<ResaleCommandReceipt> {
    return this.resaleCases.close(input);
  }

  async reconcileResale(input: ResaleStep): Promise<ResaleReconcileReceipt> {
    return this.resaleCases.reconcile(input);
  }

  async viewResaleCase(listingId: string): Promise<ResaleCaseView> {
    return this.resaleCases.view(listingId);
  }

  async viewResaleRight(rightId: string): Promise<ResaleRightView> {
    return this.resaleCases.viewRight(rightId);
  }

  async viewResalePresentation(input: ResalePresentationQuery): Promise<ResalePresentationView> {
    return this.resaleCases.viewPresentation(input);
  }

  async rejectExternalResale(kind: string): Promise<never> {
    return this.resaleCases.rejectExternal(kind);
  }

  async offerCredit(input: CreditOffer): Promise<CreditCommandReceipt> {
    return this.creditCases.offer(input);
  }

  async approveCredit(input: CreditStep): Promise<CreditCommandReceipt> {
    return this.creditCases.approve(input);
  }

  async rejectCredit(input: CreditReason): Promise<CreditCommandReceipt> {
    return this.creditCases.reject(input);
  }

  async cancelCredit(input: CreditReason): Promise<CreditCommandReceipt> {
    return this.creditCases.cancel(input);
  }

  async bindCreditSettlement(input: CreditBind): Promise<CreditCommandReceipt> {
    return this.creditCases.bindSettlement(input);
  }

  async drawCredit(input: CreditDraw): Promise<CreditCommandReceipt> {
    return this.creditCases.draw(input);
  }

  async repayCredit(input: CreditRepay): Promise<CreditCommandReceipt> {
    return this.creditCases.repay(input);
  }

  async closeCredit(input: CreditStep): Promise<CreditCommandReceipt> {
    return this.creditCases.close(input);
  }

  async defaultCredit(input: CreditReason): Promise<CreditCommandReceipt> {
    return this.creditCases.defaultCase(input);
  }

  async reconcileCredit(input: CreditStep): Promise<CreditReconcileReceipt> {
    return this.creditCases.reconcile(input);
  }

  async viewCredit(advanceId: string): Promise<CreditCaseView> {
    return this.creditCases.view(advanceId);
  }

  async rejectUnsupportedCredit(kind: string): Promise<never> {
    return this.creditCases.rejectUnsupported(kind);
  }

  private requirePerformance(eventId: string): Performance {
    const performance = this.performances.find((item) => item.eventId === eventId);
    if (!performance) {
      throw new ProtocolError("Unknown performance.");
    }
    return performance;
  }

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${this.seq}`;
  }
}

function requireQuantity(quantity: number): number {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 6) {
    throw new ProtocolError("Quantity must be a whole number from 1 to 6.");
  }
  return quantity;
}

function copyListing(listing: ResaleListing): ResaleListing {
  return { ...listing };
}
