import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { StubProtocolAdapter } from "../src/stub-adapter.js";
import { ResaleCaseStore } from "../src/resale-case.js";
import { MARKET_FIXTURE } from "../src/resale-journey-fixture.js";
import { SETTLEMENT_EXAMPLE } from "../src/resale-journey.js";
import { fixtureJourney, resaleScenarios, through } from "./support/resale-journey.js";

const read = (file: string) => readFileSync(new URL("../vendor/commerce-journey/" + file, import.meta.url), "utf8");
describe("resale fixture at the default adapter", () => {
  resaleScenarios(() => new StubProtocolAdapter());
  it("matches the session, expanded offer and selected requests to pinned catalogue fields", () => {
    const dir = "reference/booking_resale_admission/fixtures/";
    const session = JSON.parse(read(dir + "resale_session.json"));
    const catalogue = JSON.parse(read("docs/contracts/openapi/fsm-command-contract.json")).commands;
    const requests = read(dir + "resale_requests.jsonl").trim().split("\n").map(line => JSON.parse(line));
    for (const [action, body] of Object.values(MARKET_FIXTURE)) {
      const spec = catalogue[action];
      const setup = session.setup.find((s: { machine: string; operation: string }) => s.machine + "_" + s.operation === action);
      let expected: Record<string, unknown>;
      if (setup) expected = { ...setup.body, [spec.subject_field]: setup.subject_id };
      else if (action === "resale_cancel_listing") {
        expect(read(dir + "resale_console_cancel.txt")).toContain("cancel_listing\nlist-1\nbuyer-1\n");
        expected = { listing_id: "list-1", seller_role: "buyer-1" };
      } else {
        expected = { ...requests.find(r => "resale_" + r.operation === action).arguments };
        if (expected.offer_id) Object.assign(expected, JSON.parse(session.offers.find((o: { offer_id: string }) => o.offer_id === expected.offer_id).recorded_text));
        delete expected.offer_id;
        delete expected.idempotency_key;
      }
      expect(body, action).toEqual(expected);
      const keys = Object.keys({ ...body, idempotency_key: "fixture" });
      expect(keys).toEqual(expect.arrayContaining(spec.schema.required));
      expect(keys.every(key => Object.hasOwn(spec.schema.properties, key))).toBe(true);
    }
    const vector = JSON.parse(read("reference/read_model/vectors/settlement.json")).queries.get_settlement.vectors[0].expected.ok.body;
    expect({ ...vector, refund_bearer_policy: vector.claim.refund_bearer_policy }).toMatchObject(SETTLEMENT_EXAMPLE);
  });
  it("keeps paid evidence and fences acceptance after a lost stub response", async () => {
    const port = new StubProtocolAdapter();
    const send = vi.spyOn(port, "advanceCommerceJourney");
    const journey = fixtureJourney(port);
    await through(journey, "market-pay");
    send.mockImplementationOnce(async call => { await StubProtocolAdapter.prototype.advanceCommerceJourney.call(port, call); throw new Error("lost"); });
    const before = journey.state().facts;
    const attempt = journey.run("market-accept");
    expect(await journey.run("market-accept")).toBeUndefined();
    expect(await attempt).toMatchObject({ kind: "UNKNOWN" });
    expect(await journey.run("market-accept")).toBeUndefined();
    expect(journey.state()).toMatchObject({ facts: before, confirmed: "market-pay", fenced: true });
    expect(send).toHaveBeenCalledTimes(12);
  });
  it.each(["holder", "version"])("keeps the last confirmed facts when the listing and right disagree on the %s", async field => {
    const journey = fixtureJourney(new StubProtocolAdapter());
    await through(journey, "market-pay");
    const before = journey.state().facts;
    const accept = ResaleCaseStore.prototype.acceptTransfer;
    const receipt = vi.spyOn(ResaleCaseStore.prototype, "acceptTransfer").mockImplementationOnce(function (this: ResaleCaseStore, input) {
      const result = accept.call(this, input);
      if (field === "holder") result.listing!.holderRole = result.listing!.sellerRole;
      else result.listing!.currentVersion = 1;
      return result;
    });
    try {
      expect(await journey.run("market-accept")).toMatchObject({ kind: "UNKNOWN" });
      expect(journey.state()).toMatchObject({ facts: before, confirmed: "market-pay", fenced: true });
      expect(await journey.run("market-accept")).toBeUndefined();
      expect(receipt).toHaveBeenCalledTimes(1);
    } finally { receipt.mockRestore(); }
  });
});
