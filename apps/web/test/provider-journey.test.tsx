import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  COMMERCE_COMMAND_BINDINGS,
  DISCOVERY_READ_TUPLE_LITERALS,
  PROVIDER_DESK_ACTOR,
  PROVIDER_FACETS,
  PROVIDER_GUEST_ACTOR,
  PROVIDER_NOT_BOUND_REASON,
  PROVIDER_SCENARIOS,
  ProviderJourneyController,
  createNotBoundProviderJourney,
  createStubProviderJourney,
  type ProviderFence,
  type ProviderScenario,
  type ProviderStepInput,
  type ProviderStepResult,
  type StubProviderJourney,
} from "@kix/protocol-adapter";
import { CONTRACT_FIXTURES, fixturesForScreen } from "../../../packages/protocol-adapter/src/contract-fixtures";
import { App } from "../src/App";
import { PENDING_PRODUCERS } from "../src/handoff/packet";
import {
  SCENARIO_NOTES,
  buildProviderModel,
  fenceLine,
  stepResultLine,
  type LastAction,
  type ProviderActions,
  type ProviderModel,
} from "../src/provider-journey";
import {
  IdentitySection,
  OrdersSection,
  ProviderBanner,
  ProviderControls,
  ProviderStatus,
  SessionSection,
} from "../src/pages/ProviderJourneyPanels";
import { BUYER_FLOW_STAGES, WORKSPACE_RULING, WORKSPACE_SURFACES } from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

const BANNED = /[$₩]|KRW|USD|still open|in stock/i;

/** Wording that would turn an observation or a synthetic write into a decision. None may appear on screen. */
const POSITIVE_CLAIMS = [
  "Payment complete",
  "Payment received",
  "Payment captured",
  "Purchased",
  "Booked for you",
  "You own",
  "You now own",
  "Ticket issued",
  "Right issued",
  "Refund complete",
  "Refunded",
  "Settled",
  "Completed",
];

const NO_ACTIONS: ProviderActions = {
  refresh() {},
  begin() {},
  observe() {},
  issue() {},
  refund() {},
  landReturn() {},
  deliverReport() {},
  abandon() {},
  deliverHeld() {},
  deliverLate() {},
  switchContext() {},
  newSession() {},
  setScenario() {},
};

function html(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element);
}

function pageHtml(
  model: ProviderModel,
  scenario: ProviderScenario = "clean",
  environment: "stub" | "integration-http" = "stub",
): string {
  return html(
    <MemoryRouter>
      <ProviderBanner environment={environment} scenario={scenario} model={model} />
      <ProviderControls
        scenario={scenario}
        heldSupported={scenario === "held-response"}
        lateSupported={scenario === "observe-late"}
        actions={NO_ACTIONS}
      />
      <ProviderStatus model={model} />
      <OrdersSection model={model} actions={NO_ACTIONS} />
      <SessionSection session={model.session} />
      <IdentitySection rows={model.identity} />
    </MemoryRouter>,
  );
}

function expectClean(markup: string): void {
  expect(markup).not.toMatch(BANNED);
  for (const claim of POSITIVE_CLAIMS) {
    expect(markup, claim).not.toContain(claim);
  }
}

interface Rig {
  port: StubProviderJourney;
  controller: ProviderJourneyController;
  last: LastAction | null;
  seq: number;
  intent: number;
}

function rig(scenario: ProviderScenario = "clean"): Rig {
  const port = createStubProviderJourney({ scenario });
  return { port, controller: new ProviderJourneyController(port, { actorRef: PROVIDER_DESK_ACTOR }), last: null, seq: 0, intent: 0 };
}

type StepNoIntent =
  | Omit<Extract<ProviderStepInput, { step: "begin" }>, "intentRef">
  | Omit<Extract<ProviderStepInput, { step: "observe" }>, "intentRef">
  | Omit<Extract<ProviderStepInput, { step: "issue" }>, "intentRef">
  | Omit<Extract<ProviderStepInput, { step: "refund" }>, "intentRef">;

async function step(r: Rig, input: StepNoIntent, options: { read?: boolean } = {}): Promise<ProviderStepResult> {
  r.intent += 1;
  const withIntent = { ...input, intentRef: `intent-${r.intent}` } as ProviderStepInput;
  const result = await r.controller.run(withIntent);
  r.seq += 1;
  r.last = { seq: r.seq, kind: "step", step: input.step, result };
  if (options.read !== false && result.kind !== "FENCED" && result.kind !== "NOT_SENT") {
    await r.controller.refresh();
  }
  return result;
}

function modelOf(r: Rig): ProviderModel {
  return buildProviderModel({ controller: r.controller, last: r.last });
}

function checkoutRefOf(result: ProviderStepResult): string {
  if (result.kind !== "CONFIRMED" || !result.intent.refs?.checkoutRef) {
    throw new Error(`expected a confirmed begin, received ${result.kind}`);
  }
  return result.intent.refs.checkoutRef;
}

describe("provider screen states", () => {
  it("shows loading before the first read, with a word for it and no rows", () => {
    const r = rig();
    const model = modelOf(r);
    expect(model.state).toBe("loading");
    const markup = pageHtml(model);
    expect(markup).toContain('data-provider-state="loading"');
    expect(markup).toContain('data-status-mark="loading"');
    expect(markup).toContain("Reading the synthetic provider desk. Nothing is confirmed yet.");
    expect(markup).not.toContain("data-order=");
    expect(markup).toContain("No order in this read. Begin a checkout to open one.");
    expectClean(markup);
  });

  it("shows two sandbox orders and the environment and account verdicts after a read", async () => {
    const r = rig();
    await r.controller.refresh();
    const model = modelOf(r);
    expect(model.state).toBe("ready");
    expect(model.orders.map((order) => order.orderRef)).toEqual(["ord-0001", "ord-0002"]);
    expect(model.orders[1]?.amountWord).toContain("UNDETERMINED");
    const markup = pageHtml(model);
    expect(markup).toContain('data-provider-state="ready"');
    expect(markup).toContain('data-source="synthetic-provider"');
    expect(markup).toContain("SYNTHETIC");
    expect(markup).toContain("Environment sandbox");
    expect(markup).toContain("qualification sandbox-qualified");
    expect(markup).toContain("Begin checkout");
    expect(markup).toContain('data-enabled="true"');
    // Issue and refund wait on an observed payment even on a clean read.
    expect(model.orders[0]?.issue.enabled).toBe(false);
    expect(model.orders[0]?.issue.reason).toContain("Nothing to issue against");
    expectClean(markup);
  });

  it("separates empty, stale, refused, declared-production, unavailable, changed tuple, and not-bound", async () => {
    const empty = rig("empty");
    await empty.controller.refresh();
    expect(modelOf(empty)).toMatchObject({ state: "empty", actionLabel: "Read again" });
    expect(pageHtml(modelOf(empty), "empty")).toContain("No orders in this synthetic session.");

    const stale = rig("stale");
    await stale.controller.refresh();
    expect(modelOf(stale)).toMatchObject({ state: "stale", actionLabel: "Read again" });
    expect(modelOf(stale).detailLine).toContain("older than the floor");

    const claimed = rig("claims-real");
    await claimed.controller.refresh();
    const claimedModel = modelOf(claimed);
    expect(claimedModel).toMatchObject({ state: "refused", actionLabel: "Start a new synthetic session" });
    expect(claimedModel.detailLine).toContain("realPayment");
    expect(pageHtml(claimedModel, "claims-real")).toContain("refused whole before any row was shown");
    expect(pageHtml(claimedModel, "claims-real")).not.toContain("data-order=");

    const production = rig("production-claimed");
    await production.controller.refresh();
    const prodModel = modelOf(production);
    expect(prodModel).toMatchObject({ state: "environment-refused", actionLabel: "Start a new synthetic session" });
    expect(pageHtml(prodModel, "production-claimed")).toContain("declares a production environment");

    const changed = new ProviderJourneyController(
      createStubProviderJourney({ expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, domain: "kix:other" } }),
      { actorRef: PROVIDER_DESK_ACTOR },
    );
    await changed.refresh();
    const changedModel = buildProviderModel({ controller: changed, last: null });
    expect(changedModel).toMatchObject({ state: "tuple-changed", actionLabel: "Start a new synthetic session" });
    expect(pageHtml(changedModel)).toContain("Nothing was read and nothing was applied.");

    const broken = new ProviderJourneyController(
      {
        environment: "stub",
        source: "synthetic-provider",
        scenario: "clean",
        read: async () => {
          throw new Error("source lost");
        },
        submit: async () => ({ kind: "not-bound", reason: "x" }),
        deliverReturn: () => null,
        deliverCallback: () => null,
        markAbandoned: () => null,
        deliverHeld: () => 0,
        deliverLate: () => [],
      },
      { actorRef: PROVIDER_DESK_ACTOR },
    );
    await broken.refresh();
    const brokenModel = buildProviderModel({ controller: broken, last: null });
    expect(brokenModel.state).toBe("unavailable");
    expect(pageHtml(brokenModel)).toContain("This is not an empty desk.");
    expect(pageHtml(brokenModel)).toContain("source lost");
  });

  it("renders integration-http as not-bound with no stub switch, no row, and every write off", async () => {
    const controller = new ProviderJourneyController(createNotBoundProviderJourney(), { actorRef: PROVIDER_DESK_ACTOR });
    await controller.refresh();
    const model = buildProviderModel({ controller, last: null });
    expect(model.state).toBe("not-bound");
    expect(model.statusLine).toBe(PROVIDER_NOT_BOUND_REASON);
    expect(model.orders).toEqual([]);
    const markup = pageHtml(model, "clean", "integration-http");
    expect(markup).toContain('data-adapter-environment="integration-http"');
    expect(markup).toContain(PROVIDER_NOT_BOUND_REASON);
    expect(markup).not.toContain("data-order=");
    expect(markup).not.toContain("Begin checkout");
    expect(markup).not.toContain("fall back");
    expectClean(markup);
  });
});

describe("provider controls and fences", () => {
  it("keeps an off control focusable, names the reason, and links the two", async () => {
    const r = rig("held-response");
    await r.controller.refresh();
    const pending = r.controller.run({ step: "begin", intentRef: "held-begin", orderRef: "ord-0001" });
    const model = modelOf(r);
    const markup = pageHtml(model, "held-response");
    expect(markup).toContain('id="provider-begin-ord-0001"');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('aria-describedby="provider-begin-ord-0001-reason"');
    expect(markup).toContain('id="provider-begin-ord-0001-reason"');
    expect(markup).toContain("Another write on this order is in flight (held-begin). Wait for its answer.");
    expect(markup).not.toMatch(/<button[^>]*\sdisabled/);
    // The other order is a different scope and stays on.
    expect(model.orders[1]?.begin).toEqual({ enabled: true, reason: null });
    r.port.deliverHeld();
    await pending;
  });

  it("maps every fence to one distinct sentence", () => {
    const fences: ProviderFence[] = [
      { reason: "in-flight", intentRef: "i-1" },
      { reason: "unknown-outcome", intentRef: "i-1", lateRecorded: false, earlierContext: false },
      { reason: "unknown-outcome", intentRef: "i-1", lateRecorded: true, earlierContext: true },
      { reason: "no-snapshot" },
      { reason: "snapshot-stale", cause: "own-write" },
      { reason: "snapshot-stale", cause: "stale-rejection" },
      { reason: "snapshot-stale", cause: "context-switch" },
      { reason: "duplicate-intent", intentRef: "i-1" },
      { reason: "environment" },
      { reason: "account-unqualified", actorRef: PROVIDER_GUEST_ACTOR },
      { reason: "payment-unobserved", orderRef: "ord-0001" },
      { reason: "not-bound" },
    ];
    const lines = fences.map(fenceLine);
    expect(new Set(lines).size).toBe(fences.length);
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(10);
      expect(line).not.toMatch(BANNED);
    }
    expect(lines[1]).toContain("A read does not resolve it.");
    expect(lines[2]).toContain("A late result was recorded, and it does not make the write known.");
    expect(lines[2]).toContain("earlier session context");
    expect(lines[9]).toContain("not qualified for the sandbox");
    expect(lines[10]).toContain("A return landing alone does not unlock");
  });

  it("words every result kind and never calls a lost result a rejection or a success", async () => {
    const r = rig("begin-lost");
    await r.controller.refresh();
    const lost = await step(r, { step: "begin", orderRef: "ord-0001" });
    const line = stepResultLine("begin", lost);
    expect(line).toContain("result unknown");
    expect(line).toContain("may or may not have applied");
    expect(line).not.toMatch(/rejected|confirmed/);
    const fenced = await step(r, { step: "begin", orderRef: "ord-0001" });
    expect(stepResultLine("begin", fenced)).toContain("Begin checkout not sent.");
    const ok = rig();
    await ok.controller.refresh();
    const confirmed = await step(ok, { step: "begin", orderRef: "ord-0001" });
    expect(stepResultLine("begin", confirmed)).toBe(
      "Begin checkout confirmed by the synthetic source. This is not a provider receipt and not a real payment.",
    );
  });
});

describe("a return landing is never a payment observation", () => {
  it("shows the return line landed while payment, issuance, and refund stay unobserved and unfenced-free", async () => {
    const r = rig("return-only");
    await r.controller.refresh();
    const checkoutRef = checkoutRefOf(await step(r, { step: "begin", orderRef: "ord-0001" }));
    r.port.deliverReturn(checkoutRef);
    await r.controller.refresh();
    const model = modelOf(r);
    const view = model.orders.find((order) => order.orderRef === "ord-0001");
    expect(view?.shape).toBe("returned-unobserved");
    expect(view?.facets.map((facet) => facet.facet)).toEqual([...PROVIDER_FACETS]);
    expect(view?.facets.map((facet) => [facet.writeKind, facet.observedKind])).toEqual([
      ["confirmed", "returned"],
      ["not-bound", "landed"],
      ["none", "pending"],
      ["none", "not-observed"],
      ["none", "not-observed"],
    ]);
    // The observe write is sent and rejected pending; issuance and refund stay fenced.
    const early = await step(r, { step: "observe", checkoutRef });
    expect(early).toMatchObject({ kind: "REJECTED", intent: { code: "PAYMENT_PENDING" } });
    await r.controller.refresh();
    const after = modelOf(r).orders.find((order) => order.orderRef === "ord-0001");
    expect(after?.issue.enabled).toBe(false);
    expect(after?.issue.reason).toContain("A return landing alone does not unlock");
    expect(after?.refund.enabled).toBe(false);
    const markup = pageHtml(modelOf(r), "return-only");
    expect(markup).toContain("A return landing is recorded. It is not a payment observation.");
    expect(markup).toContain("Returned, and no provider report is recorded.");
    expect(markup).toContain('data-facet="payment"');
    expect(markup).not.toMatch(/data-write="confirmed"[^>]*data-facet="payment"/);
    expect(r.port.effects().observations).toBe(0);
    expectClean(markup);
  });

  it("the full chain links five lines by receipt and none claims a real payment, right, or refund", async () => {
    const r = rig();
    await r.controller.refresh();
    const checkoutRef = checkoutRefOf(await step(r, { step: "begin", orderRef: "ord-0001" }));
    r.port.deliverReturn(checkoutRef);
    r.port.deliverCallback(checkoutRef);
    await r.controller.refresh();
    await step(r, { step: "observe", checkoutRef });
    await step(r, { step: "issue", checkoutRef });
    await step(r, { step: "refund", orderRef: "ord-0001" });
    const model = modelOf(r);
    const view = model.orders.find((order) => order.orderRef === "ord-0001");
    expect(view?.shape).toBe("refund-recorded");
    expect(view?.linked).toBe(true);
    expect(view?.facets.map((facet) => facet.writeKind)).toEqual(["confirmed", "not-bound", "confirmed", "confirmed", "confirmed"]);
    expect(view?.identities.map((item) => [item.kind, item.ref])).toEqual([
      ["order", "ord-0001"],
      ["checkout", "cko-0001"],
      ["return", "ret-0001"],
      ["callback", "cbk-0001"],
      ["payment", "psp-0001"],
      ["issuance", "iss-0001"],
      ["right", "rgt-0001"],
      ["refund", "rfd-0001"],
    ]);
    const markup = pageHtml(model);
    expect(markup).toContain('data-shape="refund-recorded"');
    expect(markup).toContain("Linked to a confirmed begin of this page.");
    expect(markup).toContain("It executes no return of funds.");
    expect(markup).toContain("grants no admission authority");
    expect(r.port.effects()).toMatchObject({ begins: 1, observations: 1, issues: 1, refunds: 1 });
    expectClean(markup);
  });

  it("an abandoned checkout stays closed and nothing is observed, issued, or refunded", async () => {
    const r = rig();
    await r.controller.refresh();
    const checkoutRef = checkoutRefOf(await step(r, { step: "begin", orderRef: "ord-0001" }));
    r.port.markAbandoned(checkoutRef);
    await r.controller.refresh();
    const observed = await step(r, { step: "observe", checkoutRef });
    expect(observed).toMatchObject({ kind: "REJECTED", intent: { code: "CHECKOUT_ABANDONED" } });
    const model = modelOf(r);
    const view = model.orders.find((order) => order.orderRef === "ord-0001");
    expect(view?.shape).toBe("abandoned");
    const markup = pageHtml(model);
    expect(markup).toContain('data-shape="abandoned"');
    expect(markup).toContain("The provider closed the checkout after the buyer left.");
    expect(markup).toContain("Nothing was paid, issued, or refunded.");
    expect(r.port.effects().observations).toBe(0);
    expectClean(markup);
  });

  it("drops the report and abandon controls once the provider report lands, and vice versa", async () => {
    const r = rig();
    await r.controller.refresh();
    const checkoutRef = checkoutRefOf(await step(r, { step: "begin", orderRef: "ord-0001" }));
    r.port.deliverReturn(checkoutRef);
    await r.controller.refresh();
    // While the report is still pending the page offers both source events.
    let view = modelOf(r).orders.find((order) => order.orderRef === "ord-0001");
    expect(view?.events.map((item) => item.id)).toEqual(["callback", "abandon"]);
    let markup = pageHtml(modelOf(r));
    expect(markup).toContain('id="provider-event-callback-ord-0001"');
    expect(markup).toContain('id="provider-event-abandon-ord-0001"');

    // Once the report is recorded the checkout is decided: neither control shows
    // and the source refuses a late abandonment.
    r.port.deliverCallback(checkoutRef);
    await r.controller.refresh();
    view = modelOf(r).orders.find((order) => order.orderRef === "ord-0001");
    expect(view?.events).toEqual([]);
    markup = pageHtml(modelOf(r));
    expect(markup).not.toContain("provider-event-callback");
    expect(markup).not.toContain("provider-event-abandon");
    expect(r.port.markAbandoned(checkoutRef)).toBeNull();
    expectClean(markup);

    // The other direction: abandoned while pending shows neither control and a
    // report delivered afterwards applies nothing.
    const left = rig();
    await left.controller.refresh();
    const leftRef = checkoutRefOf(await step(left, { step: "begin", orderRef: "ord-0001" }));
    left.port.deliverReturn(leftRef);
    left.port.markAbandoned(leftRef);
    await left.controller.refresh();
    view = modelOf(left).orders.find((order) => order.orderRef === "ord-0001");
    expect(view?.shape).toBe("abandoned");
    expect(view?.events).toEqual([]);
    expect(left.port.deliverCallback(leftRef)).toBeNull();
  });

  it("a declined provider report reads as a decline, never as success", async () => {
    const r = rig("declined");
    await r.controller.refresh();
    const checkoutRef = checkoutRefOf(await step(r, { step: "begin", orderRef: "ord-0001" }));
    r.port.deliverReturn(checkoutRef);
    r.port.deliverCallback(checkoutRef);
    await r.controller.refresh();
    const observed = await step(r, { step: "observe", checkoutRef });
    expect(observed).toMatchObject({ kind: "REJECTED", intent: { code: "PAYMENT_DECLINED" } });
    const model = modelOf(r);
    const view = model.orders.find((order) => order.orderRef === "ord-0001");
    expect(view?.shape).toBe("payment-declined");
    const markup = pageHtml(model, "declined");
    expect(markup).toContain("The provider reported a decline.");
    expect(markup).toContain("Rejected (PAYMENT_DECLINED).");
    expect(r.port.effects()).toMatchObject({ issues: 0, refunds: 0 });
    expectClean(markup);
  });

  it("an unqualified actor fences every write before any send and says why", async () => {
    const r = rig("unqualified");
    await r.controller.refresh();
    const model = modelOf(r);
    expect(model.orders[0]?.begin.enabled).toBe(false);
    expect(model.orders[0]?.begin.reason).toContain("not qualified for the sandbox");
    const markup = pageHtml(model, "unqualified");
    expect(markup).toContain("qualification unqualified");
    expect(markup).toContain("Without a test account and provider qualification every write is synthetic and fenced.");
    expect(r.port.effects().begins).toBe(0);
    expectClean(markup);
  });
});

describe("unknown and late results", () => {
  it("a lost begin blocks every write on its order, links no order to itself, and leaves the other order open", async () => {
    const r = rig("begin-lost");
    await r.controller.refresh();
    const lost = await step(r, { step: "begin", orderRef: "ord-0001" });
    expect(lost.kind).toBe("UNKNOWN");
    const again = await step(r, { step: "begin", orderRef: "ord-0001" });
    expect(again.kind).toBe("FENCED");
    await r.controller.refresh();
    const model = modelOf(r);
    expect(model.orders.find((order) => order.orderRef === "ord-0001")?.begin.enabled).toBe(false);
    expect(model.orders.find((order) => order.orderRef === "ord-0002")?.begin.enabled).toBe(true);
    // The unknown fence covers its own order only; the other order is a different scope.
    expect(model.session.unlinkedLines).toHaveLength(1);
    expect(model.session.unlinkedLines[0]).toContain("No order row is linked to it");
    expect(model.orders.find((order) => order.orderRef === "ord-0001")).toMatchObject({ linked: false });
    const markup = pageHtml(model, "begin-lost");
    expect(markup).toContain("An earlier write on this order has an unknown result (intent-1).");
    expect(markup).toContain('data-unlinked="true"');
    expect(markup).toContain('data-outcome="UNKNOWN"');
    expect(r.port.effects()).toMatchObject({ submits: 1, begins: 1 });
    expectClean(markup);
  });

  it("a late result is shown as evidence on an unknown write and does not open the order", async () => {
    const r = rig("observe-late");
    await r.controller.refresh();
    const checkoutRef = checkoutRefOf(await step(r, { step: "begin", orderRef: "ord-0001" }));
    r.port.deliverReturn(checkoutRef);
    r.port.deliverCallback(checkoutRef);
    await r.controller.refresh();
    const unknown = await step(r, { step: "observe", checkoutRef });
    expect(unknown.kind).toBe("UNKNOWN");
    for (const delivery of r.port.deliverLate()) {
      r.controller.acceptLate(delivery);
    }
    await r.controller.refresh();
    const model = modelOf(r);
    const view = model.orders.find((order) => order.orderRef === "ord-0001");
    expect(view?.shape).toBe("unknown-effect");
    const payment = view?.facets.find((facet) => facet.facet === "payment");
    expect(payment).toMatchObject({ writeKind: "unknown", observedKind: "observed" });
    expect(payment?.writeWord).toContain("A late result is recorded.");
    expect(view?.issue.enabled).toBe(false);
    expect(view?.issue.reason).toContain("A late result was recorded, and it does not make the write known.");
    const markup = pageHtml(model, "observe-late");
    expect(markup).toContain("Late result confirmed. Evidence only.");
    expect(markup).toContain('data-outcome="UNKNOWN"');
    expect(markup).toContain('id="provider-deliver-late"');
    expectClean(markup);
  });
});

describe("stale session", () => {
  it("a result from an earlier session context is quarantined and the order stays blocked in the new one", async () => {
    const r = rig("held-response");
    await r.controller.refresh();
    const pending = r.controller.run({ step: "begin", intentRef: "held-begin", orderRef: "ord-0001" });
    r.controller.switchContext({ actorRef: PROVIDER_GUEST_ACTOR });
    r.port.deliverHeld();
    const result = await pending;
    r.last = { seq: 1, kind: "step", step: "begin", result };
    const unread = modelOf(r);
    expect(result.kind).toBe("QUARANTINED");
    expect(unread.state).toBe("unread");
    expect(unread.actionLabel).toBe("Read again");
    expect(unread.lastLine).toContain("arrived after the session context changed");
    const unreadMarkup = pageHtml(unread, "held-response");
    expect(unreadMarkup).toContain("The session context changed, so there is no read in this context.");
    expect(unreadMarkup).toContain('data-quarantined="true"');
    expect(unreadMarkup).toContain("Actor provider-guest, session 2, mode stub.");
    expect(unreadMarkup).toContain("CONTEXT_SWITCHED");
    expect(unreadMarkup).not.toContain("data-order=");

    // A guest actor reads unqualified; switching back to the desk actor keeps the unknown fence.
    r.controller.switchContext({ actorRef: PROVIDER_DESK_ACTOR });
    await r.controller.refresh();
    const model = modelOf(r);
    expect(model.state).toBe("ready");
    expect(model.orders.find((order) => order.orderRef === "ord-0001")?.begin.reason).toContain(
      "It was sent in an earlier session context.",
    );
    expect(model.orders.find((order) => order.orderRef === "ord-0002")?.begin.enabled).toBe(true);
    expect(model.orders.every((order) => !order.linked)).toBe(true);
    expectClean(pageHtml(model, "held-response"));
  });

  it("asks for a fresh read after the source says the last one was behind", async () => {
    const r = rig();
    await r.controller.refresh();
    const checkoutRef = checkoutRefOf(await step(r, { step: "begin", orderRef: "ord-0001" }));
    // The checkout moves after the read, so the observe is built on an old version.
    r.port.deliverReturn(checkoutRef);
    const rejected = await step(r, { step: "observe", checkoutRef }, { read: false });
    expect(rejected).toMatchObject({ kind: "REJECTED", intent: { code: "VERSION_STALE" } });
    const model = modelOf(r);
    expect(model.freshnessWord).toBe("The last read is behind.");
    expect(model.orders[0]?.begin.reason).toBe("Read again before the next write. The source said the last read was behind.");
    await r.controller.refresh();
    expect(modelOf(r).freshnessWord).toBe("The last read is current.");
  });
});

describe("provider screen as mounted", () => {
  it("mounts on /provider in the loading state with the banner, rulings, and the not-bound hold record", () => {
    const markup = html(
      <MemoryRouter initialEntries={["/provider"]}>
        <App />
      </MemoryRouter>,
    );
    expect(markup).toContain("Provider checkout journey (synthetic)");
    expect(markup).toContain('href="/provider"');
    expect(markup).toContain('data-status-mark="loading"');
    expect(markup).toContain(WORKSPACE_RULING);
    expect(markup).toContain(COMMERCE_COMMAND_BINDINGS.placeHold.reason);
    expect(markup).toContain('data-hold-record="not-bound"');
    expect(markup).toContain("reserve_listing");
    expect(markup).toContain('data-source="synthetic-provider"');
    expect(markup).toContain('data-adapter-environment="stub"');
    expect(markup).toContain("A return landing is not a payment observation");
    expect(markup).not.toMatch(BANNED);
  });

  it("offers every scenario with a note, keyboard-reachable controls, and no positive tab order", () => {
    const markup = html(
      <MemoryRouter initialEntries={["/provider"]}>
        <App />
      </MemoryRouter>,
    );
    for (const scenario of PROVIDER_SCENARIOS) {
      expect(markup).toContain(`<option value="${scenario}"`);
      expect(SCENARIO_NOTES[scenario].length).toBeGreaterThan(10);
    }
    expect(markup).toContain('for="provider-scenario"');
    expect(markup).toContain('id="provider-refresh"');
    expect(markup).toContain('id="provider-switch"');
    expect(markup).toContain('id="provider-new-session"');
    expect(markup).toContain('id="provider-status"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).not.toMatch(/tabindex="[1-9]/);
    expect(markup).toContain('aria-label="Provider sections"');
  });
});

describe("registration", () => {
  it("is one stub-only buyer surface with no sender, no action, and no desk method", () => {
    const surface = WORKSPACE_SURFACES.find((item) => item.id === "provider-connected-journey");
    expect(surface).toMatchObject({
      role: "buyer",
      route: "/provider",
      binding: "stub-only",
      sender: null,
      taskId: "c-provider-connected-journey-stub",
      implemented: true,
      pageControl: true,
    });
    expect(surface?.actions).toEqual([]);
    expect(surface?.deskMethods).toEqual([]);
    expect(surface?.provenanceNote).toContain("integration-http");
    expect(surface?.provenanceNote).not.toMatch(/\bworks\b|live payment|funds moved|disbursed|payment complete|admission complete|refund complete/i);
    for (const id of ["payment", "issuance", "refund"]) {
      expect(BUYER_FLOW_STAGES.find((stage) => stage.id === id)?.surfaces).toContain("provider-connected-journey");
    }
  });

  it("is recorded in the handoff packet as a pending producer that is not connected", () => {
    const row = PENDING_PRODUCERS.find((item) => item.id === "c-provider-connected-journey");
    expect(row).toMatchObject({ catalogue: "pending", connected: false, implementedHere: false, waitingSurface: "provider-connected-journey" });
    const pending = JSON.parse(readFileSync(path.join(repoRoot, "docs/aiops/PENDING_NODES.json"), "utf8")) as { nodes: { id: string }[] };
    const ids = new Set(pending.nodes.map((node) => node.id));
    expect(ids.has("c-provider-connected-journey")).toBe(true);
  });

  it("has ten synthetic fixture rows that own no pass and cover reject, unknown, and stale", () => {
    const rows = fixturesForScreen("provider-connected-journey");
    expect(rows.map((row) => row.id)).toEqual([
      "provider-connected-journey.provider-error",
      "provider-connected-journey.account-unqualified",
      "provider-connected-journey.return-not-observed",
      "provider-connected-journey.abandoned",
      "provider-connected-journey.environment-refused",
      "provider-connected-journey.claim-refused",
      "provider-connected-journey.write-lost",
      "provider-connected-journey.late-callback",
      "provider-connected-journey.stale-read",
      "provider-connected-journey.stale-session",
    ]);
    expect(new Set(rows.map((row) => row.klass))).toEqual(new Set(["REJECT", "UNKNOWN", "STALE"]));
    for (const row of rows) {
      expect(row.ownsPass).toBe(false);
      expect(row.source).toBe("synthetic-fixture");
      expect(row.klass).not.toBe("SUCCESS");
      expect(row.substituteStub).toBe(false);
    }
    expect(CONTRACT_FIXTURES.filter((row) => row.screenId === "provider-connected-journey" && row.klass === "NOT_BOUND")).toEqual([]);
  });

  it("keeps the new screen free of sends, clocks, timers, and the capture and hold vocabulary", () => {
    const files = ["src/provider-journey.ts", "src/pages/ProviderJourney.tsx", "src/pages/ProviderJourneyPanels.tsx"];
    const combined = files.map((file) => readFileSync(path.join(webRoot, file), "utf8")).join("\n");
    for (const token of [
      "fetch(",
      "XMLHttpRequest",
      "WebSocket",
      "EventSource",
      "sendBeacon",
      "invokeLocalCall",
      ".send(",
      "/health",
      "/ready",
      "127.0.0.1",
      "capture",
      "settle_capture",
      "commit_trade",
      "fallback",
      "Date.now(",
      "new Date(",
      "Math.random(",
      "setInterval",
      "setTimeout",
      "requestAnimationFrame",
      "placeHold",
      "Idempotency-Key",
      "retry",
      "contract-fixtures",
      "localStorage",
      "sessionStorage",
    ]) {
      expect(combined, token).not.toContain(token);
    }
    const css = readFileSync(path.join(webRoot, "src/styles.css"), "utf8");
    expect(css).toContain(".provider");
    expect(css).not.toContain("@keyframes");
    expect(css).not.toMatch(/animation\s*:/);
  });

  it("names the surface in the docs and the README", () => {
    const doc = readFileSync(path.join(repoRoot, "docs/c-provider-connected-journey-stub-apps-bind.md"), "utf8");
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    expect(doc).toContain(WORKSPACE_RULING);
    expect(doc).toContain("provider-connected-journey");
    expect(doc).toContain("Browser run");
    expect(readme).toContain("docs/c-provider-connected-journey-stub-apps-bind.md");
    expect(readme).toContain("/provider");
  });
});
