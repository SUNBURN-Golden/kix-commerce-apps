import { KIX_SDK_0_CONSUMPTION_DIGESTS } from "@kix/protocol-adapter";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  OperationalQualificationController,
  QUALIFICATION_CLASSES,
  QUALIFICATION_DENOMINATOR_AREAS,
  QUALIFICATION_EVIDENCE_SCOPES,
  QUALIFICATION_GUEST_ACTOR,
  QUALIFICATION_NOT_BOUND_REASON,
  QUALIFICATION_RULING,
  QUALIFICATION_STATE,
  createNotBoundQualificationRunner,
  createStubQualificationRunner,
} from "@kix/protocol-adapter";
import { App } from "../src/App";
import {
  QUALIFICATION_BOUNDARY,
  QUALIFICATION_PENDING_NOTE,
  buildQualificationModel,
  runResultLine,
  type LastAction,
} from "../src/operational-qualification";
import {
  CandidatesSection,
  DenominatorsSection,
  EvidenceSection,
  ExercisesSection,
  JourneysSection,
  OpsSection,
  PacketSummary,
  QualificationBanner,
  QualificationControls,
  QualificationSession,
  QualificationStatus,
} from "../src/pages/OperationalQualificationPanels";
import { PENDING_PRODUCERS } from "../src/handoff/packet";
import { WORKSPACE_SURFACES } from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

const BANNED = /[$₩]|KRW|USD|still open|in stock/i;

/** Wording that would turn a synthetic record into a real qualification. None may appear on screen. */
const POSITIVE_CLAIMS = [
  "Payment complete",
  "Payment received",
  "Purchased",
  "Ticket issued",
  "Admission granted",
  "Refund sent",
  "Funds moved",
  "QUALIFIED for production",
  "Deployment complete",
  "Integration complete",
  "User review complete",
];

function html(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element);
}

async function settledController(scenario: "clean" | "claims-pass" = "clean") {
  const ctl = new OperationalQualificationController(createStubQualificationRunner({ scenario }), {
    actorRef: "qualification-runner",
  });
  const result = await ctl.run("oq-test-1");
  return { ctl, result };
}

function pageHtml(model: ReturnType<typeof buildQualificationModel>): string {
  return html(
    <MemoryRouter>
      <div>
        <QualificationBanner environment="stub" scenario="clean" model={model} />
        <QualificationStatus model={model} />
        {model.packet ? (
          <>
            <PacketSummary packet={model.packet} />
            <JourneysSection packet={model.packet} />
            <ExercisesSection packet={model.packet} />
            <DenominatorsSection packet={model.packet} />
            <EvidenceSection packet={model.packet} />
            <CandidatesSection packet={model.packet} />
            <OpsSection packet={model.packet} />
          </>
        ) : null}
        <QualificationSession model={model} />
      </div>
    </MemoryRouter>,
  );
}

describe("operational qualification screen", () => {
  it("shows no run sent before the first run, with a word for it", async () => {
    const ctl = new OperationalQualificationController(createStubQualificationRunner(), {
      actorRef: "qualification-runner",
    });
    const model = buildQualificationModel(ctl.state(), null);
    expect(model.state).toBe("none");
    const markup = pageHtml(model);
    expect(markup).toContain("No qualification run has been sent in this session.");
    expect(markup).toContain("No run sent in this session.");
    expect(markup).toContain("SYNTHETIC");
    expect(markup).toContain(QUALIFICATION_BOUNDARY);
    expect(markup).toContain(QUALIFICATION_PENDING_NOTE);
    expect(markup).toContain(QUALIFICATION_RULING);
    expect(markup).not.toMatch(BANNED);
    for (const claim of POSITIVE_CLAIMS) {
      expect(markup, claim).not.toContain(claim);
    }
  });

  it("renders the recorded packet: journeys, classes, denominators, evidence, candidates, and ops", async () => {
    const { ctl, result } = await settledController();
    expect(result.kind).toBe("CONFIRMED");
    const last: LastAction = { seq: 1, kind: "run", result };
    const model = buildQualificationModel(ctl.state(), last);
    expect(model.state).toBe("ready");
    expect(model.packet).not.toBeNull();
    const markup = pageHtml(model);
    expect(markup).toContain(`Qualification state ${QUALIFICATION_STATE}`);
    expect(markup).toContain("STUB_RUN_RECORDED");
    expect(markup).toContain("data-packet=");
    expect(markup).toContain("fixture catalogue v2");
    for (const digest of Object.values(KIX_SDK_0_CONSUMPTION_DIGESTS)) {
      expect(markup).toContain(digest);
    }
    expect(markup).toContain("data-journey=");
    expect(markup).toContain("data-verdict=\"closed\"");
    expect(markup).toContain("data-verdict=\"open\"");
    expect(markup).toContain("data-verdict=\"blocked\"");
    for (const klass of QUALIFICATION_CLASSES) {
      expect(markup, klass).toContain(`(${klass})`);
    }
    for (const area of QUALIFICATION_DENOMINATOR_AREAS) {
      expect(markup, area).toContain(`data-area="${area}"`);
      expect(markup, area).toContain("own denominator");
    }
    for (const scope of QUALIFICATION_EVIDENCE_SCOPES) {
      expect(markup, scope).toContain(`data-evidence-scope="${scope}"`);
    }
    expect(markup).toContain("executed");
    expect(markup).toContain("reused");
    expect(markup).toContain("unverified");
    expect(markup).toContain("data-candidate=");
    expect(markup).toContain("stays a candidate");
    expect(markup).toContain("Operational support:");
    expect(markup).toContain("Incident handoff:");
    expect(markup).toContain(`${PENDING_PRODUCERS.length} pending producers listed in PENDING_PRODUCERS`);
    expect(markup).toContain("UI review material:");
    expect(markup).toContain("Promoted false");
    expect(markup).toContain("publicDeploy false");
    expect(markup).toContain("realMoneyApproval false");
    expect(markup).toContain("qualificationPromoted false");
    expect(markup).toContain("per-call confirmed is never an end-to-end journey close");
    expect(markup).not.toMatch(BANNED);
    for (const claim of POSITIVE_CLAIMS) {
      expect(markup, claim).not.toContain(claim);
    }
  });

  it("marks the per-call confirmed journeys open or blocked, never closed", async () => {
    const { ctl } = await settledController();
    const model = buildQualificationModel(ctl.state(), null);
    const rival = model.packet?.journeys.find((item) => item.id === "journey.platform-trade-rival");
    expect(rival?.verdict).toBe("open");
    expect(rival?.callLines.some((line) => line.startsWith("book: CONFIRMED"))).toBe(true);
    const declined = model.packet?.journeys.find((item) => item.id === "journey.provider-declined");
    expect(declined?.verdict).toBe("open");
    const clean = model.packet?.journeys.find((item) => item.id === "journey.platform-trade-clean");
    expect(clean?.verdict).toBe("closed");
  });

  it("keeps the run control off with its fence reason after an unknown run", async () => {
    const ctl = new OperationalQualificationController(
      {
        environment: "stub",
        source: "synthetic-qualification",
        scenario: "clean",
        run(request) {
          return Promise.resolve({
            kind: "ready" as const,
            intentRef: `${request.intentRef}-wrong`,
            contextKey: request.contextKey,
            packet: null as never,
          });
        },
        deliverHeld() {
          return 0;
        },
      },
      { actorRef: "qualification-runner" },
    );
    const result = await ctl.run("oq-x");
    const model = buildQualificationModel(ctl.state(), { seq: 1, kind: "run", result }, ctl.gateFor("oq-preview"));
    expect(model.state).toBe("unknown");
    expect(model.runControl.enabled).toBe(false);
    expect(model.runControl.reason).toContain("oq-x");
    const markup = html(
      <MemoryRouter>
        <QualificationControls scenario="clean" heldSupported={false} model={model} actions={{ run() {}, deliverHeld() {}, switchActor() {}, setScenario() {}, newSession() {} }} />
      </MemoryRouter>,
    );
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('aria-describedby="oq-run-reason"');
    // An off control stays focusable: aria-disabled, never the disabled attribute.
    expect(markup).not.toMatch(/<button[^>]* disabled/);
    expect(markup).toContain("unknown");
  });

  it("records an untrusted packet as unknown and stores nothing", async () => {
    const { ctl, result } = await settledController("claims-pass");
    expect(result.kind).toBe("UNKNOWN");
    const line = runResultLine(result);
    expect(line).toContain("unknown");
    const model = buildQualificationModel(ctl.state(), { seq: 1, kind: "run", result });
    expect(model.state).toBe("unknown");
    expect(model.packet).toBeNull();
    const markup = pageHtml(model);
    expect(markup).not.toContain("data-packet=");
  });

  it("shows the not-bound reason on integration-http with no stub switch", async () => {
    const ctl = new OperationalQualificationController(createNotBoundQualificationRunner(), {
      actorRef: "qualification-runner",
    });
    const result = await ctl.run("oq-nb");
    expect(result.kind).toBe("FENCED");
    const model = buildQualificationModel(ctl.state(), { seq: 1, kind: "run", result }, ctl.gateFor("oq-preview"));
    expect(model.runControl.enabled).toBe(false);
    expect(model.runControl.reason).toBe(QUALIFICATION_NOT_BOUND_REASON);
    const markup = pageHtml(model);
    expect(markup).toContain(QUALIFICATION_NOT_BOUND_REASON);
    expect(markup).not.toContain("fall back");
  });

  it("renders in the app at /qualification with navigation and skip link", () => {
    const markup = html(
      <MemoryRouter initialEntries={["/qualification"]}>
        <App />
      </MemoryRouter>,
    );
    expect(markup).toContain("Platform operational qualification");
    expect(markup).toContain('href="/qualification"');
    expect(markup).toContain("SYNTHETIC");
    expect(markup).toContain('aria-label="Qualification sections"');
    expect(markup).toContain("Skip to content");
    expect(markup).toContain('id="oq-run"');
    expect(markup).not.toMatch(BANNED);
  });

  it("keeps page source free of protocol calls and forbidden tokens", () => {
    for (const file of ["src/operational-qualification.ts", "src/pages/OperationalQualification.tsx", "src/pages/OperationalQualificationPanels.tsx"]) {
      const source = readFileSync(path.join(webRoot, file), "utf8");
      for (const token of ["fetch(", "invokeLocalCall", "settle_capture", "contract-fixtures", "XMLHttpRequest", "Math.random", "Date.now", "localStorage"]) {
        expect(source, `${file} contains ${token}`).not.toContain(token);
      }
    }
  });

  it("is registered in the workspace, the handoff pending list, and the docs", () => {
    const surface = WORKSPACE_SURFACES.find((item) => item.id === "platform-operational-qualification");
    expect(surface?.route).toBe("/qualification");
    expect(surface?.taskId).toBe("c-platform-operational-qualification-stub");
    expect(surface?.implemented).toBe(true);
    const pending = PENDING_PRODUCERS.find((row) => row.id === "c-platform-operational-qualification");
    expect(pending?.waitingSurface).toBe("platform-operational-qualification");
    const doc = readFileSync(path.join(repoRoot, "docs/c-platform-operational-qualification-stub-apps-bind.md"), "utf8");
    expect(doc).toContain("a per-call confirmed is never an end-to-end journey close");
    expect(doc).toContain(QUALIFICATION_RULING);
    expect(doc).toContain("STUB_RUN_RECORDED");
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    expect(readme).toContain("docs/c-platform-operational-qualification-stub-apps-bind.md");
    const fixturesDoc = readFileSync(path.join(repoRoot, "docs/c-contract-fixture-library-apps-bind.md"), "utf8");
    expect(fixturesDoc).toContain("platform-operational-qualification");
    const closeout = readFileSync(path.join(repoRoot, "docs/c-local-workspace-closeout-apps-bind.md"), "utf8");
    expect(closeout).toContain("`c-platform-operational-qualification` | `platform-operational-qualification`");
    expect(closeout).toContain("docs/c-platform-operational-qualification-stub-apps-bind.md");
  });

  it("keeps the guest actor a separate label that is never an authentication result", () => {
    expect(QUALIFICATION_GUEST_ACTOR).toBe("qualification-reviewer");
  });
});
