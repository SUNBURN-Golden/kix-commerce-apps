import { describe, expect, it } from "vitest";
import {
  ADMISSION_CASE_NOTE,
  ADMISSION_DEPTH_BASELINE,
  ADMISSION_DESK_STATES,
  ADMISSION_TRANSPORT_NOTE,
  COMMERCE_COMMAND_BINDINGS,
  HttpProtocolAdapter,
  OPENAPI_CONTRACT_PIN,
  OPENAPI_INTEGRATION_GATE_PIN,
  PINNED_PROTOCOL_DOMAIN,
  ProtocolError,
  StubProtocolAdapter,
  admissionDeskState,
  echoIntegrationGateHeaders,
} from "../src/index.js";
import { AdmissionCaseStore, type AdmissionSources } from "../src/admission-case.js";

const SHOW = "show_evt_lanterns";
const EVENT = "evt_lanterns";
const RES = "rsv_evt_lanterns";
const ORDER = "ord_evt_lanterns";
const ISSUE = "iss_evt_lanterns";
const ADMIT = "adm_evt_lanterns";
const CONSUME = "csm_evt_lanterns";
const SLOT = "slot-0";
const EXPIRES = "2099-01-01T00:00:00.000Z";
const WINDOW = "2099-06-01T00:00:00.000Z";
const HOLDER = "buyer-1";
const GATE = "gate-a";
const REQUEST = "desk-request";

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
    buyerRole: HOLDER,
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
    idempotencyKey: "pay-1",
    paymentRef: "mock-noted",
  });
  return adapter.issueReservation({
    issuanceId: ISSUE,
    orderId: ORDER,
    idempotencyKey: "issue-1",
  });
}

function present(adapter: StubProtocolAdapter, version = 1, holderRole = HOLDER) {
  return adapter.presentAdmission({ rightId: ISSUE, version, holderRole });
}

describe("admission desk labels", () => {
  it("classifies protocol and transport codes the same way for stub and HTTP", () => {
    expect(ADMISSION_DESK_STATES).toEqual([
      "valid",
      "invalid",
      "stale",
      "already-consumed",
      "transferred",
      "cancelled",
      "unavailable-server",
    ]);
    const rows: Array<{ decision: string | null; fresh: boolean; transferObserved: boolean; state: string }> = [
      { decision: null, fresh: true, transferObserved: false, state: "valid" },
      { decision: "UNKNOWN_RIGHT", fresh: false, transferObserved: false, state: "invalid" },
      { decision: "TICKET_NOT_FOUND", fresh: false, transferObserved: false, state: "invalid" },
      { decision: "NOT_HOLDER", fresh: false, transferObserved: false, state: "invalid" },
      { decision: "TICKET_NOT_ISSUED", fresh: false, transferObserved: false, state: "invalid" },
      { decision: "ADMISSION_REQUIRED", fresh: false, transferObserved: false, state: "invalid" },
      { decision: "RIGHT_NOT_ADMISSIBLE", fresh: false, transferObserved: false, state: "invalid" },
      { decision: "ADMITTED_ONCE", fresh: false, transferObserved: false, state: "invalid" },
      { decision: "NOT_BOUND", fresh: false, transferObserved: false, state: "invalid" },
      { decision: "STALE_VERSION", fresh: false, transferObserved: false, state: "stale" },
      { decision: "STALE_OR_WRONG_PRESENTATION", fresh: false, transferObserved: false, state: "stale" },
      { decision: "ADMISSION_EXPIRED", fresh: false, transferObserved: false, state: "stale" },
      { decision: "ALREADY_CONSUMED", fresh: false, transferObserved: false, state: "already-consumed" },
      { decision: "STALE_VERSION", fresh: false, transferObserved: true, state: "transferred" },
      { decision: "TICKET_CANCELLED", fresh: false, transferObserved: false, state: "cancelled" },
      { decision: "GATE_UNAVAILABLE", fresh: false, transferObserved: false, state: "unavailable-server" },
      { decision: "NOT_READY", fresh: false, transferObserved: false, state: "unavailable-server" },
      { decision: "STALE_RESPONSE", fresh: false, transferObserved: false, state: "unavailable-server" },
      { decision: "OVERLOADED", fresh: false, transferObserved: false, state: "unavailable-server" },
      { decision: "TICKET_SOURCE_UNAVAILABLE", fresh: false, transferObserved: false, state: "unavailable-server" },
      { decision: "VENUE_SOURCE_UNAVAILABLE", fresh: false, transferObserved: false, state: "unavailable-server" },
    ];
    for (const row of rows) {
      expect(admissionDeskState(row)).toBe(row.state);
    }
    expect(ADMISSION_DEPTH_BASELINE.protocolMainSha).toBe("3b6bdd26f61bb828af3781946b63a3a3fa03187b");
    expect(ADMISSION_DEPTH_BASELINE.featureCommit).toBe("38a3d68f714100e385ba9e2b7716ed2e5b890d12");
    expect(OPENAPI_CONTRACT_PIN.openApiFileSha256).toBe(
      "fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e",
    );
    expect(OPENAPI_INTEGRATION_GATE_PIN.openApiFileSha256).toBe(
      "2a2af554cb1a8b128f2cf1b1d5b8cf6b1c8fa90adf30865dbc3e64932b3bd13f",
    );
    expect(OPENAPI_INTEGRATION_GATE_PIN.sourceProtocolContractSha256).toBe(
      "ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e",
    );
    expect(OPENAPI_INTEGRATION_GATE_PIN.productionEndpoint).toBe(false);
  });
});

describe("stub admission credential", () => {
  it("admits a fresh issued credential once and replays without a second consume", async () => {
    const adapter = protocol();
    await issueRight(adapter);
    const fresh = await present(adapter);
    expect(fresh.deskState).toBe("invalid");
    expect(fresh.decision).toBe("UNKNOWN_RIGHT");
    expect(fresh.fresh).toBe(false);
    expect(fresh.admissionRoutingProduction).toBe(false);
    expect(fresh.externalAdmission).toBe("UNSUPPORTED");
    expect(fresh.offlineAdmission).toBe(false);

    const adopted = await adapter.adoptAdmissionIssued({
      rightId: ISSUE,
      reservationId: RES,
      idempotencyKey: "adopt-1",
    });
    expect(adopted.duplicate).toBe(false);
    expect(adopted.applied).toBe("adopt_issued");
    expect(adopted.credential?.phase).toBe("ELIGIBLE");
    expect(adopted.presentation.deskState).toBe("valid");
    expect(adopted.presentation.fresh).toBe(true);
    expect(adopted.presentation.decision).toBeNull();
    expect(adopted.admissionRoutingProduction).toBe(false);
    expect(adopted.venueCredentialReissued).toBe(false);
    expect(adopted.economicFinalityClaimed).toBe(false);
    expect(adopted.fundsExecuted).toBe(false);
    expect(adopted.presentation.note).toBe(ADMISSION_CASE_NOTE);
    for (const pattern of BANNED_COPY) {
      expect(adopted.presentation.note).not.toMatch(pattern);
    }

    await expect(
      adapter.consumeAdmissionCredential({
        consumeId: CONSUME,
        rightId: ISSUE,
        version: 1,
        gateRole: GATE,
        request: REQUEST,
        idempotencyKey: "consume-early",
      }),
    ).rejects.toMatchObject({ code: "ADMISSION_REQUIRED" });
    expect((await adapter.viewReservation(RES)).phase).toBe("ISSUED");
    expect((await present(adapter)).phase).toBe("ELIGIBLE");

    const authorized = await adapter.authorizeAdmissionCredential({
      admissionId: ADMIT,
      rightId: ISSUE,
      version: 1,
      holderRole: HOLDER,
      gateRole: GATE,
      request: REQUEST,
      expiresAt: WINDOW,
      idempotencyKey: "admit-1",
    });
    expect(authorized.applied).toBe("authorize_admission");
    expect(authorized.credential?.phase).toBe("AUTHORIZED");
    expect(authorized.presentation.deskState).toBe("valid");
    expect((await adapter.viewReservation(RES)).phase).toBe("ADMISSION_AUTHORIZED");
    expect((await adapter.viewReservation(RES)).admissionRoutingProduction).toBe(false);

    await expect(
      adapter.consumeAdmissionCredential({
        consumeId: "csm-other-gate",
        rightId: ISSUE,
        version: 1,
        gateRole: "gate-b",
        request: REQUEST,
        idempotencyKey: "consume-gate",
      }),
    ).rejects.toMatchObject({ code: "GATE_MISMATCH" });
    expect((await adapter.viewReservation(RES)).phase).toBe("ADMISSION_AUTHORIZED");

    const consumed = await adapter.consumeAdmissionCredential({
      consumeId: CONSUME,
      rightId: ISSUE,
      version: 1,
      gateRole: GATE,
      request: REQUEST,
      idempotencyKey: "consume-1",
    });
    expect(consumed.applied).toBe("consume");
    expect(consumed.duplicate).toBe(false);
    expect(consumed.credential?.phase).toBe("CONSUMED");
    expect(consumed.credential?.version).toBe(2);
    expect(consumed.credential?.terminal).toBe(true);
    expect(consumed.presentation.deskState).toBe("already-consumed");
    expect((await adapter.viewReservation(RES)).phase).toBe("CONSUMED");

    const replay = await adapter.consumeAdmissionCredential({
      consumeId: CONSUME,
      rightId: ISSUE,
      version: 1,
      gateRole: GATE,
      request: REQUEST,
      idempotencyKey: "consume-1",
    });
    expect(replay.duplicate).toBe(true);
    expect(replay.applied).toBeNull();
    expect(replay.credential?.version).toBe(2);
    expect(replay.admissionRoutingProduction).toBe(false);

    await expect(
      adapter.consumeAdmissionCredential({
        consumeId: "csm_again",
        rightId: ISSUE,
        version: 2,
        gateRole: GATE,
        request: REQUEST,
        idempotencyKey: "consume-2",
      }),
    ).rejects.toMatchObject({ code: "ALREADY_CONSUMED" });
    expect((await present(adapter, 2)).deskState).toBe("already-consumed");
    expect((await adapter.viewReservation(RES)).phase).toBe("CONSUMED");

    await expect(adapter.rejectExternalAdmission("venue-scanner")).rejects.toMatchObject({
      code: "EXTERNAL_UNSUPPORTED",
    });
    expect((await present(adapter)).deskState).toBe("already-consumed");
    expect((await present(adapter)).admissionRoutingProduction).toBe(false);

    const report = await adapter.reconcileAdmission({ rightId: ISSUE, idempotencyKey: "recon-1" });
    expect(report.matched).toBe(true);
    expect(report.credential?.reconcileMatched).toBe(true);
    expect(report.economicFinalityClaimed).toBe(false);
  });

  it("rejects stale, cancelled, transferred, and unavailable reads without consuming", async () => {
    const adapter = protocol();
    await issueRight(adapter);
    await adapter.adoptAdmissionIssued({ rightId: ISSUE, reservationId: RES, idempotencyKey: "adopt-1" });

    const stale = await present(adapter, 2);
    expect(stale.deskState).toBe("stale");
    expect(stale.decision).toBe("STALE_VERSION");
    expect(stale.fresh).toBe(false);
    await expect(
      adapter.authorizeAdmissionCredential({
        admissionId: ADMIT,
        rightId: ISSUE,
        version: 2,
        holderRole: HOLDER,
        gateRole: GATE,
        request: REQUEST,
        expiresAt: WINDOW,
        idempotencyKey: "admit-stale",
      }),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
    expect((await adapter.viewReservation(RES)).phase).toBe("ISSUED");
    expect((await present(adapter)).phase).toBe("ELIGIBLE");

    const wrongHolder = await present(adapter, 1, "buyer-2");
    expect(wrongHolder.deskState).toBe("invalid");
    expect(wrongHolder.decision).toBe("NOT_HOLDER");

    await expect(
      adapter.authorizeAdmissionCredential({
        admissionId: "adm-venue",
        rightId: ISSUE,
        version: 1,
        holderRole: HOLDER,
        gateRole: GATE,
        request: REQUEST,
        expiresAt: WINDOW,
        idempotencyKey: "admit-venue",
        externalDependency: "VENUE_IDENTITY",
      }),
    ).rejects.toMatchObject({ code: "VENUE_SOURCE_UNAVAILABLE" });
    expect((await present(adapter)).deskState).toBe("valid");

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
      buyerRole: HOLDER,
      expiresAt: EXPIRES,
      idempotencyKey: "hold-1",
    });
    await cancelled.confirmReservation({
      orderId: ORDER,
      reservationId: RES,
      idempotencyKey: "confirm-1",
    });
    await cancelled.cancelReservation({ reservationId: RES, idempotencyKey: "cancel-1" });
    await expect(
      cancelled.adoptAdmissionIssued({ rightId: ISSUE, reservationId: RES, idempotencyKey: "adopt-cancel" }),
    ).rejects.toMatchObject({ code: "TICKET_CANCELLED" });
    const cancelledView = await cancelled.presentAdmission({ rightId: ISSUE, version: 1, holderRole: HOLDER });
    expect(cancelledView.deskState).toBe("cancelled");
    expect(cancelledView.decision).toBe("TICKET_CANCELLED");
    expect(cancelledView.fresh).toBe(false);

    await adapter.adoptResaleIssued({
      rightId: ISSUE,
      showId: SHOW,
      eventId: EVENT,
      slot: SLOT,
      holderRole: HOLDER,
      reservationId: RES,
      paymentRef: "mock-issued",
      idempotencyKey: "resale-adopt",
    });
    await adapter.listResaleCase({
      listingId: "list-1",
      rightId: ISSUE,
      version: 1,
      sellerRole: HOLDER,
      recipientRole: "buyer-2",
      expiresAt: WINDOW,
      reservationId: RES,
      idempotencyKey: "list-1",
    });
    await expect(
      adapter.authorizeAdmissionCredential({
        admissionId: "adm-listed",
        rightId: ISSUE,
        version: 1,
        holderRole: HOLDER,
        gateRole: GATE,
        request: REQUEST,
        expiresAt: WINDOW,
        idempotencyKey: "admit-listed",
      }),
    ).rejects.toMatchObject({ code: "LISTING_LOCKED" });
    expect((await present(adapter)).deskState).toBe("invalid");
    expect((await present(adapter)).decision).toBe("LISTING_LOCKED");
    expect((await adapter.viewReservation(RES)).phase).toBe("ISSUED");

    await adapter.observeResalePayment({
      listingId: "list-1",
      paymentRef: "mock-resale-noted",
      buyerRole: null,
      idempotencyKey: "sale-pay",
    });
    await adapter.acceptResaleTransfer({
      transferId: "xfer-1",
      listingId: "list-1",
      idempotencyKey: "xfer-1",
    });
    const prior = await present(adapter, 1, HOLDER);
    expect(prior.deskState).toBe("transferred");
    expect(prior.decision).toBe("STALE_VERSION");
    expect(prior.transferObserved).toBe(true);
    expect(prior.venueCredentialReissued).toBe(false);
    const moved = await present(adapter, 2, "buyer-2");
    expect(moved.deskState).toBe("transferred");
    expect(moved.fresh).toBe(false);
    await expect(
      adapter.authorizeAdmissionCredential({
        admissionId: "adm-moved",
        rightId: ISSUE,
        version: 2,
        holderRole: "buyer-2",
        gateRole: GATE,
        request: REQUEST,
        expiresAt: WINDOW,
        idempotencyKey: "admit-moved",
      }),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
    expect((await adapter.viewReservation(RES)).phase).toBe("ISSUED");
    expect((await adapter.viewReservation(RES)).admissionRoutingProduction).toBe(false);
  });

  it("keeps a rejected consume key rejected and does not expire into a consume", async () => {
    const adapter = protocol();
    await issueRight(adapter);
    await adapter.adoptAdmissionIssued({ rightId: ISSUE, reservationId: RES, idempotencyKey: "adopt-1" });
    await expect(
      adapter.consumeAdmissionCredential({
        consumeId: CONSUME,
        rightId: ISSUE,
        version: 1,
        gateRole: GATE,
        request: REQUEST,
        idempotencyKey: "consume-held",
      }),
    ).rejects.toMatchObject({ code: "ADMISSION_REQUIRED" });
    await adapter.authorizeAdmissionCredential({
      admissionId: ADMIT,
      rightId: ISSUE,
      version: 1,
      holderRole: HOLDER,
      gateRole: GATE,
      request: REQUEST,
      expiresAt: WINDOW,
      idempotencyKey: "admit-1",
    });
    await expect(
      adapter.consumeAdmissionCredential({
        consumeId: CONSUME,
        rightId: ISSUE,
        version: 1,
        gateRole: GATE,
        request: REQUEST,
        idempotencyKey: "consume-held",
      }),
    ).rejects.toMatchObject({ code: "ADMISSION_REQUIRED" });
    expect((await adapter.viewReservation(RES)).phase).toBe("ADMISSION_AUTHORIZED");

    await expect(
      adapter.consumeAdmissionCredential({
        consumeId: "csm-mismatch",
        rightId: ISSUE,
        version: 1,
        gateRole: GATE,
        request: "other-request",
        idempotencyKey: "consume-request",
      }),
    ).rejects.toMatchObject({ code: "ADMISSION_REQUEST_MISMATCH" });

    await adapter.advanceAdmissionClock({ idempotencyKey: "clock-1", nowAt: "2099-07-01T00:00:00.000Z" });
    await expect(
      adapter.consumeAdmissionCredential({
        consumeId: "csm-late",
        rightId: ISSUE,
        version: 1,
        gateRole: GATE,
        request: REQUEST,
        idempotencyKey: "consume-late",
      }),
    ).rejects.toMatchObject({ code: "ADMISSION_EXPIRED" });
    const expired = await present(adapter);
    expect(expired.deskState).toBe("stale");
    expect(expired.decision).toBe("ADMISSION_EXPIRED");
    expect(expired.phase).toBe("AUTHORIZED");
    expect((await adapter.viewReservation(RES)).phase).toBe("ADMISSION_AUTHORIZED");

  });

  it("fails closed when ownership is down or a settlement view claims admission", () => {
    let authorized = false;
    const sources: AdmissionSources = {
      viewReservation: () => issuedView("stl-1"),
      authorizeReservation: () => {
        authorized = true;
        throw new Error("authorize should not run");
      },
      consumeReservation: () => {
        throw new Error("consume should not run");
      },
      viewResaleRight: () => {
        throw new Error("ownership down");
      },
      viewResalePresentation: () => {
        throw new Error("ownership down");
      },
      viewSettlement: () => ({
        fundsExecuted: false,
        economicFinalityClaimed: false,
        admissionGranted: false,
      }),
    };
    const down = new AdmissionCaseStore(sources, { ownershipDown: true });
    down.adoptIssued({ rightId: ISSUE, reservationId: RES, idempotencyKey: "adopt-down" });
    expect(() =>
      down.authorize({
        admissionId: ADMIT,
        rightId: ISSUE,
        version: 1,
        holderRole: HOLDER,
        gateRole: GATE,
        request: REQUEST,
        expiresAt: WINDOW,
        idempotencyKey: "admit-down",
      }),
    ).toThrow(ProtocolError);
    try {
      down.authorize({
        admissionId: ADMIT,
        rightId: ISSUE,
        version: 1,
        holderRole: HOLDER,
        gateRole: GATE,
        request: REQUEST,
        expiresAt: WINDOW,
        idempotencyKey: "admit-down-2",
      });
    } catch (error) {
      expect(error).toMatchObject({ code: "OWNERSHIP_SOURCE_UNAVAILABLE" });
    }
    expect(authorized).toBe(false);
    expect(down.present({ rightId: ISSUE, version: 1, holderRole: HOLDER }).deskState).toBe("unavailable-server");

    const granted = new AdmissionCaseStore({
      ...sources,
      viewResaleRight: () => {
        throw new ProtocolError("UNKNOWN_RIGHT: mock resale command rejected.", "UNKNOWN_RIGHT");
      },
      viewSettlement: () => ({
        fundsExecuted: false,
        economicFinalityClaimed: false,
        admissionGranted: true,
      }),
    });
    granted.adoptIssued({ rightId: ISSUE, reservationId: RES, idempotencyKey: "adopt-granted" });
    expect(() =>
      granted.authorize({
        admissionId: "adm-granted",
        rightId: ISSUE,
        version: 1,
        holderRole: HOLDER,
        gateRole: GATE,
        request: REQUEST,
        expiresAt: WINDOW,
        idempotencyKey: "admit-granted",
      }),
    ).toThrow(/SETTLEMENT_VIEW_REJECTED/);
    expect(granted.present({ rightId: ISSUE, version: 1, holderRole: HOLDER }).fresh).toBe(false);
    expect(granted.present({ rightId: ISSUE, version: 1, holderRole: HOLDER }).admissionRoutingProduction).toBe(false);
  });
});

function issuedView(settlementId: string | null) {
  return {
    mode: "mock" as const,
    surface: "wave4.booking.B01-B05.fsm" as const,
    admissionSurface: "wave4.admission.P03.fsm" as const,
    references: ["B01", "B02", "B03", "B04", "B05"] as const,
    admissionReference: "P03" as const,
    provenance: "MOCK_GATE_ONLY" as const,
    lifecycleAuthority: "IN_MEMORY_FSM" as const,
    reservationId: RES,
    phase: "ISSUED" as const,
    terminal: false,
    showId: SHOW,
    eventId: EVENT,
    slot: SLOT,
    slotState: "ISSUED" as const,
    slotHeldByCase: true,
    buyerRole: HOLDER,
    expiresAt: EXPIRES,
    expired: false,
    orderId: ORDER,
    paymentRef: "mock-noted",
    issuanceId: ISSUE,
    rightId: ISSUE,
    issueStatus: "issued" as const,
    admissionId: null,
    consumeId: null,
    settlementId,
    settlementGate: "UNBOUND" as const,
    mockSettlementCommitObserved: false,
    economicFinalityClaimed: false as const,
    fundsExecuted: false as const,
    chainIssued: false as const,
    admissionRoutingProduction: false as const,
    externalPayment: "UNSUPPORTED" as const,
    externalAdmission: "UNSUPPORTED" as const,
    logicalTimeMs: 0,
    idempotencyKey: "issue-1",
    lastRejectCode: null,
    reconcileMatched: null,
    note: "Simulated mock phase on the adapter stub. Not live admission.",
  };
}

describe("http admission boundary", () => {
  it("returns unavailable-server when the gate is closed and does not post admit", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input));
      throw new Error("connect ECONNREFUSED");
    };
    const http = new HttpProtocolAdapter("http://127.0.0.1:9", fetchImpl);
    await expect(
      http.authorizeAdmissionCredential({
        admissionId: ADMIT,
        rightId: ISSUE,
        version: 1,
        holderRole: HOLDER,
        gateRole: GATE,
        request: REQUEST,
        expiresAt: WINDOW,
        idempotencyKey: "admit-http",
      }),
    ).rejects.toThrow(/not-bound/);
    await expect(
      http.consumeAdmissionCredential({
        consumeId: CONSUME,
        rightId: ISSUE,
        version: 1,
        gateRole: GATE,
        request: REQUEST,
        idempotencyKey: "consume-http",
      }),
    ).rejects.toThrow(/not-bound/);
    expect(calls).toEqual([]);

    const boundary = await http.presentAdmission({ rightId: ISSUE, version: 1, holderRole: HOLDER });
    expect(boundary.mode).toBe("http-boundary");
    expect(boundary.deskState).toBe("unavailable-server");
    expect(boundary.decision).toBe("GATE_UNAVAILABLE");
    expect(boundary.fresh).toBe(false);
    expect(boundary.admissionRoutingProduction).toBe(false);
    expect(boundary.externalAdmission).toBe("UNSUPPORTED");
    expect(boundary.offlineAdmission).toBe(false);
    expect(boundary.note).toBe(ADMISSION_TRANSPORT_NOTE);
    expect(boundary.deskState).toBe(admissionDeskState({ decision: "GATE_UNAVAILABLE", fresh: false, transferObserved: false }));
    expect(calls.every((url) => new URL(url).pathname === "/health")).toBe(true);
    expect(calls.some((url) => url.includes("local-call"))).toBe(false);

    const stub = protocol();
    const missing = await stub.presentAdmission({ rightId: ISSUE, version: 1, holderRole: HOLDER });
    expect(missing.deskState).toBe(
      admissionDeskState({ decision: "TICKET_NOT_FOUND", fresh: false, transferObserved: false }),
    );
    expect(missing.deskState).toBe("invalid");
  });

  it("treats a reachable gate as not-bound rather than a fresh credential", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push(`${init?.method ?? "GET"} ${String(input)}`);
      return new Response(
        JSON.stringify({
          status: "up",
          role: "integration-gate",
          liveHttpServer: "non-production-local-integration",
          production: false,
          publicHost: false,
          productionReadiness: false,
          productionConformance: false,
          protocolTruth: false,
          localFileJournal: false,
        }),
        {
          status: 200,
          headers: echoIntegrationGateHeaders(init),
        },
      );
    };
    const http = new HttpProtocolAdapter("http://127.0.0.1:8765", fetchImpl);
    const boundary = await http.presentAdmission({ rightId: ISSUE, version: 1, holderRole: HOLDER });
    expect(boundary.deskState).toBe("invalid");
    expect(boundary.decision).toBe("NOT_BOUND");
    expect(boundary.fresh).toBe(false);
    expect(boundary.admissionRoutingProduction).toBe(false);
    expect(boundary.note).toBe(ADMISSION_TRANSPORT_NOTE);
    expect(calls).toEqual(["GET http://127.0.0.1:8765/health"]);
    expect(COMMERCE_COMMAND_BINDINGS.presentAdmission.status).toBe("not-bound");
    expect(COMMERCE_COMMAND_BINDINGS.presentAdmission.consideredAction).toBeNull();
    expect(COMMERCE_COMMAND_BINDINGS.authorizeAdmissionCredential.reason).toMatch(/not admit/);
    expect(COMMERCE_COMMAND_BINDINGS.consumeAdmissionCredential.reason).toMatch(/does not scan a venue/);
    expect(COMMERCE_COMMAND_BINDINGS.consumeAdmissionCredential.consideredAction).toBeNull();
  });

  it("rejects an unknown admission action before a request", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    };
    const http = new HttpProtocolAdapter("http://127.0.0.1:8765", fetchImpl);
    await expect(
      http.invokeLocalCall({
        operationId: "op-auth",
        actor: "venue",
        action: "authorize_admission",
        body: { domain: PINNED_PROTOCOL_DOMAIN },
      }),
    ).rejects.toThrow(/Unknown protocol action/);
    await expect(
      http.invokeLocalCall({
        operationId: "op-consume",
        actor: "venue",
        action: "consume_admission",
        body: { domain: PINNED_PROTOCOL_DOMAIN },
      }),
    ).rejects.toThrow(/Unknown protocol action/);
    expect(calls).toEqual([]);
  });
});
