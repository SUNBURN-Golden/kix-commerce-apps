import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BookingJourney,
  HttpProtocolAdapter,
  StubProtocolAdapter,
  createProtocol,
  createStubJourneyInvoker,
  journeyInvokerFor,
  type CommerceProtocol,
} from "../src/index.js";
import type { LocalCallInput } from "../src/local-call.js";
import { EXPECTED_STEP_REPORT, journeyStepReport, runComposedJourney } from "./support/journey-fixture.js";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("journey invoker selection", () => {
  it("uses a shape-only invoker for the stub and leaves the stub without invokeLocalCall", async () => {
    const stub = createProtocol();
    expect(stub).toBeInstanceOf(StubProtocolAdapter);
    const selected = journeyInvokerFor(stub);
    expect(selected?.source).toBe("stub-shape");
    expect(selected?.invoker).not.toBe(stub);
    expect("invokeLocalCall" in stub).toBe(false);

    const seen: LocalCallInput[] = [];
    const journey = new BookingJourney({
      async invokeLocalCall(input) {
        seen.push(structuredClone(input));
        if (!selected) {
          throw new Error("missing invoker");
        }
        return selected.invoker.invokeLocalCall(input);
      },
    });
    const outcomes = await runComposedJourney(journey, {
      eventId: "show-1",
      tradeId: "trade-1",
      createOperationId: "op-create",
      prepareOperationId: "op-prepare",
      acceptOperationId: "op-accept",
    });
    expect(journeyStepReport(seen, outcomes)).toEqual(EXPECTED_STEP_REPORT);
    expect(seen.map((call) => call.action)).toEqual(["create_event", "prepare_trade", "accept_trade"]);
  });

  it("returns the http adapter itself for integration-gate", () => {
    const http = new HttpProtocolAdapter("http://127.0.0.1:9", async () => {
      throw new Error("unused");
    });
    const selected = journeyInvokerFor(http);
    expect(selected).toEqual({ source: "integration-gate", invoker: http });
    expect(http).toBeInstanceOf(HttpProtocolAdapter);
  });

  it("returns null for an unknown protocol", () => {
    expect(journeyInvokerFor({} as CommerceProtocol)).toBeNull();
  });

  it("counts sequence and throws for an action outside the three", async () => {
    const invoker = createStubJourneyInvoker();
    const first = await invoker.invokeLocalCall({
      operationId: "op-accept-1",
      actor: "buyer",
      action: "accept_trade",
      body: { tradeId: "t", termsHash: "h" },
    });
    const second = await invoker.invokeLocalCall({
      operationId: "op-accept-2",
      actor: "buyer",
      action: "accept_trade",
      body: { tradeId: "t", termsHash: "h" },
    });
    expect(first).toMatchObject({ sequence: 1, action: "accept_trade" });
    expect(second).toMatchObject({ sequence: 2, action: "accept_trade" });
    await expect(
      invoker.invokeLocalCall({
        operationId: "op-other",
        actor: "operator",
        action: "commit_trade",
        body: {},
      }),
    ).rejects.toThrow(/commit_trade/);
  });

  it("does not construct the other adapter", () => {
    const source = readFileSync(path.join(here, "../src/journey-invoker.ts"), "utf8");
    expect(source).not.toContain("new StubProtocolAdapter");
    expect(source).not.toContain("new HttpProtocolAdapter");
    expect(source).not.toContain("fallback");
  });
});
