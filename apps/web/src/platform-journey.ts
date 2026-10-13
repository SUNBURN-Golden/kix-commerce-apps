/**
 * The multi-channel trade screen on top of the adapter's synthetic platform source.
 * Stub scope: the default port is the synthetic source. On integration-http the same
 * port is not-bound: the contract-only catalogue has no listing, trade, payment,
 * transfer, or refund command, and this module does not invent one, send a second
 * attempt, or switch adapters.
 * This module computes no amount, ownership, or refund. It copies what the controller
 * and the last read hold and says, for every control that is off, why it is off.
 * Booking, payment, issuance, and refund each keep their own line. There is no
 * aggregate state, and a read never resolves a write whose result is unknown.
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PLATFORM_COMPENSATION_UNDEFINED,
  PLATFORM_DESK_ACTOR,
  PLATFORM_FACETS,
  PLATFORM_HOLD_NOT_BOUND,
  PLATFORM_IDENTITY_REGISTER,
  PLATFORM_NOT_BOUND_REASON,
  PLATFORM_REFUND_NOT_BOUND,
  PLATFORM_TIERS,
  PlatformJourneyController,
  platformFacetList,
  platformJourneyPortFor,
  projectPlatform,
  type PlatformChannel,
  type PlatformFacet,
  type PlatformFacetView,
  type PlatformFence,
  type PlatformIdentityRow,
  type PlatformIntent,
  type PlatformJourneyPort,
  type PlatformReadState,
  type PlatformRefreshCause,
  type PlatformScenario,
  type PlatformStepInput,
  type PlatformStepResult,
  type PlatformTier,
  type PlatformTradeProjection,
  type PlatformTradeShape,
} from "@kix/protocol-adapter";
import { protocol } from "./protocol";

export const PLATFORM_TITLE = "Trading platform (synthetic)";

export const PLATFORM_SOURCE_LINE =
  "Listings, rights, and trades come from a synthetic platform source on this page load. They are not a producer read and not a catalogue receipt.";

export const PLATFORM_BOUNDARY =
  "Each row below is an observation or a synthetic write of this page. A booking, a payment observation, a right transfer, and a refund explanation are four separate lines. None of them completes the others.";

export const PLATFORM_TIER_NOTE = "Tier labels are opaque. No amount, fee, or share is attached to a tier or calculated on this page.";

export const PLATFORM_ACTOR_NOTE =
  "The actor string is a context label. It is not an authentication result, and the source does not trust it for access.";

export const PLATFORM_SESSION_NOTE =
  "Intents live in this page load only. A reload or a new synthetic session clears them and resolves nothing at a producer. After a reload an unknown write is not recovered here.";

export const PLATFORM_FENCE_NOTE =
  "One write is sent at a time per right, and each is sent once. This page does not send a write again, does not mint an intent for you, and does not undo one with another.";

export const PLATFORM_READ_NOTE =
  "One read follows each settled write so the next step can use fresh evidence. Nothing polls. A read is evidence and never resolves an unknown write.";

export const PLATFORM_HOLD_NOTE = `Holding a seat is not available here. ${PLATFORM_HOLD_NOT_BOUND.reason}`;

export const PLATFORM_REFUND_NOTE = `${PLATFORM_REFUND_NOT_BOUND.action} stays ${PLATFORM_REFUND_NOT_BOUND.status}. ${PLATFORM_REFUND_NOT_BOUND.state} is shown where a trade took a payment observation and the right did not move. There is no refund control.`;

export const PLATFORM_ALT_ACTOR = "platform-desk-2";

export const SCENARIO_NOTES: Readonly<Record<PlatformScenario, string>> = {
  clean: "Every step is answered. Two channels list one right.",
  empty: "The source has no listings.",
  stale: "The source serves a watermark older than the floor this page holds.",
  "rival-channel": "Another channel's transfer lands first, so your transfer is refused as stale.",
  "payment-lost": "A booking is recorded but its payment observation never arrives.",
  "book-lost": "A booking is applied and its answer is lost.",
  "transfer-lost": "A transfer is applied and its answer is lost.",
  "transfer-late": "A transfer is applied, its answer is lost, and a late result can be delivered later.",
  "held-response": "Answers are held until you deliver them. Use it to switch the session while a write is in flight.",
};

const STEP_WORDS = { book: "Booking", transfer: "Transfer", reprice: "Tier change" } as const;

const CHANNEL_WORDS: Readonly<Record<PlatformChannel, string>> = {
  "web-board": "Web board",
  "partner-board": "Partner board",
};

const FACET_LABELS: Readonly<Record<PlatformFacet, string>> = {
  booking: "Booking",
  payment: "Payment observation",
  issuance: "Right transfer",
  refund: "Refund",
};

export type PlatformScreenState = "loading" | "unread" | "ready" | "empty" | "stale" | "not-bound" | "unavailable" | "tuple-changed";

export interface ControlModel {
  enabled: boolean;
  /** Why the control is off. Null when it is on. */
  reason: string | null;
}

export interface ListingModel {
  listingRef: string;
  channel: PlatformChannel;
  channelWord: string;
  tier: PlatformTier;
  termsRef: string;
  open: boolean;
  statusLine: string;
  book: ControlModel;
  reprice: ControlModel;
}

export interface RightModel {
  rightRef: string;
  holderLine: string;
  transfersLine: string;
  integrityFault: boolean;
  listings: ListingModel[];
}

export interface FacetModel {
  facet: PlatformFacet;
  label: string;
  /** Attribute value for the page's own write on this facet. */
  writeKind: string;
  writeWord: string;
  observedKind: string;
  observedWord: string;
  note: string;
}

export interface TradeModel {
  tradeRef: string;
  linked: boolean;
  linkLine: string;
  channelWord: string;
  shape: PlatformTradeShape;
  shapeLine: string;
  identities: { kind: string; ref: string | null }[];
  facets: FacetModel[];
  rightLines: string[];
  refundLine: string;
  stranded: boolean;
  transfer: ControlModel;
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
  platformField: string;
  statusWord: string;
  status: PlatformIdentityRow["status"];
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
  | { seq: number; kind: "step"; step: PlatformStepInput["step"]; result: PlatformStepResult }
  | { seq: number; kind: "note"; text: string };

export interface PlatformModel {
  state: PlatformScreenState;
  statusLine: string;
  detailLine: string;
  /** Label of the one return action, or null. */
  actionLabel: string | null;
  freshnessWord: string;
  rights: RightModel[];
  trades: TradeModel[];
  session: SessionModel;
  identity: IdentityRowModel[];
  lastLine: string | null;
  /** True when the last action asks for attention (a block, a rejection, an unknown result). */
  lastNeedsFocus: boolean;
  /** Sequence of the last action, so a repeated message still moves focus. */
  lastSeq: number | null;
}

export function causeLine(cause: PlatformRefreshCause): string {
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
export function fenceLine(fence: PlatformFence): string {
  switch (fence.reason) {
    case "in-flight":
      return `Another write on this right is in flight (${fence.intentRef}). Wait for its answer.`;
    case "unknown-outcome": {
      const late = fence.lateRecorded ? " A late result was recorded, and it does not make the write known." : "";
      const earlier = fence.earlierContext ? " It was sent in an earlier session context." : "";
      return `An earlier write on this right has an unknown result (${fence.intentRef}).${late}${earlier} Writes on this right stay blocked. A read does not resolve it.`;
    }
    case "no-snapshot":
      return "Read the platform first.";
    case "snapshot-stale":
      return `Read again before the next write. ${causeLine(fence.cause)}`;
    case "duplicate-intent":
      return `Intent ${fence.intentRef} was already used. This page does not send the same intent twice.`;
    case "payment-unobserved":
      return `No payment observation is recorded for ${fence.tradeRef}, so the transfer waits. Whether funds moved is not known here.`;
    case "not-bound":
      return PLATFORM_NOT_BOUND_REASON;
    default: {
      const exhaustive: never = fence;
      return exhaustive;
    }
  }
}

export function stepResultLine(step: PlatformStepInput["step"], result: PlatformStepResult): string {
  const word = STEP_WORDS[step];
  switch (result.kind) {
    case "CONFIRMED":
      return `${word} confirmed by the synthetic source. This is not a protocol receipt.`;
    case "REJECTED":
      return `${word} rejected (${result.intent.code ?? "no code"}). ${result.intent.message ?? ""} The source applied nothing for this write.`.trim();
    case "UNKNOWN":
      return `${word} result unknown (${result.intent.code ?? "no code"}). It may or may not have applied. Writes on this right are blocked, and neither a read nor a late result resolves it.`;
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

function writeWord(view: PlatformFacetView): { kind: string; word: string } {
  if (view.outcome === "NOT_BOUND") {
    return { kind: "not-bound", word: "No write exists for this line." };
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

function observedWord(view: PlatformFacetView): { kind: string; word: string } {
  const seen = view.observed;
  if (seen === null) {
    return { kind: "none", word: "Not read." };
  }
  const code = seen.code ? ` (${seen.code})` : "";
  switch (seen.state) {
    case "observed":
      return { kind: "observed", word: "Observed in the last read." };
    case "none":
      return { kind: "not-observed", word: "Not observed." };
    case "unknown":
      return { kind: "unknown", word: `Unknown in the last read${code}.` };
    case "unavailable":
      return { kind: "unavailable", word: `Unavailable${code}.` };
    default: {
      const exhaustive: never = seen.state;
      return exhaustive;
    }
  }
}

const SHAPE_LINES: Readonly<Record<PlatformTradeShape, string>> = {
  "booking-only": "Only the booking is observed so far.",
  "booking-payment-right": "A booking, a payment observation, and a right transfer are each observed. Each keeps its own line.",
  "payment-without-right": "A payment observation is recorded and the right did not move for this trade. This is a partial result.",
  "right-without-payment": "The right moved and no payment observation is recorded. This is a partial result.",
  "payment-unknown": "No payment observation arrived. Whether funds moved is not known here.",
  "unknown-effect": "The transfer result is unknown. The right may or may not have moved for this trade.",
};

export function describeTrade(trade: PlatformTradeProjection, transfer: ControlModel): TradeModel {
  const facets = platformFacetList(trade).map((view): FacetModel => {
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
  const original = trade.originalRight;
  const current = trade.currentRight;
  const rightLines = [
    `Right ${trade.rightRef} when this trade was booked: holder ${original.holder} at version ${original.version}.`,
    current
      ? `Right ${trade.rightRef} in the last read: holder ${current.holder} at version ${current.version}.`
      : `Right ${trade.rightRef} is not in the last read.`,
  ];
  const refund = trade.facets.refund.observed;
  const stranded = refund !== null && refund.state === "unavailable";
  const refundLine = stranded
    ? `Refund: ${refund.code ?? PLATFORM_COMPENSATION_UNDEFINED}. ${refund.note} The right stays where the last read shows it.`
    : "Refund: nothing to compensate on this trade.";
  return {
    tradeRef: trade.tradeRef,
    linked: trade.linked,
    linkLine: trade.linked
      ? "Linked to a confirmed booking of this page."
      : "Observed only. It is not linked to a confirmed booking of this page, and this page does not claim it.",
    channelWord: CHANNEL_WORDS[trade.channel],
    shape: trade.shape,
    shapeLine: SHAPE_LINES[trade.shape],
    identities: [
      { kind: "listing", ref: trade.identities.listing },
      { kind: "right", ref: trade.identities.right },
      { kind: "trade", ref: trade.identities.trade },
      { kind: "payment", ref: trade.identities.payment },
      { kind: "transfer", ref: trade.identities.transfer },
      { kind: "refund", ref: trade.identities.refund },
    ],
    facets,
    rightLines,
    refundLine,
    stranded,
    transfer,
  };
}

function control(fence: PlatformFence | null): ControlModel {
  return fence === null ? { enabled: true, reason: null } : { enabled: false, reason: fenceLine(fence) };
}

function readStateToScreen(readState: PlatformReadState, refreshRequired: PlatformRefreshCause | null): PlatformScreenState {
  switch (readState) {
    case "none":
      return refreshRequired === "context-switch" ? "unread" : "loading";
    case "ready":
      return "ready";
    case "empty":
      return "empty";
    case "stale":
      return "stale";
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

function statusFor(state: PlatformScreenState, detail: string | null): { statusLine: string; detailLine: string; actionLabel: string | null } {
  switch (state) {
    case "loading":
      return { statusLine: "Reading the synthetic platform. Nothing is confirmed yet.", detailLine: "", actionLabel: null };
    case "unread":
      return {
        statusLine: "The session context changed, so there is no read in this context.",
        detailLine: "Read again to see the platform from this context. An earlier unknown write on a right still blocks that right.",
        actionLabel: "Read again",
      };
    case "ready":
      return { statusLine: "Platform read.", detailLine: "", actionLabel: null };
    case "empty":
      return { statusLine: "No listings in this synthetic session.", detailLine: "Nothing can be booked, changed, or transferred.", actionLabel: "Read again" };
    case "stale":
      return { statusLine: "Stale platform read.", detailLine: detail ?? "", actionLabel: "Read again" };
    case "not-bound":
      return { statusLine: PLATFORM_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: "The pin tuple changed. Nothing was read and nothing was applied.",
        detailLine: detail ?? "",
        actionLabel: "Start a new synthetic session",
      };
    case "unavailable":
      return { statusLine: "The source did not answer. This is not an empty platform.", detailLine: detail ?? "", actionLabel: "Read again" };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function lateLineOf(intent: PlatformIntent): string {
  if (intent.late === null) {
    return "";
  }
  const code = intent.late.code ? ` (${intent.late.code})` : "";
  return `Late result ${intent.late.result}${code}. Evidence only.`;
}

/** The unused-intent id the gate preview asks with. It is never sent. */
const GATE_PREVIEW = "gate-preview";

export function buildPlatformModel(input: {
  controller: PlatformJourneyController;
  last: LastAction | null;
}): PlatformModel {
  const { controller } = input;
  const state = controller.state();
  const screen = readStateToScreen(state.readState, state.refreshRequired);
  const status = statusFor(screen, state.readDetail);
  const projection = projectPlatform(state);
  const freshnessWord =
    state.freshness === "CURRENT"
      ? "The last read is current."
      : state.freshness === "STALE"
        ? "The last read is behind."
        : "There is no usable read.";

  const rights: RightModel[] = projection.rights.map((right) => {
    const listings = projection.listings
      .filter((listing) => listing.rightRef === right.rightRef)
      .map((listing): ListingModel => {
        const open = listing.status === "open";
        const bookControl = open
          ? control(controller.gateFor({ step: "book", intentRef: GATE_PREVIEW, listingRef: listing.listingRef }))
          : { enabled: false, reason: `Superseded by ${listing.supersededBy ?? "a newer listing"}. Book the newer listing.` };
        const repriceControl = open
          ? control(controller.gateFor({ step: "reprice", intentRef: GATE_PREVIEW, listingRef: listing.listingRef, nextTier: PLATFORM_TIERS[0] }))
          : { enabled: false, reason: `Superseded by ${listing.supersededBy ?? "a newer listing"}.` };
        return {
          listingRef: listing.listingRef,
          channel: listing.channel,
          channelWord: CHANNEL_WORDS[listing.channel],
          tier: listing.tier,
          termsRef: listing.termsRef,
          open,
          statusLine: open ? "Open at the last read." : `Superseded by ${listing.supersededBy ?? "a newer listing"}.`,
          book: bookControl,
          reprice: repriceControl,
        };
      });
    return {
      rightRef: right.rightRef,
      holderLine: `Holder ${right.holder} at version ${right.version}, from the last read. An observation, not your receipt.`,
      transfersLine:
        right.observedTransfers === 0
          ? "No trade has moved this right in the last read."
          : right.observedTransfers === 1
            ? "One trade moved this right in the last read."
            : `${right.observedTransfers} trades show as moving this right. That is an integrity fault, and this page does not call any of them a success.`,
      integrityFault: right.integrityFault,
      listings,
    };
  });

  const trades = projection.trades.map((trade) =>
    describeTrade(trade, control(controller.gateFor({ step: "transfer", intentRef: GATE_PREVIEW, tradeRef: trade.tradeRef }))),
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
      `${STEP_WORDS[intent.step]} ${intent.intentRef} on ${intent.targetRef} is ${intent.outcome.toLowerCase().replace("_", " ")}. No trade is linked to it, and a trade seen in a read is not claimed for it.`,
  );

  const counters = state.counters;
  const session: SessionModel = {
    contextLine: `Actor ${state.context.actorRef}, session ${state.context.incarnation}, mode ${state.context.environment}.`,
    countersLine: `Sent ${counters.sent}. Blocked before sending ${counters.fenced}. Not sent ${counters.notSent}. Reads dropped ${counters.droppedReads}.`,
    intents,
    quarantineLines,
    unlinkedLines,
  };

  const identity: IdentityRowModel[] = PLATFORM_IDENTITY_REGISTER.map((row) => ({
    id: row.id,
    platformField: row.platformField,
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
    rights,
    trades,
    session,
    identity,
    lastLine,
    lastNeedsFocus: attentionFor(input.last),
    lastSeq: input.last === null ? null : input.last.seq,
  };
}

/** Facets in display order, for tests and for the screen. */
export const PLATFORM_FACET_ORDER: readonly PlatformFacet[] = PLATFORM_FACETS;

export interface PlatformActions {
  refresh(): void;
  book(listingRef: string): void;
  transfer(tradeRef: string): void;
  reprice(listingRef: string, tier: PlatformTier): void;
  setScenario(next: PlatformScenario): void;
  deliverHeld(): void;
  deliverLate(): void;
  switchContext(): void;
  newSession(): void;
}

interface Session {
  port: PlatformJourneyPort;
  controller: PlatformJourneyController;
}

function createSession(environment: "stub" | "integration-http", scenario: PlatformScenario): Session {
  const port = platformJourneyPortFor(environment, { scenario });
  return { port, controller: new PlatformJourneyController(port, { actorRef: PLATFORM_DESK_ACTOR }) };
}

export function usePlatformJourney(): {
  environment: "stub" | "integration-http";
  scenario: PlatformScenario;
  model: PlatformModel;
  heldSupported: boolean;
  lateSupported: boolean;
  actions: PlatformActions;
} {
  const environment = protocol.describe().environment;
  const sessionRef = useRef<Session | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createSession(environment, "clean");
  }
  const [scenario, setScenarioState] = useState<PlatformScenario>("clean");
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
    async (input: PlatformStepInput) => {
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
    (next: PlatformScenario, text: string) => {
      sessionRef.current = createSession(environment, next);
      intentCounter.current = 0;
      setScenarioState(next);
      setEpoch((value) => value + 1);
      note(text);
    },
    [environment, note],
  );

  const actions: PlatformActions = {
    refresh() {
      void sessionRef.current?.controller.refresh();
    },
    book(listingRef) {
      void run({ step: "book", intentRef: nextIntent(), listingRef });
    },
    transfer(tradeRef) {
      void run({ step: "transfer", intentRef: nextIntent(), tradeRef });
    },
    reprice(listingRef, tier) {
      void run({ step: "reprice", intentRef: nextIntent(), listingRef, nextTier: tier });
    },
    setScenario(next) {
      startSession(next, `Started a new synthetic session with scenario ${next}. Earlier intents are gone, as after a reload.`);
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
      const next = session.controller.switchContext({ actorRef: current === PLATFORM_DESK_ACTOR ? PLATFORM_ALT_ACTOR : PLATFORM_DESK_ACTOR });
      note(
        `Session context switched to ${next.actorRef}, session ${next.incarnation}. A write in flight is now unknown and its result will be quarantined. Read again.`,
      );
    },
    newSession() {
      startSession(scenario, "Started a new synthetic session. Earlier intents are gone, as after a reload. Nothing was resolved at a producer.");
    },
  };

  const session = sessionRef.current;
  return {
    environment,
    scenario,
    model: buildPlatformModel({ controller: session.controller, last }),
    heldSupported: scenario === "held-response",
    lateSupported: scenario === "transfer-late",
    actions,
  };
}
