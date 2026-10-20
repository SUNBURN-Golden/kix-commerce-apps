import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  DISCOVERY_READ_TUPLE_LITERALS,
  FINANCE_APPROVER_ACTOR,
  FINANCE_CATEGORIES,
  FINANCE_FOREIGN_REF,
  FINANCE_NOT_BOUND_REASON,
  FINANCE_OWN_REF,
  FINANCE_REVIEWER_ACTOR,
  FINANCE_SCENARIOS,
  FINANCE_VIEWER_ACTOR,
  FinanceOperationsController,
  createNotBoundFinanceOperations,
  createStubFinanceOperations,
  type FinanceOperationsPort,
  type FinanceReadOutcome,
  type FinanceScenario,
  type StubFinanceOperations,
} from "@kix/protocol-adapter";
import { CONTRACT_FIXTURES, fixturesForScreen } from "../../../packages/protocol-adapter/src/contract-fixtures";
import { App } from "../src/App";
import { buildFinanceModel, type FinanceActions, type FinanceLastAction, type FinanceModel } from "../src/finance-operations";
import { PENDING_PRODUCERS } from "../src/handoff/packet";
import {
  AuthoritySection,
  CutsSection,
  ExportSection,
  FinanceBanner,
  FinanceControls,
  FinanceSessionSection,
  FinanceStatus,
  FiguresSection,
  QueueSection,
  RequestsSection,
} from "../src/pages/FinancePanels";
import { WORKSPACE_RULING, WORKSPACE_SURFACES } from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

const BANNED = /[$₩]|KRW|USD/i;

/** Wording that would turn a review into a decision, or an observation into money. None may appear on screen. */
const POSITIVE_CLAIMS = [
  "Reconciled",
  "Ledger corrected",
  "Ledger matched",
  "Correction applied",
  "Correction approved and applied",
  "Posted to the accounting",
  "Payout executed",
  "Settled",
  "Funds available",
  "Available funds",
  "Lendable capacity",
  "Payment complete",
  "Paid out",
  "Refund complete",
  "Refund paid",
  "Confirmed balance",
  "Total owed",
  "still open",
  "in stock",
];

const NO_ACTIONS: FinanceActions = {
  refresh() {},
  loadExport() {},
  proposeCorrection() {},
  approveProposal() {},
  switchScope() {},
  switchActor() {},
  revokeGrant() {},
  advanceCut() {},
  postSourceCorrection() {},
  setScenario() {},
  newSession() {},
};

function html(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element);
}

function pageHtml(
  model: FinanceModel,
  scenario: FinanceScenario = "clean",
  environment: "stub" | "integration-http" = "stub",
  actorRef: string = FINANCE_REVIEWER_ACTOR,
): string {
  return html(
    <MemoryRouter>
      <FinanceBanner environment={environment} scenario={scenario} model={model} />
      <FinanceControls scenario={scenario} actorRef={actorRef} model={model} actions={NO_ACTIONS} />
      <FinanceStatus model={model} />
      <AuthoritySection model={model} />
      <CutsSection model={model} />
      <QueueSection model={model} actions={NO_ACTIONS} />
      <FiguresSection model={model} />
      <ExportSection model={model} />
      <RequestsSection model={model} />
      <FinanceSessionSection session={model.session} />
    </MemoryRouter>,
  );
}

function expectClean(markup: string): void {
  expect(markup).not.toMatch(BANNED);
  for (const claim of POSITIVE_CLAIMS) {
    expect(markup, claim).not.toContain(claim);
  }
}

interface Rig {
  port: StubFinanceOperations;
  controller: FinanceOperationsController;
  last: FinanceLastAction | null;
}

function rig(scenario: FinanceScenario = "clean", actorRef: string = FINANCE_REVIEWER_ACTOR, bookRef?: string): Rig {
  const port = createStubFinanceOperations({ scenario });
  return { port, controller: new FinanceOperationsController(port, { actorRef, bookRef }), last: null };
}

function modelOf(r: Rig): FinanceModel {
  return buildFinanceModel({ controller: r.controller, last: r.last });
}

/** The visible label of every button in the markup. */
function buttonLabels(markup: string): string[] {
  return [...markup.matchAll(/<button[^>]*>([^<]*)<\/button\b[^>]*>/g)].map((match) => match[1] ?? "");
}

/** Every id a describedby points at must exist in the markup. */
function expectDescribedByTargets(markup: string): void {
  for (const match of markup.matchAll(/aria-describedby="([^"]+)"/g)) {
    for (const id of (match[1] ?? "").split(" ")) {
      expect(markup, `describedby target ${id}`).toContain(`id="${id}"`);
    }
  }
}

describe("finance screen states", () => {
  it("shows loading before the first read, with a word for it and no case", () => {
    const model = modelOf(rig());
    expect(model.state).toBe("loading");
    const markup = pageHtml(model);
    expect(markup).toContain('data-finance-state="loading"');
    expect(markup).toContain('data-status-mark="loading"');
    expect(markup).toContain("Reading the synthetic finance source. Nothing is shown yet.");
    expect(markup).not.toContain("data-case=");
    expect(markup).toContain("No case in this read.");
    expect(markup).toContain("No queue without a ready read.");
    expectClean(markup);
  });

  it("shows the queue after a read: one card per case, each synthetic and on its cut", async () => {
    const r = rig();
    await r.controller.read();
    const model = modelOf(r);
    expect(model.state).toBe("ready");
    expect(model.cases.map((row) => row.caseRef)).toEqual(["rcs-0001", "rcs-0002", "rcs-0003", "rcs-0004", "rcs-0005", "rcs-0006", "rcs-0007"]);
    const markup = pageHtml(model);
    expect(markup).toContain('data-finance-state="ready"');
    expect(markup).toContain('data-source="synthetic-finance"');
    expect(markup).toContain("SYNTHETIC");
    expect(markup).toContain('data-case-count="7"');
    expect(new Set(model.cases.map((row) => row.category))).toEqual(new Set(FINANCE_CATEGORIES));
    for (const word of ["Unmatched", "Duplicate observation", "Late fact", "Several payees", "Residual allocation", "Balance mismatch"]) {
      expect(markup, word).toContain(word);
    }
    expect(markup).toContain("Queue as the source states it: 6 open, 1 unknown, 0 resolved by the source.");
    expect(markup).toContain('data-cut-alignment="aligned"');
    expect(markup).toContain('data-totals-state="current"');
    expectClean(markup);
  });

  it("separates empty, stale, unavailable, changed tuple, and not-bound, and none is a ready queue", async () => {
    const empty = rig("empty");
    await empty.controller.read();
    expect(modelOf(empty)).toMatchObject({ state: "empty", actionLabel: "Read again" });
    expect(pageHtml(modelOf(empty), "empty")).toContain("No reconciliation cases for this book in this read.");

    const stale = rig("stale");
    await stale.controller.read();
    const staleMarkup = pageHtml(modelOf(stale), "stale");
    expect(staleMarkup).toContain('data-finance-state="stale"');
    expect(staleMarkup).toContain("Stale finance read.");
    expect(staleMarkup).not.toContain("data-case=");
    expectClean(staleMarkup);

    const lost = rig("read-lost");
    await lost.controller.read();
    const lostMarkup = pageHtml(modelOf(lost), "read-lost");
    expect(lostMarkup).toContain("The source did not answer. This is not an empty queue.");
    expect(lostMarkup).not.toContain("data-case=");
    expectClean(lostMarkup);

    const changed = new FinanceOperationsController(
      createStubFinanceOperations({ expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, domain: "kix:other" } }),
      { actorRef: FINANCE_REVIEWER_ACTOR },
    );
    await changed.read();
    const changedModel = buildFinanceModel({ controller: changed, last: null });
    expect(changedModel.state).toBe("tuple-changed");
    expect(pageHtml(changedModel)).toContain("Start a new synthetic session");

    const notBound = new FinanceOperationsController(createNotBoundFinanceOperations(), { actorRef: FINANCE_REVIEWER_ACTOR });
    await notBound.read();
    const notBoundModel = buildFinanceModel({ controller: notBound, last: null });
    expect(notBoundModel.state).toBe("not-bound");
    const notBoundMarkup = pageHtml(notBoundModel, "clean", "integration-http");
    expect(notBoundMarkup).toContain('data-finance-state="not-bound"');
    expect(notBoundMarkup).toContain(FINANCE_NOT_BOUND_REASON);
    expect(notBoundMarkup).not.toContain("data-case=");
    expectClean(notBoundMarkup);
  });

  it("shows a scope denial for a book the grant does not cover, and a withdrawn grant", async () => {
    const foreign = rig("clean", FINANCE_REVIEWER_ACTOR, FINANCE_FOREIGN_REF);
    await foreign.controller.read();
    const foreignModel = modelOf(foreign);
    expect(foreignModel.state).toBe("denied");
    const markup = pageHtml(foreignModel);
    expect(markup).toContain('data-finance-state="denied"');
    expect(markup).toContain("SCOPE_DENIED");
    expect(markup).not.toContain("data-case=");
    expectClean(markup);

    const revoked = rig("denied");
    await revoked.controller.read();
    expect(modelOf(revoked).state).toBe("denied");
    expect(pageHtml(modelOf(revoked), "denied")).toContain("GRANT_REVOKED");
  });

  it("refuses a payload that claims a confirmation forced a match or leaks another book, showing no case", async () => {
    const forced = rig("claims-forced");
    await forced.controller.read();
    const forcedModel = modelOf(forced);
    expect(forcedModel.state).toBe("refused");
    const forcedMarkup = pageHtml(forcedModel, "claims-forced");
    expect(forcedMarkup).toContain("(CLAIM)");
    expect(forcedMarkup).toContain("confirmationForcesMatch");
    expect(forcedMarkup).not.toContain("data-case=");
    expectClean(forcedMarkup);

    const leaked = rig("scope-leak");
    await leaked.controller.read();
    const leakedModel = modelOf(leaked);
    expect(leakedModel.state).toBe("refused");
    expect(leakedModel.scopeLine).toContain(FINANCE_OWN_REF);
    expect(pageHtml(leakedModel, "scope-leak")).not.toContain("data-case=");
  });
});

describe("the exception queue explains each kind of mismatch from the source's own rows", () => {
  it("links every case to its original trade and to the sibling sources, without a deep link it cannot know", async () => {
    const r = rig();
    await r.controller.read();
    const model = modelOf(r);
    for (const row of model.cases) {
      expect(row.tradeLinked, row.caseRef).toBe(true);
      expect(row.tradeLine).toContain(`Original trade ${row.tradeRef}: listing`);
      expect(row.merchantLineLine, row.caseRef).toMatch(/^Merchant money line obl-\d{4}/);
    }
    const markup = pageHtml(model);
    expect(markup).toContain('data-original-trade="linked"');
    expect(markup).toContain('href="/merchant"');
    expect(markup).toContain("Open the merchant workroom");
    expect(markup).toContain('data-link="merchant-line"');
    // Only the residual case concerns a servicing payment.
    expect(markup).toContain('data-link="servicing-payment"');
    expect(markup).toContain('href="/credit/servicing"');
    expect(markup).toContain("Credit servicing payment pmt-0001.");
    expect(markup.split('data-link="servicing-payment"').length - 1).toBe(1);
    expect(markup).toContain("Payment unknown");
    expect(markup).toContain("Right moved");
    expect(markup).toContain("Payment observed");
  });

  it("explains an unmatched line, including a refund burden that is not a payment observation", async () => {
    const r = rig();
    await r.controller.read();
    const model = modelOf(r);
    const held = model.cases.find((row) => row.caseRef === "rcs-0001");
    expect(held?.explanationLines[0]).toContain("expected 1100 mock-unit (a held line) and found no matching observation on cut cut-0002");
    expect(held?.explanationLines[0]).toContain("Whether anything was paid is not known here.");
    const refund = model.cases.find((row) => row.caseRef === "rcs-0007");
    expect(refund?.explanationLines.join(" ")).toContain("A refund is not a payment observation, and no refund command is composed here.");
    expect(pageHtml(model)).toContain("Reason REFUND_OBSERVATION_MISSING as the source names it.");
  });

  it("explains a duplicate observation without removing either observation", async () => {
    const r = rig();
    await r.controller.read();
    const model = modelOf(r);
    const duplicate = model.cases.find((row) => row.caseRef === "rcs-0002");
    expect(duplicate?.explanationLines[0]).toContain("observed the same payment 2 times (fct-0002, fct-0003)");
    expect(duplicate?.explanationLines[0]).toContain("removes no observation and recomputes nothing");
    expect(duplicate?.facts.map((fact) => fact.kindWord)).toEqual(["Payment observed", "Same payment observed again"]);
    expect(duplicate).toMatchObject({ expectedLine: "Expected 1200 mock-unit", observedLine: "Observed 2400 mock-unit", differenceLine: "Difference 1200 mock-unit" });
  });

  it("flags a late fact as its own fact on the cut it missed, with an unknown case and no difference", async () => {
    const r = rig();
    await r.controller.read();
    const model = modelOf(r);
    const late = model.cases.find((row) => row.caseRef === "rcs-0003");
    expect(late).toMatchObject({ state: "unknown", differenceLine: "Difference UNDETERMINED", observedLine: "Observed UNDETERMINED" });
    expect(late?.explanationLines[0]).toContain("reached the source after cut cut-0001 was taken");
    expect(late?.explanationLines[0]).toContain("is not folded into that cut");
    const markup = pageHtml(model);
    expect(markup).toContain('data-arrival="after-cut"');
    expect(markup).toContain("After the cut");
    expect(markup).toContain("It is its own fact and is not folded into the cut it missed.");
    expect(markup).toContain("Unknown");
  });

  it("lists every payee share and the unapplied remainder as the source allocated them", async () => {
    const r = rig();
    await r.controller.read();
    const model = modelOf(r);
    const multi = model.cases.find((row) => row.caseRef === "rcs-0004");
    expect(multi?.explanationLines[0]).toContain("split this payout across 3 payees");
    expect(multi?.explanationLines[0]).toContain("does not check what the shares add up to");
    expect(multi?.allocations.map((item) => [item.roleWord, item.amountLine])).toEqual([
      ["Seller", "700 mock-unit"],
      ["Venue", "300 mock-unit"],
      ["Platform", "100 mock-unit"],
    ]);
    const residual = model.cases.find((row) => row.caseRef === "rcs-0005");
    expect(residual?.explanationLines[0]).toContain("An unapplied remainder applies itself to nothing");
    expect(residual?.allocations.filter((item) => item.remainder).map((item) => item.amountLine)).toEqual(["100 mock-unit"]);
    const markup = pageHtml(model);
    expect(markup).toContain('data-remainder="true"');
    expect(markup).toContain("Unapplied remainder");
    expect(markup).toContain("Lender");
    expect(markup).toContain("No payee");
  });

  it("names a dangling trade link without attaching it elsewhere, and offers only a request to look again", async () => {
    const r = rig("dangling-link");
    await r.controller.read();
    const model = modelOf(r);
    const dangling = model.cases.find((row) => row.caseRef === "rcs-0007");
    expect(dangling?.tradeLinked).toBe(false);
    expect(dangling?.caseBlock).toContain("does not list the original trade");
    expect(dangling?.corrections.map((item) => [item.correction, item.control.enabled])).toEqual([
      ["link-observation", false],
      ["request-source-review", true],
    ]);
    const markup = pageHtml(model, "dangling-link");
    expect(markup).toContain('data-original-trade="unlinked"');
    expect(markup).toContain("Original trade trd-0099 is not listed in this read. It is not attached elsewhere.");
    expect(markup).toContain('data-unlinked="true"');
    expectDescribedByTargets(markup);
    expectClean(markup);
  });
});

describe("totals, balances, and sources at different positions", () => {
  it("flags a stale total and a count mismatch without recomputing the figure", async () => {
    const stale = rig("stale-totals");
    await stale.controller.read();
    const staleMarkup = pageHtml(modelOf(stale), "stale-totals");
    expect(staleMarkup).toContain('data-totals-state="stale"');
    expect(staleMarkup).toContain("STALE_GENERATION");
    expect(staleMarkup).toContain("not recomputed");
    expect(staleMarkup).toContain("2000 mock-unit");
    expectClean(staleMarkup);

    const mismatch = rig("totals-mismatch");
    await mismatch.controller.read();
    const mismatchMarkup = pageHtml(modelOf(mismatch), "totals-mismatch");
    expect(mismatchMarkup).toContain('data-totals-state="mismatch"');
    expect(mismatchMarkup).toContain("COUNT_DIFFERS");
    expect(mismatchMarkup).toContain("counts 3 UNMATCHED cases on cut cut-0001, and the read lists 2");
    expectClean(mismatchMarkup);
  });

  it("prints a total the source did not state as UNDETERMINED", async () => {
    const r = rig();
    await r.controller.read();
    const model = modelOf(r);
    expect(model.totals.find((row) => row.category === "MULTI_PAYEE")?.amountLine).toBe("UNDETERMINED");
    expect(model.totals.find((row) => row.category === "UNMATCHED")?.amountLine).toBe("2000 mock-unit");
    expect(pageHtml(model)).toContain("UNDETERMINED");
  });

  it("flags a balance whose verdict its own difference text contradicts, and does not show it as reconciled", async () => {
    const r = rig("balance-mismatch");
    await r.controller.read();
    const model = modelOf(r);
    const balance = model.balances.find((row) => row.balanceRef === "bal-0003");
    expect(balance?.verdictWord).toContain("and its own difference text contradicts it");
    expect(balance?.flags).toEqual([expect.objectContaining({ kind: "contradiction", text: expect.stringContaining("MATCHED_WITH_DIFFERENCE") })]);
    const markup = pageHtml(model, "balance-mismatch");
    expect(markup).toContain('data-contradiction="true"');
    expect(markup).toContain("is not shown as reconciled");
    expectClean(markup);
  });

  it("flags the cases whose sides sit on different cuts instead of calling them matched or mismatched", async () => {
    const r = rig("source-cut-skew");
    await r.controller.read();
    const model = modelOf(r);
    expect(model.cutAlignment).toBe("skewed");
    const skewed = model.cases.filter((row) => row.skewLine !== null).map((row) => row.caseRef);
    expect(skewed).toEqual(["rcs-0001", "rcs-0002", "rcs-0003", "rcs-0007"]);
    const markup = pageHtml(model, "source-cut-skew");
    expect(markup).toContain('data-cut-alignment="skewed"');
    expect(markup).toContain('data-timing-uncertain="true"');
    expect(markup).toContain("TIMING_UNCERTAIN");
    expect(markup).toContain("so this page does not call this case matched or mismatched.");
    expect(markup).toContain("The source says mismatch, and its two sides sit on cuts at different positions.");
    // The balance across the skewed cuts carries a timing flag, which is not a contradiction.
    expect(markup).toContain("so this page does not call this balance matched or mismatched.");
    expect(model.balances.find((row) => row.balanceRef === "bal-0001")?.flags.map((flag) => flag.kind)).toEqual(["timing-uncertain"]);
    // Only a request for the source to look again is offered on a skewed case.
    const first = model.cases.find((row) => row.caseRef === "rcs-0001");
    expect(first?.corrections.map((item) => [item.correction, item.control.enabled])).toEqual([
      ["link-observation", false],
      ["request-source-review", true],
    ]);
    expect(first?.caseBlock).toContain("not a mismatch to correct yet");
    expect(first?.explanationLines[0]).toContain("may be timing and not an error");
    expect(first?.verdictWord).toBe("The source says mismatch, and its two sides sit on cuts at different positions");
    const intact = model.cases.find((row) => row.caseRef === "rcs-0004");
    expect(intact?.skewLine).toBeNull();
    expect(intact?.corrections.every((item) => item.control.enabled)).toBe(true);
    expectDescribedByTargets(markup);
    expectClean(markup);
  });

  it("consumes the source's figures verbatim: a total, a difference, a share, and a remainder the page would never compute", async () => {
    const base = createStubFinanceOperations();
    const port: FinanceOperationsPort = {
      environment: base.environment,
      source: base.source,
      scenario: base.scenario,
      read: async (request): Promise<FinanceReadOutcome> => {
        const outcome = await base.read(request);
        if (outcome.kind !== "ready") {
          return outcome;
        }
        const snapshot = JSON.parse(JSON.stringify(outcome.snapshot)) as typeof outcome.snapshot;
        snapshot.totals = snapshot.totals.map((row) => (row.category === "UNMATCHED" ? { ...row, amount: "424242" } : row));
        snapshot.cases = snapshot.cases.map((row) => (row.caseRef === "rcs-0002" ? { ...row, differenceAmount: "7", observedAmount: "13" } : row));
        snapshot.allocations = snapshot.allocations.map((row) => (row.allocationRef === "fal-0006" ? { ...row, amount: "55" } : row));
        return { kind: "ready", snapshot };
      },
      readExport: (request) => base.readExport(request),
      act: (request) => base.act(request),
      synthetic: (control) => base.synthetic(control),
    };
    const controller = new FinanceOperationsController(port);
    await controller.read();
    const markup = pageHtml(buildFinanceModel({ controller, last: null }));
    expect(markup).toContain("424242 mock-unit");
    expect(markup).not.toContain("2000 mock-unit");
    expect(markup).toContain("Difference 7 mock-unit");
    expect(markup).toContain("Observed 13 mock-unit");
    expect(markup).toContain("55 mock-unit");
    const model = buildFinanceModel({ controller, last: null });
    const remainder = model.cases.find((row) => row.caseRef === "rcs-0005")?.allocations.find((item) => item.remainder);
    expect(remainder?.amountLine).toBe("55 mock-unit");
  });
});

describe("a correction proposal is not a change of economic state", () => {
  it("lists who may do what, with the change of economic state held by nobody", async () => {
    const r = rig();
    await r.controller.read();
    const model = modelOf(r);
    expect(model.authority.map((row) => row.authority)).toEqual([
      "read",
      "export",
      "propose-correction",
      "approve-proposal",
      "change-economic-state",
    ]);
    const change = model.authority.find((row) => row.authority === "change-economic-state");
    expect(change).toMatchObject({ heldByLine: "Held by no actor on this desk.", changesEconomicState: true, heldByActor: false });
    const markup = pageHtml(model);
    expect(markup).toContain('data-authority="change-economic-state"');
    expect(markup).toContain('data-changes-economic-state="true"');
    expect(markup).toContain("Yes, and nobody here holds it.");
    expect(markup.split('data-changes-economic-state="true"').length - 1).toBe(1);
    expect(markup).toContain('data-authority="propose-correction" data-changes-economic-state="false" data-held-by-actor="true"');
    expect(markup).toContain('data-authority="approve-proposal" data-changes-economic-state="false" data-held-by-actor="false"');
    expect(markup).toContain("Records an approval at the source. An approval changes no economic state either.");
    expect(markup).toContain("No actor on this desk holds it.");
  });

  it("has no control that confirms, forces a match, applies a correction, or changes economic state", async () => {
    let checked = 0;
    for (const actor of [FINANCE_REVIEWER_ACTOR, FINANCE_APPROVER_ACTOR, FINANCE_VIEWER_ACTOR]) {
      for (const scenario of FINANCE_SCENARIOS) {
        const r = rig(scenario, actor);
        try {
          await r.controller.read();
          await r.controller.loadExport();
        } catch {
          // A scenario may lose its answer. The page still renders.
        }
        const markup = pageHtml(modelOf(r), scenario, "stub", actor);
        for (const label of buttonLabels(markup)) {
          checked += 1;
          // A control that moves the synthetic source says it is a simulation. Every other control is a read,
          // an export, a proposal, a record of an approval, or a context change, and none is named for a decision.
          if (label.startsWith("Simulate:")) {
            continue;
          }
          expect(label, `${actor} ${scenario}`).not.toMatch(
            /confirm|force|apply|reconcile|make .*match|close the case|resolve|correct(?!ion proposal)|\bpost\b|\bpay\b|\bpayout\b|settle|adjust|write off/i,
          );
        }
        expect(markup).not.toMatch(/data-action="(confirm|force|apply)/i);
      }
    }
    expect(checked).toBeGreaterThan(1000);
    const r = rig();
    await r.controller.read();
    const labels = buttonLabels(pageHtml(modelOf(r)));
    expect(labels).toEqual(
      expect.arrayContaining([
        "Read again",
        "Load the export",
        "Switch book scope",
        "Simulate: withdraw the grant",
        "Simulate: the source moves to its next cut",
        "Simulate: the source posts a later cut",
        "Start a new synthetic session",
        "Start a session with this scenario",
        "Switch to this actor",
      ]),
    );
    // Only these three buttons move the synthetic source, and each says it is a simulation.
    expect(labels.filter((label) => label.startsWith("Simulate:"))).toHaveLength(3);
    // Seven cases offer thirteen corrections: the balance case offers only a request to look again.
    expect(labels.filter((label) => label.startsWith("Propose:")).length).toBe(13);
    expect(pageHtml(modelOf(r))).toContain("There is no confirm, force-match, or apply control on this page.");
  });

  it("records a proposal, and the page says nothing was applied and the cases are still the last read's", async () => {
    const r = rig();
    await r.controller.read();
    const before = modelOf(r);
    const result = await r.controller.proposeCorrection("rcs-0001", "link-observation", "Link it to the later payment.");
    expect(result.kind).toBe("APPLIED");
    const model = modelOf(r);
    expect(model.request).toMatchObject({ seq: 1, kindWord: "Correction proposal", phase: "applied", phaseWord: "Recorded at the synthetic source" });
    expect(model.request?.receiptLines[1]).toBe("economicStateChanged false · confirmationForcesMatch false");
    expect(model.request?.receiptLines[2]).toContain("Recorded is not applied");
    expect(model.behindLine).toContain("Read again to see the proposals");
    expect(model.freshnessWord).toBe("The last read is behind a request that reached the source. Read again.");
    expect(model.proposeBlock).toContain("Read again before the next request");
    const markup = pageHtml(model);
    expect(markup).toContain('data-last-request="1"');
    expect(markup).toContain('data-behind="true"');
    expect(markup).not.toContain("data-proposal=");
    expect(model.cases.map((row) => row.differenceLine)).toEqual(before.cases.map((row) => row.differenceLine));
    await r.controller.read();
    const after = modelOf(r);
    expect(after.cases.find((row) => row.caseRef === "rcs-0001")?.proposals).toHaveLength(1);
    const afterMarkup = pageHtml(after);
    expect(afterMarkup).toContain('data-proposal="prp-0001"');
    expect(afterMarkup).toContain("Pending");
    expect(after.cases.map((row) => [row.caseRef, row.state, row.verdict, row.differenceLine])).toEqual(
      before.cases.map((row) => [row.caseRef, row.state, row.verdict, row.differenceLine]),
    );
    expectClean(afterMarkup);
  });

  it("records an approval by the approver, and the case stays open with the same figures", async () => {
    const reviewer = rig("clean");
    await reviewer.controller.read();
    await reviewer.controller.proposeCorrection("rcs-0001", "link-observation", "Link it.");
    const approver = new FinanceOperationsController(reviewer.port, { actorRef: FINANCE_APPROVER_ACTOR });
    await approver.read();
    const before = buildFinanceModel({ controller: approver, last: null });
    const pending = before.cases.find((row) => row.caseRef === "rcs-0001")?.proposals[0];
    expect(pending).toMatchObject({ proposalRef: "prp-0001", state: "pending", approve: { enabled: true, reason: null } });
    const result = await approver.approveProposal("prp-0001");
    expect(result.kind).toBe("APPLIED");
    await approver.read();
    const after = buildFinanceModel({ controller: approver, last: null });
    const row = after.cases.find((item) => item.caseRef === "rcs-0001");
    expect(row).toMatchObject({ state: "open", stateWord: "Open", differenceLine: "Difference 1100 mock-unit", observedLine: "Observed UNDETERMINED" });
    expect(row?.proposals[0]).toMatchObject({ state: "approval-recorded", stateWord: "Approval recorded, nothing changed" });
    const markup = pageHtml(after, "clean", "stub", FINANCE_APPROVER_ACTOR);
    expect(markup).toContain("Approval recorded, nothing changed");
    expect(markup).toContain('data-proposal-state="approval-recorded"');
    expect(markup).toContain("Queue as the source states it: 6 open, 1 unknown, 0 resolved by the source.");
    expectClean(markup);
  });

  it("shows the capability each actor lacks, once, and every control points at that reason", async () => {
    const viewer = rig("proposal-pending", FINANCE_VIEWER_ACTOR);
    await viewer.controller.read();
    const model = modelOf(viewer);
    expect(model.proposeBlock).toContain("holds no propose capability");
    expect(model.approveBlock).toContain("holds no approve capability");
    expect(model.exportControl).toMatchObject({ enabled: false });
    expect(model.exportControl.reason).toContain("holds no export capability");
    const markup = pageHtml(model, "proposal-pending", "stub", FINANCE_VIEWER_ACTOR);
    expect(markup).toContain('id="finance-propose-reason"');
    expect(markup).toContain('id="finance-approve-reason"');
    expect(markup.split("holds no propose capability").length - 1).toBe(1);
    expect(markup).toContain('aria-describedby="finance-propose-reason"');
    expect(markup).toContain('aria-describedby="finance-approve-reason"');
    expect(markup).toContain('id="finance-export"');
    expect(markup).toContain('aria-disabled="true"');
    expectDescribedByTargets(markup);
    expectClean(markup);

    const reviewer = rig("proposal-pending");
    await reviewer.controller.read();
    expect(modelOf(reviewer).approveBlock).toContain("holds no approve capability");
    expect(modelOf(reviewer).proposeBlock).toBeNull();
    const approver = rig("proposal-pending", FINANCE_APPROVER_ACTOR);
    await approver.controller.read();
    expect(modelOf(approver).proposeBlock).toContain("holds no propose capability");
    expect(modelOf(approver).approveBlock).toBeNull();
  });

  it("shows a rejection of an actor approving its own proposal, and a case the source resolved offers nothing", async () => {
    const own = rig("self-approval", FINANCE_APPROVER_ACTOR);
    await own.controller.read();
    const result = await own.controller.approveProposal("prp-0001");
    expect(result).toMatchObject({ kind: "REJECTED", record: { code: "SELF_APPROVAL" } });
    const markup = pageHtml(modelOf(own), "self-approval", "stub", FINANCE_APPROVER_ACTOR);
    expect(markup).toContain('data-phase="rejected"');
    expect(markup).toContain("Rejected by the source (SELF_APPROVAL).");
    expectClean(markup);

    const resolved = rig();
    await resolved.controller.read();
    resolved.port.synthetic("post-source-correction");
    await resolved.controller.read();
    const model = modelOf(resolved);
    const done = model.cases.find((row) => row.caseRef === "rcs-0001");
    expect(done).toMatchObject({ state: "resolved-by-source", stateWord: "Resolved by the source", corrections: [] });
    expect(done?.caseBlock).toBe("The source resolved this case. Nothing is left to correct.");
    expect(done?.differenceLine).toBe("Difference 0 mock-unit");
    // The explanation no longer says nothing was found: the source says it resolved the case, and no approval did.
    expect(done?.explanationLines).toHaveLength(1);
    expect(done?.explanationLines[0]).toContain("The source resolved this case in a later cut. It now states matched with difference 0 mock-unit.");
    expect(done?.explanationLines[0]).toContain("This page did not resolve it, and no approval did.");
    expect(done?.explanationLines[0]).not.toContain("found no matching observation");
    expect(model.totals.find((row) => row.category === "UNMATCHED")?.amountLine).toBe("UNDETERMINED");
    expectClean(pageHtml(model));
  });

  it("fences every later request after an answer that never arrived or arrived untrusted", async () => {
    const lost = rig("act-lost");
    await lost.controller.read();
    const result = await lost.controller.proposeCorrection("rcs-0001", "link-observation", "n");
    expect(result.kind).toBe("UNKNOWN");
    const model = modelOf(lost);
    expect(model.fenceLine).toContain("has an unknown outcome and may have been recorded");
    expect(model.request).toMatchObject({ phase: "unknown", phaseWord: "Outcome unknown. The request may have been recorded" });
    expect(model.proposeBlock).toContain("unknown outcome");
    const markup = pageHtml(model, "act-lost");
    expect(markup).toContain('data-fence="true"');
    expect(markup).toContain("Fenced.");
    await lost.controller.read();
    expect(modelOf(lost).fenceLine).not.toBeNull();
    expectClean(markup);

    const untrusted = rig("approve-claims-applied");
    await untrusted.controller.read();
    await untrusted.controller.proposeCorrection("rcs-0001", "link-observation", "n");
    const approver = new FinanceOperationsController(untrusted.port, { actorRef: FINANCE_APPROVER_ACTOR });
    await approver.read();
    const outcome = await approver.approveProposal("prp-0001");
    expect(outcome.kind).toBe("UNKNOWN");
    const refusedModel = buildFinanceModel({ controller: approver, last: null });
    expect(refusedModel.request).toMatchObject({ phase: "refused", code: "CLAIM" });
    expect(refusedModel.request?.phaseWord).toContain("not trusted");
    expect(refusedModel.fenceLine).not.toBeNull();
  });
});

describe("the accounting export", () => {
  it("stays blocked before a ready read and loads a current, synthetic export after one", async () => {
    const r = rig();
    const before = modelOf(r);
    expect(before.export.phase).toBe("none");
    expect(before.exportControl.enabled).toBe(false);
    expect(before.exportControl.reason).toContain("Read the queue first");

    await r.controller.read();
    expect(modelOf(r).exportControl.enabled).toBe(true);
    await r.controller.loadExport();
    const model = modelOf(r);
    expect(model.export.phase).toBe("loaded");
    expect(model.export.verdictWord).toBe("current");
    const markup = pageHtml(model);
    expect(markup).toContain('data-export-phase="loaded"');
    expect(markup).toContain('data-verdict="current"');
    expect(markup).toContain("Current export for the last read.");
    expect(markup).toContain("data-export-row=");
    expect(markup.split("data-export-row=").length - 1).toBe(13);
    expect(markup).toContain('id="finance-export"');
    expect(markup).toContain('data-enabled="true"');
    expect(markup).toContain('data-export-scope="synthetic"');
    expect(markup).toContain("SYNTHETIC export. provenance synthetic · realMoney false · postedToAccountingSystem false · bookOfRecord false · target none.");
    expect(markup).toContain("This file is not an accounting record.");
    expect(markup).toContain("Cut cut-0003 (settlement-ledger) at generation 3.");
    expect(markup).toContain("Payee share");
    expect(markup).toContain("Unapplied remainder");
    expectClean(markup);
  });

  it("withholds an export that is stale, partial, off-read, or taken while the sources are skewed, with every reason", async () => {
    for (const scenario of ["export-stale", "export-partial", "export-rows-differ", "source-cut-skew"] as const) {
      const r = rig(scenario);
      await r.controller.read();
      await r.controller.loadExport();
      const model = modelOf(r);
      expect(model.export.verdictWord, scenario).toBe("withheld");
      const markup = pageHtml(model, scenario);
      expect(markup, scenario).toContain('data-verdict="withheld"');
      expect(markup, scenario).toContain('data-verdict-reason="true"');
      expect(markup, scenario).toContain("Withheld.");
      expectClean(markup);
    }
    const skew = rig("source-cut-skew");
    await skew.controller.read();
    await skew.controller.loadExport();
    expect(pageHtml(modelOf(skew), "source-cut-skew")).toContain("SOURCES_SKEWED: the last read spans sources at different positions, so no single export is consistent.");
  });

  it("turns a loaded export withheld the moment the source moves on", async () => {
    const r = rig();
    await r.controller.read();
    await r.controller.loadExport();
    expect(modelOf(r).export.verdictWord).toBe("current");
    r.port.synthetic("advance-cut");
    await r.controller.read();
    const model = modelOf(r);
    expect(model.export.verdictWord).toBe("withheld");
    expect(pageHtml(model)).toContain("STALE_CUT: the export was taken before the cut set the read saw.");
  });

  it("keeps a denied export absent, and refuses an export that declares real money", async () => {
    const denied = rig("export-denied");
    await denied.controller.read();
    await denied.controller.loadExport();
    const deniedMarkup = pageHtml(modelOf(denied), "export-denied");
    expect(deniedMarkup).toContain('data-export-phase="denied"');
    expect(deniedMarkup).toContain("EXPORT_DENIED");
    expect(deniedMarkup).not.toContain("data-export-row=");

    const real = rig("export-claims-real");
    await real.controller.read();
    await real.controller.loadExport();
    const realMarkup = pageHtml(modelOf(real), "export-claims-real");
    expect(realMarkup).toContain('data-export-phase="refused"');
    expect(realMarkup).toContain("The export payload was refused (CLAIM).");
    expect(realMarkup).toContain("realMoney");
    expect(realMarkup).not.toContain("data-export-row=");
    expectClean(realMarkup);

    const viewer = rig("clean", FINANCE_VIEWER_ACTOR);
    await viewer.controller.read();
    expect(modelOf(viewer).exportControl.reason).toContain("holds no export capability");
  });

  it("marks the export not-bound under integration-http and never sends it", () => {
    const controller = new FinanceOperationsController(createNotBoundFinanceOperations(), { actorRef: FINANCE_REVIEWER_ACTOR });
    const model = buildFinanceModel({ controller, last: null });
    expect(model.exportControl).toEqual({ enabled: false, reason: FINANCE_NOT_BOUND_REASON });
    expect(model.proposeBlock).toBe(FINANCE_NOT_BOUND_REASON);
    expect(model.approveBlock).toBe(FINANCE_NOT_BOUND_REASON);
    const markup = pageHtml(model, "clean", "integration-http");
    expect(markup).toContain('id="finance-export"');
    expect(markup).toContain('data-enabled="false"');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('data-blocked-reason="true"');
  });
});

describe("controls and keyboard order", () => {
  it("labels every field, keeps an off control focusable, and puts each scrolling table in a focusable region", async () => {
    const r = rig("proposal-pending");
    await r.controller.read();
    const markup = pageHtml(modelOf(r), "proposal-pending");
    expect(markup).not.toContain("tabindex=\"-1\" role=\"button\"");
    for (const label of ["Synthetic scenario", "Desk actor", "Note for a proposal"]) {
      expect(markup, label).toContain(label);
    }
    expect(markup).toContain('for="finance-scenario"');
    expect(markup).toContain('for="finance-actor"');
    expect(markup).toContain('for="finance-note"');
    // A choice applies only when asked, so arrowing through a list resets nothing.
    expect(markup).toContain('id="finance-apply-scenario"');
    expect(markup).toContain('id="finance-apply-actor"');
    expect(markup).toContain("Choosing a scenario does nothing until you start a session with it");
    for (const field of markup.matchAll(/<(?:input|select)\b[^>]*\bid="([^"]+)"/g)) {
      expect(markup, `label for ${field[1]}`).toContain(`for="${field[1]}"`);
    }
    // Controls that are off use aria-disabled, so they stay in the tab order, and never a native disabled.
    expect(markup).not.toMatch(/<button[^>]* disabled/);
    // Wide tables scroll inside their own labelled, focusable region.
    expect(markup).toContain('role="region" aria-label="Authorities and who holds them" tabindex="0"');
    expect(markup).toContain('role="region" aria-label="Source totals per category and cut" tabindex="0"');
    expect(markup).toContain('role="region" aria-label="Balances between sources" tabindex="0"');
    expect(markup).toContain('<section id="finance-status" class="discovery-section" tabindex="-1"');
  });

  it("lists every synthetic scenario, each with a note", () => {
    const r = rig();
    const markup = pageHtml(modelOf(r));
    for (const scenario of FINANCE_SCENARIOS) {
      expect(markup, scenario).toContain(`<option value="${scenario}"`);
    }
    expect(markup).toContain('data-scenario-note="clean"');
  });

  it("keeps the page free of a positive claim in every scenario", async () => {
    for (const scenario of FINANCE_SCENARIOS) {
      const r = rig(scenario);
      try {
        await r.controller.read();
        await r.controller.loadExport();
      } catch {
        // A scenario may lose its answer. The model still renders.
      }
      expectClean(pageHtml(modelOf(r), scenario));
    }
  });
});

describe("what pulls focus to the status region", () => {
  it("changes the focus token for a refused, denied, stale, or lost read, and for a refused export", async () => {
    const token = async (scenario: FinanceScenario) => {
      const r = rig(scenario);
      await r.controller.read();
      return modelOf(r).focusToken;
    };
    expect(await token("clean")).toBeNull();
    expect(await token("empty")).toBeNull();
    for (const scenario of ["denied", "claims-forced", "scope-leak", "stale", "read-lost"] as const) {
      expect(await token(scenario), scenario).toMatch(/^read-/);
    }
    // Not-bound is the state of the page on load, so it takes no focus by itself.
    const notBound = new FinanceOperationsController(createNotBoundFinanceOperations());
    await notBound.read();
    expect(buildFinanceModel({ controller: notBound, last: null }).focusToken).toBeNull();
    // A second refusal is a new token, so focus moves again.
    const again = rig("denied");
    await again.controller.read();
    const first = modelOf(again).focusToken;
    await again.controller.read();
    expect(modelOf(again).focusToken).not.toBe(first);
    const exportRefused = rig("export-claims-real");
    await exportRefused.controller.read();
    await exportRefused.controller.loadExport();
    expect(modelOf(exportRefused).focusToken).toMatch(/^export-refused-/);
    const note = buildFinanceModel({ controller: rig().controller, last: { seq: 4, text: "x", attention: true } });
    expect(note.focusToken).toBe("note-4");
    expect(buildFinanceModel({ controller: rig().controller, last: { seq: 5, text: "x", attention: false } }).focusToken).toBeNull();
  });

  it("keeps heading levels in order inside the queue", async () => {
    const r = rig("proposal-pending");
    await r.controller.read();
    const markup = pageHtml(modelOf(r), "proposal-pending");
    expect(markup).not.toContain("<h6");
    expect(markup).toContain("<h4>rcs-0001</h4>");
    expect(markup).toContain("<h5>Facts</h5>");
    expect(markup).toContain("<h5>Correction proposals</h5>");
    expect(markup).not.toContain("<h5>rcs-");
    expect(markup).toContain('data-cut-source="order-ledger"');
  });
});

describe("registration", () => {
  it("is one stub-only operator surface with no sender, no action, and no desk method", () => {
    const surface = WORKSPACE_SURFACES.find((item) => item.id === "finance-operations");
    expect(surface).toMatchObject({
      role: "operator",
      route: "/finance",
      binding: "stub-only",
      sender: null,
      taskId: "c-finance-operations-stub",
      implemented: true,
      pageControl: true,
    });
    expect(surface?.actions).toEqual([]);
    expect(surface?.deskMethods).toEqual([]);
    expect(surface?.provenanceNote).toContain("integration-http");
    expect(surface?.provenanceNote).toContain("changes no economic state");
    expect(surface?.provenanceNote).not.toMatch(/\bworks\b|live payment|funds moved|disbursed|payment complete|admission complete|refund complete/i);
  });

  it("is recorded in the handoff packet as a pending producer that is not connected", () => {
    const row = PENDING_PRODUCERS.find((item) => item.id === "c-finance-operations");
    expect(row).toMatchObject({ catalogue: "pending", connected: false, implementedHere: false, waitingSurface: "finance-operations" });
    const pending = JSON.parse(readFileSync(path.join(repoRoot, "docs/aiops/PENDING_NODES.json"), "utf8")) as { nodes: { id: string }[] };
    expect(pending.nodes.some((node) => node.id === "c-finance-operations")).toBe(true);
    const program = JSON.parse(readFileSync(path.join(repoRoot, ".aiops/program.json"), "utf8")) as { nodes: { id: string }[] };
    expect(program.nodes.some((node) => node.id === "c-finance-operations-stub")).toBe(true);
  });

  it("has eleven synthetic fixture rows that own no pass and cover balance, source cut, and permission cases", () => {
    const rows = fixturesForScreen("finance-operations");
    expect(rows.map((row) => row.id)).toEqual([
      "finance-operations.stale-read",
      "finance-operations.stale-totals",
      "finance-operations.balance-mismatch",
      "finance-operations.source-cut-skew",
      "finance-operations.scope-denied",
      "finance-operations.export-denied",
      "finance-operations.self-approval",
      "finance-operations.claim-refused",
      "finance-operations.export-withheld",
      "finance-operations.write-lost",
      "finance-operations.read-lost",
    ]);
    expect(new Set(rows.map((row) => row.klass))).toEqual(new Set(["REJECT", "UNKNOWN", "STALE"]));
    for (const row of rows) {
      expect(row.ownsPass).toBe(false);
      expect(row.source).toBe("synthetic-fixture");
      expect(row.klass).not.toBe("SUCCESS");
      expect(row.substituteStub).toBe(false);
      expect(row.computesFinance).toBe(false);
    }
    expect(rows.filter((row) => row.klass === "REJECT").map((row) => row.code)).toEqual(["SCOPE_DENIED", "EXPORT_DENIED", "SELF_APPROVAL", "CLAIM", null]);
    expect(CONTRACT_FIXTURES.filter((row) => row.screenId === "finance-operations" && row.klass === "NOT_BOUND")).toEqual([]);
  });

  it("keeps the new screen free of sends, clocks, timers, money math, and the write vocabulary", () => {
    const files = ["src/finance-operations.ts", "src/pages/Finance.tsx", "src/pages/FinancePanels.tsx"];
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
      "Number(",
      "toFixed",
      ".reduce(",
    ]) {
      expect(combined, token).not.toContain(token);
    }
    // No arithmetic or ordering over an amount, and no running sum.
    expect(combined).not.toMatch(/[a-zA-Z]Amount\s*[-+*/<>]=?\s*[a-zA-Z0-9]/);
    expect(combined).not.toMatch(/\+=\s*(row|line|item|case)\./);
    const css = readFileSync(path.join(webRoot, "src/styles.css"), "utf8");
    expect(css).toContain(".finance");
    expect(css).not.toContain("@keyframes");
    expect(css).not.toMatch(/animation\s*:/);
  });

  it("reaches the route through the app shell and the navigation", () => {
    const app = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/finance"]}>
        <App />
      </MemoryRouter>,
    );
    expect(app).toContain("Finance desk (synthetic)");
    expect(app).toContain('href="/finance"');
    expect(app).toContain("SYNTHETIC");
    expect(app).toContain('data-adapter-environment="stub"');
    expect(app).toContain("Reading the synthetic finance source. Nothing is shown yet.");
  });

  it("names the surface in the docs and the README, and keeps the locked records", () => {
    const doc = readFileSync(path.join(repoRoot, "docs/c-finance-operations-stub-apps-bind.md"), "utf8");
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    expect(doc).toContain(WORKSPACE_RULING);
    expect(doc).toContain("finance-operations");
    expect(doc).toContain("Browser run");
    expect(doc).toContain("no actor on this desk holds the authority to change economic state");
    expect(doc).toContain("83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249");
    expect(readme).toContain("docs/c-finance-operations-stub-apps-bind.md");
    expect(readme).toContain("/finance");
  });
});
