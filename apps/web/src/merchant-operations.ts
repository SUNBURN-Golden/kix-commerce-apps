/**
 * The merchant workroom screen on top of the adapter's synthetic merchant source.
 * Stub scope: the default port is the synthetic ledger. On integration-http the same
 * port is not-bound — the contract-only catalogue has no read command for an event,
 * listing, trade, or settlement-obligation projection and no export command, and this
 * module does not invent one, send a second attempt, or switch adapters.
 *
 * This module computes no amount. It copies what the controller and the last read
 * hold: every figure is the source's own text, every figure stays on its own source
 * cut, and no line is ever shown as settled, as funds, or as lendable.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MERCHANT_DESK_ACTOR,
  MERCHANT_FOREIGN_REF,
  MERCHANT_HOLD_NOT_BOUND,
  MERCHANT_NOT_BOUND_REASON,
  MERCHANT_NOT_COMPOSED,
  MERCHANT_OWN_REF,
  MerchantOperationsController,
  merchantOperationsPortFor,
  type MerchantExportPhase,
  type MerchantExportState,
  type MerchantExportVerdict,
  type MerchantLineKind,
  type MerchantLineState,
  type MerchantOperationsPort,
  type MerchantReadState,
  type MerchantScenario,
} from "@kix/protocol-adapter";
import { protocol } from "./protocol";

export const MERCHANT_PAGE_TITLE = "Merchant workroom (synthetic)";

export const MERCHANT_SOURCE_LINE =
  "Events, listings, trades, money lines, cuts, and the export come from a synthetic merchant source on this page load. They are not a producer read and not a catalogue receipt.";

export const MERCHANT_BOUNDARY =
  "A sales figure is an observation of the order side. It is never settlement, never available funds, and never something to lend against.";

export const MERCHANT_CUT_NOTE =
  "Every figure belongs to a source cut. Figures from different cuts are never merged into one confirmed balance, and a read that spans cuts has no single export.";

export const MERCHANT_CLAIM_NOTE =
  "Every line states settled, fundsAvailable, and lendable as false. A payload that says anything else, or stays silent, is refused before a row is shown.";

export const MERCHANT_AGGREGATE_NOTE =
  "The totals are the source's own text. This page checks their cut and their line count and recomputes no figure.";

export const MERCHANT_EXPORT_NOTE =
  "The export is the producer's own file. It is current only when it is one complete export of the cut the last read saw. Anything else is withheld with every reason, and this page does not repair it.";

export const MERCHANT_SCOPE_NOTE = `The desk actor holds a synthetic grant for ${MERCHANT_OWN_REF} and none for ${MERCHANT_FOREIGN_REF}. A scope the grant does not cover is refused and leaves no row on screen.`;

export const MERCHANT_ACTOR_NOTE =
  "The actor string is a context label. It is not an authentication result, and the source does not trust it for access.";

export const MERCHANT_READ_NOTE =
  "A read is one request and an export is one request. Neither is sent again by this page. An answer that arrives after the scope changed is dropped.";

export const MERCHANT_SESSION_NOTE =
  "Reads and exports live in this page load only. A reload or a new synthetic session clears them and resolves nothing at a producer.";

export const MERCHANT_SYNTHETIC_CONTROL_NOTE =
  "Revoke grant and advance source cut are synthetic controls a real producer does not offer. They stand in for a withdrawn grant and a source that moved on.";

export const MERCHANT_HOLD_NOTE = `Holding a seat is not available here. ${MERCHANT_HOLD_NOT_BOUND.reason}`;

export const MERCHANT_NOT_COMPOSED_NOTE = `Catalogue actions recorded and never composed here: ${MERCHANT_NOT_COMPOSED.map((entry) => entry.action).join(", ")}.`;

export const SCENARIO_NOTES: Readonly<Record<MerchantScenario, string>> = {
  clean: "Every read and export is answered.",
  empty: "The source has no rows for this merchant.",
  stale: "The source serves a watermark older than the floor this page holds.",
  "stale-aggregate": "The source figures were built at an older generation than the cut they name.",
  "aggregate-mismatch": "One source figure counts lines the read does not list.",
  "mixed-cut": "The lines span two source cuts, so no single export is current.",
  "dangling-link": "One line names a trade the read does not list.",
  exceptions: "Lines carry exception and unknown states as the source names them.",
  "claims-settled": "The source sends a line that claims it is settled. The payload is refused.",
  "scope-leak": "The source sends a row that belongs to another merchant. The payload is refused.",
  denied: "The grant for this actor is withdrawn at the source.",
  "read-lost": "The answer to a read never arrives.",
  "export-partial": "The export is cut off before it lists every row.",
  "export-stale": "The export was taken at an older generation than the cut the read saw.",
  "export-lines-differ": "The export rows differ from the lines the read lists.",
  "export-denied": "The source grants the read and no export.",
};

export type MerchantScreenState =
  | "loading"
  | "ready"
  | "empty"
  | "stale"
  | "denied"
  | "refused"
  | "invalid"
  | "not-bound"
  | "tuple-changed"
  | "unavailable";

export interface ControlModel {
  enabled: boolean;
  /** Why the control is off. Null when it is on. */
  reason: string | null;
}

export interface MerchantCutModel {
  cutRef: string;
  source: string;
  generation: number;
  watermark: string;
  usedBy: string;
}

export interface MerchantEventModel {
  eventRef: string;
  title: string;
  statusWord: string;
  cutRef: string;
}

export interface MerchantListingModel {
  listingRef: string;
  eventRef: string;
  channel: string;
  statusWord: string;
  cutRef: string;
}

export interface MerchantTradeModel {
  tradeRef: string;
  listingRef: string;
  eventRef: string;
  statusWord: string;
  statusLine: string;
  cutRef: string;
}

export interface MerchantLineModel {
  obligationRef: string;
  kind: MerchantLineKind;
  kindWord: string;
  state: MerchantLineState;
  stateWord: string;
  reasonLine: string;
  amountLine: string;
  claimLine: string;
  cutRef: string;
}

export interface MerchantAggregateModel {
  kind: MerchantLineKind;
  kindWord: string;
  cutRef: string;
  generation: number;
  lineCount: number;
  amountLine: string;
  flagLines: string[];
}

export interface MerchantExportRowModel {
  obligationRef: string;
  kindWord: string;
  stateWord: string;
  tradeRef: string;
  amountLine: string;
  cutRef: string;
}

export interface MerchantExportModel {
  phase: MerchantExportPhase;
  statusLine: string;
  detailLine: string;
  verdictWord: "current" | "withheld" | "none";
  verdictLines: string[];
  exportRef: string | null;
  cutLine: string | null;
  rowsLine: string | null;
  completeLine: string | null;
  digestLine: string | null;
  rows: MerchantExportRowModel[];
}

export interface MerchantSessionModel {
  contextLine: string;
  countersLine: string;
  notComposedLine: string;
  holdLine: string;
}

export type LastAction = { seq: number; text: string; attention: boolean };

export interface MerchantModel {
  state: MerchantScreenState;
  statusLine: string;
  detailLine: string;
  actionLabel: string | null;
  freshnessWord: string;
  scopeLine: string;
  watermarkLine: string;
  cutState: "none" | "single" | "mixed";
  cutLine: string;
  cuts: MerchantCutModel[];
  events: MerchantEventModel[];
  listings: MerchantListingModel[];
  trades: MerchantTradeModel[];
  lines: MerchantLineModel[];
  aggregateState: "none" | "current" | "stale" | "mismatch";
  aggregate: MerchantAggregateModel[];
  unlinkedLines: string[];
  export: MerchantExportModel;
  exportControl: ControlModel;
  session: MerchantSessionModel;
  lastLine: string | null;
  lastNeedsFocus: boolean;
  lastSeq: number | null;
}

const KIND_WORDS: Readonly<Record<MerchantLineKind, string>> = {
  "sales-observed": "Sales observed",
  unpaid: "Unpaid",
  held: "Held",
  "refund-burden": "Refund burden",
};

const LINE_STATE_WORDS: Readonly<Record<MerchantLineState, string>> = {
  observed: "Observed",
  pending: "Pending",
  exception: "Exception",
  unknown: "Unknown",
};

const TRADE_STATUS_WORDS: Readonly<Record<string, { word: string; line: string }>> = {
  booked: { word: "Booked", line: "A booking is recorded on the order side. It says nothing about settlement." },
  "payment-observed": { word: "Payment observed", line: "A payment observation is recorded. It is not a claim that funds are available." },
  "right-moved": { word: "Right moved", line: "The right moved for this trade. It says nothing about settlement." },
  "payment-unknown": { word: "Payment unknown", line: "No payment observation arrived. Whether funds moved is not known here." },
};

const VERDICT_REASON_WORDS: Readonly<Record<string, string>> = {
  NO_SNAPSHOT: "there is no read to judge it against",
  SNAPSHOT_MIXED: "the last read spans more than one cut, so no single export is current",
  SCOPE: "the export names another scope",
  UNKNOWN_CUT: "the export names a cut the read does not list",
  MIXED_CUT: "the export rows are not all on the cut the export names",
  STALE_CUT: "the export was taken before the cut the read saw",
  AHEAD_CUT: "the export is newer than the cut the read saw, so the read is behind",
  PARTIAL: "the producer says the export was cut off",
  COUNT: "the export lists a different number of rows than the producer declared",
  LINES_DIFFER: "the export rows differ from the lines the read lists",
};

function readStateToScreen(readState: MerchantReadState): MerchantScreenState {
  switch (readState) {
    case "none":
      return "loading";
    case "ready":
      return "ready";
    case "empty":
      return "empty";
    case "stale":
      return "stale";
    case "denied":
      return "denied";
    case "refused":
      return "refused";
    case "invalid":
      return "invalid";
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

function statusFor(state: MerchantScreenState, code: string | null, detail: string | null): {
  statusLine: string;
  detailLine: string;
  actionLabel: string | null;
} {
  const suffix = code ? ` (${code})` : "";
  switch (state) {
    case "loading":
      return { statusLine: "Reading the synthetic merchant ledger. Nothing is shown yet.", detailLine: "", actionLabel: null };
    case "ready":
      return { statusLine: "Merchant read.", detailLine: "", actionLabel: null };
    case "empty":
      return {
        statusLine: "No rows for this merchant in this read.",
        detailLine: detail ?? "An empty ledger is not a zero figure.",
        actionLabel: "Read again",
      };
    case "stale":
      return { statusLine: "Stale merchant read.", detailLine: detail ?? "", actionLabel: "Read again" };
    case "denied":
      return { statusLine: `The source refused this scope${suffix}.`, detailLine: detail ?? "", actionLabel: "Read again" };
    case "refused":
      return {
        statusLine: `The source sent a payload this page does not trust${suffix}.`,
        detailLine: `${detail ?? ""} No row from it is shown.`,
        actionLabel: "Read again",
      };
    case "invalid":
      return { statusLine: `The request was refused before it read${suffix}.`, detailLine: detail ?? "", actionLabel: "Read again" };
    case "not-bound":
      return { statusLine: MERCHANT_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: "The pin tuple changed. Nothing was read and nothing was applied.",
        detailLine: detail ?? "",
        actionLabel: "Start a new synthetic session",
      };
    case "unavailable":
      return {
        statusLine: "The source did not answer. This is not an empty ledger.",
        detailLine: detail ?? "",
        actionLabel: "Read again",
      };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function verdictModel(verdict: MerchantExportVerdict | null): { verdictWord: MerchantExportModel["verdictWord"]; verdictLines: string[] } {
  if (verdict === null) {
    return { verdictWord: "none", verdictLines: [] };
  }
  if (verdict.state === "current") {
    return { verdictWord: "current", verdictLines: ["Current export for the last read."] };
  }
  return {
    verdictWord: "withheld",
    verdictLines: verdict.reasons.map((reason) => `${reason}: ${VERDICT_REASON_WORDS[reason] ?? reason}.`),
  };
}

function exportModel(exported: MerchantExportState): MerchantExportModel {
  const verdict = verdictModel(exported.verdict);
  switch (exported.phase) {
    case "none":
      return {
        phase: "none",
        statusLine: "No export is loaded. An export is requested only after a ready read.",
        detailLine: "",
        verdictWord: "none",
        verdictLines: [],
        exportRef: null,
        cutLine: null,
        rowsLine: null,
        completeLine: null,
        digestLine: null,
        rows: [],
      };
    case "loaded": {
      const value = exported.value;
      return {
        phase: "loaded",
        statusLine: verdict.verdictWord === "current" ? "Export loaded and current for the last read." : "Export loaded. It is not the current export.",
        detailLine: "",
        verdictWord: verdict.verdictWord,
        verdictLines: verdict.verdictLines,
        exportRef: value?.exportRef ?? null,
        cutLine: value ? `Cut ${value.cutRef} at generation ${value.generation}. Watermark ${value.watermark}.` : null,
        rowsLine: value ? `${value.rows.length} rows of ${value.declaredRowCount} declared.` : null,
        completeLine: value ? (value.complete ? "The producer says the export is complete." : "The producer says the export was cut off.") : null,
        digestLine: value ? `Digest ${value.digest ?? "none"}. Opaque producer text; this page does not verify it.` : null,
        rows:
          value?.rows.map((row) => ({
            obligationRef: row.obligationRef,
            kindWord: KIND_WORDS[row.kind],
            stateWord: LINE_STATE_WORDS[row.state],
            tradeRef: row.tradeRef,
            amountLine: `${row.amount} ${row.unit}`,
            cutRef: row.cutRef,
          })) ?? [],
      };
    }
    case "denied":
      return emptyExport("denied", `The source refused the export (${exported.code ?? "no code"}).`, exported.detail ?? "");
    case "refused":
      return emptyExport("refused", `The export payload was refused (${exported.code ?? "no code"}).`, exported.detail ?? "");
    case "invalid":
      return emptyExport("invalid", `The export request was refused (${exported.code ?? "no code"}).`, exported.detail ?? "");
    case "not-bound":
      return emptyExport("not-bound", "The export stays not-bound.", exported.detail ?? MERCHANT_NOT_BOUND_REASON);
    case "tuple-changed":
      return emptyExport("tuple-changed", "The pin tuple changed. No export was applied.", exported.detail ?? "");
    case "unavailable":
      return emptyExport("unavailable", "The export answer did not arrive.", exported.detail ?? "");
    default: {
      const exhaustive: never = exported.phase;
      return exhaustive;
    }
  }
}

function emptyExport(phase: MerchantExportPhase, statusLine: string, detailLine: string): MerchantExportModel {
  return {
    phase,
    statusLine,
    detailLine,
    verdictWord: "none",
    verdictLines: [],
    exportRef: null,
    cutLine: null,
    rowsLine: null,
    completeLine: null,
    digestLine: null,
    rows: [],
  };
}

export function buildMerchantModel(input: { controller: MerchantOperationsController; last: LastAction | null }): MerchantModel {
  const { controller } = input;
  const state = controller.state();
  const screen = readStateToScreen(state.readState);
  const status = statusFor(screen, state.readCode, state.readDetail);
  const snapshot = state.snapshot;
  const assessment = state.assessment;

  const freshnessWord =
    state.freshness === "CURRENT"
      ? "The last read is current."
      : state.freshness === "STALE"
        ? "The last read is behind."
        : "There is no usable read.";

  const usedBy = new Map<string, number>();
  if (snapshot) {
    for (const row of [...snapshot.events, ...snapshot.listings, ...snapshot.trades, ...snapshot.lines]) {
      usedBy.set(row.cutRef, (usedBy.get(row.cutRef) ?? 0) + 1);
    }
  }
  const cuts: MerchantCutModel[] = (assessment?.usedCuts ?? []).map((cut) => ({
    cutRef: cut.cutRef,
    source: cut.source,
    generation: cut.generation,
    watermark: cut.watermark,
    usedBy: `${usedBy.get(cut.cutRef) ?? 0} rows`,
  }));
  const cutState = assessment?.cutState ?? "none";
  const cutLine =
    cutState === "single"
      ? "Every row is on one source cut."
      : cutState === "mixed"
        ? "Rows are on more than one source cut. They are not merged, and no single export is current."
        : "No row carries a source cut in this read.";

  const events: MerchantEventModel[] = (snapshot?.events ?? []).map((row) => ({
    eventRef: row.eventRef,
    title: row.title,
    statusWord: row.statusLabel,
    cutRef: row.cutRef,
  }));
  const listings: MerchantListingModel[] = (snapshot?.listings ?? []).map((row) => ({
    listingRef: row.listingRef,
    eventRef: row.eventRef,
    channel: row.channel,
    statusWord: row.statusLabel,
    cutRef: row.cutRef,
  }));
  const trades: MerchantTradeModel[] = (snapshot?.trades ?? []).map((row) => {
    const status = TRADE_STATUS_WORDS[row.statusLabel] ?? { word: row.statusLabel, line: "" };
    return {
      tradeRef: row.tradeRef,
      listingRef: row.listingRef,
      eventRef: row.eventRef,
      statusWord: status.word,
      statusLine: status.line,
      cutRef: row.cutRef,
    };
  });
  const lines: MerchantLineModel[] = (snapshot?.lines ?? []).map((row) => ({
    obligationRef: row.obligationRef,
    kind: row.kind,
    kindWord: KIND_WORDS[row.kind],
    state: row.state,
    stateWord: LINE_STATE_WORDS[row.state],
    reasonLine: row.reasonCode ? `Reason ${row.reasonCode} as the source names it.` : "No reason named.",
    amountLine: `${row.amount} ${row.unit}`,
    claimLine: "settled false · fundsAvailable false · lendable false",
    cutRef: row.cutRef,
  }));

  const flagByKey = new Map<string, string[]>();
  for (const flag of assessment?.aggregate.flags ?? []) {
    const key = `${flag.kind}|${flag.cutRef}`;
    flagByKey.set(key, [...(flagByKey.get(key) ?? []), `${flag.code}: ${flag.detail}`]);
  }
  const aggregate: MerchantAggregateModel[] = (snapshot?.aggregate ?? []).map((row) => ({
    kind: row.kind,
    kindWord: KIND_WORDS[row.kind],
    cutRef: row.cutRef,
    generation: row.generation,
    lineCount: row.lineCount,
    amountLine: `${row.amount} ${row.unit}`,
    flagLines: flagByKey.get(`${row.kind}|${row.cutRef}`) ?? [],
  }));
  const unlinkedLines = (assessment?.unlinked ?? []).map(
    (item) => `${item.lens} row ${item.ref} names ${item.missing} ${item.missingRef}, which the read does not list. It is not attached elsewhere.`,
  );

  const exportControl: ControlModel =
    state.context.environment === "integration-http"
      ? { enabled: false, reason: MERCHANT_NOT_BOUND_REASON }
      : state.readState !== "ready"
        ? { enabled: false, reason: "An export is judged against the last read. Read the ledger first." }
        : { enabled: true, reason: null };

  const counters = state.counters;
  const session: MerchantSessionModel = {
    contextLine: `Actor ${state.context.actorRef}, merchant scope ${state.context.scope.merchantRef}, session ${state.context.incarnation}, mode ${state.context.environment}.`,
    countersLine: `Reads ${counters.reads}. Exports ${counters.exports}. Not sent ${counters.notSent}. Reads dropped ${counters.droppedReads}. Exports dropped ${counters.droppedExports}.`,
    notComposedLine: MERCHANT_NOT_COMPOSED_NOTE,
    holdLine: MERCHANT_HOLD_NOTE,
  };

  return {
    state: screen,
    statusLine: status.statusLine,
    detailLine: status.detailLine,
    actionLabel: status.actionLabel,
    freshnessWord,
    scopeLine: `Tenant ${state.context.scope.tenantId}. Merchant ${state.context.scope.merchantRef}.`,
    watermarkLine: snapshot ? `Watermark ${snapshot.watermark}. Read ${snapshot.snapshotId} on this port.` : "No watermark without a ready read.",
    cutState,
    cutLine,
    cuts,
    events,
    listings,
    trades,
    lines,
    aggregateState: assessment?.aggregate.state ?? "none",
    aggregate,
    unlinkedLines,
    export: exportModel(state.export),
    exportControl,
    session,
    lastLine: input.last === null ? null : input.last.text,
    lastNeedsFocus: input.last?.attention ?? false,
    lastSeq: input.last === null ? null : input.last.seq,
  };
}

export interface MerchantActions {
  refresh(): void;
  loadExport(): void;
  switchScope(): void;
  revokeGrant(): void;
  advanceCut(): void;
  setScenario(next: MerchantScenario): void;
  newSession(): void;
}

interface Session {
  port: MerchantOperationsPort;
  controller: MerchantOperationsController;
}

function createSession(environment: "stub" | "integration-http", scenario: MerchantScenario, merchantRef: string): Session {
  const port = merchantOperationsPortFor(environment, { scenario });
  return { port, controller: new MerchantOperationsController(port, { actorRef: MERCHANT_DESK_ACTOR, merchantRef }) };
}

export function useMerchantOperations(): {
  environment: "stub" | "integration-http";
  scenario: MerchantScenario;
  merchantRef: string;
  model: MerchantModel;
  actions: MerchantActions;
} {
  const environment = protocol.describe().environment;
  const sessionRef = useRef<Session | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createSession(environment, "clean", MERCHANT_OWN_REF);
  }
  const [scenario, setScenarioState] = useState<MerchantScenario>("clean");
  const [merchantRef, setMerchantRef] = useState<string>(MERCHANT_OWN_REF);
  const [epoch, setEpoch] = useState(0);
  const [, setTick] = useState(0);
  const [last, setLast] = useState<LastAction | null>(null);
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
    (next: MerchantScenario, scope: string, text: string) => {
      sessionRef.current = createSession(environment, next, scope);
      setScenarioState(next);
      setEpoch((value) => value + 1);
      note(text);
    },
    [environment, note],
  );

  const actions: MerchantActions = {
    refresh() {
      void sessionRef.current?.controller.read();
    },
    loadExport() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      void session.controller.loadExport().then((result) => {
        if (sessionRef.current !== session) {
          return;
        }
        if (result.kind === "NOT_SENT") {
          note(result.reason === "not-bound" ? MERCHANT_NOT_BOUND_REASON : "No export was sent. Read the ledger first.", true);
        }
      });
    },
    switchScope() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const next = session.controller.state().context.scope.merchantRef === MERCHANT_OWN_REF ? MERCHANT_FOREIGN_REF : MERCHANT_OWN_REF;
      const context = session.controller.switchScope(next);
      setMerchantRef(next);
      note(
        `Switched the merchant scope to ${context.scope.merchantRef}, session ${context.incarnation}. Rows and the export of the earlier scope are cleared, and an answer in flight for it is dropped. Read again.`,
      );
    },
    revokeGrant() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const done = session.port.revokeGrant();
      note(
        done
          ? "The synthetic grant is withdrawn at the source. The next read is refused. A real producer offers no such control."
          : "There is no synthetic source to withdraw a grant from.",
        done,
      );
    },
    advanceCut() {
      const session = sessionRef.current;
      if (session === null) {
        return;
      }
      const done = session.port.advanceCut();
      note(
        done
          ? "The synthetic source moved on to its next cut generation. An export taken before it is now behind, and the next read sees the new generation."
          : "There is no synthetic source to advance.",
        done,
      );
    },
    setScenario(next) {
      startSession(next, merchantRef, `Started a new synthetic session with scenario ${next}. Earlier reads and exports are gone, as after a reload.`);
    },
    newSession() {
      startSession(scenario, merchantRef, "Started a new synthetic session. Earlier reads and exports are gone, as after a reload. Nothing was resolved at a producer.");
    },
  };

  const session = sessionRef.current;
  return {
    environment,
    scenario,
    merchantRef,
    model: buildMerchantModel({ controller: session.controller, last }),
    actions,
  };
}
