import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import {
  MARKETPLACE_DESK_SCOPE,
  MARKETPLACE_DEVICE_PROFILES,
  MARKETPLACE_PAGE_BOUND,
  MARKETPLACE_TEXT_BOUND,
  MARKETPLACE_UNVERIFIED_DEVICES,
  type MarketplaceAccessScope,
  type MarketplaceBenchPort,
  type MarketplaceDeviceClass,
  type MarketplaceFilter,
  type MarketplaceListingRow,
  type MarketplaceQueueOutcome,
  type MarketplaceQueueView,
  type MarketplaceReadCursor,
  type MarketplaceReadOutcome,
  type MarketplaceUnverifiedDevice,
  type MarketplaceWorkload,
} from "./marketplace-performance.js";

/**
 * Client side of the marketplace scale bench: the context key, the read
 * reducers, the cancellation and drop rules, the queue call serialisation, the
 * memory denominator, and the measurement ledger. It decides what the screen
 * may show next. It decides nothing about access: every row it holds is the
 * source's, and hiding a control never stands in for the port's own check.
 *
 * Rules, all tested:
 *  - A context names a tenant, an actor, a device class, and a session
 *    incarnation. A permission change at the source, a second tab, or a device
 *    profile switch is a different context: a late answer for the old context
 *    is dropped and counted, never applied.
 *  - A read is one port call. Newer reads win: an answer for an older read is
 *    dropped. A cancelled read is not sent again, and its answer — when it
 *    lands at all — is counted cancelled, never applied. A lost answer leaves
 *    the read unknown; nothing here resends it.
 *  - A queue join and a queue read are each one port call, one at a time.
 *    Queue admission is browse access to the contended page, never a hold, a
 *    payment, a right, or entry. An expired admission grants nothing.
 *  - The window is the whole state. The controller keeps only the last ready
 *    page — at most MARKETPLACE_PAGE_BOUND rows — and reports that held count
 *    against the source's total estimate. That is the fixed memory
 *    denominator: the bound is the page size, not the stream length.
 *  - Every settled call is measured once at the client boundary under its own
 *    workload and device labels. The source's declared latency (`offeredMs`)
 *    is a separate figure. No row in the report is a producer load test, and
 *    no desktop measurement is real-device evidence.
 *  - A read that stops being ready — stale, moved terms, a blocked or expired
 *    queue, a denial, a refusal, an invalid or unknown answer — clears the
 *    rows. A fast screen never confirms a stale price or a stale right.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const MARKETPLACE_FRESHNESS = ["CURRENT", "STALE", "UNAVAILABLE"] as const;

export type MarketplaceFreshness = (typeof MARKETPLACE_FRESHNESS)[number];

export type MarketplaceReadState =
  | "none"
  | "ready"
  | "empty"
  | "stale"
  | "terms-moved"
  | "queue-blocked"
  | "queue-expired"
  | "denied"
  | "refused"
  | "gap"
  | "cursor-invalid"
  | "invalid"
  | "tuple-changed"
  | "not-bound"
  | "unavailable";

export type MarketplaceQueuePhase =
  | "none"
  | "waiting"
  | "admitted"
  | "expired"
  | "denied"
  | "invalid"
  | "tuple-changed"
  | "not-bound"
  | "unavailable";

export type MarketplaceCallKind = "read" | "joinQueue" | "readQueue";

export interface MarketplaceContext {
  environment: "stub" | "integration-http";
  domain: string;
  /** A context label. It is not an authentication result. */
  actorRef: string;
  scope: MarketplaceAccessScope;
  deviceClass: MarketplaceDeviceClass;
  /** Session incarnation. Bumped on every context switch, including a second tab. */
  incarnation: number;
  key: string;
}

/** One settled port call measured at the client boundary. */
export interface MarketplaceSample {
  seq: number;
  call: MarketplaceCallKind;
  workload: MarketplaceWorkload;
  deviceClass: MarketplaceDeviceClass;
  /** Declared device evidence class. An emulation profile is never real-device evidence. */
  realDevice: boolean;
  /** The outcome kind, or `dropped` / `cancelled` for answers that were never applied. */
  outcome: string;
  /** Milliseconds measured at the client boundary by the injected clock. */
  measuredMs: number;
  /** Milliseconds the synthetic source declared for the call, when it answered. */
  offeredMs: number | null;
  denominator: "browser-boundary";
}

/** The report's denominator never mixes producer load figures with browser measurements. */
export interface MarketplaceReportRow {
  deviceClass: MarketplaceDeviceClass;
  deviceNote: string;
  realDevice: boolean;
  workload: MarketplaceWorkload;
  calls: number;
  ready: number;
  empty: number;
  stale: number;
  denied: number;
  refused: number;
  unknown: number;
  notBound: number;
  dropped: number;
  cancelled: number;
  other: number;
  lastMeasuredMs: number | null;
  maxMeasuredMs: number | null;
  maxOfferedMs: number | null;
  denominator: "browser-boundary-measurement";
  producerLoadShare: "none";
  realDeviceEvidence: false;
}

export interface MarketplaceUnverifiedRow {
  device: MarketplaceUnverifiedDevice;
  state: "unverified";
  calls: 0;
  note: string;
}

export interface MarketplaceSnapshot {
  rows: readonly MarketplaceListingRow[];
  watermark: string;
  revision: string;
  termsRef: string;
  totalEstimate: number;
  scannedCount: number;
  filter: MarketplaceFilter;
  nextCursor: MarketplaceReadCursor | null;
}

/** The fixed memory denominator: rows held against the source's own estimate. */
export interface MarketplaceMemory {
  heldRows: number;
  totalEstimate: number;
  pageBound: number;
}

export interface MarketplaceCounters {
  reads: number;
  queueCalls: number;
  cancelledReads: number;
  droppedContext: number;
  droppedOlder: number;
  denied: number;
  refused: number;
  unknowns: number;
  notSent: number;
}

export interface MarketplaceInFlight {
  call: MarketplaceCallKind;
  seq: number;
  workload: MarketplaceWorkload;
  deviceClass: MarketplaceDeviceClass;
}

export type MarketplaceLastResult =
  | { seq: number; call: MarketplaceCallKind; kind: "applied"; outcomeKind: string }
  | { seq: number; call: MarketplaceCallKind; kind: "dropped"; cause: string }
  | { seq: number; call: MarketplaceCallKind; kind: "cancelled" }
  | { seq: number; call: MarketplaceCallKind; kind: "not-sent"; reason: string };

export interface MarketplaceControllerState {
  context: MarketplaceContext;
  readState: MarketplaceReadState;
  readCode: string | null;
  readDetail: string | null;
  snapshot: MarketplaceSnapshot | null;
  freshness: MarketplaceFreshness;
  queue: MarketplaceQueueView | null;
  queuePhase: MarketplaceQueuePhase;
  queueDetail: string | null;
  inFlight: readonly MarketplaceInFlight[];
  memory: MarketplaceMemory;
  measurements: readonly MarketplaceSample[];
  counters: MarketplaceCounters;
  last: MarketplaceLastResult | null;
}

export type MarketplaceReadResult =
  | { kind: "APPLIED"; readState: MarketplaceReadState }
  | { kind: "DROPPED"; cause: "context-changed" | "older-read" }
  | { kind: "CANCELLED" }
  | { kind: "NOT_SENT"; reason: "no-cursor" | "invalid"; detail: string };

export type MarketplaceNotSentReason = "in-flight" | "invalid";

export type MarketplaceQueueResult =
  | { kind: "APPLIED"; phase: MarketplaceQueuePhase }
  | { kind: "DROPPED"; cause: "context-changed" }
  | { kind: "NOT_SENT"; reason: MarketplaceNotSentReason; detail: string };

function contextKeyOf(parts: {
  environment: string;
  domain: string;
  actorRef: string;
  tenantId: string;
  subject: string;
  deviceClass: string;
  incarnation: number;
}): string {
  return [
    parts.environment,
    parts.domain,
    parts.actorRef,
    parts.tenantId,
    parts.subject,
    parts.deviceClass,
    String(parts.incarnation),
  ].join("|");
}

function failureText(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : "The call failed.";
}

function deviceReal(deviceClass: MarketplaceDeviceClass): boolean {
  return MARKETPLACE_DEVICE_PROFILES.some((profile) => profile.deviceClass === deviceClass && profile.realDevice);
}

export class MarketplaceBenchController {
  private context: MarketplaceContext;
  private snapshot: MarketplaceSnapshot | null = null;
  private readState: MarketplaceReadState = "none";
  private readCode: string | null = null;
  private readDetail: string | null = null;
  private queue: MarketplaceQueueView | null = null;
  private queuePhase: MarketplaceQueuePhase = "none";
  private queueDetail: string | null = null;
  private floor: string | null = null;
  private heldTerms: string | null = null;
  private workload: MarketplaceWorkload;
  private readSeq = 0;
  private appliedReadSeq = 0;
  private readonly pendingReads = new Map<number, MarketplaceInFlight>();
  private readonly cancelledReads = new Set<number>();
  private queueSeq = 0;
  private queueInFlight: MarketplaceInFlight | null = null;
  private readonly samples: MarketplaceSample[] = [];
  private last: MarketplaceLastResult | null = null;
  private readonly counters: MarketplaceCounters = {
    reads: 0,
    queueCalls: 0,
    cancelledReads: 0,
    droppedContext: 0,
    droppedOlder: 0,
    denied: 0,
    refused: 0,
    unknowns: 0,
    notSent: 0,
  };
  private readonly listeners = new Set<() => void>();
  private readonly now: () => number;

  constructor(
    private readonly port: MarketplaceBenchPort,
    options: {
      actorRef?: string;
      tenantId?: string;
      subject?: string;
      incarnation?: number;
      deviceClass?: MarketplaceDeviceClass;
      workload?: MarketplaceWorkload;
      now?: () => number;
    } = {},
  ) {
    this.workload = options.workload ?? "browse-window";
    this.now = options.now ?? (() => Date.now());
    const parts = {
      environment: port.environment,
      domain: PINNED_PROTOCOL_DOMAIN,
      actorRef: options.actorRef ?? "marketplace-bench",
      scope: {
        tenantId: options.tenantId ?? MARKETPLACE_DESK_SCOPE.tenantId,
        subject: options.subject ?? MARKETPLACE_DESK_SCOPE.subject,
      },
      deviceClass: options.deviceClass ?? "desktop-browser",
      incarnation: options.incarnation ?? 1,
    };
    this.context = {
      environment: parts.environment,
      domain: parts.domain,
      actorRef: parts.actorRef,
      scope: parts.scope,
      deviceClass: parts.deviceClass,
      incarnation: parts.incarnation,
      key: contextKeyOf({
        environment: parts.environment,
        domain: parts.domain,
        actorRef: parts.actorRef,
        tenantId: parts.scope.tenantId,
        subject: parts.scope.subject,
        deviceClass: parts.deviceClass,
        incarnation: parts.incarnation,
      }),
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      listener();
    }
  }

  state(): MarketplaceControllerState {
    let freshness: MarketplaceFreshness = "UNAVAILABLE";
    if (this.readState === "ready" || this.readState === "empty") {
      freshness = "CURRENT";
    } else if (this.readState === "stale" || this.readState === "terms-moved" || this.readState === "cursor-invalid") {
      freshness = "STALE";
    }
    return {
      context: { ...this.context, scope: { ...this.context.scope } },
      readState: this.readState,
      readCode: this.readCode,
      readDetail: this.readDetail,
      snapshot: this.snapshot,
      freshness,
      queue: this.queue === null ? null : { ...this.queue },
      queuePhase: this.queuePhase,
      queueDetail: this.queueDetail,
      inFlight: [...this.pendingReads.values(), ...(this.queueInFlight === null ? [] : [this.queueInFlight])],
      memory: {
        heldRows: this.snapshot?.rows.length ?? 0,
        totalEstimate: this.snapshot?.totalEstimate ?? 0,
        pageBound: MARKETPLACE_PAGE_BOUND,
      },
      measurements: [...this.samples],
      counters: { ...this.counters },
      last: this.last,
    };
  }

  /** The workload label the next calls carry. It is a report label, not a context. */
  setWorkload(workload: MarketplaceWorkload): void {
    this.workload = workload;
  }

  private clearView(): void {
    this.snapshot = null;
    this.heldTerms = null;
  }

  /**
   * One read. A newer read in the same context wins, and an older answer is
   * dropped. A cancelled read is never sent again and its answer is counted,
   * not applied. An answer for an earlier context — a second tab, a device
   * switch, a permission change — is dropped.
   */
  async read(filter: MarketplaceFilter | null = null, cursor: MarketplaceReadCursor | null = null): Promise<MarketplaceReadResult> {
    if (filter !== null && (typeof filter.text !== "string" || filter.text.length > MARKETPLACE_TEXT_BOUND)) {
      this.counters.notSent += 1;
      return { kind: "NOT_SENT", reason: "invalid", detail: `Filter text is a string of at most ${MARKETPLACE_TEXT_BOUND} characters.` };
    }
    const key = this.context.key;
    this.readSeq += 1;
    const seq = this.readSeq;
    const flight: MarketplaceInFlight = { call: "read", seq, workload: this.workload, deviceClass: this.context.deviceClass };
    this.pendingReads.set(seq, flight);
    this.counters.reads += 1;
    const callFilter = filter ?? this.snapshot?.filter ?? { text: "" };
    const started = this.now();
    let outcome: MarketplaceReadOutcome;
    try {
      outcome = await this.port.readPage({
        contextKey: key,
        scope: { ...this.context.scope },
        filter: callFilter,
        pageSize: MARKETPLACE_PAGE_BOUND,
        cursor,
        watermarkFloor: this.floor,
        termsRef: this.heldTerms,
        workload: flight.workload,
        deviceClass: flight.deviceClass,
      });
    } catch (error) {
      outcome = { kind: "unknown", message: failureText(error), offeredMs: 0 };
    }
    this.pendingReads.delete(seq);
    if (this.cancelledReads.delete(seq)) {
      this.counters.cancelledReads += 1;
      this.recordSample(flight, "cancelled", started, outcome.offeredMs);
      this.last = { seq, call: "read", kind: "cancelled" };
      this.notify();
      return { kind: "CANCELLED" };
    }
    if (key !== this.context.key) {
      this.counters.droppedContext += 1;
      this.recordSample(flight, "dropped", started, outcome.offeredMs);
      this.last = { seq, call: "read", kind: "dropped", cause: "context-changed" };
      this.notify();
      return { kind: "DROPPED", cause: "context-changed" };
    }
    if (seq < this.appliedReadSeq) {
      this.counters.droppedOlder += 1;
      this.recordSample(flight, "dropped", started, outcome.offeredMs);
      this.last = { seq, call: "read", kind: "dropped", cause: "older-read" };
      this.notify();
      return { kind: "DROPPED", cause: "older-read" };
    }
    this.appliedReadSeq = seq;
    this.recordSample(flight, outcome.kind, started, outcome.offeredMs);
    this.apply(outcome, callFilter);
    this.last = { seq, call: "read", kind: "applied", outcomeKind: outcome.kind };
    this.notify();
    return { kind: "APPLIED", readState: this.readState };
  }

  /** A fresh read of the current filter. It is a new call, not a retry of a lost one. */
  refresh(): Promise<MarketplaceReadResult> {
    return this.read(this.snapshot?.filter ?? { text: "" }, null);
  }

  /** One read at the next cursor of the last ready page. No cursor, no call. */
  nextPage(): Promise<MarketplaceReadResult> {
    const cursor = this.snapshot?.nextCursor ?? null;
    if (cursor === null) {
      this.counters.notSent += 1;
      this.notify();
      return Promise.resolve({
        kind: "NOT_SENT",
        reason: "no-cursor",
        detail: "The last read reported no next cursor. Nothing is paged past it.",
      });
    }
    return this.read(this.snapshot?.filter ?? { text: "" }, cursor);
  }

  /** One read under a new filter. The transition is a new call, and an older answer stays dropped. */
  search(text: string): Promise<MarketplaceReadResult> {
    return this.read({ text }, null);
  }

  /**
   * Cancels every read still in flight. Cancelled answers are counted and
   * never applied, and nothing is sent again in their place.
   */
  cancelReads(): number {
    const pending = [...this.pendingReads.keys()];
    for (const seq of pending) {
      this.cancelledReads.add(seq);
    }
    if (pending.length > 0) {
      this.notify();
    }
    return pending.length;
  }

  /** One queue join. One queue call is in flight at a time. */
  async joinQueue(): Promise<MarketplaceQueueResult> {
    return this.queueCall("joinQueue");
  }

  /** One explicit queue read. Nothing polls; each call is the person's own. */
  async refreshQueue(): Promise<MarketplaceQueueResult> {
    return this.queueCall("readQueue");
  }

  private async queueCall(call: "joinQueue" | "readQueue"): Promise<MarketplaceQueueResult> {
    if (this.queueInFlight !== null) {
      this.counters.notSent += 1;
      this.notify();
      return {
        kind: "NOT_SENT",
        reason: "in-flight",
        detail: "One queue call is already in flight. It is sent once and not duplicated.",
      };
    }
    const key = this.context.key;
    this.queueSeq += 1;
    const seq = this.queueSeq;
    const flight: MarketplaceInFlight = { call, seq, workload: this.workload, deviceClass: this.context.deviceClass };
    this.queueInFlight = flight;
    this.counters.queueCalls += 1;
    const started = this.now();
    const request = {
      contextKey: key,
      scope: { ...this.context.scope },
      workload: flight.workload,
      deviceClass: flight.deviceClass,
    };
    let outcome: MarketplaceQueueOutcome;
    try {
      outcome = call === "joinQueue" ? await this.port.joinQueue(request) : await this.port.readQueue(request);
    } catch (error) {
      outcome = { kind: "unknown", message: failureText(error), offeredMs: 0 };
    }
    this.queueInFlight = null;
    if (key !== this.context.key) {
      this.counters.droppedContext += 1;
      this.recordSample(flight, "dropped", started, outcome.offeredMs);
      this.last = { seq, call, kind: "dropped", cause: "context-changed" };
      this.notify();
      return { kind: "DROPPED", cause: "context-changed" };
    }
    this.recordSample(flight, outcome.kind, started, outcome.offeredMs);
    this.applyQueue(outcome);
    this.last = { seq, call, kind: "applied", outcomeKind: outcome.kind };
    this.notify();
    return { kind: "APPLIED", phase: this.queuePhase };
  }

  /**
   * A new context for a different actor, a different device profile, or a
   * second tab of the same desk. Rows, held terms, and the queue view are
   * cleared, and an answer still in flight for the earlier context is dropped
   * when it lands.
   */
  private switchParts(next: {
    actorRef?: string;
    deviceClass?: MarketplaceDeviceClass;
    incarnation?: number;
  }): MarketplaceContext {
    const parts = {
      environment: this.context.environment,
      domain: this.context.domain,
      actorRef: next.actorRef ?? this.context.actorRef,
      scope: { ...this.context.scope },
      deviceClass: next.deviceClass ?? this.context.deviceClass,
      incarnation: next.incarnation ?? this.context.incarnation + 1,
    };
    this.context = {
      environment: parts.environment,
      domain: parts.domain,
      actorRef: parts.actorRef,
      scope: parts.scope,
      deviceClass: parts.deviceClass,
      incarnation: parts.incarnation,
      key: contextKeyOf({
        environment: parts.environment,
        domain: parts.domain,
        actorRef: parts.actorRef,
        tenantId: parts.scope.tenantId,
        subject: parts.scope.subject,
        deviceClass: parts.deviceClass,
        incarnation: parts.incarnation,
      }),
    };
    this.clearView();
    this.readState = "none";
    this.readCode = null;
    this.readDetail = null;
    this.queue = null;
    this.queuePhase = "none";
    this.queueDetail = null;
    this.floor = null;
    this.queueInFlight = null;
    this.notify();
    return { ...this.context, scope: { ...this.context.scope } };
  }

  /** A different actor is a different context: the source decides the permission again. */
  switchActor(actorRef: string): MarketplaceContext {
    return this.switchParts({ actorRef });
  }

  /** A device profile switch is a new context. An emulated profile stays emulation. */
  switchDevice(deviceClass: MarketplaceDeviceClass): MarketplaceContext {
    return this.switchParts({ deviceClass });
  }

  /** The same actor opening a second tab is a new session incarnation. */
  duplicateTab(): MarketplaceContext {
    return this.switchParts({ incarnation: this.context.incarnation + 1 });
  }

  private apply(outcome: MarketplaceReadOutcome, callFilter: MarketplaceFilter): void {
    this.readCode = null;
    this.readDetail = null;
    if (outcome.kind === "ready") {
      this.snapshot = {
        rows: outcome.rows,
        watermark: outcome.watermark,
        revision: outcome.revision,
        termsRef: outcome.termsRef,
        totalEstimate: outcome.totalEstimate,
        scannedCount: outcome.scannedCount,
        filter: callFilter,
        nextCursor: outcome.nextCursor,
      };
      this.readState = "ready";
      this.floor = outcome.watermark;
      this.heldTerms = outcome.termsRef;
      this.queue = outcome.queue;
      return;
    }
    // Anything but a ready read leaves no row on screen: a fast page never
    // confirms a stale price or a stale right.
    this.clearView();
    switch (outcome.kind) {
      case "empty":
        this.readState = "empty";
        this.floor = outcome.watermark;
        return;
      case "stale":
        this.readState = "stale";
        this.readDetail = `Watermark ${outcome.watermark} is older than the floor ${outcome.floor}.`;
        return;
      case "terms-moved":
        this.readState = "terms-moved";
        this.readDetail = `The listing terms moved from ${outcome.held} to ${outcome.current}. The held window is stale and clears; nothing under it is confirmed.`;
        return;
      case "queue-blocked":
        this.readState = "queue-blocked";
        this.queue = outcome.queue;
        this.readDetail = "The contended page is behind the queue. Queue admission is browse access only — never a hold, a payment, or a right.";
        return;
      case "queue-expired":
        this.readState = "queue-expired";
        this.queue = outcome.queue;
        this.readDetail = "The queue admission expired at the source. An expired admission grants nothing, and the page does not revive it.";
        return;
      case "denied":
        this.readState = "denied";
        this.readCode = outcome.code;
        this.readDetail = outcome.detail;
        this.counters.denied += 1;
        return;
      case "refused":
        this.readState = "refused";
        this.readCode = outcome.code;
        this.readDetail = outcome.detail;
        this.counters.refused += 1;
        return;
      case "gap":
        this.readState = "gap";
        this.readCode = outcome.code;
        this.readDetail = outcome.detail;
        return;
      case "cursor-invalid":
        this.readState = "cursor-invalid";
        this.readCode = outcome.code;
        this.readDetail = outcome.detail;
        return;
      case "invalid-request":
        this.readState = "invalid";
        this.readCode = outcome.code;
        this.readDetail = outcome.detail;
        return;
      case "tuple-changed":
        this.readState = "tuple-changed";
        this.readDetail = `The pin tuple field ${outcome.field} changed.`;
        return;
      case "not-bound":
        this.readState = "not-bound";
        this.readDetail = outcome.reason;
        return;
      case "unknown":
        this.readState = "unavailable";
        this.readDetail = outcome.message;
        this.counters.unknowns += 1;
        return;
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  }

  private applyQueue(outcome: MarketplaceQueueOutcome): void {
    this.queueDetail = null;
    switch (outcome.kind) {
      case "queued":
      case "queue-state":
        this.queue = outcome.queue;
        this.queuePhase = outcome.queue.state === "none" ? "none" : outcome.queue.state;
        this.queueDetail = outcome.queue.expired === true ? "The source reports this admission expired." : null;
        return;
      case "denied":
        this.queuePhase = "denied";
        this.queueDetail = outcome.detail;
        this.counters.denied += 1;
        return;
      case "invalid-request":
        this.queuePhase = "invalid";
        this.queueDetail = outcome.detail;
        return;
      case "tuple-changed":
        this.queuePhase = "tuple-changed";
        this.queueDetail = `The pin tuple field ${outcome.field} changed.`;
        return;
      case "not-bound":
        this.queuePhase = "not-bound";
        this.queueDetail = outcome.reason;
        return;
      case "unknown":
        this.queuePhase = "unavailable";
        this.queueDetail = outcome.message;
        this.counters.unknowns += 1;
        return;
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  }

  /** Every settled call lands in the ledger once, under its own labels. */
  private recordSample(
    flight: MarketplaceInFlight,
    outcome: string,
    started: number,
    offeredMs: number,
  ): void {
    const measuredMs = Math.max(0, Math.round(this.now() - started));
    this.samples.push({
      seq: flight.seq,
      call: flight.call,
      workload: flight.workload,
      deviceClass: flight.deviceClass,
      realDevice: deviceReal(flight.deviceClass),
      outcome,
      measuredMs,
      offeredMs: Number.isFinite(offeredMs) ? offeredMs : null,
      denominator: "browser-boundary",
    });
  }

  /**
   * The measurement report. Rows group by the declared device class and
   * workload. The denominator is the browser-boundary measurement only; a
   * producer load figure is never mixed in, and emulation is never reported
   * as a real device.
   */
  measurementReport(): { rows: MarketplaceReportRow[]; unverified: MarketplaceUnverifiedRow[] } {
    const groups = new Map<string, MarketplaceReportRow>();
    for (const sample of this.samples) {
      const key = `${sample.deviceClass}|${sample.workload}`;
      let row = groups.get(key);
      if (!row) {
        const profile = MARKETPLACE_DEVICE_PROFILES.find((item) => item.deviceClass === sample.deviceClass);
        row = {
          deviceClass: sample.deviceClass,
          deviceNote: profile?.note ?? "Undeclared device class.",
          realDevice: sample.realDevice,
          workload: sample.workload,
          calls: 0,
          ready: 0,
          empty: 0,
          stale: 0,
          denied: 0,
          refused: 0,
          unknown: 0,
          notBound: 0,
          dropped: 0,
          cancelled: 0,
          other: 0,
          lastMeasuredMs: null,
          maxMeasuredMs: null,
          maxOfferedMs: null,
          denominator: "browser-boundary-measurement",
          producerLoadShare: "none",
          realDeviceEvidence: false,
        };
        groups.set(key, row);
      }
      row.calls += 1;
      switch (sample.outcome) {
        case "ready":
          row.ready += 1;
          break;
        case "empty":
          row.empty += 1;
          break;
        case "stale":
        case "terms-moved":
        case "cursor-invalid":
          row.stale += 1;
          break;
        case "denied":
          row.denied += 1;
          break;
        case "refused":
          row.refused += 1;
          break;
        case "unknown":
          row.unknown += 1;
          break;
        case "not-bound":
          row.notBound += 1;
          break;
        case "cancelled":
          row.cancelled += 1;
          break;
        case "dropped":
          row.dropped += 1;
          break;
        default:
          row.other += 1;
      }
      row.lastMeasuredMs = sample.measuredMs;
      row.maxMeasuredMs = row.maxMeasuredMs === null ? sample.measuredMs : Math.max(row.maxMeasuredMs, sample.measuredMs);
      if (sample.offeredMs !== null) {
        row.maxOfferedMs = row.maxOfferedMs === null ? sample.offeredMs : Math.max(row.maxOfferedMs, sample.offeredMs);
      }
    }
    const unverified: MarketplaceUnverifiedRow[] = MARKETPLACE_UNVERIFIED_DEVICES.map((device) => ({
      device,
      state: "unverified",
      calls: 0,
      note: "No real device ran in this session. A desktop measurement is never reported against a real device class.",
    }));
    return { rows: [...groups.values()], unverified };
  }
}
