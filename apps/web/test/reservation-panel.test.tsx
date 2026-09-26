import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReservationCaseView } from "@kix/protocol-adapter";
import { ReservationPanel } from "../src/pages/ReservationPanel";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BANNED_COPY = [
  /gate scanned live/i,
  /venue admitted/i,
  /ticket printed for entry/i,
  /toss/i,
  /portone/i,
  /charged/i,
  /paid out/i,
  /bank settled/i,
  /live capture/i,
];

function sampleView(overrides: Partial<ReservationCaseView> = {}): ReservationCaseView {
  return {
    mode: "mock",
    surface: "wave4.booking.B01-B05.fsm",
    admissionSurface: "wave4.admission.P03.fsm",
    references: ["B01", "B02", "B03", "B04", "B05"],
    admissionReference: "P03",
    provenance: "MOCK_GATE_ONLY",
    lifecycleAuthority: "IN_MEMORY_FSM",
    reservationId: "rsv_evt_lanterns",
    phase: "PAYMENT_NOTED",
    terminal: false,
    showId: "show_evt_lanterns",
    eventId: "evt_lanterns",
    slot: "slot-0",
    slotState: "RESERVED",
    slotHeldByCase: true,
    buyerRole: "desk-buyer",
    expiresAt: "2099-01-01T00:00:00.000Z",
    expired: false,
    orderId: "ord_evt_lanterns",
    paymentRef: "mock-noted",
    issuanceId: null,
    rightId: null,
    issueStatus: "unissued",
    admissionId: null,
    consumeId: null,
    settlementId: "stl_evt_lanterns",
    settlementGate: "BOUND",
    mockSettlementCommitObserved: false,
    economicFinalityClaimed: false,
    fundsExecuted: false,
    chainIssued: false,
    admissionRoutingProduction: false,
    externalPayment: "UNSUPPORTED",
    externalAdmission: "UNSUPPORTED",
    logicalTimeMs: 0,
    idempotencyKey: "desk-observe_payment:rsv_evt_lanterns:0",
    lastRejectCode: "SETTLEMENT_NOT_COMMITTED",
    reconcileMatched: null,
    note: "Simulated mock phase on the adapter stub. Not live admission.",
    ...overrides,
  };
}

describe("reservation panel copy", () => {
  it("renders the mock phase, slot, issue status, and settlement non-claim", () => {
    const html = renderToStaticMarkup(
      <ReservationPanel
        variant="booking"
        eventTitle="North Station Lanterns"
        view={sampleView({
          phase: "ISSUED",
          issueStatus: "issued",
          slotState: "ISSUED",
          settlementGate: "MOCK_COMMIT_OBSERVED",
          mockSettlementCommitObserved: true,
          expired: true,
          terminal: false,
          reconcileMatched: true,
        })}
        showRegistered
        eventReady
        error="SETTLEMENT_NOT_COMMITTED: mock reservation command rejected."
        pending={false}
        onCommand={() => undefined}
      />,
    );

    expect(html).toContain("Mock reservation case");
    expect(html).toContain("Not live admission");
    expect(html).toContain("설계중");
    expect(html).toContain("wave4.booking.B01-B05.fsm");
    expect(html).toContain("MOCK_GATE_ONLY");
    expect(html).toContain("ISSUED");
    expect(html).toContain("Terminal");
    expect(html).toContain("slot-0 · ISSUED");
    expect(html).toContain("Mock issued");
    expect(html).toContain("MOCK_COMMIT_OBSERVED");
    expect(html).toContain("Observed");
    expect(html).toContain("Economic finality claimed");
    expect(html).toContain("false");
    expect(html).toContain("SETTLEMENT_NOT_COMMITTED");
    expect(html).toContain("Matched (process-local)");
    expect(html).toContain("Register mock show");
    expect(html).toContain("Issue mock right");
    expect(html).toContain("adapter stub only");
    expect(html).toContain("Mode");
    expect(html).toContain("mock");
    for (const pattern of BANNED_COPY) {
      expect(html).not.toMatch(pattern);
    }
  });

  it("renders an unopened admission case without a live-admission claim", () => {
    const html = renderToStaticMarkup(
      <ReservationPanel
        variant="admission"
        eventTitle="Paper Orchestra"
        view={null}
        showRegistered={false}
        eventReady
        error={null}
        pending={false}
        onCommand={() => undefined}
      />,
    );
    expect(html).toContain("Mock admission phase");
    expect(html).toContain("wave4.admission.P03.fsm");
    expect(html).toContain("Not opened");
    expect(html).toContain("Not consumed");
    expect(html).toContain("Not observed");
    expect(html).toContain("false");
    expect(html).toContain("Not live admission");
    expect(html).not.toContain("Authorize mock admission phase");
    expect(html).not.toContain("Consume mock once");
    expect(html).toContain("Reconcile process-local");
    expect(html).toContain("MOCK_GATE_ONLY");
    for (const pattern of BANNED_COPY) {
      expect(html).not.toMatch(pattern);
    }
  });

  it("keeps reservation UI copy free of production-admission wording and on the adapter", () => {
    const files = [
      "src/pages/ReservationPanel.tsx",
      "src/pages/Booking.tsx",
      "src/pages/Admission.tsx",
      "src/pages/BoxOffice.tsx",
      "src/reservation-desk.ts",
      "src/admission-desk.ts",
      "src/pages/AdmissionCredentialPanel.tsx",
    ];
    const combined = files.map((file) => readFileSync(path.join(webRoot, file), "utf8")).join("\n");
    for (const pattern of BANNED_COPY) {
      expect(combined).not.toMatch(pattern);
    }
    expect(combined).not.toContain("reservation_fsm");
    expect(combined).not.toContain("admission_fsm");
    expect(readFileSync(path.join(webRoot, "src/pages/Admission.tsx"), "utf8")).not.toContain("checkAdmission");
    expect(readFileSync(path.join(webRoot, "src/admission-desk.ts"), "utf8")).not.toContain("consumeReservation");
    expect(readFileSync(path.join(webRoot, "src/admission-desk.ts"), "utf8")).not.toContain("authorizeReservationAdmission");
    expect(readFileSync(path.join(webRoot, "src/pages/Booking.tsx"), "utf8")).toContain("commands={false}");
    expect(combined).not.toContain("mock_gates");
    expect(combined).not.toContain("settle_capture");
    expect(combined).not.toContain("fetch(");
    const desk = readFileSync(path.join(webRoot, "src/reservation-desk.ts"), "utf8");
    for (const method of [
      "registerReservationShow",
      "holdReservation",
      "releaseReservation",
      "confirmReservation",
      "cancelReservation",
      "observeReservationPayment",
      "bindReservationSettlement",
      "issueReservation",
      "authorizeReservationAdmission",
      "consumeReservation",
      "reconcileReservation",
      "viewReservation",
      "viewReservationShow",
      "advanceReservationClock",
    ]) {
      expect(desk).toContain(`protocol.${method}`);
    }
    expect(combined).toContain('from "@kix/protocol-adapter"');
    expect(combined).toContain("Not live admission");
  });
});
