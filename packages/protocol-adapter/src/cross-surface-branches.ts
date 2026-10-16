import {
  CROSS_SURFACE_BRANCHES,
  CROSS_SURFACE_JOURNEYS,
  CROSS_SURFACE_LEG_OUTCOMES,
  blockedNextOf,
  compensationFor,
  judgeLegs,
  lastConfirmedOf,
  rowIdFor,
  unconfirmedOf,
  type CrossSurfaceBlockedNext,
  type CrossSurfaceBranch,
  type CrossSurfaceCompensationState,
  type CrossSurfaceJourney,
  type CrossSurfaceLeg,
  type CrossSurfaceLegOutcome,
  type CrossSurfaceReuse,
  type CrossSurfaceRow,
} from "./cross-surface-journeys.js";
import { CreditServicingController } from "./credit-servicing-controller.js";
import { SERVICING_APPROVER_ACTOR, createStubCreditServicing, type ServicingScenario } from "./credit-servicing.js";
import { DelegationAssistantController } from "./delegated-assistant-controller.js";
import {
  DELEGATION_DESK_ACTOR,
  DELEGATION_OWN_PRINCIPAL,
  createStubDelegationAssistant,
  type DelegationScenario,
} from "./delegated-assistant.js";
import { MarketingJourneyController, projectMarketing } from "./marketing-journey-controller.js";
import {
  MARKETING_DESK_ACTOR,
  MARKETING_OWN_SUBJECT,
  createStubMarketingJourney,
  type MarketingScenario,
} from "./marketing-journey.js";
import { createStubQualificationRunner } from "./operational-qualification.js";
import { ProviderJourneyController } from "./provider-controller.js";
import { PROVIDER_DESK_ACTOR, createStubProviderJourney, type ProviderScenario } from "./provider-journey.js";
import { PlatformJourneyController } from "./platform-controller.js";
import { PLATFORM_DESK_ACTOR, createStubPlatformJourney, type PlatformScenario } from "./platform-journey.js";
import { isRecord } from "./record.js";
import { RefundReturnController } from "./refund-return-controller.js";
import { REFUND_RETURN_DESK_ACTOR, createStubRefundReturn, type RefundScenario } from "./refund-return.js";

/**
 * Composer for the cross-surface table. Each executed row drives a sibling
 * controller over its own synthetic stub, in this process, with the steps the
 * sibling's own tests use. A next step is shown through the controller's
 * gateFor, which answers without sending; this module never sends a step the
 * journey has not reached, and never an opposite command.
 *
 * Nothing here talks to a network, mints a reference of its own, or reads a
 * clock. Every reference is a fixed label that the sibling stub also uses.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

const OBSERVATION_ONLY = "This table sends nothing for this leg.";

function leg(label: string, outcome: CrossSurfaceLegOutcome, code: string | null = null, note = ""): CrossSurfaceLeg {
  return { label, outcome, code, note };
}

function readLeg(readState: string, source: string): CrossSurfaceLeg {
  return leg("read", readState === "ready" ? "OBSERVED" : "UNKNOWN", readState, `The ${source} answered with read state ${readState}.`);
}

function textOf(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** One sibling write result as a leg. The kinds are the siblings' own. */
function stepLeg(label: string, result: unknown, note: string): CrossSurfaceLeg {
  const record = isRecord(result) ? result : {};
  const kind = textOf(record.kind) ?? "NOT_SENT";
  const intent = isRecord(record.intent) ? record.intent : isRecord(record.record) ? record.record : null;
  const fence = isRecord(record.fence) ? record.fence : null;
  switch (kind) {
    case "CONFIRMED":
    case "APPLIED":
      return leg(label, "CONFIRMED", null, note);
    case "REJECTED":
      return leg(label, "REJECTED", textOf(intent?.code) ?? "REJECTED", note);
    case "UNKNOWN":
    case "QUARANTINED":
      return leg(label, "UNKNOWN", textOf(intent?.code) ?? kind, note);
    case "FENCED":
      return leg(label, "FENCED", textOf(fence?.reason) ?? "fenced", note);
    default:
      return leg(label, "NOT_SENT", textOf(record.reason) ?? kind, note);
  }
}

/** A next step shown through the gate. The gate answers without sending. */
function gateLeg(label: string, fence: { reason: string } | null, note: string): CrossSurfaceLeg {
  if (fence !== null) {
    return leg(label, "FENCED", fence.reason, note);
  }
  return leg(label, "NOT_SENT", "gate-open", `${note} ${OBSERVATION_ONLY}`);
}

interface RowParts {
  journey: CrossSurfaceJourney;
  branch: CrossSurfaceBranch;
  source: string;
  terminal: string;
  legs: readonly CrossSurfaceLeg[];
  note: string;
}

function executedRow(parts: RowParts): CrossSurfaceRow {
  const status = judgeLegs(parts.legs, parts.terminal);
  return {
    id: rowIdFor(parts.journey, parts.branch),
    journey: parts.journey,
    branch: parts.branch,
    basis: "executed",
    source: parts.source,
    reuse: null,
    terminal: parts.terminal,
    legs: parts.legs,
    status,
    lastConfirmed: lastConfirmedOf(parts.legs),
    unconfirmed: unconfirmedOf(parts.legs),
    blockedNext: blockedNextOf(parts.legs),
    compensation: compensationFor(status),
    note: parts.note,
  };
}

interface DeclaredColumns {
  lastConfirmed: string;
  unconfirmed: readonly string[];
  blockedNext: readonly CrossSurfaceBlockedNext[];
  compensation: CrossSurfaceCompensationState;
  note: string;
}

/** A row whose legs are pinned by an existing test and are not re-run here. */
function pointerRow(
  journey: CrossSurfaceJourney,
  branch: CrossSurfaceBranch,
  source: string,
  reuse: CrossSurfaceReuse,
  declared: DeclaredColumns,
): CrossSurfaceRow {
  return {
    id: rowIdFor(journey, branch),
    journey,
    branch,
    basis: "reused",
    source,
    reuse,
    terminal: null,
    legs: [],
    status: "reference",
    lastConfirmed: declared.lastConfirmed,
    unconfirmed: declared.unconfirmed,
    blockedNext: declared.blockedNext,
    compensation: { state: declared.compensation, note: declared.note },
    note: "Declared from the pinned test. The legs were not run in this table.",
  };
}

function missingRow(journey: CrossSurfaceJourney, branch: CrossSurfaceBranch, reason: string): CrossSurfaceRow {
  return {
    id: rowIdFor(journey, branch),
    journey,
    branch,
    basis: "no-source-branch",
    source: "none",
    reuse: null,
    terminal: null,
    legs: [],
    status: "reference",
    lastConfirmed: "none",
    unconfirmed: [],
    blockedNext: [],
    compensation: {
      state: "COMPENSATION_UNDEFINED",
      note: "No source reproduces this branch, so no compensation path is defined and none is composed.",
    },
    note: reason,
  };
}

const TEST_DIR = "packages/protocol-adapter/test";
const QUALIFICATION_TEST: Pick<CrossSurfaceReuse, "testPath" | "testTitle"> = {
  testPath: `${TEST_DIR}/operational-qualification.test.ts`,
  testTitle: "runs the whole matrix and records every exercise class",
};

// ---------------------------------------------------------------------------
// Reused rows: legs copied from the qualification packet
// ---------------------------------------------------------------------------

interface QualificationJourneyView {
  id: string;
  calls: readonly { label: string; outcome: string; code: string | null; note: string }[];
}

function legOutcomeOf(value: string): CrossSurfaceLegOutcome {
  if ((CROSS_SURFACE_LEG_OUTCOMES as readonly string[]).includes(value)) {
    return value as CrossSurfaceLegOutcome;
  }
  return value.startsWith("FENCED") ? "FENCED" : "OBSERVED";
}

async function qualificationJourneys(): Promise<ReadonlyMap<string, QualificationJourneyView>> {
  const outcome = await createStubQualificationRunner().run({ contextKey: "xs-qualification", intentRef: "xs-qualification-1" });
  const found = new Map<string, QualificationJourneyView>();
  if (outcome.kind === "ready") {
    for (const item of outcome.packet.journeys) {
      found.set(item.id, { id: item.id, calls: item.calls });
    }
  }
  return found;
}

function reusedRow(
  journey: CrossSurfaceJourney,
  branch: CrossSurfaceBranch,
  qualificationJourneyId: string,
  terminal: string,
  journeys: ReadonlyMap<string, QualificationJourneyView>,
  note: string,
): CrossSurfaceRow {
  const view = journeys.get(qualificationJourneyId);
  if (view === undefined) {
    return missingRow(journey, branch, `The qualification journey ${qualificationJourneyId} is not in the packet.`);
  }
  const legs = view.calls.map((call) => leg(call.label, legOutcomeOf(call.outcome), call.code, call.note));
  const status = judgeLegs(legs, terminal);
  return {
    id: rowIdFor(journey, branch),
    journey,
    branch,
    basis: "reused",
    source: qualificationJourneyId,
    reuse: { ...QUALIFICATION_TEST, qualificationJourneyId },
    terminal,
    legs,
    status,
    lastConfirmed: lastConfirmedOf(legs),
    unconfirmed: unconfirmedOf(legs),
    blockedNext: blockedNextOf(legs),
    compensation: compensationFor(status),
    note,
  };
}

// ---------------------------------------------------------------------------
// Executed rows
// ---------------------------------------------------------------------------

async function providerLegs(scenario: ProviderScenario, lastStep: "observe" | "issue"): Promise<CrossSurfaceLeg[]> {
  const port = createStubProviderJourney({ scenario });
  const controller = new ProviderJourneyController(port, { actorRef: PROVIDER_DESK_ACTOR });
  const legs: CrossSurfaceLeg[] = [];
  await controller.refresh();
  legs.push(readLeg(controller.state().readState, "synthetic provider source"));
  const begin = await controller.run({ step: "begin", intentRef: "xs-begin", orderRef: "ord-0001" });
  const checkoutRef = begin.kind === "CONFIRMED" ? (begin.intent.refs?.checkoutRef ?? null) : null;
  legs.push(stepLeg("begin", begin, "One synthetic checkout opened."));
  if (checkoutRef === null) {
    return legs;
  }
  await controller.refresh();
  port.deliverReturn(checkoutRef);
  legs.push(leg("return landing", "OBSERVED", "returned", "A return landing is a source event, never a payment observation."));
  await controller.refresh();
  const callback = port.deliverCallback(checkoutRef);
  legs.push(leg("provider report", "OBSERVED", callback?.result ?? "none", "The provider's own report arrived at the synthetic source."));
  await controller.refresh();
  const observe = await controller.run({ step: "observe", intentRef: "xs-observe", checkoutRef });
  legs.push(stepLeg("observe", observe, "The payment observation is recorded from the provider report."));
  await controller.refresh();
  if (lastStep === "observe") {
    legs.push(gateLeg("issue", controller.gateFor({ step: "issue", intentRef: "xs-issue", checkoutRef }), "Issuance waits on a known payment observation."));
    return legs;
  }
  const issue = await controller.run({ step: "issue", intentRef: "xs-issue", checkoutRef });
  legs.push(stepLeg("issue", issue, "One issuance write."));
  await controller.refresh();
  legs.push(gateLeg("refund record", controller.gateFor({ step: "refund", intentRef: "xs-refund", orderRef: "ord-0001" }), "A refund record executes nothing."));
  return legs;
}

async function platformPaymentLostLegs(scenario: PlatformScenario): Promise<CrossSurfaceLeg[]> {
  const port = createStubPlatformJourney({ scenario });
  const controller = new PlatformJourneyController(port, { actorRef: PLATFORM_DESK_ACTOR });
  const legs: CrossSurfaceLeg[] = [];
  await controller.refresh();
  legs.push(readLeg(controller.state().readState, "synthetic trade source"));
  const book = await controller.run({ step: "book", intentRef: "xs-book", listingRef: "lst-0001" });
  const tradeRef = book.kind === "CONFIRMED" ? (book.intent.refs?.tradeRef ?? null) : null;
  legs.push(stepLeg("book", book, "One booking write."));
  await controller.refresh();
  if (tradeRef !== null) {
    legs.push(gateLeg("transfer", controller.gateFor({ step: "transfer", intentRef: "xs-transfer", tradeRef }), "A transfer waits on an observed payment."));
  }
  return legs;
}

async function refundLegs(scenario: RefundScenario, script: "normal" | "reject" | "lost" | "partial"): Promise<CrossSurfaceLeg[]> {
  const port = createStubRefundReturn({ scenario });
  const controller = new RefundReturnController(port, { actorRef: REFUND_RETURN_DESK_ACTOR, orderRef: "ord_evt-001" });
  const legs: CrossSurfaceLeg[] = [];
  await controller.refresh();
  legs.push(readLeg(controller.state().readState, "synthetic refund source"));
  if (script === "normal") {
    legs.push(stepLeg("adjust", await controller.run({ step: "adjust", intentRef: "xs-adjust" }), "A card-side adjustment record."));
    await controller.refresh();
    legs.push(stepLeg("refund", await controller.run({ step: "refund", intentRef: "xs-refund" }), "A refund record. It executes nothing and returns no funds."));
    await controller.refresh();
  } else if (script === "reject") {
    legs.push(stepLeg("void", await controller.run({ step: "void", intentRef: "xs-void" }), "The source answered the void request."));
    await controller.refresh();
    legs.push(gateLeg("refund", controller.gateFor({ step: "refund", intentRef: "xs-refund" }), "A refund record waits on an observed payment."));
  } else if (script === "lost") {
    legs.push(stepLeg("refund", await controller.run({ step: "refund", intentRef: "xs-refund" }), "A refund record. Its answer never arrived."));
    await controller.refresh();
    legs.push(gateLeg("adjust", controller.gateFor({ step: "adjust", intentRef: "xs-adjust" }), "A later write on the order stays fenced."));
  } else {
    legs.push(stepLeg("cancel", await controller.run({ step: "cancel", intentRef: "xs-cancel" }), "A reservation cancel on a held order."));
    await controller.refresh();
    legs.push(gateLeg("adjust", controller.gateFor({ step: "adjust", intentRef: "xs-adjust" }), "A card-side adjustment waits on an observed payment."));
    legs.push(gateLeg("refund", controller.gateFor({ step: "refund", intentRef: "xs-refund" }), "A refund record waits on an observed payment."));
  }
  return legs;
}

async function marketingLegs(scenario: MarketingScenario, script: "normal" | "reject" | "lost" | "partial"): Promise<CrossSurfaceLeg[]> {
  const port = createStubMarketingJourney({ scenario });
  const controller = new MarketingJourneyController(port, { actorRef: MARKETING_DESK_ACTOR, subjectRef: MARKETING_OWN_SUBJECT });
  const legs: CrossSurfaceLeg[] = [];
  await controller.refresh();
  legs.push(readLeg(controller.state().readState, "synthetic benefit source"));
  const benefitRef = script === "partial" ? "ben-0001" : "ben-0002";
  const orderRef = script === "partial" ? "ord-0002" : "ord-0001";
  const apply = await controller.run({ step: "apply", intentRef: "xs-apply", benefitRef, orderRef });
  legs.push(stepLeg("apply", apply, "An application. It confirms no purchase and pays no reward."));
  await controller.refresh();
  if (script === "lost") {
    legs.push(gateLeg("reclaim", controller.gateFor({ step: "reclaim", intentRef: "xs-reclaim", applicationRef: "app-0001" }), "A reclaim stays fenced behind the unconfirmed apply."));
  } else if (script === "partial") {
    port.simulate({ control: "refund-order", orderRef });
    await controller.refresh();
    const application = projectMarketing(controller.state()).applications[0];
    legs.push(leg("order refund observed", "OBSERVED", application?.state ?? "none", "A synthetic source event. The application is now due for a reclaim."));
    legs.push(
      leg(
        "reclaim",
        "NOT_SENT",
        "reclaim-due",
        "A reclaim is the user's own control on the benefit desk. This table sends none, and whether it restores a usage count or a budget is UNDETERMINED.",
      ),
    );
  }
  return legs;
}

async function delegationLegs(scenario: DelegationScenario, script: "normal" | "reject" | "lost"): Promise<CrossSurfaceLeg[]> {
  const port = createStubDelegationAssistant({ scenario });
  const controller = new DelegationAssistantController(port, { actorRef: DELEGATION_DESK_ACTOR, principalRef: DELEGATION_OWN_PRINCIPAL });
  const legs: CrossSurfaceLeg[] = [];
  await controller.refresh();
  legs.push(readLeg(controller.state().readState, "synthetic delegation source"));
  const turn = controller.interpret("draft an order for lst-0001");
  const proposalRef = controller.state().turns.at(-1)?.proposalRef ?? null;
  legs.push(leg("propose", "OBSERVED", turn.kind, "A proposal is not an approval. Request text is never authority."));
  if (proposalRef === null) {
    return legs;
  }
  legs.push(stepLeg("approve", await controller.approve({ proposalRef, intentRef: "xs-approve-1" }), "One approval sends one synthetic draft command."));
  if (script === "lost") {
    controller.interpret("draft an order for lst-0002");
    const second = controller.state().turns.at(-1)?.proposalRef ?? null;
    if (second !== null) {
      legs.push(gateLeg("next approval", controller.gateFor({ proposalRef: second, intentRef: "xs-approve-2" }), "A later approval stays fenced behind the unconfirmed one."));
    }
  }
  return legs;
}

async function creditLegs(scenario: ServicingScenario, script: "normal" | "reject" | "lost" | "partial"): Promise<CrossSurfaceLeg[]> {
  const port = createStubCreditServicing({ scenario });
  const controller = new CreditServicingController(port, script === "reject" ? { actorRef: SERVICING_APPROVER_ACTOR } : {});
  const legs: CrossSurfaceLeg[] = [];
  await controller.read();
  legs.push(readLeg(controller.state().readState, "synthetic servicing source"));
  if (script === "reject") {
    legs.push(stepLeg("approve-proposal", await controller.approveProposal("prp-0001"), "An approval by the proposer is refused by the source."));
  } else if (script === "partial") {
    const draw = controller.state().snapshot?.draw ?? null;
    legs.push(
      leg(
        "draw instruction",
        draw?.instruction === "recorded" ? "CONFIRMED" : "OBSERVED",
        draw?.instruction ?? "none",
        "The source recorded an instruction. A draw instruction is not a disbursement.",
      ),
    );
    legs.push(
      leg(
        "disbursement observation",
        draw?.observation === "unknown" ? "UNKNOWN" : "OBSERVED",
        draw?.observation ?? "none",
        "Nobody observed a disbursement. The source states it as unknown, and this table does not call it paid or unpaid.",
      ),
    );
  } else {
    legs.push(stepLeg("propose-adjustment", await controller.proposeAdjustment("ins-0002", "note", "x"), "A proposal. It applies nothing alone."));
    if (script === "lost") {
      const next = controller.canSend("propose-case-transition");
      legs.push(
        next.allowed
          ? leg("propose-case-transition", "NOT_SENT", "gate-open", OBSERVATION_ONLY)
          : leg("propose-case-transition", "FENCED", "unknown-outcome", next.reason ?? "A later request stays fenced."),
      );
    }
  }
  return legs;
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

const BOOKING_TEST = `${TEST_DIR}/booking-journey.test.ts`;
const GIFT_TEST = `${TEST_DIR}/gift-transfer.test.ts`;
const ORGANIZER_TEST = `${TEST_DIR}/organizer-console.test.ts`;
const SESSION_TEST = `${TEST_DIR}/session-recovery-controller.test.ts`;

function pointer(testPath: string, testTitle: string): CrossSurfaceReuse {
  return { testPath, testTitle, qualificationJourneyId: null };
}

function fenced(action: string, reason: string): CrossSurfaceBlockedNext {
  return { action, reason };
}

function referenceRows(): CrossSurfaceRow[] {
  return [
    pointerRow("purchase-booking", "normal", "booking-journey.test.ts", pointer(BOOKING_TEST, "composes only the published bodies, in order, and copies the receipt links"), {
      lastConfirmed: "accept_trade",
      unconfirmed: [],
      blockedNext: [
        fenced("commit_trade", "Not composed under M2. The adapter records the reason only."),
        fenced("open_admission", "Not composed under M2. The adapter records the reason only."),
        fenced("admit", "Not composed under M2. The adapter records the reason only."),
      ],
      compensation: "NONE_NEEDED",
      note: "The pinned journey ends at accept_trade and nothing past it is sent.",
    }),
    pointerRow("purchase-booking", "explicit-reject", "booking-journey.test.ts", pointer(BOOKING_TEST, "treats a 422, including a transport-shaped error string, as a rejection and fences"), {
      lastConfirmed: "none",
      unconfirmed: [],
      blockedNext: [fenced("prepare_trade", "Halted by the earlier rejection.")],
      compensation: "NONE_NEEDED",
      note: "The first write was rejected, so no leg was confirmed.",
    }),
    pointerRow("purchase-booking", "response-lost", "booking-journey.test.ts", pointer(BOOKING_TEST, "keeps a non-422 response without rejected:true as unknown"), {
      lastConfirmed: "none",
      unconfirmed: ["create_event"],
      blockedNext: [fenced("prepare_trade", "Halted behind the unconfirmed create_event.")],
      compensation: "FENCED",
      note: "The request may have applied. Later steps are fenced and nothing resolves it here.",
    }),
    pointerRow("purchase-booking", "partial-success", "booking-journey.test.ts", pointer(BOOKING_TEST, "effect and then loses the response"), {
      lastConfirmed: "the step before the lost one",
      unconfirmed: ["the step whose response was lost: create_event, prepare_trade, or accept_trade"],
      blockedNext: [fenced("every later step", "Halted behind the unconfirmed step.")],
      compensation: "COMPENSATION_UNDEFINED",
      note: "An earlier step may be confirmed while a later one is not. No compensation path is defined.",
    }),
    pointerRow("gift", "normal", "gift-transfer.test.ts", pointer(GIFT_TEST, "offers then accepts with pinned body keys and one call per step"), {
      lastConfirmed: "accept_gift",
      unconfirmed: [],
      blockedNext: [fenced("cancel_gift", "Not composed here. A gift cancel is the opposite command and is not approved.")],
      compensation: "NONE_NEEDED",
      note: "The pinned journey offers and accepts once each.",
    }),
    missingRow(
      "gift",
      "explicit-reject",
      "No existing gift test pins an explicit rejection answer for offer_gift or accept_gift, and this table does not build one.",
    ),
    pointerRow("gift", "response-lost", "gift-transfer.test.ts", pointer(GIFT_TEST, "treats an unknown offer as a halt"), {
      lastConfirmed: "none",
      unconfirmed: ["offer_gift"],
      blockedNext: [fenced("accept_gift", "Halted behind the unconfirmed offer."), fenced("cancel_gift", "Halted, and not composed here.")],
      compensation: "FENCED",
      note: "The offer may have applied. Neither accept nor cancel is sent.",
    }),
    pointerRow("gift", "partial-success", "gift-transfer.test.ts", pointer(GIFT_TEST, "records an invalid accept receipt as unknown and fences the next write"), {
      lastConfirmed: "offer_gift",
      unconfirmed: ["accept_gift"],
      blockedNext: [fenced("cancel_gift", "Halted, and not composed here.")],
      compensation: "COMPENSATION_UNDEFINED",
      note: "The offer is confirmed and the accept receipt could not be trusted. No compensation path is defined.",
    }),
    pointerRow("organizer", "normal", "organizer-console.test.ts", pointer(ORGANIZER_TEST, "posts the six bodies and actors and omits optional create fields"), {
      lastConfirmed: "the last posted lifecycle command",
      unconfirmed: [],
      blockedNext: [],
      compensation: "NONE_NEEDED",
      note: "Each lifecycle command is posted as its own request. An admission post is not venue admission.",
    }),
    pointerRow("organizer", "explicit-reject", "organizer-console.test.ts", pointer(ORGANIZER_TEST, "treats a rejection as a halt and does not send the next command"), {
      lastConfirmed: "none",
      unconfirmed: [],
      blockedNext: [fenced("close_sales", "Halted by the earlier rejection.")],
      compensation: "NONE_NEEDED",
      note: "The first command was rejected, so no leg was confirmed.",
    }),
    pointerRow("organizer", "response-lost", "organizer-console.test.ts", pointer(ORGANIZER_TEST, "treats an unknown outcome as a halt"), {
      lastConfirmed: "none",
      unconfirmed: ["open_admission"],
      blockedNext: [fenced("complete_event", "Halted behind the unconfirmed command.")],
      compensation: "FENCED",
      note: "The command may have applied. Nothing is sent again and nothing resolves it here.",
    }),
    pointerRow("organizer", "partial-success", "organizer-console.test.ts", pointer(ORGANIZER_TEST, "records a mismatched receipt as unknown and fences the next write"), {
      lastConfirmed: "the commands before the mismatched receipt",
      unconfirmed: ["the command whose receipt did not match"],
      blockedNext: [fenced("every later command", "Halted behind the unconfirmed command.")],
      compensation: "COMPENSATION_UNDEFINED",
      note: "An earlier command is confirmed and a later receipt is untrusted. No compensation path is defined, and no cancel is composed.",
    }),
    pointerRow("session-recovery", "normal", "session-recovery-controller.test.ts", pointer(SESSION_TEST, "writes the intent before the send and settles after"), {
      lastConfirmed: "the settled intent",
      unconfirmed: [],
      blockedNext: [],
      compensation: "NONE_NEEDED",
      note: "The record is written before the send and settled after the answer.",
    }),
    pointerRow("session-recovery", "explicit-reject", "session-recovery-controller.test.ts", pointer(SESSION_TEST, "refuses to send when the write-ahead record is refused"), {
      lastConfirmed: "none",
      unconfirmed: [],
      blockedNext: [fenced("the send", "Nothing is sent when the record before it is refused.")],
      compensation: "NONE_NEEDED",
      note: "The send never left, so nothing was confirmed.",
    }),
    pointerRow("session-recovery", "response-lost", "session-recovery-controller.test.ts", pointer(SESSION_TEST, "recovers a lost answer as UNKNOWN after a reload and sends nothing"), {
      lastConfirmed: "none",
      unconfirmed: ["the intent whose answer was lost"],
      blockedNext: [fenced("any resend", "A reload sends nothing and resolves nothing.")],
      compensation: "FENCED",
      note: "The intent stays UNKNOWN after a reload.",
    }),
    pointerRow("session-recovery", "partial-success", "session-recovery-controller.test.ts", pointer(SESSION_TEST, "holds the scope and sends nothing new or compensating after an UNKNOWN"), {
      lastConfirmed: "writes in another scope",
      unconfirmed: ["the held scope's intent"],
      blockedNext: [fenced("the held scope", "Nothing new or compensating is sent into it.")],
      compensation: "COMPENSATION_UNDEFINED",
      note: "One scope is held at UNKNOWN while another proceeds. No compensation path is defined.",
    }),
  ];
}

/** Every journey and branch pair gets exactly one row, in table order. */
export async function composeCrossSurfaceRows(): Promise<CrossSurfaceRow[]> {
  const qualification = await qualificationJourneys();
  const built = new Map<string, CrossSurfaceRow>();
  const add = (row: CrossSurfaceRow): void => {
    built.set(row.id, row);
  };
  for (const row of referenceRows()) {
    add(row);
  }

  add(reusedRow("purchase-provider", "normal", "journey.provider-checkout", "issue", qualification, "Reused from the qualification packet."));
  add(reusedRow("purchase-provider", "explicit-reject", "journey.provider-declined", "issue", qualification, "Reused from the qualification packet."));
  add(
    executedRow({
      journey: "purchase-provider",
      branch: "response-lost",
      source: "provider scenario observe-lost",
      terminal: "issue",
      legs: await providerLegs("observe-lost", "observe"),
      note: "The payment observation answer was lost. Issuance stays fenced and a return landing is not a payment.",
    }),
  );
  add(
    executedRow({
      journey: "purchase-provider",
      branch: "partial-success",
      source: "provider scenario issue-lost",
      terminal: "issue",
      legs: await providerLegs("issue-lost", "issue"),
      note: "The payment is observed and the issuance answer was lost. The two stay apart.",
    }),
  );

  add(reusedRow("resale-platform", "normal", "journey.platform-trade-clean", "transfer", qualification, "Reused from the qualification packet."));
  add(reusedRow("resale-platform", "explicit-reject", "journey.platform-trade-rival", "transfer", qualification, "Reused from the qualification packet."));
  add(reusedRow("resale-platform", "response-lost", "journey.platform-transfer-late", "transfer", qualification, "Reused from the qualification packet. A late result is evidence only."));
  add(
    executedRow({
      journey: "resale-platform",
      branch: "partial-success",
      source: "platform scenario payment-lost",
      terminal: "transfer",
      legs: await platformPaymentLostLegs("payment-lost"),
      note: "The booking is confirmed and no payment was observed. The transfer waits behind that gap.",
    }),
  );

  add(executedRow({ journey: "refund", branch: "normal", source: "refund scenario clean", terminal: "refund", legs: await refundLegs("clean", "normal"), note: "A refund record is not a refund of funds." }));
  add(executedRow({ journey: "refund", branch: "explicit-reject", source: "refund scenario held-only", terminal: "refund", legs: await refundLegs("held-only", "reject"), note: "The void was rejected before any payment was observed." }));
  add(executedRow({ journey: "refund", branch: "response-lost", source: "refund scenario refund-lost", terminal: "refund", legs: await refundLegs("refund-lost", "lost"), note: "The refund record answer was lost. It stays unconfirmed." }));
  add(executedRow({ journey: "refund", branch: "partial-success", source: "refund scenario held-only", terminal: "refund", legs: await refundLegs("held-only", "partial"), note: "The reservation cancel is confirmed and the refund record is blocked." }));

  add(executedRow({ journey: "marketing-benefit", branch: "normal", source: "marketing scenario clean", terminal: "apply", legs: await marketingLegs("clean", "normal"), note: "An application is not a reward." }));
  add(executedRow({ journey: "marketing-benefit", branch: "explicit-reject", source: "marketing scenario budget-race", terminal: "apply", legs: await marketingLegs("budget-race", "reject"), note: "The source rejected the apply after the read showed it open." }));
  add(executedRow({ journey: "marketing-benefit", branch: "response-lost", source: "marketing scenario apply-lost", terminal: "apply", legs: await marketingLegs("apply-lost", "lost"), note: "The apply answer was lost. The source may have applied it." }));
  add(executedRow({ journey: "marketing-benefit", branch: "partial-success", source: "marketing scenario clean + refund-order event", terminal: "reclaim", legs: await marketingLegs("clean", "partial"), note: "The apply is confirmed and the order was then refunded at the source. The reclaim is due and not sent." }));

  add(executedRow({ journey: "delegation", branch: "normal", source: "delegation scenario clean", terminal: "approve", legs: await delegationLegs("clean", "normal"), note: "One approval sends one synthetic draft command." }));
  add(executedRow({ journey: "delegation", branch: "explicit-reject", source: "delegation scenario expired", terminal: "approve", legs: await delegationLegs("expired", "reject"), note: "The grant had expired at the source." }));
  add(executedRow({ journey: "delegation", branch: "response-lost", source: "delegation scenario draft-lost", terminal: "approve", legs: await delegationLegs("draft-lost", "lost"), note: "The approval answer was lost. The draft may exist." }));
  add(
    missingRow(
      "delegation",
      "partial-success",
      "The only partial source is cancel-lost, which needs the draft cancel. That is an opposite command, no compensation is approved, and this table sends none.",
    ),
  );

  add(executedRow({ journey: "credit-servicing", branch: "normal", source: "servicing scenario clean", terminal: "propose-adjustment", legs: await creditLegs("clean", "normal"), note: "A proposal is recorded. It applies nothing alone." }));
  add(executedRow({ journey: "credit-servicing", branch: "explicit-reject", source: "servicing scenario self-approval", terminal: "approve-proposal", legs: await creditLegs("self-approval", "reject"), note: "A proposer cannot approve their own proposal." }));
  add(executedRow({ journey: "credit-servicing", branch: "response-lost", source: "servicing scenario act-lost", terminal: "propose-adjustment", legs: await creditLegs("act-lost", "lost"), note: "The proposal answer was lost. Every later request stays fenced." }));
  add(executedRow({ journey: "credit-servicing", branch: "partial-success", source: "servicing scenario draw-unknown", terminal: "disbursement observation", legs: await creditLegs("draw-unknown", "partial"), note: "A draw instruction is recorded and its disbursement is not observed." }));

  const rows: CrossSurfaceRow[] = [];
  for (const journey of CROSS_SURFACE_JOURNEYS) {
    for (const branch of CROSS_SURFACE_BRANCHES) {
      const row = built.get(rowIdFor(journey, branch));
      rows.push(row ?? missingRow(journey, branch, "No row was composed for this branch."));
    }
  }
  return rows;
}
