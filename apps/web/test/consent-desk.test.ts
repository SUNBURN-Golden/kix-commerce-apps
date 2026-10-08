import { describe, expect, it } from "vitest";
import {
  CONSENT_AUTHORIZE_ACTOR,
  GateRejectedError,
  ProtocolError,
  createStubConsentInvoker,
  integrationHttpObservation,
  localStubObservation,
  type LocalCallInput,
  type TransportObservation,
} from "@kix/protocol-adapter";
import { consentPathStatus, createConsentDesk, type ConsentDesk, type ConsentDraft } from "../src/consent-desk";

const DRAFT: ConsentDraft = {
  subject: "subject-a",
  business: "desk-business",
  channel: "desk-channel",
  purpose: "desk-purpose",
  expectedConsentVersion: "0",
  allowed: "true",
};

describe("consent desk", () => {
  it("confirms set_consent and authorize_marketing on the stub-shape invoker", async () => {
    const eventId = "show_lanterns";
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    await desk.probe();
    await desk.send(eventId, "set_consent", DRAFT);
    await desk.send(eventId, "authorize_marketing", DRAFT);
    const model = desk.viewWith(eventId, DRAFT);
    expect(model.path.kind).toBe("available-stub-shape");
    expect(model.rows.map((row) => row.status)).toEqual(["confirmed", "confirmed"]);
    expect(model.rows[0]?.canSend).toBe(true);
    expect(model.rows[1]?.canSend).toBe(false);
    expect(calls.map((call) => call.action)).toEqual(["set_consent", "authorize_marketing"]);
    expect(calls[0]?.actor).toBe("subject-a");
    expect(calls[1]?.actor).toBe(CONSENT_AUTHORIZE_ACTOR);
    expect(calls[0]?.body).toMatchObject({
      eventId,
      allowed: true,
      business: "desk-business",
      channel: "desk-channel",
      purpose: "desk-purpose",
      expectedConsentVersion: 0,
    });
    expect(calls[0]?.body).not.toHaveProperty("subject");
    expect(model.rows[0]?.operationId).toBe(`cns:${eventId}:1:set_consent`);
    expect(model.rows[1]?.operationId).toBe(`cns:${eventId}:1:authorize_marketing`);
    expect(model.lastConfirmed).toContain("authorize_marketing");
    expect(model.unconfirmed).toBe("Unconfirmed request: none");
    expect(model.rows[1]?.receipt?.find((field) => field.key === "networkSendPerformed")?.value).toBe("false");
    expect(model.rows[1]?.note).toContain("Not from the gate");
  });

  it("fences authorize_marketing before set_consent and sends nothing", async () => {
    const eventId = "show_order";
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    await desk.send(eventId, "authorize_marketing", DRAFT);
    expect(calls).toHaveLength(0);
    const model = desk.viewWith(eventId, DRAFT);
    expect(model.rows[0]?.status).toBe("ready");
    expect(model.rows[1]?.note).toContain("out-of-order");
    expect(model.rows[1]?.canSend).toBe(true);
  });

  it("marks a blank field as not sent and blocks the next row", async () => {
    const eventId = "show_blank";
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    await desk.send(eventId, "set_consent", { ...DRAFT, business: "" });
    await desk.send(eventId, "authorize_marketing", DRAFT);
    expect(calls).toHaveLength(0);
    const model = desk.viewWith(eventId, DRAFT);
    expect(model.rows[0]?.status).toBe("not-sent");
    expect(model.rows[0]?.note).toContain("Not sent");
    expect(model.rows[1]?.status).toBe("blocked");
    expect(model.rows.every((row) => row.canSend === false)).toBe(true);
  });

  it("words only a gate rejection as rejected and blocks the next row", async () => {
    const eventId = "show_reject";
    const { desk, calls } = stubDesk(async () => {
      throw new GateRejectedError("refused", "STALE_CONSENT_VERSION", { requestId: "req-r", correlationId: "corr-r" }, 422);
    });
    await desk.send(eventId, "set_consent", DRAFT);
    await desk.send(eventId, "authorize_marketing", DRAFT);
    expect(calls).toHaveLength(1);
    const model = desk.viewWith(eventId, DRAFT);
    expect(model.rows[0]?.status).toBe("rejected");
    expect(model.rows[0]?.note).toBe("Rejected by the gate (STALE_CONSENT_VERSION).");
    expect(model.rows[1]?.status).toBe("blocked");
  });

  it("shows a timeout as unconfirmed and blocks authorize", async () => {
    const eventId = "show_timeout";
    const { desk, calls } = stubDesk(async () => {
      throw new ProtocolError("The exchange timed out.", "REQUEST_TIMEOUT", {
        requestId: "req-timeout",
        correlationId: "corr-timeout",
      });
    });
    await desk.send(eventId, "set_consent", DRAFT);
    await desk.send(eventId, "authorize_marketing", DRAFT);
    expect(calls.map((call) => call.action)).toEqual(["set_consent"]);
    const model = desk.viewWith(eventId, DRAFT);
    expect(model.rows.map((row) => row.status)).toEqual(["unconfirmed", "blocked"]);
    expect(model.rows[0]?.note).toContain("Unconfirmed");
    expect(model.rows[0]?.note).toContain("Not a rejection");
    expect(model.unconfirmed).toContain("set_consent");
    expect(model.lastConfirmed).toBe("Last confirmed receipt: none");
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
    await desk.send("show_http", "set_consent", DRAFT);
    expect(calls).toBe(0);
    expect(desk.viewWith("show_http", DRAFT).path.kind).toBe("checking");
    await desk.probe();
    expect(desk.viewWith("show_http", DRAFT).path).toMatchObject({ kind: "unavailable", code: "GATE_UNAVAILABLE" });
    await desk.send("show_http", "set_consent", DRAFT);
    expect(calls).toBe(0);
    expect(desk.viewWith("show_http", DRAFT).rows.every((row) => row.canSend === false)).toBe(true);
  });

  it("sends a further set_consent on a new attempt id", async () => {
    const eventId = "show_withdraw";
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    await desk.send(eventId, "set_consent", DRAFT);
    await desk.send(eventId, "authorize_marketing", DRAFT);
    await desk.send(eventId, "set_consent", { ...DRAFT, allowed: "false", expectedConsentVersion: "1" });
    expect(calls.map((call) => call.action)).toEqual(["set_consent", "authorize_marketing", "set_consent"]);
    expect(calls[2]?.operationId).toBe(`cns:${eventId}:2:set_consent`);
    expect(calls[2]?.body).toMatchObject({ allowed: false, expectedConsentVersion: 1 });
    expect(desk.viewWith(eventId, DRAFT).rows[0]?.status).toBe("confirmed");
    expect(desk.viewWith(eventId, DRAFT).rows[1]?.status).toBe("ready");
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
    const first = desk.send("show_flight", "set_consent", DRAFT);
    await desk.send("show_flight", "set_consent", DRAFT);
    expect(entered).toBe(1);
    expect(desk.viewWith("show_flight", DRAFT).rows[0]?.status).toBe("in-flight");
    release();
    await first;
    expect(entered).toBe(1);
    expect(desk.viewWith("show_flight", DRAFT).rows[0]?.status).toBe("confirmed");
  });

  it("asks for an event id before it sends", async () => {
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    await desk.send("", "set_consent", DRAFT);
    expect(calls).toHaveLength(0);
    expect(desk.viewWith("", DRAFT).rows[0]?.note).toContain("Enter an event id");
  });

  it("reset clears page-load events", () => {
    const { desk } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    desk.retain("show_reset");
    expect(desk.viewWith("", DRAFT).opened.map((item) => item.eventId)).toContain("show_reset");
    desk.reset();
    expect(desk.viewWith("", DRAFT).opened).toEqual([]);
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
    expect(consentPathStatus("stub", null).kind).toBe("available-stub-shape");
    expect(consentPathStatus("integration-http", null).kind).toBe("checking");
    expect(consentPathStatus("integration-http", { ...unavailable, state: "up" }).kind).toBe("available");
    expect(consentPathStatus("integration-http", unavailable)).toMatchObject({
      kind: "unavailable",
      code: "GATE_UNAVAILABLE",
    });
    expect(consentPathStatus("stub", unavailable).kind).toBe("available-stub-shape");
  });
});

function stubDesk(
  handle: (input: LocalCallInput, shape: ReturnType<typeof createStubConsentInvoker>) => Promise<unknown>,
): { desk: ConsentDesk; calls: LocalCallInput[] } {
  const calls: LocalCallInput[] = [];
  const shape = createStubConsentInvoker();
  const desk = createConsentDesk({
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

function httpDesk(observation: TransportObservation, invoke: () => Promise<unknown>): ConsentDesk {
  return createConsentDesk({
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
