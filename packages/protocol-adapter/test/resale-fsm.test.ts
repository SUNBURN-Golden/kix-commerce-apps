import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  CONTRACT_ONLY_LOCAL_CALL_PATH,
  HttpProtocolAdapter,
  OPENAPI_CONTRACT_PIN,
  PINNED_ACTIONS,
  PINNED_PROTOCOL_DOMAIN,
  ProtocolError,
  RESALE_CASE_NOTE,
  RESALE_DEPTH_BASELINE,
  StubProtocolAdapter,
  createProtocol,
  echoIntegrationGateHeaders,
  isPinnedAction,
} from "../src/index.js";
import { localCallReceipt } from "./support/receipt.js";

const SHOW = "show_evt_lanterns";
const EVENT = "evt_lanterns";
const RES = "rsv_evt_lanterns";
const ORDER = "ord_evt_lanterns";
const ISSUE = "iss_evt_lanterns";
const ADMIT = "adm_evt_lanterns";
const CONSUME = "csm_evt_lanterns";
const SLOT = "slot-0";
const EXPIRES = "2099-01-01T00:00:00.000Z";
const SALE_EXPIRES = "2099-06-01T00:00:00.000Z";
const SETTLEMENT = "stl_evt_lanterns";
const LISTING = "list-1";
const SELLER = "buyer-1";
const RECIPIENT = "buyer-2";

const BANNED_COPY = [
  /listed on exchange/i,
  /kyc cleared/i,
  /funds settled/i,
  /seller bank/i,
  /toss/i,
  /portone/i,
];

function protocol(): StubProtocolAdapter {
  return new StubProtocolAdapter();
}

async function issueRight(adapter: StubProtocolAdapter) {
  await adapter.registerReservationShow({
    showId: SHOW,
    eventId: EVENT,
    idempotencyKey: "show-1",
    slots: [SLOT],
  });
  await adapter.holdReservation({
    reservationId: RES,
    showId: SHOW,
    slot: SLOT,
    buyerRole: SELLER,
    expiresAt: EXPIRES,
    idempotencyKey: "hold-1",
  });
  await adapter.confirmReservation({
    orderId: ORDER,
    reservationId: RES,
    idempotencyKey: "confirm-1",
  });
  await adapter.observeReservationPayment({
    orderId: ORDER,
    idempotencyKey: "pay-res-1",
    paymentRef: "mock-noted",
  });
  return adapter.issueReservation({
    issuanceId: ISSUE,
    orderId: ORDER,
    idempotencyKey: "issue-1",
  });
}

function adoptInput(reservationId: string | null = RES) {
  return {
    rightId: ISSUE,
    showId: SHOW,
    eventId: EVENT,
    slot: SLOT,
    holderRole: SELLER,
    reservationId,
    paymentRef: "mock-issued",
    idempotencyKey: "adopt-1",
  };
}

function listInput(overrides: Partial<{ listingId: string; version: number; sellerRole: string; recipientRole: string; idempotencyKey: string; expiresAt: string; reservationId: string | null }> = {}) {
  return {
    listingId: overrides.listingId ?? LISTING,
    rightId: ISSUE,
    version: overrides.version ?? 1,
    sellerRole: overrides.sellerRole ?? SELLER,
    recipientRole: overrides.recipientRole ?? RECIPIENT,
    expiresAt: overrides.expiresAt ?? SALE_EXPIRES,
    reservationId: overrides.reservationId === undefined ? RES : overrides.reservationId,
    idempotencyKey: overrides.idempotencyKey ?? `list-${overrides.listingId ?? LISTING}`,
  };
}

describe("stub resale case", () => {
  it("walks list, simulated payment, and transfer without economic finality", async () => {
    const adapter = protocol();
    await issueRight(adapter);
    const adopted = await adapter.adoptResaleIssued(adoptInput());
    expect(adopted.duplicate).toBe(false);
    expect(adopted.applied).toBe("adopt_issued");
    expect(adopted.provenance).toBe("MOCK_GATE_ONLY");
    expect(adopted.economicFinalityClaimed).toBe(false);
    expect(adopted.fundsExecuted).toBe(false);
    expect(adopted.venueCredentialReissued).toBe(false);
    expect(adopted.externalMarketplace).toBe("UNSUPPORTED");
    expect(adopted.listing).toBeNull();
    expect(adopted.right?.eligible).toBe(true);
    expect(adopted.right?.eligibility).toBe("ELIGIBLE");
    expect(adopted.right?.mode).toBe("mock");
    expect(adopted.right?.surface).toBe("wave4.resale.R01-R05.fsm");
    expect(adopted.right?.references).toEqual(["R01", "R02", "R03", "R04", "R05"]);
    expect(adopted.right?.version).toBe(1);
    expect(adopted.right?.note).toBe(RESALE_CASE_NOTE);
    expect(adopted.right).not.toHaveProperty("amount");
    expect(adopted.evidence).toBeNull();
    for (const pattern of BANNED_COPY) {
      expect(adopted.right?.note).not.toMatch(pattern);
    }

    const listed = await adapter.listResaleCase(listInput());
    expect(listed.applied).toBe("list_resale");
    expect(listed.listing?.phase).toBe("LISTED");
    expect(listed.listing?.pendingSale).toBe(true);
    expect(listed.listing?.terminal).toBe(false);
    expect(listed.listing?.attached).toBe(true);
    expect(listed.listing?.ownershipTransferred).toBe(false);
    expect(listed.listing?.priorCredentialInvalidated).toBe(false);
    expect(listed.listing?.priorPresentationValid).toBe(true);
    expect(listed.listing?.settlementGate).toBe("UNBOUND");
    expect(listed.listing?.settlementFailure).toBe(false);
    expect(listed.listing?.economicFinalityClaimed).toBe(false);
    expect(listed.listing?.fundsExecuted).toBe(false);
    expect(listed.listing?.venueCredentialReissued).toBe(false);
    expect(listed.listing?.externalMarketplace).toBe("UNSUPPORTED");
    expect(listed.listing?.compensationDefined).toBe(false);
    expect(listed.listing?.mode).toBe("mock");
    expect(listed.listing?.rightEligible).toBe(false);
    expect(listed.right?.eligibility).toBe("LOCKED");
    expect(listed.listing).not.toHaveProperty("amount");
    expect(listed.listing).not.toHaveProperty("currency");
    expect(listed.listing).not.toHaveProperty("sellerDue");
    expect(adapter.describe().surfaces).toContain("wave4.resale.R01-R05.fsm");

    const held = await adapter.viewResalePresentation({ rightId: ISSUE, version: 1, holderRole: SELLER });
    expect(held.matchesCurrentRight).toBe(false);
    expect(held.venueCredentialReissued).toBe(false);
    expect(held.admissionRoutingProduction).toBe(false);

    await expect(
      adapter.acceptResaleTransfer({ transferId: "xfer-early", listingId: LISTING, idempotencyKey: "xfer-early" }),
    ).rejects.toMatchObject({ code: "ILLEGAL_TRANSITION" });
    expect((await adapter.viewResaleCase(LISTING)).phase).toBe("LISTED");
    expect((await adapter.viewResaleCase(LISTING)).lastRejectCode).toBe("ILLEGAL_TRANSITION");

    const pending = await adapter.holdResaleBuy({
      holdId: "hold-buy-1",
      listingId: LISTING,
      buyerRole: RECIPIENT,
      idempotencyKey: "hold-buy-1",
    });
    expect(pending.listing?.phase).toBe("BUY_HELD");
    expect(pending.listing?.pendingSale).toBe(true);
    expect(pending.listing?.buyerRole).toBe(RECIPIENT);

    const released = await adapter.releaseResaleHold({
      holdId: "hold-buy-1",
      buyerRole: RECIPIENT,
      idempotencyKey: "release-buy-1",
    });
    expect(released.listing?.phase).toBe("LISTED");
    expect(released.listing?.buyerRole).toBeNull();

    const paid = await adapter.observeResalePayment({
      listingId: LISTING,
      paymentRef: "mock-resale-noted",
      buyerRole: null,
      idempotencyKey: "pay-1",
    });
    expect(paid.listing?.phase).toBe("PAYMENT_NOTED");
    expect(paid.listing?.pendingSale).toBe(true);
    expect(paid.listing?.paymentRef).toBe("mock-resale-noted");
    expect(paid.fundsExecuted).toBe(false);
    expect(paid.economicFinalityClaimed).toBe(false);

    const transferred = await adapter.acceptResaleTransfer({
      transferId: "xfer-1",
      listingId: LISTING,
      idempotencyKey: "xfer-1",
    });
    expect(transferred.applied).toBe("accept_resale");
    expect(transferred.listing?.phase).toBe("TRANSFERRED");
    expect(transferred.listing?.terminal).toBe(false);
    expect(transferred.listing?.ownershipTransferred).toBe(true);
    expect(transferred.listing?.priorCredentialInvalidated).toBe(true);
    expect(transferred.listing?.priorPresentationValid).toBe(false);
    expect(transferred.listing?.holderRole).toBe(RECIPIENT);
    expect(transferred.listing?.currentVersion).toBe(2);
    expect(transferred.listing?.version).toBe(1);
    expect(transferred.listing?.versionAfter).toBe(2);
    expect(transferred.listing?.generation).toBe(1);
    expect(transferred.listing?.settlementGate).toBe("UNBOUND");
    expect(transferred.listing?.mockSettlementCommitObserved).toBe(false);
    expect(transferred.listing?.economicFinalityClaimed).toBe(false);
    expect(transferred.listing?.fundsExecuted).toBe(false);
    expect(transferred.listing?.venueCredentialReissued).toBe(false);
    expect(transferred.listing?.chainOwnerCurrent).toBe(false);
    expect(transferred.listing?.pendingSale).toBe(false);
    expect(transferred.listing?.rightEligible).toBe(true);
    expect(transferred.evidence).toEqual({
      rightId: ISSUE,
      fromRole: SELLER,
      toRole: RECIPIENT,
      versionAfter: 2,
      fundsExecuted: false,
      chainOwnerCurrent: false,
    });
    expect(transferred.evidence).not.toHaveProperty("sellerDue");
    expect(transferred.evidence).not.toHaveProperty("organizerDue");
    expect(transferred.evidence).not.toHaveProperty("platformDue");
    expect(transferred.listing).not.toHaveProperty("amount");

    const replayed = await adapter.acceptResaleTransfer({
      transferId: "xfer-1",
      listingId: LISTING,
      idempotencyKey: "xfer-1",
    });
    expect(replayed.duplicate).toBe(true);
    expect(replayed.applied).toBeNull();
    expect(replayed.economicFinalityClaimed).toBe(false);
    expect(replayed.evidence?.versionAfter).toBe(2);
    expect(replayed.venueCredentialReissued).toBe(false);

    await expect(
      adapter.acceptResaleTransfer({ transferId: "xfer-2", listingId: LISTING, idempotencyKey: "xfer-2" }),
    ).rejects.toMatchObject({ code: "ILLEGAL_TRANSITION" });
    expect((await adapter.viewResaleCase(LISTING)).currentVersion).toBe(2);

    const stale = await adapter.viewResalePresentation({ rightId: ISSUE, version: 1, holderRole: SELLER });
    expect(stale.matchesCurrentRight).toBe(false);
    expect(stale.venueCredentialReissued).toBe(false);
    const current = await adapter.viewResalePresentation({ rightId: ISSUE, version: 2, holderRole: RECIPIENT });
    expect(current.matchesCurrentRight).toBe(true);
    expect(current.admissionRoutingProduction).toBe(false);
    expect(current.economicFinalityClaimed).toBe(false);

    await expect(adapter.listResaleCase(listInput({ version: 1, idempotencyKey: "list-stale" }))).rejects.toMatchObject({
      code: "ILLEGAL_TRANSITION",
    });
    await expect(
      adapter.listResaleCase(listInput({ listingId: "list-stale", version: 1, sellerRole: RECIPIENT, recipientRole: "buyer-3", idempotencyKey: "list-stale-2" })),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
    const again = await adapter.listResaleCase(
      listInput({
        listingId: "list-2",
        version: 2,
        sellerRole: RECIPIENT,
        recipientRole: "buyer-3",
        idempotencyKey: "list-2",
      }),
    );
    expect(again.listing?.phase).toBe("LISTED");
    expect((await adapter.viewResaleCase(LISTING)).phase).toBe("TRANSFERRED");

    const closed = await adapter.closeResaleListing({ listingId: LISTING, idempotencyKey: "close-1" });
    expect(closed.listing?.phase).toBe("CLOSED");
    expect(closed.listing?.terminal).toBe(true);
    expect(closed.listing?.priorCredentialInvalidated).toBe(true);
    expect(closed.listing?.ownershipTransferred).toBe(true);
    await expect(adapter.closeResaleListing({ listingId: LISTING, idempotencyKey: "close-2" })).rejects.toMatchObject({
      code: "TERMINAL_IMMUTABLE",
    });
    expect((await adapter.viewResaleCase(LISTING)).phase).toBe("CLOSED");

    const report = await adapter.reconcileResale({ listingId: LISTING, idempotencyKey: "recon-1" });
    expect(report.matched).toBe(true);
    expect(report.applied).toBe("reconcile");
    expect(report.economicFinalityClaimed).toBe(false);
    expect(report.fundsExecuted).toBe(false);
    expect(report.listing?.reconcileMatched).toBe(true);
    expect(report.listing?.phase).toBe("CLOSED");
    const replayedReport = await adapter.reconcileResale({ listingId: LISTING, idempotencyKey: "recon-1" });
    expect(replayedReport.duplicate).toBe(true);
    expect(replayedReport.applied).toBeNull();
    expect(replayedReport.matched).toBe(true);
  });

  it("rejects a second live listing, a stale version, and a terminal mutation", async () => {
    const adapter = protocol();
    await issueRight(adapter);
    await adapter.adoptResaleIssued(adoptInput());
    await expect(adapter.listResaleCase(listInput({ version: 2, idempotencyKey: "list-stale" }))).rejects.toMatchObject({
      code: "STALE_VERSION",
    });
    await expect(adapter.viewResaleCase(LISTING)).rejects.toMatchObject({ code: "UNKNOWN_LISTING" });
    await adapter.listResaleCase(listInput());
    await expect(adapter.listResaleCase(listInput({ listingId: "list-2", idempotencyKey: "list-2" }))).rejects.toMatchObject({
      code: "RIGHT_SALE_LOCKED",
    });
    expect((await adapter.viewResaleCase(LISTING)).phase).toBe("LISTED");
    expect((await adapter.viewResaleCase(LISTING)).lastRejectCode).toBe("RIGHT_SALE_LOCKED");

    const cancelled = await adapter.cancelResaleListing({
      listingId: LISTING,
      sellerRole: SELLER,
      idempotencyKey: "cancel-1",
    });
    expect(cancelled.listing?.phase).toBe("CANCELLED");
    expect(cancelled.listing?.terminal).toBe(true);
    expect(cancelled.listing?.pendingSale).toBe(false);
    expect((await adapter.viewResaleRight(ISSUE)).eligible).toBe(true);
    await expect(
      adapter.holdResaleBuy({ holdId: "hold-late", listingId: LISTING, buyerRole: RECIPIENT, idempotencyKey: "hold-late" }),
    ).rejects.toMatchObject({ code: "TERMINAL_IMMUTABLE" });
    await expect(
      adapter.observeResalePayment({
        listingId: LISTING,
        paymentRef: "mock-after-cancel",
        buyerRole: null,
        idempotencyKey: "pay-late",
      }),
    ).rejects.toMatchObject({ code: "TERMINAL_IMMUTABLE" });
    await expect(adapter.listResaleCase(listInput({ idempotencyKey: "list-again" }))).rejects.toMatchObject({
      code: "TERMINAL_IMMUTABLE",
    });
    const relisted = await adapter.listResaleCase(listInput({ listingId: "list-b", idempotencyKey: "list-b" }));
    expect(relisted.listing?.phase).toBe("LISTED");
    expect((await adapter.viewResaleCase(LISTING)).phase).toBe("CANCELLED");
  });

  it("rejects consumed and cancelled reservations before a listing is stored", async () => {
    const cancelled = protocol();
    await cancelled.registerReservationShow({
      showId: SHOW,
      eventId: EVENT,
      idempotencyKey: "show-1",
      slots: [SLOT],
    });
    await cancelled.holdReservation({
      reservationId: RES,
      showId: SHOW,
      slot: SLOT,
      buyerRole: SELLER,
      expiresAt: EXPIRES,
      idempotencyKey: "hold-1",
    });
    await cancelled.confirmReservation({ orderId: ORDER, reservationId: RES, idempotencyKey: "confirm-1" });
    await cancelled.cancelReservation({ reservationId: RES, idempotencyKey: "cancel-res-1" });
    await expect(cancelled.adoptResaleIssued(adoptInput())).rejects.toMatchObject({ code: "TICKET_CANCELLED" });
    await expect(cancelled.listResaleCase(listInput())).rejects.toMatchObject({ code: "TICKET_CANCELLED" });

    const consumed = protocol();
    await issueRight(consumed);
    await consumed.authorizeReservationAdmission({
      admissionId: ADMIT,
      rightId: ISSUE,
      idempotencyKey: "admit-1",
    });
    await expect(consumed.listResaleCase(listInput())).rejects.toMatchObject({ code: "ADMISSION_LOCKED" });
    await consumed.consumeReservation({ consumeId: CONSUME, rightId: ISSUE, idempotencyKey: "consume-1" });
    await expect(consumed.adoptResaleIssued(adoptInput())).rejects.toMatchObject({ code: "ALREADY_CONSUMED" });
    await expect(consumed.listResaleCase(listInput({ idempotencyKey: "list-consumed" }))).rejects.toMatchObject({
      code: "ALREADY_CONSUMED",
    });

    const held = protocol();
    await held.registerReservationShow({
      showId: SHOW,
      eventId: EVENT,
      idempotencyKey: "show-1",
      slots: [SLOT],
    });
    await held.holdReservation({
      reservationId: RES,
      showId: SHOW,
      slot: SLOT,
      buyerRole: SELLER,
      expiresAt: EXPIRES,
      idempotencyKey: "hold-1",
    });
    await expect(held.listResaleCase(listInput())).rejects.toMatchObject({ code: "TICKET_NOT_ISSUED" });
  });

  it("keeps a bound transfer non-final and refuses a failed mock settlement", async () => {
    const waiting = protocol();
    await issueRight(waiting);
    await waiting.adoptResaleIssued(adoptInput());
    await waiting.listResaleCase(listInput());
    await waiting.observeResalePayment({
      listingId: LISTING,
      paymentRef: "mock-resale-noted",
      buyerRole: null,
      idempotencyKey: "pay-1",
    });
    await waiting.initiateSettlement({ settlementId: SETTLEMENT, eventId: EVENT, idempotencyKey: "init-1" });
    await waiting.authorizeSettlement({ settlementId: SETTLEMENT, idempotencyKey: "auth-1" });
    const bound = await waiting.bindResaleSettlement({
      listingId: LISTING,
      settlementId: SETTLEMENT,
      idempotencyKey: "bind-1",
    });
    expect(bound.listing?.settlementGate).toBe("BOUND");
    expect(bound.listing?.mockSettlementCommitObserved).toBe(false);
    expect(bound.listing?.settlementFailure).toBe(false);
    expect(bound.economicFinalityClaimed).toBe(false);
    await expect(
      waiting.acceptResaleTransfer({ transferId: "xfer-early", listingId: LISTING, idempotencyKey: "xfer-early" }),
    ).rejects.toMatchObject({ code: "SETTLEMENT_NOT_COMMITTED" });
    expect((await waiting.viewResaleCase(LISTING)).phase).toBe("PAYMENT_NOTED");
    expect((await waiting.viewResaleCase(LISTING)).currentVersion).toBe(1);
    expect((await waiting.viewSettlement(SETTLEMENT)).phase).toBe("AUTHORIZED");

    await waiting.captureSettlement({ settlementId: SETTLEMENT, idempotencyKey: "cap-1" });
    await waiting.commitSettlement({ settlementId: SETTLEMENT, idempotencyKey: "commit-1" });
    await expect(
      waiting.acceptResaleTransfer({ transferId: "xfer-early", listingId: LISTING, idempotencyKey: "xfer-early" }),
    ).rejects.toMatchObject({ code: "SETTLEMENT_NOT_COMMITTED" });
    const transferred = await waiting.acceptResaleTransfer({
      transferId: "xfer-1",
      listingId: LISTING,
      idempotencyKey: "xfer-committed",
    });
    expect(transferred.listing?.phase).toBe("TRANSFERRED");
    expect(transferred.listing?.settlementGate).toBe("MOCK_COMMIT_OBSERVED");
    expect(transferred.listing?.mockSettlementCommitObserved).toBe(true);
    expect(transferred.listing?.economicFinalityClaimed).toBe(false);
    expect(transferred.listing?.fundsExecuted).toBe(false);
    expect(transferred.listing?.venueCredentialReissued).toBe(false);
    expect(transferred.fundsExecuted).toBe(false);
    expect(transferred.evidence?.fundsExecuted).toBe(false);
    expect((await waiting.viewSettlement(SETTLEMENT)).phase).toBe("COMMITTED");
    expect((await waiting.viewSettlement(SETTLEMENT)).fundsExecuted).toBe(false);

    const failed = protocol();
    await issueRight(failed);
    await failed.adoptResaleIssued(adoptInput());
    await failed.listResaleCase(listInput());
    await failed.observeResalePayment({
      listingId: LISTING,
      paymentRef: "mock-resale-noted",
      buyerRole: null,
      idempotencyKey: "pay-1",
    });
    await failed.initiateSettlement({ settlementId: SETTLEMENT, eventId: EVENT, idempotencyKey: "init-1" });
    await failed.failSettlement({ settlementId: SETTLEMENT, idempotencyKey: "fail-1", reason: "FIXTURE_DECLINE" });
    await failed.bindResaleSettlement({ listingId: LISTING, settlementId: SETTLEMENT, idempotencyKey: "bind-1" });
    const blocked = await failed.viewResaleCase(LISTING);
    expect(blocked.settlementFailure).toBe(true);
    expect(blocked.phase).toBe("PAYMENT_NOTED");
    expect(blocked.economicFinalityClaimed).toBe(false);
    expect(blocked.fundsExecuted).toBe(false);
    expect(blocked.currentVersion).toBe(1);
    await expect(
      failed.acceptResaleTransfer({ transferId: "xfer-f", listingId: LISTING, idempotencyKey: "xfer-f" }),
    ).rejects.toMatchObject({ code: "SETTLEMENT_NOT_COMMITTED" });
    expect((await failed.viewResaleCase(LISTING)).phase).toBe("PAYMENT_NOTED");
    expect((await failed.viewResaleCase(LISTING)).currentVersion).toBe(1);
    expect((await failed.viewSettlement(SETTLEMENT)).phase).toBe("FAILED");
    const report = await failed.reconcileResale({ listingId: LISTING, idempotencyKey: "recon-f" });
    expect(report.matched).toBe(true);
    expect(report.economicFinalityClaimed).toBe(false);

    await expect(failed.rejectExternalResale("EXTERNAL_MARKETPLACE")).rejects.toMatchObject({
      code: "EXTERNAL_UNSUPPORTED",
    });
  });

  it("records the resale dependency baseline without moving the OpenAPI pin", () => {
    expect(RESALE_DEPTH_BASELINE.protocolRepo).toBe("BeautifulMind-JT/kix-protocol");
    expect(RESALE_DEPTH_BASELINE.protocolMainSha).toBe("ef942b7713c7468e8851c6b372b64d42b5333ad8");
    expect(RESALE_DEPTH_BASELINE.featureCommit).toBe("70c6d52d4289e23d0d4141b7f3a6b310eea236f2");
    expect(RESALE_DEPTH_BASELINE.fsmPath).toBe("reference/booking_resale_admission/resale_fsm.py");
    expect(RESALE_DEPTH_BASELINE.provenance).toBe("MOCK_GATE_ONLY");
    expect(OPENAPI_CONTRACT_PIN.openApiFileSha256).toBe(
      "fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e",
    );
    expect(OPENAPI_CONTRACT_PIN.sourceProtocolContractSha256).toBe(
      "ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e",
    );
    expect(OPENAPI_CONTRACT_PIN.contractStatus).toBe("contract-only");
    expect(OPENAPI_CONTRACT_PIN.liveHttpServer).toBe(false);
    expect(OPENAPI_CONTRACT_PIN.productionEndpoint).toBe(false);
    expect(PINNED_ACTIONS).toHaveLength(40);
    expect(isPinnedAction("list_resale")).toBe(false);
    expect(isPinnedAction("accept_resale")).toBe(false);
    expect(isPinnedAction("create_listing")).toBe(true);
    expect(isPinnedAction("accept_trade")).toBe(true);
    expect(isPinnedAction("settle_capture")).toBe(true);
  });

  it("keeps reconcile matched after the reservation moves on to admission and consume", async () => {
    const adapter = protocol();
    await issueRight(adapter);
    await adapter.adoptResaleIssued(adoptInput());
    await adapter.listResaleCase(listInput());
    await adapter.cancelResaleListing({ listingId: LISTING, sellerRole: SELLER, idempotencyKey: "cancel-1" });
    await expect(adapter.reconcileResale({ listingId: LISTING, idempotencyKey: "recon-before" })).resolves.toMatchObject({
      matched: true,
    });

    await adapter.authorizeReservationAdmission({ admissionId: ADMIT, rightId: ISSUE, idempotencyKey: "admit-1" });
    await expect(adapter.reconcileResale({ listingId: LISTING, idempotencyKey: "recon-admitted" })).resolves.toMatchObject({
      matched: true,
    });

    await adapter.consumeReservation({ consumeId: CONSUME, rightId: ISSUE, idempotencyKey: "consume-1" });
    await expect(adapter.reconcileResale({ listingId: LISTING, idempotencyKey: "recon-consumed" })).resolves.toMatchObject({
      matched: true,
    });
    const view = await adapter.viewResaleCase(LISTING);
    expect(view.reconcileMatched).toBe(true);
    expect(view.lastRejectCode).toBeNull();

    await expect(adapter.listResaleCase(listInput({ listingId: "list-2" }))).rejects.toMatchObject({
      code: "ALREADY_CONSUMED",
    });
  });
});

describe("http resale commands stay not-bound", () => {
  it("does not send resale FSM commands or invent a marketplace endpoint", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    };
    const adapter = new HttpProtocolAdapter("http://127.0.0.1:8765", fetchImpl);
    expect(() => createProtocol({ mode: "http" })).toThrow(ProtocolError);

    await expect(adapter.advanceResaleClock({ idempotencyKey: "clock-http", nowAt: EXPIRES })).rejects.toThrow(
      /not-bound/,
    );
    await expect(adapter.adoptResaleIssued(adoptInput())).rejects.toThrow(/not-bound/);
    await expect(adapter.listResaleCase(listInput())).rejects.toThrow(/not-bound/);
    await expect(
      adapter.holdResaleBuy({ holdId: "hold-http", listingId: LISTING, buyerRole: RECIPIENT, idempotencyKey: "hold-http" }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      adapter.releaseResaleHold({ holdId: "hold-http", buyerRole: RECIPIENT, idempotencyKey: "release-http" }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      adapter.cancelResaleListing({ listingId: LISTING, sellerRole: SELLER, idempotencyKey: "cancel-http" }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      adapter.observeResalePayment({
        listingId: LISTING,
        paymentRef: "mock-resale-noted",
        buyerRole: null,
        idempotencyKey: "pay-http",
      }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      adapter.bindResaleSettlement({ listingId: LISTING, settlementId: SETTLEMENT, idempotencyKey: "bind-http" }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      adapter.acceptResaleTransfer({ transferId: "xfer-http", listingId: LISTING, idempotencyKey: "xfer-http" }),
    ).rejects.toThrow(/not-bound/);
    await expect(adapter.closeResaleListing({ listingId: LISTING, idempotencyKey: "close-http" })).rejects.toThrow(
      /not-bound/,
    );
    await expect(adapter.reconcileResale({ listingId: LISTING, idempotencyKey: "recon-http" })).rejects.toThrow(
      /not-bound/,
    );
    await expect(adapter.viewResaleCase(LISTING)).rejects.toThrow(/not-bound/);
    await expect(adapter.viewResaleRight(ISSUE)).rejects.toThrow(/not-bound/);
    await expect(
      adapter.viewResalePresentation({ rightId: ISSUE, version: 1, holderRole: SELLER }),
    ).rejects.toThrow(/not-bound/);
    await expect(adapter.rejectExternalResale("EXTERNAL_MARKETPLACE")).rejects.toThrow(/not-bound/);
    await expect(adapter.openResale({ bookingId: "bkg_9", askLabel: "display" })).rejects.toThrow(/not-bound/);
    await expect(adapter.acceptResale("rsl_9")).rejects.toThrow(/not-bound/);

    expect(calls).toEqual([]);
    expect(COMMERCE_COMMAND_BINDINGS.listResaleCase.status).toBe("not-bound");
    expect(COMMERCE_COMMAND_BINDINGS.listResaleCase.consideredAction).toBeNull();
    expect(COMMERCE_COMMAND_BINDINGS.listResaleCase.reason).toMatch(/not create_listing/);
    expect(COMMERCE_COMMAND_BINDINGS.acceptResaleTransfer.consideredAction).toBeNull();
    expect(COMMERCE_COMMAND_BINDINGS.acceptResaleTransfer.reason).toMatch(/not accept_trade/);
    expect(COMMERCE_COMMAND_BINDINGS.bindResaleSettlement.reason).toMatch(/does not send settle_capture/);
    expect(COMMERCE_COMMAND_BINDINGS.observeResalePayment.reason).toMatch(/not observe_funding/);
    expect(COMMERCE_COMMAND_BINDINGS.viewResalePresentation.reason).toMatch(/not a venue scan/);
    expect(CONTRACT_ONLY_LOCAL_CALL_PATH).toBe("/x-kix-contract-only/local-call");
  });
});

describe("resale payload guards", () => {
  it("keeps resale payloads mock and rejects marketplace claims", async () => {
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

    responseBody = localCallReceipt("op-resale-ok", "close_sales", {
      listingId: LISTING,
      mode: "mock",
      phase: "TRANSFERRED",
      provenance: "MOCK_GATE_ONLY",
      references: ["R01", "R02", "R03", "R04", "R05"],
      economicFinalityClaimed: false,
      fundsExecuted: false,
      venueCredentialReissued: false,
      externalMarketplace: "UNSUPPORTED",
      priorCredentialInvalidated: true,
      note: "Simulated mock phase. Not live marketplace.",
    });
    await expect(call("op-resale-ok")).resolves.toMatchObject({
      result: { phase: "TRANSFERRED", economicFinalityClaimed: false, mode: "mock" },
    });

    responseBody = {
      listingId: LISTING,
      mode: "mock",
      phase: "PAYMENT_NOTED",
      provenance: "MOCK_GATE_ONLY",
      economicFinalityClaimed: true,
    };
    await expect(call("op-resale-final")).rejects.toThrow(/economic finality/);

    responseBody = {
      listingId: LISTING,
      mode: "live",
      phase: "LISTED",
      provenance: "MOCK_GATE_ONLY",
      economicFinalityClaimed: false,
    };
    await expect(call("op-resale-live")).rejects.toThrow(/mock mode/);

    responseBody = {
      listingId: LISTING,
      mode: "mock",
      phase: "LISTED",
      provenance: "MOCK_GATE_ONLY",
      economicFinalityClaimed: false,
      venueCredentialReissued: true,
    };
    await expect(call("op-resale-venue")).rejects.toThrow(/venue credential reissue/);

    responseBody = {
      listingId: LISTING,
      mode: "mock",
      phase: "LISTED",
      provenance: "MOCK_GATE_ONLY",
      economicFinalityClaimed: false,
      externalMarketplace: "LIVE",
    };
    await expect(call("op-resale-market")).rejects.toThrow(/external marketplace unsupported/);

    responseBody = {
      listingId: LISTING,
      mode: "mock",
      phase: "LISTED",
      provenance: "MOCK_GATE_ONLY",
      economicFinalityClaimed: false,
      sellerDue: 1,
    };
    await expect(call("op-resale-fee")).rejects.toThrow(/amount or a fee split/);

    responseBody = {
      listingId: LISTING,
      mode: "mock",
      phase: "LISTED",
      provenance: "MOCK_GATE_ONLY",
      economicFinalityClaimed: false,
      note: "KYC cleared",
    };
    await expect(call("op-resale-copy")).rejects.toThrow(/production-marketplace wording/);
  });
});
