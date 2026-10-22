import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { COMMERCE_METHODS, PINNED_PROTOCOL_DOMAIN } from "@kix/protocol-adapter";
import {
  CONTRACT_FIXTURES,
  FIXTURE_CLASSES,
  FIXTURE_RULING,
  FIXTURE_SCREENS,
  FIXTURE_TUPLE_LITERALS,
  acceptRecordedPass,
  assertCatalogueBound,
  classifyAgainstFixture,
  fixtureById,
  fixturesForScreen,
  liveTupleKey,
  notBoundScreenOf,
  projectFixture,
  type ContractFixture,
} from "../../../packages/protocol-adapter/src/contract-fixtures";
import {
  fixtureObservationFor,
  createSdk0MockScenario,
  SDK0_MOCK_SCENARIO_IDS,
  scenarioObservation,
  type Sdk0MockScenario,
} from "../../../packages/protocol-adapter/src/sdk0-mock-scenarios";
import {
  considerReceipt,
  explainReceipt,
  profileFor,
  type ReceiptContext,
  type ReceiptScreen,
} from "../src/receipt-explorer";
import { WORKSPACE_SURFACES } from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }
    if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      found.push(full);
    }
  }
  return found;
}

function receiptContext(screenId: string): ReceiptContext | null {
  switch (screenId) {
    case "booking-journey":
    case "receipt-explorer":
      return "journey";
    case "gift-transfer":
      return "gift";
    case "marketing-m05":
      return "consent";
    case "organizer-console":
      return "organizer";
    default:
      return null;
  }
}

function noteFor(fixture: ContractFixture): string {
  if (fixture.screenStatus === "confirmed") {
    return "Confirmed stub-shape receipt. Not from the gate.";
  }
  if (fixture.screenStatus === "rejected" && fixture.code) {
    return `Rejected by the gate (${fixture.code}).`;
  }
  if (fixture.screenStatus === "unknown") {
    return "Unconfirmed: sent, no authoritative receipt. May have applied. Not a rejection.";
  }
  return "";
}

function candidateFor(fixture: ContractFixture, sessionId: string, scenario?: Sdk0MockScenario): Record<string, unknown> | null {
  if (!fixture.identity) {
    return null;
  }
  if (fixture.source !== "stub-shape" && fixture.source !== "integration-gate" && fixture.source !== "none") {
    return null;
  }
  const surface = WORKSPACE_SURFACES.find((item) => item.id === fixture.screenId);
  const context = receiptContext(fixture.screenId);
  if (!surface || !context) {
    return null;
  }
  const profile = profileFor(scenario?.source ?? fixture.source);
  return {
    sessionId,
    role: surface.role,
    actor: fixture.identity.actor,
    context,
    domain: PINNED_PROTOCOL_DOMAIN,
    action: fixture.identity.action,
    operationId: fixture.identity.operationId,
    status: fixture.screenStatus,
    source: scenario?.source ?? fixture.source,
    profile: profile.profile,
    profileVersion: profile.profileVersion,
    code: fixture.code,
    requestId: scenario?.failure?.requestId ?? null,
    correlationId: scenario?.failure?.correlationId ?? null,
    refId: "evt_fixture",
    sequence: scenario?.receipt?.sequence ?? 1,
    note: scenario ? "Synthetic SDK0 mock scenario. Not from the gate." : noteFor(fixture),
    fields: (scenario ? scenarioObservation(scenario).presentFields : fixture.resultKeys)
      .map((key) => ({ key, value: scenario?.receipt ? String(scenario.receipt.result[key]) : "recorded" })),
  };
}

function screenFor(fixture: ContractFixture, sessionId: string): ReceiptScreen {
  const surface = WORKSPACE_SURFACES.find((item) => item.id === fixture.screenId);
  const context = receiptContext(fixture.screenId);
  if (!surface || !context || !fixture.identity) {
    throw new Error(`fixture ${fixture.id} has no receipt screen`);
  }
  return {
    sessionId,
    role: surface.role,
    actors: [fixture.identity.actor],
    contexts: [context],
    domain: PINNED_PROTOCOL_DOMAIN,
  };
}

function FixtureClassTable() {
  return (
    <table>
      <caption>Contract fixture classes for this tuple</caption>
      <tbody>
        {SDK0_MOCK_SCENARIO_IDS.map((id) => {
          const scenario = createSdk0MockScenario({ fixtureId: id, seed: 7 });
          const { fixture, projection: view } = scenario;
          return (
            <tr key={id} data-fixture={id} data-class={view.klass} data-confirmed={view.confirmed ? "true" : "false"}>
              <td>{fixture.screenId}</td>
              <td>{view.screenStatus}</td>
              <td>{fixture.consideredAction ?? fixture.identity?.action ?? "none"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

describe("contract fixture library on the desk", () => {
  it("uses the same catalogue as the adapter and the screen registry", () => {
    expect(() => assertCatalogueBound()).not.toThrow();
    expect(FIXTURE_RULING).toBe("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
    expect([...FIXTURE_SCREENS.map((screen) => screen.screenId)].sort()).toEqual(
      [...WORKSPACE_SURFACES.map((surface) => surface.id)].sort(),
    );
    for (const screen of FIXTURE_SCREENS) {
      const surface = WORKSPACE_SURFACES.find((item) => item.id === screen.screenId);
      expect(surface?.route).toBe(screen.route);
      const methods = fixturesForScreen(screen.screenId)
        .filter((fixture) => fixture.klass === "NOT_BOUND")
        .map((fixture) => fixture.method);
      expect([...methods].sort()).toEqual([...(surface?.deskMethods ?? [])].sort());
    }
    for (const method of COMMERCE_METHODS) {
      const surface = WORKSPACE_SURFACES.find((item) => item.id === notBoundScreenOf(method));
      expect(surface?.deskMethods).toContain(method);
    }
    const create = fixtureById("booking-journey.create_event.success");
    expect(classifyAgainstFixture(create.id, fixtureObservationFor(create))).toMatchObject({ ok: true, confirmed: true });
    expect(classifyAgainstFixture(create.id, fixtureObservationFor(create, { tupleKey: "previous-tuple" }))).toMatchObject({
      ok: false,
      reason: "DIFFERENT_TUPLE",
    });
    expect(
      acceptRecordedPass(
        { tupleKey: liveTupleKey(), caseId: create.id, klass: "SUCCESS" },
        "organizer-console.create_event.success",
      ),
    ).toEqual({ accepted: false, reason: "DIFFERENT_CASE" });
  });

  it("projects each receipt-shaped fixture through the explorer without confirming a failure", () => {
    const sessionId = "page:fixture01";
    const html = renderToStaticMarkup(<FixtureClassTable />);
    expect(html).toContain("Contract fixture classes for this tuple");
    for (const klass of FIXTURE_CLASSES) {
      expect(html).toContain(`data-class="${klass}"`);
    }
    expect(html).toContain('data-fixture="booking-journey.create_event.success" data-class="SUCCESS" data-confirmed="true"');
    expect(html).toContain('data-fixture="booking-journey.create_event.unknown" data-class="UNKNOWN" data-confirmed="false"');
    expect(html).toContain('data-fixture="booking-journey.create_event.stale" data-class="STALE" data-confirmed="false"');
    expect(html).toContain('data-fixture="not-bound.placeHold" data-class="NOT_BOUND" data-confirmed="false"');
    expect(html).toContain("reserve_listing");
    expect(html).not.toContain("$");
    expect(html).not.toContain("KRW");
    expect(html).not.toContain("USD");

    for (const fixture of CONTRACT_FIXTURES) {
      const view = projectFixture(fixture);
      expect(view.fallbackToStub).toBe(false);
      expect(view.retry).toBe(false);
      expect(view.readConfirmsUnknown).toBe(false);
      expect(view.substituteStub).toBe(false);
      expect(view.confirmed).toBe(fixture.klass === "SUCCESS");
      const raw = candidateFor(fixture, sessionId);
      if (!raw) {
        expect(view.confirmed).toBe(false);
        continue;
      }
      const kept = considerReceipt(screenFor(fixture, sessionId), raw);
      expect(kept.kind, fixture.id).toBe("kept");
      if (kept.kind !== "kept") {
        continue;
      }
      const explained = explainReceipt(kept.receipt);
      expect(explained.status).toBe(fixture.screenStatus);
      expect(explained.confirmed).toBe(fixture.klass === "SUCCESS");
      if (fixture.klass === "UNKNOWN") {
        expect(explained.unconfirmed).toBe(true);
        expect(explained.confirmed).toBe(false);
      }
      if (fixture.klass === "STALE" || fixture.klass === "REJECT") {
        expect(explained.confirmed).toBe(false);
      }
    }
  });

  it("rejects a malformed row, a new status enum, and a different actor or session", () => {
    const sessionId = "page:fixture01";
    const success = fixtureById("booking-journey.create_event.success");
    const raw = candidateFor(success, sessionId);
    if (!raw) {
      throw new Error("missing success candidate");
    }
    const missing = { ...raw };
    delete missing.sessionId;
    expect(considerReceipt(screenFor(success, sessionId), missing)).toMatchObject({
      kind: "rejected",
      reason: "MALFORMED",
    });
    expect(considerReceipt(screenFor(success, sessionId), { ...raw, status: "complete" })).toMatchObject({
      kind: "rejected",
      reason: "MALFORMED",
    });
    expect(considerReceipt(screenFor(success, sessionId), { ...raw, actor: "desk-organizer" })).toMatchObject({
      kind: "rejected",
      reason: "DIFFERENT_ACTOR",
    });
    expect(considerReceipt(screenFor(success, sessionId), { ...raw, domain: "kix:other" })).toMatchObject({
      kind: "rejected",
      reason: "DIFFERENT_CONTEXT",
    });
    expect(considerReceipt(screenFor(success, sessionId), { ...raw, sessionId: "page:other" })).toMatchObject({
      kind: "dropped",
      reason: "DIFFERENT_SESSION",
    });
    expect(classifyAgainstFixture(success.id, fixtureObservationFor(success, { action: "prepare_trade" }))).toMatchObject({
      ok: false,
      reason: "DIFFERENT_IDENTITY",
    });
    expect(classifyAgainstFixture("not-bound.placeHold", fixtureObservationFor(fixtureById("not-bound.placeHold"), { method: undefined, action: "prepare_trade" }))).toMatchObject({
      ok: false,
      reason: "DIFFERENT_IDENTITY",
    });
  });

  it("also projects seeded kit output with synthetic provenance through the explorer", () => {
    const sessionId = "page:fixture01";
    for (const fixtureId of SDK0_MOCK_SCENARIO_IDS) {
      const scenario = createSdk0MockScenario({ fixtureId, seed: 7 });
      const raw = candidateFor(scenario.fixture, sessionId, scenario);
      if (scenario.klass === "NOT_BOUND") {
        expect(raw).toBeNull();
        continue;
      }
      expect(raw).toMatchObject({ source: "stub-shape", status: scenario.fixture.screenStatus });
      if (scenario.receipt) {
        expect(raw?.fields).toEqual(Object.entries(scenario.receipt.result).map(([key, value]) => ({ key, value: String(value) })));
      }
      const kept = considerReceipt(screenFor(scenario.fixture, sessionId), raw);
      expect(kept.kind, fixtureId).toBe("kept");
      if (kept.kind !== "kept") throw new Error("kit candidate was refused");
      const explained = explainReceipt(kept.receipt);
      expect(explained.status).toBe(scenario.fixture.screenStatus);
      expect(explained.confirmed).toBe(scenario.klass === "SUCCESS");
    }
  });

  it("keeps the catalogue out of screen source and names every screen in the mapping doc", () => {
    const combined = sourceFiles(path.join(webRoot, "src"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(combined).not.toContain("contract-fixtures");
    expect(combined).not.toContain("sdk0-mock-scenarios");
    expect(combined).not.toContain("generateFixture");
    expect(combined).not.toContain("fetch(");

    const doc = readFileSync(path.join(repoRoot, "docs/c-contract-fixture-library-apps-bind.md"), "utf8");
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    expect(doc).toContain(FIXTURE_RULING);
    expect(doc).toContain(`Catalogue version \`${FIXTURE_TUPLE_LITERALS.catalogueVersion}\``);
    expect(doc).toContain(FIXTURE_TUPLE_LITERALS.protocolMergeSha);
    expect(doc).toContain(FIXTURE_TUPLE_LITERALS.contractOpenApiSha256);
    expect(doc).toContain(FIXTURE_TUPLE_LITERALS.gateOpenApiSha256);
    expect(readme).toContain("docs/c-contract-fixture-library-apps-bind.md");
    expect(readme).toContain(FIXTURE_RULING);
    for (const screen of FIXTURE_SCREENS) {
      expect(doc).toContain(screen.screenId);
    }
    for (const fixture of CONTRACT_FIXTURES) {
      if (fixture.klass === "NOT_BOUND") {
        continue;
      }
      expect(doc).toContain(fixture.id);
    }
    expect(doc).toContain("no fixture pass");
  });
});
