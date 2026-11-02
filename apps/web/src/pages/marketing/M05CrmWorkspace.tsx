import { useState } from "react";
import type { ConsentDeskSnapshot } from "../../consent-desk";
import { CRM_FIXTURE_FANS, crmChannelPreferences, crmPurposeLedger, previewCrmAudience, type CrmReason, type CrmSegmentFilter } from "../../crm-session";
import { useT } from "../../i18n/desk-context";
import { messages } from "../../i18n/messages/pages--marketing--M05Consent";
import type { ConsentRecord } from "../../marketing/desk";

const REASONS = { included: "crm.included", unset: "crm.unset", withdrawn: "crm.withdrawn", UNKNOWN: "crm.UNKNOWN",
  pending: "crm.pending", blocked: "crm.blocked", STALE: "crm.STALE", authorization: "crm.authorization",
  tier: "crm.tierExcluded", NOT_BOUND: "crm.NOT_BOUND" } as const satisfies Record<CrmReason, keyof typeof messages.en>;

function EvidenceTable({ title, headers, rows, fanIds }: { title: string; headers: string[]; rows: string[][]; fanIds?: string[] }) {
  const t = useT(messages);
  return <div className="xs-scroll" role="region" aria-label={title} tabIndex={0}>
    <table><caption>{title}</caption><thead><tr>{headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
      <tbody>{rows.map((cells, index) => <tr key={index} data-crm-fan={fanIds?.[index]}>
        {cells.map((cell, column) => column === 0 ? <th scope="row" key={column}>{cell}</th> : <td key={column}>{cell}</td>)}
      </tr>)}</tbody></table>
    {rows.length === 0 ? <p>{t("crm.empty")}</p> : null}
  </div>;
}

export function M05CrmWorkspace({ snapshot, flags }: { snapshot: ConsentDeskSnapshot; flags: ConsentRecord }) {
  const t = useT(messages);
  const [filter, setFilter] = useState<CrmSegmentFilter>({ eventId: "", business: "", channel: "", purpose: "", tier: "all" });
  const available = snapshot.environment === "stub" && snapshot.source === "stub-shape";
  const audience = previewCrmAudience(snapshot, filter);
  const channels = crmChannelPreferences(snapshot);
  const reason = (value: CrmReason) => t(REASONS[value]);
  const consent = (row: (typeof audience)[number]) => `${t(row.consentState === "allowed" ? "crm.allowed" : REASONS[row.consentState])} / ${row.consentVersion ?? t("common.empty")}`;
  const headers = (...keys: ("crm.fan" | "crm.tier" | "crm.consent" | "crm.auth" | "crm.reason" | "crm.scope" | "crm.operations" | "crm.versions" | "s1mj" | "crm.send")[]) => keys.map((key) => t(key));
  const fields = { eventId: "sis", business: "saq", channel: "sby", purpose: "s1ag" } as const;
  const flagState = { unset: "crm.flagUnset", saved: "crm.saved", withdrawn: "crm.flagWithdrawn" } as const;
  return <section className="panel cross-surface" aria-labelledby="crm-title" data-crm-mode={available ? "synthetic" : "NOT_BOUND"}>
    <h3 id="crm-title">{t("crm.title")}</h3><p>{t("crm.boundary")}</p>
    <p>{t("crm.flags", { state: t(flagState[flags.state]), performance: String(flags.performanceNotes), membership: String(flags.membershipNotes) })}</p>
    {!available ? <p role="status">{t("crm.http")}</p> : <>
      <p>{t("crm.help")}</p>
      <div className="row-actions">
        {(Object.keys(fields) as (keyof typeof fields)[]).map((key) => <label key={key} htmlFor={`crm-${key}`}>
          {t(fields[key])}<select id={`crm-${key}`} value={filter[key]} onChange={(event) => setFilter((current) => ({ ...current, [key]: event.target.value }))}>
            <option value="">{t("crm.choose")}</option>
            {[...new Set(channels.map(({ scope }) => scope[key]))].filter(Boolean).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>)}
        <label htmlFor="crm-tier">{t("crm.tier")}<select id="crm-tier" value={filter.tier}
          onChange={(event) => setFilter((current) => ({ ...current, tier: event.target.value as CrmSegmentFilter["tier"] }))}>
          <option value="all">{t("crm.all")}</option><option value="fan">{t("crm.fanTier")}</option><option value="member">{t("crm.memberTier")}</option>
        </select></label>
      </div>
      <p role="status" aria-live="polite" data-crm-count>{t("crm.count", { count: audience.filter((row) => row.included).length })}</p>
      <EvidenceTable title={t("crm.audience")} headers={headers("crm.fan", "crm.tier", "crm.consent", "crm.auth", "crm.reason")}
        fanIds={audience.map((row) => row.fanId)} rows={audience.map((row, index) => [
          `${row.fanId} / ${CRM_FIXTURE_FANS[index]?.subject}`, CRM_FIXTURE_FANS[index]?.tier ?? "",
          consent(row), t(row.authorizationState === "STALE" ? "crm.STALE" : row.authorizationState === "current" ? "crm.current" : "crm.absent"), reason(row.reason),
        ])} />
      <EvidenceTable title={t("crm.channels")} headers={headers("crm.fan", "crm.scope", "crm.consent", "crm.reason")}
        rows={channels.map(({ scope, row }) => [row.fanId, Object.values(scope).join(" / "), consent(row), reason(row.reason)])} />
      <EvidenceTable title={t("crm.ledger")} headers={headers("crm.fan", "crm.scope", "crm.operations", "crm.versions", "s1mj", "crm.send")}
        rows={crmPurposeLedger(snapshot).map((row) => [row.fanId, Object.values(row.scope).join(" / "),
          `${row.consentOperationId ?? t("common.empty")} / ${row.authorizationOperationId ?? t("common.empty")}`,
          `${row.consentVersion ?? t("common.empty")} / ${row.authorizationConsentVersion ?? t("common.empty")}`, reason(row.status), row.channelSend])} />
    </>}
  </section>;
}
