import { JOURNEY_NOT_COMPOSED, type JourneyNotComposed } from "./booking-journey.js";
import { COMMERCE_COMMAND_BINDINGS } from "./commerce-bindings.js";
import {
  DISCOVERY_PROJECTION_AS_OF,
  DISCOVERY_READ_TUPLE_LITERALS,
  checkDiscoveryReadTuple,
  type DiscoveryReadTuple,
} from "./discovery-read.js";
import { type PinnedAction } from "./openapi-contract-pin.js";

/**
 * Synthetic multi-channel trade source for the platform journey screen.
 *
 * This is the stub-scope stand-in for the producer read and write contract. The
 * real connection stays pending on kix-protocol:ps-03-resale-contract,
 * ps-04-execution-partitions, and ps-05-query-projections, and on the unpromoted
 * bind-resale-fsm, refund-surface, and c-async-session-fence. The contract-only
 * catalogue has no read command for a listing, trade, payment, transfer, or
 * refund, so no producer SDK, manifest, or vector is consumed and this module
 * sends nothing over a network.
 *
 * The source is deliberately naive. It does not de-duplicate a repeated
 * intent and it carries no idempotency key, so the only thing that keeps a
 * client from a second effect is the client fence in platform-controller.ts.
 * Its refusals (a stale right version, changed terms, a superseded listing, a
 * missing payment observation) are stub policy for tests and the demo. They are
 * not protocol law, and no amount, fee, or share is computed: a price is an
 * opaque tier label.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const PLATFORM_JOURNEY_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const PLATFORM_NOT_BOUND_REASON =
  "The contract-only catalogue has no read command for a listing, trade, payment, transfer, or refund projection, and the resale contract, execution partitions, and query projections are not merged in kix-protocol. The platform trade journey stays not-bound on integration-http.";

export const PLATFORM_PROJECTION_NAME = "kix.platform.journey";

/** Fixed instant the synthetic source claims to be built at. */
export const PLATFORM_AS_OF = DISCOVERY_PROJECTION_AS_OF;

/** Watermark the stale scenario serves, and the floor a reader holds against it. */
export const PLATFORM_STALE_WATERMARK = "2026-10-10T00:00:00.000Z";
export const PLATFORM_STALE_FLOOR = "2026-10-12T00:00:00.000Z";

/** The desk's own actor string. It is a context label, not an authentication result. */
export const PLATFORM_DESK_ACTOR = "platform-desk";

export const PLATFORM_RIVAL_HOLDER = "holder-rival";

export const PLATFORM_CHANNELS = ["web-board", "partner-board"] as const;

export type PlatformChannel = (typeof PLATFORM_CHANNELS)[number];

/** Booking, payment, issuance, and refund are four independent facets. There is no aggregate. */
export const PLATFORM_FACETS = ["booking", "payment", "issuance", "refund"] as const;

export type PlatformFacet = (typeof PLATFORM_FACETS)[number];

/** The synthetic writes. None of them is a desk method and none is a catalogue command. */
export const PLATFORM_STEPS = ["book", "transfer", "reprice"] as const;

export type PlatformStep = (typeof PLATFORM_STEPS)[number];

/** Opaque price tiers. No amount, currency, or fee is attached to a tier. */
export const PLATFORM_TIERS = ["tier-1", "tier-2", "tier-3"] as const;

export type PlatformTier = (typeof PLATFORM_TIERS)[number];

export const PLATFORM_SCENARIOS = [
  "clean",
  "empty",
  "stale",
  "rival-channel",
  "payment-lost",
  "book-lost",
  "transfer-lost",
  "transfer-late",
  "held-response",
] as const;

export type PlatformScenario = (typeof PLATFORM_SCENARIOS)[number];

export const PLATFORM_REJECT_CODES = [
  "VERSION_STALE",
  "TERMS_CHANGED",
  "LISTING_SUPERSEDED",
  "PAYMENT_NOT_OBSERVED",
  "UNKNOWN_REF",
  "IDENTITY_MISMATCH",
] as const;

export type PlatformRejectCode = (typeof PLATFORM_REJECT_CODES)[number];

/** A rejection with one of these codes means the page read before it wrote is behind. */
export const PLATFORM_STALE_CLASS_CODES: readonly PlatformRejectCode[] = [
  "VERSION_STALE",
  "TERMS_CHANGED",
  "LISTING_SUPERSEDED",
];

export const PLATFORM_INVALID_CODES = ["INTENT", "STEP", "IDENTITY", "TIER", "VERSION"] as const;

export type PlatformInvalidCode = (typeof PLATFORM_INVALID_CODES)[number];

/** Quote of the locked hold binding. H1 keeps this consideredAction and keeps it not-bound. */
export const PLATFORM_HOLD_NOT_BOUND = {
  method: "placeHold",
  status: COMMERCE_COMMAND_BINDINGS.placeHold.status,
  consideredAction: COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction,
  reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
  mappedOntoPrepareTrade: false,
} as const;

/**
 * No compensation policy is published. A trade that took a payment observation and
 * did not move the right shows this code. There is no refund control.
 */
export const PLATFORM_COMPENSATION_UNDEFINED = "COMPENSATION_UNDEFINED";

export const PLATFORM_REFUND_NOT_BOUND = {
  action: "refund_ticket",
  status: "not-bound",
  state: PLATFORM_COMPENSATION_UNDEFINED,
  reason: `${PLATFORM_JOURNEY_RULING}. refund_ticket is pinned and never composed here. No refund id and no compensation policy are published, so a failed or partial trade shows ${PLATFORM_COMPENSATION_UNDEFINED} and no refund control.`,
} as const;

export interface PlatformNotComposed {
  action: JourneyNotComposed["action"] | "refund_ticket";
  reason: string;
}

/**
 * Catalogue commands this module records and does not send. The journey list is
 * reused as is. refund_ticket is added with its own reason.
 */
export const PLATFORM_NOT_COMPOSED: readonly PlatformNotComposed[] = [
  ...JOURNEY_NOT_COMPOSED,
  { action: PLATFORM_REFUND_NOT_BOUND.action, reason: PLATFORM_REFUND_NOT_BOUND.reason },
];

// ---------------------------------------------------------------------------
// Identity. Each kind has its own prefix and one kind is never read as another.
// ---------------------------------------------------------------------------

export const PLATFORM_REF_KINDS = ["listing", "right", "trade", "payment", "transfer", "refund", "terms"] as const;

export type PlatformRefKind = (typeof PLATFORM_REF_KINDS)[number];

const REF_PREFIX: Readonly<Record<PlatformRefKind, string>> = {
  listing: "lst-",
  right: "rgt-",
  trade: "trd-",
  payment: "pay-",
  transfer: "xfr-",
  refund: "rfd-",
  terms: "trm-",
};

const REF_PATTERN = /^(lst|rgt|trd|pay|xfr|rfd|trm)-[0-9]{4}$/;

export function platformRef(kind: PlatformRefKind, serial: number): string {
  return `${REF_PREFIX[kind]}${String(serial).padStart(4, "0")}`;
}

export function platformRefKind(ref: string): PlatformRefKind | null {
  if (!REF_PATTERN.test(ref)) {
    return null;
  }
  for (const kind of PLATFORM_REF_KINDS) {
    if (ref.startsWith(REF_PREFIX[kind])) {
      return kind;
    }
  }
  return null;
}

export function isPlatformRef(ref: unknown, kind: PlatformRefKind): ref is string {
  return typeof ref === "string" && platformRefKind(ref) === kind;
}

export interface PlatformIdentityRow {
  /** Kind of the identity on the screen. */
  id: PlatformRefKind | "version" | "tier";
  /** Field name on this module's snapshot. */
  platformField: string;
  status: "field-named" | "not-bound";
  /**
   * Published body fields that play the same role. A test reads the vendored pin and
   * checks every entry. Empty for a not-bound row. No body is built from this list.
   */
  bodyFields: readonly { action: PinnedAction; field: string }[];
  reason: string;
}

/**
 * Which identity on the platform screen has a named field in the pinned catalogue.
 * Naming a field is not binding it: the value here is a synthetic reference, and
 * the pinned catalogue does not publish the receipt path that would carry it.
 * A row with no field is not-bound and the screen invents none.
 */
export const PLATFORM_IDENTITY_REGISTER: readonly PlatformIdentityRow[] = [
  {
    id: "listing",
    platformField: "listingRef",
    status: "field-named",
    bodyFields: [
      { action: "create_listing", field: "listingId" },
      { action: "prepare_trade", field: "listingId" },
      { action: "reserve_listing", field: "listingId" },
    ],
    reason: "The pinned bodies name listingId. The value here is a synthetic reference and no body is built from it.",
  },
  {
    id: "right",
    platformField: "rightRef",
    status: "field-named",
    bodyFields: [
      { action: "create_listing", field: "ticketId" },
      { action: "prepare_trade", field: "ticketId" },
      { action: "offer_gift", field: "ticketId" },
      { action: "refund_ticket", field: "ticketId" },
    ],
    reason: "The pinned bodies name the right as ticketId. A listing, a trade, and a right stay three identities.",
  },
  {
    id: "trade",
    platformField: "tradeRef",
    status: "field-named",
    bodyFields: [
      { action: "prepare_trade", field: "tradeId" },
      { action: "accept_trade", field: "tradeId" },
      { action: "reserve_listing", field: "tradeId" },
    ],
    reason: "The pinned bodies name tradeId. A trade reference is not a payment reference and not a transfer reference.",
  },
  {
    id: "terms",
    platformField: "termsRef",
    status: "field-named",
    bodyFields: [
      { action: "accept_trade", field: "termsHash" },
      { action: "accept_gift", field: "termsHash" },
    ],
    reason: "The pinned bodies name termsHash. A changed price makes the earlier terms reference stale. No hash is computed here.",
  },
  {
    id: "version",
    platformField: "expectedVersion",
    status: "field-named",
    bodyFields: [
      { action: "create_listing", field: "expectedVersion" },
      { action: "prepare_trade", field: "expectedVersion" },
      { action: "refund_ticket", field: "expectedVersion" },
      { action: "offer_gift", field: "expectedVersion" },
    ],
    reason:
      "The pinned bodies carry the right version the caller read. The client never raises it. Whether a version is current is the source's decision.",
  },
  {
    id: "payment",
    platformField: "paymentRef",
    status: "not-bound",
    bodyFields: [],
    reason:
      "The pinned catalogue names a payment id only on money-posting and payment-effect commands, and every one of them also carries an amount and a currency. This journey composes none of them. The catalogue has no payment observation read, so a payment reference on this screen is a synthetic observation only.",
  },
  {
    id: "transfer",
    platformField: "transferRef",
    status: "not-bound",
    bodyFields: [],
    reason: "No pinned body or receipt names a transfer id. accept_trade carries tradeId only, so a transfer reference on this screen is a synthetic observation only.",
  },
  {
    id: "refund",
    platformField: "refundRef",
    status: "not-bound",
    bodyFields: [],
    reason: `No refund id is published. ${PLATFORM_REFUND_NOT_BOUND.reason}`,
  },
  {
    id: "tier",
    platformField: "tier",
    status: "not-bound",
    bodyFields: [],
    reason:
      "The pinned listing and trade bodies name amount, and this screen copies no amount and shows an opaque tier label. No update-listing command is pinned, and a price change is not composed from cancel_listing plus create_listing.",
  },
];

// ---------------------------------------------------------------------------
// Snapshot and outcome shapes
// ---------------------------------------------------------------------------

export interface PlatformListing {
  listingRef: string;
  rightRef: string;
  channel: PlatformChannel;
  tier: PlatformTier;
  termsRef: string;
  status: "open" | "superseded";
  supersededBy: string | null;
}

export interface PlatformRightView {
  rightRef: string;
  holder: string;
  version: number;
}

/** What the source observed on one facet. An observation is not the caller's own receipt. */
export interface PlatformFacetObservation {
  facet: PlatformFacet;
  state: "observed" | "none" | "unknown" | "unavailable";
  ref: string | null;
  code: string | null;
  note: string;
}

export interface PlatformTradeView {
  tradeRef: string;
  channel: PlatformChannel;
  listingRef: string;
  rightRef: string;
  termsRef: string;
  /** The right version the trade was booked against. */
  expectedVersion: number;
  bookedBy: string;
  /** The holder and version the right had when the trade was booked. */
  originalRight: { holder: string; version: number };
  facets: Readonly<Record<PlatformFacet, PlatformFacetObservation>>;
}

export interface PlatformSnapshot {
  /** Read serial on this port. It orders reads and is not a commit position. */
  snapshotId: number;
  /** Advances on every effect at the source. A label, not a version the client may raise. */
  generation: number;
  watermark: string;
  scenario: PlatformScenario;
  listings: readonly PlatformListing[];
  rights: readonly PlatformRightView[];
  trades: readonly PlatformTradeView[];
}

export interface PlatformReceiptRefs {
  rightRef: string;
  listingRef: string | null;
  tradeRef: string | null;
  termsRef: string | null;
  transferRef: string | null;
  supersededListingRef: string | null;
  rightVersion: number | null;
}

export interface PlatformReadRequest {
  contextKey: string;
  watermarkFloor: string | null;
}

interface PlatformWriteBase {
  contextKey: string;
  actorRef: string;
  /** The caller's intent. The source does not de-duplicate on it. */
  intentRef: string;
}

export type PlatformWriteRequest =
  | (PlatformWriteBase & {
      step: "book";
      listingRef: string;
      rightRef: string;
      termsRef: string;
      expectedVersion: number;
    })
  | (PlatformWriteBase & {
      step: "transfer";
      tradeRef: string;
      listingRef: string;
      rightRef: string;
      termsRef: string;
      expectedVersion: number;
    })
  | (PlatformWriteBase & {
      step: "reprice";
      listingRef: string;
      nextTier: string;
    });

export type PlatformTupleChanged = { kind: "tuple-changed"; field: string; expected: string; actual: string };

export type PlatformReadOutcome =
  | { kind: "ready"; snapshot: PlatformSnapshot }
  | { kind: "empty"; watermark: string; generation: number; snapshotId: number }
  | { kind: "stale"; watermark: string; floor: string }
  | PlatformTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export type PlatformWriteOutcome =
  | { kind: "confirmed"; step: PlatformStep; intentRef: string; contextKey: string; refs: PlatformReceiptRefs }
  | {
      kind: "rejected";
      step: PlatformStep;
      intentRef: string;
      contextKey: string;
      code: PlatformRejectCode;
      detail: string;
    }
  | { kind: "unknown"; step: PlatformStep; intentRef: string; contextKey: string; message: string }
  | { kind: "invalid-request"; step: string; intentRef: string; contextKey: string; code: PlatformInvalidCode; detail: string }
  | (PlatformTupleChanged & { step: string; intentRef: string; contextKey: string })
  | { kind: "not-bound"; reason: string };

/**
 * A result that reaches the client after the client had already treated the write as
 * unknown. A late delivery is evidence. It does not make the write known.
 */
export interface PlatformLateDelivery {
  intentRef: string;
  contextKey: string;
  step: PlatformStep;
  result: "confirmed" | "rejected";
  code: PlatformRejectCode | null;
}

export interface PlatformJourneyPort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic-platform" | "none";
  readonly scenario: PlatformScenario;
  read(request: PlatformReadRequest): Promise<PlatformReadOutcome>;
  submit(request: PlatformWriteRequest): Promise<PlatformWriteOutcome>;
  /** Synthetic control: releases responses the held-response scenario is holding. Returns how many. */
  deliverHeld(): number;
  /** Synthetic control: takes the late results that are due. A real producer offers no such call. */
  deliverLate(): readonly PlatformLateDelivery[];
}

export interface StubPlatformJourneyOptions {
  scenario?: PlatformScenario;
  /** In transfer-late, whether the held transfer really applied. Default confirmed. */
  lateResult?: "confirmed" | "rejected";
  /** Expected tuple override. Used to stage a producer change in tests. */
  expectedTuple?: DiscoveryReadTuple;
}

export interface PlatformEffectCounts {
  /** submit calls that reached the source, whatever they returned. */
  submits: number;
  books: number;
  paymentObservations: number;
  transfers: number;
  rivalTransfers: number;
  reprices: number;
}

export function createStubPlatformJourney(options: StubPlatformJourneyOptions = {}): StubPlatformJourney {
  return new StubPlatformJourney(options);
}

export function createNotBoundPlatformJourney(): PlatformJourneyPort {
  const outcome = { kind: "not-bound", reason: PLATFORM_NOT_BOUND_REASON } as const;
  return {
    environment: "integration-http",
    source: "none",
    scenario: "clean",
    read() {
      return Promise.resolve({ ...outcome });
    },
    submit() {
      return Promise.resolve({ ...outcome });
    },
    deliverHeld() {
      return 0;
    },
    deliverLate() {
      return [];
    },
  };
}

export function platformJourneyPortFor(
  environment: "stub" | "integration-http",
  options: StubPlatformJourneyOptions = {},
): PlatformJourneyPort {
  if (environment === "stub") {
    return createStubPlatformJourney(options);
  }
  return createNotBoundPlatformJourney();
}

interface RightRecord {
  rightRef: string;
  holder: string;
  version: number;
}

interface TradeRecord {
  tradeRef: string;
  channel: PlatformChannel;
  listingRef: string;
  rightRef: string;
  termsRef: string;
  expectedVersion: number;
  bookedBy: string;
  holderAtBooking: string;
  paymentRef: string | null;
  paymentLost: boolean;
  transferRef: string | null;
}

const SEED_RIGHTS: readonly RightRecord[] = [
  { rightRef: "rgt-0001", holder: "holder-seed-1", version: 7 },
  { rightRef: "rgt-0002", holder: "holder-seed-2", version: 3 },
];

const SEED_LISTINGS: readonly PlatformListing[] = [
  {
    listingRef: "lst-0001",
    rightRef: "rgt-0001",
    channel: "web-board",
    tier: "tier-2",
    termsRef: "trm-0001",
    status: "open",
    supersededBy: null,
  },
  {
    listingRef: "lst-0002",
    rightRef: "rgt-0001",
    channel: "partner-board",
    tier: "tier-2",
    termsRef: "trm-0002",
    status: "open",
    supersededBy: null,
  },
  {
    listingRef: "lst-0003",
    rightRef: "rgt-0002",
    channel: "web-board",
    tier: "tier-1",
    termsRef: "trm-0003",
    status: "open",
    supersededBy: null,
  },
];

function isTier(value: string): value is PlatformTier {
  return (PLATFORM_TIERS as readonly string[]).includes(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Synthetic source. State lives in this object, so a new port is a new session. */
export class StubPlatformJourney implements PlatformJourneyPort {
  readonly environment = "stub" as const;
  readonly source = "synthetic-platform" as const;
  readonly scenario: PlatformScenario;
  private readonly lateResult: "confirmed" | "rejected";
  private readonly expectedTuple: DiscoveryReadTuple;
  private readonly rights = new Map<string, RightRecord>();
  private readonly listings = new Map<string, PlatformListing>();
  private readonly trades = new Map<string, TradeRecord>();
  private readonly held: { release: () => void }[] = [];
  private late: PlatformLateDelivery[] = [];
  private generation = 1;
  private snapshotSerial = 0;
  private listingSerial = 4;
  private termsSerial = 4;
  private tradeSerial = 1;
  private paymentSerial = 1;
  private transferSerial = 1;
  private rivalDone = false;
  private readonly counts: PlatformEffectCounts = {
    submits: 0,
    books: 0,
    paymentObservations: 0,
    transfers: 0,
    rivalTransfers: 0,
    reprices: 0,
  };

  constructor(options: StubPlatformJourneyOptions) {
    this.scenario = options.scenario ?? "clean";
    this.lateResult = options.lateResult ?? "confirmed";
    this.expectedTuple = options.expectedTuple ?? DISCOVERY_READ_TUPLE_LITERALS;
    if (this.scenario !== "empty") {
      for (const right of SEED_RIGHTS) {
        this.rights.set(right.rightRef, { ...right });
      }
      for (const listing of SEED_LISTINGS) {
        this.listings.set(listing.listingRef, { ...listing });
      }
    }
  }

  /** Test seam. Counts of what reached the source. Not part of the port. */
  effects(): PlatformEffectCounts {
    return { ...this.counts };
  }

  read(request: PlatformReadRequest): Promise<PlatformReadOutcome> {
    return Promise.resolve(this.readNow(request));
  }

  deliverHeld(): number {
    const releasing = this.held.splice(0, this.held.length);
    for (const entry of releasing) {
      entry.release();
    }
    return releasing.length;
  }

  deliverLate(): readonly PlatformLateDelivery[] {
    const due = this.late;
    this.late = [];
    return due;
  }

  submit(request: PlatformWriteRequest): Promise<PlatformWriteOutcome> {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return Promise.resolve({
        kind: "tuple-changed",
        field: tuple.field,
        expected: tuple.expected,
        actual: tuple.actual,
        step: String(request.step),
        intentRef: request.intentRef,
        contextKey: request.contextKey,
      });
    }
    const invalid = this.validate(request);
    if (invalid !== null) {
      return Promise.resolve(invalid);
    }
    this.counts.submits += 1;
    const outcome = this.apply(request);
    if (this.scenario === "held-response") {
      return new Promise<PlatformWriteOutcome>((resolve) => {
        this.held.push({ release: () => resolve(outcome) });
      });
    }
    return Promise.resolve(outcome);
  }

  private readNow(request: PlatformReadRequest): PlatformReadOutcome {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return { kind: "tuple-changed", field: tuple.field, expected: tuple.expected, actual: tuple.actual };
    }
    this.snapshotSerial += 1;
    const watermark = this.scenario === "stale" ? PLATFORM_STALE_WATERMARK : PLATFORM_AS_OF;
    const floor = request.watermarkFloor ?? (this.scenario === "stale" ? PLATFORM_STALE_FLOOR : null);
    if (floor !== null && Date.parse(watermark) < Date.parse(floor)) {
      return { kind: "stale", watermark, floor };
    }
    if (this.scenario === "empty") {
      return { kind: "empty", watermark, generation: this.generation, snapshotId: this.snapshotSerial };
    }
    return {
      kind: "ready",
      snapshot: {
        snapshotId: this.snapshotSerial,
        generation: this.generation,
        watermark,
        scenario: this.scenario,
        listings: [...this.listings.values()].map((listing) => ({ ...listing })),
        rights: [...this.rights.values()].map((right) => ({ ...right })),
        trades: [...this.trades.values()].map((trade) => this.tradeView(trade)),
      },
    };
  }

  private invalid(
    request: { step: unknown; intentRef: unknown; contextKey: unknown },
    code: PlatformInvalidCode,
    detail: string,
  ): PlatformWriteOutcome {
    return {
      kind: "invalid-request",
      step: String(request.step),
      intentRef: String(request.intentRef),
      contextKey: String(request.contextKey),
      code,
      detail,
    };
  }

  private validate(request: PlatformWriteRequest): PlatformWriteOutcome | null {
    if (!nonEmpty(request.intentRef) || !nonEmpty(request.contextKey)) {
      return this.invalid(request, "INTENT", "A write carries an intent reference and a context key.");
    }
    if (!(PLATFORM_STEPS as readonly string[]).includes(request.step)) {
      return this.invalid(request, "STEP", `Step ${String(request.step)} is not a platform step.`);
    }
    if (request.step === "book") {
      if (
        !isPlatformRef(request.listingRef, "listing") ||
        !isPlatformRef(request.rightRef, "right") ||
        !isPlatformRef(request.termsRef, "terms")
      ) {
        return this.invalid(request, "IDENTITY", "A booking names a listing, a right, and terms by their own reference kinds.");
      }
      if (!Number.isInteger(request.expectedVersion)) {
        return this.invalid(request, "VERSION", "The expected right version is a whole number.");
      }
    } else if (request.step === "transfer") {
      if (
        !isPlatformRef(request.tradeRef, "trade") ||
        !isPlatformRef(request.listingRef, "listing") ||
        !isPlatformRef(request.rightRef, "right") ||
        !isPlatformRef(request.termsRef, "terms")
      ) {
        return this.invalid(
          request,
          "IDENTITY",
          "A transfer names a trade, a listing, a right, and terms by their own reference kinds.",
        );
      }
      if (!Number.isInteger(request.expectedVersion)) {
        return this.invalid(request, "VERSION", "The expected right version is a whole number.");
      }
    } else {
      if (!isPlatformRef(request.listingRef, "listing")) {
        return this.invalid(request, "IDENTITY", "A tier change names a listing reference.");
      }
      if (typeof request.nextTier !== "string" || !isTier(request.nextTier)) {
        return this.invalid(request, "TIER", `Tier ${String(request.nextTier)} is not one of ${PLATFORM_TIERS.join(", ")}.`);
      }
    }
    return null;
  }

  private rejected(request: PlatformWriteRequest, code: PlatformRejectCode, detail: string): PlatformWriteOutcome {
    return {
      kind: "rejected",
      step: request.step,
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      code,
      detail,
    };
  }

  private apply(request: PlatformWriteRequest): PlatformWriteOutcome {
    switch (request.step) {
      case "book":
        return this.applyBook(request);
      case "transfer":
        return this.applyTransfer(request);
      case "reprice":
        return this.applyReprice(request);
      default: {
        const exhaustive: never = request;
        return exhaustive;
      }
    }
  }

  private lost(request: PlatformWriteRequest, message: string): PlatformWriteOutcome {
    return {
      kind: "unknown",
      step: request.step,
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      message,
    };
  }

  private applyBook(request: Extract<PlatformWriteRequest, { step: "book" }>): PlatformWriteOutcome {
    const listing = this.listings.get(request.listingRef);
    if (!listing) {
      return this.rejected(request, "UNKNOWN_REF", `Listing ${request.listingRef} is not at the source.`);
    }
    if (listing.rightRef !== request.rightRef) {
      return this.rejected(request, "IDENTITY_MISMATCH", `Listing ${request.listingRef} is not a listing of ${request.rightRef}.`);
    }
    if (listing.status === "superseded") {
      return this.rejected(request, "LISTING_SUPERSEDED", `Listing ${request.listingRef} was superseded by ${String(listing.supersededBy)}.`);
    }
    if (listing.termsRef !== request.termsRef) {
      return this.rejected(request, "TERMS_CHANGED", `Listing ${request.listingRef} carries different terms than the ones read.`);
    }
    const right = this.rights.get(listing.rightRef);
    if (!right || right.version !== request.expectedVersion) {
      return this.rejected(request, "VERSION_STALE", `Right ${listing.rightRef} is no longer at version ${request.expectedVersion}.`);
    }
    const tradeRef = platformRef("trade", this.tradeSerial);
    this.tradeSerial += 1;
    const paymentLost = this.scenario === "payment-lost";
    let paymentRef: string | null = null;
    if (!paymentLost) {
      paymentRef = platformRef("payment", this.paymentSerial);
      this.paymentSerial += 1;
      this.counts.paymentObservations += 1;
    }
    this.trades.set(tradeRef, {
      tradeRef,
      channel: listing.channel,
      listingRef: listing.listingRef,
      rightRef: right.rightRef,
      termsRef: listing.termsRef,
      expectedVersion: right.version,
      bookedBy: request.actorRef,
      holderAtBooking: right.holder,
      paymentRef,
      paymentLost,
      transferRef: null,
    });
    this.counts.books += 1;
    this.generation += 1;
    if (this.scenario === "book-lost") {
      return this.lost(request, "The response to the booking never arrived. The source may have applied it.");
    }
    return {
      kind: "confirmed",
      step: "book",
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      refs: {
        rightRef: right.rightRef,
        listingRef: listing.listingRef,
        tradeRef,
        termsRef: listing.termsRef,
        transferRef: null,
        supersededListingRef: null,
        rightVersion: right.version,
      },
    };
  }

  private applyRival(rightRef: string): void {
    const right = this.rights.get(rightRef);
    if (!right) {
      return;
    }
    const listing = [...this.listings.values()].find(
      (item) => item.rightRef === rightRef && item.channel === "partner-board" && item.status === "open",
    );
    const tradeRef = platformRef("trade", this.tradeSerial);
    this.tradeSerial += 1;
    const paymentRef = platformRef("payment", this.paymentSerial);
    this.paymentSerial += 1;
    const transferRef = platformRef("transfer", this.transferSerial);
    this.transferSerial += 1;
    this.trades.set(tradeRef, {
      tradeRef,
      channel: "partner-board",
      listingRef: listing ? listing.listingRef : "lst-0002",
      rightRef,
      termsRef: listing ? listing.termsRef : "trm-0002",
      expectedVersion: right.version,
      bookedBy: PLATFORM_RIVAL_HOLDER,
      holderAtBooking: right.holder,
      paymentRef,
      paymentLost: false,
      transferRef,
    });
    right.holder = PLATFORM_RIVAL_HOLDER;
    right.version += 1;
    this.counts.books += 1;
    this.counts.paymentObservations += 1;
    this.counts.rivalTransfers += 1;
    this.generation += 1;
    this.rivalDone = true;
  }

  private applyTransfer(request: Extract<PlatformWriteRequest, { step: "transfer" }>): PlatformWriteOutcome {
    const trade = this.trades.get(request.tradeRef);
    if (!trade) {
      return this.rejected(request, "UNKNOWN_REF", `Trade ${request.tradeRef} is not at the source.`);
    }
    if (trade.listingRef !== request.listingRef || trade.rightRef !== request.rightRef) {
      return this.rejected(request, "IDENTITY_MISMATCH", `Trade ${request.tradeRef} does not belong to that listing and right.`);
    }
    if (this.scenario === "rival-channel" && !this.rivalDone) {
      this.applyRival(trade.rightRef);
    }
    const right = this.rights.get(trade.rightRef);
    const listing = this.listings.get(trade.listingRef);
    if (!right || !listing) {
      return this.rejected(request, "UNKNOWN_REF", `Right or listing of ${request.tradeRef} is not at the source.`);
    }
    if (trade.paymentRef === null) {
      return this.rejected(request, "PAYMENT_NOT_OBSERVED", `Trade ${request.tradeRef} has no payment observation.`);
    }
    if (listing.status === "superseded" || trade.termsRef !== request.termsRef) {
      return this.rejected(request, "TERMS_CHANGED", `The terms of ${request.tradeRef} are no longer the listing terms.`);
    }
    if (right.version !== request.expectedVersion || trade.transferRef !== null) {
      return this.rejected(request, "VERSION_STALE", `Right ${right.rightRef} is no longer at version ${request.expectedVersion}.`);
    }
    const lateRejected = this.scenario === "transfer-late" && this.lateResult === "rejected";
    if (lateRejected) {
      this.late.push({
        intentRef: request.intentRef,
        contextKey: request.contextKey,
        step: "transfer",
        result: "rejected",
        code: "VERSION_STALE",
      });
      return this.lost(request, "The response to the transfer never arrived. The source did not apply it.");
    }
    const transferRef = platformRef("transfer", this.transferSerial);
    this.transferSerial += 1;
    trade.transferRef = transferRef;
    right.holder = trade.bookedBy;
    right.version += 1;
    this.counts.transfers += 1;
    this.generation += 1;
    if (this.scenario === "transfer-lost" || this.scenario === "transfer-late") {
      if (this.scenario === "transfer-late") {
        this.late.push({
          intentRef: request.intentRef,
          contextKey: request.contextKey,
          step: "transfer",
          result: "confirmed",
          code: null,
        });
      }
      return this.lost(request, "The response to the transfer never arrived. The source may have applied it.");
    }
    return {
      kind: "confirmed",
      step: "transfer",
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      refs: {
        rightRef: right.rightRef,
        listingRef: trade.listingRef,
        tradeRef: trade.tradeRef,
        termsRef: trade.termsRef,
        transferRef,
        supersededListingRef: null,
        rightVersion: right.version,
      },
    };
  }

  private applyReprice(request: Extract<PlatformWriteRequest, { step: "reprice" }>): PlatformWriteOutcome {
    const listing = this.listings.get(request.listingRef);
    if (!listing) {
      return this.rejected(request, "UNKNOWN_REF", `Listing ${request.listingRef} is not at the source.`);
    }
    if (listing.status === "superseded") {
      return this.rejected(request, "LISTING_SUPERSEDED", `Listing ${request.listingRef} was superseded by ${String(listing.supersededBy)}.`);
    }
    if (listing.tier === request.nextTier) {
      return this.invalid(request, "TIER", `Listing ${request.listingRef} is already ${request.nextTier}.`);
    }
    const nextRef = platformRef("listing", this.listingSerial);
    this.listingSerial += 1;
    const nextTerms = platformRef("terms", this.termsSerial);
    this.termsSerial += 1;
    listing.status = "superseded";
    listing.supersededBy = nextRef;
    this.listings.set(nextRef, {
      listingRef: nextRef,
      rightRef: listing.rightRef,
      channel: listing.channel,
      tier: request.nextTier as PlatformTier,
      termsRef: nextTerms,
      status: "open",
      supersededBy: null,
    });
    this.counts.reprices += 1;
    this.generation += 1;
    return {
      kind: "confirmed",
      step: "reprice",
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      refs: {
        rightRef: listing.rightRef,
        listingRef: nextRef,
        tradeRef: null,
        termsRef: nextTerms,
        transferRef: null,
        supersededListingRef: listing.listingRef,
        rightVersion: null,
      },
    };
  }

  private tradeView(trade: TradeRecord): PlatformTradeView {
    const right = this.rights.get(trade.rightRef);
    const listing = this.listings.get(trade.listingRef);
    const issued = trade.transferRef !== null;
    const paymentSeen = trade.paymentRef !== null || trade.paymentLost;
    const moved = right !== undefined && right.version !== trade.expectedVersion;
    const superseded = listing !== undefined && listing.status === "superseded";
    const stranded = !issued && paymentSeen && (moved || superseded || trade.paymentLost);

    const payment: PlatformFacetObservation =
      trade.paymentRef !== null
        ? { facet: "payment", state: "observed", ref: trade.paymentRef, code: null, note: "A payment observation was recorded for this trade." }
        : {
            facet: "payment",
            state: "unknown",
            ref: null,
            code: "PAYMENT_OBSERVATION_MISSING",
            note: "No payment observation arrived. Whether funds moved is not known here.",
          };
    const issuance: PlatformFacetObservation = issued
      ? { facet: "issuance", state: "observed", ref: trade.transferRef, code: null, note: "The right moved to this trade's buyer at the source." }
      : { facet: "issuance", state: "none", ref: null, code: null, note: "The right did not move for this trade." };
    const refund: PlatformFacetObservation = stranded
      ? {
          facet: "refund",
          state: "unavailable",
          ref: null,
          code: PLATFORM_COMPENSATION_UNDEFINED,
          note: "No compensation policy and no refund command are published. Nothing is refunded and nothing is queued.",
        }
      : { facet: "refund", state: "none", ref: null, code: null, note: "Nothing to compensate on this trade." };

    return {
      tradeRef: trade.tradeRef,
      channel: trade.channel,
      listingRef: trade.listingRef,
      rightRef: trade.rightRef,
      termsRef: trade.termsRef,
      expectedVersion: trade.expectedVersion,
      bookedBy: trade.bookedBy,
      originalRight: { holder: trade.holderAtBooking, version: trade.expectedVersion },
      facets: {
        booking: { facet: "booking", state: "observed", ref: trade.tradeRef, code: null, note: "A trade record was seen at the source." },
        payment,
        issuance,
        refund,
      },
    };
  }
}
