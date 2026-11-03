import { useState } from "react";
import { useT } from "../i18n/desk-context";
import { useLocale } from "../i18n/locale-context";
import { messages } from "../i18n/messages/resale-market";
import type { MarketHistoryPage } from "../resale-market-pagination";

/** Native, focusable boundary controls; no read, write, URL or persistence effect. */
export function ResaleMarketPagination({ section, variant, projection, snapshot, announceSnapshots, onPage }: {
  section: "trades" | "offers";
  variant: string;
  projection: MarketHistoryPage<unknown>;
  snapshot: readonly unknown[];
  announceSnapshots: boolean;
  onPage: (page: number) => void;
}) {
  const t = useT(messages);
  const { locale } = useLocale();
  const { page, pageCount, start, end, totalCount } = projection;
  // Initial mount is quiet. Activate before the changed range is committed to the DOM.
  const [announcement, setAnnouncement] = useState({ snapshot, variant, page, locale, live: false });
  if (announcement.snapshot !== snapshot || announcement.variant !== variant || announcement.page !== page || announcement.locale !== locale) {
    // An automatic post-submit read shares the outcome's announcement. User presentation changes still speak.
    const presentationChanged = announcement.variant !== variant || (announcement.page !== page && announcement.snapshot === snapshot) || announcement.locale !== locale;
    setAnnouncement({ snapshot, variant, page, locale, live: presentationChanged || announceSnapshots });
  }
  const id = `market-${section}`;
  return <>
    <p id={`${id}-status`} role="status" aria-live={announcement.live ? "polite" : "off"} aria-atomic="true">{t("market.pageRange", {
      section: t(section === "trades" ? "market.history" : "market.offers"), variant: t(variant === "wide" ? "market.wide" : "market.standard"), start, end, total: totalCount, page, pages: pageCount,
    })}</p>
    <nav className="actions" aria-label={t(section === "trades" ? "market.historyPages" : "market.offerPages")} aria-describedby={`${id}-status`}>
      {([ ["first", 1, page <= 1], ["previous", page - 1, page <= 1], ["next", page + 1, page >= pageCount], ["last", pageCount, page >= pageCount] ] as const).map(([label, target, unavailable]) =>
        <button key={label} type="button" aria-controls={`${id}-rows`} aria-disabled={unavailable} onClick={() => { if (!unavailable) onPage(target); }}>{t(`market.${label}`)}</button>)}
    </nav>
  </>;
}
