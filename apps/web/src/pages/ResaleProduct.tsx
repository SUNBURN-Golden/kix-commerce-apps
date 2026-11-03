import { Link, useParams } from "react-router-dom";
import { useT } from "../i18n/desk-context";
import { messages } from "../i18n/messages/resale-market";
import { useResaleMarket } from "../resale-market";
import { AsyncState } from "../components/AsyncState";
import { MarketNotice, MarketReadStatus, ProductPanels } from "./ResaleMarketPanels";
import "./resale-market.css";
import { useMarketReadState } from "../shell/market-read-state";
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
