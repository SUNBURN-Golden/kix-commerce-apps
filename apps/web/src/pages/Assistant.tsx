import { useRestoreFocus } from "../a11y/focus";
import { useDelegationAssistant } from "../delegated-assistant";
import {
  AssistantBanner,
  AssistantControls,
  AssistantRequest,
  AssistantStatus,
  BoardSection,
  GrantsSection,
  LanesSection,
  ProposalsSection,
  RegisterSection,
  RejectionsSection,
  SessionSection,
  TurnsSection,
} from "./AssistantPanels";

export function AssistantPage() {
  const live = useDelegationAssistant();
  const model = live.model;
  // A refusal, a block, a rejection, an unknown result, or a refused read takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "dlg-status");

  return (
    <div className="discovery dlg" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label="Delegated assistant sections">
        <a href="#dlg-controls">Controls</a>
        <a href="#dlg-request">Request</a>
        <a href="#dlg-status">Status</a>
        <a href="#dlg-lanes">Lanes</a>
        <a href="#dlg-grants">Grants</a>
        <a href="#dlg-board">Board</a>
        <a href="#dlg-proposals">Proposals</a>
        <a href="#dlg-turns">Turns</a>
        <a href="#dlg-rejections">Rejected</a>
        <a href="#dlg-session">Session record</a>
        <a href="#dlg-register">Contract register</a>
      </nav>
      <div className="discovery-body">
        <AssistantBanner environment={live.environment} scenario={live.scenario} model={model} />
        <AssistantControls
          environment={live.environment}
          scenario={live.scenario}
          heldSupported={live.heldSupported}
          principalRef={model.principalRef}
          actions={live.actions}
        />
        <AssistantRequest actions={live.actions} />
        <AssistantStatus model={model} />
        {model.actionLabel ? (
          <button
            type="button"
            id="dlg-return-action"
            className="discovery-action"
            onClick={() => (model.state === "tuple-changed" ? live.actions.newSession() : live.actions.refresh())}
          >
            {model.actionLabel}
          </button>
        ) : null}
        <LanesSection model={model} />
        <GrantsSection model={model} />
        <BoardSection model={model} />
        <ProposalsSection model={model} actions={live.actions} />
        <TurnsSection model={model} />
        <RejectionsSection model={model} actions={live.actions} />
        <SessionSection session={model.session} />
        <RegisterSection model={model} />
      </div>
    </div>
  );
}
