import { useRestoreFocus } from "../a11y/focus";
import { useMarketplaceBench } from "../marketplace-performance";
import {
  BenchBanner,
  BenchControls,
  BenchMeasurements,
  BenchQueue,
  BenchSession,
  BenchStatus,
  BenchWindow,
} from "./MarketplacePerformancePanels";

export function MarketplacePerformancePage() {
  const live = useMarketplaceBench();
  const model = live.model;
  // A dropped, cancelled, or unsent result, or a failed read, takes focus to the status region.
  useRestoreFocus(model.focusToken, "mperf-status");
  const workload = live.workload;

  return (
    <div className="discovery platform finance" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label="Marketplace scale bench sections">
        <a href="#mperf-controls">Controls</a>
        <a href="#mperf-status">Status</a>
        <a href="#mperf-queue">Queue</a>
        <a href="#mperf-window">Window</a>
        <a href="#mperf-measure">Measurements</a>
        <a href="#mperf-session">Session record</a>
      </nav>
      <div className="discovery-body">
        <BenchBanner environment={live.environment} scenario={live.scenario} model={model} />
        <BenchControls scenario={live.scenario} workload={workload} actions={live.actions} />
        <BenchStatus model={model} actions={live.actions} />
        <BenchQueue model={model} actions={live.actions} />
        <BenchWindow model={model} actions={live.actions} />
        <BenchMeasurements model={model} />
        <BenchSession model={model} />
      </div>
    </div>
  );
}
