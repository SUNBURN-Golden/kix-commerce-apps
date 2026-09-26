import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  CONTRACT_ONLY_LOCAL_CALL_PATH,
  HttpProtocolAdapter,
  OPENAPI_CONTRACT_PIN,
  PINNED_ACTIONS,
  PINNED_PROTOCOL_DOMAIN,
  ProtocolError,
  RESERVATION_CASE_NOTE,
  RESERVATION_DEPTH_BASELINE,
  StubProtocolAdapter,
  createProtocol,
  echoIntegrationGateHeaders,
  isPinnedAction,
} from "../src/index.js";

const SHOW = "show_evt_lanterns";
const EVENT = "evt_lanterns";
const RES = "rsv_evt_lanterns";
const ORDER = "ord_evt_lanterns";
const ISSUE = "iss_evt_lanterns";
const ADMIT = "adm_evt_lanterns";
const CONSUME = "csm_evt_lanterns";
const SLOT = "slot-0";
const EXPIRES = "2099-01-01T00:00:00.000Z";
const SETTLEMENT = "stl_evt_lanterns";

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

const FSM_ACTIONS = [
  "register_show",
  "hold",
  "release",
  "confirm",
  "cancel",
  "observe_payment",
  "bind_settlement",
  "issue",
  "authorize_admission",
  "consume",
  "reconcile",
  "set_clock",
] as const;

function protocol(): StubProtocolAdapter {
  return new StubProtocolAdapter();
}

async function registerAndHold(adapter: StubProtocolAdapter, expiresAt = EXPIRES) {
  await adapter.registerReservationShow({
    showId: SHOW,
    eventId: EVENT,
    idempotencyKey: "show-1",
    slots: [SLOT],
  });
  return adapter.holdReservation({
    reservationId: RES,
    showId: SHOW,
    slot: SLOT,
    buyerRole: "buyer-1",
    expiresAt,
    idempotencyKey: "hold-1",
  });
}

async function pay(adapter: StubProtocolAdapter) {
  await adapter.confirmReservation({
    orderId: ORDER,
    reservationId: RES,
    idempotencyKey: "confirm-1",
  });
  return adapter.observeReservationPayment({
    orderId: ORDER,
    idempotencyKey: "pay-1",
    paymentRef: "mock-noted",
  });
}

describe("stub reservation case", () => {
  it("walks hold, issue, and one consume without economic finality", async () => {
    const adapter = protocol();
    const [first] = await adapter.listPerformances();
    const capacity = first?.remainingCapacity;

    const held = await registerAndHold(adapter);
    expect(held.duplicate).toBe(false);
    expect(held.applied).toBe("hold");
    expect(held.idempotencyKey).toBe("hold-1");
    expect(held.provenance).toBe("MOCK_GATE_ONLY");
    expect(held.economicFinalityClaimed).toBe(false);
    expect(held.fundsExecuted).toBe(false);
    expect(held.externalAdmission).toBe("UNSUPPORTED");
    expect(held.reservation?.phase).toBe("HELD");
    expect(held.reservation?.terminal).toBe(false);
    expect(held.reservation?.mode).toBe("mock");
    expect(held.reservation?.surface).toBe("wave4.booking.B01-B05.fsm");
    expect(held.reservation?.admissionSurface).toBe("wave4.admission.P03.fsm");
    expect(held.reservation?.references).toEqual(["B01", "B02", "B03", "B04", "B05"]);
    expect(held.reservation?.admissionReference).toBe("P03");
    expect(held.reservation?.slotState).toBe("RESERVED");
    expect(held.reservation?.slotHeldByCase).toBe(true);
    expect(held.reservation?.issueStatus).toBe("unissued");
    expect(held.reservation?.settlementGate).toBe("UNBOUND");
    expect(held.reservation?.mockSettlementCommitObserved).toBe(false);
    expect(held.reservation?.economicFinalityClaimed).toBe(false);
    expect(held.reservation?.chainIssued).toBe(false);
    expect(held.reservation?.admissionRoutingProduction).toBe(false);
    expect(held.reservation?.expired).toBe(false);
    expect(held.reservation?.note).toBe(RESERVATION_CASE_NOTE);
    expect(held.reservation).not.toHaveProperty("amount");
    expect(held.reservation).not.toHaveProperty("currency");
    expect(held.reservation).not.toHaveProperty("gross");
    for (const pattern of BANNED_COPY) {
      expect(held.reservation?.note).not.toMatch(pattern);
    }
    expect((await adapter.listPerformances()).find((item) => item.eventId === EVENT)?.remainingCapacity).toBe(capacity);

    const paid = await pay(adapter);
    expect(paid.reservation?.phase).toBe("PAYMENT_NOTED");
    expect(paid.reservation?.paymentRef).toBe("mock-noted");
    expect(paid.fundsExecuted).toBe(false);

    const issued = await adapter.issueReservation({
      issuanceId: ISSUE,
      orderId: ORDER,
      idempotencyKey: "issue-1",
    });
    expect(issued.applied).toBe("issue");
    expect(issued.reservation?.phase).toBe("ISSUED");
    expect(issued.reservation?.issueStatus).toBe("issued");
    expect(issued.reservation?.slotState).toBe("ISSUED");
    expect(issued.reservation?.rightId).toBe(ISSUE);
    expect(issued.reservation?.settlementGate).toBe("UNBOUND");
    expect(issued.reservation?.mockSettlementCommitObserved).toBe(false);
    expect(issued.reservation?.economicFinalityClaimed).toBe(false);
    expect(issued.reservation?.terminal).toBe(false);
    expect(issued.fundsExecuted).toBe(false);

    const replayedIssue = await adapter.issueReservation({
      issuanceId: ISSUE,
      orderId: ORDER,
      idempotencyKey: "issue-1",
    });
    expect(replayedIssue.duplicate).toBe(true);
    expect(replayedIssue.applied).toBeNull();
    expect(replayedIssue.economicFinalityClaimed).toBe(false);

    await expect(
      adapter.issueReservation({ issuanceId: "iss_other", orderId: ORDER, idempotencyKey: "issue-2" }),
    ).rejects.toMatchObject({ code: "ORDER_ALREADY_ISSUED" });

    await expect(
      adapter.consumeReservation({ consumeId: CONSUME, rightId: ISSUE, idempotencyKey: "consume-early" }),
    ).rejects.toMatchObject({ code: "ADMISSION_REQUIRED" });
    expect((await adapter.viewReservation(RES)).phase).toBe("ISSUED");

    const authorized = await adapter.authorizeReservationAdmission({
      admissionId: ADMIT,
      rightId: ISSUE,
      idempotencyKey: "admit-1",
    });
    expect(authorized.reservation?.phase).toBe("ADMISSION_AUTHORIZED");
    expect(authorized.reservation?.admissionId).toBe(ADMIT);
    expect(authorized.reservation?.admissionRoutingProduction).toBe(false);

    const consumed = await adapter.consumeReservation({
      consumeId: CONSUME,
      rightId: ISSUE,
      idempotencyKey: "consume-1",
    });
    expect(consumed.reservation?.phase).toBe("CONSUMED");
    expect(consumed.reservation?.terminal).toBe(true);
    expect(consumed.reservation?.issueStatus).toBe("consumed");
    expect(consumed.reservation?.consumeId).toBe(CONSUME);
    expect(consumed.reservation?.slotState).toBe("ISSUED");
    expect(consumed.economicFinalityClaimed).toBe(false);
    expect(consumed.fundsExecuted).toBe(false);

    await expect(
      adapter.consumeReservation({ consumeId: "csm_again", rightId: ISSUE, idempotencyKey: "consume-2" }),
    ).rejects.toMatchObject({ code: "ALREADY_CONSUMED" });
    const replayedConsume = await adapter.consumeReservation({
      consumeId: CONSUME,
      rightId: ISSUE,
      idempotencyKey: "consume-1",
    });
    expect(replayedConsume.duplicate).toBe(true);
    expect(replayedConsume.applied).toBeNull();
    expect(replayedConsume.reservation?.phase).toBe("CONSUMED");
    expect(replayedConsume.economicFinalityClaimed).toBe(false);

    const frozenIssue = await adapter.issueReservation({
      issuanceId: ISSUE,
      orderId: ORDER,
      idempotencyKey: "issue-1",
    });
    expect(frozenIssue.duplicate).toBe(true);
    expect(frozenIssue.reservation?.phase).toBe("ISSUED");
    expect((await adapter.viewReservation(RES)).phase).toBe("CONSUMED");

    const report = await adapter.reconcileReservation({ reservationId: RES, idempotencyKey: "recon-1" });
    expect(report.matched).toBe(true);
    expect(report.duplicate).toBe(false);
    expect(report.applied).toBe("reconcile");
    expect(report.reservation?.reconcileMatched).toBe(true);
    expect(report.reservation?.phase).toBe("CONSUMED");
    expect(report.economicFinalityClaimed).toBe(false);

    const replayedReport = await adapter.reconcileReservation({ reservationId: RES, idempotencyKey: "recon-1" });
    expect(replayedReport.duplicate).toBe(true);
    expect(replayedReport.applied).toBeNull();
    expect(replayedReport.matched).toBe(true);

    expect(adapter.describe().surfaces).toContain("wave4.booking.B01-B05.fsm");
    expect(adapter.describe().surfaces).toContain("wave4.admission.P03.fsm");
    expect(adapter.describe().fundsMovement).toBe("none");
    expect((await adapter.listPerformances()).find((item) => item.eventId === EVENT)?.remainingCapacity).toBe(capacity);
  });

  it("rejects illegal transitions and keeps a cancelled case immutable", async () => {
    const adapter = protocol();
    await registerAndHold(adapter);
    await adapter.confirmReservation({ orderId: ORDER, reservationId: RES, idempotencyKey: "confirm-1" });

    await expect(
      adapter.issueReservation({ issuanceId: ISSUE, orderId: ORDER, idempotencyKey: "issue-early" }),
    ).rejects.toMatchObject({ code: "ILLEGAL_TRANSITION" });
    await expect(
      adapter.issueReservation({ issuanceId: ISSUE, orderId: ORDER, idempotencyKey: "issue-early" }),
    ).rejects.toMatchObject({ code: "ILLEGAL_TRANSITION" });
    const confirmed = await adapter.viewReservation(RES);
    expect(confirmed.phase).toBe("CONFIRMED");
    expect(confirmed.lastRejectCode).toBe("ILLEGAL_TRANSITION");
    expect(confirmed.issueStatus).toBe("unissued");

    await expect(
      adapter.releaseReservation({ reservationId: RES, idempotencyKey: "release-late" }),
    ).rejects.toMatchObject({ code: "ILLEGAL_TRANSITION" });
    await expect(
      adapter.confirmReservation({ orderId: "ord_again", reservationId: RES, idempotencyKey: "confirm-again" }),
    ).rejects.toMatchObject({ code: "RESERVATION_ALREADY_ORDERED" });
    expect((await adapter.viewReservation(RES)).phase).toBe("CONFIRMED");

    const cancelled = await adapter.cancelReservation({ reservationId: RES, idempotencyKey: "cancel-1" });
    expect(cancelled.reservation?.phase).toBe("CANCELLED");
    expect(cancelled.reservation?.terminal).toBe(true);
    expect(cancelled.reservation?.slotState).toBe("FREE");
    expect(cancelled.reservation?.slotHeldByCase).toBe(false);

    await expect(
      adapter.confirmReservation({ orderId: "ord_later", reservationId: RES, idempotencyKey: "confirm-terminal" }),
    ).rejects.toMatchObject({ code: "TERMINAL_IMMUTABLE" });
    await expect(
      adapter.releaseReservation({ reservationId: RES, idempotencyKey: "release-terminal" }),
    ).rejects.toMatchObject({ code: "TERMINAL_IMMUTABLE" });
    const after = await adapter.viewReservation(RES);
    expect(after.phase).toBe("CANCELLED");
    expect(after.terminal).toBe(true);
    expect(after.slotState).toBe("FREE");

    await expect(adapter.viewReservation("rsv_missing")).rejects.toMatchObject({ code: "UNKNOWN_RESERVATION" });
    await expect(adapter.viewReservationShow("show_missing")).rejects.toMatchObject({ code: "UNKNOWN_SHOW" });
  });

  it("keeps an expired hold until an explicit release", async () => {
    const adapter = protocol();
    await registerAndHold(adapter, "2026-09-26T00:00:05.000Z");
    const before = await adapter.viewReservation(RES);
    expect(before.expired).toBe(false);
    expect(before.phase).toBe("HELD");
    expect(before.logicalTimeMs).toBe(0);

    const clock = await adapter.advanceReservationClock({
      idempotencyKey: "clock-1",
      nowAt: "2026-09-26T00:00:05.000Z",
    });
    expect(clock.applied).toBe("set_clock");
    expect(clock.logicalTimeMs).toBe(Date.parse("2026-09-26T00:00:05.000Z"));
    expect(clock.reservation).toBeNull();

    const expired = await adapter.viewReservation(RES);
    expect(expired.expired).toBe(true);
    expect(expired.phase).toBe("HELD");
    expect(expired.slotState).toBe("RESERVED");
    expect(expired.terminal).toBe(false);

    await expect(
      adapter.confirmReservation({ orderId: ORDER, reservationId: RES, idempotencyKey: "confirm-expired" }),
    ).rejects.toMatchObject({ code: "RESERVATION_EXPIRED" });
    expect((await adapter.viewReservation(RES)).phase).toBe("HELD");
    expect((await adapter.viewReservation(RES)).lastRejectCode).toBe("RESERVATION_EXPIRED");

    await expect(
      adapter.holdReservation({
        reservationId: "rsv_other",
        showId: SHOW,
        slot: SLOT,
        buyerRole: "buyer-2",
        expiresAt: "2099-01-01T00:00:00.000Z",
        idempotencyKey: "hold-occupied",
      }),
    ).rejects.toMatchObject({ code: "SLOT_OCCUPIED" });

    const released = await adapter.releaseReservation({ reservationId: RES, idempotencyKey: "release-1" });
    expect(released.reservation?.phase).toBe("RELEASED");
    expect(released.reservation?.terminal).toBe(true);
    expect(released.reservation?.slotState).toBe("FREE");
    expect(released.reservation?.expired).toBe(false);

    await expect(
      adapter.releaseReservation({ reservationId: RES, idempotencyKey: "release-2" }),
    ).rejects.toMatchObject({ code: "TERMINAL_IMMUTABLE" });
    const again = await adapter.releaseReservation({ reservationId: RES, idempotencyKey: "release-1" });
    expect(again.duplicate).toBe(true);
    expect(again.applied).toBeNull();

    const moved = await adapter.holdReservation({
      reservationId: "rsv_other",
      showId: SHOW,
      slot: SLOT,
      buyerRole: "buyer-2",
      expiresAt: "2099-01-01T00:00:00.000Z",
      idempotencyKey: "hold-2",
    });
    expect(moved.reservation?.phase).toBe("HELD");
    expect(moved.reservation?.slotHeldByCase).toBe(true);
    expect((await adapter.viewReservation(RES)).phase).toBe("RELEASED");
    expect((await adapter.viewReservationShow(SHOW)).slots[0]?.reservationId).toBe("rsv_other");

    await expect(
      adapter.advanceReservationClock({ idempotencyKey: "clock-back", nowAt: "2026-01-01T00:00:00.000Z" }),
    ).rejects.toMatchObject({ code: "CLOCK_REGRESSION" });
    expect((await adapter.viewReservation("rsv_other")).logicalTimeMs).toBe(Date.parse("2026-09-26T00:00:05.000Z"));
  });

  it("replays an idempotency key and rejects a different body", async () => {
    const adapter = protocol();
    const first = await registerAndHold(adapter);
    const again = await adapter.holdReservation({
      reservationId: RES,
      showId: SHOW,
      slot: SLOT,
      buyerRole: "buyer-1",
      expiresAt: EXPIRES,
      idempotencyKey: "hold-1",
    });
    expect(again.duplicate).toBe(true);
    expect(again.applied).toBeNull();
    expect(again.reservation?.phase).toBe(first.reservation?.phase);

    await expect(
      adapter.holdReservation({
        reservationId: RES,
        showId: SHOW,
        slot: SLOT,
        buyerRole: "buyer-2",
        expiresAt: EXPIRES,
        idempotencyKey: "hold-1",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    const unchanged = await adapter.viewReservation(RES);
    expect(unchanged.phase).toBe("HELD");
    expect(unchanged.buyerRole).toBe("buyer-1");
    expect(unchanged.lastRejectCode).toBe("IDEMPOTENCY_CONFLICT");

    await expect(
      adapter.holdReservation({
        reservationId: RES,
        showId: SHOW,
        slot: SLOT,
        buyerRole: "buyer-1",
        expiresAt: EXPIRES,
        idempotencyKey: "hold-2",
      }),
    ).rejects.toMatchObject({ code: "ILLEGAL_TRANSITION" });
    expect((await adapter.viewReservation(RES)).phase).toBe("HELD");

    await expect(adapter.advanceReservationClock({ idempotencyKey: " ", nowAt: EXPIRES })).rejects.toMatchObject({
      code: "INVALID_ID",
    });
    await expect(
      adapter.registerReservationShow({
        showId: SHOW,
        eventId: "evt_missing",
        idempotencyKey: "show-missing",
        slots: [SLOT],
      }),
    ).rejects.toThrow(/Unknown performance/);
  });

  it("refuses a bound issue until the mock settlement view is COMMITTED", async () => {
    const adapter = protocol();
    await registerAndHold(adapter);
    await pay(adapter);
    await adapter.initiateSettlement({
      settlementId: SETTLEMENT,
      eventId: EVENT,
      idempotencyKey: "stl-init",
    });
    const bound = await adapter.bindReservationSettlement({
      reservationId: RES,
      settlementId: SETTLEMENT,
      idempotencyKey: "bind-1",
    });
    expect(bound.reservation?.phase).toBe("PAYMENT_NOTED");
    expect(bound.reservation?.settlementGate).toBe("BOUND");
    expect(bound.reservation?.mockSettlementCommitObserved).toBe(false);
    expect(bound.reservation?.economicFinalityClaimed).toBe(false);
    expect(bound.fundsExecuted).toBe(false);

    await expect(
      adapter.issueReservation({ issuanceId: ISSUE, orderId: ORDER, idempotencyKey: "issue-early" }),
    ).rejects.toMatchObject({ code: "SETTLEMENT_NOT_COMMITTED" });
    await expect(
      adapter.issueReservation({ issuanceId: ISSUE, orderId: ORDER, idempotencyKey: "issue-early" }),
    ).rejects.toMatchObject({ code: "SETTLEMENT_NOT_COMMITTED" });

    await adapter.authorizeSettlement({ settlementId: SETTLEMENT, idempotencyKey: "stl-auth" });
    await adapter.captureSettlement({ settlementId: SETTLEMENT, idempotencyKey: "stl-cap" });
    await expect(
      adapter.issueReservation({ issuanceId: ISSUE, orderId: ORDER, idempotencyKey: "issue-captured" }),
    ).rejects.toMatchObject({ code: "SETTLEMENT_NOT_COMMITTED" });
    const stillNoted = await adapter.viewReservation(RES);
    expect(stillNoted.phase).toBe("PAYMENT_NOTED");
    expect(stillNoted.issueStatus).toBe("unissued");
    expect(stillNoted.rightId).toBeNull();
    expect(stillNoted.mockSettlementCommitObserved).toBe(false);
    expect(stillNoted.economicFinalityClaimed).toBe(false);
    expect(stillNoted.settlementGate).toBe("BOUND");
    expect(stillNoted.lastRejectCode).toBe("SETTLEMENT_NOT_COMMITTED");
    expect((await adapter.viewSettlement(SETTLEMENT)).phase).toBe("CAPTURED");
    expect((await adapter.viewSettlement(SETTLEMENT)).fundsExecuted).toBe(false);

    await adapter.commitSettlement({ settlementId: SETTLEMENT, idempotencyKey: "stl-commit" });
    const issued = await adapter.issueReservation({
      issuanceId: ISSUE,
      orderId: ORDER,
      idempotencyKey: "issue-committed",
    });
    expect(issued.reservation?.phase).toBe("ISSUED");
    expect(issued.reservation?.settlementGate).toBe("MOCK_COMMIT_OBSERVED");
    expect(issued.reservation?.mockSettlementCommitObserved).toBe(true);
    expect(issued.reservation?.economicFinalityClaimed).toBe(false);
    expect(issued.reservation?.fundsExecuted).toBe(false);
    expect(issued.reservation?.chainIssued).toBe(false);
    expect(issued.economicFinalityClaimed).toBe(false);
    expect(issued.reservation).not.toHaveProperty("amount");
    const settlement = await adapter.viewSettlement(SETTLEMENT);
    expect(settlement.phase).toBe("COMMITTED");
    expect(settlement.fundsExecuted).toBe(false);
    expect(settlement).not.toHaveProperty("gross");

    await expect(
      adapter.cancelReservation({ reservationId: RES, idempotencyKey: "cancel-issued" }),
    ).rejects.toMatchObject({ code: "CANCEL_AFTER_ISSUE" });
    expect((await adapter.viewReservation(RES)).phase).toBe("ISSUED");
  });

  it("refuses payment after confirm and leaves external attempts unjournaled", async () => {
    const adapter = protocol();
    await registerAndHold(adapter);
    await pay(adapter);
    await expect(
      adapter.cancelReservation({ reservationId: RES, idempotencyKey: "cancel-paid" }),
    ).rejects.toMatchObject({ code: "COMPENSATION_UNDEFINED" });
    const noted = await adapter.viewReservation(RES);
    expect(noted.phase).toBe("PAYMENT_NOTED");
    expect(noted.slotState).toBe("RESERVED");
    expect(noted.economicFinalityClaimed).toBe(false);
    expect(noted.fundsExecuted).toBe(false);

    await expect(adapter.rejectExternalReservation("EXTERNAL_ATTEMPT")).rejects.toMatchObject({
      code: "EXTERNAL_UNSUPPORTED",
    });
    await expect(adapter.rejectExternalReservation(" ")).rejects.toMatchObject({ code: "INVALID_ID" });
    const after = await adapter.viewReservation(RES);
    expect(after.phase).toBe("PAYMENT_NOTED");
    expect(after.externalAdmission).toBe("UNSUPPORTED");
    expect(after.externalPayment).toBe("UNSUPPORTED");
  });

  it("rejects an unknown settlement binding at issue and keeps the OpenAPI pin", async () => {
    const adapter = protocol();
    await registerAndHold(adapter);
    await pay(adapter);
    await adapter.bindReservationSettlement({
      reservationId: RES,
      settlementId: "stl_missing",
      idempotencyKey: "bind-missing",
    });
    await expect(
      adapter.issueReservation({ issuanceId: ISSUE, orderId: ORDER, idempotencyKey: "issue-missing" }),
    ).rejects.toMatchObject({ code: "UNKNOWN_SETTLEMENT" });
    expect((await adapter.viewReservation(RES)).phase).toBe("PAYMENT_NOTED");
    expect((await adapter.viewReservation(RES)).economicFinalityClaimed).toBe(false);

    expect(OPENAPI_CONTRACT_PIN.openApiFileSha256).toBe(
      "fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e",
    );
    expect(OPENAPI_CONTRACT_PIN.sourceProtocolContractSha256).toBe(
      "ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e",
    );
    expect(OPENAPI_CONTRACT_PIN.contractStatus).toBe("contract-only");
    expect(OPENAPI_CONTRACT_PIN.liveHttpServer).toBe(false);
    expect(OPENAPI_CONTRACT_PIN.productionEndpoint).toBe(false);
    expect(RESERVATION_DEPTH_BASELINE.protocolMainSha).toBe("a47828dd4517c5a7397e09eb6b563a64e4265c82");
    expect(PINNED_ACTIONS).toHaveLength(40);
    for (const name of FSM_ACTIONS) {
      expect(isPinnedAction(name)).toBe(false);
    }
    expect(isPinnedAction("admit")).toBe(true);
    expect(isPinnedAction("advance_clock")).toBe(true);
    expect(isPinnedAction("capture")).toBe(true);
    expect(isPinnedAction("settle_capture")).toBe(true);
  });
});

describe("http reservation commands stay not-bound", () => {
  it("refuses http mode without a base URL", () => {
    expect(() => createProtocol({ mode: "http" })).toThrow(ProtocolError);
    expect(() => createProtocol({ mode: "http", baseUrl: "   " })).toThrow(ProtocolError);
  });

  it("does not send FSM commands, capture, settle_capture, or a venue scan", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    };
    const adapter = new HttpProtocolAdapter("http://127.0.0.1:8765", fetchImpl);
    const step = { reservationId: RES, idempotencyKey: "k-1" };

    await expect(adapter.advanceReservationClock({ idempotencyKey: "clock-http", nowAt: EXPIRES })).rejects.toThrow(
      /not-bound/,
    );
    await expect(
      adapter.registerReservationShow({ showId: SHOW, eventId: EVENT, idempotencyKey: "show-http", slots: [SLOT] }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      adapter.holdReservation({
        reservationId: RES,
        showId: SHOW,
        slot: SLOT,
        buyerRole: "buyer-1",
        expiresAt: EXPIRES,
        idempotencyKey: "hold-http",
      }),
    ).rejects.toThrow(/not-bound/);
    await expect(adapter.releaseReservation(step)).rejects.toThrow(/not-bound/);
    await expect(
      adapter.confirmReservation({ orderId: ORDER, reservationId: RES, idempotencyKey: "confirm-http" }),
    ).rejects.toThrow(/not-bound/);
    await expect(adapter.cancelReservation(step)).rejects.toThrow(/not-bound/);
    await expect(
      adapter.observeReservationPayment({ orderId: ORDER, idempotencyKey: "pay-http", paymentRef: "mock-noted" }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      adapter.bindReservationSettlement({
        reservationId: RES,
        settlementId: SETTLEMENT,
        idempotencyKey: "bind-http",
      }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      adapter.issueReservation({ issuanceId: ISSUE, orderId: ORDER, idempotencyKey: "issue-http" }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      adapter.authorizeReservationAdmission({ admissionId: ADMIT, rightId: ISSUE, idempotencyKey: "admit-http" }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      adapter.consumeReservation({ consumeId: CONSUME, rightId: ISSUE, idempotencyKey: "consume-http" }),
    ).rejects.toThrow(/not-bound/);
    await expect(adapter.reconcileReservation(step)).rejects.toThrow(/not-bound/);
    await expect(adapter.viewReservation(RES)).rejects.toThrow(/not-bound/);
    await expect(adapter.viewReservationShow(SHOW)).rejects.toThrow(/not-bound/);
    await expect(adapter.rejectExternalReservation("EXTERNAL_ATTEMPT")).rejects.toThrow(/not-bound/);
    await expect(adapter.checkAdmission({ rightsRef: "right_9", gateId: "gate-main" })).rejects.toThrow(/not-bound/);

    expect(calls).toEqual([]);
    expect(COMMERCE_COMMAND_BINDINGS.holdReservation.consideredAction).toBeNull();
    expect(COMMERCE_COMMAND_BINDINGS.issueReservation.consideredAction).toBeNull();
    expect(COMMERCE_COMMAND_BINDINGS.authorizeReservationAdmission.consideredAction).toBeNull();
    expect(COMMERCE_COMMAND_BINDINGS.consumeReservation.consideredAction).toBeNull();
    expect(COMMERCE_COMMAND_BINDINGS.bindReservationSettlement.consideredAction).toBeNull();
    expect(COMMERCE_COMMAND_BINDINGS.advanceReservationClock.consideredAction).toBeNull();
    expect(COMMERCE_COMMAND_BINDINGS.issueReservation.reason).toMatch(/does not send capture or settle_capture/);
    expect(COMMERCE_COMMAND_BINDINGS.bindReservationSettlement.reason).toMatch(/does not send settle_capture/);
    expect(COMMERCE_COMMAND_BINDINGS.authorizeReservationAdmission.reason).toMatch(/not admit/);
    expect(COMMERCE_COMMAND_BINDINGS.consumeReservation.reason).toMatch(/does not scan a venue/);
    expect(COMMERCE_COMMAND_BINDINGS.checkAdmission.status).toBe("not-bound");
    expect(CONTRACT_ONLY_LOCAL_CALL_PATH).toBe("/x-kix-contract-only/local-call");

    await expect(
      adapter.invokeLocalCall({
        operationId: "op-hold",
        actor: "fixture-actor",
        action: "hold",
        body: { domain: PINNED_PROTOCOL_DOMAIN },
      }),
    ).rejects.toThrow(/Unknown protocol action/);
    expect(calls).toEqual([]);
  });
});

describe("reservation payload guards", () => {
  it("keeps reservation and admission payloads mock", async () => {
    let responseBody: unknown = {};
    const fetchImpl: typeof fetch = async (_input, init) =>
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: echoIntegrationGateHeaders(init),
      });
    const adapter = new HttpProtocolAdapter("http://127.0.0.1:8765", fetchImpl);
    const commandBody = { domain: PINNED_PROTOCOL_DOMAIN, eventId: EVENT };
    const call = (operationId: string) =>
      adapter.invokeLocalCall({
        operationId,
        actor: "fixture-actor",
        action: "close_sales",
        body: commandBody,
      });

    responseBody = {
      reservationId: RES,
      mode: "mock",
      phase: "ISSUED",
      provenance: "MOCK_GATE_ONLY",
      economicFinalityClaimed: false,
      fundsExecuted: false,
      chainIssued: false,
      admissionRoutingProduction: false,
      externalAdmission: "UNSUPPORTED",
      externalPayment: "UNSUPPORTED",
      references: ["B01", "B02", "B03", "B04", "B05"],
      note: "Simulated mock phase. Not live admission.",
    };
    await expect(call("op-res-ok")).resolves.toMatchObject({
      phase: "ISSUED",
      economicFinalityClaimed: false,
      mode: "mock",
    });

    responseBody = {
      reservationId: RES,
      mode: "mock",
      phase: "ISSUED",
      provenance: "MOCK_GATE_ONLY",
      economicFinalityClaimed: true,
    };
    await expect(call("op-res-final")).rejects.toThrow(/economic finality/);

    responseBody = { economic_finality_claimed: true };
    await expect(call("op-res-snake")).rejects.toThrow(/economic finality/);

    responseBody = {
      reservationId: RES,
      mode: "live",
      phase: "HELD",
      provenance: "MOCK_GATE_ONLY",
    };
    await expect(call("op-res-live")).rejects.toThrow(/mock mode/);

    responseBody = {
      reservationId: RES,
      mode: "mock",
      phase: "ISSUED",
      provenance: "LIVE_GATE",
      economicFinalityClaimed: false,
    };
    await expect(call("op-res-prov")).rejects.toThrow(/MOCK_GATE_ONLY/);

    responseBody = {
      reservationId: RES,
      mode: "mock",
      phase: "CONSUMED",
      provenance: "MOCK_GATE_ONLY",
      economicFinalityClaimed: false,
      admissionRoutingProduction: true,
    };
    await expect(call("op-res-route")).rejects.toThrow(/production routing/);

    responseBody = {
      reservationId: RES,
      mode: "mock",
      phase: "ISSUED",
      provenance: "MOCK_GATE_ONLY",
      economicFinalityClaimed: false,
      chainIssued: true,
    };
    await expect(call("op-res-chain")).rejects.toThrow(/chain issuance/);

    responseBody = {
      reservationId: RES,
      mode: "mock",
      phase: "ISSUED",
      provenance: "MOCK_GATE_ONLY",
      economicFinalityClaimed: false,
      note: "ticket printed for entry",
    };
    await expect(call("op-res-copy")).rejects.toThrow(/production-admission wording/);

    responseBody = {
      admitted: true,
      gateId: "gate-main",
      proofMode: "stub",
      detail: "venue admitted",
    };
    await expect(call("op-adm-copy")).rejects.toThrow(/production-admission wording/);

    responseBody = {
      admitted: false,
      gateId: "gate-main",
      proofMode: "production",
      detail: "Simulated stub check. Not live admission.",
    };
    await expect(call("op-adm-proof")).rejects.toThrow(/proof mode/);

    responseBody = {
      admitted: false,
      rightsRef: "right_1",
      gateId: "gate-main",
      proofMode: "stub",
      detail: "Stub: unknown right.",
    };
    await expect(call("op-adm-ok")).resolves.toMatchObject({ proofMode: "stub", admitted: false });
  });
});
