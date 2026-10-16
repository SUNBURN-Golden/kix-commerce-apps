import type { IdentityFence, IdentityStepResult, JourneyIdentityController } from "./journey-identity-controller.js";
import {
  SESSION_JOURNAL_BUDGET,
  SESSION_RETENTION_POLICY,
  SESSION_SETTLE_FAILED_CODE,
  type EvidenceLostCause,
  type JournalStatus,
  type SessionJournal,
  type SessionRecord,
} from "./session-journal.js";
import { sha256Hex } from "./sha256.js";

/**
 * Client side of the session recovery desk: the gate in front of a write, the
 * write-ahead record, the single send, and the settle. It decides what the
 * page may send next after a reload. It decides nothing about payment,
 * issuance, or admission.
 *
 * Rules, all tested:
 *  - The intent and its scope are written to the journal before the send. If
 *    that write is refused, nothing is sent.
 *  - A write is sent once. This class has no resend, resolve, clear, or
 *    compensate call. A reload or a tab resume turns every unresolved intent
 *    into UNKNOWN and sends nothing.
 *  - An unresolved intent fences its scope, whatever context or page load
 *    asks. A write on another scope still goes out.
 *  - An answer the journal could not record leaves the scope UNKNOWN. The
 *    answer is kept in memory as an observation only.
 *  - A confirmed record from an earlier page load is history. It is not a
 *    current fact and it lifts no fence.
 *  - The standing flags below are always false. Browser storage can be lost,
 *    cleared, or copied, so nothing here is an exactly-once guarantee.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

export type SessionFence =
  | { reason: "not-bound" }
  | { reason: "evidence-lost"; cause: EvidenceLostCause }
  | { reason: "unavailable"; cause: "NO_STORE" | "WRITE_REFUSED" }
  | { reason: "unresolved"; intentRef: string; scope: string; code: string | null; recovered: boolean; earlierLoad: boolean; inFlight: boolean }
  | { reason: "underlying"; identity: IdentityFence };

export type SessionNotSentReason =
  | "unknown-target"
  | "field-refused"
  | "journal-full"
  | "write-refused"
  | "duplicate-intent"
  | "not-applied";

export type SessionRunResult =
  | { kind: "CONFIRMED"; record: SessionRecord }
  | { kind: "REJECTED"; record: SessionRecord }
  | { kind: "UNKNOWN"; record: SessionRecord; observed: SessionObserved | null }
  | { kind: "FENCED"; fence: SessionFence }
  | { kind: "NOT_SENT"; reason: SessionNotSentReason; detail: string };

/** An answer that arrived but could not be trusted as the record. Evidence only. */
export type SessionObserved = "confirmed" | "rejected" | "unknown";

export interface SessionSendResult {
  kind: "confirmed" | "rejected" | "unknown" | "not-applied";
  code: string | null;
  detail: string;
}

/** The write this desk stands in front of. */
export interface SessionSender {
  /** False when the adapter has no such command. Nothing is recorded or sent. */
  readonly bound: boolean;
  /** The conflict scope of a target, or null when the target is not known. */
  scopeOf(target: string): string | null;
  /** The underlying desk's own fence for this target, or null. */
  gate(target: string, intentRef: string): IdentityFence | null;
  /** Sends exactly one write. */
  send(target: string, intentRef: string): Promise<SessionSendResult>;
}

function codeOr(code: string | null, placeholder: string): string {
  return code !== null && /^[A-Z0-9_]{1,32}$/.test(code) ? code : placeholder;
}

/** Maps the synthetic journey identity attach onto the sender seam. */
export function identitySender(controller: JourneyIdentityController, options: { bound: boolean }): SessionSender {
  return {
    bound: options.bound,
    scopeOf(target) {
      const verdict = controller.state().adjudications.find((item) => item.item.itemId === target);
      return verdict === undefined ? null : verdict.item.subjectRef;
    },
    gate(target, intentRef) {
      return controller.gateFor({ observationId: target, intentRef });
    },
    async send(target, intentRef) {
      let result: IdentityStepResult;
      try {
        result = await controller.run({ observationId: target, intentRef });
      } catch (error) {
        return { kind: "unknown", code: "SEND_FAILED", detail: error instanceof Error ? error.message : "The write failed after it was sent." };
      }
      switch (result.kind) {
        case "CONFIRMED":
          return { kind: "confirmed", code: null, detail: "The synthetic source recorded the attach." };
        case "REJECTED":
          return { kind: "rejected", code: codeOr(result.intent.code, "REJECTED"), detail: result.intent.message ?? "" };
        case "UNKNOWN":
          return { kind: "unknown", code: codeOr(result.intent.code, "RESPONSE_LOST"), detail: result.intent.message ?? "" };
        case "QUARANTINED":
          return { kind: "unknown", code: "QUARANTINED", detail: "The answer arrived after the context changed." };
        case "FENCED":
          return { kind: "not-applied", code: "FENCED", detail: "The underlying desk fenced the write." };
        case "NOT_SENT":
          return { kind: "not-applied", code: "NOT_SENT", detail: result.detail };
        default: {
          const exhaustive: never = result;
          return exhaustive;
        }
      }
    },
  };
}

export interface SessionCounters {
  /** Calls that reached the sender. A reload never raises this. */
  sent: number;
  /** Writes the gate refused before the sender. */
  fenced: number;
  notSent: number;
  /** Intents turned into UNKNOWN by this page load's open and by tab resumes. */
  recoveredUnknown: number;
}

export interface SessionObservation {
  intentRef: string;
  observed: SessionObserved;
  code: string | null;
}

export interface SessionControllerState {
  status: JournalStatus;
  load: number;
  records: readonly SessionRecord[];
  counters: SessionCounters;
  /** Answers kept in memory only. They resolve nothing. */
  observations: readonly SessionObservation[];
  budget: { maxRecords: number; maxBytes: number; usedRecords: number; usedBytes: number };
  retention: typeof SESSION_RETENTION_POLICY;
  exactlyOnceClaimed: false;
  durableAcrossStorageLoss: false;
}

function contextTagOf(contextKey: string): string {
  return sha256Hex(contextKey).slice(0, 16);
}

export class SessionRecoveryController {
  private sender: SessionSender;
  private contextKey: string;
  private readonly counters: SessionCounters;
  private readonly observations: SessionObservation[] = [];
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly journal: SessionJournal,
    sender: SessionSender,
    contextKey: string,
  ) {
    this.sender = sender;
    this.contextKey = contextKey;
    this.counters = { sent: 0, fenced: 0, notSent: 0, recoveredUnknown: journal.recoveredCount() };
  }

  /** Points the desk at another sender or context. The journal and its fences stay. It does not notify, so a render may call it. */
  rebind(sender: SessionSender, contextKey: string): void {
    this.sender = sender;
    this.contextKey = contextKey;
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

  state(): SessionControllerState {
    return {
      status: this.journal.status(),
      load: this.journal.load(),
      records: this.journal.records(),
      counters: { ...this.counters },
      observations: this.observations.map((item) => ({ ...item })),
      budget: this.journal.budgetInfo(),
      retention: SESSION_RETENTION_POLICY,
      exactlyOnceClaimed: false,
      durableAcrossStorageLoss: false,
    };
  }

  /** The journal's own view of a page load that is shown again. Checks the store and recovers what is in flight. */
  resume(): number {
    this.journal.verify();
    const count = this.journal.recoverInFlight("TAB_RESUMED");
    this.counters.recoveredUnknown += count;
    this.notify();
    return count;
  }

  /** Re-checks the store. A cleared or damaged journal locks the session. */
  verify(): JournalStatus {
    const status = this.journal.verify();
    this.notify();
    return status;
  }

  /** Why a write on this target cannot go out now, or null. This is the single gate `run` uses. */
  gateFor(target: string): SessionFence | null {
    if (!this.sender.bound) {
      return { reason: "not-bound" };
    }
    const status = this.journal.status();
    if (status.kind === "evidence-lost") {
      return { reason: "evidence-lost", cause: status.cause };
    }
    if (status.kind === "unavailable") {
      return { reason: "unavailable", cause: status.cause };
    }
    const scope = this.sender.scopeOf(target);
    if (scope !== null) {
      const block = this.journal.scopeBlock(scope);
      if (block !== null && block.reason === "unresolved") {
        return {
          reason: "unresolved",
          intentRef: block.record.intentRef,
          scope,
          code: block.record.code,
          recovered: block.recovered,
          earlierLoad: block.earlierLoad,
          inFlight: block.record.outcome === "IN_FLIGHT",
        };
      }
      if (block !== null) {
        return block;
      }
    }
    const identity = this.sender.gate(target, "gate-preview");
    return identity === null ? null : { reason: "underlying", identity };
  }

  /**
   * Sends one write, once. The record is written first. If the write-ahead
   * record is refused nothing is sent. Nothing here sends a second time,
   * clears a fence, or compensates.
   */
  async run(target: string): Promise<SessionRunResult> {
    this.journal.verify();
    const fence = this.gateFor(target);
    if (fence !== null) {
      this.counters.fenced += 1;
      this.notify();
      return { kind: "FENCED", fence };
    }
    const scope = this.sender.scopeOf(target);
    if (scope === null) {
      return this.notSent("unknown-target", `Target ${target} is not in the last read.`);
    }
    const sender = this.sender;
    const intentRef = `intent-${this.journal.nextSeq()}`;
    const begun = this.journal.begin({ intentRef, scope, contextTag: contextTagOf(this.contextKey) });
    if (!begun.ok) {
      switch (begun.reason) {
        case "EVIDENCE_LOST":
        case "UNAVAILABLE": {
          const status = this.journal.status();
          this.counters.fenced += 1;
          this.notify();
          return {
            kind: "FENCED",
            fence: status.kind === "evidence-lost" ? { reason: "evidence-lost", cause: status.cause } : { reason: "unavailable", cause: status.kind === "unavailable" ? status.cause : "NO_STORE" },
          };
        }
        case "JOURNAL_FULL":
          return this.notSent("journal-full", "The session journal is full. Nothing is evicted, so nothing more is sent from this tab session.");
        case "WRITE_REFUSED":
          return this.notSent("write-refused", "The browser refused the write-ahead record. Nothing was sent.");
        case "DUPLICATE_INTENT":
          return this.notSent("duplicate-intent", `Intent ${intentRef} was already used.`);
        case "FIELD_REFUSED":
          return this.notSent("field-refused", "A field did not fit the journal's short token format. Nothing was sent.");
        default: {
          const exhaustive: never = begun.reason;
          return exhaustive;
        }
      }
    }
    this.counters.sent += 1;
    this.notify();
    let answer: SessionSendResult;
    try {
      answer = await sender.send(target, intentRef);
    } catch (error) {
      answer = { kind: "unknown", code: "SEND_FAILED", detail: error instanceof Error ? error.message : "The write failed after it was sent." };
    }
    return this.settle(begun.record, answer);
  }

  private notSent(reason: SessionNotSentReason, detail: string): SessionRunResult {
    this.counters.notSent += 1;
    this.notify();
    return { kind: "NOT_SENT", reason, detail };
  }

  private settle(begun: SessionRecord, answer: SessionSendResult): SessionRunResult {
    const { intentRef } = begun;
    const outcome = answer.kind === "confirmed" ? "CONFIRMED" : answer.kind === "unknown" ? "UNKNOWN" : "REJECTED";
    const placeholder = answer.kind === "rejected" ? "REJECTED" : answer.kind === "not-applied" ? "NOT_APPLIED" : "RESPONSE_LOST";
    const code = answer.kind === "confirmed" ? null : codeOr(answer.code, placeholder);
    const settled = this.journal.settle(intentRef, outcome, code);
    if (settled.ok) {
      this.notify();
      switch (settled.record.outcome) {
        case "CONFIRMED":
          return { kind: "CONFIRMED", record: settled.record };
        case "REJECTED":
          return { kind: "REJECTED", record: settled.record };
        default:
          return { kind: "UNKNOWN", record: settled.record, observed: null };
      }
    }
    // The answer could not be recorded. The scope is locked UNKNOWN and the answer is evidence in memory only.
    // A record already turned UNKNOWN by a tab resume stays as it is; a late answer changes nothing.
    const observed: SessionObserved = answer.kind === "confirmed" ? "confirmed" : answer.kind === "unknown" ? "unknown" : "rejected";
    if (settled.reason !== "NOT_IN_FLIGHT") {
      this.journal.markUnknown(intentRef, SESSION_SETTLE_FAILED_CODE);
    }
    this.observations.push({ intentRef, observed, code: answer.code });
    const stored = this.journal.records().find((item) => item.intentRef === intentRef);
    const record: SessionRecord = stored ?? { ...begun, outcome: "UNKNOWN", code: SESSION_SETTLE_FAILED_CODE };
    this.notify();
    return { kind: "UNKNOWN", record, observed };
  }
}

export const SESSION_RECOVERY_BUDGET_LINE = `${SESSION_JOURNAL_BUDGET.maxRecords} records, ${SESSION_JOURNAL_BUDGET.maxBytes} bytes`;
