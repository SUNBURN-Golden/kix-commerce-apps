import { messages as sourceCopy } from "./i18n/messages/installable-mobile";
import { sourceMessage } from "./i18n/source-message";
import { connectivityPort, connectivityController, connectedActions } from "./connectivity/write-guard";
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
import { protocol } from "./connectivity/desk-protocol";

export const MOBILE_TITLE = sourceCopy.en["so1"];

export const MOBILE_SOURCE_LINE =
  sourceCopy.en["s1ta"];

export const MOBILE_BOUNDARY =
  sourceCopy.en["so7"];

export const MOBILE_VAULT_NOTE =
  sourceCopy.en["s8i"];

export const MOBILE_CLOCK_NOTE =
  sourceCopy.en["s1rx"];

export const MOBILE_RESUME_NOTE =
  sourceCopy.en["s3g"];

export const MOBILE_SESSION_NOTE =
  sourceCopy.en["s81"];

export const MOBILE_FENCE_NOTE =
  sourceCopy.en["s14k"];

export const MOBILE_READ_NOTE =
  sourceCopy.en["s14c"];

export const MOBILE_ORDER_NOTE =
  sourceCopy.en["s1v4"];

export const MOBILE_SUPPORT_NOTE =
  sourceCopy.en["s21l"];

export const MOBILE_HOLD_NOTE = sourceMessage(sourceCopy.en["p.t8"], { v1: MOBILE_HOLD_NOT_BOUND.reason });

export const MOBILE_AMOUNT_NOTE = sourceMessage(sourceCopy.en["p.t185"], { v1: MOBILE_UNIT });

export const SCENARIO_NOTES: Readonly<Record<MobileScenario, string>> = {
  clean: sourceCopy.en["so3"],
  empty: sourceCopy.en["s23"],
  stale: sourceCopy.en["s21b"],
  "update-available": sourceCopy.en["s203"],
  "session-expired": sourceCopy.en["s1y0"],
  offline: sourceCopy.en["s1u1"],
  "production-claimed": sourceCopy.en["s1yr"],
  "confirm-lost": sourceCopy.en["su"],
  "withdraw-lost": sourceCopy.en["s9c"],
  "held-response": sourceCopy.en["s4o"],
  "read-lost": sourceCopy.en["s1q4"],
  "claims-grant": sourceCopy.en["s1w7"],
  "receipt-claims": sourceCopy.en["s1w2"],
};

const STEP_WORDS: Readonly<Record<MobileStepInput["step"], string>> = {
  install: sourceCopy.en["snz"],
  update: sourceCopy.en["s5s"],
  reconnect: sourceCopy.en["s1do"],
  present: sourceCopy.en["s18y"],
  confirm: sourceCopy.en["sdl"],
  withdraw: sourceCopy.en["s26t"],
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
  "in-step": sourceCopy.en["s1x2"],
  skewed: sourceCopy.en["s1x1"],
  unreported: sourceCopy.en["sv4"],
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
      return sourceCopy.en["s279"];
    case "stale-rejection":
      return sourceCopy.en["s20g"];
    case "context-switch":
      return sourceCopy.en["s1xw"];
    case "resumed":
      return sourceCopy.en["s1qa"];
    case "cached-read":
      return sourceCopy.en["s1tp"];
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
      return sourceMessage(sourceCopy.en["p.t186"], { v1: fence.intentRef });
    case "unknown-outcome": {
      const late = fence.lateRecorded ? " A late result was recorded, and it does not make the write known." : "";
      const earlier = fence.earlierContext ? " It was sent in an earlier session context." : "";
      return sourceMessage(sourceCopy.en["p.t187"], { v1: fence.intentRef, v2: late, v3: earlier });
    }
    case "no-snapshot":
      return sourceCopy.en["sxh"];
    case "empty-device":
      return sourceCopy.en["s119"];
    case "snapshot-stale":
      return sourceMessage(sourceCopy.en["p.t188"], { v1: causeLine(fence.cause) });
    case "duplicate-intent":
      return sourceMessage(sourceCopy.en["p.t189"], { v1: fence.intentRef });
    case "link-offline":
      return sourceCopy.en["s1tx"];
    case "environment":
      return sourceCopy.en["s1wc"];
    case "session-expired":
      return sourceCopy.en["stu"];
    case "already-installed":
      return sourceMessage(sourceCopy.en["p.t190"], { v1: fence.installRef });
    case "session-active":
      return sourceMessage(sourceCopy.en["p.t191"], { v1: fence.sessionRef });
    case "no-update":
      return sourceCopy.en["s205"];
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
      return sourceMessage(sourceCopy.en["p.t192"], { v1: word });
    case "REJECTED":
      return sourceMessage(sourceCopy.en["p.t193"], { v1: word, v2: result.intent.code ?? "no code", v3: result.intent.message ?? "" }).trim();
    case "UNKNOWN":
      return sourceMessage(sourceCopy.en["p.t194"], { v1: word, v2: result.intent.code ?? "no code" });
    case "QUARANTINED":
      return sourceMessage(sourceCopy.en["p.t102"], { v1: word.toLowerCase() });
    case "FENCED":
      return sourceMessage(sourceCopy.en["p.t45"], { v1: word, v2: fenceLine(result.fence) });
    case "NOT_SENT":
      return sourceMessage(sourceCopy.en["p.t45"], { v1: word, v2: result.detail });
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
      return { statusLine: sourceCopy.en["s1bp"], detailLine: "", actionLabel: null };
    case "unread":
      return {
        statusLine: sourceCopy.en["s1xx"],
        detailLine: sourceCopy.en["s1b4"],
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "ready":
      return { statusLine: sourceCopy.en["s1k8"], detailLine: "", actionLabel: null };
    case "empty":
      return {
        statusLine: sourceCopy.en["s11a"],
        detailLine: sourceCopy.en["syk"],
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "stale":
      return {
        statusLine: sourceCopy.en["s1m0"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "offline":
      return {
        statusLine: sourceCopy.en["s1tz"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "refused":
      return {
        statusLine: sourceCopy.en["s1w9"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1m2"],
      };
    case "environment-refused":
      return {
        statusLine: sourceCopy.en["s1ys"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1m2"],
      };
    case "not-bound":
      return { statusLine: MOBILE_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: sourceCopy.en["s1v8"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1m2"],
      };
    case "unavailable":
      return {
        statusLine: sourceCopy.en["s1z2"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1ax"],
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
  return sourceMessage(sourceCopy.en["p.t195"], { v1: intent.late.result, v2: code });
}

/** The unused-intent id the gate preview asks with. It is never sent. */
const GATE_PREVIEW = "gate-preview";

const CURRENCY_LABELS: Readonly<Record<MobileVaultView["currency"], string>> = {
  current: sourceCopy.en["sf7"],
  cached: sourceCopy.en["sar"],
  "clock-uncertain": "clock-uncertain",
};

function describeVaultItem(item: MobileVaultView, present: ControlModel): VaultItemModel {
  const presentLine =
    item.present === null
      ? sourceCopy.en["swy"]
      : item.present.outcome === "CONFIRMED"
        ? sourceMessage(sourceCopy.en["p.t196"], { v1: item.present.presentationRef ?? "" })
        : `${item.present.outcome === "IN_FLIGHT" ? sourceCopy.en["s18w"] : sourceMessage(sourceCopy.en["p.t519"], { v1: item.present.outcome.toLowerCase() })}${item.present.code ? ` (${item.present.code})` : ""}.`;
  return {
    vaultRef: item.vaultRef,
    kind: item.kind,
    label: item.label,
    ownerLine: item.ownerMatch
      ? sourceMessage(sourceCopy.en["p.t197"], { v1: item.ownerRef })
      : sourceMessage(sourceCopy.en["p.t198"], { v1: item.ownerRef }),
    storedLine: sourceMessage(sourceCopy.en["p.t199"], { v1: item.cachedAt }),
    verdictWord: item.authorityVerdict,
    verdictLine: sourceMessage(sourceCopy.en["p.t200"], { v1: item.authorityVerdict, v2: item.verdictAt }),
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
      ? sourceCopy.en["s1tn"]
      : state.freshness === "STALE"
        ? sourceCopy.en["s1tk"]
        : sourceCopy.en["s1wv"];
  const cachedWord = state.cached
    ? sourceCopy.en["s1ka"]
    : null;
  const environment = state.snapshot?.environment ?? null;
  const environmentLine = environment
    ? sourceMessage(sourceCopy.en["p.t201"], { v1: environment.shellEnvironment, v2: environment.deviceId, v3: state.snapshot?.watermark ?? "none" })
    : sourceCopy.en["sva"];

  const install: InstallModel | null = (() => {
    const gate = controller.gateFor({ step: "install", intentRef: GATE_PREVIEW });
    const installView = projection.install;
    if (installView === null) {
      return {
        stateWord: "none",
        installLine: sourceCopy.en["svr"],
        shellLine: sourceCopy.en["syn"],
        updateLine: null,
        install: control(gate),
        update: control(controller.gateFor({ step: "update", intentRef: GATE_PREVIEW })),
      };
    }
    return {
      stateWord: installView.state,
      installLine:
        installView.state === "installed"
          ? sourceMessage(sourceCopy.en["p.t202"], { v1: installView.installRef })
          : sourceCopy.en["svr"],
      shellLine:
        installView.state === "installed" ? sourceMessage(sourceCopy.en["p.t203"], { v1: installView.shellRef, v2: installView.version }) : sourceCopy.en["syn"],
      updateLine:
        installView.update === null
          ? null
          : sourceMessage(sourceCopy.en["p.t520"], { v1: installView.update.updateRef, v2: installView.update.toShell, v3: installView.update.note }),
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
          ? sourceCopy.en["syi"]
          : sourceMessage(sourceCopy.en["p.t204"], { v1: sessionView.actorRef }),
      verdictLine: sessionView.note,
      reconnect: control(controller.gateFor({ step: "reconnect", intentRef: GATE_PREVIEW })),
    };
  })();

  const device: DeviceModel = {
    linkWord: state.link,
    linkLine:
      state.link === "online"
        ? sourceCopy.en["s1u0"]
        : sourceCopy.en["s1ty"],
    clockWord: projection.clock?.verdict ?? "unread",
    clockLine: projection.clock === null ? sourceCopy.en["suo"] : projection.clock.note,
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
    (item) => sourceMessage(sourceCopy.en["p.t122"], { v1: item.arrived, v2: item.intentRef, v3: item.cause }),
  );
  const unlinkedLines = projection.unlinkedIntents.map(
    (intent) =>
      sourceMessage(sourceCopy.en["p.t205"], { v1: intentWord(intent), v2: intent.intentRef, v3: intent.targetRef, v4: intent.outcome.toLowerCase().replace("_", " ") }),
  );

  const counters = state.counters;
  const record: RecordModel = {
    contextLine: sourceMessage(sourceCopy.en["p.t521"], { v1: state.context.actorRef, v2: state.context.deviceId, v3: state.context.incarnation, v4: state.context.environment }),
    countersLine: sourceMessage(sourceCopy.en["p.t206"], { v1: counters.sent, v2: counters.fenced, v3: counters.notSent, v4: counters.droppedReads }),
    intents,
    quarantineLines,
    unlinkedLines,
  };

  const identity: IdentityRowModel[] = MOBILE_IDENTITY_REGISTER.map((row) => ({
    id: row.id,
    shellField: row.shellField,
    status: row.status,
    statusWord: row.status === "field-named" ? sourceCopy.en["sl3"] : sourceCopy.en["s10d"],
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
      return sourceMessage(sourceCopy.en["p.t207"], { v1: verb });
    }
    const code = view.code ? ` (${view.code})` : "";
    switch (view.outcome) {
      case "CONFIRMED":
        return sourceMessage(sourceCopy.en["p.t208"], { v1: verb });
      case "REJECTED":
        return sourceMessage(sourceCopy.en["p.t522"], { v1: verb, v2: code });
      case "UNKNOWN":
        return sourceMessage(sourceCopy.en["p.t209"], { v1: verb, v2: code });
      case "IN_FLIGHT":
        return sourceMessage(sourceCopy.en["p.t210"], { v1: verb });
      default:
        return sourceMessage(sourceCopy.en["p.t211"], { v1: verb, v2: code });
    }
  };
  return {
    orderRef: order.orderRef,
    stateWord: order.state,
    amountWord:
      order.amount === null
        ? sourceMessage(sourceCopy.en["p.t523"], { v1: MOBILE_UNIT })
        : sourceMessage(sourceCopy.en["p.t212"], { v1: order.amount, v2: order.currency }),
    versionLine: sourceMessage(sourceCopy.en["p.t213"], { v1: order.version, v2: order.paymentRef ?? "none", v3: order.withdrawalRef ?? "none" }),
    confirmLine: writeLine(order.confirm, sourceCopy.en["sdh"]),
    withdrawLine: writeLine(order.withdraw, sourceCopy.en["s26p"]),
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
    const port = connectivityPort(mobileShellPortFor(environment, { scenario: "clean" }), "installable-mobile");
    sessionRef.current = {
      port,
      controller: connectivityController(new MobileShellController(port, {
        actorRef: MOBILE_DESK_ACTOR,
        deviceNow: () =>
          clockRef.current === "in-step" ? MOBILE_AS_OF : clockRef.current === "skewed" ? "2026-10-14T00:00:00.000Z" : null,
      }), port),
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
      const port = connectivityPort(mobileShellPortFor(environment, { scenario: next }), "installable-mobile");
      sessionRef.current = {
        port,
        controller: connectivityController(new MobileShellController(port, {
          actorRef: MOBILE_DESK_ACTOR,
          deviceNow: () =>
            clockRef.current === "in-step" ? MOBILE_AS_OF : clockRef.current === "skewed" ? "2026-10-14T00:00:00.000Z" : null,
        }), port),
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
      note(sourceCopy.en["s1qb"]);
    },
    dropConnection() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      session.port.dropConnection();
      note(sourceCopy.en["s1ty"]);
    },
    restoreConnection() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      session.port.restoreConnection();
      note(sourceCopy.en["s1tw"]);
    },
    offerUpdate() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      session.port.offerUpdate();
      note(sourceCopy.en["s204"]);
    },
    expireSession() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      session.port.expireSession();
      note(sourceCopy.en["s1z7"]);
    },
    deliverHeld() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const count = session.port.deliverHeld();
      note(count === 0 ? sourceCopy.en["svq"] : sourceMessage(sourceCopy.en["p.t130"], { v1: count, v2: count === 1 ? "" : "s" }));
    },
    deliverLate() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const due = session.port.deliverLate();
      if (due.length === 0) {
        note(sourceCopy.en["svv"]);
        return;
      }
      const lines = due.map((delivery) => {
        const outcome = session.controller.acceptLate(delivery);
        return outcome.kind === "RECORDED"
          ? sourceMessage(sourceCopy.en["p.t214"], { v1: delivery.result, v2: delivery.intentRef })
          : sourceMessage(sourceCopy.en["p.t215"], { v1: delivery.intentRef, v2: outcome.cause });
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
        sourceMessage(sourceCopy.en["p.t216"], { v1: next.actorRef, v2: next.incarnation }),
      );
    },
    newSession() {
      startSession(scenario, sourceCopy.en["s1m9"]);
    },
    setScenario(next) {
      startSession(next, sourceMessage(sourceCopy.en["p.t217"], { v1: next }));
    },
    setClockMode(next) {
      clockRef.current = next;
      setClockModeState(next);
      note(sourceMessage(sourceCopy.en["p.t218"], { v1: next, v2: MOBILE_CLOCK_MODE_NOTES[next] }));
    },
  };

  const session = sessionRef.current;
  return {
    environment,
    scenario,
    clockMode,
    model: buildMobileModel({ controller: session.controller, last }),
    actions: connectedActions(actions, ['install', 'update', 'present', 'confirm', 'withdraw', 'dropConnection', 'restoreConnection', 'offerUpdate', 'expireSession', 'newSession', 'setScenario'], sessionRef.current?.port),
  };
}
