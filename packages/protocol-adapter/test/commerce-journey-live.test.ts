import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildProcess } from "node:child_process";
import { HttpProtocolAdapter } from "../src/http-adapter.js";
import { commerceJourneyRead, type CommerceJourneyStep } from "../src/commerce-journey-command.js";
import { assertReviewedCheckout, protocolRoot, REVIEWED_GATE_RUNS, startGate, stopGate } from "./support/reviewed-gate.js";
import { JOURNEY_BRANCHES, type CommerceJourneyBranch } from "../src/commerce-journey.js";
import { exercise, journeyFor } from "./support/commerce-journey.js";

function altered(original: Response, body: unknown): Response {
  const response = Response.json(body, { status: original.status, headers: original.headers });
  Object.defineProperty(response, "url", { value: original.url });
  return response;
}

function mutateAt(root: Record<string, unknown>, path: string, replacement: unknown) {
  const keys = path.split(".");
  const field = keys.pop()!;
  const parent = keys.reduce((node, key) => node[key] as Record<string, unknown>, root);
  expect(parent[field]).not.toBe(replacement);
  parent[field] = replacement;
}

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
    await exercise(branch, new HttpProtocolAdapter(baseUrl, send), "gate");
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

  it.each([
    ["admission", "reserve-B", "show.slots.1.reservation_id", "other-reservation"],
    ["admission", "issue-B", "reservation.right.right_id", "other-right"],
    ["resale", "hold-A", "right.listing_id", "other-listing"],
    ["resale", "accept-A", "listing.transfer_id", "other-transfer"],
    ["resale", "accept-A", "listing.holder_role", "other-buyer"],
    ["resale", "accept-A", "listing.version_after", 3],
    ["admission", "authorize-B", "admission.right_id", "other-right"],
    ["admission", "consume-B", "credential.consume_id", "other-consume"],
    ["admission", "consume-B", "credential.issued_version", 9],
    ["refund", "bind-refund", "settlement.claim.claim_id", "other-claim"],
    ["refund", "bind-refund", "settlement.claim.trade_id", "other-trade"],
  ] satisfies [CommerceJourneyBranch, CommerceJourneyStep, string, unknown][])(
    "fences %s/%s when %s contradicts its receipt",
    async (branch, step, path, replacement) => {
      let modify = false;
      const send = vi.fn<typeof fetch>(async (input, init) => {
        const original = await fetch(input, init);
        if (!modify) return original;
        const body = await original.json();
        mutateAt(body, path, replacement);
        return altered(original, body);
      });
      const journey = journeyFor(branch, new HttpProtocolAdapter(baseUrl, send));
      const steps: CommerceJourneyStep[] = ["reservation-clock", "register-show", ...JOURNEY_BRANCHES[branch]];
      for (const prior of steps.slice(0, steps.indexOf(step))) {
        expect(await journey.run(prior), prior).toMatchObject({ kind: "CONFIRMED" });
      }
      const { confirmed, facts } = journey.state();
      const before = send.mock.calls.length;
      modify = true;
      expect(await journey.run(step)).toMatchObject({
        kind: "UNKNOWN", code: "INVALID_FSM_RECEIPT",
        requestId: expect.any(String), correlationId: expect.any(String),
      });
      expect(journey.state()).toMatchObject({ confirmed, facts, fenced: true, next: step });
      expect(await journey.run(step)).toBeUndefined();
      const next = steps[steps.indexOf(step) + 1];
      if (next) expect(await journey.run(next)).toBeUndefined();
      expect(send).toHaveBeenCalledTimes(before + 1);
    },
  );

  it.each(["COMPENSATION_UNDEFINED", "UNEXPECTED_REFUSAL"])(
    "allows the planned step after a validated refusal only for the declared code (%s)",
    async (code) => {
      const send = vi.fn<typeof fetch>(async (input, init) => {
        const response = await fetch(input, init);
        if (JSON.parse(String(init?.body)).action !== "reservation_cancel") return response;
        const receipt = await response.json();
        expect(receipt).toMatchObject({ rejected: true, error: "COMPENSATION_UNDEFINED" });
        return altered(response, { ...receipt, error: code });
      });
      const journey = journeyFor("admission", new HttpProtocolAdapter(baseUrl, send));
      for (const step of ["reservation-clock", "register-show", "reserve-B", "order-B", "payment-B"] as const) {
        expect(await journey.run(step)).toMatchObject({ kind: "CONFIRMED" });
      }
      const { confirmed, facts } = journey.state();
      const before = send.mock.calls.length;
      expect(await journey.run("cancel-after-payment")).toMatchObject({
        kind: "REJECTED", code, requestId: expect.any(String), correlationId: expect.any(String),
      });
      const allowed = code === "COMPENSATION_UNDEFINED";
      expect(journey.state()).toMatchObject({ confirmed, facts, fenced: !allowed, next: "issue-B", decline: undefined });
      expect(await journey.run("cancel-after-payment")).toBeUndefined();
      const issue = await journey.run("issue-B");
      if (allowed) expect(issue).toMatchObject({ kind: "CONFIRMED" });
      else expect(issue).toBeUndefined();
      expect(send).toHaveBeenCalledTimes(before + (allowed ? 2 : 1));
    },
  );
});
