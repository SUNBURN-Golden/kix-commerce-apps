import { useMemo } from "react";
import { identifyPage, type PageIdentity, type PageText } from "../shell/page-identity";
import { APP_ROUTES, type RouteEntry } from "../shell/route-registry";
import { useLocale } from "./locale-context";
import type { Translate } from "./translate";
import type { RouteMessageKey } from "./catalogue";

/** The registry label of a route in the chosen locale. */
export function routeKey(entry: Pick<RouteEntry, "id">): RouteMessageKey {
  return `route.${entry.id}` as RouteMessageKey;
}

export function routeLabel(entry: Pick<RouteEntry, "id" | "label">, t: Translate, locale: "en" | "ko"): string {
  if (import.meta.env.DEV && entry.id === "component-gallery") {
    return locale === "en" ? entry.label : "컴포넌트 갤러리";
  }
  return t(routeKey(entry));
}

export function usePageIdentity(pathname: string): PageIdentity {
  const { t, locale } = useLocale();
  return useMemo(() => {
    const text: PageText = { label: (entry) => routeLabel(entry, t, locale), notFound: t("notFound.title"), marketingHubTitle: t("shell.title.marketingHub") };
    return identifyPage(pathname, APP_ROUTES, text);
  }, [pathname, t, locale]);
}
