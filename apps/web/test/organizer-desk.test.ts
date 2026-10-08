import { describe, expect, it } from "vitest";
import {
  GateRejectedError,
  ProtocolError,
  createStubOrganizerInvoker,
  integrationHttpObservation,
  localStubObservation,
  type LocalCallInput,
  type TransportObservation,
} from "@kix/protocol-adapter";
import {
  ORGANIZER_DEFAULT_ID,
  ORGANIZER_OPERATOR,
  createOrganizerDesk,
  organizerPathStatus,
  type OrganizerDesk,
  type OrganizerDraft,
} from "../src/organizer-desk";

const DRAFT: OrganizerDraft = {
  seats: "A1, A2",
  invitationQuota: "1",
  inventoryId: "inv-0",
  expectedInventoryVersion: "0",
  recipient: "guest-a",
};

describe("organizer desk", () => {
  it("confirms the six commands on the stub-shape invoker", async () => {
    const eventId = "show_lanterns";
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    await desk.probe();
    await desk.send(eventId, "create_event", DRAFT);
    await desk.send(eventId, "close_sales", DRAFT);
    await desk.send(eventId, "open_admission", DRAFT);
    await desk.send(eventId, "complete_event", DRAFT);
    await desk.send(eventId, "cancel_event", DRAFT);
    await desk.send(eventId, "issue_invitation", DRAFT);
    const model = desk.view(eventId, DRAFT);
    expect(model.path.kind).toBe("available-stub-shape");
    expect(model.rows.map((row) => row.status)).toEqual([
      "confirmed",
      "confirmed",
      "confirmed",
      "confirmed",
      "confirmed",
      "confirmed",
    ]);
    expect(model.rows.every((row) => row.canSend === false)).toBe(true);
    expect(calls.map((call) => call.action)).toEqual([
      "create_event",
      "close_sales",
      "open_admission",
      "complete_event",
      "cancel_event",
      "issue_invitation",
    ]);
    expect(calls.slice(0, 5).every((call) => call.actor === ORGANIZER_OPERATOR)).toBe(true);
    expect(calls[5]?.actor).toBe(ORGANIZER_DEFAULT_ID);
    expect(calls[0]?.body).toMatchObject({
      eventId,
      organizer: ORGANIZER_DEFAULT_ID,
      seats: ["A1", "A2"],
      invitationQuota: 1,
    });
    expect(calls[0]?.body).not.toHaveProperty("admissionStatus");
    expect(calls[0]?.body).not.toHaveProperty("issuerId");
    expect(calls[0]?.body).not.toHaveProperty("reservationSeconds");
    expect(calls[0]?.body).not.toHaveProperty("sessionId");
    expect(calls[5]?.body).toMatchObject({
      inventoryId: "inv-0",
      expectedInventoryVersion: 0,
      recipient: "guest-a",
    });
    expect(calls[5]?.body).not.toHaveProperty("eventId");
    expect(model.rows[0]?.operationId).toBe(`org:${eventId}:1:create_event`);
    expect(model.rows[5]?.operationId).toBe(`org:${eventId}:1:issue_invitation:inv-0`);
    expect(model.lastConfirmed).toContain("issue_invitation");
    expect(model.unconfirmed).toBe("Unconfirmed request: none");
    expect(model.rows[0]?.receipt?.map((field) => field.key).sort()).toEqual([
      "eventId",
      "inventoryIds",
      "policyHash",
      "reservationSeconds",
    ]);
    expect(model.rows[5]?.receipt?.find((field) => field.key === "financialEntries")?.value).toBe("0");
    expect(model.rows[0]?.note).toContain("Not from the gate");
  });

  it("omits a blank invitation quota", async () => {
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    await desk.send("show_quota", "create_event", { ...DRAFT, invitationQuota: "" });
    expect(calls[0]?.body).not.toHaveProperty("invitationQuota");
    expect(desk.view("show_quota").rows[0]?.status).toBe("confirmed");
  });

  it("does not send while integration HTTP is unavailable", async () => {
    let calls = 0;
    const desk = httpDesk(
      integrationHttpObservation({
        state: "unavailable",
        code: "GATE_UNAVAILABLE",
        requestId: null,
        correlationId: null,
        localFileJournal: null,
        detail: "Loopback gate is unavailable (GATE_UNAVAILABLE).",
      }),
      async () => {
        calls += 1;
        throw new Error("sent");
      },
    );
    await desk.send("show_http", "create_event", DRAFT);
    expect(calls).toBe(0);
    expect(desk.view("show_http").path.kind).toBe("checking");
    await desk.probe();
    expect(desk.view("show_http").path).toMatchObject({ kind: "unavailable", code: "GATE_UNAVAILABLE" });
    await desk.send("show_http", "create_event", DRAFT);
    expect(calls).toBe(0);
    expect(desk.view("show_http").rows.every((row) => row.canSend === false)).toBe(true);
    expect(desk.view("show_http").rows[0]?.status).toBe("unavailable");
  });

  it("shows a timeout as unconfirmed and blocks the later rows", async () => {
    const eventId = "show_timeout";
    const { desk, calls } = stubDesk(async () => {
      throw new ProtocolError("The exchange timed out.", "REQUEST_TIMEOUT", {
        requestId: "req-timeout",
        correlationId: "corr-timeout",
      });
    });
    await desk.send(eventId, "create_event", DRAFT);
    await desk.send(eventId, "close_sales", DRAFT);
    expect(calls.map((call) => call.action)).toEqual(["create_event"]);
    const model = desk.view(eventId, DRAFT);
    expect(model.rows[0]?.status).toBe("unconfirmed");
    expect(model.rows[0]?.note).toContain("Unconfirmed");
    expect(model.rows[0]?.note).toContain("Not a rejection");
    expect(model.rows.slice(1).every((row) => row.status === "blocked")).toBe(true);
    expect(model.unconfirmed).toContain("create_event");
    expect(model.lastConfirmed).toBe("Last confirmed receipt: none");
    expect(model.rows.every((row) => row.canSend === false)).toBe(true);
  });

  it("words only a gate rejection as rejected and blocks the next rows", async () => {
    const eventId = "show_reject";
    const { desk, calls } = stubDesk(async () => {
      throw new GateRejectedError("refused", "EVENT_EXISTS", { requestId: "req-r", correlationId: "corr-r" }, 422);
    });
    await desk.send(eventId, "close_sales", DRAFT);
    await desk.send(eventId, "open_admission", DRAFT);
    expect(calls).toHaveLength(1);
    const model = desk.view(eventId, DRAFT);
    expect(model.rows[1]?.status).toBe("rejected");
    expect(model.rows[1]?.note).toBe("Rejected by the gate (EVENT_EXISTS).");
    expect(model.rows[0]?.status).toBe("blocked");
    expect(model.rows[2]?.status).toBe("blocked");
  });

  it("marks an invalid invitation quota as not sent and does not call the invoker", async () => {
    const eventId = "show_quota_bad";
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    await desk.send(eventId, "create_event", { ...DRAFT, invitationQuota: "1.5" });
    await desk.send(eventId, "close_sales", DRAFT);
    expect(calls).toHaveLength(0);
    expect(desk.view(eventId).rows[0]?.status).toBe("not-sent");
    expect(desk.view(eventId).rows[0]?.note).toContain("Not sent");
    expect(desk.view(eventId).rows[1]?.status).toBe("blocked");
    expect(desk.view(eventId).rows.every((row) => row.canSend === false)).toBe(true);
  });

  it("marks an invalid expected inventory version as not sent", async () => {
    const eventId = "show_version";
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    await desk.send(eventId, "create_event", { ...DRAFT, invitationQuota: "" });
    await desk.send(eventId, "issue_invitation", { ...DRAFT, expectedInventoryVersion: "nope" });
    expect(calls.map((call) => call.action)).toEqual(["create_event"]);
    expect(desk.view(eventId).rows[5]?.status).toBe("not-sent");
    expect(desk.view(eventId).rows[1]?.status).toBe("blocked");
  });

  it("surfaces an overlong operation id as not sent", async () => {
    const eventId = "e".repeat(90);
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    await desk.send(eventId, "create_event", DRAFT);
    expect(calls).toHaveLength(0);
    expect(desk.view(eventId).rows[0]?.status).toBe("not-sent");
    expect(`org:${eventId}:1:create_event`.length).toBeGreaterThan(100);
  });

  it("ignores a second send while the first attempt is in flight", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered = 0;
    const { desk } = stubDesk(async (input, shape) => {
      entered += 1;
      await gate;
      return shape.invokeLocalCall(input);
    });
    const first = desk.send("show_flight", "create_event", DRAFT);
    await desk.send("show_flight", "close_sales", DRAFT);
    expect(entered).toBe(1);
    expect(desk.view("show_flight").rows[0]?.status).toBe("in-flight");
    release();
    await first;
    expect(entered).toBe(1);
    expect(desk.view("show_flight").rows[0]?.status).toBe("confirmed");
  });

  it("reset clears page-load events", () => {
    const { desk } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    desk.retain("show_reset");
    expect(desk.view("").opened.map((item) => item.eventId)).toContain("show_reset");
    desk.reset();
    expect(desk.view("").opened).toEqual([]);
  });

  it("maps path status without selecting the stub for a failed probe", () => {
    const unavailable = integrationHttpObservation({
      state: "unavailable",
      code: "GATE_UNAVAILABLE",
      requestId: null,
      correlationId: null,
      localFileJournal: null,
      detail: "Loopback gate is unavailable.",
    });
    expect(organizerPathStatus("stub", null).kind).toBe("available-stub-shape");
    expect(organizerPathStatus("integration-http", null).kind).toBe("checking");
    expect(organizerPathStatus("integration-http", { ...unavailable, state: "up" }).kind).toBe("available");
    expect(organizerPathStatus("integration-http", unavailable)).toMatchObject({
      kind: "unavailable",
      code: "GATE_UNAVAILABLE",
    });
    expect(organizerPathStatus("stub", unavailable).kind).toBe("available-stub-shape");
  });
});

function stubDesk(
  handle: (input: LocalCallInput, shape: ReturnType<typeof createStubOrganizerInvoker>) => Promise<unknown>,
): { desk: OrganizerDesk; calls: LocalCallInput[] } {
  const calls: LocalCallInput[] = [];
  const shape = createStubOrganizerInvoker();
  const desk = createOrganizerDesk({
    protocol: {
      describe: () => ({ environment: "stub" }),
      observeTransport: async () => localStubObservation(),
    },
    source: {
      source: "stub-shape",
      invoker: {
        async invokeLocalCall(input) {
          calls.push(structuredClone(input));
          return handle(input, shape);
        },
      },
    },
  });
  return { desk, calls };
}

function httpDesk(observation: TransportObservation, invoke: () => Promise<unknown>): OrganizerDesk {
  return createOrganizerDesk({
    protocol: {
      describe: () => ({ environment: "integration-http" }),
      observeTransport: async () => observation,
    },
    source: {
      source: "integration-gate",
      invoker: {
        async invokeLocalCall() {
          return invoke();
        },
      },
    },
  });
}
