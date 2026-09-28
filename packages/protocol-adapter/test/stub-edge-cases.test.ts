import { describe, expect, it } from "vitest";
import {
  CREDIT_REFERENCES,
  RESERVATION_REFERENCES,
  SETTLEMENT_REFERENCES,
  StubProtocolAdapter,
} from "../src/index.js";

const SHOW = "show_evt_lanterns";
const EVENT = "evt_lanterns";
const RES = "rsv_evt_lanterns";
const ORDER = "ord_evt_lanterns";
const ISSUE = "iss_evt_lanterns";
const SLOT = "slot-0";
const HOLDER = "buyer-1";

async function issueRight(adapter: StubProtocolAdapter) {
  await adapter.registerReservationShow({ showId: SHOW, eventId: EVENT, idempotencyKey: "show-1", slots: [SLOT] });
  await adapter.holdReservation({
    reservationId: RES,
    showId: SHOW,
    slot: SLOT,
    buyerRole: HOLDER,
    expiresAt: "2099-01-01T00:00:00.000Z",
    idempotencyKey: "hold-1",
  });
  await adapter.confirmReservation({ orderId: ORDER, reservationId: RES, idempotencyKey: "confirm-1" });
  await adapter.observeReservationPayment({ orderId: ORDER, idempotencyKey: "pay-1", paymentRef: "mock-noted" });
  await adapter.issueReservation({ issuanceId: ISSUE, orderId: ORDER, idempotencyKey: "issue-1" });
}

describe("stub admission delegate keys", () => {
  it("authorizes and consumes with the longest admission key the desk accepts", async () => {
    const adapter = new StubProtocolAdapter();
    await issueRight(adapter);
    await adapter.adoptAdmissionIssued({ rightId: ISSUE, reservationId: RES, idempotencyKey: "adopt-1" });
    const authorized = await adapter.authorizeAdmissionCredential({
      admissionId: "adm-long",
      rightId: ISSUE,
      version: 1,
      holderRole: HOLDER,
      gateRole: "gate-a",
      request: "desk-request",
      expiresAt: "2099-06-01T00:00:00.000Z",
      idempotencyKey: "a".repeat(100),
    });
    expect(authorized.credential?.phase).toBe("AUTHORIZED");
    expect((await adapter.viewReservation(RES)).phase).toBe("ADMISSION_AUTHORIZED");

    const consumed = await adapter.consumeAdmissionCredential({
      consumeId: "csm-long",
      rightId: ISSUE,
      version: 1,
      gateRole: "gate-a",
      request: "desk-request",
      idempotencyKey: "c".repeat(90),
    });
    expect(consumed.credential?.phase).toBe("CONSUMED");
    expect((await adapter.viewReservation(RES)).phase).toBe("CONSUMED");
  });
});

describe("stub reservation slots", () => {
  it("rejects a slot name with a comma instead of splitting it", async () => {
    const adapter = new StubProtocolAdapter();
    await expect(
      adapter.registerReservationShow({ showId: SHOW, eventId: EVENT, idempotencyKey: "show-1", slots: ["a,b"] }),
    ).rejects.toMatchObject({ code: "INVALID_ID" });
    await expect(adapter.viewReservationShow(SHOW)).rejects.toThrow();
  });
});

describe("stub views do not share reference arrays", () => {
  it("keeps the exported references frozen and each view's copy separate", async () => {
    for (const references of [SETTLEMENT_REFERENCES, RESERVATION_REFERENCES, CREDIT_REFERENCES]) {
      expect(Object.isFrozen(references)).toBe(true);
    }

    const adapter = new StubProtocolAdapter();
    await adapter.initiateSettlement({ settlementId: "stl-1", eventId: EVENT, idempotencyKey: "init-1" });
    const first = await adapter.viewSettlement("stl-1");
    (first.references as unknown as string[]).push("X99");
    expect((await adapter.viewSettlement("stl-1")).references).toEqual(["F01", "F02", "F03"]);

    await issueRight(adapter);
    const reservation = await adapter.viewReservation(RES);
    (reservation.references as unknown as string[]).length = 0;
    expect((await adapter.viewReservation(RES)).references).toEqual(["B01", "B02", "B03", "B04", "B05"]);
  });
});
