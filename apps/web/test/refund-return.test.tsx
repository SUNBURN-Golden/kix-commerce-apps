import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  REFUND_FLOW_LINES,
  REFUND_RETURN_DESK_ACTOR,
  REFUND_RETURN_NOT_BOUND_REASON,
  RefundReturnController,
  createNotBoundRefundReturn,
  createStubRefundReturn,
  type RefundScenario,
  type RefundStepResult,
} from "@kix/protocol-adapter";
import { buildRefundReturnModel, refundFenceLine, refundStepResultLine, type RefundLastAction } from "../src/refund-return";
import { RefundReturnPanel } from "../src/pages/RefundReturnPanel";
import { BuyerPage } from "../src/pages/Buyer";
import { OUTCOME_TRACKS, WORKSPACE_SURFACES } from "../src/workspace/registry";

const ORDER = "ord_evt-001";

const POSITIVE_CLAIMS = [
  "Payment complete",
  "Refund complete",
  "Refunded",
  "Settled",
  "Completed",
  "funds moved",
];

function rig(scenario: RefundScenario = "clean") {
  const port = createStubRefundReturn({ scenario });
  return { port, controller: new RefundReturnController(port, { actorRef: REFUND_RETURN_DESK_ACTOR, orderRef: ORDER }) };
}

function live(controller: RefundReturnController | null, scenario: RefundScenario = "clean", last: RefundLastAction | null = null) {
  const model = buildRefundReturnModel({ controller, last, hasOrder: true });
  return {
    environment: "stub" as const,
    scenario,
    orderRef: ORDER,
    model,
    heldSupported: scenario === "held-response",
    lateSupported: scenario === "refund-lost",
    actions: {
      refresh() {},
      write() {},
      markReturnRequired() {},
      deliverHeld() {},
      deliverLate() {},
      switchContext() {},
      newSession() {},
      setScenario() {},
    },
  };
}

function markup(liveArgs: ReturnType<typeof live>, variant: "booking" | "settlement" | "buyer" = "booking") {
  return renderToStaticMarkup(
    <MemoryRouter>
      <RefundReturnPanel live={liveArgs} variant={variant} />
    </MemoryRouter>,
  );
}

async function readyModel(scenario: RefundScenario = "clean", run?: (c: RefundReturnController) => Promise<void>) {
  const { controller } = rig(scenario);
  await controller.refresh();
  if (run) {
    await run(controller);
    await controller.refresh();
  }
  return controller;
}

describe("refund-return desk", () => {
  it("shows reservation, payment, issuance, return-required, and refund-done as five separate cells", async () => {
    const controller = await readyModel();
    const page = markup(live(controller));
    const tracks = [...page.matchAll(/data-track="([^"]+)"/g)].map((m) => m[1]);
    expect(tracks).toEqual(["reservation", "payment", "issuance", "return-required", "refund-done"]);
    // A reservation is never shown as a payment or a refund.
    const reservationCell = page.match(/data-track="reservation"[\s\S]*?<\/li\b[^>]*>/)![0];
    const paymentCell = page.match(/data-track="payment"[\s\S]*?<\/li\b[^>]*>/)![0];
    expect(reservationCell).toContain("confirmed");
    expect(reservationCell).toContain("not a payment");
    expect(reservationCell).not.toContain("observed");
    expect(paymentCell).toContain("observed");
    expect(paymentCell).not.toContain("confirmed");
    expect(page).toContain("return-required");
    expect(page).toContain("refund-done");
    for (const claim of POSITIVE_CLAIMS) {
      expect(page, claim).not.toContain(claim);
    }
  });

  it("shows cancel, void, adjustment, return observation, and refund as five separate lines", async () => {
    const controller = await readyModel();
    const page = markup(live(controller));
    const lines = [...page.matchAll(/data-line="([^"]+)"/g)].map((m) => m[1]);
    expect(lines).toEqual([...REFUND_FLOW_LINES]);
    expect(page).toContain("refund_ticket is recorded and not sent.");
    expect(page).toContain("void_unissued is recorded and not sent.");
    expect(page).toContain("adjust_pg_cancel is recorded and not sent.");
    expect(page).toContain("observe_return is recorded and not sent.");
    expect(page).toContain("No pinned booking-cancel command exists.");
  });

  it("records a refund on its own line and keeps return-required a separate state", async () => {
    const controller = await readyModel("refund-recorded");
    const page = markup(live(controller));
    const refundCell = page.match(/data-track="refund-done"[\s\S]*?<\/li\b[^>]*>/)![0];
    const returnCell = page.match(/data-track="return-required"[\s\S]*?<\/li\b[^>]*>/)![0];
    expect(refundCell).toContain("recorded");
    expect(returnCell).toContain("required");
    expect(page).toContain("Return-required is its own state");
  });

  it("renders empty, stale, refused, and not-bound states distinctly", async () => {
    for (const [scenario, word] of [
      ["empty", "No refund case"],
      ["stale", "Stale refund read"],
      ["claims-real", "refused whole"],
    ] as const) {
      const controller = await readyModel(scenario);
      const page = markup(live(controller, scenario));
      expect(page).toContain(word);
      expect(page).not.toContain("refund-done — recorded");
    }
    const bound = new RefundReturnController(createNotBoundRefundReturn(), { actorRef: REFUND_RETURN_DESK_ACTOR, orderRef: ORDER });
    await bound.refresh();
    const boundPage = markup(live(bound));
    expect(boundPage).toContain(REFUND_RETURN_NOT_BOUND_REASON);
    expect(boundPage).toContain('data-refund-state="not-bound"');
  });

  it("keeps an in-flight write and an unknown answer visible and fenced", async () => {
    const { port, controller } = rig("held-response");
    await controller.refresh();
    const pending = controller.run({ step: "refund", intentRef: "i1" });
    const inflight = markup(live(controller, "held-response"));
    expect(inflight).toContain("In flight");
    expect(inflight).toContain('data-write="in-flight"');
    port.deliverHeld();
    await pending;

    const lost = await readyModel("refund-lost", async (c) => {
      const result: RefundStepResult = await c.run({ step: "refund", intentRef: "i1" });
      expect(result.kind).toBe("UNKNOWN");
    });
    const page = markup(live(lost, "refund-lost"));
    expect(page).toContain("Unknown");
    expect(page).toContain('data-write="unknown"');
    expect(page).toContain("unknown result");
  });

  it("names the fence reason on a guarded control instead of dropping it from the keyboard order", async () => {
    const controller = await readyModel("held-only");
    const page = markup(live(controller, "held-only"));
    expect(page).toContain('aria-disabled="true"');
    expect(page).toContain("aria-describedby");
    expect(page).toContain(refundFenceLine({ reason: "payment-unobserved", orderRef: ORDER }));
    const clean = await readyModel();
    const cleanPage = markup(live(clean));
    expect(cleanPage).toContain(refundFenceLine({ reason: "already-issued", orderRef: ORDER }));
    expect(cleanPage).toContain(refundFenceLine({ reason: "cancel-closed", orderRef: ORDER }));
  });

  it("renders read-only on the buyer workspace and full controls on booking and settlement", async () => {
    const controller = await readyModel();
    const buyer = markup(live(controller), "buyer");
    expect(buyer).not.toContain("Record refund");
    expect(buyer).toContain("refund-done");
    const booking = markup(live(controller), "booking");
    expect(booking).toContain("Record refund");
    const settlement = markup(live(controller), "settlement");
    expect(settlement).toContain("Record refund");
    // The buyer workspace mounts the read-only panel on its page.
    const buyerPage = renderToStaticMarkup(
      <MemoryRouter>
        <BuyerPage />
      </MemoryRouter>,
    );
    expect(buyerPage).toContain('data-refund-variant="buyer"');
  });

  it("keeps the surface registered and the step result text free of completion claims", () => {
    const surface = WORKSPACE_SURFACES.find((row) => row.id === "refund-return-desk");
    expect(surface?.taskId).toBe("c-refund-return-states-stub");
    expect(surface?.binding).toBe("stub-only");
    expect(OUTCOME_TRACKS).toContain("return-required");
    expect(OUTCOME_TRACKS).toContain("refund-done");
    const line = refundStepResultLine("refund", {
      kind: "CONFIRMED",
      intent: {
        seq: 1,
        intentRef: "i1",
        step: "refund",
        scope: ORDER,
        contextKey: "k",
        outcome: "CONFIRMED",
        code: null,
        message: null,
        refs: null,
        late: null,
      },
    });
    expect(line).toContain("not a real refund");
    for (const claim of POSITIVE_CLAIMS) {
      expect(line).not.toContain(claim);
    }
  });
});
