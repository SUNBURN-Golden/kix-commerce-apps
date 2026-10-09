import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { formatWhen } from "../format";
import { paramsFromQuery, queryFromParams, searchSuffix, type DiscoveryQuery } from "../discovery/model";
import { useDiscoveryWorkspace, type DiscoveryModel } from "../discovery-workspace";
import {
  CatalogNotice,
  DiscoveryBanner,
  DiscoveryForm,
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
  const onQuery = (next: DiscoveryQuery) => {
    setParams(paramsFromQuery(next));
  };
  const onOpen = (id: string) => {
    navigate({ pathname: `/discovery/${encodeURIComponent(id)}`, search: searchSuffix(params) });
  };
  if (selected) {
    return <DiscoveryDetail model={model} onReadAgain={readAgain} backSearch={searchSuffix(params)} />;
  }
  return (
    <DiscoveryScreen model={model} query={query} onQuery={onQuery} onOpen={onOpen} onReadAgain={readAgain} />
  );
}

export function DiscoveryScreen({
  model,
  query,
  onQuery,
  onOpen,
  onReadAgain,
}: {
  model: DiscoveryModel;
  query: DiscoveryQuery;
  onQuery: (next: DiscoveryQuery) => void;
  onOpen: (rowId: string) => void;
  onReadAgain: () => void;
}) {
  const [focus, setFocus] = useState(0);
  const signature = `${model.result.state}:${model.result.page}:${model.result.rows.length}:${query.sort}:${query.pageSize}`;
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setFocus(0);
  }
  const count = model.result.rows.length;
  const safeFocus = count === 0 ? 0 : Math.min(focus, count - 1);

  return (
    <div className="discovery" data-adapter-environment={model.environment}>
      <nav className="discovery-nav" aria-label="Discovery sections">
        <a href="#discovery-filters">Filters</a>
        <a href="#discovery-results">Results</a>
        <a href="#discovery-scale">Scale</a>
      </nav>
      <div className="discovery-body">
        <DiscoveryBanner model={model} />
        <section className="discovery-section" data-catalog={model.catalog.kind} data-source={model.catalogSource}>
          <h3>Catalogue read</h3>
          <CatalogNotice model={model} onReadAgain={onReadAgain} />
        </section>
        <DiscoveryForm query={query} onQuery={onQuery} />
        <ResultSection
          model={model}
          query={query}
          focus={safeFocus}
          onFocus={setFocus}
          onQuery={onQuery}
          onOpen={onOpen}
        />
        <ScaleList scaleTotal={model.scaleTotal} onOpen={onOpen} />
      </div>
    </div>
  );
}

export function DiscoveryDetail({
  model,
  onReadAgain,
  backSearch,
}: {
  model: DiscoveryModel;
  onReadAgain: () => void;
  backSearch: string;
}) {
  const detail = model.detail;
  return (
    <div className="discovery" data-adapter-environment={model.environment}>
      <div className="discovery-body">
        <DiscoveryBanner model={model} />
        <p>
          <Link className="button discovery-action" to={{ pathname: "/discovery", search: backSearch }}>
            Back to results
          </Link>
        </p>
        <section className="discovery-section" data-catalog={model.catalog.kind} data-source={model.catalogSource}>
          <h3>Catalogue read</h3>
          <CatalogNotice model={model} onReadAgain={onReadAgain} />
        </section>
        {model.missingRow || !detail ? (
          <p className="empty" data-state="empty">
            No synthetic row for this id.
          </p>
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
            <p className="when">{formatWhen(detail.row.startsAt)}</p>
            <h3>{detail.row.title}</h3>
            <p className="muted">{detail.row.venueLabel}</p>
            <p>{detail.facts.kindLine}</p>
            <p className="discovery-status">{detail.facts.statusLine}</p>
            {detail.facts.inventoryLine ? <p>{detail.facts.inventoryLine}</p> : null}
            {detail.facts.countLine ? <p>{detail.facts.countLine}</p> : null}
            {detail.facts.tierLine ? <p>{detail.facts.tierLine}</p> : null}
            {detail.facts.resaleLine ? <p>{detail.facts.resaleLine}</p> : null}
            {detail.facts.stale ? (
              <p>
                <span className="discovery-badge" data-state="stale">
                  STALE
                </span>{" "}
                <time dateTime={detail.row.priceAsOf}>{formatWhen(detail.row.priceAsOf)}</time>
              </p>
            ) : null}
            {detail.row.kind === "resale" ? (
              <p data-state="not-bound" data-source="none">
                {model.resaleNotBoundReason}
              </p>
            ) : null}
            <PurchasePathView purchase={detail.purchase} />
          </article>
        )}
      </div>
    </div>
  );
}
