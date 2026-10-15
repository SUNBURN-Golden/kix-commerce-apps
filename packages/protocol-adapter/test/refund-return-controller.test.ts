import { describe, expect, it } from "vitest";
import {
  REFUND_RETURN_DESK_ACTOR,
  RefundReturnController,
  createNotBoundRefundReturn,
  createStubRefundReturn,
  projectRefundReturn,
  type RefundReturnPort,
  type RefundScenario,
} from "../src/index.js";

const ORDER = "ord_evt-001";

function rig(scenario: RefundScenario = "clean") {
  const port = createStubRefundReturn({ scenario });
  return { port, controller: new RefundReturnController(port, { actorRef: REFUND_RETURN_DESK_ACTOR, orderRef: ORDER }) };
}

describe("refund-return controller", () => {
  it("fences every write before the first read and after an own-write until a refresh", async () => {
    const { controller } = rig("clean");
    expect(controller.gateFor({ step: "refund", intentRef: "i1" })).toEqual({ reason: "no-snapshot" });
    await controller.refresh();
    expect(controller.gateFor({ step: "refund", intentRef: "i1" })).toBeNull();
    expect(await controller.run({ step: "refund", intentRef: "i1" })).toMatchObject({ kind: "CONFIRMED" });
    expect(controller.gateFor({ step: "adjust", intentRef: "i2" })).toEqual({ reason: "snapshot-stale", cause: "own-write" });
    await controller.refresh();
    expect(controller.gateFor({ step: "adjust", intentRef: "i2" })).toBeNull();
  });

  it("keeps the five cells and the five lines apart in the projection", async () => {
    const { controller } = rig("clean");
    await controller.refresh();
    let projection = projectRefundReturn(controller.state());
    expect(projection.order?.cells.reservation.state).toBe("confirmed");
    expect(projection.order?.cells.payment.state).toBe("observed");
    expect(projection.order?.cells.returnRequired.state).toBe("none");
    expect(projection.order?.lines.refund.observed.state).toBe("none");
    await controller.run({ step: "refund", intentRef: "i1" });
    await controller.refresh();
    projection = projectRefundReturn(controller.state());
    expect(projection.order?.lines.refund).toMatchObject({ outcome: "CONFIRMED", observed: { state: "recorded" } });
    expect(projection.order?.cells.refundDone.state).toBe("recorded");
    expect(projection.order?.cells.returnRequired.state).toBe("none");
    expect(projection.order?.lines.cancel.observed.state).toBe("none");
  });

  it("fences the order after an unknown write and records a late result as evidence only", async () => {
    const { port, controller } = rig("refund-lost");
    await controller.refresh();
    expect(await controller.run({ step: "refund", intentRef: "i1" })).toMatchObject({ kind: "UNKNOWN" });
    await controller.refresh();
    const fence = controller.gateFor({ step: "adjust", intentRef: "i2" });
    expect(fence).toMatchObject({ reason: "unknown-outcome", intentRef: "i1" });
    const due = port.deliverLate();
    expect(controller.acceptLate(due[0])).toMatchObject({ kind: "RECORDED" });
    expect(controller.gateFor({ step: "adjust", intentRef: "i2" })).toMatchObject({ reason: "unknown-outcome", lateRecorded: true });
  });

  it("serialises writes on the order and never resends an intent", async () => {
    const { port, controller } = rig("held-response");
    await controller.refresh();
    const first = controller.run({ step: "adjust", intentRef: "i1" });
    expect(controller.gateFor({ step: "refund", intentRef: "i2" })).toMatchObject({ reason: "in-flight", intentRef: "i1" });
    port.deliverHeld();
    expect(await first).toMatchObject({ kind: "CONFIRMED" });
    expect(port.effects().submits).toBe(1);
  });

  it("quarantines a result that lands after the context switched", async () => {
    const { port, controller } = rig("held-response");
    await controller.refresh();
    const first = controller.run({ step: "adjust", intentRef: "i1" });
    controller.switchContext();
    port.deliverHeld();
    expect(await first).toMatchObject({ kind: "QUARANTINED" });
    expect(controller.state().quarantined).toHaveLength(1);
  });

  it("fences refund and adjust until a payment observation, and observe-return until a required return", async () => {
    const { controller } = rig("held-only");
    await controller.refresh();
    expect(controller.gateFor({ step: "refund", intentRef: "i1" })).toMatchObject({ reason: "payment-unobserved" });
    expect(controller.gateFor({ step: "observe-return", intentRef: "i1" })).toMatchObject({ reason: "return-not-required" });
    expect(controller.gateFor({ step: "cancel", intentRef: "i1" })).toBeNull();
  });

  it("fences a void once the order is issued, and a cancel once it is paid", async () => {
    const { controller } = rig("clean");
    await controller.refresh();
    expect(controller.gateFor({ step: "void", intentRef: "i1" })).toMatchObject({ reason: "already-issued" });
    expect(controller.gateFor({ step: "cancel", intentRef: "i1" })).toMatchObject({ reason: "cancel-closed" });
  });

  it("stays not-bound on integration-http and sends nothing", async () => {
    const port: RefundReturnPort = createNotBoundRefundReturn();
    const controller = new RefundReturnController(port, { actorRef: REFUND_RETURN_DESK_ACTOR, orderRef: ORDER });
    await controller.refresh();
    expect(controller.state().readState).toBe("not-bound");
    expect(controller.gateFor({ step: "refund", intentRef: "i1" })).toEqual({ reason: "not-bound" });
    expect(await controller.run({ step: "refund", intentRef: "i1" })).toMatchObject({ kind: "FENCED" });
    expect(controller.state().counters.sent).toBe(0);
  });

  it("marks an untrusted confirmed answer unknown", async () => {
    const { controller } = rig("receipt-claims");
    await controller.refresh();
    expect(await controller.run({ step: "refund", intentRef: "i1" })).toMatchObject({ kind: "UNKNOWN" });
    expect(controller.state().intents[0]?.code).toBe("UNTRUSTED_RECEIPT");
  });
});
