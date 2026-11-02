import { SafeText } from "../safe-text";
import { ValidatedForm } from "../forms/ValidatedForm";
import { field } from "../forms/validation";
import { useState } from "react";
import { Link } from "react-router-dom";
import { messages } from "../i18n/messages/resale-market";
import { useT } from "../i18n/desk-context";
import { useResaleMarket } from "../resale-market";
import { AsyncState } from "../components/AsyncState";
import { MarketArt, MarketNotice } from "./ResaleMarketPanels";
import "./resale-market.css";
export function ResaleMarketPage() {
  const t = useT(messages);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { state, controller } = useResaleMarket({ kind: "list", query, page });
  const s = state.snapshot;
  const list = s && s.kind !== "NOT_BOUND" && s.payload.kind === "list" ? s.payload : null;
  return <section className="resale-market">
    <header className="section-head"><p className="eyebrow">KIX</p><h2>{t("market.title")}</h2><MarketNotice /><p className="muted">{t("market.lifetime")}</p></header>
    <ValidatedForm id="market-search-form" fields={[field("market-search","validation.label.filter", { optional: true, maxLength: 100 })]} className="panel market-search" onSubmit={e => { e.preventDefault(); setQuery(draft); setPage(1); }}>
      <label htmlFor="market-search">{t("market.search")}</label><input id="market-search" value={draft} maxLength={100} onChange={e => setDraft(e.target.value)} />
      <button type="submit">{t("market.searchButton")}</button>
    </ValidatedForm>
    {state.readState === "loading" ? <AsyncState label={t("market.title")} announcement="parent" kind="loading" /> : state.readState === "error" ? <AsyncState label={t("market.title")} kind="error" read={{ label: t("market.read"), onRead: () => { void controller.read({ kind: "list", query, page }); } }} /> : state.readState === "not-bound" ? <AsyncState label={t("market.title")} kind="not-bound"><p>{t("market.result.NOT_BOUND")}</p></AsyncState> : null}
    {list?.products.length === 0 ? <AsyncState label={t("market.title")} kind="empty"><p>{t("market.empty")}</p></AsyncState> : null}
    <div role="status" aria-busy={state.readState === "loading"}><ul className="market-grid">{list?.products.map(p => <li key={p.productId}><Link className="market-card" to={`/resale/market/${p.productId}`}><MarketArt artwork={p.artworkKey} /><h3>{t(p.nameKey)}</h3><p>{t(p.descriptionKey)}</p><p className="muted"><SafeText value={p.productId} /></p></Link></li>)}</ul></div>
    <div className="actions">{page > 1 ? <button type="button" onClick={() => setPage(page-1)}>{t("market.previous")}</button> : null}{list?.nextPage ? <button type="button" onClick={() => setPage(list.nextPage ?? page)}>{t("market.next")}</button> : null}</div>
  </section>;
}
