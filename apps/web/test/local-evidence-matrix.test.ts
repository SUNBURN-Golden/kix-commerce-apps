import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  COMMERCE_METHODS,
  composeCrossSurfaceRows,
  CROSS_SURFACE_JOURNEYS,
  OPENAPI_CONTRACT_PIN,
  OPENAPI_INTEGRATION_GATE_PIN,
  RELEASE_DECISIONS,
  RELEASE_DENOMINATORS,
  type CrossSurfaceRow,
} from "@kix/protocol-adapter";
import { fixtureById, fixturesForScreen } from "../../../packages/protocol-adapter/src/contract-fixtures";
import { MATRIX as E2E_MATRIX } from "../../e2e/src/journey-matrix";
import { SCREENS as A11Y_SCREENS } from "../../e2e/src/a11y-matrix";
import { HANDOFF_NON_CLAIMS, HANDOFF_PINS, PENDING_PRODUCERS } from "../src/handoff/packet";
import { WORKSPACE_SURFACES } from "../src/workspace/registry";
import {
  BASE_MAIN_SHA,
  ciGateSha,
  DOC_PATH,
  docSections,
  denominatorLines,
  externalTargets,
  JOURNEY_TESTS,
  journeyRows,
  liveGateFiles,
  LOCKED_BINDINGS_SHA256,
  NEVER_WRITTEN,
  nodeRows,
  NODE_PRS,
  PENDING_NODES,
  pointerExists,
  PROGRAM_NODES,
  REPO_ROOT,
  RULING_LINE,
  sharedTuple,
  SURFACE_TESTS,
  surfaceRows,
  THIS_NODE,
  type EvidenceRow,
} from "./support/local-evidence-matrix";

const doc = readFileSync(path.join(REPO_ROOT, DOC_PATH), "utf8");
const readme = readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");
const supportSource = readFileSync(path.join(REPO_ROOT, "apps/web/test/support/local-evidence-matrix.ts"), "utf8");

let table: CrossSurfaceRow[] = [];
beforeAll(async () => {
  table = await composeCrossSurfaceRows();
});

const facetCells = (row: EvidenceRow) => Object.values(row.facets);

describe("local evidence matrix: rows", () => {
  it("has exactly one row per workspace surface, journey, and node, with no missing field", () => {
    const surfaces = surfaceRows();
    expect(surfaces.map((row) => row.rowId)).toEqual(WORKSPACE_SURFACES.map((surface) => surface.id));
    expect(new Set(surfaces.map((row) => row.rowId)).size).toBe(surfaces.length);
    const journeys = journeyRows(table);
    expect(journeys.map((row) => row.rowId)).toEqual([...CROSS_SURFACE_JOURNEYS]);
    const nodes = nodeRows();
    expect(nodes.length).toBe(PROGRAM_NODES.length + PENDING_NODES.length);
    for (const row of [...surfaces, ...journeys]) {
      for (const field of [row.route, row.binding, row.mode, row.nodeEvidence, row.browserEvidence, row.skippedOrUnboundReason]) {
        expect(field.length).toBeGreaterThan(0);
      }
      expect(row.contractTuple).toBe("shared-tuple");
      expect(row.appHead).toBe(`base:${BASE_MAIN_SHA}`);
      for (const part of [row.success, row.reject, row.unknown]) {
        expect(part.pointer.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the program and pending node ids disjoint and counts from the files", () => {
    const program = PROGRAM_NODES.map((node) => node.id);
    const pending = PENDING_NODES.map((node) => node.id);
    expect(new Set(program).size).toBe(program.length);
    expect(new Set(pending).size).toBe(pending.length);
    expect(program.filter((id) => pending.includes(id))).toEqual([]);
    expect(program).toContain(THIS_NODE);
  });

  it("resolves every test pointer to an existing file", () => {
    for (const surface of WORKSPACE_SURFACES) {
      const tests = SURFACE_TESTS[surface.id];
      expect(tests, surface.id).toBeDefined();
      expect(pointerExists(`apps/web/test/${tests.web}`), `${surface.id} web ${tests.web}`).toBe(true);
      if (tests.adapter !== "none") expect(pointerExists(`packages/protocol-adapter/test/${tests.adapter}`), `${surface.id} adapter ${tests.adapter}`).toBe(true);
    }
    expect(Object.keys(SURFACE_TESTS).sort()).toEqual(WORKSPACE_SURFACES.map((surface) => surface.id).sort());
    for (const id of CROSS_SURFACE_JOURNEYS) {
      expect(pointerExists(`packages/protocol-adapter/test/${JOURNEY_TESTS[id].adapter}`), id).toBe(true);
    }
    expect(Object.keys(JOURNEY_TESTS).sort()).toEqual([...CROSS_SURFACE_JOURNEYS].sort());
    for (const name of ["cross-surface-journeys.test.ts"]) expect(pointerExists(`packages/protocol-adapter/test/${name}`)).toBe(true);
  });

  it("resolves every fixture and browser pointer against the live sources", () => {
    for (const surface of WORKSPACE_SURFACES) {
      for (const fixture of fixturesForScreen(surface.id)) expect(fixtureById(fixture.id).screenId).toBe(surface.id);
    }
    for (const row of surfaceRows()) {
      for (const screen of /a11y ([a-z0-9+-]+)/.exec(row.browserEvidence)?.[1].split("+") ?? []) {
        if (screen !== "none") expect(A11Y_SCREENS.some((item) => item.screenId === screen), `${row.rowId} ${screen}`).toBe(true);
      }
    }
    for (const row of journeyRows(table)) {
      for (const outcome of /e2e [a-z-]+: ([A-Z_ ,]+)/.exec(row.browserEvidence)?.[1].split(", ") ?? []) {
        const [name] = outcome.split(" ");
        expect(E2E_MATRIX.some((cell) => cell.outcome === name)).toBe(true);
      }
    }
  });

  it("marks a row NOT_APPLICABLE only where no published command exists, and never RECORDED without a source", () => {
    for (const row of surfaceRows()) {
      for (const part of [row.success, row.reject, row.unknown]) {
        if (part.state === "NOT_APPLICABLE") expect(["no-published-command", "not-bound"]).toContain(row.binding);
        if (part.state === "RECORDED") expect(part.pointer).toMatch(/fixture/);
      }
    }
    for (const row of journeyRows(table)) {
      for (const part of [row.success, row.reject, row.unknown]) {
        if (part.state === "RECORDED") expect(part.pointer).toMatch(/^xs\./);
      }
    }
  });
});

describe("local evidence matrix: facets stay separate and approve nothing", () => {
  it("never writes a done, pass, qualified, accepted, rejected, or released word into a facet", () => {
    const all = [...surfaceRows(), ...journeyRows(table)].flatMap(facetCells);
    const nodeCells = nodeRows().flatMap((row) => [...Object.values(row.facets), row.centralDone]);
    for (const cell of [...all, ...nodeCells]) {
      for (const word of NEVER_WRITTEN) expect(cell === word, `${cell} === ${word}`).toBe(false);
      expect(cell).not.toMatch(/^(DONE|PASS|QUALIFIED|ACCEPTED|REJECTED|RELEASED)\b/);
    }
  });

  it("states release NOT_AUTHORIZED and qualification UNQUALIFIED on every row, matching the handoff", () => {
    expect(HANDOFF_NON_CLAIMS.releaseState).toBe("NOT_AUTHORIZED");
    expect(HANDOFF_NON_CLAIMS.qualificationState).toBe("UNQUALIFIED");
    for (const row of [...surfaceRows(), ...journeyRows(table)]) {
      expect(row.facets.releaseState).toBe("NOT_AUTHORIZED");
      expect(row.facets.qualificationState).toBe("UNQUALIFIED");
      expect(["PENDING", "NOT_REQUIRED"]).toContain(row.facets.acceptanceState);
    }
    for (const row of nodeRows()) {
      expect(row.facets.releaseState).toBe("NOT_AUTHORIZED");
      expect(row.facets.qualificationState).toBe("UNQUALIFIED");
      expect(row.facets.acceptanceState).toBe("PENDING");
    }
  });

  it("keeps the development state and the release state in two columns, never one", () => {
    for (const row of nodeRows()) {
      expect(row.facets.nodeState).not.toMatch(/RELEASE|AUTHORIZED/);
      expect(row.facets.releaseState).not.toMatch(/MERGED|IN_PROGRESS|WAITING/);
    }
  });

  it("never counts a pending catalogue node, or a node waiting on an external, as done", () => {
    const rows = nodeRows();
    const pending = rows.filter((row) => row.catalogue === "pending");
    expect(pending.length).toBe(PENDING_NODES.length);
    for (const row of rows) {
      expect(row.countedAsDone).toBe(false);
      expect(row.centralDone).toBe("NOT_EVALUATED");
    }
    for (const row of pending) expect(["WAITING", "NOT_STARTED"]).toContain(row.nodeState);
    const own = rows.find((row) => row.rowId === THIS_NODE);
    expect(own?.nodeState).toBe("IN_PROGRESS");
    for (const node of PROGRAM_NODES) {
      if (node.id !== THIS_NODE) expect(NODE_PRS[node.id], node.id).toBeGreaterThan(0);
    }
  });

  it("does not subtract a pending node or an external prerequisite from the denominator", () => {
    const lines = denominatorLines(table).join("\n");
    expect(lines).toContain(`pending catalogue nodes: ${PENDING_NODES.length}`);
    expect(lines).toContain("counted as done 0");
    expect(lines).toContain(`distinct external prerequisites named by pending nodes: ${externalTargets().length}`);
    expect(lines).toContain("subtracted 0");
    expect(lines).not.toMatch(/%/);
  });
});

describe("local evidence matrix: denominators equal their sources", () => {
  it("counts live-gate, not-bound, stub-only, acceptance, and release lines apart", () => {
    const text = denominatorLines(table).join("\n");
    const bindings = Object.values(COMMERCE_COMMAND_BINDINGS);
    expect(bindings.length).toBe(COMMERCE_METHODS.length);
    expect(text).toContain(`D01 live-gate skipped under KIX_REQUIRE_GATE=0: ${liveGateFiles().length} adapter`);
    expect(liveGateFiles().length).toBeGreaterThan(0);
    expect(text).toContain(`D02 NOT_BOUND desk methods: ${bindings.filter((item) => item.status === "not-bound").length} of ${COMMERCE_METHODS.length}`);
    const by = (binding: string) => WORKSPACE_SURFACES.filter((surface) => surface.binding === binding).length;
    expect(text).toContain(`D05 stub-only surfaces: ${by("stub-only")} of ${WORKSPACE_SURFACES.length}`);
    expect(text).toContain(`D06 no-published-command surfaces: ${by("no-published-command")}`);
    expect(text).toContain(`D11 user acceptance PENDING a11y screens: ${A11Y_SCREENS.length} of ${A11Y_SCREENS.length}; ACCEPTED 0`);
    expect(text).toContain("RELEASED 0");
    expect(text).toContain("ACCEPTED 0");
  });

  it("repeats the release page and handoff counts verbatim", () => {
    const text = denominatorLines(table).join("\n");
    for (const area of RELEASE_DENOMINATORS) expect(text).toContain(`${area.area} ${area.unresolved} of ${area.denominator}`);
    expect(RELEASE_DECISIONS.map((item) => `${item.id}:${item.decision}`)).toEqual(["install:awaiting-user-decision", "publish:not-open", "operate:not-open"]);
    expect(text).toContain(`D19 pending producers on the handoff packet: ${PENDING_PRODUCERS.length}; connected 0`);
    expect(PENDING_PRODUCERS.every((row) => row.connected === false)).toBe(true);
    const releaseSource = readFileSync(path.join(REPO_ROOT, "packages/protocol-adapter/src/platform-release.ts"), "utf8");
    expect(releaseSource).toContain('state: "PENDING_USER_DECISION"');
  });

  it("holds the live-gate skipped count apart from any locally run figure", () => {
    const lines = doc.split("\n");
    const skipped = lines.filter((line) => line.includes("live-gate skipped"));
    expect(skipped.length).toBeGreaterThan(0);
    for (const line of skipped) expect(line).not.toMatch(/locally run|local run|passed/i);
  });
});

describe("local evidence matrix: contract tuple and locks", () => {
  it("shares one tuple that equals the live pins, the handoff, and the CI gate sha", () => {
    const tuple = sharedTuple();
    expect(tuple.contractOpenApiSha256).toBe(OPENAPI_CONTRACT_PIN.openApiFileSha256);
    expect(tuple.gateOpenApiSha256).toBe(OPENAPI_INTEGRATION_GATE_PIN.openApiFileSha256);
    expect(tuple.protocolMergeSha).toBe(OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha);
    expect(ciGateSha()).toBe(OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha);
    expect(tuple.contractOpenApiSha256).toBe(HANDOFF_PINS.contractOpenApiSha256);
    expect(tuple.gateOpenApiSha256).toBe(HANDOFF_PINS.gateOpenApiSha256);
    expect([tuple.sdkDigest, tuple.manifestDigest, tuple.vectorDigest]).toEqual([null, null, null]);
    expect(tuple.consumedProducerChange).toBe(false);
  });

  it("leaves commerce-bindings.ts byte-identical and placeHold not-bound with reserve_listing", () => {
    const bytes = readFileSync(path.join(REPO_ROOT, "packages/protocol-adapter/src/commerce-bindings.ts"));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(LOCKED_BINDINGS_SHA256);
    expect(COMMERCE_COMMAND_BINDINGS.placeHold.status).toBe("not-bound");
    expect(COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction).toBe("reserve_listing");
  });

  it("keeps the support module free of a network call, a clock, and randomness", () => {
    for (const token of ["fetch(", "Date.now(", "Math.random(", "new Date("]) expect(supportSource.includes(token), token).toBe(false);
  });
});

describe("local evidence matrix: the bind doc equals the sources", () => {
  const sections = () => docSections(table);

  it("contains every rendered row, node, tuple, and denominator line", () => {
    for (const [key, text] of Object.entries(sections())) {
      for (const line of text.split("\n")) expect(doc.includes(line), `${key}: ${line}`).toBe(true);
    }
  });

  it("cites the ruling, the base sha, the lock hash, and links /handoff and /release", () => {
    expect(doc).toContain(RULING_LINE);
    expect(doc).toContain(BASE_MAIN_SHA);
    expect(doc).toContain(LOCKED_BINDINGS_SHA256);
    expect(doc).toContain("/handoff");
    expect(doc).toContain("/release");
    expect(readme).toContain("docs/c-local-evidence-matrix-stub-apps-bind.md");
    expect(readme).toContain(RULING_LINE);
  });

  it("states no percentage and no merged readiness figure", () => {
    expect(doc).not.toMatch(/\d\s?%/);
    expect(doc).not.toMatch(/readiness (score|figure|percent)/i);
  });

  it("does not claim a pass, an acceptance, or a release", () => {
    const stripped = doc.replace(/`[^`]*`/g, "");
    expect(stripped).not.toMatch(/\b(is|are|was|were) (now )?(released|accepted|qualified)\b/i);
    expect(doc).toContain("contract_change=NO");
  });
});
