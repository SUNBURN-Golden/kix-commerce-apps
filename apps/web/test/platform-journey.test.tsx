import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  COMMERCE_COMMAND_BINDINGS,
  DISCOVERY_READ_TUPLE_LITERALS,
  PLATFORM_COMPENSATION_UNDEFINED,
  PLATFORM_FACETS,
  PLATFORM_NOT_BOUND_REASON,
  PLATFORM_SCENARIOS,
  PlatformJourneyController,
  createNotBoundPlatformJourney,
  createStubPlatformJourney,
  type PlatformFence,
  type PlatformScenario,
  type PlatformStepInput,
  type PlatformStepResult,
  type StubPlatformJourney,
} from "@kix/protocol-adapter";
import {
  CONTRACT_FIXTURES,
  fixturesForScreen,
} from "../../../packages/protocol-adapter/src/contract-fixtures";
import { App } from "../src/App";
import { PENDING_PRODUCERS } from "../src/handoff/packet";
import {
  PLATFORM_ALT_ACTOR,
  SCENARIO_NOTES,
  buildPlatformModel,
  fenceLine,
  stepResultLine,
  type LastAction,
  type PlatformActions,
  type PlatformModel,
} from "../src/platform-journey";
import {
  IdentitySection,
  PlatformBanner,
  PlatformControls,
  PlatformStatus,
  RightsSection,
  SessionSection,
  TradesSection,
} from "../src/pages/PlatformPanels";
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
  "Transfer complete",
  "Refund complete",
  "Refunded",
  "Settled",
  "Completed",
];

const NO_ACTIONS: PlatformActions = {
  refresh() {},
  book() {},
  transfer() {},
  reprice() {},
  setScenario() {},
  deliverHeld() {},
  deliverLate() {},
  switchContext() {},
  newSession() {},
};

function html(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element);
}

function pageHtml(model: PlatformModel, scenario: PlatformScenario = "clean", environment: "stub" | "integration-http" = "stub"): string {
  return html(
    <MemoryRouter>
      <PlatformBanner environment={environment} scenario={scenario} model={model} />
      <PlatformControls scenario={scenario} heldSupported={scenario === "held-response"} lateSupported={scenario === "transfer-late"} actions={NO_ACTIONS} />
      <PlatformStatus model={model} />
      <RightsSection model={model} actions={NO_ACTIONS} />
      <TradesSection model={model} actions={NO_ACTIONS} />
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
  port: StubPlatformJourney;
  controller: PlatformJourneyController;
  last: LastAction | null;
  seq: number;
  intent: number;
}

function rig(scenario: PlatformScenario = "clean"): Rig {
  const port = createStubPlatformJourney({ scenario });
  return { port, controller: new PlatformJourneyController(port, { actorRef: "platform-desk" }), last: null, seq: 0, intent: 0 };
}

async function step(
  r: Rig,
  input: Omit<Extract<PlatformStepInput, { step: "book" }>, "intentRef"> | Omit<Extract<PlatformStepInput, { step: "transfer" }>, "intentRef"> | Omit<Extract<PlatformStepInput, { step: "reprice" }>, "intentRef">,
  options: { read?: boolean } = {},
): Promise<PlatformStepResult> {
  r.intent += 1;
  const withIntent = { ...input, intentRef: `intent-${r.intent}` } as PlatformStepInput;
  const result = await r.controller.run(withIntent);
  r.seq += 1;
  r.last = { seq: r.seq, kind: "step", step: input.step, result };
  if (options.read !== false && result.kind !== "FENCED" && result.kind !== "NOT_SENT") {
    await r.controller.refresh();
  }
  return result;
}

function modelOf(r: Rig): PlatformModel {
  return buildPlatformModel({ controller: r.controller, last: r.last });
}

function tradeRefOf(result: PlatformStepResult): string {
  if (result.kind !== "CONFIRMED" || !result.intent.refs?.tradeRef) {
    throw new Error(`expected a confirmed booking, received ${result.kind}`);
  }
  return result.intent.refs.tradeRef;
}

function countOf(markup: string, needle: string): number {
  return markup.split(needle).length - 1;
}

describe("platform screen states", () => {
  it("shows loading before the first read, with a word for it and no rows", () => {
    const r = rig();
    const model = modelOf(r);
    expect(model.state).toBe("loading");
    const markup = pageHtml(model);
    expect(markup).toContain('data-platform-state="loading"');
    expect(markup).toContain('data-status-mark="loading"');
    expect(markup).toContain("Reading the synthetic platform. Nothing is confirmed yet.");
    expect(markup).not.toContain("data-listing=");
    expect(markup).not.toContain("data-trade=");
    expect(markup).toContain("No right is listed in this read.");
    expectClean(markup);
  });

  it("shows two channels listing one right, and a second right, after a read", async () => {
    const r = rig();
    await r.controller.refresh();
    const model = modelOf(r);
    expect(model.state).toBe("ready");
    expect(model.rights.map((right) => [right.rightRef, right.listings.map((item) => item.listingRef)])).toEqual([
      ["rgt-0001", ["lst-0001", "lst-0002"]],
      ["rgt-0002", ["lst-0003"]],
    ]);
    const markup = pageHtml(model);
    expect(markup).toContain('data-platform-state="ready"');
    expect(markup).toContain('data-source="synthetic-platform"');
    expect(markup).toContain("SYNTHETIC");
    expect(markup).toContain("Web board");
    expect(markup).toContain("Partner board");
    expect(markup).toContain("Book on Web board");
    expect(markup).toContain("Book on Partner board");
    expect(markup).toContain("No trade yet. Book a listing to start one.");
    expect(markup).toContain("No write has been sent in this session.");
    expect(markup).toContain('data-enabled="true"');
    expect(markup).not.toContain('data-blocked-reason="true"');
    expectClean(markup);
  });

  it("separates empty, stale, unavailable, changed tuple, and not-bound, and none is a ready platform", async () => {
    const empty = rig("empty");
    await empty.controller.refresh();
    expect(modelOf(empty)).toMatchObject({ state: "empty", actionLabel: "Read again" });
    expect(pageHtml(modelOf(empty), "empty")).toContain("No listings in this synthetic session.");

    const stale = rig("stale");
    await stale.controller.refresh();
    const staleModel = modelOf(stale);
    expect(staleModel).toMatchObject({ state: "stale", actionLabel: "Read again" });
    expect(staleModel.detailLine).toContain("older than the floor");
    expect(pageHtml(staleModel, "stale")).toContain("Stale platform read.");

    const changed = new PlatformJourneyController(
      createStubPlatformJourney({ expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, domain: "kix:other" } }),
      { actorRef: "platform-desk" },
    );
    await changed.refresh();
    const changedModel = buildPlatformModel({ controller: changed, last: null });
    expect(changedModel).toMatchObject({ state: "tuple-changed", actionLabel: "Start a new synthetic session" });
    expect(pageHtml(changedModel)).toContain("Nothing was read and nothing was applied.");

    const broken = new PlatformJourneyController(
      {
        environment: "stub",
        source: "synthetic-platform",
        scenario: "clean",
        read: async () => {
          throw new Error("source lost");
        },
        submit: async () => ({ kind: "not-bound", reason: "x" }),
        deliverHeld: () => 0,
        deliverLate: () => [],
      },
      { actorRef: "platform-desk" },
    );
    await broken.refresh();
    const brokenModel = buildPlatformModel({ controller: broken, last: null });
    expect(brokenModel.state).toBe("unavailable");
    expect(pageHtml(brokenModel)).toContain("This is not an empty platform.");
    expect(pageHtml(brokenModel)).toContain("source lost");
  });

  it("renders integration-http as not-bound with no stub switch, no row, and every write off", async () => {
    const controller = new PlatformJourneyController(createNotBoundPlatformJourney(), { actorRef: "platform-desk" });
    await controller.refresh();
    const model = buildPlatformModel({ controller, last: null });
    expect(model.state).toBe("not-bound");
    expect(model.statusLine).toBe(PLATFORM_NOT_BOUND_REASON);
    expect(model.rights).toEqual([]);
    expect(model.trades).toEqual([]);
    const markup = pageHtml(model, "clean", "integration-http");
    expect(markup).toContain('data-adapter-environment="integration-http"');
    expect(markup).toContain(PLATFORM_NOT_BOUND_REASON);
    expect(markup).not.toContain("data-listing=");
    expect(markup).not.toContain("Book on");
    expect(markup).not.toContain("fall back");
    expectClean(markup);
  });
});

describe("platform controls and fences", () => {
  it("keeps an off control focusable, names the reason, and links the two", async () => {
    const r = rig("held-response");
    await r.controller.refresh();
    const pending = r.controller.run({ step: "book", intentRef: "held-book", listingRef: "lst-0001" });
    const model = modelOf(r);
    const markup = pageHtml(model, "held-response");
    expect(markup).toContain('id="platform-book-lst-0001"');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('aria-describedby="platform-book-lst-0001-reason"');
    expect(markup).toContain('id="platform-book-lst-0001-reason"');
    expect(markup).toContain("Another write on this right is in flight (held-book). Wait for its answer.");
    expect(markup).not.toMatch(/<button[^>]*\sdisabled/);
    // The other right is a different scope and stays on.
    expect(model.rights[1]?.listings[0]?.book).toEqual({ enabled: true, reason: null });
    r.port.deliverHeld();
    await pending;
  });

  it("maps every fence to one distinct sentence", () => {
    const fences: PlatformFence[] = [
      { reason: "in-flight", intentRef: "i-1" },
      { reason: "unknown-outcome", intentRef: "i-1", lateRecorded: false, earlierContext: false },
      { reason: "unknown-outcome", intentRef: "i-1", lateRecorded: true, earlierContext: true },
      { reason: "no-snapshot" },
      { reason: "snapshot-stale", cause: "own-write" },
      { reason: "snapshot-stale", cause: "stale-rejection" },
      { reason: "snapshot-stale", cause: "context-switch" },
      { reason: "duplicate-intent", intentRef: "i-1" },
      { reason: "payment-unobserved", tradeRef: "trd-0001" },
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
  });

  it("words every result kind and never calls a lost result a rejection or a success", async () => {
    const r = rig("book-lost");
    await r.controller.refresh();
    const lost = await step(r, { step: "book", listingRef: "lst-0001" });
    const line = stepResultLine("book", lost);
    expect(line).toContain("result unknown");
    expect(line).toContain("may or may not have applied");
    expect(line).not.toMatch(/rejected|confirmed/);
    const fenced = await step(r, { step: "book", listingRef: "lst-0001" });
    expect(stepResultLine("book", fenced)).toContain("Booking not sent.");
    const ok = rig();
    await ok.controller.refresh();
    const confirmed = await step(ok, { step: "book", listingRef: "lst-0001" });
    expect(stepResultLine("book", confirmed)).toBe("Booking confirmed by the synthetic source. This is not a protocol receipt.");
    const notSent = await step(ok, { step: "reprice", listingRef: "lst-0001", nextTier: "tier-9" });
    expect(stepResultLine("reprice", notSent)).toContain("Tier change not sent.");
  });
});

describe("two channels, one right", () => {
  it("never shows two successes: the second channel is serialised and then refused by the source", async () => {
    const r = rig();
    await r.controller.refresh();
    const web = await step(r, { step: "book", listingRef: "lst-0001" });
    const partner = await step(r, { step: "book", listingRef: "lst-0002" });
    const webTrade = tradeRefOf(web);
    const partnerTrade = tradeRefOf(partner);
    expect(r.port.effects()).toMatchObject({ books: 2, paymentObservations: 2 });

    // Both transfer clicks land in the same tick: the second never reaches the source.
    const [first, second] = await Promise.all([
      r.controller.run({ step: "transfer", intentRef: "click-a", tradeRef: webTrade }),
      r.controller.run({ step: "transfer", intentRef: "click-b", tradeRef: partnerTrade }),
    ]);
    expect(first.kind).toBe("CONFIRMED");
    expect(second.kind).toBe("FENCED");
    await r.controller.refresh();
    const refused = await step(r, { step: "transfer", tradeRef: partnerTrade });
    expect(refused).toMatchObject({ kind: "REJECTED", intent: { code: "VERSION_STALE" } });

    const model = modelOf(r);
    const markup = pageHtml(model);
    expect(model.rights[0]?.transfersLine).toBe("One trade moved this right in the last read.");
    expect(model.rights[0]?.integrityFault).toBe(false);
    expect(markup).toContain('data-integrity="ok"');
    expect(markup).not.toContain('data-integrity="fault"');
    expect(countOf(markup, 'data-shape="booking-payment-right"')).toBe(1);
    expect(countOf(markup, 'data-shape="payment-without-right"')).toBe(1);
    expect(countOf(markup, 'data-write="confirmed" data-observed="observed"')).toBeGreaterThanOrEqual(1);
    expect(r.port.effects().transfers).toBe(1);
    expectClean(markup);
  });

  it("a rival channel lands first: the page shows no success of its own and says who holds the right", async () => {
    const r = rig("rival-channel");
    await r.controller.refresh();
    const trade = tradeRefOf(await step(r, { step: "book", listingRef: "lst-0001" }));
    const moved = await step(r, { step: "transfer", tradeRef: trade });
    expect(moved).toMatchObject({ kind: "REJECTED", intent: { code: "VERSION_STALE" } });
    const model = modelOf(r);
    const markup = pageHtml(model, "rival-channel");
    expect(model.rights[0]?.holderLine).toContain("Holder holder-rival at version 8");
    expect(model.rights[0]?.transfersLine).toBe("One trade moved this right in the last read.");
    expect(markup).toContain("Observed only. It is not linked to a confirmed booking of this page");
    expect(markup).toContain("This is a partial result.");
    expect(markup).toContain(`Right rgt-0001 when this trade was booked: holder holder-seed-1 at version 7.`);
    expect(markup).toContain(`Right rgt-0001 in the last read: holder holder-rival at version 8.`);
    expect(markup).toContain(PLATFORM_COMPENSATION_UNDEFINED);
    expect(markup).toContain("Rejected (VERSION_STALE).");
    expect(markup).toContain("The source applied nothing for this write.");
    expect(model.lastLine).toContain("Transfer rejected (VERSION_STALE)");
    expect(model.lastNeedsFocus).toBe(true);
    expectClean(markup);
  });
});

describe("payment lost", () => {
  it("keeps booking, payment, right transfer, and refund as four lines and offers no transfer or refund control", async () => {
    const r = rig("payment-lost");
    await r.controller.refresh();
    const trade = tradeRefOf(await step(r, { step: "book", listingRef: "lst-0001" }));
    const model = modelOf(r);
    const view = model.trades.find((item) => item.tradeRef === trade);
    expect(view?.facets.map((facet) => facet.facet)).toEqual([...PLATFORM_FACETS]);
    expect(view?.facets.map((facet) => [facet.writeKind, facet.observedKind])).toEqual([
      ["confirmed", "observed"],
      ["not-bound", "unknown"],
      ["none", "not-observed"],
      ["not-bound", "unavailable"],
    ]);
    expect(view?.shape).toBe("payment-unknown");
    expect(view?.transfer.enabled).toBe(false);
    expect(view?.transfer.reason).toContain("No payment observation is recorded");
    const markup = pageHtml(model, "payment-lost");
    expect(markup).toContain('data-facet="booking"');
    expect(markup).toContain('data-facet="payment"');
    expect(markup).toContain('data-facet="issuance"');
    expect(markup).toContain('data-facet="refund"');
    expect(markup).toContain("Whether funds moved is not known here.");
    expect(markup).toContain("Refund: COMPENSATION_UNDEFINED.");
    expect(markup).toContain('data-refund-line="undefined"');
    expect(markup).toContain("Holder holder-seed-1 at version 7");
    expect(markup).not.toContain("Refund this");
    expect(markup).not.toMatch(/<button[^>]*>[^<]*[Rr]efund/);
    expect(markup).toContain('aria-describedby="platform-transfer-trd-0001-reason"');
    expect(r.port.effects()).toMatchObject({ transfers: 0, paymentObservations: 0 });
    expectClean(markup);
  });

  it("partial failure: a payment observation with no right transfer is explained with the original right and the refund line together", async () => {
    const r = rig();
    await r.controller.refresh();
    const trade = tradeRefOf(await step(r, { step: "book", listingRef: "lst-0001" }));
    await step(r, { step: "reprice", listingRef: "lst-0001", nextTier: "tier-3" });
    const moved = await step(r, { step: "transfer", tradeRef: trade });
    expect(moved).toMatchObject({ kind: "REJECTED", intent: { code: "TERMS_CHANGED" } });
    const model = modelOf(r);
    const view = model.trades.find((item) => item.tradeRef === trade);
    expect(view?.shape).toBe("payment-without-right");
    expect(view?.stranded).toBe(true);
    expect(view?.shapeLine).toBe("A payment observation is recorded and the right did not move for this trade. This is a partial result.");
    expect(view?.rightLines).toEqual([
      "Right rgt-0001 when this trade was booked: holder holder-seed-1 at version 7.",
      "Right rgt-0001 in the last read: holder holder-seed-1 at version 7.",
    ]);
    expect(view?.refundLine).toContain("COMPENSATION_UNDEFINED");
    expect(view?.refundLine).toContain("Nothing is refunded and nothing is queued.");
    const listing = model.rights[0]?.listings.find((item) => item.listingRef === "lst-0001");
    expect(listing).toMatchObject({ open: false, statusLine: "Superseded by lst-0004." });
    expect(listing?.book.enabled).toBe(false);
    expect(listing?.reprice.reason).toContain("Superseded by lst-0004");
    const markup = pageHtml(model);
    expect(markup).toContain('data-listing="lst-0004"');
    expect(markup).toContain('data-status="superseded"');
    expectClean(markup);
  });
});

describe("unknown and late results", () => {
  it("a lost booking blocks every write on its right, links no trade to itself, and leaves the other right open", async () => {
    const r = rig("book-lost");
    await r.controller.refresh();
    const lost = await step(r, { step: "book", listingRef: "lst-0001" });
    expect(lost.kind).toBe("UNKNOWN");
    const again = await step(r, { step: "book", listingRef: "lst-0001" });
    const other = await step(r, { step: "book", listingRef: "lst-0002" });
    expect(again.kind).toBe("FENCED");
    expect(other.kind).toBe("FENCED");
    await r.controller.refresh();
    const model = modelOf(r);
    const blocked = model.rights[0]?.listings.map((item) => [item.book.enabled, item.reprice.enabled]);
    expect(blocked).toEqual([
      [false, false],
      [false, false],
    ]);
    expect(model.rights[1]?.listings[0]?.book.enabled).toBe(true);
    const markup = pageHtml(model, "book-lost");
    expect(markup).toContain("An earlier write on this right has an unknown result (intent-1).");
    expect(markup).toContain("Writes on this right stay blocked. A read does not resolve it.");
    expect(model.session.unlinkedLines).toHaveLength(1);
    expect(model.session.unlinkedLines[0]).toContain("No trade is linked to it, and a trade seen in a read is not claimed for it.");
    expect(model.trades[0]).toMatchObject({ linked: false });
    expect(markup).toContain('data-unlinked="true"');
    expect(markup).toContain('data-outcome="UNKNOWN"');
    expect(model.session.countersLine).toBe("Sent 1. Blocked before sending 2. Not sent 0. Reads dropped 0.");
    // The client never sent a second booking, so the source holds one payment observation.
    expect(r.port.effects()).toMatchObject({ books: 1, paymentObservations: 1 });
    expectClean(markup);
  });

  it("a late result is shown as evidence on an unknown write and does not open the right", async () => {
    const r = rig("transfer-late");
    await r.controller.refresh();
    const trade = tradeRefOf(await step(r, { step: "book", listingRef: "lst-0001" }));
    const unknown = await step(r, { step: "transfer", tradeRef: trade });
    expect(unknown.kind).toBe("UNKNOWN");
    for (const delivery of r.port.deliverLate()) {
      r.controller.acceptLate(delivery);
    }
    await r.controller.refresh();
    const model = modelOf(r);
    const view = model.trades.find((item) => item.tradeRef === trade);
    expect(view?.shape).toBe("unknown-effect");
    expect(view?.facets[2]).toMatchObject({ writeKind: "unknown", observedKind: "observed" });
    expect(view?.facets[2]?.writeWord).toContain("A late result is recorded.");
    expect(view?.transfer.enabled).toBe(false);
    expect(view?.transfer.reason).toContain("A late result was recorded, and it does not make the write known.");
    const markup = pageHtml(model, "transfer-late");
    expect(markup).toContain("Late result confirmed. Evidence only.");
    expect(markup).toContain('data-outcome="UNKNOWN"');
    expect(markup).toContain("The right may or may not have moved for this trade.");
    expect(markup).toContain('id="platform-deliver-late"');
    expectClean(markup);
  });
});

describe("stale session", () => {
  it("a result from an earlier session context is quarantined and the right stays blocked in the new one", async () => {
    const r = rig("held-response");
    await r.controller.refresh();
    const pending = r.controller.run({ step: "book", intentRef: "held-book", listingRef: "lst-0001" });
    r.controller.switchContext({ actorRef: PLATFORM_ALT_ACTOR });
    r.port.deliverHeld();
    const result = await pending;
    r.last = { seq: 1, kind: "step", step: "book", result };
    const unread = modelOf(r);
    expect(result.kind).toBe("QUARANTINED");
    expect(unread.state).toBe("unread");
    expect(unread.actionLabel).toBe("Read again");
    expect(unread.lastLine).toContain("arrived after the session context changed");
    const unreadMarkup = pageHtml(unread, "held-response");
    expect(unreadMarkup).toContain("The session context changed, so there is no read in this context.");
    expect(unreadMarkup).toContain('data-quarantined="true"');
    expect(unreadMarkup).toContain("Actor platform-desk-2, session 2, mode stub.");
    expect(unreadMarkup).toContain("CONTEXT_SWITCHED");
    expect(unreadMarkup).not.toContain("data-trade=");

    await r.controller.refresh();
    const model = modelOf(r);
    expect(model.state).toBe("ready");
    expect(model.rights[0]?.listings[0]?.book.reason).toContain("It was sent in an earlier session context.");
    expect(model.rights[1]?.listings[0]?.book.enabled).toBe(true);
    // The discarded result created no linked trade.
    expect(model.trades.every((trade) => !trade.linked)).toBe(true);
    expectClean(pageHtml(model, "held-response"));
  });

  it("asks for a fresh read after the source says the last one was behind", async () => {
    const r = rig("rival-channel");
    await r.controller.refresh();
    const trade = tradeRefOf(await step(r, { step: "book", listingRef: "lst-0001" }));
    await step(r, { step: "transfer", tradeRef: trade }, { read: false });
    const model = modelOf(r);
    expect(model.freshnessWord).toBe("The last read is behind.");
    expect(model.rights[0]?.listings[0]?.book.reason).toBe(
      "Read again before the next write. The source said the last read was behind.",
    );
    await r.controller.refresh();
    expect(modelOf(r).freshnessWord).toBe("The last read is current.");
  });
});

describe("platform screen as mounted", () => {
  it("mounts on /platform in the loading state with the banner, rulings, and both not-bound records", () => {
    const markup = html(
      <MemoryRouter initialEntries={["/platform"]}>
        <App />
      </MemoryRouter>,
    );
    expect(markup).toContain("Trading platform (synthetic)");
    expect(markup).toContain('href="/platform"');
    expect(markup).toContain('data-status-mark="loading"');
    expect(markup).toContain(WORKSPACE_RULING);
    expect(markup).toContain(COMMERCE_COMMAND_BINDINGS.placeHold.reason);
    expect(markup).toContain('data-hold-record="not-bound"');
    expect(markup).toContain("reserve_listing");
    expect(markup).toContain('data-refund-record="not-bound"');
    expect(markup).toContain("COMPENSATION_UNDEFINED");
    expect(markup).toContain('data-source="synthetic-platform"');
    expect(markup).toContain('data-adapter-environment="stub"');
    expect(markup).not.toContain('href="/booking/');
    expect(markup).not.toMatch(BANNED);
  });

  it("offers every scenario with a note, keyboard-reachable controls, and no positive tab order", () => {
    const markup = html(
      <MemoryRouter initialEntries={["/platform"]}>
        <App />
      </MemoryRouter>,
    );
    for (const scenario of PLATFORM_SCENARIOS) {
      expect(markup).toContain(`<option value="${scenario}"`);
      expect(SCENARIO_NOTES[scenario].length).toBeGreaterThan(10);
    }
    expect(markup).toContain('for="platform-scenario"');
    expect(markup).toContain('id="platform-refresh"');
    expect(markup).toContain('id="platform-switch"');
    expect(markup).toContain('id="platform-new-session"');
    expect(markup).toContain('id="platform-status"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).not.toMatch(/tabindex="[1-9]/);
    expect(markup).toContain('aria-label="Platform sections"');
  });
});

describe("registration", () => {
  it("is one stub-only buyer surface with no sender, no action, and no desk method", () => {
    const surface = WORKSPACE_SURFACES.find((item) => item.id === "platform-journey-trade");
    expect(surface).toMatchObject({
      role: "buyer",
      route: "/platform",
      binding: "stub-only",
      sender: null,
      taskId: "c-platform-journey-stub",
      implemented: true,
      pageControl: true,
    });
    expect(surface?.actions).toEqual([]);
    expect(surface?.deskMethods).toEqual([]);
    expect(surface?.provenanceNote).toContain("integration-http");
    expect(surface?.provenanceNote).not.toMatch(/\bworks\b|live payment|funds moved|disbursed|payment complete|admission complete|refund complete/i);
    for (const id of ["reservation", "payment", "issuance", "refund"]) {
      expect(BUYER_FLOW_STAGES.find((stage) => stage.id === id)?.surfaces).toContain("platform-journey-trade");
    }
  });

  it("is recorded in the handoff packet as a pending producer that is not connected", () => {
    for (const id of ["c-platform-journey", "c-async-session-fence"]) {
      const row = PENDING_PRODUCERS.find((item) => item.id === id);
      expect(row, id).toMatchObject({ catalogue: "pending", connected: false, implementedHere: false, waitingSurface: "platform-journey-trade" });
    }
    const pending = JSON.parse(readFileSync(path.join(repoRoot, "docs/aiops/PENDING_NODES.json"), "utf8")) as { nodes: { id: string }[] };
    const ids = new Set(pending.nodes.map((node) => node.id));
    expect(ids.has("c-platform-journey")).toBe(true);
    expect(ids.has("c-async-session-fence")).toBe(true);
  });

  it("has eight synthetic fixture rows that own no pass and cover reject, unknown, and stale", () => {
    const rows = fixturesForScreen("platform-journey-trade");
    expect(rows.map((row) => row.id)).toEqual([
      "platform-journey-trade.version-stale",
      "platform-journey-trade.terms-changed",
      "platform-journey-trade.payment-unobserved",
      "platform-journey-trade.write-fenced",
      "platform-journey-trade.response-lost",
      "platform-journey-trade.late-result",
      "platform-journey-trade.stale-read",
      "platform-journey-trade.stale-session",
    ]);
    expect(new Set(rows.map((row) => row.klass))).toEqual(new Set(["REJECT", "UNKNOWN", "STALE"]));
    for (const row of rows) {
      expect(row.ownsPass).toBe(false);
      expect(row.source).toBe("synthetic-fixture");
      expect(row.klass).not.toBe("SUCCESS");
      expect(row.substituteStub).toBe(false);
    }
    expect(CONTRACT_FIXTURES.filter((row) => row.screenId === "platform-journey-trade" && row.klass === "NOT_BOUND")).toEqual([]);
  });

  it("keeps the new screen free of sends, clocks, timers, and the booking, capture, and hold vocabulary", () => {
    const files = ["src/platform-journey.ts", "src/pages/Platform.tsx", "src/pages/PlatformPanels.tsx"];
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
    expect(css).toContain(".platform");
    expect(css).not.toContain("@keyframes");
    expect(css).not.toMatch(/animation\s*:/);
  });

  it("names the surface in the docs and the README", () => {
    const doc = readFileSync(path.join(repoRoot, "docs/c-platform-journey-stub-apps-bind.md"), "utf8");
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    expect(doc).toContain(WORKSPACE_RULING);
    expect(doc).toContain("platform-journey-trade");
    expect(doc).toContain("Browser run");
    expect(readme).toContain("docs/c-platform-journey-stub-apps-bind.md");
    expect(readme).toContain("/platform");
  });
});
