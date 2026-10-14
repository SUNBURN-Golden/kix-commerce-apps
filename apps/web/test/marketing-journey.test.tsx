import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  COMMERCE_COMMAND_BINDINGS,
  DISCOVERY_READ_TUPLE_LITERALS,
  MARKETING_NON_CLAIM_FIELDS,
  MARKETING_NOT_BOUND_REASON,
  MARKETING_SCENARIOS,
  MarketingJourneyController,
  createNotBoundMarketingJourney,
  createStubMarketingJourney,
  type MarketingFence,
  type MarketingJourneyPort,
  type MarketingReadOutcome,
  type MarketingScenario,
  type MarketingStepInput,
  type MarketingStepResult,
  type StubMarketingJourney,
} from "@kix/protocol-adapter";
import { CONTRACT_FIXTURES, FIXTURE_SCREENS, fixturesForScreen } from "../../../packages/protocol-adapter/src/contract-fixtures";
import { App } from "../src/App";
import { LOCAL_SURFACE_EVIDENCE, PENDING_PRODUCERS, FEATURE_ROWS, ROLE_JOURNEYS } from "../src/handoff/packet";
import {
  CONTROL_LABELS,
  SCENARIO_NOTES,
  VERDICT_LINES,
  buildMarketingJourneyModel,
  fenceLine,
  returnActionLine,
  stepResultLine,
  type LastAction,
  type MarketingJourneyActions,
  type MarketingJourneyModel,
} from "../src/marketing-journey";
import {
  BenefitsSection,
  ConsentSection,
  LanesSection,
  MarketingBanner,
  MarketingControls,
  MarketingStatus,
  OrdersSection,
  RegisterSection,
  RejectionsSection,
  SessionSection,
} from "../src/pages/MarketingJourneyPanels";
import { WORKSPACE_RULING, WORKSPACE_SURFACES } from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

const BANNED = /[$₩]|KRW|USD|still open|in stock|remaining/i;

/** Wording that would turn a notice, an application, or a synthetic write into a decision. None may appear on screen. */
const POSITIVE_CLAIMS = [
  "Purchase confirmed",
  "Purchased",
  "Order confirmed",
  "Booked for you",
  "Reward paid",
  "Reward issued",
  "Reward granted",
  "Discount applied",
  "Price reduced",
  "Message sent",
  "Campaign sent",
  "Campaign started",
  "CRM complete",
  "CRM is complete",
  "Journey complete",
  "Refund complete",
  "Refunded",
  "Completed",
  "Settled",
];

const NO_ACTIONS: MarketingJourneyActions = {
  refresh() {},
  apply() {},
  reclaim() {},
  setScenario() {},
  deliverHeld() {},
  switchScope() {},
  newSession() {},
  simulate() {},
};

function html(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element);
}

function pageHtml(
  model: MarketingJourneyModel,
  scenario: MarketingScenario = "clean",
  environment: "stub" | "integration-http" = "stub",
): string {
  return html(
    <MemoryRouter>
      <MarketingBanner environment={environment} scenario={scenario} model={model} />
      <MarketingControls
        environment={environment}
        scenario={scenario}
        heldSupported={scenario === "held-response"}
        subjectRef={model.subjectRef}
        actions={NO_ACTIONS}
      />
      <MarketingStatus model={model} />
      <LanesSection model={model} />
      <ConsentSection model={model} />
      <BenefitsSection model={model} actions={NO_ACTIONS} />
      <OrdersSection model={model} environment={environment} actions={NO_ACTIONS} />
      <RejectionsSection model={model} actions={NO_ACTIONS} />
      <SessionSection session={model.session} />
      <RegisterSection model={model} />
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
  port: StubMarketingJourney;
  controller: MarketingJourneyController;
  last: LastAction | null;
  seq: number;
  intent: number;
}

function rig(scenario: MarketingScenario = "clean"): Rig {
  const port = createStubMarketingJourney({ scenario });
  return {
    port,
    controller: new MarketingJourneyController(port, { actorRef: "fan-desk", subjectRef: "sub-0001" }),
    last: null,
    seq: 0,
    intent: 0,
  };
}

async function ready(scenario: MarketingScenario = "clean"): Promise<Rig> {
  const r = rig(scenario);
  await r.controller.refresh();
  return r;
}

/** Runs one write the way the page does: the write, then one read after it settled. */
async function step(
  r: Rig,
  input: { step: "apply"; benefitRef: string; orderRef?: string } | { step: "reclaim"; applicationRef: string },
  options: { read?: boolean } = {},
): Promise<MarketingStepResult> {
  r.intent += 1;
  const withIntent: MarketingStepInput =
    input.step === "apply"
      ? { step: "apply", intentRef: `intent-${r.intent}`, benefitRef: input.benefitRef, orderRef: input.orderRef ?? "ord-0001" }
      : { step: "reclaim", intentRef: `intent-${r.intent}`, applicationRef: input.applicationRef };
  const result = await r.controller.run(withIntent);
  r.seq += 1;
  r.last = { seq: r.seq, kind: "step", step: input.step, result };
  if (options.read !== false && result.kind !== "FENCED" && result.kind !== "NOT_SENT" && result.kind !== "QUARANTINED") {
    await r.controller.refresh();
  }
  return result;
}

function modelOf(r: Rig, environment: "stub" | "integration-http" = "stub"): MarketingJourneyModel {
  return buildMarketingJourneyModel({ controller: r.controller, environment, last: r.last });
}

function countOf(markup: string, needle: string): number {
  return markup.split(needle).length - 1;
}

function buttonLabels(markup: string): string[] {
  return [...markup.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((match) => (match[1] ?? "").trim());
}

describe("marketing journey screen states", () => {
  it("shows loading before the first read, with a word for it and no benefit row", () => {
    const r = rig();
    const model = modelOf(r);
    expect(model.state).toBe("loading");
    const markup = pageHtml(model);
    expect(markup).toContain('data-marketing-state="loading"');
    expect(markup).toContain('data-status-mark="loading"');
    expect(markup).toContain("Reading the synthetic marketing source. Nothing is applied yet.");
    expect(markup).not.toContain("data-benefit=");
    expect(markup).toContain("No benefit is listed in this read.");
    expectClean(markup);
  });

  it("shows the four benefits with the source's own verdicts, figures, and rank, and a consent state read, not set", async () => {
    const r = await ready();
    const markup = pageHtml(modelOf(r));
    expect(markup).toContain('data-marketing-state="ready"');
    expect(markup).toContain("Benefits read.");
    for (const [ref, verdict] of [
      ["ben-0001", "eligible"],
      ["ben-0002", "eligible"],
      ["ben-0003", "budget-exhausted"],
      ["ben-0004", "eligible"],
    ] as const) {
      expect(markup).toContain(`data-benefit="${ref}"`);
      expect(markup).toContain(`data-benefit="${ref}" data-kind=`);
      expect(markup).toContain(`Source verdict ${verdict}.`);
    }
    expect(markup).toContain("Presale (M02)");
    expect(markup).toContain("Coupon (M03)");
    expect(markup).toContain("Referral (M04)");
    expect(markup).toContain("Source priority rank 1.");
    expect(markup).toContain("Usage recorded 0. Usage allowed 1.");
    expect(markup).toContain("Budget in redemptions: committed 2, limit 3, available.");
    expect(markup).toContain("Budget in redemptions: committed 1, limit 1, exhausted.");
    expect(markup).toContain('data-consent-state="granted"');
    expect(markup).toContain('data-authorization="valid"');
    expect(markup).toContain("Authorization is valid at consent version 2.");
    expect(markup).toContain("Channel none: nothing is sent.");
    expect(markup).toContain('href="/marketing/m05"');
    expect(markup).toContain("This journey posts neither.");
    expect(markup).toContain("Referrer sub-0002: unattributed. An attribution records who referred. It pays no reward.");
    expect(markup).toContain("No application is listed in this read.");
    expect(markup).toContain("The source has rejected no write of this page in this session.");
    expectClean(markup);
  });

  it("keeps discover, apply, rejected, and reclaim as four lines with no summary", async () => {
    const r = await ready();
    const model = modelOf(r);
    expect(model.lanes.map((lane) => lane.lane)).toEqual(["discover", "apply", "reject", "reclaim"]);
    const markup = html(<LanesSection model={model} />);
    expect(countOf(markup, "data-lane=")).toBe(4);
    for (const lane of ["discover", "apply", "reject", "reclaim"]) {
      expect(markup).toContain(`data-lane="${lane}"`);
    }
    expect(markup).toContain("A listed benefit is not an applied benefit.");
    expect(model.lanes.find((lane) => lane.lane === "apply")?.line).toContain("applies no discount");
    expect(markup).toContain("Four separate lines. None of them is a summary of the others, and no line says the journey is done.");
    // The only mention is the sentence that denies it.
    expect(markup.replace("no line says the journey is done", "")).not.toMatch(/journey (is )?(complete|done|finished)/i);
    expect(markup).not.toMatch(/\d+ of \d+/);
  });

  it("separates empty, stale, denied, refused, unavailable, changed tuple, and not-bound, and none is a ready list", async () => {
    const cases: [MarketingScenario, string, string][] = [
      ["empty", "empty", "No benefit is listed for this subject in this read."],
      ["stale", "stale", "Stale benefits read."],
      ["denied", "denied", "The source refused this actor and subject (GRANT_REVOKED)."],
      ["scope-leak", "refused", "The payload was refused (SCOPE_LEAK). No row is shown."],
      ["snapshot-claims-crm", "refused", "The payload was refused (CLAIM). No row is shown."],
    ];
    for (const [scenario, state, line] of cases) {
      const r = await ready(scenario);
      const model = modelOf(r);
      expect(model.state, scenario).toBe(state);
      const markup = pageHtml(model, scenario);
      expect(markup, scenario).toContain(`data-marketing-state="${state}"`);
      expect(markup, scenario).toContain(line);
      expect(markup, scenario).not.toContain("data-benefit=");
      expect(markup, scenario).not.toContain("Benefits read.");
      expect(model.consent, scenario).toBeNull();
      expectClean(markup);
    }
    const leak = pageHtml(modelOf(await ready("scope-leak")), "scope-leak");
    expect(leak).toContain("app-0099");
    expect(leak).not.toContain("data-application=");
    const claim = pageHtml(modelOf(await ready("snapshot-claims-crm")), "snapshot-claims-crm");
    expect(claim).toContain("nonClaims.crmProductComplete");

    const inner = createStubMarketingJourney();
    const lostPort: MarketingJourneyPort = {
      environment: inner.environment,
      source: inner.source,
      scenario: inner.scenario,
      read: () => Promise.reject(new Error("no answer")),
      submit: (request) => inner.submit(request),
      simulate: (request) => inner.simulate(request),
      deliverHeld: () => inner.deliverHeld(),
    };
    const lost = new MarketingJourneyController(lostPort, { actorRef: "fan-desk", subjectRef: "sub-0001" });
    await lost.refresh();
    const lostModel = buildMarketingJourneyModel({ controller: lost, environment: "stub", last: null });
    expect(lostModel.state).toBe("unavailable");
    expect(pageHtml(lostModel)).toContain("The source did not answer. This is not an empty benefit list.");

    const changed = new MarketingJourneyController(
      createStubMarketingJourney({ expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, domain: "other" } }),
      { actorRef: "fan-desk", subjectRef: "sub-0001" },
    );
    await changed.refresh();
    const changedModel = buildMarketingJourneyModel({ controller: changed, environment: "stub", last: null });
    expect(changedModel.state).toBe("tuple-changed");
    expect(changedModel.actionLabel).toBe("Start a new synthetic session");
  });

  it("renders integration-http as not-bound with no stub switch, no row, and no simulate control that acts", async () => {
    const controller = new MarketingJourneyController(createNotBoundMarketingJourney(), { actorRef: "fan-desk", subjectRef: "sub-0001" });
    await controller.refresh();
    const model = buildMarketingJourneyModel({ controller, environment: "integration-http", last: null });
    expect(model.state).toBe("not-bound");
    const markup = pageHtml(model, "clean", "integration-http");
    expect(markup).toContain('data-marketing-state="not-bound"');
    expect(markup).toContain(MARKETING_NOT_BOUND_REASON);
    expect(markup).toContain('data-adapter-environment="integration-http"');
    expect(markup).not.toContain("data-benefit=");
    expect(markup).not.toContain("data-application=");
    expect(markup).not.toContain('id="mkj-cancel-');
    // No synthetic source is claimed on a not-bound port, and the controls that belong to it say why they are off.
    expect(markup).toContain('data-source="none"');
    expect(markup).not.toContain('data-source="synthetic-marketing"');
    expect(markup).not.toContain("SYNTHETIC.");
    expect(markup).toContain("NOT BOUND. There is no source on integration-http");
    expect(markup).toContain('id="mkj-scenario-off"');
    expect(markup).toContain("Scenarios and Simulate events belong to the synthetic source, which is not selected on integration-http.");
    expect(markup).not.toContain("data-scenario-note=\"clean\"");
    const start = markup.match(/<button[^>]*id="mkj-apply-scenario"[^>]*>/)?.[0] ?? "";
    expect(start).toContain('aria-disabled="true"');
    expect(start).toContain('aria-describedby="mkj-scenario-off"');
    for (const control of Object.keys(CONTROL_LABELS)) {
      const button = markup.match(new RegExp(`<button[^>]*data-simulate="${control}"[^>]*>`))?.[0] ?? "";
      expect(button, control).toContain('aria-disabled="true"');
      expect(button, control).toContain('aria-describedby="mkj-scenario-off mkj-simulate-note"');
    }
    expect(countOf(markup, 'aria-disabled="true"')).toBeGreaterThanOrEqual(6);
    expect(markup).not.toContain("fallback");
    expectClean(markup);
  });
});

describe("marketing journey controls and fences", () => {
  it("keeps an off control focusable, names the reason, and links the two", async () => {
    const r = await ready();
    const markup = html(
      <MemoryRouter>
        <BenefitsSection model={modelOf(r)} actions={NO_ACTIONS} />
      </MemoryRouter>,
    );
    const off = markup.match(/<button[^>]*id="mkj-apply-ben-0003-ord-0001"[^>]*>/)?.[0] ?? "";
    expect(off).toContain('aria-disabled="true"');
    expect(off).toContain('aria-describedby="mkj-apply-ben-0003-ord-0001-reason"');
    expect(off).toContain('data-enabled="false"');
    expect(off).not.toMatch(/\sdisabled(=|\s|>)/);
    expect(markup).toContain('id="mkj-apply-ben-0003-ord-0001-reason"');
    expect(markup).toContain("The last read says budget-exhausted.");
    const on = markup.match(/<button[^>]*id="mkj-apply-ben-0001-ord-0001"[^>]*>/)?.[0] ?? "";
    expect(on).toContain('data-enabled="true"');
    expect(on).not.toContain("aria-disabled");
    expect(on).not.toContain("aria-describedby");
    expect(markup).toContain("Blocked.");
  });

  it("maps every fence to one distinct sentence", () => {
    const fences: MarketingFence[] = [
      { reason: "in-flight", intentRef: "i-1" },
      { reason: "unknown-outcome", intentRef: "i-1", earlierContext: false },
      { reason: "unknown-outcome", intentRef: "i-1", earlierContext: true },
      { reason: "no-snapshot" },
      { reason: "snapshot-stale", cause: "own-write" },
      { reason: "snapshot-stale", cause: "rejection" },
      { reason: "snapshot-stale", cause: "context-switch" },
      { reason: "duplicate-intent", intentRef: "i-1" },
      { reason: "not-listed", ref: "ben-0099" },
      { reason: "verdict-blocked", benefitRef: "ben-0003", verdict: "budget-exhausted" },
      { reason: "verdict-blocked", benefitRef: "ben-0001", verdict: "consent-withdrawn" },
      { reason: "order-closed", orderRef: "ord-0001", state: "cancelled" },
      { reason: "already-applied", applicationRef: "app-0001" },
      { reason: "not-reclaimable", applicationRef: "app-0001" },
      { reason: "not-bound" },
    ];
    const lines = fences.map((fence) => fenceLine(fence));
    expect(new Set(lines).size).toBe(lines.length);
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(15);
      expect(line).not.toMatch(/rejected by the source/i);
    }
    expect(lines.find((line) => line.includes("A read does not resolve it."))).toBeDefined();
  });

  it("words every result kind and never calls a lost result a rejection or a success", async () => {
    const r = await ready("apply-lost");
    const lost = await step(r, { step: "apply", benefitRef: "ben-0002" });
    const line = stepResultLine("apply", lost);
    expect(line).toContain("result unknown");
    expect(line).toContain("may or may not have applied");
    expect(line).not.toMatch(/rejected|recorded by the synthetic source/i);

    const fenced = stepResultLine("apply", { kind: "FENCED", fence: { reason: "no-snapshot" } });
    expect(fenced).toBe("Apply not sent. Read the benefits first.");
    expect(stepResultLine("reclaim", { kind: "NOT_SENT", reason: "identity", detail: "A reclaim targets an application reference." })).toContain("Reclaim not sent.");

    const good = await ready();
    const confirmed = await step(good, { step: "apply", benefitRef: "ben-0002" });
    const confirmedLine = stepResultLine("apply", confirmed);
    expect(confirmedLine).toContain("Apply recorded by the synthetic source as app-0001.");
    expect(confirmedLine).toContain("It confirms no purchase, pays no reward, and applies no discount.");
    expect(confirmedLine).toContain("not a protocol receipt");
    await step(good, { step: "reclaim", applicationRef: "app-0001" });
    const reclaimLine = stepResultLine("reclaim", good.last?.kind === "step" ? good.last.result : lost);
    expect(reclaimLine).toContain("UNDETERMINED");
    expect(reclaimLine).toContain("this page restores nothing");
    expect(returnActionLine("manage-consent")).toContain("consent page");
    expect(new Set([returnActionLine("read-again"), returnActionLine("manage-consent"), returnActionLine("none")]).size).toBe(3);
  });

  it("offers no control named for confirming a purchase, paying a reward, sending a message, or completing a CRM product", async () => {
    const labels = new Set<string>();
    for (const scenario of MARKETING_SCENARIOS) {
      const r = await ready(scenario);
      if (scenario === "clean") {
        await step(r, { step: "apply", benefitRef: "ben-0002" });
        r.port.simulate({ control: "cancel-order", orderRef: "ord-0001" });
        await r.controller.refresh();
      }
      for (const label of buttonLabels(pageHtml(modelOf(r), scenario))) {
        labels.add(label);
      }
    }
    expect(labels.size).toBeGreaterThan(10);
    for (const label of labels) {
      if (label.startsWith("Simulate:")) {
        continue;
      }
      expect(label, label).not.toMatch(/purchase|buy|pay|reward|send|message|campaign|audience|complete|confirm|settle|refund|disburse|capture/i);
    }
    expect([...labels].filter((label) => label.startsWith("Apply ben-")).length).toBeGreaterThan(0);
    expect(labels.has("Read again")).toBe(true);
    expect(labels.has("Start a session with this scenario")).toBe(true);
  });

  it("separates the scenario choice from starting a session, so moving through the list resets nothing", () => {
    const markup = html(
      <MemoryRouter>
        <MarketingControls environment="stub" scenario="clean" heldSupported={false} subjectRef="sub-0001" actions={NO_ACTIONS} />
      </MemoryRouter>,
    );
    expect(markup).toContain('for="mkj-scenario"');
    expect(markup).toContain('id="mkj-apply-scenario"');
    expect(markup).toContain("Start a session with this scenario");
    for (const scenario of MARKETING_SCENARIOS) {
      expect(markup).toContain(`<option value="${scenario}"`);
      expect(SCENARIO_NOTES[scenario].length).toBeGreaterThan(10);
    }
    const select = markup.match(/<select[^>]*>/)?.[0] ?? "";
    expect(select).not.toContain("onchange");
    expect(markup).toContain('id="mkj-deliver-held"');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).not.toMatch(/tabindex="[1-9]/);
  });
});

describe("journey: stale eligibility", () => {
  it("shows the rejection with its code and one read-again action, the behind read, and then the new verdict", async () => {
    const r = await ready();
    r.port.simulate({ control: "lapse-eligibility" });
    // The page has not read again. It still shows the benefit as eligible.
    expect(pageHtml(modelOf(r))).toContain("Source verdict eligible.");
    const result = await step(r, { step: "apply", benefitRef: "ben-0001" }, { read: false });
    expect(result.kind).toBe("REJECTED");
    let markup = pageHtml(modelOf(r));
    expect(markup).toContain('data-rejection="intent-1"');
    expect(markup).toContain('data-code="ELIGIBILITY_STALE"');
    expect(markup).toContain('data-return-action="read-again"');
    expect(markup).toContain("Apply rejected (ELIGIBILITY_STALE).");
    expect(markup).toContain("The source applied nothing for this write.");
    expect(markup).toContain("The last read is behind.");
    expect(markup).toContain('data-last-action="attention"');
    expect(markup).toContain("Read again before the next write.");
    expect(markup).toContain("The source rejected the last write, so the read it was built from is behind.");
    expect(markup).not.toContain("data-application=");
    expect(modelOf(r).lastNeedsFocus).toBe(true);

    await r.controller.refresh();
    markup = pageHtml(modelOf(r));
    expect(markup).toContain("The last read is current.");
    expect(markup).toContain("Source verdict not-eligible.");
    expect(markup).toContain("Membership tier fan at version 4.");
    expect(markup).toContain('data-code="ELIGIBILITY_STALE"');
    expect(markup).toContain("The last read says not-eligible.");
    expectClean(markup);
  });
});

describe("journey: consent withdrawal", () => {
  it("rejects on the source, sends the person to the consent page, and never reuses the earlier authorization", async () => {
    const r = await ready();
    r.port.simulate({ control: "withdraw-consent" });
    expect(pageHtml(modelOf(r))).toContain('data-consent-state="granted"');
    const rejected = await step(r, { step: "apply", benefitRef: "ben-0001" }, { read: false });
    expect(rejected).toMatchObject({ kind: "REJECTED", intent: { code: "CONSENT_WITHDRAWN" } });
    await r.controller.refresh();

    let markup = pageHtml(modelOf(r));
    expect(markup).toContain('data-consent-state="withdrawn"');
    expect(markup).toContain('data-authorization="stale"');
    expect(markup).toContain("Authorization is stale: it was issued at consent version 2, which is not the current version. It is not reused.");
    expect(markup).toContain('data-code="CONSENT_WITHDRAWN"');
    expect(markup).toContain('data-return-action="manage-consent"');
    expect(markup).toContain('id="mkj-return-intent-1"');
    expect(markup).toContain('href="/marketing/m05"');
    expect(markup).toContain("Consent and authorization are managed on the consent page, not here.");
    expect(markup).toContain("Source verdict consent-withdrawn.");
    const blocked = markup.match(/<button[^>]*id="mkj-apply-ben-0001-ord-0001"[^>]*>/)?.[0] ?? "";
    expect(blocked).toContain('aria-disabled="true"');
    expect(markup).toContain("The last read says consent-withdrawn.");
    // A benefit that needs no consent stays available.
    const open = markup.match(/<button[^>]*id="mkj-apply-ben-0002-ord-0001"[^>]*>/)?.[0] ?? "";
    expect(open).toContain('data-enabled="true"');
    expect(r.port.effects().applies).toBe(0);

    // Consent is granted again, and the authorization is still the older one.
    r.port.simulate({ control: "grant-consent" });
    await r.controller.refresh();
    markup = pageHtml(modelOf(r));
    expect(markup).toContain("Source verdict authorization-stale.");
    expect(markup).toContain("It is not reused, and a new authorization is needed.");
    expect(markup).toContain("Consent version 4, as the source reports it.");
    const stillBlocked = markup.match(/<button[^>]*id="mkj-apply-ben-0001-ord-0001"[^>]*>/)?.[0] ?? "";
    expect(stillBlocked).toContain('aria-disabled="true"');

    // Only a new authorization at the current consent version lets the benefit apply.
    r.port.simulate({ control: "authorize-marketing" });
    await r.controller.refresh();
    const applied = await step(r, { step: "apply", benefitRef: "ben-0001" });
    expect(applied.kind).toBe("CONFIRMED");
    markup = pageHtml(modelOf(r));
    expect(markup).toContain('data-application="app-0001"');
    expect(markup).toContain("Relied on consent version 4.");
    expect(markup).toContain("Named by a confirmed apply of this page.");
    expectClean(markup);
  });

  it("flags an earlier application whose consent was withdrawn afterwards, leaves it unreclaimed, and calls the policy undetermined", async () => {
    const r = await ready();
    await step(r, { step: "apply", benefitRef: "ben-0001" });
    r.port.simulate({ control: "withdraw-consent" });
    await r.controller.refresh();
    const markup = pageHtml(modelOf(r));
    expect(markup).toContain('data-consent-withdrawn-since="true"');
    expect(markup).toContain("consent was withdrawn afterwards. Whether it must be reclaimed is UNDETERMINED.");
    expect(markup).toContain("only a new apply is blocked");
    expect(markup).toContain('data-state="applied"');
    expect(r.port.effects().reclaims).toBe(0);
    expectClean(markup);
  });

  it("reads consent that was never set as consent-required, not as granted", async () => {
    const r = await ready("consent-unset");
    const markup = pageHtml(modelOf(r));
    expect(markup).toContain('data-consent-state="unset"');
    expect(markup).toContain('data-authorization="none"');
    expect(markup).toContain("No authorization exists.");
    expect(markup).toContain("Source verdict consent-required.");
    expect(markup).toContain(VERDICT_LINES["consent-required"]);
  });
});

describe("journey: duplicate benefit", () => {
  it("shows another channel's application as not ours, rejects ours as a duplicate, and offers one read-again action", async () => {
    const r = await ready("duplicate-elsewhere");
    const result = await step(r, { step: "apply", benefitRef: "ben-0001" });
    expect(result).toMatchObject({ kind: "REJECTED", intent: { code: "DUPLICATE_USE" } });
    const markup = pageHtml(modelOf(r), "duplicate-elsewhere");
    expect(markup).toContain('data-code="DUPLICATE_USE"');
    expect(markup).toContain('data-return-action="read-again"');
    expect(markup).toContain('data-application="app-0001"');
    expect(markup).toContain("Applied by another channel.");
    expect(markup).toContain("Observed only. It is not named by a confirmed apply of this page, and this page does not claim it.");
    expect(markup).toContain("This benefit is already applied to this order (app-0001).");
    expect(markup).toContain("Usage recorded 1. Usage allowed 1.");
    expect(countOf(markup, "data-application=")).toBe(1);
    expect(r.port.effects().applies).toBe(0);
    expectClean(markup);
  });

  it("a second apply of the same benefit on the same order is blocked on the page, not sent", async () => {
    const r = await ready();
    await step(r, { step: "apply", benefitRef: "ben-0002", orderRef: "ord-0001" });
    const again = await step(r, { step: "apply", benefitRef: "ben-0002", orderRef: "ord-0001" });
    expect(again).toMatchObject({ kind: "FENCED", fence: { reason: "already-applied" } });
    expect(r.port.effects().applies).toBe(1);
    expect(pageHtml(modelOf(r))).toContain("Applied as app-0001.");
  });

  it("shows a budget that ran out between the read and the write, and a taken attribution, as the source's rejection with nothing to correct", async () => {
    const race = await ready("budget-race");
    await step(race, { step: "apply", benefitRef: "ben-0002" });
    const raceMarkup = pageHtml(modelOf(race), "budget-race");
    expect(raceMarkup).toContain('data-code="BUDGET_EXHAUSTED"');
    expect(raceMarkup).toContain('data-return-action="none"');
    expect(raceMarkup).toContain("Nothing on this page corrects it. The source decides.");
    expect(raceMarkup).toContain("Budget in redemptions: committed 3, limit 3, exhausted.");

    const taken = await ready("attribution-taken");
    const markup = pageHtml(modelOf(taken), "attribution-taken");
    expect(markup).toContain("Source verdict attribution-taken.");
    expect(markup).toContain("Referrer sub-0002: attributed-elsewhere.");
    const usage = pageHtml(modelOf(await ready("usage-limit")), "usage-limit");
    expect(usage).toContain("Source verdict usage-limit-reached.");
    expect(usage).toContain("Usage recorded 1. Usage allowed 1.");
    expect(usage).toContain("Applied by another channel.");
  });
});

describe("journey: reclaim", () => {
  it("makes a cancelled order's benefit due for reclaim, reclaims on request, and restores nothing", async () => {
    const r = await ready();
    await step(r, { step: "apply", benefitRef: "ben-0002", orderRef: "ord-0001" });
    let markup = pageHtml(modelOf(r));
    expect(markup).toContain('data-application="app-0001"');
    expect(markup).toContain("Not due for reclaim.");

    r.port.simulate({ control: "cancel-order", orderRef: "ord-0001" });
    // Nothing on the page changes until it reads.
    expect(pageHtml(modelOf(r))).toContain("Not due for reclaim.");
    await r.controller.refresh();
    markup = pageHtml(modelOf(r));
    expect(markup).toContain("Cancelled at the order source. This journey did not cancel it");
    expect(markup).toContain("Due for reclaim: the order was cancelled. Nothing was reclaimed by that.");
    expect(markup).toContain('data-due-line="reclaim-due"');
    const apply = markup.match(/<button[^>]*id="mkj-apply-ben-0001-ord-0001"[^>]*>/)?.[0] ?? "";
    expect(apply).toContain('aria-disabled="true"');
    expect(markup).toContain("Order ord-0001 is cancelled at the order source, so no benefit applies to it.");
    expect(markup).toContain("Usage and budget restoration on reclaim: UNDETERMINED.");

    const before = markup.match(/Usage recorded \d+\. Usage allowed \d+\./g);
    const done = await step(r, { step: "reclaim", applicationRef: "app-0001" });
    expect(done.kind).toBe("CONFIRMED");
    markup = pageHtml(modelOf(r));
    expect(markup).toContain("Reclaimed at the source.");
    expect(markup).toContain('data-state="reclaimed"');
    expect(markup).toContain("Application app-0001 is already reclaimed.");
    expect(markup.match(/Usage recorded \d+\. Usage allowed \d+\./g)).toEqual(before);
    expect(markup).toContain("Budget in redemptions: committed 3, limit 3, exhausted.");
    expect(markup).toContain(stepResultLine("reclaim", done));
    expectClean(markup);
  });

  it("shows an observed refund as due for reclaim and issues none", async () => {
    const r = await ready();
    await step(r, { step: "apply", benefitRef: "ben-0001", orderRef: "ord-0002" });
    r.port.simulate({ control: "refund-order", orderRef: "ord-0002" });
    await r.controller.refresh();
    const markup = pageHtml(modelOf(r));
    expect(markup).toContain("A refund was observed at the order source. This journey issued none");
    expect(markup).toContain("Due for reclaim: a refund was observed for the order. Nothing was reclaimed or refunded by that.");
    expect(r.port.effects().reclaims).toBe(0);
    expect(buttonLabels(markup).filter((label) => /refund/i.test(label) && !label.startsWith("Simulate:"))).toEqual([]);
    expectClean(markup);
  });
});

describe("unknown, quarantined, and refused results", () => {
  it("a lost apply is shown as unknown, links no application to itself, and a read does not open the benefit", async () => {
    const r = await ready("apply-lost");
    await step(r, { step: "apply", benefitRef: "ben-0002" });
    const markup = pageHtml(modelOf(r), "apply-lost");
    expect(markup).toContain("Apply result unknown (RESPONSE_LOST).");
    expect(markup).toContain('data-unlinked="true"');
    expect(markup).toContain("No application is claimed for it");
    expect(markup).toContain("Observed only. It is not named by a confirmed apply of this page");
    const blocked = markup.match(/<button[^>]*id="mkj-apply-ben-0002-ord-0002"[^>]*>/)?.[0] ?? "";
    expect(blocked).toContain('aria-disabled="true"');
    expect(markup).toContain("An earlier write on this benefit has an unknown result (intent-1).");
    expect(markup).toContain("A read does not resolve it.");
    expect(markup).toContain('data-outcome="UNKNOWN"');
    expect(markup).not.toContain("data-rejection=");
    expectClean(markup);
  });

  it("an answer that claims a reward is not trusted: unknown, blocked, and no reward shown", async () => {
    const r = await ready("receipt-claims-reward");
    await step(r, { step: "apply", benefitRef: "ben-0002" });
    const markup = pageHtml(modelOf(r), "receipt-claims-reward");
    expect(markup).toContain("Apply result unknown (CLAIM).");
    expect(markup).toContain('data-outcome="UNKNOWN"');
    expect(markup).not.toContain("data-rejection=");
    const blocked = markup.match(/<button[^>]*id="mkj-apply-ben-0002-ord-0002"[^>]*>/)?.[0] ?? "";
    expect(blocked).toContain('aria-disabled="true"');
    expectClean(markup);
  });

  it("a result that lands after a session context change is quarantined and the benefit stays blocked", async () => {
    const r = await ready("held-response");
    r.intent += 1;
    const pending = r.controller.run({ step: "apply", intentRef: `intent-${r.intent}`, benefitRef: "ben-0002", orderRef: "ord-0001" });
    await Promise.resolve();
    r.controller.switchContext();
    expect(r.port.deliverHeld()).toBe(1);
    expect((await pending).kind).toBe("QUARANTINED");
    await r.controller.refresh();
    const markup = pageHtml(modelOf(r), "held-response");
    expect(markup).toContain("was quarantined (context-changed). It changed nothing.");
    expect(markup).toContain('data-quarantined="true"');
    expect(markup).toContain("It was sent in an earlier session context.");
    expect(markup).toContain("session 2");
    expect(markup).toContain('id="mkj-deliver-held"');
    // The source did apply the held write. The page sees the application and does not claim it as its own.
    expect(markup).toContain('data-application="app-0001"');
    expect(markup).toContain("Observed only. It is not named by a confirmed apply of this page");
    expect(markup).not.toContain("Named by a confirmed apply of this page.");
    const blocked = markup.match(/<button[^>]*id="mkj-apply-ben-0002-ord-0002"[^>]*>/)?.[0] ?? "";
    expect(blocked).toContain('aria-disabled="true"');
  });

  it("serves another subject scope as denied and offers no row or write there", async () => {
    const r = await ready();
    r.controller.switchContext({ subjectRef: "sub-0002" });
    await r.controller.refresh();
    const model = modelOf(r);
    expect(model.state).toBe("denied");
    const markup = pageHtml(model);
    expect(markup).toContain("Actor fan-desk holds no grant for subject sub-0002.");
    expect(markup).toContain("subject sub-0002");
    expect(markup).not.toContain("data-benefit=");
    expect(markup).toContain("(SCOPE_DENIED)");
    expectClean(markup);
  });
});

describe("figures and non-claims", () => {
  it("copies the source's figures as they come and never adds, subtracts, or normalizes them", async () => {
    const inner = createStubMarketingJourney();
    const odd: MarketingJourneyPort = {
      environment: inner.environment,
      source: inner.source,
      scenario: inner.scenario,
      async read(request): Promise<MarketingReadOutcome> {
        const outcome = await inner.read(request);
        if (outcome.kind !== "ready") {
          return outcome;
        }
        const benefits = outcome.snapshot.benefits.map((benefit) =>
          benefit.benefitRef === "ben-0002"
            ? { ...benefit, usage: { allowed: 9, recorded: 4 }, budget: { unit: "redemption" as const, limit: 12, committed: 7, state: "available" as const } }
            : benefit,
        );
        return { kind: "ready", snapshot: { ...outcome.snapshot, benefits } };
      },
      submit: (request) => inner.submit(request),
      simulate: (request) => inner.simulate(request),
      deliverHeld: () => inner.deliverHeld(),
    };
    const controller = new MarketingJourneyController(odd, { actorRef: "fan-desk", subjectRef: "sub-0001" });
    await controller.refresh();
    const markup = pageHtml(buildMarketingJourneyModel({ controller, environment: "stub", last: null }));
    expect(markup).toContain("Usage recorded 4. Usage allowed 9.");
    expect(markup).toContain("Budget in redemptions: committed 7, limit 12, available.");
    expect(markup).not.toMatch(/\b(5|8|3 left|13|19|11)\b of/);
    expectClean(markup);
  });

  it("prints the seven non-claims on the page and refuses a payload that breaks one", async () => {
    const markup = pageHtml(modelOf(await ready()));
    for (const field of MARKETING_NON_CLAIM_FIELDS) {
      expect(markup, field).toContain(field);
    }
    expect(markup).toContain("a payload that omits one or states it otherwise is refused whole");
    expect(markup).toContain("A benefit notice confirms no purchase and pays no reward.");
    expect(markup).toContain("An application confirms no purchase, pays no reward, and applies no discount.");
  });

  it("separates the consumed CRM scope from the CRM product it does not build or complete", async () => {
    const markup = pageHtml(modelOf(await ready()));
    expect(countOf(markup, "data-crm-row=")).toBe(6);
    expect(countOf(markup, 'data-completes-crm="false"')).toBe(6);
    expect(countOf(markup, 'data-scope="consumed"')).toBe(2);
    expect(countOf(markup, 'data-scope="outside-this-journey"')).toBe(4);
    expect(markup).toContain("Consumed: read only");
    expect(markup).toContain("Outside this journey: not built here");
    expect(markup).toContain("미착수");
    expect(markup).toContain("A screen with no contract does not complete a CRM product.");
    expect(markup).toContain("The channel is none. Nothing here sends a message");
    expect(markup).toContain('data-not-posted="set_consent"');
    expect(markup).toContain('data-not-posted="authorize_marketing"');
    expect(markup).toContain("Setting consent is posted only by ConsentBind on /marketing/m05, never from here.");
    expect(markup).toContain("Only consent has named fields.");
    expect(markup).toContain("kix-protocol:wave7-marketing-contracts is not merged");
    expect(countOf(markup, "data-register-row=")).toBe(11);
    expect(countOf(markup, 'data-status="field-named"')).toBe(4);
    expect(countOf(markup, 'data-status="not-bound"')).toBe(7);
    expect(markup).toContain(COMMERCE_COMMAND_BINDINGS.placeHold.reason);
    expect(markup).toContain('data-hold-record="not-bound"');
    expect(markup).toContain(WORKSPACE_RULING);
  });
});

describe("marketing journey as mounted", () => {
  it("mounts on /marketing/journey in the loading state with the banner, the rulings, and the consent and CRM records", () => {
    const markup = html(
      <MemoryRouter initialEntries={["/marketing/journey"]}>
        <App />
      </MemoryRouter>,
    );
    expect(markup).toContain("Marketing benefit journey (synthetic)");
    expect(markup).toContain('href="/marketing/journey"');
    expect(markup).toContain('data-status-mark="loading"');
    expect(markup).toContain(WORKSPACE_RULING);
    expect(markup).toContain(COMMERCE_COMMAND_BINDINGS.placeHold.reason);
    expect(markup).toContain('data-hold-record="not-bound"');
    expect(markup).toContain("reserve_listing");
    expect(markup).toContain('data-consent-record="read-only"');
    expect(markup).toContain('data-crm-record="outside-this-journey"');
    expect(markup).toContain('data-policy-record="undetermined"');
    expect(markup).toContain('data-source="synthetic-marketing"');
    expect(markup).toContain('data-adapter-environment="stub"');
    expect(markup).toContain('aria-label="Marketing journey sections"');
    expect(markup).toContain('id="mkj-status"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).not.toMatch(/tabindex="[1-9]/);
    expect(markup).not.toContain('href="/booking/');
    expect(markup).not.toMatch(BANNED);
  });

  it("marks exactly one surface link as current on the journey route", () => {
    const markup = html(
      <MemoryRouter initialEntries={["/marketing/journey"]}>
        <App />
      </MemoryRouter>,
    );
    const nav = markup.match(/<nav aria-label="Surfaces">.*?<\/nav>/s)?.[0] ?? "";
    expect(nav).not.toBe("");
    expect(countOf(nav, 'aria-current="page"')).toBe(1);
    expect(nav).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/marketing\/journey"|<a[^>]*href="\/marketing\/journey"[^>]*aria-current="page"/);
    // Elsewhere under /marketing the Marketing link stays the current one.
    const m01 = html(
      <MemoryRouter initialEntries={["/marketing/m01"]}>
        <App />
      </MemoryRouter>,
    );
    const m01Nav = m01.match(/<nav aria-label="Surfaces">.*?<\/nav>/s)?.[0] ?? "";
    expect(countOf(m01Nav, 'aria-current="page"')).toBe(1);
    expect(m01Nav).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/marketing"|<a[^>]*href="\/marketing"[^>]*aria-current="page"/);
  });

  it("is reachable from the shell and from the marketing hub, and the hub makes no new claim", () => {
    const hub = html(
      <MemoryRouter initialEntries={["/marketing"]}>
        <App />
      </MemoryRouter>,
    );
    expect(hub).toContain('href="/marketing/journey"');
    expect(hub).toContain("Benefit journey (synthetic)");
    // On the hub the Marketing link is the current one, and the journey link is not.
    expect(hub).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/marketing"|<a[^>]*href="\/marketing"[^>]*aria-current="page"/);
    expect(hub).not.toMatch(/<a[^>]*aria-current="page"[^>]*href="\/marketing\/journey"|<a[^>]*href="\/marketing\/journey"[^>]*aria-current="page"/);
    expect(hub).toContain("it is not a CRM product");
    expect(hub).not.toContain("production CRM");
    expect(hub).toContain("M05 · 미착수");
    expect(hub).not.toContain("M05 · 설계중");
    const box = html(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(box).toContain('href="/marketing/journey"');
    expect(box).toContain(">Benefit journey<");
  });
});

describe("registration", () => {
  it("is one stub-only buyer surface with no sender, no action, and no desk method", () => {
    const surface = WORKSPACE_SURFACES.find((item) => item.id === "marketing-journey");
    expect(surface).toMatchObject({
      role: "buyer",
      route: "/marketing/journey",
      binding: "stub-only",
      sender: null,
      taskId: "c-marketing-journey-stub",
      implemented: true,
      pageControl: true,
    });
    expect(surface?.actions).toEqual([]);
    expect(surface?.deskMethods).toEqual([]);
    expect(surface?.provenanceNote).toContain("integration-http");
    expect(surface?.provenanceNote).toContain("independent M05 scope");
    expect(surface?.provenanceNote).not.toMatch(/\bworks\b|live payment|funds moved|disbursed|payment complete|admission complete|refund complete/i);
    expect(WORKSPACE_SURFACES.filter((item) => item.taskId === "c-marketing-journey-stub")).toHaveLength(1);
    const row = FEATURE_ROWS.find((item) => item.id === "marketing-journey");
    expect(row).toMatchObject({ status: "synthetic", screenExists: true, protocolIntegrationComplete: false, pendingProducers: ["c-marketing-journey"] });
    expect(row?.commands).toEqual([]);
    const step = ROLE_JOURNEYS.buyer.find((item) => item.id === "marketing");
    expect(step?.surfaces).toContain("marketing-journey");
    expect(step?.protocolIntegrationComplete).toBe(false);
  });

  it("is recorded in the handoff packet as a pending producer that is not connected, and cited as evidence", () => {
    const pending = PENDING_PRODUCERS.find((item) => item.id === "c-marketing-journey");
    expect(pending).toMatchObject({ catalogue: "pending", connected: false, implementedHere: false, waitingSurface: "marketing-journey" });
    expect(pending?.note).toContain("wave7-marketing-contracts");
    expect(pending?.note).toContain("A full CRM product is not built here.");
    const catalogue = JSON.parse(readFileSync(path.join(repoRoot, "docs/aiops/PENDING_NODES.json"), "utf8")) as { nodes: { id: string }[] };
    expect(catalogue.nodes.map((node) => node.id)).toContain("c-marketing-journey");
    const program = JSON.parse(readFileSync(path.join(repoRoot, ".aiops/program.json"), "utf8")) as { nodes: { id: string }[] };
    expect(program.nodes.map((node) => node.id)).toContain("c-marketing-journey-stub");
    const evidence = LOCAL_SURFACE_EVIDENCE.find((item) => item.id === "c-marketing-journey-stub");
    expect(evidence?.doc).toBe("docs/c-marketing-journey-stub-apps-bind.md");
    expect(readFileSync(path.join(repoRoot, evidence?.doc ?? ""), "utf8")).toContain(evidence?.anchor ?? "missing");
  });

  it("has twelve synthetic fixture rows that own no pass and cover reject, unknown, and stale", () => {
    expect(FIXTURE_SCREENS.map((screen) => screen.screenId)).toContain("marketing-journey");
    const rows = fixturesForScreen("marketing-journey");
    expect(rows.map((row) => row.id)).toEqual([
      "marketing-journey.stale-read",
      "marketing-journey.eligibility-stale",
      "marketing-journey.consent-withdrawn",
      "marketing-journey.authorization-stale",
      "marketing-journey.duplicate-use",
      "marketing-journey.usage-limit",
      "marketing-journey.budget-exhausted",
      "marketing-journey.scope-denied",
      "marketing-journey.claim-refused",
      "marketing-journey.apply-lost",
      "marketing-journey.reclaim-lost",
      "marketing-journey.read-lost",
    ]);
    expect(new Set(rows.map((row) => row.klass))).toEqual(new Set(["REJECT", "UNKNOWN", "STALE"]));
    for (const row of rows) {
      expect(row.ownsPass).toBe(false);
      expect(row.source).toBe("synthetic-fixture");
      expect(row.klass).not.toBe("SUCCESS");
      expect(row.substituteStub).toBe(false);
    }
    expect(CONTRACT_FIXTURES.filter((row) => row.screenId === "marketing-journey" && row.klass === "NOT_BOUND")).toEqual([]);
    expect(rows.find((row) => row.id === "marketing-journey.consent-withdrawn")?.code).toBe("CONSENT_WITHDRAWN");
  });

  it("keeps the new screen free of sends, clocks, timers, stores, and the booking, capture, and hold vocabulary", () => {
    const files = ["src/marketing-journey.ts", "src/pages/MarketingJourney.tsx", "src/pages/MarketingJourneyPanels.tsx"];
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
      ".reduce(",
      "parseInt",
      "BigInt",
      "marketingSession",
      "ConsentBind",
    ]) {
      expect(combined, token).not.toContain(token);
    }
    // The journey sends no consent command and builds no body: those words appear only as the adapter's not-posted record.
    expect(combined).not.toContain("expectedConsentVersion");
    const css = readFileSync(path.join(webRoot, "src/styles.css"), "utf8");
    expect(css).toContain(".mkj");
    expect(css).not.toContain("@keyframes");
    expect(css).not.toMatch(/animation\s*:/);
  });

  it("names the surface in the docs and the README", () => {
    const doc = readFileSync(path.join(repoRoot, "docs/c-marketing-journey-stub-apps-bind.md"), "utf8");
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    expect(doc).toContain(WORKSPACE_RULING);
    expect(doc).toContain("marketing-journey");
    expect(doc).toContain("Browser run");
    expect(readme).toContain("docs/c-marketing-journey-stub-apps-bind.md");
    expect(readme).toContain("/marketing/journey");
    const closeout = readFileSync(path.join(repoRoot, "docs/c-local-workspace-closeout-apps-bind.md"), "utf8");
    expect(closeout).toContain("| `c-marketing-journey` | `marketing-journey` |");
    expect(closeout).toContain("docs/c-marketing-journey-stub-apps-bind.md");
    const design = readFileSync(path.join(repoRoot, "docs/workspace-design-apps-bind.md"), "utf8");
    expect(design).toContain("c-marketing-journey-stub-apps-bind.md");
  });
});
