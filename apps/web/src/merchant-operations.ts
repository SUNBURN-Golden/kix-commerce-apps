import { messages as sourceCopy } from "./i18n/messages/merchant-operations";
import { sourceMessage } from "./i18n/source-message";
import { connectivityPort, connectivityController, connectedActions } from "./connectivity/write-guard";
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
import { protocol } from "./connectivity/desk-protocol";

export const MERCHANT_PAGE_TITLE = sourceCopy.en["ssm"];

export const MERCHANT_SOURCE_LINE =
  sourceCopy.en["six"];

export const MERCHANT_BOUNDARY =
  sourceCopy.en["s7s"];

export const MERCHANT_CUT_NOTE =
  sourceCopy.en["sj2"];

export const MERCHANT_CLAIM_NOTE =
  sourceCopy.en["sj6"];

export const MERCHANT_AGGREGATE_NOTE =
  sourceCopy.en["s22m"];

export const MERCHANT_EXPORT_NOTE =
  sourceCopy.en["s1sa"];

export const MERCHANT_SCOPE_NOTE = sourceMessage(sourceCopy.en["p.t7"], { v1: MERCHANT_OWN_REF, v2: MERCHANT_FOREIGN_REF });

export const MERCHANT_ACTOR_NOTE =
  sourceCopy.en["s1pw"];

export const MERCHANT_READ_NOTE =
  sourceCopy.en["s6f"];

export const MERCHANT_SESSION_NOTE =
  sourceCopy.en["s1c4"];

export const MERCHANT_SYNTHETIC_CONTROL_NOTE =
  sourceCopy.en["s1h7"];

export const MERCHANT_HOLD_NOTE = sourceMessage(sourceCopy.en["p.t8"], { v1: MERCHANT_HOLD_NOT_BOUND.reason });

export const MERCHANT_NOT_COMPOSED_NOTE = sourceMessage(sourceCopy.en["p.t9"], { v1: MERCHANT_NOT_COMPOSED.map((entry) => entry.action).join(", ") });

export const SCENARIO_NOTES: Readonly<Record<MerchantScenario, string>> = {
  clean: sourceCopy.en["sjb"],
  empty: sourceCopy.en["s1zk"],
  stale: sourceCopy.en["s21a"],
  "stale-aggregate": sourceCopy.en["s1z8"],
  "aggregate-mismatch": sourceCopy.en["s14g"],
  "mixed-cut": sourceCopy.en["s1tv"],
  "dangling-link": sourceCopy.en["s14a"],
  exceptions: sourceCopy.en["squ"],
  "claims-settled": sourceCopy.en["s20r"],
  "scope-leak": sourceCopy.en["s218"],
  denied: sourceCopy.en["s1t4"],
  "read-lost": sourceCopy.en["s1q3"],
  "export-partial": sourceCopy.en["s1s6"],
  "export-stale": sourceCopy.en["s1so"],
  "export-lines-differ": sourceCopy.en["s1sk"],
  "export-denied": sourceCopy.en["s1zc"],
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
  "sales-observed": sourceCopy.en["s1i1"],
  unpaid: sourceCopy.en["s25i"],
  held: sourceCopy.en["sn4"],
  "refund-burden": sourceCopy.en["s1eo"],
};

const LINE_STATE_WORDS: Readonly<Record<MerchantLineState, string>> = {
  observed: sourceCopy.en["s13j"],
  pending: sourceCopy.en["s17p"],
  exception: sourceCopy.en["sjy"],
  unknown: sourceCopy.en["s258"],
};

const TRADE_STATUS_WORDS: Readonly<Record<string, { word: string; line: string }>> = {
  booked: { word: sourceCopy.en["sad"], line: sourceCopy.en["s6"] },
  "payment-observed": { word: sourceCopy.en["s17j"], line: sourceCopy.en["s52"] },
  "right-moved": { word: sourceCopy.en["s1ha"], line: sourceCopy.en["s1xc"] },
  "payment-unknown": { word: sourceCopy.en["s17n"], line: sourceCopy.en["swv"] },
};

const VERDICT_REASON_WORDS: Readonly<Record<string, string>> = {
  NO_SNAPSHOT: sourceCopy.en["s1wk"],
  SNAPSHOT_MIXED: sourceCopy.en["s1tq"],
  SCOPE: sourceCopy.en["s1sf"],
  UNKNOWN_CUT: sourceCopy.en["s1se"],
  MIXED_CUT: sourceCopy.en["s1sh"],
  STALE_CUT: sourceCopy.en["s1sq"],
  AHEAD_CUT: sourceCopy.en["s1s8"],
  PARTIAL: sourceCopy.en["s1vg"],
  COUNT: sourceCopy.en["s1sc"],
  LINES_DIFFER: sourceCopy.en["s1sl"],
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
      return { statusLine: sourceCopy.en["s1bi"], detailLine: "", actionLabel: null };
    case "ready":
      return { statusLine: sourceCopy.en["ssk"], detailLine: "", actionLabel: null };
    case "empty":
      return {
        statusLine: sourceCopy.en["sy5"],
        detailLine: detail ?? sourceCopy.en["s3v"],
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "stale":
      return { statusLine: sourceCopy.en["s1lq"], detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    case "denied":
      return { statusLine: sourceMessage(sourceCopy.en["p.t10"], { v1: suffix }), detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    case "refused":
      return {
        statusLine: sourceMessage(sourceCopy.en["p.t11"], { v1: suffix }),
        detailLine: sourceMessage(sourceCopy.en["p.t12"], { v1: detail ?? "" }),
        actionLabel: sourceCopy.en["s1ax"],
      };
    case "invalid":
      return { statusLine: sourceMessage(sourceCopy.en["p.t13"], { v1: suffix }), detailLine: detail ?? "", actionLabel: sourceCopy.en["s1ax"] };
    case "not-bound":
      return { statusLine: MERCHANT_NOT_BOUND_REASON, detailLine: "", actionLabel: null };
    case "tuple-changed":
      return {
        statusLine: sourceCopy.en["s1v8"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1m2"],
      };
    case "unavailable":
      return {
        statusLine: sourceCopy.en["s1z6"],
        detailLine: detail ?? "",
        actionLabel: sourceCopy.en["s1ax"],
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
    return { verdictWord: "current", verdictLines: [sourceCopy.en["sfa"]] };
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
        statusLine: sourceCopy.en["svf"],
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
        statusLine: verdict.verdictWord === "current" ? sourceCopy.en["skj"] : sourceCopy.en["skk"],
        detailLine: "",
        verdictWord: verdict.verdictWord,
        verdictLines: verdict.verdictLines,
        exportRef: value?.exportRef ?? null,
        cutLine: value ? sourceMessage(sourceCopy.en["p.t306"], { v1: value.cutRef, v2: value.generation, v3: value.watermark }) : null,
        rowsLine: value ? sourceMessage(sourceCopy.en["p.t147"], { v1: value.rows.length, v2: value.declaredRowCount }) : null,
        completeLine: value ? (value.complete ? sourceCopy.en["s1vf"] : sourceCopy.en["s1vh"]) : null,
        digestLine: value ? sourceMessage(sourceCopy.en["p.t148"], { v1: value.digest ?? "none" }) : null,
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
      return emptyExport("denied", sourceMessage(sourceCopy.en["p.t149"], { v1: exported.code ?? "no code" }), exported.detail ?? "");
    case "refused":
      return emptyExport("refused", sourceMessage(sourceCopy.en["p.t150"], { v1: exported.code ?? "no code" }), exported.detail ?? "");
    case "invalid":
      return emptyExport("invalid", sourceMessage(sourceCopy.en["p.t151"], { v1: exported.code ?? "no code" }), exported.detail ?? "");
    case "not-bound":
      return emptyExport("not-bound", sourceCopy.en["s1sm"], exported.detail ?? MERCHANT_NOT_BOUND_REASON);
    case "tuple-changed":
      return emptyExport("tuple-changed", sourceCopy.en["s1v6"], exported.detail ?? "");
    case "unavailable":
      return emptyExport("unavailable", sourceCopy.en["s1s2"], exported.detail ?? "");
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
      ? sourceCopy.en["s1tn"]
      : state.freshness === "STALE"
        ? sourceCopy.en["s1ti"]
        : sourceCopy.en["s1wv"];

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
    usedBy: sourceMessage(sourceCopy.en["p.t469"], { v1: usedBy.get(cut.cutRef) ?? 0 }),
  }));
  const cutState = assessment?.cutState ?? "none";
  const cutLine =
    cutState === "single"
      ? sourceCopy.en["sjl"]
      : cutState === "mixed"
        ? sourceCopy.en["s1ht"]
        : sourceCopy.en["sy1"];

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
    reasonLine: row.reasonCode ? sourceMessage(sourceCopy.en["p.t17"], { v1: row.reasonCode }) : sourceCopy.en["sxk"],
    amountLine: `${row.amount} ${row.unit}`,
    claimLine: sourceCopy.en["s1jx"],
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
    (item) => sourceMessage(sourceCopy.en["p.t170"], { v1: item.lens, v2: item.ref, v3: item.missing, v4: item.missingRef }),
  );

  const exportControl: ControlModel =
    state.context.environment === "integration-http"
      ? { enabled: false, reason: MERCHANT_NOT_BOUND_REASON }
      : state.readState !== "ready"
        ? { enabled: false, reason: sourceCopy.en["s46"] }
        : { enabled: true, reason: null };

  const counters = state.counters;
  const session: MerchantSessionModel = {
    contextLine: sourceMessage(sourceCopy.en["p.t307"], { v1: state.context.actorRef, v2: state.context.scope.merchantRef, v3: state.context.incarnation, v4: state.context.environment }),
    countersLine: sourceMessage(sourceCopy.en["p.t308"], { v1: counters.reads, v2: counters.exports, v3: counters.notSent, v4: counters.droppedReads, v5: counters.droppedExports }),
    notComposedLine: MERCHANT_NOT_COMPOSED_NOTE,
    holdLine: MERCHANT_HOLD_NOTE,
  };

  return {
    state: screen,
    statusLine: status.statusLine,
    detailLine: status.detailLine,
    actionLabel: status.actionLabel,
    freshnessWord,
    scopeLine: sourceMessage(sourceCopy.en["p.t546"], { v1: state.context.scope.tenantId, v2: state.context.scope.merchantRef }),
    watermarkLine: snapshot ? sourceMessage(sourceCopy.en["p.t41"], { v1: snapshot.watermark, v2: snapshot.snapshotId }) : sourceCopy.en["s134"],
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
  const port = connectivityPort(merchantOperationsPortFor(environment, { scenario }), "merchant-operations");
  return { port, controller: connectivityController(new MerchantOperationsController(port, { actorRef: MERCHANT_DESK_ACTOR, merchantRef }), port) };
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
          note(result.reason === "not-bound" ? MERCHANT_NOT_BOUND_REASON : sourceCopy.en["svg"], true);
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
        sourceMessage(sourceCopy.en["p.t309"], { v1: context.scope.merchantRef, v2: context.incarnation }),
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
          ? sourceCopy.en["s21r"]
          : sourceCopy.en["s1wo"],
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
          ? sourceCopy.en["s223"]
          : sourceCopy.en["s1wp"],
        done,
      );
    },
    setScenario(next) {
      startSession(next, merchantRef, sourceMessage(sourceCopy.en["p.t310"], { v1: next }));
    },
    newSession() {
      startSession(scenario, merchantRef, sourceCopy.en["s1mb"]);
    },
  };

  const session = sessionRef.current;
  return {
    environment,
    scenario,
    merchantRef,
    model: buildMerchantModel({ controller: session.controller, last }),
    actions: connectedActions(actions, ['revokeGrant', 'advanceCut', 'newSession', 'setScenario'], sessionRef.current?.port),
  };
}
