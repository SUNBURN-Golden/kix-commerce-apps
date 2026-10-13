import { useRestoreFocus } from "../a11y/focus";
import { useFinanceOperations } from "../finance-operations";
import {
  AuthoritySection,
  CutsSection,
  ExportSection,
  FinanceBanner,
  FinanceControls,
  FinanceSessionSection,
  FinanceStatus,
  FiguresSection,
  QueueSection,
  RequestsSection,
} from "./FinancePanels";

export function FinancePage() {
  const live = useFinanceOperations();
  const model = live.model;
  // A block, a refusal, a denial, a read that did not answer, or an unknown result takes focus to the status region.
  useRestoreFocus(model.focusToken, "finance-status");

  return (
    <div className="discovery platform finance" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label="Finance sections">
        <a href="#finance-controls">Controls</a>
        <a href="#finance-status">Status</a>
        <a href="#finance-authority">Who may do what</a>
        <a href="#finance-cuts">Source cuts</a>
        <a href="#finance-queue">Exception queue</a>
        <a href="#finance-figures">Source figures</a>
        <a href="#finance-export-panel">Accounting export</a>
        <a href="#finance-requests">Requests</a>
        <a href="#finance-session">Session record</a>
      </nav>
      <div className="discovery-body">
        <FinanceBanner environment={live.environment} scenario={live.scenario} model={model} />
        <FinanceControls scenario={live.scenario} actorRef={live.actorRef} model={model} actions={live.actions} />
        <FinanceStatus model={model} />
        {model.actionLabel ? (
          <button
            type="button"
            id="finance-return-action"
            className="discovery-action"
            onClick={() => (model.state === "tuple-changed" ? live.actions.newSession() : live.actions.refresh())}
          >
            {model.actionLabel}
          </button>
        ) : null}
        <AuthoritySection model={model} />
        <CutsSection model={model} />
        <QueueSection model={model} actions={live.actions} />
        <FiguresSection model={model} />
        <ExportSection model={model} />
        <RequestsSection model={model} />
        <FinanceSessionSection session={model.session} />
      </div>
    </div>
  );
}
