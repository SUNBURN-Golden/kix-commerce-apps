import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  CONTRACT_ONLY_LOCAL_CALL_PATH,
  HttpProtocolAdapter,
  PINNED_PROTOCOL_DOMAIN,
  ProtocolError,
  SETTLEMENT_CASE_NOTE,
  SETTLEMENT_DEPTH_BASELINE,
  StubProtocolAdapter,
  isPinnedAction,
} from "../src/index.js";

const BANNED_COPY = [/charged/i, /paid out/i, /bank settled/i, /live capture/i, /toss/i, /portone/i];

describe("stub settlement case", () => {
  it("walks the mock phases without amounts or executed funds", async () => {
    const protocol = new StubProtocolAdapter();
    const settlementId = "stl_evt_lanterns";

    const opened = await protocol.initiateSettlement({
      settlementId,
      eventId: "evt_lanterns",
      idempotencyKey: "init-1",
    });
    expect(opened.duplicate).toBe(false);
    expect(opened.applied).toBe("initiate");
    expect(opened.idempotencyKey).toBe("init-1");
    expect(opened.provenance).toBe("MOCK_SETTLEMENT_ONLY");
    expect(opened.externalPayment).toBe("UNSUPPORTED");
    expect(opened.fundsExecuted).toBe(false);
    expect(opened.settlement.phase).toBe("INITIATED");
    expect(opened.settlement.terminal).toBe(false);
    expect(opened.settlement.mode).toBe("mock");
    expect(opened.settlement.surface).toBe("wave3.settlement.F01-F03.fsm");
    expect(opened.settlement.references).toEqual(["F01", "F02", "F03"]);
    expect(opened.settlement.lifecycleAuthority).toBe("IN_MEMORY_FSM");
    expect(opened.settlement.providerAuthorizationExecuted).toBe(false);
    expect(opened.settlement.reconcileMatched).toBeNull();
    expect(opened.settlement.note).toBe(SETTLEMENT_CASE_NOTE);
    expect(opened.settlement).not.toHaveProperty("amount");
    expect(opened.settlement).not.toHaveProperty("currency");
    expect(opened.settlement).not.toHaveProperty("gross");
    for (const pattern of BANNED_COPY) {
      expect(opened.settlement.note).not.toMatch(pattern);
    }

    const authorized = await protocol.authorizeSettlement({ settlementId, idempotencyKey: "auth-1" });
    expect(authorized.settlement.phase).toBe("AUTHORIZED");
    expect(authorized.settlement.providerAuthorizationExecuted).toBe(false);
    expect(authorized.fundsExecuted).toBe(false);

    const captured = await protocol.captureSettlement({ settlementId, idempotencyKey: "cap-1" });
    expect(captured.applied).toBe("capture");
    expect(captured.settlement.phase).toBe("CAPTURED");
    expect(captured.settlement.terminal).toBe(false);

    const committed = await protocol.commitSettlement({ settlementId, idempotencyKey: "commit-1" });
    expect(committed.settlement.phase).toBe("COMMITTED");
    expect(committed.settlement.terminal).toBe(false);
    expect(committed.settlement.fundsExecuted).toBe(false);

    await expect(protocol.commitSettlement({ settlementId, idempotencyKey: "commit-2" })).rejects.toMatchObject({
      code: "ILLEGAL_TRANSITION",
    });
    expect((await protocol.viewSettlement(settlementId)).phase).toBe("COMMITTED");

    const report = await protocol.reconcileSettlement({ settlementId, idempotencyKey: "recon-1" });
    expect(report.matched).toBe(true);
    expect(report.duplicate).toBe(false);
    expect(report.applied).toBe("reconcile");
    expect(report.idempotencyKey).toBe("recon-1");
    expect(report.settlement.phase).toBe("COMMITTED");
    expect(report.settlement.reconcileMatched).toBe(true);
    expect(report.fundsExecuted).toBe(false);

    const replayed = await protocol.reconcileSettlement({ settlementId, idempotencyKey: "recon-1" });
    expect(replayed.duplicate).toBe(true);
    expect(replayed.applied).toBeNull();
    expect(replayed.matched).toBe(true);

    const live = await protocol.viewSettlement(settlementId);
    expect(live.phase).toBe("COMMITTED");
    expect(live.reconcileMatched).toBe(true);
    expect(live.idempotencyKey).toBe("recon-1");
    expect(live.terminal).toBe(false);

    await expect(protocol.viewSettlement("stl_evt_paper_orchestra")).rejects.toMatchObject({
      code: "UNKNOWN_SETTLEMENT",
    });
    expect(protocol.describe().surfaces).toContain("wave3.settlement.F01-F03.fsm");
    expect(protocol.describe().fundsMovement).toBe("none");
  });

  it("rejects illegal transitions without moving the phase", async () => {
    const protocol = new StubProtocolAdapter();
    const settlementId = "stl_evt_lanterns";
    await protocol.initiateSettlement({
      settlementId,
      eventId: "evt_lanterns",
      idempotencyKey: "init-1",
    });

    await expect(protocol.captureSettlement({ settlementId, idempotencyKey: "cap-early" })).rejects.toMatchObject({
      code: "ILLEGAL_TRANSITION",
    });
    await expect(protocol.captureSettlement({ settlementId, idempotencyKey: "cap-early" })).rejects.toMatchObject({
      code: "ILLEGAL_TRANSITION",
    });
    await expect(protocol.commitSettlement({ settlementId, idempotencyKey: "commit-early" })).rejects.toMatchObject({
      code: "ILLEGAL_TRANSITION",
    });
    expect((await protocol.viewSettlement(settlementId)).phase).toBe("INITIATED");
    expect((await protocol.viewSettlement(settlementId)).lastRejectCode).toBe("ILLEGAL_TRANSITION");

    await protocol.authorizeSettlement({ settlementId, idempotencyKey: "auth-1" });
    await protocol.captureSettlement({ settlementId, idempotencyKey: "cap-1" });
    await expect(
      protocol.cancelSettlement({ settlementId, idempotencyKey: "cancel-late", reason: "TOO_LATE" }),
    ).rejects.toMatchObject({ code: "ILLEGAL_TRANSITION" });
    await expect(
      protocol.failSettlement({ settlementId, idempotencyKey: "fail-late", reason: "TOO_LATE" }),
    ).rejects.toMatchObject({ code: "ILLEGAL_TRANSITION" });
    const captured = await protocol.viewSettlement(settlementId);
    expect(captured.phase).toBe("CAPTURED");
    expect(captured.failureReason).toBeNull();
    expect(captured.cancelReason).toBeNull();

    await expect(protocol.viewSettlement("missing-case")).rejects.toBeInstanceOf(ProtocolError);
    await expect(protocol.viewSettlement("missing-case")).rejects.toMatchObject({ code: "UNKNOWN_SETTLEMENT" });
  });

  it("keeps failed and cancelled cases immutable", async () => {
    const protocol = new StubProtocolAdapter();
    const failedId = "stl_evt_lanterns";
    await protocol.initiateSettlement({
      settlementId: failedId,
      eventId: "evt_lanterns",
      idempotencyKey: "init-fail",
    });
    await protocol.authorizeSettlement({ settlementId: failedId, idempotencyKey: "auth-fail" });
    const failed = await protocol.failSettlement({
      settlementId: failedId,
      idempotencyKey: "fail-1",
      reason: "FIXTURE_DECLINE",
    });
    expect(failed.settlement.phase).toBe("FAILED");
    expect(failed.settlement.terminal).toBe(true);
    expect(failed.settlement.failureReason).toBe("FIXTURE_DECLINE");
    expect(failed.settlement.providerAuthorizationExecuted).toBe(false);
    expect(failed.fundsExecuted).toBe(false);

    const failedAgain = await protocol.failSettlement({
      settlementId: failedId,
      idempotencyKey: "fail-1",
      reason: "FIXTURE_DECLINE",
    });
    expect(failedAgain.duplicate).toBe(true);
    expect(failedAgain.applied).toBeNull();
    expect(failedAgain.settlement.failureReason).toBe("FIXTURE_DECLINE");

    for (const command of [
      () => protocol.authorizeSettlement({ settlementId: failedId, idempotencyKey: "auth-again" }),
      () => protocol.captureSettlement({ settlementId: failedId, idempotencyKey: "cap-again" }),
      () => protocol.commitSettlement({ settlementId: failedId, idempotencyKey: "commit-again" }),
      () => protocol.cancelSettlement({ settlementId: failedId, idempotencyKey: "cancel-again", reason: "NO" }),
      () =>
        protocol.initiateSettlement({
          settlementId: failedId,
          eventId: "evt_lanterns",
          idempotencyKey: "init-again",
        }),
    ]) {
      await expect(command()).rejects.toMatchObject({ code: "TERMINAL_IMMUTABLE" });
    }

    const after = await protocol.viewSettlement(failedId);
    expect(after.phase).toBe("FAILED");
    expect(after.terminal).toBe(true);
    expect(after.failureReason).toBe("FIXTURE_DECLINE");
    expect(after.lastRejectCode).toBe("TERMINAL_IMMUTABLE");

    const report = await protocol.reconcileSettlement({ settlementId: failedId, idempotencyKey: "recon-fail" });
    expect(report.matched).toBe(true);
    expect(report.settlement.phase).toBe("FAILED");
    expect((await protocol.viewSettlement(failedId)).phase).toBe("FAILED");

    const cancelledId = "stl_evt_paper_orchestra";
    await protocol.initiateSettlement({
      settlementId: cancelledId,
      eventId: "evt_paper_orchestra",
      idempotencyKey: "init-cancel",
    });
    const cancelled = await protocol.cancelSettlement({
      settlementId: cancelledId,
      idempotencyKey: "cancel-1",
      reason: "FIXTURE_WITHDRAW",
    });
    expect(cancelled.settlement.phase).toBe("CANCELLED");
    expect(cancelled.settlement.terminal).toBe(true);
    expect(cancelled.settlement.cancelReason).toBe("FIXTURE_WITHDRAW");
    expect(cancelled.settlement.failureReason).toBeNull();
    await expect(
      protocol.authorizeSettlement({ settlementId: cancelledId, idempotencyKey: "auth-cancel" }),
    ).rejects.toMatchObject({ code: "TERMINAL_IMMUTABLE" });
    expect((await protocol.viewSettlement(cancelledId)).phase).toBe("CANCELLED");
  });

  it("replays the same idempotency key and rejects a different body", async () => {
    const protocol = new StubProtocolAdapter();
    const settlementId = "stl_evt_lanterns";
    const first = await protocol.initiateSettlement({
      settlementId,
      eventId: "evt_lanterns",
      idempotencyKey: "init-1",
    });
    const again = await protocol.initiateSettlement({
      settlementId,
      eventId: "evt_lanterns",
      idempotencyKey: "init-1",
    });
    expect(again.duplicate).toBe(true);
    expect(again.applied).toBeNull();
    expect(again.idempotencyKey).toBe("init-1");
    expect(again.settlement.phase).toBe(first.settlement.phase);
    expect(again.settlement.eventId).toBe("evt_lanterns");
    expect((await protocol.viewSettlement(settlementId)).phase).toBe("INITIATED");

    await expect(
      protocol.initiateSettlement({
        settlementId,
        eventId: "evt_paper_orchestra",
        idempotencyKey: "init-1",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    const unchanged = await protocol.viewSettlement(settlementId);
    expect(unchanged.eventId).toBe("evt_lanterns");
    expect(unchanged.phase).toBe("INITIATED");
    expect(unchanged.lastRejectCode).toBe("IDEMPOTENCY_CONFLICT");

    await expect(
      protocol.initiateSettlement({
        settlementId,
        eventId: "evt_lanterns",
        idempotencyKey: "init-2",
      }),
    ).rejects.toMatchObject({ code: "ILLEGAL_TRANSITION" });
    expect((await protocol.viewSettlement(settlementId)).phase).toBe("INITIATED");

    await expect(
      protocol.initiateSettlement({
        settlementId,
        eventId: "evt_lanterns",
        idempotencyKey: " ",
      }),
    ).rejects.toMatchObject({ code: "INVALID_ID" });
    expect((await protocol.viewSettlement(settlementId)).phase).toBe("INITIATED");

    await expect(
      protocol.initiateSettlement({
        settlementId: "stl_missing",
        eventId: "evt_missing",
        idempotencyKey: "init-missing",
      }),
    ).rejects.toThrow(/Unknown performance/);
    await expect(protocol.viewSettlement("stl_missing")).rejects.toMatchObject({ code: "UNKNOWN_SETTLEMENT" });

    await protocol.authorizeSettlement({ settlementId, idempotencyKey: "auth-1" });
    const lost = await protocol.authorizeSettlement({ settlementId, idempotencyKey: "auth-1" });
    expect(lost.duplicate).toBe(true);
    expect((await protocol.viewSettlement(settlementId)).phase).toBe("AUTHORIZED");
  });

  it("rejects external attempts without moving the case", async () => {
    const protocol = new StubProtocolAdapter();
    const settlementId = "stl_evt_last_ferry";
    await protocol.initiateSettlement({
      settlementId,
      eventId: "evt_last_ferry",
      idempotencyKey: "init-ext",
    });
    await expect(protocol.rejectExternalSettlement("EXTERNAL_ATTEMPT")).rejects.toMatchObject({
      code: "EXTERNAL_PAYMENT_UNSUPPORTED",
    });
    await expect(protocol.rejectExternalSettlement(" ")).rejects.toMatchObject({ code: "INVALID_ID" });
    const view = await protocol.viewSettlement(settlementId);
    expect(view.phase).toBe("INITIATED");
    expect(view.fundsExecuted).toBe(false);
    expect(view.externalPayment).toBe("UNSUPPORTED");
    expect(view.lastRejectCode).toBeNull();
  });
});

describe("http settlement commands stay not-bound", () => {
  it("does not send FSM commands or settle_capture", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    };
    const protocol = new HttpProtocolAdapter("http://127.0.0.1:8765", fetchImpl);
    const step = { settlementId: "stl_evt_lanterns", idempotencyKey: "k-1" };

    await expect(
      protocol.initiateSettlement({ ...step, eventId: "evt_lanterns" }),
    ).rejects.toThrow(/not-bound/);
    await expect(protocol.authorizeSettlement(step)).rejects.toThrow(/not-bound/);
    await expect(protocol.captureSettlement(step)).rejects.toThrow(/not-bound/);
    await expect(protocol.commitSettlement(step)).rejects.toThrow(/not-bound/);
    await expect(protocol.failSettlement({ ...step, reason: "FIXTURE_DECLINE" })).rejects.toThrow(/not-bound/);
    await expect(protocol.cancelSettlement({ ...step, reason: "FIXTURE_WITHDRAW" })).rejects.toThrow(/not-bound/);
    await expect(protocol.reconcileSettlement(step)).rejects.toThrow(/not-bound/);
    await expect(protocol.viewSettlement(step.settlementId)).rejects.toThrow(/not-bound/);
    await expect(protocol.rejectExternalSettlement("EXTERNAL_ATTEMPT")).rejects.toThrow(/not-bound/);
    await expect(protocol.settlementPreview("evt_lanterns")).rejects.toThrow(/not-bound/);

    expect(calls).toEqual([]);
    expect(COMMERCE_COMMAND_BINDINGS.initiateSettlement.consideredAction).toBeNull();
    expect(COMMERCE_COMMAND_BINDINGS.captureSettlement.consideredAction).toBeNull();
    expect(COMMERCE_COMMAND_BINDINGS.commitSettlement.consideredAction).toBeNull();
    expect(COMMERCE_COMMAND_BINDINGS.reconcileSettlement.consideredAction).toBeNull();
    expect(COMMERCE_COMMAND_BINDINGS.captureSettlement.reason).toMatch(/does not send/);
    expect(COMMERCE_COMMAND_BINDINGS.commitSettlement.reason).toMatch(/settle_capture/);
    expect(COMMERCE_COMMAND_BINDINGS.commitSettlement.reason).toMatch(/must not send/);
    expect(COMMERCE_COMMAND_BINDINGS.settlementPreview.consideredAction).toBe("settle_capture");
    expect(COMMERCE_COMMAND_BINDINGS.settlementPreview.status).toBe("not-bound");
    for (const name of ["initiate", "authorize", "fail", "cancel", "reconcile", "reject_external"] as const) {
      expect(isPinnedAction(name)).toBe(false);
    }
    expect(CONTRACT_ONLY_LOCAL_CALL_PATH).toBe("/x-kix-contract-only/local-call");
    expect(SETTLEMENT_DEPTH_BASELINE.protocolMainSha).toBe("85145eb33799a7c712890ff81708def8a7d61ee5");
    expect(PINNED_PROTOCOL_DOMAIN).toBe("kix:fixture:lifecycle:0.3");
  });
});
