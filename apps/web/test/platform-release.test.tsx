import { KIX_SDK_0_CONSUMPTION_DIGESTS } from "@kix/protocol-adapter";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  PlatformReleaseController,
  RELEASE_DECISION_ITEMS,
  RELEASE_DENOMINATOR_AREAS,
  RELEASE_GUEST_ACTOR,
  RELEASE_HANDOFF_LANES,
  RELEASE_NOT_BOUND_REASON,
  RELEASE_RULING,
  RELEASE_STATE,
  createNotBoundReleaseRunner,
  createStubReleaseRunner,
} from "@kix/protocol-adapter";
import { App } from "../src/App";
import {
  RELEASE_BOUNDARY,
  RELEASE_PENDING_NOTE,
  buildReleaseModel,
  runResultLine,
  type LastAction,
} from "../src/platform-release";
import {
  CandidateSection,
  ChecksSection,
  DecisionsSection,
  DenominatorsSection,
  HandoffSection,
  PacketSummary,
  QualificationSection,
  ReleaseBanner,
  ReleaseControls,
  ReleaseSession,
  ReleaseStatus,
} from "../src/pages/PlatformReleasePanels";
import { PENDING_PRODUCERS } from "../src/handoff/packet";
import { WORKSPACE_SURFACES } from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

const BANNED = /[$₩]|KRW|USD|still open|in stock/i;

/** Wording that would turn a synthetic record into a real release. None may appear on screen. */
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
  "Release approved",
];

function html(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element);
}

async function settledController(scenario: "clean" | "claims-pass" = "clean") {
  const ctl = new PlatformReleaseController(createStubReleaseRunner({ scenario }), {
    actorRef: "release-runner",
  });
  const result = await ctl.run("rel-test-1");
  return { ctl, result };
}

function pageHtml(model: ReturnType<typeof buildReleaseModel>): string {
  return html(
    <MemoryRouter>
      <div>
        <ReleaseBanner environment="stub" scenario="clean" model={model} />
        <ReleaseStatus model={model} />
        {model.packet ? (
          <>
            <PacketSummary packet={model.packet} />
            <CandidateSection packet={model.packet} />
            <QualificationSection packet={model.packet} />
            <DecisionsSection packet={model.packet} />
            <HandoffSection packet={model.packet} />
            <DenominatorsSection packet={model.packet} />
            <ChecksSection packet={model.packet} />
          </>
        ) : null}
        <ReleaseSession model={model} />
      </div>
    </MemoryRouter>,
  );
}

describe("platform release screen", () => {
  it("shows no run sent before the first run, with a word for it", async () => {
    const ctl = new PlatformReleaseController(createStubReleaseRunner(), { actorRef: "release-runner" });
    const model = buildReleaseModel(ctl.state(), null);
    expect(model.state).toBe("none");
    const markup = pageHtml(model);
    expect(markup).toContain("No release run has been sent in this session.");
    expect(markup).toContain("No run sent in this session.");
    expect(markup).toContain("SYNTHETIC");
    expect(markup).toContain(RELEASE_BOUNDARY);
    expect(markup).toContain(RELEASE_PENDING_NOTE);
    expect(markup).toContain(RELEASE_RULING);
    expect(markup).not.toMatch(BANNED);
    for (const claim of POSITIVE_CLAIMS) {
      expect(markup, claim).not.toContain(claim);
    }
  });

  it("renders the recorded packet: tuple, qualification, decisions, handoffs, and denominators", async () => {
    const { ctl, result } = await settledController();
    expect(result.kind).toBe("CONFIRMED");
    const last: LastAction = { seq: 1, kind: "run", result };
    const model = buildReleaseModel(ctl.state(), last);
    expect(model.state).toBe("ready");
    expect(model.packet).not.toBeNull();
    const markup = pageHtml(model);
    expect(markup).toContain(`Release state ${RELEASE_STATE}`);
    expect(markup).toContain("STUB_CANDIDATE_RECORDED");
    expect(markup).toContain("data-packet=");
    expect(markup).toContain("fixture catalogue v2");
    for (const digest of Object.values(KIX_SDK_0_CONSUMPTION_DIGESTS)) {
      expect(markup).toContain(digest);
    }
    expect(markup).toContain("Released false");
    expect(markup).toContain("publicDeploy false");
    expect(markup).toContain("realMoneyApproval false");
    expect(markup).toContain("realUserAcceptance false");
    expect(markup).toContain("realOperationsStarted false");
    expect(markup).toContain("releasePromoted false");
    expect(markup).toContain("approvalReusedAcrossTuple false");
    expect(markup).toContain("STUB_RUN_RECORDED");
    expect(markup).toContain("PENDING_USER_DECISION");
    for (const item of RELEASE_DECISION_ITEMS) {
      expect(markup, item).toContain(`data-decision="${item}"`);
    }
    expect(markup).toContain("awaiting-user-decision");
    expect(markup).toContain("not-open");
    for (const lane of RELEASE_HANDOFF_LANES) {
      expect(markup, lane).toContain(`data-lane="${lane}"`);
    }
    expect(markup).toContain(`${PENDING_PRODUCERS.length} pending producers listed in PENDING_PRODUCERS`);
    for (const area of RELEASE_DENOMINATOR_AREAS) {
      expect(markup, area).toContain(`data-area="${area}"`);
      expect(markup, area).toContain("own denominator");
    }
    expect(markup).toContain('data-check="bindings.approval-scope"');
    expect(markup).toContain("never reused");
    expect(markup).not.toMatch(BANNED);
    for (const claim of POSITIVE_CLAIMS) {
      expect(markup, claim).not.toContain(claim);
    }
  });

  it("keeps publish and operate not-open and install awaiting the user", async () => {
    const { ctl } = await settledController();
    const model = buildReleaseModel(ctl.state(), null);
    const install = model.packet?.decisions.find((item) => item.id === "install");
    const publish = model.packet?.decisions.find((item) => item.id === "publish");
    const operate = model.packet?.decisions.find((item) => item.id === "operate");
    expect(install?.decision).toBe("awaiting-user-decision");
    expect(publish?.decision).toBe("not-open");
    expect(operate?.decision).toBe("not-open");
    expect(publish?.blockedBy).toContain("k-platform-release");
  });

  it("keeps the run control off with its fence reason after an unknown run", async () => {
    const ctl = new PlatformReleaseController(
      {
        environment: "stub",
        source: "synthetic-release",
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
      { actorRef: "release-runner" },
    );
    const result = await ctl.run("rel-x");
    const model = buildReleaseModel(ctl.state(), { seq: 1, kind: "run", result }, ctl.gateFor("rel-preview"));
    expect(model.state).toBe("unknown");
    expect(model.runControl.enabled).toBe(false);
    expect(model.runControl.reason).toContain("rel-x");
    const markup = html(
      <MemoryRouter>
        <ReleaseControls scenario="clean" heldSupported={false} model={model} actions={{ run() {}, deliverHeld() {}, switchActor() {}, setScenario() {}, newSession() {} }} />
      </MemoryRouter>,
    );
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('aria-describedby="rel-run-reason"');
    // An off control stays focusable: aria-disabled, never the disabled attribute.
    expect(markup).not.toMatch(/<button[^>]* disabled/);
    expect(markup).toContain("unknown");
  });

  it("records an untrusted packet as unknown and stores nothing", async () => {
    const { ctl, result } = await settledController("claims-pass");
    expect(result.kind).toBe("UNKNOWN");
    const line = runResultLine(result);
    expect(line).toContain("unknown");
    const model = buildReleaseModel(ctl.state(), { seq: 1, kind: "run", result });
    expect(model.state).toBe("unknown");
    expect(model.packet).toBeNull();
    const markup = pageHtml(model);
    expect(markup).not.toContain("data-packet=");
  });

  it("shows the not-bound reason on integration-http with no stub switch", async () => {
    const ctl = new PlatformReleaseController(createNotBoundReleaseRunner(), { actorRef: "release-runner" });
    const result = await ctl.run("rel-nb");
    expect(result.kind).toBe("FENCED");
    const model = buildReleaseModel(ctl.state(), { seq: 1, kind: "run", result }, ctl.gateFor("rel-preview"));
    expect(model.runControl.enabled).toBe(false);
    expect(model.runControl.reason).toBe(RELEASE_NOT_BOUND_REASON);
    const markup = pageHtml(model);
    expect(markup).toContain(RELEASE_NOT_BOUND_REASON);
    expect(markup).not.toContain("fall back");
  });

  it("renders in the app at /release with navigation and skip link", () => {
    const markup = html(
      <MemoryRouter initialEntries={["/release"]}>
        <App />
      </MemoryRouter>,
    );
    expect(markup).toContain("Platform release candidate");
    expect(markup).toContain('href="/release"');
    expect(markup).toContain("SYNTHETIC");
    expect(markup).toContain('aria-label="Release sections"');
    expect(markup).toContain("Skip to content");
    expect(markup).toContain('id="rel-run"');
    expect(markup).not.toMatch(BANNED);
  });

  it("keeps page source free of protocol calls and forbidden tokens", () => {
    for (const file of ["src/platform-release.ts", "src/pages/PlatformRelease.tsx", "src/pages/PlatformReleasePanels.tsx"]) {
      const source = readFileSync(path.join(webRoot, file), "utf8");
      for (const token of ["fetch(", "invokeLocalCall", "settle_capture", "contract-fixtures", "XMLHttpRequest", "Math.random", "Date.now", "localStorage"]) {
        expect(source, `${file} contains ${token}`).not.toContain(token);
      }
    }
  });

  it("is registered in the workspace, the handoff pending list, and the docs", () => {
    const surface = WORKSPACE_SURFACES.find((item) => item.id === "platform-release");
    expect(surface?.route).toBe("/release");
    expect(surface?.taskId).toBe("c-platform-release-stub");
    expect(surface?.implemented).toBe(true);
    const pending = PENDING_PRODUCERS.find((row) => row.id === "c-platform-release");
    expect(pending?.waitingSurface).toBe("platform-release");
    const doc = readFileSync(path.join(repoRoot, "docs/c-platform-release-stub-apps-bind.md"), "utf8");
    expect(doc).toContain("an approval under a different source or contract tuple is never reused");
    expect(doc).toContain(RELEASE_RULING);
    expect(doc).toContain("STUB_CANDIDATE_RECORDED");
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    expect(readme).toContain("docs/c-platform-release-stub-apps-bind.md");
    const fixturesDoc = readFileSync(path.join(repoRoot, "docs/c-contract-fixture-library-apps-bind.md"), "utf8");
    expect(fixturesDoc).toContain("platform-release");
    const closeout = readFileSync(path.join(repoRoot, "docs/c-local-workspace-closeout-apps-bind.md"), "utf8");
    expect(closeout).toContain("`c-platform-release` | `platform-release`");
    expect(closeout).toContain("docs/c-platform-release-stub-apps-bind.md");
  });

  it("keeps the guest actor a separate label that is never an authentication result", () => {
    expect(RELEASE_GUEST_ACTOR).toBe("release-reviewer");
  });
});
