import { describe, expect, it } from "vitest";
import {
  BookingJourney,
  COMMERCE_COMMAND_BINDINGS,
  HttpProtocolAdapter,
  JOURNEY_COMPOSED,
  JOURNEY_NOT_COMPOSED,
  StubProtocolAdapter,
  createProtocol,
} from "../src/index.js";
import type { LocalCallInput } from "../src/local-call.js";
import {
  EXPECTED_STEP_REPORT,
  SHOW_POLICY,
  journeyStepReport,
  runComposedJourney,
  stubJourneyInvoker,
} from "./support/journey-fixture.js";

const NOT_COMPOSED = ["capture", "settle_capture", "commit_trade", "open_admission", "admit"] as const;

describe("booking journey stub parity", () => {
  it("reports the composed step sequence from a shape-only invoker", async () => {
    const seen: LocalCallInput[] = [];
    const journey = new BookingJourney(stubJourneyInvoker(seen));
    const outcomes = await runComposedJourney(journey, {
      eventId: "show-1",
      tradeId: "trade-1",
      createOperationId: "op-create",
      prepareOperationId: "op-prepare",
      acceptOperationId: "op-accept",
    });
    expect(journeyStepReport(seen, outcomes)).toEqual(EXPECTED_STEP_REPORT);
    expect(seen.map((call) => call.action)).toEqual([...JOURNEY_COMPOSED]);
    expect(journey.state().completedThrough).toBe("accept_trade");
    expect(journey.state().halted).toBeNull();
    expect(seen.some((call) => (NOT_COMPOSED as readonly string[]).includes(call.action))).toBe(false);
  });

  it("keeps the not-composed actions and the placeHold binding", () => {
    expect(JOURNEY_NOT_COMPOSED.map((entry) => entry.action)).toEqual([...NOT_COMPOSED]);
    expect(COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction).toBe("reserve_listing");
    expect(COMMERCE_COMMAND_BINDINGS.placeHold.status).toBe("not-bound");
  });

  it("ships a stub with no invokeLocalCall", () => {
    const stub = createProtocol();
    expect(stub).toBeInstanceOf(StubProtocolAdapter);
    expect("invokeLocalCall" in stub).toBe(false);
  });

  it("stays unknown on a closed port and does not call the stub invoker", async () => {
    const seen: LocalCallInput[] = [];
    const stub = stubJourneyInvoker(seen);
    const http = new HttpProtocolAdapter("http://127.0.0.1:1");
    const journey = new BookingJourney(http);
    const outcome = await journey.createEvent({
      operationId: "op-create",
      eventId: "show-1",
      organizer: "organizer",
      policy: SHOW_POLICY,
      seats: ["A1"],
    });
    expect(outcome).toMatchObject({ kind: "UNKNOWN", code: "GATE_UNAVAILABLE" });
    expect(seen).toEqual([]);
    expect("invokeLocalCall" in stub).toBe(true);
    expect(journey.state().halted?.kind).toBe("UNKNOWN");
    const fenced = await journey.prepareTrade({
      operationId: "op-prepare",
      tradeId: "trade-1",
      buyer: "buyer-a",
    });
    expect(fenced.kind).toBe("FENCED");
    expect(seen).toEqual([]);
  });
});
