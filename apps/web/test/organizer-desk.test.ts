import { memoryStore, installAttemptStorage } from "./support/session-store";
import { pinDigest } from "../src/booking-journey-intent";
import { intentScopeDigest } from "../src/core-desk-intent";
import { writeDeskAttempt } from "../src/desk-attempts";
import { describe, expect, it, vi } from "vitest";
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

installAttemptStorage();

const DRAFT: OrganizerDraft = {
  seats: "A1, A2",
  invitationQuota: "1",
  inventoryId: "inv-0",
  expectedInventoryVersion: "0",
  recipient: "guest-a",
};

describe("organizer desk", () => {
  it("keeps the shared create intent fenced when an in-flight subscriber throws", async () => {
    const eventId = "organizer-throwing-subscriber";
    const store = memoryStore();
    let release = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    const { desk, calls } = stubDesk(async () => {
      await gate;
      throw new ProtocolError("lost response", "REQUEST_TIMEOUT", {
        requestId: "req-subscriber", correlationId: "corr-subscriber",
      });
    }, store);
    desk.retain(eventId);
    desk.subscribe(() => {
      if (desk.view(eventId).rows[0]?.status === "in-flight") throw new Error("subscriber failed");
    });
    const statuses: (string | undefined)[] = [];
    desk.subscribe(() => statuses.push(desk.view(eventId).rows[0]?.status));

    const sending = desk.sendItem(eventId, "create_event", DRAFT);
    const reopened = stubDesk((input, shape) => shape.invokeLocalCall(input), store);
    const blocked = await reopened.desk.sendItem(eventId, "create_event", DRAFT);
    release();
    expect(await sending).toMatchObject({ status: "UNKNOWN", code: "REQUEST_TIMEOUT" });
    expect(blocked).toMatchObject({ status: "FENCED" });
    expect(reopened.calls).toHaveLength(0);
    expect(calls).toHaveLength(1);
    expect(statuses).toEqual(["in-flight", "unconfirmed"]);
    const recovered = stubDesk((input, shape) => shape.invokeLocalCall(input), store);
    await recovered.desk.sendItem(eventId, "create_event", DRAFT);
    expect(recovered.calls).toHaveLength(0);
  });

  it("uses the submitted invitation draft after the caller mutates it", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const { desk, calls } = stubDesk(async (input, shape) => {
      await gate;
      return shape.invokeLocalCall(input);
    });
    const draft = { ...DRAFT, organizer: "submitted-organizer" };
    const sending = desk.send("draft-owner", "issue_invitation", draft);
    draft.inventoryId = "caller-mutated";
    draft.organizer = "caller-mutated";
    release();
    await sending;
    const event = desk.getSnapshot().events[0];
    expect(event?.issuedInventoryIds).toEqual(["inv-0"]);
    expect(event?.history[0]?.actor).toBe("submitted-organizer");
    const original = structuredClone(event?.history);
    const field = event?.history[0]?.receipt?.[0];
    if (!field) throw new Error("missing receipt field");
    field.value = "caller-mutated";
    const currentField = event?.rows[5]?.receipt?.[0];
    if (!currentField) throw new Error("missing current receipt field");
    currentField.value = "caller-mutated";
    desk.retain("another-event");
    expect(desk.getSnapshot().events[0]?.history).toEqual(original);
    await desk.send("draft-owner", "issue_invitation", DRAFT);
    expect(calls).toHaveLength(1);
    desk.reset();
    expect(desk.getSnapshot().events).toEqual([]);
  });


  it.each(["success", "unknown", "rejected", "not-sent"] as const)(
    "retains the first receipt when a successor is pending then %s", async (result) => {
      const eventId = `repeat-${result}`;
      let release = () => {};
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const { desk, calls } = stubDesk(async (input, shape) => {
        if (calls.length === 2) {
          await gate;
          if (result === "unknown") throw new ProtocolError("lost response", "REQUEST_TIMEOUT", {
            requestId: "req-second", correlationId: "corr-second",
          });
          if (result === "rejected") throw new GateRejectedError("refused", "FIXTURE_REJECTED", {
            requestId: "req-second", correlationId: "corr-second",
          }, 422);
        }
        const receipt = await shape.invokeLocalCall(input);
        return { ...(receipt as Record<string, unknown>), result: {
          ticketId: `ticket-${(input.body as Record<string, unknown>).inventoryId}`, financialEntries: 0,
        } };
      });
      await desk.send(eventId, "issue_invitation", DRAFT);
      const firstSnapshot = desk.getSnapshot();
      const first = structuredClone(firstSnapshot.events[0]?.history[0]);
      expect(first?.status).toBe("confirmed");
      const submitted = { ...DRAFT, inventoryId: "inv-1", expectedInventoryVersion: result === "not-sent" ? "invalid" : "0" };
      const sending = desk.send(eventId, "issue_invitation", submitted);
      const pending = desk.getSnapshot().events[0];
      if (result !== "not-sent") {
        expect(pending?.rows[5]).toMatchObject({ status: "in-flight", receipt: null,
          code: null, requestId: null, correlationId: null });
        expect(pending?.history).toEqual([first]);
        expect(pending?.lastConfirmed).toContain(first?.operationId);
      }
      release();
      await sending;
      const completed = desk.getSnapshot().events[0];
      expect(completed?.history).toHaveLength(2);
      expect(completed?.history[0]).toEqual(first);
      expect(firstSnapshot.events[0]?.history[0]).toEqual(first);
      const second = completed?.history[1];
      expect(second?.operationId).not.toBe(first?.operationId);
      expect(second?.status).toBe(result === "success" ? "confirmed" : result === "unknown" ? "unconfirmed" : result);
      expect(completed?.history.every((row) => !row.canSend)).toBe(true);
      expect(calls).toHaveLength(result === "not-sent" ? 1 : 2);
      if (result === "success") {
        expect(second?.receipt).not.toBeNull();
        expect(completed?.lastConfirmed).toContain(second?.operationId);
        expect(completed?.issuedInventoryIds).toEqual(["inv-0", "inv-1"]);
        expect(first?.receipt).toContainEqual({ key: "ticketId", value: "ticket-inv-0" });
        expect(second?.receipt).toContainEqual({ key: "ticketId", value: "ticket-inv-1" });
        await desk.send(eventId, "issue_invitation", submitted);
        expect(calls).toHaveLength(2);
      } else {
        expect(second?.receipt).toBeNull();
        expect(completed?.lastConfirmed).toContain(first?.operationId);
        expect(second?.requestId).toBe(result === "not-sent" ? null : "req-second");
        expect(second?.correlationId).toBe(result === "not-sent" ? null : "corr-second");
        const before = calls.length;
        await desk.send(eventId, "issue_invitation", DRAFT);
        expect(calls).toHaveLength(before);
        expect(desk.getSnapshot().events[0]?.history).toEqual(completed?.history);
      }
    },
  );


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
  store = memoryStore(),
): { desk: OrganizerDesk; calls: LocalCallInput[] } {
  const calls: LocalCallInput[] = [];
  const shape = createStubOrganizerInvoker();
  const desk = createOrganizerDesk({
    store,
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
    store: memoryStore(),
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

it("locks an invitation across desks and leaves a replacement row intact after a late answer", async () => {
  const eventId = "retained-invite";
  const store = memoryStore();
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const first = stubDesk(async (input, shape) => { await pending; return shape.invokeLocalCall(input); }, store);
  const second = stubDesk(async (input, shape) => shape.invokeLocalCall(input), store);
  second.desk.retain(eventId);
  const submitted = { ...DRAFT, inventoryId: "caller-entered-inventory", recipient: "caller-entered-recipient" };
  const digest = intentScopeDigest([submitted.inventoryId]);
  const key = `kix-organizer-intent:stub:${digest}:${eventId}`;
  const answer = first.desk.sendItem(eventId, "issue_invitation", submitted);
  const raw = store.getItem(key)!;
  expect(JSON.parse(raw)).toMatchObject({
    v: 1, desk: "organizer", scope: eventId, step: "issue_invitation", operationId: first.calls[0].operationId,
    scopeDigest: digest,
  });
  expect(raw).not.toContain(submitted.inventoryId);
  expect(raw).not.toContain(submitted.recipient);
  expect(first.calls[0].body).toMatchObject({ inventoryId: submitted.inventoryId });
  expect((await second.desk.sendItem(eventId, "close_sales", DRAFT)).status).toBe("FENCED");
  expect(second.calls).toHaveLength(0);
  store.setItem(key, '{"replaced":true}');
  release();
  expect(await answer).toMatchObject({ status: "RECEIPT", code: "SESSION_EVIDENCE_LOST" });
  expect(store.getItem(key)).toBe('{"replaced":true}');
  expect((await first.desk.sendItem(eventId, "close_sales", DRAFT)).code).toBe("SESSION_EVIDENCE_LOST");
  const reopened = stubDesk(async (input, shape) => shape.invokeLocalCall(input), store);
  expect((await reopened.desk.sendItem(eventId, "close_sales", DRAFT)).code).toBe("SESSION_EVIDENCE_LOST");
  expect(first.calls).toHaveLength(1);
  expect(reopened.calls).toHaveLength(0);
});

it("blocks the same inventory under new event labels in flight, after response loss, and on reload", async () => {
  const store = memoryStore();
  const eventId = "invite-original";
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const first = stubDesk(async (input, shape) => {
    await shape.invokeLocalCall(input);
    await pending;
    throw new ProtocolError("lost response", "REQUEST_TIMEOUT", { requestId: "req-lost", correlationId: "corr-lost" });
  }, store);
  const sending = first.desk.sendItem(eventId, "issue_invitation", DRAFT);
  const alias = { ...DRAFT, recipient: "guest-b", expectedInventoryVersion: "1", organizer: "second-organizer" };
  expect(first.calls[0]?.body).not.toHaveProperty("eventId");
  expect(await first.desk.sendItem("invite-in-flight", "issue_invitation", alias)).toMatchObject({ status: "FENCED", code: "UNKNOWN" });
  release();
  expect(await sending).toMatchObject({ status: "UNKNOWN", code: "REQUEST_TIMEOUT" });
  expect(await first.desk.sendItem("invite-after-loss", "issue_invitation", alias)).toMatchObject({ status: "FENCED", code: "UNKNOWN" });
  expect(first.calls).toHaveLength(1);
  const reopened = stubDesk(async (input, shape) => shape.invokeLocalCall(input), store);
  expect(await reopened.desk.sendItem("invite-after-reload", "issue_invitation", alias)).toMatchObject({ status: "FENCED", code: "UNKNOWN" });
  expect(reopened.desk.view("invite-after-reload", alias).rows[5]).toMatchObject({ status: "unconfirmed", operationId: first.calls[0].operationId });
  expect((await reopened.desk.sendItem(eventId, "close_sales", DRAFT)).status).toBe("FENCED");
  expect(reopened.calls).toHaveLength(0);
  expect(await reopened.desk.sendItem("invite-independent", "issue_invitation", { ...DRAFT, inventoryId: "inv-1" })).toMatchObject({ status: "RECEIPT" });
  expect(reopened.calls).toHaveLength(1);
});

it.each([
  { eventId: "x".repeat(60), attempt: 1 },
  { eventId: "🎟".repeat(100), attempt: Number.MAX_SAFE_INTEGER },
])("sends a bounded invitation ID and restores its inventory fence at attempt $attempt", async ({ eventId, attempt }) => {
  const store = memoryStore();
  vi.stubGlobal("sessionStorage", store);
  if (attempt > 1) writeDeskAttempt("organizer", eventId, attempt - 1);
  const draft = { ...DRAFT, inventoryId: "stock" };
  const first = stubDesk(async (input, shape) => {
    await shape.invokeLocalCall(input);
    throw new ProtocolError("lost response", "REQUEST_TIMEOUT", { requestId: "req-lost", correlationId: "corr-lost" });
  }, store);

  expect(await first.desk.sendItem(eventId, "issue_invitation", draft)).toMatchObject({ status: "UNKNOWN", code: "REQUEST_TIMEOUT" });
  expect(first.calls).toHaveLength(1);
  const { operationId } = first.calls[0];
  expect(Array.from(operationId).length).toBeLessThanOrEqual(100);
  expect(operationId).toContain(`:${attempt}:issue_invitation:`);
  expect(operationId).not.toContain(draft.inventoryId);

  const reopened = stubDesk(async (input, shape) => shape.invokeLocalCall(input), store);
  expect(await reopened.desk.sendItem("short-alias", "issue_invitation", draft)).toMatchObject({ status: "FENCED", code: "UNKNOWN" });
  expect(reopened.desk.view("short-alias", draft).rows[5]).toMatchObject({ status: "unconfirmed", operationId });
  expect(reopened.calls).toHaveLength(0);
});

it("checks event-keyed invitation history from an earlier build across labels", async () => {
  const store = memoryStore();
  const scope = "legacy-invite";
  const key = `kix-organizer-intent:stub:${scope}`;
  const raw = JSON.stringify({
    v: 1, pinDigest, mode: "stub", desk: "organizer", scope, step: "issue_invitation",
    operationId: `org:${scope}:1:issue_invitation:${DRAFT.inventoryId}`,
    scopeDigest: intentScopeDigest([scope, DRAFT.inventoryId]), lastConfirmed: null,
  });
  store.setItem(key, raw);
  const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input), store);
  expect(await desk.sendItem("legacy-invite-alias", "issue_invitation", DRAFT)).toMatchObject({ status: "FENCED", code: "UNKNOWN" });
  expect(calls).toHaveLength(0);
  expect(store.getItem(key)).toBe(raw);
});

it("publishes counter exhaustion through the organizer workspace sender", async () => {
  const eventId = "org-exhausted";
  writeDeskAttempt("organizer", eventId, Number.MAX_SAFE_INTEGER);
  const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
  expect(await desk.sendItem(eventId, "create_event", DRAFT)).toMatchObject({ status: "FENCED", code: "COUNTER_EXHAUSTED", operationId: null });
  expect(calls).toHaveLength(0);
});
