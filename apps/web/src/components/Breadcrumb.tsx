import { Link, useLocation } from "react-router-dom";
import { breadcrumbFor, routeFor } from "../shell/route-registry";

/**
 * Where the page sits: group, parent, page. The binding word is printed as text beside it, so the status is not carried by colour.
 * Nothing is drawn for an address no route matches.
 */
export function Breadcrumb() {
  const { pathname } = useLocation();
  const crumbs = breadcrumbFor(pathname);
  const route = routeFor(pathname);
  if (!route || crumbs.length === 0) {
    return null;
  }
  return (
    <div className="crumb-row">
      <nav aria-label="Breadcrumb">
        <ol className="crumbs">
          {crumbs.map((crumb) => (
            <li key={`${crumb.label}-${crumb.current}`}>
              {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : <span aria-current={crumb.current ? "page" : undefined}>{crumb.label}</span>}
            </li>
          ))}
        </ol>
        <p className="crumb-binding">
          Binding <strong>{route.binding}</strong>
        </p>
      </nav>
    </div>
  );
}
