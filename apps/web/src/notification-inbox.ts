import { messages as sourceCopy } from "./i18n/messages/notification-inbox";
import { sourceMessage } from "./i18n/source-message";
import { connectivityPort, connectivityController, connectedActions } from "./connectivity/write-guard";
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
import { protocol } from "./connectivity/desk-protocol";

export const NOTIFY_PAGE_TITLE = sourceCopy.en["s11s"];

export const NOTIFY_SOURCE_LINE =
  sourceCopy.en["s11t"];

export const NOTIFY_BOUNDARY =
  "Only producer-contracted event kinds reach this inbox. A notification confirms what the source recorded — never an economic effect: an observation is not confirmed funds, a recorded trade is not a settled one, and an arrival is not a receipt.";

export const NOTIFY_DEDUPE_NOTE =
  sourceCopy.en["sg3"];

export const NOTIFY_CURRENT_NOTE =
  "Every notification carries the grant generation it was issued under. A notification issued under an older generation keeps its row marked stale-issue, and its offered action resolves nothing — it does not skip the current-generation check.";

export const NOTIFY_SENSITIVE_NOTE =
  sourceCopy.en["s7z"];

export const NOTIFY_ACTION_NOTE =
  sourceCopy.en["s4g"];

export const NOTIFY_INQUIRY_NOTE =
  sourceCopy.en["s21k"];

export const NOTIFY_SCOPE_NOTE =
  "Every call names a tenant, an actor, and a role. A notification of another tenant or addressed to another subject refuses the whole payload, and a direct open of such a ref is denied — never empty, never substituted.";

export const NOTIFY_HIDE_NOTE =
  sourceCopy.en["s2e"];

export const NOTIFY_ACTOR_NOTE =
  sourceCopy.en["s1pr"];

export const NOTIFY_READ_NOTE =
  sourceCopy.en["s6b"];

export const NOTIFY_SESSION_NOTE =
  sourceCopy.en["s1c7"];

export const NOTIFY_SYNTHETIC_CONTROL_NOTE =
  sourceCopy.en["s1y6"];

export const NOTIFY_CLAIM_NOTE =
  sourceCopy.en["sjh"];

export const NOTIFY_HOLD_NOTE = sourceMessage(sourceCopy.en["p.t8"], { v1: NOTIFY_HOLD_NOT_BOUND.reason });

export const NOTIFY_NOT_COMPOSED_NOTE = sourceMessage(sourceCopy.en["p.t9"], { v1: NOTIFY_NOT_COMPOSED.map((entry) => entry.action).join(", ") });

export const NOTIFY_SCENARIO_NOTES: Readonly<Record<NotifyScenario, string>> = {
  clean: sourceCopy.en["sjg"],
  empty: sourceCopy.en["s1zu"],
  stale: sourceCopy.en["s21a"],
  denied: sourceCopy.en["sj7"],
  "tenant-mix": sourceCopy.en["s20x"],
  "subject-mix": sourceCopy.en["s20w"],
  duplicate: sourceCopy.en["s1yu"],
  late: sourceCopy.en["s4l"],
  "grant-rotated": sourceCopy.en["sj4"],
  "kind-uncontracted": sourceCopy.en["s20u"],
  "sensitive-leak": sourceCopy.en["s219"],
  "claims-arrival": sourceCopy.en["s211"],
  "external-wired": sourceCopy.en["s212"],
  "read-lost": sourceCopy.en["s1q3"],
  "act-lost": sourceCopy.en["s7a"],
  "inquiry-denied": sourceCopy.en["s1zb"],
  "inquiry-leak": sourceCopy.en["s21j"],
  "resolve-claims": sourceCopy.en["s1yb"],
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
  "trade-recorded": sourceCopy.en["s24f"],
  "hold-expiring": sourceCopy.en["sng"],
  "payment-observed": sourceCopy.en["s17j"],
  "right-moved": sourceCopy.en["s1ha"],
  "grant-changed": sourceCopy.en["smp"],
  "support-answered": sourceCopy.en["s1ng"],
  "inquiry-ready": sourceCopy.en["sny"],
};

const OFFER_WORDS: Readonly<Record<string, string>> = {
  "open-authority": sourceCopy.en["s157"],
  "open-support": sourceCopy.en["s158"],
};

const ACTION_WORDS: Readonly<Record<NotifyActionKind, string>> = {
  "mark-read": sourceCopy.en["ss6"],
  resolve: sourceCopy.en["s1ge"],
};

const PHASE_WORDS: Readonly<Record<NotifyActPhase, string>> = {
  applied: sourceCopy.en["s1du"],
  rejected: sourceCopy.en["s1ez"],
  denied: sourceCopy.en["sgb"],
  refused: sourceCopy.en["s1q6"],
  invalid: sourceCopy.en["s1eu"],
  "tuple-changed": sourceCopy.en["s11m"],
  "not-bound": sourceCopy.en["s12f"],
  unknown: sourceCopy.en["s16j"],
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
      return { statusLine: sourceCopy.en["s1bg"], detailLine: "", actionLabel: null };
    case "ready":
      return { statusLine: sourceCopy.en["snu"], detailLine: "", actionLabel: null };
    case "empty":
      return {
        statusLine: sourceCopy.en["s1zv"],
        detailLine: detail ?? sourceCopy.en["s3u"],
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "stale":
      return { statusLine: sourceCopy.en["s1lw"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    case "generation-stale":
      return {
        statusLine: sourceCopy.en["s1uk"],
        detailLine: detail ?? sourceCopy.en["s23n"],
        actionLabel: sourceCopy.en["s1m2"],
      };
    case "denied":
      return {
        statusLine: sourceMessage(sourceCopy.en["p.t290"], { v1: suffix }),
        detailLine: sourceMessage(sourceCopy.en["p.t291"], { v1: detail ?? "" }),
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "refused":
      return {
        statusLine: sourceMessage(sourceCopy.en["p.t11"], { v1: suffix }),
        detailLine: sourceMessage(sourceCopy.en["p.t12"], { v1: detail ?? "" }),
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "invalid":
      return { statusLine: sourceMessage(sourceCopy.en["p.t13"], { v1: suffix }), detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    case "not-bound":
      return { statusLine: NOTIFY_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: sourceCopy.en["s1v8"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1m2"],
      };
    case "unavailable":
      return {
        statusLine: sourceCopy.en["s1yw"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1ax"],
      };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function fenceText(fence: NotifyFence): string {
  return fence.reason === "in-flight"
    ? sourceMessage(sourceCopy.en["p.t14"], { v1: fence.action })
    : sourceMessage(sourceCopy.en["p.t311"], { v1: fence.seq, v2: fence.action });
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
      return empty("none", sourceCopy.en["syx"], "");
    case "loaded": {
      const value = inquiry.value;
      if (value === null) {
        return empty("loaded", sourceCopy.en["s1ud"], "");
      }
      const declaration = value.declaration;
      return {
        phase: "loaded",
        statusLine: sourceCopy.en["s1nn"],
        detailLine: "",
        declarationLine: sourceMessage(sourceCopy.en["p.t312"], { v1: declaration.provenance, v2: String(declaration.realPersonalData), v3: String(declaration.deliveredExternally), v4: String(declaration.authorityRecord) }),
        notificationRef: value.notificationRef,
        rows: value.lines.map((line) => ({ label: line.label, text: line.text })),
      };
    }
    case "denied":
      return empty("denied", sourceMessage(sourceCopy.en["p.t313"], { v1: inquiry.code ?? "no code" }), inquiry.detail ?? "");
    case "refused":
      return empty("refused", sourceMessage(sourceCopy.en["p.t314"], { v1: inquiry.code ?? "no code" }), inquiry.detail ?? "");
    case "invalid":
      return empty("invalid", sourceMessage(sourceCopy.en["p.t315"], { v1: inquiry.code ?? "no code" }), inquiry.detail ?? "");
    case "not-bound":
      return empty("not-bound", sourceCopy.en["s1t8"], inquiry.detail ?? NOTIFY_NOT_BOUND_REASON);
    case "tuple-changed":
      return empty("tuple-changed", sourceCopy.en["s1v7"], inquiry.detail ?? "");
    case "unavailable":
      return empty("unavailable", sourceCopy.en["s1t7"], inquiry.detail ?? "");
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
        ? sourceCopy.en["s1tj"]
        : sourceCopy.en["s1tn"]
      : state.freshness === "STALE"
        ? sourceCopy.en["s1tl"]
        : sourceCopy.en["s1wv"];

  const capabilities = notifyCapabilities(role);
  const authority: NotifyAuthorityModel[] = notifyAuthorityTable().map((row) => ({
    capability: row.capability,
    heldByLine: row.heldBy.length === 0 ? sourceCopy.en["snc"] : sourceMessage(sourceCopy.en["p.t160"], { v1: row.heldBy.join(", ") }),
    heldByRole: row.heldBy.includes(role),
  }));

  const markEligibility = controller.canSend("mark-read");
  const resolveEligibility = controller.canSend("resolve");
  const markBlock = markEligibility.allowed ? null : (markEligibility.reason ?? sourceCopy.en["ss2"]);
  const resolveBlock = resolveEligibility.allowed ? null : (resolveEligibility.reason ?? sourceCopy.en["swi"]);

  const rows: NotifyRowModel[] = (snapshot?.notifications ?? []).map((row) => {
    const markable = assessment?.markable.some((item) => item.notificationRef === row.notificationRef) ?? false;
    const markReason =
      markBlock !== null
        ? markBlock
        : markable
          ? null
          : row.read
            ? sourceMessage(sourceCopy.en["p.t316"], { v1: row.notificationRef })
            : sourceCopy.en["s1w5"];
    const resolvable = assessment?.resolvable.some((item) => item.notificationRef === row.notificationRef) ?? false;
    const resolveReason =
      resolveBlock !== null
        ? resolveBlock
        : resolvable
          ? null
          : row.issueState === "stale-issue"
            ? "Issued under an older grant generation. Its offered action resolves nothing — it does not skip the current-generation check."
            : row.offer === null
              ? sourceCopy.en["s235"]
              : sourceCopy.en["s1vz"];
    return {
      notificationRef: row.notificationRef,
      kindWord: EVENT_WORDS[row.kind] ?? row.kind,
      dedupeKey: row.dedupeKey,
      seq: row.seq,
      issuedAt: row.issuedAt,
      readWord: row.read ? sourceCopy.en["s1av"] : sourceCopy.en["s25j"],
      issueWord: row.issueState === "current" ? sourceCopy.en["sfb"] : sourceCopy.en["s1lo"],
      issueState: row.issueState,
      sensitiveLine: row.sensitive
        ? row.detailState === "withheld"
          ? sourceCopy.en["s1jb"]
          : sourceCopy.en["s1ja"]
        : sourceCopy.en["s12k"],
      headline: row.headline,
      detailLine: row.detailState === "withheld" ? sourceCopy.en["sgh"] : (row.detail ?? ""),
      offerWord: row.offer === null ? sourceCopy.en["swh"] : (OFFER_WORDS[row.offer.kind] ?? row.offer.kind),
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
                sourceMessage(sourceCopy.en["p.t317"], { v1: last.receipt.kind, v2: last.receipt.notificationRef, v3: last.receipt.checkedGeneration }),
                `confirmsEconomicEffect ${String(last.receipt.confirmsEconomicEffect)} · externalSendWired ${String(last.receipt.externalSendWired)}`,
                last.receipt.kind === "resolved"
                  ? sourceCopy.en["s1gg"]
                  : sourceCopy.en["s31"],
              ]
            : [],
        };

  const counters = state.counters;
  const session: NotifySessionModel = {
    contextLine: sourceMessage(sourceCopy.en["p.t548"], { v1: actorRef, v2: state.context.scope.tenantId, v3: role, v4: state.context.incarnation, v5: state.context.environment }),
    capabilityLine: sourceMessage(sourceCopy.en["p.t549"], { v1: role, v2: capabilities.length === 0 ? "no capability" : capabilities.join(", ") }),
    countersLine: sourceMessage(sourceCopy.en["p.t318"], { v1: counters.reads, v2: counters.inquiries, v3: counters.acts, v4: counters.notSent, v5: counters.droppedReads, v6: counters.droppedInquiries }),
    earlierUnknownLine:
      state.earlierUnknown === 0
        ? sourceCopy.en["s131"]
        : sourceMessage(sourceCopy.en["p.t173"], { v1: state.earlierUnknown, v2: state.earlierUnknown === 1 ? "" : "s" }),
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
    scopeLine: sourceMessage(sourceCopy.en["p.t319"], { v1: state.context.scope.tenantId, v2: actorRef, v3: role }),
    generationLine: snapshot
      ? sourceMessage(sourceCopy.en["p.t320"], { v1: snapshot.grantRef, v2: snapshot.grantGeneration })
      : sourceCopy.en["svl"],
    watermarkLine: snapshot ? sourceMessage(sourceCopy.en["p.t41"], { v1: snapshot.watermark, v2: snapshot.snapshotId }) : sourceCopy.en["s134"],
    dedupeLine: snapshot ? sourceMessage(sourceCopy.en["p.t321"], { v1: snapshot.droppedDuplicates, v2: snapshot.droppedDuplicates === 1 ? "y" : "ies" }) : sourceCopy.en["sv2"],
    unreadLine: snapshot ? sourceMessage(sourceCopy.en["p.t322"], { v1: snapshot.unreadCount, v2: snapshot.notifications.length }) : sourceCopy.en["s132"],
    authority,
    focus:
      focus === null
        ? null
        : {
            title: sourceMessage(sourceCopy.en["p.t550"], { v1: focus.row.notificationRef }),
            lines: [
              sourceMessage(sourceCopy.en["p.t551"], { v1: EVENT_WORDS[focus.row.kind] ?? focus.row.kind, v2: focus.row.subjectRef, v3: focus.row.tenantId, v4: focus.row.headline }),
              sourceMessage(sourceCopy.en["p.t323"], { v1: focus.row.issuedAt, v2: focus.row.issueGeneration, v3: focus.row.issueState === "current" ? "Current issue." : "Stale issue.", v4: focus.row.read ? "Read." : "Unread." }),
              focus.row.detailState === "withheld" ? sourceCopy.en["sgh"] : sourceMessage(sourceCopy.en["p.t552"], { v1: focus.row.detail ?? "" }),
              sourceCopy.en["s22u"],
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
      ? sourceCopy.en["s77"]
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
            ? sourceMessage(sourceCopy.en["p.t324"], { v1: word })
            : sourceMessage(sourceCopy.en["p.t325"], { v1: word }),
        attention: false,
      };
    case "REJECTED":
      return {
        text: sourceMessage(sourceCopy.en["p.t176"], { v1: word, v2: result.record.code ?? "no code", v3: result.record.detail ?? "" }).trim(),
        attention: true,
      };
    case "UNKNOWN":
      return {
        text: sourceMessage(sourceCopy.en["p.t177"], { v1: word, v2: result.record.code ?? "no code" }),
        attention: true,
      };
    case "FENCED":
      return { text: sourceMessage(sourceCopy.en["p.t45"], { v1: word, v2: fenceText(result.fence) }), attention: true };
    case "NOT_SENT":
      return { text: sourceMessage(sourceCopy.en["p.t45"], { v1: word, v2: result.detail }), attention: true };
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
  const port = connectivityPort(notificationInboxPortFor(environment, { scenario }), "notification-inbox");
  return { port, controller: connectivityController(new NotificationInboxController(port, { actorRef, role }), port) };
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
      note(done ? sourceMessage(sourceCopy.en["p.t46"], { v1: moved }) : nothing, done);
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
        note(sourceCopy.en["s1a"], true);
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
          note(result.reason === "not-bound" ? NOTIFY_NOT_BOUND_REASON : sourceMessage(sourceCopy.en["p.t326"], { v1: result.detail }), true);
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
        note(sourceCopy.en["s73"], true);
        return;
      }
      setRole(nextRole);
      note(
        sourceMessage(sourceCopy.en["p.t327"], { v1: context.scope.role, v2: context.incarnation }),
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
        note(sourceCopy.en["s72"], true);
        return;
      }
      setActorRef(next);
      note(
        sourceMessage(sourceCopy.en["p.t328"], { v1: context.actorRef, v2: context.incarnation, v3: context.scope.role }),
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
        note(sourceCopy.en["s74"], true);
        return;
      }
      note(
        sourceMessage(sourceCopy.en["p.t329"], { v1: context.scope.tenantId, v2: context.incarnation }),
      );
      void session.controller.read();
    },
    revokeGrant() {
      const session = sessionRef.current;
      const grantRef = session?.controller.state().snapshot?.grantRef;
      synthetic(
        "revoke-grant",
        grantRef,
        sourceMessage(sourceCopy.en["p.t330"], { v1: grantRef ?? "?" }),
        sourceCopy.en["s1wm"],
      );
    },
    rotateGrant() {
      const session = sessionRef.current;
      const grantRef = session?.controller.state().snapshot?.grantRef;
      synthetic(
        "rotate-grant",
        grantRef,
        sourceMessage(sourceCopy.en["p.t331"], { v1: grantRef ?? "?" }),
        sourceCopy.en["s1wn"],
      );
    },
    deliverLate() {
      const session = sessionRef.current;
      const actor = session?.controller.state().context.actorRef;
      synthetic(
        "deliver-late",
        actor,
        sourceMessage(sourceCopy.en["p.t332"], { v1: actor ?? "?" }),
        sourceCopy.en["s1wr"],
      );
    },
    setScenario(next) {
      startSession(
        next,
        actorRef,
        role,
        sourceMessage(sourceCopy.en["p.t333"], { v1: next, v2: actorRef, v3: role }),
      );
    },
    newSession() {
      startSession(
        scenario,
        actorRef,
        role,
        sourceMessage(sourceCopy.en["p.t333"], { v1: scenario, v2: actorRef, v3: role }),
      );
    },
  };

  return {
    environment,
    scenario,
    actorRef,
    role,
    model: buildNotifyModel({ controller: sessionRef.current.controller, last }),
    actions: connectedActions(actions, ['markRead', 'revokeGrant', 'rotateGrant', 'deliverLate', 'setScenario', 'newSession'], sessionRef.current?.port),
  };
}
