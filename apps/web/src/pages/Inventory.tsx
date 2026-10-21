import { messages as copy0 } from "../i18n/messages/pages--Inventory";
import { messages as copy1 } from "../i18n/messages/inventory-venue";
import { messages as copy2 } from "../i18n/messages/a11y--present";
import { useT } from "../i18n/desk-context";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useRestoreFocus } from "../a11y/focus";
import {
  quantityFromParam,
  selectedUnitFor,
  useInventoryRead,
  type InventoryLocation,
  type SelectionModel,
} from "../inventory-venue";
import {
  InventoryBanner,
  InventoryControls,
  PageSection,
  SelectionSection,
  SummarySection,
} from "./InventoryPanels";

function locationParams(next: InventoryLocation): URLSearchParams {
  const params = new URLSearchParams();
  if (next.section) {
    params.set("section", next.section);
  }
  if (next.section && next.unit) {
    params.set("unit", next.unit);
    if (next.quantity !== undefined) {
      params.set("quantity", next.quantity);
    }
  }
  return params;
}

function quantityBlocked(model: SelectionModel | null): boolean {
  return model !== null && model.invalidCode === "QUANTITY";
}

export function InventoryPage() {
  const t = useT(copy0, copy1, copy2);
  const [params, setParams] = useSearchParams();
  const sectionId = params.get("section");
  const unitId = sectionId === null ? null : params.get("unit");
  const quantityParam = unitId === null ? null : params.get("quantity");
  const [quantityText, setQuantityText] = useState(quantityParam ?? "1");
  const live = useInventoryRead({
    sectionId,
    unitId,
    quantity: quantityFromParam(quantityParam),
    setLocation: (next) => setParams(locationParams(next)),
  });

  useEffect(() => {
    if (quantityParam !== null) {
      setQuantityText(quantityParam);
    }
  }, [quantityParam]);

  const blocked = quantityBlocked(live.selectionModel);
  useRestoreFocus(blocked ? `${unitId ?? ""}:${quantityParam ?? ""}` : null, "inventory-quantity");

  const openSeat = (nextUnit: string) => {
    if (sectionId !== null) {
      setParams(locationParams({ section: sectionId, unit: nextUnit }));
    }
  };
  const selectPool = (nextUnit: string) => {
    if (sectionId !== null) {
      setParams(locationParams({ section: sectionId, unit: nextUnit, quantity: quantityText }));
    }
  };
  const clearSelection = () => {
    if (sectionId !== null) {
      setParams(locationParams({ section: sectionId }));
    }
  };

  return (
    <div className="discovery inventory" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label={t("soo")}>
        <a href="#inventory-controls">{t("sed")}</a>
        <a href="#inventory-summary">{t("s1ne")}</a>
        {sectionId !== null ? <a href="#inventory-page">{t("s16t")}</a> : null}
        {unitId !== null ? <a href="#inventory-selection">{t("s1iw")}</a> : null}
      </nav>
      <div className="discovery-body">
        <InventoryBanner
          environment={live.environment}
          scenario={live.scenario}
          servedGeneration={live.servedGeneration}
          summary={live.summaryModel}
        />
        <InventoryControls scenario={live.scenario} summary={live.summaryModel} actions={live.actions} />
        <SummarySection model={live.summaryModel} actions={live.actions} />
        {live.pageModel ? (
          <PageSection
            model={live.pageModel}
            actions={live.actions}
            selectedUnitId={selectedUnitFor(live.selectionModel, unitId)}
            quantityText={quantityText}
            quantityInvalid={blocked}
            onQuantity={setQuantityText}
            onOpen={openSeat}
            onSelectPool={selectPool}
          />
        ) : null}
        {live.selectionModel && sectionId !== null && unitId !== null ? (
          <SelectionSection
            model={live.selectionModel}
            sectionId={sectionId}
            unitId={unitId}
            actions={live.actions}
            onClear={clearSelection}
          />
        ) : null}
      </div>
    </div>
  );
}
