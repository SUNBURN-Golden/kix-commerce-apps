/**
 * The notification inbox on top of the adapter's synthetic inbox source. Stub
 * scope: the default port is the synthetic source. On integration-http the same
 * port is not-bound — the contract-only catalogue has no notification read, no
 * dedupe or read-state command, no offered-action resolve, and no
 * support-inquiry command. This module does not invent one, send a second
 * attempt, or switch adapters. The page calls no fetch of its own.
 *
 * This module decides no access and dedupes nothing itself. It copies what the
 * controller and the last read hold: every row is the source's own, a hidden
 * control is never the enforcement, and the port checks every request that
 * leaves this page. A notification arrival confirms no economic effect — a
 * payment-observed row reports an observation, not confirmed funds — and a
 * resolve yields a destination, not a send.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  NOTIFY_ACTORS,
  NOTIFY_BUYER_ACTOR,
  NOTIFY_HOLD_NOT_BOUND,
  NOTIFY_NOT_BOUND_REASON,
  NOTIFY_NOT_COMPOSED,
  NOTIFY_ROLES,
  NotificationInboxController,
  notificationInboxPortFor,
  notifyAuthorityTable,
  notifyCapabilities,
  type NotificationInboxPort,
  type NotifyActPhase,
  type NotifyActResult,
  type NotifyActionKind,
  type NotifyDestination,
  type NotifyFence,
  type NotifyInquiryPhase,
  type NotifyInquiryState,
  type NotifyReadState,
  type NotifyRole,
  type NotifyScenario,
  type NotifySyntheticControl,
} from "@kix/protocol-adapter";
import { protocol } from "./protocol";

export const NOTIFY_PAGE_TITLE = "Notification inbox (synthetic)";

export const NOTIFY_SOURCE_LINE =
  "Notifications, dedupe, read state, the offered actions, and the support material come from a synthetic inbox source on this page load. They are not a producer read, not a catalogue receipt, and not an external send.";

export const NOTIFY_BOUNDARY =
  "Only producer-contracted event kinds reach this inbox. A notification confirms what the source recorded — never an economic effect: an observation is not confirmed funds, a recorded trade is not a settled one, and an arrival is not a receipt.";

export const NOTIFY_DEDUPE_NOTE =
  "Deliveries deduplicate on the source's own key. A second delivery of the same key is dropped once, counted, and never listed twice.";

export const NOTIFY_CURRENT_NOTE =
  "Every notification carries the grant generation it was issued under. A notification issued under an older generation keeps its row marked stale-issue, and its offered action resolves nothing — it does not skip the current-generation check.";

export const NOTIFY_SENSITIVE_NOTE =
  "A sensitive notification shows its detail only to a role that holds read-sensitive. For any other role the detail stays withheld at the source; a payload that sends it anyway is refused whole, and this page does not repair it.";

export const NOTIFY_ACTION_NOTE =
  "An offered action is a move, not a send. open-authority moves to the current authority query on the receipts desk; open-support opens the support material the source keeps for that notification.";

export const NOTIFY_INQUIRY_NOTE =
  "The support material is the source's own file: synthetic, redacted, holding no real personal data, not delivered externally, and not an authority record. A payload that says otherwise, or carries a sensitive token, is refused.";

export const NOTIFY_SCOPE_NOTE =
  "Every call names a tenant, an actor, and a role. A notification of another tenant or addressed to another subject refuses the whole payload, and a direct open of such a ref is denied — never empty, never substituted.";

export const NOTIFY_HIDE_NOTE =
  "A hidden or greyed control is not enforcement. The source checks every read, inquiry, and request against the grant and the capability, and this page's tests send requests straight to the port to prove a hidden control is never the check.";

export const NOTIFY_ACTOR_NOTE =
  "The actor and role strings are context labels. They are not an authentication result, and the source does not trust them for access.";

export const NOTIFY_READ_NOTE =
  "A read, an inquiry, and a request are each one attempt. None is sent again by this page. An answer that arrives after the tenant, the actor, or the role changed is dropped. An answer that never arrives leaves the outcome unknown, and an unknown request outcome fences every later request.";

export const NOTIFY_SESSION_NOTE =
  "Reads, inquiries, and requests live in this page load only. A reload or a new synthetic session clears them and resolves nothing at a producer.";

export const NOTIFY_SYNTHETIC_CONTROL_NOTE =
  "The Simulate controls are synthetic controls a real producer does not offer. They stand in for a revoked grant, a rotated generation, and a late delivery. Marking read or resolving an offer is not one of them.";

export const NOTIFY_CLAIM_NOTE =
  "Every read states arrivalConfirmsEffect, externalSendWired, actorIsAuthenticated, crossTenantDelivery, sensitiveDetailShownWithoutGrant, actionSkipsGenerationCheck, and inboxIsCompleteRecord as false. A payload that says anything else, or stays silent, is refused before a row is shown.";

export const NOTIFY_HOLD_NOTE = `Holding a seat is not available here. ${NOTIFY_HOLD_NOT_BOUND.reason}`;

export const NOTIFY_NOT_COMPOSED_NOTE = `Catalogue actions recorded and never composed here: ${NOTIFY_NOT_COMPOSED.map((entry) => entry.action).join(", ")}.`;

export const NOTIFY_SCENARIO_NOTES: Readonly<Record<NotifyScenario, string>> = {
  clean: "Every read, inquiry, and request is answered.",
  empty: "The source lists no notification for this scope.",
  stale: "The source serves a watermark older than the floor this page holds.",
  denied: "Every notification grant is revoked at the source.",
  "tenant-mix": "The source sends a notification that belongs to another tenant. The payload is refused.",
  "subject-mix": "The source sends a notification addressed to another subject. The payload is refused.",
  duplicate: "The source delivers the same dedupe key twice. The second delivery is dropped and counted.",
  late: "A notification issued under an older grant generation sits in the feed. Its offered action resolves nothing.",
  "grant-rotated": "Every grant already moved a generation at the source. The earlier rows are stale-issue.",
  "kind-uncontracted": "The source sends an event kind the producer contract does not name. The payload is refused.",
  "sensitive-leak": "The source sends a sensitive detail to a role with no read-sensitive capability. The payload is refused.",
  "claims-arrival": "The source sends a payload that claims an arrival confirms an economic effect. The payload is refused.",
  "external-wired": "The source sends a payload that claims an external send is wired. The payload is refused.",
  "read-lost": "The answer to a read never arrives.",
  "act-lost": "A request reaches the source and is recorded. Its answer never arrives.",
  "inquiry-denied": "The source grants the inbox read and no inquiry material.",
  "inquiry-leak": "The support material carries a sensitive token. The payload is refused.",
  "resolve-claims": "The source answers a resolve by claiming it confirmed an economic effect. The answer is not trusted.",
};

export type NotifyScreenState =
  | "loading"
  | "ready"
  | "empty"
  | "stale"
  | "generation-stale"
  | "denied"
  | "refused"
  | "invalid"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export interface ControlModel {
  enabled: boolean;
  reason: string | null;
}

export interface NotifyRowModel {
  notificationRef: string;
  kindWord: string;
  dedupeKey: string;
  seq: number;
  issuedAt: string;
  readWord: string;
  issueWord: string;
  issueState: string;
  sensitiveLine: string;
  headline: string;
  /** The source's own detail text, or the withheld line. Never a substitute. */
  detailLine: string;
  offerWord: string;
  markRead: ControlModel | null;
  resolve: ControlModel | null;
}

export interface NotifyAuthorityModel {
  capability: string;
  heldByLine: string;
  heldByRole: boolean;
}

export interface NotifyFocusModel {
  title: string;
  lines: string[];
}

export interface NotifyInquiryLineModel {
  label: string;
  text: string;
}

export interface NotifyInquiryModel {
  phase: NotifyInquiryPhase;
  statusLine: string;
  detailLine: string;
  declarationLine: string | null;
  notificationRef: string | null;
  rows: NotifyInquiryLineModel[];
}

/** Where the last resolve landed. The page renders a move, never a send. */
export type NotifyDestinationModel =
  | { kind: "authority"; ref: string; href: "/receipts" }
  | { kind: "support"; inquiryRef: string };

export interface NotifyRequestRecordModel {
  seq: number;
  kindWord: string;
  phase: NotifyActPhase;
  phaseWord: string;
  code: string | null;
  detail: string | null;
  receiptLines: string[];
  destination: NotifyDestinationModel | null;
}

export interface NotifySessionModel {
  contextLine: string;
  capabilityLine: string;
  countersLine: string;
  earlierUnknownLine: string;
  notComposedLine: string;
  holdLine: string;
}

export type NotifyLastAction = { seq: number; text: string; attention: boolean };

export interface NotifyModel {
  state: NotifyScreenState;
  statusLine: string;
  detailLine: string;
  actionLabel: string | null;
  freshnessWord: string;
  scopeLine: string;
  generationLine: string;
  watermarkLine: string;
  dedupeLine: string;
  unreadLine: string;
  authority: NotifyAuthorityModel[];
  focus: NotifyFocusModel | null;
  rows: NotifyRowModel[];
  markBlock: string | null;
  resolveBlock: string | null;
  inquiryControl: ControlModel;
  inquiry: NotifyInquiryModel;
  request: NotifyRequestRecordModel | null;
  fenceLine: string | null;
  behindLine: string | null;
  session: NotifySessionModel;
  lastLine: string | null;
  lastNeedsFocus: boolean;
  lastSeq: number | null;
  focusToken: string | null;
}

const EVENT_WORDS: Readonly<Record<string, string>> = {
  "trade-recorded": "Trade recorded",
  "hold-expiring": "Hold expiring",
  "payment-observed": "Payment observed",
  "right-moved": "Right moved",
  "grant-changed": "Grant changed",
  "support-answered": "Support answered",
  "inquiry-ready": "Inquiry ready",
};

const OFFER_WORDS: Readonly<Record<string, string>> = {
  "open-authority": "Opens the current authority query",
  "open-support": "Opens the support material",
};

const ACTION_WORDS: Readonly<Record<NotifyActionKind, string>> = {
  "mark-read": "Mark-read",
  resolve: "Resolve",
};

const PHASE_WORDS: Readonly<Record<NotifyActPhase, string>> = {
  applied: "Recorded at the synthetic source",
  rejected: "Rejected by the source",
  denied: "Denied by the source",
  refused: "The answer was not trusted, and the request may have been recorded",
  invalid: "Refused before it was recorded",
  "tuple-changed": "Nothing was recorded because the pin tuple changed",
  "not-bound": "Not recorded: not bound",
  unknown: "Outcome unknown. The request may have been recorded",
};

function readStateToScreen(readState: NotifyReadState): NotifyScreenState {
  switch (readState) {
    case "none":
      return "loading";
    case "generation-stale":
      return "generation-stale";
    default:
      return readState;
  }
}

function statusFor(
  state: NotifyScreenState,
  code: string | null,
  detail: string | null,
): { statusLine: string; detailLine: string; actionLabel: string | null } {
  const suffix = code ? ` (${code})` : "";
  switch (state) {
    case "loading":
      return { statusLine: "Reading the synthetic inbox source. Nothing is shown yet.", detailLine: "", actionLabel: null };
    case "ready":
      return { statusLine: "Inbox read.", detailLine: "", actionLabel: null };
    case "empty":
      return {
        statusLine: "The source lists no notification for this scope in this read.",
        detailLine: detail ?? "An empty inbox is not denied and not unknown.",
        actionLabel: "Read again",
      };
    case "stale":
      return { statusLine: "Stale read.", detailLine: detail ?? "", actionLabel: "Read again" };
    case "generation-stale":
      return {
        statusLine: "The notification grant moved underneath this view.",
        detailLine: detail ?? "This session holds the older generation. Switch the tenant, the actor, or the role, or start a new session, to read under the current grant.",
        actionLabel: "Start a new synthetic session",
      };
    case "denied":
      return {
        statusLine: `The source denied this call${suffix}.`,
        detailLine: `${detail ?? ""} No row is shown, and a hidden control was not what denied it.`,
        actionLabel: "Read again",
      };
    case "refused":
      return {
        statusLine: `The source sent a payload this page does not trust${suffix}.`,
        detailLine: `${detail ?? ""} No row from it is shown.`,
        actionLabel: "Read again",
      };
    case "invalid":
      return { statusLine: `The request was refused before it read${suffix}.`, detailLine: detail ?? "", actionLabel: "Read again" };
    case "not-bound":
      return { statusLine: NOTIFY_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: "The pin tuple changed. Nothing was read and nothing was applied.",
        detailLine: detail ?? "",
        actionLabel: "Start a new synthetic session",
      };
    case "unavailable":
      return {
        statusLine: "The source did not answer. This is not an empty inbox.",
        detailLine: detail ?? "",
        actionLabel: "Read again",
      };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function fenceText(fence: NotifyFence): string {
  return fence.reason === "in-flight"
    ? `A ${fence.action} request is in flight. One request goes at a time.`
    : `Request ${fence.seq} (${fence.action}) has an unknown outcome and may have been recorded. Nothing is sent again from here, and a read does not resolve it. Switching the tenant, the actor, or the role, or starting a new synthetic session, begins a new context and counts this unknown outcome.`;
}

function inquiryModel(inquiry: NotifyInquiryState): NotifyInquiryModel {
  const empty = (phase: NotifyInquiryPhase, statusLine: string, detailLine: string): NotifyInquiryModel => ({
    phase,
    statusLine,
    detailLine,
    declarationLine: null,
    notificationRef: null,
    rows: [],
  });
  switch (inquiry.phase) {
    case "none":
      return empty("none", "No support material is loaded. Material follows a ready read and a resolve that lands on support.", "");
    case "loaded": {
      const value = inquiry.value;
      if (value === null) {
        return empty("loaded", "The material record is empty.", "");
      }
      const declaration = value.declaration;
      return {
        phase: "loaded",
        statusLine: "Support material loaded.",
        detailLine: "",
        declarationLine: `SYNTHETIC material. provenance ${declaration.provenance} · realPersonalData ${String(declaration.realPersonalData)} · deliveredExternally ${String(declaration.deliveredExternally)} · authorityRecord ${String(declaration.authorityRecord)}.`,
        notificationRef: value.notificationRef,
        rows: value.lines.map((line) => ({ label: line.label, text: line.text })),
      };
    }
    case "denied":
      return empty("denied", `The source denied the material (${inquiry.code ?? "no code"}).`, inquiry.detail ?? "");
    case "refused":
      return empty("refused", `The material payload was refused (${inquiry.code ?? "no code"}).`, inquiry.detail ?? "");
    case "invalid":
      return empty("invalid", `The inquiry request was refused (${inquiry.code ?? "no code"}).`, inquiry.detail ?? "");
    case "not-bound":
      return empty("not-bound", "The inquiry stays not-bound.", inquiry.detail ?? NOTIFY_NOT_BOUND_REASON);
    case "tuple-changed":
      return empty("tuple-changed", "The pin tuple changed. No material was applied.", inquiry.detail ?? "");
    case "unavailable":
      return empty("unavailable", "The inquiry answer did not arrive.", inquiry.detail ?? "");
    default: {
      const exhaustive: never = inquiry.phase;
      return exhaustive;
    }
  }
}

function destinationModel(destination: NotifyDestination | null): NotifyDestinationModel | null {
  if (destination === null) {
    return null;
  }
  if (destination.kind === "authority") {
    return { kind: "authority", ref: destination.ref, href: "/receipts" };
  }
  return { kind: "support", inquiryRef: destination.inquiryRef };
}

export function buildNotifyModel(input: { controller: NotificationInboxController; last: NotifyLastAction | null }): NotifyModel {
  const { controller } = input;
  const state = controller.state();
  const screen = readStateToScreen(state.readState);
  const status = statusFor(screen, state.readCode, state.readDetail);
  const snapshot = state.snapshot;
  const assessment = state.assessment;
  const role = state.context.scope.role;
  const actorRef = state.context.actorRef;

  const freshnessWord =
    state.freshness === "CURRENT"
      ? state.behind
        ? "The last read is behind a request that reached the source. Read again."
        : "The last read is current."
      : state.freshness === "STALE"
        ? "The last read is behind the grant generation or the watermark."
        : "There is no usable read.";

  const capabilities = notifyCapabilities(role);
  const authority: NotifyAuthorityModel[] = notifyAuthorityTable().map((row) => ({
    capability: row.capability,
    heldByLine: row.heldBy.length === 0 ? "Held by no role on this desk." : `Held by ${row.heldBy.join(", ")}.`,
    heldByRole: row.heldBy.includes(role),
  }));

  const markEligibility = controller.canSend("mark-read");
  const resolveEligibility = controller.canSend("resolve");
  const markBlock = markEligibility.allowed ? null : (markEligibility.reason ?? "Marking read is not on offer.");
  const resolveBlock = resolveEligibility.allowed ? null : (resolveEligibility.reason ?? "No offered action resolves now.");

  const rows: NotifyRowModel[] = (snapshot?.notifications ?? []).map((row) => {
    const markable = assessment?.markable.some((item) => item.notificationRef === row.notificationRef) ?? false;
    const markReason =
      markBlock !== null
        ? markBlock
        : markable
          ? null
          : row.read
            ? `Notification ${row.notificationRef} is already marked read.`
            : "The read offers no mark-read on this notification.";
    const resolvable = assessment?.resolvable.some((item) => item.notificationRef === row.notificationRef) ?? false;
    const resolveReason =
      resolveBlock !== null
        ? resolveBlock
        : resolvable
          ? null
          : row.issueState === "stale-issue"
            ? "Issued under an older grant generation. Its offered action resolves nothing — it does not skip the current-generation check."
            : row.offer === null
              ? "This notification offers no action."
              : "The read does not offer a resolve on this notification.";
    return {
      notificationRef: row.notificationRef,
      kindWord: EVENT_WORDS[row.kind] ?? row.kind,
      dedupeKey: row.dedupeKey,
      seq: row.seq,
      issuedAt: row.issuedAt,
      readWord: row.read ? "Read" : "Unread",
      issueWord: row.issueState === "current" ? "Current issue" : "Stale issue",
      issueState: row.issueState,
      sensitiveLine: row.sensitive
        ? row.detailState === "withheld"
          ? "Sensitive. Detail withheld at the source: this role holds no read-sensitive capability."
          : "Sensitive. Detail shown under the read-sensitive capability."
        : "Not sensitive.",
      headline: row.headline,
      detailLine: row.detailState === "withheld" ? "Detail withheld at the source." : (row.detail ?? ""),
      offerWord: row.offer === null ? "No offered action." : (OFFER_WORDS[row.offer.kind] ?? row.offer.kind),
      markRead: { enabled: markReason === null, reason: markReason },
      resolve: { enabled: resolveReason === null, reason: resolveReason },
    };
  });

  const inquiryEligibility = controller.canInquiry();
  const inquiryControl: ControlModel = inquiryEligibility.allowed
    ? { enabled: true, reason: null }
    : { enabled: false, reason: inquiryEligibility.reason };

  const last = state.last;
  const destination = last?.receipt?.kind === "resolved" ? destinationModel(last.receipt.destination) : null;
  const request: NotifyRequestRecordModel | null =
    last === null
      ? null
      : {
          seq: last.seq,
          kindWord: ACTION_WORDS[last.action.kind],
          phase: last.phase,
          phaseWord: PHASE_WORDS[last.phase],
          code: last.code,
          detail: last.detail,
          destination,
          receiptLines: last.receipt
            ? [
                `Receipt ${last.receipt.kind} for ${last.receipt.notificationRef}, checked under grant generation ${last.receipt.checkedGeneration}.`,
                `confirmsEconomicEffect ${String(last.receipt.confirmsEconomicEffect)} · externalSendWired ${String(last.receipt.externalSendWired)}`,
                last.receipt.kind === "resolved"
                  ? "Resolved is a destination, not a send. The move below carries the reference text; nothing was posted."
                  : "A marked read changes read state only. It confirms no economic effect.",
              ]
            : [],
        };

  const counters = state.counters;
  const session: NotifySessionModel = {
    contextLine: `Actor ${actorRef}, tenant ${state.context.scope.tenantId}, role ${role}, session ${state.context.incarnation}, mode ${state.context.environment}.`,
    capabilityLine: `Role ${role} holds: ${capabilities.length === 0 ? "no capability" : capabilities.join(", ")}.`,
    countersLine: `Reads ${counters.reads}. Inquiries ${counters.inquiries}. Requests ${counters.acts}. Not sent ${counters.notSent}. Reads dropped ${counters.droppedReads}. Inquiries dropped ${counters.droppedInquiries}.`,
    earlierUnknownLine:
      state.earlierUnknown === 0
        ? "No unknown request outcome in earlier sessions."
        : `${state.earlierUnknown} unknown request outcome${state.earlierUnknown === 1 ? "" : "s"} in earlier sessions. They are counted, not forgotten.`,
    notComposedLine: NOTIFY_NOT_COMPOSED_NOTE,
    holdLine: NOTIFY_HOLD_NOTE,
  };

  const focus = snapshot?.focus ?? null;
  return {
    state: screen,
    statusLine: status.statusLine,
    detailLine: status.detailLine,
    actionLabel: status.actionLabel,
    freshnessWord,
    scopeLine: `Tenant ${state.context.scope.tenantId}. Actor ${actorRef} acting as ${role}.`,
    generationLine: snapshot
      ? `Grant ${snapshot.grantRef} at generation ${snapshot.grantGeneration} as of this read. A request built under an older one is rejected, and a stale-issued notification's action resolves nothing.`
      : "No grant generation without a ready read.",
    watermarkLine: snapshot ? `Watermark ${snapshot.watermark}. Read ${snapshot.snapshotId} on this port.` : "No watermark without a ready read.",
    dedupeLine: snapshot ? `Dedupe dropped ${snapshot.droppedDuplicates} second deliver${snapshot.droppedDuplicates === 1 ? "y" : "ies"} in this read.` : "No dedupe record without a ready read.",
    unreadLine: snapshot ? `${snapshot.unreadCount} unread of ${snapshot.notifications.length} listed.` : "No unread count without a ready read.",
    authority,
    focus:
      focus === null
        ? null
        : {
            title: `Notification ${focus.row.notificationRef}`,
            lines: [
              `${EVENT_WORDS[focus.row.kind] ?? focus.row.kind} for ${focus.row.subjectRef} in ${focus.row.tenantId}. ${focus.row.headline}`,
              `Issued ${focus.row.issuedAt} under grant generation ${focus.row.issueGeneration}. ${focus.row.issueState === "current" ? "Current issue." : "Stale issue."} ${focus.row.read ? "Read." : "Unread."}`,
              focus.row.detailState === "withheld" ? "Detail withheld at the source." : `Detail: ${focus.row.detail ?? ""}`,
              "This arrival confirms no economic effect.",
            ],
          },
    rows,
    markBlock,
    resolveBlock,
    inquiryControl,
    inquiry: inquiryModel(state.inquiry),
    request,
    fenceLine: state.fence === null ? null : fenceText(state.fence),
    behindLine: state.behind
      ? "A request reached the source after the last read. The rows on screen are the last read's. Read again to see them change."
      : null,
    session,
    lastLine: input.last === null ? null : input.last.text,
    lastNeedsFocus: input.last?.attention ?? false,
    lastSeq: input.last === null ? null : input.last.seq,
    focusToken: focusTokenFor(input.last, screen, state.counters, state.inquiry.phase),
  };
}

const NOTICE_READ_STATES: readonly NotifyScreenState[] = [
  "stale",
  "generation-stale",
  "denied",
  "refused",
  "invalid",
  "tuple-changed",
  "unavailable",
];
const NOTICE_INQUIRY_PHASES: readonly NotifyInquiryPhase[] = ["denied", "refused", "invalid", "tuple-changed", "unavailable"];

function focusTokenFor(
  last: NotifyLastAction | null,
  screen: NotifyScreenState,
  counters: { reads: number; inquiries: number },
  inquiryPhase: NotifyInquiryPhase,
): string | null {
  if (last?.attention) {
    return `note-${last.seq}`;
  }
  if (NOTICE_READ_STATES.includes(screen)) {
    return `read-${screen}-${counters.reads}`;
  }
  if (NOTICE_INQUIRY_PHASES.includes(inquiryPhase)) {
    return `inquiry-${inquiryPhase}-${counters.inquiries}`;
  }
  return null;
}

function actResultLine(kind: NotifyActionKind, result: NotifyActResult): { text: string; attention: boolean } {
  const word = ACTION_WORDS[kind];
  switch (result.kind) {
    case "APPLIED":
      return {
        text:
          kind === "mark-read"
            ? `${word} recorded at the synthetic source. Read state changed; nothing else did. Read again to see it.`
            : `${word} recorded at the synthetic source. It yields a destination, not a send. The destination is shown in the request record.`,
        attention: false,
      };
    case "REJECTED":
      return {
        text: `${word} rejected (${result.record.code ?? "no code"}). ${result.record.detail ?? ""} The source recorded nothing for this request.`.trim(),
        attention: true,
      };
    case "UNKNOWN":
      return {
        text: `${word} outcome unknown (${result.record.code ?? "no code"}). It may have been recorded. Every later request is fenced, and a read does not resolve it.`,
        attention: true,
      };
    case "FENCED":
      return { text: `${word} not sent. ${fenceText(result.fence)}`, attention: true };
    case "NOT_SENT":
      return { text: `${word} not sent. ${result.detail}`, attention: true };
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

export interface NotifyActions {
  refresh(): void;
  openNotification(ref: string): void;
  markRead(notificationRef: string): void;
  resolveAction(notificationRef: string): void;
  loadInquiry(inquiryRef: string): void;
  switchRole(role: NotifyRole): void;
  switchActor(actor: string): void;
  switchTenant(): void;
  revokeGrant(): void;
  rotateGrant(): void;
  deliverLate(): void;
  setScenario(next: NotifyScenario): void;
  newSession(): void;
}

interface Session {
  port: NotificationInboxPort;
  controller: NotificationInboxController;
}

function createSession(
  environment: "stub" | "integration-http",
  scenario: NotifyScenario,
  actorRef: string,
  role: NotifyRole,
): Session {
  const port = notificationInboxPortFor(environment, { scenario });
  return { port, controller: new NotificationInboxController(port, { actorRef, role }) };
}

export function useNotificationInbox(): {
  environment: "stub" | "integration-http";
  scenario: NotifyScenario;
  actorRef: string;
  role: NotifyRole;
  model: NotifyModel;
  actions: NotifyActions;
} {
  const environment = protocol.describe().environment;
  const sessionRef = useRef<Session | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createSession(environment, "clean", NOTIFY_BUYER_ACTOR, "buyer");
  }
  const [scenario, setScenarioState] = useState<NotifyScenario>("clean");
  const [actorRef, setActorRef] = useState<string>(NOTIFY_BUYER_ACTOR);
  const [role, setRole] = useState<NotifyRole>("buyer");
  const [epoch, setEpoch] = useState(0);
  const [, setTick] = useState(0);
  const [last, setLast] = useState<NotifyLastAction | null>(null);
  const actionSeq = useRef(0);

  useEffect(() => {
    const session = sessionRef.current;
    if (session === null) {
      return undefined;
    }
    const off = session.controller.subscribe(() => setTick((value) => value + 1));
    void session.controller.read();
    return off;
  }, [epoch]);

  const note = useCallback((text: string, attention = false) => {
    actionSeq.current += 1;
    setLast({ seq: actionSeq.current, text, attention });
  }, []);

  const startSession = useCallback(
    (next: NotifyScenario, actor: string, nextRole: NotifyRole, text: string) => {
      sessionRef.current = createSession(environment, next, actor, nextRole);
      setScenarioState(next);
      setEpoch((value) => value + 1);
      note(text);
    },
    [environment, note],
  );

  const run = useCallback(
    (kind: NotifyActionKind, send: () => Promise<NotifyActResult>) => {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      void send().then((result) => {
        if (sessionRef.current !== session) {
          return;
        }
        const line = actResultLine(kind, result);
        note(line.text, line.attention);
      });
    },
    [note],
  );

  const synthetic = useCallback(
    (control: NotifySyntheticControl, ref: string | undefined, moved: string, nothing: string) => {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const done = session.port.synthetic(control, ref);
      note(done ? `${moved} A real producer offers no such control. Read again.` : nothing, done);
    },
    [note],
  );

  const actions: NotifyActions = {
    refresh() {
      void sessionRef.current?.controller.read();
    },
    openNotification(ref) {
      const text = ref.trim();
      if (text.length === 0) {
        note("A deep-open names a notification reference copied from a row or a URL. It is never guessed.", true);
        return;
      }
      void sessionRef.current?.controller.read(text);
    },
    markRead(notificationRef) {
      const session = sessionRef.current;
      if (session !== null) {
        run("mark-read", () => session.controller.markRead(notificationRef));
      }
    },
    resolveAction(notificationRef) {
      const session = sessionRef.current;
      if (session !== null) {
        run("resolve", () => session.controller.resolveAction(notificationRef));
      }
    },
    loadInquiry(inquiryRef) {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      void session.controller.loadInquiry(inquiryRef).then((result) => {
        if (sessionRef.current !== session) {
          return;
        }
        if (result.kind === "NOT_SENT") {
          note(result.reason === "not-bound" ? NOTIFY_NOT_BOUND_REASON : `No inquiry was sent. ${result.detail}`, true);
        }
      });
    },
    switchRole(nextRole) {
      const session = sessionRef.current;
      if (session === null || !(NOTIFY_ROLES as readonly string[]).includes(nextRole)) {
        return;
      }
      const context = session.controller.switchRole(nextRole);
      if (context === null) {
        note("A request is in flight. The role cannot change under it.", true);
        return;
      }
      setRole(nextRole);
      note(
        `Switched the same actor to role ${context.scope.role}, session ${context.incarnation}. The earlier role's rows and material are cleared, a late answer is dropped, and actions it offered are fenced off. One read for the new role was asked for.`,
      );
      void session.controller.read();
    },
    switchActor(next) {
      const session = sessionRef.current;
      if (session === null || !(NOTIFY_ACTORS as readonly string[]).includes(next)) {
        return;
      }
      const context = session.controller.switchActor(next);
      if (context === null) {
        note("A request is in flight. The actor cannot change under it.", true);
        return;
      }
      setActorRef(next);
      note(
        `Switched the desk actor to ${context.actorRef}, session ${context.incarnation}, still acting as ${context.scope.role}. The source decides whether that grant exists. Rows and material are cleared, and an answer in flight is dropped. One read was asked for.`,
      );
      void session.controller.read();
    },
    switchTenant() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const nextTenant = session.controller.state().context.scope.tenantId === "ten-0001" ? "ten-0002" : "ten-0001";
      const context = session.controller.switchTenant(nextTenant);
      if (context === null) {
        note("A request is in flight. The tenant cannot change under it.", true);
        return;
      }
      note(
        `Switched the tenant to ${context.scope.tenantId}, session ${context.incarnation}. Rows and material of the earlier tenant are cleared, and an answer in flight for it is dropped. One read for the new tenant was asked for.`,
      );
      void session.controller.read();
    },
    revokeGrant() {
      const session = sessionRef.current;
      const grantRef = session?.controller.state().snapshot?.grantRef;
      synthetic(
        "revoke-grant",
        grantRef,
        `The synthetic notification grant ${grantRef ?? "?"} is withdrawn at the source. Its next call is denied.`,
        "There is no synthetic grant to withdraw, or it is already revoked.",
      );
    },
    rotateGrant() {
      const session = sessionRef.current;
      const grantRef = session?.controller.state().snapshot?.grantRef;
      synthetic(
        "rotate-grant",
        grantRef,
        `The synthetic notification grant ${grantRef ?? "?"} moved a generation at the source. A request built under the old one is rejected.`,
        "There is no synthetic grant to rotate, or it is already revoked.",
      );
    },
    deliverLate() {
      const session = sessionRef.current;
      const actor = session?.controller.state().context.actorRef;
      synthetic(
        "deliver-late",
        actor,
        `The synthetic source delivered a notification issued under an older grant generation for ${actor ?? "?"}.`,
        "There is no synthetic source to deliver into, or this actor holds no grant here.",
      );
    },
    setScenario(next) {
      startSession(
        next,
        actorRef,
        role,
        `Started a new synthetic inbox session on scenario ${next} for ${actorRef} as ${role}. Earlier reads, material, and requests are cleared.`,
      );
    },
    newSession() {
      startSession(
        scenario,
        actorRef,
        role,
        `Started a new synthetic inbox session on scenario ${scenario} for ${actorRef} as ${role}. Earlier reads, material, and requests are cleared.`,
      );
    },
  };

  return {
    environment,
    scenario,
    actorRef,
    role,
    model: buildNotifyModel({ controller: sessionRef.current.controller, last }),
    actions,
  };
}
