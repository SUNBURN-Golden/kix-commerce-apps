import { COMMERCE_COMMAND_BINDINGS } from "./commerce-bindings.js";
import {
  DISCOVERY_PROJECTION_AS_OF,
  DISCOVERY_READ_TUPLE_LITERALS,
  checkDiscoveryReadTuple,
  type DiscoveryReadTuple,
} from "./discovery-read.js";
import { type PinnedAction } from "./openapi-contract-pin.js";
import { PLATFORM_NOT_COMPOSED, type PlatformNotComposed } from "./platform-journey.js";
import { isRecord } from "./record.js";

/**
 * Synthetic delegation-assistant source for the /assistant screen.
 *
 * This is the stub-scope stand-in for the producer read and write contract of
 * pending node c-delegated-assistant. The real connection stays pending on
 * kix-protocol:ai-delegation-execution-decision, kix-protocol:k-authority-qualification,
 * and the unpromoted delegation-surface node. The contract-only catalogue publishes
 * no command or read for a delegation grant, an assistant proposal, or an assistant
 * command, so no producer SDK, manifest, or vector is consumed and this module sends
 * nothing over a network.
 *
 * The interpreter is deterministic. It stands in for an LLM the same way the source
 * stands in for the producer: it maps a request onto at most a structured proposal.
 * A sentence is never authority. A proposal is not an approval. An approval is not a
 * result: it lets the page send one synthetic command, once, under a grant whose
 * adopted mode already allows it. Nothing here infers a new grant, adopts an
 * execution delegation, moves funds, or transfers a right. Every payload states the
 * seven non-claims as the literal false or it is refused whole.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const DELEGATION_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const DELEGATION_NOT_BOUND_REASON =
  "No current producer tuple exists for the delegation assistant: kix-protocol:ai-delegation-execution-decision and kix-protocol:k-authority-qualification are not merged, and the delegation-surface node is not promoted. The contract-only catalogue has no command or read for a delegation grant, an assistant proposal, or an assistant command. The delegation assistant stays NOT_BOUND on integration-http.";

export const DELEGATION_PROJECTION_NAME = "kix.delegation.assistant";

/** Fixed instant the synthetic source claims to be built at. Deadlines compare against it. */
export const DELEGATION_AS_OF = DISCOVERY_PROJECTION_AS_OF;

/** Watermark the stale scenario serves, and the floor a reader holds against it. */
export const DELEGATION_STALE_WATERMARK = "2026-10-10T00:00:00.000Z";
export const DELEGATION_STALE_FLOOR = "2026-10-12T00:00:00.000Z";

/** The desk's own actor string. It is a context label, not an authentication result. */
export const DELEGATION_DESK_ACTOR = "delegate-desk";

/** The one principal the desk actor holds synthetic grants from. */
export const DELEGATION_OWN_PRINCIPAL = "pal-0001";

/** A principal the desk actor holds no grant from. */
export const DELEGATION_FOREIGN_PRINCIPAL = "pal-0002";

/** What the source states where a policy is not published. The page prints it and decides nothing. */
export const DELEGATION_UNDETERMINED = "UNDETERMINED";

/** The grant's deadline is opaque instant text. The source compares it; the client copies it. */
export const DELEGATION_GRANT_NOT_AFTER = "2026-12-31T00:00:00.000Z";

/** An instant before DELEGATION_AS_OF, used when a grant is staged or simulated expired. */
export const DELEGATION_PAST_INSTANT = "2026-10-01T00:00:00.000Z";

/**
 * The grant's authority ceiling, ordered. `query` reads only, `propose` also records
 * proposals, `command` also lets an approved proposal become one synthetic command.
 * The source never reports an adopted mode above the requested mode, and nothing on
 * the page raises it.
 */
export const DELEGATION_MODES = ["query", "propose", "command"] as const;

export type DelegationMode = (typeof DELEGATION_MODES)[number];

const MODE_ORDER: Readonly<Record<DelegationMode, number>> = { query: 0, propose: 1, command: 2 };

/** The two synthetic commands. Neither is a desk method and neither is a catalogue command. */
export const DELEGATION_COMMANDS = ["draft-order", "cancel-draft"] as const;

export type DelegationCommand = (typeof DELEGATION_COMMANDS)[number];

export const DELEGATION_GRANT_STATES = ["active", "revoked"] as const;

export type DelegationGrantState = (typeof DELEGATION_GRANT_STATES)[number];

/** The only scope family this fixture knows. A draft order stages an order; it is not a hold. */
export const DELEGATION_SCOPES = ["orders"] as const;

export type DelegationScope = (typeof DELEGATION_SCOPES)[number];

export const DELEGATION_LISTING_STATES = ["open", "closed"] as const;

export type DelegationListingState = (typeof DELEGATION_LISTING_STATES)[number];

export const DELEGATION_DRAFT_STATES = ["staged", "cancelled"] as const;

export type DelegationDraftState = (typeof DELEGATION_DRAFT_STATES)[number];

/** Opaque labels. No amount, fee, or rank arithmetic is attached to a tier. */
export const DELEGATION_TIERS = ["value", "standard", "premium"] as const;

export type DelegationTier = (typeof DELEGATION_TIERS)[number];

export const DELEGATION_SCENARIOS = [
  "clean",
  "empty",
  "stale",
  "denied",
  "expired",
  "budget-spent",
  "closed-listing",
  "draft-lost",
  "cancel-lost",
  "held-response",
  "receipt-claims-execution",
  "snapshot-claims-authority",
  "scope-leak",
  "race-superseded",
] as const;

export type DelegationScenario = (typeof DELEGATION_SCENARIOS)[number];

export const DELEGATION_REJECT_CODES = [
  "GRANT_STALE",
  "GRANT_EXPIRED",
  "MODE_CAPPED",
  "ACTION_NOT_GRANTED",
  "TARGET_OUTSIDE_SCOPE",
  "BUDGET_EXHAUSTED",
  "LISTING_NOT_OPEN",
  "DRAFT_NOT_OPEN",
  "DUPLICATE_DRAFT",
  "UNKNOWN_REF",
] as const;

export type DelegationRejectCode = (typeof DELEGATION_REJECT_CODES)[number];

/** The one return action the page offers for a rejection. There is no other. */
export type DelegationReturnAction = "read-again" | "revise-request" | "none";

export const DELEGATION_RETURN_ACTIONS: Readonly<Record<DelegationRejectCode, DelegationReturnAction>> = {
  GRANT_STALE: "read-again",
  GRANT_EXPIRED: "none",
  MODE_CAPPED: "none",
  ACTION_NOT_GRANTED: "revise-request",
  TARGET_OUTSIDE_SCOPE: "revise-request",
  BUDGET_EXHAUSTED: "none",
  LISTING_NOT_OPEN: "read-again",
  DRAFT_NOT_OPEN: "read-again",
  DUPLICATE_DRAFT: "read-again",
  UNKNOWN_REF: "read-again",
};

export const DELEGATION_INVALID_CODES = ["INTENT", "STEP", "IDENTITY", "VERSION"] as const;

export type DelegationInvalidCode = (typeof DELEGATION_INVALID_CODES)[number];

export const DELEGATION_DENIED_CODES = ["SCOPE_DENIED", "GRANT_REVOKED"] as const;

export type DelegationDeniedCode = (typeof DELEGATION_DENIED_CODES)[number];

export const DELEGATION_REFUSAL_CODES = ["CLAIM", "SCOPE_LEAK", "REF", "KIND", "STATE", "COUNT"] as const;

export type DelegationRefusalCode = (typeof DELEGATION_REFUSAL_CODES)[number];

/**
 * Seven statements every payload makes and none may break. A payload that omits one,
 * or states it as anything but the literal false, is refused whole before a row shows.
 */
export const DELEGATION_NON_CLAIM_FIELDS = [
  "assistantTextIsAuthority",
  "proposalIsApproval",
  "approvalIsResult",
  "fundsMoved",
  "rightsTransferred",
  "executionDelegationBound",
  "grantInferredFromText",
] as const;

export type DelegationNonClaimField = (typeof DELEGATION_NON_CLAIM_FIELDS)[number];

export type DelegationNonClaims = Readonly<Record<DelegationNonClaimField, false>>;

/**
 * Events a real producer would cause. None of them raises a mode: no control adopts
 * an execution delegation, because that contract is not merged.
 */
export const DELEGATION_SYNTHETIC_CONTROLS = [
  "revoke-grant",
  "supersede-grant",
  "expire-grant",
  "spend-budget",
  "close-listing",
] as const;

export type DelegationSyntheticControl = (typeof DELEGATION_SYNTHETIC_CONTROLS)[number];

/** Quote of the locked hold binding. H1 keeps this consideredAction and keeps it not-bound. */
export const DELEGATION_HOLD_NOT_BOUND = {
  method: "placeHold",
  status: COMMERCE_COMMAND_BINDINGS.placeHold.status,
  consideredAction: COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction,
  reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
  mappedOntoPrepareTrade: false,
} as const;

export interface DelegationNotComposed {
  action: PlatformNotComposed["action"] | "delegate" | "close_delegation";
  reason: string;
}

/**
 * Catalogue commands this module records and does not send. The platform list is
 * reused as is — capture and settle_capture are never composed, and the booking,
 * admission, and refund commands keep their own reasons — and the two delegation
 * commands are added with their own reasons: the catalogue names them and this
 * page sends neither, because no execution delegation is adopted here and an
 * assistant command is a synthetic write, not a catalogue command.
 */
export const DELEGATION_NOT_COMPOSED: readonly DelegationNotComposed[] = [
  ...PLATFORM_NOT_COMPOSED,
  {
    action: "delegate",
    reason: `${DELEGATION_RULING}. delegate is pinned and never sent from this page. No execution delegation is adopted or created here: a grant is the source's own record, and assistant text is never authority for one.`,
  },
  {
    action: "close_delegation",
    reason: `${DELEGATION_RULING}. close_delegation is pinned and never sent from this page. A revocation is a source event the page observes on a read, not a command this page posts.`,
  },
];

// ---------------------------------------------------------------------------
// Contract register: which delegation concept has a named field in the pin
// ---------------------------------------------------------------------------

export interface DelegationContractRow {
  id: string;
  /** Field name on this module's snapshot. */
  delegationField: string;
  status: "field-named" | "not-bound";
  /**
   * Published body fields that play the same role. A test reads the vendored pin and
   * checks every entry. Empty for a not-bound row. No body is built from this list.
   */
  bodyFields: readonly { action: PinnedAction; field: string }[];
  reason: string;
}

const NO_DELEGATION_CONTRACT =
  "The contract-only catalogue publishes no field for it, and neither kix-protocol:ai-delegation-execution-decision nor kix-protocol:k-authority-qualification is merged. The value here is a synthetic observation.";

/**
 * Every delegation concept stays not-bound: the pinned catalogue names none of them.
 * Naming a field is not binding it. A row with no field is not-bound and the screen
 * invents none.
 */
export const DELEGATION_CONTRACT_REGISTER: readonly DelegationContractRow[] = [
  {
    id: "grant-scope",
    delegationField: "grants[].scope",
    status: "not-bound",
    bodyFields: [],
    reason: `No delegation scope field is published. ${NO_DELEGATION_CONTRACT}`,
  },
  {
    id: "grant-deadline",
    delegationField: "grants[].notAfter",
    status: "not-bound",
    bodyFields: [],
    reason: `No delegation deadline field is published. The instant text is the source's own and the page copies it. ${NO_DELEGATION_CONTRACT}`,
  },
  {
    id: "grant-target",
    delegationField: "grants[].targetEventRef",
    status: "not-bound",
    bodyFields: [],
    reason: `No delegation target family field is published. ${NO_DELEGATION_CONTRACT}`,
  },
  {
    id: "grant-budget",
    delegationField: "grants[].commandBudget",
    status: "not-bound",
    bodyFields: [],
    reason: `No delegation budget field is published. The budget is a count of commands, carries no amount, and is the source's own figure. ${NO_DELEGATION_CONTRACT}`,
  },
  {
    id: "grant-actions",
    delegationField: "grants[].allowedActions",
    status: "not-bound",
    bodyFields: [],
    reason: `No allowed-action field is published. ${NO_DELEGATION_CONTRACT}`,
  },
  {
    id: "grant-mode",
    delegationField: "grants[].adoptedMode",
    status: "not-bound",
    bodyFields: [],
    reason: `No delegation mode field is published. The adopted mode is the source's own ceiling; the page never raises it. ${NO_DELEGATION_CONTRACT}`,
  },
  {
    id: "proposal",
    delegationField: "proposals[]",
    status: "not-bound",
    bodyFields: [],
    reason: `No proposal command or read is published. A proposal is a record of the page, not a protocol object. ${NO_DELEGATION_CONTRACT}`,
  },
  {
    id: "assistant-command",
    delegationField: "drafts[]",
    status: "not-bound",
    bodyFields: [],
    reason: `No assistant command is published. draft-order and cancel-draft are synthetic writes of the page, not catalogue commands. ${NO_DELEGATION_CONTRACT}`,
  },
];

// ---------------------------------------------------------------------------
// Identity. Each kind has its own prefix and one kind is never read as another.
// ---------------------------------------------------------------------------

export const DELEGATION_REF_KINDS = ["grant", "listing", "draft", "principal"] as const;

export type DelegationRefKind = (typeof DELEGATION_REF_KINDS)[number];

const REF_PREFIX: Readonly<Record<DelegationRefKind, string>> = {
  grant: "grt-",
  listing: "lst-",
  draft: "drf-",
  principal: "pal-",
};

const REF_PATTERN = /^(grt|lst|drf|pal)-[0-9]{4}$/;

export function delegationRef(kind: DelegationRefKind, serial: number): string {
  return `${REF_PREFIX[kind]}${String(serial).padStart(4, "0")}`;
}

export function delegationRefKind(ref: string): DelegationRefKind | null {
  if (!REF_PATTERN.test(ref)) {
    return null;
  }
  for (const kind of DELEGATION_REF_KINDS) {
    if (ref.startsWith(REF_PREFIX[kind])) {
      return kind;
    }
  }
  return null;
}

export function isDelegationRef(ref: unknown, kind: DelegationRefKind): ref is string {
  return typeof ref === "string" && delegationRefKind(ref) === kind;
}

// ---------------------------------------------------------------------------
// The interpreter: request text to one turn. Never authority.
// ---------------------------------------------------------------------------

/** What a request asks the page to look at. A query reads the last snapshot. It sends nothing. */
export const DELEGATION_QUESTIONS = ["grants", "board", "drafts", "session"] as const;

export type DelegationQuestion = (typeof DELEGATION_QUESTIONS)[number];

/** What an ambiguous request is missing. The interpreter infers nothing to fill it. */
export const DELEGATION_MISSING = ["action", "target"] as const;

export type DelegationMissing = (typeof DELEGATION_MISSING)[number];

export const DELEGATION_REQUEST_REFUSALS = ["EMPTY", "INJECTION_FLAGGED", "OUT_OF_SCOPE"] as const;

export type DelegationRequestRefusal = (typeof DELEGATION_REQUEST_REFUSALS)[number];

/**
 * One turn of the assistant. `answer` reads the last snapshot, `proposal` is a
 * structured candidate command the page records, `clarify` asks for the missing
 * piece, and `refused` explains why the request is not carried. No turn is an
 * approval, and no turn sends anything.
 */
export type DelegationTurn =
  | { kind: "answer"; question: DelegationQuestion; detail: string }
  | { kind: "proposal"; step: DelegationCommand; targetRef: string; detail: string }
  | { kind: "clarify"; missing: readonly DelegationMissing[]; detail: string }
  | { kind: "refused"; code: DelegationRequestRefusal; detail: string };

/**
 * Instruction-like markers. A request that contains one is refused as a whole:
 * prompt text never overrides the grant, never approves a proposal, and never sends
 * a command. Approval is a separate control on the proposal card, not a sentence.
 */
export const DELEGATION_INJECTION_MARKERS = [
  "ignore",
  "disregard",
  "forget",
  "override",
  "bypass",
  "system prompt",
  "you are now",
  "as admin",
  "admin mode",
  "developer mode",
  "new instructions",
  "reveal",
  "approve",
  "confirm",
  "send it",
  "send now",
  "send the",
  "execute",
  "submit",
  "immediately",
  "no approval",
  "without asking",
  "auto-approve",
  "automatically",
  "skip the",
  "grant me",
  "all authority",
  "unlimited",
  "jailbreak",
  "do not ask",
  "pretend",
  "act as",
  "the user said",
  "mark it",
  "mark as",
] as const;

/**
 * Action words outside the two synthetic commands. The assistant never infers one:
 * a request that names one is refused, not re-read as a supported command.
 */
export const DELEGATION_FORBIDDEN_VERBS = [
  "pay",
  "payment",
  "refund",
  "capture",
  "settle",
  "settlement",
  "transfer",
  "admit",
  "disburse",
  "charge",
  "invoice",
  "purchase",
  "buy",
  "sell",
  "withdraw",
  "deposit",
  "book",
  "booking",
] as const;

const REQUEST_REF = /\b(?:grt|lst|drf|pal)-[0-9]{4}\b/g;
const DRAFT_VERB = /\b(?:draft|stage|prepare)\b/;
const CANCEL_VERB = /\bcancel\b/;
const GRANT_QUESTION = /\b(?:grant|grants|delegat\w*|scope|budget|authority)\b/;
const DRAFT_QUESTION = /\b(?:drafts|staged|applications?)\b/;
const SESSION_QUESTION = /\b(?:session|intents?|sent|quarantine|counter|counters|turns?)\b/;
const BOARD_QUESTION = /\b(?:listing|listings|board|open|available|what|show|which|status|tell)\b/;

function questionOf(lower: string): DelegationQuestion | null {
  if (GRANT_QUESTION.test(lower)) {
    return "grants";
  }
  if (DRAFT_QUESTION.test(lower)) {
    return "drafts";
  }
  if (SESSION_QUESTION.test(lower)) {
    return "session";
  }
  if (BOARD_QUESTION.test(lower)) {
    return "board";
  }
  return null;
}

function clarify(missing: readonly DelegationMissing[], detail: string): DelegationTurn {
  return { kind: "clarify", missing, detail };
}

/**
 * Maps request text onto one turn. Deterministic and conservative: a command
 * proposal needs exactly one action word and exactly one target of the right kind.
 * Everything else asks or refuses. The turn is data, not authority: only the
 * approve control on a recorded proposal can lead to a send, and only under a
 * grant whose own fields allow it.
 */
export function interpretDelegationRequest(text: string): DelegationTurn {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { kind: "refused", code: "EMPTY", detail: "The request is empty. Nothing was read, proposed, or sent." };
  }
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const marker = DELEGATION_INJECTION_MARKERS.find((item) => lower.includes(item));
  if (marker !== undefined) {
    return {
      kind: "refused",
      code: "INJECTION_FLAGGED",
      detail: `The request contains "${marker}". Instruction-like text in a request is never authority: it changes no grant, approves no proposal, and sends no command.`,
    };
  }
  const forbidden = DELEGATION_FORBIDDEN_VERBS.find((verb) => new RegExp(`\\b${verb}\\b`).test(lower));
  if (forbidden !== undefined) {
    return {
      kind: "refused",
      code: "OUT_OF_SCOPE",
      detail: `The request names "${forbidden}", which is not one of the two delegated commands (draft-order, cancel-draft). The assistant infers no other action, and a staged draft is not a payment, a booking, a transfer, or a refund.`,
    };
  }
  const refs = trimmed.match(REQUEST_REF) ?? [];
  const draftVerb = DRAFT_VERB.test(lower);
  const cancelVerb = CANCEL_VERB.test(lower);
  if (draftVerb && cancelVerb) {
    const drafts = refs.filter((ref) => delegationRefKind(ref) === "draft");
    // "cancel draft drf-0001" reads "draft" as the noun the cancel names, not as a
    // second action; anything else that carries both words is ambiguous.
    if (refs.length === 1 && drafts.length === 1) {
      return {
        kind: "proposal",
        step: "cancel-draft",
        targetRef: drafts[0],
        detail: `Proposal: cancel draft ${drafts[0]}. A proposal is not an approval; only the approve control on this proposal sends the synthetic command, once, under the grant that covers it.`,
      };
    }
    return clarify(["action"], "The request carries two different actions. The assistant picks neither: name one of draft-order or cancel-draft.");
  }
  if (draftVerb) {
    const listings = refs.filter((ref) => delegationRefKind(ref) === "listing");
    if (refs.length === 1 && listings.length === 1) {
      return {
        kind: "proposal",
        step: "draft-order",
        targetRef: listings[0],
        detail: `Proposal: stage one draft order for listing ${listings[0]}. A proposal is not an approval; only the approve control on this proposal sends the synthetic command, once, under the grant that covers it.`,
      };
    }
    if (refs.length === 0) {
      return clarify(["target"], "The request asks to draft an order but names no listing reference.");
    }
    return clarify(["target"], "The request names more than one reference or a reference that is not a listing. The assistant chooses none of them.");
  }
  if (cancelVerb) {
    const drafts = refs.filter((ref) => delegationRefKind(ref) === "draft");
    if (refs.length === 1 && drafts.length === 1) {
      return {
        kind: "proposal",
        step: "cancel-draft",
        targetRef: drafts[0],
        detail: `Proposal: cancel draft ${drafts[0]}. A proposal is not an approval; only the approve control on this proposal sends the synthetic command, once, under the grant that covers it.`,
      };
    }
    if (refs.length === 0) {
      return clarify(["target"], "The request asks to cancel but names no draft reference.");
    }
    return clarify(["target"], "A cancel names a draft reference, not a listing or a grant. The assistant chooses none of them.");
  }
  if (refs.length > 0) {
    return clarify(["action"], `The request names ${refs.join(", ")} but no action. The assistant infers none.`);
  }
  const question = questionOf(lower);
  if (question !== null) {
    return { kind: "answer", question, detail: "A read of the last snapshot. A query sends nothing and changes nothing." };
  }
  return clarify(
    ["action", "target"],
    "The request is not a question the page can answer and names no action and target the assistant can propose. The assistant infers no authority from a goal it cannot read.",
  );
}

// ---------------------------------------------------------------------------
// Snapshot and outcome shapes
// ---------------------------------------------------------------------------

/** A grant is the source's own record. The page copies its fields and decides none of them. */
export interface DelegationGrant {
  grantRef: string;
  principalRef: string;
  /** The work family the grant covers. This fixture knows only `orders`. */
  scope: DelegationScope;
  /** The target family: only listings under this event are in scope. */
  targetEventRef: string;
  /** The deadline as the source's own instant text. The page copies it; the source compares it. */
  notAfter: string;
  /** The synthetic commands this grant allows. */
  allowedActions: readonly DelegationCommand[];
  /** A count of commands, not an amount. The source moves it; the client copies it. */
  commandBudget: number;
  commandsUsed: number;
  /** What the principal asked for, and the ceiling actually in force. Never inverted. */
  requestedMode: DelegationMode;
  adoptedMode: DelegationMode;
  /** Moved by the source on a revoke or a supersede. A label the client copies, never raises. */
  version: number;
  state: DelegationGrantState;
}

export interface DelegationListing {
  listingRef: string;
  eventRef: string;
  title: string;
  /** An opaque label. No amount is attached. */
  tier: DelegationTier;
  state: DelegationListingState;
}

/** A staged order draft. It is not a hold, a booking, a payment, or a right. */
export interface DelegationDraft {
  draftRef: string;
  listingRef: string;
  principalRef: string;
  grantRef: string;
  /** The grant version the draft was staged under. Copied, never raised. */
  grantVersion: number;
  state: DelegationDraftState;
}

export interface DelegationSnapshot {
  /** Read serial on this port. It orders reads and is not a commit position. */
  snapshotId: number;
  /** Advances on every effect at the source. A label, not a version the client may raise. */
  generation: number;
  watermark: string;
  scenario: DelegationScenario;
  principalRef: string;
  grants: readonly DelegationGrant[];
  listings: readonly DelegationListing[];
  drafts: readonly DelegationDraft[];
  nonClaims: DelegationNonClaims;
}

export interface DelegationReceipt {
  step: DelegationCommand;
  draftRef: string;
  listingRef: string;
  grantRef: string;
  grantVersion: number;
  state: DelegationDraftState;
  nonClaims: DelegationNonClaims;
}

export interface DelegationReadRequest {
  contextKey: string;
  actorRef: string;
  principalRef: string;
  watermarkFloor: string | null;
}

interface DelegationWriteBase {
  contextKey: string;
  actorRef: string;
  principalRef: string;
  /** The grant the command runs under. Resolved by the controller, never by the request text. */
  grantRef: string;
  /** The caller's intent. The source does not de-duplicate on it. */
  intentRef: string;
}

export type DelegationWriteRequest =
  | (DelegationWriteBase & {
      step: "draft-order";
      listingRef: string;
      expectedGrantVersion: number;
    })
  | (DelegationWriteBase & {
      step: "cancel-draft";
      draftRef: string;
      expectedGrantVersion: number;
    });

export type DelegationTupleChanged = { kind: "tuple-changed"; field: string; expected: string; actual: string };

export type DelegationDenied = { kind: "denied"; code: DelegationDeniedCode; principalRef: string; detail: string };

export type DelegationRefused = {
  kind: "refused";
  code: DelegationRefusalCode;
  field: string;
  ref: string | null;
  detail: string;
};

export type DelegationReadOutcome =
  | { kind: "ready"; snapshot: DelegationSnapshot }
  | { kind: "empty"; watermark: string; generation: number; snapshotId: number }
  | { kind: "stale"; watermark: string; floor: string }
  | DelegationTupleChanged
  | DelegationDenied
  | DelegationRefused
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export type DelegationWriteOutcome =
  | { kind: "confirmed"; step: DelegationCommand; intentRef: string; contextKey: string; receipt: DelegationReceipt }
  | {
      kind: "rejected";
      step: DelegationCommand;
      intentRef: string;
      contextKey: string;
      code: DelegationRejectCode;
      detail: string;
    }
  | { kind: "unknown"; step: DelegationCommand; intentRef: string; contextKey: string; message: string }
  | {
      kind: "invalid-request";
      step: string;
      intentRef: string;
      contextKey: string;
      code: DelegationInvalidCode;
      detail: string;
    }
  | (DelegationTupleChanged & { step: string; intentRef: string; contextKey: string })
  | (DelegationDenied & { step: string; intentRef: string; contextKey: string })
  | (DelegationRefused & { step: string; intentRef: string; contextKey: string })
  | { kind: "not-bound"; reason: string };

export type DelegationSimulation =
  | { kind: "done"; control: DelegationSyntheticControl; detail: string }
  | { kind: "ignored"; control: string; reason: string };

export interface DelegationSimulationRequest {
  control: DelegationSyntheticControl;
  grantRef?: string;
  listingRef?: string;
}

export interface DelegationAssistantPort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic-delegation" | "none";
  readonly scenario: DelegationScenario;
  read(request: DelegationReadRequest): Promise<DelegationReadOutcome>;
  submit(request: DelegationWriteRequest): Promise<DelegationWriteOutcome>;
  /** Synthetic control: an event a real producer would cause. A real producer offers no such call. */
  simulate(request: DelegationSimulationRequest): DelegationSimulation;
  /** Synthetic control: releases responses the held-response scenario is holding. Returns how many. */
  deliverHeld(): number;
}

export interface StubDelegationAssistantOptions {
  scenario?: DelegationScenario;
  /** Expected tuple override. Used to stage a producer change in tests. */
  expectedTuple?: DiscoveryReadTuple;
}

export interface DelegationEffectCounts {
  /** submit calls that reached the source, whatever they returned. */
  submits: number;
  drafts: number;
  cancels: number;
  simulations: number;
}

export function createStubDelegationAssistant(options: StubDelegationAssistantOptions = {}): StubDelegationAssistant {
  return new StubDelegationAssistant(options);
}

export function createNotBoundDelegationAssistant(): DelegationAssistantPort {
  const outcome = { kind: "not-bound", reason: DELEGATION_NOT_BOUND_REASON } as const;
  return {
    environment: "integration-http",
    source: "none",
    scenario: "clean",
    read() {
      return Promise.resolve({ ...outcome });
    },
    submit() {
      return Promise.resolve({ ...outcome });
    },
    simulate(request) {
      return { kind: "ignored", control: request.control, reason: "not-bound" };
    },
    deliverHeld() {
      return 0;
    },
  };
}

export function delegationPortFor(
  environment: "stub" | "integration-http",
  options: StubDelegationAssistantOptions = {},
): DelegationAssistantPort {
  if (environment === "stub") {
    return createStubDelegationAssistant(options);
  }
  return createNotBoundDelegationAssistant();
}

// ---------------------------------------------------------------------------
// Validation at the port boundary
// ---------------------------------------------------------------------------

function includes(list: readonly string[], value: unknown): boolean {
  return typeof value === "string" && list.includes(value);
}

/** The first non-claim field that is missing or is not the literal false, or null. */
export function findDelegationClaim(nonClaims: unknown): DelegationNonClaimField | null {
  if (!isRecord(nonClaims)) {
    return DELEGATION_NON_CLAIM_FIELDS[0];
  }
  for (const field of DELEGATION_NON_CLAIM_FIELDS) {
    if (nonClaims[field] !== false) {
      return field;
    }
  }
  return null;
}

function refuse(code: DelegationRefusalCode, field: string, ref: string | null, detail: string): DelegationRefused {
  return { kind: "refused", code, field, ref, detail };
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function refuseGrant(grant: DelegationGrant, requestedPrincipal: string): DelegationRefused | null {
  if (!isDelegationRef(grant.grantRef, "grant")) {
    return refuse("REF", "grants[].grantRef", String(grant.grantRef), "A grant is named by a grant reference.");
  }
  if (grant.principalRef !== requestedPrincipal) {
    return refuse("SCOPE_LEAK", "grants[].principalRef", grant.grantRef, `Grant ${grant.grantRef} belongs to another principal.`);
  }
  if (!includes(DELEGATION_SCOPES, grant.scope) || !includes(DELEGATION_GRANT_STATES, grant.state)) {
    return refuse("KIND", "grants[]", grant.grantRef, "A grant scope or state is not a known value.");
  }
  if (!includes(DELEGATION_MODES, grant.requestedMode) || !includes(DELEGATION_MODES, grant.adoptedMode)) {
    return refuse("KIND", "grants[].mode", grant.grantRef, "A grant mode is not a known value.");
  }
  if (MODE_ORDER[grant.adoptedMode] > MODE_ORDER[grant.requestedMode]) {
    return refuse(
      "STATE",
      "grants[].adoptedMode",
      grant.grantRef,
      "An adopted mode above the requested mode is refused. A source may not report authority the principal did not ask for.",
    );
  }
  if (typeof grant.notAfter !== "string" || grant.notAfter.trim().length === 0 || Number.isNaN(Date.parse(grant.notAfter))) {
    return refuse("STATE", "grants[].notAfter", grant.grantRef, "A grant deadline is the source's own instant text.");
  }
  if (typeof grant.targetEventRef !== "string" || !/^evt-[0-9]{4}$/.test(grant.targetEventRef)) {
    return refuse("REF", "grants[].targetEventRef", grant.grantRef, "A grant target family is an event reference.");
  }
  if (!isCount(grant.commandBudget) || !isCount(grant.commandsUsed) || grant.commandsUsed > grant.commandBudget) {
    return refuse("COUNT", "grants[].commandBudget", grant.grantRef, "A command budget is a whole count the source keeps in order.");
  }
  if (!isCount(grant.version)) {
    return refuse("COUNT", "grants[].version", grant.grantRef, "A grant version is a whole number.");
  }
  if (!Array.isArray(grant.allowedActions) || grant.allowedActions.some((action) => !includes(DELEGATION_COMMANDS, action))) {
    return refuse("KIND", "grants[].allowedActions", grant.grantRef, "An allowed action is one of the two delegated commands.");
  }
  return null;
}

/**
 * Refuses a snapshot whole when any row breaks a rule. Nothing is returned partially:
 * a refused payload shows no row. The checks are shape and claim checks only. They
 * decide nothing about scope, budget, or mode.
 */
export function refuseDelegationSnapshot(snapshot: DelegationSnapshot, requestedPrincipal: string): DelegationRefused | null {
  const claim = findDelegationClaim(snapshot.nonClaims);
  if (claim !== null) {
    return refuse("CLAIM", `nonClaims.${claim}`, null, `The payload does not state ${claim} as false. The whole payload is refused.`);
  }
  if (snapshot.principalRef !== requestedPrincipal) {
    return refuse("SCOPE_LEAK", "principalRef", snapshot.principalRef, `The payload names a principal other than ${requestedPrincipal}.`);
  }
  const grantRefs = new Set<string>();
  for (const grant of snapshot.grants) {
    const refused = refuseGrant(grant, requestedPrincipal);
    if (refused !== null) {
      return refused;
    }
    grantRefs.add(grant.grantRef);
  }
  for (const listing of snapshot.listings) {
    if (!isDelegationRef(listing.listingRef, "listing")) {
      return refuse("REF", "listings[].listingRef", String(listing.listingRef), "A listing is named by a listing reference.");
    }
    if (!/^evt-[0-9]{4}$/.test(listing.eventRef)) {
      return refuse("REF", "listings[].eventRef", listing.listingRef, "A listing names its event by an event reference.");
    }
    if (!includes(DELEGATION_LISTING_STATES, listing.state) || !includes(DELEGATION_TIERS, listing.tier)) {
      return refuse("STATE", "listings[]", listing.listingRef, "A listing state or tier is not a known value.");
    }
  }
  for (const draft of snapshot.drafts) {
    if (!isDelegationRef(draft.draftRef, "draft")) {
      return refuse("REF", "drafts[].draftRef", String(draft.draftRef), "A draft is named by a draft reference.");
    }
    if (draft.principalRef !== requestedPrincipal) {
      return refuse("SCOPE_LEAK", "drafts[].principalRef", draft.draftRef, `Draft ${draft.draftRef} belongs to another principal.`);
    }
    if (!includes(DELEGATION_DRAFT_STATES, draft.state)) {
      return refuse("STATE", "drafts[].state", draft.draftRef, "A draft state is not a known value.");
    }
    if (!grantRefs.has(draft.grantRef)) {
      return refuse("REF", "drafts[].grantRef", draft.draftRef, "A draft names a grant the payload does not list.");
    }
    if (!isCount(draft.grantVersion)) {
      return refuse("COUNT", "drafts[].grantVersion", draft.draftRef, "A grant version is a whole number.");
    }
  }
  return null;
}

/** Refuses a receipt that claims authority, funds, or a right, or names another call. */
export function refuseDelegationReceipt(receipt: DelegationReceipt, request: DelegationWriteRequest): DelegationRefused | null {
  const claim = findDelegationClaim(receipt.nonClaims);
  if (claim !== null) {
    return refuse("CLAIM", `nonClaims.${claim}`, receipt.draftRef, `The answer does not state ${claim} as false, so it is not trusted.`);
  }
  if (receipt.step !== request.step) {
    return refuse("KIND", "step", receipt.draftRef, "The answer is for a different step than the one sent.");
  }
  if (receipt.state !== (request.step === "draft-order" ? "staged" : "cancelled")) {
    return refuse("STATE", "state", receipt.draftRef, "The answer names a state that does not belong to the step that was sent.");
  }
  if (!isDelegationRef(receipt.draftRef, "draft")) {
    return refuse("REF", "draftRef", String(receipt.draftRef), "A draft is named by a draft reference.");
  }
  if (request.step === "draft-order" && receipt.listingRef !== request.listingRef) {
    return refuse("REF", "listingRef", receipt.draftRef, "The answer names a different listing than the one sent.");
  }
  if (request.step === "cancel-draft" && receipt.draftRef !== request.draftRef) {
    return refuse("REF", "draftRef", receipt.draftRef, "The answer names a different draft than the one sent.");
  }
  if (receipt.grantRef !== request.grantRef || receipt.grantVersion !== request.expectedGrantVersion) {
    return refuse("REF", "grantRef", receipt.draftRef, "The answer names a different grant or version than the one sent.");
  }
  return null;
}

// ---------------------------------------------------------------------------
// The synthetic source
// ---------------------------------------------------------------------------

interface GrantRecord {
  grantRef: string;
  principalRef: string;
  scope: DelegationScope;
  targetEventRef: string;
  notAfter: string;
  allowedActions: readonly DelegationCommand[];
  commandBudget: number;
  commandsUsed: number;
  requestedMode: DelegationMode;
  adoptedMode: DelegationMode;
  version: number;
  state: DelegationGrantState;
}

interface DraftRecord {
  draftRef: string;
  listingRef: string;
  principalRef: string;
  grantRef: string;
  grantVersion: number;
  state: DelegationDraftState;
}

const SEED_GRANTS: readonly GrantRecord[] = [
  {
    grantRef: "grt-0001",
    principalRef: DELEGATION_OWN_PRINCIPAL,
    scope: "orders",
    targetEventRef: "evt-0001",
    notAfter: DELEGATION_GRANT_NOT_AFTER,
    allowedActions: ["draft-order", "cancel-draft"],
    commandBudget: 2,
    commandsUsed: 0,
    requestedMode: "command",
    adoptedMode: "command",
    version: 4,
    state: "active",
  },
  {
    grantRef: "grt-0002",
    principalRef: DELEGATION_OWN_PRINCIPAL,
    scope: "orders",
    targetEventRef: "evt-0002",
    notAfter: DELEGATION_GRANT_NOT_AFTER,
    allowedActions: ["draft-order"],
    commandBudget: 1,
    commandsUsed: 0,
    requestedMode: "command",
    adoptedMode: "propose",
    version: 2,
    state: "active",
  },
];

const SEED_LISTINGS: readonly { listingRef: string; eventRef: string; title: string; tier: DelegationTier }[] = [
  { listingRef: "lst-0001", eventRef: "evt-0001", title: "Lantern night A", tier: "standard" },
  { listingRef: "lst-0002", eventRef: "evt-0001", title: "Lantern night B", tier: "value" },
  { listingRef: "lst-0003", eventRef: "evt-0002", title: "Harbour show", tier: "premium" },
];

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function cleanNonClaims(): DelegationNonClaims {
  return {
    assistantTextIsAuthority: false,
    proposalIsApproval: false,
    approvalIsResult: false,
    fundsMoved: false,
    rightsTransferred: false,
    executionDelegationBound: false,
    grantInferredFromText: false,
  };
}

function grantView(record: GrantRecord): DelegationGrant {
  return { ...record, allowedActions: [...record.allowedActions] };
}

/** Synthetic source. State lives in this object, so a new port is a new session. */
export class StubDelegationAssistant implements DelegationAssistantPort {
  readonly environment = "stub" as const;
  readonly source = "synthetic-delegation" as const;
  readonly scenario: DelegationScenario;
  private readonly expectedTuple: DiscoveryReadTuple;
  private readonly grants = new Map<string, GrantRecord>();
  private readonly listings = new Map<string, { listingRef: string; eventRef: string; title: string; tier: DelegationTier; state: DelegationListingState }>();
  private readonly drafts = new Map<string, DraftRecord>();
  private readonly held: { release: () => void }[] = [];
  private generation = 1;
  private snapshotSerial = 0;
  private draftSerial = 1;
  private raceDone = false;
  private revoked = false;
  private readonly counts: DelegationEffectCounts = { submits: 0, drafts: 0, cancels: 0, simulations: 0 };

  constructor(options: StubDelegationAssistantOptions) {
    this.scenario = options.scenario ?? "clean";
    this.expectedTuple = options.expectedTuple ?? DISCOVERY_READ_TUPLE_LITERALS;
    this.revoked = this.scenario === "denied";
    if (this.scenario !== "empty") {
      for (const grant of SEED_GRANTS) {
        this.grants.set(grant.grantRef, { ...grant, allowedActions: [...grant.allowedActions] });
      }
      for (const listing of SEED_LISTINGS) {
        this.listings.set(listing.listingRef, { ...listing, state: "open" });
      }
    }
    this.stage();
  }

  /** Test seam. Counts of what reached the source. Not part of the port. */
  effects(): DelegationEffectCounts {
    return { ...this.counts };
  }

  private stage(): void {
    if (this.scenario === "expired") {
      const grant = this.grants.get("grt-0001");
      if (grant) {
        grant.notAfter = DELEGATION_PAST_INSTANT;
      }
    } else if (this.scenario === "budget-spent") {
      const grant = this.grants.get("grt-0001");
      if (grant) {
        grant.commandsUsed = grant.commandBudget;
      }
    } else if (this.scenario === "closed-listing") {
      const listing = this.listings.get("lst-0001");
      if (listing) {
        listing.state = "closed";
      }
    }
  }

  read(request: DelegationReadRequest): Promise<DelegationReadOutcome> {
    return Promise.resolve(this.readNow(request));
  }

  deliverHeld(): number {
    const releasing = this.held.splice(0, this.held.length);
    for (const entry of releasing) {
      entry.release();
    }
    return releasing.length;
  }

  submit(request: DelegationWriteRequest): Promise<DelegationWriteOutcome> {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return Promise.resolve({
        kind: "tuple-changed",
        field: tuple.field,
        expected: tuple.expected,
        actual: tuple.actual,
        step: String(request.step),
        intentRef: request.intentRef,
        contextKey: request.contextKey,
      });
    }
    const invalid = this.validate(request);
    if (invalid !== null) {
      return Promise.resolve(invalid);
    }
    const denied = this.gate(request.actorRef, request.principalRef);
    if (denied !== null) {
      return Promise.resolve({
        ...denied,
        step: request.step,
        intentRef: request.intentRef,
        contextKey: request.contextKey,
      });
    }
    this.counts.submits += 1;
    const outcome = this.apply(request);
    if (this.scenario === "held-response") {
      return new Promise<DelegationWriteOutcome>((resolve) => {
        this.held.push({ release: () => resolve(outcome) });
      });
    }
    return Promise.resolve(outcome);
  }

  simulate(request: DelegationSimulationRequest): DelegationSimulation {
    const done = (detail: string): DelegationSimulation => {
      this.counts.simulations += 1;
      this.generation += 1;
      return { kind: "done", control: request.control, detail };
    };
    const ignored = (reason: string): DelegationSimulation => ({ kind: "ignored", control: request.control, reason });
    const grant = request.grantRef === undefined ? undefined : this.grants.get(request.grantRef);
    switch (request.control) {
      case "revoke-grant": {
        if (!grant) {
          return ignored("The grant is not at the source.");
        }
        if (grant.state === "revoked") {
          return ignored(`Grant ${grant.grantRef} is already revoked.`);
        }
        grant.state = "revoked";
        grant.version += 1;
        return done(`Grant ${grant.grantRef} was revoked at the source at version ${grant.version}. No command under it is accepted, and nothing already sent is undone.`);
      }
      case "supersede-grant": {
        if (!grant) {
          return ignored("The grant is not at the source.");
        }
        if (grant.state !== "active") {
          return ignored(`Grant ${grant.grantRef} is ${grant.state}.`);
        }
        grant.version += 1;
        return done(`Grant ${grant.grantRef} moved to version ${grant.version} at the source. A command built on the older version is stale.`);
      }
      case "expire-grant": {
        if (!grant) {
          return ignored("The grant is not at the source.");
        }
        if (Date.parse(grant.notAfter) <= Date.parse(DELEGATION_AS_OF)) {
          return ignored(`Grant ${grant.grantRef} is already past its deadline.`);
        }
        grant.notAfter = DELEGATION_PAST_INSTANT;
        return done(`Grant ${grant.grantRef} passed its deadline at the source. A command under it is rejected as expired.`);
      }
      case "spend-budget": {
        if (!grant) {
          return ignored("The grant is not at the source.");
        }
        if (grant.commandsUsed >= grant.commandBudget) {
          return ignored(`Grant ${grant.grantRef} has no command budget left.`);
        }
        grant.commandsUsed = grant.commandBudget;
        return done(`Grant ${grant.grantRef} used its command budget at the source, through another channel. A command under it is rejected as exhausted.`);
      }
      case "close-listing": {
        const listing = request.listingRef === undefined ? undefined : this.listings.get(request.listingRef);
        if (!listing) {
          return ignored("The listing is not at the source.");
        }
        if (listing.state === "closed") {
          return ignored(`Listing ${listing.listingRef} is already closed.`);
        }
        listing.state = "closed";
        return done(`Listing ${listing.listingRef} was closed at the source. A draft order on it is rejected.`);
      }
      default: {
        const exhaustive: never = request.control;
        return exhaustive;
      }
    }
  }

  private gate(actorRef: string, principalRef: string): DelegationDenied | null {
    if (this.revoked) {
      return { kind: "denied", code: "GRANT_REVOKED", principalRef, detail: "The synthetic grants for this principal were withdrawn at the source." };
    }
    if (actorRef !== DELEGATION_DESK_ACTOR || principalRef !== DELEGATION_OWN_PRINCIPAL) {
      return { kind: "denied", code: "SCOPE_DENIED", principalRef, detail: `Actor ${actorRef} holds no grant from principal ${principalRef}.` };
    }
    return null;
  }

  private readNow(request: DelegationReadRequest): DelegationReadOutcome {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return { kind: "tuple-changed", field: tuple.field, expected: tuple.expected, actual: tuple.actual };
    }
    const denied = this.gate(request.actorRef, request.principalRef);
    if (denied !== null) {
      return denied;
    }
    this.snapshotSerial += 1;
    const watermark = this.scenario === "stale" ? DELEGATION_STALE_WATERMARK : DELEGATION_AS_OF;
    const floor = request.watermarkFloor ?? (this.scenario === "stale" ? DELEGATION_STALE_FLOOR : null);
    if (floor !== null && Date.parse(watermark) < Date.parse(floor)) {
      return { kind: "stale", watermark, floor };
    }
    if (this.scenario === "empty") {
      return { kind: "empty", watermark, generation: this.generation, snapshotId: this.snapshotSerial };
    }
    const snapshot = this.buildSnapshot(watermark, request.principalRef);
    const refused = refuseDelegationSnapshot(snapshot, request.principalRef);
    if (refused !== null) {
      return refused;
    }
    return { kind: "ready", snapshot };
  }

  private buildSnapshot(watermark: string, principalRef: string): DelegationSnapshot {
    const nonClaims: Record<string, boolean> = { ...cleanNonClaims() };
    if (this.scenario === "snapshot-claims-authority") {
      nonClaims.assistantTextIsAuthority = true;
      nonClaims.executionDelegationBound = true;
    }
    const snapshot: DelegationSnapshot = {
      snapshotId: this.snapshotSerial,
      generation: this.generation,
      watermark,
      scenario: this.scenario,
      principalRef,
      grants: [...this.grants.values()].map(grantView),
      listings: [...this.listings.values()].map((listing) => ({ ...listing })),
      drafts: [...this.drafts.values()].map((draft) => ({ ...draft })),
      nonClaims: nonClaims as unknown as DelegationNonClaims,
    };
    if (this.scenario === "scope-leak") {
      return {
        ...snapshot,
        drafts: [
          ...snapshot.drafts,
          {
            draftRef: "drf-0099",
            listingRef: "lst-0001",
            principalRef: DELEGATION_FOREIGN_PRINCIPAL,
            grantRef: "grt-0001",
            grantVersion: 4,
            state: "staged",
          },
        ],
      };
    }
    return snapshot;
  }

  private invalid(
    request: { step: unknown; intentRef: unknown; contextKey: unknown },
    code: DelegationInvalidCode,
    detail: string,
  ): DelegationWriteOutcome {
    return {
      kind: "invalid-request",
      step: String(request.step),
      intentRef: String(request.intentRef),
      contextKey: String(request.contextKey),
      code,
      detail,
    };
  }

  private validate(request: DelegationWriteRequest): DelegationWriteOutcome | null {
    if (!nonEmpty(request.intentRef) || !nonEmpty(request.contextKey)) {
      return this.invalid(request, "INTENT", "A write carries an intent reference and a context key.");
    }
    if (!includes(DELEGATION_COMMANDS, request.step)) {
      return this.invalid(request, "STEP", `Step ${String(request.step)} is not a delegated command.`);
    }
    if (!isDelegationRef(request.principalRef, "principal") || !isDelegationRef(request.grantRef, "grant")) {
      return this.invalid(request, "IDENTITY", "A write names its principal and its grant by their own reference kinds.");
    }
    if (!Number.isInteger(request.expectedGrantVersion)) {
      return this.invalid(request, "VERSION", "The expected grant version is a whole number.");
    }
    if (request.step === "draft-order") {
      if (!isDelegationRef(request.listingRef, "listing")) {
        return this.invalid(request, "IDENTITY", "A draft order names a listing reference, not a draft or a grant.");
      }
    } else if (!isDelegationRef(request.draftRef, "draft")) {
      return this.invalid(request, "IDENTITY", "A cancel names a draft reference, not a listing or a grant.");
    }
    return null;
  }

  private rejected(request: DelegationWriteRequest, code: DelegationRejectCode, detail: string): DelegationWriteOutcome {
    return {
      kind: "rejected",
      step: request.step,
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      code,
      detail,
    };
  }

  private lost(request: DelegationWriteRequest, message: string): DelegationWriteOutcome {
    return {
      kind: "unknown",
      step: request.step,
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      message,
    };
  }

  /** Answers with the receipt, or with a refusal when the answer breaks a rule. */
  private answer(request: DelegationWriteRequest, receipt: DelegationReceipt): DelegationWriteOutcome {
    const refused = refuseDelegationReceipt(receipt, request);
    if (refused !== null) {
      return {
        ...refused,
        step: request.step,
        intentRef: request.intentRef,
        contextKey: request.contextKey,
      };
    }
    return {
      kind: "confirmed",
      step: request.step,
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      receipt,
    };
  }

  private grantDenied(request: DelegationWriteRequest, detail: string): DelegationWriteOutcome {
    return {
      kind: "denied",
      code: "GRANT_REVOKED",
      principalRef: request.principalRef,
      detail,
      step: request.step,
      intentRef: request.intentRef,
      contextKey: request.contextKey,
    };
  }

  /**
   * The grant gate. Every check reads the grant the source holds now — never the
   * request text and never an inferred grant — and stops at the first reason.
   */
  private underGrant(request: DelegationWriteRequest, grant: GrantRecord): DelegationWriteOutcome | null {
    if (grant.state !== "active") {
      return this.grantDenied(request, `Grant ${grant.grantRef} was revoked at the source at version ${grant.version}. The request was denied, not recorded.`);
    }
    if (request.expectedGrantVersion !== grant.version) {
      return this.rejected(request, "GRANT_STALE", `Grant ${grant.grantRef} is no longer at version ${request.expectedGrantVersion}. The grant the command was built on is stale.`);
    }
    if (Date.parse(grant.notAfter) <= Date.parse(DELEGATION_AS_OF)) {
      return this.rejected(request, "GRANT_EXPIRED", `Grant ${grant.grantRef} passed its deadline ${grant.notAfter}.`);
    }
    if (grant.adoptedMode !== "command") {
      return this.rejected(
        request,
        "MODE_CAPPED",
        `Grant ${grant.grantRef} was requested at mode ${grant.requestedMode} and adopted at ${grant.adoptedMode}. An unadopted execution delegation stays in query/propose mode: the command is not sent.`,
      );
    }
    if (!grant.allowedActions.includes(request.step)) {
      return this.rejected(request, "ACTION_NOT_GRANTED", `Grant ${grant.grantRef} does not allow ${request.step}.`);
    }
    if (grant.commandsUsed >= grant.commandBudget) {
      return this.rejected(request, "BUDGET_EXHAUSTED", `Grant ${grant.grantRef} used its command budget of ${grant.commandBudget}.`);
    }
    return null;
  }

  private apply(request: DelegationWriteRequest): DelegationWriteOutcome {
    const grant = this.grants.get(request.grantRef);
    if (!grant) {
      return this.rejected(request, "UNKNOWN_REF", `Grant ${request.grantRef} is not at the source. No grant is inferred.`);
    }
    if (this.scenario === "race-superseded" && !this.raceDone) {
      this.raceDone = true;
      grant.version += 1;
    }
    const gateOutcome = this.underGrant(request, grant);
    if (gateOutcome !== null) {
      return gateOutcome;
    }
    return request.step === "draft-order" ? this.draftOrder(request, grant) : this.cancelDraft(request, grant);
  }

  private draftOrder(request: Extract<DelegationWriteRequest, { step: "draft-order" }>, grant: GrantRecord): DelegationWriteOutcome {
    const listing = this.listings.get(request.listingRef);
    if (!listing) {
      return this.rejected(request, "UNKNOWN_REF", `Listing ${request.listingRef} is not at the source.`);
    }
    if (listing.eventRef !== grant.targetEventRef) {
      return this.rejected(
        request,
        "TARGET_OUTSIDE_SCOPE",
        `Listing ${listing.listingRef} belongs to ${listing.eventRef}, outside grant ${grant.grantRef} which covers ${grant.targetEventRef}.`,
      );
    }
    if (listing.state !== "open") {
      return this.rejected(request, "LISTING_NOT_OPEN", `Listing ${listing.listingRef} is ${listing.state} at the source.`);
    }
    const live = [...this.drafts.values()].find((draft) => draft.listingRef === listing.listingRef && draft.state === "staged");
    if (live) {
      return this.rejected(request, "DUPLICATE_DRAFT", `Listing ${listing.listingRef} already has staged draft ${live.draftRef}.`);
    }
    const draftRef = delegationRef("draft", this.draftSerial);
    this.draftSerial += 1;
    const record: DraftRecord = {
      draftRef,
      listingRef: listing.listingRef,
      principalRef: grant.principalRef,
      grantRef: grant.grantRef,
      grantVersion: grant.version,
      state: "staged",
    };
    this.drafts.set(draftRef, record);
    grant.commandsUsed += 1;
    this.generation += 1;
    this.counts.drafts += 1;
    if (this.scenario === "draft-lost") {
      return this.lost(request, "The answer to the draft order never arrived. The source may have staged it.");
    }
    const receipt: DelegationReceipt = {
      step: "draft-order",
      draftRef,
      listingRef: listing.listingRef,
      grantRef: grant.grantRef,
      grantVersion: grant.version,
      state: "staged",
      nonClaims: cleanNonClaims(),
    };
    if (this.scenario === "receipt-claims-execution") {
      (receipt.nonClaims as Record<string, boolean>).fundsMoved = true;
    }
    return this.answer(request, receipt);
  }

  private cancelDraft(request: Extract<DelegationWriteRequest, { step: "cancel-draft" }>, grant: GrantRecord): DelegationWriteOutcome {
    const draft = this.drafts.get(request.draftRef);
    if (!draft) {
      return this.rejected(request, "UNKNOWN_REF", `Draft ${request.draftRef} is not at the source.`);
    }
    if (draft.grantRef !== grant.grantRef || draft.principalRef !== grant.principalRef) {
      return this.rejected(request, "TARGET_OUTSIDE_SCOPE", `Draft ${draft.draftRef} does not belong to grant ${grant.grantRef}.`);
    }
    if (draft.state !== "staged") {
      return this.rejected(request, "DRAFT_NOT_OPEN", `Draft ${draft.draftRef} is ${draft.state} at the source.`);
    }
    draft.state = "cancelled";
    grant.commandsUsed += 1;
    this.generation += 1;
    this.counts.cancels += 1;
    if (this.scenario === "cancel-lost") {
      return this.lost(request, "The answer to the cancel never arrived. The source may have cancelled the draft.");
    }
    return this.answer(request, {
      step: "cancel-draft",
      draftRef: draft.draftRef,
      listingRef: draft.listingRef,
      grantRef: grant.grantRef,
      grantVersion: grant.version,
      state: "cancelled",
      nonClaims: cleanNonClaims(),
    });
  }
}
