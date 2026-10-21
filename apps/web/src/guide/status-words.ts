import { messages as sourceCopy } from "../i18n/messages/guide--status-words";
import { ADMISSION_DESK_STATES, ADMISSION_PHASES } from "@kix/protocol-adapter";
import { STATUS_MARKS } from "../a11y/marks";
import { OUTCOME_WORDS } from "../i18n/translate";
import { ROUTE_BINDINGS } from "../shell/route-registry";
import { FEATURE_STATUSES } from "../handoff/packet";

/**
 * The words a user or operator can meet on the stub screens, in the handoff packet and in the
 * evidence documents, each with a short reading. App-internal; not a public schema, operation,
 * capability or identifier. The glossary page and docs/guide/status-glossary-ko.md are built from
 * this list, and a test holds them equal, so a word added to the code without a guide entry fails.
 *
 * Where a live constant already names the set (outcome words, status marks, binding words, feature
 * statuses) the entries below are derived from it; the test compares the subsets both ways.
 */
export interface StatusWordGuideEntry {
  /** The word as it is printed. Verbatim, never translated. */
  word: string;
  kind:
    | "outcome"
    | "fixture"
    | "status-mark"
    | "transport"
    | "binding"
    | "feature"
    | "admission"
    | "facet"
    | "journey"
    | "code"
    | "policy"
    | "environment";
  /** What the word means. */
  meaning: string;
  /** What the reader may do next. */
  doText: string;
  /** A reading this word never carries. */
  dontText: string;
}

const entry = (
  word: string,
  kind: StatusWordGuideEntry["kind"],
  meaning: string,
  doText: string,
  dontText: string,
): StatusWordGuideEntry => ({ word, kind, meaning, doText, dontText });

const OUTCOME: Record<(typeof OUTCOME_WORDS)[number], Omit<StatusWordGuideEntry, "word" | "kind">> = {
  UNKNOWN: {
    meaning: sourceCopy.en["s1x4"],
    doText: sourceCopy.en["s1ck"],
    dontText: "Not a failure and not a success. Never read it as 'did not happen' — it may have applied.",
  },
  NOT_BOUND: {
    meaning: sourceCopy.en["sx3"],
    doText: sourceCopy.en["s1cs"],
    dontText: sourceCopy.en["s102"],
  },
  STALE: {
    meaning: sourceCopy.en["s22q"],
    doText: sourceCopy.en["s24n"],
    dontText: sourceCopy.en["sza"],
  },
};

const FIXTURE: Record<"SUCCESS" | "REJECT", Omit<StatusWordGuideEntry, "word" | "kind">> = {
  SUCCESS: {
    meaning: sourceCopy.en["s8l"],
    doText: sourceCopy.en["s1bs"],
    dontText: sourceCopy.en["szy"],
  },
  REJECT: {
    meaning: sourceCopy.en["s8m"],
    doText: sourceCopy.en["s1bq"],
    dontText: sourceCopy.en["s12t"],
  },
};

const TRANSPORT: Record<string, Omit<StatusWordGuideEntry, "word" | "kind">> = {
  checking: {
    meaning: sourceCopy.en["s1ub"],
    doText: sourceCopy.en["s262"],
    dontText: sourceCopy.en["szr"],
  },
  unavailable: {
    meaning: sourceCopy.en["s1u6"],
    doText: sourceCopy.en["sc5"],
    dontText: sourceCopy.en["s126"],
  },
  degraded: {
    meaning: sourceCopy.en["s1sz"],
    doText: sourceCopy.en["s1ru"],
    dontText: sourceCopy.en["szq"],
  },
  up: {
    meaning: sourceCopy.en["s1ua"],
    doText: sourceCopy.en["srl"],
    dontText: sourceCopy.en["s127"],
  },
  local: {
    meaning: sourceCopy.en["s1mz"],
    doText: sourceCopy.en["s11d"],
    dontText: sourceCopy.en["szp"],
  },
};

const BINDING: Record<(typeof ROUTE_BINDINGS)[number], Omit<StatusWordGuideEntry, "word" | "kind">> = {
  "published-bound": {
    meaning: sourceCopy.en["s21q"],
    doText: sourceCopy.en["srh"],
    dontText: sourceCopy.en["s11w"],
  },
  "not-bound": {
    meaning: sourceCopy.en["s1rp"],
    doText: sourceCopy.en["s1cr"],
    dontText: sourceCopy.en["szm"],
  },
  "stub-only": {
    meaning: sourceCopy.en["s21p"],
    doText: sourceCopy.en["s1c5"],
    dontText: sourceCopy.en["s10l"],
  },
  "no-published-command": {
    meaning: sourceCopy.en["s1r7"],
    doText: sourceCopy.en["s117"],
    dontText: sourceCopy.en["szc"],
  },
  planned: {
    meaning: sourceCopy.en["s1g9"],
    doText: sourceCopy.en["swc"],
    dontText: sourceCopy.en["s10a"],
  },
};

const FEATURE: Record<(typeof FEATURE_STATUSES)[number], Omit<StatusWordGuideEntry, "word" | "kind">> = {
  "local-command": {
    meaning: sourceCopy.en["s21n"],
    doText: sourceCopy.en["s25s"],
    dontText: sourceCopy.en["szl"],
  },
  synthetic: {
    meaning: sourceCopy.en["s1xq"],
    doText: sourceCopy.en["s1br"],
    dontText: sourceCopy.en["s124"],
  },
  unsupported: {
    meaning: sourceCopy.en["s21o"],
    doText: sourceCopy.en["s11i"],
    dontText: sourceCopy.en["s122"],
  },
};

const ADMISSION_STATE: Record<(typeof ADMISSION_DESK_STATES)[number], Omit<StatusWordGuideEntry, "word" | "kind">> = {
  valid: {
    meaning: sourceCopy.en["s1rt"],
    doText: sourceCopy.en["s1bv"],
    dontText: sourceCopy.en["s10v"],
  },
  invalid: {
    meaning: sourceCopy.en["s1rn"],
    doText: sourceCopy.en["s1cj"],
    dontText: sourceCopy.en["szv"],
  },
  stale: {
    meaning: sourceCopy.en["s1ra"],
    doText: sourceCopy.en["s1fy"],
    dontText: sourceCopy.en["s12r"],
  },
  "already-consumed": {
    meaning: sourceCopy.en["s1r9"],
    doText: sourceCopy.en["s1ch"],
    dontText: sourceCopy.en["s106"],
  },
  transferred: {
    meaning: sourceCopy.en["s8u"],
    doText: sourceCopy.en["s1cx"],
    dontText: sourceCopy.en["szb"],
  },
  cancelled: {
    meaning: sourceCopy.en["s20d"],
    doText: sourceCopy.en["s1ce"],
    dontText: sourceCopy.en["szz"],
  },
  "unavailable-server": {
    meaning: sourceCopy.en["s21d"],
    doText: sourceCopy.en["sc8"],
    dontText: sourceCopy.en["s11x"],
  },
};

const ADMISSION_PHASE: Record<(typeof ADMISSION_PHASES)[number], Omit<StatusWordGuideEntry, "word" | "kind">> = {
  ELIGIBLE: {
    meaning: "Credential FSM phase: the synthetic credential may be authorized. P03 stays 설계중.",
    doText: sourceCopy.en["s1bt"],
    dontText: sourceCopy.en["szn"],
  },
  AUTHORIZED: {
    meaning: "Credential FSM phase: the synthetic credential was authorized. P03 stays 설계중.",
    doText: sourceCopy.en["s1bt"],
    dontText: sourceCopy.en["s10u"],
  },
  CONSUMED: {
    meaning: sourceCopy.en["seu"],
    doText: sourceCopy.en["s1bt"],
    dontText: sourceCopy.en["s105"],
  },
};

const FACET_WORDS: Record<string, Omit<StatusWordGuideEntry, "word" | "kind">> = {
  MERGED_RECORDED: { meaning: sourceCopy.en["s1uj"], doText: sourceCopy.en["s1cf"], dontText: sourceCopy.en["szd"] },
  REPO_PRESENT: { meaning: sourceCopy.en["s1qy"], doText: sourceCopy.en["s1xp"], dontText: sourceCopy.en["s128"] },
  NOT_PRESENT: { meaning: sourceCopy.en["s1ug"], doText: sourceCopy.en["s11f"], dontText: sourceCopy.en["s10o"] },
  WAITING: { meaning: sourceCopy.en["s54"], doText: sourceCopy.en["s1cy"], dontText: sourceCopy.en["s12q"] },
  NOT_STARTED: { meaning: sourceCopy.en["s1ui"], doText: sourceCopy.en["s11g"], dontText: sourceCopy.en["s11v"] },
  NOT_EVALUATED: { meaning: sourceCopy.en["s23h"], doText: sourceCopy.en["s1b9"], dontText: sourceCopy.en["s10z"] },
  UNQUALIFIED: { meaning: sourceCopy.en["sxa"], doText: sourceCopy.en["s1bu"], dontText: sourceCopy.en["s110"] },
  NOT_REQUIRED: { meaning: sourceCopy.en["s230"], doText: sourceCopy.en["s1l0"], dontText: sourceCopy.en["s12w"] },
  PENDING: { meaning: sourceCopy.en["s19"], doText: sourceCopy.en["s263"], dontText: sourceCopy.en["sz7"] },
  NOT_AUTHORIZED: { meaning: sourceCopy.en["su7"], doText: sourceCopy.en["s1f7"], dontText: sourceCopy.en["s12g"] },
  RECORDED: { meaning: sourceCopy.en["ses"], doText: sourceCopy.en["slr"], dontText: sourceCopy.en["szu"] },
  NOT_REACHABLE: { meaning: sourceCopy.en["s1qi"], doText: sourceCopy.en["s1cd"], dontText: sourceCopy.en["szf"] },
  NOT_APPLICABLE: { meaning: sourceCopy.en["s1qv"], doText: sourceCopy.en["s1l0"], dontText: sourceCopy.en["s12o"] },
  UNVERIFIED: { meaning: sourceCopy.en["svi"], doText: sourceCopy.en["s24p"], dontText: sourceCopy.en["s10y"] },
};

const JOURNEY_WORDS: Record<string, Omit<StatusWordGuideEntry, "word" | "kind">> = {
  RECEIPT: { meaning: sourceCopy.en["s2n"], doText: sourceCopy.en["s1cp"], dontText: sourceCopy.en["s107"] },
  REJECTED: { meaning: sourceCopy.en["s1tu"], doText: sourceCopy.en["s1cu"], dontText: sourceCopy.en["s12u"] },
  NOT_SENT: { meaning: "The leg was never sent — not-bound, gated open, or observation only.", doText: sourceCopy.en["s1cr"], dontText: sourceCopy.en["s11y"] },
  FENCED: { meaning: sourceCopy.en["s1x3"], doText: sourceCopy.en["s1mp"], dontText: sourceCopy.en["sz6"] },
  NONE_NEEDED: { meaning: sourceCopy.en["s1r3"], doText: sourceCopy.en["s11e"], dontText: sourceCopy.en["sz8"] },
  COMPENSATION_UNDEFINED: { meaning: sourceCopy.en["s2m"], doText: sourceCopy.en["sio"], dontText: sourceCopy.en["s100"] },
};

const CODE_WORDS: Record<string, Omit<StatusWordGuideEntry, "word" | "kind">> = {
  GATE_UNAVAILABLE: { meaning: sourceCopy.en["s1u5"], doText: sourceCopy.en["sc6"], dontText: sourceCopy.en["szh"] },
  STALE_RESPONSE: { meaning: sourceCopy.en["s1t3"], doText: sourceCopy.en["s24q"], dontText: sourceCopy.en["szi"] },
  REQUEST_TIMEOUT: { meaning: sourceCopy.en["s1uo"], doText: sourceCopy.en["s16h"], dontText: sourceCopy.en["s12h"] },
  GATE_TRANSPORT: { meaning: sourceCopy.en["s22o"], doText: sourceCopy.en["s1cb"], dontText: sourceCopy.en["sz5"] },
  GATE_STATUS: { meaning: sourceCopy.en["s1t0"], doText: sourceCopy.en["s1cg"], dontText: sourceCopy.en["szt"] },
  GATE_REJECTED: { meaning: sourceCopy.en["s1t2"], doText: sourceCopy.en["s1cv"], dontText: sourceCopy.en["s12s"] },
  SCREEN_LOAD_FAILED: { meaning: sourceCopy.en["s1qz"], doText: sourceCopy.en["s25t"], dontText: sourceCopy.en["s12v"] },
  SESSION_EVIDENCE_LOST: { meaning: sourceCopy.en["s1xy"], doText: sourceCopy.en["s1m1"], dontText: sourceCopy.en["szs"] },
  ADMISSION_REQUIRED: { meaning: sourceCopy.en["s1pz"], doText: sourceCopy.en["slq"], dontText: sourceCopy.en["s101"] },
  STALE_ISSUE: { meaning: sourceCopy.en["s1td"], doText: sourceCopy.en["srn"], dontText: sourceCopy.en["sz9"] },
  GRANT_REVOKED: { meaning: sourceCopy.en["s60"], doText: sourceCopy.en["s1fz"], dontText: sourceCopy.en["szo"] },
};

const POLICY_WORDS: Record<string, Omit<StatusWordGuideEntry, "word" | "kind">> = {
  UNDETERMINED: { meaning: sourceCopy.en["s9b"], doText: sourceCopy.en["s24o"], dontText: sourceCopy.en["s12x"] },
  PENDING_USER_DECISION: { meaning: sourceCopy.en["s1wz"], doText: sourceCopy.en["s11c"], dontText: sourceCopy.en["s12j"] },
  STUB_RUN_RECORDED: { meaning: sourceCopy.en["s7r"], doText: sourceCopy.en["s1cq"], dontText: sourceCopy.en["szj"] },
  STUB_CANDIDATE_RECORDED: { meaning: sourceCopy.en["s6r"], doText: sourceCopy.en["s1cq"], dontText: sourceCopy.en["s103"] },
  MOCK_SETTLEMENT_ONLY: { meaning: sourceCopy.en["s1y2"], doText: sourceCopy.en["s1b7"], dontText: sourceCopy.en["sxi"] },
  MOCK_GATE_ONLY: { meaning: sourceCopy.en["s1sv"], doText: sourceCopy.en["s1b7"], dontText: sourceCopy.en["szk"] },
  MOCK_CREDIT_F04_ONLY: { meaning: sourceCopy.en["s1rc"], doText: sourceCopy.en["s1b7"], dontText: sourceCopy.en["sv0"] },
};

const ENVIRONMENT_WORDS: Record<string, Omit<StatusWordGuideEntry, "word" | "kind">> = {
  stub: { meaning: sourceCopy.en["s1rg"], doText: sourceCopy.en["s1rh"], dontText: sourceCopy.en["szg"] },
  "integration-http": { meaning: sourceCopy.en["s1uq"], doText: sourceCopy.en["s1mf"], dontText: sourceCopy.en["s125"] },
};

/** Facet cells from the evidence matrix documents (node, qualification, acceptance, release, coverage). */

export const STATUS_WORD_GUIDE: readonly StatusWordGuideEntry[] = [
  ...OUTCOME_WORDS.map((word) => entry(word, "outcome", OUTCOME[word].meaning, OUTCOME[word].doText, OUTCOME[word].dontText)),
  entry("SUCCESS", "fixture", FIXTURE.SUCCESS.meaning, FIXTURE.SUCCESS.doText, FIXTURE.SUCCESS.dontText),
  entry("REJECT", "fixture", FIXTURE.REJECT.meaning, FIXTURE.REJECT.doText, FIXTURE.REJECT.dontText),
  ...(Object.keys(STATUS_MARKS) as (keyof typeof STATUS_MARKS)[]).map((kind) =>
    entry(STATUS_MARKS[kind].word, "status-mark", STATUS_MARKS[kind].meaning, sourceCopy.en["s1cz"], sourceCopy.en["szx"]),
  ),
  ...Object.entries(TRANSPORT).map(([word, cell]) => entry(word, "transport", cell.meaning, cell.doText, cell.dontText)),
  ...ROUTE_BINDINGS.map((word) => entry(word, "binding", BINDING[word].meaning, BINDING[word].doText, BINDING[word].dontText)),
  ...FEATURE_STATUSES.map((word) => entry(word, "feature", FEATURE[word].meaning, FEATURE[word].doText, FEATURE[word].dontText)),
  ...ADMISSION_DESK_STATES.map((word) => entry(word, "admission", ADMISSION_STATE[word].meaning, ADMISSION_STATE[word].doText, ADMISSION_STATE[word].dontText)),
  ...ADMISSION_PHASES.map((word) => entry(word, "admission", ADMISSION_PHASE[word].meaning, ADMISSION_PHASE[word].doText, ADMISSION_PHASE[word].dontText)),
  ...Object.entries(FACET_WORDS).map(([word, cell]) => entry(word, "facet", cell.meaning, cell.doText, cell.dontText)),
  ...Object.entries(JOURNEY_WORDS).map(([word, cell]) => entry(word, "journey", cell.meaning, cell.doText, cell.dontText)),
  ...Object.entries(CODE_WORDS).map(([word, cell]) => entry(word, "code", cell.meaning, cell.doText, cell.dontText)),
  ...Object.entries(POLICY_WORDS).map(([word, cell]) => entry(word, "policy", cell.meaning, cell.doText, cell.dontText)),
  ...Object.entries(ENVIRONMENT_WORDS).map(([word, cell]) => entry(word, "environment", cell.meaning, cell.doText, cell.dontText)),
];

export const GUIDE_KIND_LABELS: Record<StatusWordGuideEntry["kind"], string> = {
  outcome: sourceCopy.en["s16k"],
  fixture: sourceCopy.en["slk"],
  "status-mark": sourceCopy.en["s1mk"],
  transport: sourceCopy.en["s24m"],
  binding: sourceCopy.en["sa3"],
  feature: sourceCopy.en["skw"],
  admission: sourceCopy.en["s1o"],
  facet: sourceCopy.en["sjw"],
  journey: sourceCopy.en["spi"],
  code: sourceCopy.en["sgk"],
  policy: sourceCopy.en["s18m"],
  environment: sourceCopy.en["sin"],
};
