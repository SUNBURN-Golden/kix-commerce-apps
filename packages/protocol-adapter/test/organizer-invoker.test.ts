import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  HttpProtocolAdapter,
  StubProtocolAdapter,
  createProtocol,
  createStubOrganizerInvoker,
  organizerInvokerFor,
  type CommerceProtocol,
} from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("organizer invoker selection", () => {
  it("uses a shape-only invoker for the stub and leaves the stub without invokeLocalCall", async () => {
    const stub = createProtocol();
    expect(stub).toBeInstanceOf(StubProtocolAdapter);
    const selected = organizerInvokerFor(stub);
    expect(selected?.source).toBe("stub-shape");
    expect(selected?.invoker).not.toBe(stub);
    expect("invokeLocalCall" in stub).toBe(false);
    const created = await selected?.invoker.invokeLocalCall({
      operationId: "op-create",
      actor: "operator",
      action: "create_event",
      body: { eventId: "show-1", seats: ["A1", "A2"] },
    });
    expect(created).toMatchObject({
      sequence: 1,
      action: "create_event",
      result: {
        eventId: "show-1",
        policyHash: "policy-hash",
        inventoryIds: ["inv-0", "inv-1"],
        reservationSeconds: 900,
      },
    });
    const closed = await selected?.invoker.invokeLocalCall({
      operationId: "op-close",
      actor: "operator",
      action: "close_sales",
      body: { eventId: "show-1" },
    });
    expect(closed).toMatchObject({ sequence: 2, action: "close_sales", result: { salesStatus: "CLOSED" } });
    const opened = await selected?.invoker.invokeLocalCall({
      operationId: "op-open",
      actor: "operator",
      action: "open_admission",
      body: { eventId: "show-1" },
    });
    expect(opened).toMatchObject({ action: "open_admission", result: { admissionStatus: "OPEN" } });
    const issued = await selected?.invoker.invokeLocalCall({
      operationId: "op-invite",
      actor: "organizer",
      action: "issue_invitation",
      body: { inventoryId: "inv-0" },
    });
    expect(issued).toMatchObject({
      action: "issue_invitation",
      result: { ticketId: "ticket-1", financialEntries: 0 },
    });
    const completed = await selected?.invoker.invokeLocalCall({
      operationId: "op-complete",
      actor: "operator",
      action: "complete_event",
      body: { eventId: "show-1" },
    });
    expect(completed).toMatchObject({ action: "complete_event", result: {} });
    const cancelled = await selected?.invoker.invokeLocalCall({
      operationId: "op-cancel",
      actor: "operator",
      action: "cancel_event",
      body: { eventId: "show-1" },
    });
    expect(cancelled).toMatchObject({ action: "cancel_event", result: {} });
  });

  it("returns the http adapter itself for integration-gate", () => {
    const http = new HttpProtocolAdapter("http://127.0.0.1:9", async () => {
      throw new Error("unused");
    });
    const selected = organizerInvokerFor(http);
    expect(selected).toEqual({ source: "integration-gate", invoker: http });
  });

  it("returns null for an unknown protocol", () => {
    expect(organizerInvokerFor({} as CommerceProtocol)).toBeNull();
  });

  it("refuses any action outside the six", async () => {
    const invoker = createStubOrganizerInvoker();
    for (const action of ["capture", "settle_capture", "commit_trade", "admit", "prepare_trade", "offer_gift"]) {
      await expect(
        invoker.invokeLocalCall({
          operationId: "op-other",
          actor: "operator",
          action,
          body: {},
        }),
      ).rejects.toThrow(new RegExp(action));
    }
  });

  it("does not construct the other adapter", () => {
    const source = readFileSync(path.join(here, "../src/organizer-invoker.ts"), "utf8");
    expect(source).not.toContain("new StubProtocolAdapter");
    expect(source).not.toContain("new HttpProtocolAdapter");
    expect(source).not.toContain("fallback");
  });
});
