import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  COMMERCE_METHODS,
  CONSENT_AUTHORIZE_ACTOR,
  CONSENT_COMPOSED,
  CONSENT_DESK_NOT_BOUND,
  CONSENT_NOT_COMPOSED,
  ConsentBind,
  GateRejectedError,
  JOURNEY_RULING,
  PINNED_PROTOCOL_DOMAIN,
  ProtocolError,
  createStubConsentInvoker,
  type ConsentAuthorizeInput,
  type ConsentSetInput,
  type LocalCallInvoker,
} from "../src/index.js";
import type { LocalCallInput } from "../src/local-call.js";
import { pinnedCommandSchemas } from "../src/openapi-contract-pin.js";

const SET: ConsentSetInput = {
  operationId: "op-set",
  subject: "subject-a",
  allowed: true,
  business: "desk-business",
  channel: "desk-channel",
  eventId: "show-1",
  expectedConsentVersion: 0,
  purpose: "desk-purpose",
};

const AUTHORIZE: ConsentAuthorizeInput = {
  operationId: "op-auth",
  business: "desk-business",
  channel: "desk-channel",
  eventId: "show-1",
  expectedConsentVersion: 0,
  purpose: "desk-purpose",
  subject: "subject-a",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordingStub(seen: LocalCallInput[] = []): LocalCallInvoker {
  const stub = createStubConsentInvoker();
  return {
    async invokeLocalCall(input) {
      seen.push(structuredClone(input));
      return stub.invokeLocalCall(input);
    },
  };
}

function requiredKeys(action: string): string[] {
  const schema = pinnedCommandSchemas()[action];
  if (!isRecord(schema) || !Array.isArray(schema.required)) {
    throw new Error(`missing schema for ${action}`);
  }
  return schema.required.filter((key): key is string => typeof key === "string").sort();
}

describe("consent bind composition", () => {
  it("records the ruling and the commands it does not send", () => {
    expect(JOURNEY_RULING).toBe("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
    expect(CONSENT_COMPOSED).toEqual(["set_consent", "authorize_marketing"]);
    expect(CONSENT_NOT_COMPOSED.map((entry) => entry.action)).toEqual(["capture", "settle_capture"]);
    expect(CONSENT_NOT_COMPOSED.every((entry) => entry.reason.includes(JOURNEY_RULING))).toBe(true);
    expect(CONSENT_NOT_COMPOSED[0]?.reason).toContain(COMMERCE_COMMAND_BINDINGS.confirmBooking.reason);
    expect(CONSENT_NOT_COMPOSED[1]?.reason).toContain(COMMERCE_COMMAND_BINDINGS.settlementPreview.reason);
    expect(CONSENT_DESK_NOT_BOUND).toEqual([
      {
        method: "placeHold",
        consideredAction: "reserve_listing",
        reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
      },
    ]);
    expect(COMMERCE_COMMAND_BINDINGS.placeHold.status).toBe("not-bound");
    expect(COMMERCE_METHODS).not.toContain("setConsent");
    expect(COMMERCE_METHODS).not.toContain("authorizeMarketing");
    const names = Object.getOwnPropertyNames(ConsentBind.prototype);
    for (const banned of ["capture", "settleCapture", "placeHold", "commitTrade"]) {
      expect(names).not.toContain(banned);
    }
    expect(CONSENT_AUTHORIZE_ACTOR).toBe("marketing-adapter");
  });

  it("sets consent then authorizes with pinned body keys and one call per step", async () => {
    const seen: LocalCallInput[] = [];
    const bind = new ConsentBind(recordingStub(seen));
    const set = await bind.setConsent(SET);
    const authorized = await bind.authorizeMarketing(AUTHORIZE);
    expect(set).toMatchObject({
      kind: "RECEIPT",
      step: "set_consent",
      receipt: { result: { allowed: true, consentVersion: 1 } },
    });
    expect(authorized).toMatchObject({
      kind: "RECEIPT",
      step: "authorize_marketing",
      receipt: {
        result: {
          authorizedAt: 0,
          consentVersion: 0,
          dispatchDecision: "AUTHORIZED_FIXTURE_INTENT",
          networkSendPerformed: false,
        },
      },
    });
    expect(seen.map((call) => call.action)).toEqual(["set_consent", "authorize_marketing"]);
    expect(seen.map((call) => call.operationId)).toEqual(["op-set", "op-auth"]);
    expect(seen[0]).toMatchObject({ actor: "subject-a" });
    expect(seen[1]).toMatchObject({ actor: CONSENT_AUTHORIZE_ACTOR });
    expect(Object.keys(seen[0]?.body ?? {}).sort()).toEqual(requiredKeys("set_consent"));
    expect(Object.keys(seen[1]?.body ?? {}).sort()).toEqual(requiredKeys("authorize_marketing"));
    expect(seen[0]?.body).toEqual({
      domain: PINNED_PROTOCOL_DOMAIN,
      allowed: true,
      business: "desk-business",
      channel: "desk-channel",
      eventId: "show-1",
      expectedConsentVersion: 0,
      purpose: "desk-purpose",
    });
    expect(seen[0]?.body).not.toHaveProperty("subject");
    expect(seen[1]?.body).toEqual({
      domain: PINNED_PROTOCOL_DOMAIN,
      business: "desk-business",
      channel: "desk-channel",
      eventId: "show-1",
      expectedConsentVersion: 0,
      purpose: "desk-purpose",
      subject: "subject-a",
    });
    expect(seen.some((call) => call.action === "capture" || call.action === "settle_capture")).toBe(false);
    expect(bind.state()).toMatchObject({ consented: true, allowed: true, authorized: true, halted: null });
    const again = await bind.authorizeMarketing({ ...AUTHORIZE, operationId: "op-auth-2" });
    expect(again).toMatchObject({ kind: "FENCED", blockedBy: { reason: "already-sent" } });
    expect(seen).toHaveLength(2);
  });

  it("fences authorize_marketing before an allowed consent and still accepts set_consent", async () => {
    const seen: LocalCallInput[] = [];
    const bind = new ConsentBind(recordingStub(seen));
    const early = await bind.authorizeMarketing(AUTHORIZE);
    expect(early).toMatchObject({
      kind: "FENCED",
      step: "authorize_marketing",
      blockedBy: { reason: "out-of-order" },
    });
    expect(seen).toHaveLength(0);
    const set = await bind.setConsent({ ...SET, allowed: false, operationId: "op-set-false" });
    expect(set).toMatchObject({ kind: "RECEIPT", receipt: { result: { allowed: false, consentVersion: 1 } } });
    const still = await bind.authorizeMarketing({ ...AUTHORIZE, operationId: "op-auth-after-false" });
    expect(still).toMatchObject({ kind: "FENCED", blockedBy: { reason: "out-of-order" } });
    expect(seen.map((call) => call.action)).toEqual(["set_consent"]);
    expect(bind.state()).toMatchObject({ consented: true, allowed: false, authorized: false, halted: null });
  });

  it("records a further set_consent with allowed false after authorize", async () => {
    const seen: LocalCallInput[] = [];
    const bind = new ConsentBind(recordingStub(seen));
    expect((await bind.setConsent(SET)).kind).toBe("RECEIPT");
    expect((await bind.authorizeMarketing(AUTHORIZE)).kind).toBe("RECEIPT");
    const withdrawn = await bind.setConsent({
      ...SET,
      operationId: "op-withdraw",
      allowed: false,
      expectedConsentVersion: 1,
    });
    expect(withdrawn).toMatchObject({
      kind: "RECEIPT",
      step: "set_consent",
      receipt: { result: { allowed: false, consentVersion: 1 } },
    });
    expect(seen[2]?.body).toMatchObject({ allowed: false, expectedConsentVersion: 1 });
    expect(bind.state()).toMatchObject({ allowed: false, authorized: false, halted: null });
    const fenced = await bind.authorizeMarketing({ ...AUTHORIZE, operationId: "op-auth-late" });
    expect(fenced).toMatchObject({ kind: "FENCED", blockedBy: { reason: "out-of-order" } });
    expect(seen).toHaveLength(3);
    expect(seen.some((call) => call.action === "capture" || call.action === "settle_capture")).toBe(false);
  });

  it("fences a call that is in flight", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const slow: LocalCallInvoker = {
      async invokeLocalCall(input) {
        calls += 1;
        await gate;
        return recordingStub().invokeLocalCall(input);
      },
    };
    const bind = new ConsentBind(slow);
    const first = bind.setConsent(SET);
    const second = await bind.authorizeMarketing(AUTHORIZE);
    expect(second).toMatchObject({ kind: "FENCED", blockedBy: { reason: "in-flight" } });
    expect(calls).toBe(1);
    if (release === undefined) {
      throw new Error("missing release");
    }
    release();
    await expect(first).resolves.toMatchObject({ kind: "RECEIPT" });
    expect(calls).toBe(1);
  });

  it("treats an unknown set_consent as a halt and does not send authorize_marketing", async () => {
    const seen: LocalCallInput[] = [];
    const bind = new ConsentBind({
      async invokeLocalCall(input) {
        seen.push(structuredClone(input));
        throw new ProtocolError("timed out", "REQUEST_TIMEOUT", {
          requestId: "req-timeout",
          correlationId: "corr-timeout",
        });
      },
    });
    const unknown = await bind.setConsent(SET);
    expect(unknown).toMatchObject({
      kind: "UNKNOWN",
      step: "set_consent",
      code: "REQUEST_TIMEOUT",
      identity: { operationId: "op-set", requestId: "req-timeout", correlationId: "corr-timeout" },
    });
    const fenced = await bind.authorizeMarketing(AUTHORIZE);
    expect(fenced).toMatchObject({ kind: "FENCED", blockedBy: { reason: "halted" } });
    expect(seen.map((call) => call.action)).toEqual(["set_consent"]);
  });

  it("halts on a pre-send failure and does not call the invoker", async () => {
    const seen: LocalCallInput[] = [];
    const bind = new ConsentBind(recordingStub(seen));
    await expect(bind.setConsent({ ...SET, expectedConsentVersion: Number.NaN })).rejects.toThrow(/integer/);
    expect(seen).toHaveLength(0);
    expect(bind.state().halted).toMatchObject({ kind: "NOT_SENT", step: "set_consent" });
    const fenced = await bind.authorizeMarketing(AUTHORIZE);
    expect(fenced).toMatchObject({ kind: "FENCED", blockedBy: { reason: "halted" } });
    expect(seen).toHaveLength(0);
  });

  it("records a gate rejection and fences the next write", async () => {
    const seen: LocalCallInput[] = [];
    const bind = new ConsentBind({
      async invokeLocalCall(input) {
        seen.push(structuredClone(input));
        throw new GateRejectedError("refused", "STALE_CONSENT_VERSION", { requestId: "req-r", correlationId: "corr-r" }, 422);
      },
    });
    const rejected = await bind.setConsent(SET);
    expect(rejected).toMatchObject({ kind: "REJECTED", code: "STALE_CONSENT_VERSION" });
    const fenced = await bind.setConsent({ ...SET, operationId: "op-set-2" });
    expect(fenced).toMatchObject({ kind: "FENCED", blockedBy: { reason: "halted" } });
    expect(seen).toHaveLength(1);
  });

  it("records an invalid receipt as unknown and fences the next write", async () => {
    const seen: LocalCallInput[] = [];
    const stub = createStubConsentInvoker();
    const bind = new ConsentBind({
      async invokeLocalCall(input) {
        seen.push(structuredClone(input));
        const receipt = await stub.invokeLocalCall(input);
        if (input.action === "authorize_marketing" && isRecord(receipt) && isRecord(receipt.result)) {
          return { ...receipt, result: { ...receipt.result, extra: true } };
        }
        return receipt;
      },
    });
    expect((await bind.setConsent(SET)).kind).toBe("RECEIPT");
    const authorized = await bind.authorizeMarketing(AUTHORIZE);
    expect(authorized).toMatchObject({ kind: "UNKNOWN", code: "INVALID_RECEIPT" });
    const fenced = await bind.setConsent({ ...SET, operationId: "op-set-2", allowed: false });
    expect(fenced.kind).toBe("FENCED");
    expect(seen.map((call) => call.action)).toEqual(["set_consent", "authorize_marketing"]);
    expect(seen.some((call) => call.action === "capture" || call.action === "settle_capture")).toBe(false);
  });
});
