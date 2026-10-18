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

/** Titles and focus keys come from the route registry, so a route added there is identified here with no second list. */
export function identifyPage(pathname: string, routes: readonly RouteEntry[] = ROUTES): PageIdentity {
  const hit = routeFor(pathname, routes);
  if (!hit) {
    // No route matches, so the not-found screen is what is drawn. Its title wins even under /marketing.
    return { key: "*", title: `${NOT_FOUND_LABEL} · ${PRODUCT}`, label: NOT_FOUND_LABEL, known: false };
  }
  const marketing = marketingChromeLabel(pathname);
  const title = marketing?.title ?? (hit.path === "/" ? PRODUCT : `${hit.label} · ${PRODUCT}`);
  return { key: hit.path, title, label: hit.label, known: true };
}
