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
  // A block, a refusal, a denial, a read that did not answer, or an unknown result takes focus to the status region.
  useRestoreFocus(model.focusToken, "tenant-status");

  return (
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
        <TenantWorkspaceSection model={model} actions={live.actions} />
        <TenantProposalsSection model={model} actions={live.actions} />
        <TenantAuditSection model={model} />
        <TenantExportSection model={model} />
        <TenantRequestsSection model={model} />
        <TenantSessionSection session={model.session} />
      </div>
    </div>
  );
}
