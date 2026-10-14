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
  const live = useTenantPermissions();
  const model = live.model;
  // A block, a refusal, a denial, a read that did not answer, or an unknown result takes focus to the status region.
  useRestoreFocus(model.focusToken, "tenant-status");

  return (
    <div className="discovery platform finance" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label="Tenant permissions sections">
        <a href="#tenant-controls">Controls</a>
        <a href="#tenant-status">Status</a>
        <a href="#tenant-authority">Who may do what</a>
        <a href="#tenant-workspace">Role workspace</a>
        <a href="#tenant-proposals">Proposals</a>
        <a href="#tenant-audit">Audit record</a>
        <a href="#tenant-export-panel">Sensitive export</a>
        <a href="#tenant-requests">Requests</a>
        <a href="#tenant-session">Session record</a>
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
            {model.actionLabel}
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
