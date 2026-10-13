import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  CreditOriginationController,
  ORIGINATION_DESK_ACTOR,
  ORIGINATION_FOREIGN_REF,
  ORIGINATION_NOT_BOUND_REASON,
  ORIGINATION_SCENARIOS,
  createNotBoundCreditOrigination,
  createStubCreditOrigination,
  type OriginationScenario,
  type StubCreditOrigination,
} from "@kix/protocol-adapter";
import { CONTRACT_FIXTURES, fixturesForScreen } from "../../../packages/protocol-adapter/src/contract-fixtures";
import { App } from "../src/App";
import { PENDING_PRODUCERS } from "../src/handoff/packet";
import {
  ORIGINATION_SOURCE_LINE,
  buildOriginationModel,
  type LastAction,
  type OriginationActions,
  type OriginationModel,
} from "../src/credit-origination";
import {
  ApplicationSection,
  BasisSection,
  CommitmentSection,
  OriginationBanner,
  OriginationControls,
  OriginationSessionSection,
  OriginationStatus,
  PolicySection,
  ReasonsSection,
  RequestsSection,
} from "../src/pages/CreditOriginationPanels";
import { WORKSPACE_RULING, WORKSPACE_SURFACES } from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

/** Wording that would turn a request or a review into money or an approval. None may appear on screen. */
const POSITIVE_CLAIMS = [
  "Application approved",
  "Auto-approved",
  "Funds available",
  "Lendable capacity",
  "Credit approved",
  "Loan approved",
  "Disbursement complete",
  "Disbursed to you",
  "Payment complete",
  "Approved and disbursed",
  "Cash advance sent",
];

const NO_ACTIONS: OriginationActions = {
  refresh() {},
  switchScope() {},
  setScenario() {},
  newSession() {},
  advanceReview() {},
  advancePolicy() {},
  withdrawConsent() {},
  expireDocument() {},
  rivalRequest() {},
  revokeGrant() {},
  submit() {},
  amend() {},
  provideDocument() {},
  renewConsent() {},
  rereview() {},
  acceptCommitment() {},
  requestDrawdown() {},
};

function html(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element);
}

function pageHtml(
  model: OriginationModel,
  scenario: OriginationScenario = "clean",
  environment: "stub" | "integration-http" = "stub",
): string {
  return html(
    <MemoryRouter>
      <OriginationBanner environment={environment} scenario={scenario} model={model} />
      <OriginationControls scenario={scenario} actions={NO_ACTIONS} />
      <OriginationStatus model={model} />
      <ApplicationSection model={model} />
      <BasisSection model={model} />
      <PolicySection model={model} actions={NO_ACTIONS} />
      <ReasonsSection model={model} />
      <CommitmentSection model={model} />
      <RequestsSection model={model} actions={NO_ACTIONS} />
      <OriginationSessionSection session={model.session} />
    </MemoryRouter>,
  );
}

function expectClean(markup: string): void {
  for (const claim of POSITIVE_CLAIMS) {
    expect(markup, claim).not.toContain(claim);
  }
}

interface Rig {
  port: StubCreditOrigination;
  controller: CreditOriginationController;
  last: LastAction | null;
}

function rig(scenario: OriginationScenario = "clean", applicantRef?: string): Rig {
  const port = createStubCreditOrigination({ scenario });
  return {
    port,
    controller: new CreditOriginationController(port, { actorRef: ORIGINATION_DESK_ACTOR, applicantRef }),
    last: null,
  };
}

function modelOf(r: Rig): OriginationModel {
  return buildOriginationModel({ controller: r.controller, last: r.last });
}

describe("origination screen states", () => {
  it("declares synthetic provenance and the lane-separation contract in the banner", () => {
    const r = rig();
    const markup = pageHtml(modelOf(r));
    expect(markup).toContain("SYNTHETIC.");
    expect(markup).toContain(ORIGINATION_SOURCE_LINE);
    expect(markup).toContain("A submitted application is not a review decision");
    expect(markup).toContain("an explanation is never a decision");
    expect(markup).toContain("never parsed, summed, scaled, or compared");
    expect(markup).toContain(ORIGINATION_FOREIGN_REF);
    expect(markup).toContain(WORKSPACE_RULING);
    expect(markup).toContain('data-hold-record="not-bound"');
    expect(markup).toContain('data-not-composed="recorded"');
    expectClean(markup);
  });

  it("shows the loading word before the first read, with no rows", () => {
    const r = rig();
    const model = modelOf(r);
    expect(model.state).toBe("loading");
    const markup = pageHtml(model);
    expect(markup).toContain('data-origination-state="loading"');
    expect(markup).toContain('data-status-mark="loading"');
    expect(markup).toContain("No application in this read.");
    expect(markup).toContain("No claim in this read.");
    expect(markup).toContain("No consent in this read.");
    expect(markup).toContain("No commitment in this read.");
    expectClean(markup);
  });

  it("keeps the four lanes apart after a read: application, review, commitment, drawdown", async () => {
    const r = rig("in-review");
    await r.controller.read();
    const model = modelOf(r);
    expect(model.state).toBe("ready");
    const markup = pageHtml(model, "in-review");
    expect(markup).toContain('data-origination-state="ready"');
    expect(markup).toContain('data-source="synthetic-origination"');
    expect(markup).toContain('data-application-state="submitted"');
    expect(markup).toContain('data-decision-kind="pending"');
    expect(markup).toContain('data-commitment="none"');
    expect(markup).toContain('data-permission="not-permitted"');
    expect(markup).toContain("No drawdown request recorded");
    expect(markup).toContain(
      "submissionIsApproval false · explanationIsApproval false · approvalIsCommitment false · commitmentIsDrawdown false · disbursed false",
    );
    expect(markup).toContain('data-claims="all-false"');
    expectClean(markup);
  });

  it("shows an explanation as assistant-generated and never as the review decision", async () => {
    const r = rig("explanation-says-approved");
    await r.controller.read();
    const markup = pageHtml(modelOf(r), "explanation-says-approved");
    expect(markup).toContain('data-provenance="assistant-generated"');
    expect(markup).toContain("never a review decision");
    // The explanation's own words read like an approval; the decision stays pending.
    expect(markup).toContain("looks likely to be approved");
    expect(markup).toContain('data-decision-kind="pending"');
    expectClean(markup);
  });

  it("copies the source's own schedule rows for an approved decision and shows no commitment", async () => {
    const r = rig("approved");
    await r.controller.read();
    const markup = pageHtml(modelOf(r), "approved");
    expect(markup).toContain('data-decision-kind="approved"');
    expect(markup).toContain('data-commitment="none"');
    expect(markup).toContain("An approval is not a commitment");
    expect(markup).toContain("Rate label syn-rate-label-0001");
    expect(markup).toContain("data-schedule=");
    expect(markup).toContain("syn-installment-1");
    expectClean(markup);
  });

  it("separates empty, unavailable, denied, refused, and not-bound reads, and none shows a row", async () => {
    const empty = rig("empty");
    await empty.controller.read();
    expect(modelOf(empty)).toMatchObject({ state: "empty", actionLabel: "Read again" });
    expect(pageHtml(modelOf(empty), "empty")).toContain("No rows for this applicant in this read.");

    const readLost = rig("read-lost");
    await readLost.controller.read();
    const lostModel = modelOf(readLost);
    expect(lostModel.state).toBe("unavailable");
    const lostMarkup = pageHtml(lostModel, "read-lost");
    expect(lostMarkup).toContain('data-origination-state="unavailable"');
    expect(lostMarkup).toContain("This is not an application with no claim basis.");
    expect(lostMarkup).not.toContain("data-claim=");
    expectClean(lostMarkup);

    const foreign = rig("clean", ORIGINATION_FOREIGN_REF);
    await foreign.controller.read();
    const foreignModel = modelOf(foreign);
    expect(foreignModel.state).toBe("denied");
    const foreignMarkup = pageHtml(foreignModel);
    expect(foreignMarkup).toContain('data-origination-state="denied"');
    expect(foreignMarkup).toContain("SCOPE_DENIED");
    expect(foreignMarkup).not.toContain("data-claim=");
    expectClean(foreignMarkup);

    const claimed = rig("claims-approval");
    await claimed.controller.read();
    const claimedModel = modelOf(claimed);
    expect(claimedModel.state).toBe("refused");
    const claimedMarkup = pageHtml(claimedModel, "claims-approval");
    expect(claimedMarkup).toContain("No claim in this read");
    expect(claimedMarkup).not.toContain("data-claim=");
    expectClean(claimedMarkup);

    const notBound = new CreditOriginationController(createNotBoundCreditOrigination(), {
      actorRef: ORIGINATION_DESK_ACTOR,
    });
    await notBound.read();
    const notBoundModel = buildOriginationModel({ controller: notBound, last: null });
    expect(notBoundModel.state).toBe("not-bound");
    const notBoundMarkup = pageHtml(notBoundModel, "clean", "integration-http");
    expect(notBoundMarkup).toContain('data-origination-state="not-bound"');
    expect(notBoundMarkup).toContain(ORIGINATION_NOT_BOUND_REASON);
    expectClean(notBoundMarkup);
  });
});

describe("policy revision, consent, documents, and the shared limit", () => {
  it("flags a stale lane built under an older policy revision, never as current", async () => {
    const r = rig("stale-policy");
    await r.controller.read();
    const model = modelOf(r);
    const markup = pageHtml(model, "stale-policy");
    expect(markup).toContain('data-stale-lane="review"');
    expect(markup).toContain('data-stale-lane="commitment"');
    expect(markup).toContain('data-stale-lane-flag="true"');
    expect(markup).toContain("Flagged, never shown as current.");
    // The source still states permission; it is withheld here.
    expect(markup).toContain('data-permission="permitted"');
    expect(markup).toContain('data-withheld-line="drawdown"');
    expect(model.drawdownControl.enabled).toBe(false);
    expectClean(markup);
  });

  it("shows a withdrawn consent, suspends permission, and offers only the renew path", async () => {
    const r = rig("consent-withdrawn");
    await r.controller.read();
    const markup = pageHtml(modelOf(r), "consent-withdrawn");
    expect(markup).toContain('data-consent-state="withdrawn"');
    expect(markup).toContain("Withdrawn");
    expect(markup).toContain('data-permission="suspended"');
    expect(markup).toContain('data-remedy="renew-consent"');
    expect(markup).toContain("CONSENT_WITHDRAWN");
    expectClean(markup);
  });

  it("shows an expired document with the provide path and nothing else", async () => {
    const r = rig("docs-expired");
    await r.controller.read();
    const markup = pageHtml(modelOf(r), "docs-expired");
    expect(markup).toContain('data-document-state="expired"');
    expect(markup).toContain('data-remedy="provide-document"');
    expect(markup).toContain("DOCUMENT_EXPIRED");
    expectClean(markup);
  });

  it("states the shared limit only as the source's own rank lines, with no arithmetic", async () => {
    const r = rig("limit-contended");
    await r.controller.read();
    const markup = pageHtml(modelOf(r), "limit-contended");
    expect(markup).toContain('data-contention="contended"');
    expect(markup).toContain("data-limit-rank");
    expect(markup).toContain("Rank 1: another application (app-0002).");
    expect(markup).toContain("Rank 2: this application (app-0001).");
    expect(markup).toContain("No correction changes the order the source set.");
    expect(markup).not.toContain("Available credit");
    expectClean(markup);
  });

  it("names a dangling link without attaching it elsewhere", async () => {
    const r = rig("dangling-link");
    await r.controller.read();
    const model = modelOf(r);
    expect(model.unlinkedLines.length).toBeGreaterThan(0);
    const markup = pageHtml(model, "dangling-link");
    expect(markup).toContain('data-unlinked="true"');
    expect(markup).toContain("the read does not list");
    expectClean(markup);
  });
});

describe("requests, corrections, and the write fence", () => {
  it("records a submitted request as applied, never as a decision or a disbursement", async () => {
    const r = rig("clean");
    await r.controller.read();
    const result = await r.controller.submit("5000");
    expect(result.kind).toBe("APPLIED");
    const model = modelOf(r);
    expect(model.last?.phase).toBe("applied");
    const markup = pageHtml(model);
    expect(markup).toContain('data-last-request="1"');
    expect(markup).toContain('data-phase="applied"');
    expect(markup).toContain("Applied at the synthetic source");
    expect(markup).toContain("An accepted request is not a decision.");
    expect(markup).toContain("Nothing is disbursed.");
    expectClean(markup);
  });

  it("shows an unknown result plainly and fences every later request for the session", async () => {
    const r = rig("act-lost");
    await r.controller.read();
    const result = await r.controller.submit("1000");
    expect(result.kind).toBe("UNKNOWN");
    const fenced = modelOf(r);
    expect(fenced.last?.phase).toBe("unknown");
    expect(fenced.fenceLine).toContain("unknown outcome");
    expect(fenced.submitControl.enabled).toBe(false);
    const markup = pageHtml(fenced, "act-lost");
    expect(markup).toContain('data-fence="true"');
    expect(markup).toContain("Fenced.");
    expect(markup).toContain('data-enabled="false"');
    // A read does not lift the fence: the request may have applied.
    await r.controller.read();
    const after = modelOf(r);
    expect(after.state).toBe("ready");
    expect(after.fenceLine).not.toBeNull();
    expect(after.submitControl.enabled).toBe(false);
    expectClean(markup);
  });

  it("records a rejected request with the source's own code, and the limit race keeps the order", async () => {
    const r = rig("limit-race");
    await r.controller.read();
    const model = modelOf(r);
    expect(model.drawdownControl.enabled).toBe(true);
    const result = await r.controller.requestDrawdown();
    expect(result.kind).toBe("REJECTED");
    const rejected = modelOf(r);
    expect(rejected.last?.phase).toBe("rejected");
    expect(rejected.last?.code).toBe("LIMIT_TAKEN");
    const markup = pageHtml(rejected, "limit-race");
    expect(markup).toContain('data-phase="rejected"');
    expect(markup).toContain("LIMIT_TAKEN");
    expectClean(markup);
  });

  it("treats an answer that claims an approval as untrusted, shows it as refused, and fences", async () => {
    const r = rig("submit-claims-approval");
    await r.controller.read();
    const result = await r.controller.submit("1000");
    expect(result.kind).toBe("UNKNOWN");
    const model = modelOf(r);
    expect(model.last?.phase).toBe("refused");
    expect(model.fenceLine).not.toBeNull();
    expect(model.submitControl.enabled).toBe(false);
    const markup = pageHtml(model, "submit-claims-approval");
    expect(markup).toContain('data-phase="refused"');
    expect(markup).toContain('data-fence="true"');
    expectClean(markup);
  });

  it("keeps every request off under integration-http, with the not-bound reason on the button", async () => {
    const controller = new CreditOriginationController(createNotBoundCreditOrigination(), {
      actorRef: ORIGINATION_DESK_ACTOR,
    });
    await controller.read();
    const model = buildOriginationModel({ controller, last: null });
    for (const control of [
      model.submitControl,
      model.amendControl,
      model.rereviewControl,
      model.acceptControl,
      model.drawdownControl,
    ]) {
      expect(control.enabled).toBe(false);
      expect(control.reason).toBe(ORIGINATION_NOT_BOUND_REASON);
    }
    const markup = pageHtml(model, "clean", "integration-http");
    expect(markup).toContain('id="origination-submit"');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('data-blocked-reason="true"');
    expect(markup).toContain("No current producer tuple exists");
    // An off control stays focusable: aria-disabled, never the disabled attribute.
    expect(markup).not.toContain(" disabled");
    expectClean(markup);
  });

  it("guards requests before a read and keeps the reason reachably described", () => {
    const r = rig();
    const model = modelOf(r);
    expect(model.submitControl.enabled).toBe(false);
    const markup = pageHtml(model);
    expect(markup).toContain('aria-describedby="origination-submit-reason"');
    expect(markup).toContain('id="origination-submit-reason"');
    expect(markup).toContain("Blocked.");
  });

  it("offers only the paths the source names: provide and renew are per-row controls", async () => {
    const r = rig("consent-withdrawn");
    await r.controller.read();
    const model = modelOf(r);
    const withdrawn = model.consents.find((row) => row.state === "withdrawn");
    expect(withdrawn?.renew.enabled).toBe(true);
    const granted = model.consents.find((row) => row.state === "granted");
    expect(granted?.renew.enabled).toBe(false);
    expect(granted?.renew.reason).toContain("Nothing needs renewing");
    const markup = pageHtml(model, "consent-withdrawn");
    expect(markup).toContain("Renew cns-0002");
    expectClean(markup);
  });
});

describe("registration", () => {
  it("is one stub-only organizer surface with no sender, no action, and no desk method", () => {
    const surface = WORKSPACE_SURFACES.find((item) => item.id === "credit-origination");
    expect(surface).toMatchObject({
      role: "organizer",
      route: "/credit/origination",
      binding: "stub-only",
      sender: null,
      taskId: "c-credit-origination-stub",
      implemented: true,
      pageControl: true,
    });
    expect(surface?.actions).toEqual([]);
    expect(surface?.deskMethods).toEqual([]);
    expect(surface?.provenanceNote).toContain("integration-http");
    expect(surface?.provenanceNote).not.toMatch(/\bworks\b|live payment|funds moved|payment complete|admission complete|refund complete/i);
  });

  it("is recorded in the handoff packet as a pending producer that is not connected", () => {
    const row = PENDING_PRODUCERS.find((item) => item.id === "c-credit-origination");
    expect(row).toMatchObject({
      catalogue: "pending",
      connected: false,
      implementedHere: false,
      waitingSurface: "credit-origination",
    });
    const pending = JSON.parse(readFileSync(path.join(repoRoot, "docs/aiops/PENDING_NODES.json"), "utf8")) as {
      nodes: { id: string }[];
    };
    const ids = new Set(pending.nodes.map((node) => node.id));
    expect(ids.has("c-credit-origination")).toBe(true);
  });

  it("has nine synthetic fixture rows that own no pass and cover stale, consent, and limit contention", () => {
    const rows = fixturesForScreen("credit-origination");
    expect(rows.map((row) => row.id)).toEqual([
      "credit-origination.stale-read",
      "credit-origination.stale-policy",
      "credit-origination.consent-withdrawn",
      "credit-origination.document-expired",
      "credit-origination.limit-race",
      "credit-origination.scope-denied",
      "credit-origination.claim-refused",
      "credit-origination.write-lost",
      "credit-origination.read-lost",
    ]);
    for (const row of rows) {
      expect(row.ownsPass).toBe(false);
      expect(row.source).toBe("synthetic-fixture");
      expect(row.klass).not.toBe("SUCCESS");
      expect(row.substituteStub).toBe(false);
    }
    expect(CONTRACT_FIXTURES.filter((row) => row.screenId === "credit-origination" && row.klass === "NOT_BOUND")).toEqual([]);
  });

  it("keeps the new screen free of sends, clocks, timers, money math, and the write vocabulary", () => {
    const files = [
      "src/credit-origination.ts",
      "src/pages/CreditOrigination.tsx",
      "src/pages/CreditOriginationPanels.tsx",
    ];
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
      "parseInt",
      "parseFloat",
      "BigInt",
      "toFixed",
      ".reduce(",
    ]) {
      expect(combined, token).not.toContain(token);
    }
    const css = readFileSync(path.join(webRoot, "src/styles.css"), "utf8");
    expect(css).toContain(".origination");
    expect(css).not.toContain("@keyframes");
    expect(css).not.toMatch(/animation\s*:/);
  });

  it("keeps the scenario set to the adapter list and the page free of a positive claim", () => {
    expect(ORIGINATION_SCENARIOS.length).toBeGreaterThan(0);
    const r = rig();
    const markup = pageHtml(modelOf(r));
    expectClean(markup);
  });

  it("reaches the route through the app shell and the navigation", () => {
    const app = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/credit/origination"]}>
        <App />
      </MemoryRouter>,
    );
    expect(app).toContain("Credit origination (synthetic)");
    expect(app).toContain('href="/credit/origination"');
    expect(app).toContain("SYNTHETIC");
    expect(app).toContain('data-adapter-environment="stub"');
  });

  it("names the surface in the docs and the README", () => {
    const doc = readFileSync(path.join(repoRoot, "docs/c-credit-origination-stub-apps-bind.md"), "utf8");
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    expect(doc).toContain(WORKSPACE_RULING);
    expect(doc).toContain("credit-origination");
    expect(doc).toContain("Browser run");
    expect(readme).toContain("docs/c-credit-origination-stub-apps-bind.md");
    expect(readme).toContain("/credit/origination");
  });
});
