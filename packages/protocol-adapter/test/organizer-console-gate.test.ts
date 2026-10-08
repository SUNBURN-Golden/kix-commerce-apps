import { type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CONTRACT_ONLY_LOCAL_CALL_METHOD,
  CONTRACT_ONLY_LOCAL_CALL_PATH,
  HttpProtocolAdapter,
  OrganizerConsole,
  PINNED_PROTOCOL_DOMAIN,
} from "../src/index.js";
import type { LocalCallInput } from "../src/local-call.js";
import { SHOW_POLICY } from "./support/journey-fixture.js";
import { assertReviewedCheckout, protocolRoot, REVIEWED_GATE_RUNS, startGate, stopGate } from "./support/reviewed-gate.js";

const describeGate = REVIEWED_GATE_RUNS ? describe.sequential : describe.skip;

function freshId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function watchLocalCalls(baseUrl: string, seen: LocalCallInput[]): HttpProtocolAdapter {
  return new HttpProtocolAdapter(baseUrl, async (input, init) => {
    const headers = new Headers(init?.headers);
    expect(headers.has("Idempotency-Key")).toBe(false);
    expect(init?.method).toBe(CONTRACT_ONLY_LOCAL_CALL_METHOD);
    const url = new URL(String(input));
    expect(url.protocol).toBe("http:");
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.pathname).toBe(CONTRACT_ONLY_LOCAL_CALL_PATH);
    if (typeof init?.body !== "string") {
      throw new Error("local-call body was not a string");
    }
    seen.push(JSON.parse(init.body) as LocalCallInput);
    return fetch(input, init);
  });
}

describeGate("organizer console live gate", () => {
  let baseUrl = "";
  let child: ChildProcess | undefined;

  beforeAll(async () => {
    const root = protocolRoot();
    assertReviewedCheckout(root);
    const started = await startGate(root);
    baseUrl = started.baseUrl;
    child = started.child;
  }, 20000);

  afterAll(async () => {
    await stopGate(child);
  });

  it("creates, issues one invitation while sales are open, then closes sales and opens admission", async () => {
    const seen: LocalCallInput[] = [];
    const http = watchLocalCalls(baseUrl, seen);
    const eventId = freshId("show");
    const console = new OrganizerConsole(http);
    const created = await console.createEvent({
      operationId: freshId("op-create"),
      eventId,
      organizer: "organizer",
      policy: SHOW_POLICY,
      seats: ["A1"],
      invitationQuota: 1,
    });
    expect(created).toMatchObject({ kind: "RECEIPT", step: "create_event" });
    if (created.kind !== "RECEIPT" || !isRecord(created.receipt.result) || !Array.isArray(created.receipt.result.inventoryIds)) {
      throw new Error("create_event did not return inventoryIds");
    }
    expect(Object.keys(created.receipt.result).sort()).toEqual([
      "eventId",
      "inventoryIds",
      "policyHash",
      "reservationSeconds",
    ]);
    const inventoryId = created.receipt.result.inventoryIds[0];
    if (typeof inventoryId !== "string" || inventoryId.length === 0) {
      throw new Error("create_event did not return an inventory id");
    }
    const issued = await console.issueInvitation({
      operationId: freshId("op-invite"),
      eventId,
      inventoryId,
      expectedInventoryVersion: 0,
      recipient: freshId("guest"),
      organizer: "organizer",
    });
    expect(issued).toMatchObject({ kind: "RECEIPT", step: "issue_invitation" });
    if (issued.kind !== "RECEIPT" || !isRecord(issued.receipt.result)) {
      throw new Error("issue_invitation did not return a receipt");
    }
    expect(typeof issued.receipt.result.ticketId).toBe("string");
    expect(issued.receipt.result.ticketId).not.toBe("");
    expect(issued.receipt.result.financialEntries).toBe(0);
    const closed = await console.closeSales({ operationId: freshId("op-close"), eventId });
    expect(closed).toMatchObject({
      kind: "RECEIPT",
      step: "close_sales",
      receipt: { result: { salesStatus: "CLOSED" } },
    });
    const opened = await console.openAdmission({ operationId: freshId("op-open"), eventId });
    expect(opened).toMatchObject({ kind: "RECEIPT", step: "open_admission" });
    if (opened.kind !== "RECEIPT" || !isRecord(opened.receipt.result)) {
      throw new Error("open_admission did not return a receipt");
    }
    expect(opened.receipt.result).toEqual({ admissionStatus: "OPEN" });
    expect(console.state().halted).toBeNull();
    expect(seen.map((call) => call.action)).toEqual([
      "create_event",
      "issue_invitation",
      "close_sales",
      "open_admission",
    ]);
    expect(seen[0]?.actor).toBe("operator");
    expect(seen[1]?.actor).toBe("organizer");
    expect(seen.slice(2).every((call) => call.actor === "operator")).toBe(true);
    expect(seen.some((call) => call.action === "capture" || call.action === "settle_capture" || call.action === "commit_trade" || call.action === "admit")).toBe(false);
    expect(seen.every((call) => isRecord(call.body) && call.body.domain === PINNED_PROTOCOL_DOMAIN)).toBe(true);
  }, 20000);

  it("reports the gate rejection when an invitation is issued after sales are closed", async () => {
    const http = new HttpProtocolAdapter(baseUrl);
    const eventId = freshId("show");
    const console = new OrganizerConsole(http);
    const created = await console.createEvent({
      operationId: freshId("op-create"),
      eventId,
      organizer: "organizer",
      policy: SHOW_POLICY,
      seats: ["A1"],
      invitationQuota: 1,
    });
    if (created.kind !== "RECEIPT" || !isRecord(created.receipt.result) || !Array.isArray(created.receipt.result.inventoryIds)) {
      throw new Error("create_event did not return inventoryIds");
    }
    const inventoryId = created.receipt.result.inventoryIds[0];
    if (typeof inventoryId !== "string" || inventoryId.length === 0) {
      throw new Error("create_event did not return an inventory id");
    }
    const closed = await console.closeSales({ operationId: freshId("op-close"), eventId });
    expect(closed).toMatchObject({ kind: "RECEIPT", step: "close_sales" });
    const issued = await console.issueInvitation({
      operationId: freshId("op-invite"),
      eventId,
      inventoryId,
      expectedInventoryVersion: 0,
      recipient: freshId("guest"),
      organizer: "organizer",
    });
    expect(issued).toMatchObject({ kind: "REJECTED", step: "issue_invitation", code: "EVENT_NOT_OPEN" });
    expect(console.state().halted).toMatchObject({ step: "issue_invitation", kind: "REJECTED" });
    const later = await console.openAdmission({ operationId: freshId("op-open"), eventId });
    expect(later).toMatchObject({ kind: "FENCED", step: "open_admission", blockedBy: { reason: "halted" } });
  }, 20000);
});
