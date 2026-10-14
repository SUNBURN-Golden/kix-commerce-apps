import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import {
  DELEGATION_RETURN_ACTIONS,
  interpretDelegationRequest,
  isDelegationRef,
  type DelegationAssistantPort,
  type DelegationCommand,
  type DelegationDraft,
  type DelegationGrant,
  type DelegationListing,
  type DelegationReadOutcome,
  type DelegationReceipt,
  type DelegationRejectCode,
  type DelegationReturnAction,
  type DelegationSnapshot,
  type DelegationTurn,
  type DelegationWriteOutcome,
  type DelegationWriteRequest,
} from "./delegated-assistant.js";

/**
 * Client side of the delegation assistant: the write fence, the proposal record,
 * the context key, and the outcome reducer. It decides what the page may send next
 * and how to show what came back. It decides nothing about scope, budget, deadline,
 * or mode: those are the grant's own fields, read from the source and never raised.
 *
 * Rules, all tested:
 *  - Assistant text is never authority. interpret() turns a request into an answer,
 *    a proposal, a clarification, or a refusal. A proposal is a record, not a send.
 *  - A send needs an explicit approve of a recorded open proposal. approve() accepts
 *    a proposal reference, never request text, and the gate resolves the grant from
 *    the last read — no grant is inferred from text.
 *  - A write is sent once. A repeated intent, a write while another write under the
 *    same grant is in flight, and any write while an unknown result is outstanding
 *    under that grant are fenced and never reach the port.
 *  - A lost, cut-off, mis-correlated, untrusted, or thrown response is UNKNOWN. UNKNOWN
 *    is not rejected and is not a success. A read does not lift the fence.
 *  - A result that arrives after the context changed is quarantined. It touches nothing.
 *  - A proposal recorded under an earlier context is stale and cannot be approved.
 *  - The caller supplies each intent reference. This class never mints one.
 *  - expectedGrantVersion is copied from the last read, never typed or raised.
 *  - A synthetic event at the source (a revoke, a supersede, an expiry, a spent
 *    budget) is not seen here until a read. The next approve is judged by the source
 *    against the grant it holds now.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

export const DELEGATION_OUTCOMES = ["DRAFT", "IN_FLIGHT", "CONFIRMED", "REJECTED", "UNKNOWN"] as const;

export type DelegationOutcome = (typeof DELEGATION_OUTCOMES)[number];

export const DELEGATION_FRESHNESS = ["CURRENT", "STALE", "UNAVAILABLE"] as const;

export type DelegationFreshness = (typeof DELEGATION_FRESHNESS)[number];

export type DelegationRefreshCause = "own-write" | "rejection" | "context-switch";

export interface DelegationContext {
  environment: "stub" | "integration-http";
  domain: string;
  /** A context label. It is not an authentication result. */
  actorRef: string;
  /** The delegating user. A context label, not an authentication result. */
  principalRef: string;
  /** Session incarnation. Bumped when the page switches context. */
  incarnation: number;
  key: string;
}

/** A recorded proposal. It is the page's own record, never a protocol object. */
export interface DelegationProposal {
  seq: number;
  proposalRef: string;
  step: DelegationCommand;
  targetRef: string;
  /** The context the proposal was recorded in. A context switch makes it stale. */
  contextKey: string;
  state: "open" | "dismissed" | "consumed";
  detail: string;
}

/** One request and the turn the deterministic interpreter produced for it. */
export interface DelegationTurnRecord {
  seq: number;
  /** The first 160 characters of the request text, kept as this page's record. */
  excerpt: string;
  turn: DelegationTurn;
  /** The proposal the turn produced, or null. A proposal is not an approval. */
  proposalRef: string | null;
}

export interface DelegationIntentRecord {
  seq: number;
  intentRef: string;
  step: DelegationCommand;
  /** The approved proposal this command came from. */
  proposalRef: string;
  /** The grant the gate resolved. Writes under one grant are serialised. */
  grantRef: string;
  targetRef: string;
  contextKey: string;
  outcome: DelegationOutcome;
  code: string | null;
  message: string | null;
  receipt: DelegationReceipt | null;
}

export interface DelegationQuarantined {
  intentRef: string;
  contextKey: string;
  /** What arrived: a port outcome kind. */
  arrived: string;
  code: string | null;
  cause: "context-changed";
}

export type DelegationFence =
  | { reason: "not-bound" }
  | { reason: "duplicate-intent"; intentRef: string }
  | { reason: "proposal-missing"; proposalRef: string }
  | { reason: "proposal-closed"; proposalRef: string; state: string }
  | { reason: "proposal-stale"; proposalRef: string }
  | { reason: "in-flight"; intentRef: string }
  | { reason: "unknown-outcome"; intentRef: string; earlierContext: boolean }
  | { reason: "no-snapshot" }
  | { reason: "snapshot-stale"; cause: DelegationRefreshCause }
  | { reason: "not-listed"; ref: string }
  | { reason: "no-grant"; targetRef: string }
  | { reason: "grant-not-active"; grantRef: string; state: string }
  | { reason: "mode-capped"; grantRef: string; requestedMode: string; adoptedMode: string }
  | { reason: "action-not-granted"; grantRef: string; step: string }
  | { reason: "budget-exhausted"; grantRef: string }
  | { reason: "target-closed"; ref: string; state: string };

export type DelegationNotSentReason = "invalid-intent" | "identity" | "unknown-ref" | "tuple-changed" | "invalid-request" | "denied";

export interface DelegationApproveInput {
  proposalRef: string;
  intentRef: string;
}

export type DelegationStepResult =
  | { kind: "CONFIRMED"; intent: DelegationIntentRecord }
  | { kind: "REJECTED"; intent: DelegationIntentRecord }
  | { kind: "UNKNOWN"; intent: DelegationIntentRecord }
  | { kind: "QUARANTINED"; intent: DelegationIntentRecord }
  | { kind: "FENCED"; fence: DelegationFence }
  | { kind: "NOT_SENT"; reason: DelegationNotSentReason; detail: string };

export type DelegationReadState =
  | "none"
  | "ready"
  | "empty"
  | "stale"
  | "denied"
  | "refused"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export type DelegationRefreshResult =
  | { kind: "APPLIED"; readState: DelegationReadState }
  | { kind: "DROPPED"; cause: "context-changed" | "older-read" };

export type DelegationDismissResult = { kind: "dismissed"; proposalRef: string } | { kind: "missing"; proposalRef: string } | { kind: "closed"; proposalRef: string };

export interface DelegationCounters {
  /** Calls that reached port.submit. */
  sent: number;
  /** Writes the fence refused before the port. */
  fenced: number;
  notSent: number;
  droppedReads: number;
  /** Requests refused by the interpreter, including injection-flagged text. */
  refusedRequests: number;
}

export interface DelegationControllerState {
  context: DelegationContext;
  readState: DelegationReadState;
  readDetail: string | null;
  readCode: string | null;
  snapshot: DelegationSnapshot | null;
  freshness: DelegationFreshness;
  refreshRequired: DelegationRefreshCause | null;
  proposals: readonly DelegationProposal[];
  turns: readonly DelegationTurnRecord[];
  intents: readonly DelegationIntentRecord[];
  quarantined: readonly DelegationQuarantined[];
  counters: DelegationCounters;
}

function contextKeyOf(parts: Pick<DelegationContext, "environment" | "domain" | "actorRef" | "principalRef" | "incarnation">): string {
  return [parts.environment, parts.domain, parts.actorRef, parts.principalRef, String(parts.incarnation)].join("|");
}

function copyIntent(intent: DelegationIntentRecord): DelegationIntentRecord {
  return { ...intent, receipt: intent.receipt === null ? null : { ...intent.receipt, nonClaims: { ...intent.receipt.nonClaims } } };
}

function copyProposal(proposal: DelegationProposal): DelegationProposal {
  return { ...proposal };
}

export class DelegationAssistantController {
  private context: DelegationContext;
  private snapshot: DelegationSnapshot | null = null;
  private readState: DelegationReadState = "none";
  private readDetail: string | null = null;
  private readCode: string | null = null;
  private refreshRequired: DelegationRefreshCause | null = null;
  /**
   * Reads numbered at or below this began before the last thing that made the view behind
   * (a write that settled, or a context switch). They may not show it, so they never clear the flag.
   */
  private behindAfterSeq = 0;
  private floor: string | null = null;
  private readSeq = 0;
  private appliedReadSeq = 0;
  private intentSeq = 0;
  private turnSeq = 0;
  private proposalSeq = 0;
  private readonly proposals: DelegationProposal[] = [];
  private readonly turns: DelegationTurnRecord[] = [];
  private readonly intents: DelegationIntentRecord[] = [];
  private readonly used = new Set<string>();
  private readonly quarantined: DelegationQuarantined[] = [];
  private readonly counters: DelegationCounters = { sent: 0, fenced: 0, notSent: 0, droppedReads: 0, refusedRequests: 0 };
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly port: DelegationAssistantPort,
    options: { actorRef: string; principalRef: string; incarnation?: number },
  ) {
    const incarnation = options.incarnation ?? 1;
    const parts = {
      environment: port.environment,
      domain: PINNED_PROTOCOL_DOMAIN,
      actorRef: options.actorRef,
      principalRef: options.principalRef,
      incarnation,
    };
    this.context = { ...parts, key: contextKeyOf(parts) };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Tells subscribers to read the state again. It changes nothing here. */
  notify(): void {
    for (const listener of [...this.listeners]) {
      listener();
    }
  }

  state(): DelegationControllerState {
    let freshness: DelegationFreshness = "UNAVAILABLE";
    if (this.readState === "ready" || this.readState === "empty") {
      freshness = this.refreshRequired === null ? "CURRENT" : "STALE";
    } else if (this.readState === "stale") {
      freshness = "STALE";
    }
    return {
      context: { ...this.context },
      readState: this.readState,
      readDetail: this.readDetail,
      readCode: this.readCode,
      snapshot: this.snapshot,
      freshness,
      refreshRequired: this.refreshRequired,
      proposals: this.proposals.map(copyProposal),
      turns: this.turns.map((turn) => ({ ...turn })),
      intents: this.intents.map(copyIntent),
      quarantined: this.quarantined.map((item) => ({ ...item })),
      counters: { ...this.counters },
    };
  }

  /**
   * Starts a new context: another actor, another principal scope, or a new session
   * incarnation. A write that is in flight becomes UNKNOWN, because its result will
   * arrive in a context this controller has left. The snapshot is dropped and open
   * proposals are now stale. Fences stay: an unknown outcome under a grant still
   * blocks that grant, and returning to the principal finds the earlier unknown
   * still counted.
   */
  switchContext(next: { actorRef?: string; principalRef?: string } = {}): DelegationContext {
    const parts = {
      environment: this.context.environment,
      domain: this.context.domain,
      actorRef: next.actorRef ?? this.context.actorRef,
      principalRef: next.principalRef ?? this.context.principalRef,
      incarnation: this.context.incarnation + 1,
    };
    const principalChanged = parts.principalRef !== this.context.principalRef;
    this.context = { ...parts, key: contextKeyOf(parts) };
    for (const intent of this.intents) {
      if (intent.outcome === "IN_FLIGHT") {
        intent.outcome = "UNKNOWN";
        intent.code = "CONTEXT_SWITCHED";
        intent.message = "The session context changed while this write was in flight. Its result is not applied.";
      }
    }
    if (principalChanged) {
      // The floor belongs to the principal whose read set it.
      this.floor = null;
    }
    this.snapshot = null;
    this.readState = "none";
    this.readDetail = null;
    this.readCode = null;
    this.markBehind("context-switch");
    this.notify();
    return { ...this.context };
  }

  /**
   * Turns request text into one turn and records it. A proposal becomes an open
   * proposal row; an answer, a clarification, and a refusal record nothing sendable.
   * This method sends nothing and approves nothing: text is never authority.
   */
  interpret(text: string): DelegationTurn {
    const turn = interpretDelegationRequest(text);
    this.turnSeq += 1;
    const seq = this.turnSeq;
    let proposalRef: string | null = null;
    if (turn.kind === "proposal") {
      this.proposalSeq += 1;
      proposalRef = `prp-${String(this.proposalSeq).padStart(4, "0")}`;
      this.proposals.push({
        seq: this.proposalSeq,
        proposalRef,
        step: turn.step,
        targetRef: turn.targetRef,
        contextKey: this.context.key,
        state: "open",
        detail: turn.detail,
      });
    }
    if (turn.kind === "refused") {
      this.counters.refusedRequests += 1;
    }
    this.turns.push({ seq, excerpt: text.trim().slice(0, 160), turn, proposalRef });
    this.notify();
    return turn;
  }

  /** Marks an open proposal dismissed. A dismissed proposal can never be approved. */
  dismiss(proposalRef: string): DelegationDismissResult {
    const proposal = this.proposals.find((item) => item.proposalRef === proposalRef);
    if (!proposal) {
      return { kind: "missing", proposalRef };
    }
    if (proposal.state !== "open") {
      return { kind: "closed", proposalRef };
    }
    proposal.state = "dismissed";
    this.notify();
    return { kind: "dismissed", proposalRef };
  }

  /** The view is behind from now on. A read numbered at or below the latest read so far cannot clear it. */
  private markBehind(cause: DelegationRefreshCause): void {
    this.refreshRequired = this.refreshRequired ?? cause;
    this.behindAfterSeq = this.readSeq;
  }

  /** Explicit read. A read is evidence. It never resolves an unknown write. */
  async refresh(): Promise<DelegationRefreshResult> {
    const key = this.context.key;
    const request = {
      contextKey: key,
      actorRef: this.context.actorRef,
      principalRef: this.context.principalRef,
      watermarkFloor: this.floor,
    };
    this.readSeq += 1;
    const seq = this.readSeq;
    let outcome: DelegationReadOutcome;
    try {
      outcome = await this.port.read(request);
    } catch (error) {
      outcome = { kind: "unknown", message: error instanceof Error ? error.message : "The read failed." };
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
    this.readCode = null;
    switch (outcome.kind) {
      case "ready":
        this.snapshot = outcome.snapshot;
        this.readState = "ready";
        this.readDetail = null;
        this.clearBehind(seq);
        this.floor = outcome.snapshot.watermark;
        break;
      case "empty":
        this.snapshot = null;
        this.readState = "empty";
        this.readDetail = null;
        this.clearBehind(seq);
        break;
      case "stale":
        this.snapshot = null;
        this.readState = "stale";
        this.readDetail = `Watermark ${outcome.watermark} is older than the floor ${outcome.floor}.`;
        break;
      case "denied":
        this.snapshot = null;
        this.readState = "denied";
        this.readCode = outcome.code;
        this.readDetail = outcome.detail;
        break;
      case "refused":
        this.snapshot = null;
        this.readState = "refused";
        this.readCode = outcome.code;
        this.readDetail = `${outcome.detail} (${outcome.field})`;
        break;
      case "tuple-changed":
        this.snapshot = null;
        this.readState = "tuple-changed";
        this.readDetail = `The pin tuple field ${outcome.field} changed.`;
        break;
      case "not-bound":
        this.snapshot = null;
        this.readState = "not-bound";
        this.readDetail = outcome.reason;
        break;
      case "unknown":
        this.snapshot = null;
        this.readState = "unavailable";
        this.readDetail = outcome.message;
        break;
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
    this.notify();
    return { kind: "APPLIED", readState: this.readState };
  }

  /** Only a read that began after the view went behind can say it is current again. */
  private clearBehind(seq: number): void {
    if (seq > this.behindAfterSeq) {
      this.refreshRequired = null;
    }
  }

  /**
   * Resolves the grant a proposal would run under, from the last read. A draft order
   * resolves through its listing's event; a cancel through the draft's own grant. No
   * grant is inferred: a target no grant covers is a fence, not a search for one.
   */
  private resolve(
    proposal: DelegationProposal,
    snapshot: DelegationSnapshot,
  ): { kind: "grant"; grant: DelegationGrant; target: DelegationListing | DelegationDraft } | { kind: "fence"; fence: DelegationFence } {
    if (proposal.step === "draft-order") {
      const listing = snapshot.listings.find((item) => item.listingRef === proposal.targetRef);
      if (!listing) {
        return { kind: "fence", fence: { reason: "not-listed", ref: proposal.targetRef } };
      }
      const grant = snapshot.grants.find(
        (item) => item.principalRef === this.context.principalRef && item.scope === "orders" && item.targetEventRef === listing.eventRef,
      );
      if (!grant) {
        return { kind: "fence", fence: { reason: "no-grant", targetRef: listing.listingRef } };
      }
      return { kind: "grant", grant, target: listing };
    }
    const draft = snapshot.drafts.find((item) => item.draftRef === proposal.targetRef);
    if (!draft) {
      return { kind: "fence", fence: { reason: "not-listed", ref: proposal.targetRef } };
    }
    const grant = snapshot.grants.find((item) => item.grantRef === draft.grantRef);
    if (!grant) {
      return { kind: "fence", fence: { reason: "no-grant", targetRef: draft.draftRef } };
    }
    return { kind: "grant", grant, target: draft };
  }

  /** Why this approval cannot go out now, or null. This is the single gate `approve` uses. */
  gateFor(input: DelegationApproveInput): DelegationFence | null {
    if (this.port.source === "none") {
      return { reason: "not-bound" };
    }
    if (this.used.has(input.intentRef)) {
      return { reason: "duplicate-intent", intentRef: input.intentRef };
    }
    const proposal = this.proposals.find((item) => item.proposalRef === input.proposalRef);
    if (!proposal) {
      return { reason: "proposal-missing", proposalRef: input.proposalRef };
    }
    if (proposal.state !== "open") {
      return { reason: "proposal-closed", proposalRef: proposal.proposalRef, state: proposal.state };
    }
    if (proposal.contextKey !== this.context.key) {
      return { reason: "proposal-stale", proposalRef: proposal.proposalRef };
    }
    const snapshot = this.snapshot;
    if (snapshot === null) {
      return this.refreshRequired !== null ? { reason: "snapshot-stale", cause: this.refreshRequired } : { reason: "no-snapshot" };
    }
    if (this.refreshRequired !== null) {
      return { reason: "snapshot-stale", cause: this.refreshRequired };
    }
    const resolved = this.resolve(proposal, snapshot);
    if (resolved.kind === "fence") {
      return resolved.fence;
    }
    const grantRef = resolved.grant.grantRef;
    const open = this.intents.filter((intent) => intent.grantRef === grantRef);
    const flying = open.find((intent) => intent.outcome === "IN_FLIGHT");
    if (flying) {
      return { reason: "in-flight", intentRef: flying.intentRef };
    }
    const unknown = open.find((intent) => intent.outcome === "UNKNOWN");
    if (unknown) {
      return { reason: "unknown-outcome", intentRef: unknown.intentRef, earlierContext: unknown.contextKey !== this.context.key };
    }
    const grant = resolved.grant;
    if (grant.state !== "active") {
      return { reason: "grant-not-active", grantRef: grant.grantRef, state: grant.state };
    }
    if (grant.adoptedMode !== "command") {
      return { reason: "mode-capped", grantRef: grant.grantRef, requestedMode: grant.requestedMode, adoptedMode: grant.adoptedMode };
    }
    if (!grant.allowedActions.includes(proposal.step)) {
      return { reason: "action-not-granted", grantRef: grant.grantRef, step: proposal.step };
    }
    if (grant.commandsUsed >= grant.commandBudget) {
      return { reason: "budget-exhausted", grantRef: grant.grantRef };
    }
    if (proposal.step === "draft-order" && (resolved.target as DelegationListing).state !== "open") {
      return { reason: "target-closed", ref: proposal.targetRef, state: (resolved.target as DelegationListing).state };
    }
    if (proposal.step === "cancel-draft" && (resolved.target as DelegationDraft).state !== "staged") {
      return { reason: "target-closed", ref: proposal.targetRef, state: (resolved.target as DelegationDraft).state };
    }
    return null;
  }

  /**
   * Approves one recorded proposal and sends its command once. The result is a
   * receipt-shaped outcome or a reason it was not sent. Nothing here sends a second
   * time, mints an intent, or reads request text.
   */
  async approve(input: DelegationApproveInput): Promise<DelegationStepResult> {
    const shape = this.checkShape(input);
    if (shape !== null) {
      this.counters.notSent += 1;
      this.notify();
      return shape;
    }
    const fence = this.gateFor(input);
    if (fence !== null) {
      this.counters.fenced += 1;
      this.notify();
      return { kind: "FENCED", fence };
    }
    const built = this.buildRequest(input);
    if (built.kind === "NOT_SENT") {
      this.counters.notSent += 1;
      this.notify();
      return built;
    }
    const { request, proposal, grantRef } = built;
    proposal.state = "consumed";
    this.used.add(input.intentRef);
    this.intentSeq += 1;
    const intent: DelegationIntentRecord = {
      seq: this.intentSeq,
      intentRef: input.intentRef,
      step: proposal.step,
      proposalRef: proposal.proposalRef,
      grantRef,
      targetRef: proposal.targetRef,
      contextKey: this.context.key,
      outcome: "IN_FLIGHT",
      code: null,
      message: null,
      receipt: null,
    };
    this.intents.push(intent);
    this.counters.sent += 1;
    this.notify();
    let outcome: DelegationWriteOutcome;
    try {
      outcome = await this.port.submit(request);
    } catch (error) {
      outcome = {
        kind: "unknown",
        step: proposal.step,
        intentRef: input.intentRef,
        contextKey: request.contextKey,
        message: error instanceof Error ? error.message : "The write failed after it was sent.",
      };
    }
    return this.settle(intent, outcome);
  }

  private checkShape(input: DelegationApproveInput): Extract<DelegationStepResult, { kind: "NOT_SENT" }> | null {
    if (typeof input.intentRef !== "string" || input.intentRef.trim().length === 0) {
      return { kind: "NOT_SENT", reason: "invalid-intent", detail: "A write carries an intent reference chosen by the caller." };
    }
    const proposal = this.proposals.find((item) => item.proposalRef === input.proposalRef);
    if (proposal !== null && proposal !== undefined) {
      if (proposal.step === "draft-order" && !isDelegationRef(proposal.targetRef, "listing")) {
        return { kind: "NOT_SENT", reason: "identity", detail: "A draft order names a listing reference, not a draft or a grant." };
      }
      if (proposal.step === "cancel-draft" && !isDelegationRef(proposal.targetRef, "draft")) {
        return { kind: "NOT_SENT", reason: "identity", detail: "A cancel names a draft reference, not a listing or a grant." };
      }
    }
    return null;
  }

  private buildRequest(
    input: DelegationApproveInput,
  ):
    | { kind: "BUILT"; request: DelegationWriteRequest; proposal: DelegationProposal; grantRef: string }
    | Extract<DelegationStepResult, { kind: "NOT_SENT" }> {
    const snapshot = this.snapshot;
    const proposal = this.proposals.find((item) => item.proposalRef === input.proposalRef);
    if (snapshot === null || !proposal) {
      return { kind: "NOT_SENT", reason: "unknown-ref", detail: "No read or proposal to copy the grant fields from." };
    }
    const resolved = this.resolve(proposal, snapshot);
    if (resolved.kind === "fence") {
      return { kind: "NOT_SENT", reason: "unknown-ref", detail: `No grant covers ${proposal.targetRef} in the last read.` };
    }
    const base = {
      contextKey: this.context.key,
      actorRef: this.context.actorRef,
      principalRef: this.context.principalRef,
      grantRef: resolved.grant.grantRef,
      intentRef: input.intentRef,
      expectedGrantVersion: resolved.grant.version,
    };
    if (proposal.step === "draft-order") {
      return { kind: "BUILT", request: { ...base, step: "draft-order", listingRef: proposal.targetRef }, proposal, grantRef: resolved.grant.grantRef };
    }
    return { kind: "BUILT", request: { ...base, step: "cancel-draft", draftRef: proposal.targetRef }, proposal, grantRef: resolved.grant.grantRef };
  }

  private settle(intent: DelegationIntentRecord, outcome: DelegationWriteOutcome): DelegationStepResult {
    if (intent.outcome !== "IN_FLIGHT") {
      this.quarantined.push({
        intentRef: intent.intentRef,
        contextKey: intent.contextKey,
        arrived: outcome.kind,
        code: outcome.kind === "rejected" || outcome.kind === "invalid-request" || outcome.kind === "denied" || outcome.kind === "refused" ? outcome.code : null,
        cause: "context-changed",
      });
      this.notify();
      return { kind: "QUARANTINED", intent: copyIntent(intent) };
    }
    const correlated =
      outcome.kind === "not-bound" || (outcome.intentRef === intent.intentRef && outcome.contextKey === intent.contextKey);
    if (!correlated) {
      intent.outcome = "UNKNOWN";
      intent.code = "CORRELATION";
      intent.message = "The result named a different intent or context than the one sent.";
      this.notify();
      return { kind: "UNKNOWN", intent: copyIntent(intent) };
    }
    switch (outcome.kind) {
      case "confirmed":
        intent.outcome = "CONFIRMED";
        intent.receipt = { ...outcome.receipt, nonClaims: { ...outcome.receipt.nonClaims } };
        this.markBehind("own-write");
        this.notify();
        return { kind: "CONFIRMED", intent: copyIntent(intent) };
      case "rejected":
        intent.outcome = "REJECTED";
        intent.code = outcome.code;
        intent.message = outcome.detail;
        // The source disagreed with the read the write was built from, so that read is behind.
        this.markBehind("rejection");
        this.notify();
        return { kind: "REJECTED", intent: copyIntent(intent) };
      case "unknown":
        intent.outcome = "UNKNOWN";
        intent.code = "RESPONSE_LOST";
        intent.message = outcome.message;
        this.notify();
        return { kind: "UNKNOWN", intent: copyIntent(intent) };
      case "refused":
        // The source answered, and the answer broke a rule. The request may have been recorded.
        intent.outcome = "UNKNOWN";
        intent.code = outcome.code;
        intent.message = `The answer was not trusted, and the request may have been recorded. ${outcome.detail}`;
        this.notify();
        return { kind: "UNKNOWN", intent: copyIntent(intent) };
      case "denied":
        intent.outcome = "DRAFT";
        intent.code = outcome.code;
        intent.message = outcome.detail;
        this.counters.notSent += 1;
        this.notify();
        return { kind: "NOT_SENT", reason: "denied", detail: outcome.detail };
      case "tuple-changed":
        intent.outcome = "DRAFT";
        intent.code = "TUPLE_CHANGED";
        intent.message = `The pin tuple field ${outcome.field} changed. Nothing was applied.`;
        this.counters.notSent += 1;
        this.notify();
        return { kind: "NOT_SENT", reason: "tuple-changed", detail: intent.message };
      case "invalid-request":
        intent.outcome = "DRAFT";
        intent.code = outcome.code;
        intent.message = outcome.detail;
        this.counters.notSent += 1;
        this.notify();
        return { kind: "NOT_SENT", reason: "invalid-request", detail: outcome.detail };
      case "not-bound":
        intent.outcome = "DRAFT";
        intent.code = "NOT_BOUND";
        intent.message = outcome.reason;
        this.counters.notSent += 1;
        this.notify();
        return { kind: "NOT_SENT", reason: "invalid-request", detail: outcome.reason };
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Projection: requests, proposals, and commands stay three separate lines
// ---------------------------------------------------------------------------

export interface DelegationDraftProjection extends DelegationDraft {
  /** True only when a confirmed receipt of this page named the draft. */
  linked: boolean;
}

export interface DelegationListingProjection extends DelegationListing {
  drafts: readonly DelegationDraftProjection[];
}

export interface DelegationRejectionRow {
  intentRef: string;
  proposalRef: string;
  step: DelegationCommand;
  grantRef: string;
  targetRef: string;
  code: string;
  returnAction: DelegationReturnAction;
  detail: string;
}

export interface DelegationProjection {
  grants: readonly DelegationGrant[];
  listings: readonly DelegationListingProjection[];
  drafts: readonly DelegationDraftProjection[];
  proposals: readonly DelegationProposal[];
  turns: readonly DelegationTurnRecord[];
  /** Rejections the source made of this page's writes. */
  rejections: readonly DelegationRejectionRow[];
  /** Commands with no confirmed receipt. A lost command lands here, and no draft is claimed for it. */
  unlinkedIntents: readonly DelegationIntentRecord[];
  freshness: DelegationFreshness;
}

function returnActionFor(code: string): DelegationReturnAction {
  return (DELEGATION_RETURN_ACTIONS as Record<string, DelegationReturnAction | undefined>)[code] ?? "read-again";
}

export function projectDelegation(state: DelegationControllerState): DelegationProjection {
  const snapshot = state.snapshot;
  const linkedRefs = new Set(
    state.intents
      .filter((intent) => intent.outcome === "CONFIRMED" && intent.receipt !== null)
      .map((intent) => intent.receipt?.draftRef ?? ""),
  );
  const drafts: DelegationDraftProjection[] = (snapshot ? snapshot.drafts : []).map((draft) => ({
    ...draft,
    linked: linkedRefs.has(draft.draftRef),
  }));
  const listings: DelegationListingProjection[] = (snapshot ? snapshot.listings : []).map((listing) => ({
    ...listing,
    drafts: drafts.filter((draft) => draft.listingRef === listing.listingRef),
  }));
  const rejections: DelegationRejectionRow[] = state.intents
    .filter((intent) => intent.outcome === "REJECTED")
    .map((intent) => {
      const code = (intent.code ?? "UNKNOWN_REF") as DelegationRejectCode;
      return {
        intentRef: intent.intentRef,
        proposalRef: intent.proposalRef,
        step: intent.step,
        grantRef: intent.grantRef,
        targetRef: intent.targetRef,
        code,
        returnAction: returnActionFor(code),
        detail: intent.message ?? "",
      };
    });
  const unlinkedIntents = state.intents
    .filter((intent) => intent.outcome === "UNKNOWN" || intent.outcome === "IN_FLIGHT")
    .map(copyIntent);
  return {
    grants: snapshot ? snapshot.grants : [],
    listings,
    drafts,
    proposals: state.proposals,
    turns: state.turns,
    rejections,
    unlinkedIntents,
    freshness: state.freshness,
  };
}
