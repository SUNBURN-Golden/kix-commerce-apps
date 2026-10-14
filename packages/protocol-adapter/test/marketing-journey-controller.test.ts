import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MARKETING_DESK_ACTOR,
  MARKETING_FOREIGN_SUBJECT,
  MARKETING_OWN_SUBJECT,
  MarketingJourneyController,
  createNotBoundMarketingJourney,
  createStubMarketingJourney,
  projectMarketing,
  type MarketingJourneyPort,
  type MarketingReadOutcome,
  type MarketingScenario,
  type MarketingStepInput,
  type MarketingStepResult,
  type MarketingWriteOutcome,
  type MarketingWriteRequest,
  type StubMarketingJourney,
} from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function make(scenario: MarketingScenario = "clean") {
  const port = createStubMarketingJourney({ scenario });
  const controller = new MarketingJourneyController(port, { actorRef: MARKETING_DESK_ACTOR, subjectRef: MARKETING_OWN_SUBJECT });
  return { port, controller };
}

async function ready(scenario: MarketingScenario = "clean") {
  const made = make(scenario);
  await made.controller.refresh();
  return made;
}

let counter = 0;
function apply(benefitRef: string, orderRef = "ord-0001"): MarketingStepInput {
  counter += 1;
  return { step: "apply", intentRef: `intent-${counter}`, benefitRef, orderRef };
}

function reclaim(applicationRef: string): MarketingStepInput {
  counter += 1;
  return { step: "reclaim", intentRef: `intent-${counter}`, applicationRef };
}

function codeOf(result: MarketingStepResult): string {
  switch (result.kind) {
    case "REJECTED":
    case "CONFIRMED":
    case "UNKNOWN":
    case "QUARANTINED":
      return `${result.kind}:${result.intent.code ?? "-"}`;
    case "FENCED":
      return `FENCED:${result.fence.reason}`;
    case "NOT_SENT":
      return `NOT_SENT:${result.reason}`;
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

/** A port that records what reaches it and can be told what to answer. */
function spyPort(inner: StubMarketingJourney, hooks: { rewrite?: (outcome: MarketingWriteOutcome) => MarketingWriteOutcome; throwOnSubmit?: boolean } = {}) {
  const sent: MarketingWriteRequest[] = [];
  const reads: number[] = [];
  const port: MarketingJourneyPort = {
    environment: inner.environment,
    source: inner.source,
    scenario: inner.scenario,
    read(request) {
      reads.push(reads.length);
      return inner.read(request);
    },
    async submit(request) {
      sent.push(request);
      if (hooks.throwOnSubmit) {
        throw new Error("the connection closed after the request was written");
      }
      const outcome = await inner.submit(request);
      return hooks.rewrite ? hooks.rewrite(outcome) : outcome;
    },
    simulate: (request) => inner.simulate(request),
    deliverHeld: () => inner.deliverHeld(),
  };
  return { port, sent, reads };
}

describe("marketing controller read", () => {
  it("keys the context on mode, domain, actor, subject, and session incarnation", () => {
    const { controller } = make();
    const context = controller.state().context;
    expect(context).toMatchObject({ environment: "stub", actorRef: "fan-desk", subjectRef: "sub-0001", incarnation: 1 });
    expect(context.key.split("|")).toEqual(["stub", context.domain, "fan-desk", "sub-0001", "1"]);
    const next = controller.switchContext({ subjectRef: MARKETING_FOREIGN_SUBJECT });
    expect(next.key.split("|")).toEqual(["stub", context.domain, "fan-desk", "sub-0002", "2"]);
    expect(next.key).not.toBe(context.key);
  });

  it("starts unread, reads on request, and reports each outcome as its own state", async () => {
    const { controller } = make();
    expect(controller.state()).toMatchObject({ readState: "none", freshness: "UNAVAILABLE", snapshot: null });
    expect(await controller.refresh()).toEqual({ kind: "APPLIED", readState: "ready" });
    expect(controller.state()).toMatchObject({ readState: "ready", freshness: "CURRENT", refreshRequired: null });
    expect(controller.state().snapshot?.benefits).toHaveLength(4);

    const states: [MarketingScenario, string, string][] = [
      ["empty", "empty", "CURRENT"],
      ["stale", "stale", "STALE"],
      ["denied", "denied", "UNAVAILABLE"],
      ["scope-leak", "refused", "UNAVAILABLE"],
      ["snapshot-claims-crm", "refused", "UNAVAILABLE"],
    ];
    for (const [scenario, readState, freshness] of states) {
      const made = make(scenario);
      await made.controller.refresh();
      const state = made.controller.state();
      expect(state.readState, scenario).toBe(readState);
      expect(state.freshness, scenario).toBe(freshness);
      expect(state.snapshot, scenario).toBeNull();
    }
    const denied = make("denied");
    await denied.controller.refresh();
    expect(denied.controller.state()).toMatchObject({ readCode: "GRANT_REVOKED" });
    const leak = make("scope-leak");
    await leak.controller.refresh();
    expect(leak.controller.state()).toMatchObject({ readCode: "SCOPE_LEAK" });
    expect(leak.controller.state().readDetail).toContain("applications[].subjectRef");
  });

  it("reports a not-bound port, a changed tuple, and a read that threw, each as its own state", async () => {
    const notBound = new MarketingJourneyController(createNotBoundMarketingJourney(), { actorRef: MARKETING_DESK_ACTOR, subjectRef: MARKETING_OWN_SUBJECT });
    await notBound.refresh();
    expect(notBound.state()).toMatchObject({ readState: "not-bound", snapshot: null });
    expect(notBound.state().readDetail).toContain("wave7-marketing-contracts");

    const changed = createStubMarketingJourney({ expectedTuple: { ...(await import("../src/index.js")).DISCOVERY_READ_TUPLE_LITERALS, domain: "other" } });
    const tuple = new MarketingJourneyController(changed, { actorRef: MARKETING_DESK_ACTOR, subjectRef: MARKETING_OWN_SUBJECT });
    await tuple.refresh();
    expect(tuple.state()).toMatchObject({ readState: "tuple-changed", snapshot: null });

    const inner = createStubMarketingJourney();
    const failing: MarketingJourneyPort = { ...spyPort(inner).port, read: () => Promise.reject(new Error("no answer")) };
    const lost = new MarketingJourneyController(failing, { actorRef: MARKETING_DESK_ACTOR, subjectRef: MARKETING_OWN_SUBJECT });
    await lost.refresh();
    expect(lost.state()).toMatchObject({ readState: "unavailable", readDetail: "no answer", freshness: "UNAVAILABLE" });
  });

  it("drops a read that began before a context switch, and a read older than one already applied", async () => {
    const inner = createStubMarketingJourney();
    const release: (() => void)[] = [];
    const port: MarketingJourneyPort = {
      ...spyPort(inner).port,
      read: (request) =>
        new Promise<MarketingReadOutcome>((resolve) => {
          release.push(() => resolve(inner.read(request)));
        }),
    };
    const controller = new MarketingJourneyController(port, { actorRef: MARKETING_DESK_ACTOR, subjectRef: MARKETING_OWN_SUBJECT });

    const switched = controller.refresh();
    controller.switchContext();
    release[0]?.();
    expect(await switched).toEqual({ kind: "DROPPED", cause: "context-changed" });
    expect(controller.state()).toMatchObject({ readState: "none", snapshot: null });

    const older = controller.refresh();
    const newer = controller.refresh();
    release[2]?.();
    expect(await newer).toEqual({ kind: "APPLIED", readState: "ready" });
    const appliedId = controller.state().snapshot?.snapshotId;
    release[1]?.();
    expect(await older).toEqual({ kind: "DROPPED", cause: "older-read" });
    expect(controller.state().snapshot?.snapshotId).toBe(appliedId);
    expect(controller.state().counters.droppedReads).toBe(2);
  });
});

describe("marketing controller behind marker", () => {
  it("a read that began before a write cannot clear the behind marker the write set", async () => {
    const inner = createStubMarketingJourney();
    const release: (() => void)[] = [];
    let hold = false;
    const port: MarketingJourneyPort = {
      environment: inner.environment,
      source: inner.source,
      scenario: inner.scenario,
      read(request) {
        if (!hold) {
          return inner.read(request);
        }
        // The answer is taken now, before any write, and delivered later.
        const outcome = inner.read(request);
        return new Promise<MarketingReadOutcome>((resolve) => {
          release.push(() => resolve(outcome));
        });
      },
      submit: (request) => inner.submit(request),
      simulate: (request) => inner.simulate(request),
      deliverHeld: () => inner.deliverHeld(),
    };
    const controller = new MarketingJourneyController(port, { actorRef: MARKETING_DESK_ACTOR, subjectRef: MARKETING_OWN_SUBJECT });
    await controller.refresh();
    hold = true;
    const early = controller.refresh();
    hold = false;
    expect((await controller.run(apply("ben-0002", "ord-0001"))).kind).toBe("CONFIRMED");
    expect(controller.state()).toMatchObject({ freshness: "STALE", refreshRequired: "own-write" });
    release[0]?.();
    expect(await early).toEqual({ kind: "APPLIED", readState: "ready" });
    // The early read does not show the application, and it must not say the view is current.
    expect(controller.state().snapshot?.applications).toEqual([]);
    expect(controller.state()).toMatchObject({ freshness: "STALE", refreshRequired: "own-write" });
    expect(codeOf(await controller.run(apply("ben-0002", "ord-0001")))).toBe("FENCED:snapshot-stale");
    expect(port.deliverHeld()).toBe(0);
    // A read that began after the write clears it and shows the application.
    await controller.refresh();
    expect(controller.state()).toMatchObject({ freshness: "CURRENT", refreshRequired: null });
    expect(controller.state().snapshot?.applications).toHaveLength(1);
    expect(inner.effects().applies).toBe(1);
  });

  it("a rejection marks the view behind in the same way, and the early read does not clear it", async () => {
    const { controller, port } = await ready();
    port.simulate({ control: "withdraw-consent" });
    expect((await controller.run(apply("ben-0001"))).kind).toBe("REJECTED");
    expect(controller.state().refreshRequired).toBe("rejection");
    await controller.refresh();
    expect(controller.state().refreshRequired).toBeNull();
  });

  it("keeps the watermark floor per subject: a new subject scope reads without the earlier subject's floor", async () => {
    const inner = createStubMarketingJourney();
    const floors: (string | null)[] = [];
    const port: MarketingJourneyPort = {
      environment: inner.environment,
      source: inner.source,
      scenario: inner.scenario,
      read(request) {
        floors.push(request.watermarkFloor);
        return inner.read(request);
      },
      submit: (request) => inner.submit(request),
      simulate: (request) => inner.simulate(request),
      deliverHeld: () => inner.deliverHeld(),
    };
    const controller = new MarketingJourneyController(port, { actorRef: MARKETING_DESK_ACTOR, subjectRef: MARKETING_OWN_SUBJECT });
    await controller.refresh();
    await controller.refresh();
    const watermark = controller.state().snapshot?.watermark ?? null;
    expect(floors).toEqual([null, watermark]);
    // A new incarnation for the same subject keeps the floor.
    controller.switchContext();
    await controller.refresh();
    expect(floors[2]).toBe(watermark);
    // Another subject scope does not inherit it.
    controller.switchContext({ subjectRef: MARKETING_FOREIGN_SUBJECT });
    await controller.refresh();
    expect(floors[3]).toBeNull();
  });
});

describe("marketing controller writes", () => {
  it("copies the eligibility and consent versions from the read, sends once, and marks the read behind after its own write", async () => {
    const inner = createStubMarketingJourney();
    const { port, sent } = spyPort(inner);
    const controller = new MarketingJourneyController(port, { actorRef: MARKETING_DESK_ACTOR, subjectRef: MARKETING_OWN_SUBJECT });
    await controller.refresh();
    const result = await controller.run(apply("ben-0001"));
    expect(result.kind).toBe("CONFIRMED");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      step: "apply",
      benefitRef: "ben-0001",
      orderRef: "ord-0001",
      expectedEligibilityVersion: 3,
      expectedConsentVersion: 2,
      actorRef: "fan-desk",
      subjectRef: "sub-0001",
    });
    expect(sent[0]?.contextKey).toBe(controller.state().context.key);
    expect(controller.state()).toMatchObject({ freshness: "STALE", refreshRequired: "own-write", counters: { sent: 1 } });
    // The next write waits for a read, whatever it targets.
    expect(codeOf(await controller.run(apply("ben-0002")))).toBe("FENCED:snapshot-stale");
    expect(sent).toHaveLength(1);
    await controller.refresh();
    expect(controller.state()).toMatchObject({ freshness: "CURRENT", refreshRequired: null });
    const projection = projectMarketing(controller.state());
    expect(projection.applications).toHaveLength(1);
    expect(projection.applications[0]).toMatchObject({ applicationRef: "app-0001", linked: true, channel: "this-desk" });
    expect(Object.values(controller.state().intents[0]?.receipt?.nonClaims ?? {})).toEqual([false, false, false, false, false, false, false]);
  });

  it("never sends a repeated intent, and never sends without a read", async () => {
    const made = make();
    expect(codeOf(await made.controller.run(apply("ben-0001")))).toBe("FENCED:no-snapshot");
    expect(made.port.effects().submits).toBe(0);
    await made.controller.refresh();
    const input = apply("ben-0002");
    expect((await made.controller.run(input)).kind).toBe("CONFIRMED");
    await made.controller.refresh();
    expect(codeOf(await made.controller.run(input))).toBe("FENCED:duplicate-intent");
    expect(made.port.effects().applies).toBe(1);
    expect(made.controller.state().counters).toMatchObject({ sent: 1, fenced: 2 });
  });

  it("fences what the last read already says the source will refuse, with the source's own word", async () => {
    const { controller, port } = await ready();
    expect(codeOf(await controller.run(apply("ben-0003")))).toBe("FENCED:verdict-blocked");
    const fence = await controller.run(apply("ben-0003"));
    expect(fence).toMatchObject({ kind: "FENCED", fence: { reason: "verdict-blocked", benefitRef: "ben-0003", verdict: "budget-exhausted" } });
    expect(codeOf(await controller.run(apply("ben-0099")))).toBe("FENCED:not-listed");
    expect(codeOf(await controller.run(apply("ben-0001", "ord-0099")))).toBe("FENCED:not-listed");
    expect(codeOf(await controller.run(reclaim("app-0099")))).toBe("FENCED:not-listed");
    expect(port.effects().submits).toBe(0);
  });

  it("fences an apply on a closed order and a second apply of a benefit already on the order", async () => {
    const { controller, port } = await ready();
    await controller.run(apply("ben-0002", "ord-0001"));
    await controller.refresh();
    expect(codeOf(await controller.run(apply("ben-0002", "ord-0001")))).toBe("FENCED:already-applied");
    port.simulate({ control: "cancel-order", orderRef: "ord-0002" });
    await controller.refresh();
    expect(codeOf(await controller.run(apply("ben-0001", "ord-0002")))).toBe("FENCED:order-closed");
    expect(port.effects().applies).toBe(1);
  });

  it("rejects the shape before the fence and before the port", async () => {
    const { controller, port } = await ready();
    expect(codeOf(await controller.run({ step: "apply", intentRef: "", benefitRef: "ben-0001", orderRef: "ord-0001" }))).toBe("NOT_SENT:invalid-intent");
    expect(codeOf(await controller.run({ step: "apply", intentRef: "x-1", benefitRef: "ord-0001", orderRef: "ord-0001" }))).toBe("NOT_SENT:identity");
    expect(codeOf(await controller.run({ step: "apply", intentRef: "x-2", benefitRef: "ben-0001", orderRef: "app-0001" }))).toBe("NOT_SENT:identity");
    expect(codeOf(await controller.run({ step: "reclaim", intentRef: "x-3", applicationRef: "ben-0001" }))).toBe("NOT_SENT:identity");
    expect(port.effects().submits).toBe(0);
    expect(controller.state().counters.notSent).toBe(4);
  });

  it("a not-bound port fences every write and sends nothing", async () => {
    const controller = new MarketingJourneyController(createNotBoundMarketingJourney(), { actorRef: MARKETING_DESK_ACTOR, subjectRef: MARKETING_OWN_SUBJECT });
    await controller.refresh();
    expect(codeOf(await controller.run(apply("ben-0001")))).toBe("FENCED:not-bound");
    expect(codeOf(await controller.run(reclaim("app-0001")))).toBe("FENCED:not-bound");
    expect(controller.state().intents).toEqual([]);
  });
});

describe("marketing journey: stale eligibility", () => {
  it("rejects an apply built on a membership basis that moved, marks the read behind, and blocks the benefit after a read", async () => {
    const { controller, port } = await ready();
    // A producer event the page cannot see: the membership tier lapses.
    expect(port.simulate({ control: "lapse-eligibility" }).kind).toBe("done");
    expect(controller.state().snapshot?.membership).toMatchObject({ tier: "member", version: 3 });
    const result = await controller.run(apply("ben-0001"));
    expect(result).toMatchObject({ kind: "REJECTED", intent: { code: "ELIGIBILITY_STALE" } });
    expect(controller.state()).toMatchObject({ freshness: "STALE", refreshRequired: "rejection" });
    expect(port.effects().applies).toBe(0);
    expect(codeOf(await controller.run(apply("ben-0001")))).toBe("FENCED:snapshot-stale");
    await controller.refresh();
    const after = controller.state().snapshot;
    expect(after?.membership).toMatchObject({ tier: "fan", version: 4 });
    expect(after?.benefits.find((benefit) => benefit.benefitRef === "ben-0001")?.verdict).toBe("not-eligible");
    expect(codeOf(await controller.run(apply("ben-0001")))).toBe("FENCED:verdict-blocked");
    // A benefit the new tier still qualifies for applies, on the new version.
    const fan = await controller.run(apply("ben-0002"));
    expect(fan.kind).toBe("CONFIRMED");
    expect(controller.state().intents.at(-1)?.receipt?.eligibilityVersion).toBe(4);
    const projection = projectMarketing(controller.state());
    expect(projection.rejections).toEqual([
      expect.objectContaining({ code: "ELIGIBILITY_STALE", returnAction: "read-again", benefitRef: "ben-0001", step: "apply" }),
    ]);
  });
});

describe("marketing journey: consent withdrawal", () => {
  it("does not reuse a new marketing authority after consent is withdrawn", async () => {
    const { controller, port } = await ready();
    // Consent is withdrawn at the consent page. The journey page is behind and still shows the benefit as eligible.
    port.simulate({ control: "withdraw-consent" });
    expect(controller.state().snapshot?.benefits.find((benefit) => benefit.benefitRef === "ben-0001")?.verdict).toBe("eligible");
    const withdrawn = await controller.run(apply("ben-0001"));
    expect(withdrawn).toMatchObject({ kind: "REJECTED", intent: { code: "CONSENT_WITHDRAWN" } });
    expect(projectMarketing(controller.state()).rejections[0]).toMatchObject({ code: "CONSENT_WITHDRAWN", returnAction: "manage-consent" });
    expect(port.effects().applies).toBe(0);

    await controller.refresh();
    let snapshot = controller.state().snapshot;
    expect(snapshot?.consent).toMatchObject({ state: "withdrawn", version: 3, authorization: { state: "stale", atVersion: 2 } });
    expect(snapshot?.benefits.find((benefit) => benefit.benefitRef === "ben-0001")?.verdict).toBe("consent-withdrawn");
    expect(snapshot?.benefits.find((benefit) => benefit.benefitRef === "ben-0004")?.verdict).toBe("consent-withdrawn");
    expect(codeOf(await controller.run(apply("ben-0001")))).toBe("FENCED:verdict-blocked");
    // A benefit that needs no consent is still available. Consent is consumed only where a benefit needs it.
    expect(snapshot?.benefits.find((benefit) => benefit.benefitRef === "ben-0002")?.verdict).toBe("eligible");

    // Consent is granted again. The authorization from before the withdrawal is not reused.
    port.simulate({ control: "grant-consent" });
    await controller.refresh();
    snapshot = controller.state().snapshot;
    expect(snapshot?.consent).toMatchObject({ state: "granted", version: 4, authorization: { state: "stale", atVersion: 2 } });
    expect(snapshot?.benefits.find((benefit) => benefit.benefitRef === "ben-0001")?.verdict).toBe("authorization-stale");
    expect(codeOf(await controller.run(apply("ben-0001")))).toBe("FENCED:verdict-blocked");

    // Only a new authorization at the current consent version lets the benefit apply.
    port.simulate({ control: "authorize-marketing" });
    await controller.refresh();
    const result = await controller.run(apply("ben-0001"));
    expect(result.kind).toBe("CONFIRMED");
    const receipt = controller.state().intents.at(-1)?.receipt;
    expect(receipt).toMatchObject({ consentVersion: 4, state: "applied" });
    expect(receipt?.nonClaims.withdrawnAuthorizationReused).toBe(false);
    expect(port.effects().applies).toBe(1);
  });

  it("an authorization that went stale between a read and a write is rejected by the source, not reused", async () => {
    const { controller, port } = await ready();
    port.simulate({ control: "withdraw-consent" });
    port.simulate({ control: "grant-consent" });
    const result = await controller.run(apply("ben-0004"));
    expect(result).toMatchObject({ kind: "REJECTED", intent: { code: "AUTHORIZATION_STALE" } });
    expect(port.effects().applies).toBe(0);
  });

  it("flags an earlier application that relied on consent, and neither reclaims nor restores it", async () => {
    const { controller, port } = await ready();
    await controller.run(apply("ben-0001"));
    port.simulate({ control: "withdraw-consent" });
    await controller.refresh();
    const projection = projectMarketing(controller.state());
    expect(projection.applications[0]).toMatchObject({ state: "applied", consentWithdrawnSince: true, usageRestoration: "UNDETERMINED" });
    expect(port.effects().reclaims).toBe(0);
  });
});

describe("marketing journey: duplicate benefit", () => {
  it("shows an application made by another channel as not ours, and rejects ours as a duplicate once", async () => {
    const { controller, port } = await ready("duplicate-elsewhere");
    const result = await controller.run(apply("ben-0001"));
    expect(result).toMatchObject({ kind: "REJECTED", intent: { code: "DUPLICATE_USE" } });
    expect(controller.state().counters.sent).toBe(1);
    await controller.refresh();
    const projection = projectMarketing(controller.state());
    expect(projection.applications).toHaveLength(1);
    expect(projection.applications[0]).toMatchObject({ channel: "other-channel", linked: false });
    expect(projection.rejections[0]).toMatchObject({ code: "DUPLICATE_USE", returnAction: "read-again" });
    expect(codeOf(await controller.run(apply("ben-0001")))).toBe("FENCED:already-applied");
    expect(port.effects().applies).toBe(0);
  });

  it("rejects a second coupon in the same group, and a use over the limit, from the source", async () => {
    const { controller } = await ready();
    await controller.run(apply("ben-0002", "ord-0001"));
    await controller.refresh();
    // The read says ben-0003 is exhausted, so it is fenced here. The source's own rejection is covered on the port.
    expect(codeOf(await controller.run(apply("ben-0003", "ord-0001")))).toBe("FENCED:verdict-blocked");
    expect(projectMarketing(controller.state()).benefits.find((item) => item.benefit.benefitRef === "ben-0002")?.benefit.verdict).toBe("usage-limit-reached");
  });

  it("lets the budget run out between a read and a write and shows the source's word afterwards", async () => {
    const { controller } = await ready("budget-race");
    const result = await controller.run(apply("ben-0002"));
    expect(result).toMatchObject({ kind: "REJECTED", intent: { code: "BUDGET_EXHAUSTED" } });
    await controller.refresh();
    expect(controller.state().snapshot?.benefits.find((benefit) => benefit.benefitRef === "ben-0002")?.verdict).toBe("budget-exhausted");
    expect(projectMarketing(controller.state()).rejections[0]?.returnAction).toBe("none");
  });
});

describe("marketing journey: reclaim", () => {
  it("applies, learns of a cancel only on a read, reclaims on request, and moves no count", async () => {
    const { controller, port } = await ready();
    await controller.run(apply("ben-0002", "ord-0001"));
    await controller.refresh();
    port.simulate({ control: "cancel-order", orderRef: "ord-0001" });
    // Nothing on the page changes until it reads.
    expect(projectMarketing(controller.state()).applications[0]?.state).toBe("applied");
    await controller.refresh();
    let projection = projectMarketing(controller.state());
    expect(projection.orders[0]?.state).toBe("cancelled");
    expect(projection.applications[0]).toMatchObject({ state: "reclaim-due", dueReason: "order-cancelled" });
    const before = projection.benefits.find((item) => item.benefit.benefitRef === "ben-0002")?.benefit;

    const result = await controller.run(reclaim("app-0001"));
    expect(result.kind).toBe("CONFIRMED");
    expect(controller.state().intents.at(-1)?.receipt).toMatchObject({ step: "reclaim", state: "reclaimed", usageRestoration: "UNDETERMINED" });
    expect(codeOf(await controller.run(reclaim("app-0001")))).toBe("FENCED:snapshot-stale");
    await controller.refresh();
    projection = projectMarketing(controller.state());
    expect(projection.applications[0]).toMatchObject({ state: "reclaimed", linked: true });
    const after = projection.benefits.find((item) => item.benefit.benefitRef === "ben-0002")?.benefit;
    expect(after?.usage).toEqual(before?.usage);
    expect(after?.budget?.committed).toBe(before?.budget?.committed);
    expect(codeOf(await controller.run(reclaim("app-0001")))).toBe("FENCED:not-reclaimable");
    expect(port.effects()).toMatchObject({ applies: 1, reclaims: 1 });
  });

  it("an observed refund makes a benefit due for reclaim and issues no refund", async () => {
    const { controller, port } = await ready();
    await controller.run(apply("ben-0001", "ord-0002"));
    port.simulate({ control: "refund-order", orderRef: "ord-0002" });
    await controller.refresh();
    const projection = projectMarketing(controller.state());
    expect(projection.orders[1]?.state).toBe("refund-observed");
    expect(projection.applications[0]).toMatchObject({ state: "reclaim-due", dueReason: "refund-observed" });
    expect(port.effects().reclaims).toBe(0);
  });
});

describe("marketing controller unknown outcomes", () => {
  it("a lost apply is unknown, fences the benefit, and a read does not lift it", async () => {
    const { controller, port } = await ready("apply-lost");
    const result = await controller.run(apply("ben-0002"));
    expect(result).toMatchObject({ kind: "UNKNOWN", intent: { code: "RESPONSE_LOST", outcome: "UNKNOWN" } });
    await controller.refresh();
    expect(codeOf(await controller.run(apply("ben-0002", "ord-0002")))).toBe("FENCED:unknown-outcome");
    expect(codeOf(await controller.run(reclaim("app-0001")))).toBe("FENCED:unknown-outcome");
    // The source did apply it. The page sees an application it does not claim as its own receipt.
    const projection = projectMarketing(controller.state());
    expect(projection.applications).toHaveLength(1);
    expect(projection.applications[0]?.linked).toBe(false);
    expect(projection.unlinkedIntents).toHaveLength(1);
    // Another benefit is not blocked by the unknown outcome of this one: it is sent, and in this scenario it is lost too.
    expect(codeOf(await controller.run(apply("ben-0004")))).toBe("UNKNOWN:RESPONSE_LOST");
    expect(port.effects().applies).toBe(2);
  });

  it("a lost reclaim is unknown and fences the benefit", async () => {
    const { controller } = await ready("reclaim-lost");
    await controller.run(apply("ben-0002"));
    await controller.refresh();
    expect((await controller.run(reclaim("app-0001"))).kind).toBe("UNKNOWN");
    await controller.refresh();
    expect(codeOf(await controller.run(apply("ben-0002", "ord-0002")))).toBe("FENCED:unknown-outcome");
  });

  it("an answer that claims a reward is not trusted: the write is unknown and fences the benefit", async () => {
    const { controller, port } = await ready("receipt-claims-reward");
    const result = await controller.run(apply("ben-0002"));
    expect(result).toMatchObject({ kind: "UNKNOWN", intent: { code: "CLAIM" } });
    expect(result.kind === "UNKNOWN" ? result.intent.message : "").toContain("may have been recorded");
    expect(result.kind === "UNKNOWN" ? result.intent.receipt : "x").toBeNull();
    await controller.refresh();
    expect(codeOf(await controller.run(apply("ben-0002", "ord-0002")))).toBe("FENCED:unknown-outcome");
    expect(port.effects().applies).toBe(1);
  });

  it("a thrown submit and a result for another intent are unknown, not rejected", async () => {
    const thrown = spyPort(createStubMarketingJourney(), { throwOnSubmit: true });
    const controller = new MarketingJourneyController(thrown.port, { actorRef: MARKETING_DESK_ACTOR, subjectRef: MARKETING_OWN_SUBJECT });
    await controller.refresh();
    expect(await controller.run(apply("ben-0002"))).toMatchObject({ kind: "UNKNOWN", intent: { code: "RESPONSE_LOST" } });
    expect(thrown.sent).toHaveLength(1);

    const crossed = spyPort(createStubMarketingJourney(), {
      rewrite: (outcome) => (outcome.kind === "confirmed" ? { ...outcome, intentRef: "some-other-intent" } : outcome),
    });
    const second = new MarketingJourneyController(crossed.port, { actorRef: MARKETING_DESK_ACTOR, subjectRef: MARKETING_OWN_SUBJECT });
    await second.refresh();
    expect(await second.run(apply("ben-0002"))).toMatchObject({ kind: "UNKNOWN", intent: { code: "CORRELATION" } });
  });

  it("a write the source denied or could not take is not sent and leaves no fence", async () => {
    const denied = spyPort(createStubMarketingJourney(), {
      rewrite: (outcome) => ({ kind: "denied", code: "GRANT_REVOKED", subjectRef: "sub-0001", detail: "withdrawn", step: "apply", intentRef: outcome.kind === "not-bound" ? "" : outcome.intentRef, contextKey: outcome.kind === "not-bound" ? "" : outcome.contextKey }),
    });
    const controller = new MarketingJourneyController(denied.port, { actorRef: MARKETING_DESK_ACTOR, subjectRef: MARKETING_OWN_SUBJECT });
    await controller.refresh();
    expect(codeOf(await controller.run(apply("ben-0002")))).toBe("NOT_SENT:denied");
    expect(controller.state().intents[0]).toMatchObject({ outcome: "DRAFT", code: "GRANT_REVOKED" });
    expect(controller.state().counters).toMatchObject({ sent: 1, notSent: 1 });
    // Not sent means the benefit is not blocked.
    expect(codeOf(await controller.run(apply("ben-0002")))).toBe("NOT_SENT:denied");
  });
});

describe("marketing controller contexts", () => {
  it("serialises writes on one benefit and quarantines a result that lands after a context switch", async () => {
    const { controller, port } = await ready("held-response");
    const first = controller.run(apply("ben-0002", "ord-0001"));
    await Promise.resolve();
    expect(controller.state().intents[0]?.outcome).toBe("IN_FLIGHT");
    expect(codeOf(await controller.run(apply("ben-0002", "ord-0002")))).toBe("FENCED:in-flight");
    // A different benefit is not held back by the in-flight one.
    const second = controller.run(apply("ben-0004", "ord-0001"));
    await Promise.resolve();
    expect(controller.state().counters.sent).toBe(2);

    controller.switchContext();
    expect(controller.state().intents.map((intent) => [intent.benefitRef, intent.outcome, intent.code])).toEqual([
      ["ben-0002", "UNKNOWN", "CONTEXT_SWITCHED"],
      ["ben-0004", "UNKNOWN", "CONTEXT_SWITCHED"],
    ]);
    expect(port.deliverHeld()).toBe(2);
    expect((await first).kind).toBe("QUARANTINED");
    expect((await second).kind).toBe("QUARANTINED");
    const state = controller.state();
    expect(state.quarantined).toHaveLength(2);
    expect(state.quarantined[0]).toMatchObject({ arrived: "confirmed", cause: "context-changed" });
    expect(state.intents.every((intent) => intent.receipt === null && intent.outcome === "UNKNOWN")).toBe(true);
    // The earlier unknown still blocks the benefit in the new context.
    await controller.refresh();
    const blocked = await controller.run(apply("ben-0002", "ord-0002"));
    expect(blocked).toMatchObject({ kind: "FENCED", fence: { reason: "unknown-outcome", earlierContext: true } });
  });

  it("serves another subject scope as denied, offers no write there, and keeps the earlier unknown counted on return", async () => {
    const { controller } = await ready("apply-lost");
    await controller.run(apply("ben-0002"));
    controller.switchContext({ subjectRef: MARKETING_FOREIGN_SUBJECT });
    expect(controller.state()).toMatchObject({ readState: "none", snapshot: null, refreshRequired: "context-switch" });
    await controller.refresh();
    expect(controller.state()).toMatchObject({ readState: "denied", readCode: "SCOPE_DENIED", snapshot: null });
    expect(codeOf(await controller.run(apply("ben-0001")))).toBe("FENCED:snapshot-stale");
    controller.switchContext({ subjectRef: MARKETING_OWN_SUBJECT });
    await controller.refresh();
    expect(controller.state().readState).toBe("ready");
    expect(codeOf(await controller.run(apply("ben-0002", "ord-0002")))).toBe("FENCED:unknown-outcome");
    expect(controller.state().context.incarnation).toBe(3);
  });

  it("a rejected write leaves the benefit free for a later write after a read", async () => {
    const { controller, port } = await ready();
    port.simulate({ control: "withdraw-consent" });
    await controller.run(apply("ben-0001"));
    await controller.refresh();
    port.simulate({ control: "grant-consent" });
    port.simulate({ control: "authorize-marketing" });
    await controller.refresh();
    expect((await controller.run(apply("ben-0001"))).kind).toBe("CONFIRMED");
  });
});

describe("marketing controller source", () => {
  it("never sends a consent command, a message, or a money posting from the controller", () => {
    const source = readFileSync(path.join(here, "../src/marketing-journey-controller.ts"), "utf8");
    for (const token of ["set_consent", "authorize_marketing", "invokeLocalCall", "fetch(", "localStorage", "sessionStorage"]) {
      expect(source, token).not.toContain(token);
    }
  });
});
