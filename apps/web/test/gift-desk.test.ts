import { memoryStore, installAttemptStorage } from "./support/session-store";
import { describe, expect, it } from "vitest";
import {
  GateRejectedError,
  ProtocolError,
  createStubGiftInvoker,
  integrationHttpObservation,
  localStubObservation,
  type LocalCallInput,
  type TransportObservation,
} from "@kix/protocol-adapter";
import {
  GIFT_DEFAULT_RECIPIENT,
  GIFT_DONOR,
  createGiftDesk,
  giftPathStatus,
  type GiftDesk,
  type GiftDraft,
} from "../src/gift-desk";

installAttemptStorage();

const DRAFT: GiftDraft = {
  ticketId: "ticket-9",
  expectedVersion: "1",
  expiresAt: "600",
  recipient: GIFT_DEFAULT_RECIPIENT,
};

describe("gift desk", () => {
  it("keeps the gift intent fenced when an in-flight subscriber throws", async () => {
    const giftId = "gift-throwing-subscriber";
    const store = memoryStore();
    let release = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    const { desk, calls } = stubDesk(async () => {
      await gate;
      throw new ProtocolError("lost response", "REQUEST_TIMEOUT", {
        requestId: "req-subscriber", correlationId: "corr-subscriber",
      });
    }, store);
    desk.retain(giftId);
    desk.subscribe(() => {
      if (desk.view(giftId).rows[0]?.status === "in-flight") throw new Error("subscriber failed");
    });
    const statuses: (string | undefined)[] = [];
    desk.subscribe(() => statuses.push(desk.view(giftId).rows[0]?.status));

    const sending = desk.send(giftId, "offer_gift", DRAFT);
    const reopened = stubDesk((input, shape) => shape.invokeLocalCall(input), store);
    await reopened.desk.send(giftId, "offer_gift", DRAFT);
    release();
    await sending;
    expect(desk.view(giftId).rows[0]).toMatchObject({ status: "unconfirmed", code: "REQUEST_TIMEOUT" });
    expect(reopened.calls).toHaveLength(0);
    expect(calls).toHaveLength(1);
    expect(statuses).toEqual(["in-flight", "unconfirmed"]);
    const recovered = stubDesk((input, shape) => shape.invokeLocalCall(input), store);
    await recovered.desk.send(giftId, "offer_gift", DRAFT);
    expect(recovered.calls).toHaveLength(0);
  });

  it("confirms offer_gift and accept_gift on the stub-shape invoker", async () => {
    const giftId = "gift_lanterns";
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    await desk.probe();
    await desk.send(giftId, "offer_gift", DRAFT);
    await desk.send(giftId, "accept_gift", DRAFT);
    const model = desk.view(giftId);
    expect(model.path.kind).toBe("available-stub-shape");
    expect(model.rows.map((row) => row.status)).toEqual(["confirmed", "confirmed", "blocked"]);
    expect(model.rows[1]?.canSend).toBe(false);
    expect(model.rows[2]?.canSend).toBe(false);
    expect(calls.map((call) => call.action)).toEqual(["offer_gift", "accept_gift"]);
    expect(calls[0]?.actor).toBe(GIFT_DONOR);
    expect(calls[1]?.actor).toBe(GIFT_DEFAULT_RECIPIENT);
    expect(calls[0]?.body).toMatchObject({
      giftId,
      ticketId: "ticket-9",
      expectedVersion: 1,
      expiresAt: 600,
      recipient: GIFT_DEFAULT_RECIPIENT,
    });
    expect(model.rows[0]?.operationId).toBe(`gft:${giftId}:1:offer_gift`);
    expect(model.rows[1]?.operationId).toBe(`gft:${giftId}:1:accept_gift`);
    expect(model.lastConfirmed).toContain("accept_gift");
    expect(model.unconfirmed).toBe("Unconfirmed request: none");
    expect(model.rows[1]?.receipt?.map((field) => field.key).sort()).toEqual([
      "financialEntries",
      "owner",
      "rightsVersion",
      "ticketId",
    ]);
    expect(model.rows[1]?.receipt?.find((field) => field.key === "financialEntries")?.value).toBe("0");
  });

  it("confirms offer_gift and cancel_gift and blocks accept", async () => {
    const giftId = "gift_cancel";
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    await desk.send(giftId, "offer_gift", DRAFT);
    await desk.send(giftId, "cancel_gift", DRAFT);
    await desk.send(giftId, "accept_gift", DRAFT);
    expect(calls.map((call) => call.action)).toEqual(["offer_gift", "cancel_gift"]);
    expect(desk.view(giftId).rows.map((row) => row.status)).toEqual(["confirmed", "blocked", "confirmed"]);
    expect(desk.view(giftId).rows.every((row) => row.canSend === false)).toBe(true);
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
    await desk.send("gift_http", "offer_gift", DRAFT);
    expect(calls).toBe(0);
    expect(desk.view("gift_http").path.kind).toBe("checking");
    await desk.probe();
    expect(desk.view("gift_http").path).toMatchObject({ kind: "unavailable", code: "GATE_UNAVAILABLE" });
    await desk.send("gift_http", "offer_gift", DRAFT);
    expect(calls).toBe(0);
    expect(desk.view("gift_http").rows.every((row) => row.canSend === false)).toBe(true);
  });

  it("shows a timeout as unconfirmed and blocks accept and cancel", async () => {
    const giftId = "gift_timeout";
    const { desk, calls } = stubDesk(async () => {
      throw new ProtocolError("The exchange timed out.", "REQUEST_TIMEOUT", {
        requestId: "req-timeout",
        correlationId: "corr-timeout",
      });
    });
    await desk.send(giftId, "offer_gift", DRAFT);
    await desk.send(giftId, "cancel_gift", DRAFT);
    await desk.send(giftId, "accept_gift", DRAFT);
    expect(calls.map((call) => call.action)).toEqual(["offer_gift"]);
    const model = desk.view(giftId);
    expect(model.rows.map((row) => row.status)).toEqual(["unconfirmed", "blocked", "blocked"]);
    expect(model.rows[0]?.note).toContain("Unconfirmed");
    expect(model.rows[0]?.note).toContain("Not a rejection");
    expect(model.unconfirmed).toContain("offer_gift");
    expect(model.lastConfirmed).toBe("Last confirmed receipt: none");
    expect(model.rows.every((row) => row.canSend === false)).toBe(true);
  });

  it("words only a gate rejection as rejected and blocks the next rows", async () => {
    const giftId = "gift_reject";
    const { desk, calls } = stubDesk(async () => {
      throw new GateRejectedError("refused", "GIFT_EXISTS", { requestId: "req-r", correlationId: "corr-r" }, 422);
    });
    await desk.send(giftId, "offer_gift", DRAFT);
    await desk.send(giftId, "accept_gift", DRAFT);
    expect(calls).toHaveLength(1);
    const model = desk.view(giftId);
    expect(model.rows[0]?.status).toBe("rejected");
    expect(model.rows[0]?.note).toBe("Rejected by the gate (GIFT_EXISTS).");
    expect(model.rows[1]?.status).toBe("blocked");
    expect(model.rows[2]?.status).toBe("blocked");
  });

  it("marks an invalid expiresAt as not sent and does not call the invoker", async () => {
    const giftId = "gift_expiry";
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    await desk.send(giftId, "offer_gift", { ...DRAFT, expiresAt: "" });
    await desk.send(giftId, "cancel_gift", DRAFT);
    expect(calls).toHaveLength(0);
    expect(desk.view(giftId).rows[0]?.status).toBe("not-sent");
    expect(desk.view(giftId).rows[0]?.note).toContain("Not sent");
    expect(desk.view(giftId).rows[1]?.status).toBe("blocked");
    expect(desk.view(giftId).rows[2]?.status).toBe("blocked");
    expect(desk.view(giftId).rows.every((row) => row.canSend === false)).toBe(true);
  });

  it("marks an invalid expectedVersion as not sent", async () => {
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    await desk.send("gift_version", "offer_gift", { ...DRAFT, expectedVersion: "1.5" });
    expect(calls).toHaveLength(0);
    expect(desk.view("gift_version").rows[0]?.status).toBe("not-sent");
    expect(desk.view("gift_version").rows[2]?.canSend).toBe(false);
  });

  it("does not send accept before the offer", async () => {
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    await desk.send("gift_order", "accept_gift", DRAFT);
    expect(calls).toHaveLength(0);
    expect(desk.view("gift_order").rows[0]?.status).toBe("ready");
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
    const first = desk.send("gift_flight", "offer_gift", DRAFT);
    await desk.send("gift_flight", "offer_gift", DRAFT);
    expect(entered).toBe(1);
    expect(desk.view("gift_flight").rows[0]?.status).toBe("in-flight");
    release();
    await first;
    expect(entered).toBe(1);
    expect(desk.view("gift_flight").rows[0]?.status).toBe("confirmed");
  });

  it("reset clears page-load gifts", () => {
    const { desk } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    desk.retain("gift_reset");
    expect(desk.view("").opened.map((item) => item.giftId)).toContain("gift_reset");
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
    expect(giftPathStatus("stub", null).kind).toBe("available-stub-shape");
    expect(giftPathStatus("integration-http", null).kind).toBe("checking");
    expect(giftPathStatus("integration-http", { ...unavailable, state: "up" }).kind).toBe("available");
    expect(giftPathStatus("integration-http", unavailable)).toMatchObject({
      kind: "unavailable",
      code: "GATE_UNAVAILABLE",
    });
    expect(giftPathStatus("stub", unavailable).kind).toBe("available-stub-shape");
  });
});

function stubDesk(
  handle: (input: LocalCallInput, shape: ReturnType<typeof createStubGiftInvoker>) => Promise<unknown>,
  store = memoryStore(),
): { desk: GiftDesk; calls: LocalCallInput[] } {
  const calls: LocalCallInput[] = [];
  const shape = createStubGiftInvoker();
  const desk = createGiftDesk({
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

function httpDesk(observation: TransportObservation, invoke: () => Promise<unknown>): GiftDesk {
  return createGiftDesk({
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

it.each(["gift+demo", "gift % 다음, 🎟️"])("retains a pending resolution for %s and its predecessor across desks", async (giftId) => {
  const store = memoryStore();
  const first = stubDesk(async (input, shape) => {
    if (input.action === "accept_gift") throw new ProtocolError("lost", "REQUEST_TIMEOUT", { requestId: "req-loss", correlationId: "corr-loss" });
    return shape.invokeLocalCall(input);
  }, store);
  const second = stubDesk(async (input, shape) => shape.invokeLocalCall(input), store);
  first.desk.retain(giftId);
  second.desk.retain(giftId);
  await first.desk.send(giftId, "offer_gift", DRAFT);
  await first.desk.send(giftId, "accept_gift", DRAFT);
  expect(first.calls[0]?.body).toMatchObject({ giftId });
  expect(first.calls[0]?.operationId).toBe(`gft:${giftId}:1:offer_gift`);
  const key = `kix-gift-intent:stub:${encodeURIComponent(giftId)}`;
  const raw = store.getItem(key)!;
  expect(JSON.parse(raw)).toMatchObject({
    v: 1, desk: "gift", mode: "stub", scope: giftId, step: "accept_gift", operationId: first.calls[1].operationId,
    lastConfirmed: { step: "offer_gift", operationId: first.calls[0].operationId },
  });
  for (const value of [DRAFT.ticketId, DRAFT.recipient, "expiresAt"]) expect(raw).not.toContain(value);
  await second.desk.send(giftId, "offer_gift", DRAFT);
  expect(second.calls).toHaveLength(0);
  const reopened = stubDesk(async (input, shape) => shape.invokeLocalCall(input), store);
  await reopened.desk.send(giftId, "cancel_gift", DRAFT);
  expect(reopened.desk.view(giftId).rows.slice(0, 2)).toMatchObject([{ status: "confirmed" }, { status: "unconfirmed" }]);
  expect(reopened.calls).toHaveLength(0);
  await reopened.desk.send("gift-independent", "offer_gift", DRAFT);
  expect(reopened.calls).toHaveLength(1);
  expect(store.getItem(key)).toBe(raw);
});
