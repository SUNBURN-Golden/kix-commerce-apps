import { Link, useLocation } from "react-router-dom";
import { useT } from "../i18n/locale-context";
import { routeKey } from "../i18n/use-page-identity";
import { ROUTE_GROUPS, breadcrumbFor, routeFor } from "../shell/route-registry";

/**
 * Where the page sits: group, parent, page. The binding word is printed as text beside it, so the status is not carried by colour.
 * Nothing is drawn for an address no route matches.
 */
export function Breadcrumb() {
  const { pathname } = useLocation();
  const t = useT();
  const crumbs = breadcrumbFor(pathname);
  const route = routeFor(pathname);
  if (!route || crumbs.length === 0) {
    return null;
  }
  // The registry crumbs carry English labels; the same crumb is found again here by its link, its current mark or its group.
  const labelOf = (crumb: (typeof crumbs)[number]): string => {
    const target = crumb.current ? route : crumb.to ? routeFor(crumb.to) : null;
    if (target) {
      return t(routeKey(target));
    }
    const group = ROUTE_GROUPS.find((item) => item.label === crumb.label);
    return group ? t(`nav.group.${group.id}`) : crumb.label;
  };
  return (
    <div className="crumb-row">
      <nav aria-label={t("crumb.nav")}>
        <ol className="crumbs">
          {crumbs.map((crumb) => (
            <li key={`${crumb.label}-${crumb.current}`}>
              {crumb.to ? <Link to={crumb.to}>{labelOf(crumb)}</Link> : <span aria-current={crumb.current ? "page" : undefined}>{labelOf(crumb)}</span>}
            </li>
          ))}
        </ol>
        <p className="crumb-binding">
          {t("crumb.binding")} <strong>{route.binding}</strong>
        </p>
      </nav>
    </div>
  );
}
