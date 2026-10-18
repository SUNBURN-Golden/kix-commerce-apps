import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  CROSS_SURFACE_BRANCHES,
  CROSS_SURFACE_COMPENSATION_STATES,
  CROSS_SURFACE_DESK_ACTOR,
  CROSS_SURFACE_JOURNEYS,
  CrossSurfaceController,
  composeCrossSurfaceRows,
  crossSurfacePortFor,
  type CrossSurfaceFilter,
  type CrossSurfaceScenario,
} from "@kix/protocol-adapter";
import { fixturesForScreen } from "../../../packages/protocol-adapter/src/contract-fixtures";
import { App } from "../src/App";
import {
  XS_BRANCH_WORDS,
  XS_SCENARIO_NOTES,
  XS_STATUS_WORDS,
  buildCrossSurfaceModel,
  readResultLine,
  type XsActions,
  type XsLastAction,
} from "../src/cross-surface-journeys";
import { LOCAL_SURFACE_EVIDENCE, PENDING_PRODUCERS } from "../src/handoff/packet";
import { CrossSurfacePanel } from "../src/pages/CrossSurfaceJourneysPanels";
import { WORKSPACE_RULING, WORKSPACE_SURFACES } from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

const BANNED = /[$₩]|KRW|USD|still open|in stock/i;
const NO_ACTIONS: XsActions = {
  read() {},
  deliverHeld() {},
  switchContext() {},
  applyScenario() {},
  applyFilter() {},
  clearFilter() {},
};

async function live(args: {
  environment?: "stub" | "integration-http";
  scenario?: CrossSurfaceScenario;
  filter?: Partial<CrossSurfaceFilter>;
  last?: XsLastAction | null;
  inFlight?: boolean;
  read?: boolean;
}) {
  const environment = args.environment ?? "stub";
  const scenario = args.scenario ?? "clean";
  const port = crossSurfacePortFor(environment, { scenario });
  const controller = new CrossSurfaceController(port, { actorRef: CROSS_SURFACE_DESK_ACTOR });
  if (args.read !== false) {
    await controller.read();
  }
  if (args.filter) {
    controller.setFilter(args.filter);
  }
  const state = controller.state();
  return {
    environment,
    scenario,
    filter: state.filter,
    model: buildCrossSurfaceModel(state, controller.view(), args.last ?? null, args.inFlight ?? false, environment, port.scenario === "held"),
    actions: NO_ACTIONS,
  };
}

function markup(value: Awaited<ReturnType<typeof live>>) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <CrossSurfacePanel live={value} />
    </MemoryRouter>,
  );
}

function rowsOf(html: string): string[] {
  return html.split("<tr data-row=").slice(1).map((chunk) => `<tr data-row=${chunk.split("</tr>")[0] ?? ""}`);
}

describe("cross-surface journeys screen", () => {
  it("shows one table with a row for each journey and branch and the four columns", async () => {
    const html = markup(await live({}));
    expect(html).toContain("<h2>Cross-surface journeys (synthetic)</h2>");
    expect(html).toContain('<table class="discovery-table" aria-label="Cross-surface journeys">');
    expect(html).toContain('data-screen-state="ready"');
    for (const heading of ["Last confirmed step", "Unconfirmed request", "Blocked next action", "Compensation path"]) {
      expect(html, heading).toContain(heading);
    }
    const rows = rowsOf(html);
    expect(rows).toHaveLength(CROSS_SURFACE_JOURNEYS.length * CROSS_SURFACE_BRANCHES.length);
    for (const journey of CROSS_SURFACE_JOURNEYS) {
      for (const branch of CROSS_SURFACE_BRANCHES) {
        expect(html).toContain(`data-row="xs.${journey}.${branch}"`);
      }
    }
    expect(html).toContain("Showing 40 of 40 rows.");
    expect(html).toContain('role="region" aria-label="Journey table"');
    expect(html).not.toMatch(BANNED);
    expect(html).toContain("SYNTHETIC");
    expect(html).toContain(WORKSPACE_RULING);
  });

  it("never shows an UNKNOWN as closed, done, or lost", async () => {
    const html = markup(await live({}));
    const table = await composeCrossSurfaceRows();
    const unknownIds = table.filter((row) => row.legs.some((item) => item.outcome === "UNKNOWN")).map((row) => row.id);
    expect(unknownIds.length).toBeGreaterThanOrEqual(6);
    for (const row of rowsOf(html)) {
      const id = /data-row="([^"]+)"/.exec(row)?.[1] ?? "";
      if (!unknownIds.includes(id)) {
        continue;
      }
      expect(row, id).not.toContain('data-status="closed"');
      expect(row, id).not.toContain('data-compensation="NONE_NEEDED"');
      const text = row.replace(/<[^>]*>/g, " ");
      expect(text, id).not.toMatch(/completed|failed|success|closed/i);
    }
    expect(Object.values(XS_BRANCH_WORDS).join(" ")).not.toMatch(/success|failed|completed/i);
    expect(XS_STATUS_WORDS.unknown).not.toMatch(/success|failed|completed|closed/i);
  });

  it("shows COMPENSATION_UNDEFINED on a partly landed row and on a missing branch", async () => {
    const html = markup(await live({}));
    const rows = rowsOf(html);
    const partial = rows.filter((row) => row.includes('data-status="partial"'));
    expect(partial.length).toBeGreaterThanOrEqual(6);
    for (const row of partial) {
      expect(row).toContain('data-compensation="COMPENSATION_UNDEFINED"');
      expect(row).toContain("COMPENSATION_UNDEFINED");
    }
    const payment = rows.find((row) => row.includes('data-row="xs.resale-platform.partial-success"')) ?? "";
    expect(payment).toContain("transfer: FENCED (payment-unobserved)");
    const missing = rows.find((row) => row.includes('data-row="xs.delegation.partial-success"')) ?? "";
    expect(missing).toContain("No source reproduces this branch");
    expect(missing).toContain("COMPENSATION_UNDEFINED");
    expect(html).toContain("No cell is a refund, a cancel, or an automatic command");
    for (const state of CROSS_SURFACE_COMPENSATION_STATES) {
      expect(html).toContain(`data-compensation="${state}"`);
    }
  });

  it("has no control that sends and no form", async () => {
    const html = markup(await live({}));
    expect(html).not.toContain("<form");
    expect(html).not.toContain('type="submit"');
    const ids = [...html.matchAll(/<button[^>]*id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.sort()).toEqual(["xs-apply-filter", "xs-apply-scenario", "xs-clear-filter", "xs-deliver-held", "xs-read", "xs-switch-context"]);
    for (const text of ["Refund", "Compensate", "Cancel", "Retry", "Resend", "Resolve"]) {
      expect(html, text).not.toMatch(new RegExp(`<button[^>]*>\\s*${text}`));
    }
    expect(html).toContain("None of these controls sends a command.");
  });

  it("keeps an off control focusable with a printed reason", async () => {
    const html = markup(await live({}));
    expect(html).toMatch(/<button id="xs-deliver-held"[^>]*aria-disabled="true"[^>]*aria-describedby="xs-deliver-held-reason"/);
    expect(html).toContain('id="xs-deliver-held-reason"');
    expect(html).not.toMatch(/<button[^>]* disabled/);
    const held = markup(await live({ scenario: "held", inFlight: true, read: false }));
    expect(held).toContain('data-screen-state="in-progress"');
    expect(held).toMatch(/<button id="xs-read"[^>]*aria-disabled="true"/);
    expect(held).toContain("A table read is in flight. It is not sent again.");
    expect(held).not.toMatch(/<button id="xs-deliver-held"[^>]*aria-disabled/);
    expect(held).not.toContain("<tr data-row=");
  });

  it("uses a select and an apply button, so arrowing through the select changes nothing", async () => {
    const html = markup(await live({}));
    expect(html).toContain('id="xs-scenario"');
    expect(html).toContain("Apply scenario");
    expect(html).toContain("Apply filter");
    const source = readFileSync(path.join(webRoot, "src/pages/CrossSurfaceJourneysPanels.tsx"), "utf8");
    // A select's onChange only stores a draft; the action runs from the apply button.
    expect(source).toContain("setDraftScenario(event.target.value");
    expect(source).not.toMatch(/onChange=\{\(event\) => actions\./);
  });

  it("filters rows already held and says when nothing matches", async () => {
    const one = markup(await live({ filter: { journey: "refund" } }));
    expect(rowsOf(one)).toHaveLength(4);
    expect(one).toContain("Showing 4 of 40 rows.");
    const none = markup(await live({ filter: { journey: "gift", branch: "explicit-reject", status: "closed" } }));
    expect(none).toContain('data-screen-state="empty"');
    expect(none).toContain("No row matches the filter.");
    expect(none).toContain('data-empty="filter"');
    expect(none).not.toContain("<tr data-row=");
    expect(none).toContain("Showing 0 of 40 rows.");
  });

  it("shows an empty source, an unavailable read, and a refused table as three different states", async () => {
    const empty = markup(await live({ scenario: "empty" }));
    expect(empty).toContain('data-screen-state="empty"');
    expect(empty).toContain('data-empty="source"');
    const unavailable = markup(await live({ scenario: "read-lost" }));
    expect(unavailable).toContain('data-screen-state="unavailable"');
    expect(unavailable).toContain("never arrived");
    expect(unavailable).toContain("no row from an earlier read is kept");
    expect(unavailable).not.toContain('data-empty="source"');
    expect(unavailable).not.toContain("<tr data-row=");
    const refused = markup(await live({ scenario: "claims-pass" }));
    expect(refused).toContain('data-screen-state="refused"');
    expect(refused).toContain("refused whole");
    expect(refused).toContain("compensationExecuted");
    expect(refused).not.toContain("<tr data-row=");
  });

  it("states not-bound on integration-http without a synthetic claim or a table", async () => {
    const html = markup(await live({ environment: "integration-http" }));
    expect(html).toContain('data-adapter-environment="integration-http"');
    expect(html).toContain('data-screen-state="not-bound"');
    expect(html).not.toContain("SYNTHETIC");
    expect(html).not.toContain("<tr data-row=");
    expect(html).toContain("The table is not bound here");
    expect(html).toMatch(/<button id="xs-apply-scenario"[^>]*aria-disabled="true"/);
    expect(html).toContain("Synthetic scenarios exist only on the stub.");
    expect(html).toContain("Not sent 1.");
  });

  it("explains a dropped read and takes the status region as its focus target", async () => {
    const last: XsLastAction = { seq: 3, kind: "read", result: { kind: "DROPPED", cause: "context-changed" } };
    const value = await live({ last, read: false });
    expect(value.model.lastNeedsFocus).toBe(true);
    expect(readResultLine(last.result)).toContain("dropped and applied nowhere");
    const html = markup(value);
    expect(html).toContain('data-last-action="attention"');
    expect(html).toContain('id="xs-status"');
    expect(html).toContain('tabindex="-1"');
  });

  it("lists the actions that are never composed and the locked hold record", async () => {
    const html = markup(await live({}));
    for (const action of ["capture:", "settle_capture:", "commit_trade:", "open_admission:", "admit:", "cancel_gift:", "cancel-draft:", "reclaim:"]) {
      expect(html, action).toContain(action);
    }
    expect(html).toContain("is not-bound. Its considered action stays reserve_listing");
    expect(html).toContain("never mapped onto prepare_trade");
    expect(html).toContain("UNDETERMINED");
    expect(html).toContain("journeyCompleteClaimed false");
    expect(Object.keys(XS_SCENARIO_NOTES)).toHaveLength(5);
  });

  it("renders at /journeys with exactly one current nav link", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/journeys"]}>
        <App />
      </MemoryRouter>,
    );
    expect(html).toContain('aria-label="Cross-surface journey sections"');
    // The breadcrumb also marks its own current crumb, so the count is taken inside the Surfaces nav.
    const nav = html.match(/<nav aria-label="Surfaces">.*?<\/nav>/s)?.[0] ?? "";
    expect(nav.match(/aria-current="page"/g) ?? []).toHaveLength(1);
    expect(nav).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/journeys"|<a[^>]*href="\/journeys"[^>]*aria-current="page"/);
    expect(html).toContain("Journeys");
  });
});

describe("cross-surface journeys registration and boundaries", () => {
  it("registers one stub-only surface with no sender, one evidence row, one pending row, and no fixture pass", () => {
    const surface = WORKSPACE_SURFACES.find((row) => row.id === "cross-surface-journeys");
    expect(surface).toMatchObject({
      route: "/journeys",
      binding: "stub-only",
      taskId: "c-cross-surface-journeys-stub",
      role: "operator",
      sender: null,
    });
    expect(surface?.deskMethods).toEqual([]);
    expect(surface?.actions).toEqual([]);
    expect(WORKSPACE_SURFACES.filter((row) => row.id.startsWith("marketing-m0") && row.id.includes("journeys"))).toHaveLength(0);
    const evidence = LOCAL_SURFACE_EVIDENCE.find((row) => row.id === "c-cross-surface-journeys-stub");
    expect(evidence?.doc).toBe("docs/c-cross-surface-journeys-stub-apps-bind.md");
    const pending = PENDING_PRODUCERS.find((row) => row.id === "c-cross-surface-journeys");
    expect(pending).toMatchObject({ catalogue: "pending", connected: false, implementedHere: false, waitingSurface: "cross-surface-journeys" });
    const rows = fixturesForScreen("cross-surface-journeys");
    expect(rows.map((row) => row.id).sort()).toEqual([
      "cross-surface-journeys.claim-refused",
      "cross-surface-journeys.explicit-reject",
      "cross-surface-journeys.partial-landed",
      "cross-surface-journeys.response-lost",
      "cross-surface-journeys.table-unavailable",
    ]);
    for (const row of rows) {
      expect(row.ownsPass).toBe(false);
      expect(row.klass).not.toBe("SUCCESS");
      expect(row.substituteStub).toBe(false);
    }
  });

  it("keeps the new screen free of sends, clocks, timers, storage, and the banned tokens", () => {
    const files = ["src/cross-surface-journeys.ts", "src/pages/CrossSurfaceJourneys.tsx", "src/pages/CrossSurfaceJourneysPanels.tsx"];
    const combined = files.map((file) => readFileSync(path.join(webRoot, file), "utf8")).join("\n");
    for (const token of [
      "fetch(",
      "XMLHttpRequest",
      "WebSocket",
      "sendBeacon",
      "invokeLocalCall",
      ".send(",
      "/health",
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
      "placeHold",
      "Idempotency-Key",
      "retry",
      "contract-fixtures",
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "indexedDB",
    ]) {
      expect(combined, token).not.toContain(token);
    }
    const css = readFileSync(path.join(webRoot, "src/styles.css"), "utf8");
    expect(css).not.toContain("@keyframes");
    expect(css).not.toMatch(/animation\s*:/);
  });

  it("names the surface, the ruling, and the limits in the docs and the README", () => {
    const doc = readFileSync(path.join(repoRoot, "docs/c-cross-surface-journeys-stub-apps-bind.md"), "utf8");
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    const closeout = readFileSync(path.join(repoRoot, "docs/c-local-workspace-closeout-apps-bind.md"), "utf8");
    const fixtureDoc = readFileSync(path.join(repoRoot, "docs/c-contract-fixture-library-apps-bind.md"), "utf8");
    expect(doc).toContain(WORKSPACE_RULING);
    expect(doc).toContain("cross-surface-journeys");
    expect(doc).toContain("COMPENSATION_UNDEFINED");
    expect(doc).toContain("UNDETERMINED");
    expect(doc).toContain("contract_change=NO");
    expect(doc).toContain("Browser pass");
    expect(readme).toContain("docs/c-cross-surface-journeys-stub-apps-bind.md");
    expect(readme).toContain("/journeys");
    expect(closeout).toContain("docs/c-cross-surface-journeys-stub-apps-bind.md");
    expect(closeout).toContain("| `c-cross-surface-journeys` | `cross-surface-journeys` |");
    expect(fixtureDoc).toContain("`cross-surface-journeys` | `/journeys`");
  });
});
