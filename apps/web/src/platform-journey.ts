import { messages as sourceCopy } from "./i18n/messages/platform-journey";
import { sourceMessage } from "./i18n/source-message";
import { connectivityPort, connectivityController, connectedActions } from "./connectivity/write-guard";
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
import { protocol } from "./connectivity/desk-protocol";

export const PLATFORM_TITLE = sourceCopy.en["s24i"];

export const PLATFORM_SOURCE_LINE =
  sourceCopy.en["sr8"];

export const PLATFORM_BOUNDARY =
  sourceCopy.en["si1"];

export const PLATFORM_TIER_NOTE = sourceCopy.en["s246"];

export const PLATFORM_ACTOR_NOTE =
  sourceCopy.en["s1pw"];

export const PLATFORM_SESSION_NOTE =
  sourceCopy.en["sog"];

export const PLATFORM_FENCE_NOTE =
  sourceCopy.en["s14m"];

export const PLATFORM_READ_NOTE =
  sourceCopy.en["s14c"];

export const PLATFORM_HOLD_NOTE = sourceMessage(sourceCopy.en["p.t8"], { v1: PLATFORM_HOLD_NOT_BOUND.reason });

export const PLATFORM_REFUND_NOTE = sourceMessage(sourceCopy.en["p.t354"], { v1: PLATFORM_REFUND_NOT_BOUND.action, v2: PLATFORM_REFUND_NOT_BOUND.status, v3: PLATFORM_REFUND_NOT_BOUND.state });

export const PLATFORM_ALT_ACTOR = "platform-desk-2";

export const SCENARIO_NOTES: Readonly<Record<PlatformScenario, string>> = {
  clean: sourceCopy.en["sjs"],
  empty: sourceCopy.en["s1zf"],
  stale: sourceCopy.en["s21a"],
  "rival-channel": sourceCopy.en["s4k"],
  "payment-lost": sourceCopy.en["s5"],
  "book-lost": sourceCopy.en["s4"],
  "transfer-lost": sourceCopy.en["s8s"],
  "transfer-late": sourceCopy.en["s8t"],
  "held-response": sourceCopy.en["s4o"],
};

const STEP_WORDS = { book: "Booking", transfer: sourceCopy.en["s24j"], reprice: sourceCopy.en["s245"] } as const;

const CHANNEL_WORDS: Readonly<Record<PlatformChannel, string>> = {
  "web-board": sourceCopy.en["s26h"],
  "partner-board": sourceCopy.en["s179"],
};

const FACET_LABELS: Readonly<Record<PlatformFacet, string>> = {
  booking: "Booking",
  payment: sourceCopy.en["s17i"],
  issuance: sourceCopy.en["s1hc"],
  refund: sourceCopy.en["s1ek"],
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
export function fenceLine(fence: PlatformFence): string {
  switch (fence.reason) {
    case "in-flight":
      return sourceMessage(sourceCopy.en["p.t355"], { v1: fence.intentRef });
    case "unknown-outcome": {
      const late = fence.lateRecorded ? " A late result was recorded, and it does not make the write known." : "";
      const earlier = fence.earlierContext ? " It was sent in an earlier session context." : "";
      return sourceMessage(sourceCopy.en["p.t356"], { v1: fence.intentRef, v2: late, v3: earlier });
    }
    case "no-snapshot":
      return sourceCopy.en["s1cm"];
    case "snapshot-stale":
      return sourceMessage(sourceCopy.en["p.t86"], { v1: causeLine(fence.cause) });
    case "duplicate-intent":
      return sourceMessage(sourceCopy.en["p.t87"], { v1: fence.intentRef });
    case "payment-unobserved":
      return sourceMessage(sourceCopy.en["p.t357"], { v1: fence.tradeRef });
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
      return sourceMessage(sourceCopy.en["p.t358"], { v1: word });
    case "REJECTED":
      return sourceMessage(sourceCopy.en["p.t193"], { v1: word, v2: result.intent.code ?? "no code", v3: result.intent.message ?? "" }).trim();
    case "UNKNOWN":
      return sourceMessage(sourceCopy.en["p.t359"], { v1: word, v2: result.intent.code ?? "no code" });
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

function writeWord(view: PlatformFacetView): { kind: string; word: string } {
  if (view.outcome === "NOT_BOUND") {
    return { kind: "not-bound", word: sourceCopy.en["s135"] };
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

function observedWord(view: PlatformFacetView): { kind: string; word: string } {
  const seen = view.observed;
  if (seen === null) {
    return { kind: "none", word: sourceCopy.en["s12d"] };
  }
  const code = seen.code ? ` (${seen.code})` : "";
  switch (seen.state) {
    case "observed":
      return { kind: "observed", word: sourceCopy.en["s13m"] };
    case "none":
      return { kind: "not-observed", word: sourceCopy.en["s120"] };
    case "unknown":
      return { kind: "unknown", word: sourceMessage(sourceCopy.en["p.t361"], { v1: code }) };
    case "unavailable":
      return { kind: "unavailable", word: sourceMessage(sourceCopy.en["p.t562"], { v1: code }) };
    default: {
      const exhaustive: never = seen.state;
      return exhaustive;
    }
  }
}

const SHAPE_LINES: Readonly<Record<PlatformTradeShape, string>> = {
  "booking-only": sourceCopy.en["s14p"],
  "booking-payment-right": sourceCopy.en["s3"],
  "payment-without-right": sourceCopy.en["s51"],
  "right-without-payment": sourceCopy.en["s1xb"],
  "payment-unknown": sourceCopy.en["swv"],
  "unknown-effect": sourceCopy.en["s22n"],
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
    sourceMessage(sourceCopy.en["p.t362"], { v1: trade.rightRef, v2: original.holder, v3: original.version }),
    current
      ? sourceMessage(sourceCopy.en["p.t363"], { v1: trade.rightRef, v2: current.holder, v3: current.version })
      : sourceMessage(sourceCopy.en["p.t364"], { v1: trade.rightRef }),
  ];
  const refund = trade.facets.refund.observed;
  const stranded = refund !== null && refund.state === "unavailable";
  const refundLine = stranded
    ? sourceMessage(sourceCopy.en["p.t365"], { v1: refund.code ?? PLATFORM_COMPENSATION_UNDEFINED, v2: refund.note })
    : sourceCopy.en["s1es"];
  return {
    tradeRef: trade.tradeRef,
    linked: trade.linked,
    linkLine: trade.linked
      ? sourceCopy.en["sqy"]
      : sourceCopy.en["s13n"],
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
      return { statusLine: sourceCopy.en["s1bl"], detailLine: "", actionLabel: null };
    case "unread":
      return {
        statusLine: sourceCopy.en["s1xx"],
        detailLine: sourceCopy.en["s1b3"],
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "ready":
      return { statusLine: sourceCopy.en["s18h"], detailLine: "", actionLabel: null };
    case "empty":
      return { statusLine: sourceCopy.en["sw3"], detailLine: sourceCopy.en["s113"], actionLabel: sourceCopy.en["s1ax"] };
    case "stale":
      return { statusLine: sourceCopy.en["s1lt"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    case "not-bound":
      return { statusLine: PLATFORM_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: sourceCopy.en["s1v8"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1m2"],
      };
    case "unavailable":
      return { statusLine: sourceCopy.en["s1yx"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
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
  return sourceMessage(sourceCopy.en["p.t195"], { v1: intent.late.result, v2: code });
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
      ? sourceCopy.en["s1tn"]
      : state.freshness === "STALE"
        ? sourceCopy.en["s1ti"]
        : sourceCopy.en["s1wv"];

  const rights: RightModel[] = projection.rights.map((right) => {
    const listings = projection.listings
      .filter((listing) => listing.rightRef === right.rightRef)
      .map((listing): ListingModel => {
        const open = listing.status === "open";
        const bookControl = open
          ? control(controller.gateFor({ step: "book", intentRef: GATE_PREVIEW, listingRef: listing.listingRef }))
          : { enabled: false, reason: sourceMessage(sourceCopy.en["p.t366"], { v1: listing.supersededBy ?? "a newer listing" }) };
        const repriceControl = open
          ? control(controller.gateFor({ step: "reprice", intentRef: GATE_PREVIEW, listingRef: listing.listingRef, nextTier: PLATFORM_TIERS[0] }))
          : { enabled: false, reason: sourceMessage(sourceCopy.en["p.t367"], { v1: listing.supersededBy ?? "a newer listing" }) };
        return {
          listingRef: listing.listingRef,
          channel: listing.channel,
          channelWord: CHANNEL_WORDS[listing.channel],
          tier: listing.tier,
          termsRef: listing.termsRef,
          open,
          statusLine: open ? sourceCopy.en["s14y"] : sourceMessage(sourceCopy.en["p.t367"], { v1: listing.supersededBy ?? "a newer listing" }),
          book: bookControl,
          reprice: repriceControl,
        };
      });
    return {
      rightRef: right.rightRef,
      holderLine: sourceMessage(sourceCopy.en["p.t368"], { v1: right.holder, v2: right.version }),
      transfersLine:
        right.observedTransfers === 0
          ? sourceCopy.en["s129"]
          : right.observedTransfers === 1
            ? sourceCopy.en["s14i"]
            : sourceMessage(sourceCopy.en["p.t369"], { v1: right.observedTransfers }),
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
    (item) => sourceMessage(sourceCopy.en["p.t122"], { v1: item.arrived, v2: item.intentRef, v3: item.cause }),
  );
  const unlinkedLines = projection.unlinkedIntents.map(
    (intent) =>
      sourceMessage(sourceCopy.en["p.t370"], { v1: STEP_WORDS[intent.step], v2: intent.intentRef, v3: intent.targetRef, v4: intent.outcome.toLowerCase().replace("_", " ") }),
  );

  const counters = state.counters;
  const session: SessionModel = {
    contextLine: sourceMessage(sourceCopy.en["p.t563"], { v1: state.context.actorRef, v2: state.context.incarnation, v3: state.context.environment }),
    countersLine: sourceMessage(sourceCopy.en["p.t206"], { v1: counters.sent, v2: counters.fenced, v3: counters.notSent, v4: counters.droppedReads }),
    intents,
    quarantineLines,
    unlinkedLines,
  };

  const identity: IdentityRowModel[] = PLATFORM_IDENTITY_REGISTER.map((row) => ({
    id: row.id,
    platformField: row.platformField,
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
  const port = connectivityPort(platformJourneyPortFor(environment, { scenario }), "platform-journey");
  return { port, controller: connectivityController(new PlatformJourneyController(port, { actorRef: PLATFORM_DESK_ACTOR }), port) };
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
      startSession(next, sourceMessage(sourceCopy.en["p.t217"], { v1: next }));
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
      const next = session.controller.switchContext({ actorRef: current === PLATFORM_DESK_ACTOR ? PLATFORM_ALT_ACTOR : PLATFORM_DESK_ACTOR });
      note(
        sourceMessage(sourceCopy.en["p.t247"], { v1: next.actorRef, v2: next.incarnation }),
      );
    },
    newSession() {
      startSession(scenario, sourceCopy.en["s1ma"]);
    },
  };

  const session = sessionRef.current;
  return {
    environment,
    scenario,
    model: buildPlatformModel({ controller: session.controller, last }),
    heldSupported: scenario === "held-response",
    lateSupported: scenario === "transfer-late",
    actions: connectedActions(actions, ['book', 'transfer', 'reprice', 'setScenario', 'newSession'], sessionRef.current?.port),
  };
}
