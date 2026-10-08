import { describe, expect, it } from "vitest";
import {
  GateRejectedError,
  ProtocolError,
  createStubJourneyInvoker,
  integrationHttpObservation,
  localStubObservation,
  type LocalCallInput,
  type TransportObservation,
} from "@kix/protocol-adapter";
import {
  SYNTHETIC_SHOW_POLICY,
  createJourneyDesk,
  journeyPathStatus,
  type JourneyDesk,
} from "../src/journey-desk";
import { EXPECTED_STEP_REPORT, SHOW_POLICY } from "../../../packages/protocol-adapter/test/support/journey-fixture";

describe("journey desk", () => {
  it("keeps the synthetic policy equal to the merged fixture and does not treat it as a displayed price", () => {
    expect(SYNTHETIC_SHOW_POLICY).toEqual(SHOW_POLICY);
  });

  it("confirms create_event, prepare_trade, and accept_trade on the stub-shape invoker", async () => {
    const eventId = "evt_lanterns_journey";
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    await desk.probe();
    await desk.send(eventId, "create_event");
    await desk.send(eventId, "prepare_trade");
    await desk.send(eventId, "accept_trade");

    const model = desk.view(eventId);
    expect(model.path.kind).toBe("available-stub-shape");
    expect(model.rows.map((row) => row.status)).toEqual(["confirmed", "confirmed", "confirmed"]);
    expect(model.rows.map((row) => row.receipt?.map((field) => field.key))).toEqual(
      EXPECTED_STEP_REPORT.map((row) => row.resultKeys),
    );
    expect(calls.map((call) => call.action)).toEqual(["create_event", "prepare_trade", "accept_trade"]);
    expect(calls.map((call) => Object.keys(call.body as object).sort())).toEqual(
      EXPECTED_STEP_REPORT.map((row) => row.bodyKeys),
    );
    expect(calls[0]?.actor).toBe("operator");
    expect(calls[1]?.actor).toBe("desk-buyer");
    expect(calls[2]?.actor).toBe("desk-buyer");
    expect(calls[0]?.body).toMatchObject({
      organizer: "desk-organizer",
      seats: ["A1"],
      policy: SHOW_POLICY,
    });
    expect(calls[1]?.body).toMatchObject({ buyer: "desk-buyer", tradeId: `trd_${eventId}` });
    expect(model.rows[0]?.operationId).toBe(`jrn:${eventId}:1:create_event`);
    expect(model.lastConfirmed).toContain("accept_trade");
    expect(model.unconfirmed).toBe("Unconfirmed request: none");
    expect(model.rows.every((row) => row.canSend === false)).toBe(true);
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
    await desk.send("evt_http", "create_event");
    expect(calls).toBe(0);
    expect(desk.view("evt_http").path.kind).toBe("checking");
    await desk.probe();
    expect(desk.view("evt_http").path).toMatchObject({ kind: "unavailable", code: "GATE_UNAVAILABLE" });
    await desk.send("evt_http", "create_event");
    expect(calls).toBe(0);
    expect(desk.view("evt_http").rows.every((row) => row.canSend === false)).toBe(true);
  });

  it("treats a degraded probe as unavailable and sends nothing", async () => {
    let calls = 0;
    const desk = httpDesk(
      integrationHttpObservation({
        state: "degraded",
        code: "NOT_READY",
        requestId: "req-ready",
        correlationId: "corr-ready",
        localFileJournal: null,
        detail: "Loopback gate is degraded (NOT_READY).",
      }),
      async () => {
        calls += 1;
        return {};
      },
    );
    await desk.probe();
    await desk.send("evt_degraded", "create_event");
    expect(desk.view("evt_degraded").path).toMatchObject({ kind: "unavailable", code: "NOT_READY" });
    expect(calls).toBe(0);
  });

  it("shows a timeout as unconfirmed, keeps the last receipt, and blocks the next write", async () => {
    const eventId = "evt_timeout";
    const { desk, calls } = stubDesk(async (input, shape) => {
      if (input.action === "prepare_trade") {
        throw new ProtocolError("The exchange timed out.", "REQUEST_TIMEOUT", {
          requestId: "req-timeout",
          correlationId: "corr-timeout",
        });
      }
      return shape.invokeLocalCall(input);
    });
    await desk.send(eventId, "create_event");
    await desk.send(eventId, "prepare_trade");
    const before = calls.length;
    await desk.send(eventId, "accept_trade");
    await desk.send(eventId, "prepare_trade");
    expect(calls).toHaveLength(before);
    expect(calls.map((call) => call.action)).toEqual(["create_event", "prepare_trade"]);

    const model = desk.view(eventId);
    expect(model.rows.map((row) => row.status)).toEqual(["confirmed", "unconfirmed", "blocked"]);
    expect(model.rows[1]).toMatchObject({
      code: "REQUEST_TIMEOUT",
      requestId: "req-timeout",
      correlationId: "corr-timeout",
    });
    expect(model.rows[1]?.note).toContain("Unconfirmed");
    expect(model.rows[1]?.note).toContain("Not a rejection");
    expect(model.rows[1]?.note).not.toContain("Rejected");
    expect(model.lastConfirmed).toContain("create_event");
    expect(model.unconfirmed).toContain("prepare_trade");
    expect(model.rows.every((row) => row.canSend === false)).toBe(true);
    expect(model.rows[2]?.operationId).toBeNull();
  });

  it("words only a gate rejection as rejected and blocks the next step", async () => {
    const eventId = "evt_reject";
    const { desk, calls } = stubDesk(async () => {
      throw new GateRejectedError("refused", "EVENT_EXISTS", { requestId: "req-r", correlationId: "corr-r" }, 422);
    });
    await desk.send(eventId, "create_event");
    await desk.send(eventId, "prepare_trade");
    expect(calls.map((call) => call.action)).toEqual(["create_event"]);
    const model = desk.view(eventId);
    expect(model.rows[0]?.status).toBe("rejected");
    expect(model.rows[0]?.note).toBe("Rejected by the gate (EVENT_EXISTS).");
    expect(model.rows[1]?.status).toBe("blocked");
    expect(model.rows[2]?.status).toBe("blocked");
    expect(model.unconfirmed).toBe("Unconfirmed request: none");
  });

  it("records an invalid receipt as unconfirmed and does not send the next step", async () => {
    const eventId = "evt_invalid";
    const { desk, calls } = stubDesk(async (input, shape) => {
      const receipt = await shape.invokeLocalCall(input);
      if (!isRecord(receipt) || !isRecord(receipt.result)) {
        throw new Error("shape");
      }
      return { ...receipt, result: { ...receipt.result, extra: true } };
    });
    await desk.send(eventId, "create_event");
    await desk.send(eventId, "prepare_trade");
    expect(calls.map((call) => call.action)).toEqual(["create_event"]);
    expect(desk.view(eventId).rows[0]).toMatchObject({ status: "unconfirmed", code: "INVALID_RECEIPT" });
    expect(desk.view(eventId).rows[0]?.note).toContain("Not a rejection");
  });

  it("records an envelope with an extra key as unconfirmed with the helper gate status", async () => {
    const eventId = "evt_extra";
    const { desk } = stubDesk(async (input, shape) => {
      const receipt = await shape.invokeLocalCall(input);
      return { ...(receipt as Record<string, unknown>), extra: true };
    });
    await desk.send(eventId, "create_event");
    expect(desk.view(eventId).rows[0]).toMatchObject({ status: "unconfirmed", code: "GATE_STATUS" });
  });

  it("marks an over-long operation id as not sent and does not call the invoker", async () => {
    const eventId = "e".repeat(90);
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    await desk.send(eventId, "create_event");
    await desk.send(eventId, "create_event");
    expect(calls).toHaveLength(0);
    expect(desk.view(eventId).rows[0]?.status).toBe("not-sent");
    expect(desk.view(eventId).rows[0]?.note).toContain("Not sent");
    expect(desk.view(eventId).rows[1]?.status).toBe("blocked");
  });

  it("does not send a step out of order", async () => {
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    await desk.send("evt_order", "prepare_trade");
    expect(calls).toHaveLength(0);
    expect(desk.view("evt_order").rows[0]?.status).toBe("ready");
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
    const first = desk.send("evt_flight", "create_event");
    await desk.send("evt_flight", "create_event");
    expect(entered).toBe(1);
    expect(desk.view("evt_flight").rows[0]?.status).toBe("in-flight");
    release();
    await first;
    expect(entered).toBe(1);
    expect(desk.view("evt_flight").rows[0]?.status).toBe("confirmed");
  });

  it("reset clears page-load journeys", () => {
    const { desk } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    desk.retain("evt_reset");
    expect(desk.view("").opened.map((item) => item.eventId)).toContain("evt_reset");
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
    expect(journeyPathStatus("stub", null).kind).toBe("available-stub-shape");
    expect(journeyPathStatus("integration-http", null).kind).toBe("checking");
    expect(journeyPathStatus("integration-http", { ...unavailable, state: "up" }).kind).toBe("available");
    expect(journeyPathStatus("integration-http", unavailable)).toMatchObject({
      kind: "unavailable",
      code: "GATE_UNAVAILABLE",
    });
    expect(journeyPathStatus("stub", unavailable).kind).toBe("available-stub-shape");
  });
});

function stubDesk(
  handle: (input: LocalCallInput, shape: ReturnType<typeof createStubJourneyInvoker>) => Promise<unknown>,
): { desk: JourneyDesk; calls: LocalCallInput[] } {
  const calls: LocalCallInput[] = [];
  const shape = createStubJourneyInvoker();
  const desk = createJourneyDesk({
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

function httpDesk(
  observation: TransportObservation,
  invoke: () => Promise<unknown>,
): JourneyDesk {
  return createJourneyDesk({
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
