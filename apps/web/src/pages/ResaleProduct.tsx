import { Link, useParams } from "react-router-dom";
import { useT } from "../i18n/desk-context";
import { messages } from "../i18n/messages/resale-market";
import { useResaleMarket } from "../resale-market";
import { AsyncState } from "../components/AsyncState";
import { MarketNotice, ProductPanels } from "./ResaleMarketPanels";
import "./resale-market.css";
export function ResaleProductPage() {
  const { productId = "" } = useParams();
  const t = useT(messages);
  const market = useResaleMarket({ kind: "detail", productId });
  const d = market.controller.detail();
  return <section className="resale-market">
    <header className="section-head"><h2>{t("market.product")}</h2><MarketNotice /></header>
    <Link to="/resale/market">{t("market.title")}</Link>
    {market.state.readState === "loading" && !d ? <AsyncState label={t("market.title")} kind="loading" /> : null}
    {market.state.readState === "error" ? <AsyncState label={t("market.title")} kind="error" read={{ label: t("market.read"), onRead: () => { void market.controller.read({ kind: "detail", productId }); } }} /> : null}
    {market.state.readState === "not-bound" ? <AsyncState label={t("market.title")} kind="not-bound"><p>{t("market.result.NOT_BOUND")}</p></AsyncState> : null}
    {market.state.readState === "stale" ? <AsyncState label={t("market.title")} kind="stale" read={{ label: t("market.read"), onRead: () => { void market.controller.read({ kind: "detail", productId }); } }} /> : null}
    {market.state.readState === "empty" ? <AsyncState label={t("market.title")} kind="empty"><p>{t("market.missing")}</p></AsyncState> : null}
    {d ? <ProductPanels key={d.product.productId} detail={d} market={market} /> : null}
  </section>;
}
