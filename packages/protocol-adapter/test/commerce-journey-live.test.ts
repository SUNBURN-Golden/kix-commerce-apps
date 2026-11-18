import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildProcess } from "node:child_process";
import { HttpProtocolAdapter } from "../src/http-adapter.js";
import { commerceJourneyRead } from "../src/commerce-journey-command.js";
import { assertReviewedCheckout, protocolRoot, REVIEWED_GATE_RUNS, startGate, stopGate } from "./support/reviewed-gate.js";
import { exercise, journeyFor } from "./support/commerce-journey.js";

describe.skipIf(!REVIEWED_GATE_RUNS)("commerce journey at the pinned loopback gate", () => {
  let baseUrl: string;
  let child: ChildProcess;
  beforeEach(async () => {
    const root = protocolRoot();
    assertReviewedCheckout(root);
    ({ baseUrl, child } = await startGate(root));
  });
  afterEach(async () => { await stopGate(child); });

  it.each(["admission", "resale", "refund"] as const)("runs the %s branch with one SDK envelope per click", async (branch) => {
    const send = vi.fn(fetch);
    await exercise(branch, new HttpProtocolAdapter(baseUrl, send));
    const operations = new Set<string>();
    const keys = new Set<string>();
    for (const [url, init] of send.mock.calls) {
      expect(url).toBe(`${baseUrl}/x-kix-contract-only/local-call`);
      expect(init?.redirect).toBe("manual");
      expect(new Headers(init?.headers).has("Idempotency-Key")).toBe(false);
      const call = JSON.parse(String(init?.body));
      expect(call.action).toMatch(/^(reservation|resale|admission|settlement)_/);
      expect(call.body.domain).toBeUndefined();
      expect(call.body.idempotency_key).not.toBe(call.operationId);
      operations.add(call.operationId);
      keys.add(call.body.idempotency_key);
    }
    expect(operations.size).toBe(send.mock.calls.length);
    expect(keys.size).toBe(send.mock.calls.length);
  });

  it.each(["response lost", "invalid receipt", "timeout", "duplicate receipt"] as const)(
    "retains the previous fact and fences a %s after exactly one request",
    async (scenario) => {
      let disturb = false;
      const send = vi.fn<typeof fetch>(async (input, init) => {
        if (disturb && scenario === "timeout") return new Promise(() => {});
        const response = await fetch(input, init);
        if (!disturb) return response;
        if (scenario === "response lost") throw new Error("response lost after applying");
        const body = await response.json();
        if (scenario === "duplicate receipt") {
          body.duplicate = true;
          body.applied = null;
        } else body.admission_routing_production = true;
        return new Proxy(new Response(JSON.stringify(body), { status: response.status, headers: response.headers }), {
          get(target, name, receiver) {
            return name === "url" ? response.url : name === "body" || name === "headers" || name === "ok" || name === "status" || name === "redirected" || name === "type"
              ? Reflect.get(target, name, target) : Reflect.get(target, name, receiver);
          },
        });
      });
      const adapter = new HttpProtocolAdapter(baseUrl, send, { timeoutMs: 250 });
      const journey = journeyFor("admission", adapter);
      expect(await journey.run("reservation-clock")).toMatchObject({ kind: "CONFIRMED" });
      expect(await journey.run("register-show")).toMatchObject({ kind: "CONFIRMED" });
      expect(await journey.run("reserve-B")).toMatchObject({ kind: "CONFIRMED" });
      expect(await journey.run("order-B")).toMatchObject({ kind: "CONFIRMED" });
      expect(await journey.run("payment-B")).toMatchObject({ kind: "CONFIRMED" });
      const before = send.mock.calls.length;
      expect(commerceJourneyRead("get_booking")).toMatchObject({ kind: "NOT_BOUND" });
      expect(send).toHaveBeenCalledTimes(before);
      disturb = true;
      expect(await journey.run("issue-B")).toMatchObject({ kind: "UNKNOWN", code: scenario === "timeout" ? "REQUEST_TIMEOUT" :
        scenario === "response lost" ? "GATE_UNAVAILABLE" : "INVALID_FSM_RECEIPT" });
      expect(journey.state()).toMatchObject({ confirmed: "payment-B", fenced: true, facts: {
        paymentObservation: { state: "OBSERVED" }, ticketIssuance: { state: "NO_EVIDENCE" }, admission: { state: "NO_EVIDENCE" },
      } });
      expect(await journey.run("issue-B")).toBeUndefined();
      expect(await journey.run("admission-clock")).toBeUndefined();
      expect(send).toHaveBeenCalledTimes(before + 1);
    },
  );
});
