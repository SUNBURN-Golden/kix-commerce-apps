import { StatusMark } from "../a11y/marks";
import { SafeText } from "../safe-text";
import { useEffect, useRef, useState } from "react";
import { messages } from "../i18n/messages/resale-market";
import { useT } from "../i18n/desk-context";
import { useLocale } from "../i18n/locale-context";
import { formatUnits, formatWhen } from "../format";
import { ValidatedForm } from "../forms/ValidatedForm";
import { field } from "../forms/validation";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { AsyncState } from "../components/AsyncState";
import type { ResaleMarketRead, ResaleMarketIntent } from "../../../../packages/protocol-adapter/src/resale-market";
import type { ResaleMarketController } from "../../../../packages/protocol-adapter/src/resale-market-controller";
import type { useResaleMarket } from "../resale-market";
type MarketDetail = NonNullable<ReturnType<ResaleMarketController["detail"]>>;
export function MarketNotice() { const t = useT(messages); return <p className="market-notice">{t("market.notice")}</p>; }
/** Shared read feedback keeps list/detail failure semantics and retry controls aligned. */
export function MarketReadStatus({ market, input, list = false }: { market: ReturnType<typeof useResaleMarket>; input: ResaleMarketRead; list?: boolean }) {
  const t = useT(messages);
  const kind = market.state.readState;
  if (kind === "loading" && (list || !market.controller.detail())) return <AsyncState label={t("market.title")} announcement={list ? "parent" : undefined} kind="loading" />;
  if (kind === "error" || (!list && kind === "stale")) return <AsyncState label={t("market.title")} kind={kind} read={{ label: t("market.read"), onRead: () => { void market.controller.read(input); } }} />;
  if (kind === "not-bound") return <AsyncState label={t("market.title")} kind="not-bound"><p>{t("market.result.NOT_BOUND")}</p></AsyncState>;
  return null;
}
/** Original code-native artwork, decorative beside the product's textual name. */
export function MarketArt({ artwork }: { artwork: string }) {
  return <div className={`market-art market-art-${artwork}`} aria-hidden="true"><svg viewBox="0 0 320 240" focusable="false"><path d={artwork === "orbit" ? "M60 120a100 55 0 1 0 200 0a100 55 0 1 0-200 0M160 35v170" : artwork === "fold" ? "M65 170L160 45l95 125H65l95-45 95 45M160 45v80" : "M70 190V110a90 90 0 0 1 180 0v80h-45v-80a45 45 0 0 0-90 0v80Z"} /></svg></div>;
}
export function PriceChart({ series }: { series: MarketDetail["series"] }) {
  const t = useT(messages); const { clock } = useLocale();
  // Coordinate arithmetic is presentation only. Original exact digits stay in the equivalent table.
  const values = series.map(p => BigInt(p.mockUnits));
  const min = values.reduce((a,b) => a < b ? a : b, values[0] ?? 0n);
  const max = values.reduce((a,b) => a > b ? a : b, values[0] ?? 0n);
  const points = values.map((v,i) => `${20+i*560/Math.max(1,values.length-1)},${160-Number((v-min)*120n/(max-min || 1n))}`).join(" ");
  return <section className="panel"><h3>{t("market.chart")}</h3><MarketNotice />
    <svg className="market-chart" viewBox="0 0 600 190" role="img" aria-label={t("market.chart")}><path d="M20 20v150h560" /><polyline points={points} />{values.length === 1 ? <circle cx="20" cy="160" r="4" /> : null}</svg>
    <details><summary>{t("market.chart")}</summary><table><caption>{t("market.notice")}</caption><thead><tr><th scope="col">{t("market.date")}</th><th scope="col">{t("market.units")}</th></tr></thead><tbody>{series.map(p => <tr key={p.occurredAt}><td>{formatWhen(p.occurredAt,clock)}</td><td>{formatUnits(p.mockUnits,t("amount.mockUnits"),clock)}</td></tr>)}</tbody></table></details>
    {series.length === 0 ? <p>{t("market.noRows")}</p> : null}
  </section>;
}
export function ProductPanels({ detail: d, market }: { detail: MarketDetail; market: ReturnType<typeof useResaleMarket> }) {
  const t = useT(messages); const { clock } = useLocale();
  const [variant, setVariant] = useState<string>(d.product.variantIds[0] ?? "standard");
  const [kind, setKind] = useState<ResaleMarketIntent["kind"]>("instant-buy");
  const [units, setUnits] = useState("115");
  const [review, setReview] = useState<ResaleMarketIntent | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    if (market.state.outcome && market.state.outcome !== "IN_FLIGHT") {
      resultRef.current?.focus();
      if (market.state.outcome === "REJECTED") setRefused(true);
    }
  }, [market.state.outcome]);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const quote = d.quotes.find(q => q.variantId === variant && q.side === (kind === "instant-buy" ? "ask" : "bid"));
  const instant = kind === "instant-buy" || kind === "instant-sell";
  const unavailable = instant && !quote?.available;
  const blocked = market.state.fenced || market.state.outcome === "IN_FLIGHT" || market.state.freshness !== "CURRENT";
  const trades = d.trades.filter(x => x.variantId === variant);
  const offers = d.offers.filter(x => x.variantId === variant);
  useEffect(() => { if (review) reviewHeading.current?.focus(); }, [review]);
  function preview() {
    if (blocked || unavailable) return;
    const base = { productId: d.product.productId, variantId: variant, expectedVersion: d.version };
    setReview(kind === "bid" || kind === "ask" ? { ...base, kind, mockUnits: units } : { ...base, kind, quoteId: quote?.quoteId ?? "" });

  }
  async function submit() {
    if (!review || blocked) return;
    await market.actions.submit(review);
    setReview(null);
    if (market.controller.state().outcome === "CONFIRMED" || market.controller.state().outcome === "REJECTED") await market.controller.read({ kind: "detail", productId: d.product.productId });
  }
  return <>
    <div className="market-detail"><MarketArt artwork={d.product.artworkKey} /><div className="panel">
      <h3>{t(d.product.nameKey)}</h3><p>{t(d.product.descriptionKey)}</p>
      <p className="muted"><SafeText value={d.product.productId} /> · {d.version}</p>
      <dl className="market-quotes">{(["ask","bid"] as const).map(side => { const q = d.quotes.find(x => x.variantId === variant && x.side === side); return <div key={side}><dt>{t(side === "ask" ? "market.instant-buy" : "market.instant-sell")}</dt><dd>{q?.available ? formatUnits(q.mockUnits,t("amount.mockUnits"),clock) : t("market.unavailable")}</dd></div>; })}</dl>
      {review ? <div className="market-review"><StatusMark kind="review" /><h4 tabIndex={-1} ref={reviewHeading}>{t("market.review")}</h4><MarketNotice /><p>{t(`market.${review.kind}`)} · {t(review.variantId === "wide" ? "market.wide" : "market.standard")}</p><p>{formatUnits("mockUnits" in review ? review.mockUnits : d.quotes.find(q => q.quoteId === review.quoteId)?.mockUnits ?? "",t("amount.mockUnits"),clock)}</p><p className="muted">{review.expectedVersion}</p><div className="actions"><button type="button" disabled={blocked} onClick={() => setReview(null)}>{t("market.back")}</button><ConnectivityWriteButton type="button" disabled={blocked} onClick={() => void submit()}>{t("market.confirm")}</ConnectivityWriteButton></div></div> :
      <ValidatedForm id="market-trade-form" fields={instant ? [] : [field("market-units","validation.label.mockUnits", { kind: "integer", maxLength: 15 })]} busy={blocked} onSubmit={preview}>
        <MarketNotice /><label htmlFor="market-variant">{t("market.variant")}</label><select id="market-variant" value={variant} onChange={e => { setVariant(e.target.value); setRefused(false); }}>{d.product.variantIds.map(v => <option key={v} value={v}>{t(`market.${v}`)}</option>)}</select>
        <label htmlFor="market-action">{t("market.action")}</label><select id="market-action" value={kind} onChange={e => { setKind(e.target.value as typeof kind); setRefused(false); }}>{(["instant-buy","instant-sell","bid","ask"] as const).map(k => <option key={k} value={k}>{t(`market.${k}`)}</option>)}</select>
        {!instant ? <label htmlFor="market-units">{t("market.units")}<input id="market-units" inputMode="numeric" value={units} maxLength={15} onChange={e => { setUnits(e.target.value); setRefused(false); }} /></label> : null}
        {unavailable ? <p id="market-unavailable">{t("market.unavailable")}</p> : null}
        <ConnectivityWriteButton type="submit" disabled={blocked || unavailable || refused} aria-describedby={unavailable ? "market-unavailable" : market.state.freshness !== "CURRENT" && !market.state.fenced ? "market-stale" : blocked || refused ? "market-outcome" : undefined}>{t("market.review")}</ConnectivityWriteButton>
      </ValidatedForm>}
      <div id="market-outcome" ref={resultRef} tabIndex={-1} role="status" aria-busy={market.state.outcome === "IN_FLIGHT"} aria-atomic="true" data-market-outcome={market.state.outcome ?? ""}>{market.state.outcome ? <><p>{t(`market.result.${market.state.outcome}`)}</p><MarketNotice /><p><SafeText value={market.state.code} /></p></> : null}</div>
      {market.state.freshness !== "CURRENT" && !market.state.fenced ? <p id="market-stale">{t("market.stale")}</p> : null}
      {market.state.fenced ? <AsyncState label={t("market.title")} announcement="parent" kind="unknown" /> : null}
      <button type="button" disabled={market.state.outcome === "IN_FLIGHT"} onClick={() => { setReview(null); void market.controller.read({ kind: "detail", productId: d.product.productId }); }}>{t("market.read")}</button>
    </div></div>
    <PriceChart series={d.series} />
    <section className="panel"><h3>{t("market.history")}</h3><MarketNotice /><div className="table-scroll"><table><caption>{t("market.history")}</caption><thead><tr><th scope="col">{t("market.date")}</th><th scope="col">{t("market.units")}</th><th scope="col">{t("market.state")}</th></tr></thead><tbody>{trades.map(x => <tr key={x.tradeId}><td>{formatWhen(x.occurredAt,clock)}</td><td>{formatUnits(x.mockUnits,t("amount.mockUnits"),clock)}</td><td>{t("market.simulated")}</td></tr>)}</tbody></table></div>{!trades.length ? <p>{t("market.noRows")}</p> : null}</section>
    <section className="panel"><h3>{t("market.offers")}</h3><MarketNotice /><ul>{offers.map(x => <li key={x.offerId}>{t(`market.${x.side}`)} · {formatUnits(x.mockUnits,t("amount.mockUnits"),clock)} · {t("market.open")}</li>)}</ul>{!offers.length ? <p>{t("market.noRows")}</p> : null}</section>
  </>;
}
