import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { ResaleCaseView, ResaleRightView } from "@kix/protocol-adapter";
import { ResalePage } from "../src/pages/Resale";
import { ResalePanel } from "../src/pages/ResalePanel";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BANNED_COPY = [
  /listed on exchange/i,
  /kyc cleared/i,
  /funds settled/i,
  /seller bank/i,
  /toss/i,
  /portone/i,
];

function sampleView(overrides: Partial<ResaleCaseView> = {}): ResaleCaseView {
  return {
    mode: "mock",
    surface: "wave4.resale.R01-R05.fsm",
    references: ["R01", "R02", "R03", "R04", "R05"],
    provenance: "MOCK_GATE_ONLY",
    lifecycleAuthority: "IN_MEMORY_FSM",
    listingId: "rsl_evt_lanterns",
    phase: "TRANSFERRED",
    terminal: false,
    pendingSale: false,
    rightId: "iss_evt_lanterns",
    showId: "show_evt_lanterns",
    eventId: "evt_lanterns",
    slot: "slot-0",
    sellerRole: "desk-buyer",
    recipientRole: "desk-recipient",
    buyerRole: null,
    holdId: null,
    expiresAt: "2099-06-01T00:00:00.000Z",
    expired: false,
    attached: false,
    version: 1,
    versionAfter: 2,
    currentVersion: 2,
    holderRole: "desk-recipient",
    generation: 1,
    paymentRef: "mock-resale-noted",
    settlementId: "stl_evt_lanterns",
    settlementGate: "MOCK_COMMIT_OBSERVED",
    settlementFailure: false,
    mockSettlementCommitObserved: true,
    transferId: "xfer_evt_lanterns",
    ownershipTransferred: true,
    priorPresentationValid: false,
    priorCredentialInvalidated: true,
    rightEligible: true,
    slotState: "ISSUED",
    slotRightId: "iss_evt_lanterns",
    economicFinalityClaimed: false,
    fundsExecuted: false,
    venueCredentialReissued: false,
    chainOwnerCurrent: false,
    compensationDefined: false,
    admissionRoutingProduction: false,
    externalMarketplace: "UNSUPPORTED",
    externalPayment: "UNSUPPORTED",
    logicalTimeMs: Date.parse("2099-01-01T00:00:00.000Z"),
    idempotencyKey: "desk-accept_transfer:rsl_evt_lanterns:0",
    lastRejectCode: "SETTLEMENT_NOT_COMMITTED",
    reconcileMatched: true,
    note: "Simulated mock phase on the adapter stub. Not live marketplace.",
    ...overrides,
  };
}

function sampleRight(overrides: Partial<ResaleRightView> = {}): ResaleRightView {
  return {
    mode: "mock",
    surface: "wave4.resale.R01-R05.fsm",
    references: ["R01", "R02", "R03", "R04", "R05"],
    provenance: "MOCK_GATE_ONLY",
    lifecycleAuthority: "IN_MEMORY_FSM",
    rightId: "iss_evt_lanterns",
    eligibility: "ELIGIBLE",
    eligible: true,
    salePhase: null,
    reservationId: "rsv_evt_lanterns",
    showId: "show_evt_lanterns",
    eventId: "evt_lanterns",
    slot: "slot-0",
    holderRole: "desk-recipient",
    version: 2,
    generation: 1,
    activeListingId: null,
    economicFinalityClaimed: false,
    fundsExecuted: false,
    venueCredentialReissued: false,
    externalMarketplace: "UNSUPPORTED",
    logicalTimeMs: 0,
    lastRejectCode: null,
    note: "Simulated mock phase on the adapter stub. Not live marketplace.",
    ...overrides,
  };
}

describe("resale panel copy", () => {
  it("renders the mock phase, transfer, and settlement non-claim", () => {
    const html = renderToStaticMarkup(
      <ResalePanel
        eventTitle="North Station Lanterns"
        view={sampleView()}
        right={sampleRight()}
        error="SETTLEMENT_NOT_COMMITTED: mock resale command rejected."
        pending={false}
        onCommand={() => undefined}
      />,
    );

    expect(html).toContain("Mock resale case");
    expect(html).toContain("Not live marketplace");
    expect(html).toContain("설계중");
    expect(html).toContain("wave4.resale.R01-R05.fsm");
    expect(html).toContain("MOCK_GATE_ONLY");
    expect(html).toContain("TRANSFERRED");
    expect(html).toContain("Listing eligibility");
    expect(html).toContain("ELIGIBLE");
    expect(html).toContain("Pending sale");
    expect(html).toContain("Settlement failure");
    expect(html).toContain("Ownership transferred");
    expect(html).toContain("Prior credential invalidated");
    expect(html).toContain("Yes");
    expect(html).toContain("SETTLEMENT_NOT_COMMITTED");
    expect(html).toContain("desk-recipient · v2");
    expect(html).toContain("Economic finality claimed");
    expect(html).toContain("false");
    expect(html).toContain("Venue credential reissued");
    expect(html).toContain("UNSUPPORTED");
    expect(html).toContain("MOCK_COMMIT_OBSERVED");
    expect(html).toContain("Matched (process-local)");
    expect(html).toContain("Accept mock transfer");
    expect(html).toContain("Reject external marketplace");
    expect(html).toContain("adapter stub only");
    expect(html).toContain("Mode");
    expect(html).toContain("mock");
    for (const pattern of BANNED_COPY) {
      expect(html).not.toMatch(pattern);
    }
  });

  it("renders an unopened case and a failed mock settlement", () => {
    const empty = renderToStaticMarkup(
      <ResalePanel
        eventTitle="Paper Orchestra"
        view={null}
        right={null}
        error={null}
        pending={false}
        onCommand={() => undefined}
      />,
    );
    expect(empty).toContain("Not opened");
    expect(empty).toContain("Not eligible");
    expect(empty).toContain("Not live marketplace");
    expect(empty).toContain("false");
    expect(empty).toContain("UNSUPPORTED");
    expect(empty).toContain("Adopt mock right");

    const failed = renderToStaticMarkup(
      <ResalePanel
        eventTitle="Paper Orchestra"
        view={sampleView({
          phase: "PAYMENT_NOTED",
          pendingSale: true,
          terminal: false,
          ownershipTransferred: false,
          priorCredentialInvalidated: false,
          settlementGate: "BOUND",
          settlementFailure: true,
          mockSettlementCommitObserved: false,
          currentVersion: 1,
          versionAfter: null,
          holderRole: "desk-buyer",
          reconcileMatched: null,
        })}
        right={sampleRight({ eligible: false, eligibility: "LOCKED", salePhase: "PAYMENT_NOTED", holderRole: "desk-buyer", version: 1 })}
        error={null}
        pending={false}
        onCommand={() => undefined}
      />,
    );
    expect(failed).toContain("PAYMENT_NOTED");
    expect(failed).toContain("Settlement failure");
    expect(failed).toContain("Yes");
    expect(failed).toContain("Not observed");
    expect(failed).toContain("false");
    for (const pattern of BANNED_COPY) {
      expect(failed).not.toMatch(pattern);
    }
  });

  it("renders the resale route on the adapter without production-marketplace wording", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/resale"]}>
        <ResalePage />
      </MemoryRouter>,
    );
    expect(html).toContain("Open listing");
    expect(html).toContain("Mock resale case");
    expect(html).toContain("Not live marketplace");
    expect(html).toContain("wave4.resale.R01-R05.fsm");
    expect(html).toContain("does not create a live ticket");
    for (const pattern of BANNED_COPY) {
      expect(html).not.toMatch(pattern);
    }

    const files = ["src/pages/ResalePanel.tsx", "src/pages/Resale.tsx", "src/resale-desk.ts"];
    const combined = files.map((file) => readFileSync(path.join(webRoot, file), "utf8")).join("\n");
    for (const pattern of BANNED_COPY) {
      expect(combined).not.toMatch(pattern);
    }
    expect(combined).not.toContain("resale_fsm");
    expect(combined).not.toContain("mock_gates");
    expect(combined).not.toContain("settle_capture");
    expect(combined).not.toContain("fetch(");
    const desk = readFileSync(path.join(webRoot, "src/resale-desk.ts"), "utf8");
    for (const method of [
      "advanceResaleClock",
      "adoptResaleIssued",
      "listResaleCase",
      "holdResaleBuy",
      "releaseResaleHold",
      "cancelResaleListing",
      "observeResalePayment",
      "bindResaleSettlement",
      "acceptResaleTransfer",
      "closeResaleListing",
      "reconcileResale",
      "viewResaleCase",
      "viewResaleRight",
      "rejectExternalResale",
    ]) {
      expect(desk).toContain(`protocol.${method}`);
    }
    expect(combined).toContain('from "@kix/protocol-adapter"');
    expect(combined).toContain("Not live marketplace");
    expect(combined).toContain("Transfer (simulated)");
  });
});
