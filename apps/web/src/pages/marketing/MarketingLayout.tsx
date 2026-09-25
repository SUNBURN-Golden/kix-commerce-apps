import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/marketing", label: "Campaigns", end: true },
  { to: "/marketing/tracking", label: "Tracking stub", end: true },
  { to: "/", label: "Desk", end: true },
];

export function MarketingLayout() {
  return (
    <div className="mkt">
      <header className="top">
        <div className="brand">
          <span className="mark">KIX</span>
          <div>
            <p className="eyebrow">Wave 7 · marketing demo</p>
            <h1>Public notices</h1>
          </div>
        </div>
        <nav aria-label="Marketing">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <p className="banner" role="status">
        Marketing demo only. Not protocol conformance. HTTP/OpenAPI binding is still required before any
        production integration claim. No live chain, no payment, and no live analytics.
      </p>
      <Outlet />
    </div>
  );
}
