import { COMMERCE_COMMAND_BINDINGS } from "./commerce-bindings.js";
import {
  DISCOVERY_PROJECTION_AS_OF,
  DISCOVERY_READ_TENANT,
  DISCOVERY_READ_TUPLE_LITERALS,
  checkDiscoveryReadTuple,
  type DiscoveryAccessScope,
  type DiscoveryReadTuple,
} from "./discovery-read.js";
import { isRecord } from "./record.js";
import { sha256Hex } from "./sha256.js";

/**
 * Bounded synthetic marketplace read for the scale bench screen.
 *
 * This is the stub-scope stand-in for the producer read contract the pending
 * node c-marketplace-performance waits on (kix-protocol:ps-07-scale-qualification
 * is not merged). The shared discovery tuple records consumed app SDK digests;
 * it does not bind the unavailable marketplace producer. The contract-only catalogue has no marketplace read,
 * queue, or search command, so the same port stays not-bound on
 * integration-http.
 *
 * Rows are synthetic listing labels served from a lazy stream: the source
 * holds the 150,000-row denominator and materializes only the bounded window
 * a read asks for. A row confirms no price, no right, no sale, and no
 * ownership. Queue admission is browse access to the contended page only. It
 * is not a hold, not a payment, not an issued right, and not entry.
 *
 * Every outcome carries `offeredMs`, the latency the synthetic source declares
 * for that call. It is a source-side label, kept on its own denominator. The
 * caller's own measured latency is a separate figure, and no measurement here
 * is a producer load test or real-device evidence.
 *
 * This module sends nothing, retries nothing, reads no clock, and uses no
 * randomness.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const MARKETPLACE_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const MARKETPLACE_NOT_BOUND_REASON =
  "No current producer tuple exists for the marketplace scale bench: kix-protocol:ps-07-scale-qualification is not merged and pending node c-marketplace-performance is not promoted. The contract-only catalogue has no marketplace read, queue, or search command. The bench stays NOT_BOUND on integration-http.";

/** Quote of the locked hold binding. H1 keeps this consideredAction and keeps it not-bound. */
export const MARKETPLACE_HOLD_NOT_BOUND = {
  method: "placeHold",
  status: COMMERCE_COMMAND_BINDINGS.placeHold.status,
  consideredAction: COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction,
  reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
  mappedOntoPrepareTrade: false,
} as const;

export const MARKETPLACE_PROJECTION_NAME = "kix.marketplace.bench";

export const MARKETPLACE_PROJECTION_REVISION = "syn-1";

/** Hard bound on rows per read call. A larger request is refused, not clamped. */
export const MARKETPLACE_PAGE_BOUND = 50;

/** Hard bound on the filter text. A longer text is refused, not truncated. */
export const MARKETPLACE_TEXT_BOUND = 64;

/** The lazy stream denominator. The source materializes the window only. */
export const MARKETPLACE_TOTAL_LISTINGS = 150_000;

export const MARKETPLACE_TENANT = DISCOVERY_READ_TENANT;

/** A tenant this desk never serves. A read scoped to it is denied. */
export const MARKETPLACE_FOREIGN_TENANT = "ten-0002";

/** The desk's own access scope. The subject string is not an authentication result. */
export const MARKETPLACE_DESK_SCOPE = {
  tenantId: MARKETPLACE_TENANT,
  subject: "marketplace-bench",
} as const;

export type MarketplaceAccessScope = DiscoveryAccessScope;

/** Fixed instant the synthetic projection claims to be built at. */
export const MARKETPLACE_AS_OF = DISCOVERY_PROJECTION_AS_OF;

/** A watermark older than this span before AS_OF is stale. */
export const MARKETPLACE_STALE_AFTER_MS = 86_400_000;

export const MARKETPLACE_CURSOR_VERSION = 1;

/** Terms label the stream serves until the synthetic move-terms control runs. */
export const MARKETPLACE_TERMS_START = "trm-01";

/**
 * Device labels this bench can honestly report. A desktop viewport profile is
 * declared as emulation: it is never real mobile evidence. No real handset or
 * tablet ran in this session, so those classes stay unverified and are never
 * filled with a desktop measurement.
 */
export const MARKETPLACE_DEVICE_PROFILES = [
  {
    deviceClass: "desktop-browser",
    realDevice: true,
    note: "The desktop browser this page ran in.",
  },
  {
    deviceClass: "desktop-emulated-mobile",
    realDevice: false,
    note: "A desktop browser with a small-viewport profile. Emulation, not real mobile evidence.",
  },
] as const;

export type MarketplaceDeviceClass = (typeof MARKETPLACE_DEVICE_PROFILES)[number]["deviceClass"];

/** Real devices no local run can measure. They are reported as unverified, never as measured. */
export const MARKETPLACE_UNVERIFIED_DEVICES = ["real-mobile", "real-tablet"] as const;

export type MarketplaceUnverifiedDevice = (typeof MARKETPLACE_UNVERIFIED_DEVICES)[number];

export const MARKETPLACE_WORKLOADS = [
  "browse-window",
  "hot-page",
  "fast-search",
  "queue-expiry",
] as const;

export type MarketplaceWorkload = (typeof MARKETPLACE_WORKLOADS)[number];

export const MARKETPLACE_SCENARIOS = [
  "clean",
  "empty",
  "stale",
  "slow",
  "held",
  "contended",
  "queue-lapsed",
  "permission-lost",
  "terms-moved",
  "read-lost",
  "claims-price",
  "claims-device",
] as const;

export type MarketplaceScenario = (typeof MARKETPLACE_SCENARIOS)[number];

/** The synthetic source-side latency each scenario declares, in milliseconds. */
export const MARKETPLACE_OFFERED_MS: Readonly<Record<MarketplaceScenario, number>> = {
  clean: 6,
  empty: 6,
  stale: 8,
  slow: 1400,
  held: 900,
  contended: 240,
  "queue-lapsed": 240,
  "permission-lost": 4,
  "terms-moved": 12,
  "read-lost": 0,
  "claims-price": 8,
  "claims-device": 8,
};

export const MARKETPLACE_INVALID_CODES = [
  "BOUND",
  "SCOPE",
  "FILTER",
  "PAGE_SIZE",
  "CURSOR",
  "WORKLOAD",
  "DEVICE",
] as const;

export type MarketplaceInvalidCode = (typeof MARKETPLACE_INVALID_CODES)[number];

export const MARKETPLACE_GAP_CODES = ["SEQUENCE", "ORDER", "DUPLICATE", "OVER_BOUND"] as const;

export type MarketplaceGapCode = (typeof MARKETPLACE_GAP_CODES)[number];

export const MARKETPLACE_CURSOR_CODES = ["VERSION", "REBUILT", "FILTER", "TENANT", "TERMS", "SHAPE"] as const;

export type MarketplaceCursorCode = (typeof MARKETPLACE_CURSOR_CODES)[number];

export const MARKETPLACE_DENIED_CODES = ["PERMISSION_REVOKED", "FOREIGN_TENANT"] as const;

export type MarketplaceDeniedCode = (typeof MARKETPLACE_DENIED_CODES)[number];

export const MARKETPLACE_REFUSAL_CODES = ["PRICE_CLAIM", "RIGHT_CLAIM", "DEVICE_CLAIM", "LOAD_CLAIM"] as const;

export type MarketplaceRefusalCode = (typeof MARKETPLACE_REFUSAL_CODES)[number];

export const MARKETPLACE_QUEUE_STATES = ["none", "waiting", "admitted", "expired"] as const;

export type MarketplaceQueueState = (typeof MARKETPLACE_QUEUE_STATES)[number];

/**
 * Queue admission means access to read the contended page. It is not a hold,
 * not a payment, not an issued right, and not entry at the door. Expiry is the
 * source's own verdict; the page copies `expired` and decides nothing from a
 * clock.
 */
export interface MarketplaceQueueView {
  state: MarketplaceQueueState;
  queueRef: string | null;
  position: number | null;
  admittedUntil: string | null;
  expired: boolean | null;
  grantsBrowseAccess: boolean;
  grantsReservation: false;
  grantsPayment: false;
  grantsRight: false;
}

export const MARKETPLACE_NO_QUEUE: MarketplaceQueueView = {
  state: "none",
  queueRef: null,
  position: null,
  admittedUntil: null,
  expired: null,
  grantsBrowseAccess: false,
  grantsReservation: false,
  grantsPayment: false,
  grantsRight: false,
};

/** One synthetic listing row. A label set, never a price or a right. */
export interface MarketplaceListingRow {
  sequence: number;
  tenantId: string;
  listingRef: string;
  eventLabel: string;
  venueLabel: string;
  /** Opaque tier label. No amount or fee is attached. */
  tier: string;
  termsRef: string;
  status: "open" | "closed";
  watermark: string;
  confirmsPrice: false;
  confirmsRight: false;
  confirmsSale: false;
  confirmsOwnership: false;
}

export interface MarketplaceFilter {
  text: string;
}

export const EMPTY_MARKETPLACE_FILTER: MarketplaceFilter = { text: "" };

export interface MarketplaceReadCursor {
  cursorVersion: number;
  projectionName: string;
  projectionRevision: string;
  tenantId: string;
  filterKey: string;
  termsRef: string;
  afterSequence: number;
  watermark: string;
}

export interface MarketplaceReadRequest {
  contextKey: string;
  scope: MarketplaceAccessScope;
  filter: MarketplaceFilter;
  pageSize: number;
  cursor: MarketplaceReadCursor | null;
  watermarkFloor: string | null;
  /** The terms the last ready read reported, or null before one. A moved terms set rejects the read. */
  termsRef: string | null;
  workload: MarketplaceWorkload;
  deviceClass: MarketplaceDeviceClass;
}

export interface MarketplaceQueueRequest {
  contextKey: string;
  scope: MarketplaceAccessScope;
  workload: MarketplaceWorkload;
  deviceClass: MarketplaceDeviceClass;
}

interface Timing {
  /** The latency the synthetic source declares for this call. A source-side label. */
  offeredMs: number;
}

export type MarketplaceReadOutcome =
  | ({
      kind: "ready";
      rows: readonly MarketplaceListingRow[];
      nextCursor: MarketplaceReadCursor | null;
      watermark: string;
      scannedCount: number;
      totalEstimate: number;
      revision: string;
      termsRef: string;
      queue: MarketplaceQueueView;
      realDeviceEvidence: false;
      producerLoadMeasurement: false;
    } & Timing)
  | ({ kind: "empty"; watermark: string; totalEstimate: number; revision: string } & Timing)
  | ({ kind: "stale"; watermark: string; floor: string } & Timing)
  | ({ kind: "terms-moved"; held: string; current: string } & Timing)
  | ({ kind: "queue-blocked"; queue: MarketplaceQueueView } & Timing)
  | ({ kind: "queue-expired"; queue: MarketplaceQueueView } & Timing)
  | ({ kind: "denied"; code: MarketplaceDeniedCode; detail: string } & Timing)
  | ({ kind: "refused"; code: MarketplaceRefusalCode; detail: string } & Timing)
  | ({ kind: "gap"; code: MarketplaceGapCode; detail: string } & Timing)
  | ({ kind: "cursor-invalid"; code: MarketplaceCursorCode; detail: string } & Timing)
  | ({ kind: "invalid-request"; code: MarketplaceInvalidCode; detail: string } & Timing)
  | ({ kind: "tuple-changed"; field: string; expected: string; actual: string } & Timing)
  | ({ kind: "not-bound"; reason: string } & Timing)
  | ({ kind: "unknown"; message: string } & Timing);

export type MarketplaceQueueOutcome =
  | ({ kind: "queued"; queue: MarketplaceQueueView } & Timing)
  | ({ kind: "queue-state"; queue: MarketplaceQueueView } & Timing)
  | ({ kind: "denied"; code: MarketplaceDeniedCode; detail: string } & Timing)
  | ({ kind: "invalid-request"; code: MarketplaceInvalidCode; detail: string } & Timing)
  | ({ kind: "tuple-changed"; field: string; expected: string; actual: string } & Timing)
  | ({ kind: "not-bound"; reason: string } & Timing)
  | ({ kind: "unknown"; message: string } & Timing);

/**
 * Synthetic controls a real producer does not offer. They stand in for a held
 * answer being delivered, a lapsed queue admission, a permission revocation
 * and its restore, and a terms move on the catalogue side.
 */
export const MARKETPLACE_SYNTHETIC_CONTROLS = [
  "deliver-held",
  "expire-queue",
  "revoke-permission",
  "restore-permission",
  "move-terms",
] as const;

export type MarketplaceSyntheticControl = (typeof MARKETPLACE_SYNTHETIC_CONTROLS)[number];

export interface MarketplaceBenchPort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic-marketplace" | "none";
  readonly revision: string;
  readonly scenario: MarketplaceScenario;
  readPage(request: MarketplaceReadRequest): Promise<MarketplaceReadOutcome>;
  joinQueue(request: MarketplaceQueueRequest): Promise<MarketplaceQueueOutcome>;
  readQueue(request: MarketplaceQueueRequest): Promise<MarketplaceQueueOutcome>;
  synthetic(control: MarketplaceSyntheticControl): boolean;
}

export interface StubMarketplaceBenchOptions {
  /** Synthetic scenario. Default clean. */
  scenario?: MarketplaceScenario;
  /** Projection revision this source serves. Default MARKETPLACE_PROJECTION_REVISION. */
  revision?: string;
  /** Lazy stream length. Default MARKETPLACE_TOTAL_LISTINGS. */
  rowCount?: number;
  /** Lazy row generator. The port calls it for the bounded window only. */
  rowAt?: (index: number) => MarketplaceListingRow;
  /** Expected tuple override. Used to stage a producer change in tests. */
  expectedTuple?: DiscoveryReadTuple;
}

export function createStubMarketplaceBench(options: StubMarketplaceBenchOptions = {}): MarketplaceBenchPort {
  return new StubMarketplaceBench(options);
}

export function createNotBoundMarketplaceBench(): MarketplaceBenchPort {
  const outcome = { kind: "not-bound", reason: MARKETPLACE_NOT_BOUND_REASON, offeredMs: 0 } as const;
  return {
    environment: "integration-http",
    source: "none",
    revision: MARKETPLACE_PROJECTION_REVISION,
    scenario: "clean",
    readPage() {
      return Promise.resolve({ ...outcome });
    },
    joinQueue() {
      return Promise.resolve({ ...outcome });
    },
    readQueue() {
      return Promise.resolve({ ...outcome });
    },
    synthetic() {
      return false;
    },
  };
}

export function marketplaceBenchPortFor(
  environment: "stub" | "integration-http",
  options: StubMarketplaceBenchOptions = {},
): MarketplaceBenchPort {
  if (environment === "stub") {
    return createStubMarketplaceBench(options);
  }
  return createNotBoundMarketplaceBench();
}

export function marketplaceFilterKey(filter: MarketplaceFilter): string {
  return sha256Hex(JSON.stringify({ text: filter.text }));
}

/** One lazy listing row. The source calls this for the bounded window only. */
export function marketplaceRowAt(index: number): MarketplaceListingRow {
  const sequence = index + 1;
  return {
    sequence,
    tenantId: MARKETPLACE_TENANT,
    listingRef: `mkl-${pad6(sequence)}`,
    eventLabel: `Synthetic listing ${sequence}`,
    venueLabel: STREAM_VENUES[index % STREAM_VENUES.length] ?? "Scale hall",
    tier: `T${(index % 4) + 1}`,
    termsRef: MARKETPLACE_TERMS_START,
    status: index % 11 === 10 ? "closed" : "open",
    watermark: MARKETPLACE_AS_OF,
    confirmsPrice: false,
    confirmsRight: false,
    confirmsSale: false,
    confirmsOwnership: false,
  };
}

interface QueueState {
  state: MarketplaceQueueState;
  queueRef: string | null;
  position: number | null;
  admittedUntil: string | null;
  expired: boolean;
}

class StubMarketplaceBench implements MarketplaceBenchPort {
  readonly environment = "stub" as const;
  readonly source = "synthetic-marketplace" as const;
  readonly revision: string;
  readonly scenario: MarketplaceScenario;
  private readonly size: number;
  private readonly rowAt: (index: number) => MarketplaceListingRow;
  private readonly expectedTuple: DiscoveryReadTuple;
  private readonly seenListingRefs = new Set<string>();
  private queue: QueueState;
  private permissionRevoked: boolean;
  private currentTerms = MARKETPLACE_TERMS_START;
  private termsMoves = 0;
  private joinSeq = 0;
  private held: (() => void)[] = [];

  constructor(options: StubMarketplaceBenchOptions) {
    this.revision = options.revision ?? MARKETPLACE_PROJECTION_REVISION;
    this.scenario = options.scenario ?? "clean";
    this.size = options.rowCount ?? (this.scenario === "empty" ? 0 : MARKETPLACE_TOTAL_LISTINGS);
    this.rowAt = options.rowAt ?? marketplaceRowAt;
    this.expectedTuple = options.expectedTuple ?? DISCOVERY_READ_TUPLE_LITERALS;
    this.permissionRevoked = this.scenario === "permission-lost";
    this.queue =
      this.scenario === "queue-lapsed"
        ? {
            state: "expired",
            queueRef: "mqu-lapsed",
            position: null,
            admittedUntil: null,
            expired: true,
          }
        : { state: "none", queueRef: null, position: null, admittedUntil: null, expired: false };
  }

  private offered(): Timing {
    return { offeredMs: MARKETPLACE_OFFERED_MS[this.scenario] };
  }

  private queueView(): MarketplaceQueueView {
    return {
      state: this.queue.state,
      queueRef: this.queue.queueRef,
      position: this.queue.position,
      admittedUntil: this.queue.admittedUntil,
      expired: this.queue.state === "expired" ? true : this.queue.state === "none" ? null : this.queue.expired,
      grantsBrowseAccess: this.queue.state === "admitted" && !this.queue.expired,
      grantsReservation: false,
      grantsPayment: false,
      grantsRight: false,
    };
  }

  private tupleCheck(): Extract<MarketplaceReadOutcome, { kind: "tuple-changed" }> | null {
    const mismatch = checkDiscoveryReadTuple(this.expectedTuple);
    if (mismatch === null) {
      return null;
    }
    return {
      kind: "tuple-changed",
      field: mismatch.field,
      expected: mismatch.expected,
      actual: mismatch.actual,
      ...this.offered(),
    };
  }

  private denied(): MarketplaceReadOutcome & MarketplaceQueueOutcome {
    return {
      kind: "denied",
      code: "PERMISSION_REVOKED",
      detail: "The marketplace browse permission was revoked at the source. This is a denial, not an empty market.",
      ...this.offered(),
    } as MarketplaceReadOutcome & MarketplaceQueueOutcome;
  }

  private termsNow(): string {
    return this.currentTerms;
  }

  /**
   * Held answers wait for the synthetic deliver control, and on read-lost they
   * never arrive. The caller shows in-flight, cancelled, or unknown — never a
   * success for an answer that did not land.
   */
  private maybeHold<T extends MarketplaceReadOutcome | MarketplaceQueueOutcome>(outcome: T): Promise<T> {
    if (this.scenario === "held") {
      return new Promise<T>((resolve) => {
        this.held.push(() => resolve(outcome));
      });
    }
    if (this.scenario === "read-lost") {
      return new Promise<T>(() => {});
    }
    return Promise.resolve(outcome);
  }

  readPage(request: MarketplaceReadRequest): Promise<MarketplaceReadOutcome> {
    const answer = this.answerPage(request);
    if (answer !== null) {
      return answer;
    }
    return this.maybeHold(this.pageOutcome(request));
  }

  joinQueue(request: MarketplaceQueueRequest): Promise<MarketplaceQueueOutcome> {
    const bad = this.commonCheck(request);
    if (bad) {
      return this.maybeHold(bad);
    }
    if (this.scenario === "queue-lapsed") {
      return this.maybeHold({ kind: "queued", queue: this.queueView(), ...this.offered() });
    }
    if (this.queue.state === "none" || this.queue.state === "expired") {
      this.joinSeq += 1;
      this.queue = {
        state: "waiting",
        queueRef: `mqu-${pad6(this.joinSeq)}`,
        position: this.scenario === "contended" ? 2 : 1,
        admittedUntil: null,
        expired: false,
      };
    }
    return this.maybeHold({ kind: "queued", queue: this.queueView(), ...this.offered() });
  }

  readQueue(request: MarketplaceQueueRequest): Promise<MarketplaceQueueOutcome> {
    const bad = this.commonCheck(request);
    if (bad) {
      return this.maybeHold(bad);
    }
    if (this.queue.state === "waiting" && this.queue.position !== null) {
      if (this.queue.position > 1) {
        this.queue = { ...this.queue, position: this.queue.position - 1 };
      } else {
        this.queue = {
          ...this.queue,
          state: "admitted",
          position: null,
          admittedUntil: plusHours(MARKETPLACE_AS_OF, 1),
        };
      }
    }
    return this.maybeHold({ kind: "queue-state", queue: this.queueView(), ...this.offered() });
  }

  synthetic(control: MarketplaceSyntheticControl): boolean {
    switch (control) {
      case "deliver-held": {
        if (this.held.length === 0) {
          return false;
        }
        // Newest first: a congested link can deliver answers out of order.
        const held = this.held.splice(0, this.held.length);
        for (const release of held.reverse()) {
          release();
        }
        return true;
      }
      case "expire-queue": {
        if (this.queue.state !== "waiting" && this.queue.state !== "admitted") {
          return false;
        }
        this.queue = { ...this.queue, state: "expired", position: null, expired: true };
        return true;
      }
      case "revoke-permission": {
        if (this.permissionRevoked) {
          return false;
        }
        this.permissionRevoked = true;
        return true;
      }
      case "restore-permission": {
        if (!this.permissionRevoked) {
          return false;
        }
        this.permissionRevoked = false;
        return true;
      }
      case "move-terms": {
        this.termsMoves += 1;
        this.currentTerms = `trm-${pad2(this.termsMoves + 1)}`;
        return true;
      }
      default: {
        const exhaustive: never = control;
        return exhaustive;
      }
    }
  }

  /** Checks shared by every call. Denial and shape faults come before any row. */
  private commonCheck(request: MarketplaceQueueRequest): MarketplaceReadOutcome & MarketplaceQueueOutcome | null {
    const tuple = this.tupleCheck();
    if (tuple) {
      return tuple as MarketplaceReadOutcome & MarketplaceQueueOutcome;
    }
    if (!isRecord(request)) {
      return { kind: "invalid-request", code: "BOUND", detail: "The request is not an object.", ...this.offered() };
    }
    const scope = validateScope(request.scope);
    if (scope) {
      return scope;
    }
    if (this.permissionRevoked) {
      return this.denied();
    }
    const workloadCheck = validateWorkload(request.workload, request.deviceClass);
    if (workloadCheck) {
      return workloadCheck;
    }
    return null;
  }

  /** Early exits for readPage that resolve before the page outcome is built. */
  private answerPage(request: MarketplaceReadRequest): Promise<MarketplaceReadOutcome> | null {
    const bad = this.commonCheck(request);
    if (bad) {
      return Promise.resolve(bad);
    }
    if (!isRecord(request.filter)) {
      return Promise.resolve({
        kind: "invalid-request",
        code: "FILTER",
        detail: "The filter is not an object.",
        ...this.offered(),
      });
    }
    if (typeof request.filter.text !== "string" || request.filter.text.length > MARKETPLACE_TEXT_BOUND) {
      return Promise.resolve({
        kind: "invalid-request",
        code: "FILTER",
        detail: `Filter text must be a string of at most ${MARKETPLACE_TEXT_BOUND} characters.`,
        ...this.offered(),
      });
    }
    if (
      !Number.isSafeInteger(request.pageSize) ||
      request.pageSize < 1 ||
      request.pageSize > MARKETPLACE_PAGE_BOUND
    ) {
      return Promise.resolve({
        kind: "invalid-request",
        code: "PAGE_SIZE",
        detail: `pageSize must be an integer from 1 to ${MARKETPLACE_PAGE_BOUND}.`,
        ...this.offered(),
      });
    }
    if (request.watermarkFloor !== null && !isInstant(request.watermarkFloor)) {
      return Promise.resolve({
        kind: "invalid-request",
        code: "BOUND",
        detail: "watermarkFloor is not an instant.",
        ...this.offered(),
      });
    }
    if (request.termsRef !== null && typeof request.termsRef !== "string") {
      return Promise.resolve({
        kind: "invalid-request",
        code: "BOUND",
        detail: "termsRef is a copied string or null.",
        ...this.offered(),
      });
    }
    if (request.cursor !== null && !isRecord(request.cursor)) {
      return Promise.resolve({
        kind: "cursor-invalid",
        code: "SHAPE",
        detail: "The cursor is not an object.",
        ...this.offered(),
      });
    }
    return null;
  }

  private pageOutcome(request: MarketplaceReadRequest): MarketplaceReadOutcome {
    // The contended page is queue-gated. An expired admission answers
    // queue-expired, a missing or waiting one queue-blocked. Other workloads
    // are not behind the queue.
    if (request.workload === "hot-page") {
      if (this.queue.state === "expired") {
        return { kind: "queue-expired", queue: this.queueView(), ...this.offered() };
      }
      if (this.queue.state !== "admitted") {
        return { kind: "queue-blocked", queue: this.queueView(), ...this.offered() };
      }
    }
    // The terms-moved scenario moves the terms under every read, so a page
    // holding the previous terms is rejected rather than confirmed.
    if (this.scenario === "terms-moved") {
      this.termsMoves += 1;
      this.currentTerms = `trm-${pad2(this.termsMoves + 1)}`;
    }
    const heldTerms = request.termsRef;
    if (heldTerms !== null && heldTerms !== this.termsNow()) {
      return { kind: "terms-moved", held: heldTerms, current: this.termsNow(), ...this.offered() };
    }
    const cursorCheck = this.checkCursor(request.cursor, request);
    if (cursorCheck) {
      return cursorCheck;
    }
    const afterSequence = request.cursor === null ? 0 : request.cursor.afterSequence;
    const end = Math.min(this.size, afterSequence + request.pageSize);
    const delivered: MarketplaceListingRow[] = [];
    for (let index = afterSequence; index < end; index += 1) {
      delivered.push(this.rowAt(index));
    }
    if (delivered.length > request.pageSize) {
      return {
        kind: "gap",
        code: "OVER_BOUND",
        detail: `The stream delivered ${delivered.length} rows for page size ${request.pageSize}.`,
        ...this.offered(),
      };
    }
    let expectedSequence = afterSequence + 1;
    let pageWatermark: string | null = null;
    const pageRefs = new Set<string>();
    const newRefs: string[] = [];
    for (const row of delivered) {
      if (!Number.isSafeInteger(row.sequence) || row.sequence !== expectedSequence) {
        const code: MarketplaceGapCode =
          Number.isSafeInteger(row.sequence) && row.sequence > expectedSequence ? "SEQUENCE" : "ORDER";
        return {
          kind: "gap",
          code,
          detail: `Expected sequence ${expectedSequence} and received ${row.sequence} (${row.listingRef}).`,
          ...this.offered(),
        };
      }
      expectedSequence += 1;
      if (pageRefs.has(row.listingRef) || this.seenListingRefs.has(row.listingRef)) {
        return {
          kind: "gap",
          code: "DUPLICATE",
          detail: `Row ${row.listingRef} was delivered twice in this session.`,
          ...this.offered(),
        };
      }
      pageRefs.add(row.listingRef);
      newRefs.push(row.listingRef);
      pageWatermark = minInstant(pageWatermark, row.watermark);
    }
    const floor = staleFloor(request.watermarkFloor);
    const watermark = this.scenario === "stale" ? staleWatermark() : pageWatermark;
    if (watermark !== null && Date.parse(watermark) < Date.parse(floor)) {
      return { kind: "stale", watermark, floor, ...this.offered() };
    }
    for (const ref of newRefs) {
      this.seenListingRefs.add(ref);
    }
    const claims = this.claimsFault(delivered);
    if (claims) {
      return claims;
    }
    const matched = delivered.filter((row) => matchesFilter(request.filter, row));
    const scannedThrough = afterSequence + delivered.length;
    const endOfStream = end >= this.size;
    if (matched.length === 0 && delivered.length === 0 && endOfStream) {
      return {
        kind: "empty",
        watermark: watermark ?? MARKETPLACE_AS_OF,
        totalEstimate: this.size,
        revision: this.revision,
        ...this.offered(),
      };
    }
    const nextCursor: MarketplaceReadCursor | null = endOfStream
      ? null
      : {
          cursorVersion: MARKETPLACE_CURSOR_VERSION,
          projectionName: MARKETPLACE_PROJECTION_NAME,
          projectionRevision: this.revision,
          tenantId: request.scope.tenantId,
          filterKey: marketplaceFilterKey(request.filter),
          termsRef: this.termsNow(),
          afterSequence: scannedThrough,
          watermark: watermark ?? "",
        };
    return {
      kind: "ready",
      rows: matched,
      nextCursor,
      watermark: watermark ?? MARKETPLACE_AS_OF,
      scannedCount: delivered.length,
      totalEstimate: this.size,
      revision: this.revision,
      termsRef: this.termsNow(),
      queue: this.queueView(),
      realDeviceEvidence: false,
      producerLoadMeasurement: false,
      ...this.offered(),
    };
  }

  /** Payloads that claim what a bench row or page may never claim are refused whole. */
  private claimsFault(delivered: readonly MarketplaceListingRow[]): MarketplaceReadOutcome | null {
    if (this.scenario === "claims-price" && delivered.length > 0) {
      return {
        kind: "refused",
        code: "PRICE_CLAIM",
        detail: "A read payload claimed a row confirms a price. The whole page is refused; nothing confirms a price here.",
        ...this.offered(),
      };
    }
    if (this.scenario === "claims-device") {
      return {
        kind: "refused",
        code: "DEVICE_CLAIM",
        detail: "A read payload claimed real-device evidence. The whole page is refused; emulation is never real-device evidence.",
        ...this.offered(),
      };
    }
    return null;
  }

  private checkCursor(
    cursor: MarketplaceReadCursor | null,
    request: MarketplaceReadRequest,
  ): MarketplaceReadOutcome | null {
    if (cursor === null) {
      return null;
    }
    if (cursor.cursorVersion !== MARKETPLACE_CURSOR_VERSION) {
      return {
        kind: "cursor-invalid",
        code: "VERSION",
        detail: "The cursor version is not supported.",
        ...this.offered(),
      };
    }
    if (cursor.projectionName !== MARKETPLACE_PROJECTION_NAME) {
      return {
        kind: "cursor-invalid",
        code: "SHAPE",
        detail: "The cursor names a different projection.",
        ...this.offered(),
      };
    }
    if (cursor.projectionRevision !== this.revision) {
      return {
        kind: "cursor-invalid",
        code: "REBUILT",
        detail: `The projection was rebuilt. Cursor names ${cursor.projectionRevision} and the stream serves ${this.revision}.`,
        ...this.offered(),
      };
    }
    if (cursor.tenantId !== request.scope.tenantId) {
      return {
        kind: "cursor-invalid",
        code: "TENANT",
        detail: "The cursor belongs to another tenant.",
        ...this.offered(),
      };
    }
    if (cursor.termsRef !== this.termsNow()) {
      return {
        kind: "cursor-invalid",
        code: "TERMS",
        detail: "The cursor was issued under terms the source has moved.",
        ...this.offered(),
      };
    }
    if (cursor.filterKey !== marketplaceFilterKey(request.filter)) {
      return {
        kind: "cursor-invalid",
        code: "FILTER",
        detail: "The filter changed after the cursor was issued.",
        ...this.offered(),
      };
    }
    if (!Number.isSafeInteger(cursor.afterSequence) || cursor.afterSequence < 0) {
      return {
        kind: "cursor-invalid",
        code: "SHAPE",
        detail: "The cursor position is not a sequence.",
        ...this.offered(),
      };
    }
    if (cursor.afterSequence > this.size) {
      return {
        kind: "cursor-invalid",
        code: "SHAPE",
        detail: "The cursor is past the stream end.",
        ...this.offered(),
      };
    }
    if (typeof cursor.watermark !== "string" || !isInstant(cursor.watermark)) {
      return {
        kind: "cursor-invalid",
        code: "SHAPE",
        detail: "The cursor watermark is not an instant.",
        ...this.offered(),
      };
    }
    return null;
  }
}

function validateScope(
  scope: MarketplaceAccessScope,
): (MarketplaceReadOutcome & MarketplaceQueueOutcome) | null {
  if (!isRecord(scope)) {
    return {
      kind: "invalid-request",
      code: "SCOPE",
      detail: "The access scope is not an object.",
      offeredMs: 0,
    };
  }
  if (scope.tenantId === MARKETPLACE_FOREIGN_TENANT) {
    return {
      kind: "denied",
      code: "FOREIGN_TENANT",
      detail: `Tenant ${MARKETPLACE_FOREIGN_TENANT} is foreign to this desk. The read is denied, never empty.`,
      offeredMs: 0,
    };
  }
  if (scope.tenantId !== MARKETPLACE_TENANT) {
    return {
      kind: "invalid-request",
      code: "SCOPE",
      detail: `This read serves ${MARKETPLACE_TENANT} only.`,
      offeredMs: 0,
    };
  }
  if (
    typeof scope.subject !== "string" ||
    scope.subject.length === 0 ||
    scope.subject.length > 100 ||
    scope.subject !== scope.subject.trim()
  ) {
    return {
      kind: "invalid-request",
      code: "SCOPE",
      detail: "The subject is not a non-empty trimmed string.",
      offeredMs: 0,
    };
  }
  return null;
}

function validateWorkload(
  workload: MarketplaceWorkload,
  deviceClass: MarketplaceDeviceClass,
): (MarketplaceReadOutcome & MarketplaceQueueOutcome) | null {
  if (!(MARKETPLACE_WORKLOADS as readonly string[]).includes(workload)) {
    return {
      kind: "invalid-request",
      code: "WORKLOAD",
      detail: "The workload is outside the declared enum.",
      offeredMs: 0,
    };
  }
  if (
    typeof deviceClass !== "string" ||
    !MARKETPLACE_DEVICE_PROFILES.some((profile) => profile.deviceClass === deviceClass)
  ) {
    return {
      kind: "invalid-request",
      code: "DEVICE",
      detail: "The device class is outside the declared enum. Unverified devices are never reported as measured.",
      offeredMs: 0,
    };
  }
  return null;
}

function matchesFilter(filter: MarketplaceFilter, row: MarketplaceListingRow): boolean {
  const needle = filter.text.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  const hay = `${row.eventLabel} ${row.venueLabel} ${row.listingRef} ${row.tier}`.toLowerCase();
  return hay.includes(needle);
}

function staleFloor(requestFloor: string | null): string {
  const staleBound = new Date(Date.parse(MARKETPLACE_AS_OF) - MARKETPLACE_STALE_AFTER_MS).toISOString();
  if (requestFloor !== null && isInstant(requestFloor) && Date.parse(requestFloor) > Date.parse(staleBound)) {
    return requestFloor;
  }
  return staleBound;
}

function staleWatermark(): string {
  return new Date(Date.parse(MARKETPLACE_AS_OF) - 2 * MARKETPLACE_STALE_AFTER_MS).toISOString();
}

function isInstant(value: string): boolean {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function minInstant(left: string | null, right: string): string {
  if (left === null) {
    return right;
  }
  return Date.parse(right) < Date.parse(left) ? right : left;
}

function plusHours(base: string, hours: number): string {
  return new Date(Date.parse(base) + hours * 3_600_000).toISOString();
}

function pad6(value: number): string {
  return String(value).padStart(6, "0");
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

const STREAM_VENUES = ["Scale hall", "North hall", "Annex stage", "Field house"] as const;
