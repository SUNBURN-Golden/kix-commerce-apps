import { messages as copy0 } from "../i18n/messages/pages--Discovery";
import { messages as copy1 } from "../i18n/messages/discovery--model";
import { messages as copy2 } from "../i18n/messages/discovery--fixture";
import { messages as copy3 } from "../i18n/messages/a11y--present";
import { messages as copy4 } from "../i18n/messages/discovery-live";
import { messages as copy5 } from "../i18n/messages/discovery-workspace";
import { messages as copy6 } from "../i18n/messages/buyer-workspace";
import { messages as copy7 } from "../i18n/messages/gift-desk";
import { messages as copy8 } from "../i18n/messages/storage-allow-list";
import { messages as copy9 } from "../i18n/messages/journey-desk";
import { messages as copy10 } from "../i18n/messages/resale-desk";
import { messages as copy11 } from "../i18n/messages/reservation-desk";
import { messages as copy12 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { conflictControlId, focusControl } from "../a11y/focus";
import { useT } from "../i18n/desk-context";
import { useFormatWhen } from "../i18n/locale-context";
import { paramsFromQuery, queryFromParams, searchSuffix, type DiscoveryQuery } from "../discovery/model";
import {
  useDiscoveryLiveRead,
  type LiveDetailHandlers,
  type LiveDetailModel,
  type LiveListHandlers,
  type LiveListModel,
} from "../discovery-live";
import { useDiscoveryWorkspace, type DiscoveryModel } from "../discovery-workspace";
import {
  CatalogNotice,
  DiscoveryBanner,
  DiscoveryForm,
  LiveReadDetail,
  LiveReadSection,
  PurchasePathView,
  ResultSection,
  ScaleList,
} from "./DiscoveryPanels";

export function DiscoveryPage() {
  const [params, setParams] = useSearchParams();
  const { rowId } = useParams();
  const navigate = useNavigate();
  const query = queryFromParams(params);
  const selected = rowId ?? null;
  const { model, readAgain } = useDiscoveryWorkspace(query, selected);
  const live = useDiscoveryLiveRead({
    rowId: selected,
    detailEnabled: selected !== null && model.missingRow,
  });
  const onQuery = (next: DiscoveryQuery) => {
    setParams(paramsFromQuery(next));
  };
  const onOpen = (id: string) => {
    navigate({ pathname: `/discovery/${encodeURIComponent(id)}`, search: searchSuffix(params) });
  };
  if (selected) {
    return (
      <DiscoveryDetail
        model={model}
        onReadAgain={readAgain}
        backSearch={searchSuffix(params)}
        live={{ model: live.detailModel, handlers: live.detailHandlers }}
      />
    );
  }
  return (
    <DiscoveryScreen
      model={model}
      query={query}
      onQuery={onQuery}
      onOpen={onOpen}
      onReadAgain={readAgain}
      live={{ model: live.listModel, handlers: live.listHandlers }}
    />
  );
}

export function DiscoveryScreen({
  model,
  query,
  onQuery,
  onOpen,
  onReadAgain,
  live,
}: {
  model: DiscoveryModel;
  query: DiscoveryQuery;
  onQuery: (next: DiscoveryQuery) => void;
  onOpen: (rowId: string) => void;
  onReadAgain: () => void;
  live: { model: LiveListModel; handlers: LiveListHandlers };
}) {
  const t = useT(copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7, copy8, copy9, copy10, copy11, copy12);
  const [focus, setFocus] = useState(0);
  const signature = `${model.result.state}:${model.result.page}:${model.result.rows.length}:${query.sort}:${query.pageSize}`;
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setFocus(0);
  }
  const count = model.result.rows.length;
  const safeFocus = count === 0 ? 0 : Math.min(focus, count - 1);
  const conflict = model.result.state === "filter-conflict" ? model.result.conflicts[0] : null;
  const invalidControlId = conflict ? conflictControlId(conflict.code) : null;
  const conflictToken = conflict ? `${conflict.code}:${query.section}:${query.from}:${query.to}:${String(query.purchasableOnly)}` : null;

  useEffect(() => {
    if (!conflictToken || !invalidControlId) {
      return;
    }
    focusControl(invalidControlId);
  }, [conflictToken, invalidControlId]);

  return (
    <div className="discovery" data-adapter-environment={model.environment}>
      <nav className="discovery-nav" aria-label={t("sgu")}>
        <a href="#discovery-filters">{t("sla")}</a>
        <a href="#discovery-results">{t("s1gl")}</a>
        <a href="#discovery-scale">{t("s1i9")}</a>
        <a href="#discovery-live">{t("s19d")}</a>
      </nav>
      <div className="discovery-body">
        <DiscoveryBanner model={model} />
        <section className="discovery-section" data-catalog={model.catalog.kind} data-source={model.catalogSource}>
          <h3>{t("sbq")}</h3>
          <CatalogNotice model={model} onReadAgain={onReadAgain} />
        </section>
        <DiscoveryForm query={query} onQuery={onQuery} invalidControlId={invalidControlId} />
        <ResultSection
          model={model}
          query={query}
          focus={safeFocus}
          onFocus={setFocus}
          onQuery={onQuery}
          onOpen={onOpen}
        />
        <ScaleList scaleTotal={model.scaleTotal} onOpen={onOpen} />
        <LiveReadSection model={live.model} handlers={live.handlers} onOpen={onOpen} />
      </div>
    </div>
  );
}

export function DiscoveryDetail({
  model,
  onReadAgain,
  backSearch,
  live,
}: {
  model: DiscoveryModel;
  onReadAgain: () => void;
  backSearch: string;
  live: { model: LiveDetailModel; handlers: LiveDetailHandlers };
}) {
  const t = useT(copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7, copy8, copy9, copy10, copy11, copy12);
  const formatWhen = useFormatWhen();
  const detail = model.detail;
  return (
    <div className="discovery" data-adapter-environment={model.environment}>
      <div className="discovery-body">
        <DiscoveryBanner model={model} />
        <p>
          <Link className="button discovery-action" to={{ pathname: "/discovery", search: backSearch }}>
            {t("s9j")}</Link>
        </p>
        <section className="discovery-section" data-catalog={model.catalog.kind} data-source={model.catalogSource}>
          <h3>{t("sbq")}</h3>
          <CatalogNotice model={model} onReadAgain={onReadAgain} />
        </section>
        {model.missingRow || !detail ? (
          <>
            <p className="empty" data-state="empty">
              {t("syz")}</p>
            <LiveReadDetail model={live.model} handlers={live.handlers} />
          </>
        ) : (
          <article
            className="discovery-detail"
            data-kind={detail.row.kind}
            data-status={detail.row.status}
            data-provenance="synthetic"
            data-source="synthetic-fixture"
            data-stale={detail.facts.stale ? "true" : "false"}
          >
            <p>
              <span className="discovery-badge" data-provenance="synthetic">
                SYNTHETIC
              </span>
            </p>
            <p className="when">
              <time dateTime={detail.row.startsAt}>{deskText(t, formatWhen(detail.row.startsAt))}</time>
            </p>
            <h3>{deskText(t, detail.row.title)}</h3>
            <p className="muted">{deskText(t, detail.row.venueLabel)}</p>
            <p>{deskText(t, detail.facts.kindLine)}</p>
            <p className="discovery-status">{deskText(t, detail.facts.statusLine)}</p>
            {detail.facts.inventoryLine ? <p>{deskText(t, detail.facts.inventoryLine)}</p> : null}
            {detail.facts.countLine ? <p>{deskText(t, detail.facts.countLine)}</p> : null}
            {detail.facts.tierLine ? <p>{deskText(t, detail.facts.tierLine)}</p> : null}
            {detail.facts.resaleLine ? <p>{deskText(t, detail.facts.resaleLine)}</p> : null}
            {detail.facts.stale ? (
              <p>
                <span className="discovery-badge" data-state="stale">
                  STALE
                </span>{" "}
                <time dateTime={detail.row.priceAsOf}>{deskText(t, formatWhen(detail.row.priceAsOf))}</time>
              </p>
            ) : null}
            {detail.row.kind === "resale" ? (
              <p data-state="not-bound" data-source="none">
                {deskText(t, model.resaleNotBoundReason)}
              </p>
            ) : null}
            <PurchasePathView purchase={detail.purchase} />
          </article>
        )}
      </div>
    </div>
  );
}
