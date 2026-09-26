import { isRecord } from "./record.js";
import { SURFACES } from "./surfaces.js";
import {
  ProtocolError,
  RESERVATION_ADMISSION_REFERENCE,
  RESERVATION_PROVENANCE,
  type AdmissionAdopt,
  type AdmissionAuthorize,
  type AdmissionClock,
  type AdmissionCommandReceipt,
  type AdmissionConsume,
  type AdmissionCredentialView,
  type AdmissionDeskState,
  type AdmissionLifecycleCommand,
  type AdmissionPhase,
  type AdmissionPresentation,
  type AdmissionPresentationQuery,
  type AdmissionReconcile,
  type AdmissionReconcileReceipt,
  type ReservationAuthorize,
  type ReservationCaseView,
  type ReservationCommandReceipt,
  type ReservationConsume,
  type ResalePresentationQuery,
  type ResalePresentationView,
  type ResaleRightView,
} from "./types.js";

/**
 * In-process mock admission credentials for the booking and admission desks.
 *
 * Phase names and the refusal codes follow the kix-protocol in-memory FSM at
 * the UI contract only.
 * Authoritative machine: BeautifulMind-JT/kix-protocol
 * `reference/booking_resale_admission/admission_fsm.py`
 * on main `3b6bdd26f61bb828af3781946b63a3a3fa03187b`
 * (feature `38a3d68f714100e385ba9e2b7716ed2e5b890d12`).
 *
 * This store does not port MockGates arithmetic, does not scan a venue, and
 * does not add OpenAPI commands. P03 stays 설계중.
 * The journal is process-local. It is not the protocol journal and not a ledger.
 * A fresh presentation is not venue entry. `deskState: "valid"` means the mock
 * credential still matches the bound reservation and ownership reads.
 */
export const ADMISSION_DEPTH_BASELINE = {
  protocolRepo: "BeautifulMind-JT/kix-protocol",
  protocolMainSha: "3b6bdd26f61bb828af3781946b63a3a3fa03187b",
  featureCommit: "38a3d68f714100e385ba9e2b7716ed2e5b890d12",
  fsmPath: "reference/booking_resale_admission/admission_fsm.py",
  provenance: RESERVATION_PROVENANCE,
} as const;

export const ADMISSION_CASE_NOTE =
  "Simulated mock credential on the adapter stub. Not venue admission. P03 stays 설계중. Protocol truth remains in kix-protocol. This case does not scan a gate or move funds.";

export const ADMISSION_TRANSPORT_NOTE =
  "Loopback integration-gate probe. Not venue admission. A reachable gate is not entry. Local HTTP success is not production approval. P03 stays 설계중.";

const UNAVAILABLE_CODES: ReadonlySet<string> = new Set([
  "GATE_UNAVAILABLE",
  "GATE_TRANSPORT",
  "GATE_STATUS",
  "TICKET_SOURCE_UNAVAILABLE",
  "VENUE_SOURCE_UNAVAILABLE",
  "REVOCATION_SOURCE_UNAVAILABLE",
  "OWNERSHIP_SOURCE_UNAVAILABLE",
  "SETTLEMENT_SOURCE_UNAVAILABLE",
  "CONTROLLER_UNAVAILABLE",
]);

const STALE_CODES: ReadonlySet<string> = new Set([
  "STALE_VERSION",
  "CREDENTIAL_STALE",
  "ADMISSION_EXPIRED",
  "STALE_OR_WRONG_PRESENTATION",
]);

const TRANSFER_CODES: ReadonlySet<string> = new Set([
  "STALE_VERSION",
  "CREDENTIAL_STALE",
  "STALE_OR_WRONG_PRESENTATION",
  "NOT_HOLDER",
]);

const UNSTORED_REJECTION: ReadonlySet<string> = new Set([
  "MOCK_INVARIANT",
  "IDEMPOTENCY_CONFLICT",
  "INVALID_JOURNAL",
]);

const JOURNAL_OPS = ["set_clock", "adopt_issued", "authorize_admission", "consume"] as const;

type JournalOp = (typeof JOURNAL_OPS)[number];

interface JournalEntry {
  op: JournalOp;
  idempotencyKey: string;
  subjectId: string;
  body: Record<string, string>;
}

interface CredentialRecord {
  rightId: string;
  reservationId: string;
  holderRole: string;
  phase: AdmissionPhase;
  admissionId: string | null;
  gateRole: string | null;
  request: string | null;
  expiresAt: string | null;
  consumeId: string | null;
  versionAfter: number | null;
  lastKey: string;
  lastRejectCode: string | null;
  reconcileMatched: boolean | null;
}

interface IdempotencyRecord {
  request: string;
  result: AdmissionCommandReceipt | null;
  error: string | null;
}

export interface AdmissionSettlementView {
  fundsExecuted: boolean;
  economicFinalityClaimed: boolean;
  admissionGranted: boolean;
}

export interface AdmissionSources {
  viewReservation(reservationId: string): ReservationCaseView;
  authorizeReservation(input: ReservationAuthorize): ReservationCommandReceipt;
  consumeReservation(input: ReservationConsume): ReservationCommandReceipt;
  viewResaleRight(rightId: string): ResaleRightView;
  viewResalePresentation(input: ResalePresentationQuery): ResalePresentationView;
  viewSettlement(settlementId: string): AdmissionSettlementView;
}

export interface AdmissionSourceOptions {
  venueConfigured?: boolean;
  revocationConfigured?: boolean;
  ownershipDown?: boolean;
  ticketDown?: boolean;
}

interface Freshness {
  fresh: boolean;
  decision: string | null;
  transferObserved: boolean;
}

/**
 * Maps a protocol or transport code onto a desk label.
 * A catalogue `ADMITTED_ONCE` receipt is not `valid`. Freshness is `valid`
 * only when the caller reports `fresh` and no decision code.
 */
export function admissionDeskState(input: {
  decision: string | null;
  fresh: boolean;
  transferObserved: boolean;
}): AdmissionDeskState {
  const decision = input.decision;
  if (decision === "TICKET_CANCELLED") {
    return "cancelled";
  }
  if (decision === "ALREADY_CONSUMED") {
    return "already-consumed";
  }
  if (decision !== null && UNAVAILABLE_CODES.has(decision)) {
    return "unavailable-server";
  }
  if (input.transferObserved && decision !== null && TRANSFER_CODES.has(decision)) {
    return "transferred";
  }
  if (decision !== null && STALE_CODES.has(decision)) {
    return "stale";
  }
  if (input.fresh && decision === null && !input.transferObserved) {
    return "valid";
  }
  return "invalid";
}

export function admissionBoundaryPresentation(input: {
  rightId: string;
  version: number;
  holderRole: string;
  decision: string | null;
  fresh: boolean;
  transferObserved: boolean;
  phase: AdmissionPhase | null;
  mode: AdmissionPresentation["mode"];
  lifecycleAuthority: AdmissionPresentation["lifecycleAuthority"];
  note: string;
}): AdmissionPresentation {
  return {
    mode: input.mode,
    surface: SURFACES.admissionFsm,
    provenance: RESERVATION_PROVENANCE,
    lifecycleAuthority: input.lifecycleAuthority,
    rightId: input.rightId,
    version: input.version,
    holderRole: input.holderRole,
    phase: input.phase,
    fresh: input.fresh,
    decision: input.decision,
    deskState: admissionDeskState(input),
    transferObserved: input.transferObserved,
    offlineAdmission: false,
    venueCredentialReissued: false,
    admissionRoutingProduction: false,
    externalAdmission: "UNSUPPORTED",
    economicFinalityClaimed: false,
    fundsExecuted: false,
    note: input.note,
  };
}

export class AdmissionCaseStore {
  private clockMs = 0;
  private readonly credentials = new Map<string, CredentialRecord>();
  private readonly admissions = new Map<string, string>();
  private readonly consumes = new Map<string, string>();
  private readonly idempotency = new Map<string, IdempotencyRecord>();
  private readonly rejections = new Map<string, string>();
  private readonly journal: JournalEntry[] = [];
  private replaying = false;

  constructor(
    private readonly sources: AdmissionSources,
    private readonly options: AdmissionSourceOptions = {},
  ) {}

  advanceClock(input: AdmissionClock): AdmissionCommandReceipt {
    const body = { nowAt: input.nowAt };
    return this.call("set_clock", "clock", input.idempotencyKey, body, () => null, (key, request) => {
      if (!this.replaying) {
        ident("clock");
      }
      const nowAt = readTime(input.nowAt);
      const next = Date.parse(nowAt);
      if (next < this.clockMs) {
        throw admissionError("CLOCK_REGRESSION");
      }
      this.clockMs = next;
      return this.accept(key, request, "set_clock", "clock", { nowAt }, null);
    });
  }

  adoptIssued(input: AdmissionAdopt): AdmissionCommandReceipt {
    const body = { reservationId: input.reservationId };
    return this.call(
      "adopt_issued",
      input.rightId,
      input.idempotencyKey,
      body,
      () => input.rightId,
      (key, request) => {
        const rightId = ident(input.rightId);
        const reservationId = ident(input.reservationId);
        if (this.credentials.has(rightId)) {
          throw admissionError("ILLEGAL_TRANSITION");
        }
        const reservation = this.readReservation(reservationId);
        if (reservation.phase === "CANCELLED") {
          throw admissionError("TICKET_CANCELLED");
        }
        if (reservation.phase === "CONSUMED" || reservation.issueStatus === "consumed") {
          throw admissionError("ALREADY_CONSUMED");
        }
        if (reservation.phase !== "ISSUED" || reservation.issueStatus !== "issued") {
          throw admissionError("TICKET_NOT_ISSUED");
        }
        if (reservation.issuanceId !== rightId && reservation.rightId !== rightId) {
          throw admissionError("UNKNOWN_RIGHT");
        }
        if (reservation.economicFinalityClaimed !== false || reservation.fundsExecuted !== false) {
          throw admissionError("SETTLEMENT_VIEW_REJECTED");
        }
        if (reservation.admissionRoutingProduction !== false) {
          throw admissionError("MOCK_INVARIANT");
        }
        const holderRole = ident(reservation.buyerRole);
        const credential: CredentialRecord = {
          rightId,
          reservationId,
          holderRole,
          phase: "ELIGIBLE",
          admissionId: null,
          gateRole: null,
          request: null,
          expiresAt: null,
          consumeId: null,
          versionAfter: null,
          lastKey: key,
          lastRejectCode: null,
          reconcileMatched: null,
        };
        this.credentials.set(rightId, credential);
        this.rejections.delete(rightId);
        return this.accept(key, request, "adopt_issued", rightId, { holderRole, reservationId }, rightId);
      },
    );
  }

  authorize(input: AdmissionAuthorize): AdmissionCommandReceipt {
    const body = {
      expiresAt: input.expiresAt,
      externalDependency: input.externalDependency ?? "",
      gateRole: input.gateRole,
      holderRole: input.holderRole,
      request: input.request,
      rightId: input.rightId,
      version: String(input.version),
    };
    return this.call(
      "authorize_admission",
      input.admissionId,
      input.idempotencyKey,
      body,
      () => input.rightId,
      (key, request) => {
        const admissionId = ident(input.admissionId);
        const rightId = ident(input.rightId);
        const holderRole = ident(input.holderRole);
        const gateRole = ident(input.gateRole);
        const ticketRequest = ident(input.request);
        const expiresAt = readTime(input.expiresAt);
        const version = readVersion(input.version);
        const dependency = this.externalLabel(input.externalDependency);
        const canon = canonicalJson({ admissionId, expiresAt, gateRole, holderRole, request: ticketRequest, rightId, version });
        const prior = this.admissions.get(admissionId);
        if (prior !== undefined) {
          if (prior !== canon) {
            throw admissionError("ADMISSION_BINDING_CONFLICT");
          }
          throw admissionError("ILLEGAL_TRANSITION");
        }
        const credential = this.requireCredential(rightId);
        this.assertExternal(dependency);
        const freshness = this.assess(credential, version, holderRole, "authorize_admission");
        if (!freshness.fresh) {
          throw admissionError(freshness.decision ?? "MOCK_INVARIANT");
        }
        if (credential.phase === "AUTHORIZED") {
          throw admissionError("ADMISSION_LOCKED");
        }
        if (credential.phase !== "ELIGIBLE") {
          throw admissionError("RIGHT_NOT_ACTIVE");
        }
        if (this.clockMs >= Date.parse(expiresAt)) {
          throw admissionError("ADMISSION_EXPIRED");
        }
        if (!this.replaying) {
          this.sources.authorizeReservation({
            admissionId,
            rightId,
            idempotencyKey: `admission-delegate:${key}`,
          });
        }
        credential.phase = "AUTHORIZED";
        credential.admissionId = admissionId;
        credential.gateRole = gateRole;
        credential.request = ticketRequest;
        credential.expiresAt = expiresAt;
        credential.lastKey = key;
        credential.lastRejectCode = null;
        this.admissions.set(admissionId, canon);
        return this.accept(
          key,
          request,
          "authorize_admission",
          admissionId,
          {
            expiresAt,
            gateRole,
            holderRole,
            request: ticketRequest,
            rightId,
            version: String(version),
          },
          rightId,
        );
      },
    );
  }

  consume(input: AdmissionConsume): AdmissionCommandReceipt {
    const body = {
      externalDependency: input.externalDependency ?? "",
      gateRole: input.gateRole,
      request: input.request,
      rightId: input.rightId,
      version: String(input.version),
    };
    return this.call(
      "consume",
      input.consumeId,
      input.idempotencyKey,
      body,
      () => input.rightId,
      (key, request) => {
        const consumeId = ident(input.consumeId);
        const rightId = ident(input.rightId);
        const gateRole = ident(input.gateRole);
        const ticketRequest = ident(input.request);
        const version = readVersion(input.version);
        const dependency = this.externalLabel(input.externalDependency);
        const canon = canonicalJson({ consumeId, gateRole, request: ticketRequest, rightId, version });
        const prior = this.consumes.get(consumeId);
        if (prior !== undefined) {
          if (prior !== canon) {
            throw admissionError("CONSUME_BINDING_CONFLICT");
          }
          throw admissionError("ILLEGAL_TRANSITION");
        }
        const credential = this.requireCredential(rightId);
        this.assertExternal(dependency);
        const freshness = this.assess(credential, version, credential.holderRole, "consume");
        if (!freshness.fresh) {
          throw admissionError(freshness.decision ?? "MOCK_INVARIANT");
        }
        if (credential.phase !== "AUTHORIZED" || credential.admissionId === null) {
          throw admissionError("ADMISSION_REQUIRED");
        }
        if (credential.gateRole !== gateRole) {
          throw admissionError("GATE_MISMATCH");
        }
        if (credential.request !== ticketRequest) {
          throw admissionError("ADMISSION_REQUEST_MISMATCH");
        }
        if (credential.expiresAt !== null && this.clockMs >= Date.parse(credential.expiresAt)) {
          throw admissionError("ADMISSION_EXPIRED");
        }
        if (!this.replaying) {
          this.sources.consumeReservation({
            consumeId,
            rightId,
            idempotencyKey: `admission-delegate:${key}`,
          });
        }
        credential.phase = "CONSUMED";
        credential.consumeId = consumeId;
        credential.admissionId = null;
        credential.versionAfter = 2;
        credential.lastKey = key;
        credential.lastRejectCode = null;
        this.consumes.set(consumeId, canon);
        return this.accept(
          key,
          request,
          "consume",
          consumeId,
          { gateRole, request: ticketRequest, rightId, version: String(version) },
          rightId,
        );
      },
    );
  }

  reconcile(input: AdmissionReconcile): AdmissionReconcileReceipt {
    return this.call(
      "reconcile",
      input.rightId,
      input.idempotencyKey,
      {},
      () => input.rightId,
      (key, request) => {
        const rightId = ident(input.rightId);
        this.requireCredential(rightId);
        const shadow = new AdmissionCaseStore(this.sources, this.options);
        shadow.replaying = true;
        for (const entry of this.journal) {
          shadow.replay(entry);
        }
        if (shadow.canonical() !== this.canonical()) {
          throw admissionError("MOCK_INVARIANT");
        }
        const credential = this.requireCredential(rightId);
        credential.reconcileMatched = true;
        credential.lastRejectCode = null;
        credential.lastKey = key;
        const receipt: AdmissionReconcileReceipt = {
          ...this.receipt(false, "reconcile", key, credential),
          applied: "reconcile",
          matched: true,
        };
        this.idempotency.set(key, { request, result: structuredClone(receipt), error: null });
        return structuredClone(receipt);
      },
    );
  }

  rejectExternal(kind: string): never {
    ident(kind);
    throw admissionError("EXTERNAL_UNSUPPORTED");
  }

  present(input: AdmissionPresentationQuery): AdmissionPresentation {
    const rightId = ident(input.rightId);
    const holderRole = ident(input.holderRole);
    const version = readVersion(input.version);
    const credential = this.credentials.get(rightId);
    if (!credential) {
      const decision = this.rejections.get(rightId) ?? "UNKNOWN_RIGHT";
      return this.presentation(rightId, version, holderRole, null, {
        fresh: false,
        decision,
        transferObserved: false,
      });
    }
    const freshness = this.safeAssess(credential, version, holderRole);
    return this.presentation(rightId, version, holderRole, credential.phase, freshness);
  }

  private safeAssess(credential: CredentialRecord, version: number, holderRole: string): Freshness {
    try {
      return this.assess(credential, version, holderRole, "authorize_admission");
    } catch (error) {
      if (error instanceof ProtocolError && error.code) {
        return { fresh: false, decision: error.code, transferObserved: false };
      }
      return { fresh: false, decision: "TICKET_SOURCE_UNAVAILABLE", transferObserved: false };
    }
  }

  private assess(
    credential: CredentialRecord,
    version: number,
    holderRole: string,
    command: "authorize_admission" | "consume",
  ): Freshness {
    if (this.options.ticketDown) {
      throw admissionError("TICKET_SOURCE_UNAVAILABLE");
    }
    this.assertExternal(null);
    if (credential.phase === "CONSUMED") {
      return { fresh: false, decision: "ALREADY_CONSUMED", transferObserved: false };
    }
    const ownership = this.readOwnership(credential.rightId);
    let transferObserved = false;
    if (ownership) {
      if (ownership.holderRole !== credential.holderRole || ownership.version !== 1) {
        transferObserved = true;
        return { fresh: false, decision: "STALE_VERSION", transferObserved };
      }
      if (ownership.activeListingId !== null) {
        return { fresh: false, decision: "LISTING_LOCKED", transferObserved: false };
      }
      const presentation = this.sources.viewResalePresentation({
        rightId: credential.rightId,
        version,
        holderRole,
      });
      if (
        presentation.matchesCurrentRight !== true ||
        presentation.venueCredentialReissued !== false ||
        presentation.admissionRoutingProduction !== false
      ) {
        return { fresh: false, decision: "CREDENTIAL_STALE", transferObserved: false };
      }
    }
    if (version !== 1) {
      return { fresh: false, decision: "STALE_VERSION", transferObserved: false };
    }
    if (holderRole !== credential.holderRole) {
      return { fresh: false, decision: "NOT_HOLDER", transferObserved: false };
    }
    const reservation = this.readReservation(credential.reservationId);
    if (reservation.phase === "CANCELLED") {
      return { fresh: false, decision: "TICKET_CANCELLED", transferObserved: false };
    }
    if (reservation.phase === "CONSUMED" || reservation.issueStatus === "consumed") {
      return { fresh: false, decision: "ALREADY_CONSUMED", transferObserved: false };
    }
    if (reservation.phase !== "ISSUED" && reservation.phase !== "ADMISSION_AUTHORIZED") {
      return { fresh: false, decision: "TICKET_NOT_ISSUED", transferObserved: false };
    }
    if (reservation.buyerRole !== holderRole) {
      return { fresh: false, decision: "NOT_HOLDER", transferObserved: false };
    }
    if (reservation.economicFinalityClaimed !== false || reservation.fundsExecuted !== false) {
      return { fresh: false, decision: "SETTLEMENT_VIEW_REJECTED", transferObserved: false };
    }
    if (reservation.admissionRoutingProduction !== false || reservation.externalAdmission !== "UNSUPPORTED") {
      throw admissionError("MOCK_INVARIANT");
    }
    this.assertSettlement(reservation);
    if (credential.phase === "AUTHORIZED" && credential.expiresAt !== null && this.clockMs >= Date.parse(credential.expiresAt)) {
      return { fresh: false, decision: "ADMISSION_EXPIRED", transferObserved: false };
    }
    if (command === "consume" && credential.phase !== "AUTHORIZED") {
      return { fresh: false, decision: "ADMISSION_REQUIRED", transferObserved: false };
    }
    return { fresh: true, decision: null, transferObserved: false };
  }

  private assertSettlement(reservation: ReservationCaseView): void {
    if (reservation.settlementId === null) {
      return;
    }
    let settlement: AdmissionSettlementView;
    try {
      settlement = this.sources.viewSettlement(reservation.settlementId);
    } catch (error) {
      if (error instanceof ProtocolError && error.code) {
        throw admissionError(error.code === "UNKNOWN_SETTLEMENT" ? "SETTLEMENT_SOURCE_REQUIRED" : error.code);
      }
      throw admissionError("SETTLEMENT_SOURCE_UNAVAILABLE");
    }
    if (
      settlement.fundsExecuted !== false ||
      settlement.economicFinalityClaimed !== false ||
      settlement.admissionGranted !== false
    ) {
      throw admissionError("SETTLEMENT_VIEW_REJECTED");
    }
  }

  private readReservation(reservationId: string): ReservationCaseView {
    if (this.options.ticketDown) {
      throw admissionError("TICKET_SOURCE_UNAVAILABLE");
    }
    try {
      return this.sources.viewReservation(reservationId);
    } catch (error) {
      if (error instanceof ProtocolError && error.code) {
        throw admissionError(error.code);
      }
      throw admissionError("TICKET_SOURCE_UNAVAILABLE");
    }
  }

  private readOwnership(rightId: string): ResaleRightView | null {
    if (this.options.ownershipDown) {
      throw admissionError("OWNERSHIP_SOURCE_UNAVAILABLE");
    }
    try {
      return this.sources.viewResaleRight(rightId);
    } catch (error) {
      if (error instanceof ProtocolError && error.code === "UNKNOWN_RIGHT") {
        return null;
      }
      if (error instanceof ProtocolError && error.code) {
        throw admissionError(error.code);
      }
      throw admissionError("OWNERSHIP_SOURCE_UNAVAILABLE");
    }
  }

  private assertExternal(dependency: string | null): void {
    if (this.options.venueConfigured) {
      throw admissionError("VENUE_SOURCE_UNAVAILABLE");
    }
    if (this.options.revocationConfigured) {
      throw admissionError("REVOCATION_SOURCE_UNAVAILABLE");
    }
    if (dependency === "VENUE_IDENTITY") {
      throw admissionError("VENUE_SOURCE_UNAVAILABLE");
    }
    if (dependency === "REVOCATION") {
      throw admissionError("REVOCATION_SOURCE_UNAVAILABLE");
    }
    if (dependency !== null) {
      throw admissionError("EXTERNAL_UNSUPPORTED");
    }
  }

  private externalLabel(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    if (typeof value !== "string") {
      throw admissionError("EXTERNAL_UNSUPPORTED");
    }
    return ident(value);
  }

  private requireCredential(rightId: string): CredentialRecord {
    const credential = this.credentials.get(rightId);
    if (!credential) {
      throw admissionError("UNKNOWN_RIGHT");
    }
    return credential;
  }

  private presentation(
    rightId: string,
    version: number,
    holderRole: string,
    phase: AdmissionPhase | null,
    freshness: Freshness,
  ): AdmissionPresentation {
    return admissionBoundaryPresentation({
      rightId,
      version,
      holderRole,
      decision: freshness.decision,
      fresh: freshness.fresh,
      transferObserved: freshness.transferObserved,
      phase,
      mode: "mock",
      lifecycleAuthority: "IN_MEMORY_FSM",
      note: ADMISSION_CASE_NOTE,
    });
  }

  private toView(credential: CredentialRecord): AdmissionCredentialView {
    const expired =
      credential.phase === "AUTHORIZED" &&
      credential.expiresAt !== null &&
      this.clockMs >= Date.parse(credential.expiresAt);
    return {
      mode: "mock",
      surface: SURFACES.admissionFsm,
      admissionReference: RESERVATION_ADMISSION_REFERENCE,
      provenance: RESERVATION_PROVENANCE,
      lifecycleAuthority: "IN_MEMORY_FSM",
      rightId: credential.rightId,
      reservationId: credential.reservationId,
      phase: credential.phase,
      terminal: credential.phase === "CONSUMED",
      holderRole: credential.holderRole,
      version: credential.phase === "CONSUMED" ? 2 : 1,
      admissionId: credential.admissionId,
      consumeId: credential.consumeId,
      gateRole: credential.gateRole,
      admissionExpired: expired,
      offlineAdmission: false,
      venueCredentialReissued: false,
      admissionRoutingProduction: false,
      externalAdmission: "UNSUPPORTED",
      economicFinalityClaimed: false,
      fundsExecuted: false,
      logicalTimeMs: this.clockMs,
      idempotencyKey: credential.lastKey,
      lastRejectCode: credential.lastRejectCode,
      reconcileMatched: credential.reconcileMatched,
      note: ADMISSION_CASE_NOTE,
    };
  }

  private receipt(
    duplicate: boolean,
    applied: AdmissionLifecycleCommand | null,
    key: string,
    credential: CredentialRecord | null,
  ): AdmissionCommandReceipt {
    const view = credential ? this.toView(credential) : null;
    const presentation = credential
      ? this.present({
          rightId: credential.rightId,
          version: view?.version ?? 1,
          holderRole: credential.holderRole,
        })
      : admissionBoundaryPresentation({
          rightId: "",
          version: 0,
          holderRole: "",
          decision: "UNKNOWN_RIGHT",
          fresh: false,
          transferObserved: false,
          phase: null,
          mode: "mock",
          lifecycleAuthority: "IN_MEMORY_FSM",
          note: ADMISSION_CASE_NOTE,
        });
    return {
      duplicate,
      applied,
      provenance: RESERVATION_PROVENANCE,
      lifecycleAuthority: "IN_MEMORY_FSM",
      offlineAdmission: false,
      venueCredentialReissued: false,
      admissionRoutingProduction: false,
      externalAdmission: "UNSUPPORTED",
      economicFinalityClaimed: false,
      fundsExecuted: false,
      idempotencyKey: key,
      logicalTimeMs: this.clockMs,
      credential: view,
      presentation,
    };
  }

  private accept(
    key: string,
    request: string,
    op: JournalOp,
    subjectId: string,
    journalBody: Record<string, string>,
    rightId: string | null,
  ): AdmissionCommandReceipt {
    this.journal.push({ op, idempotencyKey: key, subjectId, body: { ...journalBody } });
    const credential = rightId === null ? null : this.requireCredential(rightId);
    const receipt = this.receipt(false, op, key, credential);
    this.idempotency.set(key, { request, result: structuredClone(receipt), error: null });
    return structuredClone(receipt);
  }

  private call<T extends AdmissionCommandReceipt>(
    op: AdmissionLifecycleCommand,
    subjectId: string,
    idempotencyKey: string,
    body: Record<string, string>,
    rightIdOf: () => string | null,
    execute: (key: string, request: string) => T,
  ): T {
    const key = ident(idempotencyKey);
    const normalizedSubject = op === "set_clock" ? "clock" : ident(subjectId);
    const request = canonicalJson({ body, op, subjectId: normalizedSubject });
    const prior = this.idempotency.get(key);
    if (prior) {
      if (prior.request !== request) {
        this.noteReject(rightIdOf(), "IDEMPOTENCY_CONFLICT");
        throw admissionError("IDEMPOTENCY_CONFLICT");
      }
      if (prior.error !== null) {
        this.noteReject(rightIdOf(), prior.error);
        throw admissionError(prior.error);
      }
      if (prior.result === null) {
        throw admissionError("MOCK_INVARIANT");
      }
      const replay = structuredClone(prior.result) as T;
      replay.duplicate = true;
      replay.applied = null;
      replay.admissionRoutingProduction = false;
      replay.externalAdmission = "UNSUPPORTED";
      replay.offlineAdmission = false;
      replay.venueCredentialReissued = false;
      replay.economicFinalityClaimed = false;
      replay.fundsExecuted = false;
      replay.presentation.admissionRoutingProduction = false;
      replay.presentation.externalAdmission = "UNSUPPORTED";
      replay.presentation.offlineAdmission = false;
      replay.presentation.venueCredentialReissued = false;
      replay.presentation.economicFinalityClaimed = false;
      replay.presentation.fundsExecuted = false;
      if (replay.credential) {
        replay.credential.admissionRoutingProduction = false;
        replay.credential.externalAdmission = "UNSUPPORTED";
        replay.credential.offlineAdmission = false;
        replay.credential.venueCredentialReissued = false;
        replay.credential.economicFinalityClaimed = false;
        replay.credential.fundsExecuted = false;
      }
      return replay;
    }
    try {
      return execute(key, request);
    } catch (error) {
      if (error instanceof ProtocolError && error.code && !UNSTORED_REJECTION.has(error.code) && !this.idempotency.has(key)) {
        this.idempotency.set(key, { request, result: null, error: error.code });
        this.noteReject(rightIdOf(), error.code);
      }
      throw error;
    }
  }

  private noteReject(rightId: string | null, code: string): void {
    if (rightId === null) {
      return;
    }
    let id: string;
    try {
      id = ident(rightId);
    } catch {
      return;
    }
    const credential = this.credentials.get(id);
    if (credential) {
      credential.lastRejectCode = code;
      return;
    }
    this.rejections.set(id, code);
  }

  private replay(entry: JournalEntry): void {
    if (!isJournalOp(entry.op) || !isRecord(entry.body)) {
      throw admissionError("INVALID_JOURNAL");
    }
    switch (entry.op) {
      case "set_clock": {
        const nowAt = readTime(entry.body.nowAt ?? "");
        const next = Date.parse(nowAt);
        if (next < this.clockMs) {
          throw admissionError("CLOCK_REGRESSION");
        }
        this.clockMs = next;
        break;
      }
      case "adopt_issued":
        this.replayAdopt(entry);
        break;
      case "authorize_admission":
        this.replayAuthorize(entry);
        break;
      case "consume":
        this.replayConsume(entry);
        break;
      default:
        throw admissionError("INVALID_JOURNAL");
    }
    this.journal.push({
      op: entry.op,
      idempotencyKey: entry.idempotencyKey,
      subjectId: entry.subjectId,
      body: { ...entry.body },
    });
  }

  private replayAdopt(entry: JournalEntry): void {
    const rightId = ident(entry.subjectId);
    const reservationId = ident(entry.body.reservationId ?? "");
    const holderRole = ident(entry.body.holderRole ?? "");
    this.credentials.set(rightId, {
      rightId,
      reservationId,
      holderRole,
      phase: "ELIGIBLE",
      admissionId: null,
      gateRole: null,
      request: null,
      expiresAt: null,
      consumeId: null,
      versionAfter: null,
      lastKey: entry.idempotencyKey,
      lastRejectCode: null,
      reconcileMatched: null,
    });
  }

  private replayAuthorize(entry: JournalEntry): void {
    const credential = this.requireCredential(ident(entry.body.rightId ?? ""));
    credential.phase = "AUTHORIZED";
    credential.admissionId = ident(entry.subjectId);
    credential.gateRole = ident(entry.body.gateRole ?? "");
    credential.request = ident(entry.body.request ?? "");
    credential.expiresAt = readTime(entry.body.expiresAt ?? "");
    credential.lastKey = entry.idempotencyKey;
    this.admissions.set(credential.admissionId, "replay");
  }

  private replayConsume(entry: JournalEntry): void {
    const credential = this.requireCredential(ident(entry.body.rightId ?? ""));
    credential.phase = "CONSUMED";
    credential.consumeId = ident(entry.subjectId);
    credential.admissionId = null;
    credential.versionAfter = 2;
    credential.lastKey = entry.idempotencyKey;
    this.consumes.set(credential.consumeId, "replay");
  }

  private canonical(): string {
    const credentials = [...this.credentials.keys()].sort().map((rightId) => {
      const credential = this.credentials.get(rightId);
      if (!credential) {
        throw admissionError("MOCK_INVARIANT");
      }
      return {
        admissionId: credential.admissionId,
        consumeId: credential.consumeId,
        expiresAt: credential.expiresAt,
        gateRole: credential.gateRole,
        holderRole: credential.holderRole,
        phase: credential.phase,
        request: credential.request,
        reservationId: credential.reservationId,
        rightId: credential.rightId,
        versionAfter: credential.versionAfter,
      };
    });
    return canonicalJson({
      credentials,
      journal: this.journal,
      logicalTimeMs: this.clockMs,
    });
  }
}

function admissionError(code: string): ProtocolError {
  return new ProtocolError(`${code}: mock admission credential rejected.`, code);
}

function ident(value: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 100 || value.trim() !== value || value.includes(",")) {
    throw admissionError("INVALID_ID");
  }
  return value;
}

function readTime(value: string): string {
  const time = ident(value);
  if (!Number.isFinite(Date.parse(time))) {
    throw admissionError("INVALID_ID");
  }
  return time;
}

function readVersion(value: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1_000_000_000_000) {
    throw admissionError("STALE_VERSION");
  }
  return value;
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
