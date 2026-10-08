import { type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CONSENT_AUTHORIZE_ACTOR,
  CONTRACT_ONLY_LOCAL_CALL_METHOD,
  CONTRACT_ONLY_LOCAL_CALL_PATH,
  ConsentBind,
  HttpProtocolAdapter,
  PINNED_PROTOCOL_DOMAIN,
  type ConsentAuthorizeInput,
  type ConsentSetInput,
} from "../src/index.js";
import type { LocalCallInput } from "../src/local-call.js";
import { SHOW_POLICY } from "./support/journey-fixture.js";
import { assertReviewedCheckout, protocolRoot, REVIEWED_GATE_RUNS, startGate, stopGate } from "./support/reviewed-gate.js";

const describeGate = REVIEWED_GATE_RUNS ? describe.sequential : describe.skip;

function freshId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function watchLocalCalls(baseUrl: string, seen: LocalCallInput[]): HttpProtocolAdapter {
  return new HttpProtocolAdapter(baseUrl, async (input, init) => {
    const headers = new Headers(init?.headers);
    expect(headers.has("Idempotency-Key")).toBe(false);
    expect(init?.method).toBe(CONTRACT_ONLY_LOCAL_CALL_METHOD);
    const url = new URL(String(input));
    expect(url.protocol).toBe("http:");
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.pathname).toBe(CONTRACT_ONLY_LOCAL_CALL_PATH);
    if (typeof init?.body !== "string") {
      throw new Error("local-call body was not a string");
    }
    seen.push(JSON.parse(init.body) as LocalCallInput);
    return fetch(input, init);
  });
}

/**
 * Test-side setup only. ConsentBind does not send create_event.
 * The reviewed gate rejects set_consent when the event is missing.
 */
async function createShow(http: HttpProtocolAdapter): Promise<string> {
  const eventId = freshId("show");
  await http.invokeLocalCall({
    operationId: freshId("op-create"),
    actor: "operator",
    action: "create_event",
    body: {
      domain: PINNED_PROTOCOL_DOMAIN,
      eventId,
      organizer: "organizer",
      policy: SHOW_POLICY,
      seats: ["A1"],
    },
  });
  return eventId;
}

function setInput(eventId: string, subject: string): ConsentSetInput {
  return {
    operationId: freshId("op-set"),
    subject,
    allowed: true,
    business: "KIX",
    channel: "email",
    eventId,
    expectedConsentVersion: 0,
    purpose: "next_event_marketing",
  };
}

function authorizeInput(eventId: string, subject: string, expectedConsentVersion: number): ConsentAuthorizeInput {
  return {
    operationId: freshId("op-auth"),
    business: "KIX",
    channel: "email",
    eventId,
    expectedConsentVersion,
    purpose: "next_event_marketing",
    subject,
  };
}

describeGate("consent bind live gate", () => {
  let baseUrl = "";
  let child: ChildProcess | undefined;

  beforeAll(async () => {
    const root = protocolRoot();
    assertReviewedCheckout(root);
    const started = await startGate(root);
    baseUrl = started.baseUrl;
    child = started.child;
  }, 20000);

  afterAll(async () => {
    await stopGate(child);
  });

  it("sets consent, authorizes, and withdraws without capture or settle_capture", async () => {
    const seen: LocalCallInput[] = [];
    const http = watchLocalCalls(baseUrl, seen);
    const eventId = await createShow(http);
    const subject = freshId("subject");
    const bind = new ConsentBind(http);
    const set = await bind.setConsent(setInput(eventId, subject));
    expect(set).toMatchObject({ kind: "RECEIPT", step: "set_consent" });
    if (set.kind !== "RECEIPT" || !isRecord(set.receipt.result)) {
      throw new Error("set_consent did not return a receipt");
    }
    expect(Object.keys(set.receipt.result).sort()).toEqual(["allowed", "consentVersion"]);
    expect(set.receipt.result.allowed).toBe(true);
    const version = set.receipt.result.consentVersion;
    expect(typeof version).toBe("number");
    expect(Number.isInteger(version)).toBe(true);
    const authorized = await bind.authorizeMarketing(authorizeInput(eventId, subject, version as number));
    expect(authorized).toMatchObject({ kind: "RECEIPT", step: "authorize_marketing" });
    if (authorized.kind !== "RECEIPT" || !isRecord(authorized.receipt.result)) {
      throw new Error("authorize_marketing did not return a receipt");
    }
    expect(Object.keys(authorized.receipt.result).sort()).toEqual([
      "authorizedAt",
      "consentVersion",
      "dispatchDecision",
      "networkSendPerformed",
    ]);
    expect(authorized.receipt.result).toMatchObject({
      consentVersion: version,
      dispatchDecision: "AUTHORIZED_FIXTURE_INTENT",
      networkSendPerformed: false,
    });
    expect(Number.isInteger(authorized.receipt.result.authorizedAt)).toBe(true);
    const withdrawn = await bind.setConsent({
      ...setInput(eventId, subject),
      operationId: freshId("op-withdraw"),
      allowed: false,
      expectedConsentVersion: version as number,
    });
    expect(withdrawn).toMatchObject({
      kind: "RECEIPT",
      step: "set_consent",
      receipt: { result: { allowed: false } },
    });
    expect(bind.state()).toMatchObject({ consented: true, allowed: false, authorized: false, halted: null });
    const actions = seen.map((call) => call.action);
    expect(actions.filter((action) => action !== "create_event")).toEqual([
      "set_consent",
      "authorize_marketing",
      "set_consent",
    ]);
    for (const call of seen) {
      expect(call.body).toMatchObject({ domain: PINNED_PROTOCOL_DOMAIN });
    }
    expect(seen.some((call) => call.actor === CONSENT_AUTHORIZE_ACTOR && call.action === "authorize_marketing")).toBe(
      true,
    );
    for (const banned of ["capture", "settle_capture", "commit_trade", "admit"]) {
      expect(actions).not.toContain(banned);
    }
  }, 20000);

  it("rejects a stale authorize version and fences the next write", async () => {
    const seen: LocalCallInput[] = [];
    const http = watchLocalCalls(baseUrl, seen);
    const eventId = await createShow(http);
    const subject = freshId("subject");
    const bind = new ConsentBind(http);
    const set = await bind.setConsent(setInput(eventId, subject));
    expect(set.kind).toBe("RECEIPT");
    const rejected = await bind.authorizeMarketing(authorizeInput(eventId, subject, 0));
    expect(rejected).toMatchObject({ kind: "REJECTED", code: "CONSENT_NOT_CURRENT" });
    const fenced = await bind.setConsent({
      ...setInput(eventId, subject),
      operationId: freshId("op-again"),
      allowed: false,
    });
    expect(fenced.kind).toBe("FENCED");
    expect(seen.some((call) => call.action === "capture" || call.action === "settle_capture")).toBe(false);
  }, 20000);

  it("does not send authorize_marketing before set_consent", async () => {
    const seen: LocalCallInput[] = [];
    const http = watchLocalCalls(baseUrl, seen);
    const bind = new ConsentBind(http);
    const early = await bind.authorizeMarketing(authorizeInput(freshId("show"), freshId("subject"), 0));
    expect(early).toMatchObject({ kind: "FENCED", blockedBy: { reason: "out-of-order" } });
    expect(seen).toHaveLength(0);
  });
});
