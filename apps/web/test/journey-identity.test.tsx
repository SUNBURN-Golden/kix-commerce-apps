import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  JOURNEY_IDENTITY_DESK_ACTOR,
  JOURNEY_IDENTITY_NOT_BOUND_REASON,
  JOURNEY_IDENTITY_SCENARIOS,
  JourneyIdentityController,
  createNotBoundJourneyIdentity,
  createStubJourneyIdentity,
  type JourneyIdentityScenario,
} from "@kix/protocol-adapter";
import { applyIdentityScenario, buildIdentityModel, identityFenceLine, resetIdentitySession, type IdentityLastAction } from "../src/journey-identity";
import { JourneyIdentityPanel } from "../src/pages/JourneyIdentityPanels";
import { WORKSPACE_SURFACES } from "../src/workspace/registry";

function rig(scenario: JourneyIdentityScenario = "clean") {
  const port = createStubJourneyIdentity({ scenario });
  return { port, controller: new JourneyIdentityController(port, { actorRef: JOURNEY_IDENTITY_DESK_ACTOR, role: "operator" }) };
}

function live(controller: JourneyIdentityController | null, scenario: JourneyIdentityScenario = "clean", last: IdentityLastAction | null = null) {
  return {
    environment: "stub" as "stub" | "integration-http",
    scenario,
    model: buildIdentityModel({ controller, last }),
    heldSupported: scenario === "held-response",
    lateSupported: scenario === "attach-lost",
    actions: {
      refresh() {},
      attach() {},
      switchActor() {},
      switchRole() {},
      rotateCut() {},
      resetSource() {},
      deliverHeld() {},
      deliverLate() {},
      setScenario() {},
    },
  };
}

function markup(args: ReturnType<typeof live>) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <JourneyIdentityPanel live={args} />
    </MemoryRouter>,
  );
}

async function ready(scenario: JourneyIdentityScenario = "clean") {
  const { port, controller } = rig(scenario);
  await controller.refresh();
  return { port, controller };
}

describe("journey identity screen", () => {
  it("shows the context fields and the current observations on a clean read", async () => {
    const { controller } = await ready();
    const html = markup(live(controller));
    expect(html).toContain('data-identity-state="ready"');
    expect(html).toContain('data-source="synthetic-identity"');
    for (const field of ["mode", "actor", "role", "domain", "source cut generation", "pin tuple", "session incarnation"]) {
      expect(html).toContain(`data-context-field="${field}"`);
    }
    expect(html).toContain("a label, not authentication");
    expect(html.match(/data-verdict="current"/g)).toHaveLength(2);
    expect(html).toContain("not a proof of payment, issuance, or admission");
  });

  it("marks foreign rows and keeps their attach controls off", async () => {
    const { controller } = await ready("foreign-mix");
    const html = markup(live(controller, "foreign-mix"));
    expect(html.match(/data-verdict="foreign"/g)).toHaveLength(5);
    expect(html).toContain("never this journey&#x27;s evidence");
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("recorded under an earlier session");
  });

  it("marks older-cut rows stale and a newer-cut row foreign", async () => {
    const { controller } = await ready("older-cut");
    const html = markup(live(controller, "older-cut"));
    expect(html.match(/data-verdict="stale"/g)).toHaveLength(2);
    expect(html.match(/data-verdict="foreign"/g)).toHaveLength(1);
    expect(html).toContain("newer cut");
  });

  it("refuses a claiming payload before a row shows", async () => {
    const { controller } = await ready("claims-proof");
    const html = markup(live(controller, "claims-proof"));
    expect(html).toContain('data-identity-state="refused"');
    expect(html).toContain("refused whole");
  });

  it("shows empty, stale, unavailable, and not-bound states", async () => {
    const empty = await ready("empty");
    expect(markup(live(empty.controller, "empty"))).toContain("No observations in this synthetic session");
    const stale = await ready("stale");
    const staleHtml = markup(live(stale.controller, "stale"));
    expect(staleHtml).toContain('data-identity-state="stale"');
    expect(staleHtml).toContain("older than the floor");
    const nb = new JourneyIdentityController(createNotBoundJourneyIdentity(), { actorRef: JOURNEY_IDENTITY_DESK_ACTOR, role: "operator" });
    await nb.refresh();
    const nbHtml = markup({ ...live(nb), environment: "integration-http" });
    expect(nbHtml).toContain('data-identity-state="not-bound"');
    expect(nbHtml).toContain(JOURNEY_IDENTITY_NOT_BOUND_REASON);
  });

  it("keeps an unknown attach visible and fenced after a source reset", async () => {
    const { port, controller } = rig("attach-lost");
    await controller.refresh();
    const result = await controller.run({ observationId: "obs-0001", intentRef: "i1" });
    await controller.refresh();
    controller.resetSource(createStubJourneyIdentity({ scenario: "clean" }));
    await controller.refresh();
    const html = markup(live(controller, "clean", { seq: 1, kind: "step", result }));
    expect(html).toContain("UNKNOWN");
    expect(html).toContain("isolated");
    expect(html).toContain("stay");
    expect(port.effects().attaches).toBe(1);
  });

  it("says every fence with a word, and keeps the registry row stub-only", () => {
    for (const fence of [
      { reason: "in-flight", intentRef: "i1" },
      { reason: "unknown-outcome", intentRef: "i1", lateRecorded: false, earlierContext: false },
      { reason: "no-snapshot" },
      { reason: "snapshot-stale", cause: "generation-moved" },
      { reason: "duplicate-intent", intentRef: "i1" },
      { reason: "not-current", observationId: "obs-0002", verdict: "foreign" },
      { reason: "not-bound" },
    ] as const) {
      expect(identityFenceLine(fence)).toBeTruthy();
    }
    const surface = WORKSPACE_SURFACES.find((row) => row.id === "journey-identity");
    expect(surface?.route).toBe("/identity");
    expect(surface?.binding).toBe("stub-only");
    expect(surface?.taskId).toBe("c-journey-identity-stub");
    expect([...JOURNEY_IDENTITY_SCENARIOS]).toContain("foreign-mix");
  });

  it("computes no protocol truth in the view layer", () => {
    const html = markup(live(null));
    expect(html).not.toContain("Payment complete");
    expect(html).not.toContain("$");
    expect(html).not.toContain("KRW");
    expect(html).toContain("never sent");
  });
});

describe("source reset keeps the page and controller on one source", () => {
  it("rotates the new source after a reset and the controller sees generation-moved", async () => {
    const first = rig();
    const session = { port: first.port, controller: first.controller };
    await session.controller.refresh();
    const fresh = createStubJourneyIdentity({ scenario: "clean" });
    resetIdentitySession(session, fresh);
    expect(session.port).toBe(fresh);
    await session.controller.refresh();
    session.port.rotateCut();
    const result = await session.controller.refresh();
    expect(result.kind).not.toBe("CURRENT");
    expect(first.port.effects().submits).toBe(0);
  });
});

describe("a scenario change keeps earlier unknowns", () => {
  it("still fences the unknown subject, never reissues intent-1, and sends nothing to the new source", async () => {
    const first = rig("attach-lost");
    const session = { port: first.port, controller: first.controller };
    await session.controller.refresh();
    const result = await session.controller.run({ observationId: "obs-0001", intentRef: "intent-1" });
    expect(result.kind).toBe("UNKNOWN");
    applyIdentityScenario(session, "stub", "clean");
    expect(session.port).not.toBe(first.port);
    expect(session.port.scenario).toBe("clean");
    await session.controller.refresh();
    expect(session.controller.gateFor({ observationId: "obs-0001", intentRef: "intent-2" })).toMatchObject({ reason: "unknown-outcome", earlierContext: true });
    expect(session.controller.gateFor({ observationId: "obs-0001", intentRef: "intent-1" })).toMatchObject({ reason: "duplicate-intent" });
    expect((await session.controller.run({ observationId: "obs-0001", intentRef: "intent-2" })).kind).toBe("FENCED");
    expect(session.port.effects().attaches).toBe(0);
    expect((await session.controller.run({ observationId: "obs-0002", intentRef: "intent-2" })).kind).toBe("CONFIRMED");
    const html = markup(live(session.controller, "clean"));
    expect(html).toContain("UNKNOWN");
    expect(html).toContain("isolated");
  });

  it("says so on the page and builds one controller per environment", () => {
    const html = markup(live(null));
    expect(html).toContain("keep fencing");
    expect(html).not.toContain("as a reload would");
    const source = readFileSync(new URL("../src/journey-identity.ts", import.meta.url), "utf8");
    expect(source.match(/new JourneyIdentityController\(/g)).toHaveLength(1);
    expect(source).not.toContain("intentCounter.current = 0");
  });
});
