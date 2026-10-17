import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  COMMERCE_COMMAND_BINDINGS,
  JOURNEY_COMPOSED,
  JOURNEY_NOT_COMPOSED,
  mapOperationalError,
  OPENAPI_CONTRACT_PIN,
  OPENAPI_INTEGRATION_GATE_PIN,
} from "@kix/protocol-adapter";
import { App } from "../src/App";
import { PROMOTED_FROM_PENDING } from "./support/local-evidence-matrix";
import {
  buildHandoffView,
  claimRefused,
  FEATURE_ROWS,
  FEATURE_STATUSES,
  filterFeatures,
  FIRST_RUN,
  HANDOFF_NON_CLAIMS,
  HANDOFF_PINS,
  HANDOFF_ROUTE,
  HANDOFF_RULING,
  LOCAL_COMMAND_SCREENS,
  LOCAL_SURFACE_EVIDENCE,
  lookupDiagnosis,
  nextRole,
  ORIGINAL10_EVIDENCE,
  PENDING_PRODUCERS,
  PLACE_HOLD_HANDOFF,
  ROLE_JOURNEYS,
  SUPPORTED_COMMANDS,
  TRANSPORT_DIAGNOSES,
  UNCONNECTED_SCREENS,
} from "../src/handoff/packet";
import { HandoffScreen } from "../src/pages/Handoff";
import { BUYER_FLOW_STAGE_IDS, SENDER_ACTIONS, WORKSPACE_RULING, WORKSPACE_SURFACES } from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

const BINDINGS_SHA256 = "83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249";

function renderScreen(phase: "loading" | "settled", query = "", code = "", role: "buyer" | "organizer" | "operator" = "buyer") {
  return renderToStaticMarkup(
    <MemoryRouter>
      <HandoffScreen
        phase={phase}
        adapter="stub"
        environment="stub"
        fundsMovement="none"
        publicDeploy={false}
        initialQuery={query}
        initialCode={code}
        initialRole={role}
      />
    </MemoryRouter>,
  );
}

describe("local handoff packet", () => {
  it("keeps every surface unclassified as protocol integration", () => {
    expect(HANDOFF_RULING).toBe(WORKSPACE_RULING);
    expect(HANDOFF_NON_CLAIMS.publicServiceComplete).toBe(false);
    expect(HANDOFF_NON_CLAIMS.realPaymentComplete).toBe(false);
    expect(HANDOFF_NON_CLAIMS.realAdmissionComplete).toBe(false);
    expect(HANDOFF_NON_CLAIMS.qualificationState).toBe("UNQUALIFIED");
    expect(HANDOFF_NON_CLAIMS.releaseState).toBe("NOT_AUTHORIZED");
    expect([...FEATURE_ROWS.map((row) => row.id)].sort()).toEqual([...WORKSPACE_SURFACES.map((surface) => surface.id)].sort());
    expect(new Set(FEATURE_ROWS.map((row) => row.id)).size).toBe(FEATURE_ROWS.length);

    for (const row of FEATURE_ROWS) {
      expect(row.protocolIntegrationComplete).toBe(false);
      expect(row.integrationReason).toBe("A screen does not complete protocol integration.");
      expect(FEATURE_STATUSES).toContain(row.status);
      const surface = WORKSPACE_SURFACES.find((item) => item.id === row.id);
      expect(surface).toBeDefined();
      if (row.screenExists) {
        expect(surface?.pageControl).toBe(true);
        expect(row.integrationReason).toContain("screen");
      }
      if (row.status === "local-command") {
        expect(surface?.binding).toBe("published-bound");
        expect(surface?.sender).not.toBeNull();
        expect([...row.commands]).toEqual([...(surface?.actions ?? [])]);
      } else {
        expect(row.commands).toEqual([]);
      }
    }

    expect(LOCAL_COMMAND_SCREENS.every((row) => row.protocolIntegrationComplete === false)).toBe(true);
    expect(UNCONNECTED_SCREENS.every((row) => row.status !== "local-command" && row.screenExists)).toBe(true);
    expect(UNCONNECTED_SCREENS.map((row) => row.id)).toContain("discovery-prototype");
    expect(UNCONNECTED_SCREENS.map((row) => row.id)).toContain("admission-credential");
    expect(LOCAL_COMMAND_SCREENS.map((row) => row.id)).toContain("booking-journey");
    expect(LOCAL_COMMAND_SCREENS.map((row) => row.id)).not.toContain("admission-credential");
    expect(FEATURE_ROWS.find((row) => row.id === "operator-transport")?.status).toBe("unsupported");
    expect(FEATURE_ROWS.find((row) => row.id === "accessibility-baseline")?.status).toBe("unsupported");
    expect(FEATURE_ROWS.find((row) => row.id === "box-office-settlement")?.status).toBe("synthetic");
    expect(WORKSPACE_SURFACES.map((surface) => surface.id)).not.toContain("local-handoff");
  });

  it("posts only the existing sender actions and leaves placeHold not-bound", () => {
    expect(PLACE_HOLD_HANDOFF).toEqual({
      method: "placeHold",
      status: "not-bound",
      consideredAction: "reserve_listing",
      mappedOntoPrepareTrade: false,
      reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
    });
    expect(PLACE_HOLD_HANDOFF.consideredAction).toBe(COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction);
    expect(COMMERCE_COMMAND_BINDINGS.placeHold.status).toBe("not-bound");
    expect(COMMERCE_COMMAND_BINDINGS.confirmBooking.consideredAction).not.toBe("prepare_trade");
    expect(COMMERCE_COMMAND_BINDINGS.settlementPreview.consideredAction).toBe("settle_capture");

    const sent = SUPPORTED_COMMANDS.map((command) => command.action);
    expect(sent).not.toContain("capture");
    expect(sent).not.toContain("settle_capture");
    expect(sent).not.toContain("commit_trade");
    expect(sent).not.toContain("admit");
    expect(sent).not.toContain("refund_ticket");
    expect(sent).not.toContain("placeHold");
    expect(sent.filter((action) => action === "create_event")).toHaveLength(2);
    expect(SUPPORTED_COMMANDS.find((command) => command.sender === "BookingJourney" && command.action === "create_event")?.surfaces).toEqual([
      "booking-journey",
    ]);
    expect(SUPPORTED_COMMANDS.find((command) => command.action === "open_admission")?.surfaces).toEqual([
      "organizer-console",
      "organizer-workspace",
    ]);
    expect([...SENDER_ACTIONS.BookingJourney]).toEqual([...JOURNEY_COMPOSED]);
    expect(JOURNEY_NOT_COMPOSED.map((entry) => entry.action)).toEqual([
      "capture",
      "settle_capture",
      "commit_trade",
      "open_admission",
      "admit",
    ]);
    for (const command of SUPPORTED_COMMANDS) {
      expect(command.localOnly).toBe(true);
      expect(command.protocolIntegrationComplete).toBe(false);
      expect(command.surfaces.length).toBeGreaterThan(0);
    }
    expect(SUPPORTED_COMMANDS).toHaveLength(
      SENDER_ACTIONS.BookingJourney.length +
        SENDER_ACTIONS.OrganizerConsole.length +
        SENDER_ACTIONS.GiftTransfer.length +
        SENDER_ACTIONS.ConsentBind.length,
    );
  });

  it("separates unknown, not-bound, and stale, and does not fall back", () => {
    expect(lookupDiagnosis("")).toEqual({ kind: "empty" });
    expect(lookupDiagnosis("UNKNOWN")).toMatchObject({ kind: "outcome", confirmsSuccess: false });
    expect(lookupDiagnosis("NOT_BOUND")).toMatchObject({ kind: "outcome", confirmsSuccess: false });
    expect(lookupDiagnosis("STALE")).toMatchObject({ kind: "outcome", confirmsSuccess: false });
    expect(lookupDiagnosis("REJECT")).toMatchObject({ kind: "outcome", confirmsSuccess: false });
    expect(lookupDiagnosis("NO_SUCH_CODE")).toEqual({ kind: "unknown" });
    expect(lookupDiagnosis("payment complete")).toEqual({ kind: "refused" });
    expect(claimRefused("integration complete")).toBe(true);
    expect(claimRefused("local-command")).toBe(false);

    const stale = TRANSPORT_DIAGNOSES.find((row) => row.code === "STALE_RESPONSE");
    expect(stale?.fixtureClass).toBe("STALE");
    expect(stale?.confirmsSuccess).toBe(false);
    expect(stale?.transport).toBe("unavailable");
    for (const row of TRANSPORT_DIAGNOSES) {
      const mapped = mapOperationalError(row.code);
      expect(mapped.state).toBe(row.transport);
      expect(mapped.retry).toBe(false);
      expect(mapped.fallbackToStub).toBe(false);
      expect(row.retry).toBe(false);
      expect(row.fallbackToStub).toBe(false);
      expect(row.confirmsSuccess).toBe(false);
    }
    expect(FIRST_RUN.ciSkip).toContain("not a live-gate pass");
    expect(HANDOFF_PINS.consumedProducerChange).toBe(false);
    expect(HANDOFF_PINS.sdkDigest).toBeNull();
    expect(HANDOFF_PINS.contractOpenApiSha256).toBe(OPENAPI_CONTRACT_PIN.openApiFileSha256);
    expect(HANDOFF_PINS.gateOpenApiSha256).toBe(OPENAPI_INTEGRATION_GATE_PIN.openApiFileSha256);
    expect(HANDOFF_PINS.protocolMergeSha).toBe(OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha);
    const ci = readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain(`KIX_PROTOCOL_GATE_SHA: ${HANDOFF_PINS.protocolMergeSha}`);
  });

  it("keeps pending producers unconnected and preserves the original ten documents", () => {
    const pending = JSON.parse(readFileSync(path.join(repoRoot, "docs/aiops/PENDING_NODES.json"), "utf8")) as {
      nodes: { id: string }[];
    };
    const program = JSON.parse(readFileSync(path.join(repoRoot, ".aiops/program.json"), "utf8")) as {
      nodes: { id: string }[];
    };
    const pendingIds = new Set(pending.nodes.map((node) => node.id));
    const programIds = program.nodes.map((node) => node.id);
    expect(programIds.slice(0, ORIGINAL10_EVIDENCE.length)).toEqual(ORIGINAL10_EVIDENCE.map((item) => item.id));
    expect(programIds).toContain("c-local-workspace-closeout");
    expect(ORIGINAL10_EVIDENCE).toHaveLength(10);

    for (const row of PENDING_PRODUCERS) {
      expect(row.catalogue).toBe("pending");
      expect(row.connected).toBe(false);
      expect(row.implementedHere).toBe(false);
      expect(pendingIds.has(row.id)).toBe(true);
      // A pending node promoted by a plan revision stays in the pending catalogue as history and may be active; it stays unconnected here until its own node merges.
      if (!PROMOTED_FROM_PENDING.includes(row.id)) expect(programIds).not.toContain(row.id);
      if (row.waitingSurface) {
        expect(FEATURE_ROWS.map((feature) => feature.id)).toContain(row.waitingSurface);
      }
    }

    for (const item of [...ORIGINAL10_EVIDENCE, ...LOCAL_SURFACE_EVIDENCE]) {
      const text = readFileSync(path.join(repoRoot, item.doc), "utf8");
      expect(text, item.id).toContain(item.anchor);
    }
  });

  it("cites each stub node as evidence and keeps its pending row on the stub surface", () => {
    const program = JSON.parse(readFileSync(path.join(repoRoot, ".aiops/program.json"), "utf8")) as {
      nodes: { id: string }[];
    };
    const programIds = program.nodes.map((node) => node.id);
    const evidenceIds = LOCAL_SURFACE_EVIDENCE.map((item) => item.id);
    expect(new Set(evidenceIds).size).toBe(evidenceIds.length);

    for (const nodeId of [
      "c-discovery-live-stub",
      "c-inventory-venue-stub",
      "c-platform-journey-stub",
      "c-merchant-operations-stub",
    ]) {
      expect(programIds, nodeId).toContain(nodeId);
      expect(LOCAL_SURFACE_EVIDENCE.find((item) => item.id === nodeId)?.doc, nodeId).toBe(`docs/${nodeId}-apps-bind.md`);
      const surfaces = WORKSPACE_SURFACES.filter((surface) => surface.taskId === nodeId);
      expect(surfaces, nodeId).toHaveLength(1);
      const pending = PENDING_PRODUCERS.find((row) => row.id === nodeId.replace(/-stub$/, ""));
      expect(pending?.waitingSurface, nodeId).toBe(surfaces[0]?.id);
      expect(FEATURE_ROWS.find((row) => row.id === surfaces[0]?.id)?.pendingProducers, nodeId).toContain(pending?.id);
    }
    expect(FEATURE_ROWS.find((row) => row.id === "discovery-prototype")?.pendingProducers).not.toContain("c-discovery-live");
  });

  it("matches the closeout table to the pending rows and the evidence documents", () => {
    const doc = readFileSync(path.join(repoRoot, "docs/c-local-workspace-closeout-apps-bind.md"), "utf8");
    for (const row of PENDING_PRODUCERS) {
      const surface = row.waitingSurface === null ? "none" : `\`${row.waitingSurface}\``;
      expect(doc, row.id).toContain(`| \`${row.id}\` | ${surface} |`);
    }
    for (const item of LOCAL_SURFACE_EVIDENCE) {
      expect(doc, item.id).toContain(item.doc);
    }
  });

  it("moves the role with the arrow keys and filters without promoting a claim", () => {
    expect(nextRole("buyer", "ArrowRight")).toBe("organizer");
    expect(nextRole("operator", "ArrowRight")).toBe("buyer");
    expect(nextRole("buyer", "ArrowLeft")).toBe("operator");
    expect(nextRole("organizer", "Home")).toBe("buyer");
    expect(nextRole("buyer", "End")).toBe("operator");
    expect(nextRole("buyer", "Enter")).toBeNull();
    expect(filterFeatures("")).toHaveLength(FEATURE_ROWS.length);
    expect(filterFeatures("zzzz-not-a-row")).toEqual([]);
    expect(filterFeatures("booking-journey").map((row) => row.id)).toEqual(["booking-journey"]);

    expect(buildHandoffView({ phase: "loading", query: "", code: "", role: "buyer" }).state).toBe("loading");
    expect(buildHandoffView({ phase: "settled", query: "", code: "", role: "buyer" }).state).toBe("ready");
    expect(buildHandoffView({ phase: "settled", query: "zzzz-not-a-row", code: "", role: "buyer" }).state).toBe("empty");
    expect(buildHandoffView({ phase: "settled", query: "payment complete", code: "", role: "buyer" })).toMatchObject({
      state: "error",
      focusId: "handoff-query",
      features: [],
    });
    expect(buildHandoffView({ phase: "settled", query: "", code: "NO_SUCH_CODE", role: "operator" })).toMatchObject({
      state: "error",
      focusId: "handoff-code",
    });
    expect(buildHandoffView({ phase: "settled", query: "", code: "NOT_BOUND", role: "organizer" }).diagnosis?.confirmsSuccess).toBe(
      false,
    );
    expect(ROLE_JOURNEYS.buyer.map((step) => step.id)).toEqual([...BUYER_FLOW_STAGE_IDS, "marketing", "delegated-assistant"]);
    expect(ROLE_JOURNEYS.buyer.find((step) => step.id === "delegated-assistant")?.surfaces).toContain("delegated-assistant");
    expect(ROLE_JOURNEYS.buyer.every((step) => step.protocolIntegrationComplete === false)).toBe(true);
    expect(ROLE_JOURNEYS.organizer.map((step) => step.id)).toEqual([
      "organizer-console",
      "organizer-workspace",
      "box-office-settlement",
      "merchant-operations",
      "credit-origination",
    ]);
    expect(ROLE_JOURNEYS.operator.map((step) => step.id)).toContain("local-handoff");
    expect(ROLE_JOURNEYS.operator.find((step) => step.id === "local-handoff")?.route).toBe(HANDOFF_ROUTE);
  });

  it("renders loading, ready, empty, and error without posting", () => {
    const loading = renderScreen("loading");
    expect(loading).toContain('data-state="loading"');
    expect(loading).toContain("Reading the local handoff packet. Nothing is sent.");
    expect(loading).toContain("Loading");
    expect(loading).not.toContain('data-feature="booking-journey"');

    const ready = renderScreen("settled");
    expect(ready).toContain('data-state="ready"');
    expect(ready).toContain(HANDOFF_RULING);
    expect(ready).toContain("Protocol integration is not complete.");
    expect(ready).toContain("UNQUALIFIED");
    expect(ready).toContain("NOT_AUTHORIZED");
    expect(ready).toContain("reserve_listing");
    expect(ready).toContain("127.0.0.1");
    expect(ready).toContain("npm run dev");
    expect(ready).toContain('data-integration="not-complete"');
    expect(ready).toContain('role="tablist"');
    expect(ready).toContain('aria-selected="true"');
    expect(ready).toContain("w6a-journey-map");
    expect(ready).toContain("bind-admission-fsm");
    expect(ready).toContain("not complete");
    expect(ready).not.toContain("settle_capture");
    expect(ready).not.toContain("invokeLocalCall");
    expect(ready).not.toMatch(/[$₩]|KRW|USD/);
    expect(ready).not.toMatch(/payment complete|admission complete|funds moved/i);

    const empty = renderScreen("settled", "zzzz-not-a-row");
    expect(empty).toContain('data-state="empty"');
    expect(empty).toContain("No handoff row matches this query.");
    expect(empty).not.toContain('data-feature="booking-journey"');

    const refused = renderScreen("settled", "payment complete");
    expect(refused).toContain('data-state="error"');
    expect(refused).toContain("refuses that completion claim");
    expect(refused).toContain('aria-invalid="true"');
    expect(refused).toContain("Blocked");
    expect(refused).not.toContain('data-feature="booking-journey"');

    const unknown = renderScreen("settled", "", "NO_SUCH_CODE");
    expect(unknown).toContain('data-state="error"');
    expect(unknown).toContain("not in the local diagnosis list");
    expect(unknown).toContain('id="handoff-code"');

    const organizer = renderScreen("settled", "", "", "organizer");
    expect(organizer).toContain('data-step="organizer-workspace"');
    expect(organizer).toContain("not one atomic transaction");

    const app = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/handoff"]}>
        <App />
      </MemoryRouter>,
    );
    expect(app).toContain("Local handoff");
    expect(app).toContain('data-state="loading"');
    expect(app).toContain('href="/handoff"');

    const files = ["src/handoff/packet.ts", "src/pages/Handoff.tsx"];
    const combined = files.map((file) => readFileSync(path.join(webRoot, file), "utf8")).join("\n");
    for (const token of ["fetch(", "invokeLocalCall", "settle_capture", "contract-fixtures", "XMLHttpRequest"]) {
      expect(combined, token).not.toContain(token);
    }
    const css = readFileSync(path.join(webRoot, "src/styles.css"), "utf8");
    expect(css).toContain(".handoff-tab");
    expect(css).toContain("44px");
    expect(css).not.toContain("@keyframes");
    expect(css).not.toMatch(/animation\s*:/);

    const doc = readFileSync(path.join(repoRoot, "docs/c-local-workspace-closeout-apps-bind.md"), "utf8");
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    expect(doc).toContain(HANDOFF_RULING);
    expect(doc).toContain(HANDOFF_ROUTE);
    expect(doc).toContain("A screen does not complete protocol integration.");
    expect(doc).toContain("Browser run");
    expect(readme).toContain("docs/c-local-workspace-closeout-apps-bind.md");
    for (const item of ORIGINAL10_EVIDENCE) {
      expect(doc).toContain(item.id);
      expect(doc).toContain(item.doc);
    }
    const bindings = readFileSync(path.join(repoRoot, "packages/protocol-adapter/src/commerce-bindings.ts"));
    expect(createHash("sha256").update(bindings).digest("hex")).toBe(BINDINGS_SHA256);
  });
});
