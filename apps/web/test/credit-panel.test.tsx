import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { CreditCaseView } from "@kix/protocol-adapter";
import { App } from "../src/App";
import { CreditPage } from "../src/pages/Credit";
import { CreditPanel } from "../src/pages/CreditPanel";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BANNED_COPY = [
  /loan approved by bank/i,
  /funds wired/i,
  /kyc cleared/i,
  /\bAPR\b/,
  /licensed lender/i,
  /interest rate/i,
];

function sampleView(overrides: Partial<CreditCaseView> = {}): CreditCaseView {
  return {
    mode: "mock",
    surface: "wave5.credit.F04.fsm",
    references: ["F04"],
    provenance: "MOCK_CREDIT_F04_ONLY",
    lifecycleAuthority: "IN_MEMORY_FSM",
    exposureLedger: "MOCK_EXPOSURE",
    advanceId: "adv_evt_lanterns",
    phase: "DRAWN",
    terminal: false,
    claimId: "claim_evt_lanterns",
    beneficiaryRole: "desk-beneficiary",
    openFace: 100_000,
    availableCredit: 20_000,
    pendingDraw: 0,
    offerAmount: 80_000,
    reservedOpen: 80_000,
    noteStatus: "NOTED",
    drawId: "draw_evt_lanterns",
    drawnExposure: 80_000,
    repaidExposure: 30_000,
    outstandingExposure: 50_000,
    repaymentCount: 1,
    nextRepaymentSequence: 2,
    settlementId: "stl_evt_lanterns",
    settlementGate: "MOCK_COMMIT_OBSERVED",
    mockSettlementCommitObserved: true,
    settlementFailure: false,
    rejectReason: null,
    cancelReason: null,
    defaultReason: null,
    idempotencyKey: "desk-draw:adv_evt_lanterns:0",
    lastRejectCode: "SETTLEMENT_NOT_COMMITTED",
    reconcileMatched: true,
    economicFinalityClaimed: false,
    fundsExecuted: false,
    bankDebitObserved: false,
    repaymentObserved: false,
    interestDefined: false,
    underwritingExecuted: false,
    kycExecuted: false,
    ownershipMutated: false,
    ticketOwnershipAuthoritative: false,
    externalCredit: "UNSUPPORTED",
    note: "Simulated exposure on the adapter stub. Not live credit.",
    ...overrides,
  };
}

describe("credit panel copy", () => {
  it("renders mock exposure, repayment, and the settlement non-claim", () => {
    const html = renderToStaticMarkup(
      <CreditPanel
        eventTitle="North Station Lanterns"
        view={sampleView()}
        error="SETTLEMENT_NOT_COMMITTED: mock credit command rejected."
        pending={false}
        onCommand={() => undefined}
      />,
    );
    expect(html).toContain("wave5.credit.F04.fsm");
    expect(html).toContain("DRAWN");
    expect(html).toContain("Not live credit");
    expect(html).toContain("설계중");
    expect(html).toContain("20000 mock units");
    expect(html).toContain("50000 mock units");
    expect(html).toContain("30000 mock units");
    expect(html).toContain("SETTLEMENT_NOT_COMMITTED");
    expect(html).toContain("MOCK_COMMIT_OBSERVED");
    expect(html).toContain("Economic finality claimed");
    expect(html).toContain("Funds executed");
    expect(html).toContain("false");
    expect(html).toContain("Matched (process-local)");
    expect(html).toContain("MOCK_CREDIT_F04_ONLY");
    expect(html).toContain("does not change a booking");
    for (const pattern of BANNED_COPY) {
      expect(html).not.toMatch(pattern);
    }
  });

  it("renders a failed mock settlement as a non-claim", () => {
    const html = renderToStaticMarkup(
      <CreditPanel
        eventTitle="North Station Lanterns"
        view={sampleView({
          phase: "APPROVED",
          terminal: false,
          pendingDraw: 80_000,
          outstandingExposure: 0,
          repaidExposure: 0,
          reservedOpen: 0,
          availableCredit: 100_000,
          noteStatus: null,
          drawId: null,
          drawnExposure: 0,
          settlementGate: "BOUND",
          mockSettlementCommitObserved: false,
          settlementFailure: true,
          reconcileMatched: null,
          lastRejectCode: "SETTLEMENT_NOT_COMMITTED",
        })}
        error={null}
        pending={false}
        onCommand={() => undefined}
      />,
    );
    expect(html).toContain("APPROVED");
    expect(html).toContain("80000 mock units");
    expect(html).toContain("Settlement failure");
    expect(html).toContain("Yes");
    expect(html).toContain("Not observed");
    expect(html).toContain("false");
    for (const pattern of BANNED_COPY) {
      expect(html).not.toMatch(pattern);
    }
  });

  it("renders the credit route on the adapter without production-finance wording", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/credit"]}>
        <CreditPage />
      </MemoryRouter>,
    );
    expect(html).toContain("Mock credit case");
    expect(html).toContain("Not live credit");
    expect(html).toContain("wave5.credit.F04.fsm");
    expect(html).toContain("does not disburse to a bank");
    expect(html).toContain("Offer mock phase");
    for (const pattern of BANNED_COPY) {
      expect(html).not.toMatch(pattern);
    }

    const app = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/credit"]}>
        <App />
      </MemoryRouter>,
    );
    expect(app).toContain("Credit");
    expect(app).toContain("Not live credit");

    const files = ["src/pages/CreditPanel.tsx", "src/pages/Credit.tsx", "src/credit-desk.ts"];
    const combined = files.map((file) => readFileSync(path.join(webRoot, file), "utf8")).join("\n");
    for (const pattern of BANNED_COPY) {
      expect(combined).not.toMatch(pattern);
    }
    expect(combined).not.toContain("credit_fsm");
    expect(combined).not.toContain("mock_credit");
    expect(combined).not.toContain("settle_capture");
    expect(combined).not.toContain("fetch(");
    expect(combined).not.toContain("confirmBooking");
    expect(combined).not.toContain("acceptResale");
    expect(combined).not.toContain("openResale");
    const desk = readFileSync(path.join(webRoot, "src/credit-desk.ts"), "utf8");
    for (const method of [
      "offerCredit",
      "approveCredit",
      "rejectCredit",
      "cancelCredit",
      "bindCreditSettlement",
      "drawCredit",
      "repayCredit",
      "closeCredit",
      "defaultCredit",
      "reconcileCredit",
      "viewCredit",
      "rejectUnsupportedCredit",
    ]) {
      expect(desk).toContain(`protocol.${method}`);
    }
    expect(combined).toContain('from "@kix/protocol-adapter"');
    expect(combined).toContain("Not live credit");
  });
});
