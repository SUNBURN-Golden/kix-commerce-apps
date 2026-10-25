import { TENANT_ROLES, tenantRoleResources } from "@kix/protocol-adapter";
import { useReadState } from "../shell/read-state-params";
import { ReadView, ReadFilter } from "./ReadState";
import { messages as copy0 } from "../i18n/messages/pages--TenantPermissions";
import { messages as copy1 } from "../i18n/messages/tenant-permissions";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { useRestoreFocus } from "../a11y/focus";
import { useTenantPermissions } from "../tenant-permissions";
import {
  TenantAuditSection,
  TenantAuthoritySection,
  TenantBanner,
  TenantControls,
  TenantExportSection,
  TenantFocusSection,
  TenantProposalsSection,
  TenantRequestsSection,
  TenantSessionSection,
  TenantStatus,
  TenantWorkspaceSection,
} from "./TenantPermissionsPanels";

export function TenantPermissionsPage() {
  const t = useT(copy0, copy1);
  const live = useTenantPermissions();
  const model = live.model;
  // A workspace intersects the last authorized snapshot; it cannot expand that snapshot.
  const read = useReadState("permissions", { workspace: TENANT_ROLES });
  const kinds = read.values.workspace ? tenantRoleResources(read.values.workspace) : null;
  const view = { ...model,
    members: model.members.filter((row) => !read.values.workspace || row.role === read.values.workspace),
    orders: !kinds || kinds.includes("order") ? model.orders : [],
    events: !kinds || kinds.includes("event") ? model.events : [],
    accounts: !kinds || kinds.includes("account") ? model.accounts : [],
    cases: !kinds || kinds.includes("case") ? model.cases : [],
    proposals: !kinds || kinds.includes("proposal") ? model.proposals : [],
    audit: !kinds || kinds.includes("audit") ? model.audit : [],
  };
  // A block, a refusal, a denial, a read that did not answer, or an unknown result takes focus to the status region.
  useRestoreFocus(model.focusToken, "tenant-status");

  return (
    <ReadView state={read}>
    <ReadFilter state={read} name="workspace" options={TENANT_ROLES} />
    <div className="discovery platform finance" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label={t("s1pj")}>
        <a href="#tenant-controls">{t("sed")}</a>
        <a href="#tenant-status">{t("s1mj")}</a>
        <a href="#tenant-authority">{t("s26m")}</a>
        <a href="#tenant-workspace">{t("s1hm")}</a>
        <a href="#tenant-proposals">{t("s19i")}</a>
        <a href="#tenant-audit">{t("s94")}</a>
        <a href="#tenant-export-panel">{t("s1jc")}</a>
        <a href="#tenant-requests">{t("s1fv")}</a>
        <a href="#tenant-session">{t("s1js")}</a>
      </nav>
      <div className="discovery-body">
        <TenantBanner environment={live.environment} scenario={live.scenario} model={model} />
        <TenantControls scenario={live.scenario} actorRef={live.actorRef} role={live.role} model={model} actions={live.actions} />
        <TenantStatus model={model} />
        {model.actionLabel ? (
          <button
            type="button"
            id="tenant-return-action"
            className="discovery-action"
            onClick={() => (model.state === "tuple-changed" ? live.actions.newSession() : live.actions.refresh())}
          >
            {deskText(t, model.actionLabel)}
          </button>
        ) : null}
        <TenantAuthoritySection model={model} />
        <TenantFocusSection model={model} />
        <TenantWorkspaceSection model={view} actions={live.actions} />
        <TenantProposalsSection model={view} actions={live.actions} />
        <TenantAuditSection model={view} />
        <TenantExportSection model={model} />
        <TenantRequestsSection model={model} />
        <TenantSessionSection session={model.session} />
      </div>
    </div>
    </ReadView>
  );
}
