import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import {
  TENANT_CHECKER_CAPABILITY,
  TENANT_MAKER_CAPABILITY,
  TENANT_NOT_BOUND_REASON,
  TENANT_ORGANIZER_ACTOR,
  TENANT_OWN,
  assessTenantSnapshot,
  isTenantRef,
  judgeTenantExport,
  tenantApprovableProposals,
  tenantCapabilities,
  tenantEligibility,
  type TenantActionKind,
  type TenantActionRequest,
  type TenantActOutcome,
  type TenantAssessment,
  type TenantCapability,
  type TenantEligibility,
  type TenantExport,
  type TenantExportOutcome,
  type TenantExportVerdict,
  type TenantPermissionsPort,
  type TenantReadOutcome,
  type TenantReceipt,
  type TenantRole,
  type TenantScope,
  type TenantSnapshot,
} from "./tenant-permissions.js";

/**
 * Client side of the permissions desk: the context key, the read and export
 * reducers, the request fence, and the drop rules. It decides what the screen may
 * show next and which request it may send next. It decides nothing about access:
 * every row it holds is the source's, and hiding a control never stands in for
 * the port's own check.
 *
 * Rules, all tested:
 *  - A context names a tenant, an actor, and a role. A different tenant, a
 *    different actor, or a different role is a different context, a new session
 *    incarnation, and a cleared view. The same person's second role is a second
 *    context, so an old session's rows never mix with a new one.
 *  - A read, an export, and a request are each one port call. A failed or lost
 *    one is shown as unavailable or unknown and is not sent again by this class.
 *    The next call is the person's, and an unknown request outcome fences every
 *    later request.
 *  - A request body is built from the last ready read. Targets are copied from
 *    it and are never typed or minted here, and the request carries the
 *    assignment generation that read reported so the source can reject a write
 *    built under an old role.
 *  - A request is sent only when the read offers it, the role holds the
 *    capability it needs, the read is the latest the page holds, and no other
 *    request is in flight or unknown. A hidden control is not a check: the port
 *    decides every request that reaches it.
 *  - A deep-open is a read that names a resource ref. The ref is copied from a
 *    row or a URL, never guessed, and the source answers a ref outside the
 *    role's kinds or outside the tenant with denied, never a row.
 *  - A read or an export that arrives after the context changed, or after a
 *    newer one of its kind was applied, is dropped. Any read that is not ready,
 *    and any context change, clears the rows and the export.
 *  - An export is judged against the last read each time state() is called, so
 *    an export taken before the source moved on turns stale without a second
 *    call.
 *  - Nothing here sends a catalogue command or grants a real permission.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const TENANT_FRESHNESS = ["CURRENT", "STALE", "UNAVAILABLE"] as const;

export type TenantFreshness = (typeof TENANT_FRESHNESS)[number];

export type TenantReadState =
  | "none"
  | "ready"
  | "empty"
  | "stale"
  | "role-stale"
  | "denied"
  | "refused"
  | "invalid"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export type TenantExportPhase =
  | "none"
  | "loaded"
  | "denied"
  | "refused"
  | "invalid"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export type TenantActPhase =
  | "applied"
  | "rejected"
  | "denied"
  | "refused"
  | "invalid"
  | "tuple-changed"
  | "not-bound"
  | "unknown";

export interface TenantContext {
  environment: "stub" | "integration-http";
  domain: string;
  /** A context label. It is not an authentication result. */
  actorRef: string;
  /** The tenant and the role the actor acts under. */
  scope: TenantScope;
  /** Session incarnation. Bumped on every context switch. */
  incarnation: number;
  key: string;
}

export interface TenantCounters {
  reads: number;
  exports: number;
  acts: number;
  /** Exports and requests refused before the port. */
  notSent: number;
  droppedReads: number;
  droppedExports: number;
}

export interface TenantExportState {
  phase: TenantExportPhase;
  code: string | null;
  detail: string | null;
  value: TenantExport | null;
  /** Judged against the last read at the moment state() was called. */
  verdict: TenantExportVerdict | null;
}

/** The last request that reached the port, and how it came back. */
export interface TenantActRecord {
  seq: number;
  action: TenantActionRequest;
  phase: TenantActPhase;
  code: string | null;
  detail: string | null;
  receipt: TenantReceipt | null;
}

export type TenantFence =
  | { reason: "in-flight"; action: TenantActionKind }
  | { reason: "unknown-outcome"; seq: number; action: TenantActionKind };

export interface TenantControllerState {
  context: TenantContext;
  readState: TenantReadState;
  readCode: string | null;
  readDetail: string | null;
  snapshot: TenantSnapshot | null;
  assessment: TenantAssessment | null;
  freshness: TenantFreshness;
  export: TenantExportState;
  /** True after a request reached the source and no newer ready read has landed. */
  behind: boolean;
  fence: TenantFence | null;
  last: TenantActRecord | null;
  /** Unknown outcomes left in sessions this page no longer holds. They are not forgotten. */
  earlierUnknown: number;
  counters: TenantCounters;
}

export type TenantReadResult =
  | { kind: "APPLIED"; readState: TenantReadState }
  | { kind: "DROPPED"; cause: "context-changed" | "older-read" };

export type TenantExportResult =
  | { kind: "APPLIED"; phase: TenantExportPhase }
  | { kind: "DROPPED"; cause: "context-changed" | "older-export" | "read-not-ready" }
  | { kind: "NOT_SENT"; reason: "not-bound" | "no-snapshot" | "no-capability"; detail: string };

export type TenantNotSentReason =
  | "not-bound"
  | "no-snapshot"
  | "stale-read"
  | "blocked"
  | "no-capability"
  | "unknown-ref"
  | "bad-note";

export type TenantActResult =
  | { kind: "APPLIED"; record: TenantActRecord }
  | { kind: "REJECTED"; record: TenantActRecord }
  | { kind: "UNKNOWN"; record: TenantActRecord }
  | { kind: "FENCED"; fence: TenantFence }
  | { kind: "NOT_SENT"; reason: TenantNotSentReason; detail: string };

function contextKeyOf(parts: Pick<TenantContext, "environment" | "domain" | "actorRef" | "scope" | "incarnation">): string {
  return [parts.environment, parts.domain, parts.actorRef, parts.scope.tenantId, parts.scope.role, String(parts.incarnation)].join("|");
}

function failureText(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : "The call failed.";
}

/** The capability a request kind needs at the source. */
function capabilityFor(kind: TenantActionKind): TenantCapability {
  if (kind === "approve-proposal") {
    return TENANT_CHECKER_CAPABILITY;
  }
  return TENANT_MAKER_CAPABILITY[kind === "propose-account-change" ? "account-change" : "role-revoke"];
}

const NO_EXPORT: TenantExportState = { phase: "none", code: null, detail: null, value: null, verdict: null };

export class TenantPermissionsController {
  private context: TenantContext;
  private snapshot: TenantSnapshot | null = null;
  private assessment: TenantAssessment | null = null;
  private readState: TenantReadState = "none";
  private readCode: string | null = null;
  private readDetail: string | null = null;
  private floor: string | null = null;
  /** The assignment generation the last ready read reported, or null before one. */
  private roleGeneration: number | null = null;
  private readSeq = 0;
  private appliedReadSeq = 0;
  private exportSeq = 0;
  private appliedExportSeq = 0;
  private exportPhase: TenantExportPhase = "none";
  private exportCode: string | null = null;
  private exportDetail: string | null = null;
  private exportValue: TenantExport | null = null;
  private actSeq = 0;
  private behind = false;
  private inFlight: TenantActionKind | null = null;
  private fence: TenantFence | null = null;
  private last: TenantActRecord | null = null;
  private earlierUnknown = 0;
  private actsDone = 0;
  private readonly counters: TenantCounters = { reads: 0, exports: 0, acts: 0, notSent: 0, droppedReads: 0, droppedExports: 0 };
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly port: TenantPermissionsPort,
    options: { actorRef?: string; tenantId?: string; role?: TenantRole; incarnation?: number } = {},
  ) {
    const parts = {
      environment: port.environment,
      domain: PINNED_PROTOCOL_DOMAIN,
      actorRef: options.actorRef ?? TENANT_ORGANIZER_ACTOR,
      scope: { tenantId: options.tenantId ?? TENANT_OWN, role: options.role ?? "organizer" as TenantRole },
      incarnation: options.incarnation ?? 1,
    };
    this.context = { ...parts, key: contextKeyOf(parts) };
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

  state(): TenantControllerState {
    let freshness: TenantFreshness = "UNAVAILABLE";
    if (this.readState === "ready" || this.readState === "empty") {
      freshness = "CURRENT";
    } else if (this.readState === "stale" || this.readState === "role-stale") {
      freshness = "STALE";
    }
    const verdict = this.exportValue === null ? null : judgeTenantExport(this.snapshot, this.exportValue);
    return {
      context: { ...this.context, scope: { ...this.context.scope } },
      readState: this.readState,
      readCode: this.readCode,
      readDetail: this.readDetail,
      snapshot: this.snapshot,
      assessment: this.assessment,
      freshness,
      export:
        this.exportPhase === "none" && this.exportValue === null
          ? { ...NO_EXPORT }
          : { phase: this.exportPhase, code: this.exportCode, detail: this.exportDetail, value: this.exportValue, verdict },
      behind: this.behind,
      fence: this.currentFence(),
      last: this.last,
      earlierUnknown: this.earlierUnknown,
      counters: { ...this.counters },
    };
  }

  private currentFence(): TenantFence | null {
    if (this.inFlight !== null) {
      return { reason: "in-flight", action: this.inFlight };
    }
    return this.fence;
  }

  private clearView(): void {
    this.snapshot = null;
    this.assessment = null;
    this.clearExport();
  }

  private clearExport(): void {
    this.exportPhase = "none";
    this.exportCode = null;
    this.exportDetail = null;
    this.exportValue = null;
  }

  /** Starts a new context for a different tenant, actor, or role. */
  private switchParts(next: { actorRef?: string; tenantId?: string; role?: TenantRole }): TenantContext | null {
    if (this.inFlight !== null) {
      return null;
    }
    if (this.fence !== null) {
      this.earlierUnknown += 1;
    }
    const parts = {
      environment: this.context.environment,
      domain: this.context.domain,
      actorRef: next.actorRef ?? this.context.actorRef,
      scope: {
        tenantId: next.tenantId ?? this.context.scope.tenantId,
        role: next.role ?? this.context.scope.role,
      },
      incarnation: this.context.incarnation + 1,
    };
    this.context = { ...parts, key: contextKeyOf(parts) };
    this.clearView();
    this.readState = "none";
    this.readCode = null;
    this.readDetail = null;
    this.floor = null;
    this.roleGeneration = null;
    this.behind = false;
    this.fence = null;
    this.last = null;
    this.notify();
    return { ...this.context, scope: { ...this.context.scope } };
  }

  /**
   * Starts a new context for another tenant. Rows and the export of the earlier
   * tenant are cleared, and a read or an export still in flight for it is dropped
   * when it arrives, so one tenant's material cannot stay on another tenant's
   * screen. It refuses while a request is in flight. An unknown outcome of the
   * earlier context is counted, not forgotten.
   */
  switchTenant(tenantId: string): TenantContext | null {
    return this.switchParts({ tenantId });
  }

  /**
   * Starts a new context for another person. The assignments the source holds for
   * the person decide which reads, exports, and requests go out.
   */
  switchActor(actorRef: string): TenantContext | null {
    return this.switchParts({ actorRef });
  }

  /**
   * Starts a new context for the same person acting under another role. A role
   * switch is a new session incarnation: the old role's rows and export are
   * cleared, a late answer for the old role is dropped, and proposals the old
   * role was offered are fenced off — the new context's own read decides what is
   * on offer now.
   */
  switchRole(role: TenantRole): TenantContext | null {
    return this.switchParts({ role });
  }

  /**
   * One read. A newer read in the same context wins, and an older answer is
   * dropped. A deep-open read names a resource ref copied from a row or a URL;
   * the source answers an out-of-role or cross-tenant ref with denied.
   */
  async read(focusRef: string | null = null): Promise<TenantReadResult> {
    const key = this.context.key;
    this.readSeq += 1;
    const seq = this.readSeq;
    const actsAtStart = this.actsDone;
    this.counters.reads += 1;
    let outcome: TenantReadOutcome;
    try {
      outcome = await this.port.read({
        contextKey: key,
        actorRef: this.context.actorRef,
        scope: { ...this.context.scope },
        focusRef,
        roleFloor: this.roleGeneration,
        watermarkFloor: this.floor,
      });
    } catch (error) {
      outcome = { kind: "unknown", message: failureText(error) };
    }
    if (key !== this.context.key) {
      this.counters.droppedReads += 1;
      this.notify();
      return { kind: "DROPPED", cause: "context-changed" };
    }
    if (seq < this.appliedReadSeq) {
      this.counters.droppedReads += 1;
      this.notify();
      return { kind: "DROPPED", cause: "older-read" };
    }
    this.appliedReadSeq = seq;
    this.apply(outcome, this.actsDone === actsAtStart);
    this.notify();
    return { kind: "APPLIED", readState: this.readState };
  }

  private apply(outcome: TenantReadOutcome, noActSince: boolean): void {
    this.readCode = null;
    this.readDetail = null;
    if (outcome.kind === "ready") {
      this.snapshot = outcome.snapshot;
      this.assessment = assessTenantSnapshot(outcome.snapshot, this.context.actorRef);
      this.readState = "ready";
      this.floor = outcome.snapshot.watermark;
      this.roleGeneration = outcome.snapshot.roleGeneration;
      // A request that came back after this read began may be missing from it. The view stays behind.
      if (noActSince) {
        this.behind = false;
      }
      return;
    }
    // Anything but a ready read leaves no row and no export on screen.
    this.clearView();
    switch (outcome.kind) {
      case "empty":
        this.readState = "empty";
        this.readDetail = `Tenant ${outcome.scope.tenantId} lists no row for role ${outcome.scope.role} at watermark ${outcome.watermark}.`;
        return;
      case "stale":
        this.readState = "stale";
        this.readDetail = `Watermark ${outcome.watermark} is older than the floor ${outcome.floor}.`;
        return;
      case "role-stale":
        this.readState = "role-stale";
        this.readDetail = `The role assignment moved to generation ${outcome.actual} at the source; this view was built under ${outcome.expected}. Read again under the current assignment.`;
        return;
      case "denied":
        this.readState = "denied";
        this.readCode = outcome.code;
        this.readDetail = outcome.detail;
        return;
      case "refused":
        this.readState = "refused";
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
        return;
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  }

  /**
   * Whether a sensitive export can be requested now, and if not, why. The screen
   * shows this and the send path enforces it, so a control that is off is an
   * export that never leaves — and the port checks it again when one does.
   */
  canExport(): TenantEligibility {
    if (this.port.source === "none") {
      return { allowed: false, reason: TENANT_NOT_BOUND_REASON };
    }
    if (this.readState !== "ready" || this.snapshot === null) {
      return { allowed: false, reason: "An export is judged against the last read. Read the workspace first." };
    }
    if (!tenantCapabilities(this.context.scope.role).includes("export-sensitive")) {
      return {
        allowed: false,
        reason: `Role ${this.context.scope.role} holds no sensitive-export capability at the source. A read and an export stay separate.`,
      };
    }
    return { allowed: true, reason: null };
  }

  /** One export request. A not-bound port sends nothing. */
  async loadExport(): Promise<TenantExportResult> {
    const eligibility = this.canExport();
    if (!eligibility.allowed) {
      this.counters.notSent += 1;
      const reason = this.port.source === "none" ? "not-bound" : this.readState !== "ready" ? "no-snapshot" : "no-capability";
      if (reason === "not-bound") {
        this.exportPhase = "not-bound";
        this.exportCode = null;
        this.exportDetail = TENANT_NOT_BOUND_REASON;
        this.exportValue = null;
      }
      this.notify();
      return { kind: "NOT_SENT", reason, detail: eligibility.reason ?? "" };
    }
    const key = this.context.key;
    this.exportSeq += 1;
    const seq = this.exportSeq;
    this.counters.exports += 1;
    let outcome: TenantExportOutcome;
    try {
      outcome = await this.port.readExport({
        contextKey: key,
        actorRef: this.context.actorRef,
        scope: { ...this.context.scope },
      });
    } catch (error) {
      outcome = { kind: "unknown", message: failureText(error) };
    }
    if (key !== this.context.key) {
      this.counters.droppedExports += 1;
      this.notify();
      return { kind: "DROPPED", cause: "context-changed" };
    }
    if (seq < this.appliedExportSeq) {
      this.counters.droppedExports += 1;
      this.notify();
      return { kind: "DROPPED", cause: "older-export" };
    }
    if (this.readState !== "ready") {
      this.counters.droppedExports += 1;
      this.notify();
      return { kind: "DROPPED", cause: "read-not-ready" };
    }
    this.appliedExportSeq = seq;
    this.applyExport(outcome);
    this.notify();
    return { kind: "APPLIED", phase: this.exportPhase };
  }

  private applyExport(outcome: TenantExportOutcome): void {
    this.exportCode = null;
    this.exportDetail = null;
    this.exportValue = null;
    switch (outcome.kind) {
      case "ready":
        this.exportPhase = "loaded";
        this.exportValue = outcome.export;
        return;
      case "denied":
        this.exportPhase = "denied";
        this.exportCode = outcome.code;
        this.exportDetail = outcome.detail;
        return;
      case "refused":
        this.exportPhase = "refused";
        this.exportCode = outcome.code;
        this.exportDetail = outcome.detail;
        return;
      case "invalid-request":
        this.exportPhase = "invalid";
        this.exportCode = outcome.code;
        this.exportDetail = outcome.detail;
        return;
      case "tuple-changed":
        this.exportPhase = "tuple-changed";
        this.exportDetail = `The pin tuple field ${outcome.field} changed.`;
        return;
      case "not-bound":
        this.exportPhase = "not-bound";
        this.exportDetail = outcome.reason;
        return;
      case "unknown":
        this.exportPhase = "unavailable";
        this.exportDetail = outcome.message;
        return;
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  }

  /**
   * Whether a request can be sent now, and if not, why. The screen shows this and
   * the send path enforces it, so a control that is off is a request that never
   * leaves. The port runs its own check on every request that does leave, so a
   * hidden control is never the enforcement.
   */
  canSend(kind: TenantActionKind): TenantEligibility {
    if (this.port.source === "none") {
      return { allowed: false, reason: TENANT_NOT_BOUND_REASON };
    }
    if (this.inFlight !== null) {
      return { allowed: false, reason: `A ${this.inFlight} request is in flight. One request goes at a time.` };
    }
    if (this.fence !== null) {
      return {
        allowed: false,
        reason:
          "An earlier request has an unknown outcome and may have been recorded. Nothing is sent again from here. Switching the tenant, the actor, or the role, or starting a new synthetic session, begins a new context and counts this unknown outcome.",
      };
    }
    if (this.readState !== "ready" || this.snapshot === null || this.assessment === null) {
      return { allowed: false, reason: "Requests are built from the last read. Read the workspace first." };
    }
    if (this.behind) {
      return { allowed: false, reason: "A request reached the source after the last read. Read again before the next request." };
    }
    const needed = capabilityFor(kind);
    if (!tenantCapabilities(this.context.scope.role).includes(needed)) {
      return {
        allowed: false,
        reason: `Role ${this.context.scope.role} holds no ${needed} capability at the source. Proposal, approval, export, and audit stay separate.`,
      };
    }
    return tenantEligibility(this.snapshot, this.assessment, kind, this.context.actorRef);
  }

  private notSent(reason: TenantNotSentReason, detail: string): TenantActResult {
    this.counters.notSent += 1;
    this.notify();
    return { kind: "NOT_SENT", reason, detail };
  }

  private notSentReason(kind: TenantActionKind): TenantNotSentReason {
    if (this.port.source === "none") {
      return "not-bound";
    }
    if (this.readState !== "ready" || this.snapshot === null) {
      return "no-snapshot";
    }
    if (this.behind) {
      return "stale-read";
    }
    return tenantCapabilities(this.context.scope.role).includes(capabilityFor(kind)) ? "blocked" : "no-capability";
  }

  /** The one send path. It fences first, then checks the offer, then builds from the last read, then sends once. */
  private async dispatch(
    kind: TenantActionKind,
    build: (snapshot: TenantSnapshot, assessment: TenantAssessment) => TenantActionRequest | { notSent: TenantNotSentReason; detail: string },
  ): Promise<TenantActResult> {
    const fence = this.currentFence();
    if (fence !== null) {
      this.counters.notSent += 1;
      this.notify();
      return { kind: "FENCED", fence };
    }
    const eligibility = this.canSend(kind);
    if (!eligibility.allowed || this.snapshot === null || this.assessment === null) {
      return this.notSent(this.notSentReason(kind), eligibility.reason ?? "The request is not on offer.");
    }
    const built = build(this.snapshot, this.assessment);
    if ("notSent" in built) {
      return this.notSent(built.notSent, built.detail);
    }
    const key = this.context.key;
    this.actSeq += 1;
    const seq = this.actSeq;
    this.counters.acts += 1;
    this.inFlight = kind;
    this.notify();
    let outcome: TenantActOutcome;
    try {
      outcome = await this.port.act({
        contextKey: key,
        actorRef: this.context.actorRef,
        // The write carries the assignment generation the read was built under,
        // so the source rejects a write whose role moved underneath it.
        scope: { ...this.context.scope, roleGeneration: this.snapshot.roleGeneration },
        action: built,
      });
    } catch (error) {
      outcome = { kind: "unknown", message: failureText(error) };
    }
    this.inFlight = null;
    this.actsDone += 1;
    const record = this.record(seq, built, outcome);
    this.last = record;
    if (record.phase === "unknown" || record.phase === "refused") {
      this.fence = { reason: "unknown-outcome", seq, action: kind };
      this.behind = true;
    } else if (record.phase === "applied" || record.phase === "rejected") {
      this.behind = true;
    }
    this.notify();
    if (record.phase === "applied") {
      return { kind: "APPLIED", record };
    }
    if (record.phase === "unknown" || record.phase === "refused") {
      return { kind: "UNKNOWN", record };
    }
    return { kind: "REJECTED", record };
  }

  private record(seq: number, action: TenantActionRequest, outcome: TenantActOutcome): TenantActRecord {
    const base = { seq, action, code: null, detail: null, receipt: null };
    switch (outcome.kind) {
      case "applied":
        return { ...base, phase: "applied", receipt: outcome.receipt };
      case "rejected":
        return { ...base, phase: "rejected", code: outcome.code, detail: outcome.detail };
      case "denied":
        return { ...base, phase: "denied", code: outcome.code, detail: outcome.detail };
      case "refused":
        return { ...base, phase: "refused", code: outcome.code, detail: outcome.detail };
      case "invalid-request":
        return { ...base, phase: "invalid", code: outcome.code, detail: outcome.detail };
      case "tuple-changed":
        return { ...base, phase: "tuple-changed", detail: `The pin tuple field ${outcome.field} changed.` };
      case "not-bound":
        return { ...base, phase: "not-bound", detail: outcome.reason };
      case "unknown":
        return { ...base, phase: "unknown", detail: outcome.message };
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  }

  /**
   * Proposes an account change on an account the last read lists. The proposal is
   * a record: it changes no account, and a different actor approves it.
   */
  proposeAccountChange(accountRef: string, note: string): Promise<TenantActResult> {
    return this.dispatch("propose-account-change", (snapshot) => {
      const row = snapshot.accounts.find((item) => item.accountRef === accountRef);
      if (row === undefined) {
        return { notSent: "unknown-ref", detail: `The read lists no account ${accountRef} in this scope.` };
      }
      const text = note.trim();
      if (text.length === 0) {
        return { notSent: "bad-note", detail: "A proposal carries a note that says why." };
      }
      return { kind: "propose-account-change", accountRef: row.accountRef, note: text };
    });
  }

  /**
   * Proposes revoking a membership the last read lists. A role change is a record
   * too: the membership moves only when the source applies it.
   */
  proposeRoleRevoke(memberRef: string, note: string): Promise<TenantActResult> {
    return this.dispatch("propose-role-revoke", (snapshot) => {
      const row = snapshot.members.find((item) => item.memberRef === memberRef);
      if (row === undefined) {
        return { notSent: "unknown-ref", detail: `The read lists no membership ${memberRef} in this scope.` };
      }
      const text = note.trim();
      if (text.length === 0) {
        return { notSent: "bad-note", detail: "A proposal carries a note that says why." };
      }
      return { kind: "propose-role-revoke", memberRef: row.memberRef, note: text };
    });
  }

  /**
   * Records an approval of a pending proposal the read lists. A different actor
   * approves than proposed — the same person's other role is not a different
   * actor. The approval is a record: it changes no resource.
   */
  approveProposal(proposalRef: string): Promise<TenantActResult> {
    return this.dispatch("approve-proposal", (snapshot) => {
      if (!isTenantRef(proposalRef, "proposal")) {
        return { notSent: "unknown-ref", detail: `${proposalRef} is not a proposal reference.` };
      }
      const proposal = tenantApprovableProposals(snapshot, this.context.actorRef).find((row) => row.proposalRef === proposalRef);
      if (proposal === undefined) {
        const listed = snapshot.proposals.find((row) => row.proposalRef === proposalRef);
        return {
          notSent: "unknown-ref",
          detail:
            listed === undefined
              ? `The read lists no proposal ${proposalRef} in this scope.`
              : listed.proposedBy === this.context.actorRef
                ? `Proposal ${proposalRef} was proposed by this actor. A different actor approves it.`
                : `Proposal ${proposalRef} is ${listed.state}. A proposal is approved only while it is pending.`,
        };
      }
      return { kind: "approve-proposal", proposalRef: proposal.proposalRef };
    });
  }
}
