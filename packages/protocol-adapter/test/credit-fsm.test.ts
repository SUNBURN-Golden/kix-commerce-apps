import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  CREDIT_BOUNDARY,
  CREDIT_CASE_NOTE,
  CREDIT_DEPTH_BASELINE,
  HttpProtocolAdapter,
  PINNED_ACTIONS,
  StubProtocolAdapter,
  createProtocol,
  echoIntegrationGateHeaders,
  isPinnedAction,
} from "../src/index.js";
import { localCallReceipt } from "./support/receipt.js";

const FACE = 100_000;
const OFFER = 80_000;
const CLAIM = "claim-lanterns";
const ADVANCE = "adv-lanterns";
const DRAW = "draw-lanterns";
const ROLE = "desk-beneficiary";

const BANNED_COPY = [
  /loan approved by bank/i,
  /funds wired/i,
  /kyc cleared/i,
  /\bAPR\b/,
  /licensed lender/i,
  /interest rate/i,
];

function protocol(): StubProtocolAdapter {
  return new StubProtocolAdapter();
}

function offerInput(
  adapter: StubProtocolAdapter,
  overrides: Partial<{
    advanceId: string;
    claimId: string;
    amount: number;
    openFace: number;
    idempotencyKey: string;
    beneficiaryRole: string;
    product: string | null;
  }> = {},
) {
  return adapter.offerCredit({
    advanceId: overrides.advanceId ?? ADVANCE,
    claimId: overrides.claimId ?? CLAIM,
    openFace: overrides.openFace ?? FACE,
    amount: overrides.amount ?? OFFER,
    beneficiaryRole: overrides.beneficiaryRole ?? ROLE,
    idempotencyKey: overrides.idempotencyKey ?? `offer-${overrides.advanceId ?? ADVANCE}`,
    product: overrides.product ?? null,
  });
}

async function approveDraw(adapter: StubProtocolAdapter, advanceId = ADVANCE, amount = OFFER) {
  await offerInput(adapter, { advanceId, amount, idempotencyKey: `offer-${advanceId}` });
  await adapter.approveCredit({ advanceId, idempotencyKey: `approve-${advanceId}` });
  return adapter.drawCredit({
    advanceId,
    drawId: `draw-${advanceId}`,
    idempotencyKey: `draw-${advanceId}`,
  });
}

describe("stub credit case", () => {
  it("walks offer, draw, partial repay, and close without a funds claim", async () => {
    const adapter = protocol();
    const offered = await offerInput(adapter);
    expect(offered.duplicate).toBe(false);
    expect(offered.applied).toBe("offer");
    expect(offered.provenance).toBe("MOCK_CREDIT_F04_ONLY");
    expect(offered.economicFinalityClaimed).toBe(false);
    expect(offered.fundsExecuted).toBe(false);
    expect(offered.bankDebitObserved).toBe(false);
    expect(offered.repaymentObserved).toBe(false);
    expect(offered.interestDefined).toBe(false);
    expect(offered.underwritingExecuted).toBe(false);
    expect(offered.kycExecuted).toBe(false);
    expect(offered.externalCredit).toBe("UNSUPPORTED");
    expect(offered.credit.phase).toBe("OFFERED");
    expect(offered.credit.terminal).toBe(false);
    expect(offered.credit.mode).toBe("mock");
    expect(offered.credit.surface).toBe("wave5.credit.F04.fsm");
    expect(offered.credit.references).toEqual(["F04"]);
    expect(offered.credit.exposureLedger).toBe("MOCK_EXPOSURE");
    expect(offered.credit.availableCredit).toBe(FACE);
    expect(offered.credit.pendingDraw).toBe(OFFER);
    expect(offered.credit.outstandingExposure).toBe(0);
    expect(offered.credit.repaidExposure).toBe(0);
    expect(offered.credit.noteStatus).toBeNull();
    expect(offered.credit.settlementGate).toBe("UNBOUND");
    expect(offered.credit.ownershipMutated).toBe(false);
    expect(offered.credit.ticketOwnershipAuthoritative).toBe(false);
    expect(offered.credit.note).toBe(CREDIT_CASE_NOTE);
    expect(offered.credit).not.toHaveProperty("amount");
    expect(offered.credit).not.toHaveProperty("currency");
    expect(adapter.describe().surfaces).toContain("wave5.credit.F04.fsm");
    expect(adapter.describe().fundsMovement).toBe("none");
    expect(CREDIT_BOUNDARY.action).toBe("none");
    expect("disburseCredit" in adapter).toBe(false);
    for (const pattern of BANNED_COPY) {
      expect(offered.credit.note).not.toMatch(pattern);
    }

    const replay = await offerInput(adapter);
    expect(replay.duplicate).toBe(true);
    expect(replay.applied).toBeNull();
    expect(replay.credit.phase).toBe("OFFERED");

    await expect(
      adapter.offerCredit({
        advanceId: ADVANCE,
        claimId: CLAIM,
        openFace: FACE,
        amount: OFFER - 1,
        beneficiaryRole: ROLE,
        idempotencyKey: `offer-${ADVANCE}`,
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect((await adapter.viewCredit(ADVANCE)).phase).toBe("OFFERED");
    expect((await adapter.viewCredit(ADVANCE)).lastRejectCode).toBe("IDEMPOTENCY_CONFLICT");

    await expect(
      adapter.drawCredit({ advanceId: ADVANCE, drawId: DRAW, idempotencyKey: "draw-early" }),
    ).rejects.toMatchObject({ code: "ILLEGAL_TRANSITION" });
    expect((await adapter.viewCredit(ADVANCE)).phase).toBe("OFFERED");

    const approved = await adapter.approveCredit({ advanceId: ADVANCE, idempotencyKey: "approve-1" });
    expect(approved.credit.phase).toBe("APPROVED");
    expect(approved.credit.pendingDraw).toBe(OFFER);
    expect(approved.credit.outstandingExposure).toBe(0);
    expect(approved.underwritingExecuted).toBe(false);
    expect(approved.kycExecuted).toBe(false);

    const drawn = await adapter.drawCredit({ advanceId: ADVANCE, drawId: DRAW, idempotencyKey: "draw-1" });
    expect(drawn.applied).toBe("draw");
    expect(drawn.credit.phase).toBe("DRAWN");
    expect(drawn.credit.pendingDraw).toBe(0);
    expect(drawn.credit.outstandingExposure).toBe(OFFER);
    expect(drawn.credit.availableCredit).toBe(FACE - OFFER);
    expect(drawn.credit.reservedOpen).toBe(OFFER);
    expect(drawn.credit.noteStatus).toBe("NOTED");
    expect(drawn.credit.settlementGate).toBe("UNBOUND");
    expect(drawn.credit.mockSettlementCommitObserved).toBe(false);
    expect(drawn.economicFinalityClaimed).toBe(false);
    expect(drawn.fundsExecuted).toBe(false);
    expect(drawn.credit.ownershipMutated).toBe(false);

    const partial = await adapter.repayCredit({
      advanceId: ADVANCE,
      repayId: "repay-1",
      sequence: 1,
      amount: 30_000,
      idempotencyKey: "repay-1",
    });
    expect(partial.credit.phase).toBe("DRAWN");
    expect(partial.credit.outstandingExposure).toBe(OFFER - 30_000);
    expect(partial.credit.repaidExposure).toBe(30_000);
    expect(partial.credit.availableCredit).toBe(FACE - OFFER);
    expect(partial.credit.reservedOpen).toBe(OFFER);
    expect(partial.repaymentObserved).toBe(false);
    expect(partial.fundsExecuted).toBe(false);

    await expect(
      adapter.repayCredit({
        advanceId: ADVANCE,
        repayId: "repay-skip",
        sequence: 3,
        amount: 1,
        idempotencyKey: "repay-skip",
      }),
    ).rejects.toMatchObject({ code: "REPAYMENT_ORDER" });
    await expect(
      adapter.repayCredit({
        advanceId: ADVANCE,
        repayId: "repay-over",
        sequence: 2,
        amount: OFFER,
        idempotencyKey: "repay-over",
      }),
    ).rejects.toMatchObject({ code: "REPAYMENT_EXCEEDS_OUTSTANDING" });
    expect((await adapter.viewCredit(ADVANCE)).outstandingExposure).toBe(OFFER - 30_000);

    const sameNote = await adapter.repayCredit({
      advanceId: ADVANCE,
      repayId: "repay-1",
      sequence: 1,
      amount: 30_000,
      idempotencyKey: "repay-1-again",
    });
    expect(sameNote.duplicate).toBe(true);
    expect(sameNote.applied).toBeNull();
    expect((await adapter.viewCredit(ADVANCE)).outstandingExposure).toBe(OFFER - 30_000);

    await expect(
      adapter.repayCredit({
        advanceId: ADVANCE,
        repayId: "repay-1",
        sequence: 1,
        amount: 1,
        idempotencyKey: "repay-1-conflict",
      }),
    ).rejects.toMatchObject({ code: "REPAY_BINDING_CONFLICT" });

    await adapter.repayCredit({
      advanceId: ADVANCE,
      repayId: "repay-2",
      sequence: 2,
      amount: OFFER - 30_000,
      idempotencyKey: "repay-2",
    });
    expect((await adapter.viewCredit(ADVANCE)).outstandingExposure).toBe(0);
    await expect(
      adapter.defaultCredit({ advanceId: ADVANCE, idempotencyKey: "default-zero", reason: "FIXTURE_EXPOSURE" }),
    ).rejects.toMatchObject({ code: "DEFAULT_REQUIRES_EXPOSURE" });
    expect((await adapter.viewCredit(ADVANCE)).phase).toBe("DRAWN");

    await expect(adapter.closeCredit({ advanceId: ADVANCE, idempotencyKey: "close-early" })).resolves.toMatchObject({
      applied: "close",
      credit: { phase: "CLOSED", noteStatus: "RELEASED", availableCredit: FACE, outstandingExposure: 0 },
    });
    const closed = await adapter.viewCredit(ADVANCE);
    expect(closed.terminal).toBe(true);
    expect(closed.economicFinalityClaimed).toBe(false);
    expect(closed.fundsExecuted).toBe(false);
    expect(closed.reservedOpen).toBe(0);

    const reconciled = await adapter.reconcileCredit({ advanceId: ADVANCE, idempotencyKey: "recon-1" });
    expect(reconciled.matched).toBe(true);
    expect(reconciled.applied).toBe("reconcile");
    expect(reconciled.economicFinalityClaimed).toBe(false);
    expect((await adapter.viewCredit(ADVANCE)).reconcileMatched).toBe(true);
    const again = await adapter.reconcileCredit({ advanceId: ADVANCE, idempotencyKey: "recon-1" });
    expect(again.duplicate).toBe(true);
    expect(again.applied).toBeNull();
    expect(again.matched).toBe(true);
  });

  it("rejects a second draw id and keeps the same draw id idempotent", async () => {
    const adapter = protocol();
    await approveDraw(adapter);
    const same = await adapter.drawCredit({
      advanceId: ADVANCE,
      drawId: `draw-${ADVANCE}`,
      idempotencyKey: "draw-same-id",
    });
    expect(same.duplicate).toBe(true);
    expect(same.applied).toBeNull();
    expect((await adapter.viewCredit(ADVANCE)).outstandingExposure).toBe(OFFER);

    await expect(
      adapter.drawCredit({ advanceId: ADVANCE, drawId: "draw-other", idempotencyKey: "draw-other" }),
    ).rejects.toMatchObject({ code: "DUPLICATE_DRAW" });
    expect((await adapter.viewCredit(ADVANCE)).phase).toBe("DRAWN");
    expect((await adapter.viewCredit(ADVANCE)).outstandingExposure).toBe(OFFER);
    expect((await adapter.viewCredit(ADVANCE)).lastRejectCode).toBe("DUPLICATE_DRAW");
  });

  it("keeps terminal phases immutable", async () => {
    const adapter = protocol();
    await offerInput(adapter);
    await adapter.rejectCredit({ advanceId: ADVANCE, idempotencyKey: "reject-1", reason: "FIXTURE_DECLINE" });
    await expect(adapter.approveCredit({ advanceId: ADVANCE, idempotencyKey: "approve-late" })).rejects.toMatchObject({
      code: "TERMINAL_IMMUTABLE",
    });
    expect((await adapter.viewCredit(ADVANCE)).phase).toBe("REJECTED");
    expect((await adapter.viewCredit(ADVANCE)).terminal).toBe(true);

    await offerInput(adapter, { advanceId: "adv-cancel", idempotencyKey: "offer-cancel" });
    await adapter.approveCredit({ advanceId: "adv-cancel", idempotencyKey: "approve-cancel" });
    await adapter.cancelCredit({
      advanceId: "adv-cancel",
      idempotencyKey: "cancel-1",
      reason: "FIXTURE_WITHDRAW",
    });
    await expect(
      adapter.drawCredit({ advanceId: "adv-cancel", drawId: "draw-cancel", idempotencyKey: "draw-cancel" }),
    ).rejects.toMatchObject({ code: "TERMINAL_IMMUTABLE" });
    expect((await adapter.viewCredit("adv-cancel")).phase).toBe("CANCELLED");

    await approveDraw(adapter, "adv-closed", 10_000);
    await adapter.repayCredit({
      advanceId: "adv-closed",
      repayId: "repay-closed",
      sequence: 1,
      amount: 10_000,
      idempotencyKey: "repay-closed",
    });
    await adapter.closeCredit({ advanceId: "adv-closed", idempotencyKey: "close-closed" });
    await expect(
      adapter.repayCredit({
        advanceId: "adv-closed",
        repayId: "repay-after",
        sequence: 2,
        amount: 1,
        idempotencyKey: "repay-after",
      }),
    ).rejects.toMatchObject({ code: "TERMINAL_IMMUTABLE" });
    const same = await adapter.repayCredit({
      advanceId: "adv-closed",
      repayId: "repay-closed",
      sequence: 1,
      amount: 10_000,
      idempotencyKey: "repay-closed-again",
    });
    expect(same.duplicate).toBe(true);
    expect((await adapter.viewCredit("adv-closed")).phase).toBe("CLOSED");
    expect((await adapter.viewCredit("adv-closed")).outstandingExposure).toBe(0);
  });

  it("orders a limit race and does not free the ceiling on partial repay", async () => {
    const adapter = protocol();
    await offerInput(adapter, { advanceId: "adv-a", amount: 60_000, idempotencyKey: "offer-a" });
    await offerInput(adapter, { advanceId: "adv-b", amount: 50_000, idempotencyKey: "offer-b" });
    await adapter.approveCredit({ advanceId: "adv-a", idempotencyKey: "approve-a" });
    await adapter.approveCredit({ advanceId: "adv-b", idempotencyKey: "approve-b" });

    const first = await adapter.drawCredit({ advanceId: "adv-a", drawId: "draw-a", idempotencyKey: "draw-a" });
    expect(first.credit.outstandingExposure).toBe(60_000);
    expect(first.credit.availableCredit).toBe(40_000);

    await expect(
      adapter.drawCredit({ advanceId: "adv-b", drawId: "draw-b", idempotencyKey: "draw-b" }),
    ).rejects.toMatchObject({ code: "ADVANCE_EXCEEDS_OPEN_FACE" });
    const loser = await adapter.viewCredit("adv-b");
    expect(loser.phase).toBe("APPROVED");
    expect(loser.outstandingExposure).toBe(0);
    expect(loser.pendingDraw).toBe(50_000);
    expect(loser.availableCredit).toBe(40_000);
    expect(loser.lastRejectCode).toBe("ADVANCE_EXCEEDS_OPEN_FACE");

    await adapter.repayCredit({
      advanceId: "adv-a",
      repayId: "repay-a",
      sequence: 1,
      amount: 10_000,
      idempotencyKey: "repay-a",
    });
    expect((await adapter.viewCredit("adv-a")).availableCredit).toBe(40_000);
    expect((await adapter.viewCredit("adv-b")).availableCredit).toBe(40_000);
    await expect(adapter.closeCredit({ advanceId: "adv-a", idempotencyKey: "close-a-early" })).rejects.toMatchObject({
      code: "OUTSTANDING_REMAINS",
    });
    expect((await adapter.viewCredit("adv-a")).noteStatus).toBe("NOTED");

    await adapter.repayCredit({
      advanceId: "adv-a",
      repayId: "repay-a2",
      sequence: 2,
      amount: 50_000,
      idempotencyKey: "repay-a2",
    });
    const closed = await adapter.closeCredit({ advanceId: "adv-a", idempotencyKey: "close-a" });
    expect(closed.credit.phase).toBe("CLOSED");
    expect(closed.credit.availableCredit).toBe(FACE);
    expect(closed.fundsExecuted).toBe(false);

    const second = await adapter.drawCredit({ advanceId: "adv-b", drawId: "draw-b", idempotencyKey: "draw-b-2" });
    expect(second.credit.phase).toBe("DRAWN");
    expect(second.credit.outstandingExposure).toBe(50_000);
    expect(second.credit.availableCredit).toBe(50_000);

    await offerInput(adapter, {
      advanceId: "adv-c",
      openFace: 90_000,
      amount: 10_000,
      idempotencyKey: "offer-c",
    });
    await adapter.approveCredit({ advanceId: "adv-c", idempotencyKey: "approve-c" });
    await expect(
      adapter.drawCredit({ advanceId: "adv-c", drawId: "draw-c", idempotencyKey: "draw-c" }),
    ).rejects.toMatchObject({ code: "FACE_SNAPSHOT_FROZEN" });
    expect((await adapter.viewCredit("adv-c")).phase).toBe("APPROVED");
    expect((await adapter.viewCredit("adv-b")).outstandingExposure).toBe(50_000);
  });

  it("defaults while exposure remains and does not free the ceiling", async () => {
    const adapter = protocol();
    await approveDraw(adapter, "adv-def", 60_000);
    const marked = await adapter.defaultCredit({
      advanceId: "adv-def",
      idempotencyKey: "default-1",
      reason: "FIXTURE_EXPOSURE",
    });
    expect(marked.credit.phase).toBe("DEFAULTED");
    expect(marked.credit.terminal).toBe(true);
    expect(marked.credit.outstandingExposure).toBe(60_000);
    expect(marked.credit.noteStatus).toBe("NOTED");
    expect(marked.credit.availableCredit).toBe(40_000);
    expect(marked.credit.reservedOpen).toBe(60_000);
    expect(marked.fundsExecuted).toBe(false);
    expect(marked.economicFinalityClaimed).toBe(false);
    expect(marked.credit.ownershipMutated).toBe(false);

    await expect(
      adapter.closeCredit({ advanceId: "adv-def", idempotencyKey: "close-def" }),
    ).rejects.toMatchObject({ code: "TERMINAL_IMMUTABLE" });
    await expect(
      adapter.drawCredit({ advanceId: "adv-def", drawId: "draw-other", idempotencyKey: "draw-def-other" }),
    ).rejects.toMatchObject({ code: "TERMINAL_IMMUTABLE" });
    const same = await adapter.drawCredit({
      advanceId: "adv-def",
      drawId: "draw-adv-def",
      idempotencyKey: "draw-def-same",
    });
    expect(same.duplicate).toBe(true);
    expect((await adapter.viewCredit("adv-def")).outstandingExposure).toBe(60_000);
    expect((await adapter.viewCredit("adv-def")).availableCredit).toBe(40_000);

    await offerInput(adapter, { advanceId: "adv-rest", amount: 50_000, idempotencyKey: "offer-rest" });
    await adapter.approveCredit({ advanceId: "adv-rest", idempotencyKey: "approve-rest" });
    await expect(
      adapter.drawCredit({ advanceId: "adv-rest", drawId: "draw-rest", idempotencyKey: "draw-rest" }),
    ).rejects.toMatchObject({ code: "ADVANCE_EXCEEDS_OPEN_FACE" });
    await offerInput(adapter, { advanceId: "adv-fit", amount: 40_000, idempotencyKey: "offer-fit" });
    await adapter.approveCredit({ advanceId: "adv-fit", idempotencyKey: "approve-fit" });
    const fit = await adapter.drawCredit({ advanceId: "adv-fit", drawId: "draw-fit", idempotencyKey: "draw-fit" });
    expect(fit.credit.phase).toBe("DRAWN");
    expect(fit.credit.availableCredit).toBe(0);
    expect((await adapter.viewCredit("adv-def")).phase).toBe("DEFAULTED");
  });

  it("refuses a bound draw until the mock settlement view is committed", async () => {
    const adapter = protocol();
    const settlementId = "stl_evt_lanterns";
    await adapter.initiateSettlement({
      settlementId,
      eventId: "evt_lanterns",
      idempotencyKey: "stl-init",
    });
    await offerInput(adapter);
    await adapter.approveCredit({ advanceId: ADVANCE, idempotencyKey: "approve-1" });
    const bound = await adapter.bindCreditSettlement({
      advanceId: ADVANCE,
      settlementId,
      idempotencyKey: "bind-1",
    });
    expect(bound.credit.phase).toBe("APPROVED");
    expect(bound.credit.settlementGate).toBe("BOUND");
    expect(bound.credit.mockSettlementCommitObserved).toBe(false);
    expect(bound.economicFinalityClaimed).toBe(false);

    await expect(
      adapter.drawCredit({ advanceId: ADVANCE, drawId: DRAW, idempotencyKey: "draw-early" }),
    ).rejects.toMatchObject({ code: "SETTLEMENT_NOT_COMMITTED" });
    expect((await adapter.viewCredit(ADVANCE)).phase).toBe("APPROVED");
    expect((await adapter.viewCredit(ADVANCE)).outstandingExposure).toBe(0);
    expect((await adapter.viewCredit(ADVANCE)).economicFinalityClaimed).toBe(false);
    expect((await adapter.viewCredit(ADVANCE)).fundsExecuted).toBe(false);

    await adapter.authorizeSettlement({ settlementId, idempotencyKey: "stl-auth" });
    await adapter.captureSettlement({ settlementId, idempotencyKey: "stl-cap" });
    await adapter.commitSettlement({ settlementId, idempotencyKey: "stl-commit" });
    await expect(
      adapter.drawCredit({ advanceId: ADVANCE, drawId: DRAW, idempotencyKey: "draw-early" }),
    ).rejects.toMatchObject({ code: "SETTLEMENT_NOT_COMMITTED" });
    expect((await adapter.viewCredit(ADVANCE)).outstandingExposure).toBe(0);

    const drawn = await adapter.drawCredit({ advanceId: ADVANCE, drawId: DRAW, idempotencyKey: "draw-late" });
    expect(drawn.credit.phase).toBe("DRAWN");
    expect(drawn.credit.settlementGate).toBe("MOCK_COMMIT_OBSERVED");
    expect(drawn.credit.mockSettlementCommitObserved).toBe(true);
    expect(drawn.credit.settlementFailure).toBe(false);
    expect(drawn.economicFinalityClaimed).toBe(false);
    expect(drawn.fundsExecuted).toBe(false);
    expect(drawn.bankDebitObserved).toBe(false);
    expect(drawn.credit.ownershipMutated).toBe(false);
    expect((await adapter.viewSettlement(settlementId)).phase).toBe("COMMITTED");
    expect((await adapter.viewSettlement(settlementId)).fundsExecuted).toBe(false);

    const failed = protocol();
    await failed.initiateSettlement({
      settlementId: "stl-fail",
      eventId: "evt_lanterns",
      idempotencyKey: "stl-fail-init",
    });
    await failed.failSettlement({
      settlementId: "stl-fail",
      idempotencyKey: "stl-fail",
      reason: "FIXTURE_DECLINE",
    });
    await offerInput(failed, { advanceId: "adv-fail", idempotencyKey: "offer-fail" });
    await failed.approveCredit({ advanceId: "adv-fail", idempotencyKey: "approve-fail" });
    await failed.bindCreditSettlement({
      advanceId: "adv-fail",
      settlementId: "stl-fail",
      idempotencyKey: "bind-fail",
    });
    await expect(
      failed.drawCredit({ advanceId: "adv-fail", drawId: "draw-fail", idempotencyKey: "draw-fail" }),
    ).rejects.toMatchObject({ code: "SETTLEMENT_NOT_COMMITTED" });
    const stuck = await failed.viewCredit("adv-fail");
    expect(stuck.phase).toBe("APPROVED");
    expect(stuck.settlementFailure).toBe(true);
    expect(stuck.outstandingExposure).toBe(0);
    expect(stuck.economicFinalityClaimed).toBe(false);
    expect(stuck.fundsExecuted).toBe(false);
    expect(stuck.mockSettlementCommitObserved).toBe(false);
  });

  it("does not mutate booking or resale ownership", async () => {
    const adapter = protocol();
    const beforeCapacity = (await adapter.listPerformances()).find((item) => item.eventId === "evt_lanterns");
    const hold = await adapter.placeHold({ eventId: "evt_lanterns", quantity: 1 });
    const booking = await adapter.confirmBooking(hold.holdId);
    const listing = await adapter.openResale({ bookingId: booking.bookingId, askLabel: "face (display only)" });
    await issueRight(adapter);
    await adapter.adoptResaleIssued({
      rightId: "iss_evt_lanterns",
      showId: "show_evt_lanterns",
      eventId: "evt_lanterns",
      slot: "slot-0",
      holderRole: "buyer-1",
      reservationId: "rsv_evt_lanterns",
      paymentRef: "mock-issued",
      idempotencyKey: "adopt-1",
    });
    await adapter.listResaleCase({
      listingId: "list-1",
      rightId: "iss_evt_lanterns",
      version: 1,
      sellerRole: "buyer-1",
      recipientRole: "buyer-2",
      expiresAt: "2099-06-01T00:00:00.000Z",
      reservationId: "rsv_evt_lanterns",
      idempotencyKey: "list-1",
    });
    const resaleBefore = await adapter.viewResaleCase("list-1");
    const rightBefore = await adapter.viewResaleRight("iss_evt_lanterns");
    const listingsBefore = await adapter.listResale();
    const capacityBefore = (await adapter.listPerformances()).find((item) => item.eventId === "evt_lanterns");

    await approveDraw(adapter);
    await adapter.repayCredit({
      advanceId: ADVANCE,
      repayId: "repay-1",
      sequence: 1,
      amount: OFFER,
      idempotencyKey: "repay-own",
    });
    await adapter.closeCredit({ advanceId: ADVANCE, idempotencyKey: "close-own" });
    await expect(adapter.rejectUnsupportedCredit("FORECLOSE")).rejects.toMatchObject({
      code: "CREDIT_PRODUCT_UNDEFINED",
    });

    expect(await adapter.getBooking(booking.bookingId)).toEqual(booking);
    expect(await adapter.listResale()).toEqual(listingsBefore);
    expect(listing.status).toBe("open");
    const resaleAfter = await adapter.viewResaleCase("list-1");
    expect(resaleAfter.phase).toBe(resaleBefore.phase);
    expect(resaleAfter.holderRole).toBe(resaleBefore.holderRole);
    expect(resaleAfter.currentVersion).toBe(resaleBefore.currentVersion);
    expect(resaleAfter.ownershipTransferred).toBe(false);
    const rightAfter = await adapter.viewResaleRight("iss_evt_lanterns");
    expect(rightAfter.holderRole).toBe(rightBefore.holderRole);
    expect(rightAfter.version).toBe(rightBefore.version);
    expect(rightAfter.eligibility).toBe(rightBefore.eligibility);
    expect((await adapter.listPerformances()).find((item) => item.eventId === "evt_lanterns")?.remainingCapacity).toBe(
      capacityBefore?.remainingCapacity,
    );
    expect(beforeCapacity?.remainingCapacity).toBe((capacityBefore?.remainingCapacity ?? 0) + 1);
    expect((await adapter.viewCredit(ADVANCE)).ownershipMutated).toBe(false);
    expect((await adapter.viewCredit(ADVANCE)).ticketOwnershipAuthoritative).toBe(false);
  });

  it("rejects unsupported real-funds and product labels without moving the phase", async () => {
    const adapter = protocol();
    await offerInput(adapter);
    await adapter.approveCredit({ advanceId: ADVANCE, idempotencyKey: "approve-1" });
    const before = await adapter.viewCredit(ADVANCE);

    await expect(adapter.rejectUnsupportedCredit("DISBURSE")).rejects.toMatchObject({ code: "REAL_FUNDS_FORBIDDEN" });
    await expect(adapter.rejectUnsupportedCredit("DISBURSE_TO_BANK")).rejects.toMatchObject({
      code: "REAL_FUNDS_FORBIDDEN",
    });
    await expect(adapter.rejectUnsupportedCredit("INTEREST")).rejects.toMatchObject({
      code: "CREDIT_PRODUCT_UNDEFINED",
    });
    await expect(adapter.rejectUnsupportedCredit("KYC")).rejects.toMatchObject({ code: "CREDIT_PRODUCT_UNDEFINED" });
    await expect(adapter.rejectUnsupportedCredit("UNDERWRITE")).rejects.toMatchObject({
      code: "CREDIT_PRODUCT_UNDEFINED",
    });
    await expect(adapter.rejectUnsupportedCredit("FORECLOSE")).rejects.toMatchObject({
      code: "CREDIT_PRODUCT_UNDEFINED",
    });
    await expect(adapter.rejectUnsupportedCredit("SOMETHING_ELSE")).rejects.toMatchObject({ code: "EXECUTION_KIND" });

    const after = await adapter.viewCredit(ADVANCE);
    expect(after.phase).toBe(before.phase);
    expect(after.outstandingExposure).toBe(before.outstandingExposure);
    expect(after.availableCredit).toBe(before.availableCredit);
    expect(after.lastRejectCode).toBeNull();

    await expect(
      offerInput(adapter, { advanceId: "adv-product", idempotencyKey: "offer-product", product: "card" }),
    ).rejects.toMatchObject({ code: "CREDIT_PRODUCT_UNDEFINED" });
    await expect(adapter.viewCredit("adv-product")).rejects.toMatchObject({ code: "UNKNOWN_ADVANCE" });
    expect((await adapter.viewCredit(ADVANCE)).phase).toBe("APPROVED");
  });
});

describe("http credit binding", () => {
  it("leaves credit FSM methods not-bound and does not invent a lending route", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    };
    const http = new HttpProtocolAdapter("http://127.0.0.1:8765", fetchImpl);
    expect("disburseCredit" in http).toBe(false);
    const methods = [
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
    ] as const;
    for (const method of methods) {
      expect(COMMERCE_COMMAND_BINDINGS[method].status).toBe("not-bound");
      expect(COMMERCE_COMMAND_BINDINGS[method].consideredAction).toBeNull();
    }
    await expect(
      http.offerCredit({
        advanceId: ADVANCE,
        claimId: CLAIM,
        openFace: FACE,
        amount: OFFER,
        beneficiaryRole: ROLE,
        idempotencyKey: "offer-http",
      }),
    ).rejects.toThrow(/not-bound/);
    await expect(http.approveCredit({ advanceId: ADVANCE, idempotencyKey: "approve-http" })).rejects.toThrow(
      /not-bound/,
    );
    await expect(
      http.rejectCredit({ advanceId: ADVANCE, idempotencyKey: "reject-http", reason: "FIXTURE_DECLINE" }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      http.cancelCredit({ advanceId: ADVANCE, idempotencyKey: "cancel-http", reason: "FIXTURE_WITHDRAW" }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      http.bindCreditSettlement({
        advanceId: ADVANCE,
        settlementId: "stl_evt_lanterns",
        idempotencyKey: "bind-http",
      }),
    ).rejects.toThrow(/not-bound/);
    await expect(http.drawCredit({ advanceId: ADVANCE, drawId: DRAW, idempotencyKey: "draw-http" })).rejects.toThrow(
      /not-bound/,
    );
    await expect(
      http.repayCredit({
        advanceId: ADVANCE,
        repayId: "repay-http",
        sequence: 1,
        amount: 1,
        idempotencyKey: "repay-http",
      }),
    ).rejects.toThrow(/not-bound/);
    await expect(http.closeCredit({ advanceId: ADVANCE, idempotencyKey: "close-http" })).rejects.toThrow(/not-bound/);
    await expect(
      http.defaultCredit({ advanceId: ADVANCE, idempotencyKey: "default-http", reason: "FIXTURE_EXPOSURE" }),
    ).rejects.toThrow(/not-bound/);
    await expect(http.reconcileCredit({ advanceId: ADVANCE, idempotencyKey: "recon-http" })).rejects.toThrow(
      /not-bound/,
    );
    await expect(http.viewCredit(ADVANCE)).rejects.toThrow(/not-bound/);
    await expect(http.rejectUnsupportedCredit("DISBURSE")).rejects.toThrow(/not-bound/);
    expect(calls).toEqual([]);
    expect(JSON.stringify(COMMERCE_COMMAND_BINDINGS)).not.toContain("/v1/commerce");
    expect(JSON.stringify(COMMERCE_COMMAND_BINDINGS)).not.toContain("/v1/credit");
    for (const name of ["offer", "approve", "draw", "repay", "close", "default", "bind_settlement"]) {
      expect(isPinnedAction(name)).toBe(false);
      expect(PINNED_ACTIONS).not.toContain(name);
    }
    expect(CREDIT_DEPTH_BASELINE.protocolMainSha).toBe("8c1a4db7cfe70b0e772a2ef0f24492967c84f7f1");
    expect(createProtocol().describe().adapter).toBe("stub");
  });

  it("keeps the credit payload guard fail-closed without a new catalogue command", async () => {
    let responseBody: unknown = {
      advanceId: ADVANCE,
      mode: "live",
      provenance: "MOCK_CREDIT_F04_ONLY",
      phase: "OFFERED",
      references: ["F04"],
      note: "Simulated exposure. Not live credit.",
    };
    const fetchImpl: typeof fetch = async (_input, init) =>
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: echoIntegrationGateHeaders(init),
      });
    const http = new HttpProtocolAdapter("http://127.0.0.1:8765", fetchImpl);
    const command = {
      operationId: "op-close-credit",
      actor: "fixture-actor",
      action: "close_sales" as const,
      body: { domain: "kix:fixture:lifecycle:0.3", eventId: "evt_lanterns" },
    };
    await expect(http.invokeLocalCall(command)).rejects.toThrow(/mock mode/);

    responseBody = {
      advanceId: ADVANCE,
      mode: "mock",
      provenance: "MOCK_CREDIT_F04_ONLY",
      phase: "DRAWN",
      references: ["F04"],
      note: "Simulated exposure. Not live credit.",
      economicFinalityClaimed: true,
      fundsExecuted: false,
    };
    await expect(http.invokeLocalCall({ ...command, operationId: "op-close-credit-2" })).rejects.toThrow(
      /Credit payload must not claim economic finality/,
    );

    responseBody = {
      advanceId: ADVANCE,
      mode: "mock",
      provenance: "MOCK_CREDIT_F04_ONLY",
      phase: "DRAWN",
      references: ["F04"],
      note: "loan approved by bank",
      economicFinalityClaimed: false,
      fundsExecuted: false,
    };
    await expect(http.invokeLocalCall({ ...command, operationId: "op-close-credit-3" })).rejects.toThrow(
      /production-finance wording/,
    );

    responseBody = {
      advanceId: ADVANCE,
      mode: "mock",
      provenance: "MOCK_CREDIT_F04_ONLY",
      phase: "DRAWN",
      references: ["F04"],
      note: "Simulated exposure. Not live credit.",
      currency: "KRW",
    };
    await expect(http.invokeLocalCall({ ...command, operationId: "op-close-credit-4" })).rejects.toThrow(
      /currency posting/,
    );

    responseBody = { disburseCredit: { amount: 1 } };
    await expect(http.invokeLocalCall({ ...command, operationId: "op-close-credit-5" })).rejects.toThrow(
      /does not disburse credit/,
    );

    responseBody = localCallReceipt("op-close-credit-6", "close_sales", {
      advanceId: ADVANCE,
      mode: "mock",
      provenance: "MOCK_CREDIT_F04_ONLY",
      phase: "DRAWN",
      references: ["F04"],
      note: "Simulated exposure. Not live credit.",
      economicFinalityClaimed: false,
      fundsExecuted: false,
      availableCredit: FACE,
      outstandingExposure: 0,
    });
    await expect(http.invokeLocalCall({ ...command, operationId: "op-close-credit-6" })).resolves.toMatchObject({
      result: { mode: "mock", phase: "DRAWN", economicFinalityClaimed: false },
    });
  });
});

async function issueRight(adapter: StubProtocolAdapter) {
  await adapter.registerReservationShow({
    showId: "show_evt_lanterns",
    eventId: "evt_lanterns",
    idempotencyKey: "show-1",
    slots: ["slot-0"],
  });
  await adapter.holdReservation({
    reservationId: "rsv_evt_lanterns",
    showId: "show_evt_lanterns",
    slot: "slot-0",
    buyerRole: "buyer-1",
    expiresAt: "2099-01-01T00:00:00.000Z",
    idempotencyKey: "hold-1",
  });
  await adapter.confirmReservation({
    orderId: "ord_evt_lanterns",
    reservationId: "rsv_evt_lanterns",
    idempotencyKey: "confirm-1",
  });
  await adapter.observeReservationPayment({
    orderId: "ord_evt_lanterns",
    idempotencyKey: "pay-res-1",
    paymentRef: "mock-noted",
  });
  return adapter.issueReservation({
    issuanceId: "iss_evt_lanterns",
    orderId: "ord_evt_lanterns",
    idempotencyKey: "issue-1",
  });
}
