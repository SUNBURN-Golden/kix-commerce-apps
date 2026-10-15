/**
 * The synthetic installable-mobile shell screen on top of the adapter's
 * synthetic shell source. Stub scope: the default port is the synthetic
 * source. On integration-http the same port is not-bound: the contract-only
 * catalogue has no install, session, vault, presentation, or device command,
 * and this module does not invent one, send a second attempt, or switch
 * adapters.
 *
 * This module computes no validity, no expiry, and no amount. It copies what
 * the controller and the last read hold and says, for every control that is
 * off, why it is off. A stored vault item is a copy: shown offline it mints
 * no admission right, and the device clock never decides validity. An app
 * resume re-executes nothing.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MOBILE_AS_OF,
  MOBILE_DESK_ACTOR,
  MOBILE_GUEST_ACTOR,
  MOBILE_HOLD_NOT_BOUND,
  MOBILE_IDENTITY_REGISTER,
  MOBILE_NOT_BOUND_REASON,
  MOBILE_UNIT,
  MobileShellController,
  mobileShellPortFor,
  projectMobile,
  type MobileFence,
  type MobileIdentityRow,
  type MobileIntent,
  type MobileReadState,
  type MobileRefreshCause,
  type MobileScenario,
  type MobileShellPort,
  type MobileStepInput,
  type MobileStepResult,
  type MobileSupportRow,
  type MobileVaultView,
} from "@kix/protocol-adapter";
import { protocol } from "./protocol";

export const MOBILE_TITLE = "Installable mobile shell (synthetic)";

export const MOBILE_SOURCE_LINE =
  "The install record, the session, the stored items, and the pending order come from a synthetic shell source on this page load. They are not a store listing, not a device attestation, not an authentication result, and not a producer read. Every row is labelled synthetic.";

export const MOBILE_BOUNDARY =
  "Install, update, reconnect, present, confirm, and withdraw are six separate lines. None of them completes the others, and none is a catalogue command.";

export const MOBILE_VAULT_NOTE =
  "A stored item is a copy. It keeps the validity verdict the source stated and the instant it stated it. Shown while the link is down it mints no admission, opens no gate, and is never sent as authority.";

export const MOBILE_CLOCK_NOTE =
  "The device clock is report-only. The source's own instant decides validity and expiry. A skewed or missing device clock marks stored verdicts uncertain; it never decides them.";

export const MOBILE_RESUME_NOTE =
  "An app resume re-executes nothing. Coming back to the foreground marks the held read resumed and fences every write until an explicit read lands. An uncertain confirm or withdraw stays unknown and is never retried.";

export const MOBILE_SESSION_NOTE =
  "A session is a source verdict, not a device claim. When the source says the session is expired, writes that need a session stay fenced until reconnect opens a new one. Re-login under another actor reuses no session and no stored copy.";

export const MOBILE_FENCE_NOTE =
  "One write is sent at a time per scope, and each is sent once. This page does not send a write again, does not mint an intent for you, and does not undo one with another.";

export const MOBILE_READ_NOTE =
  "One read follows each settled write so the next step can use fresh evidence. Nothing polls. A read is evidence and never resolves an unknown write.";

export const MOBILE_ORDER_NOTE =
  "The pending order's confirm and withdraw each write one synthetic record. A confirmation record is not a payment and moves no funds; a withdrawal record executes nothing and returns no funds.";

export const MOBILE_SUPPORT_NOTE =
  "The support range below is this stub's decision, not a capability claim. Installable web packaging and an in-place update are covered; a native store shell, push, and background sync are unsupported; real-device evidence stays unverified.";

export const MOBILE_HOLD_NOTE = `Holding a seat is not available here. ${MOBILE_HOLD_NOT_BOUND.reason}`;

export const MOBILE_AMOUNT_NOTE = `Amounts are the source's own text in ${MOBILE_UNIT}, a synthetic unit. An order with no amount shows UNDETERMINED. This page does not compute, convert, or verify any amount.`;

export const SCENARIO_NOTES: Readonly<Record<MobileScenario, string>> = {
  clean: "Installed shell, active session, three stored items, and one pending order.",
  empty: "A fresh device: nothing installed, no session, no stored items, no order.",
  stale: "The source serves a watermark older than the floor this page holds. Stored items stay cached copies.",
  "update-available": "The source offers a shell update. Applying it is one synthetic write.",
  "session-expired": "The session verdict is expired. Reconnect opens a new session; the expired verdict is never revived.",
  offline: "The link starts down. Reads answer offline and writes answer unknown; stored items are cached copies only.",
  "production-claimed": "The source declares a production environment. The read is refused before any snapshot is applied.",
  "confirm-lost": "A confirm is applied at the source and its answer is lost. A late result can be delivered later.",
  "withdraw-lost": "A withdraw is applied at the source and its answer is lost. A late result can be delivered later.",
  "held-response": "Answers are held until you deliver them. Use it to switch the session while a write is in flight.",
  "read-lost": "The answer to a read never arrives. The read stays in flight until the context changes.",
  "claims-grant": "The read payload claims an admission grant. The whole payload is refused before a row shows.",
  "receipt-claims": "The read is clean but a confirmed answer claims an admission grant. The write is unknown.",
};

const STEP_WORDS: Readonly<Record<MobileStepInput["step"], string>> = {
  install: "Install",
  update: "Apply update",
  reconnect: "Reconnect session",
  present: "Present pass",
  confirm: "Confirm order",
  withdraw: "Withdraw order",
};

export type MobileScreenState =
  | "loading"
  | "unread"
  | "ready"
  | "empty"
  | "stale"
  | "offline"
  | "refused"
  | "environment-refused"
  | "not-bound"
  | "unavailable"
  | "tuple-changed";

export type MobileClockMode = "in-step" | "skewed" | "unreported";

export const MOBILE_CLOCK_MODES: readonly MobileClockMode[] = ["in-step", "skewed", "unreported"];

export const MOBILE_CLOCK_MODE_NOTES: Readonly<Record<MobileClockMode, string>> = {
  "in-step": "The reported device clock sits inside the skew bound.",
  skewed: "The reported device clock is out of step. Stored verdicts read clock-uncertain; the authority still decides.",
  unreported: "No device clock is reported. Stored verdicts read clock-uncertain; the authority still decides.",
};

export interface ControlModel {
  enabled: boolean;
  /** Why the control is off. Null when it is on. */
  reason: string | null;
}

export interface InstallModel {
  stateWord: "installed" | "none";
  installLine: string;
  shellLine: string;
  updateLine: string | null;
  install: ControlModel;
  update: ControlModel;
}

export interface SessionViewModel {
  sessionRef: string | null;
  stateWord: string;
  actorLine: string;
  verdictLine: string;
  reconnect: ControlModel;
}

export interface DeviceModel {
  linkWord: "online" | "offline";
  linkLine: string;
  clockWord: string;
  clockLine: string;
}

export interface VaultItemModel {
  vaultRef: string;
  kind: string;
  label: string;
  ownerLine: string;
  storedLine: string;
  verdictWord: string;
  verdictLine: string;
  currencyWord: string;
  currencyLabel: string;
  presentLine: string;
  present: ControlModel;
}

export interface OrderViewModel {
  orderRef: string;
  stateWord: string;
  amountWord: string;
  versionLine: string;
  confirmLine: string;
  withdrawLine: string;
  confirm: ControlModel;
  withdraw: ControlModel;
}

export interface IntentRow {
  seq: number;
  intentRef: string;
  stepWord: string;
  targetRef: string;
  outcome: string;
  code: string;
  lateLine: string;
}

export interface RecordModel {
  contextLine: string;
  countersLine: string;
  intents: IntentRow[];
  quarantineLines: string[];
  unlinkedLines: string[];
}

export interface IdentityRowModel {
  id: string;
  shellField: string;
  statusWord: string;
  status: MobileIdentityRow["status"];
  bodyFields: string;
  reason: string;
}

export interface SupportRowModel {
  id: string;
  verdict: MobileSupportRow["verdict"];
  note: string;
}

export type LastAction =
  | { seq: number; kind: "step"; step: MobileStepInput["step"]; result: MobileStepResult }
  | { seq: number; kind: "note"; text: string };

export interface MobileModel {
  state: MobileScreenState;
  statusLine: string;
  detailLine: string;
  actionLabel: string | null;
  freshnessWord: string;
  cachedWord: string | null;
  environmentLine: string;
  device: DeviceModel;
  install: InstallModel | null;
  session: SessionViewModel | null;
  vault: VaultItemModel[];
  order: OrderViewModel | null;
  support: SupportRowModel[];
  record: RecordModel;
  identity: IdentityRowModel[];
  lastLine: string | null;
  lastNeedsFocus: boolean;
  lastSeq: number | null;
}

export function causeLine(cause: MobileRefreshCause): string {
  switch (cause) {
    case "own-write":
      return "Your own write landed after the last read.";
    case "stale-rejection":
      return "The source said the last read was behind.";
    case "context-switch":
      return "The session context changed.";
    case "resumed":
      return "The app resumed. A resume re-executes nothing; an explicit read must land first.";
    case "cached-read":
      return "The last read landed no current evidence; the held copy is cached only and the link coming back freshens nothing.";
    default: {
      const exhaustive: never = cause;
      return exhaustive;
    }
  }
}

/** Why a write is off. Each fence maps to one sentence and no fence is a failure of the page. */
export function fenceLine(fence: MobileFence): string {
  switch (fence.reason) {
    case "in-flight":
      return `A write in this scope is in flight (${fence.intentRef}). Wait for its answer.`;
    case "unknown-outcome": {
      const late = fence.lateRecorded ? " A late result was recorded, and it does not make the write known." : "";
      const earlier = fence.earlierContext ? " It was sent in an earlier session context." : "";
      return `An earlier write in this scope has an unknown result (${fence.intentRef}).${late}${earlier} Writes in this scope stay blocked. A read does not resolve it.`;
    }
    case "no-snapshot":
      return "No read is held. Read the source first.";
    case "empty-device":
      return "Nothing is installed on this device in this read. Install is the only write that can go.";
    case "snapshot-stale":
      return `The held read is not current. ${causeLine(fence.cause)} Read again.`;
    case "duplicate-intent":
      return `Intent ${fence.intentRef} was already used. A write is sent once; this page does not mint a new intent for it.`;
    case "link-offline":
      return "The link is down. No write goes out while the link is down, and a stored copy is never sent as authority.";
    case "environment":
      return "The read was refused for the environment. No write goes out.";
    case "session-expired":
      return "No active session for this actor is recorded at the source. Reconnect first; the expired session is never revived.";
    case "already-installed":
      return `Install ${fence.installRef} is already on this device. Installing again is not an update.`;
    case "session-active":
      return `Session ${fence.sessionRef} is already active for this actor. Reconnecting mints no second session.`;
    case "no-update":
      return "The source offers no shell update. There is nothing to apply.";
    case "not-bound":
      return MOBILE_NOT_BOUND_REASON;
    default: {
      const exhaustive: never = fence;
      return exhaustive;
    }
  }
}

export function stepResultLine(step: MobileStepInput["step"], result: MobileStepResult): string {
  const word = STEP_WORDS[step];
  switch (result.kind) {
    case "CONFIRMED":
      return `${word} confirmed by the synthetic source. This is a synthetic record, not a payment, an admission, or an attestation.`;
    case "REJECTED":
      return `${word} rejected (${result.intent.code ?? "no code"}). ${result.intent.message ?? ""} The source applied nothing for this write.`.trim();
    case "UNKNOWN":
      return `${word} result unknown (${result.intent.code ?? "no code"}). It may or may not have applied. Writes in this scope are blocked, and neither a read, a resume, nor a late result resolves it.`;
    case "QUARANTINED":
      return `The result of the ${word.toLowerCase()} arrived after the session context changed. It was quarantined and applied nowhere. The write stays unknown.`;
    case "FENCED":
      return `${word} not sent. ${fenceLine(result.fence)}`;
    case "NOT_SENT":
      return `${word} not sent. ${result.detail}`;
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

function attentionFor(last: LastAction | null): boolean {
  if (last === null || last.kind === "note") {
    return false;
  }
  return last.result.kind !== "CONFIRMED";
}

function control(fence: MobileFence | null): ControlModel {
  return fence === null ? { enabled: true, reason: null } : { enabled: false, reason: fenceLine(fence) };
}

function readStateToScreen(readState: MobileReadState, refreshRequired: MobileRefreshCause | null): MobileScreenState {
  switch (readState) {
    case "none":
      return refreshRequired === "context-switch" ? "unread" : "loading";
    case "ready":
      return "ready";
    case "empty":
      return "empty";
    case "stale":
      return "stale";
    case "offline":
      return "offline";
    case "refused":
      return "refused";
    case "environment-refused":
      return "environment-refused";
    case "not-bound":
      return "not-bound";
    case "tuple-changed":
      return "tuple-changed";
    case "unavailable":
      return "unavailable";
    default: {
      const exhaustive: never = readState;
      return exhaustive;
    }
  }
}

function statusFor(
  state: MobileScreenState,
  detail: string | null,
): { statusLine: string; detailLine: string; actionLabel: string | null } {
  switch (state) {
    case "loading":
      return { statusLine: "Reading the synthetic shell source. Nothing is confirmed yet.", detailLine: "", actionLabel: null };
    case "unread":
      return {
        statusLine: "The session context changed, so there is no read in this context.",
        detailLine: "Read again to see the shell from this context. An earlier unknown write still blocks its scope.",
        actionLabel: "Read again",
      };
    case "ready":
      return { statusLine: "Shell read.", detailLine: "", actionLabel: null };
    case "empty":
      return {
        statusLine: "Nothing is installed on this device.",
        detailLine: "No session, no stored items, no order. Install is the one write that can go.",
        actionLabel: "Read again",
      };
    case "stale":
      return {
        statusLine: "Stale shell read.",
        detailLine: detail ?? "",
        actionLabel: "Read again",
      };
    case "offline":
      return {
        statusLine: "The link is down. Stored items are cached copies, not current authority.",
        detailLine: detail ?? "",
        actionLabel: "Read again",
      };
    case "refused":
      return {
        statusLine: "The read payload was refused whole before any row was shown.",
        detailLine: detail ?? "",
        actionLabel: "Start a new synthetic session",
      };
    case "environment-refused":
      return {
        statusLine: "The source declares a production environment. This shell serves installable-sandbox only.",
        detailLine: detail ?? "",
        actionLabel: "Start a new synthetic session",
      };
    case "not-bound":
      return { statusLine: MOBILE_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: "The pin tuple changed. Nothing was read and nothing was applied.",
        detailLine: detail ?? "",
        actionLabel: "Start a new synthetic session",
      };
    case "unavailable":
      return {
        statusLine: "The source did not answer. This is not an empty device.",
        detailLine: detail ?? "",
        actionLabel: "Read again",
      };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function intentWord(intent: MobileIntent): string {
  return STEP_WORDS[intent.step];
}

function lateLineOf(intent: MobileIntent): string {
  if (intent.late === null) {
    return "";
  }
  const code = intent.late.code ? ` (${intent.late.code})` : "";
  return `Late result ${intent.late.result}${code}. Evidence only.`;
}

/** The unused-intent id the gate preview asks with. It is never sent. */
const GATE_PREVIEW = "gate-preview";

const CURRENCY_LABELS: Readonly<Record<MobileVaultView["currency"], string>> = {
  current: "current authority",
  cached: "cached copy",
  "clock-uncertain": "clock-uncertain",
};

function describeVaultItem(item: MobileVaultView, present: ControlModel): VaultItemModel {
  const presentLine =
    item.present === null
      ? "No presentation sent by this page."
      : item.present.outcome === "CONFIRMED"
        ? `Presentation ${item.present.presentationRef ?? ""} confirmed by the synthetic source. It is a display record, not admission.`
        : `${item.present.outcome === "IN_FLIGHT" ? "Presentation in flight" : `Presentation ${item.present.outcome.toLowerCase()}`}${item.present.code ? ` (${item.present.code})` : ""}.`;
  return {
    vaultRef: item.vaultRef,
    kind: item.kind,
    label: item.label,
    ownerLine: item.ownerMatch
      ? `Stored for ${item.ownerRef}, the current context actor.`
      : `Stored for ${item.ownerRef}. This context actor is different; the copy is not transferable.`,
    storedLine: `Stored at ${item.cachedAt}.`,
    verdictWord: item.authorityVerdict,
    verdictLine: `Source verdict ${item.authorityVerdict}, stated at ${item.verdictAt}.`,
    currencyWord: item.currency,
    currencyLabel: CURRENCY_LABELS[item.currency],
    presentLine,
    present,
  };
}

export function buildMobileModel(input: {
  controller: MobileShellController;
  last: LastAction | null;
}): MobileModel {
  const { controller } = input;
  const state = controller.state();
  const screen = readStateToScreen(state.readState, state.refreshRequired);
  const status = statusFor(screen, state.readDetail);
  const projection = projectMobile(state);
  const freshnessWord =
    state.freshness === "CURRENT"
      ? "The last read is current."
      : state.freshness === "STALE"
        ? "The last read is behind, resumed, or unreachable."
        : "There is no usable read.";
  const cachedWord = state.cached
    ? "Showing a cached copy: the last read could not be freshened. Cached is never current authority."
    : null;
  const environment = state.snapshot?.environment ?? null;
  const environmentLine = environment
    ? `Environment ${environment.shellEnvironment}, device ${environment.deviceId}, watermark ${state.snapshot?.watermark ?? "none"}. Synthetic only; every row is a synthetic row.`
    : "No environment is read. Environment and device are carried on every read and write.";

  const install: InstallModel | null = (() => {
    const gate = controller.gateFor({ step: "install", intentRef: GATE_PREVIEW });
    const installView = projection.install;
    if (installView === null) {
      return {
        stateWord: "none",
        installLine: "No install record in this read.",
        shellLine: "No shell reference.",
        updateLine: null,
        install: control(gate),
        update: control(controller.gateFor({ step: "update", intentRef: GATE_PREVIEW })),
      };
    }
    return {
      stateWord: installView.state,
      installLine:
        installView.state === "installed"
          ? `Install ${installView.installRef} on this device. A synthetic record, not a verified install attestation.`
          : "No install record in this read.",
      shellLine:
        installView.state === "installed" ? `Shell ${installView.shellRef} at version ${installView.version}.` : "No shell reference.",
      updateLine:
        installView.update === null
          ? null
          : `Update ${installView.update.updateRef} offers ${installView.update.toShell}. ${installView.update.note}`,
      install: control(gate),
      update: control(controller.gateFor({ step: "update", intentRef: GATE_PREVIEW })),
    };
  })();

  const session: SessionViewModel | null = (() => {
    const sessionView = projection.session;
    if (sessionView === null) {
      return null;
    }
    return {
      sessionRef: sessionView.sessionRef,
      stateWord: sessionView.state,
      actorLine:
        sessionView.actorRef === null
          ? "No session actor."
          : `Session actor ${sessionView.actorRef}. A context label, not an authentication result.`,
      verdictLine: sessionView.note,
      reconnect: control(controller.gateFor({ step: "reconnect", intentRef: GATE_PREVIEW })),
    };
  })();

  const device: DeviceModel = {
    linkWord: state.link,
    linkLine:
      state.link === "online"
        ? "The link is up. One read or one write per call."
        : "The link is down. Reads answer offline, writes answer unknown, and stored items stay cached copies.",
    clockWord: projection.clock?.verdict ?? "unread",
    clockLine: projection.clock === null ? "No clock verdict is read." : projection.clock.note,
  };

  const vault = projection.vault.map((item) =>
    describeVaultItem(item, control(controller.gateFor({ step: "present", intentRef: GATE_PREVIEW, vaultRef: item.vaultRef }))),
  );

  const order: OrderViewModel | null = projection.order === null ? null : describeOrder(projection.order, controller);

  const intents: IntentRow[] = state.intents.map((intent) => ({
    seq: intent.seq,
    intentRef: intent.intentRef,
    stepWord: intentWord(intent),
    targetRef: intent.targetRef,
    outcome: intent.outcome,
    code: intent.code ?? "",
    lateLine: lateLineOf(intent),
  }));

  const quarantineLines = state.quarantined.map(
    (item) => `Result ${item.arrived} for ${item.intentRef} was quarantined (${item.cause}). It changed nothing.`,
  );
  const unlinkedLines = projection.unlinkedIntents.map(
    (intent) =>
      `${intentWord(intent)} ${intent.intentRef} on ${intent.targetRef} is ${intent.outcome.toLowerCase().replace("_", " ")}. No snapshot row is linked to it, and a row seen in a read is not claimed for it.`,
  );

  const counters = state.counters;
  const record: RecordModel = {
    contextLine: `Actor ${state.context.actorRef}, device ${state.context.deviceId}, session ${state.context.incarnation}, mode ${state.context.environment}.`,
    countersLine: `Sent ${counters.sent}. Blocked before sending ${counters.fenced}. Not sent ${counters.notSent}. Reads dropped ${counters.droppedReads}.`,
    intents,
    quarantineLines,
    unlinkedLines,
  };

  const identity: IdentityRowModel[] = MOBILE_IDENTITY_REGISTER.map((row) => ({
    id: row.id,
    shellField: row.shellField,
    status: row.status,
    statusWord: row.status === "field-named" ? "Field named in the pin" : "Not-bound",
    bodyFields: row.bodyFields.length === 0 ? "none" : row.bodyFields.map((entry) => `${entry.action}.${entry.field}`).join(", "),
    reason: row.reason,
  }));

  const support: SupportRowModel[] = projection.support.map((row) => ({ id: row.id, verdict: row.verdict, note: row.note }));

  let lastLine: string | null = null;
  if (input.last !== null) {
    lastLine = input.last.kind === "note" ? input.last.text : stepResultLine(input.last.step, input.last.result);
  }

  return {
    state: screen,
    statusLine: status.statusLine,
    detailLine: status.detailLine,
    actionLabel: status.actionLabel,
    freshnessWord,
    cachedWord,
    environmentLine,
    device,
    install,
    session,
    vault,
    order,
    support,
    record,
    identity,
    lastLine,
    lastNeedsFocus: attentionFor(input.last),
    lastSeq: input.last === null ? null : input.last.seq,
  };
}

function describeOrder(
  order: NonNullable<ReturnType<typeof projectMobile>["order"]>,
  controller: MobileShellController,
): OrderViewModel {
  const writeLine = (view: { outcome: string; code: string | null } | null, verb: string): string => {
    if (view === null) {
      return `${verb}: no write sent by this page.`;
    }
    const code = view.code ? ` (${view.code})` : "";
    switch (view.outcome) {
      case "CONFIRMED":
        return `${verb}: confirmed by the synthetic source. A record, not funds.`;
      case "REJECTED":
        return `${verb}: rejected${code}.`;
      case "UNKNOWN":
        return `${verb}: unknown${code}. The write may or may not have applied; it is not re-executed.`;
      case "IN_FLIGHT":
        return `${verb}: in flight.`;
      default:
        return `${verb}: not sent${code}.`;
    }
  };
  return {
    orderRef: order.orderRef,
    stateWord: order.state,
    amountWord:
      order.amount === null
        ? `Amount: UNDETERMINED (${MOBILE_UNIT})`
        : `Amount ${order.amount} ${order.currency}, the source's own text.`,
    versionLine: `Order at version ${order.version} in the last read. Payment record ${order.paymentRef ?? "none"}. Withdrawal record ${order.withdrawalRef ?? "none"}.`,
    confirmLine: writeLine(order.confirm, "Confirm"),
    withdrawLine: writeLine(order.withdraw, "Withdraw"),
    confirm: control(controller.gateFor({ step: "confirm", intentRef: GATE_PREVIEW, orderRef: order.orderRef })),
    withdraw: control(controller.gateFor({ step: "withdraw", intentRef: GATE_PREVIEW, orderRef: order.orderRef })),
  };
}

export interface MobileActions {
  refresh(): void;
  install(): void;
  update(): void;
  reconnect(): void;
  present(vaultRef: string): void;
  confirm(orderRef: string): void;
  withdraw(orderRef: string): void;
  resume(): void;
  dropConnection(): void;
  restoreConnection(): void;
  offerUpdate(): void;
  expireSession(): void;
  deliverHeld(): void;
  deliverLate(): void;
  switchContext(): void;
  newSession(): void;
  setScenario(next: MobileScenario): void;
  setClockMode(next: MobileClockMode): void;
}

interface Session {
  port: MobileShellPort;
  controller: MobileShellController;
}

export function useMobileShell(): {
  environment: "stub" | "integration-http";
  scenario: MobileScenario;
  clockMode: MobileClockMode;
  model: MobileModel;
  actions: MobileActions;
} {
  const environment = protocol.describe().environment;
  const clockRef = useRef<MobileClockMode>("in-step");
  const sessionRef = useRef<Session | null>(null);
  if (sessionRef.current === null) {
    const port = mobileShellPortFor(environment, { scenario: "clean" });
    sessionRef.current = {
      port,
      controller: new MobileShellController(port, {
        actorRef: MOBILE_DESK_ACTOR,
        deviceNow: () =>
          clockRef.current === "in-step" ? MOBILE_AS_OF : clockRef.current === "skewed" ? "2026-10-14T00:00:00.000Z" : null,
      }),
    };
  }
  const [scenario, setScenarioState] = useState<MobileScenario>("clean");
  const [clockMode, setClockModeState] = useState<MobileClockMode>("in-step");
  const [epoch, setEpoch] = useState(0);
  const [, setTick] = useState(0);
  const [last, setLast] = useState<LastAction | null>(null);
  const intentCounter = useRef(0);
  const actionSeq = useRef(0);

  useEffect(() => {
    const session = sessionRef.current;
    if (session === null) {
      return undefined;
    }
    const off = session.controller.subscribe(() => setTick((value) => value + 1));
    void session.controller.refresh();
    return off;
  }, [epoch]);

  const note = useCallback((text: string) => {
    actionSeq.current += 1;
    setLast({ seq: actionSeq.current, kind: "note", text });
  }, []);

  const nextIntent = useCallback(() => {
    intentCounter.current += 1;
    return `intent-${intentCounter.current}`;
  }, []);

  const run = useCallback(
    async (input: MobileStepInput) => {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const result = await session.controller.run(input);
      if (sessionRef.current !== session) {
        return;
      }
      actionSeq.current += 1;
      setLast({ seq: actionSeq.current, kind: "step", step: input.step, result });
      // A quarantined result belongs to a context this page left, so it has nothing to refresh.
      if (result.kind === "CONFIRMED" || result.kind === "REJECTED" || result.kind === "UNKNOWN") {
        await session.controller.refresh();
      }
    },
    [],
  );

  const startSession = useCallback(
    (next: MobileScenario, text: string) => {
      const port = mobileShellPortFor(environment, { scenario: next });
      sessionRef.current = {
        port,
        controller: new MobileShellController(port, {
          actorRef: MOBILE_DESK_ACTOR,
          deviceNow: () =>
            clockRef.current === "in-step" ? MOBILE_AS_OF : clockRef.current === "skewed" ? "2026-10-14T00:00:00.000Z" : null,
        }),
      };
      intentCounter.current = 0;
      setScenarioState(next);
      setEpoch((value) => value + 1);
      note(text);
    },
    [environment, note],
  );

  const actions: MobileActions = {
    refresh() {
      void sessionRef.current?.controller.refresh();
    },
    install() {
      void run({ step: "install", intentRef: nextIntent() });
    },
    update() {
      void run({ step: "update", intentRef: nextIntent() });
    },
    reconnect() {
      void run({ step: "reconnect", intentRef: nextIntent() });
    },
    present(vaultRef) {
      void run({ step: "present", intentRef: nextIntent(), vaultRef });
    },
    confirm(orderRef) {
      void run({ step: "confirm", intentRef: nextIntent(), orderRef });
    },
    withdraw(orderRef) {
      void run({ step: "withdraw", intentRef: nextIntent(), orderRef });
    },
    resume() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      session.controller.resume();
      note("The app resumed. Nothing was re-executed; writes stay fenced until an explicit read lands current evidence.");
    },
    dropConnection() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      session.port.dropConnection();
      note("The link is down. Reads answer offline, writes answer unknown, and stored items stay cached copies.");
    },
    restoreConnection() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      session.port.restoreConnection();
      note("The link is back. Nothing that was lost is replayed; read again to land current evidence.");
    },
    offerUpdate() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      session.port.offerUpdate();
      note("The source offers a shell update. Read again to see it; applying it is one write.");
    },
    expireSession() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      session.port.expireSession();
      note("The source expired the session verdict. Read again, then reconnect to open a new session.");
    },
    deliverHeld() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const count = session.port.deliverHeld();
      note(count === 0 ? "No held response to deliver." : `Delivered ${count} held response${count === 1 ? "" : "s"}.`);
    },
    deliverLate() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const due = session.port.deliverLate();
      if (due.length === 0) {
        note("No late result is due.");
        return;
      }
      const lines = due.map((delivery) => {
        const outcome = session.controller.acceptLate(delivery);
        return outcome.kind === "RECORDED"
          ? `Late result ${delivery.result} recorded for ${delivery.intentRef}. The write stays unknown.`
          : `Late result for ${delivery.intentRef} was quarantined (${outcome.cause}).`;
      });
      note(lines.join(" "));
    },
    switchContext() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const current = session.controller.state().context.actorRef;
      const next = session.controller.switchContext({
        actorRef: current === MOBILE_DESK_ACTOR ? MOBILE_GUEST_ACTOR : MOBILE_DESK_ACTOR,
      });
      note(
        `Session context switched to ${next.actorRef}, session ${next.incarnation}. A write in flight is now unknown and its result will be quarantined. The earlier actor's session and stored copies are not reused. Read again.`,
      );
    },
    newSession() {
      startSession(scenario, "Started a new synthetic session. Earlier intents are gone, as after a reload. Nothing was resolved at the source.");
    },
    setScenario(next) {
      startSession(next, `Started a new synthetic session with scenario ${next}. Earlier intents are gone, as after a reload.`);
    },
    setClockMode(next) {
      clockRef.current = next;
      setClockModeState(next);
      note(`Device clock mode set to ${next}. ${MOBILE_CLOCK_MODE_NOTES[next]} Read again to see the verdict.`);
    },
  };

  const session = sessionRef.current;
  return {
    environment,
    scenario,
    clockMode,
    model: buildMobileModel({ controller: session.controller, last }),
    actions,
  };
}
