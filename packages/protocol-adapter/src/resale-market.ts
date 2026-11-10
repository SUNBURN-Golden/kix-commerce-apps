/** App-internal synthetic interface. Producer mappings are UNDETERMINED. No protocol command. */
export const MARKET_CLAIMS = { source: "synthetic", unit: "mock-unit", fundsExecuted: false, economicFinalityClaimed: false, productionEndpoint: false, protocolTruth: false, productionConformance: false } as const;
type Claims = typeof MARKET_CLAIMS;
export type ResaleMarketRead = { kind: "list"; query: string; page: number } | { kind: "detail"; productId: string };
export interface ResaleMarketProduct { productId: string; nameKey: "market.orbit" | "market.fold" | "market.arc"; descriptionKey: "market.description"; artworkKey: "orbit" | "fold" | "arc"; variantIds: ("standard" | "wide")[] }
export interface ResaleMarketQuote { quoteId: string; productId: string; variantId: string; side: "bid" | "ask"; mockUnits: string; version: number; available: boolean }
export interface ResaleMarketOffer { offerId: string; productId: string; variantId: string; side: "bid" | "ask"; mockUnits: string; state: "open" }
export interface ResaleMarketTrade { tradeId: string; productId: string; variantId: string; mockUnits: string; occurredAt: string; state: "simulated" }
export interface ResaleMarketPricePoint { occurredAt: string; mockUnits: string }
export interface ResaleMarketDetail extends Claims { product: ResaleMarketProduct; version: number; quotes: ResaleMarketQuote[]; offers: ResaleMarketOffer[]; trades: ResaleMarketTrade[]; series: ResaleMarketPricePoint[] }
export type ResaleMarketIntent = { productId: string; variantId: string; expectedVersion: number } & ({ kind: "bid"; mockUnits: string } | { kind: "ask"; mockUnits: string } | { kind: "instant-buy"; quoteId: string } | { kind: "instant-sell"; quoteId: string });
export const MARKET_REJECTIONS = ["INVALID_INPUT", "PRODUCT_MISSING", "VARIANT_MISSING", "STALE_VERSION", "QUOTE_UNAVAILABLE", "QUOTE_MISMATCH"] as const;
export type MarketRejection = typeof MARKET_REJECTIONS[number];
export type ResaleMarketReadResult = Claims & ({ kind: "ready" | "empty"; request: ResaleMarketRead; payload: { kind: "list"; products: ResaleMarketProduct[]; page: number; pageSize: 2; total: number; nextPage: number | null } | { kind: "detail"; detail: ResaleMarketDetail | null } } | { kind: "NOT_BOUND" });
export type ResaleMarketWriteResult = Claims & ({ kind: "CONFIRMED"; request: ResaleMarketIntent; version: number; record: ResaleMarketOffer | ResaleMarketTrade } | { kind: "REJECTED"; request: ResaleMarketIntent; code: MarketRejection } | { kind: "NOT_BOUND" });
export interface ResaleMarketPort { read(input: ResaleMarketRead): Promise<ResaleMarketReadResult>; submit(input: ResaleMarketIntent): Promise<ResaleMarketWriteResult> }
export const canonicalUnits = (s: unknown): s is string => typeof s === "string" && /^(0|[1-9][0-9]{0,29})$/.test(s);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 100;
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
/** Capture only validated own data fields; no accessor or caller-owned object escapes. */
export function captureMarketIntent(value: unknown): ResaleMarketIntent | null {
  try {
    if (!obj(value)) return null;
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== 5) return null;
    const fields: Record<PropertyKey, unknown> = Object.create(null);
    for (const key of ownKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) return null;
      fields[key] = descriptor.value;
    }
    const offer = fields.kind === "bid" || fields.kind === "ask";
    if (!offer && fields.kind !== "instant-buy" && fields.kind !== "instant-sell") return null;
    const identifier = (v: unknown) => str(v) && /\S/.test(v);
    // Five keys and five valid required values exclude any extra or missing key.
    const valid = identifier(fields.productId) && identifier(fields.variantId) && integer(fields.expectedVersion) && integer(fields.expectedVersion + 1) && (offer ? canonicalUnits(fields.mockUnits) : identifier(fields.quoteId));
    return valid ? fields as ResaleMarketIntent : null;
  } catch { return null; }
}
/** App-internal total guard for shape inspection; not a package entrypoint export. */
export function validMarketIntent(value: unknown): value is ResaleMarketIntent { return captureMarketIntent(value) !== null; }
const time = (v: unknown): v is string => typeof v === "string" && /^2026-11-0[1-9]T\d{2}:\d{2}:\d{2}Z$/.test(v) && Number.isFinite(Date.parse(v));
function claims(v: unknown): boolean {
  if (!obj(v)) return false;
  if (!Object.entries(MARKET_CLAIMS).every(([k, x]) => v[k] === x)) return false;
  // Refuse any nested claim, even an extra claim beside an otherwise valid record.
  const safe = (x: unknown): boolean => !obj(x) && !Array.isArray(x) || Object.entries(x as object).every(([k,y]) => (!(k in MARKET_CLAIMS) || y === MARKET_CLAIMS[k as keyof Claims]) && (typeof y !== "object" || y === null || safe(y)));
  return safe(v);
}
const keys = (v: Record<string, unknown>, names: string[]) => Object.keys(v).every(k => names.includes(k));
const claimKeys = Object.keys(MARKET_CLAIMS);
const unique = (values: unknown[]) => new Set(values).size === values.length;
function product(v: unknown): v is ResaleMarketProduct {
  return obj(v) && keys(v,["productId","nameKey","descriptionKey","artworkKey","variantIds"]) && str(v.productId) && ["orbit", "fold", "arc"].includes(String(v.artworkKey)) && v.nameKey === `market.${v.artworkKey}` && v.descriptionKey === "market.description" && Array.isArray(v.variantIds) && v.variantIds.length > 0 && v.variantIds.every(x => ["standard", "wide"].includes(x)) && unique(v.variantIds);
}
function record(v: unknown, p: ResaleMarketProduct, trade: boolean): boolean {
  return obj(v) && keys(v,trade ? ["tradeId","productId","variantId","mockUnits","occurredAt","state"] : ["offerId","productId","variantId","side","mockUnits","state"]) && v.productId === p.productId && p.variantIds.some(x => x === v.variantId) && canonicalUnits(v.mockUnits) && (trade ? str(v.tradeId) && v.state === "simulated" && time(v.occurredAt) : str(v.offerId) && v.state === "open" && ["bid","ask"].includes(String(v.side)));
}
export function validMarketDetail(v: unknown): v is ResaleMarketDetail {
  if (!obj(v) || !claims(v) || !keys(v,[...claimKeys,"product","version","quotes","offers","trades","series"]) || !product(v.product) || !integer(v.version)) return false;
  const p = v.product;
  return Array.isArray(v.quotes) && v.quotes.length === p.variantIds.length * 2 && unique(v.quotes.map(q => obj(q) ? q.quoteId : null)) && unique(v.quotes.map(q => obj(q) ? `${q.variantId}:${q.side}` : "")) && v.quotes.every(q => obj(q) && keys(q,["quoteId","productId","variantId","side","mockUnits","version","available"]) && str(q.quoteId) && q.productId === p.productId && p.variantIds.some(x => x === q.variantId) && ["bid","ask"].includes(String(q.side)) && canonicalUnits(q.mockUnits) && q.version === v.version && typeof q.available === "boolean") && Array.isArray(v.offers) && v.offers.every(x => record(x,p,false)) && Array.isArray(v.trades) && v.trades.every(x => record(x,p,true)) && Array.isArray(v.series) && v.series.every(x => obj(x) && keys(x,["occurredAt","mockUnits"]) && canonicalUnits(x.mockUnits) && time(x.occurredAt));
}
export function validMarketRead(v: unknown, input: ResaleMarketRead): v is ResaleMarketReadResult {
  if (!obj(v) || !claims(v)) return false;
  if (v.kind === "NOT_BOUND") return keys(v,[...claimKeys,"kind"]);
  if (!keys(v,[...claimKeys,"kind","request","payload"]) || !["ready","empty"].includes(String(v.kind)) || !same(v.request,input) || !obj(v.payload)) return false;
  const p = v.payload;
  if (input.kind === "detail") return p.kind === "detail" && (p.detail === null ? v.kind === "empty" : validMarketDetail(p.detail) && p.detail.product.productId === input.productId && v.kind === "ready");
  return p.kind === "list" && Array.isArray(p.products) && p.products.length <= 2 && p.products.every(product) && p.page === input.page && p.pageSize === 2 && integer(p.total) && (p.nextPage === null || p.nextPage === input.page + 1 && p.total > input.page * 2) && (v.kind === "empty") === (p.products.length === 0);
}
export function intentRejection(i: ResaleMarketIntent, d: ResaleMarketDetail): MarketRejection | null {
  const request = captureMarketIntent(i);
  if (!request) return "INVALID_INPUT";
  i = request;
  if (i.productId !== d.product.productId) return "PRODUCT_MISSING";
  if (!d.product.variantIds.some(x => x === i.variantId)) return "VARIANT_MISSING";
  if (i.expectedVersion !== d.version) return "STALE_VERSION";
  if (i.kind === "bid" || i.kind === "ask") return null;
  const q = d.quotes.find(x => x.quoteId === i.quoteId);
  if (!q || q.productId !== i.productId || q.variantId !== i.variantId || q.version !== d.version || q.side !== (i.kind === "instant-buy" ? "ask" : "bid")) return "QUOTE_MISMATCH";
  return q.available ? null : "QUOTE_UNAVAILABLE";
}
export function validMarketWrite(v: unknown, i: ResaleMarketIntent, d: ResaleMarketDetail): v is ResaleMarketWriteResult {
  if (!obj(v) || !claims(v)) return false;
  if (v.kind === "NOT_BOUND") return keys(v,[...claimKeys,"kind"]);
  if (!keys(v,[...claimKeys,"kind","request",...(v.kind === "CONFIRMED" ? ["version","record"] : ["code"])]) || !same(v.request,i)) return false;
  if (v.kind === "REJECTED") return MARKET_REJECTIONS.includes(v.code as MarketRejection);
  if (v.kind !== "CONFIRMED" || v.version !== i.expectedVersion + 1 || intentRejection(i,d) !== null || !obj(v.record) || v.record.variantId !== i.variantId) return false;
  const r = v.record;
  if (i.kind === "bid" || i.kind === "ask") return record(r,d.product,false) && r.side === i.kind && r.mockUnits === i.mockUnits && !d.offers.some(x => x.offerId === r.offerId);
  return record(r,d.product,true) && r.mockUnits === d.quotes.find(q => q.quoteId === i.quoteId)?.mockUnits && !d.trades.some(x => x.tradeId === r.tradeId);
}
const copy = <T>(v: T): T => structuredClone(v);
export function createMockResaleMarket(): ResaleMarketPort {
  let seq = 0;
  const details: ResaleMarketDetail[] = (["orbit","fold","arc"] as const).map((artworkKey, n) => {
    const productId = `demo-00${n+1}`;
    const p: ResaleMarketProduct = { productId, artworkKey, nameKey: `market.${artworkKey}`, descriptionKey: "market.description", variantIds: ["standard","wide"] };
    return { ...MARKET_CLAIMS, product: p, version: 0, quotes: p.variantIds.flatMap(variantId => (["bid","ask"] as const).map(side => ({ quoteId: `${productId}-${variantId}-${side}`, productId, variantId, side, mockUnits: side === "ask" ? "120" : "100", version: 0, available: !(n === 2 && side === "bid") }))), offers: [], trades: [{ tradeId: `${productId}-fixture`, productId, variantId: "standard", mockUnits: "110", occurredAt: "2026-11-01T12:00:00Z", state: "simulated" }], series: ["108","115","110","118","112","120"].map((mockUnits,j) => ({ mockUnits, occurredAt: `2026-11-0${j+1}T12:00:00Z` })) };
  });
  return {
    async read(input) {
      if (input.kind === "list" && (!integer(input.page) || input.page < 1 || input.query.length > 100)) throw new Error("INVALID_INPUT");
      if (input.kind === "detail") { const detail = details.find(d => d.product.productId === input.productId) ?? null; return copy({ ...MARKET_CLAIMS, kind: detail ? "ready" : "empty", request: input, payload: { kind: "detail", detail } }); }
      const hits = details.map(d => d.product).filter(p => `${p.productId} ${p.artworkKey} object ${p.artworkKey === "orbit" ? "궤도 오브제" : p.artworkKey === "fold" ? "접힘 오브제" : "아치 오브제"}`.includes(input.query.trim().toLowerCase()));
      const products = hits.slice((input.page-1)*2,input.page*2);
      return copy({ ...MARKET_CLAIMS, kind: products.length ? "ready" : "empty", request: input, payload: { kind: "list", products, page: input.page, pageSize: 2, total: hits.length, nextPage: input.page*2 < hits.length ? input.page+1 : null } });
    },
    async submit(input) {
      // Capture before lookup or allocation; malformed calls have no request identity.
      const request = captureMarketIntent(input);
      if (!request) throw new Error("INVALID_INPUT");
      input = request;
      const d = details.find(x => x.product.productId === input.productId);
      const code = d ? intentRejection(input,d) : "PRODUCT_MISSING";
      if (code || !d) return { ...MARKET_CLAIMS, kind: "REJECTED", request: input, code: code ?? "PRODUCT_MISSING" };
      const scope = { productId: input.productId, variantId: input.variantId };
      let item: ResaleMarketOffer | ResaleMarketTrade;
      switch (input.kind) {
        case "bid":
        case "ask":
          item = { offerId: `offer-${++seq}`, ...scope, side: input.kind, mockUnits: input.mockUnits, state: "open" };
          d.offers.push(item);
          break;
        case "instant-buy":
        case "instant-sell": {
          const q = d.quotes.find(x => x.quoteId === input.quoteId);
          if (!q) throw new Error("INVALID_INPUT");
          q.available = false;
          item = { tradeId: `trade-${++seq}`, ...scope, mockUnits: q.mockUnits, occurredAt: "2026-11-07T12:00:00Z", state: "simulated" };
          d.trades.push(item);
          break;
        }
        default: throw new Error("INVALID_INPUT");
      }
      d.version++; d.quotes.forEach(q => { q.version = d.version; });
      return copy({ ...MARKET_CLAIMS, kind: "CONFIRMED", request: input, version: d.version, record: item });
    },
  };
}
/** The validated environment is supplied by the app's existing selection. No fallback or dispatch. */
export function resaleMarketPortFor(environment: "stub" | "integration-http"): ResaleMarketPort {
  if (environment === "stub") return createMockResaleMarket();
  return { async read() { return { ...MARKET_CLAIMS, kind: "NOT_BOUND" }; }, async submit() { return { ...MARKET_CLAIMS, kind: "NOT_BOUND" }; } };
}
