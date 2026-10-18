import { matchPath } from "react-router-dom";
import { MARKETING_SURFACES, marketingChromeLabel } from "../marketing/labels";

export interface ShellLink {
  to: string;
  label: string;
  end: boolean;
}

export interface PageIdentity {
  /** Stable key for focus moves. The discovery alias shares one key so a row choice does not move focus. */
  key: string;
  title: string;
  label: string;
  known: boolean;
}

const PRODUCT = "KIX Box Office";
export const NOT_FOUND_LABEL = "Page not found";

/** Routes that have no Shell link (the marketing surfaces M01-M05 are added from their own list). A test reads App.tsx so this list cannot drift from the router. */
const EXTRA_PATTERNS = [
  { pattern: "/booking/:eventId", key: "/booking", label: "Booking" },
  { pattern: "/discovery/:rowId", key: "/discovery", label: "Discover" },
] as const;

export function identifyPage(pathname: string, links: readonly ShellLink[]): PageIdentity {
  const marketing = marketingChromeLabel(pathname);
  const link = links.find((item) => matchPath({ path: item.to, end: true }, pathname));
  const surface = MARKETING_SURFACES.find((item) => item.path === pathname);
  const extra =
    EXTRA_PATTERNS.find((item) => matchPath({ path: item.pattern, end: true }, pathname)) ??
    (surface ? { key: surface.path, label: `Marketing ${surface.id}` } : undefined);
  const key = link?.to ?? extra?.key ?? null;
  const label = link?.label ?? extra?.label ?? null;
  if (key === null || label === null) {
    // No route matches, so the not-found screen is what is drawn. Its title wins even under /marketing.
    return { key: "*", title: `${NOT_FOUND_LABEL} · ${PRODUCT}`, label: NOT_FOUND_LABEL, known: false };
  }
  const title = marketing?.title ?? (key === "/" ? PRODUCT : `${label} · ${PRODUCT}`);
  return { key, title, label, known: true };
}
