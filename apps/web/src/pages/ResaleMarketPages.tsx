// Share resale route shells in their lazy bundle to preserve the existing total gzip ceiling.
import { SafeText } from "../safe-text";
import { ValidatedForm } from "../forms/ValidatedForm";
import { field } from "../forms/validation";
import { messages } from "../i18n/messages/resale-market";
import { useT } from "../i18n/desk-context";
import { useResaleMarket } from "../resale-market";
import { AsyncState } from "../components/AsyncState";
import { useMarketReadState } from "../shell/market-read-state";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MarketArt, MarketNotice, MarketReadStatus, ProductPanels } from "./ResaleMarketPanels";
export function ResaleMarketPage() {
  const t = useT(messages);
  const view = useMarketReadState();
  const { query, page, visitKey } = view;
  const [draft, setDraft] = useState(query);
  useEffect(() => { setDraft(query); }, [query, visitKey]);
  const market = useResaleMarket({ kind: "list", query, page });
  const { state } = market;
  const s = state.snapshot;
  const list = s && s.kind !== "NOT_BOUND" && s.request.kind === "list" && s.request.query === query && s.request.page === page && s.payload.kind === "list" ? s.payload : null;
  const unavailable = list && state.freshness === "CURRENT" && (state.readState === "ready" || state.readState === "empty") && page > Math.max(1, Math.ceil(list.total / list.pageSize));
  useEffect(() => { if (unavailable) view.commit(query, 1, true); }, [unavailable, view, query]);
  return <section className="resale-market">
    <header className="section-head"><p className="eyebrow">KIX</p><h2>{t("market.title")}</h2><MarketNotice /><p className="muted">{t("market.lifetime")}</p></header>
    {view.notice ? <p role="status" data-market-read-notice>{t("market.readNotice")}</p> : null}
    <ValidatedForm id="market-search-form" fields={[field("market-search","validation.label.filter", { optional: true, maxLength: 100 })]} className="panel market-search" onSubmit={e => { e.preventDefault(); view.commit(draft, 1); setDraft(draft.trim()); }}>
      <label htmlFor="market-search">{t("market.search")}</label><input id="market-search" value={draft} maxLength={100} onChange={e => setDraft(e.target.value)} />
      <button type="submit">{t("market.searchButton")}</button>
    </ValidatedForm>
    <MarketReadStatus market={market} input={{ kind: "list", query, page }} list />
    {list?.products.length === 0 ? <AsyncState label={t("market.title")} kind="empty"><p>{t("market.empty")}</p></AsyncState> : null}
    <div role="status" aria-busy={state.readState === "loading"}><ul className="market-grid">{list?.products.map(p => <li key={p.productId}><Link className="market-card" to={`/resale/market/${encodeURIComponent(p.productId)}${view.search}`}><MarketArt artwork={p.artworkKey} /><h3>{t(p.nameKey)}</h3><p>{t(p.descriptionKey)}</p><p className="muted"><SafeText value={p.productId} /></p></Link></li>)}</ul></div>
    <div className="actions">{page > 1 ? <button type="button" onClick={() => view.commit(query, page-1)}>{t("market.previous")}</button> : null}{list?.nextPage ? <button type="button" onClick={() => view.commit(query, list.nextPage ?? page)}>{t("market.next")}</button> : null}</div>
  </section>;
}

export function ResaleProductPage() {
  const { productId = "" } = useParams();
  const t = useT(messages);
  const view = useMarketReadState();
  const market = useResaleMarket({ kind: "detail", productId });
  const d = market.controller.detail();
  return <section className="resale-market">
    <header className="section-head"><h2>{t("market.product")}</h2><MarketNotice /></header>
    {view.notice ? <p role="status" data-market-read-notice>{t("market.readNotice")}</p> : null}
    <Link to={`/resale/market${view.search}`}>{t("market.title")}</Link>
    <MarketReadStatus market={market} input={{ kind: "detail", productId }} />
    {market.state.readState === "empty" ? <AsyncState label={t("market.title")} kind="empty"><p>{t("market.missing")}</p></AsyncState> : null}
    {d ? <ProductPanels key={d.product.productId} detail={d} market={market} /> : null}
  </section>;
}
