import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { parseLocale, type Locale } from "../i18n/locales";

export interface MarketReadState { query: string; page: number; lang: Locale | null }

/** App-internal read context only. Identifier validators on other desks stay restricted. */
export function parseMarketReadState(search: string) {
  const params = new URLSearchParams(search);
  const single = (key: string) => params.getAll(key).length === 1;
  const raw = params.get("q") ?? "";
  const badQuery = params.has("q") && (!single("q") || raw.length > 100 || /[\p{Cc}\p{Cs}\uFFFD]/u.test(raw));
  const rawPage = params.get("page") ?? "1";
  const badPage = params.has("page") && (!single("page") || !/^[1-9][0-9]*$/.test(rawPage) || !Number.isSafeInteger(Number(rawPage)));
  const lang = single("lang") ? parseLocale(params.get("lang")) : null;
  const value: MarketReadState = { query: badQuery ? "" : raw.trim(), page: badQuery || badPage ? 1 : Number(rawPage), lang };
  const invalid = badQuery || badPage || (params.has("lang") && !lang) || [...params.keys()].some(key => !["q", "page", "lang"].includes(key));
  return { ...value, invalid, search: marketReadSearch(value) };
}

function marketReadSearch(value: MarketReadState): string {
  const params = new URLSearchParams();
  if (value.lang) params.set("lang", value.lang);
  if (value.query) params.set("q", value.query);
  if (value.page !== 1) params.set("page", String(value.page));
  return params.size ? `?${params}` : "";
}

export function useMarketReadState() {
  const location = useLocation();
  const navigate = useNavigate();
  const parsed = parseMarketReadState(location.search);
  // History holds only this display notice. No synthetic trading evidence is persisted.
  const notice = location.state?.marketReadNotice === true || parsed.invalid || Boolean(location.hash);
  useEffect(() => {
    if (parsed.search === location.search && !location.hash) return;
    void navigate({ search: parsed.search }, { replace: true, state: { marketReadNotice: notice } });
  }, [parsed.search, location.search, location.hash, notice, navigate]);
  return {
    ...parsed,
    visitKey: location.key,
    notice,
    commit(query: string, page: number, replace = false) {
      // Revalidate even values from controls. Never serialize a raw query string.
      const next = parseMarketReadState(marketReadSearch({ query, page, lang: parsed.lang }));
      if (next.search !== parsed.search) void navigate({ search: next.search }, { replace, state: { marketReadNotice: replace } });
    },
  };
}
