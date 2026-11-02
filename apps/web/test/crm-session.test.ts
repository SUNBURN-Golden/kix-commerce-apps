import { describe, expect, it } from "vitest";
import { createStubConsentInvoker, localStubObservation, ProtocolError, GateRejectedError, type LocalCallInput } from "@kix/protocol-adapter";
import { createConsentDesk, type ConsentDraft } from "../src/consent-desk";
import { crmChannelPreferences, crmPurposeLedger, previewCrmAudience, type CrmSegmentFilter } from "../src/crm-session";

const draft: ConsentDraft = { subject: "subject-fixture", business: "business-fixture", channel: "fixture-channel",
  purpose: "fixture-purpose", expectedConsentVersion: "1", allowed: "true" };
const filter: CrmSegmentFilter = { eventId: "crm-show", business: draft.business, channel: draft.channel, purpose: draft.purpose, tier: "all" };
function setup(handle?: (input: LocalCallInput, receipt: Record<string, unknown>) => Promise<unknown>) {
  const shape = createStubConsentInvoker();
  const calls: LocalCallInput[] = [];
  const desk = createConsentDesk({ protocol: { describe: () => ({ environment: "stub" }), observeTransport: async () => localStubObservation() },
    source: { source: "stub-shape", invoker: { async invokeLocalCall(input) {
      calls.push(structuredClone(input));
      const receipt = await shape.invokeLocalCall(input) as Record<string, unknown>;
      return handle ? handle(input, receipt) : receipt;
    } } } });
  const rows = (overrides: Partial<CrmSegmentFilter> = {}) => previewCrmAudience(desk.getSnapshot(), { ...filter, ...overrides });
  const send = (step: "set_consent" | "authorize_marketing", fields: Partial<ConsentDraft> = {}) => desk.send(filter.eventId, step, { ...draft, ...fields });
  return { desk, calls, rows, send };
}

describe("synthetic session CRM", () => {
  it("excludes unset and un-authorized consent; matches every scope field and tier without sending", async () => {
    const { desk, send, rows, calls } = setup();
    expect(rows().every((row) => !row.included && row.reason === "unset")).toBe(true);
    await send("set_consent");
    expect(rows()[0]?.reason).toBe("authorization");
    await send("authorize_marketing");
    expect(rows().map((row) => row.included)).toEqual([true, false, false]);
    for (const key of ["eventId", "business", "channel", "purpose"] as const) {
      expect(rows({ [key]: "other" }).some((row) => row.included)).toBe(false);
    }
    expect(rows({ tier: "member" })[0]?.reason).toBe("tier");
    expect(rows({ tier: "fan" })[0]?.included).toBe(true);
    const foreignDomain = structuredClone(desk.getSnapshot());
    for (const item of foreignDomain.events[0]!.evidence) item.scope.domain = "foreign-domain";
    expect(previewCrmAudience(foreignDomain, filter).every((row) => !row.included)).toBe(true);
    expect(crmChannelPreferences(desk.getSnapshot())).toHaveLength(1);
    expect(crmPurposeLedger(desk.getSnapshot()).every((row) => row.channelSend === "none")).toBe(true);
    expect(calls.map((call) => call.action)).toEqual(["set_consent", "authorize_marketing"]);
    expect(calls[0]?.body).not.toHaveProperty("subject");
    expect(calls[1]?.actor).toBe("marketing-adapter");
  });

  it("withdraws and regrants at fixed version 1 only with fresh authorization; history becomes STALE", async () => {
    const { desk, send, rows } = setup();
    await send("set_consent"); await send("authorize_marketing");
    const oldAuth = desk.getSnapshot().events[0]!.evidence[1]!;
    await send("set_consent", { allowed: "false" });
    expect(rows()[0]).toMatchObject({ included: false, reason: "withdrawn", consentVersion: 1 });
    await send("set_consent");
    expect(rows()[0]).toMatchObject({ included: false, reason: "STALE", consentVersion: 1 });
    await send("authorize_marketing");
    expect(rows()[0]?.included).toBe(true);
    const evidence = desk.getSnapshot().events[0]!.evidence;
    expect(evidence.at(-1)?.consentOperationId).toBe(evidence.at(-2)?.operationId);
    expect(evidence.at(-1)?.consentOperationId).not.toBe(oldAuth.consentOperationId);
    expect(crmPurposeLedger(desk.getSnapshot()).find((row) => row.authorizationOperationId === oldAuth.operationId)?.status).toBe("STALE");
  });

  it("uses literal receipt versions, excluding stale versions even on matching lineage", async () => {
    let receiptVersion = 1;
    const { desk, send, rows } = setup(async (input, receipt) => input.action === "set_consent"
      ? { ...receipt, result: { allowed: (input.body as Record<string, unknown>).allowed, consentVersion: receiptVersion } } : receipt);
    await send("set_consent"); await send("authorize_marketing");
    expect(rows()[0]?.included).toBe(true);
    receiptVersion = 7;
    await send("set_consent");
    expect(rows()[0]).toMatchObject({ included: false, reason: "STALE", consentVersion: 7 });
    await send("authorize_marketing");
    expect(rows()[0]).toMatchObject({ included: false, reason: "STALE", consentVersion: 7 });
    await send("set_consent", { expectedConsentVersion: "7" });
    await send("authorize_marketing", { expectedConsentVersion: "7" });
    expect(rows()[0]?.included).toBe(true);
    expect(crmPurposeLedger(desk.getSnapshot()).at(-1)).toMatchObject({ consentVersion: 7, authorizationConsentVersion: 7 });
  });

  it.each(["confirmed", "unknown", "rejected", "malformed"])("invalidates immediately while withdrawal is pending, then %s", async (outcome) => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const { send, rows } = setup(async (input, receipt) => {
      if (input.action === "set_consent" && (input.body as Record<string, unknown>).allowed === false) {
        await gate;
        if (outcome === "unknown") throw new ProtocolError("lost", "REQUEST_TIMEOUT", { requestId: "crm-req", correlationId: "crm-corr" });
        if (outcome === "rejected") throw new GateRejectedError("refused", "STALE_CONSENT_VERSION", { requestId: "crm-reject", correlationId: "crm-reject-corr" }, 422);
        if (outcome === "malformed") return { ...receipt, result: { allowed: false } };
      }
      return receipt;
    });
    await send("set_consent"); await send("authorize_marketing");
    const pending = send("set_consent", { allowed: "false" });
    expect(rows()[0]).toMatchObject({ included: false, reason: "pending" });
    release(); await pending;
    expect(rows()[0]).toMatchObject({ included: false, reason: outcome === "confirmed" ? "withdrawn" : outcome === "rejected" ? "blocked" : "UNKNOWN" });
    if (outcome !== "confirmed") expect(rows()[0]?.consentState).not.toBe("withdrawn");
  });

  it("isolates subjects, scopes and channels; foreign authorization cannot grant inclusion", async () => {
    const { desk, send, rows } = setup();
    await send("set_consent"); await send("authorize_marketing", { subject: "subject-member" });
    expect(rows().every((row) => !row.included)).toBe(true);
    await send("set_consent", { subject: "subject-member", channel: "other-channel" });
    await send("authorize_marketing", { subject: "subject-member", channel: "other-channel" });
    expect(rows({ channel: "other-channel" }).map((row) => row.included)).toEqual([false, true, false]);
    expect(crmChannelPreferences(desk.getSnapshot())).toHaveLength(3);
  });

  it("does not expose fixtures in integration HTTP, even if stub-shaped evidence is supplied", async () => {
    const { desk, send } = setup();
    await send("set_consent"); await send("authorize_marketing");
    const snapshot = { ...desk.getSnapshot(), environment: "integration-http" as const };
    expect(previewCrmAudience(snapshot, filter).every((row) => row.reason === "NOT_BOUND" && !row.included)).toBe(true);
    expect(crmChannelPreferences(snapshot)).toEqual([]); expect(crmPurposeLedger(snapshot)).toEqual([]);
  });

  it("reset/reload clears evidence and ignores a delayed outcome from the old desk generation", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const { desk, send, rows } = setup(async (_input, receipt) => { await gate; return receipt; });
    const pending = send("set_consent"); desk.reset();
    expect(desk.getSnapshot().events).toEqual([]);
    release(); await pending;
    expect(desk.getSnapshot().events).toEqual([]);
    expect(rows().every((row) => row.reason === "unset")).toBe(true);
  });
});
