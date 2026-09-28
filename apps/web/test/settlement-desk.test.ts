import { describe, expect, it } from "vitest";
import { StubProtocolAdapter } from "@kix/protocol-adapter";
import { runSettlementCommand, settlementIdFor, type AttemptStore } from "../src/settlement-desk";

function memoryAttempts(): AttemptStore & { values: Map<string, number> } {
  const values = new Map<string, number>();
  return {
    values,
    read: (settlementId) => values.get(settlementId) ?? 0,
    write: (settlementId, attempt) => {
      values.set(settlementId, attempt);
    },
  };
}

const EVENT = "evt_lanterns";

describe("box office settlement desk", () => {
  it("reaches COMMITTED after a mis-ordered click instead of replaying the rejection", async () => {
    const protocol = new StubProtocolAdapter();
    const attempts = memoryAttempts();
    const settlementId = settlementIdFor(EVENT);

    await runSettlementCommand(protocol, "initiate", EVENT, attempts);
    await expect(runSettlementCommand(protocol, "capture", EVENT, attempts)).rejects.toMatchObject({
      code: "ILLEGAL_TRANSITION",
    });
    expect(attempts.values.get(settlementId)).toBe(1);

    await runSettlementCommand(protocol, "authorize", EVENT, attempts);
    await runSettlementCommand(protocol, "capture", EVENT, attempts);
    await runSettlementCommand(protocol, "commit", EVENT, attempts);
    expect((await protocol.viewSettlement(settlementId)).phase).toBe("COMMITTED");
  });

  it("checks the case again on every reconcile click", async () => {
    const protocol = new StubProtocolAdapter();
    const attempts = memoryAttempts();
    const settlementId = settlementIdFor(EVENT);

    await runSettlementCommand(protocol, "initiate", EVENT, attempts);
    await runSettlementCommand(protocol, "reconcile", EVENT, attempts);
    await runSettlementCommand(protocol, "authorize", EVENT, attempts);
    await runSettlementCommand(protocol, "reconcile", EVENT, attempts);

    const view = await protocol.viewSettlement(settlementId);
    expect(view.phase).toBe("AUTHORIZED");
    expect(view.reconcileMatched).toBe(true);
    expect(view.idempotencyKey).toBe(`desk-reconcile:${settlementId}:1`);
    expect(attempts.values.get(settlementId)).toBe(2);
  });
});

describe("booking holds", () => {
  it("gives an abandoned hold's capacity back after it expires", async () => {
    let now = Date.parse("2026-10-01T00:00:00.000Z");
    const protocol = new StubProtocolAdapter(undefined, () => now);
    const [first] = await protocol.listPerformances();
    const before = first!.remainingCapacity;
    const hold = await protocol.placeHold({ eventId: first!.eventId, quantity: 2 });
    expect((await protocol.listPerformances())[0]!.remainingCapacity).toBe(before - 2);

    now += 11 * 60 * 1000;
    expect((await protocol.listPerformances())[0]!.remainingCapacity).toBe(before);
    await expect(protocol.confirmBooking(hold.holdId)).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
    await expect(protocol.releaseHold(hold.holdId)).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
    expect((await protocol.listPerformances())[0]!.remainingCapacity).toBe(before);
  });

  it("keeps a confirmed hold HOLD_NOT_ACTIVE", async () => {
    const protocol = new StubProtocolAdapter();
    const [first] = await protocol.listPerformances();
    const hold = await protocol.placeHold({ eventId: first!.eventId, quantity: 1 });
    await protocol.confirmBooking(hold.holdId);
    await expect(protocol.confirmBooking(hold.holdId)).rejects.toMatchObject({ code: "HOLD_NOT_ACTIVE" });
    await expect(protocol.releaseHold(hold.holdId)).rejects.toMatchObject({ code: "HOLD_NOT_ACTIVE" });
  });

  it("labels a hold that expired before confirm", async () => {
    let now = Date.parse("2026-10-01T00:00:00.000Z");
    const protocol = new StubProtocolAdapter(undefined, () => now);
    const [first] = await protocol.listPerformances();
    const hold = await protocol.placeHold({ eventId: first!.eventId, quantity: 1 });
    now += 11 * 60 * 1000;
    await expect(protocol.confirmBooking(hold.holdId)).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
  });
});
