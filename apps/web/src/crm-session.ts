import { PINNED_PROTOCOL_DOMAIN } from "@kix/protocol-adapter";
import { sameConsentScope, type ConsentAttemptEvidence, type ConsentDeskSnapshot, type ConsentEvidenceScope } from "./consent-desk";

export interface CrmFixtureFan { fanId: string; subject: string; tier: "fan" | "member" }
export const CRM_FIXTURE_FANS: readonly CrmFixtureFan[] = Object.freeze([
  Object.freeze({ fanId: "fixture-01", subject: "subject-fixture", tier: "fan" }),
  Object.freeze({ fanId: "fixture-02", subject: "subject-member", tier: "member" }),
  Object.freeze({ fanId: "fixture-03", subject: "subject-unset", tier: "fan" }),
]);
export interface CrmSegmentFilter {
  eventId: string; business: string; channel: string; purpose: string; tier: "all" | CrmFixtureFan["tier"];
}
export type CrmReason = "included" | "unset" | "withdrawn" | "UNKNOWN" | "pending" | "blocked" | "STALE" | "authorization" | "tier" | "NOT_BOUND";
export interface CrmAudienceRow {
  fanId: string; consentState: "unset" | "allowed" | "withdrawn" | "UNKNOWN";
  consentVersion: number | null; authorizationState: "absent" | "current" | "STALE";
  included: boolean; reason: CrmReason;
}
export interface CrmPurposeLedgerRow {
  fanId: string; scope: ConsentEvidenceScope; consentOperationId: string | null;
  authorizationOperationId: string | null; consentVersion: number | null;
  authorizationConsentVersion: number | null; status: CrmReason; channelSend: "none";
}

function latest(items: ConsentAttemptEvidence[], step: ConsentAttemptEvidence["step"]) {
  return [...items].reverse().find((item) => item.step === step);
}
function scopeFor(fan: CrmFixtureFan, filter: CrmSegmentFilter): ConsentEvidenceScope {
  return { domain: PINNED_PROTOCOL_DOMAIN, subject: fan.subject, eventId: filter.eventId,
    business: filter.business, channel: filter.channel, purpose: filter.purpose };
}

/** Pure read of owned, validated evidence. Drafts/flags have no authority here. */
export function previewCrmAudience(snapshot: ConsentDeskSnapshot, filter: CrmSegmentFilter): CrmAudienceRow[] {
  return CRM_FIXTURE_FANS.map((fan) => {
    const event = snapshot.events.find((item) => item.eventId === filter.eventId);
    const scope = scopeFor(fan, filter);
    const evidence = event?.evidence.filter((item) => sameConsentScope(item.scope, scope)) ?? [];
    const consent = latest(evidence, "set_consent");
    const auth = latest(evidence, "authorize_marketing");
    const result = consent?.status === "confirmed" ? consent.result : null;
    const allowed = result && "allowed" in result ? result.allowed : null;
    const version = result?.consentVersion ?? null;
    const current = allowed === true && auth?.status === "confirmed"
      && auth.consentOperationId === consent?.operationId && auth.result !== null
      && "networkSendPerformed" in auth.result && auth.result.networkSendPerformed === false
      && auth.result.consentVersion === version;
    let reason: CrmReason;
    if (snapshot.environment !== "stub" || snapshot.source !== "stub-shape") reason = "NOT_BOUND";
    else if (filter.tier !== "all" && filter.tier !== fan.tier) reason = "tier";
    else if (event?.pending) reason = "pending";
    else if (event?.halted) reason = evidence.some((item) => item.status === "unconfirmed") ? "UNKNOWN" : "blocked";
    else if (!consent) reason = "unset";
    else if (consent.status === "unconfirmed") reason = "UNKNOWN";
    else if (consent.status !== "confirmed") reason = "blocked";
    else if (allowed === false) reason = "withdrawn";
    else if (current) reason = "included";
    else reason = auth ? "STALE" : "authorization";
    return { fanId: fan.fanId,
      consentState: consent?.status === "unconfirmed" ? "UNKNOWN" : allowed === false ? "withdrawn" : allowed === true ? "allowed" : "unset",
      consentVersion: version, authorizationState: current ? "current" : auth ? "STALE" : "absent",
      included: reason === "included", reason };
  });
}

/** Each recorded channel/purpose scope stays distinct, including subjects and events. */
export function crmChannelPreferences(snapshot: ConsentDeskSnapshot) {
  if (snapshot.environment !== "stub" || snapshot.source !== "stub-shape") return [];
  const scopes: ConsentEvidenceScope[] = [];
  for (const event of snapshot.events) for (const item of event.evidence) {
    if (CRM_FIXTURE_FANS.some((fan) => fan.subject === item.scope.subject)
      && !scopes.some((scope) => sameConsentScope(scope, item.scope))) scopes.push({ ...item.scope });
  }
  return scopes.flatMap((scope) => {
    const fan = CRM_FIXTURE_FANS.find((entry) => entry.subject === scope.subject);
    const row = previewCrmAudience(snapshot, { ...scope, tier: "all" }).find((entry) => entry.fanId === fan?.fanId);
    return row ? [{ scope, row }] : [];
  });
}

export function crmPurposeLedger(snapshot: ConsentDeskSnapshot): CrmPurposeLedgerRow[] {
  if (snapshot.environment !== "stub" || snapshot.source !== "stub-shape") return [];
  return snapshot.events.flatMap((event) => event.evidence.flatMap((item): CrmPurposeLedgerRow[] => {
    const fan = CRM_FIXTURE_FANS.find((entry) => entry.subject === item.scope.subject);
    if (!fan) return [];
    const scoped = event.evidence.filter((entry) => sameConsentScope(entry.scope, item.scope));
    const consent = scoped.find((entry) => entry.operationId === item.consentOperationId);
    const audience = previewCrmAudience(snapshot, { ...item.scope, tier: "all" }).find((row) => row.fanId === fan.fanId);
    if (!audience) return [];
    const isLatest = item === latest(scoped, item.step)
      && (item.step === "set_consent" || item.consentOperationId === latest(scoped, "set_consent")?.operationId);
    return [{ fanId: fan.fanId, scope: { ...item.scope }, consentOperationId: item.consentOperationId,
      authorizationOperationId: item.step === "authorize_marketing" ? item.operationId : null,
      consentVersion: consent?.result?.consentVersion ?? null,
      authorizationConsentVersion: item.step === "authorize_marketing" ? item.result?.consentVersion ?? null : null,
      status: isLatest ? audience.reason : "STALE", channelSend: "none" }];
  }));
}
