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
    meaning: "The request was sent (or may have been sent) but its result was never read back. The answer is not known.",
    doText: "Read the fence or the receipt page before acting again. Treat the request as possibly applied.",
    dontText: "Not a failure and not a success. Never read it as 'did not happen' — it may have applied.",
  },
  NOT_BOUND: {
    meaning: "No published command exists for this action, so nothing was composed and nothing was sent.",
    doText: "Read the recorded reason. This is a wiring fact, not an outcome.",
    dontText: "Not a rejection and not a pending result. Nothing is waiting to be retried.",
  },
  STALE: {
    meaning: "The value on screen is older than the source it came from and is kept separate from a fresh value.",
    doText: "Treat it as history. Look for a newer value before deciding anything.",
    dontText: "Not a current value and not an error. It is not proof the thing is gone.",
  },
};

const FIXTURE: Record<"SUCCESS" | "REJECT", Omit<StatusWordGuideEntry, "word" | "kind">> = {
  SUCCESS: {
    meaning: "A synthetic fixture whose scripted outcome is a normal reply. It is canned evidence, not a live result.",
    doText: "Read it as a demonstration of the screen's handling of a normal reply.",
    dontText: "Not a real payment, booking or integration result. Nothing was bought or reserved.",
  },
  REJECT: {
    meaning: "A synthetic fixture whose scripted outcome is a refusal that arrived as a reply.",
    doText: "Read it as a demonstrated refusal path.",
    dontText: "Not UNKNOWN. A reject is an answer; UNKNOWN is the absence of an answer.",
  },
};

const TRANSPORT: Record<string, Omit<StatusWordGuideEntry, "word" | "kind">> = {
  checking: {
    meaning: "The loopback probe result is not loaded yet.",
    doText: "Wait for the banner to settle.",
    dontText: "Not an outage and not readiness.",
  },
  unavailable: {
    meaning: "The loopback gate did not answer. The desk stays on integration HTTP; it does not fall back to the stub.",
    doText: "Check that the gate is running on its loopback address, then reload.",
    dontText: "Not production readiness, and never read as the desk switching to stub.",
  },
  degraded: {
    meaning: "The gate answered but reported a strained condition (for example NOT_READY or OVERLOADED).",
    doText: "The desk stays on integration HTTP. Read the banner code.",
    dontText: "Not an outage and not a fallback to stub.",
  },
  up: {
    meaning: "The loopback probe answered. This is loopback only.",
    doText: "Local reads may proceed on the loopback gate.",
    dontText: "Not production readiness, conformance or a public service.",
  },
  local: {
    meaning: "Stub mode: no HTTP was selected and the probe is not running.",
    doText: "Nothing to check; the synthetic adapter answers.",
    dontText: "Not an offline fault. The stub is the default, not a failure.",
  },
  offline: { meaning: "The browser reports lost connectivity; retained values are cached history.", doText: "Inspect retained values and reconnect, then explicitly read again before writing.", dontText: "Not an empty result or a determination of an interrupted write." },
  online: { meaning: "The browser is online and a current-epoch loopback probe answered.", doText: "Read the cached-data notice and the controller's own fences.", dontText: "Not production readiness, a replay, or a fresh business read." },
};

const BINDING: Record<(typeof ROUTE_BINDINGS)[number], Omit<StatusWordGuideEntry, "word" | "kind">> = {
  "published-bound": {
    meaning: "The surface's action maps onto a published command. In stub mode it is still answered synthetically.",
    doText: "Local-command only, Node loopback at most.",
    dontText: "Not integration complete, not live.",
  },
  "not-bound": {
    meaning: "The desk method is deliberately not bound to a command; its considered action is recorded, not sent.",
    doText: "Read the recorded reason.",
    dontText: "Not a missing feature and not an outcome.",
  },
  "stub-only": {
    meaning: "The surface is answered by the synthetic adapter only.",
    doText: "Read screens as demonstrations.",
    dontText: "Not connected to any producer or gate.",
  },
  "no-published-command": {
    meaning: "The contract-only catalogue publishes no command for this surface.",
    doText: "Nothing can be sent; read the catalogue note.",
    dontText: "Not a defect; nothing exists to bind.",
  },
  planned: {
    meaning: "Reserved for a binding that is written down but not wired.",
    doText: "None on this build beyond the registry word itself.",
    dontText: "Not a working path.",
  },
};

const FEATURE: Record<(typeof FEATURE_STATUSES)[number], Omit<StatusWordGuideEntry, "word" | "kind">> = {
  "local-command": {
    meaning: "The surface can post a local command on the stub or the loopback gate.",
    doText: "Usable locally, with the stub as default.",
    dontText: "Not a live integration.",
  },
  synthetic: {
    meaning: "The screen shows canned or locally derived rows. It demonstrates reading, not sending.",
    doText: "Read it as a demonstration.",
    dontText: "Not producer data.",
  },
  unsupported: {
    meaning: "The surface has a screen but no command and no synthetic path for the step.",
    doText: "Nothing to try.",
    dontText: "Not pending work on this build.",
  },
};

const ADMISSION_STATE: Record<(typeof ADMISSION_DESK_STATES)[number], Omit<StatusWordGuideEntry, "word" | "kind">> = {
  valid: {
    meaning: "The desk's freshest read of a synthetic credential came back fresh with no decision code.",
    doText: "Read it as the stub's label for a clean credential read.",
    dontText: "Not entry granted, not a venue scan result, and not a promise about the next read.",
  },
  invalid: {
    meaning: "The desk label when no more specific label applies: the read did not come back fresh-and-clean.",
    doText: "Read the decision code beside it for the reason.",
    dontText: "Not a permanent refusal and not a venue verdict.",
  },
  stale: {
    meaning: "The credential read is older than the source it came from.",
    doText: "Re-read before deciding anything.",
    dontText: "Not the outcome word STALE; this word labels one credential read.",
  },
  "already-consumed": {
    meaning: "The credential is recorded as already consumed once.",
    doText: "Read the consumption record.",
    dontText: "Not a second entry and not a duplicate-scan finding.",
  },
  transferred: {
    meaning: "A transfer of the right was observed.",
    doText: "Read the transfer record.",
    dontText: "Not a decision about who may enter.",
  },
  cancelled: {
    meaning: "The source reported the ticket cancelled.",
    doText: "Read the cancellation note.",
    dontText: "Not a refund and not an admission denial.",
  },
  "unavailable-server": {
    meaning: "The source that answers credential reads could not be reached.",
    doText: "Check the source, then re-read.",
    dontText: "Not 'invalid'; the answer was never heard.",
  },
};

const ADMISSION_PHASE: Record<(typeof ADMISSION_PHASES)[number], Omit<StatusWordGuideEntry, "word" | "kind">> = {
  ELIGIBLE: {
    meaning: "Credential FSM phase: the synthetic credential may be authorized. P03 stays 설계중.",
    doText: "Read it as a phase label only.",
    dontText: "Not an entry decision and not venue admission.",
  },
  AUTHORIZED: {
    meaning: "Credential FSM phase: the synthetic credential was authorized. P03 stays 설계중.",
    doText: "Read it as a phase label only.",
    dontText: "Not entry granted and not a venue scan result.",
  },
  CONSUMED: {
    meaning: "Credential FSM phase: the synthetic credential was consumed once.",
    doText: "Read it as a phase label only.",
    dontText: "Not a scan event and not a settlement.",
  },
};

const FACET_WORDS: Record<string, Omit<StatusWordGuideEntry, "word" | "kind">> = {
  MERGED_RECORDED: { meaning: "The node's merge is recorded in the node table.", doText: "Read the cited PR.", dontText: "Not a done judgement; central DONE is NOT_EVALUATED here." },
  REPO_PRESENT: { meaning: "The code exists in this repository.", doText: "The screen can be opened.", dontText: "Not qualified, accepted or released." },
  NOT_PRESENT: { meaning: "The named thing does not exist in this repository.", doText: "Nothing to open.", dontText: "Not deleted; it was never here." },
  WAITING: { meaning: "A pending node names an external prerequisite it waits on.", doText: "Read the Waits-on column.", dontText: "Not started and not counted." },
  NOT_STARTED: { meaning: "The node exists in a catalogue but has no merged work recorded.", doText: "Nothing to read yet.", dontText: "Not in progress." },
  NOT_EVALUATED: { meaning: "This repository does not evaluate the central done flag.", doText: "Read each facet on its own.", dontText: "Not failed and not passed." },
  UNQUALIFIED: { meaning: "No qualification run exists or is claimed.", doText: "Read it as the standing state.", dontText: "Not failed; no run happened." },
  NOT_REQUIRED: { meaning: "This facet does not apply to the row (for example acceptance on a row with no page).", doText: "Skip it.", dontText: "Not waived; it never applied." },
  PENDING: { meaning: "A decision belongs to the user and has not been taken.", doText: "Wait for the named decider.", dontText: "Not accepted and not rejected." },
  NOT_AUTHORIZED: { meaning: "No authority exists for release, so nothing may ship.", doText: "Release needs its own authority.", dontText: "Not refused; it was never open." },
  RECORDED: { meaning: "Coverage evidence exists and is cited.", doText: "Follow the pointer.", dontText: "Not a pass of a live system." },
  NOT_REACHABLE: { meaning: "The branch cannot be produced by the sources this build has.", doText: "Read the branch note.", dontText: "Not a failure; unreachable is a fact." },
  NOT_APPLICABLE: { meaning: "The check does not apply here.", doText: "Skip it.", dontText: "Not skipped out of convenience." },
  UNVERIFIED: { meaning: "No fixture or run covers this cell yet.", doText: "Treat the cell as open work.", dontText: "Not failed and not covered." },
};

const JOURNEY_WORDS: Record<string, Omit<StatusWordGuideEntry, "word" | "kind">> = {
  RECEIPT: { meaning: "A leg landed and a receipt was recorded.", doText: "Read the receipt.", dontText: "Not a settlement and not a payment." },
  REJECTED: { meaning: "The leg was answered with a refusal.", doText: "Read the refusal code.", dontText: "Not UNKNOWN; it is an answer." },
  NOT_SENT: { meaning: "The leg was never sent — not-bound, gated open, or observation only.", doText: "Read the recorded reason.", dontText: "Not lost; it never left." },
  FENCED: { meaning: "The request may have applied and later writes are held.", doText: "Stop and read the fence before anything new.", dontText: "Not a cancel and not a confirm." },
  NONE_NEEDED: { meaning: "The compensation cell: nothing was applied, so nothing needs undoing.", doText: "Nothing to do.", dontText: "Not a completed compensation." },
  COMPENSATION_UNDEFINED: { meaning: "A leg landed and a later one did not, and no compensation path is approved.", doText: "Escalate; do not improvise a compensation.", dontText: "Not a refund and not automatic." },
};

const CODE_WORDS: Record<string, Omit<StatusWordGuideEntry, "word" | "kind">> = {
  CONNECTIVITY_BLOCKED: { meaning: "The app refused a new write before dispatch because connectivity or its read is unavailable.", doText: "Restore connectivity and explicitly read again. Nothing is queued.", dontText: "Not UNKNOWN; an already dispatched interruption stays UNKNOWN separately." },
  GATE_UNAVAILABLE: { meaning: "The loopback gate could not be reached.", doText: "Check the gate, then reload.", dontText: "Not a fallback to stub." },
  STALE_RESPONSE: { meaning: "The gate's reply was older than the request expected.", doText: "Treat the value as STALE.", dontText: "Not a fresh answer." },
  REQUEST_TIMEOUT: { meaning: "The one attempt ran out of time.", doText: "Outcome is UNKNOWN until a fence or receipt says otherwise.", dontText: "Not retried; there is no retry." },
  GATE_TRANSPORT: { meaning: "The transport between desk and loopback gate failed.", doText: "Read the banner and the gate log.", dontText: "Not a business refusal." },
  GATE_STATUS: { meaning: "The gate answered with a status the desk treats as blocked.", doText: "Read the code beside it.", dontText: "Not an outcome word." },
  GATE_REJECTED: { meaning: "The gate refused the request.", doText: "Read the refusal reason.", dontText: "Not UNKNOWN." },
  SCREEN_LOAD_FAILED: { meaning: "The code for a screen could not be loaded or started. A load fault, not an outcome.", doText: "Use 'Load this screen again' or reload.", dontText: "Not UNKNOWN; nothing was sent." },
  SESSION_EVIDENCE_LOST: { meaning: "The session journal is corrupt, unsupported or lost; every write is held.", doText: "Start a fresh intent; nothing is re-sent.", dontText: "Not an outcome of a request." },
  ADMISSION_REQUIRED: { meaning: "The admission path needs a credential step first.", doText: "Follow the named step.", dontText: "Not a refusal." },
  STALE_ISSUE: { meaning: "The issue being read is older than the current source.", doText: "Look for a newer record.", dontText: "Not a current fact." },
  GRANT_REVOKED: { meaning: "A previously recorded grant is no longer valid.", doText: "Re-read the permission state.", dontText: "Not a new denial." },
};

const POLICY_WORDS: Record<string, Omit<StatusWordGuideEntry, "word" | "kind">> = {
  UNDETERMINED: { meaning: "A value this repository deliberately does not decide (for example a retention period or a target standard).", doText: "Treat it as open; the named decider owns it.", dontText: "Not zero, not infinite, not decided." },
  PENDING_USER_DECISION: { meaning: "The release packet waits on a decision only a user can take.", doText: "Nothing proceeds until the user rules.", dontText: "Not scheduled, not approved." },
  STUB_RUN_RECORDED: { meaning: "A run of the stub was recorded as evidence.", doText: "Read the record.", dontText: "Not a live-environment run." },
  STUB_CANDIDATE_RECORDED: { meaning: "A release candidate was recorded in stub scope.", doText: "Read the record.", dontText: "Not a release." },
  MOCK_SETTLEMENT_ONLY: { meaning: "The settlement figures on this screen are mock units only.", doText: "Read as a demonstration.", dontText: "No real money, no settlement math." },
  MOCK_GATE_ONLY: { meaning: "The flow shown exists only against the mock gate.", doText: "Read as a demonstration.", dontText: "Not a live gate path." },
  MOCK_CREDIT_F04_ONLY: { meaning: "The credit rows are mock data only.", doText: "Read as a demonstration.", dontText: "No credit is issued." },
};

const ENVIRONMENT_WORDS: Record<string, Omit<StatusWordGuideEntry, "word" | "kind">> = {
  stub: { meaning: "The default environment. The synthetic adapter answers; nothing leaves the machine.", doText: "The default; nothing to enable.", dontText: "Not a fallback mode and not offline." },
  "integration-http": { meaning: "The opt-in environment that talks to the loopback gate only.", doText: "Start the gate from its own checkout first.", dontText: "Not production and never a public endpoint." },
};

/** Facet cells from the evidence matrix documents (node, qualification, acceptance, release, coverage). */

export const STATUS_WORD_GUIDE: readonly StatusWordGuideEntry[] = [
  ...OUTCOME_WORDS.map((word) => entry(word, "outcome", OUTCOME[word].meaning, OUTCOME[word].doText, OUTCOME[word].dontText)),
  entry("SUCCESS", "fixture", FIXTURE.SUCCESS.meaning, FIXTURE.SUCCESS.doText, FIXTURE.SUCCESS.dontText),
  entry("REJECT", "fixture", FIXTURE.REJECT.meaning, FIXTURE.REJECT.doText, FIXTURE.REJECT.dontText),
  ...(Object.keys(STATUS_MARKS) as (keyof typeof STATUS_MARKS)[]).map((kind) =>
    entry(STATUS_MARKS[kind].word, "status-mark", STATUS_MARKS[kind].meaning, "Read the word; it carries the meaning, not the colour.", "Not a promise about any request's outcome."),
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
  outcome: "Outcome words",
  fixture: "Fixture classes",
  "status-mark": "Status marks",
  transport: "Transport banner states",
  binding: "Binding words",
  feature: "Feature statuses",
  admission: "Admission credential words",
  facet: "Evidence facet cells",
  journey: "Journey leg and compensation words",
  code: "Diagnosis and fault codes",
  policy: "Policy and provenance words",
  environment: "Environments",
};
