import { messages as sourceCopy } from "./i18n/messages/provider-journey";
import { sourceMessage } from "./i18n/source-message";
/**
 * The synthetic provider-connected journey screen on top of the adapter's
 * synthetic provider sandbox source. Stub scope: the default port is the
 * synthetic source. On integration-http the same port is not-bound: the
 * contract-only catalogue has no checkout, payment-observation, issuance, or
 * provider-refund command, and this module does not invent one, send a second
 * attempt, or switch adapters.
 * This module computes no amount and no refund. It copies what the controller
 * and the last read hold and says, for every control that is off, why it is off.
 * Redirect, return, provider observation, issuance, and refund each keep their
 * own line. A return landing is a source event and is never a payment
 * observation. There is no aggregate state, and a read never resolves a write
 * whose result is unknown.
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PROVIDER_DESK_ACTOR,
  PROVIDER_FACETS,
  PROVIDER_GUEST_ACTOR,
  PROVIDER_HOLD_NOT_BOUND,
  PROVIDER_IDENTITY_REGISTER,
  PROVIDER_NOT_BOUND_REASON,
  PROVIDER_UNIT,
  ProviderJourneyController,
  projectProvider,
  providerFacetList,
  providerJourneyPortFor,
  type ProviderFacet,
  type ProviderFacetView,
  type ProviderFence,
  type ProviderIdentityRow,
  type ProviderIntent,
  type ProviderJourneyPort,
  type ProviderOrderProjection,
  type ProviderOrderShape,
  type ProviderReadState,
  type ProviderRefreshCause,
  type ProviderScenario,
  type ProviderStepInput,
  type ProviderStepResult,
} from "@kix/protocol-adapter";
import { protocol } from "./protocol";

export const PROVIDER_TITLE = sourceCopy.en["s1a5"];

export const PROVIDER_SOURCE_LINE =
  sourceCopy.en["s15x"];

export const PROVIDER_BOUNDARY =
  sourceCopy.en["si2"];

export const PROVIDER_RETURN_NOTE =
  sourceCopy.en["s7c"];

export const PROVIDER_ENVIRONMENT_NOTE =
  sourceCopy.en["s1s1"];

export const PROVIDER_ISSUANCE_NOTE =
  sourceCopy.en["s49"];

export const PROVIDER_ACTOR_NOTE =
  sourceCopy.en["s1py"];

export const PROVIDER_SESSION_NOTE =
  sourceCopy.en["soh"];

export const PROVIDER_FENCE_NOTE =
  sourceCopy.en["s14n"];

export const PROVIDER_READ_NOTE =
  sourceCopy.en["s14c"];

export const PROVIDER_HOLD_NOTE = sourceMessage(sourceCopy.en["p.t8"], { v1: PROVIDER_HOLD_NOT_BOUND.reason });

export const PROVIDER_AMOUNT_NOTE = sourceMessage(sourceCopy.en["p.t185"], { v1: PROVIDER_UNIT });

export const SCENARIO_NOTES: Readonly<Record<ProviderScenario, string>> = {
  clean: sourceCopy.en["sjt"],
  empty: sourceCopy.en["s1zg"],
  stale: sourceCopy.en["s21a"],
  unqualified: sourceCopy.en["s1rl"],
  "production-claimed": sourceCopy.en["s1yr"],
  "provider-error": sourceCopy.en["s21v"],
  declined: sourceCopy.en["s1vo"],
  "return-only": sourceCopy.en["s1ql"],
  "begin-lost": sourceCopy.en["s2"],
  "observe-lost": sourceCopy.en["s4e"],
  "observe-late": sourceCopy.en["s4f"],
  "issue-lost": sourceCopy.en["s48"],
  "refund-lost": sourceCopy.en["s6m"],
  "held-response": sourceCopy.en["s4o"],
  "claims-real": sourceCopy.en["s1w8"],
  "receipt-claims": sourceCopy.en["s1w3"],
};

const STEP_WORDS = { begin: sourceCopy.en["s9r"], observe: sourceCopy.en["s17i"], issue: sourceCopy.en["sor"], refund: sourceCopy.en["s1ek"] } as const;

const FACET_LABELS: Readonly<Record<ProviderFacet, string>> = {
  redirect: sourceCopy.en["sc3"],
  return: sourceCopy.en["s1gp"],
  payment: sourceCopy.en["s1a7"],
  issuance: sourceCopy.en["sor"],
  refund: sourceCopy.en["s1ek"],
};

export type ProviderScreenState =
  | "loading"
  | "unread"
  | "ready"
  | "empty"
  | "stale"
  | "refused"
  | "environment-refused"
  | "not-bound"
  | "unavailable"
  | "tuple-changed";

export interface ControlModel {
  enabled: boolean;
  /** Why the control is off. Null when it is on. */
  reason: string | null;
}

export interface FacetModel {
  facet: ProviderFacet;
  label: string;
  writeKind: string;
  writeWord: string;
  observedKind: string;
  observedWord: string;
  note: string;
}

export interface EventModel {
  /** A source event this page can trigger, with its own line. */
  id: "return" | "callback" | "abandon";
  label: string;
  line: string;
}

export interface OrderModel {
  orderRef: string;
  linked: boolean;
  linkLine: string;
  amountWord: string;
  versionLine: string;
  shape: ProviderOrderShape;
  shapeLine: string;
  identities: { kind: string; ref: string | null }[];
  facets: FacetModel[];
  events: EventModel[];
  begin: ControlModel;
  observe: ControlModel;
  issue: ControlModel;
  refund: ControlModel;
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

export interface IdentityRowModel {
  id: string;
  providerField: string;
  statusWord: string;
  status: ProviderIdentityRow["status"];
  bodyFields: string;
  reason: string;
}

export interface SessionModel {
  contextLine: string;
  countersLine: string;
  intents: IntentRow[];
  quarantineLines: string[];
  unlinkedLines: string[];
}

export type LastAction =
  | { seq: number; kind: "step"; step: ProviderStepInput["step"]; result: ProviderStepResult }
  | { seq: number; kind: "note"; text: string };

export interface ProviderModel {
  state: ProviderScreenState;
  statusLine: string;
  detailLine: string;
  /** Label of the one return action, or null. */
  actionLabel: string | null;
  freshnessWord: string;
  environmentLine: string;
  orders: OrderModel[];
  session: SessionModel;
  identity: IdentityRowModel[];
  lastLine: string | null;
  lastNeedsFocus: boolean;
  lastSeq: number | null;
}

export function causeLine(cause: ProviderRefreshCause): string {
  switch (cause) {
    case "own-write":
      return sourceCopy.en["s279"];
    case "stale-rejection":
      return sourceCopy.en["s20g"];
    case "context-switch":
      return sourceCopy.en["s1xw"];
    default: {
      const exhaustive: never = cause;
      return exhaustive;
    }
  }
}

/** Why a write is off. Each fence maps to one sentence and no fence is a failure of the page. */
export function fenceLine(fence: ProviderFence): string {
  switch (fence.reason) {
    case "in-flight":
      return sourceMessage(sourceCopy.en["p.t384"], { v1: fence.intentRef });
    case "unknown-outcome": {
      const late = fence.lateRecorded ? " A late result was recorded, and it does not make the write known." : "";
      const earlier = fence.earlierContext ? " It was sent in an earlier session context." : "";
      return sourceMessage(sourceCopy.en["p.t385"], { v1: fence.intentRef, v2: late, v3: earlier });
    }
    case "no-snapshot":
      return sourceCopy.en["s1cn"];
    case "snapshot-stale":
      return sourceMessage(sourceCopy.en["p.t86"], { v1: causeLine(fence.cause) });
    case "duplicate-intent":
      return sourceMessage(sourceCopy.en["p.t87"], { v1: fence.intentRef });
    case "environment":
      return sourceCopy.en["s1yt"];
    case "account-unqualified":
      return sourceMessage(sourceCopy.en["p.t386"], { v1: fence.actorRef });
    case "payment-unobserved":
      return sourceMessage(sourceCopy.en["p.t387"], { v1: fence.orderRef });
    case "not-bound":
      return PROVIDER_NOT_BOUND_REASON;
    default: {
      const exhaustive: never = fence;
      return exhaustive;
    }
  }
}

export function stepResultLine(step: ProviderStepInput["step"], result: ProviderStepResult): string {
  const word = STEP_WORDS[step];
  switch (result.kind) {
    case "CONFIRMED":
      return sourceMessage(sourceCopy.en["p.t388"], { v1: word });
    case "REJECTED":
      return sourceMessage(sourceCopy.en["p.t193"], { v1: word, v2: result.intent.code ?? "no code", v3: result.intent.message ?? "" }).trim();
    case "UNKNOWN":
      return sourceMessage(sourceCopy.en["p.t389"], { v1: word, v2: result.intent.code ?? "no code" });
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

function writeWord(view: ProviderFacetView): { kind: string; word: string } {
  if (view.outcome === "NOT_BOUND") {
    return { kind: "not-bound", word: sourceCopy.en["s136"] };
  }
  if (view.outcome === null) {
    return { kind: "none", word: sourceCopy.en["s138"] };
  }
  const code = view.code ? ` (${view.code})` : "";
  const late = view.lateRecorded ? " A late result is recorded." : "";
  switch (view.outcome) {
    case "CONFIRMED":
      return { kind: "confirmed", word: sourceCopy.en["sdi"] };
    case "REJECTED":
      return { kind: "rejected", word: sourceMessage(sourceCopy.en["p.t560"], { v1: code }) };
    case "UNKNOWN":
      return { kind: "unknown", word: sourceMessage(sourceCopy.en["p.t561"], { v1: code, v2: late }) };
    case "IN_FLIGHT":
      return { kind: "in-flight", word: sourceCopy.en["snw"] };
    case "DRAFT":
      return { kind: "draft", word: sourceMessage(sourceCopy.en["p.t360"], { v1: code }) };
    default: {
      const exhaustive: never = view.outcome;
      return exhaustive;
    }
  }
}

function observedWord(view: ProviderFacetView): { kind: string; word: string } {
  const seen = view.observed;
  if (seen === null) {
    return { kind: "none", word: sourceCopy.en["s12d"] };
  }
  switch (seen.state) {
    case "observed":
      return { kind: "observed", word: sourceCopy.en["s13m"] };
    case "pending":
      return { kind: "pending", word: sourceCopy.en["s1go"] };
    case "declined":
      return { kind: "declined", word: sourceCopy.en["s1vm"] };
    case "landed":
      return { kind: "landed", word: sourceCopy.en["s7d"] };
    case "open":
      return { kind: "open", word: sourceCopy.en["s1qw"] };
    case "returned":
      return { kind: "returned", word: sourceCopy.en["s1qm"] };
    case "abandoned":
      return { kind: "abandoned", word: sourceCopy.en["s1vi"] };
    case "issued":
      return { kind: "issued", word: sourceCopy.en["s4a"] };
    case "recorded":
      return { kind: "recorded", word: sourceCopy.en["s6n"] };
    case "none":
      return { kind: "not-observed", word: sourceCopy.en["s120"] };
    default:
      return { kind: "other", word: sourceMessage(sourceCopy.en["p.t568"], { v1: seen.state }) };
  }
}

const SHAPE_LINES: Readonly<Record<ProviderOrderShape, string>> = {
  none: sourceCopy.en["sui"],
  "checkout-open": sourceCopy.en["sq"],
  "returned-unobserved": sourceCopy.en["s1qn"],
  abandoned: sourceCopy.en["s1vj"],
  "payment-declined": sourceCopy.en["s1vn"],
  "payment-observed": sourceCopy.en["s66"],
  issued: sourceCopy.en["s4b"],
  "refund-recorded": sourceCopy.en["s6o"],
  "unknown-effect": sourceCopy.en["s9f"],
};

function describeOrder(
  order: ProviderOrderProjection,
  controls: { begin: ControlModel; observe: ControlModel; issue: ControlModel; refund: ControlModel },
): OrderModel {
  const facets = providerFacetList(order).map((view): FacetModel => {
    const write = writeWord(view);
    const seen = observedWord(view);
    return {
      facet: view.facet,
      label: FACET_LABELS[view.facet],
      writeKind: write.kind,
      writeWord: write.word,
      observedKind: seen.kind,
      observedWord: seen.word,
      note: view.observed ? view.observed.note : "",
    };
  });
  const events: EventModel[] = [];
  if (order.facets.redirect.observed?.state === "open") {
    events.push(
      { id: "return", label: sourceCopy.en["spy"], line: sourceCopy.en["s1e5"] },
      { id: "abandon", label: sourceCopy.en["s0"], line: sourceCopy.en["s1vk"] },
    );
  }
  // A returned checkout still takes the provider's report or an abandonment
  // only while no report is recorded. Once the report landed the checkout is
  // decided and neither control applies.
  if (order.facets.redirect.observed?.state === "returned" && order.facets.payment.observed?.state === "pending") {
    events.push(
      { id: "callback", label: sourceCopy.en["sg5"], line: sourceCopy.en["s1vp"] },
      { id: "abandon", label: sourceCopy.en["s0"], line: sourceCopy.en["s1vk"] },
    );
  }
  return {
    orderRef: order.orderRef,
    linked: order.linked,
    linkLine: order.linked
      ? sourceCopy.en["sqx"]
      : sourceCopy.en["s13o"],
    amountWord:
      order.amount === null
        ? sourceMessage(sourceCopy.en["p.t523"], { v1: PROVIDER_UNIT })
        : sourceMessage(sourceCopy.en["p.t212"], { v1: order.amount, v2: order.currency }),
    versionLine: sourceMessage(sourceCopy.en["p.t390"], { v1: order.version }),
    shape: order.shape,
    shapeLine: SHAPE_LINES[order.shape],
    identities: [
      { kind: "order", ref: order.identities.order },
      { kind: "checkout", ref: order.identities.checkout },
      { kind: "return", ref: order.identities.return },
      { kind: "callback", ref: order.identities.callback },
      { kind: "payment", ref: order.identities.payment },
      { kind: "issuance", ref: order.identities.issuance },
      { kind: "right", ref: order.identities.right },
      { kind: "refund", ref: order.identities.refund },
    ],
    facets,
    events,
    ...controls,
  };
}

function control(fence: ProviderFence | null): ControlModel {
  return fence === null ? { enabled: true, reason: null } : { enabled: false, reason: fenceLine(fence) };
}

function readStateToScreen(readState: ProviderReadState, refreshRequired: ProviderRefreshCause | null): ProviderScreenState {
  switch (readState) {
    case "none":
      return refreshRequired === "context-switch" ? "unread" : "loading";
    case "ready":
      return "ready";
    case "empty":
      return "empty";
    case "stale":
      return "stale";
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
  state: ProviderScreenState,
  detail: string | null,
): { statusLine: string; detailLine: string; actionLabel: string | null } {
  switch (state) {
    case "loading":
      return { statusLine: sourceCopy.en["s1bm"], detailLine: "", actionLabel: null };
    case "unread":
      return {
        statusLine: sourceCopy.en["s1xx"],
        detailLine: sourceCopy.en["s1b0"],
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "ready":
      return { statusLine: sourceCopy.en["s1a6"], detailLine: "", actionLabel: null };
    case "empty":
      return { statusLine: sourceCopy.en["swn"], detailLine: sourceCopy.en["s115"], actionLabel: sourceCopy.en["s1ax"] };
    case "stale":
      return { statusLine: sourceCopy.en["s1lv"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    case "refused":
      return {
        statusLine: sourceCopy.en["s1w9"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1m2"],
      };
    case "environment-refused":
      return {
        statusLine: sourceCopy.en["s1yt"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1m2"],
      };
    case "not-bound":
      return { statusLine: PROVIDER_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: sourceCopy.en["s1v8"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1m2"],
      };
    case "unavailable":
      return { statusLine: sourceCopy.en["s1z3"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function lateLineOf(intent: ProviderIntent): string {
  if (intent.late === null) {
    return "";
  }
  const code = intent.late.code ? ` (${intent.late.code})` : "";
  return sourceMessage(sourceCopy.en["p.t195"], { v1: intent.late.result, v2: code });
}

/** The unused-intent id the gate preview asks with. It is never sent. */
const GATE_PREVIEW = "gate-preview";

export function buildProviderModel(input: {
  controller: ProviderJourneyController;
  last: LastAction | null;
}): ProviderModel {
  const { controller } = input;
  const state = controller.state();
  const screen = readStateToScreen(state.readState, state.refreshRequired);
  const status = statusFor(screen, state.readDetail);
  const projection = projectProvider(state);
  const freshnessWord =
    state.freshness === "CURRENT"
      ? sourceCopy.en["s1tn"]
      : state.freshness === "STALE"
        ? sourceCopy.en["s1ti"]
        : sourceCopy.en["s1wv"];
  const environment = state.snapshot?.environment ?? null;
  const environmentLine = environment
    ? sourceMessage(sourceCopy.en["p.t391"], { v1: environment.providerEnvironment, v2: environment.account.actorRef, v3: environment.account.qualification })
    : sourceCopy.en["svb"];

  const orders = projection.orders.map((order) =>
    describeOrder(order, {
      begin: control(controller.gateFor({ step: "begin", intentRef: GATE_PREVIEW, orderRef: order.orderRef })),
      observe:
        order.identities.checkout === null
          ? { enabled: false, reason: sourceCopy.en["suj"] }
          : control(
              controller.gateFor({ step: "observe", intentRef: GATE_PREVIEW, checkoutRef: order.identities.checkout }),
            ),
      issue:
        order.identities.checkout === null
          ? { enabled: false, reason: sourceCopy.en["suk"] }
          : control(
              controller.gateFor({ step: "issue", intentRef: GATE_PREVIEW, checkoutRef: order.identities.checkout }),
            ),
      refund: control(controller.gateFor({ step: "refund", intentRef: GATE_PREVIEW, orderRef: order.orderRef })),
    }),
  );

  const intents: IntentRow[] = state.intents.map((intent) => ({
    seq: intent.seq,
    intentRef: intent.intentRef,
    stepWord: STEP_WORDS[intent.step],
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
      sourceMessage(sourceCopy.en["p.t392"], { v1: STEP_WORDS[intent.step], v2: intent.intentRef, v3: intent.targetRef, v4: intent.outcome.toLowerCase().replace("_", " ") }),
  );

  const counters = state.counters;
  const session: SessionModel = {
    contextLine: sourceMessage(sourceCopy.en["p.t563"], { v1: state.context.actorRef, v2: state.context.incarnation, v3: state.context.environment }),
    countersLine: sourceMessage(sourceCopy.en["p.t206"], { v1: counters.sent, v2: counters.fenced, v3: counters.notSent, v4: counters.droppedReads }),
    intents,
    quarantineLines,
    unlinkedLines,
  };

  const identity: IdentityRowModel[] = PROVIDER_IDENTITY_REGISTER.map((row) => ({
    id: row.id,
    providerField: row.providerField,
    status: row.status,
    statusWord: row.status === "field-named" ? sourceCopy.en["sl3"] : sourceCopy.en["s10d"],
    bodyFields: row.bodyFields.length === 0 ? "none" : row.bodyFields.map((entry) => `${entry.action}.${entry.field}`).join(", "),
    reason: row.reason,
  }));

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
    environmentLine,
    orders,
    session,
    identity,
    lastLine,
    lastNeedsFocus: attentionFor(input.last),
    lastSeq: input.last === null ? null : input.last.seq,
  };
}

/** Facets in display order, for tests and for the screen. */
export const PROVIDER_FACET_ORDER: readonly ProviderFacet[] = PROVIDER_FACETS;

export interface ProviderActions {
  refresh(): void;
  begin(orderRef: string): void;
  observe(checkoutRef: string): void;
  issue(checkoutRef: string): void;
  refund(orderRef: string): void;
  landReturn(checkoutRef: string): void;
  deliverReport(checkoutRef: string): void;
  abandon(checkoutRef: string): void;
  deliverHeld(): void;
  deliverLate(): void;
  switchContext(): void;
  newSession(): void;
  setScenario(next: ProviderScenario): void;
}

interface Session {
  port: ProviderJourneyPort;
  controller: ProviderJourneyController;
}

function createSession(environment: "stub" | "integration-http", scenario: ProviderScenario): Session {
  const port = providerJourneyPortFor(environment, { scenario });
  return { port, controller: new ProviderJourneyController(port, { actorRef: PROVIDER_DESK_ACTOR }) };
}

export function useProviderJourney(): {
  environment: "stub" | "integration-http";
  scenario: ProviderScenario;
  model: ProviderModel;
  heldSupported: boolean;
  lateSupported: boolean;
  actions: ProviderActions;
} {
  const environment = protocol.describe().environment;
  const sessionRef = useRef<Session | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createSession(environment, "clean");
  }
  const [scenario, setScenarioState] = useState<ProviderScenario>("clean");
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
    async (input: ProviderStepInput) => {
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
    (next: ProviderScenario, text: string) => {
      sessionRef.current = createSession(environment, next);
      intentCounter.current = 0;
      setScenarioState(next);
      setEpoch((value) => value + 1);
      note(text);
    },
    [environment, note],
  );

  const event = useCallback(
    async (kind: "return" | "callback" | "abandon", checkoutRef: string) => {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      if (kind === "return") {
        note(
          session.port.deliverReturn(checkoutRef) === null
            ? sourceMessage(sourceCopy.en["p.t393"], { v1: checkoutRef })
            : sourceMessage(sourceCopy.en["p.t394"], { v1: checkoutRef }),
        );
      } else if (kind === "callback") {
        const report = session.port.deliverCallback(checkoutRef);
        note(
          report === null
            ? sourceMessage(sourceCopy.en["p.t395"], { v1: checkoutRef })
            : sourceMessage(sourceCopy.en["p.t396"], { v1: report.result, v2: checkoutRef }),
        );
      } else {
        note(
          session.port.markAbandoned(checkoutRef) === null
            ? sourceMessage(sourceCopy.en["p.t397"], { v1: checkoutRef })
            : sourceMessage(sourceCopy.en["p.t398"], { v1: checkoutRef }),
        );
      }
      await session.controller.refresh();
    },
    [note],
  );

  const actions: ProviderActions = {
    refresh() {
      void sessionRef.current?.controller.refresh();
    },
    begin(orderRef) {
      void run({ step: "begin", intentRef: nextIntent(), orderRef });
    },
    observe(checkoutRef) {
      void run({ step: "observe", intentRef: nextIntent(), checkoutRef });
    },
    issue(checkoutRef) {
      void run({ step: "issue", intentRef: nextIntent(), checkoutRef });
    },
    refund(orderRef) {
      void run({ step: "refund", intentRef: nextIntent(), orderRef });
    },
    landReturn(checkoutRef) {
      void event("return", checkoutRef);
    },
    deliverReport(checkoutRef) {
      void event("callback", checkoutRef);
    },
    abandon(checkoutRef) {
      void event("abandon", checkoutRef);
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
        actorRef: current === PROVIDER_DESK_ACTOR ? PROVIDER_GUEST_ACTOR : PROVIDER_DESK_ACTOR,
      });
      note(
        sourceMessage(sourceCopy.en["p.t399"], { v1: next.actorRef, v2: next.incarnation }),
      );
    },
    newSession() {
      startSession(scenario, sourceCopy.en["s1mc"]);
    },
    setScenario(next) {
      startSession(next, sourceMessage(sourceCopy.en["p.t217"], { v1: next }));
    },
  };

  const session = sessionRef.current;
  return {
    environment,
    scenario,
    model: buildProviderModel({ controller: session.controller, last }),
    heldSupported: scenario === "held-response",
    lateSupported: scenario === "observe-late",
    actions,
  };
}
