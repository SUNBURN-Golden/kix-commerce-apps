import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  DISCOVERY_READ_TUPLE_LITERALS,
  MOBILE_AS_OF,
  MOBILE_DESK_ACTOR,
  MOBILE_DEVICE_ID,
  MOBILE_ENVIRONMENT,
  MOBILE_GUEST_ACTOR,
  MOBILE_HOLD_NOT_BOUND,
  MOBILE_IDENTITY_REGISTER,
  MOBILE_NON_CLAIM_FIELDS,
  MOBILE_NOT_BOUND_REASON,
  MOBILE_NOT_COMPOSED,
  MOBILE_REF_KINDS,
  MOBILE_RULING,
  MOBILE_SCENARIOS,
  MOBILE_STALE_FLOOR,
  MOBILE_STEPS,
  MOBILE_UNIT,
  PINNED_ACTIONS,
  createNotBoundMobileShell,
  createStubMobileShell,
  isMobileRef,
  mobileNotComposedFor,
  mobileRef,
  mobileRefKind,
  mobileShellPortFor,
  refuseMobileReceipt,
  refuseMobileSnapshot,
  type MobileReadOutcome,
  type MobileSnapshot,
  type MobileWriteRequest,
  type StubMobileShell,
} from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

const CTX = "stub|kix:fixture:lifecycle:0.3|mobile-owner|dev-0001|1";
const IN_STEP = MOBILE_AS_OF;

function base(intentRef: string) {
  return {
    contextKey: CTX,
    actorRef: MOBILE_DESK_ACTOR,
    deviceId: MOBILE_DEVICE_ID,
    intentRef,
    declaredEnvironment: MOBILE_ENVIRONMENT,
  };
}

async function snapshotOf(port: StubMobileShell, deviceNow: string | null = IN_STEP): Promise<MobileSnapshot> {
  const outcome = await port.read({
    contextKey: CTX,
    actorRef: MOBILE_DESK_ACTOR,
    deviceId: MOBILE_DEVICE_ID,
    watermarkFloor: null,
    deviceNow,
  });
  if (outcome.kind !== "ready") {
    throw new Error(`expected a ready read, received ${outcome.kind}`);
  }
  return outcome.snapshot;
}

function installRequest(intentRef: string): MobileWriteRequest {
  return { ...base(intentRef), step: "install", packaging: "installable-web" };
}

function updateRequest(intentRef: string, updateRef = "upd-0001", version = 1): MobileWriteRequest {
  return { ...base(intentRef), step: "update", updateRef, expectedVersion: version };
}

function reconnectRequest(intentRef: string, actorRef = MOBILE_DESK_ACTOR): MobileWriteRequest {
  return { ...base(intentRef), actorRef, step: "reconnect" };
}

function presentRequest(intentRef: string, vaultRef = "vlt-0001", actorRef = MOBILE_DESK_ACTOR): MobileWriteRequest {
  return { ...base(intentRef), actorRef, step: "present", vaultRef };
}

function confirmRequest(intentRef: string, orderRef = "ord-0001", version = 1): MobileWriteRequest {
  return { ...base(intentRef), step: "confirm", orderRef, expectedVersion: version };
}

function withdrawRequest(intentRef: string, orderRef = "ord-0001", version = 1): MobileWriteRequest {
  return { ...base(intentRef), step: "withdraw", orderRef, expectedVersion: version };
}



describe("mobile identity register", () => {
  const pin = JSON.parse(
    readFileSync(path.join(repoRoot, "packages/protocol-adapter/vendor/kix-protocol.contract-only.openapi.json"), "utf8"),
  ) as { components: { schemas: Record<string, { properties?: Record<string, unknown> }> } };

  it("names a published body field only where the pin has it, and says not-bound where it has none", () => {
    expect(new Set(MOBILE_IDENTITY_REGISTER.map((row) => row.id)).size).toBe(MOBILE_IDENTITY_REGISTER.length);
    for (const row of MOBILE_IDENTITY_REGISTER) {
      expect(row.reason.length, row.id).toBeGreaterThan(20);
      if (row.status === "field-named") {
        expect(row.bodyFields.length, row.id).toBeGreaterThan(0);
        for (const entry of row.bodyFields) {
          expect(PINNED_ACTIONS as readonly string[], `${row.id} ${entry.action}`).toContain(entry.action);
          const schema = pin.components.schemas[entry.action];
          expect(schema?.properties, `${row.id} ${entry.action}`).toBeDefined();
          expect(Object.keys(schema?.properties ?? {}), `${row.id} ${entry.action}.${entry.field}`).toContain(entry.field);
        }
      } else {
        expect(row.bodyFields, row.id).toEqual([]);
      }
    }
    const status = Object.fromEntries(MOBILE_IDENTITY_REGISTER.map((row) => [row.id, row.status]));
    expect(status).toEqual({
      install: "not-bound",
      shell: "not-bound",
      update: "not-bound",
      session: "not-bound",
      vault: "field-named",
      presentation: "not-bound",
      order: "not-bound",
      payment: "not-bound",
      withdrawal: "not-bound",
      version: "field-named",
    });
    // No install, session, device, or presentation id exists in any pinned body.
    const withField = (field: string) =>
      Object.entries(pin.components.schemas)
        .filter(([, schema]) => schema.properties && field in schema.properties)
        .map(([name]) => name)
        .sort();
    for (const field of ["installId", "deviceId", "presentationId", "withdrawalId"]) {
      expect(withField(field), field).toEqual([]);
    }
    // The pin names sessionId only on create_event — an event session, not a device session.
    expect(withField("sessionId")).toEqual(["create_event"]);
    const composed = MOBILE_STEPS as readonly string[];
    for (const action of PINNED_ACTIONS) {
      expect(composed).not.toContain(action);
    }
  });

  it("records the not-composed commands and the locked hold binding without remapping them", () => {
    expect(MOBILE_NOT_COMPOSED.map((entry) => entry.action)).toEqual([
      "capture",
      "settle_capture",
      "commit_trade",
      "open_admission",
      "admit",
      "refund_ticket",
    ]);
    for (const entry of MOBILE_NOT_COMPOSED) {
      expect(entry.reason, entry.action).toContain("준태님 ruling 2026-10-08 18:26 KST");
    }
    expect(MOBILE_RULING).toBe("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
    expect(mobileNotComposedFor("refund_ticket")?.action).toBe("refund_ticket");
    expect(MOBILE_HOLD_NOT_BOUND.consideredAction).toBe("reserve_listing");
    expect(MOBILE_HOLD_NOT_BOUND.status).toBe("not-bound");
    expect(MOBILE_HOLD_NOT_BOUND.reason).toBe(COMMERCE_COMMAND_BINDINGS.placeHold.reason);
    const bindings = readFileSync(path.join(repoRoot, "packages/protocol-adapter/src/commerce-bindings.ts"));
    expect(createHash("sha256").update(bindings).digest("hex")).toBe(
      "83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249",
    );
  });
});

describe("mobile references", () => {
  it("gives every kind its own prefix and never reads one kind as another", () => {
    const refs = MOBILE_REF_KINDS.map((refKind) => mobileRef(refKind, 12));
    expect(new Set(refs).size).toBe(MOBILE_REF_KINDS.length);
    for (const refKind of MOBILE_REF_KINDS) {
      const ref = mobileRef(refKind, 7);
      expect(mobileRefKind(ref)).toBe(refKind);
      for (const other of MOBILE_REF_KINDS) {
        expect(isMobileRef(ref, other)).toBe(other === refKind);
      }
    }
    expect(mobileRef("vault", 3)).toBe("vlt-0003");
    expect(mobileRefKind("vlt-3")).toBeNull();
    expect(mobileRefKind("payment-0003")).toBeNull();
    expect(isMobileRef(7, "vault")).toBe(false);
  });
});

describe("mobile port selection", () => {
  it("serves the synthetic source on stub and a not-bound port on integration-http with no stub switch", async () => {
    const stub = mobileShellPortFor("stub");
    expect(stub.environment).toBe("stub");
    expect(stub.source).toBe("synthetic");
    const bound = mobileShellPortFor("integration-http", { scenario: "clean" });
    expect(bound.environment).toBe("integration-http");
    expect(bound.source).toBe("none");
    expect(bound.scenario).toBe("clean");
    expect(
      await bound.read({ contextKey: CTX, actorRef: MOBILE_DESK_ACTOR, deviceId: MOBILE_DEVICE_ID, watermarkFloor: null, deviceNow: IN_STEP }),
    ).toEqual({ kind: "not-bound", reason: MOBILE_NOT_BOUND_REASON });
    expect(await bound.submit(installRequest("intent-1"))).toEqual({
      kind: "not-bound",
      step: "install",
      intentRef: "intent-1",
      contextKey: CTX,
      reason: MOBILE_NOT_BOUND_REASON,
    });
    expect(bound.deliverHeld()).toBe(0);
    expect(bound.deliverLate()).toEqual([]);
    expect(createNotBoundMobileShell().source).toBe("none");
    expect(MOBILE_NOT_BOUND_REASON).toContain("not-bound on integration-http");
  });
});

describe("mobile read", () => {
  it("reads the installed shell, session, vault, and order with every non-claim false", async () => {
    const snapshot = await snapshotOf(createStubMobileShell());
    expect(snapshot.install).toMatchObject({ state: "installed", installRef: "ins-0001", shellRef: "shl-0001", version: 1 });
    expect(snapshot.session).toMatchObject({ state: "active", actorRef: MOBILE_DESK_ACTOR, verdict: "active" });
    expect(snapshot.vault.map((item) => [item.vaultRef, item.kind, item.authorityVerdict])).toEqual([
      ["vlt-0001", "pass", "valid"],
      ["vlt-0002", "receipt", "none"],
      ["vlt-0003", "pass", "expired"],
    ]);
    expect(snapshot.order).toMatchObject({ orderRef: "ord-0001", state: "pending", version: 1, currency: MOBILE_UNIT });
    expect(snapshot.link).toBe("online");
    expect(snapshot.clock).toMatchObject({ verdict: "in-step", deviceNow: IN_STEP });
    for (const field of MOBILE_NON_CLAIM_FIELDS) {
      expect(snapshot.nonClaims[field], field).toBe(false);
    }
    expect(snapshot.support.length).toBeGreaterThan(0);
    expect(snapshot.snapshotId).toBe(1);
  });

  it("serves empty, stale, offline, and production-claimed as their own outcomes", async () => {
    const readOn = async (scenario: string, deviceNow: string | null = IN_STEP): Promise<MobileReadOutcome> =>
      createStubMobileShell({ scenario: scenario as never }).read({
        contextKey: CTX,
        actorRef: MOBILE_DESK_ACTOR,
        deviceId: MOBILE_DEVICE_ID,
        watermarkFloor: null,
        deviceNow,
      });
    expect(await readOn("empty")).toMatchObject({ kind: "empty" });
    expect(await readOn("stale")).toMatchObject({ kind: "stale", floor: MOBILE_STALE_FLOOR });
    expect(await readOn("offline")).toMatchObject({ kind: "offline" });
    expect(await readOn("production-claimed")).toMatchObject({ kind: "refused", code: "ENVIRONMENT" });
    expect(await readOn("claims-grant")).toMatchObject({ kind: "refused", code: "CLAIM" });
    const floored = await createStubMobileShell().read({
      contextKey: CTX,
      actorRef: MOBILE_DESK_ACTOR,
      deviceId: MOBILE_DEVICE_ID,
      watermarkFloor: "2026-10-14T00:00:00.000Z",
      deviceNow: IN_STEP,
    });
    expect(floored.kind).toBe("stale");
  });

  it("flags a skewed or unreported device clock and never lets it decide validity", async () => {
    const port = createStubMobileShell();
    const inStep = await snapshotOf(port, IN_STEP);
    expect(inStep.clock.verdict).toBe("in-step");
    const skewed = await snapshotOf(port, "2026-10-20T00:00:00.000Z");
    expect(skewed.clock.verdict).toBe("skewed");
    expect(skewed.clock.skewMs).toBeGreaterThan(0);
    const unreported = await snapshotOf(port, null);
    expect(unreported.clock.verdict).toBe("unreported");
    // The authority verdict is the source's. A skewed device clock moves nothing.
    for (const item of skewed.vault) {
      const clean = inStep.vault.find((entry) => entry.vaultRef === item.vaultRef);
      expect(item.authorityVerdict).toBe(clean?.authorityVerdict);
      expect(item.verdictAt).toBe(clean?.verdictAt);
    }
  });

  it("checks the pin tuple before any read or effect", async () => {
    const changed = { ...DISCOVERY_READ_TUPLE_LITERALS, protocolMergeSha: "0".repeat(40) };
    const port = createStubMobileShell({ tuple: changed });
    const read = await port.read({
      contextKey: CTX,
      actorRef: MOBILE_DESK_ACTOR,
      deviceId: MOBILE_DEVICE_ID,
      watermarkFloor: null,
      deviceNow: IN_STEP,
    });
    expect(read).toMatchObject({ kind: "tuple-changed", field: "protocolMergeSha" });
    const write = await port.submit(confirmRequest("intent-1"));
    expect(write).toMatchObject({ kind: "tuple-changed", field: "protocolMergeSha", intentRef: "intent-1" });
    expect(port.effects().submits).toBe(0);
    expect(port.effects().installs).toBe(0);
  });
});

describe("mobile write flow", () => {
  it("installs on an empty device, then rejects a second install", async () => {
    const port = createStubMobileShell({ scenario: "empty" });
    const installed = await port.submit(installRequest("i-1"));
    expect(installed.kind).toBe("confirmed");
    if (installed.kind === "confirmed") {
      expect(installed.refs.installRef).toBe("ins-0001");
      expect(installed.refs.sessionRef).toBe("ses-0001");
      for (const field of MOBILE_NON_CLAIM_FIELDS) {
        expect(installed.nonClaims[field], field).toBe(false);
      }
    }
    expect(await port.submit(installRequest("i-2"))).toMatchObject({ kind: "rejected", code: "ALREADY_INSTALLED" });
    const snapshot = await snapshotOf(port);
    expect(snapshot.install.state).toBe("installed");
    expect(snapshot.session.verdict).toBe("active");
  });

  it("applies only a source-offered update, on the expected version", async () => {
    const port = createStubMobileShell({ scenario: "update-available" });
    expect(await port.submit(updateRequest("u-1", "upd-9999"))).toMatchObject({ kind: "rejected", code: "UNKNOWN_REF" });
    expect(await port.submit(updateRequest("u-2", "upd-0001", 9))).toMatchObject({ kind: "rejected", code: "VERSION_STALE" });
    const applied = await port.submit(updateRequest("u-3"));
    expect(applied.kind).toBe("confirmed");
    const snapshot = await snapshotOf(port);
    expect(snapshot.install.shellRef).toBe("shl-0002");
    expect(snapshot.install.update).toBeNull();
    expect(await port.submit(updateRequest("u-4"))).toMatchObject({ kind: "rejected", code: "NO_UPDATE" });
  });

  it("reconnects only when the session is not already active for this actor", async () => {
    const port = createStubMobileShell();
    expect(await port.submit(reconnectRequest("r-1"))).toMatchObject({ kind: "rejected", code: "SESSION_ACTIVE" });
    port.expireSession();
    const reconnected = await port.submit(reconnectRequest("r-2"));
    expect(reconnected.kind).toBe("confirmed");
    if (reconnected.kind === "confirmed") {
      expect(reconnected.refs.sessionRef).toBe("ses-0002");
    }
    const guest = await port.submit(reconnectRequest("r-3", MOBILE_GUEST_ACTOR));
    expect(guest.kind).toBe("confirmed");
    const snapshot = await snapshotOf(port);
    expect(snapshot.session.actorRef).toBe(MOBILE_GUEST_ACTOR);
  });

  it("presents a valid stored pass, and refuses a receipt copy, an expired pass, and another actor's copy", async () => {
    const port = createStubMobileShell();
    const presented = await port.submit(presentRequest("p-1"));
    expect(presented.kind).toBe("confirmed");
    if (presented.kind === "confirmed") {
      expect(presented.refs.vaultRef).toBe("vlt-0001");
      expect(presented.refs.presentationRef).toBe("pre-0001");
    }
    expect(await port.submit(presentRequest("p-2", "vlt-0002"))).toMatchObject({ kind: "rejected", code: "PASS_NOT_PRESENTABLE" });
    expect(await port.submit(presentRequest("p-3", "vlt-0003"))).toMatchObject({ kind: "rejected", code: "PASS_NOT_PRESENTABLE" });
    expect(await port.submit(presentRequest("p-4", "vlt-9999"))).toMatchObject({ kind: "rejected", code: "UNKNOWN_REF" });
    const guest = createStubMobileShell();
    await guest.submit(reconnectRequest("g-1", MOBILE_GUEST_ACTOR));
    expect(await guest.submit(presentRequest("p-5", "vlt-0001", MOBILE_GUEST_ACTOR))).toMatchObject({
      kind: "rejected",
      code: "IDENTITY_MISMATCH",
    });
    expect(port.effects().presents).toBe(1);
  });

  it("settles the pending order once with its own record, then refuses a second write", async () => {
    const port = createStubMobileShell();
    const confirmed = await port.submit(confirmRequest("c-1"));
    expect(confirmed.kind).toBe("confirmed");
    if (confirmed.kind === "confirmed") {
      expect(confirmed.refs.paymentRef).toBe("pmt-0001");
      expect(confirmed.refs.orderVersion).toBe(2);
    }
    expect(await port.submit(confirmRequest("c-2"))).toMatchObject({ kind: "rejected", code: "ORDER_NOT_PENDING" });
    const second = createStubMobileShell();
    const withdrawn = await second.submit(withdrawRequest("w-1"));
    expect(withdrawn.kind).toBe("confirmed");
    if (withdrawn.kind === "confirmed") {
      expect(withdrawn.refs.withdrawalRef).toBe("wdr-0001");
    }
    const snapshot = await snapshotOf(second);
    expect(snapshot.order?.state).toBe("withdrawn");
  });

  it("fences writes that need a session when the session verdict is expired", async () => {
    const port = createStubMobileShell({ scenario: "session-expired" });
    expect(await port.submit(confirmRequest("c-1"))).toMatchObject({ kind: "rejected", code: "SESSION_EXPIRED" });
    expect(await port.submit(presentRequest("p-1"))).toMatchObject({ kind: "rejected", code: "SESSION_EXPIRED" });
    await port.submit(reconnectRequest("r-1"));
    expect(await port.submit(confirmRequest("c-2"))).toMatchObject({ kind: "confirmed" });
  });

  it("answers a write unknown while the link is down and applies nothing", async () => {
    const port = createStubMobileShell();
    port.dropConnection();
    const outcome = await port.submit(confirmRequest("c-1"));
    expect(outcome.kind).toBe("unknown");
    port.restoreConnection();
    const snapshot = await snapshotOf(port);
    expect(snapshot.order?.state).toBe("pending");
    expect(snapshot.order?.paymentRef).toBeNull();
    expect(port.effects().confirms).toBe(0);
    expect(port.effects().unreached).toBe(1);
  });

  it("loses the confirm and withdraw answers and offers them as late evidence", async () => {
    const confirmPort = createStubMobileShell({ scenario: "confirm-lost" });
    const lost = await confirmPort.submit(confirmRequest("c-1"));
    expect(lost).toMatchObject({ kind: "unknown", intentRef: "c-1" });
    const late = confirmPort.deliverLate();
    expect(late).toEqual([{ intentRef: "c-1", contextKey: CTX, step: "confirm", result: "confirmed", code: null }]);
    const snapshot = await snapshotOf(confirmPort);
    expect(snapshot.order?.state).toBe("confirmed");

    const withdrawPort = createStubMobileShell({ scenario: "withdraw-lost" });
    expect(await withdrawPort.submit(withdrawRequest("w-1"))).toMatchObject({ kind: "unknown" });
    const lateWithdraw = withdrawPort.deliverLate();
    expect(lateWithdraw[0]?.step).toBe("withdraw");
    expect(lateWithdraw[0]?.result).toBe("confirmed");
  });

  it("rejects bad requests before any effect", async () => {
    const port = createStubMobileShell();
    const wrongEnvironment: MobileWriteRequest = {
      ...base("x-1"),
      step: "confirm",
      orderRef: "ord-0001",
      expectedVersion: 1,
      declaredEnvironment: "production",
    };
    expect(await port.submit(wrongEnvironment)).toMatchObject({ kind: "invalid-request", code: "ENVIRONMENT" });
    const wrongRef: MobileWriteRequest = { ...base("x-2"), step: "confirm", orderRef: "vlt-0001", expectedVersion: 1 };
    expect(await port.submit(wrongRef)).toMatchObject({ kind: "invalid-request", code: "IDENTITY" });
    const wrongVersion: MobileWriteRequest = { ...base("x-3"), step: "confirm", orderRef: "ord-0001", expectedVersion: 1.5 };
    expect(await port.submit(wrongVersion)).toMatchObject({ kind: "invalid-request", code: "VERSION" });
    expect(port.effects().submits).toBe(0);
  });
});

describe("mobile snapshot and receipt refusal", () => {
  it("refuses a snapshot that claims a field or carries a malformed ref", () => {
    const base2 = refuseMobileSnapshot;
    const snapshot = {
      snapshotId: 1,
      generation: 1,
      watermark: IN_STEP,
      scenario: "clean",
      link: "online",
      environment: { shellEnvironment: MOBILE_ENVIRONMENT, deviceId: MOBILE_DEVICE_ID },
      clock: { authorityNow: IN_STEP, deviceNow: IN_STEP, verdict: "in-step", skewMs: 0, note: "" },
      install: { state: "installed", installRef: "ins-0001", shellRef: "shl-0001", version: 1, packaging: "installable-web", update: null },
      session: { sessionRef: "ses-0001", state: "active", actorRef: MOBILE_DESK_ACTOR, verdict: "active", note: "" },
      vault: [
        {
          vaultRef: "vlt-0001",
          kind: "pass",
          label: "A pass",
          ownerRef: MOBILE_DESK_ACTOR,
          cachedAt: IN_STEP,
          authorityVerdict: "valid",
          verdictAt: IN_STEP,
        },
      ],
      order: null,
      support: [],
      nonClaims: {
        realPayment: false,
        fundsMoved: false,
        admissionGrant: false,
        rightCreated: false,
        installVerified: false,
        productionEnvironment: false,
        mobileIntegrationComplete: false,
      },
    } satisfies MobileSnapshot;
    expect(base2(snapshot)).toBeNull();
    const claimed = { ...snapshot, nonClaims: { ...snapshot.nonClaims, admissionGrant: true as never } };
    expect(base2(claimed)).toMatchObject({ kind: "refused", code: "CLAIM", claims: ["admissionGrant"] });
    const badRef = { ...snapshot, install: { ...snapshot.install, installRef: "install-0001" } };
    expect(base2(badRef)).toMatchObject({ kind: "refused" });
    const badLabel = { ...snapshot, vault: [{ ...snapshot.vault[0]!, label: "" }] };
    expect(base2(badLabel)).toMatchObject({ kind: "refused" });
  });

  it("flags a confirmed receipt that does not state every non-claim as false", () => {
    const clean = {
      realPayment: false,
      fundsMoved: false,
      admissionGrant: false,
      rightCreated: false,
      installVerified: false,
      productionEnvironment: false,
      mobileIntegrationComplete: false,
    } as const;
    expect(refuseMobileReceipt(clean)).toBeNull();
    expect(refuseMobileReceipt({ ...clean, realPayment: true as never })).toEqual({
      kind: "UNTRUSTED_RECEIPT",
      field: "realPayment",
    });
  });

  it("covers every scenario with a port that answers a read", async () => {
    for (const scenario of MOBILE_SCENARIOS) {
      const port = createStubMobileShell({ scenario });
      if (scenario === "held-response" || scenario === "read-lost") {
        let settled = false;
        void port
          .read({ contextKey: CTX, actorRef: MOBILE_DESK_ACTOR, deviceId: MOBILE_DEVICE_ID, watermarkFloor: null, deviceNow: IN_STEP })
          .then(() => {
            settled = true;
          });
        await Promise.resolve();
        expect(settled, scenario).toBe(false);
        if (scenario === "held-response") {
          expect(port.deliverHeld()).toBe(1);
        }
        continue;
      }
      const outcome = await port.read({
        contextKey: CTX,
        actorRef: MOBILE_DESK_ACTOR,
        deviceId: MOBILE_DEVICE_ID,
        watermarkFloor: null,
        deviceNow: IN_STEP,
      });
      expect(
        ["ready", "empty", "stale", "offline", "refused", "tuple-changed", "unknown"],
        scenario,
      ).toContain(outcome.kind);
    }
  });
});
