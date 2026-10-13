import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  CreditServicingController,
  SERVICING_APPROVER_ACTOR,
  SERVICING_DESK_ACTOR,
  SERVICING_FOREIGN_REF,
  SERVICING_NOT_BOUND_REASON,
  SERVICING_SCENARIOS,
  SERVICING_VIEWER_ACTOR,
  createNotBoundCreditServicing,
  createStubCreditServicing,
  type ServicingScenario,
  type StubCreditServicing,
} from "@kix/protocol-adapter";
import { CONTRACT_FIXTURES, fixturesForScreen } from "../../../packages/protocol-adapter/src/contract-fixtures";
import { App } from "../src/App";
import { PENDING_PRODUCERS } from "../src/handoff/packet";
import {
  SERVICING_SOURCE_LINE,
  buildServicingModel,
  type ServicingActions,
  type ServicingLastAction,
  type ServicingModel,
} from "../src/credit-servicing";
import {
  CaseSection,
  DrawSection,
  PaymentsSection,
  ScheduleSection,
  ServicingBanner,
  ServicingControls,
  ServicingReasonsSection,
  ServicingRequestsSection,
  ServicingSessionSection,
  ServicingStatus,
  TimelineSection,
} from "../src/pages/CreditServicingPanels";
import { WORKSPACE_RULING, WORKSPACE_SURFACES } from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

/** Wording that would turn an observation, a repayment, or a closure into money moved or debt gone. None may appear on screen. */
const POSITIVE_CLAIMS = [
  "Disbursement confirmed",
  "Funds confirmed",
  "Payment collected",
  "Limit restored",
  "Debt forgiven",
  "Debt extinguished",
  "Collection completed",
  "Contact made",
  "You received funds",
  "Case resolved",
];

const NO_ACTIONS: ServicingActions = {
  refresh() {},
  proposeAllocation() {},
  proposeAdjustment() {},
  proposeCaseTransition() {},
  approveProposal() {},
  switchScope() {},
  switchActor() {},
  observeDraw() {},
  receivePayment() {},
  reverseAllocation() {},
  markOverdue() {},
  advanceSchedule() {},
  revokeGrant() {},
  setScenario() {},
  newSession() {},
};

function html(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element);
}

function pageHtml(
  model: ServicingModel,
  scenario: ServicingScenario = "clean",
  environment: "stub" | "integration-http" = "stub",
): string {
  return html(
    <MemoryRouter>
      <ServicingBanner environment={environment} scenario={scenario} model={model} />
      <ServicingControls scenario={scenario} actorRef={SERVICING_DESK_ACTOR} actions={NO_ACTIONS} />
      <ServicingStatus model={model} />
      <DrawSection model={model} />
      <ScheduleSection model={model} />
      <PaymentsSection model={model} actions={NO_ACTIONS} />
      <CaseSection model={model} actions={NO_ACTIONS} />
      <TimelineSection model={model} />
      <ServicingReasonsSection model={model} />
      <ServicingRequestsSection model={model} actions={NO_ACTIONS} />
      <ServicingSessionSection session={model.session} />
    </MemoryRouter>,
  );
}

function expectClean(markup: string): void {
  for (const claim of POSITIVE_CLAIMS) {
    expect(markup, claim).not.toContain(claim);
  }
}

interface Rig {
  port: StubCreditServicing;
  controller: CreditServicingController;
  last: ServicingLastAction | null;
}

function rig(scenario: ServicingScenario = "clean", actorRef: string = SERVICING_DESK_ACTOR, obligationRef?: string): Rig {
  const port = createStubCreditServicing({ scenario });
  return {
    port,
    controller: new CreditServicingController(port, { actorRef, obligationRef }),
    last: null,
  };
}

function modelOf(r: Rig): ServicingModel {
  return buildServicingModel({ controller: r.controller, last: r.last });
}

describe("servicing screen states", () => {
  it("declares synthetic provenance and the four-facts contract in the banner", () => {
    const r = rig();
    const markup = pageHtml(modelOf(r));
    expect(markup).toContain("SYNTHETIC.");
    expect(markup).toContain(SERVICING_SOURCE_LINE);
    expect(markup).toContain("A recorded draw instruction is not a disbursement observation");
    expect(markup).toContain("never shown as the debt ending");
    expect(markup).toContain("never parsed, summed, scaled, or compared");
    expect(markup).toContain(SERVICING_FOREIGN_REF);
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
    expect(markup).toContain('data-servicing-state="loading"');
    expect(markup).toContain('data-status-mark="loading"');
    expect(markup).toContain("No draw in this read.");
    expect(markup).toContain("No schedule row in this read.");
    expect(markup).toContain("No payment in this read.");
    expect(markup).toContain("No servicing case in this read.");
    expectClean(markup);
  });

  it("keeps the four facts apart after a read: instruction, observation, reservation, exposure", async () => {
    const r = rig();
    await r.controller.read();
    const model = modelOf(r);
    expect(model.state).toBe("ready");
    const markup = pageHtml(model);
    expect(markup).toContain('data-servicing-state="ready"');
    expect(markup).toContain('data-source="synthetic-servicing"');
    expect(markup).toContain('data-instruction="recorded"');
    expect(markup).toContain('data-observation-state="observed"');
    expect(markup).toContain('data-reservation-state="held"');
    expect(markup).toContain('data-exposure-state="open"');
    expect(markup).toContain('data-limit-state="held"');
    expect(markup).toContain('data-cut-state="clean"');
    expect(markup).toContain(
      "instructionIsDisbursement false · observationIsConfirmedFunds false · partialRepaymentRestoresLimit false · reversalErasesHistory false · caseClosureIsDebtExtinguished false · contactMade false · collectionExecuted false · disbursed false",
    );
    expect(markup).toContain('data-claims="all-false"');
    expectClean(markup);
  });

  it("keeps an unknown observation unknown and withholds an undecided exposure figure", async () => {
    const r = rig("draw-unknown");
    await r.controller.read();
    const model = modelOf(r);
    const markup = pageHtml(model, "draw-unknown");
    expect(markup).toContain('data-observation-state="unknown"');
    expect(markup).toContain('data-exposure-state="unknown"');
    expect(markup).toContain("Exposure UNDETERMINED.");
    expect(markup).not.toContain('data-exposure-state="open"');
    expectClean(markup);
  });

  it("shows a partial repayment with its unallocated remainder and never restores the limit", async () => {
    const r = rig("partial-repayment");
    await r.controller.read();
    const model = modelOf(r);
    const markup = pageHtml(model, "partial-repayment");
    expect(markup).toContain('data-payment-state="partial"');
    expect(markup).toContain('data-unallocated="true"');
    expect(markup).toContain("as the source labels it. It applies itself to nothing.");
    expect(markup).toContain('data-limit-state="held"');
    expect(markup).toContain("A partial repayment does not restore this limit by itself.");
    expectClean(markup);
  });

  it("keeps a reversed allocation on the timeline with both events", async () => {
    const r = rig("reversal");
    await r.controller.read();
    const markup = pageHtml(modelOf(r), "reversal");
    expect(markup).toContain('data-allocation-state="reversed"');
    expect(markup).toContain('data-reversal="rev-0001"');
    expect(markup).toContain("Removed the effect of alc-0001");
    expect(markup).toContain('data-event-kind="reversal"');
    expect(markup).toContain('data-event-kind="allocation"');
    expectClean(markup);
  });

  it("shows a charged-off closure as bookkeeping, never as the debt ending", async () => {
    const r = rig("charged-off");
    await r.controller.read();
    const markup = pageHtml(modelOf(r), "charged-off");
    expect(markup).toContain('data-case-status="closed"');
    expect(markup).toContain("Closed Charged off");
    expect(markup).toContain('data-debt-label="not-extinguished"');
    expect(markup).toContain("not the debt ending");
    expectClean(markup);
  });

  it("shows a payment after charge-off as its own fact that reopens nothing", async () => {
    const r = rig("post-charge-off-payment");
    await r.controller.read();
    const model = modelOf(r);
    const markup = pageHtml(model, "post-charge-off-payment");
    expect(markup).toContain('data-payment-timing="post-charge-off"');
    expect(markup).toContain("After charge-off");
    expect(markup).toContain('data-case-status="closed"');
    expect(markup).toContain('data-debt-label="not-extinguished"');
    expectClean(markup);
  });

  it("separates empty, unavailable, denied, refused, and not-bound reads, and none shows a row", async () => {
    const empty = rig("empty");
    await empty.controller.read();
    expect(modelOf(empty)).toMatchObject({ state: "empty", actionLabel: "Read again" });
    expect(pageHtml(modelOf(empty), "empty")).toContain("No rows for this obligation in this read.");

    const readLost = rig("read-lost");
    await readLost.controller.read();
    const lostModel = modelOf(readLost);
    expect(lostModel.state).toBe("unavailable");
    const lostMarkup = pageHtml(lostModel, "read-lost");
    expect(lostMarkup).toContain('data-servicing-state="unavailable"');
    expect(lostMarkup).toContain("This is not a settled servicing record.");
    expect(lostMarkup).not.toContain("data-payment=");
    expectClean(lostMarkup);

    const foreign = rig("clean", SERVICING_DESK_ACTOR, SERVICING_FOREIGN_REF);
    await foreign.controller.read();
    const foreignModel = modelOf(foreign);
    expect(foreignModel.state).toBe("denied");
    const foreignMarkup = pageHtml(foreignModel);
    expect(foreignMarkup).toContain('data-servicing-state="denied"');
    expect(foreignMarkup).toContain("SCOPE_DENIED");
    expect(foreignMarkup).not.toContain("data-payment=");
    expectClean(foreignMarkup);

    const claimed = rig("claims-restored");
    await claimed.controller.read();
    const claimedModel = modelOf(claimed);
    expect(claimedModel.state).toBe("refused");
    const claimedMarkup = pageHtml(claimedModel, "claims-restored");
    expect(claimedMarkup).toContain("No row from it is shown.");
    expect(claimedMarkup).not.toContain("data-payment=");
    expectClean(claimedMarkup);

    const notBound = new CreditServicingController(createNotBoundCreditServicing(), {
      actorRef: SERVICING_DESK_ACTOR,
    });
    await notBound.read();
    const notBoundModel = buildServicingModel({ controller: notBound, last: null });
    expect(notBoundModel.state).toBe("not-bound");
    const notBoundMarkup = pageHtml(notBoundModel, "clean", "integration-http");
    expect(notBoundMarkup).toContain('data-servicing-state="not-bound"');
    expect(notBoundMarkup).toContain(SERVICING_NOT_BOUND_REASON);
    expectClean(notBoundMarkup);
  });
});

describe("schedule, ledger cuts, and contradictions", () => {
  it("flags a schedule row built under an older revision, never as current", async () => {
    const r = rig("stale-schedule");
    await r.controller.read();
    const model = modelOf(r);
    const markup = pageHtml(model, "stale-schedule");
    expect(markup).toContain('data-stale-lane="schedule"');
    expect(markup).toContain('data-stale-lane-flag="true"');
    expect(markup).toContain("Flagged, never shown as current.");
    expect(markup).toContain("built under schedule revision");
    expectClean(markup);
  });

  it("flags a row on the wrong ledger's cut and merges nothing", async () => {
    const r = rig("mixed-cut");
    await r.controller.read();
    const model = modelOf(r);
    expect(model.cutState).toBe("mixed");
    const markup = pageHtml(model, "mixed-cut");
    expect(markup).toContain('data-cut-state="mixed"');
    expect(markup).toContain('data-contradiction="true"');
    expect(markup).toContain("WRONG_LEDGER_CUT");
    expect(markup).toContain("The ledgers are not merged");
    expectClean(markup);
  });

  it("shows an overdue schedule row and a delinquent case without merging the lanes", async () => {
    const r = rig("delinquent");
    await r.controller.read();
    const model = modelOf(r);
    const markup = pageHtml(model, "delinquent");
    expect(markup).toContain('data-installment-state="overdue"');
    expect(markup).toContain('data-case-status="delinquent"');
    expect(markup).toContain('data-reason-code="INSTALLMENT_OVERDUE"');
    expect(markup).toContain('data-remedy="propose-case-transition"');
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

describe("proposals, approvals, and the write fence", () => {
  it("records an allocation proposal as applied at the source, never as an allocation", async () => {
    const r = rig("unallocated");
    await r.controller.read();
    const model = modelOf(r);
    expect(model.proposeAllocationControl.enabled).toBe(true);
    const result = await r.controller.proposeAllocation("pmt-0003", "ins-0002");
    expect(result.kind).toBe("APPLIED");
    const after = modelOf(r);
    expect(after.last?.phase).toBe("applied");
    const markup = pageHtml(after, "unallocated");
    expect(markup).toContain('data-last-request="1"');
    expect(markup).toContain('data-phase="applied"');
    expect(markup).toContain("Applied at the synthetic source");
    expect(markup).toContain("A recorded proposal applies nothing; only an approval applies.");
    expect(markup).toContain('data-behind="true"');
    expectClean(markup);
  });

  it("lets a different actor approve a pending proposal and keeps the proposer out", async () => {
    const desk = rig("proposal-pending");
    await desk.controller.read();
    const deskModel = modelOf(desk);
    const proposal = deskModel.proposals.find((row) => row.proposalRef === "prp-0001");
    expect(proposal?.approve.enabled).toBe(false);
    expect(proposal?.approve.reason).toContain("no approve capability");
    const deskMarkup = pageHtml(deskModel, "proposal-pending");
    expect(deskMarkup).toContain('data-proposal-state="pending"');
    expectClean(deskMarkup);

    const approver = rig("proposal-pending", SERVICING_APPROVER_ACTOR);
    await approver.controller.read();
    const approverModel = modelOf(approver);
    expect(approverModel.proposals.find((row) => row.proposalRef === "prp-0001")?.approve.enabled).toBe(true);
    const result = await approver.controller.approveProposal("prp-0001");
    expect(result.kind).toBe("APPLIED");
    await approver.controller.read();
    const settled = modelOf(approver);
    expect(settled.proposals.find((row) => row.proposalRef === "prp-0001")?.state).toBe("applied");
    expect(settled.payments.find((row) => row.paymentRef === "pmt-0003")?.state).toBe("allocated");
  });

  it("refuses an actor's approval of its own proposal", async () => {
    const r = rig("self-approval", SERVICING_APPROVER_ACTOR);
    await r.controller.read();
    const result = await r.controller.approveProposal("prp-0001");
    expect(result.kind).toBe("REJECTED");
    const model = modelOf(r);
    expect(model.last?.phase).toBe("rejected");
    expect(model.last?.code).toBe("SELF_APPROVAL");
    const markup = pageHtml(model, "self-approval");
    expect(markup).toContain("SELF_APPROVAL");
    expectClean(markup);
  });

  it("shows an unknown result plainly and fences every later request for the session", async () => {
    const r = rig("act-lost");
    await r.controller.read();
    const result = await r.controller.proposeAdjustment("ins-0002", "note", "x");
    expect(result.kind).toBe("UNKNOWN");
    const fenced = modelOf(r);
    expect(fenced.last?.phase).toBe("unknown");
    expect(fenced.fenceLine).toContain("unknown outcome");
    expect(fenced.proposeAdjustmentControl.enabled).toBe(false);
    const markup = pageHtml(fenced, "act-lost");
    expect(markup).toContain('data-fence="true"');
    expect(markup).toContain("Fenced.");
    expect(markup).toContain('data-enabled="false"');
    // A read does not lift the fence: the request may have applied.
    await r.controller.read();
    const after = modelOf(r);
    expect(after.state).toBe("ready");
    expect(after.fenceLine).not.toBeNull();
    expect(after.proposeCaseControl.enabled).toBe(false);
    expectClean(markup);
  });

  it("treats an answer that claims a closure is debt extinction as untrusted and fences", async () => {
    const r = rig("approve-claims-closure", SERVICING_APPROVER_ACTOR);
    await r.controller.read();
    const result = await r.controller.approveProposal("prp-0001");
    expect(result.kind).toBe("UNKNOWN");
    const model = modelOf(r);
    expect(model.last?.phase).toBe("refused");
    expect(model.fenceLine).not.toBeNull();
    const markup = pageHtml(model, "approve-claims-closure");
    expect(markup).toContain('data-phase="refused"');
    expect(markup).toContain('data-fence="true"');
    expectClean(markup);
  });

  it("keeps every request off under integration-http, with the not-bound reason on the button", async () => {
    const controller = new CreditServicingController(createNotBoundCreditServicing(), {
      actorRef: SERVICING_DESK_ACTOR,
    });
    await controller.read();
    const model = buildServicingModel({ controller, last: null });
    for (const control of [
      model.proposeAllocationControl,
      model.proposeAdjustmentControl,
      model.proposeCaseControl,
      model.approveControl,
    ]) {
      expect(control.enabled).toBe(false);
      expect(control.reason).toBe(SERVICING_NOT_BOUND_REASON);
    }
    const markup = pageHtml(model, "clean", "integration-http");
    expect(markup).toContain('id="servicing-propose-adjustment"');
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
    expect(model.proposeAdjustmentControl.enabled).toBe(false);
    const markup = pageHtml(model);
    expect(markup).toContain('aria-describedby="servicing-propose-adjustment-reason"');
    expect(markup).toContain('id="servicing-propose-adjustment-reason"');
    expect(markup).toContain("Blocked.");
  });

  it("keeps the viewer actor to view alone, with the proposal and approval controls off", async () => {
    const r = rig("unallocated", SERVICING_VIEWER_ACTOR);
    await r.controller.read();
    const model = modelOf(r);
    expect(model.proposeAllocationControl.enabled).toBe(false);
    expect(model.proposeAllocationControl.reason).toContain("no propose capability");
    expect(model.approveControl.enabled).toBe(false);
    const markup = pageHtml(model, "unallocated");
    expect(markup).toContain('data-enabled="false"');
    expect(markup).toContain("holds read.");
    expectClean(markup);
  });
});

describe("registration", () => {
  it("is one stub-only organizer surface with no sender, no action, and no desk method", () => {
    const surface = WORKSPACE_SURFACES.find((item) => item.id === "credit-servicing");
    expect(surface).toMatchObject({
      role: "operator",
      route: "/credit/servicing",
      binding: "stub-only",
      sender: null,
      taskId: "c-credit-servicing-journey-stub",
      implemented: true,
      pageControl: true,
    });
    expect(surface?.actions).toEqual([]);
    expect(surface?.deskMethods).toEqual([]);
    expect(surface?.provenanceNote).toContain("integration-http");
    expect(surface?.provenanceNote).not.toMatch(/\bworks\b|live payment|funds moved|payment complete|admission complete|refund complete/i);
  });

  it("is recorded in the handoff packet as a pending producer that is not connected", () => {
    const row = PENDING_PRODUCERS.find((item) => item.id === "c-credit-servicing-journey");
    expect(row).toMatchObject({
      catalogue: "pending",
      connected: false,
      implementedHere: false,
      waitingSurface: "credit-servicing",
    });
    const pending = JSON.parse(readFileSync(path.join(repoRoot, "docs/aiops/PENDING_NODES.json"), "utf8")) as {
      nodes: { id: string }[];
    };
    const ids = new Set(pending.nodes.map((node) => node.id));
    expect(ids.has("c-credit-servicing-journey")).toBe(true);
  });

  it("has eight synthetic fixture rows that own no pass and cover stale, partial, post-closure, scope, claim, and lost outcomes", () => {
    const rows = fixturesForScreen("credit-servicing");
    expect(rows.map((row) => row.id)).toEqual([
      "credit-servicing.stale-read",
      "credit-servicing.stale-schedule",
      "credit-servicing.partial-repayment",
      "credit-servicing.post-charge-off-payment",
      "credit-servicing.scope-denied",
      "credit-servicing.claim-refused",
      "credit-servicing.write-lost",
      "credit-servicing.read-lost",
    ]);
    for (const row of rows) {
      expect(row.ownsPass).toBe(false);
      expect(row.source).toBe("synthetic-fixture");
      expect(row.klass).not.toBe("SUCCESS");
      expect(row.substituteStub).toBe(false);
    }
    expect(CONTRACT_FIXTURES.filter((row) => row.screenId === "credit-servicing" && row.klass === "NOT_BOUND")).toEqual([]);
  });

  it("keeps the new screen free of sends, clocks, timers, money math, and the write vocabulary", () => {
    const files = [
      "src/credit-servicing.ts",
      "src/pages/CreditServicing.tsx",
      "src/pages/CreditServicingPanels.tsx",
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
    expect(css).toContain(".servicing");
    expect(css).not.toContain("@keyframes");
    expect(css).not.toMatch(/animation\s*:/);
  });

  it("keeps the scenario set to the adapter list and the page free of a positive claim", () => {
    expect(SERVICING_SCENARIOS.length).toBeGreaterThan(0);
    const r = rig();
    const markup = pageHtml(modelOf(r));
    expectClean(markup);
  });

  it("reaches the route through the app shell and the navigation", () => {
    const app = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/credit/servicing"]}>
        <App />
      </MemoryRouter>,
    );
    expect(app).toContain("Credit servicing (synthetic)");
    expect(app).toContain('href="/credit/servicing"');
    expect(app).toContain("SYNTHETIC");
    expect(app).toContain('data-adapter-environment="stub"');
  });

  it("names the surface in the docs and the README", () => {
    const doc = readFileSync(path.join(repoRoot, "docs/c-credit-servicing-journey-stub-apps-bind.md"), "utf8");
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    expect(doc).toContain(WORKSPACE_RULING);
    expect(doc).toContain("credit-servicing");
    expect(doc).toContain("Browser run");
    expect(readme).toContain("docs/c-credit-servicing-journey-stub-apps-bind.md");
    expect(readme).toContain("/credit/servicing");
  });
});
