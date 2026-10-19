import { useMemo } from "react";
import { identifyPage, type PageIdentity, type PageText } from "../shell/page-identity";
import type { RouteEntry } from "../shell/route-registry";
import { useT } from "./locale-context";
import type { RouteMessageKey } from "./catalogue";

/** The registry label of a route in the chosen locale. */
export function routeKey(entry: Pick<RouteEntry, "id">): RouteMessageKey {
  return `route.${entry.id}` as RouteMessageKey;
}

export function usePageIdentity(pathname: string): PageIdentity {
  const t = useT();
  return useMemo(() => {
    const text: PageText = { label: (entry) => t(routeKey(entry)), notFound: t("notFound.title"), marketingHubTitle: t("shell.title.marketingHub") };
    return identifyPage(pathname, undefined, text);
  }, [pathname, t]);
}
