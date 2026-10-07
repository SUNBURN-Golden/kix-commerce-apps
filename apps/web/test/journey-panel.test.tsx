import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  composePrimarySeatJourney, createJourneyDemoCaller, echoIntegrationGateHeaders, HttpProtocolAdapter,
  JOURNEY_COMPOSED_ACTIONS, journeyDemoInput, type LocalCallInput,
} from "@kix/protocol-adapter";
import { JourneyPanel, JourneyReceipts } from "../src/pages/JourneyPanel";

describe("catalogue journey surface", () => {
  it.each([
    ["success", null, 7], ["response-loss", "UNKNOWN", 2],
    ["rejected", "REJECTED", 2], ["stale", "STALE_RESPONSE", 2], ["malformed", "INVALID_RECEIPT", 2],
  ] as const)("renders %s without claiming payment or admission", async (scenario, outcome, count) => {
    const { caller, calls } = createJourneyDemoCaller(scenario);
    const result = await composePrimarySeatJourney(caller, journeyDemoInput("show-demo"));
    expect(result.fence?.outcome ?? null).toBe(outcome);
    expect(calls).toHaveLength(count);
    const html = renderToStaticMarkup(<JourneyReceipts result={result} />);
    if (outcome) {
      expect(result.composed.map((step) => step.action)).toEqual(["create_event"]);
      expect(html).toContain("Last confirmed step: create_event");
      expect(html).toContain("later writes blocked");
      expect(html).not.toContain("Synthetic journey complete");
      expect(html).toContain(outcome === "REJECTED" ? "Explicit rejection" : "Outcome unconfirmed");
      if (outcome !== "REJECTED") expect(html).not.toContain("Explicit rejection");
    } else {
      expect(html).toContain("No real funds, ticket or entry");
    }
  });

  it("never offers a simulation runner in browser HTTP mode", () => {
    const html = renderToStaticMarkup(<JourneyPanel eventId="show" environment="integration-http" />);
    expect(html).toContain("Browser HTTP journey unavailable");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("Confirmed in simulation");
  });

  it.each([
    ["capture-loss", "UNKNOWN", "accept_trade", 4],
    ["commit-loss", "UNKNOWN", "capture", 5],
    ["stale-presentation", "REJECTED", "open_admission", 7],
    ["malformed-commit", "INVALID_RECEIPT", "capture", 5],
  ] as const)("renders %s without promoting the last confirmed effect", async (scenario, outcome, last, count) => {
    const { caller, calls } = createJourneyDemoCaller(scenario);
    const result = await composePrimarySeatJourney(caller, journeyDemoInput("show-demo"));
    expect(calls).toHaveLength(count);
    expect(result.fence?.outcome).toBe(outcome);
    const html = renderToStaticMarkup(<JourneyReceipts result={result} />);
    expect(html).toContain(`Last confirmed step: ${last}`);
    expect(html).toContain("later writes blocked");
    expect(html).not.toContain("Synthetic journey complete");
  });

  // The existing success fixture produces each effect; the HTTP adapter then
  // classifies the replaced response exactly as it would from the gate.
  it.each([
    ["capture", 500, "{}", false],
    ["commit_trade", 500, "{}", false],
    ["commit_trade", 500, JSON.stringify({ error: "   ", rejected: true }), false],
    ["commit_trade", 422, JSON.stringify({ error: "TRADE_NOT_COMMITTABLE", rejected: true }), true],
  ] as const)("renders an HTTP %s failure %i %s by its classified outcome", async (action, status, body, explicit) => {
    const { caller: fixture, calls } = createJourneyDemoCaller("success");
    const http = new HttpProtocolAdapter("http://127.0.0.1:8765", async (_url, init) => {
      const call = JSON.parse(String(init?.body)) as LocalCallInput;
      const receipt = await fixture.invokeLocalCall(call);
      return call.action === action
        ? new Response(body, { status, headers: echoIntegrationGateHeaders(init) })
        : new Response(JSON.stringify(receipt), { status: 200, headers: echoIntegrationGateHeaders(init) });
    });
    const input = journeyDemoInput("show-demo");
    const ids = [input.operationIds.createEvent, input.operationIds.prepareTrade, input.operationIds.acceptTrade,
      input.operationIds.capture, input.operationIds.commitTrade, input.operationIds.openAdmission, input.operationIds.admit];
    const index = JOURNEY_COMPOSED_ACTIONS.indexOf(action);
    const result = await composePrimarySeatJourney(http, input);
    expect(calls.map((call) => call.operationId)).toEqual(ids.slice(0, index + 1));
    expect(result.fence).toMatchObject({ action, operationId: ids[index] });
    const html = renderToStaticMarkup(<JourneyReceipts result={result} />);
    expect(html).toContain(`Last confirmed step: ${JOURNEY_COMPOSED_ACTIONS[index - 1]}`);
    expect(html).toContain(ids[index]);
    expect(html).toContain("later writes blocked");
    expect(html).not.toContain("Synthetic journey complete");
    if (explicit) {
      expect(result.fence?.outcome).toBe("REJECTED");
      expect(html).toContain("Explicit rejection");
    } else {
      expect(["UNKNOWN", "INVALID_RECEIPT"]).toContain(result.fence?.outcome);
      expect(html).toContain("Outcome unconfirmed");
      expect(html).not.toContain("Explicit rejection");
    }
  });

  it("starts empty and disables an empty event", () => {
    const html = renderToStaticMarkup(<JourneyPanel eventId="" environment="stub" />);
    expect(html).toContain("No journey has been run");
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("Confirmed in simulation");
  });
});
