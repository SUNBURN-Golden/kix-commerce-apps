import { afterEach, describe, expect, it } from "vitest";
import { ProtocolError, createStubJourneyInvoker, localStubObservation, type LocalCallInput } from "@kix/protocol-adapter";
import { readDeskAttempt } from "../src/desk-attempts";
import { createJourneyDesk, type JourneyDesk } from "../src/journey-desk";

const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");

function installStorage(storage: Partial<Storage>): void {
  Object.defineProperty(globalThis, "sessionStorage", { value: storage, configurable: true });
}

afterEach(() => {
  if (original) {
    Object.defineProperty(globalThis, "sessionStorage", original);
  } else {
    delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
  }
});

function lossyDesk(calls: LocalCallInput[], lose: (action: string) => boolean): JourneyDesk {
  const shape = createStubJourneyInvoker();
  return createJourneyDesk({
    protocol: { describe: () => ({ environment: "stub" }), observeTransport: async () => localStubObservation() },
    source: {
      source: "stub-shape",
      invoker: {
        async invokeLocalCall(input) {
          calls.push(structuredClone(input));
          const receipt = await shape.invokeLocalCall(input);
          if (lose(input.action)) {
            throw new ProtocolError("injected: answer lost after the effect", "GATE_UNAVAILABLE", {
              requestId: "req-injected",
              correlationId: "corr-injected",
            });
          }
          return receipt;
        },
      },
    },
  });
}

describe("fault injection on the journey desk (FI-W01 to FI-W03)", () => {
  it("FI-W01: after a lost answer no row can send and none reads confirmed", async () => {
    installStorage({ getItem: () => null, setItem: () => undefined });
    const calls: LocalCallInput[] = [];
    const desk = lossyDesk(calls, (action) => action === "create_event");
    await desk.probe();
    await desk.send("evt_fi_w01", "create_event");
    // A duplicate click and the later steps all land on the fence.
    await desk.send("evt_fi_w01", "create_event");
    await desk.send("evt_fi_w01", "prepare_trade");
    await desk.send("evt_fi_w01", "accept_trade");
    const model = desk.view("evt_fi_w01");
    expect(calls.map((call) => call.action)).toEqual(["create_event"]);
    expect(model.rows.every((row) => row.canSend === false)).toBe(true);
    expect(model.rows.some((row) => row.status === "confirmed")).toBe(false);
    expect(model.rows[0]?.status).toBe("unconfirmed");
    expect(new Set(calls.map((call) => call.operationId)).size).toBe(calls.length);
  });

  it("FI-W02 (LIMIT): a second desk, standing in for a reload, starts a new attempt and is not fenced", async () => {
    const stored = new Map<string, string>();
    installStorage({ getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => void stored.set(key, value) });
    const calls: LocalCallInput[] = [];
    const first = lossyDesk(calls, (action) => action === "create_event");
    await first.send("evt_fi_w02", "create_event");
    const second = lossyDesk(calls, () => false);
    await second.send("evt_fi_w02", "create_event");
    // The fence is page-load only. This is recorded as a limit, not extended here.
    expect(calls).toHaveLength(2);
    expect(calls[0]?.operationId).not.toBe(calls[1]?.operationId);
    expect(first.view("evt_fi_w02").rows.every((row) => row.canSend === false)).toBe(true);
  });

  it("FI-W03: corrupt attempt counters are ignored and never lower the attempt", () => {
    for (const raw of ["abc", "-1", "1.5", "", "NaN", "1e3x"]) {
      installStorage({ getItem: () => raw, setItem: () => undefined });
      expect(readDeskAttempt("journey", `evt_corrupt_${raw}`)).toBe(0);
    }
    installStorage({ getItem: () => "4", setItem: () => undefined });
    expect(readDeskAttempt("journey", "evt_valid")).toBe(4);
  });
});
