import { sweepExport } from "./receipt-redaction";
export { sweepExport } from "./receipt-redaction";
import { messages as sourceCopy } from "./i18n/messages/receipt-explorer";
import { sourceMessage } from "./i18n/source-message";
import { useEffect, useSyncExternalStore } from "react";
import {
  CONSENT_NOT_COMPOSED,
  GIFT_NOT_COMPOSED,
  JOURNEY_NOT_COMPOSED,
  OPENAPI_CONTRACT_PIN,
  OPENAPI_INTEGRATION_GATE_PIN,
  ORGANIZER_NOT_COMPOSED,
  PINNED_PROTOCOL_DOMAIN,
  mapOperationalError,
} from "@kix/protocol-adapter";
import { consentDesk, type ConsentDeskSnapshot } from "./consent-desk";
import { giftDesk, type GiftDeskSnapshot } from "./gift-desk";
import { journeyDesk, type JourneyDeskSnapshot } from "./journey-desk";
import { organizerDesk, type OrganizerDeskSnapshot } from "./organizer-desk";
import { protocol } from "./connectivity/desk-protocol";
import {
  PLACE_HOLD_RECORD,
  TRACK_STATE_CONTRACT,
  WORKSPACE_RULING,
  type TrackState,
  type WorkspaceRole,
} from "./workspace/registry";

/**
 * Read-only explanation of receipts already on this page load.
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 * A reload clears page-load desks and this module's session id. This module does not send.
 */

export const RECEIPT_RULING = WORKSPACE_RULING;

export const RECEIPT_STUB_SENTENCE = sourceCopy.en["s1n0"];

export const RECEIPT_READ_NOTE = sourceCopy.en["s23e"];

export const RECEIPT_SESSION_NOTE = sourceCopy.en["s6g"];

export const RECEIPT_RELOAD_NOTE =
  sourceCopy.en["s6v"];

export const RECEIPT_CONTEXTS = ["journey", "gift", "consent", "organizer", "transport"] as const;

export type ReceiptContext = (typeof RECEIPT_CONTEXTS)[number];

export const RECEIPT_SOURCES = ["stub-shape", "integration-gate", "mock-case", "none"] as const;

export type ReceiptSource = (typeof RECEIPT_SOURCES)[number];

export const RECEIPT_PROFILES = ["contract-only", "integration-gate", "none"] as const;

export type ReceiptProfile = (typeof RECEIPT_PROFILES)[number];

export const RECEIPT_REJECT_REASONS = ["MALFORMED", "DIFFERENT_ACTOR", "DIFFERENT_CONTEXT"] as const;

export type ReceiptRejectReason = (typeof RECEIPT_REJECT_REASONS)[number];

const KNOWN_ACTORS = new Set([
  "desk-buyer",
  "desk-donor",
  "desk-recipient",
  "desk-organizer",
  "operator",
  "marketing-adapter",
  "adapter",
  "unassigned",
]);

const ROLE_ACTORS: Record<WorkspaceRole, readonly string[]> = {
  buyer: ["desk-buyer", "desk-donor", "desk-recipient", "operator", "marketing-adapter", "adapter", "unassigned"],
  organizer: ["operator", "desk-organizer", "adapter", "unassigned"],
  operator: [
    "desk-buyer",
    "desk-donor",
    "desk-recipient",
    "operator",
    "desk-organizer",
    "marketing-adapter",
    "adapter",
    "unassigned",
  ],
};

const ROLE_CONTEXTS: Record<WorkspaceRole, readonly ReceiptContext[]> = {
  buyer: ["journey", "gift", "consent", "transport"],
  organizer: ["organizer", "transport"],
  operator: RECEIPT_CONTEXTS,
};

const CANDIDATE_KEYS = [
  "sessionId",
  "role",
  "actor",
  "context",
  "domain",
  "action",
  "operationId",
  "status",
  "source",
  "profile",
  "profileVersion",
  "code",
  "requestId",
  "correlationId",
  "refId",
  "sequence",
  "note",
  "fields",
] as const;

const DENY_FIELD_KEYS = new Set([
  "token",
  "secret",
  "password",
  "authorization",
  "account",
  "accountnumber",
  "iban",
  "card",
  "pan",
  "cvv",
  "ssn",
  "kyc",
  "signature",
  "privatekey",
  "cookie",
  "email",
  "phone",
  "name",
  "holdername",
  "legalname",
  "fullname",
  "amount",
  "currency",
  "paymentid",
  "primaryprice",
  "resalecap",
  "primaryfeebps",
  "resalefeebps",
  "resaleorganizerbps",
  "refundprofile",
  "idempotencykey",
  "bearer",
  "credential",
]);

const ALLOWED_NOTES = new Set<string>([
  sourceCopy.en["sdk"],
  sourceCopy.en["sdj"],
  sourceCopy.en["s253"],
  sourceCopy.en["saa"],
  sourceCopy.en["snx"],
  sourceCopy.en["s250"],
  sourceCopy.en["s1d1"],
  sourceCopy.en["s268"],
  sourceCopy.en["s23u"],
  sourceCopy.en["s12l"],
]);

const ROLES = new Set<WorkspaceRole>(["buyer", "organizer", "operator"]);

const CONTEXT_SET = new Set<string>(RECEIPT_CONTEXTS);

const SOURCE_SET = new Set<string>(RECEIPT_SOURCES);

const PROFILE_SET = new Set<string>(RECEIPT_PROFILES);

const STATUS_SET = new Set<string>(Object.keys(TRACK_STATE_CONTRACT));

export interface ReceiptScreen {
  sessionId: string;
  role: WorkspaceRole;
  actors: readonly string[];
  contexts: readonly ReceiptContext[];
  domain: string;
}

export interface ReceiptField {
  key: string;
  value: string;
}

export interface KeptReceipt {
  sessionId: string;
  role: WorkspaceRole;
  actorLabel: string;
  context: ReceiptContext;
  domain: string;
  action: string;
  operationId: string | null;
  status: TrackState;
  source: ReceiptSource;
  profile: ReceiptProfile;
  profileVersion: string;
  code: string | null;
  codeClass: "none" | "degraded" | "unavailable" | "rejected";
  requestId: string | null;
  correlationId: string | null;
  refId: string;
  sequence: number;
  note: string;
  fields: readonly ReceiptField[];
  omittedFieldCount: number;
}

export type ConsiderResult =
  | { kind: "kept"; receipt: KeptReceipt }
  | { kind: "rejected"; reason: ReceiptRejectReason; action: string | null; operationId: string | null }
  | { kind: "dropped"; reason: "DIFFERENT_SESSION" };

export interface ReceiptExplanation {
  status: TrackState;
  confirmed: boolean;
  unconfirmed: boolean;
  meaning: string;
  unconfirmedReason: string | null;
  nextAction: string;
}

export interface ReceiptEntry {
  id: string;
  role: WorkspaceRole;
  context: ReceiptContext;
  refId: string;
  action: string;
  operationId: string | null;
  status: TrackState;
  source: ReceiptSource;
  profile: ReceiptProfile;
  profileVersion: string;
  code: string | null;
  codeClass: KeptReceipt["codeClass"];
  requestId: string | null;
  correlationId: string | null;
  actorLabel: string;
  note: string;
  meaning: string;
  unconfirmedReason: string | null;
  nextAction: string;
  fields: readonly ReceiptField[];
  deskHref: string | null;
  confirmed: boolean;
  sequence: number;
  omittedFieldCount: number;
}

export interface ReceiptGroup {
  id: string;
  context: ReceiptContext;
  refId: string;
  heading: string;
  lastConfirmed: string;
  unconfirmed: string;
  entries: readonly ReceiptEntry[];
}

export interface ReceiptQuarantine {
  reason: ReceiptRejectReason;
  action: string | null;
  operationId: string | null;
}

export interface RecordedNotSent {
  sender: string;
  action: string;
  reason: string;
}

export interface ReceiptDiagnostic {
  kind: "support-diagnostic";
  sessionId: string;
  role: WorkspaceRole;
  mode: "stub" | "integration-http";
  profile: ReceiptProfile;
  profileVersion: string;
  domain: string;
  productionReadiness: false;
  productionConformance: false;
  protocolTruth: false;
  publicDeploy: false;
  retry: false;
  fallbackToStub: false;
  readConfirmsUnknown: false;
  entries: readonly {
    operationId: string | null;
    action: string;
    status: TrackState;
    source: ReceiptSource;
    profile: ReceiptProfile;
    profileVersion: string;
    code: string | null;
    codeClass: KeptReceipt["codeClass"];
    unconfirmedReason: string | null;
    nextAction: string;
    requestId: string | null;
    correlationId: string | null;
    refId: string;
    actorLabel: string;
    context: ReceiptContext;
    fields: readonly ReceiptField[];
  }[];
  quarantine: readonly ReceiptQuarantine[];
  recordedNotSent: readonly { sender: string; action: string; reason: string }[];
  omittedFieldCount: number;
  note: string;
}

export interface ReceiptExplorerModel {
  sessionId: string;
  role: WorkspaceRole;
  environment: "stub" | "integration-http";
  profile: ReceiptProfile;
  profileVersion: string;
  domain: string;
  ruling: string;
  stubSentence: string;
  readNote: string;
  sessionNote: string;
  reloadNote: string;
  groups: readonly ReceiptGroup[];
  paths: readonly ReceiptEntry[];
  quarantine: readonly ReceiptQuarantine[];
  recorded: readonly RecordedNotSent[];
  placeHold: { method: string; consideredAction: string; reason: string; mappedOntoPrepareTrade: false };
  diagnostic: ReceiptDiagnostic;
  exportText: string;
  sessionDropped: number;
}

interface ParsedCandidate {
  sessionId: string;
  role: WorkspaceRole;
  actor: string;
  context: ReceiptContext;
  domain: string;
  action: string;
  operationId: string | null;
  status: TrackState;
  source: ReceiptSource;
  profile: ReceiptProfile;
  profileVersion: string;
  code: string | null;
  requestId: string | null;
  correlationId: string | null;
  refId: string;
  sequence: number;
  note: string;
  fields: readonly { key: string; value: string }[];
}

interface DeskRow {
  step: string;
  status: string;
  operationId: string | null;
  actor: string | null;
  code: string | null;
  requestId: string | null;
  correlationId: string | null;
  receipt: readonly { key: string; value: string }[] | null;
  note: string;
}

interface DeskFlow {
  refId: string;
  rows: readonly DeskRow[];
}

type DeskPath =
  | { kind: "available-stub-shape" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "unavailable"; code: string | null; detail: string };

function mintSessionId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `page:${hex}`;
}

/** One id for this page load. A reload evaluates this module again. */
export const pageSessionId = mintSessionId();

export function profileFor(source: ReceiptSource): { profile: ReceiptProfile; profileVersion: string } {
  if (source === "integration-gate") {
    return { profile: "integration-gate", profileVersion: OPENAPI_INTEGRATION_GATE_PIN.infoVersion };
  }
  if (source === "stub-shape") {
    return { profile: "contract-only", profileVersion: OPENAPI_CONTRACT_PIN.infoVersion };
  }
  return { profile: "none", profileVersion: "none" };
}

function screenProfile(environment: "stub" | "integration-http"): { profile: ReceiptProfile; profileVersion: string } {
  if (environment === "integration-http") {
    return profileFor("integration-gate");
  }
  return profileFor("stub-shape");
}

function isPlain(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

export function looksSensitive(value: string): boolean {
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)) {
    return true;
  }
  if (/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/.test(value)) {
    return true;
  }
  if (/\d{12,19}/.test(value)) {
    return true;
  }
  if (/(?:^|[^A-Za-z0-9])(?:sk|pk|rk|tok|api)_[A-Za-z0-9_-]{6,}/i.test(value)) {
    return true;
  }
  if (/bearer\s+[A-Za-z0-9._~+/=-]{8,}/i.test(value)) {
    return true;
  }
  if (/eyJ[A-Za-z0-9_-]{10,}/.test(value)) {
    return true;
  }
  if (/\+\d{8,15}\b/.test(value)) {
    return true;
  }
  return false;
}

function publicToken(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  if (value.length < 1 || value.length > 100 || looksSensitive(value)) {
    return null;
  }
  if (!/^[A-Za-z0-9:_\-.]{1,100}$/.test(value)) {
    return null;
  }
  return value;
}

function publicAction(value: string | null): string | null {
  if (value === null || looksSensitive(value) || !/^[a-z][a-z0-9_]{0,63}$/.test(value)) {
    return null;
  }
  return value;
}

export function publicActor(actor: string): string {
  if (KNOWN_ACTORS.has(actor)) {
    return actor;
  }
  if (looksSensitive(actor) || !/^[a-z0-9][a-z0-9_-]{0,32}$/.test(actor)) {
    return "[redacted-actor]";
  }
  return actor;
}

function publicNote(note: string): string {
  if (note.length === 0) {
    return "";
  }
  if (ALLOWED_NOTES.has(note)) {
    return note;
  }
  if (/^Rejected by the gate \([A-Z0-9_]{1,64}\)\.$/.test(note)) {
    return note;
  }
  if (note.startsWith(sourceCopy.en["s12l"])) {
    return sourceCopy.en["s12l"];
  }
  return "[redacted-note]";
}

function denyFieldKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return DENY_FIELD_KEYS.has(normalized);
}

function publicFieldValue(value: string): string {
  if (value.length < 1 || value.length > 200 || looksSensitive(value)) {
    return "[redacted]";
  }
  if (!/^[A-Za-z0-9:_\-.,[\]"]{1,200}$/.test(value)) {
    return "[redacted]";
  }
  return value;
}

function publicFields(fields: readonly { key: string; value: string }[]): {
  fields: ReceiptField[];
  omittedFieldCount: number;
} {
  const kept: ReceiptField[] = [];
  let omittedFieldCount = 0;
  for (const field of fields) {
    if (denyFieldKey(field.key) || !/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(field.key)) {
      omittedFieldCount += 1;
      continue;
    }
    kept.push({ key: field.key, value: publicFieldValue(field.value) });
  }
  return { fields: kept, omittedFieldCount };
}

function peekToken(value: unknown, key: "action" | "operationId"): string | null {
  if (!isPlain(value)) {
    return null;
  }
  const raw = value[key];
  if (typeof raw !== "string") {
    return null;
  }
  return key === "action" ? publicAction(raw) : publicToken(raw);
}

function codeClassOf(code: string | null): KeptReceipt["codeClass"] {
  if (code === null) {
    return "none";
  }
  return mapOperationalError(code).state;
}

/**
 * Status is copied from the candidate. An unknown candidate stays unknown.
 * Field text does not promote it.
 */
export function considerReceipt(screen: ReceiptScreen, raw: unknown): ConsiderResult {
  const parsed = parseCandidate(raw);
  if (parsed === null) {
    return {
      kind: "rejected",
      reason: "MALFORMED",
      action: peekToken(raw, "action"),
      operationId: peekToken(raw, "operationId"),
    };
  }
  if (parsed.sessionId !== screen.sessionId) {
    return { kind: "dropped", reason: "DIFFERENT_SESSION" };
  }
  const contextOk = screen.contexts.includes(parsed.context);
  const roleOk = screen.role === "operator" || screen.role === parsed.role;
  if (parsed.domain !== screen.domain || !contextOk || !roleOk) {
    return {
      kind: "rejected",
      reason: "DIFFERENT_CONTEXT",
      action: publicAction(parsed.action),
      operationId: publicToken(parsed.operationId),
    };
  }
  if (!screen.actors.includes(parsed.actor)) {
    return {
      kind: "rejected",
      reason: "DIFFERENT_ACTOR",
      action: publicAction(parsed.action),
      operationId: publicToken(parsed.operationId),
    };
  }
  return { kind: "kept", receipt: publishReceipt(parsed) };
}

function parseCandidate(raw: unknown): ParsedCandidate | null {
  if (!isPlain(raw) || !sameKeys(raw, CANDIDATE_KEYS)) {
    return null;
  }
  if (typeof raw.sessionId !== "string" || !/^[A-Za-z0-9:_-]{1,80}$/.test(raw.sessionId)) {
    return null;
  }
  if (typeof raw.role !== "string" || !ROLES.has(raw.role as WorkspaceRole)) {
    return null;
  }
  // Intentionally rejects control characters in the actor string.
  // eslint-disable-next-line no-control-regex
  if (typeof raw.actor !== "string" || raw.actor.length < 1 || raw.actor.length > 80 || /[\u0000-\u001f]/.test(raw.actor)) {
    return null;
  }
  if (typeof raw.context !== "string" || !CONTEXT_SET.has(raw.context)) {
    return null;
  }
  if (typeof raw.domain !== "string" || raw.domain.length < 1 || raw.domain.length > 80) {
    return null;
  }
  if (typeof raw.action !== "string" || publicAction(raw.action) === null) {
    return null;
  }
  if (raw.operationId !== null && publicToken(typeof raw.operationId === "string" ? raw.operationId : null) === null) {
    return null;
  }
  if (typeof raw.operationId === "string" && publicToken(raw.operationId) !== raw.operationId) {
    return null;
  }
  if (typeof raw.status !== "string" || !STATUS_SET.has(raw.status)) {
    return null;
  }
  if (typeof raw.source !== "string" || !SOURCE_SET.has(raw.source)) {
    return null;
  }
  if (typeof raw.profile !== "string" || !PROFILE_SET.has(raw.profile)) {
    return null;
  }
  if (typeof raw.profileVersion !== "string" || raw.profileVersion.length < 1 || raw.profileVersion.length > 200) {
    return null;
  }
  const paired = profileFor(raw.source as ReceiptSource);
  if (raw.profile !== paired.profile || raw.profileVersion !== paired.profileVersion) {
    return null;
  }
  if (raw.code !== null && (typeof raw.code !== "string" || !/^[A-Z0-9_]{1,64}$/.test(raw.code) || looksSensitive(raw.code))) {
    return null;
  }
  if (!optionalToken(raw.requestId) || !optionalToken(raw.correlationId)) {
    return null;
  }
  if (typeof raw.refId !== "string" || publicToken(raw.refId) !== raw.refId) {
    return null;
  }
  if (typeof raw.sequence !== "number" || !Number.isInteger(raw.sequence) || raw.sequence < 0 || raw.sequence > 100000) {
    return null;
  }
  if (typeof raw.note !== "string" || raw.note.length > 500) {
    return null;
  }
  if (!Array.isArray(raw.fields) || raw.fields.length > 24) {
    return null;
  }
  const fields: { key: string; value: string }[] = [];
  for (const field of raw.fields) {
    if (!isPlain(field) || !sameKeys(field, ["key", "value"])) {
      return null;
    }
    if (typeof field.key !== "string" || typeof field.value !== "string") {
      return null;
    }
    if (field.key.length < 1 || field.key.length > 40 || field.value.length > 500) {
      return null;
    }
    fields.push({ key: field.key, value: field.value });
  }
  return {
    sessionId: raw.sessionId,
    role: raw.role as WorkspaceRole,
    actor: raw.actor,
    context: raw.context as ReceiptContext,
    domain: raw.domain,
    action: raw.action,
    operationId: typeof raw.operationId === "string" ? raw.operationId : null,
    status: raw.status as TrackState,
    source: raw.source as ReceiptSource,
    profile: raw.profile as ReceiptProfile,
    profileVersion: raw.profileVersion,
    code: typeof raw.code === "string" ? raw.code : null,
    requestId: typeof raw.requestId === "string" ? raw.requestId : null,
    correlationId: typeof raw.correlationId === "string" ? raw.correlationId : null,
    refId: raw.refId,
    sequence: raw.sequence,
    note: raw.note,
    fields,
  };
}

function optionalToken(value: unknown): boolean {
  if (value === null) {
    return true;
  }
  return typeof value === "string" && publicToken(value) === value;
}

function publishReceipt(parsed: ParsedCandidate): KeptReceipt {
  const fields = publicFields(parsed.fields);
  const refId = publicToken(parsed.refId) ?? "redacted-ref";
  return {
    sessionId: parsed.sessionId,
    role: parsed.role,
    actorLabel: publicActor(parsed.actor),
    context: parsed.context,
    domain: PINNED_PROTOCOL_DOMAIN,
    action: parsed.action,
    operationId: publicToken(parsed.operationId),
    status: parsed.status,
    source: parsed.source,
    profile: parsed.profile,
    profileVersion: parsed.profileVersion,
    code: parsed.code,
    codeClass: codeClassOf(parsed.code),
    requestId: publicToken(parsed.requestId),
    correlationId: publicToken(parsed.correlationId),
    refId,
    sequence: parsed.sequence,
    note: publicNote(parsed.note),
    fields: fields.fields,
    omittedFieldCount: fields.omittedFieldCount,
  };
}

/** Pure explanation. The input status is the result status. */
export function explainReceipt(receipt: KeptReceipt): ReceiptExplanation {
  const status = receipt.status;
  const contract = TRACK_STATE_CONTRACT[status];
  const codeBit = receipt.code ? sourceMessage(sourceCopy.en["p.t400"], { v1: receipt.code, v2: receipt.action }) : sourceMessage(sourceCopy.en["p.t570"], { v1: receipt.action });
  const confirmed = status === "confirmed";
  const unconfirmed = status === "unknown";
  if (unconfirmed) {
    const stale =
      receipt.code === "STALE_RESPONSE"
        ? " The response trace does not match. A stale response does not update this attempt."
        : "";
    return {
      status,
      confirmed: false,
      unconfirmed: true,
      meaning: sourceMessage(sourceCopy.en["p.t401"], { v1: contract.copy, v2: codeBit, v3: stale }),
      unconfirmedReason: sourceMessage(sourceCopy.en["p.t402"], { v1: receipt.action, v2: receipt.code ? ` Code ${receipt.code}.` : "" }),
      nextAction: sourceCopy.en["sqm"],
    };
  }
  if (status === "stale") {
    return {
      status,
      confirmed: false,
      unconfirmed: false,
      meaning: sourceMessage(sourceCopy.en["p.t403"], { v1: contract.copy, v2: codeBit }),
      unconfirmedReason: null,
      nextAction: sourceCopy.en["sh6"],
    };
  }
  if (confirmed) {
    return {
      status,
      confirmed,
      unconfirmed: false,
      meaning: sourceMessage(sourceCopy.en["p.t572"], { v1: contract.copy, v2: receipt.action }),
      unconfirmedReason: null,
      nextAction: sourceCopy.en["s23f"],
    };
  }
  if (status === "rejected") {
    return {
      status,
      confirmed: false,
      unconfirmed: false,
      meaning: `${contract.copy}${codeBit}`,
      unconfirmedReason: null,
      nextAction: sourceCopy.en["s1ww"],
    };
  }
  if (status === "in-flight") {
    return {
      status,
      confirmed: false,
      unconfirmed: false,
      meaning: sourceMessage(sourceCopy.en["p.t572"], { v1: contract.copy, v2: receipt.action }),
      unconfirmedReason: null,
      nextAction: sourceCopy.en["s145"],
    };
  }
  if (status === "loading") {
    return {
      status,
      confirmed: false,
      unconfirmed: false,
      meaning: sourceMessage(sourceCopy.en["p.t404"], { v1: contract.copy }),
      unconfirmedReason: null,
      nextAction: sourceCopy.en["s264"],
    };
  }
  if (status === "unavailable") {
    const degraded = receipt.codeClass === "degraded" ? " The gate is degraded." : "";
    return {
      status,
      confirmed: false,
      unconfirmed: false,
      meaning: sourceMessage(sourceCopy.en["p.t405"], { v1: contract.copy, v2: codeBit, v3: degraded }),
      unconfirmedReason: null,
      nextAction: sourceCopy.en["s1rm"],
    };
  }
  if (status === "not-sent") {
    return {
      status,
      confirmed: false,
      unconfirmed: false,
      meaning: `${contract.copy}${codeBit}`,
      unconfirmedReason: null,
      nextAction: sourceCopy.en["s11l"],
    };
  }
  if (status === "fenced") {
    return {
      status,
      confirmed: false,
      unconfirmed: false,
      meaning: `${contract.copy}${codeBit}`,
      unconfirmedReason: null,
      nextAction: sourceCopy.en["s2k"],
    };
  }
  if (status === "not-bound") {
    return {
      status,
      confirmed: false,
      unconfirmed: false,
      meaning: sourceMessage(sourceCopy.en["p.t572"], { v1: contract.copy, v2: receipt.action }),
      unconfirmedReason: null,
      nextAction: sourceCopy.en["s1rr"],
    };
  }
  if (status === "error") {
    return {
      status,
      confirmed: false,
      unconfirmed: false,
      meaning: contract.copy,
      unconfirmedReason: null,
      nextAction: sourceCopy.en["s238"],
    };
  }
  return {
    status,
    confirmed: false,
    unconfirmed: false,
    meaning: contract.copy,
    unconfirmedReason: null,
    nextAction: sourceCopy.en["s8k"],
  };
}

function mapDeskStatus(status: string, receipt: DeskRow["receipt"]): TrackState | null {
  if (status === "confirmed") {
    return receipt !== null ? "confirmed" : "unknown";
  }
  if (status === "unconfirmed") {
    return "unknown";
  }
  if (status === "blocked") {
    return "fenced";
  }
  if (status === "rejected" || status === "not-sent" || status === "in-flight" || status === "unavailable") {
    return status;
  }
  return null;
}

function safeCode(code: string | null): string | null {
  if (code === null || !/^[A-Z0-9_]{1,64}$/.test(code) || looksSensitive(code)) {
    return null;
  }
  return code;
}

function projectRow(
  evidenceSessionId: string,
  role: "buyer" | "organizer",
  context: Exclude<ReceiptContext, "transport">,
  source: ReceiptSource,
  refId: string,
  row: DeskRow,
  sequence: number,
): unknown | null {
  const status = mapDeskStatus(row.status, row.receipt);
  if (status === null) {
    return null;
  }
  const paired = profileFor(source);
  const publicRef = publicToken(refId) ?? "redacted-ref";
  const operationId = publicToken(row.operationId);
  const note =
    row.status === "confirmed" && row.receipt === null
      ? sourceCopy.en["s253"]
      : row.note;
  const fields = (row.receipt ?? []).slice(0, 24).map((field) => ({
    key: field.key.slice(0, 40),
    value: field.value.length > 500 ? "[redacted]" : field.value,
  }));
  return {
    sessionId: evidenceSessionId,
    role,
    actor: row.actor && row.actor.length > 0 ? row.actor : "unassigned",
    context,
    domain: PINNED_PROTOCOL_DOMAIN,
    action: row.step,
    operationId,
    status,
    source,
    profile: paired.profile,
    profileVersion: paired.profileVersion,
    code: safeCode(row.code),
    requestId: publicToken(row.requestId),
    correlationId: publicToken(row.correlationId),
    refId: publicRef,
    sequence,
    note: note.length > 500 ? "[redacted-note]" : note,
    fields,
  };
}

function projectPath(
  evidenceSessionId: string,
  role: "buyer" | "organizer",
  desk: Exclude<ReceiptContext, "transport">,
  path: DeskPath,
  sequence: number,
): unknown | null {
  if (path.kind !== "checking" && path.kind !== "unavailable") {
    return null;
  }
  const paired = profileFor("none");
  const status: TrackState = path.kind === "checking" ? "loading" : "unavailable";
  return {
    sessionId: evidenceSessionId,
    role,
    actor: "adapter",
    context: "transport",
    domain: PINNED_PROTOCOL_DOMAIN,
    action: "adapter_path",
    operationId: null,
    status,
    source: "none",
    profile: paired.profile,
    profileVersion: paired.profileVersion,
    code: path.kind === "unavailable" ? safeCode(path.code) : null,
    requestId: null,
    correlationId: null,
    refId: desk,
    sequence,
    note: status === "loading" ? sourceCopy.en["s23u"] : sourceCopy.en["s250"],
    fields: [],
  };
}

function deskSource(source: "stub-shape" | "integration-gate" | null): ReceiptSource {
  if (source === "stub-shape" || source === "integration-gate") {
    return source;
  }
  return "none";
}

function projectFlows(
  evidenceSessionId: string,
  role: "buyer" | "organizer",
  context: Exclude<ReceiptContext, "transport">,
  source: "stub-shape" | "integration-gate" | null,
  path: DeskPath,
  flows: readonly DeskFlow[],
  sequence: { value: number },
): unknown[] {
  const out: unknown[] = [];
  const pathRow = projectPath(evidenceSessionId, role, context, path, sequence.value);
  if (pathRow) {
    sequence.value += 1;
    out.push(pathRow);
  }
  const receiptSource = deskSource(source);
  for (const flow of flows) {
    for (const row of flow.rows) {
      const candidate = projectRow(evidenceSessionId, role, context, receiptSource, flow.refId, row, sequence.value);
      if (candidate) {
        sequence.value += 1;
        out.push(candidate);
      }
    }
  }
  return out;
}

function rawActor(value: unknown): string | null {
  if (!isPlain(value) || typeof value.actor !== "string") {
    return null;
  }
  return value.actor;
}

function recordedFor(role: WorkspaceRole): RecordedNotSent[] {
  const rows: RecordedNotSent[] = [];
  const push = (sender: string, list: readonly { action: string; reason: string }[]) => {
    for (const entry of list) {
      rows.push({ sender, action: entry.action, reason: entry.reason });
    }
  };
  if (role === "buyer" || role === "operator") {
    push(sourceCopy.en["sae"], JOURNEY_NOT_COMPOSED);
    push(sourceCopy.en["sml"], GIFT_NOT_COMPOSED);
    push(sourceCopy.en["sdr"], CONSENT_NOT_COMPOSED);
  }
  if (role === "organizer" || role === "operator") {
    push(sourceCopy.en["s162"], ORGANIZER_NOT_COMPOSED);
  }
  return rows;
}

function deskHref(context: ReceiptContext, refId: string): string | null {
  if (context === "journey" && refId !== "redacted-ref") {
    return `/booking/${encodeURIComponent(refId)}`;
  }
  if (context === "gift") {
    return "/gift";
  }
  if (context === "organizer") {
    return "/organizer/workspace";
  }
  if (context === "consent") {
    return "/marketing/m05";
  }
  return null;
}

function toEntry(receipt: KeptReceipt): ReceiptEntry {
  const explanation = explainReceipt(receipt);
  return {
    id: `${receipt.sequence}:${receipt.context}:${receipt.action}:${receipt.operationId ?? "none"}`,
    role: receipt.role,
    context: receipt.context,
    refId: receipt.refId,
    action: receipt.action,
    operationId: receipt.operationId,
    status: explanation.status,
    source: receipt.source,
    profile: receipt.profile,
    profileVersion: receipt.profileVersion,
    code: receipt.code,
    codeClass: receipt.codeClass,
    requestId: receipt.requestId,
    correlationId: receipt.correlationId,
    actorLabel: receipt.actorLabel,
    note: receipt.note,
    meaning: explanation.meaning,
    unconfirmedReason: explanation.unconfirmedReason,
    nextAction: explanation.nextAction,
    fields: receipt.fields,
    deskHref: deskHref(receipt.context, receipt.refId),
    confirmed: explanation.confirmed,
    sequence: receipt.sequence,
    omittedFieldCount: receipt.omittedFieldCount,
  };
}

const CONTEXT_HEADING: Record<ReceiptContext, string> = {
  journey: sourceCopy.en["spe"],
  gift: "Gift",
  consent: sourceCopy.en["sdo"],
  organizer: "Organizer",
  transport: sourceCopy.en["s15"],
};

function summaryLine(label: string, entry: ReceiptEntry | undefined): string {
  if (!entry?.operationId) {
    return sourceMessage(sourceCopy.en["p.t464"], { v1: label });
  }
  return `${label}: ${entry.action} · ${entry.operationId}`;
}

function groupEntries(entries: readonly ReceiptEntry[]): ReceiptGroup[] {
  const groups: ReceiptGroup[] = [];
  const index = new Map<string, ReceiptGroup>();
  for (const entry of entries) {
    const id = `${entry.context}:${entry.refId}`;
    let group = index.get(id);
    if (!group) {
      group = {
        id,
        context: entry.context,
        refId: entry.refId,
        heading: `${CONTEXT_HEADING[entry.context]} ${entry.refId}`,
        lastConfirmed: sourceCopy.en["sq8"],
        unconfirmed: sourceCopy.en["s252"],
        entries: [],
      };
      index.set(id, group);
      groups.push(group);
    }
    group.entries = [...group.entries, entry];
  }
  return groups.map((group) => {
    const lastConfirmed = [...group.entries].reverse().find((entry) => entry.status === "confirmed");
    const unconfirmed = group.entries.find((entry) => entry.status === "unknown");
    return {
      ...group,
      lastConfirmed: summaryLine(sourceCopy.en["sq7"], lastConfirmed),
      unconfirmed: summaryLine(sourceCopy.en["s251"], unconfirmed),
    };
  });
}


function buildDiagnostic(
  model: Omit<ReceiptExplorerModel, "diagnostic" | "exportText" | "sessionDropped">,
): ReceiptDiagnostic {
  const entries = [...model.paths, ...model.groups.flatMap((group) => group.entries)];
  const omittedFieldCount = entries.reduce((sum, entry) => sum + entry.omittedFieldCount, 0);
  return {
    kind: "support-diagnostic",
    sessionId: model.sessionId,
    role: model.role,
    mode: model.environment,
    profile: model.profile,
    profileVersion: model.profileVersion,
    domain: model.domain,
    productionReadiness: false,
    productionConformance: false,
    protocolTruth: false,
    publicDeploy: false,
    retry: false,
    fallbackToStub: false,
    readConfirmsUnknown: false,
    entries: entries.map((entry) => ({
      operationId: entry.operationId,
      action: entry.action,
      status: entry.status,
      source: entry.source,
      profile: entry.profile,
      profileVersion: entry.profileVersion,
      code: entry.code,
      codeClass: entry.codeClass,
      unconfirmedReason: entry.unconfirmedReason,
      nextAction: entry.nextAction,
      requestId: entry.requestId,
      correlationId: entry.correlationId,
      refId: entry.refId,
      actorLabel: entry.actorLabel,
      context: entry.context,
      fields: entry.fields,
    })),
    quarantine: model.quarantine,
    recordedNotSent: model.recorded.map((entry) => ({
      sender: entry.sender,
      action: entry.action,
      reason: entry.reason,
    })),
    omittedFieldCount,
    note: `${RECEIPT_READ_NOTE} ${RECEIPT_STUB_SENTENCE} ${RECEIPT_SESSION_NOTE}`,
  };
}

export interface ReceiptExplorerInput {
  screenSessionId: string;
  evidenceSessionId: string;
  role: WorkspaceRole;
  environment: "stub" | "integration-http";
  journey: JourneyDeskSnapshot;
  gift: GiftDeskSnapshot;
  organizer: OrganizerDeskSnapshot;
  consent: ConsentDeskSnapshot;
  extra?: readonly unknown[];
}

export function buildReceiptExplorer(input: ReceiptExplorerInput): ReceiptExplorerModel {
  const sequence = { value: 1 };
  const projected: unknown[] = [];
  if (input.role === "buyer" || input.role === "operator") {
    projected.push(
      ...projectFlows(
        input.evidenceSessionId,
        "buyer",
        "journey",
        input.journey.source,
        input.journey.path,
        input.journey.journeys.map((item) => ({ refId: item.eventId, rows: item.rows })),
        sequence,
      ),
      ...projectFlows(
        input.evidenceSessionId,
        "buyer",
        "gift",
        input.gift.source,
        input.gift.path,
        input.gift.gifts.map((item) => ({ refId: item.giftId, rows: item.rows })),
        sequence,
      ),
      ...projectFlows(
        input.evidenceSessionId,
        "buyer",
        "consent",
        input.consent.source,
        input.consent.path,
        input.consent.events.map((item) => ({ refId: item.eventId, rows: item.rows })),
        sequence,
      ),
    );
  }
  if (input.role === "organizer" || input.role === "operator") {
    projected.push(
      ...projectFlows(
        input.evidenceSessionId,
        "organizer",
        "organizer",
        input.organizer.source,
        input.organizer.path,
        input.organizer.events.map((item) => ({ refId: item.eventId, rows: item.rows })),
        sequence,
      ),
    );
  }
  const actors = new Set<string>(ROLE_ACTORS[input.role]);
  for (const item of projected) {
    const actor = rawActor(item);
    if (actor) {
      actors.add(actor);
    }
  }
  const screen: ReceiptScreen = {
    sessionId: input.screenSessionId,
    role: input.role,
    actors: [...actors],
    contexts: ROLE_CONTEXTS[input.role],
    domain: PINNED_PROTOCOL_DOMAIN,
  };
  const kept: KeptReceipt[] = [];
  const quarantine: ReceiptQuarantine[] = [];
  let sessionDropped = 0;
  for (const item of [...projected, ...(input.extra ?? [])]) {
    const result = considerReceipt(screen, item);
    if (result.kind === "kept") {
      kept.push(result.receipt);
      continue;
    }
    if (result.kind === "dropped") {
      sessionDropped += 1;
      continue;
    }
    quarantine.push({ reason: result.reason, action: result.action, operationId: result.operationId });
  }
  const entries = kept.map(toEntry);
  const paths = entries.filter((entry) => entry.context === "transport");
  const groups = groupEntries(entries.filter((entry) => entry.context !== "transport"));
  const profile = screenProfile(input.environment);
  const recorded = recordedFor(input.role);
  const base = {
    sessionId: input.screenSessionId,
    role: input.role,
    environment: input.environment,
    profile: profile.profile,
    profileVersion: profile.profileVersion,
    domain: PINNED_PROTOCOL_DOMAIN,
    ruling: RECEIPT_RULING,
    stubSentence: RECEIPT_STUB_SENTENCE,
    readNote: RECEIPT_READ_NOTE,
    sessionNote: RECEIPT_SESSION_NOTE,
    reloadNote: RECEIPT_RELOAD_NOTE,
    groups,
    paths,
    quarantine,
    recorded,
    placeHold: {
      method: PLACE_HOLD_RECORD.method,
      consideredAction: PLACE_HOLD_RECORD.consideredAction,
      reason: PLACE_HOLD_RECORD.reason,
      mappedOntoPrepareTrade: PLACE_HOLD_RECORD.mappedOntoPrepareTrade,
    },
  };
  const diagnostic = buildDiagnostic(base);
  return {
    ...base,
    diagnostic,
    exportText: sweepExport(JSON.stringify(diagnostic, null, 2)),
    sessionDropped,
  };
}

export function useReceiptExplorer(role: WorkspaceRole): ReceiptExplorerModel {
  const journey = useSyncExternalStore(journeyDesk.subscribe, journeyDesk.getSnapshot, journeyDesk.getSnapshot);
  const gift = useSyncExternalStore(giftDesk.subscribe, giftDesk.getSnapshot, giftDesk.getSnapshot);
  const organizer = useSyncExternalStore(organizerDesk.subscribe, organizerDesk.getSnapshot, organizerDesk.getSnapshot);
  const consent = useSyncExternalStore(consentDesk.subscribe, consentDesk.getSnapshot, consentDesk.getSnapshot);
  useEffect(() => {
    void journeyDesk.probe();
    void giftDesk.probe();
    void organizerDesk.probe();
    void consentDesk.probe();
  }, []);
  return buildReceiptExplorer({
    screenSessionId: pageSessionId,
    evidenceSessionId: pageSessionId,
    role,
    environment: protocol.describe().environment,
    journey,
    gift,
    organizer,
    consent,
  });
}
