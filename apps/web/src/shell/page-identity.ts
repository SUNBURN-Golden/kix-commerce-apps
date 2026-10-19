import { marketingChromeLabel } from "../marketing/labels";
import { NOT_FOUND_LABEL, ROUTES, routeFor, type RouteEntry } from "./route-registry";

export { NOT_FOUND_LABEL };

export interface PageIdentity {
  /** Stable key for focus moves. The discovery alias shares one key so a row choice does not move focus. */
  key: string;
  title: string;
  label: string;
  known: boolean;
}

const PRODUCT = "KIX Box Office";

/** Display words for a chosen locale. Without it the registry's English labels are used. The `key` never depends on it, so a locale switch moves no focus. */
export interface PageText {
  label: (entry: RouteEntry) => string;
  notFound: string;
  marketingHubTitle: string;
}

/** Titles and focus keys come from the route registry, so a route added there is identified here with no second list. */
export function identifyPage(pathname: string, routes: readonly RouteEntry[] = ROUTES, text?: PageText): PageIdentity {
  const hit = routeFor(pathname, routes);
  if (!hit) {
    // No route matches, so the not-found screen is what is drawn. Its title wins even under /marketing.
    const notFound = text?.notFound ?? NOT_FOUND_LABEL;
    return { key: "*", title: `${notFound} · ${PRODUCT}`, label: notFound, known: false };
  }
  const label = text ? text.label(hit) : hit.label;
  const marketing = marketingChromeLabel(pathname);
  // The hub has no single charter label, so only its title follows the locale; a surface title carries the charter label verbatim.
  const marketingTitle = marketing && text && marketing.title === "KIX Marketing" ? text.marketingHubTitle : marketing?.title;
  const title = marketingTitle ?? (hit.path === "/" ? PRODUCT : `${label} · ${PRODUCT}`);
  return { key: hit.path, title, label, known: true };
}
