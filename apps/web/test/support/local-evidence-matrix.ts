/**
 * Local evidence matrix (stub). App-internal; not a public schema, operation, capability or ID.
 *
 * Four facets stay in four columns and never fold into one status: node_state, qualification_state,
 * acceptance_state, release_state. This module only reads existing exports and files. It decides nothing,
 * approves nothing, and computes no protocol value. The rendered lines are what the bind doc must contain.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMMERCE_COMMAND_BINDINGS,
  COMMERCE_METHODS,
  CROSS_SURFACE_JOURNEYS,
  rowIdFor,
  type CrossSurfaceBranch,
  type CrossSurfaceJourney,
  type CrossSurfaceRow,
  OPENAPI_CONTRACT_PIN,
  OPENAPI_INTEGRATION_GATE_PIN,
  RELEASE_DECISIONS,
  RELEASE_DENOMINATORS,
} from "@kix/protocol-adapter";
import { CONTRACT_FIXTURES, fixturesForScreen } from "../../../../packages/protocol-adapter/src/contract-fixtures";
import { JOURNEYS as E2E_JOURNEYS, MATRIX as E2E_MATRIX } from "../../../e2e/src/journey-matrix";
import { SCREENS as A11Y_SCREENS } from "../../../e2e/src/a11y-matrix";
import { FEATURE_ROWS, HANDOFF_PINS, PENDING_PRODUCERS } from "../../src/handoff/packet";
import { WORKSPACE_SURFACES } from "../../src/workspace/registry";

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, "../../../..");
export const DOC_PATH = "docs/c-local-evidence-matrix-stub-apps-bind.md";

export const BASE_MAIN_SHA = "20fa67b6dfee56ec33247774932aea3756f2a352";
export const LOCKED_BINDINGS_SHA256 = "83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249";
export const RULING_LINE = "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

/**
 * Pending-catalogue nodes promoted into the active program by a plan revision (docs/aiops/PLAN_REVISION_20261017_KO.md).
 * The pending catalogue keeps the original row as history, so an id may sit in both catalogues only if it is listed here.
 */
export const PROMOTED_FROM_PENDING: readonly string[] = ["consume-p-sdk-0"];

export const NODE_STATES = ["MERGED_RECORDED", "WAITING", "NOT_STARTED", "REPO_PRESENT", "NOT_PRESENT"] as const;
export const QUALIFICATION_STATES = ["UNQUALIFIED", "NOT_REQUIRED"] as const;
export const ACCEPTANCE_STATES = ["PENDING", "NOT_REQUIRED"] as const;
export const RELEASE_STATES = ["NOT_AUTHORIZED"] as const;
export const COVERAGE_STATES = ["RECORDED", "NOT_REACHABLE", "NOT_APPLICABLE", "UNVERIFIED"] as const;
/** Words the matrix never writes into a facet cell. */
export const NEVER_WRITTEN = ["DONE", "PASS", "QUALIFIED", "ACCEPTED", "REJECTED", "RELEASED", "NOT_RELEASED"] as const;

export type CoverageState = (typeof COVERAGE_STATES)[number];

export interface Coverage {
  state: CoverageState;
  pointer: string;
}

export interface Facets {
  nodeState: string;
  qualificationState: (typeof QUALIFICATION_STATES)[number];
  acceptanceState: (typeof ACCEPTANCE_STATES)[number];
  releaseState: (typeof RELEASE_STATES)[number];
}

export interface EvidenceRow {
  rowId: string;
  kind: "surface" | "journey" | "node";
  route: string;
  binding: string;
  mode: string;
  contractTuple: "shared-tuple";
  appHead: string;
  success: Coverage;
  reject: Coverage;
  unknown: Coverage;
  notBoundFixtures: number;
  nodeEvidence: string;
  browserEvidence: string;
  skippedOrUnboundReason: string;
  facets: Facets;
}

export interface NodeRow {
  rowId: string;
  catalogue: "program" | "pending";
  nodeState: string;
  centralDone: "NOT_EVALUATED";
  countedAsDone: false;
  waitingOn: string;
  facets: Facets;
}

// ---------------------------------------------------------------------------
// Sources read from the repo
// ---------------------------------------------------------------------------

const readJson = (rel: string): any => JSON.parse(readFileSync(path.join(REPO_ROOT, rel), "utf8"));

interface ProgramNode {
  id: string;
}
interface PendingNode {
  id: string;
  depends_on?: string[];
  depends_on_external?: { repository: string; program: string; node: string }[];
}

export const PROGRAM_NODES: readonly ProgramNode[] = readJson(".aiops/program.json").nodes;
export const PENDING_NODES: readonly PendingNode[] = readJson("docs/aiops/PENDING_NODES.json").nodes;

/** PR numbers of merged active nodes, typed from `git log --first-parent --merges` at `BASE_MAIN_SHA`. Presence is checked, not git, so a later merge shows only after this table is retyped at a newer base. */
export const NODE_PRS: Readonly<Record<string, number>> = {
  "w6a-journey-map": 23,
  "w6a-journey-adapter": 27,
  "w6a-journey-test": 28,
  "w6a-ui-skeleton": 29,
  "w6a-evidence": 31,
  "organizer-admin-console": 32,
  "gift-surface": 30,
  "doc-m05-label": 24,
  "w7-marketing-align": 33,
  "w7-m05-consent-bind": 34,
  "c-workspace-design": 35,
  "c-buyer-workspace": 36,
  "c-organizer-workspace": 37,
  "c-receipt-explorer": 42,
  "c-discovery-prototype": 38,
  "c-accessibility-baseline": 43,
  "c-contract-fixture-library": 44,
  "c-local-workspace-closeout": 45,
  "c-discovery-live-stub": 47,
  "c-inventory-venue-stub": 48,
  "c-platform-journey-stub": 49,
  "c-merchant-operations-stub": 50,
  "c-credit-origination-stub": 52,
  "c-credit-servicing-journey-stub": 53,
  "c-finance-operations-stub": 54,
  "c-marketing-journey-stub": 55,
  "c-delegated-assistant-stub": 56,
  "c-tenant-permissions-stub": 57,
  "c-notification-inbox-stub": 58,
  "c-marketplace-performance-stub": 61,
  "c-provider-connected-journey-stub": 59,
  "c-installable-mobile-stub": 63,
  "c-platform-operational-qualification-stub": 64,
  "c-platform-release-stub": 65,
  "c-refund-return-states-stub": 68,
  "c-journey-identity-stub": 69,
  "c-session-recovery-stub": 70,
  "c-cross-surface-journeys-stub": 72,
  "c-browser-e2e-stub": 73,
  "c-a11y-acceptance-stub": 74,
  "c-fault-injection-stub": 75,
  "c-local-evidence-matrix-stub": 76,
  "c-app-shell-resilience-stub": 78,
  "c-route-registry-navigation-stub": 79,
  "c-bundle-performance-budget-stub": 80,
  "c-locale-ko-en-stub": 82,
  "c-display-preferences-stub": 83,
  "c-untrusted-render-csp-stub": 84,
  "c-quality-gates-stub": 85,
  "consume-p-sdk-0": 86,
  "c-user-guides-stub": 87,
  "c-async-state-patterns-stub": 90,
  "c-form-validation-ux-stub": 91,
  "c-offline-connectivity-ux-stub": 92,
  "c-sdk0-mock-scenario-kit-stub": 93,
  "c-component-gallery-stub": 94,
  "c-web-coverage-uplift-stub": 95,
};

/** Surface -> existing tests. Existence is checked by the test. "none" means no file of that kind exists for the surface. */
export const SURFACE_TESTS: Readonly<Record<string, { web: string; adapter: string }>> = {
  "box-office-catalog": { web: "workspace-registry.test.ts", adapter: "stub-edge-cases.test.ts" },
  "box-office-journey-view": { web: "journey-panel.test.tsx", adapter: "booking-journey.test.ts" },
  "box-office-settlement": { web: "settlement-panel.test.tsx", adapter: "settlement-fsm.test.ts" },
  "booking-journey": { web: "journey-panel.test.tsx", adapter: "booking-journey.test.ts" },
  "reservation-case": { web: "reservation-panel.test.tsx", adapter: "reservation-fsm.test.ts" },
  "admission-credential": { web: "admission-panel.test.tsx", adapter: "admission-fsm.test.ts" },
  "resale-desk": { web: "resale-panel.test.tsx", adapter: "resale-fsm.test.ts" },
  "gift-transfer": { web: "gift-panel.test.tsx", adapter: "gift-transfer.test.ts" },
  "credit-desk": { web: "credit-panel.test.tsx", adapter: "credit-fsm.test.ts" },
  "organizer-console": { web: "organizer-panel.test.tsx", adapter: "organizer-console.test.ts" },
  "operator-transport": { web: "transport-status.test.tsx", adapter: "http-transport-hardening.test.ts" },
  "operator-unshown-desk": { web: "workspace-registry.test.ts", adapter: "no-bypass.test.ts" },
  "marketing-hub": { web: "marketing-routes.test.tsx", adapter: "none" },
  "marketing-m01": { web: "marketing-contracts.test.ts", adapter: "none" },
  "marketing-m02": { web: "marketing-contracts.test.ts", adapter: "none" },
  "marketing-m03": { web: "marketing-contracts.test.ts", adapter: "none" },
  "marketing-m04": { web: "marketing-contracts.test.ts", adapter: "none" },
  "marketing-m05": { web: "consent-desk.test.ts", adapter: "consent-bind.test.ts" },
  "marketing-journey": { web: "marketing-journey.test.tsx", adapter: "marketing-journey.test.ts" },
  "discovery-prototype": { web: "discovery-page.test.tsx", adapter: "discovery-read.test.ts" },
  "discovery-live-read": { web: "discovery-live.test.tsx", adapter: "discovery-read.test.ts" },
  "inventory-venue-select": { web: "inventory-venue.test.tsx", adapter: "inventory-read.test.ts" },
  "platform-journey-trade": { web: "platform-journey.test.tsx", adapter: "platform-journey.test.ts" },
  "merchant-operations": { web: "merchant-operations.test.tsx", adapter: "merchant-operations.test.ts" },
  "credit-origination": { web: "credit-origination.test.tsx", adapter: "credit-origination.test.ts" },
  "credit-servicing": { web: "credit-servicing.test.tsx", adapter: "credit-servicing.test.ts" },
  "finance-operations": { web: "finance-operations.test.tsx", adapter: "finance-operations.test.ts" },
  "delegated-assistant": { web: "delegated-assistant.test.tsx", adapter: "delegated-assistant.test.ts" },
  "provider-connected-journey": { web: "provider-journey.test.tsx", adapter: "provider-journey.test.ts" },
  "tenant-permissions": { web: "tenant-permissions.test.tsx", adapter: "tenant-permissions.test.ts" },
  "notification-inbox": { web: "notification-inbox.test.tsx", adapter: "notification-inbox.test.ts" },
  "marketplace-performance-bench": { web: "marketplace-performance.test.tsx", adapter: "marketplace-performance.test.ts" },
  "installable-mobile-shell": { web: "installable-mobile.test.tsx", adapter: "installable-mobile.test.ts" },
  "platform-operational-qualification": { web: "operational-qualification.test.tsx", adapter: "operational-qualification.test.ts" },
  "platform-release": { web: "platform-release.test.tsx", adapter: "platform-release.test.ts" },
  "refund-return-desk": { web: "refund-return.test.tsx", adapter: "refund-return.test.ts" },
  "journey-identity": { web: "journey-identity.test.tsx", adapter: "journey-identity.test.ts" },
  "session-recovery": { web: "session-recovery.test.tsx", adapter: "session-journal.test.ts" },
  "cross-surface-journeys": { web: "cross-surface-journeys.test.tsx", adapter: "cross-surface-journeys.test.ts" },
  "buyer-workspace": { web: "buyer-workspace.test.tsx", adapter: "none" },
  "organizer-workspace": { web: "organizer-workspace.test.tsx", adapter: "none" },
  "receipt-explorer": { web: "receipt-explorer.test.tsx", adapter: "none" },
  "accessibility-baseline": { web: "a11y-baseline.test.tsx", adapter: "none" },
};

/** Journey -> adapter test and web test, plus the browser journeys cell that answers it, if any. */
export const JOURNEY_TESTS: Readonly<Record<string, { adapter: string; e2e: string }>> = {
  "purchase-booking": { adapter: "booking-journey.test.ts", e2e: "booking" },
  "purchase-provider": { adapter: "provider-journey.test.ts", e2e: "none" },
  "resale-platform": { adapter: "platform-journey.test.ts", e2e: "resale" },
  gift: { adapter: "gift-transfer.test.ts", e2e: "gift" },
  refund: { adapter: "refund-return.test.ts", e2e: "none" },
  "marketing-benefit": { adapter: "marketing-journey.test.ts", e2e: "none" },
  delegation: { adapter: "delegated-assistant.test.ts", e2e: "none" },
  "credit-servicing": { adapter: "credit-servicing.test.ts", e2e: "credit" },
  organizer: { adapter: "organizer-console.test.ts", e2e: "organizer" },
  "session-recovery": { adapter: "session-recovery-controller.test.ts", e2e: "none" },
};

/** Browser journeys suite id -> the route pattern it drives. */
export const E2E_ROUTE: Readonly<Record<(typeof E2E_JOURNEYS)[number], string>> = {
  "box-office": "/",
  booking: "/booking/:eventId",
  admission: "/admission",
  resale: "/resale",
  credit: "/credit",
  gift: "/gift",
  organizer: "/organizer",
  receipts: "/receipts",
  "buyer": "/buyer",
  "discovery": "/discovery",
  "inventory": "/inventory",
  "mobile": "/mobile",
  "assistant": "/assistant",
  "organizer-workspace": "/organizer/workspace",
  "merchant": "/merchant",
  "finance": "/finance",
  "provider": "/provider",
  "credit-origination": "/credit/origination",
  "credit-servicing": "/credit/servicing",
  "marketing": "/marketing",
  "marketing-journey": "/marketing/journey",
  "platform": "/platform",
  "marketplace-performance": "/marketplace-performance",
  "permissions": "/permissions",
  "notifications": "/notifications",
  "identity": "/identity",
  "session": "/session",
  "journeys": "/journeys",
  "qualification": "/qualification",
  "release": "/release",
  "marketing-m01": "/marketing/m01",
  "marketing-m02": "/marketing/m02",
  "marketing-m03": "/marketing/m03",
  "marketing-m04": "/marketing/m04",
  "marketing-m05": "/marketing/m05",
};

// ---------------------------------------------------------------------------
// Shared tuple (one block, not copied per row)
// ---------------------------------------------------------------------------

export function sharedTuple() {
  return {
    contractOpenApiSha256: OPENAPI_CONTRACT_PIN.openApiFileSha256,
    gateOpenApiSha256: OPENAPI_INTEGRATION_GATE_PIN.openApiFileSha256,
    protocolMergeSha: OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha,
    ciGateSha: ciGateSha(),
    sdkDigest: HANDOFF_PINS.sdkDigest,
    manifestDigest: HANDOFF_PINS.manifestDigest,
    vectorDigest: HANDOFF_PINS.vectorDigest,
    consumedProducerChange: HANDOFF_PINS.consumedProducerChange,
  };
}

export function ciGateSha(): string {
  const text = readFileSync(path.join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
  const hit = /KIX_PROTOCOL_GATE_SHA:\s*([0-9a-f]{40})/.exec(text);
  return hit ? hit[1] : "UNREADABLE";
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

const FACET_BASE = { qualificationState: "UNQUALIFIED", releaseState: "NOT_AUTHORIZED" } as const;

function coverage(screenId: string, klass: "SUCCESS" | "REJECT" | "UNKNOWN", binding: string): Coverage {
  const hits = fixturesForScreen(screenId).filter((fixture) => fixture.klass === klass);
  if (hits.length > 0) {
    return { state: "RECORDED", pointer: `${hits.length} fixture${hits.length === 1 ? "" : "s"}, first ${hits[0].id}` };
  }
  if (binding === "no-published-command" || binding === "not-bound") {
    return { state: "NOT_APPLICABLE", pointer: "no published command to send" };
  }
  return { state: "UNVERIFIED", pointer: "no fixture of this class" };
}

export function surfaceRows(): EvidenceRow[] {
  return WORKSPACE_SURFACES.map((surface) => {
    const tests = SURFACE_TESTS[surface.id];
    const hasPage = surface.pageControl && surface.route.startsWith("/");
    const screens = hasPage ? A11Y_SCREENS.filter((screen) => screen.pattern === surface.route).map((screen) => screen.screenId) : [];
    const journeys = hasPage ? E2E_JOURNEYS.filter((id) => E2E_ROUTE[id] === surface.route) : [];
    const published = surface.binding === "published-bound";
    const notBoundFixtures = fixturesForScreen(surface.id).filter((fixture) => fixture.klass === "NOT_BOUND").length;
    const feature = FEATURE_ROWS.find((row) => row.id === surface.id);
    const waiting = PENDING_PRODUCERS.filter((row) => row.waitingSurface === surface.id).map((row) => row.id);
    const reasons: string[] = [];
    if (!published) reasons.push(`binding ${surface.binding}`);
    if (waiting.length > 0) reasons.push(`waits on ${waiting.join(", ")}`);
    if (!hasPage) reasons.push("no page");
    return {
      rowId: surface.id,
      kind: "surface",
      route: surface.route,
      binding: surface.binding,
      mode: published ? "stub (default); integration-http: local-command, Node loopback only" : "stub (default); integration-http: NOT_BOUND",
      contractTuple: "shared-tuple",
      appHead: `base:${BASE_MAIN_SHA}`,
      success: coverage(surface.id, "SUCCESS", surface.binding),
      reject: coverage(surface.id, "REJECT", surface.binding),
      unknown: coverage(surface.id, "UNKNOWN", surface.binding),
      notBoundFixtures,
      nodeEvidence: `web ${tests.web}; adapter ${tests.adapter}`,
      browserEvidence: hasPage
        ? `a11y ${screens.length > 0 ? screens.join("+") : "none"}; e2e ${journeys.length > 0 ? journeys.join("+") : "none"}`
        : "none (no page)",
      skippedOrUnboundReason: reasons.length > 0 ? `${reasons.join("; ")}; status ${feature?.status ?? "unknown"}` : `status ${feature?.status ?? "unknown"}`,
      facets: {
        nodeState: surface.implemented ? "REPO_PRESENT" : "NOT_PRESENT",
        ...FACET_BASE,
        acceptanceState: hasPage ? "PENDING" : "NOT_REQUIRED",
      },
    };
  });
}

function journeyCells(e2e: string) {
  return E2E_MATRIX.filter((cell) => cell.journey === e2e);
}

/** The synthetic Journeys table row for one branch. A reused or no-source row is stated as such, never as a fresh run. */
function tableCoverage(table: readonly CrossSurfaceRow[], journey: CrossSurfaceJourney, branch: CrossSurfaceBranch): Coverage {
  const hit = table.find((row) => row.id === rowIdFor(journey, branch));
  if (!hit) return { state: "UNVERIFIED", pointer: `no table row ${rowIdFor(journey, branch)}` };
  const pointer = `${hit.id} ${hit.basis}, status ${hit.status}`;
  return { state: hit.basis === "no-source-branch" ? "NOT_REACHABLE" : "RECORDED", pointer };
}

export function journeyRows(table: readonly CrossSurfaceRow[]): EvidenceRow[] {
  return CROSS_SURFACE_JOURNEYS.map((id) => {
    const tests = JOURNEY_TESTS[id];
    const cells = tests.e2e === "none" ? [] : journeyCells(tests.e2e);
    const browser = cells.length === 0 ? "e2e none" : `e2e ${tests.e2e}: ${cells.map((cell) => `${cell.outcome} ${cell.kind}`).join(", ")}`;
    return {
      rowId: id,
      kind: "journey",
      route: "/journeys",
      binding: "stub-only",
      mode: "stub (default); integration-http: NOT_BOUND for the table",
      contractTuple: "shared-tuple",
      appHead: `base:${BASE_MAIN_SHA}`,
      success: tableCoverage(table, id, "normal"),
      reject: tableCoverage(table, id, "explicit-reject"),
      unknown: tableCoverage(table, id, "response-lost"),
      notBoundFixtures: cells.filter((item) => item.outcome === "NOT_BOUND").length,
      nodeEvidence: `adapter ${tests.adapter}; adapter cross-surface-journeys.test.ts`,
      browserEvidence: `${browser}; a11y journeys`,
      skippedOrUnboundReason: "synthetic table; capture and settle_capture never composed; placeHold not-bound",
      facets: { nodeState: "REPO_PRESENT", ...FACET_BASE, acceptanceState: "PENDING" },
    };
  });
}

/** Active program nodes with no recorded PR at this matrix base: added by a later plan revision, so they are NOT_STARTED here. */
export function postBaseProgramNodes(): string[] {
  return PROGRAM_NODES.map((node) => node.id).filter((id) => NODE_PRS[id] === undefined);
}

function programNodeState(id: string): string {
  return NODE_PRS[id] === undefined ? "NOT_STARTED" : `MERGED_RECORDED(PR #${NODE_PRS[id]})`;
}

export function nodeRows(): NodeRow[] {
  const programRows: NodeRow[] = PROGRAM_NODES.map((node) => ({
    rowId: node.id,
    catalogue: "program",
    nodeState: programNodeState(node.id),
    centralDone: "NOT_EVALUATED",
    countedAsDone: false,
    waitingOn: "none",
    facets: {
      nodeState: programNodeState(node.id),
      ...FACET_BASE,
      acceptanceState: "PENDING",
    },
  }));
  const pendingRows: NodeRow[] = PENDING_NODES.map((node) => {
    const promoted = PROMOTED_FROM_PENDING.includes(node.id);
    const externals = (node.depends_on_external ?? []).map((item) => `${item.program}:${item.node}`);
    const nodeState = externals.length > 0 && !promoted ? "WAITING" : "NOT_STARTED";
    return {
      rowId: node.id,
      catalogue: "pending",
      nodeState,
      centralDone: "NOT_EVALUATED",
      countedAsDone: false,
      waitingOn: promoted ? "promoted to program (plan revision 20261017)" : externals.length > 0 ? externals.join(", ") : "pending nodes only",
      facets: { nodeState, ...FACET_BASE, acceptanceState: "PENDING" },
    };
  });
  return [...programRows, ...pendingRows];
}

// ---------------------------------------------------------------------------
// Denominators (each line has its own count; nothing is summed; no percentage)
// ---------------------------------------------------------------------------

export function liveGateFiles(): string[] {
  const dir = path.join(REPO_ROOT, "packages/protocol-adapter/test");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".test.ts"))
    .filter((name) => readFileSync(path.join(dir, name), "utf8").includes("support/reviewed-gate"))
    .sort();
}

export function externalTargets(): string[] {
  const set = new Set<string>();
  for (const node of PENDING_NODES) {
    for (const item of node.depends_on_external ?? []) set.add(`${item.program}:${item.node}`);
  }
  return [...set].sort();
}

const count = <T>(items: readonly T[], pick: (item: T) => boolean) => items.filter(pick).length;

export function denominatorLines(table: readonly CrossSurfaceRow[]): string[] {
  const surfaces = surfaceRows();
  const journeys = journeyRows(table);
  const nodes = nodeRows();
  const program = nodes.filter((row) => row.catalogue === "program");
  const pending = nodes.filter((row) => row.catalogue === "pending");
  const bindings = Object.values(COMMERCE_COMMAND_BINDINGS) as { status: string }[];
  const withPage = count(surfaces, (row) => row.facets.acceptanceState === "PENDING");
  const decision = (id: string) => RELEASE_DECISIONS.find((item) => item.id === id)!.decision;
  const bySurface = (binding: string) => count(surfaces, (row) => row.binding === binding);
  const fixtureClass = (klass: string) => count(CONTRACT_FIXTURES, (fixture) => fixture.klass === klass);
  return [
    `D01 live-gate skipped under KIX_REQUIRE_GATE=0: ${liveGateFiles().length} adapter test files import support/reviewed-gate`,
    `D02 NOT_BOUND desk methods: ${count(bindings, (item) => item.status === "not-bound")} of ${COMMERCE_METHODS.length}`,
    `D03 NOT_BOUND surfaces (binding is not published-bound): ${count(surfaces, (row) => row.binding !== "published-bound")} of ${surfaces.length}`,
    `D04 NOT_BOUND fixtures: ${fixtureClass("NOT_BOUND")} of ${CONTRACT_FIXTURES.length}`,
    `D05 stub-only surfaces: ${bySurface("stub-only")} of ${surfaces.length}`,
    `D06 no-published-command surfaces: ${bySurface("no-published-command")}`,
    `D07 not-bound surfaces: ${bySurface("not-bound")}`,
    `D08 published-bound surfaces (local-command, Node loopback only): ${bySurface("published-bound")}`,
    `D09 user acceptance PENDING surfaces: ${withPage} of ${surfaces.length}; ACCEPTED 0`,
    `D10 user acceptance PENDING journeys: ${count(journeys, (row) => row.facets.acceptanceState === "PENDING")} of ${journeys.length}; ACCEPTED 0`,
    `D11 user acceptance PENDING a11y screens: ${A11Y_SCREENS.length} of ${A11Y_SCREENS.length}; ACCEPTED 0`,
    `D12 release page user acceptance: PENDING_USER_DECISION, 1 packet; realUserAcceptance false`,
    `D13 release decisions: install ${decision("install")}, publish ${decision("publish")}, operate ${decision("operate")}; taken 0`,
    `D14 release NOT_AUTHORIZED rows: surfaces ${count(surfaces, (row) => row.facets.releaseState === "NOT_AUTHORIZED")} of ${surfaces.length}, journeys ${count(journeys, (row) => row.facets.releaseState === "NOT_AUTHORIZED")} of ${journeys.length}, nodes ${count(nodes, (row) => row.facets.releaseState === "NOT_AUTHORIZED")} of ${nodes.length}; RELEASED 0`,
    `D15 active program nodes: ${program.length}; MERGED_RECORDED ${count(program, (row) => row.nodeState.startsWith("MERGED_RECORDED"))}, NOT_STARTED ${count(program, (row) => row.nodeState === "NOT_STARTED")}; central DONE not evaluated`,
    `D16 pending catalogue nodes: ${pending.length}; WAITING ${count(pending, (row) => row.nodeState === "WAITING")}, NOT_STARTED ${count(pending, (row) => row.nodeState === "NOT_STARTED")}; counted as done 0`,
    `D17 distinct external prerequisites named by pending nodes: ${externalTargets().length}; completion not verified here; subtracted 0`,
    `D18 release page area denominators: ${RELEASE_DENOMINATORS.map((area) => `${area.area} ${area.unresolved} of ${area.denominator}`).join(", ")} (own denominators, not merged)`,
    `D19 pending producers on the handoff packet: ${PENDING_PRODUCERS.length}; connected ${count(PENDING_PRODUCERS, (row) => row.connected)}`,
  ];
}

// ---------------------------------------------------------------------------
// Rendering (the doc must contain these exact lines)
// ---------------------------------------------------------------------------

const cov = (value: Coverage) => `${value.state} (${value.pointer})`;

export function renderSurfaceCoverage(row: EvidenceRow): string {
  return `| ${row.rowId} | ${row.route} | ${row.binding} | ${row.mode} | ${cov(row.success)} | ${cov(row.reject)} | ${cov(row.unknown)} | ${row.notBoundFixtures} |`;
}

export function renderEvidenceFacets(row: EvidenceRow): string {
  const f = row.facets;
  return `| ${row.rowId} | ${row.nodeEvidence} | ${row.browserEvidence} | ${row.skippedOrUnboundReason} | ${f.nodeState} | ${f.qualificationState} | ${f.acceptanceState} | ${f.releaseState} |`;
}

export function renderNode(row: NodeRow): string {
  const f = row.facets;
  return `| ${row.rowId} | ${row.catalogue} | ${f.nodeState} | ${row.centralDone} | ${f.qualificationState} | ${f.acceptanceState} | ${f.releaseState} | ${row.waitingOn} |`;
}

export function docSections(table: readonly CrossSurfaceRow[]): Record<string, string> {
  const head = (cols: string[]) => `| ${cols.join(" | ")} |\n| ${cols.map(() => "---").join(" | ")} |`;
  const surfaces = surfaceRows();
  const journeys = journeyRows(table);
  const nodes = nodeRows();
  const tuple = sharedTuple();
  return {
    SURFACE_COVERAGE: [head(["Row", "Route", "Binding", "Mode", "Success", "Reject", "UNKNOWN", "NOT_BOUND fixtures"]), ...surfaces.map(renderSurfaceCoverage)].join("\n"),
    SURFACE_FACETS: [head(["Row", "Node evidence", "Browser evidence", "Skipped / unbound reason", "node_state", "qualification_state", "acceptance_state", "release_state"]), ...surfaces.map(renderEvidenceFacets)].join("\n"),
    JOURNEY_COVERAGE: [head(["Row", "Route", "Binding", "Mode", "Success", "Reject", "UNKNOWN", "NOT_BOUND cells"]), ...journeys.map(renderSurfaceCoverage)].join("\n"),
    JOURNEY_FACETS: [head(["Row", "Node evidence", "Browser evidence", "Skipped / unbound reason", "node_state", "qualification_state", "acceptance_state", "release_state"]), ...journeys.map(renderEvidenceFacets)].join("\n"),
    NODES: [head(["Node", "Catalogue", "node_state", "Central DONE", "qualification_state", "acceptance_state", "release_state", "Waits on (external)"]), ...nodes.map(renderNode)].join("\n"),
    DENOMINATORS: denominatorLines(table).map((line) => `- ${line}`).join("\n"),
    TUPLE: Object.entries(tuple).map(([key, value]) => `| ${key} | ${value === null ? "null" : String(value)} |`).join("\n"),
    LIVE_GATE_FILES: liveGateFiles().map((name) => `- \`${name}\``).join("\n"),
    EXTERNALS: externalTargets().map((name) => `- \`${name}\``).join("\n"),
  };
}

export function pointerExists(rel: string): boolean {
  return existsSync(path.join(REPO_ROOT, rel));
}
