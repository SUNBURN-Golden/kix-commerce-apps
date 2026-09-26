import { useEffect, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { CREDIT_BOUNDARY } from "@kix/protocol-adapter";
import { protocol } from "../protocol";

const links = [
  { to: "/", label: "Box office", end: true },
  { to: "/admission", label: "Admission", end: false },
  { to: "/resale", label: "Resale", end: false },
  { to: "/credit", label: "Credit", end: false },
  { to: "/marketing", label: "Marketing", end: false },
];

export function Shell({ children }: { children: ReactNode }) {
  const meta = protocol.describe();
  const location = useLocation();
  const onMarketing = location.pathname === "/marketing" || location.pathname.startsWith("/marketing/");

  useEffect(() => {
    document.title = onMarketing ? "KIX Marketing · 설계중" : "KIX Box Office";
  }, [onMarketing]);

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="mark">KIX</span>
          <div>
            <p className="eyebrow">{onMarketing ? "Marketing desk · 설계중" : "Commerce desk"}</p>
            <h1>{onMarketing ? "Marketing" : "Box office"}</h1>
          </div>
        </div>
        <nav aria-label="Surfaces">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <p className="banner" role="status">
        Adapter <strong>{meta.adapter}</strong>. No live chain and no funds movement.{" "}
        {CREDIT_BOUNDARY.note}
      </p>
      <main>{children}</main>
    </div>
  );
}
