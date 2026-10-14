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

export const PROVIDER_TITLE = "Provider checkout journey (synthetic)";

export const PROVIDER_SOURCE_LINE =
  "Orders, checkouts, provider reports, issuances, and refunds come from a synthetic provider source on this page load. They are not a provider receipt, not a payment processor response, and not a producer read. No real test account or provider credential exists here, so every row is labelled synthetic.";

export const PROVIDER_BOUNDARY =
  "Each row below is an observation or a synthetic write of this page. The redirect, the buyer's return landing, the provider's own report, the issuance record, and the refund record are five separate lines. None of them completes the others.";

export const PROVIDER_RETURN_NOTE =
  "A return landing is not a payment observation. The buyer landing on the return URL records a return event only; the payment line waits for the provider's own report and a confirmed observe write. Success is never claimed from the return URL alone.";

export const PROVIDER_ENVIRONMENT_NOTE =
  "The environment and the account are checked before any write. The desk serves the sandbox only: a declared production environment refuses the read, a write that does not declare sandbox is refused, and an unqualified account fences every write. A sandbox success is not a real payment.";

export const PROVIDER_ISSUANCE_NOTE =
  "An issuance record is a synthetic row and a right reference on the same order. It is not a real right and grants no admission authority. A refund record is a synthetic row; it returns no funds and executes nothing.";

export const PROVIDER_ACTOR_NOTE =
  "The actor string is a context label. It is not an authentication result. Only the desk actor string is sandbox-qualified by the synthetic source; every other actor reads unqualified.";

export const PROVIDER_SESSION_NOTE =
  "Intents live in this page load only. A reload or a new synthetic session clears them and resolves nothing at a provider. After a reload an unknown write is not recovered here.";

export const PROVIDER_FENCE_NOTE =
  "One write is sent at a time per order, and each is sent once. This page does not send a write again, does not mint an intent for you, and does not undo one with another.";

export const PROVIDER_READ_NOTE =
  "One read follows each settled write so the next step can use fresh evidence. Nothing polls. A read is evidence and never resolves an unknown write.";

export const PROVIDER_HOLD_NOTE = `Holding a seat is not available here. ${PROVIDER_HOLD_NOT_BOUND.reason}`;

export const PROVIDER_AMOUNT_NOTE = `Amounts are the source's own text in ${PROVIDER_UNIT}, a synthetic unit. An order with no amount shows UNDETERMINED. This page does not compute, convert, or verify any amount.`;

export const SCENARIO_NOTES: Readonly<Record<ProviderScenario, string>> = {
  clean: "Every step is answered. Two sandbox orders are seeded; the second has no amount.",
  empty: "The source has no orders.",
  stale: "The source serves a watermark older than the floor this page holds.",
  unqualified: "The desk actor reads as unqualified. Every write is fenced before any send.",
  "production-claimed": "The source declares a production environment. The read is refused before any snapshot is applied.",
  "provider-error": "The synthetic provider refuses the begin. Nothing is opened.",
  declined: "The provider's own report is a decline. The observe write reads as a rejection.",
  "return-only": "The buyer lands on the return URL and the provider never reports. Observe stays pending.",
  "begin-lost": "A begin is applied and its answer is lost.",
  "observe-lost": "An observe is applied and its answer is lost.",
  "observe-late": "An observe is applied, its answer is lost, and a late result can be delivered later.",
  "issue-lost": "An issuance is applied and its answer is lost.",
  "refund-lost": "A refund record is applied and its answer is lost.",
  "held-response": "Answers are held until you deliver them. Use it to switch the session while a write is in flight.",
  "claims-real": "The read payload claims a real payment. The whole payload is refused before a row shows.",
  "receipt-claims": "The read is clean but a confirmed answer claims a real payment. The write is unknown.",
};

const STEP_WORDS = { begin: "Begin checkout", observe: "Payment observation", issue: "Issuance", refund: "Refund" } as const;

const FACET_LABELS: Readonly<Record<ProviderFacet, string>> = {
  redirect: "Checkout redirect",
  return: "Return landing",
  payment: "Provider observation",
  issuance: "Issuance",
  refund: "Refund",
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
      return "Your own write landed after the last read.";
    case "stale-rejection":
      return "The source said the last read was behind.";
    case "context-switch":
      return "The session context changed.";
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
      return `Another write on this order is in flight (${fence.intentRef}). Wait for its answer.`;
    case "unknown-outcome": {
      const late = fence.lateRecorded ? " A late result was recorded, and it does not make the write known." : "";
      const earlier = fence.earlierContext ? " It was sent in an earlier session context." : "";
      return `An earlier write on this order has an unknown result (${fence.intentRef}).${late}${earlier} Writes on this order stay blocked. A read does not resolve it.`;
    }
    case "no-snapshot":
      return "Read the provider desk first.";
    case "snapshot-stale":
      return `Read again before the next write. ${causeLine(fence.cause)}`;
    case "duplicate-intent":
      return `Intent ${fence.intentRef} was already used. This page does not send the same intent twice.`;
    case "environment":
      return "The source declares a production environment. This desk serves the sandbox only.";
    case "account-unqualified":
      return `Actor ${fence.actorRef} is not qualified for the sandbox. Without a test account and provider qualification every write is synthetic and fenced.`;
    case "payment-unobserved":
      return `No provider payment report is recorded for ${fence.orderRef}. A return landing alone does not unlock issuance or refund.`;
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
      return `${word} confirmed by the synthetic source. This is not a provider receipt and not a real payment.`;
    case "REJECTED":
      return `${word} rejected (${result.intent.code ?? "no code"}). ${result.intent.message ?? ""} The source applied nothing for this write.`.trim();
    case "UNKNOWN":
      return `${word} result unknown (${result.intent.code ?? "no code"}). It may or may not have applied. Writes on this order are blocked, and neither a read nor a late result resolves it.`;
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

function writeWord(view: ProviderFacetView): { kind: string; word: string } {
  if (view.outcome === "NOT_BOUND") {
    return { kind: "not-bound", word: "No write exists for this line. A return landing is a source event." };
  }
  if (view.outcome === null) {
    return { kind: "none", word: "No write sent by this page." };
  }
  const code = view.code ? ` (${view.code})` : "";
  const late = view.lateRecorded ? " A late result is recorded." : "";
  switch (view.outcome) {
    case "CONFIRMED":
      return { kind: "confirmed", word: "Confirmed by the synthetic source." };
    case "REJECTED":
      return { kind: "rejected", word: `Rejected${code}.` };
    case "UNKNOWN":
      return { kind: "unknown", word: `Unknown${code}.${late}` };
    case "IN_FLIGHT":
      return { kind: "in-flight", word: "In flight." };
    case "DRAFT":
      return { kind: "draft", word: `Not sent${code}.` };
    default: {
      const exhaustive: never = view.outcome;
      return exhaustive;
    }
  }
}

function observedWord(view: ProviderFacetView): { kind: string; word: string } {
  const seen = view.observed;
  if (seen === null) {
    return { kind: "none", word: "Not read." };
  }
  switch (seen.state) {
    case "observed":
      return { kind: "observed", word: "Observed in the last read." };
    case "pending":
      return { kind: "pending", word: "Returned, and no provider report is recorded." };
    case "declined":
      return { kind: "declined", word: "The provider reported a decline." };
    case "landed":
      return { kind: "landed", word: "A return landing is recorded. It is not a payment observation." };
    case "open":
      return { kind: "open", word: "The checkout is open." };
    case "returned":
      return { kind: "returned", word: "The buyer returned." };
    case "abandoned":
      return { kind: "abandoned", word: "The provider closed the checkout after the buyer left." };
    case "issued":
      return { kind: "issued", word: "An issuance record is recorded." };
    case "recorded":
      return { kind: "recorded", word: "A refund record is recorded. It executes nothing." };
    case "none":
      return { kind: "not-observed", word: "Not observed." };
    default:
      return { kind: "other", word: `State ${seen.state}.` };
  }
}

const SHAPE_LINES: Readonly<Record<ProviderOrderShape, string>> = {
  none: "No checkout is recorded for this order.",
  "checkout-open": "A checkout is open. The buyer has not returned.",
  "returned-unobserved": "The buyer returned. No provider report is recorded, so nothing is paid, issued, or refunded.",
  abandoned: "The provider closed the checkout after the buyer left. Nothing was paid, issued, or refunded.",
  "payment-declined": "The provider reported a decline. Nothing was issued or refunded.",
  "payment-observed": "A provider payment report is recorded. It is not a real payment.",
  issued: "An issuance record is recorded. It is not a real right and grants no admission authority.",
  "refund-recorded": "A refund record is recorded. It executes no return of funds.",
  "unknown-effect": "A write result is unknown. The order may or may not have moved for that write.",
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
      { id: "return", label: "Land the buyer on the return URL", line: "Records a return event. Not a payment." },
      { id: "abandon", label: "Abandon the checkout", line: "The provider closes the checkout." },
    );
  }
  // A returned checkout still takes the provider's report or an abandonment
  // only while no report is recorded. Once the report landed the checkout is
  // decided and neither control applies.
  if (order.facets.redirect.observed?.state === "returned" && order.facets.payment.observed?.state === "pending") {
    events.push(
      { id: "callback", label: "Deliver the provider report", line: "The provider's own report. Only this unlocks observation." },
      { id: "abandon", label: "Abandon the checkout", line: "The provider closes the checkout." },
    );
  }
  return {
    orderRef: order.orderRef,
    linked: order.linked,
    linkLine: order.linked
      ? "Linked to a confirmed begin of this page."
      : "Observed only. It is not linked to a confirmed begin of this page, and this page does not claim it.",
    amountWord:
      order.amount === null
        ? `Amount: UNDETERMINED (${PROVIDER_UNIT})`
        : `Amount ${order.amount} ${order.currency}, the source's own text.`,
    versionLine: `Order at version ${order.version} in the last read.`,
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
      return { statusLine: "Reading the synthetic provider desk. Nothing is confirmed yet.", detailLine: "", actionLabel: null };
    case "unread":
      return {
        statusLine: "The session context changed, so there is no read in this context.",
        detailLine: "Read again to see the desk from this context. An earlier unknown write on an order still blocks that order.",
        actionLabel: "Read again",
      };
    case "ready":
      return { statusLine: "Provider desk read.", detailLine: "", actionLabel: null };
    case "empty":
      return { statusLine: "No orders in this synthetic session.", detailLine: "Nothing can be checked out.", actionLabel: "Read again" };
    case "stale":
      return { statusLine: "Stale provider read.", detailLine: detail ?? "", actionLabel: "Read again" };
    case "refused":
      return {
        statusLine: "The read payload was refused whole before any row was shown.",
        detailLine: detail ?? "",
        actionLabel: "Start a new synthetic session",
      };
    case "environment-refused":
      return {
        statusLine: "The source declares a production environment. This desk serves the sandbox only.",
        detailLine: detail ?? "",
        actionLabel: "Start a new synthetic session",
      };
    case "not-bound":
      return { statusLine: PROVIDER_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: "The pin tuple changed. Nothing was read and nothing was applied.",
        detailLine: detail ?? "",
        actionLabel: "Start a new synthetic session",
      };
    case "unavailable":
      return { statusLine: "The source did not answer. This is not an empty desk.", detailLine: detail ?? "", actionLabel: "Read again" };
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
  return `Late result ${intent.late.result}${code}. Evidence only.`;
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
      ? "The last read is current."
      : state.freshness === "STALE"
        ? "The last read is behind."
        : "There is no usable read.";
  const environment = state.snapshot?.environment ?? null;
  const environmentLine = environment
    ? `Environment ${environment.providerEnvironment}, actor ${environment.account.actorRef}, qualification ${environment.account.qualification}. Sandbox only; every row is synthetic.`
    : "No environment is read. Environment and account are checked on every read.";

  const orders = projection.orders.map((order) =>
    describeOrder(order, {
      begin: control(controller.gateFor({ step: "begin", intentRef: GATE_PREVIEW, orderRef: order.orderRef })),
      observe:
        order.identities.checkout === null
          ? { enabled: false, reason: "No checkout is recorded for this order. Nothing to observe." }
          : control(
              controller.gateFor({ step: "observe", intentRef: GATE_PREVIEW, checkoutRef: order.identities.checkout }),
            ),
      issue:
        order.identities.checkout === null
          ? { enabled: false, reason: "No checkout is recorded for this order. Nothing to issue against." }
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
    (item) => `Result ${item.arrived} for ${item.intentRef} was quarantined (${item.cause}). It changed nothing.`,
  );
  const unlinkedLines = projection.unlinkedIntents.map(
    (intent) =>
      `${STEP_WORDS[intent.step]} ${intent.intentRef} on ${intent.targetRef} is ${intent.outcome.toLowerCase().replace("_", " ")}. No order row is linked to it, and an order seen in a read is not claimed for it.`,
  );

  const counters = state.counters;
  const session: SessionModel = {
    contextLine: `Actor ${state.context.actorRef}, session ${state.context.incarnation}, mode ${state.context.environment}.`,
    countersLine: `Sent ${counters.sent}. Blocked before sending ${counters.fenced}. Not sent ${counters.notSent}. Reads dropped ${counters.droppedReads}.`,
    intents,
    quarantineLines,
    unlinkedLines,
  };

  const identity: IdentityRowModel[] = PROVIDER_IDENTITY_REGISTER.map((row) => ({
    id: row.id,
    providerField: row.providerField,
    status: row.status,
    statusWord: row.status === "field-named" ? "Field named in the pin" : "Not-bound",
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
            ? `No return landing was applied to ${checkoutRef}. The checkout is not open for it.`
            : `A return landing was recorded on ${checkoutRef}. It is not a payment observation.`,
        );
      } else if (kind === "callback") {
        const report = session.port.deliverCallback(checkoutRef);
        note(
          report === null
            ? `No provider report was applied to ${checkoutRef}. The provider did not report on it.`
            : `A provider report (${report.result}) was recorded on ${checkoutRef}. Observe it to record the payment line.`,
        );
      } else {
        note(
          session.port.markAbandoned(checkoutRef) === null
            ? `No abandonment was applied to ${checkoutRef}. The checkout is not open for it.`
            : `The provider closed ${checkoutRef} as abandoned.`,
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
        actorRef: current === PROVIDER_DESK_ACTOR ? PROVIDER_GUEST_ACTOR : PROVIDER_DESK_ACTOR,
      });
      note(
        `Session context switched to ${next.actorRef}, session ${next.incarnation}. A write in flight is now unknown and its result will be quarantined. A guest actor reads unqualified. Read again.`,
      );
    },
    newSession() {
      startSession(scenario, "Started a new synthetic session. Earlier intents are gone, as after a reload. Nothing was resolved at a provider.");
    },
    setScenario(next) {
      startSession(next, `Started a new synthetic session with scenario ${next}. Earlier intents are gone, as after a reload.`);
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
