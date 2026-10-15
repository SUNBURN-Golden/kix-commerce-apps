import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DISCOVERY_READ_TUPLE_LITERALS,
  PINNED_ACTIONS,
  REFUND_FLOW_LINES,
  REFUND_LINE_ACTIONS,
  REFUND_RETURN_NOT_BOUND_REASON,
  REFUND_RETURN_NOT_COMPOSED,
  REFUND_SCENARIOS,
  REFUND_STEPS,
  createNotBoundRefundReturn,
  createStubRefundReturn,
  isPinnedAction,
  isRefundRef,
  refundRefKind,
  type RefundScenario,
  type RefundStep,
  type RefundWriteRequest,
} from "../src/index.js";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ACTOR = "refund-desk";
const ORDER = "ord_evt-001";

function base(step: RefundStep, paymentRef = "pay-0001"): RefundWriteRequest {
  const request = {
    contextKey: "ctx",
    actorRef: ACTOR,
    intentRef: `i-${step}`,
    orderRef: ORDER,
    expectedVersion: 0,
  };
  return step === "adjust" || step === "refund" ? { ...request, step, paymentRef } : ({ ...request, step } as RefundWriteRequest);
}

async function readVersion(port: ReturnType<typeof createStubRefundReturn>): Promise<number> {
  const out = await port.read({ contextKey: "ctx", actorRef: ACTOR, orderRef: ORDER, watermarkFloor: null });
  if (out.kind !== "ready") {
    throw new Error(out.kind);
  }
  return out.snapshot.order.version;
}

async function write(port: ReturnType<typeof createStubRefundReturn>, step: RefundStep) {
  const version = await readVersion(port);
  const request = base(step);
  return port.submit({ ...request, expectedVersion: version });
}

describe("refund-return source", () => {
  it("seeds one case per order with five separate cells and five separate lines", async () => {
    const port = createStubRefundReturn();
    const out = await port.read({ contextKey: "ctx", actorRef: ACTOR, orderRef: ORDER, watermarkFloor: null });
    expect(out.kind).toBe("ready");
    if (out.kind !== "ready") return;
    const cells = out.snapshot.order.cells;
    expect(cells.reservation.state).toBe("confirmed");
    expect(cells.payment.state).toBe("observed");
    expect(cells.issuance.state).toBe("issued");
    expect(cells.returnRequired.state).toBe("none");
    expect(cells.refundDone.state).toBe("none");
    // A reservation cell is never a payment cell.
    expect(cells.reservation.state).not.toBe(cells.payment.state);
    for (const line of REFUND_FLOW_LINES) {
      expect(out.snapshot.order.lines[line]).toMatchObject({ state: "none", sent: false, executed: false });
    }
  });

  it("keeps each reference kind its own", () => {
    expect(refundRefKind(ORDER)).toBe("order");
    expect(refundRefKind("pay-0001")).toBe("payment");
    expect(refundRefKind("rfd-0001")).toBe("refund");
    expect(refundRefKind("rtn-0001")).toBe("return");
    expect(refundRefKind("vod-0001")).toBe("void");
    expect(refundRefKind("ccl-0001")).toBe("cancel");
    expect(refundRefKind("adj-0001")).toBe("adjust");
    expect(isRefundRef("pay-0001", "order")).toBe(false);
    expect(isRefundRef(ORDER, "order")).toBe(true);
  });

  it("records a refund against the observed payment without touching the return cell", async () => {
    const port = createStubRefundReturn();
    const out = await write(port, "refund");
    expect(out.kind).toBe("confirmed");
    expect(port.effects().refunds).toBe(1);
    const read = await port.read({ contextKey: "ctx", actorRef: ACTOR, orderRef: ORDER, watermarkFloor: null });
    if (read.kind !== "ready") throw new Error("read");
    expect(read.snapshot.order.cells.refundDone.state).toBe("recorded");
    expect(read.snapshot.order.cells.returnRequired.state).toBe("none");
    expect(read.snapshot.order.lines.refund).toMatchObject({ state: "recorded", executed: false });
    const again = await write(port, "refund");
    expect(again).toMatchObject({ kind: "rejected", code: "ALREADY_REFUNDED" });
    expect(port.effects().refunds).toBe(1);
  });

  it("marks a return required at the source and observes it as its own line", async () => {
    const port = createStubRefundReturn();
    await readVersion(port);
    expect(port.markReturnRequired(ORDER)).toEqual({ orderRef: ORDER });
    const out = await write(port, "observe-return");
    expect(out.kind).toBe("confirmed");
    const read = await port.read({ contextKey: "ctx", actorRef: ACTOR, orderRef: ORDER, watermarkFloor: null });
    if (read.kind !== "ready") throw new Error("read");
    expect(read.snapshot.order.cells.returnRequired.state).toBe("observed");
    // Observing a return records no refund: return-required is not a refund pre-stage.
    expect(read.snapshot.order.cells.refundDone.state).toBe("none");
    expect(read.snapshot.order.lines.refund.state).toBe("none");
  });

  it("refuses a cancel once a payment is observed and refuses a refund without one", async () => {
    const port = createStubRefundReturn();
    const cancel = await write(port, "cancel");
    expect(cancel).toMatchObject({ kind: "rejected", code: "CANCEL_AFTER_PAYMENT" });
    const held = createStubRefundReturn({ scenario: "held-only" });
    const refund = await write(held, "refund");
    expect(refund).toMatchObject({ kind: "rejected", code: "REFUND_UNAVAILABLE" });
    const adjust = await write(held, "adjust");
    expect(adjust).toMatchObject({ kind: "rejected", code: "PAYMENT_NOT_OBSERVED" });
    const cancelHeld = await write(held, "cancel");
    expect(cancelHeld.kind).toBe("confirmed");
    const read = await held.read({ contextKey: "ctx", actorRef: ACTOR, orderRef: ORDER, watermarkFloor: null });
    if (read.kind !== "ready") throw new Error("read");
    expect(read.snapshot.order.cells.reservation.state).toBe("cancelled");
    expect(read.snapshot.order.cells.payment.state).toBe("none");
  });

  it("records a void only while the order is paid and unissued", async () => {
    const unissued = createStubRefundReturn({ scenario: "unissued" });
    const v = await write(unissued, "void");
    expect(v.kind).toBe("confirmed");
    const issued = createStubRefundReturn();
    const v2 = await write(issued, "void");
    expect(v2).toMatchObject({ kind: "rejected", code: "VOID_UNAVAILABLE" });
  });

  it("records an adjustment against the payment observation and refuses a second", async () => {
    const port = createStubRefundReturn();
    expect((await write(port, "adjust")).kind).toBe("confirmed");
    expect(await write(port, "adjust")).toMatchObject({ kind: "rejected", code: "ALREADY_RECORDED" });
  });

  it("keeps refund-recorded and return-required as separate states", async () => {
    const port = createStubRefundReturn({ scenario: "refund-recorded" });
    const out = await port.read({ contextKey: "ctx", actorRef: ACTOR, orderRef: ORDER, watermarkFloor: null });
    if (out.kind !== "ready") throw new Error("read");
    expect(out.snapshot.order.cells.refundDone.state).toBe("recorded");
    expect(out.snapshot.order.cells.returnRequired.state).toBe("required");
  });

  it("serves empty and stale reads, and refuses a claim-bearing payload", async () => {
    const empty = createStubRefundReturn({ scenario: "empty" });
    expect((await empty.read({ contextKey: "c", actorRef: ACTOR, orderRef: ORDER, watermarkFloor: null })).kind).toBe("empty");
    const stale = createStubRefundReturn({ scenario: "stale" });
    expect((await stale.read({ contextKey: "c", actorRef: ACTOR, orderRef: ORDER, watermarkFloor: null })).kind).toBe("stale");
    const claims = createStubRefundReturn({ scenario: "claims-real" });
    const refused = await claims.read({ contextKey: "c", actorRef: ACTOR, orderRef: ORDER, watermarkFloor: null });
    expect(refused).toMatchObject({ kind: "refused", code: "CLAIM", field: "realPayment" });
    const bad = createStubRefundReturn();
    expect((await bad.read({ contextKey: "c", actorRef: ACTOR, orderRef: "pay-0001", watermarkFloor: null })).kind).toBe("refused");
  });

  it("applies a refund in refund-lost but answers unknown, and the late result is evidence only", async () => {
    const port = createStubRefundReturn({ scenario: "refund-lost" });
    const out = await write(port, "refund");
    expect(out.kind).toBe("unknown");
    expect(port.effects().refunds).toBe(1);
    const due = port.deliverLate();
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ result: "confirmed", step: "refund" });
  });

  it("holds answers in held-response until delivered", async () => {
    const port = createStubRefundReturn({ scenario: "held-response" });
    const version = await readVersion(port);
    const pending = port.submit({ ...base("refund"), expectedVersion: version });
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(port.deliverHeld()).toBe(1);
    expect((await pending).kind).toBe("confirmed");
  });

  it("rejects stale versions and unknown orders", async () => {
    const port = createStubRefundReturn();
    await readVersion(port);
    expect(await port.submit({ ...base("refund"), expectedVersion: 0 })).toMatchObject({ kind: "rejected", code: "VERSION_STALE" });
    expect(await port.submit({ ...base("cancel"), orderRef: "ord_other" })).toMatchObject({ kind: "rejected", code: "UNKNOWN_REF" });
    expect(await port.submit({ ...base("refund"), orderRef: "not-a-ref", expectedVersion: 1 })).toMatchObject({ kind: "invalid-request" });
  });

  it("stays not-bound on integration-http with no stub fallback", async () => {
    const port = createNotBoundRefundReturn();
    expect((await port.read({ contextKey: "c", actorRef: ACTOR, orderRef: ORDER, watermarkFloor: null }))).toEqual({
      kind: "not-bound",
      reason: REFUND_RETURN_NOT_BOUND_REASON,
    });
    expect(await port.submit(base("refund"))).toEqual({ kind: "not-bound", reason: REFUND_RETURN_NOT_BOUND_REASON });
    expect(port.markReturnRequired(ORDER)).toBeNull();
  });

  it("records the pinned refund-family commands as not composed", () => {
    const actions = REFUND_RETURN_NOT_COMPOSED.map((entry) => entry.action);
    for (const action of ["refund_ticket", "void_unissued", "adjust_pg_cancel", "observe_return"]) {
      expect(actions).toContain(action);
      expect(isPinnedAction(action as never)).toBe(true);
    }
    expect(REFUND_LINE_ACTIONS.cancel).toBeNull();
    for (const pinned of PINNED_ACTIONS) {
      expect(REFUND_STEPS).not.toContain(pinned);
    }
    const pin = JSON.parse(
      readFileSync(path.join(pkgRoot, "vendor/kix-protocol.contract-only.openapi.json"), "utf8"),
    ) as { components: { schemas: Record<string, { properties?: Record<string, unknown> }> } };
    for (const row of pin.components.schemas ? Object.keys(pin.components.schemas) : []) {
      void row;
    }
    expect(Object.keys(pin.components.schemas.refund_ticket.properties ?? {}).sort()).toEqual(["domain", "expectedVersion", "ticketId"]);
    expect(Object.keys(pin.components.schemas.void_unissued.properties ?? {}).sort()).toEqual(["domain", "ticketId"]);
  });

  it("checks the pin tuple on read and write", async () => {
    const port = createStubRefundReturn({ expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, domain: "kix:other" } });
    expect((await port.read({ contextKey: "c", actorRef: ACTOR, orderRef: ORDER, watermarkFloor: null })).kind).toBe("tuple-changed");
    expect((await port.submit(base("cancel"))).kind).toBe("tuple-changed");
  });

  it("covers every scenario name", () => {
    expect([...REFUND_SCENARIOS]).toEqual([
      "clean",
      "held-only",
      "unissued",
      "returned",
      "refund-recorded",
      "empty",
      "stale",
      "refund-lost",
      "held-response",
      "claims-real",
      "receipt-claims",
    ]);
    const seen = new Set<RefundScenario>(REFUND_SCENARIOS);
    expect(seen.size).toBe(REFUND_SCENARIOS.length);
  });
});
