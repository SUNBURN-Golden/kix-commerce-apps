import { onNavigation } from "./shell/navigation-observers";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, type MouseEvent } from "react";
import { useNavigationType } from "react-router-dom";
import type { useMarketReadState } from "./shell/market-read-state";

export const MARKET_RETURN_MEMORY_LIMIT = 16;
type Visit = Pick<ReturnType<typeof useMarketReadState>, "visitKey" | "search" | "query" | "page" | "lang"> & { productId?: string };
export interface MarketReturnEntry {
  listVisitKey: string;
  productVisitKey: string | null;
  search: string;
  query: string;
  page: number;
  lang: Visit["lang"];
  productId: string;
  scrollX: number;
  scrollY: number;
  cardTop: number;
  viewportWidth: number;
  viewportHeight: number;
}
const sameContext = (a: Visit | MarketReturnEntry, b: Visit | MarketReturnEntry) => a.query === b.query && a.page === b.page && a.lang === b.lang;
/** Primitives only, page-load lifetime. No controller, history state or storage evidence. */
export function createMarketReturnMemory() {
  const entries = new Map<string, MarketReturnEntry>();
  let current: Visit | null = null;
  let generation = 0;
  let opening: MarketReturnEntry | null = null;
  let returning: string | null = null;
  let pending: { visitKey: string; entry: MarketReturnEntry } | null = null;
  function remember(entry: MarketReturnEntry) {
    entries.delete(entry.listVisitKey);
    opening = { ...entry };
    entries.set(entry.listVisitKey, opening);
    const oldest = entries.keys().next().value;
    if (entries.size > MARKET_RETURN_MEMORY_LIMIT && oldest !== undefined) entries.delete(oldest);
  }
  return {
    remember,
    get size() { return entries.size; },
    get pending() { return pending; },
    armReturn(visitKey: string) { returning = visitKey; },
    cancel() { pending = null; },
    visit(next: Visit, navigation: string) {
      ++generation;
      if (current?.visitKey === next.visitKey && current.search === next.search && current.productId === next.productId) return;
      const previous = current;
      current = { ...next };
      pending = null;
      const entry = opening;
      opening = null;
      if (entry && sameContext(entry, next)) {
        if (next.productId === entry.productId && previous?.visitKey === entry.listVisitKey) {
          entry.productVisitKey = next.visitKey;
          opening = entry;
        } else if (!next.productId && previous?.visitKey === entry.productVisitKey && previous.productId === entry.productId && ((navigation === "POP" && next.visitKey === entry.listVisitKey) || (navigation === "PUSH" && returning === previous.visitKey))) {
          pending = { visitKey: next.visitKey, entry };
        }
      }
      returning = null;
    },
    depart(pathname: string) {
      if (/^\/resale\/market(?:\/[^/]+)?$/.test(pathname)) return;
      ++generation; current = null; opening = null; returning = null; pending = null;
    },
    leave(visitKey: string) {
      // StrictMode setup claims the generation again. Lazy screens may mount later;
      // the navigation observer, rather than a microtask, rejects unrelated routes.
      const leaving = generation;
      queueMicrotask(() => {
        if (generation !== leaving || current?.visitKey !== visitKey) return;
        pending = null;
      });
    },
  };
}
const memory = createMarketReturnMemory();
onNavigation(() => memory.depart(window.location.pathname));
export const MarketReturnContext = createContext(memory);
function sameTab(event: MouseEvent<HTMLAnchorElement>) {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && (!event.currentTarget.target || event.currentTarget.target === "_self");
}

/** Only marketplace pages import this hook, keeping presentation memory in their lazy bundle. */
export function useMarketReturnFocus(view: Visit, settled = false, cardsReady = false, unavailable = false, readIsCurrent?: () => boolean) {
  const memory = useContext(MarketReturnContext);
  const navigation = useNavigationType();
  const task = useRef({ frame: 0, stop: () => {} });
  const { visitKey, search, query, page, lang, productId } = view;
  useLayoutEffect(() => {
    memory.visit({ visitKey, search, query, page, lang, productId }, navigation);
    const events = ["keydown", "pointerdown", "touchstart", "wheel", "focusin"];
    const detach = () => events.forEach(name => document.removeEventListener(name, cancel, true));
    const cancel = (event: Event) => {
      // Ignore shell focus and trailing keyup/pointerup. Cancel before our own focus.
      if (event.type !== "focusin" || (event.target instanceof Element && event.target.matches("a, button, input, select, textarea, [tabindex], [contenteditable]") && !event.target.matches("#market-results-heading, #desk-main"))) task.current.stop();
    };
    task.current.stop = () => { memory.cancel(); cancelAnimationFrame(task.current.frame); detach(); };
    if (memory.pending) events.forEach(name => document.addEventListener(name, cancel, true));
    return () => {
      memory.leave(visitKey);
      detach();
    };
  }, [memory, visitKey, search, query, page, lang, productId, navigation]);
  useEffect(() => {
    const attempt = memory.pending;
    if (!attempt || attempt.visitKey !== visitKey) return;
    if (unavailable) { task.current.stop(); return; }
    if (!settled) return;
    // Run after shell focus and the matching list's DOM commit. Never focus twice.
    const frame = requestAnimationFrame(() => {
      if (memory.pending !== attempt || (readIsCurrent && !readIsCurrent())) return;
      task.current.stop();
      if (!cardsReady) return;
      const card = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-market-product-id]")).find(node => node.dataset.marketProductId === attempt.entry.productId);
      if (!card) return;
      const e = attempt.entry;
      const rect = card.getBoundingClientRect();
      const top = Math.max(0, Math.min(e.cardTop, innerHeight - rect.height));
      const y = rect.top + scrollY - top;
      card.focus({ preventScroll: true });
      // Native scrollTo clamps to the document bounds; instant overrides smooth CSS.
      window.scrollTo({ left: e.scrollX, top: y, behavior: "instant" });
    });
    task.current.frame = frame;
    return () => cancelAnimationFrame(frame);
  }, [memory, visitKey, search, settled, cardsReady, unavailable, readIsCurrent]);
  return {
    open(event: MouseEvent<HTMLAnchorElement>, id: string) {
      if (!sameTab(event)) return;
      memory.remember({ listVisitKey: visitKey, productVisitKey: null, search, query, page, lang, productId: id, scrollX, scrollY, cardTop: event.currentTarget.getBoundingClientRect().top, viewportWidth: innerWidth, viewportHeight: innerHeight });
    },
    returnToList(event: MouseEvent<HTMLAnchorElement>) { if (sameTab(event)) memory.armReturn(visitKey); },
  };
}
