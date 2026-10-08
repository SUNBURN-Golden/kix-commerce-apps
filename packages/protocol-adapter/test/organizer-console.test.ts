import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  COMMERCE_METHODS,
  JOURNEY_COMPOSED,
  JOURNEY_NOT_COMPOSED,
  JOURNEY_RULING,
  ORGANIZER_COMPOSED,
  ORGANIZER_DESK_NOT_BOUND,
  ORGANIZER_NOT_COMPOSED,
  OrganizerConsole,
  PINNED_PROTOCOL_DOMAIN,
  ProtocolError,
  createStubOrganizerInvoker,
  type LocalCallInvoker,
  type OrganizerCreateInput,
  type OrganizerInvitationInput,
} from "../src/index.js";
import { GateRejectedError } from "../src/http-adapter.js";
import type { LocalCallInput } from "../src/local-call.js";
import { pinnedCommandSchemas } from "../src/openapi-contract-pin.js";
import { SHOW_POLICY } from "./support/journey-fixture.js";

const CREATE: OrganizerCreateInput = {
  operationId: "op-create",
  eventId: "show-1",
  organizer: "organizer",
  policy: SHOW_POLICY,
  seats: ["A1"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordingStub(seen: LocalCallInput[] = []): LocalCallInvoker {
  const stub = createStubOrganizerInvoker();
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

function invite(over: Partial<OrganizerInvitationInput> = {}): OrganizerInvitationInput {
  return {
    operationId: "op-invite",
    eventId: "show-1",
    inventoryId: "inv-0",
    expectedInventoryVersion: 0,
    recipient: "guest-a",
    organizer: "organizer",
    ...over,
  };
}

describe("organizer console composition", () => {
  it("records the ruling and the commands it does not send", () => {
    expect(JOURNEY_RULING).toBe("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
    expect(ORGANIZER_COMPOSED).toEqual([
      "create_event",
      "close_sales",
      "open_admission",
      "complete_event",
      "cancel_event",
      "issue_invitation",
    ]);
    expect(JOURNEY_COMPOSED).toEqual(["create_event", "prepare_trade", "accept_trade"]);
    expect(JOURNEY_NOT_COMPOSED.map((entry) => entry.action)).toContain("open_admission");
    expect(ORGANIZER_NOT_COMPOSED.map((entry) => entry.action)).toEqual([
      "capture",
      "settle_capture",
      "commit_trade",
      "admit",
    ]);
    expect(ORGANIZER_NOT_COMPOSED.every((entry) => entry.reason.includes(JOURNEY_RULING))).toBe(true);
    expect(ORGANIZER_NOT_COMPOSED[0]?.reason).toContain(COMMERCE_COMMAND_BINDINGS.confirmBooking.reason);
    expect(ORGANIZER_NOT_COMPOSED[1]?.reason).toContain(COMMERCE_COMMAND_BINDINGS.settlementPreview.reason);
    expect(ORGANIZER_NOT_COMPOSED[2]?.reason).toContain(COMMERCE_COMMAND_BINDINGS.commitSettlement.reason);
    expect(ORGANIZER_NOT_COMPOSED[3]?.reason).toContain(COMMERCE_COMMAND_BINDINGS.checkAdmission.reason);
    expect(ORGANIZER_DESK_NOT_BOUND.map((entry) => entry.method)).toEqual([
      "cancelSettlement",
      "cancelReservation",
      "cancelCredit",
      "registerReservationShow",
      "checkAdmission",
    ]);
    expect(ORGANIZER_DESK_NOT_BOUND[4]).toEqual({
      method: "checkAdmission",
      consideredAction: "admit",
      reason: COMMERCE_COMMAND_BINDINGS.checkAdmission.reason,
    });
    expect(ORGANIZER_DESK_NOT_BOUND[0]?.consideredAction).toBeNull();
    expect(COMMERCE_COMMAND_BINDINGS.placeHold).toMatchObject({
      status: "not-bound",
      consideredAction: "reserve_listing",
    });
    expect(COMMERCE_COMMAND_BINDINGS.placeHold.reason).toContain("placeHold({ eventId, quantity })");
    expect(COMMERCE_METHODS).not.toContain("createEvent");
    expect(COMMERCE_METHODS).not.toContain("cancelEvent");
    const names = Object.getOwnPropertyNames(OrganizerConsole.prototype);
    for (const banned of ["capture", "settleCapture", "commitTrade", "admit", "placeHold", "prepareTrade"]) {
      expect(names).not.toContain(banned);
    }
  });

  it("posts the six bodies and actors and omits optional create fields", async () => {
    const seen: LocalCallInput[] = [];
    const console = new OrganizerConsole(recordingStub(seen));
    const created = await console.createEvent({ ...CREATE, invitationQuota: 1 });
    const closed = await console.closeSales({ operationId: "op-close", eventId: "show-1" });
    const opened = await console.openAdmission({ operationId: "op-open", eventId: "show-1" });
    const completed = await console.completeEvent({ operationId: "op-complete", eventId: "show-1" });
    const cancelled = await console.cancelEvent({ operationId: "op-cancel", eventId: "show-1" });
    const issued = await console.issueInvitation(invite());
    expect(created).toMatchObject({
      kind: "RECEIPT",
      step: "create_event",
      receipt: {
        result: { eventId: "show-1", policyHash: "policy-hash", inventoryIds: ["inv-0"], reservationSeconds: 900 },
      },
    });
    expect(closed).toMatchObject({ kind: "RECEIPT", receipt: { result: { salesStatus: "CLOSED" } } });
    expect(opened).toMatchObject({ kind: "RECEIPT", receipt: { result: { admissionStatus: "OPEN" } } });
    expect(completed).toMatchObject({ kind: "RECEIPT", receipt: { result: {} } });
    expect(cancelled).toMatchObject({ kind: "RECEIPT", receipt: { result: {} } });
    expect(issued).toMatchObject({
      kind: "RECEIPT",
      receipt: { result: { ticketId: "ticket-1", financialEntries: 0 } },
    });
    expect(seen.map((call) => call.action)).toEqual([...ORGANIZER_COMPOSED]);
    expect(seen.map((call) => call.operationId)).toEqual([
      "op-create",
      "op-close",
      "op-open",
      "op-complete",
      "op-cancel",
      "op-invite",
    ]);
    expect(seen.slice(0, 5).every((call) => call.actor === "operator")).toBe(true);
    expect(seen[5]).toMatchObject({ actor: "organizer" });
    expect(Object.keys(seen[0]?.body ?? {}).sort()).toEqual([...requiredKeys("create_event"), "invitationQuota"].sort());
    expect(seen[0]?.body).toMatchObject({
      domain: PINNED_PROTOCOL_DOMAIN,
      eventId: "show-1",
      organizer: "organizer",
      seats: ["A1"],
      invitationQuota: 1,
    });
    for (const banned of ["admissionStatus", "issuerId", "reservationSeconds", "sessionId"]) {
      expect(seen[0]?.body).not.toHaveProperty(banned);
    }
    expect(Object.keys(seen[1]?.body ?? {}).sort()).toEqual(requiredKeys("close_sales"));
    expect(seen[1]?.body).toEqual({ domain: PINNED_PROTOCOL_DOMAIN, eventId: "show-1" });
    expect(Object.keys(seen[3]?.body ?? {}).sort()).toEqual(requiredKeys("complete_event"));
    expect(Object.keys(seen[4]?.body ?? {}).sort()).toEqual(requiredKeys("cancel_event"));
    expect(Object.keys(seen[5]?.body ?? {}).sort()).toEqual(requiredKeys("issue_invitation"));
    expect(seen[5]?.body).toEqual({
      domain: PINNED_PROTOCOL_DOMAIN,
      inventoryId: "inv-0",
      expectedInventoryVersion: 0,
      recipient: "guest-a",
    });
    expect(seen[5]?.body).not.toHaveProperty("eventId");
    expect(seen.some((call) => call.action === "capture" || call.action === "settle_capture" || call.action === "commit_trade" || call.action === "admit")).toBe(false);
    expect(console.state().sent).toEqual([...ORGANIZER_COMPOSED]);
    expect(console.state().halted).toBeNull();
  });

  it("omits invitationQuota when the caller does not type one", async () => {
    const seen: LocalCallInput[] = [];
    const console = new OrganizerConsole(recordingStub(seen));
    expect((await console.createEvent(CREATE)).kind).toBe("RECEIPT");
    expect(Object.keys(seen[0]?.body ?? {}).sort()).toEqual(requiredKeys("create_event"));
    expect(seen[0]?.body).not.toHaveProperty("invitationQuota");
  });

  it("allows close_sales without create_event and fences a second close", async () => {
    const seen: LocalCallInput[] = [];
    const console = new OrganizerConsole(recordingStub(seen));
    expect((await console.closeSales({ operationId: "op-close", eventId: "show-9" })).kind).toBe("RECEIPT");
    const again = await console.closeSales({ operationId: "op-close-2", eventId: "show-9" });
    expect(again).toMatchObject({ kind: "FENCED", blockedBy: { reason: "already-sent" } });
    expect(seen.map((call) => call.operationId)).toEqual(["op-close"]);
  });

  it("issues once per inventory id and allows a second id", async () => {
    const seen: LocalCallInput[] = [];
    const console = new OrganizerConsole(recordingStub(seen));
    expect((await console.issueInvitation(invite())).kind).toBe("RECEIPT");
    const same = await console.issueInvitation(invite({ operationId: "op-invite-2" }));
    expect(same).toMatchObject({ kind: "FENCED", step: "issue_invitation", blockedBy: { reason: "already-sent" } });
    const other = await console.issueInvitation(invite({ operationId: "op-invite-3", inventoryId: "inv-1" }));
    expect(other).toMatchObject({ kind: "RECEIPT", step: "issue_invitation" });
    expect(seen.map((call) => call.operationId)).toEqual(["op-invite", "op-invite-3"]);
  });

  it("fences a call that is in flight and does not mint an operation id", async () => {
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
    const console = new OrganizerConsole(slow);
    const first = console.createEvent(CREATE);
    const second = await console.closeSales({ operationId: "op-close", eventId: "show-1" });
    expect(second).toMatchObject({ kind: "FENCED", blockedBy: { reason: "in-flight" }, identity: { operationId: "op-close" } });
    expect(calls).toBe(1);
    if (release === undefined) {
      throw new Error("missing release");
    }
    release();
    await expect(first).resolves.toMatchObject({ kind: "RECEIPT" });
    expect(calls).toBe(1);
  });

  it("treats a rejection as a halt and does not send the next command", async () => {
    const seen: LocalCallInput[] = [];
    const console = new OrganizerConsole({
      async invokeLocalCall(input) {
        seen.push(structuredClone(input));
        throw new GateRejectedError("refused", "EVENT_EXISTS", { requestId: "req-r", correlationId: "corr-r" }, 422);
      },
    });
    const rejected = await console.createEvent(CREATE);
    expect(rejected).toMatchObject({
      kind: "REJECTED",
      step: "create_event",
      code: "EVENT_EXISTS",
      identity: { operationId: "op-create", requestId: "req-r", correlationId: "corr-r" },
    });
    const next = await console.closeSales({ operationId: "op-close", eventId: "show-1" });
    expect(next).toMatchObject({ kind: "FENCED", step: "close_sales", blockedBy: { reason: "halted" } });
    expect(seen.map((call) => call.action)).toEqual(["create_event"]);
    expect(seen.map((call) => call.operationId)).toEqual(["op-create"]);
  });

  it("treats an unknown outcome as a halt and does not retry", async () => {
    const seen: LocalCallInput[] = [];
    const console = new OrganizerConsole({
      async invokeLocalCall(input) {
        seen.push(structuredClone(input));
        throw new ProtocolError("timed out", "REQUEST_TIMEOUT", {
          requestId: "req-timeout",
          correlationId: "corr-timeout",
        });
      },
    });
    const unknown = await console.openAdmission({ operationId: "op-open", eventId: "show-1" });
    expect(unknown).toMatchObject({
      kind: "UNKNOWN",
      step: "open_admission",
      code: "REQUEST_TIMEOUT",
      identity: { operationId: "op-open", requestId: "req-timeout", correlationId: "corr-timeout" },
    });
    const next = await console.completeEvent({ operationId: "op-complete", eventId: "show-1" });
    expect(next).toMatchObject({ kind: "FENCED", blockedBy: { reason: "halted" } });
    expect(seen).toHaveLength(1);
  });

  it("halts on a pre-send failure and does not call the invoker", async () => {
    const seen: LocalCallInput[] = [];
    const console = new OrganizerConsole(recordingStub(seen));
    await expect(console.createEvent({ ...CREATE, seats: [] })).rejects.toThrow(/seats/);
    expect(seen).toHaveLength(0);
    expect(console.state().halted).toMatchObject({ kind: "NOT_SENT", step: "create_event" });
    const next = await console.cancelEvent({ operationId: "op-cancel", eventId: "show-1" });
    expect(next).toMatchObject({ kind: "FENCED", blockedBy: { reason: "halted" } });
    expect(seen).toHaveLength(0);
  });

  it("records a mismatched receipt as unknown and fences the next write", async () => {
    const seen: LocalCallInput[] = [];
    const stub = createStubOrganizerInvoker();
    const console = new OrganizerConsole({
      async invokeLocalCall(input) {
        seen.push(structuredClone(input));
        const receipt = await stub.invokeLocalCall(input);
        if (input.action === "close_sales" && isRecord(receipt) && isRecord(receipt.result)) {
          return { ...receipt, result: { salesStatus: "OPEN" } };
        }
        if (input.action === "open_admission" && isRecord(receipt) && isRecord(receipt.result)) {
          return { ...receipt, result: { ...receipt.result, extra: true } };
        }
        if (input.action === "create_event" && isRecord(receipt) && isRecord(receipt.result)) {
          return { ...receipt, result: { ...receipt.result, extra: true } };
        }
        return receipt;
      },
    });
    const created = await console.createEvent(CREATE);
    expect(created).toMatchObject({ kind: "UNKNOWN", code: "INVALID_RECEIPT" });
    expect((await console.closeSales({ operationId: "op-close", eventId: "show-1" })).kind).toBe("FENCED");
    expect(seen.map((call) => call.action)).toEqual(["create_event"]);

    const openConsole = new OrganizerConsole({
      async invokeLocalCall(input) {
        const receipt = await stub.invokeLocalCall(input);
        if (input.action === "open_admission" && isRecord(receipt) && isRecord(receipt.result)) {
          return { ...receipt, result: { ...receipt.result, extra: true } };
        }
        return receipt;
      },
    });
    expect((await openConsole.openAdmission({ operationId: "op-open", eventId: "show-1" })).kind).toBe("UNKNOWN");

    const issueConsole = new OrganizerConsole({
      async invokeLocalCall(input) {
        const receipt = await stub.invokeLocalCall(input);
        if (input.action === "issue_invitation" && isRecord(receipt) && isRecord(receipt.result)) {
          return { ...receipt, result: { ...receipt.result, holder: "guest-a" } };
        }
        return receipt;
      },
    });
    expect((await issueConsole.issueInvitation(invite())).kind).toBe("RECEIPT");

    const broke = new OrganizerConsole({
      async invokeLocalCall(input) {
        const receipt = await stub.invokeLocalCall(input);
        if (isRecord(receipt)) {
          return { ...receipt, result: { ticketId: "ticket-1", financialEntries: 1 } };
        }
        return receipt;
      },
    });
    expect((await broke.issueInvitation(invite())).kind).toBe("UNKNOWN");
  });
});
