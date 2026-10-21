import { messages as copy0 } from "../i18n/messages/pages--MarketplacePerformance";
import { messages as copy1 } from "../i18n/messages/marketplace-performance";
import { useT } from "../i18n/desk-context";
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
  const t = useT(copy0, copy1);
  const live = useMarketplaceBench();
  const model = live.model;
  // A dropped, cancelled, or unsent result, or a failed read, takes focus to the status region.
  useRestoreFocus(model.focusToken, "mperf-status");
  const workload = live.workload;

  return (
    <div className="discovery platform finance" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label={t("ss0")}>
        <a href="#mperf-controls">{t("sed")}</a>
        <a href="#mperf-status">{t("s1mj")}</a>
        <a href="#mperf-queue">{t("s1ar")}</a>
        <a href="#mperf-window">{t("s26o")}</a>
        <a href="#mperf-measure">{t("sse")}</a>
        <a href="#mperf-session">{t("s1js")}</a>
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
