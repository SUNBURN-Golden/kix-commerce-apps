import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PARTIAL_REFUND_EXAMPLE } from "../src/resale-journey.js";
import type { ChildProcess } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpProtocolAdapter } from "../src/http-adapter.js";
import { assertReviewedCheckout, protocolRoot, REVIEWED_GATE_RUNS, startGate, stopGate } from "./support/reviewed-gate.js";
import { fixtureJourney, orderedActions, resaleScenarios, through } from "./support/resale-journey.js";

describe.skipIf(!REVIEWED_GATE_RUNS)("resale market against the reviewed loopback gate", () => {
  let base: string, child: ChildProcess;
  let send = vi.fn(fetch);
  beforeEach(async () => {
    const root = protocolRoot();
    assertReviewedCheckout(root);
    ({ baseUrl: base, child } = await startGate(root));
    send = vi.fn(fetch);
  });
  afterEach(async () => { await stopGate(child); });
  resaleScenarios(() => new HttpProtocolAdapter(base, send), () => send.mock.calls.length);
  it("attributes the requester-borne partial refund to the separate producer example", () => {
    const doc = readFileSync(join(protocolRoot(), "reference/booking_resale_admission/README.md"), "utf8");
    const section = doc.split(`Explicit action on \`${PARTIAL_REFUND_EXAMPLE.claim_id}\``)[1]?.split("The final current display")[0];
    expect(section).toContain(`amount ${PARTIAL_REFUND_EXAMPLE.refund_face}, beneficiary`);
    expect(section).toContain(`bearer policy \`${PARTIAL_REFUND_EXAMPLE.refund_bearer_policy}\`; distribution not blocked (B5)`);
    expect(send).not.toHaveBeenCalled();
  });
  it.each(["lost", "timeout", "duplicate", "malformed", "holder", "version", "attached", "trace"] as const)("fences a %s acceptance after one actual send", async fault => {
    let corrupt = false;
    const journey = fixtureJourney(new HttpProtocolAdapter(base, async (url, init) => {
      const response = await send(url, init);
      if (!corrupt) return response;
      if (fault === "lost") throw new Error("lost after apply");
      if (fault === "timeout") return new Promise(() => {});
      const body = await response.json();
      const headers = new Headers(response.headers);
      if (fault === "duplicate") body.duplicate = true;
      if (fault === "malformed") body.evidence.payment_ref = "unrelated";
      if (fault === "holder") body.listing.holder_role = body.listing.seller_role;
      if (fault === "version") body.listing.current_version = 1;
      if (fault === "attached") body.right.listing_id = body.listing.listing_id;
      if (fault === "trace") headers.set("X-Request-Id", "another");
      return Object.defineProperty(new Response(JSON.stringify(body), { headers }), "url", { value: response.url });
    }, { timeoutMs: 250 }));
    await through(journey, "market-pay");
    const before = journey.state().facts;
    corrupt = true;
    expect(await journey.run("market-accept")).toMatchObject({ kind: "UNKNOWN", code: { lost: "GATE_UNAVAILABLE", timeout: "REQUEST_TIMEOUT",
      duplicate: "INVALID_FSM_RECEIPT", malformed: "INVALID_FSM_RECEIPT", holder: "INVALID_FSM_RECEIPT",
      version: "INVALID_FSM_RECEIPT", attached: "INVALID_FSM_RECEIPT", trace: "STALE_RESPONSE" }[fault] });
    expect(journey.state()).toMatchObject({ facts: before, confirmed: "market-pay", fenced: true });
    expect(await journey.run("market-accept")).toBeUndefined();
    expect(send.mock.calls.map(([url, init]) => {
      expect(url).toBe(base + "/x-kix-contract-only/local-call");
      expect(init?.redirect).toBe("manual");
      expect(new Headers(init?.headers).has("Idempotency-Key")).toBe(false);
      return JSON.parse(String(init?.body)).action;
    })).toEqual(orderedActions);
  });
});
