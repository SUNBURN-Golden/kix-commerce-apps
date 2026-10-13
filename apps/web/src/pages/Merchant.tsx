import { useRestoreFocus } from "../a11y/focus";
import { useMerchantOperations } from "../merchant-operations";
import {
  AggregateSection,
  CutsSection,
  ExportSection,
  LensesSection,
  LinesSection,
  MerchantBanner,
  MerchantControls,
  MerchantSessionSection,
  MerchantStatus,
} from "./MerchantPanels";

export function MerchantPage() {
  const live = useMerchantOperations();
  const model = live.model;
  // A block, a refusal, or an unknown result takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "merchant-status");

  return (
    <div className="discovery platform merchant" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label="Merchant sections">
        <a href="#merchant-controls">Controls</a>
        <a href="#merchant-status">Status</a>
        <a href="#merchant-cuts">Source cuts</a>
        <a href="#merchant-lenses">Events and listings</a>
        <a href="#merchant-lines">Money lines</a>
        <a href="#merchant-aggregate">Source figures</a>
        <a href="#merchant-export-panel">Export</a>
        <a href="#merchant-session">Session record</a>
      </nav>
      <div className="discovery-body">
        <MerchantBanner environment={live.environment} scenario={live.scenario} model={model} />
        <MerchantControls scenario={live.scenario} model={model} actions={live.actions} />
        <MerchantStatus model={model} />
        {model.actionLabel ? (
          <button
            type="button"
            id="merchant-return-action"
            className="discovery-action"
            onClick={() => (model.state === "tuple-changed" ? live.actions.newSession() : live.actions.refresh())}
          >
            {model.actionLabel}
          </button>
        ) : null}
        <CutsSection model={model} />
        <LensesSection model={model} />
        <LinesSection model={model} />
        <AggregateSection model={model} />
        <ExportSection model={model} />
        <MerchantSessionSection session={model.session} />
      </div>
    </div>
  );
}
