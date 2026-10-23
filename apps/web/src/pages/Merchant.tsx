import { messages as copy0 } from "../i18n/messages/pages--Merchant";
import { messages as copy1 } from "../i18n/messages/merchant-operations";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
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
  const t = useT(copy0, copy1);
  const live = useMerchantOperations();
  const model = live.model;
  // A block, a refusal, or an unknown result takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "merchant-status");

  return (
    <div className="discovery platform merchant" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label={t("ssl")}>
        <a href="#merchant-controls">{t("sed")}</a>
        <a href="#merchant-status">{t("s1mj")}</a>
        <a href="#merchant-cuts">{t("s1l7")}</a>
        <a href="#merchant-lenses">{t("siu")}</a>
        <a href="#merchant-lines">{t("st9")}</a>
        <a href="#merchant-aggregate">{t("s1la")}</a>
        <a href="#merchant-export-panel">{t("ski")}</a>
        <a href="#merchant-session">{t("s1js")}</a>
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
            {deskText(t, model.actionLabel)}
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
