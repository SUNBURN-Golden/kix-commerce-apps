import { isRecord } from "./record.js";
import { SURFACES } from "./surfaces.js";
import {
  ProtocolError,
  RESALE_PROVENANCE,
  RESALE_REFERENCES,
  type ResaleAccept,
  type ResaleAdopt,
  type ResaleBind,
  type ResaleCancelListing,
  type ResaleCaseView,
  type ResaleClock,
  type ResaleCommandReceipt,
  type ResaleEligibility,
  type ResaleHoldBuy,
  type ResaleLifecycleCommand,
  type ResaleList,
  type ResalePayment,
  type ResalePhase,
  type ResalePresentationQuery,
  type ResalePresentationView,
  type ResaleReconcileReceipt,
  type ResaleReleaseHold,
  type ResaleRightView,
  type ResaleSettlementGate,
  type ResaleStep,
  type ResaleTransferEvidence,
} from "./types.js";

/**
 * In-process mock resale cases for the resale desk.
 *
 * Phase names, idempotency echoes, single-active listing, stale version
 * rejection, terminal immutability, and post-transfer invalidation follow
 * the kix-protocol in-memory FSM at the UI contract only.
 * Authoritative machine: BeautifulMind-JT/kix-protocol
 * `reference/booking_resale_admission/resale_fsm.py`
 * on main `ef942b7713c7468e8851c6b372b64d42b5333ad8`
 * (feature `70c6d52d4289e23d0d4141b7f3a6b310eea236f2`).
 *
 * This store does not port MockGates prices, fee splits, caps, or inventory.
 * It does not add OpenAPI commands. R01–R05 stay 설계중.
 * The journal is process-local. It is not the protocol journal and not a ledger.
 * A bound transfer reads the mock settlement phase. It does not post money.
 */
export const RESALE_DEPTH_BASELINE = {
  protocolRepo: "BeautifulMind-JT/kix-protocol",
  protocolMainSha: "ef942b7713c7468e8851c6b372b64d42b5333ad8",
  featureCommit: "70c6d52d4289e23d0d4141b7f3a6b310eea236f2",
  fsmPath: "reference/booking_resale_admission/resale_fsm.py",
  provenance: RESALE_PROVENANCE,
} as const;

export const RESALE_CASE_NOTE =
  "Simulated mock phase on the adapter stub. Not live marketplace. R01–R05 stay 설계중. Protocol truth remains in kix-protocol. This case does not price a listing, move funds, or reissue a venue credential.";

const OPEN: ReadonlySet<ResalePhase> = new Set(["LISTED", "BUY_HELD", "PAYMENT_NOTED"]);
const TERMINAL: ReadonlySet<ResalePhase> = new Set(["CLOSED", "CANCELLED"]);
const ISSUED_AUTHORITY: ReadonlySet<string> = new Set(["ISSUED", "ADMISSION_AUTHORIZED"]);

const UNSTORED_REJECTION: ReadonlySet<string> = new Set([
  "MOCK_INVARIANT",
  "IDEMPOTENCY_CONFLICT",
  "INVALID_JOURNAL",
]);

const JOURNAL_OPS = [
  "set_clock",
  "adopt_issued",
  "list_resale",
  "hold_buy",
  "release_hold",
  "cancel_listing",
  "observe_resale_payment",
  "bind_settlement",
  "accept_resale",
  "close",
] as const;

type JournalOp = (typeof JOURNAL_OPS)[number];
type TransitionOp = Exclude<JournalOp, "set_clock" | "adopt_issued" | "list_resale">;

const ALLOWED: Record<TransitionOp, ReadonlySet<ResalePhase>> = {
  hold_buy: new Set(["LISTED"]),
  release_hold: new Set(["BUY_HELD"]),
  cancel_listing: new Set(["LISTED", "BUY_HELD"]),
  observe_resale_payment: new Set(["LISTED", "BUY_HELD"]),
  bind_settlement: new Set(["LISTED", "BUY_HELD", "PAYMENT_NOTED"]),
  accept_resale: new Set(["PAYMENT_NOTED"]),
  close: new Set(["TRANSFERRED"]),
};

const SPECIFIC: Readonly<Record<string, string>> = {
  "cancel_listing:PAYMENT_NOTED": "COMPENSATION_UNDEFINED",
  "observe_resale_payment:PAYMENT_NOTED": "LISTING_PAYMENT_BOUND",
  "hold_buy:BUY_HELD": "BUYER_HOLD_LOCKED",
};

interface ReservationAuthority {
  phase: string;
  rightId: string | null;
  buyerRole: string;
  admissionId: string | null;
  showId: string;
  slot: string;
  eventId: string;
  economicFinalityClaimed: boolean;
  fundsExecuted: boolean;
}

interface SettlementAuthority {
  phase: string;
  fundsExecuted: boolean;
}

interface RightRecord {
  rightId: string;
  canon: string;
  reservationId: string | null;
  showId: string;
  eventId: string;
  slot: string;
  holderRole: string;
  version: number;
  paymentRef: string;
  activeListingId: string | null;
  lastTransferId: string | null;
  lastKey: string;
  lastRejectCode: string | null;
}

interface ListingRecord {
  listingId: string;
  canon: string;
  phase: ResalePhase;
  rightId: string;
  showId: string;
  eventId: string;
  sellerRole: string;
  recipientRole: string;
  expiresAt: string;
  version: number;
  versionAfter: number | null;
  paymentRef: string | null;
  holdId: string | null;
  buyerRole: string | null;
  settlementId: string | null;
  mockSettlementCommitObserved: boolean;
  transferId: string | null;
  lastKey: string;
  echoKey: string;
  lastRejectCode: string | null;
  reconcileMatched: boolean | null;
}

interface HoldRecord {
  canon: string;
  listingId: string;
}

interface JournalEntry {
  op: JournalOp;
  idempotencyKey: string;
  subjectId: string;
  body: Record<string, string>;
}

interface StoredCall {
  request: string;
  result: ResaleCommandReceipt | null;
  error: string | null;
}

interface RejectTarget {
  listingId: string | null;
  rightId: string | null;
}

export class ResaleCaseStore {
  private clockMs = 0;
  private readonly rights = new Map<string, RightRecord>();
  private readonly listings = new Map<string, ListingRecord>();
  private readonly holds = new Map<string, HoldRecord>();
  private readonly transfers = new Map<string, string>();
  private readonly paymentRefs = new Set<string>();
  private readonly journal: JournalEntry[] = [];
  private readonly idempotency = new Map<string, StoredCall>();

  constructor(
    private readonly reservationView: (reservationId: string) => ReservationAuthority,
    private readonly settlementView: (settlementId: string) => SettlementAuthority,
  ) {}

  advanceClock(input: ResaleClock): ResaleCommandReceipt {
    const body = { nowAt: input.nowAt };
    return this.call("set_clock", "clock", input.idempotencyKey, body, () => emptyTarget(), (key, request) => {
      this.applyClock(body);
      return this.accept(key, request, "set_clock", "clock", body, null, null, null);
    });
  }

  adoptIssued(input: ResaleAdopt): ResaleCommandReceipt {
    const body = {
      eventId: input.eventId,
      holderRole: input.holderRole,
      paymentRef: input.paymentRef,
      reservationId: optionalId(input.reservationId),
      showId: input.showId,
      slot: input.slot,
    };
    return this.call(
      "adopt_issued",
      input.rightId,
      input.idempotencyKey,
      body,
      () => this.targetRight(input.rightId),
      (key, request) => {
        const rightId = ident(input.rightId);
        this.applyAdopt(rightId, body, key);
        return this.accept(key, request, "adopt_issued", rightId, body, null, rightId, null);
      },
    );
  }

  list(input: ResaleList): ResaleCommandReceipt {
    const body = {
      expiresAt: input.expiresAt,
      recipientRole: input.recipientRole,
      reservationId: optionalId(input.reservationId),
      rightId: input.rightId,
      sellerRole: input.sellerRole,
      version: String(input.version),
    };
    return this.call(
      "list_resale",
      input.listingId,
      input.idempotencyKey,
      body,
      () => this.targetList(input.listingId, input.rightId),
      (key, request) => {
        const listingId = ident(input.listingId);
        const rightId = this.applyList(listingId, body, key);
        return this.accept(key, request, "list_resale", listingId, body, listingId, rightId, null);
      },
    );
  }

  holdBuy(input: ResaleHoldBuy): ResaleCommandReceipt {
    const body = { buyerRole: input.buyerRole, listingId: input.listingId };
    return this.call(
      "hold_buy",
      input.holdId,
      input.idempotencyKey,
      body,
      () => this.targetListing(input.listingId),
      (key, request) => {
        const holdId = ident(input.holdId);
        const listed = this.applyHold(holdId, body, key);
        return this.accept(key, request, "hold_buy", holdId, body, listed.listingId, listed.rightId, null);
      },
    );
  }

  releaseHold(input: ResaleReleaseHold): ResaleCommandReceipt {
    const body = { buyerRole: input.buyerRole };
    return this.call(
      "release_hold",
      input.holdId,
      input.idempotencyKey,
      body,
      () => this.targetHold(input.holdId),
      (key, request) => {
        const holdId = ident(input.holdId);
        const listed = this.applyRelease(holdId, body, key);
        return this.accept(key, request, "release_hold", holdId, body, listed.listingId, listed.rightId, null);
      },
    );
  }

  cancelListing(input: ResaleCancelListing): ResaleCommandReceipt {
    const body = { sellerRole: input.sellerRole };
    return this.call(
      "cancel_listing",
      input.listingId,
      input.idempotencyKey,
      body,
      () => this.targetListing(input.listingId),
      (key, request) => {
        const listingId = ident(input.listingId);
        const rightId = this.applyCancel(listingId, body, key);
        return this.accept(key, request, "cancel_listing", listingId, body, listingId, rightId, null);
      },
    );
  }

  observePayment(input: ResalePayment): ResaleCommandReceipt {
    const body = { buyerRole: optionalId(input.buyerRole), paymentRef: input.paymentRef };
    return this.call(
      "observe_resale_payment",
      input.listingId,
      input.idempotencyKey,
      body,
      () => this.targetListing(input.listingId),
      (key, request) => {
        const listingId = ident(input.listingId);
        const rightId = this.applyObserve(listingId, body, key);
        return this.accept(key, request, "observe_resale_payment", listingId, body, listingId, rightId, null);
      },
    );
  }

  bindSettlement(input: ResaleBind): ResaleCommandReceipt {
    const body = { settlementId: input.settlementId };
    return this.call(
      "bind_settlement",
      input.listingId,
      input.idempotencyKey,
      body,
      () => this.targetListing(input.listingId),
      (key, request) => {
        const listingId = ident(input.listingId);
        const rightId = this.applyBind(listingId, body, key);
        return this.accept(key, request, "bind_settlement", listingId, body, listingId, rightId, null);
      },
    );
  }

  acceptTransfer(input: ResaleAccept): ResaleCommandReceipt {
    const body = { listingId: input.listingId };
    return this.call(
      "accept_resale",
      input.transferId,
      input.idempotencyKey,
      body,
      () => this.targetListing(input.listingId),
      (key, request) => {
        const transferId = ident(input.transferId);
        const outcome = this.applyAccept(transferId, body, key, null);
        return this.accept(
          key,
          request,
          "accept_resale",
          transferId,
          { listingId: outcome.listingId, observed: outcome.observed ? "true" : "false" },
          outcome.listingId,
          outcome.rightId,
          outcome.evidence,
        );
      },
    );
  }

  close(input: ResaleStep): ResaleCommandReceipt {
    return this.call(
      "close",
      input.listingId,
      input.idempotencyKey,
      {},
      () => this.targetListing(input.listingId),
      (key, request) => {
        const listingId = ident(input.listingId);
        const rightId = this.applyClose(listingId, key);
        return this.accept(key, request, "close", listingId, {}, listingId, rightId, null);
      },
    );
  }

  reconcile(input: ResaleStep): ResaleReconcileReceipt {
    return this.call(
      "reconcile",
      input.listingId,
      input.idempotencyKey,
      {},
      () => this.targetListing(input.listingId),
      (key, request) => {
        const listingId = ident(input.listingId);
        const listing = this.requireListing(listingId);
        const rebuilt = new ResaleCaseStore(this.reservationView, this.settlementView);
        for (const entry of this.journal) {
          rebuilt.replay(entry);
        }
        if (rebuilt.canonical() !== this.canonical()) {
          throw resaleError("MOCK_INVARIANT");
        }
        listing.reconcileMatched = true;
        listing.lastRejectCode = null;
        listing.echoKey = key;
        const receipt: ResaleReconcileReceipt = {
          ...this.commandReceipt(false, "reconcile", key, listingId, listing.rightId, null),
          applied: "reconcile",
          matched: true,
        };
        this.idempotency.set(key, { request, result: structuredClone(receipt), error: null });
        return structuredClone(receipt);
      },
    );
  }

  view(listingId: string): ResaleCaseView {
    return this.toListingView(this.requireListing(ident(listingId)));
  }

  viewRight(rightId: string): ResaleRightView {
    return this.toRightView(this.requireRight(ident(rightId)));
  }

  viewPresentation(input: ResalePresentationQuery): ResalePresentationView {
    const rightId = ident(input.rightId);
    const holderRole = ident(input.holderRole);
    const version = readVersion(String(input.version));
    const ticket = this.requireRight(rightId);
    const right = this.publicRight(ticket);
    const matches =
      right.state === "ACTIVE" &&
      right.version === version &&
      right.holderRole === holderRole &&
      right.listingId === null;
    return {
      mode: "mock",
      surface: SURFACES.resaleFsm,
      references: RESALE_REFERENCES,
      provenance: RESALE_PROVENANCE,
      lifecycleAuthority: "IN_MEMORY_FSM",
      rightId,
      version,
      holderRole,
      matchesCurrentRight: matches,
      currentVersion: right.version,
      currentHolderRole: right.holderRole,
      venueCredentialReissued: false,
      admissionRoutingProduction: false,
      economicFinalityClaimed: false,
      fundsExecuted: false,
      externalMarketplace: "UNSUPPORTED",
      note: RESALE_CASE_NOTE,
    };
  }

  rejectExternal(kind: string): never {
    ident(kind);
    throw resaleError("EXTERNAL_UNSUPPORTED");
  }

  private applyClock(body: Record<string, string>): void {
    const nowAt = readTime(body.nowAt ?? "");
    const next = Date.parse(nowAt);
    if (next < this.clockMs) {
      throw resaleError("CLOCK_REGRESSION");
    }
    this.clockMs = next;
  }

  private applyAdopt(rightId: string, body: Record<string, string>, key: string): void {
    const showId = ident(body.showId ?? "");
    const eventId = ident(body.eventId ?? "");
    const slot = ident(body.slot ?? "");
    const holderRole = ident(body.holderRole ?? "");
    const reservationId = readOptional(body.reservationId ?? "");
    const paymentRef = ident(body.paymentRef ?? "");
    const canon = canonicalJson({ eventId, holderRole, paymentRef, reservationId, rightId, showId, slot });
    const current = this.rights.get(rightId);
    if (current) {
      if (current.canon !== canon) {
        throw resaleError("ISSUANCE_BINDING_CONFLICT");
      }
      throw resaleError("ILLEGAL_TRANSITION");
    }
    if (reservationId !== null) {
      const authority = this.requireAuthority(reservationId, rightId);
      if (authority.showId !== showId || authority.eventId !== eventId) {
        throw resaleError("SHOW_BINDING_CONFLICT");
      }
      if (authority.slot !== slot || authority.buyerRole !== holderRole) {
        throw resaleError("RESERVATION_BINDING_CONFLICT");
      }
    }
    this.claimPayment(paymentRef);
    this.rights.set(rightId, {
      rightId,
      canon,
      reservationId,
      showId,
      eventId,
      slot,
      holderRole,
      version: 1,
      paymentRef,
      activeListingId: null,
      lastTransferId: null,
      lastKey: key,
      lastRejectCode: null,
    });
    this.invariant();
  }

  private applyList(listingId: string, body: Record<string, string>, key: string): string {
    const rightId = ident(body.rightId ?? "");
    const sellerRole = ident(body.sellerRole ?? "");
    const recipientRole = ident(body.recipientRole ?? "");
    const expiresAt = readTime(body.expiresAt ?? "");
    const version = readVersion(body.version ?? "");
    const reservationId = readOptional(body.reservationId ?? "");
    const canon = canonicalJson({
      expiresAt,
      listingId,
      recipientRole,
      reservationId,
      rightId,
      sellerRole,
      version,
    });
    const current = this.listings.get(listingId);
    if (current) {
      if (current.canon !== canon) {
        throw resaleError("LISTING_BINDING_CONFLICT");
      }
      if (TERMINAL.has(current.phase)) {
        throw resaleError("TERMINAL_IMMUTABLE");
      }
      throw resaleError("ILLEGAL_TRANSITION");
    }
    if (reservationId !== null) {
      this.requireAuthority(reservationId, rightId);
    }
    const ticket = this.rights.get(rightId);
    if (!ticket) {
      throw resaleError("UNKNOWN_RIGHT");
    }
    if (ticket.reservationId !== null && reservationId !== null && reservationId !== ticket.reservationId) {
      throw resaleError("RESERVATION_BINDING_CONFLICT");
    }
    const authorityId = reservationId ?? ticket.reservationId;
    if (authorityId !== null) {
      const authority = this.requireAuthority(authorityId, rightId);
      if (authority.showId !== ticket.showId || authority.eventId !== ticket.eventId) {
        throw resaleError("SHOW_BINDING_CONFLICT");
      }
      if (authority.slot !== ticket.slot) {
        throw resaleError("RESERVATION_BINDING_CONFLICT");
      }
    }
    if (this.liveListingId(ticket) !== null) {
      throw resaleError("RIGHT_SALE_LOCKED");
    }
    if (sellerRole !== ticket.holderRole) {
      throw resaleError("NOT_HOLDER");
    }
    if (version !== ticket.version) {
      throw resaleError("STALE_VERSION");
    }
    if (recipientRole === ticket.holderRole) {
      throw resaleError("RECIPIENT_IS_HOLDER");
    }
    if (Date.parse(expiresAt) <= this.clockMs) {
      throw resaleError("LISTING_NOT_OPEN");
    }
    this.listings.set(listingId, {
      listingId,
      canon,
      phase: "LISTED",
      rightId,
      showId: ticket.showId,
      eventId: ticket.eventId,
      sellerRole,
      recipientRole,
      expiresAt,
      version,
      versionAfter: null,
      paymentRef: null,
      holdId: null,
      buyerRole: null,
      settlementId: null,
      mockSettlementCommitObserved: false,
      transferId: null,
      lastKey: key,
      echoKey: key,
      lastRejectCode: null,
      reconcileMatched: null,
    });
    ticket.activeListingId = listingId;
    ticket.lastKey = key;
    ticket.lastRejectCode = null;
    this.invariant();
    return rightId;
  }

  private applyHold(holdId: string, body: Record<string, string>, key: string): { listingId: string; rightId: string } {
    const listingId = ident(body.listingId ?? "");
    const buyerRole = ident(body.buyerRole ?? "");
    const canon = canonicalJson({ buyerRole, holdId, listingId });
    const prior = this.holds.get(holdId);
    if (prior) {
      if (prior.canon !== canon) {
        throw resaleError("HOLD_BINDING_CONFLICT");
      }
      throw resaleError("ILLEGAL_TRANSITION");
    }
    const listing = this.requireListing(listingId);
    this.enter(listing, "hold_buy");
    if (!(this.clockMs < Date.parse(listing.expiresAt))) {
      throw resaleError("LISTING_NOT_OPEN");
    }
    if (buyerRole !== listing.recipientRole) {
      throw resaleError("RECIPIENT_MISMATCH");
    }
    listing.holdId = holdId;
    listing.buyerRole = buyerRole;
    listing.phase = "BUY_HELD";
    this.holds.set(holdId, { canon, listingId });
    this.markListing(listing, key);
    this.touchRight(listing.rightId, key);
    this.invariant();
    return { listingId, rightId: listing.rightId };
  }

  private applyRelease(holdId: string, body: Record<string, string>, key: string): { listingId: string; rightId: string } {
    const buyerRole = ident(body.buyerRole ?? "");
    const hold = this.holds.get(holdId);
    if (!hold) {
      throw resaleError("UNKNOWN_HOLD");
    }
    const listing = this.requireListing(hold.listingId);
    this.enter(listing, "release_hold");
    if (buyerRole !== listing.buyerRole) {
      throw resaleError("BUYER_MISMATCH");
    }
    listing.phase = "LISTED";
    listing.holdId = null;
    listing.buyerRole = null;
    this.markListing(listing, key);
    this.touchRight(listing.rightId, key);
    this.invariant();
    return { listingId: listing.listingId, rightId: listing.rightId };
  }

  private applyCancel(listingId: string, body: Record<string, string>, key: string): string {
    const sellerRole = ident(body.sellerRole ?? "");
    const listing = this.requireListing(listingId);
    this.enter(listing, "cancel_listing");
    if (sellerRole !== listing.sellerRole) {
      throw resaleError("NOT_HOLDER");
    }
    listing.phase = "CANCELLED";
    listing.holdId = null;
    listing.buyerRole = null;
    const ticket = this.requireRight(listing.rightId);
    if (ticket.activeListingId === listingId) {
      ticket.activeListingId = null;
    }
    this.markListing(listing, key);
    this.touchRight(ticket.rightId, key);
    this.invariant();
    return ticket.rightId;
  }

  private applyObserve(listingId: string, body: Record<string, string>, key: string): string {
    const paymentRef = ident(body.paymentRef ?? "");
    const buyerRole = readOptional(body.buyerRole ?? "");
    const listing = this.requireListing(listingId);
    this.enter(listing, "observe_resale_payment");
    if (listing.phase === "BUY_HELD") {
      if (buyerRole !== listing.buyerRole) {
        throw resaleError("BUYER_MISMATCH");
      }
    } else if (buyerRole !== null && buyerRole !== listing.recipientRole) {
      throw resaleError("RECIPIENT_MISMATCH");
    }
    this.claimPayment(paymentRef);
    listing.paymentRef = paymentRef;
    listing.phase = "PAYMENT_NOTED";
    this.markListing(listing, key);
    this.touchRight(listing.rightId, key);
    this.invariant();
    return listing.rightId;
  }

  private applyBind(listingId: string, body: Record<string, string>, key: string): string {
    const settlementId = ident(body.settlementId ?? "");
    const listing = this.requireListing(listingId);
    this.enter(listing, "bind_settlement");
    if (listing.settlementId !== null) {
      if (listing.settlementId !== settlementId) {
        throw resaleError("SETTLEMENT_BINDING_CONFLICT");
      }
      throw resaleError("ILLEGAL_TRANSITION");
    }
    listing.settlementId = settlementId;
    this.markListing(listing, key);
    this.touchRight(listing.rightId, key);
    this.invariant();
    return listing.rightId;
  }

  private applyAccept(
    transferId: string,
    body: Record<string, string>,
    key: string,
    observedOverride: boolean | null,
  ): { listingId: string; rightId: string; observed: boolean; evidence: ResaleTransferEvidence } {
    const listingId = ident(body.listingId ?? "");
    const canon = canonicalJson({ listingId, transferId });
    const prior = this.transfers.get(transferId);
    if (prior !== undefined && prior !== canon) {
      throw resaleError("TRANSFER_BINDING_CONFLICT");
    }
    const listing = this.requireListing(listingId);
    this.enter(listing, "accept_resale");
    if (!(this.clockMs < Date.parse(listing.expiresAt))) {
      throw resaleError("LISTING_NOT_OPEN");
    }
    const ticket = this.requireRight(listing.rightId);
    if (ticket.reservationId !== null) {
      const authority = this.requireAuthority(ticket.reservationId, listing.rightId);
      if (authority.showId !== ticket.showId || authority.slot !== ticket.slot) {
        throw resaleError("RESERVATION_BINDING_CONFLICT");
      }
    }
    const current = this.publicRight(ticket);
    if (current.state !== "ACTIVE") {
      throw resaleError("RIGHT_NOT_ACTIVE");
    }
    if (current.holderRole !== listing.sellerRole) {
      throw resaleError("NOT_HOLDER");
    }
    if (current.version !== listing.version) {
      throw resaleError("STALE_VERSION");
    }
    const observed = observedOverride === null ? this.observeSettlement(listing) : observedOverride;
    const versionAfter = listing.version + 1;
    const evidence: ResaleTransferEvidence = {
      rightId: listing.rightId,
      fromRole: listing.sellerRole,
      toRole: listing.recipientRole,
      versionAfter,
      fundsExecuted: false,
      chainOwnerCurrent: false,
    };
    listing.phase = "TRANSFERRED";
    listing.transferId = transferId;
    listing.versionAfter = versionAfter;
    listing.mockSettlementCommitObserved = observed;
    listing.holdId = null;
    listing.buyerRole = null;
    if (ticket.activeListingId === listingId) {
      ticket.activeListingId = null;
    }
    ticket.holderRole = listing.recipientRole;
    ticket.version = versionAfter;
    ticket.lastTransferId = transferId;
    this.transfers.set(transferId, canon);
    this.markListing(listing, key);
    this.touchRight(ticket.rightId, key);
    this.invariant();
    return { listingId, rightId: ticket.rightId, observed, evidence };
  }

  private applyClose(listingId: string, key: string): string {
    const listing = this.requireListing(listingId);
    this.enter(listing, "close");
    listing.phase = "CLOSED";
    this.markListing(listing, key);
    this.touchRight(listing.rightId, key);
    this.invariant();
    return listing.rightId;
  }

  private observeSettlement(listing: ListingRecord): boolean {
    if (listing.settlementId === null) {
      return false;
    }
    let view: SettlementAuthority;
    try {
      view = this.settlementView(listing.settlementId);
    } catch (error) {
      if (error instanceof ProtocolError && typeof error.code === "string") {
        throw resaleError(error.code);
      }
      throw error;
    }
    if (view.fundsExecuted !== false) {
      throw resaleError("SETTLEMENT_VIEW_REJECTED");
    }
    if (view.phase !== "COMMITTED") {
      throw resaleError("SETTLEMENT_NOT_COMMITTED");
    }
    return true;
  }

  private requireAuthority(reservationId: string, rightId: string): ReservationAuthority {
    const view = this.readReservation(reservationId);
    if (view.phase === "CANCELLED") {
      throw resaleError("TICKET_CANCELLED");
    }
    if (view.phase === "CONSUMED") {
      throw resaleError("ALREADY_CONSUMED");
    }
    if (!ISSUED_AUTHORITY.has(view.phase)) {
      throw resaleError("TICKET_NOT_ISSUED");
    }
    if (view.admissionId !== null) {
      throw resaleError("ADMISSION_LOCKED");
    }
    if (view.economicFinalityClaimed !== false || view.fundsExecuted !== false) {
      throw resaleError("SETTLEMENT_VIEW_REJECTED");
    }
    if (view.rightId !== rightId) {
      throw resaleError("UNKNOWN_RIGHT");
    }
    return view;
  }

  private readReservation(reservationId: string): ReservationAuthority {
    try {
      return this.reservationView(reservationId);
    } catch (error) {
      if (error instanceof ProtocolError && (error.code === "UNKNOWN_RESERVATION" || error.code === "UNKNOWN_SHOW")) {
        throw resaleError("TICKET_NOT_ISSUED");
      }
      throw error;
    }
  }

  private enter(listing: ListingRecord, op: TransitionOp): void {
    const specific = SPECIFIC[`${op}:${listing.phase}`];
    if (specific !== undefined) {
      throw resaleError(specific);
    }
    if (ALLOWED[op].has(listing.phase)) {
      return;
    }
    if (TERMINAL.has(listing.phase)) {
      throw resaleError("TERMINAL_IMMUTABLE");
    }
    throw resaleError("ILLEGAL_TRANSITION");
  }

  private accept(
    key: string,
    request: string,
    op: JournalOp,
    subjectId: string,
    journalBody: Record<string, string>,
    listingId: string | null,
    rightId: string | null,
    evidence: ResaleTransferEvidence | null,
  ): ResaleCommandReceipt {
    this.journal.push({
      op,
      idempotencyKey: key,
      subjectId,
      body: { ...journalBody },
    });
    const receipt = this.commandReceipt(false, op, key, listingId, rightId, evidence);
    this.idempotency.set(key, { request, result: structuredClone(receipt), error: null });
    return structuredClone(receipt);
  }

  private call<T extends ResaleCommandReceipt>(
    op: ResaleLifecycleCommand,
    subjectId: string,
    idempotencyKey: string,
    body: Record<string, string>,
    targetOf: () => RejectTarget,
    execute: (key: string, request: string) => T,
  ): T {
    const key = ident(idempotencyKey);
    const request = canonicalJson({ body, op, subjectId });
    const prior = this.idempotency.get(key);
    if (prior) {
      if (prior.request !== request) {
        this.noteReject(targetOf(), "IDEMPOTENCY_CONFLICT");
        throw resaleError("IDEMPOTENCY_CONFLICT");
      }
      if (prior.error !== null) {
        this.noteReject(targetOf(), prior.error);
        throw resaleError(prior.error);
      }
      if (prior.result === null) {
        throw resaleError("MOCK_INVARIANT");
      }
      const replay = structuredClone(prior.result) as T;
      replay.duplicate = true;
      replay.applied = null;
      replay.economicFinalityClaimed = false;
      replay.fundsExecuted = false;
      replay.venueCredentialReissued = false;
      replay.externalMarketplace = "UNSUPPORTED";
      replay.externalPayment = "UNSUPPORTED";
      if (replay.listing) {
        replay.listing.economicFinalityClaimed = false;
        replay.listing.fundsExecuted = false;
        replay.listing.venueCredentialReissued = false;
        replay.listing.chainOwnerCurrent = false;
        replay.listing.compensationDefined = false;
        replay.listing.admissionRoutingProduction = false;
        replay.listing.externalMarketplace = "UNSUPPORTED";
        replay.listing.externalPayment = "UNSUPPORTED";
      }
      if (replay.right) {
        replay.right.economicFinalityClaimed = false;
        replay.right.fundsExecuted = false;
        replay.right.venueCredentialReissued = false;
        replay.right.externalMarketplace = "UNSUPPORTED";
      }
      if (replay.evidence) {
        replay.evidence.fundsExecuted = false;
        replay.evidence.chainOwnerCurrent = false;
      }
      return replay;
    }
    try {
      return execute(key, request);
    } catch (error) {
      if (
        error instanceof ProtocolError &&
        error.code !== undefined &&
        !UNSTORED_REJECTION.has(error.code) &&
        !this.idempotency.has(key)
      ) {
        this.idempotency.set(key, { request, result: null, error: error.code });
        this.noteReject(safeTarget(targetOf), error.code);
      }
      throw error;
    }
  }

  private replay(entry: JournalEntry): void {
    if (!isJournalOp(entry.op)) {
      throw resaleError("INVALID_JOURNAL");
    }
    switch (entry.op) {
      case "set_clock":
        if (entry.subjectId !== "clock") {
          throw resaleError("MOCK_INVARIANT");
        }
        this.applyClock(entry.body);
        break;
      case "adopt_issued":
        this.applyAdopt(entry.subjectId, entry.body, entry.idempotencyKey);
        break;
      case "list_resale":
        this.applyList(entry.subjectId, entry.body, entry.idempotencyKey);
        break;
      case "hold_buy":
        this.applyHold(entry.subjectId, entry.body, entry.idempotencyKey);
        break;
      case "release_hold":
        this.applyRelease(entry.subjectId, entry.body, entry.idempotencyKey);
        break;
      case "cancel_listing":
        this.applyCancel(entry.subjectId, entry.body, entry.idempotencyKey);
        break;
      case "observe_resale_payment":
        this.applyObserve(entry.subjectId, entry.body, entry.idempotencyKey);
        break;
      case "bind_settlement":
        this.applyBind(entry.subjectId, entry.body, entry.idempotencyKey);
        break;
      case "accept_resale":
        this.applyAccept(entry.subjectId, entry.body, entry.idempotencyKey, readObserved(entry.body.observed));
        break;
      case "close":
        this.applyClose(entry.subjectId, entry.idempotencyKey);
        break;
      default:
        throw resaleError("INVALID_JOURNAL");
    }
    this.journal.push({
      op: entry.op,
      idempotencyKey: entry.idempotencyKey,
      subjectId: entry.subjectId,
      body: { ...entry.body },
    });
  }

  private canonical(): string {
    const rights = [...this.rights.values()]
      .map((right) => ({
        activeListingId: right.activeListingId,
        eventId: right.eventId,
        holderRole: right.holderRole,
        idempotencyKey: right.lastKey,
        paymentRef: right.paymentRef,
        reservationId: right.reservationId,
        rightId: right.rightId,
        showId: right.showId,
        slot: right.slot,
        version: right.version,
      }))
      .sort((left, right) => left.rightId.localeCompare(right.rightId));
    const listings = [...this.listings.values()]
      .map((listing) => ({
        buyerRole: listing.buyerRole,
        eventId: listing.eventId,
        expiresAt: listing.expiresAt,
        holdId: listing.holdId,
        idempotencyKey: listing.lastKey,
        listingId: listing.listingId,
        mockSettlementCommitObserved: listing.mockSettlementCommitObserved,
        paymentRef: listing.paymentRef,
        phase: listing.phase,
        recipientRole: listing.recipientRole,
        rightId: listing.rightId,
        sellerRole: listing.sellerRole,
        settlementId: listing.settlementId,
        showId: listing.showId,
        transferId: listing.transferId,
        version: listing.version,
        versionAfter: listing.versionAfter,
      }))
      .sort((left, right) => left.listingId.localeCompare(right.listingId));
    return canonicalJson({
      journal: this.journal.map((entry) => ({
        body: entry.body,
        idempotencyKey: entry.idempotencyKey,
        op: entry.op,
        subjectId: entry.subjectId,
      })),
      listings,
      logicalTimeMs: this.clockMs,
      rights,
    });
  }

  private noteReject(target: RejectTarget, code: string): void {
    if (target.listingId !== null) {
      const listing = this.listings.get(target.listingId);
      if (listing) {
        listing.lastRejectCode = code;
      }
    }
    if (target.rightId !== null) {
      const right = this.rights.get(target.rightId);
      if (right) {
        right.lastRejectCode = code;
      }
    }
  }

  private commandReceipt(
    duplicate: boolean,
    applied: ResaleLifecycleCommand | null,
    idempotencyKey: string,
    listingId: string | null,
    rightId: string | null,
    evidence: ResaleTransferEvidence | null,
  ): ResaleCommandReceipt {
    const listing = listingId === null ? null : this.listings.get(listingId);
    const right = rightId === null ? null : this.rights.get(rightId);
    return {
      duplicate,
      applied,
      provenance: RESALE_PROVENANCE,
      economicFinalityClaimed: false,
      fundsExecuted: false,
      venueCredentialReissued: false,
      externalMarketplace: "UNSUPPORTED",
      externalPayment: "UNSUPPORTED",
      idempotencyKey,
      logicalTimeMs: this.clockMs,
      listing: listing ? this.toListingView(listing) : null,
      right: right ? this.toRightView(right) : null,
      evidence,
    };
  }

  private toListingView(listing: ListingRecord): ResaleCaseView {
    const ticket = this.rights.get(listing.rightId);
    if (!ticket) {
      throw resaleError("MOCK_INVARIANT");
    }
    const right = this.publicRight(ticket);
    const expired = OPEN.has(listing.phase) && this.clockMs >= Date.parse(listing.expiresAt);
    const transferred = listing.phase === "TRANSFERRED" || listing.phase === "CLOSED";
    const priorPresentationValid =
      !transferred &&
      right.state === "ACTIVE" &&
      right.version === listing.version &&
      right.holderRole === listing.sellerRole;
    return {
      mode: "mock",
      surface: SURFACES.resaleFsm,
      references: RESALE_REFERENCES,
      provenance: RESALE_PROVENANCE,
      lifecycleAuthority: "IN_MEMORY_FSM",
      listingId: listing.listingId,
      phase: listing.phase,
      terminal: TERMINAL.has(listing.phase),
      pendingSale: OPEN.has(listing.phase),
      rightId: listing.rightId,
      showId: listing.showId,
      eventId: listing.eventId,
      slot: ticket.slot,
      sellerRole: listing.sellerRole,
      recipientRole: listing.recipientRole,
      buyerRole: listing.buyerRole,
      holdId: listing.holdId,
      expiresAt: listing.expiresAt,
      expired,
      attached: OPEN.has(listing.phase) && !expired && right.listingId === listing.listingId,
      version: listing.version,
      versionAfter: listing.versionAfter,
      currentVersion: right.version,
      holderRole: right.holderRole,
      generation: 1,
      paymentRef: listing.paymentRef,
      settlementId: listing.settlementId,
      settlementGate: settlementGate(listing),
      settlementFailure: this.settlementFailed(listing),
      mockSettlementCommitObserved: listing.mockSettlementCommitObserved,
      transferId: listing.transferId,
      ownershipTransferred: transferred,
      priorPresentationValid,
      priorCredentialInvalidated: !priorPresentationValid,
      rightEligible: right.listingId === null && right.state === "ACTIVE",
      slotState: "ISSUED",
      slotRightId: ticket.rightId,
      economicFinalityClaimed: false,
      fundsExecuted: false,
      venueCredentialReissued: false,
      chainOwnerCurrent: false,
      compensationDefined: false,
      admissionRoutingProduction: false,
      externalMarketplace: "UNSUPPORTED",
      externalPayment: "UNSUPPORTED",
      logicalTimeMs: this.clockMs,
      idempotencyKey: listing.echoKey,
      lastRejectCode: listing.lastRejectCode,
      reconcileMatched: listing.reconcileMatched,
      note: RESALE_CASE_NOTE,
    };
  }

  private toRightView(ticket: RightRecord): ResaleRightView {
    const right = this.publicRight(ticket);
    const eligible = right.listingId === null && right.state === "ACTIVE";
    const eligibility: ResaleEligibility = eligible ? "ELIGIBLE" : "LOCKED";
    const live = right.listingId === null ? null : this.listings.get(right.listingId);
    return {
      mode: "mock",
      surface: SURFACES.resaleFsm,
      references: RESALE_REFERENCES,
      provenance: RESALE_PROVENANCE,
      lifecycleAuthority: "IN_MEMORY_FSM",
      rightId: ticket.rightId,
      eligibility,
      eligible,
      salePhase: live ? live.phase : null,
      reservationId: ticket.reservationId,
      showId: ticket.showId,
      eventId: ticket.eventId,
      slot: ticket.slot,
      holderRole: right.holderRole,
      version: right.version,
      generation: 1,
      activeListingId: right.listingId,
      economicFinalityClaimed: false,
      fundsExecuted: false,
      venueCredentialReissued: false,
      externalMarketplace: "UNSUPPORTED",
      logicalTimeMs: this.clockMs,
      lastRejectCode: ticket.lastRejectCode,
      note: RESALE_CASE_NOTE,
    };
  }

  private publicRight(ticket: RightRecord): {
    state: "ACTIVE" | "CONSUMED";
    holderRole: string;
    version: number;
    listingId: string | null;
  } {
    let state: "ACTIVE" | "CONSUMED" = "ACTIVE";
    if (ticket.reservationId !== null) {
      try {
        const reservation = this.reservationView(ticket.reservationId);
        if (reservation.phase === "CONSUMED") {
          state = "CONSUMED";
        }
      } catch (error) {
        if (!(error instanceof ProtocolError)) {
          throw error;
        }
      }
    }
    return {
      state,
      holderRole: ticket.holderRole,
      version: ticket.version,
      listingId: this.liveListingId(ticket),
    };
  }

  private settlementFailed(listing: ListingRecord): boolean {
    if (listing.settlementId === null) {
      return false;
    }
    try {
      return this.settlementView(listing.settlementId).phase === "FAILED";
    } catch (error) {
      if (error instanceof ProtocolError) {
        return false;
      }
      throw error;
    }
  }

  private liveListingId(ticket: RightRecord): string | null {
    const listingId = ticket.activeListingId;
    if (listingId === null) {
      return null;
    }
    const listing = this.listings.get(listingId);
    if (!listing) {
      return null;
    }
    if (OPEN.has(listing.phase) && this.clockMs < Date.parse(listing.expiresAt)) {
      return listingId;
    }
    return null;
  }

  private invariant(): void {
    const liveForRight = new Map<string, string>();
    for (const listing of this.listings.values()) {
      const ticket = this.rights.get(listing.rightId);
      if (!ticket) {
        throw resaleError("MOCK_INVARIANT");
      }
      if (listing.mockSettlementCommitObserved && listing.settlementId === null) {
        throw resaleError("MOCK_INVARIANT");
      }
      const open = OPEN.has(listing.phase) && this.clockMs < Date.parse(listing.expiresAt);
      if (open) {
        if (liveForRight.has(listing.rightId)) {
          throw resaleError("MOCK_INVARIANT");
        }
        liveForRight.set(listing.rightId, listing.listingId);
        if (ticket.holderRole !== listing.sellerRole || ticket.version !== listing.version) {
          throw resaleError("MOCK_INVARIANT");
        }
        if (listing.transferId !== null || listing.mockSettlementCommitObserved) {
          throw resaleError("MOCK_INVARIANT");
        }
      }
      if (listing.phase === "BUY_HELD" && (listing.holdId === null || listing.buyerRole !== listing.recipientRole)) {
        throw resaleError("MOCK_INVARIANT");
      }
      if (listing.phase === "LISTED" && (listing.holdId !== null || listing.paymentRef !== null)) {
        throw resaleError("MOCK_INVARIANT");
      }
      if (listing.phase === "PAYMENT_NOTED" && listing.paymentRef === null) {
        throw resaleError("MOCK_INVARIANT");
      }
      if (listing.phase === "CANCELLED" && (listing.paymentRef !== null || listing.transferId !== null)) {
        throw resaleError("MOCK_INVARIANT");
      }
      if (listing.phase === "TRANSFERRED" || listing.phase === "CLOSED") {
        if (listing.paymentRef === null || listing.transferId === null || listing.versionAfter !== listing.version + 1) {
          throw resaleError("MOCK_INVARIANT");
        }
        if (listing.mockSettlementCommitObserved !== (listing.settlementId !== null)) {
          throw resaleError("MOCK_INVARIANT");
        }
        if (ticket.lastTransferId === listing.transferId) {
          if (ticket.holderRole !== listing.recipientRole || ticket.version !== listing.versionAfter) {
            throw resaleError("MOCK_INVARIANT");
          }
        }
      }
    }
    for (const ticket of this.rights.values()) {
      const live = this.liveListingId(ticket);
      if (live !== (liveForRight.get(ticket.rightId) ?? null)) {
        throw resaleError("MOCK_INVARIANT");
      }
    }
  }

  private claimPayment(paymentRef: string): void {
    if (this.paymentRefs.has(paymentRef)) {
      throw resaleError("PAYMENT_BINDING_CONFLICT");
    }
    this.paymentRefs.add(paymentRef);
  }

  private markListing(listing: ListingRecord, key: string): void {
    listing.lastKey = key;
    listing.echoKey = key;
    listing.lastRejectCode = null;
  }

  private touchRight(rightId: string, key: string): void {
    const ticket = this.rights.get(rightId);
    if (!ticket) {
      throw resaleError("MOCK_INVARIANT");
    }
    ticket.lastKey = key;
    ticket.lastRejectCode = null;
  }

  private requireListing(listingId: string): ListingRecord {
    const listing = this.listings.get(listingId);
    if (!listing) {
      throw resaleError("UNKNOWN_LISTING");
    }
    return listing;
  }

  private requireRight(rightId: string): RightRecord {
    const ticket = this.rights.get(rightId);
    if (!ticket) {
      throw resaleError("UNKNOWN_RIGHT");
    }
    return ticket;
  }

  private targetRight(rightId: string): RejectTarget {
    const id = knownId(rightId);
    return { listingId: null, rightId: id !== null && this.rights.has(id) ? id : null };
  }

  private targetListing(listingId: string): RejectTarget {
    const id = knownId(listingId);
    const listing = id === null ? undefined : this.listings.get(id);
    return {
      listingId: listing ? listing.listingId : null,
      rightId: listing ? listing.rightId : null,
    };
  }

  private targetList(listingId: string, rightId: string): RejectTarget {
    const listingTarget = this.targetListing(listingId);
    if (listingTarget.listingId !== null) {
      return listingTarget;
    }
    const right = knownId(rightId);
    const ticket = right === null ? undefined : this.rights.get(right);
    return {
      listingId: ticket ? this.liveListingId(ticket) : null,
      rightId: ticket ? ticket.rightId : null,
    };
  }

  private targetHold(holdId: string): RejectTarget {
    const id = knownId(holdId);
    const hold = id === null ? undefined : this.holds.get(id);
    return hold ? this.targetListing(hold.listingId) : emptyTarget();
  }
}

function settlementGate(listing: ListingRecord): ResaleSettlementGate {
  if (listing.mockSettlementCommitObserved) {
    return "MOCK_COMMIT_OBSERVED";
  }
  if (listing.settlementId === null) {
    return "UNBOUND";
  }
  return "BOUND";
}

function emptyTarget(): RejectTarget {
  return { listingId: null, rightId: null };
}

function safeTarget(read: () => RejectTarget): RejectTarget {
  try {
    return read();
  } catch {
    return emptyTarget();
  }
}

function optionalId(value: string | null): string {
  return value === null ? "" : value;
}

function readOptional(value: string): string | null {
  if (value.length === 0) {
    return null;
  }
  return ident(value);
}

function readObserved(value: string | undefined): boolean {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw resaleError("MOCK_INVARIANT");
}

function readVersion(value: string): number {
  if (!/^[1-9][0-9]{0,2}$/.test(value)) {
    throw resaleError("INVALID_ID");
  }
  const version = Number(value);
  if (version > 100) {
    throw resaleError("INVALID_ID");
  }
  return version;
}

function readTime(value: string): string {
  const time = ident(value);
  if (!Number.isFinite(Date.parse(time))) {
    throw resaleError("INVALID_ID");
  }
  return time;
}

function knownId(value: string): string | null {
  try {
    return ident(value);
  } catch {
    return null;
  }
}

function ident(value: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 100 || value.trim() !== value || value.includes(",")) {
    throw resaleError("INVALID_ID");
  }
  return value;
}

function resaleError(code: string): ProtocolError {
  return new ProtocolError(`${code}: mock resale command rejected.`, code);
}

function isJournalOp(value: string): value is JournalOp {
  return (JOURNAL_OPS as readonly string[]).includes(value);
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (isRecord(value)) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonicalize(value[key]);
    }
    return sorted;
  }
  return value;
}
