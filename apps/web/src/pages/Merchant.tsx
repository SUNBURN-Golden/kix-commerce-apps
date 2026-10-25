import { useReadState } from "../shell/read-state-params";
import { readSettled, ReadView, ReadFilter } from "./ReadState";
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
  const rowsFor = (cut?: string) => [...model.events.map((row) => ({ id: row.eventRef, cut: row.cutRef })), ...model.listings.map((row) => ({ id: row.listingRef, cut: row.cutRef })), ...model.trades.map((row) => ({ id: row.tradeRef, cut: row.cutRef }))].filter((row) => !cut || row.cut === cut).map((row) => row.id);
  const read = useReadState("merchant", { cut:  !readSettled(model.state) ? null : model.cuts.map((cut) => cut.cutRef), row: (values) =>  !readSettled(model.state) ? null : rowsFor(values.cut) });
  const view = { ...model, events: model.events.filter((row) => !read.values.cut || row.cutRef === read.values.cut), listings: model.listings.filter((row) => !read.values.cut || row.cutRef === read.values.cut), trades: model.trades.filter((row) => !read.values.cut || row.cutRef === read.values.cut), lines: model.lines.filter((row) => !read.values.cut || row.cutRef === read.values.cut) };
  // A block, a refusal, or an unknown result takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "merchant-status");

  return (
    <ReadView state={read}>
    <ReadFilter state={read} name="cut" options={model.cuts.map((cut) => cut.cutRef)} />
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
        <LensesSection model={view} />
        <LinesSection model={view} />
        <AggregateSection model={model} />
        <ExportSection model={model} />
        <MerchantSessionSection session={model.session} />
      </div>
    </div>
    </ReadView>
  );
}
